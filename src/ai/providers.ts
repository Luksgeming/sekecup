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

  // values the app doesn't know are dropped, never replaced with a made-up default
  const palette = strings(o.palette).filter(isHexColor).map((c) => c.toLowerCase()).slice(0, 6);
  const floor = isFloorMaterial(o.floor) ? o.floor : undefined;
  const furniture = [...new Set(strings(o.furniture).filter(isFurnitureKind))];
  const tips = strings(o.tips).map((t) => t.trim()).filter(Boolean).slice(0, 6);
  if (!palette.length && !floor && !furniture.length && !tips.length) {
    return { error: 'Jawaban AI tidak berisi saran yang bisa dipakai. Coba foto lain atau mode offline.' };
  }
  return {
    style: typeof o.style === 'string' && o.style.trim() ? o.style.trim() : 'Saran AI',
    summary: typeof o.summary === 'string' ? o.summary.trim() : '',
    palette,
    floor,
    furniture,
    tips,
    source: 'ai',
  };
}

export function errorMessage(status: number, body?: unknown): string {
  const err = (body as { error?: { message?: unknown; code?: unknown; details?: { reason?: unknown }[] } } | undefined)?.error;
  const badKey =
    err?.details?.some((d) => d?.reason === 'API_KEY_INVALID') || (typeof err?.message === 'string' && /api key/i.test(err.message));
  if (status === 401 || status === 403 || badKey) return 'API key ditolak. Periksa lagi key di Pengaturan AI.';
  if (err?.code === 'insufficient_quota') return 'Kuota AI habis. Periksa tagihan atau paket di akun layanan AI-mu.';
  if (status === 429) return 'Kuota AI habis atau terlalu sering dipakai. Tunggu sebentar lalu coba lagi.';
  if (status === 400 && typeof err?.message === 'string' && /location|region/i.test(err.message)) {
    return 'Layanan AI ini tidak tersedia di wilayahmu. Coba penyedia lain di Pengaturan AI.';
  }
  if (status === 404) return 'Model AI tidak ditemukan. Periksa nama model di Pengaturan AI.';
  return `Layanan AI menjawab dengan kesalahan (kode ${status}).`;
}

const TIMEOUT_MS = 60_000;

/** Sends the photo to the chosen provider and returns its recommendation. */
export async function analyzeWithAi(
  s: AiSettings,
  imageBase64: string,
  mime: string,
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response> = fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<Recommendation | Failure> {
  const req = buildRequest(s, imageBase64, mime);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: controller.signal });
  } catch {
    return controller.signal.aborted
      ? { error: 'Layanan AI terlalu lama menjawab. Coba lagi, atau pakai mode offline.' }
      : { error: 'Tidak bisa terhubung ke layanan AI. Periksa koneksi internet, atau pakai mode offline.' };
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return { error: errorMessage(res.status, await res.json().catch(() => undefined)) };
  const text = readResponse(s.provider, await res.json().catch(() => undefined));
  return text ? parseRecommendation(text) : { error: 'AI tidak memberi jawaban. Coba foto lain.' };
}
