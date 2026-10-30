import { get, set } from 'idb-keyval';
import type { Store } from '../model/store';
import { parseProject, serializeProject } from '../io/projectFile';

export type KeyValue = {
  get: (key: string) => Promise<string | undefined>;
  set: (key: string, value: string) => Promise<void>;
};

const KEY = 'rea:current';
const DELAY_MS = 500;

const indexedDb: KeyValue = { get: (k) => get<string>(k), set: (k, v) => set(k, v) };

/** Restores the last project and saves every change after a short pause. */
export async function startAutosave(store: Store, kv: KeyValue = indexedDb): Promise<{ ok: boolean }> {
  try {
    const saved = await kv.get(KEY);
    if (saved) {
      const p = parseProject(saved);
      if (!('error' in p)) store.load(p);
    }
  } catch {
    return { ok: false };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  store.subscribe((p) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      kv.set(KEY, serializeProject(p)).catch(() => {});
    }, DELAY_MS);
  });
  return { ok: true };
}
