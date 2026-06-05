from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.config import settings
from ..core.db import get_db
from ..core.security import get_current_user
from ..models.orders import Coupon, Order
from ..models.users import User
from ..services.order_flow import add_event, create_order, transition

router = APIRouter(prefix="/api/orders", tags=["orders"])


class SelIn(BaseModel):
    addonId: int
    portions: int = 1


class ItemIn(BaseModel):
    drinkId: int
    quantity: int = 1
    customName: str | None = None
    addons: list[SelIn] = []


class OrderIn(BaseModel):
    items: list[ItemIn]
    customerName: str | None = None
    carPlate: str | None = None
    emirate: str | None = None
    couponId: int | None = None
    couponItemIndex: int | None = None  # какой напиток списывает купон — выбор клиента (PUB-A-05)


def order_payload(o: Order, full: bool = True) -> dict:
    data = {
        "id": o.id, "number": o.number, "status": o.status, "paymentStatus": o.payment_status,
        "subtotal": o.subtotal, "couponDiscount": o.coupon_discount, "total": o.total,
        "createdAt": o.created_at.isoformat() if o.created_at else None,
        "rating": o.rating,
        "items": [
            {
                "id": i.id, "drinkId": i.drink_id, "name": i.custom_name or i.drink_name,
                "drinkName": i.drink_name, "unitPrice": i.unit_price, "quantity": i.quantity,
                "paidByCoupon": i.paid_by_coupon,
                "addons": [
                    {"name": a.addon_name, "portions": a.portions,
                     "amount": a.amount, "unit": a.unit_code, "price": a.price_per_portion}
                    for a in i.addons
                ],
            }
            for i in o.items
        ],
    }
    if full:
        data.update({
            "customerName": o.customer_name, "phone": o.phone,
            "carPlate": o.car_plate, "emirate": o.emirate,
            # история смен статусов с датой/временем (PUB-A-07 AC4)
            "events": [
                {"type": e.type, "status": e.status, "at": e.created_at.isoformat() if e.created_at else None}
                for e in o.events
            ],
        })
    return data


@router.post("")
def place_order(body: OrderIn, locale: str = Query("ru"),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = create_order(db, user, body, locale)
    return order_payload(order)


@router.get("")
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """PUB-A-07: список заказов клиента."""
    orders = db.scalars(
        select(Order).options(selectinload(Order.items))
        .where(Order.user_id == user.id).order_by(Order.id.desc())
    ).all()
    return [order_payload(o, full=False) for o in orders]


def _own_order(order_id: int, user: User, db: Session) -> Order:
    o = db.get(Order, order_id)
    if not o or o.user_id != user.id:
        raise HTTPException(404, "NOT_FOUND")
    return o


@router.get("/{order_id}")
def order_detail(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = _own_order(order_id, user, db)
    data = order_payload(o)
    # PUB-A-04 AC1: флаг «пора показать модалку оценки» — приехал, не завершён > N минут
    data["ratingPromptDue"] = bool(
        o.rating is None and o.arrived_at is not None and o.status == "arrived"
        and datetime.utcnow() - o.arrived_at > timedelta(minutes=settings.rating_timeout_minutes)
    )
    return data


@router.post("/{order_id}/arrived")
def mark_arrived(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """PUB-A-03 AC2: «Прибыл, готов забрать» — только после ready (валидируется переходом)."""
    o = _own_order(order_id, user, db)
    transition(db, o, "arrived", by_user_id=user.id)
    return order_payload(o)


class RateIn(BaseModel):
    rating: str  # like | dislike


@router.post("/{order_id}/rate")
def rate_order(order_id: int, body: RateIn,
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """PUB-A-04: оценка 👍/👎, не более одной; дизлайк выдаёт купон (1 на заказ)."""
    if body.rating not in ("like", "dislike"):
        raise HTTPException(422, "VALIDATION_ERROR")
    o = _own_order(order_id, user, db)
    if o.rating is not None:
        raise HTTPException(409, "ALREADY_RATED")
    if o.status not in ("arrived", "completed"):
        raise HTTPException(409, "ORDER_NOT_RATABLE")
    o.rating = body.rating
    o.rated_at = datetime.utcnow()
    add_event(db, o, "rated", by_user_id=user.id, note=body.rating)

    coupon_id = None
    if body.rating == "dislike":
        coupon = Coupon(user_id=user.id, source_order_id=o.id)
        db.add(coupon)
        db.flush()
        coupon_id = coupon.id
    db.commit()
    return {"ok": True, "couponIssued": coupon_id is not None, "couponId": coupon_id}
