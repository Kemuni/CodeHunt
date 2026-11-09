from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app import models  # noqa: E402 F401 -- регистрация моделей для автогенерации
from app.core.config import settings  # noqa: E402
from app.core.db import Base  # noqa: E402

target_metadata = Base.metadata


def get_db_connection_url() -> str:
    return str(settings.DATABASE_URL).replace(
        "postgresql+asyncpg://", "postgresql+psycopg://", 1
    )


def run_migrations_offline() -> None:
    """Сформировать SQL миграций без подключения к базе."""
    context.configure(
        url=get_db_connection_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Выполнить миграции через подключение к базе."""
    configuration = config.get_section(config.config_ini_section)
    assert configuration is not None
    configuration["sqlalchemy.url"] = get_db_connection_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
