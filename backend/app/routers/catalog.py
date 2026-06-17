from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..models.catalog import Drink, DrinkCategory
from ..models.outlet import Outlet, OutletDrinkPriority
from ..services.drink_calc import (PreviewIn, active_sizes, addon_payload,
                                   base_price, drink_nutrition, preview_calc, size_payload)
from ..services.i18n import pick_locale, t
from ..services.outlet_service import load_stop_sets

router = APIRouter(prefix="/api", tags=["catalog"])

_BIG = 10 ** 9


def _public_outlet_id(db: Session) -> int | None:
    """Единственная активная точка для публичного каталога (D1: на паблике нет пикера).
    >1 или 0 активных → None (фильтрация по точке отключается, отдаём глобальный каталог)."""
    ids = db.scalars(select(Outlet.id).where(Outlet.is_active.is_(True)).limit(2)).all()
    return ids[0] if len(ids) == 1 else None


def _effective_outlet_id(db: Session, outlet_id: int | None) -> int | None:
    """Точка для стоп-листа/приоритетов витрины. При мультиточке фронт (/order) передаёт
    выбранный outletId — применяем стоп-лист именно этой активной точки (CAT-PUB/C1);
    иначе фолбэк на единственную активную."""
    if outlet_id is not None:
        ok = db.scalar(select(Outlet.id).where(Outlet.id == outlet_id, Outlet.is_active.is_(True)))
        if ok is not None:
            return outlet_id
    return _public_outlet_id(db)


@router.get("/categories")
def list_categories(locale: str = Query("ru"), outletId: int | None = Query(None),
                    db: Session = Depends(get_db)):
    """PUB-G-01: только активные категории, отсортированы."""
    locale = pick_locale(locale)
    cats = db.scalars(
        select(DrinkCategory).where(DrinkCategory.is_active.is_(True)).order_by(DrinkCategory.sort)
    ).all()
    # стоп-лист точки (REQ-3): скрываем застопленные категории на публичном сайте
    stop = load_stop_sets(db, _effective_outlet_id(db, outletId))
    cats = [c for c in cats if c.id not in stop["drink_category"]]
    return [
        {"id": c.id, "slug": c.slug, "name": t(c.name, locale),
         "photoUrl": c.photo_url, "videoUrl": c.video_url}
        for c in cats
    ]


@router.get("/drinks")
def list_drinks(
    category: str | None = Query(None, description="фильтр по slug категории (query-параметр, PUB-G-01 AC4)"),
    locale: str = Query("ru"),
    outletId: int | None = Query(None, description="точка витрины (мультиточка): её стоп-лист/приоритеты"),
    db: Session = Depends(get_db),
):
    locale = pick_locale(locale)
    q = select(Drink).options(selectinload(Drink.sizes)).where(Drink.status == "published")  # PUB-G-01 AC5
    if category:
        cat = db.scalar(select(DrinkCategory).where(DrinkCategory.slug == category))
        if cat is None:
            return []  # неизвестный slug → пустой список
        q = q.where(Drink.category_id == cat.id)
    drinks = db.scalars(q).all()
    # стоп-лист + приоритеты точки (REQ-3)
    outlet_id = _effective_outlet_id(db, outletId)
    stop = load_stop_sets(db, outlet_id)
    if stop["drink"] or stop["drink_category"]:
        drinks = [d for d in drinks
                  if d.id not in stop["drink"] and d.category_id not in stop["drink_category"]]
    prio = {}
    if outlet_id is not None:
        prio = {p.drink_id: p for p in db.scalars(
            select(OutletDrinkPriority).where(OutletDrinkPriority.outlet_id == outlet_id))}
    drinks.sort(key=lambda d: (0 if (d.id in prio and prio[d.id].pinned) else 1,
                               prio[d.id].sort if d.id in prio else _BIG, d.id))
    return [
        {
            "id": d.id, "slug": d.slug, "name": t(d.name, locale),
            "previewUrl": d.preview_url, "videoUrl": d.video_url,
            # цена «от» в карточке — по дефолтному/минимальному размеру;
            # ккал — для дефолтного размера (КБЖУ хранятся на 100 мл/г)
            "basePrice": base_price(d), "kcal": drink_nutrition(d)["kcal"],
            "categoryId": d.category_id,
        }
        for d in drinks
    ]


@router.get("/drinks/{slug}")
def drink_detail(slug: str, locale: str = Query("ru"), db: Session = Depends(get_db)):
    """PUB-G-02: деталка с доступными добавками; только активные добавки из активных категорий."""
    locale = pick_locale(locale)
    d = db.scalar(
        select(Drink)
        .options(selectinload(Drink.addon_links), selectinload(Drink.sizes),
                 selectinload(Drink.descriptions))
        .where(Drink.slug == slug)
    )
    if not d or d.status != "published":  # PUB-G-02 AC6
        raise HTTPException(404, "NOT_FOUND")
    # стоп-лист точки (REQ-3): застопленный напиток/категория недоступны на публичном сайте
    stop = load_stop_sets(db, _public_outlet_id(db))
    if d.id in stop["drink"] or d.category_id in stop["drink_category"]:
        raise HTTPException(404, "NOT_FOUND")
    # rich-описание строго в выбранной локали; нет — None (кнопка «Подробнее» скрывается)
    rich = next((x.body for x in d.descriptions if x.locale == locale and x.body), None)
    links = [
        link for link in d.addon_links
        if link.addon.is_active and link.addon.category.is_active  # PUB-G-02 AC5
        and link.addon_id not in stop["addon"]
    ]
    return {
        "id": d.id, "slug": d.slug, "name": t(d.name, locale),
        "description": t(d.description, locale), "videoUrl": d.video_url,
        # rich-описание для шторки «Подробнее» в выбранной локали (None => кнопку скрыть)
        "richDescription": rich,
        "previewUrl": d.preview_url, "basePrice": base_price(d),
        # размерные вариации напитка (ADM-S-05): выбор размера влияет на цену и КБЖУ
        "sizes": [size_payload(s) for s in active_sizes(d)],
        # КБЖУ для дефолтного размера (готовые к показу) + база на 100 мл/г для
        # клиентского пересчёта при смене размера (PUB-G-03, зеркало drink_nutrition)
        **drink_nutrition(d),
        "kcalPer100": d.kcal, "proteinPer100": d.protein,
        "fatPer100": d.fat, "carbsPer100": d.carbs,
        # «Детали напитка» (PUB-G-02): состав / аллергены / может содержать
        "ingredients": t(d.ingredients, locale),
        "allergens": t(d.allergens, locale),
        "mayContain": t(d.may_contain, locale),
        "addons": [addon_payload(link, locale) for link in links],
    }


@router.post("/drinks/{slug}/preview")
def drink_preview(slug: str, body: PreviewIn, locale: str = Query("ru"), db: Session = Depends(get_db)):
    """PUB-G-03: серверный пересчёт цены и КБЖУ выбранной конфигурации (правда — на бэке,
    фронт дублирует для UX). Тонкий роут: резолв напитка + стоп-сет точки → расчёт в drink_calc."""
    locale = pick_locale(locale)
    d = db.scalar(select(Drink)
                  .options(selectinload(Drink.addon_links), selectinload(Drink.sizes))
                  .where(Drink.slug == slug))
    if not d or d.status != "published":
        raise HTTPException(404, "NOT_FOUND")
    stop = load_stop_sets(db, _public_outlet_id(db))  # стоп-лист точки (REQ-3)
    return preview_calc(d, body, locale, stop)
