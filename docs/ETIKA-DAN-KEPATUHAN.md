# Etika & kepatuhan

| Prinsip | Implementasi |
|---|---|
| Tidak melabeli hoaks otomatis | Hasil mesin = *penanda & prioritas*. Status verifikasi hanya dari pemeriksa manusia dengan alasan ≥ 20 karakter dan bukti tercatat; vonis negatif perlu pemeriksa kedua. "Fakta terverifikasi" tidak dapat dihasilkan mesin. |
| Transparansi | Setiap keluaran menampilkan confidence dan bukti (kata/penanda pendorong, rumus skor). Metodologi & keterbatasan tercetak di PDF. |
| robots.txt & ToS | Setiap sumber butuh konfirmasi ToS atas nama pengelola; robots.txt dicek dengan RFC 9309; robots tak terjangkau ⇒ **tunda**; Crawl-delay dan 429/503 dihormati; User-Agent jujur memuat kontak. |
| Tanpa penerobosan akses | Tidak ada fitur login, CAPTCHA, paywall, atau penyamaran UA; redirect lintas-host ditolak. |
| Hak cipta | Hanya judul, tautan, dan kutipan ≤ 400 karakter; teks penuh tidak disalin; tautan selalu mengarah ke sumber asli. |
| Privasi | Email/telepon/NIK/@akun dimasking sebelum disimpan; field penulis tidak dibaca; tidak ada profil individu — graf jaringan hanya sumber ↔ klaster ↔ topik agregat. |
| Kehati-hatian atas amplifikasi | Selalu disertai catatan: kemiripan & kedekatan waktu ≠ bukti bot/koordinasi/niat; kantor berita & siaran pers menghasilkan kemiripan sah. |
| Akuntabilitas | Jejak audit untuk keputusan, perubahan sumber, run, dan peringatan. |

**Tanggung jawab operator**: memastikan dasar hukum pengumpulan (mis. UU PDP bila ada data pribadi), kebijakan retensi (lihat `MAX_AGE_DAYS`, hapus data berkala), pelatihan pemeriksa, dan mekanisme koreksi/keberatan publik. Sistem ini **tidak** dirancang untuk pemantauan individu, penindakan otomatis, atau penyensoran.
