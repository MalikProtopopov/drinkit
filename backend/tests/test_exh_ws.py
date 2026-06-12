"""Исчерпывающие тесты WebSocket-роутера (app/routers/ws.py, domain="ws").

Эндпоинты:
  WS /ws/orders/{order_id}  — канал статуса конкретного заказа клиенту (PUB-A-03 AC5)
  WS /ws/admin/orders       — общая лента заказов админке (ADM-M-03 AC2)

Транспорт: pubsub (app/core/pubsub.py) — внутрипроцессный брокер. Событие
публикуется из services/order_flow.notify() при:
  - оплате заказа (mark_paid → checkout-session),
  - смене статуса готовки (transition → /take, /status, /refund),
  - флаге «я на месте» (/arrived).

Сообщение на канале order:{id}:   {orderId, status, paymentStatus, arrived}
Сообщение на канале admin:orders: {orderId, status, paymentStatus, arrived, number}

ВАЖНОЕ ОГРАНИЧЕНИЕ ПРОДУКТА: оба WS-эндпоинта НЕ требуют авторизации и не
проверяют существование/принадлежность заказа — _pump() сразу делает
ws.accept() без какого-либо контроля доступа. Поэтому классических негативов
401/403/404 на самом WS нет: любой может подписаться на любой order:{id} и на
admin:orders. Это зафиксировано тестами как фактическое поведение и вынесено
в отчёт (bugsFound, severity=low) как потенциальная утечба статусов.

Не меняем conftest.py и существующие тесты. Используем фикстуры:
  client, customer, manager, admin, make_order.
"""
import uuid

import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.pubsub import pubsub
from .conftest import make_order


