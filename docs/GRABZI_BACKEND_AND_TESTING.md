# GRABZI — бэкенд: чистая архитектура (Poetry/Postgres/FastAPI/Docker/Alembic) + стратегия тестирования

> Спутник [GRABZI_IMPLEMENTATION_PLAN.md](GRABZI_IMPLEMENTATION_PLAN.md) и [GRABZI_FRONTEND_SPEC.md](GRABZI_FRONTEND_SPEC.md). Здесь — перевод бэкенда Juicy на целевой стек заказчика (**PostgreSQL, Poetry, FastAPI, Docker, Alembic**), чистая архитектура по практикам 2026, и доказательная стратегия тестирования. Заземлено в коде Juicy; учтены замечания адверсариальной ревизии.

---

## A. Текущее состояние → цель
| Аспект | Сейчас (`backend/`) | Цель |
|---|---|---|
| Зависимости | `requirements.txt` (pip), prod-пакеты вписаны в `Dockerfile` | **Poetry** + `poetry.lock`, dev-группа |
| БД | `sqlite:///./juicy.db` (дефолт) | **Postgres (psycopg3)** везде; SQLite — только для быстрых unit |
| Схема | `Base.metadata.create_all` + `seed()` в `lifespan` | **Alembic** (`create_all`/`seed` из lifespan удаляются) |
| Слой schemas | Pydantic-классы внутри роутеров | пакет `app/schemas/` (нужно и для OpenAPI→zod) |
| Доступ к данным | прямой `db.scalar/get` в роутерах | репозитории `app/repositories/` |
| Ошибки | один `exception_handler(ValueError)` | единый `AppError(code,status)` + handler + **реестр кодов** |
| CORS | `allow_origins=["*"]` | список из конфига |
| Медиа | нет | MinIO (S3), в БД **относительный ключ** |
| Rate-limit / idempotency / WS-auth | нет | на auth/order; idempotency вебхука; **аутентификация WS** |

---

## B. Poetry (`pyproject.toml`)
`requirements.txt` удаляется; prod-пакеты (psycopg3, redis, stripe) переезжают из `Dockerfile` в зависимости; версии — `poetry.lock`.
```toml
[tool.poetry.dependencies]
python = "^3.12"
fastapi = "^0.115"
uvicorn = { extras = ["standard"], version = "^0.34" }
sqlalchemy = "^2.0"
psycopg = "^3.2"                 # см. фикс ниже про extras (prod: [c], dev: [binary])
alembic = "^1.14"
pydantic = "^2.10"
pydantic-settings = "^2.7"
pyjwt = "^2.10"; passlib = "^1.7"; python-multipart = "^0.0.20"; email-validator = "^2.2"
redis = "^5.2"; stripe = "^11.4"; boto3 = "^1.35"   # были захардкожены в Dockerfile
slowapi = "^0.1.9"; structlog = "^25.1"

[tool.poetry.group.dev.dependencies]
pytest = "^8.3"; pytest-asyncio = "*"; pytest-cov = "^6.0"; pytest-repeat = "*"
testcontainers = { extras = ["postgres"], version = "^4.9" }
httpx = "^0.28"; factory-boy = "*"; freezegun = "*"
ruff = "^0.9"; mypy = "^1.14"

[tool.poetry.scripts]
api = "app.cli:run_api"; migrate = "app.cli:run_migrate"; seed = "app.cli:run_seed"
[tool.pytest.ini_options]
addopts = "-q --strict-markers"
markers = ["unit","integration","concurrency","contract","e2e"]
asyncio_mode = "auto"
[tool.ruff] line-length = 100; target-version = "py312"
[tool.mypy] python_version = "3.12"; plugins = ["pydantic.mypy"]; strict = true
```
- `ruff` заменяет black+flake8+isort; `mypy --strict`.
- `seed` — отдельная идемпотентная CLI-команда (сид в `lifespan` при репликах = гонка).
- **Фикс ревизии (psycopg):** `psycopg[binary]` — только для dev/быстрого старта; для **прод-образа** использовать `psycopg[c]` (компиляция под целевую систему, multi-stage build-deps) или системный libpq. Не тащить `[binary]` в прод.

