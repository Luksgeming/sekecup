import { addFurniture, addOpening, addRoom, addWall, removeFurniture, removeOpening, removeRoom, removeWall, updateFurniture } from '../model/project';
import { furnitureAt } from '../geometry/footprint';
import type { FurnitureKind } from '../interior/kinds';
import { DOOR_DEFAULTS, WINDOW_DEFAULTS, type Project, type Vec2, type Wall } from '../model/types';
import { pointInPolygon, polygonArea } from '../geometry/polygon';
import { snapPoint } from '../geometry/snap';
import { dist } from '../geometry/vec';
import { pointAtLength } from '../geometry/length';
import { projectOnWall } from '../geometry/wallBoxes';

export type ToolName = 'select' | 'wall' | 'door' | 'window' | 'room' | 'furniture';

export type Selection = { kind: 'wall' | 'opening' | 'room' | 'furniture'; id: string };

export type ToolState = {
  tool: ToolName;
  draft: Vec2[];
  hoverWallId?: string;
  selected?: Selection;
  /** The catalog item the furniture tool will place. */
  placing?: FurnitureKind;
};

export type ToolResult = {
  state: ToolState;
  project: Project;
  message?: string;
  /** Set by handleKey: whether the key did anything (so the app can let unused keys through). */
  handled?: boolean;
  /** A finished room outline still waiting for its name (when no promptName is given). */
  pendingRoom?: { points: Vec2[]; suggested: string };
};

export type ToolContext = { promptName?: (suggested: string) => string | null };

const WALL_PICK_DISTANCE = 0.3;
const FURNITURE_GRID = 0.05;

// rounded to the millimeter so saved files stay tidy
const roundTo = (v: number, step: number) => +(Math.round(v / step) * step).toFixed(3);
const CLOSE_ROOM_DISTANCE = 0.2;

export const initialToolState = (): ToolState => ({ tool: 'wall', draft: [] });

export function nearestWall(p: Project, at: Vec2, maxDistance = WALL_PICK_DISTANCE): Wall | undefined {
  let best: Wall | undefined;
  let bestDist = maxDistance;
  for (const w of p.walls) {
    const { distance } = projectOnWall(w, at);
    if (distance <= bestDist) {
      best = w;
      bestDist = distance;
    }
  }
  return best;
}

export function handleClick(
  state: ToolState,
  project: Project,
  world: Vec2,
  mods: { shift: boolean },
  ctx: ToolContext = {},
): ToolResult {
  switch (state.tool) {
    case 'wall': {
      const last = state.draft.at(-1);
      const pt = snapPoint(world, { walls: project.walls, from: last, ortho: mods.shift });
      if (!last) return { state: { ...state, draft: [pt] }, project };
      const next = addWall(project, last, pt);
      return { state: { ...state, draft: [pt] }, project: next };
    }

    case 'door':
    case 'window': {
      const wall = nearestWall(project, world);
      if (!wall) return { state, project };
      const defaults = state.tool === 'door' ? DOOR_DEFAULTS : WINDOW_DEFAULTS;
      // a click near a corner slides the opening inward instead of failing
      const half = defaults.width / 2;
      const len = dist(wall.a, wall.b);
      const offset = Math.min(Math.max(projectOnWall(wall, world).offset, half), len - half);
      const r = addOpening(project, { wallId: wall.id, type: state.tool, offset, ...defaults });
      return 'error' in r ? { state, project, message: r.error } : { state, project: r };
    }

    case 'room': {
      const pt = snapPoint(world, { walls: project.walls, from: state.draft.at(-1), ortho: mods.shift });
      if (state.draft.length >= 3 && dist(pt, state.draft[0]) <= CLOSE_ROOM_DISTANCE) {
        return finishRoom(state, project, ctx);
      }
      return { state: { ...state, draft: [...state.draft, pt] }, project };
    }

    case 'furniture': {
      if (!state.placing) return { state, project };
      const at = { x: roundTo(world.x, FURNITURE_GRID), y: roundTo(world.y, FURNITURE_GRID) };
      const next = addFurniture(project, state.placing, at);
      const id = next.furniture.at(-1)!.id;
      return { state: { ...state, tool: 'select', draft: [], selected: { kind: 'furniture', id } }, project: next };
    }

    case 'select':
      return { state: { ...state, selected: pick(project, world) }, project };
  }
}

