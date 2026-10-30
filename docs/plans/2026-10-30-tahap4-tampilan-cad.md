# Tahap 4: Tampilan 2D ala CAD

**Dari pengguna:** denah 2D dibuat seperti CADCraft (gambar kerja AutoCAD). Fitur 3D dan interior tetap.

## Tampilan yang dituju

- **Kanvas gelap** (biru-abu gelap) dengan grid halus, garis tipis berwarna seperti gambar CAD. Tombol **Gaya: CAD / Kertas** untuk kembali ke tampilan terang.
- **Dinding** digambar sebagai dua garis tepi dengan **arsiran diagonal** (pola ANSI31) di dalamnya.
- **Pintu**: daun pintu + busur bukaan (hijau). **Jendela**: tiga garis sejajar (cyan).
- **Ruangan**: nama HURUF BESAR dan luas (kuning), tanpa isian warna.
- **Dimensi otomatis** (cyan): setiap dinding luar diberi garis dimensi di sisi luar, lengkap dengan garis bantu dan tanda, angka dalam **milimeter** (mis. 6000).
- **Tabel jadwal ruangan** (ROOM SCHEDULE: Ruangan / Luas / Total) di samping denah, kuning.
- **Furnitur sebagai simbol garis**: kotak tepi + detail sederhana per jenis (kasur dengan bantal, sofa dengan sandaran dan lengan, meja dengan tepi dalam, lemari dengan tanda silang, benda bundar sebagai lingkaran, lampu plafon putus-putus).
- **Kompas** U/S/T/B di pojok kanvas, koordinat kursor (X, Y dalam mm) di status bar.

## Tata letak

- **Kiri – palet alat** berkelompok: *Gambar* (Dinding, Ruangan), *Bukaan* (Pintu, Jendela), *Furnitur*, *Ubah* (Pilih, Putar, Hapus).
- **Kanan – panel Layer + Properti**: layer bisa disembunyikan/ditampilkan (Dinding, Arsiran, Bukaan, Ruangan, Furnitur, Dimensi, Jadwal). Panel properti pindah ke sini dari kotak mengambang.
- **Bawah – command line**: menampilkan langkah alat aktif ("DINDING  Tentukan titik berikutnya atau ketik panjang:") dan menerima perintah ketik: `DINDING`/`W`, `PINTU`/`D`, `JENDELA`/`J`, `RUANG`/`R`, `FURNITUR`/`F`, `PILIH`/`V`, `ZOOM`/`Z` (pas), `UNDO`/`U`, `REDO`, angka panjang (`4500`, `4.5m`, `450cm`).
- Toolbar atas tetap untuk file, export, tampilan, dan Saran Interior.

## Keputusan

- Angka dimensi dan tabel memakai mm, sesuai gambar kerja di Indonesia; input panjang tetap menerima m/cm, dan angka tanpa satuan ≥ 100 dibaca sebagai mm di command line.
- Gaya CAD menjadi bawaan; pilihan disimpan per perangkat.
- Tidak menambah fitur drafting baru (perintah OFFSET/TRIM, snap objek, blok, paper space): itu di luar permintaan.

## Tugas (dengan tes)

1. `dimensionsFor(project)`: garis dimensi per dinding luar (posisi di sisi luar, teks mm). Tes.
2. `roomSchedule(project)`: baris ruangan + total, urut nama. Tes.
3. `parseCommand(text)`: perintah → alat/aksi/panjang, galat untuk teks tak dikenal. Tes.
4. `furnitureSymbol(kind)`: daftar garis/lingkaran simbol dalam koordinat lokal, cocok dengan ukuran katalog. Tes.
5. Layer: keadaan tampil/sembunyi per layer, disimpan per perangkat. Tes.
6. Gambar ulang PlanView dengan gaya CAD (arsiran, warna, simbol, dimensi, jadwal, kompas) + gaya Kertas.
7. Tata letak baru: palet kiri, panel kanan (Layer + Properti), command line bawah.
8. Cek di browser, review, build, push, perbarui link.
