// API de AutoLog (/v1) + la web del móvil compilada. Ver README.md.
//   GET    /v1/data                → { vehicles, fuel, expenses, reminders, files, settings }
//   PUT    /v1/settings            → unidades y moneda de la instalación (settings.js)
//   GET    /v1/backup              → copia completa con fotos (ZIP)   POST /v1/restore → la restaura (fusiona)
//   GET    /v1/calendar.ics?key=   → avisos como calendario (clave propia, solo lectura)   GET|POST /v1/calendar[/reset]
//   GET    /v1/me                  → quién soy   GET|POST /v1/users, DELETE /v1/users/:id → personas (solo el propietario)
//   PUT    /v1/:coleccion/:id      → crea o actualiza (coleccion = vehicles | fuel | expenses | reminders | parts);
//                                     con base_rev, 409 si otro móvil lo cambió antes (db.js, upsert)
//   DELETE /v1/:coleccion/:id      → borra (borrar un vehículo borra todo lo suyo)
//   POST   /v1/files               → sube un adjunto (multipart)   GET/DELETE /v1/files/:id
//   GET    /v1/alerts              → avisos pendientes (pronto / vencido) de todos los vehículos
//   /v1/push/...                   → notificaciones push (key, subscribe, unsubscribe, test, check)
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { CONFIG } from './config.js';
import { sql, migrate, TABLES, clean, upsert, remove, readAll } from './db.js';
import { MAX_BYTES, initFiles, saveFile, readFile, removeFiles } from './files.js';
import { auth, ownerOnly, checkStartup, CSP } from './security.js';
import { createUser, listUsers, deleteUser } from './users.js';
import { cleanLang } from './messages.js';
import { getPrefs, setPrefs, cleanPrefs } from './settings.js';
import { backupStream, restoreStream } from './backup.js';
import { calendarKey, checkCalendarKey, calendarICS } from './calendar.js';
import { alerts, initPush, vapidKey, subscribe, unsubscribe, sendTest, check } from './alerts.js';

const VERSION = '0.4.0';
const startupError = checkStartup();
if (startupError) {
  console.error('[autolog] ' + startupError);
  process.exit(1);
}

const app = new Hono();
// Cabeceras de seguridad en todo (nosniff, no-referrer, sin iframes de otros sitios...) y CSP en la web
app.use('*', secureHeaders({ contentSecurityPolicy: undefined, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: 'same-origin' }));
const api = new Hono();
// La web y la API van en el mismo origen: CORS solo si se pide (CORS_ORIGIN)
if (CONFIG.corsOrigin) api.use('*', cors({ origin: CONFIG.corsOrigin.split(',').map((s) => s.trim()) }));
// Clave + límite de intentos: ver security.js
api.use('*', auth());
api.onError((e, c) => {
  console.error('[api] ' + c.req.method + ' ' + c.req.path + ': ' + e.message);
  return c.json({ error: 'internal server error', code: 'internal' }, 500); // el detalle va al log, no al cliente
});

api.get('/health', async (c) => {
  try { await sql`select 1`; return c.json({ ok: true, version: VERSION, db: true, auth: !!CONFIG.token }); }
  catch (e) { return c.json({ ok: false, version: VERSION, db: false, error: e.message }, 503); }
});

api.get('/data', async (c) => c.json({ ...(await readAll()), settings: await getPrefs() }));

// Units and currency of the installation (shared by every phone)
api.put('/settings', async (c) => {
  let b;
  try { b = await c.req.json(); } catch (e) { return c.json({ error: 'invalid JSON', code: 'bad_input' }, 400); }
  const { prefs, error, code } = cleanPrefs(b);
  if (error) return c.json({ error, code }, 400);
  await setPrefs(prefs);
  return c.json({ ok: true });
});

// ------------------------------------------------------------ avisos y push
api.get('/alerts', async (c) => c.json((await alerts(cleanLang(c.req.query('lang') || 'es'))).map(({ stamp, score, ...a }) => a)));
api.get('/push/key', (c) => c.json({ key: vapidKey() }));
api.post('/push/subscribe', async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!(await subscribe(b))) return c.json({ error: 'invalid subscription', code: 'bad_input' }, 400);
  return c.json({ ok: true });
});
api.post('/push/unsubscribe', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  await unsubscribe(b.endpoint);
  return c.json({ ok: true });
});
api.post('/push/test', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  return (await sendTest(b.endpoint)) ? c.json({ ok: true }) : c.json({ error: 'could not send', code: 'push_failed' }, 400);
});
// Revisar ahora (sin esperar a la revisión diaria). No repite lo ya avisado.
api.post('/push/check', async (c) => c.json({ sent: await check() }));

// ------------------------------------------------------------ quién soy y personas con acceso (users.js)
api.get('/me', (c) => c.json(c.get('user')));
api.get('/users', ownerOnly(), async (c) => c.json(await listUsers()));
api.post('/users', ownerOnly(), async (c) => {
  let b;
  try { b = await c.req.json(); } catch (e) { return c.json({ error: 'invalid JSON', code: 'bad_input' }, 400); }
  const r = await createUser(b.name);
  return r.error ? c.json(r, 400) : c.json(r, 201);
});
api.delete('/users/:id', ownerOnly(), async (c) => c.json({ ok: await deleteUser(c.req.param('id')) }));

