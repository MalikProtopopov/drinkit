"""WebSocket-каналы (PUB-A-03 AC5, ADM-M-03 AC2): статус заказа клиенту и лента админке."""
import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..core.pubsub import pubsub

router = APIRouter(tags=["ws"])


async def _pump(ws: WebSocket, channel: str):
    await ws.accept()
    q = pubsub.subscribe(channel)
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
        pubsub.unsubscribe(channel, q)


@router.websocket("/ws/orders/{order_id}")
async def ws_order(ws: WebSocket, order_id: int):
    await _pump(ws, f"order:{order_id}")


@router.websocket("/ws/admin/orders")
async def ws_admin(ws: WebSocket):
    await _pump(ws, "admin:orders")
