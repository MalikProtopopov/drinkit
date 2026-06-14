from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.db import Base, SessionLocal, engine
from .services.migrate import (backfill_category_slugs, backfill_sizes, ensure_schema,
                               localize_catalog_en)
from .services.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DECISION: create_all + лёгкие миграции + сиды на старте вместо alembic —
    # достаточно для MVP; ensure_schema добивает недостающие колонки в уже
    # существующих таблицах (SQLite), backfill_sizes наполняет размеры по 400 ml.
    Base.metadata.create_all(engine)
    ensure_schema(engine)
    with SessionLocal() as db:
        seed(db)
        backfill_category_slugs(db)
        backfill_sizes(db)
        localize_catalog_en(db)
    yield


app = FastAPI(title="Juicy API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"code": "VALIDATION_ERROR", "detail": str(exc)})


from .routers import admin_catalog, admin_orders, auth, catalog, coupons, dashboard, orders, payments, staff, ws  # noqa: E402

app.include_router(catalog.router)
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(coupons.router)
app.include_router(staff.router)
app.include_router(admin_catalog.router)
app.include_router(admin_orders.router)
app.include_router(dashboard.router)
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}
