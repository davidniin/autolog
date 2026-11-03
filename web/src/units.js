// Unidades y moneda de la instalación (las comparten todos los móviles: se guardan en el servidor, ver store.js).
// Los datos se guardan SIEMPRE en km, litros y L/100 km; aquí solo se convierten para verlos y escribirlos.
// La moneda no se convierte: es la de los importes que se apuntan.
import { reactive } from 'vue';
import { locale } from './i18n/index.js';

export const KM_PER_MI = 1.609344;
const L_PER = { l: 1, gal_us: 3.785411784, gal_uk: 4.54609 };
const MPG = { mpg_us: 235.214583, mpg_uk: 282.480936 }; // mpg = constante / (L/100 km)

export const UNIT_OPTIONS = {
  distance: ['km', 'mi'],
  volume: ['l', 'gal_us', 'gal_uk'],
  consumption: ['l100', 'kml', 'mpg_us', 'mpg_uk'],
};
// Combinaciones típicas para elegir de un toque
export const PRESETS = [
  ['metric', { distance: 'km', volume: 'l', consumption: 'l100' }],
  ['kml', { distance: 'km', volume: 'l', consumption: 'kml' }],
  ['us', { distance: 'mi', volume: 'gal_us', consumption: 'mpg_us' }],
  ['uk', { distance: 'mi', volume: 'l', consumption: 'mpg_uk' }],
];
// Monedas que salen primero en la lista (el resto, todas las ISO 4217 que conozca el navegador)
export const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN', 'ARS', 'COP', 'CLP', 'PEN', 'CHF', 'CAD', 'AUD', 'BRL'];

// Sin ajustes guardados todavía: los típicos del país del móvil
const REGION = {
  US: ['us', 'USD'], GB: ['uk', 'GBP'], MX: ['kml', 'MXN'], CO: ['kml', 'COP'], AR: ['metric', 'ARS'],
  CL: ['metric', 'CLP'], PE: ['kml', 'PEN'], CA: ['metric', 'CAD'], AU: ['metric', 'AUD'], CH: ['metric', 'CHF'], BR: ['kml', 'BRL'],
};
export function defaultPrefs(lang = typeof navigator !== 'undefined' ? navigator.language || '' : '') {
  const region = (String(lang).split('-')[1] || '').toUpperCase();
  const [preset, currency] = REGION[region] || ['metric', 'EUR'];
  return { ...PRESETS.find((p) => p[0] === preset)[1], currency };
}

export const UP = reactive(defaultPrefs());
export function applyPrefs(p) { Object.assign(UP, defaultPrefs(), p || {}); }

// ------------------------------------------------------------ conversiones (guardado ⇄ pantalla)
export const conv = {
  dist: (km) => (UP.distance === 'mi' ? km / KM_PER_MI : km),
  distIn: (v) => (UP.distance === 'mi' ? v * KM_PER_MI : v),
  vol: (l) => l / L_PER[UP.volume],
  volIn: (v) => v * L_PER[UP.volume],
  // L/100 km → la unidad elegida (en km/L y mpg, más es mejor)
  cons: (l100) => (l100 == null || !(l100 > 0) ? null : UP.consumption === 'l100' ? l100 : UP.consumption === 'kml' ? 100 / l100 : MPG[UP.consumption] / l100),
  perVol: (perL) => perL * L_PER[UP.volume], // precio por litro → por la unidad de volumen
  perDist: (perKm) => (UP.distance === 'mi' ? perKm * KM_PER_MI : perKm), // coste por km → por milla
};

// Para los campos de formularios.js: unit 'km' = distancia, 'L' = volumen, '€' = moneda, 'kWh' = energía (sin conversión)
export function toDisplay(unit, v) {
  if (v == null || Number.isNaN(v)) return v;
  return unit === 'km' ? conv.dist(v) : unit === 'L' ? conv.vol(v) : v;
}
export function fromDisplay(unit, v) {
  if (v == null || Number.isNaN(v)) return v;
  return unit === 'km' ? conv.distIn(v) : unit === 'L' ? conv.volIn(v) : v;
}

// ------------------------------------------------------------ etiquetas
export const distUnit = () => UP.distance; // 'km' | 'mi'
export const volUnit = () => (UP.volume === 'l' ? 'L' : 'gal');
export const consUnit = () => ({ l100: 'L/100 km', kml: 'km/L', mpg_us: 'mpg', mpg_uk: 'mpg' })[UP.consumption];
// Electricidad: kWh/100 km (se guarda así) o mi/kWh si la distancia va en millas (lo habitual en EE. UU. y R. Unido)
export const econs = (kwh100) => (kwh100 == null || !(kwh100 > 0) ? null : UP.distance === 'mi' ? 100 / (kwh100 * KM_PER_MI) : kwh100);
export const econsUnit = () => (UP.distance === 'mi' ? 'mi/kWh' : 'kWh/100 km');
export function currencySymbol(code = UP.currency) {
  try {
    const part = new Intl.NumberFormat(locale(), { style: 'currency', currency: code }).formatToParts(0).find((x) => x.type === 'currency');
    return part ? part.value : code;
  } catch (e) { return code; }
}

// Todas las monedas ISO 4217 que conozca el navegador, con las habituales primero: [[código, "Euro (€)"], ...]
export function currencyList(lang, current = UP.currency) {
  let all = [];
  try { all = Intl.supportedValuesOf('currency'); } catch (e) { all = []; }
  const list = [...COMMON_CURRENCIES, ...all.filter((c) => !COMMON_CURRENCIES.includes(c))];
  if (!list.includes(current)) list.unshift(current);
  let names = null;
  try { names = new Intl.DisplayNames([lang], { type: 'currency' }); } catch (e) { /* navegador antiguo */ }
  return list.map((c) => [c, (names ? names.of(c) : c) + ' (' + currencySymbol(c) + ')']);
}

// ¿Tiene sentido comprobar si el €/L "es creíble"? Solo en monedas con precios parecidos al euro.
const REALISTIC = new Set(['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD']);
export const realisticCurrency = () => REALISTIC.has(UP.currency);
