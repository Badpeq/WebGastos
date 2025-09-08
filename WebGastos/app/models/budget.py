from app import db
from flask_login import UserMixin

class Presupuesto(db.Model):
    __tablename__ = 'presupuestos'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100))
    descripcion = db.Column(db.String(255))
    usuario_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    gastos = db.relationship('Gasto', back_populates='presupuesto', cascade="all, delete-orphan")
    categorias = db.relationship('Categoria', back_populates='presupuesto', cascade="all, delete-orphan")
    # En Presupuesto
    installments = db.relationship('Installment', back_populates='presupuesto', cascade='all, delete-orphan')
    recurring_expenses = db.relationship('RecurringExpense', back_populates='presupuesto', cascade='all, delete-orphan')
