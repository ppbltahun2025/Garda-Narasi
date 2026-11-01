'use strict';
/* Lapisan penyimpanan SQLite (node:sqlite bawaan Node ≥ 22.5; tanpa dependensi native). */
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs'); const path = require('node:path');
const G = require('../engine/index.js'); const N = G.nlp;

const SCHEMA = `
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS claims(
  id TEXT PRIMARY KEY, origin TEXT NOT NULL DEFAULT 'manual', title TEXT NOT NULL, claim TEXT NOT NULL DEFAULT '', topic TEXT DEFAULT '', region TEXT DEFAULT 'Tidak disebutkan',
  region_code TEXT DEFAULT '', region_status TEXT DEFAULT 'unverified', source TEXT DEFAULT '', source_id TEXT, source_url TEXT DEFAULT '', url_hash TEXT, content_hash TEXT,
  channels TEXT DEFAULT '[]', mentions INTEGER DEFAULT 1, status TEXT DEFAULT 'needs-review', verification_note TEXT DEFAULT '', evidence_url TEXT DEFAULT '',
  hourly_counts TEXT DEFAULT '[]', is_synthetic INTEGER DEFAULT 0, first_seen TEXT, date TEXT NOT NULL, collected_at TEXT, updated_at TEXT, analysis TEXT, cluster_id TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_url ON claims(url_hash) WHERE url_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_claims_date ON claims(date); CREATE INDEX IF NOT EXISTS ix_claims_content ON claims(content_hash); CREATE INDEX IF NOT EXISTS ix_claims_source ON claims(source_id);
CREATE TABLE IF NOT EXISTS evidence(id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE, kind TEXT NOT NULL, stance TEXT NOT NULL DEFAULT 'context',
  url TEXT NOT NULL, title TEXT DEFAULT '', note TEXT DEFAULT '', added_by TEXT DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE, reviewer TEXT NOT NULL, role TEXT DEFAULT 'analis',
  status TEXT NOT NULL, note TEXT DEFAULT '', stage TEXT NOT NULL DEFAULT 'applied', confirmed_by TEXT DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, url TEXT NOT NULL, category TEXT DEFAULT '', tier TEXT DEFAULT 'D', tier_note TEXT DEFAULT '',
  interval_min INTEGER DEFAULT 60, enabled INTEGER DEFAULT 0, tos_ack INTEGER DEFAULT 0, tos_ack_by TEXT DEFAULT '', region_hint TEXT DEFAULT '', lang TEXT DEFAULT 'id', notes TEXT DEFAULT '',
  mapping TEXT DEFAULT '', etag TEXT DEFAULT '', last_modified TEXT DEFAULT '', last_run_at TEXT, last_status TEXT DEFAULT '', last_error TEXT DEFAULT '', robots_allowed INTEGER, robots_note TEXT DEFAULT '', created_at TEXT);
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, status TEXT DEFAULT 'running', trigger TEXT DEFAULT 'scheduler',
  http_status INTEGER, fetched INTEGER DEFAULT 0, cleaned INTEGER DEFAULT 0, dropped INTEGER DEFAULT 0, duplicates INTEGER DEFAULT 0, inserted INTEGER DEFAULT 0, alerts INTEGER DEFAULT 0, message TEXT DEFAULT '', stages TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY AUTOINCREMENT, dedupe_key TEXT UNIQUE, created_at TEXT NOT NULL, level TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT DEFAULT '{}',
  claim_id TEXT, cluster_key TEXT, acknowledged INTEGER DEFAULT 0, ack_by TEXT DEFAULT '', ack_at TEXT, notified INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor TEXT DEFAULT 'sistem', action TEXT NOT NULL, entity TEXT DEFAULT '', entity_id TEXT DEFAULT '', detail TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS eval_runs(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, report TEXT NOT NULL);
`;
const j = (v, d) => { try { return JSON.parse(v); } catch { return d; } };
const now = () => new Date().toISOString();

