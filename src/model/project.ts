import { dist } from '../geometry/vec';
import { polygonArea } from '../geometry/polygon';
import { isFloorMaterial, isHexColor } from '../interior/kinds';

const FURNITURE_COLOR = '#b9b2a3';
import { ROOM_DEFAULTS, WALL_DEFAULTS, type Failure, type FloorMaterial, type FurnitureKind, type Opening, type Project, type Vec2, type Wall } from './types';

const MIN_WALL_LENGTH = 0.01;
const EPS = 1e-9;
const MIN_ROOM_AREA = 0.01;
const CORNER_EPS = 0.001;

const newId = () => crypto.randomUUID();

export function emptyProject(name = 'Rumah Baru'): Project {
  return { version: 2, name, walls: [], openings: [], rooms: [], furniture: [] };
}

export function isEmptyProject(p: Project): boolean {
  return p.walls.length === 0 && p.openings.length === 0 && p.rooms.length === 0 && p.furniture.length === 0;
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
  // drop repeated clicks on the same spot, including a last point equal to the first
  const clean = points.filter((pt, i) => dist(pt, points[(i + points.length - 1) % points.length]) > CORNER_EPS || i === 0);
  if (clean.length > 1 && dist(clean[0], clean.at(-1)!) <= CORNER_EPS) clean.pop();
  if (clean.length < 3) return { error: 'Ruangan butuh minimal 3 titik' };
  if (polygonArea(clean) < MIN_ROOM_AREA) return { error: 'Ruangan tidak punya luas' };
  return { ...p, rooms: [...p.rooms, { id: newId(), name, points: clean, ...ROOM_DEFAULTS }] };
}

export function removeRoom(p: Project, id: string): Project {
  if (!p.rooms.some((r) => r.id === id)) return p;
  return { ...p, rooms: p.rooms.filter((r) => r.id !== id) };
}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const MAX_THICKNESS = 1;
const MAX_HEIGHT = 10;

export function updateWall(
  p: Project,
  id: string,
  patch: Partial<Pick<Wall, 'thickness' | 'height'>> & { length?: number },
): Project | Failure {
  const wall = p.walls.find((w) => w.id === id);
  if (!wall) return { error: 'Dinding tidak ditemukan' };
  const { thickness = wall.thickness, height = wall.height } = patch;
  const oldLength = dist(wall.a, wall.b);
  const length = patch.length ?? oldLength;
  if (!(thickness > 0) || !(height > 0) || !(length >= MIN_WALL_LENGTH)) return { error: 'Ukuran harus lebih dari 0' };
  if (thickness > MAX_THICKNESS) return { error: `Tebal dinding maksimal ${MAX_THICKNESS} m` };
  if (height > MAX_HEIGHT) return { error: `Tinggi dinding maksimal ${MAX_HEIGHT} m` };
  if (same(thickness, wall.thickness) && same(height, wall.height) && same(length, oldLength)) return p;

  // a new length moves the corner at b, so walls and rooms joined there move with it
  let base = p;
  if (!same(length, oldLength)) {
    const k = length / oldLength;
    const b = { x: wall.a.x + (wall.b.x - wall.a.x) * k, y: wall.a.y + (wall.b.y - wall.a.y) * k };
    const moved = moveCorner(p, wall.b, b);
    if ('error' in moved) return { error: `Tidak bisa mengubah panjang: ${moved.error.toLowerCase()}` };
    base = moved;
  }

  const next: Wall = { ...base.walls.find((w) => w.id === id)!, thickness, height };
  const own = base.openings.filter((o) => o.wallId === id);
  for (const o of own) {
    const error = validateOpening(next, o, own.filter((x) => x.id !== o.id));
    if (error) return { error: `Pintu/jendela di dinding ini jadi tidak muat (${error.toLowerCase()})` };
  }
  return { ...base, walls: base.walls.map((w) => (w.id === id ? next : w)) };
}

export function updateOpening(
  p: Project,
  id: string,
  patch: Partial<Pick<Opening, 'width' | 'height' | 'sill' | 'offset'>>,
): Project | Failure {
  const o = p.openings.find((x) => x.id === id);
  if (!o) return { error: 'Pintu/jendela tidak ditemukan' };
  const next = { ...o, ...patch };
  if ((['width', 'height', 'sill', 'offset'] as const).every((k) => same(next[k], o[k]))) return p;
  const wall = p.walls.find((w) => w.id === o.wallId)!;
  const error = validateOpening(wall, next, p.openings.filter((x) => x.id !== id));
  if (error) return { error };
  return { ...p, openings: p.openings.map((x) => (x.id === id ? next : x)) };
}

export function renameRoom(p: Project, id: string, name: string): Project | Failure {
  const room = p.rooms.find((r) => r.id === id);
  if (!room) return { error: 'Ruangan tidak ditemukan' };
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Nama ruangan tidak boleh kosong' };
  if (trimmed === room.name) return p;
  return { ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, name: trimmed } : r)) };
}

const atCorner = (v: Vec2, c: Vec2) => dist(v, c) <= CORNER_EPS;

export function cornerAt(p: Project, at: Vec2, radius = 0.2): Vec2 | undefined {
  let best: Vec2 | undefined;
  let bestDist = radius;
  for (const w of p.walls) {
    for (const end of [w.a, w.b]) {
      const d = dist(end, at);
      if (d <= bestDist) {
        best = end;
        bestDist = d;
      }
    }
  }
  return best;
}

