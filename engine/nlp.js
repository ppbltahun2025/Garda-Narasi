/* GARDA NARASI — mesin NLP Bahasa Indonesia (tanpa dependensi, berjalan di Node dan browser).
   Seluruh keluaran bersifat indikatif untuk prioritas pemeriksaan manusia; bukan penentu kebenaran. */
(function (G) {
  'use strict';
  const L = G.lexicon;
  const STOP = new Set(L.STOPWORDS);

  /* ======================= Utilitas ======================= */
  function hash53(str, seed = 0) { // cyrb53 — hash non-kriptografis untuk dedup & ID
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  /* ======================= Privasi: masking PII ======================= */
  function maskPII(text = '') {
    return String(text)
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
      .replace(/\b\d{16}\b/g, '[nik]')
      .replace(/(\+62|\b62|\b0)8\d[\d\s-]{7,12}\d/g, '[telepon]')
      .replace(/(^|\s)@[A-Za-z0-9_.]{2,}/g, '$1[akun]');
  }

  /* ======================= Normalisasi & stemming ringan ======================= */
  const PROTECT = new Set(('masalah sekolah salah kalah pemerintah pemerintahan perintah mengapa penting perlu pesan peta pekan pelan pecah pergi pernah pertama perempuan ' +
    'selamat sedikit semua sebuah sebagai sekarang selalu sehingga seperti terlalu tentang tempat teman beberapa belum bencana menteri polisi ' +
    'informasi organisasi administrasi evaluasi evakuasi korupsi kondisi lokasi demokrasi situasi aksi instansi provinsi kabupaten kecamatan kelurahan ' +
    'bandara pelabuhan peringatan perbaikan pendidikan kesehatan kebakaran banjir longsor gempa jembatan sungai bantuan layanan pelayanan sampah ' +
    'tersangka terdakwa terorisme ternyata terutama terbaru terakhir tertinggi terendah pemilu pemilik peserta pelajar penduduk pegawai petugas penyakit ' +
    'sebelum sesudah setelah sedang sering semakin sendiri senjata serangan seluruh sejak sekitar sebagian bersama berita berapa merdeka pasokan pengungsi pengungsian mengungsi').split(/\s+/));
  const PREFIXES = ['memper', 'diper', 'meng', 'meny', 'mem', 'men', 'me', 'peng', 'peny', 'pem', 'pen', 'per', 'pe', 'ber', 'ter', 'di', 'ke', 'se'];
  const stemCache = new Map();
  function stem(word) {
    if (word.length <= 4 || /\d/.test(word) || PROTECT.has(word)) return word;
    const cached = stemCache.get(word); if (cached) return cached;
    let s = word, prefixed = false, usedPrefix = '';
    if (/(kah|lah)$/.test(s) && s.length - 3 >= 4) s = s.slice(0, -3);
    if (/(nya)$/.test(s) && s.length - 3 >= 4) s = s.slice(0, -3);
    else if (/(ku|mu)$/.test(s) && s.length - 2 >= 5) s = s.slice(0, -2);
    for (const p of PREFIXES) {
      if (s.startsWith(p) && s.length - p.length >= 4) {
        let rest = s.slice(p.length);
        if ((p === 'meny' || p === 'peny') && /^[aiueo]/.test(rest)) rest = 's' + rest;
        if (rest.length >= 4) { s = rest; prefixed = true; usedPrefix = p; break; }
      }
    }
    if (prefixed && /kan$/.test(s) && s.length - 3 >= 4) s = s.slice(0, -3);
    else if (/an$/.test(s) && s.length - 2 >= 4 && !/(aan|ian)$/.test(s)) s = s.slice(0, -2);
    else if (prefixed && usedPrefix !== 'meng' && usedPrefix !== 'peng' && /i$/.test(s) && s.length - 1 >= 4) s = s.slice(0, -1);
    if (stemCache.size > 50000) stemCache.clear();
    stemCache.set(word, s);
    return s;
  }

  function normalize(text = '') {
    let t = String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    t = t.replace(/https?:\/\/\S+|www\.\S+/g, ' ').replace(/\[(email|nik|telepon|akun)\]/g, ' ');
    t = t.replace(/(.)\1{2,}/g, '$1').replace(/[^a-z0-9\s'-]/g, ' ').replace(/['-]/g, ' ');
    const words = t.split(/\s+/).filter(Boolean).map(w => L.SLANG[w] || w);
    return words.join(' ').replace(/\s+/g, ' ').trim();
  }

  const CONCEPT_OF = new Map();
  Object.entries(L.CONCEPTS).forEach(([id, words]) => words.split(/\s+/).forEach(w => { if (!w.includes('_')) { if (!CONCEPT_OF.has(w)) CONCEPT_OF.set(w, id); } }));

  /** Token untuk analisis. opts: {stem:true, stop:true, concepts:false, minLen:3} */
  function tokenize(text, opts = {}) {
    const o = { stem: true, stop: true, concepts: false, minLen: 3, ...opts };
    const out = [];
    for (const w of normalize(text).split(' ')) {
      if (!w || w.length < o.minLen || (o.stop && STOP.has(w))) continue;
      const t = o.stem ? stem(w) : w;
      out.push(t);
      if (o.concepts) { const c = CONCEPT_OF.get(w) || CONCEPT_OF.get(t); if (c) out.push(c); }
    }
    return out;
  }

  /* ======================= TF-IDF & cosine ======================= */
  function ngrams(tokens, bigrams = true) {
    if (!bigrams) return tokens.slice();
    const out = tokens.slice();
    for (let i = 0; i < tokens.length - 1; i++) out.push(tokens[i] + '_' + tokens[i + 1]);
    return out;
  }
  class TfIdf {
    constructor(docs, opts = {}) { // docs: array of token arrays
      this.opts = { bigrams: true, sublinear: true, ...opts };
      this.N = docs.length; this.df = new Map();
      docs.forEach(tokens => new Set(ngrams(tokens, this.opts.bigrams)).forEach(t => this.df.set(t, (this.df.get(t) || 0) + 1)));
    }
    idf(term) { return Math.log((1 + this.N) / (1 + (this.df.get(term) || 0))) + 1; }
    vector(tokens) {
      const tf = new Map();
      ngrams(tokens, this.opts.bigrams).forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
      const vec = new Map(); let norm = 0;
      tf.forEach((c, t) => { const w = (this.opts.sublinear ? 1 + Math.log(c) : c) * this.idf(t); vec.set(t, w); norm += w * w; });
      norm = Math.sqrt(norm) || 1; vec.forEach((w, t) => vec.set(t, w / norm));
      return vec;
    }
  }
  function cosine(a, b) {
    if (!a || !b || !a.size || !b.size) return 0;
    const [s, l] = a.size <= b.size ? [a, b] : [b, a]; let dot = 0;
    s.forEach((w, t) => { const x = l.get(t); if (x) dot += w * x; });
    return clamp(dot);
  }
  function addVec(target, vec, weight = 1) { vec.forEach((w, t) => target.set(t, (target.get(t) || 0) + w * weight)); return target; }
  function normVec(vec) { let n = 0; vec.forEach(w => { n += w * w; }); n = Math.sqrt(n) || 1; const out = new Map(); vec.forEach((w, t) => out.set(t, w / n)); return out; }
  function topTerms(vec, k = 5) { return [...vec.entries()].filter(([t]) => !t.includes('_') && !/^C_/.test(t)).sort((a, b) => b[1] - a[1]).slice(0, k).map(([t]) => t); }

  /** Kemiripan teks dua dokumen (konvensi evaluasi): cosine TF-IDF pada korpus kecil berisi keduanya + korpus referensi opsional */
  function textSimilarity(a, b, opts = {}) {
    const ta = tokenize(a, { concepts: true, ...opts }), tb = tokenize(b, { concepts: true, ...opts });
    const model = new TfIdf([ta, tb, ...(opts.background || [])], { bigrams: opts.bigrams !== false });
    return cosine(model.vector(ta), model.vector(tb));
  }
  function jaccard(a, b) {
    const A = new Set(tokenize(a, { stem: false })), B = new Set(tokenize(b, { stem: false }));
    if (!A.size || !B.size) return 0; let sh = 0; A.forEach(x => { if (B.has(x)) sh++; });
    return sh / (A.size + B.size - sh);
  }

  /* ======================= Sentimen Bahasa Indonesia (leksikon + negasi + intensitas) ======================= */
  const SENT = new Map(), SENT_PHRASE = new Map();
  [[L.SENT_NEG], [L.SENT_POS]].forEach(([dict]) => Object.entries(dict).forEach(([k, v]) => {
    if (k.includes('_')) SENT_PHRASE.set(k.replace(/_/g, ' '), v); else { SENT.set(k, v); SENT.set(stem(k), v); }
  }));
  function sentiment(text) {
    const words = normalize(text).split(' ').filter(Boolean);
    let sum = 0, hits = 0; const terms = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i]; let val = null, term = w; const start = i;
      const bi = words[i + 1] ? w + ' ' + words[i + 1] : null;
      if (bi && SENT_PHRASE.has(bi)) { val = SENT_PHRASE.get(bi); term = bi; i++; }
      else if (SENT.has(w)) val = SENT.get(w);
      else if (SENT.has(stem(w)) && !STOP.has(w)) val = SENT.get(stem(w));
      if (val === null || val === 0) continue;
      let mult = 1, negated = false;
      for (let k = 1; k <= 3 && start - k >= 0; k++) { // jendela 3 kata ke belakang
        const prev = words[start - k];
        if (L.NEGATORS.includes(prev)) { negated = true; break; }
        if (L.INTENSIFIERS[prev]) mult *= L.INTENSIFIERS[prev];
        if (L.DIMINISHERS[prev]) mult *= L.DIMINISHERS[prev];
      }
      const next = words[i + 1]; if (next && L.INTENSIFIERS[next]) mult *= L.INTENSIFIERS[next];
      if (term.startsWith('tidak ') ) { /* frasa negatif eksplisit: jangan dibalik */ negated = false; }
      const contribution = negated ? -0.7 * val * mult : val * mult;
      sum += contribution; hits++; terms.push({ term, weight: Math.round(contribution * 100) / 100, negated });
    }
    const len = Math.max(6, words.filter(w => !STOP.has(w)).length);
    const raw = sum / Math.sqrt(len);
    const label = raw > 0.35 ? 'positive' : raw < -0.35 ? 'negative' : 'neutral';
    const confidence = hits === 0 ? 0.3 : clamp(0.35 + 0.65 * Math.tanh(Math.abs(raw) * 1.2 + (label === 'neutral' ? -0.2 : 0)));
    return { label, score: Math.round(raw * 100) / 100, confidence: Math.round(confidence * 100) / 100, hits, terms };
  }

  /* ======================= Deteksi topik (benih leksikon + skor softmax) ======================= */
  const TOPIC_MODEL = Object.entries(L.TOPICS).map(([name, words]) => {
    const w = new Map(); words.split(/\s+/).forEach(x => { const s = stem(x); w.set(s, (w.get(s) || 0) + 1); w.set(x, (w.get(x) || 0) + 1); });
    return { name, weights: w };
  });
  function detectTopic(text) {
    const toks = tokenize(text, { stem: true }); const raw = tokenize(text, { stem: false });
    const scores = TOPIC_MODEL.map(t => {
      let s = 0; const matched = new Set();
      toks.forEach(x => { if (t.weights.has(x)) { s += 1; matched.add(x); } });
      raw.forEach(x => { if (t.weights.has(x) && !matched.has(x)) { s += 0.5; matched.add(x); } });
      return { topic: t.name, score: s, terms: [...matched] };
    }).sort((a, b) => b.score - a.score);
    const top = scores[0], second = scores[1];
    if (!top || top.score < 1) return { topic: 'Informasi umum', confidence: 0.2, terms: [], alternatives: [] };
    const exps = scores.map(s => Math.exp(s.score)); const total = exps.reduce((a, b) => a + b, 0);
    const prob = Math.exp(top.score) / total;
    const margin = (top.score - (second ? second.score : 0)) / (top.score + 1);
    const confidence = clamp(0.5 * prob + 0.5 * margin + (top.score >= 3 ? 0.1 : 0), 0.15, 0.97);
    return { topic: top.topic, confidence: Math.round(confidence * 100) / 100, terms: top.terms.slice(0, 8), alternatives: scores.slice(1, 3).filter(s => s.score > 0).map(s => ({ topic: s.topic, score: s.score })) };
  }

  /* ======================= Klasifikasi epistemik (penanda tekstual) =======================
     Kelas: unverified (klaim belum terverifikasi), speculation (dugaan), opinion (opini), factual (pernyataan faktual-atributif).
     CATATAN: "faktual" hanya berarti teks BERGAYA melaporkan fakta dengan atribusi — BUKAN bukti kebenaran.
     Label "Fakta terverifikasi" hanya muncul bila pemeriksa manusia menetapkan status verified disertai bukti. */
  const EPI_LABEL = { unverified: 'Klaim belum terverifikasi', speculation: 'Dugaan', opinion: 'Opini', factual: 'Pernyataan faktual (atributif)' };
  const EPI_ORDER = ['unverified', 'speculation', 'opinion', 'factual'];
  const EPI_CUES = [];
  EPI_ORDER.forEach(cls => { const seen = new Set(); L.EPISTEMIC[cls].forEach(([cue, w]) => { const c = normalize(cue); if (!seen.has(c)) { seen.add(c); EPI_CUES.push({ cls, cue: c, weight: w }); } }); });
  EPI_CUES.sort((a, b) => b.cue.length - a.cue.length); // frasa panjang lebih dahulu, lalu span dimasking
  function epistemic(text) {
    let norm = ' ' + normalize(text) + ' ';
    const scores = { unverified: 0, speculation: 0, opinion: 0, factual: 0 }; const cues = [];
    for (const e of EPI_CUES) {
      const needle = ' ' + e.cue + ' ';
      if (norm.includes(needle)) { scores[e.cls] += e.weight; cues.push({ cue: e.cue, cls: e.cls, weight: e.weight }); norm = norm.split(needle).join(' ' + '#'.repeat(3) + ' '); }
    }
    if (/\b\d[\d.,]*\s?(orang|jiwa|persen|%|rupiah|rp|km|meter|unit|titik|hari|jam|kk|kepala keluarga|tahun|bulan|warga)\b/.test(norm.trim()) || /\bpukul\s?\d/.test(norm)) { scores.factual += 1.5; cues.push({ cue: 'angka/waktu spesifik', cls: 'factual', weight: 1.5 }); }
    const ranked = EPI_ORDER.map(c => [c, scores[c]]).sort((a, b) => b[1] - a[1] || EPI_ORDER.indexOf(a[0]) - EPI_ORDER.indexOf(b[0]));
    const [top, second] = ranked;
    if (top[1] === 0) return { type: 'factual', label: EPI_LABEL.factual, confidence: 0.25, cues: [], note: 'Tidak ada penanda tekstual; default ke pernyataan atributif dengan keyakinan rendah.' };
    const confidence = clamp((top[1] - second[1]) / (top[1] + 1.5) * 0.7 + Math.min(0.3, top[1] / 12), 0.2, 0.95);
    return { type: top[0], label: EPI_LABEL[top[0]], confidence: Math.round(confidence * 100) / 100, cues: cues.sort((a, b) => b.weight - a.weight).slice(0, 8) };
  }
  /** Label tampilan gabungan: menggabungkan penanda teks dengan keputusan manusia. */
  function epistemicDisplay(auto, status, hasEvidence) {
    if (status === 'verified' && hasEvidence) return { key: 'verified-fact', label: 'Fakta terverifikasi (pemeriksa manusia + bukti)' };
    if (status === 'verified') return { key: 'verified-no-evidence', label: 'Ditandai terverifikasi — bukti belum dilampirkan' };
    return { key: auto.type, label: auto.label };
  }

  /* ======================= Lokasi (kandidat, bukan verifikasi) ======================= */
  const LOC_INDEX = [];
  L.PROVINCES.forEach(p => { [p.name, ...p.alias].forEach(n => LOC_INDEX.push({ key: normalize(n), code: p.code, name: p.name, kind: n === p.name ? 'provinsi' : 'alias' })); });
  Object.entries(L.CITIES).forEach(([c, code]) => LOC_INDEX.push({ key: normalize(c), code, name: (L.PROVINCES.find(p => p.code === code) || {}).name, kind: 'kota', city: c }));
  LOC_INDEX.sort((a, b) => b.key.length - a.key.length);
  function extractLocations(text) {
    let norm = ' ' + normalize(text) + ' '; const found = new Map();
    for (const e of LOC_INDEX) {
      if (norm.includes(' ' + e.key + ' ')) {
        if (!found.has(e.code)) found.set(e.code, { code: e.code, name: e.name, matched: e.city || e.key, kind: e.kind });
        norm = norm.split(' ' + e.key + ' ').join('  ');
      }
    }
    return [...found.values()];
  }

  /* ======================= Normalisasi klaim (kompatibel 0.1.1) ======================= */
  const STATUS = {
    'needs-review': { label: 'Perlu verifikasi', className: 'pending' },
    'verified': { label: 'Terverifikasi', className: 'verified' },
    'false': { label: 'Tidak benar', className: 'false' },
    'misleading': { label: 'Menyesatkan', className: 'misleading' },
    'context-needed': { label: 'Perlu konteks', className: 'context' }
  };
  const safeDate = v => { const d = new Date(v || Date.now()); return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); };
  function normalizeClaim(raw = {}) {
    const channels = Array.isArray(raw.channels) ? raw.channels : String(raw.channels || raw.source || 'Input manual').split('|').map(s => s.trim()).filter(Boolean);
    const date = safeDate(raw.date || raw.lastSeen);
    return {
      id: String(raw.id || `GN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`),
      origin: ['manual', 'demo', 'import', 'collector'].includes(raw.origin) ? raw.origin : (raw.isSynthetic ? 'demo' : 'manual'),
      date, firstSeen: safeDate(raw.firstSeen || raw.date),
      title: String(raw.title || raw.claim || 'Klaim tanpa judul').slice(0, 200),
      claim: String(raw.claim || raw.title || '').slice(0, 2000),
      topic: String(raw.topic || '').slice(0, 80),
      region: String(raw.region || 'Tidak disebutkan').slice(0, 100),
      regionCode: String(raw.regionCode || '').slice(0, 10),
      regionStatus: ['unverified', 'candidate', 'verified'].includes(raw.regionStatus) ? raw.regionStatus : 'unverified',
      source: String(raw.source || channels[0] || 'Input manual').slice(0, 120),
      sourceId: raw.sourceId || null,
      sourceUrl: String(raw.sourceUrl || raw.url || '').slice(0, 500),
      channels: [...new Set(channels)].slice(0, 30),
      mentions: Math.max(1, Math.min(100000, Number(raw.mentions) || 1)),
      status: STATUS[raw.status] ? raw.status : 'needs-review',
      verificationNote: String(raw.verificationNote || '').slice(0, 2000),
      evidenceUrl: String(raw.evidenceUrl || '').slice(0, 500),
      evidenceCount: Number(raw.evidenceCount) || (raw.evidenceUrl ? 1 : 0),
      hourlyCounts: Array.isArray(raw.hourlyCounts) ? raw.hourlyCounts.slice(-24).map(n => Math.max(0, Number(n) || 0)) : [],
      isSynthetic: raw.isSynthetic === true || raw.is_synthetic === 1,
      collectedAt: raw.collectedAt ? safeDate(raw.collectedAt) : null,
      updatedAt: safeDate(raw.updatedAt || raw.date)
    };
  }

  /* ======================= Deteksi lonjakan ======================= */
  function isBurstLegacy(series) { // aturan 0.1.1 dipertahankan sebagai pembanding
    if (!series || series.length < 4) return false;
    const recent = series[series.length - 1]; const baseline = series.slice(0, -1).reduce((a, b) => a + b, 0) / (series.length - 1);
    return recent >= 5 && recent >= Math.max(3, baseline * 2.5);
  }
  /** EWMA + z-skor dengan varians Poisson-floor. counts: lama→baru. */
  function detectBurst(counts, opts = {}) {
    const o = { alpha: 0.35, minCount: 4, zThreshold: 2.5, minPoints: 4, ...opts };
    if (!counts || counts.length < o.minPoints) return { burst: false, z: 0, baseline: 0, current: counts && counts.length ? counts[counts.length - 1] : 0, ratio: 0, method: 'ewma-z', reason: 'seri terlalu pendek' };
    const hist = counts.slice(0, -1), cur = counts[counts.length - 1];
    let mean = hist[0], varr = 0;
    for (let i = 1; i < hist.length; i++) { const d = hist[i] - mean; mean += o.alpha * d; varr = (1 - o.alpha) * (varr + o.alpha * d * d); }
    const sd = Math.sqrt(Math.max(varr, mean, 1));
    const z = (cur - mean) / sd; const ratio = cur / Math.max(1, mean);
    const burst = cur >= o.minCount && z >= o.zThreshold && ratio >= 1.8;
    return { burst, z: Math.round(z * 100) / 100, baseline: Math.round(mean * 100) / 100, current: cur, ratio: Math.round(ratio * 100) / 100, method: 'ewma-z' };
  }
  function bucketHourly(dates, now, hours = 12) {
    const out = new Array(hours).fill(0);
    dates.forEach(d => { const h = Math.floor((now - new Date(d).getTime()) / 3600000); if (h >= 0 && h < hours) out[hours - 1 - h]++; });
    return out;
  }

  /* ======================= Klaster narasi ======================= */
  function claimText(c) { return `${c.title}. ${c.claim}`; }
  function clusterClaims(claims, opts = {}) {
    const threshold = opts.threshold ?? 0.34, mergeThreshold = opts.mergeThreshold ?? 0.5;
    const tokens = claims.map(c => tokenize(claimText(c), { concepts: true }));
    const model = new TfIdf(tokens, { bigrams: false }); // evaluasi pasangan: unigram+stem lebih presisi daripada +bigram
    const vecs = tokens.map(t => model.vector(t));
    const order = claims.map((c, i) => i).sort((a, b) => new Date(claims[a].date) - new Date(claims[b].date));
    const clusters = [];
    order.forEach(i => {
      let best = -1, bestSim = 0;
      clusters.forEach((cl, k) => { const s = Math.max(cosine(vecs[i], cl.centroid), ...cl.members.map(m => cosine(vecs[i], vecs[m]))); if (s > bestSim) { bestSim = s; best = k; } });
      if (best >= 0 && bestSim >= threshold) { const cl = clusters[best]; cl.members.push(i); cl.sum = addVec(cl.sum, vecs[i]); cl.centroid = normVec(cl.sum); }
      else clusters.push({ members: [i], sum: addVec(new Map(), vecs[i]), centroid: vecs[i] });
    });
    let merged = true; // gabungkan klaster yang centroid-nya sangat mirip
    while (merged) {
      merged = false;
      outer: for (let a = 0; a < clusters.length; a++) for (let b = a + 1; b < clusters.length; b++) {
        if (cosine(clusters[a].centroid, clusters[b].centroid) >= mergeThreshold) { clusters[a].members.push(...clusters[b].members); clusters[a].sum = addVec(clusters[a].sum, clusters[b].sum); clusters[a].centroid = normVec(clusters[a].sum); clusters.splice(b, 1); merged = true; break outer; }
      }
    }
    return { clusters, vecs, model };
  }

  /* ======================= Urgensi (formula 0.1.1 + sinyal baru, transparan) ======================= */
  function urgency(claim, ctx = {}) {
    const now = ctx.now ? new Date(ctx.now) : new Date();
    const mentions = Math.max(1, Number(claim.mentions) || 1);
    const channels = Math.max(1, (claim.channels || []).length);
    const ageHours = Math.max(0, (now.getTime() - new Date(claim.date).getTime()) / 3600000);
    const recency = ageHours <= 24 ? 1 : ageHours <= 72 ? 0.72 : ageHours <= 168 ? 0.42 : 0.15;
    const volume = Math.min(1, Math.log10(mentions + 1) / 2.3);
    const diversity = Math.min(1, channels / 5);
    const pending = claim.status === 'needs-review' ? 1 : 0.25;
    const burst = !!ctx.burst, amp = !!ctx.amplified;
    const score = Math.round(100 * (0.30 * volume + 0.25 * recency + 0.25 * diversity + 0.20 * pending + (burst ? 0.08 : 0) + (amp ? 0.06 : 0)) / 1.14);
    return {
      score, level: score >= 70 ? 'Tinggi' : score >= 45 ? 'Sedang' : 'Rendah',
      volumeScore: Math.round(volume * 100), recencyScore: Math.round(recency * 100), diversityScore: Math.round(diversity * 100), reviewScore: Math.round(pending * 100),
      burstBonus: burst ? 8 : 0, ampBonus: amp ? 6 : 0, ageHours: Math.round(ageHours)
    };
  }

  /* ======================= Analisis lengkap per klaim + korpus ======================= */
  function analyzeText(text) {
    const senti = sentiment(text), topic = detectTopic(text), epi = epistemic(text), locs = extractLocations(text);
    return { sentiment: senti, topic, epistemic: epi, locations: locs };
  }

  function findAmplification(claims, clusterIndex, vecs, opts = {}) {
    const o = { windowMinutes: 180, minSources: 3, minChannelsLegacy: 3, nearCopy: 0.8, minPairSim: 0.34, ...opts };
    const signals = [];
    clusterIndex.forEach((cl, cid) => {
      if (cl.members.length < 2) return;
      const members = cl.members.map(i => ({ i, c: claims[i] })).sort((a, b) => new Date(a.c.date) - new Date(b.c.date));
      // ambil jendela waktu terpadat
      let best = [];
      for (let s = 0; s < members.length; s++) {
        const win = members.filter(m => { const d = (new Date(m.c.date) - new Date(members[s].c.date)) / 60000; return d >= 0 && d <= o.windowMinutes; });
        if (win.length > best.length) best = win;
      }
      if (best.length < 2) return;
      const sources = [...new Set(best.map(m => m.c.source).filter(Boolean))];
      const channels = [...new Set(best.flatMap(m => m.c.channels || []))];
      if (!(sources.length >= o.minSources || (sources.length >= 2 && channels.length >= o.minChannelsLegacy))) return;
      const pairs = []; let sum = 0, near = 0, np = 0;
      for (let a = 0; a < best.length; a++) for (let b = a + 1; b < best.length; b++) {
        if (best[a].c.source === best[b].c.source) continue;
        const s = cosine(vecs[best[a].i], vecs[best[b].i]); pairs.push({ a: best[a].c.id, b: best[b].c.id, similarity: Math.round(s * 100) / 100 });
        sum += s; np++; if (s >= o.nearCopy) near++;
      }
      if (!np) return; const meanSim = sum / np; if (meanSim < o.minPairSim) return;
      const span = (new Date(best[best.length - 1].c.date) - new Date(best[0].c.date)) / 60000;
      const compact = clamp(1 - span / o.windowMinutes), nearRatio = near / np;
      const index = Math.round(100 * (0.35 * clamp((sources.length - 1) / 4) + 0.25 * compact + 0.25 * meanSim + 0.15 * nearRatio));
      signals.push({
        id: 'AMP-' + hash53(best.map(m => m.c.id).sort().join('|')).slice(0, 8), clusterId: cid, topic: best[0].c.topicEff || best[0].c.topic, index,
        claims: best.map(m => m.c), claimIds: best.map(m => m.c.id), sources, channels, spanMinutes: Math.round(span), meanSimilarity: Math.round(meanSim * 100) / 100,
        nearCopyRatio: Math.round(nearRatio * 100) / 100, pairs: pairs.sort((x, y) => y.similarity - x.similarity).slice(0, 6),
        earliest: { id: best[0].c.id, source: best[0].c.source, date: best[0].c.date },
        caveat: nearRatio >= 0.6 ? 'Kemiripan redaksi sangat tinggi — dapat berasal dari kantor berita, siaran pers, atau sumber primer bersama yang sah. Periksa sumber asal sebelum menyimpulkan apa pun.' : 'Kemiripan dan kedekatan waktu bukan bukti koordinasi, bot, atau niat manipulatif.'
      });
    });
    return signals.sort((a, b) => b.index - a.index);
  }

  /** Snapshot analisis seluruh korpus: klaim + analisis, klaster, lonjakan, amplifikasi. */
  function analyzeCorpus(rawClaims, opts = {}) {
    const now = opts.now ? new Date(opts.now).getTime() : Date.now();
    const claims = rawClaims.map(c => (c.title !== undefined && c.status ? c : normalizeClaim(c)));
    const nlps = claims.map(c => analyzeText(claimText(c)));
    claims.forEach((c, i) => { c.topicEff = c.topic || nlps[i].topic.topic; });
    const { clusters, vecs } = clusterClaims(claims, opts.cluster || {});
    const clusterOf = new Array(claims.length).fill(-1);
    const corpusIndex = new Map(claims.map((c, i) => [c.id, i]));
    const clusterInfo = clusters.map((cl, cid) => {
      cl.members.forEach(i => { clusterOf[i] = cid; });
      const members = cl.members.map(i => claims[i]);
      const series = new Array(12).fill(0);
      members.forEach(c => {
        if (c.hourlyCounts && c.hourlyCounts.length >= 4) { const hc = c.hourlyCounts.slice(-12); hc.forEach((v, k) => { series[12 - hc.length + k] += v; }); }
        else bucketHourly([c.date], now).forEach((v, k) => { series[k] += v * Math.max(1, c.mentions > 50 ? 1 : 1); });
      });
      const rep = cl.members.map(i => ({ i, s: cosine(vecs[i], cl.centroid) })).sort((a, b) => b.s - a.s)[0].i;
      const burst = detectBurst(series);
      const topics = {}; members.forEach(c => { const t = c.topicEff || 'Informasi umum'; topics[t] = (topics[t] || 0) + 1; });
      const topic = Object.entries(topics).sort((a, b) => b[1] - a[1])[0][0];
      return {
        id: 'K' + String(cid + 1).padStart(3, '0'), stableId: 'C-' + hash53(members.map(c => c.id).sort((a, b) => (claims[corpusIndex.get(a)].date < claims[corpusIndex.get(b)].date ? -1 : 1))[0]).slice(0, 8), index: cid, size: members.length, mentions: members.reduce((a, c) => a + c.mentions, 0), topic,
        keywords: topTerms(cl.centroid, 5), label: topTerms(cl.centroid, 3).join(' · ') || claims[rep].title.slice(0, 40), representativeId: claims[rep].id,
        memberIds: members.map(c => c.id), sources: [...new Set(members.map(c => c.source))], series, burst,
        firstSeen: members.map(c => c.date).sort()[0], lastSeen: members.map(c => c.date).sort().slice(-1)[0], cohesion: Math.round((cl.members.length > 1 ? cl.members.reduce((a, i) => a + cosine(vecs[i], cl.centroid), 0) / cl.members.length : 1) * 100) / 100
      };
    });
    const signals = findAmplification(claims, clusters, vecs, opts.amplification || {});
    const amplifiedIds = new Set(signals.flatMap(s => s.claimIds));
    const analyses = claims.map((c, i) => {
      const nlp = nlps[i];
      const ci = clusterInfo[clusterOf[i]];
      const claimBurst = c.hourlyCounts && c.hourlyCounts.length >= 4 ? detectBurst(c.hourlyCounts.slice(-12)) : (ci ? ci.burst : { burst: false });
      const legacy = isBurstLegacy(c.hourlyCounts);
      const urg = urgency(c, { now, burst: claimBurst.burst || legacy, amplified: amplifiedIds.has(c.id) });
      const topic = c.topic ? { topic: c.topic, confidence: 1, terms: nlp.topic.terms, source: 'ditetapkan', suggested: nlp.topic.topic, suggestedConfidence: nlp.topic.confidence } : { ...nlp.topic, source: 'otomatis' };
      const confidence = Math.round(((topic.confidence + nlp.sentiment.confidence + nlp.epistemic.confidence) / 3) * 100) / 100;
      return {
        id: c.id, clusterId: ci ? ci.id : null, urgency: urg, burst: { ...claimBurst, legacy }, amplified: amplifiedIds.has(c.id), topic, sentiment: nlp.sentiment, epistemic: nlp.epistemic,
        epistemicDisplay: epistemicDisplay(nlp.epistemic, c.status, (c.evidenceCount || 0) > 0), locations: nlp.locations, confidence,
        evidence: { topicTerms: nlp.topic.terms, sentimentTerms: nlp.sentiment.terms.slice(0, 6), epistemicCues: nlp.epistemic.cues.slice(0, 6) }
      };
    });
    const similar = (idx, k = 4, min = 0.24) => claims.map((c, j) => ({ j, s: j === idx ? 0 : cosine(vecs[idx], vecs[j]) })).filter(x => x.s >= min).sort((a, b) => b.s - a.s).slice(0, k).map(x => ({ id: claims[x.j].id, title: claims[x.j].title, similarity: Math.round(x.s * 100) / 100 }));
    return { claims, analyses, clusters: clusterInfo, amplification: signals, now, similar, byId: new Map(claims.map((c, i) => [c.id, i])) };
  }

  /* ======================= Kredibilitas sumber (Bayesian shrinkage, transparan) ======================= */
  const TIER_PRIOR = { A: 0.9, B: 0.75, C: 0.55, D: 0.4 };
  const TIER_LABEL = { A: 'A — Sumber primer/resmi', B: 'B — Media terverifikasi/berdewan redaksi', C: 'C — Agregator/komunitas', D: 'D — Belum dinilai' };
  function sourceCredibility(tier, outcomes = {}) {
    const k = 8, prior = TIER_PRIOR[tier] ?? TIER_PRIOR.D;
    const good = outcomes.verified || 0, bad = (outcomes.false || 0) + (outcomes.misleading || 0), n = good + bad;
    const p = (prior * k + good) / (k + n); const sd = Math.sqrt(p * (1 - p) / (k + n + 1));
    return { score: Math.round(p * 100), low: Math.round(clamp(p - 1.64 * sd) * 100), high: Math.round(clamp(p + 1.64 * sd) * 100), prior: Math.round(prior * 100), reviewedItems: n, verified: good, falseOrMisleading: bad, context: outcomes.context || 0, tier,
      note: n < 5 ? 'Data hasil verifikasi sedikit — skor didominasi penilaian tier awal.' : 'Skor menggabungkan tier awal dengan hasil verifikasi item; bukan penilaian atas seluruh isi sumber.' };
  }

  G.nlp = {
    hash53, clamp, maskPII, normalize, tokenize, stem, TfIdf, cosine, textSimilarity, jaccard, sentiment, detectTopic, epistemic, epistemicDisplay, extractLocations,
    normalizeClaim, STATUS, EPI_LABEL, detectBurst, isBurstLegacy, bucketHourly, clusterClaims, urgency, analyzeText, analyzeCorpus, findAmplification,
    sourceCredibility, TIER_LABEL, claimText, topTerms
  };
})(typeof window !== 'undefined' ? (window.GARDA = window.GARDA || {}) : (globalThis.GARDA = globalThis.GARDA || {}));
