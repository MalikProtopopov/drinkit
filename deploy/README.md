# JOOZ — продакшн-деплой

Деплой полностью **из git одной командой** (та же логика, что на ветке grabzi-main).
На сервере собираются образы из исходников: `app/` (публичный сайт + админка в одном Next)
и `backend/` (FastAPI). Локальная сборка и доставка zip-бандлов **не нужны**.

## Архитектура (2 сервиса)

```
                       ┌─ client_nginx_prod (общий reverse-proxy + SSL, на сервере) ─┐
 <домен JOOZ>      ────┤ → jooz_app : app/  (публичный сайт + админка, один Next)     │
 <домен API JOOZ> ────┤ → jooz_api : FastAPI + SQLite                                 │
                       └────────────────────────────────────────────────────────────┘
```

## Деплой одной командой

```sh
ssh <server> 'cd <путь-к-репо> && make restart'
```

`make restart` (корневой `Makefile`): **stop** старых контейнеров → **prune** build-кеша и
dangling-образов → **git pull** `jooz-main` → **build** образов (по одному, экономим RAM) →
**up** → **reload** общего nginx. Есть `make restart-hard` (буквально «сначала всё стоп»),
и отдельные цели `stop|clean|pull|build|up|nginx-reload|ps|logs`.

## Разовая настройка на сервере

1. Клонировать репозиторий и переключиться на `jooz-main`.
2. Создать `deploy/.env` (в git его нет):
   ```sh
   cp deploy/.env.example deploy/.env && nano deploy/.env
   #   JWT_SECRET=$(openssl rand -hex 24)
   #   NEXT_PUBLIC_API_URL=https://<домен API JOOZ>   # зашивается в app при сборке!
   ```
3. Убедиться, что внешняя docker-сеть `client_network_prod` и контейнер `client_nginx_prod`
   существуют (общая инфраструктура сервера). Если у JOOZ отдельный сервер/сеть — поправить
   имена в `deploy/docker-compose.prod.yml` и `Makefile` (`NGINX`).
4. Прописать маршрутизацию доменов → контейнеры `jooz_app`/`jooz_api` в общем nginx
   (`/opt/mediannfront/nginx/...`, **не в этом репозитории**), как для grabzi.

## Примечания

- Прод использует **SQLite** в volume `jooz_api_data` (как на grabzi — просто, без отдельной БД).
  Нужен Postgres — добавить сервис `db` и поменять `DATABASE_URL` в compose.
- `NEXT_PUBLIC_API_URL` зашивается в бандл **на этапе сборки** — после смены адреса нужен пересбор
  (`make build && make up`).
- Безопасно для общего сервера: всё скоупится проектом `jooz`; `make clean` чистит только
  build-cache и dangling-образы (том с БД и образы других проектов не трогаются).
