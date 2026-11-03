// Cálculos: consumo (método lleno a lleno), km actuales y formatos.
import { t, locale } from './i18n/index.js';
import { UP, conv, distUnit, volUnit, consUnit, econs, econsUnit } from './units.js';

// Consumo lleno a lleno: entre dos repostajes con depósito lleno, los litros puestos después del primero
// (incluidos los parciales intermedios y el último lleno) divididos por los km recorridos.
export function fuelStats(fills) {
  const asc = [...fills].sort((a, b) => a.km - b.km || a.date.localeCompare(b.date));
  const per = {}; // id del repostaje lleno → L/100 km del tramo que cierra
  let prev = null, acc = 0, liters = 0, dist = 0, last = null;
  for (const f of asc) {
    if (prev) acc += f.liters;
    if (f.full_tank) {
      if (prev && f.km > prev.km) {
        per[f.id] = last = (acc / (f.km - prev.km)) * 100;
        liters += acc;
        dist += f.km - prev.km;
      }
      prev = f;
      acc = 0;
    }
  }
  const spent = sum(fills, 'total'), L = sum(fills, 'liters');
  return { per, avg: dist ? (liters / dist) * 100 : null, last, spent, liters: L, pricePerL: L ? spent / L : null };
}

// Por tipo de energía: combustible (litros) y electricidad (kWh), cada uno con su consumo lleno a lleno.
// → { fuel, kwh, per: { id: consumo del tramo }, spent }
export function energyStats(fills) {
  const fuel = fuelStats(fills.filter((f) => f.energy !== 'kwh'));
  const kwh = fuelStats(fills.filter((f) => f.energy === 'kwh'));
  return { fuel, kwh, per: { ...fuel.per, ...kwh.per }, spent: fuel.spent + kwh.spent };
}
// Qué energías usa un vehículo: gasolina/diésel/GLP → combustible; eléctrico → kWh; híbrido enchufable → las dos
export const energiesOf = (veh) => (!veh ? ['fuel'] : veh.fuel_type === 'electrico' ? ['kwh'] : veh.fuel_type === 'hibrido' ? ['fuel', 'kwh'] : ['fuel']);

export function currentKm(v, fills, exps) {
  return Math.max(v.start_km || 0, ...fills.map((f) => f.km), ...exps.map((e) => e.km || 0));
}

export function sum(list, k) { return list.reduce((s, x) => s + (+x[k] || 0), 0); }

export function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ------------------------------------------------------------ formatos (según el idioma: i18n/index.js)
// Los Intl.NumberFormat se crean una vez por locale y opciones.
const NF = {};
function nf(opts) {
  const k = locale() + JSON.stringify(opts);
  return NF[k] || (NF[k] = new Intl.NumberFormat(locale(), opts));
}
const n = (v, d0, d1 = d0) => nf({ minimumFractionDigits: d0, maximumFractionDigits: d1 }).format(v);

// Los valores llegan como se guardan (km, litros, L/100 km) y salen en las unidades y la moneda elegidas (units.js).
const money = (v, d) => nf({ style: 'currency', currency: UP.currency, ...(d != null ? { minimumFractionDigits: d, maximumFractionDigits: d } : {}) }).format(v);
export const fmt = {
  money: (v) => (v == null ? '—' : money(v)),
  km: (v) => (v == null ? '—' : n(conv.dist(v), 0) + ' ' + distUnit()),
  l: (v) => (v == null ? '—' : n(conv.vol(v), 2) + ' ' + volUnit()),
  cons: (l100) => { const c = conv.cons(l100); return c == null ? '—' : n(c, 1); },
  consUnit: () => consUnit(),
  ppl: (perL) => (perL == null ? '—' : money(conv.perVol(perL), 3) + '/' + volUnit()),
  kwh: (v) => (v == null ? '—' : n(v, 1) + ' kWh'),
  ppkwh: (v) => (v == null ? '—' : money(v, 3) + '/kWh'),
  econs: (kwh100) => { const c = econs(kwh100); return c == null ? '—' : n(c, 1); },
  econsUnit: () => econsUnit(),
  // cantidad y precio de un repostaje o de una recarga
  qty: (f) => (f.energy === 'kwh' ? n(f.liters, 1) + ' kWh' : n(conv.vol(f.liters), 2) + ' ' + volUnit()),
  unitPrice: (f) => (f.energy === 'kwh' ? money(f.total / f.liters, 3) + '/kWh' : money(conv.perVol(f.total / f.liters), 3) + '/' + volUnit()),
  // corto, para las etiquetas de cada tramo: "6,2 L/100", "15,2 kWh/100", "42,1 mpg"
  consOf: (f, v) => (f.energy === 'kwh' ? fmt.econs(v) + ' ' + econsUnit() : fmt.cons(v) + ' ' + consUnit()).replace(/\/100 (km|mi)$/, '/100'),
  perDist: (perKm) => (perKm == null ? '—' : money(conv.perDist(perKm), 3) + '/' + distUnit()),
  num: (v, max = 3) => (v == null ? '—' : n(v, 0, max)),
  date: (s) => (s ? new Date(s + 'T12:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : ''),
};

// Número para escribirlo en un campo del formulario, con el separador decimal del idioma (42,5 / 42.5)
export function numInput(v) {
  if (v == null || v === '') return '';
  const sep = (1.5).toLocaleString(locale()).charAt(1);
  return String(v).replace('.', sep);
}

// Acepta "42,5" o "42.5"; vacío → null; texto no numérico → NaN
export function num(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  return +String(v).replace(/\s/g, '').replace(',', '.');
}

// ------------------------------------------------------------ fechas
export function addMonths(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last)); // 31 ene + 1 mes = 28/29 feb
  return t.toISOString().slice(0, 10);
}
export function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }

