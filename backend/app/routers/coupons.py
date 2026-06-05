from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import get_current_user
from ..models.orders import Coupon
from ..models.users import User

router = APIRouter(prefix="/api/coupons", tags=["coupons"])


@router.get("")
def my_coupons(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """PUB-A-04 AC7: купоны видны клиенту (профиль/оформление)."""
    coupons = db.scalars(
        select(Coupon).where(Coupon.user_id == user.id).order_by(Coupon.id.desc())
    ).all()
    return [
        {
            "id": c.id, "status": c.status,
            "issuedAt": c.issued_at.isoformat() if c.issued_at else None,
            "sourceOrderId": c.source_order_id,
            "usedOrderId": c.used_order_id,
            "discountAmount": c.discount_amount,
        }
        for c in coupons
    ]
