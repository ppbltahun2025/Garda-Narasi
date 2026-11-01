# GARDA NARASI

**Indonesian Public Information Resilience & Early Warning Platform**  
Prototipe kategori **04 — Cognitive Domain / Siber Sosial** untuk Kartika Cyber Hackathon 2026.

> GARDA NARASI membantu analis memahami dinamika narasi publik dan memprioritaskan pemeriksaan informasi berbasis bukti. Produk ini tidak memutuskan kebenaran secara otomatis, tidak mengidentifikasi individu sebagai buzzer/bot, dan tidak memantau akun pribadi.

## Status prototipe

Versi `0.1.1` sudah mencakup:

- Dashboard ringkasan klaim, status verifikasi, skor urgensi, tren volume, dan indikasi sentimen.
- Narrative Intelligence: pencarian, filter topik/status, pengelompokan topik, dan petunjuk kemiripan teks.
- Sentiment Analysis: distribusi sentimen leksikon secara agregat dan per topik.
- Narrative Network: grafik hubungan kanal/sumber agregat dengan kelompok topik.
- Indikasi amplifikasi lintas kanal: pasangan klaim mirip yang muncul berdekatan, sebagai kandidat review — bukan label bot/koordinasi.
- Claim Verification: catatan pemeriksaan manusia, status, alasan, dan URL bukti pembanding.
- Early Warning: skor urgensi yang dapat dijelaskan serta indikator lonjakan volume agregat.
- Reports & Data: impor JSON/CSV, ekspor JSON/CSV, pemuatan ulang data demo, dan penghapusan workspace.
- Penyimpanan lokal pada browser menggunakan `localStorage`; tidak ada backend atau pengiriman isi data ke server aplikasi.
- Dataset demo berisi skenario dan wilayah **fiktif**.

## 1. Menjalankan aplikasi

### Cara A — Visual Studio Code + Live Server

1. Ekstrak ZIP project.
2. Buka folder `garda-narasi` menggunakan Visual Studio Code.
3. Pasang ekstensi **Live Server**.
4. Klik kanan `index.html` → **Open with Live Server**.
5. Browser akan membuka aplikasi, biasanya di `http://127.0.0.1:5500`.

### Cara B — Python (tanpa ekstensi)

Pastikan Python sudah terpasang. Buka terminal pada folder project, lalu jalankan:

```bash
python -m http.server 8000
```

Buka `http://localhost:8000` pada browser.

**Penting:** jangan membuka `index.html` dengan klik ganda (`file://`). Browser dapat memblokir pembacaan file JSON demo melalui `fetch`. Gunakan Live Server, localhost, atau hosting statis.

## 2. Cara menggunakan

1. Buka **Overview** untuk melihat ringkasan dataset.
2. Masuk ke **Narrative Intelligence** untuk mencari dan memfilter klaim.
3. Klik **Analisis detail** untuk melihat faktor skor, kanal, sentimen indikatif, dan kemiripan teks.
4. Masuk ke **Claim Verification** atau buka detail klaim untuk menambahkan catatan verifikasi, status, serta tautan bukti.
5. Buka **Sentiment Analysis** untuk melihat kecenderungan leksikon secara agregat.
6. Buka **Narrative Network** untuk memahami hubungan kanal dan topik.
7. Buka **Early Warning Center** untuk melihat skor urgensi, indikasi lonjakan, dan kandidat amplifikasi lintas kanal.
8. Buka **Reports & Data** untuk mengimpor dan mengekspor dataset.

### Status verifikasi

- `Perlu verifikasi`: belum ada keputusan manusia.
- `Terverifikasi`: pemeriksa menemukan dukungan memadai dari sumber primer/pembanding.
- `Tidak benar`: pemeriksa menemukan bukti kuat yang menyangkal klaim.
- `Menyesatkan`: sebagian unsur benar tetapi penyajian menghilangkan atau mengubah konteks penting.
- `Perlu konteks`: belum cukup informasi untuk mengambil keputusan yang bertanggung jawab.

Status tersebut wajib diisi oleh pemeriksa manusia. Aplikasi tidak menetapkan status berdasarkan skor.

## 3. Format impor

Aplikasi menerima file `.json` atau `.csv` maksimum 5 MB dan 1.000 klaim per file.

### JSON

Bentuk yang didukung adalah array objek klaim, atau objek dengan properti `claims` yang berisi array.

