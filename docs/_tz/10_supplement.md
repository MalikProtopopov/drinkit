# Приложения-дополнения (F–J): сравнение с Juicy, полнота, доп. скриншоты

> Этот блок закрывает выявленные пробелы анализа и добавляет: карту происхождения функционала
> **GRABZI ↔ Juicy** (Приложение F), полный реестр кодов ошибок и сверку ERR_COPY (G), дополнения к
> реестру дефектов (H), галерею desktop-референсов супер-админки (I) и дополнительные состояния
> клиентских экранов (J). Канон достоверности — код прототипа.

---

## Приложение F. Карта происхождения функционала — GRABZI vs Juicy

> **Для заказчика.** GRABZI и Juicy используют **общую кодовую базу backend** (один сервер, разные сиды:
> `seed()` — Juicy, `seed_grabzi()` — GRABZI). Поэтому часть функционала **унаследована** из Juicy «как
> есть», часть — **доработана** под формат drive-through, а часть — **создана с нуля** под GRABZI.
> Метка в таблице сразу показывает, что переиспользовано, а что — новое (это же лежит в основе сметы,
> см. отдельный файл `GRABZI_СМЕТА_по_функционалу.xlsx`).

**Легенда меток происхождения** (используется и в заголовках частей ТЗ):

| Метка | Значение |
|---|---|
| 🟦 **JUICY** | функционал из проекта Juicy, переиспользован практически без изменений |
| 🟨 **GRABZI⁺** | блок Juicy, **доработанный** под GRABZI (указано, в чём именно доработка) |
| 🟩 **GRABZI** | **новый** функционал под GRABZI, которого в Juicy не было |

