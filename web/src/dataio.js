// Exportar e importar los datos.
// - Copia completa (JSON): vehículos, repostajes, gastos, avisos y ajustes. Sirve para restaurar o cambiar de servidor.
//   Las fotos y PDF adjuntos NO van dentro (están en el servidor: ver docs, "Copias de seguridad").
// - CSV de repostajes y de gastos (para Excel / Google Sheets). Siempre en km, litros y la moneda de la instalación,
//   con estas columnas (las mismas al importar):
//     repostajes: vehicle, date, km, liters, total, full_tank, station, note, energy (fuel | kwh: liters son kWh)
//     gastos:     vehicle, date, km, category, title, amount, note
// Importar es seguro de repetir: los registros que ya existen (mismo id, o mismos datos) se saltan.
import { S, putMany, newId, putSettings } from './store.js';
import { num, today } from './calc.js';
import { OPTIONS } from './forms.js';

export const KINDS = ['vehicles', 'fuel', 'expenses', 'reminders', 'parts'];
const FUEL_COLS = ['vehicle', 'date', 'km', 'liters', 'total', 'full_tank', 'station', 'note', 'energy'];
const EXP_COLS = ['vehicle', 'date', 'km', 'category', 'title', 'amount', 'note'];

// ------------------------------------------------------------ exportar
export function backupJSON() {
  const out = { app: 'autolog', version: 1, exported_at: new Date().toISOString(), settings: S.settings };
  for (const k of KINDS) out[k] = S[k];
  return JSON.stringify(out, null, 2);
}

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const vehName = (id) => (S.vehicles.find((v) => v.id === id) || {}).name || '';

export function fuelCSV() {
  const rows = [...S.fuel].sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km)
    .map((f) => [vehName(f.vehicle_id), f.date, f.km, f.liters, f.total, f.full_tank ? 1 : 0, f.station, f.note, f.energy === 'kwh' ? 'kwh' : 'fuel']);
  return toCSV(FUEL_COLS, rows);
}
export function expensesCSV() {
  const rows = [...S.expenses].sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [vehName(e.vehicle_id), e.date, e.km, e.cat, e.title, e.amount, e.note]);
  return toCSV(EXP_COLS, rows);
}
// Con BOM para que Excel lo abra en UTF-8 (tildes, €)
function toCSV(cols, rows) { return '﻿' + [cols, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'; }

export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const fileName = (what, ext) => 'autolog-' + what + '-' + today() + '.' + ext;

// ------------------------------------------------------------ leer CSV (RFC 4180; coma o punto y coma)
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

// Fecha AAAA-MM-DD, DD/MM/AAAA o DD-MM-AAAA → AAAA-MM-DD (o null)
function isoDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) { const d = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); if (d) m = [0, d[3], d[2], d[1]]; }
  if (!m) return null;
  const iso = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  return Number.isNaN(Date.parse(iso)) || iso > today() ? null : iso;
}
const yes = (v) => /^(1|true|yes|si|sí|x)$/i.test(String(v || '').trim());

// ------------------------------------------------------------ preparar la importación (sin cambiar nada todavía)
// → { kind: 'backup' | 'fuel' | 'expenses', add: { fuel: [...], ... }, skipped, invalid, settings }
export function planImport(name, text, vehicleId) {
  if (/\.json$/i.test(name) || /^\s*\{/.test(text)) return planBackup(JSON.parse(text));
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('empty');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const kind = head.includes('liters') ? 'fuel' : head.includes('amount') ? 'expenses' : null;
  if (!kind) throw new Error('columns');
  const col = (r, k) => r[head.indexOf(k)];
  const plan = { kind, add: { fuel: [], expenses: [] }, skipped: 0, invalid: 0 };
  for (const r of rows.slice(1)) {
    const vName = (col(r, 'vehicle') || '').trim();
    const veh = (vName && S.vehicles.find((v) => v.name.toLowerCase() === vName.toLowerCase())) || S.vehicles.find((v) => v.id === vehicleId);
    const date = isoDate(col(r, 'date'));
    const km = num(col(r, 'km'));
    let rec;
    if (kind === 'fuel') {
      const liters = num(col(r, 'liters')), total = num(col(r, 'total'));
      if (!veh || !date || !(km > 0) || !(liters > 0) || !(total > 0)) { plan.invalid++; continue; }
      rec = { id: newId(), vehicle_id: veh.id, date, km: Math.round(km), liters, total,
        full_tank: head.includes('full_tank') ? yes(col(r, 'full_tank')) : true,
        station: (col(r, 'station') || '').trim().slice(0, 60), note: (col(r, 'note') || '').trim().slice(0, 500),
        energy: /^kwh$/i.test((col(r, 'energy') || '').trim()) ? 'kwh' : 'fuel' };
      const dup = S.fuel.some((f) => f.vehicle_id === rec.vehicle_id && f.date === rec.date && f.km === rec.km && Math.abs(f.liters - rec.liters) < 0.01);
      if (dup || plan.add.fuel.some((f) => f.vehicle_id === rec.vehicle_id && f.date === rec.date && f.km === rec.km)) { plan.skipped++; continue; }
      plan.add.fuel.push(rec);
    } else {
      const amount = num(col(r, 'amount'));
      if (!veh || !date || !(amount > 0) || Number.isNaN(km)) { plan.invalid++; continue; }
      const cat = (col(r, 'category') || '').trim().toLowerCase();
      rec = { id: newId(), vehicle_id: veh.id, date, km: km > 0 ? Math.round(km) : null,
        cat: OPTIONS.cat.some(([c]) => c === cat) ? cat : 'otros',
        title: (col(r, 'title') || '').trim().slice(0, 80), amount, note: (col(r, 'note') || '').trim().slice(0, 500) };
      const same = (e) => e.vehicle_id === rec.vehicle_id && e.date === rec.date && Math.abs(e.amount - rec.amount) < 0.005 && (e.title || '') === rec.title;
      if (S.expenses.some(same) || plan.add.expenses.some(same)) { plan.skipped++; continue; }
      plan.add.expenses.push(rec);
    }
  }
  return plan;
}

function planBackup(d) {
  if (!d || d.app !== 'autolog' || !Array.isArray(d.vehicles)) throw new Error('backup');
  const plan = { kind: 'backup', add: {}, skipped: 0, invalid: 0, settings: d.settings || null };
  for (const k of KINDS) {
    const have = new Set(S[k].map((x) => x.id));
    const list = (Array.isArray(d[k]) ? d[k] : []).filter((x) => x && typeof x.id === 'string');
    plan.add[k] = list.filter((x) => !have.has(x.id));
    plan.skipped += list.length - plan.add[k].length;
  }
  // Lo que no tenga su vehículo (ni en los datos ni en la copia) no se puede importar
  const vids = new Set([...S.vehicles, ...plan.add.vehicles].map((v) => v.id));
  for (const k of ['fuel', 'expenses', 'reminders', 'parts']) {
    const ok = plan.add[k].filter((x) => vids.has(x.vehicle_id));
    plan.invalid += plan.add[k].length - ok.length;
    plan.add[k] = ok;
  }
  return plan;
}

export const planCounts = (plan) => Object.fromEntries(KINDS.map((k) => [k, (plan.add[k] || []).length]));

// Aplica el plan: los vehículos primero (los demás dependen de ellos). Se envía al servidor por la cola.
export function applyImport(plan, { withSettings = false } = {}) {
  for (const k of KINDS) putMany(k, plan.add[k] || []);
  if (withSettings && plan.settings) putSettings(plan.settings);
}
