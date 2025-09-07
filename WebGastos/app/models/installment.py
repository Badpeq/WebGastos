from app.extensions import db
from datetime import date

class Installment(db.Model):
    __tablename__ = 'installments'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    presupuesto_id = db.Column(db.Integer, db.ForeignKey('presupuestos.id'), nullable=False)
    descripcion = db.Column(db.String(255), nullable=False)
    monto_total = db.Column(db.Float, nullable=False)
    cuotas_totales = db.Column(db.Integer, nullable=False)
    cuotas_pagadas = db.Column(db.Integer, default=0)
    fecha_inicio = db.Column(db.Date, nullable=False, default=date.today)
    frecuencia = db.Column(db.String(20), nullable=False, default='mensual')  # mensual o anual
    pagado = db.Column(db.Boolean, default=False)

    # Relaciones
    user = db.relationship('User', backref='installments', lazy=True)
    presupuesto = db.relationship('Presupuesto', backref='installments', lazy=True)

    def cuotas_pendientes(self):
        return max(self.cuotas_totales - self.cuotas_pagadas, 0)

    def esta_pagado(self):
        return self.pagado or self.cuotas_pagadas >= self.cuotas_totales
