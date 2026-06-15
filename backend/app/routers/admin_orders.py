"""Админка-заказы (ADM-M-01..06) + клиенты и платежи (ADM-S-08, 09) + купоны (ADM-S-12)."""
from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.config import settings
from ..core.db import get_db
from ..core.pagination import PageLimit, PageOffset, paginate
from ..core.security import get_current_staff, require_super_admin
from ..models.catalog import Addon, Drink
from ..models.orders import Coupon, Order, OrderEvent, Payment
from ..models.users import StaffUser, User
from ..services import crm
from ..services.i18n import t
from ..services.order_flow import ACTIVE_STATUSES, add_event, notify, transition

router = APIRouter(prefix="/api/admin", tags=["admin-orders"])


def _drink_map(db: Session, orders: list[Order]) -> dict[int, Drink]:
    """drink_id -> Drink (картинка/slug/актуальное имя в позициях заказа)."""
    ids = {i.drink_id for o in orders for i in o.items}
    if not ids:
        return {}
    return {d.id: d for d in db.scalars(select(Drink).where(Drink.id.in_(ids)))}


def _addon_map(db: Session, orders: list[Order]) -> dict[int, Addon]:
    """addon_id -> Addon (актуальное англ. имя добавки для админки)."""
    ids = {a.addon_id for o in orders for i in o.items for a in i.addons}
    if not ids:
        return {}
    return {a.id: a for a in db.scalars(select(Addon).where(Addon.id.in_(ids)))}


def _events_by_order(db: Session, orders: list[Order]) -> dict[int, list[OrderEvent]]:
    """order_id -> события (для таймингов сервиса в CRM-аналитике)."""
    ids = [o.id for o in orders]
    if not ids:
        return {}
    out: dict[int, list[OrderEvent]] = {}
    for e in db.scalars(select(OrderEvent).where(OrderEvent.order_id.in_(ids))
                        .order_by(OrderEvent.id)):
        out.setdefault(e.order_id, []).append(e)
    return out


def _manager_names(db: Session, orders: list[Order]) -> dict[int, str]:
    """manager_id -> имя (для managerAffinity)."""
    ids = {o.manager_id for o in orders if o.manager_id}
    if not ids:
        return {}
    return {s.id: s.name for s in db.scalars(select(StaffUser).where(StaffUser.id.in_(ids)))}


def _order_row(o: Order, drink_map: dict[int, Drink] | None = None,
               addon_map: dict[int, Addon] | None = None) -> dict:
    drink_map = drink_map or {}
    addon_map = addon_map or {}
    return {
        "id": o.id, "number": o.number, "status": o.status, "paymentStatus": o.payment_status,
        "customerName": o.customer_name, "phone": o.phone,
        "carPlate": o.car_plate, "emirate": o.emirate,
        "subtotal": o.subtotal, "couponDiscount": o.coupon_discount, "total": o.total,
        "managerId": o.manager_id, "rating": o.rating,
        "arrived": o.arrived_at is not None,
        "createdAt": o.created_at.isoformat() if o.created_at else None,
        "items": [
            {
                "id": i.id,
                # снэпшот (как оформил клиент, в локали заказа) — для блока проверки
                "name": i.custom_name or i.drink_name,
                "customName": i.custom_name, "drinkName": i.drink_name,
                # актуальное англ. имя из каталога — для рабочего вида менеджера
                "drinkNameEn": (t(drink_map[i.drink_id].name, "en")
                                if i.drink_id in drink_map else i.drink_name),
                "sizeLabel": i.size_label,
                "previewUrl": drink_map[i.drink_id].preview_url if i.drink_id in drink_map else None,
                "drinkSlug": drink_map[i.drink_id].slug if i.drink_id in drink_map else None,
                "quantity": i.quantity, "unitPrice": i.unit_price, "paidByCoupon": i.paid_by_coupon,
                # граммовка + цена добавок; name = снэпшот, nameEn = актуальное англ.
                "addons": [
                    {"name": a.addon_name,
                     "nameEn": (t(addon_map[a.addon_id].name, "en")
                                if a.addon_id in addon_map else a.addon_name),
                     "portions": a.portions, "amount": a.amount,
                     "unit": a.unit_code, "price": a.price_per_portion}
                    for a in i.addons
                ],
            }
            for i in o.items
        ],
    }


