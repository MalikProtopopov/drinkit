"""Исчерпывающие тесты роутера auth (app/routers/auth.py).

Покрытие эндпоинтов:
  - POST /api/auth/request-code
  - POST /api/auth/verify
  - GET  /api/auth/me
  - PATCH /api/auth/me

Проверяются: счастливый путь, 401/403/404/409/422, валидация полей
(phone-regex, обязательность, типы, границы), нормализация (carPlate uppercase,
locale en->ru), enum locale (ru/ar, 422 на fr в PATCH), идемпотентность,
протухание/повторное использование OTP-кода.

OTP включён глобально через conftest (AUTH_OTP_ENABLED=true).
"""

from datetime import datetime, timedelta

import pytest

# ---------------------------------------------------------------------------
# Утилиты
# ---------------------------------------------------------------------------


def _request_code(client, phone):
    r = client.post("/api/auth/request-code", json={"phone": phone})
    assert r.status_code == 200, r.text
    return r.json()


def _verify(client, phone, **kw):
    body = {"phone": phone}
    body.update(kw)
    return client.post("/api/auth/verify", json=body)


def _new_phone(suffix):
    """Уникальный валидный UAE-номер для изоляции пользователей между тестами."""
    return f"+9715{suffix:08d}"


def _login(client, phone, **kw):
    """Полный флоу: запрос кода -> verify с devCode. Возвращает json verify."""
    code = _request_code(client, phone)["devCode"]
    r = _verify(client, phone, code=code, **kw)
    assert r.status_code == 200, r.text
    return r.json()


def _auth_headers(client, phone, **kw):
    data = _login(client, phone, **kw)
    return {"Authorization": f"Bearer {data['token']}"}


# ===========================================================================
# POST /api/auth/request-code
# ===========================================================================


def test_request_code_happy(client):
    data = _request_code(client, _new_phone(10000001))
    assert data["sent"] is True
    assert data["otpRequired"] is True
    assert data["ttl"] == 300
    # dev-режим: код возвращается в ответе и совпадает с фиксированным
    assert data["devCode"] == "1836"


def test_request_code_missing_phone_422(client):
    r = client.post("/api/auth/request-code", json={})
    assert r.status_code == 422


def test_request_code_null_phone_422(client):
    r = client.post("/api/auth/request-code", json={"phone": None})
    assert r.status_code == 422


def test_request_code_empty_phone_422(client):
    r = client.post("/api/auth/request-code", json={"phone": ""})
    assert r.status_code == 422


def test_request_code_phone_without_plus_422(client):
    r = client.post("/api/auth/request-code", json={"phone": "971501234567"})
    assert r.status_code == 422


def test_request_code_phone_with_letters_422(client):
    r = client.post("/api/auth/request-code", json={"phone": "+9715abc4567"})
    assert r.status_code == 422


def test_request_code_phone_not_a_string_422(client):
    # int не проходит pattern-валидацию строки
    r = client.post("/api/auth/request-code", json={"phone": 971501234567})
    assert r.status_code == 422


def test_request_code_phone_too_short_422(client):
    # 8 цифр после '+' — ниже нижней границы (мин 9)
    r = client.post("/api/auth/request-code", json={"phone": "+12345678"})
    assert r.status_code == 422


def test_request_code_phone_min_boundary_9_digits_ok(client):
    # ровно 9 цифр — нижняя граница включительно
    r = client.post("/api/auth/request-code", json={"phone": "+123456789"})
    assert r.status_code == 200


def test_request_code_phone_max_boundary_15_digits_ok(client):
    # ровно 15 цифр — верхняя граница включительно
    r = client.post("/api/auth/request-code", json={"phone": "+123456789012345"})
    assert r.status_code == 200


def test_request_code_phone_too_long_16_digits_422(client):
    # 16 цифр — выше верхней границы (макс 15)
    r = client.post("/api/auth/request-code", json={"phone": "+1234567890123456"})
    assert r.status_code == 422


def test_request_code_phone_with_spaces_422(client):
    r = client.post("/api/auth/request-code", json={"phone": "+971 50 123 4567"})
    assert r.status_code == 422


def test_request_code_returns_fresh_code_each_call(client):
    # повторный запрос кода не падает (несколько OTP в БД допустимы)
    phone = _new_phone(10000002)
    d1 = _request_code(client, phone)
    d2 = _request_code(client, phone)
    assert d1["sent"] and d2["sent"]


# ===========================================================================
# POST /api/auth/verify  — счастливый путь и идемпотентность
# ===========================================================================


