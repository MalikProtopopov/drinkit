"""Доменная логика локаций GRABZI (план §5.2/§5.5/§5.15).

Чистые функции (без БД, где возможно) — ядро инвариантов, покрывается юнит-тестами:
- business_date_for(loc, now): торговый день в TZ локации
- in_schedule(now, working_hours, tz): попадает ли момент в окно работы дня (вкл. через полночь)
- is_open(loc, now): is_active AND accepting_orders AND in_schedule
- effective_status(loc, now): open | paused | closed | inactive (вычисляется, не хранится)
- next_open_at(loc, now): ближайшее открытие по расписанию

+ функции с БД для лимита/стопа/остатка.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.locations import (Location, LocationDailyCounter, LocationDrinkStop)

_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _tz(loc: Location) -> ZoneInfo:
    try:
        return ZoneInfo(loc.timezone or "Asia/Dubai")
    except Exception:  # noqa: BLE001 — неизвестная TZ → дефолт
        return ZoneInfo("Asia/Dubai")


def local_now(loc: Location, now: datetime | None = None) -> datetime:
    """Текущее (или заданное) время в TZ локации."""
    if now is None:
        now = datetime.now(_tz(loc))
    elif now.tzinfo is None:
        now = now.replace(tzinfo=_tz(loc))
    return now.astimezone(_tz(loc))


def business_date_for(loc: Location, now: datetime | None = None) -> date:
    """Торговый день в TZ локации (граница суток локальная, не UTC)."""
    return local_now(loc, now).date()


def _parse_hm(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def in_schedule(now: datetime, working_hours: dict, tz: ZoneInfo) -> bool:
    """Открыта ли точка по расписанию в момент `now` (в её TZ).

    working_hours: {"mon":[{"open":"05:30","close":"22:00"}], ..., "sun":[]}
    Пустой массив дня = выходной. Поддержка окна через полночь (close < open):
    интервал учитывает и «хвост» предыдущего дня.
    """
    if not working_hours:
        return False
    local = now.astimezone(tz)
    today_key = _DAYS[local.weekday()]
    cur = local.time()

    for iv in working_hours.get(today_key, []) or []:
        o, c = _parse_hm(iv["open"]), _parse_hm(iv["close"])
        if o <= c:
            if o <= cur < c:
                return True
        else:  # окно через полночь, напр. 22:00–02:00 — «голова» сегодня
            if cur >= o:
                return True
    # «хвост» окна, начавшегося вчера и идущего через полночь
    yest_key = _DAYS[(local.weekday() - 1) % 7]
    for iv in working_hours.get(yest_key, []) or []:
        o, c = _parse_hm(iv["open"]), _parse_hm(iv["close"])
        if o > c and cur < c:
            return True
    return False


def schedule_open(loc: Location, now: datetime | None = None) -> bool:
    return in_schedule(local_now(loc, now), loc.working_hours or {}, _tz(loc))


def is_open(loc: Location, now: datetime | None = None) -> bool:
    """Итоговая доступность точки для заказа (план §5.5)."""
    return bool(loc.is_active) and bool(loc.accepting_orders) and schedule_open(loc, now)


def effective_status(loc: Location, now: datetime | None = None) -> str:
    """Вычисляемый презентационный статус (не хранится в БД)."""
    if not loc.is_active:
        return "inactive"
    if not loc.accepting_orders:
        return "paused"
    if not schedule_open(loc, now):
        return "closed"
    return "open"


def next_open_at(loc: Location, now: datetime | None = None) -> datetime | None:
    """Ближайший момент открытия по расписанию (для copy «opens HH:MM»). Ищем 14 дней вперёд."""
    wh = loc.working_hours or {}
    if not wh:
        return None
    tz = _tz(loc)
    cur = local_now(loc, now)
    for day_offset in range(0, 14):
        d = cur.date() + timedelta(days=day_offset)
        key = _DAYS[d.weekday()]
        for iv in sorted(wh.get(key, []) or [], key=lambda x: x["open"]):
            o = _parse_hm(iv["open"])
            cand = datetime.combine(d, o, tzinfo=tz)
            if cand > cur:
                return cand
    return None


# ---------------------------------------------------------------- лимит / остаток
def get_counter_row(db: Session, loc: Location, bdate: date,
                    for_update: bool = False) -> LocationDailyCounter:
    """Строка счётчика дня; создаёт с 0, если нет. for_update — пессимистическая блокировка."""
    stmt = select(LocationDailyCounter).where(
        LocationDailyCounter.location_id == loc.id,
        LocationDailyCounter.business_date == bdate,
    )
    if for_update:
        stmt = stmt.with_for_update()
    row = db.scalar(stmt)
    if row is None:
        row = LocationDailyCounter(location_id=loc.id, business_date=bdate, committed_drinks=0)
        db.add(row)
        db.flush()
    return row


def sold_today(db: Session, loc: Location, now: datetime | None = None) -> int:
    row = db.scalar(select(LocationDailyCounter).where(
        LocationDailyCounter.location_id == loc.id,
        LocationDailyCounter.business_date == business_date_for(loc, now),
    ))
    return row.committed_drinks if row else 0


def remaining(loc: Location, sold: int) -> int | None:
    """Остаток напитков на сегодня. None = без лимита (Р5.1)."""
    if loc.daily_drink_limit is None:
        return None
    return max(0, loc.daily_drink_limit - sold)


def stopped_drink_ids(db: Session, location_id: int | None) -> set[int]:
    """ID напитков в стоп-листе локации (план §5.15). Пусто, если локация не задана."""
    if location_id is None:
        return set()
    return set(db.scalars(
        select(LocationDrinkStop.drink_id).where(LocationDrinkStop.location_id == location_id)
    ).all())
