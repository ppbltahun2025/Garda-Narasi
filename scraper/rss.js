'use strict';
/* Parser RSS 2.0 / Atom / RDF tanpa dependensi. Sengaja TIDAK membaca field penulis/akun (anti-profiling). */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
function decodeEntities(s = '') {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(code); } catch { return ' '; } }
    return ENT[e.toLowerCase()] ?? m;
  });
}
function stripHtml(s = '') {
  return decodeEntities(String(s).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function tag(block, names) {
  for (const n of [].concat(names)) {
    const re = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i'); const m = block.match(re);
    if (m) return decodeEntities(m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')).trim();
  }
  return '';
}
function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map(m => ({ href: (m[1].match(/href=["']([^"']+)["']/i) || [])[1], rel: (m[1].match(/rel=["']([^"']+)["']/i) || [])[1] || 'alternate' }));
  const alt = links.find(l => l.rel === 'alternate' && l.href) || links.find(l => l.href); return alt ? decodeEntities(alt.href) : '';
}
function parseFeed(xml) {
  const head = String(xml).slice(0, 2000).toLowerCase();
  const kind = head.includes('<feed') ? 'atom' : head.includes('<rdf:rdf') ? 'rdf' : head.includes('<rss') ? 'rss' : null;
  if (!kind) throw new Error('Format bukan RSS/Atom yang dikenali.');
  const blocks = String(xml).match(kind === 'atom' ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  const items = blocks.slice(0, 200).map(b => {
    const link = kind === 'atom' ? atomLink(b) : (tag(b, 'link') || (b.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] || '');
    const rawDesc = tag(b, ['content:encoded', 'description', 'summary', 'content']);
    return {
      title: stripHtml(tag(b, 'title')), link: decodeEntities(link).trim(), guid: tag(b, ['guid', 'id']),
      published: tag(b, ['pubDate', 'dc:date', 'published', 'updated']), summary: stripHtml(rawDesc),
      categories: [...b.matchAll(/<(?:category|dc:subject)[^>]*?(?:term=["']([^"']+)["'][^>]*\/?>|>([\s\S]*?)<\/(?:category|dc:subject)>)/gi)].map(m => stripHtml(m[1] || m[2] || '')).filter(Boolean).slice(0, 5)
    };
  });
  return { kind, title: stripHtml(tag(String(xml).replace(/<(item|entry)[\s>][\s\S]*$/i, ''), 'title')), items };
}
module.exports = { parseFeed, stripHtml, decodeEntities };
