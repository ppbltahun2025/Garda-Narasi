# Dataset & evaluasi akurasi model

Jalankan: `npm run eval` (CLI) atau **Lab & evaluasi → Evaluasi model** (UI). Laporan lengkap tersimpan di `docs/eval-report.json` (termasuk confusion matrix dan daftar salah-prediksi).

## Dataset (`data/eval/`, Bahasa Indonesia, dibuat tim pengembang)
| Berkas | Tugas | Kelas | Item |
|---|---|---|---|
| `sentiment.json` | sentimen nada teks | positif / netral / negatif | 75 |
| `topic.json` | topik utama | 10 topik | 88 |
| `epistemic.json` | sifat pernyataan | klaim belum terverifikasi / dugaan / opini / faktual-atributif | 78 |
| `pairs.json` | pasangan narasi sama? (parafrase vs berbeda, termasuk *hard negatives*) | 1/0 | 68 pasang |

Setiap berkas memuat `guideline` (pedoman anotasi) dan tiga split: **dev** (30% per kelas, dipakai saat menyusun leksikon/ambang), **test** (70% per kelas, hanya dilaporkan), dan **challenge** (ditulis terpisah: slang, idiom, kalimat campuran; **tidak dipakai menyetel apa pun**).

## Hasil (engine 0.2.0)
| Tugas | Dev akurasi | Test akurasi / macro-F1 | Challenge akurasi / macro-F1 |
|---|---|---|---|
| Sentimen | 100,0% | 90,5% / 90,3% | 60,0% / 58,9% |
| Topik | 93,3% | 92,0% / 92,5% | 37,5% / 37,5% |
| Sifat pernyataan | 100,0% | 100,0% / 100,0% | 64,3% / 60,4% |

Sentimen (test, n=42): kelas netral recall 71,4% — empat kalimat netral diprediksi positif karena kata leksikon positif ("resmi", "tersedia", "stabil") dan artefak stemmer ("keamanan" → "aman" → positif). Positif precision 77,8%; negatif 100%/100%. Rincian per kelas dan confusion matrix ada di UI dan JSON.

**Kemiripan narasi** (ambang dipilih di dev, dilaporkan di test dan challenge):
| Metode | Ambang | Test P | Test R | Test F1 | Challenge F1 |
|---|---|---|---|---|---|
| Jaccard token (baseline 0.1.1) | 0,19 | 69,0% | 95,2% | 80,0% | 76,9% |
| TF-IDF cosine (unigram) | 0,22 | 69,0% | 95,2% | 80,0% | 76,9% |
| TF-IDF cosine + stemming | 0,26 | 75,0% | 100% | 85,7% | 76,9% |
| TF-IDF cosine + stemming + bigram | 0,18 | 72,4% | 100% | 84,0% | 76,9% |
| **+ stemming + konsep (dipakai engine)** | 0,26 | 75,0% | 100% | **85,7%** | 76,9% |

## Cara membaca angka ini (jujur)
1. **Angka test terlalu optimistis.** Dataset, leksikon, dan penanda epistemik dibuat oleh pihak yang sama; kosakata saling tumpang-tindih. Skor epistemik 100% pada test mencerminkan itu, **bukan** kemampuan umum.
2. **Angka challenge lebih realistis** untuk teks bebas (slang, idiom, kalimat campuran): 38–64%. Pendekatan leksikon rapuh terhadap parafrase di luar kosakata; topik gagal pada teks tanpa kata kunci benih (jatuh ke "Informasi umum").
3. Peningkatan Jaccard → TF-IDF+stemming+konsep **nyata di test (F1 80,0 → 85,7)** tetapi **tidak tampak di challenge** (8 pasang; sampel terlalu kecil untuk kesimpulan).
4. Precision kemiripan ±75% berarti **1 dari 4 pasangan terdeteksi bisa keliru** ⇒ amplifikasi hanya disebut *kandidat*, wajib ditinjau manusia.
5. Ukuran sampel kecil: selisih beberapa poin persen ≈ 1–2 item. Jangan membandingkan model berdasarkan selisih sekecil itu.

### Catatan integritas proses
* Saat pengembangan ditemukan dua cacat evaluasi dan **diperbaiki sebelum angka di atas dilaporkan**: (a) prediksi di luar daftar kelas (mis. "Informasi umum") sempat terbuang diam-diam dari matriks sehingga akurasi terlihat lebih tinggi — kini dihitung sebagai salah; (b) pembagian dev/test awal tidak stratifikasi (tiga topik tanpa item test) — kini stratifikasi per kelas. Karena leksikon sempat disempurnakan sambil melihat galat dev lama, sebagian item test baru pernah "terlihat" secara tidak langsung ⇒ alasan tambahan menganggap angka test optimistis.
* Ambang kemiripan: bila beberapa ambang menghasilkan F1 dev sama, dipilih yang **tertinggi** (lebih konservatif); aturan ditetapkan sebelum melihat hasil test.

## Memperluas evaluasi (disarankan sebelum dipakai operasional)
1. Kumpulkan ≥ 500 item **dari domain Anda**, dianotasi ≥ 2 orang; ukur kesepakatan (Cohen's κ). 2. Simpan sebagai berkas baru dengan format sama dan jalankan `npm run eval`. 3. Jangan menyetel leksikon pada split test. 4. Pantau metrik per sumber/topik, bukan hanya rata-rata. 5. Bandingkan dengan model terlatih (IndoBERT/IndoNLU, embedding multibahasa) memakai antarmuka yang sama.
