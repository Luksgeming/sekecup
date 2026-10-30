import type { ToolName } from '../plan/tools';

export type ToolbarAction = { id: string; label: string; title?: string; run: () => void };

const TOOLS: { tool: ToolName; label: string; key: string }[] = [
  { tool: 'select', label: 'Pilih', key: 'V' },
  { tool: 'wall', label: 'Dinding', key: 'W' },
  { tool: 'door', label: 'Pintu', key: 'D' },
  { tool: 'window', label: 'Jendela', key: 'J' },
  { tool: 'room', label: 'Ruangan', key: 'R' },
  { tool: 'furniture', label: 'Furnitur', key: 'F' },
];

export const TOOL_HINTS: Record<ToolName, string> = {
  select: 'Klik untuk memilih, Delete untuk menghapus. Seret sudut atau furnitur untuk memindah, R untuk memutar.',
  wall: 'Klik titik demi titik untuk menggambar dinding. Ketik angka (mis. 4.5) untuk panjang pasti. Shift = lurus. Esc = selesai.',
  door: 'Klik di dinding untuk memasang pintu.',
  window: 'Klik di dinding untuk memasang jendela.',
  room: 'Klik sudut-sudut ruangan, atau ketik panjang sisi. Klik titik awal atau Enter untuk selesai.',
  furniture: 'Klik di denah untuk menaruh furnitur yang dipilih.',
};

export function toolForKey(key: string): ToolName | undefined {
  return TOOLS.find((t) => t.key === key.toUpperCase())?.tool;
}

export function createToolbar(
  el: HTMLElement,
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

  const toolGroup = group(el);
  const toolButtons = new Map<ToolName, HTMLButtonElement>();
  for (const t of TOOLS) {
    const b = button(t.label, `${t.label} (${t.key})`, () => onTool(t.tool));
    toolButtons.set(t.tool, b);
    toolGroup.append(b);
  }

  const actionButtons = new Map<string, HTMLButtonElement>();
  for (const actions of groups) {
    const g = group(el);
    for (const a of actions) {
      const b = button(a.label, a.title ?? a.label, a.run);
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
