# PANDUAN PEMULA — MENJALANKAN GARDA NARASI

Panduan ini dibuat untuk menjalankan prototipe dari folder ZIP tanpa backend, database, atau API berbayar.

## A. Persiapan

1. Unduh dan ekstrak `GARDA-NARASI-v0.1.1.zip`.
2. Pasang Visual Studio Code.
3. Buka VS Code → **File → Open Folder** → pilih folder `garda-narasi`.
4. Pastikan seluruh folder `assets`, `data`, `docs`, dan `tests` tetap berada di dalam folder project.

## B. Menjalankan aplikasi di komputer

### Pilihan 1 — Live Server

1. Buka menu Extensions di VS Code.
2. Cari dan pasang ekstensi **Live Server**.
3. Klik kanan `index.html`.
4. Pilih **Open with Live Server**.
5. Browser membuka alamat lokal seperti `http://127.0.0.1:5500`.

### Pilihan 2 — Python

1. Buka terminal VS Code pada folder project.
2. Jalankan `python -m http.server 8000` (Windows juga dapat memakai `py -m http.server 8000`).
3. Buka `http://localhost:8000` pada browser.
4. Untuk menghentikan server tekan `Ctrl + C` di terminal.

Jangan membuka `index.html` dengan klik ganda. Dataset demo diambil menggunakan `fetch`, sehingga lebih andal bila aplikasi dijalankan melalui server lokal atau hosting statis.

## C. Tur aplikasi

1. **Overview:** perhatikan total klaim, klaim yang menunggu pemeriksaan, isu prioritas, dan grafik volume.
2. **Narrative Intelligence:** cari kata kunci atau gunakan filter topik dan status. Klik **Analisis detail** untuk membuka bukti dan faktor urgensi.
3. **Sentiment Analysis:** perhatikan komposisi sentimen indikatif pada leksikon sederhana. Jangan menyebutnya sebagai survei opini publik.
4. **Narrative Network:** lihat hubungan kanal/sumber agregat dengan topik. Grafik tidak memuat identitas orang atau akun.
5. **Claim Verification:** buka sebuah klaim, periksa sumber primer, lalu catat status, alasan, dan URL bukti. Untuk data demo, gunakan catatan bukti simulasi.
6. **Early Warning:** periksa faktor skor urgensi, lonjakan volume, serta kandidat amplifikasi. Kandidat amplifikasi bukan bukti bot atau koordinasi.
7. **Reports & Data:** impor CSV/JSON, ekspor cadangan, atau muat ulang dataset demo.

## D. Menambahkan klaim secara manual

1. Klik **Tambah klaim**.
2. Isi judul singkat dan teks klaim apa adanya.
3. Pilih topik, isi wilayah/konteks, sumber/kanal, dan jumlah catatan.
4. Masukkan URL sumber hanya jika tautan tersebut benar-benar ada dan sah digunakan.
5. Klik **Simpan klaim**.
6. Klaim akan masuk ke status **Perlu verifikasi**. Skor urgensi hanya menentukan antrean, bukan menentukan benar atau salah.

Jangan masukkan nama akun personal, nomor telepon, alamat rumah, kredensial, atau data sensitif.

## E. Mengimpor dataset sendiri

Gunakan `data/sample-claims.csv` atau `data/sample-claims.json` sebagai template. File maksimal 5 MB dan maksimal 1.000 klaim pada satu kali impor.

Field minimum yang disarankan:

- `id`: ID unik.
- `date`: waktu ISO 8601, sebaiknya disertai zona waktu.
- `title`: judul klaim.
- `claim`: isi klaim.
- `topic`: kelompok isu.
- `source`: sumber input.
- `channels`: daftar kanal agregat; untuk CSV pisahkan dengan `|`.
- `mentions`: jumlah catatan pada dataset.

Jika `hourlyCounts` tersedia, masukkan seri angka dengan pemisah `|` di CSV atau array angka di JSON. Seri ini membantu uji indikator lonjakan. Pastikan angka tersebut berasal dari pengukuran yang sah atau tandai sebagai simulasi.

## F. Memahami indikator

- **Sentimen:** menghitung kata dari leksikon kecil. Negasi, sarkasme, dialek, dan konteks dapat membuat hasil salah.
- **Kemiripan teks:** menggunakan token dan Jaccard similarity sebagai petunjuk menemukan catatan yang mirip.
- **Lonjakan:** membandingkan titik volume terakhir dengan rata-rata titik sebelumnya.
- **Amplifikasi kandidat:** mencari dua klaim bertopik sama, mirip, dekat waktunya, dan tersebar pada beberapa kanal agregat. Ini bukan detektor bot yang teruji.
- **Skor urgensi:** mengurutkan kebutuhan pemeriksaan berdasarkan volume, kebaruan, keragaman kanal, status review, dan indikasi lonjakan. Skor bukan probabilitas hoaks.
- **Status verifikasi:** hanya diubah oleh manusia setelah pemeriksaan sumber dan bukti.

## G. Menguji kualitas aplikasi

### Uji otomatis

Pastikan Node.js tersedia, lalu jalankan dari root project:

```bash
node tests/engine.test.js
```

Hasil yang diharapkan:

```text
GARDA NARASI engine tests: PASS
```

### Uji manual browser

Ikuti seluruh skenario `docs/TEST-PLAN.md`. Uji pada desktop dan lebar mobile sekitar 390 px. Simpan screenshot dan catat tanggal, browser, langkah, serta hasil aktual. Jangan mengklaim semua pengujian lulus sebelum benar-benar dijalankan.

## H. Deploy demo ke GitHub Pages

1. Buat repository baru, misalnya `garda-narasi`.
2. Upload **isi folder project**, sehingga `index.html` berada di root repository.
3. Buka repository → **Settings → Pages**.
4. Pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
5. Tunggu URL Pages muncul, kemudian uji semua menu dan file impor.
6. Untuk perubahan berikutnya, upload kembali file yang diperbarui ke repository.

GitHub Pages hanya meng-host file statis. Dataset kerja tersimpan di `localStorage` browser, bukan di repository dan bukan tersinkron antarperangkat. Jangan meng-upload data pribadi ke repository publik.

## I. Persiapan demo kompetisi

1. Kembalikan data ke dataset demo sintetis.
2. Mulai dari Overview, lalu tunjukkan alur klaim → analisis → early warning → human verification → export.
3. Jelaskan satu keterbatasan model dan mitigasinya.
4. Gunakan storyboard pada `docs/DEMO-STORYBOARD.md`.
5. Gunakan proposal dan dokumentasi teknis sebagai draf; lengkapi identitas, hasil pengujian aktual, dan sumber rujukan resmi sebelum submission.

---

**Prinsip penggunaan:** analisis klaim dan pola agregat, bukan pengawasan individu. Ketika bukti belum cukup, pertahankan status belum terverifikasi.
