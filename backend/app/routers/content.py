"""Контент сайта (CMS, план §5.11.1): info_blocks — Story / Contact / соцсети / блоки.

Админ-CRUD (super_admin) + публичная выдача по локали.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.errors import Err, http_error
from ..core.security import require_super_admin
from ..models.locations import InfoBlock
from ..services.i18n import pick_locale, t

router = APIRouter(prefix="/api/admin/content", tags=["admin-content"],
                   dependencies=[Depends(require_super_admin)])
public_router = APIRouter(prefix="/api/content", tags=["content"])


class BlockIn(BaseModel):
    key: str
    title: dict = {}
    body: dict = {}
    sort: int = 0
    isActive: bool = True


class BlockPatchIn(BaseModel):
    title: dict | None = None
    body: dict | None = None
    sort: int | None = None
    isActive: bool | None = None


def _row(b: InfoBlock) -> dict:
    return {"id": b.id, "key": b.key, "title": b.title, "body": b.body,
            "sort": b.sort, "isActive": b.is_active}


@router.get("")
def list_blocks(db: Session = Depends(get_db)):
    return [_row(b) for b in db.scalars(select(InfoBlock).order_by(InfoBlock.sort)).all()]


@router.post("")
def create_block(body: BlockIn, db: Session = Depends(get_db)):
    if db.scalar(select(InfoBlock).where(InfoBlock.key == body.key)):
        raise http_error(409, "KEY_TAKEN")
    b = InfoBlock(key=body.key, title=body.title, body=body.body, sort=body.sort,
                  is_active=body.isActive)
    db.add(b)
    db.commit()
    return _row(b)


@router.patch("/{block_id}")
def update_block(block_id: int, body: BlockPatchIn, db: Session = Depends(get_db)):
    b = db.get(InfoBlock, block_id)
    if not b:
        raise http_error(404, Err.LOCATION_NOT_FOUND)  # NOT_FOUND generic
    if "title" in body.model_fields_set:
        b.title = body.title
    if "body" in body.model_fields_set:
        b.body = body.body
    if "sort" in body.model_fields_set:
        b.sort = body.sort
    if "isActive" in body.model_fields_set:
        b.is_active = body.isActive
    db.commit()
    return _row(b)


@public_router.get("")
def public_content(locale: str = "en", db: Session = Depends(get_db)):
    """Публичная инфо-страница: активные блоки с контентом по локали."""
    locale = pick_locale(locale)
    blocks = db.scalars(select(InfoBlock).where(InfoBlock.is_active.is_(True))
                        .order_by(InfoBlock.sort)).all()
    return [{"key": b.key, "title": t(b.title, locale), "body": t(b.body, locale)}
            for b in blocks]
