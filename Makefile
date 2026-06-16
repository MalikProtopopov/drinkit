# GRABZI — деплой с сервера одной командой: `make restart` (запускать в /opt/grabzi).
#
# Полный цикл из git, без локальной сборки и доставки zip:
#   stop → prune (кеш/мусор) → git pull → build (из исходников) → up → nginx reload.
# Фронты собираются на сервере (multi-stage Docker), бэкенд — тоже из backend/.
#
# Безопасно для общего сервера: затрагивает только проект `grabzi`; prune чистит лишь
# build-cache и dangling-образы (именованные volume'ы и образы других проектов не трогаются).
SHELL := /bin/bash
COMPOSE := docker compose -p grabzi -f deploy/docker-compose.prod.yml
BRANCH := grabzi-main
NGINX := client_nginx_prod

.PHONY: restart stop clean pull build up ps logs nginx-reload check-env

## Полный передеплой из git (то, что нужно в 99% случаев)
restart: check-env stop clean pull build up nginx-reload
	@echo "▸ restart готово:"
	@$(COMPOSE) ps

## 1) остановить старые контейнеры grabzi (другие проекты не трогаем)
stop:
	@echo "▸ [1/4] stop старых контейнеров…"
	-$(COMPOSE) down --remove-orphans

## 2) почистить docker-мусор: build-cache + dangling-образы (volume'ы/чужие образы целы)
clean:
	@echo "▸ [2/4] prune build-cache + dangling images…"
	-docker builder prune -af
	-docker image prune -f

## 3) подтянуть обновления кода
pull:
	@echo "▸ [3/4] git pull origin $(BRANCH)…"
	git pull --ff-only origin $(BRANCH)

## 4a) собрать образы из исходников (по одному — экономим RAM на сервере)
build:
	@echo "▸ [4/4] build образов (последовательно)…"
	$(COMPOSE) build grabzi_api
	$(COMPOSE) build grabzi_web
	$(COMPOSE) build grabzi_admin

## 4b) поднять контейнеры на новых образах
up:
	$(COMPOSE) up -d --remove-orphans

## после пересоздания у контейнеров новые IP — заставляем общий nginx перечитать апстримы
nginx-reload:
	@docker exec $(NGINX) nginx -s reload 2>/dev/null \
	  && echo "▸ nginx reloaded (upstream IPs обновлены)" \
	  || echo "⚠ не удалось reload $(NGINX) — вручную: docker exec $(NGINX) nginx -s reload"

## без deploy/.env с JWT_SECRET бэкенд не поднимется — проверяем заранее
check-env:
	@test -f deploy/.env || { echo "✗ нет deploy/.env с JWT_SECRET (см. deploy/.env.example)"; exit 1; }

ps:
	@$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=120
