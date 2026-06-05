"""F08/F09/F12/F13/F14: staff-роли, CRUD каталога, клиенты/платежи, дашборд, возврат."""
from .conftest import make_order


def test_manager_cannot_access_super_admin_sections(client, manager):
    """Менеджер — только заказы (ADM-M доступ)."""
    for url in ("/api/admin/catalog/drinks", "/api/admin/customers",
                "/api/admin/payments", "/api/admin/dashboard", "/api/staff/managers",
                "/api/admin/coupons"):
        assert client.get(url, headers=manager["headers"]).status_code == 403, url


def test_staff_login_wrong_password(client):
    r = client.post("/api/staff/login", json={"email": "admin@juicy.ae", "password": "nope"})
    assert r.status_code == 401


def test_managers_crud(client, admin):
    r = client.post("/api/staff/managers", headers=admin["headers"], json={
        "email": "barista2@juicy.ae", "password": "pass123", "name": "Бариста 2"})
    assert r.status_code == 200
    sid = r.json()["id"]
    r = client.delete(f"/api/staff/managers/{sid}", headers=admin["headers"])
    assert r.json()["ok"] is True
    # деактивированный менеджер не может войти
    r = client.post("/api/staff/login", json={"email": "barista2@juicy.ae", "password": "pass123"})
    assert r.status_code == 401


def test_catalog_crud_full_cycle(client, admin):
    """ADM-S-01..05: категория → единица → категория добавок → добавка → напиток → связка → публикация."""
    h = admin["headers"]
    cat = client.post("/api/admin/catalog/drink-categories", headers=h, json={
        "name": {"ru": "Лимонады", "ar": "ليمونادة"}, "sort": 9}).json()
    unit = client.get("/api/admin/catalog/units", headers=h).json()[0]
    acat = client.post("/api/admin/catalog/addon-categories", headers=h, json={
        "name": {"ru": "Сиропы"}, "selectionType": "counter"}).json()
    addon = client.post("/api/admin/catalog/addons", headers=h, json={
        "name": {"ru": "Сироп ваниль"}, "categoryId": acat["id"], "unitId": unit["id"],
        "kcalPer100": 300, "basePrice": 3}).json()

    drink = client.post("/api/admin/catalog/drinks", headers=h, json={
        "slug": "lemonade-classic", "name": {"ru": "Лимонад классический"},
        "status": "draft", "basePrice": 18, "kcal": 90, "categoryId": cat["id"]}).json()

    # черновик не виден публично
    assert client.get("/api/drinks/lemonade-classic").status_code == 404

    # связка с override цены и лимитами (ADM-S-05 AC3)
    r = client.put(f"/api/admin/catalog/drinks/{drink['id']}/bindings", headers=h, json=[
        {"addonId": addon["id"], "priceOverride": None, "minPortions": 0,
         "defaultPortions": 1, "maxPortions": 2, "portionAmount": 15}])
    assert r.status_code == 200

    # публикация → виден, добавка бесплатна (override NULL)
    drink["status"] = "published"
    client.patch(f"/api/admin/catalog/drinks/{drink['id']}", headers=h, json=drink)
    pub = client.get("/api/drinks/lemonade-classic").json()
    assert pub["addons"][0]["free"] is True

    # деактивация категории добавок скрывает добавку из конструктора (PUB-G-02 AC5)
    acat["isActive"] = False
    client.patch(f"/api/admin/catalog/addon-categories/{acat['id']}", headers=h, json=acat)
    pub = client.get("/api/drinks/lemonade-classic").json()
    assert pub["addons"] == []


def test_bindings_validation(client, admin):
    drinks = client.get("/api/admin/catalog/drinks", headers=admin["headers"]).json()
    r = client.put(f"/api/admin/catalog/drinks/{drinks[0]['id']}/bindings",
                   headers=admin["headers"],
                   json=[{"addonId": 1, "minPortions": 5, "defaultPortions": 1, "maxPortions": 2}])
    assert r.status_code == 422


def test_customers_and_payments(client, customer, admin):
    make_order(client, customer)
    rows = client.get("/api/admin/customers", headers=admin["headers"]).json()
    uid = customer["user"]["id"]
    assert any(u["id"] == uid for u in rows)
    detail = client.get(f"/api/admin/customers/{uid}", headers=admin["headers"]).json()
    assert len(detail["orders"]) >= 1 and len(detail["payments"]) >= 1  # ADM-S-08 AC2
    pays = client.get("/api/admin/payments", headers=admin["headers"]).json()
    assert pays[0]["orderNumber"] and pays[0]["customerPhone"]  # связь платёж↔заказ↔клиент


def test_dashboard_metrics(client, customer, admin):
    make_order(client, customer)
    d = client.get("/api/admin/dashboard", headers=admin["headers"]).json()
    assert d["revenue"] > 0 and d["ordersCount"] > 0
    assert d["avgOrderValue"] == round(d["revenue"] / d["ordersCount"], 2)
    assert d["drinksSold"] >= d["ordersCount"]
    assert len(d["ordersByHour"]) == 24
    assert d["topProducts"] and d["topCustomers"]
    # фильтр по периоду (ADM-S-10)
    d0 = client.get("/api/admin/dashboard?from=2099-01-01T00:00:00",
                    headers=admin["headers"]).json()
    assert d0["ordersCount"] == 0


def test_refund_flow(client, customer, manager):
    """ADM-M-06 (опциональный модуль)."""
    order = make_order(client, customer)
    client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    client.post(f"/api/admin/orders/{order['id']}/status", json={"status": "ready"},
                headers=manager["headers"])
    client.post(f"/api/admin/orders/{order['id']}/status", json={"status": "completed"},
                headers=manager["headers"])
    r = client.post(f"/api/admin/orders/{order['id']}/refund", headers=manager["headers"],
                    json={"status": "refund", "note": "брак"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "refund" and data["paymentStatus"] == "refunded"
    # клиент видит возврат (ADM-M-06 AC4)
    mine = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    assert mine["status"] == "refund"
