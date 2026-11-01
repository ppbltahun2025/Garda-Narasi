'use strict';
/* Human Verification Workspace: keputusan hanya dari manusia, wajib alasan + bukti, prinsip empat-mata untuk vonis negatif. */
const VALID = ['needs-review', 'verified', 'false', 'misleading', 'context-needed'];
const NEEDS_EVIDENCE = ['verified', 'false', 'misleading']; const NEGATIVE = ['false', 'misleading'];
const STANCES = ['supports', 'contradicts', 'context']; const KINDS = ['primary', 'official', 'media', 'expert', 'other'];

function safeUrl(u) { try { const x = new URL(String(u)); return ['http:', 'https:'].includes(x.protocol) ? x.href.slice(0, 500) : ''; } catch { return ''; } }
function submitReview(store, cfg, claimId, input) {
  const claim = store.getClaim(claimId); if (!claim) return { error: 'Klaim tidak ditemukan.', code: 404 };
  const reviewer = String(input.reviewer || '').trim().slice(0, 60); const role = String(input.role || 'analis').slice(0, 30);
  const status = input.status, note = String(input.note || '').trim().slice(0, 2000);
  if (reviewer.length < 2) return { error: 'Nama pemeriksa wajib diisi (minimal 2 karakter).', code: 400 };
  if (!VALID.includes(status)) return { error: 'Status tidak valid.', code: 400 };
  if (status !== 'needs-review' && note.length < 20) return { error: 'Alasan keputusan wajib diisi (minimal 20 karakter).', code: 400 };
  const evidence = store.listEvidence(claimId);
  if (NEEDS_EVIDENCE.includes(status)) {
    const relevant = status === 'verified' ? evidence.filter(e => e.stance === 'supports') : evidence.filter(e => e.stance === 'contradicts' || e.stance === 'context');
    if (!relevant.length && !(claim.evidenceUrl && status !== 'verified')) return { error: status === 'verified' ? 'Status "Terverifikasi" memerlukan minimal satu bukti berstance "mendukung".' : 'Vonis negatif memerlukan minimal satu bukti berstance "menyangkal/konteks".', code: 422 };
  }
  if (NEGATIVE.includes(status) && cfg.fourEyes) {
    const pending = store.pendingProposal(claimId, status);
    if (pending && pending.reviewer.toLowerCase() !== reviewer.toLowerCase()) {
      store.setReviewStage(pending.id, 'applied', reviewer);
      store.addReview({ claimId, reviewer, role, status, note, stage: 'applied', confirmedBy: pending.reviewer });
      store.setStatus(claimId, status, note); store.audit(reviewer, 'review.confirm', 'claim', claimId, { status, proposedBy: pending.reviewer });
      return { applied: true, status, message: `Vonis dikonfirmasi oleh pemeriksa kedua (${reviewer}).` };
    }
    if (pending) return { error: 'Usulan Anda sudah tercatat; menunggu pemeriksa kedua yang berbeda.', code: 409 };
    store.addReview({ claimId, reviewer, role, status, note, stage: 'proposed' }); store.audit(reviewer, 'review.propose', 'claim', claimId, { status });
    return { applied: false, pendingSecondReview: true, status: claim.status, message: 'Usulan vonis negatif tersimpan. Status publik berubah setelah pemeriksa kedua mengonfirmasi.' };
  }
  store.addReview({ claimId, reviewer, role, status, note, stage: 'applied' }); store.setStatus(claimId, status, note);
  store.audit(reviewer, 'review.apply', 'claim', claimId, { from: claim.status, to: status }); return { applied: true, status, message: 'Hasil pemeriksaan tersimpan.' };
}
function addEvidence(store, claimId, input) {
  if (!store.getClaim(claimId)) return { error: 'Klaim tidak ditemukan.', code: 404 };
  const url = safeUrl(input.url); if (!url) return { error: 'URL bukti harus http/https yang valid.', code: 400 };
  const stance = STANCES.includes(input.stance) ? input.stance : 'context', kind = KINDS.includes(input.kind) ? input.kind : 'other';
  const id = store.addEvidence({ claimId, kind, stance, url, title: String(input.title || '').slice(0, 200), note: String(input.note || '').slice(0, 1000), addedBy: String(input.addedBy || '').slice(0, 60) });
  store.audit(input.addedBy, 'evidence.add', 'claim', claimId, { id, stance, kind }); return { id };
}
function setRegion(store, claimId, input) {
  const G = require('../engine/index.js'); const p = G.lexicon.PROVINCES.find(x => x.code === input.code);
  if (!p && input.status !== 'unverified') return { error: 'Kode provinsi tidak dikenal.', code: 400 };
  const status = ['unverified', 'candidate', 'verified'].includes(input.status) ? input.status : 'verified';
  store.setRegion(claimId, p ? p.name : 'Tidak disebutkan', p ? p.code : '', status); store.audit(input.reviewer, 'region.set', 'claim', claimId, { code: input.code, status }); return { ok: true };
}
module.exports = { submitReview, addEvidence, setRegion, safeUrl, VALID };
