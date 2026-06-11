# Часть VIII. СПРАВОЧНИК API

> **Канон достоверности — код** (`backend/app/routers/*.py`, `backend/app/main.py`, `backend/app/core/security.py`,
> `backend/app/core/errors.py`). Все пути, методы, поля и коды ошибок ниже выписаны из реально
> смонтированных роутеров; ничего не выдумано. Where поведение задаётся сервисами — см. сквозные
> процессы (**см. Часть VII**); модель данных и enum — **см. Часть III**; реестр кодов ошибок —
> **см. Часть IX / Приложение C**.

---

## VIII.0 Общие конвенции API

### VIII.0.1 База, версии, форматы
- **База URL (dev):** `http://localhost:8000`. Префикс всех REST-маршрутов — `/api/...` (исключение —
  служебный `GET /health` без префикса). WebSocket — `/ws/...`.
- **Формат тела и ответа** — `application/json`. Денежные значения — числа в **AED** (поля `total`,
  `subtotal`, `amount`, `basePrice` и т. п.); налоговая строка (VAT) в ответах **отсутствует** —
  цена является финальной (⚠️ VAT 5 % как требование — **см. Часть IX**).
- **i18n-поля** (`name`, `description`, `title`, `body`) в публичных ответах уже **разрешены в строку**
  под текущую локаль (параметр `locale`); в админских ответах отдаются **как объект** `{"en":…,"ru":…,"ar":…}`
  целиком (для редактирования). Эта асимметрия — реальный контракт кода (⚠️ дефект kitchen↔location-status
  из-за неё — **см. Часть IX**, дефект №1).

### VIII.0.2 Авторизация и роли
Авторизация — через заголовок **`Authorization: Bearer <JWT>`** (HS256, TTL 30 дней; `core/security.py`).
В токене различаются два «вида» (`kind`): `customer` (клиент) и `staff` (персонал), у `staff` — поле
`role` (`manager` | `super_admin`). Зависимости-гарды и их смысл:

| Гард (зависимость) | Кого пускает | Нарушение → |
|---|---|---|
| `get_current_user` | только `kind=customer` | нет токена → **401** `AUTH_REQUIRED`; чужой вид → **403** `FORBIDDEN` |
| `get_current_staff` | только `kind=staff` (не `disabled`) | **401** `AUTH_REQUIRED` / **403** `FORBIDDEN` |
| `require_super_admin` | `staff` с `role=super_admin` | **403** `FORBIDDEN` |
| `require_manager_or_super` | `staff` с `role∈{manager,super_admin}` | **403** `FORBIDDEN` |
| `manager_scope_location` (не гард, а скоуп) | возвращает `location_id` менеджера или `None` для super_admin | при обращении к чужой точке → **403** `FOREIGN_LOCATION` |

> **Ролевой скоуп точки.** Менеджер, привязанный к точке (`location_id ≠ null`), на всех «операционных»
> эндпоинтах (заказы, стоп-лист, статус точки) **жёстко ограничен своей точкой** — обращение к чужой
> отдаёт `FOREIGN_LOCATION` (403). Super_admin скоупом не ограничен. Подробнее о ролях — **см. Часть 0.6**.

### VIII.0.3 Формат ошибок
Доменные ошибки отдаются по контракту `core/errors.py` (`http_error`): тело — либо **строка-код**
(`detail: "LOCATION_PAUSED"`), либо **объект** `{"code": "...", ...meta}`, когда есть метаданные
(например `remaining`, `next_open_at`). Глобальный обработчик `ValueError` → **422**
`{"code":"VALIDATION_ERROR","detail":…}`. Полный реестр доменных кодов — **см. Приложение C**;
ниже у каждого эндпоинта перечислены только релевантные.

### VIII.0.4 Порядок монтирования (из `main.py`)
`catalog → locations → auth → orders → payments → coupons → staff → admin_catalog → admin_orders →
admin_locations → admin_locations.status_router → admin_settings → admin_media → content →
content.public_router → dashboard → ws`. **15 файлов роутеров → 17 смонтированных `APIRouter`**
(в `content` и `admin_locations` по два роутера). Плюс `GET /health` объявлен прямо в `main.py`.

---

## VIII.1. Публичное API

> Доступно клиенту (часть — без токена, часть — под `customer`-токеном). Группы: **auth**, **catalog**,
> **locations**, **orders**, **payments**, **coupons**, **content (public)**.

## A.1 auth — авторизация клиента (`/api/auth`)
Файл `routers/auth.py`. Вход по телефону + (опционально) OTP; токен — `customer`. SMS-провайдер не выбран
(⚠️ заглушка, **см. Часть VII / OTP**).

