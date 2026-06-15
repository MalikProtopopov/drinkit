"""Админка: купоны (ADM-S-12) — реестр и аннулирование."""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.pagination import PageLimit, PageOffset, paginate
from ..core.security import require_super_admin
from ..models.orders import Coupon
from ._serializers import _coupon_row

router = APIRouter(prefix="/api/admin", tags=["admin-coupons"])


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
