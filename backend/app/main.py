from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import models  # noqa: F401  — регистрирует все таблицы в Base.metadata
from .core.db import Base, SessionLocal, engine
from .services.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DECISION: create_all + сиды на старте вместо alembic — достаточно для dev;
    # прод использует Alembic (план §5.12). SEED_BRAND выбирает сид-набор:
    #   juicy (по умолчанию, тесты) | grabzi (GRABZI-инстанс) | none
    import os
    Base.metadata.create_all(engine)
    brand = os.environ.get("SEED_BRAND", "juicy")
    with SessionLocal() as db:
        if brand == "grabzi":
            from .services.seed_grabzi import seed_grabzi
            seed_grabzi(db)
        elif brand != "none":
            seed(db)
    yield


app = FastAPI(title="Juicy API", version="1.0", lifespan=lifespan)

from .core.config import settings  # noqa: E402

_cors = ["*"] if settings.cors_origins.strip() == "*" else [
    o.strip() for o in settings.cors_origins.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"code": "VALIDATION_ERROR", "detail": str(exc)})


from .routers import (admin_catalog, admin_locations, admin_media, admin_orders,  # noqa: E402
                      admin_settings, auth, catalog, content, coupons, dashboard,
                      locations, orders, payments, staff, ws)

app.include_router(catalog.router)
app.include_router(locations.router)
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(coupons.router)
app.include_router(staff.router)
app.include_router(admin_catalog.router)
app.include_router(admin_orders.router)
app.include_router(admin_locations.router)
app.include_router(admin_locations.status_router)
app.include_router(admin_settings.router)
app.include_router(admin_media.router)
app.include_router(content.router)
app.include_router(content.public_router)
app.include_router(dashboard.router)
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}
