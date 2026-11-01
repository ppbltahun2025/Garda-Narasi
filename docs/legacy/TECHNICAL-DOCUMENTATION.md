# DOKUMENTASI TEKNIS — GARDA NARASI 0.1.1

## 1. Arsitektur

```text
Browser pengguna
  ├── index.html                  Antarmuka dan struktur modul
  ├── assets/css/styles.css       Layout responsif dan komponen visual
  └── assets/js/
      ├── app.js                  State, navigasi, import/export, render UI
      ├── engine.js               Normalisasi, sentimen, kemiripan, skor urgensi
      └── charts.js               Grafik canvas tanpa library eksternal

Data lokal
  ├── data/sample-claims.json    Dataset sintetis bawaan
  ├── data/sample-claims.csv     Contoh template impor
  ├── data/demo-evidence.md     Bukti latihan fiktif untuk dua klaim berstatus terverifikasi
  └── localStorage               Dataset kerja pada browser/perangkat aktif
```

Tidak ada server aplikasi, database jarak jauh, API pihak ketiga, maupun pengiriman isi klaim pada versi 0.1.1. Hosting statis hanya menyajikan file aplikasi. Dua klaim demo berstatus terverifikasi merujuk bukti latihan fiktif di `data/demo-evidence.md`.

## 2. Model data

| Field | Tipe | Deskripsi |
|---|---|---|
| `id` | string | ID unik catatan |
| `date` | ISO date string | Waktu catatan/pembaruan |
| `firstSeen` | ISO date string | Waktu awal catatan diketahui |
| `title` | string | Judul ringkas |
| `claim` | string | Pernyataan/narasi yang diperiksa |
| `topic` | string | Kategori isu |
| `region` | string | Lokasi/konteks; dapat berupa konteks fiktif |
| `source` | string | Sumber input yang dicatat |
| `sourceUrl` | URL string | Tautan sumber bila tersedia |
| `channels` | string array | Nama kanal/sumber agregat; bukan daftar akun personal |
| `mentions` | number | Jumlah catatan pembahasan pada dataset |
| `status` | enum | Status verifikasi manusia |
| `verificationNote` | string | Catatan alasan pemeriksaan |
| `evidenceUrl` | URL string | Tautan bukti pembanding |
| `hourlyCounts` | number array | Seri volume per interval jam untuk demo/analisis |
| `isSynthetic` | boolean | Penanda data sintetis |

## 3. Normalisasi teks dan kemiripan

Teks diubah menjadi huruf kecil, normalisasi Unicode, URL dan tanda baca dihapus, spasi dirapikan, lalu kata umum (stopwords) disisihkan. Perbandingan memakai Jaccard similarity:

`J(A,B) = |A ∩ B| / |A ∪ B|`

Ambang awal tampilan kemiripan adalah `0.24`. Ini hanya *candidate similarity*, bukan bukti bahwa dua klaim merujuk fakta yang sama. Peta Narrative Network memvisualisasikan hubungan kanal/sumber agregat dengan topik. Pengelompokan overview menggunakan field `topic`, sehingga masih perlu peningkatan untuk pengelompokan semantik.

## 4. Sentiment heuristic

Mesin menghitung kemunculan kata dari dua daftar leksikon sederhana (positif dan negatif). Jumlah sama menghasilkan netral; lebih banyak kata dari salah satu daftar menghasilkan kecenderungan positif/negatif. Hasil ditampilkan sebagai indikasi pada korpus, bukan label kebenaran, niat, afiliasi, atau opini individu. Sarkasme, negasi, konteks, bahasa daerah, dan kata yang tidak tercantum dapat menyebabkan kesalahan.

## 5. Indikator lonjakan volume

Indikator lonjakan aktif bila:

- Seri berisi minimal 4 titik.
- Titik terakhir sekurangnya 5.
- Titik terakhir minimal 2,5 kali rata-rata titik sebelumnya, dengan batas pembanding minimal 3.

