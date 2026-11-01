'use strict';
/* GardaCore: orkestrasi pipeline Collect → Clean → Normalize → Analyze → Cluster → Alert → Verify. */
const fs = require('node:fs'); const path = require('node:path'); const { EventEmitter } = require('node:events');
const G = require('../engine/index.js'); const N = G.nlp;
const { parseFeed } = require('../scraper/rss.js'); const { cleanItem, canonicalUrl } = require('../scraper/clean.js');
const { HostLimiter, RobotsCache, rawFetch } = require('../scraper/net.js');
const { evaluateAlerts, sendWebhook, LEVELS } = require('./alerts.js'); const { stripHtml } = require('../scraper/rss.js');

const ROOT = path.join(__dirname, '..');
class GardaCore {
  constructor(store, cfg) {
    this.store = store; this.cfg = cfg; this.events = new EventEmitter(); this.limiter = new HostLimiter(cfg.hostDelayMs); this.robots = new RobotsCache();
    this.cache = { version: -1, corpus: null }; this.queue = Promise.resolve(); this.running = new Set(); this.timer = null; this.lastCycle = null;
    this.ua = `GardaNarasiBot/0.2 (+${cfg.contact}; riset informasi publik; patuh robots.txt)`; this.uaToken = 'GardaNarasiBot';
  }
  /* ---------- korpus & analisis ---------- */
  corpus() {
    if (this.cache.version === this.store.version && this.cache.corpus) return this.cache.corpus;
    const claims = this.store.listClaims({ limit: this.cfg.corpusLimit });
    const corpus = G.nlp.analyzeCorpus(claims, {}); this.cache = { version: this.store.version, corpus }; return corpus;
  }
  refreshAnalysis() {
    const corpus = this.corpus(); const store = this.store;
    store.tx(() => corpus.claims.forEach((c, i) => { const a = corpus.analyses[i]; store.saveAnalysis(c.id, a.clusterId ? (corpus.clusters.find(k => k.id === a.clusterId) || {}).stableId : null, { urgency: a.urgency.score, topic: a.topic.topic, sentiment: a.sentiment.label, epistemic: a.epistemic.type, confidence: a.confidence }); }));
    return this.raiseAlerts(corpus);
  }
  async raiseAlerts(corpus) {
    const cands = evaluateAlerts(corpus, Date.now()); let created = 0;
    for (const a of cands) {
      const id = this.store.createAlert(a); if (!id) continue; created++;
      const alert = this.store.getAlert(id); this.events.emit('alert', alert);
      this.store.audit('sistem', 'alert.create', 'alert', id, { kind: a.kind, level: a.level });
      await this.notify(alert);
    }
    return created;
  }
  async notify(alert) {
    const url = this.store.getSetting('webhookUrl', ''); const min = this.store.getSetting('webhookMinLevel', 'warning');
    if (!url || LEVELS.indexOf(alert.level) < LEVELS.indexOf(min)) return;
    try { const st = await sendWebhook(url, { text: `[GARDA NARASI • ${alert.level.toUpperCase()}] ${alert.title}`, alert: { id: alert.id, level: alert.level, kind: alert.kind, title: alert.title, why: alert.detail.why, urls: alert.detail.urls } }, { allowPrivate: this.cfg.allowPrivate }); if (st < 300) this.store.markNotified(alert.id); }
    catch (e) { this.store.audit('sistem', 'webhook.error', 'alert', alert.id, e.message); }
  }

  /* ---------- sumber ---------- */
  seedSources() {
    const file = path.join(ROOT, 'config', 'sources.json'); if (!fs.existsSync(file)) return;
    JSON.parse(fs.readFileSync(file, 'utf8')).forEach(s => { if (!this.store.getSource(s.id)) this.store.upsertSource({ ...s, enabled: false, tosAck: s.type === 'rss-file' }); });
  }
  seedDemo({ reset = false } = {}) {
    if (reset) this.store.deleteClaims(['demo']);
    const dir = path.join(ROOT, 'data'); let n = 0;
    ['sample-claims.json', 'sample-claims-geo.json'].forEach(f => { const p = path.join(dir, f); if (!fs.existsSync(p)) return; JSON.parse(fs.readFileSync(p, 'utf8')).forEach(r => { if (this.store.upsertClaim(N.normalizeClaim({ ...r, origin: 'demo' }), { ignoreIfExists: true })) n++; }); });
    return n;
  }
  async fetchPolite(url, extra = {}) {
    const host = new URL(url).host; await this.limiter.wait(host, extra.crawlDelay);
    return rawFetch(url, { ua: this.ua, allowPrivate: this.cfg.allowPrivate, timeoutMs: this.cfg.timeoutMs, maxBytes: this.cfg.maxBytes, headers: extra.headers });
  }
  async checkRobots(url) {
    return this.robots.check(url, { ua: this.ua, token: this.uaToken, fetcher: async u => { await this.limiter.wait(new URL(u).host, 0); return rawFetch(u, { ua: this.ua, allowPrivate: this.cfg.allowPrivate, timeoutMs: 8000, maxBytes: 512 * 1024 }); } });
  }

