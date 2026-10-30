import type { FloorMaterial, FurnitureKind } from '../interior/kinds';

export type { FloorMaterial, FurnitureKind };

export type Vec2 = { x: number; y: number };

export type Wall = { id: string; a: Vec2; b: Vec2; thickness: number; height: number; color: string };

export type OpeningType = 'door' | 'window';

// offset = distance (m) from wall point `a` to the opening's center, along the wall
export type Opening = {
  id: string;
  wallId: string;
  type: OpeningType;
  offset: number;
  width: number;
  height: number;
  sill: number;
};

export type Room = { id: string; name: string; points: Vec2[]; floor: FloorMaterial; ceilingColor: string };

// x, y = center on the plan; rotation in degrees, clockwise on screen
export type Furniture = { id: string; kind: FurnitureKind; x: number; y: number; rotation: number; color: string };

export type Project = {
  version: 2;
  name: string;
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
  furniture: Furniture[];
};

export type Failure = { error: string };

export const WALL_DEFAULTS = { thickness: 0.15, height: 2.8, color: '#f2efe8' };
export const ROOM_DEFAULTS = { floor: 'keramik' as FloorMaterial, ceilingColor: '#f7f6f2' };
export const DOOR_DEFAULTS = { width: 0.9, height: 2.1, sill: 0 };
export const WINDOW_DEFAULTS = { width: 1.2, height: 1.2, sill: 0.9 };
