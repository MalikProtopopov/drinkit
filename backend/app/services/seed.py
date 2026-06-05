"""Сиды каталога: 4 категории соков (tz: «4 разными категориями напитков»),
напитки и добавки по мотивам прототипа и JOOZ-конфигуратора."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.security import hash_password
from ..models.catalog import Addon, AddonCategory, Drink, DrinkAddon, DrinkCategory, Unit
from ..models.users import StaffUser


def seed(db: Session):
    if db.scalar(select(DrinkCategory).limit(1)):
        return  # уже засеяно

    units = {
        "g": Unit(code="g", name={"ru": "граммы", "ar": "غرام"}),
        "ml": Unit(code="ml", name={"ru": "миллилитры", "ar": "مل"}),
        "pcs": Unit(code="pcs", name={"ru": "штуки", "ar": "قطعة"}),
        "l": Unit(code="l", name={"ru": "литры", "ar": "لتر"}),
    }
    db.add_all(units.values())

    cats = {
        "fresh": DrinkCategory(name={"ru": "Фреши", "ar": "عصائر طازجة"}, sort=1,
                               photo_url="/videos/juice-orange-pour.jpg"),
        "smoothie": DrinkCategory(name={"ru": "Смузи", "ar": "سموذي"}, sort=2,
                                  photo_url="/videos/milk-jug.jpg"),
        "detox": DrinkCategory(name={"ru": "Детокс", "ar": "ديتوكس"}, sort=3,
                               photo_url="/videos/tea-pour.jpg"),
        "shots": DrinkCategory(name={"ru": "Шоты", "ar": "شوتات"}, sort=4,
                               photo_url="/videos/coffee-espresso.jpg"),
    }
    db.add_all(cats.values())

    acats = {
        "boosters": AddonCategory(name={"ru": "Бустеры", "ar": "معززات"}, selection_type="counter"),
        "fruits": AddonCategory(name={"ru": "Фрукты и овощи", "ar": "فواكه وخضار"}, selection_type="multi"),
        "herbs": AddonCategory(name={"ru": "Травы и специи", "ar": "أعشاب وتوابل"}, selection_type="multi"),
        "base": AddonCategory(name={"ru": "Основа", "ar": "أساس"}, selection_type="single"),
    }
    db.add_all(acats.values())
    db.flush()

    def addon(name_ru, name_ar, cat, unit, kcal, prot, fat, carbs, price):
        a = Addon(name={"ru": name_ru, "ar": name_ar}, category_id=acats[cat].id,
                  unit_id=units[unit].id, kcal_per_100=kcal, protein_per_100=prot,
                  fat_per_100=fat, carbs_per_100=carbs, base_price=price)
        db.add(a)
        return a

    adds = {
        "collagen": addon("Коллаген", "كولاجين", "boosters", "g", 370, 90, 0, 0, 8),
        "turmeric": addon("Куркума", "كركم", "boosters", "g", 312, 9.7, 3.3, 67, 4),
        "protein": addon("Протеин", "بروتين", "boosters", "g", 380, 75, 5, 8, 9),
        "chia": addon("Чиа", "شيا", "boosters", "g", 486, 16.5, 30.7, 42, 5),
        "ginger": addon("Имбирь", "زنجبيل", "herbs", "g", 80, 1.8, 0.8, 17.8, 3),
        "mint": addon("Мята", "نعناع", "herbs", "g", 70, 3.8, 0.9, 14.9, 2),
        "basil": addon("Базилик", "ريحان", "herbs", "g", 23, 3.2, 0.6, 2.7, 2),
        "lime": addon("Лайм", "ليم", "fruits", "g", 30, 0.7, 0.2, 10.5, 3),
        "lemon": addon("Лимон", "ليمون", "fruits", "g", 29, 1.1, 0.3, 9.3, 3),
        "mango": addon("Манго", "مانجو", "fruits", "g", 60, 0.8, 0.4, 15, 5),
        "pineapple": addon("Ананас", "أناناس", "fruits", "g", 50, 0.5, 0.1, 13, 4),
        "cucumber": addon("Огурец", "خيار", "fruits", "g", 15, 0.7, 0.1, 3.6, 2),
        "carrot": addon("Морковь", "جزر", "fruits", "g", 41, 0.9, 0.2, 9.6, 2),
        "beetroot": addon("Свёкла", "شمندر", "fruits", "g", 43, 1.6, 0.2, 9.6, 2),
        "passion": addon("Маракуйя", "باشن فروت", "fruits", "g", 97, 2.2, 0.7, 23, 6),
        "coconut": addon("Кокосовая вода", "ماء جوز الهند", "base", "ml", 19, 0.7, 0.2, 3.7, 6),
    }

    def drink(slug, name_ru, name_ar, cat, price, kcal, p, f, c, links, status="published",
              desc_ru="Свежевыжатый, без сахара.", video=None):
        d = Drink(slug=slug, name={"ru": name_ru, "ar": name_ar},
                  description={"ru": desc_ru, "ar": "طازج وبدون سكر."},
                  status=status, base_price=price, kcal=kcal, protein=p, fat=f, carbs=c,
                  category_id=cats[cat].id, video_url=video or f"/videos/{slug}.mp4",
                  preview_url=f"/videos/{slug}.jpg")
        db.add(d)
        db.flush()
        for key, (price_o, mn, df, mx, amount) in links.items():
            db.add(DrinkAddon(drink_id=d.id, addon_id=adds[key].id, price_override=price_o,
                              min_portions=mn, default_portions=df, max_portions=mx,
                              portion_amount=amount))
        return d

    # Фреши (по JOOZ-конфигуратору: база + разрешённые добавки)
    drink("orange-fresh", "Апельсиновый фреш", "عصير برتقال", "fresh", 22, 88, 1.4, 0.4, 20,
          {"carrot": (None, 0, 1, 3, 40), "mango": (5, 0, 1, 2, 30), "pineapple": (4, 0, 1, 2, 30),
           "ginger": (3, 0, 1, 2, 10), "basil": (None, 0, 1, 1, 5),
           "collagen": (8, 0, 1, 2, 10), "turmeric": (4, 0, 1, 1, 5)})
    drink("watermelon-fresh", "Арбузный фреш", "عصير بطيخ", "fresh", 24, 72, 1.2, 0.3, 17,
          {"mint": (None, 0, 1, 2, 5), "lime": (3, 0, 1, 2, 15), "cucumber": (2, 0, 1, 2, 40),
           "basil": (None, 0, 1, 1, 5), "coconut": (6, 0, 1, 1, 100),
           "collagen": (8, 0, 1, 2, 10), "turmeric": (4, 0, 1, 1, 5)})
    drink("pomegranate-fresh", "Гранатовый фреш", "عصير رمان", "fresh", 28, 96, 1.5, 0.5, 22,
          {"beetroot": (2, 0, 1, 2, 40), "ginger": (3, 0, 1, 2, 10), "lemon": (3, 0, 1, 2, 15),
           "collagen": (8, 0, 1, 2, 10), "turmeric": (4, 0, 1, 1, 5)})
    # Смузи
    drink("mango-smoothie", "Манго смузи", "سموذي مانجو", "smoothie", 30, 180, 2.5, 1.2, 38,
          {"passion": (6, 0, 1, 2, 30), "pineapple": (4, 0, 1, 2, 30), "lime": (3, 0, 1, 1, 15),
           "protein": (9, 0, 1, 2, 30), "chia": (5, 0, 1, 2, 15), "collagen": (8, 0, 1, 2, 10)})
    drink("berry-smoothie", "Ягодный смузи", "سموذي توت", "smoothie", 30, 165, 2.8, 1.0, 34,
          {"protein": (9, 0, 1, 2, 30), "chia": (5, 0, 1, 2, 15), "mint": (None, 0, 1, 1, 5),
           "collagen": (8, 0, 1, 2, 10)})
    # Детокс
    drink("celery-detox", "Сельдерей детокс", "ديتوكس كرفس", "detox", 26, 45, 1.8, 0.4, 8,
          {"cucumber": (None, 0, 1, 2, 40), "lemon": (3, 0, 1, 2, 15), "ginger": (3, 0, 1, 2, 10),
           "turmeric": (4, 0, 1, 1, 5)})
    drink("green-detox", "Зелёный детокс", "ديتوكس أخضر", "detox", 28, 60, 2.1, 0.5, 12,
          {"cucumber": (None, 0, 1, 2, 40), "mint": (None, 0, 1, 2, 5), "lime": (3, 0, 1, 2, 15),
           "ginger": (3, 0, 1, 2, 10), "chia": (5, 0, 1, 2, 15)})
    # Шоты
    drink("immunity-shot", "Иммунитет шот", "شوت مناعة", "shots", 14, 35, 0.6, 0.2, 8,
          {"ginger": (None, 1, 1, 3, 10), "turmeric": (None, 0, 1, 2, 5), "lemon": (None, 0, 1, 1, 10)})
    drink("draft-example", "Черновик (не виден)", "مسودة", "shots", 10, 10, 0, 0, 2, {}, status="draft")

    # staff: DECISION — сид-учётки для первого входа, сменить пароли при деплое
    db.add(StaffUser(email="admin@juicy.ae", password_hash=hash_password("admin123"),
                     name="Super Admin", role="super_admin"))
    db.add(StaffUser(email="manager@juicy.ae", password_hash=hash_password("manager123"),
                     name="Manager", role="manager"))
    db.commit()
