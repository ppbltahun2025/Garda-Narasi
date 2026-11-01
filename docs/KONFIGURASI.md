# Konfigurasi

## Variabel lingkungan
Lihat `.env.example` (nilai bawaan dalam tanda kurung). `PORT` (8787) · `HOST` (127.0.0.1) · `DB_PATH` (`data/garda.db`) · `GARDA_API_TOKEN` (kosong = tanpa auth) · `GARDA_CONTACT` (masuk User-Agent) · `SCHEDULER` (true) · `FOUR_EYES` (true) · `HOST_DELAY_MS` (3000) · `MIN_INTERVAL_MIN` (15) · `MAX_AGE_DAYS` (14) · `SEED_DEMO` (true) · `ALLOW_PRIVATE_HOSTS` (false; **hanya uji**) · `RATE_LIMIT` (300/mnt/IP) · `TICK_MS` (30000).

## `config/sources.json`
Dibaca sekali untuk mengisi tabel `sources` (tidak menimpa sumber yang sudah ada). Semua sumber jaringan masuk **nonaktif** dan `tosAck=false`.
```json
{"id":"slug","name":"Nama","type":"rss|api-json|html-list|rss-file","url":"https://…","tier":"A|B|C|D","intervalMin":60,"lang":"id","notes":"…",
 "mapping":{"itemsPath":"a.b","titleTemplate":"Gempa M{Magnitude} {Wilayah}","summaryTemplate":"…{Field}…","linkTemplate":"https://…","fields":{"published":"DateTime"}}}
```
* `rss` — RSS 2.0/Atom/RDF. `api-json` — JSON resmi; `itemsPath` titik-bertingkat; templat memakai `{NamaField}`. `html-list` — halaman indeks; hanya anchor ≥ 25 karakter pada host yang sama (opsional `mapping.linkPattern` regex); **hanya judul + tautan**. `rss-file` — berkas lokal (uji).
* **Tier** (penilaian awal pengelola): A resmi/primer · B media berdewan redaksi · C agregator/komunitas · D belum dinilai.

## Mengaktifkan sumber nyata (urutan wajib)
1. Baca Syarat Layanan sumber; pastikan pengambilan otomatis tidak dilarang. 2. Buka **Sumber → Cek robots**. 3. Centang konfirmasi ToS (nama Anda tercatat di audit). 4. Aktifkan; tetapkan interval ≥ 15 menit. 5. Jalankan manual sekali dan periksa **Riwayat**.
