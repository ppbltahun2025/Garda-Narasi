# GARDA NARASI v0.2.0
**Indonesian Public Information Resilience & Early Warning Platform**

Platform untuk **mengumpulkan, menganalisis, menghubungkan, dan memberi peringatan dini** atas dinamika narasi publik digital Indonesia — secara transparan, terukur, dan bertanggung jawab. Sistem ini **membantu manusia memprioritaskan verifikasi**; ia tidak pernah menyatakan sebuah informasi sebagai hoaks secara otomatis.

## Mulai cepat (Node ≥ 22.5, tanpa `npm install`)
```bash
npm start                 # http://127.0.0.1:8787  (data demo dimuat otomatis)
npm test                  # 28 tes otomatis (engine, scraper, API)
npm run eval              # evaluasi model pada dataset Bahasa Indonesia
```
Buka `http://127.0.0.1:8787`. Mencoba pipeline tanpa internet: **Sumber & pipeline → Fixture lokal → Jalankan**.

Tanpa backend (hanya lihat/uji analisis): `npm run static` lalu buka `http://localhost:8080/frontend/` — aplikasi otomatis masuk **mode lokal** (data di browser, tanpa pengumpulan/peringatan/PDF).

## Yang baru di 0.2.0 (ringkas)
| Area | Isi |
|---|---|
| UI/UX | Antarmuka baru "tinta nila": strip pipeline langsung, kartogram provinsi, graf jaringan interaktif, tema gelap/terang, responsif desktop–tablet–mobile |
| Analisis | TF-IDF + cosine + normalisasi konsep, stemmer ringan Indonesia, sentimen leksikon + negasi/intensitas, topik, penanda epistemik, deteksi lonjakan EWMA-z, kandidat amplifikasi lintas sumber, confidence + evidence per keluaran, evaluasi (confusion matrix, P/R/F1) |
| Pengumpulan | RSS/Atom, API JSON resmi, indeks HTML (judul+tautan) · robots.txt (RFC 9309) · rate limit · scheduler · dedup · riwayat run · proteksi SSRF |
| Operasional | Peringatan dini (SSE, browser, webhook) · tracker kredibilitas sumber · Ruang Verifikasi Manusia (bukti wajib, empat-mata) · laporan PDF/CSV · jejak audit |

Rincian: [`docs/FITUR-BARU.md`](docs/FITUR-BARU.md).

## Dokumentasi
[Arsitektur](docs/ARSITEKTUR.md) · [API](docs/API.md) · [Konfigurasi](docs/KONFIGURASI.md) · [Deployment](docs/DEPLOYMENT.md) · [Evaluasi & dataset](docs/EVALUASI.md) · [Skenario pengujian](docs/PENGUJIAN.md) · [Etika & kepatuhan](docs/ETIKA-DAN-KEPATUHAN.md) · [Keterbatasan & roadmap](docs/KETERBATASAN-ROADMAP.md)

## Struktur
```
engine/     NLP & analitik (UMD: jalan di Node dan browser)    scraper/   robots, RSS, fetch aman, cleaning
backend/    server HTTP, SQLite, pipeline, alert, verifikasi, laporan PDF/CSV
frontend/   UI tanpa build step (HTML/CSS/JS)                   config/    sources.json
data/       demo sintetis, fixture RSS, dataset evaluasi         tests/     node:test
legacy/v0.1.1/  kode asli untuk rujukan/rollback                docs/      dokumentasi
```

## Peringatan penting
* Data demo & fixture **sintetis**; ditandai di UI. Angka akurasi berasal dari dataset kecil buatan tim — **bukan** jaminan kinerja lapangan.
* URL sumber di `config/sources.json` bertanda *KANDIDAT* belum diverifikasi paket ini; periksa ToS dan robots.txt sebelum mengaktifkan.
* Jangan membuka server ke jaringan publik tanpa `GARDA_API_TOKEN` dan HTTPS (lihat Deployment).
