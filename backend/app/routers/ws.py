"""WebSocket-каналы (PUB-A-03 AC5, ADM-M-03 AC2): статус заказа клиенту и лента админке.

Аутентификация (план §13, фикс ревизии): браузер не шлёт Authorization на WS → токен
передаётся query-параметром `?token=`. Менеджер с привязкой к точке подписывается ТОЛЬКО
на свой per-location канал `admin:orders:{location_id}` (не на глобальный).
"""
import asyncio

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from ..core.config import settings
from ..core.db import SessionLocal
from ..core.pubsub import pubsub
from ..models.orders import Order
from ..models.users import StaffUser

router = APIRouter(tags=["ws"])


def _decode(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except jwt.PyJWTError:
        return None


async def _pump(ws: WebSocket, channel: str):
    await ws.accept()
    q = pubsub.subscribe(channel)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(q.get(), timeout=25)
                await ws.send_json(msg)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})  # heartbeat
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        pubsub.unsubscribe(channel, q)


@router.websocket("/ws/orders/{order_id}")
async def ws_order(ws: WebSocket, order_id: int, token: str | None = None):
    """Статус заказа — только владельцу (customer-токен) или персоналу (staff-токен)."""
    data = _decode(token)
    if not data:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if data.get("kind") == "customer":
        with SessionLocal() as db:
            o = db.get(Order, order_id)
            if not o or o.user_id != int(data["sub"]):
                await ws.close(code=status.WS_1008_POLICY_VIOLATION)
                return
    elif data.get("kind") != "staff":
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await _pump(ws, f"order:{order_id}")


@router.websocket("/ws/admin/orders")
async def ws_admin(ws: WebSocket, token: str | None = None):
    """Лента заказов — только персоналу. Менеджер с локацией → свой per-location канал."""
    data = _decode(token)
    if not data or data.get("kind") != "staff":
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    channel = "admin:orders"
    with SessionLocal() as db:
        staff = db.get(StaffUser, int(data["sub"]))
        if not staff or staff.disabled:
            await ws.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        if staff.role == "manager" and staff.location_id is not None:
            channel = f"admin:orders:{staff.location_id}"  # только своя точка
    await _pump(ws, channel)
