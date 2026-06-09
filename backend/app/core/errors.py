"""Канонический реестр доменных кодов ошибок (план §13, фронт-спека §4).

Один источник истины для бэка; фронт матчит ровно эти строки в `detail`/`code`.
Нельзя расходиться с GRABZI_FRONTEND_SPEC.md §4.
"""
from fastapi import HTTPException


class Err:
    # локации / лимиты / стоп-лист
    LOCATION_REQUIRED = "LOCATION_REQUIRED"                 # 422
    LOCATION_NOT_FOUND = "LOCATION_NOT_FOUND"               # 404
    LOCATION_CLOSED = "LOCATION_CLOSED"                     # 409 (+ next_open_at)
    LOCATION_PAUSED = "LOCATION_PAUSED"                     # 409
    LOCATION_LIMIT_REACHED = "LOCATION_LIMIT_REACHED"       # 409 (+ remaining)
    LOCATION_SOLD_OUT = "LOCATION_SOLD_OUT"                 # 409
    DRINK_UNAVAILABLE_AT_LOCATION = "DRINK_UNAVAILABLE_AT_LOCATION"  # 409
    STOCK_LESS_THAN_ORDER = "STOCK_LESS_THAN_ORDER"        # 409 (+ remaining)
    # каталог / заказ (существующие в Juicy)
    DRINK_NOT_AVAILABLE = "DRINK_NOT_AVAILABLE"            # 409
    CART_EMPTY = "CART_EMPTY"                               # 422
    CAR_PLATE_REQUIRED = "CAR_PLATE_REQUIRED"              # 422
    ORDER_NOT_PAID = "ORDER_NOT_PAID"                      # 409
    # доступ
    FORBIDDEN = "FORBIDDEN"                                 # 403
    FOREIGN_LOCATION = "FOREIGN_LOCATION"                  # 403 (менеджер — чужая точка)


def http_error(status: int, code: str, **meta):
    """HTTPException, у которого detail = {code, ...meta} либо просто code-строка.

    Для совместимости с текущим фронтом (читает detail как строку) при отсутствии
    meta отдаём строку-код; при наличии meta — объект {code, ...}.
    """
    detail: object = code if not meta else {"code": code, **meta}
    return HTTPException(status_code=status, detail=detail)
