import { describe, it, expect } from 'vitest';
import { extractPalette } from '../../src/ai/palette';
import { recommendOffline } from '../../src/ai/styles';
import { FURNITURE_KINDS } from '../../src/interior/kinds';

// builds RGBA pixels from [hex, share] pairs
function image(parts: [string, number][], total = 1000): Uint8ClampedArray {
  const px: number[] = [];
  for (const [hex, share] of parts) {
    const n = Math.round(total * share);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 0; i < n; i++) px.push(r, g, b, 255);
  }
  return new Uint8ClampedArray(px);
}

describe('extractPalette', () => {
  it('finds the only color of a flat image', () => {
    const p = extractPalette(image([['#336699', 1]]));
    expect(p[0].color).toBe('#336699');
    expect(p[0].weight).toBeCloseTo(1);
  });

  it('orders colors by how much of the image they cover', () => {
    const p = extractPalette(image([['#ffffff', 0.7], ['#000000', 0.3]]));
    expect(p[0].color).toBe('#ffffff');
    expect(p[1].color).toBe('#000000');
    expect(p[0].weight).toBeCloseTo(0.7, 1);
  });

  it('gives the same result every time', () => {
    const img = image([['#c08a5b', 0.4], ['#e8e2d6', 0.4], ['#5f8d4e', 0.2]]);
    expect(extractPalette(img)).toEqual(extractPalette(img));
  });

  it('ignores transparent pixels', () => {
    const img = new Uint8ClampedArray([10, 20, 30, 0, 200, 100, 50, 255]);
    expect(extractPalette(img)[0].color).toBe('#c86432');
  });
});

describe('recommendOffline', () => {
  const style = (parts: [string, number][]) => recommendOffline(extractPalette(image(parts))).style;

  it('reads a bright neutral room as Skandinavia or Minimalis', () => {
    expect(['Skandinavia', 'Minimalis']).toContain(style([['#f4f3ef', 0.6], ['#dcd8cf', 0.3], ['#b9a48a', 0.1]]));
  });

  it('reads a dark grey room as Industrial', () => {
    expect(style([['#3c3c3c', 0.5], ['#5a5550', 0.3], ['#2a2a2a', 0.2]])).toBe('Industrial');
  });

  it('reads a green and wood room as Tropis', () => {
    expect(style([['#4f7a3a', 0.45], ['#8b5e3c', 0.35], ['#d9c9a8', 0.2]])).toBe('Tropis');
  });

  it('returns a usable recommendation', () => {
    const r = recommendOffline(extractPalette(image([['#f4f3ef', 1]])));
    expect(r.source).toBe('offline');
    expect(r.palette.length).toBeGreaterThanOrEqual(3);
    r.palette.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
    r.furniture.forEach((k) => expect(FURNITURE_KINDS).toContain(k));
    expect(r.tips.length).toBeGreaterThan(0);
  });
});
