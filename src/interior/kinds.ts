// Furniture catalog. Every piece is a realistic CC0 model from Poly Haven (see
// public/models/CREDITS.md). Sizes in meters, taken from the models themselves:
// w = width along x, d = depth along y on the plan, h = height. `rotation` turns
// the model (degrees) so its front faces +y on the plan.

export type FurnitureCategory = 'Kamar' | 'Ruang tamu' | 'Makan' | 'Dapur' | 'Kerja' | 'Tanaman' | 'Lampu';

export type FurnitureSpec = {
  label: string;
  category: FurnitureCategory;
  model: string;
  rotation: number;
  size: { w: number; d: number; h: number };
  /** 'ceiling' pieces hang from the ceiling instead of standing on the floor. */
  mount?: 'ceiling';
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
  'daybed': { label: 'Daybed rotan', category: 'Kamar', model: 'vintage_day_bed', rotation: 0, size: { w: 1.97, d: 0.85, h: 1.13 } },
  'nakas-klasik': { label: 'Nakas klasik', category: 'Kamar', model: 'ClassicNightstand_01', rotation: 0, size: { w: 0.57, d: 0.42, h: 0.7 } },
  'nakas-cat': { label: 'Nakas kayu cat', category: 'Kamar', model: 'painted_wooden_nightstand', rotation: 0, size: { w: 0.51, d: 0.51, h: 0.62 } },
  'komod': { label: 'Komod laci', category: 'Kamar', model: 'GothicCommode_01', rotation: 0, size: { w: 1.2, d: 0.58, h: 1.21 } },
  'bufet-putih': { label: 'Bufet putih', category: 'Kamar', model: 'painted_wooden_cabinet', rotation: 0, size: { w: 1.19, d: 0.62, h: 1.18 } },
  'lemari-biru': { label: 'Lemari kayu biru', category: 'Kamar', model: 'painted_wooden_cabinet_02', rotation: 0, size: { w: 1.0, d: 0.72, h: 2.57 } },
  'lemari-ukir': { label: 'Lemari ukir', category: 'Kamar', model: 'GothicCabinet_01', rotation: 0, size: { w: 1.72, d: 1.12, h: 2.36 } },
  'lemari-oriental': { label: 'Lemari oriental', category: 'Kamar', model: 'chinese_cabinet', rotation: 0, size: { w: 1.26, d: 0.55, h: 2.87 } },
  'sofa-besar': { label: 'Sofa besar', category: 'Ruang tamu', model: 'sofa_03', rotation: 0, size: { w: 2.73, d: 0.93, h: 1.12 } },
  'sofa-oriental': { label: 'Sofa oriental', category: 'Ruang tamu', model: 'chinese_sofa', rotation: 0, size: { w: 2.28, d: 0.97, h: 0.86 } },
  'sofa-kayu': { label: 'Sofa kayu', category: 'Ruang tamu', model: 'painted_wooden_sofa', rotation: 0, size: { w: 2.45, d: 0.79, h: 1.28 } },
  'kursi-klasik': { label: 'Kursi klasik', category: 'Ruang tamu', model: 'ArmChair_01', rotation: 0, size: { w: 0.85, d: 0.77, h: 1.06 } },
  'kursi-beludru': { label: 'Kursi beludru hijau', category: 'Ruang tamu', model: 'GreenChair_01', rotation: 0, size: { w: 0.67, d: 0.66, h: 1.06 } },
  'kursi-goyang': { label: 'Kursi goyang', category: 'Ruang tamu', model: 'Rockingchair_01', rotation: 0, size: { w: 0.71, d: 0.83, h: 0.99 } },
  'kursi-oriental': { label: 'Kursi oriental', category: 'Ruang tamu', model: 'chinese_armchair', rotation: 0, size: { w: 0.85, d: 0.79, h: 1.59 } },
  'meja-tamu-kotak': { label: 'Meja tamu kotak', category: 'Ruang tamu', model: 'modern_coffee_table_02', rotation: 0, size: { w: 1.2, d: 1.2, h: 0.37 } },
  'meja-tamu-ukir': { label: 'Meja tamu ukir', category: 'Ruang tamu', model: 'gothic_coffee_table', rotation: 0, size: { w: 1.44, d: 1.44, h: 0.56 } },
  'meja-tamu-industri': { label: 'Meja tamu industrial', category: 'Ruang tamu', model: 'industrial_coffee_table', rotation: 0, size: { w: 0.78, d: 0.76, h: 0.64 } },
  'meja-samping': { label: 'Meja samping tinggi', category: 'Ruang tamu', model: 'side_table_tall_01', rotation: 0, size: { w: 0.38, d: 0.38, h: 0.76 } },
  'meja-kecil': { label: 'Meja kayu kecil', category: 'Ruang tamu', model: 'small_wooden_table_01', rotation: 0, size: { w: 0.92, d: 0.44, h: 0.53 } },
  'konsol': { label: 'Meja konsol klasik', category: 'Ruang tamu', model: 'ClassicConsole_01', rotation: 0, size: { w: 1.54, d: 0.59, h: 0.95 } },
  'konsol-oriental': { label: 'Meja konsol oriental', category: 'Ruang tamu', model: 'chinese_console_table', rotation: 0, size: { w: 1.72, d: 0.34, h: 0.66 } },
  'partisi': { label: 'Partisi lipat', category: 'Ruang tamu', model: 'chinese_screen_panels', rotation: 0, size: { w: 1.29, d: 0.38, h: 1.6 } },
  'jam-berdiri': { label: 'Jam berdiri', category: 'Ruang tamu', model: 'vintage_grandfather_clock_01', rotation: 0, size: { w: 0.63, d: 0.43, h: 2.19 } },
  'meja-makan-taplak': { label: 'Meja makan bertaplak', category: 'Makan', model: 'dining_table', rotation: 0, size: { w: 2.26, d: 1.39, h: 0.88 } },
  'meja-makan-panjang': { label: 'Meja makan panjang', category: 'Makan', model: 'painted_wooden_table', rotation: 0, size: { w: 2.4, d: 1.14, h: 0.96 } },
  'meja-bundar': { label: 'Meja bundar tinggi', category: 'Makan', model: 'round_wooden_table_01', rotation: 0, size: { w: 1.4, d: 1.4, h: 1.0 } },
  'meja-teh': { label: 'Meja teh', category: 'Makan', model: 'chinese_tea_table', rotation: 0, size: { w: 0.84, d: 0.83, h: 0.5 } },
  'meja-peti': { label: 'Meja peti ukir', category: 'Makan', model: 'gallinera_table', rotation: 0, size: { w: 0.83, d: 0.52, h: 0.49 } },
  'kursi-ukir': { label: 'Kursi ukir', category: 'Makan', model: 'gallinera_chair', rotation: 0, size: { w: 0.58, d: 0.6, h: 1.03 } },
  'kursi-kayu-putih': { label: 'Kursi kayu putih', category: 'Makan', model: 'painted_wooden_chair_01', rotation: 0, size: { w: 0.43, d: 0.54, h: 0.96 } },
  'kursi-bar': { label: 'Kursi bar', category: 'Makan', model: 'bar_chair_round_01', rotation: 0, size: { w: 0.48, d: 0.49, h: 0.75 } },
  'bangku-kayu': { label: 'Bangku kayu', category: 'Makan', model: 'wooden_stool_01', rotation: 0, size: { w: 0.42, d: 0.44, h: 0.44 } },
  'bangku-besi': { label: 'Bangku besi', category: 'Makan', model: 'metal_stool_02', rotation: 0, size: { w: 0.45, d: 0.47, h: 0.46 } },
  'kompor': { label: 'Kompor listrik', category: 'Dapur', model: 'electric_stove', rotation: 0, size: { w: 0.5, d: 0.65, h: 0.86 } },
  'rak-buku-kayu': { label: 'Rak buku kayu', category: 'Kerja', model: 'wooden_bookshelf_worn', rotation: 0, size: { w: 1.37, d: 0.58, h: 2.06 } },
  'rak-putih': { label: 'Rak buku putih', category: 'Kerja', model: 'Shelf_01', rotation: 0, size: { w: 1.0, d: 0.26, h: 2.08 } },
  'rak-besi-ramping': { label: 'Rak besi ramping', category: 'Kerja', model: 'steel_frame_shelves_02', rotation: 0, size: { w: 0.59, d: 0.5, h: 2.14 } },
  'sukulen': { label: 'Sukulen kecil', category: 'Tanaman', model: 'potted_plant_04', rotation: 0, size: { w: 0.17, d: 0.18, h: 0.27 } },
  'lampu-gantung': { label: 'Lampu gantung modern', category: 'Lampu', model: 'modern_ceiling_lamp_01', rotation: 0, size: { w: 0.43, d: 0.43, h: 0.95 }, mount: 'ceiling' },
  'kandelir': { label: 'Kandelir klasik', category: 'Lampu', model: 'Chandelier_01', rotation: 0, size: { w: 0.75, d: 0.82, h: 0.8 }, mount: 'ceiling' },
  'kandelir-tudung': { label: 'Kandelir bertudung', category: 'Lampu', model: 'Chandelier_02', rotation: 0, size: { w: 0.68, d: 0.62, h: 0.85 }, mount: 'ceiling' },
  'kandelir-besar': { label: 'Kandelir besar', category: 'Lampu', model: 'Chandelier_03', rotation: 0, size: { w: 0.78, d: 0.79, h: 1.04 }, mount: 'ceiling' },
  'lampu-lentera': { label: 'Lampu lentera', category: 'Lampu', model: 'lantern_chandelier_01', rotation: 0, size: { w: 0.58, d: 0.57, h: 0.88 }, mount: 'ceiling' },
  'lampu-industri': { label: 'Lampu gantung industrial', category: 'Lampu', model: 'hanging_industrial_lamp', rotation: 0, size: { w: 0.55, d: 0.55, h: 1.35 }, mount: 'ceiling' },
  'lampu-panjang': { label: 'Lampu gantung panjang', category: 'Lampu', model: 'caged_hanging_light', rotation: 0, size: { w: 1.16, d: 0.32, h: 0.75 }, mount: 'ceiling' },
  'kipas-plafon': { label: 'Kipas angin plafon', category: 'Lampu', model: 'ceiling_fan', rotation: 0, size: { w: 1.46, d: 1.46, h: 0.52 }, mount: 'ceiling' },
} satisfies Record<string, FurnitureSpec>;

/** Kinds from older versions that have no realistic model; files that use them drop those pieces. */
export const REMOVED_KINDS = new Set([
  'kasur-single', 'karpet', 'kitchen-set', 'kulkas', 'kloset', 'wastafel', 'bathtub', 'shower', 'kursi-kerja', 'lampu-lantai',
]);

export type FurnitureKind = keyof typeof FURNITURE;

export const FURNITURE_KINDS = Object.keys(FURNITURE) as FurnitureKind[];

export const hangsFromCeiling = (kind: FurnitureKind): boolean => (FURNITURE[kind] as FurnitureSpec).mount === 'ceiling';

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
