"""Исчерпывающие тесты роутера orders (app/routers/orders.py).

Покрытие эндпоинтов:
  POST   /api/orders                  — создание заказа
  GET    /api/orders                  — список заказов клиента
  GET    /api/orders/{id}             — деталка (404 чужой), ratingPromptDue
  POST   /api/orders/{id}/arrived     — флаг «я на месте» (идемпотентность, 409)
  POST   /api/orders/{id}/rate        — оценка like/dislike, купон за дизлайк

Не меняем conftest.py и существующие тесты. Используем фикстуры:
  client, customer, manager, admin, make_order.
"""
import uuid

import pytest

from .conftest import make_order


# ----------------------------------------------------------------------------
# Локальные хелперы (НЕ трогают conftest)
# ----------------------------------------------------------------------------

def _new_customer(client, plate=None, emirate=None, name="Доп", locale="ru"):
    """Создаёт свежего авторизованного клиента (уникальный телефон).

    OTP включён → request-code возвращает devCode, verify требует код.
    """
    phone = "+9715" + uuid.uuid4().int.__str__()[:8]
    r = client.post("/api/auth/request-code", json={"phone": phone})
    assert r.status_code == 200, r.text
    code = r.json()["devCode"]
    r = client.post("/api/auth/verify", json={"phone": phone, "code": code,
                                              "name": name, "locale": locale})
    assert r.status_code == 200, r.text
    data = r.json()
    h = {"Authorization": f"Bearer {data['token']}"}
    # при необходимости дозаполняем профиль (carPlate, emirate)
    patch = {}
    if plate is not None:
        patch["carPlate"] = plate
    if emirate is not None:
        patch["emirate"] = emirate
    if patch:
        rp = client.patch("/api/auth/me", json=patch, headers=h)
        assert rp.status_code == 200, rp.text
    return {"headers": h, "user": data["user"]}


def _drink_id(client, slug):
    return client.get(f"/api/drinks/{slug}").json()["id"]


def _basic_body(client, **over):
    """Минимально валидное тело заказа (1 напиток, есть carPlate)."""
    body = {
        "items": [{"drinkId": _drink_id(client, "orange-fresh"), "quantity": 1}],
        "carPlate": "a 12345",
        "emirate": "Dubai",
        "customerName": "Тест",
    }
    body.update(over)
    return body


def _place(client, headers, body, locale=None):
    url = "/api/orders"
    if locale is not None:
        url += f"?locale={locale}"
    return client.post(url, json=body, headers=headers)


def _advance_to_completed(client, manager_headers, order_id):
    """new -> in_progress -> ready -> completed силами менеджера."""
    assert client.post(f"/api/admin/orders/{order_id}/take",
                       headers=manager_headers).status_code == 200
    assert client.post(f"/api/admin/orders/{order_id}/status", json={"status": "ready"},
                       headers=manager_headers).status_code == 200
    assert client.post(f"/api/admin/orders/{order_id}/status", json={"status": "completed"},
                       headers=manager_headers).status_code == 200


# ============================================================================
# POST /api/orders — счастливый путь и структура ответа
# ============================================================================

def test_place_order_happy_path_structure(client, customer):
    body = _basic_body(client, items=[
        {"drinkId": _drink_id(client, "orange-fresh"), "quantity": 2},
    ])
    r = _place(client, customer["headers"], body)
    assert r.status_code == 200, r.text
    o = r.json()
    # базовые поля
    assert isinstance(o["id"], int)
    assert isinstance(o["number"], int)
    assert o["status"] == "new"
    assert o["paymentStatus"] == "pending"   # ещё не оплачен
    assert o["arrived"] is False
    assert o["rating"] is None
    # суммы: total = subtotal (купона нет)
    assert o["subtotal"] > 0
    assert o["couponDiscount"] == 0
    assert o["total"] == o["subtotal"]
    # full payload содержит carPlate/emirate/customerName/phone/events
    assert o["emirate"] == "Dubai"
    assert o["customerName"] == "Тест"
    assert "phone" in o and "events" in o
    # позиции
    assert len(o["items"]) == 1
    it = o["items"][0]
    assert it["quantity"] == 2
    assert it["drinkId"] == _drink_id(client, "orange-fresh")
    assert it["paidByCoupon"] is False
    assert it["addons"] == []
    # событие created присутствует
    assert any(e["type"] == "created" for e in o["events"])


