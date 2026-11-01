/* GARDA NARASI — adapter data. Mode "server": REST ke backend. Mode "lokal": mesin yang sama berjalan di browser (localStorage). */
(function () {
  'use strict';
  const GN = window.GN, G = window.GARDA, N = G.nlp, A = G.analytics;
  const KEY = 'garda-narasi.v2.claims', EVK = 'garda-narasi.v2.evidence', RVK = 'garda-narasi.v2.reviews';
  const api = GN.api = { mode: 'server', token: sessionStorage.getItem('gn.token') || '', who: localStorage.getItem('gn.who') || '' };
  const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

  /* ---------- mode lokal ---------- */
  const L = { claims: [], ev: [], rv: [], corpus: null, ver: 0, cver: -1 };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(L.claims)); localStorage.setItem(EVK, JSON.stringify(L.ev)); localStorage.setItem(RVK, JSON.stringify(L.rv)); } catch { GN.toast('Penyimpanan browser penuh — ekspor data sebagai cadangan.', 'err'); } L.ver++; };
  const lcorpus = () => { if (L.cver !== L.ver || !L.corpus) { L.claims.forEach(c => { c.evidenceCount = L.ev.filter(e => e.claim_id === c.id).length + (c.evidenceUrl ? 1 : 0); }); L.corpus = A && N.analyzeCorpus(L.claims.map(c => ({ ...c })), {}); L.cver = L.ver; } return L.corpus; };
  async function loadDemo() {
    const out = []; for (const f of ['sample-claims.json', 'sample-claims-geo.json']) { for (const base of ['/data/', '../data/']) { try { const r = await fetch(base + f); if (r.ok) { out.push(...await r.json()); break; } } catch { /* coba lokasi berikut */ } } }
    L.claims = out.map(r => N.normalizeClaim({ ...r, origin: 'demo' })); save();
  }
  async function localInit() { L.claims = jget(KEY, null); L.ev = jget(EVK, []); L.rv = jget(RVK, []); if (!L.claims) await loadDemo(); else L.claims = L.claims.map(N.normalizeClaim); }
  const err = (m, c = 400) => { const e = new Error(m); e.status = c; throw e; };
  function localCall(method, path, body) {
    const u = new URL(path, 'http://x'); const p = u.pathname, q = Object.fromEntries(u.searchParams); let m;
    if (method === 'GET' && p === '/api/health') return { ok: true, version: '0.2.0-lokal', claims: L.claims.length };
    if (method === 'GET' && p === '/api/overview') return A.buildOverview(lcorpus(), { openAlerts: 0, proposals: 0 });
    if (method === 'GET' && p === '/api/claims') return A.filterClaims(lcorpus(), q);
    if (method === 'GET' && (m = p.match(/^\/api\/claims\/([^/]+)$/))) { const d = A.claimDetail(lcorpus(), decodeURIComponent(m[1])); if (!d) err('Klaim tidak ditemukan.', 404); return { ...d, evidence: L.ev.filter(e => e.claim_id === d.id), reviews: L.rv.filter(r => r.claim_id === d.id).reverse() }; }
    if (method === 'GET' && p === '/api/clusters') return A.clusterList(lcorpus());
    if (method === 'GET' && (m = p.match(/^\/api\/clusters\/([^/]+)$/))) { const c = lcorpus(), k = c.clusters.find(x => x.id === m[1] || x.stableId === m[1]); if (!k) err('Klaster tidak ditemukan.', 404); return { ...k, members: k.memberIds.map(id => A.claimView(c, c.byId.get(id))) }; }
    if (method === 'GET' && p === '/api/amplification') { const c = lcorpus(); return { signals: c.amplification.map(s => ({ ...s, claims: s.claims.map(x => ({ id: x.id, title: x.title, source: x.source, date: x.date, sourceUrl: x.sourceUrl })) })) }; }
    if (method === 'GET' && p === '/api/geo') return A.geoView(lcorpus());
    if (method === 'POST' && p === '/api/analyze') { if (String(body.text || '').trim().length < 8) err('Teks terlalu pendek.'); return A.analyzeFree(lcorpus(), body.text); }
    if (method === 'GET' && p === '/api/verification/queue') { const c = lcorpus(); const rows = c.claims.map((_, i) => A.claimView(c, i)).filter(r => r.status === 'needs-review').sort((a, b) => b.urgency.score - a.urgency.score); return { queue: rows, total: rows.length, proposals: [], fourEyes: false }; }
    if (method === 'POST' && p === '/api/claims') { if (String(body.title || '').trim().length < 5) err('Judul minimal 5 karakter.'); const c = N.normalizeClaim({ title: N.maskPII(body.title), claim: N.maskPII(body.claim || body.title), topic: body.topic, region: body.region, source: body.source || 'Input manual', sourceUrl: GN.safeHref(body.sourceUrl), mentions: body.mentions, origin: 'manual', channels: [body.source || 'Input manual'], date: new Date().toISOString() }); L.claims.unshift(c); save(); return { id: c.id }; }
    if (method === 'POST' && p === '/api/claims/import') { const arr = Array.isArray(body) ? body : body.claims; if (!Array.isArray(arr) || !arr.length) err('Berisi array klaim.'); if (arr.length > 1000) err('Maksimal 1.000 klaim.'); const ids = new Set(L.claims.map(c => c.id)); let added = 0; arr.forEach(r => { const c = N.normalizeClaim({ ...r, origin: 'import' }); if (!ids.has(c.id)) { L.claims.push(c); ids.add(c.id); added++; } }); save(); return { added, skipped: arr.length - added }; }
    if (method === 'POST' && (m = p.match(/^\/api\/claims\/([^/]+)\/evidence$/))) { const url = GN.safeHref(body.url); if (!url) err('URL bukti harus http/https.'); L.ev.push({ id: Date.now(), claim_id: m[1], kind: body.kind || 'other', stance: body.stance || 'context', url, title: body.title || '', note: body.note || '', added_by: api.who, created_at: new Date().toISOString() }); save(); return { id: 1 }; }
    if (method === 'DELETE' && (m = p.match(/^\/api\/evidence\/(\d+)$/))) { L.ev = L.ev.filter(e => String(e.id) !== m[1]); save(); return { ok: true }; }
    if (method === 'POST' && (m = p.match(/^\/api\/claims\/([^/]+)\/region$/))) { const c = L.claims.find(x => x.id === m[1]); const pv = G.lexicon.PROVINCES.find(x => x.code === body.code); if (!c || !pv) err('Data tidak valid.'); c.region = pv.name; c.regionCode = pv.code; c.regionStatus = body.status || 'verified'; save(); return { ok: true }; }
    if (method === 'POST' && (m = p.match(/^\/api\/claims\/([^/]+)\/review$/))) {
      const c = L.claims.find(x => x.id === m[1]); if (!c) err('Klaim tidak ditemukan.', 404); const who = (body.reviewer || api.who || '').trim(); if (who.length < 2) err('Nama pemeriksa wajib diisi.');
      if (body.status !== 'needs-review' && String(body.note || '').trim().length < 20) err('Alasan keputusan minimal 20 karakter.'); const ev = L.ev.filter(e => e.claim_id === c.id);
      if (['verified', 'false', 'misleading'].includes(body.status) && !ev.length) err('Keputusan ini memerlukan minimal satu bukti.', 422);
      c.status = body.status; c.verificationNote = body.note; c.updatedAt = new Date().toISOString(); L.rv.push({ id: Date.now(), claim_id: c.id, reviewer: who, role: 'analis', status: body.status, note: body.note, stage: 'applied', created_at: c.updatedAt }); save(); return { applied: true, status: c.status, message: 'Tersimpan (mode lokal: prinsip empat-mata hanya tersedia di mode server).' };
    }
    if (method === 'POST' && p === '/api/demo/reset') { return loadDemo().then(() => ({ ok: true, claims: L.claims.length })); }
    if (method === 'GET' && p === '/api/credibility') { const c = lcorpus(), by = new Map(); c.claims.forEach(x => { const o = by.get(x.source) || { name: x.source, items: 0, verified: 0, false: 0, misleading: 0, context: 0 }; o.items++; if (x.status === 'verified') o.verified++; else if (x.status === 'false') o.false++; else if (x.status === 'misleading') o.misleading++; else if (x.status === 'context-needed') o.context++; by.set(x.source, o); }); return { sources: [...by.values()].map(o => ({ id: o.name, name: o.name, tier: 'D', tierLabel: N.TIER_LABEL.D, items: o.items, credibility: N.sourceCredibility('D', o), managed: false })).sort((a, b) => b.credibility.score - a.credibility.score), method: 'Prior tier D + hasil verifikasi item.' }; }
    if (method === 'GET' && p === '/api/alerts') return { alerts: [] }; if (method === 'GET' && p === '/api/sources') return { sources: [], unsupported: true }; if (method === 'GET' && p === '/api/runs') return { runs: [] };
    if (method === 'GET' && p === '/api/pipeline') return { unsupported: true, stages: [{ key: 'collect', label: 'Collect', value: 0 }, { key: 'clean', label: 'Clean', value: 0 }, { key: 'normalize', label: 'Normalize', value: 0 }, { key: 'analyze', label: 'Analyze', value: lcorpus().claims.length }, { key: 'cluster', label: 'Cluster', value: lcorpus().clusters.length }, { key: 'alert', label: 'Alert', value: 0 }, { key: 'verify', label: 'Verify', value: lcorpus().claims.filter(c => c.status === 'needs-review').length }], scheduler: { active: false } };
    err('Fitur ini memerlukan backend GARDA NARASI (scheduler, pengumpulan, peringatan, laporan PDF).', 501);
  }

  /* ---------- mode server ---------- */
  async function http(method, path, body) {
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Reviewer': encodeURIComponent(api.who || 'anonim'), ...(api.token ? { Authorization: 'Bearer ' + api.token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status === 401) { const t = prompt('Token API diperlukan:'); if (t) { api.token = t; sessionStorage.setItem('gn.token', t); return http(method, path, body); } }
    const data = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(data.error || 'Permintaan gagal (' + r.status + ')'); e.status = r.status; throw e; } return data;
  }
  api.init = async () => {
    try { const r = await fetch('/api/health'); if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw 0; api.health = await r.json(); api.mode = 'server'; }
    catch { api.mode = 'local'; await localInit(); api.health = { ok: true, version: '0.2.0-lokal' }; }
    return api.mode;
  };
  const call = async (m, p, b) => api.mode === 'server' ? http(m, p, b) : Promise.resolve().then(() => localCall(m, p, b));
  api.get = p => call('GET', p); api.post = (p, b) => call('POST', p, b || {}); api.put = (p, b) => call('PUT', p, b || {}); api.patch = (p, b) => call('PATCH', p, b || {}); api.del = p => call('DELETE', p);
  api.setWho = n => { api.who = n; localStorage.setItem('gn.who', n); };
  api.exportLocal = () => L.claims;
  api.url = p => api.mode === 'server' ? p + (api.token ? (p.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(api.token) : '') : null;
})();