| Метод · путь | Авторизация | Ключевые поля запроса | Ответ | Ошибки |
|---|---|---|---|---|
| `POST /api/auth/request-code` | публично | `phone` (валидируется `^\+\d{9,15}$`) | OTP **выкл.**: `{sent:false, otpRequired:false}`; **вкл.**: `{sent:true, otpRequired:true, ttl, devCode?}` | 422 валидация телефона |
| `POST /api/auth/verify` | публично | `phone`, `code`(=""), `name?`, `locale?` | `{token, user:{id,phone,name,carPlate,emirate,locale}, created}` | **401** `OTP_INVALID` (если OTP включён) |
| `GET /api/auth/me` | `customer` | — | `{id,phone,name,carPlate,emirate,locale}` | 401 |
| `PATCH /api/auth/me` | `customer` | `name?`, `carPlate?` (→ UPPERCASE), `emirate?`, `locale?` | тот же payload пользователя | **422** `VALIDATION_ERROR` (неизвестная локаль) |

> `car_plate` приводится к верхнему регистру на сервере. `locale` нормализуется к поддерживаемым
> (иначе берётся дефолтная). PII (`phone`, `car_plate`) — **см. Часть I / PDPL**.

## A.2 catalog — каталог напитков (`/api`)
Файл `routers/catalog.py`. Публичный, без токена. Отдаёт только опубликованные напитки
(`status="published"`). Addon-конфигуратор (`/preview`, поле `addons`) в потоке GRABZI «спит» 🧩.

| Метод · путь | Авторизация | Ключевые поля запроса | Ответ | Ошибки |
|---|---|---|---|---|
| `GET /api/categories` | публично | `locale?` | `[{id,name,photoUrl,videoUrl}]` (только активные, по `sort`) | — |
| `GET /api/drinks` | публично | `category?` (id), `location_id?`, `locale?` | `[{id,slug,name,previewUrl,videoUrl,basePrice,kcal,categoryId,soldOut}]` | — |
| `GET /api/drinks/{slug}` | публично | `slug`, `locale?` | деталка `{id,slug,name,description,…,basePrice,kcal/protein/fat/carbs,addons[]}` | **404** `NOT_FOUND` (нет/не published) |
| `POST /api/drinks/{slug}/preview` 🧩 | публично | `selections:[{addonId,portions}]` | `{price,kcal,protein,fat,carbs,addons[]}` (серверный пересчёт) | 404; **409** `ADDON_NOT_AVAILABLE` / `ADDON_PORTIONS_OUT_OF_RANGE` / `SELECTION_TYPE_VIOLATED` |

> `location_id` нужен, чтобы пометить напитки стоп-листа точки флагом `soldOut:true` (не скрывает —
> фронт гасит степпер). Стоп-лист — **см. Часть VII**.

## A.3 locations — точки (`/api/locations`)
Файл `routers/locations.py`. Публичный. Отдаёт точку с **вычисленным** статусом (`open/paused/closed/inactive`),
остатком в напитках и `nextOpenAt` (если закрыта). Логика статуса — `location_service` (**см. Часть VII**).

| Метод · путь | Авторизация | Поля | Ответ | Ошибки |
|---|---|---|---|---|
| `GET /api/locations` | публично | `locale?` | `[{id,name,description,address,coordinates,workingHours,timezone,dailyDrinkLimit,soldToday,remaining,isSoldOut,isOpen,status,nextOpenAt,acceptingOrders,color,imageUrl}]` (только активные) | — |
| `GET /api/locations/{location_id}` | публично | `location_id`, `locale?` | тот же объект точки | **404** `LOCATION_NOT_FOUND` (нет/неактивна) |

## A.4 orders — заказы клиента (`/api/orders`)
Файл `routers/orders.py`. Под `customer`-токеном; клиент видит только свои заказы. Создание заказа,
отметка прибытия, оценка (👎 выдаёт купон). Жизненный цикл и лимит — `order_flow` (**см. Часть VII**).

