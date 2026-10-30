# Tahap 1.5: Rapikan Cara Menggambar

**Tujuan:** Menggambar rumah dengan ukuran yang presisi: ketik panjang dinding, ubah ukuran lewat panel, geser sudut dinding, dan beresi masalah kecil dari review tahap 1.

**Dasar:** `docs/specs/2026-10-30-rea-design.md` (tahap 1). Kode tahap 1 ada di `main`.

## Aturan umum

- Satuan internal tetap meter. Input menerima `4.5`, `4,5`, `450cm`, `450 cm`, `4.5m`.
- Setiap perubahan lewat fungsi murni di `src/model` dan bisa di-undo (satu langkah per perubahan).
- Perubahan yang membuat pintu/jendela tidak muat **ditolak** dengan pesan, project tidak berubah.
- Teks UI Bahasa Indonesia. Tes dulu (gagal), baru kode.

## Hal yang paling mungkin bikin masalah

1. Dinding dipendekkan sampai pintu/jendela tidak muat → ditolak dan muncul pesan, bukan pintu yang hilang diam-diam.
2. Sudut digeser ke titik yang sama dengan ujung lain (dinding jadi 0 m) → ditolak.
3. Input ukuran berisi huruf, kosong, nol, atau negatif → diabaikan dan muncul pesan.
4. Mengetik angka di panel tidak boleh memicu shortcut alat (W, D, Delete, dll).
5. Undo setelah geser sudut → semua dinding yang tersambung kembali bersamaan (satu langkah).

---

### Task 1: Ketik panjang dinding

**File:** `src/geometry/length.ts`, `src/plan/tools.ts`, `src/plan/PlanView.ts`, tes `tests/geometry/length.test.ts`, `tests/plan/tools.test.ts`

**Fungsi:**
```ts
parseLength(text: string): number | undefined      // meter; undefined jika tidak valid atau ≤ 0
pointAtLength(from: Vec2, toward: Vec2, length: number): Vec2
handleLengthInput(state: ToolState, p: Project, toward: Vec2, length: number, mods: { shift: boolean }): ToolResult
```

- [ ] Tes: `parseLength('4.5')`=4.5, `'4,5'`=4.5, `'450cm'`=4.5, `'450 cm'`=4.5, `'4.5m'`=4.5, `'abc'`/`''`/`'0'`/`'-2'` → undefined.
- [ ] Tes: `pointAtLength({0,0},{10,0},4.5)` → `{4.5,0}`; arah diagonal tetap panjang 4.5.
- [ ] Tes: draft di `{0,0}`, mouse di `{3,0.2}`, shift → dinding baru `{0,0}`–`{4.5,0}`, draft lanjut dari `{4.5,0}`.
- [ ] Implementasi. Di kanvas: saat alat Dinding/Ruangan punya draft, mengetik angka memunculkan kotak kecil di dekat kursor; Enter = pasang titik, Esc = batal.
- [ ] Cek di browser, commit `feat: type wall length`.

### Task 2: Panel properti

**File:** `src/model/project.ts`, `src/ui/properties.ts`, `src/main.ts`, `index.html`, `src/style.css`, tes `tests/model/project.test.ts`

**Fungsi:**
```ts
updateWall(p, id, patch: Partial<Pick<Wall,'thickness'|'height'>> & { length?: number }): Project | Failure
updateOpening(p, id, patch: Partial<Pick<Opening,'width'|'height'|'sill'|'offset'>>): Project | Failure
renameRoom(p, id, name: string): Project | Failure
```
`length` memindahkan titik `b` sepanjang arah dinding (titik `a` tetap).

- [ ] Tes: tebal 0.2 tersimpan; tinggi 2.0 ditolak jika ada pintu 2.1; panjang 1 m ditolak jika ada pintu di offset 2; lebar pintu yang menabrak jendela ditolak; nama ruangan kosong ditolak; nilai sama persis → project yang sama (tidak ada langkah undo).
- [ ] Panel di kanan kanvas 2D (lipat di layar kecil): muncul saat ada yang dipilih. Dinding: panjang, tebal, tinggi. Pintu/jendela: lebar, tinggi, ambang, posisi. Ruangan: nama + luas (baca saja). Simpan saat Enter/blur; nilai salah → pesan dan kembali ke nilai lama.
- [ ] Shortcut alat tidak aktif saat mengetik di panel.
- [ ] Cek di browser, commit `feat: properties panel`.

### Task 3: Geser sudut dinding

**File:** `src/model/project.ts`, `src/plan/tools.ts`, `src/plan/PlanView.ts`, tes model + tools

**Fungsi:**
```ts
moveCorner(p, from: Vec2, to: Vec2): Project | Failure   // semua ujung dinding yang sama dengan `from` (±1 mm) ikut pindah
cornerAt(p, at: Vec2, radius = 0.2): Vec2 | undefined
```

- [ ] Tes: dua dinding berbagi sudut → keduanya ikut; dinding jadi 0 m → ditolak; pintu tidak muat lagi → ditolak; titik ruangan yang sama dengan sudut ikut pindah.
- [ ] Alat Pilih: titik sudut tampil sebagai lingkaran kecil; seret = pratinjau, lepas = satu langkah undo (snap grid/ujung seperti menggambar). Ditolak → kembali ke posisi awal + pesan.
- [ ] Cek di browser, commit `feat: drag wall corners`.

### Task 4: Beresi masalah kecil dari review

- [ ] Pintu/jendela yang diklik dekat sudut digeser masuk sampai muat (offset dibatasi ke `[w/2, panjang − w/2]`). Tes di tools.
- [ ] Ruangan: titik kembar berurutan dibuang, luas < 0.01 m² ditolak. Tes di model.
- [ ] Enter/Delete/Backspace hanya "ditelan" kalau alat memakainya. Tes di tools (`handled` flag).
- [ ] Autosave: simpan langsung saat `pagehide`/`visibilitychange`; banner muncul jika menulis gagal; batas waktu 3 dtk saat membaca; data lama tidak menimpa gambar yang sudah dimulai. Tes di autosave.
- [ ] Area bayangan 3D mengikuti ukuran rumah.
- [ ] Desktop: CSP ketat di `tauri.conf.json`; service worker tidak didaftarkan di dalam Tauri.
- [ ] Semua tes lulus, build web + desktop, commit `fix: stage 1 polish`.

---

## Setelah selesai

Review oleh reviewer terpisah, perbaiki temuan penting, push ke `main`, lalu lanjut tahap 2 (interior).
