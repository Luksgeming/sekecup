import { describe, it, expect } from 'vitest';
import { handleClick, handleKey, initialToolState, type ToolState } from '../../src/plan/tools';
import { addWall, addRoom, emptyProject } from '../../src/model/project';
import type { Project } from '../../src/model/types';

const noMods = { shift: false };
const wallState = (): ToolState => ({ ...initialToolState(), tool: 'wall' });
const box = (): Project => addWall(emptyProject(), { x: 0, y: 0 }, { x: 4, y: 0 });

describe('wall tool', () => {
  it('two clicks make one wall and the chain continues from the second point', () => {
    let r = handleClick(wallState(), emptyProject(), { x: 0, y: 0 }, noMods);
    r = handleClick(r.state, r.project, { x: 4, y: 0 }, noMods);
    expect(r.project.walls).toHaveLength(1);
    expect(r.state.draft).toEqual([{ x: 4, y: 0 }]);
  });

  it('Escape clears the draft', () => {
    const r = handleClick(wallState(), emptyProject(), { x: 0, y: 0 }, noMods);
    expect(handleKey(r.state, r.project, 'Escape').state.draft).toEqual([]);
  });
});

describe('door tool', () => {
  const doorState: ToolState = { ...initialToolState(), tool: 'door' };

  it('places a door on a nearby wall', () => {
    const r = handleClick(doorState, box(), { x: 2, y: 0.1 }, noMods);
    expect(r.project.openings).toHaveLength(1);
    expect(r.project.openings[0]).toMatchObject({ type: 'door', offset: 2, width: 0.9, height: 2.1, sill: 0 });
  });

  it('does nothing when clicking 1 m away from any wall', () => {
    const p = box();
    expect(handleClick(doorState, p, { x: 2, y: 1 }, noMods).project).toBe(p);
  });

  it('reports a message and keeps the project when the door does not fit', () => {
    const p = handleClick(doorState, box(), { x: 2, y: 0 }, noMods).project;
    const r = handleClick(doorState, p, { x: 2.2, y: 0 }, noMods);
    expect(r.project).toBe(p);
    expect(r.message).toBeTruthy();
  });
});

describe('window tool', () => {
  it('places a window with window defaults', () => {
    const r = handleClick({ ...initialToolState(), tool: 'window' }, box(), { x: 2, y: 0 }, noMods);
    expect(r.project.openings[0]).toMatchObject({ type: 'window', width: 1.2, height: 1.2, sill: 0.9 });
  });
});

describe('room tool', () => {
  const roomState: ToolState = { ...initialToolState(), tool: 'room' };
  const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
  const ctx = { promptName: () => 'Kamar' };

  function clickAll(): { state: ToolState; project: Project } {
    let r = { state: roomState, project: emptyProject() };
    for (const p of pts) r = handleClick(r.state, r.project, p, noMods, ctx);
    return r;
  }

  it('4 points + Enter makes one named room', () => {
    const r = clickAll();
    const done = handleKey(r.state, r.project, 'Enter', ctx);
    expect(done.project.rooms).toHaveLength(1);
    expect(done.project.rooms[0].name).toBe('Kamar');
    expect(done.state.draft).toEqual([]);
  });

  it('clicking the first point again closes the room', () => {
    const r = clickAll();
    const done = handleClick(r.state, r.project, { x: 0, y: 0 }, noMods, ctx);
    expect(done.project.rooms[0].points).toHaveLength(4);
  });

  it('cancelling the name prompt adds no room', () => {
    const r = clickAll();
    expect(handleKey(r.state, r.project, 'Enter', { promptName: () => null }).project.rooms).toHaveLength(0);
  });
});

describe('select tool', () => {
  it('selects a wall by clicking it and deletes it with Delete', () => {
    const p = box();
    const r = handleClick({ ...initialToolState(), tool: 'select' }, p, { x: 1, y: 0.05 }, noMods);
    expect(r.state.selected).toEqual({ kind: 'wall', id: p.walls[0].id });
    expect(handleKey(r.state, r.project, 'Delete').project.walls).toHaveLength(0);
  });

  it('prefers an opening over its wall', () => {
    const p = handleClick({ ...initialToolState(), tool: 'door' }, box(), { x: 2, y: 0 }, noMods).project;
    const r = handleClick({ ...initialToolState(), tool: 'select' }, p, { x: 2, y: 0 }, noMods);
    expect(r.state.selected?.kind).toBe('opening');
  });

  it('selects a room by clicking inside it', () => {
    const p = addRoom(emptyProject(), 'Kamar', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }]) as Project;
    const r = handleClick({ ...initialToolState(), tool: 'select' }, p, { x: 2, y: 1.5 }, noMods);
    expect(r.state.selected).toEqual({ kind: 'room', id: p.rooms[0].id });
  });

  it('clicking empty space clears the selection', () => {
    const p = box();
    const r = handleClick({ ...initialToolState(), tool: 'select', selected: { kind: 'wall', id: p.walls[0].id } }, p, { x: 9, y: 9 }, noMods);
    expect(r.state.selected).toBeUndefined();
  });
});
