"""Исчерпывающие тесты роутера admin_catalog (ADM-S-01..05).

Покрытие эндпоинтов /api/admin/catalog/*:
  GET/POST/PATCH  drink-categories
  GET/POST        units
  GET/POST/PATCH  addon-categories
  GET/POST/PATCH  addons
  GET/POST/PATCH  drinks
  PUT             drinks/{id}/bindings

Для каждого: happy-path + негативы (401/403/404/409/422) + валидация полей,
enum-значения, границы порций, идемпотентность связок.

RBAC: весь роутер за require_super_admin -> manager/customer/anon должны падать.
"""
import uuid

import pytest

BASE = "/api/admin/catalog"


# ----------------------------------------------------------------------------
# Хелперы
# ----------------------------------------------------------------------------

def _uniq(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:10]}"


def _h(admin):
    return admin["headers"]


def _make_cat(client, admin, **over):
    body = {"name": {"ru": "К-" + _uniq()}, "sort": 0}
    body.update(over)
    r = client.post(f"{BASE}/drink-categories", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _any_unit(client, admin):
    return client.get(f"{BASE}/units", headers=_h(admin)).json()[0]


def _make_acat(client, admin, **over):
    body = {"name": {"ru": "AC-" + _uniq()}, "selectionType": "counter"}
    body.update(over)
    r = client.post(f"{BASE}/addon-categories", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _make_addon(client, admin, **over):
    acat = over.pop("_acat", None) or _make_acat(client, admin)
    unit = over.pop("_unit", None) or _any_unit(client, admin)
    body = {"name": {"ru": "A-" + _uniq()}, "categoryId": acat["id"], "unitId": unit["id"],
            "basePrice": 3, "kcalPer100": 10}
    body.update(over)
    r = client.post(f"{BASE}/addons", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _make_drink(client, admin, **over):
    cat = over.pop("_cat", None) or _make_cat(client, admin)
    body = {"slug": _uniq("d-"), "name": {"ru": "D-" + _uniq()}, "status": "draft",
            "basePrice": 18, "categoryId": cat["id"]}
    body.update(over)
    r = client.post(f"{BASE}/drinks", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ============================================================================
# RBAC: весь роутер требует super_admin
# ============================================================================

GET_ENDPOINTS = [
    "/drink-categories", "/units", "/addon-categories", "/addons", "/drinks",
]


def test_rbac_anonymous_401_on_all_reads(client):
    for ep in GET_ENDPOINTS:
        r = client.get(f"{BASE}{ep}")
        assert r.status_code == 401, f"{ep} -> {r.status_code}"


def test_rbac_customer_forbidden_403(client, customer):
    # customer-токен — kind != staff -> 403
    for ep in GET_ENDPOINTS:
        r = client.get(f"{BASE}{ep}", headers=customer["headers"])
        assert r.status_code == 403, f"{ep} -> {r.status_code}"


def test_rbac_manager_forbidden_403(client, manager):
    # manager-токен — role != super_admin -> 403
    for ep in GET_ENDPOINTS:
        r = client.get(f"{BASE}{ep}", headers=manager["headers"])
        assert r.status_code == 403, f"{ep} -> {r.status_code}"


def test_rbac_manager_forbidden_on_writes(client, manager):
    h = manager["headers"]
    assert client.post(f"{BASE}/drink-categories", headers=h,
                       json={"name": {"ru": "x"}}).status_code == 403
    assert client.post(f"{BASE}/units", headers=h,
                       json={"code": "zz", "name": {"ru": "x"}}).status_code == 403
    assert client.post(f"{BASE}/addon-categories", headers=h,
                       json={"name": {"ru": "x"}}).status_code == 403
    assert client.post(f"{BASE}/addons", headers=h,
                       json={"name": {"ru": "x"}, "categoryId": 1, "unitId": 1}).status_code == 403
    assert client.post(f"{BASE}/drinks", headers=h,
                       json={"slug": _uniq(), "name": {"ru": "x"}, "categoryId": 1}).status_code == 403
    assert client.put(f"{BASE}/drinks/1/bindings", headers=h, json=[]).status_code == 403


def test_rbac_invalid_token_401(client):
    r = client.get(f"{BASE}/drinks", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401


def test_rbac_anonymous_401_on_writes(client):
    assert client.post(f"{BASE}/drink-categories", json={"name": {"ru": "x"}}).status_code == 401
    assert client.patch(f"{BASE}/drinks/1", json={"slug": "a", "name": {}, "categoryId": 1}).status_code == 401
    assert client.put(f"{BASE}/drinks/1/bindings", json=[]).status_code == 401


# ============================================================================
# Drink categories (ADM-S-01)
# ============================================================================

def test_drink_category_list_ok(client, admin):
    r = client.get(f"{BASE}/drink-categories", headers=_h(admin))
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    # seed создаёт минимум 4 категории
    assert len(r.json()) >= 4
    sample = r.json()[0]
    for k in ("id", "name", "photoUrl", "videoUrl", "isActive", "sort"):
        assert k in sample


def test_drink_category_create_full(client, admin):
    body = {"name": {"ru": "Лимонады", "ar": "ليمونادة"}, "photoUrl": "/p.jpg",
            "videoUrl": "/v.mp4", "isActive": False, "sort": 42}
    r = client.post(f"{BASE}/drink-categories", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] > 0
    assert d["name"] == {"ru": "Лимонады", "ar": "ليمونادة"}
    assert d["photoUrl"] == "/p.jpg" and d["videoUrl"] == "/v.mp4"
    assert d["isActive"] is False and d["sort"] == 42


def test_drink_category_create_defaults(client, admin):
    r = client.post(f"{BASE}/drink-categories", headers=_h(admin),
                    json={"name": {"ru": "Деф"}})
    assert r.status_code == 200
    d = r.json()
    assert d["isActive"] is True and d["sort"] == 0
    assert d["photoUrl"] is None and d["videoUrl"] is None


def test_drink_category_missing_name_422(client, admin):
    r = client.post(f"{BASE}/drink-categories", headers=_h(admin), json={"sort": 1})
    assert r.status_code == 422


def test_drink_category_name_wrong_type_422(client, admin):
    # name должен быть dict (object), не строка
    r = client.post(f"{BASE}/drink-categories", headers=_h(admin),
                    json={"name": "строка"})
    assert r.status_code == 422


def test_drink_category_sort_wrong_type_422(client, admin):
    r = client.post(f"{BASE}/drink-categories", headers=_h(admin),
                    json={"name": {"ru": "x"}, "sort": "не число"})
    assert r.status_code == 422


def test_drink_category_isactive_wrong_type_422(client, admin):
    r = client.post(f"{BASE}/drink-categories", headers=_h(admin),
                    json={"name": {"ru": "x"}, "isActive": "yes-please"})
    assert r.status_code == 422


def test_drink_category_patch_ok(client, admin):
    c = _make_cat(client, admin)
    body = {"name": {"ru": "Обновл"}, "photoUrl": "/x.jpg", "isActive": False, "sort": 7}
    r = client.patch(f"{BASE}/drink-categories/{c['id']}", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["name"] == {"ru": "Обновл"} and d["isActive"] is False and d["sort"] == 7
    assert d["videoUrl"] is None  # не передан -> сброшен в None (PATCH семантика — полная замена)


def test_drink_category_patch_404(client, admin):
    r = client.patch(f"{BASE}/drink-categories/99999999", headers=_h(admin),
                     json={"name": {"ru": "x"}})
    assert r.status_code == 404


def test_drink_category_patch_missing_name_422(client, admin):
    c = _make_cat(client, admin)
    r = client.patch(f"{BASE}/drink-categories/{c['id']}", headers=_h(admin), json={"sort": 1})
    assert r.status_code == 422


# ============================================================================
# Units (ADM-S-04)
# ============================================================================

def test_units_list_ok(client, admin):
    r = client.get(f"{BASE}/units", headers=_h(admin))
    assert r.status_code == 200
    units = r.json()
    assert isinstance(units, list) and len(units) >= 4
    codes = {u["code"] for u in units}
    assert {"g", "ml", "pcs", "l"} <= codes
    for k in ("id", "code", "name"):
        assert k in units[0]


def test_unit_create_ok(client, admin):
    code = _uniq("u")[:18]
    r = client.post(f"{BASE}/units", headers=_h(admin),
                    json={"code": code, "name": {"ru": "Юнит", "ar": "وحدة"}})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] > 0 and d["code"] == code and d["name"]["ru"] == "Юнит"


def test_unit_create_duplicate_code_409(client, admin):
    # seed уже содержит код "g"
    r = client.post(f"{BASE}/units", headers=_h(admin),
                    json={"code": "g", "name": {"ru": "дубль"}})
    assert r.status_code == 409


def test_unit_create_duplicate_after_create_409(client, admin):
    code = _uniq("ud")[:18]
    assert client.post(f"{BASE}/units", headers=_h(admin),
                       json={"code": code, "name": {"ru": "a"}}).status_code == 200
    r = client.post(f"{BASE}/units", headers=_h(admin),
                    json={"code": code, "name": {"ru": "b"}})
    assert r.status_code == 409


def test_unit_missing_code_422(client, admin):
    r = client.post(f"{BASE}/units", headers=_h(admin), json={"name": {"ru": "x"}})
    assert r.status_code == 422


def test_unit_missing_name_422(client, admin):
    r = client.post(f"{BASE}/units", headers=_h(admin), json={"code": _uniq()})
    assert r.status_code == 422


def test_unit_name_wrong_type_422(client, admin):
    r = client.post(f"{BASE}/units", headers=_h(admin),
                    json={"code": _uniq(), "name": ["не", "dict"]})
    assert r.status_code == 422


# ============================================================================
# Addon categories (ADM-S-02)
# ============================================================================

def test_addon_category_list_ok(client, admin):
    r = client.get(f"{BASE}/addon-categories", headers=_h(admin))
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 4
    for k in ("id", "name", "iconUrl", "isActive", "selectionType"):
        assert k in rows[0]


@pytest.mark.parametrize("sel", ["single", "multi", "counter"])
def test_addon_category_create_each_enum(client, admin, sel):
    r = client.post(f"{BASE}/addon-categories", headers=_h(admin),
                    json={"name": {"ru": "x"}, "selectionType": sel})
    assert r.status_code == 200, r.text
    assert r.json()["selectionType"] == sel


def test_addon_category_default_selection_type(client, admin):
    r = client.post(f"{BASE}/addon-categories", headers=_h(admin), json={"name": {"ru": "x"}})
    assert r.status_code == 200
    assert r.json()["selectionType"] == "counter"
    assert r.json()["isActive"] is True and r.json()["iconUrl"] is None


def test_addon_category_invalid_selection_type_422(client, admin):
    r = client.post(f"{BASE}/addon-categories", headers=_h(admin),
                    json={"name": {"ru": "x"}, "selectionType": "radio"})
    assert r.status_code == 422


def test_addon_category_empty_selection_type_422(client, admin):
    r = client.post(f"{BASE}/addon-categories", headers=_h(admin),
                    json={"name": {"ru": "x"}, "selectionType": ""})
    assert r.status_code == 422


def test_addon_category_missing_name_422(client, admin):
    r = client.post(f"{BASE}/addon-categories", headers=_h(admin),
                    json={"selectionType": "single"})
    assert r.status_code == 422


def test_addon_category_patch_ok(client, admin):
    c = _make_acat(client, admin, selectionType="counter")
    r = client.patch(f"{BASE}/addon-categories/{c['id']}", headers=_h(admin),
                     json={"name": {"ru": "новое"}, "iconUrl": "/i.svg",
                           "isActive": False, "selectionType": "multi"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["selectionType"] == "multi" and d["isActive"] is False
    assert d["iconUrl"] == "/i.svg" and d["name"] == {"ru": "новое"}


def test_addon_category_patch_404(client, admin):
    r = client.patch(f"{BASE}/addon-categories/99999999", headers=_h(admin),
                     json={"name": {"ru": "x"}})
    assert r.status_code == 404


def test_addon_category_patch_invalid_selection_type_422(client, admin):
    c = _make_acat(client, admin)
    r = client.patch(f"{BASE}/addon-categories/{c['id']}", headers=_h(admin),
                     json={"name": {"ru": "x"}, "selectionType": "garbage"})
    assert r.status_code == 422


# ============================================================================
# Addons (ADM-S-03)
# ============================================================================

def test_addon_list_ok(client, admin):
    r = client.get(f"{BASE}/addons", headers=_h(admin))
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 1
    for k in ("id", "name", "imageUrl", "categoryId", "unitId", "kcalPer100",
              "proteinPer100", "fatPer100", "carbsPer100", "basePrice", "isActive"):
        assert k in rows[0]


def test_addon_create_full(client, admin):
    acat = _make_acat(client, admin)
    unit = _any_unit(client, admin)
    body = {"name": {"ru": "Сироп", "ar": "شراب"}, "imageUrl": "/s.png",
            "categoryId": acat["id"], "unitId": unit["id"],
            "kcalPer100": 300.5, "proteinPer100": 1.2, "fatPer100": 0.3,
            "carbsPer100": 70.0, "basePrice": 3.5, "isActive": True}
    r = client.post(f"{BASE}/addons", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["categoryId"] == acat["id"] and d["unitId"] == unit["id"]
    assert d["kcalPer100"] == 300.5 and d["basePrice"] == 3.5
    assert d["proteinPer100"] == 1.2 and d["carbsPer100"] == 70.0


def test_addon_create_defaults(client, admin):
    acat = _make_acat(client, admin)
    unit = _any_unit(client, admin)
    r = client.post(f"{BASE}/addons", headers=_h(admin),
                    json={"name": {"ru": "x"}, "categoryId": acat["id"], "unitId": unit["id"]})
    assert r.status_code == 200
    d = r.json()
    assert d["kcalPer100"] == 0 and d["basePrice"] == 0 and d["isActive"] is True
    assert d["imageUrl"] is None


def test_addon_missing_category_id_422(client, admin):
    unit = _any_unit(client, admin)
    r = client.post(f"{BASE}/addons", headers=_h(admin),
                    json={"name": {"ru": "x"}, "unitId": unit["id"]})
    assert r.status_code == 422


def test_addon_missing_unit_id_422(client, admin):
    acat = _make_acat(client, admin)
    r = client.post(f"{BASE}/addons", headers=_h(admin),
                    json={"name": {"ru": "x"}, "categoryId": acat["id"]})
    assert r.status_code == 422


def test_addon_missing_name_422(client, admin):
    acat = _make_acat(client, admin)
    unit = _any_unit(client, admin)
    r = client.post(f"{BASE}/addons", headers=_h(admin),
                    json={"categoryId": acat["id"], "unitId": unit["id"]})
    assert r.status_code == 422


def test_addon_price_wrong_type_422(client, admin):
    acat = _make_acat(client, admin)
    unit = _any_unit(client, admin)
    r = client.post(f"{BASE}/addons", headers=_h(admin),
                    json={"name": {"ru": "x"}, "categoryId": acat["id"], "unitId": unit["id"],
                          "basePrice": "дорого"})
    assert r.status_code == 422


def test_addon_category_id_wrong_type_422(client, admin):
    unit = _any_unit(client, admin)
    r = client.post(f"{BASE}/addons", headers=_h(admin),
                    json={"name": {"ru": "x"}, "categoryId": "abc", "unitId": unit["id"]})
    assert r.status_code == 422


def test_addon_negative_price_rejected(client, admin):
    acat = _make_acat(client, admin)
    unit = _any_unit(client, admin)
    r = client.post(f"{BASE}/addons", headers=_h(admin),
                    json={"name": {"ru": "x"}, "categoryId": acat["id"], "unitId": unit["id"],
                          "basePrice": -5})
    assert r.status_code == 422


def test_addon_negative_kcal_rejected(client, admin):
    acat = _make_acat(client, admin)
    unit = _any_unit(client, admin)
    r = client.post(f"{BASE}/addons", headers=_h(admin),
                    json={"name": {"ru": "x"}, "categoryId": acat["id"], "unitId": unit["id"],
                          "kcalPer100": -100})
    assert r.status_code == 422


@pytest.mark.xfail(reason="БАГ: categoryId/unitId не проверяются на существование (нет FK-валидации "
                          "на уровне API) — добавка ссылается на несуществующую категорию/единицу")
def test_addon_nonexistent_category_rejected(client, admin):
    unit = _any_unit(client, admin)
    r = client.post(f"{BASE}/addons", headers=_h(admin),
                    json={"name": {"ru": "x"}, "categoryId": 99999999, "unitId": unit["id"]})
    assert r.status_code in (404, 409, 422)


def test_addon_patch_ok(client, admin):
    a = _make_addon(client, admin, basePrice=3)
    new_acat = _make_acat(client, admin)
    body = {"name": {"ru": "обн"}, "categoryId": new_acat["id"], "unitId": a["unitId"],
            "basePrice": 9.0, "kcalPer100": 50, "isActive": False}
    r = client.patch(f"{BASE}/addons/{a['id']}", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["basePrice"] == 9.0 and d["categoryId"] == new_acat["id"]
    assert d["isActive"] is False and d["kcalPer100"] == 50


def test_addon_patch_404(client, admin):
    unit = _any_unit(client, admin)
    acat = _make_acat(client, admin)
    r = client.patch(f"{BASE}/addons/99999999", headers=_h(admin),
                     json={"name": {"ru": "x"}, "categoryId": acat["id"], "unitId": unit["id"]})
    assert r.status_code == 404


def test_addon_patch_missing_required_422(client, admin):
    a = _make_addon(client, admin)
    # categoryId/unitId обязательны и в PATCH (тело — та же модель AddonIn)
    r = client.patch(f"{BASE}/addons/{a['id']}", headers=_h(admin),
                     json={"name": {"ru": "x"}})
    assert r.status_code == 422


# ============================================================================
# Drinks (ADM-S-05)
# ============================================================================

def test_drink_list_includes_drafts(client, admin):
    r = client.get(f"{BASE}/drinks", headers=_h(admin))
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 1
    # админский список включает черновики
    statuses = {d["status"] for d in rows}
    assert "draft" in statuses
    for k in ("id", "slug", "name", "description", "status", "basePrice", "categoryId", "bindings"):
        assert k in rows[0]


def test_drink_create_full(client, admin):
    cat = _make_cat(client, admin)
    slug = _uniq("d-")
    body = {"slug": slug, "name": {"ru": "Напиток", "ar": "مشروب"},
            "description": {"ru": "опис"}, "status": "published", "previewUrl": "/p.jpg",
            "videoUrl": "/v.mp4", "basePrice": 22.5, "kcal": 88, "protein": 1.4,
            "fat": 0.4, "carbs": 20, "categoryId": cat["id"]}
    r = client.post(f"{BASE}/drinks", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["slug"] == slug and d["status"] == "published"
    assert d["basePrice"] == 22.5 and d["categoryId"] == cat["id"]
    assert d["description"] == {"ru": "опис"} and d["bindings"] == []


def test_drink_create_defaults(client, admin):
    cat = _make_cat(client, admin)
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": _uniq("d-"), "name": {"ru": "x"}, "categoryId": cat["id"]})
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "draft" and d["basePrice"] == 0
    assert d["description"] == {} and d["previewUrl"] is None


@pytest.mark.parametrize("status", ["draft", "published", "hidden"])
def test_drink_create_each_status_enum(client, admin, status):
    cat = _make_cat(client, admin)
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": _uniq("d-"), "name": {"ru": "x"}, "status": status,
                          "categoryId": cat["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == status


def test_drink_create_invalid_status_422(client, admin):
    cat = _make_cat(client, admin)
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": _uniq("d-"), "name": {"ru": "x"}, "status": "archived",
                          "categoryId": cat["id"]})
    assert r.status_code == 422


def test_drink_create_duplicate_slug_409(client, admin):
    cat = _make_cat(client, admin)
    slug = _uniq("dup-")
    assert client.post(f"{BASE}/drinks", headers=_h(admin),
                       json={"slug": slug, "name": {"ru": "x"}, "categoryId": cat["id"]}).status_code == 200
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": slug, "name": {"ru": "y"}, "categoryId": cat["id"]})
    assert r.status_code == 409


def test_drink_create_slug_collides_with_seed_409(client, admin):
    cat = _make_cat(client, admin)
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": "orange-fresh", "name": {"ru": "x"}, "categoryId": cat["id"]})
    assert r.status_code == 409


def test_drink_missing_slug_422(client, admin):
    cat = _make_cat(client, admin)
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"name": {"ru": "x"}, "categoryId": cat["id"]})
    assert r.status_code == 422


def test_drink_missing_name_422(client, admin):
    cat = _make_cat(client, admin)
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": _uniq("d-"), "categoryId": cat["id"]})
    assert r.status_code == 422


def test_drink_missing_category_id_422(client, admin):
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": _uniq("d-"), "name": {"ru": "x"}})
    assert r.status_code == 422


def test_drink_price_wrong_type_422(client, admin):
    cat = _make_cat(client, admin)
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": _uniq("d-"), "name": {"ru": "x"}, "categoryId": cat["id"],
                          "basePrice": "много"})
    assert r.status_code == 422


def test_drink_description_wrong_type_422(client, admin):
    cat = _make_cat(client, admin)
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": _uniq("d-"), "name": {"ru": "x"}, "categoryId": cat["id"],
                          "description": "строка-вместо-dict"})
    assert r.status_code == 422


def test_drink_negative_price_rejected(client, admin):
    cat = _make_cat(client, admin)
    r = client.post(f"{BASE}/drinks", headers=_h(admin),
                    json={"slug": _uniq("d-"), "name": {"ru": "x"}, "categoryId": cat["id"],
                          "basePrice": -10})
    assert r.status_code == 422


def test_drink_patch_ok(client, admin):
    d = _make_drink(client, admin, status="draft")
    body = dict(d)
    body["status"] = "published"
    body["basePrice"] = 33
    r = client.patch(f"{BASE}/drinks/{d['id']}", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "published" and r.json()["basePrice"] == 33


def test_drink_patch_404(client, admin):
    cat = _make_cat(client, admin)
    r = client.patch(f"{BASE}/drinks/99999999", headers=_h(admin),
                     json={"slug": _uniq("d-"), "name": {"ru": "x"}, "categoryId": cat["id"]})
    assert r.status_code == 404


def test_drink_patch_missing_slug_422(client, admin):
    d = _make_drink(client, admin)
    r = client.patch(f"{BASE}/drinks/{d['id']}", headers=_h(admin),
                     json={"name": {"ru": "x"}, "categoryId": d["categoryId"]})
    assert r.status_code == 422


def test_drink_patch_invalid_status_422(client, admin):
    d = _make_drink(client, admin)
    body = dict(d)
    body["status"] = "archived"
    r = client.patch(f"{BASE}/drinks/{d['id']}", headers=_h(admin), json=body)
    assert r.status_code == 422


# ============================================================================
# Bindings (PUT /drinks/{id}/bindings) — ADM-S-05 AC3
# ============================================================================

def test_bindings_set_ok(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    a2 = _make_addon(client, admin)
    body = [
        {"addonId": a1["id"], "priceOverride": None, "minPortions": 0,
         "defaultPortions": 1, "maxPortions": 2, "portionAmount": 15},
        {"addonId": a2["id"], "priceOverride": 5.0, "minPortions": 1,
         "defaultPortions": 1, "maxPortions": 3, "portionAmount": 30,
         "selectionTypeOverride": "single"},
    ]
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin), json=body)
    assert r.status_code == 200, r.text
    binds = r.json()["bindings"]
    assert len(binds) == 2
    by_addon = {b["addonId"]: b for b in binds}
    assert by_addon[a1["id"]]["priceOverride"] is None
    assert by_addon[a2["id"]]["priceOverride"] == 5.0
    assert by_addon[a2["id"]]["selectionTypeOverride"] == "single"
    assert by_addon[a1["id"]]["maxPortions"] == 2


def test_bindings_full_replacement(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    a2 = _make_addon(client, admin)
    # первая установка
    client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
               json=[{"addonId": a1["id"], "minPortions": 0, "defaultPortions": 1,
                      "maxPortions": 2, "portionAmount": 10}])
    # вторая установка полностью заменяет
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"addonId": a2["id"], "minPortions": 0, "defaultPortions": 1,
                          "maxPortions": 2, "portionAmount": 10}])
    binds = r.json()["bindings"]
    assert len(binds) == 1 and binds[0]["addonId"] == a2["id"]


