import type { Project } from '../model/types';
import { polygonArea } from '../geometry/polygon';

export type Schedule = { rows: { name: string; area: number }[]; total: number };

/** The room schedule table: every room with its floor area (m², two decimals) and the total. */
export function roomSchedule(p: Project): Schedule {
  const rows = p.rooms.map((r) => ({ name: r.name, area: Math.round(polygonArea(r.points) * 100) / 100 }));
  return { rows, total: rows.reduce((t, r) => t + r.area, 0) };
}
