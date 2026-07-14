import {
  sbPushEmpleador,
  sbUpsertTrabajador, sbDeleteTrabajador,
  sbUpsertBoleta,    sbDeleteBoleta,
} from './supabase.js';

const P = 'nh.v2.';

function get(key) {
  try { return JSON.parse(localStorage.getItem(P + key)); } catch { return null; }
}
function set(key, val) {
  localStorage.setItem(P + key, JSON.stringify(val));
}
function nanoid(len = 8) {
  return [...crypto.getRandomValues(new Uint8Array(len * 2))]
    .map(b => b.toString(36)).join('').slice(0, len);
}

// ══════════════════════════════════════════════════
//  Modo Supabase (activado desde ui-auth.js)
// ══════════════════════════════════════════════════
let _sb  = null;   // Supabase client
let _uid = null;   // auth.users UUID
let _eid = null;   // nomina_empleadores UUID
let _c   = null;   // caché en memoria (null = modo localStorage)

/** Llama ui-auth.js cuando el usuario selecciona empleador */
export function activarModoSupabase(sb, userId, empleadorId, data) {
  _sb  = sb;
  _uid = userId;
  _eid = empleadorId;
  _c   = {
    empleador:    data.empleador    || {},
    trabajadores: data.trabajadores || [],
    boletas:      data.boletas      || [],
    firmas:       data.firmas       || {},
    config:       { autonumerar: true, siguienteNum: 1 },
  };
}

export function desactivarModoSupabase() {
  _sb = _uid = _eid = _c = null;
}

export const modoSupabase      = () => !!_c;
export const getEmpleadorIdSb  = () => _eid;
export const getUserEmail      = () => null; // se sobreescribe desde ui-auth.js

// ── Empleador ──────────────────────────────────────
export const getEmpleador = () => _c ? { ..._c.empleador } : (get('empleador') || {});

export function setEmpleador(d) {
  if (_c) {
    _c.empleador = d;
    sbPushEmpleador(_sb, _eid, d.nombre, d, _c.firmas).catch(console.error);
  } else {
    set('empleador', d);
  }
}

// ── Trabajadores ───────────────────────────────────
export const getTrabajadores = () => _c ? [..._c.trabajadores] : (get('trabajadores') || []);

export function addTrabajador(t) {
  const nuevo = { ...t, id: nanoid(), creadoEn: new Date().toISOString() };
  if (_c) {
    _c.trabajadores.push(nuevo);
    sbUpsertTrabajador(_sb, _eid, _uid, nuevo).catch(console.error);
  } else {
    const list = get('trabajadores') || [];
    list.push(nuevo);
    set('trabajadores', list);
  }
  return nuevo;
}

export function updateTrabajador(id, changes) {
  if (_c) {
    _c.trabajadores = _c.trabajadores.map(t => t.id === id ? { ...t, ...changes } : t);
    const updated = _c.trabajadores.find(t => t.id === id);
    if (updated) sbUpsertTrabajador(_sb, _eid, _uid, updated).catch(console.error);
  } else {
    set('trabajadores', (get('trabajadores') || []).map(t => t.id === id ? { ...t, ...changes } : t));
  }
}

export function deleteTrabajador(id) {
  if (_c) {
    _c.trabajadores = _c.trabajadores.filter(t => t.id !== id);
    sbDeleteTrabajador(_sb, id).catch(console.error);
  } else {
    set('trabajadores', (get('trabajadores') || []).filter(t => t.id !== id));
  }
}

export const getTrabajador = (id) => getTrabajadores().find(t => t.id === id) || null;

// ── Boletas ────────────────────────────────────────
export const getBoletas = () => _c ? [..._c.boletas] : (get('boletas') || []);

export function addBoleta(b) {
  const id = nanoid();
  const boleta = { ...b, id };
  if (_c) {
    _c.boletas.unshift(boleta);
    sbUpsertBoleta(_sb, _eid, _uid, boleta).catch(console.error);
  } else {
    const list = get('boletas') || [];
    list.unshift(boleta);
    set('boletas', list);
  }
  return boleta;
}