@router.get("/orders")
def admin_orders(
    response: Response,
    active: bool | None = Query(None, description="фильтр по активности (ADM-M-01 AC2)"),
    manager_id: int | None = Query(None),
    unassigned: bool = Query(False, description="заказы без менеджера"),
    limit: int | None = PageLimit,
    offset: int = PageOffset,
    staff: StaffUser = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    q = select(Order).options(selectinload(Order.items)).where(Order.payment_status == "paid")
    if active is True:
        q = q.where(Order.status.in_(ACTIVE_STATUSES))
    elif active is False:
        q = q.where(Order.status.notin_(ACTIVE_STATUSES))
    if manager_id is not None:
        q = q.where(Order.manager_id == manager_id)
    if unassigned:
        q = q.where(Order.manager_id.is_(None))
    orders = db.scalars(q.order_by(Order.id.desc())).all()
    dm, am = _drink_map(db, orders), _addon_map(db, orders)
    return paginate([_order_row(o, dm, am) for o in orders], response, limit, offset)


@router.get("/orders/{order_id}")
def admin_order_detail(order_id: int, staff: StaffUser = Depends(get_current_staff),
                       db: Session = Depends(get_db)):
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    data = _order_row(o, _drink_map(db, [o]), _addon_map(db, [o]))
    # имена сотрудников для истории статусов (кликабельны на странице сотрудника)
    staff_ids = {e.by_staff_id for e in o.events if e.by_staff_id}
    staff_names = {s.id: s.name for s in db.scalars(
        select(StaffUser).where(StaffUser.id.in_(staff_ids)))} if staff_ids else {}
    data["events"] = [
        {"type": e.type, "status": e.status,
         "byStaffId": e.by_staff_id, "byStaffName": staff_names.get(e.by_staff_id),
         "byUserId": e.by_user_id,
         "note": e.note, "at": e.created_at.isoformat() if e.created_at else None}
        for e in o.events
    ]
    return data


@router.post("/orders/{order_id}/take")
def take_order(order_id: int, staff: StaffUser = Depends(get_current_staff),
               db: Session = Depends(get_db)):
    """ADM-M-02: «Взять в работу» — статус + закрепление менеджера + история."""
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    if o.payment_status != "paid":
        raise HTTPException(409, "ORDER_NOT_PAID")
    transition(db, o, "in_progress", by_staff_id=staff.id)
    return _order_row(o)


class StatusIn(BaseModel):
    status: str  # ready | completed
    note: str | None = None


class RefundIn(BaseModel):
    note: str | None = None  # refund использует только note (status не требуется)


@router.post("/orders/{order_id}/status")
def set_status(order_id: int, body: StatusIn, staff: StaffUser = Depends(get_current_staff),
               db: Session = Depends(get_db)):
    """ADM-M-03: готов к выдаче / передан клиенту."""
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    if body.status not in ("ready", "completed"):
        raise HTTPException(422, "VALIDATION_ERROR")
    transition(db, o, body.status, by_staff_id=staff.id, note=body.note)
    return _order_row(o)


@router.post("/orders/{order_id}/refund")
def refund_order(order_id: int, body: RefundIn | None = None,
                 staff: StaffUser = Depends(get_current_staff), db: Session = Depends(get_db)):
    """ADM-M-06 (опциональный модуль): возврат. Полный возврат заказа;
    DECISION: Stripe Refund вызывается при наличии ключа, в mock-режиме помечается локально.
    Применённый купон аннулируется не возвращаясь (открытый вопрос Q18 — зафиксировано так)."""
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    transition(db, o, "refund", by_staff_id=staff.id, note=(body.note if body else None))
    o.payment_status = "refunded"
    for p in o.payments:
        if p.status == "succeeded":
            p.status = "refunded"
    add_event(db, o, "refund", by_staff_id=staff.id)
    db.commit()
    return _order_row(o)


# ---------- Клиенты (ADM-S-08) ----------

def _customer_stats(orders: list[Order], payments: list[Payment], coupons: list[Coupon],
                    drink_map: dict[int, Drink], addon_map: dict[int, Addon]) -> dict:
    """Поведенческая аналитика по клиенту (RFM + предпочтения) для маркетинга/выводов.

    Денежные/покупательские метрики считаем по ОПЛАЧЕННЫМ заказам — это реальные покупки.
    """
    paid = [o for o in orders if o.payment_status == "paid"]
    now = datetime.utcnow()
    n = len(paid)

    spent = sum(o.total for o in paid)
    discount = sum(o.coupon_discount for o in paid)
    dates = sorted(o.created_at for o in paid if o.created_at)
    first, last = (dates[0], dates[-1]) if dates else (None, None)

    by_hour = [0] * 24
    by_weekday = [0] * 7
    drink_qty: Counter = Counter()
    drink_orders: Counter = Counter()
    addon_qty: Counter = Counter()
    total_items = 0
    for o in paid:
        if o.created_at:
            by_hour[o.created_at.hour] += 1
            by_weekday[o.created_at.weekday()] += 1
        seen = set()
        for i in o.items:
            name = t(drink_map[i.drink_id].name, "en") if i.drink_id in drink_map else i.drink_name
            key = (i.drink_id, name)
            drink_qty[key] += i.quantity
            seen.add(key)
            total_items += i.quantity
            for a in i.addons:
                an = t(addon_map[a.addon_id].name, "en") if a.addon_id in addon_map else a.addon_name
                addon_qty[(a.addon_id, an)] += a.portions * i.quantity
        for key in seen:
            drink_orders[key] += 1

    likes = sum(1 for o in paid if o.rating == "like")
    dislikes = sum(1 for o in paid if o.rating == "dislike")
    rated = likes + dislikes

    tenure_days = (now - first).days if first else 0
    recency_days = (now - last).days if last else None

    return {
        "totalOrders": len(orders),
        "paidOrders": n,
        "completedOrders": sum(1 for o in paid if o.status == "completed"),
        "activeOrders": sum(1 for o in orders if o.status in ACTIVE_STATUSES),
        "refundedOrders": sum(1 for o in orders if o.payment_status == "refunded"),
        "totalSpent": round(spent, 2),
        "avgOrderValue": round(spent / n, 2) if n else 0,
        "biggestOrder": round(max((o.total for o in paid), default=0), 2),
        "discountTotal": round(discount, 2),
        "totalItems": total_items,
        "avgBasket": round(total_items / n, 1) if n else 0,
        "firstOrderAt": first.isoformat() if first else None,
        "lastOrderAt": last.isoformat() if last else None,
        "recencyDays": recency_days,
        "tenureDays": tenure_days,
        "ordersPerMonth": round(n / max(tenure_days / 30.0, 1.0), 2) if n else 0,
        "avgDaysBetween": round(tenure_days / (n - 1), 1) if n > 1 else None,
        "likes": likes,
        "dislikes": dislikes,
        "ratedOrders": rated,
        "satisfaction": round(likes / rated, 2) if rated else None,
        "byHour": by_hour,
        "byWeekday": by_weekday,
        "peakHour": by_hour.index(max(by_hour)) if any(by_hour) else None,
        "peakWeekday": by_weekday.index(max(by_weekday)) if any(by_weekday) else None,
        "topDrinks": [{"name": nm, "qty": q, "orders": drink_orders[(did, nm)]}
                      for (did, nm), q in drink_qty.most_common(6)],
        "topAddons": [{"name": nm, "qty": q} for (_aid, nm), q in addon_qty.most_common(6)],
        "couponsIssued": len(coupons),
        "couponsUsed": sum(1 for c in coupons if c.status == "used"),
        "couponsActive": sum(1 for c in coupons if c.status == "active"),
        "paymentsSucceeded": sum(1 for p in payments if p.status == "succeeded"),
    }



@router.get("/customers", dependencies=[Depends(require_super_admin)])
def customers(response: Response, limit: int | None = PageLimit, offset: int = PageOffset,
              db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id.desc())).all()
    return paginate([
        {"id": u.id, "phone": u.phone, "name": u.name, "carPlate": u.car_plate,
         "locale": u.preferred_locale,
         "createdAt": u.created_at.isoformat() if u.created_at else None}
        for u in users
    ], response, limit, offset)


