import { validateOpening } from '../model/project';
import { isFloorMaterial, isFurnitureKind, isHexColor } from '../interior/kinds';
import { ROOM_DEFAULTS, WALL_DEFAULTS, type Failure, type Furniture, type Opening, type Project, type Room, type Vec2, type Wall } from '../model/types';

export const PROJECT_EXTENSION = '.rea.json';

export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 2);
}

class Invalid extends Error {}

const fail = (msg: string): never => {
  throw new Invalid(msg);
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function num(v: unknown, what: string): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fail(`${what} tidak valid`);
}

function positive(v: unknown, what: string): number {
  const n = num(v, what);
  return n > 0 ? n : fail(`${what} harus lebih dari 0`);
}

function str(v: unknown, what: string): string {
  return typeof v === 'string' ? v : fail(`${what} tidak valid`);
}

function vec(v: unknown, what: string): Vec2 {
  if (!isObj(v)) fail(`${what} tidak valid`);
  const o = v as Record<string, unknown>;
  return { x: num(o.x, what), y: num(o.y, what) };
}

function list(v: unknown, what: string): unknown[] {
  return Array.isArray(v) ? v : fail(`${what} tidak valid`);
}

function wall(v: unknown): Wall {
  if (!isObj(v)) fail('Dinding tidak valid');
  const o = v as Record<string, unknown>;
  return {
    id: str(o.id, 'ID dinding'),
    a: vec(o.a, 'Titik dinding'),
    b: vec(o.b, 'Titik dinding'),
    thickness: positive(o.thickness, 'Tebal dinding'),
    height: positive(o.height, 'Tinggi dinding'),
    color: o.color === undefined ? WALL_DEFAULTS.color : color(o.color, 'Warna dinding'),
  };
}

function color(v: unknown, what: string): string {
  return isHexColor(v) ? v.toLowerCase() : fail(`${what} tidak valid`);
}

function furniture(v: unknown): Furniture {
  if (!isObj(v)) fail('Furnitur tidak valid');
  const o = v as Record<string, unknown>;
  if (!isFurnitureKind(o.kind)) fail(`Jenis furnitur tidak dikenal: ${String(o.kind)}`);
  return {
    id: str(o.id, 'ID furnitur'),
    kind: o.kind as Furniture['kind'],
    x: num(o.x, 'Posisi furnitur'),
    y: num(o.y, 'Posisi furnitur'),
    rotation: ((Math.round(num(o.rotation, 'Rotasi furnitur')) % 360) + 360) % 360,
    color: color(o.color, 'Warna furnitur'),
  };
}

function opening(v: unknown, wallIds: Set<string>): Opening {
  if (!isObj(v)) fail('Pintu/jendela tidak valid');
  const o = v as Record<string, unknown>;
  const type = o.type === 'door' || o.type === 'window' ? o.type : fail('Jenis bukaan tidak valid');
  const wallId = str(o.wallId, 'Dinding bukaan');
  if (!wallIds.has(wallId)) fail('Pintu/jendela menempel di dinding yang tidak ada');
  return {
    id: str(o.id, 'ID bukaan'),
    wallId,
    type,
    offset: num(o.offset, 'Posisi bukaan'),
    width: num(o.width, 'Lebar bukaan'),
    height: num(o.height, 'Tinggi bukaan'),
    sill: num(o.sill, 'Ambang bukaan'),
  };
}

function room(v: unknown): Room {
  if (!isObj(v)) fail('Ruangan tidak valid');
  const o = v as Record<string, unknown>;
  const points = list(o.points, 'Titik ruangan').map((pt) => vec(pt, 'Titik ruangan'));
  if (points.length < 3) fail('Ruangan butuh minimal 3 titik');
  const floor = o.floor === undefined ? ROOM_DEFAULTS.floor : isFloorMaterial(o.floor) ? o.floor : fail('Material lantai tidak dikenal');
  return { id: str(o.id, 'ID ruangan'), name: str(o.name, 'Nama ruangan'), points, floor };
}

export function parseProject(text: string): Project | Failure {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'File bukan project REA (format tidak dikenal)' };
  }
  if (!isObj(data)) return { error: 'File bukan project REA' };
  // version 1 files predate interior design; missing colors, floors and furniture get defaults
  if (data.version !== 1 && data.version !== 2) return { error: 'Versi file tidak didukung' };

  try {
    const walls = list(data.walls, 'Daftar dinding').map(wall);
    const wallIds = new Set(walls.map((w) => w.id));
    const openings = list(data.openings, 'Daftar bukaan').map((o) => opening(o, wallIds));
    const rooms = list(data.rooms, 'Daftar ruangan').map(room);
    const items = data.version === 1 ? [] : list(data.furniture, 'Daftar furnitur').map(furniture);

    const ids = [...walls, ...openings, ...rooms, ...items].map((x) => x.id);
    if (new Set(ids).size !== ids.length) fail('Ada ID ganda di file');

    // same rules as placing them with the tools
    openings.forEach((o, i) => {
      const error = validateOpening(walls.find((w) => w.id === o.wallId)!, o, openings.slice(0, i));
      if (error) fail(error);
    });

    return { version: 2, name: str(data.name, 'Nama project'), walls, openings, rooms, furniture: items };
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message };
    throw e;
  }
}
