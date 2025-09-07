from flask import Blueprint, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.extensions import db
from app.models import Presupuesto, Categoria, User

shared_bp = Blueprint('shared', __name__)


@shared_bp.route('/presupuesto/<int:presupuesto_id>/categorias/nueva', methods=['POST'])
@login_required
def agregar_categoria(presupuesto_id):
    nombre = request.form.get('nombre')
    if not nombre:
        flash('El nombre de la categoría es obligatorio.', 'error')
        return redirect(url_for('dashboard.dashboard'))

    presupuesto = Presupuesto.query.filter_by(id=presupuesto_id, usuario_id=current_user.id).first()
    if not presupuesto:
        flash('Presupuesto no encontrado.', 'error')
        return redirect(url_for('dashboard.dashboard'))

    nueva_categoria = Categoria(nombre=nombre, presupuesto_id=presupuesto.id)
    db.session.add(nueva_categoria)
    db.session.commit()
    flash('Categoría agregada con éxito.', 'success')
    return redirect(url_for('dashboard.dashboard'))


@shared_bp.route('/presupuesto/<int:presupuesto_id>/compartir', methods=['POST'])
@login_required
def compartir_presupuesto(presupuesto_id):
    email = request.form.get('email')
    if not email:
        flash('Debes ingresar un correo electrónico.', 'error')
        return redirect(url_for('dashboard.dashboard'))

    presupuesto = Presupuesto.query.filter_by(id=presupuesto_id, usuario_id=current_user.id).first()
    if not presupuesto:
        flash('Presupuesto no encontrado o no tienes acceso.', 'error')
        return redirect(url_for('dashboard.dashboard'))

    usuario_a_compartir = User.query.filter_by(email=email).first()
    if not usuario_a_compartir:
        flash('Usuario con ese correo no existe.', 'error')
        return redirect(url_for('dashboard.dashboard'))

    if usuario_a_compartir in presupuesto.miembros:
        flash('Este usuario ya tiene acceso al presupuesto.', 'info')
    else:
        presupuesto.miembros.append(usuario_a_compartir)
        db.session.commit()
        flash(f"Presupuesto compartido con {email}.", 'success')

    return redirect(url_for('dashboard.dashboard'))
