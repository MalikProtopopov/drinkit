import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


class CachedStaticFiles(StaticFiles):
    """StaticFiles с длинным иммутабельным кэшем для загруженных медиа.
    Имена файлов — uuid (контент не меняется), поэтому браузер кэширует картинки/видео
    на год и НЕ перезапрашивает их при повторном открытии карточки (фикс «видео грузится
    каждый раз заново»). Применяется только к успешным ответам (200/206/304)."""

    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        if resp.status_code < 400:
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return resp


from .core.db import Base, SessionLocal, engine
from .models import outlet  # noqa: F401  — регистрация таблиц локаций ДО create_all (см. models/__init__.py)
from .services.migrate import (backfill_category_slugs, backfill_nutrition_per_100,
                               backfill_outlets, backfill_payments, backfill_sizes,
                               ensure_schema, localize_catalog_en, upgrade_media_https)
from .services.seed import seed


from .core.config import settings  # noqa: E402


def _guard_prod_secrets() -> None:
    """Fail-closed в проде: запрещаем дефолтный JWT-секрет вне SQLite-разработки.
    Иначе утечкой дефолта `dev-secret-change-me` можно подделать staff-токен (super_admin)."""
    is_sqlite = settings.database_url.startswith("sqlite")
    if not is_sqlite and settings.jwt_secret == "dev-secret-change-me":
        raise RuntimeError(
            "JWT_SECRET не задан в проде: установите переменную окружения JWT_SECRET "
            "(дефолт 'dev-secret-change-me' допустим только для локального SQLite).")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DECISION: create_all + лёгкие миграции + сиды на старте вместо alembic —
    # достаточно для MVP; ensure_schema добивает недостающие колонки в уже
    # существующих таблицах (SQLite), backfill_sizes наполняет размеры по 400 ml.
    _guard_prod_secrets()
    Base.metadata.create_all(engine)
    ensure_schema(engine)
    with SessionLocal() as db:
        seed(db)
        backfill_category_slugs(db)
        backfill_sizes(db)
        backfill_nutrition_per_100(db)  # после backfill_sizes: абсолютные КБЖУ → per-100 (мл/г)
        localize_catalog_en(db)
        backfill_payments(db)
        backfill_outlets(db)  # последним: зависит от наличия orders + staff
        upgrade_media_https(db)  # http→https для media-URL (mixed content на https-сайте)
    yield


app = FastAPI(title="Juicy API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "Content-Disposition"],  # пагинация + имя файла выгрузки
)


# бэкенд-API не должен попадать в поисковую выдачу: noindex-заголовок на всех ответах
@app.middleware("http")
async def add_noindex_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    return response


@app.get("/robots.txt", include_in_schema=False)
def robots_txt():
    return PlainTextResponse("User-agent: *\nDisallow: /\n")


# загруженные медиа (картинки/видео из админки) отдаются по /media/*
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/media", CachedStaticFiles(directory=UPLOAD_DIR), name="media")


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"code": "VALIDATION_ERROR", "detail": str(exc)})


from .routers import (admin_catalog, admin_coupons, admin_customers, admin_exports,  # noqa: E402
                      admin_orders, admin_outlets, admin_payments, auth, catalog, coupons,
                      dashboard, orders, outlets, payments, screen, staff, ws)

app.include_router(catalog.router)
app.include_router(outlets.router)
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(coupons.router)
app.include_router(staff.router)
app.include_router(admin_catalog.router)
app.include_router(admin_orders.router)
app.include_router(admin_outlets.router)
app.include_router(admin_customers.router)
app.include_router(admin_payments.router)
app.include_router(admin_coupons.router)
app.include_router(dashboard.router)
app.include_router(admin_exports.router)
app.include_router(screen.router)
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}
