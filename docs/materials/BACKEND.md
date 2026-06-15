# Juicy MVP — требования к бэкенду и админке

Документ описывает контракт между frontend-only прототипом (`/app`) и будущим бэкендом + админкой. Все типы выведены из реально используемых в `app/lib/data.ts` / `app/lib/store.ts` и расширены под админку, KDS, интеграции и платежи.

Каждый раздел помечен **[MVP]** / **[V2]** — что входит в первый релиз, что закладывается архитектурно, но реализуется позже.

---

## 0. Глоссарий ролей

| Роль | Кто | Где работает |
|---|---|---|
| `customer` | Клиент | mobile-web (этот прототип) |
| `barista` | Бариста / повар | KDS-планшет на точке |
| `outlet_manager` | Менеджер точки | админ-веб (десктоп) |
| `catalog_admin` | Контент-менеджер сети | админ-веб |
| `finance` | Бухгалтер / финансы | админ-веб, read-only + рефанды |
| `support` | Поддержка | админ-веб, read-only + ручная отмена/refund |
| `super_admin` | DevOps / владелец | все права |

Авторизация — единый JWT с `roles: string[]` и `outletScope: string[] | "*"` (массив outletId, к которым роль применима, или `*` для сетевых).

---

## 1. Архитектура и нефункциональные требования

### Стек (предложение)
- **FastAPI** + **PostgreSQL 15** + **Redis** (rate-limit / OTP / pub-sub)
- **S3-совместимое хранилище** (CloudFront / Bunny) для медиа: видео, постеры, PNG аддонов
- **Tap Payments** (UAE-резидент) — карты + Apple Pay + Google Pay
- **Tabby** + **Tamara** **[V2]** — BNPL, популярны в MENA
- **Twilio Verify** или **Unifonic** (локальный UAE-провайдер, дешевле) — SMS-OTP
- **SSE** для статусов клиенту, **WebSocket** для KDS (двунаправленный)
- **MQTT** или **Pusher** **[V2]** — push-уведомления на тепловой принтер чеков
- **Sentry** + **OpenTelemetry** трейсы
- Хостинг — `me-central-1` (Bahrain) или `eu-central-1`; PDPL-compliance UAE

### NFR
| Параметр | Цель MVP | V2 |
|---|---|---|
| p95 latency `/catalog` | < 200 ms | < 100 ms (CDN edge) |
| p95 latency `POST /orders` | < 400 ms | < 250 ms |
| Доступность | 99.5% | 99.9% |
| Локализация | `ru`, `en` (готовность `ar` RTL) | `ar` enable |
| Currency | AED, decimal-string `"12.50"` | multi-currency через display-layer |
| VAT | 5%, считается на бэке | TRN-привязка к outlet |
| Auth | Bearer JWT (15 min) + refresh (30 d, rotation) | + WebAuthn для админки |
| Idempotency | `Idempotency-Key` обязателен для всех мутаций | + dedup по бизнес-ключу 24h |
| Rate-limit | 3 OTP/телефон/10 мин; 60 RPS/IP | dynamic, per-tenant |

### Заголовки запроса
```
Authorization: Bearer <jwt>
Accept-Language: ru
X-Client: juicy-web/1.0.0
X-Outlet-Id: bay-avenue
Idempotency-Key: <uuid>
```

---

## 2. Доменная модель

### 2.1 Outlet
```ts
type Outlet = {
  id: string;                  // "bay-avenue"
  name: string;
  address: string;
  city: "Dubai" | "Abu Dhabi" | "Sharjah" | "Ajman" | "Ras Al Khaimah" | "Fujairah" | "Umm Al Quwain";
  geo: { lat: number; lng: number };
  hours: WeeklyHours;          // 7-дневное расписание
  isOpen: boolean;             // computed (TZ Asia/Dubai)
  closingSoon?: boolean;       // < 30 мин до закрытия
  trn?: string;                // VAT TRN для чеков
  printerWebhook?: string;     // куда слать чек-задание (V2)
};
```

### 2.2 Category
```ts
type Category = {
  slug: string;
  name: { ru: string; en: string; ar?: string };
  emoji?: string;
  sortOrder: number;
  visible: boolean;
};
```

### 2.3 Product — расширенный
```ts
type Nutrition = {
  calories: number;        // ккал
  protein: number;         // г
  fat: number;             // г
  carbs: number;           // г
  sugar?: number;          // г, для напитков критично
  fiber?: number;
  weightG: number;         // базовый вес/объём продукта в граммах
};

type Variant = {
  code: "S" | "M" | "L" | string; // "S"/"M"/"L" для напитков, кастомные для еды
  name: { ru: string; en: string };
  volumeMl?: number;
  weightG?: number;
  priceAed: string;        // "12.50"
  nutritionMod: Partial<Nutrition>; // дельта к base
  inStock: boolean;        // per-outlet
};

type Media = {
  videoUrl?: string;       // mp4 720x1280, ≤ 800 KB, loop
  posterUrl: string;       // ОБЯЗАТЕЛЬНО — превью первого кадра (JPEG, ≤ 50 KB)
  pngUrl?: string;         // прозрачный PNG для каталога/превью без видео
  bgColor: string;         // HEX, заливка пока медиа грузится
};

type Product = {
  id: string;
  slug: string;
  categorySlug: string;
  name: { ru: string; en: string; ar?: string };
  description: { ru: string; en: string; ar?: string };
  badge?: "BESTSELLER" | "NEW" | "LIMITED" | "SEASONAL";
  baseNutrition: Nutrition;       // КБЖУ базы продукта (без аддонов, размер M)
  variants: Variant[];
  addonGroupBindings: AddonGroupBinding[];  // см. § 2.5
  media: Media;
  tags: string[];                  // "vegan", "gluten-free", "no-sugar-option"
  inStock: boolean;                // per-outlet, override mass-управление через 2.6
  visible: boolean;
  prepTimeSec: number;             // оценка для ETA в KDS
  sortOrder: number;
};
```

### 2.4 Addon — гибкий

Доп описывается на трёх уровнях:
1. **Операционный unit** — что показываем клиенту (1 shot / 1 scoop / 1 порция / 200 мл)
2. **Доза** — сколько одна unit весит в реальных `g` или `ml` (1 shot = 25 ml, 1 scoop = 15 g)
3. **КБЖУ на 100** — нормализованная пищевая ценность; бэк пересчитывает на конкретную дозу

