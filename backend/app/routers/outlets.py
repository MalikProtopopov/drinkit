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
from ..services.outlet_service import (drinks_processed_today, drinks_processed_today_bulk,
                                       status_detail, today_intervals)

router = APIRouter(prefix="/api", tags=["outlets"])


def _public_payload(db: Session, o: Outlet, locale: str, drinks_today: int | None = None) -> dict:
    # статус + причина + время открытия (в TZ точки); дневной счётчик paid-only (REQ-4)
    detail = status_detail(db, o, drinks_today=drinks_today)
    today = drinks_today if drinks_today is not None else drinks_processed_today(db, o)
    remaining = None if o.daily_drink_limit is None else max(0, o.daily_drink_limit - today)
    status = detail["status"]
    return {
        "id": o.id, "slug": o.slug, "name": t(o.name, locale), "description": "",
        "address": o.address, "emirate": o.emirate, "phone": o.phone,
        "lat": o.lat, "lng": o.lng, "timezone": o.timezone,
        "status": status, "openNow": status == "open", "isOpen": status == "open",
        "acceptingOrders": o.accepting_orders,
        "todayHours": today_intervals(o), "hours": o.hours or {}, "workingHours": o.hours or {},
        # счётчик «напитков сегодня» для витрины (TODAY'S LIMIT / остаток по точке, REQ-4)
        "dailyDrinkLimit": o.daily_drink_limit, "soldToday": today, "remaining": remaining,
        "isSoldOut": remaining == 0,
        "nextOpenAt": detail["opensAt"],
        "color": None, "imageUrl": None,
    }


@router.get("/outlets")
def list_outlets(locale: str = Query("ru"), db: Session = Depends(get_db)):
    locale = pick_locale(locale)
    outlets = db.scalars(
        select(Outlet).where(Outlet.is_active.is_(True)).order_by(Outlet.sort, Outlet.id)
    ).all()
    counts = drinks_processed_today_bulk(db, outlets)  # один запрос на все точки (без N+1)
    return [_public_payload(db, o, locale, drinks_today=counts.get(o.id, 0)) for o in outlets]


@router.get("/outlets/{outlet_id}")
def get_outlet(outlet_id: int, locale: str = Query("ru"), db: Session = Depends(get_db)):
    locale = pick_locale(locale)
    o = db.get(Outlet, outlet_id)
    if not o or not o.is_active:
        raise HTTPException(404, "NOT_FOUND")
    return _public_payload(db, o, locale)
