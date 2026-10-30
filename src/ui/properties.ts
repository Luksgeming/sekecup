import { parseLength } from '../geometry/length';
import { polygonArea } from '../geometry/polygon';
import { dist } from '../geometry/vec';
import { FLOOR_MATERIALS, FURNITURE, WALL_PALETTE, type FloorMaterial } from '../interior/kinds';
import { removeFurniture, renameRoom, setRoomFloor, setWallColor, updateFurniture, updateOpening, updateWall } from '../model/project';
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

type View = {
  title: string;
  fields: Field[];
  note?: string;
  /** Controls that act at once (swatches, menus, buttons) rather than on Enter. */
  extras?: HTMLElement[];
};

/** Like parseLength, but 0 is allowed (a distance or a floor-level sill). */
function zeroOrMore(text: string): number | undefined {
  return text.trim() !== '' && Number(text.trim().replace(',', '.')) === 0 ? 0 : parseLength(text);
}

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

  // every action reads the drawing at the moment it runs, never a copy from when the panel was built
  const apply = (fn: (p: Project) => Project | Failure) => {
    const r = fn(store.project);
    if ('error' in r) onMessage(r.error);
    else store.apply(r);
    // the clicked control keeps focus, which would block the rebuild that shows the new value
    (document.activeElement as HTMLElement | null)?.blur();
    refresh();
  };

  function fieldsFor(sel: Selection, p: Project): View | undefined {
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
        extras: [swatches('Warna dinding', WALL_PALETTE, w.color, (color) => apply((cur) => setWallColor(cur, w.id, color)))],
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
            const v = zeroOrMore(text);
            return v === undefined ? undefined : updateOpening(p, o.id, { offset: v + o.width / 2 });
          },
        },
      ];
      if (o.type === 'window') {
        fields.splice(2, 0, {
          label: 'Tinggi ambang (m)',
          value: m(o.sill),
          commit: (text) => {
            const v = zeroOrMore(text);
            return v === undefined ? undefined : updateOpening(p, o.id, { sill: v });
          },
        });
      }
      return { title: o.type === 'door' ? 'Pintu' : 'Jendela', fields };
    }

    if (sel.kind === 'furniture') {
      const f = p.furniture.find((x) => x.id === sel.id);
      if (!f) return undefined;
      const rotate = button('Putar 90°', () => apply((cur) => updateFurniture(cur, f.id, { rotation: f.rotation + 90 })));
      const remove = button('Hapus', () => apply((cur) => removeFurniture(cur, f.id)));
      remove.classList.add('danger');
      const row = document.createElement('div');
      row.className = 'row';
      row.append(rotate, remove);
      return {
        title: FURNITURE[f.kind].label,
        fields: [
          {
            label: 'Rotasi (derajat)',
            value: String(f.rotation),
            commit: (text) => {
              const v = Number(text.trim().replace(',', '.'));
              return text.trim() === '' || !Number.isFinite(v) ? undefined : updateFurniture(p, f.id, { rotation: v });
            },
          },
        ],
        extras: [
          row,
        ],
        note: `${FURNITURE[f.kind].size.w} × ${FURNITURE[f.kind].size.d} m`,
      };
    }

    const r = p.rooms.find((x) => x.id === sel.id);
    if (!r) return undefined;
    const floor = document.createElement('label');
    floor.textContent = 'Lantai';
    const select = document.createElement('select');
    for (const [value, { label }] of Object.entries(FLOOR_MATERIALS)) select.append(new Option(label, value, false, value === r.floor));
    select.addEventListener('change', () => apply((cur) => setRoomFloor(cur, r.id, select.value as FloorMaterial)));
    floor.append(select);
    return {
      title: 'Ruangan',
      fields: [{ label: 'Nama', value: r.name, commit: (text) => renameRoom(p, r.id, text) }],
      note: `Luas ${polygonArea(r.points).toFixed(2)} m²`,
      extras: [floor],
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
    view.fields.forEach((f, i) => panel.append(fieldElement(f, i)));
    panel.append(...(view.extras ?? []));
    if (view.note) {
      const note = document.createElement('p');
      note.textContent = view.note;
      panel.append(note);
    }
  }

  function fieldElement(f: Field, index: number): HTMLElement {
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
      // rebuild the field from the current drawing, so a save never undoes a newer change
      const sel = getSelection();
      const fresh = sel && fieldsFor(sel, store.project)?.fields[index];
      if (!fresh) return;
      const r = fresh.commit(input.value);
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

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function swatches(
  title: string,
  colors: { label: string; color: string }[],
  current: string,
  onPick: (color: string) => void,
  custom = false,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'swatches';
  const caption = document.createElement('span');
  caption.textContent = title;
  wrap.append(caption);
  const list = document.createElement('div');
  list.className = 'swatch-list';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', title);
  for (const { label, color } of colors) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = color;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-pressed', String(color.toLowerCase() === current.toLowerCase()));
    b.addEventListener('click', () => onPick(color));
    list.append(b);
  }
  if (custom) {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = current;
    input.title = 'Warna lain';
    input.setAttribute('aria-label', 'Warna lain');
    input.addEventListener('change', () => onPick(input.value));
    list.append(input);
  }
  wrap.append(list);
  return wrap;
}
