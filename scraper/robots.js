'use strict';
/* Parser & evaluator robots.txt (RFC 9309) — longest-match, wildcard * dan $, Crawl-delay. */
function parseRobots(text = '') {
  const groups = []; let cur = null, lastWasAgent = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase(), val = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [], crawlDelay: null }; groups.push(cur); }
      cur.agents.push(val.toLowerCase()); lastWasAgent = true;
    } else if (cur && (key === 'allow' || key === 'disallow')) { cur.rules.push({ allow: key === 'allow', path: val }); lastWasAgent = false; }
    else if (cur && key === 'crawl-delay') { const n = Number(val); if (Number.isFinite(n) && n >= 0) cur.crawlDelay = n; lastWasAgent = false; }
    else lastWasAgent = false;
  }
  return groups;
}
function patternToRegex(p) {
  const anchored = p.endsWith('$'); const body = anchored ? p.slice(0, -1) : p;
  return new RegExp('^' + body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + (anchored ? '$' : ''));
}
function pickGroup(groups, uaToken) {
  const ua = uaToken.toLowerCase(); let best = null, bestLen = -1;
  for (const g of groups) for (const a of g.agents) if (a !== '*' && ua.includes(a) && a.length > bestLen) { best = g; bestLen = a.length; }
  return best || groups.find(g => g.agents.includes('*')) || null;
}
function evaluate(groups, uaToken, pathWithQuery) {
  const g = pickGroup(groups, uaToken); if (!g) return { allowed: true, crawlDelay: null, matched: null };
  let best = null;
  for (const r of g.rules) {
    if (r.path === '') continue; // "Disallow:" kosong = boleh semua
    if (patternToRegex(r.path).test(pathWithQuery)) { if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r; }
  }
  return { allowed: best ? best.allow : true, crawlDelay: g.crawlDelay, matched: best ? (best.allow ? 'Allow: ' : 'Disallow: ') + best.path : null };
}
module.exports = { parseRobots, evaluate };
