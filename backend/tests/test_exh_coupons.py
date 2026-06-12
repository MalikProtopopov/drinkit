"""Исчерпывающие тесты домена COUPONS (купоны за дизлайк).

Покрывает все эндпоинты, затрагивающие купоны:
  - GET  /api/coupons                         — список купонов клиента (coupons.py)
  - POST /api/orders/{id}/rate                — выдача купона за дизлайк (orders.py)
  - POST /api/orders   (couponId/Index)       — применение купона в заказе (order_flow.py)
  - GET  /api/admin/coupons                   — реестр купонов (super_admin)
  - POST /api/admin/coupons/{id}/void         — аннулирование купона (super_admin)

Жизненный цикл купона: active -> used (после оплаты заказа с купоном) | void (аннулирование).
Купон выдаётся ровно один на заказ с оценкой 👎; списывает 1 выбранный напиток.

НЕ меняет conftest.py и существующие тесты. Использует существующие фикстуры
(client, customer, manager, admin, make_order) и создаёт собственных пользователей
через OTP-флоу для проверки изоляции между клиентами.
"""
import uuid

import pytest

from .conftest import make_order

DRINK_SLUG = "orange-fresh"


# --------------------------------------------------------------------------- #
# Локальные хелперы (без правки conftest)                                      #
# --------------------------------------------------------------------------- #

def _new_phone() -> str:
    """Уникальный валидный E.164 номер (+ и 9..15 цифр) на каждый вызов."""
    return "+9715" + uuid.uuid4().int.__str__()[:8]


def _new_customer(client, locale: str = "ru") -> dict:
    """Свежий авторизованный клиент через OTP-флоу (OTP включён в conftest)."""
    phone = _new_phone()
    code = client.post("/api/auth/request-code", json={"phone": phone}).json()["devCode"]
    r = client.post("/api/auth/verify",
                    json={"phone": phone, "code": code, "name": "Купонщик", "locale": locale})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"headers": {"Authorization": f"Bearer {data['token']}"},
            "user": data["user"], "phone": phone}


def _drink_id(client) -> int:
    return client.get(f"/api/drinks/{DRINK_SLUG}").json()["id"]


def _place_simple(client, cust, *, plate="A 1", coupon_id=None, coupon_item_index=None,
                  quantity=1, items=None):
    """Создать заказ из одного напитка (по умолчанию) — без оплаты."""
    if items is None:
        items = [{"drinkId": _drink_id(client), "quantity": quantity}]
    body = {"items": items, "carPlate": plate, "emirate": "Dubai"}
    if coupon_id is not None:
        body["couponId"] = coupon_id
        body["couponItemIndex"] = coupon_item_index
    return client.post("/api/orders", json=body, headers=cust["headers"])


def _pay(client, cust, order_id):
    r = client.post("/api/payments/checkout-session", json={"orderId": order_id},
                    headers=cust["headers"])
    assert r.status_code == 200, r.text
    return r


def _complete(client, manager, order_id):
    """Провести заказ менеджером до completed (new->in_progress->ready->completed)."""
    assert client.post(f"/api/admin/orders/{order_id}/take",
                       headers=manager["headers"]).status_code == 200
    assert client.post(f"/api/admin/orders/{order_id}/status", json={"status": "ready"},
                       headers=manager["headers"]).status_code == 200
    assert client.post(f"/api/admin/orders/{order_id}/status", json={"status": "completed"},
                       headers=manager["headers"]).status_code == 200


