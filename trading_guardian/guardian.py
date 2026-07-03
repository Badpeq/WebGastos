"""
Capa de Reglas de Negocio.

Contrato de retorno:
  - validar_riesgo()  →  (ok: bool, mensaje: str)
  - evaluar_alertas() →  list[dict]  cada dict: {nivel, titulo, texto}
    nivel: "info" | "warning" | "danger"
"""
from __future__ import annotations

from datetime import datetime

# ── Parámetros de riesgo ──────────────────────────────────────────────────────
MAX_SL_US100_PUNTOS: float = 60.0    # puntos Nasdaq (~$12 con 0.01 lotes)
MAX_SL_GOLD_USD:     float = 15.0    # USD por onza troy

# ── SL por defecto (offset desde precio de entrada) ───────────────────────────
SL_DEFECTO_US100: float = 40.0       # puntos — conservador, dentro del límite
SL_DEFECTO_GOLD:  float = 10.0       # USD/oz — conservador, dentro del límite

# ── Ventana de alta eficiencia ───────────────────────────────────────────────
HORA_INICIO_US100: int = 8    # 08:00 hora local
HORA_FIN_US100:    int = 12   # 12:00 hora local (excluido)

# ── Sesgo estadístico histórico ───────────────────────────────────────────────
DIRECCION_HISTORICA_GANADORA = {"US100": "BUY", "GOLD": "SELL"}


# ── Validación de riesgo ──────────────────────────────────────────────────────

def validar_riesgo(
    activo: str,
    precio_entrada: float,
    stop_loss: float,
) -> tuple[bool, str]:
    """
    Aplica las tres reglas de riesgo duras.
    Retorna (True, msg_ok) o (False, msg_error).
    Si retorna False, la UI debe bloquear el guardado.
    """
    # Regla 1: SL obligatorio
    if not stop_loss or stop_loss == 0.0:
        return (
            False,
            "El Stop Loss no puede ser cero ni estar vacío. "
            "Definir el riesgo máximo es el primer paso de cualquier operación válida. "
            "Sin SL no existe el trade.",
        )

    distancia = abs(precio_entrada - stop_loss)

    # Regla 2: Límite de distancia US100
    if activo == "US100":
        if distancia > MAX_SL_US100_PUNTOS:
            return (
                False,
                f"SL demasiado amplio para US100: {distancia:.1f} puntos. "
                f"El máximo permitido es {MAX_SL_US100_PUNTOS:.0f} puntos "
                f"(~$12.00 de riesgo con 0.01 lotes). "
                "Reduce la distancia al SL o ajusta el tamaño de la posición.",
            )

    # Regla 3: Límite de distancia GOLD
    elif activo == "GOLD":
        if distancia > MAX_SL_GOLD_USD:
            return (
                False,
                f"SL demasiado amplio para GOLD: ${distancia:.2f}/oz. "
                f"El máximo permitido es ${MAX_SL_GOLD_USD:.2f}/oz. "
                "Ajusta el nivel del SL para que el riesgo sea controlado.",
            )

    distancia_label = f"{distancia:.1f} puntos" if activo == "US100" else f"${distancia:.2f}/oz"
    return True, f"Stop Loss válido. Riesgo: {distancia_label}."


# ── Motor de alertas psicológicas ─────────────────────────────────────────────

