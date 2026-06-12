"""Исчерпывающие тесты публичного каталога (app/routers/catalog.py, domain=catalog).

Эндпоинты:
  GET  /api/categories
  GET  /api/drinks                 (+фильтр ?category, ?locale)
  GET  /api/drinks/{slug}
  POST /api/drinks/{slug}/preview

Все эндпоинты ПУБЛИЧНЫЕ (нет Depends на auth), поэтому 401/403 неприменимы —
это явно зафиксировано отдельным тестом (garbage-токен игнорируется, доступ открыт).

Данные берутся из app/services/seed.py (Juicy-сид, подключён в app/main.py):
  - 4 активные категории: Фреши(1), Смузи(2), Детокс(3), Шоты(4)
  - 28 published-напитков + 1 draft (slug="draft-example")
  - orange-fresh: base_price=22, kcal=88, protein=1.4, fat=0.4, carbs=20
  - addon-категории selection_type: boosters=counter, fruits=multi, herbs=multi, base=single
"""
import pytest

# Локали из конфигурации: ru (default), ar. "en" НЕ входит -> fallback на ru.


# ---------------------------------------------------------------------------
# GET /api/categories
# ---------------------------------------------------------------------------
# Имена 4 сид-категорий в порядке поля sort (другие тест-модули могут
# дозасеивать категории в общую session-БД, поэтому проверяем ВКЛЮЧЕНИЕ
# и ОТНОСИТЕЛЬНЫЙ порядок сид-категорий, а не точную длину списка.)
SEED_CATEGORIES_RU = ["Фреши", "Смузи", "Детокс", "Шоты"]
SEED_CATEGORIES_AR = ["عصائر طازجة", "سموذي", "ديتوكس", "شوتات"]


def _subsequence_in_order(seq, sub):
    """sub встречается в seq как подпоследовательность в том же порядке."""
    it = iter(seq)
    return all(item in it for item in sub)


def test_categories_happy_default_locale(client):
    r = client.get("/api/categories")
    assert r.status_code == 200, r.text
    cats = r.json()
    assert isinstance(cats, list)
    names = [c["name"] for c in cats]
    # сид-категории присутствуют и идут в порядке поля sort
    for n in SEED_CATEGORIES_RU:
        assert n in names
    assert _subsequence_in_order(names, SEED_CATEGORIES_RU)
    # форма ответа
    fresh = next(c for c in cats if c["name"] == "Фреши")
    assert set(fresh.keys()) == {"id", "name", "photoUrl", "videoUrl"}
    assert isinstance(fresh["id"], int)
    assert fresh["id"] == 1


def test_categories_sorted_by_sort_field(client):
    cats = client.get("/api/categories").json()
    # выборка только сид-категорий сохраняет порядок sort -> id по возрастанию
    seed_ids = [c["id"] for c in cats if c["name"] in SEED_CATEGORIES_RU]
    assert seed_ids[:4] == [1, 2, 3, 4]


def test_categories_locale_ar(client):
    cats = client.get("/api/categories?locale=ar").json()
    names = [c["name"] for c in cats]
    for n in SEED_CATEGORIES_AR:
        assert n in names
    assert _subsequence_in_order(names, SEED_CATEGORIES_AR)


def test_categories_locale_en_falls_back_to_ru(client):
    # en не входит в settings.locales -> pick_locale возвращает ru
    cats = client.get("/api/categories?locale=en").json()
    names = [c["name"] for c in cats]
    assert "Фреши" in names


def test_categories_unknown_locale_falls_back_to_ru(client):
    names = [c["name"] for c in client.get("/api/categories?locale=zz").json()]
    assert "Фреши" in names


def test_categories_public_no_auth_required(client):
    # эндпоинт публичный: токен не требуется и игнорируется
    r = client.get("/api/categories", headers={"Authorization": "Bearer garbage.token.value"})
    assert r.status_code == 200


def test_categories_wrong_method(client):
    assert client.post("/api/categories").status_code == 405
    assert client.delete("/api/categories").status_code == 405


# ---------------------------------------------------------------------------
# GET /api/drinks
# ---------------------------------------------------------------------------
def test_drinks_happy_returns_only_published(client):
    drinks = client.get("/api/drinks").json()
    assert isinstance(drinks, list)
    # >= 28 (другие модули могут дозасеивать published-напитки в общую БД)
    assert len(drinks) >= 28
    slugs = {d["slug"] for d in drinks}
    assert "orange-fresh" in slugs
    assert "immunity-shot" in slugs
    assert "draft-example" not in slugs  # PUB-G-01 AC5: только published


def test_drinks_item_shape(client):
    d = next(x for x in client.get("/api/drinks").json() if x["slug"] == "orange-fresh")
    assert set(d.keys()) == {
        "id", "slug", "name", "previewUrl", "videoUrl",
        "basePrice", "kcal", "categoryId",
    }
    assert d["name"] == "Апельсиновый фреш"
    assert d["basePrice"] == 22
    assert d["kcal"] == 88
    assert d["categoryId"] == 1


