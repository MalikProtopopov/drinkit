"""Исчерпывающие тесты WebSocket-роутера (app/routers/ws.py, domain="ws").

Эндпоинты:
  WS /ws/orders/{order_id}  — канал статуса конкретного заказа клиенту (PUB-A-03 AC5)
  WS /ws/admin/orders       — общая лента заказов админке (ADM-M-03 AC2)

АВТОРИЗАЦИЯ (после фикса B13–B15): токен передаётся query-параметром ?token=<jwt>.
  - /ws/orders/{id}: открывается только владельцу заказа (customer) ИЛИ персоналу (staff);
    без токена / чужому / на несуществующий заказ → close 1008.
  - /ws/admin/orders: только staff; без токена / клиенту → close 1008.

Сообщение order:{id}:   {orderId, status, paymentStatus, arrived}
Сообщение admin:orders: {orderId, status, paymentStatus, arrived, number}

Не меняем conftest.py. Используем фикстуры: client, customer, manager, admin, make_order.
"""
import time
import uuid

import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.pubsub import pubsub
from .conftest import make_order


# ----------------------------------------------------------------------------
# Хелперы
# ----------------------------------------------------------------------------

def _tok(actor: dict) -> str:
    """JWT из фикстуры/словаря с headers (customer/manager/admin)."""
    return actor["headers"]["Authorization"].split(" ", 1)[1]


def _ourl(order_id, actor: dict) -> str:
    return f"/ws/orders/{order_id}?token={_tok(actor)}"


def _aurl(staff: dict) -> str:
    return f"/ws/admin/orders?token={_tok(staff)}"


def _new_customer(client, name="WS", locale="ru"):
    """Свежий авторизованный клиент с уникальным телефоном (OTP включён)."""
    phone = "+9715" + uuid.uuid4().int.__str__()[:8]
    r = client.post("/api/auth/request-code", json={"phone": phone})
    assert r.status_code == 200, r.text
    code = r.json()["devCode"]
    r = client.post("/api/auth/verify", json={"phone": phone, "code": code,
                                              "name": name, "locale": locale})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"headers": {"Authorization": f"Bearer {d['token']}"}, "user": d["user"]}


def _unpaid_order(client, customer):
    det = client.get("/api/drinks/orange-fresh").json()
    body = {"items": [{"drinkId": det["id"], "quantity": 1}],
            "carPlate": "F 12345", "emirate": "Dubai", "customerName": "WS"}
    r = client.post("/api/orders", json=body, headers=customer["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _take(client, manager, order_id):
    return client.post(f"/api/admin/orders/{order_id}/take", headers=manager["headers"])


def _set_status(client, manager, order_id, status):
    return client.post(f"/api/admin/orders/{order_id}/status",
                       json={"status": status}, headers=manager["headers"])


def _expect_close_1008(client, url):
    with pytest.raises(WebSocketDisconnect) as ei:
        with client.websocket_connect(url) as ws:
            ws.receive_json()
    assert ei.value.code == 1008


# ============================================================================
# 1. /ws/orders/{order_id} — авторизация подключения
# ============================================================================

def test_order_ws_owner_connects(client, customer):
    """Владелец со своим токеном подключается к своему заказу."""
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        assert ws is not None


def test_order_ws_staff_connects_any_order(client, customer, manager):
    """Персонал (staff-токен) может смотреть любой заказ."""
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], manager)) as ws:
        assert ws is not None


def test_order_ws_rejects_without_token(client, customer):
    """Без токена подключение отклоняется (close 1008)."""
    order = make_order(client, customer)
    _expect_close_1008(client, f"/ws/orders/{order['id']}")


def test_order_ws_rejects_garbage_token(client, customer):
    """Битый токен отклоняется."""
    order = make_order(client, customer)
    _expect_close_1008(client, f"/ws/orders/{order['id']}?token=not-a-jwt")


def test_order_ws_rejects_foreign_order(client):
    """Чужой клиент НЕ может подписаться на чужой заказ (закрыта утечка статусов)."""
    owner = _new_customer(client, name="Owner")
    order = make_order(client, owner)
    stranger = _new_customer(client, name="Stranger")
    _expect_close_1008(client, _ourl(order["id"], stranger))


def test_order_ws_rejects_nonexistent_order(client, customer):
    """Несуществующий заказ — владения нет → отклонение."""
    _expect_close_1008(client, _ourl(99999999, customer))


def test_order_ws_rejects_negative_id(client, customer):
    _expect_close_1008(client, _ourl(-5, customer))


