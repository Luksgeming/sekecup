import { describe, it, expect } from 'vitest';
import { buildRequest, errorMessage, parseRecommendation, readResponse } from '../../src/ai/providers';
import { DEFAULT_MODELS } from '../../src/ai/settings';

describe('buildRequest', () => {
  it('builds a Gemini request with the image inline and the key in a header', () => {
    const r = buildRequest({ provider: 'gemini', apiKey: 'k1', model: 'gemini-x' }, 'QUJD', 'image/jpeg');
    expect(r.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    expect(r.headers['x-goog-api-key']).toBe('k1');
    const body = JSON.parse(r.body);
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'QUJD' });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(r.url).not.toContain('k1');
  });

  it('builds an OpenAI request with a data URL image', () => {
    const r = buildRequest({ provider: 'openai', apiKey: 'k2', model: 'gpt-x' }, 'QUJD', 'image/png');
    expect(r.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(r.headers.Authorization).toBe('Bearer k2');
    const body = JSON.parse(r.body);
    expect(body.model).toBe('gpt-x');
    expect(body.messages[0].content[1].image_url.url).toBe('data:image/png;base64,QUJD');
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('falls back to the default model when none is set', () => {
    const r = buildRequest({ provider: 'gemini', apiKey: 'k', model: '' }, 'A', 'image/jpeg');
    expect(r.url).toContain(`/models/${DEFAULT_MODELS.gemini}:`);
  });

  it('lists the catalog in the prompt so the AI only suggests known items', () => {
    const body = JSON.parse(buildRequest({ provider: 'gemini', apiKey: 'k', model: '' }, 'A', 'image/jpeg').body);
    expect(body.contents[0].parts[0].text).toContain('kasur-double');
    expect(body.contents[0].parts[0].text).toContain('keramik');
  });
});

describe('readResponse', () => {
  it('reads Gemini text', () => {
    expect(readResponse('gemini', { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] })).toBe('{"a":1}');
  });
  it('reads OpenAI text', () => {
    expect(readResponse('openai', { choices: [{ message: { content: '{"a":1}' } }] })).toBe('{"a":1}');
  });
  it('returns undefined for an empty answer', () => {
    expect(readResponse('gemini', {})).toBeUndefined();
  });
});

describe('parseRecommendation', () => {
  const good = {
    style: 'Japandi',
    summary: 'Tenang.',
    palette: ['#EFE2C8', '#8b6a4c', '#3f3f3d'],
    floor: 'kayu',
    furniture: ['kasur-double', 'tanaman'],
    tips: ['Pakai linen.'],
  };

  it('accepts a clean answer', () => {
    const r = parseRecommendation(JSON.stringify(good));
    expect(r).toMatchObject({ style: 'Japandi', floor: 'kayu', source: 'ai' });
    expect((r as { palette: string[] }).palette[0]).toBe('#efe2c8');
  });

  it('finds the JSON inside extra text or a code fence', () => {
    expect(parseRecommendation('Berikut saran:\n```json\n' + JSON.stringify(good) + '\n```')).toMatchObject({ style: 'Japandi' });
  });

  it('drops unknown furniture, colors and floors but keeps the rest', () => {
    const r = parseRecommendation(JSON.stringify({ ...good, furniture: ['jacuzzi', 'tanaman', 'constructor'], palette: ['red', '#112233', '#445566', '#778899'], floor: 'lava' }));
    expect(r).toMatchObject({ furniture: ['tanaman'], palette: ['#112233', '#445566', '#778899'], floor: 'keramik' });
  });

  it('rejects text with no JSON', () => {
    expect(parseRecommendation('maaf, saya tidak bisa')).toHaveProperty('error');
  });
});

describe('errorMessage', () => {
  it('explains common failures', () => {
    expect(errorMessage(401)).toContain('API key');
    expect(errorMessage(403)).toContain('API key');
    expect(errorMessage(429)).toContain('Kuota');
    expect(errorMessage(500)).toContain('500');
  });
});
