/* GARDA NARASI — agregasi dasbor dari hasil analyzeCorpus (dipakai server dan mode lokal browser). */
(function (G) {
  'use strict';
  const N = G.nlp, L = G.lexicon;
  const DAY = 86400000;

  function pressureIndex(corpus) {
    const pend = corpus.claims.map((c, i) => ({ c, a: corpus.analyses[i] })).filter(x => x.c.status === 'needs-review');
    const highShare = pend.length ? pend.filter(x => x.a.urgency.score >= 70).length / pend.length : 0;
    const burstShare = corpus.clusters.length ? corpus.clusters.filter(k => k.burst.burst).length / corpus.clusters.length : 0;
    const amp = Math.min(1, corpus.amplification.length / 3);
    return { value: Math.round(100 * (0.45 * highShare + 0.30 * burstShare + 0.25 * amp)), parts: { highShare: Math.round(highShare * 100), burstShare: Math.round(burstShare * 100), amplification: Math.round(amp * 100) } };
  }

  function buildOverview(corpus, extra = {}) {
    const { claims, analyses, clusters, amplification } = corpus;
    const total = claims.length, pending = claims.filter(c => c.status === 'needs-review').length;
    const sent = { positive: 0, negative: 0, neutral: 0 }, epi = {};
    const topicMap = new Map(), geo = new Map(), geoCand = new Map();
    claims.forEach((c, i) => {
      const a = analyses[i]; sent[a.sentiment.label]++;
      const ek = a.epistemicDisplay.key; epi[ek] = (epi[ek] || 0) + 1;
      const tn = a.topic.topic || 'Informasi umum';
      if (!topicMap.has(tn)) topicMap.set(tn, { topic: tn, count: 0, mentions: 0, pending: 0, urgencySum: 0, sentiment: { positive: 0, negative: 0, neutral: 0 } });
      const t = topicMap.get(tn); t.count++; t.mentions += c.mentions; t.urgencySum += a.urgency.score; if (c.status === 'needs-review') t.pending++; t.sentiment[a.sentiment.label]++;
      if (c.regionCode && c.regionStatus === 'verified') geo.set(c.regionCode, (geo.get(c.regionCode) || 0) + 1);
      else if (c.regionStatus === 'candidate' && c.regionCode) geoCand.set(c.regionCode, (geoCand.get(c.regionCode) || 0) + 1);
    });
    const topics = [...topicMap.values()].map(t => ({ ...t, avgUrgency: Math.round(t.urgencySum / t.count) })).sort((a, b) => b.mentions - a.mentions);

    // Tren harian (mentions per tanggal, 7 hari terakhir dari data terbaru) & per jam (24 jam terakhir)
    const dates = claims.map(c => new Date(c.date).getTime()).filter(Number.isFinite);
    const ref = dates.length ? Math.max(...dates) : Date.now();
    const daily = []; for (let k = 6; k >= 0; k--) { const d = new Date(ref - k * DAY); daily.push({ key: d.toISOString().slice(0, 10), label: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(d), value: 0, items: 0 }); }
    claims.forEach(c => { const key = new Date(c.date).toISOString().slice(0, 10); const d = daily.find(x => x.key === key); if (d) { d.value += c.mentions; d.items++; } });
    const topTopics = topics.slice(0, 5).map(t => t.topic);
    const heat = topTopics.map(tn => ({ topic: tn, buckets: new Array(24).fill(0) }));
    claims.forEach((c, i) => { const row = heat.find(h => h.topic === analyses[i].topic.topic); if (!row) return; const hrs = Math.floor((ref - new Date(c.date).getTime()) / 3600000); if (hrs >= 0 && hrs < 24) row.buckets[23 - hrs] += 1; });
    const dailyTopics = topTopics.map(tn => ({ topic: tn, values: daily.map(d => claims.reduce((a, c, i) => a + (analyses[i].topic.topic === tn && new Date(c.date).toISOString().slice(0, 10) === d.key ? c.mentions : 0), 0)) }));
    const refHourLabel = h => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ref - (23 - h) * 3600000));

    const rows = claims.map((c, i) => ({ claim: c, analysis: analyses[i] })).sort((a, b) => b.analysis.urgency.score - a.analysis.urgency.score);
    // Jaringan: sumber → klaster → topik
    const topClusters = [...clusters].sort((a, b) => b.mentions - a.mentions).slice(0, 18);
    const srcCount = new Map(); topClusters.forEach(k => k.sources.forEach(s => srcCount.set(s, (srcCount.get(s) || 0) + 1)));
    const srcKeep = [...srcCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(x => x[0]);
    const nodes = [], edges = [];
    srcKeep.forEach(s => nodes.push({ id: 's:' + s, kind: 'source', label: s, weight: srcCount.get(s) }));
    topClusters.forEach(k => nodes.push({ id: 'k:' + k.id, kind: 'cluster', label: k.label, weight: k.size, mentions: k.mentions, burst: k.burst.burst, topic: k.topic, clusterId: k.id }));
    const topicNodes = new Set(topClusters.map(k => k.topic)); topicNodes.forEach(t => nodes.push({ id: 't:' + t, kind: 'topic', label: t, weight: topClusters.filter(k => k.topic === t).length }));
    topClusters.forEach(k => {
      edges.push({ source: 'k:' + k.id, target: 't:' + k.topic, weight: 1, kind: 'topic' });
      const cnt = new Map(); k.memberIds.forEach(id => { const c = claims[corpus.byId.get(id)]; cnt.set(c.source, (cnt.get(c.source) || 0) + 1); });
      cnt.forEach((w, s) => { if (srcKeep.includes(s)) edges.push({ source: 's:' + s, target: 'k:' + k.id, weight: w, kind: 'source' }); });
    });

    return {
      generatedAt: new Date().toISOString(), referenceTime: new Date(ref).toISOString(),
      kpis: { total, pending, reviewed: total - pending, highPriority: rows.filter(r => r.analysis.urgency.score >= 70).length, clusters: clusters.length, burstClusters: clusters.filter(k => k.burst.burst).length, amplification: amplification.length, synthetic: claims.filter(c => c.isSynthetic).length, live: claims.filter(c => c.origin === 'collector').length },
      pressure: pressureIndex(corpus), dailyTopics, sentiment: sent, epistemic: epi, topics, daily, heat: { rows: heat, labels: Array.from({ length: 24 }, (_, h) => refHourLabel(h)) },
      geo: { verified: Object.fromEntries(geo), candidate: Object.fromEntries(geoCand) }, network: { nodes, edges },
      priority: rows.slice(0, 8).map(r => ({ id: r.claim.id, title: r.claim.title, topic: r.analysis.topic.topic, region: r.claim.region, mentions: r.claim.mentions, status: r.claim.status, score: r.analysis.urgency.score, level: r.analysis.urgency.level, burst: r.analysis.burst.burst, amplified: r.analysis.amplified, clusterId: r.analysis.clusterId })),
      ...extra
    };
  }

  function provinceMeta() { return L.PROVINCES.map(p => ({ code: p.code, name: p.name, lat: p.lat, lon: p.lon, col: p.col, row: p.row })); }


  function claimView(corpus, i) {
    const c = corpus.claims[i], a = corpus.analyses[i];
    return { id: c.id, origin: c.origin, title: c.title, claim: c.claim, topic: a.topic.topic, topicConfidence: a.topic.confidence, region: c.region, regionCode: c.regionCode, regionStatus: c.regionStatus, source: c.source, sourceId: c.sourceId, sourceUrl: c.sourceUrl, channels: c.channels, mentions: c.mentions, status: c.status, date: c.date, firstSeen: c.firstSeen, isSynthetic: c.isSynthetic, evidenceCount: c.evidenceCount, verificationNote: c.verificationNote, hourlyCounts: c.hourlyCounts,
      clusterId: a.clusterId, urgency: a.urgency, burst: a.burst, amplified: a.amplified, sentiment: { label: a.sentiment.label, score: a.sentiment.score, confidence: a.sentiment.confidence }, epistemic: { type: a.epistemic.type, label: a.epistemic.label, confidence: a.epistemic.confidence }, epistemicDisplay: a.epistemicDisplay, confidence: a.confidence };
  }
  function claimDetail(corpus, id) {
    const i = corpus.byId.get(id); if (i === undefined) return null; const a = corpus.analyses[i]; const cl = corpus.clusters.find(k => k.id === a.clusterId);
    return { ...claimView(corpus, i), analysis: { urgency: a.urgency, topic: a.topic, sentiment: a.sentiment, epistemic: a.epistemic, burst: a.burst, evidence: a.evidence, locations: a.locations, confidence: a.confidence }, similar: corpus.similar(i),
      cluster: cl ? { id: cl.id, stableId: cl.stableId, label: cl.label, size: cl.size, keywords: cl.keywords, burst: cl.burst, series: cl.series, sources: cl.sources, cohesion: cl.cohesion } : null,
      amplification: corpus.amplification.filter(x => x.claimIds.includes(id)).map(x => ({ id: x.id, index: x.index, sources: x.sources, caveat: x.caveat, claimIds: x.claimIds })) };
  }
  function filterClaims(corpus, q) {
    const text = (q.q || '').toLowerCase(); let rows = corpus.claims.map((_, i) => claimView(corpus, i)).filter(r => (!text || `${r.title} ${r.claim} ${r.region} ${r.source}`.toLowerCase().includes(text)) && (!q.topic || q.topic === 'all' || r.topic === q.topic) && (!q.status || q.status === 'all' || r.status === q.status) && (!q.origin || q.origin === 'all' || r.origin === q.origin) && (!q.cluster || r.clusterId === q.cluster) && (!q.region || r.regionCode === q.region));
    const sort = q.sort || 'urgency'; rows.sort(sort === 'date' ? (a, b) => new Date(b.date) - new Date(a.date) : sort === 'mentions' ? (a, b) => b.mentions - a.mentions : (a, b) => b.urgency.score - a.urgency.score);
    return { total: rows.length, items: rows.slice(Number(q.offset || 0), Number(q.offset || 0) + Math.min(500, Number(q.limit || 200))), topics: [...new Set(corpus.analyses.map(a => a.topic.topic))].sort() };
  }
  function geoView(corpus) {
    const prov = provinceMeta().map(p => ({ ...p, verified: 0, candidate: 0, urgencySum: 0, items: [] }));
    corpus.claims.forEach((cl, i) => { const p = prov.find(x => x.code === cl.regionCode); if (!p) return; if (cl.regionStatus === 'verified') { p.verified++; p.urgencySum += corpus.analyses[i].urgency.score; p.items.push({ id: cl.id, title: cl.title, score: corpus.analyses[i].urgency.score, status: cl.status }); } else if (cl.regionStatus === 'candidate') p.candidate++; });
    return { provinces: prov.map(p => ({ ...p, avgUrgency: p.verified ? Math.round(p.urgencySum / p.verified) : 0, items: p.items.sort((a, b) => b.score - a.score).slice(0, 5) })), notice: 'Hanya lokasi berstatus "terverifikasi" oleh pemeriksa manusia yang dihitung pada peta. Kandidat lokasi (kecocokan nama pada teks) ditampilkan terpisah dan belum diverifikasi.' };
  }
  function clusterList(corpus) {
    return { clusters: corpus.clusters.slice().sort((a, b) => b.mentions - a.mentions).map(k => ({ id: k.id, stableId: k.stableId, label: k.label, keywords: k.keywords, size: k.size, mentions: k.mentions, topic: k.topic, sources: k.sources, burst: k.burst, series: k.series, firstSeen: k.firstSeen, lastSeen: k.lastSeen, cohesion: k.cohesion, representativeId: k.representativeId })) };
  }
  function analyzeFree(corpus, text) {
    text = String(text || '').slice(0, 2000); const a = N.analyzeText(N.maskPII(text)); const toks = N.tokenize(text, { concepts: true });
    const corpusToks = corpus.claims.map(x => N.tokenize(N.claimText(x), { concepts: true })); const model = new N.TfIdf([toks, ...corpusToks], { bigrams: false }); const v = model.vector(toks);
    const sim = corpus.claims.map((x, i) => ({ id: x.id, title: x.title, similarity: Math.round(N.cosine(v, model.vector(corpusToks[i])) * 100) / 100 })).filter(x => x.similarity >= 0.2).sort((x, y) => y.similarity - x.similarity).slice(0, 5);
    return { ...a, tokens: toks.slice(0, 40), similar: sim, note: 'Hasil otomatis adalah indikasi dari pola bahasa — bukan penentu kebenaran.' };
  }
  G.analytics = { buildOverview, pressureIndex, provinceMeta, claimView, claimDetail, filterClaims, geoView, clusterList, analyzeFree };

})(typeof window !== 'undefined' ? (window.GARDA = window.GARDA || {}) : (globalThis.GARDA = globalThis.GARDA || {}));