def test_verify_creates_user_happy(client):
    phone = _new_phone(20000001)
    data = _login(client, phone, name="Иван", locale="ru")
    assert data["created"] is True
    assert "token" in data
    u = data["user"]
    assert u["phone"] == phone
    assert u["name"] == "Иван"
    assert u["locale"] == "ru"
    assert u["carPlate"] is None
    assert u["emirate"] is None
    assert isinstance(u["id"], int)


def test_verify_idempotent_same_phone_not_recreated(client):
    phone = _new_phone(20000002)
    _login(client, phone, name="Первый")
    # повторный вход тем же телефоном — тот же пользователь, created=False
    data2 = _login(client, phone)
    assert data2["created"] is False


def test_verify_locale_ar_persists(client):
    phone = _new_phone(20000003)
    data = _login(client, phone, locale="ar")
    assert data["user"]["locale"] == "ar"


def test_verify_locale_en_normalized_to_ru(client):
    # en (legacy из localStorage) -> дефолтный ru, без падения
    phone = _new_phone(20000004)
    data = _login(client, phone, locale="en")
    assert data["user"]["locale"] == "ru"


def test_verify_locale_fr_normalized_to_ru_not_422(client):
    # ВАЖНО: в verify невалидная locale НЕ даёт 422 — тихо падает в default.
    phone = _new_phone(20000005)
    code = _request_code(client, phone)["devCode"]
    r = _verify(client, phone, code=code, locale="fr")
    assert r.status_code == 200
    assert r.json()["user"]["locale"] == "ru"


def test_verify_locale_missing_defaults_to_ru(client):
    phone = _new_phone(20000006)
    data = _login(client, phone)  # без locale
    assert data["user"]["locale"] == "ru"


def test_verify_name_optional(client):
    phone = _new_phone(20000007)
    data = _login(client, phone)  # без name
    assert data["created"] is True
    assert data["user"]["name"] is None


def test_verify_fills_name_when_empty_on_relogin(client):
    # пользователь создан без имени; при повторном verify с name имя проставляется
    phone = _new_phone(20000008)
    d1 = _login(client, phone)
    assert d1["user"]["name"] is None
    d2 = _login(client, phone, name="Позже")
    assert d2["created"] is False
    assert d2["user"]["name"] == "Позже"


def test_verify_does_not_overwrite_existing_name(client):
    # имя уже есть — повторный verify с другим именем не перезаписывает
    phone = _new_phone(20000009)
    _login(client, phone, name="Оригинал")
    d2 = _login(client, phone, name="Новое")
    assert d2["created"] is False
    assert d2["user"]["name"] == "Оригинал"


# ===========================================================================
# POST /api/auth/verify  — негативы (OTP)
# ===========================================================================


def test_verify_wrong_code_401(client):
    phone = _new_phone(30000001)
    _request_code(client, phone)
    r = _verify(client, phone, code="0000")
    assert r.status_code == 401
    assert r.json()["detail"] == "OTP_INVALID"


def test_verify_empty_code_401_when_otp_enabled(client):
    # code по умолчанию "" — не совпадает с 4-значным dev-кодом
    phone = _new_phone(30000002)
    _request_code(client, phone)
    r = _verify(client, phone)  # без code
    assert r.status_code == 401


def test_verify_no_code_requested_401(client):
    # код не запрашивался вовсе — нет OtpCode в БД
    phone = _new_phone(30000003)
    r = _verify(client, phone, code="1836")
    assert r.status_code == 401


def test_verify_code_reuse_401(client):
    # успешный verify помечает otp used=True; повторное использование того же кода -> 401
    phone = _new_phone(30000004)
    code = _request_code(client, phone)["devCode"]
    r1 = _verify(client, phone, code=code)
    assert r1.status_code == 200
    r2 = _verify(client, phone, code=code)
    assert r2.status_code == 401
    assert r2.json()["detail"] == "OTP_INVALID"


def test_verify_expired_code_401(client):
    # вставляем протухший OTP напрямую -> 401 OTP_INVALID
    from app.core.db import SessionLocal
    from app.models.users import OtpCode

    phone = _new_phone(30000005)
    db = SessionLocal()
    try:
        db.add(OtpCode(phone=phone, code="4242",
                       expires_at=datetime.utcnow() - timedelta(seconds=10)))
        db.commit()
    finally:
        db.close()
    r = _verify(client, phone, code="4242")
    assert r.status_code == 401
    assert r.json()["detail"] == "OTP_INVALID"


