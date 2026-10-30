import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildMeshes } from '../../src/view3d/buildMeshes';
import { addOpening, addRoom, addWall, emptyProject } from '../../src/model/project';
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
