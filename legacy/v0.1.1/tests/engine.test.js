'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/engine.js'), 'utf8'), context);
const Engine = context.window.GardaEngine;
const raw = JSON.parse(fs.readFileSync(path.join(root, 'data/sample-claims.json'), 'utf8'));
const claims = raw.map(Engine.normalizeClaim);

assert.equal(claims.length, 10, 'dataset demo harus berisi 10 klaim');
assert.ok(claims.every(c => c.isSynthetic), 'semua data demo wajib ditandai sintetis');
assert.equal(Engine.jaccard('jalur evakuasi ditutup', 'jalur evakuasi ditutup'), 1, 'kemiripan teks identik harus 1');
assert.ok(Engine.isBurst(claims[0]), 'GN-DEMO-001 harus memicu indikasi lonjakan');
assert.ok(!Engine.isBurst(claims[6]), 'GN-DEMO-007 seharusnya tidak memicu lonjakan');

const scores = claims.map(c => Engine.analyzeClaim(c).score);
assert.ok(scores.every(score => Number.isInteger(score) && score >= 0 && score <= 100), 'skor harus berada pada rentang 0–100');
assert.equal(Engine.STATUS['needs-review'].label, 'Perlu verifikasi');

const signals = Engine.findAmplificationSignals(claims);
assert.ok(signals.some(s => s.claims.some(c => c.id === 'GN-DEMO-009') && s.claims.some(c => c.id === 'GN-DEMO-010')), 'pasangan klaim simulasi 009/010 harus terdeteksi sebagai kandidat');
assert.ok(signals.every(s => s.channels.length >= 3 && s.sources.length >= 2), 'kandidat wajib memenuhi syarat lintas kanal dan sumber');

const injected = Engine.normalizeClaim({ title: '<img src=x onerror=alert(1)>', claim: 'uji', channels: ['Kanal uji'] });
assert.equal(injected.title, '<img src=x onerror=alert(1)>', 'engine mempertahankan teks; sanitasi dilakukan pada layer UI');

console.log('GARDA NARASI engine tests: PASS');
console.log(`- ${claims.length} data sintetis tervalidasi`);
console.log(`- ${signals.length} kandidat amplifikasi terdeteksi`);
console.log(`- Skor urgensi valid pada rentang 0–100`);
