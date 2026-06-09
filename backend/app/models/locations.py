"""Локации GRABZI: точки выдачи с дневным лимитом напитков, часами по дням недели,
операционной паузой, стоп-листом напитков и журналом статусных событий.

Дизайн — план §5.1/§5.12/§5.14/§5.15:
- daily_drink_limit: int | None  (None = без лимита)
- accepting_orders: bool          (ручная операционная пауза, super_admin)
- working_hours: JSON по дням недели {"mon":[{"open":"05:30","close":"22:00"}], ... "sun":[]}
- лимит считается В НАПИТКАХ (sum quantity) через materialized LocationDailyCounter
- статус точки (open/paused/closed) НЕ хранится — вычисляется на чтении из
  is_active + accepting_orders + расписания.
"""
from datetime import date, datetime

from sqlalchemy import (JSON, Boolean, Date, DateTime, ForeignKey, Integer, String,
                        UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    # контентные поля локализуемы (JSON i18n {"en": "..."}), заполняем en (план §3.3)
    name: Mapped[dict] = mapped_column(JSON, default=dict)
    description: Mapped[dict] = mapped_column(JSON, default=dict)
    address: Mapped[str | None] = mapped_column(String(300))
    coordinates: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {"lat":..,"lng":..}

    # время открытия/закрытия по каждому дню недели (план §5.5)
    working_hours: Mapped[dict] = mapped_column(JSON, default=dict)
    timezone: Mapped[str] = mapped_column(String(40), default="Asia/Dubai")

    # дневной лимит напитков: None = без лимита (план §5.1, Р5.1)
    daily_drink_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # ручная операционная пауза приёма заказов (план §5.14, super_admin)
    accepting_orders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    color: Mapped[str | None] = mapped_column(String(20))
    image_url: Mapped[str | None] = mapped_column(String(300))  # относительный ключ MinIO
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    counters = relationship("LocationDailyCounter", back_populates="location",
                            cascade="all, delete-orphan")
    stops = relationship("LocationDrinkStop", back_populates="location",
                         cascade="all, delete-orphan")
    status_events = relationship("LocationStatusEvent", back_populates="location",
                                 cascade="all, delete-orphan",
                                 order_by="LocationStatusEvent.id")


class LocationDailyCounter(Base):
    """Materialized счётчик проданных НАПИТКОВ за торговый день точки.

    Инкремент O(1) под FOR UPDATE в mark_paid; декремент при refund того же дня.
    Уникальность (location_id, business_date) — одна строка на точку-день.
    """

    __tablename__ = "location_daily_counters"
    __table_args__ = (UniqueConstraint("location_id", "business_date",
                                       name="uq_location_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id", ondelete="CASCADE"),
                                             index=True)
    business_date: Mapped[date] = mapped_column(Date, index=True)  # день в tz локации
    committed_drinks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(),
                                                 onupdate=func.now())

    location = relationship("Location", back_populates="counters")


class LocationDrinkStop(Base):
    """Операционный стоп напитка в конкретной локации: «кончилось здесь» (план §5.15).

    Отдельная ось от глобального Drink.status=hidden. Стоп = наличие строки;
    снятие = удаление строки. Аудит — в LocationStatusEvent.
    """

    __tablename__ = "location_drink_stops"
    __table_args__ = (UniqueConstraint("location_id", "drink_id",
                                       name="uq_location_drink"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id", ondelete="CASCADE"),
                                             index=True)
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"),
                                          index=True)
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    by_staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    location = relationship("Location", back_populates="stops")


class LocationStatusEvent(Base):
    """История операционных событий точки: пауза/возобновление, стоп/возврат напитка
    (план §5.14, по паттерну OrderEvent). Опциональный аудит-блок."""

    __tablename__ = "location_status_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id", ondelete="CASCADE"),
                                             index=True)
    action: Mapped[str] = mapped_column(String(20))  # pause|open|drink_stopped|drink_resumed
    drink_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # для стоп-событий
    by_staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    location = relationship("Location", back_populates="status_events")


class AppSetting(Base):
    """Глобальные бизнес-дефолты, редактируемые super_admin на /admin/settings (план §5.17).

    Типизированный key-value: value — JSON-конверт {"v": <typed>}. Реестр допустимых
    ключей — в services/settings_registry.py (источник типов/дефолтов)."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(),
                                                 onupdate=func.now())
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"), nullable=True)


class InfoBlock(Base):
    """Редактируемый контент публичного сайта: Story / Contact / соцсети / блоки
    (план §5.11.1, /admin/content). Контент локализуем JSON i18n."""

    __tablename__ = "info_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[dict] = mapped_column(JSON, default=dict)   # {"en": "..."}
    body: Mapped[dict] = mapped_column(JSON, default=dict)    # {"en": "..."} richtext
    sort: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(),
                                                 onupdate=func.now())
