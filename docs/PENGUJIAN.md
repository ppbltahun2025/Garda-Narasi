# Skenario pengujian

## Otomatis (`npm test`, 28 tes)
| Berkas | Cakupan |
|---|---|
| `tests/engine.test.js` | normalisasi slang/URL, masking PII, stemmer, sentimen (negasi, frasa "tidak aman"), epistemik (kelas, masking frasa), aturan "Fakta terverifikasi", cosine, lonjakan EWMA, lokasi, amplifikasi (≥3 sumber; 1 sumber ≠ amplifikasi), klaster, urgensi, kredibilitas, metrik, validitas dataset |
| `tests/scraper.test.js` | robots.txt (grup, longest-match, wildcard, `$`, Crawl-delay), RSS/Atom, tanpa field penulis, URL kanonik, cleaning (PII, potong kutipan, tanggal), bahasa, SSRF |
| `tests/api.test.js` | **pipeline end-to-end** terhadap server HTTP lokal: robots melarang ⇒ diblokir & tak ada data; ToS wajib; dedup pada run kedua; item hasil kumpul **tidak** diberi label otomatis; bukti wajib; empat-mata (409 untuk orang sama); token API; CSP/header; path traversal; CSV injection; PDF valid; impor idempoten |

## Skenario manual (UI)
| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | `npm start`, buka **Situasi** | 22 catatan sintetis, banner "DATA SINTETIS", indeks tekanan, 2 peringatan |
| 2 | **Sumber → Fixture lokal → Jalankan** (dua kali) | run 1: item baru; run 2: semuanya duplikat; strip pipeline berubah |
| 3 | Jalankan fixture A lalu B | klaster "listrik · jawa · tengah" menggabung item dua sumber; peringatan lonjakan |
| 4 | Aktifkan sumber RSS nyata tanpa centang ToS | ditolak (422) |
| 5 | Sumber dengan robots.txt `Disallow` | run berstatus *blocked*, tidak ada item, alasan tercatat di Riwayat |
| 6 | Buka klaim → tambah bukti → status **Tidak benar** sebagai A → B | A: "usulan tersimpan"; B: dikonfirmasi; status berubah; audit mencatat keduanya |
| 7 | Verifikasi lokasi klaim ke provinsi | tile provinsi di **Peta** bertambah; kandidat terpisah di tab "Kandidat" |
| 8 | **Lab**: "Katanya listrik padam 3 hari, belum dikonfirmasi PLN" | epistemik *klaim belum terverifikasi*, cue tampil |
| 9 | **Laporan**: unduh PDF & CSV | PDF memuat keterbatasan; CSV aman dibuka di spreadsheet |
| 10 | Ubah lebar 390/820/1440 px | tidak ada overflow horizontal; navigasi berpindah ke bar bawah di mobile |
| 11 | `static` (tanpa backend) | mode lokal: analisis & verifikasi lokal jalan; halaman pipeline menjelaskan butuh backend |

## Yang belum teruji
Pengambilan dari **situs nyata** (lingkungan pengembangan tanpa internet), skala > 3.000 catatan, beban konkuren, keamanan produksi (audit pihak ketiga), aksesibilitas dengan pembaca layar.
