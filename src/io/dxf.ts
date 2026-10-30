import type { Project, Vec2 } from '../model/types';
import { add, normalize, scale, sub } from '../geometry/vec';
import { polygonArea } from '../geometry/polygon';
import { footprint } from '../geometry/footprint';
import { FURNITURE } from '../interior/kinds';

// Minimal DXF R12 (AC1009): opens in AutoCAD, LibreCAD, DraftSight and most viewers.
// Plan y grows downward on screen; CAD y grows upward, so y is negated.

const LAYERS: [name: string, color: number][] = [
  ['WALLS', 7],
  ['OPENINGS', 4],
  ['ROOMS', 2],
  ['FURNITURE', 3],
];

const fmt = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(4);

export function projectToDxf(p: Project): string {
  const out: string[] = [];
  const pair = (code: number, value: string | number) => out.push(String(code), String(value));
  const cad = (v: Vec2): Vec2 => ({ x: v.x, y: -v.y });

  const line = (layer: string, a: Vec2, b: Vec2) => {
    const [ca, cb] = [cad(a), cad(b)];
    pair(0, 'LINE');
    pair(8, layer);
    pair(10, fmt(ca.x));
    pair(20, fmt(ca.y));
    pair(30, fmt(0));
    pair(11, fmt(cb.x));
    pair(21, fmt(cb.y));
    pair(31, fmt(0));
  };

  pair(0, 'SECTION');
  pair(2, 'HEADER');
  pair(9, '$ACADVER');
  pair(1, 'AC1009');
  pair(9, '$INSUNITS');
  pair(70, 6); // meters
  pair(0, 'ENDSEC');

  pair(0, 'SECTION');
  pair(2, 'TABLES');
  pair(0, 'TABLE');
  pair(2, 'LAYER');
  pair(70, LAYERS.length);
  for (const [name, color] of LAYERS) {
    pair(0, 'LAYER');
    pair(2, name);
    pair(70, 0);
    pair(62, color);
    pair(6, 'CONTINUOUS');
  }
  pair(0, 'ENDTAB');
  pair(0, 'ENDSEC');

  pair(0, 'SECTION');
  pair(2, 'ENTITIES');

  for (const w of p.walls) {
    const dir = normalize(sub(w.b, w.a));
    const n = scale({ x: -dir.y, y: dir.x }, w.thickness / 2);
    line('WALLS', add(w.a, n), add(w.b, n));
    line('WALLS', sub(w.a, n), sub(w.b, n));
  }

  for (const o of p.openings) {
    const w = p.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const dir = normalize(sub(w.b, w.a));
    const n = scale({ x: -dir.y, y: dir.x }, w.thickness / 2);
    const start = add(w.a, scale(dir, o.offset - o.width / 2));
    const end = add(w.a, scale(dir, o.offset + o.width / 2));
    // jambs on both sides of the opening
    line('OPENINGS', add(start, n), sub(start, n));
    line('OPENINGS', add(end, n), sub(end, n));
    if (o.type === 'window') line('OPENINGS', start, end);
    else line('OPENINGS', start, add(start, scale({ x: -dir.y, y: dir.x }, o.width)));
  }

  const closedPolyline = (layer: string, points: Vec2[]) => {
    pair(0, 'POLYLINE');
    pair(8, layer);
    pair(66, 1);
    pair(70, 1); // closed
    for (const pt of points) {
      const c = cad(pt);
      pair(0, 'VERTEX');
      pair(8, layer);
      pair(10, fmt(c.x));
      pair(20, fmt(c.y));
      pair(30, fmt(0));
    }
    pair(0, 'SEQEND');
    pair(8, layer);
  };

  const text = (layer: string, at: Vec2, height: number, value: string) => {
    const c = cad(at);
    pair(0, 'TEXT');
    pair(8, layer);
    pair(10, fmt(c.x));
    pair(20, fmt(c.y));
    pair(30, fmt(0));
    pair(40, height);
    pair(1, value);
  };

  for (const r of p.rooms) {
    closedPolyline('ROOMS', r.points);
    const center = scale(r.points.reduce(add, { x: 0, y: 0 }), 1 / r.points.length);
    text('ROOMS', center, 0.25, `${r.name} (${polygonArea(r.points).toFixed(2)} m2)`);
  }

  for (const f of p.furniture) {
    closedPolyline('FURNITURE', footprint(f));
    text('FURNITURE', f, 0.1, FURNITURE[f.kind].label);
  }

  pair(0, 'ENDSEC');
  pair(0, 'EOF');
  return out.join('\n') + '\n';
}