def _cohort_thresholds(db: Session) -> dict:
    """Квинтильные RFM-пороги по ВСЕЙ когорте оплаченных клиентов.

    Достаточно лёгких метрик (recency/частота/сумма), без полного _customer_stats,
    чтобы порог считался быстро. Используется и для одного клиента, и для аудитории.
    """
    now = datetime.utcnow()
    rows = db.execute(
        select(Order.user_id, Order.total, Order.created_at)
        .where(Order.payment_status == "paid")
    ).all()
    agg: dict[int, dict] = {}
    for uid, total, created in rows:
        a = agg.setdefault(uid, {"paidOrders": 0, "totalSpent": 0.0, "last": None})
        a["paidOrders"] += 1
        a["totalSpent"] += (total or 0)
        if created and (a["last"] is None or created > a["last"]):
            a["last"] = created
    metrics = [
        {"paidOrders": a["paidOrders"], "totalSpent": a["totalSpent"],
         "recencyDays": (now - a["last"]).days if a["last"] else None}
        for a in agg.values()
    ]
    return crm.rfm_thresholds(metrics)


@router.get("/customers/{user_id}", dependencies=[Depends(require_super_admin)])
def customer_detail(user_id: int, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "NOT_FOUND")
    orders = db.scalars(select(Order).options(selectinload(Order.items))
                        .where(Order.user_id == u.id).order_by(Order.id.desc())).all()
    payments = db.scalars(select(Payment).join(Order).where(Order.user_id == u.id)).all()
    coupons = db.scalars(select(Coupon).where(Coupon.user_id == u.id)).all()
    dm, am = _drink_map(db, orders), _addon_map(db, orders)
    stats = _customer_stats(orders, payments, coupons, dm, am)
    # CRM-аналитика: RFM скорится по порогам всей когорты + расширенные метрики клиента
    thresholds = _cohort_thresholds(db)
    rfm = crm.rfm_scores(stats["recencyDays"], stats["paidOrders"], stats["totalSpent"], thresholds)
    extra = crm.per_customer_extra(orders, _events_by_order(db, orders),
                                   _manager_names(db, orders), rfm=rfm)
    stats.update(extra)
    stats["personaTags"] = crm.persona_tags(stats)
    return {
        "id": u.id, "phone": u.phone, "name": u.name, "carPlate": u.car_plate,
        "emirate": u.emirate, "locale": u.preferred_locale,
        "createdAt": u.created_at.isoformat() if u.created_at else None,
        "orders": [_order_row(o, dm, am) for o in orders],
        "payments": [_payment_row(p) for p in payments],
        "coupons": [_coupon_row(c) for c in coupons],
        "stats": stats,
    }


