import { describe, it, expect } from 'vitest';
import { parseProject, parseProjectWithNotes, serializeProject } from '../../src/io/projectFile';
import { addFurniture, addOpening, addRoom, addWall, emptyProject } from '../../src/model/project';
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
    const text = JSON.stringify({ ...sample(), version: 9 });
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

describe('version 2', () => {
  it('opens a version 1 file with interior defaults', () => {
    const p = sample();
    const v1 = {
      version: 1,
      name: p.name,
      walls: p.walls.map(({ color: _c, ...w }) => w),
      openings: p.openings,
      rooms: p.rooms.map(({ floor: _f, ...r }) => r),
    };
    const q = parseProject(JSON.stringify(v1)) as Project;
    expect(q.version).toBe(2);
    expect(q.walls[0].color).toBe('#f2efe8');
    expect(q.rooms[0].floor).toBe('keramik');
    expect(q.furniture).toEqual([]);
  });

  it('round-trips furniture', () => {
    const p = addFurniture(sample(), 'sofa-3', { x: 1, y: 1 });
    expect(parseProject(serializeProject(p))).toEqual(p);
  });

  it('rejects an unknown furniture kind', () => {
    const p = addFurniture(sample(), 'sofa-3', { x: 1, y: 1 });
    const broken = { ...p, furniture: [{ ...p.furniture[0], kind: 'jacuzzi' }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });

  it('rejects a bad wall color', () => {
    const p = sample();
    const broken = { ...p, walls: [{ ...p.walls[0], color: 'blue' }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });

  it('rejects an unknown floor material', () => {
    const p = sample();
    const broken = { ...p, rooms: [{ ...p.rooms[0], floor: 'lava' }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });
});

describe('version 2 hardening', () => {
  it('rejects "constructor" as a furniture kind', () => {
    const p = addFurniture(sample(), 'sofa-3', { x: 1, y: 1 });
    const broken = { ...p, furniture: [{ ...p.furniture[0], kind: 'constructor' }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });

  it('normalizes rotation from a file', () => {
    const p = addFurniture(sample(), 'sofa-3', { x: 1, y: 1 });
    const odd = { ...p, furniture: [{ ...p.furniture[0], rotation: -90 }] };
    expect((parseProject(JSON.stringify(odd)) as Project).furniture[0].rotation).toBe(270);
  });
});

describe('furniture removed from the catalog', () => {
  it('drops pieces whose kind no longer exists and counts them', () => {
    const p = addFurniture(sample(), 'sofa-3', { x: 1, y: 1 });
    const old = { ...p, furniture: [...p.furniture, { ...p.furniture[0], id: 'k1', kind: 'kulkas' }, { ...p.furniture[0], id: 'k2', kind: 'karpet' }] };
    const r = parseProjectWithNotes(JSON.stringify(old));
    expect(r).not.toHaveProperty('error');
    const { project, dropped } = r as { project: Project; dropped: number };
    expect(project.furniture.map((f) => f.kind)).toEqual(['sofa-3']);
    expect(dropped).toBe(2);
  });

  it('still rejects a kind that never existed', () => {
    const p = addFurniture(sample(), 'sofa-3', { x: 1, y: 1 });
    const broken = { ...p, furniture: [{ ...p.furniture[0], kind: 'jacuzzi' }] };
    expect(parseProjectWithNotes(JSON.stringify(broken))).toHaveProperty('error');
  });
});

describe('ceiling color in files', () => {
  it('gives older rooms a default ceiling color', () => {
    const p = sample();
    const old = { ...p, rooms: p.rooms.map(({ ceilingColor: _c, ...r }) => r) };
    expect((parseProject(JSON.stringify(old)) as Project).rooms[0].ceilingColor).toBe('#f7f6f2');
  });

  it('rejects a bad ceiling color', () => {
    const p = sample();
    const broken = { ...p, rooms: [{ ...p.rooms[0], ceilingColor: 'white' }] };
    expect(parseProject(JSON.stringify(broken))).toHaveProperty('error');
  });
});
