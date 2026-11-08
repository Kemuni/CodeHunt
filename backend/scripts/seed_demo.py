"""Явное повторяемое заполнение демоданных: uv run python -m scripts.seed_demo."""

import asyncio
import logging

from sqlalchemy import select

from app.core.db import async_session_maker, engine
from app.models import (
    Task,
    TaskComplication,
    TaskComplicationCategory,
    TaskComplicationLink,
    TaskLevelPreset,
    User,
)
from app.models.enums import LEVELS

logger = logging.getLogger(__name__)


async def seed():
    async with async_session_maker() as db:
        for email, admin in [
            ("admin@example.com", True),
            ("developer@example.com", False),
        ]:
            user = await db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(email=email, is_admin=admin)
                db.add(user)
                await db.flush()
            logger.info(
                "Demo user %s: X-User-ID=%s, is_admin=%s", email, user.id, user.is_admin
            )
        category = await db.scalar(
            select(TaskComplicationCategory)
            .where(
                TaskComplicationCategory.title == "Списки и навигация",
                TaskComplicationCategory.developer_type == "frontend",
            )
            .order_by(TaskComplicationCategory.id)
            .limit(1)
        )
        if category is None:
            category = TaskComplicationCategory(
                title="Списки и навигация",
                developer_type="frontend",
            )
            db.add(category)
            await db.flush()
        template = await db.scalar(
            select(TaskComplication)
            .where(
                TaskComplication.category_id == category.id,
                TaskComplication.title == "Пагинация",
            )
            .order_by(TaskComplication.id)
            .limit(1)
        )
        if template is None:
            template = TaskComplication(
                category_id=category.id,
                title="Пагинация",
                description="Разделение длинных списков на страницы; адаптируйте требования под проект.",
            )
            db.add(template)
            await db.flush()
        parent_id = None
        for developer_type in ("frontend", "fullstack"):
            slug = f"demo-movie-catalog-{developer_type}"
            task = await db.scalar(select(Task).where(Task.slug == slug))
            if task is None:
                task = Task(
                    slug=slug,
                    title=f"Каталог фильмов ({developer_type})",
                    short_description="Каталог фильмов и сотрудников",
                    full_description="Создайте каталог с карточками фильмов, списками и поиском.",
                    developer_type=developer_type,
                    difficulty_from=0,
                    difficulty_to=10,
                    status="published",
                    parent_task_id=parent_id,
                )
                db.add(task)
                await db.flush()
                for index, level in enumerate(LEVELS):
                    db.add(
                        TaskLevelPreset(
                            task_id=task.id,
                            level=level,
                            description=f"Конфигурация {level}",
                            average_days_to_complete=(index + 1) * 3,
                        )
                    )
                for index, (title, level) in enumerate(
                    [
                        ("Пагинация фильмов", "easy"),
                        ("Пагинация сотрудников", "medium"),
                        ("Поиск и фильтры", "high"),
                    ]
                ):
                    db.add(
                        TaskComplicationLink(
                            task_id=task.id,
                            complication_id=template.id if index < 2 else None,
                            title=title,
                            description=f"Реализуйте: {title.lower()}.",
                            acceptance_criteria="Результат сохраняется при обновлении страницы.",
                            level=level,
                            is_required=True,
                            order_number=index,
                        )
                    )
            parent_id = task.id
        await db.commit()


async def main():
    try:
        await seed()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
