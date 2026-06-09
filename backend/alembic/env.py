"""Alembic environment (план §5.12/§13).

DSN и metadata берём из приложения (единый источник). Для SQLite включаем batch-mode
(ALTER через пересоздание таблицы). Для SQLite также включаем PRAGMA foreign_keys=ON.
"""
from logging.config import fileConfig

from sqlalchemy import engine_from_config, event, pool

from alembic import context

# импорт приложения: единый DSN + все модели зарегистрированы в Base.metadata
from app import models  # noqa: F401  — регистрирует таблицы
from app.core.config import settings
from app.core.db import Base

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
_is_sqlite = settings.database_url.startswith("sqlite")


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url, target_metadata=target_metadata,
        literal_binds=True, compare_type=True, render_as_batch=_is_sqlite,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    if _is_sqlite:
        @event.listens_for(connectable, "connect")
        def _fk_on(dbapi_conn, _):
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata,
            compare_type=True, render_as_batch=_is_sqlite,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
