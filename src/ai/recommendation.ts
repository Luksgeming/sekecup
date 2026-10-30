import type { FloorMaterial, FurnitureKind } from '../interior/kinds';

export type Recommendation = {
  style: string;
  summary: string;
  /** 3–6 colors; the first is meant for the walls. */
  palette: string[];
  floor: FloorMaterial;
  furniture: FurnitureKind[];
  tips: string[];
  source: 'offline' | 'ai';
};
