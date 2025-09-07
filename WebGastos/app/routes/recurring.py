from flask import Blueprint, jsonify, request
from app.models import RecurringExpense
from app.extensions import db
from flask_login import login_required, current_user
from datetime import datetime

recurring_bp = Blueprint('recurring', __name__, url_prefix='/recurring')

@recurring_bp.route('/')
@login_required
def listar_gastos_recurrentes():
    gastos = RecurringExpense.query.filter_by(usuario_id=current_user.id).all()
    return jsonify([
        {
            "id": g.id,
            "nombre": g.nombre,
            "monto": g.monto,
            "frecuencia": g.frecuencia,
            "inicio": g.inicio.strftime('%Y-%m-%d'),
            "fin": g.fin.strftime('%Y-%m-%d') if g.fin else None,
            "activo": g.activo
        } for g in gastos
    ])

@recurring_bp.route('/crear', methods=['POST'])
@login_required
def crear_gasto_recurrente():
    data = request.get_json()
    nombre = data.get("nombre")
    monto = data.get("monto")
    frecuencia = data.get("frecuencia")  # mensual, anual, etc.
    inicio = datetime.strptime(data.get("inicio"), "%Y-%m-%d")
    fin_str = data.get("fin")
    fin = datetime.strptime(fin_str, "%Y-%m-%d") if fin_str else None

    gasto = RecurringExpense(
        usuario_id=current_user.id,
        nombre=nombre,
        monto=monto,
        frecuencia=frecuencia,
        inicio=inicio,
        fin=fin,
        activo=True
    )
    db.session.add(gasto)
    db.session.commit()
    return jsonify({"mensaje": "Gasto recurrente creado correctamente."}), 201
