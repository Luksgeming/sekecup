# Tahap 1: Gambar Rumah (Implementation Plan)


**Goal:** Aplikasi web/offline/desktop untuk menggambar denah rumah 2D yang otomatis tampil sebagai 3D, lengkap dengan pintu, jendela, ruangan, simpan lokal, dan export.

**Architecture:** Semua data ada di satu objek `Project` (data murni, immutable). Fungsi murni di `src/model` dan `src/geometry` mengubah atau menghitung data. Tampilan 2D (Canvas 2D) dan 3D (Three.js) hanya membaca `Project` dan digambar ulang setiap kali ada perubahan. `Store` menyimpan state, riwayat undo, dan memberi tahu pendengar (listener).

**Tech Stack:** Vite 6, TypeScript 5 (strict), Three.js r170, Vitest, idb-keyval, vite-plugin-pwa, Tauri 2.

**Spec:** `docs/specs/2026-10-30-rea-design.md`

## Global Constraints

- Satuan internal **meter**. Grid snap 0.1 m, snap ke ujung dinding dalam radius 0.2 m.
- Default dinding: `thickness = 0.15`, `height = 2.8`.
- Default pintu: `width = 0.9`, `height = 2.1`, `sill = 0`. Default jendela: `width = 1.2`, `height = 1.2`, `sill = 0.9`.
- Data `Project` immutable: setiap operasi mengembalikan objek baru.
- File project: ekstensi `.rea.json`, field `version: 1`.
- Teks UI dalam Bahasa Indonesia.
- Tanpa backend; semua jalan offline.

## Review Focus

1. Klik dua kali di titik yang sama (dinding panjang 0) → diabaikan, tidak membuat dinding.
2. Pintu/jendela lebih lebar dari dinding, keluar dari ujung dinding, atau tumpang tindih dengan bukaan lain → ditolak, project tidak berubah.
3. Import file rusak, bukan JSON, atau versi tidak dikenal → pesan error, project lama tetap utuh.
4. IndexedDB tidak tersedia (mode private) → aplikasi tetap jalan, muncul peringatan "tidak tersimpan otomatis".
5. Hapus dinding → semua pintu/jendela di dinding itu ikut terhapus (tidak ada bukaan yatim).

---

## Struktur File

```
src/
  model/types.ts        tipe data Project, Wall, Opening, Room
  model/project.ts      operasi: tambah/hapus dinding, bukaan, ruangan
  model/store.ts        state + undo/redo + listener
  geometry/vec.ts       operasi vektor 2D
  geometry/snap.ts      snap grid, ujung dinding, ortho
  geometry/polygon.ts   luas poligon
  geometry/wallBoxes.ts potongan kotak dinding di sekitar bukaan
  plan/PlanView.ts      kanvas 2D: render + input mouse
  plan/tools.ts         logika alat: wall, door, window, room, select
  view3d/View3D.ts      scene Three.js + orbit
  view3d/buildMeshes.ts Project → mesh Three.js
  storage/autosave.ts   IndexedDB autosave
  io/projectFile.ts     serialisasi/validasi .rea.json
  io/dxf.ts             export DXF
  io/glb.ts             export GLB
  ui/toolbar.ts         tombol alat dan aksi
  main.ts               menyatukan semuanya
tests/                  cermin struktur src/ untuk fungsi murni
src-tauri/              wrapper desktop
```

---

