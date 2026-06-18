from flask import Blueprint, render_template, redirect, url_for, session, jsonify, request
from app.models import User, Presupuesto
from app.utils.helpers import calcular_dashboard

dashboard_bp = Blueprint('dashboard', __name__)


def _get_user_id():
    """Devuelve el user_id de sesión o None si no está autenticado."""
    return session.get('user_id')


@dashboard_bp.route('/dashboard')
def dashboard():
    user_id = _get_user_id()
    if not user_id:
        return redirect(url_for('auth_bp.login'))

    usuario = User.query.get(user_id)
    if not usuario:
        return redirect(url_for('auth_bp.login'))

    presupuesto_id = request.args.get('presupuesto_id', type=int)
    presupuestos   = Presupuesto.query.filter_by(usuario_id=user_id).all()
    datos          = calcular_dashboard(user_id, presupuesto_id)

    return render_template(
        'dashboard.html',
        usuario=usuario,
        presupuestos=presupuestos,
        **datos,
    )


@dashboard_bp.route('/api/dashboard')
def api_dashboard():
    """
    Endpoint JSON consumido por Alpine.js para refrescar el dashboard
    sin recargar la página al añadir/editar gastos.
    """
    user_id = _get_user_id()
    if not user_id:
        return jsonify({'error': 'no_auth'}), 401

    presupuesto_id = request.args.get('presupuesto_id', type=int)
    datos = calcular_dashboard(user_id, presupuesto_id)

    # El objeto Presupuesto y las transacciones ORM no son JSON-serializables:
    # los reemplazamos por representaciones simples.
    presupuesto = datos['presupuesto']
    transacciones_json = [
        {
            'id':             g.id,
            'descripcion':    g.descripcion,
            'monto':          g.monto,
            'moneda':         g.moneda,
            'fecha':          g.fecha.isoformat(),
            'categoria':      g.categoria.nombre if g.categoria else None,
            'subcategoria':   g.subcategoria.nombre if g.subcategoria else None,
            'es_gasto_unico': g.es_gasto_unico,
            'recurrente':     g.recurrente,
        }
        for g in datos['transacciones']
    ]

    return jsonify({
        'mes_nombre':         datos['mes_nombre'],
        'dias_transcurridos': datos['dias_transcurridos'],
        'dias_totales':       datos['dias_totales'],
        'pct_mes':            datos['pct_mes'],
        'tasa_usd':           datos['tasa_usd'],
        'presupuesto': {
            'id':           presupuesto.id   if presupuesto else None,
            'nombre':       presupuesto.nombre if presupuesto else None,
            'monto_limite': presupuesto.monto_limite if presupuesto else None,
            'moneda_base':  presupuesto.moneda_base  if presupuesto else 'PEN',
        } if presupuesto else None,
        'capa1':        datos['capa1'],
        'capa2':        datos['capa2'],
        'capa3':        datos['capa3'],
        'categorias':   datos['categorias'],
        'transacciones': transacciones_json,
    })
