import { FURNITURE, hangsFromCeiling, type FurnitureKind } from '../interior/kinds';
import type { Vec2 } from '../model/types';

// Line-art plan symbols for furniture, in the piece's own coordinates: x across its width,
// y across its depth with the back at -d/2, centered on the footprint.

export type Symbol2D = { lines: [Vec2, Vec2][]; circles: { c: Vec2; r: number }[]; dashed: boolean };

const P = (x: number, y: number): Vec2 => ({ x, y });

function rect(x0: number, y0: number, x1: number, y1: number): [Vec2, Vec2][] {
  return [
    [P(x0, y0), P(x1, y0)],
    [P(x1, y0), P(x1, y1)],
    [P(x1, y1), P(x0, y1)],
    [P(x0, y1), P(x0, y0)],
  ];
}

type Shape = 'bed' | 'sofa' | 'chair' | 'table' | 'storage' | 'round' | 'stove' | 'lamp';

function shapeOf(kind: FurnitureKind): Shape {
  if (hangsFromCeiling(kind)) return 'lamp';
  if (kind === 'kompor') return 'stove';
  if (/kasur|daybed/.test(kind)) return 'bed';
  if (/sofa/.test(kind)) return 'sofa';
  if (/kursi|bangku|ottoman/.test(kind)) return 'chair';
  if (/bundar|tanaman|sukulen|meja-teh/.test(kind)) return 'round';
  if (/lemari|nakas|komod|bufet|rak|jam|partisi/.test(kind)) return 'storage';
  return 'table';
}

export function furnitureSymbol(kind: FurnitureKind): Symbol2D {
  const { w, d } = FURNITURE[kind].size;
  const [x0, y0, x1, y1] = [-w / 2, -d / 2, w / 2, d / 2];
  const lines = rect(x0, y0, x1, y1);
  const circles: Symbol2D['circles'] = [];
  const inset = Math.min(w, d) * 0.08;

  switch (shapeOf(kind)) {
    case 'bed': {
      // headboard band, a folded sheet line and pillows
      const head = Math.min(0.12, d * 0.08);
      lines.push([P(x0, y0 + head), P(x1, y0 + head)]);
      lines.push([P(x0, y0 + d * 0.35), P(x1, y0 + d * 0.35)]);
      const pillows = w > 1.2 ? 2 : 1;
      const pw = (w - inset * (pillows + 1)) / pillows;
      for (let i = 0; i < pillows; i++) {
        const px = x0 + inset + i * (pw + inset);
        lines.push(...rect(px, y0 + head + 0.05, px + pw, y0 + head + Math.min(0.35, d * 0.18)));
      }
      break;
    }
    case 'sofa': {
      const back = Math.min(0.22, d * 0.28);
      const arm = Math.min(0.2, w * 0.12);
      lines.push([P(x0, y0 + back), P(x1, y0 + back)]);
      lines.push([P(x0 + arm, y0 + back), P(x0 + arm, y1)], [P(x1 - arm, y0 + back), P(x1 - arm, y1)]);
      const seats = Math.max(1, Math.round((w - 2 * arm) / 0.6));
      for (let i = 1; i < seats; i++) {
        const x = x0 + arm + ((w - 2 * arm) / seats) * i;
        lines.push([P(x, y0 + back), P(x, y1)]);
      }
      break;
    }
    case 'chair': {
      const back = Math.min(0.12, d * 0.2);
      lines.push([P(x0, y0 + back), P(x1, y0 + back)]);
      break;
    }
    case 'storage': {
      // CAD convention for cabinets: a cross through the box
      lines.push([P(x0, y0), P(x1, y1)], [P(x0, y1), P(x1, y0)]);
      break;
    }
    case 'round': {
      circles.push({ c: P(0, 0), r: Math.min(w, d) / 2 - 1e-9 });
      lines.length = 0;
      if (/tanaman|sukulen/.test(kind)) circles.push({ c: P(0, 0), r: Math.min(w, d) * 0.22 });
      break;
    }
    case 'stove': {
      const r = Math.min(w, d) * 0.16;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) circles.push({ c: P((sx * w) / 4, (sy * d) / 4 - d * 0.05), r });
      break;
    }
    case 'lamp': {
      lines.length = 0;
      const r = Math.min(w, d) / 2 - 1e-9;
      circles.push({ c: P(0, 0), r });
      lines.push([P(-r, 0), P(r, 0)], [P(0, -r), P(0, r)]);
      break;
    }
    case 'table':
      lines.push(...rect(x0 + inset, y0 + inset, x1 - inset, y1 - inset));
      break;
  }
  return { lines, circles, dashed: hangsFromCeiling(kind) };
}
