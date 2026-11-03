// Formularios (vehículo, repostaje, gasto, recordatorio, "hecho"): los pinta FormSheet.vue.
// Tipos de campo: text, num (admite coma decimal), date, chips (opciones), check.
// Reglas de validación por campo (req, len, int, dec, pos, min, max, check...): ver validate.js. unit = unidad dentro del campo.
// files: true = admite adjuntos. scan: true = botón para escanear la factura/ticket y rellenar los campos. Ganchos opcionales: hint(m) texto de ayuda, prepare(r, ctx) completa el registro, validate(r, ctx) → error.
// ctx = { others: demás registros del vehículo, km: km actuales }.
import { fmt, num, today, addMonths } from './calc.js';

export const KINDS = [['coche', '🚗 Coche'], ['moto', '🏍️ Moto']];
export const FUELS = [['gasolina', 'Gasolina'], ['diesel', 'Diésel'], ['glp', 'GLP']];
export const CATS = [
  ['revision', '🔧 Revisión'], ['reparacion', '🛠️ Reparación'], ['itv', '📋 ITV'], ['seguro', '🛡️ Seguro'],
  ['impuestos', '🏛️ Impuestos'], ['aparcamiento', '🅿️ Aparcamiento'], ['peajes', '🛣️ Peajes'], ['otros', '📦 Otros'],
];
export const label = (list, v) => (list.find((x) => x[0] === v) || [v, v])[1];
export const emoji = (list, v) => label(list, v).split(' ')[0];
export const text = (list, v) => label(list, v).split(' ').slice(1).join(' ');

// Límites razonables (evitan errores al teclear, p. ej. un cero de más)
const MAX_KM = 2000000;
const MAX_EUR = 1000000;
const PPL = [0.3, 5]; // €/L creíbles
const NOTE = { k: 'note', label: 'Notas', type: 'text', len: 500 };
const SINCE = '1950-01-01';

