"""Выгрузка таблиц в Excel (.xlsx) для владельца: заказы, клиенты, платежи, аудитория, дашборд.

Только super_admin. Роуты делают запросы (переиспользуя сериализаторы/CRM/дашборд) и отдают
готовый .xlsx из export_service. Поддержаны фильтры периода (from/to) и точки (outlet_id).
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..core.security import require_super_admin
from ..models.orders import Coupon, Order, OrderItem, Payment
from ..models.users import User
from ..services import crm, export_service
from ..services.crm_rfm import SEGMENTS
from .admin_customers import _customer_stats
from .dashboard import dashboard
from ._serializers import _addon_map, _drink_map, _order_row, _payment_row_full

router = APIRouter(prefix="/api/admin/exports", tags=["admin-exports"],
                   dependencies=[Depends(require_super_admin)])

_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_MAX_DAILY = 370  # предохранитель от гигантского диапазона при заполнении нулями


def _file(data: bytes, base: str) -> Response:
    stamp = datetime.utcnow().strftime("%Y-%m-%d")
    return Response(
        content=data, media_type=_XLSX,
        headers={"Content-Disposition": f'attachment; filename="{base}-{stamp}.xlsx"'},
    )


@router.get("/orders.xlsx")
def export_orders(outlet_id: int | None = Query(None),
                  date_from: datetime | None = Query(None, alias="from"),
                  date_to: datetime | None = Query(None, alias="to"),
                  db: Session = Depends(get_db)):
    """Все заказы (любой статус оплаты) листами Orders + Items; фильтры период/точка."""
    q = (select(Order)
         .options(selectinload(Order.items).selectinload(OrderItem.addons),
                  selectinload(Order.outlet))
         .order_by(Order.id.desc()))
    if outlet_id is not None:
        q = q.where(Order.outlet_id == outlet_id)
    if date_from:
        q = q.where(Order.created_at >= date_from)
    if date_to:
        q = q.where(Order.created_at <= date_to)
    orders = db.scalars(q).all()
    dm, am = _drink_map(db, orders), _addon_map(db, orders)
    rows = [_order_row(o, dm, am) for o in orders]
    return _file(export_service.build_orders_wb(rows), "orders")


@router.get("/customers.xlsx")
def export_customers(sort: str = Query("registered", description="id|name|orders|spent|registered|lastOrder"),
                     direction: str = Query("desc", alias="dir", description="asc|desc"),
                     q: str | None = Query(None, description="поиск: имя/телефон/авто"),
                     db: Session = Depends(get_db)):
    """Все клиенты + агрегаты по оплаченным заказам (как на странице «Клиенты»).
    ADM-EXP-12: учитывает активные сортировку/поиск списка (раньше игнорировал все фильтры)."""
    agg: dict[int, dict] = {}
    for uid, total, created in db.execute(
        select(Order.user_id, Order.total, Order.created_at).where(Order.payment_status == "paid")
    ).all():
        a = agg.setdefault(uid, {"orders": 0, "spent": 0.0, "last": None})
        a["orders"] += 1
        a["spent"] += (total or 0)
        if created and (a["last"] is None or created > a["last"]):
            a["last"] = created
    rows = []
    for u in db.scalars(select(User)).all():
        a = agg.get(u.id)
        rows.append({
            "id": u.id, "phone": u.phone, "name": u.name, "carPlate": u.car_plate,
            "locale": u.preferred_locale,
            "createdAt": u.created_at.isoformat() if u.created_at else None,
            "orders": a["orders"] if a else 0,
            "spent": round(a["spent"], 2) if a else 0,
            "lastOrderAt": a["last"].isoformat() if a and a["last"] else None,
        })
    if q:
        needle = q.strip().lower()
        rows = [r for r in rows if needle in " ".join(
            str(v).lower() for v in (r["name"], r["phone"], r["carPlate"]) if v)]
    key_fns = {
        "id": lambda r: r["id"], "name": lambda r: (r["name"] or "").lower(),
        "orders": lambda r: r["orders"], "spent": lambda r: r["spent"],
        "registered": lambda r: r["createdAt"] or "", "lastOrder": lambda r: r["lastOrderAt"] or "",
    }
    rows.sort(key=key_fns.get(sort, key_fns["registered"]), reverse=(direction != "asc"))
    return _file(export_service.build_customers_wb(rows), "customers")


@router.get("/payments.xlsx")
def export_payments(status: str | None = Query(None), method: str | None = Query(None),
                    date_from: datetime | None = Query(None, alias="from"),
                    date_to: datetime | None = Query(None, alias="to"),
                    db: Session = Depends(get_db)):
    """Все платежи с контекстом заказа/клиента; фильтры статус/метод/период."""
    q = select(Payment).options(selectinload(Payment.order)).order_by(Payment.id.desc())
    if status:
        q = q.where(Payment.status == status)
    if method:
        q = q.where(Payment.method_type == method)
    if date_from:
        q = q.where(Payment.created_at >= date_from)
    if date_to:
        q = q.where(Payment.created_at <= date_to)
    rows = [_payment_row_full(p) for p in db.scalars(q).all()]
    return _file(export_service.build_payments_wb(rows), "payments")


@router.get("/audience.xlsx")
def export_audience(outlet_id: int | None = Query(None), db: Session = Depends(get_db)):
    """Аудитория: KPI, сегменты, персоны, RFM-сетка + строка на клиента (сегмент/RFM/отток/CLV)."""
    now = datetime.utcnow()
    users = db.scalars(select(User)).all()
    orders_q = select(Order).options(selectinload(Order.items))
    if outlet_id is not None:
        orders_q = orders_q.where(Order.outlet_id == outlet_id)
    orders = db.scalars(orders_q).all()
    coupons = db.scalars(select(Coupon)).all()
    dm, am = _drink_map(db, orders), _addon_map(db, orders)

    orders_by_user: dict[int, list] = {}
    for o in orders:
        orders_by_user.setdefault(o.user_id, []).append(o)
    coupons_by_user: dict[int, list] = {}
    for c in coupons:
        coupons_by_user.setdefault(c.user_id, []).append(c)

    per_user_stats = {u.id: _customer_stats(orders_by_user.get(u.id, []), [],
                                            coupons_by_user.get(u.id, []), dm, am)
                      for u in users}
    audience = crm.build_audience(users, per_user_stats, now)

    # строка на клиента: сегмент + RFM + отток + CLV + персоны (для пивота в Excel)
    thresholds = crm.rfm_thresholds(list(per_user_stats.values()))
    customer_rows = []
    for u in users:
        st = per_user_stats[u.id]
        sc = crm.rfm_scores(st["recencyDays"], st["paidOrders"], st["totalSpent"], thresholds)
        r, f, m = sc["r"], sc["f"], sc["m"]
        seg = crm.rfm_segment(r, f) if st["paidOrders"] >= 1 else "no_purchase"
        churn = crm.churn_metrics(st["recencyDays"], st["avgDaysBetween"], st["ordersPerMonth"])
        clv = crm.clv_metrics(st, churn)
        customer_rows.append({
            "id": u.id, "name": u.name, "phone": u.phone,
            "segmentLabel": SEGMENTS[seg][0], "r": r, "f": f, "m": m, "rfmScore": f"{r}{f}{m}",
            "recencyDays": st["recencyDays"], "paidOrders": st["paidOrders"],
            "totalSpent": st["totalSpent"], "avgOrderValue": st["avgOrderValue"],
            "ordersPerMonth": st["ordersPerMonth"], "churnRisk": churn["risk"],
            "churnProbability": churn["probability"], "clvPredicted": clv["predicted"],
            "personas": crm.persona_tags(st),
        })
    customer_rows.sort(key=lambda c: c["totalSpent"], reverse=True)
    return _file(export_service.build_audience_wb(audience, customer_rows), "audience")


@router.get("/dashboard.xlsx")
def export_dashboard(outlet_id: int | None = Query(None),
                     date_from: datetime | None = Query(None, alias="from"),
                     date_to: datetime | None = Query(None, alias="to"),
                     db: Session = Depends(get_db)):
    """Сводка дашборда за период + метрики ПО ДНЯМ + разбивки (товары/клиенты/размеры/добавки/часы)."""
    summary = dashboard(date_from=date_from, date_to=date_to, outlet_id=outlet_id, db=db)

    # ---- метрики по дням ----
    filters = [Order.payment_status == "paid"]
    if date_from:
        filters.append(Order.created_at >= date_from)
    if date_to:
        filters.append(Order.created_at <= date_to)
    if outlet_id is not None:
        filters.append(Order.outlet_id == outlet_id)

    day_map: dict = {}
    for created, total, qty in db.execute(
        select(Order.created_at, Order.total, func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(OrderItem, OrderItem.order_id == Order.id).where(*filters).group_by(Order.id)
    ).all():
        if not created:
            continue
        b = day_map.setdefault(created.date(), {"orders": 0, "revenue": 0.0, "drinks": 0})
        b["orders"] += 1
        b["revenue"] += total or 0
        b["drinks"] += int(qty or 0)

    # новые клиенты по дню — по дате ПЕРВОГО оплаченного заказа (как KPI newThisMonth)
    new_by_day: dict = {}
    for _uid, first in db.execute(
        select(Order.user_id, func.min(Order.created_at)).where(Order.payment_status == "paid")
        .group_by(Order.user_id)
    ).all():
        if first:
            new_by_day[first.date()] = new_by_day.get(first.date(), 0) + 1

    # диапазон дней: при заданном периоде — заполняем нулями (30-31 строка за месяц), иначе по факту
    if date_from and date_to:
        days, cur, last = [], date_from.date(), date_to.date()
        while cur <= last and len(days) < _MAX_DAILY:
            days.append(cur)
            cur += timedelta(days=1)
    else:
        days = sorted(day_map.keys())

    daily = []
    for d in days:
        b = day_map.get(d, {"orders": 0, "revenue": 0.0, "drinks": 0})
        daily.append({
            "date": d.isoformat(), "orders": b["orders"], "revenue": round(b["revenue"], 2),
            "drinks": b["drinks"],
            "avgOrderValue": round(b["revenue"] / b["orders"], 2) if b["orders"] else 0,
            "newCustomers": new_by_day.get(d, 0),
        })

    period = {"from": date_from.isoformat() if date_from else None,
              "to": date_to.isoformat() if date_to else None,
              "outlet": f"#{outlet_id}" if outlet_id is not None else None}
    return _file(export_service.build_dashboard_wb(summary, daily, period), "dashboard")
