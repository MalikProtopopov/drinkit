"""F05–F07, F10: золотой путь заказа по единой статусной модели (§0.1)."""
from .conftest import make_order


def test_golden_path(client, customer, manager):
    order = make_order(client, customer)
    assert order["paymentStatus"] == "paid"  # mock-Stripe подтвердил
    assert order["status"] == "new"
    assert order["total"] == order["subtotal"] > 0

    oid = order["id"]

    # «я на месте» — независимый флаг: доступен СРАЗУ после оплаты, до готовности
    # (клиент мог заказать, уже стоя у точки; бариста мог забыть нажать «готово»)
    r = client.post(f"/api/orders/{oid}/arrived", headers=customer["headers"])
    assert r.status_code == 200
    assert r.json()["arrived"] is True and r.json()["status"] == "new"

    # менеджер: взять в работу → готов (флаг прибытия виден поверх любого статуса)
    r = client.post(f"/api/admin/orders/{oid}/take", headers=manager["headers"])
    assert r.status_code == 200 and r.json()["status"] == "in_progress"
    assert r.json()["managerId"] is not None  # закрепление менеджера (ADM-M-02)
    assert r.json()["arrived"] is True

    r = client.post(f"/api/admin/orders/{oid}/status", json={"status": "ready"},
                    headers=manager["headers"])
    assert r.json()["status"] == "ready"

    # повторное «прибыл» идемпотентно
    r = client.post(f"/api/orders/{oid}/arrived", headers=customer["headers"])
    assert r.status_code == 200

    # менеджер передал
    r = client.post(f"/api/admin/orders/{oid}/status", json={"status": "completed"},
                    headers=manager["headers"])
    assert r.json()["status"] == "completed"

    # после выдачи «прибыл» уже не ставится
    r = client.post(f"/api/orders/{oid}/arrived", headers=customer["headers"])
    assert r.status_code == 409

    # история: created, paid, событие arrived, 3 смены статуса готовки (ADM-M-04)
    detail = client.get(f"/api/admin/orders/{oid}", headers=manager["headers"]).json()
    types = [e["type"] for e in detail["events"]]
    assert types.count("status_change") == 3
    assert "arrived" in types
    assert "created" in types and "paid" in types


def test_invalid_transition(client, customer, manager):
    order = make_order(client, customer)
    r = client.post(f"/api/admin/orders/{order['id']}/status", json={"status": "completed"},
                    headers=manager["headers"])
    assert r.status_code == 409  # new -> completed запрещён


def test_my_orders_list_and_snapshot(client, customer):
    order = make_order(client, customer)
    orders = client.get("/api/orders", headers=customer["headers"]).json()
    assert any(o["id"] == order["id"] for o in orders)
    mine = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    # состав со снэпшотом добавок и граммовкой (ADM-M-05)
    item = mine["items"][0]
    assert item["addons"][0]["amount"] > 0
    assert "events" in mine


def test_order_requires_car_plate(client, customer):
    det = client.get("/api/drinks/orange-fresh").json()
    # у customer уже сохранён plate в профиле — поэтому без plate возьмётся из профиля;
    # создаём пользователя без plate
    client.post("/api/auth/request-code", json={"phone": "+971507777777"})
    r = client.post("/api/auth/verify", json={"phone": "+971507777777", "code": "1836"})
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    r = client.post("/api/orders", json={"items": [{"drinkId": det["id"]}]}, headers=h)
    assert r.status_code == 422


def test_admin_filters(client, customer, manager):
    order = make_order(client, customer)
    rows = client.get("/api/admin/orders?active=true", headers=manager["headers"]).json()
    assert any(o["id"] == order["id"] for o in rows)
    rows = client.get("/api/admin/orders?unassigned=true", headers=manager["headers"]).json()
    assert any(o["id"] == order["id"] for o in rows)  # ещё не взят в работу


def test_foreign_order_404(client, manager):
    client.post("/api/auth/request-code", json={"phone": "+971501111111"})
    r = client.post("/api/auth/verify", json={"phone": "+971501111111", "code": "1836"})
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/api/orders/1", headers=h).status_code == 404
