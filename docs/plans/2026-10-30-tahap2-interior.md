# Tahap 2: Desain Interior

**Tujuan:** Mengisi rumah dengan furnitur, mewarnai dinding, dan memilih material lantai. Semuanya tampil di 2D dan 3D, ikut tersimpan, dan ikut ter-export.

**Dasar:** spec `docs/specs/2026-10-30-rea-design.md`, kode tahap 1.5 di `main`.

## Keputusan

- Furnitur dibuat dari bentuk sederhana (kotak, silinder) di kode sendiri, tanpa file model dari luar. Ringan, jalan offline, dan bebas masalah lisensi.
- Dinding punya satu warna (kedua sisi sama). Lantai dipilih per ruangan.
- File project naik ke `version: 2`. File `version: 1` tetap bisa dibuka (otomatis diberi nilai bawaan).
- Satuan meter, rotasi dalam derajat (0–359).

## Hal yang paling mungkin bikin masalah

1. File lama (versi 1) gagal dibuka → harus tetap terbuka, dengan dinding putih, lantai keramik, dan tanpa furnitur.
2. Furnitur dihapus/digeser lalu di-undo → kembali utuh dalam satu langkah.
3. Warna dari file yang diedit tangan bukan format `#rrggbb` → ditolak saat membuka file.
4. Furnitur diputar 90° → kotak pilihnya (2D) dan bentuk 3D-nya ikut berputar dengan benar.
5. Kode jenis furnitur yang tidak dikenal di file → ditolak dengan pesan, bukan crash.

---

### Task 1: Data model v2

**File:** `src/model/types.ts`, `src/model/project.ts`, `src/io/projectFile.ts`, tes `tests/model/furniture.test.ts`, `tests/io/projectFile.test.ts`

```ts
type FloorMaterial = 'keramik' | 'kayu' | 'marmer' | 'karpet' | 'beton';
type Wall = { …; color: string };              // default '#f2efe8'
type Room = { …; floor: FloorMaterial };        // default 'keramik'
type Furniture = { id; kind: FurnitureKind; x; y; rotation: number; color: string };
type Project = { version: 2; …; furniture: Furniture[] };

addFurniture(p, kind, at: Vec2): Project
moveFurniture(p, id, to: Vec2): Project
updateFurniture(p, id, patch: { rotation?: number; color?: string }): Project | Failure
removeFurniture(p, id): Project
setWallColor(p, id, color): Project | Failure
setRoomFloor(p, id, floor): Project | Failure
```

- [ ] Tes: tambah/geser/putar/hapus; rotasi dinormalkan ke 0–359; warna non-`#rrggbb` ditolak; nilai sama → project yang sama.
- [ ] Tes: file v1 terbuka sebagai v2 dengan nilai bawaan; jenis furnitur tak dikenal ditolak; warna salah ditolak.

### Task 2: Katalog furnitur

**File:** `src/interior/catalog.ts`, tes `tests/interior/catalog.test.ts`

Setiap jenis: `{ kind, label, category, size: { w, d, h }, color, build(): THREE.Group }`.
Kategori dan isi:
- **Kamar:** kasur single (1.0×2.0), kasur double (1.6×2.0), lemari (1.2×0.6), nakas (0.45×0.4)
- **Ruang tamu:** sofa 3 dudukan (2.0×0.9), kursi santai (0.8×0.8), meja tamu (1.0×0.6), rak TV (1.6×0.4), karpet (2.0×1.4)
- **Makan & dapur:** meja makan (1.6×0.9), kursi makan (0.45×0.5), kitchen set (2.4×0.6), kulkas (0.7×0.7)
- **Kamar mandi:** kloset (0.4×0.7), wastafel (0.6×0.45), bathtub (1.7×0.75), shower (0.9×0.9)
- **Lain-lain:** meja kerja (1.2×0.6), kursi kerja (0.55×0.55), rak buku (0.9×0.3), tanaman (0.4×0.4), lampu lantai (0.35×0.35)

- [ ] Tes: setiap jenis punya ukuran > 0, dan `build()` menghasilkan objek 3D yang ukurannya ±5 cm dari `size`.

### Task 3: 2D dan 3D

**File:** `src/plan/PlanView.ts`, `src/plan/tools.ts`, `src/view3d/buildMeshes.ts`, `src/geometry/footprint.ts`

```ts
footprint(f: Furniture): Vec2[]          // 4 sudut setelah diputar
furnitureAt(p, at: Vec2): Furniture | undefined
```

- [ ] Tes: footprint kasur double diputar 90° → lebar dan panjangnya tertukar; `furnitureAt` menemukan furnitur saat diklik di dalamnya.
- [ ] 2D: furnitur digambar sebagai kotak berlabel dengan simbol sederhana. Lantai ruangan diberi warna sesuai material. Furnitur yang dipilih bisa diseret, `R` memutar 90°.
- [ ] 3D: furnitur tampil, dinding sesuai warnanya, lantai bertekstur (dibuat dengan kode, tanpa gambar dari luar).
- [ ] Alat "Pilih" bisa memilih furnitur. Urutan prioritas: sudut → furnitur → bukaan → dinding → ruangan.

### Task 4: Katalog dan panel

**File:** `src/ui/catalogPanel.ts`, `src/ui/properties.ts`, `src/main.ts`, `src/style.css`

- [ ] Tombol "Furnitur" di toolbar membuka katalog (per kategori). Klik item, lalu klik di denah untuk menaruhnya.
- [ ] Panel properti furnitur: nama, rotasi (derajat), warna (palet + pilih bebas), tombol Hapus.
- [ ] Panel dinding: tambah pilihan warna. Panel ruangan: tambah pilihan material lantai.
- [ ] Palet warna dinding: putih tulang, abu muda, krem, sage, biru pastel, terakota, hitam arang.

### Task 5: Export dan rilis

- [ ] DXF: furnitur jadi kotak di layer `FURNITURE` beserta labelnya. GLB otomatis ikut.
- [ ] Semua tes lulus, build web dan desktop.
- [ ] Publikasikan versi web sebagai link yang bisa langsung dibuka tanpa install.
