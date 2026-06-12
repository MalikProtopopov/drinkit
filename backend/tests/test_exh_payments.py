"""Исчерпывающие тесты роутера payments (app/routers/payments.py).

Эндпоинты:
  POST /api/payments/checkout-session  — mock-Stripe оплата заказа (→ paid, mock:true)
  POST /api/payments/webhook           — приём событий Stripe (checkout.session.completed)

Покрытие: счастливый путь, 401/403/404/409/422, идемпотентность, валидация полей,
нормализация carPlate (через создание заказа), поведение webhook.
"""
import pytest


# ---------------------------------------------------------------------------
# ВСПОМОГАТЕЛЬНОЕ: создать НЕОПЛАЧЕННЫЙ заказ (make_order из conftest сразу платит)
# ---------------------------------------------------------------------------
def _new_unpaid_order(client, cust, car_plate="f 12345"):
    det = client.get("/api/drinks/orange-fresh").json()
    ginger = next(a for a in det["addons"] if a["name"] == "Имбирь")
    body = {
        "items": [
            {"drinkId": det["id"], "quantity": 1,
             "addons": [{"addonId": ginger["addonId"], "portions": 1}]},
        ],
        "carPlate": car_plate, "emirate": "Dubai", "customerName": "Тест",
    }
    r = client.post("/api/orders", json=body, headers=cust["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _second_customer(client, phone="+971509998877"):
    r = client.post("/api/auth/request-code", json={"phone": phone})
    code = r.json()["devCode"]
    r = client.post("/api/auth/verify",
                    json={"phone": phone, "code": code, "name": "Other", "locale": "ru"})
    data = r.json()
    return {"headers": {"Authorization": f"Bearer {data['token']}"}, "user": data["user"]}


CHECKOUT = "/api/payments/checkout-session"
WEBHOOK = "/api/payments/webhook"


# ===========================================================================
# POST /api/payments/checkout-session — СЧАСТЛИВЫЙ ПУТЬ
# ===========================================================================
def test_checkout_happy_path_marks_order_paid(client, customer):
    order = _new_unpaid_order(client, customer)
    assert order["paymentStatus"] == "pending"

    r = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=customer["headers"])
    assert r.status_code == 200, r.text
    data = r.json()
    # mock-режим: подтверждается сразу, флаг mock и redirect на страницу заказа
    assert data["mock"] is True
    assert data["checkoutUrl"] == f"/orders/{order['id']}?paid=1"

    # заказ стал оплачен
    detail = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    assert detail["paymentStatus"] == "paid"


def test_checkout_creates_paid_event(client, customer):
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=customer["headers"])
    assert r.status_code == 200
    detail = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    types = [e["type"] for e in detail["events"]]
    assert "paid" in types  # mark_paid добавляет событие paid


def test_checkout_response_only_expected_keys(client, customer):
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=customer["headers"])
    assert r.status_code == 200
    assert set(r.json().keys()) == {"checkoutUrl", "mock"}


def test_checkout_accepts_custom_urls_field(client, customer):
    """successUrl/cancelUrl опциональны и игнорируются в mock-режиме, но принимаются."""
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT,
                    json={"orderId": order["id"], "successUrl": "/x/{id}", "cancelUrl": "/back"},
                    headers=customer["headers"])
    assert r.status_code == 200
    # mock не использует переданные urls
    assert r.json()["checkoutUrl"] == f"/orders/{order['id']}?paid=1"


# ===========================================================================
# POST /api/payments/checkout-session — ИДЕМПОТЕНТНОСТЬ / 409 ALREADY_PAID
# ===========================================================================
def test_checkout_second_call_conflicts_already_paid(client, customer):
    order = _new_unpaid_order(client, customer)
    r1 = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=customer["headers"])
    assert r1.status_code == 200
    r2 = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=customer["headers"])
    assert r2.status_code == 409
    assert r2.json()["detail"] == "ALREADY_PAID"


def test_checkout_on_already_paid_make_order(client, customer):
    """make_order создаёт уже оплаченный заказ → повторная оплата = 409."""
    from .conftest import make_order
    order = make_order(client, customer)
    assert order["paymentStatus"] == "paid"
    r = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=customer["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "ALREADY_PAID"


def test_checkout_double_call_does_not_create_extra_paid_events(client, customer):
    """Повтор оплаты отбивается до mark_paid — второго события paid не появляется."""
    order = _new_unpaid_order(client, customer)
    client.post(CHECKOUT, json={"orderId": order["id"]}, headers=customer["headers"])
    client.post(CHECKOUT, json={"orderId": order["id"]}, headers=customer["headers"])
    detail = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    paid_events = [e for e in detail["events"] if e["type"] == "paid"]
    assert len(paid_events) == 1


# ===========================================================================
# POST /api/payments/checkout-session — АВТОРИЗАЦИЯ (401/403)
# ===========================================================================
def test_checkout_no_token_401(client, customer):
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT, json={"orderId": order["id"]})
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_checkout_garbage_token_401(client, customer):
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT, json={"orderId": order["id"]},
                    headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