---

## C. Docker + Postgres + MinIO (`docker-compose.yml`)
Сервисы: `db (postgres:16-alpine)` + healthcheck `pg_isready`, `redis`, `minio` + one-shot `createbuckets` (bucket `media` + public-read префикса), `backend` (миграции перед стартом), `frontend` (profile `full`). Всё через `.env`, секретов в коде нет. `depends_on: condition: service_healthy`.
```yaml
  backend:
    command: sh -c "poetry run alembic upgrade head && poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000"
    environment:
      DATABASE_URL: postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379/0
      S3_ENDPOINT_URL: http://minio:9000        # запись изнутри docker
      S3_PUBLIC_URL: http://localhost:9000      # база для отдаваемых ссылок (prod: CDN-домен)
```
**`.env`/`.env.example`** — единственный источник секретов: `POSTGRES_*`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `AUTH_OTP_ENABLED=false`, `STRIPE_*` (пусто=mock), `S3_*`/`MINIO_*`, `CORS_ORIGINS`.

**Фикс ревизии (CORS в pydantic-settings v2):** поле `list[str]`, читаемое из env, по умолчанию парсится как JSON → CSV-строка `http://localhost:3000` уронит старт. Решение: хранить `CORS_ORIGINS` как строку и разбивать `field_validator(mode="before")` по запятой (либо задавать валидным JSON в env). Зафиксировать формат в `.env.example`.

**Медиа** в БД — **относительный ключ** (`media/drinks/<uuid>.png`), абсолютный URL собирается на чтении из `S3_PUBLIC_URL` (provider-swap без переписывания строк; единообразно с относительными путями сидов). GRABZI — статичные PNG (видео нет); поле `video_url` опционально и не используется.

---

## D. Alembic (вводим; `create_all` удаляется)
`alembic/env.py`: `sqlalchemy.url` из `pydantic-settings` (единый источник), `target_metadata=Base.metadata` с импортом всех `app/models/*`, `compare_type=True`, `compare_server_default=True`.

**Фикс ревизии (baseline ≠ изменение типа):** нельзя одной ревизией и `stamp head` на прод-БД, и менять тип `Float→Numeric` (stamp не выполняет DDL → рассинхрон ORM↔БД). Разделяем:
- **0001 baseline** — ТОЧНО соответствует текущему `create_all` (Float остаётся Float). На засеянной prod-БД применяется `alembic stamp head` (без DDL); на чистой — `upgrade`.
- **0002 money → Numeric(10,2)** — `ALTER COLUMN ... USING`-каст для `subtotal/total/coupon_discount/unit_price`, применяется `upgrade`-ом на всех средах.
- **0003 GRABZI-фундамент** (одна ревизия, §5.12 плана): `locations`(+`working_hours`,`timezone`,`daily_drink_limit nullable`,`accepting_orders`,`image_url`), `location_daily_counters`, `location_drink_stops`, `location_status_events`(опц.), `app_settings`, `info_blocks`; `orders.location_id`, `staff_users.location_id`; `OrderIn.locationId`, `locationId` в `/me`.
- Политика: ручное ревью автогена, обратимый `downgrade`, одна голова, data-migration отдельно от schema. **SQLite в dev:** включить `PRAGMA foreign_keys=ON` (иначе `ON DELETE CASCADE` молча игнорируется). CI прогоняет `alembic upgrade head` + `alembic check` на чистой контейнерной БД.

---

