// Ley 27986 — Trabajadores del Hogar, Perú
export const LEGAL = {
  RMV: 1025,
  ONP: 0.13,
  ESSALUD: 0.09,
  AFP_APORTE: 0.10,
  CTS_F:    1 / 24,
  GRATIF_F: 1 / 12,
  VAC_F:    1 / 24,
  AFP: {
    HABITAT:   { comision: 0.0089, prima: 0.0184 },
    INTEGRA:   { comision: 0.0155, prima: 0.0184 },
    PRIMA:     { comision: 0.0119, prima: 0.0184 },
    PROFUTURO: { comision: 0.0149, prima: 0.0184 },
  },
};

/**
 * Función pura: no toca el DOM.
 *
 * @param {object} input
 * @param {number}  input.sueldoBruto       - Sueldo mensual
 * @param {'onp'|'afp'|'ninguno'} input.pension.tipo
 * @param {string}  [input.pension.afp]     - 'HABITAT'|'INTEGRA'|'PRIMA'|'PROFUTURO'
 * @param {boolean} input.incluyeEssalud    - Toggle EsSalud
 * @param {number}  [input.adelantos]       - Otros descuentos
 * @param {'mensual'|'quincenal'} input.frecuencia
 * @param {1|2}     [input.quincena]
 * @returns {Calculo}
 */
export function calcularBoleta({
  sueldoBruto,
  pension = { tipo: 'onp' },
  incluyeEssalud = true,
  adelantos = 0,
  frecuencia = 'mensual',
  quincena = 1,
}) {
  const divisor    = frecuencia === 'quincenal' ? 2 : 1;
  const diasPeriodo = frecuencia === 'quincenal' ? 15 : 30;
  const base       = sueldoBruto / divisor;

  // ── Retenciones al trabajador ──────────────────────
  let descPension = 0, comAfp = 0, primaAfp = 0, lblPension = '';

  if (pension.tipo === 'onp') {
    descPension = base * LEGAL.ONP;
    lblPension  = 'Retención ONP (13%)';
  } else if (pension.tipo === 'afp') {
    const key = (pension.afp || 'HABITAT').toUpperCase();
    const cfg = LEGAL.AFP[key] || LEGAL.AFP.HABITAT;
    descPension = base * LEGAL.AFP_APORTE;
    comAfp      = base * cfg.comision;
    primaAfp    = base * cfg.prima;
    lblPension  = `Aporte AFP ${key} (10%)`;
  }

  const totDesc = descPension + comAfp + primaAfp + adelantos;
  const neto    = base - totDesc;

  // ── Aportes empleador ──────────────────────────────
  const essalud = incluyeEssalud ? base * LEGAL.ESSALUD : 0;

  // ── Provisiones (sobre mensual, divididas por período) ─
  const cts    = (sueldoBruto * LEGAL.CTS_F)    / divisor;
  const gratif = (sueldoBruto * LEGAL.GRATIF_F) / divisor;
  const vac    = (sueldoBruto * LEGAL.VAC_F)    / divisor;
  const totProv = cts + gratif + vac;

  const costoEmpleador = base + essalud + totProv;

  return {
    sueldoBruto, frecuencia, quincena, divisor, diasPeriodo, base,
    pension, incluyeEssalud,
    desc: { pension: descPension, comAfp, primaAfp, otros: adelantos, total: totDesc, lbl: lblPension },
    neto,
    essalud,
    prov: { cts, gratif, vac, total: totProv },
    costoEmpleador,
    bajoRMV: sueldoBruto > 0 && sueldoBruto < LEGAL.RMV,
  };
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function fmtPeriodo(yyyymm, frec, q) {
  if (!yyyymm || yyyymm === '—') return 'Sin definir';
  const [y, m] = yyyymm.split('-');
  const nom = MESES[+m - 1];
  return frec === 'quincenal'
    ? `${q === 1 ? '01-15' : '16-último'} ${nom} ${y}`
    : `${nom} ${y}`;
}

export function fmtS(n) {
  return `S/ ${(n || 0).toFixed(2)}`;
}

export function iniciales(nombre = '') {
  return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?';
}
