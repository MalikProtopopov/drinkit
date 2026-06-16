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

## Деплой (flow)

Фронты — Next `output: standalone`, собираются **локально** (на сервере 2GB RAM — `next build`
не влезает), бандлы доставляются на сервер. Бэкенд собирается на сервере из `backend/`.

1. **Локально:** `bash deploy/build.sh` → соберёт `deploy/web` (grabzi-web) и `deploy/front` (app/).
2. **Доставить** `deploy/web` и `deploy/front` на сервер в `/opt/grabzi/deploy/` (rsync/scp).
3. **На сервере:** `cd /opt/grabzi && git pull origin grabzi-main && cd deploy && ./deploy.sh`
   (нужен `deploy/.env` с `JWT_SECRET`, см. `.env.example`).

> Бандлы (`deploy/web`, `deploy/front`) и `deploy/.env` — в `.gitignore` (большие/секрет).
> Роутинг доменов и SSL живут в общей серверной инфраструктуре
> (`/opt/mediannfront/nginx/nginx.conf`, certbot-volume), **не в этом репозитории**.

## Доступы в админку (сид по умолчанию)

| Роль | Email | Пароль |
|---|---|---|
| Супер-админ | `admin@juicy.ae` | `admin123` |
| Менеджер | `manager@juicy.ae` | `manager123` |
| Экран выдачи | `screen@juicy.ae` | `screen123` |

## TODO (опционально, для полностью git-triggered деплоя)
GitHub Actions: собирать оба фронта в CI → пушить образы в GHCR → сервер `docker compose pull`.
Тогда не нужны ни локальная сборка, ни доставка бандлов, ни бандлы в git.
