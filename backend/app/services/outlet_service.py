"""Логика локаций: рантайм-статус, резолв точки заказа, дневной счётчик (paid-only),
валидатор рабочих часов, стоп-сеты и аудит-события. Чистый слой без FastAPI-роутов.

Статус-машина (REQ-5):
  inactive  — выключена супер-админом (is_active=False);
  closed    — вне рабочих часов;
  paused    — в рабочих часах, но ручная пауза (accepting_orders=False) ИЛИ достигнут дневной лимит;
  open      — принимает заказы (только в этом статусе можно создать заказ).

Дневной лимит (REQ-4, paid-only): авторитетно считается ВЖИВУЮ как сумма quantity оплаченных
заказов за локальный календарный день точки. Поэтому «пауза по лимиту» сама снимается на новый
день (счётчик обнуляется) — флаг outlet.auto_paused лишь денормализованная подсказка для UI/аудита.
"""
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models.orders import Order, OrderItem
from ..models.outlet import Outlet, OutletEvent, OutletStopItem, StaffOutlet

_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_DEFAULT_TZ = "Asia/Dubai"


def _zone(outlet: Outlet) -> ZoneInfo:
    try:
        return ZoneInfo(outlet.timezone or _DEFAULT_TZ)
    except Exception:
        return ZoneInfo(_DEFAULT_TZ)


def _now_utc(now_utc: datetime | None) -> datetime:
    now_utc = now_utc or datetime.now(timezone.utc)
    return now_utc.replace(tzinfo=timezone.utc) if now_utc.tzinfo is None else now_utc


# ---------------- рабочие часы ----------------

def today_intervals(outlet: Outlet, local: datetime | None = None) -> list[dict]:
    """Интервалы сегодняшнего дня в локальном времени точки ([] = выходной/нет ключа → закрыто)."""
    if local is None:
        local = _now_utc(None).astimezone(_zone(outlet))
    hours = outlet.hours or {}
    return hours.get(str(local.weekday()), []) or []


def _within_hours(outlet: Outlet, local: datetime) -> bool:
    hhmm = local.strftime("%H:%M")  # лексикографическое сравнение валидно для нуль-падденных HH:MM
    return any(iv.get("open", "") <= hhmm < iv.get("close", "") for iv in today_intervals(outlet, local))


def validate_hours(hours) -> dict:
    """Нормализует и валидирует JSON рабочих часов. 422 OUTLET_HOURS_INVALID при кривом вводе.
    Ключи '0'..'6' (0=пн), значения — списки {open,close} 'HH:MM', close>open, без пересечений,
    без перехода через полночь (на старте не поддерживаем)."""
    if hours in (None, ""):
        return {}
    if not isinstance(hours, dict):
        raise HTTPException(422, "OUTLET_HOURS_INVALID")
    clean: dict[str, list] = {}
    for k in (str(i) for i in range(7)):
        intervals = hours.get(k) or []
        if not isinstance(intervals, list):
            raise HTTPException(422, "OUTLET_HOURS_INVALID")
        norm, prev_close = [], None
        for iv in sorted(intervals, key=lambda x: (x or {}).get("open", "")):
            if not isinstance(iv, dict):
                raise HTTPException(422, "OUTLET_HOURS_INVALID")
            o, c = iv.get("open"), iv.get("close")
            # close == "24:00" — допустимый «конец суток» (круглосуточный режим 00:00–24:00)
            if not (_HHMM.match(o or "") and (c == "24:00" or _HHMM.match(c or ""))):
                raise HTTPException(422, "OUTLET_HOURS_INVALID")
            if c <= o:  # строковое сравнение корректно: "24:00" > любого "HH:MM"
                raise HTTPException(422, "OUTLET_HOURS_INVALID")
            if prev_close is not None and o < prev_close:
                raise HTTPException(422, "OUTLET_HOURS_INVALID")
            prev_close = c
            norm.append({"open": o, "close": c})
        clean[k] = norm
    return clean


# ---------------- дневной счётчик (paid-only) ----------------

def local_day_window_utc(outlet: Outlet, now_utc: datetime | None = None) -> tuple[datetime, datetime]:
    """[начало, конец) сегодняшнего локального дня точки в наивном UTC (как Order.created_at)."""
    local = _now_utc(now_utc).astimezone(_zone(outlet))
    start_local = local.replace(hour=0, minute=0, second=0, microsecond=0)
    end_local = start_local + timedelta(days=1)
    def to_naive_utc(d: datetime) -> datetime:
        return d.astimezone(timezone.utc).replace(tzinfo=None)
    return to_naive_utc(start_local), to_naive_utc(end_local)


