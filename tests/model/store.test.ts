import { describe, it, expect, vi } from 'vitest';
import { Store } from '../../src/model/store';
import { addWall, emptyProject } from '../../src/model/project';

const p0 = emptyProject();
const p1 = addWall(p0, { x: 0, y: 0 }, { x: 1, y: 0 });
const p2 = addWall(p1, { x: 1, y: 0 }, { x: 1, y: 1 });

describe('Store', () => {
  it('undoes and redoes', () => {
    const s = new Store(p0);
    s.apply(p1);
    s.undo();
    expect(s.project).toBe(p0);
    s.redo();
    expect(s.project).toBe(p1);
  });

  it('drops redo history after a new apply', () => {
    const s = new Store(p0);
    s.apply(p1);
    s.undo();
    s.apply(p2);
    expect(s.canRedo).toBe(false);
  });

  it('ignores applying the same project', () => {
    const s = new Store(p0);
    s.apply(p0);
    expect(s.canUndo).toBe(false);
  });

  it('notifies listeners once per change and supports unsubscribe', () => {
    const s = new Store(p0);
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.apply(p1);
    s.apply(p1);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.apply(p2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('load replaces the project and clears history', () => {
    const s = new Store(p0);
    s.apply(p1);
    s.load(p2);
    expect(s.project).toBe(p2);
    expect(s.canUndo).toBe(false);
  });

  it('caps history at 200 steps', () => {
    const s = new Store(p0);
    let p = p0;
    for (let i = 0; i < 250; i++) {
      p = addWall(p, { x: i, y: 0 }, { x: i + 1, y: 0 });
      s.apply(p);
    }
    let undos = 0;
    while (s.canUndo) { s.undo(); undos++; }
    expect(undos).toBe(200);
  });
});