## E. Чистая архитектура (слои)
```
routers (api, тонкие: DI + делегирование + коды ошибок)
  → services (use-cases: order_service, location_service, auth_service, media_service)
    → repositories (доступ к данным) / models (SQLAlchemy)
  → schemas (pydantic v2, вынесены из роутеров)
core (config, security, db, errors, logging, pubsub)
```
- **Доменная логика в сервисах, не в роутерах:** лимит/часы/пауза/стоп-лист — в `location_service`, вызывается из `order_service.create_order`/`mark_paid`. `order_flow.py → order_service.py`, прямые db-запросы → репозитории.
- **Sync SQLAlchemy остаётся** (drive-through не throughput-bound; весь код sync; `with_for_update` проще под sync). Async — только Stripe-вебхук и WS-пампы. Явный `pool_size/max_overflow` в `create_engine`.
- **Единый `AppError(code, status, meta)` + один exception-handler** → HTTP `detail=code`. Реестр кодов — **канонический, общий с фронтом** (см. [фронт-спека §4](GRABZI_FRONTEND_SPEC.md)): `LOCATION_CLOSED/LOCATION_PAUSED/LOCATION_LIMIT_REACHED/DRINK_UNAVAILABLE_AT_LOCATION/STOCK_LESS_THAN_ORDER/...`. **Один enum** на бэке ↔ zod/copy-map на фронте — не расходятся.
- **Best practices:** `pydantic-settings` с валидацией env на старте; DI через `Depends(get_*_service/repo)`; `structlog` + request-id; `/health`(liveness) + `/health/ready`(SELECT 1 + ping redis/minio); CORS из конфига; `slowapi` rate-limit на auth/order; идемпотентность вебхука по `event_id` (таблица `processed_webhook_event`).

---

## F. Дневной лимит — атомарно, В НАПИТКАХ (критичный инвариант)
> **Фикс ревизии (блокер согласованности):** дизайны be-arch/testing считали лимит в **заказах** (`COUNT(orders)` / `sold_today+1`). **План (§5.2/§5.12) считает в НАПИТКАХ** (`committed_drinks = sum(quantity)`) через materialized `location_daily_counters(location_id, business_date, committed_drinks)`. Заказ из 3 напитков занимает **3** единицы лимита, не 1. Берём вариант плана.

- **Списание — в `mark_paid`** (после оплаты), под `SELECT ... FOR UPDATE` строки счётчика дня:
  ```
  -- в одной транзакции mark_paid:
  row = SELECT * FROM location_daily_counters
        WHERE location_id=:loc AND business_date=:today FOR UPDATE;   -- создать с 0 если нет
  drinks = sum(item.quantity for order)
  if daily_limit IS NOT NULL and row.committed_drinks + drinks > daily_limit:
      → откат продажи: payment_status='refunded' + Stripe refund + лог limit_exceeded_refund (LOCATION_LIMIT_REACHED)
  else:
      row.committed_drinks += drinks; payment_status='paid'; commit
  ```
- `business_date` — в `location.timezone` (граница суток местная). `daily_limit=null` → инкремент **всё равно** делаем (для аналитики), но проверку лимита пропускаем.
- **Refund — корректно (фикс ревизии):** перенести inline-refund из `admin_orders.py` в `order_service.refund_order` (тот же chokepoint, шлёт `notify`). Декремент: **только если заказ был оплачен+зачтён** (idempotency по статусу `refunded`), **только в тот же `business_date`** (кросс-дневной refund лимит прошлого дня не трогает, §5.4), `committed_drinks = GREATEST(committed-drinks, 0)` (не уйти в минус); при `daily_limit=null` декремент пропускаем.
- **Короткая транзакция:** в транзакции с lock'ом НЕ делать внешних вызовов (Stripe refund — после commit/в отдельном шаге), иначе lock держится долго и сериализует все оплаты точки.
- **Idempotency вебхука:** mock-режим (без `STRIPE_SECRET_KEY`) тоже должен идти через идемпотентную обработку (страж `payment_status!='paid'` + `processed_webhook_event`), иначе двойной клик/ретест спишет лимит дважды.

---

## G. VAT / деньги (устранение неоднозначности)
> **Фикс ревизии:** текущий `create_order` НЕ добавляет VAT (`total = subtotal − coupon_discount`), а фронт/тесты местами ссылались на VAT 5%. Расхождение ломает сверку «сумма == OpenAPI total».