def test_place_order_carplate_uppercased(client, customer):
    body = _basic_body(client, carPlate="f 9z aa 1")
    r = _place(client, customer["headers"], body)
    assert r.status_code == 200, r.text
    assert r.json()["carPlate"] == "F 9Z AA 1"


def test_place_order_carplate_from_profile_when_omitted(client):
    """carPlate не в теле → берётся из профиля (уже uppercase) PUB-A-01."""
    cust = _new_customer(client, plate="d 55555", emirate="Sharjah")
    body = {"items": [{"drinkId": _drink_id(client, "immunity-shot")}]}
    r = _place(client, cust["headers"], body)
    assert r.status_code == 200, r.text
    assert r.json()["carPlate"] == "D 55555"
    assert r.json()["emirate"] == "Sharjah"   # emirate из профиля


def test_place_order_customer_name_falls_back_to_profile(client):
    cust = _new_customer(client, plate="c 1", name="ПрофильИмя")
    body = {"items": [{"drinkId": _drink_id(client, "immunity-shot")}]}
    r = _place(client, cust["headers"], body)
    assert r.status_code == 200, r.text
    assert r.json()["customerName"] == "ПрофильИмя"


def test_place_order_custom_name_used_in_item(client, customer):
    body = _basic_body(client, items=[
        {"drinkId": _drink_id(client, "orange-fresh"), "customName": "Мой особый сок"},
    ])
    r = _place(client, customer["headers"], body)
    assert r.status_code == 200, r.text
    it = r.json()["items"][0]
    assert it["name"] == "Мой особый сок"          # name = custom_name приоритетно
    assert it["drinkName"] and it["drinkName"] != "Мой особый сок"


def test_place_order_with_addons_grams_and_price(client, customer):
    det = client.get("/api/drinks/orange-fresh").json()
    ginger = next(a for a in det["addons"] if a["name"] == "Имбирь")
    body = _basic_body(client, items=[
        {"drinkId": det["id"], "quantity": 1,
         "addons": [{"addonId": ginger["addonId"], "portions": 1}]},
    ])
    r = _place(client, customer["headers"], body)
    assert r.status_code == 200, r.text
    it = r.json()["items"][0]
    assert len(it["addons"]) == 1
    a = it["addons"][0]
    assert a["name"] == "Имбирь"
    assert a["portions"] == 1
    assert a["amount"] > 0          # граммовка = portions * portion_amount
    assert it["unitPrice"] > det["basePrice"]   # добавка платная → цена выросла


def test_place_order_quantity_default_is_one(client, customer):
    body = {"items": [{"drinkId": _drink_id(client, "immunity-shot")}], "carPlate": "q 1"}
    r = _place(client, customer["headers"], body)
    assert r.status_code == 200, r.text
    assert r.json()["items"][0]["quantity"] == 1


def test_place_order_locale_en_normalized_to_ru_snapshot(client, customer):
    """locale=en не в settings.locales → snapshot имени делается на ru (fallback)."""
    body = _basic_body(client)
    r = _place(client, customer["headers"], body, locale="en")
    assert r.status_code == 200, r.text
    # имя апельсинового фреша по-русски (en→ru нормализация в t())
    assert r.json()["items"][0]["drinkName"] == "Апельсиновый фреш"


def test_place_order_locale_ar_snapshot(client, customer):
    body = _basic_body(client)
    r = _place(client, customer["headers"], body, locale="ar")
    assert r.status_code == 200, r.text
    # арабская локаль поддерживается → имя на арабском
    assert r.json()["items"][0]["drinkName"] == "عصير برتقال"


