"""Тесты настроек (app_settings), контента (info_blocks), разреза дашборда по локациям."""
from tests.test_location_orders import _open_hours, pay, place


def test_settings_get_patch(client, admin, manager):
    # super_admin читает настройки
    r = client.get("/api/admin/settings", headers=admin["headers"])
    assert r.status_code == 200
    data = r.json()
    assert "general" in data["editable"] and "defaults" in data["editable"]
    assert "integrations" in data["readonly"]
    # секреты — только статус, без значений
    assert data["readonly"]["integrations"]["stripe"] in ("configured", "missing")

    # patch валидного ключа
    r = client.patch("/api/admin/settings", headers=admin["headers"],
                     json={"default_daily_drink_limit": 150, "display_currency": "AED"})
    assert r.status_code == 200 and r.json()["values"]["default_daily_drink_limit"] == 150
    # невалидный enum
    assert client.patch("/api/admin/settings", headers=admin["headers"],
                        json={"display_currency": "USD"}).status_code == 422
    # неизвестный ключ
    assert client.patch("/api/admin/settings", headers=admin["headers"],
                        json={"nope": 1}).status_code == 422
    # менеджер не имеет доступа
    assert client.get("/api/admin/settings", headers=manager["headers"]).status_code == 403


def test_content_crud_and_public(client, admin):
    r = client.post("/api/admin/content", headers=admin["headers"], json={
        "key": "story", "title": {"en": "Our Story"},
        "body": {"en": "GRABZI started with a dream."}})
    assert r.status_code == 200
    bid = r.json()["id"]
    client.patch(f"/api/admin/content/{bid}", headers=admin["headers"],
                 json={"body": {"en": "Updated story."}})
    # публичная выдача по локали
    pub = client.get("/api/content?locale=en").json()
    story = next(b for b in pub if b["key"] == "story")
    assert story["title"] == "Our Story" and story["body"] == "Updated story."


def test_dashboard_by_location(client, admin, customer):
    loc = client.post("/api/admin/locations", headers=admin["headers"],
                      json={"name": {"en": "Dash"}, "workingHours": _open_hours(),
                            "dailyDrinkLimit": 100}).json()
    oid = place(client, customer, loc["id"], qty=2).json()["id"]
    pay(client, customer, oid)
    d = client.get("/api/admin/dashboard", headers=admin["headers"]).json()
    assert "byLocation" in d
    row = next(x for x in d["byLocation"] if x["locationId"] == loc["id"])
    assert row["soldToday"] == 2 and row["limit"] == 100 and row["remaining"] == 98
    # фильтр по локации
    d2 = client.get(f"/api/admin/dashboard?location_id={loc['id']}", headers=admin["headers"]).json()
    assert d2["drinksSold"] >= 2
