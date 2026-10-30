import { describe, it, expect } from 'vitest';
import {
  addFurniture,
  addRoom,
  addWall,
  emptyProject,
  moveFurniture,
  removeFurniture,
  setRoomFloor,
  setWallColor,
  updateFurniture,
} from '../../src/model/project';
import type { Project } from '../../src/model/types';

const withBed = () => addFurniture(emptyProject(), 'kasur-double', { x: 2, y: 2 });

describe('furniture', () => {
  it('adds furniture with its catalog color and no rotation', () => {
    const p = withBed();
    expect(p.furniture).toHaveLength(1);
    expect(p.furniture[0]).toMatchObject({ kind: 'kasur-double', x: 2, y: 2, rotation: 0 });
    expect(p.furniture[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('moves furniture', () => {
    const p = withBed();
    const q = moveFurniture(p, p.furniture[0].id, { x: 3, y: 1 });
    expect(q.furniture[0]).toMatchObject({ x: 3, y: 1 });
  });

  it('normalizes rotation into 0–359', () => {
    const p = withBed();
    expect((updateFurniture(p, p.furniture[0].id, { rotation: 450 }) as Project).furniture[0].rotation).toBe(90);
    expect((updateFurniture(p, p.furniture[0].id, { rotation: -90 }) as Project).furniture[0].rotation).toBe(270);
  });

  it('rejects a color that is not #rrggbb', () => {
    const p = withBed();
    expect(updateFurniture(p, p.furniture[0].id, { color: 'red' })).toHaveProperty('error');
  });

  it('returns the same project when nothing changes', () => {
    const p = withBed();
    const f = p.furniture[0];
    expect(updateFurniture(p, f.id, { rotation: 0, color: f.color })).toBe(p);
    expect(moveFurniture(p, f.id, { x: 2, y: 2 })).toBe(p);
    expect(removeFurniture(p, 'missing')).toBe(p);
  });

  it('removes furniture', () => {
    const p = withBed();
    expect(removeFurniture(p, p.furniture[0].id).furniture).toHaveLength(0);
  });
});

describe('wall color and room floor', () => {
  it('new walls are off-white and new rooms are tiled', () => {
    let p = addWall(emptyProject(), { x: 0, y: 0 }, { x: 4, y: 0 });
    p = addRoom(p, 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;
    expect(p.walls[0].color).toBe('#f2efe8');
    expect(p.rooms[0].floor).toBe('keramik');
  });

  it('sets a wall color and rejects a bad one', () => {
    const p = addWall(emptyProject(), { x: 0, y: 0 }, { x: 4, y: 0 });
    expect((setWallColor(p, p.walls[0].id, '#9caf88') as Project).walls[0].color).toBe('#9caf88');
    expect(setWallColor(p, p.walls[0].id, '#xyz')).toHaveProperty('error');
  });

  it('sets a room floor', () => {
    const p = addRoom(emptyProject(), 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;
    expect((setRoomFloor(p, p.rooms[0].id, 'kayu') as Project).rooms[0].floor).toBe('kayu');
  });
});
