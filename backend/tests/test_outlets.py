"""Локации (REQ-1..7): публичный статус/адрес, привязка заказа, стоп-лист, дневной лимит,
скоуп по ролям, инварианты привязки сотрудников, read-only для screen, валидация часов."""


def _drink_id(client, slug="orange-fresh"):
    return client.get(f"/api/drinks/{slug}").json()["id"]


def _make_paid_order(client, customer, outlet_id=None, qty=1, slug="orange-fresh"):
    body = {"items": [{"drinkId": _drink_id(client, slug), "quantity": qty, "addons": []}],
            "carPlate": "X 1", "emirate": "Dubai"}
    if outlet_id is not None:
        body["outletId"] = outlet_id
    r = client.post("/api/orders", json=body, headers=customer["headers"])
    assert r.status_code == 200, r.text
    o = r.json()
    r = client.post("/api/payments/checkout-session", json={"orderId": o["id"]},
                    headers=customer["headers"])
    assert r.status_code == 200, r.text
    return o


def _main_outlet_id(client, admin):
    return client.get("/api/admin/outlets", headers=admin["headers"]).json()[0]["id"]


def test_public_outlets_and_order_block(client, customer):
    outlets = client.get("/api/outlets").json()
    assert len(outlets) >= 1
    main = outlets[0]
    assert main["status"] == "open" and main["openNow"] is True
    assert "address" in main

    o = _make_paid_order(client, customer)
    assert o["outletId"] == main["id"]
    assert o["outlet"]["id"] == main["id"]
    assert o["outlet"]["address"] == main["address"]

    lst = client.get("/api/orders", headers=customer["headers"]).json()
    assert lst[0]["outlet"]["id"] == main["id"]
    det = client.get(f"/api/orders/{o['id']}", headers=customer["headers"]).json()
    assert det["outlet"]["id"] == main["id"]


def test_stop_list_hides_drink_and_blocks_order(client, customer, admin):
    oid = _main_outlet_id(client, admin)
    did = _drink_id(client)
    r = client.post(f"/api/admin/outlets/{oid}/stop-list/toggle",
                    json={"entityType": "drink", "entityId": did}, headers=admin["headers"])
    assert r.json()["stopped"] is True
    try:
        assert "orange-fresh" not in [d["slug"] for d in client.get("/api/drinks").json()]
        assert client.get("/api/drinks/orange-fresh").status_code == 404
        r = client.post("/api/orders",
                        json={"items": [{"drinkId": did, "quantity": 1, "addons": []}],
                              "carPlate": "X 2"}, headers=customer["headers"])
        assert r.status_code == 409
    finally:
        client.post(f"/api/admin/outlets/{oid}/stop-list/toggle",
                    json={"entityType": "drink", "entityId": did}, headers=admin["headers"])
    assert "orange-fresh" in [d["slug"] for d in client.get("/api/drinks").json()]


def test_daily_limit_auto_pauses_outlet(client, customer, admin):
    oid = _main_outlet_id(client, admin)
    # лимит относительно уже накопленного за день: разрешаем создать заказ, но он добивает до лимита
    cur = client.get(f"/api/admin/outlets/{oid}", headers=admin["headers"]).json()["drinksToday"]
    client.patch(f"/api/admin/outlets/{oid}", json={"dailyDrinkLimit": cur + 2},
                 headers=admin["headers"])
    try:
        _make_paid_order(client, customer, qty=2)  # добивает счётчик до лимита
        row = client.get(f"/api/admin/outlets/{oid}", headers=admin["headers"]).json()
        assert row["drinksToday"] >= cur + 2
        assert row["status"] == "paused"
        assert row["limitRemaining"] == 0
        r = client.post("/api/orders",
                        json={"items": [{"drinkId": _drink_id(client), "quantity": 1, "addons": []}],
                              "carPlate": "X 3"}, headers=customer["headers"])
        assert r.status_code == 409  # OUTLET_CLOSED (paused)
    finally:
        client.patch(f"/api/admin/outlets/{oid}", json={"dailyDrinkLimit": None},
                     headers=admin["headers"])
    assert client.get("/api/outlets").json()[0]["openNow"] is True


def test_invalid_hours_rejected(client, admin):
    oid = _main_outlet_id(client, admin)
    # закрытие раньше открытия — 422
    r = client.patch(f"/api/admin/outlets/{oid}",
                     json={"hours": {"0": [{"open": "22:00", "close": "08:00"}]}},
                     headers=admin["headers"])
    assert r.status_code == 422
    # некорректный час — 422
    r = client.patch(f"/api/admin/outlets/{oid}",
                     json={"hours": {"0": [{"open": "09:00", "close": "25:00"}]}},
                     headers=admin["headers"])
    assert r.status_code == 422


