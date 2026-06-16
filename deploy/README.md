# GRABZI — продакшн-деплой

## Архитектура

```
                          ┌─ client_nginx_prod (общий reverse-proxy + SSL, на сервере) ─┐
 grabzi.mediann.dev ──────┤ → grabzi_web_prod : grabzi-web  (публичный сайт заказа)      │
 admin.grabzi.mediann.dev ┤ → grabzi_admin_prod : app/      (ПОЛНАЯ админка)             │
 api.grabzi.mediann.dev ──┤ → grabzi_api_prod : FastAPI + SQLite (общий бэкенд)          │
                          └──────────────────────────────────────────────────────────────┘
```

- **`grabzi-web`** (этот репозиторий, папка `grabzi-web/`) — актуальный **публичный** фронт
  (заказ, точки, меню, статусы) + лёгкий бариста-экран `/admin/kitchen`.
- **`app/`** — **полная админка** (дашборд, точки, каталог, клиенты, стафф, платежи, экран выдачи).
  Публичную часть `app/` НЕ используем (её заменил grabzi-web), но админку — да.
- **`backend/`** — FastAPI, SQLite в volume `grabzi_api_data`. Общий для обоих фронтов.
- Оба фронта запекают `NEXT_PUBLIC_API_URL=https://api.grabzi.mediann.dev` и ходят на API по нему.

## Деплой (flow) — из git одной командой

Всё собирается **на сервере из git** (фронты — multi-stage Docker из `grabzi-web/` и `app/`,
бэкенд — из `backend/`). Локальная сборка и доставка zip-бандлов **больше не нужны**.

```sh
ssh <server> 'cd /opt/grabzi && make restart'
```

`make restart` (см. корневой `Makefile`) делает: **stop** старых контейнеров → **prune**
build-кеша и dangling-образов → **git pull** `grabzi-main` → **build** образов (по одному —
экономим RAM) → **up** → **reload** общего nginx (новые IP апстримов).

Разовая настройка на сервере: создать `deploy/.env` с секретом (в git его нет):
```sh
cp deploy/.env.example deploy/.env && nano deploy/.env   # JWT_SECRET=$(openssl rand -hex 24)
```

Цели Makefile: `make restart` (полный цикл), `stop`, `clean`, `pull`, `build`, `up`,
`nginx-reload`, `ps`, `logs`.

> Безопасно для общего сервера: операции скоупятся проектом `grabzi`; `clean` чистит только
> build-cache + dangling-образы (именованный volume `grabzi_api_data` с БД и образы других
> проектов не трогаются).
> Роутинг доменов и SSL — в общей серверной инфраструктуре
> (`/opt/mediannfront/nginx/nginx.conf`, certbot-volume), **не в этом репозитории**.

> **Легаси (опционально):** `deploy/build.sh` + `deploy/deploy.sh` — старый путь со сборкой
> бандлов локально и доставкой в `deploy/web`/`deploy/front`. Оставлен на случай, если сервер
> не потянет сборку; для обычного деплоя не нужен.

## Доступы в админку (сид по умолчанию)

| Роль | Email | Пароль |
|---|---|---|
| Супер-админ | `admin@juicy.ae` | `admin123` |
| Менеджер | `manager@juicy.ae` | `manager123` |
| Экран выдачи | `screen@juicy.ae` | `screen123` |

## TODO (опционально, для полностью git-triggered деплоя)
GitHub Actions: собирать оба фронта в CI → пушить образы в GHCR → сервер `docker compose pull`.
Тогда не нужны ни локальная сборка, ни доставка бандлов, ни бандлы в git.
