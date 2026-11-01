# Arsitektur sistem

```
                    ┌────────────────────────── frontend/ (HTML/CSS/JS, tanpa build) ──────────────────────────┐
                    │ Situasi · Narasi · Tren · Jaringan · Peta · Peringatan · Verifikasi · Sumber · Lab · Laporan │
                    └───────────────▲──────────────── REST + SSE ───────────────▲──────────────────────────────┘
                                    │ mode server                                │ mode lokal (tanpa server)
 ┌──────────────────────────────────┴───────────────┐              engine/*.js dimuat di browser + localStorage
 │ backend/server.js  (node:http, auth token, CSP,  │
 │ rate limit, static)                              │
 ├──────────────┬────────────┬──────────┬───────────┤        ┌──────────────── engine/ (UMD, sama di Node & browser) ───┐
 │ core.js      │ alerts.js  │verifica- │ reports.js│  ────► │ lexicon.js  leksikon, topik, gazetteer 38 provinsi          │
 │ pipeline +   │ aturan     │tion.js   │ CSV + PDF │        │ nlp.js      normalisasi, stemmer, TF-IDF, cosine,           │
 │ scheduler    │ peringatan │ workspace│ pdf.js    │        │             sentimen, topik, epistemik, klaster, lonjakan,  │
 ├──────────────┴────────────┴──────────┴───────────┤        │             amplifikasi, urgensi, kredibilitas              │
 │ db.js  SQLite (node:sqlite, WAL)                 │        │ analytics.js agregasi dasbor/peta/jaringan                  │
 └───────────────▲──────────────────────────────────┘        │ evaluate.js confusion matrix, P/R/F1, ambang               │
                 │                                           └─────────────────────────────────────────────────────────────┘
 ┌───────────────┴────────── scraper/ ───────────────┐
 │ robots.js (RFC 9309) · net.js (SSRF, rate limit,  │      Sumber: RSS/Atom · API JSON resmi · indeks HTML · fixture lokal
 │ batas ukuran/waktu) · rss.js · clean.js           │
 └───────────────────────────────────────────────────┘
```
Pemisahan: **frontend** (tampilan), **backend** (HTTP, orkestrasi, penyimpanan), **database** (`db.js`), **NLP engine** (`engine/`), **scraping engine** (`scraper/`). Engine berbagi kode dengan browser sehingga mode lokal dan server menghasilkan analisis identik.

## Pipeline (`backend/core.js`)
| Tahap | Proses | Kontrol |
|---|---|---|
| **Collect** | cek `tosAck` → robots.txt → tunggu rate limit host → GET bersyarat (ETag/Last-Modified) → parse | 429/503 dihormati; robots 4xx(401/403)/5xx/galat jaringan ⇒ **tunda** (konservatif); redirect lintas-host ditolak; ≤2 MB, 15 dtk |
| **Clean** | buang HTML/skrip, masking PII (e-mail, telepon, NIK, @akun), potong kutipan ≤ 400 karakter, validasi URL | field penulis **tidak pernah dibaca** |
| **Normalize** | URL kanonik (buang `utm_*`, fragmen), tanggal ISO, deteksi bahasa (kata fungsi ID vs EN), hash isi | item > 14 hari / tanggal masa depan dibuang |
| **Dedup** | URL sama · judul ternormalisasi sama (per sumber) · near-dup cosine ≥ 0,92 | duplikat **lintas sumber dipertahankan** (itu sinyal amplifikasi) |
| **Analyze** | topik, sentimen, penanda epistemik, kandidat lokasi | semua disimpan beserta bukti istilah |
| **Cluster** | leader-clustering TF-IDF (unigram+stem+konsep) lalu merge centroid ≥ 0,5; deteksi lonjakan; amplifikasi | ID klaster stabil = hash item paling awal |
| **Alert** | aturan di `alerts.js`; kunci dedup mencegah peringatan berulang | SSE + webhook opsional |
| **Verify** | item masuk antrean manusia berstatus `needs-review` | tidak ada keputusan otomatis |