def test_order_ws_rejects_zero_id(client, customer):
    _expect_close_1008(client, _ourl(0, customer))


def test_order_ws_rejects_large_id(client, customer):
    _expect_close_1008(client, _ourl(99999999999999999999, customer))


def test_order_ws_non_int_id_rejected(client):
    """Нечисловой order_id не матчится int-конвертером пути → отклонение."""
    _expect_close_1008(client, "/ws/orders/abc")


def test_order_ws_float_id_rejected(client):
    _expect_close_1008(client, "/ws/orders/1.5")


def test_order_ws_empty_id_routes_elsewhere(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/orders/") as ws:
            ws.receive_json()


# ============================================================================
# 2. /ws/orders/{order_id} — доставка событий (с токеном владельца)
# ============================================================================

def test_order_ws_receives_take_event(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        assert _take(client, manager, order["id"]).status_code == 200
        msg = ws.receive_json()
    assert msg["orderId"] == order["id"]
    assert msg["status"] == "in_progress"
    assert msg["paymentStatus"] == "paid"
    assert msg["arrived"] is False
    assert "number" not in msg


def test_order_ws_message_schema(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        _take(client, manager, order["id"])
        msg = ws.receive_json()
    assert set(msg.keys()) == {"orderId", "status", "paymentStatus", "arrived"}
    assert isinstance(msg["orderId"], int)
    assert isinstance(msg["status"], str)
    assert isinstance(msg["arrived"], bool)


def test_order_ws_receives_status_ready(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        _take(client, manager, order["id"])
        assert ws.receive_json()["status"] == "in_progress"
        assert _set_status(client, manager, order["id"], "ready").status_code == 200
        assert ws.receive_json()["status"] == "ready"


def test_order_ws_event_sequence_in_order(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        _take(client, manager, order["id"])
        _set_status(client, manager, order["id"], "ready")
        m1 = ws.receive_json()
        m2 = ws.receive_json()
    assert m1["status"] == "in_progress"
    assert m2["status"] == "ready"


def test_order_ws_receives_completed_event(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        _take(client, manager, order["id"])
        ws.receive_json()
        _set_status(client, manager, order["id"], "ready")
        ws.receive_json()
        assert _set_status(client, manager, order["id"], "completed").status_code == 200
        msg = ws.receive_json()
    assert msg["status"] == "completed"


def test_order_ws_receives_arrived_event(client, customer):
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        r = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["arrived"] is True
    assert msg["status"] == "new"
    assert msg["orderId"] == order["id"]


def test_order_ws_receives_paid_event_on_checkout(client):
    cust = _new_customer(client)
    order = _unpaid_order(client, cust)
    assert order["paymentStatus"] != "paid"
    with client.websocket_connect(_ourl(order["id"], cust)) as ws:
        r = client.post("/api/payments/checkout-session",
                        json={"orderId": order["id"]}, headers=cust["headers"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["paymentStatus"] == "paid"
    assert msg["status"] == "new"
    assert msg["orderId"] == order["id"]


def test_order_ws_refund_event(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        _take(client, manager, order["id"])
        ws.receive_json()
        _set_status(client, manager, order["id"], "ready")
        ws.receive_json()
        _set_status(client, manager, order["id"], "completed")
        ws.receive_json()
        r = client.post(f"/api/admin/orders/{order['id']}/refund", headers=manager["headers"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["status"] == "refund"


# ============================================================================
# 3. Изоляция каналов и множественные подписчики
# ============================================================================

def test_order_ws_channel_isolation(client, customer, manager):
    a = make_order(client, customer)
    b = make_order(client, customer)
    with client.websocket_connect(_ourl(a["id"], customer)) as ws:
        _take(client, manager, b["id"])
        _take(client, manager, a["id"])
        msg = ws.receive_json()
    assert msg["orderId"] == a["id"]
    assert msg["orderId"] != b["id"]


def test_order_ws_multiple_subscribers_same_channel(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as w1, \
         client.websocket_connect(_ourl(order["id"], manager)) as w2:
        _take(client, manager, order["id"])
        m1 = w1.receive_json()
        m2 = w2.receive_json()
    assert m1["status"] == "in_progress"
    assert m2["status"] == "in_progress"
    assert m1["orderId"] == m2["orderId"] == order["id"]


def test_order_ws_no_event_before_action(client, customer):
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        r = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r.status_code == 200
        msg = ws.receive_json()
    assert msg["arrived"] is True


# ============================================================================
# 4. /ws/admin/orders — авторизация и доставка
# ============================================================================

def test_admin_ws_rejects_without_auth(client):
    """Админ-лента без токена отклоняется."""
    _expect_close_1008(client, "/ws/admin/orders")


def test_admin_ws_rejects_customer_token(client, customer):
    """Клиентский токен НЕ даёт доступ к админ-ленте."""
    _expect_close_1008(client, f"/ws/admin/orders?token={_tok(customer)}")


def test_admin_ws_staff_connects(client, manager):
    with client.websocket_connect(_aurl(manager)) as ws:
        assert ws is not None


def test_admin_ws_receives_event_with_number(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_aurl(manager)) as ws:
        assert _take(client, manager, order["id"]).status_code == 200
        msg = ws.receive_json()
    assert msg["orderId"] == order["id"]
    assert msg["status"] == "in_progress"
    assert "number" in msg
    assert isinstance(msg["number"], int)
    assert msg["number"] == order["number"]


def test_admin_ws_message_schema(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_aurl(manager)) as ws:
        _take(client, manager, order["id"])
        msg = ws.receive_json()
    assert set(msg.keys()) == {"orderId", "status", "paymentStatus", "arrived", "number"}


def test_admin_ws_receives_paid_event(client, manager):
    cust = _new_customer(client)
    order = _unpaid_order(client, cust)
    with client.websocket_connect(_aurl(manager)) as ws:
        r = client.post("/api/payments/checkout-session",
                        json={"orderId": order["id"]}, headers=cust["headers"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["paymentStatus"] == "paid"
    assert msg["number"] == order["number"]


def test_admin_ws_receives_arrived_event(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_aurl(manager)) as ws:
        r = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["arrived"] is True
    assert msg["orderId"] == order["id"]
    assert "number" in msg


def test_admin_ws_aggregates_multiple_orders(client, customer, manager):
    a = make_order(client, customer)
    b = make_order(client, customer)
    with client.websocket_connect(_aurl(manager)) as ws:
        _take(client, manager, a["id"])
        _take(client, manager, b["id"])
        m1 = ws.receive_json()
        m2 = ws.receive_json()
    assert {m1["orderId"], m2["orderId"]} == {a["id"], b["id"]}


def test_admin_ws_multiple_subscribers(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_aurl(manager)) as w1, \
         client.websocket_connect(_aurl(manager)) as w2:
        _take(client, manager, order["id"])
        m1 = w1.receive_json()
        m2 = w2.receive_json()
    assert m1["number"] == m2["number"] == order["number"]


# ============================================================================
# 5. Маршрутизация / неверные пути
# ============================================================================

def test_unknown_ws_path_rejected(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/unknown") as ws:
            ws.receive_json()


def test_admin_ws_path_is_not_order_param(client, customer, manager):
    order = make_order(client, customer)
    with client.websocket_connect(_aurl(manager)) as ws:
        _take(client, manager, order["id"])
        msg = ws.receive_json()
    assert "number" in msg


def test_order_ws_http_get_not_allowed(client):
    r = client.get("/ws/orders/1")
    assert r.status_code >= 400


# ============================================================================
# 6. Снятие подписки после disconnect (нет утечки)
# ============================================================================

def test_order_ws_unsubscribe_on_disconnect(client, customer):
    order = make_order(client, customer)
    channel = f"order:{order['id']}"
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        assert len(pubsub._subs.get(channel, set())) >= 1
    for _ in range(50):
        if len(pubsub._subs.get(channel, set())) == 0:
            break
        time.sleep(0.02)
    assert len(pubsub._subs.get(channel, set())) == 0


def test_admin_ws_unsubscribe_on_disconnect(client, manager):
    channel = "admin:orders"
    base = len(pubsub._subs.get(channel, set()))
    with client.websocket_connect(_aurl(manager)) as ws:
        assert len(pubsub._subs.get(channel, set())) == base + 1
    for _ in range(50):
        if len(pubsub._subs.get(channel, set())) == base:
            break
        time.sleep(0.02)
    assert len(pubsub._subs.get(channel, set())) == base


def test_order_ws_arrived_idempotent_single_event(client, customer, manager):
    """Повторный /arrived идемпотентен: второй вызов НЕ публикует новое событие."""
    order = make_order(client, customer)
    with client.websocket_connect(_ourl(order["id"], customer)) as ws:
        r1 = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r1.status_code == 200
        first = ws.receive_json()
        assert first["arrived"] is True and first["status"] == "new"
        r2 = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r2.status_code == 200
        r3 = _take(client, manager, order["id"])
        assert r3.status_code == 200
        nxt = ws.receive_json()
    assert nxt["status"] == "in_progress"
