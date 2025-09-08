# app/routes/reports.py

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, Gasto, Categoria
from sqlalchemy.sql import extract, func

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/resumen-mensual', methods=['GET'])
@jwt_required()
def resumen_mensual():
    user_id = get_jwt_identity()

    resultados = (
        db.session.query(
            extract('year', Gasto.fecha).label('anio'),
            extract('month', Gasto.fecha).label('mes'),
            Categoria.nombre.label('categoria'),
            func.sum(Gasto.monto).label('total')
        )
        .join(Categoria, Gasto.categoria_id == Categoria.id)
        .filter(Gasto.user_id == user_id)
        .group_by('anio', 'mes', 'categoria')
        .order_by('anio', 'mes')
        .all()
    )

    data = {}
    for anio, mes, categoria, total in resultados:
        clave = f'{int(anio)}-{int(mes):02}'
        if clave not in data:
            data[clave] = []
        data[clave].append({
            'categoria': categoria,
            'total': float(total)
        })

    return jsonify(data)
