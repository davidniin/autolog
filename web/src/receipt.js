// Saca los datos de una factura de taller o de un ticket de gasolinera a partir del texto leído (ocr.js o pdf.js).
// Entrada: { text, lines: [{ text, box: { xmin, ymin, xmax, ymax } }] }. Las líneas se juntan en filas por su altura,
// porque en las tablas "TOTAL" y "123,45 €" suelen salir como trozos separados de la misma fila.
// Salida: { values: { amount, date, km, cat, title, note, liters, total, station }, found, fuel, plate, warnings, rows }.
// Los valores salen como se guardan: km y litros (las millas y los galones del documento se convierten).
// Solo propone: el formulario los marca como "leído" y la persona los revisa antes de guardar.
//
// Lee facturas en español y en inglés: importes 1.234,56 € / $1,234.56, fechas dd/mm/aaaa (y mm/dd/aaaa en
// documentos de EE. UU.), "5 de marzo de 2024", "Mar 5, 2024", km o millas, litros o galones.
// Para otro país o formato: añade sus palabras a las reglas de abajo y un caso en web/test/receipt.test.js.
// Los textos que genera (concepto, avisos) salen en el idioma de la app.
import { today } from './calc.js';
import { t, list } from './i18n/index.js';

const KM_PER_MI = 1.609344;
const L_PER_GAL = { gal_us: 3.785411784, gal_uk: 4.54609 };

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
// Dinero, siempre con 2 decimales: 1.234,56 · 1234,56 · 234.56 · 1 234,56 · 1,234.56
const MONEY = /(?<![\d.,])(\d{1,3}(?:[., ]\d{3})+|\d+)([,.])(\d{2})(?![\d])/g;
export function moneyIn(s) {
  const out = [];
  for (const m of s.matchAll(MONEY)) {
    if (m[1].includes(m[2])) continue; // el separador de miles no puede ser el decimal ("1.234.56")
    out.push(+(m[1].replace(/[., ]/g, '') + '.' + m[3]));
  }
  return out;
}
// Decimal con 1 a 3 decimales (litros, galones, precio por unidad)
const DEC = /(?<![\d.,])(\d{1,4})[,.](\d{1,3})(?![\d])/g;
const decIn = (s) => [...s.matchAll(DEC)].map((m) => +(m[1] + '.' + m[2]));
// Entero de distancia: 86.100 · 86,100 · 86 100 · 86100 (sin decimales detrás)
const INT = /(?<![\d.,])(\d{1,3}(?:[., ]\d{3})+|\d{3,7})(?![\d]|[,.]\d)/g;
const intIn = (s) => [...s.matchAll(INT)].map((m) => +m[1].replace(/[., ]/g, ''));

