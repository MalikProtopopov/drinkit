"""Тесты аутентификации WebSocket (план §13, фикс ревизии)."""
import pytest
from starlette.websockets import WebSocketDisconnect

from tests.conftest import make_order


def _token(headers):
    return headers["Authorization"].split(" ", 1)[1]


def test_admin_ws_rejects_without_token(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/admin/orders"):
            pass


def test_admin_ws_accepts_staff(client, admin):
    # с валидным staff-токеном соединение принимается
    with client.websocket_connect(f"/ws/admin/orders?token={_token(admin['headers'])}") as ws:
        assert ws is not None  # accept прошёл


def test_order_ws_rejects_foreign(client, customer):
    order = make_order(client, customer)
    # без токена — отказ
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/ws/orders/{order['id']}"):
            pass
    # с токеном владельца — ок
    with client.websocket_connect(
            f"/ws/orders/{order['id']}?token={_token(customer['headers'])}") as ws:
        assert ws is not None
