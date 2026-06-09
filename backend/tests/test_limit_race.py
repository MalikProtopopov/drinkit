"""Тест ГОНКИ дневного лимита на РЕАЛЬНОМ Postgres (план §F, §I.1).

Самый важный инвариант: N параллельных оплат при лимите L (в напитках) не уводят
счётчик за L. SQLite игнорирует SELECT FOR UPDATE → гонку проверяем только на Postgres
через testcontainers. Без Docker/testcontainers тест авто-скипается.

Запуск в CI: pytest -m concurrency --count=10  (pytest-repeat — гонки флапают).
"""
import threading

import pytest

pytestmark = pytest.mark.concurrency

testcontainers = pytest.importorskip("testcontainers.postgres",
                                     reason="testcontainers (+Docker) не установлены")


@pytest.fixture(scope="module")
def pg_engine():
    from sqlalchemy import create_engine
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine") as pg:
        url = pg.get_connection_url().replace("psycopg2", "psycopg")
        eng = create_engine(url, future=True)
        from app.core.db import Base
        from app import models  # noqa: F401
        Base.metadata.create_all(eng)
        yield eng


def test_limit_race_no_oversell_in_drinks(pg_engine):
    """L=5 напитков, 20 оплат заказов по 1 напитку → ровно 5 проходят, 15 возвращаются."""
    from sqlalchemy.orm import sessionmaker

    from app.models.catalog import Drink
    from app.models.locations import Location, LocationDailyCounter
    from app.models.orders import Order, OrderItem
    from app.models.users import User
    from app.services.order_flow import LimitExceededError, mark_paid

    Session = sessionmaker(bind=pg_engine, future=True)
    open_hours = {d: [{"open": "00:00", "close": "23:59"}]
                  for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}

    with Session() as s:
        user = User(phone="+9710000000", name="T")
        drink = Drink(slug="x", name={"en": "X"}, status="published", base_price=10)
        loc = Location(name={"en": "Race"}, working_hours=open_hours, timezone="Asia/Dubai",
                       daily_drink_limit=5, accepting_orders=True, is_active=True)
        s.add_all([user, drink, loc]); s.commit()
        uid, did, lid = user.id, drink.id, loc.id
        order_ids = []
        for n in range(20):
            o = Order(number=2000 + n, user_id=uid, location_id=lid, status="new",
                      payment_status="pending", phone="+9710000000", car_plate="A1",
                      subtotal=10, total=10)
            s.add(o); s.flush()
            s.add(OrderItem(order_id=o.id, drink_id=did, drink_name="X", unit_price=10, quantity=1))
            order_ids.append(o.id)
        s.commit()

    results = []

    def pay(oid):
        with Session() as s:
            try:
                mark_paid(s, s.get(Order, oid))
                results.append(True)
            except LimitExceededError:
                results.append(False)

    threads = [threading.Thread(target=pay, args=(oid,)) for oid in order_ids]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sum(results) == 5, f"перепродажа: прошло {sum(results)} вместо 5"
    with Session() as s:
        row = s.query(LocationDailyCounter).filter_by(location_id=lid).first()
        assert row.committed_drinks == 5
        paid = s.query(Order).filter_by(location_id=lid, payment_status="paid").count()
        assert paid == 5
