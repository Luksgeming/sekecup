import { describe, it, expect } from 'vitest';
import { addRoom, addWall, applyRecommendation, emptyProject } from '../../src/model/project';
import type { Project } from '../../src/model/types';
import type { Recommendation } from '../../src/ai/recommendation';

const rec: Recommendation = {
  style: 'Japandi', summary: '', palette: ['#efe2c8', '#8b6a4c'], floor: 'kayu', furniture: [], tips: [], source: 'offline',
};

function house(): Project {
  let p = addWall(emptyProject(), { x: 0, y: 0 }, { x: 4, y: 0 });
  p = addWall(p, { x: 4, y: 0 }, { x: 4, y: 3 });
  p = addRoom(p, 'A', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]) as Project;
  return addRoom(p, 'B', [{ x: 5, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 3 }]) as Project;
}

describe('applyRecommendation', () => {
  it('paints every wall and sets every floor', () => {
    const q = applyRecommendation(house(), rec);
    expect(q.walls.every((w) => w.color === '#efe2c8')).toBe(true);
    expect(q.rooms.every((r) => r.floor === 'kayu')).toBe(true);
  });

  it('only changes the chosen room floor when a room is given', () => {
    const p = house();
    const q = applyRecommendation(p, rec, p.rooms[1].id);
    expect(q.rooms.map((r) => r.floor)).toEqual(['keramik', 'kayu']);
  });

  it('returns the same project when there is nothing to change', () => {
    const p = emptyProject();
    expect(applyRecommendation(p, rec)).toBe(p);
  });
});

describe('partial suggestions', () => {
  it('leaves floors alone when the suggestion has no floor', () => {
    const q = applyRecommendation(house(), { palette: ['#112233'] });
    expect(q.rooms.every((r) => r.floor === 'keramik')).toBe(true);
    expect(q.walls[0].color).toBe('#112233');
  });

  it('leaves walls alone when the palette is empty', () => {
    const q = applyRecommendation(house(), { palette: [], floor: 'marmer' });
    expect(q.walls[0].color).toBe('#f2efe8');
    expect(q.rooms[0].floor).toBe('marmer');
  });
});
