// Installation-wide preferences (shared by every phone): units and currency.
// Data is always stored in km and litres; these only change how the app shows and asks for it.
// Language is per phone and is not stored here.
import { sql } from './db.js';

export const UNITS = {
  distance: ['km', 'mi'],
  volume: ['l', 'gal_us', 'gal_uk'],
  consumption: ['l100', 'kml', 'mpg_us', 'mpg_uk'],
};

export async function getSetting(key) {
  const [r] = await sql`select value from autolog_setting where key = ${key}`;
  return r ? r.value : null;
}
export function setSetting(key, value) {
  return sql`insert into autolog_setting (key, value) values (${key}, ${value}) on conflict (key) do update set value = excluded.value`;
}

// Only known keys and values; currency = ISO 4217 code (3 letters). Returns { prefs } or { error, code }.
export function cleanPrefs(b) {
  if (!b || typeof b !== 'object') return { error: 'invalid settings', code: 'bad_input' };
  const prefs = {};
  for (const [k, allowed] of Object.entries(UNITS)) {
    if (!allowed.includes(b[k])) return { error: k + ': invalid value', code: 'bad_input' };
    prefs[k] = b[k];
  }
  const cur = String(b.currency || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) return { error: 'currency: invalid code', code: 'bad_input' };
  prefs.currency = cur;
  return { prefs };
}

// null = not configured yet (the app proposes defaults from the phone's language)
export async function getPrefs() {
  const v = await getSetting('prefs');
  try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
export function setPrefs(prefs) { return setSetting('prefs', JSON.stringify(prefs)); }
