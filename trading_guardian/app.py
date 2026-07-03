"""
Trading Guardian — Capa de Presentación (Streamlit).

Fuente de precios: Yahoo Finance — NQ=F (US100) | GC=F (GOLD)
Ejecutar: streamlit run app.py
"""
import time
import streamlit as st
import pandas as pd
import streamlit.components.v1 as components
from datetime import datetime

import database as db
import guardian  as grd
import monitor   as mon


# ── Helpers internos ──────────────────────────────────────────────────────────

def _sl_defecto(activo: str, direccion: str, precio: float) -> float:
    if precio <= 0:
        return 0.0
    offset = grd.SL_DEFECTO_US100 if activo == "US100" else grd.SL_DEFECTO_GOLD
    sl = precio - offset if direccion == "BUY" else precio + offset
    return max(round(sl, 2), 0.0)


_TV_SYMBOLS: dict[str, str] = {
    "US100": "PEPPERSTONE:NAS100",  # CFD Nasdaq 100 — mismo precio que US100 de XTB
    "GOLD":  "OANDA:XAUUSD",        # Gold spot USD — mismo subyacente que GOLD de XTB
}


def _tradingview_widget(symbol: str, height: int = 660) -> None:
    html = f"""
    <div id="tradingview_chart"
         style="height:{height}px;width:100%;border-radius:6px;overflow:hidden;">
    </div>
    <script src="https://s3.tradingview.com/tv.js"></script>
    <script>
    new TradingView.widget({{
        "container_id":      "tradingview_chart",
        "autosize":          true,
        "symbol":            "{symbol}",
        "interval":          "15",
        "timezone":          "Etc/UTC",
        "theme":             "dark",
        "style":             "1",
        "locale":            "es",
        "toolbar_bg":        "#f1f3f6",
        "enable_publishing": false,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "details":           true,
        "hotlist":           true,
        "calendar":          true
    }});
    </script>
    """
    components.html(html, height=height)

# ═════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN GLOBAL
# ═════════════════════════════════════════════════════════════════════════════
db.init_db()