def test_drinks_filter_by_category(client):
    fresh = client.get("/api/drinks?category=1").json()
    assert len(fresh) >= 10
    assert all(d["categoryId"] == 1 for d in fresh)  # фильтр строго по category_id
    assert "orange-fresh" in {d["slug"] for d in fresh}
    shots = client.get("/api/drinks?category=4").json()
    assert len(shots) >= 5
    assert all(d["categoryId"] == 4 for d in shots)
    assert "immunity-shot" in {d["slug"] for d in shots}


def test_drinks_filter_unknown_category_returns_empty(client):
    assert client.get("/api/drinks?category=999999").json() == []


def test_drinks_filter_category_draft_category_only_published(client):
    # draft-example в категории shots(4); фильтр всё равно не возвращает draft
    shots = client.get("/api/drinks?category=4").json()
    assert all(d["slug"] != "draft-example" for d in shots)


def test_drinks_category_invalid_type_422(client):
    r = client.get("/api/drinks?category=abc")
    assert r.status_code == 422


def test_drinks_category_float_type_422(client):
    r = client.get("/api/drinks?category=1.5")
    assert r.status_code == 422


def test_drinks_locale_ar(client):
    d = next(x for x in client.get("/api/drinks?locale=ar").json() if x["slug"] == "orange-fresh")
    assert d["name"] == "عصير برتقال"


def test_drinks_locale_en_falls_back_to_ru(client):
    d = next(x for x in client.get("/api/drinks?locale=en").json() if x["slug"] == "orange-fresh")
    assert d["name"] == "Апельсиновый фреш"


def test_drinks_unknown_locale_does_not_error(client):
    assert client.get("/api/drinks?locale=zz").status_code == 200


