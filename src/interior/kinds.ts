// Furniture catalog. Every piece is a realistic CC0 model from Poly Haven (see
// public/models/CREDITS.md). Sizes in meters, taken from the models themselves:
// w = width along x, d = depth along y on the plan, h = height. `rotation` turns
// the model (degrees) so its front faces +y on the plan.

export type FurnitureCategory = 'Kamar' | 'Ruang tamu' | 'Makan' | 'Kerja' | 'Tanaman';

export type FurnitureSpec = {
  label: string;
  category: FurnitureCategory;
  model: string;
  rotation: number;
  size: { w: number; d: number; h: number };
};

export const FURNITURE = {
  'kasur-double': { label: 'Kasur kayu klasik', category: 'Kamar', model: 'GothicBed_01', rotation: 0, size: { w: 1.49, d: 2.04, h: 1.53 } },
  nakas: { label: 'Nakas', category: 'Kamar', model: 'side_table_01', rotation: 0, size: { w: 0.55, d: 0.45, h: 0.55 } },
  lemari: { label: 'Lemari pajangan', category: 'Kamar', model: 'vintage_cabinet_01', rotation: 0, size: { w: 2.02, d: 0.67, h: 2.23 } },
  'lemari-laci': { label: 'Lemari laci', category: 'Kamar', model: 'drawer_cabinet', rotation: 0, size: { w: 1.14, d: 0.49, h: 1.88 } },
  'sofa-3': { label: 'Sofa klasik', category: 'Ruang tamu', model: 'Sofa_01', rotation: 0, size: { w: 1.57, d: 0.66, h: 0.8 } },
  'sofa-kulit': { label: 'Sofa kulit', category: 'Ruang tamu', model: 'sofa_02', rotation: 180, size: { w: 1.81, d: 0.82, h: 0.71 } },
  'kursi-santai': { label: 'Kursi santai', category: 'Ruang tamu', model: 'mid_century_lounge_chair', rotation: 0, size: { w: 1.01, d: 1.19, h: 1.17 } },
  'kursi-berlengan': { label: 'Kursi berlengan', category: 'Ruang tamu', model: 'modern_arm_chair_01', rotation: 0, size: { w: 0.82, d: 0.99, h: 1.02 } },
  ottoman: { label: 'Ottoman', category: 'Ruang tamu', model: 'Ottoman_01', rotation: 0, size: { w: 0.89, d: 0.62, h: 0.62 } },
  'meja-tamu': { label: 'Meja tamu', category: 'Ruang tamu', model: 'modern_coffee_table_01', rotation: 90, size: { w: 1.2, d: 0.6, h: 0.39 } },
  'meja-tamu-bundar': { label: 'Meja tamu bundar', category: 'Ruang tamu', model: 'coffee_table_round_01', rotation: 0, size: { w: 1.3, d: 1.3, h: 0.49 } },
  'rak-tv': { label: 'Rak TV', category: 'Ruang tamu', model: 'modern_wooden_cabinet', rotation: 0, size: { w: 2.44, d: 0.52, h: 0.68 } },
  'meja-makan': { label: 'Meja makan', category: 'Makan', model: 'wooden_table_02', rotation: 0, size: { w: 1.13, d: 0.71, h: 0.8 } },
  'kursi-makan': { label: 'Kursi makan', category: 'Makan', model: 'dining_chair_02', rotation: 0, size: { w: 0.43, d: 0.58, h: 0.97 } },
  'meja-kerja': { label: 'Meja kerja', category: 'Kerja', model: 'metal_office_desk', rotation: 0, size: { w: 2.0, d: 0.95, h: 0.79 } },
  'rak-buku': { label: 'Rak pajang', category: 'Kerja', model: 'wooden_display_shelves_01', rotation: -90, size: { w: 1.08, d: 0.37, h: 1.56 } },
  'rak-besi': { label: 'Rak besi', category: 'Kerja', model: 'steel_frame_shelves_01', rotation: 0, size: { w: 1.1, d: 0.5, h: 2.14 } },
  tanaman: { label: 'Tanaman tinggi', category: 'Tanaman', model: 'potted_plant_01', rotation: 0, size: { w: 0.59, d: 0.63, h: 1.34 } },
  'tanaman-daun': { label: 'Tanaman daun lebar', category: 'Tanaman', model: 'potted_plant_02', rotation: 0, size: { w: 0.7, d: 0.66, h: 0.84 } },
} satisfies Record<string, FurnitureSpec>;

/** Kinds from older versions that have no realistic model; files that use them drop those pieces. */
export const REMOVED_KINDS = new Set([
  'kasur-single', 'karpet', 'kitchen-set', 'kulkas', 'kloset', 'wastafel', 'bathtub', 'shower', 'kursi-kerja', 'lampu-lantai',
]);

export type FurnitureKind = keyof typeof FURNITURE;

export const FURNITURE_KINDS = Object.keys(FURNITURE) as FurnitureKind[];

export const isFurnitureKind = (v: unknown): v is FurnitureKind => typeof v === 'string' && Object.hasOwn(FURNITURE, v);

export const FLOOR_MATERIALS = {
  keramik: { label: 'Keramik', color: '#e7e3dc' },
  kayu: { label: 'Kayu', color: '#b98a5e' },
  marmer: { label: 'Marmer', color: '#efede9' },
  karpet: { label: 'Karpet', color: '#9a8f86' },
  beton: { label: 'Beton', color: '#a9a8a4' },
} as const;

export type FloorMaterial = keyof typeof FLOOR_MATERIALS;

export const isFloorMaterial = (v: unknown): v is FloorMaterial => typeof v === 'string' && Object.hasOwn(FLOOR_MATERIALS, v);

export const WALL_PALETTE = [
  { label: 'Putih tulang', color: '#f2efe8' },
  { label: 'Abu muda', color: '#d9d9d6' },
  { label: 'Krem', color: '#efe2c8' },
  { label: 'Sage', color: '#b7c4a8' },
  { label: 'Biru pastel', color: '#bfd3e0' },
  { label: 'Terakota', color: '#c9785a' },
  { label: 'Arang', color: '#3f3f3d' },
];

export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
