import { calcularBoleta, fmtPeriodo, fmtS, iniciales, LEGAL } from './calculos.js';
import {
  getEmpleador, setEmpleador,
  getTrabajadores, addTrabajador, updateTrabajador, deleteTrabajador, getTrabajador,
  getBoletas, addBoleta, getBoleta, deleteBoleta,
  getFirmas, setFirmas,
  getConfig, setConfig,
  getUltimoTrabId, setUltimoTrabId,
  siguienteNumBoleta,
} from './storage.js';
import { generarLink, generarPayload, mostrarQR, compartirUrl } from './share.js';

// ── Estado de la sesión ────────────────────────────
const W = {
  paso:          1,
  trabId:        null,
  frecuencia:    'mensual',
  quincena:      1,
  pension:       { tipo: 'onp', afp: 'HABITAT' },
  incluyeEs:     true,
  calc:          null,
  tabActiva:     'boleta',
  firmas:        { emp: null, trab: null },
  // Boleta generada en el paso 3 (pre-guardado)
  boletaPreview: null,
};

// ── Helpers de DOM ─────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function toast(msg, dur = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), dur);
}

function modal(html) {
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = html;
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
  return bd;
}

function confirmar({ titulo, msg, consecuencias, btnLabel = 'Eliminar', peligro = true, onOk }) {
  const m = modal(`
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-hdr">
        <h3>${titulo}</h3>
        <button class="btn-ghost btn-sm" data-cerrar>✕</button>
      </div>
      <div class="modal-body">
        <p class="confirm-msg">${msg}</p>
        ${consecuencias ? `<div class="confirm-consecuencias">${consecuencias}</div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario btn-sm" data-cerrar>Cancelar</button>
        <button class="btn ${peligro ? 'btn-peligro' : 'btn-primario'} btn-sm" data-ok>${btnLabel}</button>
      </div>
    </div>`);
  $$('[data-cerrar]', m).forEach(b => b.addEventListener('click', () => m.remove()));
  $('[data-ok]', m).addEventListener('click', () => { m.remove(); onOk(); });
}

// ── Tabs ───────────────────────────────────────────
function activarTab(tab) {
  W.tabActiva = tab;
  $$('.tab-btn').forEach(b => b.classList.toggle('activo', b.dataset.tab === tab));
  $$('.panel').forEach(p => p.classList.toggle('activo', p.id === `panel-${tab}`));
  if (tab === 'trabajadores') renderTrabajadores();
  if (tab === 'historial')    renderHistorial();
  if (tab === 'costos')       renderCostos();
}

// ══════════════════════════════════════════════════
//  WIZARD — Boleta tab
// ══════════════════════════════════════════════════
function renderProgress() {
  const pasos = [
    { n: 1, label: 'Trabajador' },
    { n: 2, label: 'Pago' },
    { n: 3, label: 'Revisar' },
  ];
  return `<div class="wizard-progress">
    ${pasos.map((p, i) => `
      <div class="wz-step ${W.paso > p.n ? 'listo' : W.paso === p.n ? 'activo' : ''}">
        <div class="wz-dot">${W.paso > p.n ? '✓' : p.n}</div>
        <span>${p.label}</span>
      </div>
      ${i < pasos.length - 1 ? '<div class="wz-line"></div>' : ''}
    `).join('')}
  </div>`;
}

function irPaso(n) {
  W.paso = n;
  renderWizard();
}

function renderWizard() {
  const wrap = document.getElementById('wizard-wrap');
  if (!wrap) return;
  wrap.innerHTML = renderProgress() + (W.paso === 1 ? htmlPaso1() : W.paso === 2 ? htmlPaso2() : htmlPaso3());
  bindPaso();
}

// ── Paso 1: Selección de trabajador ───────────────
function htmlPaso1() {
  const lista = getTrabajadores();
  const cards = lista.length
    ? lista.map(t => `
        <div class="worker-card ${W.trabId === t.id ? 'seleccionado' : ''}"
             data-trabid="${t.id}" role="radio"
             aria-checked="${W.trabId === t.id}" tabindex="0">
          <div class="worker-avatar">${iniciales(t.nombre)}</div>
          <div class="worker-info">
            <div class="worker-nombre">${esc(t.nombre)}</div>
            <div class="worker-cargo">${esc(t.cargo || '—')}</div>
          </div>
        </div>`).join('')
    : `<div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>
        <h3>Sin trabajadores</h3>
        <p>Agrega tu primer trabajador para empezar</p>
      </div>`;

  return `
    <div class="card"><div class="card-body">
      <div class="upper text-muted mb-2">Selecciona trabajador</div>
      <div class="worker-grid">${cards}</div>
      <button class="btn btn-secundario btn-sm" id="btn-nuevo-trab">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Nuevo trabajador
      </button>
    </div></div>
    <div class="btn-row right">
      <button class="btn btn-primario ${W.trabId ? '' : 'hidden'}" id="btn-siguiente-1">
        Siguiente →
      </button>
    </div>`;
}

// ── Paso 2: Datos de pago ──────────────────────────
function htmlPaso2() {
  const p = W.pension;
  const hoy = new Date();
  const periodoDefault = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const numSig = siguienteNumBoleta();
  const numDefault = `${String(numSig).padStart(3,'0')}-${hoy.getFullYear()}`;

  return `
    <div class="card"><div class="card-body">
      <div class="upper text-muted mb-2">Período y sueldo</div>
      <div class="field-row">
        <div class="field">
          <label class="label">Período</label>
          <input type="month" id="inp-periodo" class="input" value="${periodoDefault}">
        </div>
        <div class="field">
          <label class="label">Número de boleta</label>
          <div class="flex gap-1">
            <input type="text" id="inp-num-boleta" class="input" value="${numDefault}" placeholder="001-2026">
            <button class="btn btn-secundario btn-sm" id="btn-autonumerar" title="Auto-numerar">↺</button>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="label">Frecuencia de pago</label>
        <div class="seg" role="group">
          <button class="seg-btn ${W.frecuencia === 'mensual' ? 'activo' : ''}" data-frec="mensual">Mensual</button>
          <button class="seg-btn ${W.frecuencia === 'quincenal' ? 'activo' : ''}" data-frec="quincenal">Quincenal</button>
        </div>
        <div id="quin-sel" class="${W.frecuencia === 'quincenal' ? 'mt-1' : 'hidden'}">
          <div class="seg" role="group">
            <button class="seg-btn ${W.quincena === 1 ? 'activo' : ''}" data-quin="1">1ª (1-15)</button>
            <button class="seg-btn ${W.quincena === 2 ? 'activo' : ''}" data-quin="2">2ª (16-último)</button>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="label">Sueldo mensual bruto (S/)</label>
        <input type="number" id="inp-sueldo" class="input" min="0" step="0.01"
               value="${W.calc ? W.calc.sueldoBruto : LEGAL.RMV}" placeholder="1025.00">
        <div id="rmv-warn" class="hint warn hidden">
          ⚠ Menor a la RMV (S/ ${LEGAL.RMV}). Verifica si aplica una modalidad especial.
        </div>
      </div>

      <div class="field">
        <label class="label">Adelantos / Otros descuentos (S/)</label>
        <input type="number" id="inp-adelantos" class="input" min="0" step="0.01" value="0">
      </div>
    </div></div>

    <div class="card mt-2"><div class="card-body">
      <div class="upper text-muted mb-2">Sistema pensional</div>
      <div class="seg" role="group">
        <button class="seg-btn ${p.tipo === 'onp' ? 'activo' : ''}" data-pension="onp">ONP</button>
        <button class="seg-btn ${p.tipo === 'afp' ? 'activo' : ''}" data-pension="afp">AFP</button>
        <button class="seg-btn ${p.tipo === 'ninguno' ? 'activo' : ''}" data-pension="ninguno">Ninguno</button>
      </div>
      <div id="afp-sel-wrap" class="${p.tipo === 'afp' ? 'field mt-1' : 'hidden'}">
        <label class="label">AFP</label>
        <select id="sel-afp" class="select">
          ${['HABITAT','INTEGRA','PRIMA','PROFUTURO'].map(a =>
            `<option value="${a}" ${p.afp === a ? 'selected' : ''}>${a}</option>`
          ).join('')}
        </select>
      </div>
    </div></div>

    <div class="card mt-2"><div class="card-body">
      <div class="upper text-muted mb-2">EsSalud (aporte empleador)</div>
      <div class="toggle-row">
        <div>
          <label for="sw-essalud" style="cursor:pointer">Incluir EsSalud (9%)</label>
          <div class="toggle-sub">S/ ${fmtCosto()} · a cargo del empleador</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="sw-essalud" ${W.incluyeEs ? 'checked' : ''}>
          <div class="switch-track"><div class="switch-thumb"></div></div>
        </label>
      </div>
      <div id="banner-no-essalud" class="${W.incluyeEs ? 'hidden' : 'banner banner-aviso mt-1'}">
        ⚠ EsSalud no incluido: el trabajador no tendrá cobertura de salud. Esto es inusual.
      </div>
    </div></div>

    <div class="card mt-2"><div class="card-body">
      <div class="upper text-muted mb-2">Observaciones (opcional)</div>
      <textarea id="inp-obs" class="textarea" rows="3" placeholder="Ej: Pago correspondiente al período vacacional…"></textarea>
    </div></div>

    <div class="btn-row between">
      <button class="btn btn-secundario" id="btn-atras-2">← Atrás</button>
      <button class="btn btn-primario" id="btn-calcular">Calcular →</button>
    </div>`;
}

function fmtCosto() {
  const sueldo = parseFloat($('#inp-sueldo')?.value) || LEGAL.RMV;
  const divisor = W.frecuencia === 'quincenal' ? 2 : 1;
  return ((sueldo / divisor) * LEGAL.ESSALUD).toFixed(2);
}

// ── Paso 3: Revisar y generar ──────────────────────
function htmlPaso3() {
  const c = W.calc;
  if (!c) return '<p class="text-muted center mt-3">Vuelve al paso 2 para calcular.</p>';

  const trab = W.trabId ? getTrabajador(W.trabId) : null;
  const emp  = getEmpleador();
  const periodo = $('#inp-periodo')?.value || '';
  const numBol  = $('#inp-num-boleta')?.value || '';
  const obs     = $('#inp-obs')?.value || '';

  W.boletaPreview = {
    numero: numBol,
    periodo,
    frecuencia: c.frecuencia,
    quincena: c.quincena,
    sueldoBruto: c.sueldoBruto,
    pension: c.pension,
    incluyeEssalud: c.incluyeEssalud,
    adelantos: c.desc.otros,
    observaciones: obs,
    calculo: c,
    trabajadorId: W.trabId,
    snapshot: {
      empleador: { nombre: emp.nombre || '', dni: emp.dni || '', dir: emp.dir || '' },
      trabajador: {
        nombre:    trab?.nombre || '',
        dni:       trab?.dni    || '',
        cargo:     trab?.cargo  || '',
        modalidad: trab?.modalidad || '',
        ingreso:   trab?.ingreso   || '',
      },
    },
    firmas: W.firmas,
  };

  const periodoTxt = fmtPeriodo(periodo, c.frecuencia, c.quincena);
  const esAfp = c.pension.tipo === 'afp';
  const esQ   = c.frecuencia === 'quincenal';

  return `
    ${!c.incluyeEssalud ? '<div class="banner banner-aviso mb-2">⚠ EsSalud no incluido. El costo del empleador no contempla seguro de salud.</div>' : ''}
    ${c.bajoRMV ? '<div class="banner banner-aviso mb-2">⚠ Sueldo menor a la RMV (S/ ' + LEGAL.RMV + '). Revisa antes de guardar.</div>' : ''}

    <div class="neto-display">
      <div class="neto-label">Neto a pagar ${esQ ? '(quincenal)' : '(mensual)'}</div>
      <div class="neto-monto mono">${fmtS(c.neto)}</div>
      <div class="neto-sub">${esc(trab?.nombre || '—')} · ${periodoTxt}</div>
    </div>

    <div class="card"><div class="card-body">
      <table class="desglose">
        <tr class="sect-hdr"><td colspan="2">Haberes</td></tr>
        <tr><td>Remuneración ${esQ ? 'quincenal' : 'mensual'} (${c.diasPeriodo} días)</td><td class="mono">${fmtS(c.base)}</td></tr>
        <tr class="tot-row"><td>Total haberes</td><td class="mono">${fmtS(c.base)}</td></tr>

        <tr class="sect-hdr"><td colspan="2">Descuentos</td></tr>
        ${c.pension.tipo !== 'ninguno' ? `<tr><td>${esc(c.desc.lbl)}</td><td class="mono text-peligro">- ${fmtS(c.desc.pension)}</td></tr>` : ''}
        ${esAfp ? `
          <tr><td>Comisión AFP ${esc(c.pension.afp || '')}</td><td class="mono text-peligro">- ${fmtS(c.desc.comAfp)}</td></tr>
          <tr><td>Prima de seguro AFP</td><td class="mono text-peligro">- ${fmtS(c.desc.primaAfp)}</td></tr>
        ` : ''}
        ${c.desc.otros > 0 ? `<tr><td>Adelantos / Otros</td><td class="mono text-peligro">- ${fmtS(c.desc.otros)}</td></tr>` : ''}
        ${c.pension.tipo === 'ninguno' && c.desc.otros === 0 ? '<tr><td class="text-muted">Sin descuentos</td><td>—</td></tr>' : ''}
        <tr class="tot-row"><td>Total descuentos</td><td class="mono">${fmtS(c.desc.total)}</td></tr>

        <tr class="neto-row"><td>NETO A PAGAR</td><td class="mono">${fmtS(c.neto)}</td></tr>

        <tr class="sect-hdr"><td colspan="2">Aportes empleador</td></tr>
        <tr><td>EsSalud (9%) ${!c.incluyeEssalud ? '<em class="text-muted">(no incluido)</em>' : ''}</td><td class="mono">${fmtS(c.essalud)}</td></tr>
        <tr><td>CTS (prov.)</td><td class="mono">${fmtS(c.prov.cts)}</td></tr>
        <tr><td>Gratificación (prov.)</td><td class="mono">${fmtS(c.prov.gratif)}</td></tr>
        <tr><td>Vacaciones (prov.)</td><td class="mono">${fmtS(c.prov.vac)}</td></tr>
        <tr class="costo-row"><td>COSTO TOTAL EMPLEADOR</td><td class="mono">${fmtS(c.costoEmpleador)}</td></tr>
      </table>
    </div></div>

    <div class="btn-row between">
      <button class="btn btn-secundario" id="btn-atras-3">← Atrás</button>
      <button class="btn btn-primario" id="btn-guardar-generar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Guardar y generar boleta
      </button>
    </div>`;
}

function bindPaso() {
  // Tab clicks (re-bind al re-renderizar)
  $$('.tab-btn').forEach(b =>
    b.addEventListener('click', () => activarTab(b.dataset.tab)));

  if (W.paso === 1) {
    // Selección de trabajador
    $$('.worker-card').forEach(card =>
      card.addEventListener('click', () => {
        W.trabId = card.dataset.trabid;
        setUltimoTrabId(W.trabId);
        renderWizard();
      }));
    $$('.worker-card').forEach(card =>
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') card.click(); }));
    $('#btn-nuevo-trab')?.addEventListener('click', () => abrirModalTrabajador());
    $('#btn-siguiente-1')?.addEventListener('click', () => {
      if (!W.trabId) { toast('Selecciona un trabajador'); return; }
      irPaso(2);
    });
  }

  if (W.paso === 2) {
    const inp = $('#inp-sueldo');
    const calcular = () => {
      const sueldo = parseFloat(inp?.value) || 0;
      $('#rmv-warn')?.classList.toggle('hidden', !(sueldo > 0 && sueldo < LEGAL.RMV));
      // Actualizar subtítulo EsSalud
      const subEs = $('.toggle-row .toggle-sub');
      if (subEs && W.incluyeEs) {
        const divisor = W.frecuencia === 'quincenal' ? 2 : 1;
        subEs.textContent = `S/ ${((sueldo / divisor) * LEGAL.ESSALUD).toFixed(2)} · a cargo del empleador`;
      }
    };

    inp?.addEventListener('input', calcular);

    // Segmentos frecuencia
    $$('[data-frec]').forEach(b => b.addEventListener('click', () => {
      W.frecuencia = b.dataset.frec;
      $$('[data-frec]').forEach(x => x.classList.toggle('activo', x.dataset.frec === W.frecuencia));
      $('#quin-sel')?.classList.toggle('hidden', W.frecuencia !== 'quincenal');
    }));

    $$('[data-quin]').forEach(b => b.addEventListener('click', () => {
      W.quincena = parseInt(b.dataset.quin);
      $$('[data-quin]').forEach(x => x.classList.toggle('activo', +x.dataset.quin === W.quincena));
    }));

    // Segmentos pensión
    $$('[data-pension]').forEach(b => b.addEventListener('click', () => {
      W.pension.tipo = b.dataset.pension;
      $$('[data-pension]').forEach(x => x.classList.toggle('activo', x.dataset.pension === W.pension.tipo));
      $('#afp-sel-wrap')?.classList.toggle('hidden', W.pension.tipo !== 'afp');
    }));

    $('#sel-afp')?.addEventListener('change', e => { W.pension.afp = e.target.value; });

    // EsSalud toggle
    $('#sw-essalud')?.addEventListener('change', e => {
      W.incluyeEs = e.target.checked;
      $('#banner-no-essalud')?.classList.toggle('hidden', W.incluyeEs);
    });

    // Auto-numerar
    $('#btn-autonumerar')?.addEventListener('click', () => {
      const n = siguienteNumBoleta();
      const anio = new Date().getFullYear();
      $('#inp-num-boleta').value = `${String(n).padStart(3,'0')}-${anio}`;
      toast('Número asignado automáticamente');
    });

    $('#btn-atras-2')?.addEventListener('click', () => irPaso(1));
    $('#btn-calcular')?.addEventListener('click', () => {
      const sueldo = parseFloat($('#inp-sueldo')?.value);
      if (!sueldo || sueldo <= 0) { toast('⚠ Ingresa el sueldo bruto'); return; }
      if (W.pension.tipo === 'afp') W.pension.afp = $('#sel-afp')?.value || 'HABITAT';

      W.calc = calcularBoleta({
        sueldoBruto: sueldo,
        pension: W.pension,
        incluyeEssalud: W.incluyeEs,
        adelantos: parseFloat($('#inp-adelantos')?.value) || 0,
        frecuencia: W.frecuencia,
        quincena: W.quincena,
      });
      irPaso(3);
    });
  }

  if (W.paso === 3) {
    $('#btn-atras-3')?.addEventListener('click', () => irPaso(2));
    $('#btn-guardar-generar')?.addEventListener('click', guardarYGenerar);
  }
}

// ── Guardar + generar PDF ──────────────────────────
async function guardarYGenerar() {
  if (!W.boletaPreview) return;

  // Guardar en storage
  const boleta = addBoleta({
    ...W.boletaPreview,
    emitidaEn: new Date().toISOString(),
  });

  // Renderizar boleta oculta
  renderBoletaOculta(boleta);
  await new Promise(r => setTimeout(r, 80));

  // Generar PDF con html2canvas
  toast('⏳ Generando PDF…');
  const el = document.getElementById('boleta-oculta');
  try {
    const canvas = await window.html2canvas(el, {
      scale: 3, useCORS: true, backgroundColor: '#fff', logging: false,
    });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const mg = 12;
    const iw = pw - mg * 2;
    const ih = (canvas.height * iw) / canvas.width;
    const y  = ih <= ph - mg * 2 ? (ph - ih) / 2 : mg;
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', mg, y, iw, ih);
    const nombre = boleta.snapshot?.trabajador?.nombre || 'boleta';
    const filename = `Boleta_${nombre.replace(/\s+/g,'_')}_${boleta.periodo || 'sin-periodo'}.pdf`;
    doc.save(filename);
    toast('✅ Boleta guardada y PDF generado');
  } catch (err) {
    toast('⚠ PDF no generado: ' + err.message);
  }

  // Mostrar pantalla de éxito
  renderPantallaExito(boleta);
}

function renderPantallaExito(boleta) {
  const wrap = document.getElementById('wizard-wrap');
  const link = generarLink(boleta);
  wrap.innerHTML = `
    <div class="card"><div class="card-body center">
      <div style="font-size:2.5rem;margin-bottom:var(--sp-2)">✅</div>
      <h2 style="font-size:var(--t-md);font-weight:700;margin-bottom:.5rem">¡Boleta generada!</h2>
      <p class="text-muted" style="margin-bottom:var(--sp-3)">
        ${esc(boleta.snapshot?.trabajador?.nombre || '')} ·
        ${fmtPeriodo(boleta.periodo, boleta.frecuencia, boleta.quincena)}
      </p>
      <div class="btn-row" style="justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primario" id="btn-exit-pdf">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar PDF
        </button>
        <button class="btn btn-secundario" id="btn-exit-compartir">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Compartir
        </button>
        <button class="btn btn-secundario" id="btn-exit-nueva">Nueva boleta</button>
      </div>
    </div></div>`;

  document.getElementById('btn-exit-pdf').addEventListener('click', () => exportarPDF(boleta));
  document.getElementById('btn-exit-compartir').addEventListener('click', () => abrirModalCompartir(boleta, link));
  document.getElementById('btn-exit-nueva').addEventListener('click', () => {
    W.paso = 1; W.calc = null; W.boletaPreview = null;
    renderWizard();
  });
  actualizarBadgeHistorial();
}

// ── Boleta oculta (captura PDF) ────────────────────
function renderBoletaOculta(boleta) {
  const el  = document.getElementById('boleta-oculta');
  const c   = boleta.calculo;
  const sn  = boleta.snapshot;
  const emp = sn?.empleador || {};
  const tr  = sn?.trabajador || {};
  const fir = boleta.firmas || {};
  const ptxt = fmtPeriodo(boleta.periodo, boleta.frecuencia, boleta.quincena);
  const esAfp = c.pension?.tipo === 'afp';
  const esQ   = boleta.frecuencia === 'quincenal';
  const qLbl  = boleta.quincena === 1 ? 'primera (días 1-15)' : 'segunda (días 16 al último)';
  const fF    = d => d ? d.split('-').reverse().join('/') : '—';

  let rowsDesc = '';
  if (c.pension?.tipo !== 'ninguno') {
    rowsDesc += `<div class="boleta-sec-row"><span>${esc(c.desc?.lbl || 'Pensión')}</span><span>${fmtS(c.desc?.pension)}</span></div>`;
  }
  if (esAfp) {
    rowsDesc += `<div class="boleta-sec-row"><span>Comisión AFP ${esc(c.pension.afp || '')}</span><span>${fmtS(c.desc?.comAfp)}</span></div>`;
    rowsDesc += `<div class="boleta-sec-row"><span>Prima de seguro AFP</span><span>${fmtS(c.desc?.primaAfp)}</span></div>`;
  }
  if (c.desc?.otros > 0) rowsDesc += `<div class="boleta-sec-row"><span>Adelantos / Otros</span><span>${fmtS(c.desc.otros)}</span></div>`;
  if (!rowsDesc) rowsDesc = `<div class="boleta-sec-row"><span class="text-muted">Sin descuentos</span><span>—</span></div>`;

  el.innerHTML = `<div class="boleta">
    <div class="boleta-hdr">
      <h3>BOLETA DE PAGO${boleta.numero ? ` &nbsp;·&nbsp; N° ${esc(boleta.numero)}` : ''}</h3>
      <p>Trabajadores del Hogar · Ley N° 27986</p>
      <span class="boleta-periodo">Período: ${ptxt}</span>
    </div>
    <div class="boleta-body">
      <div class="boleta-sec">
        <div class="boleta-sec-title">Empleador</div>
        <div class="boleta-sec-row"><span>Nombre:</span><span><b>${esc(emp.nombre || '—')}</b></span></div>
        <div class="boleta-sec-row"><span>DNI:</span><span>${esc(emp.dni || '—')}</span></div>
        ${emp.dir ? `<div class="boleta-sec-row"><span>Domicilio:</span><span>${esc(emp.dir)}</span></div>` : ''}
      </div>
      <div class="boleta-sec">
        <div class="boleta-sec-title">Trabajador</div>
        <div class="boleta-sec-row"><span>Nombre:</span><span><b>${esc(tr.nombre || '—')}</b></span></div>
        <div class="boleta-sec-row"><span>DNI:</span><span>${esc(tr.dni || '—')}</span></div>
        <div class="boleta-sec-row"><span>Cargo:</span><span>${esc(tr.cargo || '—')}</span></div>
        ${tr.modalidad ? `<div class="boleta-sec-row"><span>Modalidad:</span><span>${esc(tr.modalidad)}</span></div>` : ''}
        ${tr.ingreso   ? `<div class="boleta-sec-row"><span>Ingreso:</span><span>${fF(tr.ingreso)}</span></div>` : ''}
      </div>
      <div class="boleta-sec">
        <div class="boleta-sec-title">Haberes</div>
        <div class="boleta-sec-row"><span>Rem. ${esQ ? 'Quincenal' : 'Mensual'} (${c.diasPeriodo} días)</span><span>${fmtS(c.base)}</span></div>
        <div class="boleta-sec-row tot"><span>TOTAL HABERES</span><span>${fmtS(c.base)}</span></div>
      </div>
      <div class="boleta-sec">
        <div class="boleta-sec-title">Descuentos</div>
        ${rowsDesc}
        <div class="boleta-sec-row tot"><span>TOTAL DESCUENTOS</span><span>${fmtS(c.desc?.total)}</span></div>
      </div>
    </div>
    <div class="boleta-neto-bar">
      <span class="lbl">NETO A PAGAR</span>
      <span class="val">${fmtS(c.neto)}</span>
    </div>
    ${boleta.observaciones ? `<div class="boleta-obs"><div class="boleta-obs-lbl">Observaciones</div><p>${esc(boleta.observaciones)}</p></div>` : ''}
    <div class="boleta-footer">
      <div class="boleta-firma">
        ${fir.emp ? `<img src="${fir.emp}" alt="firma">` : '<div style="height:56px"></div>'}
        <div class="boleta-firma-line">Firma del Empleador<br><b>${esc(emp.nombre || '')}</b></div>
      </div>
      <div class="boleta-firma">
        ${fir.trab ? `<img src="${fir.trab}" alt="firma">` : '<div style="height:56px"></div>'}
        <div class="boleta-firma-line">Firma del Trabajador<br><b>${esc(tr.nombre || '')}</b></div>
      </div>
    </div>
    <div class="boleta-legal">
      Emitida bajo Ley N° 27986 · Reglamento D.S. N° 015-2003-TR.
      ${esQ ? `Pago correspondiente a la ${qLbl} quincena.` : 'Pago mensual completo (30 días).'}
      EsSalud (${fmtS(c.essalud)}) a cargo del empleador.
      ${!boleta.incluyeEssalud ? 'NOTA: EsSalud no incluido en este período.' : ''}
    </div>
  </div>`;
}

// ── Exportar PDF (re-usar boleta guardada) ─────────
async function exportarPDF(boleta) {
  renderBoletaOculta(boleta);
  await new Promise(r => setTimeout(r, 80));
  toast('⏳ Generando PDF…');
  try {
    const el = document.getElementById('boleta-oculta');
    const canvas = await window.html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#fff', logging: false });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const mg = 12; const iw = pw - mg*2;
    const ih = (canvas.height * iw) / canvas.width;
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', mg, ih <= ph - mg*2 ? (ph-ih)/2 : mg, iw, ih);
    const nombre = boleta.snapshot?.trabajador?.nombre || 'boleta';
    doc.save(`Boleta_${nombre.replace(/\s+/g,'_')}_${boleta.periodo || 'sin-periodo'}.pdf`);
    toast('✅ PDF descargado');
  } catch (err) { toast('⚠ Error PDF: ' + err.message); }
}

function imprimirBoleta(boleta) {
  renderBoletaOculta(boleta);
  const frame  = document.getElementById('print-frame');
  const oculta = document.getElementById('boleta-oculta');
  frame.innerHTML = oculta.innerHTML;
  frame.style.display = 'block';
  window.print();
  window.addEventListener('afterprint', () => {
    frame.style.display = 'none';
    frame.innerHTML = '';
  }, { once: true });
}

// ── Modal Compartir ────────────────────────────────
function abrirModalCompartir(boleta, link) {
  const m = modal(`
    <div class="modal" role="dialog">
      <div class="modal-hdr">
        <h3>Compartir boleta</h3>
        <button class="btn-ghost btn-sm" data-cerrar>✕</button>
      </div>
      <div class="modal-body">
        <p class="text-muted" style="margin-bottom:var(--sp-2);font-size:var(--t-xs)">
          El link contiene la boleta cifrada en el fragmento de URL (#). Los datos no pasan por ningún servidor.
        </p>
        <div class="qr-wrap" id="qr-container"></div>
        <div style="margin-top:var(--sp-2)">
          <input class="input" id="link-input" value="${link}" readonly onclick="this.select()">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario btn-sm" data-cerrar>Cerrar</button>
        <button class="btn btn-primario btn-sm" id="btn-copiar-link">Copiar link</button>
      </div>
    </div>`);

  $$('[data-cerrar]', m).forEach(b => b.addEventListener('click', () => m.remove()));
  mostrarQR(link, document.getElementById('qr-container'));
  document.getElementById('btn-copiar-link').addEventListener('click', async () => {
    const res = await compartirUrl(link, `Boleta de ${boleta.snapshot?.trabajador?.nombre || ''}`);
    toast(res === 'copied' ? '✅ Link copiado' : '✅ Compartido');
  });
}

// ══════════════════════════════════════════════════
//  TAB: TRABAJADORES
// ══════════════════════════════════════════════════
function renderTrabajadores() {
  const panel = document.getElementById('panel-trabajadores');
  const lista = getTrabajadores();
  const rows  = lista.map(t => `
    <div class="trab-row">
      <div class="trab-avatar">${iniciales(t.nombre)}</div>
      <div class="trab-info">
        <div class="trab-nombre">${esc(t.nombre)}</div>
        <div class="trab-meta">${esc(t.cargo || '—')} · DNI ${esc(t.dni || '—')}</div>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-secundario btn-sm" data-edit="${t.id}">Editar</button>
        <button class="btn-ghost btn-sm text-peligro" data-del="${t.id}" title="Eliminar">🗑</button>
      </div>
    </div>`).join('');

  panel.innerHTML = `
    <div class="section-hdr">
      <h2>Trabajadores</h2>
      <button class="btn btn-primario btn-sm" id="btn-add-trab">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Agregar
      </button>
    </div>
    <div class="trabajadores-list">
      ${lista.length ? rows : `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>
          <h3>Sin trabajadores guardados</h3>
          <p>Guarda los datos del trabajador para usarlos en cada boleta</p>
          <button class="btn btn-primario btn-sm" id="btn-add-trab-empty">Agregar trabajador</button>
        </div>`}
    </div>`;

  document.getElementById('btn-add-trab')?.addEventListener('click', () => abrirModalTrabajador());
  document.getElementById('btn-add-trab-empty')?.addEventListener('click', () => abrirModalTrabajador());
  panel.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => abrirModalTrabajador(b.dataset.edit)));
  panel.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => confirmarEliminarTrabajador(b.dataset.del)));
}

function abrirModalTrabajador(id = null) {
  const t   = id ? getTrabajador(id) : null;
  const tit = t ? 'Editar trabajador' : 'Nuevo trabajador';
  const m = modal(`
    <div class="modal" role="dialog">
      <div class="modal-hdr">
        <h3>${tit}</h3>
        <button class="btn-ghost btn-sm" data-cerrar>✕</button>
      </div>
      <div class="modal-body">
        <div class="field"><label class="label">Nombre completo *</label>
          <input class="input" id="mt-nombre" value="${esc(t?.nombre || '')}" placeholder="Rosa Elena Huanca Quispe">
        </div>
        <div class="field-row">
          <div class="field"><label class="label">DNI</label>
            <input class="input" id="mt-dni" value="${esc(t?.dni || '')}" maxlength="8" placeholder="12345678">
          </div>
          <div class="field"><label class="label">Fecha de ingreso</label>
            <input class="input" type="date" id="mt-ingreso" value="${t?.ingreso || ''}">
          </div>
        </div>
        <div class="field"><label class="label">Cargo</label>
          <select class="select" id="mt-cargo">
            ${['Empleada del hogar','Cocinera','Cuidadora de niños','Cuidadora de adultos mayores','Jardinero','Chofer','Mayordomo','Otro']
              .map(c => `<option ${t?.cargo === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label class="label">Modalidad</label>
          <select class="select" id="mt-modal">
            ${['Cama adentro','Cama afuera','Por horas']
              .map(c => `<option ${t?.modalidad === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario btn-sm" data-cerrar>Cancelar</button>
        <button class="btn btn-primario btn-sm" id="mt-guardar">Guardar</button>
      </div>
    </div>`);

  $$('[data-cerrar]', m).forEach(b => b.addEventListener('click', () => m.remove()));
  document.getElementById('mt-guardar').addEventListener('click', () => {
    const nombre = document.getElementById('mt-nombre').value.trim();
    if (!nombre) { toast('⚠ El nombre es obligatorio'); return; }
    const data = {
      nombre,
      dni:       document.getElementById('mt-dni').value.trim(),
      ingreso:   document.getElementById('mt-ingreso').value,
      cargo:     document.getElementById('mt-cargo').value,
      modalidad: document.getElementById('mt-modal').value,
    };
    if (id) { updateTrabajador(id, data); toast('✅ Trabajador actualizado'); }
    else    { addTrabajador(data);        toast('✅ Trabajador guardado'); }
    m.remove();
    if (W.tabActiva === 'trabajadores') renderTrabajadores();
    if (W.tabActiva === 'boleta')       renderWizard();
  });
}

function confirmarEliminarTrabajador(id) {
  const t = getTrabajador(id);
  confirmar({
    titulo: 'Eliminar trabajador',
    msg: `¿Eliminar a <b>${esc(t?.nombre || '')}</b> de la lista?`,
    consecuencias: 'Las boletas ya guardadas en el historial no se verán afectadas, pero no podrás seleccionar este trabajador en futuros pagos.',
    btnLabel: 'Eliminar',
    onOk: () => {
      deleteTrabajador(id);
      if (W.trabId === id) W.trabId = null;
      renderTrabajadores();
      toast('🗑 Trabajador eliminado');
    },
  });
}

// ══════════════════════════════════════════════════
//  TAB: HISTORIAL
// ══════════════════════════════════════════════════
function renderHistorial() {
  const panel = document.getElementById('panel-historial');
  const lista = getBoletas();

  const rows = lista.map(b => {
    const tr     = b.snapshot?.trabajador || {};
    const neto   = b.calculo?.neto || 0;
    const ptxt   = fmtPeriodo(b.periodo, b.frecuencia, b.quincena);
    return `
      <div class="boleta-row">
        <div class="boleta-avatar">${iniciales(tr.nombre)}</div>
        <div class="boleta-info">
          <div class="boleta-nombre">${esc(tr.nombre || '—')}</div>
          <div class="boleta-meta">${ptxt}${b.numero ? ` · N° ${esc(String(b.numero))}` : ''}</div>
        </div>
        <div class="boleta-neto mono">${fmtS(neto)}</div>
        <div class="boleta-acciones">
          <button class="btn btn-secundario btn-sm" data-ver="${b.id}">Ver</button>
          <button class="btn btn-secundario btn-sm" data-dup="${b.id}">Dup.</button>
          <button class="btn-ghost btn-sm" data-del-b="${b.id}" title="Eliminar">🗑</button>
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="section-hdr">
      <h2>Historial</h2>
      <div class="flex gap-1">
        <button class="btn btn-secundario btn-sm" id="btn-export-json">Exportar JSON</button>
        ${lista.length ? `<button class="btn-ghost btn-sm text-peligro" id="btn-borrar-hist">Borrar todo</button>` : ''}
      </div>
    </div>
    <div class="historial-list">
      ${lista.length ? rows : `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <h3>Sin boletas generadas</h3>
          <p>Tus boletas aparecerán aquí después de generarlas</p>
          <button class="btn btn-primario btn-sm" id="btn-crear-boleta">Crear primera boleta</button>
        </div>`}
    </div>`;

  document.getElementById('btn-export-json')?.addEventListener('click', exportarHistorialJSON);
  document.getElementById('btn-borrar-hist')?.addEventListener('click', confirmarBorrarHistorial);
  document.getElementById('btn-crear-boleta')?.addEventListener('click', () => activarTab('boleta'));

  panel.querySelectorAll('[data-ver]').forEach(b =>
    b.addEventListener('click', () => abrirModalDetalleBoleta(b.dataset.ver)));
  panel.querySelectorAll('[data-dup]').forEach(b =>
    b.addEventListener('click', () => duplicarBoleta(b.dataset.dup)));
  panel.querySelectorAll('[data-del-b]').forEach(b =>
    b.addEventListener('click', () => confirmarEliminarBoleta(b.dataset.delB)));

  actualizarBadgeHistorial();
}

function actualizarBadgeHistorial() {
  const n = getBoletas().length;
  const badge = document.querySelector('.tab-btn[data-tab="historial"] .badge-count');
  if (badge) badge.textContent = n;
}

function abrirModalDetalleBoleta(id) {
  const b = getBoleta(id);
  if (!b) return;
  const link = generarLink(b);
  const m = modal(`
    <div class="modal" role="dialog" style="max-width:560px">
      <div class="modal-hdr">
        <h3>Boleta · ${esc(b.snapshot?.trabajador?.nombre || '')}</h3>
        <button class="btn-ghost btn-sm" data-cerrar>✕</button>
      </div>
      <div class="modal-body">
        <p class="text-muted" style="margin-bottom:var(--sp-2)">
          ${fmtPeriodo(b.periodo, b.frecuencia, b.quincena)}
          ${b.numero ? ` · N° ${esc(String(b.numero))}` : ''}
        </p>
        <table class="desglose">
          <tr><td>Sueldo mensual bruto</td><td class="mono">${fmtS(b.sueldoBruto)}</td></tr>
          <tr><td>Total descuentos</td><td class="mono text-peligro">- ${fmtS(b.calculo?.desc?.total)}</td></tr>
          <tr class="neto-row"><td>NETO A PAGAR</td><td class="mono">${fmtS(b.calculo?.neto)}</td></tr>
          <tr><td>EsSalud</td><td class="mono">${fmtS(b.calculo?.essalud)}</td></tr>
          <tr><td>Provisiones</td><td class="mono">${fmtS(b.calculo?.prov?.total)}</td></tr>
          <tr class="costo-row"><td>COSTO TOTAL</td><td class="mono">${fmtS(b.calculo?.costoEmpleador)}</td></tr>
        </table>
      </div>
      <div class="modal-footer" style="flex-wrap:wrap">
        <button class="btn btn-secundario btn-sm" data-cerrar>Cerrar</button>
        <button class="btn btn-secundario btn-sm" id="mbtn-imprimir">Imprimir</button>
        <button class="btn btn-secundario btn-sm" id="mbtn-compartir">Compartir</button>
        <button class="btn btn-primario btn-sm" id="mbtn-pdf">Descargar PDF</button>
      </div>
    </div>`);

  $$('[data-cerrar]', m).forEach(x => x.addEventListener('click', () => m.remove()));
  document.getElementById('mbtn-pdf').addEventListener('click', () => exportarPDF(b));
  document.getElementById('mbtn-imprimir').addEventListener('click', () => { m.remove(); imprimirBoleta(b); });
  document.getElementById('mbtn-compartir').addEventListener('click', () => abrirModalCompartir(b, link));
}

function duplicarBoleta(id) {
  const b = getBoleta(id);
  if (!b) return;
  W.trabId      = b.trabajadorId || null;
  W.frecuencia  = b.frecuencia;
  W.quincena    = b.quincena;
  W.pension     = { ...b.pension };
  W.incluyeEs   = b.incluyeEssalud;
  W.calc        = b.calculo;
  W.paso        = 2;
  activarTab('boleta');
  toast('📋 Boleta duplicada — ajusta el período y genera');
}

function confirmarEliminarBoleta(id) {
  const b = getBoleta(id);
  const nombre = b?.snapshot?.trabajador?.nombre || '';
  confirmar({
    titulo: 'Eliminar boleta',
    msg: `¿Eliminar la boleta de <b>${esc(nombre)}</b>?`,
    consecuencias: 'Esta acción no se puede deshacer. El PDF ya descargado permanecerá en tu dispositivo.',
    btnLabel: 'Eliminar',
    onOk: () => {
      deleteBoleta(id);
      renderHistorial();
      toast('🗑 Boleta eliminada');
    },
  });
}

function confirmarBorrarHistorial() {
  confirmar({
    titulo: 'Borrar todo el historial',
    msg: '¿Borrar TODAS las boletas guardadas?',
    consecuencias: 'Se eliminarán permanentemente los registros. Los PDFs ya descargados permanecen en tu dispositivo.',
    btnLabel: 'Borrar todo',
    onOk: () => {
      getBoletas().forEach(b => deleteBoleta(b.id));
      renderHistorial();
      toast('🗑 Historial borrado');
    },
  });
}

function exportarHistorialJSON() {
  const lista = getBoletas();
  if (!lista.length) { toast('⚠ No hay boletas para exportar'); return; }
  const blob = new Blob([
    JSON.stringify({ app: 'NóminaHogar Perú v2', exportado: new Date().toISOString(), boletas: lista }, null, 2)
  ], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `nomina_historial_${new Date().toISOString().slice(0,10)}.json`,
  });
  a.click(); URL.revokeObjectURL(a.href);
  toast('✅ Historial exportado');
}

// ══════════════════════════════════════════════════
//  TAB: COSTOS ANUALES
// ══════════════════════════════════════════════════
function renderCostos() {
  const panel = document.getElementById('panel-costos');
  const lista = getBoletas();

  if (!lista.length) {
    panel.innerHTML = `
      <div class="empty-state" style="padding-top:var(--sp-6)">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-6"/></svg></div>
        <h3>Sin datos</h3>
        <p>Genera boletas para ver la proyección de costos</p>
      </div>`;
    return;
  }

  // Tomar la boleta más reciente como referencia
  const b = lista[0];
  const B = b.sueldoBruto;
  const c = b.calculo;
  const esONP = b.pension?.tipo === 'onp';

  const remAnual    = B * 12;
  const essaludAn   = B * LEGAL.ESSALUD * 12;
  const ctsAn       = B * LEGAL.CTS_F * 12;
  const gratifAn    = B * LEGAL.GRATIF_F * 12;
  const vacAn       = B * LEGAL.VAC_F * 12;
  const pensionAn   = esONP ? B * LEGAL.ONP * 12 : 0;
  const provTotal   = ctsAn + gratifAn + vacAn;
  const costoAnual  = remAnual + essaludAn + provTotal;

  const f = fmtS;
  panel.innerHTML = `
    <div class="costos-wrap">
      <p class="text-muted" style="margin-bottom:var(--sp-3);font-size:var(--t-xs)">
        Proyección basada en la boleta más reciente · Sueldo mensual: <b>${f(B)}</b>
        ${!b.incluyeEssalud ? '<span class="banner banner-aviso" style="display:inline;padding:2px 8px">EsSalud no incluido</span>' : ''}
      </p>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Costo anual total</div>
          <div class="kpi-val mono">${f(costoAnual)}</div>
          <div class="kpi-sub">empleador + provisiones</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Costo mensual</div>
          <div class="kpi-val mono">${f(costoAnual / 12)}</div>
          <div class="kpi-sub">promedio</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Neto anual</div>
          <div class="kpi-val mono">${f(c.neto * 12)}</div>
          <div class="kpi-sub">recibe el trabajador</div>
        </div>
      </div>
      <table class="cost-table">
        <thead>
          <tr>
            <th>Concepto</th><th>Mensual</th><th>Anual</th><th>%</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Remuneración bruta</td><td class="mono">${f(B)}</td><td class="mono">${f(remAnual)}</td><td>${pct(remAnual,costoAnual)}</td></tr>
          <tr><td>EsSalud (9%)</td><td class="mono">${f(B*LEGAL.ESSALUD)}</td><td class="mono">${f(essaludAn)}</td><td>${pct(essaludAn,costoAnual)}</td></tr>
          <tr><td>CTS</td><td class="mono">${f(B*LEGAL.CTS_F)}</td><td class="mono">${f(ctsAn)}</td><td>${pct(ctsAn,costoAnual)}</td></tr>
          <tr><td>Gratificaciones</td><td class="mono">${f(B*LEGAL.GRATIF_F)}</td><td class="mono">${f(gratifAn)}</td><td>${pct(gratifAn,costoAnual)}</td></tr>
          <tr><td>Vacaciones</td><td class="mono">${f(B*LEGAL.VAC_F)}</td><td class="mono">${f(vacAn)}</td><td>${pct(vacAn,costoAnual)}</td></tr>
          <tr class="tot-row"><td>COSTO TOTAL EMPLEADOR</td><td class="mono">${f(costoAnual/12)}</td><td class="mono">${f(costoAnual)}</td><td>100%</td></tr>
        </tbody>
      </table>
      <p class="hint mt-2">Ley 29351: gratificaciones exentas de EsSalud y aportes previsionales. CTS depósitos en mayo y noviembre.</p>
    </div>`;
}

function pct(n, t) { return t > 0 ? `${(n/t*100).toFixed(1)}%` : '0%'; }

// ══════════════════════════════════════════════════
//  DATOS DEL EMPLEADOR (modal)
// ══════════════════════════════════════════════════
function abrirModalEmpleador() {
  const emp = getEmpleador();
  const m = modal(`
    <div class="modal" role="dialog">
      <div class="modal-hdr">
        <h3>Datos del empleador</h3>
        <button class="btn-ghost btn-sm" data-cerrar>✕</button>
      </div>
      <div class="modal-body">
        <div class="field"><label class="label">Nombre / Razón social *</label>
          <input class="input" id="emp-nombre" value="${esc(emp.nombre || '')}" placeholder="Juan Pérez García">
        </div>
        <div class="field-row">
          <div class="field"><label class="label">DNI / RUC</label>
            <input class="input" id="emp-dni" value="${esc(emp.dni || '')}" placeholder="12345678">
          </div>
        </div>
        <div class="field"><label class="label">Domicilio</label>
          <input class="input" id="emp-dir" value="${esc(emp.dir || '')}" placeholder="Av. Siempre Viva 123, Lima">
        </div>
        <div class="field"><label class="label">Firmas (imagen)</label>
          <div class="field-row">
            <div>
              <p class="hint mb-2">Firma empleador</p>
              <div class="firma-zone" id="zona-firma-emp" tabindex="0">
                ${W.firmas.emp ? `<img src="${W.firmas.emp}" alt="firma">` : '<p>Click o arrastra imagen</p>'}
              </div>
              <input type="file" id="file-firma-emp" accept="image/*" style="display:none">
            </div>
            <div>
              <p class="hint mb-2">Firma trabajador</p>
              <div class="firma-zone" id="zona-firma-trab" tabindex="0">
                ${W.firmas.trab ? `<img src="${W.firmas.trab}" alt="firma">` : '<p>Click o arrastra imagen</p>'}
              </div>
              <input type="file" id="file-firma-trab" accept="image/*" style="display:none">
            </div>
          </div>
          ${(W.firmas.emp || W.firmas.trab) ? `<button class="btn btn-secundario btn-sm mt-1" id="btn-borrar-firmas">Borrar firmas</button>` : ''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario btn-sm" data-cerrar>Cancelar</button>
        <button class="btn btn-primario btn-sm" id="emp-guardar">Guardar</button>
      </div>
    </div>`);

  $$('[data-cerrar]', m).forEach(b => b.addEventListener('click', () => m.remove()));

  // Firma zones
  setupFirmaZone('emp', m);
  setupFirmaZone('trab', m);

  document.getElementById('btn-borrar-firmas')?.addEventListener('click', () => {
    W.firmas = { emp: null, trab: null };
    setFirmas({});
    toast('Firmas borradas');
    m.remove();
  });

  document.getElementById('emp-guardar').addEventListener('click', () => {
    const nombre = document.getElementById('emp-nombre').value.trim();
    setEmpleador({
      nombre,
      dni: document.getElementById('emp-dni').value.trim(),
      dir: document.getElementById('emp-dir').value.trim(),
    });
    setFirmas(W.firmas);
    toast('✅ Datos guardados');
    m.remove();
  });
}

function setupFirmaZone(tipo, ctx) {
  const zona = document.getElementById(`zona-firma-${tipo}`, ctx);
  const file = document.getElementById(`file-firma-${tipo}`, ctx);
  if (!zona || !file) return;

  zona.addEventListener('click', () => file.click());
  zona.addEventListener('keydown', e => { if (e.key === 'Enter') file.click(); });
  zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('drag-over'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('drag-over'));
  zona.addEventListener('drop', e => {
    e.preventDefault(); zona.classList.remove('drag-over');
    const f = e.dataTransfer.files[0]; if (f) leerFirma(f, tipo, zona);
  });
  file.addEventListener('change', () => { if (file.files[0]) leerFirma(file.files[0], tipo, zona); });
}

function leerFirma(file, tipo, zona) {
  const reader = new FileReader();
  reader.onload = e => {
    W.firmas[tipo] = e.target.result;
    zona.innerHTML = `<img src="${e.target.result}" alt="firma">`;
    toast(`✅ Firma ${tipo === 'emp' ? 'del empleador' : 'del trabajador'} cargada`);
  };
  reader.readAsDataURL(file);
}

// ── Escape XSS ─────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
export function init() {
  // Cargar firmas guardadas
  const f = getFirmas();
  W.firmas = { emp: f.emp || null, trab: f.trab || null };

  // Preseleccionar último trabajador
  const ultId = getUltimoTrabId();
  if (ultId && getTrabajador(ultId)) W.trabId = ultId;

  // Tabs
  $$('.tab-btn').forEach(b =>
    b.addEventListener('click', () => activarTab(b.dataset.tab)));

  // Botón empleador (header)
  document.getElementById('btn-empleador')?.addEventListener('click', abrirModalEmpleador);

  // Renderizar
  renderWizard();
  actualizarBadgeHistorial();
}