class Store {
  constructor(file = ':memory:') {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file); this.db.exec(SCHEMA); this.version = 0;
  }
  bump() { this.version++; }
  tx(fn) { this.db.exec('BEGIN'); try { const r = fn(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  q(sql, ...a) { return this.db.prepare(sql).all(...a); }
  one(sql, ...a) { return this.db.prepare(sql).get(...a); }
  run(sql, ...a) { return this.db.prepare(sql).run(...a); }

  /* ---------- claims ---------- */
  rowToClaim(r) {
    if (!r) return null;
    const ev = this.one('SELECT COUNT(*) n FROM evidence WHERE claim_id=?', r.id).n;
    const c = N.normalizeClaim({
      id: r.id, origin: r.origin, title: r.title, claim: r.claim, topic: r.topic, region: r.region, regionCode: r.region_code, regionStatus: r.region_status, source: r.source, sourceId: r.source_id,
      sourceUrl: r.source_url, channels: j(r.channels, []), mentions: r.mentions, status: r.status, verificationNote: r.verification_note, evidenceUrl: r.evidence_url, evidenceCount: ev + (r.evidence_url ? 1 : 0),
      hourlyCounts: j(r.hourly_counts, []), isSynthetic: !!r.is_synthetic, firstSeen: r.first_seen, date: r.date, collectedAt: r.collected_at, updatedAt: r.updated_at
    });
    c.clusterId = r.cluster_id || null; return c;
  }
  upsertClaim(c, { ignoreIfExists = false } = {}) {
    const exists = this.one('SELECT id FROM claims WHERE id=?', c.id);
    if (exists && ignoreIfExists) return false;
    const vals = [c.id, c.origin, c.title, c.claim, c.topic || '', c.region, c.regionCode || '', c.regionStatus || 'unverified', c.source, c.sourceId || null, c.sourceUrl || '', c.urlHash || null, c.contentHash || null,
      JSON.stringify(c.channels || []), c.mentions, c.status, c.verificationNote || '', c.evidenceUrl || '', JSON.stringify(c.hourlyCounts || []), c.isSynthetic ? 1 : 0, c.firstSeen, c.date, c.collectedAt || null, c.updatedAt || now()];
    if (exists) this.run(`UPDATE claims SET origin=?,title=?,claim=?,topic=?,region=?,region_code=?,region_status=?,source=?,source_id=?,source_url=?,url_hash=?,content_hash=?,channels=?,mentions=?,status=?,verification_note=?,evidence_url=?,hourly_counts=?,is_synthetic=?,first_seen=?,date=?,collected_at=?,updated_at=? WHERE id=?`, ...vals.slice(1), c.id);
    else this.run(`INSERT INTO claims(id,origin,title,claim,topic,region,region_code,region_status,source,source_id,source_url,url_hash,content_hash,channels,mentions,status,verification_note,evidence_url,hourly_counts,is_synthetic,first_seen,date,collected_at,updated_at) VALUES(${vals.map(() => '?').join(',')})`, ...vals);
    this.bump(); return true;
  }
  getClaim(id) { return this.rowToClaim(this.one('SELECT * FROM claims WHERE id=?', id)); }
  listClaims({ limit = 5000, since = null, origin = null } = {}) {
    let sql = 'SELECT * FROM claims'; const args = [], w = [];
    if (since) { w.push('date >= ?'); args.push(since); } if (origin) { w.push('origin = ?'); args.push(origin); }
    if (w.length) sql += ' WHERE ' + w.join(' AND ');
    sql += ' ORDER BY date DESC LIMIT ?'; args.push(limit);
    return this.q(sql, ...args).map(r => this.rowToClaim(r));
  }
  countClaims() { return this.one('SELECT COUNT(*) n FROM claims').n; }
  findByUrlHash(h) { return this.one('SELECT id FROM claims WHERE url_hash=?', h); }
  findByContentHash(h, sinceIso) { return this.one('SELECT id FROM claims WHERE content_hash=? AND date>=?', h, sinceIso); }
  deleteClaims(origins) { const ph = origins.map(() => '?').join(','); this.run(`DELETE FROM claims WHERE origin IN (${ph})`, ...origins); this.bump(); }
  saveAnalysis(id, clusterId, analysis) { this.run('UPDATE claims SET cluster_id=?, analysis=? WHERE id=?', clusterId, JSON.stringify(analysis), id); }
  setStatus(id, status, note, evidenceUrl) { this.run('UPDATE claims SET status=?, verification_note=?, evidence_url=COALESCE(?,evidence_url), updated_at=? WHERE id=?', status, note, evidenceUrl ?? null, now(), id); this.bump(); }
  setRegion(id, region, code, status) { this.run('UPDATE claims SET region=?, region_code=?, region_status=?, updated_at=? WHERE id=?', region, code, status, now(), id); this.bump(); }

  /* ---------- evidence & reviews ---------- */
  addEvidence(e) { const r = this.run('INSERT INTO evidence(claim_id,kind,stance,url,title,note,added_by,created_at) VALUES(?,?,?,?,?,?,?,?)', e.claimId, e.kind, e.stance, e.url, e.title || '', e.note || '', e.addedBy || '', now()); this.bump(); return Number(r.lastInsertRowid); }
  listEvidence(claimId) { return this.q('SELECT * FROM evidence WHERE claim_id=? ORDER BY id', claimId); }
  deleteEvidence(id) { this.run('DELETE FROM evidence WHERE id=?', id); this.bump(); }
  addReview(r) { const x = this.run('INSERT INTO reviews(claim_id,reviewer,role,status,note,stage,confirmed_by,created_at) VALUES(?,?,?,?,?,?,?,?)', r.claimId, r.reviewer, r.role || 'analis', r.status, r.note || '', r.stage, r.confirmedBy || '', now()); return Number(x.lastInsertRowid); }
  listReviews(claimId) { return this.q('SELECT * FROM reviews WHERE claim_id=? ORDER BY id DESC', claimId); }
  pendingProposal(claimId, status) { return this.one("SELECT * FROM reviews WHERE claim_id=? AND status=? AND stage='proposed' ORDER BY id DESC LIMIT 1", claimId, status); }
  setReviewStage(id, stage, confirmedBy) { this.run('UPDATE reviews SET stage=?, confirmed_by=? WHERE id=?', stage, confirmedBy || '', id); }
  proposals() { return this.q("SELECT r.*, c.title FROM reviews r JOIN claims c ON c.id=r.claim_id WHERE r.stage='proposed' ORDER BY r.id DESC"); }

  /* ---------- sources & runs ---------- */
  rowToSource(r) { return r && { id: r.id, name: r.name, type: r.type, url: r.url, category: r.category, tier: r.tier, tierNote: r.tier_note, intervalMin: r.interval_min, enabled: !!r.enabled, tosAck: !!r.tos_ack, tosAckBy: r.tos_ack_by, regionHint: r.region_hint, lang: r.lang, notes: r.notes, mapping: j(r.mapping, null), etag: r.etag, lastModified: r.last_modified, lastRunAt: r.last_run_at, lastStatus: r.last_status, lastError: r.last_error, robotsAllowed: r.robots_allowed === null ? null : !!r.robots_allowed, robotsNote: r.robots_note, createdAt: r.created_at }; }
  listSources() { return this.q('SELECT * FROM sources ORDER BY name').map(r => this.rowToSource(r)); }
  getSource(id) { return this.rowToSource(this.one('SELECT * FROM sources WHERE id=?', id)); }
  upsertSource(s) {
    const ex = this.one('SELECT id FROM sources WHERE id=?', s.id);
    const v = [s.name, s.type, s.url, s.category || '', s.tier || 'D', s.tierNote || '', s.intervalMin || 60, s.enabled ? 1 : 0, s.tosAck ? 1 : 0, s.tosAckBy || '', s.regionHint || '', s.lang || 'id', s.notes || '', s.mapping ? JSON.stringify(s.mapping) : ''];
    if (ex) this.run('UPDATE sources SET name=?,type=?,url=?,category=?,tier=?,tier_note=?,interval_min=?,enabled=?,tos_ack=?,tos_ack_by=?,region_hint=?,lang=?,notes=?,mapping=? WHERE id=?', ...v, s.id);
    else this.run('INSERT INTO sources(name,type,url,category,tier,tier_note,interval_min,enabled,tos_ack,tos_ack_by,region_hint,lang,notes,mapping,id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...v, s.id, now());
    this.bump();
  }
  patchSource(id, fields) { const map = { etag: 'etag', lastModified: 'last_modified', lastRunAt: 'last_run_at', lastStatus: 'last_status', lastError: 'last_error', robotsAllowed: 'robots_allowed', robotsNote: 'robots_note' }; Object.entries(fields).forEach(([k, v]) => { if (map[k]) this.run(`UPDATE sources SET ${map[k]}=? WHERE id=?`, typeof v === 'boolean' ? (v ? 1 : 0) : v, id); }); }
  deleteSource(id) { this.run('DELETE FROM sources WHERE id=?', id); this.bump(); }
  startRun(sourceId, trigger) { return Number(this.run('INSERT INTO runs(source_id,started_at,trigger) VALUES(?,?,?)', sourceId, now(), trigger).lastInsertRowid); }
  finishRun(id, f) { this.run('UPDATE runs SET finished_at=?,status=?,http_status=?,fetched=?,cleaned=?,dropped=?,duplicates=?,inserted=?,alerts=?,message=?,stages=? WHERE id=?', now(), f.status, f.httpStatus ?? null, f.fetched || 0, f.cleaned || 0, f.dropped || 0, f.duplicates || 0, f.inserted || 0, f.alerts || 0, f.message || '', JSON.stringify(f.stages || {}), id); }
  listRuns(limit = 50, sourceId = null) { const rows = sourceId ? this.q('SELECT r.*, s.name source_name FROM runs r LEFT JOIN sources s ON s.id=r.source_id WHERE source_id=? ORDER BY r.id DESC LIMIT ?', sourceId, limit) : this.q('SELECT r.*, s.name source_name FROM runs r LEFT JOIN sources s ON s.id=r.source_id ORDER BY r.id DESC LIMIT ?', limit); return rows.map(r => ({ ...r, stages: j(r.stages, {}) })); }

  /* ---------- alerts, audit, settings ---------- */
  createAlert(a) { try { const r = this.run('INSERT INTO alerts(dedupe_key,created_at,level,kind,title,detail,claim_id,cluster_key) VALUES(?,?,?,?,?,?,?,?)', a.key, now(), a.level, a.kind, a.title, JSON.stringify(a.detail || {}), a.claimId || null, a.clusterKey || null); return Number(r.lastInsertRowid); } catch (e) { if (/UNIQUE/i.test(e.message)) return null; throw e; } }
  rowToAlert(r) { return { ...r, detail: j(r.detail, {}), acknowledged: !!r.acknowledged }; }
  getAlert(id) { const r = this.one('SELECT * FROM alerts WHERE id=?', id); return r && this.rowToAlert(r); }
  listAlerts({ limit = 100, open = false } = {}) { return this.q(`SELECT * FROM alerts ${open ? 'WHERE acknowledged=0' : ''} ORDER BY id DESC LIMIT ?`, limit).map(r => this.rowToAlert(r)); }
  ackAlert(id, by) { this.run('UPDATE alerts SET acknowledged=1, ack_by=?, ack_at=? WHERE id=?', by, now(), id); }
  markNotified(id) { this.run('UPDATE alerts SET notified=1 WHERE id=?', id); }
  audit(actor, action, entity = '', entityId = '', detail = '') { this.run('INSERT INTO audit(ts,actor,action,entity,entity_id,detail) VALUES(?,?,?,?,?,?)', now(), actor || 'sistem', action, entity, String(entityId), typeof detail === 'string' ? detail : JSON.stringify(detail)); }
  listAudit(limit = 100) { return this.q('SELECT * FROM audit ORDER BY id DESC LIMIT ?', limit); }
  getSetting(k, d = null) { const r = this.one('SELECT value FROM settings WHERE key=?', k); return r ? j(r.value, d) : d; }
  setSetting(k, v) { this.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, JSON.stringify(v)); }
  saveEval(report) { this.run('INSERT INTO eval_runs(ts,report) VALUES(?,?)', now(), JSON.stringify(report)); }
  lastEval() { const r = this.one('SELECT * FROM eval_runs ORDER BY id DESC LIMIT 1'); return r ? { ts: r.ts, report: j(r.report, null) } : null; }
  close() { this.db.close(); }
}
module.exports = { Store, now };