export const FORMS = {
  vehicles: {
    title: 'vehículo',
    files: true, // documentación: permiso de circulación, ficha técnica, póliza...
    fields: [
      { k: 'name', label: 'Nombre', type: 'text', req: true, len: 40, ph: 'Golf, Vespa…' },
      { k: 'kind', label: 'Tipo', type: 'chips', options: KINDS },
      {
        k: 'plate', label: 'Matrícula', type: 'text', half: true, ph: '1234 ABC', len: 12, upper: true,
        pattern: /^[A-Z0-9][A-Z0-9 -]*[A-Z0-9]$/, patternMsg: 'Solo letras, números, espacios y guiones',
      },
      { k: 'start_km', label: 'Km actuales', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      { k: 'fuel_type', label: 'Combustible', type: 'chips', options: FUELS },
      { k: 'purchase_price', label: 'Precio de compra', type: 'num', half: true, ph: 'Opcional', dec: 2, max: MAX_EUR, unit: '€' },
      { k: 'purchase_date', label: 'Fecha de compra', type: 'date', half: true, min: SINCE, max: 'today' },
      { ...NOTE, ph: 'Bastidor, neumáticos, aceite…' },
    ],
    blank: () => ({ name: '', kind: 'coche', plate: '', fuel_type: 'gasolina', start_km: null, purchase_price: null, purchase_date: null, note: '' }),
  },
  fuel: {
    title: 'repostaje',
    files: true, // ticket de la gasolinera
    scan: true, // escanear el ticket (ReceiptScan.vue)
    fields: [
      { k: 'date', label: 'Fecha', type: 'date', req: true, half: true, min: SINCE, max: 'today' },
      {
        k: 'km', label: 'Cuentakilómetros', type: 'num', int: true, req: true, half: true, pos: true, max: MAX_KM, unit: 'km',
        // Los km tienen que cuadrar con los repostajes de antes y de después
        check: (v, r, { others }) => {
          if (!r.date) return '';
          const before = others.filter((f) => f.date <= r.date).map((f) => f.km);
          const after = others.filter((f) => f.date > r.date).map((f) => f.km);
          const lo = before.length ? Math.max(...before) : null, hi = after.length ? Math.min(...after) : null;
          if (lo != null && v < lo) return 'Menos que en un repostaje anterior (' + fmt.km(lo) + ')';
          if (hi != null && v > hi) return 'Más que en un repostaje posterior (' + fmt.km(hi) + ')';
          return '';
        },
      },
      { k: 'liters', label: 'Litros', type: 'num', req: true, half: true, pos: true, dec: 3, max: 200, unit: 'L' },
      {
        k: 'total', label: 'Importe', type: 'num', req: true, half: true, pos: true, dec: 2, max: 2000, unit: '€',
        check: (v, r) => {
          if (!(r.liters > 0)) return '';
          const p = v / r.liters;
          return p < PPL[0] || p > PPL[1] ? 'Sale a ' + fmt.ppl(p) + ': revisa litros e importe' : '';
        },
      },
      { k: 'full_tank', label: 'He llenado el depósito', type: 'check' },
      { k: 'station', label: 'Gasolinera', type: 'text', ph: 'Opcional', len: 60 },
      NOTE,
    ],
    blank: (vid) => ({ vehicle_id: vid, date: today(), km: null, liters: null, total: null, full_tank: true, station: '', note: '' }),
    hint: (m) => {
      const l = num(m.liters), t = num(m.total);
      return l > 0 && t > 0 ? 'Precio: ' + fmt.ppl(t / l) : '';
    },
  },
  expenses: {
    title: 'gasto',
    files: true, // facturas y tickets
    scan: true, // escanear la factura (ReceiptScan.vue)
    fields: [
      { k: 'cat', label: 'Categoría', type: 'chips', options: CATS },
      { k: 'title', label: 'Concepto', type: 'text', ph: 'Cambio de aceite y filtros', len: 80 },
      { k: 'amount', label: 'Importe', type: 'num', req: true, half: true, pos: true, dec: 2, max: MAX_EUR, unit: '€' },
      { k: 'date', label: 'Fecha', type: 'date', req: true, half: true, min: SINCE, max: 'today' },
      { k: 'km', label: 'Km (opcional)', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      { ...NOTE, ph: 'Taller, nº de póliza…' },
    ],
    blank: (vid) => ({ vehicle_id: vid, date: today(), km: null, cat: 'revision', title: '', amount: null, note: '' }),
  },
  reminders: {
    title: 'aviso',
    presets: [
      ['🛢️ Aceite', { title: 'Cambio de aceite y filtro', cat: 'revision', every_km: 15000, every_months: 12 }],
      ['🔧 Revisión', { title: 'Revisión general', cat: 'revision', every_km: 30000, every_months: 24 }],
      ['📋 ITV', { title: 'ITV', cat: 'itv', every_km: null, every_months: 12 }],
      ['🛡️ Seguro', { title: 'Renovar el seguro', cat: 'seguro', every_km: null, every_months: 12 }],
      ['🏛️ Impuesto', { title: 'Impuesto de circulación', cat: 'impuestos', every_km: null, every_months: 12 }],
      ['🛞 Neumáticos', { title: 'Revisar neumáticos', cat: 'revision', every_km: 40000, every_months: null }],
    ],
    fields: [
      { k: 'title', label: 'Qué hay que hacer', type: 'text', req: true, ph: 'Cambio de aceite', len: 80 },
      { k: 'cat', label: 'Categoría (para apuntar el gasto al hacerlo)', type: 'chips', options: CATS },
      { k: 'every_km', label: 'Repetir cada', type: 'num', int: true, half: true, ph: '15000', min: 100, max: 500000, unit: 'km' },
      { k: 'every_months', label: 'Repetir cada', type: 'num', int: true, half: true, ph: '12', min: 1, max: 240, unit: 'meses' },
      { k: 'due_date', label: 'Próximo aviso: fecha', type: 'date', half: true, min: '2000-01-01', max: '2100-12-31' },
      { k: 'due_km', label: 'Próximo aviso: km', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      NOTE,
    ],
    note: 'Avisa lo primero que llegue. Si dejas el próximo aviso vacío, se calcula desde hoy y los km actuales.',
    blank: (vid) => ({ vehicle_id: vid, title: '', cat: 'revision', every_km: null, every_months: null, due_date: null, due_km: null, note: '' }),
    prepare: (r, { km }) => {
      if (!r.due_date && r.every_months) r.due_date = addMonths(today(), r.every_months);
      if (r.due_km == null && r.every_km) r.due_km = km + r.every_km;
    },
    validate: (r) => (r.due_date || r.due_km != null ? '' : 'Pon cada cuántos km o meses, o una fecha o unos km para el aviso'),
  },
  // Marcar un recordatorio como hecho: si hay importe se apunta como gasto, y si se repite se programa el siguiente
  done: {
    title: 'hecho',
    fields: [
      { k: 'date', label: 'Fecha', type: 'date', req: true, half: true, min: SINCE, max: 'today' },
      { k: 'km', label: 'Km', type: 'num', int: true, half: true, max: MAX_KM, unit: 'km' },
      { k: 'amount', label: 'Importe (opcional: se apunta como gasto)', type: 'num', dec: 2, max: MAX_EUR, unit: '€' },
    ],
    blank: (km) => ({ date: today(), km, amount: null }),
  },
};