// ------------------------------------------------------------ recordatorios
// Avisa lo primero que llegue: la fecha o los km. "Pronto" = 30 días o 1.000 km.
export const SOON_DAYS = 30;
export const SOON_KM = 1000;

export function reminderState(r, km) {
  const days = r.due_date ? daysBetween(today(), r.due_date) : null;
  const kmLeft = r.due_km != null ? r.due_km - km : null;
  const late = (days != null && days < 0) || (kmLeft != null && kmLeft <= 0);
  const soon = !late && ((days != null && days <= SOON_DAYS) || (kmLeft != null && kmLeft <= SOON_KM));
  // Para ordenar por urgencia: fracción del margen de "pronto" que queda (lo más bajo, primero)
  const score = Math.min(days != null ? days / SOON_DAYS : Infinity, kmLeft != null ? kmLeft / SOON_KM : Infinity);
  const parts = [];
  // Primero lo que vence antes (si van los km por delante, se dicen primero)
  const kmFirst = kmLeft != null && (days == null || kmLeft / SOON_KM < days / SOON_DAYS);
  const kmText = () => (kmLeft <= 0 ? t('rem.overBy', { km: fmt.km(-kmLeft) }) : t('rem.left', { km: fmt.km(kmLeft) }));
  if (kmFirst) parts.push(kmText());
  if (days != null) {
    parts.push(days < 0 ? t('rem.ago', { days: t('common.days', { n: -days }) }) : days === 0 ? t('rem.today')
      : days <= 60 ? t('rem.in', { days: t('common.days', { n: days }) }) : fmt.date(r.due_date));
  }
  if (kmLeft != null && !kmFirst) parts.push(kmText());
  return { days, kmLeft, level: late ? 'late' : soon ? 'soon' : 'ok', score, text: parts.join(' · ') };
}

// Desgaste de una pieza: lo que lleva (km y meses) frente a su vida esperada. El mayor de los dos manda.
// → { km, months, pct (0–∞, null si no hay vida esperada), level: ok | soon (≥ 85 %) | late (≥ 100 %) }
export function partState(p, kmNow) {
  const endKm = p.removed_km ?? kmNow, endDate = p.removed_date || today();
  const km = p.installed_km != null && endKm != null ? Math.max(0, endKm - p.installed_km) : null;
  const months = Math.max(0, daysBetween(p.installed_date, endDate) / 30.44);
  const pcts = [];
  if (p.life_km && km != null) pcts.push(km / p.life_km);
  if (p.life_months) pcts.push(months / p.life_months);
  const pct = pcts.length ? Math.max(...pcts) : null;
  return { km, months, pct, level: pct == null ? 'ok' : pct >= 1 ? 'late' : pct >= 0.85 ? 'soon' : 'ok' };
}

// Siguiente vencimiento al marcarlo como hecho en `date` con `km`. null = no se repite.
export function nextDue(r, date, km) {
  if (!r.every_km && !r.every_months) return null;
  return {
    due_date: r.every_months ? addMonths(date, r.every_months) : null,
    due_km: r.every_km && km != null ? km + r.every_km : null,
  };
}


// ------------------------------------------------------------ costes
// Coste por mes: total / meses desde el primer apunte. Por km: total / km recorridos desde el primer km conocido.
export function costs(veh, fills, exps, kmNow) {
  const all = [
    ...fills.map((f) => ({ date: f.date, cat: 'fuel', amount: f.total })),
    ...exps.map((e) => ({ date: e.date, cat: e.cat, amount: e.amount })),
  ];
  const total = sum(all, 'amount');
  const first = all.reduce((m, x) => (!m || x.date < m ? x.date : m), null);
  const months = first ? Math.max(1, daysBetween(first, today()) / 30.44) : null;
  const kms = [veh.start_km, ...fills.map((f) => f.km), ...exps.map((e) => e.km)].filter((k) => k != null);
  const driven = kms.length ? kmNow - Math.min(...kms) : 0;

  const byCat = {};
  for (const x of all) byCat[x.cat] = (byCat[x.cat] || 0) + x.amount;

  // Últimos 12 meses, del más antiguo al actual
  const now = today(), monthsList = [];
  for (let i = 11; i >= 0; i--) {
    const key = addMonths(now.slice(0, 8) + '01', -i).slice(0, 7);
    monthsList.push({ key, fuel: 0, other: 0 });
  }
  const idx = Object.fromEntries(monthsList.map((m, i) => [m.key, i]));
  for (const x of all) {
    const i = idx[x.date.slice(0, 7)];
    if (i != null) monthsList[i][x.cat === 'fuel' ? 'fuel' : 'other'] += x.amount;
  }

  let purchase = null;
  if (veh.purchase_price) {
    const t = total + veh.purchase_price;
    const m = veh.purchase_date ? Math.max(1, daysBetween(veh.purchase_date, today()) / 30.44) : null;
    purchase = { total: t, perMonth: m ? t / m : null, since: veh.purchase_date };
  }

  return {
    total, first, driven,
    perMonth: months ? total / months : null,
    perKm: driven > 0 ? total / driven : null,
    byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
    months: monthsList,
    purchase,
  };
}

export function monthName(key, long) {
  const s = new Date(key + '-15T12:00').toLocaleDateString(locale(), long ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
