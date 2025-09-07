from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.extensions import db
from app.models import Installment, Presupuesto

installment_bp = Blueprint('installment', __name__, url_prefix='/installments')

@installment_bp.route('/')
@login_required
def lista_cuotas():
    cuotas = Installment.query.filter_by(usuario_id=current_user.id).all()
    return render_template('installments/list.html', cuotas=cuotas)

@installment_bp.route('/nueva', methods=['GET', 'POST'])
@login_required
def nueva_cuota():
    presupuestos = Presupuesto.query.filter_by(usuario_id=current_user.id).all()

    if request.method == 'POST':
        descripcion = request.form.get('descripcion')
        monto_total = float(request.form.get('monto_total'))
        cuotas_total = int(request.form.get('cuotas_total'))
        cuota_actual = int(request.form.get('cuota_actual', 1))
        fecha_inicio = request.form.get('fecha_inicio')
        pagado = request.form.get('pagado') == 'on'
        presupuesto_id = request.form.get('presupuesto_id')

        nueva = Installment(
            descripcion=descripcion,
            monto_total=monto_total,
            cuotas_total=cuotas_total,
            cuota_actual=cuota_actual,
            fecha_inicio=fecha_inicio,
            pagado=pagado,
            usuario_id=current_user.id,
            presupuesto_id=presupuesto_id
        )
        db.session.add(nueva)
        db.session.commit()
        flash("Cuota agregada correctamente", "success")
        return redirect(url_for('installment.lista_cuotas'))

    return render_template('installments/nueva.html', presupuestos=presupuestos)

@installment_bp.route('/eliminar/<int:cuota_id>', methods=['POST'])
@login_required
def eliminar_cuota(cuota_id):
    cuota = Installment.query.get_or_404(cuota_id)
    if cuota.usuario_id != current_user.id:
        flash("No tienes permiso para eliminar esta cuota", "danger")
        return redirect(url_for('installment.lista_cuotas'))

    db.session.delete(cuota)
    db.session.commit()
    flash("Cuota eliminada correctamente", "success")
    return redirect(url_for('installment.lista_cuotas'))
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
