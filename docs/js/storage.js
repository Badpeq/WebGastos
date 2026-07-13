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

// ── Empleador ──────────────────────────────────────
export const getEmpleador  = ()  => get('empleador') || {};
export const setEmpleador  = (d) => set('empleador', d);

// ── Trabajadores ───────────────────────────────────
export const getTrabajadores = () => get('trabajadores') || [];

export function addTrabajador(t) {
  const list = getTrabajadores();
  const nuevo = { ...t, id: nanoid(), creadoEn: new Date().toISOString() };
  list.push(nuevo);
  set('trabajadores', list);
  return nuevo;
}

export function updateTrabajador(id, changes) {
  const list = getTrabajadores().map(t => t.id === id ? { ...t, ...changes } : t);
  set('trabajadores', list);
}

export function deleteTrabajador(id) {
  set('trabajadores', getTrabajadores().filter(t => t.id !== id));
}

export const getTrabajador = (id) => getTrabajadores().find(t => t.id === id) || null;

// ── Boletas ────────────────────────────────────────
export const getBoletas = () => get('boletas') || [];

export function addBoleta(b) {
  const id = nanoid();
  const boleta = { ...b, id };
  const list = getBoletas();
  list.unshift(boleta);
  set('boletas', list);
  return boleta;
}

export const getBoleta = (id) => getBoletas().find(b => b.id === id) || null;

export function deleteBoleta(id) {
  set('boletas', getBoletas().filter(b => b.id !== id));
}

// ── Firmas ─────────────────────────────────────────
export const getFirmas  = ()  => get('firmas') || {};
export const setFirmas  = (d) => set('firmas', d);

// ── Config ─────────────────────────────────────────
export function getConfig() {
  return { autonumerar: true, siguienteNum: 1, ...get('config') };
}
export function setConfig(changes) {
  set('config', { ...getConfig(), ...changes });
}

// ── Último trabajador seleccionado ─────────────────
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

// ── Migración v1 → v2 ──────────────────────────────
export function migrarV1() {
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
