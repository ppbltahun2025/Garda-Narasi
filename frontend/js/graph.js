/* GARDA NARASI — graf jaringan narasi (SVG, tata letak gaya-gaya sederhana, drag & sorot tetangga). */
(function () {
  'use strict';
  const GN = window.GN, esc = GN.esc;
  GN.graph = function mount(host, data, { onPick } = {}) {
    const W = 900, H = 600; const nodes = data.nodes.map((n, i) => ({ ...n, x: W / 2 + Math.cos(i * 2.399) * (120 + (i % 7) * 30), y: H / 2 + Math.sin(i * 2.399) * (100 + (i % 5) * 34), vx: 0, vy: 0 }));
    const byId = new Map(nodes.map(n => [n.id, n])); const edges = data.edges.filter(e => byId.has(e.source) && byId.has(e.target)).map(e => ({ ...e, s: byId.get(e.source), t: byId.get(e.target) }));
    const radius = n => n.kind === 'cluster' ? 8 + Math.min(14, n.weight * 2.4) : n.kind === 'source' ? 7 + Math.min(10, n.weight * 1.6) : 11 + Math.min(8, n.weight);
    const fill = n => n.kind === 'source' ? 'var(--langit)' : n.kind === 'topic' ? 'var(--kunyit)' : 'var(--primary)';
    function relax(iter) {
      for (let k = 0; k < iter; k++) {
        const cool = 1 - k / iter;
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const a = nodes[i], b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01; const d = Math.sqrt(d2); const f = 5200 / d2; dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; }
        edges.forEach(e => { const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y, d = Math.sqrt(dx * dx + dy * dy) + 0.01; const target = e.kind === 'topic' ? 90 : 120; const f = (d - target) * 0.02 * Math.min(2, 0.6 + e.weight * 0.4); e.s.vx += dx / d * f; e.s.vy += dy / d * f; e.t.vx -= dx / d * f; e.t.vy -= dy / d * f; });
        nodes.forEach(n => { n.vx += (W / 2 - n.x) * 0.004; n.vy += (H / 2 - n.y) * 0.004; if (!n.fixed) { n.x += Math.max(-24, Math.min(24, n.vx)) * cool * 0.6; n.y += Math.max(-24, Math.min(24, n.vy)) * cool * 0.6; } n.vx *= 0.55; n.vy *= 0.55; n.x = Math.max(30, Math.min(W - 30, n.x)); n.y = Math.max(30, Math.min(H - 30, n.y)); });
      }
    }
    relax(320);
    const label = n => esc(n.label.length > 26 ? n.label.slice(0, 25) + '…' : n.label);
    function draw() {
      host.innerHTML = `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Jaringan sumber, klaster narasi, dan topik">${edges.map((e, i) => `<line class="edge" data-e="${i}" x1="${e.s.x.toFixed(1)}" y1="${e.s.y.toFixed(1)}" x2="${e.t.x.toFixed(1)}" y2="${e.t.y.toFixed(1)}" stroke-width="${Math.min(5, 1 + e.weight * 0.8)}"/>`).join('')}${nodes.map((n, i) => `<g class="node" data-n="${i}" transform="translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(n.kind)}: ${esc(n.label)}"><circle r="${radius(n)}" fill="${fill(n)}" fill-opacity=".85" stroke="${n.burst ? 'var(--cabai)' : 'var(--bg2)'}" stroke-width="${n.burst ? 3 : 2}" data-tip="${esc(n.label)}\n${n.kind === 'cluster' ? n.weight + ' item · ' + (n.mentions || 0) + ' catatan' + (n.burst ? '\nLonjakan terindikasi' : '') : n.kind === 'source' ? n.weight + ' klaster' : 'topik'}"/><text y="${radius(n) + 13}" text-anchor="middle">${label(n)}</text></g>`).join('')}</svg>`;
      const svg = host.firstElementChild; let drag = null;
      const pt = e => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
      const focus = i => { const n = nodes[i]; const nb = new Set([n.id]); edges.forEach(e => { if (e.s === n) nb.add(e.t.id); if (e.t === n) nb.add(e.s.id); }); svg.querySelectorAll('.node').forEach(g => g.classList.toggle('dim', !nb.has(nodes[g.dataset.n].id))); svg.querySelectorAll('.edge').forEach(l => { const e = edges[l.dataset.e]; l.classList.toggle('dim', !(e.s === n || e.t === n)); }); };
      const clear = () => svg.querySelectorAll('.dim').forEach(x => x.classList.remove('dim'));
      svg.addEventListener('pointerover', e => { const g = e.target.closest('.node'); if (g && !drag) focus(g.dataset.n); }); svg.addEventListener('pointerout', e => { if (!drag && e.target.closest('.node')) clear(); });
      svg.addEventListener('pointerdown', e => { const g = e.target.closest('.node'); if (!g) return; drag = { i: Number(g.dataset.n), moved: false }; svg.setPointerCapture(e.pointerId); nodes[drag.i].fixed = true; });
      svg.addEventListener('pointermove', e => { if (!drag) return; drag.moved = true; const p = pt(e); const n = nodes[drag.i]; n.x = p.x; n.y = p.y; relax(3); nodes[drag.i].x = p.x; nodes[drag.i].y = p.y; update(); });
      svg.addEventListener('pointerup', e => { if (!drag) return; const n = nodes[drag.i]; n.fixed = false; if (!drag.moved && onPick) onPick(n); drag = null; clear(); });
      svg.addEventListener('keydown', e => { if (e.key === 'Enter') { const g = e.target.closest('.node'); if (g && onPick) onPick(nodes[g.dataset.n]); } });
      function update() { svg.querySelectorAll('.node').forEach(g => { const n = nodes[g.dataset.n]; g.setAttribute('transform', `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`); }); svg.querySelectorAll('.edge').forEach(l => { const e = edges[l.dataset.e]; l.setAttribute('x1', e.s.x); l.setAttribute('y1', e.s.y); l.setAttribute('x2', e.t.x); l.setAttribute('y2', e.t.y); }); }
    }
    draw();
  };
})();
