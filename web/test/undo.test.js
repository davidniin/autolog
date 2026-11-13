// Deshacer al borrar: el borrado queda en espera, no sale al servidor hasta que caduca el aviso.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S, put, del, flush } from '../src/store.js';
import { stage } from '../src/undo.js';

let calls;
beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn((path, opts) => {
    calls.push({ method: opts.method, path });
    return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ ok: true, rev: 'r' + calls.length }) });
  }));
  const fuel = [{ id: 'f1', vehicle_id: 'v1', date: '2024-05-01', liters: 40 }, { id: 'f2', vehicle_id: 'v1', date: '2024-06-01', liters: 35 }, { id: 'f3', vehicle_id: 'v1', date: '2024-07-01', liters: 30 }];
  Object.assign(S, { vehicles: [{ id: 'v1' }], fuel, expenses: [], reminders: [], parts: [], files: [], queue: [], conflicts: [] });
});

describe('stage / undo', () => {
  it('deletes right away but sends nothing to the server while it can be undone', async () => {
    stage(() => del('fuel', 'f2'));
    await flush();
    expect(S.fuel.map((x) => x.id)).toEqual(['f1', 'f3']);
    expect(calls).toEqual([]);
    expect(S.queue).toHaveLength(1);
  });

  it('undo restores the same record in the same position and leaves the queue empty', async () => {
    const original = S.fuel[1];
    const h = stage(() => del('fuel', 'f2'));
    expect(h.undo()).toBe(true);
    expect(S.fuel.map((x) => x.id)).toEqual(['f1', 'f2', 'f3']);
    expect(S.fuel[1]).toEqual(original);
    expect(S.queue).toEqual([]);
    await flush();
    expect(calls).toEqual([]); // the server never knew
  });

  it('restores the attachments of the deleted record', () => {
    S.files = [{ id: 'a1', parent_kind: 'fuel', parent_id: 'f2' }, { id: 'a2', parent_kind: 'fuel', parent_id: 'f1' }];
    const h = stage(() => del('fuel', 'f2'));
    expect(S.files.map((x) => x.id)).toEqual(['a2']);
    h.undo();
    expect(S.files.map((x) => x.id)).toEqual(['a1', 'a2']);
  });

  it('commit sends the delete once the notice expires, and undo is no longer possible', async () => {
    const h = stage(() => del('fuel', 'f2'));
    h.commit();
    await flush();
    expect(calls).toEqual([{ method: 'DELETE', path: '/v1/fuel/f2' }]);
    expect(h.undo()).toBe(false);
    expect(S.fuel.map((x) => x.id)).toEqual(['f1', 'f3']);
  });

  it('other changes made meanwhile are kept, and a held delete does not lose them', async () => {
    const h = stage(() => del('fuel', 'f2'));
    put('fuel', { id: 'f4', vehicle_id: 'v1', date: '2024-08-01', liters: 20 }); // behind the held delete in the queue
    h.undo();
    expect(S.fuel.map((x) => x.id).sort()).toEqual(['f1', 'f2', 'f3', 'f4']);
    await flush();
    expect(calls).toEqual([{ method: 'PUT', path: '/v1/fuel/f4' }]);
  });

  it('a reminder marked done is restored to its previous state (and its expense removed)', () => {
    const r = { id: 'r1', vehicle_id: 'v1', title: 'ITV', due_date: '2024-05-01' };
    S.reminders = [r];
    const h = stage(() => {
      put('expenses', { id: 'e9', vehicle_id: 'v1', title: 'ITV', amount: 40 });
      put('reminders', { ...r, due_date: '2025-05-01' });
    });
    expect(S.reminders[0].due_date).toBe('2025-05-01');
    h.undo();
    expect(S.reminders).toEqual([r]);
    expect(S.expenses).toEqual([]);
    expect(S.queue).toEqual([]);
  });
});
