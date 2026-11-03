// Validación de los formularios de forms.js. Reglas por campo (todas opcionales):
//   req         obligatorio
//   len         máximo de caracteres (texto)
//   upper       se guarda en mayúsculas (texto)
//   pattern/patternMsg  formato del texto
//   int         sin decimales · dec: máximo de decimales · pos: mayor que 0 · min / max (números)
//   min / max   en fechas: 'AAAA-MM-DD' o 'today'
//   check(v, r, ctx)  regla propia, con el registro ya convertido (r) → texto de error o ''
// validate(form, m, ctx) → { r, errs: { campo: error }, general }: r es el registro listo para guardar.
import { num, today } from './calc.js';

const N = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });
const day = (d) => (d === 'today' ? today() : d);
const amount = (n, unit) => N.format(n) + (unit ? ' ' + (n === 1 && unit === 'meses' ? 'mes' : unit) : '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseField(f, raw) {
  if (f.type === 'check') return { v: !!raw };
  if (f.type === 'chips') return { v: f.options.some(([o]) => o === raw) ? raw : f.options[0][0] };

  if (f.type === 'date') {
    const v = raw || null;
    if (!v) return f.req ? { v, err: 'Pon una fecha' } : { v };
    if (!DATE.test(v) || Number.isNaN(Date.parse(v))) return { v, err: 'Fecha no válida' };
    if (f.min && v < day(f.min)) return { v, err: f.min === 'today' ? 'No puede ser una fecha pasada' : 'Fecha demasiado antigua' };
    if (f.max && v > day(f.max)) return { v, err: f.max === 'today' ? 'No puede ser una fecha futura' : 'Fecha demasiado lejana' };
    return { v };
  }

  if (f.type === 'num') {
    const s = raw == null ? '' : String(raw).trim();
    const v = num(s);
    if (v == null) return f.req ? { v, err: 'Obligatorio' } : { v };
    if (Number.isNaN(v) || !Number.isFinite(v)) return { v, err: f.int ? 'Escribe solo cifras' : 'Escribe un número, p. ej. 42,5' };
    const decimals = (s.replace(',', '.').split('.')[1] || '').length;
    if (f.int && decimals) return { v, err: 'Sin decimales' };
    if (f.dec != null && decimals > f.dec) return { v, err: 'Como mucho ' + f.dec + ' decimales' };
    if (f.pos && !(v > 0)) return { v, err: 'Tiene que ser mayor que 0' };
    if (f.min != null && v < f.min) return { v, err: 'Mínimo ' + amount(f.min, f.unit) };
    if (f.max != null && v > f.max) return { v, err: 'Máximo ' + amount(f.max, f.unit) };
    return { v };
  }

  // texto
  let v = raw == null ? '' : String(raw).trim().replace(/\s+/g, ' ');
  if (f.upper) v = v.toUpperCase();
  if (f.req && !v) return { v, err: 'Obligatorio' };
  if (f.len && v.length > f.len) return { v, err: 'Como mucho ' + f.len + ' caracteres' };
  if (v && f.pattern && !f.pattern.test(v)) return { v, err: f.patternMsg || 'Formato no válido' };
  return { v };
}

export function validate(form, m, ctx) {
  const r = { ...m }, errs = {};
  for (const f of form.fields) {
    const { v, err } = parseField(f, m[f.k]);
    r[f.k] = v;
    if (err) errs[f.k] = err;
  }
  for (const f of form.fields) {
    if (errs[f.k] || !f.check) continue;
    const e = f.check(r[f.k], r, ctx);
    if (e) errs[f.k] = e;
  }
  let general = '';
  if (!Object.keys(errs).length) {
    if (form.prepare) form.prepare(r, ctx);
    general = form.validate ? form.validate(r, ctx) : '';
  }
  return { r, errs, general };
}

// Mientras se escribe en un campo numérico: solo cifras (y una coma o un punto si admite decimales)
export function sanitizeNum(s, int) {
  if (int) return s.replace(/\D/g, '');
  const clean = s.replace(/[^\d.,]/g, '');
  const i = clean.search(/[.,]/);
  return i < 0 ? clean : clean.slice(0, i + 1) + clean.slice(i + 1).replace(/[.,]/g, '');
}
