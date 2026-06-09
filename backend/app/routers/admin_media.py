"""Загрузка медиа в объектное хранилище (план §5.13) — только super_admin.

Возвращает {key, url, ...}; фронт кладёт key в строковое поле через обычный JSON-PATCH каталога.
"""
from fastapi import APIRouter, Depends, File, Form, UploadFile

from ..core.security import require_super_admin
from ..services import storage

router = APIRouter(prefix="/api/admin", tags=["admin-media"],
                   dependencies=[Depends(require_super_admin)])


@router.post("/media")
async def upload_media(file: UploadFile = File(...), folder: str = Form("misc")):
    return await storage.upload(file, folder=folder)