| Метод · путь | Авторизация | Ключевые поля запроса | Ответ | Ошибки |
|---|---|---|---|---|
| `POST /api/orders` | `customer` | `items:[{drinkId,quantity,customName?,addons[]}]`, `locationId?`, `customerName?`, `carPlate?`, `emirate?`, `couponId?`, `couponItemIndex?`; `?locale` | заказ `order_payload` (full) | **422** `CART_EMPTY` / `CAR_PLATE_REQUIRED`; **409** `LOCATION_*`, `DRINK_*`, `STOCK_LESS_THAN_ORDER` (из `create_order`) |
| `GET /api/orders` | `customer` | — | `[order_payload(full=false)]` (свои, по убыв. id) | 401 |
| `GET /api/orders/{order_id}` | `customer` (свой) | `order_id` | заказ (full) + `ratingPromptDue:bool` | **404** `NOT_FOUND` (чужой/нет) |
| `POST /api/orders/{order_id}/arrived` | `customer` (свой) | `order_id` | заказ (idempotent — флаг `arrived`) | 404; **409** `ORDER_NOT_PAID` / `ORDER_FINISHED` |
| `POST /api/orders/{order_id}/rate` | `customer` (свой) | `rating` (`like`\|`dislike`) | `{ok, couponIssued, couponId}` | 404; **422** `VALIDATION_ERROR`; **409** `ALREADY_RATED` / `ORDER_NOT_RATABLE` |

> Форма `order_payload`: `id, number, status, paymentStatus, arrived, subtotal, couponDiscount, total,
> createdAt, rating, items[]`; при `full=true` ещё `customerName, phone, carPlate, emirate, events[]`.
> `arrived` — независимый флаг, **не** часть цепочки статусов (**см. Часть 0.8**). `dislike` создаёт
> один `Coupon` на заказ.

## A.5 payments — оплата (`/api/payments`)
Файл `routers/payments.py`. Stripe Checkout; без `STRIPE_SECRET_KEY` → **mock** (платёж сразу `succeeded`,
заказ → `paid`, редирект `/orders/{id}?paid=1`). Webhook — публичный (подпись по секрету). Поток оплаты
и гонка лимита — **см. Часть VII**.

| Метод · путь | Авторизация | Ключевые поля запроса | Ответ | Ошибки |
|---|---|---|---|---|
| `POST /api/payments/checkout-session` | `customer` (свой заказ) | `orderId`, `successUrl?`, `cancelUrl?` | реальный: `{checkoutUrl, mock:false}`; mock: `{checkoutUrl:"/orders/{id}?paid=1", mock:true}` | **404** `NOT_FOUND`; **409** `ALREADY_PAID`; **409** `LOCATION_LIMIT_REACHED` (+`remaining`, гонка под `FOR UPDATE`) |
| `POST /api/payments/webhook` | публично (Stripe-подпись) | сырое тело Stripe + заголовок `Stripe-Signature` | `{received:true}` | **400** `BAD_SIGNATURE` (если задан webhook-секрет и подпись неверна) |

> Webhook реагирует на `checkout.session.completed`: помечает платёж `succeeded` и заказ `paid`
> (через `mark_paid`); при гонке лимита платёж → `refunded`.

## A.6 coupons — купоны клиента (`/api/coupons`)
Файл `routers/coupons.py`. Под `customer`-токеном.

| Метод · путь | Авторизация | Поля | Ответ | Ошибки |
|---|---|---|---|---|
| `GET /api/coupons` | `customer` | — | `[{id,status,issuedAt,sourceOrderId,usedOrderId,discountAmount}]` (свои, по убыв. id) | 401 |

> Купоны выдаются за 👎 в `POST /api/orders/{id}/rate` и применяются при создании заказа
> (`couponId`/`couponItemIndex`). Аннулирование — у супер-админа (см. B.5). Номинал/срок жёстко не
> зафиксированы (❓ открытый вопрос — **см. Часть IX**).

## A.7 content (public) — инфо-страница (`/api/content`)
Файл `routers/content.py`, роутер `public_router`. Публичный.

| Метод · путь | Авторизация | Поля | Ответ | Ошибки |
|---|---|---|---|---|
| `GET /api/content` | публично | `locale?` | `[{key,title,body}]` (только активные, по `sort`, разрешено под локаль) | — |

---

## VIII.2. Админ / Staff API

> Под `staff`-токеном. Группы: **staff** (вход/менеджеры), **admin_catalog**, **admin_orders**
> (+клиенты/платежи/купоны), **admin_locations** (+location-status), **admin_settings**, **admin_media**,
> **dashboard**, **admin content (CRUD)**. Большинство админ-роутеров — `super_admin`-only (гард на уровне
> роутера); операционные эндпоинты заказов/стоп-листа доступны и менеджеру в скоупе его точки.

## B.1 staff — персонал (`/api/staff`)
Файл `routers/staff.py`. Вход — email + пароль (pbkdf2_sha256), токен — `staff` с `role`. Управление
менеджерами — `super_admin`. Удаление — **мягкое** (`disabled=true`, история `by_staff_id` сохраняется).

