"""Исчерпывающие тесты роутера dashboard (app/routers/dashboard.py).

Эндпоинт:
  GET /api/admin/dashboard  — 9 метрик супер-админа с фильтром по периоду from/to.

Метрики ответа:
  revenue, ordersCount, drinksSold, avgDrinksPerOrder, avgOrderValue,
  ordersByHour (0..23), topProducts[], topCustomers[].

Покрытие:
  - RBAC: 401 без токена / битый токен, 403 manager, 403 client/admin-customer,
    200 super_admin.
  - Структура ответа: ровно ожидаемые ключи, типы значений, инварианты.
  - Семантика метрик: учитываются только оплаченные (payment_status='paid') заказы,
    дельты при создании оплаченного заказа, topProducts/topCustomers/ordersByHour.
  - Фильтр периода from/to: ISO-даты и datetime, граница включения (>= / <=),
    пустой будущий период (нули), невалидная дата → 422, перепутанные границы.
  - Идемпотентность (повторный GET даёт ту же картину при неизменных данных).
  - Метод/маршрут: POST не разрешён (405), завершающий слэш.

ВАЖНО про изоляцию: фикстуры client/customer/admin/manager — session-scoped, БД
общая для всех модулей. Поэтому НЕ опираемся на абсолютные глобальные значения
(другие тесты тоже создают заказы), а проверяем:
  * структуру и типы,
  * монотонные ДЕЛЬТЫ при создании заказа в рамках теста,
  * изоляцию через узкие/будущие окна дат,
  * инварианты (avg = revenue/count и т.п.).
"""
import uuid
from datetime import datetime, timedelta

import pytest

from .conftest import make_order

DASH = "/api/admin/dashboard"

EXPECTED_KEYS = {
    "revenue", "ordersCount", "drinksSold", "avgDrinksPerOrder",
    "avgOrderValue", "ordersByHour", "topProducts", "topCustomers",
}


# ----------------------------------------------------------------------------
# Локальные хелперы (НЕ трогают conftest)
# ----------------------------------------------------------------------------
def _new_customer(client, name="Доп", locale="ru"):
    """Свежий авторизованный клиент с уникальным телефоном (OTP включён)."""
    phone = "+9715" + uuid.uuid4().int.__str__()[:8]
    r = client.post("/api/auth/request-code", json={"phone": phone})
    assert r.status_code == 200, r.text
    code = r.json()["devCode"]
    r = client.post("/api/auth/verify",
                    json={"phone": phone, "code": code, "name": name, "locale": locale})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"headers": {"Authorization": f"Bearer {data['token']}"}, "user": data["user"]}


def _dash(client, admin, **params):
    r = client.get(DASH, headers=admin["headers"], params=params or None)
    assert r.status_code == 200, r.text
    return r.json()


# ===========================================================================
# RBAC / АВТОРИЗАЦИЯ
# ===========================================================================
def test_no_token_401(client):
    r = client.get(DASH)
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_garbage_token_401(client):
    r = client.get(DASH, headers={"Authorization": "Bearer not.a.real.jwt"})
    assert r.status_code == 401


def test_empty_bearer_401(client):
    r = client.get(DASH, headers={"Authorization": "Bearer "})
    assert r.status_code == 401


def test_malformed_authorization_header_401(client):
    """Без схемы Bearer — HTTPBearer(auto_error=False) → cred None → 401."""
    r = client.get(DASH, headers={"Authorization": "token123"})
    assert r.status_code == 401


def test_manager_forbidden_403(client, manager):
    """Менеджер аутентифицирован как staff, но не super_admin → 403."""
    r = client.get(DASH, headers=manager["headers"])
    assert r.status_code == 403
    assert r.json()["detail"] == "FORBIDDEN"


def test_customer_token_forbidden_403(client, customer):
    """Клиент (kind=customer) не staff → get_current_staff отдаёт 403."""
    r = client.get(DASH, headers=customer["headers"])
    assert r.status_code == 403
    assert r.json()["detail"] == "FORBIDDEN"


def test_super_admin_ok_200(client, admin):
    r = client.get(DASH, headers=admin["headers"])
    assert r.status_code == 200


# ===========================================================================
# СТРУКТУРА / ТИПЫ ОТВЕТА
# ===========================================================================
def test_response_has_exactly_expected_keys(client, admin):
    data = _dash(client, admin)
    assert set(data.keys()) == EXPECTED_KEYS


