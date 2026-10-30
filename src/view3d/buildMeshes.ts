import * as THREE from 'three';
import type { Project, Wall } from '../model/types';
import { dist, normalize, sub } from '../geometry/vec';
import { wallBoxes } from '../geometry/wallBoxes';

const MATERIALS = {
  wall: new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9cc8e8, transparent: true, opacity: 0.35, roughness: 0.1 }),
  floor: new THREE.MeshStandardMaterial({ color: 0xd9c4a0, roughness: 0.8, side: THREE.DoubleSide }),
};

const GLASS_THICKNESS = 0.02;

// Plan (x, y) maps to 3D (x, 0, y); height is the Y axis.
export function buildMeshes(p: Project): THREE.Group {
  const group = new THREE.Group();
  group.name = 'house';

  for (const wall of p.walls) {
    const len = dist(wall.a, wall.b);
    const half = wall.thickness / 2;
    for (const box of wallBoxes(wall, p.openings)) {
      // pieces at the wall ends grow by half the thickness so corners close
      const start = box.start <= 0 ? box.start - half : box.start;
      const end = box.end >= len ? box.end + half : box.end;
      group.add(placeOnWall(wall, start, end, box.bottom, box.top, wall.thickness, MATERIALS.wall, 'wall'));
    }
    for (const o of p.openings) {
      if (o.wallId !== wall.id || o.type !== 'window') continue;
      const s = o.offset - o.width / 2;
      group.add(placeOnWall(wall, s, s + o.width, o.sill, o.sill + o.height, GLASS_THICKNESS, MATERIALS.glass, 'glass'));
    }
  }

  for (const room of p.rooms) {
    const shape = new THREE.Shape(room.points.map((pt) => new THREE.Vector2(pt.x, pt.y)));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), MATERIALS.floor);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.002;
    mesh.receiveShadow = true;
    mesh.userData = { kind: 'floor', id: room.id };
    group.add(mesh);
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
    if (obj instanceof THREE.Mesh) obj.geometry.dispose();
  });
}
