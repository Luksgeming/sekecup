import { FURNITURE } from '../interior/kinds';
import type { Furniture, Project, Vec2 } from '../model/types';
import { pointInPolygon } from './polygon';

/** The four plan corners of a piece of furniture after rotation. */
export function footprint(f: Furniture): Vec2[] {
  const { w, d } = FURNITURE[f.kind].size;
  const r = (f.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x, y]) => ({ x: f.x + x * cos - y * sin, y: f.y + x * sin + y * cos }));
}

/** The topmost (last placed) furniture under a plan point. */
export function furnitureAt(p: Project, at: Vec2): Furniture | undefined {
  for (let i = p.furniture.length - 1; i >= 0; i--) {
    if (pointInPolygon(at, footprint(p.furniture[i]))) return p.furniture[i];
  }
  return undefined;
}
