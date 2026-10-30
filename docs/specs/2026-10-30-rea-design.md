# REA: Aplikasi Desain Rumah & Interior

Tanggal: 2026-10-30

## Tujuan

Aplikasi buatan sendiri (bukan crack/salinan) untuk menggambar rumah dan desain interiornya, mirip SketchUp. Dipakai pribadi dan beberapa teman.

## Tahapan

1. **Gambar rumah**: denah 2D dinding → otomatis jadi 3D, pintu, jendela, ruangan.
2. **Desain interior**: furnitur, warna, material lantai/dinding.
3. **AI interior**: upload foto ruangan → rekomendasi gaya interior + gambar contoh.

Dikerjakan berurutan. Dokumen ini merinci tahap 1. Tahap 2 dan 3 akan punya rencana sendiri.

## Platform

- **Web**: dibuka di browser.
- **Offline**: PWA, data disimpan di perangkat (IndexedDB).
- **Desktop**: Tauri 2 (Windows/Mac), memakai kode web yang sama.
- Tahap 3 (AI) butuh internet.

## Tahap 1: Cakupan

- Gambar dinding di tampilan atas (2D), dengan snap ke grid 10 cm dan ke ujung dinding lain. Tahan Shift untuk garis lurus horizontal/vertikal.
- Dinding default: tebal 15 cm, tinggi 280 cm.
- Pintu (default lebar 90 cm, tinggi 210 cm) dan jendela (default lebar 120 cm, tinggi 120 cm, ambang 90 cm), ditempel di dinding.
- Ruangan: poligon yang digambar manual, punya nama, luasnya ditampilkan (m²), lantainya tampil di 3D.
- Tampilan 3D (orbit kamera) yang otomatis mengikuti denah, dengan lubang pintu/jendela.
- Pilih, hapus, undo/redo.
- Simpan otomatis di perangkat. Export/import file `.rea.json`.
- Export DXF (denah 2D, bisa dibuka di AutoCAD) dan GLB (model 3D, bisa dibuka di SketchUp/Blender).

## Bukan tujuan tahap 1

- Multi-lantai, atap, tangga.
- Kolaborasi online / akun pengguna.
- Import DWG/SKP.
- Furnitur (tahap 2), AI (tahap 3).

## Keputusan yang saya ambil (bisa diubah)

- Mulai dari denah 2D lalu jadi 3D (pengguna tidak sempat memilih).
- Satuan internal meter; tampilan dalam meter dan cm.
- Stack: Vite + TypeScript + Three.js, Vitest untuk tes.
