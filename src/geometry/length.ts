import type { Vec2 } from '../model/types';
import { add, length, scale, sub } from './vec';

/** Reads a typed length like "4.5", "4,5", "450cm" or "4.5 m" as meters. */
export function parseLength(text: string): number | undefined {
  const m = text.trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?|\.\d+)\s*(cm|m)?$/);
  if (!m) return undefined;
  const value = Number(m[1]) / (m[2] === 'cm' ? 100 : 1);
  return value > 0 ? value : undefined;
}

export function pointAtLength(from: Vec2, toward: Vec2, len: number): Vec2 {
  const d = sub(toward, from);
  const l = length(d);
  const dir = l === 0 ? { x: 1, y: 0 } : scale(d, 1 / l);
  return add(from, scale(dir, len));
}

/**
 * A length typed while drawing (canvas box or command line), CAD style: a whole number is
 * millimeters ("4500"), a decimal is meters ("4,5"), and m, cm or mm can be written out.
 */
export function parseDrawingLength(text: string): number | undefined {
  const m = text.trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?|\.\d+)\s*(mm|cm|m)?$/);
  if (!m) return undefined;
  const unit = m[2] ?? (m[1].includes('.') ? 'm' : 'mm');
  const value = Number(m[1]) / { mm: 1000, cm: 100, m: 1 }[unit as 'mm' | 'cm' | 'm'];
  return value > 0 ? +value.toFixed(6) : undefined;
}
