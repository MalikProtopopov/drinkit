# GRABZI — фронтенд: архитектура, UI-кит, состояния, экран готовки заказа

> Спутник [GRABZI_IMPLEMENTATION_PLAN.md](GRABZI_IMPLEMENTATION_PLAN.md). Здесь — исполняемая фронт-спека: чистая архитектура Next.js (2026), дизайн-токены (реальная палитра grabzi.ae), инвентарь UI-компонентов (что взять как есть / адаптировать / дорисовать), полная матрица состояний публичных страниц (EN-copy) и детальный удобный экран готовки заказа для менеджера. Заземлено в живом сайте и коде Juicy; учтены замечания адверсариальной ревизии.
>
> **Стек (Р0.1):** PostgreSQL, Poetry, FastAPI, **Next.js (App Router, React 19, Tailwind v4)**, Docker. Бэкенд-архитектура и тесты — в [GRABZI_BACKEND_AND_TESTING.md](GRABZI_BACKEND_AND_TESTING.md).

---

## 0. Проверенные факты сайта (заземление дизайна)
- **Карточки — статичные PNG-стикеры, НЕ видео** (Cherry Bomb 933×577, Classic 1182×1182; видео на grabzi.ae нет). Прежнее допущение «видео-петли» отменено (Р3.0).
- **Палитра — мульти-схема** (реальные значения): терракота `#C44429`, тёмно-красные `#A42325`/`#780406`, крем `#E8D5C7`/`#FFF8D4`, бирюза `#29C4B4`/`#98C3C9`, олива `#B5BD62`, серый `#F1F1F1`; **stock-токены темы** `instock #3ED660` / `lowstock #EE9441` / `outofstock #C8C8C8` (готовы под бейджи остатка/sold-out).
- **Шрифты:** `Grenadine MVB Black` + `Extra Bold Italic` — **лицензия (fonnts.com) под вопросом** → self-host под флагом + безопасный fallback-стек; до развязки бренд держится на fallback.
- Публичный сайт — **только английский**, `dir=ltr`; AR/RTL — задел (логические CSS, `[locale]`-сегмент, словарь-заглушка).

---

## 1. Архитектура (Next.js, server-first, 2026)

### 1.1. Принципы
| Принцип | Решение |
|---|---|
| Server-first | Всё, что можно — RSC. Client только на листьях (счётчики, выбор локации, live-статус). Цель <20% client. |
| Данные на сервере | Каталог/локации/меню/story/часы — `fetch` в RSC с `revalidate`+`tags`. Браузер не ходит в API за публичным контентом. |
| Состояние минимально | RSC — источник истины серверных данных. Zustand — только эфемерное: выбор локации + черновик заказа (счётчики). |
| Типобезопасность по границе | Любой ответ API парсится **zod**-схемой (`z.infer` = типы). Кривой бэк падает на границе, не в UI. Закрывает any-долг Juicy. |
| Никаких «мёртвых» экранов | `error.tsx`/`loading.tsx`/`not-found.tsx` на каждом сегменте; запрет молчаливых `.catch(()=>{})`. |
| EN-only сейчас, AR-ready | `next-intl` + `[locale]`, логические CSS, `dir` через сегмент. |

### 1.2. Файловая структура (`grabzi-web/`)
```
src/
  middleware.ts                      # next-intl locale routing (default en)
  i18n/ routing.ts request.ts navigation.ts
  app/
    layout.tsx  globals.css  not-found.tsx
    [locale]/
      layout.tsx                     # <html lang dir> + NextIntlClientProvider + шрифты + Toaster
      error.tsx loading.tsx not-found.tsx
      (public)/                      # маркетинг (бывшая Shopify-тема): /, menu, story, working-hours, contact-us
      (order)/                       # SPA заказа (бывший order.grabzi.ae)
        layout.tsx                   # OrderShell (client): локация-бар, счётчик заказа
        locations/  new/  checkout/  orders/[id]/(OrderLive.tsx)  auth/
  components/
    ui/        # презентация без домена/fetch: button, counter(use client), badge, sticker-image, sheet, skeleton, toaster
    features/  # домен: drink-card, menu-list, order-builder(client), location-picker(client), cart-summary(client), order-status(client)
  lib/
    api/ client.ts server.ts endpoints.ts catalog.ts locations.ts orders.ts errors.ts
    schemas/   # zod = single source of types: drink, location, order
    store/ order-draft.ts(persist) toast.ts
    media/minio.ts  format/  utils/
  types/env.d.ts
```
> `(order)` — это перенесённый `order.grabzi.ae` в одно приложение, изолирован route-group (свой layout/кэш). Одностраничное создание заказа — `new/page.tsx` (не нарушает план).

