import type { Store } from '../model/store';
import type { Failure, Furniture, Opening, Project, Room, Vec2, Wall } from '../model/types';
import { polygonArea } from '../geometry/polygon';
import { snapPoint } from '../geometry/snap';
import { add, dist, normalize, scale, sub } from '../geometry/vec';
import { addRoom, cornerAt, moveCorner, moveFurniture } from '../model/project';
import { drawOrder, footprint, furnitureAt } from '../geometry/footprint';
import { FLOOR_MATERIALS, FURNITURE, type FurnitureKind } from '../interior/kinds';
import { askText } from '../ui/dialog';
import { parseLength } from '../geometry/length';
import { labelSide, wheelAction } from './navigation';
import { handleClick, handleKey, handleLengthInput, initialToolState, type Selection, nearestWall, reconcile, type ToolName, type ToolResult, type ToolState } from './tools';

const DRAG_THRESHOLD_PX = 4;

const COLORS = {
  bg: '#f7f5f0',
  gridMinor: '#ebe7de',
  gridMajor: '#d8d2c4',
  wall: '#2b2a27',
  room: 'rgba(196, 170, 120, 0.22)',
  roomLabel: '#5a4a2c',
  draft: '#c2410c',
  selected: '#2563eb',
  door: '#8a5a2b',
  window: '#3b82c4',
  label: '#6b6658',
};

export class PlanView {
  private ctx: CanvasRenderingContext2D;
  private state: ToolState = initialToolState();
  private center: Vec2 = { x: 4, y: 3 };
  private zoom = 60; // pixels per meter
  private hover?: Vec2;
  // `click` is set when a press on empty space may still turn out to be a plain click
  private panning?: { start: Vec2; center: Vec2; click?: { world: Vec2; shift: boolean }; moved?: boolean };
  private spaceDown = false;
  private lengthInput?: HTMLInputElement;
  // a press on a corner or furniture becomes a drag only after the pointer really moves
  private drag?: {
    from: Vec2;
    down: Vec2;
    shift: boolean;
    moved: boolean;
    preview?: Project;
    /** Set when dragging furniture; `from` is then the grab point's offset from its center. */
    furnitureId?: string;
  };
  private shiftDown = false;

  onMessage: (msg: string) => void = () => {};
  onStateChange: (s: ToolState) => void = () => {};

  private canvas: HTMLCanvasElement;
  private store: Store;

