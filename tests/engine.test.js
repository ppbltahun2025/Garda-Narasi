'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const G = require('../engine/index.js'); const N = G.nlp, E = G.evaluate;

test('normalisasi: slang, URL, huruf berulang', () => {
  assert.equal(N.normalize('Gak ada info https://x.id banget bangeeet!!'), 'tidak ada informasi banget banget');
});
test('PII dimasking', () => {
  const t = N.maskPII('Hubungi budi@mail.com atau 081234567890, NIK 3174012345678901, @akunku');
  assert.ok(!/budi@|0812|3174/.test(t)); assert.match(t, /\[email\]/); assert.match(t, /\[telepon\]/); assert.match(t, /\[nik\]/); assert.match(t, /\[akun\]/);
});
test('stemmer: kata terlindungi tidak rusak, imbuhan umum dipangkas', () => {
  assert.equal(N.stem('menteri'), 'menteri'); assert.equal(N.stem('pemerintah'), 'pemerintah'); assert.equal(N.stem('pembangunan'), 'bangun'); assert.equal(N.stem('kebakaran'), 'kebakaran');
});
test('sentimen: negasi dan intensitas', () => {
  assert.equal(N.sentiment('Layanan sudah pulih dan berjalan lancar, warga lega').label, 'positive');
  assert.equal(N.sentiment('Jembatan ambruk, warga panik dan sangat kecewa').label, 'negative');
  assert.equal(N.sentiment('Pengumuman jadwal rapat dibacakan di balai desa').label, 'neutral');
  const neg = N.sentiment('Kondisi tidak aman dan membahayakan warga'); assert.ok(neg.score < 0, 'frasa "tidak aman" harus negatif');
  const flipped = N.sentiment('Pelayanannya tidak buruk'); assert.ok(flipped.score > 0, 'negasi membalik kata negatif');
});
test('epistemik: kelas dan penutupan tumpang-tindih frasa', () => {
  assert.equal(N.epistemic('Beredar pesan berantai, kabarnya belum dikonfirmasi').type, 'unverified');
  assert.equal(N.epistemic('Diduga kebocoran berasal dari pihak ketiga').type, 'speculation');
  assert.equal(N.epistemic('Menurut saya kebijakan ini tidak adil').type, 'opinion');
  assert.equal(N.epistemic('BMKG mencatat gempa magnitudo 5,2 pada pukul 03.15 WIB').type, 'factual');
  const cues = N.epistemic('belum dikonfirmasi petugas').cues.map(c => c.cue); assert.ok(!cues.includes('dikonfirmasi'), 'cue pendek tidak boleh bocor dari frasa panjang');
});
test('"Fakta terverifikasi" hanya dari manusia + bukti', () => {
  const auto = N.epistemic('BMKG mencatat gempa magnitudo 5,2');
  assert.equal(N.epistemicDisplay(auto, 'needs-review', false).key, 'factual');
  assert.equal(N.epistemicDisplay(auto, 'verified', false).key, 'verified-no-evidence');
  assert.equal(N.epistemicDisplay(auto, 'verified', true).key, 'verified-fact');
});
test('TF-IDF cosine: parafrase > topik berbeda', () => {
  const a = N.textSimilarity('Harga cabai rawit naik drastis di pasar tradisional.', 'Cabai rawit melonjak harganya di pasar-pasar tradisional.');
  const b = N.textSimilarity('Harga cabai rawit naik drastis di pasar tradisional.', 'Jembatan layang baru diresmikan dan dibuka untuk kendaraan umum.');
  assert.ok(a > 0.3 && a > b + 0.2, `a=${a} b=${b}`);
});
test('deteksi lonjakan EWMA-z', () => {
  assert.equal(N.detectBurst([2, 3, 2, 3, 2, 3, 2, 14]).burst, true);
  assert.equal(N.detectBurst([2, 3, 2, 3, 2, 3, 2, 4]).burst, false);
  assert.equal(N.detectBurst([1, 2]).burst, false);
});
test('lokasi: kandidat dari gazetteer', () => {
  const l = N.extractLocations('Jembatan di Kota Bandung dan Jawa Tengah rusak').map(x => x.code).sort(); assert.deepEqual(l, ['ID-JB', 'ID-JT']);
});
const mk = (id, src, title, minsAgo, extra = {}) => N.normalizeClaim({ id, source: src, channels: [src], title, claim: title, date: new Date(Date.parse('2026-11-01T08:00:00Z') - minsAgo * 60000).toISOString(), ...extra });
test('amplifikasi: butuh ≥3 sumber berbeda; 1 sumber tidak cukup', () => {
  const T = 'Pesan berantai sebut listrik padam tiga hari di seluruh kota, belum dikonfirmasi';
  const three = N.analyzeCorpus([mk('a', 'S1', T, 30), mk('b', 'S2', T + ' beredar luas', 20), mk('c', 'S3', 'Kabar listrik padam tiga hari di seluruh kota beredar, belum dikonfirmasi', 10), mk('z', 'S9', 'Jadwal ujian sekolah diumumkan dinas pendidikan', 15)], { now: '2026-11-01T08:00:00Z' });
  assert.equal(three.amplification.length, 1); assert.deepEqual([...three.amplification[0].claimIds].sort(), ['a', 'b', 'c']); assert.match(three.amplification[0].caveat, /bukan bukti|sah/i);
  const one = N.analyzeCorpus([mk('a', 'S1', T, 30), mk('b', 'S1', T + ' beredar luas', 20), mk('c', 'S1', T + ' lagi', 10)], { now: '2026-11-01T08:00:00Z' }); assert.equal(one.amplification.length, 0);
});
test('klaster: narasi sama menyatu, narasi lain terpisah', () => {
  const c = N.analyzeCorpus([mk('a', 'S1', 'Jembatan Merdeka putus diterjang banjir, akses warga terputus', 30), mk('b', 'S2', 'Banjir menjebol jembatan Merdeka sehingga warga tidak bisa lewat', 20), mk('c', 'S3', 'Pendaftaran beasiswa dibuka hingga akhir bulan', 10)], {});
  assert.equal(c.analyses[0].clusterId, c.analyses[1].clusterId); assert.notEqual(c.analyses[0].clusterId, c.analyses[2].clusterId);
});
test('urgensi kompatibel 0.1.1 dan berada di 0–100', () => {
  const u = N.urgency(mk('a', 'S', 'x yz abc', 10, { mentions: 100 }), { now: '2026-11-01T08:00:00Z' }); assert.ok(u.score >= 0 && u.score <= 100);
});
test('kredibilitas sumber: shrinkage ke prior dan menyempit dengan data', () => {
  const few = N.sourceCredibility('B', { verified: 1, false: 0 }), many = N.sourceCredibility('B', { verified: 5, false: 40 });
  assert.ok(few.score > 60 && few.score < 90); assert.ok(many.score < few.score); assert.ok(many.high - many.low < few.high - few.low);
});
test('metrik: confusion matrix, P/R/F1', () => {
  const m = E.confusionMatrix(['a', 'a', 'b', 'b', 'b'], ['a', 'b', 'b', 'b', 'a'], ['a', 'b']); assert.deepEqual(m, [[1, 1], [1, 2]]);
  const r = E.metricsFromMatrix(m, ['a', 'b']); assert.equal(r.accuracy, 0.6); assert.equal(r.perClass[0].precision, 0.5); assert.equal(r.perClass[1].recall, 0.6667);
});
test('dataset evaluasi: format valid dan split lengkap', () => {
  const fs = require('node:fs'); for (const f of ['sentiment', 'topic', 'epistemic', 'pairs']) {
    const d = JSON.parse(fs.readFileSync(`${__dirname}/../data/eval/${f}.json`, 'utf8')); const sp = new Set(d.items.map(i => i.split)); assert.deepEqual([...sp].sort(), ['challenge', 'dev', 'test']); assert.ok(d.items.length >= 60);
    if (d.task !== 'pair-similarity') d.items.forEach(i => assert.ok(d.labels.includes(i.label), `${i.id} label tak dikenal`));
  }
});
