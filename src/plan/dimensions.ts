import type { Project, Vec2 } from '../model/types';
import { add, dist, scale } from '../geometry/vec';
import { pointInPolygon } from '../geometry/polygon';
import { labelSide } from './navigation';

/** A dimension for one wall: measured points, the offset dimension line, and its text in millimeters. */
export type Dimension = { from: Vec2; to: Vec2; a: Vec2; b: Vec2; normal: Vec2; text: string };

const OFFSET = 0.6; // meters from the wall face to the dimension line

/** Dimensions for the outside walls (all walls while no rooms are drawn), placed outside the house. */
export function dimensionsFor(p: Project): Dimension[] {
  if (!p.walls.length) return [];
  const ends = p.walls.flatMap((w) => [w.a, w.b]);
  const center = scale(ends.reduce(add, { x: 0, y: 0 }), 1 / ends.length);
  return p.walls.flatMap((w) => {
    const n = labelSide(w.a, w.b, center);
    const mid = scale(add(w.a, w.b), 0.5);
    const probe = add(mid, scale(n, w.thickness / 2 + 0.2));
    // a wall with a room on its "outside" is a partition
    if (p.rooms.some((r) => pointInPolygon(probe, r.points))) return [];
    const off = scale(n, w.thickness / 2 + OFFSET);
    return [{ from: w.a, to: w.b, a: add(w.a, off), b: add(w.b, off), normal: n, text: String(Math.round(dist(w.a, w.b) * 1000)) }];
  });
}
