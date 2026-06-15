"""Админка: клиенты (ADM-S-08) + аудитория/CRM (RFM, сегменты, persona)."""
from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..core.pagination import PageLimit, PageOffset, paginate
from ..core.security import require_super_admin
from ..models.catalog import Addon, Drink
from ..models.orders import Coupon, Order, OrderEvent, Payment
from ..models.users import StaffUser, User
from ..services import crm
from ..services.i18n import t
from ..services.order_flow import ACTIVE_STATUSES
from ._serializers import _addon_map, _coupon_row, _drink_map, _order_row, _payment_row

router = APIRouter(prefix="/api/admin", tags=["admin-customers"])


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
    return crm.build_audience(users, per_user_stats, now)


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