def test_place_order_subtotal_respects_quantity(client, customer):
    did = _drink_id(client, "immunity-shot")
    base = client.get("/api/drinks/immunity-shot").json()["basePrice"]
    body = _basic_body(client, items=[{"drinkId": did, "quantity": 3}])
    r = _place(client, customer["headers"], body)
    assert r.status_code == 200, r.text
    assert r.json()["subtotal"] == round(base * 3, 2)


def test_place_order_rejects_zero_quantity(client, customer):
    body = _basic_body(client, items=[{"drinkId": _drink_id(client, "orange-fresh"), "quantity": 0}])
    r = _place(client, customer["headers"], body)
    # ожидание: 422 (невалидное количество). Фактически API возвращает 200, subtotal=0.
    assert r.status_code == 422


def test_place_order_rejects_negative_quantity(client, customer):
    body = _basic_body(client, items=[{"drinkId": _drink_id(client, "orange-fresh"), "quantity": -2}])
    r = _place(client, customer["headers"], body)
    if r.status_code == 200:
        # фиксируем фактический баг: отрицательная сумма заказа
        assert r.json()["total"] >= 0, f"negative total leaked: {r.json()['total']}"
    assert r.status_code == 422


# ============================================================================
# POST /api/orders — негативы валидации
# ============================================================================

def test_place_order_401_without_token(client):
    r = client.post("/api/orders", json=_basic_body(client))
    assert r.status_code == 401


def test_place_order_403_staff_token(client, manager):
    """staff-токен (kind=staff) запрещён для клиентского эндпоинта."""
    r = client.post("/api/orders", json=_basic_body(client), headers=manager["headers"])
    assert r.status_code == 403


def test_place_order_422_missing_items_field(client, customer):
    r = client.post("/api/orders", json={"carPlate": "x 1"}, headers=customer["headers"])
    assert r.status_code == 422   # items обязателен (pydantic)


def test_place_order_422_empty_items_cart(client, customer):
    r = _place(client, customer["headers"], {"items": [], "carPlate": "x 1"})
    assert r.status_code == 422
    assert r.json()["detail"] == "CART_EMPTY"


def test_place_order_422_item_missing_drinkid(client, customer):
    r = _place(client, customer["headers"], {"items": [{"quantity": 1}], "carPlate": "x 1"})
    assert r.status_code == 422   # drinkId обязателен в ItemIn


def test_place_order_422_drinkid_wrong_type(client, customer):
    r = _place(client, customer["headers"],
               {"items": [{"drinkId": "not-int"}], "carPlate": "x 1"})
    assert r.status_code == 422


def test_place_order_422_quantity_wrong_type(client, customer):
    r = _place(client, customer["headers"],
               {"items": [{"drinkId": _drink_id(client, "orange-fresh"), "quantity": "two"}],
                "carPlate": "x 1"})
    assert r.status_code == 422


def test_place_order_422_addon_missing_addonid(client, customer):
    r = _place(client, customer["headers"], {
        "items": [{"drinkId": _drink_id(client, "orange-fresh"),
                   "addons": [{"portions": 1}]}],
        "carPlate": "x 1",
    })
    assert r.status_code == 422   # addonId обязателен в SelIn


def test_place_order_422_car_plate_required(client):
    """Нет carPlate ни в теле, ни в профиле → 422 CAR_PLATE_REQUIRED."""
    cust = _new_customer(client)  # профиль без plate
    r = _place(client, cust["headers"], {"items": [{"drinkId": _drink_id(client, "orange-fresh")}]})
    assert r.status_code == 422
    assert r.json()["detail"] == "CAR_PLATE_REQUIRED"


