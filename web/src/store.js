// Datos locales + cola de cambios pendientes. Cada cambio se ve al momento, se guarda en la cola
// (localStorage) y se envía en orden cuando hay red: se puede apuntar un repostaje en una gasolinera sin
// cobertura. Mientras haya cambios en cola no se recarga del servidor (no se pisa lo local).
import { reactive } from 'vue';
import { demoData } from './demo.js';
import { t } from './i18n/index.js';
import { applyPrefs } from './units.js';

// Modo demo (/?demo=1): datos inventados, sin servidor, guardados solo en esta pestaña (sessionStorage).
// No toca los datos de verdad del móvil (localStorage) ni manda nada a la red. Sirve para capturas y para probar.
const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : ''); // (fuera del navegador: tests)
try { if (q.has('demo')) sessionStorage.setItem('autolog-demo', '1'); } catch (e) { /* sin almacenamiento */ }
// Build "solo demo" (npm run build:site, para la landing): siempre en modo demo y sin servidor
export const DEMO_ONLY = import.meta.env.MODE === 'demo';
export const DEMO = DEMO_ONLY || (() => { try { return sessionStorage.getItem('autolog-demo') === '1'; } catch (e) { return q.has('demo'); } })();
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
  if (DEMO_ONLY) location.reload(); // en la landing: vuelve a empezar con datos nuevos
  else location.replace('/');
}

// Token: ?token=... la primera vez (se guarda y se quita de la barra de direcciones)
if (!DEMO && q.has('token')) {
  save('token', q.get('token'));
  q.delete('token');
  history.replaceState(null, '', location.pathname + (q.size ? '?' + q : '') + location.hash);
}
// Los adjuntos (<img>, otra pestaña) y la copia con fotos (un enlace) se abren sin cabeceras: la clave va en una
// cookie limitada a esas dos rutas (/v1/files y /v1/backup), nunca en la URL
function fileCookie(t) {
  if (typeof document === 'undefined') return;
  for (const path of ['/v1/files', '/v1/backup']) {
    document.cookie = 'autolog_token=' + encodeURIComponent(t || '') + '; Path=' + path + '; SameSite=Strict' +
      (t ? '; Max-Age=315360000' : '; Max-Age=0') + (location.protocol === 'https:' ? '; Secure' : '');
  }
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
  conflicts: load('conflicts', []), // cambios que chocan con otro móvil: { kind, id, mine, theirs } (ver run)
  settings: load('settings', null), // unidades y moneda de la instalación (null = sin elegir todavía)
  online: true,
  auth: true, // false = falta el token o no vale
});

function persist() { for (const k of ['vehicles', 'fuel', 'expenses', 'reminders', 'files', 'queue', 'current', 'settings', 'conflicts']) save(k, S[k]); }
applyPrefs(S.settings);

// Unidades y moneda: para todos los móviles (se guardan en el servidor, también sin conexión vía la cola)
export function putSettings(p) {
  S.settings = { ...p };
  applyPrefs(S.settings);
  S.queue.push({ method: 'PUT', path: '/v1/settings', body: S.settings });
  persist();
  flush();
}

export function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function setCurrent(id) { S.current = id; save('current', id); }

// ------------------------------------------------------------ cambios
// Guardar. Si el registro vino del servidor (tiene rev), se envía esa revisión como base_rev: si otro móvil lo cambió
// mientras tanto, el servidor no lo pisa y responde 409 → queda en S.conflicts para que la persona elija.
export function put(kind, rec) {
  const list = S[kind], i = list.findIndex((x) => x.id === rec.id);
  if (i >= 0) list[i] = rec; else list.unshift(rec);
  const { rev, ...body } = rec;
  enqueue('PUT', kind, rec.id, rev ? { ...body, base_rev: rev } : body);
}

