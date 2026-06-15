# Juicy — Чеклист прогона и тестирования (по роадмапу)

> Чеклист привязан к **реальному коду**: бэкенд FastAPI (`backend/app/`) + фронт Next.js (`app/app/`).
> Сгенерирован прогоном по 10-дневному роадмапу. Покрытие: **51 эндпоинтов · 30 экранов · 10 дней**.
> Аудит «честности» прототипа нашёл **12 проблемных мест** (моки/мёртвые кнопки/несвязанные экраны) — см. §1.
> Дата: 2026-06-11.

**Структура:** §0 — как поднять стенд и аккаунты · §1 — приоритетный аудит моков/мёртвых кнопок · §2 — матрица бэкенд-связности ·
§3 — дизайн-система/UI · §4 — сквозные E2E-сценарии · §5 — нефункциональные (i18n/адаптив/доступность/роли/безопасность) ·
§6 — матрица приёмки · §7 — по-дневные чеклисты (Бэкенд / UI / User-flow / Приёмка) + бонус.

---

## 0. Как пользоваться чеклистом и как поднять стенд

### 0.1. Как пользоваться
- [ ] Каждый пункт вида `- [ ]` отмечай вручную после ручной проверки: открыл экран → выполнил действие → сверил с «ожидаемым результатом».
- [ ] Раздел 1 (аудит честности) — приоритетный: сначала отделить реально работающие экраны от моков/мёртвых кнопок, иначе остальные тесты дадут ложноположительный результат.
- [ ] Для каждой находки фиксируй: воспроизводится / не воспроизводится / расходится с картой.
- [ ] Сетевые проверки делай с открытой вкладкой DevTools → Network: реально ли уходит запрос к FastAPI (а не «фейк-тост» без запроса).

### 0.2. Запуск бэкенда (порт 8000)
- [ ] Поднять backend: `cd /Users/mak/drinkit/backend; python3 -m venv .venv && .venv/bin/pip install -r requirements.txt; .venv/bin/uvicorn app.main:app --reload`.
- [ ] Проверить health-check: `GET http://localhost:8000/health` → `{"status":"ok"}` (не зависит от БД).
- [ ] Убедиться, что БД и сиды создались автоматически на старте (lifespan): SQLite-файл `backend/juicy.db` (или `backend/grabzi_local.db` для grabzi-конфигурации). Alembic-миграций нет — схема через `Base.metadata.create_all`.
- [ ] Открыть Swagger: `http://localhost:8000/docs` (FastAPI, префикс `/api` у всех REST кроме `/health` и `/ws/*`).

### 0.3. Сиды (отдельная команда не нужна)
- [ ] Проверить, что `seed(db)` отработал автоматически (вызывается в lifespan, `backend/app/services/seed.py`, идемпотентно).
- [ ] Сид создаёт: 4 категории напитков (Фреши/Смузи/Детокс/Шоты), 28 published напитков + 1 draft, 16 добавок, 4 категории добавок (boosters=counter / fruits=multi / herbs=multi / base=single), 4 единицы измерения (g/ml/pcs/l), 2 staff-аккаунта.
- [ ] Учесть: тестовых заказов/клиентов сид НЕ создаёт; `UiTranslation` сидами НЕ заполняется.
- [ ] Чтобы пересоздать данные — удалить `backend/juicy.db` (или `backend/grabzi_local.db`) и перезапустить бэкенд.

### 0.4. Запуск фронта
- [ ] Вариант 1 — прототип `app/` (Next.js 16, порт 3000): `cd /Users/mak/drinkit/app; npm install; npm run dev`. ВНИМАНИЕ: исходный прототип позиционируется как frontend-only, но по карте `lib/api.ts`/`lib/adminApi.ts` реально ходят в FastAPI — проверять с поднятым бэком.
- [ ] Вариант 2 — `grabzi-web/`: `.env.local` с `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`, интегрирован с этим бэкендом.
- [ ] Проверить переменную фронта: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`; grabzi-web использует `http://127.0.0.1:8000`). От неё же строится `WS_URL` (http→ws).

### 0.5. Docker (опционально, PostgreSQL+Redis+backend)
- [ ] `docker compose up` из `/Users/mak/drinkit`, затем фронт отдельно.
- [ ] Учесть: backend в docker-compose НЕ имеет volume-mount исходников (образ из `./backend/Dockerfile`) — правки кода не подхватятся без пересборки.

### 0.6. Тестовые аккаунты
- [ ] Персонал (вход: `POST /api/staff/login` или UI `/admin/login`):
  - супер-админ — `admin@juicy.ae` / `admin123` (role=super_admin);
  - менеджер — `manager@juicy.ae` / `manager123` (role=manager).
- [ ] Клиент: регистрация по любому телефону формата `+<9-15 цифр>`. OTP по умолчанию ВЫКЛЮЧЕН (`AUTH_OTP_ENABLED=false`) — код не нужен, `/verify` проходит сразу. Если включить OTP — dev-код `1836` (`OTP_DEV_CODE`, возвращается в ответе как `devCode`). Предзаданных клиентских аккаунтов нет.

### 0.7. Ключевые env (`backend/.env.example`)
- [ ] `DATABASE_URL` (default `sqlite:///./juicy.db`).
- [ ] `REDIS_URL` (пусто = in-memory pubsub/OTP fallback).
- [ ] `JWT_SECRET` (default `dev-secret-change-me` — обязательно сменить в проде), `JWT_ALG=HS256`, `JWT_TTL_HOURS=720` (30 дней).
- [ ] `STRIPE_SECRET_KEY` (ПУСТО = mock-режим, оплата подтверждается сразу), `STRIPE_WEBHOOK_SECRET` (пусто = подпись webhook не проверяется).
- [ ] `AUTH_OTP_ENABLED` (default false), `OTP_DEV_MODE=true`, `OTP_DEV_CODE=1836`, `OTP_TTL_SECONDS=300`.
- [ ] `DEFAULT_LOCALE=ru`, `LOCALES=[ru,ar]`, `RATING_TIMEOUT_MINUTES=15`.

### 0.8. Как открыть клиента и админку
- [ ] Клиент: открыть корень `/` → сплэш-роутер редиректит по zustand-флагам (`/onboarding` → `/outlets` → `/home`).
- [ ] Админка: `/admin/login` → после входа super_admin → `/admin` (дашборд), manager → `/admin/orders`.
- [ ] Учесть раздельные токены в localStorage: клиент — `juicy-token`, персонал — `juicy-staff-token`.

---

## 1. Аудит «честности» прототипа (КРИТИЧНО)

### 1.1. Таблица всех находок из mockAudit

| Файл : строка | Тип | Серьёзность | Что не так | С чем связать / что должно быть |
|---|---|---|---|---|
| `app/admin/outlets/page.tsx` : 7,13-23,46,131-132 | mock-data | blocker | Вся страница «Точки» рендерит захардкоженный `adminOutlets` из `lib/admin-mock.ts`. Матрица «Меню × Точки» — псевдо-сид `((p.id.charCodeAt(2)+o.id.length)%20)`. «Создать точку» только пушит в локальный useState + тост. Клики по ячейкам матрицы (on/off/stop) живут только в стейте. | Нужны GET/POST `/api/admin/outlets` + PUT матрицы доступности. В backend нет ни одного outlet/location-роута — реализовать на бэке или честно скрыть экран. |
| `app/admin/outlets/[id]/page.tsx` : 7,17,34,55-81,144-150,164,171,201-202,215-218,234 | dead-button | blocker | Карточка точки полностью мок (outlet из `adminOutlets`, сотрудники из `staffUsers`). «Сохранить» только сбрасывает dirty + тост (PATCH не шлётся). «Закрыть точку», «Назначить сотрудника», «Сбросить overrides», «Массовый стоп», тоглы «В меню»/«В наличии» — только `toast()`. Сводка (42 заказа, 1.4k AED, «принтер online») — литералы в JSX. | GET/PATCH `/api/admin/outlets/{id}`, PUT расписания, POST/DELETE назначения сотрудника, PUT стоп-листа. Сводку — из `/api/admin/dashboard` по outletId. Эндпоинтов нет — реализовать или убрать. |
| `app/outlets/page.tsx` : 4,15,100-107 | hardcoded | major | Клиентский выбор точки рендерит захардкоженный `outlets` из `lib/data.ts` (фиктивные `distanceKm` 1.2/3.4/6.1/12.5). «Рядом со мной» не запрашивает геопозицию — просто сортирует по выдуманному distanceKm. Выбранная точка в zustand НЕ уходит в `POST /api/orders` (нет outletId). | GET `/api/outlets/locations` (отсутствует) + `navigator.geolocation`. `selectedOutletId` должен уходить в `POST /api/orders`. Сейчас выбор точки косметический. |
| `app/profile/page.tsx` : 18,126 | fake-fetch | major | Счётчик «Заказов» берётся из `s.orders` (локальный zustand), который после миграции store v2 всегда `[]` → счётчик всегда 0, хотя реальные заказы есть. | Брать число из `api.myOrders()` (GET `/api/orders`), как делает `app/orders/page.tsx`. |
| `app/profile/page.tsx` : 239-245,323-331 | dead-button | minor | Секция «Помощь»: «Условия использования», «Политика конфиденциальности», «Связаться с нами» — `<button>` без `onClick`. Кликаются, но ничего не делают. | Ссылки на реальные `/legal/*` или внешний URL; «Связаться» — чат/телефон. Либо убрать. |
| `app/auth/phone/page.tsx` : 115-116 | dead-button | minor | В тексте согласия ссылки «офертой» и «политикой» — `<a>` без `href`/`onClick`. | Проставить href на реальные документы или открывать в BottomSheet. |
| `app/admin/outlets/[id]/page.tsx` : 70,76,80 | hardcoded | major | Захардкоженные VAT TRN `100123456700003`, Latitude `25.184500`, Longitude `55.265700` — одинаковы для всех точек. | Грузить из записи точки (GET `/api/admin/outlets/{id}`) и сохранять PATCH. |
| `lib/admin-mock.ts` : 1-419 | mock-data | major | Файл-моков админки (staffUsers, adminOutlets, adminOrders, allergens, compatibilityRules, adminAddons, adminProductRows). Реально читают только `admin/outlets/*`; остальное — мёртвый мок, создаёт ложное впечатление готовых данных. | Удалить неиспользуемые экспорты; нужное для outlets — заменить на API. |
| `components/ProductCard.tsx` : 1-5,40 | mock-data | minor | Legacy-компонент импортирует `products`/`getProductVideo` из `lib/data.ts` и `productVideos`. Нигде не рендерится (везде `ApiProductCard`). Мёртвый код, тянет `DrinkMedia.tsx` и mock-видео. | Удалить `ProductCard.tsx`/`DrinkMedia.tsx` или переписать на `ApiDrinkLite`. |
| `lib/data.ts` : 72-624,631-648 | mock-data | minor | Большой захардкоженный каталог (products/categories/addonGroups/popularProductIds/productVideos/хелперы). Клиентские экраны уже на бэкенде (useCatalog, api.drink). Активно используются только `outlets[]` и `emirates[]`. | Удалить неиспользуемые экспорты каталога; `outlets[]` → в бэкенд; `emirates[]` можно оставить справочником. |
| `app/admin/outlets/[id]/page.tsx` : 89-95,210-221 | hardcoded | minor | «Сотрудники» с `lastLoginAt` из мока; в MenuTab «Кто менял»/«Когда» зашиты тернарниками по индексу строки (`Sergey M.`, `13:24`/`вчера`/`10:08`). Имитация аудита изменений. | Аудит-лог точки (нет эндпоинта). Часть общей blocker-проблемы экрана. |
| `app/auth/otp/page.tsx` : 19-25 | fake-fetch | minor | OTP-экран читает dev-код из `sessionStorage('juicy-dev-otp')` и через `setTimeout(...,2200)` автозаполняет поле, имитируя «пришедшую SMS». devCode приходит честно из ответа бэка только в dev. В проде самозаполнится, если бэк вернёт devCode. | Убедиться, что прод-`request-code` НЕ возвращает devCode; обернуть авто-fill в `process.env.NODE_ENV !== 'production'`. |

