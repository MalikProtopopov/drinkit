from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


class User(Base):
    """Клиент публичного сайта (PUB-A-06)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(80))
    car_plate: Mapped[str | None] = mapped_column(String(20))
    emirate: Mapped[str | None] = mapped_column(String(40))
    # язык фиксируется при регистрации и редактируется в ЛК (PUB-A-09)
    preferred_locale: Mapped[str] = mapped_column(String(5), default="ru")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class StaffUser(Base):
    """Персонал админки: super_admin | manager (ADM-S-06)."""

    __tablename__ = "staff_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(20), default="manager")  # super_admin | manager
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class OtpCode(Base):
    """OTP-коды (fallback-хранилище без Redis)."""

    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code: Mapped[str] = mapped_column(String(6))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class UiTranslation(Base):
    """Локализация интерфейсных строк публичного сайта (ADM-S-11).

    Контентные переводы (названия напитков и т.п.) живут в JSON-полях самих
    сущностей; здесь — словарь системных строк (статусы, кнопки, сообщения).
    """

    __tablename__ = "ui_translations"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    values: Mapped[dict] = mapped_column(JSON, default=dict)  # {"ru": "...", "ar": "..."}
