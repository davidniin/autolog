// Saca los datos de una factura de taller o de un ticket de gasolinera a partir del texto leído por el OCR (ocr.js).
// Entrada: { text, lines: [{ text, box: { xmin, ymin, xmax, ymax } }] }. Las líneas se juntan en filas por su altura,
// porque en las tablas "TOTAL" y "123,45 €" suelen salir como trozos separados de la misma fila.
// Salida: { values: { amount, date, km, cat, title, note, liters, total, station }, found: [campos], fuel, plate, warnings }.
// Solo propone: el formulario los marca como "de la factura" y la persona los revisa antes de guardar.
// Las reglas leen facturas en español; los textos que genera (concepto, avisos) salen en el idioma de la app.
import { today } from './calc.js';
import { t, list } from './i18n/index.js';

// ------------------------------------------------------------ filas
export function rowsOf({ text = '', lines = [] }) {
  if (!lines.length) return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const items = lines
    .filter((l) => l.text && l.text.trim())
    .map((l) => ({ t: l.text.trim(), x: l.box.xmin, y: (l.box.ymin + l.box.ymax) / 2, h: Math.max(1, l.box.ymax - l.box.ymin) }))
    .sort((a, b) => a.y - b.y);
  const rows = [];
  for (const it of items) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(it.y - row.y) < Math.min(it.h, row.h) * 0.55) row.items.push(it);
    else rows.push({ y: it.y, h: it.h, items: [it] });
  }
  return rows.map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.t).join(' '));
}

// ------------------------------------------------------------ números
// Dinero: 1.234,56 · 1234,56 · 234.56 · 1 234,56 (siempre con 2 decimales)
const MONEY = /(?<![\d.,])(\d{1,3}(?:[. ]\d{3})+|\d+)[,.](\d{2})(?![\d])/g;
export function moneyIn(s) {
  const out = [];
  for (const m of s.matchAll(MONEY)) out.push(+(m[1].replace(/[. ]/g, '') + '.' + m[2]));
  return out;
}
// Decimal con 1 a 3 decimales (litros, €/L)
const DEC = /(?<![\d.,])(\d{1,4})[,.](\d{1,3})(?![\d])/g;
const decIn = (s) => [...s.matchAll(DEC)].map((m) => +(m[1] + '.' + m[2]));
// Entero de km: 86.100 · 86 100 · 86100 (sin decimales detrás)
const INT = /(?<![\d.,])(\d{1,3}(?:[. ]\d{3})+|\d{3,7})(?![\d]|[,.]\d)/g;
const intIn = (s) => [...s.matchAll(INT)].map((m) => +m[1].replace(/[. ]/g, ''));

// ------------------------------------------------------------ fechas
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function ymd(y, m, d) {
  if (y < 100) y += 2000;
  const s = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const t = new Date(s + 'T12:00');
  return m >= 1 && m <= 12 && d >= 1 && t.getDate() === d ? s : null;
}
export function datesIn(s) {
  const out = [];
  for (const m of s.matchAll(/(?<!\d)(\d{1,2})\s?[/\-.]\s?(\d{1,2})\s?[/\-.]\s?(\d{4}|\d{2})(?!\d)/g)) out.push(ymd(+m[3], +m[2], +m[1]));
  for (const m of s.matchAll(/(?<!\d)(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?!\d)/g)) out.push(ymd(+m[1], +m[2], +m[3]));
  for (const m of s.matchAll(/(?<!\d)(\d{1,2})\s+(?:de\s+)?([a-záéíóú]{3,})\.?\s+(?:de\s+|del\s+)?(\d{4})(?!\d)/gi)) {
    const i = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase().replace('é', 'e'));
    if (i >= 0) out.push(ymd(+m[3], i + 1, +m[1]));
  }
  return out.filter((d) => d && d >= '2000-01-01' && d <= today());
}

