import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { moveFurniture } from '../model/project';
import type { Store } from '../model/store';
import type { Vec2 } from '../model/types';
import { buildMeshes, disposeGroup } from './buildMeshes';
import { floorPoint } from './floorPoint';
import { loadModels, onModelLoaded } from '../interior/models';

const LOW_WALL_HEIGHT = 1.2;
const DRAG_THRESHOLD_PX = 4;
const FURNITURE_GRID = 0.05;

export type View3DHooks = {
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
  private press?: { x: number; y: number; shift: boolean; itemId?: string; grab?: Vec2; moved: boolean };
  private raycaster = new THREE.Raycaster();
  private unsubscribe: () => void;
  private resizeObserver: ResizeObserver;
  private container: HTMLElement;
  private store: Store;
  private wallToggle: HTMLButtonElement;
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
    const bar = document.createElement('div');
    bar.className = 'view3d-bar';
    this.wallToggle = document.createElement('button');
    this.wallToggle.type = 'button';
    this.wallToggle.addEventListener('click', () => this.setLowWalls(!this.lowWalls));
    bar.append(this.wallToggle);
    const hint = document.createElement('p');
    hint.className = 'view3d-hint';
    hint.textContent = 'Seret: putar · Shift atau klik kanan + seret: geser · Scroll: zoom · Seret furnitur untuk memindah';
    container.append(bar, hint);
    this.setLowWalls(true);

    this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** The house with full-height walls and every furniture model loaded, for exporting. */
  async exportModel(): Promise<THREE.Group> {
    await loadModels(this.store.project.furniture.map((f) => f.kind));
    return buildMeshes(this.store.project);
  }

  setLowWalls(low: boolean): void {
    this.lowWalls = low;
    this.wallToggle.textContent = low ? 'Dinding: rendah' : 'Dinding: penuh';
    this.wallToggle.title = low ? 'Tampilkan dinding setinggi aslinya' : 'Potong dinding agar isi rumah terlihat';
    this.wallToggle.setAttribute('aria-pressed', String(low));
    this.rebuild();
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

  private floorAt(e: PointerEvent): Vec2 | undefined {
    const { origin, direction } = this.ray(e).ray;
    return floorPoint(origin, direction);
  }

  private furnitureHit(e: PointerEvent): string | undefined {
    for (const hit of this.ray(e).intersectObjects(this.house.children, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o.userData.kind !== 'furniture') o = o.parent;
      if (o) return o.userData.id as string;
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
        if (e.button !== 0 || e.target !== el) return;
        const itemId = e.shiftKey || this.hooks.isPlacing() ? undefined : this.furnitureHit(e);
        const item = itemId ? this.store.project.furniture.find((f) => f.id === itemId) : undefined;
        const at = this.floorAt(e);
        this.press = { x: e.clientX, y: e.clientY, shift: e.shiftKey, moved: false };
        if (item && at) {
          this.press.itemId = item.id;
          this.press.grab = { x: at.x - item.x, y: at.y - item.y };
          this.controls.enabled = false;
          el.setPointerCapture(e.pointerId);
        }
      },
      { capture: true },
    );

    el.addEventListener('pointermove', (e) => {
      const p = this.press;
      if (!p) return;
      if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_THRESHOLD_PX) p.moved = true;
      if (!p.moved || !p.itemId) return;
      const at = this.floorAt(e);
      const obj = this.furnitureObject(p.itemId);
      if (!at || !obj) return;
      obj.position.x = snap(at.x - p.grab!.x);
      obj.position.z = snap(at.y - p.grab!.y);
      this.highlight?.update();
      this.requestRender();
    });

    const end = (e: PointerEvent, cancelled: boolean) => {
      const p = this.press;
      this.press = undefined;
      this.controls.enabled = true;
      if (!p || cancelled) {
        this.rebuild();
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const snap = (v: number) => +(Math.round(v / FURNITURE_GRID) * FURNITURE_GRID).toFixed(3);
