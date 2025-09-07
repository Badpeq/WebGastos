from app import db
from flask_login import UserMixin

class Gasto(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    descripcion = db.Column(db.String(255))
    monto = db.Column(db.Float)
    fecha = db.Column(db.Date)
    recurrente = db.Column(db.Boolean, default=False)
    cuotas = db.Column(db.Integer, nullable=True)
    pagado = db.Column(db.Boolean, default=True)

    presupuesto_id = db.Column(db.Integer, db.ForeignKey('presupuesto.id'), nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey('categoria.id'), nullable=True)