@router.get("/audience", dependencies=[Depends(require_super_admin)])
def audience(db: Session = Depends(get_db)):
    """CRM-аудитория: RFM-сегментация всей базы, KPI, сетка RFM и персоны.

    Когорта мала (клиенты единичной точки) — считаем всё в памяти за один проход.
    """
    now = datetime.utcnow()
    users = db.scalars(select(User)).all()
    orders = db.scalars(select(Order).options(selectinload(Order.items))).all()
    coupons = db.scalars(select(Coupon)).all()
    dm, am = _drink_map(db, orders), _addon_map(db, orders)

    orders_by_user: dict[int, list[Order]] = {}
    for o in orders:
        orders_by_user.setdefault(o.user_id, []).append(o)
    coupons_by_user: dict[int, list[Coupon]] = {}
    for c in coupons:
        coupons_by_user.setdefault(c.user_id, []).append(c)

    # статистика по каждому клиенту (переиспользуем боевой _customer_stats)
    per_user_stats: dict[int, dict] = {}
    for u in users:
        uo = orders_by_user.get(u.id, [])
        per_user_stats[u.id] = _customer_stats(uo, [], coupons_by_user.get(u.id, []), dm, am)

    # пороги RFM один раз по всей когорте оплаченных клиентов
    thresholds = crm.rfm_thresholds(list(per_user_stats.values()))

    seg_buckets: dict[str, list[dict]] = {k: [] for k in crm.SEGMENTS}
    rfm_grid = [[0] * 5 for _ in range(5)]  # [fIndex-1][rIndex-1]
    persona_counter: Counter = Counter()
    clv_sum = 0.0
    kpi_active = kpi_at_risk = kpi_churned = kpi_new = 0
    month_key = f"{now.year:04d}-{now.month:02d}"

    for u in users:
        st = per_user_stats[u.id]
        paid = st["paidOrders"]
        scores = crm.rfm_scores(st["recencyDays"], paid, st["totalSpent"], thresholds)
        r, f, m = scores["r"], scores["f"], scores["m"]
        segment = crm.rfm_segment(r, f) if paid >= 1 else "no_purchase"

        churn = crm.churn_metrics(st["recencyDays"], st["avgDaysBetween"], st["ordersPerMonth"])
        clv = crm.clv_metrics(st, churn)
        clv_sum += clv["predicted"]
        tags = crm.persona_tags(st)
        for tag in tags:
            persona_counter[tag] += 1

        recency = st["recencyDays"]
        if recency is not None and recency <= 30:
            kpi_active += 1
        if churn["risk"] == "high" and paid > 0:
            kpi_at_risk += 1
        if recency is not None and recency > 60:
            kpi_churned += 1
        if (st["firstOrderAt"] or "").startswith(month_key):
            kpi_new += 1

        if paid >= 1:
            rfm_grid[f - 1][r - 1] += 1

        seg_buckets[segment].append({
            "id": u.id, "name": u.name, "phone": u.phone,
            "totalSpent": st["totalSpent"], "recencyDays": recency,
            "paidOrders": paid,
            "rfm": {"r": r, "f": f, "m": m, "score": f"{r}{f}{m}", "segment": segment},
            "_tags": tags,
        })

    segments_out = []
    for key, label_desc in crm.SEGMENTS.items():
        label, description = label_desc
        members = seg_buckets[key]
        count = len(members)
        spents = [c["totalSpent"] for c in members]
        recencies = [c["recencyDays"] for c in members if c["recencyDays"] is not None]
        freqs = [c["paidOrders"] for c in members]
        tag_counter: Counter = Counter()
        for c in members:
            for tg in c["_tags"]:
                tag_counter[tg] += 1
        top = sorted(members, key=lambda c: c["totalSpent"], reverse=True)[:12]
        segments_out.append({
            "key": key, "label": label, "description": description,
            "count": count,
            "share": round(count / len(users), 2) if users else 0.0,
            "avgSpent": round(sum(spents) / count, 2) if count else 0.0,
            "avgRecency": round(sum(recencies) / len(recencies), 1) if recencies else None,
            "avgFrequency": round(sum(freqs) / count, 2) if count else 0.0,
            "personaTags": [{"tag": tg, "count": cnt} for tg, cnt in tag_counter.most_common(5)],
            "customers": [{k: v for k, v in c.items() if k != "_tags"} for c in top],
        })

    total = len(users)
    personas = [{"tag": tg, "count": cnt, "share": round(cnt / total, 2) if total else 0.0}
                for tg, cnt in persona_counter.most_common()]

    return {
        "total": total,
        "kpis": {
            "customers": total,
            "active": kpi_active,
            "atRisk": kpi_at_risk,
            "churned": kpi_churned,
            "newThisMonth": kpi_new,
            "avgCLV": round(clv_sum / total, 2) if total else 0.0,
        },
        "segments": segments_out,
        "rfmGrid": rfm_grid,
        "personas": personas,
    }


