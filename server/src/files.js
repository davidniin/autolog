// Adjuntos (fotos y PDF) de gastos, repostajes y vehículos. El fichero va al disco (FILES_DIR/<id>) y sus datos a
// autolog_file. Solo se aceptan imágenes y PDF, hasta 15 MB.
import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from './config.js';
import { sql } from './db.js';

export const MAX_BYTES = 15 * 1024 * 1024;
const KINDS = ['vehicles', 'expenses', 'fuel']; // a qué se puede adjuntar (fuel: tickets de gasolinera)
const OK_MIME = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;

const fileOf = (id) => path.join(CONFIG.filesDir, id);

export async function initFiles() { await fs.mkdir(CONFIG.filesDir, { recursive: true }); }

// Sube uno. form = campos multipart: file, id, vehicle_id, parent_kind, parent_id
export async function saveFile(form) {
  const f = form.file;
  if (!f || typeof f === 'string') return { error: 'missing file', code: 'file_missing' };
  if (!OK_MIME.test(f.type)) return { error: 'only images or PDF', code: 'file_type' };
  if (f.size > MAX_BYTES) return { error: 'max 15 MB', code: 'file_too_big' };
  if (!KINDS.includes(form.parent_kind)) return { error: 'invalid parent_kind', code: 'bad_parent' };
  const rec = {
    id: String(form.id || '').replace(/[^\w-]/g, '').slice(0, 64),
    vehicle_id: String(form.vehicle_id || ''),
    parent_kind: form.parent_kind,
    parent_id: String(form.parent_id || '').slice(0, 64),
    name: String(f.name || 'archivo').slice(0, 200),
    mime: f.type,
    size: f.size,
  };
  if (!rec.id || !rec.vehicle_id || !rec.parent_id) return { error: 'missing id, vehicle_id or parent_id', code: 'missing_ids' };
  await fs.writeFile(fileOf(rec.id), Buffer.from(await f.arrayBuffer()));
  try {
    await sql`insert into autolog_file ${sql(rec)} on conflict (id) do nothing`;
  } catch (e) {
    await fs.rm(fileOf(rec.id), { force: true });
    if (e.code === '23503') return { error: 'vehicle not found', code: 'no_vehicle' };
    throw e;
  }
  return { rec };
}

export async function readFile(id) {
  const [rec] = await sql`select id, name, mime from autolog_file where id = ${id}`;
  if (!rec) return null;
  try { return { rec, data: await fs.readFile(fileOf(rec.id)) }; } catch (e) { return null; }
}

// Borra los adjuntos que cumplan `where`: { id } | { vehicle_id } | { parent_kind, parent_id }
export async function removeFiles(where) {
  const rows = where.id ? await sql`delete from autolog_file where id = ${where.id} returning id`
    : where.vehicle_id ? await sql`delete from autolog_file where vehicle_id = ${where.vehicle_id} returning id`
      : await sql`delete from autolog_file where parent_kind = ${where.parent_kind} and parent_id = ${where.parent_id} returning id`;
  await Promise.all(rows.map((r) => fs.rm(fileOf(r.id), { force: true })));
}