def test_bindings_empty_clears(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
               json=[{"addonId": a1["id"], "minPortions": 0, "defaultPortions": 1,
                      "maxPortions": 2, "portionAmount": 10}])
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin), json=[])
    assert r.status_code == 200
    assert r.json()["bindings"] == []


def test_bindings_idempotent(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    body = [{"addonId": a1["id"], "minPortions": 0, "defaultPortions": 1,
             "maxPortions": 2, "portionAmount": 10}]
    r1 = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin), json=body).json()
    r2 = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin), json=body).json()
    # повторная установка того же тела даёт ту же структуру (1 связка, тот же addonId)
    assert len(r1["bindings"]) == len(r2["bindings"]) == 1
    assert r1["bindings"][0]["addonId"] == r2["bindings"][0]["addonId"] == a1["id"]


def test_bindings_drink_404(client, admin):
    a1 = _make_addon(client, admin)
    r = client.put(f"{BASE}/drinks/99999999/bindings", headers=_h(admin),
                   json=[{"addonId": a1["id"], "minPortions": 0, "defaultPortions": 1,
                          "maxPortions": 2, "portionAmount": 10}])
    assert r.status_code == 404


def test_bindings_addon_not_found_409(client, admin):
    d = _make_drink(client, admin)
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"addonId": 99999999, "minPortions": 0, "defaultPortions": 1,
                          "maxPortions": 2, "portionAmount": 10}])
    assert r.status_code == 409


