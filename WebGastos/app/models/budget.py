from app import db
from flask_login import UserMixin

class Presupuesto(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100))
    descripcion = db.Column(db.String(255))
    usuario_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    gastos = db.relationship('Gasto', backref='presupuesto', lazy=True)
    categorias = db.relationship('Categoria', backref='presupuesto', lazy=True)