def evaluar_alertas(
    activo: str,
    direccion: str,
    ahora: datetime | None = None,
) -> list[dict]:
    """
    Evalúa el contexto temporal y estadístico del trade propuesto.
    Retorna una lista de banners ordenados por severidad.
    """
    if ahora is None:
        ahora = datetime.now()

    alertas: list[dict] = []
    hora    = ahora.hour
    weekday = ahora.weekday()   # 0 = Lunes … 4 = Viernes

    # ── 1. Filtro horario US100 ───────────────────────────────────────────────
    if activo == "US100" and not (HORA_INICIO_US100 <= hora < HORA_FIN_US100):
        alertas.append({
            "nivel": "warning",
            "titulo": "FUERA DE VENTANA ÓPTIMA — US100",
            "texto": (
                f"Son las {ahora.strftime('%H:%M')}. Tu ventana de alta eficiencia "
                f"para US100 es 08:00–12:00 (apertura NY). "
                "Fuera de ese bloque, la liquidez cae, los spreads se amplían "
                "y la probabilidad de movimientos erráticos aumenta significativamente. "
                "Estadísticamente, tus mejores resultados se concentran en esa ventana. "
                "¿Tienes una razón técnica sólida para operar ahora?"
            ),
        })

    # ── 2. Sesgo de dirección US100 ───────────────────────────────────────────
    if activo == "US100" and direccion == "SELL":
        alertas.append({
            "nivel": "warning",
            "titulo": "SESGO HISTÓRICO: US100 ES UN ACTIVO ALCISTA",
            "texto": (
                "Estás intentando entrar en SHORT en el US100 (Nasdaq). "
                "Tu registro histórico demuestra que las posiciones de COMPRA (BUY) "
                "son las que sostienen el rendimiento positivo de la cuenta. "
                "Ir en contra de la tendencia estructural alcista de los índices americanos "
                "requiere una confluencia técnica excepcional (rotura de soporte clave, "
                "dato macro negativo, divergencia en volumen). "
                "¿Tienes esa confluencia ahora mismo, o estás operando por sensación?"
            ),
        })

    # ── 3. Sesgo de dirección GOLD ────────────────────────────────────────────
    if activo == "GOLD" and direccion == "BUY":
        alertas.append({
            "nivel": "warning",
            "titulo": "SESGO HISTÓRICO: GOLD — SOLO SELL HA SIDO RENTABLE",
            "texto": (
                "Estás intentando entrar en LONG en GOLD. "
                "En los últimos 3 años de operativa registrada, "
                "ÚNICAMENTE las posiciones de VENTA (SELL) en GOLD "
                "han cerrado con saldo neto positivo acumulado. "
                "Las compras de oro han generado pérdidas recurrentes en tu cuenta. "
                "Esto no implica que el oro no suba — implica que tu sistema "
                "y tu lectura del mercado no captura correctamente los largos en este activo. "
                "¿Estás operando por convicción técnica propia o por narrativa inflacionaria?"
            ),
        })

    # ── 4. Alerta crítica de fin de semana ────────────────────────────────────
    if weekday == 4 and hora >= 11:
        alertas.append({
            "nivel": "danger",
            "titulo": "ALERTA CRÍTICA — ZONA DE OVERTRADING DE FIN DE SEMANA",
            "texto": (
                f"Es viernes {ahora.strftime('%H:%M')}. "
                "Los mercados están a horas del cierre semanal. "
                "La liquidez institucional se retira, los spreads se disparan "
                "y los gaps del lunes pueden invalidar cualquier análisis técnico actual. "
                "Esta es la zona de MAYOR riesgo psicológico de toda la semana: "
                "el impulso de 'recuperar' antes del fin de semana o de 'asegurar' "
                "una ganancia que aún no existe. "
                "Pregúntate: ¿esta operación aparecería en mi plan del domingo por la noche?"
            ),
        })

    return alertas


# ── Utilidades de cálculo ────────────────────────────────────────────────────

def calcular_rr(
    precio_entrada: float,
    stop_loss: float,
    take_profit: float,
) -> float | None:
    """Retorna el Ratio Riesgo:Beneficio redondeado a 2 decimales."""
    riesgo = abs(precio_entrada - stop_loss)
    if riesgo == 0:
        return None
    beneficio = abs(take_profit - precio_entrada)
    return round(beneficio / riesgo, 2)


def clasificar_rr(rr: float | None) -> tuple[str, str]:
    """Retorna (etiqueta, color_streamlit) para el RR dado."""
    if rr is None:
        return "Sin TP", "gray"
    if rr >= 2.0:
        return f"{rr:.2f}:1 — Excelente", "green"
    if rr >= 1.5:
        return f"{rr:.2f}:1 — Aceptable", "orange"
    return f"{rr:.2f}:1 — Bajo riesgo", "red"
