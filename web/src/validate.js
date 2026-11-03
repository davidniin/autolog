// Validación de los formularios de forms.js. Reglas por campo (todas opcionales):
//   req         obligatorio
//   len         máximo de caracteres (texto)
//   upper       se guarda en mayúsculas (texto)
//   pattern/patternMsg  formato del texto (patternMsg = clave de i18n)
//   int         sin decimales · dec: máximo de decimales · pos: mayor que 0 · min / max (números)
//   min / max   en fechas: 'AAAA-MM-DD' o 'today'
//   check(v, r, ctx)  regla propia, con el registro ya convertido (r) → texto de error o ''
// validate(form, m, ctx) → { r, errs: { campo: error }, general }: r es el registro listo para guardar.
// Los mensajes salen del idioma actual (i18n, claves "v.*").
import { num, today, fmt } from './calc.js';
import { t } from './i18n/index.js';
import { OPTIONS, unitLabel } from './forms.js';

const day = (d) => (d === 'today' ? today() : d);
const amount = (n, unit) => fmt.num(n) + (unit ? ' ' + (n === 1 && unit === 'months' ? t('f.month') : unitLabel(unit)) : '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseField(f, raw) {
  if (f.type === 'check') return { v: !!raw };
  if (f.type === 'chips') {
    const opts = typeof f.options === 'string' ? OPTIONS[f.options] : f.options;
    return { v: opts.some(([o]) => o === raw) ? raw : opts[0][0] };
  }

  if (f.type === 'date') {
    const v = raw || null;
    if (!v) return f.req ? { v, err: t('v.dateMissing') } : { v };
    if (!DATE.test(v) || Number.isNaN(Date.parse(v))) return { v, err: t('v.dateBad') };
    if (f.min && v < day(f.min)) return { v, err: f.min === 'today' ? t('v.datePast') : t('v.dateOld') };
    if (f.max && v > day(f.max)) return { v, err: f.max === 'today' ? t('v.dateFuture') : t('v.dateFar') };
    return { v };
  }

  if (f.type === 'num') {
    const s = raw == null ? '' : String(raw).trim();
    const v = num(s);
    if (v == null) return f.req ? { v, err: t('v.required') } : { v };
    if (Number.isNaN(v) || !Number.isFinite(v)) return { v, err: f.int ? t('v.digitsOnly') : t('v.number') };
    const decimals = (s.replace(',', '.').split('.')[1] || '').length;
    if (f.int && decimals) return { v, err: t('v.noDecimals') };
    if (f.dec != null && decimals > f.dec) return { v, err: t('v.maxDecimals', { n: f.dec }) };
    if (f.pos && !(v > 0)) return { v, err: t('v.positive') };
    if (f.min != null && v < f.min) return { v, err: t('v.min', { v: amount(f.min, f.unit) }) };
    if (f.max != null && v > f.max) return { v, err: t('v.max', { v: amount(f.max, f.unit) }) };
    return { v };
  }

  // texto
  let v = raw == null ? '' : String(raw).trim().replace(/\s+/g, ' ');
  if (f.upper) v = v.toUpperCase();
  if (f.req && !v) return { v, err: t('v.required') };
  if (f.len && v.length > f.len) return { v, err: t('v.maxLen', { n: f.len }) };
  if (v && f.pattern && !f.pattern.test(v)) return { v, err: t(f.patternMsg || 'v.format') };
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
