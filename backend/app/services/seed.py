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

    # ---- Каталог: 28 напитков, медиа — реальные видео-петли из app/public/videos ----
    # (9 роликов из mocs/ переиспользуются между напитками — задача «наполнить витрину»)
    fresh_links = {"ginger": (3, 0, 1, 2, 10), "mint": (None, 0, 1, 2, 5),
                   "lime": (3, 0, 1, 2, 15), "collagen": (8, 0, 1, 2, 10),
                   "turmeric": (4, 0, 1, 1, 5)}
    smoothie_links = {"protein": (9, 0, 1, 2, 30), "chia": (5, 0, 1, 2, 15),
                      "mint": (None, 0, 1, 1, 5), "collagen": (8, 0, 1, 2, 10)}
    detox_links = {"cucumber": (None, 0, 1, 2, 40), "lemon": (3, 0, 1, 2, 15),
                   "ginger": (3, 0, 1, 2, 10), "turmeric": (4, 0, 1, 1, 5)}
    shot_links = {"ginger": (None, 0, 1, 3, 10), "turmeric": (None, 0, 1, 2, 5),
                  "lemon": (None, 0, 1, 1, 10)}

    DRINKS = [
        # slug, ru, ar, категория, цена, ккал, Б, Ж, У, видео-файл, шаблон добавок
        ("orange-fresh", "Апельсиновый фреш", "عصير برتقال", "fresh", 22, 88, 1.4, 0.4, 20, "juice-orange-pour", {**fresh_links, "carrot": (None, 0, 1, 3, 40), "mango": (5, 0, 1, 2, 30)}),
        ("pineapple-fresh", "Ананасовый фреш", "عصير أناناس", "fresh", 24, 82, 0.9, 0.2, 19, "juice-orange-pour", {**fresh_links, "mango": (5, 0, 1, 2, 30), "passion": (6, 0, 1, 2, 30)}),
        ("carrot-fresh", "Морковный фреш", "عصير جزر", "fresh", 20, 75, 1.5, 0.3, 16, "juice-orange-pour", {**fresh_links, "ginger": (3, 0, 1, 2, 10)}),
        ("watermelon-fresh", "Арбузный фреш", "عصير بطيخ", "fresh", 24, 72, 1.2, 0.3, 17, "tea-pour", {**fresh_links, "cucumber": (2, 0, 1, 2, 40), "coconut": (6, 0, 1, 1, 100), "basil": (None, 0, 1, 1, 5)}),
        ("pomegranate-fresh", "Гранатовый фреш", "عصير رمان", "fresh", 28, 96, 1.5, 0.5, 22, "tea-pour", {**fresh_links, "beetroot": (2, 0, 1, 2, 40), "lemon": (3, 0, 1, 2, 15)}),
        ("apple-fresh", "Яблочный фреш", "عصير تفاح", "fresh", 19, 80, 0.6, 0.3, 19, "juice-orange-pour", {**fresh_links, "carrot": (None, 0, 1, 2, 40), "beetroot": (2, 0, 1, 2, 40)}),
        ("beetroot-apple-fresh", "Свёкла-яблоко", "شمندر وتفاح", "fresh", 23, 85, 1.6, 0.3, 19, "tea-pour", {**fresh_links, "lemon": (3, 0, 1, 2, 15)}),
        ("mango-passion", "Манго-маракуйя", "مانجو وباشن فروت", "fresh", 27, 105, 1.3, 0.6, 24, "juice-orange-pour", {**fresh_links, "passion": (6, 0, 1, 2, 30)}),
        ("pomegranate-orange", "Гранат-апельсин", "رمان وبرتقال", "fresh", 26, 92, 1.4, 0.4, 21, "tea-pour", fresh_links),
        ("watermelon-mint-lime", "Арбуз-мята-лайм", "بطيخ ونعناع وليم", "fresh", 25, 70, 1.1, 0.3, 16, "tea-pour", {**fresh_links, "basil": (None, 0, 1, 1, 5)}),

        ("mango-smoothie", "Манго смузи", "سموذي مانجو", "smoothie", 30, 180, 2.5, 1.2, 38, "coffee-milk-iced", {**smoothie_links, "passion": (6, 0, 1, 2, 30), "lime": (3, 0, 1, 1, 15)}),
        ("berry-smoothie", "Ягодный смузи", "سموذي توت", "smoothie", 30, 165, 2.8, 1.0, 34, "chocolate-stir", smoothie_links),
        ("green-smoothie", "Зелёный смузи", "سموذي أخضر", "smoothie", 29, 140, 3.1, 0.9, 27, "milk-jug", {**smoothie_links, "cucumber": (None, 0, 1, 2, 40)}),
        ("banana-protein-smoothie", "Банан-протеин", "موز وبروتين", "smoothie", 32, 230, 12.0, 2.5, 40, "milk-jug", smoothie_links),
        ("tropical-mango-smoothie", "Тропический манго", "مانجو استوائي", "smoothie", 31, 190, 2.2, 1.1, 41, "coffee-milk-iced", {**smoothie_links, "passion": (6, 0, 1, 2, 30)}),
        ("strawberry-mango-smoothie", "Клубника-манго", "فراولة ومانجو", "smoothie", 31, 175, 2.4, 1.0, 37, "chocolate-stir", smoothie_links),
        ("avocado-smoothie", "Авокадо смузи", "سموذي أفوكادو", "smoothie", 34, 240, 3.5, 14.0, 25, "milk-jug", {**smoothie_links, "protein": (9, 0, 1, 2, 30)}),

        ("celery-detox", "Сельдерей детокс", "ديتوكس كرفس", "detox", 26, 45, 1.8, 0.4, 8, "tea-pour", detox_links),
        ("green-detox", "Зелёный детокс", "ديتوكس أخضر", "detox", 28, 60, 2.1, 0.5, 12, "milk-jug", {**detox_links, "mint": (None, 0, 1, 2, 5), "chia": (5, 0, 1, 2, 15)}),
        ("red-recovery", "Red Recovery", "ريد ريكفري", "detox", 29, 88, 1.9, 0.4, 19, "tea-pour", {**detox_links, "beetroot": (None, 1, 1, 2, 40)}),
        ("iron-support", "Iron Support", "آيرون سبورت", "detox", 29, 90, 2.0, 0.4, 20, "tea-pour", {**detox_links, "beetroot": (None, 1, 1, 2, 40)}),
        ("gut-support", "Gut Support", "غات سبورت", "detox", 28, 84, 1.4, 0.5, 18, "juice-orange-pour", {**detox_links, "mint": (None, 0, 1, 2, 5)}),
        ("deep-hydration", "Deep Hydration", "ديب هيدريشن", "detox", 27, 55, 1.0, 0.3, 12, "coffee-black-pour", {**detox_links, "coconut": (6, 0, 1, 1, 100), "mint": (None, 0, 1, 2, 5)}),

        ("immunity-shot", "Иммунитет шот", "شوت مناعة", "shots", 14, 35, 0.6, 0.2, 8, "coffee-espresso", shot_links),
        ("ginger-shot", "Имбирный шот", "شوت زنجبيل", "shots", 13, 30, 0.5, 0.2, 7, "coffee-espresso", shot_links),
        ("turmeric-shot", "Куркума шот", "شوت كركم", "shots", 13, 32, 0.6, 0.3, 7, "coffee-espresso", shot_links),
        ("electro-shot", "Электролит шот", "شوت إلكتروليت", "shots", 15, 28, 0.4, 0.1, 6, "coffee-moka", {**shot_links, "coconut": (None, 0, 1, 1, 50)}),
        ("focus-shot", "Фокус шот", "شوت تركيز", "shots", 15, 33, 0.7, 0.2, 7, "coffee-latte-machine", shot_links),
    ]
    for slug, ru, ar, cat, price, kcal, pr, ft, cb, media, links in DRINKS:
        drink(slug, ru, ar, cat, price, kcal, pr, ft, cb, links,
              video=f"/videos/{media}.mp4")
    db.flush()
    # превью = постер первого кадра того же ролика
    for d in db.query(Drink).all():
        if d.video_url and d.video_url.startswith("/videos/"):
            d.preview_url = d.video_url.replace(".mp4", ".jpg")

    drink("draft-example", "Черновик (не виден)", "مسودة", "shots", 10, 10, 0, 0, 2, {}, status="draft")

    # staff: DECISION — сид-учётки для первого входа, сменить пароли при деплое
    db.add(StaffUser(email="admin@juicy.ae", password_hash=hash_password("admin123"),
                     name="Super Admin", role="super_admin"))
    db.add(StaffUser(email="manager@juicy.ae", password_hash=hash_password("manager123"),
                     name="Manager", role="manager"))
    db.commit()
