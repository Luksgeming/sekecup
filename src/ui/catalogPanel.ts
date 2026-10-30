import { FURNITURE, FURNITURE_KINDS, type FurnitureCategory, type FurnitureKind } from '../interior/kinds';

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

  const groups = new Map<FurnitureCategory, FurnitureKind[]>();
  for (const kind of FURNITURE_KINDS) {
    const cat = FURNITURE[kind].category;
    groups.set(cat, [...(groups.get(cat) ?? []), kind]);
  }

  for (const [category, kinds] of groups) {
    const h = document.createElement('h3');
    h.textContent = category;
    const list = document.createElement('div');
    list.className = 'catalog-list';
    for (const kind of kinds) {
      const spec = FURNITURE[kind];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'catalog-item';
      const dot = document.createElement('span');
      dot.className = 'catalog-dot';
      dot.style.background = spec.color;
      const text = document.createElement('span');
      text.textContent = spec.label;
      const size = document.createElement('small');
      size.textContent = `${spec.size.w} × ${spec.size.d} m`;
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
