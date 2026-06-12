"""Исчерпывающие тесты роутера app/routers/staff.py (domain=staff).

Покрываем КАЖДЫЙ эндпоинт:
  POST   /api/staff/login
  GET    /api/staff/me
  GET    /api/staff/managers
  POST   /api/staff/managers
  DELETE /api/staff/managers/{staff_id}

Счастливые пути + негативы: 401 (нет токена / неверные креды / disabled),
403 (чужая роль / kind), 404 (несуществующий объект), 409 (конфликты),
422 (валидация полей: обязательность, типы, email-формат, enum role).
"""
import itertools

import pytest

# уникальные email для изоляции (session-scoped БД переиспользуется между тестами)
_email_counter = itertools.count()


def _uniq_email(prefix="exh"):
    return f"{prefix}{next(_email_counter)}@juicy.ae"


# ───────────────────────────── helpers ──────────────────────────────────────
def _make_manager_account(client, admin, role="manager", password="pass1234"):
    """Создаёт реальную учётку через admin-API, возвращает (payload, email, password)."""
    email = _uniq_email("acc")
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": email, "password": password, "name": "Acc", "role": role})
    assert r.status_code == 200, r.text
    return r.json(), email, password


# ════════════════════════════ POST /api/staff/login ═════════════════════════
def test_login_happy_admin(client):
    r = client.post("/api/staff/login", json={"email": "admin@juicy.ae", "password": "admin123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and data["token"]
    staff = data["staff"]
    assert staff["email"] == "admin@juicy.ae"
    assert staff["role"] == "super_admin"
    assert staff["disabled"] is False
    assert set(staff.keys()) == {"id", "email", "name", "role", "disabled"}
    # пароль/хэш не утекают наружу
    assert "password" not in staff and "password_hash" not in staff


def test_login_happy_manager(client):
    r = client.post("/api/staff/login", json={"email": "manager@juicy.ae", "password": "manager123"})
    assert r.status_code == 200, r.text
    assert r.json()["staff"]["role"] == "manager"


def test_login_wrong_password(client):
    r = client.post("/api/staff/login", json={"email": "admin@juicy.ae", "password": "WRONG"})
    assert r.status_code == 401
    assert r.json()["detail"] == "INVALID_CREDENTIALS"


def test_login_empty_password_string_rejected(client):
    """Пустой пароль — валиден по схеме (str без min_length), но не пройдёт verify → 401."""
    r = client.post("/api/staff/login", json={"email": "admin@juicy.ae", "password": ""})
    assert r.status_code == 401
    assert r.json()["detail"] == "INVALID_CREDENTIALS"


def test_login_unknown_email(client):
    r = client.post("/api/staff/login",
                    json={"email": "ghost-nobody@juicy.ae", "password": "whatever"})
    assert r.status_code == 401
    assert r.json()["detail"] == "INVALID_CREDENTIALS"


def test_login_disabled_account_rejected(client, admin):
    """disabled=True учётка не может залогиниться (soft-delete сценарий)."""
    payload, email, pwd = _make_manager_account(client, admin)
    # вход работает пока активна
    assert client.post("/api/staff/login", json={"email": email, "password": pwd}).status_code == 200
    # деактивируем через delete
    assert client.delete(f"/api/staff/managers/{payload['id']}",
                         headers=admin["headers"]).status_code == 200
    r = client.post("/api/staff/login", json={"email": email, "password": pwd})
    assert r.status_code == 401
    assert r.json()["detail"] == "INVALID_CREDENTIALS"


def test_login_case_sensitive_email_no_match(client):
    """Email хранится как есть; точное несовпадение регистра → нет пользователя → 401.

    (Нормализация email НЕ выполняется в роутере — фиксируем фактическое поведение.)
    """
    r = client.post("/api/staff/login", json={"email": "ADMIN@juicy.ae", "password": "admin123"})
    assert r.status_code == 401


def test_login_missing_password_422(client):
    r = client.post("/api/staff/login", json={"email": "admin@juicy.ae"})
    assert r.status_code == 422


def test_login_missing_email_422(client):
    r = client.post("/api/staff/login", json={"password": "admin123"})
    assert r.status_code == 422


def test_login_empty_body_422(client):
    r = client.post("/api/staff/login", json={})
    assert r.status_code == 422


def test_login_invalid_email_format_422(client):
    for bad in ("not-an-email", "missing-at.ae", "@nodomain.ae", "spaces in@x.ae", "plainaddress"):
        r = client.post("/api/staff/login", json={"email": bad, "password": "x"})
        assert r.status_code == 422, bad


def test_login_password_wrong_type_422(client):
    r = client.post("/api/staff/login", json={"email": "admin@juicy.ae", "password": 12345})
    assert r.status_code == 422


def test_login_email_null_422(client):
    r = client.post("/api/staff/login", json={"email": None, "password": "admin123"})
    assert r.status_code == 422


def test_login_no_auth_header_needed(client):
    """login — публичный, не требует Authorization (sanity)."""
    r = client.post("/api/staff/login", json={"email": "manager@juicy.ae", "password": "manager123"})
    assert r.status_code == 200


# ════════════════════════════ GET /api/staff/me ═════════════════════════════
def test_me_happy_admin(client, admin):
    r = client.get("/api/staff/me", headers=admin["headers"])
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == "admin@juicy.ae"
    assert data["role"] == "super_admin"
    assert set(data.keys()) == {"id", "email", "name", "role", "disabled"}


def test_me_happy_manager(client, manager):
    r = client.get("/api/staff/me", headers=manager["headers"])
    assert r.status_code == 200
    assert r.json()["role"] == "manager"


def test_me_no_token_401(client):
    r = client.get("/api/staff/me")
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_me_garbage_token_401(client):
    r = client.get("/api/staff/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_me_empty_bearer_401(client):
    r = client.get("/api/staff/me", headers={"Authorization": "Bearer "})
    assert r.status_code == 401


def test_me_customer_token_forbidden_403(client, customer):
    """Клиентский токен (kind=customer) недопустим для staff-эндпоинта → 403 FORBIDDEN."""
    r = client.get("/api/staff/me", headers=customer["headers"])
    assert r.status_code == 403
    assert r.json()["detail"] == "FORBIDDEN"


# ════════════════════════════ GET /api/staff/managers ═══════════════════════
def test_list_managers_happy_admin(client, admin):
    r = client.get("/api/staff/managers", headers=admin["headers"])
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 2
    emails = {row["email"] for row in rows}
    assert "admin@juicy.ae" in emails and "manager@juicy.ae" in emails
    # payload-форма каждого элемента
    for row in rows:
        assert set(row.keys()) == {"id", "email", "name", "role", "disabled"}
        assert "password_hash" not in row


def test_list_managers_manager_forbidden_403(client, manager):
    r = client.get("/api/staff/managers", headers=manager["headers"])
    assert r.status_code == 403
    assert r.json()["detail"] == "FORBIDDEN"


def test_list_managers_no_token_401(client):
    r = client.get("/api/staff/managers")
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_list_managers_customer_token_403(client, customer):
    r = client.get("/api/staff/managers", headers=customer["headers"])
    assert r.status_code == 403


# ════════════════════════════ POST /api/staff/managers ══════════════════════
def test_create_manager_happy_default_role(client, admin):
    email = _uniq_email("new")
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": email, "password": "secret12", "name": "Новый"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == email
    assert data["role"] == "manager"  # дефолт
    assert data["name"] == "Новый"
    assert data["disabled"] is False
    assert "id" in data
    assert "password" not in data and "password_hash" not in data
    # созданный менеджер реально может войти
    assert client.post("/api/staff/login",
                       json={"email": email, "password": "secret12"}).status_code == 200


def test_create_manager_explicit_super_admin_role(client, admin):
    email = _uniq_email("sa")
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": email, "password": "secret12", "name": "СА", "role": "super_admin"})
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "super_admin"
    # super_admin может листать менеджеров
    tok = client.post("/api/staff/login", json={"email": email, "password": "secret12"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/staff/managers", headers=h).status_code == 200


def test_create_manager_explicit_manager_role_has_no_admin_access(client, admin):
    """Созданный manager не имеет доступа к super-admin зонам (RBAC сквозной)."""
    _, email, pwd = _make_manager_account(client, admin, role="manager")
    tok = client.post("/api/staff/login", json={"email": email, "password": pwd}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/staff/managers", headers=h).status_code == 403


def test_create_manager_invalid_role_422(client, admin):
    for bad_role in ("admin", "owner", "MANAGER", "Super_Admin", "barista", ""):
        r = client.post("/api/staff/managers", headers=admin["headers"],
                        json={"email": _uniq_email("r"), "password": "secret12",
                              "name": "X", "role": bad_role})
        assert r.status_code == 422, bad_role
        assert r.json()["detail"] == "VALIDATION_ERROR"


def test_create_manager_duplicate_email_409(client, admin):
    email = _uniq_email("dup")
    r1 = client.post("/api/staff/managers", headers=admin["headers"],
                     json={"email": email, "password": "secret12", "name": "Первый"})
    assert r1.status_code == 200
    r2 = client.post("/api/staff/managers", headers=admin["headers"],
                     json={"email": email, "password": "other123", "name": "Второй"})
    assert r2.status_code == 409
    assert r2.json()["detail"] == "EMAIL_TAKEN"


def test_create_manager_duplicate_seed_email_409(client, admin):
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": "admin@juicy.ae", "password": "secret12", "name": "Clash"})
    assert r.status_code == 409
    assert r.json()["detail"] == "EMAIL_TAKEN"


def test_create_manager_role_checked_before_email_taken(client, admin):
    """Порядок проверок: невалидная роль с занятым email → 422 (роль проверяется первой)."""
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": "admin@juicy.ae", "password": "secret12",
                          "name": "X", "role": "bogus"})
    assert r.status_code == 422
    assert r.json()["detail"] == "VALIDATION_ERROR"


def test_create_manager_manager_forbidden_403(client, manager):
    r = client.post("/api/staff/managers", headers=manager["headers"],
                    json={"email": _uniq_email("f"), "password": "secret12", "name": "X"})
    assert r.status_code == 403
    assert r.json()["detail"] == "FORBIDDEN"


def test_create_manager_no_token_401(client):
    r = client.post("/api/staff/managers",
                    json={"email": _uniq_email("n"), "password": "secret12", "name": "X"})
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_create_manager_customer_token_403(client, customer):
    r = client.post("/api/staff/managers", headers=customer["headers"],
                    json={"email": _uniq_email("c"), "password": "secret12", "name": "X"})
    assert r.status_code == 403


def test_create_manager_missing_email_422(client, admin):
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"password": "secret12", "name": "X"})
    assert r.status_code == 422


def test_create_manager_missing_password_422(client, admin):
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": _uniq_email("mp"), "name": "X"})
    assert r.status_code == 422


def test_create_manager_missing_name_422(client, admin):
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": _uniq_email("mn"), "password": "secret12"})
    assert r.status_code == 422


def test_create_manager_invalid_email_format_422(client, admin):
    for bad in ("nope", "a@b", "no-at-symbol.ae", "@x.ae", "x@"):
        r = client.post("/api/staff/managers", headers=admin["headers"],
                        json={"email": bad, "password": "secret12", "name": "X"})
        assert r.status_code == 422, bad


def test_create_manager_name_wrong_type_422(client, admin):
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": _uniq_email("nt"), "password": "secret12", "name": 123})
    assert r.status_code == 422


def test_create_manager_role_wrong_type_422(client, admin):
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": _uniq_email("rt"), "password": "secret12",
                          "name": "X", "role": ["manager"]})
    assert r.status_code == 422


