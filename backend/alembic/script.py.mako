"""${message}

Ревизия: ${up_revision}
Предыдущая ревизия: ${down_revision | comma,n}
Дата создания: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# Идентификаторы ревизии для Alembic.
revision: str = ${repr(up_revision)}
down_revision: str | Sequence[str] | None = ${repr(down_revision)}
branch_labels: str | Sequence[str] | None = ${repr(branch_labels)}
depends_on: str | Sequence[str] | None = ${repr(depends_on)}


def upgrade() -> None:
    """Применить изменения схемы."""
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """Откатить изменения схемы."""
    ${downgrades if downgrades else "pass"}