| Метод · путь | Авторизация | Ключевые поля | Ответ | Ошибки |
|---|---|---|---|---|
| `POST /api/staff/login` | публично | `email`, `password` | `{token, staff:{id,email,name,role,locationId,disabled}}` | **401** `INVALID_CREDENTIALS` (нет/`disabled`/пароль) |
| `GET /api/staff/me` | `staff` | — | `staff`-payload | 401/403 |
| `GET /api/staff/managers` | `super_admin` | — | `[staff-payload]` | 403 |
| `POST /api/staff/managers` | `super_admin` | `email,password,name,role?(=manager),locationId?` | `staff`-payload | **422** `VALIDATION_ERROR` (роль); **409** `EMAIL_TAKEN` |
| `PATCH /api/staff/managers/{staff_id}` | `super_admin` | `name?,role?,locationId?,disabled?` | `staff`-payload | **404** `NOT_FOUND`; 422 (роль) |
| `DELETE /api/staff/managers/{staff_id}` | `super_admin` | `staff_id` | `{ok:true}` (soft-delete) | **409** `CANNOT_DELETE_SELF`; **404** `NOT_FOUND` |

## B.2 admin_catalog — каталог CRUD (`/api/admin/catalog`)
Файл `routers/admin_catalog.py`. **Весь роутер — `super_admin`** (гард на уровне роутера). i18n-поля
(`name`,`description`) принимаются/отдаются как объекты `{locale:…}`. Группы: категории напитков,
единицы, категории добавок, добавки, напитки + связки addon (последние 🧩 «спят» в публичном потоке).

| Метод · путь | Ключевые поля / тело | Ответ | Ошибки |
|---|---|---|---|
| `GET /api/admin/catalog/drink-categories` | — | `[{id,name,photoUrl,videoUrl,isActive,sort}]` | — |
| `POST /api/admin/catalog/drink-categories` | `name,photoUrl?,videoUrl?,isActive,sort` | категория | — |
| `PATCH /api/admin/catalog/drink-categories/{cat_id}` | те же поля | категория | **404** `NOT_FOUND` |
| `GET /api/admin/catalog/units` | — | `[{id,code,name}]` | — |
| `POST /api/admin/catalog/units` | `code,name` | unit | **409** `CODE_TAKEN` |
| `GET /api/admin/catalog/addon-categories` | — | `[{id,name,iconUrl,isActive,selectionType}]` | — |
| `POST /api/admin/catalog/addon-categories` | `name,iconUrl?,isActive,selectionType(single\|multi\|counter)` | addon-категория | **422** `VALIDATION_ERROR` |
| `PATCH /api/admin/catalog/addon-categories/{cat_id}` | те же поля | addon-категория | **404** `NOT_FOUND` |
| `GET /api/admin/catalog/addons` | — | `[{id,name,imageUrl,categoryId,unitId,kcal/protein/fat/carbsPer100,basePrice,isActive}]` | — |
| `POST /api/admin/catalog/addons` | `name,categoryId,unitId,*Per100,basePrice,isActive,imageUrl?` | addon | — |
| `PATCH /api/admin/catalog/addons/{addon_id}` | те же поля | addon | **404** `NOT_FOUND` |
| `GET /api/admin/catalog/drinks` | — | `[drink]` (все: draft/published/hidden, с `bindings[]`) | — |
| `POST /api/admin/catalog/drinks` | `slug,name,description,status(draft\|published\|hidden),previewUrl?,videoUrl?,basePrice,kcal/…,categoryId` | drink | **422** `VALIDATION_ERROR` (status); **409** `SLUG_TAKEN` |
| `PATCH /api/admin/catalog/drinks/{drink_id}` | те же поля | drink | **404** `NOT_FOUND` |
| `PUT /api/admin/catalog/drinks/{drink_id}/bindings` 🧩 | `[{addonId,priceOverride?,minPortions,defaultPortions,maxPortions,portionAmount,selectionTypeOverride?}]` (полная замена) | drink с `bindings[]` | **404** `NOT_FOUND`; **409** `ADDON_NOT_FOUND:{id}`; **422** `PORTIONS_RANGE_INVALID` |

## B.3 admin_orders — заказы / клиенты / платежи / купоны (`/api/admin`)
Файл `routers/admin_orders.py`, prefix `/api/admin`. Заказы доступны **любому staff** в скоупе точки
(менеджер — своя точка, иначе `FOREIGN_LOCATION`); клиенты/платежи/купоны — **`super_admin`-only** (гард
на эндпоинте). Только оплаченные заказы (`payment_status="paid"`). Переходы статусов — `transition`/`refund`
из `order_flow` (**см. Часть VII**), они шлют WS-нотификации.

