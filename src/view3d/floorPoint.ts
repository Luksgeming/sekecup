import type { Vec2 } from '../model/types';

type V3 = { x: number; y: number; z: number };

/** Where a ray meets the horizontal plane at `height` (the floor by default), as a plan point (3D z is plan y). */
export function floorPoint(origin: V3, dir: V3, height = 0): Vec2 | undefined {
  const t = (height - origin.y) / dir.y;
  if (!Number.isFinite(t) || t <= 0) return undefined;
  return { x: origin.x + dir.x * t, y: origin.z + dir.z * t };
}
