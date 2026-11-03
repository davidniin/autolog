// Avisos pendientes (Pronto / Vencido) y notificaciones push.
// Cada día, a partir de PUSH_HOUR (9:00 por defecto, hora del servidor), se revisan los recordatorios y se
// notifica a los móviles suscritos. Para no repetir: solo se avisa cuando un recordatorio pasa a "pronto" o a
// "vencido" (o cambia su vencimiento); si sigue vencido, se recuerda una vez por semana.
import webpush from 'web-push';
import { CONFIG } from './config.js';
import { sql } from './db.js';

// Los mismos umbrales que la web (web/src/calc.js)
const SOON_DAYS = 30;
const SOON_KM = 1000;
const REPEAT_LATE_DAYS = 7;

const today = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD en la zona horaria del servidor (TZ)
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const nf = new Intl.NumberFormat('es-ES');
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

// ------------------------------------------------------------ avisos pendientes
// Recordatorios en "pronto" o "vencido", lo más urgente primero. Los usa el push y GET /v1/alerts.
export async function alerts() {
  const rows = await sql`
    select r.id, r.title, r.due_date::text as due_date, r.due_km, v.id as vehicle_id, v.name as vehicle,
      greatest(coalesce(v.start_km, 0),
        coalesce((select max(km) from autolog_fuel f where f.vehicle_id = v.id), 0),
        coalesce((select max(km) from autolog_expense e where e.vehicle_id = v.id), 0)) as km
    from autolog_reminder r join autolog_vehicle v on v.id = r.vehicle_id`;
  const t = today(), out = [];
  for (const r of rows) {
    const d = r.due_date ? days(t, r.due_date) : null;
    const k = r.due_km != null ? r.due_km - r.km : null;
    const late = (d != null && d < 0) || (k != null && k <= 0);
    const soon = !late && ((d != null && d <= SOON_DAYS) || (k != null && k <= SOON_KM));
    if (!late && !soon) continue;
    const parts = [];
    const kmFirst = k != null && (d == null || k / SOON_KM < d / SOON_DAYS);
    const kmText = k == null ? '' : k <= 0 ? 'pasado por ' + nf.format(-k) + ' km' : 'faltan ' + nf.format(k) + ' km';
    if (kmFirst) parts.push(kmText);
    if (d != null) parts.push(d < 0 ? 'venció hace ' + plural(-d, 'día') : d === 0 ? 'vence hoy' : 'en ' + plural(d, 'día'));
    if (k != null && !kmFirst) parts.push(kmText);
    out.push({
      id: r.id, title: r.title, vehicle_id: r.vehicle_id, vehicle: r.vehicle,
      level: late ? 'late' : 'soon', days: d, km_left: k, text: parts.join(' · '),
      stamp: (r.due_date || '') + '|' + (r.due_km ?? ''),
      score: Math.min(d != null ? d / SOON_DAYS : Infinity, k != null ? k / SOON_KM : Infinity),
    });
  }
  return out.sort((a, b) => a.score - b.score);
}

// ------------------------------------------------------------ push
let publicKey = '';
export const vapidKey = () => publicKey;

async function getSetting(key) { const [r] = await sql`select value from autolog_setting where key = ${key}`; return r ? r.value : null; }
function setSetting(key, value) {
  return sql`insert into autolog_setting (key, value) values (${key}, ${value}) on conflict (key) do update set value = excluded.value`;
}

// Claves VAPID: se generan la primera vez y se guardan en la base de datos (si cambiaran, habría que
// volver a activar las notificaciones en cada móvil).
export async function initPush() {
  let pub = await getSetting('vapid_public'), priv = await getSetting('vapid_private');
  if (!pub || !priv) {
    ({ publicKey: pub, privateKey: priv } = webpush.generateVAPIDKeys());
    await setSetting('vapid_public', pub);
    await setSetting('vapid_private', priv);
  }
  webpush.setVapidDetails(CONFIG.pushContact, pub, priv);
  publicKey = pub;
  setInterval(() => tick().catch((e) => console.error('[push] ' + e.message)), 15 * 60 * 1000);
  tick().catch((e) => console.error('[push] ' + e.message));
}

export async function subscribe(sub) {
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return false;
  const keys = { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) };
  await sql`insert into autolog_push (endpoint, keys) values (${sub.endpoint}, ${sql.json(keys)})
    on conflict (endpoint) do update set keys = excluded.keys`;
  return true;
}
export function unsubscribe(endpoint) { return sql`delete from autolog_push where endpoint = ${String(endpoint || '')}`; }

// Envía a una suscripción. Si el servicio dice que ya no existe (404/410), se borra.
async function send(sub, payload) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 24 * 3600 });
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) await unsubscribe(sub.endpoint);
    else console.warn('[push] ' + (e.statusCode || '') + ' ' + e.message);
    return false;
  }
}

export async function sendTest(endpoint) {
  const [sub] = await sql`select endpoint, keys from autolog_push where endpoint = ${String(endpoint || '')}`;
  if (!sub) return false;
  return send(sub, { title: '🔔 AutoLog', body: 'Las notificaciones funcionan en este móvil.', tag: 'test' });
}

// Revisión: manda lo que toque y lo apunta en autolog_notified. Devuelve cuántos avisos se han enviado.
export async function check() {
  const subs = await sql`select endpoint, keys from autolog_push`;
  if (!subs.length) return 0;
  const list = await alerts();
  const prev = Object.fromEntries((await sql`select reminder_id, stamp, level, sent_at from autolog_notified`).map((r) => [r.reminder_id, r]));
  const weekAgo = Date.now() - REPEAT_LATE_DAYS * 864e5;
  let n = 0;
  for (const a of list) {
    const p = prev[a.id];
    const due = !p || p.stamp !== a.stamp || p.level !== a.level || (a.level === 'late' && +p.sent_at < weekAgo);
    if (!due) continue;
    const payload = { title: (a.level === 'late' ? '⛔ ' : '⚠️ ') + a.title, body: a.vehicle + ' · ' + a.text, tag: 'r-' + a.id, url: '/' };
    const sent = (await Promise.all(subs.map((s) => send(s, payload)))).some(Boolean);
    if (!sent) continue;
    n++;
    await sql`insert into autolog_notified (reminder_id, stamp, level) values (${a.id}, ${a.stamp}, ${a.level})
      on conflict (reminder_id) do update set stamp = excluded.stamp, level = excluded.level, sent_at = now()`;
  }
  // Olvida los recordatorios que ya no están pendientes (hechos o borrados): si vuelven, se avisará de nuevo
  const ids = list.map((a) => a.id);
  await sql`delete from autolog_notified where not (reminder_id = any(${sql.array(ids, 25)}))`;
  return n;
}

// Cada 15 min: una vez al día, a partir de la hora indicada
async function tick() {
  const d = today();
  if (new Date().getHours() < CONFIG.pushHour || (await getSetting('push_last_run')) === d) return;
  const n = await check();
  await setSetting('push_last_run', d);
  if (n) console.log('[push] ' + n + ' avisos enviados');
}
