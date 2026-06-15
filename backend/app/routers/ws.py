"""WebSocket-каналы (PUB-A-03 AC5, ADM-M-03 AC2): статус заказа клиенту и лента админке.

Авторизация: токен передаётся query-параметром ?token=<jwt> (браузерный WebSocket не шлёт
заголовки). Клиент видит только СВОЙ заказ; админ-лента — только для персонала.
"""
import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from ..core.db import SessionLocal
from ..core.pubsub import pubsub
from ..core.security import decode_token
from ..models.orders import Order
from ..models.users import StaffUser

router = APIRouter(tags=["ws"])


def _claims(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        return decode_token(token)
    except Exception:
        return None


def _admin_channels(token: str | None) -> list[str] | None:
    """Каналы realtime-ленты по роли (REQ-7). None — токен не staff (доступ запрещён).
    super_admin → глобальный канал (видит все точки); manager/screen → каналы своих точек."""
    data = _claims(token)
    if not data or data.get("kind") != "staff":
        return None
    from ..core.security import get_staff_outlet_ids
    with SessionLocal() as db:
        staff = db.get(StaffUser, int(data["sub"]))
        if staff is None:
            return None
        scope = get_staff_outlet_ids(staff, db)
        if scope is None:
            return ["admin:orders"]  # super_admin
        return [f"admin:orders:{oid}" for oid in scope]


def _can_watch_order(token: str | None, order_id: int) -> bool:
    data = _claims(token)
    if not data:
        return False
    with SessionLocal() as db:
        if data.get("kind") == "staff":
            return db.get(StaffUser, int(data["sub"])) is not None
        if data.get("kind") == "customer":
            try:
                o = db.get(Order, order_id)  # огромный/битый id → не найден, а не 500
            except Exception:
                return False
            return o is not None and o.user_id == int(data["sub"])
    return False


async def _pump(ws: WebSocket, channels: list[str]):
    await ws.accept()
    q = pubsub.subscribe_many(channels)
    try:
        while True:
            # heartbeat каждые 25с, чтобы соединение не закрывали прокси
            try:
                msg = await asyncio.wait_for(q.get(), timeout=25)
                await ws.send_json(msg)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        pubsub.unsubscribe_many(channels, q)


@router.websocket("/ws/orders/{order_id}")
async def ws_order(ws: WebSocket, order_id: int, token: str | None = Query(None)):
    if not _can_watch_order(token, order_id):
        await ws.close(code=1008)  # policy violation
        return
    await _pump(ws, [f"order:{order_id}"])


@router.websocket("/ws/admin/orders")
async def ws_admin(ws: WebSocket, token: str | None = Query(None)):
    channels = _admin_channels(token)
    if channels is None:
        await ws.close(code=1008)
        return
    await _pump(ws, channels)
