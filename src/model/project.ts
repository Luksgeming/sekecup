import { dist } from '../geometry/vec';
import { WALL_DEFAULTS, type Failure, type Opening, type Project, type Vec2 } from './types';

const MIN_WALL_LENGTH = 0.01;
const EPS = 1e-9;

const newId = () => crypto.randomUUID();

export function emptyProject(name = 'Rumah Baru'): Project {
  return { version: 1, name, walls: [], openings: [], rooms: [] };
}

export function addWall(p: Project, a: Vec2, b: Vec2): Project {
  if (dist(a, b) < MIN_WALL_LENGTH) return p;
  return { ...p, walls: [...p.walls, { id: newId(), a, b, ...WALL_DEFAULTS }] };
}

export function removeWall(p: Project, wallId: string): Project {
  return {
    ...p,
    walls: p.walls.filter((w) => w.id !== wallId),
    openings: p.openings.filter((o) => o.wallId !== wallId),
  };
}

export function addOpening(p: Project, o: Omit<Opening, 'id'>): Project | Failure {
  const wall = p.walls.find((w) => w.id === o.wallId);
  if (!wall) return { error: 'Dinding tidak ditemukan' };

  const start = o.offset - o.width / 2;
  const end = o.offset + o.width / 2;
  if (o.width <= 0 || start < -EPS || end > dist(wall.a, wall.b) + EPS) {
    return { error: 'Tidak muat di dinding ini' };
  }
  if (o.sill + o.height > wall.height + EPS) return { error: 'Lebih tinggi dari dinding' };

  const overlaps = p.openings.some(
    (other) =>
      other.wallId === o.wallId &&
      start < other.offset + other.width / 2 - EPS &&
      end > other.offset - other.width / 2 + EPS,
  );
  if (overlaps) return { error: 'Bertabrakan dengan pintu/jendela lain' };

  return { ...p, openings: [...p.openings, { ...o, id: newId() }] };
}

export function removeOpening(p: Project, id: string): Project {
  return { ...p, openings: p.openings.filter((o) => o.id !== id) };
}

export function addRoom(p: Project, name: string, points: Vec2[]): Project | Failure {
  if (points.length < 3) return { error: 'Ruangan butuh minimal 3 titik' };
  return { ...p, rooms: [...p.rooms, { id: newId(), name, points }] };
}

export function removeRoom(p: Project, id: string): Project {
  return { ...p, rooms: p.rooms.filter((r) => r.id !== id) };
}
