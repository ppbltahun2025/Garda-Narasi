# RENCANA PENGUJIAN — GARDA NARASI 0.1.1

## Tujuan

Membuktikan alur prototipe berfungsi, hasil analisis dapat dijelaskan, dan keterbatasannya terlihat. Semua pengujian fungsional menggunakan dataset sintetis atau data yang diizinkan.

## Lingkungan

- Browser desktop: Chrome / Edge versi terbaru.
- Browser mobile: Chrome Android atau mode responsive browser.
- Server lokal: VS Code Live Server atau `python -m http.server 8000`.
- Penyimpanan: localStorage browser.

## Kasus uji

| ID | Pengujian | Langkah | Hasil yang diharapkan |
|---|---|---|---|
| TC-01 | Inisialisasi | Hapus localStorage untuk domain, reload via localhost | Dataset JSON demo termuat; KPI tidak kosong |
| TC-02 | Navigasi | Buka kelima menu sidebar | Tampilan modul sesuai menu; tidak reload halaman |
| TC-03 | Pencarian | Cari kata `evakuasi` di Narrative Intelligence | Hanya catatan yang cocok tampil |
| TC-04 | Filter topik | Pilih `Infrastruktur` | Daftar hanya menampilkan topik tersebut |
| TC-05 | Filter status | Pilih `Perlu verifikasi` | Hanya status `needs-review` yang muncul |
| TC-06 | Detail klaim | Klik Analisis detail | Isi klaim, metadata, skor, faktor, dan kemiripan terlihat |
| TC-07 | Review manusia | Ubah status dan isi catatan/bukti lalu simpan | Status dan catatan berubah di daftar dan tersimpan setelah reload |
| TC-08 | Skor bukan vonis | Buka klaim dengan skor tinggi | UI menyebut skor urgensi, bukan tingkat kebenaran; status tetap sesuai review |
| TC-09 | Lonjakan | Gunakan seri `[1,1,2,2,3,3,4,5,9]` pada data uji | Indikator lonjakan aktif jika syarat baseline terpenuhi |
| TC-10 | Tambah klaim | Isi form Tambah klaim | Klaim baru masuk dengan status perlu verifikasi |
| TC-11 | Impor JSON | Impor `data/sample-claims.json` ke workspace kosong | Klaim dimuat; ID duplikat diabaikan |
| TC-12 | Impor CSV | Impor `data/sample-claims.csv` | Dua baris data masuk dan kanal dipisahkan dengan `|` |
| TC-13 | JSON invalid | Impor JSON rusak | Pesan kesalahan muncul; data lama tidak hilang |
| TC-14 | Ukuran file | Impor file di atas 5 MB | Aplikasi menolak file dengan pesan batas ukuran |
| TC-15 | Export JSON | Tekan Export JSON | File JSON terunduh dan dapat dibuka kembali |
| TC-16 | Export CSV | Tekan Export CSV | File CSV terunduh dan dapat dibuka di spreadsheet |
| TC-17 | Draf klarifikasi | Tekan Salin draf klarifikasi | Teks berhati-hati tersalin atau diunduh sebagai fallback |
| TC-18 | URL tidak aman | Impor data dengan `javascript:alert(1)` sebagai URL | Link tidak menjadi link aktif |
| TC-19 | XSS teks | Tambahkan judul berisi `<img src=x onerror=alert(1)>` | Teks tampil literal/escaped; tidak ada skrip berjalan |
| TC-20 | Responsif | Uji lebar 390px, 768px, 1366px | Sidebar, tabel, form, dan kartu tetap dapat digunakan |
| TC-21 | Persistensi | Tambah klaim lalu reload | Dataset tetap ada pada browser yang sama |
| TC-22 | Reset demo | Klik Muat ulang dataset demo dan setujui | Dataset kembali ke sepuluh contoh sintetis |
| TC-23 | Sentiment Analysis | Buka menu Sentiment Analysis | Distribusi agregat dan per topik tampil; disclaimer terlihat |
| TC-24 | Narrative Network | Buka menu Narrative Network | Peta hubungan kanal/topik dan ringkasan tampil |
| TC-25 | Amplifikasi kandidat | Buka Early Warning | Pasangan GN-DEMO-009/010 muncul sebagai kandidat review |
| TC-26 | Batasan amplifikasi | Periksa teks panel amplifikasi | UI menyatakan pola bukan bukti bot/koordinasi |
| TC-27 | Data sintetis | Buka banner dan detail data demo | Data demo ditandai sintetis dan wilayah fiktif |

## Uji logika engine dengan Node.js

Jalankan juga tes otomatis yang disediakan: `node tests/engine.test.js`. Hasil yang diharapkan adalah `GARDA NARASI engine tests: PASS`.

Pada komputer yang memiliki Node.js, jalankan:

```bash
node --check assets/js/engine.js
node --check assets/js/charts.js
node --check assets/js/app.js
```

Pemeriksaan ini menguji sintaks, bukan menggantikan uji UI pada browser.

## Checklist hasil sebelum submission

- [ ] Semua TC-01 sampai TC-22 dicoba.
- [ ] Catat browser, perangkat, tanggal, dan hasil aktual.
- [ ] Simpan screenshot hasil pengujian yang benar-benar dilakukan.
- [ ] Jangan mengklaim semua tes lulus bila belum dieksekusi.
- [ ] Uji URL publik GitHub Pages pada browser/perangkat lain.
- [ ] Pastikan dataset contoh diberi label sintetis pada video demo.
- [ ] Pastikan link dan dokumen submission bisa dibuka tanpa login khusus.