st.set_page_config(
    page_title="Trading Guardian",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

_DEFAULTS = {
    "modo_demo":        not mon.yf_disponible(),
    "monitoreo_activo": False,
}
for _k, _v in _DEFAULTS.items():
    if _k not in st.session_state:
        st.session_state[_k] = _v


# ═════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ═════════════════════════════════════════════════════════════════════════════
with st.sidebar:
    st.title("🛡️ Trading Guardian")
    st.caption("Disciplina — Riesgo — Break-Even")
    st.divider()

    # ── Fuente de precios ─────────────────────────────────────────────────────
    st.subheader("📡 Fuente de Datos")

    if mon.yf_disponible():
        modo = st.radio(
            "Modo",
            ["🔴 Yahoo Finance (real)", "🟡 Demo (simulado)"],
            key="radio_modo",
        )
        st.session_state.modo_demo = "Demo" in modo

        if not st.session_state.modo_demo:
            st.success("Yahoo Finance activo", icon="📈")
            st.caption(
                "**US100** → `NQ=F` Nasdaq 100 Futures\n\n"
                "**GOLD** → `GC=F` Gold Futures $/oz\n\n"
                f"Caché: {mon.CACHE_SEG}s | Latencia: ~1-5s"
            )
        else:
            st.info("Modo DEMO — precios simulados", icon="🟡")
    else:
        st.error("yfinance no instalado.\n\n`pip install yfinance`")
        st.session_state.modo_demo = True

    st.divider()

    # ── Estadísticas de sesión ────────────────────────────────────────────────
    st.subheader("📊 Sesión de hoy")
    stats = db.get_daily_stats()
    c1, c2 = st.columns(2)
    c1.metric("Profits", stats["Profit"])
    c2.metric("Losses",  stats["Loss"])
    st.metric("P&L Neto", f"${stats['pl_neto']:+.2f}")
    st.metric("Posiciones abiertas", stats["Abierto"])


# ═════════════════════════════════════════════════════════════════════════════
# PESTAÑAS
# ═════════════════════════════════════════════════════════════════════════════
tab_registro, tab_monitor, tab_historial = st.tabs(
    ["📋 Registrar Operación", "📡 Monitoreo en Vivo", "📂 Historial"]
)


# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 — REGISTRAR OPERACIÓN
# ══════════════════════════════════════════════════════════════════════════════
with tab_registro:

    daily_losses = db.get_daily_losses()

    if daily_losses >= 2:
        st.error(
            f"### 🔒 FORMULARIO BLOQUEADO\n\n"
            f"Acumulas **{daily_losses} pérdidas** hoy.\n\n"
            "La regla de 2 pérdidas diarias es el cortafuegos contra el "
            "trading de venganza.\n\n**Cierra xStation. Revisa tu plan. Vuelve mañana.**"
        )
    else:
        if daily_losses == 1:
            st.warning(
                "⚠️ Llevas **1 pérdida** hoy. "
                "Una más bloqueará la sesión completa."
            )

        # ── Layout: formulario izquierda | gráfico TradingView derecha ────────
        form_col, chart_col = st.columns([5, 8], gap="medium")

        with form_col:
            st.subheader("Nueva Operación")

            activo    = st.selectbox("Activo", ["US100", "GOLD"])
            direccion = st.selectbox("Dirección", ["BUY", "SELL"])
            emocion   = st.selectbox(
                "Emoción de entrada",
                ["Calma", "FOMO", "Ansiedad"],
                help="Se registra para el análisis estadístico del historial.",
            )

            precio_ref = None
            if not st.session_state.modo_demo:
                precio_ref = mon.obtener_precio_en_vivo(activo, modo_demo=False)
                if precio_ref:
                    ticker = mon.SIMBOLOS_YF.get(activo, "?")
                    st.caption(f"📡 Precio actual ({ticker}): **{precio_ref:.2f}**")
                else:
                    st.caption("⚠️ Sin precio — mercado cerrado o timeout")

            precio_entrada = st.number_input(
                "Precio de Entrada",
                min_value=0.0,
                value=float(precio_ref) if precio_ref else 0.0,
                step=0.01, format="%.2f",
            )

            _sl_key = f"sl_{activo}_{direccion}"
            _sl_val = _sl_defecto(activo, direccion, precio_entrada or precio_ref or 0.0)
            if _sl_key not in st.session_state or st.session_state[_sl_key] == 0.0:
                st.session_state[_sl_key] = _sl_val

            stop_loss = st.number_input(
                "Stop Loss",
                min_value=0.0,
                step=0.01,
                format="%.2f",
                key=_sl_key,
                help=f"Por defecto: {_sl_val:.2f} ({grd.SL_DEFECTO_US100 if activo == 'US100' else grd.SL_DEFECTO_GOLD} pts desde entrada)",
            )
            take_profit = st.number_input(
                "Take Profit (opcional)", min_value=0.0, step=0.01, format="%.2f",
            )

            # ── Banners psicológicos ──────────────────────────────────────────
            for a in grd.evaluar_alertas(activo, direccion):
                if a["nivel"] == "danger":
                    st.error(f"**{a['titulo']}**\n\n{a['texto']}", icon="🚨")
                else:
                    st.warning(f"**{a['titulo']}**\n\n{a['texto']}", icon="⚠️")

            # ── Preview R:R ───────────────────────────────────────────────────
            if precio_entrada > 0 and stop_loss > 0 and take_profit > 0:
                rr = grd.calcular_rr(precio_entrada, stop_loss, take_profit)
                etiq, color = grd.clasificar_rr(rr)
                st.markdown(f"**Ratio R:R:** :{color}[{etiq}]")

            st.divider()

            if st.button("Registrar Trade", type="primary", use_container_width=True):
                tp_val = take_profit if take_profit > 0 else None
                ok_sl, msg_sl = grd.validar_riesgo(activo, precio_entrada, stop_loss)
                if not ok_sl:
                    st.error(f"🚫 {msg_sl}")
                else:
                    if tp_val is None:
                        st.warning("Sin Take Profit. Asegúrate de tener un objetivo definido.")
                    trade_id = db.insert_trade(
                        activo=activo, direccion=direccion,
                        precio_entrada=precio_entrada, stop_loss=stop_loss,
                        take_profit=tp_val, emocion_entrada=emocion,
                    )
                    mon.reset_precio_demo(activo, precio_entrada)
                    st.success(
                        f"✅ Trade #{trade_id} registrado: "
                        f"{activo} {direccion} @ {precio_entrada:.2f}. "
                        "Ve a **Monitoreo en Vivo**.",
                    )

        with chart_col:
            _tradingview_widget(_TV_SYMBOLS.get(activo, "NASDAQ:US100"))


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — MONITOREO EN VIVO
# ══════════════════════════════════════════════════════════════════════════════
with tab_monitor:

    open_trades = db.get_open_trades()
    mon_col, chart_col = st.columns([5, 7], gap="medium")

    # ── Columna izquierda: feed de precios y métricas ─────────────────────────
    with mon_col:
        col_b1, col_b2, col_info = st.columns([2, 2, 6])
        with col_b1:
            if st.button(
                "▶ Iniciar Feed",
                disabled=st.session_state.monitoreo_activo or len(open_trades) == 0,
                use_container_width=True, type="primary",
            ):
                st.session_state.monitoreo_activo = True
                st.rerun()
        with col_b2:
            if st.button(
                "⏹ Detener",
                disabled=not st.session_state.monitoreo_activo,
                use_container_width=True,
            ):
                st.session_state.monitoreo_activo = False
                st.rerun()
        with col_info:
            if st.session_state.monitoreo_activo:
                fuente = "Yahoo Finance (NQ=F/GC=F)" if not st.session_state.modo_demo else "DEMO simulado"
                st.info(f"Feed activo — refrescando cada {mon.CACHE_SEG}s | {fuente}", icon="📡")
            elif not open_trades:
                st.info("Sin posiciones abiertas. Registra un trade primero.", icon="📭")
            else:
                st.info("Feed detenido. Pulsa ▶ para iniciar.", icon="⏸️")

        st.divider()

        if not open_trades:
            st.session_state.monitoreo_activo = False

        elif st.session_state.monitoreo_activo:
            feed = st.empty()

            with feed.container():
                st.caption(f"Última actualización: {datetime.now().strftime('%H:%M:%S')}")

                for row in open_trades:
                    trade = dict(row)
                    precio_actual = mon.obtener_precio_en_vivo(
                        trade["activo"], modo_demo=st.session_state.modo_demo
                    )

                    if precio_actual is None:
                        st.warning(
                            f"Sin precio para **{trade['activo']}** — mercado cerrado o timeout.",
                            icon="⚠️",
                        )
                        continue

                    ev = mon.evaluar_break_even(
                        activo=trade["activo"], direccion=trade["direccion"],
                        precio_entrada=trade["precio_entrada"],
                        precio_actual=precio_actual, stop_loss=trade["stop_loss"],
                    )

                    if ev["be_activo"]:
                        st.error(
                            f"## 🔔 ¡RATIO {ev['ratio']:.2f}:1 ALCANZADO!\n\n"
                            f"**Mueve el SL al precio de entrada "
                            f"({ev['precio_be']:.2f}) para asegurar Break-Even AHORA.**\n\n"
                            f"PnL actual: **{ev['pnl']:+.2f} pts/USD**  |  "
                            f"Umbral: {ev['umbral_pts']:.0f} pts/USD",
                            icon="🚨",
                        )
                    else:
                        st.info(ev["mensaje"], icon="📊")

                    c1, c2, c3, c4, c5 = st.columns(5)
                    c1.metric("Trade", f"#{trade['id']}", delta=f"{trade['activo']} {trade['direccion']}")
                    c2.metric("Entrada",     f"{trade['precio_entrada']:.2f}")
                    c3.metric("Precio Vivo", f"{precio_actual:.2f}")
                    c4.metric("PnL", f"{ev['pnl']:+.2f}", delta=f"Ratio {ev['ratio']:.2f}:1", delta_color="normal")
                    c5.metric("SL", f"{trade['stop_loss']:.2f}")

                    with st.expander(f"Cerrar Trade #{trade['id']} manualmente"):
                        with st.form(key=f"cierre_{trade['id']}"):
                            fc1, fc2 = st.columns(2)
                            pc_in = fc1.number_input(
                                "Precio de Cierre", min_value=0.0,
                                value=float(precio_actual), step=0.01, format="%.2f",
                            )
                            pl_in = fc2.number_input("Gross P&L ($)", step=0.01, format="%.2f")
                            if st.form_submit_button("Confirmar Cierre"):
                                db.close_trade(trade["id"], pc_in, pl_in)
                                st.session_state.monitoreo_activo = False
                                st.rerun()

                    st.divider()

            time.sleep(1)
            st.rerun()

        else:
            for row in open_trades:
                t = dict(row)
                st.info(
                    f"**Trade #{t['id']}** — {t['activo']} {t['direccion']} "
                    f"@ {t['precio_entrada']:.2f}  |  SL: {t['stop_loss']:.2f}  |  "
                    f"TP: {t['take_profit'] or '—'}"
                )

    # ── Columna derecha: gráfico TradingView ──────────────────────────────────
    with chart_col:
        _activos_mon = [dict(r)["activo"] for r in open_trades]
        _default_mon = _activos_mon[0] if _activos_mon else "US100"
        chart_activo_mon = st.radio(
            "Activo",
            ["US100", "GOLD"],
            index=0 if _default_mon == "US100" else 1,
            horizontal=True,
            key="chart_activo_mon",
            label_visibility="collapsed",
        )
        _tradingview_widget(_TV_SYMBOLS.get(chart_activo_mon, "PEPPERSTONE:NAS100"))


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — HISTORIAL
# ══════════════════════════════════════════════════════════════════════════════
with tab_historial:
    st.subheader("Historial de Operaciones")
    all_trades = db.get_all_trades()

    if not all_trades:
        st.info("Sin operaciones registradas aún.", icon="📭")
    else:
        df       = pd.DataFrame([dict(r) for r in all_trades])
        cerrados = df[df["estado_posicion"] != "Abierto"]
        total    = len(cerrados)
        wins     = int((cerrados["estado_posicion"] == "Profit").sum())
        losses   = int((cerrados["estado_posicion"] == "Loss").sum())
        winrate  = wins / total * 100 if total > 0 else 0.0
        pnl_neto = float(cerrados["gross_pl"].sum()) if not cerrados.empty else 0.0

        pf_val = "∞"
        if not cerrados.empty:
            ganado  = cerrados.loc[cerrados["estado_posicion"] == "Profit", "gross_pl"].sum()
            perdido = abs(cerrados.loc[cerrados["estado_posicion"] == "Loss",   "gross_pl"].sum())
            if perdido > 0:
                pf_val = f"{ganado / perdido:.2f}"

        k1, k2, k3, k4, k5 = st.columns(5)
        k1.metric("Trades cerrados", total)
        k2.metric("Win Rate",        f"{winrate:.1f}%")
        k3.metric("Profit / Loss",   f"{wins} / {losses}")
        k4.metric("P&L Neto",        f"${pnl_neto:+.2f}")
        k5.metric("Profit Factor",   pf_val)

        st.divider()

        col_order = [
            "id", "fecha_apertura", "fecha_cierre", "activo", "direccion",
            "precio_entrada", "precio_cierre", "stop_loss", "take_profit",
            "gross_pl", "emocion_entrada", "estado_posicion",
        ]
        df_t = df[[c for c in col_order if c in df.columns]].copy()

        def _color(row: pd.Series) -> list[str]:
            e = row.get("estado_posicion", "")
            if e == "Profit": return ["background-color:#1a4731;color:#d4edda"] * len(row)
            if e == "Loss":   return ["background-color:#4a1a1a;color:#f5c6cb"] * len(row)
            return [""] * len(row)

        st.dataframe(df_t.style.apply(_color, axis=1), use_container_width=True, hide_index=True)

        if not cerrados.empty and "emocion_entrada" in cerrados.columns:
            st.subheader("Emociones de Entrada vs Resultado")
            emo_pivot = (
                cerrados
                .groupby(["emocion_entrada", "estado_posicion"])
                .size().reset_index(name="count")
                .pivot(index="emocion_entrada", columns="estado_posicion", values="count")
                .fillna(0)
            )
            st.bar_chart(emo_pivot)

        if not cerrados.empty:
            st.subheader("P&L Neto por Activo")
            st.bar_chart(cerrados.groupby("activo")["gross_pl"].sum().rename("P&L Neto ($)"))
