/* GARDA NARASI — evaluasi model: confusion matrix, precision, recall, F1, pencarian ambang. */
(function (G) {
  'use strict';
  const r4 = x => Math.round(x * 10000) / 10000;

  function confusionMatrix(yTrue, yPred, labels) {
    const idx = new Map(labels.map((l, i) => [l, i]));
    const m = labels.map(() => labels.map(() => 0));
    yTrue.forEach((t, i) => { const a = idx.get(t), b = idx.get(yPred[i]); if (a !== undefined && b !== undefined) m[a][b]++; });
    return m;
  }
  function metricsFromMatrix(m, labels) {
    const n = labels.length; let total = 0, correct = 0;
    const perClass = labels.map((label, i) => {
      const tp = m[i][i]; let fp = 0, fn = 0;
      for (let k = 0; k < n; k++) { if (k !== i) { fp += m[k][i]; fn += m[i][k]; } }
      const support = tp + fn; total += support; correct += tp;
      const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
      const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
      return { label, precision: r4(precision), recall: r4(recall), f1: r4(f1), support };
    });
    const present = perClass.filter(c => c.support > 0);
    const macroF1 = present.reduce((a, c) => a + c.f1, 0) / Math.max(1, present.length);
    const weightedF1 = perClass.reduce((a, c) => a + c.f1 * c.support, 0) / Math.max(1, total);
    return { accuracy: r4(total ? correct / total : 0), macroPrecision: r4(present.reduce((a, c) => a + c.precision, 0) / Math.max(1, present.length)), macroRecall: r4(present.reduce((a, c) => a + c.recall, 0) / Math.max(1, present.length)), macroF1: r4(macroF1), weightedF1: r4(weightedF1), perClass, total };
  }
  function evaluateClassifier(items, predict, baseLabels) {
    const yTrue = items.map(i => i.label), yPred = items.map(i => predict(i));
    // label prediksi di luar daftar kelas (mis. "Informasi umum") TIDAK boleh dibuang diam-diam: dihitung sebagai kolom tambahan = salah.
    const extras = [...new Set(yPred.filter(p => !baseLabels.includes(p)))].sort(); const labels = [...baseLabels, ...extras];
    const matrix = confusionMatrix(yTrue, yPred, labels);
    const errors = items.map((it, i) => ({ id: it.id, text: it.text, expected: yTrue[i], predicted: yPred[i] })).filter(e => e.expected !== e.predicted);
    return { labels, matrix, ...metricsFromMatrix(matrix, labels), errors };
  }
  /** Tugas pasangan (near-duplicate/narasi sama): label 1 = mengacu narasi yang sama. */
  function binaryAt(scores, truth, th) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    scores.forEach((s, i) => { const p = s >= th ? 1 : 0; if (p && truth[i]) tp++; else if (p && !truth[i]) fp++; else if (!p && truth[i]) fn++; else tn++; });
    const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0, f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
    return { threshold: th, tp, fp, fn, tn, precision: r4(precision), recall: r4(recall), f1: r4(f1), accuracy: r4((tp + tn) / scores.length) };
  }
  // Seri F1 sama → ambil ambang tertinggi (lebih konservatif, menekan false positive).
  function bestThreshold(scores, truth) {
    let best = null; for (let th = 0.05; th <= 0.95; th += 0.01) { const m = binaryAt(scores, truth, th); if (!best || m.f1 >= best.f1) best = m; }
    return best;
  }
  G.evaluate = { confusionMatrix, metricsFromMatrix, evaluateClassifier, binaryAt, bestThreshold };
})(typeof window !== 'undefined' ? (window.GARDA = window.GARDA || {}) : (globalThis.GARDA = globalThis.GARDA || {}));