### 1.2. Чеклист «прозвонить каждый экран» (связь с бэкендом + мёртвые кнопки)

Клиентские экраны:
- [ ] `/` (`app/page.tsx`) — авто-редирект по zustand, без сети. Проверить: нет мёртвых кнопок (только редирект).
- [ ] `/onboarding` — без сети, чистый фронт. Кнопки «Пропустить/Начать/Дальше/свайп» — все connected (меняют index / `setOnboardingSeen` + redirect `/outlets`).
- [ ] `/outlets` — ❌ ПОДОЗРИТЕЛЬНЫЙ: данные из `lib/data.ts` (мок), API нет. «Поиск» (connected:false) и «Рядом со мной» (connected:false) — локальные, без сети/гео. Выбор точки в zustand НЕ уходит с заказом.
- [ ] `/home` — реальные GET `/api/categories`, `/api/drinks` (через `useCatalog`). Проверить состояния loading (скелетон 4 карточки), error («Сервер недоступен» + Повторить→`location.reload`), empty («В этой категории пока пусто»). Все кнопки connected.
- [ ] `/menu` — реальные `/api/categories`, `/api/drinks`. Состояния loading/error/empty присутствуют. Дублирует `/home` без hero.
- [ ] `/product/[slug]` — реальные GET `/api/drinks/{slug}` + POST `/api/drinks/{slug}/preview`. ВНИМАНИЕ: конструктор добавок (toggle/inc/dec, customName, «подробнее») — connected:false (локальный пересчёт, зеркало серверной формулы); единственная серверная зависимость — preview-цена при «В корзину». Проверить: фронтовый пересчёт совпадает с preview.
- [ ] `/cart` — нет прямых запросов; читает `getToken()` для гейта входа. Степпер количества — connected:false (локальный zustand). «Оформить» — connected (гейт `/auth/phone` vs `/checkout`).
- [ ] `/checkout` — реальные GET `/api/auth/me`, GET `/api/coupons`, POST `/api/orders`. ВНИМАНИЕ: PATCH `/api/auth/me` тут НЕ вызывается (профиль обновляется только локально `setUser`). Поля имя/эмират/машина и выбор купона — connected:false (локальные). Эмираты из `lib/data.ts`.
- [ ] `/payment` — реальный POST `/api/payments/checkout-session`. Ветка mock → `router.replace('/orders/{id}')`; real → `window.location=checkoutUrl`.
- [ ] `/orders` — реальный GET `/api/orders`. Для гостя (нет токена) `myOrders` не вызывается → экран «Войти». Состояния loading/empty/success.
- [ ] `/orders/[id]` — самый «живой»: GET `/api/orders/{id}` (+ polling 60с), WS `/ws/orders/{id}`, POST `/arrived`, POST `/rate`. Все 3 экшена реальные. Проверить refund-вид, unpaid-вид (повтор оплаты), модалку оценки + toast про купон.
- [ ] `/profile` — реальные GET `/api/coupons` + PATCH `/api/auth/me` (имя/машина/локаль). ❌ МЁРТВЫЕ: Условия/Политика/Связаться (без onClick), «Заказов» (локальный store = 0), «Любимая точка» (из data.ts).
- [ ] `/auth/phone` — реальные POST `/api/auth/request-code` (+ POST `/api/auth/verify` при `otpRequired===false`). NumPad, чекбокс оферты — connected:false. Ссылки «оферта/политика» — мёртвые `<a>`.
- [ ] `/auth/otp` — реальный POST `/api/auth/verify` (авто при 4 цифрах). ❌ «Отправить ещё раз» — connected:false (только перезапуск таймера, реального ресенда нет). Авто-fill из sessionStorage.
- [ ] `/auth/name` — реальный PATCH `/api/auth/me`. Чипы-подсказки имён — connected:false.

Админка:
- [ ] `/admin/login` — реальный POST `/api/staff/login`. Роутинг по роли.
- [ ] `/admin` (дашборд) — реальный GET `/api/admin/dashboard?from=&to=` + GET `/api/staff/me` (guard). Фильтр периода connected.
- [ ] `/admin/orders` — реальные GET `/api/admin/orders`, WS `/ws/admin/orders`, POST `/take`. Фильтры connected.
- [ ] `/admin/orders/[id]` — реальные GET `/api/admin/orders/{id}`, WS, POST `/take`, `/status`, `/refund`. Кнопки появляются по статусу.
- [ ] `/admin/customers` — реальные GET список, GET деталка, PATCH. «Закрыть drawer» — connected:false (локально).
- [ ] `/admin/payments` — реальный GET `/api/admin/payments`. Read-only, мутаций нет.
- [ ] `/admin/coupons` — реальные GET `/api/admin/coupons`, POST `/void`.
- [ ] `/admin/staff` — реальные GET `/api/staff/managers`, POST, DELETE.
- [ ] `/admin/outlets` — ❌ ПОЛНОСТЬЮ МОК (`lib/admin-mock.ts`), 0 API-вызовов. «Новая точка» и матрица — только локальный стейт. Реальна только навигация в деталку.
- [ ] `/admin/outlets/[id]` — ❌ ПОЛНОСТЬЮ МОК, 0 API. «Сохранить»/«Закрыть точку»/тоглы/«Назначить» — только toast. Реален только переход на `/admin/staff`.
- [ ] `/admin/catalog/categories` — реальные GET/POST/PATCH `/api/admin/catalog/drink-categories`.
- [ ] `/admin/catalog/products` — реальные GET drinks, GET drink-categories, POST drinks.
- [ ] `/admin/catalog/products/[slug]` — реальные GET drinks/drink-categories/addons, PATCH drinks, PUT bindings.
- [ ] `/admin/catalog/addons` — реальные GET addons/addon-categories/units, POST/PATCH addons.
- [ ] `/admin/catalog/groups` — реальные GET/POST/PATCH addon-categories, GET/POST units (units без update/delete из UI).

Итог раздела: подтвердить, что единственные зоны нечестности — раздел «Точки» в админке (`/admin/outlets/**`), клиентский выбор точки (`/outlets`), мёртвые help/legal-ссылки в `/profile` и `/auth/phone`, «Отправить ещё раз» в `/auth/otp`, счётчик «Заказов» в `/profile`, плюс мёртвый код (`ProductCard`/`DrinkMedia`/`lib/admin-mock`/большая часть `lib/data`).

---

## 2. Матрица бэкенд-связности (Экран → эндпоинты → статусы)

| Экран | Эндпоинты | loading | empty | error |
|---|---|---|---|---|
| `/` | — (zustand) | сплэш-логотип до редиректа | — | — |
| `/onboarding` | — | — | — | — |
| `/outlets` | ❌ нет (мок `lib/data.ts`) | нет (данные синхронные) | нет | нет |
| `/home` | GET `/api/categories`, GET `/api/drinks?category=` | скелетон 4 карточки | «В этой категории пока пусто» | «Сервер недоступен» + Повторить |
| `/menu` | GET `/api/categories`, GET `/api/drinks?category=` | скелетоны | «В этой категории пока пусто» | «Не удалось загрузить меню» + Повторить |
| `/product/[slug]` | GET `/api/drinks/{slug}`, POST `/api/drinks/{slug}/preview` | «Загрузка…» | — | «Напиток недоступен» + В меню (404) |
| `/cart` | ❌ нет прямых (читает `getToken()`) | нет | «Корзина пуста» + К меню | нет |
| `/checkout` | GET `/api/auth/me`, GET `/api/coupons`, POST `/api/orders` | телефон «…» до загрузки me | — | текст ошибки создания заказа |
| `/payment` | POST `/api/payments/checkout-session` | «Открываем оплату…» (processing) | — | текст + «заказ не оплачен, можно повторить» |
| `/orders` | GET `/api/orders` | «Загрузка…» | нет заказов (гость→Войти / клиент→Сделай первый) | (нет явного error) |
| `/orders/[id]` | GET `/api/orders/{id}` (+poll 60с), WS `/ws/orders/{id}`, POST `/arrived`, POST `/rate` | «Загрузка…» | — | при ошибке загрузки → `router.replace('/orders')` |
| `/profile` | GET `/api/coupons`, PATCH `/api/auth/me` | — | guest-вид «Войди в Juicy»; купоны скрыты если нет активных | — |
| `/auth/phone` | POST `/api/auth/request-code`, POST `/api/auth/verify` (при otp off) | sending | — | при ошибке всё равно ведёт на `/auth/otp` |
| `/auth/otp` | POST `/api/auth/verify` | idle (таймер 55с) | — | «Неверный код — попробуй ещё раз» |
| `/auth/name` | PATCH `/api/auth/me` | — | — | (кнопка disabled пока имя пусто) |
| `/admin/login` | POST `/api/staff/login` | busy «Входим…» | — | «Неверный email или пароль» |
| `/admin` | GET `/api/admin/dashboard`, GET `/api/staff/me` (guard) | «Загрузка…» | — | (через AdminShell guard) |
| `/admin/orders` | GET `/api/admin/orders`, WS `/ws/admin/orders`, POST `/take` | — | «Заказов нет» | — |
| `/admin/orders/[id]` | GET `/api/admin/orders/{id}`, WS, POST `/take`/`/status`/`/refund` | «Загрузка…» | — | — |
| `/admin/customers` | GET `/api/admin/customers`, GET `/{id}`, PATCH `/{id}` | (нет явных) | (нет явных) | (нет явных) |
| `/admin/payments` | GET `/api/admin/payments` | — | «Платежей нет» | — |
| `/admin/coupons` | GET `/api/admin/coupons`, POST `/void` | — | «Купонов пока нет» | — |
| `/admin/staff` | GET `/api/staff/managers`, POST, DELETE | — | — | toast успех/ошибка |
| `/admin/outlets` | ❌ нет (мок) | нет | нет | нет |
| `/admin/outlets/[id]` | ❌ нет (мок) | нет | нет | нет |
| `/admin/catalog/categories` | GET/POST/PATCH drink-categories | — | — | toast |
| `/admin/catalog/products` | GET drinks, GET drink-categories, POST drinks | — | — | toast |
| `/admin/catalog/products/[slug]` | GET drinks/drink-categories/addons, PATCH drinks, PUT bindings | «Загрузка…» | — | клиентская валидация порций + toast |
| `/admin/catalog/addons` | GET addons/addon-categories/units, POST/PATCH addons | — | — | toast |
| `/admin/catalog/groups` | GET/POST/PATCH addon-categories, GET/POST units | — | — | toast |

