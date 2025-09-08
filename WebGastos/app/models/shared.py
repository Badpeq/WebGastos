
from app import db
from flask_login import UserMixin

class Categoria(db.Model):
    __tablename__ = 'categorias'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    presupuesto_id = db.Column(db.Integer, db.ForeignKey('presupuestos.id'), nullable=False)

    presupuesto = db.relationship('Presupuesto', back_populates='categorias')
    gastos = db.relationship('Gasto', back_populates='categoria', cascade="all, delete-orphan")
    # En Categoria
    recurring_expenses = db.relationship('RecurringExpense', back_populates='categoria', cascade='all, delete-orphan')