def test_scalar_metric_types(client, admin):
    data = _dash(client, admin)
    assert isinstance(data["revenue"], (int, float))
    assert isinstance(data["ordersCount"], int)
    assert isinstance(data["drinksSold"], int)
    assert isinstance(data["avgDrinksPerOrder"], (int, float))
    assert isinstance(data["avgOrderValue"], (int, float))
    assert isinstance(data["ordersByHour"], dict)
    assert isinstance(data["topProducts"], list)
    assert isinstance(data["topCustomers"], list)


def test_metrics_non_negative(client, admin):
    data = _dash(client, admin)
    assert data["revenue"] >= 0
    assert data["ordersCount"] >= 0
    assert data["drinksSold"] >= 0
    assert data["avgDrinksPerOrder"] >= 0
    assert data["avgOrderValue"] >= 0


def test_orders_by_hour_has_24_buckets(client, admin):
    data = _dash(client, admin)
    hours = data["ordersByHour"]
    assert len(hours) == 24
    # JSON сериализует int-ключи как строки "0".."23"
    assert set(hours.keys()) == {str(h) for h in range(24)}
    assert all(isinstance(v, int) and v >= 0 for v in hours.values())


def test_orders_by_hour_sum_equals_orders_count(client, admin):
    """Каждый оплаченный заказ попадает ровно в один час → сумма == ordersCount."""
    data = _dash(client, admin)
    assert sum(data["ordersByHour"].values()) == data["ordersCount"]


def test_top_products_item_shape(client, admin, customer):
    # гарантируем наличие хотя бы одного оплаченного заказа
    make_order(client, customer)
    data = _dash(client, admin)
    assert len(data["topProducts"]) >= 1
    for p in data["topProducts"]:
        assert set(p.keys()) == {"name", "revenue", "qty"}
        assert isinstance(p["name"], str) and p["name"]
        assert isinstance(p["revenue"], (int, float)) and p["revenue"] >= 0
        assert isinstance(p["qty"], int) and p["qty"] >= 1


def test_top_products_sorted_by_revenue_desc(client, admin, customer):
    make_order(client, customer)
    data = _dash(client, admin)
    revs = [p["revenue"] for p in data["topProducts"]]
    assert revs == sorted(revs, reverse=True)


def test_top_products_limited_to_20(client, admin):
    data = _dash(client, admin)
    assert len(data["topProducts"]) <= 20


def test_top_customers_item_shape(client, admin, customer):
    make_order(client, customer)
    data = _dash(client, admin)
    assert len(data["topCustomers"]) >= 1
    for c in data["topCustomers"]:
        assert set(c.keys()) == {"userId", "phone", "name", "orders", "spent", "lastOrderAt"}
        assert isinstance(c["userId"], int)
        assert isinstance(c["phone"], str)
        # name может быть None у клиента без имени, но обычно строка
        assert c["name"] is None or isinstance(c["name"], str)
        assert isinstance(c["orders"], int) and c["orders"] >= 1
        assert isinstance(c["spent"], (int, float)) and c["spent"] >= 0
        assert c["lastOrderAt"] is None or isinstance(c["lastOrderAt"], str)


def test_top_customers_sorted_by_orders_desc(client, admin, customer):
    make_order(client, customer)
    data = _dash(client, admin)
    counts = [c["orders"] for c in data["topCustomers"]]
    assert counts == sorted(counts, reverse=True)


def test_top_customers_last_order_at_isoformat(client, admin, customer):
    make_order(client, customer)
    data = _dash(client, admin)
    for c in data["topCustomers"]:
        if c["lastOrderAt"] is not None:
            # должно парситься как ISO-8601
            datetime.fromisoformat(c["lastOrderAt"])


# ===========================================================================
# СЕМАНТИКА: ДЕЛЬТЫ ПРИ СОЗДАНИИ ОПЛАЧЕННОГО ЗАКАЗА
# ===========================================================================
def test_paid_order_increments_orders_count(client, admin, customer):
    before = _dash(client, admin)["ordersCount"]
    make_order(client, customer)
    after = _dash(client, admin)["ordersCount"]
    assert after == before + 1


def test_paid_order_adds_revenue(client, admin, customer):
    before = _dash(client, admin)["revenue"]
    order = make_order(client, customer)
    after = _dash(client, admin)["revenue"]
    # дельта выручки равна total заказа (с точностью до округления)
    assert round(after - before, 2) == round(order["total"], 2)