# ----------------------------------------------------------------------------
# Локальные хелперы (НЕ трогают conftest)
# ----------------------------------------------------------------------------

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
    """Создаёт неоплаченный заказ (без checkout)."""
    det = client.get("/api/drinks/orange-fresh").json()
    body = {
        "items": [{"drinkId": det["id"], "quantity": 1}],
        "carPlate": "F 12345", "emirate": "Dubai", "customerName": "WS",
    }
    r = client.post("/api/orders", json=body, headers=customer["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _take(client, manager, order_id):
    return client.post(f"/api/admin/orders/{order_id}/take", headers=manager["headers"])


def _set_status(client, manager, order_id, status):
    return client.post(f"/api/admin/orders/{order_id}/status",
                       json={"status": status}, headers=manager["headers"])


# ============================================================================
# 1. /ws/orders/{order_id} — подключение
# ============================================================================

def test_order_ws_connects_for_existing_order(client, customer):
    """Счастливый путь: подключение к каналу существующего заказа открывается."""
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        assert ws is not None  # accept прошёл без ошибок


def test_order_ws_connects_without_any_auth(client):
    """Подключение БЕЗ токена/заголовков открывается (на WS нет авторизации).

    Зафиксировано как фактическое поведение продукта; см. шапку модуля и notes.
    """
    order_channel_id = 1234567
    with client.websocket_connect(f"/ws/orders/{order_channel_id}") as ws:
        assert ws is not None


def test_order_ws_connects_for_nonexistent_order(client):
    """Несуществующий order_id НЕ отклоняется (нет проверки существования).

    В корректной реализации ожидался бы 404/close, но _pump() не обращается к БД.
    """
    with client.websocket_connect("/ws/orders/99999999") as ws:
        assert ws is not None


def test_order_ws_connects_for_foreign_order(client, customer):
    """Чужой заказ: другой клиент может подписаться на чужой order:{id}.

    Нет 403/404 — это потенциальная утечка статусов (см. bugsFound).
    """
    owner = _new_customer(client, name="Owner")
    order = make_order(client, owner)
    stranger = _new_customer(client, name="Stranger")  # noqa: F841 — токен не нужен для WS
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        assert ws is not None


def test_order_ws_negative_id_connects(client):
    """Отрицательный order_id валиден для int-параметра пути → соединение открыто."""
    with client.websocket_connect("/ws/orders/-5") as ws:
        assert ws is not None


def test_order_ws_zero_id_connects(client):
    """order_id=0 — валидный int → соединение открыто (канал order:0)."""
    with client.websocket_connect("/ws/orders/0") as ws:
        assert ws is not None


def test_order_ws_large_id_connects(client):
    """Очень большой order_id (за пределами int32) — Python int не ограничен."""
    with client.websocket_connect("/ws/orders/99999999999999999999") as ws:
        assert ws is not None


def test_order_ws_non_int_id_rejected(client):
    """Нечисловой order_id не матчится в int-конвертере пути → close 1008."""
    with pytest.raises(WebSocketDisconnect) as ei:
        with client.websocket_connect("/ws/orders/abc") as ws:
            ws.receive_json()
    assert ei.value.code == 1008


def test_order_ws_float_id_rejected(client):
    """Дробный order_id (1.5) не int → соединение отклонено (close 1008)."""
    with pytest.raises(WebSocketDisconnect) as ei:
        with client.websocket_connect("/ws/orders/1.5") as ws:
            ws.receive_json()
    assert ei.value.code == 1008


def test_order_ws_empty_id_routes_elsewhere(client):
    """Пустой order_id (/ws/orders/) не матчит роут → отклонение."""
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/orders/") as ws:
            ws.receive_json()


# ============================================================================
# 2. /ws/orders/{order_id} — доставка событий
# ============================================================================

def test_order_ws_receives_take_event(client, customer, manager):
    """При «Взять в работу» (new→in_progress) приходит событие со статусом."""
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        r = _take(client, manager, order["id"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["orderId"] == order["id"]
    assert msg["status"] == "in_progress"
    assert msg["paymentStatus"] == "paid"
    assert msg["arrived"] is False
    # на клиентском канале НЕТ поля number (оно только в admin-ленте)
    assert "number" not in msg


def test_order_ws_message_schema(client, customer, manager):
    """Сообщение содержит ровно ожидаемый набор ключей (контракт PUB-A-03)."""
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        _take(client, manager, order["id"])
        msg = ws.receive_json()
    assert set(msg.keys()) == {"orderId", "status", "paymentStatus", "arrived"}
    assert isinstance(msg["orderId"], int)
    assert isinstance(msg["status"], str)
    assert isinstance(msg["arrived"], bool)


def test_order_ws_receives_status_ready(client, customer, manager):
    """Переход in_progress→ready доставляется на клиентский канал."""
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        _take(client, manager, order["id"])
        assert ws.receive_json()["status"] == "in_progress"
        r = _set_status(client, manager, order["id"], "ready")
        assert r.status_code == 200, r.text
        assert ws.receive_json()["status"] == "ready"


def test_order_ws_event_sequence_in_order(client, customer, manager):
    """Несколько событий приходят в порядке публикации (FIFO очередь)."""
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        _take(client, manager, order["id"])
        _set_status(client, manager, order["id"], "ready")
        m1 = ws.receive_json()
        m2 = ws.receive_json()
    assert m1["status"] == "in_progress"
    assert m2["status"] == "ready"


def test_order_ws_receives_completed_event(client, customer, manager):
    """Полная цепочка вплоть до completed доставляется по WS."""
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        _take(client, manager, order["id"])
        ws.receive_json()
        _set_status(client, manager, order["id"], "ready")
        ws.receive_json()
        r = _set_status(client, manager, order["id"], "completed")
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["status"] == "completed"


def test_order_ws_receives_arrived_event(client, customer):
    """Флаг «я на месте» публикует событие с arrived=True (статус не меняется)."""
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        r = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["arrived"] is True
    assert msg["status"] == "new"  # готовка не двигалась
    assert msg["orderId"] == order["id"]


def test_order_ws_receives_paid_event_on_checkout(client):
    """Пред-подключённый канал получает событие оплаты (mark_paid→notify)."""
    cust = _new_customer(client)
    order = _unpaid_order(client, cust)
    assert order["paymentStatus"] != "paid"
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        r = client.post("/api/payments/checkout-session",
                        json={"orderId": order["id"]}, headers=cust["headers"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["paymentStatus"] == "paid"
    assert msg["status"] == "new"
    assert msg["orderId"] == order["id"]


def test_order_ws_refund_event(client, customer, manager):
    """Возврат (completed→refund) доставляется на клиентский канал."""
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
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
# 3. /ws/orders/{order_id} — изоляция каналов и множественные подписчики
# ============================================================================

def test_order_ws_channel_isolation(client, customer, manager):
    """Подписчик заказа A не получает события заказа B (изоляция по order:{id})."""
    a = make_order(client, customer)
    b = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{a['id']}") as ws:
        # триггерим B, затем A; первое полученное сообщение должно быть от A
        _take(client, manager, b["id"])
        _take(client, manager, a["id"])
        msg = ws.receive_json()
    assert msg["orderId"] == a["id"]
    assert msg["orderId"] != b["id"]


def test_order_ws_multiple_subscribers_same_channel(client, customer, manager):
    """Два подписчика одного заказа оба получают событие (fan-out)."""
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as w1, \
         client.websocket_connect(f"/ws/orders/{order['id']}") as w2:
        _take(client, manager, order["id"])
        m1 = w1.receive_json()
        m2 = w2.receive_json()
    assert m1["status"] == "in_progress"
    assert m2["status"] == "in_progress"
    assert m1["orderId"] == m2["orderId"] == order["id"]


def test_order_ws_no_event_before_action(client, customer):
    """До любого действия канал молчит — receive_json не должен вернуть статус.

    Проверяем, что свежий канал не отдаёт «исторических» событий: первое
    действие даёт ровно одно соответствующее сообщение.
    """
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        r = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r.status_code == 200
        msg = ws.receive_json()
    # ровно событие arrived, не накопленные прежние
    assert msg["arrived"] is True


# ============================================================================
# 4. /ws/admin/orders — подключение и доставка
# ============================================================================

def test_admin_ws_connects_without_auth(client):
    """Админ-лента подключается БЕЗ авторизации (нет проверки роли на WS).

    В корректной реализации ожидался бы отказ для не-staff; зафиксировано как есть.
    """
    with client.websocket_connect("/ws/admin/orders") as ws:
        assert ws is not None


def test_admin_ws_receives_event_with_number(client, customer, manager):
    """Админ-лента получает событие с дополнительным полем number."""
    order = make_order(client, customer)
    with client.websocket_connect("/ws/admin/orders") as ws:
        r = _take(client, manager, order["id"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["orderId"] == order["id"]
    assert msg["status"] == "in_progress"
    assert "number" in msg
    assert isinstance(msg["number"], int)
    assert msg["number"] == order["number"]


def test_admin_ws_message_schema(client, customer, manager):
    """Контракт admin-сообщения: order-поля + number."""
    order = make_order(client, customer)
    with client.websocket_connect("/ws/admin/orders") as ws:
        _take(client, manager, order["id"])
        msg = ws.receive_json()
    assert set(msg.keys()) == {"orderId", "status", "paymentStatus", "arrived", "number"}


def test_admin_ws_receives_paid_event(client):
    """Админ-лента получает событие оплаты любого заказа (mark_paid)."""
    cust = _new_customer(client)
    order = _unpaid_order(client, cust)
    with client.websocket_connect("/ws/admin/orders") as ws:
        r = client.post("/api/payments/checkout-session",
                        json={"orderId": order["id"]}, headers=cust["headers"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["paymentStatus"] == "paid"
    assert msg["number"] == order["number"]


def test_admin_ws_receives_arrived_event(client, customer):
    """Прибытие клиента тоже попадает в админ-ленту (notify публикует в оба канала)."""
    order = make_order(client, customer)
    with client.websocket_connect("/ws/admin/orders") as ws:
        r = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r.status_code == 200, r.text
        msg = ws.receive_json()
    assert msg["arrived"] is True
    assert msg["orderId"] == order["id"]
    assert "number" in msg


def test_admin_ws_aggregates_multiple_orders(client, customer, manager):
    """Админ-лента агрегирует события РАЗНЫХ заказов (в отличие от order-канала)."""
    a = make_order(client, customer)
    b = make_order(client, customer)
    with client.websocket_connect("/ws/admin/orders") as ws:
        _take(client, manager, a["id"])
        _take(client, manager, b["id"])
        m1 = ws.receive_json()
        m2 = ws.receive_json()
    got = {m1["orderId"], m2["orderId"]}
    assert got == {a["id"], b["id"]}


def test_admin_ws_multiple_subscribers(client, customer, manager):
    """Несколько админ-подписчиков получают одно и то же событие."""
    order = make_order(client, customer)
    with client.websocket_connect("/ws/admin/orders") as w1, \
         client.websocket_connect("/ws/admin/orders") as w2:
        _take(client, manager, order["id"])
        m1 = w1.receive_json()
        m2 = w2.receive_json()
    assert m1["number"] == m2["number"] == order["number"]


# ============================================================================
# 5. Маршрутизация / неверные пути
# ============================================================================

def test_unknown_ws_path_rejected(client):
    """Несуществующий WS-путь отклоняется (close, не accept)."""
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/unknown") as ws:
            ws.receive_json()


def test_admin_ws_path_is_not_order_param(client, customer, manager):
    """/ws/admin/orders — отдельный роут, не /ws/orders/{id} с id='admin'.

    Проверяем, что он реально подписан на admin:orders: триггерим заказ и
    получаем сообщение с полем number (которого нет на клиентском канале).
    """
    order = make_order(client, customer)
    with client.websocket_connect("/ws/admin/orders") as ws:
        _take(client, manager, order["id"])
        msg = ws.receive_json()
    assert "number" in msg


def test_order_ws_http_get_not_allowed(client):
    """Обычный HTTP GET на WS-путь не обслуживается как REST (нужен upgrade)."""
    r = client.get("/ws/orders/1")
    # Starlette на WS-роут без upgrade отвечает не-2xx
    assert r.status_code >= 400


# ============================================================================
# 6. Идемпотентность / отсутствие утечки подписок
# ============================================================================

def test_order_ws_unsubscribe_on_disconnect(client, customer):
    """После закрытия соединения подписка снимается с канала (нет утечки)."""
    order = make_order(client, customer)
    channel = f"order:{order['id']}"
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        # внутри контекста подписка активна
        assert len(pubsub._subs.get(channel, set())) >= 1
    # дать pump-корутине отработать finally
    import time
    for _ in range(50):
        if len(pubsub._subs.get(channel, set())) == 0:
            break
        time.sleep(0.02)
    assert len(pubsub._subs.get(channel, set())) == 0


def test_admin_ws_unsubscribe_on_disconnect(client):
    """Админ-канал также корректно снимает подписку после disconnect."""
    channel = "admin:orders"
    base = len(pubsub._subs.get(channel, set()))
    with client.websocket_connect("/ws/admin/orders") as ws:
        assert len(pubsub._subs.get(channel, set())) == base + 1
    import time
    for _ in range(50):
        if len(pubsub._subs.get(channel, set())) == base:
            break
        time.sleep(0.02)
    assert len(pubsub._subs.get(channel, set())) == base


def test_order_ws_arrived_idempotent_single_event(client, customer):
    """Повторный /arrived идемпотентен: второй вызов НЕ публикует новое событие.

    Первый arrived даёт событие; второй (когда arrived_at уже стоит) — нет.
    Проверяем, что следующий принятый кадр — это take-событие, а не второй arrived.
    """
    order = make_order(client, customer)
    with client.websocket_connect(f"/ws/orders/{order['id']}") as ws:
        r1 = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r1.status_code == 200
        first = ws.receive_json()
        assert first["arrived"] is True and first["status"] == "new"
        # повторный arrived — без нового события
        r2 = client.post(f"/api/orders/{order['id']}/arrived", headers=customer["headers"])
        assert r2.status_code == 200
        # триггерим заведомо другое событие
        r3 = client.post(f"/api/admin/orders/{order['id']}/take",
                         json=None,
                         headers=_manager_headers(client))
        assert r3.status_code == 200
        nxt = ws.receive_json()
    # если бы второй arrived опубликовался, следующим был бы arrived/new, а не in_progress
    assert nxt["status"] == "in_progress"


def _manager_headers(client):
    r = client.post("/api/staff/login", json={"email": "manager@juicy.ae", "password": "manager123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}
