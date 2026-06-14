from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..models.catalog import Drink, DrinkCategory
from ..services.i18n import pick_locale, t

router = APIRouter(prefix="/api", tags=["catalog"])


def _active_sizes(d: Drink):
    """Активные размеры напитка, отсортированные; дефолтный — первым по флагу."""
    return [s for s in sorted(d.sizes, key=lambda s: s.sort) if s.is_active]


def _size_label(s) -> str:
    """«400 ml» — снэпшот/подпись размера."""
    vol = int(s.volume) if float(s.volume).is_integer() else s.volume
    return f"{vol} {s.unit}"


def _size_payload(s):
    return {"id": s.id, "volume": s.volume, "unit": s.unit, "label": _size_label(s),
            "price": s.price, "isDefault": s.is_default}


def _base_price(d: Drink) -> float:
    """Цена для витрины: цена дефолтного размера, иначе минимального, иначе base_price."""
    sizes = _active_sizes(d)
    if not sizes:
        return d.base_price
    default = next((s for s in sizes if s.is_default), None)
    return (default or min(sizes, key=lambda s: s.price)).price


def _addon_payload(link, locale, portions: int | None = None):
    a = link.addon
    n = portions if portions is not None else link.default_portions
    amount = n * link.portion_amount
    factor = amount / 100.0
    # price_override is None => добавка бесплатна (включена в стоимость) → цена 0,
    # иначе берётся override. Согласовано с флагом "free" в payload.
    price = 0.0 if link.price_override is None else link.price_override
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
        {"id": c.id, "slug": c.slug, "name": t(c.name, locale),
         "photoUrl": c.photo_url, "videoUrl": c.video_url}
        for c in cats
    ]


@router.get("/drinks")
def list_drinks(
    category: str | None = Query(None, description="фильтр по slug категории (query-параметр, PUB-G-01 AC4)"),
    locale: str = Query("ru"),
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
    return [
        {
            "id": d.id, "slug": d.slug, "name": t(d.name, locale),
            "previewUrl": d.preview_url, "videoUrl": d.video_url,
            # цена «от» в карточке — по дефолтному/минимальному размеру
            "basePrice": _base_price(d), "kcal": d.kcal, "categoryId": d.category_id,
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
    # rich-описание строго в выбранной локали; нет — None (кнопка «Подробнее» скрывается)
    rich = next((x.body for x in d.descriptions if x.locale == locale and x.body), None)
    links = [
        link for link in d.addon_links
        if link.addon.is_active and link.addon.category.is_active  # PUB-G-02 AC5
    ]
    return {
        "id": d.id, "slug": d.slug, "name": t(d.name, locale),
        "description": t(d.description, locale), "videoUrl": d.video_url,
        # rich-описание для шторки «Подробнее» в выбранной локали (None => кнопку скрыть)
        "richDescription": rich,
        "previewUrl": d.preview_url, "basePrice": _base_price(d),
        # размерные вариации напитка (ADM-S-05): выбор размера влияет на цену
        "sizes": [_size_payload(s) for s in _active_sizes(d)],
        "kcal": d.kcal, "protein": d.protein, "fat": d.fat, "carbs": d.carbs,
        # «Детали напитка» (PUB-G-02): состав / аллергены / может содержать
        "ingredients": t(d.ingredients, locale),
        "allergens": t(d.allergens, locale),
        "mayContain": t(d.may_contain, locale),
        "addons": [_addon_payload(link, locale) for link in links],
    }


class PreviewSelection(BaseModel):
    addonId: int
    portions: int = 1


class PreviewIn(BaseModel):
    selections: list[PreviewSelection] = []
    sizeId: int | None = None  # выбранный размер; None => дефолтный/база


@router.post("/drinks/{slug}/preview")
def drink_preview(slug: str, body: PreviewIn, locale: str = Query("ru"), db: Session = Depends(get_db)):
    """PUB-G-03: серверный пересчёт цены и КБЖУ выбранной конфигурации
    с валидацией лимитов и типов выбора (правда — на бэке, фронт дублирует для UX)."""
    locale = pick_locale(locale)
    d = db.scalar(select(Drink)
                  .options(selectinload(Drink.addon_links), selectinload(Drink.sizes))
                  .where(Drink.slug == slug))
    if not d or d.status != "published":
        raise HTTPException(404, "NOT_FOUND")
    links = {link.addon_id: link for link in d.addon_links
             if link.addon.is_active and link.addon.category.is_active}

    # цена старта = выбранный размер (если задан и валиден), иначе дефолтный/база
    sizes = _active_sizes(d)
    size = None
    if body.sizeId is not None:
        size = next((s for s in sizes if s.id == body.sizeId), None)
        if size is None:
            raise HTTPException(409, "SIZE_NOT_AVAILABLE")
    elif sizes:
        size = next((s for s in sizes if s.is_default), sizes[0])
    total = size.price if size else d.base_price
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
        "sizeId": size.id if size else None,
        "sizeLabel": _size_label(size) if size else None,
        "kcal": round(kcal, 1), "protein": round(protein, 1),
        "fat": round(fat, 1), "carbs": round(carbs, 1),
        "addons": detailed,
    }
