#!/usr/bin/env bash
# Локальный редеплой продакшн-сборки на http://localhost:3100
# Использование: ./redeploy.sh   (из папки app)
set -euo pipefail

PORT=3100
cd "$(dirname "$0")"

echo "▸ Останавливаю старый сервер на :$PORT ..."
# Убиваем то, что слушает порт (next start + его npm-обёртку)
if pids=$(lsof -nP -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null); then
  # добиваем и родительские npm exec процессы
  for pid in $pids; do
    ppid=$(ps -o ppid= -p "$pid" | tr -d ' ' || true)
    kill "$pid" 2>/dev/null || true
    [ -n "${ppid:-}" ] && kill "$ppid" 2>/dev/null || true
  done
  sleep 1
fi

echo "▸ Пересборка (next build) ..."
npx next build

echo "▸ Запуск next start -p $PORT ..."
# Запускаем в фоне, лог в .next/redeploy.log
nohup npx next start -p $PORT > .next/redeploy.log 2>&1 &
echo "▸ Готово. PID $! · логи: app/.next/redeploy.log · http://localhost:$PORT"
