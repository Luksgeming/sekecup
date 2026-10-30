import type { Vec2, Wall } from '../model/types';
import { dist } from './vec';

type SnapOptions = { walls: Wall[]; from?: Vec2; ortho: boolean; grid?: number; radius?: number };

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function snapPoint(p: Vec2, { walls, from, ortho, grid = 0.1, radius = 0.2 }: SnapOptions): Vec2 {
  let target = p;
  if (ortho && from) {
    target = Math.abs(p.x - from.x) >= Math.abs(p.y - from.y) ? { x: p.x, y: from.y } : { x: from.x, y: p.y };
  }

  let best: Vec2 | undefined;
  let bestDist = radius;
  for (const w of walls) {
    for (const end of [w.a, w.b]) {
      const d = dist(end, target);
      if (d <= bestDist) {
        best = end;
        bestDist = d;
      }
    }
  }
  if (best) return { ...best };

  // with ortho, keep the locked axis exactly on `from`
  return {
    x: ortho && from && target.x === from.x ? from.x : roundTo(target.x, grid),
    y: ortho && from && target.y === from.y ? from.y : roundTo(target.y, grid),
  };
}