def _issue_coupon(client, cust, manager) -> int:
    """Полный путь до активного купона: заказ -> оплата -> прибытие -> completed -> дизлайк."""
    r = _place_simple(client, cust)
    assert r.status_code == 200, r.text
    order = r.json()
    _pay(client, cust, order["id"])
    assert client.post(f"/api/orders/{order['id']}/arrived",
                       headers=cust["headers"]).status_code == 200
    _complete(client, manager, order["id"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                    headers=cust["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["couponIssued"] is True
    assert body["couponId"] is not None
    return body["couponId"]


# --------------------------------------------------------------------------- #
# GET /api/coupons — список купонов клиента                                    #
# --------------------------------------------------------------------------- #

def test_my_coupons_requires_auth(client):
    """401 без токена."""
    r = client.get("/api/coupons")
    assert r.status_code == 401


def test_my_coupons_forbidden_for_staff(client, manager, admin):
    """403: staff-токен не годится для клиентского эндпоинта (kind != customer)."""
    assert client.get("/api/coupons", headers=manager["headers"]).status_code == 403
    assert client.get("/api/coupons", headers=admin["headers"]).status_code == 403


def test_my_coupons_empty_for_fresh_user(client):
    """Свежий пользователь без дизлайков — пустой список (а не 404/ошибка)."""
    cust = _new_customer(client)
    r = client.get("/api/coupons", headers=cust["headers"])
    assert r.status_code == 200
    assert r.json() == []


def test_my_coupons_payload_shape(client, manager):
    """Форма ответа: id/status/issuedAt/sourceOrderId/usedOrderId/discountAmount."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    rows = client.get("/api/coupons", headers=cust["headers"]).json()
    row = next(c for c in rows if c["id"] == cid)
    assert set(row) == {"id", "status", "issuedAt", "sourceOrderId",
                        "usedOrderId", "discountAmount"}
    assert row["status"] == "active"
    assert row["issuedAt"] is not None
    assert row["sourceOrderId"] is not None
    assert row["usedOrderId"] is None        # ещё не использован
    assert row["discountAmount"] is None      # сумма фиксируется только при использовании


def test_my_coupons_only_own(client, manager):
    """Изоляция: клиент видит только свои купоны, не чужие."""
    a = _new_customer(client)
    b = _new_customer(client)
    cid_a = _issue_coupon(client, a, manager)
    cid_b = _issue_coupon(client, b, manager)

    ids_a = [c["id"] for c in client.get("/api/coupons", headers=a["headers"]).json()]
    ids_b = [c["id"] for c in client.get("/api/coupons", headers=b["headers"]).json()]
    assert cid_a in ids_a and cid_a not in ids_b
    assert cid_b in ids_b and cid_b not in ids_a


def test_my_coupons_ordered_desc(client, manager):
    """Сортировка по id убыванием (новые сверху)."""
    cust = _new_customer(client)
    c1 = _issue_coupon(client, cust, manager)
    c2 = _issue_coupon(client, cust, manager)
    ids = [c["id"] for c in client.get("/api/coupons", headers=cust["headers"]).json()]
    assert ids == sorted(ids, reverse=True)
    assert ids.index(c2) < ids.index(c1)  # c2 новее -> раньше в списке


# --------------------------------------------------------------------------- #
# POST /api/orders/{id}/rate — выдача купона за дизлайк                        #
# --------------------------------------------------------------------------- #

def test_rate_requires_auth(client, customer):
    order = make_order(client, customer)
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"})
    assert r.status_code == 401


def test_rate_foreign_order_404(client, manager):
    """Чужой/несуществующий заказ — 404 (не раскрываем существование)."""
    a = _new_customer(client)
    b = _new_customer(client)
    order = _place_simple(client, a).json()
    _pay(client, a, order["id"])
    # b не владеет заказом a
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                    headers=b["headers"])
    assert r.status_code == 404
    # вовсе несуществующий
    r = client.post("/api/orders/99999999/rate", json={"rating": "like"},
                    headers=a["headers"])
    assert r.status_code == 404


def test_rate_invalid_enum_422(client, customer):
    """rating вне {like,dislike} -> 422."""
    order = make_order(client, customer)
    client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "love"},
                    headers=customer["headers"])
    assert r.status_code == 422


def test_rate_empty_string_422(client, customer):
    """Пустая строка rating -> 422."""
    order = make_order(client, customer)
    client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": ""},
                    headers=customer["headers"])
    assert r.status_code == 422


def test_rate_missing_field_422(client, customer):
    """Отсутствует обязательное поле rating -> 422 (pydantic)."""
    order = make_order(client, customer)
    r = client.post(f"/api/orders/{order['id']}/rate", json={}, headers=customer["headers"])
    assert r.status_code == 422


def test_rate_wrong_type_422(client, customer):
    """rating неверного типа (число) -> 422."""
    order = make_order(client, customer)
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": 123},
                    headers=customer["headers"])
    assert r.status_code == 422


def test_rate_before_arrival_409(client):
    """Оценка до прибытия и до выдачи -> 409 ORDER_NOT_RATABLE, купон не выдаётся."""
    cust = _new_customer(client)
    order = _place_simple(client, cust).json()
    _pay(client, cust, order["id"])  # оплачен, но не arrived и не completed
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                    headers=cust["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "ORDER_NOT_RATABLE"
    assert client.get("/api/coupons", headers=cust["headers"]).json() == []


def test_rate_dislike_issues_coupon(client, manager):
    """Дизлайк -> ровно один активный купон, привязанный к заказу-источнику."""
    cust = _new_customer(client)
    order = _place_simple(client, cust).json()
    _pay(client, cust, order["id"])
    client.post(f"/api/orders/{order['id']}/arrived", headers=cust["headers"])
    _complete(client, manager, order["id"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                    headers=cust["headers"])
    assert r.status_code == 200
    body = r.json()
    assert body == {"ok": True, "couponIssued": True, "couponId": body["couponId"]}
    coupons = client.get("/api/coupons", headers=cust["headers"]).json()
    issued = next(c for c in coupons if c["id"] == body["couponId"])
    assert issued["status"] == "active"
    assert issued["sourceOrderId"] == order["id"]


def test_rate_like_no_coupon(client, manager):
    """Лайк -> купон НЕ выдаётся."""
    cust = _new_customer(client)
    order = _place_simple(client, cust).json()
    _pay(client, cust, order["id"])
    client.post(f"/api/orders/{order['id']}/arrived", headers=cust["headers"])
    _complete(client, manager, order["id"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                    headers=cust["headers"])
    assert r.status_code == 200
    assert r.json()["couponIssued"] is False
    assert r.json()["couponId"] is None
    assert client.get("/api/coupons", headers=cust["headers"]).json() == []


def test_rate_after_arrival_without_completion_issues_coupon(client):
    """Прибыл, но не выдан — оценка разрешена (модалка по таймауту), дизлайк даёт купон."""
    cust = _new_customer(client)
    order = _place_simple(client, cust).json()
    _pay(client, cust, order["id"])
    client.post(f"/api/orders/{order['id']}/arrived", headers=cust["headers"])
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                    headers=cust["headers"])
    assert r.status_code == 200
    assert r.json()["couponIssued"] is True


def test_rate_twice_conflict_no_second_coupon(client, manager):
    """Повторная оценка -> 409 ALREADY_RATED; второй купон не выдаётся (идемпотентность выдачи)."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    order_source = next(c for c in client.get("/api/coupons", headers=cust["headers"]).json()
                        if c["id"] == cid)["sourceOrderId"]
    r = client.post(f"/api/orders/{order_source}/rate", json={"rating": "like"},
                    headers=cust["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "ALREADY_RATED"
    # как был один купон, так и остался
    assert sum(1 for c in client.get("/api/coupons", headers=cust["headers"]).json()
               if c["sourceOrderId"] == order_source) == 1


# --------------------------------------------------------------------------- #
# POST /api/orders (couponId/couponItemIndex) — применение купона             #
# --------------------------------------------------------------------------- #

def test_apply_coupon_happy_path(client, manager):
    """Счастливый путь: скидка == цене выбранного напитка; total = subtotal - discount."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    r = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0,
                      items=[{"drinkId": _drink_id(client), "quantity": 1}])
    assert r.status_code == 200, r.text
    o = r.json()
    assert o["couponDiscount"] > 0
    assert o["couponDiscount"] == o["items"][0]["unitPrice"]
    assert o["items"][0]["paidByCoupon"] is True
    assert o["total"] == round(o["subtotal"] - o["couponDiscount"], 2)


def test_apply_coupon_becomes_used_after_payment(client, manager):
    """Купон переходит active -> used только ПОСЛЕ оплаты; фиксируются usedOrderId/discountAmount."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    o = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0).json()

    # до оплаты — всё ещё active
    before = next(c for c in client.get("/api/coupons", headers=cust["headers"]).json()
                  if c["id"] == cid)
    assert before["status"] == "active"
    assert before["usedOrderId"] is None

    _pay(client, cust, o["id"])

    after = next(c for c in client.get("/api/coupons", headers=cust["headers"]).json()
                 if c["id"] == cid)
    assert after["status"] == "used"
    assert after["usedOrderId"] == o["id"]
    assert after["discountAmount"] == o["couponDiscount"]


def test_apply_used_coupon_conflict(client, manager):
    """Повторное применение уже использованного купона -> 409 COUPON_INVALID."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    o = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0).json()
    _pay(client, cust, o["id"])  # used
    r = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0)
    assert r.status_code == 409
    assert r.json()["detail"] == "COUPON_INVALID"


def test_apply_void_coupon_conflict(client, manager, admin):
    """Аннулированный купон применить нельзя -> 409 COUPON_INVALID."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    assert client.post(f"/api/admin/coupons/{cid}/void",
                       headers=admin["headers"]).status_code == 200
    r = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0)
    assert r.status_code == 409
    assert r.json()["detail"] == "COUPON_INVALID"


def test_apply_nonexistent_coupon_conflict(client):
    """Несуществующий купон -> 409 COUPON_INVALID."""
    cust = _new_customer(client)
    r = _place_simple(client, cust, coupon_id=99999999, coupon_item_index=0)
    assert r.status_code == 409
    assert r.json()["detail"] == "COUPON_INVALID"


def test_apply_foreign_coupon_conflict(client, manager):
    """Чужой купон применить нельзя -> 409 COUPON_INVALID (изоляция владельца)."""
    owner = _new_customer(client)
    thief = _new_customer(client)
    cid = _issue_coupon(client, owner, manager)
    r = _place_simple(client, thief, coupon_id=cid, coupon_item_index=0)
    assert r.status_code == 409
    assert r.json()["detail"] == "COUPON_INVALID"
    # купон владельца не тронут
    assert next(c for c in client.get("/api/coupons", headers=owner["headers"]).json()
                if c["id"] == cid)["status"] == "active"


def test_apply_coupon_without_item_index_422(client, manager):
    """couponId без couponItemIndex -> 422 COUPON_ITEM_REQUIRED (напиток выбирает клиент)."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    body = {"items": [{"drinkId": _drink_id(client), "quantity": 1}],
            "carPlate": "A 1", "couponId": cid}  # без couponItemIndex
    r = client.post("/api/orders", json=body, headers=cust["headers"])
    assert r.status_code == 422
    assert r.json()["detail"] == "COUPON_ITEM_REQUIRED"


def test_apply_coupon_item_index_out_of_range_422(client, manager):
    """couponItemIndex вне диапазона позиций -> 422 COUPON_ITEM_REQUIRED."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    r = _place_simple(client, cust, coupon_id=cid, coupon_item_index=5)  # только 1 позиция
    assert r.status_code == 422
    assert r.json()["detail"] == "COUPON_ITEM_REQUIRED"


def test_apply_coupon_negative_item_index_422(client, manager):
    """Отрицательный индекс не должен «подхватываться» python-индексацией -> 422."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    r = _place_simple(client, cust, coupon_id=cid, coupon_item_index=-1)
    assert r.status_code == 422
    assert r.json()["detail"] == "COUPON_ITEM_REQUIRED"


def test_item_index_without_coupon_marks_item_no_discount(client):
    """couponItemIndex без couponId: позиция помечается paidByCoupon, но скидки нет (0)."""
    cust = _new_customer(client)
    r = _place_simple(client, cust, items=[{"drinkId": _drink_id(client), "quantity": 1}],
                      coupon_id=None)
    # отдельный путь: index есть, coupon нет
    body = {"items": [{"drinkId": _drink_id(client), "quantity": 1}],
            "carPlate": "A 1", "couponItemIndex": 0}
    r = client.post("/api/orders", json=body, headers=cust["headers"])
    assert r.status_code == 200
    o = r.json()
    assert o["items"][0]["paidByCoupon"] is True
    assert o["couponDiscount"] == 0


def test_apply_coupon_wrong_type_422(client, manager):
    """couponId неверного типа (строка) -> 422 (pydantic)."""
    cust = _new_customer(client)
    body = {"items": [{"drinkId": _drink_id(client), "quantity": 1}],
            "carPlate": "A 1", "couponId": "abc", "couponItemIndex": 0}
    r = client.post("/api/orders", json=body, headers=cust["headers"])
    assert r.status_code == 422


def test_apply_coupon_cannot_double_book_unpaid_orders(client, manager):
    """Один купон не должен давать скидку сразу двум неоплаченным заказам."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    o1 = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0)
    assert o1.status_code == 200 and o1.json()["couponDiscount"] > 0
    # второй неоплаченный заказ с тем же ещё-active купоном должен быть отклонён
    o2 = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0)
    assert o2.status_code == 409, (
        f"купон применился дважды до оплаты: discount={o2.json().get('couponDiscount')}")


# --------------------------------------------------------------------------- #
# GET /api/admin/coupons — реестр купонов (super_admin)                        #
# --------------------------------------------------------------------------- #

def test_admin_coupons_requires_auth(client):
    assert client.get("/api/admin/coupons").status_code == 401


def test_admin_coupons_forbidden_for_manager(client, manager):
    """Реестр купонов — только super_admin; manager -> 403."""
    assert client.get("/api/admin/coupons", headers=manager["headers"]).status_code == 403


def test_admin_coupons_forbidden_for_customer(client, customer):
    """Клиентский токен -> 403 на админ-эндпоинте."""
    assert client.get("/api/admin/coupons", headers=customer["headers"]).status_code == 403


def test_admin_coupons_registry_lists_with_full_fields(client, manager, admin):
    """Super_admin видит купон в реестре со всеми полями; used-купон имеет usedItemId/discount."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    o = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0).json()
    _pay(client, cust, o["id"])

    rows = client.get("/api/admin/coupons", headers=admin["headers"]).json()
    row = next(c for c in rows if c["id"] == cid)
    assert set(row) == {"id", "userId", "status", "sourceOrderId", "usedOrderId",
                        "usedItemId", "discountAmount", "issuedAt", "usedAt"}
    assert row["status"] == "used"
    assert row["userId"] == cust["user"]["id"]
    assert row["usedOrderId"] == o["id"]
    assert row["usedItemId"] is not None
    assert row["discountAmount"] > 0
    assert row["usedAt"] is not None


# --------------------------------------------------------------------------- #
# POST /api/admin/coupons/{id}/void — аннулирование (super_admin)             #
# --------------------------------------------------------------------------- #

def test_void_requires_auth(client):
    assert client.post("/api/admin/coupons/1/void").status_code == 401


def test_void_forbidden_for_manager(client, manager, admin):
    """Void — только super_admin; manager -> 403 (и купон не меняется)."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    assert client.post(f"/api/admin/coupons/{cid}/void",
                       headers=manager["headers"]).status_code == 403
    # подтверждаем, что статус не изменился
    row = next(c for c in client.get("/api/admin/coupons", headers=admin["headers"]).json()
               if c["id"] == cid)
    assert row["status"] == "active"


