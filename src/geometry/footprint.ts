import { FURNITURE } from '../interior/kinds';
import type { Furniture, Project, Vec2 } from '../model/types';
import { pointInPolygon, polygonArea } from './polygon';

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

/**
 * The furniture under a plan point. When pieces overlap the smallest one wins, so a
 * sofa standing on a rug stays clickable; among equal sizes the last placed wins.
 */
export function furnitureAt(p: Project, at: Vec2): Furniture | undefined {
  let best: Furniture | undefined;
  let bestArea = Infinity;
  for (const f of p.furniture) {
    const corners = footprint(f);
    const area = polygonArea(corners);
    if (area <= bestArea && pointInPolygon(at, corners)) {
      best = f;
      bestArea = area;
    }
  }
  return best;
}

/** Drawing order for the plan: rugs lie under everything else. */
export function drawOrder(items: Furniture[]): Furniture[] {
  return [...items.filter((f) => f.kind === 'karpet'), ...items.filter((f) => f.kind !== 'karpet')];
}
