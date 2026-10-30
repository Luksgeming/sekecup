import { describe, it, expect } from 'vitest';
import { dimensionsFor } from '../../src/plan/dimensions';
import { roomSchedule } from '../../src/plan/schedule';
import { parseCommand } from '../../src/plan/commands';
import { furnitureSymbol } from '../../src/plan/symbols';
import { LAYERS, loadLayers, saveLayers, visibleForPicking } from '../../src/plan/layers';
import { addFurniture, addRoom, addWall, emptyProject } from '../../src/model/project';
import { FURNITURE, FURNITURE_KINDS, hangsFromCeiling } from '../../src/interior/kinds';
import type { Project } from '../../src/model/types';

function house(): Project {
  let p = emptyProject();
  const pts = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }];
  pts.forEach((a, i) => (p = addWall(p, a, pts[(i + 1) % 4])));
  p = addWall(p, { x: 3.5, y: 0 }, { x: 3.5, y: 5 }); // partition
  p = addRoom(p, 'Ruang Tamu', [{ x: 0, y: 0 }, { x: 3.5, y: 0 }, { x: 3.5, y: 5 }, { x: 0, y: 5 }]) as Project;
  return addRoom(p, 'Kamar', [{ x: 3.5, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 3.5, y: 5 }]) as Project;
}

describe('dimensionsFor', () => {
  it('dimensions each outside wall in millimeters, outside the house', () => {
    const dims = dimensionsFor(house());
    expect(dims.map((d) => d.text).sort()).toEqual(['5000', '5000', '6000', '6000']);
    const top = dims.find((d) => d.from.y === 0 && d.to.y === 0)!;
    expect(top.a.y).toBeLessThan(0);
    expect(top.b.y).toBeLessThan(0);
  });

  it('skips walls inside the house', () => {
    expect(dimensionsFor(house()).some((d) => d.from.x === 3.5 && d.to.x === 3.5)).toBe(false);
  });

  it('puts dimensions outside the inside corner of an L-shaped house', () => {
    let p = emptyProject();
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }];
    pts.forEach((a, i) => (p = addWall(p, a, pts[(i + 1) % pts.length])));
    p = addRoom(p, 'L', pts) as Project;
    const inner = dimensionsFor(p).find((d) => d.from.x === 10 && d.to.x === 4)!;
    expect(inner).toBeDefined();
    // the wall from (10,4) to (4,4): the house is above it (y < 4), so its dimension goes below
    expect(inner.a.y).toBeGreaterThan(4);
  });

  it('dimensions every wall when there are no rooms yet', () => {
    expect(dimensionsFor(addWall(emptyProject(), { x: 0, y: 0 }, { x: 4.25, y: 0 }))[0].text).toBe('4250');
  });
});

describe('roomSchedule', () => {
  it('lists rooms with area and a total', () => {
    const s = roomSchedule(house());
    expect(s.rows).toEqual([
      { name: 'Ruang Tamu', area: 17.5 },
      { name: 'Kamar', area: 12.5 },
    ]);
    expect(s.total).toBeCloseTo(30);
  });
});

describe('parseCommand', () => {
  it.each([
    ['dinding', { kind: 'tool', tool: 'wall' }],
    ['W', { kind: 'tool', tool: 'wall' }],
    ['pintu', { kind: 'tool', tool: 'door' }],
    ['j', { kind: 'tool', tool: 'window' }],
    ['RUANG', { kind: 'tool', tool: 'room' }],
    ['furnitur', { kind: 'tool', tool: 'furniture' }],
    ['pilih', { kind: 'tool', tool: 'select' }],
    ['zoom', { kind: 'action', action: 'zoom' }],
    ['z', { kind: 'action', action: 'zoom' }],
    ['undo', { kind: 'action', action: 'undo' }],
    ['u', { kind: 'action', action: 'undo' }],
    ['redo', { kind: 'action', action: 'redo' }],
  ])('%s', (text, expected) => {
    expect(parseCommand(text)).toEqual(expected);
  });

  it('reads a whole number as millimeters', () => {
    expect(parseCommand('4500')).toEqual({ kind: 'length', meters: 4.5 });
    expect(parseCommand('99')).toEqual({ kind: 'length', meters: 0.099 });
  });

  it('reads a decimal number as meters', () => {
    expect(parseCommand('4,5')).toEqual({ kind: 'length', meters: 4.5 });
  });

  it('explains a zero length', () => {
    expect(parseCommand('0')).toEqual({ kind: 'unknown', text: '0' });
  });

  it('reads units', () => {
    expect(parseCommand('450cm')).toEqual({ kind: 'length', meters: 4.5 });
    expect(parseCommand('3200mm')).toEqual({ kind: 'length', meters: 3.2 });
  });

  it('reports unknown text', () => {
    expect(parseCommand('hapus semua')).toEqual({ kind: 'unknown', text: 'hapus semua' });
  });
});

describe('furnitureSymbol', () => {
  it.each(FURNITURE_KINDS)('%s stays inside its footprint', (kind) => {
    const { w, d } = FURNITURE[kind].size;
    const sym = furnitureSymbol(kind);
    const inside = (p: { x: number; y: number }) => Math.abs(p.x) <= w / 2 + 1e-6 && Math.abs(p.y) <= d / 2 + 1e-6;
    for (const [a, b] of sym.lines) expect(inside(a) && inside(b)).toBe(true);
    for (const c of sym.circles) {
      expect(Math.abs(c.c.x) + c.r).toBeLessThanOrEqual(w / 2 + 1e-6);
      expect(Math.abs(c.c.y) + c.r).toBeLessThanOrEqual(d / 2 + 1e-6);
    }
    expect(sym.lines.length + sym.circles.length).toBeGreaterThan(0);
    expect(sym.dashed).toBe(hangsFromCeiling(kind));
  });
});

describe('visibleForPicking', () => {
  it('leaves hidden layers out of what can be clicked', () => {
    let p = addFurniture(house(), 'sofa-3', { x: 1, y: 1 });
    const all = { walls: true, hatch: true, openings: true, rooms: true, furniture: true, dimensions: true, schedule: true };
    expect(visibleForPicking(p, all)).toBe(p);
    const q = visibleForPicking(p, { ...all, furniture: false, walls: false });
    expect(q.furniture).toHaveLength(0);
    expect(q.walls).toHaveLength(0);
    expect(q.openings).toHaveLength(0);
    expect(q.rooms).toHaveLength(2);
  });
});

describe('layers', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('shows every layer by default', () => {
    const l = loadLayers(memory());
    expect(LAYERS.every((x) => l[x.id])).toBe(true);
  });

  it('remembers hidden layers', () => {
    const s = memory();
    saveLayers({ ...loadLayers(s), dimensions: false }, s);
    expect(loadLayers(s).dimensions).toBe(false);
    expect(loadLayers(s).walls).toBe(true);
  });
});
