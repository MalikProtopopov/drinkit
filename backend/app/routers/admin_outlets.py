"""Админка локаций (REQ-1..5/7) — только super_admin.

CRUD точек, активация/деактивация, рабочие часы, дневной лимит, стоп-лист и приоритеты напитков
в рамках точки, привязка сотрудников, аудит событий. Списки — голый массив + X-Total-Count.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.pagination import PageLimit, PageOffset, paginate
from ..core.security import require_super_admin
from ..models.catalog import Addon, Drink, DrinkCategory
from ..models.outlet import (Outlet, OutletDrinkPriority, OutletEvent, OutletStopItem, StaffOutlet)
from ..models.users import StaffUser
from ..services.migrate import slugify
from ..services.outlet_service import (active_outlet_count, add_outlet_event,
                                       drinks_processed_today, drinks_processed_today_bulk,
                                       load_stop_sets, set_staff_outlets,
                                       status_detail, validate_hours)

router = APIRouter(prefix="/api/admin/outlets", tags=["admin-outlets"])

_STOP_TYPES = ("drink", "drink_category", "addon")


def _iso(d):
    return d.isoformat() if d else None


def _managers(db: Session, outlet_id: int) -> list[dict]:
    links = db.scalars(select(StaffOutlet).where(StaffOutlet.outlet_id == outlet_id)).all()
    if not links:
        return []
    staff = {s.id: s for s in db.scalars(
        select(StaffUser).where(StaffUser.id.in_([l.staff_id for l in links])))}
    out = []
    for l in links:
        s = staff.get(l.staff_id)
        if s:
            out.append({"id": s.id, "name": s.name, "email": s.email, "role": s.role,
                        "isPrimary": l.is_primary, "disabled": s.disabled})
    return out


def _row(db: Session, o: Outlet, with_managers: bool = False,
         drinks_today: int | None = None) -> dict:
    today = drinks_today if drinks_today is not None else drinks_processed_today(db, o)
    detail = status_detail(db, o, drinks_today=today)  # статус + причина + время открытия/закрытия/сброса
    data = {
        "id": o.id, "slug": o.slug, "name": o.name or {},
        "isActive": o.is_active, "acceptingOrders": o.accepting_orders, "autoPaused": o.auto_paused,
        "address": o.address, "emirate": o.emirate, "phone": o.phone, "email": o.email,
        "lat": o.lat, "lng": o.lng, "timezone": o.timezone, "hours": o.hours or {},
        "dailyDrinkLimit": o.daily_drink_limit, "sort": o.sort,
        "status": detail["status"], "statusReason": detail["statusReason"],
        "opensAt": detail["opensAt"], "closesAt": detail["closesAt"], "resetsAt": detail["resetsAt"],
        "drinksToday": today,
        "limitRemaining": (None if o.daily_drink_limit is None
                           else max(0, o.daily_drink_limit - today)),
        "createdAt": _iso(o.created_at), "updatedAt": _iso(o.updated_at),
    }
    if with_managers:
        data["managers"] = _managers(db, o.id)
    return data


def _get(db: Session, outlet_id: int) -> Outlet:
    o = db.get(Outlet, outlet_id)
    if not o:
        raise HTTPException(404, "NOT_FOUND")
    return o


def _unique_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
    base = base or "outlet"
    slug, n = base, 2
    while True:
        clash = db.scalar(select(Outlet).where(Outlet.slug == slug))
        if clash is None or clash.id == exclude_id:
            return slug
        slug = f"{base}-{n}"; n += 1


# ---------------- CRUD ----------------

class OutletIn(BaseModel):
    name: dict
    slug: str | None = None
    address: str | None = None
    emirate: str | None = None
    phone: str | None = None
    email: str | None = None
    lat: float | None = None
    lng: float | None = None
    timezone: str = "Asia/Dubai"
    hours: dict | None = None
    dailyDrinkLimit: int | None = None
    sort: int = 0
    isActive: bool = True
    acceptingOrders: bool = True


class OutletPatch(BaseModel):
    name: dict | None = None
    address: str | None = None
    emirate: str | None = None
    phone: str | None = None
    email: str | None = None
    lat: float | None = None
    lng: float | None = None
    timezone: str | None = None
    hours: dict | None = None
    dailyDrinkLimit: int | None = None
    sort: int | None = None
    acceptingOrders: bool | None = None


@router.get("")
def list_outlets(response: Response, active: bool | None = Query(None),
                 limit: int | None = PageLimit, offset: int = PageOffset,
                 _: StaffUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    q = select(Outlet).order_by(Outlet.sort, Outlet.id)
    if active is not None:
        q = q.where(Outlet.is_active.is_(active))
    outlets = db.scalars(q).all()
    counts = drinks_processed_today_bulk(db, outlets)  # один запрос на все точки (без N+1)
    rows = [_row(db, o, drinks_today=counts.get(o.id, 0)) for o in outlets]
    return paginate(rows, response, limit, offset)


@router.post("", status_code=201)
def create_outlet(body: OutletIn, force: bool = Query(False),
                  staff: StaffUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    hours = validate_hours(body.hours)
    base = (body.slug or slugify((body.name or {}).get("ru") or (body.name or {}).get("en") or "")
            or "outlet")
    # D4: пока на паблике нет переключателя точек, не активируем 2-ю автоматически —
    # точку создаём неактивной (админ активирует явно через ?force=true).
    make_active = body.isActive and (active_outlet_count(db) == 0 or force)
    o = Outlet(slug=_unique_slug(db, base), name=body.name, address=body.address,
               emirate=body.emirate, phone=body.phone, email=body.email, lat=body.lat,
               lng=body.lng, timezone=body.timezone or "Asia/Dubai", hours=hours,
               daily_drink_limit=body.dailyDrinkLimit, sort=body.sort,
               is_active=make_active, accepting_orders=body.acceptingOrders)
    db.add(o)
    db.flush()
    add_outlet_event(db, o, "activated" if o.is_active else "deactivated", by_staff_id=staff.id,
                     note="created")
    db.commit()
    return _row(db, o, with_managers=True)


@router.get("/{outlet_id}")
def get_outlet(outlet_id: int, _: StaffUser = Depends(require_super_admin),
               db: Session = Depends(get_db)):
    return _row(db, _get(db, outlet_id), with_managers=True)


@router.patch("/{outlet_id}")
def patch_outlet(outlet_id: int, body: OutletPatch, staff: StaffUser = Depends(require_super_admin),
                 db: Session = Depends(get_db)):
    o = _get(db, outlet_id)
    if body.name is not None:
        o.name = body.name
    for attr in ("address", "emirate", "phone", "email", "lat", "lng"):
        val = getattr(body, attr)
        if val is not None:
            setattr(o, attr, val)
    if body.timezone is not None:
        o.timezone = body.timezone
    if body.sort is not None:
        o.sort = body.sort
    if body.hours is not None:
        old = o.hours or {}
        o.hours = validate_hours(body.hours)
        add_outlet_event(db, o, "hours_changed", by_staff_id=staff.id,
                         meta={"old": old, "new": o.hours})
    if body.dailyDrinkLimit is not None or "dailyDrinkLimit" in body.model_fields_set:
        if o.daily_drink_limit != body.dailyDrinkLimit:
            add_outlet_event(db, o, "limit_changed", by_staff_id=staff.id,
                             meta={"old": o.daily_drink_limit, "new": body.dailyDrinkLimit})
            o.daily_drink_limit = body.dailyDrinkLimit
    if body.acceptingOrders is not None and body.acceptingOrders != o.accepting_orders:
        o.accepting_orders = body.acceptingOrders
        add_outlet_event(db, o, "resumed" if o.accepting_orders else "paused", by_staff_id=staff.id)
    o.updated_at = datetime.utcnow()
    db.commit()
    return _row(db, o, with_managers=True)


@router.post("/{outlet_id}/activate")
def activate_outlet(outlet_id: int, force: bool = Query(False),
                    staff: StaffUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    o = _get(db, outlet_id)
    if not o.is_active:
        # D4: на публичном сайте нет переключателя точек → держим одну активную, пока не введён
        # пикер. Активировать 2-ю активную можно только force=true (бэкенд это поддерживает).
        if active_outlet_count(db) >= 1 and not force:
            raise HTTPException(409, "MULTIPLE_ACTIVE_NOT_SUPPORTED")
        o.is_active = True
        o.updated_at = datetime.utcnow()
        add_outlet_event(db, o, "activated", by_staff_id=staff.id)
        db.commit()
    return _row(db, o, with_managers=True)


@router.post("/{outlet_id}/deactivate")
def deactivate_outlet(outlet_id: int, staff: StaffUser = Depends(require_super_admin),
                      db: Session = Depends(get_db)):
    o = _get(db, outlet_id)
    if o.is_active:
        if active_outlet_count(db) <= 1:
            raise HTTPException(409, "LAST_ACTIVE_OUTLET")  # нельзя оставить публичный сайт без точки
        o.is_active = False
        o.updated_at = datetime.utcnow()
        add_outlet_event(db, o, "deactivated", by_staff_id=staff.id)
        db.commit()
    return _row(db, o, with_managers=True)


# ---------------- аудит ----------------

@router.get("/{outlet_id}/events")
def outlet_events(outlet_id: int, response: Response, limit: int | None = PageLimit,
                  offset: int = PageOffset, _: StaffUser = Depends(require_super_admin),
                  db: Session = Depends(get_db)):
    _get(db, outlet_id)
    rows = db.scalars(select(OutletEvent).where(OutletEvent.outlet_id == outlet_id)
                      .order_by(OutletEvent.id.desc())).all()
    staff_ids = {e.by_staff_id for e in rows if e.by_staff_id}
    names = {s.id: s.name for s in db.scalars(
        select(StaffUser).where(StaffUser.id.in_(staff_ids)))} if staff_ids else {}
    data = [{"id": e.id, "type": e.type, "byStaffId": e.by_staff_id,
             "byStaffName": names.get(e.by_staff_id), "note": e.note,
             "meta": e.meta or {}, "at": _iso(e.created_at)} for e in rows]
    return paginate(data, response, limit, offset)


# ---------------- стоп-лист (REQ-3) ----------------

def _validate_entities(db: Session, entity_type: str, ids: list[int]) -> None:
    if not ids:
        return
    model = {"drink": Drink, "drink_category": DrinkCategory, "addon": Addon}[entity_type]
    found = set(db.scalars(select(model.id).where(model.id.in_(ids))).all())
    if found != set(ids):
        raise HTTPException(422, "ENTITY_NOT_FOUND")


@router.get("/{outlet_id}/stop-list")
def get_stop_list(outlet_id: int, _: StaffUser = Depends(require_super_admin),
                  db: Session = Depends(get_db)):
    _get(db, outlet_id)
    s = load_stop_sets(db, outlet_id)
    return {"drinks": sorted(s["drink"]), "categories": sorted(s["drink_category"]),
            "addons": sorted(s["addon"])}


class StopListIn(BaseModel):
    drinks: list[int] = []
    categories: list[int] = []
    addons: list[int] = []


@router.put("/{outlet_id}/stop-list")
def set_stop_list(outlet_id: int, body: StopListIn, staff: StaffUser = Depends(require_super_admin),
                  db: Session = Depends(get_db)):
    o = _get(db, outlet_id)
    _validate_entities(db, "drink", body.drinks)
    _validate_entities(db, "drink_category", body.categories)
    _validate_entities(db, "addon", body.addons)
    old = load_stop_sets(db, outlet_id)
    new = {"drink": set(body.drinks), "drink_category": set(body.categories), "addon": set(body.addons)}
    # полная замена
    db.query(OutletStopItem).filter(OutletStopItem.outlet_id == outlet_id).delete()
    for et in _STOP_TYPES:
        for eid in new[et]:
            db.add(OutletStopItem(outlet_id=outlet_id, entity_type=et, entity_id=eid,
                                  created_by_staff_id=staff.id))
    added = {et: sorted(new[et] - old[et]) for et in _STOP_TYPES}
    removed = {et: sorted(old[et] - new[et]) for et in _STOP_TYPES}
    if any(added.values()):
        add_outlet_event(db, o, "stop_added", by_staff_id=staff.id, meta=added)
    if any(removed.values()):
        add_outlet_event(db, o, "stop_removed", by_staff_id=staff.id, meta=removed)
    db.commit()
    s = load_stop_sets(db, outlet_id)
    return {"drinks": sorted(s["drink"]), "categories": sorted(s["drink_category"]),
            "addons": sorted(s["addon"])}


class ToggleIn(BaseModel):
    entityType: str
    entityId: int


@router.post("/{outlet_id}/stop-list/toggle")
def toggle_stop(outlet_id: int, body: ToggleIn, staff: StaffUser = Depends(require_super_admin),
                db: Session = Depends(get_db)):
    o = _get(db, outlet_id)
    if body.entityType not in _STOP_TYPES:
        raise HTTPException(422, "VALIDATION_ERROR")
    _validate_entities(db, body.entityType, [body.entityId])
    existing = db.scalar(select(OutletStopItem).where(
        OutletStopItem.outlet_id == outlet_id, OutletStopItem.entity_type == body.entityType,
        OutletStopItem.entity_id == body.entityId))
    if existing:
        db.delete(existing)
        add_outlet_event(db, o, "stop_removed", by_staff_id=staff.id,
                         meta={body.entityType: [body.entityId]})
        stopped = False
    else:
        db.add(OutletStopItem(outlet_id=outlet_id, entity_type=body.entityType,
                              entity_id=body.entityId, created_by_staff_id=staff.id))
        add_outlet_event(db, o, "stop_added", by_staff_id=staff.id,
                         meta={body.entityType: [body.entityId]})
        stopped = True
    db.commit()
    return {"stopped": stopped}


# ---------------- приоритеты напитков (REQ-3) ----------------

@router.get("/{outlet_id}/drink-priorities")
def get_priorities(outlet_id: int, _: StaffUser = Depends(require_super_admin),
                   db: Session = Depends(get_db)):
    _get(db, outlet_id)
    rows = db.scalars(select(OutletDrinkPriority)
                      .where(OutletDrinkPriority.outlet_id == outlet_id)
                      .order_by(OutletDrinkPriority.sort, OutletDrinkPriority.id)).all()
    return [{"drinkId": r.drink_id, "sort": r.sort, "pinned": r.pinned} for r in rows]


class PriorityRow(BaseModel):
    drinkId: int
    sort: int | None = None
    pinned: bool = False


@router.put("/{outlet_id}/drink-priorities")
def set_priorities(outlet_id: int, body: list[PriorityRow],
                   _: StaffUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    _get(db, outlet_id)
    ids = [r.drinkId for r in body]
    _validate_entities(db, "drink", ids)
    db.query(OutletDrinkPriority).filter(OutletDrinkPriority.outlet_id == outlet_id).delete()
    for i, r in enumerate(body):
        db.add(OutletDrinkPriority(outlet_id=outlet_id, drink_id=r.drinkId,
                                   sort=r.sort if r.sort is not None else i, pinned=r.pinned))
    db.commit()
    return get_priorities(outlet_id, _, db)


# ---------------- привязка сотрудников (REQ-2) ----------------

class AttachIn(BaseModel):
    staffId: int
    isPrimary: bool = False


@router.post("/{outlet_id}/staff")
def attach_staff(outlet_id: int, body: AttachIn, actor: StaffUser = Depends(require_super_admin),
                 db: Session = Depends(get_db)):
    o = _get(db, outlet_id)
    s = db.get(StaffUser, body.staffId)
    if not s:
        raise HTTPException(404, "NOT_FOUND")
    if s.role == "super_admin":
        raise HTTPException(422, "OUTLET_SCOPE_INVALID")  # super_admin не скоупится
    current = set(db.scalars(select(StaffOutlet.outlet_id)
                             .where(StaffOutlet.staff_id == s.id)).all())
    new_ids = ([outlet_id] if s.role == "screen" else sorted(current | {outlet_id}))
    set_staff_outlets(db, s, new_ids, by_staff_id=actor.id)
    add_outlet_event(db, o, "staff_attached", by_staff_id=actor.id, meta={"staffId": s.id})
    db.commit()
    return _row(db, o, with_managers=True)


@router.delete("/{outlet_id}/staff/{staff_id}")
def detach_staff(outlet_id: int, staff_id: int, actor: StaffUser = Depends(require_super_admin),
                 db: Session = Depends(get_db)):
    o = _get(db, outlet_id)
    s = db.get(StaffUser, staff_id)
    if not s:
        raise HTTPException(404, "NOT_FOUND")
    current = set(db.scalars(select(StaffOutlet.outlet_id)
                             .where(StaffOutlet.staff_id == s.id)).all())
    new_ids = sorted(current - {outlet_id})
    if s.role in ("manager", "screen") and not new_ids:
        raise HTTPException(409, "STAFF_NEEDS_OUTLET")  # нельзя оставить без точки
    set_staff_outlets(db, s, new_ids, by_staff_id=actor.id)
    add_outlet_event(db, o, "staff_detached", by_staff_id=actor.id, meta={"staffId": s.id})
    db.commit()
    return _row(db, o, with_managers=True)
