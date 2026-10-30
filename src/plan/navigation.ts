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

const LINE_PX = 16;
const PAGE_PX = 800;
const GESTURE_GAP_MS = 150;

export type WheelRead = { action: 'zoom' | 'pan'; dx: number; dy: number; speed: number };

/**
 * Reads wheel events as one gesture: deltas in pixels whatever unit the browser
 * used (Firefox reports lines), and a pan that speeds up mid-flick stays a pan
 * until the events pause.
 */
export class WheelGesture {
  private last = -Infinity;
  private action: 'zoom' | 'pan' = 'zoom';

  read(e: WheelLike, now: number): WheelRead {
    const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? PAGE_PX : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    const zoomKey = e.ctrlKey || e.metaKey;
    if (zoomKey) this.action = 'zoom';
    else if (now - this.last > GESTURE_GAP_MS) this.action = wheelAction(e);
    this.last = now;
    // a pinch sends tiny deltas and needs a strong factor; a wheel notch is ~100 px
    const speed = zoomKey && Math.abs(dy) < 10 ? 0.01 : zoomKey ? 0.002 : 0.0015;
    return { action: this.action, dx, dy, speed };
  }
}
