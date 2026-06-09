"""Интеграционные тесты заказа с привязкой к локации: лимит/стоп/часы/пауза/refund.

Логика корректности на SQLite (single-thread). Тест ГОНКИ лимита — отдельно на Postgres
(testcontainers), т.к. SQLite игнорирует SELECT FOR UPDATE.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.core.db import SessionLocal
from app.models.locations import Location, LocationDailyCounter, LocationDrinkStop

DUBAI = ZoneInfo("Asia/Dubai")


def _open_hours():
    """Окно работы, гарантированно покрывающее текущий момент (±2 часа сегодня)."""
    now = datetime.now(DUBAI)
    days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    key = days[now.weekday()]
    lo = (now - timedelta(hours=2)).strftime("%H:%M")
    hi = (now + timedelta(hours=2)).strftime("%H:%M")
    return {d: ([{"open": lo, "close": hi}] if d == key else []) for d in days}


def _closed_hours():
    return {d: [] for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}


def make_location(**kw):
    base = dict(name={"en": "Test Spot"}, address="Dubai", working_hours=_open_hours(),
                timezone="Asia/Dubai", daily_drink_limit=None, accepting_orders=True,
                is_active=True)
    base.update(kw)
    with SessionLocal() as db:
        loc = Location(**base)
        db.add(loc)
        db.commit()
        return loc.id


def drink_ids(client):
    return (client.get("/api/drinks/orange-fresh").json()["id"],
            client.get("/api/drinks/immunity-shot").json()["id"])


def place(client, customer, location_id, qty=1):
    d1, _ = drink_ids(client)
    body = {"items": [{"drinkId": d1, "quantity": qty}],
            "locationId": location_id, "carPlate": "A 11111", "emirate": "Dubai"}
    return client.post("/api/orders", json=body, headers=customer["headers"])


def pay(client, customer, order_id):
    return client.post("/api/payments/checkout-session", json={"orderId": order_id},
                       headers=customer["headers"])


def counter(location_id):
    with SessionLocal() as db:
        row = db.query(LocationDailyCounter).filter_by(location_id=location_id).first()
        return row.committed_drinks if row else 0


# ---- happy path: заказ списывает лимит в напитках только после оплаты ----
def test_order_decrements_limit_in_drinks(client, customer):
    loc = make_location(daily_drink_limit=10)
    r = place(client, customer, loc, qty=3)
    assert r.status_code == 200, r.text
    assert counter(loc) == 0          # до оплаты лимит не тронут (заказ скрыт)
    oid = r.json()["id"]
    assert pay(client, customer, oid).status_code == 200
    assert counter(loc) == 3          # списано РОВНО кол-во напитков (не 1 заказ)


# ---- лимит исчерпан → отклоняем на предпроверке ----
def test_sold_out_precheck(client, customer):
    loc = make_location(daily_drink_limit=2)
    r = place(client, customer, loc, qty=2)
    assert pay(client, customer, r.json()["id"]).status_code == 200
    # точка распродана на сегодня
    r2 = place(client, customer, loc, qty=1)
    assert r2.status_code == 409
    assert "SOLD_OUT" in r2.text or "LIMIT" in r2.text


# ---- заказ больше остатка → STOCK_LESS_THAN_ORDER с остатком ----
def test_stock_less_than_order(client, customer):
    loc = make_location(daily_drink_limit=2)
    r = place(client, customer, loc, qty=5)
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "STOCK_LESS_THAN_ORDER"
    assert r.json()["detail"]["remaining"] == 2


# ---- без лимита: заказы не ограничены, но счётчик растёт ----
def test_no_limit(client, customer):
    loc = make_location(daily_drink_limit=None)
    r = place(client, customer, loc, qty=7)
    assert pay(client, customer, r.json()["id"]).status_code == 200
    assert counter(loc) == 7  # учёт ведётся даже без лимита


# ---- стоп-лист напитка по локации ----
def test_stop_list_blocks(client, customer):
    loc = make_location(daily_drink_limit=None)
    d1, _ = drink_ids(client)
    with SessionLocal() as db:
        db.add(LocationDrinkStop(location_id=loc, drink_id=d1, reason="кончилось"))
        db.commit()
    r = place(client, customer, loc, qty=1)
    assert r.status_code == 409
    assert "DRINK_UNAVAILABLE_AT_LOCATION" in r.text


# ---- операционная пауза ----
def test_paused(client, customer):
    loc = make_location(accepting_orders=False)
    r = place(client, customer, loc, qty=1)
    assert r.status_code == 409 and "LOCATION_PAUSED" in r.text


# ---- закрыто по расписанию ----
def test_closed_by_schedule(client, customer):
    loc = make_location(working_hours=_closed_hours())
    r = place(client, customer, loc, qty=1)
    assert r.status_code == 409 and "LOCATION_CLOSED" in r.text


# ---- refund возвращает напитки в дневной лимит того же дня ----
def test_refund_returns_limit(client, customer):
    loc = make_location(daily_drink_limit=10)
    r = place(client, customer, loc, qty=4)
    oid = r.json()["id"]
    assert pay(client, customer, oid).status_code == 200
    assert counter(loc) == 4
    # возврат через сервис (admin refund-эндпоинт появится в фиче доступа менеджера)
    from app.models.orders import Order
    from app.services.order_flow import refund_order
    with SessionLocal() as db:
        order = db.get(Order, oid)
        refund_order(db, order)
    assert counter(loc) == 0  # напитки вернулись в лимит дня
