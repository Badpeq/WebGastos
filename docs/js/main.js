import { migrarV1 } from './storage.js';
import { init as initEmpleador } from './ui-empleador.js';
import { init as initTrabajador } from './ui-trabajador.js';

function route() {
  const hash = location.hash || '#/';

  if (hash.startsWith('#/b/')) {
    // Modo trabajador — boleta compartida
    const payload = hash.slice(4);
    document.getElementById('modo-trabajador').removeAttribute('hidden');
    document.getElementById('modo-empleador').setAttribute('hidden', '');
    initTrabajador(payload);
    return;
  }

  // Modo empleador (default)
  document.getElementById('modo-empleador').removeAttribute('hidden');
  document.getElementById('modo-trabajador').setAttribute('hidden', '');
  initEmpleador();
}

// Migrar datos v1 en la primera carga
migrarV1();

// Router
window.addEventListener('hashchange', () => location.reload());
route();
