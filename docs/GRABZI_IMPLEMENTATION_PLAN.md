# GRABZI — план реализации (v2, исполняемый)

> **Цель.** Собрать сайт GRABZI на **UI-ките GRABZI**, воспроизведя уже существующие (спарсенные) экраны как есть, и **добавив недостающие экраны по логике Juicy**, но перерисованные на компоненты GRABZI. Поверх — **новый сквозной функционал: мультилокационные дневные лимиты напитков с учётом рабочих часов локации**. Сайт работает в **двух версиях — desktop и mobile** (Juicy был mobile-only).
>
> **Источники.** Парсинг `grabzi.ae` (Shopify) и `order.grabzi.ae` (React/Supabase/Stripe SPA), аудит проекта Juicy (`app/` — Next.js app-router, `backend/` — FastAPI + SQLAlchemy). Данные парсинга — в `grabzi_parser/`.
>
> Документ самодостаточен: содержит модель данных, контракты API, карту экранов и компонентов, фазы с критериями приёмки. Предполагается выполнение «как есть», без дополнительных уточнений по архитектуре.

---

## 0. Принятые решения (зафиксировано — не пересматриваем)

| # | Решение |
|---|---|
| Р1 | **UI-кит — GRABZI.** Существующие (спарсенные) экраны воспроизводим как есть. Недостающие экраны берём из Juicy **по логике/структуре**, но собираем на **компонентах GRABZI**. |
| Р2 | **Две версии вёрстки — desktop и mobile** (адаптив/респонсив, см. §3). |
| Р3 | **Без добавок.** Публичный каталог = категории напитков + напитки (в том же формате карточек, с видео-петлями). Шаг выбора добавок и KБЖУ-добавок **не выводим**. Бэкенд-сущности добавок остаются дремлющими (см. §4). |
| Р4 | **Локации — first-class.** Админка создаёт локации и задаёт дневной лимит напитков; публично — выбор локации с остатком; при заказе — атомарная проверка лимита. |
| Р5 | **Лимит списывается при ОПЛАТЕ**, считается **в напитках** (`sum quantity`). Возврат (refund) **возвращает** напитки в дневной лимит того дня (см. §5.4). |
| Р6 | **Рабочие часы локации блокируют заказ.** Вне окна работы точки заказ для неё недоступен (per-location `is_open`). |
| Р7 | **Каталог одинаков для всех локаций** (матрицу «напиток × локация» не делаем). |
| Р8 | **Публичный UI — только английский.** Переключатель RU/AR в публичной части убираем. Админка — без изменений (остаётся как в Juicy). |

**Открытые (не блокируют старт, есть дефолты):**
- Имя инфо-страницы: дефолт `/info`. Контент редактируемый из админки: дефолт — да (таблица `info_blocks`).
- Онбординг/сплеш: дефолт — **убираем** ради быстрого drive-through (оставляем лёгкий сплеш-редирект).
- Apple Pay: у GRABZI есть; включаем, если у Stripe-аккаунта настроен (фиче-флаг).

---

## 1. Что спарсили (фактура)

### 1.1. `grabzi.ae` (Shopify, публичный сайт)
| Страница | URL | Содержимое |
|---|---|---|
| Главная | `/` | Hero, бренд, 6 секций, навигация |
| Меню | `/pages/menu` | Напитки с ценами (Classic 28, Choco berry 34, Melon spark 37, …) |
| Story | `/pages/story/...` | «Our Story» |
| Working hours | `/pages/working-hours/...` | Пн–Сб 5:30–22:00, Вс 10:00–18:00 |
| Contact us | `/pages/contact-us` | `grabzi150@gmail.com`, `+971556676679` |
| Товар | `/products/{handle}` | 2 товара (Cherry Bomb 36, Classic 28 AED), карточки с медиа |

