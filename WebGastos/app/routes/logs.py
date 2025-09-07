from flask import Blueprint, jsonify, request
from app.models import Log
from app.extensions import db
from flask_login import login_required, current_user
from datetime import datetime

logs_bp = Blueprint('logs', __name__, url_prefix='/logs')

@logs_bp.route('/')
@login_required
def listar_logs():
    logs = Log.query.filter_by(usuario_id=current_user.id).order_by(Log.timestamp.desc()).all()
    return jsonify([{
        "id": log.id,
        "accion": log.accion,
        "detalle": log.detalle,
        "timestamp": log.timestamp.isoformat()
    } for log in logs])

@logs_bp.route('/registrar', methods=['POST'])
@login_required
def registrar_log():
    data = request.get_json()
    accion = data.get("accion")
    detalle = data.get("detalle", "")

    nuevo_log = Log(
        usuario_id=current_user.id,
        accion=accion,
        detalle=detalle,
        timestamp=datetime.utcnow()
    )
    db.session.add(nuevo_log)
    db.session.commit()
    return jsonify({"mensaje": "Log registrado correctamente."}), 201
