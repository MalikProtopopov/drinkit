"""Консервативная санитизация HTML для rich-описаний напитков.

Авторы — только супер-админы, но всё равно чистим вход: разрешаем узкий набор
форматирующих тегов (заголовки/жирный/курсив/списки), вырезаем все атрибуты
(в т.ч. on*-обработчики и style), полностью удаляем script/style вместе с содержимым.
"""
from html.parser import HTMLParser

ALLOWED_TAGS = {"h2", "h3", "h4", "p", "br", "b", "strong", "i", "em", "u",
                "ul", "ol", "li"}
VOID_TAGS = {"br"}
DROP_WITH_CONTENT = {"script", "style"}


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self._skip_depth = 0  # внутри script/style — выкидываем вместе с текстом

    def handle_starttag(self, tag, attrs):
        if tag in DROP_WITH_CONTENT:
            self._skip_depth += 1
            return
        if tag in ALLOWED_TAGS:
            # атрибуты намеренно отбрасываем целиком
            self.out.append(f"<{tag}>")

    def handle_startendtag(self, tag, attrs):
        if tag in ALLOWED_TAGS and tag in VOID_TAGS:
            self.out.append(f"<{tag}>")

    def handle_endtag(self, tag):
        if tag in DROP_WITH_CONTENT:
            if self._skip_depth:
                self._skip_depth -= 1
            return
        if tag in ALLOWED_TAGS and tag not in VOID_TAGS:
            self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self._skip_depth:
            return
        self.out.append(
            data.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )


def sanitize_html(raw: str | None) -> str:
    """Возвращает безопасный HTML; пустую/пробельную разметку нормализует в ''."""
    if not raw:
        return ""
    p = _Sanitizer()
    p.feed(raw)
    p.close()
    html = "".join(p.out).strip()
    # пусто по сути (например «<p></p>», «<br>») — считаем отсутствием описания
    stripped = (html.replace("<br>", "")
                    .replace("<p>", "").replace("</p>", "")
                    .replace("<h2>", "").replace("</h2>", "")
                    .replace("<h3>", "").replace("</h3>", "")
                    .replace("<h4>", "").replace("</h4>", "")
                    .replace("<b>", "").replace("</b>", "")
                    .replace("<strong>", "").replace("</strong>", "")
                    .replace("<i>", "").replace("</i>", "")
                    .replace("<em>", "").replace("</em>", "")
                    .replace("<u>", "").replace("</u>", "")
                    .replace("<ul>", "").replace("</ul>", "")
                    .replace("<ol>", "").replace("</ol>", "")
                    .replace("<li>", "").replace("</li>", "")
                    .strip())
    return html if stripped else ""
