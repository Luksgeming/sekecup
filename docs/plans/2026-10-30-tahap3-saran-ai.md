# Tahap 3: Saran Interior dari Foto

**Tujuan:** Upload foto ruangan, lalu dapat saran gaya interior: palet warna, material lantai, dan furnitur dari katalog. Saran bisa langsung diterapkan ke desain sehingga hasilnya terlihat di 3D.

## Keputusan

- **Dua mode.** Mode **offline** (bawaan) membaca warna foto lalu mencocokkannya ke gaya interior; tidak butuh internet atau akun. Mode **AI** aktif kalau API key diisi di Pengaturan; pengguna memasang key-nya sendiri.
- Penyedia AI yang didukung: **Gemini** dan **OpenAI**. Nama model bisa diubah di Pengaturan.
- API key hanya disimpan di perangkat pengguna (penyimpanan browser), tidak pernah ikut file project.
- "Gambar contoh hasil" diwujudkan dengan menerapkan saran ke desain, lalu melihatnya di 3D (bukan gambar buatan AI).
- Kedua mode menghasilkan bentuk saran yang sama:
  ```ts
  type Recommendation = {
    style: string;            // mis. "Skandinavia"
    summary: string;          // 1–2 kalimat
    palette: string[];        // 3–6 warna #rrggbb, yang pertama untuk dinding
    floor: FloorMaterial;
    furniture: FurnitureKind[];
    tips: string[];
    source: 'offline' | 'ai';
  };
  ```

## Hal yang paling mungkin bikin masalah

1. Jawaban AI berisi jenis furnitur/lantai/warna yang tidak dikenal → dibuang, sisanya tetap dipakai. Jawaban yang bukan JSON → pesan jelas.
2. API key salah, kuota habis, atau tidak ada internet → pesan yang menjelaskan sebabnya, plus tawaran memakai mode offline.
3. Foto sangat besar (mis. 12 MP) → diperkecil dulu sebelum dianalisis atau dikirim.
4. File yang bukan gambar → ditolak dengan pesan.
5. "Terapkan" bisa di-undo dalam satu langkah.

---

### Task 1: Analisis offline
**File:** `src/ai/palette.ts`, `src/ai/styles.ts`, tes `tests/ai/*.test.ts`
- `extractPalette(pixels: Uint8ClampedArray, k = 5): { color: string; weight: number }[]`: k-means sederhana dengan inisialisasi tetap (hasil sama setiap kali).
- `recommendOffline(palette): Recommendation`: cocokkan rata-rata terang, saturasi, dan kehangatan ke 6 gaya: Minimalis, Skandinavia, Industrial, Japandi, Tropis, Klasik Hangat.
- [ ] Tes: gambar satu warna menghasilkan warna itu; foto terang-netral → Skandinavia/Minimalis; foto gelap-abu → Industrial; foto hijau-kayu → Tropis.

### Task 2: Mode AI
**File:** `src/ai/providers.ts`, `src/ai/settings.ts`, tes
- `buildRequest(settings, imageBase64, mime)`: URL, header, dan body untuk Gemini atau OpenAI. Prompt meminta JSON dengan daftar jenis furnitur dan lantai yang dikenal aplikasi.
- `readResponse(provider, json)`: ambil teks jawaban; `parseRecommendation(text)`: validasi dan buang nilai yang tidak dikenal.
- `errorMessage(status)`: 401/403 → "API key ditolak", 429 → "Kuota habis/terlalu sering", lainnya → kode status.
- Pengaturan: penyedia, API key, model; disimpan lokal, aman jika penyimpanan diblokir.
- [ ] Tes: body request kedua penyedia; parsing jawaban yang bersih, berisi teks tambahan di sekitar JSON, dan berisi nilai asing.

### Task 3: Panel "Saran AI"
**File:** `src/ui/advisor.ts`, `src/model/project.ts` (`applyRecommendation`), `src/main.ts`, `src/style.css`
- Tombol **Saran AI** di toolbar membuka panel: pilih/seret/tempel foto → pratinjau → **Analisis**.
- Hasil: gaya, ringkasan, palet (klik warna = pakai untuk dinding), lantai, furnitur yang disarankan (klik = siap ditaruh), dan tips.
- **Terapkan ke desain:** warna pertama ke semua dinding dan lantai ke semua ruangan (atau hanya ruangan yang dipilih). Satu langkah undo.
- Tombol **Pengaturan AI** untuk mengisi penyedia, API key, dan model.
- [ ] Tes `applyRecommendation`: semua dinding berganti warna, lantai berganti, satu objek project baru.

### Task 4: Rilis
- [ ] CSP desktop mengizinkan koneksi ke `generativelanguage.googleapis.com` dan `api.openai.com`.
- [ ] Review, perbaikan, build web + desktop, push, perbarui link.
