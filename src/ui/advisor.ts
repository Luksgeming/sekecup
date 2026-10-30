import { extractPalette } from '../ai/palette';
import { analyzeWithAi } from '../ai/providers';
import type { Recommendation } from '../ai/recommendation';
import { DEFAULT_MODELS, loadSettings, PROVIDER_LABELS, saveSettings, type Provider } from '../ai/settings';
import { recommendOffline } from '../ai/styles';
import { FLOOR_MATERIALS, FURNITURE, type FurnitureKind } from '../interior/kinds';

const MAX_SEND_PX = 1024; // longest side sent to the AI
const MAX_SCAN_PX = 160; // longest side scanned for colors

type Photo = { base64: string; mime: string; pixels: Uint8ClampedArray; url: string };

export type AdvisorHooks = {
  /** Applies the suggestion to the design; returns a message for the user. */
  apply: (rec: Pick<Recommendation, 'palette' | 'floor'>) => string;
  /** Arms the furniture tool with a suggested piece. */
  place: (kind: FurnitureKind) => void;
  toast: (msg: string) => void;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e: HTMLElementTagNameMap[K] = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
}

async function readPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  const draw = (max: number) => {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  const send = draw(MAX_SEND_PX);
  const scan = draw(MAX_SCAN_PX);
  const base64 = send.toDataURL('image/jpeg', 0.85).split(',')[1];
  const pixels = scan.getContext('2d')!.getImageData(0, 0, scan.width, scan.height).data;
  return { base64, mime: 'image/jpeg', pixels, url };
}

