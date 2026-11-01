'use strict';
/* GARDA NARASI — server HTTP (REST + SSE + file statis). Hanya modul bawaan Node ≥ 22.5. */
const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path'); const { URL } = require('node:url');
const G = require('../engine/index.js'); const N = G.nlp;
const { Store } = require('./db.js'); const { GardaCore } = require('./core.js'); const V = require('./verification.js'); const R = require('./reports.js');
const { runAll } = require('../engine/eval-runner.js');
const ROOT = path.join(__dirname, '..');

function loadConfig(env = process.env) {
  const bool = (v, d) => (v === undefined ? d : /^(1|true|yes)$/i.test(v));
  return {
    port: Number(env.PORT || 8787), host: env.HOST || '127.0.0.1', dbPath: env.DB_PATH || path.join(ROOT, 'data', 'garda.db'), token: env.GARDA_API_TOKEN || '',
    contact: env.GARDA_CONTACT || 'ganti-dengan-kontak-anda@example.org', allowPrivate: bool(env.ALLOW_PRIVATE_HOSTS, false), fourEyes: bool(env.FOUR_EYES, true), scheduler: bool(env.SCHEDULER, true),
    seedDemo: bool(env.SEED_DEMO, true), hostDelayMs: Number(env.HOST_DELAY_MS || 3000), minIntervalMin: Number(env.MIN_INTERVAL_MIN || 15), tickMs: Number(env.TICK_MS || 30000),
    timeoutMs: 15000, maxBytes: 2 * 1024 * 1024, maxItemsPerRun: 100, maxSummary: 400, maxAgeDays: Number(env.MAX_AGE_DAYS || 14), corpusLimit: 3000, rateLimitPerMin: Number(env.RATE_LIMIT || 300)
  };
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };

