import type { FloorMaterial, FurnitureKind } from '../interior/kinds';

export type Recommendation = {
  style: string;
  summary: string;
  /** Up to 6 colors; the first is meant for the walls. May be empty if the AI gave none we can use. */
  palette: string[];
  /** Missing when the AI suggested a floor the app doesn't have. */
  floor?: FloorMaterial;
  furniture: FurnitureKind[];
  tips: string[];
  source: 'offline' | 'ai';
};
