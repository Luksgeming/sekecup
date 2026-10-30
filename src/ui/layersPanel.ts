import { LAYERS, saveLayers, type LayerId, type LayerState } from '../plan/layers';

/** Layer list with a show/hide switch per layer, like a CAD layer manager. */
export function createLayersPanel(el: HTMLElement, initial: LayerState, onChange: (s: LayerState) => void): void {
  let state = initial;
  const h = document.createElement('h2');
  h.textContent = 'Layer';
  const list = document.createElement('ul');
  for (const layer of LAYERS) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = `layer-${layer.id}`;
    box.checked = state[layer.id];
    box.addEventListener('change', () => {
      state = { ...state, [layer.id as LayerId]: box.checked };
      saveLayers(state);
      onChange(state);
    });
    label.append(box, layer.label);
    li.append(label);
    list.append(li);
  }
  el.replaceChildren(h, list);
}