def test_24h_and_closed_days_hours(client, admin):
    oid = _main_outlet_id(client, admin)
    # круглосуточно все 7 дней (00:00–24:00) — принимается, точка открыта
    full = {str(i): [{"open": "00:00", "close": "24:00"}] for i in range(7)}
    r = client.patch(f"/api/admin/outlets/{oid}", json={"hours": full}, headers=admin["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "open"
    assert client.get("/api/outlets").json()[0]["openNow"] is True
    try:
        # все дни закрыты ([]) — точка closed (расписание задано, не пустое)
        closed = {str(i): [] for i in range(7)}
        r = client.patch(f"/api/admin/outlets/{oid}", json={"hours": closed}, headers=admin["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "closed"
        assert client.get("/api/outlets").json()[0]["openNow"] is False
    finally:
        # вернуть всегда-открыто (все дни 24/7), чтобы не сломать остальные тесты сессии.
        # PATCH hours={} дал бы all-empty = закрыто (пустой {} = «не задано» только для свежей точки)
        client.patch(f"/api/admin/outlets/{oid}", json={"hours": full}, headers=admin["headers"])


def test_last_active_outlet_cannot_be_deactivated(client, admin):
    oid = _main_outlet_id(client, admin)
    r = client.post(f"/api/admin/outlets/{oid}/deactivate", headers=admin["headers"])
    assert r.status_code == 409  # LAST_ACTIVE_OUTLET


def test_order_scoping_by_outlet(client, customer, admin, manager):
    # 2-я точка создаётся НЕактивной (D4) — даже с isActive по умолчанию
    o2 = client.post("/api/admin/outlets", json={"name": {"en": "Second", "ru": "Вторая"}},
                     headers=admin["headers"]).json()
    assert o2["isActive"] is False
    m2c = None
    try:
        # активация 2-й активной требует force (D4: на паблике нет пикера)
        assert client.post(f"/api/admin/outlets/{o2['id']}/activate",
                           headers=admin["headers"]).status_code == 409
        client.post(f"/api/admin/outlets/{o2['id']}/activate?force=true", headers=admin["headers"])
        m2c = client.post("/api/staff/managers",
                          json={"email": "m2@juicy.ae", "password": "manager123", "name": "M2",
                                "role": "manager", "outletIds": [o2["id"]]},
                          headers=admin["headers"]).json()
        tok = client.post("/api/staff/login",
                          json={"email": "m2@juicy.ae", "password": "manager123"}).json()["token"]
        m2 = {"Authorization": f"Bearer {tok}"}
        # 2 активные → заказ без outletId → 422 OUTLET_REQUIRED
        r = client.post("/api/orders",
                        json={"items": [{"drinkId": _drink_id(client), "quantity": 1, "addons": []}],
                              "carPlate": "X 4"}, headers=customer["headers"])
        assert r.status_code == 422
        ord2 = _make_paid_order(client, customer, outlet_id=o2["id"])
        seen_m2 = client.get("/api/admin/orders", headers=m2).json()
        assert any(x["id"] == ord2["id"] for x in seen_m2)
        assert all(x["outletId"] == o2["id"] for x in seen_m2)
        # менеджер точки 1 не видит заказ точки 2
        seen_m1 = client.get("/api/admin/orders", headers=manager["headers"]).json()
        assert all(x["id"] != ord2["id"] for x in seen_m1)
        # чужой заказ по прямой ссылке → 404 (не 403)
        assert client.get(f"/api/admin/orders/{ord2['id']}",
                          headers=manager["headers"]).status_code == 404
    finally:
        client.post(f"/api/admin/outlets/{o2['id']}/deactivate", headers=admin["headers"])
        if m2c:
            client.delete(f"/api/staff/managers/{m2c['id']}", headers=admin["headers"])


def test_staff_outlet_invariants_and_screen_readonly(client, customer, admin):
    oid = _main_outlet_id(client, admin)
    tok = client.post("/api/staff/login",
                      json={"email": "screen@juicy.ae", "password": "screen123"}).json()["token"]
    screen = {"Authorization": f"Bearer {tok}"}
    # screen — read-only: не может брать заказ в работу
    o = _make_paid_order(client, customer)
    assert client.post(f"/api/admin/orders/{o['id']}/take", headers=screen).status_code == 403
    assert client.get("/api/screen/board", headers=screen).status_code == 200

    # screen должен иметь ровно одну точку
    extra = client.post("/api/admin/outlets", json={"name": {"en": "X"}},
                        headers=admin["headers"]).json()
    r = client.post("/api/staff/managers",
                    json={"email": "sc2@juicy.ae", "password": "screen123", "name": "SC",
                          "role": "screen", "outletIds": [oid, extra["id"]]},
                    headers=admin["headers"])
    assert r.status_code == 422  # OUTLET_SCOPE_INVALID
