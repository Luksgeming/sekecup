import type { ToolName } from './tools';
import { parseDrawingLength } from '../geometry/length';

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

/** Reads what was typed on the command line; lengths follow parseDrawingLength. */
export function parseCommand(input: string): Command {
  const text = input.trim();
  const word = text.toLowerCase();
  if (TOOLS[word]) return { kind: 'tool', tool: TOOLS[word] };
  if (ACTIONS[word]) return { kind: 'action', action: ACTIONS[word] };
  const meters = parseDrawingLength(word);
  if (meters !== undefined) return { kind: 'length', meters };
  return { kind: 'unknown', text };
}
