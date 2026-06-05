"""Дашборд супер-админа (ADM-S-10): 9 метрик с фильтром по периоду."""
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import require_super_admin
from ..models.orders import Order, OrderItem
from ..models.users import User

router = APIRouter(prefix="/api/admin/dashboard", tags=["dashboard"],
                   dependencies=[Depends(require_super_admin)])


@router.get("")
def dashboard(
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    paid = [Order.payment_status == "paid"]
    if date_from:
        paid.append(Order.created_at >= date_from)
    if date_to:
        paid.append(Order.created_at <= date_to)

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

    # 8. top revenue by product (≥20 позиций)
    top = db.execute(
        select(OrderItem.drink_name,
               func.sum(OrderItem.unit_price * OrderItem.quantity).label("rev"),
               func.sum(OrderItem.quantity).label("qty"))
        .join(Order).where(*paid)
        .group_by(OrderItem.drink_name).order_by(func.sum(OrderItem.unit_price * OrderItem.quantity).desc())
        .limit(20)
    ).all()

    # 9. сортировка клиентов по числу заказов и суммам
    top_customers = db.execute(
        select(User.id, User.phone, User.name,
               func.count(Order.id).label("orders"),
               func.coalesce(func.sum(Order.total), 0).label("spent"),
               func.max(Order.created_at).label("last_order"))
        .join(Order, Order.user_id == User.id).where(*paid)
        .group_by(User.id).order_by(func.count(Order.id).desc())
    ).all()

    return {
        "revenue": round(revenue, 2),                                   # 1
        "ordersCount": orders_count,                                    # 2
        "drinksSold": int(drinks_count),                                # 3
        "avgDrinksPerOrder": round(drinks_count / orders_count, 2) if orders_count else 0,  # 4
        "avgOrderValue": round(revenue / orders_count, 2) if orders_count else 0,           # 5
        "ordersByHour": by_hour,                                        # 7
        "topProducts": [
            {"name": r.drink_name, "revenue": round(r.rev, 2), "qty": int(r.qty)} for r in top
        ],                                                              # 8
        "topCustomers": [
            {"userId": r.id, "phone": r.phone, "name": r.name, "orders": r.orders,
             "spent": round(r.spent, 2),
             "lastOrderAt": r.last_order.isoformat() if r.last_order else None}
            for r in top_customers
        ],                                                              # 6 + 9
    }