### Заказы (staff + скоуп точки)
| Метод · путь | Авторизация | Ключевые поля | Ответ | Ошибки |
|---|---|---|---|---|
| `GET /api/admin/orders` | `staff` (скоуп точки) | `active?`, `manager_id?`, `location_id?`(super), `unassigned?` | `[order_row]` (paid; по убыв. id) | 401/403 |
| `GET /api/admin/orders/{order_id}` | `staff` (скоуп) | `order_id` | `order_row` + `events[]` (с `byStaffId/byUserId/note`) | **404** `NOT_FOUND`; **403** `FOREIGN_LOCATION` |
| `POST /api/admin/orders/{order_id}/take` | `staff` (скоуп) | — | `order_row` (→ `in_progress` + закреплён менеджер) | 404; 403; **409** `ORDER_NOT_PAID` |
| `POST /api/admin/orders/{order_id}/status` | `staff` (скоуп) | `status`(`ready`\|`completed`), `note?` | `order_row` | 404; 403; **422** `VALIDATION_ERROR` |
| `POST /api/admin/orders/{order_id}/refund` 🧩 | `staff` (скоуп) | `note?` | `order_row` (статус `refund`, лимит дня декрементируется) | 404; 403 |

### Клиенты (`super_admin`)
| Метод · путь | Поля | Ответ | Ошибки |
|---|---|---|---|
| `GET /api/admin/customers` | — | `[{id,phone,name,carPlate,locale,createdAt}]` | 403 |
| `GET /api/admin/customers/{user_id}` | `user_id` | профиль + `orders[]`,`payments[]`,`coupons[]` | **404** `NOT_FOUND` |
| `PATCH /api/admin/customers/{user_id}` | `name?,carPlate?(→UPPER),emirate?` | `{ok:true}` | **404** `NOT_FOUND` |

### Платежи и купоны (`super_admin`)
| Метод · путь | Поля | Ответ | Ошибки |
|---|---|---|---|
| `GET /api/admin/payments` | — | `[{id,orderId,amount,currency,provider,providerId,status,createdAt,orderNumber,customerPhone,userId}]` | 403 |
| `GET /api/admin/coupons` | — | `[{id,userId,status,sourceOrderId,usedOrderId,usedItemId,discountAmount,issuedAt,usedAt}]` | 403 |
| `POST /api/admin/coupons/{coupon_id}/void` | `coupon_id` | купон (`status=void`) | **404** `NOT_FOUND`; **409** `COUPON_NOT_ACTIVE` |

## B.4 admin_locations — точки (`/api/admin/locations`) + статус (`/api/admin`)
Файл `routers/admin_locations.py`. **Два роутера:** `router` (CRUD/pause/daily/adjust/history/stops) и
`status_router` (`/api/admin/location-status`). Гарды — **пер-эндпоинтные**: CRUD/пауза/счётчик/история —
`super_admin`; стоп-лист — `manager_or_super` + скоуп; location-status — любой staff (со скоупом).

### CRUD и операции (`super_admin`)
| Метод · путь | Ключевые поля | Ответ | Ошибки |
|---|---|---|---|
| `GET /api/admin/locations` | — | `[admin_row]` (все, с `soldToday/remaining/status/isOpen`) | 403 |
| `POST /api/admin/locations` | `name,description,address?,coordinates?,workingHours,timezone,dailyDrinkLimit?,acceptingOrders,color?,imageUrl?,isActive,sort` | `admin_row` | 403 |
| `PATCH /api/admin/locations/{location_id}` | любые из полей (partial; `model_fields_set` отличает null от «не задано») | `admin_row` | **404** `LOCATION_NOT_FOUND` |
| `POST /api/admin/locations/{location_id}/pause` | `acceptingOrders`(bool), `reason?` | `admin_row` (идемпотентно, пишет аудит) | 404; 403 |
| `GET /api/admin/locations/{location_id}/daily` | `date?` | `{date,soldDrinks,limit,remaining}` | 404 |
| `POST /api/admin/locations/{location_id}/adjust-day` | `date?`, `setCommitted?` \| `delta?` | `{date,soldDrinks}` | 404 |
| `GET /api/admin/locations/{location_id}/history` | — | `[{id,action,drinkId,byStaffId,reason,at,durationMinutes}]` (длительность паузы — на чтении) | 404 |

