"""Дашборд супер-админа (ADM-S-10): метрики с фильтром по периоду + бизнес-аналитика
(дельты к прошлому периоду, пиковые часы, размеры, время обслуживания, добавки/аффинити)."""
from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..core.security import require_super_admin
from ..models.catalog import Drink
from ..models.orders import Order, OrderEvent, OrderItem
from ..models.users import User
from ..services.i18n import t

router = APIRouter(prefix="/api/admin/dashboard", tags=["dashboard"],
                   dependencies=[Depends(require_super_admin)])


@router.get("")
def dashboard(
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    outlet_id: int | None = Query(None, description="фильтр по точке (пусто = все точки)"),
    db: Session = Depends(get_db),
):
    paid = [Order.payment_status == "paid"]
    if date_from:
        paid.append(Order.created_at >= date_from)
    if date_to:
        paid.append(Order.created_at <= date_to)
    if outlet_id is not None:
        paid.append(Order.outlet_id == outlet_id)

    revenue = db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(*paid)) or 0
    orders_count = db.scalar(select(func.count(Order.id)).where(*paid)) or 0
    drinks_count = db.scalar(
        select(func.coalesce(func.sum(OrderItem.quantity), 0)).join(Order).where(*paid)
    ) or 0

    # 7. время заказов — почасовое распределение для графика пиков
    hours_rows = db.execute(
        select(Order.created_at).where(*paid)
    ).scalars().all()
    by_hour: dict[int, int] = {h: 0 for h in range(24)}
    for created in hours_rows:
        if created:
            by_hour[created.hour] += 1

    # 8. top revenue by product — группируем по НАПИТКУ (drink_id), а не по снэпшот-
    #    названию: иначе один напиток в разных локалях даёт разные строки. Имя берём
    #    актуальное из каталога (en), снэпшот — фолбэк для удалённых напитков.
    top = db.execute(
        select(OrderItem.drink_id,
               func.max(OrderItem.drink_name).label("snap"),
               func.sum(OrderItem.unit_price * OrderItem.quantity).label("rev"),
               func.sum(OrderItem.quantity).label("qty"))
        .join(Order).where(*paid)
        .group_by(OrderItem.drink_id)
        .order_by(func.sum(OrderItem.unit_price * OrderItem.quantity).desc())
        .limit(20)
    ).all()
    drink_ids = [r.drink_id for r in top]
    drinks_by_id = {d.id: d for d in db.scalars(
        select(Drink).where(Drink.id.in_(drink_ids)))} if drink_ids else {}

    # 9. сортировка клиентов по числу заказов и суммам
    top_customers = db.execute(
        select(User.id, User.phone, User.name,
               func.count(Order.id).label("orders"),
               func.coalesce(func.sum(Order.total), 0).label("spent"),
               func.max(Order.created_at).label("last_order"))
        .join(Order, Order.user_id == User.id).where(*paid)
        .group_by(User.id).order_by(func.count(Order.id).desc())
    ).all()

    # ---- дельты к прошлому периоду равной длины (только если задан from) ----
    deltas = None
    if date_from:
        span = (date_to or datetime.utcnow()) - date_from
        prev = [Order.payment_status == "paid",
                Order.created_at >= date_from - span, Order.created_at < date_from]
        if outlet_id is not None:
            prev.append(Order.outlet_id == outlet_id)
        p_rev = db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(*prev)) or 0
        p_ord = db.scalar(select(func.count(Order.id)).where(*prev)) or 0
        p_drinks = db.scalar(
            select(func.coalesce(func.sum(OrderItem.quantity), 0)).join(Order).where(*prev)) or 0

        def _pct(cur, base):
            return round((cur - base) / base * 100, 1) if base else None
        deltas = {
            "revenue": _pct(revenue, p_rev),
            "ordersCount": _pct(orders_count, p_ord),
            "drinksSold": _pct(drinks_count, p_drinks),
            "avgOrderValue": _pct(revenue / orders_count if orders_count else 0,
                                  p_rev / p_ord if p_ord else 0),
        }

    # ---- загрузка оплаченных заказов периода со снэпшотами для бизнес-аналитики ----
    paid_orders = db.scalars(
        select(Order).options(selectinload(Order.items).selectinload(OrderItem.addons)).where(*paid)
    ).all()

    weekday_hour = [[0] * 24 for _ in range(7)]   # матрица день×час (как в карточке клиента)
    size_counter: Counter = Counter()
    addon_servings: Counter = Counter()
    pair_counter: Counter = Counter()             # пары добавок в одном напитке (market basket)
    item_count = addon_picks = 0
    for o in paid_orders:
        if o.created_at:
            weekday_hour[o.created_at.weekday()][o.created_at.hour] += 1
        for it in o.items:
            item_count += 1
            size_counter[it.size_label or "—"] += it.quantity
            names = sorted({a.addon_name for a in it.addons})
            addon_picks += len(names)
            for a in it.addons:
                addon_servings[a.addon_name] += a.portions * it.quantity
            for x in range(len(names)):
                for y in range(x + 1, len(names)):
                    pair_counter[(names[x], names[y])] += 1
    size_total = sum(size_counter.values())
    size_mix = [{"size": s, "qty": q, "share": round(q / size_total, 4) if size_total else 0}
                for s, q in size_counter.most_common()]
    top_addons = [{"name": n, "qty": q} for n, q in addon_servings.most_common(8)]
    affinity = [{"a": a, "b": b, "count": c} for (a, b), c in pair_counter.most_common(8)]
    avg_addons = round(addon_picks / item_count, 2) if item_count else 0

    # ---- время обслуживания: paid→ready (готовка), ready→completed (выдача), paid→completed ----
    done_ids = [o.id for o in paid_orders if o.status == "completed"]
    prep, pickup, full = [], [], []
    if done_ids:
        ev_by_order: dict[int, list] = {}
        for e in db.scalars(select(OrderEvent).where(OrderEvent.order_id.in_(done_ids))):
            ev_by_order.setdefault(e.order_id, []).append(e)

        def _mins(a, b):
            return (b - a).total_seconds() / 60 if a and b and b >= a else None
        for elist in ev_by_order.values():
            paid_at = ready_at = done_at = None
            for e in elist:
                if e.type == "paid" and paid_at is None:
                    paid_at = e.created_at
                elif e.type == "status_change" and e.status == "ready" and ready_at is None:
                    ready_at = e.created_at
                elif e.type == "status_change" and e.status == "completed" and done_at is None:
                    done_at = e.created_at
            for bucket, val in ((prep, _mins(paid_at, ready_at)), (pickup, _mins(ready_at, done_at)),
                                (full, _mins(paid_at, done_at))):
                if val is not None:
                    bucket.append(val)

    def _avg(xs):
        return round(sum(xs) / len(xs), 1) if xs else None
    service_time = {"prepMin": _avg(prep), "pickupMin": _avg(pickup), "totalMin": _avg(full),
                    "samples": max(len(prep), len(pickup), len(full))}

    return {
        "deltas": deltas,                                               # дельты к прошлому периоду
        "weekdayHourMatrix": weekday_hour,                              # пиковые дни×часы (heatmap)
        "sizeMix": size_mix,                                            # распределение размеров
        "serviceTime": service_time,                                   # время готовки/выдачи
        "topAddons": top_addons,                                       # популярные добавки
        "affinity": affinity,                                          # пары добавок (вместе в напитке)
        "avgAddons": avg_addons,                                       # ср. число добавок на напиток
        "revenue": round(revenue, 2),                                   # 1
        "ordersCount": orders_count,                                    # 2
        "drinksSold": int(drinks_count),                                # 3
        "avgDrinksPerOrder": round(drinks_count / orders_count, 2) if orders_count else 0,  # 4
        "avgOrderValue": round(revenue / orders_count, 2) if orders_count else 0,           # 5
        "ordersByHour": by_hour,                                        # 7
        "topProducts": [
            {"name": t(drinks_by_id[r.drink_id].name, "en") if r.drink_id in drinks_by_id else r.snap,
             "slug": drinks_by_id[r.drink_id].slug if r.drink_id in drinks_by_id else None,
             "revenue": round(r.rev, 2), "qty": int(r.qty)}
            for r in top
        ],                                                              # 8
        "topCustomers": [
            {"userId": r.id, "phone": r.phone, "name": r.name, "orders": r.orders,
             "spent": round(r.spent, 2),
             "lastOrderAt": r.last_order.isoformat() if r.last_order else None}
            for r in top_customers
        ],                                                              # 6 + 9
    }