def test_bindings_portions_range_invalid_422(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    # min > default нарушает 0<=min<=default<=max
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"addonId": a1["id"], "minPortions": 5, "defaultPortions": 1,
                          "maxPortions": 2, "portionAmount": 10}])
    assert r.status_code == 422


def test_bindings_default_gt_max_422(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    # default > max
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"addonId": a1["id"], "minPortions": 0, "defaultPortions": 5,
                          "maxPortions": 2, "portionAmount": 10}])
    assert r.status_code == 422


def test_bindings_negative_min_422(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    # min < 0 нарушает 0<=min
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"addonId": a1["id"], "minPortions": -1, "defaultPortions": 0,
                          "maxPortions": 2, "portionAmount": 10}])
    assert r.status_code == 422


def test_bindings_boundary_equal_allowed(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    # граница: min==default==max допустима (0<=0<=0<=0)
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"addonId": a1["id"], "minPortions": 0, "defaultPortions": 0,
                          "maxPortions": 0, "portionAmount": 10}])
    assert r.status_code == 200, r.text
    assert r.json()["bindings"][0]["maxPortions"] == 0


def test_bindings_defaults_applied(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    # только addonId -> применяются дефолты модели BindingIn (min0/def1/max3/amount30)
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"addonId": a1["id"]}])
    assert r.status_code == 200, r.text
    b = r.json()["bindings"][0]
    assert b["minPortions"] == 0 and b["defaultPortions"] == 1
    assert b["maxPortions"] == 3 and b["portionAmount"] == 30
    assert b["priceOverride"] is None


