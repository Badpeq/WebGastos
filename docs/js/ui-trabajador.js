import { fmtPeriodo, fmtS, iniciales } from './calculos.js';
import { deserializarPayload } from './share.js';

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function init(payload) {
  const data = deserializarPayload(payload);
  if (!data) {
    renderError('No se pudo leer la boleta. El link puede estar dañado o haber expirado.');
    return;
  }
  renderVista(data);
}

function renderError(msg) {
  const el = document.getElementById('modo-trabajador');
  el.removeAttribute('hidden');
  document.getElementById('modo-empleador').setAttribute('hidden', '');
  el.innerHTML = `
    <div class="trab-header">
      <div class="trab-badge">📄 Vista del trabajador</div>
      <h1 class="trab-nombre-lg" style="margin-top:var(--sp-2)">Error</h1>
    </div>
    <div style="padding:var(--sp-3);text-align:center">
      <p style="color:var(--muted)">${esc(msg)}</p>
      <a href="#/" class="btn btn-trab" style="margin-top:var(--sp-2);display:inline-flex">Ir al inicio</a>
    </div>`;
}

function renderVista(d) {
  const el  = document.getElementById('modo-trabajador');
  el.removeAttribute('hidden');
  document.getElementById('modo-empleador').setAttribute('hidden', '');

  const trab   = d.trab  || {};
  const neto   = d.neto  || 0;
  const prov   = d.prov  || {};
  const ptxt   = fmtPeriodo(d.periodo, d.frec, d.q);
  const emitida = d.emit ? new Date(d.emit).toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' }) : '—';

  el.innerHTML = `
    <div class="trab-header">
      <div class="trab-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        Vista del trabajador
      </div>
      <div class="trab-avatar-lg">${iniciales(trab.nombre)}</div>
      <div class="trab-nombre-lg">${esc(trab.nombre || '—')}</div>
      <div class="trab-cargo-lg">${esc(trab.cargo || '')}${trab.dni ? ` · DNI ${esc(trab.dni)}` : ''}</div>
    </div>

    <div class="trab-neto-display">
      <div class="trab-neto-lbl">Recibiste este mes</div>
      <div class="trab-neto-val mono">${fmtS(neto)}</div>
      <div class="trab-neto-sub">${ptxt}${d.num ? ` · Boleta N° ${esc(String(d.num))}` : ''}</div>
    </div>

    <div class="trab-prov-grid">
      <div class="trab-prov-card">
        <div class="p-lbl">CTS</div>
        <div class="p-val mono">${fmtS(prov.cts)}</div>
      </div>
      <div class="trab-prov-card">
        <div class="p-lbl">Gratificación</div>
        <div class="p-val mono">${fmtS(prov.gratif)}</div>
      </div>
      <div class="trab-prov-card">
        <div class="p-lbl">Vacaciones</div>
        <div class="p-val mono">${fmtS(prov.vac)}</div>
      </div>
    </div>

    <div style="padding:var(--sp-2)">
      <div class="card">
        <div class="card-body">
          <div class="upper text-muted mb-2">Detalle del recibo</div>
          <table style="width:100%;border-collapse:collapse">
            <tr style="border-bottom:1px solid var(--borde)">
              <td style="padding:.5rem 0;font-size:var(--t-xs);color:var(--muted)">Empleador</td>
              <td style="padding:.5rem 0;font-size:var(--t-xs);text-align:right;font-weight:500">${esc(d.emp || '—')}</td>
            </tr>
            <tr style="border-bottom:1px solid var(--borde)">
              <td style="padding:.5rem 0;font-size:var(--t-xs);color:var(--muted)">Período</td>
              <td style="padding:.5rem 0;font-size:var(--t-xs);text-align:right;font-weight:500">${ptxt}</td>
            </tr>
            <tr style="border-bottom:1px solid var(--borde)">
              <td style="padding:.5rem 0;font-size:var(--t-xs);color:var(--muted)">Sueldo bruto</td>
              <td style="padding:.5rem 0;font-size:var(--t-xs);text-align:right;font-weight:500">${fmtS(d.bruto)}</td>
            </tr>
            <tr style="border-bottom:1px solid var(--borde)">
              <td style="padding:.5rem 0;font-size:var(--t-xs);color:var(--muted)">EsSalud (aporte empleador)</td>
              <td style="padding:.5rem 0;font-size:var(--t-xs);text-align:right;font-weight:500">${fmtS(d.essalud)}${!d.incEs ? ' <em style="color:var(--c-aviso)">(no incluido)</em>' : ''}</td>
            </tr>
            <tr>
              <td style="padding:.5rem 0;font-size:var(--t-xs);color:var(--muted)">Emitida</td>
              <td style="padding:.5rem 0;font-size:var(--t-xs);text-align:right;font-weight:500">${emitida}</td>
            </tr>
          </table>
        </div>
      </div>

      ${!d.incEs ? `
        <div class="banner banner-aviso mt-2">
          ⚠ EsSalud no incluido en esta boleta. Consulta con tu empleador sobre tu cobertura de salud.
        </div>` : ''}

      <div class="banner banner-info mt-2" style="font-size:var(--t-xs)">
        🔒 Esta boleta viaja en el enlace y no pasa por ningún servidor. Solo tú tienes acceso.
      </div>

      <div style="text-align:center;margin-top:var(--sp-3)">
        <a href="#/" class="btn btn-secundario btn-sm">← Ir al modo empleador</a>
      </div>
    </div>`;
}
