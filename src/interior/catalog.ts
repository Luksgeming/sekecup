import * as THREE from 'three';
import { FURNITURE, type FurnitureKind } from './kinds';

// Furniture models built from simple shapes. Local axes: x = width, z = depth
// (plan y), y = up. Every model stands on y = 0 and is centered on its footprint.

const WOOD = '#8b6a4c';
const DARK = '#2f2f2e';
const METAL = '#b9bcbf';
const PORCELAIN = '#fafafa';

const materials = new Map<string, THREE.MeshStandardMaterial>();

function material(color: string, opts: { roughness?: number; opacity?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.roughness ?? 0.8}|${opts.opacity ?? 1}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.8,
      transparent: opts.opacity !== undefined,
      opacity: opts.opacity ?? 1,
    });
    materials.set(key, m);
  }
  return m;
}

type Builder = { g: THREE.Group; box: Box; cyl: Cyl };
type Box = (w: number, h: number, d: number, x: number, bottom: number, z: number, color: string, opts?: { roughness?: number; opacity?: number }) => void;
type Cyl = (rTop: number, rBottom: number, h: number, x: number, bottom: number, z: number, color: string) => void;

function builder(): Builder {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  };
  return {
    g,
    box: (w, h, d, x, bottom, z, color, opts) => add(new THREE.BoxGeometry(w, h, d), material(color, opts), x, bottom + h / 2, z),
    cyl: (rTop, rBottom, h, x, bottom, z, color) =>
      add(new THREE.CylinderGeometry(rTop, rBottom, h, 20), material(color), x, bottom + h / 2, z),
  };
}

function legs(box: Box, w: number, d: number, h: number, inset: number, size: number, color: string): void {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) box(size, h, size, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), color);
  }
}

type Build = (b: Builder, size: { w: number; d: number; h: number }, color: string) => void;

const bed: Build = ({ box }, { w, d, h }, color) => {
  box(w, 0.3, d, 0, 0, 0, WOOD);
  box(w - 0.06, 0.22, d - 0.12, 0, 0.3, 0.03, color, { roughness: 0.95 });
  box(w, h, 0.06, 0, 0, -d / 2 + 0.03, WOOD);
  const pillows = w > 1.2 ? [-w / 4, w / 4] : [0];
  for (const x of pillows) box(Math.min(0.6, w / pillows.length - 0.1), 0.03, 0.35, x, 0.52, -d / 2 + 0.3, '#ffffff', { roughness: 1 });
};

const cabinet: Build = ({ box }, { w, d, h }, color) => {
  box(w, h, d - 0.02, 0, 0, -0.01, color);
  const doors = Math.max(1, Math.round(w / 0.5));
  for (let i = 1; i < doors; i++) box(0.01, h - 0.06, 0.02, -w / 2 + (w / doors) * i, 0.03, d / 2 - 0.01, DARK);
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + (w / doors) * (i + 0.5) + (i % 2 ? -1 : 1) * (w / doors) * 0.35;
    box(0.02, Math.min(0.2, h * 0.3), 0.02, x, h * 0.45, d / 2 - 0.01, METAL);
  }
};

const sofa: Build = ({ box }, { w, d, h }, color) => {
  const arm = Math.min(0.18, w * 0.2);
  box(w, 0.25, d, 0, 0, 0, color);
  box(w, h - 0.25, 0.2, 0, 0.25, -d / 2 + 0.1, color);
  for (const s of [-1, 1]) box(arm, 0.37, d, s * (w / 2 - arm / 2), 0.25, 0, color);
  const seats = Math.max(1, Math.round((w - 2 * arm) / 0.6));
  const sw = (w - 2 * arm) / seats;
  for (let i = 0; i < seats; i++) box(sw - 0.02, 0.15, d - 0.22, -w / 2 + arm + sw * (i + 0.5), 0.25, 0.1, color, { roughness: 1 });
};

const table: Build = ({ box }, { w, d, h }, color) => {
  box(w, 0.04, d, 0, h - 0.04, 0, color);
  legs(box, w, d, h - 0.04, 0.06, 0.05, color);
};

const chair: Build = ({ box }, { w, d, h }, color) => {
  const seatD = d - 0.05;
  box(w, 0.04, seatD, 0, 0.42, 0.025, color);
  legs(box, w, seatD, 0.42, 0.03, 0.035, color);
  box(w, h - 0.46, 0.04, 0, 0.46, -d / 2 + 0.02, color);
};