/** Moves every wall end (and room point) sitting at `from` to `to`, keeping openings measured from the fixed end. */
export function moveCorner(p: Project, from: Vec2, to: Vec2): Project | Failure {
  const touched = p.walls.filter((w) => atCorner(w.a, from) || atCorner(w.b, from));
  if (!touched.length || dist(from, to) < 1e-9) return p;

  const walls = p.walls.map((w) => {
    if (!touched.includes(w)) return w;
    return { ...w, a: atCorner(w.a, from) ? to : w.a, b: atCorner(w.b, from) ? to : w.b };
  });

  const openings = p.openings.map((o) => {
    const old = p.walls.find((w) => w.id === o.wallId)!;
    if (!touched.includes(old) || !atCorner(old.a, from)) return o;
    // point a moved: keep the distance from the fixed end b
    const next = walls.find((w) => w.id === o.wallId)!;
    return { ...o, offset: dist(next.a, next.b) - (dist(old.a, old.b) - o.offset) };
  });

  for (const w of walls) {
    if (!touched.some((t) => t.id === w.id)) continue;
    if (dist(w.a, w.b) < MIN_WALL_LENGTH) return { error: 'Dinding jadi terlalu pendek' };
    const own = openings.filter((o) => o.wallId === w.id);
    for (const o of own) {
      if (validateOpening(w, o, own.filter((x) => x.id !== o.id))) return { error: 'Pintu/jendela jadi tidak muat' };
    }
  }

  const rooms = p.rooms.map((r) =>
    r.points.some((pt) => atCorner(pt, from)) ? { ...r, points: r.points.map((pt) => (atCorner(pt, from) ? to : pt)) } : r,
  );
  return { ...p, walls, openings, rooms };
}

export function setWallColor(p: Project, id: string, color: string): Project | Failure {
  const wall = p.walls.find((w) => w.id === id);
  if (!wall) return { error: 'Dinding tidak ditemukan' };
  if (!isHexColor(color)) return { error: 'Warna tidak valid' };
  if (wall.color === color) return p;
  return { ...p, walls: p.walls.map((w) => (w.id === id ? { ...w, color } : w)) };
}

export function setRoomFloor(p: Project, id: string, floor: FloorMaterial): Project | Failure {
  const room = p.rooms.find((r) => r.id === id);
  if (!room) return { error: 'Ruangan tidak ditemukan' };
  if (!isFloorMaterial(floor)) return { error: 'Material lantai tidak dikenal' };
  if (room.floor === floor) return p;
  return { ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, floor } : r)) };
}

export function addFurniture(p: Project, kind: FurnitureKind, at: Vec2): Project {
  // realistic models keep their own textures; color is stored for older files only
  const item = { id: newId(), kind, x: at.x, y: at.y, rotation: 0, color: FURNITURE_COLOR };
  return { ...p, furniture: [...p.furniture, item] };
}

export function moveFurniture(p: Project, id: string, to: Vec2): Project {
  const f = p.furniture.find((x) => x.id === id);
  if (!f || (same(f.x, to.x) && same(f.y, to.y))) return p;
  return { ...p, furniture: p.furniture.map((x) => (x.id === id ? { ...x, x: to.x, y: to.y } : x)) };
}

const normalizeDegrees = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

export function updateFurniture(p: Project, id: string, patch: { rotation?: number; color?: string }): Project | Failure {
  const f = p.furniture.find((x) => x.id === id);
  if (!f) return { error: 'Furnitur tidak ditemukan' };
  if (patch.color !== undefined && !isHexColor(patch.color)) return { error: 'Warna tidak valid' };
  if (patch.rotation !== undefined && !Number.isFinite(patch.rotation)) return { error: 'Rotasi tidak valid' };
  const rotation = patch.rotation === undefined ? f.rotation : normalizeDegrees(patch.rotation);
  const color = patch.color ?? f.color;
  if (rotation === f.rotation && color === f.color) return p;
  return { ...p, furniture: p.furniture.map((x) => (x.id === id ? { ...x, rotation, color } : x)) };
}

export function removeFurniture(p: Project, id: string): Project {
  if (!p.furniture.some((f) => f.id === id)) return p;
  return { ...p, furniture: p.furniture.filter((f) => f.id !== id) };
}

/** Applies a style suggestion: its first color to every wall and its floor to one room or all rooms. */
export function applyRecommendation(p: Project, rec: { palette: string[]; floor?: FloorMaterial }, roomId?: string): Project {
  const color = rec.palette.find(isHexColor);
  const floor = rec.floor;
  const walls = color ? p.walls.map((w) => (w.color === color ? w : { ...w, color })) : p.walls;
  const rooms = floor ? p.rooms.map((r) => (r.floor === floor || (roomId && r.id !== roomId) ? r : { ...r, floor })) : p.rooms;
  const changed = walls.some((w, i) => w !== p.walls[i]) || rooms.some((r, i) => r !== p.rooms[i]);
  return changed ? { ...p, walls, rooms } : p;
}

export function setRoomCeiling(p: Project, id: string, color: string): Project | Failure {
  const room = p.rooms.find((r) => r.id === id);
  if (!room) return { error: 'Ruangan tidak ditemukan' };
  if (!isHexColor(color)) return { error: 'Warna tidak valid' };
  if (room.ceilingColor === color) return p;
  return { ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, ceilingColor: color } : r)) };
}

/** Ceiling height of the house: its tallest wall, or the default wall height when there are none. */
export function ceilingHeight(p: Project): number {
  return p.walls.length ? Math.max(...p.walls.map((w) => w.height)) : WALL_DEFAULTS.height;
}
