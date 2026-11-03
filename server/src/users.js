// People with access (shared data, own password). The installation's AUTOLOG_TOKEN is the OWNER's password; the owner
// adds people by name and each gets their own random password, shown once. Only its SHA-256 hash is stored, so the
// database never contains a usable password. Removing a person cuts their access immediately.
import crypto from 'node:crypto';
import { sql } from './db.js';

export const OWNER = { id: 'owner', name: '', admin: true }; // name '' = the owner (the app shows "Owner")

const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const ID = /^[\w-]{1,64}$/;

export async function createUser(name) {
  name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) return { error: 'missing name', code: 'bad_input' };
  const token = crypto.randomBytes(24).toString('base64url');
  const id = crypto.randomBytes(8).toString('hex');
  await sql`insert into autolog_user (id, name, token_hash) values (${id}, ${name}, ${hash(token)})`;
  return { user: { id, name }, token }; // the token is only returned here
}

export function listUsers() {
  return sql`select id, name, created_at::text as created_at, last_seen::text as last_seen from autolog_user order by created_at`;
}

export async function deleteUser(id) {
  if (!ID.test(String(id || ''))) return false;
  const r = await sql`delete from autolog_user where id = ${id} returning id`;
  return r.length > 0;
}

// Password → user (or null). last_seen is updated at most once an hour, not on every request.
export async function findByToken(token) {
  if (!token) return null;
  const [u] = await sql`select id, name from autolog_user where token_hash = ${hash(token)}`;
  if (!u) return null;
  sql`update autolog_user set last_seen = now() where id = ${u.id} and (last_seen is null or last_seen < now() - interval '1 hour')`.catch(() => {});
  return { id: u.id, name: u.name, admin: false };
}