def test_create_manager_empty_body_422(client, admin):
    r = client.post("/api/staff/managers", headers=admin["headers"], json={})
    assert r.status_code == 422


@pytest.mark.parametrize("name", ["A", "x" * 80, "Имя С Пробелами", "  trimmed?  "])
def test_create_manager_name_boundaries_accepted(client, admin, name):
    """name: str без min/max в схеме — короткие/длинные/с пробелами принимаются."""
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": _uniq_email("nb"), "password": "secret12", "name": name})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == name


def test_create_manager_empty_name_accepted(client, admin):
    """Пустое имя не запрещено схемой (нет min_length) — фиксируем фактическое поведение."""
    r = client.post("/api/staff/managers", headers=admin["headers"],
                    json={"email": _uniq_email("en"), "password": "secret12", "name": ""})
    assert r.status_code == 200
    assert r.json()["name"] == ""


# ════════════════════════════ DELETE /api/staff/managers/{id} ═══════════════
def test_delete_manager_happy_soft_delete(client, admin):
    payload, email, pwd = _make_manager_account(client, admin)
    r = client.delete(f"/api/staff/managers/{payload['id']}", headers=admin["headers"])
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}
    # деактивирован — виден в списке как disabled=True (soft-delete, history сохраняется)
    rows = client.get("/api/staff/managers", headers=admin["headers"]).json()
    deleted = next(row for row in rows if row["id"] == payload["id"])
    assert deleted["disabled"] is True
    # больше не может войти
    assert client.post("/api/staff/login",
                       json={"email": email, "password": pwd}).status_code == 401