function createApp(cfg = loadConfig()) {
  const store = new Store(cfg.dbPath); const core = new GardaCore(store, cfg);
  core.seedSources(); if (cfg.seedDemo && store.countClaims() === 0) core.seedDemo();
  const sse = new Set(); core.events.on('alert', a => push('alert', a)); core.events.on('run', r => push('run', r));
  function push(event, data) { const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; sse.forEach(res => res.write(msg)); }

  const claimView = (corpus, i) => G.analytics.claimView(corpus, i);
  const J = (data, status = 200) => ({ status, data });
  const err = (message, status = 400) => ({ status, data: { error: message } });
  const sanitizeId = s => String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  const routes = [];
  const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });

  route('GET', '/api/health', () => J({ ok: true, version: '0.2.0', time: new Date().toISOString(), claims: store.countClaims(), authRequired: !!cfg.token, fourEyes: cfg.fourEyes }));
  route('GET', '/api/overview', () => { const c = core.corpus(); const ov = G.analytics.buildOverview(c, { openAlerts: store.listAlerts({ open: true, limit: 500 }).length, proposals: store.proposals().length }); return J(ov); });
  route('GET', '/api/claims', ({ query }) => J(G.analytics.filterClaims(core.corpus(), Object.fromEntries(query))));
  route('GET', '/api/claims/:id', ({ params }) => { const d = G.analytics.claimDetail(core.corpus(), params.id); if (!d) return err('Klaim tidak ditemukan.', 404); return J({ ...d, evidence: store.listEvidence(params.id), reviews: store.listReviews(params.id) }); });
  route('POST', '/api/claims', async ({ body, actor }) => {
    if (!body || String(body.title || '').trim().length < 5) return err('Judul minimal 5 karakter.');
    const c = N.normalizeClaim({ title: N.maskPII(body.title), claim: N.maskPII(body.claim || body.title), topic: body.topic, region: body.region, source: body.source || 'Input manual', sourceUrl: V.safeUrl(body.sourceUrl), mentions: body.mentions, date: new Date().toISOString(), origin: 'manual', channels: [body.source || 'Input manual'], status: 'needs-review' });
    store.upsertClaim(c); store.audit(actor, 'claim.create', 'claim', c.id); await core.refreshAnalysis(); return J({ id: c.id }, 201);
  });
  route('POST', '/api/claims/import', async ({ body, actor }) => {
    const arr = Array.isArray(body) ? body : body && body.claims; if (!Array.isArray(arr) || !arr.length) return err('Berisi array klaim.'); if (arr.length > 1000) return err('Maksimal 1.000 klaim per impor.');
    let added = 0; store.tx(() => arr.forEach(r => { const c = N.normalizeClaim({ ...r, title: N.maskPII(r.title || ''), claim: N.maskPII(r.claim || r.title || ''), origin: r.isSynthetic ? 'demo' : 'import', sourceUrl: V.safeUrl(r.sourceUrl) }); if (store.upsertClaim(c, { ignoreIfExists: true })) added++; }));
    store.audit(actor, 'claim.import', 'claim', '', { added, total: arr.length }); await core.refreshAnalysis(); return J({ added, skipped: arr.length - added });
  });
  route('POST', '/api/claims/:id/review', ({ params, body, actor }) => { const r = V.submitReview(store, cfg, params.id, { ...body, reviewer: body.reviewer || actor }); if (r.error) return err(r.error, r.code); core.refreshAnalysis(); return J(r); });
  route('POST', '/api/claims/:id/evidence', ({ params, body, actor }) => { const r = V.addEvidence(store, params.id, { ...body, addedBy: body.addedBy || actor }); return r.error ? err(r.error, r.code) : J(r, 201); });
  route('DELETE', '/api/evidence/:id', ({ params, actor }) => { store.deleteEvidence(Number(params.id)); store.audit(actor, 'evidence.delete', 'evidence', params.id); return J({ ok: true }); });
  route('POST', '/api/claims/:id/region', ({ params, body, actor }) => { const r = V.setRegion(store, params.id, { ...body, reviewer: actor }); return r.error ? err(r.error, r.code) : J(r); });
  route('GET', '/api/verification/queue', () => { const c = core.corpus(); const rows = c.claims.map((_, i) => claimView(c, i)).filter(r => r.status === 'needs-review').sort((a, b) => b.urgency.score - a.urgency.score); return J({ queue: rows.slice(0, 200), total: rows.length, proposals: store.proposals(), fourEyes: cfg.fourEyes }); });

  route('GET', '/api/clusters', () => J(G.analytics.clusterList(core.corpus())));
  route('GET', '/api/clusters/:id', ({ params }) => { const c = core.corpus(); const k = c.clusters.find(x => x.id === params.id || x.stableId === params.id); if (!k) return err('Klaster tidak ditemukan.', 404); return J({ ...k, members: k.memberIds.map(id => claimView(c, c.byId.get(id))).sort((a, b) => new Date(a.date) - new Date(b.date)) }); });
  route('GET', '/api/amplification', () => { const c = core.corpus(); return J({ signals: c.amplification.map(s => ({ ...s, claims: s.claims.map(x => ({ id: x.id, title: x.title, source: x.source, date: x.date, sourceUrl: x.sourceUrl })) })) }); });
  route('GET', '/api/geo', () => J(G.analytics.geoView(core.corpus())));
  route('GET', '/api/credibility', () => J({ sources: R.credibilityRows(core), method: 'Prior tier + hasil verifikasi item (shrinkage Bayesian, k=8). Bukan penilaian atas seluruh isi sumber.' }));
  route('POST', '/api/analyze', ({ body }) => { if (String(body && body.text || '').trim().length < 8) return err('Teks terlalu pendek.'); return J(G.analytics.analyzeFree(core.corpus(), body.text)); });

  route('GET', '/api/alerts', ({ query }) => J({ alerts: store.listAlerts({ limit: Math.min(500, Number(query.get('limit') || 100)), open: query.get('open') === '1' }) }));
  route('POST', '/api/alerts/:id/ack', ({ params, actor }) => { store.ackAlert(Number(params.id), actor); store.audit(actor, 'alert.ack', 'alert', params.id); return J({ ok: true }); });
  route('POST', '/api/alerts/test', async ({ actor }) => { const id = store.createAlert({ key: 'test:' + Date.now(), level: 'info', kind: 'test', title: 'Uji notifikasi peringatan dini', detail: { why: 'Peringatan uji dari pengguna.', urls: [] } }); const a = store.getAlert(id); core.events.emit('alert', a); await core.notify({ ...a, level: 'critical' }); store.audit(actor, 'alert.test', 'alert', id); return J(a, 201); });
  route('GET', '/api/settings', () => J({ webhookUrl: store.getSetting('webhookUrl', ''), webhookMinLevel: store.getSetting('webhookMinLevel', 'warning') }));
  route('PUT', '/api/settings', ({ body, actor }) => {
    if (body.webhookUrl !== undefined) { const u = body.webhookUrl ? V.safeUrl(body.webhookUrl) : ''; if (body.webhookUrl && !u) return err('URL webhook tidak valid.'); store.setSetting('webhookUrl', u); }
    if (body.webhookMinLevel && ['info', 'watch', 'warning', 'critical'].includes(body.webhookMinLevel)) store.setSetting('webhookMinLevel', body.webhookMinLevel); store.audit(actor, 'settings.update', 'settings', ''); return J({ ok: true });
  });

  route('GET', '/api/sources', () => J({ sources: store.listSources(), minIntervalMin: cfg.minIntervalMin, userAgent: core.ua }));
  route('POST', '/api/sources', ({ body, actor }) => {
    const url = body.type === 'rss-file' ? '' : V.safeUrl(body.url); if (!['rss', 'api-json', 'html-list'].includes(body.type)) return err('Tipe sumber: rss, api-json, atau html-list.'); if (!url) return err('URL harus http/https yang valid.');
    const id = sanitizeId(body.id || body.name); if (!id || !String(body.name || '').trim()) return err('Nama sumber wajib diisi.'); if (store.getSource(id)) return err('ID sumber sudah ada.', 409);
    store.upsertSource({ id, name: String(body.name).slice(0, 80), type: body.type, url, category: String(body.category || '').slice(0, 40), tier: ['A', 'B', 'C', 'D'].includes(body.tier) ? body.tier : 'D', tierNote: String(body.tierNote || '').slice(0, 200), intervalMin: Math.max(cfg.minIntervalMin, Number(body.intervalMin) || 60), enabled: false, tosAck: false, regionHint: body.regionHint || '', lang: 'id', notes: String(body.notes || '').slice(0, 300), mapping: body.mapping || null });
    store.audit(actor, 'source.create', 'source', id); return J({ id }, 201);
  });
  route('PATCH', '/api/sources/:id', ({ params, body, actor }) => {
    const s = store.getSource(params.id); if (!s) return err('Sumber tidak ditemukan.', 404); const n = { ...s };
    ['name', 'category', 'tierNote', 'notes', 'regionHint'].forEach(k => { if (body[k] !== undefined) n[k] = String(body[k]).slice(0, 200); });
    if (body.tier && ['A', 'B', 'C', 'D'].includes(body.tier)) n.tier = body.tier; if (body.intervalMin !== undefined) n.intervalMin = Math.max(cfg.minIntervalMin, Number(body.intervalMin) || s.intervalMin);
    if (body.tosAck !== undefined) { if (body.tosAck && String(actor).length < 2) return err('Nama pengelola wajib untuk konfirmasi ToS (header X-Reviewer).'); n.tosAck = !!body.tosAck; n.tosAckBy = body.tosAck ? actor : ''; }
    if (body.enabled !== undefined) { if (body.enabled && !n.tosAck && s.type !== 'rss-file') return err('Konfirmasi dulu bahwa Syarat Layanan dan robots.txt sumber sudah Anda baca dan mengizinkan pengambilan otomatis.', 422); n.enabled = !!body.enabled; }
    store.upsertSource(n); store.audit(actor, 'source.update', 'source', params.id, body); return J({ ok: true });
  });
  route('DELETE', '/api/sources/:id', ({ params, actor }) => { store.deleteSource(params.id); store.audit(actor, 'source.delete', 'source', params.id); return J({ ok: true }); });
  route('POST', '/api/sources/:id/run', async ({ params, actor }) => { if (!store.getSource(params.id)) return err('Sumber tidak ditemukan.', 404); store.audit(actor, 'source.run', 'source', params.id); return J(await core.runSource(params.id, 'manual')); });
  route('POST', '/api/sources/:id/robots-check', async ({ params }) => { const s = store.getSource(params.id); if (!s) return err('Sumber tidak ditemukan.', 404); if (s.type === 'rss-file') return J({ allowed: true, note: 'File lokal — tidak berlaku.' }); try { const r = await core.checkRobots(s.url); store.patchSource(s.id, { robotsAllowed: r.allowed, robotsNote: r.note }); return J(r); } catch (e) { return err('Gagal memeriksa robots.txt: ' + e.message, 502); } });
  route('GET', '/api/runs', ({ query }) => J({ runs: store.listRuns(Math.min(200, Number(query.get('limit') || 50)), query.get('source')) }));
  route('GET', '/api/pipeline', () => J(core.pipelineStatus()));
  route('POST', '/api/pipeline/run-all', async ({ actor }) => { const out = []; for (const s of store.listSources().filter(x => x.enabled)) out.push({ id: s.id, ...(await core.runSource(s.id, 'manual')) }); store.audit(actor, 'pipeline.run-all', 'pipeline'); return J({ runs: out }); });
  route('GET', '/api/audit', ({ query }) => J({ audit: store.listAudit(Math.min(500, Number(query.get('limit') || 100))) }));
  route('POST', '/api/demo/reset', async ({ actor }) => { core.seedDemo({ reset: true }); store.audit(actor, 'demo.reset'); await core.refreshAnalysis(); return J({ ok: true, claims: store.countClaims() }); });
  route('GET', '/api/evaluation', () => { const e = store.lastEval() || (() => { const report = runAll(); store.saveEval(report); return store.lastEval(); })(); return J(e); });
  route('POST', '/api/evaluation/run', ({ actor }) => { const report = runAll(); store.saveEval(report); store.audit(actor, 'evaluation.run'); return J(store.lastEval()); });
  route('GET', '/api/report/:name', ({ params }) => {
    const m = { 'claims.csv': () => R.claimsCsv(core), 'alerts.csv': () => R.alertsCsv(core), 'sources.csv': () => R.sourcesCsv(core), 'runs.csv': () => R.runsCsv(core) };
    if (params.name === 'intelligence.pdf') return { status: 200, raw: R.buildPdf(core), type: 'application/pdf', filename: 'garda-narasi-laporan.pdf' };
    if (!m[params.name]) return err('Laporan tidak dikenal.', 404); return { status: 200, raw: Buffer.from(m[params.name](), 'utf8'), type: 'text/csv; charset=utf-8', filename: 'garda-narasi-' + params.name };
  });

  const hits = new Map(); setInterval(() => hits.clear(), 60000).unref();
  async function readBody(req) { const chunks = []; let n = 0; for await (const c of req) { n += c.length; if (n > 2 * 1024 * 1024) throw Object.assign(new Error('Body terlalu besar.'), { code: 413 }); chunks.push(c); } const t = Buffer.concat(chunks).toString('utf8'); if (!t) return {}; try { return JSON.parse(t); } catch { throw Object.assign(new Error('JSON tidak valid.'), { code: 400 }); } }

  async function handler(req, res) {
    const u = new URL(req.url, 'http://x'); const send = (status, body, type = 'application/json; charset=utf-8', extra = {}) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SEC, ...extra }); res.end(body); };
    try {
      if (u.pathname.startsWith('/api/')) {
        const ip = req.socket.remoteAddress; const n = (hits.get(ip) || 0) + 1; hits.set(ip, n); if (n > cfg.rateLimitPerMin) return send(429, JSON.stringify({ error: 'Terlalu banyak permintaan.' }));
        if (cfg.token && u.pathname !== '/api/health') { const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || (u.pathname === '/api/stream' || u.pathname.startsWith('/api/report/') ? u.searchParams.get('token') : ''); if (t !== cfg.token) return send(401, JSON.stringify({ error: 'Token API diperlukan.' })); }
        if (u.pathname === '/api/stream') { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...SEC }); res.write('retry: 5000\n\n'); sse.add(res); const hb = setInterval(() => res.write(': hb\n\n'), 25000); req.on('close', () => { clearInterval(hb); sse.delete(res); }); return; }
        const actor = String((() => { try { return decodeURIComponent(req.headers['x-reviewer'] || 'anonim'); } catch { return 'anonim'; } })()).replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 60) || 'anonim';
        for (const r of routes) { if (r.method !== req.method) continue; const m = r.re.exec(u.pathname); if (!m) continue; const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {}; const out = await r.handler({ req, params: { ...m.groups }, query: u.searchParams, body, actor }); if (out.raw) return send(out.status, out.raw, out.type, { 'Content-Disposition': `attachment; filename="${out.filename}"` }); return send(out.status, JSON.stringify(out.data)); }
        return send(404, JSON.stringify({ error: 'Endpoint tidak ditemukan.' }));
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method Not Allowed', 'text/plain');
      let file; const p = decodeURIComponent(u.pathname);
      if (p === '/' ) file = path.join(ROOT, 'frontend', 'index.html');
      else if (/^\/engine\/(lexicon|nlp|evaluate|analytics)\.js$/.test(p)) file = path.join(ROOT, p);
      else if (/^\/data\/sample-claims(-geo)?\.json$/.test(p)) file = path.join(ROOT, p);
      else { file = path.normalize(path.join(ROOT, 'frontend', p.replace(/^\/frontend\//, '/'))); if (!file.startsWith(path.join(ROOT, 'frontend') + path.sep)) return send(403, 'Forbidden', 'text/plain'); }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'Not found', 'text/plain');
      return send(200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
    } catch (e) { return send(e.code === 413 || e.code === 400 ? e.code : 500, JSON.stringify({ error: e.code ? e.message : 'Kesalahan server.' })); }
  }
  const server = http.createServer((req, res) => { handler(req, res); });
  return { server, core, store, cfg, close() { core.stop(); sse.forEach(r => r.end()); server.close(); store.close(); } };
}

if (require.main === module) {
  const app = createApp(); const { cfg, core, server } = app;
  server.listen(cfg.port, cfg.host, async () => {
    console.log(`GARDA NARASI 0.2.0 berjalan di http://${cfg.host}:${cfg.port}`);
    console.log(`  database : ${cfg.dbPath}\n  scheduler: ${cfg.scheduler ? 'aktif (hanya sumber yang dikonfirmasi ToS & diaktifkan)' : 'nonaktif'}\n  auth     : ${cfg.token ? 'token API wajib' : 'TIDAK ADA token — jangan buka ke jaringan publik'}`);
    await core.refreshAnalysis().catch(() => {}); if (cfg.scheduler) core.start();
  });
  const stop = () => { app.close(); process.exit(0); }; process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
module.exports = { createApp, loadConfig };