Подозрительные экраны (0 запросов к бэку):
- [ ] `/outlets` — единственный клиентский шаг без API; данные из `lib/data.ts`, выбор не уходит с заказом.
- [ ] `/admin/outlets` и `/admin/outlets/[id]` — полностью мок, ни одного запроса; все мутации = toast.
- [ ] `/cart` — без прямых запросов оправдан (локальная корзина в zustand), но проверить, что переход в `/checkout` далее реально создаёт заказ.

---

## 3. Аудит дизайн-системы и UI-аккуратности

### 3.1. Токены и две параллельные системы
- [ ] Проверить, что бренд-цвет индиго `#4A56E2` и бежевый объявлены ДВАЖДЫ: клиент `app/app/globals.css` (`--color-primary-500` и пр.) и админка `app/app/admin/admin.css` (`--a-accent` и пр., scoped на `.admin-shell`). Правка бренда требует двух мест — риск рассинхрона.
- [ ] Типографика заданы utility-классами (`.text-display/.text-h1/.../.hero-title`), а не переменными.
- [ ] Шрифт Manrope грузится в `app/layout.tsx` как `--font-sans`, но `html,body` в globals.css задаёт свой стек и НЕ ссылается на `--font-sans` → Manrope применяется только в `.admin-shell` и там, где явно `font-[var(--font-sans)]`. Проверить визуально рассинхрон шрифта между экранами.
- [ ] Отступы/радиусы/высоты НЕ токенизированы: «магические» 56px (`.btn-pill`), chip 36px, topbar 64px зашиты в компонент-классах.

### 3.2. Консистентность
- [ ] Нет единого Button: ~19 `.btn-pill` против ~34 ad-hoc круглых `<button>` на чистом Tailwind. В `admin/orders/page.tsx` кнопки-фильтры красятся инлайном `style={{background:'#4A56E2'}}` (хардкод вместо `--a-accent`).
- [ ] «Нейтральная поверхность» `#F4F4F7`/`#F2F2F4` встречается 30+ раз без токена; `.btn-soft` — третий оттенок `#F1F1F3`. Три близких серых без имени.
- [ ] Разнобой бежевых: `#F5EFE7`(admin bg), `#F5F2EA`(admin/login), `#FAF6F0`(panel-soft), `#F4EEE4`(карточки), `#FAFAFA`(surface), `#ECECEE`(рамка десктопа) — 6 близких кремовых.
- [ ] Инлайн-стили вместо токенов: ~19 файлов клиента и ~15 админки. Особо: `admin/orders/page.tsx`, `admin/login/page.tsx` (весь экран инлайн, фон `#F5F2EA`), `AdminUI` Toast/ConfirmDialog (целиком инлайн с хардкод-палитрой).
- [ ] Два паттерна для одного `+/-` контрола: `Counter.tsx` (текстовые `−`/`+`) против `StepperButton.tsx` (SVG-глифы). Должен остаться один.
- [ ] `ProductCard` и `ApiProductCard` дублируют верстку; фон у первого из `product.bgColor`, у второго из локального `BG[]`.
- [ ] Высоты контролов не унифицированы: инпуты h-14(56)/h-12(48)/h-10(40) вперемешку (profile/checkout), pill 56, chip 36.

### 3.3. Адаптив
- [ ] Клиент — фиксированный телефонный фрейм `.mobile-frame` (max-width 390px, height 100dvh). Единственный брейкпоинт: при ширине ≥391px — «телефон на столе» (фон `#ECECEE`, рамка 28px).
- [ ] Проверить: во всём клиентском коде 0 Tailwind-респонсив-префиксов (`sm:/md:/lg:/xl:`). На планшете/десктопе контент не растёт.
- [ ] Админка — desktop-only: fixed grid 240px sidebar + 1fr, drawer 540px, ConfirmDialog 440px, search 300px. Нет media-query → на телефоне сайдбар+контент поедут, таблицы (`white-space:nowrap` в th) переполнят. Проверить неюзабельность админки на узком экране.
- [ ] Safe-area учтена (`.pb-safe/.pt-safe/.mb-safe` через `env(safe-area-inset-*)`, `viewportFit:cover`) — проверить на iOS-нотче.

### 3.4. Доступность
- [ ] Контраст: `.tab-text` неактивная вкладка `rgba(0,0,0,0.32)` ≈ 2.6:1 — НЕ проходит WCAG AA. `.tab-text-on-media` `rgba(255,255,255,0.55)` держится только на text-shadow.
- [ ] Muted `#6B7280` ≈ 4.9:1 ок, но часто на мелком 11-13px caption/tiny.
- [ ] Фокус: массово `outline-none` без замены фокус-кольца (product, checkout, profile, outlets) — фокус потерян для клавиатуры. Исключение — `auth/name` (есть `focus:ring-2`). Глобального `:focus-visible` для кнопок/ссылок нет.
- [ ] В админке наоборот — `.admin-input/.select/.admin-search` дают видимый focus (ring rgba(74,86,226,.10)).
- [ ] Тач-цели: pill 56px ок; `StepperButton` 32px, chip 36px, `.tab-text` 32px — ниже рекомендуемых 44px.
- [ ] Alt/семантика: `<img>` в `ApiProductCard`/home/cart с `alt=""` (для карточки товара лучше осмысленный alt с названием). BottomSheet/Modal/ConfirmDialog — бэкдроп `<div onClick>` без `role=dialog`/`aria-modal`/фокус-трапа (Modal закрывается по Escape, но без возврата фокуса).
- [ ] Плюсы для проверки: TopBar-кнопки имеют `aria-label`; Toast обёрнут в `aria-live=polite`. Иконочные кнопки нав/StepperButton/Counter — без aria-label (пусты для скринридера).

---

## 4. Сквозные user-flow сценарии (E2E)

### Сценарий A. Клиент: онбординг → каталог → конфигуратор → корзина → вход → оплата → статусы → получение
1. [ ] Открыть `/` свежим браузером → ожидание: сплэш → редирект `/onboarding` (нет `onboardingSeen`). Проверка: пройти слайды, «Начать» → `/outlets`.
2. [ ] `/outlets`: выбрать точку → `/home`. Проверка: выбор сохраняется в zustand (ВНИМАНИЕ: не уйдёт в заказ — это известный мок). Назад/обновление: после выбора повторный заход `/` ведёт сразу `/home`.
3. [ ] `/home`: переключить чип категории → URL `?category=ID`, грид перезапрашивается (`/api/drinks?category=`). Проверка: видны только published напитки; loading-скелетон при медленной сети; error-вид при выключенном бэке + «Повторить».
4. [ ] Открыть карточку → `/product/{slug}` (GET `/api/drinks/{slug}`). Проверка: видео muted/loop, КБЖУ, чипы категорий добавок (только активные).
5. [ ] Конфигуратор: добавить добавки, менять порции. Проверка: тип выбора соблюдается (single=1/1, multi=N по 1, counter в [min,max]); live-цена и КБЖУ растут; при «В корзину» вызывается POST `/preview` — серверная цена СОВПАДАЕТ с фронтовой.
6. [ ] «В корзину» → toast → `router.back()`. Добавить вторую позицию. Проверка: корзина в localStorage сохраняется между визитами.
7. [ ] `/cart`: изменить количество (+/−), удалить позицию, сверить итог. Проверка: пустая корзина → «Корзина пуста» + К меню.
8. [ ] «Оформить» как гость → редирект `/auth/phone?next=/checkout`. Проверка гость↔клиент: корзина сохраняется.
9. [ ] `/auth/phone`: ввести `+971...`, согласие, «Получить код». При OTP off → мгновенный `verify`+`setToken` → роутинг на `/auth/name`|next. При OTP on → devCode в sessionStorage → `/auth/otp`. Проверка ошибки сети: всё равно ведёт на `/auth/otp` (graceful).
10. [ ] `/auth/otp` (если OTP on): авто-verify при 4 цифрах; неверный код → «Неверный код», сброс. «Отправить ещё раз» — только таймер (реального ресенда нет).
11. [ ] `/auth/name`: ввести имя → PATCH `/api/auth/me` → возврат на `next` (`/checkout`).
12. [ ] `/checkout`: телефон предзаполнен из `me`; ввести имя/эмират/номер авто; выбрать купон+позицию (если есть). Проверка: без carPlate → 422 CAR_PLATE_REQUIRED; «Перейти к оплате» → POST `/api/orders` → `/payment?orderId=&total=`. ВНИМАНИЕ: профиль тут сохраняется только локально (PATCH не шлётся).
13. [ ] `/payment`: «Оплатить через Stripe» → POST `/checkout-session`. Mock-ветка → `/orders/{id}` (оплата подтверждена сразу). Real-ветка → редирект на Stripe; оплата = только webhook. Проверка ошибки: заказ не помечается оплаченным локально, «можно повторить».
14. [ ] `/orders/{id}`: статус-степпер по единой модели. Проверка realtime: при смене статуса менеджером приходит WS `/ws/orders/{id}` без перезагрузки (+ polling 60с подстраховка).
15. [ ] «Я на месте» после оплаты → POST `/arrived` (идемпотентно). Проверка: до оплаты 409 ORDER_NOT_PAID; для completed/refund 409 ORDER_FINISHED.
16. [ ] После прибытия/завершения — оценка 👍/👎 → POST `/rate`. Проверка: dislike → toast про купон (купон создаётся active); повторная оценка → 409 ALREADY_RATED; до прибытия/completed → 409 ORDER_NOT_RATABLE.
17. [ ] `/orders`: заказ в списке со статусом. `/profile`: купон виден в секции купонов (GET `/api/coupons`).

Проверки устойчивости для сценария A:
- [ ] «Назад» в браузере на каждом шаге не теряет корзину/токен.
- [ ] Обновление страницы (F5) на `/orders/{id}` восстанавливает статус из REST (WS только будущие события).
- [ ] Гость↔клиент: logout (`/profile`) чистит `juicy-token`, заказы скрываются → гость-вид на `/orders`.
- [ ] Ошибка сети на `/home`/`/menu` → error-вид + Повторить; на `/checkout` → текст ошибки, заказ не создан.

