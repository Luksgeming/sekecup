import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildFurniture } from '../../src/interior/catalog';
import { FURNITURE, FURNITURE_KINDS } from '../../src/interior/kinds';

describe('furniture catalog', () => {
  it.each(FURNITURE_KINDS)('%s builds a model matching its catalog size', (kind) => {
    const spec = FURNITURE[kind];
    const size = new THREE.Box3().setFromObject(buildFurniture(kind, spec.color)).getSize(new THREE.Vector3());
    expect(Math.abs(size.x - spec.size.w)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(size.z - spec.size.d)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(size.y - spec.size.h)).toBeLessThanOrEqual(0.05);
  });

  it('sits on the floor and is centered on its footprint', () => {
    const box = new THREE.Box3().setFromObject(buildFurniture('sofa-3', '#777777'));
    expect(box.min.y).toBeCloseTo(0, 2);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 2);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 2);
  });
});

describe('kind checks', () => {
  it('does not accept built-in object names as furniture or floors', async () => {
    const { isFurnitureKind, isFloorMaterial } = await import('../../src/interior/kinds');
    for (const name of ['constructor', 'toString', '__proto__']) {
      expect(isFurnitureKind(name)).toBe(false);
      expect(isFloorMaterial(name)).toBe(false);
    }
  });
});
