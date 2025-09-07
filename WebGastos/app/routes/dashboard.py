from flask import Blueprint, render_template, redirect, url_for, session
from app.models import User, Presupuesto, Gasto
from app.extensions import db
from datetime import datetime
from sqlalchemy import extract


dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/dashboard')
def dashboard():
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('auth.login'))

    usuario = User.query.get(user_id)
    if not usuario:
        return redirect(url_for('auth.login'))

    presupuestos = Presupuesto.query.filter_by(usuario_id=user_id).all()

    # Obtener gastos del mes actual
    gastos_totales = db.session.query(db.func.sum(Gasto.monto)).filter(
        Gasto.usuario_id == user_id,
        extract('year', Gasto.fecha) == datetime.now().year,
        extract('month', Gasto.fecha) == datetime.now().month
    ).scalar() or 0

    return render_template('dashboard.html', usuario=usuario, presupuestos=presupuestos, gastos_totales=gastos_totales)