def drinks_processed_today(db: Session, outlet: Outlet, now_utc: datetime | None = None) -> int:
    """Сумма quantity ОПЛАЧЕННЫХ заказов точки за сегодняшний локальный день (REQ-4, paid-only)."""
    if outlet.id is None:
        return 0
    start, end = local_day_window_utc(outlet, now_utc)
    total = db.scalar(
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.outlet_id == outlet.id, Order.payment_status == "paid",
               Order.created_at >= start, Order.created_at < end)
    )
    return int(total or 0)


def drinks_processed_today_bulk(db: Session, outlets, now_utc: datetime | None = None) -> dict[int, int]:
    """Дневной счётчик (paid-only) сразу для многих точек — без N+1 в списках.
    Точки группируем по их локальному окну дня (как правило одна tz) и берём по
    одному агрегирующему запросу на окно вместо запроса на каждую точку."""
    by_window: dict[tuple[datetime, datetime], list[int]] = {}
    counts: dict[int, int] = {}
    for o in outlets:
        if o.id is None:
            continue
        counts[o.id] = 0
        by_window.setdefault(local_day_window_utc(o, now_utc), []).append(o.id)
    for (start, end), ids in by_window.items():
        for oid, total in db.execute(
            select(Order.outlet_id, func.coalesce(func.sum(OrderItem.quantity), 0))
            .join(OrderItem, OrderItem.order_id == Order.id)
            .where(Order.outlet_id.in_(ids), Order.payment_status == "paid",
                   Order.created_at >= start, Order.created_at < end)
            .group_by(Order.outlet_id)
        ).all():
            counts[oid] = int(total or 0)
    return counts


def limit_reached(db: Session, outlet: Outlet, now_utc: datetime | None = None,
                  drinks_today: int | None = None) -> bool:
    if outlet.daily_drink_limit is None:
        return False
    n = drinks_today if drinks_today is not None else drinks_processed_today(db, outlet, now_utc)
    return n >= outlet.daily_drink_limit


# ---------------- статус ----------------

def outlet_status(outlet: Outlet, now_utc: datetime | None = None) -> str:
    """Базовый статус без учёта лимита (без обращения к БД).
    Пустые hours ({}) = расписание не задано = без ограничения по времени (как NULL-лимит)."""
    if not outlet.is_active:
        return "inactive"
    local = _now_utc(now_utc).astimezone(_zone(outlet))
    if outlet.hours and not _within_hours(outlet, local):
        return "closed"
    if not outlet.accepting_orders:
        return "paused"
    return "open"


def runtime_status(db: Session, outlet: Outlet, now_utc: datetime | None = None) -> str:
    """Авторитетный статус: базовый + учёт дневного лимита (paid-only, вживую)."""
    return status_detail(db, outlet, now_utc)["status"]


def _to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def _next_open_utc(outlet: Outlet, now_utc: datetime | None = None) -> datetime | None:
    """Ближайшее время открытия (aware UTC) по расписанию; None если расписание не задано."""
    hours = outlet.hours or {}
    if not hours:
        return None
    local = _now_utc(now_utc).astimezone(_zone(outlet))
    for offset in range(0, 8):
        day = local + timedelta(days=offset)
        for iv in sorted(today_intervals(outlet, day), key=lambda x: x.get("open", "")):
            o = iv.get("open", "")
            if not _HHMM.match(o):
                continue
            cand = day.replace(hour=int(o[:2]), minute=int(o[3:5]), second=0, microsecond=0)
            if cand > local:
                return cand.astimezone(timezone.utc)
    return None


def _current_close_utc(outlet: Outlet, now_utc: datetime | None = None) -> datetime | None:
    """Время закрытия текущего интервала сегодня (aware UTC); None если 24/7 или вне часов."""
    if not (outlet.hours or {}):
        return None
    local = _now_utc(now_utc).astimezone(_zone(outlet))
    hhmm = local.strftime("%H:%M")
    for iv in today_intervals(outlet, local):
        if iv.get("open", "") <= hhmm < iv.get("close", ""):
            c = iv.get("close", "")
            if c == "24:00" or not _HHMM.match(c):
                return None
            return local.replace(hour=int(c[:2]), minute=int(c[3:5]),
                                 second=0, microsecond=0).astimezone(timezone.utc)
    return None


def status_detail(db: Session, outlet: Outlet, now_utc: datetime | None = None,
                  drinks_today: int | None = None) -> dict:
    """Полное состояние точки: статус + ПРИЧИНА + сопутствующее время (для понятного баннера).
    statusReason: inactive | closed | paused_manual | paused_limit | open.
    drinks_today — предвычисленный дневной счётчик (списки точек передают его, чтобы не было N+1)."""
    status = outlet_status(outlet, now_utc)  # inactive/closed/paused(manual)/open (без лимита)
    out = {"status": status, "statusReason": status,
           "opensAt": None, "closesAt": None, "resetsAt": None}
    if status == "closed":
        out["opensAt"] = _to_iso(_next_open_utc(outlet, now_utc))
    elif status == "paused":
        out["statusReason"] = "paused_manual"
    elif status == "open":
        if limit_reached(db, outlet, now_utc, drinks_today):
            out["status"] = "paused"
            out["statusReason"] = "paused_limit"
            _, end = local_day_window_utc(outlet, now_utc)  # сброс счётчика в локальную полночь
            out["resetsAt"] = _to_iso(end)
        else:
            out["closesAt"] = _to_iso(_current_close_utc(outlet, now_utc))
    return out


