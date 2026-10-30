import type { Store } from '../model/store';
import type { Failure, Furniture, Opening, Project, Room, Vec2, Wall } from '../model/types';
import { polygonArea } from '../geometry/polygon';
import { snapPoint } from '../geometry/snap';
import { add, dist, normalize, scale, sub } from '../geometry/vec';
import { addRoom, cornerAt, moveCorner, moveFurniture } from '../model/project';
import { drawOrder, footprint, furnitureAt } from '../geometry/footprint';
import { FLOOR_MATERIALS, FURNITURE, hangsFromCeiling, type FurnitureKind } from '../interior/kinds';
import { askText } from '../ui/dialog';
import { parseDrawingLength } from '../geometry/length';
import { WheelGesture } from './navigation';
import { dimensionsFor, type Dimension } from './dimensions';
import { roomSchedule } from './schedule';
import { furnitureSymbol } from './symbols';
import { loadLayers, visibleForPicking, type LayerState } from './layers';
import { handleClick, handleKey, handleLengthInput, initialToolState, type Selection, nearestWall, reconcile, type ToolName, type ToolResult, type ToolState } from './tools';

const DRAG_THRESHOLD_PX = 4;
// a finger tap wobbles more than a mouse click
const TOUCH_THRESHOLD_PX = 10;

export type PlanTheme = 'cad' | 'paper';

const SCHEDULE_WIDTH = 200;
const SCHEDULE_ROW = 20;

const CAD_FONT = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace";