### 1.3. RSC vs Client (карта)
| Узел | Тип | Почему |
|---|---|---|
| `/`, story, working-hours, contact-us | RSC, статика/ISR `revalidate:3600` | ноль JS на маркетинге |
| `/menu`, drink-card, menu-list | RSC `revalidate:60, tags:['catalog']` | цены/наличие на сервере; PNG через `next/image` |
| `/(order)/locations` список | RSC | серверный fetch; выбор — client-island сверху |
| LocationPicker, OrderBuilder, Counter, CartSummary | Client | локальный интерактив → `order-draft` стор |
| `/(order)/new` каркас | RSC + вложенные client-счётчики | категории+напитки+стоп-лист на сервере |
| `/orders/[id]` | RSC-снимок + `OrderLive` (client WS) | быстрый первый рендер, затем live |

`'use client'` — максимально глубоко (на листе), не на странице.

### 1.4. Данные и кэш
| Данные | Стратегия |
|---|---|
| Маркетинг | `next:{revalidate:3600}` (ISR) |
| Меню/каталог/цены/наличие | `next:{revalidate:60, tags:['catalog']}` → `revalidateTag('catalog')` при правке в админке |
| Локации/часы/пауза/лимит/стоп-лист | `revalidate:30, tags:['locations']` |
| Мои заказы / деталь | `cache:'no-store'` (приватно, серверный fetch с cookie-токеном) |
| Статус заказа (live) | client WS `/ws/orders/{id}` + polling-fallback (**единый интервал 20с**, см. §1.6) |

**Фиксы ревизии (важно):**
- **`next-intl` + статика:** в сегменте `[locale]` обязателен `generateStaticParams()` из `routing.locales` и `setRequestLocale(locale)` в `layout.tsx` и каждой маркетинг-`page.tsx` **до** обращения к переводам — иначе страницы становятся динамическими и ISR (`revalidate:3600`) не сработает.
- **Не передавать `signal: AbortSignal.timeout(...)` в кэшируемые RSC-fetch** (Next отключает Data Cache при наличии signal) — таймаут только для `no-store` приватных запросов; на ISR полагаемся на инфраструктурный таймаут.

### 1.5. Состояние
| Состояние | Где | Почему |
|---|---|---|
| Каталог/локации/заказы | RSC / fetch-кэш | серверные данные не дублируем в client-стор |
| Выбранная локация + черновик заказа (счётчики) | Zustand `order-draft` (persist, `version`+migrate) | эфемерный выбор, переживает reload; **миграция версии обязательна** (урок легаси-корзины Juicy v2) |
| Очередь тостов | Zustand `toast` (no persist) | UI-эфемерида |
| Сессия/токен | **httpOnly cookie** (не в Zustand) | безопасность; приватные данные читает серверный fetcher |

> При смене локации черновик ревалидируется против `location.stopList` — недоступные напитки убираются **с тостом**, а не «молча на checkout».

### 1.6. Realtime (статус заказа)
- RSC отдаёт первичный снимок (`getOrder` no-store) → `OrderLive` (client) подключает `WebSocket`, при обрыве — reconnect backoff `1→2→5→10с` + polling-fallback **20с**.
- **WS-URL:** деривировать схему из http-base — `NEXT_PUBLIC_API_URL.replace(/^http/, 'ws')` (даёт `ws://`/`wss://`); нельзя открывать `new WebSocket('http://...')`.
- **Heartbeat:** бэкенд шлёт `{type:'ping'}` каждые 25с — клиент `if (m.type==='ping') return;` (ping ≠ статус, не дёргать UI).
- «Я на месте» (`arrived_at`) — независимый флаг, доступен **сразу после оплаты**, POST + оптимистично в UI.
- ⚠️ **WS-аутентификация (см. §6 и backend-спеку):** для приватного канала заказа и админ-канала WS должен быть защищён токеном (browser не шлёт `Authorization` на WS → передаём токен query-параметром/subprotocol).

---

## 2. Дизайн-токены (реальная палитра)
Слой `--gz-*` (raw из grabzi.ae) → семантический → Tailwind `@theme inline`. В компонентах — только семантика.