def test_delete_manager_idempotent(client, admin):
    """Повторное удаление уже деактивированного — снова ok (идемпотентно)."""
    payload, _, _ = _make_manager_account(client, admin)
    assert client.delete(f"/api/staff/managers/{payload['id']}",
                         headers=admin["headers"]).status_code == 200
    r2 = client.delete(f"/api/staff/managers/{payload['id']}", headers=admin["headers"])
    assert r2.status_code == 200
    assert r2.json() == {"ok": True}


def test_delete_manager_self_409(client, admin):
    """super_admin не может удалить сам себя."""
    me = client.get("/api/staff/me", headers=admin["headers"]).json()
    r = client.delete(f"/api/staff/managers/{me['id']}", headers=admin["headers"])
    assert r.status_code == 409
    assert r.json()["detail"] == "CANNOT_DELETE_SELF"


def test_delete_manager_not_found_404(client, admin):
    r = client.delete("/api/staff/managers/99999999", headers=admin["headers"])
    assert r.status_code == 404
    assert r.json()["detail"] == "NOT_FOUND"


def test_delete_manager_self_check_precedes_not_found(client, admin):
    """Если бы id==self был бы несуществующим — здесь self существует, проверяем порядок:
    self-check (409) выполняется ДО загрузки объекта."""
    me = client.get("/api/staff/me", headers=admin["headers"]).json()
    r = client.delete(f"/api/staff/managers/{me['id']}", headers=admin["headers"])
    assert r.status_code == 409  # не 404, хотя объект существует и активен


