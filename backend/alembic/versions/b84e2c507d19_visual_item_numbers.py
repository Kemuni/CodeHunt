"""Сохранять номера пунктов каждого уровня отдельно от позиции среди соседей."""

from collections import defaultdict

import sqlalchemy as sa

from alembic import op

revision = "b84e2c507d19"
down_revision = "a73f8d291b06"
branch_labels = None
depends_on = None

TABLES = (
    ("task_complication_link_groups", "ck_link_group_position"),
    ("task_complication_links", "ck_task_link_position"),
)
TREE_CONSTRAINTS = "fk_link_group_parent, fk_task_link_group"


def upgrade():
    connection = op.get_bind()
    # Выполняем накопленные FK-проверки до DDL и не откладываем новые после UPDATE.
    # Меняем режим только связей дерева, сохраняя атомарность всей миграции.
    op.execute(sa.text(f"SET CONSTRAINTS {TREE_CONSTRAINTS} IMMEDIATE"))
    for name, constraint in TABLES:
        op.add_column(
            name,
            sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        )
        table = sa.table(name, sa.column("position"), sa.column("order_number"))
        connection.execute(table.update().values(position=table.c.order_number))
        op.create_check_constraint(constraint, name, "position >= 0")
    metadata = sa.MetaData()
    groups = sa.Table(TABLES[0][0], metadata, autoload_with=connection)
    links = sa.Table(TABLES[1][0], metadata, autoload_with=connection)
    children = defaultdict(list)
    tasks = set()
    for kind, table, parent in (
        ("group", groups, "parent_group_id"),
        ("link", links, "group_id"),
    ):
        for row in connection.execute(sa.select(table)).mappings():
            tasks.add(row["task_id"])
            children[(row["task_id"], row["level"], row[parent])].append((kind, row))
    for task_id in tasks:
        number = 1

        def walk(level, parent_id=None, task_id=task_id):
            nonlocal number
            siblings = sorted(
                children[(task_id, level, parent_id)],
                key=lambda entry: (
                    entry[1]["position"],
                    entry[0] == "link",
                    entry[1]["id"],
                ),
            )
            for position, (kind, row) in enumerate(siblings):
                table = groups if kind == "group" else links
                connection.execute(
                    table.update()
                    .where(table.c.id == row["id"])
                    .values(
                        position=position,
                        order_number=number,
                    )
                )
                if kind == "group":
                    walk(level, row["id"])
                else:
                    number += 1

        for level in ("easy", "medium", "high"):
            number = 1
            walk(level)

    for name, _constraint in TABLES:
        order_constraint = (
            "ck_link_group_order" if "groups" in name else "ck_task_link_order"
        )
        op.drop_constraint(order_constraint, name, type_="check")
        op.create_check_constraint(order_constraint, name, "order_number >= 1")
        op.alter_column(name, "order_number", server_default="1")
    op.execute(sa.text(f"SET CONSTRAINTS {TREE_CONSTRAINTS} DEFERRED"))


def downgrade():
    op.execute(sa.text(f"SET CONSTRAINTS {TREE_CONSTRAINTS} IMMEDIATE"))
    for name, constraint in TABLES:
        order_constraint = (
            "ck_link_group_order" if "groups" in name else "ck_task_link_order"
        )
        op.drop_constraint(order_constraint, name, type_="check")
        op.create_check_constraint(order_constraint, name, "order_number >= 0")
        op.alter_column(name, "order_number", server_default="0")
        table = sa.table(name, sa.column("position"), sa.column("order_number"))
        op.get_bind().execute(table.update().values(order_number=table.c.position))
        op.drop_constraint(constraint, name, type_="check")
        op.drop_column(name, "position")
    op.execute(sa.text(f"SET CONSTRAINTS {TREE_CONSTRAINTS} DEFERRED"))
