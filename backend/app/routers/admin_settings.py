"""Экран настроек /admin/settings (план §5.17) — только super_admin.

Глобальные бизнес-дефолты (app_settings) редактируются; секреты/инфра (env) — read-only;
per-location параметры здесь НЕ дублируются (они в /admin/locations).
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.db import get_db
from ..core.errors import http_error
from ..core.security import require_super_admin
from ..models.users import StaffUser
from ..services import settings_registry as reg

router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"],
                   dependencies=[Depends(require_super_admin)])


def _integrations() -> dict:
    """Read-only зеркало env: только статус configured|missing, без значений секретов."""
    def st(v):
        return "configured" if v else "missing"
    return {
        "stripe": st(settings.stripe_secret_key),
        "stripeWebhook": st(settings.stripe_webhook_secret),
        "otpEnabled": settings.auth_otp_enabled,
        "jwtAlg": settings.jwt_alg,
        "database": "masked",
        "redis": st(settings.redis_url),
        "ratingTimeoutMinutes": settings.rating_timeout_minutes,
        "locales": settings.locales,
    }


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    vals = reg.all_settings(db)
    editable = {"general": {}, "defaults": {}}
    for k, spec in reg.SETTINGS_SCHEMA.items():
        editable[spec["tab"]][k] = vals[k]
    return {"editable": editable, "readonly": {"integrations": _integrations()}}


class SettingsPatchIn(BaseModel):
    # произвольный набор editable-ключей
    model_config = {"extra": "allow"}


@router.patch("")
def patch_settings(body: dict, staff: StaffUser = Depends(require_super_admin),
                   db: Session = Depends(get_db)):
    for key, value in body.items():
        if key not in reg.SETTINGS_SCHEMA:
            raise http_error(422, "UNKNOWN_SETTING_KEY", key=key)
        try:
            reg.set_setting(db, key, value, staff_id=staff.id)
        except ValueError as e:
            raise http_error(422, "INVALID_SETTING", key=key, reason=str(e))
    db.commit()
    return {"ok": True, "values": reg.all_settings(db)}
