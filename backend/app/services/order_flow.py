"""Сквозная логика заказа: создание со снэпшотами, переходы статуса, события, нотификации."""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..core.errors import Err, http_error
from ..core.pubsub import pubsub
from ..models.catalog import Drink
from ..models.locations import Location
from ..models.orders import (ORDER_STATUSES, Coupon, Order, OrderEvent, OrderItem,
                             OrderItemAddon)
from ..models.users import User
from . import location_service as locsvc
from .i18n import t

ACTIVE_STATUSES = ["new", "in_progress", "ready"]  # ADM-M-01 AC2


class LimitExceededError(Exception):
    """Лимит точки исчерпан в момент оплаты (гонка) — заказ возвращается."""

    def __init__(self, remaining: int | None = None):
        self.remaining = remaining


def assert_location_orderable(db: Session, loc: Location, drinks_total: int,
                              drink_ids: list[int]):
    """Мягкая предпроверка доступности заказа на точке (план §5.3) — до оплаты.

    Поднимает канонические 409 при закрытой/паузнутой/распроданной точке или стоп-листе.
    """
    if not loc.is_active:
        raise http_error(404, Err.LOCATION_NOT_FOUND)
    if not loc.accepting_orders:
        raise http_error(409, Err.LOCATION_PAUSED)
    if not locsvc.schedule_open(loc):
        nxt = locsvc.next_open_at(loc)
        raise http_error(409, Err.LOCATION_CLOSED,
                         next_open_at=nxt.isoformat() if nxt else None)
    stopped = locsvc.stopped_drink_ids(db, loc.id)
    if stopped & set(drink_ids):
        raise http_error(409, Err.DRINK_UNAVAILABLE_AT_LOCATION)
    rem = locsvc.remaining(loc, locsvc.sold_today(db, loc))
    if rem is not None:
        if rem <= 0:
            raise http_error(409, Err.LOCATION_SOLD_OUT)
        if drinks_total > rem:
            raise http_error(409, Err.STOCK_LESS_THAN_ORDER, remaining=rem)

# Переходы статуса ГОТОВКИ. Прибытие клиента ("я на месте") — НЕ ступень цепочки,
# а независимый флаг arrived_at: клиент мог заказать, уже стоя у точки, а бариста
# мог забыть нажать «готово» — прибытие не должно от этого зависеть.
TRANSITIONS = {
    "new": ["in_progress"],
    "in_progress": ["ready"],
    "ready": ["completed"],
    "completed": ["refund"],  # возврат — опциональный модуль ADM-M-06
}


def add_event(db: Session, order: Order, type_: str, status: str | None = None,
              by_user_id: int | None = None, by_staff_id: int | None = None, note: str | None = None):
    db.add(OrderEvent(order_id=order.id, type=type_, status=status,
                      by_user_id=by_user_id, by_staff_id=by_staff_id, note=note))


def notify(order: Order):
    """Realtime по WebSocket (решение владельца, PUB-A-03 AC5)."""
    msg = {"orderId": order.id, "status": order.status, "paymentStatus": order.payment_status,
           "arrived": order.arrived_at is not None}
    pubsub.publish(f"order:{order.id}", msg)
    admin_msg = {**msg, "number": order.number, "locationId": order.location_id}
    pubsub.publish("admin:orders", admin_msg)
    # per-location канал для скоупа менеджера (WS §13)
    if order.location_id is not None:
        pubsub.publish(f"admin:orders:{order.location_id}", admin_msg)


def next_order_number(db: Session) -> int:
    return (db.scalar(select(func.max(Order.number))) or 1000) + 1


def create_order(db: Session, user: User, payload, locale: str) -> Order:
    """PUB-A-01/02: заказ из корзины; цены и состав снэпшотятся; купон — на выбранный напиток."""
    if not payload.items:
        raise HTTPException(422, "CART_EMPTY")

    location_id = getattr(payload, "locationId", None)
    order = Order(
        number=next_order_number(db), user_id=user.id, status="new",
        location_id=location_id,
        customer_name=payload.customerName or user.name, phone=user.phone,
        car_plate=(payload.carPlate or user.car_plate or "").upper(),
        emirate=payload.emirate or user.emirate,
    )
    if not order.car_plate:
        raise HTTPException(422, "CAR_PLATE_REQUIRED")

    # GRABZI: предпроверка точки (часы/пауза/стоп-лист/остаток) до оплаты (план §5.3).
    # Legacy-заказы без locationId проверки пропускают (обратная совместимость Juicy).
    loc = db.get(Location, location_id) if location_id is not None else None
    if location_id is not None and loc is None:
        raise http_error(404, Err.LOCATION_NOT_FOUND)
    if loc is not None:
        drinks_total = sum(line.quantity for line in payload.items)
        drink_ids = [line.drinkId for line in payload.items]
        assert_location_orderable(db, loc, drinks_total, drink_ids)

    db.add(order)
    db.flush()

    from ..routers.catalog import drink_preview, PreviewIn, PreviewSelection  # переиспользуем расчёт

    subtotal = 0.0
    coupon_item_price = None
    for idx, line in enumerate(payload.items):
        d = db.scalar(select(Drink).options(selectinload(Drink.addon_links))
                      .where(Drink.id == line.drinkId))
        if not d or d.status != "published":
            raise HTTPException(409, "DRINK_NOT_AVAILABLE")
        calc = drink_preview(
            d.slug,
            PreviewIn(selections=[PreviewSelection(addonId=s.addonId, portions=s.portions)
                                  for s in line.addons]),
            locale=locale, db=db,
        )
        item = OrderItem(order_id=order.id, drink_id=d.id, drink_name=t(d.name, locale),
                         custom_name=line.customName, unit_price=calc["price"],
                         quantity=line.quantity)
        db.add(item)
        db.flush()
        links = {l.addon_id: l for l in d.addon_links}
        for a in calc["addons"]:
            link = links[a["addonId"]]
            db.add(OrderItemAddon(item_id=item.id, addon_id=a["addonId"], addon_name=a["name"],
                                  portions=a["portions"], amount=a["portions"] * link.portion_amount,
                                  unit_code=a["unit"], price_per_portion=a["pricePerPortion"]))
        subtotal += calc["price"] * line.quantity

        if payload.couponItemIndex is not None and idx == payload.couponItemIndex:
            item.paid_by_coupon = True
            coupon_item_price = calc["price"]  # купон списывает 1 напиток (PUB-A-05 AC2)

    order.subtotal = round(subtotal, 2)

    if payload.couponId is not None:
        coupon = db.get(Coupon, payload.couponId)
        if not coupon or coupon.user_id != user.id or coupon.status != "active":
            raise HTTPException(409, "COUPON_INVALID")
        if coupon_item_price is None:
            raise HTTPException(422, "COUPON_ITEM_REQUIRED")  # напиток выбирает клиент
        order.coupon_id = coupon.id
        order.coupon_discount = round(coupon_item_price, 2)
        add_event(db, order, "coupon_applied", by_user_id=user.id,
                  note=f"coupon {coupon.id} -> item")

    order.total = round(order.subtotal - order.coupon_discount, 2)
    add_event(db, order, "created", status="new", by_user_id=user.id)
    db.commit()
    return order


