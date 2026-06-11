# План сборки единого ТЗ проекта GRABZI (рабочий документ)

> Рабочий файл-план по промпту `GRABZI_ПРОМПТ_сборка_ТЗ.md`. Фиксирует инвентаризацию, карту источников,
> сквозные «нити», структуру и чек-лист, чтобы итог (`docs/GRABZI_ЕДИНОЕ_ТЗ.md`) можно было собрать без
> потерь. Канон достоверности — код (`backend/`, `grabzi-web/`). Дата: 2026-06-10.

## 1. Инвентаризация источников (факт сверен)

| # | Источник | Канон для |
|---|---|---|
| S1 | `backend/app/models/**` (4 файла, **22 ORM-класса**) | доменная модель, поля, enum |
| S2 | `backend/app/routers/**` (**15 файлов / 17 смонтированных**) | API, контракты, ошибки |
| S3 | `backend/app/services/**` + `backend/app/core/**` (`errors.py` — коды) | правила, лимиты, статусы |
| S4 | `grabzi-web/src/app/**` | экраны клиента + `admin/login`, `admin/kitchen` |
| S5 | `grabzi-web/src/app/globals.css`, `public/brand`, `public/fonts` | дизайн-система |
| S6 | `reference_design/` | визуальный референс grabzi.ae |
| S7 | `docs/GRABZI_*.md` | проектные решения |
| S8 | `GRABZI_RUN.md`, `docker-compose.yml`, `backend/pyproject.toml` | запуск, инфраструктура |
| S9 | `backend/tests/**` (≈77 тестов) | охват тестами |
| S10 | `app/**` (Juicy) | визуальный референс супер-админских экранов (desktop) |
| S11 | `Juicy_документы/Juicy_*` | эталонные форматы (US/экраны/смета) |

Канонические факты сведены в `docs/_tz/_FACTS_SPINE.md`.

## 2. Сквозные «нити» (Часть VII), описываются один раз
платёж (Stripe+mock+webhook) · жизненный цикл заказа + WS · OTP · **дневной лимит** (ядро) · стоп-лист ·
купоны/рейтинг · статус точки · медиа · CMS · i18n.

## 3. Статусы/enum
`Order.status` new→in_progress→ready→completed(+refund) · `payment_status` pending→paid(failed/refunded) ·
`Coupon.status` active/used/void · `Drink.status` draft/published/hidden · `Location.effective_status`
open/paused/closed/inactive (вычисляемый) · `arrived_at` — независимый флаг.

## 4. Реестр дефектов/расхождений ⚠️ (в Часть IX)
1. Kitchen `LocStatusSchema` ждёт `name:string`, API отдаёт `name:{en:…}` → ложное «Session expired».
2. Super_admin на кухне получает `{scope:"all"}` — экран рассчитан на manager.
3. **VAT 5 % не реализован** (`total = subtotal − coupon_discount`).
4. Телефон-regex фронт (`^\+?\d{7,15}$`) ↔ бэк (`^\+\d{9,15}$`) расходятся.

## 5. Целевая структура (см. промпт §2 Шаг 5) — части 0–IX + приложения A–E.

## 6. Скриншоты — статус ✅ СНЯТЫ
Стек запущен (backend :8000 + grabzi-web :3001, сид `seed-grabzi`), создан демо-набор (клиент, оплаченный
заказ #1002, заказы на кухне в колонках NEW/MAKING/READY). 16 мобильных скриншотов (390×844) сняты через
`grabzi-web/scripts/screens.mjs` (playwright-core + Chrome) в `docs/screens/grabzi/`. Контур A покрыт;
контур B (ADM-S) — референс/плейсхолдер.

## 7. Порядок сборки
Части пишутся параллельно по `docs/_tz/_FACTS_SPINE.md`, затем собираются в `docs/GRABZI_ЕДИНОЕ_ТЗ.md`
со сквозной сверкой терминов и ссылок.

## 8. Чек-лист — см. промпт §10 (полнота моделей/эндпоинтов/историй/скриншотов/бизнес-артефактов).
