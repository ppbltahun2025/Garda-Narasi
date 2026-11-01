'use strict';
/* Tahap Alert: mengubah sinyal analitik menjadi peringatan dini yang dapat ditelusuri (evidence tracking). */
const LEVELS = ['info', 'watch', 'warning', 'critical']; const LEVEL_LABEL = { info: 'Info', watch: 'Pantau', warning: 'Waspada', critical: 'Kritis' };

function evaluateAlerts(corpus, nowMs) {
  const out = []; const { claims, analyses, clusters, amplification } = corpus;
  const idx = id => corpus.byId.get(id);
  const urlsOf = ids => ids.map(id => claims[idx(id)].sourceUrl).filter(Boolean).slice(0, 8);
  const ampByCluster = new Map(amplification.map(s => [s.clusterId, s]));
  clusters.forEach(k => {
    if (!k.burst.burst) return;
    const amp = ampByCluster.get(k.index);
    const maxUrg = Math.max(...k.memberIds.map(id => analyses[idx(id)].urgency.score));
    const level = amp && maxUrg >= 70 ? 'critical' : amp || maxUrg >= 70 ? 'warning' : 'watch';
    out.push({
      key: `burst:${k.stableId}:${Math.floor(nowMs / 21600000)}`, level, kind: 'burst', clusterKey: k.stableId, claimId: k.representativeId,
      title: `Lonjakan narasi: ${k.label}`,
      detail: { cluster: { id: k.stableId, label: k.label, keywords: k.keywords, size: k.size, mentions: k.mentions, topic: k.topic, firstSeen: k.firstSeen, lastSeen: k.lastSeen, sources: k.sources },
        metrics: { ...k.burst, series: k.series, maxUrgency: maxUrg }, claimIds: k.memberIds.slice(0, 12), urls: urlsOf(k.memberIds),
        amplification: amp ? { index: amp.index, sources: amp.sources, caveat: amp.caveat } : null,
        why: `Volume jam terakhir ${k.burst.current} vs baseline ${k.burst.baseline} (z=${k.burst.z}).`, note: 'Lonjakan volume bukan bukti kebenaran/kesalahan klaim dan bukan bukti koordinasi. Perlu verifikasi manusia.' }
    });
  });
  amplification.forEach(s => {
    if (s.index < 45) return; const k = clusters[s.clusterId];
    out.push({
      key: `amp:${k.stableId}:${Math.floor(nowMs / 86400000)}`, level: s.index >= 70 ? 'warning' : 'watch', kind: 'amplification', clusterKey: k.stableId, claimId: s.claimIds[0],
      title: `Indikasi amplifikasi lintas sumber (${s.sources.length} sumber): ${k.label}`,
      detail: { index: s.index, sources: s.sources, channels: s.channels, spanMinutes: s.spanMinutes, meanSimilarity: s.meanSimilarity, nearCopyRatio: s.nearCopyRatio, pairs: s.pairs, earliest: s.earliest, claimIds: s.claimIds, urls: urlsOf(s.claimIds), caveat: s.caveat,
        why: `${s.claimIds.length} item dari ${s.sources.length} sumber dalam ${s.spanMinutes} menit dengan kemiripan rata-rata ${Math.round(s.meanSimilarity * 100)}%.` }
    });
  });
  claims.forEach((c, i) => {
    const a = analyses[i]; if (c.status !== 'needs-review' || a.urgency.score < 80) return;
    out.push({
      key: `urgent:${c.id}`, level: a.urgency.score >= 90 ? 'critical' : 'warning', kind: 'urgency', claimId: c.id, clusterKey: a.clusterId,
      title: `Prioritas pemeriksaan tinggi (${a.urgency.score}/100): ${c.title}`,
      detail: { urgency: a.urgency, epistemic: { type: a.epistemic.type, label: a.epistemic.label, cues: a.epistemic.cues }, confidence: a.confidence, urls: urlsOf([c.id]), claimIds: [c.id], why: 'Skor urgensi menggabungkan volume, kebaruan, keragaman kanal, kebutuhan review, serta bonus lonjakan/amplifikasi.', note: 'Skor urgensi adalah prioritas antrean, bukan skor kebenaran.' }
    });
  });
  return out;
}

async function sendWebhook(url, payload, { allowPrivate = false } = {}) {
  const { assertPublicHost } = require('../scraper/net.js'); const u = new URL(url); await assertPublicHost(u.hostname, allowPrivate);
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000);
  try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal }); return r.status; } finally { clearTimeout(t); }
}
module.exports = { evaluateAlerts, sendWebhook, LEVELS, LEVEL_LABEL };
