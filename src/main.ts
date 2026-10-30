import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { emptyProject, isEmptyProject } from './model/project';
import { Store } from './model/store';
import { isTextField, PlanView } from './plan/PlanView';
import type { ToolName } from './plan/tools';
import { confirmDialog } from './ui/dialog';
import { createPropertiesPanel } from './ui/properties';
import { createCatalogPanel } from './ui/catalogPanel';
import { createAdvisor } from './ui/advisor';
import { applyRecommendation } from './model/project';
import { View3D } from './view3d/View3D';
import { startAutosave } from './storage/autosave';
import { parseProject, PROJECT_EXTENSION, serializeProject } from './io/projectFile';
import { projectToDxf } from './io/dxf';
import { exportGlb } from './io/glb';
import { pickFile, safeFilename, saveFile } from './io/download';
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

async function okToReplace(): Promise<boolean> {
  return isEmptyProject(store.project) || confirmDialog('Gambar sekarang akan diganti dan tidak bisa di-undo. Lanjutkan?', 'Ganti');
}

async function openProjectFile(): Promise<void> {
  if (!(await okToReplace())) return;
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

// the shareable preview build runs in a sandbox that blocks downloads and service workers
const PREVIEW = import.meta.env.VITE_PREVIEW === '1';

async function save(blob: Blob, filename: string): Promise<void> {
  if (PREVIEW) {
    toast('Menyimpan dan export file belum bisa di versi link ini. Gambar tetap tersimpan otomatis di browser.');
    return;
  }
  try {
    if (await saveFile(blob, filename)) toast(`Tersimpan: ${filename}`);
  } catch {
    toast('Gagal menyimpan file');
  }
}

function saveProjectFile(): void {
  const p = store.project;
  void save(new Blob([serializeProject(p)], { type: 'application/json' }), safeFilename(p.name) + PROJECT_EXTENSION);
}

function exportDxf(): void {
  const p = store.project;
  void save(new Blob([projectToDxf(p)], { type: 'application/dxf' }), `${safeFilename(p.name)}.dxf`);
}

async function exportModel(): Promise<void> {
  let blob: Blob;
  try {
    blob = await exportGlb(view3d.house3d);
  } catch {
    toast('Gagal export model 3D');
    return;
  }
  await save(blob, `${safeFilename(store.project.name)}.glb`);
}

async function newProject(): Promise<void> {
  if (!(await okToReplace())) return;
  store.load(emptyProject());
}

function undo(): void {
  plan.clearDraft();
  store.undo();
}

function redo(): void {
  plan.clearDraft();
  store.redo();
}

const catalog = createCatalogPanel(document.querySelector<HTMLElement>('#plan-pane')!, (kind) => plan.placeFurniture(kind));

function chooseTool(t: ToolName): void {
  if (t === 'furniture') {
    catalog.toggle();
    return;
  }
  catalog.hide();
  plan.setTool(t);
}

const advisor = createAdvisor({
  apply: (rec) => {
    const sel = plan.toolState.selected;
    const roomId = sel?.kind === 'room' ? sel.id : undefined;
    const next = applyRecommendation(store.project, rec, roomId);
    if (next === store.project) return store.project.walls.length ? 'Desain sudah sesuai saran ini' : 'Gambar dinding dan ruangan dulu, lalu terapkan saran';
    store.apply(next);
    return roomId ? 'Saran diterapkan ke ruangan terpilih. Undo untuk membatalkan.' : 'Saran diterapkan. Undo untuk membatalkan.';
  },
  place: (kind) => plan.placeFurniture(kind),
  toast,
});

const toolbar = createToolbar(toolbarEl, chooseTool, [
  [{ id: 'advisor', label: 'Saran AI', title: 'Saran interior dari foto ruangan', run: () => advisor.open() }],
  [
    { id: 'new', label: 'Baru', title: 'Gambar baru', run: () => void newProject() },
    { id: 'open', label: 'Buka', title: 'Buka file .rea.json', run: () => void openProjectFile() },
    { id: 'save', label: 'Simpan File', title: 'Unduh file .rea.json', run: saveProjectFile },
  ],
  [
    { id: 'dxf', label: 'Export DXF', title: 'Denah 2D untuk AutoCAD', run: exportDxf },
    { id: 'glb', label: 'Export 3D', title: 'Model .glb untuk SketchUp/Blender', run: () => void exportModel() },
  ],
  [
    { id: 'undo', label: 'Undo', title: 'Undo (Ctrl/Cmd+Z)', run: () => undo() },
    { id: 'redo', label: 'Redo', title: 'Redo (Ctrl/Cmd+Shift+Z)', run: () => redo() },
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

const properties = createPropertiesPanel(document.querySelector<HTMLElement>('#plan-pane')!, store, () => plan.toolState.selected, toast);
store.subscribe(() => properties.refresh());

plan.onMessage = toast;
plan.onStateChange = (s) => {
  toolbar.setTool(s.tool);
  hintEl.textContent = TOOL_HINTS[s.tool];
  properties.refresh();
};
plan.setTool('wall');

const syncHistory = () => {
  toolbar.setEnabled('undo', store.canUndo);
  toolbar.setEnabled('redo', store.canRedo);
};
store.subscribe(syncHistory);
syncHistory();

window.addEventListener('keydown', (e) => {
  if (isTextField(e.target)) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (mod) return;
  if (plan.key(e.key)) {
    e.preventDefault();
    return;
  }
  if (!e.altKey && plan.startLengthInput(e.key)) {
    e.preventDefault();
    return;
  }
  const tool = toolForKey(e.key);
  if (tool) chooseTool(tool);
});

function showStorageBanner(): void {
  if (document.querySelector('#banner')) return;
  const banner = document.createElement('div');
  banner.id = 'banner';
  banner.textContent = 'Tidak tersimpan otomatis di perangkat ini. Gunakan "Simpan File" agar gambar tidak hilang.';
  document.body.insertBefore(banner, document.querySelector('#views'));
}

startAutosave(store, undefined, { onWriteError: showStorageBanner }).then(({ ok, flush }) => {
  if (!ok) showStorageBanner();
  // save right away when the tab or window goes away, instead of waiting for the timer
  window.addEventListener('pagehide', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
});

if (!PREVIEW && !('__TAURI_INTERNALS__' in window)) registerSW({ immediate: true });
