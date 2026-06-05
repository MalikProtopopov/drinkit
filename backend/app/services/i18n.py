from ..core.config import settings


def t(value: dict | None, locale: str | None) -> str:
    """Достаёт перевод из JSON-поля с fallback на язык по умолчанию (PUB-A-09 AC7)."""
    if not value:
        return ""
    loc = locale if locale in settings.locales else settings.default_locale
    return value.get(loc) or value.get(settings.default_locale) or next(iter(value.values()), "")


def pick_locale(locale: str | None) -> str:
    return locale if locale in settings.locales else settings.default_locale
