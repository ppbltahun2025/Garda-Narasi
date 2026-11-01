# DRAF PROPOSAL SOLUSI

## GARDA NARASI: Platform Analisis Narasi dan Peringatan Dini Risiko Informasi Publik Berbasis Verifikasi Manusia

**Kategori:** 04 — Cognitive Domain (Siber Sosial)  
**Bentuk karya:** Aplikasi web prototipe, local-first  
**Pengusul:** Peserta individu  
**Versi:** 0.1.1

## 1. Ringkasan eksekutif

GARDA NARASI adalah prototipe platform analisis ruang informasi publik yang membantu analis mengidentifikasi kelompok klaim, memantau perubahan volume pembahasan, melihat indikasi pola amplifikasi, dan memprioritaskan verifikasi. Sistem menggabungkan pengelompokan topik, kemiripan teks sederhana, indikator volume dan kebaruan, analisis sentimen leksikon, serta pencatatan pemeriksaan manusia dalam satu dashboard.

Fokus penggunaan yang diusulkan adalah ketahanan informasi publik pada isu layanan penting dan situasi krisis, misalnya informasi mengenai bencana, konektivitas, energi, transportasi, kesehatan, dan layanan publik. Informasi keliru tentang status layanan, jalur evakuasi, atau kondisi infrastruktur dapat membingungkan masyarakat dan menyulitkan komunikasi krisis. GARDA NARASI dirancang sebagai alat bantu situational awareness, bukan pengganti kanal resmi atau keputusan petugas.

Seluruh pengolahan pada prototipe dilakukan di browser dan data tersimpan lokal. Dataset bawaan menggunakan skenario fiktif. Sistem tidak memantau identitas individu, tidak memberi label akun sebagai buzzer/bot, dan tidak menetapkan kebenaran klaim secara otomatis.

## 2. Latar belakang masalah

Arus informasi digital dapat memuat laporan awal, opini, rumor, konten lama yang beredar ulang, dan informasi yang belum terkonfirmasi. Dalam situasi krisis atau gangguan layanan penting, analis perlu menjawab sejumlah pertanyaan secara cepat: isu apa yang sedang meningkat, klaim mana yang memiliki kemiripan, sumber apa yang disebutkan, konteks waktu dan lokasi apa yang tersedia, serta klaim mana yang harus diperiksa lebih dahulu.

Pemantauan manual berpotensi menyulitkan proses pengelompokan dan pencatatan. Di sisi lain, klasifikasi otomatis tanpa transparansi dapat menghasilkan salah label dan mengikis kepercayaan. Karena itu dibutuhkan pendekatan yang menggabungkan analisis terukur, bukti yang dapat ditelusuri, dan verifikasi manusia.

## 3. Rumusan masalah

1. Bagaimana mengelompokkan klaim publik yang membahas topik serupa secara sederhana dan transparan?
2. Bagaimana mengidentifikasi lonjakan volume pembahasan tanpa langsung menyimpulkan adanya bot atau koordinasi tidak autentik?
3. Bagaimana membantu analis menentukan urutan pemeriksaan berdasarkan urgensi, bukan berdasarkan asumsi kebenaran?
4. Bagaimana menyimpan alasan dan bukti verifikasi agar keputusan dapat ditinjau ulang?

## 4. Tujuan

- Menyediakan dashboard ringkas untuk memahami dinamika isu publik.
- Mengelompokkan catatan berdasarkan topik dan petunjuk kemiripan teks.
- Menampilkan indikator volume, kebaruan, keragaman kanal, dan lonjakan pembahasan.
- Menyediakan ruang pencatatan bukti serta hasil verifikasi manusia.
- Menyediakan ekspor dataset dan ringkasan analisis untuk dokumentasi.

## 5. Sasaran pengguna dan manfaat

Sasaran pengguna awal adalah analis informasi, pengelola komunikasi publik, tim respons krisis, peneliti literasi digital, dan pengelola layanan publik. Manfaat yang diharapkan adalah mempercepat orientasi awal terhadap isu, membuat antrean pemeriksaan lebih terstruktur, menjaga keterlacakan bukti, dan membantu penyusunan komunikasi publik yang berhati-hati.

Untuk konteks pertahanan siber, pendekatan ini dapat dikembangkan sebagai lapisan pemahaman lingkungan informasi eksternal yang berkaitan dengan gangguan layanan kritis atau infrastruktur pendukung. Prototipe ini **tidak** mengakses jaringan, sistem, atau data internal TNI AD; relevansi operasional spesifik harus divalidasi bersama pemangku kepentingan yang berwenang sebelum penerapan.

## 6. Solusi dan inovasi

GARDA NARASI terdiri dari tujuh modul:

