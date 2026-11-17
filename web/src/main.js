import { createApp } from 'vue';
import App from './App.vue';
import { start, LOCAL } from './store.js';
import { refreshPush } from './push.js';
import './install.js'; // escucha beforeinstallprompt desde el arranque
import './style.css';

createApp(App).mount('#app');
start();

// El service worker solo en producción (en desarrollo cachearía los módulos de Vite)
if (import.meta.env.PROD && import.meta.env.MODE !== 'demo' && 'serviceWorker' in navigator) {
  // En la versión sin servidor la app vive en una subcarpeta (/app/): ruta relativa; y no hay notificaciones push
  navigator.serviceWorker.register(LOCAL ? './sw.js' : '/sw.js').then(LOCAL ? undefined : refreshPush).catch((e) => console.warn('[sw] ' + e.message));
  if (LOCAL && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); // que el navegador no borre los datos para liberar espacio
}