def test_void_forbidden_for_customer(client, customer):
    assert client.post("/api/admin/coupons/1/void",
                       headers=customer["headers"]).status_code == 403


def test_void_missing_coupon_404(client, admin):
    assert client.post("/api/admin/coupons/99999999/void",
                       headers=admin["headers"]).status_code == 404


def test_void_active_coupon_happy_path(client, manager, admin):
    """Активный купон -> void; виден аннулированным и клиенту, и в реестре."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    r = client.post(f"/api/admin/coupons/{cid}/void", headers=admin["headers"])
    assert r.status_code == 200
    assert r.json()["status"] == "void"
    assert next(c for c in client.get("/api/coupons", headers=cust["headers"]).json()
                if c["id"] == cid)["status"] == "void"


def test_void_twice_conflict(client, manager, admin):
    """Повторный void уже аннулированного -> 409 COUPON_NOT_ACTIVE (идемпотентность отказа)."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    assert client.post(f"/api/admin/coupons/{cid}/void",
                       headers=admin["headers"]).status_code == 200
    r = client.post(f"/api/admin/coupons/{cid}/void", headers=admin["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "COUPON_NOT_ACTIVE"


def test_void_used_coupon_conflict(client, manager, admin):
    """Использованный купон нельзя аннулировать -> 409 COUPON_NOT_ACTIVE."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    o = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0).json()
    _pay(client, cust, o["id"])  # used
    r = client.post(f"/api/admin/coupons/{cid}/void", headers=admin["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "COUPON_NOT_ACTIVE"


def test_voided_coupon_not_applicable(client, manager, admin):
    """После void купон нельзя применить в заказе -> 409 COUPON_INVALID."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    client.post(f"/api/admin/coupons/{cid}/void", headers=admin["headers"])
    r = _place_simple(client, cust, coupon_id=cid, coupon_item_index=0)
    assert r.status_code == 409
    assert r.json()["detail"] == "COUPON_INVALID"


# --------------------------------------------------------------------------- #
# Нормализация смежных полей в потоке применения купона                        #
# --------------------------------------------------------------------------- #

def test_carplate_uppercased_in_coupon_order(client, manager):
    """carPlate нормализуется в верхний регистр при оформлении заказа с купоном."""
    cust = _new_customer(client)
    cid = _issue_coupon(client, cust, manager)
    r = _place_simple(client, cust, plate="dxb 7z", coupon_id=cid, coupon_item_index=0)
    assert r.status_code == 200
    assert r.json()["carPlate"] == "DXB 7Z"


def test_locale_en_normalized_to_ru_for_coupon_owner(client):
    """locale 'en' (вне {ru,ar}) нормализуется к дефолту 'ru' при регистрации владельца купона."""
    cust = _new_customer(client, locale="en")
    assert cust["user"]["locale"] == "ru"
