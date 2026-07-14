import { sb, getSession, signIn, signUp, signOut, listarEmpleadores, crearEmpleador, cargarEmpleador } from './supabase.js';
import { activarModoSupabase, desactivarModoSupabase, migrarV1 } from './storage.js';

let _onListo = null;

export function init(onListo) {
  _onListo = onListo;
  _iniciar();
}

export async function cerrarSesion() {
  await signOut();
  desactivarModoSupabase();
  location.reload();
}

// ── Flujo principal ────────────────────────────────
async function _iniciar() {
  const session = await getSession();
  if (session) {
    await _flujoEmpleador(session);
  } else {
    _mostrarLogin();
  }
}

async function _flujoEmpleador(session) {
  let empleadores;
  try {
    empleadores = await listarEmpleadores();
  } catch (e) {
    _mostrarLogin('Error al conectar con el servidor: ' + e.message);
    return;
  }

  if (empleadores.length === 1) {
    await _entrar(session, empleadores[0].id, empleadores[0].nombre);
  } else {
    _mostrarSelector(session, empleadores);
  }
}

// ── Paneles ────────────────────────────────────────
function _panelAuth() { return document.getElementById('panel-auth'); }

function _mostrarAuth(html) {
  _panelAuth().removeAttribute('hidden');
  document.getElementById('modo-empleador').setAttribute('hidden', '');
  document.getElementById('modo-trabajador').setAttribute('hidden', '');
  _panelAuth().innerHTML = html;
}

// ── Login ──────────────────────────────────────────
function _mostrarLogin(info = '') {
  _mostrarAuth(`
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-brand">
          <svg class="auth-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M9 9h6M9 12h6M9 15h4"/>
          </svg>
          <div>
            <h1 class="auth-title">NóminaHogar</h1>
            <p class="auth-sub">Ley 27986 · Perú</p>
          </div>
        </div>
        ${info ? `<div class="auth-info">${_esc(info)}</div>` : ''}
        <div class="field">
          <label class="label">Correo electrónico</label>
          <input class="input" type="email" id="auth-email" autocomplete="email" placeholder="correo@ejemplo.com">
        </div>
        <div class="field">
          <label class="label">Contraseña</label>
          <input class="input" type="password" id="auth-pass" autocomplete="current-password" placeholder="••••••••">
        </div>
        <div id="auth-error" class="auth-error" hidden></div>
        <div class="auth-actions">
          <button class="btn btn-primario" id="btn-auth-login">Ingresar</button>
          <button class="btn btn-secundario" id="btn-auth-reg">Crear cuenta</button>
        </div>
        <div class="auth-sep"><span>o</span></div>
        <button class="btn-ghost" id="btn-auth-guest" style="width:100%;text-align:center;padding:.6rem">
          Usar sin cuenta — datos solo en este dispositivo
        </button>
      </div>
    </div>`);

  const emailEl = () => document.getElementById('auth-email');
  const passEl  = () => document.getElementById('auth-pass');
  const errEl   = () => document.getElementById('auth-error');

  function mostrarError(msg) {
    const el = errEl();
    el.textContent = msg;
    el.removeAttribute('hidden');
  }

  function ocultarError() { errEl().setAttribute('hidden', ''); }

  async function doLogin() {
    ocultarError();
    const email = emailEl().value.trim();
    const pass  = passEl().value;
    if (!email || !pass) { mostrarError('Completa correo y contraseña'); return; }
    const btn = document.getElementById('btn-auth-login');
    btn.textContent = 'Ingresando…'; btn.disabled = true;
    const { error } = await signIn(email, pass);
    btn.textContent = 'Ingresar'; btn.disabled = false;
    if (error) {
      mostrarError(error.message.includes('Invalid login credentials')
        ? 'Correo o contraseña incorrectos'
        : error.message);
      return;
    }
    const session = await getSession();
    await _flujoEmpleador(session);
  }

  async function doRegister() {
    ocultarError();
    const email = emailEl().value.trim();
    const pass  = passEl().value;
    if (!email || !pass) { mostrarError('Completa correo y contraseña'); return; }
    if (pass.length < 6)  { mostrarError('La contraseña debe tener al menos 6 caracteres'); return; }
    const btn = document.getElementById('btn-auth-reg');
    btn.textContent = 'Creando…'; btn.disabled = true;
    const { error } = await signUp(email, pass);
    btn.textContent = 'Crear cuenta'; btn.disabled = false;
    if (error) {
      mostrarError(error.message.includes('already registered')
        ? 'Ese correo ya tiene cuenta. Ingresa con tu contraseña.'
        : error.message);
      return;
    }
    // Supabase auto-confirms by default in most projects
    const session = await getSession();
    if (session) {
      await _flujoEmpleador(session);
    } else {
      _mostrarLogin('✅ Cuenta creada. Revisa tu correo y confirma para entrar.');
    }
  }

  document.getElementById('btn-auth-login').addEventListener('click', doLogin);
  document.getElementById('btn-auth-reg').addEventListener('click', doRegister);
  emailEl().addEventListener('keydown', e => e.key === 'Enter' && passEl().focus());
  passEl().addEventListener('keydown', e => e.key === 'Enter' && doLogin());

  document.getElementById('btn-auth-guest').addEventListener('click', () => {
    migrarV1();
    _panelAuth().setAttribute('hidden', '');
    document.getElementById('modo-empleador').removeAttribute('hidden');
    _onListo && _onListo(null, null);
  });
}

