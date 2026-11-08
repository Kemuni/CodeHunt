"""Хранить только позиции групп и пунктов, вычислять номера при чтении."""

from collections import defaultdict

import sqlalchemy as sa

from alembic import op

revision = "c95f3d608e20"
down_revision = "b84e2c507d19"
branch_labels = None
depends_on = None

TABLES = (
    (
        "task_complication_link_groups",
        "ck_link_group_order",
        "ix_link_groups_tree",
        ["task_id", "parent_group_id"],
    ),
    (
        "task_complication_links",
        "ck_task_link_order",
        "ix_task_links_composition",
        ["task_id", "level"],
    ),
)
TREE_CONSTRAINTS = "fk_link_group_parent, fk_task_link_group"


def replace_index(table, index, prefix, column):
    op.drop_index(index, table_name=table)
    columns = [*prefix, column]
    if table == "task_complication_links":
        columns.append("id")
    op.create_index(index, table, columns)


def upgrade():
    # Учитываем отложенные FK-проверки предыдущих миграций в той же транзакции.
    op.execute(sa.text(f"SET CONSTRAINTS {TREE_CONSTRAINTS} IMMEDIATE"))
    for table, constraint, index, prefix in TABLES:
        replace_index(table, index, prefix, "position")
        op.drop_constraint(constraint, table, type_="check")
        op.drop_column(table, "order_number")
    op.execute(sa.text(f"SET CONSTRAINTS {TREE_CONSTRAINTS} DEFERRED"))


def downgrade():
    op.execute(sa.text(f"SET CONSTRAINTS {TREE_CONSTRAINTS} IMMEDIATE"))
    for table, constraint, index, prefix in TABLES:
        op.add_column(
            table,
            sa.Column("order_number", sa.Integer(), server_default="1", nullable=False),
        )
        op.create_check_constraint(constraint, table, "order_number >= 1")
        replace_index(table, index, prefix, "order_number")

    connection = op.get_bind()
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

    def walk(task_id, level, parent_id=None, number=1):
        siblings = sorted(
            children[(task_id, level, parent_id)],
            key=lambda entry: (
                entry[1]["position"],
                entry[0] == "link",
                entry[1]["id"],
            ),
        )
        for kind, row in siblings:
            table = groups if kind == "group" else links
            connection.execute(
                table.update()
                .where(table.c.id == row["id"])
                .values(order_number=number)
            )
            number = (
                walk(task_id, level, row["id"], number)
                if kind == "group"
                else number + 1
            )
        return number

    for task_id in tasks:
        for level in ("easy", "medium", "high"):
            walk(task_id, level)
    op.execute(sa.text(f"SET CONSTRAINTS {TREE_CONSTRAINTS} DEFERRED"))
