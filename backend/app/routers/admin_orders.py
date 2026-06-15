"""Админка-заказы (ADM-M-01..06)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..core.pagination import PageLimit, PageOffset, paginate
from ..core.security import (get_current_staff, get_staff_outlet_ids, require_manager_or_admin)
from ..models.orders import Order
from ..models.users import StaffUser
from ..services.order_flow import ACTIVE_STATUSES, add_event, transition
from ._serializers import _addon_map, _drink_map, _order_row

router = APIRouter(prefix="/api/admin", tags=["admin-orders"])


def _scoped_or_404(o: Order, staff: StaffUser, db: Session) -> None:
    """REQ-7: manager/screen видят только заказы своих точек; чужие → 404 (не 403)."""
    scope = get_staff_outlet_ids(staff, db)
    if scope is not None and o.outlet_id not in scope:
        raise HTTPException(404, "NOT_FOUND")


@router.get("/orders")
def admin_orders(
    response: Response,
    active: bool | None = Query(None, description="фильтр по активности (ADM-M-01 AC2)"),
    manager_id: int | None = Query(None),
    outlet_id: int | None = Query(None, description="фильтр по точке (только super_admin)"),
    unassigned: bool = Query(False, description="заказы без менеджера"),
    limit: int | None = PageLimit,
    offset: int = PageOffset,
    staff: StaffUser = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    q = (select(Order).options(selectinload(Order.items), selectinload(Order.outlet))
         .where(Order.payment_status == "paid"))
    # REQ-7: manager/screen жёстко скоупятся по своим точкам; super_admin видит всё или фильтрует
    scope = get_staff_outlet_ids(staff, db)
    if scope is not None:
        q = q.where(Order.outlet_id.in_(scope))
    elif outlet_id is not None:
        q = q.where(Order.outlet_id == outlet_id)
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
    _scoped_or_404(o, staff, db)
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
def take_order(order_id: int, staff: StaffUser = Depends(require_manager_or_admin),
               db: Session = Depends(get_db)):
    """ADM-M-02: «Взять в работу» — статус + закрепление менеджера + история."""
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    _scoped_or_404(o, staff, db)
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
def set_status(order_id: int, body: StatusIn, staff: StaffUser = Depends(require_manager_or_admin),
               db: Session = Depends(get_db)):
    """ADM-M-03: готов к выдаче / передан клиенту."""
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    _scoped_or_404(o, staff, db)
    if body.status not in ("ready", "completed"):
        raise HTTPException(422, "VALIDATION_ERROR")
    transition(db, o, body.status, by_staff_id=staff.id, note=body.note)
    return _order_row(o)


@router.post("/orders/{order_id}/refund")
def refund_order(order_id: int, body: RefundIn | None = None,
                 staff: StaffUser = Depends(require_manager_or_admin), db: Session = Depends(get_db)):
    """ADM-M-06 (опциональный модуль): возврат. Полный возврат заказа;
    DECISION: Stripe Refund вызывается при наличии ключа, в mock-режиме помечается локально.
    Применённый купон аннулируется не возвращаясь (открытый вопрос Q18 — зафиксировано так)."""
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    _scoped_or_404(o, staff, db)
    transition(db, o, "refund", by_staff_id=staff.id, note=(body.note if body else None))
    o.payment_status = "refunded"
    for p in o.payments:
        if p.status == "succeeded":
            p.status = "refunded"
    add_event(db, o, "refund", by_staff_id=staff.id)
    db.commit()
    return _order_row(o)