### Сценарий B. Персонал/админ: вход → каталог (drag-drop медиа) → заказы → дашборд
1. [ ] `/admin/login`: войти `admin@juicy.ae`/`admin123` → `/admin`; войти `manager@juicy.ae`/`manager123` → `/admin/orders`. Проблема ролей: проверить, что menager НЕ видит разделы super_admin.
2. [ ] `/admin/catalog/categories`: создать категорию (POST), переименовать RU/AR, тоггл активности (PATCH). Проверка: деактивация скрывает категорию и её напитки/добавки на публичной витрине сразу. ВНИМАНИЕ (из карты эндпоинтов): PATCH ведёт себя как PUT — непереданные поля затираются дефолтами.
3. [ ] `/admin/catalog/groups`: создать категорию добавок с типом выбора (single/multi/counter), создать единицу. Проверка: при PATCH addon-categories selectionType НЕ валидируется — попытаться записать мусор и проверить, ломает ли витрину preview.
4. [ ] `/admin/catalog/addons`: создать/редактировать добавку (КБЖУ/100, цена, ед., категория), тоггл активности. Проверка: деактивация скрывает добавку у всех напитков сразу; снятие/добавление не влияет на снэпшоты оформленных заказов.
5. [ ] `/admin/catalog/products` → создать черновик → `/admin/catalog/products/[slug]`: вкладка Основное (статус draft/published/hidden, медиа, цена, КБЖУ) → PATCH; вкладка Добавки → PUT bindings (цена override, min/default/max, объём). Проверка drag-and-drop медиа (требование Дня 8): загрузка фото/видео без ручной вставки ссылок — ВНИМАНИЕ: по интеграциям загрузка файлов не реализована, URL задаются строкой. Зафиксировать расхождение.
6. [ ] Проверка валидации bindings: нарушить `0<=min<=default<=max` → 422 PORTIONS_RANGE_INVALID (старые связки сохраняются, т.к. ошибка до clear). Пустой массив [] удаляет все связки.
7. [ ] Опубликовать напиток → проверить, что он сразу появился на публичной витрине `/home`.
8. [ ] `/admin/orders`: фильтры активные/завершённые/менеджер (все/мои/без менеджера). Проверка: видны ТОЛЬКО paid-заказы; индикатор «клиент на месте» (arrived) подсвечивает строку.
9. [ ] `/admin/orders/{id}`: «Взять в работу» → POST `/take` (status→in_progress, manager_id закреплён). Проверка: клиент сразу видит изменение по WS. Повторный take → 409 INVALID_TRANSITION.
10. [ ] Цепочка статусов: «Готово» → POST `/status` ready (только из in_progress); «Передан» → completed (только из ready). Проверка: new→ready напрямую → 409; завершить минуя ready → 409.
11. [ ] «Оформить возврат» (+причина) → POST `/refund` (только из completed). ВНИМАНИЕ (баг из карты): создаются ДВА события (status_change + refund), реальный Stripe Refund не вызывается, применённый купон не возвращается. Зафиксировать.
12. [ ] `/admin/customers`: открыть деталку (заказы/платежи/купоны), отредактировать имя/машину (PATCH).
13. [ ] `/admin/payments`: реестр всех платежей (включая pending/failed/refunded), валюта AED, переход по `#номер` → `/admin/orders/{id}`.
14. [ ] `/admin/coupons`: аннулировать активный купон (POST `/void`). Проверка: void used/void → 409 COUPON_NOT_ACTIVE.
15. [ ] `/admin/staff`: создать менеджера (POST), деактивировать (DELETE soft-delete). Проверка: нельзя удалить себя → 409 CANNOT_DELETE_SELF.
16. [ ] `/admin`: дашборд 9 метрик (revenue/ordersCount/drinksSold/avgDrinksPerOrder/avgOrderValue/ordersByHour/topProducts/topCustomers). Фильтр периода (Всё время/Сегодня/7д/30д). Проверка: только paid-заказы; ordersByHour в UTC (пики смещены относительно UAE); topProducts по drink_name-снэпшоту (разные локали = разные строки).

Проверки устойчивости для сценария B:
- [ ] Обновление `/admin/orders` — список перезапрашивается; WS восстанавливается.
- [ ] Два менеджера берут один new-заказ — гонка take (нет optimistic lock, последний перезаписывает manager_id, оба 200).
- [ ] Ошибка сети при действии — toast ошибки, статус не меняется.
- [ ] Раздел `/admin/outlets/**` — все «сохранения» = toast без персиста (мок), зафиксировать как нерабочий.

---

## 5. Нефункциональные проверки

### 5.1. i18n RU/AR + RTL
- [ ] Поддерживаются `['ru','ar']`, default `ru`. Неизвестная локаль (например `en`) тихо нормализуется в `ru` (pick_locale/t).
- [ ] Переключатель языка RU/AR в `/profile` → PATCH `/api/auth/me` (locale). При создании юзера locale фиксируется; ВНИМАНИЕ: существующему юзеру при verify locale НЕ обновляется.
- [ ] Контент в JSON-полях с fallback на default-локаль при отсутствии перевода (PUB-A-09 AC7).
- [ ] Проверить RTL для AR (зеркальная вёрстка) — требование Дня 10; проверить, реализовано ли (в design нет упоминания RTL-стилей → зафиксировать расхождение, если нет).
- [ ] Админ-интерфейс EN; индикатор непереведённых AR-полей (оранжевая рамка в categories/products/addons).
- [ ] ADM-S-11 (управление переводами UiTranslation): модель есть, эндпоинтов НЕТ, сидами не заполняется — зафиксировать как нереализованное.

### 5.2. Адаптив и доступность
- [ ] (см. раздел 3) Клиент только под 390px; админка desktop-only. Проверить на реальном мобильном/планшете.
- [ ] Фокус-кольца, контраст вкладок, тач-цели, role/aria модалок — по чеклисту 3.4.

### 5.3. Обработка ошибок / оффлайн
- [ ] Выключить бэкенд → `/home`/`/menu` показывают error-вид + Повторить; `/checkout` — текст ошибки; `/orders/{id}` — `replace('/orders')`.
- [ ] Глобальный exception handler ловит ValueError → 422 `{code:VALIDATION_ERROR}`.
- [ ] WS-обрыв: проверить heartbeat ping каждые 25с; при нескольких инстансах бэка in-process pubsub НЕ доставит события (нужен Redis) — realtime сломается.
- [ ] Брошенная/неуспешная оплата (Q12): заказ остаётся pending, повтор оплаты доступен из `/orders/{id}`.

### 5.4. Роли и доступы (что НЕ должно быть доступно)
- [ ] Клиент (customer JWT) НЕ должен попадать в staff-эндпоинты: `/api/staff/me`, `/api/admin/*` → customer-токен даёт 403 FORBIDDEN.
- [ ] Менеджер (role=manager) НЕ должен иметь доступ к super_admin-разделам: `/api/staff/managers*`, весь `/api/admin/catalog/*`, `/api/admin/dashboard`, `/api/admin/customers*`, `/api/admin/payments`, `/api/admin/coupons*`, void → 403. В UI разделы скрыты (route-guard в admin/layout).
- [ ] ВАЖНО: `/api/admin/orders/*` (лента и управление take/status/refund) доступны ЛЮБОМУ staff (manager тоже) — проверить, что это намеренно.
- [ ] Staff-токен на клиентских client-эндпоинтах (`/api/auth/me`) → 403 (kind != customer).
- [ ] Чужой заказ клиента (`/api/orders/{id}` с чужим user_id) → 404 (маскировка, не 403).

### 5.5. Безопасность (прямой вызов эндпоинтов)
- [ ] КРИТИЧНО: `POST /api/payments/webhook` без `STRIPE_WEBHOOK_SECRET` НЕ проверяет подпись → отправить `checkout.session.completed` с чужим order_id/payment_id вручную → проверить, что заказ помечается paid (подделка оплаты). Зафиксировать как блокер для прода.
- [ ] КРИТИЧНО: оба WS (`/ws/orders/{id}`, `/ws/admin/orders`) без авторизации. order_id предсказуем (autoincrement) → подписаться на чужой заказ и на всю ленту админки без токена → утечка статусов/номеров/прибытия.
- [ ] КРИТИЧНО: при `AUTH_OTP_ENABLED=false` вход по телефону БЕЗ кода → захват аккаунта по одному номеру (`/api/auth/verify` без regex-валидации phone).
- [ ] JWT secret default `dev-secret-change-me`, OTP dev-code `1836` захардкожены; `otp_dev_mode` возвращает код в ответе как `devCode` — проверить, что прод НЕ возвращает devCode.
- [ ] Прямой вызов admin-эндпоинтов без токена → 401 AUTH_REQUIRED (HTTPBearer auto_error=false → отсутствие заголовка даёт 401, не 403).
- [ ] Брутфорс: нет rate-limit на `/api/staff/login`, `/api/auth/request-code` (спам OtpCode).
- [ ] Купоны (хрупкая логика): double-spend — один active-купон привязать к нескольким заказам между created и paid (used ставится только при mark_paid); void не защищает уже созданный неоплаченный заказ; couponItemIndex без couponId помечает paid_by_coupon без скидки. Прозвонить.
- [ ] CORS открыт для всех origins/methods/headers — зафиксировать.
- [ ] Гонки: `next_order_number = max+1` без блокировки → параллельные заказы могут дать дубль number → 500 (unique).

---

## 6. Матрица приёмки / sign-off

| Требование / День роадмапа | Статус (ОК/Грань/Нет) | Заметка |
|---|---|---|
| День 1: инфраструктура, JWT, каркас WS/Stripe-webhook, вход в админку | Грань | Каркасы есть (`/health`, auth, staff, ws, payments mock). Риски: JWT secret и OTP-code захардкожены. |
| День 2: каталог (категории/список/деталка с видео) PUB-G-01/02 | ОК | `/api/categories`, `/api/drinks`, `/api/drinks/{slug}`; экраны home/menu/product реальны. Неопубликованный → 404. |
| День 3: конструктор добавок + live-пересчёт PUB-G-03 | ОК | `/preview` — источник правды, переиспользуется в create_order. Проверить совпадение фронт↔бэк. |
| День 4: корзина + вход по телефону PUB-G-05/04 | Грань | Корзина в localStorage ок; вход — но при OTP off захват по номеру; «Отправить ещё раз» в otp не ресендит. |
| День 5: оформление + Stripe + чек с VAT 5% PUB-A-01/02 | Нет | Оплата/webhook есть (mock). VAT 5%: в модели Order только subtotal/coupon_discount/total — отдельной строки VAT НЕТ. Acceptance-риск Q14. |
| День 6: realtime статусы + «Я приехал» + профиль/guards PUB-A-03/06/08 | ОК | WS `/ws/orders/{id}`, `/arrived` идемпотентно, PATCH `/me`. Риск: WS без авторизации; realtime на 1 инстанс. |
| День 7: мои заказы + каркас админки/роли PUB-A-07, ADM-S-06 | ОК | `/api/orders`, staff login/managers CRUD; soft-delete; нельзя удалить себя. |
| День 8: админ-каталог + drag-drop медиа ADM-S-01..05 | Грань | CRUD каталога реален. Drag-and-drop загрузка медиа НЕ реализована (URL строкой, S3 нет) — расхождение с AC. PATCH ведут себя как PUT. |
| День 9: админ-заказы (фильтры/take/статусы/история/состав) + дашборд ADM-M-01..05, ADM-S-10 | Грань | Заказы и дашборд реальны. Бонус «рабочие часы точки»: модели working_hours/outlet НЕТ — не реализовано. ordersByHour в UTC. |
| День 10: клиенты+платежи + i18n RU/AR (RTL) + публичный запуск ADM-S-08/09, PUB-A-09, ADM-S-11 | Нет | Клиенты/платежи реальны. RTL/переводы контента — проверить; ADM-S-11 (UiTranslation эндпоинты) НЕ реализован. Боевые Stripe-ключи — к запуску. |
| Опции O1/O2 (лояльность/реестр купонов) | Грань | Заготовки в коде (`routers/coupons.py`, admin coupons void) есть, но вне сметы 500к. |
| Опция O6 (refund ADM-M-06) | Грань | Endpoint есть, но баг: двойное событие, реальный Stripe Refund не вызывается, купон не возвращается. |
| Раздел «Точки» (клиент `/outlets` + админ `/admin/outlets/**`) | Нет | Полностью мок (`lib/data.ts`, `lib/admin-mock.ts`), эндпоинтов outlets/locations нет, outletId не уходит с заказом. |
| Безопасность прода (webhook-подпись, WS-auth, OTP, JWT-secret) | Нет | 4 критических риска (см. 5.5): подделка оплаты, утечка через WS, захват аккаунта, дефолтные секреты. Блокеры для прод-запуска. |