```ts
type OperUnit = "shot" | "scoop" | "piece" | "portion" | "ml" | "g";
type DoseUnit = "g" | "ml";   // итог всегда нормализуем в g или ml — нет "liter"; 1 л = 1000 мл

type Addon = {
  id: string;                         // "ginger-shot"
  name: { ru: string; en: string; ar?: string };
  pngUrl: string;                     // ОБЯЗАТЕЛЬНО — прозрачный PNG ≤ 30 KB

  // — как клиент выбирает —
  unit: OperUnit;                     // "shot" / "scoop" / "ml" / ...

  // — что одна unit = в граммах/миллилитрах —
  doseAmount: number;                 // 25
  doseUnit: DoseUnit;                 // "ml"  → итого 1 shot = 25 ml

  // — пищевая ценность на 100 g/ml (того же doseUnit) —
  nutritionPer100: Nutrition;

  // — базовая цена за один operational unit —
  pricePerUnitAed: string;            // используется ЕСЛИ в связке с блюдом нет override

  allergens: string[];
  tags: string[];
  visible: boolean;
};
```

> **Расчёт КБЖУ на заказ**:
> `addonContribution = (doseAmount × qty / 100) × nutritionPer100`
> Бэк считает, фронт показывает live по той же формуле.
>
> **Пример**. Овсяное молоко: `unit="ml"`, `doseAmount=200`, `doseUnit="ml"`, `nutritionPer100={kcal:47, ...}` → одна порция 200 мл = **94 ккал**, 2 порции = 188 ккал.
> Шот эспрессо: `unit="shot"`, `doseAmount=25`, `doseUnit="ml"`, `nutritionPer100={kcal:9, ...}` → 2 шота = `25 × 2 / 100 × 9` ≈ **4.5 ккал**.

### 2.4.1 Цена и доза **в контексте блюда**

`product_addon_overrides` (junction product↔addon) перекрывает базовые значения **только для одной связки**:

```ts
type AddonOverride = {
  productId: string;
  addonId: string;

  // лимиты в этом блюде
  minUnits?: number;                  // например, у "молока" в латте min=1, у "сиропа" min=0
  maxUnits?: number;                  // не больше 4 шотов в любом коф. напитке
  defaultUnits?: number;              // что предвыбрано

  // ЦЕНА — перекрывает addon.pricePerUnitAed для этого блюда
  pricePerUnitAedOverride?: string;   // "молоко в латте = 0 AED" → "0.00"
  free?: boolean;                     // явный флаг "бесплатно"; эквивалентно pricePerUnitAedOverride="0.00"

  // ДОЗА — иногда «обычное молоко» в латте 200 ml, а в раф-таро 150 ml
  doseAmountOverride?: number;        // если null — используется addon.doseAmount

  hidden?: boolean;                   // скрыть этот доп в этом блюде
};
```

Алгоритм резолва цены/дозы на момент создания заказа:

```
effectivePrice = override.pricePerUnitAedOverride
              ?? (override.free ? "0.00" : addon.pricePerUnitAed)
effectiveDose  = override.doseAmountOverride ?? addon.doseAmount
effectiveMax   = override.maxUnits           ?? Infinity
```

Оба значения **снэпшотятся** в `order_item_addons.unit_price_aed_snapshot` и `weight_g_snapshot` — изменение каталога постфактум не ломает историю заказов.

### 2.5 AddonGroup и **AddonGroupBinding** (продукт ↔ группа)
```ts
type AddonGroup = {
  slug: string;                    // "milk", "extras", "syrups"
  name: { ru: string; en: string };
  selectionType: "single" | "multi" | "counter";
  items: string[];                 // addon ids
  visible: boolean;
};

// Связь продукт ↔ группа: вот тут живут правила «можно/нельзя/сколько»
type AddonGroupBinding = {
  groupSlug: string;
  required: boolean;               // надо ли вообще выбрать что-то
  minTotal?: number;               // минимум суммарных units по группе
  maxTotal?: number;               // максимум суммарных units
  defaultAddonIds?: string[];      // что предвыбрано (для "single" — один)
  // override-цена / -лимиты для конкретного addon в контексте этого продукта:
  overrides?: AddonOverride[];
};

type AddonOverride = {
  addonId: string;
  minUnits?: number;               // минимум для этого аддона в этом продукте
  maxUnits?: number;               // максимум (например, 4 шота макс)
  defaultUnits?: number;
  pricePerUnitAed?: string;        // переопределение цены (например, "молоко" бесплатно в латте)
  free?: boolean;                  // явный флаг «бесплатно для этого блюда»
  hidden?: boolean;                // скрыть конкретный addon в контексте этого продукта
};
```

### 2.6 Правила комбинирования (compatibility rules)
Отдельная таблица — чтобы редактировать в админке без кодинга:

```ts
type CompatibilityRule = {
  id: string;
  scope: "product" | "global";     // действует ли только внутри одного продукта или везде
  productSlug?: string;            // если scope = product
  // конъюнкция: правило срабатывает, когда выбраны все эти аддоны
  when: { addonId: string; minUnits?: number }[];
  // действие:
  effect:
    | { type: "forbid"; addonId: string; message?: { ru: string; en: string } }
    | { type: "auto-add"; addonId: string; units: number }
    | { type: "require"; groupSlug: string }
    | { type: "discount-percent"; percent: number };
};
```

Примеры:
- `when: [milk-oat]` + `effect: forbid milk-regular` — нельзя двойное молоко
- `when: [shot-decaf]` + `effect: forbid shot-regular` — кофеин/без-кофеин взаимоисключение
- `when: [croissant, hot-chocolate]` + `effect: discount-percent 10` — комбо

Движок: при каждом изменении выбранных аддонов фронт делает `POST /products/{slug}/preview` с текущим выбором — бэк отдаёт `{ allowedAddons, forbiddenAddons[], autoAdded[], priceAed, nutrition }`. Это снимает с фронта необходимость знать формулы.

### 2.7 OutletInventory (управление наличием) **[MVP минимально, V2 полноценно]**
```ts
type OutletInventory = {
  outletId: string;
  productOverrides: { productId: string; inStock: boolean }[];
  addonOverrides: { addonId: string; inStock: boolean }[];
  variantOverrides: { productId: string; variantCode: string; inStock: boolean }[];
};
```

MVP: менеджер точки нажимает «стоп» на блюде/аддоне → запись в `productOverrides`.
V2: интеграция с системой учёта (1С / IIKO / Poster) — стоп-листы по остаткам автоматически.

