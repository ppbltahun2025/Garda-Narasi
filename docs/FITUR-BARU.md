# Daftar fitur baru & perubahan (0.1.1 → 0.2.0)

## Hasil audit v0.1.1
Kode asli (kini di `legacy/v0.1.1/`): aplikasi statis HTML/CSS/JS **tanpa backend**; data di `localStorage`; 10 klaim sintetis; kemiripan narasi berbasis **Jaccard token**; deteksi lonjakan aturan tetap (≥5 dan ≥2,5× baseline); skor urgensi berbobot; impor/ekspor CSV/JSON; tes Node untuk engine. **Tidak ada** pengumpulan otomatis, basis data, peringatan, atau evaluasi model — jadi "scraping/OSINT" dan "analisis lanjutan" dibangun dari nol, bukan sekadar dipoles.

## Dipertahankan (kompatibel)
Status verifikasi (5 status), formula urgensi 0.1.1 (+ bonus lonjakan/amplifikasi), aturan lonjakan lama (`isBurstLegacy`, masih dihitung & ditampilkan di `burst.legacy`), data demo 10 klaim (ID/isi tidak diubah), impor/ekspor CSV & JSON, mode tanpa server (localStorage), dokumen lama (`docs/legacy/`).

## Fitur baru
| # | Fitur | Status nyata |
|---|---|---|
| 1 | UI baru (shell, strip pipeline, tema, responsif, grafik SVG, graf jaringan, kartogram) | Berjalan; diuji di Chromium 390/820/1440 px |
| 2 | Mesin NLP: normalisasi slang, stemmer ringan, TF-IDF, cosine, sentimen, topik, penanda epistemik, lokasi (gazetteer) | Berjalan; ada evaluasi |
| 3 | Klaster narasi (leader-clustering + merge) & kata kunci | Berjalan |
| 4 | Lonjakan EWMA + z-skor; kandidat amplifikasi (≥3 sumber, jendela waktu, indeks 0–100, catatan syndication) | Berjalan |
| 5 | Confidence per analisis + *evidence tracking* (kata/penanda pendorong, sorotan teks) | Berjalan |
| 6 | Pemisahan Fakta terverifikasi / Opini / Dugaan / Klaim belum terverifikasi | Berjalan; "Fakta terverifikasi" **hanya** via manusia+bukti |
| 7 | Pengumpulan RSS/Atom, API JSON (pemetaan templat), indeks HTML | RSS/Atom & fixture diuji end-to-end; API/HTML diuji unit/ekstraksi, **belum** diuji terhadap situs nyata (tanpa jaringan di lingkungan pengembangan) |
| 8 | Kepatuhan: robots.txt, rate limit per host, Crawl-delay, 429/503, ETag/If-Modified-Since, konfirmasi ToS, SSRF guard, ukuran/waktu maksimum | Berjalan; diuji |
| 9 | Scheduler, dedup (URL, judul, near-dup), timestamp, URL sumber, riwayat run per tahap | Berjalan |
| 10 | Pipeline Collect→Clean→Normalize→Analyze→Cluster→Alert→Verify dengan catatan per tahap | Berjalan |
| 11 | Live monitoring (SSE), notifikasi in-app/browser/webhook | Berjalan (webhook diuji sampai pemanggilan; endpoint nyata tidak diuji) |
| 12 | Tren nasional (stacked per topik, heatmap 24 jam, klaster menguat) | Berjalan |
| 13 | Peta geografis (kartogram 38 provinsi; hanya lokasi terverifikasi manusia) | Berjalan |
| 14 | Source Credibility & Evidence Tracker (prior tier + hasil verifikasi, CI) | Berjalan |
| 15 | Human Verification Workspace (bukti wajib, alasan ≥20 karakter, empat-mata, audit) | Berjalan; diuji |
| 16 | Laporan PDF & CSV (aman dari injeksi rumus), jejak audit | Berjalan |
| 17 | Dataset uji Indonesia (4 tugas, 309 item) + evaluasi + UI evaluasi | Berjalan |
| 18 | Dokumentasi, Docker, backup, 28 tes otomatis | Ada |

## Berubah / tidak lagi ada
* Frontend lama digantikan seluruhnya (fiturnya dipetakan ke halaman baru). Salinan lama ada di `legacy/v0.1.1/`.
* Jaccard digantikan TF-IDF cosine untuk klaster (Jaccard tetap tersedia sebagai pembanding di evaluasi).