---

## 7. Чеклисты по дням роадмапа (День 1–10)

### День 1 — Фундамент и дизайн-система (инфраструктура + дизайн 9 экранов) (Строка №1 Инфраструктура и окружение (репозиторий, БД, деплой, JWT-авторизация, каркас WebSocket и Stripe-webhook) — 10/2/0 · 12 ч + строка №13 Дизайн 9 новых экранов — 0/0/4 · 4 ч. Итого 16 ч · 40 000 ₽ (Б10/Ф2/Д4).)

**Бэкенд**
- [ ] `GET /health` возвращает 200 `{"status":"ok"}` без обращения к БД (главное — сервис поднялся).
- [ ] `GET /health` отвечает 200, даже если БД/сиды в нестабильном состоянии (не зависит от состояния БД).
- [ ] `POST /api/auth/request-code` с дефолтом `auth_otp_enabled=false` отдаёт `{sent:false, otpRequired:false}`, devCode НЕ возвращается.
- [ ] `POST /api/auth/request-code` валидирует телефон по regex `^\+\d{9,15}$`: телефон без `+` или с буквами → 422 VALIDATION_ERROR.
- [ ] `POST /api/auth/verify` при выключенном OTP создаёт/находит User по phone и выдаёт JWT (kind=customer, ttl 30 дней), `created` корректен.
- [ ] `GET /api/auth/me` с валидным customer-JWT отдаёт `{id,phone,name,carPlate,emirate,locale}`.
- [ ] `GET /api/auth/me` без токена / с битым токеном → 401 AUTH_REQUIRED; со staff-токеном → 403 FORBIDDEN.
- [ ] `POST /api/staff/login` с сид-учёткой `admin@juicy.ae`/`admin123` выдаёт JWT (kind=staff, role=super_admin) и `staff{...}`.
- [ ] `POST /api/staff/login` с неверным паролем / несуществующим email / disabled → 401 INVALID_CREDENTIALS (единый код, не раскрывает существование email).
- [ ] `GET /api/staff/me` с staff-JWT отдаёт профиль; с customer-токеном → 403 FORBIDDEN.
- [ ] WS `/ws/orders/{order_id}` принимает соединение и шлёт heartbeat `{type:'ping'}` каждые 25с.
- [ ] WS `/ws/admin/orders` принимает соединение и шлёт ping каждые 25с.
- [ ] `POST /api/payments/webhook` без `STRIPE_WEBHOOK_SECRET` принимает запрос и возвращает `{received:true}` (mock-каркас, подпись не проверяется).

**Фронтенд / UI**
- [ ] `/admin/login` (app/app/admin/login/page.tsx) рендерит форму email/пароль, показывает состояние busy «Входим…» и error «Неверный email или пароль».
- [ ] Кнопка «Войти» реально вызывает `adminApi.login`, сохраняет `juicy-staff-token`, редиректит по роли (super_admin → /admin, manager → /admin/orders).
- [ ] `/admin` (app/app/admin/page.tsx + admin/layout.tsx) открывается как каркас под AdminShell, guard через `GET /api/staff/me`.
- [ ] Дизайны 9 новых экранов (купоны, оценка, категории, ед.изм., клиенты, платежи, локализация, реестр купонов, возврат) подготовлены как референс.

**User-flow**
- [ ] Развёртывание одной командой `docker compose up` поднимает backend, health-check проходит / открывается `/docs`.
- [ ] При старте backend автоматически создаётся схема (create_all) и выполняются сиды (services/seed.py), повторный старт идемпотентен (не дублирует данные).
- [ ] Логин персонала → переход в админку → обновление страницы /admin сохраняет сессию (токен в localStorage).
- [ ] Выход из админки (AdminShell logout) чистит `juicy-staff-token` и возвращает на /admin/login.

**Требования (приёмка)**
- [ ] Приложение разворачивается одной командой (docker-compose.yml в корне), backend поднимается, проходит health-check / открывается /docs.
- [ ] Настроены БД и создание схемы (backend/app/core/db.py, модели catalog/orders/users), есть сид-данные (services/seed.py).
- [ ] Работает JWT-авторизация: получен токен и дёрнут `GET /api/auth/me`; конфиг JWT в core/config.py (jwt_secret/alg/ttl).
- [ ] Есть вход в админку: /admin/login → `POST /api/staff/login` возвращает токен, открывается каркас /admin.
- [ ] Подняты каркасы интеграций: WS `/ws/*` отвечают, Stripe-webhook `POST /api/payments/webhook` принимает запрос (mock-режим без ключа).
- [ ] Готов набор дизайнов 9 новых экранов как референс для последующих дней.

---

### День 2 — Каталог напитков (витрина): категории + список + деталка с видео (Строка №2 Каталог: категории с бэкенда + список напитков + деталка с видео — 8/6/0 · 14 ч · 35 000 ₽. US: PUB-G-01, PUB-G-02.)

**Бэкенд**
- [ ] `GET /api/categories` отдаёт только `is_active` категории, отсортированные по `sort`, с локализованными именами.
- [ ] `GET /api/categories?locale=ar` локализует имена; неизвестная локаль (`en`) тихо нормализуется в `ru` (pick_locale).
- [ ] `GET /api/categories` при пустом результате отдаёт `[]` со статусом 200.
- [ ] `GET /api/drinks` возвращает только `status=published` напитки; draft/hidden не отдаются.
- [ ] `GET /api/drinks?category={id}` фильтрует по category_id; несуществующая/неактивная категория → пустой список (без проверки существования категории).
- [ ] `GET /api/drinks` отдаёт `basePrice` без добавок и поля `{id,slug,name,previewUrl,videoUrl,basePrice,kcal,categoryId}`.
- [ ] `GET /api/drinks/{slug}` отдаёт деталку с `addons:[...]`; добавки только из активных категорий и сами активные.
- [ ] `GET /api/drinks/{slug}` для draft/hidden или несуществующего slug → 404 NOT_FOUND (не 403).
- [ ] В деталке КБЖУ добавок пересчитаны на объём `default_portions*portion_amount`; `free=true` когда `price_override IS NULL`.

**Фронтенд / UI**
- [ ] `/home` (app/app/home/page.tsx) рендерит hero активной категории (видео/фото), чипы категорий и грид `ApiProductCard`.
- [ ] `/home` показывает состояния: loading (скелетон 4 карточки), error («Сервер недоступен» + «Повторить»→reload), empty («В этой категории пока пусто»), success.
- [ ] Чипы категорий на `/home` меняют `?category=ID` и перезапрашивают drinks; hero и карточки ведут на `/product/{slug}`.
- [ ] `/menu` (app/app/menu/page.tsx) рендерит вкладки категорий + грид, состояния loading/error («Не удалось загрузить меню»)/empty/success.
- [ ] `/product/[slug]` (app/app/product/[slug]/page.tsx) проигрывает видео автоматически (muted, loop), показывает название, КБЖУ и кнопку «Назад».
- [ ] `/product/[slug]` при недоступном напитке показывает экран «Напиток недоступен» + «В меню» (обработка 404).

**User-flow**
- [ ] Переход чип категории → грид обновляется; обновление страницы с `?category=ID` сохраняет фильтр (состояние шарится ссылкой).
- [ ] Из `/home`/`/menu` тап по карточке → деталка → «Назад» возвращает на витрину без потери выбранной категории.
- [ ] Прямой заход по URL на неопубликованный напиток → экран «недоступно», без падения.
- [ ] Каталог грузится без авторизации (публичные эндпоинты).

**Требования (приёмка)**
- [ ] Категории грузятся с бэкенда (`GET /api/categories`), в переключателе видны только активные.
- [ ] Список напитков фильтруется по категории через `?category={id}`; состояние шарится ссылкой.
- [ ] В каталоге видны только напитки со статусом «опубликован» (черновики/скрытые не отдаются публичным API).
- [ ] Деталка проигрывает видео автоматически (muted, loop), есть название и кнопка «Назад».
- [ ] На деталке показаны категории добавок, доступные именно этому напитку, только активные категории/добавки.
- [ ] Прямой заход на неопубликованный напиток → 404 / экран «недоступно».

---

### День 3 — Конструктор напитка: добавки, типы выбора, live-пересчёт цены и КБЖУ (Строка №3 Конструктор добавок: связка напиток×добавка (цена, мин/дефолт/макс объёмы, типы выбора), live-пересчёт цены и КБЖУ — 8/8/0 · 16 ч · 40 000 ₽. US: PUB-G-03.)

**Бэкенд**
- [ ] `GET /api/drinks/{slug}` отдаёт связки с `price_override`, `min/default/max` порций, `portionAmount`, `selectionType` (из override или категории).
- [ ] `POST /api/drinks/{slug}/preview` с пустым `selections` → только базовая цена/КБЖУ напитка (валидно).
- [ ] `POST /api/drinks/{slug}/preview` считает `total = base_price + Σ(pricePerPortion*portions)`, КБЖУ суммируются; цена округляется до 2 знаков, КБЖУ до 1.
- [ ] `POST /api/drinks/{slug}/preview` с addonId не из активной map → 409 ADDON_NOT_AVAILABLE.
- [ ] `POST /api/drinks/{slug}/preview` с portions вне `[min,max]` → 409 ADDON_PORTIONS_OUT_OF_RANGE.
- [ ] Тип `single`: ровно 1 добавка и 1 порция в категории, иначе → 409 SELECTION_TYPE_VIOLATED.
- [ ] Тип `multi`: любое число добавок, но по 1 порции каждая.
- [ ] Тип `counter`: порции в пределах `[min,max]`.
- [ ] `POST /api/drinks/{slug}/preview` для неопубликованного/несуществующего напитка → 404 NOT_FOUND.
- [ ] Edge: дубликаты одного addonId в selections (для single → SELECTION_TYPE_VIOLATED; для counter дубли суммируются — двойной учёт).
- [ ] Edge: `portions=0` при `min_portions=0` допустимо (добавка с 0 порций, amount=0, цена 0).

**Фронтенд / UI**
- [ ] `/product/[slug]` рендерит конструктор: чипы добавок по категориям, счётчики порций (toggle/inc/dec), live-цена и КБЖУ.
- [ ] Локальный пересчёт totals в конструкторе зеркалит серверную формулу (визуально совпадает с preview).
- [ ] Кнопка «В корзину · N AED» вызывает `POST /api/drinks/{slug}/preview` для серверной цены перед добавлением, показывает toast «Добавлено в корзину».
- [ ] BottomSheet «Назвать напиток» и «подробнее» открываются (локальные, без сети) и закрываются корректно.
- [ ] Счётчики порций ограничены min/max из связки; типы выбора (single/multi/counter) визуально соблюдаются.

**User-flow**
- [ ] Добавление добавки увеличивает итог на её цену (override; `null`-цена = бесплатно, включена в базу).
- [ ] КБЖУ добавки растёт на дефолтный объём; при ×2/×3 порциях цена и КБЖУ умножаются.
- [ ] Клик «В корзину» → preview → запись в zustand-корзину с `drinkId`/serverAddons → `router.back()`; повторное добавление того же напитка работает.
- [ ] Live-расчёт фронта совпадает с серверным `preview` (цена и КБЖУ сходятся фронт↔бэк).