export function createAdvisor(hooks: AdvisorHooks): { open: () => void } {
  let photo: Photo | undefined;
  let result: Recommendation | undefined;
  let busy = false;
  // bumps whenever the photo changes, so a slow answer for an older photo is ignored
  let generation = 0;

  const dialog = el('dialog', { className: 'dialog advisor' });
  dialog.setAttribute('aria-labelledby', 'advisor-title');
  const title = el('h2', { id: 'advisor-title' }, 'Saran Interior dari Foto');
  const mode = el('p', { className: 'advisor-mode' });
  const settingsBtn = el('button', { type: 'button' }, 'Pengaturan AI');
  const closeBtn = el('button', { type: 'button' }, 'Tutup');
  closeBtn.addEventListener('click', () => dialog.close());
  const head = el('div', { className: 'advisor-head' }, el('div', {}, title, mode), el('div', { className: 'row' }, settingsBtn, closeBtn));

  const input = el('input', { type: 'file', accept: 'image/*', id: 'advisor-file' });
  input.className = 'visually-hidden';
  const preview = el('img', { alt: 'Foto ruangan', hidden: true });
  const dropText = el('span', {}, 'Pilih foto ruangan, seret ke sini, atau tempel (Ctrl/Cmd+V)');
  const drop = el('label', { className: 'advisor-drop', htmlFor: 'advisor-file' }, preview, dropText, input);
  const analyzeBtn = el('button', { type: 'button', className: 'primary', disabled: true }, 'Analisis');
  const status = el('p', { className: 'advisor-status' });
  status.setAttribute('role', 'status');
  const left = el('div', { className: 'advisor-left' }, drop, analyzeBtn, status);
  const results = el('div', { className: 'advisor-results' });
  dialog.append(head, el('div', { className: 'advisor-body' }, left, results));
  document.body.append(dialog);

  const refreshMode = () => {
    const s = loadSettings();
    mode.textContent = s.apiKey ? `Mode AI: ${PROVIDER_LABELS[s.provider]}` : 'Mode offline (isi API key di Pengaturan AI untuk mode AI)';
  };

  async function usePhoto(file: File | undefined): Promise<void> {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      status.textContent = 'File itu bukan gambar. Pilih foto JPG atau PNG.';
      return;
    }
    const mine = ++generation;
    let next: Photo;
    try {
      next = await readPhoto(file);
    } catch {
      status.textContent = 'Foto tidak bisa dibuka. Pakai foto JPG atau PNG.';
      return;
    }
    if (mine !== generation) {
      URL.revokeObjectURL(next.url);
      return;
    }
    if (photo) URL.revokeObjectURL(photo.url);
    photo = next;
    result = undefined;
    results.replaceChildren();
    preview.src = photo.url;
    preview.hidden = false;
    dropText.textContent = 'Ganti foto';
    busy = false;
    analyzeBtn.disabled = false;
    status.textContent = '';
  }

  input.addEventListener('change', () => void usePhoto(input.files?.[0]));
  // the whole dialog accepts a dropped photo, so a near miss never opens the image outside the app
  dialog.addEventListener('dragover', (e) => e.preventDefault());
  dialog.addEventListener('drop', (e) => {
    e.preventDefault();
    void usePhoto(e.dataTransfer?.files[0]);
  });
  dialog.addEventListener('paste', (e) => {
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (file) void usePhoto(file);
  });

  async function analyze(forceOffline = false): Promise<void> {
    if (!photo || busy) return;
    const s = loadSettings();
    const mine = generation;
    busy = true;
    analyzeBtn.disabled = true;
    status.textContent = s.apiKey && !forceOffline ? 'Menganalisis dengan AI…' : 'Menganalisis warna foto…';
    const r = s.apiKey && !forceOffline ? await analyzeWithAi(s, photo.base64, photo.mime) : recommendOffline(extractPalette(photo.pixels));
    if (mine !== generation) return; // the photo changed while waiting
    busy = false;
    analyzeBtn.disabled = false;
    if ('error' in r) {
      status.replaceChildren(r.error + ' ');
      const offline = el('button', { type: 'button' }, 'Pakai mode offline');
      offline.addEventListener('click', () => void analyze(true));
      status.append(offline);
      return;
    }
    status.textContent = '';
    result = r;
    render(r);
  }
  analyzeBtn.addEventListener('click', () => void analyze());

  function render(r: Recommendation): void {
    const swatches = el('div', { className: 'swatch-list' });
    for (const c of r.palette) {
      const s = el('button', { type: 'button', className: 'swatch', title: `Pakai ${c} untuk semua dinding` });
      s.setAttribute('aria-label', `Pakai warna ${c} untuk semua dinding`);
      s.style.background = c;
      s.addEventListener('click', () => hooks.toast(hooks.apply({ palette: [c] })));
      swatches.append(s);
    }
    const furniture = el('div', { className: 'advisor-furniture' });
    for (const kind of r.furniture) {
      const b = el('button', { type: 'button' }, FURNITURE[kind].label);
      b.title = 'Taruh di denah';
      b.addEventListener('click', () => {
        dialog.close();
        hooks.place(kind);
      });
      furniture.append(b);
    }
    const apply = el('button', { type: 'button', className: 'primary' }, 'Terapkan ke desain');
    apply.addEventListener('click', () => {
      if (!result) return;
      hooks.toast(hooks.apply(result));
      dialog.close();
    });
    results.replaceChildren(
      el('p', { className: 'advisor-source' }, r.source === 'ai' ? 'Saran AI' : 'Saran offline (dari warna foto)'),
      el('h3', {}, r.style),
      ...(r.summary ? [el('p', {}, r.summary)] : []),
      ...(r.palette.length
        ? [el('h4', {}, 'Palet warna'), swatches, el('p', { className: 'advisor-note' }, 'Warna pertama untuk dinding. Klik warna untuk langsung memakainya.')]
        : []),
      ...(r.floor ? [el('h4', {}, 'Lantai'), el('p', {}, FLOOR_MATERIALS[r.floor].label)] : []),
      ...(r.furniture.length ? [el('h4', {}, 'Furnitur yang cocok'), furniture, el('p', { className: 'advisor-note' }, 'Klik untuk menaruhnya di denah.')] : []),
      ...(r.tips.length ? [el('h4', {}, 'Tips'), el('ul', {}, ...r.tips.map((t) => el('li', {}, t)))] : []),
      apply,
    );
  }

  // settings dialog
  const settings = el('dialog', { className: 'dialog' });
  const provider = el('select', { id: 'ai-provider' });
  for (const [value, label] of Object.entries(PROVIDER_LABELS)) provider.append(new Option(label, value));
  const key = el('input', { id: 'ai-key', type: 'password', autocomplete: 'off', placeholder: 'Tempel API key di sini' });
  const model = el('input', { id: 'ai-model', autocomplete: 'off' });
  const syncPlaceholder = () => (model.placeholder = `Bawaan: ${DEFAULT_MODELS[provider.value as Provider]}`);
  provider.addEventListener('change', syncPlaceholder);
  const save = el('button', { type: 'button', className: 'primary' }, 'Simpan');
  const clear = el('button', { type: 'button' }, 'Hapus key');
  const cancel = el('button', { type: 'button' }, 'Batal');
  settings.append(
    el('h2', {}, 'Pengaturan AI'),
    el('label', { htmlFor: 'ai-provider' }, 'Layanan', provider),
    el('label', { htmlFor: 'ai-key' }, 'API key', key),
    el('label', { htmlFor: 'ai-model' }, 'Model (boleh kosong)', model),
    el('p', { className: 'advisor-note' }, 'API key hanya disimpan di perangkat ini dan tidak ikut tersimpan di file project.'),
    el('div', { className: 'dialog-actions' }, clear, cancel, save),
  );
  document.body.append(settings);

  settingsBtn.addEventListener('click', () => {
    const s = loadSettings();
    provider.value = s.provider;
    key.value = s.apiKey;
    model.value = s.model;
    syncPlaceholder();
    settings.showModal();
  });
  const store = (apiKey: string) => {
    const ok = saveSettings({ provider: provider.value as Provider, apiKey, model: model.value });
    hooks.toast(ok ? (apiKey.trim() ? 'Pengaturan AI disimpan' : 'API key dihapus') : 'Pengaturan tidak bisa disimpan di browser ini');
    settings.close();
    refreshMode();
  };
  save.addEventListener('click', () => store(key.value));
  clear.addEventListener('click', () => store(''));
  cancel.addEventListener('click', () => settings.close());

  return {
    open: () => {
      refreshMode();
      dialog.showModal();
    },
  };
}