def test_delete_manager_manager_forbidden_403(client, manager, admin):
    payload, _, _ = _make_manager_account(client, admin)
    r = client.delete(f"/api/staff/managers/{payload['id']}", headers=manager["headers"])
    assert r.status_code == 403
    assert r.json()["detail"] == "FORBIDDEN"


def test_delete_manager_no_token_401(client, admin):
    payload, _, _ = _make_manager_account(client, admin)
    r = client.delete(f"/api/staff/managers/{payload['id']}")
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_delete_manager_customer_token_403(client, customer, admin):
    payload, _, _ = _make_manager_account(client, admin)
    r = client.delete(f"/api/staff/managers/{payload['id']}", headers=customer["headers"])
    assert r.status_code == 403


def test_delete_manager_non_integer_id_422(client, admin):
    r = client.delete("/api/staff/managers/not-a-number", headers=admin["headers"])
    assert r.status_code == 422


def test_delete_manager_negative_id_404(client, admin):
    """Отрицательный id — валиден как int, но объекта нет → 404."""
    r = client.delete("/api/staff/managers/-5", headers=admin["headers"])
    assert r.status_code == 404
    assert r.json()["detail"] == "NOT_FOUND"


def test_deleted_manager_token_becomes_invalid_401(client, admin):
    """Токен деактивированного staff перестаёт работать на защищённых эндпоинтах."""
    payload, email, pwd = _make_manager_account(client, admin)
    tok = client.post("/api/staff/login", json={"email": email, "password": pwd}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/staff/me", headers=h).status_code == 200
    # деактивируем
    client.delete(f"/api/staff/managers/{payload['id']}", headers=admin["headers"])
    # старый токен больше не валиден (get_current_staff: staff.disabled → 401)
    r = client.get("/api/staff/me", headers=h)
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"
