import { migrarV1 } from './storage.js';
import { init as initEmpleador } from './ui-empleador.js';
import { init as initTrabajador } from './ui-trabajador.js';
import { init as initAuth } from './ui-auth.js';

function route() {
  const hash = location.hash || '#/';

  if (hash.startsWith('#/b/')) {
    // Modo trabajador — boleta compartida, sin auth
    const payload = hash.slice(4);
    document.getElementById('panel-auth').setAttribute('hidden', '');
    document.getElementById('modo-trabajador').removeAttribute('hidden');
    document.getElementById('modo-empleador').setAttribute('hidden', '');
    initTrabajador(payload);
    return;
  }

  // Modo empleador — pasa por auth (puede ser guest o Supabase)
  initAuth((_session, _empleadorId) => {
    if (!_session) {
      // Modo guest: usar localStorage
      migrarV1();
    }
    initEmpleador();
  });
}

window.addEventListener('hashchange', () => location.reload());
route();
