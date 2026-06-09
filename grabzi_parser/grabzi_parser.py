#!/usr/bin/env python3
"""
GRABZI frontend parser
======================

Парсер фронтенда магазина https://grabzi.ae/ (платформа Shopify).

Что забирает:
  • Каталог товаров         — через Shopify JSON API (/products.json, пагинация)
  • Коллекции               — /collections.json
  • Навигацию / меню        — ссылки на /pages/, /collections/, /products/ с главной
  • Контентные страницы     — /pages/* (заголовок + текст + ссылки)
  • Секции главной страницы — hero, заголовки, изображения (разбор HTML через BeautifulSoup)
  • Метаданные сайта        — title, og:*, шрифты, валюта

Результат — нормализованный JSON в каталоге output/ + читаемая сводка summary.md.
Опционально скачивает изображения товаров (--images).

Использование:
    python3 grabzi_parser.py                 # спарсить всё в ./output
    python3 grabzi_parser.py --images        # + скачать изображения
    python3 grabzi_parser.py --base https://grabzi.ae/ --out ./output
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

DEFAULT_BASE = "https://grabzi.ae/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
REQUEST_TIMEOUT = 30
PAGE_LIMIT = 250          # максимум, который отдаёт Shopify за раз
MAX_PAGES = 50            # предохранитель от бесконечной пагинации
POLITE_DELAY = 0.4        # пауза между запросами, чтобы не долбить сервер


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "en,ru;q=0.8"})
    return s


def get(session: requests.Session, url: str, *, as_json: bool = False, tries: int = 3):
    """GET с ретраями. Возвращает текст или разобранный JSON."""
    last_err = None
    for attempt in range(1, tries + 1):
        try:
            r = session.get(url, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            time.sleep(POLITE_DELAY)
            return r.json() if as_json else r.text
        except Exception as e:  # noqa: BLE001 — сетевые ошибки любого рода
            last_err = e
            wait = attempt * 1.5
            print(f"  ! {url} попытка {attempt}/{tries} не удалась ({e}); жду {wait:.1f}s",
                  file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Не удалось получить {url}: {last_err}")


# --------------------------------------------------------------------------- #
# Модель данных
# --------------------------------------------------------------------------- #
@dataclass
class Product:
    id: int
    title: str
    handle: str
    url: str
    description: str
    vendor: str
    product_type: str
    tags: list[str]
    price_min: float
    price_max: float
    currency: str
    available: bool
    options: list[dict]
    variants: list[dict]
    images: list[str]
    created_at: str
    updated_at: str


@dataclass
class Page:
    handle: str
    url: str
    title: str
    text: str
    links: list[str]


@dataclass
class Section:
    kind: str
    heading: str | None
    text: str | None
    images: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)


@dataclass
class SiteData:
    base_url: str
    parsed_at: str
    meta: dict
    nav: list[dict]
    collections: list[dict]
    products: list[Product]
    pages: list[Page]
    home_sections: list[Section]


# --------------------------------------------------------------------------- #
# Парсинг каталога (Shopify JSON API)
# --------------------------------------------------------------------------- #
def parse_products(session: requests.Session, base: str) -> list[Product]:
    products: list[Product] = []
    for page in range(1, MAX_PAGES + 1):
        url = urljoin(base, f"products.json?limit={PAGE_LIMIT}&page={page}")
        data = get(session, url, as_json=True)
        batch = data.get("products", [])
        if not batch:
            break
        for raw in batch:
            products.append(_normalize_product(raw, base))
        print(f"  · страница {page}: +{len(batch)} товаров (всего {len(products)})")
        if len(batch) < PAGE_LIMIT:
            break
    return products


def _normalize_product(raw: dict, base: str) -> Product:
    variants = raw.get("variants", []) or []
    prices = [float(v["price"]) for v in variants if v.get("price") is not None]
    images = [img["src"] for img in raw.get("images", []) if img.get("src")]
    body_html = raw.get("body_html") or ""
    description = BeautifulSoup(body_html, "html.parser").get_text(" ", strip=True)

    clean_variants = [
        {
            "id": v.get("id"),
            "title": v.get("title"),
            "sku": v.get("sku"),
            "price": float(v["price"]) if v.get("price") is not None else None,
            "compare_at_price": (
                float(v["compare_at_price"]) if v.get("compare_at_price") else None
            ),
            "available": v.get("available"),
            "options": [v.get("option1"), v.get("option2"), v.get("option3")],
        }
        for v in variants
    ]

    return Product(
        id=raw.get("id"),
        title=raw.get("title", "").strip(),
        handle=raw.get("handle", ""),
        url=urljoin(base, f"products/{raw.get('handle', '')}"),
        description=description,
        vendor=raw.get("vendor", ""),
        product_type=raw.get("product_type", ""),
        tags=raw.get("tags", []) or [],
        price_min=min(prices) if prices else 0.0,
        price_max=max(prices) if prices else 0.0,
        currency="AED",  # домен .ae; Shopify storefront в дирхамах
        available=any(v.get("available") for v in variants),
        options=raw.get("options", []) or [],
        variants=clean_variants,
        images=images,
        created_at=raw.get("created_at", ""),
        updated_at=raw.get("updated_at", ""),
    )


def parse_collections(session: requests.Session, base: str) -> list[dict]:
    url = urljoin(base, "collections.json?limit=250")
    try:
        data = get(session, url, as_json=True)
    except RuntimeError:
        return []
    return [
        {
            "id": c.get("id"),
            "title": c.get("title"),
            "handle": c.get("handle"),
            "description": c.get("description"),
            "products_count": c.get("products_count"),
            "url": urljoin(base, f"collections/{c.get('handle', '')}"),
        }
        for c in data.get("collections", [])
    ]


# --------------------------------------------------------------------------- #
# Парсинг HTML фронтенда
# --------------------------------------------------------------------------- #
def parse_meta(soup: BeautifulSoup) -> dict:
    def meta(attr: str, val: str) -> str | None:
        tag = soup.find("meta", attrs={attr: val})
        return tag.get("content") if tag else None

    fonts = sorted({
        m.group(1)
        for m in re.finditer(r"font-family:\s*'([^']+)'", str(soup))
    })
    return {
        "title": (soup.title.get_text(strip=True) if soup.title else None),
        "og_site_name": meta("property", "og:site_name"),
        "og_title": meta("property", "og:title"),
        "og_description": meta("property", "og:description"),
        "og_url": meta("property", "og:url"),
        "theme_color": meta("name", "theme-color"),
        "fonts": fonts,
    }


def parse_nav(soup: BeautifulSoup, base: str) -> list[dict]:
    """Ссылки навигации/меню → нормализованный список."""
    seen: dict[str, dict] = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not re.search(r"/(pages|collections|products)/", href):
            continue
        full = urljoin(base, href)
        # оставляем только внутренние ссылки этого магазина
        if urlparse(full).netloc != urlparse(base).netloc:
            continue
        label = a.get_text(" ", strip=True)
        if full not in seen or (label and not seen[full]["label"]):
            kind = (
                "page" if "/pages/" in href
                else "collection" if "/collections/" in href
                else "product"
            )
            seen[full] = {"label": label, "url": full, "kind": kind}
    return list(seen.values())


def parse_home_sections(soup: BeautifulSoup, base: str) -> list[Section]:
    """Грубый разбор Shopify-секций главной: заголовки, текст, картинки."""
    sections: list[Section] = []
    for node in soup.select("[class*='shopify-section'], section[class*='section']"):
        classes = " ".join(node.get("class", []))
        if "header-section" in classes:
            kind = "header"
        elif "footer" in classes:
            kind = "footer"
        else:
            kind = "content"

        heading_tag = node.find(["h1", "h2", "h3"])
        heading = heading_tag.get_text(" ", strip=True) if heading_tag else None

        paras = [p.get_text(" ", strip=True) for p in node.find_all("p")]
        text = "\n".join(t for t in paras if t) or None

        images = []
        for img in node.find_all("img", src=True):
            images.append(urljoin(base, img["src"]))
        for src in node.find_all(attrs={"data-src": True}):
            images.append(urljoin(base, src["data-src"]))

        links = sorted({
            urljoin(base, a["href"])
            for a in node.find_all("a", href=True)
            if not a["href"].startswith(("#", "mailto:", "tel:"))
        })

        if heading or text or images:
            sections.append(Section(
                kind=kind,
                heading=heading,
                text=(text[:1500] if text else None),
                images=list(dict.fromkeys(images))[:20],
                links=links[:20],
            ))
    return sections


def parse_page(session: requests.Session, url: str, base: str) -> Page:
    html = get(session, url)
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find("main") or soup.body or soup
    heading = main.find(["h1", "h2"])
    title = (
        heading.get_text(" ", strip=True) if heading
        else (soup.title.get_text(strip=True) if soup.title else url)
    )
    # убираем скрипты/стили перед извлечением текста
    for bad in main(["script", "style", "noscript"]):
        bad.decompose()
    text = re.sub(r"\n{3,}", "\n\n", main.get_text("\n", strip=True))
    links = sorted({
        urljoin(base, a["href"])
        for a in main.find_all("a", href=True)
        if not a["href"].startswith(("#", "mailto:", "tel:", "javascript:"))
    })
    handle = urlparse(url).path.rstrip("/").split("/")[-1]
    return Page(handle=handle, url=url, title=title, text=text[:8000], links=links)


# --------------------------------------------------------------------------- #
# Скачивание изображений
# --------------------------------------------------------------------------- #
def download_images(session: requests.Session, products: list[Product], out_dir: Path) -> int:
    img_dir = out_dir / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for p in products:
        for i, src in enumerate(p.images, 1):
            ext = Path(urlparse(src).path).suffix or ".jpg"
            dest = img_dir / f"{p.handle}-{i}{ext}"
            if dest.exists():
                continue
            try:
                r = session.get(src, timeout=REQUEST_TIMEOUT)
                r.raise_for_status()
                dest.write_bytes(r.content)
                count += 1
                time.sleep(POLITE_DELAY)
            except Exception as e:  # noqa: BLE001
                print(f"  ! изображение {src} не скачано: {e}", file=sys.stderr)
    return count


# --------------------------------------------------------------------------- #
# Вывод
# --------------------------------------------------------------------------- #
def _json_default(o):
    if hasattr(o, "__dataclass_fields__"):
        return asdict(o)
    raise TypeError(f"Не сериализуется: {type(o)}")


def write_outputs(site: SiteData, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "products.json").write_text(
        json.dumps([asdict(p) for p in site.products], ensure_ascii=False, indent=2)
    )
    (out_dir / "pages.json").write_text(
        json.dumps([asdict(p) for p in site.pages], ensure_ascii=False, indent=2)
    )
    (out_dir / "site.json").write_text(
        json.dumps(asdict(site), ensure_ascii=False, indent=2, default=_json_default)
    )
    (out_dir / "summary.md").write_text(_render_summary(site))


def _render_summary(site: SiteData) -> str:
    lines: list[str] = []
    lines.append(f"# GRABZI — выгрузка фронтенда\n")
    lines.append(f"- Источник: {site.base_url}")
    lines.append(f"- Спарсено: {site.parsed_at}")
    lines.append(f"- Название: {site.meta.get('og_site_name') or site.meta.get('title')}")
    lines.append(f"- Шрифты: {', '.join(site.meta.get('fonts', [])) or '—'}")
    lines.append(f"- Товаров: {len(site.products)} · Страниц: {len(site.pages)} "
                 f"· Секций главной: {len(site.home_sections)}\n")

    lines.append("## Навигация")
    for n in site.nav:
        lines.append(f"- [{n['kind']}] {n['label'] or '(без названия)'} → {n['url']}")
    lines.append("")

    lines.append("## Товары")
    for p in site.products:
        price = (f"{p.price_min:.2f} {p.currency}"
                 if p.price_min == p.price_max
                 else f"{p.price_min:.2f}–{p.price_max:.2f} {p.currency}")
        avail = "в наличии" if p.available else "нет в наличии"
        lines.append(f"### {p.title}")
        lines.append(f"- Цена: **{price}** · {avail}")
        lines.append(f"- URL: {p.url}")
        if p.description:
            lines.append(f"- Описание: {p.description}")
        if p.images:
            lines.append(f"- Изображения: {len(p.images)}")
            for src in p.images:
                lines.append(f"  - {src}")
        lines.append("")

    lines.append("## Страницы")
    for pg in site.pages:
        preview = pg.text.replace("\n", " ")[:200]
        lines.append(f"### {pg.title}  ({pg.url})")
        lines.append(f"{preview}…\n")

    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def run(base: str, out_dir: Path, fetch_imgs: bool) -> SiteData:
    session = make_session()
    base = base if base.endswith("/") else base + "/"

    print("→ Главная страница…")
    home_html = get(session, base)
    soup = BeautifulSoup(home_html, "html.parser")

    meta = parse_meta(soup)
    nav = parse_nav(soup, base)
    home_sections = parse_home_sections(soup, base)

    print("→ Каталог товаров…")
    products = parse_products(session, base)

    print("→ Коллекции…")
    collections = parse_collections(session, base)

    print("→ Контентные страницы…")
    page_urls = sorted({n["url"] for n in nav if n["kind"] == "page"})
    pages: list[Page] = []
    for url in page_urls:
        print(f"  · {url}")
        try:
            pages.append(parse_page(session, url, base))
        except RuntimeError as e:
            print(f"  ! пропускаю {url}: {e}", file=sys.stderr)

    site = SiteData(
        base_url=base,
        parsed_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        meta=meta,
        nav=nav,
        collections=collections,
        products=products,
        pages=pages,
        home_sections=home_sections,
    )

    if fetch_imgs:
        print("→ Скачиваю изображения…")
        n = download_images(session, products, out_dir)
        print(f"  · скачано {n} изображений")

    write_outputs(site, out_dir)
    return site


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Парсер фронтенда grabzi.ae")
    ap.add_argument("--base", default=DEFAULT_BASE, help="базовый URL магазина")
    ap.add_argument("--out", default=str(Path(__file__).parent / "output"),
                    help="каталог для результатов")
    ap.add_argument("--images", action="store_true", help="скачивать изображения товаров")
    args = ap.parse_args(argv)

    out_dir = Path(args.out)
    site = run(args.base, out_dir, args.images)

    print("\n✓ Готово.")
    print(f"  товаров: {len(site.products)} · страниц: {len(site.pages)} "
          f"· секций: {len(site.home_sections)}")
    print(f"  результаты: {out_dir}/  (products.json, pages.json, site.json, summary.md)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