### Стоп-лист (`manager_or_super` + скоуп точки)
| Метод · путь | Ключевые поля | Ответ | Ошибки |
|---|---|---|---|
| `GET /api/admin/locations/{location_id}/stops` | — | `[{id,drinkId,reason,byStaffId,createdAt}]` | 404; **403** `FOREIGN_LOCATION` |
| `POST /api/admin/locations/{location_id}/stops` | `drinkId`, `reason?` | `{id,drinkId,alreadyStopped}` (идемпотентно, аудит) | 404; 403 |
| `DELETE /api/admin/locations/{location_id}/stops/{drink_id}` | `drink_id` | **204** (без тела; идемпотентно, аудит) | 404; 403 |

### Панель статуса/остатка точки (`status_router`, любой staff)
| Метод · путь | Авторизация | Поля | Ответ | Ошибки |
|---|---|---|---|---|
| `GET /api/admin/location-status` | `staff` | `location_id?`, `scope?(="all")` | manager → своя точка `{locationId,name,status,soldToday,limit,remaining,isOpen,nextOpenAt}`; super → одна точка или `{scope:"all",totalSold,totalLimit,locations[]}` | 401/403 |

> ⚠️ **Дефект контракта** (kitchen): поле `name` здесь отдаётся как i18n-**объект** (`{"en":…}`), тогда
> как фронт KDS ждёт строку → ложное «Session expired». Для super_admin без точки/без параметров
> возвращается `{scope:"all", locations:[]}`, которого схема кухни не ожидает (KDS рассчитан на
> менеджера). Оба — **см. Часть IX**, дефекты №1/№2.

## B.5 admin_settings — настройки (`/api/admin/settings`)
Файл `routers/admin_settings.py`. **Весь роутер — `super_admin`**. Редактируемые бизнес-дефолты
(`app_settings`) и read-only зеркало интеграций (только статус `configured|missing`, без секретов).

| Метод · путь | Поля | Ответ | Ошибки |
|---|---|---|---|
| `GET /api/admin/settings` | — | `{editable:{general,defaults}, readonly:{integrations:{stripe,stripeWebhook,otpEnabled,jwtAlg,database,redis,ratingTimeoutMinutes,locales}}}` | 403 |
| `PATCH /api/admin/settings` | произвольные editable-ключи `{key:value}` | `{ok:true, values}` | **422** `UNKNOWN_SETTING_KEY` (+`key`) / `INVALID_SETTING` (+`key`,`reason`) |

## B.6 admin_media — загрузка медиа (`/api/admin`)
Файл `routers/admin_media.py`. **Весь роутер — `super_admin`**. Multipart-загрузка в S3/MinIO
(fallback — URL-строки). Сервис — `storage` (**см. Часть VII**).

| Метод · путь | Поля (multipart) | Ответ | Ошибки |
|---|---|---|---|
| `POST /api/admin/media` | `file` (UploadFile), `folder` (="misc") | `{key,url,…}` | 403 |

## B.7 dashboard — аналитика (`/api/admin/dashboard`)
Файл `routers/dashboard.py`. **Весь роутер — `super_admin`**. Считает по оплаченным заказам с фильтром
по периоду/точке.

| Метод · путь | Поля | Ответ | Ошибки |
|---|---|---|---|
| `GET /api/admin/dashboard` | `from?`, `to?`, `location_id?` | `{revenue, ordersCount, drinksSold, byLocation[], avgDrinksPerOrder, avgOrderValue, ordersByHour, topProducts[], topCustomers[]}` | 403 |

## B.8 admin content — CMS CRUD (`/api/admin/content`)
Файл `routers/content.py`, роутер `router`. **Весь роутер — `super_admin`**. Управление инфо-блоками
(публичная выдача — A.7). i18n-поля `title`/`body` — объекты.

| Метод · путь | Ключевые поля | Ответ | Ошибки |
|---|---|---|---|
| `GET /api/admin/content` | — | `[{id,key,title,body,sort,isActive}]` (по `sort`) | 403 |
| `POST /api/admin/content` | `key,title,body,sort,isActive` | блок | **409** `KEY_TAKEN` |
| `PATCH /api/admin/content/{block_id}` | `title?,body?,sort?,isActive?` (partial) | блок | **404** `NOT_FOUND` (отдаётся через `LOCATION_NOT_FOUND` generic) |

---

## VIII.3. WebSocket-каналы

> Файл `routers/ws.py`. Реальный WebSocket (asyncio in-process через `core/pubsub`). Браузер не шлёт
> `Authorization` на WS → **токен передаётся query-параметром `?token=`** (тот же JWT). Heartbeat:
> сервер шлёт `{"type":"ping"}` каждые ~25 с при отсутствии событий. Нотификации публикуются из
> `order_flow.notify` (**см. Часть VII**). Закрытие при отказе авторизации — код **1008**
> (`WS_1008_POLICY_VIOLATION`).

