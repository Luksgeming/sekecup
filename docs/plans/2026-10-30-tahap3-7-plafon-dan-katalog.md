# Tahap 3.7: Plafon dan Katalog Lebih Lengkap

**Dari pengguna:** belum ada plafon, dan furniturnya terlalu sedikit.

## Keputusan

- **Plafon per ruangan**, setinggi dinding (bawaan 2,8 m), dengan pilihan warna plafon di panel ruangan. Plafon hanya terlihat dari bawah/dalam, jadi tampilan dari atas tetap memperlihatkan isi rumah. Pada mode **Dinding rendah**, plafon dan lampu plafon disembunyikan.
- **Lihat dari dalam:** pilih ruangan, lalu tombol di 3D menaruh kamera setinggi mata (1,6 m) di tengah ruangan. Seret untuk menoleh, scroll untuk maju/mundur. Mode ini otomatis memakai dinding penuh.
- **Lampu plafon** (kategori baru *Lampu*) menempel di plafon secara otomatis; di denah 2D digambar dengan garis putus-putus.
- **Katalog bertambah ~40 model** realistis CC0 dari Poly Haven (total ~59), termasuk kategori baru *Dapur* (kompor) dan *Lampu*. Barang yang tetap belum ada model gratisnya (kitchen set lengkap, kulkas, kamar mandi, karpet) akan dipenuhi lewat fitur import `.glb` di tahap berikutnya.
- Data: ruangan mendapat `ceilingColor` (bawaan `#f7f6f2`); file lama otomatis diberi nilai bawaan.

## Tugas

1. Unduh dan kecilkan ~40 model baru + thumbnail, periksa arah hadapnya, tambahkan ke katalog dengan ukuran asli (tes ukuran yang sudah ada ikut memeriksa).
2. `mount: 'floor' | 'ceiling'` di katalog; lampu plafon diletakkan di `tinggiPlafon − tinggiLampu`. Tes posisi.
3. Plafon 3D per ruangan (satu sisi, menghadap ke bawah), tinggi = tinggi dinding tertinggi di sekitar ruangan (bawaan 2,8 m). Tes.
4. `ceilingColor` di model + file (migrasi) + pilihan warna di panel ruangan. Tes.
5. Tombol **Lihat dari dalam** di 3D. Cek di browser.
6. Review, build, push, perbarui link.