### 2.8 Order (без изменений, дополнено)
```ts
type OrderStatus =
  | "CREATED" | "PAID" | "ACCEPTED" | "PREPARING"
  | "READY" | "PICKED_UP" | "CANCELLED" | "REFUNDED";

type OrderItem = {
  productId: string;
  variantCode: string;
  quantity: number;
  customName?: string;
  addons: { addonId: string; groupSlug: string; units: number }[];
  // snapshot — для аудита и неизменности цены/КБЖУ после заказа
  productNameSnapshot: { ru: string; en: string };
  unitPriceAedSnapshot: string;
  nutritionSnapshot: Nutrition;
};

type Order = {
  id: string;                      // "ord-<ksuid>"
  number: number;                  // публичный 4-значный (1247)
  createdAt: string;
  outletId: string;
  items: OrderItem[];
  subtotalAed: string;
  vatAed: string;
  discountAed: string;             // от промокода/комбо-правила
  totalAed: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string; byRole?: string }[];
  payment: {
    method: PaymentMethod;
    providerChargeId?: string;
    providerStatus?: string;
  };
  pickup: {
    car?: { emirate: string; plate: string };
    scheduledFor?: string;
    arrivedAt?: string;
  };
  customer: { id?: string; name?: string; phone: string };
  baristaId?: string;              // кто взял в работу
  prepEtaSec?: number;             // ETA на момент ACCEPTED
};
```

### 2.9 Customer / User
```ts
type User = {
  id: string;
  phone: string;
  name?: string;
  email?: string;                  // V2
  defaultEmirate?: string;
  defaultCarPlate?: string;
  preferredLocale: "ru" | "en" | "ar";
  marketingOptIn: boolean;
  createdAt: string;
  blocked: boolean;                // support может заблокировать
};

// Только для админки:
type StaffUser = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  outletScope: string[] | "*";
  twoFactorEnabled: boolean;       // V2 обязательно
  lastLoginAt?: string;
  disabled: boolean;
};
```

---

## 2.10 Схема БД (PostgreSQL)

Карта таблиц — что хранится напрямую, что через junction (many-to-many и линки с метаданными). Каждая колонка `*_id` — UUID или KSUID; FK с `ON DELETE RESTRICT` если не указано иное; всё через миграции (Alembic). Soft-delete через `deleted_at TIMESTAMPTZ` на таблицах, помеченных †.

### Основные таблицы

