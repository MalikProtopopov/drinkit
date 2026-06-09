"""Админ-роутер локаций (план §5.8/§5.14/§5.15/§5.16).

ОДИН роутер с ПЕР-ЭНДПОИНТНЫМИ гардами (не роутер-уровневый super_admin):
- CRUD точки, пауза, daily/adjust, history — super_admin;
- стоп-лист и location-status — require_manager_or_super + scope «своя точка».
"""
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.errors import Err, http_error
from ..core.security import (get_current_staff, manager_scope_location,
                             require_manager_or_super, require_super_admin)
from ..models.locations import (Location, LocationDailyCounter, LocationDrinkStop,
                                LocationStatusEvent)
from ..models.users import StaffUser
from ..services import location_service as ls

router = APIRouter(prefix="/api/admin/locations", tags=["admin-locations"])


# ----------------------------------------------------------------- сериализация
def _admin_row(db: Session, loc: Location) -> dict:
    sold = ls.sold_today(db, loc)
    return {
        "id": loc.id, "name": loc.name, "description": loc.description,
        "address": loc.address, "coordinates": loc.coordinates,
        "workingHours": loc.working_hours, "timezone": loc.timezone,
        "dailyDrinkLimit": loc.daily_drink_limit,
        "acceptingOrders": loc.accepting_orders,
        "color": loc.color, "imageUrl": loc.image_url,
        "isActive": loc.is_active, "sort": loc.sort,
        "soldToday": sold, "remaining": ls.remaining(loc, sold),
        "status": ls.effective_status(loc), "isOpen": ls.is_open(loc),
    }


def _get_or_404(db: Session, location_id: int) -> Location:
    loc = db.get(Location, location_id)
    if not loc:
        raise http_error(404, Err.LOCATION_NOT_FOUND)
    return loc


def _assert_scope(loc: Location, staff: StaffUser):
    scope = manager_scope_location(staff)
    if scope is not None and loc.id != scope:
        raise http_error(403, Err.FOREIGN_LOCATION)


# ----------------------------------------------------------------- CRUD (super_admin)
class LocationIn(BaseModel):
    name: dict = {}
    description: dict = {}
    address: str | None = None
    coordinates: dict | None = None
    workingHours: dict = {}
    timezone: str = "Asia/Dubai"
    dailyDrinkLimit: int | None = None
    acceptingOrders: bool = True
    color: str | None = None
    imageUrl: str | None = None
    isActive: bool = True
    sort: int = 0


class LocationPatchIn(BaseModel):
    name: dict | None = None
    description: dict | None = None
    address: str | None = None
    coordinates: dict | None = None
    workingHours: dict | None = None
    timezone: str | None = None
    dailyDrinkLimit: int | None = None
    acceptingOrders: bool | None = None
    color: str | None = None
    imageUrl: str | None = None
    isActive: bool | None = None
    sort: int | None = None


@router.get("", dependencies=[Depends(require_super_admin)])
def list_locations(db: Session = Depends(get_db)):
    locs = db.scalars(select(Location).order_by(Location.sort, Location.id)).all()
    return [_admin_row(db, loc) for loc in locs]


@router.post("", dependencies=[Depends(require_super_admin)])
def create_location(body: LocationIn, db: Session = Depends(get_db)):
    loc = Location(
        name=body.name, description=body.description, address=body.address,
        coordinates=body.coordinates, working_hours=body.workingHours, timezone=body.timezone,
        daily_drink_limit=body.dailyDrinkLimit, accepting_orders=body.acceptingOrders,
        color=body.color, image_url=body.imageUrl, is_active=body.isActive, sort=body.sort,
    )
    db.add(loc)
    db.commit()
    return _admin_row(db, loc)


@router.patch("/{location_id}", dependencies=[Depends(require_super_admin)])
def update_location(location_id: int, body: LocationPatchIn, db: Session = Depends(get_db)):
    loc = _get_or_404(db, location_id)
    m = {"name": "name", "description": "description", "address": "address",
         "coordinates": "coordinates", "workingHours": "working_hours", "timezone": "timezone",
         "dailyDrinkLimit": "daily_drink_limit", "acceptingOrders": "accepting_orders",
         "color": "color", "imageUrl": "image_url", "isActive": "is_active", "sort": "sort"}
    # model_fields_set отличает «не передано» от явного null (чтобы можно было снять лимит)
    for field in body.model_fields_set:
        if field in m:
            setattr(loc, m[field], getattr(body, field))
    db.commit()
    return _admin_row(db, loc)


