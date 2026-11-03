// Datos locales + cola de cambios pendientes. Cada cambio se ve al momento, se guarda en la cola
// (localStorage) y se envía en orden cuando hay red: se puede apuntar un repostaje en una gasolinera sin
// cobertura. Mientras haya cambios en cola no se recarga del servidor (no se pisa lo local).
import { reactive } from 'vue';
import { demoData } from './demo.js';

// Modo demo (/?demo=1): datos inventados, sin servidor, guardados solo en esta pestaña (sessionStorage).
// No toca los datos de verdad del móvil (localStorage) ni manda nada a la red. Sirve para capturas y para probar.
const q = new URLSearchParams(location.search);
try { if (q.has('demo')) sessionStorage.setItem('autolog-demo', '1'); } catch (e) { /* sin almacenamiento */ }
export const DEMO = (() => { try { return sessionStorage.getItem('autolog-demo') === '1'; } catch (e) { return q.has('demo'); } })();
const box = () => (DEMO ? sessionStorage : localStorage);
const PREFIX = DEMO ? 'autolog-demo.' : 'autolog.';

function load(k, def) { try { const v = box().getItem(PREFIX + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function save(k, v) { try { box().setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }

if (DEMO && !load('vehicles', null)) for (const [k, v] of Object.entries(demoData())) save(k, v);
if (q.has('demo')) {
  q.delete('demo');
  history.replaceState(null, '', location.pathname + (q.size ? '?' + q : '') + location.hash);
}
export function exitDemo() {
  try { for (const k of Object.keys(sessionStorage)) if (k.startsWith('autolog-demo')) sessionStorage.removeItem(k); } catch (e) { /* nada */ }
  location.replace('/');
}

// Token: ?token=... la primera vez (se guarda y se quita de la barra de direcciones)
if (!DEMO && q.has('token')) {
  save('token', q.get('token'));
  q.delete('token');
  history.replaceState(null, '', location.pathname + (q.size ? '?' + q : '') + location.hash);
}
// Los adjuntos se abren con <img> o en otra pestaña (sin cabeceras): la clave va en una cookie solo para /v1/files
function fileCookie(t) {
  document.cookie = 'autolog_token=' + encodeURIComponent(t || '') + '; Path=/v1/files; SameSite=Strict' +
    (t ? '; Max-Age=315360000' : '; Max-Age=0') + (location.protocol === 'https:' ? '; Secure' : '');
}
if (!DEMO) fileCookie(load('token', ''));

export const S = reactive({
  vehicles: load('vehicles', []),
  fuel: load('fuel', []),
  expenses: load('expenses', []),
  reminders: load('reminders', []),
  files: load('files', []), // adjuntos: solo los datos; el fichero se pide a /v1/files/:id
  queue: load('queue', []),
  current: load('current', ''),
  online: true,
  auth: true, // false = falta el token o no vale
});

function persist() { for (const k of ['vehicles', 'fuel', 'expenses', 'reminders', 'files', 'queue', 'current']) save(k, S[k]); }

export function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function setCurrent(id) { S.current = id; save('current', id); }

// ------------------------------------------------------------ cambios
export function put(kind, rec) {
  const list = S[kind], i = list.findIndex((x) => x.id === rec.id);
  if (i >= 0) list[i] = rec; else list.unshift(rec);
  enqueue('PUT', kind, rec.id, rec);
}

export function del(kind, id) {
  S[kind] = S[kind].filter((x) => x.id !== id);
  if (kind === 'vehicles') {
    S.fuel = S.fuel.filter((x) => x.vehicle_id !== id);
    S.expenses = S.expenses.filter((x) => x.vehicle_id !== id);
    S.reminders = S.reminders.filter((x) => x.vehicle_id !== id);
    S.files = S.files.filter((x) => x.vehicle_id !== id);
    if (S.current === id) S.current = S.vehicles[0] ? S.vehicles[0].id : '';
  }
  if (kind !== 'vehicles') S.files = S.files.filter((x) => !(x.parent_kind === kind && x.parent_id === id));
  enqueue('DELETE', kind, id);
}

function enqueue(method, kind, id, body) {
  S.queue.push({ method, path: '/v1/' + kind + '/' + encodeURIComponent(id), body });
  persist();
  flush();
}

// ------------------------------------------------------------ red
export async function call(method, path, body) {
  if (DEMO) throw new Error('En el modo demo no hay servidor');
  const h = {}, token = load('token', '');
  if (token) h.Authorization = 'Bearer ' + token;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
    S.auth = r.status !== 401;
    S.online = true;
    return r;
  } catch (e) {
    S.online = false;
    throw e;
  } finally { clearTimeout(t); }
}

let flushing = null;
export function flush() { return flushing || (flushing = run().finally(() => { flushing = null; })); }
async function run() {
  if (DEMO) { S.queue = []; persist(); return; } // en la demo los cambios se quedan en la pestaña
  while (S.queue.length) {
    const op = S.queue[0];
    let r;
    try { r = await call(op.method, op.path, op.body); } catch (e) { return; }
    if (r.status === 401 || r.status >= 500) return; // se reintenta más tarde
    if (!r.ok) console.warn('[sync] descartado ' + op.method + ' ' + op.path + ': ' + (await r.text()));
    S.queue.shift(); // 2xx, o 4xx (dato no válido): fuera de la cola
    persist();
  }
}

export async function pull() {
  if (DEMO) return;
  await flush();
  if (S.queue.length) return;
  try {
    const r = await call('GET', '/v1/data');
    if (!r.ok || S.queue.length) return;
    const d = await r.json();
    S.vehicles = d.vehicles;
    S.fuel = d.fuel;
    S.expenses = d.expenses;
    S.reminders = d.reminders || [];
    S.files = d.files || [];
    if (!S.vehicles.some((v) => v.id === S.current)) S.current = S.vehicles[0] ? S.vehicles[0].id : '';
    persist();
  } catch (e) { /* sin red: seguimos con lo local */ }
}

// ------------------------------------------------------------ adjuntos
// Subir necesita red (un fichero no cabe en la cola). Las fotos se reducen antes: ~2000 px en JPEG.
export async function upload(file, meta) {
  if (DEMO) throw new Error('En el modo demo no se guardan fotos');
  const blob = file.type.startsWith('image/') ? await shrink(file) : file;
  const name = blob === file ? file.name : file.name.replace(/\.\w+$/, '') + '.jpg';
  const fd = new FormData();
  for (const [k, v] of Object.entries({ id: newId(), ...meta })) fd.append(k, v);
  fd.append('file', blob, name);
  const h = {}, token = load('token', '');
  if (token) h.Authorization = 'Bearer ' + token;
  let r;
  try { r = await fetch('/v1/files', { method: 'POST', headers: h, body: fd }); } catch (e) { S.online = false; throw new Error('Sin conexión: los adjuntos necesitan red'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se ha podido subir (' + r.status + ')');
  S.files.push(d);
  persist();
  return d;
}

async function shrink(file, max = 2000) {
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
    return out && out.size < file.size ? out : file;
  } catch (e) { return file; } // formato que el navegador no sabe leer: se sube tal cual
}

export function delFile(id) {
  S.files = S.files.filter((f) => f.id !== id);
  enqueue('DELETE', 'files', id);
}

export function fileUrl(id) { return '/v1/files/' + encodeURIComponent(id); }

export function setToken(t) { save('token', t.trim()); fileCookie(t.trim()); S.auth = true; pull(); }

export function start() {
  pull();
  setInterval(pull, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
  window.addEventListener('online', pull);
}
