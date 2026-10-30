import * as THREE from 'three';
import { FLOOR_MATERIALS, type FloorMaterial } from './kinds';

// Floor textures drawn with code (no image files), one tile = 1 m.

const cache = new Map<FloorMaterial, THREE.MeshStandardMaterial>();

function paint(floor: FloorMaterial, ctx: CanvasRenderingContext2D, size: number): void {
  const base = FLOOR_MATERIALS[floor].color;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const shade = (alpha: number) => `rgba(0,0,0,${alpha})`;

  if (floor === 'keramik') {
    // 4 tiles of 50 cm with grout lines
    ctx.strokeStyle = shade(0.12);
    ctx.lineWidth = 3;
    for (const v of [0, size / 2]) {
      ctx.strokeRect(v, 0, 0, size);
      ctx.strokeRect(0, v, size, 0);
    }
  } else if (floor === 'kayu') {
    const plank = size / 6;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = shade(0.04 + ((i * 37) % 5) * 0.015);
      ctx.fillRect(0, i * plank, size, plank);
      ctx.fillStyle = shade(0.18);
      ctx.fillRect(0, i * plank, size, 1.5);
      ctx.fillRect(((i * 97) % 5) * (size / 5), i * plank, 1.5, plank);
    }
  } else if (floor === 'marmer') {
    ctx.strokeStyle = 'rgba(120,120,130,0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      let x = (i * 53) % size;
      ctx.moveTo(x, 0);
      for (let y = 0; y <= size; y += size / 8) ctx.lineTo((x += ((i * 31 + y) % 23) - 11), y);
      ctx.stroke();
    }
    ctx.strokeStyle = shade(0.08);
    ctx.strokeRect(0, 0, size, size);
  } else {
    // karpet, beton: fine speckle
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = shade(((i * 13) % 7) * 0.012);
      ctx.fillRect((i * 7919) % size, (i * 104729) % size, 2, 2);
    }
  }
}

export function floorMaterial(floor: FloorMaterial): THREE.MeshStandardMaterial {
  let m = cache.get(floor);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color: typeof document === 'undefined' ? FLOOR_MATERIALS[floor].color : 0xffffff,
    roughness: floor === 'marmer' ? 0.35 : floor === 'kayu' ? 0.6 : 0.9,
    side: THREE.DoubleSide,
  });
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    paint(floor, canvas.getContext('2d')!, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    m.map = tex;
  }
  cache.set(floor, m);
  return m;
}
