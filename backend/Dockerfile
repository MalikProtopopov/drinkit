FROM python:3.12-slim
WORKDIR /srv

# Poetry (план §13) вместо ручного pip; зависимости из pyproject.toml
RUN pip install --no-cache-dir poetry==1.8.* && poetry config virtualenvs.create false

COPY pyproject.toml ./
# poetry.lock коммитится после первого `poetry lock`; ставим основную группу
RUN poetry install --no-root --only main --no-interaction || poetry install --no-root --no-interaction

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

# миграции прогоняются в compose command (alembic upgrade head) перед uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