```sql
-- ============== Каталог ==============
CREATE TABLE categories (
  slug          TEXT PRIMARY KEY,         -- "fresh", "coffee"
  name_ru       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  name_ar       TEXT,
  emoji         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  visible       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE products (                    -- †
  id            UUID PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  name_ru       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  name_ar       TEXT,
  description_ru TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_ar TEXT,
  badge         TEXT,                      -- ENUM BESTSELLER|NEW|LIMITED|SEASONAL
  -- КБЖУ базы (без аддонов, для размера M)
  base_calories  INT NOT NULL,
  base_protein   NUMERIC(6,2) NOT NULL,
  base_fat       NUMERIC(6,2) NOT NULL,
  base_carbs     NUMERIC(6,2) NOT NULL,
  base_sugar     NUMERIC(6,2),
  base_fiber     NUMERIC(6,2),
  base_weight_g  INT NOT NULL,
  -- Медиа (превью + видео — отдельные поля)
  poster_url    TEXT NOT NULL,             -- ОБЯЗАТЕЛЬНО (JPEG первого кадра)
  video_url     TEXT,                      -- mp4 720x1280, опционально
  png_url       TEXT,                      -- прозрачный PNG, опционально
  bg_color      TEXT NOT NULL,             -- HEX заливка
  tags          TEXT[] NOT NULL DEFAULT '{}',
  prep_time_sec INT NOT NULL DEFAULT 90,
  sort_order    INT NOT NULL DEFAULT 0,
  visible       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_products_category ON products(category_slug) WHERE deleted_at IS NULL;

CREATE TABLE product_variants (
  id            UUID PRIMARY KEY,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,             -- "S"/"M"/"L"
  name_ru       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  volume_ml     INT,
  weight_g      INT,
  price_aed     NUMERIC(8,2) NOT NULL,
  calories_mod  INT NOT NULL DEFAULT 0,
  protein_mod   NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_mod       NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_mod     NUMERIC(6,2) NOT NULL DEFAULT 0,
  sort_order    INT NOT NULL DEFAULT 0,
  UNIQUE (product_id, code)
);

CREATE TABLE addons (                       -- †
  id            UUID PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,       -- "ginger-shot"
  name_ru       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  name_ar       TEXT,
  png_url       TEXT NOT NULL,              -- ОБЯЗАТЕЛЬНО, прозрачный PNG
  -- Операционная единица (что выбирает клиент)
  unit          TEXT NOT NULL,              -- shot|scoop|piece|portion|ml|g
  -- Реальная доза одной unit (для пересчёта КБЖУ и веса в чеке)
  dose_amount   NUMERIC(8,2) NOT NULL,      -- 25 / 15 / 200
  dose_unit     TEXT NOT NULL,              -- g|ml  (литры нормализуем в ml)
  -- КБЖУ НА 100 единиц dose_unit — бэк сам пересчитывает на dose_amount
  kcal_per_100      NUMERIC(8,2) NOT NULL,
  protein_per_100   NUMERIC(6,2) NOT NULL,
  fat_per_100       NUMERIC(6,2) NOT NULL,
  carbs_per_100     NUMERIC(6,2) NOT NULL,
  sugar_per_100     NUMERIC(6,2),
  -- Базовая цена за одну operational unit (если нет override в product_addon_overrides)
  price_per_unit_aed NUMERIC(8,2) NOT NULL,
  allergens     TEXT[] NOT NULL DEFAULT '{}',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  visible       BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at    TIMESTAMPTZ,
  CHECK (dose_unit IN ('g','ml'))
);

CREATE TABLE addon_groups (                 -- †
  slug          TEXT PRIMARY KEY,           -- "milk", "syrups"
  name_ru       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  selection_type TEXT NOT NULL,             -- single|multi|counter
  visible       BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE compatibility_rules (
  id            UUID PRIMARY KEY,
  scope         TEXT NOT NULL,              -- global|product
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  -- when: jsonb массив [{ addon_id, min_units? }]
  when_json     JSONB NOT NULL,
  -- effect: jsonb { type: forbid|auto-add|require|discount-percent, ... }
  effect_json   JSONB NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  note          TEXT,                       -- зачем правило (видно в админке)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (scope = 'global' OR product_id IS NOT NULL)
);

-- ============== Точки ==============
CREATE TABLE outlets (                      -- †
  id            TEXT PRIMARY KEY,           -- "bay-avenue" — slug
  name          TEXT NOT NULL,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  lat           NUMERIC(9,6) NOT NULL,
  lng           NUMERIC(9,6) NOT NULL,
  hours_json    JSONB NOT NULL,             -- { mon: ["07:00","22:30"], ... }
  trn           TEXT,                       -- VAT TRN на чеке
  printer_url   TEXT,                       -- V2
  visible       BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at    TIMESTAMPTZ
);

-- ============== Пользователи ==============
CREATE TABLE users (                        -- клиенты †
  id            UUID PRIMARY KEY,
  phone         TEXT NOT NULL UNIQUE,
  name          TEXT,
  email         TEXT,
  default_emirate TEXT,
  default_car_plate TEXT,
  preferred_locale TEXT NOT NULL DEFAULT 'ru',
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  blocked       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ                 -- PDPL self-delete
);

CREATE TABLE staff_users (                  -- сотрудники
  id            UUID PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,              -- argon2id
  name          TEXT NOT NULL,
  two_factor_secret TEXT,                   -- V2
  last_login_at TIMESTAMPTZ,
  disabled      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  code          TEXT PRIMARY KEY,           -- "barista","outlet_manager","catalog_admin","finance","support","super_admin"
  name          TEXT NOT NULL,
  permissions   TEXT[] NOT NULL             -- ["catalog:write","orders:read",...] — RBAC granular
);

-- ============== Заказы ==============
CREATE TABLE orders (
  id            TEXT PRIMARY KEY,           -- "ord-<ksuid>"
  number        INT NOT NULL UNIQUE,        -- публичный 4-значный
  user_id       UUID REFERENCES users(id),  -- nullable: гость
  outlet_id     TEXT NOT NULL REFERENCES outlets(id),
  status        TEXT NOT NULL,              -- enum
  subtotal_aed  NUMERIC(10,2) NOT NULL,
  vat_aed       NUMERIC(10,2) NOT NULL,
  discount_aed  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_aed     NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_provider_charge_id TEXT,
  payment_provider_status TEXT,
  car_emirate   TEXT,
  car_plate     TEXT,
  scheduled_for TIMESTAMPTZ,
  arrived_at    TIMESTAMPTZ,
  customer_name_snapshot TEXT,
  customer_phone_snapshot TEXT NOT NULL,
  barista_id    UUID REFERENCES staff_users(id),
  prep_eta_sec  INT,
  idempotency_key TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);
CREATE INDEX idx_orders_outlet_status ON orders(outlet_id, status, created_at DESC);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  variant_code  TEXT NOT NULL,
  quantity      INT NOT NULL,
  custom_name   TEXT,
  -- SNAPSHOT — неизменны после создания
  product_name_snapshot  TEXT NOT NULL,
  unit_price_aed_snapshot NUMERIC(8,2) NOT NULL,
  -- nutrition snapshot
  kcal_snapshot INT NOT NULL,
  protein_snapshot NUMERIC(6,2) NOT NULL,
  fat_snapshot     NUMERIC(6,2) NOT NULL,
  carbs_snapshot   NUMERIC(6,2) NOT NULL,
  sort_order    INT NOT NULL
);

CREATE TABLE order_status_history (
  id            BIGSERIAL PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by_staff_id UUID REFERENCES staff_users(id),
  reason        TEXT
);

-- ============== Аудит и outbox ==============
CREATE TABLE audit_log (                    -- immutable
  id            BIGSERIAL PRIMARY KEY,
  staff_id      UUID REFERENCES staff_users(id),
  action        TEXT NOT NULL,              -- "product.update", "outlet.stop_addon"
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  diff_json     JSONB,
  ip            INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outbox_events (
  id            BIGSERIAL PRIMARY KEY,
  topic         TEXT NOT NULL,              -- "order.status_changed", "sms.send"
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);

CREATE TABLE media_assets (
  id            UUID PRIMARY KEY,
  url           TEXT NOT NULL,              -- абсолютный CDN URL
  kind          TEXT NOT NULL,              -- video|poster|png
  mime          TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  width         INT,
  height        INT,
  duration_ms   INT,                        -- для видео
  uploaded_by   UUID REFERENCES staff_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_notifications (         -- что и когда отправили клиенту
  id            BIGSERIAL PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL,              -- sse|push|sms
  template      TEXT NOT NULL,              -- "ready"|"cancelled"|"custom"
  message       TEXT,                       -- если custom
  triggered_by  TEXT NOT NULL,              -- "auto"|staff_user_id
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered     BOOLEAN
);
```

### Junction-таблицы (вся гибкость живёт тут)