| Semantic | Значение | Назначение |
|---|---|---|
| `--color-bg` | `#FFF8D4` (hero) / `#FFFFFF` (контент) | фон; две обёртки `.page--hero`/`.page--plain` (крем не «плавит» текст) |
| `--color-surface` / `--color-surface-cream` | `#FFFFFF` / `#E8D5C7` | панели / фон карточек напитков |
| `--color-primary` / `-hover` / `-press` | `#C44429` / `#A8381F` / `#780406` | терракота CTA, активные табы, pressed PayButton |
| `--color-accent` / `-soft` | `#29C4B4` / `#98C3C9` | бирюза: вторичные акценты, info, focus-outline |
| `--color-lime` | `#B5BD62` | декоративные акценты, маркеры категорий |
| `--color-heading` | `#A42325` | display/h1 |
| `--color-text` / `-muted` / `-border` | `#1A1410` / `#6B5D52` / `#E4D9CB` | тёплый near-black/серо-коричневый |
| `--color-danger`/`-success` | `#DC2626` / `#16A34A` | ошибки/refund / paid |
| **`--color-instock`/`-lowstock`/`-outofstock`** | `#3ED660`/`#EE9441`/`#C8C8C8` | **бейджи остатка/sold-out, статусы локаций** |
| `--color-paused`/`-closed` | `#EE9441` / `#6B5D52` | пауза / вне часов |

**Пороги stock (UI-правило):** `0→outofstock`, `≤threshold(5)→lowstock`, `>→instock`, `null→скрыт` (локация без лимита).

**Типографика:** `--font-display: 'Grenadine MVB', 'Bricolage Grotesque', system-ui` (fallback по умолчанию пока нет лицензии), `--font-sans: 'Manrope', system-ui`, `--font-mono`. Шкала: `.text-display 30/900`, `.text-h1 26/800`, `.text-h2 20/700`, `.text-body 15/400`, `.text-price 18/900(display)`, `.text-caption 13`.

**Радиусы/тени:** `--radius-sm 10 / md 16 / lg 24 / xl 28 / pill ∞`; `--shadow-md 0 4px 12px rgba(26,20,16,.08)`, `--shadow-primary 0 6px 16px rgba(196,68,41,.32)`, `--shadow-pulse` (пульс «новый заказ»/«на месте»). Высоты: CTA/Pay 56, степпер 36, hit-target min 44.

> **Фикс ревизии (шрифты):** fallback-стек должен заканчиваться **реально системным** (`system-ui`), а не ещё одним лицензируемым; перепроверить контраст терракоты `#C44429` на белом тексте (WCAG AA для крупного ~ОК, для мелкого — пограничен → для мелкого использовать `--color-heading`/тёмный текст).

---

## 3. Инвентарь UI-компонентов (что взять / адаптировать / дорисовать)
| Компонент | База в Juicy | Происхождение | Ключевое |
|---|---|---|---|
| `GrabziHeader` (desktop) | `TopBar.tsx` | адаптировать | горизонт. раскладка, локация+статус, итог заказа; **+focus-стили** |
| `GrabziBottomNav` (mobile) | `BottomNav.tsx` | адаптировать | табы `Menu·Orders·Profile` (без home — каталог=главная), бейдж=активные заказы |
| `GrabziDrinkCard` | `ApiProductCard.tsx` | адаптировать | **вырезать `<video>`+SVG `DrinkArt`** → статичный PNG; встроенный `+/–`; `soldOut`-оверлей; `onError`→эмодзи-плейсхолдер |
| `QtyStepper` | инлайн в `cart` + `fab-plus` | адаптировать | вынести в самостоятельный компонент |
| `LocationCard` | `outlets/page.tsx` | адаптировать | бейджи open/paused/closed/sold-out + remaining/часы |
| `RemainingBadge` | — | **с нуля** | stock-токены, пороги §2 |
| `OrderSummaryBar` (sticky) | инлайн в `cart`/`checkout` | адаптировать | заменяет корзину; total + PayButton |
| `PayButton` | `.btn-primary` + payment-кнопка | адаптировать | states: idle/loading «Creating order…»/disabled |
| `CategoryTabs` | `.tab-text` | как есть (рескин) | |
| `Toast` | инлайн в `product` | адаптировать | единая очередь (Zustand) |
| `Modal`/`Sheet` | `BottomSheet.tsx` | адаптировать | desktop-режим, focus-trap (a11y-пробел Juicy) |
| `FormField` | инлайн-инпуты | **с нуля** | единая абстракция label+hint+error |
| `MediaUploadField` (админка) | — (adminApi mock) | **с нуля** | drag-and-drop → MinIO, в БД относительный ключ (§5.13 плана) |
| `ScreenState` | — (тихие catch) | **с нуля** | единый `kind: loading/empty/error.network/error.server/offline` + `onRetry` |

