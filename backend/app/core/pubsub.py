"""In-process pubsub для WebSocket-уведомлений о статусах заказов.

DECISION: при одном инстансе бэкенда (MVP, одна точка) достаточно
внутрипроцессного брокера; при горизонтальном масштабировании заменяется
на Redis pub/sub (интерфейс совместим, см. settings.redis_url).
"""
import asyncio
from collections import defaultdict


class PubSub:
    def __init__(self):
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, channel: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs[channel].add(q)
        return q

    def unsubscribe(self, channel: str, q: asyncio.Queue):
        self._subs[channel].discard(q)

    def publish(self, channel: str, message: dict):
        for q in list(self._subs.get(channel, ())):
            q.put_nowait(message)


pubsub = PubSub()