### 1.2. `order.grabzi.ae` (React SPA — «страница создания заказа»)
Экраны: `/`, `/login`, `/payment`, `/success`, `/customer-history`, `/admin`, `/manager`, `/manager-login`, `/staff`.
RPC: `get_daily_cups_sold` (→ `total_cups_sold`, `remaining_cups`, `is_sold_out`), `can_place_order`, `is_shop_open`, `is_free_treat_day`, `has_role`, `validate_manager_session`, `end_manager_session`.

**Вывод.** Дневной лимит у GRABZI **уже есть, но глобальный (одна точка)**; «📍 LOCATION» — статичный адрес, не выбор. Мультилокационность + per-location рабочие часы — наш новый функционал.

---

## 2. Стратегия сборки: что воспроизводим, что добавляем

Ключевой принцип (Р1): **два класса экранов.**

- **Класс A — «есть в GRABZI» → воспроизводим как есть** на нашем стеке: верстаем по спарсенному дизайну GRABZI (бренд, шрифты, цвета, контент), подключаем к нашему API. Не редизайним.
- **Класс B — «нет в GRABZI, есть в Juicy» → добавляем недостающее**: берём из Juicy **логику и структуру экрана**, но **перебираем на компонентах GRABZI** (UI-кит GRABZI), в desktop+mobile.

Колонка «Действие» в §3 размечена этими классами.

---

## 3. Платформа и дизайн-система

### 3.1. Desktop + mobile (Р2)
- **Подход:** единый адаптивный фронт (Next.js), брейкпоинты `mobile < 768 ≤ tablet < 1024 ≤ desktop`. Не делаем отдельных кодовых баз.
- **Навигация:**
  - mobile — нижний таб-бар (GRABZI-аналог `BottomNav`): Home / Menu / Orders / Profile;
  - desktop — верхний header-nav (новый компонент `GrabziHeader`) с теми же разделами + CTA «Create order», корзина-иконка, выбранная локация с остатком.
- **Сетки:** каталог — 2 колонки на mobile, 3–4 на desktop; деталка напитка — одна колонка на mobile, две (медиа слева / инфо справа) на desktop.
- **Тач/ховер:** на desktop добавляем ховер-состояния карточек и видео-превью по hover; на mobile — автоплей-петля в карточке как у GRABZI.

### 3.2. UI-кит GRABZI (Р1) и карта компонентов
Заводим брендовый кит `app/components/grabzi/*` (или тему `data-brand="grabzi"` + `app/styles/brand-grabzi.css`). Токены:
- Шрифты: `Grenadine MVB Black` (900) и `Grenadine MVB Extra Bold Italic` (заголовки/акценты).
- Акцент: `#c44429` (терракота, из CTA/`📍 LOCATION`).
- Тон: эмодзи-нейминг напитков (`🍒💣 🧊 🍫🍇 🍉⚡️`), drive-through-настроение, EN-only.

**Соответствие компонентов (Juicy → GRABZI-кит):**
| Назначение | Juicy-компонент | GRABZI-замена |
|---|---|---|
| Шапка экрана | `TopBar` | `GrabziTopBar` (mobile) / `GrabziHeader` (desktop) |
| Нижняя навигация | `BottomNav` | `GrabziBottomNav` (mobile) + header (desktop) |
| Карточка напитка | `ApiProductCard` | `GrabziDrinkCard` (медиа-петля, цена, эмодзи-имя) |
| Степпер кол-ва | `StepperButton` | `GrabziStepper` |
| Модалка/шторка | `BottomSheet` / `Modal` | `GrabziSheet` / `GrabziModal` |
| Тосты | `useToast` | переиспользуем, ре-стайл |
| Бейдж остатка | — (новый) | `RemainingBadge` («N left today») |
| Бейдж статуса точки | — (новый) | `LocationStatusBadge` («Closed · opens 5:30») |

**Админка** компонентов GRABZI **не получает** — остаётся на `AdminShell`/`Modal`/`admin-*` стилях Juicy (Р8).

---

## 4. Каталог без добавок (Р3)

GRABZI показывает **категории напитков и напитки** — без шага добавок.

