# Техническое задание на разработку MVP web-app / digital menu для juice bar в ОАЭ

## 0. Краткое резюме (Executive Summary)

Цель MVP — запустить mobile-first web-приложение (PWA-ready, без обязательной установки) для нового juice bar в ОАЭ, повторяющее UX-механики приложения **Drinkit** (Dodo Brands International DMCC, JLT Dubai) и поддерживающее предзаказ напитков с pickup / curbside-выдачей по номеру автомобиля. Web-app, а не нативное приложение, выбран потому, что (1) сокращает срок выхода на рынок в 2–3 раза, (2) убирает barrier-to-entry (нет установки), (3) уже сейчас покрывает все нужные интеграции (Apple Pay / Google Pay через Payment Request API, геолокация, SMS-OTP), (4) даёт прозрачное SEO для landing-страниц.

**Стек:** Next.js 15 (App Router, React Server Components, TypeScript) + FastAPI (Python 3.12, async) + PostgreSQL 16 + Redis 7. **Платежи:** рекомендованный шлюз — **Tap Payments** (лицензирован CBUAE как Retail Payment Services Provider, прозрачная тарификация 2,75 % / 3,25 % без monthly fee, нативный Apple Pay Web SDK, понятная REST-API и webhook'и со HMAC-подписью). **SMS-OTP:** на старте — Twilio Verify (~$0,05/верификация, быстрый запуск за 1 день), при росте объёма — миграция на Unifonic (локальный игрок MENA, выгоднее при > 5 000 OTP/мес). **Локализация:** next-intl, минимум RU/EN; AR с RTL — опциональная инфраструктура с самого начала (полный AR-контент — в V1.1). **Деплой:** Vercel (фронт) + Hetzner / AWS me-central-1 (Bahrain) / DigitalOcean (бэк в Docker).

Реалистичная оценка для одного fullstack-разработчика senior-уровня: **~13 недель / ~450 ч**. Для команды frontend + backend параллельно: **~7–8 недель / ~360 ч**. Целевой бюджет MVP: **$15 000–25 000 (1,4–2,3 млн ₽ / 55–92 тыс AED)**.

---

## 1. Контекст и детальный анализ референса (Drinkit)

### 1.1. Что такое Drinkit и почему он эталон

Drinkit — это сеть «цифровых кофеен» бренда Dodo Brands International DMCC. По данным официального сайта drinkit.ru и блога Dodo Engineering на Хабре, на 2026 год бренд оперирует **100+ кофейнями** (Россия, ОАЭ, Азербайджан, недавний запуск в Лос-Анджелесе на 8424 Santa Monica Blvd). Бренд работает по схеме «order-ahead first»: согласно интервью CEO Drinkit UAE Екатерины Бородич (Duamentes case study), **95 % заказов в EMAAR Square Dubai** проходит через приложение или киоски, физический кассир отсутствует, выдача — через «умную полку» (square with name highlighted by yellow ring → blue when ready).

**Масштаб продуктового каталога Drinkit как benchmark для нашего MVP:**
- ~90 комбинаций напитков
- ~40 опций кастомизации
- Подкатегории: chocolate-based, matcha, sugar-free iced matcha latte with protein and collagen, teas, lemonades + сэндвичи (pastrami, panini)
- Подписка Coffeepass — вне MVP-scope

Для juice bar разумный starting point: **20–30 напитков** (фреши, смузи, детокс-шоты, кофе, не-кофе, лимонады), **5–8 размеров/вариаций**, **6–8 групп add-on'ов** с общим количеством add-on'ов **25–40 штук**.

### 1.2. Ключевые UX-паттерны Drinkit для MVP

1. **Splash + onboarding** — фото напитка + месседж «Закажи любимый напиток заранее и забери по пути».
2. **Выбор города/точки** — табы городов (Москва / Dubai / Baku), список точек («Bay Avenue», «Emaar Square») с фото, адресом, часами; кнопка «Рядом со мной» с geolocation API.
3. **Авторизация только по телефону** + SMS-OTP. Без email, без пароля. Numpad-клавиатура с маской `+971`.
4. **Discovery-главная** с большим hero-баннером («Проснись со мной»), табами категорий («для тебя / весна / кофе / не кофе»), карточками продуктов с крупным фото-героем на бежево-сиреневой подложке.
5. **Карточка товара** — крупное hero-image (~50 % экрана), название («Раф таро»), цена, КБЖУ-strip (калории/белки/жиры/углеводы), expandable «подробнее», группы добавок: «полезные добавки», «пенки и муссы», «сливки», «эспрессо-дринки», «шарики тапиока», «топпинги», «сахар», «соусы», «цитрусовый чипс», «протеины», «коллаген». **КБЖУ пересчитывается в реальном времени** при изменении add-on'ов.
6. **Экран add-on'а** (например «ванильный протеин») — фото, описание, counter +/-, мгновенный пересчёт КБЖУ.
7. **«Назови напиток»** — текстовое поле с клавиатурой, auto-name по умолчанию.
8. **Корзина + checkout** на одном bottom-sheet'е, минимум полей: телефон + номер машины + время выдачи.
9. **Статус заказа** — line-stepper создан → принят → готовится → готов → выдан, иллюстрации меняются с этапом.
10. **Pickup-механика:** в физической кофейне — ячейка с именем (жёлтое кольцо → синее = готов); в web-app — кнопка «Я приехал» + SMS «заказ готов».

### 1.3. Дизайн-токены Drinkit

По данным открытого brand-кейса на Behance (`behance.net/gallery/169741907 — Drinkit brand identity`) и анализу скриншотов App Store:

- **Основной шрифт:** **ABC Favorit** (Dinamo Typefaces, коммерческий) + собственный emoji-typeface **«Kit regular»** на базе пропорций ABC Favorit. Для нашего MVP — open-source замена **Inter** или **Manrope**.
- **Фирменный синий (primary):** на публичных скринах варьируется в диапазоне `#3B4FE0`–`#4A56E2`. Точное значение Dodo Brands не публикует. **Для нашего MVP берём `#4A56E2`** (значение от заказчика).
- **Продуктовая палитра:** бежево-сиреневые фоны категорий — `#F5EFE7`, `#E8DCD0`, `#EFE6F0`, `#D8C8E0`.
- **Радиусы:** pill-кнопки `9999px` (full), карточки 16–24 px, bottom-sheet top-radius 24 px.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 px.

**Открытых UI-китов от самой Dodo Brands в Figma Community нет.** Внутренняя дизайн-система Drinkit закрытая (в вакансиях UX/UI-дизайнера Dodo Brands на hh.ru явно сказано: «проектировать интерфейсы компонентами в Figma» внутри in-house команды). Сторонние стартеры, которые можно использовать как референс:
- `figma.com/community/file/1305198455555652896` — Drink ordering app UI kit (Ninejoe, free)
- `figma.com/community/file/1116708627748807811` — Coffee Shop Mobile App Design (JavaGem)
- `figma.com/community/file/1067847732339602315` — общий Design System UI Kit

### 1.4. Технологии Drinkit (фактическое уточнение)

Из открытых источников (вакансии Dodo Engineering на hh.ru / habr.com/companies/dododev / career.habr.com/companies/dododev / Workable):

- **iOS:** Swift / UIKit (статья Хабра «Как Додо Пицца доставляет свежий код: история мобильного CI для iOS», habr.com/ru/companies/dododev/articles/782922/, подтверждает Swift + fastlane).
- **Android:** Kotlin (нативное приложение).
- **Бэкенд:** **.NET / C#**, RabbitMQ / Kafka, DDD, eXP/TDD (вакансия «.NET developer» в Dodo Engineering).
- **Web:** TypeScript / React / Redux (стэк указан на странице компании на Хабр-карьере).
- **⚠️ Важная фактическая корректировка к вашему вопросу:** Drinkit использует **нативные Swift/Kotlin**, а **не Flutter**. Это распространённое заблуждение.
- **Drinkit web-version:** полноценного web-аналога приложения с заказом у Dodo Brands **нет**; есть только маркетинговый сайт drinkit.io / drinkit.ru и киосковый web для самих кофеен. **Это даёт нам конкурентное преимущество в нашем MVP**: web-app — невостребованная ниша.

**Релевантные статьи Dodo Engineering / Mobile:**
- «Как Додо Пицца доставляет свежий код: история мобильного CI для iOS»
- «Быстрый, простой, сложный: как мы выпилили Realm»
- «UICollectionViewLayout для пиццы из разных половинок»
- «Всплывай! Транзишены в iOS»
- «Как мы приложение Додо Пиццы на арабский переводили» — **must-read** для нашей AR-локализации
- Telegram-канал Dodo Mobile (@dododev) — 134 тыс подписчиков, актуальные посты

### 1.5. Локализационные инсайты от UX-исследования Drinkit для UAE

Duamentes провели UX-research для Drinkit UAE (duamentes.com/success-stories/ux-guide-for-drinkit-in-uae/). Конкретные выводы, обязательные к учёту:

- Использовать **Modern Standard Arabic (MSA)** для арабской локализации (мультикультурный Дубай).
- **RTL** — зеркалить иконки прогресса/направления (стрелки back/forward, иконку курьера), **но не** зеркалить логотипы соцсетей, поиск Google, поля цифровых данных (номера телефонов, карт).
- **Поля ввода телефонов / карт / номеров автомобилей — всегда LTR** даже в RTL-режиме (`<input dir="ltr">`).
- **Избегать изображений людей и животных** в иллюстрациях onboarding — учитывать культурные чувствительности.
- **Шкалы рейтингов — RTL** (звёзды читаются справа налево).

---

## 2. Раздел A. Функциональные требования (FR)

### 2.1. Пользовательские роли

| Роль | Описание |
|---|---|
| **Гость** | Просматривает меню без авторизации, собирает корзину (localStorage). Для checkout требуется верификация телефона |
| **Авторизованный клиент** | Имеет историю заказов, сохранённый номер машины, может «повторить заказ» |
| **Бариста (operator)** | Видит ленту заказов своей точки, меняет статусы |
| **Менеджер точки** | + видит выручку по своей точке, может приостанавливать продажу позиций |
| **Супер-админ** | Все права + CRUD меню, точек, пользователей |

### 2.2. Жизненный цикл заказа

```
[CREATED] → [PAID] → [ACCEPTED] → [PREPARING] → [READY] → [PICKED_UP]
              │
              ├─→ [CANCELLED]  (auto: не оплачено за 10 мин; manual: клиент до ACCEPTED)
              └─→ [REFUNDED]   (после CANCELLED или manual бариста)
              [PAYMENT_FAILED] (alt: webhook от Tap с DECLINED)
```

### 2.3. User stories по приоритетам

#### P0 — must-have для MVP

| # | Story | Acceptance criteria |
|---|---|---|
| FR-001 | Гость выбирает город и точку | Список 1–3 городов, под каждым список точек с адресом, часами, кнопка «Рядом со мной» (geolocation API), выбор сохраняется в localStorage |
| FR-002 | Гость видит меню с категориями | Табы категорий (horizontal scroll), grid 2×N карточек с hero-image, названием, ценой, badge «нет в наличии» |
| FR-003 | Гость открывает карточку напитка | Bottom-sheet или full-screen с фото, КБЖУ, описанием, размером, секциями add-on'ов |
| FR-004 | Гость выбирает размер (S/M/L) | Pill-toggle, цена и КБЖУ пересчитываются |
| FR-005 | Гость добавляет add-on'ы | По 8+ категориям (полезные, пенки, сливки, эспрессо, тапиока, топпинги, сахар, соусы, цитрусовый чипс, протеины, коллаген); counter +/-, для некоторых — single-select |
| FR-006 | Гость даёт кастомное имя напитку | Текстовое поле «Назови напиток», auto-suggest, max 30 символов |
| FR-007 | Гость видит корзину | Список с миниатюрами, +/-, итого, переход на checkout |
| FR-008 | Гость вводит телефон | Numpad с маской `+971`, переключатель кода страны, валидация libphonenumber |
| FR-009 | Гость получает OTP | SMS приходит за < 15 сек, 4 цифры, autofill iOS Safari через `autocomplete="one-time-code"` |
| FR-010 | Клиент указывает номер машины | Поле + dropdown эмирата (Dubai/Abu Dhabi/Sharjah/...), сохраняется в профиле |
| FR-011 | Клиент выбирает время выдачи | «Как можно скорее» (default) или конкретный слот 15-минутными интервалами |
| FR-012 | Клиент оплачивает | Apple Pay / Google Pay / банковская карта через Tap Payments |
| FR-013 | Клиент видит статус заказа | Stepper (создан → принят → готовится → готов → выдан), кнопка «Я приехал» становится primary при статусе READY |
| FR-014 | Клиент видит историю заказов | Последние 20, тап → детали + кнопка «повторить заказ» |
| FR-015 | Бариста видит ленту заказов | Real-time лента (SSE), звук + анимация при новом заказе, фильтр по статусу |
| FR-016 | Бариста меняет статус | Кнопки «Принять», «Готов», «Выдан», «Отменить» (с причиной) |
| FR-017 | Менеджер видит выручку | Карточки «сегодня / неделя / месяц», график по дням, топ-10 товаров |
| FR-018 | Менеджер скрывает позицию | Toggle «в продаже» на товаре |
| FR-019 | Супер-админ CRUD меню | Создать/изменить/удалить товар, категорию, размер, add-on, точку, цену |
| FR-020 | Локализация | RU/EN с самого старта; AR-инфраструктура (RTL, dir-атрибут, logical properties) — readiness |

#### P1 — should-have (V1.1)

- FR-101 Web Push уведомления «заказ готов»
- FR-102 Сохранение карт через Tap Tokenization для one-click оплаты
- FR-103 Геолокация-триггер: авто-CTA «Я приехал» при радиусе 150 м
- FR-104 Промокоды (флэт / процент / freebie) — без полноценной программы лояльности
- FR-105 Telegram-бот для уведомлений бариста
- FR-106 Экспорт выручки в CSV
- FR-107 Полная AR-локализация с переводом всего контента

#### P2 — nice-to-have (V2+, явно вне MVP)

- FR-201 Программа лояльности / бонусные баллы — **вне scope MVP**
- FR-202 Реферальная программа — **вне scope**
- FR-203 Подписка на напитки (Coffeepass-аналог)
- FR-204 Подарочные карты
- FR-205 Delivery tracking — **вне scope**, только pickup/curbside

---

## 3. Раздел B. Нефункциональные требования (NFR)

### 3.1. Производительность (Core Web Vitals)

- **LCP < 2,5 s** на 4G Mid-tier device (Lighthouse mobile preset)
- **INP (бывший FID) < 100 ms**
- **CLS < 0,1**
- **TTFB < 600 ms** для SSR-страниц
- Размер initial JS-bundle < **200 KB gzipped**
- Все изображения товаров — через `next/image` + Cloudinary (AVIF/WebP, lazy-loading ниже first viewport)
- Кеширование RSC: каталог — `revalidate: 60`, статика — `force-cache`

### 3.2. Mobile-first

- **Baseline:** 375 × 812 (iPhone X/13 mini)
- **Дизайн-точки:** 320 / 375 / 414 / 768 / 1024 / 1440
- Тач-targets ≥ 44 × 44 pt (Apple HIG) / 48 × 48 dp (Material)
- Safe-area insets для iPhone notch / Dynamic Island (`env(safe-area-inset-*)`)
- Полная адаптивность до 1440 px (на desktop — центрированный mobile-frame шириной 480 px)

### 3.3. SEO

- Landing-страницы (`/`, `/menu`, `/locations/[id]`) — SSR через RSC, мета через `generateMetadata`
- `sitemap.xml` + `robots.txt` через Next.js встроенные API
- `hreflang` для RU/EN/AR (next-intl делает автоматически)
- Open Graph + Twitter Cards
- JSON-LD структурированные данные: `Restaurant`, `LocalBusiness`, `MenuItem`

### 3.4. Аналитика

| Инструмент | Назначение |
|---|---|
| **GA4** | Базовая поведенческая аналитика, источники |
| **Yandex.Metrika** | Тепловые карты, вебвизор (для RU-аудитории) |
| **Posthog / Amplitude** (free tier) | Product analytics, funnels (опц.) |
| **Sentry** | Error tracking (frontend + backend) |

Ключевые events: `view_menu`, `view_product`, `add_to_cart`, `begin_checkout`, `phone_submitted`, `otp_verified`, `payment_started`, `purchase`, `order_arrived`.

### 3.5. Безопасность

- HTTPS only, HSTS на все домены
- **OWASP Top-10 базовая защита:**
  - SQL Injection → SQLAlchemy ORM, никакого raw SQL без параметризации
  - XSS → React по умолчанию экранирует; DOMPurify для динамического HTML
  - CSRF → SameSite=Lax cookies + CSRF-token на admin endpoints
  - IDOR → проверка `user_id` на каждом запросе заказа (middleware)
- **Rate limiting** через `slowapi`:
  - `/auth/request-otp` — 3 / номер / 15 мин, 10 / IP / час
  - `/auth/verify-otp` — 5 попыток / номер / 15 мин
  - Прочие POST — 60 / IP / мин
- **OTP** — только хеш в Redis (bcrypt/argon2), TTL 5 мин
- **Пароли админа** — Argon2id
- **Платежи** — карты НЕ хранятся, используем Tap Tokenization → `tok_xxx` / `card_xxx`; PCI DSS scope сокращён до SAQ-A
- **Webhook signature verification:** Tap отправляет `hashstring` в header — обязательная HMAC-валидация
- **Логи** — не логировать номер карты, CVC, полный телефон (маскировать middle digits)
- **Backups PostgreSQL** — ежедневные, retention 30 дней, off-site (S3)
- **Compliance:** UAE PDPL — privacy policy + явное consent на checkout; cookie-banner для EU-трафика

---

## 4. Раздел C. Список клиентских экранов (детально)

> Все экраны mobile-first, 375 × 812 baseline. Все экраны переводятся на RU/EN; AR — после MVP.

### C.1. Splash + Onboarding

3 экрана swipe:
- **Экран 1:** крупное фото фреша на бежевом фоне, заголовок «Закажи любимый напиток заранее и забери по пути», пагинация 1/3, pill «Дальше»
- **Экран 2:** фото машины с напитком, «Указал номер машины — мы вынесем заказ к авто»
- **Экран 3:** фото меню с КБЖУ, «Считаем калории за тебя — пересобирай напиток как хочешь»
- Кнопка **«Начать»** на последнем → переход к выбору точки. Skip — в правом верхнем углу

Реализация: Framer Motion `<motion.div drag="x">` + swipe gestures.

### C.2. Выбор города и точки

- Title «Выбери точку»
- Tabs городов (Dubai / Abu Dhabi). На MVP — один город, табы скрыты
- Список точек: карточки с фото витрины, названием («Bay Avenue», «Emaar Square»), адресом, часами («7:00 – 22:00»), расстоянием («1,2 км от тебя»)
- Кнопка «🧭 Рядом со мной» — geolocation API, сортирует по расстоянию (haversine)
- Карта (опц., V1.1) — Google Maps / Mapbox

### C.3. Авторизация по телефону

- Логотип сверху
- Текст «Введи номер телефона», «Мы отправим SMS с кодом»
- Поле с маской `+971 50 123 45 67`, дропдаун кода страны (`+971` default, `+7`, `+1`...)
- Кастомный numpad внизу экрана (тач-targets 60×60)
- Чек-бокс «Согласен с обработкой данных и офертой» (PDPL compliance)
- CTA «Получить код» (pill, primary)

### C.4. Ввод OTP

- 4 цифровые ячейки 56×56 (auto-focus next)
- iOS-autofill через `autocomplete="one-time-code"` на каждом input
- Таймер «Отправить новый код через 0:45», далее кнопка «Отправить ещё раз»
- Кнопка «Изменить номер» сверху
- При успехе — переход на главную

### C.5. Главная (Discovery)

- **Top bar:** слева — иконка профиля, по центру — название точки (тап → смена), справа — корзина с бейджем
- **Hero-баннер:** карусель акций («Проснись со мной — Бамбл коктейль −20 %»), auto-rotate каждые 5 сек
- **Horizontal tabs:** «для тебя / фреши / смузи / детокс / кофе / не кофе / еда»
- **Grid 2 колонки** карточек:
  - Фото 1:1, фон-color из категории (бежево-сиреневый)
  - Название, цена «18 AED», кнопка «+» (floating)
  - Sold-out: серый overlay + «Скоро вернётся»
- **BNAV:** Главная / Меню / Заказы / Профиль (4 таба, pill-индикатор)

### C.6. Карточка товара (Drink detail)

- **Hero:** фото 1:1, бежевый фон, ← back, share
- **Заголовок:** «Раф таро» + цена «22 AED»
- **КБЖУ-strip:** «120 ккал · 3 г Б · 4 г Ж · 18 г У», live-пересчёт
- **Description** — collapsed by default, expand на тап
- **Toggle размеров:** S 250ml / M 350ml / L 450ml (pill-группа)
- **Секции добавок** (expandable accordion):
  - Полезные добавки (single-select)
  - Пенки и муссы (counter)
  - Сливки (single-select)
  - Эспрессо-дринки (counter, max 3)
  - Шарики тапиока (counter, max 2)
  - Топпинги (multi-checkbox)
  - Сахар (slider 0/1/2/3 ложки)
  - Соусы (multi)
  - Цитрусовый чипс (toggle)
  - Протеины / Коллаген (single-select)
- Поле «Назови напиток» (опц.)
- Sticky bottom CTA «Добавить в корзину — 22 AED»

### C.7. Экран добавки (детальный)

Для add-on'а типа «ванильный протеин»: фото, описание, КБЖУ +12 ккал / +5 г Б, counter +/- (max 3), кнопка «Готово».

### C.8. «Назови напиток»

Full-screen modal, заголовок «Назови напиток», большое поле, кастомная клавиатура, подсказка-генератор («Свежий микс», «Утренний заряд», «Раф таро»), кнопка «Сохранить».

### C.9. Корзина

- Список товаров с миниатюрой, custom-name, составом add-on'ов мелким шрифтом, ценой, +/-
- Промокод (V1.1) — input + «Применить»
- Итого: subtotal + VAT 5 % + total
- Sticky CTA «Оформить — 44 AED»

### C.10. Checkout

- **Контакт:** верифицированный номер с галочкой ✓
- **Авто:** dropdown эмирата + поле «O 12345», запоминается. Опц.: «цвет/модель»
- **Время:** radio «Как можно скорее (~5 мин)» / «Выбрать время» → time-picker 15-мин слотами
- **Точка:** превью + смена
- Итого, VAT
- CTA «Перейти к оплате»

### C.11. Оплата

- Заголовок «Оплата 44 AED»
- **Apple Pay button** (Safari iOS) — Tap Apple Pay Web SDK
- **Google Pay button** (Chrome Android) — Payment Request API через Tap
- Разделитель «или»
- Кнопка «Банковская карта» → hosted page Tap или inline iframe
- На успех — webhook от Tap, редирект на статус

### C.12. Статус заказа

- Большая иллюстрация / анимированный эмодзи (с эволюцией по этапам)
- Stepper горизонтальный: ⬤ Принят — ⬤ Готовится — ◯ Готов — ◯ Выдан
- ETA «Готовим ~ 4 мин»
- Большая кнопка **«Я приехал»** (primary при READY и/или geolocation в радиусе)
- Детали заказа (collapsible)
- «Помощь» / «Связаться с точкой» (tel-link)

### C.13. Профиль / История

- Имя + телефон + аватар (initials)
- Сохранённый номер машины (редактируется)
- Список «Мои заказы» — последние 20
- **Языковой переключатель** RU/EN/AR
- Ссылки: «Условия», «Политика конфиденциальности», «Контакты»
- Кнопка «Выйти»

---

## 5. Раздел D. Список админ-экранов

### D.1. Логин админа
Email + пароль + опц. 2FA (TOTP). Доступ из whitelist IP для production.

### D.2. Дашборд
Карточки: «Активных: 7», «Сегодня выручка: 1240 AED», «Заказов: 56», «Avg ticket: 22 AED». Лента 5 последних заказов. График выручки за неделю.

### D.3. Лента заказов (Kitchen Display)
- Колонки по статусам: NEW / PREPARING / READY / PICKED_UP
- Карточка: №, время, имя клиента, телефон (last 4), номер машины, состав, сумма, ETA
- Звук при новом заказе в NEW, моргание 3 сек
- Кнопки status-transition

### D.4. Карточка заказа (модал)
Все поля + история статусов + ссылка на платёж в Tap dashboard. Кнопки: «Принять», «Готов», «Выдан», «Отменить» (с причиной из dropdown → автоматический refund через Tap API).

### D.5. Список заказов (history)
Фильтры: точка, статус, дата (range), сумма. Экспорт CSV.

### D.6. Управление меню
- Список товаров: фото, название, категория, цена, точки, toggle «в продаже»
- CRUD товара: фото → Cloudinary, название RU/EN/AR, описание RU/EN/AR, КБЖУ, размеры с ценами, привязка add-on-групп
- CRUD категорий
- CRUD add-on-групп и add-on'ов

### D.7. Управление точками
Список точек: название, адрес, координаты, часы. Привязка ассортимента. On/off приём заказов.

### D.8. Настройки уведомлений
Звук on/off, выбор мелодии (3 варианта), Telegram-бот toggle + chat_id.

### D.9. Аналитика (basic)
Выручка день/неделя/месяц. Топ-10 товаров. Среднее время приготовления. Распределение по часам.

### D.10. Пользователи и роли
CRUD admin users (operator / manager / super_admin). Привязка operator к точке.

---

## 6. Раздел E. UI-кит (полный набор токенов)

### 6.1. Цвета

```css
:root {
  /* Primary */
  --color-primary-500: #4A56E2;
  --color-primary-600: #3B47C9;
  --color-primary-100: #E5E7FC;

  /* Surface (продуктовая палитра) */
  --color-beige-50:    #FAF6F0;
  --color-beige-100:   #F5EFE7;
  --color-beige-200:   #E8DCD0;
  --color-lilac-100:   #EFE6F0;
  --color-lilac-200:   #D8C8E0;

  /* Neutrals */
  --color-bg:          #FFFFFF;
  --color-surface:     #FAFAFA;
  --color-text:        #0E0E10;
  --color-text-muted:  #6B7280;
  --color-border:      #E5E7EB;

  /* Semantic */
  --color-success:     #16A34A;
  --color-warning:     #F59E0B;
  --color-error:       #DC2626;
  --color-info:        #0EA5E9;
}
```

### 6.2. Типографика

**Шрифты:**
- **Latin/Cyrillic:** Inter (Variable, Google Fonts) или Manrope; альтернатива — платный ABC Favorit
- **Arabic:** IBM Plex Sans Arabic или Tajawal (Google Fonts)

| Token | Size / LH / Weight | Использование |
|---|---|---|
| display | 40 / 48 / 700 | Hero splash |
| h1 | 32 / 40 / 700 | Заголовок страницы |
| h2 | 24 / 32 / 600 | Заголовок секции |
| h3 | 20 / 28 / 600 | Карточки |
| h4 | 18 / 24 / 600 | Sub-заголовки |
| body-lg | 16 / 24 / 400 | Базовый |
| body | 14 / 20 / 400 | Описания |
| caption | 12 / 16 / 400 | Мелкие подписи |
| button-lg | 16 / 16 / 600 | Pill primary |
| button | 14 / 14 / 600 | Стандартная |

### 6.3. Кнопки

| Variant | Стиль |
|---|---|
| **Primary pill** | bg `primary-500`, color white, radius `9999px`, padding `14px 24px`, font-weight 600. Hover: `primary-600`. Disabled: opacity 0.4 |
| **Secondary pill** | bg transparent, border 1.5px `text`, color `text` |
| **Ghost** | bg transparent, color `primary-500`, без border |
| **Icon button** | 44×44, radius 12, bg `surface`, иконка 20×20 |
| **Tab pill** | active: bg `text`, color white; inactive: bg `surface`, color `text-muted` |
| **Floating ADD «+»** | 32×32 circle, bg `primary-500`, иконка плюс 16×16 white |

Все кнопки — `whileTap: { scale: 0.96 }` через Framer Motion.

### 6.4. Inputs
- Text: height 48, radius 12, border 1px `border`, focused 2px primary, padding `12px 16px`
- Phone: dropdown кода страны слева + поле (`react-international-phone`)
- NumPad: grid 3×4, кнопки 60×60 radius 16, цифры 24 px
- OTP: 4 ячейки 56×56 radius 12, font 24 центрированный

### 6.5. Cards
- **Product card:** radius 20, padding 12, фон бежевый/сиреневый, фото 1:1 radius 16, под фото название 14/600 и цена 14/600, кнопка «+» абс. позиц.
- **Addon row:** radio/checkbox/counter + название + sub (КБЖУ-дельта) + цена справа
- **Order card:** иконка статуса, заголовок «№ 1247 · Bay Avenue», состав 1 строкой, цена, время, «повторить»

### 6.6. Modals / Bottom Sheets
- Bottom sheet: top-radius 24, drag-handle (36×4 серая полоска), backdrop `rgba(0,0,0,0.4)`, swipe-down dismiss
- Full-screen modal: для карточки товара, OTP, «назови напиток»

### 6.7. Navigation
- Top bar: height 56
- Bottom nav: height 64 + safe-area-bottom
- Tabs horizontal: height 40

### 6.8. Иконки
Библиотека **lucide-react** (≈ 1000 иконок, tree-shakable), размер 20 px, stroke-width 1.75. Кастомные SVG для категорий — в `/public/icons`.

### 6.9. Анимации (Framer Motion presets)

```ts
export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: 'easeOut' }
};
export const tapScale = { whileTap: { scale: 0.96 } };
export const sheetSpring = { type: 'spring', stiffness: 300, damping: 30 };
export const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
```

### 6.10. Spacing
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64` px (совместимо с Tailwind).

### 6.11. Border radius
`6 · 8 · 12 · 16 · 20 · 24 · 9999 (full pill)`.

### 6.12. Shadows
```
--shadow-sm:  0 1px 2px rgba(0,0,0,0.04);
--shadow-md:  0 4px 12px rgba(0,0,0,0.08);
--shadow-lg:  0 12px 32px rgba(0,0,0,0.12);
```

---

## 7. Раздел F. API endpoints (REST)

Base URL: `https://api.example.com/v1`. JSON, ISO-8601 UTC, JWT Bearer.

### 7.1. Auth

```
POST   /auth/request-otp        { phone: "+971501234567" }              → 200 { request_id, ttl: 300 }
POST   /auth/verify-otp         { request_id, code: "1234" }            → 200 { access_token, refresh_token, user }
POST   /auth/refresh            { refresh_token }                       → 200 { access_token, refresh_token }
POST   /auth/logout             —                                        → 204
GET    /auth/me                 (Bearer)                                 → 200 { user }
```

### 7.2. Catalog

```
GET    /outlets                                                          → 200 [outlet]
GET    /outlets/{id}                                                     → 200 outlet
GET    /outlets/nearby?lat=&lng=&radius=5000                             → 200 [outlet]
GET    /outlets/{id}/categories                                          → 200 [category]
GET    /outlets/{id}/products?category={slug}                            → 200 [product]
GET    /products/{id}                                                    → 200 product
GET    /products/{id}/availability?outlet_id=                            → 200 { in_stock: bool }
```

### 7.3. Cart
Корзина хранится **только на клиенте** (Zustand + localStorage). Отправляется на бэк лишь при создании заказа — упрощает архитектуру.

### 7.4. Orders

```
POST   /orders                  (Bearer)
       Body: {
         outlet_id, car_plate, car_emirate, scheduled_for, custom_name,
         items: [
           { product_id, variant_id, quantity, custom_name?,
             addons: [{ addon_id, quantity }] }
         ]
       }
       → 200 { order_id, number, total, payment: { gateway_url | client_secret } }

GET    /orders/{id}             (Bearer)                                 → 200 order
GET    /orders                  (Bearer)                                 → 200 [order]
POST   /orders/{id}/arrived     (Bearer)                                 → 204
POST   /orders/{id}/cancel      (Bearer)                                 → 200 order  (только до ACCEPTED)
GET    /orders/{id}/stream      (SSE, Bearer)                            → text/event-stream
```

### 7.5. Payments

```
POST   /payments/intent         (Bearer)
       Body: { order_id, method: "card"|"applepay"|"googlepay", token?: "tok_xxx" }
       → 200 { gateway: "tap", charge_id, redirect_url? | client_secret? }

POST   /payments/webhook/tap    (header X-Tap-Signature)                 → 200
POST   /payments/webhook/stripe (header Stripe-Signature)                → 200
```

**Пример FastAPI-обработчика webhook (Tap):**

```python
@router.post("/webhook/tap")
async def tap_webhook(
    request: Request,
    x_tap_signature: str = Header(...),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    body = await request.body()
    if not verify_tap_signature(body, x_tap_signature, settings.TAP_WEBHOOK_SECRET):
        raise HTTPException(401, "Invalid signature")

    event = json.loads(body)
    event_id = event["id"]

    # Idempotency
    if await redis.set(f"webhook:tap:{event_id}", "1", ex=86400, nx=True) is None:
        return {"status": "already_processed"}

    charge = event["object"]
    status = charge["status"]                                  # CAPTURED/DECLINED/...
    order_id = charge["metadata"]["order_id"]

    order = await db.get(Order, order_id)
    if status == "CAPTURED":
        order.status = OrderStatus.PAID
        order.paid_at = datetime.utcnow()
        await sms_service.send(order.user.phone, t("order_received", order.locale))
        await sse_broker.publish(f"outlet:{order.outlet_id}", order)
    elif status in ("DECLINED", "FAILED"):
        order.status = OrderStatus.PAYMENT_FAILED
    await db.commit()
    return {"status": "ok"}
```

**Пример инициализации Apple Pay через Tap Web SDK (Next.js client component):**

```tsx
'use client';
import { TapApplePayButton, Environment } from '@tap-payments/apple-pay-button';

export function PayWithApple({ orderId, amount }: Props) {
  const handleSuccess = async (data: { id: string }) => {
    const res = await fetch('/api/payments/intent', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, method: 'applepay', token: data.id }),
    });
    const { charge_id } = await res.json();
    router.push(`/orders/${orderId}`);
  };

  return (
    <TapApplePayButton
      publicKey={process.env.NEXT_PUBLIC_TAP_PUBLIC_KEY!}
      environment={Environment.Production}
      merchant={{ domain: 'example.com', id: process.env.NEXT_PUBLIC_TAP_MERCHANT_ID! }}
      transaction={{ amount, currency: 'AED' }}
      onSuccess={handleSuccess}
      onError={(e) => console.error(e)}
    />
  );
}
```

### 7.6. Admin

```
GET    /admin/orders?status=&outlet_id=&from=&to=
PATCH  /admin/orders/{id}/status   { status, reason? }
GET    /admin/orders/stream         (SSE)

GET/POST/PATCH/DELETE   /admin/products
PATCH  /admin/products/{id}/availability   { outlet_id, in_stock }
GET/POST/PATCH/DELETE   /admin/categories
GET/POST/PATCH/DELETE   /admin/addons
GET/POST/PATCH/DELETE   /admin/addon-groups
GET/POST/PATCH          /admin/outlets
GET/POST/PATCH          /admin/users

GET    /admin/analytics/revenue?period=day|week|month
GET    /admin/analytics/top-products?period=
```

### 7.7. Misc

```
POST   /uploads/signed-url      (admin) — Cloudinary/S3 presigned URL
GET    /health
```

---

## 8. Раздел G. Схема БД (PostgreSQL, 3NF)

UUIDv7 как PK (через `uuidv7()` extension или Python `uuid7`), все timestamps `timestamptz`, локализованные строки — JSONB.

```sql
-- ===== Users =====
CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    phone           varchar(20) UNIQUE NOT NULL,
    name            varchar(80),
    default_car_plate varchar(20),
    default_emirate varchar(20),
    preferred_locale varchar(5) DEFAULT 'en',
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_users_phone ON users(phone);

CREATE TABLE admin_users (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    email           varchar(120) UNIQUE NOT NULL,
    password_hash   varchar(255) NOT NULL,
    role            varchar(20) NOT NULL CHECK (role IN ('operator','manager','super_admin')),
    outlet_id       uuid REFERENCES outlets(id),
    totp_secret     varchar(64),
    is_active       boolean DEFAULT true,
    created_at      timestamptz DEFAULT now()
);

-- ===== Outlets =====
CREATE TABLE outlets (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    slug            varchar(60) UNIQUE NOT NULL,
    name            jsonb NOT NULL,         -- {"en":"Bay Avenue","ru":"Бэй Авеню","ar":"..."}
    address         jsonb NOT NULL,
    city            varchar(40) NOT NULL,
    lat             double precision NOT NULL,
    lng             double precision NOT NULL,
    open_time       time NOT NULL,
    close_time      time NOT NULL,
    is_active       boolean DEFAULT true,
    phone           varchar(20),
    created_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_outlets_city ON outlets(city);

-- ===== Catalog =====
CREATE TABLE categories (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    slug            varchar(60) UNIQUE NOT NULL,
    name            jsonb NOT NULL,
    sort_order      int DEFAULT 0,
    icon            varchar(60),
    is_active       boolean DEFAULT true
);

CREATE TABLE products (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    slug            varchar(80) UNIQUE NOT NULL,
    category_id     uuid REFERENCES categories(id) ON DELETE RESTRICT,
    name            jsonb NOT NULL,
    description     jsonb,
    image_url       varchar(500),
    surface_color   varchar(20),                       -- hex фона карточки
    base_calories   numeric(6,2),
    base_protein    numeric(6,2),
    base_fat        numeric(6,2),
    base_carbs      numeric(6,2),
    sort_order      int DEFAULT 0,
    is_active       boolean DEFAULT true,
    created_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE product_variants (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    code            varchar(20) NOT NULL,              -- 'S'|'M'|'L'
    name            jsonb NOT NULL,
    volume_ml       int,
    price_aed       numeric(10,2) NOT NULL,
    calories_modifier numeric(6,2) DEFAULT 0,
    sort_order      int DEFAULT 0,
    UNIQUE (product_id, code)
);

-- ===== Add-ons =====
CREATE TABLE addon_groups (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    slug            varchar(60) UNIQUE NOT NULL,
    name            jsonb NOT NULL,
    selection_type  varchar(20) NOT NULL CHECK (selection_type IN ('single','multi','counter')),
    min_select      int DEFAULT 0,
    max_select      int,
    is_required     boolean DEFAULT false,
    sort_order      int DEFAULT 0
);

CREATE TABLE addons (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    group_id        uuid NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
    name            jsonb NOT NULL,
    price_aed       numeric(10,2) DEFAULT 0,
    calories_delta  numeric(6,2) DEFAULT 0,
    protein_delta   numeric(6,2) DEFAULT 0,
    fat_delta       numeric(6,2) DEFAULT 0,
    carbs_delta     numeric(6,2) DEFAULT 0,
    image_url       varchar(500),
    is_active       boolean DEFAULT true,
    sort_order      int DEFAULT 0
);

CREATE TABLE product_addon_groups (
    product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    group_id        uuid NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
    sort_order      int DEFAULT 0,
    PRIMARY KEY (product_id, group_id)
);

CREATE TABLE outlet_product_availability (
    outlet_id       uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    in_stock        boolean DEFAULT true,
    PRIMARY KEY (outlet_id, product_id)
);

-- ===== Orders =====
CREATE TYPE order_status AS ENUM (
    'CREATED','PAID','ACCEPTED','PREPARING','READY','PICKED_UP',
    'CANCELLED','REFUNDED','PAYMENT_FAILED'
);

CREATE TABLE orders (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    number          serial UNIQUE,
    user_id         uuid NOT NULL REFERENCES users(id),
    outlet_id       uuid NOT NULL REFERENCES outlets(id),
    status          order_status NOT NULL DEFAULT 'CREATED',
    car_plate       varchar(20),
    car_emirate     varchar(20),
    scheduled_for   timestamptz,
    custom_name     varchar(60),
    subtotal_aed    numeric(10,2) NOT NULL,
    vat_aed         numeric(10,2) NOT NULL,
    total_aed       numeric(10,2) NOT NULL,
    paid_at         timestamptz,
    ready_at        timestamptz,
    picked_up_at    timestamptz,
    arrived_at      timestamptz,
    cancellation_reason text,
    locale          varchar(5) DEFAULT 'en',
    created_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_orders_outlet_status ON orders(outlet_id, status);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_items (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      uuid NOT NULL REFERENCES products(id),
    variant_id      uuid REFERENCES product_variants(id),
    product_name_snapshot   jsonb NOT NULL,
    variant_name_snapshot   jsonb,
    custom_name     varchar(60),
    quantity        int NOT NULL DEFAULT 1,
    unit_price_aed  numeric(10,2) NOT NULL,
    line_total_aed  numeric(10,2) NOT NULL,
    calories_total  numeric(6,2),
    sort_order      int DEFAULT 0
);
CREATE INDEX idx_oi_order ON order_items(order_id);

CREATE TABLE order_item_addons (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    order_item_id   uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    addon_id        uuid NOT NULL REFERENCES addons(id),
    addon_name_snapshot jsonb NOT NULL,
    quantity        int DEFAULT 1,
    unit_price_aed  numeric(10,2) NOT NULL
);

CREATE TABLE order_status_history (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status          order_status NOT NULL,
    changed_by      uuid REFERENCES admin_users(id),
    changed_at      timestamptz DEFAULT now(),
    note            text
);

-- ===== Payments =====
CREATE TABLE payments (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    gateway         varchar(20) NOT NULL,              -- 'tap'|'stripe'
    gateway_charge_id varchar(120),
    method          varchar(20),                       -- 'card'|'applepay'|'googlepay'
    amount_aed      numeric(10,2) NOT NULL,
    status          varchar(20) NOT NULL,              -- 'PENDING'|'CAPTURED'|'FAILED'|'REFUNDED'
    raw_response    jsonb,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_payments_order ON payments(order_id);

-- ===== OTP audit =====
CREATE TABLE otp_audit (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    phone           varchar(20) NOT NULL,
    action          varchar(20) NOT NULL,              -- 'request'|'verify_ok'|'verify_fail'
    ip              inet,
    user_agent      text,
    created_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_otp_audit_phone ON otp_audit(phone, created_at DESC);
```

---

## 9. Раздел H. Интеграции (сводно)

| Интеграция | Назначение | Поставщик | Замечания |
|---|---|---|---|
| **Платежи** | Card / Apple Pay / Google Pay | **Tap Payments** (основной) + Stripe (fallback) | Webhook + idempotency + abstraction layer `PaymentGateway` |
| **SMS** | OTP, статусы заказа | Twilio Verify (start) → Unifonic (scale) | TDRA-compliant sender ID |
| **Object storage** | Фото товаров | Cloudinary (free 25 GB) или AWS S3 me-central-1 | CDN, auto-WebP/AVIF |
| **Email** (опц.) | Чеки | Resend / Postmark / SES | Не критично для MVP |
| **Telegram bot** | Уведомления бариста (опц.) | python-telegram-bot | Опционально |
| **Maps** | Точки на карте | Google Maps Embed / Mapbox | V1.1 |
| **Error tracking** | Логи | Sentry (free 5k events) | С самого старта |
| **Аналитика** | Поведение | GA4 + Yandex.Metrika + Posthog | Все бесплатны на MVP |
| **Translation mgmt** | (Опц.) | Crowdin / Localizely | После MVP |

---

## 10. Сравнение платёжных шлюзов для ОАЭ

| Шлюз | Лицензия UAE | Комиссия (UAE-карты) | Setup/Monthly | Apple Pay | Google Pay | 3DS2 | FastAPI DX | Approval | Для MVP |
|---|---|---|---|---|---|---|---|---|---|
| **Tap Payments** | RPS provider (CBUAE) | 2,75 % (UAE) / 3,25 % + FX (intl) | 0 / 0 | ✅ Web SDK + iOS kit, домен регистрирует Tap | ✅ | ✅ | Очень хорошо: REST, webhook HMAC, sandbox, документация developers.tap.company | 2–4 раб. дн. | **Основной выбор** |
| **Stripe** | Работает с 2023 | 2,9 % + AED 1,10 | 0 / 0 | ✅ Payment Request API | ✅ | ✅ | Эталон, async SDK | 1–2 дня | Backup / fallback |
| **Telr** | Локальный с 2014 | 2,49 % + AED 0,50 | AED 99–349/мес | ✅ | ✅ | ✅ | Средний DX | 3–5 дн. | Альтернатива |
| **Checkout.com** | UAE-офис | Договорная ~2,5–3,0 % | Custom | ✅ | ✅ | ✅ | Очень хорошо | 7–14 дней | Не подходит для MVP |
| **PayTabs** | KSA-HQ, UAE | 2,85 % + AED 1 | $0–50/мес | ✅ | ✅ | ✅ | Средний | 2–4 дн. | Альтернатива для KSA-экспансии |
| **Network Int'l** | Локальный enterprise | Договорная | Custom | ✅ | ✅ | ✅ | Тяжёлая | 7–14 дней | Только для крупных |

**Юридические требования (общие):**
- Валидная **trade license** в UAE (mainland / DMCC / freezone)
- **Emirates ID** UBO
- Бизнес-банковский счёт в **AED**
- **MOA**, **VAT certificate** (если оборот > AED 375 000/год)
- **Domain association file** для Apple Pay
- KYC/AML по правилам CBUAE
- **3DS2 обязателен** для всех CNP-транзакций по правилам CBUAE + Visa/MC

**Итог:** Tap Payments — основной для MVP. Bridge `PaymentGateway` интерфейс закладывается в архитектуру, чтобы при необходимости подключить Stripe как fallback.

---

## 11. SMS-верификация в ОАЭ

| Провайдер | UAE +971 | Цена за SMS | Регистрация sender ID | HQ | Для MVP |
|---|---|---|---|---|---|
| **Twilio Verify** | ✅ | $0,05/верификация ИЛИ $0,1092/SMS-сегмент | $225 setup + $115/мес/sender ID | US/Ireland | ✅ Старт |
| **Unifonic** | ✅ | Контрактная (≈ $0,03–0,05/SMS UAE) | Включена в контракт, дешевле | Riyadh | ✅ Scale |
| **MessageBird (Bird)** | ✅ | $0,06–0,08/SMS | Платная | Amsterdam | Средне |
| **Vonage** | ✅ | $0,07–0,09/SMS | Платная | London | Средне |

**TDRA rules:**
- Промо-SMS — 07:00–21:00 UAE, обязательный префикс `AD-`
- Транзакционные (OTP, статусы) — **24/7 без префикса**
- Регистрация sender ID — обязательна (10–15 раб. дн.)
- Штрафы — до AED 400 000 за нарушение

**OTP-параметры:** 4 цифры, TTL 5 мин, лимит 3 повторных запроса/номер/15 мин, 5 попыток ввода. Хешировать в Redis (Argon2/bcrypt), не хранить plaintext.

---

## 12. Локализация и RTL (next-intl)

**Стек:**
- **next-intl** (next-intl.dev, GitHub amannn/next-intl, ~2 KB bundle) — нативная поддержка App Router и RSC, ICU message format, type-safe ключи
- **Файлы переводов:** `messages/{ru,en,ar}.json` в корне; структура по фичам: `common.*`, `auth.*`, `cart.*`, `checkout.*`, `product.*`
- На MVP — JSON-файлы; после MVP — миграция на **Crowdin** или **Localizely**

**RTL — корневой layout:**

```tsx
const RTL_LOCALES = ['ar'];

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <html lang={locale} dir={dir}>
      <body className={inter.variable}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**CSS-правила для RTL:**
- Использовать **logical properties:** `margin-inline-start` вместо `margin-left`, `padding-inline-end`, `inset-inline-start`
- Tailwind 3.3+ префиксы `ms-/me-/ps-/pe-/start-*/end-*`
- Зеркаление иконок направления: `[dir="rtl"] .icon-arrow { transform: scaleX(-1); }`
- **НЕ зеркалить:** логотипы, фото товаров, Apple Pay/Google Pay buttons, поля цифровых данных
- Шрифт AR: `IBM Plex Sans Arabic` / `Tajawal`

**URL-структура:** `/{locale}/...` — `/ru/menu`, `/en/menu`, `/ar/menu`. Middleware next-intl авто-детект по `Accept-Language` + cookie `NEXT_LOCALE`. Переключатель — в drawer/profile.

---

## 13. Curbside pickup — UX и реализация

### 13.1. Паттерны индустрии

- **Chick-fil-A, Casey's, Starbucks, Drinkit:** после оплаты — экран статуса с кнопкой «Я приехал / I'm here». Тап → push/SMS бариста + событие на админ-дашборд
- **Номер машины:** UAE-номера = пара букв эмирата + 1–5 цифр (например «O 12345», «Dubai A 12345»). На MVP — текстовое поле + dropdown эмирата
- **Геолокация:** опционально — браузер просит permission на экране статуса; если в радиусе 150 м — авто-prominent CTA «Я приехал»

### 13.2. Жизненный цикл curbside pickup

1. Клиент оплачивает → bypass от Tap webhook → бэк меняет статус на `PAID` → SSE-событие в админку
2. Бариста жмёт «Принять» → клиенту приходит push/обновление SSE
3. Бариста жмёт «Готов» → клиенту SMS «Ваш заказ готов, ждём у входа»
4. Клиент жмёт «Я приехал» → бариста видит подсвеченную карточку «Машина: O 12345»
5. Бариста выносит → жмёт «Выдан» → заказ закрыт

### 13.3. Уведомление бариста — сравнение вариантов

| Способ | Pros | Cons | Для MVP |
|---|---|---|---|
| **Звук в админ-PWA + SSE** | Бесплатно, real-time | Страница должна быть открыта на планшете | ✅ Основной |
| **Telegram-бот** | Дёшево, надёжный fallback | Зависит от Telegram | ✅ Дополнительно |
| **Web Push** | Стандарт, работает в фоне | HTTPS + service worker + permission | ⏸ V1.1 |
| **SMS бариста** | Гарантировано | Платно (~$0,05/SMS) | ❌ |
| **Чековый принтер** | Привычно для бариста | Дорого, лишнее железо | ❌ |

---

## 14. Технический стек и архитектура

### 14.1. Общая схема

```
┌──────────────────────┐     HTTPS/JSON     ┌──────────────────────┐
│  Next.js 15 (Vercel) │ ─────────────────► │  FastAPI (Docker)    │
│  - App Router        │                    │  - Python 3.12       │
│  - RSC + Client      │ ◄─── webhook ───── │  - async SQLAlchemy  │
│  - next-intl         │                    │  - Pydantic v2       │
└──────────────────────┘                    └──────┬───────────────┘
        │                                          │
        │ Apple/Google Pay,                        │
        │ tokenize → Tap                           ▼
        ▼                              ┌──────────────────────┐
┌──────────────────────┐               │  PostgreSQL 16       │
│  Tap Payments        │ ◄─── webhook  │  Redis 7 (OTP, SSE)  │
│  Twilio / Unifonic   │               │  S3 / Cloudinary     │
└──────────────────────┘               └──────────────────────┘
```

### 14.2. Frontend

- **Next.js 15** — App Router (`/app`), route group `[locale]` для i18n
- **RSC** для каталога (SEO + быстрый LCP), **Client Components** для интерактива (корзина, кастомизатор, OTP)
- **State management:** `Zustand` (~1 KB, persist в localStorage). Redux Toolkit для MVP overkill; React Context — медленнее на ребилдах корзины
- **Forms:** `react-hook-form` + `zod`
- **UI:** `shadcn/ui` + Tailwind v4 + кастомные компоненты (`DrinkCard`, `AddonRow`, `NumPad`, `BottomSheet`)
- **Анимации:** `framer-motion` (splash-transition, pill-tap scale, expand add-on-секций, bottom-sheet'ы)
- **Изображения:** `next/image` + Cloudinary (auto-WebP/AVIF) или S3 me-central-1
- **Иконки:** `lucide-react`
- **PWA:** `next-pwa` или ручной `manifest.json` + service worker для «установить на главный экран»
- **Telemetry:** GA4 + Yandex.Metrika + Sentry SDK

### 14.3. Backend

- **Python 3.12 + FastAPI 0.115+**, ASGI через `uvicorn` за `nginx`/`Caddy`
- **ORM:** SQLAlchemy 2.0 async + `alembic`
- **Validation:** Pydantic v2
- **Auth:** JWT access (15 мин) + refresh (30 дней) через httpOnly cookies, refresh-rotation
- **Async-задачи:** `BackgroundTasks` FastAPI на MVP; при росте — `arq` (Redis-based) или `Celery`
- **Кеш:** Redis для (a) OTP, (b) rate-limiting (`slowapi`), (c) webhook idempotency
- **Логи:** `structlog` + Sentry
- **Тесты:** `pytest` + `pytest-asyncio` + `httpx`

### 14.4. Real-time для админки

**SSE (Server-Sent Events)** — самый простой подход. FastAPI отдаёт `/admin/orders/stream` с `text/event-stream`, фронт админки слушает через `EventSource`. Дёшево, работает через nginx, не требует sticky sessions. Альтернатива (overkill для MVP) — Pusher / Ably.

### 14.5. Структура репозитория (monorepo)

```
/repo
├── apps/
│   ├── web/              # Next.js 15
│   │   ├── app/[locale]/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── messages/{ru,en,ar}.json
│   │   └── next.config.ts
│   └── admin/            # Опц. — отдельный Next.js или /admin внутри web/
├── services/
│   └── api/              # FastAPI
│       ├── app/
│       │   ├── api/v1/
│       │   ├── models/
│       │   ├── schemas/
│       │   ├── services/
│       │   ├── integrations/
│       │   │   ├── payments/   (tap.py, stripe.py)
│       │   │   ├── sms/        (twilio.py, unifonic.py)
│       │   │   └── storage/    (s3.py, cloudinary.py)
│       │   └── main.py
│       ├── alembic/
│       └── pyproject.toml
├── packages/             # (опц.) shared TS-types из OpenAPI
├── docker-compose.yml
└── README.md
```

### 14.6. Деплой

| Компонент | Где | Стоимость USD/мес |
|---|---|---|
| Frontend | **Vercel Pro** (Frankfurt edge) или Hobby на старте | $0–20 |
| Backend | **Hetzner CX22** (Falkenstein) или **DigitalOcean Bahrain** в Docker | $7–25 |
| PostgreSQL | Managed: **Neon** / **Supabase** / **DO Managed PG** | $15–30 |
| Redis | **Upstash** (free-tier хватает) | $0–10 |
| Object storage | **Cloudinary** или **AWS S3 me-central-1** | $0–10 |
| Sentry | Free 5k events | $0 |
| Домен + Cloudflare | | $10/год |
| **Итого инфры** | | **$30–80/мес** |

> ⚠️ **UAE PDPL** рекомендует хранение PII резидентов UAE в UAE/GCC, но для SMB пока не enforced жёстко. **Опционально:** AWS me-central-1 (Bahrain), Oracle Cloud Abu Dhabi.

---

## 15. Раздел I. Этапы разработки и сроки

### 15.1. Декомпозиция работ

| # | Этап | Содержание | Solo fullstack | Команда FE+BE |
|---|---|---|---|---|
| 0 | Дискавери | Финал ТЗ, Figma, list add-on'ов и цен, выбор шлюза, регистрация Tap | 1 нед / 16 ч | 1 нед / 24 ч |
| 1 | Дизайн-апрув | Доводка макетов для 13 клиент + 10 админ экранов, prototyping | 1 нед / 24 ч | 1 нед / 32 ч |
| 2 | BE foundation | FastAPI + DB-схема + Alembic + auth + модели каталога + seed | 1,5 нед / 60 ч | 1 нед / 40 ч |
| 3 | FE foundation | Next.js 15 + Tailwind + shadcn + i18n + layout + BNAV + splash + onboarding + выбор точки | 1,5 нед / 60 ч | 1 нед / 40 ч |
| 4 | Каталог + карточка товара | Главная, табы, карточка с add-on'ами, КБЖУ-калькулятор, корзина | 1,5 нед / 60 ч | 1 нед / 40 ч |
| 5 | Auth flow + checkout | Phone input, OTP, checkout-форма, car plate, time-picker | 1 нед / 40 ч | 0,5 нед / 20 ч |
| 6 | Tap Payments | Apple Pay Web SDK, Google Pay, hosted page, webhook + idempotency | 1 нед / 40 ч | 0,5 нед / 20 ч |
| 7 | Статус + SSE | Страница статуса, кнопка «Я приехал», real-time updates | 0,5 нед / 20 ч | 0,5 нед / 16 ч |
| 8 | Админка | Логин, kitchen-display, CRUD меню, аналитика, SSE-лента | 1,5 нед / 60 ч | 1 нед / 40 ч |
| 9 | Локализация | RU/EN переводы + RTL-readiness для AR | 0,5 нед / 16 ч | 0,5 нед / 16 ч |
| 10 | SMS | Twilio Verify, OTP-flow, notifications | 0,3 нед / 12 ч | 0,3 нед / 12 ч |
| 11 | QA + правки | Кросс-браузер, mobile devices, accessibility | 1 нед / 32 ч | 1 нед / 40 ч |
| 12 | Deploy + onboarding | Vercel + Docker + домен + SSL + monitoring + training | 0,5 нед / 16 ч | 0,5 нед / 16 ч |
| | **Итого** | | **~13 нед, ~456 ч** | **~7–8 нед, ~356 ч** (параллельно) |

> ⚠️ MVP **без полного AR-контента** (только RTL-readiness). С полной AR-локализацией + 1–2 недели + $300–800 на переводчика-носителя.

### 15.2. Критический путь
`Дизайн → BE auth → FE каталог → FE checkout → Tap → QA → Deploy`. Админку можно разрабатывать параллельно с клиентом, начиная со 2-й недели.

---

## 16. Раздел J. Стоимость

### 16.1. Сравнение по уровням исполнителей

Курсы: 1 USD ≈ 92 ₽ ≈ 3,67 AED. Объём — 400–600 ч.

| Уровень | Часовая ставка | Объём | Стоимость USD | Стоимость RUB | Стоимость AED |
|---|---|---|---|---|---|
| **Senior фрилансер РФ/СНГ** | $30–45/ч | 450 ч | **$13 500 – 20 000** | **1,24 – 1,84 млн ₽** | 49 500 – 73 000 AED |
| **Mid-level inhouse РФ/СНГ** (2 чел) | $20–30/ч | 450 ч | $9 000 – 13 500 | 830 тыс – 1,24 млн ₽ | 33 000 – 49 500 AED |
| **Агентство РФ/Беларусь** (PM + 2 dev + дизайнер + QA) | $40–60/ч blended | 600 ч | **$24 000 – 36 000** | **2,2 – 3,3 млн ₽** | 88 000 – 132 000 AED |
| **Агентство в UAE / Dubai** | $80–150/ч blended | 600 ч | $48 000 – 90 000 | 4,4 – 8,3 млн ₽ | 176 – 330 тыс AED |
| **Solo senior fullstack в EU** | $60–80/ч | 450 ч | $27 000 – 36 000 | 2,5 – 3,3 млн ₽ | 99 – 132 тыс AED |
| **Indian/SEA agency** | $20–35/ч blended | 600 ч | $12 000 – 21 000 | 1,1 – 1,9 млн ₽ | 44 – 77 тыс AED |

### 16.2. Рекомендуемый бюджет MVP

- **Оптимальный (best value):** **$15 000 – 25 000 ≈ 1,4 – 2,3 млн ₽ ≈ 55 – 92 тыс AED** — senior фрилансер РФ/СНГ + дизайнер part-time
- **Бюджет «бережно»:** $9 000 – 13 000 — двое mid-developers в СНГ, дизайн уже есть
- **Премиум:** $50 000+ — Dubai-агентство, обосновано только если важна локальная команда

### 16.3. Операционные расходы (мес)

| Статья | USD/мес |
|---|---|
| Vercel Pro | 20 |
| VPS (Hetzner / DO) | 10–25 |
| Managed PostgreSQL | 15–25 |
| Redis (Upstash) | 0–10 |
| Cloudinary | 0–10 |
| Tap Payments | 0 (только комиссия 2,75 %) |
| SMS (Twilio Verify) | ~$50 на 1000 OTP |
| Sentry | 0 (free tier) |
| Домен | $1 |
| **Итого инфра** | **$100–150/мес** |

Плюс комиссия Tap ≈ 2,75 %: при обороте 50 000 AED/мес → ~1 375 AED/мес ≈ $375.

### 16.4. Не входит в MVP-budget (доп.)

- Полный перевод на AR + ревью носителем — **$300–800** разово
- Профессиональная фотосъёмка напитков — **$500–1 500**
- Юридическое оформление (DMCC company + trade license, если нет) — **от $4 000**
- Маркетинг / launch-campaign — отдельно

---

## 17. Раздел K. Открытые вопросы и риски

### 17.1. Юридические

| # | Вопрос | Статус / рекомендация |
|---|---|---|
| K-01 | Есть **trade license** в UAE? | Без неё ни один шлюз не подключит. Запустить Tap-onboarding параллельно FE-разработке |
| K-02 | Юр. лицо: mainland, DMCC, IFZA, другой freezone? | DMCC/IFZA быстрее. Банковский счёт — Mashreq/Wio/RAK |
| K-03 | **VAT 5 %** — кто отвечает? | Если оборот > AED 375 000/год — обязательная регистрация в FTA. В MVP сразу VAT-line в чеках |
| K-04 | UAE PDPL — нужен DPO? | Для SMB обычно нет, но обязательны privacy policy + consent. Шаблон у юриста заказчика |
| K-05 | TDRA sender ID для SMS | 10–15 раб. дн., запустить параллельно |

### 17.2. Технические

| # | Риск | Митигация |
|---|---|---|
| K-06 | Где хостить бэк (data-residency) | Старт на Hetzner EU; при росте — миграция в AWS me-central-1. Terraform/docker-compose сразу |
| K-07 | Apple Pay требует HTTPS + domain verification | Заранее запросить у Tap domain association file, разместить в `/.well-known/apple-developer-merchantid-domain-association` |
| K-08 | iOS Safari может блокировать OTP autofill | Проверить на реальных устройствах, `autocomplete="one-time-code"` |
| K-09 | Geolocation в Safari требует user gesture | Кнопка «Рядом со мной» — явный tap |
| K-10 | Tap webhook latency | Idempotency-keys в Redis, retry-logic; UI «оплата проверяется» с poll |
| K-11 | Multi-tenant (несколько brand'ов) | На MVP single-tenant, в схеме БД заложено поле для `tenant_id` (миграция V2) |
| K-12 | RTL не протестирован без AR-перевода | QA с псевдо-локалью; все CSS — на logical properties с самого начала |
| K-13 | Время приготовления неизвестно бизнесу | Adjustable per-product `prep_time_min`, default 5 мин |

### 17.3. Продуктовые

| # | Вопрос | Кто решает |
|---|---|---|
| K-14 | Количество размеров (M only или S/M/L) | Заказчик до старта дизайна |
| K-15 | Финальный список add-on-категорий и SKU | Заказчик до старта дизайна |
| K-16 | КБЖУ-данные — где брать? | Заказчик, формат CSV → seed-script |
| K-17 | Кто переводит на EN и AR | Внешний переводчик ($200–500, 3–5 раб. дн.) + ревью носителем |
| K-18 | Брендинг: финальный лого, шрифт, точный hex primary | Дизайнер заказчика — на дискавери |
| K-19 | Curbside vs in-store pickup? | Рекомендация: оба, switch на checkout (default curbside) |
| K-20 | Заказы после закрытия точки | Авто-блокировка add-to-cart за 30 мин до закрытия |

### 17.4. Roadmap расширений (post-MVP)

- **V1.1:** Web Push, промокоды, Telegram-бот бариста, экспорт в CSV, dark theme
- **V1.2:** Полный AR-перевод + культурный аудит UI
- **V1.3:** Subscription (Coffeepass-аналог), подарочные карты
- **V2:** Native приложения (React Native / Capacitor над web), kiosk-mode для in-store
- **V2.1:** Multi-tenant, white-label для других juice bars

---

## 18. Приложения

### 18.1. Полезные ссылки

**Drinkit и Dodo:**
- https://drinkit.io/ — английский сайт (UAE/global)
- https://drinkit.ru/ — российский B2B-сайт
- https://apps.apple.com/us/app/drinkit-order-your-coffee/id1495622004 — App Store
- https://play.google.com/store/apps/details?id=ru.drinkit — Google Play
- https://www.behance.net/gallery/169741907/Drinkit-brand-identity — brand identity (открытый кейс)
- https://www.duamentes.com/success-stories/ux-guide-for-drinkit-in-uae/ — UX-исследование для UAE
- https://habr.com/en/companies/dododev/profile/ — Dodo Engineering на Хабре
- https://habr.com/ru/companies/dododev/articles/782922/ — статья «iOS CI / fastlane»
- t.me/dododev — Telegram-канал Dodo Mobile (134k подписчиков)

**Платежи:**
- https://developers.tap.company/ — Tap docs
- https://developers.tap.company/docs/apple-pay-web-sdk — Apple Pay Web SDK
- https://developers.tap.company/docs/get-started — Overview
- https://www.tap.company/en-ae/regulatory-licenses — лицензия CBUAE
- https://rulebook.centralbank.ae/en/rulebook/retail-payment-services-and-card-schemes-regulation — RPSCS Regulation CBUAE

**SMS:**
- https://www.twilio.com/en-us/sms/pricing/ae — Twilio UAE pricing
- https://www.unifonic.com/en/channels/sms — Unifonic
- TDRA — https://tdra.gov.ae

**Next.js / i18n:**
- https://next-intl.dev/docs/getting-started/app-router
- https://github.com/amannn/next-intl
- https://nextjs.org/docs/app

**UI старты:**
- https://ui.shadcn.com — shadcn/ui
- https://www.figma.com/community/file/1305198455555652896 — Drink ordering UI kit
- https://www.figma.com/community/file/1116708627748807811 — Coffee Shop Mobile App
- https://lucide.dev — иконки
- https://www.framer.com/motion/ — Framer Motion

### 18.2. Pre-launch checklist

- [ ] Подписан договор и финальное ТЗ
- [ ] Получены все Figma-макеты с dev-mode access
- [ ] У заказчика есть UAE trade license + банковский счёт в AED
- [ ] Подана заявка в Tap Payments
- [ ] Подана заявка на TDRA sender ID для SMS
- [ ] Получены КБЖУ-данные и финальный SKU-список
- [ ] Куплен и делегирован домен
- [ ] Получены доступы: GitHub, Vercel, Cloudinary, Sentry
- [ ] Согласован бренд-кит: лого, шрифты, точные hex
- [ ] Определены языки на launch (минимум RU + EN)
- [ ] Определены 2–3 пилотные точки выдачи
- [ ] Подготовлена privacy policy + terms of service (юрист)
- [ ] Apple Pay domain association file получен от Tap и размещён
- [ ] Стресс-тест на 100 одновременных заказов
- [ ] Sentry + Yandex.Metrika + GA4 подключены и валидируют события

---

**Документ готов к передаче разработчику для архитектурного проектирования и сборки прототипа. Все ключевые технические решения, эндпойнты, схемы БД, оценки трудозатрат и риски — описаны.**