"""Чистый расчёт напитка: цена/КБЖУ конфигурации, размеры, payload добавок.

Слой бизнес-логики БЕЗ FastAPI-роутов — раньше эта логика жила в routers/catalog.py и
импортировалась оттуда сервисом order_flow (нарушение слоёв: service → router). Вынесено сюда,
чтобы и публичный роут каталога, и сервис создания заказа зависели от одного общего модуля.

`preview_calc` работает целиком в памяти над уже загруженным Drink (с addon_links и sizes) и
готовым стоп-сетом — никаких запросов к БД здесь нет (правда о цене — на бэке, фронт дублирует).
"""
from fastapi import HTTPException
from pydantic import BaseModel

from .i18n import t


class PreviewSelection(BaseModel):
    addonId: int
    portions: int = 1


class PreviewIn(BaseModel):
    selections: list[PreviewSelection] = []
    sizeId: int | None = None  # выбранный размер; None => дефолтный/база


def active_sizes(d):
    """Активные размеры напитка, отсортированные; дефолтный — первым по флагу."""
    return [s for s in sorted(d.sizes, key=lambda s: s.sort) if s.is_active]


def size_label(s) -> str:
    """«400 ml» — снэпшот/подпись размера."""
    vol = int(s.volume) if float(s.volume).is_integer() else s.volume
    return f"{vol} {s.unit}"


def size_payload(s):
    return {"id": s.id, "volume": s.volume, "unit": s.unit, "label": size_label(s),
            "price": s.price, "isDefault": s.is_default}


def base_price(d) -> float:
    """Цена для витрины: цена дефолтного размера, иначе минимального, иначе base_price."""
    sizes = active_sizes(d)
    if not sizes:
        return d.base_price
    default = next((s for s in sizes if s.is_default), None)
    return (default or min(sizes, key=lambda s: s.price)).price


def addon_payload(link, locale, portions: int | None = None):
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


def preview_calc(drink, body: PreviewIn, locale: str, stop: dict) -> dict:
    """PUB-G-03: серверный пересчёт цены и КБЖУ выбранной конфигурации
    с валидацией лимитов и типов выбора. `drink` уже загружен (addon_links, sizes),
    `stop` — стоп-сет точки (REQ-3). Чистая функция: без обращений к БД."""
    links = {link.addon_id: link for link in drink.addon_links
             if link.addon.is_active and link.addon.category.is_active
             and link.addon_id not in stop["addon"]}

    # цена старта = выбранный размер (если задан и валиден), иначе дефолтный/база
    sizes = active_sizes(drink)
    size = None
    if body.sizeId is not None:
        size = next((s for s in sizes if s.id == body.sizeId), None)
        if size is None:
            raise HTTPException(409, "SIZE_NOT_AVAILABLE")
    elif sizes:
        size = next((s for s in sizes if s.is_default), sizes[0])
    total = size.price if size else drink.base_price
    kcal, protein, fat, carbs = drink.kcal, drink.protein, drink.fat, drink.carbs
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
        p = addon_payload(link, locale, sel.portions)
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
        "sizeLabel": size_label(size) if size else None,
        "kcal": round(kcal, 1), "protein": round(protein, 1),
        "fat": round(fat, 1), "carbs": round(carbs, 1),
        "addons": detailed,
    }
