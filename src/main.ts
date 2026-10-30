import './style.css';
import { emptyProject } from './model/project';
import { Store } from './model/store';
import { PlanView } from './plan/PlanView';
import { createToolbar, TOOL_HINTS, toolForKey } from './ui/toolbar';

const store = new Store(emptyProject());

const toolbarEl = document.querySelector<HTMLElement>('#toolbar')!;
const planCanvas = document.querySelector<HTMLCanvasElement>('#plan')!;
const hintEl = document.querySelector<HTMLElement>('#hint')!;
const toastEl = document.querySelector<HTMLElement>('#toast')!;

const plan = new PlanView(planCanvas, store);

const toolbar = createToolbar(toolbarEl, (t) => plan.setTool(t), [
  [
    { id: 'undo', label: 'Undo', title: 'Undo (Ctrl/Cmd+Z)', run: () => store.undo() },
    { id: 'redo', label: 'Redo', title: 'Redo (Ctrl/Cmd+Shift+Z)', run: () => store.redo() },
  ],
]);

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