// ------------------------------------------------------------ fechas
const MONTHS = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
};
const monthOf = (w) => {
  const k = w.slice(0, 3).toLowerCase().replace('é', 'e');
  const i = MONTHS.es.indexOf(k);
  return (i >= 0 ? i : MONTHS.en.indexOf(k)) + 1 || 0;
};
function ymd(y, m, d) {
  if (y < 100) y += 2000;
  const s = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const dt = new Date(s + 'T12:00');
  return m >= 1 && m <= 12 && d >= 1 && dt.getDate() === d ? s : null;
}
// us = documento de EE. UU.: 03/05/2024 es 5 de marzo (si el primer número puede ser un mes)
export function datesIn(s, { us = false } = {}) {
  const out = [];
  for (const m of s.matchAll(/(?<!\d)(\d{1,2})\s?[/\-.]\s?(\d{1,2})\s?[/\-.]\s?(\d{4}|\d{2})(?!\d)/g)) {
    const [a, b] = [+m[1], +m[2]];
    out.push(us && a <= 12 ? ymd(+m[3], a, b) : ymd(+m[3], b, a));
  }
  for (const m of s.matchAll(/(?<!\d)(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?!\d)/g)) out.push(ymd(+m[1], +m[2], +m[3]));
  // 5 de marzo de 2024 · 5 March 2024 · 05-Mar-2024
  for (const m of s.matchAll(/(?<!\d)(\d{1,2})[\s\-.]+(?:de\s+)?([a-záéíóú]{3,})\.?[\s\-.,]+(?:de\s+|del\s+)?(\d{4})(?!\d)/gi)) {
    const mo = monthOf(m[2]);
    if (mo) out.push(ymd(+m[3], mo, +m[1]));
  }
  // March 5, 2024 · Mar 5 2024
  for (const m of s.matchAll(/\b([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)/gi)) {
    const mo = monthOf(m[1]);
    if (mo) out.push(ymd(+m[3], mo, +m[2]));
  }
  return out.filter((d) => d && d >= '2000-01-01' && d <= today());
}

// ------------------------------------------------------------ reglas (español | inglés)
const FILTERS = /filtros?\s*(de\s*)?(aceite|aire|habit\w*|polen|cabina|combust\w*|gas[oó]il|gas[oó]leo)|(oil|air|cabin|pollen|fuel)\s*filters?/gi;
const ITEMS = [
  // "aceite / oil" solo cuenta si aparece fuera de "filtro de aceite / oil filter"
  [{ test: (s) => /\b(aceite|oil)\b/i.test(s.replace(FILTERS, '')) }, 'oil'],
  [/filtros?\s*(de\s*)?aceite|oil\s*filter/i, 'oilFilter'],
  [/filtros?\s*(de\s*)?aire|(?<!cabin\s)air\s*filter/i, 'airFilter'],
  [/filtros?\s*(de\s*)?(habit|polen|cabina)|cabin\s*(air\s*)?filter|pollen\s*filter/i, 'cabinFilter'],
  [/filtros?\s*(de\s*)?(combust|gas[oó]il|gas[oó]leo)|fuel\s*filter/i, 'fuelFilter'],
  [/pastillas?|brake\s*pads?/i, 'pads'], [/discos?\s*(de\s*)?freno|\brotors?\b|brake\s*discs?/i, 'discs'],
  [/l[ií]quido\s*(de\s*)?frenos?|brake\s*fluid/i, 'brakeFluid'],
  [/neum[aá]tico|cubiertas?\b|\btyres?\b|\btires?\b/i, 'tyres'], [/bater[ií]a|\bbattery\b/i, 'battery'],
  [/correa\s*(de\s*)?distrib|timing\s*belt/i, 'timingBelt'], [/embrague|\bclutch\b/i, 'clutch'],
  [/amortiguador|\bshocks?\b|\bstruts?\b/i, 'shocks'], [/escobilla|limpiaparabrisas|\bwipers?\b/i, 'wipers'],
  [/anticongelante|refrigerante|coolant|antifreeze/i, 'coolant'], [/buj[ií]as?|spark\s*plugs?/i, 'plugs'],
  [/alineaci[oó]n|paralelo|alignment/i, 'alignment'], [/equilibrado|wheel\s*balanc|\bbalancing\b/i, 'balancing'],
  [/aire\s*acondicionado|carga\s*(de\s*)?gas|\ba\/c\b|air\s*con/i, 'aircon'],
];
const REPAIR = /reparaci|aver[ií]a|sustituci|pastillas|discos|embrague|bater[ií]a|neum[aá]tic|amortig|correa|diagnos|chapa|pintura|luna|parabrisas|\brepair|\breplace|brake\s*pads|\brotors?\b|clutch|battery|\btires?\b|\btyres?\b|timing\s*belt|bodywork|windscreen|windshield/i;
const SERVICE = /revisi[oó]n|mantenimiento|\baceite\b|filtro|\bservice\b|maintenance|oil\s*change|\boil\b|filter/i;
const CAT_RULES = [
  ['itv', /\bi\.?t\.?v\b|inspecci[oó]n\s*t[eé]cnica|\bM\.?O\.?T\b|vehicle\s*inspection|emissions\s*test|smog\s*check/i],
  ['seguro', /\bseguros?\b|p[oó]liza|aseguradora|\bprima\b|insurance|\bpolicy\b/i],
  ['impuestos', /\bivtm\b|impuesto\s*(de\s*|sobre\s*)?(circ|veh)|ayuntamiento|tributo|road\s*tax|vehicle\s*(excise\s*)?tax|\bVED\b|\bDMV\b|registration\s*(fee|renewal)/i],
  ['peajes', /\bpeajes?\b|autopista|v[ií]a[\s-]*t\b|\btolls?\b|turnpike/i],
  ['aparcamiento', /parking|aparcamiento|estacionamiento|\bora\b|car\s*park/i],
];
// Gasolinera: palabras del combustible (sin contar "filtro de gasoil / fuel filter" de una factura de taller)
const FUEL = /gasolina|di[eé]sel|gas[oó]leo|gasoil|sin\s*plomo|\bsp\s?9[58]\b|carburante|surtidor|\blitros\b|\bltrs?\b|\bglp\b|autogas|repsol|cepsa|galp|\bbp\b|shell|petronor|ballenoil|plenoil|moeve|unleaded|gasoline|\bpetrol\b|\bpump\s*\d|\bgallons?\b|\bgals?\b|\bfuel\b|\bregular\b|esso|texaco|chevron|exxon|mobil|sunoco|valero|marathon|speedway|costco\s*gas/i;
const SKIP_NAME = /factura|ticket|simplificada|fecha|hora|\bc\.?i\.?f|\bn\.?i\.?f|tel[eé]?f|tlf|www|@|calle|\bc\/|avda|avenida|total|cliente|matr[ií]cula|\bkm\b|p[aá]gina|invoice|receipt|\bdate\b|\btime\b|phone|\btel\b|customer|\bvin\b|mileage|odometer|\border\b|\bpage\b|bill\s*to|\bstreet\b|\bst\.|\bave\b|\broad\b/i;
// ¿Documento en inglés? ¿De EE. UU. (fechas mm/dd)?
const EN = /\b(amount\s*due|balance\s*due|invoice|receipt|gallons?|mileage|odometer|labou?r|subtotal|sales\s*tax|thank\s*you)\b/i;
const ES = /\b(factura|fecha|importe|litros|iva|cliente|matr[ií]cula)\b/i;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------ análisis
// opts: plate (del vehículo, para avisar si no coincide), distance 'km'|'mi' y volume 'l'|'gal_us'|'gal_uk' (ajustes)
export function parseReceipt(ocr, { plate: vehPlate, distance = 'km', volume = 'l' } = {}) {
  const rows = rowsOf(ocr);
  const all = rows.join('\n');
  const v = {}, warnings = [];
  const en = EN.test(all) && !ES.test(all);
  const us = en && (/\$|\bUSD\b/.test(all) || (distance === 'mi' && volume === 'gal_us'));

  // Importe total: la fila con la palabra más clara ("total a pagar" > "total" > "importe"), y si no, la cantidad mayor
  const NOT_TOTAL = /sub\s*-?\s*total|base\s*(imp|imponible)?|\bi\.?v\.?a\b|cuota|\bneto\b|descuento|\bdto\b|entregado|cambio|efectivo\s*entregado|\btax\b|\bvat\b|\bchange\b|tendered|cash\s*back|savings|discount/i;
  let best = null;
  rows.forEach((r, i) => {
    let score = 0;
    if (/total\s*(a\s*pagar|factura|importe|venta|eur|€|due|amount)|importe\s*total|a\s*pagar|total\s*ticket|amount\s*due|balance\s*due|grand\s*total|total\s*to\s*pay|total\s*paid|invoice\s*total/i.test(r)) score = 3;
    else if (/\btotal\b/i.test(r) && !NOT_TOTAL.test(r)) score = 2;
    else if (/\b(importe|amount)\b/i.test(r) && !NOT_TOTAL.test(r)) score = 1;
    if (!score) return;
    let amounts = moneyIn(r);
    if (!amounts.length && rows[i + 1]) amounts = moneyIn(rows[i + 1]);
    if (!amounts.length) return;
    const a = amounts[amounts.length - 1];
    if (a > 0 && (!best || score > best.score || (score === best.score && a >= best.a))) best = { score, a };
  });
  const amounts = rows.flatMap(moneyIn).filter((a) => a > 0 && a < 100000);
  const total = best ? best.a : amounts.length ? Math.max(...amounts) : null;

  // Fecha: la de la fila "fecha / date" si la hay; si no, la primera válida (no futura). Se evitan las de vencimiento.
  const NOT_DATE = /venc|v[aá]lid|caduc|pr[oó]xim|hasta|\bdue\b|expir|\bnext\b|\buntil\b/i;
  const dated = rows.map((r) => ({ r, d: datesIn(r, { us }) })).filter((x) => x.d.length && !NOT_DATE.test(x.r));
  const pick = dated.find((x) => /fecha|\bdate\b/i.test(x.r)) || dated[0];
  if (pick) v.date = pick.d[0];

  // Matrícula española (0000 BBB): para avisar si no es la del vehículo, y para que sus cifras no pasen por km
  const PLATE = /(?<![\dA-Z])(\d{4})\s*-?\s*([BCDFGHJKLMNPRSTVWXYZ]{3})(?![A-Z])/g;
  const pm = [...all.matchAll(PLATE)][0];
  const plate = pm ? pm[1] + ' ' + pm[2] : null;

  // Distancia: "Km: 86.120", "86.120 km", "Mileage: 45,210", "45,210 mi" o un número en la fila de "kilómetros"
  const NUM = '(\\d{1,3}(?:[., ]\\d{3})+|\\d{3,7})';
  const END = '(?![\\d]|[,.]\\d)';
  const LABEL = '(km|kms|kil[oó]metros|kilometraje|od[oó]metro|cuentakil\\w*|mileage|odometer|odo|miles)'; // "mi" solo detrás del número
  const AFTER = new RegExp('\\b' + LABEL + '\\s*(?:in|out|reading)?\\s*[:.=#]?\\s*' + NUM + END, 'i');
  const BEFORE = new RegExp(NUM + '\\s*(km|kms|mi|miles)\\b', 'i');
  const ok = (n) => n >= 100 && n <= 2000000;
  for (let i = 0; i < rows.length && v.km == null; i++) {
    const r = rows[i].replace(PLATE, ' ');
    if (/(€|\$|£)\s*\/\s*(km|mi)/i.test(r)) continue;
    const a = r.match(AFTER), b = !a && r.match(BEFORE);
    let n = a ? +a[2].replace(/[., ]/g, '') : b ? +b[1].replace(/[., ]/g, '') : null;
    const word = (a ? a[1] : b ? b[2] : '').toLowerCase();
    if (n == null && /\b(kil[oó]metros|kilometraje|od[oó]metro|mileage|odometer)\b/i.test(r) && rows[i + 1]) {
      n = intIn(rows[i + 1].replace(PLATE, ' ')).find(ok) ?? null;
    }
    if (n == null || !ok(n)) continue;
    // ¿Millas? Si lo dice el documento, o si es "mileage/odometer" sin "km" y la instalación usa millas
    const miles = /^(mi|miles)$/.test(word) || (/(mileage|odometer|odo)/.test(word) && distance === 'mi' && !/\bkm\b/i.test(r));
    v.km = miles ? Math.round(n * KM_PER_MI) : n;
  }
  if (plate && vehPlate && plate.replace(/\s/g, '') !== String(vehPlate).toUpperCase().replace(/[\s-]/g, '')) {
    warnings.push(t('scan.otherPlate', { plate, veh: vehPlate }));
  }

  // Nombre del taller o de la gasolinera: la primera fila "de letras" de la cabecera
  const name = rows.slice(0, 5).find((r) => {
    const letters = (r.match(/[a-záéíóúñü]/gi) || []).length;
    return letters >= 4 && letters / r.replace(/\s/g, '').length > 0.6 && !SKIP_NAME.test(r);
  });
  const invoice = all.match(/(?:factura|fra\.?|ticket|invoice|inv\.?|receipt)\s*(?:simplificada\s*)?(?:n[º°o.]*|num(?:ero|ber)?\.?)?\s*[:#]?\s*([A-Z]{0,4}[-/]?\d[\w\-/]{2,})/i);

  // ¿Ticket de gasolinera? Litros (o galones) y precio por unidad
  const fuel = FUEL.test(all.replace(FILTERS, ''));
  if (fuel) {
    const galL = L_PER_GAL[volume] || L_PER_GAL.gal_us; // galones del documento → litros
    for (let i = 0; i < rows.length && v.liters == null; i++) {
      const r = rows[i];
      const lit = r.match(/(\d{1,3}[,.]\d{1,3})\s*(?:l|lt|lts|ltr|ltrs|litros|litres|liters)\b/i);
      const gal = r.match(/(\d{1,3}[,.]\d{1,3})\s*(?:g|gl|gal|gals|gallons?)\b/i);
      const labelL = /litros|litres|liters|cantidad|volumen|\blts?\b|\bltrs?\b/i.test(r);
      const labelG = /gallons?|\bgals?\b|\bqty\b|volume/i.test(r);
      let c = [], k = 1;
      if (lit) c = [+lit[1].replace(',', '.')];
      else if (gal) { c = [+gal[1].replace(',', '.')]; k = galL; }
      else if (labelL) c = decIn(r);
      else if (labelG) { c = decIn(r); k = /litres|liters/i.test(all) ? 1 : galL; }
      const q = c.find((n) => n >= 0.5 && n <= 200 && n !== total);
      if (q != null) v.liters = Math.round(q * k * 1000) / 1000;
    }
    let ppu = null, perGal = false;
    for (const r of rows) {
      if (!/€\s*\/\s*l|eur\s*\/\s*l|precio|p\.?\s*unit|pvp|price|\/\s*gal|\/\s*g\b|per\s*gal|\/\s*l\b|per\s*lit/i.test(r)) continue;
      const p = decIn(r).find((n) => n >= 0.3 && n <= 8);
      if (p != null) { ppu = p; perGal = /gal|\/\s*g\b/i.test(r); break; }
    }
    if (v.liters == null && ppu && total) v.liters = Math.round((total / ppu) * (perGal ? galL : 1) * 1000) / 1000;
    if (total != null) v.total = total;
    else if (v.liters && ppu) v.total = Math.round((v.liters / (perGal ? galL : 1)) * ppu * 100) / 100;
    if (name) v.station = name.slice(0, 60);
  } else {
    if (total != null) v.amount = total;
    // Categoría y concepto. Las concretas (ITV, seguro...) también por el nombre del negocio ("ITV Norte", "Mapfre");
    // revisión o reparación solo por lo que se hizo ("Joe's Auto Repair" que cambia el aceite es una revisión)
    const body = rows.filter((r) => r !== name).join('\n');
    const cat = CAT_RULES.find(([, re]) => re.test(all));
    v.cat = cat ? cat[0] : REPAIR.test(body) ? 'reparacion' : SERVICE.test(body) ? 'revision' : undefined;
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