class CustomerCreate(BaseModel):
    phone: str
    name: str | None = None
    carPlate: str | None = None
    emirate: str | None = None
    locale: str | None = None


@router.post("/customers", dependencies=[Depends(require_super_admin)])
def create_customer(body: CustomerCreate, db: Session = Depends(get_db)):
    """ADM-S-08: ручное создание клиента из админки (обычно регистрируются сами)."""
    phone = (body.phone or "").strip()
    if not phone:
        raise HTTPException(422, "PHONE_REQUIRED")
    if db.scalar(select(User).where(User.phone == phone)):
        raise HTTPException(409, "PHONE_TAKEN")
    u = User(phone=phone, name=(body.name or "").strip() or None,
             car_plate=(body.carPlate or "").upper().strip() or None,
             emirate=(body.emirate or "").strip() or None,
             preferred_locale=(body.locale or "en"))
    db.add(u)
    db.commit()
    return {"id": u.id, "phone": u.phone, "name": u.name, "carPlate": u.car_plate,
            "emirate": u.emirate, "locale": u.preferred_locale}


class CustomerIn(BaseModel):
    name: str | None = None
    carPlate: str | None = None
    emirate: str | None = None
    locale: str | None = None
    phone: str | None = None


@router.patch("/customers/{user_id}", dependencies=[Depends(require_super_admin)])
def update_customer(user_id: int, body: CustomerIn, db: Session = Depends(get_db)):
    """ADM-S-08/PUB-A-06 AC3: редактирование личных данных из админки."""
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "NOT_FOUND")
    if body.phone is not None:
        ph = body.phone.strip()
        if not ph:
            raise HTTPException(422, "PHONE_REQUIRED")
        if ph != u.phone and db.scalar(select(User).where(User.phone == ph, User.id != u.id)):
            raise HTTPException(409, "PHONE_TAKEN")
        u.phone = ph
    if body.name is not None:
        u.name = body.name.strip() or None
    if body.carPlate is not None:
        u.car_plate = body.carPlate.upper().strip() or None
    if body.emirate is not None:
        u.emirate = body.emirate.strip() or None
    if body.locale is not None:
        u.preferred_locale = body.locale
    db.commit()
    return {"ok": True}


