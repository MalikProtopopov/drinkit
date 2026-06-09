"""Storage-слой медиа (план §5.13): единственное место, знающее про S3/MinIO.

Роутеры/модели оперируют только относительным КЛЮЧОМ объекта (media/drinks/<uuid>.png);
абсолютный URL собирается на чтении (media_url) — честный provider-swap без переписывания БД.
Без s3_bucket аплоад выключен (503), остальное приложение работает (graceful degradation).
boto3 импортируется лениво — приложение поднимается и без установленного boto3.
"""
import uuid

from fastapi import HTTPException, UploadFile

from ..core.config import settings

ALLOWED = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "video/mp4": ".mp4", "video/webm": ".webm",
}
MAX_BYTES = 25 * 1024 * 1024  # 25 МБ — превью и короткие видео

_client = None


def enabled() -> bool:
    return bool(settings.s3_bucket)


def _s3():
    global _client
    if not settings.s3_bucket:
        raise HTTPException(503, "MEDIA_STORAGE_DISABLED")
    if _client is None:
        try:
            import boto3  # ленивый импорт — без boto3 приложение всё равно стартует
            from botocore.config import Config
        except ModuleNotFoundError:
            raise HTTPException(503, "MEDIA_STORAGE_DISABLED")
        _client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
    return _client


def media_url(key: str | None) -> str | None:
    """Относительный ключ из БД → абсолютный URL для клиента. Уже-абсолютные/сид-пути — как есть."""
    if not key:
        return None
    if key.startswith(("http://", "https://", "/")):
        return key  # внешний URL или относительный путь сида (/videos/...) — отдаём как есть
    base = (settings.s3_public_url or settings.s3_endpoint_url or "").rstrip("/")
    return f"{base}/{settings.s3_bucket}/{key}" if base else key


async def upload(file: UploadFile, folder: str = "misc") -> dict:
    if file.content_type not in ALLOWED:
        raise HTTPException(422, "MEDIA_TYPE_NOT_ALLOWED")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "MEDIA_TOO_LARGE")
    ext = ALLOWED[file.content_type]
    key = f"media/{folder}/{uuid.uuid4().hex}{ext}"  # путь генерируем — нет path-traversal
    _s3().put_object(Bucket=settings.s3_bucket, Key=key, Body=data,
                     ContentType=file.content_type, CacheControl="public, max-age=31536000")
    return {"key": key, "url": media_url(key), "contentType": file.content_type, "size": len(data)}


def delete(key: str) -> None:
    _s3().delete_object(Bucket=settings.s3_bucket, Key=key)