Aturan ini hanya mengidentifikasi perubahan volume agregat. Ia tidak membuktikan koordinasi, otomatisasi, bot, atau niat manipulatif.

## 6. Indikasi amplifikasi lintas kanal

Fungsi `findAmplificationSignals` membandingkan pasangan klaim yang memiliki topik sama, jarak waktu maksimal 90 menit, kemiripan Jaccard minimal 0,34, minimal tiga kanal agregat gabungan, dan minimal dua sumber input berbeda. Pasangan yang lolos ditampilkan sebagai kandidat review. Indikator ini **tidak** membuktikan bot, koordinasi, atau niat manipulatif. Data demo 009–010 sengaja dibuat sebagai contoh sintetis agar fungsi dapat dilihat saat presentasi.

## 7. Skor urgensi

Komponen yang dihitung:

- `volume = min(1, log10(mentions + 1) / 2.3)`
- `recency = 1` jika usia ≤24 jam; `0.72` jika ≤72 jam; `0.42` jika ≤168 jam; selain itu `0.15`.
- `diversity = min(1, jumlah kanal / 5)`
- `review = 1` jika status `needs-review`, selain itu `0.25`.
- `burstBonus = 0.08` jika aturan lonjakan terpenuhi, selain itu `0`.

`score = round(100 × (0.30×volume + 0.25×recency + 0.25×diversity + 0.20×review + burstBonus) / 1.08)`

Kategori tampilan: tinggi ≥70; sedang ≥45 dan <70; rendah <45. Skor mengurutkan antrean verifikasi saja. Skor tidak menyatakan kemungkinan hoaks, tingkat ancaman nasional, atau niat pelaku.

## 8. Status verifikasi

Status `verified`, `false`, `misleading`, dan `context-needed` hanya dapat diubah secara manual melalui formulir review. Sistem menyimpan catatan, status, waktu pembaruan, serta URL bukti. Pada tahap lanjut, keputusan sebaiknya memiliki identitas peran pemeriksa, cap waktu audit yang tidak dapat diubah, dan prosedur tinjauan kedua.

## 9. Keamanan implementasi

- Teks yang dimasukkan pengguna di-escape sebelum dimasukkan ke template HTML.
- Tautan sumber hanya dibuka bila protokolnya HTTP/HTTPS.
- Tidak ada `eval`, pemuatan skrip eksternal, atau API backend.
- Ukuran file impor dibatasi 5 MB dan 1.000 klaim.
- Nilai dan jumlah kanal dibatasi saat normalisasi.
- `localStorage` bukan penyimpanan terenkripsi atau multi-user; jangan masukkan data rahasia.

## 10. Batasan versi 0.1.1

1. Tidak melakukan scraping otomatis media sosial.
2. Belum memiliki konektor RSS/API; data dimasukkan manual atau melalui berkas.
3. Pengelompokan topik dan kemiripan teks masih sederhana.
4. Analisis sentimen leksikon bukan model bahasa dan belum tervalidasi pada korpus Indonesia yang luas.
5. Skor urgensi menggunakan bobot heuristik dan perlu dikalibrasi bersama pengguna.
6. Belum ada autentikasi, peran pengguna, audit server, atau sinkronisasi lintas perangkat.
7. Data demo bersifat sintetis dan tidak dapat digunakan untuk menyimpulkan kondisi riil.

## 11. Pengembangan teknis berikutnya

- Buat gold-standard dataset yang dikurasi dan mendapat izin penggunaan.
- Bandingkan pengelompokan Jaccard dengan TF-IDF/cosine atau embedding bahasa Indonesia.
- Buat metrik cluster quality dan reviewer agreement.
- Catat waktu akuisisi dan provenance setiap sumber.
- Tambahkan uji bias terhadap bahasa daerah, istilah lokal, dan variasi ejaan.
- Pertimbangkan backend hanya setelah model ancaman, akses, retensi, dan keamanan data disetujui.
