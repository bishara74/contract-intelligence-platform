"""add users, organizations, and auth columns to contracts

Revision ID: a1b2c3d4e5f6
Revises: 5a523967f331
Create Date: 2026-03-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5a523967f331'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create organizations table
    op.create_table('organizations',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('clerk_org_id', sa.String(), nullable=False),
        sa.Column('tier', sa.String(), nullable=False, server_default='free'),
        sa.Column('stripe_customer_id', sa.String(), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(), nullable=True),
        sa.Column('max_members', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('clerk_org_id'),
        sa.UniqueConstraint('stripe_customer_id'),
    )

    # Create users table
    op.create_table('users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('clerk_id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('tier', sa.String(), nullable=False, server_default='free'),
        sa.Column('stripe_customer_id', sa.String(), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(), nullable=True),
        sa.Column('organization_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('clerk_id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('stripe_customer_id'),
    )
    op.create_index('ix_users_clerk_id', 'users', ['clerk_id'], unique=True)

    # Add user_id and organization_id to contracts table (nullable so existing rows aren't broken)
    op.add_column('contracts', sa.Column('user_id', sa.Uuid(), nullable=True))
    op.add_column('contracts', sa.Column('organization_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_contracts_user_id', 'contracts', 'users', ['user_id'], ['id'])
    op.create_foreign_key('fk_contracts_organization_id', 'contracts', 'organizations', ['organization_id'], ['id'])
    op.create_index('ix_contracts_user_id', 'contracts', ['user_id'], unique=False)
    op.create_index('ix_contracts_organization_id', 'contracts', ['organization_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_contracts_organization_id', table_name='contracts')
    op.drop_index('ix_contracts_user_id', table_name='contracts')
    op.drop_constraint('fk_contracts_organization_id', 'contracts', type_='foreignkey')
    op.drop_constraint('fk_contracts_user_id', 'contracts', type_='foreignkey')
    op.drop_column('contracts', 'organization_id')
    op.drop_column('contracts', 'user_id')
    op.drop_index('ix_users_clerk_id', table_name='users')
    op.drop_table('users')
    op.drop_table('organizations')
