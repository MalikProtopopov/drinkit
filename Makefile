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

.PHONY: restart restart-hard stop clean pull build up ps logs nginx-reload check-env

## Передеплой из git с минимальным простоем (рекомендуется):
## pull → build (старые контейнеры ещё работают) → up (пересоздание ~15с) → prune → nginx reload.
## Делает всё, что просили (обновление кода, остановка старых, чистка мусора, рестарт),
## но строит ДО остановки — поэтому сайт лежит только на время пересоздания, а не всей сборки.
restart: check-env pull build up clean nginx-reload
	@echo "▸ restart готово:"
	@$(COMPOSE) ps

## Жёсткий вариант (буквальный порядок: сначала всё стоп): stop → prune → pull → build → up.
## Дольше простой (сборка идёт уже без контейнеров), но гарантированно чистый старт.
restart-hard: check-env stop clean pull build up nginx-reload
	@echo "▸ restart-hard готово:"
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
