// PostgreSQL: vehículos, repostajes, gastos, recordatorios y adjuntos. Los ids los pone el cliente (el móvil), así reenviar un cambio
// tras un corte de red no duplica nada: cada escritura es un "upsert" por id.
import postgres from 'postgres';
import { CONFIG } from './config.js';

export const sql = postgres(CONFIG.databaseUrl, { max: 5, onnotice: () => {} });

const SCHEMA = `
create table if not exists autolog_vehicle (
  id             text primary key,
  name           text not null,
  kind           text not null default 'coche',
  plate          text not null default '',
  fuel_type      text not null default 'gasolina',
  start_km       integer,
  purchase_price numeric(10,2),
  purchase_date  date,
  note           text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create table if not exists autolog_fuel (
  id         text primary key,
  vehicle_id text not null references autolog_vehicle(id) on delete cascade,
  date       date not null,
  km         integer not null,
  liters     numeric(8,3) not null,
  total      numeric(10,2) not null,
  full_tank  boolean not null default true,
  station    text not null default '',
  note       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists autolog_fuel_vehicle on autolog_fuel (vehicle_id, km);
create table if not exists autolog_expense (
  id         text primary key,
  vehicle_id text not null references autolog_vehicle(id) on delete cascade,
  date       date not null,
  km         integer,
  cat        text not null,
  title      text not null default '',
  amount     numeric(10,2) not null,
  note       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists autolog_expense_vehicle on autolog_expense (vehicle_id, date);
-- Recordatorio: avisa en due_date y/o due_km (lo primero que llegue). Si tiene intervalo (every_km / every_months),
-- al marcarlo como hecho la web calcula el siguiente; si no, se borra.
create table if not exists autolog_reminder (
  id           text primary key,
  vehicle_id   text not null references autolog_vehicle(id) on delete cascade,
  title        text not null,
  cat          text not null default 'otros',
  every_km     integer,
  every_months integer,
  due_date     date,
  due_km       integer,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Adjunto: el fichero está en FILES_DIR/<id>. parent = el gasto o el vehículo al que pertenece.
create table if not exists autolog_file (
  id          text primary key,
  vehicle_id  text not null references autolog_vehicle(id) on delete cascade,
  parent_kind text not null,
  parent_id   text not null,
  name        text not null,
  mime        text not null,
  size        integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists autolog_file_parent on autolog_file (parent_kind, parent_id);
-- Notificaciones push (alerts.js): ajustes (claves VAPID), móviles suscritos y lo ya avisado
create table if not exists autolog_setting (
  key   text primary key,
  value text not null
);
create table if not exists autolog_push (
  endpoint   text primary key,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists autolog_notified (
  reminder_id text primary key,
  stamp       text not null,
  level       text not null,
  sent_at     timestamptz not null default now()
);
`;

// Crea las tablas si no existen. Reintenta un rato: al arrancar el servidor, PostgreSQL puede ir por detrás.
export async function migrate() {
  for (let i = 1; ; i++) {
    try {
      await sql.unsafe(SCHEMA);
      return;
    } catch (e) {
      if (i >= 30) throw e;
      console.warn('[db] PostgreSQL no responde (' + e.message + '), reintento en 2 s');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// Campos de cada colección. Tipos: s texto, i entero, n número, d fecha AAAA-MM-DD, b sí/no. '!' = obligatorio.
// Las listas cerradas (tipo de vehículo, categoría de gasto...) las define la web: aquí solo se guardan.
export const TABLES = {
  vehicles: {
    table: 'autolog_vehicle',
    fields: { name: 's!', kind: 's', plate: 's', fuel_type: 's', start_km: 'i', purchase_price: 'n', purchase_date: 'd', note: 's' },
  },
  fuel: {
    table: 'autolog_fuel',
    fields: { vehicle_id: 's!', date: 'd!', km: 'i!', liters: 'n!', total: 'n!', full_tank: 'b', station: 's', note: 's' },
  },
  expenses: {
    table: 'autolog_expense',
    fields: { vehicle_id: 's!', date: 'd!', km: 'i', cat: 's!', title: 's', amount: 'n!', note: 's' },
  },
  reminders: {
    table: 'autolog_reminder',
    fields: { vehicle_id: 's!', title: 's!', cat: 's', every_km: 'i', every_months: 'i', due_date: 'd', due_km: 'i', note: 's' },
  },
};

// Deja solo campos conocidos y con el tipo correcto. Devuelve { rec } o { error }.
export function clean(kind, x) {
  const o = { id: String(x.id || '').slice(0, 64) };
  if (!o.id) return { error: 'falta id' };
  for (const [k, t] of Object.entries(TABLES[kind].fields)) {
    const type = t[0], req = t.endsWith('!'), v = x[k];
    if (v === undefined || v === null || v === '') {
      if (req) return { error: 'falta ' + k };
      o[k] = type === 's' ? '' : type === 'b' ? false : null;
      continue;
    }
    if (type === 's') {
      o[k] = String(v).trim().slice(0, 500);
      if (req && !o[k]) return { error: 'falta ' + k };
    } else if (type === 'b') {
      o[k] = !!v;
    } else if (type === 'd') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) return { error: k + ': fecha no válida' };
      o[k] = v;
    } else {
      const n = +v;
      if (!Number.isFinite(n) || n < 0 || n > 1e8) return { error: k + ': número no válido' };
      o[k] = type === 'i' ? Math.round(n) : Math.round(n * 1000) / 1000;
    }
  }
  return { rec: o };
}

export function upsert(kind, rec) {
  const { table, fields } = TABLES[kind], keys = Object.keys(fields);
  return sql`
    insert into ${sql(table)} ${sql(rec, 'id', ...keys)}
    on conflict (id) do update set ${sql(rec, ...keys)}, updated_at = now()`;
}

export function remove(kind, id) {
  return sql`delete from ${sql(TABLES[kind].table)} where id = ${id}`;
}

// Todo de una vez: son pocos datos (unos cientos de filas por vehículo y año) y así el móvil lo tiene sin red.
export async function readAll() {
  const [vehicles, fuel, expenses, reminders, files] = await Promise.all([
    sql`select id, name, kind, plate, fuel_type, start_km, purchase_price::float8 as purchase_price,
          purchase_date::text as purchase_date, note
        from autolog_vehicle order by created_at, id`,
    sql`select id, vehicle_id, date::text as date, km, liters::float8 as liters, total::float8 as total,
          full_tank, station, note
        from autolog_fuel order by date desc, km desc`,
    sql`select id, vehicle_id, date::text as date, km, cat, title, amount::float8 as amount, note
        from autolog_expense order by date desc, created_at desc`,
    sql`select id, vehicle_id, title, cat, every_km, every_months, due_date::text as due_date, due_km, note
        from autolog_reminder order by created_at, id`,
    sql`select id, vehicle_id, parent_kind, parent_id, name, mime, size from autolog_file order by created_at, id`,
  ]);
  return { vehicles, fuel, expenses, reminders, files };
}
