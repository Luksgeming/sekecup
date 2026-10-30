import { describe, it, expect } from 'vitest';
import { drawOrder, footprint, furnitureAt } from '../../src/geometry/footprint';
import { addFurniture, emptyProject, updateFurniture } from '../../src/model/project';
import type { Project } from '../../src/model/types';

const bed = (rotation = 0) => {
  const p = addFurniture(emptyProject(), 'kasur-double', { x: 5, y: 5 });
  return updateFurniture(p, p.furniture[0].id, { rotation }) as Project;
};

const extent = (pts: { x: number; y: number }[]) => ({
  w: Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)),
  d: Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)),
});

describe('footprint', () => {
  it('is the catalog size around the center', () => {
    const e = extent(footprint(bed().furniture[0]));
    expect(e.w).toBeCloseTo(1.49);
    expect(e.d).toBeCloseTo(2.04);
  });

  it('swaps width and depth at 90 degrees', () => {
    const e = extent(footprint(bed(90).furniture[0]));
    expect(e.w).toBeCloseTo(2.04);
    expect(e.d).toBeCloseTo(1.49);
  });
});

describe('furnitureAt', () => {
  it('finds furniture under the point', () => {
    const p = bed();
    expect(furnitureAt(p, { x: 5.7, y: 5.9 })?.id).toBe(p.furniture[0].id);
    expect(furnitureAt(p, { x: 5.9, y: 5 })).toBeUndefined();
  });

  it('uses the rotated shape', () => {
    const p = bed(90);
    expect(furnitureAt(p, { x: 5.9, y: 5 })?.id).toBe(p.furniture[0].id);
  });

  it('prefers the smaller piece where two overlap', () => {
    let p = addFurniture(emptyProject(), 'meja-tamu', { x: 0, y: 0 });
    p = addFurniture(p, 'meja-tamu-bundar', { x: 0, y: 0 });
    expect(furnitureAt(p, { x: 0, y: 0 })?.kind).toBe('meja-tamu');
  });
});

describe('furnitureAt with overlapping pieces', () => {
  it('picks the plant standing on a big table placed before it', () => {
    let p = addFurniture(emptyProject(), 'tanaman-daun', { x: 0, y: 0 });
    p = addFurniture(p, 'meja-kerja', { x: 0, y: 0 });
    expect(furnitureAt(p, { x: 0.1, y: 0 })?.kind).toBe('tanaman-daun');
  });
});

describe('overhead pieces', () => {
  it('a click picks the table under a pendant lamp, not the lamp', () => {
    let p = addFurniture(emptyProject(), 'meja-makan', { x: 0, y: 0 });
    p = addFurniture(p, 'lampu-gantung', { x: 0, y: 0 });
    expect(furnitureAt(p, { x: 0, y: 0 })?.kind).toBe('meja-makan');
  });

  it('a lamp with nothing under it can still be picked', () => {
    const p = addFurniture(emptyProject(), 'lampu-gantung', { x: 0, y: 0 });
    expect(furnitureAt(p, { x: 0, y: 0 })?.kind).toBe('lampu-gantung');
  });

  it('draws overhead pieces last', () => {
    let p = addFurniture(emptyProject(), 'kipas-plafon', { x: 0, y: 0 });
    p = addFurniture(p, 'meja-tamu', { x: 0, y: 0 });
    expect(drawOrder(p.furniture).map((f) => f.kind)).toEqual(['meja-tamu', 'kipas-plafon']);
  });
});
