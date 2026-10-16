.PHONY: up-dev-env fastapi-dev precommit-check sync-all test

DEV_SERVICES = db

UV_COMMAND = uv --directory backend

# Start development environment
up-dev-env:
	docker compose -f compose.yml up --build -d ${DEV_SERVICES}

# Stop development environment (Postgres, ES, Kibana, init-data)
down-dev-env:
	docker compose -f compose.yml down ${DEV_SERVICES}

up-all:
	docker compose -f compose.yml up --build -d

down-all:
	docker compose -f compose.yml down

# Run FastAPI in development mode
fastapi-dev:
	${UV_COMMAND} run fastapi dev

# Sync all uv packages
sync-all:
	${UV_COMMAND} sync --all-packages

ruff-fix:
	${UV_COMMAND} run ruff check --force-exclude --fix && ${UV_COMMAND} run ruff format --force-exclude

ruff-check:
	${UV_COMMAND} run ruff check

ty:
	${UV_COMMAND} run ty check
