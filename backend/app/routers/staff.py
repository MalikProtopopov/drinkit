from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import (get_current_staff, hash_password, make_token,
                             require_super_admin, verify_password)
from ..models.users import StaffUser

router = APIRouter(prefix="/api/staff", tags=["staff"])


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _payload(s: StaffUser) -> dict:
    return {"id": s.id, "email": s.email, "name": s.name, "role": s.role, "disabled": s.disabled}


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


@router.get("/managers")
def list_managers(_: StaffUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    return [_payload(s) for s in db.scalars(select(StaffUser)).all()]


@router.post("/managers")
def create_manager(body: ManagerIn, _: StaffUser = Depends(require_super_admin),
                   db: Session = Depends(get_db)):
    """ADM-S-06: добавление менеджеров."""
    if body.role not in ("manager", "super_admin"):
        raise HTTPException(422, "VALIDATION_ERROR")
    if db.scalar(select(StaffUser).where(StaffUser.email == body.email)):
        raise HTTPException(409, "EMAIL_TAKEN")
    s = StaffUser(email=body.email, password_hash=hash_password(body.password),
                  name=body.name, role=body.role)
    db.add(s)
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