def test_place_order_422_car_plate_empty_string(client):
    """carPlate='' и пустой профиль → пустая строка не спасает, 422."""
    cust = _new_customer(client)
    r = _place(client, cust["headers"],
               {"items": [{"drinkId": _drink_id(client, "orange-fresh")}], "carPlate": ""})
    assert r.status_code == 422
    assert r.json()["detail"] == "CAR_PLATE_REQUIRED"


def test_place_order_409_nonexistent_drink(client, customer):
    r = _place(client, customer["headers"],
               {"items": [{"drinkId": 9_999_999}], "carPlate": "x 1"})
    assert r.status_code == 409
    assert r.json()["detail"] == "DRINK_NOT_AVAILABLE"


def test_place_order_409_draft_drink_not_available(client, customer):
    """draft-example существует, но status=draft → 409."""
    # узнаём id черновика через прямой запрос в БД нельзя; берём через каталог невозможно
    # (он не публикуется). draft-example засеян; его id не отдаётся API, поэтому
    # проверяем поведение через заведомо непубликуемый slug-детейл = 404, а для заказа
    # используем большой несуществующий id уже покрыт. Здесь подберём id черновика
    # перебором: каталог /api/drinks отдаёт только published, draft там нет.
    published_ids = {d["id"] for d in client.get("/api/drinks").json()}
    # ищем первый id, которого нет среди published, но который существует (draft)
    candidate = max(published_ids) + 1 if published_ids else 1
    r = _place(client, customer["headers"],
               {"items": [{"drinkId": candidate}], "carPlate": "x 1"})
    # либо это draft (409 DRINK_NOT_AVAILABLE), либо несуществующий (тоже 409)
    assert r.status_code == 409
    assert r.json()["detail"] == "DRINK_NOT_AVAILABLE"


def test_place_order_409_addon_out_of_range(client, customer):
    """portions сверх max_portions → 409 ADDON_PORTIONS_OUT_OF_RANGE (из drink_preview)."""
    det = client.get("/api/drinks/orange-fresh").json()
    ginger = next(a for a in det["addons"] if a["name"] == "Имбирь")
    body = _basic_body(client, items=[{
        "drinkId": det["id"],
        "addons": [{"addonId": ginger["addonId"], "portions": ginger["maxPortions"] + 5}],
    }])
    r = _place(client, customer["headers"], body)
    assert r.status_code == 409
    assert r.json()["detail"] == "ADDON_PORTIONS_OUT_OF_RANGE"


def test_place_order_409_addon_not_available_for_drink(client, customer):
    """addonId, не привязанный к напитку → 409 ADDON_NOT_AVAILABLE."""
    body = _basic_body(client, items=[{
        "drinkId": _drink_id(client, "orange-fresh"),
        "addons": [{"addonId": 999_999, "portions": 1}],
    }])
    r = _place(client, customer["headers"], body)
    assert r.status_code == 409
    assert r.json()["detail"] == "ADDON_NOT_AVAILABLE"


# ---- купоны при создании заказа -------------------------------------------

def test_place_order_409_invalid_coupon(client, customer):
    body = _basic_body(client, couponId=9_999_999, couponItemIndex=0)
    r = _place(client, customer["headers"], body)
    assert r.status_code == 409
    assert r.json()["detail"] == "COUPON_INVALID"


def test_place_order_422_coupon_without_item_index(client):
    """couponId есть, но couponItemIndex не указан → 422 COUPON_ITEM_REQUIRED.

    Сначала клиент получает реальный активный купон (дизлайк), затем пытается
    применить его без выбора напитка.
    """
    cust = _new_customer(client, plate="cp 1")
    coupon_id = _earn_coupon(client, cust)
    body = _basic_body(client, couponId=coupon_id)   # couponItemIndex отсутствует
    r = _place(client, cust["headers"], body)
    assert r.status_code == 422
    assert r.json()["detail"] == "COUPON_ITEM_REQUIRED"