def test_drinks_public_no_auth(client):
    r = client.get("/api/drinks", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 200


def test_drinks_wrong_method(client):
    assert client.put("/api/drinks").status_code == 405


# ---------------------------------------------------------------------------
# GET /api/drinks/{slug}
# ---------------------------------------------------------------------------
def test_drink_detail_happy(client):
    d = client.get("/api/drinks/orange-fresh").json()
    assert set(d.keys()) == {
        "id", "slug", "name", "description", "videoUrl", "previewUrl",
        "basePrice", "kcal", "protein", "fat", "carbs", "addons",
    }
    assert d["slug"] == "orange-fresh"
    assert d["name"] == "Апельсиновый фреш"
    assert d["basePrice"] == 22
    assert d["kcal"] == 88
    assert d["protein"] == 1.4
    assert d["fat"] == 0.4
    assert d["carbs"] == 20
    assert isinstance(d["addons"], list) and len(d["addons"]) > 0


def test_drink_detail_addon_shape_and_kbju(client):
    d = client.get("/api/drinks/orange-fresh").json()
    ginger = next(a for a in d["addons"] if a["name"] == "Имбирь")
    expected_keys = {
        "addonId", "name", "imageUrl", "categoryId", "categoryName",
        "selectionType", "unit", "free", "pricePerPortion",
        "minPortions", "defaultPortions", "maxPortions", "portionAmount",
        "kcal", "protein", "fat", "carbs",
    }
    assert set(ginger.keys()) == expected_keys
    # КБЖУ пересчитаны на объём порции: kcal_per_100=80, portion_amount=10, default_portions=1
    # amount = 1*10 = 10 -> factor 0.1 -> kcal 8.0
    assert ginger["kcal"] == 8.0
    assert ginger["protein"] == 0.2  # 1.8*0.1
    assert ginger["unit"] == "g"
    assert ginger["selectionType"] == "multi"  # категория herbs
    assert ginger["free"] is False
    assert ginger["pricePerPortion"] == 3.0  # price_override


def test_drink_detail_free_addon_flag(client):
    d = client.get("/api/drinks/orange-fresh").json()
    mint = next(a for a in d["addons"] if a["name"] == "Мята")
    # price_override == None -> free=True (включена в стоимость)
    assert mint["free"] is True


def test_drink_detail_selection_types_present(client):
    d = client.get("/api/drinks/orange-fresh").json()
    types = {a["selectionType"] for a in d["addons"]}
    # есть counter (бустеры) и multi (фрукты/травы)
    assert "counter" in types
    assert "multi" in types
    assert types <= {"single", "multi", "counter"}


def test_drink_detail_locale_ar(client):
    d = client.get("/api/drinks/orange-fresh?locale=ar").json()
    assert d["name"] == "عصير برتقال"
    assert d["description"] == "طازج وبدون سكر."
    ginger = next(a for a in d["addons"] if a["categoryId"] == 3)  # herbs
    assert ginger["name"] == "زنجبيل"
    assert ginger["categoryName"] == "أعشاب وتوابل"


def test_drink_detail_locale_en_falls_back_to_ru(client):
    d = client.get("/api/drinks/orange-fresh?locale=en").json()
    assert d["name"] == "Апельсиновый фреш"
    assert d["description"] == "Свежевыжатый, без сахара."


def test_drink_detail_unknown_locale_fallback(client):
    d = client.get("/api/drinks/orange-fresh?locale=qq").json()
    assert d["name"] == "Апельсиновый фреш"


def test_drink_detail_not_found_unknown_slug(client):
    r = client.get("/api/drinks/no-such-drink")
    assert r.status_code == 404
    assert r.json()["detail"] == "NOT_FOUND"


def test_drink_detail_draft_is_404(client):
    # draft не published -> 404 (PUB-G-02 AC6)
    r = client.get("/api/drinks/draft-example")
    assert r.status_code == 404


def test_drink_detail_empty_slug_redirects_to_listing(client):
    # /api/drinks/ (пустой slug) НЕ обрабатывается деталкой: FastAPI редиректит (307)
    # на список /api/drinks, а не отдаёт объект-деталку.
    r = client.get("/api/drinks/", follow_redirects=False)
    assert r.status_code == 307
    assert r.headers["location"].endswith("/api/drinks")
    # при следовании за редиректом возвращается СПИСОК, а не объект деталки
    followed = client.get("/api/drinks/")
    assert isinstance(followed.json(), list)


def test_drink_detail_public_no_auth(client):
    r = client.get("/api/drinks/orange-fresh", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/drinks/{slug}/preview — happy paths
# ---------------------------------------------------------------------------
def _addon(client, slug, name):
    d = client.get(f"/api/drinks/{slug}").json()
    return next(a for a in d["addons"] if a["name"] == name)


def test_preview_empty_selections_returns_base(client):
    r = client.post("/api/drinks/orange-fresh/preview", json={"selections": []})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["price"] == 22.0
    assert body["kcal"] == 88.0
    assert body["protein"] == 1.4
    assert body["fat"] == 0.4
    assert body["carbs"] == 20.0
    assert body["addons"] == []


def test_preview_missing_selections_field_defaults_empty(client):
    # selections имеет дефолт [] -> тело {} валидно
    r = client.post("/api/drinks/orange-fresh/preview", json={})
    assert r.status_code == 200
    assert r.json()["price"] == 22.0


def test_preview_paid_addon_adds_price_and_kbju(client):
    ginger = _addon(client, "orange-fresh", "Имбирь")
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": ginger["addonId"], "portions": 1}]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["price"] == 25.0  # 22 + 3*1
    assert body["kcal"] == 96.0  # 88 + 8
    assert body["protein"] == 1.6  # 1.4 + 0.2
    assert len(body["addons"]) == 1
    assert body["addons"][0]["portions"] == 1


def test_preview_counter_multiple_portions(client):
    # коллаген — counter, max 2, price 8 за порцию, portion_amount 10
    coll = _addon(client, "orange-fresh", "Коллаген")
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": coll["addonId"], "portions": 2}]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["price"] == 38.0  # 22 + 8*2


def test_preview_multi_category_two_addons_ok(client):
    # herbs == multi: можно несколько добавок по 1 порции
    ginger = _addon(client, "orange-fresh", "Имбирь")
    mint = _addon(client, "orange-fresh", "Мята")
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [
            {"addonId": ginger["addonId"], "portions": 1},
            {"addonId": mint["addonId"], "portions": 1},
        ]},
    )
    assert r.status_code == 200, r.text
    assert len(r.json()["addons"]) == 2


def test_preview_single_category_one_addon_ok(client):
    # coconut — категория base == single; 1 добавка 1 порция допустима
    coconut = _addon(client, "watermelon-fresh", "Кокосовая вода")
    assert coconut["selectionType"] == "single"
    r = client.post(
        "/api/drinks/watermelon-fresh/preview",
        json={"selections": [{"addonId": coconut["addonId"], "portions": 1}]},
    )
    assert r.status_code == 200, r.text


def test_preview_default_portions_value_is_one(client):
    # PreviewSelection.portions имеет дефолт 1 -> можно не указывать
    ginger = _addon(client, "orange-fresh", "Имбирь")
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": ginger["addonId"]}]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["price"] == 25.0


def test_preview_min_portions_zero_allowed(client):
    # ginger min_portions=0 -> portions 0 в пределах диапазона, цена не растёт
    ginger = _addon(client, "orange-fresh", "Имбирь")
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": ginger["addonId"], "portions": 0}]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["price"] == 22.0