```sql
-- product ↔ addon_group: какие группы аддонов доступны для блюда + правила группы
CREATE TABLE product_addon_groups (
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  group_slug    TEXT REFERENCES addon_groups(slug) ON DELETE CASCADE,
  required      BOOLEAN NOT NULL DEFAULT FALSE,
  min_total     INT,                        -- минимум суммарных units по группе
  max_total     INT,                        -- максимум
  default_addon_ids UUID[] NOT NULL DEFAULT '{}',
  sort_order    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, group_slug)
);

-- product ↔ addon: override цены / дозы / лимитов для конкретного аддона
-- в контексте блюда. Примеры:
--   «обычное молоко» в латте: price=0, dose=200 ml
--   «обычное молоко» в раф-таро: price=0, dose=150 ml
--   «шот эспрессо» в латте: max=4
CREATE TABLE product_addon_overrides (
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  addon_id      UUID REFERENCES addons(id) ON DELETE CASCADE,
  min_units     INT,
  max_units     INT,
  default_units INT,
  -- ЦЕНА в этом блюде (если NULL — берётся addons.price_per_unit_aed)
  price_per_unit_aed_override NUMERIC(8,2),
  free          BOOLEAN NOT NULL DEFAULT FALSE,
  -- ДОЗА в этом блюде (если NULL — берётся addons.dose_amount)
  dose_amount_override NUMERIC(8,2),
  hidden        BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (product_id, addon_id)
);

-- addon_group ↔ addon: какие аддоны входят в группу
CREATE TABLE addon_group_items (
  group_slug    TEXT REFERENCES addon_groups(slug) ON DELETE CASCADE,
  addon_id      UUID REFERENCES addons(id) ON DELETE CASCADE,
  sort_order    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (group_slug, addon_id)
);

-- outlet ↔ product: видимость блюда в точке + текущий стоп-лист
-- (если строки нет — действует глобальный products.visible/inStock)
CREATE TABLE outlet_product_overrides (
  outlet_id     TEXT REFERENCES outlets(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  in_stock      BOOLEAN NOT NULL DEFAULT TRUE,
  visible       BOOLEAN NOT NULL DEFAULT TRUE,   -- скрыть это блюдо из меню точки
  updated_by    UUID REFERENCES staff_users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (outlet_id, product_id)
);

CREATE TABLE outlet_addon_overrides (
  outlet_id     TEXT REFERENCES outlets(id) ON DELETE CASCADE,
  addon_id      UUID REFERENCES addons(id) ON DELETE CASCADE,
  in_stock      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by    UUID REFERENCES staff_users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (outlet_id, addon_id)
);

CREATE TABLE outlet_variant_overrides (
  outlet_id     TEXT REFERENCES outlets(id) ON DELETE CASCADE,
  variant_id    UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  in_stock      BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (outlet_id, variant_id)
);

-- staff ↔ role: один сотрудник может иметь несколько ролей
CREATE TABLE staff_role_assignments (
  staff_id      UUID REFERENCES staff_users(id) ON DELETE CASCADE,
  role_code     TEXT REFERENCES roles(code) ON DELETE RESTRICT,
  PRIMARY KEY (staff_id, role_code)
);

-- staff ↔ outlet: к каким точкам у сотрудника доступ
-- запись с outlet_id=NULL означает "все точки сети" (для catalog_admin, finance, super_admin)
CREATE TABLE staff_outlet_scopes (
  staff_id      UUID REFERENCES staff_users(id) ON DELETE CASCADE,
  outlet_id     TEXT REFERENCES outlets(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, outlet_id)
);

-- order_item ↔ addon: что именно докинули в позицию заказа
CREATE TABLE order_item_addons (
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  addon_id      UUID REFERENCES addons(id),
  group_slug    TEXT REFERENCES addon_groups(slug),
  units         INT NOT NULL,
  -- SNAPSHOT цены и КБЖУ
  unit_price_aed_snapshot NUMERIC(8,2) NOT NULL,
  weight_g_snapshot NUMERIC(8,2) NOT NULL,
  kcal_snapshot INT NOT NULL,
  PRIMARY KEY (order_item_id, addon_id)
);

-- OTP-челленджи (Redis-альтернатива при сильной нагрузке)
CREATE TABLE otp_challenges (
  id            UUID PRIMARY KEY,
  phone         TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  attempts      INT NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_phone ON otp_challenges(phone, created_at DESC);
```

### Логика «что где хранится»

| Сущность | Где | Почему |
|---|---|---|
| Базовые КБЖУ блюда | `products.base_*` | Снэпшот не нужен — пересчитываем для каждого заказа |
| КБЖУ аддона | `addons.*_per_100` | На 100 г/мл — масштабируется на любой dose |
| Цена / max аддона **в контексте блюда** | `product_addon_overrides` | Чтобы «молоко в латте бесплатно» не плодило копий аддона |
| Какие аддоны в группе | `addon_group_items` | Junction — аддон может быть в нескольких группах |
| Какие группы прикручены к блюду | `product_addon_groups` | + required / min / max — правила группы |
| Можно/нельзя комбинировать | `compatibility_rules` | when/effect JSONB — редактируется в админке |
| Меню точки (что показывать) | `outlet_product_overrides.visible` | Без записи — действует глобал. Точечно скрыть = вставить строку с `visible=false` |
| Стоп-лист точки | `outlet_*_overrides.in_stock=false` | Real-time, publish в Redis при изменении |
| Доступ сотрудника к точке | `staff_outlet_scopes` | Junction; пустая запись = `outlet_id IS NULL` = все точки |
| Роли сотрудника | `staff_role_assignments` | Один человек может быть `outlet_manager` + `finance` |
| Цена/КБЖУ в момент заказа | `*_snapshot` колонки | Чтобы переоценка каталога не ломала историю |
| Кто оповестил клиента | `order_notifications` | Аудит-журнал push/SMS/SSE |

### Расчёт «можно ли заказать X с Y»

Сводится к одному запросу + JSONB-фильтру:

```sql
-- эффективная цена аддона для блюда
SELECT
  a.id,
  COALESCE(o.price_per_unit_aed_override, a.price_per_unit_aed) AS price,
  COALESCE(o.max_units, 999) AS max_units,
  COALESCE(o.free, FALSE) AS free,
  COALESCE(o.hidden, FALSE) AS hidden
FROM addons a
LEFT JOIN product_addon_overrides o
  ON o.addon_id = a.id AND o.product_id = $product_id
WHERE a.deleted_at IS NULL;
```

`POST /products/{slug}/preview` дальше прогоняет `compatibility_rules` (where `scope='global' OR product_id=$id`) через простой DSL-интерпретатор по `when_json` / `effect_json`. Это и есть «движок формул», который user редактирует в админке.

---

## 3. Платёжные методы

### MVP
| Метод | Провайдер | Заметки |
|---|---|---|
| `card` | Tap Payments | Visa / Mastercard, 3DS обязателен |
| `applepay` | Tap Apple Pay | merchant-id на стороне Tap |
| `googlepay` | Tap Google Pay | gateway = tap |

### V2
| Метод | Провайдер | Зачем |
|---|---|---|
| `tabby` | Tabby | Split в 4 платежа, очень популярен у молодёжи UAE |
| `tamara` | Tamara | Аналог Tabby, локально сильный |
| `cash_on_pickup` | — | Для точек, где есть касса; флаг per-outlet |
| `loyalty_points` | внутр. | Списание бонусов (нужна программа лояльности) |
| `corporate_wallet` | внутр. | Корп-клиенты (отдельный тариф) |

```ts
type PaymentMethod =
  | "card" | "applepay" | "googlepay"
  | "tabby" | "tamara" | "cash_on_pickup" | "loyalty_points" | "corporate_wallet";
```

Доступные методы возвращаются эндпоинтом `GET /payments/methods?outletId=…` — UI фильтрует кнопки по списку.

---

## 4. REST API

Базовый префикс: `/api/v1`. JSON. Ошибки в формате RFC 9457.

