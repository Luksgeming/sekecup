import type { Opening, Vec2, Wall } from '../model/types';
import { dist, normalize, sub } from './vec';

// a solid piece of wall, in wall-local coordinates: along the wall (start..end) and height (bottom..top)
export type Box = { start: number; end: number; bottom: number; top: number };

const EPS = 1e-9;

export function wallBoxes(wall: Wall, openings: Opening[]): Box[] {
  const len = dist(wall.a, wall.b);
  const own = openings
    .filter((o) => o.wallId === wall.id)
    .sort((a, b) => a.offset - b.offset);

  const boxes: Box[] = [];
  let cursor = 0;
  for (const o of own) {
    const start = o.offset - o.width / 2;
    const end = o.offset + o.width / 2;
    boxes.push({ start: cursor, end: start, bottom: 0, top: wall.height });
    boxes.push({ start, end, bottom: 0, top: o.sill });
    boxes.push({ start, end, bottom: o.sill + o.height, top: wall.height });
    cursor = end;
  }
  boxes.push({ start: cursor, end: len, bottom: 0, top: wall.height });

  return boxes.filter((b) => b.end - b.start > EPS && b.top - b.bottom > EPS);
}

export function projectOnWall(wall: Wall, p: Vec2): { offset: number; distance: number } {
  const dir = normalize(sub(wall.b, wall.a));
  const rel = sub(p, wall.a);
  const along = rel.x * dir.x + rel.y * dir.y;
  const offset = Math.min(Math.max(along, 0), dist(wall.a, wall.b));
  const closest = { x: wall.a.x + dir.x * offset, y: wall.a.y + dir.y * offset };
  return { offset, distance: dist(p, closest) };
}
