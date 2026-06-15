# JOOZ — План внедрения локаций (Outlets)

> Архитектурный план + чек-лист для фичи «локации/точки»: модель данных, бэкенд, админка под
> масштабирование; публичный сайт — строго минимум. Термин в кодовой базе — **outlet** (уже есть
> `app/app/admin/outlets/**`, `app/app/outlets/**`, `OutletArt.tsx` — все на моках; в бэкенде модели
> локации **сейчас нет вообще**). Канонический backend-модельный нейминг — `Outlet`.
>
> Источник: разбор кодовой базы + проектирование (см. дерево требований 1–7 ниже). Все ссылки на
> файлы/строки сверены с текущим кодом ветки `juicy`.

---

## ✅ Статус реализации (2026-06-15)

**Реализовано целиком** по этому плану. Бэкенд: 574 теста зелёные (+7 новых в
[test_outlets.py](../backend/tests/test_outlets.py)), `ruff` чисто. Фронт: `tsc` чисто, новых
ошибок линта не добавлено.

- Бэкенд-модели: [outlet.py](../backend/app/models/outlet.py) (5 таблиц) + `orders.outlet_id`.
- Сервис-слой: [outlet_service.py](../backend/app/services/outlet_service.py) (статус/резолв/счётчик/часы/стоп-сеты).
- Миграции/бэкфилл: `backfill_outlets` в [migrate.py](../backend/app/services/migrate.py) (единый владелец дефолтной точки; seed не трогали).
- Привязка заказа + публичный API: [orders.py](../backend/app/routers/orders.py), [outlets.py](../backend/app/routers/outlets.py), счётчик в `mark_paid` [order_flow.py](../backend/app/services/order_flow.py).
- Роли/скоуп: [security.py](../backend/app/core/security.py) (`get_staff_outlet_ids`, `require_manager_or_admin`), [admin_orders.py](../backend/app/routers/admin_orders.py), [screen.py](../backend/app/routers/screen.py), [staff.py](../backend/app/routers/staff.py).
- Админ-CRUD: [admin_outlets.py](../backend/app/routers/admin_outlets.py). Стоп-лист в публичном каталоге: [catalog.py](../backend/app/routers/catalog.py). Realtime по точкам: [ws.py](../backend/app/routers/ws.py).
- Фронт-публика: [useOutlet.ts](../app/lib/useOutlet.ts), адрес под лого ([home](../app/app/home/page.tsx)), гейт ([checkout](../app/app/checkout/page.tsx)), блок точки ([orders](../app/app/orders/page.tsx), [orders/[id]](../app/app/orders/[id]/page.tsx)).
- Фронт-админка: `outletApi` в [adminApi.ts](../app/lib/adminApi.ts), пункт «Точки» в сайдбаре, фильтр заказов по точке, страницы [outlets](../app/app/admin/outlets/page.tsx) + [outlets/[id]](../app/app/admin/outlets/[id]/page.tsx), привязка точек в [staff/new](../app/app/admin/staff/new/page.tsx) и [staff/[id]](../app/app/admin/staff/[id]/page.tsx).

**Уточнение по D2 (счётчик):** реализован **paid-only** — авторитетная проверка лимита и авто-пауза
вешаются на `mark_paid()` (единый чокпоинт checkout + вебхук), создание заказа блокируется по
`runtime_status == 'open'`. Авто-пауза снимается сама на новый локальный день (счётчик считается
вживую по оплаченным заказам, не хранится). Пустые `hours = {}` = всегда открыта (как `NULL`-лимит).

---

## 0. Ключевые решения (нужно подтвердить — рекомендации проставлены)

Эти решения меняют поведение продукта. Я заложил рекомендуемый вариант в план; если меняешь —
правь соответствующий раздел.

| # | Вопрос | Рекомендация (заложена в план) | Раздел |
|---|--------|-------------------------------|--------|
| D1 | Фильтрует ли **публичный каталог** стоп-лист точки? | **ДА.** Публичный каталог скрывает стоп-листнутые напитки/категории/добавки для единственной активной точки (сервер сам резолвит точку, фронт ничего не шлёт, пикера нет). Это и есть смысл REQ-3 «стоп-лист **вывода**». «Минимум на паблике» = не показываем мета-инфо/пикер/карту, но скрытые позиции реально исчезают из меню. | §6, §10 |
| D2 | Что считает дневной счётчик? | **РЕАЛИЗОВАНО paid-only** (по решению владельца): `SUM(OrderItem.quantity)` только по **оплаченным** заказам за локальный день. Авторитетная проверка лимита + авто-пауза — в `mark_paid()` (единый чокпоинт checkout + вебхук); создание заказа блокируется по `runtime_status=='open'`. Авто-пауза снимается сама на новый день (счётчик живой, не хранимый). Анти-абуз: спам неоплаченных заказов не съедает квоту. | §7 |
| D3 | Окно лимита | **Локальный календарный день в TZ точки (Asia/Dubai).** Так как заказы принимаются только в рабочие часы (open-gate), счётчик де-факто копится только в рабочее время → удовлетворяет «за сутки в течение рабочих часов». | §7 |
| D4 | Несколько активных точек на **публике** | **Бэкенд полностью мультиточечный** (при >1 активной — требуем `outletId`). Но на публичном сайте пикера нет (вне scope) → **инвариант: пока пикера нет — ровно ОДНА активная точка.** При попытке активировать 2-ю активную — предупреждение/мягкая блокировка в админке. Это сохраняет масштабируемость бэка и не ломает паблик. | §5, §9 |
| D5 | Роль `screen` | **read-only:** добавить guard `require_manager_or_admin` на мутации заказов (`take`/`status`/`refund`) — screen это ТВ у стойки. | §8 |
| D6 | Авто-пауза при достижении лимита | **Отдельный признак** `auto_paused`/`paused_reason`, чтобы авто-пауза по лимиту отличалась от ручной и **сама снималась на новый локальный день**, когда счётчик < лимита. Не плодим вечную паузу. | §7 |
| D7 | Нумерация заказов | **Оставляем `Order.number` глобально уникальным** (не переходим на нумерацию по точкам — это перестройка таблицы в SQLite). `Outlet.order_counter` кладём в схему «на будущее», но не используем. | §2 |
| D8 | Карта в админке | Минимум: поля `lat`/`lng` + ссылка «открыть в картах». Интерактивный пикер — позже. | §9 |