def mark_paid(db: Session, order: Order, provider_id: str | None = None):
    """Оплата: заказ становится виден менеджеру (payment_status=paid) и списывает дневной
    лимит точки В НАПИТКАХ под пессимистической блокировкой счётчика (план §5.3, §F).

    При гонке (лимит исчерпан между созданием и оплатой) — заказ возвращается
    (payment_status=refunded) и поднимается LimitExceededError для отката оплаты.
    """
    loc = db.get(Location, order.location_id) if order.location_id else None
    if loc is not None:
        drinks = sum(i.quantity for i in order.items)
        bdate = locsvc.business_date_for(loc)
        row = locsvc.get_counter_row(db, loc, bdate, for_update=True)  # блок строки
        # повторная проверка лимита под локом (только если лимит задан)
        if loc.daily_drink_limit is not None and row.committed_drinks + drinks > loc.daily_drink_limit:
            order.payment_status = "refunded"
            add_event(db, order, "refund", note="limit_exceeded_refund")
            db.commit()
            notify(order)
            raise LimitExceededError(remaining=max(0, loc.daily_drink_limit - row.committed_drinks))
        row.committed_drinks += drinks  # инкремент всегда (даже при null-лимите — для аналитики)

    order.payment_status = "paid"
    # купон становится использованным только после оплаты
    if order.coupon_id:
        coupon = db.get(Coupon, order.coupon_id)
        item = next((i for i in order.items if i.paid_by_coupon), None)
        coupon.status = "used"
        coupon.used_at = datetime.utcnow()
        coupon.used_order_id = order.id
        coupon.used_item_id = item.id if item else None
        coupon.discount_amount = order.coupon_discount
    add_event(db, order, "paid", note=provider_id)
    db.commit()
    notify(order)


def refund_order(db: Session, order: Order, by_staff_id: int | None = None,
                 note: str | None = None):
    """Возврат оплаченного заказа (план §5.4): статус refund + декремент дневного лимита
    точки, ТОЛЬКО если возврат в тот же торговый день, что и продажа, и не уводит в минус.
    Единый chokepoint вместо inline-мутации в admin_orders.
    """
    if order.payment_status != "paid":
        raise http_error(409, "ORDER_NOT_PAID")
    loc = db.get(Location, order.location_id) if order.location_id else None
    if loc is not None:
        from zoneinfo import ZoneInfo
        drinks = sum(i.quantity for i in order.items)
        today = locsvc.business_date_for(loc)
        # декремент только если возврат в тот же торговый день (иначе лимит прошлого дня «сгорел»).
        # created_at хранится в UTC (naive) — приводим к TZ локации, чтобы день совпал с mark_paid.
        created = order.created_at
        if created is not None and created.tzinfo is None:
            created = created.replace(tzinfo=ZoneInfo("UTC"))
        sale_day = locsvc.business_date_for(loc, created) if created else today
        if sale_day == today:
            row = locsvc.get_counter_row(db, loc, today, for_update=True)
            row.committed_drinks = max(0, row.committed_drinks - drinks)
    order.payment_status = "refunded"
    order.status = "refund"
    for p in order.payments:
        if p.status == "succeeded":
            p.status = "refunded"
    add_event(db, order, "refund", status="refund", by_staff_id=by_staff_id, note=note)
    db.commit()
    notify(order)


def transition(db: Session, order: Order, new_status: str,
               by_user_id: int | None = None, by_staff_id: int | None = None, note: str | None = None):
    if new_status not in ORDER_STATUSES:
        raise HTTPException(422, "VALIDATION_ERROR")
    allowed = TRANSITIONS.get(order.status, [])
    if new_status not in allowed:
        raise HTTPException(409, f"INVALID_TRANSITION:{order.status}->{new_status}")
    order.status = new_status
    if new_status == "in_progress" and by_staff_id:
        order.manager_id = by_staff_id  # «Взять в работу» закрепляет менеджера (ADM-M-02)
    add_event(db, order, "status_change", status=new_status,
              by_user_id=by_user_id, by_staff_id=by_staff_id, note=note)
    db.commit()
    notify(order)