  /* ---------- satu siklus untuk satu sumber ---------- */
  runSource(sourceId, trigger = 'manual') {
    if (this.running.has(sourceId)) return Promise.resolve({ status: 'skipped', message: 'Sumber sedang berjalan.' });
    this.running.add(sourceId);
    const job = this.queue.then(() => this._runSource(sourceId, trigger)).finally(() => this.running.delete(sourceId));
    this.queue = job.catch(() => {}); return job;
  }
  async _runSource(sourceId, trigger) {
    const store = this.store, src = store.getSource(sourceId); if (!src) return { status: 'error', message: 'Sumber tidak ditemukan.' };
    const runId = store.startRun(sourceId, trigger); const stages = {}; const res = { status: 'ok', fetched: 0, cleaned: 0, dropped: 0, duplicates: 0, inserted: 0, alerts: 0, message: '' };
    const t0 = Date.now(); const stamp = k => { stages[k] = { ...(stages[k] || {}), ms: Date.now() - t0 }; };
    try {
      /* 1. COLLECT */
      let rawItems = [], httpStatus = null;
      if (src.type === 'rss-file') { const p = path.join(ROOT, src.url.replace(/^file:\/\//, '')); const offs = [50, 40, 30, 360, 300, 180, 120, 60]; let xml = fs.readFileSync(p, 'utf8'); offs.forEach((m, i) => { xml = xml.replace(`__T${i + 1}__`, new Date(Date.now() - m * 60000).toUTCString()); }); rawItems = parseFeed(xml).items; httpStatus = 200; stages.collect = { mode: 'file-lokal', robots: 'tidak berlaku' }; }
      else {
        if (!src.tosAck) throw Object.assign(new Error('Syarat Layanan sumber belum dikonfirmasi pengelola (tosAck).'), { soft: true });
        if (src.type !== 'api-json') {
          const rb = await this.checkRobots(src.url); store.patchSource(sourceId, { robotsAllowed: rb.allowed, robotsNote: rb.note });
          stages.collect = { robots: rb.note };
          if (!rb.allowed) throw Object.assign(new Error('Pengambilan dibatalkan: ' + rb.note), { soft: true, blocked: true });
          var crawlDelay = rb.crawlDelay;
        } else stages.collect = { robots: 'API resmi — mengikuti ketentuan API' };
        const headers = {}; if (src.etag) headers['If-None-Match'] = src.etag; if (src.lastModified) headers['If-Modified-Since'] = src.lastModified;
        const r = await this.fetchPolite(src.url, { crawlDelay, headers }); httpStatus = r.status;
        if (r.status === 304) { stages.collect.notModified = true; rawItems = []; }
        else if (r.status === 429 || r.status === 503) throw Object.assign(new Error(`Server meminta mundur (HTTP ${r.status}) — dihormati; coba lagi pada jadwal berikutnya.`), { soft: true });
        else if (r.status >= 400) throw new Error('HTTP ' + r.status);
        else { store.patchSource(sourceId, { etag: r.headers.get('etag') || '', lastModified: r.headers.get('last-modified') || '' }); rawItems = this.extract(src, r.text); }
      }
      res.fetched = rawItems.length; res.httpStatus = httpStatus; stages.collect = { ...stages.collect, fetched: res.fetched, httpStatus }; stamp('collect');

      /* 2. CLEAN + 3. NORMALIZE */
      const collectedAt = new Date().toISOString(); const kept = []; const reasons = {};
      for (const raw of rawItems.slice(0, this.cfg.maxItemsPerRun)) {
        const c = cleanItem(raw, { collectedAt, maxSummary: this.cfg.maxSummary, maxAgeDays: this.cfg.maxAgeDays });
        if (c.drop) { reasons[c.drop] = (reasons[c.drop] || 0) + 1; res.dropped++; continue; }
        if (src.lang === 'id' && c.item.lang !== 'id') { reasons['bahasa-bukan-id'] = (reasons['bahasa-bukan-id'] || 0) + 1; res.dropped++; continue; }
        kept.push(c.item);
      }
      res.cleaned = kept.length; stages.clean = { kept: kept.length, dropped: res.dropped, reasons }; stamp('clean');
      stages.normalize = { canonicalUrl: true, isoDate: true, piiMasked: true, summaryMaxChars: this.cfg.maxSummary }; stamp('normalize');

      /* 4. DEDUP (eksak URL, judul identik, near-dup dalam sumber yang sama) */
      const fresh = []; const since = new Date(Date.now() - 72 * 3600000).toISOString(); const recentSame = store.listClaims({ since, limit: 600 }).filter(c => c.sourceId === sourceId);
      const seenTitle = new Set();
      for (const it of kept) {
        if (store.findByUrlHash(it.urlHash) || seenTitle.has(it.contentHash)) { res.duplicates++; continue; }
        const sameSrc = store.q('SELECT id FROM claims WHERE content_hash=? AND source_id=? AND date>=?', it.contentHash, sourceId, since);
        if (sameSrc.length) { res.duplicates++; continue; }
        seenTitle.add(it.contentHash); fresh.push(it);
      }
      const toVec = it => N.tokenize(it.title + ' ' + it.summary, { concepts: true }); const model = new N.TfIdf([...fresh.map(toVec), ...recentSame.map(c => N.tokenize(N.claimText(c), { concepts: true }))], { bigrams: false });
      const recentVecs = recentSame.map(c => model.vector(N.tokenize(N.claimText(c), { concepts: true }))); const accepted = [];
      for (const it of fresh) { const v = model.vector(toVec(it)); if ([...recentVecs, ...accepted.map(a => a.v)].some(o => N.cosine(v, o) >= 0.92)) { res.duplicates++; continue; } accepted.push({ it, v }); }
      stages.dedup = { exactOrTitle: res.duplicates, unique: accepted.length, nearDuplicateThreshold: 0.92 }; stamp('dedup');

      /* 5. ANALYZE → simpan item sebagai klaim berstatus needs-review */
      store.tx(() => accepted.forEach(({ it }) => {
        const nlp = N.analyzeText(it.title + '. ' + it.summary); const loc = nlp.locations[0] || (src.regionHint ? G.lexicon.PROVINCES.filter(p => p.name === src.regionHint).map(p => ({ code: p.code, name: p.name }))[0] : null);
        const claim = N.normalizeClaim({ id: 'GN-C-' + it.urlHash, origin: 'collector', title: it.title, claim: it.summary || it.title, topic: '', region: loc ? loc.name : 'Tidak disebutkan', regionCode: loc ? loc.code : '', regionStatus: loc ? 'candidate' : 'unverified',
          source: src.name, sourceId, sourceUrl: it.url, channels: [src.name], mentions: 1, status: 'needs-review', date: it.published, firstSeen: it.published, collectedAt, isSynthetic: src.type === 'rss-file' });
        claim.urlHash = it.urlHash; claim.contentHash = it.contentHash; store.upsertClaim(claim); res.inserted++;
      }));
      stages.analyze = { analyzed: accepted.length, methods: ['topic-lexicon', 'sentiment-id', 'epistemic-cues', 'location-gazetteer'] }; stamp('analyze');

      /* 6. CLUSTER + 7. ALERT */
      this.cache.version = -1; const corpus = this.corpus(); stages.cluster = { clusters: corpus.clusters.length, burst: corpus.clusters.filter(k => k.burst.burst).length, amplification: corpus.amplification.length }; stamp('cluster');
      res.alerts = await this.refreshAnalysis(); stages.alert = { created: res.alerts }; stamp('alert');
      /* 8. VERIFY: item masuk antrean verifikasi manusia; tidak ada keputusan otomatis */
      stages.verify = { queued: res.inserted, policy: 'antrean verifikasi manusia — tidak ada pelabelan hoaks otomatis' }; stamp('verify');
      store.patchSource(sourceId, { lastRunAt: new Date().toISOString(), lastStatus: 'ok', lastError: '' });
      res.message = `${res.inserted} item baru, ${res.duplicates} duplikat, ${res.dropped} dibuang.`;
    } catch (e) {
      res.status = e.blocked ? 'blocked' : e.soft ? 'skipped' : 'error'; res.message = e.message; stages.error = e.message;
      store.patchSource(sourceId, { lastRunAt: new Date().toISOString(), lastStatus: res.status, lastError: e.message });
    }
    store.finishRun(runId, { ...res, stages }); store.audit('sistem', 'run', 'source', sourceId, { runId, status: res.status, trigger });
    this.events.emit('run', { runId, sourceId, ...res }); return { runId, ...res, stages };
  }
  extract(src, text) {
    if (src.type === 'api-json') {
      const m = src.mapping || {}; let data = JSON.parse(text); (m.itemsPath || '').split('.').filter(Boolean).forEach(k => { data = data && data[k]; });
      const arr = Array.isArray(data) ? data : data ? [data] : []; const tpl = (t, o) => String(t || '').replace(/\{([\w.]+)\}/g, (_, k) => (o[k] ?? ''));
      return arr.slice(0, 200).map(o => ({ title: m.titleTemplate ? tpl(m.titleTemplate, o) : o[(m.fields || {}).title], summary: m.summaryTemplate ? tpl(m.summaryTemplate, o) : o[(m.fields || {}).summary] || '', link: m.linkTemplate ? tpl(m.linkTemplate, o) : (o[(m.fields || {}).link] || src.url), published: o[(m.fields || {}).published] }));
    }
    if (src.type === 'html-list') { // ekstraksi judul+tautan saja dari halaman indeks yang diizinkan robots.txt
      const base = new URL(src.url); const re = src.mapping && src.mapping.linkPattern ? new RegExp(src.mapping.linkPattern) : null; const out = []; const seen = new Set();
      for (const m of text.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const title = stripHtml(m[2]); let href; try { href = new URL(m[1], base).href; } catch { continue; }
        if (title.length < 25 || new URL(href).hostname !== base.hostname || seen.has(href) || (re && !re.test(href))) continue; seen.add(href); out.push({ title, link: href, summary: '', published: '' });
      } return out.slice(0, 60);
    }
    return parseFeed(text).items;
  }

  /* ---------- scheduler ---------- */
  start() {
    if (this.timer) return; const tick = () => { this.tick().catch(() => {}); }; this.timer = setInterval(tick, this.cfg.tickMs); this.timer.unref?.(); setTimeout(tick, 3000).unref?.();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  dueSources(now = Date.now()) {
    return this.store.listSources().filter(s => s.enabled && (s.tosAck || s.type === 'rss-file') && (!s.lastRunAt || now - new Date(s.lastRunAt).getTime() >= Math.max(s.intervalMin, this.cfg.minIntervalMin) * 60000));
  }
  async tick() { for (const s of this.dueSources()) await this.runSource(s.id, 'scheduler'); this.lastCycle = new Date().toISOString(); }
  pipelineStatus() {
    const runs = this.store.listRuns(20); const last = runs[0];
    const sum = f => runs.reduce((a, r) => a + (r[f] || 0), 0);
    return { scheduler: { active: !!this.timer, tickSeconds: this.cfg.tickMs / 1000, lastCycle: this.lastCycle, minIntervalMin: this.cfg.minIntervalMin, hostDelayMs: this.cfg.hostDelayMs }, sources: { total: this.store.listSources().length, enabled: this.store.listSources().filter(s => s.enabled).length },
      stages: [{ key: 'collect', label: 'Collect', value: sum('fetched') }, { key: 'clean', label: 'Clean', value: sum('cleaned') }, { key: 'normalize', label: 'Normalize', value: sum('cleaned') }, { key: 'analyze', label: 'Analyze', value: sum('inserted') }, { key: 'cluster', label: 'Cluster', value: this.corpus().clusters.length }, { key: 'alert', label: 'Alert', value: this.store.listAlerts({ open: true, limit: 500 }).length }, { key: 'verify', label: 'Verify', value: this.corpus().claims.filter(c => c.status === 'needs-review').length }],
      lastRun: last || null, window: 'agregat 20 run terakhir (kecuali Cluster, Alert, Verify = kondisi saat ini)' };
  }
}
module.exports = { GardaCore };
