import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { moveFurniture } from '../model/project';
import type { Store } from '../model/store';
import type { Room, Vec2 } from '../model/types';
import { buildMeshes, disposeGroup } from './buildMeshes';
import { floorPoint } from './floorPoint';
import { pointInPolygon } from '../geometry/polygon';
import { isModelReady, loadModels, onModelLoaded } from '../interior/models';

const LOW_WALL_HEIGHT = 1.2;
const EYE_HEIGHT = 1.6;
const OUTSIDE_HINT = 'Seret: putar · Shift atau klik kanan + seret: geser · Scroll: zoom · Seret furnitur untuk memindah';
const DRAG_THRESHOLD_PX = 4;
const FURNITURE_GRID = 0.05;

export type View3DHooks = {
  /** The room to stand in for the inside view: the selected one, or the first. */
  currentRoom: () => Room | undefined;
  message: (msg: string) => void;
  /** A plain click on the floor: the active plan tool handles it (select, place furniture…). */
  clickFloor: (at: Vec2, shift: boolean) => void;
  /** A click on a piece of furniture. */
  selectFurniture: (id: string) => void;
  /** True while a catalog item waits to be placed; clicks then always go to the floor. */
  isPlacing: () => boolean;
};

export class View3D {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private house: THREE.Group;
  private sun: THREE.DirectionalLight;
  private frame = 0;
  // keep re-framing the house until the user moves the camera themselves
  private autoFit = true;
  private lowWalls = true;
  private selectedId?: string;
  private highlight?: THREE.BoxHelper;
  // planeY: the height the grabbed piece is dragged at (0 for the floor, higher for hanging lamps)
  private press?: { pointerId: number; x: number; y: number; shift: boolean; itemId?: string; grab?: Vec2; planeY: number; moved: boolean };
  private bar: HTMLElement;
  private hint: HTMLElement;
  private raycaster = new THREE.Raycaster();
  private unsubscribe: () => void;
  private resizeObserver: ResizeObserver;
  private container: HTMLElement;
  private store: Store;
  private wallToggle: HTMLButtonElement;
  private insideToggle: HTMLButtonElement;
  private inside = false;
  private wallsBeforeInside = true;
  readonly scene = new THREE.Scene();

  private hooks: View3DHooks;

  constructor(container: HTMLElement, store: Store, hooks: View3DHooks) {
    this.hooks = hooks;
    this.container = container;
    this.store = store;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.append(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xe9eef2);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.camera.position.set(-6, 12, 12);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(4, 0, 3);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.enableDamping = true;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => this.requestRender());
    this.controls.addEventListener('start', () => (this.autoFit = false));

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9ad94, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.aimSun(new THREE.Vector3(4, 0, 3), 25);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xdfe3d6, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(200, 200, 0xc9ccbf, 0xd4d7cb);
    grid.position.y = 0.001;
    this.scene.add(grid);

    this.house = this.build();
    this.scene.add(this.house);
    this.fit();

    const offStore = store.subscribe(() => this.rebuild());
    // a furniture model finishing its download replaces its placeholder box
    const offModels = onModelLoaded(() => this.rebuild());
    this.unsubscribe = () => {
      offStore();
      offModels();
    };

    // on-canvas controls: wall height toggle and a short how-to
    const bar = (this.bar = document.createElement('div'));
    bar.className = 'view3d-bar';
    this.wallToggle = document.createElement('button');
    this.wallToggle.type = 'button';
    this.wallToggle.addEventListener('click', () => {
      if (this.inside) this.lookOutside();
      else this.setLowWalls(!this.lowWalls);
    });
    this.insideToggle = document.createElement('button');
    this.insideToggle.type = 'button';
    this.insideToggle.textContent = 'Lihat dari dalam';
    this.insideToggle.addEventListener('click', () => (this.inside ? this.lookOutside() : this.lookInside()));
    bar.append(this.wallToggle, this.insideToggle);
    const hint = (this.hint = document.createElement('p'));
    hint.className = 'view3d-hint';
    hint.textContent = OUTSIDE_HINT;
    container.append(bar, hint);
    this.setLowWalls(true);

    this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /**
   * The house with full-height walls and every furniture model loaded, for exporting.
   * `missing` counts pieces whose model could not load and went out as plain boxes.
   */
  async exportModel(): Promise<{ group: THREE.Group; missing: number }> {
    const kinds = this.store.project.furniture.map((f) => f.kind);
    await loadModels(kinds);
    return { group: buildMeshes(this.store.project), missing: kinds.filter((k) => !isModelReady(k)).length };
  }