```json
[
  {
    "id": "GN-001",
    "date": "2026-10-31T10:00:00+07:00",
    "title": "Contoh informasi layanan",
    "claim": "Pesan simulasi menyebut layanan akan berhenti tanpa sumber primer.",
    "topic": "Layanan publik",
    "region": "Wilayah Uji (fiktif)",
    "source": "Dataset latihan",
    "channels": ["Dataset latihan", "Simulasi forum"],
    "mentions": 15,
    "status": "needs-review",
    "hourlyCounts": [1, 1, 2, 2, 3, 3, 4, 5, 7, 8, 9, 12],
    "isSynthetic": true
  }
]
```

### CSV

Gunakan header seperti file `data/sample-claims.csv`:

`id,date,title,claim,topic,region,source,channels,mentions,status,hourlyCounts,isSynthetic`

Untuk CSV, beberapa kanal dipisahkan dengan karakter `|`. Begitu pula nilai `hourlyCounts`.

Nilai status yang diterima: `needs-review`, `verified`, `false`, `misleading`, `context-needed`.

### Aturan impor

- ID yang sudah ada tidak akan diimpor ulang.
- Kolom yang tidak dikenal akan diabaikan.
- Tanggal yang tidak valid dinormalisasi ke waktu saat impor.
- URL sumber hanya dapat dibuka bila menggunakan protokol `http` atau `https`.
- Data disimpan pada browser yang sedang digunakan. Mode incognito, penghapusan data browser, atau perangkat lain tidak berbagi workspace yang sama.

## 4. Privasi dan keamanan

- Analisis dilakukan di browser; tidak terdapat API pengiriman konten pada versi ini.
- Dataset demo tidak mewakili kejadian, wilayah, institusi, atau orang nyata.
- Jangan mengimpor nomor telepon, alamat rumah, identitas pribadi, kredensial, atau data sensitif.
- Gunakan hanya data publik yang sah diakses, data dengan izin, atau dataset sintetis.
- Jangan menjadikan sentimen negatif, kritik, atau perbedaan pendapat sebagai indikator ancaman.
- Tidak ada fungsi untuk scraping platform, pengawasan individu, atau pelabelan akun sebagai bot.

## 5. Struktur folder

```text
garda-narasi/
├── index.html
├── README.md
├── assets/
│   ├── css/styles.css
│   └── js/
│       ├── app.js
│       ├── engine.js
│       └── charts.js
├── data/
│   ├── sample-claims.json
│   ├── sample-claims.csv
│   └── demo-evidence.md
├── docs/
│   ├── PANDUAN-PEMULA.md
│   ├── PROPOSAL-DRAFT.md
│   ├── TECHNICAL-DOCUMENTATION.md
│   ├── TEST-PLAN.md
│   └── DEMO-STORYBOARD.md
└── tests/
    └── engine.test.js
```

## 6. Deploy ke GitHub Pages

1. Buat repository GitHub, misalnya `garda-narasi`.
2. Upload seluruh isi folder project (bukan hanya `index.html`).
3. Pastikan `index.html` berada di root repository.
4. Buka **Settings → Pages**.
5. Pilih **Deploy from a branch**, branch `main`, folder `/(root)`, kemudian Save.
6. Tunggu proses deployment GitHub Pages selesai dan buka URL yang diberikan.
7. Uji semua navigasi, import, export, dan penyimpanan setelah dibuka dari URL Pages.

Karena aplikasi menggunakan `localStorage`, data setiap browser/perangkat terpisah. GitHub Pages hanya meng-host file statis; tidak menyimpan dataset pengguna secara terpusat.

## 7. Menjalankan uji logika otomatis

Dengan Node.js terpasang, buka terminal pada folder project lalu jalankan:

```bash
node tests/engine.test.js
```

Tes ini memeriksa dataset sintetis, skor urgensi, indikator lonjakan, kemiripan teks, dan kandidat amplifikasi lintas kanal. Tes otomatis ini tidak menggantikan pengujian antarmuka pada browser.

## 8. Pengembangan berikutnya

Prioritas realistis setelah MVP:

1. Menambah dataset uji berlabel dan panel evaluasi deteksi.
2. Memperbaiki pengelompokan narasi dengan TF-IDF/cosine similarity atau model embedding yang berjalan lokal.
3. Menambahkan konektor RSS/feeds publik yang mematuhi syarat penggunaan sumber.
4. Menambahkan provenance sumber, waktu pengambilan, dan riwayat perubahan klaim.
5. Menambah autentikasi dan backend hanya jika ada kebutuhan multi-analis; desain privasi dan keamanan harus dirancang dahulu.

---

**Disclaimer:** GARDA NARASI versi ini merupakan prototipe demonstrasi. Skor, indikasi sentimen, dan pola lonjakan tidak boleh digunakan sebagai dasar tunggal keputusan operasional, kebijakan, penindakan, atau publikasi klarifikasi.