- **Решение для GRABZI: цены — VAT-inclusive** (как принято в рознице ОАЭ): отдельной VAT-строки нет, `total = sum(price × qty)` (купонов в GRABZI нет, Р8). Убрать `VAT_RATE` из фронта/тестовых ожиданий. Если потребуется VAT-разбивка в чеке — добавить **в `order_service` на Decimal** и в схему ответа единообразно.
- Деньги — `Numeric(10,2)` (ревизия 0002), расчёты на `Decimal` (не `float`+`round`), сериализация в ответе — строка/число с 2 знаками; FE-формат `Intl.NumberFormat('en-AE',{style:'currency',currency:'AED'})`.

---

## H. WS-аутентификация (БЛОКЕР — новое требование)
> **Фикс ревизии (блокер безопасности):** `/ws/admin/orders` и `/ws/orders/{id}` сейчас **без аутентификации** — открытый broadcast. На админ-канале строится канбан и скоуп менеджера → утечка операционных данных, скоуп неисполним. `ws.py` **должен измениться**.

- Браузер не шлёт `Authorization` на WS → токен передаём **query-параметром** (`?token=`) или **subprotocol**; на `accept` — валидация токена.
- `/ws/orders/{id}` — только владелец заказа (по токену) или staff.
- `/ws/admin/orders` — только staff; для `role=manager` — подписка **только на per-location канал `admin:orders:{location_id}`** (не глобальный `admin:orders`); super_admin — все/выбранная точка.
- Heartbeat `{type:'ping'}` каждые 25с (клиент игнорирует). Лимит/стоп/статус точки — на том же канале `location:{id}` (единая таксономия, фронт-спека §1.6).

---

## I. Стратегия тестирования
Цель — **доказательная защита денежных и лимитных инвариантов**, не «100% покрытие». Пирамида смещена: тонкий e2e, толстый слой быстрых юнит/интеграции вокруг `mark_paid` (списание лимита) и вебхука.
```
e2e (Playwright, desktop+mobile, EN) — 6–8 сценариев (happy + 1 отказ)
контракт (OpenAPI ↔ zod, drift-guard в CI)
интеграция API (httpx AsyncClient + Postgres) — гонки, idempotency, scope, 409/422
юнит доменной логики (pytest) — remaining, is_open, TZ, find-or-create
```

### I.1. Бэкенд
- **Реальный Postgres через testcontainers** (один контейнер на сессию). Изоляция данных — транзакция-откат на тест (`scope=function`).
- **Фикс ревизии (SQLAlchemy 2.0):** код делает несколько `commit()` (create_order/mark_paid) → ручной `begin_nested()`+`after_transaction_end` хрупок. Использовать `Session(bind=conn, join_transaction_mode="create_savepoint")` (штатный 2.0-рецепт под многократный commit).
- **Гонка лимита (самый важный, `@pytest.mark.concurrency`)** — БЕЗ транзакции-обёртки (savepoint сериализует и скроет гонку): реальные параллельные коннекты + `asyncio.gather` + `pytest-repeat --count=10`. **Инвариант в напитках:** засеять заказы разной `quantity`, при лимите L assert `сумма зачтённых напитков == L` (НЕ число заказов). Кейс `daily_limit=null` — все проходят.
- **Юниты доменной логики (100% веток):** `remaining`(лимит null→null, не отрицательное), `is_open = is_active AND accepting AND in_schedule` (матрица 2×2×2), TZ-граница суток (`freezegun`, Asia/Dubai), `find_or_create_user(phone)` (новый→created, существующий→тот же id), `in_schedule` (включая окно через полночь).
- **Интеграция:** idempotency вебхука (тройная доставка одного события не спишет лимит дважды), **refund-декремент** (== sum(quantity), только same-business-day, не в минус, требует prior paid+committed), **scope менеджера** (чужая точка → `403 FOREIGN_LOCATION` в `GET/{id}/take/status/refund`), **пауза** (`409 LOCATION_PAUSED`), **стоп-лист** (`409 DRINK_UNAVAILABLE_AT_LOCATION` в create_order и mark_paid), часы (`409 LOCATION_CLOSED`), **WS-auth** (без токена → reject; manager не получает чужую точку), подпись вебхука (битая → 400).
- **Rating-путь (фикс ревизии):** rating доступен когда выставлен `arrived_at` (не обязательно `completed`) — кейс «arrived, ещё не completed → можно оценить».

