import { describe, it, expect } from 'vitest';
import { floorPoint } from '../../src/view3d/floorPoint';

describe('floorPoint', () => {
  it('finds where a ray looking down hits the floor, in plan coordinates', () => {
    expect(floorPoint({ x: 1, y: 10, z: 2 }, { x: 0, y: -1, z: 0 })).toEqual({ x: 1, y: 2 });
  });

  it('follows a slanted ray', () => {
    const p = floorPoint({ x: 0, y: 4, z: 0 }, { x: 1, y: -1, z: 0.5 })!;
    expect(p.x).toBeCloseTo(4);
    expect(p.y).toBeCloseTo(2);
  });

  it('returns undefined for a ray that never reaches the floor', () => {
    expect(floorPoint({ x: 0, y: 4, z: 0 }, { x: 1, y: 0.2, z: 0 })).toBeUndefined();
  });
});
