# JOOZ — деплой с сервера одной командой: `make restart` (запускать в каталоге проекта на сервере).
#
# Полный цикл из git, без локальной сборки и доставки zip:
#   stop → prune (кеш/мусор) → git pull → build (из исходников) → up → nginx reload.
# app/ (публичный сайт + админка) и бэкенд собираются на сервере из исходников.
#
# Безопасно для общего сервера: затрагивает только проект `deploy` (juicy_*); prune чистит лишь
# build-cache и dangling-образы (именованные volume'ы и образы других проектов не трогаются).
SHELL := /bin/bash
# проект `deploy` (== как у живого стека на сервере) → пересоздаём те же juicy_*-контейнеры,
# том deploy_juicy_api_data с БД переиспользуется.
COMPOSE := docker compose -p deploy -f deploy/docker-compose.prod.yml
BRANCH := jooz-main
NGINX := client_nginx_prod

.PHONY: restart restart-hard stop clean pull build up ps logs nginx-reload check-env

## Передеплой из git с минимальным простоем (рекомендуется):
## pull → build (старые контейнеры ещё работают) → up (пересоздание ~15с) → prune → nginx reload.
restart: check-env pull build up clean nginx-reload
	@echo "▸ restart готово:"
	@$(COMPOSE) ps

## Жёсткий вариант (буквальный порядок: сначала всё стоп): stop → prune → pull → build → up.
restart-hard: check-env stop clean pull build up nginx-reload
	@echo "▸ restart-hard готово:"
	@$(COMPOSE) ps

## остановить контейнеры проекта (другие проекты не трогаем)
stop:
	@echo "▸ stop контейнеров (project=deploy)…"
	-$(COMPOSE) down --remove-orphans

## почистить docker-мусор: build-cache + dangling-образы (volume'ы/чужие образы целы)
clean:
	@echo "▸ prune build-cache + dangling images…"
	-docker builder prune -af
	-docker image prune -f

## подтянуть обновления кода
pull:
	@echo "▸ git pull origin $(BRANCH)…"
	git pull --ff-only origin $(BRANCH)

## собрать образы из исходников (по одному — экономим RAM на сервере)
build:
	@echo "▸ build образов (последовательно)…"
	$(COMPOSE) build juicy_api
	$(COMPOSE) build juicy_frontend

## поднять контейнеры на новых образах
up:
	$(COMPOSE) up -d --remove-orphans

## после пересоздания у контейнеров новые IP — общий nginx перечитывает апстримы
nginx-reload:
	@docker exec $(NGINX) nginx -s reload 2>/dev/null \
	  && echo "▸ nginx reloaded (upstream IPs обновлены)" \
	  || echo "⚠ не удалось reload $(NGINX) — вручную: docker exec $(NGINX) nginx -s reload"

## без deploy/.env (JWT_SECRET + NEXT_PUBLIC_API_URL) сборка/старт не пройдут — проверяем заранее
check-env:
	@test -f deploy/.env || { echo "✗ нет deploy/.env (JWT_SECRET, NEXT_PUBLIC_API_URL) — см. deploy/.env.example"; exit 1; }

ps:
	@$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=120
