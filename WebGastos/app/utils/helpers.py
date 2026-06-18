from datetime import date
import calendar
from collections import defaultdict
from sqlalchemy import extract

from app.extensions import db
from app.models import Gasto, Presupuesto, RecurringExpense, Installment

# Tipo de cambio de respaldo — reemplazar con llamada a API en producción
USD_TO_PEN = 3.75


def a_pen(monto, moneda, tasa=USD_TO_PEN):
    """Convierte un monto a PEN usando la tasa dada."""
    return monto * tasa if moneda == 'USD' else float(monto)


def calcular_dashboard(user_id, presupuesto_id=None):
    """
    Devuelve un dict con todos los datos del dashboard para un usuario.

    Estructura de salida:
      presupuesto, hoy, dias_transcurridos, dias_totales, pct_mes, tasa_usd,
      capa1, capa2, capa3, transacciones, categorias
    """
    hoy = date.today()
    year, month = hoy.year, hoy.month
    dias_totales = calendar.monthrange(year, month)[1]
    dias_transcurridos = hoy.day

    # ── Presupuesto activo ────────────────────────────────────────────────────
    filtro_base = {'usuario_id': user_id}
    if presupuesto_id:
        filtro_base['id'] = presupuesto_id
    presupuesto = Presupuesto.query.filter_by(**filtro_base).first()

    # ── Gastos del mes ────────────────────────────────────────────────────────
    q = Gasto.query.filter(
        Gasto.usuario_id == user_id,
        extract('year', Gasto.fecha) == year,
        extract('month', Gasto.fecha) == month,
    )
    if presupuesto:
        q = q.filter(Gasto.presupuesto_id == presupuesto.id)
    gastos_mes = q.order_by(Gasto.fecha.desc()).all()

    # ── CAPA 1: Lo que ya gastaste ────────────────────────────────────────────
    total_pen_real = sum(a_pen(g.monto, g.moneda) for g in gastos_mes)
    total_usd_real = sum(g.monto for g in gastos_mes if g.moneda == 'USD')
    total_pen_solo = sum(g.monto for g in gastos_mes if g.moneda == 'PEN')

    capa1 = {
        'total_pen':      round(total_pen_real, 2),
        'total_pen_solo': round(total_pen_solo, 2),
        'total_usd':      round(total_usd_real, 2),
        'gastos_count':   len(gastos_mes),
    }

    # ── Run-Rate (excluye gastos únicos) ──────────────────────────────────────
    total_corriente_pen = sum(
        a_pen(g.monto, g.moneda) for g in gastos_mes if not g.es_gasto_unico
    )
    total_unico_pen = sum(
        a_pen(g.monto, g.moneda) for g in gastos_mes if g.es_gasto_unico
    )

    if dias_transcurridos > 0:
        run_rate_diario   = total_corriente_pen / dias_transcurridos
        proyectado_fin_mes = run_rate_diario * dias_totales
    else:
        run_rate_diario   = 0.0
        proyectado_fin_mes = 0.0

    # ── CAPA 2: Compromisos fijos ─────────────────────────────────────────────
    inicio_mes = date(year, month, 1)
    fin_mes    = date(year, month, dias_totales)

    recurrentes = RecurringExpense.query.filter_by(user_id=user_id, activo=True).all()
    cuotas_pendientes = Installment.query.filter(
        Installment.user_id == user_id,
        Installment.pagado == False,
        Installment.cuotas_pagadas < Installment.cuotas_totales,
    ).all()

    items_fijos = []
    total_fijos_pen = 0.0

    for r in recurrentes:
        # ¿La próxima fecha cae este mes o ya venció este mes?
        aplica = bool(
            r.siguiente_fecha and inicio_mes <= r.siguiente_fecha <= fin_mes
        )
        # Consideramos aplicado si el siguiente_fecha ya pasó antes de hoy
        aplicado = bool(r.siguiente_fecha and r.siguiente_fecha < hoy)
        monto_pen = a_pen(r.monto, 'PEN')   # RecurringExpense no tiene moneda aún
        items_fijos.append({
            'descripcion':  r.descripcion,
            'monto':        round(r.monto, 2),
            'monto_pen':    round(monto_pen, 2),
            'tipo':         'recurrente',
            'frecuencia':   r.frecuencia,
            'aplica':       aplica,
            'aplicado':     aplicado,
        })
        if aplica:
            total_fijos_pen += monto_pen

    for c in cuotas_pendientes:
        monto_cuota = c.monto_total / c.cuotas_totales
        items_fijos.append({
            'descripcion': c.descripcion,
            'monto':       round(monto_cuota, 2),
            'monto_pen':   round(monto_cuota, 2),
            'tipo':        'cuota',
            'progreso':    f"{c.cuotas_pagadas}/{c.cuotas_totales}",
            'aplica':      True,
            'aplicado':    False,
        })
        total_fijos_pen += monto_cuota

    capa2 = {
        'items':     items_fijos,
        'total_pen': round(total_fijos_pen, 2),
    }

    # ── CAPA 3: Proyección y semáforo ─────────────────────────────────────────
    monto_limite = presupuesto.monto_limite if presupuesto and presupuesto.monto_limite else None

    if monto_limite and monto_limite > 0:
        pct_proyectado = (proyectado_fin_mes / monto_limite) * 100
        dias_restantes = max(dias_totales - dias_transcurridos, 1)
        meta_diaria_ideal = (monto_limite - total_corriente_pen) / dias_restantes

        if pct_proyectado <= 85:
            estado = 'verde'
            ahorro_posible = monto_limite - proyectado_fin_mes
            sobregiro = 0.0
        elif pct_proyectado <= 100:
            estado = 'naranja'
            ahorro_posible = monto_limite - proyectado_fin_mes
            sobregiro = 0.0
        else:
            estado = 'rojo'
            ahorro_posible = 0.0
            sobregiro = proyectado_fin_mes - monto_limite
    else:
        pct_proyectado    = 0.0
        estado            = 'sin_limite'
        ahorro_posible    = 0.0
        sobregiro         = 0.0
        meta_diaria_ideal = run_rate_diario

    capa3 = {
        'proyectado':       round(proyectado_fin_mes, 2),
        'run_rate_diario':  round(run_rate_diario, 2),
        'total_unico_pen':  round(total_unico_pen, 2),
        'pct_proyectado':   round(min(pct_proyectado, 150), 1),  # cap visual en 150%
        'estado':           estado,
        'monto_limite':     monto_limite,
        'ahorro_posible':   round(ahorro_posible, 2),
        'sobregiro':        round(sobregiro, 2),
        'meta_diaria_ideal': round(meta_diaria_ideal, 2),
    }

    # ── Categorías con drill-down ─────────────────────────────────────────────
    cats: dict = defaultdict(lambda: {
        'total_pen':    0.0,
        'subcategorias': defaultdict(float),
        'gastos_count': 0,
    })

    for g in gastos_mes:
        cat_nombre = g.categoria.nombre if g.categoria else 'Sin categoría'
        monto_g = a_pen(g.monto, g.moneda)
        cats[cat_nombre]['total_pen']    += monto_g
        cats[cat_nombre]['gastos_count'] += 1
        subcat = g.subcategoria.nombre if g.subcategoria else 'General'
        cats[cat_nombre]['subcategorias'][subcat] += monto_g

    categorias_lista = []
    for nombre, data in sorted(cats.items(), key=lambda x: x[1]['total_pen'], reverse=True):
        pct_limite = (data['total_pen'] / monto_limite * 100) if monto_limite else 0
        subcats = [
            {'nombre': k, 'total_pen': round(v, 2)}
            for k, v in sorted(data['subcategorias'].items(), key=lambda x: x[1], reverse=True)
        ]
        categorias_lista.append({
            'nombre':       nombre,
            'total_pen':    round(data['total_pen'], 2),
            'gastos_count': data['gastos_count'],
            'pct_limite':   round(pct_limite, 1),
            'subcategorias': subcats,
        })

    # ── Resultado final ───────────────────────────────────────────────────────
    return {
        'presupuesto':        presupuesto,
        'hoy':                hoy,
        'mes_nombre':         hoy.strftime('%B %Y'),
        'dias_transcurridos': dias_transcurridos,
        'dias_totales':       dias_totales,
        'pct_mes':            round((dias_transcurridos / dias_totales) * 100, 1),
        'tasa_usd':           USD_TO_PEN,
        'capa1':              capa1,
        'capa2':              capa2,
        'capa3':              capa3,
        'transacciones':      gastos_mes[:20],
        'categorias':         categorias_lista,
    }