**Публичная часть:**
- `/menu` и `/home`: категории напитков (табы) + сетка карточек напитков (медиа-петля, имя с эмодзи, цена).
- `/product/[slug]`: медиа напитка, описание, KБЖУ **самого напитка** (если есть), степпер количества, опционально «custom name», кнопка Add to cart. **Нет** поповера добавок, **нет** групп добавок.

**Бэкенд (минимум изменений):**
- Модели `Addon`, `AddonCategory`, `DrinkAddon`, `OrderItemAddon` **остаются**, но в GRABZI-флоу **не используются** (дремлющие). Заказ создаётся без addon-строк. Это исключает рискованные миграции и сохраняет переиспользование.
- `POST /drinks/{slug}/preview` (пересчёт цены/КБЖУ по добавкам) на публичной части GRABZI **не вызывается**; цена = `base_price × qty`.

**Админ-каталог:**
- Активны разделы **Categories** (категории напитков) и **Products** (напитки).
- Разделы **Addons** и **Groups** (`/admin/catalog/addons`, `/admin/catalog/groups`) и Units — **скрываем из меню** GRABZI-инстанса (фиче-флаг `catalog_addons_enabled=false`). Код остаётся, маршруты доступны прямой ссылкой, но из навигации убраны.
- В редакторе напитка скрываем блок «привязка добавок».

---

## 5. Локации: дневной лимит + рабочие часы (ядро нового функционала)

### 5.1. Модель данных
**`locations`**
| Поле | Тип | Назначение |
|---|---|---|
| `id` | PK | |
| `name` | str (EN) | название точки |
| `address` | str | адрес |
| `coordinates` | json `{lat,lng}` | гео (сортировка по расстоянию, карта) |
| `working_hours` | json | окна работы по дням (см. §5.5) |
| `timezone` | str | TZ границы «дня» (дефолт `Asia/Dubai`) |
| `daily_drink_limit` | int | сколько напитков можно продать за день |
| `color` | str | фон карточки |
| `is_active` | bool | вкл/выкл точку (скрывает из публичного списка) |
| `sort` | int | порядок |

**`location_daily_counters`** — счётчик-на-день для атомарной проверки
| Поле | Тип | Назначение |
|---|---|---|
| `id` | PK | |
| `location_id` | FK locations | |
| `date` | date | день в TZ локации |
| `committed_drinks` | int | напитков уже продано (оплачено) за день |
| уник. индекс | (`location_id`,`date`) | одна строка на точку-день |

**`orders`** — добавить `location_id` (FK locations).
- Миграция: колонка **nullable** на старте; бэкфилл существующих заказов «легаси»-локацией (сид `Legacy`), затем — приложение требует `location_id` для новых заказов (валидация на уровне API, не БД-constraint, чтобы не падать на исторических данных).

**`info_blocks`** (для §6) — `key`, `title`, `body` (richtext), `sort`, `is_active`.

### 5.2. Логика остатка
```
sold_today(loc)   = counter[loc, today(loc.tz)].committed_drinks   (0 если строки нет)
remaining(loc)    = max(0, loc.daily_drink_limit - sold_today(loc))
is_sold_out(loc)  = remaining(loc) == 0
```
Граница суток — **в TZ локации**, не в UTC.

### 5.3. Списание при оплате (анти-oversell, Р5)
До оплаты лимит **не резервируем** — на чекауте показываем `remaining` справочно. Списание — в момент `mark_paid` (Stripe webhook / mock-подтверждение):

В транзакции `mark_paid(order)`:
1. `SELECT ... FOR UPDATE` строки `counter[location_id, today]` (создать с 0, если нет) — блок строки.
2. `drinks = sum(item.quantity)` заказа.
3. Если `committed_drinks + drinks > daily_drink_limit` → **не подтверждаем продажу**: помечаем заказ `payment_status=refunded` (или ставим в статус, требующий возврата) и инициируем возврат Stripe; событие `limit_exceeded_refund`. Ответ/уведомление — `LOCATION_LIMIT_EXCEEDED`.
4. Иначе `committed_drinks += drinks`, фиксируем оплату и заказ в одной транзакции.