**Состояния каждого интерактивного компонента (обязательно):** `default / hover / active / focus(outline бирюза) / disabled / loading(skeleton) / error / empty`. Цвет всегда дублируется текстом/иконкой (дальтонизм). Все overlay — focus-trap + `role=dialog` + `Esc`.

---

## 4. Канонический реестр доменных кодов ошибок (единый источник)
> **Фикс ревизии (блокер согласованности):** дизайны изобрели разные имена (`DAILY_LIMIT_REACHED`, `DRINK_SOLD_OUT`, `DRINK_STOPPED`…). Фиксируем **один** реестр — бэкенд-enum ↔ фронт zod/copy-map не должны расходиться (FE матчит по `code`).

| Код (canonical) | HTTP | Когда | EN-copy клиенту |
|---|---|---|---|
| `LOCATION_REQUIRED` | 422 | не передан `location_id` | Pick a spot first. |
| `LOCATION_CLOSED` | 409 | вне часов (есть `next_open_at`) | This spot is closed now (opens {time}). |
| `LOCATION_PAUSED` | 409 | операционная пауза | This spot paused new orders. |
| `LOCATION_LIMIT_REACHED` | 409 | дневной лимит точки исчерпан | Sold out for today at this spot. |
| `DRINK_UNAVAILABLE_AT_LOCATION` | 409 | стоп-лист напитка по локации | Sold out for today. |
| `STOCK_LESS_THAN_ORDER` | 409 | `qty > remaining` | Only N left — модалка «Keep N / Remove» |
| `DRINK_NOT_AVAILABLE` | 409 | глобальный `status != published` | This drink isn't available. |
| `CAR_PLATE_REQUIRED` | 422 | нет авто-номера | Add your car plate so we find you. |
| `ORDER_NOT_PAID` | 409 | «I'm here» до оплаты | Pay first, then tap "I'm here". |
| `ALREADY_PAID` / `NOT_FOUND` | 409/404 | повтор оплаты / чужой заказ | This order is already paid. / Order not found. |

Реализация: общий enum на бэке (`core/errors.py`) + единый exception-handler (HTTP `detail=code`) ↔ FE `lib/api/errors.ts` маппит `code → i18n-ключ copy`. Никаких «общих ошибок» при известном коде.

---

## 5. Состояния публичных страниц (EN, анти-dead-end)
**Общий словарь сетевых состояний** (компонент `<ScreenState>`): `loading`(skeleton, не текст) · `error.network` «Can't reach GRABZI. Check your connection.» +Try again · `error.server` «Something went wrong on our side.» · `offline` «You're offline. We'll reload when you're back.» (авто-retry по `online`) · `empty` (свой CTA).

**Жизненный цикл (не нарушать, решения плана):** `status: new→in_progress→ready→completed(→refund)`; `payment: pending →(webhook/mock)→ paid` — **факт оплаты = webhook, не redirect**; `arrived_at` — независимый флаг после оплаты; **заказ создаётся при Pay в `pending` (скрыт), виден менеджеру и списывает лимит только при `paid`**.

