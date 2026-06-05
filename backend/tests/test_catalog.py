"""F02/F03: каталог, деталка, конструктор (PUB-G-01..03)."""


def test_categories_active_only(client):
    cats = client.get("/api/categories").json()
    names = [c["name"] for c in cats]
    # 4 сид-категории присутствуют (другие тесты могут добавлять свои)
    assert {"Фреши", "Смузи", "Детокс", "Шоты"} <= set(names)
    assert names[0] == "Фреши"  # сортировка по sort


def test_categories_locale_ar(client):
    cats = client.get("/api/categories?locale=ar").json()
    assert cats[0]["name"] == "عصائر طازجة"


def test_drinks_filter_by_category(client):
    cats = client.get("/api/categories").json()
    fresh = next(c for c in cats if c["name"] == "Фреши")
    drinks = client.get(f"/api/drinks?category={fresh['id']}").json()
    assert {d["slug"] for d in drinks} == {"orange-fresh", "watermelon-fresh", "pomegranate-fresh"}


def test_draft_not_in_catalog(client):
    """PUB-G-01 AC5: черновики не отдаются публичным API."""
    drinks = client.get("/api/drinks").json()
    assert all(d["slug"] != "draft-example" for d in drinks)


def test_draft_detail_404(client):
    """PUB-G-02 AC6."""
    assert client.get("/api/drinks/draft-example").status_code == 404


def test_detail_addons_recalced_to_default_portions(client):
    """PUB-G-03 AC2: КБЖУ пересчитан на дефолтный объём порции."""
    det = client.get("/api/drinks/orange-fresh").json()
    ginger = next(a for a in det["addons"] if a["name"] == "Имбирь")
    # имбирь: 80 ккал/100г, порция 10г => 8.0
    assert ginger["kcal"] == 8.0
    assert ginger["free"] is False
    carrot = next(a for a in det["addons"] if a["name"] == "Морковь")
    assert carrot["free"] is True  # price_override = NULL => бесплатно


def test_preview_price_and_kbju(client):
    """PUB-G-03 AC1/AC3: цена и КБЖУ растут с порциями."""
    det = client.get("/api/drinks/orange-fresh").json()
    ginger = next(a for a in det["addons"] if a["name"] == "Имбирь")
    collagen = next(a for a in det["addons"] if a["name"] == "Коллаген")
    r = client.post("/api/drinks/orange-fresh/preview", json={"selections": [
        {"addonId": ginger["addonId"], "portions": 1},
        {"addonId": collagen["addonId"], "portions": 2},
    ]})
    assert r.status_code == 200
    data = r.json()
    # 22 (база) + 3 (имбирь) + 8*2 (коллаген) = 41
    assert data["price"] == 41.0
    # ккал: 88 + 8 + 2*(370*0.1) = 170
    assert data["kcal"] == 170.0


def test_preview_portions_out_of_range(client):
    det = client.get("/api/drinks/orange-fresh").json()
    ginger = next(a for a in det["addons"] if a["name"] == "Имбирь")
    r = client.post("/api/drinks/orange-fresh/preview", json={"selections": [
        {"addonId": ginger["addonId"], "portions": 99}]})
    assert r.status_code == 409


def test_preview_selection_type_multi_violated(client):
    """ADM-S-02 AC4: multi не допускает >1 порции одной добавки."""
    det = client.get("/api/drinks/orange-fresh").json()
    mango = next(a for a in det["addons"] if a["name"] == "Манго")
    r = client.post("/api/drinks/orange-fresh/preview", json={"selections": [
        {"addonId": mango["addonId"], "portions": 2}]})
    assert r.status_code == 409


def test_preview_unknown_addon(client):
    r = client.post("/api/drinks/orange-fresh/preview", json={"selections": [
        {"addonId": 9999, "portions": 1}]})
    assert r.status_code == 409
