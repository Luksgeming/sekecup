import type { Vec2 } from '../model/types';

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k });
export const length = (v: Vec2): number => Math.hypot(v.x, v.y);
export const dist = (a: Vec2, b: Vec2): number => length(sub(a, b));

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  return len === 0 ? { x: 0, y: 0 } : scale(v, 1 / len);
}