def test_verify_uses_latest_unused_code(client):
    # запрошены два кода (оба "1836" в dev), новый used помечается у последнего
    phone = _new_phone(30000006)
    _request_code(client, phone)
    code2 = _request_code(client, phone)["devCode"]
    r = _verify(client, phone, code=code2)
    assert r.status_code == 200


def test_verify_missing_phone_422(client):
    r = client.post("/api/auth/verify", json={"code": "1836"})
    assert r.status_code == 422


def test_verify_null_phone_422(client):
    r = client.post("/api/auth/verify", json={"phone": None, "code": "1836"})
    assert r.status_code == 422


def test_verify_phone_no_regex_constraint(client):
    # В VerifyIn у phone нет pattern: "странный" телефон даёт не 422, а 401
    # (т.к. для него не запрашивался код). Подтверждаем отсутствие 422.
    r = client.post("/api/auth/verify", json={"phone": "weird-phone", "code": "1836"})
    assert r.status_code == 401


def test_verify_code_wrong_type_422(client):
    # code объявлен как str — число должно дать 422
    phone = _new_phone(30000007)
    _request_code(client, phone)
    r = client.post("/api/auth/verify", json={"phone": phone, "code": 1836})
    assert r.status_code == 422


def test_verify_locale_wrong_type_422(client):
    phone = _new_phone(30000008)
    code = _request_code(client, phone)["devCode"]
    r = client.post("/api/auth/verify",
                    json={"phone": phone, "code": code, "locale": 123})
    assert r.status_code == 422


def test_verify_name_wrong_type_422(client):
    phone = _new_phone(30000009)
    code = _request_code(client, phone)["devCode"]
    r = client.post("/api/auth/verify",
                    json={"phone": phone, "code": code, "name": ["list"]})
    assert r.status_code == 422


# ===========================================================================
# GET /api/auth/me
# ===========================================================================


def test_me_happy(client):
    phone = _new_phone(40000001)
    headers = _auth_headers(client, phone, name="Профиль", locale="ar")
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    u = r.json()
    assert u["phone"] == phone
    assert u["name"] == "Профиль"
    assert u["locale"] == "ar"
    assert set(u.keys()) == {"id", "phone", "name", "carPlate", "emirate", "locale"}


