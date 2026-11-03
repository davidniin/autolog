// Instalar la app en el móvil. Android/Chrome: el navegador ofrece su diálogo (beforeinstallprompt) y aquí se
// enseña un botón "Instalar". iPhone/Safari no tiene ese diálogo: se explica cómo hacerlo desde Compartir.
import { reactive } from 'vue';

const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

function dismissed() { try { return localStorage.getItem('autolog.installTip') === 'no'; } catch (e) { return false; } }

export const I = reactive({
  prompt: null, // evento guardado para lanzar el diálogo de instalación
  iosTip: ios && !standalone && !dismissed() && import.meta.env.MODE !== 'demo',
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  if (import.meta.env.MODE !== 'demo') I.prompt = e; // la demo de la landing no se instala
});
window.addEventListener('appinstalled', () => { I.prompt = null; });

export async function install() {
  const e = I.prompt;
  if (!e) return;
  I.prompt = null;
  e.prompt();
  await e.userChoice.catch(() => {});
}

export function hideIosTip() {
  I.iosTip = false;
  try { localStorage.setItem('autolog.installTip', 'no'); } catch (e) { /* sin almacenamiento */ }
}