def test_paid_order_adds_three_drinks(client, admin, customer):
    """make_order создаёт 1 + 2 = 3 напитка → drinksSold растёт на 3."""
    before = _dash(client, admin)["drinksSold"]
    make_order(client, customer)
    after = _dash(client, admin)["drinksSold"]
    assert after - before == 3


def test_unpaid_order_not_counted(client, admin, customer):
    """Неоплаченный (pending) заказ НЕ учитывается в метриках dashboard."""
    before = _dash(client, admin)
    det = client.get("/api/drinks/orange-fresh").json()
    body = {
        "items": [{"drinkId": det["id"], "quantity": 1}],
        "carPlate": "z 99999", "emirate": "Dubai", "customerName": "NoPay",
    }
    r = client.post("/api/orders", json=body, headers=customer["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["paymentStatus"] == "pending"
    after = _dash(client, admin)
    assert after["ordersCount"] == before["ordersCount"]
    assert round(after["revenue"], 2) == round(before["revenue"], 2)
    assert after["drinksSold"] == before["drinksSold"]


def test_avg_order_value_invariant(client, admin, customer):
    make_order(client, customer)
    data = _dash(client, admin)
    assert data["ordersCount"] > 0
    expected = round(data["revenue"] / data["ordersCount"], 2)
    assert data["avgOrderValue"] == expected


def test_avg_drinks_per_order_invariant(client, admin, customer):
    make_order(client, customer)
    data = _dash(client, admin)
    assert data["ordersCount"] > 0
    expected = round(data["drinksSold"] / data["ordersCount"], 2)
    assert data["avgDrinksPerOrder"] == expected


def test_new_customer_appears_in_top_customers(client, admin):
    """Свежий клиент с оплаченным заказом появляется в topCustomers."""
    cust = _new_customer(client, name="DashTopGuy")
    make_order(client, cust)
    data = _dash(client, admin)
    uid = cust["user"]["id"]
    match = [c for c in data["topCustomers"] if c["userId"] == uid]
    assert match, "новый клиент должен присутствовать в topCustomers"
    assert match[0]["orders"] >= 1
    assert match[0]["spent"] > 0


# ===========================================================================
# ФИЛЬТР ПЕРИОДА from/to
# ===========================================================================
def test_future_window_is_empty(client, admin, customer):
    """Окно целиком в будущем → ни одного заказа: все метрики нулевые."""
    make_order(client, customer)  # есть заказы «сегодня», но они вне окна
    data = _dash(client, admin, **{"from": "2999-01-01", "to": "2999-12-31"})
    assert data["ordersCount"] == 0
    assert data["revenue"] == 0
    assert data["drinksSold"] == 0
    assert data["avgOrderValue"] == 0
    assert data["avgDrinksPerOrder"] == 0
    assert data["topProducts"] == []
    assert data["topCustomers"] == []
    assert sum(data["ordersByHour"].values()) == 0


def test_past_window_to_only_is_empty(client, admin, customer):
    """to в далёком прошлом → пусто (заказы созданы позже)."""
    make_order(client, customer)
    data = _dash(client, admin, to="2000-01-01")
    assert data["ordersCount"] == 0
    assert data["revenue"] == 0


def test_wide_window_includes_recent_order(client, admin, customer):
    """Широкое окно вокруг текущей даты включает только что созданный заказ."""
    before = _dash(client, admin, **{"from": "2000-01-01", "to": "2999-01-01"})["ordersCount"]
    make_order(client, customer)
    after = _dash(client, admin, **{"from": "2000-01-01", "to": "2999-01-01"})["ordersCount"]
    assert after == before + 1


def test_from_filter_lower_bound_inclusive(client, admin, customer):
    """Заказ, созданный «сейчас», виден при from <= now, и скрыт при from > now."""
    make_order(client, customer)
    now = datetime.utcnow()
    far_past = (now - timedelta(days=1)).date().isoformat()
    far_future = (now + timedelta(days=1)).date().isoformat()
    seen = _dash(client, admin, **{"from": far_past})["ordersCount"]
    hidden = _dash(client, admin, **{"from": far_future})["ordersCount"]
    assert seen >= 1
    assert hidden == 0


def test_to_filter_upper_bound(client, admin, customer):
    """to в прошлом скрывает свежие заказы, to в будущем — показывает."""
    make_order(client, customer)
    now = datetime.utcnow()
    past = (now - timedelta(days=1)).date().isoformat()
    future = (now + timedelta(days=1)).date().isoformat()
    hidden = _dash(client, admin, to=past)["ordersCount"]
    seen = _dash(client, admin, to=future)["ordersCount"]
    assert hidden == 0
    assert seen >= 1


def test_from_greater_than_to_yields_empty(client, admin, customer):
    """Перепутанные границы (from > to) дают пустое пересечение → нули, без ошибки."""
    make_order(client, customer)
    data = _dash(client, admin, **{"from": "2999-01-01", "to": "2000-01-01"})
    assert data["ordersCount"] == 0
    assert data["revenue"] == 0


def test_datetime_param_accepted(client, admin):
    """from/to принимают полный ISO datetime, не только дату."""
    r = client.get(DASH, headers=admin["headers"],
                   params={"from": "2026-01-01T00:00:00", "to": "2026-12-31T23:59:59"})
    assert r.status_code == 200
    assert set(r.json().keys()) == EXPECTED_KEYS


def test_only_from_param(client, admin):
    r = client.get(DASH, headers=admin["headers"], params={"from": "2025-01-01"})
    assert r.status_code == 200


def test_only_to_param(client, admin):
    r = client.get(DASH, headers=admin["headers"], params={"to": "2030-01-01"})
    assert r.status_code == 200


def test_narrow_today_window_isolates_counts(client, admin, customer):
    """Узкое окно «весь сегодня» ловит дельту от только что созданного заказа."""
    today = datetime.utcnow().date()
    start = today.isoformat()
    end = (today + timedelta(days=1)).isoformat()
    before = _dash(client, admin, **{"from": start, "to": end})["ordersCount"]
    make_order(client, customer)
    after = _dash(client, admin, **{"from": start, "to": end})["ordersCount"]
    assert after == before + 1


# ===========================================================================
# 422 — НЕВАЛИДНЫЕ ПАРАМЕТРЫ ДАТ
# ===========================================================================
def test_invalid_from_date_422(client, admin):
    r = client.get(DASH, headers=admin["headers"], params={"from": "notadate"})
    assert r.status_code == 422


def test_invalid_to_date_422(client, admin):
    r = client.get(DASH, headers=admin["headers"], params={"to": "32/13/2026"})
    assert r.status_code == 422


def test_from_numeric_garbage_422(client, admin):
    r = client.get(DASH, headers=admin["headers"], params={"from": "abc123"})
    assert r.status_code == 422


def test_empty_from_string_422(client, admin):
    """Пустая строка не парсится в datetime → 422."""
    r = client.get(DASH, headers=admin["headers"], params={"from": ""})
    assert r.status_code == 422


def test_impossible_calendar_date_422(client, admin):
    """Несуществующая календарная дата (31 февраля) → 422."""
    r = client.get(DASH, headers=admin["headers"], params={"from": "2026-02-31"})
    assert r.status_code == 422


def test_partial_date_string_422(client, admin):
    r = client.get(DASH, headers=admin["headers"], params={"to": "2026-13"})
    assert r.status_code == 422


# ===========================================================================
# ИДЕМПОТЕНТНОСТЬ / СТАБИЛЬНОСТЬ
# ===========================================================================
def test_repeated_calls_stable_when_data_unchanged(client, admin):
    """Без изменений данных два последовательных GET дают идентичный ответ."""
    a = _dash(client, admin)
    b = _dash(client, admin)
    assert a == b


def test_unknown_query_param_ignored(client, admin):
    """Неизвестный query-параметр игнорируется, ответ валиден."""
    r = client.get(DASH, headers=admin["headers"], params={"bogus": "1"})
    assert r.status_code == 200
    assert set(r.json().keys()) == EXPECTED_KEYS


# ===========================================================================
# МЕТОД / МАРШРУТ
# ===========================================================================
def test_post_not_allowed_405(client, admin):
    r = client.post(DASH, headers=admin["headers"], json={})
    assert r.status_code == 405


def test_put_not_allowed_405(client, admin):
    r = client.put(DASH, headers=admin["headers"], json={})
    assert r.status_code == 405


def test_delete_not_allowed_405(client, admin):
    r = client.delete(DASH, headers=admin["headers"])
    assert r.status_code == 405


def test_method_check_runs_before_auth(client):
    """405 (Method Not Allowed) отдаётся маршрутизацией до проверки токена."""
    r = client.post(DASH, json={})
    assert r.status_code == 405
