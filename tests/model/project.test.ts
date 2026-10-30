import { describe, it, expect } from 'vitest';
import { emptyProject, addWall, removeWall, addOpening, addRoom, removeOpening, removeRoom, isEmptyProject } from '../../src/model/project';
import type { Project } from '../../src/model/types';

function withWall(): Project {
  return addWall(emptyProject(), { x: 0, y: 0 }, { x: 4, y: 0 });
}

function door(p: Project, offset: number) {
  return addOpening(p, { wallId: p.walls[0].id, type: 'door', offset, width: 0.9, height: 2.1, sill: 0 });
}

describe('addWall', () => {
  it('ignores a zero-length wall', () => {
    const p = emptyProject();
    expect(addWall(p, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(p);
  });

  it('adds a wall with default thickness and height', () => {
    const p = withWall();
    expect(p.walls).toHaveLength(1);
    expect(p.walls[0].thickness).toBe(0.15);
    expect(p.walls[0].height).toBe(2.8);
  });
});

describe('removeWall', () => {
  it('removes the wall and its openings', () => {
    const p = door(withWall(), 2) as Project;
    const q = removeWall(p, p.walls[0].id);
    expect(q.walls).toHaveLength(0);
    expect(q.openings).toHaveLength(0);
  });
});

describe('addOpening', () => {
  it('rejects an opening wider than the wall', () => {
    const p = withWall();
    const r = addOpening(p, { wallId: p.walls[0].id, type: 'window', offset: 2, width: 5, height: 1.2, sill: 0.9 });
    expect(r).toHaveProperty('error');
  });

  it('rejects overlapping openings', () => {
    const p = door(withWall(), 1.0) as Project;
    expect(door(p, 1.5)).toHaveProperty('error');
  });

  it('rejects an opening sticking out past the wall start', () => {
    expect(door(withWall(), 0.3)).toHaveProperty('error');
  });

  it('rejects an opening on an unknown wall', () => {
    const r = addOpening(withWall(), { wallId: 'nope', type: 'door', offset: 2, width: 0.9, height: 2.1, sill: 0 });
    expect(r).toHaveProperty('error');
  });

  it('adds a valid opening and removeOpening deletes it', () => {
    const p = door(withWall(), 2) as Project;
    expect(p.openings).toHaveLength(1);
    expect(removeOpening(p, p.openings[0].id).openings).toHaveLength(0);
  });
});

describe('addRoom', () => {
  it('rejects fewer than 3 points', () => {
    expect(addRoom(emptyProject(), 'Kamar', [{ x: 0, y: 0 }, { x: 1, y: 0 }])).toHaveProperty('error');
  });

  it('adds a room and removeRoom deletes it', () => {
    const p = addRoom(emptyProject(), 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;
    expect(p.rooms[0].name).toBe('Kamar');
    expect(removeRoom(p, p.rooms[0].id).rooms).toHaveLength(0);
  });
});

describe('review fixes: model', () => {
  it('removeWall with an unknown id returns the same project (no empty undo step)', () => {
    const p = withWall();
    expect(removeWall(p, 'missing')).toBe(p);
  });

  it('removeOpening and removeRoom with unknown ids return the same project', () => {
    const p = withWall();
    expect(removeOpening(p, 'missing')).toBe(p);
    expect(removeRoom(p, 'missing')).toBe(p);
  });

  it('isEmptyProject is false when only rooms exist', () => {
    const p = addRoom(emptyProject(), 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;
    expect(isEmptyProject(p)).toBe(false);
    expect(isEmptyProject(emptyProject())).toBe(true);
  });
});
