"""Публичный экран выдачи (роль «screen»): что Готовится / Готово — для ТВ у стойки.

Это просто читающий эндпоинт + та же realtime-лента, что у админки: экран подписывается на
WebSocket-канал /ws/admin/orders (роль screen — обычный staff, проходит проверку), и на любое
событие перезапрашивает доску. Так табло обновляется мгновенно при оплате/смене статуса.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import get_current_staff
from ..models.orders import Order
from ..models.users import StaffUser

router = APIRouter(prefix="/api/screen", tags=["screen"])

PREPARING = ("new", "in_progress")  # оплачено, в очереди/готовится
SHOWN = ("new", "in_progress", "ready")


def _name(o: Order) -> str:
    if o.customer_name and o.customer_name.strip():
        return o.customer_name.strip()
    if o.phone:
        return "••" + o.phone[-4:]
    return "Guest"


def _row(o: Order) -> dict:
    return {"orderId": o.id, "number": o.number, "name": _name(o)}


@router.get("/board")
def screen_board(_: StaffUser = Depends(get_current_staff), db: Session = Depends(get_db)):
    """Лента выдачи: оплаченные заказы Готово / Готовится, FIFO по номеру."""
    orders = db.scalars(
        select(Order)
        .where(Order.payment_status == "paid", Order.status.in_(SHOWN))
        .order_by(Order.number)
    ).all()
    return {
        "ready": [_row(o) for o in orders if o.status == "ready"],
        "preparing": [_row(o) for o in orders if o.status in PREPARING],
    }
