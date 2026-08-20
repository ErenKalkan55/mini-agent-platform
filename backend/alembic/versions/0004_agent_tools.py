"""create agent_tools

Revision ID: 0004_agent_tools
Revises: 0003_conversations_messages
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_agent_tools"
down_revision: Union[str, None] = "0003_conversations_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_tools",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("method", sa.String(length=8), nullable=False),
        sa.Column("url", sa.String(length=2000), nullable=False),
        sa.Column("argument_schema", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("agent_id", "name", name="uq_agent_tools_agent_id_name"),
    )
    op.create_index("ix_agent_tools_tenant_id", "agent_tools", ["tenant_id"])
    op.create_index("ix_agent_tools_agent_id", "agent_tools", ["agent_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_tools_agent_id", table_name="agent_tools")
    op.drop_index("ix_agent_tools_tenant_id", table_name="agent_tools")
    op.drop_table("agent_tools")
