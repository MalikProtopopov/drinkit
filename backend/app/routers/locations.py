"""Публичный справочный API локаций (план §5.5/§5.6).

Отдаёт точки с вычисленным статусом, остатком (в напитках), часами и next_open_at —
фронт только рендерит бейджи, логику не дублирует.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.errors import Err, http_error
from ..models.locations import Location
from ..services import location_service as ls
from ..services.i18n import pick_locale, t

router = APIRouter(prefix="/api/locations", tags=["locations"])


def public_payload(db: Session, loc: Location, locale: str) -> dict:
    sold = ls.sold_today(db, loc)
    rem = ls.remaining(loc, sold)
    status = ls.effective_status(loc)
    nxt = ls.next_open_at(loc) if status == "closed" else None
    return {
        "id": loc.id,
        "name": t(loc.name, locale),
        "description": t(loc.description, locale),
        "address": loc.address,
        "coordinates": loc.coordinates,
        "workingHours": loc.working_hours,
        "timezone": loc.timezone,
        "dailyDrinkLimit": loc.daily_drink_limit,
        "soldToday": sold,
        "remaining": rem,                       # None = без лимита
        "isSoldOut": rem == 0,
        "isOpen": ls.is_open(loc),
        "status": status,                       # open | paused | closed | inactive
        "nextOpenAt": nxt.isoformat() if nxt else None,
        "acceptingOrders": loc.accepting_orders,
        "color": loc.color,
        "imageUrl": loc.image_url,
    }


@router.get("")
def list_locations(locale: str = Query("en"), db: Session = Depends(get_db)):
    """Активные точки, отсортированы. Для публичной страницы выбора локации."""
    locale = pick_locale(locale)
    locs = db.scalars(
        select(Location).where(Location.is_active.is_(True)).order_by(Location.sort, Location.id)
    ).all()
    return [public_payload(db, loc, locale) for loc in locs]


@router.get("/{location_id}")
def get_location(location_id: int, locale: str = Query("en"), db: Session = Depends(get_db)):
    locale = pick_locale(locale)
    loc = db.get(Location, location_id)
    if not loc or not loc.is_active:
        raise http_error(404, Err.LOCATION_NOT_FOUND)
    return public_payload(db, loc, locale)
