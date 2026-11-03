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
  fuel: [['gasolina', ''], ['diesel', ''], ['glp', ''], ['electrico', '⚡'], ['hibrido', '🔌']],
  energy: [['fuel', '⛽'], ['kwh', '⚡']],
  part: [['tyres', '🛞'], ['battery', '🔋'], ['pads', '🛑'], ['discs', '💿'], ['belt', '⚙️'], ['wipers', '🌧️'], ['oil', '🛢️'], ['other', '🔩']],
  cat: [
    ['revision', '🔧'], ['reparacion', '🛠️'], ['itv', '📋'], ['seguro', '🛡️'],
    ['impuestos', '🏛️'], ['aparcamiento', '🅿️'], ['peajes', '🛣️'], ['otros', '📦'],
  ],
};
const EMOJI = { cat: { fuel: '⛽', charge: '⚡', fuelAndCharge: '⛽' } };
export const optText = (group, v) => t('opt.' + group + '.' + v);
export const optEmoji = (group, v) => ((OPTIONS[group] || []).find((o) => o[0] === v) || [])[1] || (EMOJI[group] || {})[v] || '';
export const optLabel = (group, v) => [optEmoji(group, v), optText(group, v)].filter(Boolean).join(' ');

// unit 'Q' = la cantidad de un repostaje: litros (o galones) de combustible, o kWh si es una recarga eléctrica
export const fieldUnit = (f, rec = {}) => (f.unit === 'Q' ? (rec.energy === 'kwh' ? 'kWh' : 'L') : f.unit);
// Unidad que se ve dentro del campo: 'km' = distancia, 'L' = volumen, '€' = moneda (las elegidas en Ajustes)
export const unitLabel = (u) => (u === 'months' ? t('f.months') : u === 'km' ? distUnit() : u === 'L' ? volUnit() : u === '€' ? currencySymbol() : u);
// Parámetros de las etiquetas que dependen de las unidades ("Km actuales" / "Millas actuales")
export const labelParams = (rec = {}) => ({ d: UP.distance, v: UP.volume, e: rec.energy || 'fuel' });

// Límites razonables (evitan errores al teclear, p. ej. un cero de más)
const MAX_KM = 2000000;
// Importes máximos y €/L creíble: solo en monedas con precios parecidos al euro (en otras, el tope del servidor)
const MAX_EUR = () => (realisticCurrency() ? 1000000 : 1e8);
const MAX_FILL = () => (realisticCurrency() ? 2000 : 1e8);
const PPL = [0.3, 5]; // precio por litro creíble en EUR, USD, GBP...
const PPKWH = [0.02, 2]; // precio por kWh creíble (en casa, en la calle, en un supercargador)
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
      // Solo en híbridos enchufables (en un eléctrico siempre es kWh; en uno de combustible, litros): ver App.open
      { k: 'energy', label: 'f.energy', type: 'chips', options: 'energy', show: (m, ctx) => (ctx.energies || []).length > 1 },
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
      { k: 'liters', label: 'f.liters', type: 'num', req: true, half: true, pos: true, dec: 3, max: 200, unit: 'Q' },
      {
        k: 'total', label: 'f.total', type: 'num', req: true, half: true, pos: true, dec: 2, max: MAX_FILL, unit: '€',
        check: (v, r) => {
          if (!(r.liters > 0) || !realisticCurrency()) return '';
          const p = v / r.liters, kwh = r.energy === 'kwh', [lo, hi] = kwh ? PPKWH : PPL;
          return p < lo || p > hi ? t('f.pplOff', { ppl: kwh ? fmt.ppkwh(p) : fmt.ppl(p) }) : '';
        },
      },
      { k: 'full_tank', label: 'f.fullTank', type: 'check' },
      { k: 'station', label: 'f.station', type: 'text', ph: 'f.optional', len: 60 },
      NOTE,
    ],
    blank: (vid) => ({ vehicle_id: vid, date: today(), km: null, liters: null, total: null, full_tank: true, station: '', note: '', energy: 'fuel' }),
    hint: (m) => {
      const kwh = m.energy === 'kwh', q = kwh ? num(m.liters) : fromDisplay('L', num(m.liters)), tot = num(m.total);
      return q > 0 && tot > 0 ? t('f.priceHint', { ppl: kwh ? fmt.ppkwh(tot / q) : fmt.ppl(tot / q) }) : '';
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
  // Neumáticos y piezas. Plantillas con vidas típicas (orientativas: cada fabricante dice la suya).
  parts: {
    presets: [
      ['tyres', { kind: 'tyres', life_km: 40000, life_months: 60 }],
      ['battery', { kind: 'battery', life_km: null, life_months: 60 }],
      ['pads', { kind: 'pads', life_km: 40000, life_months: null }],
      ['discs', { kind: 'discs', life_km: 80000, life_months: null }],
      ['belt', { kind: 'belt', life_km: 120000, life_months: 72 }],
      ['wipers', { kind: 'wipers', life_km: null, life_months: 12 }],
    ],
    presetGroup: 'partPresets',
    fields: [
      { k: 'kind', label: 'f.partKind', type: 'chips', options: 'part' },
      { k: 'name', label: 'f.partName', type: 'text', ph: 'f.partNamePh', len: 80 },
      { k: 'position', label: 'f.position', type: 'text', ph: 'f.positionPh', len: 40 },
      { k: 'installed_date', label: 'f.installedDate', type: 'date', req: true, half: true, min: SINCE, max: 'today' },
      { k: 'installed_km', label: 'f.installedKm', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      { k: 'life_km', label: 'f.lifeKm', type: 'num', int: true, half: true, ph: '40000', min: 100, max: 1000000, unit: 'km' },
      { k: 'life_months', label: 'f.lifeMonths', type: 'num', int: true, half: true, ph: '60', min: 1, max: 360, unit: 'months' },
      NOTE,
    ],
    note: 'f.partNote',
    blank: (vid, km) => ({ vehicle_id: vid, kind: 'tyres', name: '', position: '', installed_date: today(), installed_km: km || null, life_km: null, life_months: null, removed_date: null, removed_km: null, note: '' }),
  },
  // Pieza cambiada: cuándo y con cuántos km se quitó (pasa al historial)
  partOff: {
    fields: [
      { k: 'removed_date', label: 'f.date', type: 'date', req: true, half: true, min: SINCE, max: 'today' },
      { k: 'removed_km', label: 'f.km', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      { k: 'replace', label: 'f.replaceNew', type: 'check' },
    ],
    blank: (km) => ({ removed_date: today(), removed_km: km, replace: true }),
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

// Plantilla en el idioma actual: [texto del botón, valores]. Avisos: con su título; piezas: el botón es el tipo.
export function preset([key, values], group = 'presets') {
  if (group === 'partPresets') return [optLabel('part', key), values];
  const [btn, title] = t('presets.' + key);
  return [btn, { ...values, title }];
}
