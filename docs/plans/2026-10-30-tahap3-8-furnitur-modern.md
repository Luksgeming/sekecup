# Tahap 3.8: Furnitur Modern

**Dari pengguna:** perkaya furnitur dengan yang modern; ambil saja asetnya.

## Sumber dan lisensi

- Model diambil dari **Objaverse** (kumpulan model Sketchfab, diunduh dari Hugging Face) dan dipilih per model.
- Hanya lisensi yang boleh dipakai, diubah, dan dibagikan di dalam aplikasi: **CC0** dan **CC-BY**. Model berlisensi NC (non-komersial), ND (tidak boleh diubah) dan SA (turunan wajib berlisensi sama) dilewati.
- CC-BY wajib mencantumkan pembuat: setiap model dicatat (judul, pembuat, lisensi, tautan) di `public/models/CREDITS.md` dan ditampilkan di aplikasi lewat tombol **Kredit model** di katalog.
- Data lisensi diambil dari API publik Sketchfab per model saat memilih.

## Yang dicari

Model modern dan realistis (bukan kartun), prioritas yang sekarang kosong:
- **Dapur:** kitchen set/kabinet, kulkas, microwave, wastafel dapur
- **Kamar mandi:** kloset, wastafel, bathtub, shower
- **Kamar:** kasur modern (single/queen), lemari pakaian modern, meja rias
- **Ruang tamu:** sofa modern, kursi modern, meja tamu modern, rak TV + TV, karpet, lampu lantai
- **Kerja:** meja kerja modern, kursi kantor

## Langkah

1. Ambil daftar kategori Objaverse (LVIS), saring calon per kategori, cek lisensi + jumlah poligon lewat API Sketchfab.
2. Lihat thumbnail calon, pilih yang realistis dan modern (≈25–40 model).
3. Unduh, kecilkan (tekstur WebP ≤1024 px, sederhanakan geometri berat), cek arah hadap, ukur, masukkan ke katalog. Tes ukuran yang sudah ada ikut memeriksa.
4. Kategori baru **Kamar mandi**; furnitur modern diberi label "modern" agar mudah dicari.
5. Tombol **Kredit model** di katalog menampilkan pembuat dan lisensi setiap model.
6. Review, build, push, perbarui link.
