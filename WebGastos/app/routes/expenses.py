from flask import Blueprint, render_template, request, redirect, url_for, flash
from app.extensions import db
from app.models import Gasto, Presupuesto, Categoria
from flask_login import login_required, current_user
from datetime import datetime

expenses_bp = Blueprint('expenses_bp', __name__, url_prefix='/gasto')

@expenses_bp.route('/nuevo/<int:presupuesto_id>', methods=['POST'])
@login_required
def nuevo_gasto(presupuesto_id):
    presupuesto = Presupuesto.query.get_or_404(presupuesto_id)

    descripcion = request.form.get('descripcion')
    monto = float(request.form.get('monto', 0))
    categoria_id = int(request.form.get('categoria_id'))
    fecha = datetime.strptime(request.form.get('fecha'), '%Y-%m-%d')

    nuevo_gasto = Gasto(
        descripcion=descripcion,
        monto=monto,
        fecha=fecha,
        presupuesto_id=presupuesto.id,
        categoria_id=categoria_id
    )
    db.session.add(nuevo_gasto)
    db.session.commit()

    flash('Gasto agregado correctamente.', 'success')
    return redirect(url_for('dashboard.index'))


@expenses_bp.route('/<int:gasto_id>/eliminar', methods=['POST'])
@login_required
def eliminar_gasto(gasto_id):
    gasto = Gasto.query.get_or_404(gasto_id)

    if gasto.presupuesto.usuario_id != current_user.id:
        flash('No tienes permiso para eliminar este gasto.', 'danger')
        return redirect(url_for('dashboard.index'))

    db.session.delete(gasto)
    db.session.commit()
    flash('Gasto eliminado correctamente.', 'success')
    return redirect(url_for('dashboard.index'))


@expenses_bp.route('/<int:gasto_id>/editar', methods=['GET', 'POST'])
@login_required
def editar_gasto(gasto_id):
    gasto = Gasto.query.get_or_404(gasto_id)

    if gasto.presupuesto.usuario_id != current_user.id:
        flash('No tienes permiso para editar este gasto.', 'danger')
        return redirect(url_for('dashboard.index'))

    if request.method == 'POST':
        gasto.descripcion = request.form['descripcion']
        gasto.monto = float(request.form['monto'])
        gasto.fecha = datetime.strptime(request.form['fecha'], '%Y-%m-%d')
        gasto.categoria_id = int(request.form['categoria_id'])

        db.session.commit()
        flash('Gasto actualizado correctamente.', 'success')
        return redirect(url_for('dashboard.index'))

    categorias = Categoria.query.filter_by(presupuesto_id=gasto.presupuesto_id).all()
    return render_template('editar_gasto.html', gasto=gasto, categorias=categorias)
