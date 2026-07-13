// LZString y QRCode se cargan como globals desde CDN en index.html

const BASE = 'https://badpeq.github.io/WebGastos/';
const MAX_URL = 1800;

export function generarPayload(boleta) {
  const data = {
    v: 2,
    id:   boleta.id,
    num:  boleta.numero,
    emp:  boleta.snapshot?.empleador?.nombre || '',
    trab: {
      nombre: boleta.snapshot?.trabajador?.nombre || '',
      dni:    boleta.snapshot?.trabajador?.dni    || '',
      cargo:  boleta.snapshot?.trabajador?.cargo  || '',
    },
    periodo:   boleta.periodo || '',
    frec:      boleta.frecuencia || 'mensual',
    q:         boleta.quincena  || 1,
    bruto:     boleta.sueldoBruto,
    neto:      boleta.calculo?.neto || 0,
    essalud:   boleta.calculo?.essalud || 0,
    incEs:     boleta.incluyeEssalud,
    pension:   boleta.pension,
    prov:      boleta.calculo?.prov || {},
    costo:     boleta.calculo?.costoEmpleador || 0,
    obs:       boleta.observaciones || '',
    emit:      boleta.emitidaEn,
  };

  let payload = _compress(data);
  if ((BASE + '#/b/' + payload).length > MAX_URL) {
    data.obs = '';
    payload = _compress(data);
  }
  return payload;
}

function _compress(data) {
  return window.LZString.compressToEncodedURIComponent(JSON.stringify(data));
}

export function deserializarPayload(payload) {
  const json = window.LZString.decompressFromEncodedURIComponent(payload);
  if (!json) return null;
  return JSON.parse(json);
}

export function generarLink(boleta) {
  return BASE + '#/b/' + generarPayload(boleta);
}

export function mostrarQR(url, container) {
  container.innerHTML = '';
  // QRCode from cdnjs (qrcodejs)
  new window.QRCode(container, {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#0F172A',
    colorLight: '#FFFFFF',
    correctLevel: window.QRCode.CorrectLevel.M,
  });
}

export async function compartirUrl(url, titulo = 'Mi boleta de pago') {
  if (navigator.share) {
    await navigator.share({ title: titulo, url });
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
