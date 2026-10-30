import * as THREE from 'three';
import type { Project, Wall } from '../model/types';
import { dist, normalize, sub } from '../geometry/vec';
import { wallBoxes } from '../geometry/wallBoxes';
import { furnitureObject } from '../interior/models';
import { floorMaterial } from '../interior/floorTextures';

const GLASS = new THREE.MeshStandardMaterial({ color: 0x9cc8e8, transparent: true, opacity: 0.35, roughness: 0.1 });

const wallMaterials = new Map<string, THREE.MeshStandardMaterial>();
function wallMaterial(color: string): THREE.MeshStandardMaterial {
  let m = wallMaterials.get(color);
  if (!m) wallMaterials.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })));
  return m;
}

const GLASS_THICKNESS = 0.02;

export type BuildOptions = {
  /** Cut walls (and window glass) at this height so the inside of the house stays visible. */
  wallCut?: number;
};

// Plan (x, y) maps to 3D (x, 0, y); height is the Y axis.
export function buildMeshes(p: Project, { wallCut = Infinity }: BuildOptions = {}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'house';

  for (const wall of p.walls) {
    const len = dist(wall.a, wall.b);
    const half = wall.thickness / 2;
    for (const box of wallBoxes(wall, p.openings)) {
      const top = Math.min(box.top, wallCut);
      if (top - box.bottom < 0.001) continue;
      // pieces at the wall ends grow by half the thickness so corners close
      const start = box.start <= 0 ? box.start - half : box.start;
      const end = box.end >= len ? box.end + half : box.end;
      group.add(placeOnWall(wall, start, end, box.bottom, top, wall.thickness, wallMaterial(wall.color), 'wall'));
    }
    for (const o of p.openings) {
      if (o.wallId !== wall.id || o.type !== 'window') continue;
      const s = o.offset - o.width / 2;
      const top = Math.min(o.sill + o.height, wallCut);
      if (top - o.sill < 0.001) continue;
      group.add(placeOnWall(wall, s, s + o.width, o.sill, top, GLASS_THICKNESS, GLASS, 'glass'));
    }
  }

  for (const room of p.rooms) {
    const shape = new THREE.Shape(room.points.map((pt) => new THREE.Vector2(pt.x, pt.y)));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMaterial(room.floor));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.002;
    mesh.receiveShadow = true;
    mesh.userData = { kind: 'floor', id: room.id };
    group.add(mesh);
  }

  for (const f of p.furniture) {
    const item = furnitureObject(f.kind);
    item.position.set(f.x, 0, f.y);
    // plan rotation is clockwise on screen (y down), which is -y in three.js
    item.rotation.y = -(f.rotation * Math.PI) / 180;
    item.userData = { kind: 'furniture', id: f.id };
    group.add(item);
  }

  return group;
}

function placeOnWall(
  wall: Wall,
  start: number,
  end: number,
  bottom: number,
  top: number,
  depth: number,
  material: THREE.Material,
  kind: string,
): THREE.Mesh {
  const dir = normalize(sub(wall.b, wall.a));
  const mid = (start + end) / 2;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(end - start, top - bottom, depth), material);
  mesh.position.set(wall.a.x + dir.x * mid, (bottom + top) / 2, wall.a.y + dir.y * mid);
  mesh.rotation.y = -Math.atan2(dir.y, dir.x);
  mesh.castShadow = kind === 'wall';
  mesh.receiveShadow = kind === 'wall';
  mesh.userData = { kind, id: wall.id };
  return mesh;
}

export function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && !obj.userData.shared) obj.geometry.dispose();
  });
}
