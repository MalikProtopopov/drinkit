# Juicy V2 — предзаказ напитков (juice bar, UAE)

Mobile-web сервис предзаказа соков с кастомизацией добавок, оплатой Stripe и выдачей к машине
(curbside pickup) + админ-панель для персонала. Собрано по функциональным требованиям
`Juicy_документы/Juicy_USER_STORIES_по_ролям.md` (32 user stories, 4 роли).

## Стек

| Слой | Технологии |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Zustand |
| Backend | FastAPI (Python 3.12) · SQLAlchemy 2 · JWT · WebSocket |
| БД | PostgreSQL 16 (prod) / SQLite (dev и тесты — работает без docker) |
| Оплата | Stripe Checkout (без ключа — mock-режим, оплата подтверждается сразу) |
| Realtime | WebSocket (статусы заказов клиенту и в админку) |

## Запуск локально

```bash
# 1. Backend (порт 8000) — БД и сиды создаются автоматически (SQLite)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload

# 2. Frontend (порт 3000)
cd app
npm install
npm run dev
```

Или через docker (PostgreSQL + Redis + backend):

```bash
docker compose up
cd app && npm run dev
```

## Доступы (dev-сиды)

| Кто | Где | Доступ |
|---|---|---|
| Клиент | http://localhost:3000 | любой телефон, SMS-код в dev-режиме: **1836** |
| Супер-админ | http://localhost:3000/admin/login | admin@juicy.ae / admin123 |
| Менеджер | http://localhost:3000/admin/login | manager@juicy.ae / manager123 |

## Что реализовано

**Клиент:** каталог по категориям (4, с бэка) → деталка с видео и конструктором добавок
(типы выбора один/несколько/счётчик, лимиты порций, live-пересчёт цены и КБЖУ) → корзина →
вход по SMS-коду → оформление с предзаполнением → Stripe → статус заказа по WebSocket →
«Прибыл, готов забрать» → оценка 👍/👎 → купон за дизлайк (списывает выбранный напиток).

**Админка:** вход по email/паролю, 2 роли. Менеджер: очередь заказов с фильтрами,
«Взять в работу» → «Готово» → «Передан», подсветка прибывших клиентов, история смен статусов.
Супер-админ: + дашборд (9 метрик с периодами), клиенты, платежи, купоны (аннулирование),
сотрудники, CRUD каталога через API (`/api/admin/catalog/*`).

**Статусная модель** — единое поле (`new → in_progress → ready → arrived → completed`, ветка
`refund` — опциональный модуль), стороны ставят статусы на своих этапах, всё в истории заказа.

## Тесты

```bash
cd backend && .venv/bin/python -m pytest tests/ -q   # 34 теста: каталог, конструктор,
                                                     # auth, заказы, купоны, роли, дашборд, возврат
```

## Переменные окружения

См. `backend/.env.example`. Ключевые: `DATABASE_URL`, `STRIPE_SECRET_KEY` (пусто = mock),
`OTP_DEV_MODE` (true = код 1836 в ответе API), `JWT_SECRET`.
Frontend: `NEXT_PUBLIC_API_URL` (по умолчанию http://localhost:8000).

## Структура

```
backend/            FastAPI: app/{core,models,routers,services} + tests (pytest)
app/                Next.js: клиент (/) и админка (/admin) — свой git-репозиторий
Juicy_документы/    Требования, смета, реестр экранов (исходные спеки)
CLAUDE_BUILD_PLAN.md  План сборки с прогрессом
```
