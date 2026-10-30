import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildMeshes } from '../../src/view3d/buildMeshes';
import { addFurniture, addOpening, addRoom, addWall, emptyProject, setWallColor, updateFurniture } from '../../src/model/project';
import { WINDOW_DEFAULTS, type Project } from '../../src/model/types';

const oneWall = () => addWall(emptyProject(), { x: 0, y: 0 }, { x: 4, y: 0 });
const ofKind = (g: THREE.Group, kind: string) => g.children.filter((c) => c.userData.kind === kind);

describe('buildMeshes', () => {
  it('builds one wall mesh spanning the wall length plus its thickness, 2.8 m tall', () => {
    const g = buildMeshes(oneWall());
    expect(g.name).toBe('house');
    const walls = ofKind(g, 'wall');
    expect(walls).toHaveLength(1);
    const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(4.15);
    expect(size.y).toBeCloseTo(2.8);
    expect(size.z).toBeCloseTo(0.15);
  });

  it('splits the wall around a window and adds glass', () => {
    const p = oneWall();
    const q = addOpening(p, { wallId: p.walls[0].id, type: 'window', offset: 2, ...WINDOW_DEFAULTS }) as Project;
    const g = buildMeshes(q);
    expect(ofKind(g, 'wall')).toHaveLength(4);
    expect(ofKind(g, 'glass')).toHaveLength(1);
  });

  it('maps plan y to 3D z for a wall along the y axis', () => {
    const g = buildMeshes(addWall(emptyProject(), { x: 0, y: 0 }, { x: 0, y: 3 }));
    const box = new THREE.Box3().setFromObject(g);
    expect(box.min.z).toBeCloseTo(-0.075);
    expect(box.max.z).toBeCloseTo(3.075);
  });

  it('adds one floor mesh per room', () => {
    const p = addRoom(emptyProject(), 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;
    expect(ofKind(buildMeshes(p), 'floor')).toHaveLength(1);
  });
});

describe('interior in 3D', () => {
  it('places furniture at its plan position, rotated', () => {
    let p = addFurniture(emptyProject(), 'kasur-double', { x: 3, y: 2 });
    p = updateFurniture(p, p.furniture[0].id, { rotation: 90 }) as Project;
    const items = ofKind(buildMeshes(p), 'furniture');
    expect(items).toHaveLength(1);
    const size = new THREE.Box3().setFromObject(items[0]).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(2.0, 1);
    expect(size.z).toBeCloseTo(1.6, 1);
    expect(items[0].position.x).toBe(3);
    expect(items[0].position.z).toBe(2);
  });

  it('paints walls with their color', () => {
    let p = oneWall();
    p = setWallColor(p, p.walls[0].id, '#9caf88') as Project;
    const wall = ofKind(buildMeshes(p), 'wall')[0] as THREE.Mesh;
    expect((wall.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('9caf88');
  });
});

describe('rotation direction', () => {
  it('turns the chair back to the same side as the 2D back edge', async () => {
    const { footprint } = await import('../../src/geometry/footprint');
    let p = addFurniture(emptyProject(), 'kursi-makan', { x: 0, y: 0 });
    p = updateFurniture(p, p.furniture[0].id, { rotation: 90 }) as Project;
    const [c0, c1] = footprint(p.furniture[0]);
    const backX2d = (c0.x + c1.x) / 2;
    const chair = ofKind(buildMeshes(p), 'furniture')[0];
    chair.updateMatrixWorld(true);
    // the backrest is the only part above seat height
    const back = chair.children.find((m) => new THREE.Box3().setFromObject(m).max.y > 0.6)!;
    const backX3d = new THREE.Box3().setFromObject(back).getCenter(new THREE.Vector3()).x;
    expect(Math.sign(backX3d)).toBe(Math.sign(backX2d));
  });
});

describe('low walls', () => {
  it('cuts walls at the given height', () => {
    const size = new THREE.Box3().setFromObject(buildMeshes(oneWall(), { wallCut: 1.2 })).getSize(new THREE.Vector3());
    expect(size.y).toBeCloseTo(1.2);
  });

  it('drops the wall piece above a window when cut below it, and cuts the glass', () => {
    const p = oneWall();
    const q = addOpening(p, { wallId: p.walls[0].id, type: 'window', offset: 2, ...WINDOW_DEFAULTS }) as Project;
    const g = buildMeshes(q, { wallCut: 1.2 });
    // left, right and below the window; the piece above (2.1–2.8) is gone
    expect(ofKind(g, 'wall')).toHaveLength(3);
    const glass = new THREE.Box3().setFromObject(ofKind(g, 'glass')[0]);
    expect(glass.max.y).toBeCloseTo(1.2);
  });

  it('leaves furniture untouched', () => {
    const p = addFurniture(oneWall(), 'lemari', { x: 2, y: 1 });
    const item = ofKind(buildMeshes(p, { wallCut: 1.2 }), 'furniture')[0];
    expect(new THREE.Box3().setFromObject(item).getSize(new THREE.Vector3()).y).toBeCloseTo(2.0, 1);
  });
});
