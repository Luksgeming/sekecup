import type { ToolName } from './tools';

export type Command =
  | { kind: 'tool'; tool: ToolName }
  | { kind: 'action'; action: 'zoom' | 'undo' | 'redo' }
  | { kind: 'length'; meters: number }
  | { kind: 'unknown'; text: string };

const TOOLS: Record<string, ToolName> = {
  dinding: 'wall', w: 'wall', wall: 'wall',
  pintu: 'door', d: 'door', door: 'door',
  jendela: 'window', j: 'window', window: 'window',
  ruang: 'room', ruangan: 'room', r: 'room', room: 'room',
  furnitur: 'furniture', f: 'furniture',
  pilih: 'select', v: 'select', select: 'select',
};

const ACTIONS: Record<string, 'zoom' | 'undo' | 'redo'> = { zoom: 'zoom', z: 'zoom', pas: 'zoom', undo: 'undo', u: 'undo', redo: 'redo' };

/**
 * Reads what was typed on the command line. A bare number of 100 or more is millimeters,
 * as on a CAD drawing; a smaller one is meters. Units m, cm and mm are understood.
 */
export function parseCommand(input: string): Command {
  const text = input.trim();
  const word = text.toLowerCase();
  if (TOOLS[word]) return { kind: 'tool', tool: TOOLS[word] };
  if (ACTIONS[word]) return { kind: 'action', action: ACTIONS[word] };
  const m = word.replace(',', '.').match(/^(\d+(?:\.\d+)?|\.\d+)\s*(mm|cm|m)?$/);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2] ?? (n >= 100 ? 'mm' : 'm');
    const meters = n / { mm: 1000, cm: 100, m: 1 }[unit as 'mm' | 'cm' | 'm'];
    if (meters > 0) return { kind: 'length', meters: +meters.toFixed(6) };
  }
  return { kind: 'unknown', text };
}
