import type { ToolName } from '../plan/tools';

export type ToolbarAction = { id: string; label: string; title?: string; run: () => void };

const TOOLS: { tool: ToolName; label: string; key: string; group: string }[] = [
  { tool: 'wall', label: 'Dinding', key: 'W', group: 'Gambar' },
  { tool: 'room', label: 'Ruangan', key: 'R', group: 'Gambar' },
  { tool: 'door', label: 'Pintu', key: 'D', group: 'Bukaan' },
  { tool: 'window', label: 'Jendela', key: 'J', group: 'Bukaan' },
  { tool: 'furniture', label: 'Furnitur', key: 'F', group: 'Isi' },
  { tool: 'select', label: 'Pilih / ubah', key: 'V', group: 'Ubah' },
];

/** What the command line asks for while each tool is active, CAD style. */
export const TOOL_PROMPTS: Record<ToolName, string> = {
  select: 'PILIH  Klik objek, seret sudut/furnitur:',
  wall: 'DINDING  Klik titik, atau ketik panjang (4500 = mm, 4,5 = m):',
  door: 'PINTU  Klik dinding:',
  window: 'JENDELA  Klik dinding:',
  room: 'RUANG  Klik sudut, atau ketik panjang sisi:',
  furniture: 'FURNITUR  Klik untuk menaruh:',
};

export const TOOL_HINTS: Record<ToolName, string> = {
  select: 'Klik untuk memilih, Delete untuk menghapus. Seret sudut atau furnitur untuk memindah, R untuk memutar.',
  wall: 'Klik titik demi titik untuk menggambar dinding. Ketik panjang: 4500 (mm) atau 4,5 (m). Shift = lurus. Esc = selesai.',
  door: 'Klik di dinding untuk memasang pintu.',
  window: 'Klik di dinding untuk memasang jendela.',
  room: 'Klik sudut-sudut ruangan, atau ketik panjang sisi. Klik titik awal atau Enter untuk selesai.',
  furniture: 'Klik di denah untuk menaruh furnitur. Tahan Shift untuk menaruh beberapa sekaligus. Esc = batal.',
};

export function toolForKey(key: string): ToolName | undefined {
  return TOOLS.find((t) => t.key === key.toUpperCase())?.tool;
}

export function createToolbar(
  el: HTMLElement,
  paletteEl: HTMLElement,
  onTool: (t: ToolName) => void,
  groups: ToolbarAction[][],
): {
  setTool: (t: ToolName) => void;
  setEnabled: (id: string, enabled: boolean) => void;
  setPressed: (id: string, pressed: boolean) => void;
} {
  el.replaceChildren();

  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.textContent = 'REA';
  el.append(brand);

  // drawing tools live in the left palette, grouped like a CAD ribbon
  paletteEl.replaceChildren();
  const toolButtons = new Map<ToolName, HTMLButtonElement>();
  let section: HTMLElement | undefined;
  let current = '';
  for (const t of TOOLS) {
    if (t.group !== current) {
      current = t.group;
      section = document.createElement('section');
      const h = document.createElement('h2');
      h.textContent = t.group;
      section.append(h);
      paletteEl.append(section);
    }
    const b = button(t.label, `${t.label} (${t.key})`, () => onTool(t.tool));
    const key = document.createElement('kbd');
    key.textContent = t.key;
    b.append(key);
    toolButtons.set(t.tool, b);
    section!.append(b);
  }

  const actionButtons = new Map<string, HTMLButtonElement>();
  for (const actions of groups) {
    const g = group(el);
    for (const a of actions) {
      const b = button(a.label, a.title ?? a.label, a.run);
      b.dataset.action = a.id;
      actionButtons.set(a.id, b);
      g.append(b);
    }
  }

  return {
    setTool(t) {
      for (const [name, b] of toolButtons) b.setAttribute('aria-pressed', String(name === t));
    },
    setEnabled(id, enabled) {
      const b = actionButtons.get(id);
      if (b) b.disabled = !enabled;
    },
    setPressed(id, pressed) {
      actionButtons.get(id)?.setAttribute('aria-pressed', String(pressed));
    },
  };
}

function group(parent: HTMLElement): HTMLElement {
  const g = document.createElement('div');
  g.className = 'group';
  parent.append(g);
  return g;
}

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.title = title;
  // never take focus, so Space/Enter keep going to the drawing instead of re-clicking the button
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    onClick();
    b.blur();
  });
  return b;
}