# ----------------------------------------------------------------- пауза (super_admin)
class PauseIn(BaseModel):
    acceptingOrders: bool
    reason: str | None = None


@router.post("/{location_id}/pause")
def pause_location(location_id: int, body: PauseIn,
                   staff: StaffUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    """Операционная пауза/возобновление приёма — ТОЛЬКО super_admin (план §5.14)."""
    loc = _get_or_404(db, location_id)
    if loc.accepting_orders != body.acceptingOrders:  # идемпотентно
        loc.accepting_orders = body.acceptingOrders
        db.add(LocationStatusEvent(
            location_id=loc.id, action=("open" if body.acceptingOrders else "pause"),
            by_staff_id=staff.id, reason=body.reason))
        db.commit()
    return _admin_row(db, loc)


# ----------------------------------------------------------------- daily / adjust / history
@router.get("/{location_id}/daily", dependencies=[Depends(require_super_admin)])
def location_daily(location_id: int, date_: str | None = Query(None, alias="date"),
                   db: Session = Depends(get_db)):
    loc = _get_or_404(db, location_id)
    bdate = date.fromisoformat(date_) if date_ else ls.business_date_for(loc)
    row = db.scalar(select(LocationDailyCounter).where(
        LocationDailyCounter.location_id == loc.id,
        LocationDailyCounter.business_date == bdate))
    sold = row.committed_drinks if row else 0
    return {"date": bdate.isoformat(), "soldDrinks": sold,
            "limit": loc.daily_drink_limit,
            "remaining": (None if loc.daily_drink_limit is None
                          else max(0, loc.daily_drink_limit - sold))}


class AdjustIn(BaseModel):
    date: str | None = None
    setCommitted: int | None = None
    delta: int | None = None


@router.post("/{location_id}/adjust-day", dependencies=[Depends(require_super_admin)])
def adjust_day(location_id: int, body: AdjustIn, db: Session = Depends(get_db)):
    """Ручная корректировка счётчика дня (план §5.8)."""
    loc = _get_or_404(db, location_id)
    bdate = date.fromisoformat(body.date) if body.date else ls.business_date_for(loc)
    row = ls.get_counter_row(db, loc, bdate)
    if body.setCommitted is not None:
        row.committed_drinks = max(0, body.setCommitted)
    elif body.delta is not None:
        row.committed_drinks = max(0, row.committed_drinks + body.delta)
    db.commit()
    return {"date": bdate.isoformat(), "soldDrinks": row.committed_drinks}


@router.get("/{location_id}/history", dependencies=[Depends(require_super_admin)])
def location_history(location_id: int, db: Session = Depends(get_db)):
    loc = _get_or_404(db, location_id)
    events = sorted(loc.status_events, key=lambda e: e.id)
    # длительность паузы вычисляется на чтении (pause → следующий open)
    out = []
    open_stack: dict[int, LocationStatusEvent] = {}
    for e in events:
        row = {"id": e.id, "action": e.action, "drinkId": e.drink_id,
               "byStaffId": e.by_staff_id, "reason": e.reason,
               "at": e.created_at.isoformat() if e.created_at else None,
               "durationMinutes": None}
        out.append(row)
    # вычисляем длительность для pause-событий
    pauses = [r for r in out if r["action"] == "pause"]
    opens = [r for r in out if r["action"] == "open"]
    for p in pauses:
        nxt = next((o for o in opens if o["at"] and p["at"] and o["at"] > p["at"]), None)
        if nxt:
            dur = datetime.fromisoformat(nxt["at"]) - datetime.fromisoformat(p["at"])
            p["durationMinutes"] = round(dur.total_seconds() / 60)
    return out


# ----------------------------------------------------------------- стоп-лист (manager+super)
class StopIn(BaseModel):
    drinkId: int
    reason: str | None = None


@router.get("/{location_id}/stops")
def list_stops(location_id: int, staff: StaffUser = Depends(require_manager_or_super),
               db: Session = Depends(get_db)):
    loc = _get_or_404(db, location_id)
    _assert_scope(loc, staff)
    stops = db.scalars(select(LocationDrinkStop).where(
        LocationDrinkStop.location_id == loc.id)).all()
    return [{"id": s.id, "drinkId": s.drink_id, "reason": s.reason,
             "byStaffId": s.by_staff_id,
             "createdAt": s.created_at.isoformat() if s.created_at else None}
            for s in stops]


@router.post("/{location_id}/stops")
def add_stop(location_id: int, body: StopIn,
             staff: StaffUser = Depends(require_manager_or_super), db: Session = Depends(get_db)):
    """Поставить напиток на стоп в точке (manager своей точки / super_admin), идемпотентно."""
    loc = _get_or_404(db, location_id)
    _assert_scope(loc, staff)
    existing = db.scalar(select(LocationDrinkStop).where(
        LocationDrinkStop.location_id == loc.id, LocationDrinkStop.drink_id == body.drinkId))
    if existing:
        return {"id": existing.id, "drinkId": existing.drink_id, "alreadyStopped": True}
    s = LocationDrinkStop(location_id=loc.id, drink_id=body.drinkId,
                          reason=body.reason, by_staff_id=staff.id)
    db.add(s)
    db.add(LocationStatusEvent(location_id=loc.id, action="drink_stopped",
                               drink_id=body.drinkId, by_staff_id=staff.id, reason=body.reason))
    db.commit()
    return {"id": s.id, "drinkId": s.drink_id, "alreadyStopped": False}


@router.delete("/{location_id}/stops/{drink_id}", status_code=204)
def remove_stop(location_id: int, drink_id: int,
                staff: StaffUser = Depends(require_manager_or_super),
                db: Session = Depends(get_db)):
    """Снять напиток со стопа (идемпотентно)."""
    loc = _get_or_404(db, location_id)
    _assert_scope(loc, staff)
    s = db.scalar(select(LocationDrinkStop).where(
        LocationDrinkStop.location_id == loc.id, LocationDrinkStop.drink_id == drink_id))
    if s:
        db.delete(s)
        db.add(LocationStatusEvent(location_id=loc.id, action="drink_resumed",
                                   drink_id=drink_id, by_staff_id=staff.id))
        db.commit()
    return None


# ----------------------------------------------------------------- панель остатка (manager)
status_router = APIRouter(prefix="/api/admin", tags=["admin-locations"])


@status_router.get("/location-status")
def location_status(location_id: int | None = Query(None),
                    scope: str | None = Query(None, description="super_admin: 'all'"),
                    staff: StaffUser = Depends(get_current_staff),
                    db: Session = Depends(get_db)):
    """Панель остатка/статуса точки на рабочем экране (план §5.16).

    manager → своя точка; super_admin → ?location_id или ?scope=all (агрегат)."""
    mgr_scope = manager_scope_location(staff)

    def row(loc: Location) -> dict:
        sold = ls.sold_today(db, loc)
        nxt = ls.next_open_at(loc) if ls.effective_status(loc) == "closed" else None
        return {"locationId": loc.id, "name": loc.name, "status": ls.effective_status(loc),
                "soldToday": sold, "limit": loc.daily_drink_limit,
                "remaining": ls.remaining(loc, sold), "isOpen": ls.is_open(loc),
                "nextOpenAt": nxt.isoformat() if nxt else None}

    if mgr_scope is not None:  # менеджер — строго своя точка
        loc = db.get(Location, mgr_scope)
        return row(loc) if loc else None
    # super_admin
    if scope == "all":
        locs = db.scalars(select(Location).where(Location.is_active.is_(True))
                          .order_by(Location.sort)).all()
        rows = [row(loc) for loc in locs]
        total_sold = sum(r["soldToday"] for r in rows)
        total_limit = sum(r["limit"] for r in rows if r["limit"] is not None) or None
        return {"scope": "all", "totalSold": total_sold, "totalLimit": total_limit,
                "locations": rows}
    if location_id is not None:
        loc = db.get(Location, location_id)
        return row(loc) if loc else None
    return {"scope": "all", "locations": []}
