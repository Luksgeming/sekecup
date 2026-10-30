# Tahap 3.6: Furnitur Realistis

**Masalah dari pengguna:** furnitur buatan sendiri dari kotak dan silinder terlihat seperti kartun, jadi tidak profesional. Jangan dibuat sendiri.

## Keputusan

- Semua furnitur buatan kode diganti **model 3D realistis dari Poly Haven** (polyhaven.com, lisensi **CC0**: bebas dipakai dan dibagikan, termasuk di aplikasi, tanpa wajib atribusi). Sumbernya tetap dicantumkan di `public/models/CREDITS.md`.
- Barang yang **tidak ada** model realistisnya di Poly Haven dikeluarkan dari katalog, tidak dibuat sendiri: kitchen set, kulkas, kloset, wastafel, bathtub, shower, karpet, lampu lantai. Barang-barang itu nanti bisa diisi lewat fitur **import model `.glb`** (mis. diekspor dari SketchUp), yang dikerjakan sebagai tahap terpisah.
- Furnitur dari file lama yang jenisnya dihapus akan dibuang saat file dibuka, dengan pesan berapa yang dihapus. Jenis yang masih ada tetap dibuka seperti biasa.
- Furnitur realistis memakai tekstur aslinya, jadi **pilihan warna furnitur dihapus** (mewarnai ulang membuatnya tidak realistis). Warna dinding dan material lantai tetap bisa diubah.
- Model diperkecil untuk web: tekstur maksimal 1024 px dalam format WebP, satu file `.glb` per model, dan model baru dimuat saat dipakai (tidak semuanya di awal).
- Katalog menampilkan foto kecil (thumbnail) setiap model.

## Katalog baru

| Kategori | Barang (model Poly Haven) |
|---|---|
| Kamar | Kasur kayu klasik (GothicBed_01), Nakas (side_table_01), Lemari pajangan (vintage_cabinet_01), Lemari laci (drawer_cabinet) |
| Ruang tamu | Sofa kulit (sofa_02), Sofa klasik (Sofa_01), Kursi santai (mid_century_lounge_chair), Kursi berlengan (modern_arm_chair_01), Ottoman (Ottoman_01), Meja tamu (modern_coffee_table_01), Meja tamu bundar (coffee_table_round_01), Rak TV (modern_wooden_cabinet) |
| Makan | Meja makan (wooden_table_02), Kursi makan (dining_chair_02) |
| Kerja | Meja kerja (metal_office_desk), Rak buku (wooden_display_shelves_01), Rak besi (steel_frame_shelves_01) |
| Tanaman | Tanaman tinggi (potted_plant_01), Tanaman daun lebar (potted_plant_02) |

## Tugas

1. Unduh model (1k), ubah ke `.glb` ringan, simpan di `public/models/`, beserta thumbnail dan CREDITS.
2. Ukuran katalog diambil dari ukuran asli model; tes memastikan ukuran katalog sama dengan model (±2 cm).
3. Pemuat model: muat saat dipakai, simpan di cache, tampilkan kotak transparan selama memuat, lalu 3D diperbarui otomatis. Arah depan model diseragamkan.
4. File lama: jenis yang dihapus dibuang dengan pesan; tes.
5. Katalog dengan thumbnail; panel furnitur tanpa pilihan warna.
6. Mode offline: model yang pernah dipakai tersimpan di cache.
7. Review, build web + desktop, push, perbarui link (bersama tahap 3.5).
