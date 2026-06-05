/**
 * Сборка PDF коммерческого предложения из docs/КП.md
 *
 *  - читает markdown
 *  - конвертирует в HTML через marked
 *  - оборачивает в print-friendly HTML с галереями скриншотов
 *  - рендерит в PDF через headless Chromium (Playwright)
 *
 * Запуск:
 *   node scripts/build-kp.mjs
 *
 * Зависимости: marked (devDep), playwright (уже в проекте).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(ROOT, "..");

const MD_PATH = path.join(REPO_ROOT, "docs", "КП.md");
const PDF_OUT = path.join(REPO_ROOT, "docs", "КП-Juicy-v2.pdf");
const SHOTS_DIR = "/tmp/kp-shots";
const TEAM_DIR  = "/tmp/team-photos/small";
/* v2 = увеличенные шрифты для чтения с телефона. Все размеры подняты ~+30%. */

/* ---------- 1. читаем markdown и конвертируем ---------- */

const md = fs.readFileSync(MD_PATH, "utf-8");
marked.setOptions({ gfm: true, breaks: false });
const htmlBody = marked.parse(md);

/* ---------- 2. подготавливаем картинки как data URLs ---------- */

function dataUrl(filename) {
  const p = path.join(SHOTS_DIR, filename);
  const buf = fs.readFileSync(p);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function teamPhoto(slug) {
  const p = path.join(TEAM_DIR, `${slug}.jpg`);
  if (!fs.existsSync(p)) return "";
  const buf = fs.readFileSync(p);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const TEAM_PHOTOS = {
  malik:  teamPhoto("malik"),
  zabit:  teamPhoto("zabit"),
  zidan:  teamPhoto("zidan"),
  rashid: teamPhoto("rashid"),
};

const SHOTS = {
  // client mobile
  home: dataUrl("client-home.png"),
  product: dataUrl("client-product.png"),
  addons: dataUrl("client-addons.png"),
  cart: dataUrl("client-cart.png"),
  checkout: dataUrl("client-checkout.png"),
  order: dataUrl("client-order.png"),
  menu: dataUrl("client-menu.png"),
  auth: dataUrl("client-auth.png"),
  // admin
  adminDashboard: dataUrl("admin-dashboard.png"),
  adminProducts: dataUrl("admin-products.png"),
  adminProductMain: dataUrl("admin-product-main.png"),
  adminBindings: dataUrl("admin-bindings.png"),
  adminAddons: dataUrl("admin-addons.png"),
  adminGroups: dataUrl("admin-groups.png"),
  adminOutlets: dataUrl("admin-outlets.png"),
  adminOutletDetail: dataUrl("admin-outlet-detail.png"),
  adminOrders: dataUrl("admin-orders.png"),
  adminOrderDetail: dataUrl("admin-order-detail.png"),
  adminStaff: dataUrl("admin-staff.png"),
};

/* ---------- 3. галереи скриншотов как HTML-блоки ---------- */

function shotFigure(src, caption, kind = "mobile") {
  return `<figure class="shot shot-${kind}">
    <img src="${src}" alt="${caption}" />
    <figcaption>${caption}</figcaption>
  </figure>`;
}

const CLIENT_GALLERY = `
<section class="gallery">
  <h2 class="gallery-title">Клиентское приложение — что видит пользователь</h2>
  <p class="gallery-sub">Mobile-web на Next.js 16, full-bleed видео-hero, full-screen кастомайзер, curbside pickup по номеру машины. Готовый прототип — открывается по ссылке прямо сейчас.</p>
  <div class="grid grid-3">
    ${shotFigure(SHOTS.auth, "Авторизация через SMS-OTP, номер UAE +971")}
    ${shotFigure(SHOTS.home, "Главная с full-bleed видео-hero")}
    ${shotFigure(SHOTS.menu, "Меню по категориям, табы")}
    ${shotFigure(SHOTS.product, "Карточка блюда: видео-фон, live КБЖУ, размер S/M/L")}
    ${shotFigure(SHOTS.addons, "Кастомайзер с inline addon-popover")}
    ${shotFigure(SHOTS.cart, "Корзина, VAT 5%, промокод")}
    ${shotFigure(SHOTS.checkout, "Checkout: эмират, plate, время выдачи")}
    ${shotFigure(SHOTS.order, "Статус заказа со stage-trackerом")}
  </div>
</section>`;

const ADMIN_GALLERY = `
<section class="gallery gallery-admin">
  <h2 class="gallery-title">Админка — что видят разные роли</h2>
  <p class="gallery-sub">Один общий интерфейс с переключателем ролей. Сайдбар скрывает разделы, к которым нет доступа. Все основные действия — настоящие, не картинки.</p>

  <div class="role-block">
    <span class="role-pill">Super admin · Catalog admin</span>
    <p>Полный обзор сети, дашборд, каталог блюд и допов, правила комбинирования, сотрудники.</p>
    <div class="grid grid-2">
      ${shotFigure(SHOTS.adminDashboard, "Дашборд: метрики дня, активные заказы, точки", "wide")}
      ${shotFigure(SHOTS.adminProducts, "Каталог блюд: КБЖУ, варианты, медиа, статус", "wide")}
      ${shotFigure(SHOTS.adminProductMain, "Редактор блюда: тексты, КБЖУ базы", "wide")}
      ${shotFigure(SHOTS.adminBindings, "Привязка групп допов: required / min / max + override цены и дозы в связке с блюдом", "wide")}
      ${shotFigure(SHOTS.adminAddons, "Допы: PNG, unit, доза, КБЖУ/100, ккал/unit, цена, аллергены", "wide")}
      ${shotFigure(SHOTS.adminGroups, "Группы допов: single / multi / counter + редактор правил", "wide")}
    </div>
  </div>

  <div class="role-block">
    <span class="role-pill">Outlet manager · Барист</span>
    <p>Менеджер точки видит только свои точки. Меню per outlet, стоп-листы реального времени, заказы своей точки со сменой статуса и оповещением клиента.</p>
    <div class="grid grid-2">
      ${shotFigure(SHOTS.adminOutlets, "Точки сети + матрица «блюдо × точка»", "wide")}
      ${shotFigure(SHOTS.adminOutletDetail, "Карточка точки: адрес, расписание, сотрудники", "wide")}
      ${shotFigure(SHOTS.adminOrders, "Заказы с фильтрами по статусу / точке / телефону", "wide")}
      ${shotFigure(SHOTS.adminOrderDetail, "Заказ #1247: смена статуса + кнопки оповещения клиента + хронология", "wide")}
    </div>
  </div>

  <div class="role-block">
    <span class="role-pill">Super admin · Support</span>
    <p>Управление сотрудниками, ролями, доступом к точкам, журнал админ-действий.</p>
    <div class="grid grid-1">
      ${shotFigure(SHOTS.adminStaff, "Сотрудники: назначение ролей и outlet-scope", "wide")}
    </div>
  </div>
</section>`;

/* ---------- 4. injection: вставляем галереи в нужные места ---------- */

let html = htmlBody;

/* ---- Замена ASCII-диаграммы архитектуры на красивый HTML-блок ---- */
const ARCH_HTML = `
<div class="arch">
  <div class="arch-row">
    <div class="arch-node client">Customer<br/><small>mobile-web · Next.js 16</small></div>
    <div class="arch-node client">Admin / Manager<br/><small>web · Next.js</small></div>
    <div class="arch-node kds">KDS · iPad<br/><small>WebSocket</small></div>
  </div>
  <div class="arch-arrow">▼ HTTPS · SSE · WS ▼</div>
  <div class="arch-row">
    <div class="arch-node gateway"><strong>FastAPI gateway</strong><br/><small>Python 3.12 · async</small></div>
  </div>
  <div class="arch-arrow">▼</div>
  <div class="arch-row">
    <div class="arch-node store">PostgreSQL 15<br/><small>ACID · JSONB</small></div>
    <div class="arch-node store">Redis<br/><small>pub/sub · cache</small></div>
    <div class="arch-node store">S3<br/><small>media · CDN</small></div>
  </div>
  <div class="arch-arrow">▼ Integrations ▼</div>
  <div class="arch-row">
    <div class="arch-node ext">Tap Payments<br/><small>Card · ApplePay · GPay</small></div>
    <div class="arch-node ext">Twilio / Unifonic<br/><small>SMS-OTP</small></div>
    <div class="arch-node ext">Sentry + OTel<br/><small>monitoring</small></div>
  </div>
</div>`;

// в markdown архитектура в ```\n...\n``` блоке — заменяем первый <pre> на arch HTML
html = html.replace(/<pre><code[^>]*>[\s\S]*?Customer[\s\S]*?Sentry[\s\S]*?<\/code><\/pre>/, ARCH_HTML);

/* ---- Inject galleries ---- */
function injectAfter(haystack, h2TextSubstring, injection) {
  const idx = haystack.indexOf(h2TextSubstring);
  if (idx === -1) return haystack;
  const sectionStart = haystack.lastIndexOf("<h2", idx);
  const nextH2 = haystack.indexOf("<h2", sectionStart + 1);
  if (nextH2 === -1) return haystack + injection;
  return haystack.slice(0, nextH2) + injection + haystack.slice(nextH2);
}

html = injectAfter(html, "Что уже готово", CLIENT_GALLERY);
html = injectAfter(html, "Предлагаемое решение", ADMIN_GALLERY);

/* ---- Подставить фото команды ---- */
for (const [slug, url] of Object.entries(TEAM_PHOTOS)) {
  html = html.replaceAll(`{{PHOTO:${slug}}}`, url);
}
// Marked иногда оборачивает inline-блоки <div class="member"> в <p> — снимаем
html = html.replace(/<p>(\s*<div class="(team-grid|member)")/g, "$1");
html = html.replace(/(<\/div>)\s*<\/p>/g, "$1");

/* ---------- 5. оборачиваем в страничный HTML с CSS ---------- */

const FINAL_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>КП Juicy</title>
<style>
@page { size: A4; margin: 14mm 12mm; }
:root {
  --ink: #0E0E10;
  --ink-soft: #5A5F6B;
  --accent: #4A56E2;
  --accent-soft: #EFE6F0;
  --bg: #FFFFFF;
  --beige: #F5EFE7;
  --beige-deep: #FAF6F0;
  --rule: #E5E1D6;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  color: var(--ink);
  background: var(--bg);
  font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13.5pt;
  line-height: 1.55;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* --- typography --- */
h1, h2, h3, h4 {
  color: var(--ink);
  letter-spacing: -0.01em;
  line-height: 1.2;
}
h1 {
  font-size: 32pt;
  font-weight: 800;
  margin: 0 0 6pt;
  letter-spacing: -0.03em;
}
h2 {
  font-size: 19pt;
  font-weight: 800;
  margin: 24pt 0 8pt;
  padding-top: 6pt;
  border-top: 1px solid var(--rule);
  page-break-after: avoid;
}
h2:first-of-type { border-top: 0; padding-top: 0; }
h3 {
  font-size: 15pt;
  font-weight: 700;
  margin: 14pt 0 6pt;
  page-break-after: avoid;
}
h4 {
  font-size: 13.5pt;
  font-weight: 700;
  margin: 10pt 0 4pt;
}
p { margin: 0 0 8pt; }
ul, ol { margin: 0 0 10pt 18pt; padding: 0; }
ul li, ol li { margin-bottom: 3pt; }
hr { border: 0; border-top: 1px solid var(--rule); margin: 16pt 0; }
strong { font-weight: 700; }
em { font-style: italic; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 12pt; background: var(--beige); padding: 1px 5px; border-radius: 3px; }
a { color: var(--accent); text-decoration: none; }
blockquote {
  margin: 10pt 0;
  padding: 10pt 14pt;
  background: var(--beige);
  border-left: 3px solid var(--accent);
  font-size: 12.5pt;
  color: var(--ink-soft);
}
blockquote em { font-style: normal; }

/* --- tables --- */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 10pt 0;
  font-size: 12pt;
  page-break-inside: avoid;
}
th, td {
  text-align: left;
  padding: 7pt 9pt;
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
}
th {
  background: var(--beige-deep);
  font-weight: 700;
  font-size: 11.5pt;
  letter-spacing: 0.02em;
  color: var(--ink-soft);
  text-transform: uppercase;
}
tr:last-child td { border-bottom: 0; }

/* --- cover page --- */
.cover {
  page-break-after: always;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0;
}
.cover-top {
  display: flex; align-items: center; gap: 12pt;
}
.cover-mark {
  width: 44pt; height: 44pt;
  background: var(--accent);
  color: #fff;
  display: grid; place-items: center;
  font-size: 26pt; font-weight: 800;
  border-radius: 12pt;
}
.cover-brand strong { font-size: 19pt; }
.cover-brand-sub { font-size: 11.5pt; color: var(--ink-soft); letter-spacing: 0.1em; text-transform: uppercase; }

.cover-main h1 {
  font-size: 44pt;
  line-height: 1.05;
  margin: 0 0 18pt;
  letter-spacing: -0.04em;
}
.cover-main .lead {
  font-size: 17pt;
  color: var(--ink-soft);
  max-width: 480pt;
  line-height: 1.45;
}

.cover-foot {
  border-top: 1px solid var(--rule);
  padding-top: 14pt;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16pt;
  font-size: 12.5pt;
}
.cover-foot .label {
  font-size: 11pt;
  color: var(--ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 3pt;
}

/* --- meta band right under cover h1 (in body) --- */
.kp-meta {
  background: var(--beige-deep);
  border-radius: 12pt;
  padding: 12pt 16pt;
  margin: 12pt 0 18pt;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14pt;
  font-size: 12pt;
}
.kp-meta .label {
  text-transform: uppercase;
  font-size: 11pt;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  margin-bottom: 2pt;
}

/* --- highlight cards --- */
.cards-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10pt;
  margin: 10pt 0;
  page-break-inside: avoid;
}
.card-h {
  background: var(--beige-deep);
  border-radius: 10pt;
  padding: 12pt;
}
.card-h.accent { background: var(--accent-soft); }

/* --- галереи скриншотов --- */
.gallery {
  margin: 18pt 0;
}
.gallery-admin { margin-top: 24pt; }
.gallery-title {
  font-size: 22pt;
  font-weight: 800;
  margin: 0 0 6pt;
  border-top: 0;
  padding-top: 0;
  letter-spacing: -0.02em;
}
.gallery-sub {
  color: var(--ink-soft);
  font-size: 13pt;
  margin-bottom: 14pt;
  max-width: 480pt;
}
.role-block {
  margin: 16pt 0 18pt;
  page-break-inside: avoid;
}
.role-pill {
  display: inline-block;
  background: var(--accent);
  color: #fff;
  font-size: 11.5pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 3pt 10pt;
  border-radius: 999px;
  margin-bottom: 4pt;
}
.role-block p {
  color: var(--ink-soft);
  font-size: 12.5pt;
  margin: 4pt 0 10pt;
}
.grid {
  display: grid;
  gap: 10pt;
}
.grid-1 { grid-template-columns: 1fr; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.grid-3 { grid-template-columns: 1fr 1fr 1fr; }

/* --- Team grid --- */
.team-grid {
  display: flex;
  flex-direction: column;
  gap: 14pt;
  margin: 16pt 0;
}
.member {
  display: grid;
  grid-template-columns: 95pt 1fr;
  gap: 16pt;
  align-items: flex-start;
  page-break-inside: avoid;
}
.team-photo {
  width: 95pt;
  height: 95pt;
  border-radius: 14pt;
  object-fit: cover;
  background: var(--beige);
  display: block;
}
.member strong {
  font-size: 16pt;
  font-weight: 800;
  letter-spacing: -0.015em;
}
.team-role {
  font-size: 12.5pt;
  color: var(--accent);
  font-weight: 700;
  margin-top: 2pt;
}
.team-bio {
  font-size: 13pt;
  margin-top: 6pt;
  line-height: 1.5;
  color: var(--ink);
}

.shot {
  margin: 0;
  page-break-inside: avoid;
}
.shot img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 8pt;
  background: var(--beige);
}
.shot-mobile img {
  border: 1px solid var(--rule);
}
.shot-wide img {
  border: 1px solid var(--rule);
}
.shot figcaption {
  font-size: 11pt;
  color: var(--ink-soft);
  margin-top: 4pt;
  line-height: 1.35;
}

/* --- prevent awkward page breaks --- */
.role-block, .cards-3, .arch, blockquote { page-break-inside: avoid; }
/* small tables stay together, big ones can break per-row */
table { page-break-inside: auto; }
tr   { page-break-inside: avoid; page-break-after: auto; }
h2 + p, h3 + p, h2 + table, h3 + table, h2 + .arch { page-break-before: avoid; }

/* --- architecture diagram --- */
.arch {
  margin: 12pt 0;
  padding: 14pt;
  background: var(--beige-deep);
  border-radius: 12pt;
  font-family: "Manrope", sans-serif;
}
.arch-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150pt, 1fr));
  gap: 8pt;
  margin-bottom: 6pt;
}
.arch-node {
  background: #fff;
  border: 1px solid var(--rule);
  border-radius: 8pt;
  padding: 8pt 10pt;
  font-size: 12pt;
  font-weight: 600;
  text-align: center;
}
.arch-node small {
  display: block;
  font-weight: 500;
  color: var(--ink-soft);
  font-size: 10.5pt;
  margin-top: 2pt;
}
.arch-node.client  { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.arch-node.gateway { background: var(--accent); color: #fff; border-color: var(--accent); }
.arch-node.gateway small { color: #D7DBFF; }
.arch-node.kds     { background: #F0EDE0; border-color: var(--rule); }
.arch-node.store   { background: #fff; }
.arch-node.ext     { background: #F0EDE0; }
.arch-arrow {
  text-align: center;
  font-size: 10.5pt;
  color: var(--ink-soft);
  letter-spacing: 0.1em;
  margin: 4pt 0;
  font-weight: 600;
}

/* --- footer note --- */
.kp-footer {
  margin-top: 20pt;
  padding-top: 10pt;
  border-top: 1px solid var(--rule);
  font-size: 10.5pt;
  color: var(--ink-soft);
  text-align: center;
}
</style>
</head>
<body>

<!-- Cover page -->
<section class="cover">
  <div class="cover-top">
    <div class="cover-mark">J</div>
    <div class="cover-brand">
      <strong>Juicy</strong>
      <div class="cover-brand-sub">Drinkit-class juice bar · UAE</div>
    </div>
  </div>
  <div class="cover-main">
    <div style="font-size: 12.5pt; color: var(--ink-soft); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10.5pt;">Коммерческое предложение №&nbsp;КП-JUICY-2026-001</div>
    <h1>Mobile-web<br/>+ Admin<br/>+ Backend<br/>под ваш бренд</h1>
    <div class="lead">
      Запуск собственного канала предзаказа с curbside-pickup по модели Drinkit. Готовый прототип уже работает на демо-стенде — этот документ показывает, что входит в продукт и сколько он стоит.
    </div>
  </div>
  <div class="cover-foot">
    <div>
      <div class="label">Подготовил</div>
      <div><strong>Малик Протопопов</strong><br/>CPO Mediann · solution architect</div>
    </div>
    <div>
      <div class="label">Контакт</div>
      <div><a href="https://mediann.dev">mediann.dev</a><br/>Telegram <a href="https://t.me/mal1k_pro">@mal1k_pro</a></div>
    </div>
    <div>
      <div class="label">Дата подготовки</div>
      <div>14 мая 2026</div>
    </div>
    <div>
      <div class="label">Срок действия</div>
      <div>до 04 июня 2026</div>
    </div>
  </div>
</section>

<!-- Содержание (из markdown) -->
${html}

<div class="kp-footer">
  Mediann · Juicy · КП-JUICY-2026-001 · Не является публичной офертой по ст. 437 ГК РФ
</div>

</body>
</html>`;

const HTML_OUT = path.join("/tmp", "kp.html");
fs.writeFileSync(HTML_OUT, FINAL_HTML, "utf-8");
console.log(`✓ HTML written: ${HTML_OUT} (${(FINAL_HTML.length / 1024).toFixed(0)} KB)`);

/* ---------- 6. render PDF ---------- */

console.log("→ Launching Chromium for PDF render...");
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`file://${HTML_OUT}`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

await page.pdf({
  path: PDF_OUT,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `
    <div style="width:100%; font-family: Manrope, sans-serif; font-size: 9pt; color: #888; padding: 0 12mm; display:flex; justify-content: space-between;">
      <span>Juicy · КП-JUICY-2026-001 · 14.05.2026</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
});

await browser.close();
const size = fs.statSync(PDF_OUT).size;
console.log(`✓ PDF written: ${PDF_OUT} (${(size / 1024).toFixed(0)} KB)`);
