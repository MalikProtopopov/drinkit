"""Регистрация всех моделей в Base.metadata (для create_all / Alembic autogenerate)."""
from . import catalog, locations, orders, users  # noqa: F401
