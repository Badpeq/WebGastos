
from app import db
from flask_login import UserMixin

class Categoria(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100))
    presupuesto_id = db.Column(db.Integer, db.ForeignKey('presupuesto.id'), nullable=False)
