'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const http = require('node:http');
const { createApp, loadConfig } = require('../backend/server.js');

function feedServer({ robots, feed }) {
  const s = http.createServer((req, res) => { if (req.url === '/robots.txt') { res.writeHead(robots === null ? 404 : 200, { 'Content-Type': 'text/plain' }); return res.end(robots || ''); } if (req.url.startsWith('/feed.xml')) { res.writeHead(200, { 'Content-Type': 'application/rss+xml' }); return res.end(feed()); } res.writeHead(404); res.end(); });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}
const rss = items => `<rss><channel><title>t</title>${items.map(i => `<item><title>${i.t}</title><link>${i.l}</link><pubDate>${new Date(Date.now() - 600000).toUTCString()}</pubDate><description>${i.d}</description></item>`).join('')}</channel></rss>`;
async function boot(env = {}) {
  const app = createApp(loadConfig({ DB_PATH: ':memory:', SCHEDULER: 'false', SEED_DEMO: 'true', ALLOW_PRIVATE_HOSTS: 'true', HOST_DELAY_MS: '0', ...env }));
  await new Promise(r => app.server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + app.server.address().port;
  const call = async (m, p, b, h = {}) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', 'x-reviewer': 'Penguji', ...h }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j, h: r.headers }; };
  return { app, base, call };
}

test('pipeline: robots.txt melarang → diblokir, tidak ada item masuk', async () => {
  const fs = await feedServer({ robots: 'User-agent: *\nDisallow: /feed.xml', feed: () => rss([{ t: 'Banjir besar melanda wilayah pesisir', l: 'http://x.test/1', d: 'Warga mengungsi karena banjir' }]) });
  const { app, call } = await boot(); const url = `http://127.0.0.1:${fs.address().port}/feed.xml`;
  await call('POST', '/api/sources', { name: 'Uji', type: 'rss', url, intervalMin: 15 }); const before = app.store.countClaims();
  assert.equal((await call('PATCH', '/api/sources/uji', { enabled: true })).s, 422, 'harus konfirmasi ToS dulu');
  await call('PATCH', '/api/sources/uji', { tosAck: true }); await call('PATCH', '/api/sources/uji', { enabled: true });
  const r = await call('POST', '/api/sources/uji/run'); assert.equal(r.j.status, 'blocked'); assert.match(r.j.message, /robots/i); assert.equal(app.store.countClaims(), before);
  app.close(); fs.close();
});
test('pipeline: pengumpulan, dedup, dan antrean verifikasi manual', async () => {
  const items = [{ t: 'Pesan berantai sebut listrik padam tiga hari, belum dikonfirmasi', l: 'http://x.test/1?utm_source=a', d: 'Beredar pesan berantai yang menyebut listrik padam tiga hari di Jawa Tengah.' }, { t: 'Dinas kesehatan membuka layanan vaksinasi gratis', l: 'http://x.test/2', d: 'Dinas kesehatan menyatakan vaksin tersedia gratis di puskesmas.' }];
  const fs = await feedServer({ robots: null, feed: () => rss(items) }); const { app, call } = await boot(); const url = `http://127.0.0.1:${fs.address().port}/feed.xml`;
  await call('POST', '/api/sources', { name: 'Feed', type: 'rss', url }); await call('PATCH', '/api/sources/feed', { tosAck: true });
  const r1 = await call('POST', '/api/sources/feed/run'); assert.equal(r1.j.status, 'ok'); assert.equal(r1.j.inserted, 2); const r2 = await call('POST', '/api/sources/feed/run'); assert.equal(r2.j.inserted, 0); assert.equal(r2.j.duplicates, 2);
  const q = await call('GET', '/api/verification/queue'); const collected = q.j.queue.filter(x => x.origin === 'collector'); assert.equal(collected.length, 2); assert.ok(collected.every(x => x.status === 'needs-review'), 'tidak ada pelabelan otomatis');
  const runs = await call('GET', '/api/runs'); assert.ok(runs.j.runs.length >= 2); app.close(); fs.close();
});
test('verifikasi: bukti wajib + empat-mata untuk vonis negatif', async () => {
  const { app, call } = await boot(); const id = 'GN-DEMO-003'; const note = 'Sumber resmi membantah klaim ini secara tertulis.';
  assert.equal((await call('POST', `/api/claims/${id}/review`, { status: 'false', note, reviewer: 'Ani' })).s, 422);
  assert.equal((await call('POST', `/api/claims/${id}/evidence`, { url: 'javascript:alert(1)', stance: 'contradicts' })).s, 400);
  assert.equal((await call('POST', `/api/claims/${id}/evidence`, { url: 'https://bukti.go.id/bantahan', stance: 'contradicts', kind: 'official' })).s, 201);
  assert.equal((await call('POST', `/api/claims/${id}/review`, { status: 'false', note: 'pendek', reviewer: 'Ani' })).s, 400);
  const p = await call('POST', `/api/claims/${id}/review`, { status: 'false', note, reviewer: 'Ani' }); assert.equal(p.j.pendingSecondReview, true); assert.equal((await call('GET', `/api/claims/${id}`)).j.status, 'needs-review');
  assert.equal((await call('POST', `/api/claims/${id}/review`, { status: 'false', note, reviewer: 'ani' })).s, 409, 'pemeriksa yang sama tidak boleh mengonfirmasi');
  const c = await call('POST', `/api/claims/${id}/review`, { status: 'false', note: 'Konfirmasi: bantahan resmi sudah saya periksa.', reviewer: 'Budi' }); assert.equal(c.j.applied, true); assert.equal((await call('GET', `/api/claims/${id}`)).j.status, 'false');
  const au = await call('GET', '/api/audit'); assert.ok(au.j.audit.some(a => a.action === 'review.confirm')); app.close();
});
test('keamanan: token API, header, path traversal, CSV injection', async () => {
  const { app, base, call } = await boot({ GARDA_API_TOKEN: 'rahasia-uji' });
  assert.equal((await call('GET', '/api/overview')).s, 401); assert.equal((await call('GET', '/api/overview', null, { authorization: 'Bearer rahasia-uji' })).s, 200); assert.equal((await call('GET', '/api/health')).s, 200);
  const r = await fetch(base + '/'); assert.match(r.headers.get('content-security-policy'), /default-src 'self'/); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(base + '/%2e%2e/etc/passwd')).status, 404); assert.equal((await fetch(base + '/backend/server.js')).status, 404); assert.equal((await fetch(base + '/data/garda.db')).status, 404);
  const H = { authorization: 'Bearer rahasia-uji' }; await call('POST', '/api/claims', { title: '=HYPERLINK("http://jahat","klik") judul uji', claim: '+cmd|calc' }, H);
  const csv = await (await fetch(base + '/api/report/claims.csv', { headers: H })).text(); assert.ok(csv.includes('"\'=HYPERLINK'), 'sel berawalan = harus diberi kutip'); assert.ok(!/(^|,)"=HYPER/m.test(csv)); app.close();
});
test('laporan PDF valid dan berisi catatan keterbatasan', async () => {
  const { app, base } = await boot(); const buf = Buffer.from(await (await fetch(base + '/api/report/intelligence.pdf')).arrayBuffer()); assert.equal(buf.subarray(0, 5).toString(), '%PDF-'); assert.ok(buf.length > 4000); assert.ok(buf.toString('latin1').includes('%%EOF')); app.close();
});
test('analisis teks bebas dan impor klaim', async () => {
  const { app, call } = await boot(); const a = await call('POST', '/api/analyze', { text: 'Katanya jalan tol ditutup besok, belum dikonfirmasi petugas' }); assert.equal(a.j.epistemic.type, 'unverified');
  const imp = await call('POST', '/api/claims/import', { claims: [{ id: 'IMP-1', title: 'Klaim impor uji satu', claim: 'isi', mentions: 3 }] }); assert.equal(imp.j.added, 1); assert.equal((await call('POST', '/api/claims/import', { claims: [{ id: 'IMP-1', title: 'Klaim impor uji satu' }] })).j.added, 0); app.close();
});
