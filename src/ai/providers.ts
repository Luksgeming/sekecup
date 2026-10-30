import { FLOOR_MATERIALS, FURNITURE, FURNITURE_KINDS, isFloorMaterial, isFurnitureKind, isHexColor } from '../interior/kinds';
import type { Failure } from '../model/types';
import type { Recommendation } from './recommendation';
import { DEFAULT_MODELS, type AiSettings, type Provider } from './settings';

export type AiRequest = { url: string; headers: Record<string, string>; body: string };

function prompt(): string {
  const furniture = FURNITURE_KINDS.map((k) => `${k} (${FURNITURE[k].label})`).join(', ');
  const floors = Object.keys(FLOOR_MATERIALS).join(', ');
  return [
    'Kamu desainer interior. Lihat foto ruangan ini dan beri saran untuk mendesain ulang interiornya.',
    'Jawab HANYA dengan JSON, dalam Bahasa Indonesia, dengan bentuk:',
    '{"style": string, "summary": string (1-2 kalimat), "palette": ["#rrggbb", ...] (3-6 warna, warna pertama untuk dinding),',
    ' "floor": salah satu dari [' + floors + '], "furniture": [kode furnitur, 3-6 item], "tips": [3-5 kalimat pendek]}',
    'Kode furnitur yang boleh dipakai: ' + furniture + '.',
  ].join('\n');
}

export function buildRequest(s: AiSettings, imageBase64: string, mime: string): AiRequest {
  const model = s.model.trim() || DEFAULT_MODELS[s.provider];
  if (s.provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt() }, { inline_data: { mime_type: mime, data: imageBase64 } }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    };
  }
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt() },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
  };
}

/** The answer text from a provider's JSON response. */
export function readResponse(provider: Provider, json: unknown): string | undefined {
  const o = json as Record<string, any>;
  const text = provider === 'gemini' ? o?.candidates?.[0]?.content?.parts?.[0]?.text : o?.choices?.[0]?.message?.content;
  return typeof text === 'string' && text.trim() ? text : undefined;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Validates an AI answer; unknown furniture, floors and colors are dropped rather than failing. */
export function parseRecommendation(text: string): Recommendation | Failure {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { error: 'Jawaban AI tidak bisa dibaca. Coba analisis sekali lagi.' };
  }
  if (start < 0 || typeof o !== 'object' || o === null) return { error: 'Jawaban AI tidak bisa dibaca. Coba analisis sekali lagi.' };

  const palette = strings(o.palette).filter(isHexColor).map((c) => c.toLowerCase()).slice(0, 6);
  return {
    style: typeof o.style === 'string' && o.style.trim() ? o.style.trim() : 'Saran AI',
    summary: typeof o.summary === 'string' ? o.summary.trim() : '',
    palette: palette.length ? palette : ['#f2efe8'],
    floor: isFloorMaterial(o.floor) ? o.floor : 'keramik',
    furniture: [...new Set(strings(o.furniture).filter(isFurnitureKind))],
    tips: strings(o.tips).map((t) => t.trim()).filter(Boolean).slice(0, 6),
    source: 'ai',
  };
}

export function errorMessage(status: number): string {
  if (status === 401 || status === 403) return 'API key ditolak. Periksa lagi key di Pengaturan AI.';
  if (status === 429) return 'Kuota AI habis atau terlalu sering dipakai. Tunggu sebentar lalu coba lagi.';
  if (status === 404) return 'Model AI tidak ditemukan. Periksa nama model di Pengaturan AI.';
  return `Layanan AI menjawab dengan kesalahan (kode ${status}).`;
}

/** Sends the photo to the chosen provider and returns its recommendation. */
export async function analyzeWithAi(s: AiSettings, imageBase64: string, mime: string): Promise<Recommendation | Failure> {
  const req = buildRequest(s, imageBase64, mime);
  let res: Response;
  try {
    res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  } catch {
    return { error: 'Tidak bisa terhubung ke layanan AI. Periksa koneksi internet, atau pakai mode offline.' };
  }
  if (!res.ok) return { error: errorMessage(res.status) };
  const text = readResponse(s.provider, await res.json().catch(() => undefined));
  return text ? parseRecommendation(text) : { error: 'AI tidak memberi jawaban. Coba foto lain.' };
}