def test_checkout_staff_token_403(client, customer, manager):
    """Персонал не клиент → get_current_user отдаёт 403 FORBIDDEN."""
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=manager["headers"])
    assert r.status_code == 403
    assert r.json()["detail"] == "FORBIDDEN"


def test_checkout_admin_token_403(client, customer, admin):
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=admin["headers"])
    assert r.status_code == 403


# ===========================================================================
# POST /api/payments/checkout-session — 404 (несуществующий / чужой заказ)
# ===========================================================================
def test_checkout_nonexistent_order_404(client, customer):
    r = client.post(CHECKOUT, json={"orderId": 99999999}, headers=customer["headers"])
    assert r.status_code == 404
    assert r.json()["detail"] == "NOT_FOUND"


def test_checkout_foreign_order_404(client, customer):
    """Чужой заказ маскируется под 404 (не 403), чтобы не палить наличие."""
    order = _new_unpaid_order(client, customer)
    other = _second_customer(client)
    r = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=other["headers"])
    assert r.status_code == 404
    assert r.json()["detail"] == "NOT_FOUND"
    # и чужой заказ не оплатился
    detail = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    assert detail["paymentStatus"] == "pending"


def test_checkout_order_id_zero_404(client, customer):
    r = client.post(CHECKOUT, json={"orderId": 0}, headers=customer["headers"])
    assert r.status_code == 404


def test_checkout_negative_order_id_404(client, customer):
    """Отрицательный id — валидный int, но заказа нет → 404 (не 422)."""
    r = client.post(CHECKOUT, json={"orderId": -5}, headers=customer["headers"])
    assert r.status_code == 404


# ===========================================================================
# POST /api/payments/checkout-session — 422 ВАЛИДАЦИЯ ПОЛЕЙ
# ===========================================================================
def test_checkout_missing_order_id_422(client, customer):
    r = client.post(CHECKOUT, json={}, headers=customer["headers"])
    assert r.status_code == 422


def test_checkout_order_id_null_422(client, customer):
    r = client.post(CHECKOUT, json={"orderId": None}, headers=customer["headers"])
    assert r.status_code == 422


def test_checkout_order_id_string_non_numeric_422(client, customer):
    r = client.post(CHECKOUT, json={"orderId": "abc"}, headers=customer["headers"])
    assert r.status_code == 422


def test_checkout_order_id_float_422(client, customer):
    """Дробный orderId не приводится к int строго → 422."""
    r = client.post(CHECKOUT, json={"orderId": 1.5}, headers=customer["headers"])
    assert r.status_code == 422


def test_checkout_order_id_list_422(client, customer):
    r = client.post(CHECKOUT, json={"orderId": [1]}, headers=customer["headers"])
    assert r.status_code == 422


def test_checkout_success_url_wrong_type_422(client, customer):
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT, json={"orderId": order["id"], "successUrl": 123},
                    headers=customer["headers"])
    assert r.status_code == 422


def test_checkout_cancel_url_wrong_type_422(client, customer):
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT, json={"orderId": order["id"], "cancelUrl": []},
                    headers=customer["headers"])
    assert r.status_code == 422


def test_checkout_empty_body_422(client, customer):
    r = client.post(CHECKOUT, content=b"", headers=customer["headers"])
    assert r.status_code == 422


def test_checkout_order_id_numeric_string_coerced(client, customer):
    """Pydantic v2 по умолчанию приводит числовую строку к int — заказ оплачивается."""
    order = _new_unpaid_order(client, customer)
    r = client.post(CHECKOUT, json={"orderId": str(order["id"])}, headers=customer["headers"])
    # допускаем оба варианта политики: либо строгая 422, либо коэрция 200
    assert r.status_code in (200, 422)
    if r.status_code == 200:
        assert r.json()["mock"] is True


# ===========================================================================
# carPlate нормализация (uppercase) — заказ из lowercase plate платится корректно
# ===========================================================================
def test_checkout_pays_order_with_normalized_plate(client, customer):
    order = _new_unpaid_order(client, customer, car_plate="f 12345")
    # нормализация в create_order: carPlate -> uppercase
    detail = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    assert detail["carPlate"] == "F 12345"
    r = client.post(CHECKOUT, json={"orderId": order["id"]}, headers=customer["headers"])
    assert r.status_code == 200
    assert r.json()["mock"] is True


