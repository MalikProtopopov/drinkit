"""Исчерпывающие тесты роутера admin_orders (ADM-M-01..06).

Покрытие эндпоинтов:
  GET    /api/admin/orders              (+фильтры active / manager_id / unassigned)
  GET    /api/admin/orders/{id}
  POST   /api/admin/orders/{id}/take
  POST   /api/admin/orders/{id}/status  (enum -> 422, переходы -> 409)
  POST   /api/admin/orders/{id}/refund

Негативы: 401 (без токена), 403 (роль клиента), 404 (нет/чужой объект),
409 (конфликты переходов / не оплачен), 422 (валидация полей/enum).
"""
import pytest

from .conftest import make_order


# ---------------------------------------------------------------------------
# Локальные хелперы
# ---------------------------------------------------------------------------

def _new_customer(client, phone):
    """Создать свежего авторизованного клиента под отдельным телефоном."""
    r = client.post("/api/auth/request-code", json={"phone": phone})
    code = r.json()["devCode"]
    r = client.post("/api/auth/verify",
                    json={"phone": phone, "code": code, "name": "Доп", "locale": "ru"})
    data = r.json()
    return {"headers": {"Authorization": f"Bearer {data['token']}"}, "user": data["user"]}


def _make_unpaid_order(client, customer):
    """Создать заказ БЕЗ оплаты (payment_status=pending) — для проверки 409 на take."""
    det = client.get("/api/drinks/orange-fresh").json()
    body = {
        "items": [{"drinkId": det["id"], "quantity": 1}],
        "carPlate": "U 12345", "emirate": "Dubai", "customerName": "Тест",
    }
    r = client.post("/api/orders", json=body, headers=customer["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _advance(client, manager, oid, *statuses):
    """Прогнать заказ через take + последовательность статусов."""
    r = client.post(f"/api/admin/orders/{oid}/take", headers=manager["headers"])
    assert r.status_code == 200, r.text
    for s in statuses:
        r = client.post(f"/api/admin/orders/{oid}/status",
                        json={"status": s}, headers=manager["headers"])
        assert r.status_code == 200, r.text


# ===========================================================================
# GET /api/admin/orders — список
# ===========================================================================

def test_list_requires_auth(client):
    """401 без токена."""
    assert client.get("/api/admin/orders").status_code == 401


def test_list_forbidden_for_customer(client, customer):
    """403 для роли клиента (kind=customer)."""
    assert client.get("/api/admin/orders", headers=customer["headers"]).status_code == 403


def test_list_ok_for_manager_and_admin(client, customer, manager, admin):
    order = make_order(client, customer)
    for who in (manager, admin):
        r = client.get("/api/admin/orders", headers=who["headers"])
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert any(o["id"] == order["id"] for o in rows)


def test_list_only_paid_orders(client, customer, manager):
    """В выдаче только оплаченные заказы (payment_status == paid)."""
    paid = make_order(client, customer)
    unpaid = _make_unpaid_order(client, customer)
    rows = client.get("/api/admin/orders", headers=manager["headers"]).json()
    ids = {o["id"] for o in rows}
    assert paid["id"] in ids
    assert unpaid["id"] not in ids
    # все строки — только paid
    assert all(o["paymentStatus"] == "paid" for o in rows)


def test_list_sorted_by_id_desc(client, customer, manager):
    o1 = make_order(client, customer)
    o2 = make_order(client, customer)
    rows = client.get("/api/admin/orders", headers=manager["headers"]).json()
    ids = [o["id"] for o in rows]
    # новый заказ идёт раньше старого
    assert ids.index(o2["id"]) < ids.index(o1["id"])
    # глобально убывание
    assert ids == sorted(ids, reverse=True)


def test_list_row_shape(client, customer, manager):
    order = make_order(client, customer)
    rows = client.get("/api/admin/orders", headers=manager["headers"]).json()
    row = next(o for o in rows if o["id"] == order["id"])
    for key in ("id", "number", "status", "paymentStatus", "customerName", "phone",
                "carPlate", "emirate", "subtotal", "couponDiscount", "total",
                "managerId", "rating", "arrived", "createdAt", "items"):
        assert key in row, key
    assert row["status"] == "new"
    assert row["arrived"] is False
    assert isinstance(row["items"], list) and row["items"]
    # граммовка добавок присутствует в позиции (ADM-M-05 AC1)
    it = row["items"][0]
    for key in ("id", "name", "drinkName", "quantity", "unitPrice", "paidByCoupon", "addons"):
        assert key in it, key


def test_list_filter_active_true(client, customer, manager):
    """active=true показывает заказы в ACTIVE_STATUSES (new/in_progress/ready)."""
    active = make_order(client, customer)
    done = make_order(client, customer)
    _advance(client, manager, done["id"], "ready", "completed")
    rows = client.get("/api/admin/orders?active=true", headers=manager["headers"]).json()
    ids = {o["id"] for o in rows}
    assert active["id"] in ids
    assert done["id"] not in ids
    assert all(o["status"] in ("new", "in_progress", "ready") for o in rows)


def test_list_filter_active_false(client, customer, manager):
    """active=false — заказы вне ACTIVE_STATUSES (completed/refund)."""
    active = make_order(client, customer)
    done = make_order(client, customer)
    _advance(client, manager, done["id"], "ready", "completed")
    rows = client.get("/api/admin/orders?active=false", headers=manager["headers"]).json()
    ids = {o["id"] for o in rows}
    assert done["id"] in ids
    assert active["id"] not in ids
    assert all(o["status"] in ("completed", "refund") for o in rows)


def test_list_filter_unassigned(client, customer, manager):
    """unassigned=true — заказы без менеджера."""
    free = make_order(client, customer)
    taken = make_order(client, customer)
    client.post(f"/api/admin/orders/{taken['id']}/take", headers=manager["headers"])
    rows = client.get("/api/admin/orders?unassigned=true", headers=manager["headers"]).json()
    ids = {o["id"] for o in rows}
    assert free["id"] in ids
    assert taken["id"] not in ids
    assert all(o["managerId"] is None for o in rows)


def test_list_filter_manager_id(client, customer, manager):
    """manager_id фильтрует по закреплённому менеджеру."""
    order = make_order(client, customer)
    r = client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    mid = r.json()["managerId"]
    assert mid is not None
    rows = client.get(f"/api/admin/orders?manager_id={mid}", headers=manager["headers"]).json()
    assert any(o["id"] == order["id"] for o in rows)
    assert all(o["managerId"] == mid for o in rows)
    # несуществующий менеджер -> пусто
    empty = client.get("/api/admin/orders?manager_id=999999", headers=manager["headers"]).json()
    assert empty == []


def test_list_filter_active_invalid_type_422(client, manager):
    """active — bool; нечисловая строка -> 422."""
    r = client.get("/api/admin/orders?active=notabool", headers=manager["headers"])
    assert r.status_code == 422


def test_list_filter_manager_id_invalid_type_422(client, manager):
    r = client.get("/api/admin/orders?manager_id=abc", headers=manager["headers"])
    assert r.status_code == 422


# ===========================================================================
# GET /api/admin/orders/{id} — деталь
# ===========================================================================

def test_detail_requires_auth(client, customer):
    order = make_order(client, customer)
    assert client.get(f"/api/admin/orders/{order['id']}").status_code == 401


def test_detail_forbidden_for_customer(client, customer):
    order = make_order(client, customer)
    assert client.get(f"/api/admin/orders/{order['id']}",
                      headers=customer["headers"]).status_code == 403


def test_detail_ok_with_events(client, customer, manager):
    order = make_order(client, customer)
    r = client.get(f"/api/admin/orders/{order['id']}", headers=manager["headers"])
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == order["id"]
    assert "events" in data and isinstance(data["events"], list)
    types = [e["type"] for e in data["events"]]
    # история содержит создание и оплату (ADM-M-04)
    assert "created" in types and "paid" in types
    for e in data["events"]:
        for key in ("type", "status", "byStaffId", "byUserId", "note", "at"):
            assert key in e, key


def test_detail_not_found_404(client, manager):
    assert client.get("/api/admin/orders/99999999", headers=manager["headers"]).status_code == 404


def test_detail_invalid_id_type_422(client, manager):
    """order_id — int в пути; строка -> 422."""
    assert client.get("/api/admin/orders/abc", headers=manager["headers"]).status_code == 422


def test_detail_admin_can_read(client, customer, admin):
    order = make_order(client, customer)
    assert client.get(f"/api/admin/orders/{order['id']}",
                      headers=admin["headers"]).status_code == 200


# ===========================================================================
# POST /api/admin/orders/{id}/take — взять в работу
# ===========================================================================

def test_take_requires_auth(client, customer):
    order = make_order(client, customer)
    assert client.post(f"/api/admin/orders/{order['id']}/take").status_code == 401


def test_take_forbidden_for_customer(client, customer):
    order = make_order(client, customer)
    assert client.post(f"/api/admin/orders/{order['id']}/take",
                       headers=customer["headers"]).status_code == 403


def test_take_happy_path_assigns_manager(client, customer, manager):
    order = make_order(client, customer)
    r = client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "in_progress"
    assert data["managerId"] is not None


def test_take_not_found_404(client, manager):
    assert client.post("/api/admin/orders/99999999/take",
                       headers=manager["headers"]).status_code == 404


def test_take_unpaid_order_409(client, customer, manager):
    """ORDER_NOT_PAID -> 409 (take требует оплаченного заказа)."""
    unpaid = _make_unpaid_order(client, customer)
    r = client.post(f"/api/admin/orders/{unpaid['id']}/take", headers=manager["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "ORDER_NOT_PAID"


def test_take_twice_invalid_transition_409(client, customer, manager):
    """Повторный take (in_progress->in_progress) — невалидный переход -> 409."""
    order = make_order(client, customer)
    assert client.post(f"/api/admin/orders/{order['id']}/take",
                       headers=manager["headers"]).status_code == 200
    r = client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    assert r.status_code == 409


# ===========================================================================
# POST /api/admin/orders/{id}/status — смена статуса готовки
# ===========================================================================

def test_status_requires_auth(client, customer):
    order = make_order(client, customer)
    assert client.post(f"/api/admin/orders/{order['id']}/status",
                       json={"status": "ready"}).status_code == 401


def test_status_forbidden_for_customer(client, customer):
    order = make_order(client, customer)
    assert client.post(f"/api/admin/orders/{order['id']}/status",
                       json={"status": "ready"},
                       headers=customer["headers"]).status_code == 403


def test_status_happy_ready_then_completed(client, customer, manager):
    order = make_order(client, customer)
    client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    r = client.post(f"/api/admin/orders/{order['id']}/status",
                    json={"status": "ready"}, headers=manager["headers"])
    assert r.status_code == 200 and r.json()["status"] == "ready"
    r = client.post(f"/api/admin/orders/{order['id']}/status",
                    json={"status": "completed", "note": "выдано"}, headers=manager["headers"])
    assert r.status_code == 200 and r.json()["status"] == "completed"


def test_status_note_is_recorded(client, customer, manager):
    """note сохраняется в истории события смены статуса."""
    order = make_order(client, customer)
    client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    client.post(f"/api/admin/orders/{order['id']}/status",
                json={"status": "ready", "note": "звоночек"}, headers=manager["headers"])
    detail = client.get(f"/api/admin/orders/{order['id']}", headers=manager["headers"]).json()
    notes = [e["note"] for e in detail["events"] if e["type"] == "status_change"]
    assert "звоночек" in notes


def test_status_not_found_404(client, manager):
    r = client.post("/api/admin/orders/99999999/status",
                    json={"status": "ready"}, headers=manager["headers"])
    assert r.status_code == 404


def test_status_enum_invalid_value_422(client, customer, manager):
    """Значение статуса вне (ready|completed) -> 422 VALIDATION_ERROR."""
    order = make_order(client, customer)
    client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    for bad in ("new", "in_progress", "refund", "shipped", "READY", ""):
        r = client.post(f"/api/admin/orders/{order['id']}/status",
                        json={"status": bad}, headers=manager["headers"])
        assert r.status_code == 422, bad


def test_status_missing_field_422(client, customer, manager):
    """Отсутствует обязательное поле status -> 422 (pydantic)."""
    order = make_order(client, customer)
    r = client.post(f"/api/admin/orders/{order['id']}/status",
                    json={}, headers=manager["headers"])
    assert r.status_code == 422


def test_status_wrong_type_422(client, customer, manager):
    """status неверного типа (число) -> 422."""
    order = make_order(client, customer)
    r = client.post(f"/api/admin/orders/{order['id']}/status",
                    json={"status": 123}, headers=manager["headers"])
    assert r.status_code == 422


def test_status_note_wrong_type_422(client, customer, manager):
    """note должен быть строкой или null; число -> 422."""
    order = make_order(client, customer)
    client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    r = client.post(f"/api/admin/orders/{order['id']}/status",
                    json={"status": "ready", "note": 5}, headers=manager["headers"])
    assert r.status_code == 422


def test_status_invalid_transition_new_to_ready_409(client, customer, manager):
    """new -> ready запрещён (нужен сначала in_progress) -> 409."""
    order = make_order(client, customer)
    r = client.post(f"/api/admin/orders/{order['id']}/status",
                    json={"status": "ready"}, headers=manager["headers"])
    assert r.status_code == 409


def test_status_invalid_transition_new_to_completed_409(client, customer, manager):
    order = make_order(client, customer)
    r = client.post(f"/api/admin/orders/{order['id']}/status",
                    json={"status": "completed"}, headers=manager["headers"])
    assert r.status_code == 409


def test_status_invalid_transition_inprogress_to_completed_409(client, customer, manager):
    """in_progress -> completed запрещён (нужен ready) -> 409."""
    order = make_order(client, customer)
    client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    r = client.post(f"/api/admin/orders/{order['id']}/status",
                    json={"status": "completed"}, headers=manager["headers"])
    assert r.status_code == 409


def test_status_404_takes_priority_over_422(client, manager):
    """Несуществующий заказ + невалидный статус: 404 (объект проверяется первым)."""
    r = client.post("/api/admin/orders/99999999/status",
                    json={"status": "bogus"}, headers=manager["headers"])
    assert r.status_code == 404


def test_status_repeat_ready_is_invalid_transition_409(client, customer, manager):
    """Повторный ready (ready->ready) — невалидный переход, не идемпотентно -> 409."""
    order = make_order(client, customer)
    client.post(f"/api/admin/orders/{order['id']}/take", headers=manager["headers"])
    client.post(f"/api/admin/orders/{order['id']}/status",
                json={"status": "ready"}, headers=manager["headers"])
    r = client.post(f"/api/admin/orders/{order['id']}/status",
                    json={"status": "ready"}, headers=manager["headers"])
    assert r.status_code == 409


# ===========================================================================
# POST /api/admin/orders/{id}/refund — возврат
# ===========================================================================

def test_refund_requires_auth(client, customer):
    order = make_order(client, customer)
    assert client.post(f"/api/admin/orders/{order['id']}/refund").status_code == 401


def test_refund_forbidden_for_customer(client, customer):
    order = make_order(client, customer)
    assert client.post(f"/api/admin/orders/{order['id']}/refund",
                       headers=customer["headers"]).status_code == 403


def test_refund_happy_path(client, customer, manager):
    """completed -> refund: статус и payment_status меняются, платёж помечается.

    Тело передаём полностью (status+note), т.к. shared-модель StatusIn требует
    обязательное поле status даже на refund (см. xfail-тест ниже)."""
    order = make_order(client, customer)
    _advance(client, manager, order["id"], "ready", "completed")
    r = client.post(f"/api/admin/orders/{order['id']}/refund",
                    json={"status": "refund", "note": "брак"}, headers=manager["headers"])
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "refund"
    assert data["paymentStatus"] == "refunded"
    # клиент видит возврат (ADM-M-06 AC4)
    mine = client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
    assert mine["status"] == "refund"


def test_refund_with_only_note_should_work(client, customer, manager):
    """Ожидаемое поведение: note без status должен приниматься (status refund игнорирует)."""
    order = make_order(client, customer)
    _advance(client, manager, order["id"], "ready", "completed")
    r = client.post(f"/api/admin/orders/{order['id']}/refund",
                    json={"note": "брак"}, headers=manager["headers"])
    assert r.status_code == 200


def test_refund_works_without_body(client, customer, manager):
    """Тело опционально (StatusIn | None)."""
    order = make_order(client, customer)
    _advance(client, manager, order["id"], "ready", "completed")
    r = client.post(f"/api/admin/orders/{order['id']}/refund", headers=manager["headers"])
    assert r.status_code == 200
    assert r.json()["status"] == "refund"


def test_refund_not_found_404(client, manager):
    assert client.post("/api/admin/orders/99999999/refund",
                       headers=manager["headers"]).status_code == 404


def test_refund_before_completed_409(client, customer, manager):
    """Возврат возможен только из completed; из new -> 409 (невалидный переход)."""
    order = make_order(client, customer)
    r = client.post(f"/api/admin/orders/{order['id']}/refund", headers=manager["headers"])
    assert r.status_code == 409


def test_refund_from_ready_409(client, customer, manager):
    order = make_order(client, customer)
    _advance(client, manager, order["id"], "ready")
    r = client.post(f"/api/admin/orders/{order['id']}/refund", headers=manager["headers"])
    assert r.status_code == 409


def test_refund_twice_409(client, customer, manager):
    """Повторный возврат (refund->refund) запрещён -> 409 (не идемпотентно)."""
    order = make_order(client, customer)
    _advance(client, manager, order["id"], "ready", "completed")
    assert client.post(f"/api/admin/orders/{order['id']}/refund",
                       headers=manager["headers"]).status_code == 200
    r = client.post(f"/api/admin/orders/{order['id']}/refund", headers=manager["headers"])
    assert r.status_code == 409


def test_refund_note_wrong_type_422(client, customer, manager):
    """В refund тело — тот же StatusIn; note число -> 422 (даже при валидном status)."""
    order = make_order(client, customer)
    _advance(client, manager, order["id"], "ready", "completed")
    r = client.post(f"/api/admin/orders/{order['id']}/refund",
                    json={"status": "refund", "note": 99}, headers=manager["headers"])
    assert r.status_code == 422


# ===========================================================================
# Сквозные RBAC-проверки: чужая роль не имеет доступа ни к одному write-эндпоинту
# ===========================================================================

def test_customer_blocked_on_all_write_endpoints(client, customer):
    order = make_order(client, customer)
    oid = order["id"]
    assert client.post(f"/api/admin/orders/{oid}/take",
                       headers=customer["headers"]).status_code == 403
    assert client.post(f"/api/admin/orders/{oid}/status", json={"status": "ready"},
                       headers=customer["headers"]).status_code == 403
    assert client.post(f"/api/admin/orders/{oid}/refund",
                       headers=customer["headers"]).status_code == 403


def test_bad_token_unauthorized(client):
    """Битый токен -> 401."""
    h = {"Authorization": "Bearer not.a.real.jwt"}
    assert client.get("/api/admin/orders", headers=h).status_code == 401
