"""Локации (точки) JOOZ — outlets и всё, что висит на точке.

Бэкенд спроектирован под масштабирование (несколько точек), публичный сайт пока работает с одной
активной точкой. Термин кодовой базы — «outlet». См. docs/OUTLETS_PLAN.md.

ВАЖНО: модуль должен импортироваться ДО Base.metadata.create_all (см. app/models/__init__.py и
app/main.py) — иначе таблицы молча не создадутся.
"""
from datetime import datetime

from sqlalchemy import (JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String,
                        UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base


class Outlet(Base):
    """Точка продаж. Активность + рабочие часы + флаги задают рантайм-статус
    open/paused/closed/inactive (см. services/outlet_service.outlet_status)."""

    __tablename__ = "outlets"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True, default="")
    name: Mapped[dict] = mapped_column(JSON, default=dict)  # i18n {ru,ar,en}

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)        # главный рубильник (REQ-1)
    accepting_orders: Mapped[bool] = mapped_column(Boolean, default=True)  # ручная пауза
    auto_paused: Mapped[bool] = mapped_column(Boolean, default=False)      # авто-пауза по дневному лимиту (REQ-4)

    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    emirate: Mapped[str | None] = mapped_column(String(40), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    timezone: Mapped[str] = mapped_column(String(40), default="Asia/Dubai")
    # рабочие часы: { "0".."6" (0=пн): [ {"open":"HH:MM","close":"HH:MM"}, ... ] }, [] = выходной
    hours: Mapped[dict] = mapped_column(JSON, default=dict)

    daily_drink_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)  # NULL = без лимита (REQ-4)
    order_counter: Mapped[int] = mapped_column(Integer, default=1000)  # зарезервировано под нумерацию по точкам
    sort: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    staff_links = relationship("StaffOutlet", back_populates="outlet", cascade="all, delete-orphan")
    stop_items = relationship("OutletStopItem", back_populates="outlet", cascade="all, delete-orphan")
    drink_priorities = relationship("OutletDrinkPriority", back_populates="outlet",
                                    cascade="all, delete-orphan")
    events = relationship("OutletEvent", back_populates="outlet", cascade="all, delete-orphan",
                          order_by="OutletEvent.id.desc()")


class StaffOutlet(Base):
    """M2M «сотрудник ↔ точка» (REQ-2/7). super_admin = 0 строк (видит всё),
    manager = 1..N, screen = ровно 1. Инварианты — на уровне приложения (routers/staff.py)."""

    __tablename__ = "staff_outlets"
    __table_args__ = (UniqueConstraint("staff_id", "outlet_id", name="uq_staff_outlet"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_users.id", ondelete="CASCADE"), index=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id", ondelete="CASCADE"), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    outlet = relationship("Outlet", back_populates="staff_links")
    staff = relationship("StaffUser")


class OutletStopItem(Base):
    """Стоп-лист точки (REQ-3): скрывает напиток / категорию напитков / добавку на одной точке,
    НЕ трогая глобальные флаги. Полиморфная мягкая ссылка (как OrderItem.drink_id)."""

    __tablename__ = "outlet_stop_items"
    __table_args__ = (UniqueConstraint("outlet_id", "entity_type", "entity_id", name="uq_outlet_stop"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String(16))  # drink | drink_category | addon
    entity_id: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by_staff_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    outlet = relationship("Outlet", back_populates="stop_items")


class OutletDrinkPriority(Base):
    """Приоритет/порядок напитков на точке (REQ-3). У Drink нет глобального sort — это источник
    порядка для конкретной точки. Нет строки ⇒ дефолтный (большой) порядок."""

    __tablename__ = "outlet_drink_priorities"
    __table_args__ = (UniqueConstraint("outlet_id", "drink_id", name="uq_outlet_drink_priority"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id", ondelete="CASCADE"), index=True)
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), index=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)  # меньше = выше
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)

    outlet = relationship("Outlet", back_populates="drink_priorities")


class OutletEvent(Base):
    """Аудит/история точки (REQ-5): activated|deactivated|paused|resumed|hours_changed|
    limit_changed|limit_reached|staff_attached|staff_detached|stop_added|stop_removed."""

    __tablename__ = "outlet_events"
    __table_args__ = (Index("ix_outlet_events_outlet_created", "outlet_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(24))
    by_staff_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # NULL = системное
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    outlet = relationship("Outlet", back_populates="events")
