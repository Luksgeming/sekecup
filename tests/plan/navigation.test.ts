import { describe, it, expect } from 'vitest';
import { labelSide, wheelAction } from '../../src/plan/navigation';

const wheel = (o: Partial<{ ctrlKey: boolean; metaKey: boolean; deltaMode: number; deltaX: number; deltaY: number }>) => ({
  ctrlKey: false, metaKey: false, deltaMode: 0, deltaX: 0, deltaY: 0, ...o,
});

describe('wheelAction', () => {
  it('zooms on a trackpad pinch (ctrl wheel)', () => expect(wheelAction(wheel({ ctrlKey: true, deltaY: 3 }))).toBe('zoom'));
  it('zooms with Cmd + scroll', () => expect(wheelAction(wheel({ metaKey: true, deltaY: 40 }))).toBe('zoom'));
  it('pans on a two-finger trackpad scroll', () => expect(wheelAction(wheel({ deltaY: 6, deltaX: 2 }))).toBe('pan'));
  it('pans on a small vertical trackpad scroll', () => expect(wheelAction(wheel({ deltaY: 4.5 }))).toBe('pan'));
  it('zooms on a notched mouse wheel (line mode)', () => expect(wheelAction(wheel({ deltaMode: 1, deltaY: 3 }))).toBe('zoom'));
  it('zooms on a mouse wheel reporting big whole pixel steps', () => expect(wheelAction(wheel({ deltaY: 100 }))).toBe('zoom'));
});

describe('labelSide', () => {
  it('puts the label of the top wall above it, away from the house center', () => {
    const side = labelSide({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 });
    expect(side.y).toBeLessThan(0);
  });

  it('puts the label of the right wall to its right', () => {
    const side = labelSide({ x: 4, y: 0 }, { x: 4, y: 3 }, { x: 2, y: 1.5 });
    expect(side.x).toBeGreaterThan(0);
  });

  it('returns a unit vector', () => {
    const s = labelSide({ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 5 });
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1);
  });
});
