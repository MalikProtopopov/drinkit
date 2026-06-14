"""Админка-каталог (ADM-S-01..05): CRUD категорий напитков, категорий добавок,
добавок, единиц измерения, напитков и связки напиток×добавка."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..core.security import require_super_admin
from ..models.catalog import (Addon, AddonCategory, Drink, DrinkAddon, DrinkCategory,
                              DrinkDescription, DrinkSize, Unit)
from ..services.migrate import slugify
from ..services.sanitize_html import sanitize_html

# Локали, доступные для rich-описаний в админке (шире публичных — на вырост EN)
DESC_LOCALES = ["ru", "en", "ar"]

router = APIRouter(prefix="/api/admin/catalog", tags=["admin-catalog"],
                   dependencies=[Depends(require_super_admin)])


# ---------- Категории напитков (ADM-S-01) ----------

class DrinkCategoryIn(BaseModel):
    name: dict
    slug: str | None = None
    photoUrl: str | None = None
    videoUrl: str | None = None
    isActive: bool = True
    sort: int = 0


def _cat(c: DrinkCategory):
    return {"id": c.id, "slug": c.slug, "name": c.name, "photoUrl": c.photo_url,
            "videoUrl": c.video_url, "isActive": c.is_active, "sort": c.sort}


def _resolve_slug(body: "DrinkCategoryIn", db: Session, exclude_id: int | None = None) -> str:
    """slug из тела (нормализованный) либо сгенерированный из имени; проверка уникальности."""
    raw = body.slug or (body.name or {}).get("ru", "")
    slug = slugify(raw)
    if not slug:
        raise HTTPException(422, "SLUG_REQUIRED")
    clash = db.scalar(select(DrinkCategory).where(DrinkCategory.slug == slug))
    if clash and clash.id != exclude_id:
        raise HTTPException(409, "SLUG_TAKEN")
    return slug


@router.get("/drink-categories")
def list_drink_categories(db: Session = Depends(get_db)):
    return [_cat(c) for c in db.scalars(select(DrinkCategory).order_by(DrinkCategory.sort)).all()]


@router.post("/drink-categories")
def create_drink_category(body: DrinkCategoryIn, db: Session = Depends(get_db)):
    c = DrinkCategory(name=body.name, slug=_resolve_slug(body, db), photo_url=body.photoUrl,
                      video_url=body.videoUrl, is_active=body.isActive, sort=body.sort)
    db.add(c); db.commit()
    return _cat(c)


@router.patch("/drink-categories/{cat_id}")
def update_drink_category(cat_id: int, body: DrinkCategoryIn, db: Session = Depends(get_db)):
    c = db.get(DrinkCategory, cat_id)
    if not c:
        raise HTTPException(404, "NOT_FOUND")
    c.name, c.photo_url, c.video_url = body.name, body.photoUrl, body.videoUrl
    c.is_active, c.sort = body.isActive, body.sort
    c.slug = _resolve_slug(body, db, exclude_id=cat_id)
    db.commit()
    return _cat(c)


# ---------- Единицы измерения (ADM-S-04) ----------

class UnitIn(BaseModel):
    code: str
    name: dict


@router.get("/units")
def list_units(db: Session = Depends(get_db)):
    return [{"id": u.id, "code": u.code, "name": u.name} for u in db.scalars(select(Unit)).all()]


@router.post("/units")
def create_unit(body: UnitIn, db: Session = Depends(get_db)):
    if db.scalar(select(Unit).where(Unit.code == body.code)):
        raise HTTPException(409, "CODE_TAKEN")
    u = Unit(code=body.code, name=body.name)
    db.add(u); db.commit()
    return {"id": u.id, "code": u.code, "name": u.name}


# ---------- Категории добавок (ADM-S-02) ----------

class AddonCategoryIn(BaseModel):
    name: dict
    iconUrl: str | None = None
    isActive: bool = True
    selectionType: str = "counter"  # single | multi | counter


def _acat(c: AddonCategory):
    return {"id": c.id, "name": c.name, "iconUrl": c.icon_url,
            "isActive": c.is_active, "selectionType": c.selection_type}


@router.get("/addon-categories")
def list_addon_categories(db: Session = Depends(get_db)):
    return [_acat(c) for c in db.scalars(select(AddonCategory)).all()]


@router.post("/addon-categories")
def create_addon_category(body: AddonCategoryIn, db: Session = Depends(get_db)):
    if body.selectionType not in ("single", "multi", "counter"):
        raise HTTPException(422, "VALIDATION_ERROR")
    c = AddonCategory(name=body.name, icon_url=body.iconUrl, is_active=body.isActive,
                      selection_type=body.selectionType)
    db.add(c); db.commit()
    return _acat(c)


@router.patch("/addon-categories/{cat_id}")
def update_addon_category(cat_id: int, body: AddonCategoryIn, db: Session = Depends(get_db)):
    if body.selectionType not in ("single", "multi", "counter"):
        raise HTTPException(422, "VALIDATION_ERROR")
    c = db.get(AddonCategory, cat_id)
    if not c:
        raise HTTPException(404, "NOT_FOUND")
    c.name, c.icon_url, c.is_active, c.selection_type = (
        body.name, body.iconUrl, body.isActive, body.selectionType)
    db.commit()
    return _acat(c)


# ---------- Добавки (ADM-S-03) ----------

class AddonIn(BaseModel):
    name: dict
    imageUrl: str | None = None
    categoryId: int
    unitId: int  # привязка единицы на деталке добавки (решение владельца)
    kcalPer100: float = Field(0, ge=0)
    proteinPer100: float = Field(0, ge=0)
    fatPer100: float = Field(0, ge=0)
    carbsPer100: float = Field(0, ge=0)
    basePrice: float = Field(0, ge=0)
    isActive: bool = True


def _addon(a: Addon):
    return {"id": a.id, "name": a.name, "imageUrl": a.image_url, "categoryId": a.category_id,
            "unitId": a.unit_id, "kcalPer100": a.kcal_per_100, "proteinPer100": a.protein_per_100,
            "fatPer100": a.fat_per_100, "carbsPer100": a.carbs_per_100,
            "basePrice": a.base_price, "isActive": a.is_active}


@router.get("/addons")
def list_addons(db: Session = Depends(get_db)):
    return [_addon(a) for a in db.scalars(select(Addon)).all()]


def _check_addon_refs(body: "AddonIn", db: Session):
    if not db.get(AddonCategory, body.categoryId) or not db.get(Unit, body.unitId):
        raise HTTPException(422, "VALIDATION_ERROR")  # категория/единица должны существовать


@router.post("/addons")
def create_addon(body: AddonIn, db: Session = Depends(get_db)):
    _check_addon_refs(body, db)
    a = Addon(name=body.name, image_url=body.imageUrl, category_id=body.categoryId,
              unit_id=body.unitId, kcal_per_100=body.kcalPer100, protein_per_100=body.proteinPer100,
              fat_per_100=body.fatPer100, carbs_per_100=body.carbsPer100,
              base_price=body.basePrice, is_active=body.isActive)
    db.add(a); db.commit()
    return _addon(a)


@router.patch("/addons/{addon_id}")
def update_addon(addon_id: int, body: AddonIn, db: Session = Depends(get_db)):
    a = db.get(Addon, addon_id)
    if not a:
        raise HTTPException(404, "NOT_FOUND")
    _check_addon_refs(body, db)
    a.name, a.image_url, a.category_id, a.unit_id = body.name, body.imageUrl, body.categoryId, body.unitId
    a.kcal_per_100, a.protein_per_100, a.fat_per_100, a.carbs_per_100 = (
        body.kcalPer100, body.proteinPer100, body.fatPer100, body.carbsPer100)
    a.base_price, a.is_active = body.basePrice, body.isActive
    db.commit()
    return _addon(a)


# ---------- Напитки + связка (ADM-S-05) ----------

class DrinkIn(BaseModel):
    slug: str
    name: dict
    description: dict = {}
    status: str = "draft"  # draft | published | hidden
    previewUrl: str | None = None
    videoUrl: str | None = None
    basePrice: float = Field(0, ge=0)
    kcal: float = Field(0, ge=0)
    protein: float = Field(0, ge=0)
    fat: float = Field(0, ge=0)
    carbs: float = Field(0, ge=0)
    categoryId: int


class BindingIn(BaseModel):
    addonId: int
    priceOverride: float | None = None  # null => бесплатно (включено в стоимость)
    minPortions: int = 0
    defaultPortions: int = 1
    maxPortions: int = 3
    portionAmount: float = 30
    selectionTypeOverride: str | None = None


class SizeIn(BaseModel):
    volume: float = Field(0, ge=0)
    unit: str = "ml"
    price: float = Field(0, ge=0)
    isDefault: bool = False
    isActive: bool = True
    sort: int = 0


def _drink(d: Drink):
    return {"id": d.id, "slug": d.slug, "name": d.name, "description": d.description,
            "status": d.status, "previewUrl": d.preview_url, "videoUrl": d.video_url,
            "basePrice": d.base_price, "kcal": d.kcal, "protein": d.protein,
            "fat": d.fat, "carbs": d.carbs, "categoryId": d.category_id,
            "sizes": [
                {"id": s.id, "volume": s.volume, "unit": s.unit, "price": s.price,
                 "isDefault": s.is_default, "isActive": s.is_active, "sort": s.sort}
                for s in sorted(d.sizes, key=lambda s: s.sort)
            ],
            "descriptions": [
                {"locale": x.locale, "body": x.body}
                for x in sorted(d.descriptions, key=lambda x: x.locale)
            ],
            "bindings": [
                {"id": l.id, "addonId": l.addon_id, "priceOverride": l.price_override,
                 "minPortions": l.min_portions, "defaultPortions": l.default_portions,
                 "maxPortions": l.max_portions, "portionAmount": l.portion_amount,
                 "selectionTypeOverride": l.selection_type_override}
                for l in d.addon_links
            ]}


@router.get("/drinks")
def admin_list_drinks(db: Session = Depends(get_db)):
    """Все напитки, включая черновики и скрытые."""
    return [_drink(d) for d in db.scalars(
        select(Drink).options(selectinload(Drink.addon_links), selectinload(Drink.sizes),
                              selectinload(Drink.descriptions))).all()]


@router.post("/drinks")
def create_drink(body: DrinkIn, db: Session = Depends(get_db)):
    if body.status not in ("draft", "published", "hidden"):
        raise HTTPException(422, "VALIDATION_ERROR")
    if db.scalar(select(Drink).where(Drink.slug == body.slug)):
        raise HTTPException(409, "SLUG_TAKEN")
    d = Drink(slug=body.slug, name=body.name, description=body.description, status=body.status,
              preview_url=body.previewUrl, video_url=body.videoUrl, base_price=body.basePrice,
              kcal=body.kcal, protein=body.protein, fat=body.fat, carbs=body.carbs,
              category_id=body.categoryId)
    db.add(d); db.commit()
    return _drink(d)


@router.patch("/drinks/{drink_id}")
def update_drink(drink_id: int, body: DrinkIn, db: Session = Depends(get_db)):
    if body.status not in ("draft", "published", "hidden"):
        raise HTTPException(422, "VALIDATION_ERROR")
    d = db.get(Drink, drink_id)
    if not d:
        raise HTTPException(404, "NOT_FOUND")
    d.slug, d.name, d.description, d.status = body.slug, body.name, body.description, body.status
    d.preview_url, d.video_url, d.base_price = body.previewUrl, body.videoUrl, body.basePrice
    d.kcal, d.protein, d.fat, d.carbs, d.category_id = (
        body.kcal, body.protein, body.fat, body.carbs, body.categoryId)
    db.commit()
    return _drink(d)


@router.put("/drinks/{drink_id}/bindings")
def set_bindings(drink_id: int, body: list[BindingIn], db: Session = Depends(get_db)):
    """Полная замена связок напитка (промежуточная таблица, ADM-S-05 AC3)."""
    d = db.scalar(select(Drink).options(selectinload(Drink.addon_links)).where(Drink.id == drink_id))
    if not d:
        raise HTTPException(404, "NOT_FOUND")
    for b in body:
        if not db.get(Addon, b.addonId):
            raise HTTPException(409, f"ADDON_NOT_FOUND:{b.addonId}")
        if not (0 <= b.minPortions <= b.defaultPortions <= b.maxPortions):
            raise HTTPException(422, "PORTIONS_RANGE_INVALID")
    d.addon_links.clear()
    db.flush()
    for b in body:
        db.add(DrinkAddon(drink_id=d.id, addon_id=b.addonId, price_override=b.priceOverride,
                          min_portions=b.minPortions, default_portions=b.defaultPortions,
                          max_portions=b.maxPortions, portion_amount=b.portionAmount,
                          selection_type_override=b.selectionTypeOverride))
    db.commit()
    db.refresh(d)
    return _drink(d)


@router.put("/drinks/{drink_id}/sizes")
def set_sizes(drink_id: int, body: list[SizeIn], db: Session = Depends(get_db)):
    """Полная замена размеров напитка (ADM-S-05): объём + своя цена.
    Ровно один активный размер — дефолтный; если не указан, дефолтом станет первый."""
    d = db.scalar(select(Drink).options(selectinload(Drink.sizes)).where(Drink.id == drink_id))
    if not d:
        raise HTTPException(404, "NOT_FOUND")
    active = [s for s in body if s.isActive]
    if not active:
        raise HTTPException(422, "AT_LEAST_ONE_SIZE")  # хотя бы один активный размер
    if any(s.volume <= 0 or s.price < 0 for s in body):
        raise HTTPException(422, "SIZE_VALUES_INVALID")
    defaults = [s for s in active if s.isDefault]
    if len(defaults) > 1:
        raise HTTPException(422, "MULTIPLE_DEFAULT_SIZES")
    default_id = id(defaults[0]) if defaults else id(active[0])  # авто-дефолт = первый активный

    d.sizes.clear()
    db.flush()
    for i, s in enumerate(body):
        db.add(DrinkSize(drink_id=d.id, volume=s.volume, unit=s.unit, price=s.price,
                         is_default=(s.isActive and id(s) == default_id),
                         is_active=s.isActive, sort=s.sort if s.sort else i))
    # base_price напитка держим в синхроне с дефолтным размером (витрина/совместимость)
    d.base_price = next((s.price for s in active if id(s) == default_id), active[0].price)
    db.commit()
    db.refresh(d)
    return _drink(d)


# ---------- Rich-описания напитка по локалям (PUB-G-02) ----------

class DescriptionIn(BaseModel):
    body: str = ""  # HTML из WYSIWYG-редактора; санитизируется на сервере


@router.put("/drinks/{drink_id}/descriptions/{locale}")
def upsert_description(drink_id: int, locale: str, body: DescriptionIn,
                       db: Session = Depends(get_db)):
    """Создание/редактирование описания в локали (upsert). Пустой результат
    после санитизации => запись удаляется (эквивалент «нет описания»)."""
    if locale not in DESC_LOCALES:
        raise HTTPException(422, "LOCALE_NOT_SUPPORTED")
    d = db.scalar(select(Drink).options(selectinload(Drink.descriptions)).where(Drink.id == drink_id))
    if not d:
        raise HTTPException(404, "NOT_FOUND")
    clean = sanitize_html(body.body)
    row = next((x for x in d.descriptions if x.locale == locale), None)
    if not clean:
        if row is not None:
            d.descriptions.remove(row)  # пусто => снимаем описание
        db.commit(); db.refresh(d)
        return _drink(d)
    if row is None:
        db.add(DrinkDescription(drink_id=d.id, locale=locale, body=clean))
    else:
        row.body = clean
    db.commit(); db.refresh(d)
    return _drink(d)


@router.delete("/drinks/{drink_id}/descriptions/{locale}")
def delete_description(drink_id: int, locale: str, db: Session = Depends(get_db)):
    """Удаление описания в локали."""
    d = db.scalar(select(Drink).options(selectinload(Drink.descriptions)).where(Drink.id == drink_id))
    if not d:
        raise HTTPException(404, "NOT_FOUND")
    row = next((x for x in d.descriptions if x.locale == locale), None)
    if row is not None:
        d.descriptions.remove(row)
        db.commit()
    db.refresh(d)
    return _drink(d)
