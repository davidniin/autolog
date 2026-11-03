// Sync with the server: revisions, offline edits chained, conflicts (409) and how they're resolved.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S, put, flush, resolveConflict } from '../src/store.js';

let server; // fake server: id → { rec, rev }
let calls;
function fakeFetch(path, opts) {
  const body = opts.body ? JSON.parse(opts.body) : undefined;
  calls.push({ method: opts.method, path, body });
  const json = (status, d) => Promise.resolve({ status, ok: status < 300, json: () => Promise.resolve(d), text: () => Promise.resolve(JSON.stringify(d)) });
  if (opts.method === 'GET') return json(200, { vehicles: [], fuel: [], expenses: Object.values(server).map((x) => ({ ...x.rec, rev: x.rev })), reminders: [], files: [], settings: null });
  const id = decodeURIComponent(path.split('/').pop());
  const cur = server[id];
  if (body.base_rev && (!cur || cur.rev !== body.base_rev)) return json(409, { code: 'conflict', current: cur ? { ...cur.rec, rev: cur.rev } : null });
  const { base_rev, ...rec } = body;
  const rev = 'r' + (Object.keys(calls).length + 1);
  server[id] = { rec, rev };
  return json(200, { ok: true, rev });
}

beforeEach(() => {
  server = {};
  calls = [];
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  Object.assign(S, { vehicles: [], fuel: [], expenses: [], reminders: [], files: [], queue: [], conflicts: [] });
});

const exp = (over = {}) => ({ id: 'e1', vehicle_id: 'v1', date: '2024-05-01', cat: 'seguro', title: 'Seguro', amount: 400, note: '', ...over });

describe('revisions', () => {
  it('stores the revision returned by the server', async () => {
    put('expenses', exp());
    await flush();
    expect(S.expenses[0].rev).toBe(server.e1.rev);
    expect(calls[0].body.base_rev).toBeUndefined(); // new record: no base
  });

  it('two offline edits of the same record are chained, not a conflict', async () => {
    server.e1 = { rec: exp(), rev: 'r0' };
    S.expenses = [{ ...exp(), rev: 'r0' }];
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    put('expenses', { ...S.expenses[0], amount: 410 });
    put('expenses', { ...S.expenses[0], amount: 420 });
    await flush();
    expect(S.queue).toHaveLength(2);
    vi.stubGlobal('fetch', vi.fn(fakeFetch));
    await flush();
    expect(S.conflicts).toEqual([]);
    expect(server.e1.rec.amount).toBe(420);
  });
});

describe('conflicts', () => {
  beforeEach(() => {
    server.e1 = { rec: exp(), rev: 'r0' };
    S.expenses = [{ ...exp(), rev: 'r0' }];
    server.e1 = { rec: exp({ amount: 420 }), rev: 'r9' }; // another phone changed it
  });

  it('a stale edit is kept aside as a conflict instead of overwriting', async () => {
    put('expenses', { ...S.expenses[0], title: 'Seguro anual' });
    await flush();
    expect(server.e1.rec).toMatchObject({ amount: 420, title: 'Seguro' }); // untouched
    expect(S.conflicts).toHaveLength(1);
    expect(S.conflicts[0]).toMatchObject({ kind: 'expenses', id: 'e1', mine: { title: 'Seguro anual', amount: 400 }, theirs: { amount: 420, rev: 'r9' } });
    expect(S.queue).toEqual([]);
  });

  it('"keep mine" is saved on top of the other version', async () => {
    put('expenses', { ...S.expenses[0], title: 'Seguro anual' });
    await flush();
    resolveConflict(S.conflicts[0], true);
    await flush();
    expect(S.conflicts).toEqual([]);
    expect(server.e1.rec).toMatchObject({ title: 'Seguro anual', amount: 400 });
  });

  it('"keep the other" takes their version locally and sends nothing', async () => {
    put('expenses', { ...S.expenses[0], title: 'Seguro anual' });
    await flush();
    const n = calls.length;
    resolveConflict(S.conflicts[0], false);
    expect(S.expenses.find((e) => e.id === 'e1')).toMatchObject({ amount: 420, title: 'Seguro' });
    expect(calls.filter((c) => c.method === 'PUT').length).toBe(calls.slice(0, n).filter((c) => c.method === 'PUT').length);
  });

  it('deleted on the other phone: "create it again" recreates it', async () => {
    delete server.e1;
    put('expenses', { ...S.expenses[0], title: 'X' });
    await flush();
    expect(S.conflicts[0].theirs).toBeNull();
    resolveConflict(S.conflicts[0], true);
    await flush();
    expect(server.e1.rec.title).toBe('X');
  });
});
