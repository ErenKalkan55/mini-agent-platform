"""store tool traces and token usage on messages

Revision ID: 0005_message_traces
Revises: 0004_agent_tools
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_message_traces"
down_revision: Union[str, None] = "0004_agent_tools"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("tool_name", sa.String(length=64), nullable=True))
    op.add_column("messages", sa.Column("extra", sa.JSON(), nullable=True))
    op.add_column("messages", sa.Column("prompt_tokens", sa.Integer(), nullable=True))
    op.add_column("messages", sa.Column("completion_tokens", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "completion_tokens")
    op.drop_column("messages", "prompt_tokens")
    op.drop_column("messages", "extra")
    op.drop_column("messages", "tool_name")
