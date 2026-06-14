"""Лёгкие миграции схемы для SQLite без Alembic.

`Base.metadata.create_all` создаёт новые таблицы (drink_sizes), но НЕ добавляет
колонки в уже существующие таблицы. Поэтому здесь:
  1) добиваем недостающие колонки через ALTER TABLE (идемпотентно, по PRAGMA);
  2) бэкфилл размеров: каждому напитку без размеров заводим дефолтный 400 ml
     по текущей base_price (тестовое наполнение, как договорено).
"""
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from ..models.catalog import (Addon, AddonCategory, Drink, DrinkCategory, DrinkSize, Unit)

# таблица -> {колонка: DDL-определение для ALTER TABLE ADD COLUMN}
_ADD_COLUMNS = {
    "order_items": {
        "size_label": "VARCHAR(20)",
    },
    "drink_categories": {
        "slug": "VARCHAR(60) DEFAULT ''",
    },
}

# ---------- slug-утилиты для категорий ----------
_RU2LAT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}
# красивые англ. slug для базовых сид-категорий
_KNOWN_SLUGS = {"Фреши": "fresh", "Смузи": "smoothie", "Детокс": "detox", "Шоты": "shots"}


def slugify(value: str) -> str:
    """ru/en строка → латинский slug: транслит, нижний регистр, дефисы."""
    out = []
    for ch in (value or "").lower():
        if ch in _RU2LAT:
            out.append(_RU2LAT[ch])
        elif ch.isalnum() and ch.isascii():
            out.append(ch)
        elif ch in " -_/":
            out.append("-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def ensure_schema(engine):
    """Добавляет недостающие колонки в существующие таблицы (SQLite/PG-совместимый ALTER)."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, columns in _ADD_COLUMNS.items():
            if table not in existing_tables:
                continue  # create_all создаст её целиком — миграция не нужна
            have = {c["name"] for c in inspector.get_columns(table)}
            for col, ddl in columns.items():
                if col not in have:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))


def backfill_category_slugs(db: Session):
    """Категориям без slug проставляем уникальный slug (из имени RU/транслита)."""
    cats = db.scalars(select(DrinkCategory)).all()
    taken = {c.slug for c in cats if c.slug}
    changed = False
    for c in cats:
        if c.slug:
            continue
        name_ru = (c.name or {}).get("ru", "")
        base = _KNOWN_SLUGS.get(name_ru) or slugify(name_ru) or f"category-{c.id}"
        slug = base
        n = 2
        while slug in taken:
            slug = f"{base}-{n}"; n += 1
        c.slug = slug
        taken.add(slug)
        changed = True
    if changed:
        db.commit()


# ---------- английская локализация каталога (i18n EN/AR) ----------
_EN_CATEGORY = {"fresh": "Fresh", "smoothie": "Smoothies", "detox": "Detox", "shots": "Shots"}
_EN_ADDON_CAT = {"Бустеры": "Boosters", "Фрукты и овощи": "Fruits & veggies",
                 "Травы и специи": "Herbs & spices", "Основа": "Base"}
_EN_UNIT = {"g": "grams", "ml": "milliliters", "pcs": "pcs", "l": "liters"}
_EN_ADDON = {
    "Коллаген": "Collagen", "Куркума": "Turmeric", "Протеин": "Protein", "Чиа": "Chia",
    "Имбирь": "Ginger", "Мята": "Mint", "Базилик": "Basil", "Лайм": "Lime", "Лимон": "Lemon",
    "Манго": "Mango", "Ананас": "Pineapple", "Огурец": "Cucumber", "Морковь": "Carrot",
    "Свёкла": "Beetroot", "Маракуйя": "Passion fruit", "Кокосовая вода": "Coconut water",
}
_EN_DRINK = {
    "orange-fresh": "Orange fresh", "pineapple-fresh": "Pineapple fresh",
    "carrot-fresh": "Carrot fresh", "watermelon-fresh": "Watermelon fresh",
    "pomegranate-fresh": "Pomegranate fresh", "apple-fresh": "Apple fresh",
    "beetroot-apple-fresh": "Beetroot & apple", "mango-passion": "Mango–passion",
    "pomegranate-orange": "Pomegranate & orange", "watermelon-mint-lime": "Watermelon, mint & lime",
    "mango-smoothie": "Mango smoothie", "berry-smoothie": "Berry smoothie",
    "green-smoothie": "Green smoothie", "banana-protein-smoothie": "Banana protein",
    "tropical-mango-smoothie": "Tropical mango", "strawberry-mango-smoothie": "Strawberry & mango",
    "avocado-smoothie": "Avocado smoothie", "celery-detox": "Celery detox",
    "green-detox": "Green detox", "red-recovery": "Red Recovery", "iron-support": "Iron Support",
    "gut-support": "Gut Support", "deep-hydration": "Deep Hydration",
    "immunity-shot": "Immunity shot", "ginger-shot": "Ginger shot", "turmeric-shot": "Turmeric shot",
    "electro-shot": "Electrolyte shot", "focus-shot": "Focus shot", "draft-example": "Draft (hidden)",
}
_EN_DETAILS = {
    "fresh": {
        "ingredients": "Cold-pressed juice, ice on request. No sugar, water or preservatives.",
        "allergens": "Contains no common allergens.",
        "may": "May contain traces of citrus and nuts — made on a shared line.",
    },
    "smoothie": {
        "ingredients": "Fresh fruit, milk or plant base, ice.",
        "allergens": "Milk (lactose).", "may": "Nuts, soy, gluten.",
    },
    "detox": {
        "ingredients": "Cold-pressed vegetables and greens, lemon, ginger.",
        "allergens": "Celery.", "may": "May contain traces of nuts and citrus.",
    },
    "shots": {
        "ingredients": "Cold-pressed concentrate — ginger, turmeric, citrus.",
        "allergens": "None.", "may": "May contain traces of citrus.",
    },
}
_EN_DRINK_DESC = "Freshly pressed, no added sugar."


def _with_en(value, en):
    """Добавляет/обновляет ключ en в i18n-словаре (не трогая ar)."""
    if not en:
        return value
    return {**(value or {}), "en": en}


def localize_catalog_en(db: Session):
    """Добавляет английские переводы в i18n-поля каталога (idempotent)."""
    for u in db.scalars(select(Unit)).all():
        if (u.name or {}).get("en"):
            continue
        u.name = _with_en(u.name, _EN_UNIT.get(u.code))

    for ac in db.scalars(select(AddonCategory)).all():
        if (ac.name or {}).get("en"):
            continue
        ac.name = _with_en(ac.name, _EN_ADDON_CAT.get((ac.name or {}).get("ru", "")))

    for a in db.scalars(select(Addon)).all():
        if (a.name or {}).get("en"):
            continue
        a.name = _with_en(a.name, _EN_ADDON.get((a.name or {}).get("ru", "")))

    cat_slug = {c.id: c.slug for c in db.scalars(select(DrinkCategory)).all()}
    for c in db.scalars(select(DrinkCategory)).all():
        if not (c.name or {}).get("en"):
            c.name = _with_en(c.name, _EN_CATEGORY.get(c.slug, c.slug.replace("-", " ").title()))

    for d in db.scalars(select(Drink)).all():
        if (d.name or {}).get("en") and (d.description or {}).get("en"):
            continue
        d.name = _with_en(d.name, _EN_DRINK.get(d.slug, d.slug.replace("-", " ").title()))
        d.description = _with_en(d.description, _EN_DRINK_DESC)
        det = _EN_DETAILS.get(cat_slug.get(d.category_id, ""), _EN_DETAILS["fresh"])
        d.ingredients = _with_en(d.ingredients, det["ingredients"])
        d.allergens = _with_en(d.allergens, det["allergens"])
        d.may_contain = _with_en(d.may_contain, det["may"])

    db.commit()


def backfill_sizes(db: Session):
    """Каждому напитку без размеров — дефолтный размер 400 ml по его base_price."""
    drink_ids_with_sizes = set(db.scalars(select(DrinkSize.drink_id)).all())
    changed = False
    for d in db.scalars(select(Drink)).all():
        if d.id in drink_ids_with_sizes:
            continue
        db.add(DrinkSize(drink_id=d.id, volume=400, unit="ml",
                         price=d.base_price, is_default=True, is_active=True, sort=0))
        changed = True
    if changed:
        db.commit()
