// Idiomas de la interfaz (sin dependencias). Uso: t('summary.avg') o t('fuel.totals', { n: 3 }).
// Los textos están en es.js y en.js con las mismas claves. Un texto puede ser una cadena con {param}
// o una función (p) => '...' para plurales y concordancias. Si falta en un idioma, se usa el español.
// Para añadir un idioma: copia en.js, tradúcelo, impórtalo aquí y añádelo a LANGS.
import { reactive } from 'vue';
import es from './es.js';
import en from './en.js';

const DICTS = { es, en };
export const LANGS = [['es', 'Español'], ['en', 'English']];
const KEY = 'autolog.lang';

function initial() {
  try { const s = localStorage.getItem(KEY); if (DICTS[s]) return s; } catch (e) { /* sin almacenamiento */ }
  const nav = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
  for (const l of nav) { const k = String(l || '').slice(0, 2).toLowerCase(); if (DICTS[k]) return k; }
  return 'en';
}

export const L = reactive({ lang: initial() });
if (typeof document !== 'undefined') document.documentElement.lang = L.lang;

export function setLang(lang) {
  if (!DICTS[lang]) return;
  L.lang = lang;
  try { localStorage.setItem(KEY, lang); } catch (e) { /* sin almacenamiento */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

const get = (d, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), d);

export function t(key, p) {
  let s = get(DICTS[L.lang], key);
  if (s == null) s = get(es, key);
  if (s == null) return key;
  if (typeof s === 'function') return s(p || {});
  return p ? s.replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? '')) : s;
}

// Locale para fechas y números: el del navegador si es del mismo idioma (en-GB, es-MX...), si no uno por defecto
export function locale() {
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  if (nav.slice(0, 2).toLowerCase() === L.lang) return nav;
  return L.lang === 'es' ? 'es-ES' : 'en-US';
}

export { plural } from './plural.js';
// "a, b y c" / "a, b and c"
export function list(items) {
  if (items.length < 2) return items[0] || '';
  return items.slice(0, -1).join(', ') + ' ' + t('common.and') + ' ' + items[items.length - 1];
}
