import { describe, it, expect } from 'vitest';
import { projectToDxf } from '../../src/io/dxf';
import { addFurniture, addOpening, addRoom, addWall, emptyProject } from '../../src/model/project';
import { DOOR_DEFAULTS, type Project } from '../../src/model/types';

// DXF is pairs of lines: group code, value
function entities(dxf: string): { type: string; layer: string; values: Map<string, string[]> }[] {
  const lines = dxf.split('\n');
  const out: { type: string; layer: string; values: Map<string, string[]> }[] = [];
  let inEntities = false;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1].trim();
    if (code === '2' && value === 'ENTITIES') inEntities = true;
    if (!inEntities) continue;
    if (code === '0') out.push({ type: value, layer: '', values: new Map() });
    else if (out.length) {
      const e = out[out.length - 1];
      if (code === '8') e.layer = value;
      e.values.set(code, [...(e.values.get(code) ?? []), value]);
    }
  }
  return out;
}

const oneWall = () => addWall(emptyProject(), { x: 0, y: 0 }, { x: 4, y: 0 });

describe('projectToDxf', () => {
  it('starts with a section and ends with EOF', () => {
    const dxf = projectToDxf(oneWall());
    expect(dxf.startsWith('0\nSECTION')).toBe(true);
    expect(dxf.trimEnd().endsWith('0\nEOF')).toBe(true);
  });

  it('draws each wall as two LINEs on layer WALLS, thickness apart', () => {
    const walls = entities(projectToDxf(oneWall())).filter((e) => e.layer === 'WALLS');
    expect(walls.map((e) => e.type)).toEqual(['LINE', 'LINE']);
    const ys = walls.map((e) => Number(e.values.get('20')![0])).sort();
    expect(ys[1] - ys[0]).toBeCloseTo(0.15);
  });

  it('puts openings on layer OPENINGS', () => {
    const p = oneWall();
    const q = addOpening(p, { wallId: p.walls[0].id, type: 'door', offset: 2, ...DOOR_DEFAULTS }) as Project;
    expect(entities(projectToDxf(q)).some((e) => e.layer === 'OPENINGS')).toBe(true);
  });

  it('draws a room as a closed POLYLINE plus a TEXT with its name', () => {
    const p = addRoom(emptyProject(), 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;
    const rooms = entities(projectToDxf(p)).filter((e) => e.layer === 'ROOMS');
    const poly = rooms.find((e) => e.type === 'POLYLINE')!;
    expect(poly.values.get('70')).toEqual(['1']);
    expect(rooms.filter((e) => e.type === 'VERTEX')).toHaveLength(3);
    expect(rooms.find((e) => e.type === 'TEXT')!.values.get('1')![0]).toContain('Kamar');
  });

  it('flips y so the plan is not mirrored in CAD', () => {
    const p = addWall(emptyProject(), { x: 0, y: 0 }, { x: 0, y: 3 });
    const ys = entities(projectToDxf(p)).filter((e) => e.type === 'LINE').flatMap((e) => [...e.values.get('20')!, ...e.values.get('21')!].map(Number));
    expect(Math.min(...ys)).toBeCloseTo(-3);
  });
});

describe('furniture in DXF', () => {
  it('draws furniture as a closed outline with its label on layer FURNITURE', () => {
    const p = addFurniture(emptyProject(), 'kasur-double', { x: 2, y: 2 });
    const items = entities(projectToDxf(p)).filter((e) => e.layer === 'FURNITURE');
    expect(items.filter((e) => e.type === 'POLYLINE')).toHaveLength(1);
    expect(items.filter((e) => e.type === 'VERTEX')).toHaveLength(4);
    expect(items.find((e) => e.type === 'TEXT')!.values.get('1')![0]).toBe('Kasur kayu klasik');
  });
});