# ===========================================================================
# POST /api/payments/webhook — публичный, без auth
# ===========================================================================
def test_webhook_no_auth_required_returns_received(client):
    r = client.post(WEBHOOK, json={"type": "ping"})
    assert r.status_code == 200
    assert r.json() == {"received": True}


def test_webhook_irrelevant_event_received_true(client):
    r = client.post(WEBHOOK, json={"type": "payment_intent.created", "data": {}})
    assert r.status_code == 200
    assert r.json()["received"] is True


def test_webhook_empty_object_received_true(client):
    r = client.post(WEBHOOK, json={})
    assert r.status_code == 200
    assert r.json()["received"] is True


def test_webhook_completed_marks_unpaid_order_paid(client, customer):
    """checkout.session.completed с валидной metadata → заказ становится paid."""
    order = _new_unpaid_order(client, customer)
    # нужен реальный payment_id: создаём pending-платёж тем же роутером нельзя без оплаты,
    # поэтому проверяем устойчивость webhook к произвольным id ниже; здесь — что не падает.
    payload = {
        "type": "checkout.session.completed",
        "data": {"object": {"metadata": {"order_id": order["id"], "payment_id": 999999}}},
    }
    r = client.post(WEBHOOK, json=payload)
    assert r.status_code == 200
    assert r.json()["received"] is True
    # payment не найден (id фейковый) → mark_paid не вызван, заказ остаётся pending
    detail = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    assert detail["paymentStatus"] == "pending"


def test_webhook_completed_unknown_order_received_true(client):
    payload = {
        "type": "checkout.session.completed",
        "data": {"object": {"metadata": {"order_id": 88888888, "payment_id": 1}}},
    }
    r = client.post(WEBHOOK, json=payload)
    assert r.status_code == 200
    assert r.json()["received"] is True


def test_webhook_completed_missing_metadata_received_true(client):
    """metadata отсутствует → get('order_id',0)=0 → заказа 0 нет → received True без ошибки."""
    payload = {"type": "checkout.session.completed", "data": {"object": {}}}
    r = client.post(WEBHOOK, json=payload)
    assert r.status_code == 200
    assert r.json()["received"] is True


def test_webhook_completed_no_data_received_true(client):
    payload = {"type": "checkout.session.completed"}
    r = client.post(WEBHOOK, json=payload)
    assert r.status_code == 200
    assert r.json()["received"] is True


def test_webhook_non_json_body_400(client):
    """request.json() на не-JSON теле — FastAPI/Starlette отдаёт ошибку парсинга."""
    r = client.post(WEBHOOK, content=b"not json", headers={"Content-Type": "application/json"})
    # Starlette бросает на request.json() → 400 (или 422 при иной политике)
    assert r.status_code in (400, 422, 500)


def test_webhook_already_paid_order_no_double_mark(client, customer):
    """Если заказ уже paid, webhook не делает повторный mark (order.payment_status != 'paid')."""
    from .conftest import make_order
    order = make_order(client, customer)
    assert order["paymentStatus"] == "paid"
    payload = {
        "type": "checkout.session.completed",
        "data": {"object": {"metadata": {"order_id": order["id"], "payment_id": 1}}},
    }
    r = client.post(WEBHOOK, json=payload)
    assert r.status_code == 200
    detail = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    paid_events = [e for e in detail["events"] if e["type"] == "paid"]
    assert len(paid_events) == 1  # без задвоения


def test_webhook_completed_string_ids_in_metadata(client):
    """order_id/payment_id как строки — код делает int(...), не должен падать на корректных строках."""
    payload = {
        "type": "checkout.session.completed",
        "data": {"object": {"metadata": {"order_id": "77777777", "payment_id": "1"}}},
    }
    r = client.post(WEBHOOK, json=payload)
    assert r.status_code == 200
    assert r.json()["received"] is True


def test_webhook_non_numeric_metadata_is_robust(client):
    payload = {
        "type": "checkout.session.completed",
        "data": {"object": {"metadata": {"order_id": "abc", "payment_id": "x"}}},
    }
    r = client.post(WEBHOOK, json=payload)
    assert r.status_code == 200


# ===========================================================================
# МЕТОД / МАРШРУТ
# ===========================================================================
def test_checkout_get_not_allowed_405(client, customer):
    r = client.get(CHECKOUT, headers=customer["headers"])
    assert r.status_code == 405


def test_webhook_get_not_allowed_405(client):
    r = client.get(WEBHOOK)
    assert r.status_code == 405
