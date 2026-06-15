"""Публичные эндпоинты локаций (REQ-5/6). Минимум для публичного сайта JOOZ:
адрес + рабочие часы под лого и рантайм-статус (openNow) для гейта оформления заказа.
Без авторизации, как catalog.py. Статус считается на сервере (в TZ точки) — фронт не парсит строки.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models.outlet import Outlet
from ..services.i18n import pick_locale, t
from ..services.outlet_service import runtime_status, today_intervals

router = APIRouter(prefix="/api", tags=["outlets"])


def _public_payload(db: Session, o: Outlet, locale: str) -> dict:
    status = runtime_status(db, o)
    return {
        "id": o.id, "slug": o.slug, "name": t(o.name, locale),
        "address": o.address, "emirate": o.emirate, "phone": o.phone,
        "lat": o.lat, "lng": o.lng, "timezone": o.timezone,
        "status": status, "openNow": status == "open",
        "acceptingOrders": o.accepting_orders,
        "todayHours": today_intervals(o), "hours": o.hours or {},
    }


@router.get("/outlets")
def list_outlets(locale: str = Query("ru"), db: Session = Depends(get_db)):
    locale = pick_locale(locale)
    outlets = db.scalars(
        select(Outlet).where(Outlet.is_active.is_(True)).order_by(Outlet.sort, Outlet.id)
    ).all()
    return [_public_payload(db, o, locale) for o in outlets]


@router.get("/outlets/{outlet_id}")
def get_outlet(outlet_id: int, locale: str = Query("ru"), db: Session = Depends(get_db)):
    locale = pick_locale(locale)
    o = db.get(Outlet, outlet_id)
    if not o or not o.is_active:
        raise HTTPException(404, "NOT_FOUND")
    return _public_payload(db, o, locale)
