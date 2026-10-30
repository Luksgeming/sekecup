/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { FURNITURE, FURNITURE_KINDS, isFurnitureKind, isFloorMaterial } from '../../src/interior/kinds';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

describe('realistic furniture models', () => {
  it.each(FURNITURE_KINDS)('%s: catalog size matches the model (±2 cm)', async (kind) => {
    const spec = FURNITURE[kind];
    const doc = await io.read(`public/models/${spec.model}.glb`);
    const { min, max } = getBounds(doc.getRoot().listScenes()[0]);
    let [w, h, d] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    if (Math.abs(spec.rotation) % 180 === 90) [w, d] = [d, w];
    // models are scaled to the catalog height when loaded
    const k = spec.size.h / h;
    expect(Math.abs(w * k - spec.size.w)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(d * k - spec.size.d)).toBeLessThanOrEqual(0.02);
  });

  it('has a thumbnail for every model', async () => {
    const fs = await import('node:fs');
    for (const kind of FURNITURE_KINDS) expect(fs.existsSync(`public/models/thumbs/${FURNITURE[kind].model}.png`)).toBe(true);
  });
});

describe('kind checks', () => {
  it('does not accept built-in object names as furniture or floors', () => {
    for (const name of ['constructor', 'toString', '__proto__']) {
      expect(isFurnitureKind(name)).toBe(false);
      expect(isFloorMaterial(name)).toBe(false);
    }
  });
});
