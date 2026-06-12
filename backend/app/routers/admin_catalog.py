"""Админка-каталог (ADM-S-01..05): CRUD категорий напитков, категорий добавок,
добавок, единиц измерения, напитков и связки напиток×добавка."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.db import get_db
from ..core.security import require_super_admin
from ..models.catalog import Addon, AddonCategory, Drink, DrinkAddon, DrinkCategory, Unit

router = APIRouter(prefix="/api/admin/catalog", tags=["admin-catalog"],
                   dependencies=[Depends(require_super_admin)])


# ---------- Категории напитков (ADM-S-01) ----------

class DrinkCategoryIn(BaseModel):
    name: dict
    photoUrl: str | None = None
    videoUrl: str | None = None
    isActive: bool = True
    sort: int = 0


def _cat(c: DrinkCategory):
    return {"id": c.id, "name": c.name, "photoUrl": c.photo_url, "videoUrl": c.video_url,
            "isActive": c.is_active, "sort": c.sort}


@router.get("/drink-categories")
def list_drink_categories(db: Session = Depends(get_db)):
    return [_cat(c) for c in db.scalars(select(DrinkCategory).order_by(DrinkCategory.sort)).all()]


@router.post("/drink-categories")
def create_drink_category(body: DrinkCategoryIn, db: Session = Depends(get_db)):
    c = DrinkCategory(name=body.name, photo_url=body.photoUrl, video_url=body.videoUrl,
                      is_active=body.isActive, sort=body.sort)
    db.add(c); db.commit()
    return _cat(c)


@router.patch("/drink-categories/{cat_id}")
def update_drink_category(cat_id: int, body: DrinkCategoryIn, db: Session = Depends(get_db)):
    c = db.get(DrinkCategory, cat_id)
    if not c:
        raise HTTPException(404, "NOT_FOUND")
    c.name, c.photo_url, c.video_url = body.name, body.photoUrl, body.videoUrl
    c.is_active, c.sort = body.isActive, body.sort
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


@router.post("/addons")
def create_addon(body: AddonIn, db: Session = Depends(get_db)):
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


def _drink(d: Drink):
    return {"id": d.id, "slug": d.slug, "name": d.name, "description": d.description,
            "status": d.status, "previewUrl": d.preview_url, "videoUrl": d.video_url,
            "basePrice": d.base_price, "kcal": d.kcal, "protein": d.protein,
            "fat": d.fat, "carbs": d.carbs, "categoryId": d.category_id,
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
    return [_drink(d) for d in db.scalars(select(Drink).options(selectinload(Drink.addon_links))).all()]


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
