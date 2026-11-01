'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { parseRobots, evaluate } = require('../scraper/robots.js'); const { parseFeed } = require('../scraper/rss.js'); const { cleanItem, canonicalUrl, indonesianRatio } = require('../scraper/clean.js'); const { isPrivateIp } = require('../scraper/net.js');

test('robots.txt: grup spesifik menang, longest-match, wildcard, $', () => {
  const g = parseRobots('User-agent: *\nDisallow: /private/\nAllow: /private/ok\nDisallow: /*.pdf$\nCrawl-delay: 5\n\nUser-agent: GardaNarasiBot\nDisallow: /rss/blocked\n');
  assert.equal(evaluate(g, 'GardaNarasiBot/0.2', '/rss/blocked.xml').allowed, false); assert.equal(evaluate(g, 'GardaNarasiBot/0.2', '/private/x').allowed, true);
  assert.equal(evaluate(g, 'lain', '/private/x').allowed, false); assert.equal(evaluate(g, 'lain', '/private/ok/1').allowed, true); assert.equal(evaluate(g, 'lain', '/a/b.pdf').allowed, false); assert.equal(evaluate(g, 'lain', '/a/b.pdf?x=1').allowed, true); assert.equal(evaluate(g, 'lain', '/x').crawlDelay, 5);
  assert.equal(evaluate([], 'x', '/apa-saja').allowed, true);
});
test('RSS: CDATA, entitas, tag HTML, tanpa field penulis', () => {
  const f = parseFeed('<rss><channel><title>T</title><item><title><![CDATA[Banjir &amp; longsor]]></title><link>https://x.id/a</link><pubDate>Sat, 31 Oct 2026 10:00:00 +0700</pubDate><description>&lt;p&gt;Warga&lt;/p&gt; mengungsi</description><author>rahasia@x.com</author></item></channel></rss>');
  assert.equal(f.items.length, 1); assert.equal(f.items[0].title, 'Banjir & longsor'); assert.equal(f.items[0].summary, 'Warga mengungsi'); assert.ok(!JSON.stringify(f).includes('rahasia'));
  assert.throws(() => parseFeed('<html></html>'));
});
test('Atom diparse', () => {
  const f = parseFeed('<feed><title>A</title><entry><title>Judul panjang atom</title><link rel="alternate" href="https://x.id/e1"/><updated>2026-10-31T01:00:00Z</updated><summary>Ringkasan</summary></entry></feed>'); assert.equal(f.kind, 'atom'); assert.equal(f.items[0].link, 'https://x.id/e1');
});
test('canonical URL membuang pelacak & fragmen', () => { assert.equal(canonicalUrl('https://WWW.X.id/a/?utm_source=wa&id=2#top'), 'https://x.id/a/?id=2'); assert.equal(canonicalUrl('javascript:alert(1)'), ''); });
test('clean: PII, ringkasan dipotong, tanggal lama/masa depan dibuang', () => {
  const now = '2026-11-01T01:00:00Z'; const ok = cleanItem({ title: 'Banjir di Padang hubungi 081234567890 segera', link: 'https://x.id/a', summary: 'Warga mengungsi karena banjir yang melanda. '.repeat(30), published: 'Sat, 31 Oct 2026 10:00:00 +0700' }, { collectedAt: now });
  assert.ok(ok.item && !/0812/.test(ok.item.title) && ok.item.summary.length <= 402);
  assert.equal(cleanItem({ title: 'Judul lama sekali di sini', link: 'https://x.id/b', published: '2026-01-01T00:00:00Z' }, { collectedAt: now }).drop, 'terlalu-lama');
  assert.equal(cleanItem({ title: 'Judul dari masa depan', link: 'https://x.id/c', published: '2026-12-01T00:00:00Z' }, { collectedAt: now }).drop, 'tanggal-masa-depan');
});
test('bahasa: Indonesia vs Inggris', () => { assert.ok(indonesianRatio('Presiden menandatangani aturan baru yang akan berlaku di sejumlah kota') >= 0.07); assert.ok(indonesianRatio('The government announced a new policy that will start next month') < 0.07); });
test('SSRF: alamat privat dikenali', () => { for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.16.5.5', '169.254.1.1', '::1', 'fd00::1']) assert.ok(isPrivateIp(ip), ip); assert.ok(!isPrivateIp('8.8.8.8')); });