1. **National Insight Dashboard** — ringkasan volume, status review, prioritas, dan indikasi sentimen.
2. **Narrative Intelligence** — pencarian, filter, pengelompokan topik, dan kemiripan token Jaccard.
3. **Virality & Amplification Detector** — indikator lonjakan agregat dan kandidat amplifikasi lintas kanal berdasarkan kemiripan teks, kedekatan waktu, dan keragaman kanal. Hasilnya bukan bukti bot atau koordinasi.
4. **Claim Verification Center** — catatan pemeriksaan manusia, status, alasan, dan URL bukti pembanding.
5. **Public Sentiment** — analisis leksikon sederhana pada kumpulan klaim, ditampilkan secara agregat dan per topik.
6. **Narrative Network** — visualisasi hubungan kanal/sumber agregat dengan kelompok topik; tanpa identitas akun personal.
7. **Early Warning Center** — skor urgensi yang faktor pembentuknya dapat diperiksa.
8. **Intelligence Report** — impor/ekspor CSV dan JSON serta draf klarifikasi yang perlu persetujuan manusia.

Inovasi utama bukan klaim bahwa sistem dapat mengetahui hoaks secara sempurna. Nilai yang ditawarkan adalah *explainable triage*: setiap prioritas memiliki alasan yang dapat dilihat, sedangkan kesimpulan faktual tetap ditentukan oleh verifikator berdasarkan bukti.

## 7. Metode kerja sistem

1. **Input:** analis memasukkan data manual atau mengimpor CSV/JSON dari sumber yang sah diakses.
2. **Normalisasi:** teks dibersihkan, waktu dinormalisasi, dan atribut penting diseragamkan.
3. **Pengelompokan:** klaim dikelompokkan berdasarkan topik; kemiripan token digunakan sebagai petunjuk tambahan.
4. **Analisis:** sistem menghitung volume, kebaruan, jumlah kanal, indikasi lonjakan, dan kecenderungan leksikon.
5. **Prioritisasi:** skor urgensi mengurutkan kebutuhan review; skor bukan probabilitas kebenaran.
6. **Verifikasi:** pemeriksa manusia mencatat status, alasan, dan bukti pembanding.
7. **Pelaporan:** data dan ringkasan dapat diekspor untuk dokumentasi.

## 8. Teknologi

- HTML5 untuk struktur antarmuka.
- CSS3 untuk desain responsif.
- JavaScript murni untuk normalisasi, analisis, visualisasi, validasi input, dan ekspor.
- Browser `localStorage` untuk penyimpanan lokal prototipe.
- Canvas API untuk grafik sederhana tanpa dependensi chart eksternal.
- GitHub Pages sebagai opsi hosting statis demo.

## 9. Pengujian dan evaluasi

Pengujian awal menggunakan dataset sintetis dengan skenario yang diketahui. Pengujian mencakup validitas impor, konsistensi skor, deteksi pola lonjakan, pencatatan verifikasi, ekspor data, keamanan tampilan teks, dan responsivitas perangkat. Untuk evaluasi lanjutan, dataset berlabel harus disiapkan secara terpisah agar metrik precision/recall dapat dihitung secara sahih. Versi 0.1.1 tidak mengklaim akurasi klasifikasi hoaks.

## 10. Privasi, etika, dan batasan

- Hanya menggunakan data publik yang sah diakses, data berizin, atau dataset sintetis.
- Tidak menyimpan identitas personal yang tidak diperlukan.
- Tidak memonitor akun individu atau membuat daftar orang yang dicurigai sebagai buzzer.
- Tidak menyamakan kritik atau sentimen negatif dengan ancaman.
- Tidak menerbitkan klarifikasi otomatis; seluruh draf perlu ditinjau manusia.
- Tidak mengklaim akses atau integrasi dengan sistem internal instansi.

## 11. Rencana pengembangan

Tahap berikutnya adalah meningkatkan pengelompokan semantik, menambah provenance sumber, menyusun dataset berlabel yang representatif, mengembangkan konektor sumber publik sesuai ketentuan layanan, dan mengevaluasi manfaat dengan calon pengguna. Backend multi-pengguna hanya akan ditambahkan jika kebutuhan dan tata kelola data sudah jelas.

## 12. Kesimpulan

GARDA NARASI menawarkan pendekatan analisis informasi publik yang transparan, dapat diuji, dan menempatkan manusia sebagai pengambil keputusan. Dengan membantu analis memahami perubahan narasi dan memprioritaskan verifikasi berbasis bukti, prototipe ini diharapkan mendukung ketahanan informasi masyarakat, khususnya ketika isu berkaitan dengan layanan penting dan situasi krisis.
