"""Явные уровни групп, разделение старых смешанных деревьев и черновиков.

Пустые группы наследуют минимальный уровень требований ближайшей непустой
родительской ветки. В корне используется минимальный пресет задачи, иначе easy.
При downgrade разделённые группы не объединяются: это сохранило бы неоднозначность.
"""

from collections import defaultdict

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "e62b9c43a105"
down_revision = "d53ae017b804"
branch_labels = None
depends_on = None

LEVELS = ("easy", "medium", "high")
GROUPS = "task_complication_link_groups"
LINKS = "task_complication_links"


def first_level(levels, fallback="easy"):
    return next((level for level in LEVELS if level in levels), fallback)


def descendant_levels(items):
    result = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("level") in LEVELS:
            result.add(item["level"])
        if item.get("kind") == "group" and isinstance(item.get("items"), list):
            result.update(descendant_levels(item["items"]))
    return result


def split_legacy_items(items, fallback="easy"):
    """Не теряем поля неполных черновиков; валидные смешанные группы разделяем."""
    result = []
    for item in items:
        if not isinstance(item, dict) or item.get("kind") != "group":
            result.append(item)
            continue
        children = item.get("items", [])
        if not isinstance(children, list):
            result.append({"level": fallback, **item})
            continue
        own_fallback = first_level(descendant_levels(children), fallback)
        branches = defaultdict(list)
        for child in split_legacy_items(children, own_fallback):
            level = child.get("level") if isinstance(child, dict) else None
            branches[level if level in LEVELS else own_fallback].append(child)
        if not branches:
            branches[own_fallback] = []
        for level in LEVELS:
            if level in branches:
                result.append({**item, "level": level, "items": branches[level]})
    return result


