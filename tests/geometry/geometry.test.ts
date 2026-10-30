import { describe, it, expect } from 'vitest';
import { snapPoint } from '../../src/geometry/snap';
import { polygonArea } from '../../src/geometry/polygon';
import { wallBoxes, projectOnWall } from '../../src/geometry/wallBoxes';
import type { Opening, Wall } from '../../src/model/types';

const wall: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness: 0.15, height: 2.8, color: '#f2efe8' };

const opening = (o: Partial<Opening>): Opening => ({
  id: 'o', wallId: 'w', type: 'window', offset: 2, width: 1.2, height: 1.2, sill: 0.9, ...o,
});

const near = (v: { x: number; y: number }) => ({ x: +v.x.toFixed(6), y: +v.y.toFixed(6) });

describe('snapPoint', () => {
  it('snaps to the 0.1 m grid', () => {
    expect(near(snapPoint({ x: 1.04, y: 2.96 }, { walls: [], ortho: false }))).toEqual({ x: 1, y: 3 });
  });

  it('prefers a nearby wall endpoint over the grid', () => {
    const w = { ...wall, b: { x: 2, y: 2 } };
    expect(snapPoint({ x: 2.15, y: 1.9 }, { walls: [w], ortho: false })).toEqual({ x: 2, y: 2 });
  });

  it('locks to horizontal or vertical when ortho is on', () => {
    expect(near(snapPoint({ x: 3, y: 0.4 }, { walls: [], ortho: true, from: { x: 0, y: 0 } }))).toEqual({ x: 3, y: 0 });
  });
});

describe('polygonArea', () => {
  const rect = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
  it('computes area in m²', () => expect(polygonArea(rect)).toBe(12));
  it('is positive for clockwise order', () => expect(polygonArea([...rect].reverse())).toBe(12));
});

describe('wallBoxes', () => {
  it('returns one full box with no openings', () => {
    expect(wallBoxes(wall, [])).toEqual([{ start: 0, end: 4, bottom: 0, top: 2.8 }]);
  });

  it('splits around a window', () => {
    const boxes = wallBoxes(wall, [opening({})]).map((b) => ({
      start: +b.start.toFixed(6), end: +b.end.toFixed(6), bottom: +b.bottom.toFixed(6), top: +b.top.toFixed(6),
    }));
    expect(boxes).toEqual([
      { start: 0, end: 1.4, bottom: 0, top: 2.8 },
      { start: 1.4, end: 2.6, bottom: 0, top: 0.9 },
      { start: 1.4, end: 2.6, bottom: 2.1, top: 2.8 },
      { start: 2.6, end: 4, bottom: 0, top: 2.8 },
    ]);
  });

  it('has no zero-height box under a door', () => {
    const boxes = wallBoxes(wall, [opening({ type: 'door', sill: 0, height: 2.1, width: 0.9 })]);
    expect(boxes.every((b) => b.top - b.bottom > 0)).toBe(true);
    expect(boxes).toHaveLength(3);
  });

  it('ignores openings on other walls', () => {
    expect(wallBoxes(wall, [opening({ wallId: 'other' })])).toHaveLength(1);
  });
});

describe('projectOnWall', () => {
  it('returns offset along and distance from the wall', () => {
    expect(projectOnWall(wall, { x: 1, y: 0.5 })).toEqual({ offset: 1, distance: 0.5 });
  });
});