| Канал | Кто допускается | Подписка (pubsub-канал) | Сообщения |
|---|---|---|---|
| `WS /ws/orders/{order_id}?token=` | владелец заказа (`customer`-токен, проверка `user_id`) **или** любой `staff` | `order:{order_id}` | `{orderId,status,paymentStatus,arrived}` + `{type:"ping"}` |
| `WS /ws/admin/orders?token=` | только `staff` (не `disabled`); **менеджер с точкой → свой per-location канал** | `admin:orders` (super) или `admin:orders:{location_id}` (менеджер) | `{orderId,status,paymentStatus,arrived,number,locationId}` + `{type:"ping"}` |

> Менеджер, привязанный к точке, подписывается **только** на `admin:orders:{location_id}` — глобальную
> ленту не видит. Super_admin (без точки) — на глобальный `admin:orders`.

---

## VIII.4. Прочее (вне групп)

| Метод · путь | Источник | Авторизация | Ответ |
|---|---|---|---|
| `GET /health` | `main.py` (не роутер) | публично | `{status:"ok"}` |

---

## VIII.5. Полный список эндпоинтов (сверка с фактом)

> **Сводка по коду.** 15 файлов роутеров → 17 смонтированных `APIRouter`. **69 REST-эндпоинтов в
> роутерах + 2 WebSocket = 71 декоратор-эндпоинт**, плюс служебный `GET /health` в `main.py` →
> **итого 72 маршрута** (70 REST + 2 WS). Разбивка по файлам:
> auth 4 · catalog 4 · locations 2 · orders 5 · payments 2 · coupons 1 · content 4 (3 admin + 1 public) ·
> staff 6 · admin_catalog 15 · admin_orders 11 · admin_locations 11 (10 CRUD/stops + 1 status_router) ·
> admin_settings 2 · admin_media 1 · dashboard 1 · ws 2.

