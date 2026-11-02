.PHONY: up-dev-env down-dev-env up-all down-all fastapi-dev sync-all migrate seed test test-cov ruff-fix ruff-check ty precommit-check logs

COMPOSE = docker compose -f compose.yml
DEV_SERVICES = db minio minio-init adminer
UV_COMMAND = uv --directory backend

# Окружение для локального backend: БД, файлы и интерфейсы управления.
up-dev-env:
	$(COMPOSE) up -d --wait $(DEV_SERVICES)

# Останавливает инфраструктуру, сохраняя контейнеры и данные.
down-dev-env:
	$(COMPOSE) stop $(DEV_SERVICES)

# Полное приложение; backend применяет миграции при запуске.
up-all:
	$(COMPOSE) up --build -d --wait

down-all:
	$(COMPOSE) down

fastapi-dev:
	$(UV_COMMAND) run fastapi dev

sync-all:
	$(UV_COMMAND) sync --frozen

migrate:
	$(UV_COMMAND) run alembic upgrade head

seed:
	$(UV_COMMAND) run python -m scripts.seed_demo

# Testcontainers самостоятельно запускает и удаляет Docker-сервисы.
test:
	$(UV_COMMAND) run pytest

test-cov:
	$(UV_COMMAND) run pytest --cov=app --cov-report=term-missing

ruff-fix:
	$(UV_COMMAND) run ruff check --force-exclude --fix
	$(UV_COMMAND) run ruff format --force-exclude

ruff-check:
	$(UV_COMMAND) run ruff check .
	$(UV_COMMAND) run ruff format --check .

ty:
	$(UV_COMMAND) run ty check

precommit-check: ruff-check ty test

logs:
	$(COMPOSE) logs -f backend