# ---------- Платежи (ADM-S-09) ----------

def _payment_row(p: Payment) -> dict:
    """Полная карточка платежа по модели Stripe (для списка, детальной и карточки клиента)."""
    return {
        "id": p.id, "orderId": p.order_id,
        "amount": round(p.amount or 0, 2), "currency": p.currency,
        "provider": p.provider, "providerId": p.provider_id, "status": p.status,
        "paymentIntentId": p.payment_intent_id, "chargeId": p.charge_id,
        "customerId": p.customer_id,
        "method": p.method_type, "cardBrand": p.card_brand, "cardLast4": p.card_last4,
        "cardFunding": p.card_funding, "cardCountry": p.card_country, "cardExp": p.card_exp,
        "fee": round(p.fee_amount or 0, 2),
        "net": round(p.net_amount, 2) if p.net_amount is not None else None,
        "refunded": round(p.refunded_amount or 0, 2),
        "receiptUrl": p.receipt_url,
        "failureCode": p.failure_code, "failureMessage": p.failure_message,
        "riskLevel": p.risk_level, "riskScore": p.risk_score,
        "disputeStatus": p.dispute_status, "livemode": bool(p.livemode),
        "createdAt": p.created_at.isoformat() if p.created_at else None,
        "paidAt": p.paid_at.isoformat() if p.paid_at else None,
        "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
    }


def _payment_row_full(p: Payment) -> dict:
    """Строка платежа + контекст заказа/клиента (для списка и детальной)."""
    row = _payment_row(p)
    o = p.order
    row["orderNumber"] = o.number if o else None
    row["customerName"] = o.customer_name if o else None
    row["customerPhone"] = o.phone if o else None
    row["userId"] = o.user_id if o else None
    return row


def _stripe_mode() -> str:
    """mock (нет ключа) | test (sk_test_…) | live (sk_live_…)."""
    key = settings.stripe_secret_key or ""
    if not key:
        return "mock"
    return "live" if key.startswith("sk_live") else "test"


@router.get("/payments/config", dependencies=[Depends(require_super_admin)])
def payments_config():
    """Состояние интеграции Stripe — для баннера/чеклиста подключения в админке."""
    mode = _stripe_mode()
    return {
        "provider": "stripe",
        "connected": mode != "mock",
        "mode": mode,                                    # mock | test | live
        "webhookConfigured": bool(settings.stripe_webhook_secret),
        "currency": "AED",
        "feePolicy": "2.9% + 1 AED",
        "dashboardUrl": "https://dashboard.stripe.com" + ("/test" if mode == "test" else ""),
    }


