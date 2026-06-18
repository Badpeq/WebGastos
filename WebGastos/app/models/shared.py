
from app import db


class Categoria(db.Model):
    __tablename__ = 'categorias'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    presupuesto_id = db.Column(db.Integer, db.ForeignKey('presupuestos.id'), nullable=False)

    presupuesto = db.relationship('Presupuesto', back_populates='categorias')
    gastos = db.relationship('Gasto', back_populates='categoria', cascade='all, delete-orphan')
    recurring_expenses = db.relationship('RecurringExpense', back_populates='categoria', cascade='all, delete-orphan')
    subcategorias = db.relationship('Subcategoria', back_populates='categoria', cascade='all, delete-orphan')


class Subcategoria(db.Model):
    __tablename__ = 'subcategorias'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias.id'), nullable=False)

    categoria = db.relationship('Categoria', back_populates='subcategorias')
    gastos = db.relationship('Gasto', back_populates='subcategoria', cascade='all, delete-orphan')