# ---------------------------------------------------------------------------
# POST preview — конфликты 409 (бизнес-валидация)
# ---------------------------------------------------------------------------
def test_preview_nonexistent_addon_409(client):
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": 9999999, "portions": 1}]},
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "ADDON_NOT_AVAILABLE"


def test_preview_existing_but_unlinked_addon_409(client):
    # чиа существует, но НЕ привязан к orange-fresh -> ADDON_NOT_AVAILABLE
    chia = _addon(client, "mango-smoothie", "Чиа")
    assert chia["addonId"] not in {a["addonId"] for a in client.get("/api/drinks/orange-fresh").json()["addons"]}
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": chia["addonId"], "portions": 1}]},
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "ADDON_NOT_AVAILABLE"


def test_preview_portions_over_max_409(client):
    # коллаген max_portions=2 -> 3 вне диапазона
    coll = _addon(client, "orange-fresh", "Коллаген")
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": coll["addonId"], "portions": 3}]},
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "ADDON_PORTIONS_OUT_OF_RANGE"


def test_preview_portions_below_min_409(client):
    # ginger min_portions=0 -> -1 ниже минимума
    ginger = _addon(client, "orange-fresh", "Имбирь")
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": ginger["addonId"], "portions": -1}]},
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "ADDON_PORTIONS_OUT_OF_RANGE"


def test_preview_multi_with_extra_portions_violates_type_409(client):
    # herbs == multi: portions>1 для одной добавки нарушает тип выбора
    ginger = _addon(client, "orange-fresh", "Имбирь")  # max_portions=2 -> 2 в диапазоне
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": ginger["addonId"], "portions": 2}]},
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "SELECTION_TYPE_VIOLATED"


def test_preview_range_check_precedes_type_check(client):
    # turmeric (counter) max_portions=1: portions=2 -> сначала диапазон, не тип
    turmeric = _addon(client, "orange-fresh", "Куркума")
    assert turmeric["selectionType"] == "counter"
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": turmeric["addonId"], "portions": 2}]},
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "ADDON_PORTIONS_OUT_OF_RANGE"


# ---------------------------------------------------------------------------
# POST preview — 404
# ---------------------------------------------------------------------------
def test_preview_unknown_slug_404(client):
    r = client.post("/api/drinks/no-such-drink/preview", json={"selections": []})
    assert r.status_code == 404
    assert r.json()["detail"] == "NOT_FOUND"


def test_preview_draft_slug_404(client):
    r = client.post("/api/drinks/draft-example/preview", json={"selections": []})
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST preview — 422 валидация полей
# ---------------------------------------------------------------------------
def test_preview_portions_wrong_type_422(client):
    ginger = _addon(client, "orange-fresh", "Имбирь")
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": ginger["addonId"], "portions": "two"}]},
    )
    assert r.status_code == 422


def test_preview_missing_addon_id_422(client):
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"portions": 1}]},
    )
    assert r.status_code == 422


def test_preview_addon_id_wrong_type_422(client):
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": "abc", "portions": 1}]},
    )
    assert r.status_code == 422


def test_preview_selections_not_a_list_422(client):
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": {"addonId": 5, "portions": 1}},
    )
    assert r.status_code == 422


def test_preview_selection_not_object_422(client):
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [123]},
    )
    assert r.status_code == 422


def test_preview_no_body_422(client):
    # тело обязательно (PreviewIn) -> отсутствие JSON-тела даёт 422
    r = client.post("/api/drinks/orange-fresh/preview")
    assert r.status_code == 422


def test_preview_extra_field_ignored(client):
    # pydantic по умолчанию игнорирует лишние поля -> 200
    ginger = _addon(client, "orange-fresh", "Имбирь")
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": ginger["addonId"], "portions": 1, "junk": "x"}],
              "extra": True},
    )
    assert r.status_code == 200, r.text


def test_preview_wrong_method(client):
    # preview только POST
    assert client.get("/api/drinks/orange-fresh/preview").status_code == 405


# ---------------------------------------------------------------------------
# БАГ: «бесплатная» добавка (free=True) всё равно увеличивает цену в preview.
# Модель DrinkAddon: «price_override NULL => добавка бесплатна (включена в стоимость)».
# Деталка возвращает free=True для Мяты, но preview добавляет pricePerPortion(=base_price)
# к итоговой цене: 22 -> 24. Ожидаем 22 (бесплатная не должна менять цену).
# ---------------------------------------------------------------------------
def test_preview_free_addon_does_not_increase_price(client):
    mint = _addon(client, "orange-fresh", "Мята")
    assert mint["free"] is True
    r = client.post(
        "/api/drinks/orange-fresh/preview",
        json={"selections": [{"addonId": mint["addonId"], "portions": 1}]},
    )
    assert r.status_code == 200, r.text
    # ожидаемое поведение: цена не меняется для бесплатной добавки
    assert r.json()["price"] == 22.0
