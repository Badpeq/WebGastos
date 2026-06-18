from app import db


class Gasto(db.Model):
    __tablename__ = 'gastos'

    id = db.Column(db.Integer, primary_key=True)
    descripcion = db.Column(db.String(255))
    monto = db.Column(db.Float)
    moneda = db.Column(db.String(3), nullable=False, default='PEN')
    fecha = db.Column(db.Date)
    recurrente = db.Column(db.Boolean, default=False)
    cuotas = db.Column(db.Integer, nullable=True)
    pagado = db.Column(db.Boolean, default=True)
    es_gasto_unico = db.Column(db.Boolean, nullable=False, default=False)

    usuario_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    presupuesto_id = db.Column(db.Integer, db.ForeignKey('presupuestos.id'), nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias.id'), nullable=True)
    subcategoria_id = db.Column(db.Integer, db.ForeignKey('subcategorias.id'), nullable=True)

    presupuesto = db.relationship('Presupuesto', back_populates='gastos')
    categoria = db.relationship('Categoria', back_populates='gastos')
    subcategoria = db.relationship('Subcategoria', back_populates='gastos')
    usuario = db.relationship('User', backref='gastos', lazy=True)