> Дополнительно — «мягкая» предпроверка на `create_order` и на чекауте: если уже `remaining <= 0` или точка закрыта, не пускаем в оплату (HTTP 409) — чтобы крайний случай в п.3 был редким (только гонка параллельных оплат).

### 5.4. Возвраты и лимит (Р5)
При `refund` оплаченного заказа: под тем же row-lock `committed_drinks -= drinks` для дня, **если** возврат происходит в тот же локальный день, что и продажа (иначе лимит прошлого дня не трогаем — он уже «сгорел»). Событие `refund` уже есть в Juicy; добавляем декремент счётчика.

### 5.5. Рабочие часы блокируют заказ (Р6)
- Формат `working_hours`: интервалы по дням, напр.
  ```json
  {"mon":"05:30-22:00","tue":"05:30-22:00","wed":"05:30-22:00","thu":"05:30-22:00",
   "fri":"05:30-22:00","sat":"05:30-22:00","sun":"10:00-18:00"}
  ```
  (дефолт-сид из спарсенных часов GRABZI). Поддержать несколько интервалов в дне (массив) и «выходной» (пусто).
- `is_location_open(loc, now)` — вычисляется в `loc.timezone`. `next_open_at` — ближайшее открытие.
- В `GET /api/locations` отдаём `is_open`, `next_open_at`.
- В `create_order`/`mark_paid`: точка закрыта → **HTTP 409** `LOCATION_CLOSED {next_open_at}`.
- Итоговое условие прохождения заказа: `is_open && remaining >= drinks_in_order`.

### 5.6. API — контракты
**Публичное**
```
GET /api/locations
→ 200 [{ id, name, address, coordinates, working_hours, timezone,
         daily_drink_limit, remaining_today, is_sold_out, is_open, next_open_at, color }]

GET /api/locations/{id}        → 200 (тот же объект)

POST /api/orders               (тело Juicy + location_id: required)
→ 201 order
→ 409 { code: "LOCATION_CLOSED", next_open_at }
→ 409 { code: "LOCATION_LIMIT_EXCEEDED", remaining, requested }
→ 422 { code: "LOCATION_REQUIRED" }            // location_id не передан
```
**Платёж**
```
POST /api/payments/webhook (mark_paid):
  - повторная проверка лимита/часов под row-lock;
  - при провале лимита → авто-refund + payment_status=refunded + событие.
```
**Админка (super_admin)**
```
GET    /api/admin/locations                 → список + sold_today/remaining/is_open
POST   /api/admin/locations                 (name, address, coordinates, working_hours, timezone, daily_drink_limit, color, is_active)
PATCH  /api/admin/locations/{id}            (любые поля выше)
GET    /api/admin/locations/{id}/daily?date=YYYY-MM-DD   → { committed_drinks, remaining, orders[] }
POST   /api/admin/locations/{id}/adjust-day { date, delta | set_committed }   // ручная корректировка
```

### 5.7. UI — публичная часть
- **Выбор локации** (`/outlets`, класс B — новый из Juicy на GRABZI-ките): карточки точек, на каждой `RemainingBadge` «N left today» и `LocationStatusBadge`; `is_sold_out` или `!is_open` → карточка-disabled (заказ недоступен, текст «Sold out» / «Closed · opens 5:30»). desktop — сетка карточек/карта, mobile — список.
- **CTA «Create order»** (главная, header desktop): локация не выбрана → ведёт на выбор локации → затем каталог. Выбранная локация хранится в сторе (persist).
- **Индикатор остатка** постоянно в шапке каталога/корзины (desktop header + mobile top bar).
- **Корзина/чекаут:** `qty_в_корзине > remaining` или `!is_open` → блок кнопки оплаты + подсказка.
- **Ошибки оплаты:** 409 `LOCATION_LIMIT_EXCEEDED`/`LOCATION_CLOSED` → экран/тост с объяснением и кнопкой «Change location».
- **Реалтайм остатка:** WebSocket-канал `ws/locations` (broadcast при `mark_paid`/`refund`), фолбэк — поллинг `GET /api/locations` каждые N сек на экране выбора/каталога.