  setLowWalls(low: boolean): void {
    this.lowWalls = low;
    this.wallToggle.textContent = low ? 'Dinding: rendah' : 'Dinding: penuh';
    this.wallToggle.title = low ? 'Tampilkan dinding setinggi aslinya' : 'Potong dinding agar isi rumah terlihat';
    this.wallToggle.setAttribute('aria-pressed', String(low));
    this.rebuild();
  }

  /** Stands at eye height in the middle of a room, with full walls and the ceiling shown. */
  lookInside(): void {
    const room = this.hooks.currentRoom();
    if (!room) {
      this.hooks.message('Buat ruangan dulu (alat Ruangan) untuk melihat dari dalam.');
      return;
    }
    const c = insidePoint(room.points);
    const xs = room.points.map((p) => p.x);
    const ys = room.points.map((p) => p.y);
    const maxY = Math.max(...ys);
    const halfDiagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), maxY - Math.min(...ys)) / 2;
    if (!this.inside) this.wallsBeforeInside = this.lowWalls;
    this.inside = true;
    this.autoFit = false;
    this.setLowWalls(false);
    // stand near one side at eye height and look across the room, so walls, ceiling and lamps all show
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(c.x, EYE_HEIGHT, c.y + (maxY - c.y) * 0.8);
    this.controls.target.set(c.x, 1.2, c.y);
    this.controls.minDistance = 0.3;
    // stay inside the room: no further back than its half-diagonal, never below the floor
    this.controls.maxDistance = Math.max(halfDiagonal, 1);
    this.controls.maxPolarAngle = Math.PI * 0.8;
    this.insideToggle.textContent = 'Lihat dari luar';
    this.hint.textContent = 'Seret: berputar di dalam ruangan · Scroll: maju/mundur · Klik lantai untuk menaruh furnitur';
    this.controls.update();
    this.requestRender();
  }

  lookOutside(): void {
    this.leaveInside();
    this.fit();
  }

  /** Puts the outside-view camera settings back; fit() calls it too, so no button leaves them behind. */
  private leaveInside(): void {
    if (!this.inside) return;
    this.inside = false;
    this.camera.fov = 45;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.insideToggle.textContent = 'Lihat dari dalam';
    this.hint.textContent = OUTSIDE_HINT;
    this.setLowWalls(this.wallsBeforeInside);
  }

  get wallsAreLow(): boolean {
    return this.lowWalls;
  }

  /** Highlights the selected furniture, or nothing. */
  setSelection(furnitureId: string | undefined): void {
    if (furnitureId === this.selectedId) return;
    this.selectedId = furnitureId;
    this.updateHighlight();
    this.requestRender();
  }

  /** Points the camera at the whole house. */
  fit(): void {
    this.leaveInside();
    this.autoFit = true;
    const box = new THREE.Box3().setFromObject(this.house);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 2);
    this.aimSun(center, radius);
    const distance = (radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 0.95;
    this.controls.target.copy(center);
    // high enough to look into the rooms over the cut walls
    this.camera.position.copy(center).add(new THREE.Vector3(-0.35, 1.25, 0.85).normalize().multiplyScalar(distance));
    this.controls.update();
    this.requestRender();
  }

  private build(): THREE.Group {
    return buildMeshes(this.store.project, { wallCut: this.lowWalls ? LOW_WALL_HEIGHT : Infinity });
  }

  private rebuild(): void {
    if (!this.house) return;
    this.scene.remove(this.house);
    disposeGroup(this.house);
    this.house = this.build();
    this.scene.add(this.house);
    this.updateHighlight();
    if (this.autoFit) this.fit();
    this.requestRender();
  }

  private furnitureObject(id: string | undefined): THREE.Object3D | undefined {
    return id ? this.house.children.find((c) => c.userData.kind === 'furniture' && c.userData.id === id) : undefined;
  }

  private updateHighlight(): void {
    if (this.highlight) {
      this.scene.remove(this.highlight);
      this.highlight.dispose();
      this.highlight = undefined;
    }
    const obj = this.furnitureObject(this.selectedId);
    if (!obj) return;
    this.highlight = new THREE.BoxHelper(obj, 0x2563eb);
    this.scene.add(this.highlight);
  }

  private ray(e: PointerEvent): THREE.Raycaster {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster;
  }

  private floorAt(e: PointerEvent, height = 0): Vec2 | undefined {
    const { origin, direction } = this.ray(e).ray;
    return floorPoint(origin, direction, height);
  }

  /** The piece under the pointer and the height it was hit at. */
  private furnitureHit(e: PointerEvent): { id: string; height: number } | undefined {
    for (const hit of this.ray(e).intersectObjects(this.house.children, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o.userData.kind !== 'furniture') o = o.parent;
      if (o) return { id: o.userData.id as string, height: hit.point.y };
      // a wall or floor in front of the furniture hides it
      if (hit.object.userData.kind === 'wall') return undefined;
    }
    return undefined;
  }

  private bindPointer(): void {
    const el = this.renderer.domElement;
    // capture phase on the container runs before OrbitControls, so a furniture drag can switch orbiting off first
    this.container.addEventListener(
      'pointerdown',
      (e) => {
        if (e.target !== el) return;
        // working in the 3D view counts as moving the camera: stop re-framing it on every edit
        this.autoFit = false;
        if (this.press && e.pointerId !== this.press.pointerId) {
          // a second finger: let OrbitControls pinch or rotate, and put a dragged piece back
          const wasDragging = this.press.itemId !== undefined;
          this.press = undefined;
          this.controls.enabled = true;
          if (wasDragging) this.rebuild();
          return;
        }
        if (e.button !== 0) return;
        const hit = e.shiftKey || this.hooks.isPlacing() ? undefined : this.furnitureHit(e);
        const item = hit ? this.store.project.furniture.find((f) => f.id === hit.id) : undefined;
        this.press = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, shift: e.shiftKey, planeY: 0, moved: false };
        if (item && hit) {
          // drag on the plane where the piece was grabbed, so a lamp follows the cursor at ceiling height
          const at = this.floorAt(e, hit.height);
          this.press.itemId = item.id;
          this.press.planeY = hit.height;
          this.press.grab = at ? { x: at.x - item.x, y: at.y - item.y } : { x: 0, y: 0 };
          this.controls.enabled = false;
          el.setPointerCapture(e.pointerId);
        }
      },
      { capture: true },
    );

    el.addEventListener('pointermove', (e) => {
      const p = this.press;
      if (!p || e.pointerId !== p.pointerId) return;
      if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_THRESHOLD_PX) p.moved = true;
      if (!p.moved || !p.itemId) return;
      const at = this.floorAt(e, p.planeY);
      const obj = this.furnitureObject(p.itemId);
      if (!at || !obj) return;
      obj.position.x = snap(at.x - p.grab!.x);
      obj.position.z = snap(at.y - p.grab!.y);
      this.highlight?.update();
      this.requestRender();
    });

    const end = (e: PointerEvent, cancelled: boolean) => {
      const p = this.press;
      if (!p || e.pointerId !== p.pointerId) return;
      this.press = undefined;
      this.controls.enabled = true;
      if (cancelled) {
        if (p.itemId) this.rebuild();
        return;
      }
      if (p.itemId && p.moved) {
        const obj = this.furnitureObject(p.itemId);
        if (obj) this.store.apply(moveFurniture(this.store.project, p.itemId, { x: obj.position.x, y: obj.position.z }));
        this.hooks.selectFurniture(p.itemId);
        return;
      }
      if (p.moved) return; // that was an orbit or pan
      if (p.itemId) {
        this.hooks.selectFurniture(p.itemId);
        return;
      }
      // a click on a wall would otherwise land on the floor behind it
      const first = this.ray(e).intersectObjects(this.house.children, true)[0];
      if (first?.object.userData.kind === 'wall') return;
      const at = this.floorAt(e);
      if (at) this.hooks.clickFloor(at, p.shift);
    };
    el.addEventListener('pointerup', (e) => end(e, false));
    el.addEventListener('pointercancel', (e) => end(e, true));
  }

  /** Keeps the shadow area just big enough for the house, so big plots still get shadows. */
  private aimSun(center: THREE.Vector3, radius: number): void {
    const r = radius + 4;
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).add(new THREE.Vector3(-0.45, 0.8, 0.35).normalize().multiplyScalar(r * 2));
    Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: r * 4 });
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      // damping keeps moving after the pointer stops; update() emits 'change' until it settles
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  dispose(): void {
    this.unsubscribe();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    disposeGroup(this.house);
    this.highlight?.dispose();
    this.bar.remove();
    this.hint.remove();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** A point inside the room to stand at: the corner average when it falls inside, otherwise the middle of the first corner triangle. */
function insidePoint(points: Vec2[]): Vec2 {
  const avg = points.reduce((s, p) => ({ x: s.x + p.x / points.length, y: s.y + p.y / points.length }), { x: 0, y: 0 });
  if (pointInPolygon(avg, points)) return avg;
  const [a, b, c] = points;
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

const snap = (v: number) => +(Math.round(v / FURNITURE_GRID) * FURNITURE_GRID).toFixed(3);
