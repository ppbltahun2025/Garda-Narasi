# API REST (JSON)

Basis: `http://HOST:PORT`. Bila `GARDA_API_TOKEN` diset: header `Authorization: Bearer <token>` (untuk `/api/stream` dan `/api/report/*` boleh `?token=`). Identitas pencatat audit: header `X-Reviewer: <nama (URL-encoded)>`. Galat: `{"error":"…"}` dengan status 4xx/5xx.

| Metode & path | Fungsi |
|---|---|
| `GET /api/health` | status, versi, jumlah klaim, apakah token/empat-mata aktif (tanpa auth) |
| `GET /api/overview` | KPI, indeks tekanan, tren harian, heatmap, sentimen, epistemik, topik, geo, jaringan, prioritas |
| `GET /api/claims?q&topic&status&origin&cluster&region&sort=urgency\|date\|mentions&limit&offset` | daftar klaim + analisis ringkas |
| `GET /api/claims/:id` | detail: analisis + bukti istilah, urgensi, klaster, serupa, amplifikasi, evidence, riwayat review |
| `POST /api/claims` `{title,claim?,topic?,region?,source?,sourceUrl?,mentions?}` | tambah klaim manual (PII dimasking) |
| `POST /api/claims/import` `{claims:[…]}` (≤1000) | impor; ID yang sudah ada dilewati |
| `POST /api/claims/:id/review` `{status,note,reviewer,role?}` | keputusan manusia (lihat aturan di bawah) |
| `POST /api/claims/:id/evidence` `{url,stance,kind,title?,note?}` · `DELETE /api/evidence/:id` | evidence tracker |
| `POST /api/claims/:id/region` `{code,status}` | verifikasi lokasi (kode `ID-JB` dst.) |
| `GET /api/verification/queue` | antrean `needs-review` + usulan menunggu pemeriksa kedua |
| `GET /api/clusters` · `GET /api/clusters/:id` | klaster (id `K001` atau stabil `C-…`) |
| `GET /api/amplification` | kandidat amplifikasi lintas sumber |
| `GET /api/geo` | provinsi + hitung terverifikasi/kandidat + 5 isu teratas |
| `GET /api/credibility` | skor kredibilitas sumber + rentang |
| `POST /api/analyze` `{text}` | analisis teks bebas (tidak disimpan) |
| `GET /api/alerts?open=1&limit` · `POST /api/alerts/:id/ack` · `POST /api/alerts/test` | peringatan |
| `GET /api/stream` | SSE: event `alert`, `run` |
| `GET/PUT /api/settings` `{webhookUrl,webhookMinLevel}` | notifikasi webhook |
| `GET/POST /api/sources` · `PATCH/DELETE /api/sources/:id` | kelola sumber (aktifkan butuh `tosAck`) |
| `POST /api/sources/:id/run` · `POST /api/sources/:id/robots-check` · `POST /api/pipeline/run-all` | jalankan/cek manual |
| `GET /api/runs?source&limit` · `GET /api/pipeline` · `GET /api/audit` | riwayat, status tahap, audit |
| `GET /api/evaluation` · `POST /api/evaluation/run` | laporan evaluasi model |
| `GET /api/report/{intelligence.pdf,claims.csv,alerts.csv,sources.csv,runs.csv}` | laporan |
| `POST /api/demo/reset` | muat ulang klaim demo |

## Aturan keputusan verifikasi (`POST …/review`)
* `reviewer` ≥ 2 karakter; `note` ≥ 20 karakter kecuali kembali ke `needs-review`.
* `verified` butuh ≥1 bukti `supports`; `false`/`misleading` butuh ≥1 bukti `contradicts`/`context` (atau `evidenceUrl` lama).
* Bila `FOUR_EYES=true`: `false`/`misleading` hanya **diusulkan** (`pendingSecondReview:true`); status berubah setelah pemeriksa **berbeda** mengirim keputusan yang sama (409 bila orang yang sama).

## Contoh
```bash
curl -s localhost:8787/api/claims?sort=urgency&limit=3
curl -s -X POST localhost:8787/api/analyze -H 'content-type: application/json' -d '{"text":"Katanya jalan tol ditutup besok, belum dikonfirmasi"}'
curl -OJ localhost:8787/api/report/intelligence.pdf
```
