import type { FloorMaterial, FurnitureKind } from '../interior/kinds';
import type { Swatch } from './palette';
import type { Recommendation } from './recommendation';

type Style = {
  name: string;
  // what a photo of this style tends to look like
  target: { light: number; sat: number; warm: number; green: number };
  summary: string;
  palette: string[];
  floor: FloorMaterial;
  furniture: FurnitureKind[];
  tips: string[];
};

const STYLES: Style[] = [
  {
    name: 'Minimalis',
    target: { light: 0.86, sat: 0.05, warm: 0.0, green: 0 },
    summary: 'Ruangan terang dan bersih. Pertahankan permukaan polos dan sedikit barang.',
    palette: ['#f2efe8', '#d9d9d6', '#3f3f3d', '#b9a48a'],
    floor: 'beton',
    furniture: ['sofa-3', 'meja-tamu', 'rak-tv', 'lampu-lantai'],
    tips: ['Pilih furnitur berkaki ramping agar lantai terlihat lapang.', 'Simpan barang di lemari tertutup, bukan rak terbuka.', 'Satu tanaman besar lebih rapi daripada banyak tanaman kecil.'],
  },
  {
    name: 'Skandinavia',
    target: { light: 0.8, sat: 0.12, warm: 0.08, green: 0.02 },
    summary: 'Terang, hangat, dan nyaman, dengan kayu muda dan tekstil lembut.',
    palette: ['#f2efe8', '#e8e2d6', '#b7c4a8', '#c9a77c', '#4a4a48'],
    floor: 'kayu',
    furniture: ['sofa-3', 'karpet', 'meja-tamu', 'tanaman', 'lampu-lantai', 'rak-buku'],
    tips: ['Pakai karpet bertekstur di area duduk.', 'Kayu warna muda (oak, pinus) untuk meja dan rak.', 'Tambahkan lampu hangat di sudut agar nyaman di malam hari.'],
  },
  {
    name: 'Industrial',
    target: { light: 0.3, sat: 0.08, warm: 0.04, green: 0 },
    summary: 'Nuansa gelap dengan beton, logam, dan kayu tua.',
    palette: ['#d9d9d6', '#3f3f3d', '#8b5e3c', '#a9a8a4'],
    floor: 'beton',
    furniture: ['sofa-3', 'meja-kerja', 'kursi-kerja', 'rak-buku', 'lampu-lantai'],
    tips: ['Dinding abu muda menyeimbangkan furnitur yang gelap.', 'Padukan logam hitam dengan kayu berserat kasar.', 'Lampu gantung atau lampu lantai berwarna kuning hangat.'],
  },
  {
    name: 'Japandi',
    target: { light: 0.66, sat: 0.18, warm: 0.14, green: 0.03 },
    summary: 'Tenang dan alami: warna tanah, kayu, dan bentuk rendah.',
    palette: ['#efe2c8', '#d9c9a8', '#8b6a4c', '#3f3f3d', '#b7c4a8'],
    floor: 'kayu',
    furniture: ['kasur-double', 'nakas', 'meja-tamu', 'tanaman', 'karpet'],
    tips: ['Pilih furnitur rendah dan berbentuk sederhana.', 'Batasi palet ke 3–4 warna tanah.', 'Bahan alami: linen, rotan, kayu tanpa cat mengkilap.'],
  },
  {
    name: 'Tropis',
    target: { light: 0.5, sat: 0.38, warm: 0.08, green: 0.45 },
    summary: 'Segar dan rimbun, dengan tanaman, kayu, dan sirkulasi udara.',
    palette: ['#f2efe8', '#b7c4a8', '#5f8d4e', '#8b5e3c', '#efe2c8'],
    floor: 'kayu',
    furniture: ['tanaman', 'kursi-santai', 'sofa-3', 'karpet', 'meja-tamu'],
    tips: ['Kelompokkan beberapa tanaman dengan tinggi berbeda.', 'Dinding terang agar ruangan tetap sejuk.', 'Rotan dan kayu jati cocok untuk kursi dan meja.'],
  },
  {
    name: 'Klasik Hangat',
    target: { light: 0.5, sat: 0.38, warm: 0.3, green: 0 },
    summary: 'Hangat dan berkarakter, dengan kayu gelap dan warna tanah liat.',
    palette: ['#efe2c8', '#c9785a', '#8b5e3c', '#7d8b8c', '#f2efe8'],
    floor: 'kayu',
    furniture: ['sofa-3', 'kursi-santai', 'meja-tamu', 'rak-buku', 'karpet', 'lampu-lantai'],
    tips: ['Satu dinding aksen terakota sudah cukup kuat.', 'Kayu gelap untuk rak dan meja, kain polos untuk sofa.', 'Karpet bermotif menyatukan area duduk.'],
  },
];

function features(palette: Swatch[]) {
  let light = 0;
  let sat = 0;
  let warm = 0;
  let green = 0;
  for (const { color, weight } of palette) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    light += l * weight;
    sat += s * weight;
    warm += (r - b) * weight;
    if (g === max && g - Math.max(r, b) > 0.08 && s > 0.2) green += weight;
  }
  const total = palette.reduce((t, p) => t + p.weight, 0) || 1;
  return { light: light / total, sat: sat / total, warm: warm / total, green: green / total };
}

export function recommendOffline(palette: Swatch[]): Recommendation {
  const f = features(palette);
  const score = (s: Style) =>
    (f.light - s.target.light) ** 2 * 3 +
    (f.sat - s.target.sat) ** 2 * 2 +
    (f.warm - s.target.warm) ** 2 * 2 +
    (f.green - s.target.green) ** 2 * 3;
  const best = [...STYLES].sort((a, b) => score(a) - score(b))[0];
  return {
    style: best.name,
    summary: best.summary,
    palette: best.palette,
    floor: best.floor,
    furniture: best.furniture,
    tips: best.tips,
    source: 'offline',
  };
}