const THEMES = {
  // dark drafting screen, like a CAD program
  cad: {
    bg: '#1d232c',
    gridMinor: '#222a35',
    gridMajor: '#2a3441',
    wall: '#dfe5ec',
    wallFill: '#1d232c',
    hatch: '#6f7c8c',
    roomLabel: '#f2d14b',
    text: '#dfe5ec',
    furniture: '#c3ccd7',
    furnitureFill: 'rgba(195, 204, 215, 0.05)',
    door: '#4fd683',
    window: '#4cc9e8',
    dim: '#4cc9e8',
    schedule: '#f2d14b',
    compass: '#8a97a8',
    draft: '#ff9a4a',
    draftFill: 'rgba(255, 154, 74, 0.12)',
    selected: '#5aa8ff',
    selectedFill: 'rgba(90, 168, 255, 0.18)',
  },
  // light, paper-like plan
  paper: {
    bg: '#f7f5f0',
    gridMinor: '#ebe7de',
    gridMajor: '#d8d2c4',
    wall: '#2b2a27',
    wallFill: '#f7f5f0',
    hatch: '#8f887a',
    roomLabel: '#5a4a2c',
    text: '#2b2a27',
    furniture: '#4a4740',
    furnitureFill: 'rgba(228, 223, 212, 0.9)',
    door: '#8a5a2b',
    window: '#3b82c4',
    dim: '#6b6658',
    schedule: '#5a4a2c',
    compass: '#8f887a',
    draft: '#c2410c',
    draftFill: 'rgba(194, 65, 12, 0.12)',
    selected: '#2563eb',
    selectedFill: 'rgba(37, 99, 235, 0.15)',
  },
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
  private wheel = new WheelGesture();
  private lastPointer?: Vec2;
  private theme: PlanTheme = 'cad';
  private c = THEMES.cad;
  private hatch?: CanvasPattern | string;
  private layers: LayerState = loadLayers();
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
  onCursor: (at: Vec2 | undefined) => void = () => {};

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
    this.click(world, shift);
  }

  select(selected: Selection | undefined): void {
    this.setState({ ...this.state, tool: 'select', placing: undefined, draft: [], selected });
  }

  /** Zooms around the middle of the canvas. */
  zoomBy(factor: number): void {
    this.zoom = Math.min(400, Math.max(10, this.zoom * factor));
    this.draw();
  }

  /** Back to the starting view: 60 px per meter, looking at the first few meters. */
  resetView(): void {
    this.center = { x: 4, y: 3 };
    this.zoom = 60;
    this.draw();
  }

  private click(world: Vec2, shift: boolean): void {
    const { tool } = this.state;
    const p = this.store.project;
    if (tool === 'select') {
      // picking only reaches what is visible; the selection still refers to the real drawing
      const r = handleClick(this.state, visibleForPicking(p, this.layers), world, { shift });
      this.setState(r.state);
      return;
    }
    if ((tool === 'door' || tool === 'window') && !this.layers.walls) {
      this.onMessage('Layer Dinding sedang disembunyikan. Tampilkan dulu untuk memasang pintu atau jendela.');
      return;
    }
    this.applyResult(handleClick(this.state, p, world, { shift }));
  }

  /** Zooms and centers so the whole drawing, its dimensions and the room schedule fit the canvas. */
  fit(): void {
    const p = this.store.project;
    const pts = [...p.walls.flatMap((w) => [w.a, w.b]), ...p.rooms.flatMap((r) => r.points), ...p.furniture.flatMap(footprint)];
    if (!pts.length) return;
    // room for the dimension lines around the walls
    const pad = this.drawingPad(p);
    const min = { x: Math.min(...pts.map((q) => q.x)) - pad, y: Math.min(...pts.map((q) => q.y)) - pad };
    const max = { x: Math.max(...pts.map((q) => q.x)) + pad, y: Math.max(...pts.map((q) => q.y)) + pad };
    // the schedule table keeps a fixed on-screen size, beside the drawing or (narrow panes) below it
    const hasTable = this.layers.schedule && p.rooms.length > 0;
    const tableW = hasTable && !this.scheduleBelow ? SCHEDULE_WIDTH + 12 : 0;
    const tableH = hasTable && this.scheduleBelow ? this.scheduleHeight(p) + 12 : 0;
    const margin = 36;
    const { x: w, y: h } = this.size;
    // a hidden plan (3D-only view) has no size yet: fit once it is shown again
    if (w < 80 || h < 80) {
      this.fitWhenShown = true;
      return;
    }
    this.fitWhenShown = false;
    const zoom = Math.min(
      (w - margin * 2 - tableW) / Math.max(max.x - min.x, 1),
      (h - margin * 2 - tableH) / Math.max(max.y - min.y, 1),
    );
    this.zoom = Math.min(400, Math.max(10, zoom));
    // shift by half the table so drawing and table together are centered
    this.center = { x: (min.x + max.x) / 2 + tableW / 2 / this.zoom, y: (min.y + max.y) / 2 + tableH / 2 / this.zoom };
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
      const len = parseDrawingLength(input.value);
      if (len === undefined) {
        this.onMessage('Panjang tidak valid. Contoh: 4500 (mm), 4,5 (m) atau 450cm');
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

  /** A length typed on the command line: places the next wall/room point. False when no line is being drawn. */
  typeLength(meters: number): boolean {
    const { tool, draft } = this.state;
    if ((tool !== 'wall' && tool !== 'room') || !draft.length) return false;
    this.applyLength(meters);
    return true;
  }

  private applyLength(len: number): void {
    const last = this.state.draft.at(-1)!;
    // aim where the pointer last was on the canvas, even after it left to type on the command line
    const toward = this.hover ?? this.lastPointer ?? { x: last.x + 1, y: last.y };
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

  private fitWhenShown = false;

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hatch = undefined;
    if (this.fitWhenShown && width >= 80 && height >= 80) this.fit();
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
        const visible = visibleForPicking(this.store.project, this.layers);
        const from = cornerAt(visible, world, 10 / this.zoom);
        const item = from ? undefined : furnitureAt(visible, world);
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
      this.click(world, e.shiftKey);
    });

    c.addEventListener('pointermove', (e) => {
      const s = this.eventPoint(e);
      if (this.panning) {
        const limit = e.pointerType === 'touch' ? TOUCH_THRESHOLD_PX : DRAG_THRESHOLD_PX;
        if (!this.panning.moved && dist(s, this.panning.start) > limit) this.panning.moved = true;
        if (this.panning.moved || !this.panning.click) {
          this.center = sub(this.panning.center, scale(sub(s, this.panning.start), 1 / this.zoom));
        }
      }
      this.shiftDown = e.shiftKey;
      this.hover = this.toWorld(s);
      this.lastPointer = this.hover;
      this.onCursor(this.hover);
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
        this.click(pan.click.world, pan.click.shift);
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
      this.onCursor(undefined);
      this.draw();
    });

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const w = this.wheel.read(e, e.timeStamp);
        if (w.action === 'pan') {
          this.center = add(this.center, scale({ x: w.dx, y: w.dy }, 1 / this.zoom));
          this.draw();
          return;
        }
        const s = this.eventPoint(e);
        const before = this.toWorld(s);
        this.zoom = Math.min(400, Math.max(10, this.zoom * Math.exp(-w.dy * w.speed)));
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

  /** Switches between the dark CAD drawing look and the light paper look. */
  setTheme(theme: PlanTheme): void {
    this.theme = theme;
    this.c = THEMES[theme];
    this.hatch = undefined;
    this.draw();
  }

  setLayers(layers: LayerState): void {
    this.layers = layers;
    // a selection on a layer that just got hidden can't stay selected
    const sel = this.state.selected;
    const hiddenBy = { wall: 'walls', opening: 'openings', room: 'rooms', furniture: 'furniture' } as const;
    if (sel && !layers[hiddenBy[sel.kind]]) this.setState({ ...this.state, selected: undefined });
    this.draw();
  }

  draw(): void {
    const { ctx } = this;
    const { x: w, y: h } = this.size;
    const p = this.drag?.preview ?? this.store.project;
    const L = this.layers;
    ctx.fillStyle = this.c.bg;
    ctx.fillRect(0, 0, w, h);
    this.drawGrid();
    if (L.rooms) for (const r of p.rooms) this.drawRoom(r, this.isSelected('room', r.id));
    if (L.furniture) for (const f of drawOrder(p.furniture)) if (!hangsFromCeiling(f.kind)) this.drawFurniture(f, false);
    if (L.walls) this.drawWalls(p);
    if (L.openings && L.walls) {
      for (const o of p.openings) {
        const wall = p.walls.find((x) => x.id === o.wallId);
        if (wall) this.drawOpening(wall, o, this.isSelected('opening', o.id));
      }
    }
    // overhead pieces and the selection go on top, so walls never hide them
    if (L.furniture) for (const f of p.furniture) if (hangsFromCeiling(f.kind)) this.drawFurniture(f, false);
    const picked = p.furniture.find((f) => this.isSelected('furniture', f.id));
    if (picked && L.furniture) this.drawFurniture(picked, true);
    if (L.rooms) for (const r of p.rooms) this.drawRoomLabel(r.name, r.points);
    if (L.dimensions) for (const d of dimensionsFor(p)) this.drawDimension(d);
    if (L.schedule) this.drawSchedule(p);
    this.drawCompass();
    this.drawDraft(p);
  }

  private isSelected(kind: string, id: string): boolean {
    return this.state.selected?.kind === kind && this.state.selected.id === id;
  }

  private drawGrid(): void {
    const { ctx } = this;
    const tl = this.toWorld({ x: 0, y: 0 });
    const br = this.toWorld(this.size);
    const steps: [number, string][] = this.zoom > 30 ? [[0.1, this.c.gridMinor], [1, this.c.gridMajor]] : [[1, this.c.gridMajor]];
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

  private line(a: Vec2, b: Vec2): void {
    const s1 = this.toScreen(a);
    const s2 = this.toScreen(b);
    this.ctx.moveTo(s1.x, s1.y);
    this.ctx.lineTo(s2.x, s2.y);
  }

  private drawRoom(room: Room, selected: boolean): void {
    this.polygonPath(room.points);
    if (this.theme === 'paper') {
      this.ctx.fillStyle = FLOOR_MATERIALS[room.floor].color;
      this.ctx.globalAlpha = 0.55;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }
    if (selected) {
      this.ctx.fillStyle = this.c.selectedFill;
      this.ctx.fill();
      this.ctx.strokeStyle = this.c.selected;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }

  private drawFurniture(f: Furniture, selected: boolean, ghost = false): void {
    const { ctx } = this;
    const corners = footprint(f);
    const sym = furnitureSymbol(f.kind);
    const r = (f.rotation * Math.PI) / 180;
    const [cos, sin] = [Math.cos(r), Math.sin(r)];
    const place = (v: Vec2): Vec2 => ({ x: f.x + v.x * cos - v.y * sin, y: f.y + v.x * sin + v.y * cos });

    // a faint fill keeps furniture readable over the grid and floor
    if (!sym.dashed) {
      this.polygonPath(corners);
      ctx.fillStyle = ghost ? this.c.draftFill : this.c.furnitureFill;
      ctx.fill();
    }
    ctx.strokeStyle = ghost ? this.c.draft : selected ? this.c.selected : this.c.furniture;
    ctx.lineWidth = selected ? 2 : 1;
    // ceiling pieces follow the drafting convention for things overhead: dashed
    if (sym.dashed) ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (const [a, b] of sym.lines) this.line(place(a), place(b));
    for (const c of sym.circles) {
      const s = this.toScreen(place(c.c));
      ctx.moveTo(s.x + c.r * this.zoom, s.y);
      ctx.arc(s.x, s.y, c.r * this.zoom, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.theme !== 'paper') return;
    const { w, d } = FURNITURE[f.kind].size;
    const flat = f.rotation % 180 === 90 ? d : w; // on-screen width of the piece
    if (Math.min(w, d) * this.zoom < 28) return;
    const c = this.toScreen(f);
    ctx.fillStyle = this.c.text;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    // only label pieces wide enough to hold their name
    const label = FURNITURE[f.kind].label;
    if (ctx.measureText(label).width > flat * this.zoom - 6) return;
    ctx.fillText(label, c.x, c.y + 3);
  }

  private drawRoomLabel(name: string, points: Vec2[]): void {
    const c = scale(points.reduce(add, { x: 0, y: 0 }), 1 / points.length);
    const s = this.toScreen(c);
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.fillStyle = this.c.roomLabel;
    const cad = this.theme === 'cad';
    ctx.font = cad ? `500 13px ${CAD_FONT}` : '600 13px system-ui, sans-serif';
    ctx.fillText(cad ? name.toUpperCase() : name, s.x, s.y - 2);
    ctx.font = cad ? `11px ${CAD_FONT}` : '12px system-ui, sans-serif';
    ctx.fillText(`${polygonArea(points).toFixed(2)} m²`, s.x, s.y + 14);
  }

  private wallCorners(a: Vec2, b: Vec2, thickness: number): Vec2[] {
    const dir = normalize(sub(b, a));
    const n = scale({ x: -dir.y, y: dir.x }, thickness / 2);
    return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
  }

  private wallOutline(wall: Wall): Vec2[] {
    // extend by half the thickness so corners meet without a notch
    const ext = scale(normalize(sub(wall.b, wall.a)), wall.thickness / 2);
    return this.wallCorners(sub(wall.a, ext), add(wall.b, ext), wall.thickness);
  }

  /** Diagonal ANSI31-style hatch, as a repeating canvas pattern. */
  private hatchPattern(): CanvasPattern | string {
    if (this.hatch) return this.hatch;
    const tile = document.createElement('canvas');
    tile.width = tile.height = 8;
    const t = tile.getContext('2d')!;
    t.fillStyle = this.c.wallFill;
    t.fillRect(0, 0, 8, 8);
    t.strokeStyle = this.c.hatch;
    t.lineWidth = 1;
    t.beginPath();
    t.moveTo(0, 8);
    t.lineTo(8, 0);
    t.moveTo(-2, 2);
    t.lineTo(2, -2);
    t.moveTo(6, 10);
    t.lineTo(10, 6);
    t.stroke();
    this.hatch = this.ctx.createPattern(tile, 'repeat') ?? this.c.wallFill;
    return this.hatch;
  }

  private drawWalls(p: Project): void {
    const { ctx } = this;
    // outlines first, thick, then every fill on top: where walls meet, the fill of one
    // wall covers the other's seam, so only the outer edge of the whole wall stays drawn
    ctx.lineWidth = 2.5;
    for (const wall of p.walls) {
      this.polygonPath(this.wallOutline(wall));
      ctx.strokeStyle = this.isSelected('wall', wall.id) ? this.c.selected : this.c.wall;
      ctx.stroke();
    }
    const fill = this.layers.hatch ? this.hatchPattern() : this.c.wallFill;
    for (const wall of p.walls) {
      this.polygonPath(this.wallOutline(wall));
      ctx.fillStyle = fill;
      ctx.fill();
      if (this.isSelected('wall', wall.id)) {
        ctx.fillStyle = this.c.selectedFill;
        ctx.fill();
      }
    }
  }

  private drawOpening(wall: Wall, o: Opening, selected: boolean): void {
    const { ctx } = this;
    const dir = normalize(sub(wall.b, wall.a));
    const n = scale({ x: -dir.y, y: dir.x }, wall.thickness / 2);
    const start = add(wall.a, scale(dir, o.offset - o.width / 2));
    const end = add(wall.a, scale(dir, o.offset + o.width / 2));
    // clear the wall where the opening is, then draw the jambs
    // the wall outline sticks out ~1.25 px past each face: clear a little more than that
    this.polygonPath(this.wallCorners(start, end, wall.thickness + 4 / this.zoom));
    ctx.fillStyle = this.c.bg;
    ctx.fill();
    ctx.strokeStyle = this.c.wall;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.line(add(start, n), sub(start, n));
    this.line(add(end, n), sub(end, n));
    ctx.stroke();

    ctx.strokeStyle = selected ? this.c.selected : o.type === 'door' ? this.c.door : this.c.window;
    ctx.lineWidth = selected ? 2.5 : 1.2;
    ctx.beginPath();
    if (o.type === 'window') {
      // three parallel lines: both wall faces and the glass
      this.line(add(start, n), add(end, n));
      this.line(start, end);
      this.line(sub(start, n), sub(end, n));
    } else {
      // door leaf + swing arc
      const hinge = this.toScreen(start);
      const leafEnd = this.toScreen(add(start, scale({ x: -dir.y, y: dir.x }, o.width)));
      const r = o.width * this.zoom;
      const base = Math.atan2(dir.y, dir.x);
      ctx.moveTo(hinge.x, hinge.y);
      ctx.lineTo(leafEnd.x, leafEnd.y);
      ctx.moveTo(hinge.x + Math.cos(base) * r, hinge.y + Math.sin(base) * r);
      ctx.arc(hinge.x, hinge.y, r, base, base + Math.PI / 2);
    }
    ctx.stroke();
  }

  private drawDimension(d: Dimension): void {
    if (this.zoom < 15) return;
    const { ctx } = this;
    ctx.strokeStyle = this.c.dim;
    ctx.fillStyle = this.c.dim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.line(d.a, d.b);
    // extension lines from just off the wall to a little past the dimension line
    const past = scale(d.normal, 0.15);
    const gap = scale(d.normal, 0.2);
    this.line(add(d.from, gap), add(d.a, past));
    this.line(add(d.to, gap), add(d.b, past));
    // architectural ticks at both ends
    const dir = normalize(sub(d.b, d.a));
    const tick = scale(add(dir, d.normal), 0.08 / Math.SQRT2);
    for (const end of [d.a, d.b]) this.line(sub(end, tick), add(end, tick));
    ctx.stroke();

    const mid = this.toScreen(scale(add(d.a, d.b), 0.5));
    // keep text upright; vertical dimensions read from the bottom up, as on drawings
    let angle = Math.atan2(dir.y, dir.x);
    if (angle >= Math.PI / 2 - 1e-6) angle -= Math.PI;
    else if (angle < -Math.PI / 2 - 1e-6) angle += Math.PI;
    ctx.save();
    ctx.translate(mid.x + d.normal.x * 8, mid.y + d.normal.y * 8);
    ctx.rotate(angle);
    ctx.font = `11px ${CAD_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.text, 0, 0);
    ctx.restore();
  }

  private drawSchedule(p: Project): void {
    const s = roomSchedule(p);
    if (!s.rows.length) return;
    const at = this.scheduleAt(p);
    const { ctx } = this;
    const rowH = SCHEDULE_ROW;
    const colW = [SCHEDULE_WIDTH - 70, 70];
    const width = colW[0] + colW[1];
    const rows = [...s.rows.map((r) => [r.name, `${r.area.toFixed(1)} m²`]), ['Total', `${s.total.toFixed(1)} m²`]];
    const height = rowH * (rows.length + 2);
    ctx.strokeStyle = this.c.schedule;
    ctx.fillStyle = this.c.schedule;
    ctx.lineWidth = 1;
    ctx.strokeRect(at.x + 0.5, at.y + 0.5, width, height);
    ctx.beginPath();
    for (let i = 1; i < rows.length + 2; i++) {
      ctx.moveTo(at.x, at.y + rowH * i + 0.5);
      ctx.lineTo(at.x + width, at.y + rowH * i + 0.5);
    }
    ctx.moveTo(at.x + colW[0] + 0.5, at.y + rowH);
    ctx.lineTo(at.x + colW[0] + 0.5, at.y + height);
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = `600 12px ${CAD_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('JADWAL RUANGAN', at.x + width / 2, at.y + rowH / 2);
    ctx.font = `11px ${CAD_FONT}`;
    ctx.fillText('Ruangan', at.x + colW[0] / 2, at.y + rowH * 1.5);
    ctx.fillText('Luas', at.x + colW[0] + colW[1] / 2, at.y + rowH * 1.5);
    rows.forEach(([name, area], i) => {
      const y = at.y + rowH * (i + 2.5);
      ctx.textAlign = 'left';
      ctx.fillText(name.length > 16 ? name.slice(0, 15) + '…' : name, at.x + 6, y);
      ctx.textAlign = 'right';
      ctx.fillText(area, at.x + width - 6, y);
    });
    ctx.textBaseline = 'alphabetic';
  }

  /** Narrow panes get the room table under the drawing instead of beside it. */
  private get scheduleBelow(): boolean {
    return this.size.x < 700;
  }

  private scheduleHeight(p: Project): number {
    return SCHEDULE_ROW * (p.rooms.length + 3);
  }

  /** Top-left corner of the room table on screen, just outside the drawing and its dimensions. */
  private scheduleAt(p: Project): Vec2 {
    const xs = p.walls.flatMap((w) => [w.a.x, w.b.x]).concat(p.rooms.flatMap((r) => r.points.map((q) => q.x)));
    const ys = p.walls.flatMap((w) => [w.a.y, w.b.y]).concat(p.rooms.flatMap((r) => r.points.map((q) => q.y)));
    const pad = this.drawingPad(p);
    if (this.scheduleBelow) return add(this.toScreen({ x: Math.min(...xs) - pad, y: Math.max(...ys) + pad }), { x: 0, y: 12 });
    return add(this.toScreen({ x: Math.max(...xs) + pad, y: Math.min(...ys) - pad }), { x: 12, y: 0 });
  }

  /** Room left around the drawing for dimension lines. */
  private drawingPad(p: Project): number {
    return this.layers.dimensions && p.walls.length ? 1.2 : 0.3;
  }

  private drawCompass(): void {
    const { ctx } = this;
    const r = 26;
    const c = { x: this.size.x - r - 18, y: r + 18 };
    ctx.strokeStyle = this.c.compass;
    ctx.fillStyle = this.c.compass;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - r + 6);
    ctx.lineTo(c.x + 5, c.y);
    ctx.lineTo(c.x - 5, c.y);
    ctx.closePath();
    ctx.fill();
    ctx.font = `600 10px ${CAD_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('U', c.x, c.y - r - 8);
    ctx.fillText('S', c.x, c.y + r + 8);
    ctx.fillText('T', c.x + r + 8, c.y);
    ctx.fillText('B', c.x - r - 8, c.y);
    ctx.textBaseline = 'alphabetic';
  }

  private drawLength(a: Vec2, b: Vec2): void {
    if (this.zoom < 25) return;
    const mid = this.toScreen(scale(add(a, b), 0.5));
    const dir = normalize(sub(b, a));
    const n = { x: -dir.y, y: dir.x };
    const { ctx } = this;
    ctx.fillStyle = this.c.draft;
    ctx.font = `11px ${CAD_FONT}`;
    ctx.textAlign = n.x > 0.5 ? 'left' : n.x < -0.5 ? 'right' : 'center';
    const gap = 12;
    const baseline = n.y > 0.5 ? 10 : n.y < -0.5 ? -2 : 4;
    ctx.fillText(`${Math.round(dist(a, b) * 1000)} mm`, mid.x + n.x * gap, mid.y + n.y * gap + baseline);
  }

  private drawCorners(p: Project): void {
    const { ctx } = this;
    const seen = new Set<string>();
    ctx.fillStyle = this.c.bg;
    ctx.strokeStyle = this.c.selected;
    ctx.lineWidth = 1.5;
    for (const w of p.walls) {
      for (const end of [w.a, w.b]) {
        const key = `${end.x.toFixed(3)},${end.y.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const s = this.toScreen(end);
        // square grips, as CAD programs draw them
        ctx.beginPath();
        ctx.rect(s.x - 4, s.y - 4, 8, 8);
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
      this.drawFurniture({ id: '', kind, x: this.hover.x, y: this.hover.y, rotation: 0, color: '' }, false, true);
    }
    const hover = this.snappedHover();
    const { tool, draft } = this.state;

    if ((tool === 'door' || tool === 'window') && this.hover) {
      const wall = nearestWall(p, this.hover);
      if (wall) {
        this.polygonPath(this.wallCorners(wall.a, wall.b, wall.thickness + 0.06));
        ctx.strokeStyle = this.c.draft;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    if (tool !== 'wall' && tool !== 'room') return;
    const pts = hover ? [...draft, hover] : draft;
    if (pts.length > 1) {
      ctx.strokeStyle = this.c.draft;
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
      // crosshair cursor, CAD style
      const s = this.toScreen(hover);
      ctx.strokeStyle = this.c.draft;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - 10, s.y);
      ctx.lineTo(s.x + 10, s.y);
      ctx.moveTo(s.x, s.y - 10);
      ctx.lineTo(s.x, s.y + 10);
      ctx.rect(s.x - 3, s.y - 3, 6, 6);
      ctx.stroke();
    }
  }
}

export function isTextField(t: EventTarget | null): boolean {
  return (
    (t instanceof HTMLInputElement && t.type !== 'checkbox' && t.type !== 'radio') ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.closest('dialog') !== null)
  );
}

export function formatLength(m: number): string {
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`;
}
