from app import db


class Presupuesto(db.Model):
    __tablename__ = 'presupuestos'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100))
    descripcion = db.Column(db.String(255))
    monto_limite = db.Column(db.Float, nullable=True)
    moneda_base = db.Column(db.String(3), nullable=False, default='PEN')
    usuario_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    gastos = db.relationship('Gasto', back_populates='presupuesto', cascade='all, delete-orphan')
    categorias = db.relationship('Categoria', back_populates='presupuesto', cascade='all, delete-orphan')
    installments = db.relationship('Installment', back_populates='presupuesto', cascade='all, delete-orphan')
    recurring_expenses = db.relationship('RecurringExpense', back_populates='presupuesto', cascade='all, delete-orphan')
