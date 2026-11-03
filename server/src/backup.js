// Full backup with attachments, as a ZIP:
//   autolog.json        { app, version, exported_at, settings, vehicles, fuel, expenses, reminders, files }
//   files/<id>          each photo / PDF, as stored
// GET  /v1/backup   streams the ZIP (no compression: photos and PDFs are already compressed).
// POST /v1/restore  takes that ZIP and MERGES it: adds what's missing, never overwrites or deletes what exists.
//                   So restoring twice, or into an installation that already has data, is safe.
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Zip, ZipPassThrough, Unzip, UnzipInflate } from 'fflate';
import { CONFIG } from './config.js';
import { sql, TABLES, clean, readAll } from './db.js';
import { fileOf, KINDS as FILE_KINDS, OK_MIME, MAX_BYTES } from './files.js';
import { getPrefs, setPrefs, cleanPrefs } from './settings.js';

const ORDER = ['vehicles', 'fuel', 'expenses', 'reminders']; // vehicles first: the rest point to them
const ID = /^[\w-]{1,64}$/;

// ------------------------------------------------------------ backup (stream)
export async function backupStream() {
  const data = { app: 'autolog', version: 2, exported_at: new Date().toISOString(), settings: await getPrefs(), ...(await readAll()) };
  let push;
  const out = new ReadableStream({ start(c) { push = c; } });
  const zip = new Zip((err, chunk, final) => {
    if (err) { push.error(err); return; }
    push.enqueue(chunk);
    if (final) push.close();
  });
  (async () => {
    const json = new ZipPassThrough('autolog.json');
    zip.add(json);
    json.push(new TextEncoder().encode(JSON.stringify(data, null, 1)), true);
    for (const f of data.files) {
      const entry = new ZipPassThrough('files/' + f.id);
      zip.add(entry);
      try {
        for await (const chunk of createReadStream(fileOf(f.id))) entry.push(new Uint8Array(chunk));
      } catch (e) { console.warn('[backup] missing file ' + f.id); }
      entry.push(new Uint8Array(0), true);
    }
    zip.end();
  })().catch((e) => push.error(e));
  return out;
}

// ------------------------------------------------------------ restore (merge)
// body: a web ReadableStream with the ZIP. Returns { added: { vehicles, ... }, skipped, invalid } or throws.
export async function restoreStream(body, { withSettings = false } = {}) {
  const tmp = path.join(CONFIG.filesDir, '.restore-' + Date.now());
  await fs.mkdir(tmp, { recursive: true });
  try {
    let json = null;
    const writes = [];
    const uz = new Unzip((file) => {
      const name = file.name;
      const isJson = name === 'autolog.json';
      const fileId = name.startsWith('files/') ? name.slice(6) : null;
      if (!isJson && !(fileId && ID.test(fileId))) return; // anything else in the ZIP is ignored
      const parts = [];
      let size = 0;
      file.ondata = (err, chunk, final) => {
        if (err) throw err;
        size += chunk.length;
        if (size > (isJson ? 200 * 1024 * 1024 : MAX_BYTES)) throw new Error('entry too big: ' + name);
        parts.push(chunk);
        if (!final) return;
        const buf = Buffer.concat(parts);
        if (isJson) json = buf.toString('utf8');
        else writes.push(fs.writeFile(path.join(tmp, fileId), buf));
      };
      file.start();
    });
    uz.register(UnzipInflate);
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { uz.push(new Uint8Array(0), true); break; }
      uz.push(value);
    }
    await Promise.all(writes);

    let d;
    try { d = JSON.parse(json || ''); } catch (e) { d = null; }
    if (!d || d.app !== 'autolog' || !Array.isArray(d.vehicles)) {
      const e = new Error('not an AutoLog backup'); e.code = 'not_backup'; throw e;
    }
    return await merge(d, tmp, withSettings);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function merge(d, tmp, withSettings) {
  const added = { vehicles: 0, fuel: 0, expenses: 0, reminders: 0, files: 0 };
  let skipped = 0, invalid = 0;
  await sql.begin(async (tx) => {
    for (const kind of ORDER) {
      const { table, fields } = TABLES[kind], keys = Object.keys(fields);
      for (const x of Array.isArray(d[kind]) ? d[kind] : []) {
        const { rec, error } = clean(kind, x || {});
        if (error) { invalid++; continue; }
        try {
          const r = await tx`insert into ${tx(table)} ${tx(rec, 'id', ...keys)} on conflict (id) do nothing returning id`;
          if (r.length) added[kind]++; else skipped++;
        } catch (e) {
          if (e.code === '23503') { invalid++; continue; } // its vehicle doesn't exist
          throw e;
        }
      }
    }
    for (const f of Array.isArray(d.files) ? d.files : []) {
      if (!f || !ID.test(f.id || '') || !FILE_KINDS.includes(f.parent_kind) || !OK_MIME.test(String(f.mime || ''))) { invalid++; continue; }
      const src = path.join(tmp, f.id);
      try { await fs.access(src); } catch (e) { invalid++; continue; } // metadata without the file
      const rec = { id: f.id, vehicle_id: String(f.vehicle_id || ''), parent_kind: f.parent_kind, parent_id: String(f.parent_id || '').slice(0, 64),
        name: String(f.name || 'file').slice(0, 200), mime: String(f.mime), size: +f.size || 0 };
      try {
        const r = await tx`insert into autolog_file ${tx(rec)} on conflict (id) do nothing returning id`;
        if (!r.length) { skipped++; continue; }
      } catch (e) {
        if (e.code === '23503') { invalid++; continue; }
        throw e;
      }
      await fs.rename(src, fileOf(f.id));
      added.files++;
    }
  });
  if (withSettings && d.settings) {
    const { prefs } = cleanPrefs(d.settings);
    if (prefs) await setPrefs(prefs);
  }
  return { added, skipped, invalid };
}

