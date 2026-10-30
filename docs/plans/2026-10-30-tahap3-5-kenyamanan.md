# Tahap 3.5: Tampilan 2D + 3D yang Nyaman

**Masalah dari pengguna:** di mode 2D + 3D tampilannya jelek dan susah untuk menata isi rumah, dan denah tidak bisa digeser.

**Yang ditemukan:**
1. Di 3D, dinding depan setinggi 2,8 m menutupi isi rumah; furnitur di dalam tidak terlihat.
2. 3D hanya untuk dilihat: furnitur tidak bisa dipilih, digeser, atau ditambahkan di sana.
3. Menggeser denah 2D butuh tombol tengah mouse atau Spasi+seret, jadi susah di trackpad.
4. Label panjang dinding di 2D jatuh di dalam ruangan dan menabrak furnitur.

## Perbaikan

### Task 1: Geser denah dengan mudah
- Alat **Pilih**: seret di area kosong = geser denah.
- Trackpad: geser dua jari = geser denah, cubit (pinch) = zoom. Roda mouse biasa tetap zoom.
- Tombol **Pusatkan** di pojok kanvas: denah kembali pas di layar.
- `wheelAction(e): 'zoom' | 'pan'` diuji: Ctrl/pinch → zoom; scroll piksel dengan geseran horizontal atau kecil → pan; roda bergerigi (deltaMode baris) → zoom.

### Task 2: 3D yang memperlihatkan isi rumah
- Mode **Dinding rendah** (bawaan aktif): dinding di 3D dipotong setinggi 1,2 m sehingga isi ruangan terlihat dari atas, seperti rumah boneka. Tombol di pojok 3D untuk beralih ke **Dinding penuh**.
- Kaca jendela ikut terpotong; pintu dan jendela tetap berlubang.
- Kamera awal lebih tinggi dan seluruh rumah masuk layar.
- Petunjuk kecil di 3D: "Seret: putar · Shift/klik kanan + seret: geser · Scroll: zoom".
- `buildMeshes(p, { wallCut })` diuji: tinggi dinding maksimum = `wallCut`; bagian di atas potongan tidak dibuat.

### Task 3: Menata furnitur langsung di 3D
- Klik furnitur di 3D = memilihnya (ikut terpilih di 2D dan panel kanan).
- Seret furnitur di 3D = menggesernya di lantai (satu langkah undo).
- Saat memilih dari katalog, klik lantai di 3D = taruh furnitur di situ.
- Furnitur terpilih diberi sorotan di 3D.
- `floorPoint(ray)` (titik potong sinar kamera dengan lantai) diuji.

### Task 4: Label 2D yang rapi
- Label panjang dinding ditaruh di sisi luar rumah, bukan di dalam ruangan.
- `labelSide(wall, center)` diuji: label menjauhi titik tengah rumah.

### Task 5: Rilis
- Review, build web + desktop, push, perbarui link, matikan server lokal.