export const getBoleta = (id) => getBoletas().find(b => b.id === id) || null;

export function updateBoleta(id, changes) {
  if (_c) {
    _c.boletas = _c.boletas.map(b => b.id === id ? { ...b, ...changes } : b);
    const updated = _c.boletas.find(b => b.id === id);
    if (updated) sbUpsertBoleta(_sb, _eid, _uid, updated).catch(console.error);
  } else {
    set('boletas', (get('boletas') || []).map(b => b.id === id ? { ...b, ...changes } : b));
  }
}

export function deleteBoleta(id) {
  if (_c) {
    _c.boletas = _c.boletas.filter(b => b.id !== id);
    sbDeleteBoleta(_sb, id).catch(console.error);
  } else {
    set('boletas', (get('boletas') || []).filter(b => b.id !== id));
  }
}

// ── Firmas ─────────────────────────────────────────
export const getFirmas = () => _c ? ({ ..._c.firmas }) : (get('firmas') || {});

export function setFirmas(d) {
  if (_c) {
    _c.firmas = d;
    sbPushEmpleador(_sb, _eid, _c.empleador?.nombre, _c.empleador, d).catch(console.error);
  } else {
    set('firmas', d);
  }
}

// ── Config (siempre localStorage – es estado de UI) ─
export function getConfig() {
  return { autonumerar: true, siguienteNum: 1, ...get('config') };
}
export function setConfig(changes) {
  set('config', { ...getConfig(), ...changes });
}

// ── Último trabajador seleccionado (UI state) ───────
export const getUltimoTrabId = ()   => get('ultimoTrabId');
export const setUltimoTrabId = (id) => set('ultimoTrabId', id);

// ── Siguiente número correlativo ────────────────────
export function siguienteNumBoleta() {
  const boletas = getBoletas();
  const nums = boletas
    .map(b => b.numero)
    .filter(Boolean)
    .map(n => parseInt(String(n).replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

// ── Migración v1 → v2 (solo modo localStorage) ─────
export function migrarV1() {
  if (_c) return; // en Supabase mode no migramos localStorage
  if (get('migrado')) return;

  try {
    const raw = localStorage.getItem('nh_firmas');
    if (raw) {
      const v1 = JSON.parse(raw);
      set('firmas', { emp: v1.emp || null, trab: v1.trab || null });
    }
  } catch {}

  try {
    const rawH = localStorage.getItem('nh_hist');
    if (rawH) {
      const hist = JSON.parse(rawH) || [];
      if (hist.length) {
        const boletas = hist.map((r, i) => ({
          id:          `v1_${i}_${r.id || i}`,
          numero:      r.numBoleta ? parseInt(String(r.numBoleta).replace(/\D/g,''), 10) : i + 1,
          trabajadorId: null,
          snapshot: {
            empleador:  { nombre: r.emp || '' },
            trabajador: { nombre: r.trab || '', cargo: r.cargo || '', dni: '' },
          },
          periodo:     r.periodo || '',
          frecuencia:  r.frec || 'mensual',
          quincena:    r.quincena || 1,
          sueldoBruto: r.brutoMes || 0,
          pension:     { tipo: (r.sistema || 'onp').toLowerCase() },
          incluyeEssalud: true,
          adelantos:   0,
          observaciones: '',
          calculo: {
            neto: r.neto || 0,
            essalud: 0,
            desc: { pension: 0, comAfp: 0, primaAfp: 0, otros: 0, total: 0 },
            prov: { cts: 0, gratif: 0, vac: 0, total: 0 },
            costoEmpleador: r.costo || 0,
          },
          firmas:     {},
          emitidaEn:  r.fechaISO || new Date().toISOString(),
          archivoPDF: r.archivoPDF || null,
        }));
        set('boletas', boletas);
      }
    }
  } catch {}

  set('migrado', true);
}