### 5.8. UI — админка (раздел «Locations», класс B на Juicy-админ-ките)
- `/admin/locations` — таблица: name, address, limit/day, **sold today / remaining**, is_open, status; кнопка «New location».
- Модалка «New location»: name (EN), address, coordinates, working_hours (редактор интервалов по дням), timezone, daily_drink_limit, color.
- `/admin/locations/[id]` — карточка: редактирование; график sold/remaining по дням (исторический, `daily?date=`); кнопка ручной корректировки дня (`adjust-day`).
- Пункт «Locations» в сайдбаре `AdminShell`.

---

## 6. Объединённая инфо-страница (§ Р: open, дефолт `/info`)

Сливаем `Location + Shop Story + Working hours + Contact us` в один экран `/info` с якорным оглавлением. desktop — две колонки (оглавление-стики слева, контент справа), mobile — аккордеон/секции.

1. **Location** — адреса всех точек + статусы/часы из `GET /api/locations` (карта на desktop).
2. **Our Story** — текст бренда (`info_blocks[story]`, дефолт — из спарсенного `story`).
3. **Working hours** — из `working_hours` локаций (а не хардкод).
4. **Contact us** — `grabzi150@gmail.com`, `+971556676679`, соцсети.

Навигация GRABZI: 4 пункта → 1 пункт «Info» с переходами к якорям. Контент секций 2/4 — `info_blocks`, редактируется в админке (раздел «Content», опционально в фазе 5).

---

## 7. Полная карта экранов (GRABZI / Juicy / класс / desktop+mobile)

Легенда: A — воспроизводим как есть (GRABZI); B — добавляем из Juicy на GRABZI-ките; ✅/❌/🟡 — наличие.

