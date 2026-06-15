"""Лёгкая пагинация limit/offset для списочных эндпоинтов админки.

Не ломает существующих потребителей: если `limit` не передан — возвращаем всё.
Полное число записей всегда уходит в заголовок `X-Total-Count` (его читает фронт
для постраничной навигации). Заголовок открыт наружу в CORS (см. main.py).
"""
from fastapi import Query, Response

# параметры запроса для эндпоинта: limit (1..200) и offset (>=0)
PageLimit = Query(None, ge=1, le=200, description="размер страницы; пусто — все записи")
PageOffset = Query(0, ge=0, description="смещение от начала")


def paginate(items: list, response: Response, limit: int | None, offset: int = 0) -> list:
    """Проставляет X-Total-Count и возвращает срез [offset, offset+limit)."""
    response.headers["X-Total-Count"] = str(len(items))
    if limit is None:
        return items
    return items[offset:offset + limit]
