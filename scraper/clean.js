'use strict';
/* Tahap Clean & Normalize: bersihkan HTML, masking PII, kanonikalisasi URL, tanggal, bahasa, hash dedup. */
const G = require('../engine/index.js'); const N = G.nlp;

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_|source$|campaign$|igshid)/i;
function canonicalUrl(raw) {
  try {
    const u = new URL(raw); if (!['http:', 'https:'].includes(u.protocol)) return '';
    u.hash = ''; u.hostname = u.hostname.toLowerCase().replace(/^www\./, ''); [...u.searchParams.keys()].forEach(k => { if (TRACKING.test(k)) u.searchParams.delete(k); });
    u.searchParams.sort(); let s = u.toString(); if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1); return s;
  } catch { return ''; }
}
function parseDate(v, fallback) { const d = new Date(v); return Number.isNaN(d.getTime()) ? fallback : d.toISOString(); }
const ID_COMMON = new Set(['yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'ini', 'itu', 'akan', 'telah', 'sudah', 'ada', 'tidak', 'dalam', 'oleh', 'karena', 'bahwa', 'juga', 'adalah', 'sebagai', 'warga', 'mulai', 'setelah', 'sedang', 'belum', 'atau', 'para', 'saat', 'bagi', 'secara']);
const EN_COMMON = new Set(['the', 'and', 'of', 'to', 'in', 'is', 'that', 'for', 'on', 'with', 'as', 'by', 'at', 'from', 'are', 'was', 'will', 'has', 'have', 'new', 'said', 'after']);
function languageScores(text) {
  const words = N.normalize(text).split(' ').filter(Boolean); if (words.length < 4) return { id: 0.5, en: 0 };
  return { id: words.filter(w => ID_COMMON.has(w)).length / words.length, en: words.filter(w => EN_COMMON.has(w)).length / words.length };
}
// Heuristik sederhana: Indonesia bila kata fungsi Indonesia cukup dan lebih dominan dari Inggris. Tidak membedakan Melayu/daerah.
function indonesianRatio(text) { const s = languageScores(text); return s.id >= 0.03 && s.id > s.en * 1.5 ? Math.max(s.id, 0.07) : s.id; }
function cleanItem(raw, { collectedAt, maxSummary = 400, maxAgeDays = 14 }) {
  const link = canonicalUrl(raw.link); if (!link) return { drop: 'url-tidak-valid' };
  const title = N.maskPII(raw.title || '').slice(0, 200).trim(); if (title.length < 8) return { drop: 'judul-kosong' };
  let summary = N.maskPII(raw.summary || '').trim(); if (summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) summary = summary.slice(title.length).trim();
  summary = summary.length > maxSummary ? summary.slice(0, maxSummary).replace(/\s+\S*$/, '') + '…' : summary; // kutipan pendek — hak cipta
  const published = parseDate(raw.published, collectedAt); const age = (new Date(collectedAt) - new Date(published)) / 86400000;
  if (age > maxAgeDays) return { drop: 'terlalu-lama' };
  if (new Date(published) - new Date(collectedAt) > 3600000) return { drop: 'tanggal-masa-depan' };
  const domain = new URL(link).hostname; const lang = indonesianRatio(`${title} ${summary}`) >= 0.07 ? 'id' : 'lain';
  const normTitle = N.normalize(title);
  return { item: { title, summary, url: link, urlHash: N.hash53(link), contentHash: N.hash53(normTitle), titleNorm: normTitle, published, domain, lang, categories: (raw.categories || []).slice(0, 5) } };
}
module.exports = { canonicalUrl, cleanItem, indonesianRatio, parseDate };
