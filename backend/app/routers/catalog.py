from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..models.catalog import Drink, DrinkCategory
from ..services.i18n import pick_locale, t

router = APIRouter(prefix="/api", tags=["catalog"])


def _addon_payload(link, locale, portions: int | None = None):
    a = link.addon
    n = portions if portions is not None else link.default_portions
    amount = n * link.portion_amount
    factor = amount / 100.0
    price = a.base_price if link.price_override is None else link.price_override
    return {
        "addonId": a.id,
        "name": t(a.name, locale),
        "imageUrl": a.image_url,
        "categoryId": a.category_id,
        "categoryName": t(a.category.name, locale),
        "selectionType": link.selection_type_override or a.category.selection_type,
        "unit": a.unit.code,
        "free": link.price_override is None,
        "pricePerPortion": price,
        "minPortions": link.min_portions,
        "defaultPortions": link.default_portions,
        "maxPortions": link.max_portions,
        "portionAmount": link.portion_amount,
        # КБЖУ, пересчитанные на объём (PUB-G-03 AC2/AC3)
        "kcal": round(a.kcal_per_100 * factor, 1),
        "protein": round(a.protein_per_100 * factor, 1),
        "fat": round(a.fat_per_100 * factor, 1),
        "carbs": round(a.carbs_per_100 * factor, 1),
    }


@router.get("/categories")
def list_categories(locale: str = Query("ru"), db: Session = Depends(get_db)):
    """PUB-G-01: только активные категории, отсортированы."""
    locale = pick_locale(locale)
    cats = db.scalars(
        select(DrinkCategory).where(DrinkCategory.is_active.is_(True)).order_by(DrinkCategory.sort)
    ).all()
    return [
        {"id": c.id, "name": t(c.name, locale), "photoUrl": c.photo_url, "videoUrl": c.video_url}
        for c in cats
    ]


@router.get("/drinks")
def list_drinks(
    category: int | None = Query(None, description="фильтр по id категории (query-параметр, PUB-G-01 AC4)"),
    locale: str = Query("ru"),
    db: Session = Depends(get_db),
):
    locale = pick_locale(locale)
    q = select(Drink).where(Drink.status == "published")  # PUB-G-01 AC5
    if category is not None:
        q = q.where(Drink.category_id == category)
    drinks = db.scalars(q).all()
    return [
        {
            "id": d.id, "slug": d.slug, "name": t(d.name, locale),
            "previewUrl": d.preview_url, "videoUrl": d.video_url,
            "basePrice": d.base_price, "kcal": d.kcal, "categoryId": d.category_id,
        }
        for d in drinks
    ]


@router.get("/drinks/{slug}")
def drink_detail(slug: str, locale: str = Query("ru"), db: Session = Depends(get_db)):
    """PUB-G-02: деталка с доступными добавками; только активные добавки из активных категорий."""
    locale = pick_locale(locale)
    d = db.scalar(
        select(Drink)
        .options(selectinload(Drink.addon_links))
        .where(Drink.slug == slug)
    )
    if not d or d.status != "published":  # PUB-G-02 AC6
        raise HTTPException(404, "NOT_FOUND")
    links = [
        link for link in d.addon_links
        if link.addon.is_active and link.addon.category.is_active  # PUB-G-02 AC5
    ]
    return {
        "id": d.id, "slug": d.slug, "name": t(d.name, locale),
        "description": t(d.description, locale), "videoUrl": d.video_url,
        "previewUrl": d.preview_url, "basePrice": d.base_price,
        "kcal": d.kcal, "protein": d.protein, "fat": d.fat, "carbs": d.carbs,
        "addons": [_addon_payload(link, locale) for link in links],
    }


class PreviewSelection(BaseModel):
    addonId: int
    portions: int = 1


class PreviewIn(BaseModel):
    selections: list[PreviewSelection] = []


@router.post("/drinks/{slug}/preview")
def drink_preview(slug: str, body: PreviewIn, locale: str = Query("ru"), db: Session = Depends(get_db)):
    """PUB-G-03: серверный пересчёт цены и КБЖУ выбранной конфигурации
    с валидацией лимитов и типов выбора (правда — на бэке, фронт дублирует для UX)."""
    locale = pick_locale(locale)
    d = db.scalar(select(Drink).options(selectinload(Drink.addon_links)).where(Drink.slug == slug))
    if not d or d.status != "published":
        raise HTTPException(404, "NOT_FOUND")
    links = {link.addon_id: link for link in d.addon_links
             if link.addon.is_active and link.addon.category.is_active}

    total = d.base_price
    kcal, protein, fat, carbs = d.kcal, d.protein, d.fat, d.carbs
    by_category: dict[int, list] = {}
    detailed = []

    for sel in body.selections:
        link = links.get(sel.addonId)
        if link is None:
            raise HTTPException(409, "ADDON_NOT_AVAILABLE")
        if not (link.min_portions <= sel.portions <= link.max_portions):
            raise HTTPException(409, "ADDON_PORTIONS_OUT_OF_RANGE")
        stype = link.selection_type_override or link.addon.category.selection_type
        by_category.setdefault(link.addon.category_id, []).append((sel, stype))
        p = _addon_payload(link, locale, sel.portions)
        total += p["pricePerPortion"] * sel.portions
        kcal += p["kcal"]; protein += p["protein"]; fat += p["fat"]; carbs += p["carbs"]
        detailed.append({**p, "portions": sel.portions})

    # типы выбора (ADM-S-02 AC4): single — одна добавка в категории и 1 порция;
    # multi — несколько добавок по 1 порции; counter — порции в пределах лимитов
    for cat_id, sels in by_category.items():
        stype = sels[0][1]
        if stype == "single" and (len(sels) > 1 or sels[0][0].portions > 1):
            raise HTTPException(409, "SELECTION_TYPE_VIOLATED")
        if stype == "multi" and any(s.portions > 1 for s, _ in sels):
            raise HTTPException(409, "SELECTION_TYPE_VIOLATED")

    return {
        "price": round(total, 2),
        "kcal": round(kcal, 1), "protein": round(protein, 1),
        "fat": round(fat, 1), "carbs": round(carbs, 1),
        "addons": detailed,
    }