| # | Метод | Путь | Группа | Авторизация |
|---|---|---|---|---|
| 1 | GET | `/api/categories` | catalog | публично |
| 2 | GET | `/api/drinks` | catalog | публично |
| 3 | GET | `/api/drinks/{slug}` | catalog | публично |
| 4 | POST | `/api/drinks/{slug}/preview` | catalog 🧩 | публично |
| 5 | GET | `/api/locations` | locations | публично |
| 6 | GET | `/api/locations/{location_id}` | locations | публично |
| 7 | POST | `/api/auth/request-code` | auth | публично |
| 8 | POST | `/api/auth/verify` | auth | публично |
| 9 | GET | `/api/auth/me` | auth | customer |
| 10 | PATCH | `/api/auth/me` | auth | customer |
| 11 | POST | `/api/orders` | orders | customer |
| 12 | GET | `/api/orders` | orders | customer |
| 13 | GET | `/api/orders/{order_id}` | orders | customer (свой) |
| 14 | POST | `/api/orders/{order_id}/arrived` | orders | customer (свой) |
| 15 | POST | `/api/orders/{order_id}/rate` | orders | customer (свой) |
| 16 | POST | `/api/payments/checkout-session` | payments | customer (свой) |
| 17 | POST | `/api/payments/webhook` | payments | публично (подпись) |
| 18 | GET | `/api/coupons` | coupons | customer |
| 19 | POST | `/api/staff/login` | staff | публично |
| 20 | GET | `/api/staff/me` | staff | staff |
| 21 | GET | `/api/staff/managers` | staff | super_admin |
| 22 | POST | `/api/staff/managers` | staff | super_admin |
| 23 | PATCH | `/api/staff/managers/{staff_id}` | staff | super_admin |
| 24 | DELETE | `/api/staff/managers/{staff_id}` | staff | super_admin |
| 25 | GET | `/api/admin/catalog/drink-categories` | admin_catalog | super_admin |
| 26 | POST | `/api/admin/catalog/drink-categories` | admin_catalog | super_admin |
| 27 | PATCH | `/api/admin/catalog/drink-categories/{cat_id}` | admin_catalog | super_admin |
| 28 | GET | `/api/admin/catalog/units` | admin_catalog | super_admin |
| 29 | POST | `/api/admin/catalog/units` | admin_catalog | super_admin |
| 30 | GET | `/api/admin/catalog/addon-categories` | admin_catalog | super_admin |
| 31 | POST | `/api/admin/catalog/addon-categories` | admin_catalog | super_admin |
| 32 | PATCH | `/api/admin/catalog/addon-categories/{cat_id}` | admin_catalog | super_admin |
| 33 | GET | `/api/admin/catalog/addons` | admin_catalog | super_admin |
| 34 | POST | `/api/admin/catalog/addons` | admin_catalog | super_admin |
| 35 | PATCH | `/api/admin/catalog/addons/{addon_id}` | admin_catalog | super_admin |
| 36 | GET | `/api/admin/catalog/drinks` | admin_catalog | super_admin |
| 37 | POST | `/api/admin/catalog/drinks` | admin_catalog | super_admin |
| 38 | PATCH | `/api/admin/catalog/drinks/{drink_id}` | admin_catalog | super_admin |
| 39 | PUT | `/api/admin/catalog/drinks/{drink_id}/bindings` | admin_catalog 🧩 | super_admin |
| 40 | GET | `/api/admin/orders` | admin_orders | staff (скоуп) |
| 41 | GET | `/api/admin/orders/{order_id}` | admin_orders | staff (скоуп) |
| 42 | POST | `/api/admin/orders/{order_id}/take` | admin_orders | staff (скоуп) |
| 43 | POST | `/api/admin/orders/{order_id}/status` | admin_orders | staff (скоуп) |
| 44 | POST | `/api/admin/orders/{order_id}/refund` | admin_orders 🧩 | staff (скоуп) |
| 45 | GET | `/api/admin/customers` | admin_orders | super_admin |
| 46 | GET | `/api/admin/customers/{user_id}` | admin_orders | super_admin |
| 47 | PATCH | `/api/admin/customers/{user_id}` | admin_orders | super_admin |
| 48 | GET | `/api/admin/payments` | admin_orders | super_admin |
| 49 | GET | `/api/admin/coupons` | admin_orders | super_admin |
| 50 | POST | `/api/admin/coupons/{coupon_id}/void` | admin_orders | super_admin |
| 51 | GET | `/api/admin/locations` | admin_locations | super_admin |
| 52 | POST | `/api/admin/locations` | admin_locations | super_admin |
| 53 | PATCH | `/api/admin/locations/{location_id}` | admin_locations | super_admin |
| 54 | POST | `/api/admin/locations/{location_id}/pause` | admin_locations | super_admin |
| 55 | GET | `/api/admin/locations/{location_id}/daily` | admin_locations | super_admin |
| 56 | POST | `/api/admin/locations/{location_id}/adjust-day` | admin_locations | super_admin |
| 57 | GET | `/api/admin/locations/{location_id}/history` | admin_locations | super_admin |
| 58 | GET | `/api/admin/locations/{location_id}/stops` | admin_locations | manager_or_super (скоуп) |
| 59 | POST | `/api/admin/locations/{location_id}/stops` | admin_locations | manager_or_super (скоуп) |
| 60 | DELETE | `/api/admin/locations/{location_id}/stops/{drink_id}` | admin_locations | manager_or_super (скоуп) |
| 61 | GET | `/api/admin/location-status` | admin_locations (status_router) | staff (скоуп) |
| 62 | GET | `/api/admin/settings` | admin_settings | super_admin |
| 63 | PATCH | `/api/admin/settings` | admin_settings | super_admin |
| 64 | POST | `/api/admin/media` | admin_media | super_admin |
| 65 | GET | `/api/admin/content` | content (admin) | super_admin |
| 66 | POST | `/api/admin/content` | content (admin) | super_admin |
| 67 | PATCH | `/api/admin/content/{block_id}` | content (admin) | super_admin |
| 68 | GET | `/api/content` | content (public) | публично |
| 69 | GET | `/api/admin/dashboard` | dashboard | super_admin |
| 70 | WS | `/ws/orders/{order_id}` | ws | customer(свой)/staff (`?token=`) |
| 71 | WS | `/ws/admin/orders` | ws | staff (`?token=`) |
| 72 | GET | `/health` | main.py | публично |

> **Итог сверки:** 71 маршрут в смонтированных роутерах (69 REST + 2 WS) + `GET /health` = **72**. Это
> совпадает с фактом по коду (`grep` декораторов: 71 в роутерах + 1 в `main.py`). Число «17 смонтированных
> роутеров» из `_FACTS_SPINE` относится к объектам `APIRouter`, а не к эндпоинтам.

---

## Метки
✅ всё перечисленное реально смонтировано в `main.py`. 🧩 «спящие» в публичном потоке GRABZI:
addon-конфигуратор (`/api/drinks/{slug}/preview`, `…/bindings`) и возврат (`…/orders/{id}/refund`).
🔧 оплата работает в mock-режиме без `STRIPE_SECRET_KEY`; OTP — заглушка. ⚠️ контрактные дефекты
location-status (i18n-`name` + `{scope:"all",locations:[]}`) — **см. Часть IX**.
