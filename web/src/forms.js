// Formularios (vehículo, repostaje, gasto, recordatorio, "hecho"): los pinta FormSheet.vue.
// Tipos de campo: text, num (admite coma decimal), date, chips (opciones de OPTIONS), check.
// label / ph son claves de traducción (i18n/es.js, en.js → "f.*"). unit = unidad dentro del campo (ver unitLabel).
// Reglas de validación por campo (req, len, int, dec, pos, min, max, check...): ver validate.js.
// files: true = admite adjuntos. scan: true = botón para escanear la factura/ticket y rellenar los campos.
// Ganchos opcionales: hint(m) texto de ayuda, prepare(r, ctx) completa el registro, validate(r, ctx) → error.
// ctx = { others: demás registros del vehículo, km: km actuales }.
import { fmt, num, today, addMonths } from './calc.js';
import { t } from './i18n/index.js';
import { distUnit, volUnit, currencySymbol, fromDisplay, realisticCurrency, UP } from './units.js';

// Opciones de los campos "chips": [valor guardado, emoji]. El texto sale de i18n (opt.<grupo>.<valor>).
// Los valores se guardan en la base de datos: no se cambian aunque el texto se traduzca.
export const OPTIONS = {
  kind: [['coche', '🚗'], ['moto', '🏍️']],
  fuel: [['gasolina', ''], ['diesel', ''], ['glp', '']],
  cat: [
    ['revision', '🔧'], ['reparacion', '🛠️'], ['itv', '📋'], ['seguro', '🛡️'],
    ['impuestos', '🏛️'], ['aparcamiento', '🅿️'], ['peajes', '🛣️'], ['otros', '📦'],
  ],
};
const EMOJI = { cat: { fuel: '⛽' } };
export const optText = (group, v) => t('opt.' + group + '.' + v);
export const optEmoji = (group, v) => ((OPTIONS[group] || []).find((o) => o[0] === v) || [])[1] || (EMOJI[group] || {})[v] || '';
export const optLabel = (group, v) => [optEmoji(group, v), optText(group, v)].filter(Boolean).join(' ');

// Unidad que se ve dentro del campo: 'km' = distancia, 'L' = volumen, '€' = moneda (las elegidas en Ajustes)
export const unitLabel = (u) => (u === 'months' ? t('f.months') : u === 'km' ? distUnit() : u === 'L' ? volUnit() : u === '€' ? currencySymbol() : u);
// Parámetros de las etiquetas que dependen de las unidades ("Km actuales" / "Millas actuales")
export const labelParams = () => ({ d: UP.distance, v: UP.volume });

// Límites razonables (evitan errores al teclear, p. ej. un cero de más)
const MAX_KM = 2000000;
// Importes máximos y €/L creíble: solo en monedas con precios parecidos al euro (en otras, el tope del servidor)
const MAX_EUR = () => (realisticCurrency() ? 1000000 : 1e8);
const MAX_FILL = () => (realisticCurrency() ? 2000 : 1e8);
const PPL = [0.3, 5]; // precio por litro creíble en EUR, USD, GBP...
const NOTE = { k: 'note', label: 'f.note', type: 'text', len: 500 };
const SINCE = '1950-01-01';

