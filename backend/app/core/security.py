from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db

# DECISION: pbkdf2_sha256 (pure-python) вместо bcrypt — нет зависимости от нативной библиотеки
pwd = CryptContext(schemes=["pbkdf2_sha256"])
bearer = HTTPBearer(auto_error=False)


def hash_password(p: str) -> str:
    return pwd.hash(p)


def verify_password(p: str, h: str) -> bool:
    return pwd.verify(p, h)


def make_token(sub: str, kind: str, role: str | None = None) -> str:
    payload = {
        "sub": sub,
        "kind": kind,  # "customer" | "staff"
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_ttl_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "AUTH_REQUIRED")


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    from ..models.users import User

    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "AUTH_REQUIRED")
    data = decode_token(cred.credentials)
    if data.get("kind") != "customer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "FORBIDDEN")
    user = db.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "AUTH_REQUIRED")
    return user


def get_current_staff(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    from ..models.users import StaffUser

    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "AUTH_REQUIRED")
    data = decode_token(cred.credentials)
    if data.get("kind") != "staff":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "FORBIDDEN")
    staff = db.get(StaffUser, int(data["sub"]))
    if not staff or staff.disabled:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "AUTH_REQUIRED")
    return staff


def require_super_admin(staff=Depends(get_current_staff)):
    if staff.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "FORBIDDEN")
    return staff