def migrate_groups(connection):
    groups = sa.table(
        GROUPS,
        sa.column("id", sa.BigInteger()),
        sa.column("task_id", sa.BigInteger()),
        sa.column("parent_group_id", sa.BigInteger()),
        sa.column("title", sa.String()),
        sa.column("level", sa.String()),
        sa.column("order_number", sa.Integer()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    links = sa.table(
        LINKS,
        sa.column("id"),
        sa.column("task_id"),
        sa.column("group_id"),
        sa.column("level"),
        sa.column("order_number"),
    )
    presets = sa.table("task_level_presets", sa.column("task_id"), sa.column("level"))
    for task_id in connection.scalars(sa.select(groups.c.task_id).distinct()).all():
        originals = {
            row["id"]: dict(row)
            for row in connection.execute(
                sa.select(groups).where(groups.c.task_id == task_id)
            ).mappings()
        }
        children = defaultdict(list)
        for row in originals.values():
            children[row["parent_group_id"]].append({**row, "kind": "group"})
        for row in connection.execute(
            sa.select(links).where(links.c.task_id == task_id)
        ).mappings():
            children[row["group_id"]].append({**row, "kind": "complication"})

        def branch(parent_id, children=children):
            return [
                {**node, "items": branch(node["id"])}
                if node["kind"] == "group"
                else node
                for node in sorted(
                    children[parent_id],
                    key=lambda node: (
                        node["order_number"],
                        node["kind"] == "complication",
                        node["id"],
                    ),
                )
            ]

        fallback = first_level(
            connection.scalars(
                sa.select(presets.c.level).where(presets.c.task_id == task_id)
            ).all()
        )
        tree = split_legacy_items(branch(None), fallback)
        retained = set()

        def save(nodes, parent_id=None, originals=originals, retained=retained):
            for node in nodes:
                if node["kind"] != "group":
                    connection.execute(
                        links.update()
                        .where(links.c.id == node["id"])
                        .values(group_id=parent_id)
                    )
                    continue
                values = {
                    **originals[node["id"]],
                    "level": node["level"],
                    "parent_group_id": parent_id,
                }
                values.pop("id")
                if node["id"] not in retained:
                    group_id = node["id"]
                    retained.add(group_id)
                    connection.execute(
                        groups.update().where(groups.c.id == group_id).values(**values)
                    )
                else:
                    group_id = connection.scalar(
                        groups.insert().values(**values).returning(groups.c.id)
                    )
                save(node["items"], group_id)

        save(tree)
        if retained != originals.keys():
            raise RuntimeError(
                "Обнаружено дерево групп с циклом или недоступным родителем"
            )


def migrate_drafts(connection, *, downgrade=False):
    drafts = sa.table(
        "task_drafts",
        sa.column("id"),
        sa.column("payload", JSONB()),
        sa.column("revision"),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )

    def remove_levels(items):
        result = []
        for item in items:
            if isinstance(item, dict) and item.get("kind") == "group":
                item = {key: value for key, value in item.items() if key != "level"}
                if isinstance(item.get("items"), list):
                    item["items"] = remove_levels(item["items"])
            result.append(item)
        return result

    for row in (
        connection.execute(sa.select(drafts.c.id, drafts.c.payload)).mappings().all()
    ):
        payload = row["payload"]
        if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
            continue
        presets = payload.get("presets", [])
        levels = (
            [preset.get("level") for preset in presets if isinstance(preset, dict)]
            if isinstance(presets, list)
            else []
        )
        items = (
            remove_levels(payload["items"])
            if downgrade
            else split_legacy_items(payload["items"], first_level(levels))
        )
        if items != payload["items"]:
            connection.execute(
                drafts.update()
                .where(drafts.c.id == row["id"])
                .values(
                    payload={**payload, "items": items},
                    revision=drafts.c.revision + 1,
                    updated_at=sa.func.clock_timestamp(),
                )
            )


def create_group_foreign_keys(*, with_level):
    owner = ["task_id", "level"] if with_level else ["task_id"]
    for table, column, name in (
        (GROUPS, "parent_group_id", "fk_link_group_parent"),
        (LINKS, "group_id", "fk_task_link_group"),
    ):
        op.create_foreign_key(
            name,
            table,
            GROUPS,
            [*owner, column],
            [*owner, "id"],
            ondelete="RESTRICT",
            deferrable=True if with_level else None,
            initially="DEFERRED" if with_level else None,
        )


def upgrade() -> None:
    op.add_column(GROUPS, sa.Column("level", sa.String(6), nullable=True))
    connection = op.get_bind()
    # Выполнять при остановленных writers: преобразование структуры и ревизий атомарно.
    op.execute(
        sa.text(f"LOCK TABLE {GROUPS}, {LINKS}, task_drafts IN ACCESS EXCLUSIVE MODE")
    )
    migrate_groups(connection)
    migrate_drafts(connection)
    op.alter_column(GROUPS, "level", existing_type=sa.String(6), nullable=False)
    op.create_check_constraint(
        "task_link_group_level", GROUPS, "level IN ('easy', 'medium', 'high')"
    )
    op.drop_constraint("fk_task_link_group", LINKS, type_="foreignkey")
    op.drop_constraint("fk_link_group_parent", GROUPS, type_="foreignkey")
    op.drop_constraint("uq_link_group_task_id", GROUPS, type_="unique")
    op.create_unique_constraint(
        "uq_link_group_task_level_id", GROUPS, ["task_id", "level", "id"]
    )
    create_group_foreign_keys(with_level=True)


def downgrade() -> None:
    op.drop_constraint("fk_task_link_group", LINKS, type_="foreignkey")
    op.drop_constraint("fk_link_group_parent", GROUPS, type_="foreignkey")
    op.drop_constraint("uq_link_group_task_level_id", GROUPS, type_="unique")
    op.create_unique_constraint("uq_link_group_task_id", GROUPS, ["task_id", "id"])
    create_group_foreign_keys(with_level=False)
    migrate_drafts(op.get_bind(), downgrade=True)
    op.drop_constraint("task_link_group_level", GROUPS, type_="check")
    op.drop_column(GROUPS, "level")
