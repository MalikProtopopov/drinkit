"""Тесты админ-роутера локаций (план §5.8/§5.14/§5.15/§5.16)."""
from tests.test_location_orders import _open_hours


def _mgr(client, admin, location_id):
    """Создать менеджера, привязанного к точке, и вернуть его заголовки."""
    email = f"m{location_id}@grabzi.ae"
    client.post("/api/staff/managers", headers=admin["headers"], json={
        "email": email, "password": "pass1234", "name": "M", "role": "manager",
        "locationId": location_id})
    r = client.post("/api/staff/login", json={"email": email, "password": "pass1234"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_crud_location(client, admin):
    r = client.post("/api/admin/locations", headers=admin["headers"], json={
        "name": {"en": "Marina"}, "address": "Dubai Marina",
        "workingHours": _open_hours(), "dailyDrinkLimit": 100})
    assert r.status_code == 200, r.text
    loc = r.json()
    assert loc["status"] == "open" and loc["remaining"] == 100
    # patch лимит → без лимита
    r = client.patch(f"/api/admin/locations/{loc['id']}", headers=admin["headers"],
                     json={"dailyDrinkLimit": None})
    assert r.json()["remaining"] is None
    # список
    assert any(x["id"] == loc["id"] for x in client.get("/api/admin/locations",
                                                        headers=admin["headers"]).json())


def test_pause_super_admin_only(client, admin):
    loc = client.post("/api/admin/locations", headers=admin["headers"],
                      json={"name": {"en": "P"}, "workingHours": _open_hours()}).json()
    mgr = _mgr(client, admin, loc["id"])
    # менеджер НЕ может ставить паузу
    r = client.post(f"/api/admin/locations/{loc['id']}/pause", headers=mgr,
                    json={"acceptingOrders": False})
    assert r.status_code == 403
    # super_admin может
    r = client.post(f"/api/admin/locations/{loc['id']}/pause", headers=admin["headers"],
                    json={"acceptingOrders": False, "reason": "перерыв"})
    assert r.status_code == 200 and r.json()["status"] == "paused"
    # история содержит событие паузы
    hist = client.get(f"/api/admin/locations/{loc['id']}/history", headers=admin["headers"]).json()
    assert any(e["action"] == "pause" for e in hist)
    # возобновление
    client.post(f"/api/admin/locations/{loc['id']}/pause", headers=admin["headers"],
                json={"acceptingOrders": True})


def test_stop_list_manager_own_point(client, admin):
    loc = client.post("/api/admin/locations", headers=admin["headers"],
                      json={"name": {"en": "S"}, "workingHours": _open_hours()}).json()
    other = client.post("/api/admin/locations", headers=admin["headers"],
                        json={"name": {"en": "Other"}, "workingHours": _open_hours()}).json()
    mgr = _mgr(client, admin, loc["id"])
    d1 = client.get("/api/drinks/orange-fresh").json()["id"]
    # менеджер стопит напиток на своей точке
    r = client.post(f"/api/admin/locations/{loc['id']}/stops", headers=mgr,
                    json={"drinkId": d1, "reason": "сироп кончился"})
    assert r.status_code == 200
    assert d1 in [s["drinkId"] for s in client.get(
        f"/api/admin/locations/{loc['id']}/stops", headers=mgr).json()]
    # на чужой точке — 403
    assert client.post(f"/api/admin/locations/{other['id']}/stops", headers=mgr,
                       json={"drinkId": d1}).status_code == 403
    # снять
    assert client.delete(f"/api/admin/locations/{loc['id']}/stops/{d1}",
                         headers=mgr).status_code == 204


def test_daily_and_adjust(client, admin):
    loc = client.post("/api/admin/locations", headers=admin["headers"],
                      json={"name": {"en": "D"}, "workingHours": _open_hours(),
                            "dailyDrinkLimit": 50}).json()
    # ручная корректировка
    r = client.post(f"/api/admin/locations/{loc['id']}/adjust-day", headers=admin["headers"],
                    json={"setCommitted": 20})
    assert r.json()["soldDrinks"] == 20
    d = client.get(f"/api/admin/locations/{loc['id']}/daily", headers=admin["headers"]).json()
    assert d["soldDrinks"] == 20 and d["remaining"] == 30


def test_location_status_panel(client, admin):
    loc = client.post("/api/admin/locations", headers=admin["headers"],
                      json={"name": {"en": "K"}, "workingHours": _open_hours(),
                            "dailyDrinkLimit": 40}).json()
    mgr = _mgr(client, admin, loc["id"])
    # менеджер видит панель своей точки
    p = client.get("/api/admin/location-status", headers=mgr).json()
    assert p["locationId"] == loc["id"] and p["limit"] == 40 and p["remaining"] == 40
    # super_admin: агрегат
    allp = client.get("/api/admin/location-status?scope=all", headers=admin["headers"]).json()
    assert allp["scope"] == "all" and "locations" in allp
