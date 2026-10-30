import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Store } from '../model/store';
import { buildMeshes, disposeGroup } from './buildMeshes';

export class View3D {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private house: THREE.Group;
  private frame = 0;
  // keep re-framing the house until the user moves the camera themselves
  private autoFit = true;
  private unsubscribe: () => void;
  private resizeObserver: ResizeObserver;
  private container: HTMLElement;
  readonly scene = new THREE.Scene();

  constructor(container: HTMLElement, store: Store) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.append(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xe9eef2);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    this.camera.position.set(-6, 10, 14);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(4, 0, 3);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.enableDamping = true;
    this.controls.addEventListener('change', () => this.requestRender());
    this.controls.addEventListener('start', () => (this.autoFit = false));

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9ad94, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-10, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 });
    this.scene.add(sun);

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

    this.house = buildMeshes(store.project);
    this.scene.add(this.house);
    this.fit();

    this.unsubscribe = store.subscribe((p) => {
      this.scene.remove(this.house);
      disposeGroup(this.house);
      this.house = buildMeshes(p);
      this.scene.add(this.house);
      if (this.autoFit) this.fit();
      this.requestRender();
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  get house3d(): THREE.Group {
    return this.house;
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Points the camera at the whole house. */
  fit(): void {
    this.autoFit = true;
    const box = new THREE.Box3().setFromObject(this.house);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 2);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(-0.5, 0.8, 1).normalize().multiplyScalar(distance));
    this.controls.update();
    this.requestRender();
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
