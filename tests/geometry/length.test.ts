import { describe, it, expect } from 'vitest';
import { parseLength, pointAtLength } from '../../src/geometry/length';

describe('parseLength', () => {
  it.each([
    ['4.5', 4.5],
    ['4,5', 4.5],
    ['450cm', 4.5],
    ['450 cm', 4.5],
    ['4.5m', 4.5],
    [' 3 ', 3],
  ])('reads %s as %d m', (text, m) => {
    expect(parseLength(text)).toBeCloseTo(m);
  });

  it.each(['abc', '', '0', '-2', '4.5.1', 'cm'])('rejects %j', (text) => {
    expect(parseLength(text)).toBeUndefined();
  });
});

describe('pointAtLength', () => {
  it('goes the given length toward a point', () => {
    expect(pointAtLength({ x: 0, y: 0 }, { x: 10, y: 0 }, 4.5)).toEqual({ x: 4.5, y: 0 });
  });

  it('keeps the length on a diagonal', () => {
    const p = pointAtLength({ x: 1, y: 1 }, { x: 4, y: 5 }, 2);
    expect(Math.hypot(p.x - 1, p.y - 1)).toBeCloseTo(2);
    expect(p.x).toBeCloseTo(1 + 2 * 0.6);
  });

  it('defaults to the +x direction when toward equals from', () => {
    expect(pointAtLength({ x: 1, y: 1 }, { x: 1, y: 1 }, 2)).toEqual({ x: 3, y: 1 });
  });
});
