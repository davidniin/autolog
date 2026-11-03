// API de AutoLog (/v1) + la web del móvil compilada. Ver README.md.
//   GET    /v1/data                → { vehicles, fuel, expenses, reminders }
//   PUT    /v1/:coleccion/:id      → crea o actualiza (coleccion = vehicles | fuel | expenses | reminders)
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
import { auth, checkStartup, CSP } from './security.js';
import { cleanLang } from './messages.js';
import { alerts, initPush, vapidKey, subscribe, unsubscribe, sendTest, check } from './alerts.js';

const VERSION = '0.1.0';
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

api.get('/data', async (c) => c.json(await readAll()));

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
  try {
    await upsert(kind, rec);
  } catch (e) {
    if (e.code === '23503') return c.json({ error: 'vehicle not found', code: 'no_vehicle' }, 400);
    throw e;
  }
  return c.json({ ok: true });
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
