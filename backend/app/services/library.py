from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TaskComplication, TaskComplicationCategory
from app.models.enums import DeveloperType
from app.schemas.domain import CategoryLibrary, DeveloperLibrary, TemplateRead


async def grouped_templates(
    session: AsyncSession, q: str | None, developer_type: DeveloperType | None
) -> list[DeveloperLibrary]:
    # Два запроса возвращают всё дерево без отдельных обращений за каждой категорией.
    categories = (
        await session.scalars(
            select(TaskComplicationCategory).order_by(TaskComplicationCategory.id)
        )
    ).all()
    query = (
        select(TaskComplication)
        .join(TaskComplicationCategory)
        .order_by(TaskComplication.id)
    )
    if q:
        query = query.where(
            or_(
                TaskComplication.title.icontains(q, autoescape=True),
                TaskComplication.description.icontains(q, autoescape=True),
            )
        )
    if developer_type:
        query = query.where(TaskComplicationCategory.developer_type == developer_type)
    templates = (await session.scalars(query)).all()
    by_id = {category.id: category for category in categories}
    selected = {template.category_id for template in templates}
    if not q:
        selected.update(
            category.id
            for category in categories
            if developer_type is None or category.developer_type == developer_type
        )
    # При поиске сохраняем предков только в пределах того же направления.
    for category_id in list(selected):
        direction = by_id[category_id].developer_type
        parent_id = by_id[category_id].parent_id
        while (
            parent_id is not None
            and parent_id not in selected
            and by_id[parent_id].developer_type == direction
        ):
            selected.add(parent_id)
            parent_id = by_id[parent_id].parent_id
    nodes = {
        category.id: CategoryLibrary.model_validate(category)
        for category in categories
        if category.id in selected
    }
    for template in templates:
        nodes[template.category_id].complications.append(
            TemplateRead.model_validate(template)
        )
    roots: dict[DeveloperType, list[CategoryLibrary]] = {
        direction: [] for direction in DeveloperType
    }
    for node in nodes.values():
        parent = nodes.get(node.parent_id)
        if parent is not None and parent.developer_type == node.developer_type:
            parent.children.append(node)
        else:
            # Родитель другого направления остаётся в своей группе, связь в БД сохраняется.
            roots[node.developer_type].append(node)
    return [
        DeveloperLibrary(developer_type=direction, categories=categories)
        for direction, categories in roots.items()
        if categories
    ]
