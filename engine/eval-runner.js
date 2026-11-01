'use strict';
/* Runner evaluasi (Node). Ambang kemiripan dipilih pada split DEV, lalu dilaporkan pada split TEST. */
const fs = require('node:fs'); const path = require('node:path');
const G = require('./index.js'); const N = G.nlp, E = G.evaluate;

function load(name, dir) { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }

function runClassification(ds, predict) {
  const out = {};
  ['dev', 'test'].forEach(split => { out[split] = E.evaluateClassifier(ds.items.filter(i => i.split === split), predict, ds.labels); });
  out.challenge = E.evaluateClassifier(ds.items.filter(i => i.split === 'challenge'), predict, ds.labels);
  out.all = E.evaluateClassifier(ds.items.filter(i => i.split !== 'challenge'), predict, ds.labels);
  return out;
}

function pairScores(items, fn) { return items.map(p => fn(p.a, p.b)); }
function runPairs(ds) {
  const background = ds.items.flatMap(p => [N.tokenize(p.a, { concepts: true }), N.tokenize(p.b, { concepts: true })]);
  const methods = {
    'Jaccard token (baseline 0.1.1)': (a, b) => N.jaccard(a, b),
    'TF-IDF cosine (unigram)': (a, b) => N.textSimilarity(a, b, { bigrams: false, stem: false, concepts: false, background }),
    'TF-IDF cosine + stemming': (a, b) => N.textSimilarity(a, b, { bigrams: false, stem: true, background: background.slice(0, 0) }),
    'TF-IDF cosine + stemming + bigram': (a, b) => N.textSimilarity(a, b, { bigrams: true, stem: true }),
    'TF-IDF cosine + stemming + konsep (dipakai engine)': (a, b) => N.textSimilarity(a, b, { bigrams: false, stem: true })
  };
  const dev = ds.items.filter(i => i.split === 'dev'), test = ds.items.filter(i => i.split === 'test'), chal = ds.items.filter(i => i.split === 'challenge');
  const report = [];
  for (const [name, fn] of Object.entries(methods)) {
    const sd = pairScores(dev, fn), td = dev.map(i => i.label);
    const best = E.bestThreshold(sd, td);
    const st = pairScores(test, fn), tt = test.map(i => i.label);
    report.push({ method: name, devBest: best, test: E.binaryAt(st, tt, best.threshold), challenge: E.binaryAt(pairScores(chal, fn), chal.map(i => i.label), best.threshold) });
  }
  return report;
}

function runAll(dir = path.join(__dirname, '..', 'data', 'eval')) {
  const sent = load('sentiment.json', dir), topic = load('topic.json', dir), epi = load('epistemic.json', dir), pairs = load('pairs.json', dir);
  return {
    generatedAt: new Date().toISOString(),
    engineVersion: '0.2.0',
    datasetSizes: { sentiment: sent.items.length, topic: topic.items.length, epistemic: epi.items.length, pairs: pairs.items.length },
    protocol: 'Item berlabel dibuat tim pengembang (bukan korpus independen). Split dev (30%) dipakai saat menyusun leksikon/ambang; split test (70%) hanya dilaporkan.',
    sentiment: runClassification(sent, i => N.sentiment(i.text).label),
    topic: runClassification(topic, i => N.detectTopic(i.text).topic),
    epistemic: runClassification(epi, i => N.epistemic(i.text).type),
    pairs: runPairs(pairs)
  };
}
module.exports = { runAll };
if (require.main === module) {
  const r = runAll(); const f = x => (x * 100).toFixed(1) + '%';
  for (const k of ['sentiment', 'topic', 'epistemic']) console.log(k.padEnd(10), 'DEV acc', f(r[k].dev.accuracy), 'macroF1', f(r[k].dev.macroF1), '| TEST acc', f(r[k].test.accuracy), 'macroF1', f(r[k].test.macroF1), '| CHALLENGE acc', f(r[k].challenge.accuracy), 'macroF1', f(r[k].challenge.macroF1));
  r.pairs.forEach(p => console.log(p.method.padEnd(52), 'th', p.devBest.threshold.toFixed(2), 'devF1', f(p.devBest.f1), '| TEST P', f(p.test.precision), 'R', f(p.test.recall), 'F1', f(p.test.f1), '| CHAL F1', f(p.challenge.f1), 'P', f(p.challenge.precision), 'R', f(p.challenge.recall)));
  if (process.argv.includes('--dev-errors')) for (const k of ['sentiment', 'topic', 'epistemic']) { console.log('\n#', k); r[k][process.argv.includes('--challenge') ? 'challenge' : 'dev'].errors.forEach(e => console.log(`  [${e.expected} → ${e.predicted}] ${e.text}`)); }
}