/** Places the next wall/room point `length` meters from the last one, toward the cursor. */
export function handleLengthInput(
  state: ToolState,
  project: Project,
  toward: Vec2,
  length: number,
  mods: { shift: boolean },
): ToolResult {
  const last = state.draft.at(-1);
  if (!last || (state.tool !== 'wall' && state.tool !== 'room')) return { state, project };
  let aim = toward;
  if (mods.shift) {
    aim = Math.abs(toward.x - last.x) >= Math.abs(toward.y - last.y) ? { x: toward.x, y: last.y } : { x: last.x, y: toward.y };
  }
  const pt = pointAtLength(last, aim, length);
  if (state.tool === 'room') return { state: { ...state, draft: [...state.draft, pt] }, project };
  return { state: { ...state, draft: [pt] }, project: addWall(project, last, pt) };
}

export function handleKey(state: ToolState, project: Project, key: string, ctx: ToolContext = {}): ToolResult {
  if (key === 'Escape') {
    const busy = state.draft.length > 0 || state.selected !== undefined;
    return { state: { ...state, draft: [], selected: undefined }, project, handled: busy };
  }
  if (key === 'Enter' && state.tool === 'room' && state.draft.length) return { ...finishRoom(state, project, ctx), handled: true };
  if (key.toLowerCase() === 'r' && state.selected?.kind === 'furniture') {
    const f = project.furniture.find((x) => x.id === state.selected!.id)!;
    const next = updateFurniture(project, f.id, { rotation: f.rotation + 90 });
    return { state, project: 'error' in next ? project : next, handled: true };
  }
  if ((key === 'Delete' || key === 'Backspace') && state.selected) {
    const { kind, id } = state.selected;
    const remove = { wall: removeWall, opening: removeOpening, room: removeRoom, furniture: removeFurniture }[kind];
    const next = remove(project, id);
    return { state: { ...state, selected: undefined }, project: next, handled: true };
  }
  return { state, project, handled: false };
}

/** Drops a selection whose object was removed, e.g. by undo. */
export function reconcile(state: ToolState, project: Project): ToolState {
  const sel = state.selected;
  if (!sel) return state;
  const list = { wall: project.walls, opening: project.openings, room: project.rooms, furniture: project.furniture }[sel.kind];
  return list.some((x) => x.id === sel.id) ? state : { ...state, selected: undefined };
}

function finishRoom(state: ToolState, project: Project, ctx: ToolContext): ToolResult {
  const cleared = { ...state, draft: [] };
  if (state.draft.length < 3) return { state: cleared, project, message: 'Ruangan butuh minimal 3 titik' };
  const suggested = `Ruang ${project.rooms.length + 1}`;
  if (!ctx.promptName) return { state: cleared, project, pendingRoom: { points: state.draft, suggested } };
  const name = ctx.promptName(suggested);
  if (name === null) return { state: cleared, project };
  const r = addRoom(project, name.trim() || suggested, state.draft);
  return 'error' in r ? { state: cleared, project, message: r.error } : { state: cleared, project: r };
}

function pick(project: Project, at: Vec2): ToolState['selected'] {
  const item = furnitureAt(project, at);
  if (item) return { kind: 'furniture', id: item.id };
  const wall = nearestWall(project, at, 0.2);
  if (wall) {
    const { offset } = projectOnWall(wall, at);
    const opening = project.openings.find((o) => o.wallId === wall.id && Math.abs(o.offset - offset) <= o.width / 2);
    return opening ? { kind: 'opening', id: opening.id } : { kind: 'wall', id: wall.id };
  }
  // smallest room first, so a room inside a bigger one stays clickable
  const room = [...project.rooms]
    .sort((a, b) => polygonArea(a.points) - polygonArea(b.points))
    .find((r) => pointInPolygon(at, r.points));
  return room ? { kind: 'room', id: room.id } : undefined;
}
