// Server unit tests (no database needed): input cleaning and auth rules. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { CONFIG } from '../src/config.js';
import { clean } from '../src/db.js';
import { checkStartup, auth } from '../src/security.js';
import { cleanPrefs } from '../src/settings.js';
import { MESSAGES } from '../src/messages.js';

test('clean() keeps known fields with the right type', () => {
  const { rec } = clean('fuel', { id: 'f1', vehicle_id: 'v1', date: '2024-01-02', km: '1000.4', liters: '40.1234', total: 60, full_tank: 1, hacker: 'x' });
  assert.deepEqual(rec, { id: 'f1', vehicle_id: 'v1', date: '2024-01-02', km: 1000, liters: 40.123, total: 60, full_tank: true, station: '', note: '' });
});

test('clean() rejects bad input', () => {
  assert.match(clean('fuel', { id: 'f1', vehicle_id: 'v1', date: 'ayer', km: 1, liters: 1, total: 1 }).error, /invalid date/);
  assert.match(clean('fuel', { id: 'f1', vehicle_id: 'v1', date: '2024-01-02', km: -1, liters: 1, total: 1 }).error, /invalid number/);
  assert.match(clean('vehicles', { id: 'v1', name: '   ' }).error, /missing name/);
  assert.match(clean('vehicles', { name: 'x' }).error, /missing id/);
});

test('startup requires a long enough token unless ALLOW_NO_AUTH', () => {
  const saved = { ...CONFIG };
  Object.assign(CONFIG, { token: '', allowNoAuth: false });
  assert.match(checkStartup(), /AUTOLOG_TOKEN is missing/);
  Object.assign(CONFIG, { token: 'short' });
  assert.match(checkStartup(), /too short/);
  Object.assign(CONFIG, { token: 'x'.repeat(24) });
  assert.equal(checkStartup(), '');
  Object.assign(CONFIG, { token: '', allowNoAuth: true });
  assert.equal(checkStartup(), '');
  Object.assign(CONFIG, saved);
});

test('auth: bearer header, files cookie, lock-out after repeated failures', async () => {
  const saved = { ...CONFIG };
  Object.assign(CONFIG, { token: 'right-token-0123456789', trustProxy: true });
  const app = new Hono();
  app.use('*', auth());
  app.get('/v1/data', (c) => c.text('ok'));
  app.get('/v1/files/:id', (c) => c.text('file'));
  app.get('/v1/health', (c) => c.text('up'));
  const req = (path, headers = {}) => app.request(path, { headers: { 'x-forwarded-for': headers.ip || '1.1.1.1', ...headers } });

  assert.equal((await req('/v1/health')).status, 200);
  assert.equal((await req('/v1/data')).status, 401);
  assert.equal((await req('/v1/data', { authorization: 'Bearer right-token-0123456789' })).status, 200);
  assert.equal((await req('/v1/files/a', { cookie: 'autolog_token=right-token-0123456789' })).status, 200);
  assert.equal((await req('/v1/data', { cookie: 'autolog_token=right-token-0123456789' })).status, 401); // cookie only for files
  assert.equal((await req('/v1/files/a?token=right-token-0123456789')).status, 401); // no tokens in URLs

  for (let i = 0; i < 10; i++) await req('/v1/data', { ip: '6.6.6.6', authorization: 'Bearer wrong' });
  assert.equal((await req('/v1/data', { ip: '6.6.6.6', authorization: 'Bearer right-token-0123456789' })).status, 429);
  assert.equal((await req('/v1/data', { ip: '7.7.7.7', authorization: 'Bearer right-token-0123456789' })).status, 200);
  Object.assign(CONFIG, saved);
});

test('cleanPrefs() accepts known units and an ISO currency', () => {
  assert.deepEqual(cleanPrefs({ distance: 'mi', volume: 'gal_us', consumption: 'mpg_us', currency: 'usd', x: 1 }).prefs,
    { distance: 'mi', volume: 'gal_us', consumption: 'mpg_us', currency: 'USD' });
  assert.equal(cleanPrefs({ distance: 'leagues', volume: 'l', consumption: 'l100', currency: 'EUR' }).code, 'bad_input');
  assert.equal(cleanPrefs({ distance: 'km', volume: 'l', consumption: 'l100', currency: 'EURO' }).code, 'bad_input');
});

test('push texts use the distance unit', () => {
  assert.equal(MESSAGES.en.left(MESSAGES.en.dist(1609.344, 'mi')), '1,000 mi to go');
  assert.equal(MESSAGES.es.left(MESSAGES.es.dist(15000, 'km')), 'faltan 15.000 km');
});
