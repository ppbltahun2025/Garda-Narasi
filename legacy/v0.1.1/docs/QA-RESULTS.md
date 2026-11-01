# HASIL QA PROTOTIPE — GARDA NARASI v0.1.1

**Tanggal pemeriksaan:** 31 Oktober 2026  
**Tujuan:** smoke test fungsi utama untuk paket prototipe hackathon.

## Pemeriksaan statis dan logika

| Pemeriksaan | Hasil |
|---|---|
| `node --check` untuk `engine.js`, `charts.js`, `app.js` | Lulus |
| `node tests/engine.test.js` | Lulus |
| Struktur HTML: ID duplikat | Tidak ditemukan |
| Kecocokan menu navigasi dengan halaman | 7 menu cocok dengan 7 view |
| Dataset demo | 10/10 catatan bertanda `isSynthetic: true` |
| Rentang skor urgensi | Seluruh skor berada pada rentang 0–100 |
| Kandidat amplifikasi demo | GN-DEMO-009 dan GN-DEMO-010 terdeteksi sebagai 1 kandidat review |

## Smoke test antarmuka browser

Pengujian dilakukan pada Chromium menggunakan harness HTML dengan stylesheet dan JavaScript project yang diinjeksi langsung, serta stub `fetch` dan `localStorage` untuk memasok dataset demo. Ini memeriksa perilaku UI dan fungsi, tetapi bukan pengganti uji deployment pada server lokal atau GitHub Pages.

| Skenario | Hasil |
|---|---|
| Navigasi Overview, Narrative, Sentiment, Network, Verification, Early Warning, Reports | Lulus |
| Render tiga kartu distribusi sentimen | Lulus |
| Render peta SVG Narrative Network dan daftar hubungan | Lulus |
| Render satu kandidat amplifikasi lintas kanal | Lulus |
| Buka detail klaim | Lulus |
| Simpan status dan catatan verifikasi | Lulus |
| Tambah klaim melalui formulir | Lulus |
| Import JSON satu klaim baru | Lulus |
| Import CSV satu klaim baru | Lulus |
| Export JSON | Lulus; file terunduh pada harness |
| Escape teks input untuk mencegah injeksi HTML | Lulus pada skenario uji |
| Navigasi sidebar pada viewport 390 px | Lulus |
| JavaScript runtime errors selama smoke test | Tidak ditemukan |

## Catatan batas pengujian

- Belum dilakukan uji penerimaan oleh analis atau pengguna nyata.
- Belum ada pengukuran akurasi klasifikasi hoaks atau kualitas model sentimen; versi ini tidak mengklaim memilikinya.
- Belum dilakukan uji beban dengan dataset besar.
- Sebelum submission, jalankan sendiri aplikasi melalui Live Server dan URL GitHub Pages, lalu ikuti `TEST-PLAN.md` pada browser dan perangkat target. Simpan hasil aktual beserta screenshot.

**Status:** prototipe berfungsi untuk demo terkontrol dengan data sintetis; bukan sistem produksi atau sistem intelijen operasional.
