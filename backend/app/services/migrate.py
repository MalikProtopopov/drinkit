"""Лёгкие миграции схемы для SQLite без Alembic.

`Base.metadata.create_all` создаёт новые таблицы (drink_sizes), но НЕ добавляет
колонки в уже существующие таблицы. Поэтому здесь:
  1) добиваем недостающие колонки через ALTER TABLE (идемпотентно, по PRAGMA);
  2) бэкфилл размеров: каждому напитку без размеров заводим дефолтный 400 ml
     по текущей base_price (тестовое наполнение, как договорено).
"""
from sqlalchemy import func, inspect, select, text, update
from sqlalchemy.orm import Session

from ..models.catalog import (Addon, AddonCategory, Drink, DrinkCategory, DrinkSize, Unit)
from ..models.orders import Order, Payment
from ..models.outlet import Outlet, StaffOutlet
from ..models.users import StaffUser
from .payment_mock import apply_mock_stripe

# таблица -> {колонка: DDL-определение для ALTER TABLE ADD COLUMN}
_ADD_COLUMNS = {
    "order_items": {
        "size_label": "VARCHAR(20)",
    },
    "orders": {
        "outlet_id": "INTEGER",  # точка заказа (REQ-6); FK живёт только на свежем create_all
    },
    "drink_categories": {
        "slug": "VARCHAR(60) DEFAULT ''",
    },
    "staff_users": {
        "phone": "VARCHAR(30)",
        "note": "VARCHAR(200)",
    },
    # расширение карточки платежа под Stripe (ADM-S-09): идентификаторы, карта,
    # комиссия/чистыми/возвраты, риск/споры — всё nullable, работает и на mock
    "payments": {
        "payment_intent_id": "VARCHAR(120)",
        "charge_id": "VARCHAR(120)",
        "customer_id": "VARCHAR(120)",
        "method_type": "VARCHAR(20) DEFAULT 'card'",
        "card_brand": "VARCHAR(20)",
        "card_last4": "VARCHAR(4)",
        "card_funding": "VARCHAR(12)",
        "card_country": "VARCHAR(2)",
        "card_exp": "VARCHAR(7)",
        "fee_amount": "FLOAT DEFAULT 0",
        "net_amount": "FLOAT",
        "refunded_amount": "FLOAT DEFAULT 0",
        "receipt_url": "VARCHAR(300)",
        "failure_code": "VARCHAR(40)",
        "failure_message": "VARCHAR(200)",
        "risk_level": "VARCHAR(20)",
        "risk_score": "INTEGER",
        "dispute_status": "VARCHAR(20)",
        "livemode": "BOOLEAN DEFAULT 0",
        "paid_at": "DATETIME",
        "updated_at": "DATETIME",
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


def backfill_payments(db: Session):
    """Наполняет Stripe-поля платежей mock-синтетиком для строк, созданных до
    расширения схемы. Признак «уже наполнено» — заполненный card_brand."""
    rows = db.scalars(select(Payment).where(Payment.card_brand.is_(None))).all()
    if not rows:
        return
    order_ids = {p.order_id for p in rows}
    orders = {o.id: o for o in db.scalars(select(Order).where(Order.id.in_(order_ids)))}
    for p in rows:
        apply_mock_stripe(p, orders.get(p.order_id))
    db.commit()


def backfill_outlets(db: Session):
    """Локации (REQ-6/2): гарантирует дефолтную точку, привязывает легаси-заказы и
    сид/легаси-стафф (manager/screen) к ней. Идемпотентно; единый владелец создания точки
    (НЕ в seed) — работает и на свежей, и на уже существующей БД.

    hours={} = всегда открыта (расписание не задано), чтобы прежнее поведение «заказ можно
    оформить в любое время» сохранилось до того, как админ задаст реальные часы."""
    # 1) дефолтная точка (если нет ни одной)
    outlet = db.scalar(select(Outlet).where(Outlet.is_active.is_(True)).order_by(Outlet.id))
    if outlet is None:
        outlet = db.scalar(select(Outlet).order_by(Outlet.id))
    if outlet is None:
        outlet = Outlet(slug="main",
                        name={"ru": "JOOZ Главная", "en": "JOOZ Main", "ar": "جوز الرئيسي"},
                        is_active=True, accepting_orders=True,
                        address="Business Bay, Dubai", emirate="Dubai",
                        timezone="Asia/Dubai", hours={})
        db.add(outlet)
        db.commit()
    default_id = outlet.id

    # 2) легаси-заказы без точки → дефолтная
    missing = db.scalar(select(func.count()).select_from(Order).where(Order.outlet_id.is_(None)))
    if missing:
        db.execute(update(Order).where(Order.outlet_id.is_(None)).values(outlet_id=default_id))
        db.commit()

    # 3) стафф manager/screen без привязки → дефолтная. screen привязываем авто только если
    #    активная точка одна (иначе требуем ручного назначения — ТВ не должен попасть на чужую стойку).
    one_active = active_outlet_count(db) <= 1
    attached = set(db.scalars(select(StaffOutlet.staff_id)).all())
    changed = False
    for s in db.scalars(select(StaffUser).where(StaffUser.role.in_(("manager", "screen")))):
        if s.id in attached:
            continue
        if s.role == "screen" and not one_active:
            continue
        db.add(StaffOutlet(staff_id=s.id, outlet_id=default_id, is_primary=True))
        changed = True
    if changed:
        db.commit()


def active_outlet_count(db: Session) -> int:
    return int(db.scalar(select(func.count()).select_from(Outlet).where(Outlet.is_active.is_(True))) or 0)


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
