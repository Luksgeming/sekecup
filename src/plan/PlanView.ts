import type { Store } from '../model/store';
import type { Opening, Project, Vec2, Wall } from '../model/types';
import { polygonArea } from '../geometry/polygon';
import { snapPoint } from '../geometry/snap';
import { add, dist, normalize, scale, sub } from '../geometry/vec';
import { addRoom } from '../model/project';
import { askText } from '../ui/dialog';
import { parseLength } from '../geometry/length';
import { handleClick, handleKey, handleLengthInput, initialToolState, nearestWall, reconcile, type ToolName, type ToolResult, type ToolState } from './tools';

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
  private panning?: { start: Vec2; center: Vec2 };
  private spaceDown = false;
  private lengthInput?: HTMLInputElement;
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
    this.setState({ ...this.state, tool, draft: [], selected: undefined });
  }

  /** Runs a key through the active tool; returns true when it was handled. */
  key(key: string): boolean {
    if (!['Escape', 'Enter', 'Delete', 'Backspace'].includes(key)) return false;
    this.applyResult(handleKey(this.state, this.store.project, key));
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
      this.applyResult(handleClick(this.state, this.store.project, world, { shift: e.shiftKey }));
    });

    c.addEventListener('pointermove', (e) => {
      const s = this.eventPoint(e);
      if (this.panning) {
        this.center = sub(this.panning.center, scale(sub(s, this.panning.start), 1 / this.zoom));
      }
      this.shiftDown = e.shiftKey;
      this.hover = this.toWorld(s);
      this.draw();
    });

    c.addEventListener('pointerup', () => (this.panning = undefined));
    c.addEventListener('pointerleave', () => {
      this.hover = undefined;
      this.draw();
    });

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const s = this.eventPoint(e);
        const before = this.toWorld(s);
        this.zoom = Math.min(400, Math.max(10, this.zoom * Math.exp(-e.deltaY * 0.0015)));
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

  private snappedHover(): Vec2 | undefined {
    if (!this.hover) return undefined;
    if (this.state.tool !== 'wall' && this.state.tool !== 'room') return this.hover;
    return snapPoint(this.hover, { walls: this.store.project.walls, from: this.state.draft.at(-1), ortho: this.shiftDown });
  }

  draw(): void {
    const { ctx } = this;
    const { x: w, y: h } = this.size;
    const p = this.store.project;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    this.drawGrid();
    for (const r of p.rooms) this.drawRoom(r.points, this.isSelected('room', r.id));
    for (const wall of p.walls) this.drawWall(wall, this.isSelected('wall', wall.id));
    for (const o of p.openings) {
      const wall = p.walls.find((x) => x.id === o.wallId);
      if (wall) this.drawOpening(wall, o, this.isSelected('opening', o.id));
    }
    for (const r of p.rooms) this.drawRoomLabel(r.name, r.points);
    for (const wall of p.walls) this.drawLength(wall.a, wall.b);
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

  private drawRoom(points: Vec2[], selected: boolean): void {
    this.polygonPath(points);
    this.ctx.fillStyle = selected ? 'rgba(37, 99, 235, 0.15)' : COLORS.room;
    this.ctx.fill();
    if (selected) {
      this.ctx.strokeStyle = COLORS.selected;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
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

  private drawLength(a: Vec2, b: Vec2): void {
    if (this.zoom < 25) return;
    const mid = this.toScreen(scale(add(a, b), 0.5));
    const dir = normalize(sub(b, a));
    const n = { x: -dir.y, y: dir.x };
    const { ctx } = this;
    ctx.fillStyle = COLORS.label;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatLength(dist(a, b)), mid.x + n.x * 16, mid.y + n.y * 16 + 4);
  }

  private drawDraft(p: Project): void {
    const { ctx } = this;
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

export function isTextField(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.closest('dialog') !== null);
}

export function formatLength(m: number): string {
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`;
}