def test_place_order_409_foreign_coupon(client, customer):
    """Купон чужого клиента → 409 COUPON_INVALID."""
    other = _new_customer(client, plate="oc 1")
    coupon_id = _earn_coupon(client, other)
    body = _basic_body(client, couponId=coupon_id, couponItemIndex=0)
    r = _place(client, customer["headers"], body)
    assert r.status_code == 409
    assert r.json()["detail"] == "COUPON_INVALID"


def test_place_order_coupon_applies_discount(client):
    """Активный купон + couponItemIndex → discount = цена выбранного напитка."""
    cust = _new_customer(client, plate="ca 1")
    coupon_id = _earn_coupon(client, cust)
    did = _drink_id(client, "orange-fresh")
    unit = client.get("/api/drinks/orange-fresh").json()["basePrice"]
    body = {
        "items": [{"drinkId": did, "quantity": 1}],
        "carPlate": "ca 1",
        "couponId": coupon_id,
        "couponItemIndex": 0,
    }
    r = _place(client, cust["headers"], body)
    assert r.status_code == 200, r.text
    o = r.json()
    assert o["couponDiscount"] == round(unit, 2)
    assert o["total"] == round(o["subtotal"] - o["couponDiscount"], 2)
    assert o["items"][0]["paidByCoupon"] is True


def test_place_order_coupon_item_index_out_of_range_no_discount(client):
    """couponItemIndex вне диапазона позиций → купон не списывает напиток.

    coupon_item_price остаётся None → 422 COUPON_ITEM_REQUIRED.
    """
    cust = _new_customer(client, plate="ci 1")
    coupon_id = _earn_coupon(client, cust)
    body = {
        "items": [{"drinkId": _drink_id(client, "orange-fresh")}],
        "carPlate": "ci 1",
        "couponId": coupon_id,
        "couponItemIndex": 5,   # позиции с индексом 5 нет
    }
    r = _place(client, cust["headers"], body)
    assert r.status_code == 422
    assert r.json()["detail"] == "COUPON_ITEM_REQUIRED"


# ============================================================================
# GET /api/orders — список
# ============================================================================

def test_my_orders_list_contains_created(client, customer):
    order = make_order(client, customer)
    rows = client.get("/api/orders", headers=customer["headers"]).json()
    assert isinstance(rows, list)
    assert any(o["id"] == order["id"] for o in rows)


def test_my_orders_list_is_not_full_payload(client, customer):
    """Список отдаёт усечённый payload (full=False): без events/carPlate."""
    make_order(client, customer)
    rows = client.get("/api/orders", headers=customer["headers"]).json()
    assert rows, "ожидался хотя бы один заказ"
    row = rows[0]
    assert "events" not in row
    assert "carPlate" not in row
    assert "items" in row     # items остаются


def test_my_orders_ordered_desc_by_id(client):
    cust = _new_customer(client, plate="ord 1")
    o1 = make_order(client, cust)
    o2 = make_order(client, cust)
    rows = client.get("/api/orders", headers=cust["headers"]).json()
    ids = [r["id"] for r in rows]
    assert ids == sorted(ids, reverse=True)
    assert ids[0] == o2["id"]   # самый свежий первым


def test_my_orders_isolated_per_user(client):
    a = _new_customer(client, plate="iso a")
    b = _new_customer(client, plate="iso b")
    oa = make_order(client, a)
    rows_b = client.get("/api/orders", headers=b["headers"]).json()
    assert all(r["id"] != oa["id"] for r in rows_b)  # B не видит заказ A


def test_my_orders_401_without_token(client):
    assert client.get("/api/orders").status_code == 401


# ============================================================================
# GET /api/orders/{id} — деталка
# ============================================================================

def test_order_detail_happy(client, customer):
    order = make_order(client, customer)
    r = client.get(f"/api/orders/{order['id']}", headers=customer["headers"])
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] == order["id"]
    assert "events" in d and "carPlate" in d   # full payload
    assert "ratingPromptDue" in d
    assert d["ratingPromptDue"] is False        # только что приехал/не приехал