// ── Selector de empleadores ────────────────────────
function _mostrarSelector(session, empleadores) {
  const cards = empleadores.map(e => `
    <button class="sel-card" data-id="${_esc(e.id)}" title="${_esc(e.nombre)}">
      <div class="sel-avatar">${_iniciales(e.nombre)}</div>
      <div class="sel-nombre">${_esc(e.nombre)}</div>
    </button>`).join('');

  _mostrarAuth(`
    <div class="auth-wrap">
      <div class="auth-card" style="max-width:480px">
        <div class="sel-hdr">
          <div>
            <h2>Selecciona empleador</h2>
            <p class="auth-sub">${_esc(session.user.email)}</p>
          </div>
          <button class="btn btn-secundario btn-sm" id="btn-sel-logout">Salir</button>
        </div>
        <div class="sel-grid">
          ${cards}
          <button class="sel-card sel-nuevo" id="btn-sel-nuevo">
            <div class="sel-avatar sel-plus">+</div>
            <div class="sel-nombre">Nuevo hogar</div>
          </button>
        </div>
      </div>
    </div>`);

  document.querySelectorAll('.sel-card[data-id]').forEach(btn =>
    btn.addEventListener('click', () => _entrar(session, btn.dataset.id, btn.querySelector('.sel-nombre').textContent)));

  document.getElementById('btn-sel-nuevo').addEventListener('click', () => _crearNuevo(session));
  document.getElementById('btn-sel-logout').addEventListener('click', async () => {
    await signOut();
    _mostrarLogin();
  });
}

async function _crearNuevo(session) {
  const nombre = prompt('Nombre del hogar / empleador:', 'Mi hogar');
  if (!nombre || !nombre.trim()) return;
  try {
    const nuevo = await crearEmpleador(session.user.id, nombre.trim());
    await _entrar(session, nuevo.id, nuevo.nombre);
  } catch (e) {
    alert('Error al crear: ' + e.message);
  }
}

// ── Entrar a la app con empleador seleccionado ─────
async function _entrar(session, empleadorId, nombreEmp) {
  _mostrarAuth(`<div class="auth-wrap"><div class="auth-card" style="text-align:center;padding:3rem;color:var(--muted)">
    Cargando ${_esc(nombreEmp || '')}…
  </div></div>`);

  try {
    const data = await cargarEmpleador(empleadorId);
    activarModoSupabase(sb, session.user.id, empleadorId, data);

    _panelAuth().setAttribute('hidden', '');
    document.getElementById('modo-empleador').removeAttribute('hidden');

    // Guardar email en el DOM para mostrarlo en el header
    document.getElementById('modo-empleador').dataset.userEmail = session.user.email;

    _onListo && _onListo(session, empleadorId);
  } catch (e) {
    _mostrarLogin('Error al cargar datos: ' + e.message);
  }
}

// ── Utils ──────────────────────────────────────────
function _iniciales(s) {
  return (s || '?').split(' ').slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('') || '?';
}
function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