Сводка по страницам (полная матрица — в этом разделе ниже):
- **Home `/`:** loading/success/empty(«Menu's being refreshed.»)/error/offline + `location not selected`(CTA «Pick a spot to start»), `closed`/`paused` бейджи, guest.
- **Locations `/locations`:** статус-бейджи `Open now`/`Closed · opens {time}`/`Temporarily paused`/`Sold out today`/`Only N left today`(lowstock)/`no-limit`(без счётчика)/`Selected`. Статус считает бэк (`effective_status`), фронт только рендерит.
- **Order `/order`** (самый «опасный» по числу состояний): loading/success/empty-menu(«Switch location»)/empty-cart(«Pick a drink»)/`location not selected`/`closed`/`paused`/`drink sold-out`(оверлей)/`no-limit`/**`remaining<заказа`→модалка «Only N left» (Keep N / Remove)**/guest жмёт Pay→`/auth/phone`(выбор сохранён)/нет car plate(inline)/submit-loading «Creating order…»/`409` любой из §4 → не уходим с экрана.
- **Деталка** (опц.): success/not-found(«Drink not found.»)/sold-out/`remaining<заказа`/closed-paused.
- **Оплата `/checkout`→провайдер:** redirecting «Taking you to secure payment…»/mock/`failed` «Payment didn't go through.»(retry)/`cancelled` «Payment cancelled. Your order isn't placed yet.»(заказ скрыт, лимит не списан)/`409 ALREADY_PAID`/**`409 limit/sold-out во время оплаты` «Sold out while you were paying. You haven't been charged.»(refund initiated)**/`redirect lost`→`/orders/{id}` сам поллит payment_status.
- **Статус `/orders/[id]`:** EN-статусы (`new`«Order received…», `in_progress`«Making your drink», `ready`«Ready — come on over», `arrived`«You're here — bringing it out», `completed`«Handed over. Enjoy!», `refund`«Refunded»); WS-dropped баннер «Live updates paused — reconnecting»; `payment pending` «Confirming your payment…»; **«I'm here» доступен когда `paid` && status∉{completed,refund}**; rating-модалка «How was it? 👍/👎».
- **Мои заказы `/orders`:** empty(«No orders yet…»)/guest(«Sign in…»)/active highlight сверху.
- **Профиль `/profile`:** name/phone(ro)/car/emirate inline-edit; локаль-тоггл скрыт (EN-only); **без купонов** (Р8/Р11).
- **Auth по телефону:** auto-login без OTP (новый номер→лёгкий шаг имени; существующий→сразу сессия и возврат к исходному действию); `rate-limited` 429 «Too many tries. Wait a minute.»
- **Info:** статические; «Couldn't load this page.»/«Coming soon.»; в working-hours — бейдж «Closed now».

**Фиксы ревизии:** (1) `rating` доступен когда выставлен **`arrived_at`** (не обязательно `completed`) — клиент, нажавший «I'm here», может оценить до выдачи; таймаут промпта 15 мин — серверная константа. (2) Формулировка «заказ создаётся только после оплаты» уточнена: строка заказа создаётся при Pay в `pending`(скрыта); видимость+лимит — при `paid`; брошенные `pending` чистятся (см. backend-спеку).

**DoD по состояниям (каждая страница):** skeleton · empty+CTA · error.network+error.server+Try again (нет тихих catch) · offline-баннер+авто-retry · доменные edge-cases с явным copy+навигацией · guest-перехват сохраняет контекст · весь copy финальный EN.

---

## 6. Экран готовки заказа для менеджера (`/admin/kitchen`)
> Рабочий экран бариста за стойкой drive-through. Цель: за 1 взгляд видеть очередь и приоритеты, за 1 тап двигать статус, мгновенно слышать новый оплаченный заказ, не пропустить «клиент на месте». Статус-машину Juicy **не трогаем** (`new→in_progress→ready→completed→refund`; `arrived_at` независим).

### 6.1. Канбан 4 колонки (планшет за стойкой)
```
┌────────────────────────────────────────────────────────────────────────────┐
│ JBR Beach ▾   🔊 ●live │ Лимит точки: 142/200 ▓▓▓▓▓▓░ 58 ост · Стоп:[🍒 ⏻]  │
├─────────────┬─────────────┬───────────────────────────┬──────────────────────┤
│ NEW    ● 3  │ MAKING   2  │ READY · HANDOUT  ● 2       │ DONE (collapse ▸) 18 │
│ ░синий░     │ ░янтарь░    │ ░зелёный / 🚗 алерт░       │ ░серый░              │
│┌───────────┐│┌───────────┐│┌═══════════════════════┐  │ #1043 2pcs 09:12     │
││#1051 ⏱0:18││#1049 ⏱2:41││║#1047 🚗 HERE   ⏱4:55  ║  │ #1042 1pc  09:08     │
││2× Cherry🍒││1× Classic ││║DUBAI A 12345   PULSE  ║  │ …                    │
││DUBAI B7711││SHJ 99127  ││║1× Cherry 🍒 1× Mango⚡║  │                      │
││[ TAKE ▶ ] ││[ READY ✓ ]││║[ ✓ HANDED OVER ]      ║  │                      │
│└───────────┘│└───────────┘│└═══════════════════════┘  │                      │
└─────────────┴─────────────┴───────────────────────────┴──────────────────────┘
```
- Сортировка в колонке — **FIFO по времени** (старые сверху); `arrived && !completed` всплывает наверх + пульс-рамка (терракота). `DONE` свёрнута.
- Карточка под выдачу: **№ заказа** крупно (назвать клиенту) → **авто+эмират МАКСИМАЛЬНО крупно** (26px mono — найти машину) → позиции `qty×name` → таймер/кнопка. Имя/телефон/сумма/граммовка/история — в bottom-sheet по тапу, не на карточке.
- **1-тап действия** (кнопка ≥56px по статусу): `new`→**TAKE**, `in_progress`→**READY**, `ready`→**HANDED OVER** (требует hold 400мс/свайп — необратимо). Optimistic move + откат при ошибке.
- **Цвет** = stock-токены (`in_progress` lowstock, `ready` instock, `done` outofstock) + слой прибытия (рамка `#C44429` + пульс).
- **Таймер готовки** с момента оплаты (событие `paid`; рекомендуется аддитивное `paidAt` в `_order_row`), цвет по SLA `<3 / 3–5 / >5 мин`.
- **Звук+баннер нового заказа** (главный бизнес-фактор): на WS-сообщении `{orderId,status,arrived,number}` — впервые виден `orderId` со `status=new` → «дзынь» (не сирена, повтор каждые 20с пока есть незабранные) + полноэкранный баннер 4с + бейдж счётчика. Прибытие (`arrived false→true`) → другой, более высокий тон + пульс. **Браузер требует жеста** → стартовая модалка «Enable shift sound» (разблокировка AudioContext). Подавлять звук на массовом ресинке после reconnect (играть только на дельте first-seen).
- **Мини-панель лимита** (§5.16) и **быстрый стоп-лист** (§5.15) — в шапке; пауза приёма (super_admin) — отдельный крупный тумблер.
- Узкий экран → вертикальный аккордеон-список со свёрнутыми статусами (тот же источник, те же 1-тап кнопки). Шорткаты: `Space`=действие фокус-карточки, `↑↓`=навигация, `1–4`=колонки, `M`=mute, `S`=стоп-лист, `I`=детали, `Esc`.
- Состояния: пусто (иллюстрация «No orders — we're ready 🙂», звук armed) / колонка пустая (`— empty —`, высота сохранена) / много (>8 скролл, липкая шапка) / WS оффлайн (баннер «Connection lost — refreshing every 10s» + reconnect).

### 6.2. ⚠️ Предусловия (фиксы ревизии — без них экран не реализуем)
- **WS-аутентификация — БЛОКЕР.** Текущие `/ws/admin/orders` и `/ws/orders/{id}` **без аутентификации** (открытый broadcast). На этом строится канбан и скоуп менеджера — нельзя. **ws.py ДОЛЖЕН измениться** (вопреки «ws.py без изменений» в дизайне): гейт по staff-токену (query-param/subprotocol, т.к. браузер не шлёт `Authorization` на WS), отказ не-стаффу; для `manager` — подписка только на **per-location канал `admin:orders:{location_id}`**, а не глобальный. Детали — backend-спека.
- **Скоуп менеджера — это фундамент, не «аддитив».** `StaffUser.location_id`, `location_id` в JWT/`/me`-payload, `order.location_id`, `403 FOREIGN_LOCATION` во всех админ-эндпоинтах заказа — вводятся фундаментом локаций (§5.12 плана). Пока их нет, скоуп и per-location панели не реализуемы.
- `_order_row` расширить аддитивно: `paidAt` (точный таймер), `managerName` (кто взял), `locationId` (фильтр). `GET /api/admin/orders?location_id=`.

---

## 7. A11y, perf, i18n (кратко)
- **A11y:** focus-видимость везде (бирюза outline; в Juicy нет), focus-trap в overlay, hit-target ≥44px, цвет+текст (не только цвет), `aria-live` для тостов/статуса.
- **Perf:** `next/image` для PNG (AVIF/WebP, `sizes`, `priority`/blur на hero), self-host шрифта (`next/font/local`), RSC streaming (`<Suspense>` вокруг медленных секций), standalone-сборка.
- **i18n/RTL-задел:** только логические CSS-свойства, `[locale]`+`dir`, словарь `messages/en.json` (нет хардкода), `ar.json`-заглушка за флагом; включение AR = наполнение + флаг (стратегия URL-префикса решить заранее).

---
_Источник: воркфлоу `grabzi-frontend-arch-spec` (research→design→critique, 11 агентов), аудит `app/`+`backend/`, верификация живого grabzi.ae. Бэкенд/тесты — [GRABZI_BACKEND_AND_TESTING.md](GRABZI_BACKEND_AND_TESTING.md)._