def test_order_detail_404_foreign(client, customer):
    order = make_order(client, customer)
    other = _new_customer(client, plate="f 1")
    r = client.get(f"/api/orders/{order['id']}", headers=other["headers"])
    assert r.status_code == 404
    assert r.json()["detail"] == "NOT_FOUND"


def test_order_detail_404_nonexistent(client, customer):
    r = client.get("/api/orders/99999999", headers=customer["headers"])
    assert r.status_code == 404


def test_order_detail_401_without_token(client, customer):
    order = make_order(client, customer)
    assert client.get(f"/api/orders/{order['id']}").status_code == 401


def test_order_detail_403_staff(client, customer, manager):
    order = make_order(client, customer)
    # staff-токен kind=staff → get_current_user отдаёт 403
    r = client.get(f"/api/orders/{order['id']}", headers=manager["headers"])
    assert r.status_code == 403


def test_rating_prompt_not_due_before_arrival(client, customer):
    order = make_order(client, customer)
    d = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    assert d["ratingPromptDue"] is False   # ещё не нажимал «я на месте»


# ============================================================================
# POST /api/orders/{id}/arrived
# ============================================================================

def test_arrived_happy_sets_flag(client, customer):
    order = make_order(client, customer)
    r = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["arrived"] is True
    assert body["status"] == "new"     # прибытие не двигает статус готовки
    # событие arrived записано
    assert any(e["type"] == "arrived" for e in body["events"])


def test_arrived_is_idempotent(client, customer):
    order = make_order(client, customer)
    h = customer["headers"]
    r1 = client.post(f"/api/orders/{order['id']}/arrived", headers=h)
    assert r1.status_code == 200
    r2 = client.post(f"/api/orders/{order['id']}/arrived", headers=h)
    assert r2.status_code == 200
    # второй вызов не плодит второе событие arrived
    arrived_events = [e for e in r2.json()["events"] if e["type"] == "arrived"]
    assert len(arrived_events) == 1


def test_arrived_409_not_paid(client, customer):
    """Заказ создан, но не оплачен → 409 ORDER_NOT_PAID."""
    r = _place(client, customer["headers"], _basic_body(client))
    assert r.status_code == 200
    oid = r.json()["id"]
    assert r.json()["paymentStatus"] == "pending"
    ra = client.post(f"/api/orders/{oid}/arrived", headers=customer["headers"])
    assert ra.status_code == 409
    assert ra.json()["detail"] == "ORDER_NOT_PAID"


def test_arrived_409_after_completed(client, customer, manager):
    """После выдачи (completed) «я на месте» запрещён → 409 ORDER_FINISHED."""
    order = make_order(client, customer)
    _advance_to_completed(client, manager["headers"], order["id"])
    r = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "ORDER_FINISHED"


def test_arrived_404_foreign(client, customer):
    order = make_order(client, customer)
    other = _new_customer(client, plate="far 1")
    r = client.post(f"/api/orders/{order['id']}/arrived", headers=other["headers"])
    assert r.status_code == 404


def test_arrived_404_nonexistent(client, customer):
    r = client.post("/api/orders/99999999/arrived", headers=customer["headers"])
    assert r.status_code == 404


def test_arrived_401_without_token(client, customer):
    order = make_order(client, customer)
    assert client.post(f"/api/orders/{order['id']}/arrived").status_code == 401


# ============================================================================
# POST /api/orders/{id}/rate
# ============================================================================

