import { parseLength } from '../geometry/length';
import { polygonArea } from '../geometry/polygon';
import { dist } from '../geometry/vec';
import { renameRoom, updateOpening, updateWall } from '../model/project';
import type { Store } from '../model/store';
import type { Failure, Project } from '../model/types';
import type { Selection } from '../plan/tools';

type Field = {
  label: string;
  value: string;
  /** Returns the new project, a failure, or undefined when the text is not a valid value. */
  commit: (text: string) => Project | Failure | undefined;
};

const m = (v: number) => `${v.toFixed(2)}`;

export function createPropertiesPanel(
  container: HTMLElement,
  store: Store,
  getSelection: () => Selection | undefined,
  onMessage: (msg: string) => void,
): { refresh: () => void } {
  const panel = document.createElement('aside');
  panel.className = 'properties';
  panel.hidden = true;
  container.append(panel);

  function fieldsFor(sel: Selection, p: Project): { title: string; fields: Field[]; note?: string } | undefined {
    const withLength = (fn: (v: number) => Project | Failure) => (text: string) => {
      const v = parseLength(text);
      return v === undefined ? undefined : fn(v);
    };

    if (sel.kind === 'wall') {
      const w = p.walls.find((x) => x.id === sel.id);
      if (!w) return undefined;
      return {
        title: 'Dinding',
        fields: [
          { label: 'Panjang (m)', value: m(dist(w.a, w.b)), commit: withLength((v) => updateWall(p, w.id, { length: v })) },
          { label: 'Tebal (m)', value: m(w.thickness), commit: withLength((v) => updateWall(p, w.id, { thickness: v })) },
          { label: 'Tinggi (m)', value: m(w.height), commit: withLength((v) => updateWall(p, w.id, { height: v })) },
        ],
      };
    }

    if (sel.kind === 'opening') {
      const o = p.openings.find((x) => x.id === sel.id);
      if (!o) return undefined;
      const fields: Field[] = [
        { label: 'Lebar (m)', value: m(o.width), commit: withLength((v) => updateOpening(p, o.id, { width: v, offset: o.offset - o.width / 2 + v / 2 })) },
        { label: 'Tinggi (m)', value: m(o.height), commit: withLength((v) => updateOpening(p, o.id, { height: v })) },
        {
          label: 'Jarak dari ujung dinding (m)',
          value: m(o.offset - o.width / 2),
          commit: (text) => {
            // 0 is a valid distance here, so parse it directly instead of with parseLength
            const v = Number(text.trim().replace(',', '.'));
            return text.trim() === '' || !Number.isFinite(v) ? undefined : updateOpening(p, o.id, { offset: v + o.width / 2 });
          },
        },
      ];
      if (o.type === 'window') {
        fields.splice(2, 0, {
          label: 'Tinggi ambang (m)',
          value: m(o.sill),
          commit: withLength((v) => updateOpening(p, o.id, { sill: v })),
        });
      }
      return { title: o.type === 'door' ? 'Pintu' : 'Jendela', fields };
    }

    const r = p.rooms.find((x) => x.id === sel.id);
    if (!r) return undefined;
    return {
      title: 'Ruangan',
      fields: [{ label: 'Nama', value: r.name, commit: (text) => renameRoom(p, r.id, text) }],
      note: `Luas ${polygonArea(r.points).toFixed(2)} m²`,
    };
  }

  function refresh(): void {
    if (panel.contains(document.activeElement)) return; // don't rebuild under the user's cursor
    const sel = getSelection();
    const view = sel && fieldsFor(sel, store.project);
    panel.hidden = !view;
    panel.replaceChildren();
    if (!view) return;

    const h = document.createElement('h2');
    h.textContent = view.title;
    panel.append(h);
    for (const f of view.fields) panel.append(fieldElement(f));
    if (view.note) {
      const note = document.createElement('p');
      note.textContent = view.note;
      panel.append(note);
    }
  }

  function fieldElement(f: Field): HTMLElement {
    const label = document.createElement('label');
    label.textContent = f.label;
    const input = document.createElement('input');
    input.value = f.value;
    input.autocomplete = 'off';
    label.append(input);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        input.value = f.value;
        input.blur();
      }
    });
    input.addEventListener('change', () => {
      const r = f.commit(input.value);
      if (r === undefined) onMessage('Nilai tidak valid');
      else if ('error' in r) onMessage(r.error);
      else store.apply(r);
    });
    // rebuild after blur so a rejected value snaps back to the stored one
    input.addEventListener('blur', () => queueMicrotask(refresh));
    return label;
  }

  return { refresh };
}
