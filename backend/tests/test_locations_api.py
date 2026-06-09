"""Тесты публичного API локаций (план §5.6)."""
from app.core.db import SessionLocal
from app.models.locations import LocationDrinkStop
from tests.test_location_orders import _closed_hours, _open_hours, drink_ids, make_location


def test_list_locations_public(client):
    make_location(name={"en": "Marina"}, daily_drink_limit=50)
    r = client.get("/api/locations?locale=en")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    one = items[-1]
    assert one["status"] in ("open", "paused", "closed", "inactive")
    assert "remaining" in one and "isOpen" in one and "workingHours" in one


def test_location_status_fields(client):
    loc_open = make_location(daily_drink_limit=10)
    loc_paused = make_location(accepting_orders=False)
    loc_closed = make_location(working_hours=_closed_hours())

    o = client.get(f"/api/locations/{loc_open}").json()
    assert o["status"] == "open" and o["isOpen"] is True and o["remaining"] == 10

    p = client.get(f"/api/locations/{loc_paused}").json()
    assert p["status"] == "paused" and p["isOpen"] is False

    c = client.get(f"/api/locations/{loc_closed}").json()
    assert c["status"] == "closed" and c["isOpen"] is False
    assert c["nextOpenAt"] is None  # выходной всю неделю → нет ближайшего открытия


def test_no_limit_location_remaining_null(client):
    loc = make_location(daily_drink_limit=None)
    d = client.get(f"/api/locations/{loc}").json()
    assert d["remaining"] is None and d["isSoldOut"] is False


def test_catalog_soldout_by_location(client):
    loc = make_location(daily_drink_limit=None)
    d1, _ = drink_ids(client)
    with SessionLocal() as db:
        db.add(LocationDrinkStop(location_id=loc, drink_id=d1))
        db.commit()
    drinks = client.get(f"/api/drinks?location_id={loc}&locale=en").json()
    stopped = next(x for x in drinks if x["id"] == d1)
    assert stopped["soldOut"] is True
    # без location_id — ничего не помечено
    drinks2 = client.get("/api/drinks?locale=en").json()
    assert all(x.get("soldOut") is False for x in drinks2)
