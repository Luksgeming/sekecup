import { CATEGORY_ORDER, FURNITURE, FURNITURE_KINDS, isModern, type FurnitureCategory, type FurnitureKind } from '../interior/kinds';
import { MODEL_CREDITS } from '../interior/credits';

/** Who made the models: CC-BY requires naming the authors. */
function showCredits(): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog credits';
  const h = document.createElement('h2');
  h.textContent = 'Kredit model 3D';
  const intro = document.createElement('p');
  intro.textContent =
    'Furnitur klasik: Poly Haven (polyhaven.com), lisensi CC0. Furnitur modern: model Sketchfab lewat Objaverse, lisensi CC BY 4.0, oleh:';
  const list = document.createElement('ul');
  for (const c of MODEL_CREDITS) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = c.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = c.title;
    li.append(a, ` — ${c.author} (${c.license})`);
    list.append(li);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'primary';
  close.textContent = 'Tutup';
  close.addEventListener('click', () => dialog.close());
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  actions.append(close);
  dialog.append(h, intro, list, actions);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

export function createCatalogPanel(
  container: HTMLElement,
  onPick: (kind: FurnitureKind) => void,
): { toggle: () => void; hide: () => void; isOpen: () => boolean } {
  const panel = document.createElement('aside');
  panel.className = 'catalog';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Katalog furnitur');

  const head = document.createElement('div');
  head.className = 'catalog-head';
  const title = document.createElement('h2');
  title.textContent = 'Furnitur';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Tutup';
  close.addEventListener('click', () => (panel.hidden = true));
  head.append(title, close);
  panel.append(head);

  const credits = document.createElement('button');
  credits.type = 'button';
  credits.className = 'catalog-credits';
  credits.textContent = 'Kredit model';
  credits.addEventListener('click', showCredits);
  panel.append(credits);

  // sections in a fixed order, modern pieces first within each
  const groups = new Map<FurnitureCategory, FurnitureKind[]>(CATEGORY_ORDER.map((c) => [c, []]));
  for (const kind of FURNITURE_KINDS) groups.get(FURNITURE[kind].category)!.push(kind);
  for (const kinds of groups.values()) kinds.sort((a, b) => Number(isModern(b)) - Number(isModern(a)));

  for (const [category, kinds] of groups) {
    if (!kinds.length) continue;
    const h = document.createElement('h3');
    h.textContent = category;
    const list = document.createElement('div');
    list.className = 'catalog-list';
    for (const kind of kinds) {
      const spec = FURNITURE[kind];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'catalog-item';
      const dot = document.createElement('img');
      dot.className = 'catalog-thumb';
      dot.src = `${import.meta.env.BASE_URL}models/thumbs/${spec.model}.png`;
      dot.alt = '';
      dot.loading = 'lazy';
      const text = document.createElement('span');
      text.textContent = spec.label;
      const size = document.createElement('small');
      size.textContent = `${spec.size.w} × ${spec.size.d} m${isModern(kind) ? ' · modern' : ''}`;
      text.append(size);
      item.append(dot, text);
      item.addEventListener('click', () => {
        panel.hidden = true;
        onPick(kind);
      });
      list.append(item);
    }
    panel.append(h, list);
  }

  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    panel.hidden = true;
  });

  container.append(panel);
  return {
    toggle: () => {
      panel.hidden = !panel.hidden;
      // move keyboard focus into the list so it can be browsed right away
      if (!panel.hidden) panel.querySelector<HTMLButtonElement>('.catalog-item')?.focus();
    },
    hide: () => (panel.hidden = true),
    isOpen: () => !panel.hidden,
  };
}
