export type Swatch = { color: string; weight: number };

const MAX_SAMPLES = 20000;
const MERGE_DISTANCE = 48;
const MIN_WEIGHT = 0.02;

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/**
 * Dominant colors of an RGBA image, largest share first. Pixels are binned
 * coarsely, then neighbouring bins merge into clusters; no randomness, so the
 * same photo always gives the same palette.
 */
export function extractPalette(pixels: Uint8ClampedArray, k = 5): Swatch[] {
  const count = pixels.length / 4;
  const step = Math.max(1, Math.floor(count / MAX_SAMPLES));
  const bins = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let i = 0; i < count; i += step) {
    const o = i * 4;
    if (pixels[o + 3] < 128) continue;
    const [r, g, b] = [pixels[o], pixels[o + 1], pixels[o + 2]];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bin.n++;
    bins.set(key, bin);
    total++;
  }
  if (!total) return [];

  const clusters: { r: number; g: number; b: number; n: number }[] = [];
  for (const bin of [...bins.values()].sort((a, b) => b.n - a.n)) {
    const avg = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n];
    const near = clusters.find((c) => Math.hypot(c.r / c.n - avg[0], c.g / c.n - avg[1], c.b / c.n - avg[2]) < MERGE_DISTANCE);
    if (near) {
      near.r += bin.r;
      near.g += bin.g;
      near.b += bin.b;
      near.n += bin.n;
    } else {
      clusters.push({ ...bin });
    }
  }

  return clusters
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ color: hex(c.r / c.n, c.g / c.n, c.b / c.n), weight: c.n / total }))
    .filter((s, i) => i === 0 || s.weight >= MIN_WEIGHT)
    .slice(0, k);
}