def test_bindings_missing_addon_id_422(client, admin):
    d = _make_drink(client, admin)
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"minPortions": 0, "defaultPortions": 1, "maxPortions": 2}])
    assert r.status_code == 422


def test_bindings_body_not_a_list_422(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    # тело должно быть list[BindingIn], не объект
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json={"addonId": a1["id"]})
    assert r.status_code == 422


def test_bindings_portions_wrong_type_422(client, admin):
    d = _make_drink(client, admin)
    a1 = _make_addon(client, admin)
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"addonId": a1["id"], "minPortions": "ноль"}])
    assert r.status_code == 422


def test_bindings_rejects_all_or_nothing_on_bad_addon(client, admin):
    """Если один addon в списке не существует -> 409 и НИ ОДНА связка не создаётся
    (валидация до clear/добавления; но clear идёт после проверок — проверим, что
    существующие связки не затёрты при ошибке)."""
    d = _make_drink(client, admin)
    a_ok = _make_addon(client, admin)
    # сначала ставим валидную связку
    client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
               json=[{"addonId": a_ok["id"], "minPortions": 0, "defaultPortions": 1,
                      "maxPortions": 2, "portionAmount": 10}])
    # теперь невалидный запрос (несуществующий addon) -> 409
    r = client.put(f"{BASE}/drinks/{d['id']}/bindings", headers=_h(admin),
                   json=[{"addonId": a_ok["id"]}, {"addonId": 99999999}])
    assert r.status_code == 409
    # прежняя связка сохранена (clear выполняется только после всех проверок)
    cur = client.get(f"{BASE}/drinks", headers=_h(admin)).json()
    mine = next(x for x in cur if x["id"] == d["id"])
    assert len(mine["bindings"]) == 1 and mine["bindings"][0]["addonId"] == a_ok["id"]
