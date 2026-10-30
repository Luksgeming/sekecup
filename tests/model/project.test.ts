import { describe, it, expect } from 'vitest';
import { emptyProject, addWall, removeWall, addOpening, addRoom, removeOpening, removeRoom, isEmptyProject, updateWall, updateOpening, renameRoom, moveCorner, cornerAt } from '../../src/model/project';
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

describe('updateWall', () => {
  it('changes thickness', () => {
    const p = withWall();
    const q = updateWall(p, p.walls[0].id, { thickness: 0.2 }) as Project;
    expect(q.walls[0].thickness).toBe(0.2);
  });

  it('changes length by moving point b along the wall', () => {
    const p = withWall();
    const q = updateWall(p, p.walls[0].id, { length: 6 }) as Project;
    expect(q.walls[0].b).toEqual({ x: 6, y: 0 });
    expect(q.walls[0].a).toEqual({ x: 0, y: 0 });
  });

  it('rejects a height lower than a door on it', () => {
    const p = door(withWall(), 2) as Project;
    expect(updateWall(p, p.walls[0].id, { height: 2.0 })).toHaveProperty('error');
  });

  it('rejects a length that no longer fits a door', () => {
    const p = door(withWall(), 2) as Project;
    expect(updateWall(p, p.walls[0].id, { length: 1 })).toHaveProperty('error');
  });

  it('rejects zero or negative sizes', () => {
    const p = withWall();
    expect(updateWall(p, p.walls[0].id, { thickness: 0 })).toHaveProperty('error');
    expect(updateWall(p, p.walls[0].id, { length: -1 })).toHaveProperty('error');
  });

  it('returns the same project when nothing changes', () => {
    const p = withWall();
    expect(updateWall(p, p.walls[0].id, { thickness: 0.15, length: 4 })).toBe(p);
  });
});

describe('updateOpening', () => {
  it('changes width', () => {
    const p = door(withWall(), 2) as Project;
    expect((updateOpening(p, p.openings[0].id, { width: 1 }) as Project).openings[0].width).toBe(1);
  });

  it('rejects a width that hits another opening', () => {
    let p = door(withWall(), 1) as Project;
    p = door(p, 2) as Project; // 1.55–2.45
    expect(updateOpening(p, p.openings[0].id, { width: 1.4 })).toHaveProperty('error'); // 0.3–1.7
  });

  it('does not count the opening itself as an overlap', () => {
    const p = door(withWall(), 2) as Project;
    expect(updateOpening(p, p.openings[0].id, { offset: 2.1 })).not.toHaveProperty('error');
  });

  it('returns the same project when nothing changes', () => {
    const p = door(withWall(), 2) as Project;
    expect(updateOpening(p, p.openings[0].id, { width: 0.9 })).toBe(p);
  });
});

describe('renameRoom', () => {
  const room = () => addRoom(emptyProject(), 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;

  it('renames a room', () => {
    const p = room();
    expect((renameRoom(p, p.rooms[0].id, 'Dapur') as Project).rooms[0].name).toBe('Dapur');
  });

  it('rejects an empty name', () => {
    const p = room();
    expect(renameRoom(p, p.rooms[0].id, '  ')).toHaveProperty('error');
  });

  it('returns the same project for the same name', () => {
    const p = room();
    expect(renameRoom(p, p.rooms[0].id, 'Kamar')).toBe(p);
  });
});

describe('moveCorner', () => {
  const corner = () => {
    let p = addWall(emptyProject(), { x: 0, y: 0 }, { x: 4, y: 0 });
    p = addWall(p, { x: 4, y: 0 }, { x: 4, y: 3 });
    return p;
  };

  it('moves every wall end at that corner', () => {
    const q = moveCorner(corner(), { x: 4, y: 0 }, { x: 5, y: 0 }) as Project;
    expect(q.walls[0].b).toEqual({ x: 5, y: 0 });
    expect(q.walls[1].a).toEqual({ x: 5, y: 0 });
  });

  it('rejects a move that collapses a wall to zero length', () => {
    expect(moveCorner(corner(), { x: 4, y: 0 }, { x: 0, y: 0 })).toHaveProperty('error');
  });

  it('rejects a move that leaves a door without room', () => {
    const p = door(corner(), 2) as Project;
    expect(moveCorner(p, { x: 4, y: 0 }, { x: 2, y: 0 })).toHaveProperty('error');
  });

  it('keeps openings at the same distance from the fixed end', () => {
    const p = door(corner(), 2) as Project;
    const q = moveCorner(p, { x: 4, y: 0 }, { x: 6, y: 0 }) as Project;
    expect(q.openings[0].offset).toBe(2);
  });

  it('moves room points sitting on that corner', () => {
    const p = addRoom(corner(), 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;
    const q = moveCorner(p, { x: 4, y: 0 }, { x: 5, y: 0 }) as Project;
    expect(q.rooms[0].points[1]).toEqual({ x: 5, y: 0 });
  });

  it('returns the same project when nothing is at that point', () => {
    const p = corner();
    expect(moveCorner(p, { x: 9, y: 9 }, { x: 1, y: 1 })).toBe(p);
  });
});

describe('cornerAt', () => {
  it('finds a wall end near the point', () => {
    const p = addWall(emptyProject(), { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(cornerAt(p, { x: 3.9, y: 0.1 })).toEqual({ x: 4, y: 0 });
    expect(cornerAt(p, { x: 2, y: 0 })).toBeUndefined();
  });
});

describe('room cleanup', () => {
  it('drops repeated consecutive points', () => {
    const p = addRoom(emptyProject(), 'Kamar', [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 0 }]) as Project;
    expect(p.rooms[0].points).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]);
  });

  it('rejects a room with no area', () => {
    expect(addRoom(emptyProject(), 'Garis', [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }])).toHaveProperty('error');
  });
});

describe('review fixes 1.5', () => {
  const rect = () => {
    let p = emptyProject();
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    pts.forEach((a, i) => (p = addWall(p, a, pts[(i + 1) % 4])));
    return addRoom(p, 'Kamar', pts) as Project;
  };

  it('changing a wall length in the panel keeps the next wall joined', () => {
    const p = rect();
    const q = updateWall(p, p.walls[0].id, { length: 5 }) as Project;
    expect(q.walls[0].b).toEqual({ x: 5, y: 0 });
    expect(q.walls[1].a).toEqual({ x: 5, y: 0 });
    expect(q.rooms[0].points[1]).toEqual({ x: 5, y: 0 });
  });

  it('rejects absurd thickness or height', () => {
    const p = withWall();
    expect(updateWall(p, p.walls[0].id, { thickness: 20 })).toHaveProperty('error');
    expect(updateWall(p, p.walls[0].id, { height: 50 })).toHaveProperty('error');
  });
});
