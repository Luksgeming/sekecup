import type { Vec2 } from '../model/types';
import { normalize, sub } from '../geometry/vec';

type WheelLike = { ctrlKey: boolean; metaKey: boolean; deltaMode: number; deltaX: number; deltaY: number };

/**
 * Trackpads send small pixel deltas (and pinch arrives as ctrl + wheel); mouse
 * wheels send line steps or big round pixel steps. Scrolling a trackpad pans,
 * pinching or turning a mouse wheel zooms.
 */
export function wheelAction(e: WheelLike): 'zoom' | 'pan' {
  if (e.ctrlKey || e.metaKey) return 'zoom';
  if (e.deltaMode !== 0) return 'zoom';
  if (e.deltaX !== 0) return 'pan';
  return Math.abs(e.deltaY) < 50 || !Number.isInteger(e.deltaY) ? 'pan' : 'zoom';
}

/** Unit normal of wall a→b pointing away from `center`, where its length label goes. */
export function labelSide(a: Vec2, b: Vec2, center: Vec2): Vec2 {
  const dir = normalize(sub(b, a));
  const n = { x: -dir.y, y: dir.x };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const toCenter = sub(center, mid);
  return n.x * toCenter.x + n.y * toCenter.y > 0 ? { x: -n.x, y: -n.y } : n;
}
