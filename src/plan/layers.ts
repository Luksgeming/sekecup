export const LAYERS = [
  { id: 'walls', label: 'Dinding' },
  { id: 'hatch', label: 'Arsiran' },
  { id: 'openings', label: 'Pintu & jendela' },
  { id: 'rooms', label: 'Ruangan' },
  { id: 'furniture', label: 'Furnitur' },
  { id: 'dimensions', label: 'Dimensi' },
  { id: 'schedule', label: 'Jadwal ruangan' },
] as const;

export type LayerId = (typeof LAYERS)[number]['id'];
export type LayerState = Record<LayerId, boolean>;

import type { Project } from '../model/types';

/** The drawing as far as clicking is concerned: whatever sits on a hidden layer can't be picked. */
export function visibleForPicking(p: Project, layers: LayerState): Project {
  if (layers.walls && layers.openings && layers.rooms && layers.furniture) return p;
  return {
    ...p,
    walls: layers.walls ? p.walls : [],
    openings: layers.walls && layers.openings ? p.openings : [],
    rooms: layers.rooms ? p.rooms : [],
    furniture: layers.furniture ? p.furniture : [],
  };
}

type KeyStore = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'rea:layers';

const browserStore = (): KeyStore | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** Which layers are shown; all of them unless the viewer hid some on this device. */
export function loadLayers(store: KeyStore | undefined = browserStore()): LayerState {
  const state = Object.fromEntries(LAYERS.map((l) => [l.id, true])) as LayerState;
  try {
    const saved = JSON.parse(store?.getItem(KEY) ?? '{}');
    for (const l of LAYERS) if (saved[l.id] === false) state[l.id] = false;
  } catch {
    // unreadable storage: show everything
  }
  return state;
}

export function saveLayers(state: LayerState, store: KeyStore | undefined = browserStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage blocked: the choice lasts until reload
  }
}
