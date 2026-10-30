import { describe, it, expect, vi } from 'vitest';
import { startAutosave, type KeyValue } from '../../src/storage/autosave';
import { Store } from '../../src/model/store';
import { addWall, emptyProject } from '../../src/model/project';
import { serializeProject } from '../../src/io/projectFile';

function memory(initial?: string): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>(initial ? [['rea:current', initial]] : []);
  return { data, get: async (k) => data.get(k), set: async (k, v) => void data.set(k, v) };
}

describe('startAutosave', () => {
  it('loads the last saved project', async () => {
    const saved = addWall(emptyProject(), { x: 0, y: 0 }, { x: 3, y: 0 });
    const store = new Store(emptyProject());
    expect(await startAutosave(store, memory(serializeProject(saved)))).toEqual({ ok: true });
    expect(store.project).toEqual(saved);
  });

  it('saves 500 ms after a change', async () => {
    vi.useFakeTimers();
    const kv = memory();
    const store = new Store(emptyProject());
    await startAutosave(store, kv);
    store.apply(addWall(store.project, { x: 0, y: 0 }, { x: 1, y: 0 }));
    expect(kv.data.has('rea:current')).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(kv.data.get('rea:current')).toContain('"walls"');
    vi.useRealTimers();
  });

  it('reports ok: false when storage is unavailable', async () => {
    const broken: KeyValue = { get: () => Promise.reject(new Error('no idb')), set: () => Promise.reject(new Error('no idb')) };
    const store = new Store(emptyProject());
    expect(await startAutosave(store, broken)).toEqual({ ok: false });
  });

  it('keeps an empty project when the saved data is corrupt', async () => {
    const store = new Store(emptyProject());
    const before = store.project;
    await startAutosave(store, memory('{broken'));
    expect(store.project).toBe(before);
  });
});