// Muchos de una vez (importar): se guarda en el móvil una sola vez en lugar de tras cada registro
export function putMany(kind, recs) {
  if (!recs.length) return;
  const byId = new Map(S[kind].map((x, i) => [x.id, i]));
  for (const rec of recs) {
    const { rev, ...body } = rec; // importado: se guarda tal cual (sin comprobar revisiones de otra instalación)
    if (byId.has(rec.id)) S[kind][byId.get(rec.id)] = body; else S[kind].unshift(body);
    S.queue.push({ method: 'PUT', path: '/v1/' + kind + '/' + encodeURIComponent(rec.id), body });
  }
  persist();
  flush();
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
    const [, kind, id] = op.path.match(/^\/v1\/(\w+)\/(.+)$/) || [];
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.rev && kind && S[kind]) {
      // Revisión nueva: para el registro local y para los cambios suyos que sigan en la cola (editado dos veces sin
      // conexión: el segundo cambio parte del primero, no es un conflicto)
      const rec = S[kind].find((x) => x.id === decodeURIComponent(id));
      if (rec) rec.rev = d.rev;
      for (const o of S.queue.slice(1)) if (o.path === op.path && o.body && 'base_rev' in o.body) o.body.base_rev = d.rev;
    } else if (r.status === 409 && d.code === 'conflict') {
      const { base_rev, ...mine } = op.body;
      S.conflicts = [...S.conflicts.filter((c) => !(c.kind === kind && c.id === mine.id)), { kind, id: mine.id, mine, theirs: d.current }];
    } else if (!r.ok) console.warn('[sync] descartado ' + op.method + ' ' + op.path + ': ' + JSON.stringify(d));
    S.queue.shift(); // hecho, en conflicto, o 4xx (dato no válido): fuera de la cola
    persist();
  }
  if (S.conflicts.length) pull(); // lo de los demás móviles, para ver los dos lados
}

// Resolver un conflicto: quedarse con lo de este móvil (se guarda encima de lo del otro) o con lo del otro
export function resolveConflict(c, keepMine) {
  S.conflicts = S.conflicts.filter((x) => x !== c);
  if (keepMine) put(c.kind, c.theirs ? { ...c.mine, rev: c.theirs.rev } : c.mine); // borrado en el otro: se vuelve a crear
  else {
    const list = S[c.kind], i = list.findIndex((x) => x.id === c.id);
    if (c.theirs) { if (i >= 0) list[i] = c.theirs; else list.unshift(c.theirs); } else if (i >= 0) list.splice(i, 1);
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
    S.settings = d.settings || null;
    applyPrefs(S.settings);
    if (!S.vehicles.some((v) => v.id === S.current)) S.current = S.vehicles[0] ? S.vehicles[0].id : '';
    persist();
  } catch (e) { /* sin red: seguimos con lo local */ }
}

// ------------------------------------------------------------ adjuntos
// Subir necesita red (un fichero no cabe en la cola). Las fotos se reducen antes: ~2000 px en JPEG.
export async function upload(file, meta) {
  if (DEMO) throw new Error(t('files.demo'));
  const blob = file.type.startsWith('image/') ? await shrink(file) : file;
  const name = blob === file ? file.name : file.name.replace(/\.\w+$/, '') + '.jpg';
  const fd = new FormData();
  for (const [k, v] of Object.entries({ id: newId(), ...meta })) fd.append(k, v);
  fd.append('file', blob, name);
  const h = {}, token = load('token', '');
  if (token) h.Authorization = 'Bearer ' + token;
  let r;
  try { r = await fetch('/v1/files', { method: 'POST', headers: h, body: fd }); } catch (e) { S.online = false; throw new Error(t('files.offline')); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.code && t('err.' + d.code) !== 'err.' + d.code ? t('err.' + d.code) : d.error) || t('files.failed', { status: r.status }));
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

// Restaurar una copia con fotos (ZIP de /v1/backup): la fusiona el servidor (añade lo que falta, no pisa nada).
// Necesita red. → { added: { vehicles, fuel, expenses, reminders, files }, skipped, invalid }
export async function restoreBackup(file, withSettings, { reload = true } = {}) {
  if (DEMO) throw new Error(t('files.demo'));
  const h = { 'Content-Type': 'application/zip' }, token = load('token', '');
  if (token) h.Authorization = 'Bearer ' + token;
  let r;
  try { r = await fetch('/v1/restore' + (withSettings ? '?settings=1' : ''), { method: 'POST', headers: h, body: file }); } catch (e) { S.online = false; throw new Error(t('files.offline')); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.code && t('err.' + d.code) !== 'err.' + d.code ? t('err.' + d.code) : d.error) || t('files.failed', { status: r.status }));
  if (reload) await pull();
  return d;
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
