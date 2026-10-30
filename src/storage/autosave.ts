import { get, set } from 'idb-keyval';
import type { Store } from '../model/store';
import { parseProjectWithNotes, serializeProject } from '../io/projectFile';

export type KeyValue = {
  get: (key: string) => Promise<string | undefined>;
  set: (key: string, value: string) => Promise<void>;
};

/** `dropped`: pieces left out of the restored drawing because their kind left the catalog. */
export type Autosave = { ok: boolean; flush: () => Promise<void>; dropped: number };

const KEY = 'rea:current';
const BACKUP_KEY = 'rea:backup';
const DELAY_MS = 500;
const READ_TIMEOUT_MS = 3000;

const indexedDb: KeyValue = { get: (k) => get<string>(k), set: (k, v) => set(k, v) };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

/** Restores the last project and saves every change after a short pause. */
export async function startAutosave(
  store: Store,
  kv: KeyValue = indexedDb,
  { onWriteError = () => {} }: { onWriteError?: () => void } = {},
): Promise<Autosave> {
  const before = store.project;
  let saved: string | undefined;
  try {
    saved = await withTimeout(kv.get(KEY), READ_TIMEOUT_MS);
  } catch {
    return { ok: false, flush: async () => {}, dropped: 0 };
  }
  // the user may have started drawing while storage was slow; their work wins
  let dropped = 0;
  if (saved && store.project === before) {
    const r = parseProjectWithNotes(saved);
    if (!('error' in r)) {
      dropped = r.dropped;
      // keep the untouched old save, since the next autosave overwrites it without those pieces
      if (dropped) await kv.set(BACKUP_KEY, saved).catch(() => {});
      store.load(r.project);
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  // anything drawn while the saved copy was loading still needs saving
  let dirty = store.project !== before;
  let reported = false;

  const flush = async () => {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    try {
      await kv.set(KEY, serializeProject(store.project));
    } catch {
      if (!reported) onWriteError();
      reported = true;
    }
  };

  store.subscribe(() => {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), DELAY_MS);
  });
  return { ok: true, flush, dropped };
}
