// Notificaciones push en este móvil. Necesitan HTTPS (Tailscale) y, en iPhone, la app instalada en la pantalla
// de inicio (iOS 16.4+). El servidor decide qué avisar y cuándo (server/src/alerts.js).
import { reactive } from 'vue';
import { call } from './store.js';

export const P = reactive({
  supported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  // iPhone en Safari (sin instalar): no hay push hasta que se añade a la pantalla de inicio
  iosBrowser: /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone,
  on: false,
  busy: false,
  msg: '',
});

async function current() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function b64(s) {
  const p = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}

// Al abrir: ¿está activado? Y se vuelve a mandar la suscripción por si el servidor la hubiera perdido.
export async function refreshPush() {
  if (!P.supported) return;
  try {
    const sub = await current();
    P.on = !!sub && Notification.permission === 'granted';
    if (P.on) call('POST', '/v1/push/subscribe', sub.toJSON()).catch(() => {});
  } catch (e) { /* sin service worker (desarrollo) */ }
}

export async function enablePush() {
  P.busy = true;
  P.msg = '';
  try {
    if ((await Notification.requestPermission()) !== 'granted') throw new Error('Permiso denegado: actívalo en los ajustes del navegador para esta web.');
    const reg = await navigator.serviceWorker.ready;
    const r = await call('GET', '/v1/push/key');
    if (!r.ok) throw new Error('El servidor no responde');
    const { key } = await r.json();
    const old = await reg.pushManager.getSubscription();
    if (old) await old.unsubscribe(); // por si las claves del servidor han cambiado
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    const s = await call('POST', '/v1/push/subscribe', sub.toJSON());
    if (!s.ok) throw new Error('El servidor no ha aceptado la suscripción');
    P.on = true;
    await testPush();
  } catch (e) {
    P.msg = e.name === 'TypeError' ? 'Sin conexión' : e.message;
  } finally { P.busy = false; }
}

export async function disablePush() {
  P.busy = true;
  try {
    const sub = await current();
    if (sub) {
      await call('POST', '/v1/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    P.on = false;
    P.msg = '';
  } finally { P.busy = false; }
}

export async function testPush() {
  const sub = await current();
  if (!sub) return;
  const r = await call('POST', '/v1/push/test', { endpoint: sub.endpoint }).catch(() => null);
  P.msg = r && r.ok ? 'Enviada una notificación de prueba.' : 'No se ha podido enviar la prueba.';
}