**Требования (приёмка)**
- [ ] При добавлении добавки итог растёт на цену добавки в этом напитке (override; null-цена = бесплатно, включена в базу).
- [ ] КБЖУ добавки пересчитывается на её дефолтный объём в этом напитке (КБЖУ хранится на 100 г).
- [ ] При нескольких порциях добавки цена и КБЖУ умножаются на количество (×1, ×2, …).
- [ ] Количество порций ограничено мин./макс. объёмом из связки; тип выбора (один/несколько/счётчик) соблюдается.
- [ ] Под составом — кнопка «Добавить в корзину» с актуальной итоговой суммой.
- [ ] Расчёт совпадает с серверным `POST /api/drinks/{slug}/preview` (цена и КБЖУ сходятся фронт↔бэк).

---

### День 4 — Корзина из нескольких напитков + вход по телефону (Строка №4 Корзина (несколько напитков, количество, итоги, сохранение) — 3/5/0 · 8 ч + строка №5 Авторизация по телефону + SMS-код — 6/4/0 · 10 ч. Итого 14 ч (по дню Б7/Ф7) · 35 000 ₽. US: PUB-G-05, PUB-G-04.)

**Бэкенд**
- [ ] `POST /api/auth/request-code` при `auth_otp_enabled=false` → `{sent:false, otpRequired:false}` (фронт сразу зовёт verify).
- [ ] `POST /api/auth/request-code` при включённом OTP в dev-режиме отдаёт фиксированный код `1836` как `devCode` и пишет OtpCode с `expires_at=utcnow()+300с`.
- [ ] `POST /api/auth/request-code` валидирует regex телефона; телефон с буквами/без `+` → 422.
- [ ] `POST /api/auth/verify` при выключенном OTP игнорирует код, создаёт/находит User, выдаёт JWT; `created` корректен.
- [ ] `POST /api/auth/verify` при включённом OTP с неверным/просроченным/использованным кодом → 401 OTP_INVALID; verify берёт самую свежую запись (order by id desc).
- [ ] `POST /api/auth/verify` при создании нормализует locale (не из `['ru','ar']` → `ru`); существующему юзеру не перезаписывает заполненное name.
- [ ] `GET /api/auth/me` отдаёт профиль для подстановки в корзину/checkout.
- [ ] `POST /api/drinks/{slug}/preview` корректно пересчитывает позицию при изменении количества.
- [ ] Edge: verify с phone без regex-валидации может создать юзера с произвольной строкой; повторный verify по новому phone (гонка) → возможен IntegrityError 500.

**Фронтенд / UI**
- [ ] `/cart` (app/app/cart/page.tsx) рендерит список позиций из zustand, степпер +/− количества, итог; пустое состояние («Корзина пуста» + «К меню»).
- [ ] Кнопка «Оформить · N AED»: без `juicy-token` → `/auth/phone?next=/checkout`, с токеном → `/checkout`.
- [ ] `/auth/phone` (app/app/auth/phone/page.tsx) рендерит NumPad +971, чекбокс оферты (блокирует кнопку), состояние sending.
- [ ] «Получить код» вызывает `POST /api/auth/request-code`; при OTP-off сразу `verify`+setToken+роутинг, иначе сохраняет devCode и ведёт на `/auth/otp`.
- [ ] `/auth/otp` (app/app/auth/otp/page.tsx) рендерит ввод 4 цифр, таймер 55с, авто-верификацию; error «Неверный код — попробуй ещё раз» сбрасывает ввод.
- [ ] `/auth/name` (app/app/auth/name/page.tsx) рендерит ввод имени, чипы-подсказки, кнопку disabled пока имя пустое; «Пропустить» = имя «Гость».
- [ ] Мёртвые элементы в авторизации не выдаются за рабочие: ссылки «офертой»/«политикой» в `/auth/phone` без href; «Отправить ещё раз» в OTP только перезапускает таймер (реального ресенда нет).

**User-flow**
- [ ] Собранный напиток добавляется в корзину; можно вернуться в меню и добавить ещё позиции.
- [ ] Изменение количества (+/−) и удаление пересчитывают итог; корзина переживает перезагрузку (localStorage) до оформления/очистки.
- [ ] Гость по «Оформить» → `/auth/phone`→`otp`→`name`, корзина сохраняется, после входа возврат на `/checkout` (через `?next`).
- [ ] При OTP-off вход проходит без кода (захват по номеру — известный риск дефолта).
- [ ] При ошибке сети в `/auth/phone` всё равно ведёт на `/auth/otp` (graceful).

**Требования (приёмка)**
- [ ] Собранный на деталке напиток (со всеми добавками) добавляется в корзину; можно добавить ещё позиции.
- [ ] В корзине: список позиций с добавками, цена позиции, изменение количества (+/−), удаление; итог пересчитывается автоматически.
- [ ] Корзина сохраняется между визитами (localStorage) до оформления или очистки.
- [ ] Каталог, сборка и корзина доступны без авторизации; «Оформить» проверяет авторизацию (PUB-G-04 AC1).
- [ ] Неавторизованный гость по «Оформить» уходит на вход, корзина сохраняется, после входа попадает на оформление.
- [ ] Вход по телефону работает: `POST /api/auth/verify` выдаёт JWT; в dev код фиксированный, отправка SMS включается флагом без правок кода.

---

### День 5 — Оформление, оплата Stripe и чек с VAT 5% (веха: собрал → вошёл → оплатил) (Строка №6 Оформление заказа (предзаполнение) + оплата Stripe + webhook подтверждения — 9/4/1 · 14 ч · 35 000 ₽. US: PUB-A-01, PUB-A-02.)