export const FORMS = {
  vehicles: {
    files: true, // documentación: permiso de circulación, ficha técnica, póliza...
    fields: [
      { k: 'name', label: 'f.name', type: 'text', req: true, len: 40, ph: 'f.namePh' },
      { k: 'kind', label: 'f.kind', type: 'chips', options: 'kind' },
      {
        k: 'plate', label: 'f.plate', type: 'text', half: true, ph: 'f.platePh', len: 12, upper: true,
        pattern: /^[A-Z0-9][A-Z0-9 -]*[A-Z0-9]$/, patternMsg: 'f.plateFormat',
      },
      { k: 'start_km', label: 'f.startKm', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      { k: 'fuel_type', label: 'f.fuelType', type: 'chips', options: 'fuel' },
      { k: 'purchase_price', label: 'f.purchasePrice', type: 'num', half: true, ph: 'f.optional', dec: 2, max: MAX_EUR, unit: '€' },
      { k: 'purchase_date', label: 'f.purchaseDate', type: 'date', half: true, min: SINCE, max: 'today' },
      { ...NOTE, ph: 'f.vehNotePh' },
    ],
    blank: () => ({ name: '', kind: 'coche', plate: '', fuel_type: 'gasolina', start_km: null, purchase_price: null, purchase_date: null, note: '' }),
  },
  fuel: {
    files: true, // ticket de la gasolinera
    scan: true, // escanear el ticket (ReceiptScan.vue)
    fields: [
      { k: 'date', label: 'f.date', type: 'date', req: true, half: true, min: SINCE, max: 'today' },
      {
        k: 'km', label: 'f.odometer', type: 'num', int: true, req: true, half: true, pos: true, max: MAX_KM, unit: 'km',
        // Los km tienen que cuadrar con los repostajes de antes y de después
        check: (v, r, { others }) => {
          if (!r.date) return '';
          const before = others.filter((f) => f.date <= r.date).map((f) => f.km);
          const after = others.filter((f) => f.date > r.date).map((f) => f.km);
          const lo = before.length ? Math.max(...before) : null, hi = after.length ? Math.min(...after) : null;
          if (lo != null && v < lo) return t('f.kmBelow', { km: fmt.km(lo) });
          if (hi != null && v > hi) return t('f.kmAbove', { km: fmt.km(hi) });
          return '';
        },
      },
      { k: 'liters', label: 'f.liters', type: 'num', req: true, half: true, pos: true, dec: 3, max: 200, unit: 'L' },
      {
        k: 'total', label: 'f.total', type: 'num', req: true, half: true, pos: true, dec: 2, max: MAX_FILL, unit: '€',
        check: (v, r) => {
          if (!(r.liters > 0) || !realisticCurrency()) return '';
          const p = v / r.liters;
          return p < PPL[0] || p > PPL[1] ? t('f.pplOff', { ppl: fmt.ppl(p) }) : '';
        },
      },
      { k: 'full_tank', label: 'f.fullTank', type: 'check' },
      { k: 'station', label: 'f.station', type: 'text', ph: 'f.optional', len: 60 },
      NOTE,
    ],
    blank: (vid) => ({ vehicle_id: vid, date: today(), km: null, liters: null, total: null, full_tank: true, station: '', note: '' }),
    hint: (m) => {
      const l = fromDisplay('L', num(m.liters)), tot = num(m.total);
      return l > 0 && tot > 0 ? t('f.priceHint', { ppl: fmt.ppl(tot / l) }) : '';
    },
  },
  expenses: {
    files: true, // facturas y tickets
    scan: true, // escanear la factura (ReceiptScan.vue)
    fields: [
      { k: 'cat', label: 'f.cat', type: 'chips', options: 'cat' },
      { k: 'title', label: 'f.title', type: 'text', ph: 'f.titlePh', len: 80 },
      { k: 'amount', label: 'f.amount', type: 'num', req: true, half: true, pos: true, dec: 2, max: MAX_EUR, unit: '€' },
      { k: 'date', label: 'f.date', type: 'date', req: true, half: true, min: SINCE, max: 'today' },
      { k: 'km', label: 'f.kmOptional', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      { ...NOTE, ph: 'f.expNotePh' },
    ],
    blank: (vid) => ({ vehicle_id: vid, date: today(), km: null, cat: 'revision', title: '', amount: null, note: '' }),
  },
  reminders: {
    // Plantillas: [clave en i18n "presets.*", valores]. El texto del botón y el título salen del idioma actual.
    presets: [
      ['oil', { cat: 'revision', every_km: 15000, every_months: 12 }],
      ['service', { cat: 'revision', every_km: 30000, every_months: 24 }],
      ['itv', { cat: 'itv', every_km: null, every_months: 12 }],
      ['insurance', { cat: 'seguro', every_km: null, every_months: 12 }],
      ['tax', { cat: 'impuestos', every_km: null, every_months: 12 }],
      ['tyres', { cat: 'revision', every_km: 40000, every_months: null }],
    ],
    fields: [
      { k: 'title', label: 'f.remTitle', type: 'text', req: true, ph: 'f.remTitlePh', len: 80 },
      { k: 'cat', label: 'f.remCat', type: 'chips', options: 'cat' },
      { k: 'every_km', label: 'f.everyKm', type: 'num', int: true, half: true, ph: '15000', min: 100, max: 500000, unit: 'km' },
      { k: 'every_months', label: 'f.everyMonths', type: 'num', int: true, half: true, ph: '12', min: 1, max: 240, unit: 'months' },
      { k: 'due_date', label: 'f.dueDate', type: 'date', half: true, min: '2000-01-01', max: '2100-12-31' },
      { k: 'due_km', label: 'f.dueKm', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      NOTE,
    ],
    note: 'f.remNote',
    blank: (vid) => ({ vehicle_id: vid, title: '', cat: 'revision', every_km: null, every_months: null, due_date: null, due_km: null, note: '' }),
    prepare: (r, { km }) => {
      if (!r.due_date && r.every_months) r.due_date = addMonths(today(), r.every_months);
      if (r.due_km == null && r.every_km) r.due_km = km + r.every_km;
    },
    validate: (r) => (r.due_date || r.due_km != null ? '' : t('f.remNeedsDue')),
  },
  // Marcar un recordatorio como hecho: si hay importe se apunta como gasto, y si se repite se programa el siguiente
  done: {
    fields: [
      { k: 'date', label: 'f.date', type: 'date', req: true, half: true, min: SINCE, max: 'today' },
      { k: 'km', label: 'f.km', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      { k: 'amount', label: 'f.doneAmount', type: 'num', dec: 2, max: MAX_EUR, unit: '€' },
    ],
    blank: (km) => ({ date: today(), km, amount: null }),
  },
};

// Plantilla de aviso en el idioma actual: [texto del botón, valores con el título]
export function preset([key, values]) {
  const [btn, title] = t('presets.' + key);
  return [btn, { ...values, title }];
}
