// Furniture catalog data: sizes in meters (w = width along x, d = depth along y, h = height).

export type FurnitureCategory = 'Kamar' | 'Ruang tamu' | 'Makan & dapur' | 'Kamar mandi' | 'Lain-lain';

export type FurnitureSpec = {
  label: string;
  category: FurnitureCategory;
  size: { w: number; d: number; h: number };
  color: string;
};

export const FURNITURE = {
  'kasur-single': { label: 'Kasur single', category: 'Kamar', size: { w: 1.0, d: 2.0, h: 0.55 }, color: '#e8e2d6' },
  'kasur-double': { label: 'Kasur double', category: 'Kamar', size: { w: 1.6, d: 2.0, h: 0.55 }, color: '#e8e2d6' },
  lemari: { label: 'Lemari', category: 'Kamar', size: { w: 1.2, d: 0.6, h: 2.0 }, color: '#a47551' },
  nakas: { label: 'Nakas', category: 'Kamar', size: { w: 0.45, d: 0.4, h: 0.5 }, color: '#a47551' },
  'sofa-3': { label: 'Sofa 3 dudukan', category: 'Ruang tamu', size: { w: 2.0, d: 0.9, h: 0.8 }, color: '#7d8b8c' },
  'kursi-santai': { label: 'Kursi santai', category: 'Ruang tamu', size: { w: 0.8, d: 0.8, h: 0.8 }, color: '#c08a5b' },
  'meja-tamu': { label: 'Meja tamu', category: 'Ruang tamu', size: { w: 1.0, d: 0.6, h: 0.42 }, color: '#8b5e3c' },
  'rak-tv': { label: 'Rak TV', category: 'Ruang tamu', size: { w: 1.6, d: 0.4, h: 0.5 }, color: '#4a4a48' },
  karpet: { label: 'Karpet', category: 'Ruang tamu', size: { w: 2.0, d: 1.4, h: 0.01 }, color: '#b9a48a' },
  'meja-makan': { label: 'Meja makan', category: 'Makan & dapur', size: { w: 1.6, d: 0.9, h: 0.75 }, color: '#8b5e3c' },
  'kursi-makan': { label: 'Kursi makan', category: 'Makan & dapur', size: { w: 0.45, d: 0.5, h: 0.9 }, color: '#8b5e3c' },
  'kitchen-set': { label: 'Kitchen set', category: 'Makan & dapur', size: { w: 2.4, d: 0.6, h: 0.9 }, color: '#f4f1ea' },
  kulkas: { label: 'Kulkas', category: 'Makan & dapur', size: { w: 0.7, d: 0.7, h: 1.8 }, color: '#d9dcdf' },
  kloset: { label: 'Kloset', category: 'Kamar mandi', size: { w: 0.4, d: 0.7, h: 0.75 }, color: '#fafafa' },
  wastafel: { label: 'Wastafel', category: 'Kamar mandi', size: { w: 0.6, d: 0.45, h: 0.85 }, color: '#fafafa' },
  bathtub: { label: 'Bathtub', category: 'Kamar mandi', size: { w: 1.7, d: 0.75, h: 0.55 }, color: '#fafafa' },
  shower: { label: 'Shower', category: 'Kamar mandi', size: { w: 0.9, d: 0.9, h: 2.0 }, color: '#cfe3ea' },
  'meja-kerja': { label: 'Meja kerja', category: 'Lain-lain', size: { w: 1.2, d: 0.6, h: 0.75 }, color: '#c9a77c' },
  'kursi-kerja': { label: 'Kursi kerja', category: 'Lain-lain', size: { w: 0.55, d: 0.55, h: 1.0 }, color: '#3d3d3d' },
  'rak-buku': { label: 'Rak buku', category: 'Lain-lain', size: { w: 0.9, d: 0.3, h: 1.8 }, color: '#a47551' },
  tanaman: { label: 'Tanaman', category: 'Lain-lain', size: { w: 0.4, d: 0.4, h: 1.1 }, color: '#5f8d4e' },
  'lampu-lantai': { label: 'Lampu lantai', category: 'Lain-lain', size: { w: 0.35, d: 0.35, h: 1.6 }, color: '#d8c7a3' },
} satisfies Record<string, FurnitureSpec>;

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
