"""baseline — текущая схема (Juicy + GRABZI-локации) из Base.metadata

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-10

Baseline (план §5.12): на чистой БД создаёт все таблицы из метаданных моделей
(включая GRABZI: locations, location_daily_counters, location_drink_stops,
location_status_events, app_settings, info_blocks, orders.location_id, staff_users.location_id).
На уже существующей prod-БД (создана через create_all) применяется как `alembic stamp head`
без выполнения DDL.

Денежные поля останутся как в моделях; перевод Float→Numeric(10,2) — отдельной ревизией 0002.
"""
from typing import Sequence, Union

from app import models  # noqa: F401  — регистрирует все таблицы в Base.metadata
from app.core.db import Base
from alembic import op

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind)
