import { describe, it, expect } from 'vitest';
import { footprint, furnitureAt } from '../../src/geometry/footprint';
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
    expect(e.w).toBeCloseTo(1.6);
    expect(e.d).toBeCloseTo(2.0);
  });

  it('swaps width and depth at 90 degrees', () => {
    const e = extent(footprint(bed(90).furniture[0]));
    expect(e.w).toBeCloseTo(2.0);
    expect(e.d).toBeCloseTo(1.6);
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

  it('prefers the item on top (last added)', () => {
    let p = addFurniture(emptyProject(), 'karpet', { x: 0, y: 0 });
    p = addFurniture(p, 'meja-tamu', { x: 0, y: 0 });
    expect(furnitureAt(p, { x: 0, y: 0 })?.kind).toBe('meja-tamu');
  });
});

describe('furnitureAt with a rug', () => {
  it('picks the sofa standing on a rug placed after it', () => {
    let p = addFurniture(emptyProject(), 'sofa-3', { x: 0, y: 0 });
    p = addFurniture(p, 'karpet', { x: 0, y: 0.3 });
    expect(furnitureAt(p, { x: 0.2, y: 0 })?.kind).toBe('sofa-3');
  });
});
