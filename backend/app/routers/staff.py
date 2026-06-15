from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.pagination import PageLimit, PageOffset, paginate
from ..core.security import (get_current_staff, hash_password, make_token,
                             require_super_admin, verify_password)
from ..models.users import StaffUser

router = APIRouter(prefix="/api/staff", tags=["staff"])

# Роли персонала: super_admin — всё; manager — рабочий экран заказов;
# screen — публичное табло выдачи (read-only, логинится на ТВ у стойки).
STAFF_ROLES = ("manager", "super_admin", "screen")


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _payload(s: StaffUser) -> dict:
    return {"id": s.id, "email": s.email, "name": s.name, "role": s.role,
            "phone": s.phone, "note": s.note, "disabled": s.disabled}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Вход персонала. DECISION (Q16): email+пароль; 2FA — позже при необходимости."""
    staff = db.scalar(select(StaffUser).where(StaffUser.email == body.email))
    if not staff or staff.disabled or not verify_password(body.password, staff.password_hash):
        raise HTTPException(401, "INVALID_CREDENTIALS")
    return {"token": make_token(str(staff.id), "staff", role=staff.role), "staff": _payload(staff)}


@router.get("/me")
def me(staff: StaffUser = Depends(get_current_staff)):
    return _payload(staff)


class ManagerIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "manager"
    phone: str | None = None
    note: str | None = None


@router.get("/managers")
def list_managers(response: Response, limit: int | None = PageLimit, offset: int = PageOffset,
                  _: StaffUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    rows = [_payload(s) for s in db.scalars(select(StaffUser)).all()]
    return paginate(rows, response, limit, offset)


@router.post("/managers")
def create_manager(body: ManagerIn, _: StaffUser = Depends(require_super_admin),
                   db: Session = Depends(get_db)):
    """ADM-S-06: добавление менеджеров."""
    if body.role not in STAFF_ROLES:
        raise HTTPException(422, "VALIDATION_ERROR")
    if not body.name.strip():
        raise HTTPException(422, "NAME_REQUIRED")
    if len(body.password) < 6:
        raise HTTPException(422, "PASSWORD_TOO_SHORT")
    if db.scalar(select(StaffUser).where(StaffUser.email == body.email)):
        raise HTTPException(409, "EMAIL_TAKEN")
    s = StaffUser(email=body.email, password_hash=hash_password(body.password),
                  name=body.name.strip(), role=body.role,
                  phone=(body.phone or "").strip() or None,
                  note=(body.note or "").strip() or None)
    db.add(s)
    db.commit()
    return _payload(s)


class ManagerPatch(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: str | None = None
    phone: str | None = None
    note: str | None = None
    disabled: bool | None = None
    password: str | None = None  # необязательный сброс пароля


@router.patch("/managers/{staff_id}")
def update_manager(staff_id: int, body: ManagerPatch,
                   me_: StaffUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    """ADM-S-06: супер-админ редактирует карточку сотрудника (имя/фамилия, контакты, роль, доступ)."""
    s = db.get(StaffUser, staff_id)
    if not s:
        raise HTTPException(404, "NOT_FOUND")

    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(422, "NAME_REQUIRED")
        s.name = body.name.strip()
    if body.email is not None and body.email != s.email:
        if db.scalar(select(StaffUser).where(StaffUser.email == body.email, StaffUser.id != s.id)):
            raise HTTPException(409, "EMAIL_TAKEN")
        s.email = body.email
    if body.role is not None:
        if body.role not in STAFF_ROLES:
            raise HTTPException(422, "VALIDATION_ERROR")
        # нельзя снять с себя последние супер-права — чтобы не остаться без доступа
        if s.id == me_.id and body.role != "super_admin":
            raise HTTPException(409, "CANNOT_DEMOTE_SELF")
        s.role = body.role
    if body.phone is not None:
        s.phone = body.phone.strip() or None
    if body.note is not None:
        s.note = body.note.strip() or None
    if body.disabled is not None:
        if s.id == me_.id and body.disabled:
            raise HTTPException(409, "CANNOT_DISABLE_SELF")
        s.disabled = body.disabled
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(422, "PASSWORD_TOO_SHORT")
        s.password_hash = hash_password(body.password)

    db.commit()
    return _payload(s)


@router.delete("/managers/{staff_id}")
def delete_manager(staff_id: int, me_: StaffUser = Depends(require_super_admin),
                   db: Session = Depends(get_db)):
    """ADM-S-06: удаление менеджеров (история заказов сохраняется — учётка деактивируется)."""
    if staff_id == me_.id:
        raise HTTPException(409, "CANNOT_DELETE_SELF")
    s = db.get(StaffUser, staff_id)
    if not s:
        raise HTTPException(404, "NOT_FOUND")
    s.disabled = True  # DECISION: soft-delete, чтобы history.by_staff_id оставался валидным
    db.commit()
    return {"ok": True}