### Task 1: Scaffold + Model Data

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/model/types.ts`, `src/model/project.ts`, `src/geometry/vec.ts`
- Test: `tests/model/project.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Vec2 = { x: number; y: number };
  type Wall = { id: string; a: Vec2; b: Vec2; thickness: number; height: number };
  type OpeningType = 'door' | 'window';
  type Opening = { id: string; wallId: string; type: OpeningType; offset: number; width: number; height: number; sill: number };
  // offset = jarak (m) dari titik a ke tengah bukaan, sepanjang dinding
  type Room = { id: string; name: string; points: Vec2[] };
  type Project = { version: 1; name: string; walls: Wall[]; openings: Opening[]; rooms: Room[] };

  emptyProject(name?: string): Project
  addWall(p: Project, a: Vec2, b: Vec2): Project            // abaikan jika panjang < 0.01
  removeWall(p: Project, wallId: string): Project            // ikut hapus opening-nya
  addOpening(p: Project, o: Omit<Opening, 'id'>): Project | { error: string }
  removeOpening(p: Project, id: string): Project
  addRoom(p: Project, name: string, points: Vec2[]): Project | { error: string } // < 3 titik → error
  removeRoom(p: Project, id: string): Project
  // vec.ts
  sub, add, scale, length, dist, normalize(v): Vec2|number
  ```
  ID dibuat dengan `crypto.randomUUID()`.

- [ ] **Step 1:** `npm create vite@latest . -- --template vanilla-ts`, lalu `npm i three idb-keyval` dan `npm i -D vitest @types/three vite-plugin-pwa`. Tambah script `"test": "vitest run"`.
- [ ] **Step 2: Tes gagal** di `tests/model/project.test.ts`:
  - `addWall` dengan a = b → project sama persis (`toBe` referensi lama).
  - `addWall({0,0},{4,0})` → 1 dinding, thickness 0.15, height 2.8.
  - `removeWall` menghapus dinding **dan** opening dengan `wallId` tersebut.
  - `addOpening` lebar 5 di dinding 4 m → `{ error }`.
  - `addOpening` dua pintu tumpang tindih (offset 1.0 dan 1.5, lebar 0.9) → bukaan kedua `{ error }`.
  - `addOpening` offset 0.3, lebar 0.9 (keluar dari ujung a) → `{ error }`.
  - `addRoom` dengan 2 titik → `{ error }`.
- [ ] **Step 3:** `npm test`, harus FAIL.
- [ ] **Step 4:** Implementasi `types.ts`, `vec.ts`, `project.ts`. Validasi bukaan: `offset - width/2 >= 0`, `offset + width/2 <= panjangDinding`, dan rentang tidak beririsan dengan bukaan lain di dinding yang sama.
- [ ] **Step 5:** `npm test`, harus PASS.
- [ ] **Step 6:** `git add -A && git commit -m "feat: scaffold and project data model"`

---

### Task 2: Geometri (snap, luas, potongan dinding)

**Files:**
- Create: `src/geometry/snap.ts`, `src/geometry/polygon.ts`, `src/geometry/wallBoxes.ts`
- Test: `tests/geometry/*.test.ts`

**Interfaces:**
- Consumes: tipe dari Task 1.
- Produces:
  ```ts
  snapPoint(p: Vec2, opts: { walls: Wall[]; from?: Vec2; ortho: boolean; grid?: number; radius?: number }): Vec2
  polygonArea(points: Vec2[]): number   // selalu positif, m²
  type Box = { start: number; end: number; bottom: number; top: number } // sepanjang dinding (m) dan tinggi (m)
  wallBoxes(wall: Wall, openings: Opening[]): Box[]
  projectOnWall(wall: Wall, p: Vec2): { offset: number; distance: number }
  ```

- [ ] **Step 1: Tes gagal:**
  - `snapPoint({1.04, 2.96})` → `{1.0, 3.0}`.
  - Ujung dinding di `{2,2}`, titik `{2.15, 1.9}` → `{2,2}` (snap ujung menang dari grid).
  - `ortho: true, from {0,0}`, titik `{3, 0.4}` → `{3, 0}`.
  - `polygonArea` persegi 4×3 → `12`, urutan searah jarum jam juga `12`.
  - `wallBoxes` dinding 4 m tanpa bukaan → `[{0,4,0,2.8}]`.
  - Dinding 4 m + jendela offset 2, lebar 1.2, sill 0.9, tinggi 1.2 → 4 box: `{0,1.4,0,2.8}`, `{1.4,2.6,0,0.9}`, `{1.4,2.6,2.1,2.8}`, `{2.6,4,0,2.8}`.
  - Pintu sill 0, tinggi 2.1 → **tidak ada** box bawah dengan tinggi 0.
  - `projectOnWall` dinding (0,0)-(4,0), titik (1,0.5) → `{offset: 1, distance: 0.5}`.
- [ ] **Step 2:** `npm test`, harus FAIL.
- [ ] **Step 3:** Implementasi. `wallBoxes` mengurutkan bukaan berdasarkan offset, lalu membuat box penuh untuk celah, plus box bawah/atas untuk tiap bukaan. Box dengan tinggi atau panjang ≤ 0 dibuang.
- [ ] **Step 4:** `npm test`, harus PASS.
- [ ] **Step 5:** Commit `feat: geometry helpers (snap, area, wall boxes)`.

---

### Task 3: Store + Undo/Redo

**Files:**
- Create: `src/model/store.ts`
- Test: `tests/model/store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  class Store {
    constructor(initial: Project)
    get project(): Project
    apply(next: Project): void        // abaikan jika next === project sekarang
    undo(): void; redo(): void
    canUndo: boolean; canRedo: boolean
    load(p: Project): void            // ganti project, kosongkan riwayat
    subscribe(fn: (p: Project) => void): () => void
  }
  ```
  Riwayat maksimum 200 langkah.

- [ ] **Step 1: Tes gagal:** apply → undo → kembali ke awal; redo → maju lagi; apply setelah undo menghapus redo; apply objek yang sama tidak menambah riwayat; listener dipanggil sekali per perubahan; `load` mengosongkan undo.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: store with undo/redo`.

---

### Task 4: Tampilan Denah 2D + Alat Gambar

**Files:**
- Create: `src/plan/PlanView.ts`, `src/plan/tools.ts`, `src/ui/toolbar.ts`, `src/main.ts`, `src/style.css`
- Test: `tests/plan/tools.test.ts` (logika alat tanpa DOM)

**Interfaces:**
- Consumes: `Store`, `snapPoint`, `projectOnWall`, `polygonArea`, operasi project.
- Produces:
  ```ts
  type ToolName = 'select' | 'wall' | 'door' | 'window' | 'room';
  type ToolState = { tool: ToolName; draft: Vec2[]; hoverWallId?: string; selected?: { kind: 'wall'|'opening'|'room'; id: string } };
  handleClick(state: ToolState, p: Project, world: Vec2, mods: { shift: boolean }): { state: ToolState; project: Project; message?: string }
  handleKey(state: ToolState, p: Project, key: string): { state: ToolState; project: Project }
  class PlanView { constructor(canvas: HTMLCanvasElement, store: Store); setTool(t: ToolName): void }
  ```

Perilaku alat:
- **wall**: klik titik demi titik, membentuk dinding berantai; `Escape` selesai; dinding baru mulai dari ujung yang terakhir.
- **door/window**: klik dekat dinding (≤ 0.3 m) → bukaan di posisi `projectOnWall`. Kalau ditolak, tampilkan `message` (mis. "Tidak muat di dinding ini").
- **room**: klik titik-titik poligon, klik titik pertama atau `Enter` untuk selesai, lalu `prompt` nama ruangan.
- **select**: klik untuk memilih, `Delete`/`Backspace` untuk menghapus. `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` redo.
- Kanvas: pan (drag tombol tengah / spasi+drag), zoom (scroll), grid 1 m dan 0.1 m, label panjang dinding, label nama + luas ruangan.

- [ ] **Step 1: Tes gagal** untuk `handleClick`/`handleKey`: wall dua klik → 1 dinding, draft lanjut dari titik kedua; `Escape` mengosongkan draft; door 1 m dari dinding → tidak ada bukaan; door yang tidak muat → `message` terisi dan project tidak berubah; room 4 titik + Enter → 1 ruangan.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi `tools.ts`, lalu `PlanView`, toolbar, dan `main.ts`. **Step 4:** PASS.
- [ ] **Step 5: Cek manual:** `npm run dev`, gambar kotak 4×3 m, tambah pintu dan jendela, buat ruangan "Kamar"; terlihat label "12.00 m²".
- [ ] **Step 6:** Commit `feat: 2D plan view and drawing tools`.

---

### Task 5: Tampilan 3D

**Files:**
- Create: `src/view3d/buildMeshes.ts`, `src/view3d/View3D.ts`
- Modify: `src/main.ts` (tata letak terbagi 2D | 3D, tombol "2D / 3D / Keduanya")
- Test: `tests/view3d/buildMeshes.test.ts`

**Interfaces:**
- Consumes: `wallBoxes`, `Project`.
- Produces:
  ```ts
  buildMeshes(p: Project): THREE.Group   // nama group "house"; anak: mesh dinding (1 per Box), lantai ruangan, kaca jendela (transparan)
  class View3D { constructor(container: HTMLElement, store: Store); dispose(): void; get scene(): THREE.Scene }
  ```
  Sumbu: denah (x, y) → Three.js (x, 0, y); tinggi = sumbu Y.

- [ ] **Step 1: Tes gagal:** project 1 dinding 4 m tanpa bukaan → 1 mesh dinding dengan bounding box lebar 4, tinggi 2.8; dengan 1 jendela → 4 mesh dinding + 1 mesh kaca; 1 ruangan → 1 mesh lantai.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi (BoxGeometry diputar sesuai arah dinding; lantai pakai ShapeGeometry; OrbitControls, lampu ambient + directional, bayangan). Group lama di-dispose saat project berubah. **Step 4:** PASS.
- [ ] **Step 5: Cek manual:** gambar di 2D dan 3D ikut berubah; lubang pintu/jendela terlihat.
- [ ] **Step 6:** Commit `feat: live 3D view`.

---

### Task 6: Simpan Otomatis + File Project

**Files:**
- Create: `src/storage/autosave.ts`, `src/io/projectFile.ts`
- Modify: `src/ui/toolbar.ts` (tombol Baru, Buka, Simpan File), `src/main.ts`
- Test: `tests/io/projectFile.test.ts`

**Interfaces:**
- Produces:
  ```ts
  serializeProject(p: Project): string
  parseProject(text: string): Project | { error: string }
  startAutosave(store: Store): Promise<{ ok: boolean }>   // muat project terakhir; simpan 500 ms setelah perubahan
  ```

- [ ] **Step 1: Tes gagal:** serialize → parse menghasilkan project yang sama; teks bukan JSON → `{ error }`; `version: 2` → `{ error: "Versi file tidak didukung" }`; dinding tanpa `a` → `{ error }`; opening dengan `wallId` yang tidak ada → `{ error }`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi. `startAutosave` memakai `idb-keyval` dengan key `"rea:current"`; jika IndexedDB melempar error → `{ ok: false }`, dan `main.ts` menampilkan banner "Tidak tersimpan otomatis di browser ini". Import yang gagal menampilkan pesan error tanpa mengubah store. **Step 4:** PASS.
- [ ] **Step 5: Cek manual:** gambar, reload halaman, gambar masih ada; Simpan File → Buka file yang sama berhasil.
- [ ] **Step 6:** Commit `feat: autosave and project files`.

---

### Task 7: Export DXF dan GLB

**Files:**
- Create: `src/io/dxf.ts`, `src/io/glb.ts`
- Modify: `src/ui/toolbar.ts` (menu Export)
- Test: `tests/io/dxf.test.ts`

**Interfaces:**
- Produces:
  ```ts
  projectToDxf(p: Project): string        // DXF R12 ASCII, unit meter
  exportGlb(group: THREE.Group): Promise<Blob>   // GLTFExporter, binary
  ```
  DXF: setiap dinding jadi 2 `LINE` (sisi kiri/kanan, tebal sesuai `thickness`) di layer `WALLS`; bukaan → `LINE` di layer `OPENINGS`; ruangan → `LWPOLYLINE` tertutup di layer `ROOMS` + `TEXT` nama.

- [ ] **Step 1: Tes gagal:** project 1 dinding → output diawali `0\nSECTION` dan diakhiri `0\nEOF`, berisi tepat 2 entitas `LINE` di layer `WALLS`; 1 ruangan → 1 `LWPOLYLINE` dan 1 `TEXT` berisi nama ruangan.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi. **Step 4:** PASS.
- [ ] **Step 5: Cek manual:** file DXF terbuka di LibreCAD atau viewer DXF online; GLB terbuka di https://gltf-viewer.donmccurdy.com.
- [ ] **Step 6:** Commit `feat: DXF and GLB export`.

---

### Task 8: PWA Offline

**Files:**
- Modify: `vite.config.ts` (vite-plugin-pwa, `registerType: 'autoUpdate'`, precache semua aset build)
- Create: `public/icon-192.png`, `public/icon-512.png`

- [ ] **Step 1:** Konfigurasi plugin dan manifest (`name: "REA"`, `display: "standalone"`).
- [ ] **Step 2:** `npm run build && npm run preview`, buka aplikasi, matikan jaringan di DevTools, lalu reload. Aplikasi harus tetap tampil dan gambar tetap ada.
- [ ] **Step 3:** `npm test`, harus semua PASS. Commit `feat: offline PWA`.

---

### Task 9: Desktop (Tauri)

**Files:**
- Create: `src-tauri/` (via `npm create tauri-app` mode "existing project" / `npx tauri init`)

- [ ] **Step 1:** Pasang Rust (`curl https://sh.rustup.rs -sSf | sh`, **belum terpasang** di Mac ini) dan `npm i -D @tauri-apps/cli@^2`.
- [ ] **Step 2:** `npx tauri init` dengan `frontendDist: ../dist`, `devUrl: http://localhost:5173`, judul jendela "REA", identifier `id.co.alugra.rea`.
- [ ] **Step 3:** `npx tauri dev`: jendela desktop terbuka, gambar, tutup, buka lagi, dan gambar masih ada (IndexedDB di WebView).
- [ ] **Step 4:** `npx tauri build`, menghasilkan `.dmg` di `src-tauri/target/release/bundle/`.
- [ ] **Step 5:** Commit `feat: Tauri desktop app`.

---

## Roadmap (rencana terpisah nanti)

- **Tahap 2, Interior:** katalog furnitur (model GLB), drag & drop di 2D/3D, rotasi, material lantai/dinding, palet warna.
- **Tahap 3, AI:** upload foto ruangan → analisis gaya & rekomendasi (AI vision API) → gambar contoh hasil; butuh internet dan API key.