const BUILDERS: Record<FurnitureKind, Build> = {
  'kasur-single': bed,
  'kasur-double': bed,
  lemari: cabinet,
  nakas: ({ box }, { w, d, h }, color) => {
    box(w, h, d, 0, 0, 0, color);
    box(w - 0.04, 0.01, 0.01, 0, h / 2, d / 2, DARK);
    box(0.1, 0.02, 0.02, 0, h * 0.72, d / 2, METAL);
  },
  'sofa-3': sofa,
  'kursi-santai': sofa,
  'meja-tamu': table,
  'rak-tv': ({ box }, { w, d, h }, color) => {
    box(w, h, d, 0, 0, 0, color);
    box(w - 0.06, h * 0.35, 0.01, 0, h * 0.15, d / 2, '#5a5a57');
  },
  karpet: ({ box }, { w, d, h }, color) => box(w, h, d, 0, 0, 0, color, { roughness: 1 }),
  'meja-makan': table,
  'kursi-makan': chair,
  'kitchen-set': ({ box }, { w, d, h }, color) => {
    box(w, h - 0.04, d - 0.02, 0, 0, -0.01, color);
    box(w, 0.04, d, 0, h - 0.04, 0, '#3b3a38', { roughness: 0.4 });
    box(0.5, 0.005, 0.38, -w / 4, h, 0, METAL);
    box(0.55, 0.005, 0.45, w / 4, h, 0, DARK);
    const doors = Math.max(1, Math.round(w / 0.6));
    for (let i = 1; i < doors; i++) box(0.01, h - 0.1, 0.01, -w / 2 + (w / doors) * i, 0.05, d / 2, '#c9c5bc');
  },
  kulkas: ({ box }, { w, d, h }, color) => {
    box(w, h, d, 0, 0, 0, color, { roughness: 0.35 });
    box(w - 0.02, 0.01, 0.01, 0, h * 0.62, d / 2, '#9fa3a6');
    box(0.03, 0.4, 0.02, w / 2 - 0.06, h * 0.3, d / 2 - 0.01, METAL);
    box(0.03, 0.3, 0.02, w / 2 - 0.06, h * 0.72, d / 2 - 0.01, METAL);
  },
  kloset: ({ box, cyl }, { w, d, h }, color) => {
    box(w, h - 0.4, 0.18, 0, 0.4, -d / 2 + 0.09, color, { roughness: 0.3 });
    cyl(0.17, 0.13, 0.4, 0, 0, d / 2 - 0.2, color);
    box(0.34, 0.03, 0.42, 0, 0.4, d / 2 - 0.21, PORCELAIN);
    box(w, 0.4, 0.12, 0, 0, -d / 2 + 0.24, color, { roughness: 0.3 });
  },
  wastafel: ({ box, cyl }, { w, d, h }, color) => {
    cyl(0.07, 0.09, h - 0.15, 0, 0, -0.05, color);
    box(w, 0.15, d, 0, h - 0.15, 0, color, { roughness: 0.3 });
    box(w - 0.12, 0.005, d - 0.15, 0, h, 0.03, '#dfe7ea');
  },
  bathtub: ({ box }, { w, d, h }, color) => {
    box(w, h, d, 0, 0, 0, color, { roughness: 0.3 });
    box(w - 0.14, 0.005, d - 0.14, 0, h, 0, '#cfe3ea');
  },
  shower: ({ box, cyl }, { w, d, h }, color) => {
    box(w, 0.05, d, 0, 0, 0, PORCELAIN);
    box(w, h - 0.05, 0.01, 0, 0.05, d / 2 - 0.005, color, { opacity: 0.35, roughness: 0.1 });
    box(0.01, h - 0.05, d, w / 2 - 0.005, 0.05, 0, color, { opacity: 0.35, roughness: 0.1 });
    cyl(0.01, 0.01, h - 0.2, -w / 2 + 0.06, 0.05, -d / 2 + 0.06, METAL);
    cyl(0.08, 0.08, 0.02, -w / 2 + 0.12, h - 0.17, -d / 2 + 0.12, METAL);
  },
  'meja-kerja': table,
  'kursi-kerja': ({ box, cyl }, { w, d, h }, color) => {
    cyl(w / 2, w / 2, 0.05, 0, 0, 0, DARK);
    cyl(0.03, 0.03, 0.4, 0, 0.05, 0, METAL);
    box(w - 0.05, 0.08, d - 0.1, 0, 0.45, 0.05, color);
    box(w - 0.1, h - 0.55, 0.06, 0, 0.55, -d / 2 + 0.03, color);
  },
  'rak-buku': ({ box }, { w, d, h }, color) => {
    for (const s of [-1, 1]) box(0.02, h, d, s * (w / 2 - 0.01), 0, 0, color);
    const shelves = 5;
    const books = ['#7a4b3a', '#355c7d', '#c06c84', '#6c8e5e', '#e0b75a'];
    for (let i = 0; i < shelves; i++) {
      const y = (h - 0.02) * (i / (shelves - 1));
      box(w - 0.04, 0.02, d, 0, Math.min(y, h - 0.02), 0, color);
      if (i < shelves - 1) {
        for (let k = 0; k < 6; k++) box(0.08, 0.24, d - 0.06, -w / 2 + 0.1 + k * 0.12, y + 0.02, 0, books[(i + k) % books.length]);
      }
    }
  },
  tanaman: ({ g, cyl }, { w, h }, color) => {
    cyl(0.15, 0.11, 0.35, 0, 0, 0, '#b5651d');
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(w / 2, 1), material(color, { roughness: 1 }));
    leaves.position.set(0, h - w / 2, 0);
    leaves.castShadow = true;
    g.add(leaves);
  },
  'lampu-lantai': ({ cyl }, { w, h }, color) => {
    cyl(0.15, 0.15, 0.03, 0, 0, 0, DARK);
    cyl(0.012, 0.012, h - 0.3, 0, 0.03, 0, METAL);
    cyl(0.12, w / 2, 0.3, 0, h - 0.3, 0, color);
  },
};

export function buildFurniture(kind: FurnitureKind, color: string): THREE.Group {
  const b = builder();
  BUILDERS[kind](b, FURNITURE[kind].size, color);
  b.g.userData = { kind: 'furniture' };
  return b.g;
}
