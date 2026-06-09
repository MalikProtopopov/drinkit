"""Сиды GRABZI (план §8): локации, каталог (4 напитка из спарсенного меню), контент.

Идемпотентно (skip, если локации уже есть). Запуск: `python -m app.cli seed-grabzi`.
Это GRABZI-инстанс; Juicy-сиды (services/seed.py) — отдельны.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.security import hash_password
from ..models.catalog import Drink, DrinkCategory
from ..models.locations import InfoBlock, Location
from ..models.users import StaffUser

# реальные PNG-стикеры с grabzi.ae (абсолютные URL — media_url отдаёт как есть)
_CHERRY_IMG = "https://cdn.shopify.com/s/files/1/0960/7364/6374/files/sticker_ba8277b5-e4cf-473c-9fe1-4a96f397e7af.png?v=1761642666"
_CLASSIC_IMG = "https://cdn.shopify.com/s/files/1/0960/7364/6374/files/GRABZI1-107.png?v=1753789918"

# часы работы GRABZI (со спарсенной страницы): Пн–Сб 5:30–22:00, Вс 10:00–18:00
_HOURS = {
    "mon": [{"open": "05:30", "close": "22:00"}],
    "tue": [{"open": "05:30", "close": "22:00"}],
    "wed": [{"open": "05:30", "close": "22:00"}],
    "thu": [{"open": "05:30", "close": "22:00"}],
    "fri": [{"open": "05:30", "close": "22:00"}],
    "sat": [{"open": "05:30", "close": "22:00"}],
    "sun": [{"open": "10:00", "close": "18:00"}],
}


def seed_grabzi(db: Session):
    if db.scalar(select(Location).limit(1)):
        return  # уже засеяно

    # категория напитков
    cat = DrinkCategory(name={"en": "Ice V'60"}, sort=1, is_active=True)
    db.add(cat)
    db.flush()

    drinks = [
        Drink(slug="classic-ice-v60", name={"en": "🧊 Classic Ice V'60"},
              description={"en": "If it's a bad brew, give us a bad review! 🤣"},
              status="published", base_price=28, preview_url=_CLASSIC_IMG, category_id=cat.id),
        Drink(slug="cherry-bomb-ice-v60", name={"en": "🍒💣 Cherry Bomb Ice V'60"},
              description={"en": "Cherry bomb iced V'60."}, status="published",
              base_price=36, preview_url=_CHERRY_IMG, category_id=cat.id),
        Drink(slug="choco-berry-ice-v60", name={"en": "🍫🍇 Choco Berry Ice V'60"},
              description={"en": "Choco berry iced V'60."}, status="published",
              base_price=34, category_id=cat.id),
        Drink(slug="melon-spark-ice-v60", name={"en": "🍉⚡️ Melon Spark Ice V'60"},
              description={"en": "Melon spark iced V'60."}, status="published",
              base_price=37, category_id=cat.id),
    ]
    db.add_all(drinks)

    # локация (дефолтный лимит 150 — «150 в день» из их Story)
    loc = Location(
        name={"en": "GRABZI Drive-Through"}, description={"en": "Drive-through specialty coffee."},
        address="Dubai, UAE", working_hours=_HOURS, timezone="Asia/Dubai",
        daily_drink_limit=150, accepting_orders=True, is_active=True,
        color="#c44429", sort=1,
    )
    db.add(loc)
    db.flush()

    # контент инфо-страницы
    db.add_all([
        InfoBlock(key="story", title={"en": "Our Story"},
                  body={"en": "GRABZI started with a dream — specialty iced V'60 coffee, "
                              "fast, on the go."}, sort=1),
        InfoBlock(key="contact", title={"en": "Contact"},
                  body={"en": "grabzi150@gmail.com · +971 55 667 6679"}, sort=2),
    ])

    # super_admin и менеджер, привязанный к локации
    if not db.scalar(select(StaffUser).where(StaffUser.email == "admin@grabzi.ae")):
        db.add(StaffUser(email="admin@grabzi.ae", password_hash=hash_password("grabzi-admin"),
                         name="GRABZI Admin", role="super_admin"))
    if not db.scalar(select(StaffUser).where(StaffUser.email == "barista@grabzi.ae")):
        db.add(StaffUser(email="barista@grabzi.ae", password_hash=hash_password("grabzi-barista"),
                         name="Barista", role="manager", location_id=loc.id))

    db.commit()
