import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FURNITURE, type FurnitureKind } from './kinds';

// Realistic furniture models, loaded the first time a piece is used and kept for reuse.
// Each prepared model is turned to face +z, scaled to its catalog height and set on the
// floor, centered on its footprint, so callers only position and rotate it.

const ready = new Map<FurnitureKind, THREE.Object3D>();
const pending = new Map<FurnitureKind, Promise<void>>();
const failed = new Set<FurnitureKind>();
const listeners = new Set<() => void>();

let loader: GLTFLoader | undefined;
let environment: THREE.Texture | undefined;

/** Reflections used by furniture materials (set once by the 3D view). */
export function setFurnitureEnvironment(texture: THREE.Texture): void {
  environment = texture;
  for (const model of ready.values()) applyEnvironment(model);
}

const ENV_INTENSITY = 0.6;

function applyEnvironment(model: THREE.Object3D): void {
  if (!environment) return;
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m instanceof THREE.MeshStandardMaterial) {
        m.envMap = environment ?? null;
        m.envMapIntensity = ENV_INTENSITY;
        m.needsUpdate = true;
      }
    }
  });
}

// hosts that cannot serve .glb get self-contained glTF JSON files instead
const MODEL_EXT = import.meta.env.VITE_MODEL_EXT ?? 'glb';

const PLACEHOLDER = new THREE.MeshStandardMaterial({ color: 0xb9b2a3, transparent: true, opacity: 0.35, roughness: 1 });

function prepare(kind: FurnitureKind, scene: THREE.Object3D): THREE.Object3D {
  const spec = FURNITURE[kind];
  const turn = new THREE.Group();
  turn.add(scene);
  scene.rotation.y = (spec.rotation * Math.PI) / 180;
  turn.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn);
  const size = box.getSize(new THREE.Vector3());
  const k = spec.size.h / (size.y || 1);
  const center = box.getCenter(new THREE.Vector3());
  scene.position.set(-center.x, -box.min.y, -center.z);
  turn.scale.setScalar(k);
  applyEnvironment(turn);
  turn.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      // copies share this geometry with the cache; rebuilding a view must not dispose it
      o.userData.shared = true;
    }
  });
  return turn;
}

/** Makes a model available without loading it (tests, and models built elsewhere). */
export function registerModel(kind: FurnitureKind, scene: THREE.Object3D): void {
  ready.set(kind, prepare(kind, scene));
}

export const isModelReady = (kind: FurnitureKind) => ready.has(kind);

let onFailure: (() => void) | undefined;
/** Called once when the first model fails to load (no internet, missing file). */
export function onModelFailure(fn: () => void): void {
  onFailure = fn;
}

// a failed model is tried again on the next use, and when the connection comes back
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const retry = [...failed];
    failed.clear();
    void loadModels(retry);
  });
}

/** Starts loading a model; resolves when it is ready (or has failed). */
export function loadModel(kind: FurnitureKind): Promise<void> {
  if (ready.has(kind)) return Promise.resolve();
  failed.delete(kind);
  let p = pending.get(kind);
  if (!p) {
    loader ??= new GLTFLoader();
    p = loader
      .loadAsync(`${import.meta.env.BASE_URL}models/${FURNITURE[kind].model}.${MODEL_EXT}`)
      .then((gltf) => void ready.set(kind, prepare(kind, gltf.scene)))
      .catch(() => {
        failed.add(kind);
        onFailure?.();
        onFailure = undefined;
      })
      .finally(() => {
        pending.delete(kind);
        for (const fn of listeners) fn();
      });
    pending.set(kind, p);
  }
  return p;
}

export function loadModels(kinds: Iterable<FurnitureKind>): Promise<void> {
  return Promise.all([...new Set(kinds)].map(loadModel)).then(() => undefined);
}

/** Called whenever a model finishes loading, so views can redraw. */
export function onModelLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * A copy of the model for one piece. Until the real model has loaded (or when it
 * could not load) a see-through box of the right size stands in for it.
 */
export function furnitureObject(kind: FurnitureKind): THREE.Object3D {
  const model = ready.get(kind);
  if (model) return model.clone(true);
  if (typeof window !== 'undefined') void loadModel(kind);
  const { w, d, h } = FURNITURE[kind].size;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), PLACEHOLDER);
  box.position.y = h / 2;
  const g = new THREE.Group();
  g.add(box);
  return g;
}
