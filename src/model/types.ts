export type Vec2 = { x: number; y: number };

export type Wall = { id: string; a: Vec2; b: Vec2; thickness: number; height: number };

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

export type Room = { id: string; name: string; points: Vec2[] };

export type Project = { version: 1; name: string; walls: Wall[]; openings: Opening[]; rooms: Room[] };

export type Failure = { error: string };

export const WALL_DEFAULTS = { thickness: 0.15, height: 2.8 };
export const DOOR_DEFAULTS = { width: 0.9, height: 2.1, sill: 0 };
export const WINDOW_DEFAULTS = { width: 1.2, height: 1.2, sill: 0.9 };