### 4.1 Auth (клиент)
| Метод | Путь | Назначение |
|---|---|---|
| POST | `/auth/otp/request` | `{ phone }` → `{ challengeId, expiresIn: 55 }` |
| POST | `/auth/otp/verify` | `{ challengeId, code }` → `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | rotation |
| POST | `/auth/logout` | invalidate refresh |
| GET | `/me` | |
| PATCH | `/me` | имя, plate, эмират, локаль, marketing opt-in |
| DELETE | `/me` | self-delete по PDPL UAE |

### 4.2 Auth (staff админки)
| Метод | Путь | |
|---|---|---|
| POST | `/staff/login` | email + пароль (+ TOTP в V2) |
| POST | `/staff/refresh` | |
| POST | `/staff/logout` | |
| GET | `/staff/me` | роли, scope |

### 4.3 Catalog (публичный)
| Метод | Путь | |
|---|---|---|
| GET | `/outlets` | список + расстояние от `?lat&lng` |
| GET | `/outlets/{id}` | |
| GET | `/catalog?outletId=…` | `{ categories, products, addonGroups, addons, compatibilityRules }`. ETag, Cache-Control 60s. |
| GET | `/products/{slug}?outletId=…` | детали |
| POST | `/products/{slug}/preview` | `{ variantCode, addons[] }` → `{ allowedAddons, forbidden[], autoAdded[], price, nutrition }`. Применяет CompatibilityRules и AddonGroupBinding. Это сердце «формул». |
| GET | `/payments/methods?outletId=…` | доступные методы оплаты |

### 4.4 Orders (клиент)
| Метод | Путь | |
|---|---|---|
| POST | `/orders` | `Idempotency-Key`. Бэк сам считает subtotal/vat/total/КБЖУ из БД. |
| GET | `/orders?cursor=…` | пагинация |
| GET | `/orders/{id}` | |
| POST | `/orders/{id}/arrived` | «Я приехал» — метаданные, не статус |
| POST | `/orders/{id}/cancel` | разрешено в `CREATED`/`PAID` |
| GET | `/orders/{id}/stream` | SSE, события `status`/`eta` |

### 4.5 Payments
| Метод | Путь | |
|---|---|---|
| POST | `/payments/intent` | `{ orderId, method }` → токен/redirect |
| POST | `/webhooks/tap` | `charge.succeeded` → `PAID` |
| POST | `/webhooks/tabby` | **[V2]** |
| POST | `/webhooks/tamara` | **[V2]** |
| POST | `/payments/{id}/refund` | админский |

### 4.6 Admin / Catalog (роль `catalog_admin`, `super_admin`)
| Метод | Путь | |
|---|---|---|
| GET | `/admin/categories` | |
| POST | `/admin/categories` | |
| PATCH | `/admin/categories/{slug}` | |
| GET | `/admin/products` | поиск/фильтры |
| POST | `/admin/products` | |
| PATCH | `/admin/products/{id}` | в т.ч. КБЖУ, теги, badge, sortOrder |
| POST | `/admin/products/{id}/media` | multipart: видео + постер + png |
| GET | `/admin/addons` | |
| POST | `/admin/addons` | |
| PATCH | `/admin/addons/{id}` | КБЖУ на 100г, цена за unit, аллергены |
| POST | `/admin/addons/{id}/png` | multipart |
| GET | `/admin/addon-groups` | |
| POST | `/admin/addon-groups` | |
| PATCH | `/admin/addon-groups/{slug}` | |
| POST | `/admin/products/{id}/bindings` | привязать группу аддонов с min/max/required/overrides |
| GET | `/admin/compatibility-rules` | |
| POST | `/admin/compatibility-rules` | |
| PATCH | `/admin/compatibility-rules/{id}` | when/effect редактор |
| POST | `/admin/dryrun-preview` | прогнать тест-заказ через текущие правила — нужно для UI правил, чтобы менеджер мог проверить «что будет, если…» |

### 4.7 Admin / Outlets (роль `outlet_manager`, `super_admin`)
| Метод | Путь | |
|---|---|---|
| GET | `/admin/outlets` | |
| POST | `/admin/outlets` | |
| PATCH | `/admin/outlets/{id}` | расписание, координаты, TRN |
| GET | `/admin/outlets/{id}/inventory` | стоп-листы |
| POST | `/admin/outlets/{id}/inventory/stop` | `{ productId? addonId? variantCode? }` |
| POST | `/admin/outlets/{id}/inventory/resume` | |

### 4.8 KDS (роль `barista`, скоуп — outlet)
| Метод | Путь | |
|---|---|---|
| GET | `/kds/queue` | активные заказы точки, сорт. по приоритету |
| WS | `/kds/stream` | live-обновления: новые заказы, статус-изменения, прибытие клиента |
| POST | `/kds/orders/{id}/accept` | `ACCEPTED`, ставит `baristaId`, `prepEtaSec` |
| POST | `/kds/orders/{id}/start` | `PREPARING` |
| POST | `/kds/orders/{id}/ready` | `READY` — триггерит push клиенту |
| POST | `/kds/orders/{id}/picked-up` | `PICKED_UP` |
| POST | `/kds/orders/{id}/reject` | `CANCELLED` + причина из enum |
| POST | `/kds/orders/{id}/print` | повторная печать чека на термопринтер |

### 4.9 Admin / Orders & Finance (роль `support`, `finance`, `outlet_manager`)
| Метод | Путь | |
|---|---|---|
| GET | `/admin/orders` | фильтры: дата, outlet, статус, телефон. `outlet_manager` видит только свои точки. |
| GET | `/admin/orders/{id}` | вся история, payment, refund-кнопки |
| POST | `/admin/orders/{id}/status` | `{ status, reason? }` — ручная смена статуса менеджером. Триггерит `order_notifications` + outbox `order.status_changed`. |
| POST | `/admin/orders/{id}/notify` | `{ template: "ready"\|"delayed"\|"cancelled"\|"custom", message? }` — менеджер шлёт клиенту произвольное оповещение поверх стандартного потока (например, «забыли соломинку — подвезу»). |
| POST | `/admin/orders/{id}/refund` | `{ amountAed, reason }` (роль `finance` / `support`) |
| POST | `/admin/orders/{id}/cancel` | принудительная отмена + автонотификация клиента |
| POST | `/admin/orders/{id}/comment` | внутренние комментарии, не видны клиенту |

**Поток уведомления**: смена статуса (`/status`) или явный вызов (`/notify`) → запись в `order_notifications` → outbox-событие `order.status_changed` / `order.custom_message` → worker:
1. шлёт SSE-event в `/orders/{id}/stream` (если клиент онлайн)
2. ставит Web Push **[V2]**
3. при отсутствии delivery > 60 s — fallback SMS **[V2, дорого, под флагом]**

Клиент получает обновление мгновенно; вся «кто и когда оповестил» лежит в `order_notifications` для аудита.

### 4.10 Admin / Users & Staff (роль `super_admin`)
| Метод | Путь | |
|---|---|---|
| GET | `/admin/users` | клиенты, поиск по телефону |
| PATCH | `/admin/users/{id}` | блокировка |
| GET | `/admin/staff` | |
| POST | `/admin/staff` | приглашение |
| PATCH | `/admin/staff/{id}` | роли, scope, disable |

### 4.11 Admin / Analytics (read-only для `finance`, `outlet_manager`)
| Метод | Путь | |
|---|---|---|
| GET | `/admin/analytics/revenue?from=…&to=…&outletId=…` | |
| GET | `/admin/analytics/top-products` | |
| GET | `/admin/analytics/funnel` | view → cart → paid |
| GET | `/admin/analytics/avg-prep-time` | per outlet, per barista |

---

## 5. Уведомления и интеграции

### 5.1 Клиент — статусы
- **In-app**: SSE-стрим `/orders/{id}/stream`. Фронт убирает свой mock-таймер при подключении.
- **Web Push** **[V2]**: подписка на browser push при `READY`. Service worker уже в `/public/sw.js` (заглушка).
- **SMS** **[опционально, дорого]**: только при `READY`, если приложение закрыто > 10 мин. Через того же Twilio / Unifonic.

События в SSE:
```json
{ "event": "status", "data": { "status": "PREPARING", "etaSec": 180 } }
{ "event": "status", "data": { "status": "READY" } }
{ "event": "barista_note", "data": { "text": "Ваш стакан почти готов" } }
```

### 5.2 Бариста — KDS
- **WS-стрим `/kds/stream`** — основной канал. Новый заказ приходит как `{ event: "order_new", order: {...} }`.
- **Звук + визуальная пульсация** на новый заказ в KDS-UI.
- **При нажатии «Я приехал» клиентом** — бариста получает `{ event: "customer_arrived", orderId, carPlate, emirate }` с подсветкой строки.
- **Печать чека** на термопринтер ESC/POS — отдельный микросервис `printer-bridge` слушает RabbitMQ-очередь `print-tasks`. **[V2]**

### 5.3 Менеджер точки
- **Email digest** (cron, 09:00 Asia/Dubai) — выручка за вчера, топ-3 блюда, средний prep time. **[V2]**
- **Telegram бот** **[V2]** — уведомления о критичных событиях: длинная очередь (> 5 заказов), отказы Tap, KDS офлайн.

### 5.4 Финансы
- **Slack/Teams webhook** при `REFUND` — `{ orderId, amount, reason, by }`. **[V2]**
- **Дневной отчёт** в Google Sheets через service account. **[V2]**

### 5.5 Внешние системы учёта **[V2]**
- **IIKO / Poster / 1С** — pull остатков и push продаж раз в 5 мин через адаптер `integrations/iiko.py`.
- **Google Maps Platform** — геокодинг для outlets, расстояние до клиента.

### 5.6 Шаблон интеграции
Все исходящие интеграции — через outbox-pattern: в БД таблица `outbox_events`, отдельный worker публикует. Гарантирует at-least-once.

---

## 6. Админка — UI-блоки

Описываю в формате «что видит каждая роль» — детальный UX-дизайн отдельным документом.

### 6.1 `super_admin` / `catalog_admin` — Каталог
- **Категории** — drag&drop сортировка, видимость
- **Продукты** — таблица + редактор:
  - Локализованные название/описание (ru/en/ar)
  - КБЖУ базы (с подсказкой «итог пересчитается с аддонами»)
  - Варианты (S/M/L) с дельтой по КБЖУ и ценой
  - Медиа: загрузка mp4 (auto-trim до 5 s, конвертация в H.264 baseline через ffmpeg-worker), JPEG-постер генерится автоматически из первого кадра + опциональный прозрачный PNG
  - Привязка addon-групп — drag-and-drop, для каждой группы выставляется `required`, `minTotal`, `maxTotal`, `defaultAddonIds` и таблица overrides
  - Теги (chips), badge, sortOrder, visibility, prepTimeSec
- **Аддоны** — таблица + редактор:
  - PNG-аплоад (drag&drop, превью)
  - Unit + weightPerUnitG (тултип: «1 shot = 25 г»)
  - КБЖУ на 100 г/мл — единая форма
  - Цена за unit, аллергены (теги), tags
- **Группы аддонов** — selectionType, items[]
- **Правила комбинирования** — визуальный редактор: «когда выбрано [chip-выбор аддонов] → [действие]». Кнопка `Проверить` запускает `dryrun-preview`.

### 6.2 `outlet_manager` — Точка
- **Дашборд точки**: live-очередь заказов, средний prep time, выручка сегодня
- **Стоп-листы** — переключатели для каждого продукта/варианта/аддона. Изменения мгновенные (publish в Redis → KDS видит).
- **Расписание** — недельное, праздники, аварийное закрытие
- **Сотрудники** — список бариста на точке, статус online/offline

### 6.3 `barista` — KDS (отдельное приложение, планшетный UI)
- **Очередь** — карточки заказов:
  - Номер, время, ETA, метод оплаты
  - Состав: продукт + вариант + список аддонов с units и «бесплатно/платно»
  - Спец. пометки: customName напитка, аллергены подсвечены
  - Машина клиента (эмират + plate) — большим шрифтом, для curbside
  - Кнопки: Принять / Готовлю / Готов / Выдан / Отмена
- **Уведомление «клиент приехал»** — баннер сверху с plate
- **Печать** — кнопка повторной печати чека
- **История за смену** — read-only

### 6.4 `support` — клиенты и заказы
- Поиск по телефону / номеру заказа
- Просмотр полной истории клиента
- Отмена / refund (с причиной из enum)
- Внутренние комментарии к заказу
- Блокировка пользователя

### 6.5 `finance` — отчёты
- Дневная / недельная / месячная выручка
- Разбивка по методам оплаты, точкам, категориям
- Refund-журнал
- Экспорт CSV / Google Sheets

---

## 7. Бизнес-правила, enforce на бэке

1. **VAT 5%** — фронт не считает, бэк всегда пересчитывает из snapshot-цен
2. **Цены / КБЖУ** — берутся из БД на момент создания заказа, пишутся в `OrderItem.*Snapshot` (неизменны после)
3. **AddonGroupBinding**: required, minTotal, maxTotal проверяются → `409 ADDON_BINDING_VIOLATED`
4. **CompatibilityRules**: forbid срабатывает → `409 ADDONS_INCOMPATIBLE` с локализованным message
5. **AddonOverride.maxUnits** — нельзя превысить (например, не больше 4 шотов)
6. **inStock = false** на любом уровне (product / variant / addon / outlet override) → `409 *_OUT_OF_STOCK`
7. **Outlet closed** или приготовление не успеет до закрытия (`prepTime > closes - now - 15min`) → `409 OUTLET_CLOSED`
8. **Plate** — `^[A-Z0-9 ]{1,12}$`
9. **Phone** — `^\+971(50|52|54|55|56|58)\d{7}$`
10. **`scheduledFor`** — `[now + 10min, outlet.closesAt]`
11. **Idempotency**: дубль `Idempotency-Key` → возврат первого заказа
12. **Refund** — нельзя превысить `totalAed`, нельзя на `PICKED_UP > 24h`
13. **CompatibilityRule.effect = auto-add** — бэк сам докидывает аддон, фронт получит его в `preview`/итоговом ордере, цена/КБЖУ пересчитаются

---

## 8. Кэш и инвалидация

| Сущность | TTL | Инвалидируется на |
|---|---|---|
| `/catalog` | 60s (Cache-Control public) | publish из админки → cache-bust по outletId |
| Outlet hours | 5 min | admin PATCH |
| Stop-lists | 0 (real-time) | publish в Redis pub-sub, push в KDS WS |
| Compatibility rules | 60s | admin PATCH |
| `/me` | no-cache | |

---

## 9. Коды ошибок

| HTTP | code | Когда |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `details: [{ field, message }]` |
| 401 | `AUTH_REQUIRED` | |
| 401 | `OTP_INVALID` | |
| 403 | `OTP_THROTTLED` | |
| 403 | `FORBIDDEN` | роль не имеет права |
| 404 | `NOT_FOUND` | |
| 409 | `OUTLET_CLOSED` | |
| 409 | `PRODUCT_OUT_OF_STOCK` | |
| 409 | `ADDON_OUT_OF_STOCK` | |
| 409 | `ADDON_BINDING_VIOLATED` | min/max/required нарушены |
| 409 | `ADDONS_INCOMPATIBLE` | compatibility rule forbid |
| 409 | `ORDER_NOT_CANCELLABLE` | |
| 422 | `PAYMENT_FAILED` | |
| 429 | `RATE_LIMITED` | + `Retry-After` |
| 500 | `INTERNAL` | |

---

## 10. Аналитика / события

Батч `POST /events` (раз в 5 s):

| Событие | props |
|---|---|
| `auth_otp_requested` | phone (хешированный) |
| `auth_success` | |
| `outlet_selected` | outletId |
| `product_view` | productId, source ("home"/"menu"/"search") |
| `addon_toggle` | productId, addonId, action ("add"/"remove") |
| `addon_blocked_by_rule` | productId, addonId, ruleId — критично для UX-аналитики правил |
| `cart_checkout_start` | itemsCount, totalAed |
| `order_created` | orderId, totalAed, paymentMethod |
| `payment_success` | orderId |
| `order_arrived` | orderId, secondsSinceReady |
| `order_pickup` | orderId, prepTimeSec |
| `kds_accept` | orderId, baristaId, secondsSincePaid |
| `kds_ready` | orderId, baristaId, prepTimeSec |
| `admin_catalog_changed` | entityType, entityId, byStaffId |

---

## 11. Безопасность

- JWT подписан **RS256**, ротация ключей через JWKS endpoint
- Refresh token — `httpOnly`, `secure`, `SameSite=strict`
- Все admin-эндпоинты — обязательная 2FA (TOTP) **[V2]**
- Аудит-лог всех admin-действий (`audit_log` таблица, immutable) **[MVP]**
- PDPL UAE: `DELETE /me` — soft-delete + анонимизация заказов через 30 дней
- Webhooks подписаны (Tap-Signature, Tabby-Signature)
- CORS: только `juicy.app` и `*.juicy.app`
- CSP с nonce для admin-веба

---

## 12. Что НЕ нужно в MVP (но архитектура должна разрешать)

- Программа лояльности и бонусные баллы
- Промокоды (поле в UI оставить как заглушку, бэк отвечает «invalid»)
- Push-уведомления через FCM/APNs (Web Push — V2)
- Партнёрский API
- Мультивалютность
- Подписки / абонементы
- Заказы на доставку (только curbside pickup)
- AR-локализация (RU/EN — MVP, RTL CSS готов)

---

## 13. План интеграции

1. Бэк поднимает `/auth/*`, `/catalog`, `/me` за фича-флагом `NEXT_PUBLIC_USE_BACKEND=true`
2. Фронт добавляет `lib/api.ts` — `fetch`-обёртка, общий error-handler
3. `lib/data.ts` → стрим из `GET /catalog`. Типы уже совпадают по форме — миграция точечная.
4. `lib/store.ts` — `addToCart` остаётся локальным; `createOrder` ходит в `POST /orders`; `updateOrderStatus` слушает SSE
5. Подключение Tap sandbox → `POST /payments/intent`
6. Запуск KDS — отдельное Next-приложение под `/kds/*`
7. Запуск админки — отдельное Next/Refine приложение под `/admin/*`
8. Удаляем mock-таймеры `setTimeout` в `/orders/[id]` после стабилизации SSE
9. `productVideos` в `data.ts` остаётся как dev-fallback при `USE_BACKEND=false`
10. **V2** — Tabby/Tamara, Web Push, KDS-printer, IIKO

---

## 14. Открытые вопросы (нужны решения от бизнеса)

- [ ] **SMS-провайдер**: Twilio (надёжно, $0.05 / SMS UAE) vs Unifonic (локально, ~$0.02, но сложнее интеграция)
- [ ] **VAT TRN на чеках** — нужен реальный TRN номер сети к старту
- [ ] **Tap Payments** — нужен merchant account до подключения, ~2 недели KYC
- [ ] **Стоит ли cash on pickup в MVP** — увеличивает срыв сделки на выдаче (no-show)
- [ ] **Допустима ли отмена клиентом после PAID** — политика рефанда
- [ ] **Минимальная сумма заказа** — нужна или нет
- [ ] **Лимит активных заказов** на пользователя (защита от спама)
- [ ] **Хранение plate** — PII? консультация с юристом по PDPL UAE
- [ ] **Время хранения заказов** для аналитики — рекомендуется 2 года, удалять PII через 6 мес