**Бэкенд**
- [ ] `POST /api/orders` с пустым `items` → 422 CART_EMPTY.
- [ ] `POST /api/orders` без carPlate в теле и профиле → 422 CAR_PLATE_REQUIRED; carPlate приводится к UPPER.
- [ ] `POST /api/orders` с неопубликованным напитком → 409 DRINK_NOT_AVAILABLE; добавки валидируются через drink_preview (409 ADDON_*/SELECTION_TYPE_VIOLATED).
- [ ] `POST /api/orders` создаёт снэпшоты OrderItem/OrderItemAddon, считает `subtotal`, `total`, ставит `status=new`, `payment_status=pending`, пишет event `created`.
- [ ] `POST /api/orders` пересчитывает цены на сервере (фронтовая цена игнорируется — защита от подмены).
- [ ] `POST /api/payments/checkout-session` для своего pending-заказа создаёт Payment(pending); при STRIPE_SECRET_KEY → real session `{checkoutUrl, mock:false}`; без ключа → mock `{checkoutUrl:'/orders/{id}?paid=1', mock:true}` и сразу `mark_paid`.
- [ ] `POST /api/payments/checkout-session` для чужого заказа → 404; для уже оплаченного → 409 ALREADY_PAID.
- [ ] `POST /api/payments/webhook` на `checkout.session.completed` по metadata помечает заказ paid (real-режим: оплата подтверждается webhook'ом, не редиректом).
- [ ] `POST /api/payments/webhook` без `STRIPE_WEBHOOK_SECRET` НЕ проверяет подпись — критический риск подделки оплаты (зафиксировать как дефект для прода).
- [ ] `GET /api/orders/{order_id}` после оплаты отдаёт страницу заказа (full=True) только владельцу; чужой → 404.
- [ ] Edge VAT: в модели Order только `subtotal/coupon_discount/total`, отдельной строки VAT 5% нет — проверить, что чек содержит VAT согласно решению (Q14: «в цене» vs «сверху»).

**Фронтенд / UI**
- [ ] `/checkout` (app/app/checkout/page.tsx) предзаполняет телефон из `GET /api/auth/me`, поля имя/эмират(select)/номер авто с маской (латиница+цифры, upper).
- [ ] `/checkout` показывает loading (телефон «…»), error (текст ошибки создания заказа), отфильтровывает легаси-позиции без drinkId с предупреждением.
- [ ] Чекбокс купона + radio позиции работают (берутся из `GET /api/coupons`); выбор уходит в тело заказа.
- [ ] «Перейти к оплате» вызывает `POST /api/orders`, `setUser` локально, `clearCart`, редирект на `/payment?orderId=&total=`.
- [ ] `/payment` (app/app/payment/page.tsx) рендерит сумму, кнопку «Оплатить через Stripe», состояния processing/error.
- [ ] «Оплатить» вызывает `POST /api/payments/checkout-session`; mock → `router.replace('/orders/{id}')`, real → `window.location=checkoutUrl`.
- [ ] `/orders/[id]` показывает созданный оплаченный заказ.

**User-flow**
- [ ] «Оплатить» активна только при заполненных обязательных полях (телефон/авто/имя).
- [ ] Сквозной mock-сценарий без ключей: собрал → вошёл → оформил → оплатил → заказ paid, появляется в админ-очереди.
- [ ] Брошенная/неуспешная оплата: заказ остаётся не оплачен, показана ошибка с возможностью повторить.
- [ ] Если `GET /api/auth/me` падает на checkout → редирект на `/auth/phone` (guard); после входа возврат.
- [ ] Чек: `subtotal − couponDiscount = total`; проверить отображение VAT 5%.

**Требования (приёмка)**
- [ ] На оформлении телефон предзаполнен; обязательные поля — телефон, номер авто, имя; «Оплатить» активна только при заполненных.
- [ ] Клик «Оплатить» создаёт заказ (`POST /api/orders`) и checkout-session, редиректит на hosted-форму.
- [ ] Факт оплаты подтверждается webhook'ом (`POST /api/payments/webhook`): заказ → paid, появляется в админке «новый», платёж сохранён (currency=AED).
- [ ] Неуспешная/брошенная оплата — заказ не оплачен, показана ошибка с повтором.
- [ ] Чек корректен: `subtotal − couponDiscount = total`; VAT 5% отражён согласно Q14 (ВНИМАНИЕ: отдельной строки VAT в Order нет — нужно добавить расчёт/строку или зафиксировать «всё включено»).
- [ ] Сквозной сценарий проходит без ключей в mock-режиме: собрал → вошёл → оплатил.

---

### День 6 — Статусы в реальном времени (WebSocket) + «Я приехал» + профиль и guards (Строка №7 Единая статусная модель + страница заказа + «Прибыл, готов забрать» + realtime WebSocket — 8/5/1 · 14 ч + строка №9 Профиль + состояния гость/клиент + route-guards — 2/4/0 · 6 ч. Итого 20 ч (Б10/Ф9/Д1) · 50 000 ₽. US: PUB-A-03, PUB-A-06, PUB-A-08.)

**Бэкенд**
- [ ] `GET /api/orders/{order_id}` отдаёт текущий статус по единой модели + events; для чужого/несуществующего → 404 (маскировка под 404, не 403).
- [ ] `GET /api/orders/{order_id}` выставляет `ratingPromptDue=true` только если rating пуст, arrived_at задан, статус не completed/refund и прошло >15 мин с прибытия.
- [ ] `POST /api/orders/{order_id}/arrived` ставит `arrived_at`, пишет event `arrived`, шлёт notify в `order:{id}` и `admin:orders`.
- [ ] `POST /api/orders/{order_id}/arrived` идемпотентно: повторный вызов после установки arrived_at → 200 без нового события/нотификации.
- [ ] `POST /api/orders/{order_id}/arrived` для неоплаченного → 409 ORDER_NOT_PAID; для completed/refund → 409 ORDER_FINISHED.
- [ ] WS `/ws/orders/{order_id}` пушит `{orderId,status,paymentStatus,arrived}` при смене статуса/прибытии без перезагрузки.
- [ ] WS `/ws/orders/{order_id}` без авторизации — любой по предсказуемому order_id видит статус (зафиксировать как риск утечки).
- [ ] `PATCH /api/auth/me` меняет только переданные не-None поля; carPlate → UPPER; locale валидируется против `['ru','ar']` (иначе 422).
- [ ] Edge: `PATCH /api/auth/me` с `name=''`/`carPlate=''` (не None) затирает значения в профиле.

**Фронтенд / UI**
- [ ] `/orders/[id]` (app/app/orders/[id]/page.tsx) рендерит stepper статусов, состав, итоги, историю событий; состояние loading.
- [ ] `/orders/[id]` подключает WS `orderWs` + polling 60с; при сообщении перезагружает заказ.
- [ ] Кнопка «Я на месте — вынесите к машине» вызывает `POST /api/orders/{id}/arrived`, disabled по правилам.
- [ ] Для неоплаченного заказа показывается кнопка повторной оплаты → `/payment?orderId=&total=`.
- [ ] `/profile` (app/app/profile/page.tsx) рендерит данные, машину+эмират, переключатель RU/AR; гостю — экран «Войди в Juicy» + выбор языка.
- [ ] Имя/машина/локаль сохраняются через `PATCH /api/auth/me` (api.updateMe) + локальный setUser.
- [ ] Мёртвые элементы профиля зафиксированы: ссылки «Условия/Политика/Связаться» — заглушки без onClick; счётчик «Заказов» из локального store (всегда 0 после миграции).

**User-flow**
- [ ] Смена статуса менеджером приходит клиенту в реальном времени по WS без перезагрузки.
- [ ] «Я на месте» доступна в любой момент после оплаты, идемпотентна, после completed/refund недоступна (409).
- [ ] Статусы отображаются с датой/временем; после completed клиент видит «получен».
- [ ] Route-guards: профиль/заказы/оформление закрыты для гостя — гостю экран-приглашение «Войти».
- [ ] Профиль предзаполняет checkout (имя/авто используются при следующем заказе).

**Требования (приёмка)**
- [ ] На странице заказа виден статус по единой модели; переходы по TRANSITIONS из order_flow.py.
- [ ] «Я на месте» доступна после оплаты, ставит arrived_at, идемпотентна, после выдачи/возврата недоступна.
- [ ] Смена статуса менеджером приходит клиенту realtime по WS (`/ws/orders/{id}`) без перезагрузки.
- [ ] Смены статусов отображаются с датой и временем; после completed клиент видит «получен».
- [ ] Профиль: можно указать/изменить имя, телефон, номер авто, язык (`PATCH /api/auth/me`); данные предзаполняют checkout.
- [ ] Route-guards: защищённые маршруты закрыты для гостя; гостю — экран «Войти».

---

### День 7 — Мои заказы (история) + каркас админки и роли (веха: ЛК + вход персонала) (Строка №8 Мои заказы: список + деталка с историей статусов — 3/5/0 · 8 ч + строка №10 Админка: каркас, вход персонала, роли, управление менеджерами — 5/5/0 · 10 ч. Итого 18 ч (Б8/Ф10) · 45 000 ₽. US: PUB-A-07, ADM-S-06.)

**Бэкенд**
- [ ] `GET /api/orders` отдаёт только заказы текущего клиента (full=False, без PII/events), order by id desc; включает pending.
- [ ] `GET /api/orders` при отсутствии заказов → `[]`.
- [ ] `GET /api/orders/{order_id}` отдаёт деталку со составом и историей (events) только владельцу; чужой → 404.
- [ ] `POST /api/staff/login` выдаёт токен; `GET /api/staff/me` отдаёт роль (super_admin | manager).
- [ ] `GET /api/staff/managers` (super_admin) отдаёт ВСЕХ сотрудников включая disabled; обычный manager → 403.
- [ ] `POST /api/staff/managers` создаёт менеджера/админа; роль не из (manager,super_admin) → 422; занятый email → 409 EMAIL_TAKEN.
- [ ] `DELETE /api/staff/managers/{staff_id}` — soft-delete (disabled=True); удаление себя → 409 CANNOT_DELETE_SELF; несуществующий → 404.
- [ ] Edge: повторный DELETE уже disabled → снова disabled, 200 (идемпотентно); создать второго super_admin можно.

**Фронтенд / UI**
- [ ] `/orders` (app/app/orders/page.tsx) рендерит список заказов с бэкенда (api.myOrders); loading («Загрузка…»), empty (гость → «Войти», клиент → «Сделай первый»), success.
- [ ] Карточка заказа ведёт на `/orders/{id}`; подписи статуса через i18n + STATUS_LABELS.
- [ ] `/orders/[id]` показывает состав, итоги, данные выдачи и таймлайн истории статусов (OrderEvent).
- [ ] `/admin/login` (app/app/admin/login/page.tsx) вход персонала, роутинг по роли.
- [ ] `/admin/staff` (app/app/admin/staff/page.tsx) рендерит таблицу менеджеров, модалку создания (email/пароль/роль), кнопку «Деактивировать»; toast успех/ошибка.
- [ ] AdminShell скрывает менеджеру разделы кроме заказов (route-guard в admin/layout).

**User-flow**
- [ ] Гость на `/orders` (нет токена) → myOrders не вызывается, показано приглашение «Войти».
- [ ] Клиент видит список своих заказов → деталка → «Назад» возвращает в список.
- [ ] Супер-админ создаёт менеджера → новый менеджер логинится в `/admin/login` и попадает в `/admin/orders`.
- [ ] Менеджер не видит разделы super_admin (дашборд/клиенты/платежи/купоны/каталог скрыты).
- [ ] Деактивация менеджера → он больше не может войти (disabled → 401 при следующем запросе).

**Требования (приёмка)**
- [ ] Клиент видит список всех своих заказов (`GET /api/orders`) со статусами.
- [ ] В деталке заказа — список напитков и добавок со стоимостями и итогом; данные выдачи (авто, телефон, имя, дата/время).
- [ ] Видны даты и время смен статусов (история заказа, OrderEvent timeline).
- [ ] Вход персонала: `POST /api/staff/login` выдаёт токен, `GET /api/staff/me` отдаёт роль.
- [ ] Супер-админ может добавить и удалить менеджера (`POST/DELETE /api/staff/managers`); новый менеджер заходит в админку.
- [ ] Роли разграничены: менеджеру доступен только раздел заказов, остальные скрыты.

---

### День 8 — Админ-каталог: меню (категории/добавки/напитки/ед.изм.) + drag-and-drop медиа (Строка №11 Админка-каталог: категории напитков · категории добавок (+типы выбора) · добавки (КБЖУ/цена/ед.) · единицы измерения · напитки + привязка добавок — 12/14/2 · 28 ч · 70 000 ₽. US: ADM-S-01…05.)

**Бэкенд**
- [ ] `GET /api/admin/catalog/drink-categories` (super_admin) отдаёт ВСЕ категории включая неактивные, raw JSON-имена.
- [ ] `POST /api/admin/catalog/drink-categories` создаёт категорию; `PATCH` ведёт себя как full-replace (непереданные поля → дефолты схемы: photoUrl/videoUrl→None, isActive→true, sort→0).
- [ ] `GET/POST /api/admin/catalog/addon-categories`: POST валидирует selectionType ∈ (single,multi,counter) → иначе 422; `PATCH` НЕ валидирует selectionType (риск записи мусора).
- [ ] `GET/POST/PATCH /api/admin/catalog/addons`: создание не проверяет существование categoryId/unitId (FK-риск); PATCH full-replace (КБЖУ→0, basePrice→0, isActive→true).
- [ ] `GET/POST /api/admin/catalog/units`: POST с занятым code → 409 CODE_TAKEN; PATCH/DELETE для units отсутствуют.
- [ ] `GET/POST /api/admin/catalog/drinks`: POST валидирует status ∈ (draft,published,hidden) → иначе 422, занятый slug → 409 SLUG_TAKEN; `PATCH` НЕ валидирует status и НЕ проверяет SLUG_TAKEN (риск 500/исчезновения с витрины).
- [ ] `PUT /api/admin/catalog/drinks/{id}/bindings` валидирует `0<=min<=default<=max` (иначе 422 PORTIONS_RANGE_INVALID), несуществующий addon → 409 ADDON_NOT_FOUND:{id}; пустой массив удаляет все связки.
- [ ] Все эндпоинты `/api/admin/catalog/*` требуют super_admin (manager → 403).
- [ ] Edge: смена `isActive=false`/снятие с публикации немедленно убирает сущность с публичной витрины; снэпшоты оформленных заказов не затрагиваются.

**Фронтенд / UI**
- [ ] `/admin/catalog/categories` рендерит список, инлайн-редактор RU/AR/фото/видео, тоггл активности, модалку создания; индикатор непереведённого AR (оранжевая рамка).
- [ ] `/admin/catalog/groups` рендерит категории добавок (тип single/multi/counter) + справочник единиц; создание категории/единицы.
- [ ] `/admin/catalog/addons` рендерит таблицу (категория/ед./КБЖУ/цена), drawer-редактор, тоггл активности, создание; метка «нет AR».
- [ ] `/admin/catalog/products` рендерит список (статус/цена/ккал/число добавок), создание черновика (автогенерация slug из названия отбрасывает кириллицу).
- [ ] `/admin/catalog/products/[slug]` рендерит вкладки «Основное» (тексты/медиа/категория/цена/КБЖУ/статус) и «Доступные добавки» (override-цена, min/default/max, объём) с клиентской валидацией порций.
- [ ] Все кнопки сохранения реально вызывают catalogApi (PATCH/PUT); при ненайденном по slug напитке → редирект на список.

**User-flow**
- [ ] Создание/редактирование категории → тоггл активности скрывает её в публичном переключателе `/home`.
- [ ] Создание добавки → привязка к напитку через `/admin/catalog/products/[slug]` (PUT bindings) → добавка появляется в деталке напитка у клиента.
- [ ] Публикация напитка (status=published) → появляется на витрине; деактивация/hidden → исчезает немедленно.
- [ ] Смена типа выбора категории добавок → отражается в валидации preview/заказа.
- [ ] Edge для приёмки: drag-and-drop загрузка медиа в облако (требование AC) — проверить, что реализована, т.к. сейчас URL задаются строкой (медиа = статические пути).

**Требования (приёмка)**
- [ ] CRUD категорий напитков: название/фото/видео/активность; тоггл скрывает категорию в публичном переключателе.
- [ ] CRUD категорий добавок с типом выбора один/несколько/счётчик; тип задаётся на категории и переопределяется в связке.
- [ ] CRUD добавок: название/изображение/КБЖУ на 100 г/стоимость/активность/единица/категория; справочник единиц пополняется.
- [ ] CRUD напитков: статус (черновик/опубликован/скрыт), превью/видео, базовая цена, категория; привязка добавок с override и min/default/max (PUT bindings).
- [ ] Загрузка фото/видео drag-and-drop в облако без ручной вставки ссылок; медиа сразу появляется в меню у клиента.
- [ ] Изменения в админ-каталоге немедленно отражаются на публичной витрине.

---

### День 9 — Админ-заказы (фильтры, «Взять в работу», статусы, история, состав) + дашборд 9 метрик (+ бонус: рабочие часы) (Строка №12 Админка-заказы (список с фильтрами, «Взять в работу», статусы, данные клиента, история, состав с граммовкой) — 7/8/1 · 16 ч + Опция О5 Дашборд (ADM-S-10) — 8/7/1 · 16 ч. Итого 32 ч (Б15/Ф15/Д2) · 80 000 ₽. US: ADM-M-01…05, ADM-S-10. Бонус (вне сметы): приём по рабочим часам точки.)

**Бэкенд**
- [ ] `GET /api/admin/orders` (любой staff) отдаёт ТОЛЬКО `payment_status==paid`; `active=true` → new/in_progress/ready, `active=false` → completed/refund.
- [ ] `GET /api/admin/orders?manager_id=` и `?unassigned=true` фильтруют по менеджеру/без менеджера; неоплаченные не показываются.
- [ ] `GET /api/admin/orders/{id}` отдаёт деталку + events (с byStaffId/note); доступна и для неоплаченных (нет фильтра paid здесь).
- [ ] `POST /api/admin/orders/{id}/take`: неоплаченный → 409 ORDER_NOT_PAID; не из статуса new → 409 INVALID_TRANSITION; при успехе → in_progress, закрепляет manager_id, notify.
- [ ] `POST /api/admin/orders/{id}/status`: ready только из in_progress, completed только из ready (иначе 409 INVALID_TRANSITION); status не ready/completed → 422.
- [ ] WS `/ws/admin/orders` пушит события очереди и индикатор «клиент на месте» (arrived) в реальном времени.
- [ ] `GET /api/admin/dashboard` (super_admin) отдаёт 9 метрик по `payment_status==paid` с фильтром `from/to`; деление на 0 защищено.
- [ ] Edge dashboard: `ordersByHour` по UTC-часу (пики смещены относительно UAE); topProducts группируется по drink_name снэпшота (разные локали → разные строки); `sum(topProducts.revenue)` может не совпасть с revenue (купон).
- [ ] Edge take: гонка двух менеджеров на один new-заказ — нет optimistic lock, последний перезаписывает manager_id (зафиксировать).

**Фронтенд / UI**
- [ ] `/admin/orders` (app/app/admin/orders/page.tsx) рендерит ленту с фильтрами активные/завершённые/все и все/мои/без менеджера; empty («Заказов нет»); подсветка строки при arrived.
- [ ] Кнопка «Взять в работу» (для new) вызывает `take` + reload; «Мои» использует staff.id из useAdmin.
- [ ] `/admin/orders/[id]` (app/app/admin/orders/[id]/page.tsx) рендерит состав с граммовкой добавок, данные клиента, оплату, управление статусом по цепочке, хронологию; realtime через WS.
- [ ] Кнопки «Готово, ожидает прибытия» (status=ready) и «Передан клиенту» (status=completed) появляются по текущему статусу и реально вызывают setStatus.
- [ ] `/admin` (app/app/admin/page.tsx) рендерит дашборд: выручка, чеки, напитки, средний чек, график по часам, топ-продукты, топ-клиенты; фильтр периода (Всё время/Сегодня/7д/30д); loading.
- [ ] Фильтр периода меняет `from` и перезапрашивает dashboard; «Все клиенты →» ведёт на `/admin/customers`.

**User-flow**
- [ ] «Взять в работу» → статус in_progress, закрепление за менеджером, запись в историю; клиент сразу видит изменение по WS.
- [ ] Цепочка new → in_progress → ready → completed соблюдается; попытка перескочить → 409, кнопка недоступна.
- [ ] Индикатор «🚗 клиент на месте» (arrived_at) появляется поверх любого статуса в реальном времени.
- [ ] Обновление страницы `/admin/orders` сохраняет фильтры (query); повторный «Взять» уже взятого → 409 (UI не ломается).
- [ ] Дашборд при пустом периоде показывает нули без падения (деление защищено).

**Требования (приёмка)**
- [ ] Список заказов с фильтрами по активности и по менеджеру (включая «без менеджера»); видны статус готовки и факт прибытия.
- [ ] «Взять в работу»: статус → in_progress, закрепление за менеджером, запись в историю; клиент видит по WS.
- [ ] Готовность/выдача: ready → completed; индикатор «🚗 клиент на месте» realtime; показан блок данных покупателя.
- [ ] История заказа (таймлайн OrderEvent): тип, статус, кто сменил, когда; состав — снэпшот с граммовкой и оценкой.
- [ ] Дашборд показывает 9 метрик (выручка, чеки, напитки, сред. напитков, средний чек, пики, top-20 продуктов, рейтинг клиентов) с фильтром по периоду.
- [ ] Бонус: приём заказов только в рабочие часы точки; вне расписания — «точка закрыта» (ВНИМАНИЕ: модели working_hours/outlet в backend пока нет — требуется реализовать).

---

### День 10 — Клиенты + реестр платежей, локализация RU/AR (RTL) и публичный запуск (веха: приёмка) (Опция О4 Клиенты + платежи (ADM-S-08, 09) — 6/8/0 · 14 ч + Опция О3 Локализация RU/AR (PUB-A-09, ADM-S-11) — 8/9/3 · 20 ч. Итого 30 ч (Б14/Ф13/Д3) · 75 000 ₽. US: ADM-S-08, ADM-S-09, PUB-A-09, ADM-S-11.)

**Бэкенд**
- [ ] `GET /api/admin/customers` (super_admin) отдаёт список клиентов с PII (телефоны); обычный manager → 403.
- [ ] `GET /api/admin/customers/{user_id}` отдаёт карточку с orders/payments/coupons (включая неоплаченные); несуществующий → 404.
- [ ] `PATCH /api/admin/customers/{user_id}` меняет только не-None поля (name/carPlate/emirate), carPlate→UPPER; нельзя менять phone/locale; возвращает `{ok:true}`.
- [ ] `GET /api/admin/payments` (super_admin) отдаёт реестр всех платежей (pending/failed/refunded тоже) со связью order/клиент; валюта AED; несколько Payment на заказ видны отдельными строками.
- [ ] `PATCH /api/auth/me` фиксирует `preferred_locale`; `GET /api/auth/me` читает язык профиля; locale валидируется против `['ru','ar']` (иначе 422).
- [ ] Локализация контента: `t()/pick_locale` отдаёт текст в выбранной локали, при отсутствии перевода — fallback на default (ru).

**Фронтенд / UI**
- [ ] `/admin/customers` (app/app/admin/customers/page.tsx) рендерит таблицу + drawer-деталку (заказы/платежи/купоны); редактирование имени/номера через `PATCH`.
- [ ] Кнопки «Деталка»/«Сохранить данные клиента» реально вызывают `adminApi.customer`/`updateCustomer` + reload.
- [ ] `/admin/payments` (app/app/admin/payments/page.tsx) рендерит реестр (read-only), `#номер заказа` ведёт на `/admin/orders/{id}`; empty («Платежей нет»).
- [ ] `/profile` рендерит переключатель RU/AR; гостю переключатель доступен, выбор сохраняется на устройстве; клиенту — через `PATCH /api/auth/me`.
- [ ] Все публичные экраны отображают контент в выбранной локали; AR → RTL (зеркальная вёрстка, app/app/layout.tsx, globals.css).
- [ ] Админка ведёт переводы переводимых полей (RU/AR), интерфейс админки — EN, виден индикатор непереведённых полей.

**User-flow**
- [ ] Из списка клиентов → drawer-деталка показывает заказы/платежи/купоны/оценки; сохранение правок → reload отражает изменения.
- [ ] Из реестра платежей переход к заказу → к клиенту работает.
- [ ] Гость выбирает язык → при регистрации язык фиксируется в профиле → при входе применяется из профиля.
- [ ] Переключение на AR зеркалит вёрстку (RTL); при отсутствии перевода контента — fallback на ru.
- [ ] Подключены боевые ключи Stripe, выполнен финальный деплой на prod, приёмка по AC (RU/AR).

**Требования (приёмка)**
- [ ] Список клиентов с переходом на деталку; деталка показывает данные + заказы + платежи + купоны + оценки.
- [ ] Реестр платежей: все платежи со связью с заказом и переходом к клиенту, валюта AED.
- [ ] Публичный сайт на двух языках (RU/AR): переключатель доступен гостю и клиенту, выбор сохраняется; при регистрации язык фиксируется, при входе применяется из профиля.
- [ ] Арабский в RTL; все тексты в выбранной локали, при отсутствии перевода — fallback на язык по умолчанию.
- [ ] Админка ведёт переводы переводимых сущностей (RU/AR), интерфейс EN; виден индикатор непереведённых полей.
- [ ] Подключены боевые ключи Stripe, финальный деплой на prod, пройдена приёмка по AC (RU/AR).

---

### Бонус — Часы приёма заказов (вне сметы)

> ВНИМАНИЕ: в backend модели working_hours/outlet ПОКА НЕТ (в dashboard есть только разбивка заказов по времени; на фронте — мок-раздел `/admin/outlets` и клиентский `/outlets` из lib/data.ts). Фичу нужно реализовать на бэке. Чеклист ниже — целевое поведение для приёмки.

**Бэкенд**
- [ ] Введена модель рабочих часов точки (дни недели + интервалы) с учётом часового пояса UAE.
- [ ] `POST /api/orders` вне рабочих часов точки отклоняет создание заказа с понятным кодом ошибки (например 409 OUTLET_CLOSED).
- [ ] В рабочие часы `POST /api/orders` создаёт заказ как обычно.
- [ ] Проверка времени использует часовой пояс точки, а не UTC (в отличие от dashboard ordersByHour, который считает по UTC).
- [ ] Граничные случаи: заказ ровно на открытии/закрытии, переход через полночь, разные дни недели.

**Фронтенд / UI**
- [ ] Клиенту вне рабочих часов показывается сообщение «точка закрыта» (вместо/при попытке оформления).
- [ ] Кнопка «Оформить»/«Оплатить» блокируется или ведёт к сообщению, когда точка закрыта.
- [ ] Рабочие часы редактируются в карточке точки `/admin/outlets/[id]` и реально сохраняются на бэкенд (сейчас экран полностью мок — «Сохранить» только кидает toast).
- [ ] selectedOutletId реально передаётся при оформлении (`POST /api/orders` сейчас не несёт outletId) — иначе проверку по часам конкретной точки не к чему привязать.

**User-flow**
- [ ] В рабочие часы: собрал → оплатил проходит; вне часов — заказ не оформляется, показано «точка закрыта».
- [ ] При попытке оформить ровно на границе закрытия поведение детерминировано (зафиксировать ожидаемое).
- [ ] Смена часов в админке сразу влияет на приём заказов у клиента.

**Требования (приёмка)**
- [ ] Приём заказов только в рабочие часы точки (по дням недели, с учётом часового пояса).
- [ ] Вне расписания заказ не оформляется, показано сообщение «точка закрыта».
- [ ] Реализованы модель working_hours/outlet и проверка при создании заказа (сейчас отсутствуют).