def test_rate_like_after_arrival(client, customer):
    order = make_order(client, customer)
    client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                    headers=customer["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["couponIssued"] is False
    assert body["couponId"] is None
    # рейтинг отразился в деталке
    d = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    assert d["rating"] == "like"


def test_rate_dislike_issues_coupon(client):
    cust = _new_customer(client, plate="dl 1")
    order = make_order(client, cust)
    client.post(f"/api/orders/{order['id']}/arrived", headers=cust["headers"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                    headers=cust["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["couponIssued"] is True
    assert isinstance(body["couponId"], int)
    # купон виден в реестре клиента и активен
    coupons = client.get("/api/coupons", headers=cust["headers"]).json()
    assert any(c["id"] == body["couponId"] and c["status"] == "active" for c in coupons)


def test_rate_like_after_completed_without_arrival(client, customer, manager):
    """completed разрешает оценку даже без флага «я на месте»."""
    order = make_order(client, customer)
    _advance_to_completed(client, manager["headers"], order["id"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                    headers=customer["headers"])
    assert r.status_code == 200, r.text


def test_rate_409_already_rated(client, customer):
    order = make_order(client, customer)
    client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
    assert client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                       headers=customer["headers"]).status_code == 200
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                    headers=customer["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "ALREADY_RATED"


def test_rate_409_not_ratable_before_arrival(client, customer):
    """Не приехал и не completed → 409 ORDER_NOT_RATABLE."""
    order = make_order(client, customer)
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                    headers=customer["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "ORDER_NOT_RATABLE"


def test_rate_422_invalid_enum_value(client, customer):
    """rating не в (like, dislike) → 422 (проверка ДО поиска заказа)."""
    order = make_order(client, customer)
    client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "love"},
                    headers=customer["headers"])
    assert r.status_code == 422
    assert r.json()["detail"] == "VALIDATION_ERROR"


def test_rate_422_missing_rating_field(client, customer):
    order = make_order(client, customer)
    r = client.post(f"/api/orders/{order['id']}/rate", json={}, headers=customer["headers"])
    assert r.status_code == 422   # rating обязателен (pydantic)


def test_rate_422_rating_wrong_type(client, customer):
    order = make_order(client, customer)
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": 123},
                    headers=customer["headers"])
    assert r.status_code == 422


def test_rate_422_invalid_enum_precedes_404(client, customer):
    """Невалидный rating на несуществующем заказе → 422 (а не 404)."""
    r = client.post("/api/orders/99999999/rate", json={"rating": "love"},
                    headers=customer["headers"])
    assert r.status_code == 422


def test_rate_404_foreign_valid_enum(client, customer):
    """Валидный rating на чужом заказе → 404 (проверка владения после enum)."""
    order = make_order(client, customer)
    client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
    other = _new_customer(client, plate="rf 1")
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                    headers=other["headers"])
    assert r.status_code == 404


def test_rate_404_nonexistent_valid_enum(client, customer):
    r = client.post("/api/orders/99999999/rate", json={"rating": "like"},
                    headers=customer["headers"])
    assert r.status_code == 404


def test_rate_401_without_token(client, customer):
    order = make_order(client, customer)
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"})
    assert r.status_code == 401


def test_rate_only_one_coupon_per_order(client):
    """Дизлайк выдаёт ровно один купон; повторная оценка невозможна (409)."""
    cust = _new_customer(client, plate="one 1")
    order = make_order(client, cust)
    client.post(f"/api/orders/{order['id']}/arrived", headers=cust["headers"])
    r1 = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                     headers=cust["headers"])
    assert r1.status_code == 200 and r1.json()["couponIssued"] is True
    # повтор — нельзя
    r2 = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                     headers=cust["headers"])
    assert r2.status_code == 409
    # в реестре ровно один купон, порождённый этим заказом
    coupons = client.get("/api/coupons", headers=cust["headers"]).json()
    from_order = [c for c in coupons if c["sourceOrderId"] == order["id"]]
    assert len(from_order) == 1


# ----------------------------------------------------------------------------
# helper: заработать активный купон (дизлайк за выданный заказ)
# ----------------------------------------------------------------------------

def _earn_coupon(client, cust):
    """Создаёт заказ, помечает прибытие и ставит дизлайк → возвращает couponId."""
    order = make_order(client, cust)
    client.post(f"/api/orders/{order['id']}/arrived", headers=cust["headers"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                    headers=cust["headers"])
    assert r.status_code == 200, r.text
    cid = r.json()["couponId"]
    assert cid is not None
    return cid
