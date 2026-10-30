import type { Vec2 } from '../model/types';

type V3 = { x: number; y: number; z: number };

/** Where a ray meets the floor (y = 0), as a plan point (3D z is plan y). */
export function floorPoint(origin: V3, dir: V3): Vec2 | undefined {
  if (dir.y >= -1e-6) return undefined;
  const t = -origin.y / dir.y;
  return { x: origin.x + dir.x * t, y: origin.z + dir.z * t };
}