def test_me_no_token_401(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_me_malformed_token_401(client):
    r = client.get("/api/auth/me",
                   headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_me_garbage_auth_header_401(client):
    # без схемы Bearer HTTPBearer(auto_error=False) -> cred is None -> 401
    r = client.get("/api/auth/me", headers={"Authorization": "Token abc"})
    assert r.status_code == 401


def test_me_staff_token_forbidden_403(client, manager):
    # staff-токен (kind=="staff") не проходит в кастомерский эндпоинт
    r = client.get("/api/auth/me", headers=manager["headers"])
    assert r.status_code == 403
    assert r.json()["detail"] == "FORBIDDEN"


def test_me_admin_token_forbidden_403(client, admin):
    r = client.get("/api/auth/me", headers=admin["headers"])
    assert r.status_code == 403


def test_me_uses_fixture_customer(client, customer):
    r = client.get("/api/auth/me", headers=customer["headers"])
    assert r.status_code == 200
    assert r.json()["id"] == customer["user"]["id"]


# ===========================================================================
# PATCH /api/auth/me
# ===========================================================================


def test_patch_me_carplate_uppercased(client):
    phone = _new_phone(50000001)
    headers = _auth_headers(client, phone)
    r = client.patch("/api/auth/me", headers=headers,
                     json={"carPlate": "o 12345", "emirate": "Dubai"})
    assert r.status_code == 200
    assert r.json()["carPlate"] == "O 12345"
    assert r.json()["emirate"] == "Dubai"


def test_patch_me_carplate_already_upper_stays(client):
    phone = _new_phone(50000002)
    headers = _auth_headers(client, phone)
    r = client.patch("/api/auth/me", headers=headers, json={"carPlate": "A 99999"})
    assert r.json()["carPlate"] == "A 99999"


def test_patch_me_name_update(client):
    phone = _new_phone(50000003)
    headers = _auth_headers(client, phone, name="Старое")
    r = client.patch("/api/auth/me", headers=headers, json={"name": "Новое Имя"})
    assert r.status_code == 200
    assert r.json()["name"] == "Новое Имя"


def test_patch_me_locale_ru_ok(client):
    phone = _new_phone(50000004)
    headers = _auth_headers(client, phone, locale="ar")
    r = client.patch("/api/auth/me", headers=headers, json={"locale": "ru"})
    assert r.status_code == 200
    assert r.json()["locale"] == "ru"


def test_patch_me_locale_ar_ok(client):
    phone = _new_phone(50000005)
    headers = _auth_headers(client, phone)
    r = client.patch("/api/auth/me", headers=headers, json={"locale": "ar"})
    assert r.status_code == 200
    assert r.json()["locale"] == "ar"


def test_patch_me_locale_fr_422(client):
    # enum: fr не в {ru, ar} -> 422 (в PATCH, в отличие от verify)
    phone = _new_phone(50000006)
    headers = _auth_headers(client, phone)
    r = client.patch("/api/auth/me", headers=headers, json={"locale": "fr"})
    assert r.status_code == 422
    assert r.json()["detail"] == "VALIDATION_ERROR"


def test_patch_me_locale_en_422(client):
    # en НЕ нормализуется в PATCH (в отличие от verify) — это 422
    phone = _new_phone(50000007)
    headers = _auth_headers(client, phone)
    r = client.patch("/api/auth/me", headers=headers, json={"locale": "en"})
    assert r.status_code == 422


def test_patch_me_locale_empty_string_422(client):
    phone = _new_phone(50000008)
    headers = _auth_headers(client, phone)
    r = client.patch("/api/auth/me", headers=headers, json={"locale": ""})
    assert r.status_code == 422


def test_patch_me_partial_does_not_touch_other_fields(client):
    # PATCH одним полем не сбрасывает остальные
    phone = _new_phone(50000009)
    headers = _auth_headers(client, phone, name="Имя", locale="ar")
    client.patch("/api/auth/me", headers=headers, json={"carPlate": "b 1"})
    r = client.patch("/api/auth/me", headers=headers, json={"emirate": "Sharjah"})
    u = r.json()
    assert u["name"] == "Имя"          # не тронуто
    assert u["locale"] == "ar"          # не тронуто
    assert u["carPlate"] == "B 1"       # из прошлого PATCH (uppercased)
    assert u["emirate"] == "Sharjah"


def test_patch_me_empty_body_noop_200(client):
    # пустой body допустим — ничего не меняется, 200
    phone = _new_phone(50000010)
    headers = _auth_headers(client, phone, name="Неизм")
    r = client.patch("/api/auth/me", headers=headers, json={})
    assert r.status_code == 200
    assert r.json()["name"] == "Неизм"


def test_patch_me_persists_across_requests(client):
    # изменения сохраняются в БД — видны в GET /me
    phone = _new_phone(50000011)
    headers = _auth_headers(client, phone)
    client.patch("/api/auth/me", headers=headers,
                 json={"carPlate": "z 7", "emirate": "Ajman", "locale": "ar"})
    r = client.get("/api/auth/me", headers=headers)
    u = r.json()
    assert u["carPlate"] == "Z 7"
    assert u["emirate"] == "Ajman"
    assert u["locale"] == "ar"


def test_patch_me_no_token_401(client):
    r = client.patch("/api/auth/me", json={"name": "X"})
    assert r.status_code == 401
    assert r.json()["detail"] == "AUTH_REQUIRED"


def test_patch_me_staff_token_403(client, manager):
    r = client.patch("/api/auth/me", headers=manager["headers"], json={"name": "X"})
    assert r.status_code == 403


def test_patch_me_carplate_wrong_type_422(client):
    phone = _new_phone(50000012)
    headers = _auth_headers(client, phone)
    r = client.patch("/api/auth/me", headers=headers, json={"carPlate": 12345})
    assert r.status_code == 422


def test_patch_me_name_wrong_type_422(client):
    phone = _new_phone(50000013)
    headers = _auth_headers(client, phone)
    r = client.patch("/api/auth/me", headers=headers, json={"name": {"obj": 1}})
    assert r.status_code == 422


def test_patch_me_locale_wrong_type_422(client):
    phone = _new_phone(50000014)
    headers = _auth_headers(client, phone)
    r = client.patch("/api/auth/me", headers=headers, json={"locale": 5})
    assert r.status_code == 422


def test_patch_me_name_null_explicit_noop(client):
    # name=None трактуется как "не менять" (body.name is not None -> False)
    phone = _new_phone(50000015)
    headers = _auth_headers(client, phone, name="Сохранить")
    r = client.patch("/api/auth/me", headers=headers, json={"name": None})
    assert r.status_code == 200
    assert r.json()["name"] == "Сохранить"