// ------------------------------------------------------------ texto
const ITEMS = [
  // "aceite" solo cuenta si aparece fuera de "filtro de aceite"
  [{ test: (s) => /\baceite\b/i.test(s.replace(/filtros?\s*(de\s*)?aceite/gi, '')) }, 'oil'], [/filtros?\s*(de\s*)?aceite/i, 'oilFilter'],
  [/filtros?\s*(de\s*)?aire/i, 'airFilter'], [/filtros?\s*(de\s*)?(habit|polen|cabina)/i, 'cabinFilter'],
  [/filtros?\s*(de\s*)?(combust|gas[oó]il|gas[oó]leo)/i, 'fuelFilter'],
  [/pastillas?/i, 'pads'], [/discos?\s*(de\s*)?freno/i, 'discs'], [/l[ií]quido\s*(de\s*)?frenos?/i, 'brakeFluid'],
  [/neum[aá]tico|cubiertas?\b/i, 'tyres'], [/bater[ií]a/i, 'battery'], [/correa\s*(de\s*)?distrib/i, 'timingBelt'],
  [/embrague/i, 'clutch'], [/amortiguador/i, 'shocks'], [/escobilla|limpiaparabrisas/i, 'wipers'],
  [/anticongelante|refrigerante/i, 'coolant'], [/buj[ií]as?/i, 'plugs'], [/alineaci[oó]n|paralelo/i, 'alignment'],
  [/equilibrado/i, 'balancing'], [/aire\s*acondicionado|carga\s*(de\s*)?gas/i, 'aircon'],
];
const REPAIR = /reparaci|aver[ií]a|sustituci|pastillas|discos|embrague|bater[ií]a|neum[aá]tic|amortig|correa|diagnos|chapa|pintura|luna|parabrisas/i;
const SERVICE = /revisi[oó]n|mantenimiento|\baceite\b|filtro/i;
const CAT_RULES = [
  ['itv', /\bi\.?t\.?v\b|inspecci[oó]n\s*t[eé]cnica/i],
  ['seguro', /\bseguros?\b|p[oó]liza|aseguradora|\bprima\b/i],
  ['impuestos', /\bivtm\b|impuesto\s*(de\s*|sobre\s*)?(circ|veh)|ayuntamiento|tributo/i],
  ['peajes', /\bpeajes?\b|autopista|v[ií]a[\s-]*t\b/i],
  ['aparcamiento', /parking|aparcamiento|estacionamiento|\bora\b/i],
];
const FUEL = /gasolina|di[eé]sel|gas[oó]leo|gasoil|sin\s*plomo|\bsp\s?9[58]\b|carburante|surtidor|\blitros\b|\bltrs?\b|\bglp\b|autogas|repsol|cepsa|galp|\bbp\b|shell|petronor|ballenoil|plenoil|moeve/i;
const SKIP_NAME = /factura|ticket|simplificada|fecha|hora|\bc\.?i\.?f|\bn\.?i\.?f|tel[eé]?f|tlf|www|@|calle|\bc\/|avda|avenida|total|cliente|matr[ií]cula|\bkm\b|p[aá]gina/i;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------ análisis
export function parseReceipt(ocr, { plate: vehPlate } = {}) {
  const rows = rowsOf(ocr);
  const all = rows.join('\n');
  const v = {}, warnings = [];

  // Importe total: la fila con la palabra más clara ("total a pagar" > "total" > "importe"), y si no, la cantidad mayor
  const NOT_TOTAL = /sub\s*-?\s*total|base\s*(imp|imponible)?|\bi\.?v\.?a\b|cuota|\bneto\b|descuento|\bdto\b|entregado|cambio|efectivo\s*entregado/i;
  let best = null;
  rows.forEach((r, i) => {
    let score = 0;
    if (/total\s*(a\s*pagar|factura|importe|venta|eur|€)|importe\s*total|a\s*pagar|total\s*ticket/i.test(r)) score = 3;
    else if (/\btotal\b/i.test(r) && !NOT_TOTAL.test(r)) score = 2;
    else if (/\bimporte\b/i.test(r) && !NOT_TOTAL.test(r)) score = 1;
    if (!score) return;
    let amounts = moneyIn(r);
    if (!amounts.length && rows[i + 1]) amounts = moneyIn(rows[i + 1]);
    if (!amounts.length) return;
    const a = amounts[amounts.length - 1];
    if (a > 0 && (!best || score > best.score || (score === best.score && a >= best.a))) best = { score, a };
  });
  const amounts = rows.flatMap(moneyIn).filter((a) => a > 0 && a < 100000);
  const total = best ? best.a : amounts.length ? Math.max(...amounts) : null;

  // Fecha: la de la fila "fecha" si la hay; si no, la primera válida (no futura). Se evitan las de vencimiento.
  const NOT_DATE = /venc|v[aá]lid|caduc|pr[oó]xim|hasta/i;
  const dated = rows.map((r) => ({ r, d: datesIn(r) })).filter((x) => x.d.length && !NOT_DATE.test(x.r));
  const pick = dated.find((x) => /fecha/i.test(x.r)) || dated[0];
  if (pick) v.date = pick.d[0];

  // Matrícula española (0000 BBB): para avisar si no es la del vehículo, y para que sus cifras no pasen por km
  const PLATE = /(?<![\dA-Z])(\d{4})\s*-?\s*([BCDFGHJKLMNPRSTVWXYZ]{3})(?![A-Z])/g;
  const pm = [...all.matchAll(PLATE)][0];
  const plate = pm ? pm[1] + ' ' + pm[2] : null;

  // Km: "Km: 86.120", "86.120 km" o un número en la fila de "kilómetros / kilometraje"
  const NUM = '(\\d{1,3}(?:[. ]\\d{3})+|\\d{3,7})(?![\\d]|[,.]\\d)';
  const AFTER = new RegExp('\\b(?:km|kms|kil[oó]metros|kilometraje|od[oó]metro|cuentakil\\w*)\\s*[:.=]?\\s*' + NUM, 'i');
  const BEFORE = new RegExp(NUM.replace('(?![\\d]|[,.]\\d)', '') + '\\s*(?:km|kms)\\b', 'i');
  const ok = (n) => n >= 100 && n <= 2000000;
  for (let i = 0; i < rows.length && v.km == null; i++) {
    const r = rows[i].replace(PLATE, ' ');
    if (/€\s*\/\s*km/i.test(r)) continue;
    const m = r.match(AFTER) || r.match(BEFORE);
    let k = m ? +m[1].replace(/[. ]/g, '') : null;
    if (k == null && /\b(kil[oó]metros|kilometraje|od[oó]metro)\b/i.test(r) && rows[i + 1]) {
      k = intIn(rows[i + 1].replace(PLATE, ' ')).find(ok) ?? null;
    }
    if (k != null && ok(k)) v.km = k;
  }
  if (plate && vehPlate && plate.replace(/\s/g, '') !== String(vehPlate).toUpperCase().replace(/[\s-]/g, '')) {
    warnings.push(t('scan.otherPlate', { plate, veh: vehPlate }));
  }

  // Nombre del taller o de la gasolinera: la primera fila "de letras" de la cabecera
  const name = rows.slice(0, 5).find((r) => {
    const letters = (r.match(/[a-záéíóúñü]/gi) || []).length;
    return letters >= 4 && letters / r.replace(/\s/g, '').length > 0.6 && !SKIP_NAME.test(r);
  });
  const invoice = all.match(/(?:factura|fra\.?|ticket)\s*(?:simplificada\s*)?(?:n[º°o.]*|num(?:ero)?\.?)?\s*[:#]?\s*([A-Z]{0,4}[-/]?\d[\w\-/]{2,})/i);

  // ¿Ticket de gasolinera? Litros y €/L
  const fuel = FUEL.test(all);
  if (fuel) {
    for (let i = 0; i < rows.length && v.liters == null; i++) {
      const r = rows[i];
      const unit = r.match(/(\d{1,3}[,.]\d{1,3})\s*(?:l|lt|lts|ltr|ltrs|litros)\b/i);
      const label = /litros|cantidad|volumen|\blts?\b|\bltrs?\b/i.test(r);
      const c = unit ? [+unit[1].replace(',', '.')] : label ? decIn(r) : [];
      const l = c.find((n) => n >= 1 && n <= 200 && n !== total);
      if (l != null) v.liters = l;
    }
    let ppl = null;
    for (const r of rows) {
      if (!/€\s*\/\s*l|eur\s*\/\s*l|precio|p\.?\s*unit|pvp/i.test(r)) continue;
      const p = decIn(r).find((n) => n >= 0.3 && n <= 5);
      if (p != null) { ppl = p; break; }
    }
    if (v.liters == null && ppl && total) v.liters = Math.round((total / ppl) * 100) / 100;
    if (total != null) v.total = total;
    else if (v.liters && ppl) v.total = Math.round(v.liters * ppl * 100) / 100;
    if (name) v.station = name.slice(0, 60);
  } else {
    if (total != null) v.amount = total;
    // Categoría y concepto
    const cat = CAT_RULES.find(([, re]) => re.test(all));
    v.cat = cat ? cat[0] : REPAIR.test(all) ? 'reparacion' : SERVICE.test(all) ? 'revision' : undefined;
    if (!v.cat) delete v.cat;
    const items = [];
    for (const [re, key] of ITEMS) if (re.test(all) && !items.includes(key)) items.push(key);
    if (items.length) v.title = cap(list(items.slice(0, 4).map((k) => t('scan.items.' + k)))).slice(0, 80);
    else if (v.cat === 'itv') v.title = t('scan.items.itv');
    const note = [name, invoice ? t('scan.invoiceNo', { n: invoice[1] }) : ''].filter(Boolean).join(' · ');
    if (note) v.note = note.slice(0, 500);
  }

  if (ocr.confidence != null && ocr.confidence < 0.6) warnings.push(t('scan.lowConfidence'));
  if (!Object.keys(v).length) warnings.push(t('scan.nothing'));
  return { values: v, found: Object.keys(v), fuel, plate, warnings, rows };
}