// ------------------------------------------------------------ calendario de avisos (calendar.js)
api.get('/calendar', async (c) => c.json({ key: await calendarKey() }));
api.post('/calendar/reset', ownerOnly(), async (c) => c.json({ key: await calendarKey(true) }));
api.get('/calendar.ics', async (c) => {
  if (!(await checkCalendarKey(c.req.query('key')))) return c.json({ error: 'not found', code: 'not_found' }, 404);
  const lang = cleanLang(c.req.query('lang') || 'es');
  return c.body(await calendarICS(lang), 200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="autolog.ics"',
    'Cache-Control': 'no-cache',
  });
});

// ------------------------------------------------------------ copia completa con fotos (backup.js)
api.get('/backup', async (c) => {
  const day = new Date().toLocaleDateString('sv-SE');
  return new Response(await backupStream(), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="autolog-backup-' + day + '.zip"',
      'Cache-Control': 'no-store',
    },
  });
});
api.post('/restore', ownerOnly(), bodyLimit({ maxSize: CONFIG.restoreMaxMb * 1024 * 1024, onError: (c) => c.json({ error: 'backup too big', code: 'backup_too_big' }, 413) }), async (c) => {
  if (!c.req.raw.body) return c.json({ error: 'missing body', code: 'bad_input' }, 400);
  try {
    return c.json(await restoreStream(c.req.raw.body, { withSettings: c.req.query('settings') === '1' }));
  } catch (e) {
    if (e.code === 'not_backup' || /zip|entry too big|invalid/i.test(e.message)) return c.json({ error: e.message, code: 'not_backup' }, 400);
    throw e;
  }
});

// ------------------------------------------------------------ adjuntos
api.post('/files', bodyLimit({ maxSize: MAX_BYTES + 1024 * 1024, onError: (c) => c.json({ error: 'max 15 MB', code: 'file_too_big' }, 413) }), async (c) => {
  const { rec, error, code } = await saveFile(await c.req.parseBody());
  if (error) return c.json({ error, code }, 400);
  return c.json(rec, 201);
});
api.get('/files/:id', async (c) => {
  const f = await readFile(c.req.param('id'));
  if (!f) return c.json({ error: 'not found', code: 'not_found' }, 404);
  return c.body(f.data, 200, {
    'Content-Type': f.rec.mime,
    'Content-Disposition': "inline; filename*=UTF-8''" + encodeURIComponent(f.rec.name),
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
});
api.delete('/files/:id', async (c) => {
  await removeFiles({ id: c.req.param('id') });
  return c.json({ ok: true });
});

// ------------------------------------------------------------ colecciones
api.put('/:kind/:id', async (c) => {
  const kind = c.req.param('kind');
  if (!TABLES[kind]) return c.json({ error: 'not found', code: 'not_found' }, 404);
  let b;
  try { b = await c.req.json(); } catch (e) { return c.json({ error: 'invalid JSON', code: 'bad_input' }, 400); }
  const { rec, error, code } = clean(kind, { ...b, id: c.req.param('id') });
  if (error) return c.json({ error, code }, 400);
  // base_rev: la revisión que tenía el móvil al editar (ver upsert en db.js). Si alguien lo cambió antes → 409.
  const base = typeof b.base_rev === 'string' && b.base_rev ? b.base_rev : null;
  let res;
  try {
    res = await upsert(kind, rec, base, c.get('user').name);
  } catch (e) {
    if (e.code === '23503') return c.json({ error: 'vehicle not found', code: 'no_vehicle' }, 400);
    throw e;
  }
  if (res.conflict) return c.json({ error: 'changed on another device', code: 'conflict', current: res.current }, 409);
  return c.json({ ok: true, rev: res.rev });
});

// Borrar algo que ya no existe no es error: el móvil puede reenviar el borrado tras un corte
api.delete('/:kind/:id', async (c) => {
  const kind = c.req.param('kind');
  if (!TABLES[kind]) return c.json({ error: 'not found', code: 'not_found' }, 404);
  const id = c.req.param('id');
  await removeFiles(kind === 'vehicles' ? { vehicle_id: id } : { parent_kind: kind, parent_id: id });
  await remove(kind, id);
  return c.json({ ok: true });
});

app.route('/v1', api);

// ------------------------------------------------------------ web (PWA)
if (CONFIG.staticDir) {
  const root = CONFIG.staticDir;
  // Los ficheros de assets/ llevan hash en el nombre: caché larga. El resto (index, sw.js, manifest) siempre fresco.
  app.use('/*', serveStatic({
    root,
    onFound: (p, c) => {
      c.header('Cache-Control', p.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
      if (p.endsWith('.html')) c.header('Content-Security-Policy', CSP);
    },
  }));
  app.get('*', serveStatic({
    root, path: 'index.html',
    onFound: (p, c) => { c.header('Cache-Control', 'no-cache'); c.header('Content-Security-Policy', CSP); },
  }));
}

await migrate();
await initFiles();
await initPush();
serve({ fetch: app.fetch, port: CONFIG.port }, () => {
  console.log('autolog ' + VERSION + ' on :' + CONFIG.port + ' · password ' + (CONFIG.token ? 'yes' : 'NO (ALLOW_NO_AUTH)') + ' · proxy ' + (CONFIG.trustProxy ? 'yes' : 'no') +
    ' · web ' + (CONFIG.staticDir || 'no') + ' · files ' + CONFIG.filesDir);
});
