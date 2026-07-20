"""add version column to documents

Revision ID: 01c108faba9e
Revises: 0a17d2e661fd
Create Date: 2026-03-23 10:49:23.522684

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '01c108faba9e'
down_revision: Union[str, Sequence[str], None] = '0a17d2e661fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add version column to documents table only
    op.add_column('documents', sa.Column('version', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Drop version column from documents table
    op.drop_column('documents', 'version')
