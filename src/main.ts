import './style.css';
import { emptyProject } from './model/project';
import { Store } from './model/store';
import { PlanView } from './plan/PlanView';
import { View3D } from './view3d/View3D';
import { createToolbar, TOOL_HINTS, toolForKey } from './ui/toolbar';

const store = new Store(emptyProject());

const toolbarEl = document.querySelector<HTMLElement>('#toolbar')!;
const planCanvas = document.querySelector<HTMLCanvasElement>('#plan')!;
const hintEl = document.querySelector<HTMLElement>('#hint')!;
const toastEl = document.querySelector<HTMLElement>('#toast')!;

const viewsEl = document.querySelector<HTMLElement>('#views')!;
const plan = new PlanView(planCanvas, store);
const view3d = new View3D(document.querySelector<HTMLElement>('#view3d-pane')!, store);

type ViewMode = '2d' | 'both' | '3d';
function setViewMode(mode: ViewMode): void {
  viewsEl.dataset.mode = mode;
  for (const m of ['2d', 'both', '3d'] as const) toolbar.setPressed(`view-${m}`, m === mode);
}

const toolbar = createToolbar(toolbarEl, (t) => plan.setTool(t), [
  [
    { id: 'undo', label: 'Undo', title: 'Undo (Ctrl/Cmd+Z)', run: () => store.undo() },
    { id: 'redo', label: 'Redo', title: 'Redo (Ctrl/Cmd+Shift+Z)', run: () => store.redo() },
  ],
  [
    { id: 'view-2d', label: '2D', title: 'Hanya denah', run: () => setViewMode('2d') },
    { id: 'view-both', label: '2D + 3D', title: 'Denah dan 3D', run: () => setViewMode('both') },
    { id: 'view-3d', label: '3D', title: 'Hanya 3D', run: () => setViewMode('3d') },
    { id: 'fit', label: 'Pas-kan', title: 'Arahkan kamera 3D ke seluruh rumah', run: () => view3d.fit() },
  ],
]);
setViewMode('both');

let toastTimer = 0;
export function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.hidden = true), 3000);
}

plan.onMessage = toast;
plan.onStateChange = (s) => {
  toolbar.setTool(s.tool);
  hintEl.textContent = TOOL_HINTS[s.tool];
};
plan.setTool('wall');

const syncHistory = () => {
  toolbar.setEnabled('undo', store.canUndo);
  toolbar.setEnabled('redo', store.canRedo);
};
store.subscribe(syncHistory);
syncHistory();

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) store.redo();
    else store.undo();
    return;
  }
  if (mod) return;
  if (plan.key(e.key)) {
    e.preventDefault();
    return;
  }
  const tool = toolForKey(e.key);
  if (tool) plan.setTool(tool);
});