# ---------------- резолв точки заказа (REQ-6) ----------------

def resolve_outlet(db: Session, outlet_id: int | None = None) -> Outlet:
    """Одна активная точка → она (игнорируя вход). Несколько → требуем валидный outlet_id.
    Нет активных → 409."""
    active = db.scalars(select(Outlet).where(Outlet.is_active.is_(True)).order_by(Outlet.id)).all()
    if not active:
        raise HTTPException(409, "OUTLET_INVALID")
    if len(active) == 1:
        return active[0]
    if outlet_id is None:
        raise HTTPException(422, "OUTLET_REQUIRED")
    chosen = next((o for o in active if o.id == outlet_id), None)
    if chosen is None:
        raise HTTPException(409, "OUTLET_INVALID")
    return chosen


def active_outlet_count(db: Session) -> int:
    return int(db.scalar(select(func.count()).select_from(Outlet).where(Outlet.is_active.is_(True))) or 0)


# ---------------- стоп-лист ----------------

def load_stop_sets(db: Session, outlet_id: int | None) -> dict[str, set[int]]:
    """Один запрос → множества застопленных id по типам (членство проверяем в Python)."""
    sets = {"drink": set(), "drink_category": set(), "addon": set()}
    if outlet_id is None:
        return sets
    for row in db.scalars(select(OutletStopItem).where(OutletStopItem.outlet_id == outlet_id)):
        if row.entity_type in sets:
            sets[row.entity_type].add(row.entity_id)
    return sets


# ---------------- аудит ----------------

def add_outlet_event(db: Session, outlet: Outlet, type_: str, by_staff_id: int | None = None,
                     note: str | None = None, meta: dict | None = None) -> None:
    db.add(OutletEvent(outlet_id=outlet.id, type=type_, by_staff_id=by_staff_id,
                       note=note, meta=meta or {}))


def set_staff_outlets(db: Session, staff, outlet_ids, by_staff_id: int | None = None) -> None:
    """Полная замена привязок сотрудника к точкам (REQ-2/7) с инвариантами:
    super_admin → 0 (без скоупа); manager → ≥1; screen → ровно 1. Пустой список для
    manager/screen при ЕДИНСТВЕННОЙ активной точке → авто-привязка к ней (как resolve_outlet)."""
    ids = list(dict.fromkeys(int(x) for x in (outlet_ids or [])))
    if staff.role == "super_admin":
        ids = []
    else:
        if not ids:
            active = db.scalars(select(Outlet.id).where(Outlet.is_active.is_(True))
                                .order_by(Outlet.id)).all()
            if len(active) == 1:
                ids = [active[0]]
            else:
                raise HTTPException(422, "OUTLET_REQUIRED")
        if staff.role == "screen" and len(ids) != 1:
            raise HTTPException(422, "OUTLET_SCOPE_INVALID")
    if ids:
        found = set(db.scalars(select(Outlet.id).where(Outlet.id.in_(ids))).all())
        if found != set(ids):
            raise HTTPException(422, "OUTLET_INVALID")

    existing = {l.outlet_id: l for l in db.scalars(
        select(StaffOutlet).where(StaffOutlet.staff_id == staff.id))}
    for oid, link in existing.items():
        if oid not in ids:
            db.delete(link)
    for i, oid in enumerate(ids):
        if oid not in existing:
            db.add(StaffOutlet(staff_id=staff.id, outlet_id=oid, is_primary=(i == 0)))
    db.flush()


def refresh_limit_pause(db: Session, outlet: Outlet, now_utc: datetime | None = None) -> bool:
    """Синхронизирует денормализованный флаг auto_paused с живым счётчиком (для UI/аудита).
    Вызывается из mark_paid. Возвращает True, если флаг изменился (нужен commit/notify)."""
    if outlet.daily_drink_limit is None:
        if outlet.auto_paused:
            outlet.auto_paused = False
            return True
        return False
    count = drinks_processed_today(db, outlet, now_utc)
    reached = count >= outlet.daily_drink_limit
    if reached and not outlet.auto_paused:
        outlet.auto_paused = True
        add_outlet_event(db, outlet, "limit_reached", note=f"{count}/{outlet.daily_drink_limit}",
                         meta={"counted": count, "limit": outlet.daily_drink_limit})
        return True
    if not reached and outlet.auto_paused:
        outlet.auto_paused = False
        add_outlet_event(db, outlet, "resumed",
                         meta={"counted": count, "limit": outlet.daily_drink_limit})
        return True
    return False
