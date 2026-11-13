// Deshacer: ejecuta un cambio (borrar, marcar un aviso como hecho…) dejándolo "en espera": se ve al momento, pero
// no sale al servidor hasta que caduca el plazo. Deshacer devuelve los registros tal cual estaban (mismo id, mismos
// campos y adjuntos) y quita los cambios en espera de la cola, así que funciona igual sin conexión y no deja
// registros fantasma ni choca con otros móviles (el servidor nunca llegó a enterarse).
import { S, held, release, cancel, persistNow } from './store.js';

const KINDS = ['vehicles', 'fuel', 'expenses', 'reminders', 'parts', 'files'];

/** @returns {{ commit: () => void, undo: () => boolean }} */
export function stage(fn) {
  const before = Object.fromEntries(KINDS.map((k) => [k, [...S[k]]]));
  const tag = held(fn);
  // Qué ha cambiado: quitados (con su posición), modificados (con su versión anterior) y añadidos
  const diff = KINDS.map((k) => {
    const prev = before[k], now = new Map(S[k].map((x) => [x.id, x])), old = new Map(prev.map((x) => [x.id, x]));
    return {
      k,
      removed: prev.map((rec, i) => ({ rec, i })).filter((x) => !now.has(x.rec.id)),
      changed: prev.filter((x) => now.has(x.id) && now.get(x.id) !== x),
      added: S[k].filter((x) => !old.has(x.id)).map((x) => x.id),
    };
  });
  let done = false;
  return {
    // Caducó el plazo: los cambios en espera salen al servidor
    commit() { if (done) return; done = true; release(tag); },
    // Devuelve true si se deshizo (false si ya era tarde)
    undo() {
      if (done) return false;
      done = true;
      for (const { k, removed, changed, added } of diff) {
        if (!removed.length && !changed.length && !added.length) continue;
        const list = S[k].filter((x) => !added.includes(x.id));
        for (const p of changed) { const i = list.findIndex((x) => x.id === p.id); if (i >= 0) list[i] = p; }
        for (const { rec, i } of removed) list.splice(Math.min(i, list.length), 0, rec);
        S[k] = list;
      }
      persistNow();
      cancel(tag);
      return true;
    },
  };
}
