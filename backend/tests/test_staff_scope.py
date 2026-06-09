"""Тесты привязки сотрудника к локации и скоупа менеджера (план §5.9)."""
from app.core.db import SessionLocal
from app.models.users import StaffUser
from tests.test_location_orders import make_location, place, pay


def _login(client, email, pwd):
    r = client.post("/api/staff/login", json={"email": email, "password": pwd})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_assign_location_and_scope(client, admin, customer):
    loc_a = make_location(name={"en": "A"}, daily_drink_limit=None)
    loc_b = make_location(name={"en": "B"}, daily_drink_limit=None)

    # super_admin создаёт менеджера, привязанного к точке A
    r = client.post("/api/staff/managers", headers=admin["headers"], json={
        "email": "mgr_a@grabzi.ae", "password": "pass1234", "name": "Mgr A",
        "role": "manager", "locationId": loc_a})
    assert r.status_code == 200, r.text
    assert r.json()["locationId"] == loc_a
    mgr = _login(client, "mgr_a@grabzi.ae", "pass1234")

    # /me содержит locationId
    me = client.get("/api/staff/me", headers=mgr).json()
    assert me["locationId"] == loc_a

    # заказы: один на A, один на B (оба оплачены → видны менеджеру)
    oa = place(client, customer, loc_a).json()["id"]
    pay(client, customer, oa)
    ob = place(client, customer, loc_b).json()["id"]
    pay(client, customer, ob)

    # менеджер A видит только заказы своей точки
    rows = client.get("/api/admin/orders", headers=mgr).json()
    loc_ids = {row["locationId"] for row in rows}
    assert loc_ids <= {loc_a}                      # только точка A
    assert any(row["id"] == oa for row in rows)
    assert all(row["id"] != ob for row in rows)

    # прямой доступ к чужому заказу → 403 FOREIGN_LOCATION
    r = client.get(f"/api/admin/orders/{ob}", headers=mgr)
    assert r.status_code == 403 and "FOREIGN_LOCATION" in r.text
    # взять чужой заказ → 403
    r = client.post(f"/api/admin/orders/{ob}/take", headers=mgr)
    assert r.status_code == 403


def test_patch_manager_location(client, admin):
    loc = make_location(name={"en": "C"})
    r = client.post("/api/staff/managers", headers=admin["headers"], json={
        "email": "mgr_c@grabzi.ae", "password": "pass1234", "name": "Mgr C", "role": "manager"})
    sid = r.json()["id"]
    assert r.json()["locationId"] is None
    r = client.patch(f"/api/staff/managers/{sid}", headers=admin["headers"],
                     json={"locationId": loc})
    assert r.status_code == 200 and r.json()["locationId"] == loc


def test_legacy_manager_unscoped(client, manager, customer):
    """manager@juicy.ae без локации видит все заказы (обратная совместимость)."""
    with SessionLocal() as db:
        m = db.query(StaffUser).filter_by(email="manager@juicy.ae").first()
        assert m.location_id is None
    # эндпоинт доступен и не падает (скоуп не применяется)
    assert client.get("/api/admin/orders", headers=manager["headers"]).status_code == 200
