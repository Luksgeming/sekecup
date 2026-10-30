import type * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export async function exportGlb(group: THREE.Group): Promise<Blob> {
  const result = await new GLTFExporter().parseAsync(group, { binary: true });
  return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
}
