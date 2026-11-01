'use strict';
const { Pdf } = require('./pdf.js'); const G = require('../engine/index.js');
const GUARD = /^[=+\-@\t\r]/;
function cell(v) { let s = v === null || v === undefined ? '' : String(v); if (GUARD.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; } // cegah CSV/formula injection
function toCsv(headers, rows) { return '\ufeff' + [headers.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\r\n'); }

function claimsCsv(core) {
  const c = core.corpus(); const H = ['id', 'asal', 'tanggal', 'judul', 'ringkasan', 'topik', 'konfiden_topik', 'sumber', 'url_sumber', 'wilayah', 'status_wilayah', 'sentimen', 'skor_sentimen', 'tipe_epistemik_otomatis', 'label_tampilan', 'konfiden_analisis', 'skor_urgensi', 'level_urgensi', 'lonjakan', 'amplifikasi', 'klaster', 'status_verifikasi', 'jumlah_bukti', 'catatan_verifikasi', 'sintetis'];
  return toCsv(H, c.claims.map((x, i) => { const a = c.analyses[i]; return [x.id, x.origin, x.date, x.title, x.claim, a.topic.topic, a.topic.confidence, x.source, x.sourceUrl, x.region, x.regionStatus, a.sentiment.label, a.sentiment.score, a.epistemic.type, a.epistemicDisplay.label, a.confidence, a.urgency.score, a.urgency.level, a.burst.burst, a.amplified, a.clusterId, x.status, x.evidenceCount, x.verificationNote, x.isSynthetic]; }));
}
function alertsCsv(core) { return toCsv(['id', 'waktu', 'level', 'jenis', 'judul', 'alasan', 'url_bukti', 'dikonfirmasi', 'oleh'], core.store.listAlerts({ limit: 1000 }).map(a => [a.id, a.created_at, a.level, a.kind, a.title, a.detail.why || '', (a.detail.urls || []).join(' | '), a.acknowledged, a.ack_by])); }
function sourcesCsv(core) { return toCsv(['id', 'nama', 'tipe', 'url', 'tier', 'aktif', 'interval_menit', 'konfirmasi_tos', 'robots_diizinkan', 'catatan_robots', 'run_terakhir', 'status_terakhir'], core.store.listSources().map(s => [s.id, s.name, s.type, s.url, s.tier, s.enabled, s.intervalMin, s.tosAck, s.robotsAllowed, s.robotsNote, s.lastRunAt, s.lastStatus])); }
function runsCsv(core) { return toCsv(['id', 'sumber', 'mulai', 'selesai', 'status', 'pemicu', 'http', 'diambil', 'bersih', 'dibuang', 'duplikat', 'baru', 'alert', 'pesan'], core.store.listRuns(1000).map(r => [r.id, r.source_name || r.source_id, r.started_at, r.finished_at, r.status, r.trigger, r.http_status, r.fetched, r.cleaned, r.dropped, r.duplicates, r.inserted, r.alerts, r.message])); }

function credibilityRows(core) {
  const c = core.corpus(); const bySrc = new Map();
  c.claims.forEach(x => { const k = x.sourceId || x.source; if (!bySrc.has(k)) bySrc.set(k, { name: x.source, items: 0, verified: 0, false: 0, misleading: 0, context: 0 }); const o = bySrc.get(k); o.items++; if (x.status === 'verified') o.verified++; else if (x.status === 'false') o.false++; else if (x.status === 'misleading') o.misleading++; else if (x.status === 'context-needed') o.context++; });
  const srcs = new Map(core.store.listSources().map(s => [s.id, s]));
  return [...bySrc.entries()].map(([k, o]) => { const s = srcs.get(k); const tier = s ? s.tier : 'D'; return { id: k, name: s ? s.name : o.name, tier, tierLabel: G.nlp.TIER_LABEL[tier], items: o.items, credibility: G.nlp.sourceCredibility(tier, o), managed: !!s }; }).sort((a, b) => b.credibility.score - a.credibility.score);
}

function buildPdf(core) {
  const c = core.corpus(); const ov = G.analytics.buildOverview(c); const pdf = new Pdf({ title: 'Laporan Intelijen Narasi — GARDA NARASI', footer: 'GARDA NARASI 0.2.0 — laporan analitik; bukan penetapan kebenaran, bukan dasar tunggal tindakan.' });
  const fmt = d => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(d));
  pdf.h1('Laporan Intelijen Narasi Publik'); pdf.para(`Dibuat ${fmt(new Date())} WIB · Data hingga ${fmt(ov.referenceTime)} · ${ov.kpis.total} catatan (${ov.kpis.live} hasil pengumpulan otomatis, ${ov.kpis.synthetic} sintetis).`, { size: 9, color: '#586274' });
  pdf.para('Ruang lingkup: ringkasan dinamika narasi publik untuk membantu prioritas verifikasi. Laporan ini tidak menyatakan sebuah informasi sebagai hoaks; status verifikasi hanya berasal dari pemeriksa manusia dengan bukti tercatat.', { size: 9.5 });
  pdf.h2('Ringkasan eksekutif');
  [['Perlu verifikasi', ov.kpis.pending], ['Prioritas tinggi (skor ≥ 70)', ov.kpis.highPriority], ['Klaster narasi', ov.kpis.clusters], ['Klaster dengan lonjakan', ov.kpis.burstClusters], ['Kandidat amplifikasi lintas sumber', ov.kpis.amplification]].forEach(([l, v]) => pdf.bar(l, v, Math.max(ov.kpis.total, 1), { color: '#2f6f8f' }));
  pdf.bar('Indeks tekanan narasi (0–100)', ov.pressure.value, 100, { color: ov.pressure.value >= 60 ? '#c0392b' : ov.pressure.value >= 35 ? '#d68910' : '#2e8b6f' });
  pdf.para(`Indeks tekanan = 0,45×porsi antrean berurgensi tinggi (${ov.pressure.parts.highShare}%) + 0,30×porsi klaster berlonjak (${ov.pressure.parts.burstShare}%) + 0,25×sinyal amplifikasi (${ov.pressure.parts.amplification}%). Ini ringkasan heuristik, bukan ukuran ancaman.`, { size: 8.5, color: '#586274' });
  pdf.h2('Komposisi topik'); ov.topics.slice(0, 8).forEach(t => pdf.bar(t.topic, t.mentions, ov.topics[0].mentions, { color: '#4a5fa8', right: `${t.count} klaim` }));
  pdf.h2('Penanda epistemik (otomatis, dari bahasa teks)'); const EL = { unverified: 'Klaim belum terverifikasi', speculation: 'Dugaan', opinion: 'Opini', factual: 'Pernyataan faktual (atributif)', 'verified-fact': 'Fakta terverifikasi (manusia + bukti)', 'verified-no-evidence': 'Ditandai verified, tanpa bukti' };
  Object.entries(ov.epistemic).forEach(([k, v]) => pdf.bar(EL[k] || k, v, ov.kpis.total, { color: k === 'verified-fact' ? '#2e8b6f' : '#7a6a9e' }));
  pdf.h2('Narasi prioritas'); pdf.table([{ label: 'ID', w: 70 }, { label: 'Narasi', w: 210 }, { label: 'Topik', w: 100 }, { label: 'Skor', w: 36 }, { label: 'Status', w: 70 }], ov.priority.map(p => [p.id, p.title, p.topic, p.score, G.nlp.STATUS[p.status].label]));
  pdf.h2('Peringatan dini terbaru'); const alerts = core.store.listAlerts({ limit: 12 });
  if (alerts.length) pdf.table([{ label: 'Level', w: 50 }, { label: 'Jenis', w: 70 }, { label: 'Peringatan & alasan', w: 330 }, { label: 'Waktu', w: 80 }], alerts.map(a => [a.level.toUpperCase(), a.kind, a.title + (a.detail.why ? ' — ' + a.detail.why : ''), fmt(a.created_at)])); else pdf.para('Belum ada peringatan.', { size: 9 });
  pdf.h2('Kandidat amplifikasi lintas sumber');
  if (c.amplification.length) c.amplification.slice(0, 6).forEach(s => { pdf.para(`${s.sources.length} sumber · indeks ${s.index} · kemiripan rata-rata ${Math.round(s.meanSimilarity * 100)}% · rentang ${s.spanMinutes} menit`, { bold: true, size: 9.5, gap: 1 }); pdf.para(s.claims.map(x => `${x.id}: ${x.title}`).join('\n'), { size: 8.5, indent: 8, gap: 1 }); pdf.para(s.caveat, { size: 8, color: '#8a5a00', indent: 8, gap: 5 }); }); else pdf.para('Tidak ada kandidat. Ini tidak membuktikan tidak adanya aktivitas terkoordinasi.', { size: 9 });
  pdf.h2('Kredibilitas sumber (berbasis hasil verifikasi item)'); pdf.table([{ label: 'Sumber', w: 190 }, { label: 'Tier', w: 40 }, { label: 'Item', w: 36 }, { label: 'Diperiksa', w: 56 }, { label: 'Skor (CI 90%)', w: 90 }], credibilityRows(core).slice(0, 12).map(r => [r.name, r.credibility.tier, r.items, r.credibility.reviewedItems, `${r.credibility.score} (${r.credibility.low}–${r.credibility.high})`]));
  const ev = core.store.lastEval(); pdf.h2('Metodologi, evaluasi, dan keterbatasan');
  if (ev && ev.report) { const r = ev.report, f = x => (x * 100).toFixed(1) + '%'; pdf.para(`Evaluasi model (${fmt(ev.ts)}): sentimen test acc ${f(r.sentiment.test.accuracy)} / macro-F1 ${f(r.sentiment.test.macroF1)}; topik ${f(r.topic.test.accuracy)} / ${f(r.topic.test.macroF1)}; epistemik ${f(r.epistemic.test.accuracy)} / ${f(r.epistemic.test.macroF1)}. Pada set tantangan (tidak dipakai untuk penyetelan): sentimen ${f(r.sentiment.challenge.accuracy)}, topik ${f(r.topic.challenge.accuracy)}, epistemik ${f(r.epistemic.challenge.accuracy)}.`, { size: 9 }); }
  ['Analisis memakai leksikon, TF-IDF, dan cosine similarity berbasis aturan; belum memakai model bahasa/embedding terlatih sehingga rentan terhadap slang, sarkasme, dan parafrase.', 'Dataset evaluasi kecil dan dibuat tim pengembang; angka akurasi tidak dapat digeneralisasi ke data lapangan.', 'Skor urgensi, lonjakan, dan amplifikasi adalah prioritas pemeriksaan — bukan bukti hoaks, bot, koordinasi, atau niat.', 'Lokasi pada peta hanya yang berstatus terverifikasi oleh pemeriksa manusia.'].forEach(t => pdf.para('• ' + t, { size: 8.8, indent: 6, gap: 2 }));
  return pdf.build();
}
module.exports = { claimsCsv, alertsCsv, sourcesCsv, runsCsv, buildPdf, credibilityRows, toCsv };
