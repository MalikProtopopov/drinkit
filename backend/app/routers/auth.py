import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.db import get_db
from ..core.security import get_current_user, make_token
from ..models.users import OtpCode, User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class PhoneIn(BaseModel):
    phone: str = Field(pattern=r"^\+\d{9,15}$")


class VerifyIn(BaseModel):
    phone: str
    code: str
    name: str | None = None
    locale: str | None = None  # PUB-A-09 AC3: язык фиксируется при регистрации


@router.post("/request-code")
def request_code(body: PhoneIn, db: Session = Depends(get_db)):
    """PUB-G-04: запрос SMS-кода. DECISION: SMS-провайдер не выбран (откр. вопрос Q2),
    в dev-режиме код фиксированный и возвращается в ответе; интеграция-адаптер
    подключается в services/sms.py при выборе провайдера."""
    code = settings.otp_dev_code if settings.otp_dev_mode else f"{random.randint(0, 9999):04d}"
    db.add(OtpCode(phone=body.phone, code=code,
                   expires_at=datetime.utcnow() + timedelta(seconds=settings.otp_ttl_seconds)))
    db.commit()
    resp = {"sent": True, "ttl": settings.otp_ttl_seconds}
    if settings.otp_dev_mode:
        resp["devCode"] = code
    return resp


@router.post("/verify")
def verify(body: VerifyIn, db: Session = Depends(get_db)):
    otp = db.scalar(
        select(OtpCode)
        .where(OtpCode.phone == body.phone, OtpCode.code == body.code, OtpCode.used.is_(False))
        .order_by(OtpCode.id.desc())
    )
    if not otp or otp.expires_at < datetime.utcnow():
        raise HTTPException(401, "OTP_INVALID")
    otp.used = True

    user = db.scalar(select(User).where(User.phone == body.phone))
    created = False
    if not user:
        user = User(phone=body.phone, name=body.name,
                    preferred_locale=body.locale or settings.default_locale)
        db.add(user)
        created = True
    elif body.name and not user.name:
        user.name = body.name
    db.commit()
    return {
        "token": make_token(str(user.id), "customer"),
        "user": _user_payload(user),
        "created": created,
    }


def _user_payload(u: User) -> dict:
    return {
        "id": u.id, "phone": u.phone, "name": u.name,
        "carPlate": u.car_plate, "emirate": u.emirate, "locale": u.preferred_locale,
    }


class ProfileIn(BaseModel):
    name: str | None = None
    carPlate: str | None = None
    emirate: str | None = None
    locale: str | None = None


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    """PUB-A-01 AC4: данные для предзаполнения оформления."""
    return _user_payload(user)


@router.patch("/me")
def update_me(body: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """PUB-A-06: личные данные; PUB-A-09 AC5: смена языка в профиле."""
    if body.name is not None:
        user.name = body.name
    if body.carPlate is not None:
        user.car_plate = body.carPlate.upper()
    if body.emirate is not None:
        user.emirate = body.emirate
    if body.locale is not None:
        if body.locale not in settings.locales:
            raise HTTPException(422, "VALIDATION_ERROR")
        user.preferred_locale = body.locale
    db.commit()
    return _user_payload(user)