## Algoritma kunci
* **Normalisasi**: huruf kecil, buang aksen/URL, kompres huruf berulang, kamus slang→baku, stopword, stemmer aturan (terkonservasi: daftar kata terlindungi, panjang akar ≥ 4).
* **TF-IDF**: tf sublinear × idf terhaluskan, L2-normal, unigram (bigram tersedia; evaluasi menunjukkan unigram+stem lebih presisi). **Cosine** pada peta jarang.
* **"Semantik"**: normalisasi **konsep** (sinonim terkurasi: ditutup≈diblokir≈lumpuh, banjir≈genangan, dst.) ditambahkan sebagai token. Ini *semantik-leksikal*, bukan embedding; antarmuka embedding terlatih = roadmap.
* **Sentimen**: leksikon berbobot −3…+3, jendela negasi 3 kata (−0,7× dan balik tanda), intensifier/diminisher, frasa; skor/√panjang; ambang ±0,35. Konfiden = f(|skor|, jumlah kata leksikon).
* **Topik**: skor kecocokan leksikon per topik (token distem + mentah), softmax + margin ⇒ konfiden; nilai < 1 kecocokan ⇒ "Informasi umum".
* **Epistemik**: penanda frasa berbobot, **frasa terpanjang dahulu + masking** agar "belum dikonfirmasi" tidak mengaktifkan "dikonfirmasi". Kelas: klaim belum terverifikasi, dugaan, opini, pernyataan faktual-atributif. `Fakta terverifikasi` = status manusia `verified` **dan** ≥ 1 bukti.
* **Lonjakan**: EWMA(α=0,35) pada 11 jam sebelumnya; z = (x−μ)/√max(var, μ, 1); lonjakan bila x ≥ 4, z ≥ 2,5, rasio ≥ 1,8.
* **Amplifikasi**: dalam satu klaster, jendela terpadat ≤ 180 mnt; syarat ≥ 3 sumber berbeda (atau ≥ 2 sumber & ≥ 3 kanal, aturan 0.1.1); indeks = 100×(0,35·sumber + 0,25·kekompakan waktu + 0,25·kemiripan rata-rata + 0,15·rasio salinan-hampir-identik). Selalu disertai catatan bahwa kemiripan ≠ koordinasi (kantor berita/siaran pers sah).
* **Urgensi** (0.1.1 + bonus): (0,30 volume + 0,25 kebaruan + 0,25 keragaman kanal + 0,20 perlu review + 0,08 lonjakan + 0,06 amplifikasi)/1,14 × 100.
* **Tekanan narasi**: 0,45 × porsi antrean urgensi ≥ 70 + 0,30 × porsi klaster berlonjak + 0,25 × min(1, amplifikasi/3). Heuristik ringkasan, bukan ukuran ancaman.
* **Kredibilitas sumber**: prior tier (A 0,90 / B 0,75 / C 0,55 / D 0,40) dengan bobot k=8 pseudo-observasi + hasil verifikasi item (verified vs tidak benar+menyesatkan); rentang 90% dari std posterior Beta. Bukan penilaian atas seluruh isi sumber.

## Model data (SQLite)
`claims` (satu entitas untuk manual/demo/impor/hasil kumpul; `origin`, `url_hash` unik, `region_status`) · `evidence` (stance supports/contradicts/context) · `reviews` (stage proposed/applied) · `sources` · `runs` (statistik per tahap) · `alerts` (`dedupe_key` unik) · `audit` · `settings` · `eval_runs`.

## Keamanan (ringkas)
CSP ketat & header keamanan; token API opsional (Bearer); rate limit per IP; batas body 2 MB; semua keluaran UI di-escape; URL bukti/sumber hanya http/https; CSV diberi kutip pada sel berawalan `= + - @`; SSRF guard (host privat/loopback ditolak, redirect lintas-host ditolak); webhook juga melewati SSRF guard. Keterbatasan: identitas pemeriksa pengakuan-diri; DNS-rebinding (TOCTOU) belum ditutup penuh — jalankan di jaringan dengan egress terkendali.