### I.2. Фронт
- **vitest + React Testing Library** (компоненты и **все состояния**: loading/empty/error/offline/sold-out/closed/paused). **MSW** (мок API, в т.ч. 409 пауза/стоп/лимит → видимое сообщение + блок кнопки — молчаливые catch трактуем как баги).
- **Контракт OpenAPI→zod:** FastAPI генерит `openapi.json` (нужен вынос Pydantic в `app/schemas/`), `openapi-zod-client` генерит zod-клиент; drift-guard в CI (`git diff --exit-code`).

### I.3. E2E (Playwright, desktop + mobile, EN)
6–8 сценариев: (1) сквозной заказ: локация→`/order`→Pay(mock)→`paid`→статус→«I'm here»→rating; (2) sold-out при оплате → refund-copy; (3) закрытая/паузнутая точка → блок; (4) `remaining<заказа` → модалка Keep N; (5) гость→авто-логин по телефону→возврат к Pay; (6) экран готовки менеджера: новый заказ (звук/баннер), 1-тап TAKE→READY→HANDED OVER, «на месте». Mobile-проект (webkit) — но **реальный iPhone Safari проверять руками** (тач/клавиатура/safe-area).

### I.4. CI (GitHub Actions)
`lint(ruff)+type(mypy)` → `alembic upgrade head + alembic check` (чистая контейнерная БД) → `pytest -m "unit or integration"` → `pytest -m concurrency --count=10` (отдельной командой!) → `vitest` → контракт-drift → `playwright` (desktop+mobile). Кэш образа `postgres:16-alpine`.

---

## J. Чек-лист ручной приёмки (свериться, что работает)
| Фича | Тесты | Как проверить вручную |
|---|---|---|
| Лимит в напитках | concurrency + U1 | заказать на точке с лимитом 5: заказ из 3 + из 3 → второй отклонён `LOCATION_LIMIT_REACHED` |
| Оплата-then-видимость | integration + e2e | до оплаты заказа нет в `/admin/kitchen`; после `paid` — появился, остаток уменьшился на кол-во напитков |
| Refund возвращает лимит | integration | вернуть заказ того же дня → остаток вырос на кол-во; заказ другого дня → не меняется |
| Часы/пауза/стоп | integration + e2e | вне часов → `LOCATION_CLOSED`; пауза(super_admin) → `LOCATION_PAUSED`; стоп напитка → `DRINK_UNAVAILABLE_AT_LOCATION` |
| Скоуп менеджера | integration | менеджер точки A не видит/не берёт заказ точки B (403) |
| Авто-логин без OTP | U4 + e2e | новый телефон → юзер создан+сессия; существующий → та же история заказов |
| WS-auth | integration | WS без токена → reject; manager не получает события чужой точки |
| Состояния страниц | vitest + e2e | каждая публичная страница: skeleton/empty/error/offline/доменные — нет «мёртвых» экранов, весь copy EN |
| Деньги | unit + контракт | `total` на статус-экране == значение из API (Decimal, VAT-inclusive, без расхождения) |
| Экран готовки | e2e + ручная | звук нового заказа (после разблокировки), 1-тап переходы, таймер, «на месте» пульс, остаток точки |

---
_Источник: воркфлоу `grabzi-frontend-arch-spec` (research→design→critique, 11 агентов), аудит `backend/app/*`, верификация живого grabzi.ae. Фронт — [GRABZI_FRONTEND_SPEC.md](GRABZI_FRONTEND_SPEC.md)._