  constructor(canvas: HTMLCanvasElement, store: Store) {
    this.canvas = canvas;
    this.store = store;
    this.ctx = canvas.getContext('2d')!;
    store.subscribe((p) => {
      const next = reconcile(this.state, p);
      if (next !== this.state) this.setState(next);
      else this.draw();
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.bindInput();
    this.resize();
  }

  get toolState(): ToolState {
    return this.state;
  }

  setTool(tool: ToolName): void {
    this.setState({ ...this.state, tool, draft: [], selected: undefined, placing: undefined });
  }

  /** Runs a click at a plan point through the active tool, as if it happened on the 2D canvas. */
  clickAt(world: Vec2, shift: boolean): void {
    this.applyResult(handleClick(this.state, this.store.project, world, { shift }));
  }

  select(selected: Selection | undefined): void {
    this.setState({ ...this.state, tool: 'select', placing: undefined, draft: [], selected });
  }

  /** Zooms and centers so the whole drawing fits the canvas. */
  fit(): void {
    const p = this.store.project;
    const pts = [...p.walls.flatMap((w) => [w.a, w.b]), ...p.rooms.flatMap((r) => r.points), ...p.furniture.flatMap(footprint)];
    if (!pts.length) return;
    const min = { x: Math.min(...pts.map((q) => q.x)), y: Math.min(...pts.map((q) => q.y)) };
    const max = { x: Math.max(...pts.map((q) => q.x)), y: Math.max(...pts.map((q) => q.y)) };
    const margin = 60;
    const { x: w, y: h } = this.size;
    this.zoom = Math.min(400, Math.max(10, Math.min((w - margin * 2) / Math.max(max.x - min.x, 1), (h - margin * 2) / Math.max(max.y - min.y, 1))));
    this.center = scale(add(min, max), 0.5);
    this.draw();
  }

  /** Arms the furniture tool: the next click on the plan places `kind`. */
  placeFurniture(kind: FurnitureKind): void {
    this.setState({ ...this.state, tool: 'furniture', draft: [], selected: undefined, placing: kind });
  }

  /** Runs a key through the active tool; returns true when it was handled. */
  key(key: string): boolean {
    const r = handleKey(this.state, this.store.project, key);
    if (!r.handled) return false;
    this.applyResult(r);
    return true;
  }

  /**
   * Starts typing a length for the next wall/room point when a line is in progress.
   * Returns true when the key was taken.
   */
  startLengthInput(key: string): boolean {
    const { tool, draft } = this.state;
    if ((tool !== 'wall' && tool !== 'room') || !draft.length || !/^[0-9.,]$/.test(key)) return false;
    const input = this.lengthInput ?? this.createLengthInput();
    input.value = key;
    input.hidden = false;
    this.positionLengthInput();
    input.focus();
    input.setSelectionRange(1, 1);
    return true;
  }

  private createLengthInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.className = 'length-input';
    input.inputMode = 'decimal';
    input.placeholder = 'm';
    input.setAttribute('aria-label', 'Panjang (meter atau cm)');
    input.hidden = true;
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.hideLengthInput();
      if (e.key !== 'Enter') return;
      const len = parseLength(input.value);
      if (len === undefined) {
        this.onMessage('Ukuran tidak valid. Contoh: 4.5 atau 450cm');
        return;
      }
      this.hideLengthInput();
      this.applyLength(len);
    });
    input.addEventListener('blur', () => this.hideLengthInput());
    this.canvas.parentElement!.append(input);
    this.lengthInput = input;
    return input;
  }

  private hideLengthInput(): void {
    if (!this.lengthInput || this.lengthInput.hidden) return;
    this.lengthInput.hidden = true;
    this.lengthInput.blur();
  }

  private positionLengthInput(): void {
    if (!this.lengthInput) return;
    const at = this.toScreen(this.hover ?? this.state.draft.at(-1)!);
    this.lengthInput.style.left = `${at.x + 14}px`;
    this.lengthInput.style.top = `${at.y + 14}px`;
  }

  private applyLength(len: number): void {
    const last = this.state.draft.at(-1)!;
    const toward = this.hover ?? { x: last.x + 1, y: last.y };
    // typing usually happens with the hand off Shift, so near-straight lines count as straight
    const angle = Math.abs(Math.atan2(toward.y - last.y, toward.x - last.x)) % (Math.PI / 2);
    const nearAxis = Math.min(angle, Math.PI / 2 - angle) < (5 * Math.PI) / 180;
    this.applyResult(handleLengthInput(this.state, this.store.project, toward, len, { shift: this.shiftDown || nearAxis }));
  }

  /** Forgets the half-drawn line, e.g. after undo removed the wall it continued from. */
  clearDraft(): void {
    if (this.state.draft.length) this.setState({ ...this.state, draft: [] });
  }

  private setState(s: ToolState): void {
    this.state = s;
    this.onStateChange(s);
    this.draw();
  }

  private applyResult(r: ToolResult): void {
    this.store.apply(r.project);
    if (r.message) this.onMessage(r.message);
    this.setState(r.state);
    if (r.pendingRoom) void this.nameRoom(r.pendingRoom.points, r.pendingRoom.suggested);
  }

  private async nameRoom(points: Vec2[], suggested: string): Promise<void> {
    const name = await askText('Nama ruangan:', suggested);
    if (name === null) return;
    const r = addRoom(this.store.project, name.trim() || suggested, points);
    if ('error' in r) this.onMessage(r.error);
    else this.store.apply(r);
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  private get size(): Vec2 {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.width, y: r.height };
  }

  private toScreen(p: Vec2): Vec2 {
    return add(scale(sub(p, this.center), this.zoom), scale(this.size, 0.5));
  }

  private toWorld(s: Vec2): Vec2 {
    return add(scale(sub(s, scale(this.size, 0.5)), 1 / this.zoom), this.center);
  }

  private eventPoint(e: MouseEvent): Vec2 {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
        e.preventDefault();
        c.setPointerCapture(e.pointerId);
        this.panning = { start: this.eventPoint(e), center: this.center };
        return;
      }
      if (e.button !== 0) return;
      const world = this.toWorld(this.eventPoint(e));
      if (this.state.tool === 'select') {
        const down = this.eventPoint(e);
        const from = cornerAt(this.store.project, world, 10 / this.zoom);
        const item = from ? undefined : furnitureAt(this.store.project, world);
        if (from || item) {
          c.setPointerCapture(e.pointerId);
          this.drag = item
            ? { from: sub(world, item), down, shift: e.shiftKey, moved: false, furnitureId: item.id }
            : { from: from!, down, shift: e.shiftKey, moved: false };
          return;
        }
        // empty space: dragging pans the plan, a plain click still selects
        c.setPointerCapture(e.pointerId);
        this.panning = { start: down, center: this.center, click: { world, shift: e.shiftKey } };
        return;
      }
      this.applyResult(handleClick(this.state, this.store.project, world, { shift: e.shiftKey }));
    });

    c.addEventListener('pointermove', (e) => {
      const s = this.eventPoint(e);
      if (this.panning) {
        if (!this.panning.moved && dist(s, this.panning.start) > DRAG_THRESHOLD_PX) this.panning.moved = true;
        if (this.panning.moved || !this.panning.click) {
          this.center = sub(this.panning.center, scale(sub(s, this.panning.start), 1 / this.zoom));
        }
      }
      this.shiftDown = e.shiftKey;
      this.hover = this.toWorld(s);
      if (this.drag && !this.drag.moved && dist(s, this.drag.down) > DRAG_THRESHOLD_PX) this.drag.moved = true;
      if (this.drag?.moved) {
        const r = this.dragResult();
        this.drag.preview = 'error' in r ? undefined : r;
      }
      this.draw();
    });

    c.addEventListener('pointerup', () => {
      const pan = this.panning;
      this.panning = undefined;
      if (pan?.click && !pan.moved) {
        this.applyResult(handleClick(this.state, this.store.project, pan.click.world, { shift: pan.click.shift }));
        return;
      }
      const drag = this.drag;
      if (!drag) return;
      if (!drag.moved) {
        // just a click: select what is under the corner instead of moving it
        this.drag = undefined;
        const at = this.toWorld(drag.down);
        this.applyResult(handleClick(this.state, this.store.project, at, { shift: drag.shift }));
        return;
      }
      const r = this.dragResult();
      this.drag = undefined;
      if ('error' in r) this.onMessage(r.error);
      else this.store.apply(r);
      if (drag.furnitureId) this.setState({ ...this.state, selected: { kind: 'furniture', id: drag.furnitureId } });
      this.draw();
    });
    c.addEventListener('pointercancel', () => {
      this.panning = undefined;
      this.drag = undefined;
      this.draw();
    });
    c.addEventListener('pointerleave', () => {
      this.hover = undefined;
      this.draw();
    });

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (wheelAction(e) === 'pan') {
          this.center = add(this.center, scale({ x: e.deltaX, y: e.deltaY }, 1 / this.zoom));
          this.draw();
          return;
        }
        const s = this.eventPoint(e);
        const before = this.toWorld(s);
        // a pinch sends small deltas, so it needs a stronger factor than a wheel notch
        const speed = e.ctrlKey ? 0.01 : 0.0015;
        this.zoom = Math.min(400, Math.max(10, this.zoom * Math.exp(-e.deltaY * speed)));
        this.center = add(this.center, sub(before, this.toWorld(s)));
        this.draw();
      },
      { passive: false },
    );

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !isTextField(e.target)) {
        this.spaceDown = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceDown = false;
    });
  }

  private dragResult(): Project | Failure {
    const drag = this.drag!;
    if (!drag.furnitureId) return moveCorner(this.store.project, drag.from, this.dragTarget());
    const center = sub(this.hover ?? drag.from, drag.from);
    const step = 0.05;
    const at = { x: +(Math.round(center.x / step) * step).toFixed(3), y: +(Math.round(center.y / step) * step).toFixed(3) };
    return moveFurniture(this.store.project, drag.furnitureId, at);
  }

  private dragTarget(): Vec2 {
    const { from } = this.drag!;
    // snap to other corners, never to the walls being dragged
    const walls = this.store.project.walls.filter((w) => dist(w.a, from) > 0.001 && dist(w.b, from) > 0.001);
    return snapPoint(this.hover ?? from, { walls, from, ortho: this.shiftDown });
  }

  private snappedHover(): Vec2 | undefined {
    if (!this.hover) return undefined;
    if (this.state.tool !== 'wall' && this.state.tool !== 'room') return this.hover;
    return snapPoint(this.hover, { walls: this.store.project.walls, from: this.state.draft.at(-1), ortho: this.shiftDown });
  }

  draw(): void {
    const { ctx } = this;
    const { x: w, y: h } = this.size;
    const p = this.drag?.preview ?? this.store.project;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    this.drawGrid();
    for (const r of p.rooms) this.drawRoom(r, this.isSelected('room', r.id));
    for (const f of drawOrder(p.furniture)) this.drawFurniture(f, false);
    for (const wall of p.walls) this.drawWall(wall, this.isSelected('wall', wall.id));
    for (const o of p.openings) {
      const wall = p.walls.find((x) => x.id === o.wallId);
      if (wall) this.drawOpening(wall, o, this.isSelected('opening', o.id));
    }
    // the selected piece is drawn again on top, so walls never hide its outline
    const picked = p.furniture.find((f) => this.isSelected('furniture', f.id));
    if (picked) this.drawFurniture(picked, true);
    for (const r of p.rooms) this.drawRoomLabel(r.name, r.points);
    const houseCenter = centerOf(p);
    for (const wall of p.walls) this.drawLength(wall.a, wall.b, houseCenter);
    this.drawDraft(p);
  }

  private isSelected(kind: string, id: string): boolean {
    return this.state.selected?.kind === kind && this.state.selected.id === id;
  }

  private drawGrid(): void {
    const { ctx } = this;
    const tl = this.toWorld({ x: 0, y: 0 });
    const br = this.toWorld(this.size);
    const steps: [number, string][] = this.zoom > 30 ? [[0.1, COLORS.gridMinor], [1, COLORS.gridMajor]] : [[1, COLORS.gridMajor]];
    for (const [step, color] of steps) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) {
        const sx = Math.round(this.toScreen({ x, y: 0 }).x) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, this.size.y);
      }
      for (let y = Math.floor(tl.y / step) * step; y <= br.y; y += step) {
        const sy = Math.round(this.toScreen({ x: 0, y }).y) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(this.size.x, sy);
      }
      ctx.stroke();
    }
  }

  private polygonPath(points: Vec2[]): void {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach((pt, i) => {
      const s = this.toScreen(pt);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
  }

  private drawRoom(room: Room, selected: boolean): void {
    this.polygonPath(room.points);
    this.ctx.fillStyle = FLOOR_MATERIALS[room.floor].color;
    this.ctx.globalAlpha = 0.55;
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
    if (selected) {
      this.ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
      this.ctx.fill();
    }
    if (selected) {
      this.ctx.strokeStyle = COLORS.selected;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }

  private drawFurniture(f: Furniture, selected: boolean, ghost = false): void {
    const { ctx } = this;
    const corners = footprint(f);
    this.polygonPath(corners);
    ctx.fillStyle = f.color;
    ctx.globalAlpha = ghost ? 0.4 : f.kind === 'karpet' ? 0.5 : 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ghost ? COLORS.draft : selected ? COLORS.selected : 'rgba(43, 42, 39, 0.75)';
    ctx.lineWidth = selected ? 2.5 : 1;
    ctx.stroke();

    // a short line on the back edge shows which way the piece faces
    const back = [this.toScreen(corners[0]), this.toScreen(corners[1])];
    ctx.lineWidth = selected ? 3 : 2.5;
    ctx.beginPath();
    ctx.moveTo(back[0].x, back[0].y);
    ctx.lineTo(back[1].x, back[1].y);
    ctx.stroke();

    const { w, d } = FURNITURE[f.kind].size;
    if (Math.min(w, d) * this.zoom < 28) return;
    const c = this.toScreen(f);
    ctx.fillStyle = '#2b2a27';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(FURNITURE[f.kind].label, c.x, c.y + 3);
  }

  private drawRoomLabel(name: string, points: Vec2[]): void {
    const c = scale(points.reduce(add, { x: 0, y: 0 }), 1 / points.length);
    const s = this.toScreen(c);
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.roomLabel;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(name, s.x, s.y - 2);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${polygonArea(points).toFixed(2)} m²`, s.x, s.y + 14);
  }

  private wallCorners(a: Vec2, b: Vec2, thickness: number): Vec2[] {
    const dir = normalize(sub(b, a));
    const n = scale({ x: -dir.y, y: dir.x }, thickness / 2);
    return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
  }

  private drawWall(wall: Wall, selected: boolean): void {
    // extend by half the thickness so corners meet without a notch
    const ext = scale(normalize(sub(wall.b, wall.a)), wall.thickness / 2);
    this.polygonPath(this.wallCorners(sub(wall.a, ext), add(wall.b, ext), wall.thickness));
    this.ctx.fillStyle = selected ? COLORS.selected : COLORS.wall;
    this.ctx.fill();
  }

  private drawOpening(wall: Wall, o: Opening, selected: boolean): void {
    const { ctx } = this;
    const dir = normalize(sub(wall.b, wall.a));
    const start = add(wall.a, scale(dir, o.offset - o.width / 2));
    const end = add(wall.a, scale(dir, o.offset + o.width / 2));
    // clear the wall where the opening is
    this.polygonPath(this.wallCorners(start, end, wall.thickness + 0.02));
    ctx.fillStyle = COLORS.bg;
    ctx.fill();

    const color = selected ? COLORS.selected : o.type === 'door' ? COLORS.door : COLORS.window;
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 2.5 : 1.5;
    if (o.type === 'window') {
      this.polygonPath(this.wallCorners(start, end, wall.thickness));
      ctx.stroke();
      const s1 = this.toScreen(start);
      const s2 = this.toScreen(end);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
    } else {
      // door leaf + swing arc
      const hinge = this.toScreen(start);
      const leafEnd = this.toScreen(add(start, scale({ x: -dir.y, y: dir.x }, o.width)));
      const r = o.width * this.zoom;
      const base = Math.atan2(dir.y, dir.x);
      ctx.beginPath();
      ctx.moveTo(hinge.x, hinge.y);
      ctx.lineTo(leafEnd.x, leafEnd.y);
      ctx.moveTo(hinge.x + Math.cos(base) * r, hinge.y + Math.sin(base) * r);
      ctx.arc(hinge.x, hinge.y, r, base, base + Math.PI / 2);
      ctx.stroke();
    }
  }

  private drawLength(a: Vec2, b: Vec2, houseCenter?: Vec2): void {
    if (this.zoom < 25) return;
    const mid = this.toScreen(scale(add(a, b), 0.5));
    const dir = normalize(sub(b, a));
    // wall labels sit outside the house so they never cover furniture
    const n = houseCenter ? labelSide(a, b, houseCenter) : { x: -dir.y, y: dir.x };
    const { ctx } = this;
    ctx.fillStyle = COLORS.label;
    ctx.font = '11px system-ui, sans-serif';
    // anchor the text on the side facing away from the wall so it never overlaps the wall line
    ctx.textAlign = n.x > 0.5 ? 'left' : n.x < -0.5 ? 'right' : 'center';
    const gap = 12;
    const baseline = n.y > 0.5 ? 10 : n.y < -0.5 ? -2 : 4;
    ctx.fillText(formatLength(dist(a, b)), mid.x + n.x * gap, mid.y + n.y * gap + baseline);
  }

  private drawCorners(p: Project): void {
    const { ctx } = this;
    const seen = new Set<string>();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 1.5;
    for (const w of p.walls) {
      for (const end of [w.a, w.b]) {
        const key = `${end.x.toFixed(3)},${end.y.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const s = this.toScreen(end);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  private drawDraft(p: Project): void {
    const { ctx } = this;
    if (this.state.tool === 'select') this.drawCorners(p);
    if (this.state.tool === 'furniture' && this.state.placing && this.hover) {
      // ghost of the piece under the cursor before it is placed
      const kind = this.state.placing;
      this.drawFurniture({ id: '', kind, x: this.hover.x, y: this.hover.y, rotation: 0, color: FURNITURE[kind].color }, false, true);
    }
    const hover = this.snappedHover();
    const { tool, draft } = this.state;

    if ((tool === 'door' || tool === 'window') && this.hover) {
      const wall = nearestWall(p, this.hover);
      if (wall) {
        this.polygonPath(this.wallCorners(wall.a, wall.b, wall.thickness + 0.06));
        ctx.strokeStyle = COLORS.draft;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    if (tool !== 'wall' && tool !== 'room') return;
    const pts = hover ? [...draft, hover] : draft;
    if (pts.length > 1) {
      ctx.strokeStyle = COLORS.draft;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const s = this.toScreen(pt);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      const last = pts.at(-1)!;
      const prev = pts.at(-2)!;
      this.drawLength(prev, last);
    }
    if (hover) {
      const s = this.toScreen(hover);
      ctx.fillStyle = COLORS.draft;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function centerOf(p: Project): Vec2 | undefined {
  if (!p.walls.length) return undefined;
  const pts = p.walls.flatMap((w) => [w.a, w.b]);
  return scale(pts.reduce(add, { x: 0, y: 0 }), 1 / pts.length);
}

export function isTextField(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.closest('dialog') !== null)
  );
}

export function formatLength(m: number): string {
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`;
}
