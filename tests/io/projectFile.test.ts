import { describe, it, expect } from 'vitest';
import { parseProject, serializeProject } from '../../src/io/projectFile';
import { addOpening, addRoom, addWall, emptyProject } from '../../src/model/project';
import { DOOR_DEFAULTS, type Project } from '../../src/model/types';

function sample(): Project {
  let p = addWall(emptyProject('Rumahku'), { x: 0, y: 0 }, { x: 4, y: 0 });
  p = addOpening(p, { wallId: p.walls[0].id, type: 'door', offset: 2, ...DOOR_DEFAULTS }) as Project;
  return addRoom(p, 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;
}

describe('project file', () => {
  it('round-trips through serialize and parse', () => {
    const p = sample();
    expect(parseProject(serializeProject(p))).toEqual(p);
  });

  it('rejects text that is not JSON', () => {
    expect(parseProject('hello')).toHaveProperty('error');
  });

  it('rejects an unknown version', () => {
    const text = JSON.stringify({ ...sample(), version: 2 });
    expect(parseProject(text)).toEqual({ error: 'Versi file tidak didukung' });
  });

  it('rejects a wall without point a', () => {
    const p = sample();
    const broken = { ...p, walls: [{ ...p.walls[0], a: undefined }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });

  it('rejects an opening pointing at a missing wall', () => {
    const p = sample();
    const broken = { ...p, openings: [{ ...p.openings[0], wallId: 'missing' }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });

  it('rejects a room with fewer than 3 points', () => {
    const p = sample();
    const broken = { ...p, rooms: [{ ...p.rooms[0], points: [{ x: 0, y: 0 }] }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });

  it('rejects non-numeric coordinates', () => {
    const p = sample();
    const broken = { ...p, walls: [{ ...p.walls[0], b: { x: 'a', y: 0 } }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });
});

describe('review fixes: strict import', () => {
  it('rejects overlapping openings', () => {
    const p = sample();
    const broken = { ...p, openings: [p.openings[0], { ...p.openings[0], id: 'o2', offset: 2.3 }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });

  it('rejects an opening that sticks out of its wall', () => {
    const p = sample();
    const broken = { ...p, openings: [{ ...p.openings[0], offset: 3.9 }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });

  it('rejects zero wall thickness', () => {
    const p = sample();
    const broken = { ...p, walls: [{ ...p.walls[0], thickness: 0 }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });

  it('rejects duplicate wall ids', () => {
    const p = sample();
    const broken = { ...p, walls: [p.walls[0], { ...p.walls[0], a: { x: 0, y: 5 }, b: { x: 4, y: 5 } }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });
});