@router.get("/payments/summary", dependencies=[Depends(require_super_admin)])
def payments_summary(date_from: datetime | None = Query(None, alias="from"),
                     date_to: datetime | None = Query(None, alias="to"),
                     db: Session = Depends(get_db)):
    """Сводка: оборот / комиссии Stripe / чистыми / возвраты + разбивки по статусу, методу, карте."""
    q = select(Payment)
    if date_from:
        q = q.where(Payment.created_at >= date_from)
    if date_to:
        q = q.where(Payment.created_at <= date_to)
    rows = db.scalars(q).all()

    succeeded = [p for p in rows if p.status == "succeeded"]
    refunded = [p for p in rows if p.status == "refunded"]
    captured = succeeded + refunded                       # деньги реально списывались
    gross = sum(p.amount or 0 for p in captured)
    fees = sum(p.fee_amount or 0 for p in captured)
    refunds = sum(p.refunded_amount or 0 for p in rows)
    net = gross - fees - refunds

    by_status: dict[str, dict] = {}
    for p in rows:
        s = by_status.setdefault(p.status, {"count": 0, "amount": 0.0})
        s["count"] += 1
        s["amount"] = round(s["amount"] + (p.amount or 0), 2)

    by_method: dict[str, dict] = {}
    for p in captured:
        m = by_method.setdefault(p.method_type or "card", {"count": 0, "amount": 0.0})
        m["count"] += 1
        m["amount"] = round(m["amount"] + (p.amount or 0), 2)

    by_brand: dict[str, int] = {}
    for p in captured:
        if p.card_brand:
            by_brand[p.card_brand] = by_brand.get(p.card_brand, 0) + 1

    attempts = len(rows)
    ok = len(captured)
    return {
        "count": attempts,
        "gross": round(gross, 2),
        "fees": round(fees, 2),
        "refunds": round(refunds, 2),
        "net": round(net, 2),
        "avg": round(gross / ok, 2) if ok else 0,
        "successRate": round(ok / attempts, 3) if attempts else 0,
        "succeededCount": len(succeeded),
        "refundedCount": len(refunded),
        "pendingCount": sum(1 for p in rows if p.status == "pending"),
        "failedCount": sum(1 for p in rows if p.status == "failed"),
        "disputedCount": sum(1 for p in rows if p.dispute_status),
        "currency": "AED",
        "byStatus": by_status,
        "byMethod": by_method,
        "byBrand": by_brand,
    }


@router.get("/payments", dependencies=[Depends(require_super_admin)])
def payments_list(response: Response,
                  status: str | None = Query(None),
                  method: str | None = Query(None),
                  q: str | None = Query(None, description="поиск: № заказа, телефон, id Stripe, last4"),
                  date_from: datetime | None = Query(None, alias="from"),
                  date_to: datetime | None = Query(None, alias="to"),
                  limit: int | None = PageLimit, offset: int = PageOffset,
                  db: Session = Depends(get_db)):
    sel = select(Payment).options(selectinload(Payment.order)).order_by(Payment.id.desc())
    if status:
        sel = sel.where(Payment.status == status)
    if method:
        sel = sel.where(Payment.method_type == method)
    if date_from:
        sel = sel.where(Payment.created_at >= date_from)
    if date_to:
        sel = sel.where(Payment.created_at <= date_to)
    rows = db.scalars(sel).all()

    out = [_payment_row_full(p) for p in rows]
    if q:
        needle = q.strip().lower()
        out = [r for r in out if needle in " ".join(
            str(v).lower() for v in (r["orderNumber"], r["customerPhone"], r["customerName"],
                                     r["providerId"], r["paymentIntentId"], r["chargeId"],
                                     r["cardLast4"], r["id"]) if v)]
    return paginate(out, response, limit, offset)


