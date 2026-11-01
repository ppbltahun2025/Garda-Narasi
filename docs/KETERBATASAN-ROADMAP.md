# Keterbatasan & roadmap

## Keterbatasan yang diketahui
1. **NLP berbasis leksikon/aturan**, bukan model terlatih: rapuh pada slang, sarkasme, kode-campur, parafrase jauh (challenge set 38–64%). Sentimen mengukur nada teks, bukan valensi peristiwa.
2. **"Semantik"** = TF-IDF + sinonim terkurasi; belum embedding. Klaster bisa terlalu pecah atau menyatukan hal berbeda.
3. **Evaluasi kecil & dibuat sendiri** (309 item) — optimistis; tidak ada kesepakatan antar-anotator.
4. **Pengumpulan nyata belum diuji di internet** (RSS/Atom, fixture, dan server lokal diuji). URL sumber contoh *belum diverifikasi*. Parser HTML hanya judul+tautan; tak mengeksekusi JavaScript.
5. **Cakupan sumber**: media sosial/pesan tertutup tidak dikumpulkan (sengaja, demi ToS & privasi) sehingga sinyal amplifikasi hanya mencerminkan sumber publik yang terpantau, dan **tidak mendeteksi** perilaku non-otentik di platform.
6. **Geografi**: kartogram provinsi, belum kabupaten/kota; ekstraksi lokasi = pencocokan nama (ambigu: "Jakarta" vs institusi). Lokasi berdasar teks hanya kandidat.
7. **Keamanan**: identitas pemeriksa pengakuan-diri (satu token bersama); belum ada RBAC/SSO; SSRF TOCTOU DNS-rebinding belum ditutup; belum ada audit keamanan independen.
8. **Skala**: korpus di-memori hingga 3.000 catatan terbaru; klastering O(n·k). Satu proses Node, scheduler serial.
9. **Detik/zona waktu**: tampilan memakai zona perangkat; laporan PDF memakai WIB.
10. Skor (urgensi, tekanan, kredibilitas) adalah **heuristik**; bobot belum dikalibrasi terhadap data operasional.

## Roadmap
| Fase | Butir |
|---|---|
| Jangka dekat | Uji lapangan sumber nyata & verifikasi URL; RBAC/SSO + tanda tangan keputusan; antrean penugasan pemeriksa & SLA; ekspor/impor bukti terstruktur (ClaimReview schema.org) |
| Model | Embedding multibahasa/IndoBERT via layanan lokal (antarmuka `EMBEDDING_URL`), NER lokasi, deteksi duplikat semantik; kalibrasi probabilitas; dataset ≥ 1.000 item dianotasi ganda + pelaporan κ |
| Analitik | Deteksi narasi lintas-waktu (topic evolution), CUSUM/Prophet untuk musiman, peta kabupaten/kota (GeoJSON resmi), skor dampak yang dikalibrasi bersama domain expert |
| Platform | PostgreSQL + worker terpisah, antrean pekerjaan, observabilitas (metrik Prometheus), multi-tenant, uji beban, audit keamanan pihak ketiga, aksesibilitas WCAG 2.2 AA |
| Kolaborasi | Integrasi cek-fakta (Turnbackhoax/Cekfakta) via API resmi bila tersedia; mekanisme banding/koreksi publik |
