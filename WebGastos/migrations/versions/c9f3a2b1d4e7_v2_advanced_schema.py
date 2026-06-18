"""v2-advanced: subcategorias, moneda, es_gasto_unico, monto_limite

Revision ID: c9f3a2b1d4e7
Revises: 76683e0b3e81
Create Date: 2026-06-18 00:00:00.000000

Cambios:
- Nueva tabla 'subcategorias' (id, nombre, categoria_id)
- gastos: +moneda (VARCHAR 3, default PEN)
- gastos: +es_gasto_unico (BOOLEAN, default False)
- gastos: +subcategoria_id (FK → subcategorias.id, nullable)
- presupuestos: +monto_limite (FLOAT, nullable)
- presupuestos: +moneda_base (VARCHAR 3, default PEN)
"""
from alembic import op
import sqlalchemy as sa


revision = 'c9f3a2b1d4e7'
down_revision = '76683e0b3e81'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'subcategorias',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('categoria_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    with op.batch_alter_table('gastos', schema=None) as batch_op:
        batch_op.add_column(sa.Column('moneda', sa.String(length=3), nullable=False, server_default='PEN'))
        batch_op.add_column(sa.Column('es_gasto_unico', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('subcategoria_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_gastos_subcategoria_id', 'subcategorias', ['subcategoria_id'], ['id']
        )

    with op.batch_alter_table('presupuestos', schema=None) as batch_op:
        batch_op.add_column(sa.Column('monto_limite', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('moneda_base', sa.String(length=3), nullable=False, server_default='PEN'))


def downgrade():
    with op.batch_alter_table('presupuestos', schema=None) as batch_op:
        batch_op.drop_column('moneda_base')
        batch_op.drop_column('monto_limite')

    with op.batch_alter_table('gastos', schema=None) as batch_op:
        batch_op.drop_constraint('fk_gastos_subcategoria_id', type_='foreignkey')
        batch_op.drop_column('subcategoria_id')
        batch_op.drop_column('es_gasto_unico')
        batch_op.drop_column('moneda')

    op.drop_table('subcategorias')