@router.get("/payments/{payment_id}", dependencies=[Depends(require_super_admin)])
def payment_detail(payment_id: int, db: Session = Depends(get_db)):
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(404, "NOT_FOUND")
    row = _payment_row_full(p)
    o = p.order
    if o:
        row["order"] = {
            "id": o.id, "number": o.number, "status": o.status,
            "paymentStatus": o.payment_status, "total": round(o.total or 0, 2),
            "subtotal": round(o.subtotal or 0, 2), "couponDiscount": round(o.coupon_discount or 0, 2),
            "createdAt": o.created_at.isoformat() if o.created_at else None,
            "items": [{"name": i.custom_name or i.drink_name, "quantity": i.quantity,
                       "unitPrice": round(i.unit_price or 0, 2)} for i in o.items],
        }
        # таймлайн платежа из денежных событий заказа (реальные данные)
        timeline = [{"type": e.type, "note": e.note,
                     "at": e.created_at.isoformat() if e.created_at else None}
                    for e in o.events if e.type in ("created", "paid", "refund")]
        if p.dispute_status:
            timeline.append({"type": "dispute", "note": p.dispute_status,
                             "at": row.get("updatedAt")})
        row["timeline"] = timeline
    return row


class PaymentRefundIn(BaseModel):
    amount: float | None = None   # частичный возврат; None → полный остаток
    reason: str | None = None


@router.post("/payments/{payment_id}/refund", dependencies=[Depends(require_super_admin)])
def refund_payment(payment_id: int, body: PaymentRefundIn | None = None,
                   db: Session = Depends(get_db)):
    """Возврат по платежу: Stripe Refund при реальном charge, иначе локально.
    Частичный возврат поддержан; полный переводит заказ в payment_status=refunded.
    Готовочный статус заказа не трогаем — возврат денег от него не зависит."""
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(404, "NOT_FOUND")
    if p.status not in ("succeeded", "refunded"):
        raise HTTPException(409, "NOT_REFUNDABLE")
    already = p.refunded_amount or 0
    remaining = round((p.amount or 0) - already, 2)
    if remaining <= 0:
        raise HTTPException(409, "ALREADY_REFUNDED")
    amount = round(min(body.amount, remaining), 2) if (body and body.amount) else remaining
    if amount <= 0:
        raise HTTPException(422, "VALIDATION_ERROR")

    if settings.stripe_secret_key and p.charge_id and not p.charge_id.startswith("ch_mock"):
        try:
            import stripe  # type: ignore

            stripe.api_key = settings.stripe_secret_key
            stripe.Refund.create(charge=p.charge_id, amount=int(amount * 100),
                                 reason=(body.reason if body else None) or None)
        except Exception as e:  # пробрасываем как 502, не роняем 500
            raise HTTPException(502, f"STRIPE_REFUND_FAILED:{e}")

    p.refunded_amount = round(already + amount, 2)
    full = p.refunded_amount >= (p.amount or 0) - 0.001
    if full:
        p.status = "refunded"
    p.updated_at = datetime.utcnow()

    o = p.order
    if o:
        note = (body.reason if body else None) or f"refund {amount} {p.currency}"
        add_event(db, o, "refund", note=note)
        if full and o.payment_status != "refunded":
            o.payment_status = "refunded"
    db.commit()
    if o:
        notify(o)
    return _payment_row_full(p)


# ---------- Купоны (ADM-S-12) ----------

def _coupon_row(c: Coupon) -> dict:
    return {"id": c.id, "userId": c.user_id, "status": c.status,
            "sourceOrderId": c.source_order_id, "usedOrderId": c.used_order_id,
            "usedItemId": c.used_item_id, "discountAmount": c.discount_amount,
            "issuedAt": c.issued_at.isoformat() if c.issued_at else None,
            "usedAt": c.used_at.isoformat() if c.used_at else None}


@router.get("/coupons", dependencies=[Depends(require_super_admin)])
def coupons_registry(response: Response, limit: int | None = PageLimit, offset: int = PageOffset,
                     db: Session = Depends(get_db)):
    rows = [_coupon_row(c) for c in db.scalars(select(Coupon).order_by(Coupon.id.desc())).all()]
    return paginate(rows, response, limit, offset)


@router.post("/coupons/{coupon_id}/void", dependencies=[Depends(require_super_admin)])
def void_coupon(coupon_id: int, db: Session = Depends(get_db)):
    """ADM-S-12 AC4: аннулирование активного купона."""
    c = db.get(Coupon, coupon_id)
    if not c:
        raise HTTPException(404, "NOT_FOUND")
    if c.status != "active":
        raise HTTPException(409, "COUPON_NOT_ACTIVE")
    c.status = "void"
    db.commit()
    return _coupon_row(c)
