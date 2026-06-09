"""Реестр глобальных настроек (план §5.17) — единый источник типов/дефолтов/валидации.

Новый параметр = одна строка в SETTINGS_SCHEMA, без миграции схемы.
Дефолты контактов = None (реальные значения сидятся данными, не код-литералами — фикс ревизии).
"""
import re

from sqlalchemy.orm import Session

from ..models.locations import AppSetting

# key -> {type, default, tab, [values|min]}
SETTINGS_SCHEMA: dict[str, dict] = {
    "default_daily_drink_limit": {"type": "int_or_null", "default": None, "tab": "defaults", "min": 1},
    "display_currency": {"type": "enum", "values": ["AED"], "default": "AED", "tab": "defaults"},
    "default_timezone": {"type": "tz", "default": "Asia/Dubai", "tab": "defaults"},
    "default_locale": {"type": "enum", "values": ["en", "ru", "ar"], "default": "en", "tab": "general"},
    "support_contact_email": {"type": "email", "default": None, "tab": "general"},
    "support_contact_phone": {"type": "phone", "default": None, "tab": "general"},
    "feature_product_detail": {"type": "bool", "default": False, "tab": "general"},
    "feature_coupons": {"type": "bool", "default": False, "tab": "general"},
}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_setting(db: Session, key: str):
    """Значение из БД или дефолт реестра (lazy, сид не обязателен)."""
    if key not in SETTINGS_SCHEMA:
        raise KeyError(key)
    row = db.get(AppSetting, key)
    if row is not None and isinstance(row.value, dict) and "v" in row.value:
        return row.value["v"]
    return SETTINGS_SCHEMA[key]["default"]


def all_settings(db: Session) -> dict:
    return {k: get_setting(db, k) for k in SETTINGS_SCHEMA}


def _validate(key: str, value):
    spec = SETTINGS_SCHEMA[key]
    t = spec["type"]
    if t == "bool":
        if not isinstance(value, bool):
            raise ValueError("BOOL_EXPECTED")
    elif t == "int_or_null":
        if value is not None:
            if not isinstance(value, int) or value < spec.get("min", 0):
                raise ValueError("INT_INVALID")
    elif t == "enum":
        if value not in spec["values"]:
            raise ValueError("ENUM_INVALID")
    elif t == "email":
        if value is not None and not _EMAIL_RE.match(str(value)):
            raise ValueError("EMAIL_INVALID")
    elif t == "phone":
        if value is not None and not re.match(r"^\+\d{7,15}$", str(value)):
            raise ValueError("PHONE_INVALID")
    elif t == "tz":
        from zoneinfo import available_timezones
        if value not in available_timezones():
            raise ValueError("TZ_INVALID")
    return value


def set_setting(db: Session, key: str, value, staff_id: int | None = None):
    if key not in SETTINGS_SCHEMA:
        raise KeyError(key)
    _validate(key, value)
    row = db.get(AppSetting, key)
    if row is None:
        row = AppSetting(key=key, value={"v": value}, updated_by=staff_id)
        db.add(row)
    else:
        row.value = {"v": value}
        row.updated_by = staff_id
    return value
