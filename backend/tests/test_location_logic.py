"""Юнит-тесты доменной логики локаций (план §5.2/§5.5) — ядро инвариантов."""
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.models.locations import Location
from app.services import location_service as ls

DUBAI = ZoneInfo("Asia/Dubai")
WH = {
    "mon": [{"open": "05:30", "close": "22:00"}],
    "tue": [{"open": "05:30", "close": "22:00"}],
    "wed": [{"open": "05:30", "close": "22:00"}],
    "thu": [{"open": "05:30", "close": "22:00"}],
    "fri": [{"open": "05:30", "close": "22:00"}],
    "sat": [{"open": "05:30", "close": "22:00"}],
    "sun": [{"open": "10:00", "close": "18:00"}],
}


def loc(**kw):
    base = dict(is_active=True, accepting_orders=True, timezone="Asia/Dubai",
                working_hours=WH, daily_drink_limit=None)
    base.update(kw)
    location = Location(**base)
    return location


# ---- remaining (лимит в напитках, null = ∞) ----
def test_remaining_with_limit():
    assert ls.remaining(loc(daily_drink_limit=10), sold=7) == 3
    assert ls.remaining(loc(daily_drink_limit=10), sold=10) == 0
    assert ls.remaining(loc(daily_drink_limit=10), sold=11) == 0  # не отрицательное


def test_remaining_no_limit():
    assert ls.remaining(loc(daily_drink_limit=None), sold=999) is None  # безлимит


# ---- is_open = is_active AND accepting_orders AND schedule_open (матрица) ----
@pytest.mark.parametrize("active,accepting,expect_open", [
    (True, True, True),
    (False, True, False),   # выведена из эксплуатации
    (True, False, False),   # операционная пауза
    (False, False, False),
])
def test_is_open_matrix(active, accepting, expect_open):
    # вторник 12:00 — внутри рабочего окна
    now = datetime(2026, 6, 9, 12, 0, tzinfo=DUBAI)  # 2026-06-09 — вторник
    assert ls.is_open(loc(is_active=active, accepting_orders=accepting), now) is expect_open


def test_effective_status():
    now = datetime(2026, 6, 9, 12, 0, tzinfo=DUBAI)
    assert ls.effective_status(loc(), now) == "open"
    assert ls.effective_status(loc(accepting_orders=False), now) == "paused"
    assert ls.effective_status(loc(is_active=False), now) == "inactive"
    night = datetime(2026, 6, 9, 23, 30, tzinfo=DUBAI)  # после 22:00 — закрыто по расписанию
    assert ls.effective_status(loc(), night) == "closed"


# ---- расписание по дням (границы окна) ----
def test_in_schedule_boundaries():
    # вторник 05:29 закрыто, 05:30 открыто, 21:59 открыто, 22:00 закрыто
    assert ls.schedule_open(loc(), datetime(2026, 6, 9, 5, 29, tzinfo=DUBAI)) is False
    assert ls.schedule_open(loc(), datetime(2026, 6, 9, 5, 30, tzinfo=DUBAI)) is True
    assert ls.schedule_open(loc(), datetime(2026, 6, 9, 21, 59, tzinfo=DUBAI)) is True
    assert ls.schedule_open(loc(), datetime(2026, 6, 9, 22, 0, tzinfo=DUBAI)) is False


def test_in_schedule_sunday_different_hours():
    # воскресенье 10:00–18:00; 09:00 закрыто, 11:00 открыто
    assert ls.schedule_open(loc(), datetime(2026, 6, 14, 9, 0, tzinfo=DUBAI)) is False  # вс
    assert ls.schedule_open(loc(), datetime(2026, 6, 14, 11, 0, tzinfo=DUBAI)) is True


def test_in_schedule_day_off():
    wh = dict(WH); wh["mon"] = []  # понедельник выходной
    assert ls.schedule_open(loc(working_hours=wh), datetime(2026, 6, 8, 12, 0, tzinfo=DUBAI)) is False


def test_overnight_window():
    wh = {"fri": [{"open": "22:00", "close": "02:00"}]}
    location = loc(working_hours=wh)
    # пятница 23:00 — открыто (голова окна)
    assert ls.schedule_open(location, datetime(2026, 6, 12, 23, 0, tzinfo=DUBAI)) is True
    # суббота 01:00 — открыто (хвост пятничного окна через полночь)
    assert ls.schedule_open(location, datetime(2026, 6, 13, 1, 0, tzinfo=DUBAI)) is True
    # суббота 03:00 — закрыто
    assert ls.schedule_open(location, datetime(2026, 6, 13, 3, 0, tzinfo=DUBAI)) is False


# ---- TZ-граница торгового дня ----
def test_business_date_tz_boundary():
    # 23:30 по Дубаю и 00:30 следующего дня — РАЗНЫЕ торговые сутки
    d1 = ls.business_date_for(loc(), datetime(2026, 6, 9, 23, 30, tzinfo=DUBAI))
    d2 = ls.business_date_for(loc(), datetime(2026, 6, 10, 0, 30, tzinfo=DUBAI))
    assert d1.day == 9 and d2.day == 10
    # 20:30 UTC = 00:30+04 Дубай → уже новые сутки в TZ локации
    utc_2030 = datetime(2026, 6, 9, 20, 30, tzinfo=ZoneInfo("UTC"))
    assert ls.business_date_for(loc(), utc_2030).day == 10


def test_next_open_at():
    night = datetime(2026, 6, 9, 23, 30, tzinfo=DUBAI)  # вторник ночь
    nxt = ls.next_open_at(loc(), night)
    assert nxt is not None and nxt.hour == 5 and nxt.minute == 30 and nxt.day == 10  # среда 05:30
