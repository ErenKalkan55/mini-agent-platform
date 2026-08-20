"""store selected system tools on agents

Revision ID: 0006_agent_system_tools
Revises: 0005_message_traces
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_agent_system_tools"
down_revision: Union[str, None] = "0005_message_traces"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("system_tools", sa.JSON(), nullable=True))
    op.execute(
        """
        UPDATE agents
        SET system_tools = '["get_current_time", "calculator"]'::json
        WHERE system_tools IS NULL
        """
    )
    op.alter_column("agents", "system_tools", nullable=False)


def downgrade() -> None:
    op.drop_column("agents", "system_tools")