---

## 1. Принципы

- [ ] **Масштабируемость на бэке/в БД/админке; публичный сайт — минимум.** Любая «толстая» логика
      (статус-машина, аудит, стоп-лист, счётчик, скоупинг по ролям) живёт на бэкенде и в админке.
- [ ] **Заказ всегда привязан к одной точке** (`orders.outlet_id`). Адрес для блока заказа читаем
      «вживую» из связанной точки (не снапшотим — адрес меняется редко, и показать актуальный — ок).
- [ ] **`super_admin` — без скоупа** (видит все точки/заказы), **`manager`** — скоуп по своим точкам
      (через M2M, готово к мультиточке), **`screen`** — ровно одна точка.
- [ ] **Стоп-лист и приоритеты — не трогают глобальные флаги** (`Drink.status`, `Addon.is_active`):
      позиция скрывается только на конкретной точке.
- [ ] **Все вычисления времени — в TZ точки** (`zoneinfo`, stdlib, Python 3.12 — без новых зависимостей),
      никогда не в локали устройства.

---

## 2. Модель данных (REQ-1, 2, 3, 4, 5, 6, 7)

Новый модуль **`backend/app/models/outlet.py`** (5 таблиц). Все наследуют `Base` из `core.db`.

> ⚠️ **САМЫЙ КОВАРНЫЙ БАГ:** `backend/app/models/__init__.py` **пустой (0 байт)** — таблицы
> регистрируются в `Base.metadata` только через транзитивные импорты. Если `outlet.py` не импортнуть
> **до** `Base.metadata.create_all(engine)` ([main.py:22](backend/app/main.py#L22)) — таблицы молча
> не создадутся, без ошибки. См. §3.

### 2.1 `outlets` — сама точка
- [ ] `id` PK
- [ ] `slug` VARCHAR(60) unique+index, default `''` (как у `DrinkCategory.slug`; бэкфилл по аналогии с `backfill_category_slugs`)
- [ ] `name` JSON i18n `{ru,ar,en}` (как нейминг в каталоге)
- [ ] `is_active` BOOLEAN default True — главный рубильник супер-админа (REQ-1). `False` ⇒ статус `inactive` всегда
- [ ] `accepting_orders` BOOLEAN default True — ручная пауза независимо от расписания
- [ ] `auto_paused` BOOLEAN default False — **авто-пауза по дневному лимиту** (D6), отличать от ручной
- [ ] `address` VARCHAR(300) null — адрес (паблик: под лого + блок заказа)
- [ ] `emirate` VARCHAR(40) null (как `Order/User.emirate`)
- [ ] `phone` VARCHAR(30) null — контактный телефон (REQ-1)
- [ ] `email` VARCHAR(120) null — рабочая почта (REQ-1)
- [ ] `lat` FLOAT null / `lng` FLOAT null — точка на карте (REQ-1)
- [ ] `timezone` VARCHAR(40) default `'Asia/Dubai'` — IANA TZ; вся математика open/closed здесь
- [ ] `hours` JSON default `{}` — рабочие часы (формат ниже)
- [ ] `daily_drink_limit` INTEGER null — лимит напитков/день; `NULL` = без лимита (REQ-4)
- [ ] `order_counter` INTEGER default 1000 — **зарезервировано** под будущую нумерацию по точкам (D7, не используем)
- [ ] `sort` INTEGER default 0 — порядок в списке админки
- [ ] `created_at` DATETIME server_default now() / `updated_at` DATETIME null (бамп при правках — аудит)

**Формат `hours` (фиксируем):** объект с ключами `'0'..'6'` (0 = понедельник, как `date.weekday()`),
значение — **список** интервалов `{ "open": "HH:MM", "close": "HH:MM" }` в локальном времени точки.
Пустой список = выходной. Список (а не одна пара) — чтобы сплит-смены/ночные интервалы не требовали
миграции. Пример:
```json
{ "0": [{"open":"07:00","close":"22:30"}], "1": [...], ..., "6": [] }
```
- [ ] **Валидатор `hours` на бэке** (см. §4) — иначе кривой JSON роняет `outlet_status()`.

### 2.2 `staff_outlets` — M2M «сотрудник ↔ точка» (REQ-2, 7)
M2M (а не FK-колонка на `staff_users`) — потому что менеджер в будущем может обслуживать несколько
точек, а `screen` — ровно одну. M2M покрывает 0 (super_admin) / 1 (screen, текущий менеджер) / N (будущее)
без миграции. Инварианты — на уровне приложения (как уже сделана валидность роли), не в БД.
- [ ] `id` PK
- [ ] `staff_id` FK `staff_users.id`, index, ON DELETE CASCADE
- [ ] `outlet_id` FK `outlets.id`, index, ON DELETE CASCADE
- [ ] `is_primary` BOOLEAN default True — домашняя/дефолтная точка
- [ ] `created_at` DATETIME server_default now()
- [ ] UniqueConstraint(`staff_id`,`outlet_id`) `uq_staff_outlet`

### 2.3 `outlet_stop_items` — стоп-лист точки (REQ-3)
Полиморфная таблица: скрывает напиток / категорию напитков / добавку на одной точке.
- [ ] `id` PK
- [ ] `outlet_id` FK, index, ON DELETE CASCADE
- [ ] `entity_type` VARCHAR(16) — `'drink' | 'drink_category' | 'addon'` (де-факто enum, валидируем в приложении)
- [ ] `entity_id` INTEGER — мягкая ссылка (как `OrderItem.drink_id`; FK нет — тип меняется)
- [ ] `created_at` DATETIME / `created_by_staff_id` INTEGER null (аудит)
- [ ] UniqueConstraint(`outlet_id`,`entity_type`,`entity_id`) `uq_outlet_stop` (служит и индексом для выборки)

### 2.4 `outlet_drink_priorities` — приоритеты/порядок напитков на точке (REQ-3)
У `Drink` нет глобальной колонки `sort`, поэтому это — источник порядка на точке.
- [ ] `id` PK
- [ ] `outlet_id` FK, index, ON DELETE CASCADE
- [ ] `drink_id` FK `drinks.id`, index, ON DELETE CASCADE
- [ ] `sort` INTEGER default 0 (меньше = выше; отрицательные — чтобы прибить наверх)
- [ ] `pinned` BOOLEAN default False (хиро/первым на точке)
- [ ] UniqueConstraint(`outlet_id`,`drink_id`) `uq_outlet_drink_priority`

### 2.5 `outlet_events` — аудит/история точки (REQ-5)
Append-only, по образцу `OrderEvent` (переиспользуем конвенции сериализатора).
- [ ] `id` PK
- [ ] `outlet_id` FK, index, ON DELETE CASCADE
- [ ] `type` VARCHAR(24) — `activated|deactivated|paused|resumed|hours_changed|limit_changed|limit_reached|staff_attached|staff_detached|stop_added|stop_removed`
- [ ] `by_staff_id` INTEGER null — кто (NULL для системных, напр. `limit_reached`)
- [ ] `note` VARCHAR(300) null
- [ ] `meta` JSON default `{}` — старое/новое значение часов/лимита, attached `staff_id`, счётчик при `limit_reached`
- [ ] `created_at` DATETIME server_default now(), **index**
- [ ] **Индекс на `(outlet_id, created_at)`** — таймлайн.

### 2.6 Изменение `orders` (REQ-6, 7)
- [ ] `backend/app/models/orders.py`: на `class Order` (рядом с `manager_id`/`coupon_id`,
      [orders.py:39](backend/app/models/orders.py#L39)) добавить
      `outlet_id: Mapped[int | None] = mapped_column(ForeignKey("outlets.id"), nullable=True, index=True)`
- [ ] Там же `outlet = relationship("Outlet")` (рядом с `items`/`events`, [orders.py:47](backend/app/models/orders.py#L47))
- [ ] **`Order.number` оставить `unique=True`** ([orders.py:25](backend/app/models/orders.py#L25)) — не трогаем (D7)
- [ ] **Нужен составной индекс** `Order(outlet_id, payment_status, created_at)` — под запрос счётчика (§7)

### 2.7 Связи и инварианты
- [ ] `Outlet` 1—N `Order` (`Order.outlet_id` nullable). В списках — `selectinload(Order.outlet)` (без N+1)
- [ ] `StaffUser` N—M `Outlet` через `staff_outlets`: super_admin = 0 строк (unscoped), manager = 1..N, screen = 1
- [ ] `Order.manager_id` (кто взял заказ) **ортогонален** `outlet_id` (точка заказа) — не путать при скоупинге
- [ ] Клиент (`User`) **НЕ** привязан к точке — точка живёт только на заказе

---

## 3. Миграции, сиды, бэкфилл (без Alembic)

Раннер: `Base.metadata.create_all` + `ensure_schema` (ALTER ADD COLUMN по PRAGMA) +
`backfill_*` — всё в `lifespan` ([main.py:17-30](backend/app/main.py#L17-L30)).

- [ ] **Импорт модели до `create_all`:** в `main.py` около [строки 14](backend/app/main.py#L14) добавить
      `from .models import outlet  # noqa: F401` (БЕЗ него таблицы не создадутся — §2)
- [ ] **Новые таблицы** (`outlets`, `staff_outlets`, `outlet_stop_items`, `outlet_drink_priorities`,
      `outlet_events`) — создаются `create_all` целиком (на свежей БД — с настоящими FK)
- [ ] **`orders.outlet_id`** — в `_ADD_COLUMNS` ([migrate.py:15](backend/app/services/migrate.py#L15))
      добавить `"orders": {"outlet_id": "INTEGER"}`. ⚠️ SQLite ALTER ADD COLUMN не вешает FK на
      существующую таблицу — остаётся «голый» INTEGER (как `drink_id`); FK живёт только на свежем
      `create_all`. Поэтому `outlet_id` **остаётся nullable**, наличие точки гарантируем на уровне
      приложения (`resolve_outlet`, §5).
- [ ] **`backfill_outlets(db)`** в `migrate.py` (идемпотентно, как `backfill_payments`):
  - [ ] если активной точки нет — создать дефолтную (`slug='main'`, active, `Asia/Dubai`, дефолтные `hours`)
  - [ ] `default_id` = **минимальный `id` активной точки** (детерминированно, не «первая попавшаяся»)
  - [ ] `UPDATE orders SET outlet_id=:default_id WHERE outlet_id IS NULL` (early-return, если NULL-строк нет)
  - [ ] каждому существующему `manager`/`screen` без строки в `staff_outlets` — добавить привязку к
        дефолтной точке (`is_primary=True`). super_admin — пропускаем (0 строк). ⚠️ Если на момент
        бэкфилла точек уже >1 — **screen-аккаунты не привязывать автоматически** (требовать ручного
        назначения, чтобы ТВ не привязался к чужой стойке)
- [ ] **Slug-бэкфилл точек** по аналогии с `backfill_category_slugs` (для созданных без slug)
- [ ] **Порядок в `lifespan`:** `create_all → ensure_schema → seed → backfill_category_slugs →
      backfill_sizes → localize_catalog_en → backfill_payments → **backfill_outlets** (последним)`
- [ ] **Единый владелец создания дефолтной точки** — `backfill_outlets` (НЕ внутри `seed()`: `seed`
      ранний-return при наличии каталога, и на «старых» БД точка не создалась бы). В `seed.py` — только
      привязка сид-стаффа, если идём по сид-пути; чтобы не было двойного создания — выбрать один путь.
- [ ] **Сиды** (`seed.py`): дефолтная точка `slug='main'`, `name={'ru':'JOOZ Главная','en':'JOOZ Main','ar':'…'}`,
      `daily_drink_limit=None`, дефолтные 7-дневные `hours`; привязать `manager@juicy.ae` (1 строка),
      `screen@juicy.ae` (1 строка), `admin@juicy.ae` (0 строк).

---

## 4. Сервисный слой (чистые функции, юнит-тестируемы до роутеров)

Новый модуль **`backend/app/services/outlet_service.py`** (или `outlet_status.py`) — единый источник правды.

- [ ] **`validate_hours(hours) -> None | raise 422 OUTLET_HOURS_INVALID`** — ключи `'0'..'6'`, значения
      списки `{open,close}` по `^\d{2}:\d{2}$`, `00:00 ≤ t ≤ 23:59`, `close > open` (интервалы через
      полночь — либо запретить, либо явно поддержать; рекоменд. для старта — запретить), без пересечений
- [ ] **`outlet_status(outlet, now_utc=None) -> 'inactive'|'closed'|'paused'|'open'`**:
  1. `not is_active` ⇒ `'inactive'`
  2. перевести `now` в `ZoneInfo(outlet.timezone)`; интервалы дня брать через `hours.get(str(weekday()), [])`
     (пусто/нет ключа ⇒ `'closed'`, **никогда KeyError**); если локальное время не в интервале ⇒ `'closed'`
  3. в часах, но `not accepting_orders` (или `auto_paused`) ⇒ `'paused'`
  4. иначе ⇒ `'open'`
  > Заказ можно создать **только при `'open'`**.
- [ ] **`today_intervals(outlet, now_local) -> list`** — интервалы сегодняшнего дня
- [ ] **`drinks_processed_today(db, outlet) -> int`** — `SUM(OrderItem.quantity)` join `Order` где
      `outlet_id==X`, `payment_status IN ('pending','paid')` (D2), `created_at` в окне сегодняшнего
      **локального календарного дня** точки, переведённого в UTC (оба края считать в TZ, не `+24h`)
- [ ] **`check_daily_limit(db, outlet, new_qty) -> raise 409 OUTLET_DAILY_LIMIT_REACHED`** — если
      `daily_drink_limit` не NULL и `processed + new_qty > limit` (строго `>`: ровно лимит — пропускаем)
- [ ] **`resolve_outlet(db, outlet_id) -> Outlet`** — посчитать **активные** точки: ровно 1 ⇒ вернуть её
      (игнорируя вход); >1 ⇒ требовать `outlet_id` (иначе 422 `OUTLET_REQUIRED`) и проверить, что активна
      (иначе 409 `OUTLET_INVALID`); 0 активных ⇒ 409 `OUTLET_INVALID`
- [ ] **`load_stop_sets(db, outlet_id) -> {'drink':set,'drink_category':set,'addon':set}`** — один запрос
      на запрос, проверка членства в Python (без N+1)
- [ ] **Авто-снятие паузы (D6):** при пересчёте статуса на новый локальный день, если `auto_paused` и
      `drinks_processed_today < limit` — считать точку не-paused (или сбрасывать флаг лениво)

---

## 5. Привязка заказа к точке + публичный API точки (REQ-6, REQ-5)

### Бэкенд
- [ ] `routers/orders.py`: в `OrderIn` ([orders.py:31](backend/app/routers/orders.py#L31)) добавить
      `outletId: int | None = None`
- [ ] `services/order_flow.py` `create_order`: `outlet = resolve_outlet(db, body.outletId)`;
      `if outlet_status(outlet) != 'open': raise HTTPException(409, 'OUTLET_CLOSED')`;
      проставить `outlet_id=outlet.id` в конструктор `Order(...)`; затем `check_daily_limit(...)` по сумме
      `quantity` (см. §7)
- [ ] **Ре-валидация корзины по точке:** в `create_order` проверить каждую позицию против стоп-сета
      резолвнутой точки (drink/category/addon застоплены ⇒ 409 `DRINK_NOT_AVAILABLE`/`ADDON_NOT_AVAILABLE`).
      Текущая проверка только `status=='published'` — стоп-лист она не ловит
- [ ] `order_payload` ([orders.py:40](backend/app/routers/orders.py#L40)): в **базовый** блок (он идёт в
      create+list+detail) добавить `"outletId": o.outlet_id` и
      `"outlet": {id, slug, name(t), address, emirate} if o.outlet else None`
- [ ] **Локаль для списка/деталки:** `my_orders`/`order_detail` уже инжектят `user` — передавать
      `user.preferred_locale` в `order_payload` (НЕ добавлять новый query-параметр; для `place_order`
      локаль уже есть)
- [ ] `my_orders` ([orders.py:85](backend/app/routers/orders.py#L85)): добавить `selectinload(Order.outlet)`
- [ ] **Новый публичный роутер `routers/outlets.py`** (`prefix="/api"`, без авторизации, как `catalog.py`):
  - [ ] `GET /api/outlets?locale=` — активные точки: `{id, slug, name, address, emirate, phone, lat, lng,
        timezone, status, openNow, acceptingOrders, todayHours, hours}` (status/openNow считаются на сервере)
  - [ ] `GET /api/outlets/{id}?locale=` — одна точка, 404 если нет/неактивна
  - [ ] зарегистрировать в `main.py` (импорт [53-55](backend/app/main.py#L53-L55) + `include_router`)
- [ ] **Инвариант D4:** эндпоинт `activate` (см. §9) запрещает/предупреждает о 2-й активной точке, пока
      на паблике нет пикера

### Edge cases (заложить тесты)
- [ ] 1 активная точка — `resolve_outlet` берёт её даже если фронт прислал другой `outletId`
- [ ] 0 активных — создание заказа падает 409 `OUTLET_INVALID` (не NoneType)
- [ ] Гонка «закрылись пока оформлял» — авторитетна серверная проверка `outlet_status != 'open'`
- [ ] Приоритет статусов: `inactive` > `closed` > `paused` > `open`; ордерить только при `open`
- [ ] Легаси-заказы (бэкфилл) показывают адрес дефолтной точки — это ок и ожидаемо

---

## 6. Стоп-лист и приоритеты по точке (REQ-3)

### Бэкенд — публичный каталог (решение D1: фильтруем)
- [ ] `routers/catalog.py` — пробросить точку (сервер сам резолвит **единственную активную**, фронт может
      не слать параметр):
  - [ ] `list_categories`: исключить категории из `stop_sets['drink_category']`
  - [ ] `list_drinks`: исключить `Drink.id` из `stop_sets['drink']` **и** напитки, чья `category_id` в
        `stop_sets['drink_category']` (каскад категории); LEFT JOIN `outlet_drink_priorities` и
        `order_by(pinned DESC, coalesce(sort, БОЛЬШОЕ), Drink.id)`
  - [ ] `drink_detail`: 404 если напиток/его категория застоплены; в фильтре линков добавить
        `addon_id not in stop_sets['addon']`
  - [ ] `drink_preview`: строить словарь линков без застопленных аддонов (застопленный ⇒ существующий 409
        `ADDON_NOT_AVAILABLE`). ⚠️ `outlet` пробрасывать **отдельным аргументом функции**, НЕ через
        `PreviewIn` (это тело запроса); поправить и сигнатуру роута, и внутренний вызов из `create_order`

### Бэкенд — админ-API стоп-листа/приоритетов (в `routers/admin_outlets.py`, `require_super_admin`)
- [ ] `GET /api/admin/outlets/{id}/stop-list` → `{drinks:[], categories:[], addons:[]}`
- [ ] `PUT /api/admin/outlets/{id}/stop-list` — полная замена (паттерн `clear()+re-add` как `set_bindings`/
      `set_sizes` в `admin_catalog.py`), валидировать id, эмитить `outlet_events` `stop_added/stop_removed`
- [ ] `POST /api/admin/outlets/{id}/stop-list/toggle` `{entityType, entityId}` — идемпотентный toggle для чекбокса
- [ ] `GET/PUT /api/admin/outlets/{id}/drink-priorities` — полная замена; если пришёл только список id ⇒ `sort=index`

### Edge cases
- [ ] Каскад категории: стоп категории убирает её напитки из `/api/drinks` (фильтр по `category_id`) и саму
      категорию из `/api/categories`
- [ ] Стоп-лист **не меняет** глобальные `Drink.status`/`Addon.is_active` и другие точки
- [ ] Аддон застоплен после добавления в корзину ⇒ `/preview` и `create_order` 409; фронт обрабатывает мягко
- [ ] Неизвестный/устаревший `outlet` в публичном запросе ⇒ фолбэк на единственную активную (паблик не падает)

---

## 7. Дневной счётчик/лимит (REQ-4)

Производное значение (без хранимого счётчика — не дрейфует, не двоится, сбрасывается сам в локальную полночь).

- [ ] `daily_drink_limit` на `outlets`: NULL ⇒ **без лимита** (проверка вообще пропускается)
- [ ] Подсчёт — `drinks_processed_today` (§4, D2/D3): `SUM(OrderItem.quantity)` по **оплаченным**
      (`payment_status == 'paid'`) заказам за сегодняшний локальный день TZ точки
- [ ] **Авторитетная проверка — в `mark_paid()`** (единый чокпоинт): после оплаты `refresh_limit_pause`
      сверяет живой счётчик с лимитом; при `>= limit` ⇒ `auto_paused=True` + `OutletEvent 'limit_reached'`
- [ ] **`runtime_status`** считает лимит вживую: если базовый статус `open` и `drinks_processed_today >= limit`
      ⇒ `paused`. Создание заказа (`create_order`) разрешено только при `open` ⇒ при достижении лимита
      новые заказы блокируются (409 `OUTLET_CLOSED`)
- [ ] **Снятие авто-паузы** (D6): счётчик живой и обнуляется на новый локальный день ⇒ `runtime_status`
      сам возвращает `open`, без хранимого «вечного» флага; ручную паузу (`accepting_orders=False`) это не трогает
- [ ] Составной индекс `Order(outlet_id, payment_status, created_at)` (§2.6) — иначе скан на каждом чекауте
- [ ] **Конкурентность:** на SQLite гонка read-then-write возможна (небольшой овершут — допустимо для MVP);
      на Postgres — `SELECT … FOR UPDATE` по строке точки. Задокументировать.
- [ ] Купонные напитки тоже считаются (их всё равно готовят) — `SUM(quantity)` без оглядки на `paid_by_coupon`

---

## 8. Роли, скоупинг и realtime (REQ-7, REQ-2)

- [ ] `core/security.py`: `get_staff_outlet_ids(staff, db) -> set[int] | None` — `None` для super_admin
      (= без фильтра), иначе множество `outlet_id` из `staff_outlets`. **Читать из БД**, не из JWT
      (токен живёт 30 дней — переназначение не должно обходиться стейлом)
- [ ] (D5) `require_manager_or_admin` — повесить на мутации заказов (`take`/`status`/`refund`), чтобы
      `screen` (ТВ) не мог менять заказы
- [ ] `routers/admin_orders.py`:
  - [ ] список ([admin_orders.py:18](backend/app/routers/admin_orders.py#L18)): `outlet_id: int | None = Query(None)`;
        `scope = get_staff_outlet_ids(...)`; если `scope is not None` ⇒ `q.where(Order.outlet_id.in_(scope))`;
        если super_admin и пришёл `outlet_id` ⇒ `q.where(Order.outlet_id == outlet_id)`; `selectinload(Order.outlet)`
  - [ ] detail/take/status/refund: если `scope is not None` и `o.outlet_id not in scope` ⇒ **404 NOT_FOUND**
        (не 403 — не палим существование заказов чужой точки)
- [ ] `routers/_serializers.py` `_order_row`: добавить `outletId` + блок `outlet {id, name(t), address}`
      (guard на `None` — `take/status/refund` зовут `_order_row` без преload точки; обеспечить ленивую
      подгрузку/консистентность, иначе блок мигает в null)
- [ ] `routers/screen.py` `screen_board`: `where(Order.outlet_id.in_(scope))` (у screen всегда ровно 1)
- [ ] `routers/staff.py`: `ManagerIn`/`ManagerPatch` + `outletIds: list[int]`; `_payload` отдаёт
      `outlets`/`outletIds`; в `create_manager`/`update_manager` — инварианты (super_admin=0, screen=1,
      manager≥1) ⇒ 422 `OUTLET_REQUIRED`/`OUTLET_SCOPE_INVALID`; полная замена строк `staff_outlets`
- [ ] **Realtime по точкам (REQ-7, в scope — не follow-up):** `routers/ws.py` `ws_admin` — подписывать
      manager/screen на канал(ы) `admin:orders:{outlet_id}`, super_admin — на все; `order_flow.notify()`
      публикует и в пер-точечный канал. Иначе номер заказа из WS-пейлоада течёт между точками даже при
      REST-скоупинге.
  > ⚠️ Pubsub — in-memory одного процесса ([core/pubsub.py](backend/app/core/pubsub.py)); горизонтальное
  > масштабирование (несколько инстансов) всё равно не работает без Redis — это отдельная задача, не
  > блокирует локации.

### Edge cases
- [ ] super_admin = 0 строк ⇒ `get_staff_outlet_ids` отдаёт `None` (НЕ пустое множество ⇒ не «ноль заказов»)
- [ ] manager/screen с 0 привязок ⇒ явное состояние «нет точки», не молчаливый пустой список
- [ ] Удаление точки каскадит `staff_outlets` ⇒ менеджер может остаться без точек: блокировать удаление
      точки с привязками/заказами, либо переназначать

---

## 9. Админка — UI (REQ-1, 2, 3, 4, 7)

> Существующие страницы `app/app/admin/outlets/**` — на **моках** (`lib/admin-mock.ts`), id строковые
> (`'bay-avenue'`). Переводим на реальное API; id — **числа** (через `Number(id)` в `[id]`-роуте).

### Навигация и API-клиент
- [ ] `components/admin/AdminShell.tsx` (NAV_GROUPS, ~строки 42-47): добавить пункт «Точки»
      `{ href:'/admin/outlets', label:'Точки', roles:['super_admin'] }` (сейчас раздел недостижим из сайдбара);
      заодно учесть роль `screen` в подписи топбара
- [ ] `lib/adminApi.ts`: тип `Outlet` + блок `outletApi` (по образцу `catalogApi`, `req<T>`/`reqList<T>`):
      `outlets()`, `outletsPaged()`, `outlet(id)`, `createOutlet`, `updateOutlet`, `activateOutlet`,
      `deactivateOutlet`, `outletStopList`/`setOutletStopList`, `setOutletPriorities`,
      `attachStaff`/`detachStaff`, `outletStats(id)`; расширить `Staff` (`outlets?`/`outletIds?`),
      `AdminOrder` (`outletId?`/`outlet?`), query заказов — `&outlet_id=`
  > ⚠️ Списки админки = **голый JSON-массив + заголовок `X-Total-Count`** (конвенция `reqList`/`usePaged`).
  > Обёртка `{items,total}` сломает пагинацию.

### Бэкенд — `routers/admin_outlets.py` (новый, `dependencies=[Depends(require_super_admin)]`)
- [ ] `GET /api/admin/outlets?limit&offset&active` — массив + `X-Total-Count`
- [ ] `GET /api/admin/outlets/{id}` — Outlet + `status` + блок `managers` (привязанный стафф — только
      super_admin) + `drinksToday`/`dailyDrinkLimit`/`limitRemaining`/`runtimeStatus`
- [ ] `POST /api/admin/outlets` — create (с `validate_hours`, проверкой уникальности slug, lat/lng/tz)
- [ ] `PATCH /api/admin/outlets/{id}` — частичный апдейт (name/address/phone/email/lat/lng/hours/
      dailyDrinkLimit/timezone/sort/acceptingOrders), эмит `hours_changed`/`limit_changed`/`paused`/`resumed`
- [ ] `POST .../activate` + `POST .../deactivate` — флип `is_active` + `outlet_events`. ⚠️ **Запрет
      деактивации последней активной точки** (иначе весь паблик-чекаут падает 409). ⚠️ **D4:** при
      активации 2-й активной — предупреждение/блок (на паблике нет пикера)
- [ ] стоп-лист/приоритеты — см. §6
- [ ] `POST/DELETE .../{id}/staff` — attach/detach **или** через `staff PATCH outletIds` (выбрать один
      источник правды — рекоменд.: `staff PATCH`, а модалка «Назначить» на точке зовёт его же)
- [ ] `GET /api/admin/outlets/{id}/events?limit&offset` — **чтение аудита** (REQ-5; иначе таблица write-only)

### Фронт — страницы
- [ ] `app/app/admin/outlets/page.tsx` — переписать с мока на `usePaged(outletApi.outletsPaged)`; пилюля
      статуса из API; «создать» → `createOutlet` → переход на деталку; убрать мок-матрицу Меню×Точки
      (стоп-лист переезжает на деталку); self-guard `staff.role==='super_admin'`
- [ ] `app/app/admin/outlets/[id]/page.tsx`:
  - [ ] таб **main** — контролируемые инпуты всех полей (phone/address/emirate/email/lat/lng/dailyDrinkLimit),
        сохранение `updateOutlet`; «Закрыть точку» → `deactivateOutlet` + действие activate; вместо
        хардкода «Сегодня 42» — реальный `drinksToday` + лимит/остаток; пилюля `runtimeStatus`; мини-карта
        по lat/lng (или ссылка)
  - [ ] таб **hours** — состояние из `outlet.hours` (ключи `'0'..'6'`, списки `{open,close}`) вместо
        7 хардкод-инпутов; сохранение `updateOutlet`
  - [ ] таб **staff** — список из `outlet.managers` (super_admin); кнопка «Открыть карточку» →
        `/admin/staff/${u.id}`; модалка «Назначить» → attach; действие detach
  - [ ] таб **menu** — стоп-лист (drink/category/addon) и приоритеты из реального API; тумблер «в стоп-листе»
        → `toggleStop`/`setOutletStopList`; «Массовый стоп»/«Сбросить» → bulk PUT; источник строк —
        `catalogApi.drinks()` (не мок)
- [ ] `app/app/admin/staff/new/page.tsx` + `[id]/page.tsx` — поле привязки точек после выбора роли:
      manager = мульти-селект (≥1), screen = одиночный (ровно 1), super_admin = скрыто; `outletIds` в
      `createManager`/`updateManager`; клиентская валидация + маппинг 422 `OUTLET_REQUIRED`/`OUTLET_SCOPE_INVALID`
- [ ] `app/app/admin/orders/page.tsx` — для super_admin селект точки (+ «все точки») → `outlet_id` в фетчер
      и deps `usePaged`; для manager/screen — пикер скрыт, бэкенд сам скоупит; опц. строка с названием точки
      под заказом (для super_admin в режиме «все»)

---

## 10. Публичный сайт — СТРОГО МИНИМУМ (REQ-5, REQ-6)

Ровно три вещи. Всё остальное по точке на паблике — **не делаем** (см. §12).

- [ ] `lib/api.ts`: тип `ApiOutlet` + методы `api.outlets(locale)` / `api.outlet(id, locale)`; расширить
      `ApiOrder` (`outletId?`, `outlet?{id,name,address,emirate?}`); в теле `placeOrder` — опц. `outletId?`
- [ ] `lib/useOutlet.ts` (новый, **только паблик**): на маунте `api.outlets(locale)`, выбрать активную
      (единственную), вернуть `{outlet, loading}` — единственное место, где паблик узнаёт точку/`openNow`/
      адрес/`todayHours`. **Без пикера.**
- [ ] `lib/store.ts`: `selectedOutletId` сейчас мок-строка (`'bay-avenue'`) — сделать `number`, bump
      `persist version 2→3` + `migrate()` чистит стейл-строку; `app/page.tsx` (сплеш) убрать авто-выбор
      мок-точки
- [ ] **(1) Адрес + часы под лого** — `app/app/home/page.tsx` (хедер с лого, ~строки 81-84): под лого
      мелкая строка — `outlet.address` + сегодняшние часы из `outlet.todayHours` (или «Закрыто», если
      `status!='open'`); тот же white-shadow для читабельности; данные из `useOutlet()`
- [ ] **(2) Гейт оформления по часам** — `app/app/checkout/page.tsx`: `outletOpen = outlet?.openNow ?? true`
      в `canSubmit`; в `submit()` передать `outletId: outlet?.id`; если закрыто — короткий замыкание +
      локализованная ошибка + дизейбл/релейбл кнопки; в `catch` мапить 409 `OUTLET_CLOSED`/
      `OUTLET_DAILY_LIMIT_REACHED` / 422 `OUTLET_REQUIRED` в дружелюбный текст
- [ ] **(3) Блок точки в заказе** — `app/app/orders/[id]/page.tsx`: блок (как meta/curbside-блоки)
      с `order.outlet?.name` + `order.outlet?.address` (+ emirate), лейбл «Точка» (страница «заказ создан»
      — это та же `/orders/[id]`, отдельного экрана не надо); `app/app/orders/page.tsx`: одна строка
      с названием точки под позициями
- [ ] Обработать стэйл-строку корзины: позиция, чей напиток/аддон застоплен на резолвнутой точке ⇒ мягкое
      «недоступно» + удаление (по образцу фильтра легаси-строк в чекауте)

---

## 11. Аудит событий (REQ-5)

- [ ] Назначить **эмиттер каждому типу** `OutletEvent`:
  - `activated`/`deactivated` → эндпоинты activate/deactivate
  - `hours_changed`/`limit_changed` → PATCH
  - `paused`/`resumed` → флип `accepting_orders`
  - `staff_attached`/`staff_detached` → staff PATCH / attach
  - `stop_added`/`stop_removed` → diff стоп-листа (PUT/toggle)
  - `limit_reached` → `create_order` (`by_staff_id=NULL`)
- [ ] `GET /api/admin/outlets/{id}/events` (пагинация) + индекс `(outlet_id, created_at)`
- [ ] Аудит — **только бэкенд/админка**, на паблик не выводим

---

## 12. Что НЕ делаем (anti-scope — чтобы стейл-подсказки не реализовали лишнее)

- [ ] ❌ Пикер точки / редизайн выбора точки на **публичном** сайте
- [ ] ❌ Карта/«рядом со мной»/расстояния на паблике (хотя `lat/lng/phone` в API есть — на паблике их **не рисуем**)
- [ ] ❌ Адрес/часы где-либо на паблике, кроме строки под лого на `home` (НЕ на `product/[slug]`)
- [ ] ❌ Телефон/часы в блоке заказа (только **название + адрес**)
- [ ] ❌ Клиентский расчёт open/closed (фронт берёт только серверный `openNow`)
- [ ] ❌ Вывод аудита/`outlet_events` на паблике; CRUD/редактор часов на паблике
- [ ] ❌ Колонка `staff_users.outlet_id` (используем M2M `staff_outlets`)
- [ ] ❌ Нумерация заказов по точкам / использование `Outlet.order_counter` (оставляем глобальный `number`)
- [ ] ❌ Дормантные `OutletArt.tsx` и мок-страницу `app/app/outlets/` не подключаем

---

## 13. Тесты (`backend/tests/`, pytest)

- [ ] `outlet_status`: inactive / closed (вне часов) / paused (ручная и авто) / open; `hours={}` ⇒ closed; TZ
- [ ] `validate_hours`: валидные/битые ключи, формат, `close<=open`, пересечения
- [ ] `resolve_outlet`: 1 активная (игнор входа), >1 (требует `outletId`, 422), 0 активных (409)
- [ ] `create_order`: проставляет `outlet_id`; 409 при закрытой/неактивной; ре-валидация стоп-листа (409)
- [ ] счётчик: NULL=без лимита; граница `==limit` ок, `>limit` 409; авто-пауза + снятие на новый день
- [ ] стоп-лист: каскад категории; аддон-стоп в `/preview` и `create_order`; глобальные флаги не меняются
- [ ] скоупинг: manager видит только свою точку; super_admin все + фильтр; out-of-scope detail/take ⇒ 404;
      screen read-only (мутации запрещены)
- [ ] staff-инварианты: super_admin=0, screen=1, manager≥1 ⇒ 422
- [ ] миграция/бэкфилл: легаси-заказы → дефолтная точка; сид-стафф привязан; идемпотентность повторного запуска
- [ ] order_payload содержит `outletId`+`outlet{address}` в create/list/detail; локаль из `preferred_locale`
- [ ] e2e (`app/e2e`): адрес под лого; чекаут заблокирован когда закрыто; блок точки в деталке заказа

---

## 14. Порядок выполнения

1. [ ] **Модель** (`models/outlet.py` 5 таблиц + `Order.outlet_id`/relationship + индекс) **и импорт в `main.py` до `create_all`**
2. [ ] **Миграции/сиды/бэкфилл** (`backfill_outlets` последним; единый владелец дефолтной точки)
3. [ ] **Сервисный слой** (`outlet_service.py`: status/resolve/счётчик/`validate_hours`) + юнит-тесты
4. [ ] **Заказ ↔ точка** (`OrderIn.outletId`, `resolve_outlet`+гейты в `create_order`, `order_payload`, локаль)
5. [ ] **Скоупинг ролей** (`get_staff_outlet_ids`, `admin_orders`/`screen` фильтры, 404 out-of-scope, `screen` read-only, staff `outletIds`+инварианты)
6. [ ] **Админ-CRUD точек** (`admin_outlets.py`: list/get/create/patch/activate/deactivate + стоп-лист/приоритеты + аудит-чтение; запрет деактивации последней; warning на 2-ю активную)
7. [ ] **Публичный `/api/outlets`** (+ `/{id}`)
8. [ ] **Публичный каталог по стоп-листу** (D1) — фильтрация `catalog.py` по единственной активной точке
9. [ ] **Фронт-паблик минимум** (store v3, `useOutlet`, адрес под лого, гейт чекаута, блок точки)
10. [ ] **Фронт-админка** (`outletApi`, переписать outlets list/detail с мока, привязка стаффа, фильтр заказов)
11. [ ] **Realtime по точкам** (`ws.py` + `notify` пер-точечные каналы)

---

## 15. Definition of Done — маппинг на требования

- [ ] **REQ-1** — super_admin создаёт/активирует/деактивирует точку; флаг активности; рабочие часы
      (формат + валидатор); список привязанных менеджеров на деталке; телефон/адрес/lat/lng/часы/почта → §2.1, §9
- [ ] **REQ-2** — привязка сотрудника к точке (M2M `staff_outlets`, UI в staff и на точке) → §2.2, §8, §9
- [ ] **REQ-3** — стоп-лист (drink/category/addon) + приоритеты на точке; публичный каталог их чтит (D1) → §6
- [ ] **REQ-4** — дневной лимит напитков (NULL=без лимита), окно = локальный день в рабочие часы, авто-пауза → §7
- [ ] **REQ-5** — статус точки open/paused/closed/inactive из часов+флага; `openNow` на паблике; аудит событий → §4, §5, §11
- [ ] **REQ-6** — заказ привязан к точке (дефолт при 1, требование выбора при >1 активной); `outletId`+адрес
      в ответе create/list/detail → §5
- [ ] **REQ-7** — super_admin все/фильтр по точке; manager/screen скоуп по своей точке (REST + realtime) → §8

---

## Приложение. Открытые вопросы (если рекомендации D1–D8 не подходят)

- Нужна ли нумерация заказов по точкам сейчас? (план: нет — D7)
- Считать лимит только по `paid` (точнее «обработано», но обходится неоплаченными) vs `pending+paid` (план: pending+paid — D2)
- Окно лимита: календарный день vs строго рабочее окно (план: календарный день + open-gate — D3)
- Перекрытие интервалов через полночь в `hours` — запрещаем или поддерживаем (план: запрещаем на старте)
- Эмбед интерактивной карты в админке vs lat/lng + ссылка (план: ссылка/мини-карта — D8)
- Несколько активных точек на паблике без пикера (план: инвариант «1 активная», пока нет пикера — D4)
