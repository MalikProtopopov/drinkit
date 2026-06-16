"""Сквозная логика заказа: создание со снэпшотами, переходы статуса, события, нотификации."""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..core.pubsub import pubsub
from ..models.catalog import Drink
from ..models.orders import (ORDER_STATUSES, Coupon, Order, OrderEvent, OrderItem,
                             OrderItemAddon)
from ..models.outlet import Outlet
from ..models.users import User
from .drink_calc import PreviewIn, PreviewSelection, preview_calc
from .i18n import t
from .outlet_service import load_stop_sets, refresh_limit_pause, resolve_outlet, runtime_status

ACTIVE_STATUSES = ["new", "in_progress", "ready"]  # ADM-M-01 AC2

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
    """Realtime по WebSocket (решение владельца, PUB-A-03 AC5).
    Помимо общего канала публикуем в канал точки — менеджер/screen слушают только свою (REQ-7)."""
    msg = {"orderId": order.id, "status": order.status, "paymentStatus": order.payment_status,
           "arrived": order.arrived_at is not None}
    pubsub.publish(f"order:{order.id}", msg)
    admin_msg = {**msg, "number": order.number, "outletId": order.outlet_id}
    pubsub.publish("admin:orders", admin_msg)
    if order.outlet_id is not None:
        pubsub.publish(f"admin:orders:{order.outlet_id}", admin_msg)


def next_order_number(db: Session) -> int:
    return (db.scalar(select(func.max(Order.number))) or 1000) + 1


def create_order(db: Session, user: User, payload, locale: str) -> Order:
    """PUB-A-01/02: заказ из корзины. B3: номер = max+1 не атомарен — уникальный индекс
    ловит коллизию под конкуренцией; ретраим с новым номером вместо необработанного 500."""
    for _ in range(5):
        try:
            return _create_order(db, user, payload, locale)
        except IntegrityError:
            db.rollback()  # коллизия номера (или иной конфликт) — пересобираем заказ
    raise HTTPException(409, "ORDER_NUMBER_CONFLICT")


def _create_order(db: Session, user: User, payload, locale: str) -> Order:
    if not payload.items:
        raise HTTPException(422, "CART_EMPTY")

    # точка заказа (REQ-6): одна активная → она; несколько → требуется выбор; затем гейт по статусу
    outlet = resolve_outlet(db, getattr(payload, "outletId", None))
    if runtime_status(db, outlet) != "open":
        raise HTTPException(409, "OUTLET_CLOSED")
    stop = load_stop_sets(db, outlet.id)

    order = Order(
        number=next_order_number(db), user_id=user.id, status="new", outlet_id=outlet.id,
        customer_name=payload.customerName or user.name, phone=user.phone,
        car_plate=(payload.carPlate or user.car_plate or "").upper(),
        emirate=payload.emirate or user.emirate,
    )
    if not order.car_plate:
        raise HTTPException(422, "CAR_PLATE_REQUIRED")
    db.add(order)
    db.flush()

    subtotal = 0.0
    coupon_item_price = None
    for idx, line in enumerate(payload.items):
        d = db.scalar(select(Drink)
                      .options(selectinload(Drink.addon_links), selectinload(Drink.sizes))
                      .where(Drink.id == line.drinkId))
        if not d or d.status != "published":
            raise HTTPException(409, "DRINK_NOT_AVAILABLE")
        # стоп-лист точки (REQ-3): напиток/его категория застоплены на этой точке
        if d.id in stop["drink"] or d.category_id in stop["drink_category"]:
            raise HTTPException(409, "DRINK_NOT_AVAILABLE")
        if any(s.addonId in stop["addon"] for s in line.addons):
            raise HTTPException(409, "ADDON_NOT_AVAILABLE")
        # переиспользуем чистый расчёт каталога (drink_calc) — без захода в роутер
        calc = preview_calc(
            d,
            PreviewIn(selections=[PreviewSelection(addonId=s.addonId, portions=s.portions)
                                  for s in line.addons],
                      sizeId=line.sizeId),
            locale, stop,
        )
        item = OrderItem(order_id=order.id, drink_id=d.id, drink_name=t(d.name, locale),
                         custom_name=line.customName, size_label=calc.get("sizeLabel"),
                         unit_price=calc["price"], quantity=line.quantity)
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
        # B1/X9: блокируем строку купона на время резервирования — два параллельных
        # неоплаченных заказа не смогут зарезервировать один купон (на Postgres FOR UPDATE
        # сериализует; на SQLite запись и так под общим локом).
        coupon = db.get(Coupon, payload.couponId, with_for_update=True)
        if not coupon or coupon.user_id != user.id or coupon.status != "active":
            raise HTTPException(409, "COUPON_INVALID")
        # анти-дабл-букинг: купон нельзя применить к другому ещё не оплаченному заказу
        held = db.scalar(select(Order).where(
            Order.coupon_id == coupon.id, Order.payment_status != "paid"))
        if held is not None:
            raise HTTPException(409, "COUPON_ALREADY_RESERVED")
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
    order.payment_status = "paid"
    # купон становится использованным только после оплаты (PAY-500: купон мог быть удалён/void — гард)
    if order.coupon_id:
        coupon = db.get(Coupon, order.coupon_id)
        if coupon is not None:
            item = next((i for i in order.items if i.paid_by_coupon), None)
            coupon.status = "used"
            coupon.used_at = datetime.utcnow()
            coupon.used_order_id = order.id
            coupon.used_item_id = item.id if item else None
            coupon.discount_amount = order.coupon_discount
    add_event(db, order, "paid", note=provider_id)
    db.commit()
    # дневной лимит точки (REQ-4, paid-only): синхронизируем авто-паузу/аудит после оплаты.
    # O1: блокируем строку точки — событие limit_reached срабатывает один раз под конкуренцией.
    if order.outlet_id:
        outlet = db.get(Outlet, order.outlet_id, with_for_update=True)
        if outlet and refresh_limit_pause(db, outlet):
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
