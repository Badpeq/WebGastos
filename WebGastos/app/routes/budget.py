from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_required, current_user
from app.extensions import db
from app.models import Presupuesto, Categoria, Gasto

budgets_bp = Blueprint('budgets', __name__)


@budgets_bp.route('/presupuesto/nuevo', methods=['POST'])
@login_required
def nuevo_presupuesto():
    nombre = request.form.get('nombre')
    descripcion = request.form.get('descripcion')
    if not nombre:
        flash("El nombre del presupuesto es obligatorio.", "danger")
        return redirect(url_for('dashboard.dashboard'))

    nuevo = Presupuesto(nombre=nombre, descripcion=descripcion, usuario_id=current_user.id)
    db.session.add(nuevo)
    db.session.commit()
    flash("Presupuesto creado exitosamente.", "success")
    return redirect(url_for('dashboard.dashboard'))


@budgets_bp.route('/presupuesto/<int:presupuesto_id>/editar', methods=['GET', 'POST'])
@login_required
def editar_presupuesto(presupuesto_id):
    presupuesto = Presupuesto.query.get_or_404(presupuesto_id)
    if presupuesto.usuario_id != current_user.id:
        flash("No tienes permiso para editar este presupuesto.", "danger")
        return redirect(url_for('dashboard.dashboard'))

    if request.method == 'POST':
        presupuesto.nombre = request.form.get('nombre')
        presupuesto.descripcion = request.form.get('descripcion')
        db.session.commit()
        flash("Presupuesto actualizado.", "success")
        return redirect(url_for('dashboard.dashboard'))

    return render_template('editar_presupuesto.html', presupuesto=presupuesto, usuario=current_user)


@budgets_bp.route('/presupuesto/<int:presupuesto_id>/eliminar', methods=['POST'])
@login_required
def eliminar_presupuesto(presupuesto_id):
    presupuesto = Presupuesto.query.get_or_404(presupuesto_id)
    if presupuesto.usuario_id != current_user.id:
        flash("No tienes permiso para eliminar este presupuesto.", "danger")
        return redirect(url_for('dashboard.dashboard'))

    db.session.delete(presupuesto)
    db.session.commit()
    flash("Presupuesto eliminado exitosamente.", "success")
    return redirect(url_for('dashboard.dashboard'))


@budgets_bp.route('/presupuesto/<int:presupuesto_id>/exportar', methods=['GET'])
@login_required
def exportar_gastos_presupuesto(presupuesto_id):
    # Implementación pendiente: exportar a CSV o Excel
    flash("Funcionalidad de exportación en desarrollo.", "info")
    return redirect(url_for('dashboard.dashboard'))
