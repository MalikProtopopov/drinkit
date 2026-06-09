# GRABZI — как запустить

Стек: **PostgreSQL · Poetry · FastAPI · Next.js · Docker** (план §Р0.1).
Подробности — [docs/GRABZI_IMPLEMENTATION_PLAN.md](docs/GRABZI_IMPLEMENTATION_PLAN.md),
[docs/GRABZI_FRONTEND_SPEC.md](docs/GRABZI_FRONTEND_SPEC.md),
[docs/GRABZI_BACKEND_AND_TESTING.md](docs/GRABZI_BACKEND_AND_TESTING.md).

## Вариант A — всё через Docker (Postgres + MinIO + backend)
```bash
cp backend/.env.example .env          # при желании поправить секреты
docker compose up --build             # db + redis + minio + backend (alembic upgrade head)
# засеять GRABZI-данные (локации/каталог/контент/персонал):
docker compose exec backend python -m app.cli seed-grabzi
```
- API: http://localhost:8000 · MinIO-консоль: http://localhost:9001
- Персонал: `admin@grabzi.ae / grabzi-admin` (super_admin), `barista@grabzi.ae / grabzi-barista` (manager)

## Вариант B — бэкенд локально на SQLite (dev, без Docker)
```bash
cd backend
poetry install                        # или существующий venv
python -m app.cli seed-grabzi         # сиды GRABZI в sqlite (juicy.db)
uvicorn app.main:app --reload         # create_all поднимет схему автоматически
```

## Фронтенд GRABZI (отдельное приложение)
```bash
cd grabzi-web
cp .env.example .env.local            # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                           # http://localhost:3001
```
Экраны: `/` (главная) · `/locations` (выбор точки) · `/order` (заказ) · `/orders` (мои заказы) ·
`/orders/{id}` (статус) · `/info` · `/admin/login` + `/admin/kitchen` (экран готовки для бариста).

## Тесты
```bash
cd backend && python -m pytest                 # 79 тестов (SQLite)
# тест гонки лимита на реальном Postgres (нужен Docker):
python -m pytest -m concurrency --count=10
cd ../grabzi-web && npm run build              # проверка сборки фронта
```

## Миграции (прод, Postgres)
```bash
cd backend
alembic upgrade head                  # 0001 baseline (вся схема, вкл. GRABZI-локации)
# при изменении моделей: alembic revision --autogenerate -m "..." (ревью обязательно)
```
> Dev/тесты используют `create_all` (SQLite) для скорости; прод — Alembic на Postgres.