### 7.1. Публичный сайт
| Экран | GRABZI | Juicy | Класс / Действие | Адаптив |
|---|---|---|---|---|
| Сплеш-редирект `/` | 🟡 | ✅ | B (минимальный) | оба |
| Онбординг `/onboarding` | ❌ | ✅ | B, **по умолчанию выкл** | оба |
| **Выбор локации `/outlets`** | ❌ | 🟡 мок | **B + новый функционал (остаток/часы)** | оба |
| Вход телефон+OTP `/auth/*` | ✅ | ✅ | A (поверх — наш auth, OTP за флагом) | оба |
| Ввод имени `/auth/name` | ❌ | ✅ | B | оба |
| Главная `/home` | ✅ (Shopify) | ✅ | A (бренд GRABZI) + CTA «Create order» | оба |
| Каталог/меню `/menu` | 🟡 | ✅ | A, живой каталог **без добавок** | 2 кол. моб / 3–4 десктоп |
| Деталка `/product/[slug]` | ✅ | ✅ | A, **без добавок/КБЖУ-добавок** | 1 кол. моб / 2 кол. десктоп |
| Корзина `/cart` | 🟡 | ✅ | B на GRABZI-ките | оба |
| Чекаут `/checkout` | 🟡 | ✅ | B + `location_id` | оба |
| Оплата `/payment` | ✅ | ✅ | A (Stripe/Apple Pay) | оба |
| Статус заказа `/orders/[id]` | 🟡 `/success` | ✅ | B (прогресс, «I'm here») | оба |
| «Я на месте» (флаг) | ❌ | ✅ | B | оба |
| Оценка 👍/👎 + купон | ❌ | ✅ | B | оба |
| История `/orders` | ✅ | ✅ | A/B | оба |
| Профиль `/profile` | ❌ | ✅ | B (без переключателя языка) | оба |
| **Инфо `/info`** | ❌ (4 стр.) | ❌ | **B + объединение** | оба |

### 7.2. Админка (Juicy-кит, без ре-дизайна)
| Раздел | GRABZI | Juicy | Действие |
|---|---|---|---|
| Логин `/admin/login` | ✅ | ✅ | как в Juicy |
| Дашборд `/admin` | 🟡 | ✅ | как в Juicy |
| Заказы `/admin/orders[/id]` | ✅ `/staff` | ✅ | как в Juicy |
| Покупатели `/admin/customers` | 🟡 | ✅ | как в Juicy |
| Каталог: Categories/Products | ❌ | ✅ | как в Juicy |
| Каталог: Addons/Groups/Units | ❌ | ✅ | **скрыть (флаг `catalog_addons_enabled=false`)** |
| **Locations** | ❌ | ❌ | **НОВОЕ (§5.8)** |
| Платежи `/admin/payments` | 🟡 | ✅ | как в Juicy |
| Купоны `/admin/coupons` | ❌ | ✅ | как в Juicy |
| Персонал `/admin/staff` | ✅ | ✅ | как в Juicy |
| Content (info_blocks) | ❌ | ❌ | НОВОЕ, опционально (фаза 5) |

---

## 8. Данные и миграции

- **Alembic-миграции:** `locations`, `location_daily_counters`, `info_blocks`, `orders.location_id (nullable)`.
- **Сиды:**
  - Локации: 1–N точек GRABZI с `working_hours` Пн–Сб 5:30–22:00 / Вс 10:00–18:00, `timezone=Asia/Dubai`, дефолтный `daily_drink_limit` (напр. 150 — отсылка к WKND150/«150 в день» из их Story).
  - Каталог: импорт напитков из `grabzi_parser/output/products.json` (+ остальные из `/pages/menu`: Choco berry 34, Melon spark 37 и т.д.) как `drinks` (EN-имена с эмодзи, base_price, медиа). Категории напитков — из меню.
  - `info_blocks`: story (из спарсенного), contacts.
- **Фиче-флаги:** `catalog_addons_enabled=false`, `public_locale=en`, `onboarding_enabled=false`, `apple_pay_enabled=<by Stripe>`, `auth_otp_enabled=<как в Juicy>`.

---

## 9. Фазы и критерии приёмки (Definition of Done)

**Фаза 0 — Подготовка (0.5–1 д).** Ветка `grabzi` (готово), импорт каталога из парсера, дизайн-референсы GRABZI, фиче-флаги.
*DoD:* сиды каталога заливаются миграцией; флаги читаются из конфига.

**Фаза 1 — UI-кит GRABZI + адаптив-каркас (3–4 д).** Шрифты/токены/тема; `GrabziHeader`(desktop)/`GrabziBottomNav`(mobile); карта компонентов §3.2; брейкпоинты.
*DoD:* главная и каталог рендерятся в бренде GRABZI на desktop и mobile; навигация переключается по брейкпоинту; Lighthouse mobile/desktop ≥ 90 perf.

**Фаза 2 — Каталог без добавок (2–3 д).** `/home`,`/menu`,`/product/[slug]` на GRABZI-карточках, видео-петли; добавки скрыты (флаг); цена = base×qty.
*DoD:* напиток открывается, добавляется в корзину без шага добавок; админ-меню без Addons/Groups; e2e «catalog→cart».

**Фаза 3 — Локации: бэкенд (3–4 д).** Модели/миграции/сиды; `GET /api/locations(+id)`; `is_location_open`/`remaining`; списание в `mark_paid` под row-lock; refund-декремент; 409-контракты.
*DoD:* юнит-тесты остатка/часов (TZ-边界); **тест гонки**: K параллельных оплат у точки с лимитом L не уводят `committed_drinks > L`; refund возвращает лимит в тот же день.

**Фаза 4 — Локации: админка (2–3 д).** `/admin/locations` (список+CRUD+sold/remaining), модалка с редактором часов, карточка с историей и `adjust-day`, пункт в сайдбаре.
*DoD:* можно создать точку, задать лимит/часы, увидеть «sold today/remaining», скорректировать день; ролевой доступ (super_admin).

**Фаза 5 — Локации: публичный UX + инфо-страница (3–4 д).** Экран выбора локации (остаток/часы/sold-out/closed), CTA «Create order», индикатор остатка в шапке, блокировки корзины/чекаута, обработка 409, WS/поллинг остатка; `/info` с 4 секциями (Content-раздел опц.).
*DoD:* нельзя оформить заказ в закрытой/распроданной точке; при гонке — внятная 409-ошибка с «Change location»; остаток обновляется в реальном времени; инфо-страница объединяет 4 раздела.

**Фаза 6 — Связка, адаптив-полировка, регрессия (2–3 д).** Сквозной флоу: локация → каталог → корзина → чекаут → оплата → статус → «I'm here» → оценка/купон. Кросс-браузер desktop+mobile.
*DoD:* зелёный e2e сквозного флоу на desktop и mobile; регресс ролей админки; чек-лист §11 пройден.

*Ориентир: ~3.5–4.5 недели одним фронт+бэк; быстрее при параллели бэк/фронт. (+неделя против v1 за desktop-версию.)*

---

## 10. Карта переиспользования из Juicy

- **Бэкенд:** `users/staff/catalog/orders/coupons`, флоу заказа, статусы, «я на месте» (`arrived_at`), оценки/купоны, дашборд, WS, Stripe. **Новое:** `locations`,`location_daily_counters`,`info_blocks`, `orders.location_id`, списание/возврат лимита, `is_location_open`, `ws/locations`.
- **Фронт публичный (логика из Juicy, кит GRABZI):** `/home /menu /product/[slug] /cart /checkout /payment /orders /orders/[id] /profile /auth/*` + новые `/outlets`,`/info`.
- **Фронт админка (как в Juicy):** `/admin/*` целиком + новый `/admin/locations` (+ опц. `/admin/content`); Addons/Groups скрыты.

---

## 11. Тест-чеклист (приёмка)
- [ ] Лимит: нельзя продать больше `daily_drink_limit` за день (вкл. гонку параллельных оплат).
- [ ] Часы: заказ в закрытой точке отклоняется (`LOCATION_CLOSED`), `next_open_at` корректен в TZ.
- [ ] Refund в тот же день возвращает напитки в лимит; в другой день — нет.
- [ ] Граница суток считается в TZ локации.
- [ ] Каталог без добавок: заказ создаётся без addon-строк; цена = base×qty.
- [ ] Desktop и mobile: навигация, каталог-сетки, деталка, выбор локации, чекаут.
- [ ] EN-only публичная часть; переключатель языка отсутствует.
- [ ] Остаток обновляется в реальном времени (WS) и в фолбэке (поллинг).
- [ ] Ролевой доступ админки (manager vs super_admin) сохранён.
- [ ] Сквозной флоу заказа зелёный на обеих версиях.

---

## 12. Открытые вопросы (с дефолтами, не блокируют)
1. `/info` vs `/about` (дефолт `/info`); контент из админки (дефолт — да, `info_blocks`).
2. Онбординг/сплеш (дефолт — выкл).
3. Перенос `is_free_treat_day` («free treat day») из GRABZI — **вне скоупа v2** (отметить, реализовать позже при необходимости).
4. Количество локаций на старте и их реальные адреса/координаты — уточнить у заказчика для сидов.
5. Apple Pay — включаем при готовности Stripe-аккаунта.

---

_Изменения v1→v2: добавлены desktop-версия и адаптив (§3.1); направление UI-кита изменено на GRABZI с портированием Juicy-экранов (§2, §3.2); убраны добавки из публичного флоу и админ-меню (§4); устранены противоречия v1 (EN-only в токенах, списание лимита перенесено в момент оплаты §5.3); добавлены возвраты-в-лимит (§5.4), контракты API (§5.6), миграции/сиды (§8), критерии приёмки по фазам (§9) и тест-чеклист (§11). Источник фактуры: `grabzi_parser/`, разбор бандла `order.grabzi.ae`, аудит `app/`+`backend/`._
