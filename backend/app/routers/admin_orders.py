"""Админка-заказы (ADM-M-01..06) + клиенты и платежи (ADM-S-08, 09) + купоны (ADM-S-12)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..core.errors import Err, http_error
from ..core.security import (get_current_staff, manager_scope_location,
                             require_super_admin)
from ..models.orders import Coupon, Order, Payment
from ..models.users import StaffUser, User
from ..services.order_flow import ACTIVE_STATUSES, transition

router = APIRouter(prefix="/api/admin", tags=["admin-orders"])


def _assert_scope(o: Order, staff: StaffUser):
    """Менеджер видит/трогает заказы только своей точки (план §5.9). 403 на чужую."""
    scope = manager_scope_location(staff)
    if scope is not None and o.location_id != scope:
        raise http_error(403, Err.FOREIGN_LOCATION)


def _order_row(o: Order) -> dict:
    return {
        "id": o.id, "number": o.number, "status": o.status, "paymentStatus": o.payment_status,
        "locationId": o.location_id,
        "customerName": o.customer_name, "phone": o.phone,
        "carPlate": o.car_plate, "emirate": o.emirate,
        "subtotal": o.subtotal, "couponDiscount": o.coupon_discount, "total": o.total,
        "managerId": o.manager_id, "rating": o.rating,
        "arrived": o.arrived_at is not None,
        "createdAt": o.created_at.isoformat() if o.created_at else None,
        "items": [
            {
                "id": i.id, "name": i.custom_name or i.drink_name, "drinkName": i.drink_name,
                "quantity": i.quantity, "unitPrice": i.unit_price, "paidByCoupon": i.paid_by_coupon,
                # граммовка добавок в каждом напитке (ADM-M-05 AC1)
                "addons": [
                    {"name": a.addon_name, "portions": a.portions, "amount": a.amount, "unit": a.unit_code}
                    for a in i.addons
                ],
            }
            for i in o.items
        ],
    }


@router.get("/orders")
def admin_orders(
    active: bool | None = Query(None, description="фильтр по активности (ADM-M-01 AC2)"),
    manager_id: int | None = Query(None),
    location_id: int | None = Query(None, description="super_admin: фильтр по точке (план §5.9)"),
    unassigned: bool = Query(False, description="заказы без менеджера"),
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
    # скоуп точки: менеджер форсированно ограничен своей; super_admin — по фильтру
    scope = manager_scope_location(staff)
    if scope is not None:
        q = q.where(Order.location_id == scope)
    elif location_id is not None:
        q = q.where(Order.location_id == location_id)
    orders = db.scalars(q.order_by(Order.id.desc())).all()
    return [_order_row(o) for o in orders]


@router.get("/orders/{order_id}")
def admin_order_detail(order_id: int, staff: StaffUser = Depends(get_current_staff),
                       db: Session = Depends(get_db)):
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    _assert_scope(o, staff)
    data = _order_row(o)
    data["events"] = [
        {"type": e.type, "status": e.status, "byStaffId": e.by_staff_id, "byUserId": e.by_user_id,
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
    _assert_scope(o, staff)
    if o.payment_status != "paid":
        raise HTTPException(409, "ORDER_NOT_PAID")
    transition(db, o, "in_progress", by_staff_id=staff.id)
    return _order_row(o)


class StatusIn(BaseModel):
    status: str  # ready | completed
    note: str | None = None


@router.post("/orders/{order_id}/status")
def set_status(order_id: int, body: StatusIn, staff: StaffUser = Depends(get_current_staff),
               db: Session = Depends(get_db)):
    """ADM-M-03: готов к выдаче / передан клиенту."""
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    _assert_scope(o, staff)
    if body.status not in ("ready", "completed"):
        raise HTTPException(422, "VALIDATION_ERROR")
    transition(db, o, body.status, by_staff_id=staff.id, note=body.note)
    return _order_row(o)


@router.post("/orders/{order_id}/refund")
def refund_order(order_id: int, body: StatusIn | None = None,
                 staff: StaffUser = Depends(get_current_staff), db: Session = Depends(get_db)):
    """ADM-M-06 (опциональный модуль): возврат. Через единый order_flow.refund_order —
    возвращает напитки в дневной лимит точки того же дня (план §5.4)."""
    from ..services.order_flow import refund_order as flow_refund
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    _assert_scope(o, staff)
    flow_refund(db, o, by_staff_id=staff.id, note=(body.note if body else None))
    return _order_row(o)


# ---------- Клиенты (ADM-S-08) ----------

@router.get("/customers", dependencies=[Depends(require_super_admin)])
def customers(db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id.desc())).all()
    return [
        {"id": u.id, "phone": u.phone, "name": u.name, "carPlate": u.car_plate,
         "locale": u.preferred_locale,
         "createdAt": u.created_at.isoformat() if u.created_at else None}
        for u in users
    ]


@router.get("/customers/{user_id}", dependencies=[Depends(require_super_admin)])
def customer_detail(user_id: int, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "NOT_FOUND")
    orders = db.scalars(select(Order).options(selectinload(Order.items))
                        .where(Order.user_id == u.id).order_by(Order.id.desc())).all()
    payments = db.scalars(select(Payment).join(Order).where(Order.user_id == u.id)).all()
    coupons = db.scalars(select(Coupon).where(Coupon.user_id == u.id)).all()
    return {
        "id": u.id, "phone": u.phone, "name": u.name, "carPlate": u.car_plate,
        "emirate": u.emirate, "locale": u.preferred_locale,
        "orders": [_order_row(o) for o in orders],
        "payments": [_payment_row(p) for p in payments],
        "coupons": [_coupon_row(c) for c in coupons],
    }


class CustomerIn(BaseModel):
    name: str | None = None
    carPlate: str | None = None
    emirate: str | None = None


@router.patch("/customers/{user_id}", dependencies=[Depends(require_super_admin)])
def update_customer(user_id: int, body: CustomerIn, db: Session = Depends(get_db)):
    """ADM-S-08/PUB-A-06 AC3: редактирование личных данных из админки."""
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "NOT_FOUND")
    if body.name is not None:
        u.name = body.name
    if body.carPlate is not None:
        u.car_plate = body.carPlate.upper()
    if body.emirate is not None:
        u.emirate = body.emirate
    db.commit()
    return {"ok": True}


# ---------- Платежи (ADM-S-09) ----------

def _payment_row(p: Payment) -> dict:
    return {"id": p.id, "orderId": p.order_id, "amount": p.amount, "currency": p.currency,
            "provider": p.provider, "providerId": p.provider_id, "status": p.status,
            "createdAt": p.created_at.isoformat() if p.created_at else None}


@router.get("/payments", dependencies=[Depends(require_super_admin)])
def payments_list(db: Session = Depends(get_db)):
    rows = db.scalars(select(Payment).options(selectinload(Payment.order))
                      .order_by(Payment.id.desc())).all()
    out = []
    for p in rows:
        row = _payment_row(p)
        row["orderNumber"] = p.order.number
        row["customerPhone"] = p.order.phone
        row["userId"] = p.order.user_id
        out.append(row)
    return out


# ---------- Купоны (ADM-S-12) ----------

def _coupon_row(c: Coupon) -> dict:
    return {"id": c.id, "userId": c.user_id, "status": c.status,
            "sourceOrderId": c.source_order_id, "usedOrderId": c.used_order_id,
            "usedItemId": c.used_item_id, "discountAmount": c.discount_amount,
            "issuedAt": c.issued_at.isoformat() if c.issued_at else None,
            "usedAt": c.used_at.isoformat() if c.used_at else None}


@router.get("/coupons", dependencies=[Depends(require_super_admin)])
def coupons_registry(db: Session = Depends(get_db)):
    return [_coupon_row(c) for c in db.scalars(select(Coupon).order_by(Coupon.id.desc())).all()]


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
