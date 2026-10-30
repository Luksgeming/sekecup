import { dist } from '../geometry/vec';
import { WALL_DEFAULTS, type Failure, type Opening, type Project, type Vec2, type Wall } from './types';

const MIN_WALL_LENGTH = 0.01;
const EPS = 1e-9;

const newId = () => crypto.randomUUID();

export function emptyProject(name = 'Rumah Baru'): Project {
  return { version: 1, name, walls: [], openings: [], rooms: [] };
}

export function isEmptyProject(p: Project): boolean {
  return p.walls.length === 0 && p.openings.length === 0 && p.rooms.length === 0;
}

export function addWall(p: Project, a: Vec2, b: Vec2): Project {
  if (dist(a, b) < MIN_WALL_LENGTH) return p;
  return { ...p, walls: [...p.walls, { id: newId(), a, b, ...WALL_DEFAULTS }] };
}

export function removeWall(p: Project, wallId: string): Project {
  if (!p.walls.some((w) => w.id === wallId)) return p;
  return {
    ...p,
    walls: p.walls.filter((w) => w.id !== wallId),
    openings: p.openings.filter((o) => o.wallId !== wallId),
  };
}

/** Returns why `o` cannot sit on `wall` next to `others`, or undefined when it fits. */
export function validateOpening(wall: Wall, o: Omit<Opening, 'id'>, others: Opening[]): string | undefined {
  const start = o.offset - o.width / 2;
  const end = o.offset + o.width / 2;
  if (o.width <= 0 || o.height <= 0 || o.sill < 0) return 'Ukuran pintu/jendela tidak valid';
  if (start < -EPS || end > dist(wall.a, wall.b) + EPS) return 'Tidak muat di dinding ini';
  if (o.sill + o.height > wall.height + EPS) return 'Lebih tinggi dari dinding';
  const overlaps = others.some(
    (other) =>
      other.wallId === o.wallId &&
      start < other.offset + other.width / 2 - EPS &&
      end > other.offset - other.width / 2 + EPS,
  );
  return overlaps ? 'Bertabrakan dengan pintu/jendela lain' : undefined;
}

export function addOpening(p: Project, o: Omit<Opening, 'id'>): Project | Failure {
  const wall = p.walls.find((w) => w.id === o.wallId);
  if (!wall) return { error: 'Dinding tidak ditemukan' };
  const error = validateOpening(wall, o, p.openings);
  if (error) return { error };
  return { ...p, openings: [...p.openings, { ...o, id: newId() }] };
}

export function removeOpening(p: Project, id: string): Project {
  if (!p.openings.some((o) => o.id === id)) return p;
  return { ...p, openings: p.openings.filter((o) => o.id !== id) };
}

export function addRoom(p: Project, name: string, points: Vec2[]): Project | Failure {
  if (points.length < 3) return { error: 'Ruangan butuh minimal 3 titik' };
  return { ...p, rooms: [...p.rooms, { id: newId(), name, points }] };
}

export function removeRoom(p: Project, id: string): Project {
  if (!p.rooms.some((r) => r.id === id)) return p;
  return { ...p, rooms: p.rooms.filter((r) => r.id !== id) };
}