| # | Функциональный блок | Метка | Что в GRABZI | Соответствие Juicy-сметы |
|---|---|---|---|---|
| 1 | Инфраструктура и окружение (репо, БД, JWT, WebSocket, Stripe-webhook, S3/MinIO) | 🟨 GRABZI⁺ | Juicy-каркас + хранилище медиа S3/MinIO, отдельный фронт `grabzi-web` (Next.js 16) | стр. 1 |
| 2 | Каталог: категории + список напитков + карточка | 🟦 JUICY | те же модели; в GRABZI 1 категория «Ice V'60», 4 напитка; без видео-hero | стр. 2 |
| 3 | Конструктор добавок + КБЖУ (live-пересчёт) | 🟦 JUICY | таблицы есть, но в публичном потоке GRABZI **«спят»** (kcal=0, без допов) 🧩 | стр. 3 |
| 4 | Заказ: **однооэкранный** (без корзины) | 🟩 GRABZI | весь заказ на одном экране `/order`; заменяет Juicy-корзину; новый фронт + UX | заменяет стр. 4 (корзина) |
| 5 | Авторизация по телефону + SMS-OTP | 🟦 JUICY | та же логика; в GRABZI OTP — **заглушка** (вход без кода) | стр. 5 |
| 6 | Оформление заказа + оплата Stripe + webhook | 🟨 GRABZI⁺ | добавлены `car_plate`/`emirate`, привязка к точке, **жёсткая проверка дневного лимита под `FOR UPDATE`** при оплате | стр. 6 |
| 7 | Статусы + realtime WS + «Я приехал» | 🟨 GRABZI⁺ | curbside-выдача **по номеру машины**, бейдж «🚗 HERE», **per-location** admin-WS-каналы | стр. 7 |
| 8 | Мои заказы + профиль | 🟦 JUICY | переиспользовано; профиль минимальный | стр. 8, 9 |
| 9 | Админ-каркас, вход персонала, роли | 🟨 GRABZI⁺ | добавлен **location-scoped manager** (бариста видит только свою точку, 403 на чужую) | стр. 10 |
| 10 | Админ-каталог (категории/добавки/ед.изм./напитки/привязки) | 🟦 JUICY | переиспользовано «как есть» | стр. 11 |
| 11 | Админ-заказы (фильтры, «Взять», статусы, состав) | 🟨 GRABZI⁺ | добавлен фильтр/скоуп по точке для менеджера | стр. 12 |
| 12 | Дизайн / редизайн под grabzi.ae | 🟩 GRABZI | новая фирменная система: терракота/лайм, шрифт Grenadine, иконки, mobile-frame | стр. 13 (дизайн) |
| 13 | **Локации**: модель, выбор точки (клиент), CRUD, рабочие часы (TZ, смена через полночь) | 🟩 GRABZI | новые сущности `Location`/часы/таймзона; экран выбора точки L1 | **нет в Juicy** |
| 14 | **Дневной лимит + счётчик** (резерв под `FOR UPDATE`, adjust-day, освобождение при возврате/в полночь, TODAY'S LIMIT) | 🟩 GRABZI | **ядро бизнес-модели** «come early — we don't make more» | **нет в Juicy** |
| 15 | **Curbside**: `car_plate`/`emirate`, «Я приехал» по машине, «🚗 HERE» на кухне | 🟩 GRABZI | выдача в окне по номеру машины | **нет в Juicy** |
| 16 | **Стоп-лист напитков по точке** (`LocationDrinkStop`) | 🟩 GRABZI | бариста скрывает напиток на точке; в Juicy был только глобальный `Drink.status=hidden` | **нет в Juicy** |
| 17 | **Статус точки** (open/paused/closed/inactive, вычисляемый) + пауза/история событий | 🟩 GRABZI | оперативное управление точкой | **нет в Juicy** |
| 18 | **Кухня / KDS** (канбан NEW/MAKING/READY/DONE, take/ready/handover, realtime, панель остатка) | 🟩 GRABZI | новый **планшетный операционный экран**; Juicy «админ-заказы» — список, не KDS | расширяет стр. 12 → новый экран |
| 19 | **Управление точками** (супер-админ): CRUD, пауза, adjust-day, история | 🟩 GRABZI | панель сети точек | **нет в Juicy** |
| 20 | **CMS** `InfoBlock` + публичная `/info` | 🟩 GRABZI | редактируемый контент (Story/Contact/Hours) | **нет в Juicy** |
| 21 | **Настройки** сети (`AppSetting` registry) | 🟩 GRABZI | глобальные дефолты/флаги; в Juicy ADM-S-11 была только локализация | **частично** (стр. 16 → расширено) |
| 22 | Оффлайн-баннер (PWA-мелочь) | 🟩 GRABZI | глобальный баннер при потере сети | **нет в Juicy** |
| 23 | Оценка 👍/👎 → купон (лояльность) | 🟦 JUICY | на API есть; клиентского UI в `grabzi-web` пока нет 🚧 | стр. 14, 15 (O1/O2) |
| 24 | Локализация RU/AR + RTL | 🟦 JUICY | в GRABZI EN-first; AR/RTL инфраструктурно заложен (V1.1) | стр. 16 (O3) |
| 25 | Админ: клиенты + платежи | 🟦 JUICY | переиспользовано | стр. 17 (O4) |
| 26 | Дашборд: 9 метрик | 🟦 JUICY | переиспользовано; работает на данных GRABZI | стр. 18 (O5) |
| 27 | Возврат заказа (refund) | 🟨 GRABZI⁺ | Juicy-возврат + **декремент дневного счётчика** того же бизнес-дня | стр. 19 (O6) |

**Итог сравнения (для заказчика).** Из ~27 блоков: **🟦 JUICY** (переиспользовано) — 9; **🟨 GRABZI⁺**
(доработано) — 6; **🟩 GRABZI** (новое) — 12. Ядро отличия GRABZI от Juicy — **локации + дневной лимит +
curbside-выдача + кухня (KDS) + операционное управление точкой**; это и формирует основную стоимость
«доработки» (см. смету, вариант B).

---

## Приложение G. Полный реестр кодов ошибок (расширяет Приложение C)

> В Приложении C сведён канонический `Err`-enum (`backend/app/core/errors.py`, 14 кодов). Фактически в
> роутерах/сервисах выбрасывается **~47** строковых кодов. Ниже — полный список (сверено
> `grep` по `backend/app/routers/**` и `services/**`). Колонка «В `Err`» отмечает, входит ли код в
> канонический enum (остальные определены прямо в роутерах — кандидаты на перенос в `errors.py`, см. DEF-08).

### G.1 Канонический `Err`-enum (14) — см. Приложение C
`LOCATION_REQUIRED` 422 · `LOCATION_NOT_FOUND` 404 · `LOCATION_CLOSED` 409 (+next_open_at) · `LOCATION_PAUSED` 409 ·
`LOCATION_LIMIT_REACHED` 409 (+remaining) · `LOCATION_SOLD_OUT` 409 · `DRINK_UNAVAILABLE_AT_LOCATION` 409 ·
`STOCK_LESS_THAN_ORDER` 409 (+remaining) · `DRINK_NOT_AVAILABLE` 409 · `CART_EMPTY` 422 · `CAR_PLATE_REQUIRED` 422 ·
`ORDER_NOT_PAID` 409 · `FORBIDDEN` 403 · `FOREIGN_LOCATION` 403.

### G.2 Коды вне `Err`-enum (определены в роутерах/сервисах)

| Код | HTTP | Где/смысл | В `Err` |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | требуется токен (зависимость авторизации) | нет |
| `INVALID_CREDENTIALS` | 401 | неверный email/пароль персонала (`staff.py`) | нет |
| `OTP_INVALID` | 401/422 | неверный/просроченный SMS-код (`auth.py`) | нет |
| `PHONE_INVALID` | 422 | телефон не по маске `^\+\d{9,15}$` (`auth.py`) | нет |
| `NOT_FOUND` | 404 | сущность не найдена (общий, разные роутеры) | нет |
| `ALREADY_PAID` | 409 | заказ уже оплачен (`payments.py`) | нет |
| `ALREADY_RATED` | 409 | заказ уже оценён (`orders.py /rate`) | нет |
| `ORDER_NOT_RATABLE` | 409 | заказ нельзя оценить (не выдан) | нет |
| `ORDER_FINISHED` | 409 | действие невозможно на завершённом заказе | нет |
| `COUPON_NOT_ACTIVE` | 409 | купон не активен (использован/аннулирован) | нет |
| `COUPON_INVALID` | 409 | купон не принадлежит клиенту/невалиден | нет |
| `COUPON_ITEM_REQUIRED` | 422 | не указана позиция для применения купона | нет |
| `EMAIL_TAKEN` | 409 | email персонала занят (`admin staff`) | нет |
| `SLUG_TAKEN` | 409 | slug напитка занят (`admin catalog`) | нет |
| `CODE_TAKEN` | 409 | код единицы измерения занят | нет |
| `KEY_TAKEN` | 409 | ключ InfoBlock/настройки занят | нет |
| `CANNOT_DELETE_SELF` | 409 | супер-админ не может удалить себя | нет |
| `BAD_SIGNATURE` | 400 | неверная подпись Stripe-webhook | нет |
| `MEDIA_STORAGE_DISABLED` | 503 | S3/MinIO не настроен (`admin_media`) | нет |
| `MEDIA_TOO_LARGE` | 413 | файл превышает лимит | нет |
| `MEDIA_TYPE_NOT_ALLOWED` | 415 | недопустимый тип файла | нет |
| `ADDON_NOT_AVAILABLE` | 409 | доп недоступен (конструктор 🧩) | нет |
| `ADDON_PORTIONS_OUT_OF_RANGE` | 422 | порции допа вне диапазона | нет |
| `SELECTION_TYPE_VIOLATED` | 422 | нарушено правило выбора (single/multi/counter) | нет |
| `PORTIONS_RANGE_INVALID` | 422 | некорректный диапазон порций (админ) | нет |
| `UNKNOWN_SETTING_KEY` | 422 | неизвестный ключ настройки | нет |
| `INVALID_SETTING` / `VALIDATION_ERROR` | 422 | значение настройки не прошло валидацию | нет |
| `EMAIL_INVALID` · `TZ_INVALID` · `INT_INVALID` · `BOOL_EXPECTED` · `ENUM_INVALID` | 422 | примитивы валидатора настроек/полей | нет |

> **DEF-08 (новый дефект-консистентность).** ~33 кода выбрасываются вне `Err`-enum. Рекомендация: свести
> все коды в `core/errors.py` (единый реестр) — упростит сверку и фронтовый ERR_COPY.

### G.3 Сверка фронтового ERR_COPY (закрывает требование чек-листа §10)

Фронт «очеловечивает» коды только в `grabzi-web/src/app/order/page.tsx` (карта `ERR_COPY`). Покрыто **7**
кодов; всё остальное падает в дженерик-фолбэк «Something went wrong.» / «Payment couldn't start.».

| Код | Текст ERR_COPY (фронт) | Покрытие |
|---|---|---|
| `LOCATION_CLOSED` | "This spot is closed now." | ✅ |
| `LOCATION_PAUSED` | "This spot paused new orders." | ✅ |
| `LOCATION_LIMIT_REACHED` | "Sold out for today at this spot." | ✅ |
| `LOCATION_SOLD_OUT` | "Sold out for today." | ✅ |
| `DRINK_UNAVAILABLE_AT_LOCATION` | "A drink just sold out here." | ✅ |
| `STOCK_LESS_THAN_ORDER` | "Only a few left — reduce the quantity." | ✅ |
| `NETWORK` | "Can't reach GRABZI. Check your connection." | ✅ |
| `CAR_PLATE_REQUIRED`, `ORDER_NOT_PAID`, `OTP_INVALID`, `LOCATION_CLOSED`(др.экраны) и ~40 прочих | дженерик-фолбэк | 🚧 пробел UX |

> **Рекомендация (UX-пробел).** Расширить `ERR_COPY` и вынести его в общий модуль: как минимум добавить
> человекочитаемые тексты для `CAR_PLATE_REQUIRED`, `OTP_INVALID`, `LOCATION_NOT_FOUND`, `ORDER_NOT_PAID`,
> `ORDER_FINISHED`. Зафиксировано как открытый вопрос (UX).

---

## Приложение H. Дополнения к реестру дефектов (к §IX.6)

| ID | Дефект | Риск | Рекомендация |
|---|---|---|---|
| **DEF-05** | Две оси статуса платежа: `Payment.status` = `succeeded`, а `Order.payment_status` = `paid` | Ошибки маппинга в отчётах/сверках, webhook пишет в обе сущности | Задокументировать правило соответствия `succeeded↔paid`; единый словарь статусов в отчётах |
| **DEF-06** | `GET /api/admin/dashboard` отдаёт `name` в `byLocation`/`topProducts` как i18n-объект `{en:…}` (тот же класс, что DEF-01) | На будущем экране ADM-S-01 пустые/[object Object] подписи | Распаковывать через `pick_locale` на фронте или нормализовать на бэке |
| **DEF-07 (PII)** | `GET /api/admin/dashboard` → `topCustomers` возвращает **сырые `phone` и `name`** клиентов | Раскрытие прямого идентификатора (PDPL) в аналитике | Маскировать телефон в рейтинге или ограничить доступ/обосновать правовым основанием (привязать к Q-PLATE-PII) — отразить в AC ADM-S-01 и §I.6 |
| **DEF-08** | ~33 кода ошибок вне `Err`-enum (см. G.2) | Рассинхрон фронт/бэк, неполный ERR_COPY | Свести коды в `core/errors.py` |

---

## Приложение I. Галерея супер-админки (ADM-S) — desktop-референс

> **Дисклеймер (контур B).** Экраны супер-админа в `grabzi-web` ещё не реализованы как отдельный UI;
> ниже — **рабочий desktop-референс**: UI-оболочка прежнего прототипа (`app/`) на **реальных данных
> GRABZI** (вход супер-админом `admin@grabzi.ae`, backend GRABZI). Брендинг оболочки — служебный; целевой
> grabzi-UI этих экранов проектируется на этапе реализации. Скриншоты viewport 1440×900.

| История | Экран | Скриншот |
|---|---|---|
| ADM-S вход | `/admin/login` (desktop) | ![ADM-S login](screens/grabzi-admin/adm-login.png) |
| **ADM-S-01** | Дашборд сети — 9 метрик (выручка/чеки/порции/средний чек/пиковый час/топ-напитки/клиенты) | ![ADM-S dashboard](screens/grabzi-admin/adm-dashboard.png) |
| **ADM-S-02** | Все заказы сети (фильтры, статусы) | ![ADM-S orders](screens/grabzi-admin/adm-orders.png) |
| **ADM-S-03** | Клиенты (PII: телефон/номер машины/эмират) | ![ADM-S customers](screens/grabzi-admin/adm-customers.png) |
| **ADM-S-04** | Платежи — журнал транзакций | ![ADM-S payments](screens/grabzi-admin/adm-payments.png) |
| **ADM-S-05** | Купоны — реестр + аннулирование | ![ADM-S coupons](screens/grabzi-admin/adm-coupons.png) |
| **ADM-S-06** | Персонал — роли/привязка/отключение | ![ADM-S staff](screens/grabzi-admin/adm-staff.png) |
| **ADM-S-07** | Каталог: категории напитков | ![ADM-S categories](screens/grabzi-admin/adm-catalog-categories.png) |
| **ADM-S-08** | Каталог: напитки (цена/медиа/статус) | ![ADM-S products](screens/grabzi-admin/adm-catalog-products.png) |
| **ADM-S-09** | Каталог: добавки 🧩 | ![ADM-S addons](screens/grabzi-admin/adm-catalog-addons.png) · ![ADM-S groups](screens/grabzi-admin/adm-catalog-groups.png) |
| **ADM-S-10** | Локации/точки (часы, лимит, пауза) | ![ADM-S outlets](screens/grabzi-admin/adm-outlets.png) |

> ADM-S-11 «Настройки» и ADM-S-12 «CMS/медиа» отдельных маршрутов в desktop-референсе `app/` не имеют →
> остаются 🚧-плейсхолдером (проектируются по контракту API; см. ADM-S-11/12 в Части V).

---

## Приложение J. Дополнительные состояния клиентских экранов (контур A)

> Доснятые мобильные состояния (390×844) к ранее описанным историям — закрывают пробел покрытия §4.

| Экран · состояние | История | Скриншот |
|---|---|---|
| ST1 «Готовим» (in_progress) + кнопка «I'm here 🚗» | ST1-a/ST1-b | ![ST1 making](screens/grabzi/order-status--making.png) |
| ST1 «Готов — подъезжайте» (ready) | ST1-a | ![ST1 ready](screens/grabzi/order-status--ready.png) |
| OR1 пустой список (авторизован, заказов нет) | OR1 | ![OR1 empty](screens/grabzi/orders--empty.png) |
| P1 «Напиток не найден» | P1 | ![P1 error](screens/grabzi/product--error.png) |
| O1 ошибка загрузки заказа («Change location») | O1 | ![O1 error](screens/grabzi/order--error.png) |
| ADM-M кухня — «Session expired» (истёкший токен) | ADM-M-01/02 | ![Kitchen session expired](screens/grabzi/admin-kitchen--session-expired.png) |

**Осознанно не сняты (зафиксировано как пробел):** O1 «лимит исчерпан» overlay и «применённый купон»
(UI купона в `grabzi-web` не реализован 🚧); ST1 refund (опц. модуль). Снимаются после реализации
соответствующего UI.
