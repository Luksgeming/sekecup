export type Provider = 'gemini' | 'openai';

export type AiSettings = { provider: Provider; apiKey: string; model: string };

export type KeyStore = Pick<Storage, 'getItem' | 'setItem'>;

export const DEFAULT_MODELS: Record<Provider, string> = { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini' };

export const PROVIDER_LABELS: Record<Provider, string> = { gemini: 'Google Gemini', openai: 'OpenAI' };

// The key stays on this device only; it is never written into project files.
const KEY = 'rea:ai-settings';

const browserStore = (): KeyStore | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

// used for the rest of the session when the browser refuses to store settings
let session: AiSettings | undefined;

export function loadSettings(store: KeyStore | undefined = browserStore()): AiSettings {
  const fallback: AiSettings = session ?? { provider: 'gemini', apiKey: '', model: '' };
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return fallback;
    const o = JSON.parse(raw);
    return {
      provider: o.provider === 'openai' ? 'openai' : 'gemini',
      apiKey: typeof o.apiKey === 'string' ? o.apiKey : '',
      model: typeof o.model === 'string' ? o.model : '',
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(s: AiSettings, store: KeyStore | undefined = browserStore()): boolean {
  session = { provider: s.provider, apiKey: s.apiKey.trim(), model: s.model.trim() };
  try {
    store?.setItem(KEY, JSON.stringify(session));
    return store !== undefined;
  } catch {
    return false;
  }
}
