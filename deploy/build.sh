#!/usr/bin/env bash
# Локальная сборка обоих фронтов в Next standalone-бандлы для прод-деплоя.
# Запускать НА ЛОКАЛЬНОЙ машине (на сервере 2GB RAM next build не влезает).
# Результат: deploy/web (grabzi-web) и deploy/front (app/) — их потом доставляем на сервер.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
API="${NEXT_PUBLIC_API_URL:-https://api.grabzi.mediann.dev}"
echo "▸ API baked into bundles: $API"

build_one() {
  local src="$1" dest="$2"
  echo "▸ build $src -> deploy/$dest"
  ( cd "$src" && NEXT_PUBLIC_API_URL="$API" npx next build )
  rm -rf "$ROOT/deploy/$dest"
  cp -r "$src/.next/standalone" "$ROOT/deploy/$dest"
  cp -r "$src/.next/static" "$ROOT/deploy/$dest/.next/static"
  [ -d "$src/public" ] && cp -r "$src/public" "$ROOT/deploy/$dest/public"
  echo "  done: $(du -sh "$ROOT/deploy/$dest" | cut -f1)"
}

build_one grabzi-web web    # публичный сайт
build_one app        front  # полная админка
echo "▸ готово. Доставьте deploy/web и deploy/front на сервер и запустите deploy/deploy.sh"
