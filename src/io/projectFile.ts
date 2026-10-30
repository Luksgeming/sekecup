import { validateOpening } from '../model/project';
import type { Failure, Opening, Project, Room, Vec2, Wall } from '../model/types';

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
  return { id: str(o.id, 'ID ruangan'), name: str(o.name, 'Nama ruangan'), points };
}

export function parseProject(text: string): Project | Failure {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'File bukan project REA (format tidak dikenal)' };
  }
  if (!isObj(data)) return { error: 'File bukan project REA' };
  if (data.version !== 1) return { error: 'Versi file tidak didukung' };

  try {
    const walls = list(data.walls, 'Daftar dinding').map(wall);
    const wallIds = new Set(walls.map((w) => w.id));
    const openings = list(data.openings, 'Daftar bukaan').map((o) => opening(o, wallIds));
    const rooms = list(data.rooms, 'Daftar ruangan').map(room);

    const ids = [...walls, ...openings, ...rooms].map((x) => x.id);
    if (new Set(ids).size !== ids.length) fail('Ada ID ganda di file');

    // same rules as placing them with the tools
    openings.forEach((o, i) => {
      const error = validateOpening(walls.find((w) => w.id === o.wallId)!, o, openings.slice(0, i));
      if (error) fail(error);
    });

    return { version: 1, name: str(data.name, 'Nama project'), walls, openings, rooms };
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message };
    throw e;
  }
}
