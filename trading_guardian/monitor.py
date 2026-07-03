"""
Capa de Datos en Tiempo Real — Yahoo Finance (yfinance).

Fuente de precios:
  US100  →  NQ=F  (Nasdaq 100 Futures)  — mismo subyacente que el CFD de XTB
  GOLD   →  GC=F  (Gold Futures $/oz)   — mismo subyacente que el CFD de XTB

Sin autenticación. Funciona desde cualquier IP.
Latencia: ~1-5 segundos en sesión de mercado activa.
Caché interna de CACHE_SEG segundos para no saturar la API de Yahoo.
"""
from __future__ import annotations

import random
import time as _time

import pandas as pd

try:
    import yfinance as yf
    _YF_DISPONIBLE = True
except ImportError:
    yf = None
    _YF_DISPONIBLE = False

# ── Mapa activo interno → ticker Yahoo Finance ────────────────────────────────
SIMBOLOS_YF: dict[str, str] = {
    "US100": "NQ=F",
    "GOLD":  "GC=F",
}

# ── Umbrales de Break-Even ────────────────────────────────────────────────────
BE_RATIO:     float = 1.5
BE_US100_PTS: float = 75.0
BE_GOLD_USD:  float = 18.0

# ── Caché de precios ──────────────────────────────────────────────────────────
CACHE_SEG:      int = 3
CACHE_VELAS_SEG: int = 60          # refrescar gráfico cada 60s
_cache_precio:    dict[str, float] = {}
_cache_timestamp: dict[str, float] = {}
_cache_velas:    dict[str, pd.DataFrame] = {}
_cache_velas_ts: dict[str, float] = {}

# ── Simulador DEMO (random walk) ──────────────────────────────────────────────
_precios_demo: dict[str, float] = {"US100": 19_800.0, "GOLD": 2_320.0}
_volatilidad:  dict[str, float] = {"US100": 3.0,       "GOLD": 0.40}


# ═════════════════════════════════════════════════════════════════════════════
# API pública
# ═════════════════════════════════════════════════════════════════════════════

def yf_disponible() -> bool:
    return _YF_DISPONIBLE


def obtener_precio_en_vivo(activo: str, modo_demo: bool = False) -> float | None:
    if modo_demo or not _YF_DISPONIBLE:
        return _precio_simulado(activo)
    return _precio_yf(activo)


def evaluar_break_even(
    activo: str,
    direccion: str,
    precio_entrada: float,
    precio_actual: float,
    stop_loss: float,
) -> dict:
    signo = 1 if direccion == "BUY" else -1
    pnl   = signo * (precio_actual - precio_entrada)

    riesgo = abs(precio_entrada - stop_loss)
    ratio  = round(pnl / riesgo, 2) if riesgo > 0 else 0.0

    umbral        = BE_US100_PTS if activo == "US100" else BE_GOLD_USD
    be_por_ratio  = ratio >= BE_RATIO
    be_por_umbral = pnl   >= umbral
    be_activo     = be_por_ratio or be_por_umbral

    if be_activo:
        razon   = f"Ratio {ratio:.2f}:1" if be_por_ratio else f"{pnl:+.2f} pts/USD"
        mensaje = (
            f"¡RATIO {ratio:.2f}:1 ALCANZADO! ({razon}) — "
            f"Mueve el SL al precio de entrada ({precio_entrada}) "
            f"para asegurar Break-Even AHORA."
        )
    else:
        falta_ratio = max(BE_RATIO - ratio, 0)
        falta_pts   = max(umbral - pnl, 0)
        mensaje = (
            f"Seguimiento activo. "
            f"PnL: {pnl:+.2f} pts/USD | Ratio: {ratio:.2f}:1 | "
            f"Faltan {falta_ratio:.2f} de ratio o {falta_pts:.2f} pts/USD para BE."
        )

    return {
        "pnl":        round(pnl, 2),
        "ratio":      ratio,
        "be_activo":  be_activo,
        "umbral_pts": umbral,
        "precio_be":  precio_entrada,
        "mensaje":    mensaje,
    }


def reset_precio_demo(activo: str, precio: float) -> None:
    _precios_demo[activo] = precio


def obtener_velas(activo: str, intervalo: str = "1h", n: int = 200) -> pd.DataFrame | None:
    """OHLCV histórico para el activo. intervalo: '1h' | '15m'."""
    if not _YF_DISPONIBLE:
        return None
    key = f"{activo}_{intervalo}"
    ahora = _time.time()
    if key in _cache_velas and ahora - _cache_velas_ts.get(key, 0) < CACHE_VELAS_SEG:
        return _cache_velas[key]
    ticker = SIMBOLOS_YF.get(activo)
    if not ticker:
        return None
    try:
        periodo = "60d" if intervalo == "1h" else "10d"
        df = yf.Ticker(ticker).history(period=periodo, interval=intervalo)
        if df.empty:
            return None
        df = df.tail(n)[["Open", "High", "Low", "Close", "Volume"]].copy()
        if df.index.tz is not None:
            df.index = df.index.tz_convert("America/Lima")
        _cache_velas[key] = df
        _cache_velas_ts[key] = ahora
        return df
    except Exception:
        return None


# ═════════════════════════════════════════════════════════════════════════════
# Internos
# ═════════════════════════════════════════════════════════════════════════════

def _precio_yf(activo: str) -> float | None:
    ahora  = _time.time()
    ultimo = _cache_timestamp.get(activo, 0.0)

    if ahora - ultimo < CACHE_SEG and activo in _cache_precio:
        return _cache_precio[activo]

    ticker = SIMBOLOS_YF.get(activo)
    if not ticker:
        return None

    try:
        precio = yf.Ticker(ticker).fast_info.last_price
        if precio and float(precio) > 0:
            _cache_precio[activo]    = float(precio)
            _cache_timestamp[activo] = ahora
            return float(precio)
    except Exception:
        pass

    return _cache_precio.get(activo)


def _precio_simulado(activo: str) -> float:
    vol  = _volatilidad.get(activo, 1.0)
    base = _precios_demo.get(activo, 100.0)
    _precios_demo[activo] = max(base + random.gauss(0, vol), 1.0)
    return round(_precios_demo[activo], 2)
