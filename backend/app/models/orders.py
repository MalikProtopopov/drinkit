from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base

# Единая цепочка статусов (§0.1, решение владельца — ОДНО поле):
ORDER_STATUSES = ["new", "in_progress", "ready", "completed", "refund"]
# кто имеет право ставить какой статус:
STATUS_SETTER = {
    "new": "system",
    "in_progress": "staff",
    "ready": "staff",
    "completed": "staff",
    "refund": "staff",  # опциональный модуль ADM-M-06
}
# прибытие клиента — независимый флаг Order.arrived_at (ставит клиент в любой момент после оплаты)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(15), default="new", index=True)
    payment_status: Mapped[str] = mapped_column(String(15), default="pending")  # pending|paid|failed|refunded

    customer_name: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(20))
    car_plate: Mapped[str] = mapped_column(String(20))
    emirate: Mapped[str | None] = mapped_column(String(40))

    subtotal: Mapped[float] = mapped_column(Float, default=0)
    coupon_discount: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)

    manager_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"), nullable=True)
    coupon_id: Mapped[int | None] = mapped_column(ForeignKey("coupons.id"), nullable=True)

    rating: Mapped[str | None] = mapped_column(String(8), nullable=True)  # like | dislike
    rated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    events = relationship("OrderEvent", back_populates="order", cascade="all, delete-orphan",
                          order_by="OrderEvent.id")
    payments = relationship("Payment", back_populates="order")


class OrderItem(Base):
    """Позиция заказа — снэпшот на момент покупки (ADM-M-05 AC4)."""

    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    drink_id: Mapped[int] = mapped_column(Integer)
    drink_name: Mapped[str] = mapped_column(String(160))  # снэпшот в локали заказа
    custom_name: Mapped[str | None] = mapped_column(String(60))
    size_label: Mapped[str | None] = mapped_column(String(20), nullable=True)  # снэпшот размера, напр. «400 ml»
    unit_price: Mapped[float] = mapped_column(Float)  # цена напитка со всеми добавками
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    paid_by_coupon: Mapped[bool] = mapped_column(Boolean, default=False)  # PUB-A-05

    order = relationship("Order", back_populates="items")
    addons = relationship("OrderItemAddon", cascade="all, delete-orphan")


class OrderItemAddon(Base):
    __tablename__ = "order_item_addons"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id"), index=True)
    addon_id: Mapped[int] = mapped_column(Integer)
    addon_name: Mapped[str] = mapped_column(String(160))
    portions: Mapped[int] = mapped_column(Integer, default=1)
    amount: Mapped[float] = mapped_column(Float, default=0)  # граммовка: portions * portion_amount
    unit_code: Mapped[str] = mapped_column(String(20), default="g")
    price_per_portion: Mapped[float] = mapped_column(Float, default=0)


class OrderEvent(Base):
    """История заказа (§0.1): создание, оплата, смены статуса, купон, оценка."""

    __tablename__ = "order_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    type: Mapped[str] = mapped_column(String(20))  # created|paid|status_change|coupon_applied|rated|refund
    status: Mapped[str | None] = mapped_column(String(15), nullable=True)
    by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    by_staff_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    order = relationship("Order", back_populates="events")


class Payment(Base):
    """Платежи (ADM-S-09); связь заказ↔платёж↔клиент."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(5), default="AED")
    provider: Mapped[str] = mapped_column(String(20), default="stripe")
    provider_id: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(15), default="pending")  # pending|succeeded|failed|refunded
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    order = relationship("Order", back_populates="payments")


class Coupon(Base):
    """Купон за дизлайк (PUB-A-04/05, ADM-S-12): 1 на заказ, списывает 1 напиток."""

    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    source_order_id: Mapped[int] = mapped_column(Integer)  # заказ с дизлайком
    status: Mapped[str] = mapped_column(String(10), default="active")  # active|used|void
    issued_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_order_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    used_item_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    discount_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
