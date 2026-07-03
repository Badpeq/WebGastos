"""
Capa de Persistencia — trading_guardian.db (SQLite).
Responsabilidad única: leer y escribir datos. Sin lógica de negocio aquí.
"""
import sqlite3
from datetime import date
from pathlib import Path

DB_PATH = Path(__file__).parent / "trading_guardian.db"


# ── Conexión ─────────────────────────────────────────────────────────────────

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row          # acceso por nombre de columna
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# ── Inicialización del esquema ────────────────────────────────────────────────

def init_db() -> None:
    """Crea la tabla trades si no existe (idempotente)."""
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS trades (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha_apertura   TEXT    NOT NULL,
                fecha_cierre     TEXT,
                activo           TEXT    NOT NULL
                                     CHECK(activo IN ('US100','GOLD')),
                direccion        TEXT    NOT NULL
                                     CHECK(direccion IN ('BUY','SELL')),
                precio_entrada   REAL    NOT NULL,
                precio_cierre    REAL,
                stop_loss        REAL    NOT NULL,
                take_profit      REAL,
                gross_pl         REAL,
                emocion_entrada  TEXT
                                     CHECK(emocion_entrada IN ('Calma','FOMO','Ansiedad')),
                estado_posicion  TEXT    NOT NULL DEFAULT 'Abierto'
                                     CHECK(estado_posicion IN ('Profit','Loss','Abierto'))
            )
        """)


# ── Escritura ─────────────────────────────────────────────────────────────────

def insert_trade(
    activo: str,
    direccion: str,
    precio_entrada: float,
    stop_loss: float,
    take_profit: float | None,
    emocion_entrada: str,
    fecha_apertura: str | None = None,
) -> int:
    """Inserta un trade nuevo en estado 'Abierto'. Retorna el id generado."""
    fecha = fecha_apertura or date.today().isoformat()
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO trades
                (fecha_apertura, activo, direccion, precio_entrada,
                 stop_loss, take_profit, emocion_entrada, estado_posicion)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Abierto')
            """,
            (fecha, activo, direccion, precio_entrada,
             stop_loss, take_profit, emocion_entrada),
        )
        return cur.lastrowid


def close_trade(trade_id: int, precio_cierre: float, gross_pl: float) -> None:
    """Cierra un trade: guarda precio de cierre, P&L y calcula estado."""
    estado = "Profit" if gross_pl >= 0 else "Loss"
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE trades
               SET fecha_cierre    = ?,
                   precio_cierre   = ?,
                   gross_pl        = ?,
                   estado_posicion = ?
             WHERE id = ?
            """,
            (date.today().isoformat(), precio_cierre, gross_pl, estado, trade_id),
        )


# ── Lectura ───────────────────────────────────────────────────────────────────

def get_all_trades() -> list[sqlite3.Row]:
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM trades ORDER BY id DESC"
        ).fetchall()


def get_open_trades() -> list[sqlite3.Row]:
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM trades WHERE estado_posicion = 'Abierto' ORDER BY id DESC"
        ).fetchall()


def get_trade_by_id(trade_id: int) -> sqlite3.Row | None:
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM trades WHERE id = ?", (trade_id,)
        ).fetchone()


def get_daily_losses() -> int:
    """Cuenta trades cerrados en Loss durante el día actual."""
    today = date.today().isoformat()
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS cnt
              FROM trades
             WHERE estado_posicion = 'Loss'
               AND date(fecha_cierre) = ?
            """,
            (today,),
        ).fetchone()
        return row["cnt"] if row else 0


def get_daily_stats() -> dict:
    """Estadísticas del día actual para el dashboard de sesión."""
    today = date.today().isoformat()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT estado_posicion, COUNT(*) as cnt, SUM(COALESCE(gross_pl, 0)) as pl
              FROM trades
             WHERE date(fecha_apertura) = ?
             GROUP BY estado_posicion
            """,
            (today,),
        ).fetchall()

    stats = {"Profit": 0, "Loss": 0, "Abierto": 0, "pl_neto": 0.0}
    for r in rows:
        stats[r["estado_posicion"]] = r["cnt"]
        if r["estado_posicion"] != "Abierto":
            stats["pl_neto"] += r["pl"] or 0.0
    return stats
