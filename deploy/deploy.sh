#!/usr/bin/env bash
# Прод-деплой GRABZI на сервере. Запускать в /opt/grabzi/deploy ПОСЛЕ git pull origin grabzi-main
# и доставки бандлов (deploy/web, deploy/front). Секрет — в deploy/.env (JWT_SECRET=...).
#
# ВАЖНО: всегда с -f docker-compose.prod.yml и -p grabzi (иначе подхватится корневой
# docker-compose.yml с лишними db/redis/backend).
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "нет deploy/.env с JWT_SECRET — создай из .env.example"; exit 1; }
[ -f web/server.js ] || { echo "нет deploy/web/server.js — собери локально (deploy/build.sh) и доставь"; exit 1; }
[ -f front/server.js ] || { echo "нет deploy/front/server.js — собери локально (deploy/build.sh) и доставь"; exit 1; }

docker compose -p grabzi -f docker-compose.prod.yml up -d --build --remove-orphans
docker ps --format '{{.Names}}\t{{.Status}}' | grep grabzi || true
echo "▸ готово. Роутинг доменов настраивается в общем nginx (НЕ в этом репозитории): /opt/mediannfront/nginx/nginx.conf"
