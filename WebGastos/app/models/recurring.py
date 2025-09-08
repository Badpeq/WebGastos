# app/models/recurring.py
from app.extensions import db
from datetime import date

class RecurringExpense(db.Model):
    __tablename__ = 'recurring_expenses'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    presupuesto_id = db.Column(db.Integer, db.ForeignKey('presupuestos.id'), nullable=True)
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias.id'), nullable=True)

    descripcion = db.Column(db.String(255), nullable=False)
    monto = db.Column(db.Float, nullable=False)
    frecuencia = db.Column(db.String(20), nullable=False)
    fecha_inicio = db.Column(db.Date, default=date.today)
    siguiente_fecha = db.Column(db.Date)

    activo = db.Column(db.Boolean, default=True)

    user = db.relationship('User', back_populates='recurring_expenses')
    presupuesto = db.relationship('Presupuesto', back_populates='recurring_expenses')
    categoria = db.relationship('Categoria', back_populates='recurring_expenses')

    def __repr__(self):
        return f"<RecurringExpense {self.descripcion} cada {self.frecuencia}>"
