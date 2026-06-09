"""Тесты загрузки медиа (план §5.13). В тестах S3 не сконфигурирован → graceful 503."""
import io

from app.services import storage


def test_media_upload_disabled_without_s3(client, admin):
    # без S3_BUCKET аплоад выключен, но эндпоинт жив и отвечает понятным 503
    assert storage.enabled() is False
    files = {"file": ("x.png", io.BytesIO(b"\x89PNG\r\n"), "image/png")}
    r = client.post("/api/admin/media", headers=admin["headers"],
                    files=files, data={"folder": "drinks"})
    assert r.status_code == 503 and "MEDIA_STORAGE_DISABLED" in r.text


def test_media_upload_requires_super_admin(client, manager):
    files = {"file": ("x.png", io.BytesIO(b"\x89PNG"), "image/png")}
    r = client.post("/api/admin/media", headers=manager["headers"],
                    files=files, data={"folder": "drinks"})
    assert r.status_code == 403


def test_media_url_resolution():
    # относительный ключ → абсолютный URL только при наличии base; сид-пути и http — как есть
    assert storage.media_url(None) is None
    assert storage.media_url("/videos/x.mp4") == "/videos/x.mp4"
    assert storage.media_url("https://cdn/x.png") == "https://cdn/x.png"
