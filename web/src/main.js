import { createApp } from 'vue';
import App from './App.vue';
import { start } from './store.js';
import { refreshPush } from './push.js';
import './install.js'; // escucha beforeinstallprompt desde el arranque
import './style.css';

createApp(App).mount('#app');
start();

// El service worker solo en producción (en desarrollo cachearía los módulos de Vite)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(refreshPush).catch((e) => console.warn('[sw] ' + e.message));
}
