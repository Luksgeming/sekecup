import './style.css';
import { emptyProject } from './model/project';
import { Store } from './model/store';
import { PlanView } from './plan/PlanView';
import { View3D } from './view3d/View3D';
import { startAutosave } from './storage/autosave';
import { parseProject, PROJECT_EXTENSION, serializeProject } from './io/projectFile';
import { projectToDxf } from './io/dxf';
import { exportGlb } from './io/glb';
import { downloadBlob, pickFile, safeFilename } from './io/download';
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

async function openProjectFile(): Promise<void> {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  const p = parseProject(await file.text());
  if ('error' in p) {
    toast(`Gagal membuka file: ${p.error}`);
    return;
  }
  store.load(p);
  view3d.fit();
  toast(`Dibuka: ${p.name}`);
}

function saveProjectFile(): void {
  const p = store.project;
  downloadBlob(new Blob([serializeProject(p)], { type: 'application/json' }), safeFilename(p.name) + PROJECT_EXTENSION);
}

function exportDxf(): void {
  const p = store.project;
  downloadBlob(new Blob([projectToDxf(p)], { type: 'application/dxf' }), `${safeFilename(p.name)}.dxf`);
}

async function exportModel(): Promise<void> {
  try {
    downloadBlob(await exportGlb(view3d.house3d), `${safeFilename(store.project.name)}.glb`);
  } catch {
    toast('Gagal export model 3D');
  }
}

function newProject(): void {
  if (store.project.walls.length && !window.confirm('Mulai gambar baru? Gambar sekarang akan diganti.')) return;
  store.load(emptyProject());
}

const toolbar = createToolbar(toolbarEl, (t) => plan.setTool(t), [
  [
    { id: 'new', label: 'Baru', title: 'Gambar baru', run: newProject },
    { id: 'open', label: 'Buka', title: 'Buka file .rea.json', run: () => void openProjectFile() },
    { id: 'save', label: 'Simpan File', title: 'Unduh file .rea.json', run: saveProjectFile },
  ],
  [
    { id: 'dxf', label: 'Export DXF', title: 'Denah 2D untuk AutoCAD', run: exportDxf },
    { id: 'glb', label: 'Export 3D', title: 'Model .glb untuk SketchUp/Blender', run: () => void exportModel() },
  ],
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
function toast(msg: string): void {
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

startAutosave(store).then(({ ok }) => {
  if (ok) return;
  const banner = document.createElement('div');
  banner.id = 'banner';
  banner.textContent = 'Tidak tersimpan otomatis di browser ini. Gunakan "Simpan File" agar gambar tidak hilang.';
  document.body.insertBefore(banner, document.querySelector('#views'));
});
