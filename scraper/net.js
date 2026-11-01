'use strict';
/* Pengambilan HTTP yang sopan: robots.txt, rate limit per host, batas ukuran/waktu, proteksi SSRF, conditional GET. */
const dns = require('node:dns').promises; const net = require('node:net');
const { parseRobots, evaluate } = require('./robots.js');

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127); }
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l.startsWith('::ffff:10.') || l.startsWith('::ffff:192.168.'); }
  return true;
}
async function assertPublicHost(hostname, allowPrivate) {
  if (allowPrivate) return;
  if (net.isIP(hostname)) { if (isPrivateIp(hostname)) throw new Error('Host privat/loopback diblokir (SSRF).'); return; }
  const addrs = await dns.lookup(hostname, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('Host mengarah ke alamat privat/loopback — diblokir (SSRF).');
}
class HostLimiter {
  constructor(minDelayMs = 2000) { this.minDelayMs = minDelayMs; this.next = new Map(); }
  async wait(host, crawlDelaySec = 0) {
    const gap = Math.max(this.minDelayMs, (crawlDelaySec || 0) * 1000); const now = Date.now();
    const at = Math.max(now, this.next.get(host) || 0); this.next.set(host, at + gap);
    if (at > now) await new Promise(r => setTimeout(r, at - now));
  }
}
class RobotsCache {
  constructor(ttlMs = 3600000) { this.ttl = ttlMs; this.map = new Map(); }
  async check(url, { ua, token, fetcher }) {
    const u = new URL(url); const origin = u.origin; let e = this.map.get(origin);
    if (!e || Date.now() - e.at > this.ttl) {
      let policy;
      try {
        const res = await fetcher(origin + '/robots.txt');
        if (res.status === 404 || res.status === 410) policy = { groups: [], note: 'robots.txt tidak ada (404) — diizinkan' };
        else if (res.status >= 200 && res.status < 300) policy = { groups: parseRobots(res.text), note: 'robots.txt dibaca' };
        else if (res.status === 401 || res.status === 403) policy = { deny: true, note: `robots.txt ${res.status} — diperlakukan sebagai larangan` };
        else policy = { deny: true, note: `robots.txt status ${res.status} — ditunda (konservatif)` };
      } catch (err) { policy = { deny: true, note: 'robots.txt tidak dapat diambil: ' + err.message + ' — ditunda (konservatif)' }; }
      e = { at: Date.now(), policy }; this.map.set(origin, e);
    }
    if (e.policy.deny) return { allowed: false, crawlDelay: null, note: e.policy.note };
    const r = evaluate(e.policy.groups, token, u.pathname + u.search);
    return { allowed: r.allowed, crawlDelay: r.crawlDelay, note: r.allowed ? e.policy.note : `Dilarang robots.txt (${r.matched})`, matched: r.matched };
  }
}

async function rawFetch(url, { ua, timeoutMs = 15000, maxBytes = 2 * 1024 * 1024, headers = {}, allowPrivate = false, maxRedirects = 3 } = {}) {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = new URL(current);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Protokol tidak didukung.');
    await assertPublicHost(u.hostname, allowPrivate);
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(current, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': ua, Accept: 'application/rss+xml, application/atom+xml, application/xml, application/json, text/xml, */*;q=0.5', ...headers } });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location'); if (!loc) throw new Error('Redirect tanpa lokasi.');
        const next = new URL(loc, current); if (next.hostname !== u.hostname) throw new Error('Redirect lintas-host ditolak (daftarkan URL tujuan sebagai sumber baru).');
        current = next.href; continue;
      }
      const chunks = []; let size = 0;
      if (res.body) { for await (const chunk of res.body) { size += chunk.length; if (size > maxBytes) { ctrl.abort(); throw new Error('Respons melebihi batas ukuran.'); } chunks.push(chunk); } }
      return { status: res.status, headers: res.headers, text: Buffer.concat(chunks).toString('utf8'), url: current, bytes: size };
    } finally { clearTimeout(timer); }
  }
  throw new Error('Terlalu banyak redirect.');
}
module.exports = { isPrivateIp, assertPublicHost, HostLimiter, RobotsCache, rawFetch };
