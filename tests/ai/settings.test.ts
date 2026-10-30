import { describe, it, expect } from 'vitest';
import { loadSettings, saveSettings, type KeyStore } from '../../src/ai/settings';

const memory = (): KeyStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('AI settings', () => {
  it('starts with no key and Gemini selected', () => {
    expect(loadSettings(memory())).toEqual({ provider: 'gemini', apiKey: '', model: '' });
  });

  it('saves and loads', () => {
    const s = memory();
    saveSettings({ provider: 'openai', apiKey: ' sk-1 ', model: 'gpt-x' }, s);
    expect(loadSettings(s)).toEqual({ provider: 'openai', apiKey: 'sk-1', model: 'gpt-x' });
  });

  it('survives blocked storage', () => {
    const broken: KeyStore = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadSettings(broken).apiKey).toBe('');
    expect(saveSettings({ provider: 'gemini', apiKey: 'k', model: '' }, broken)).toBe(false);
  });
});
