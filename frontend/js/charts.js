/* GARDA NARASI — grafik SVG/HTML tanpa pustaka eksternal. */
(function () {
  'use strict';
  const GN = window.GN, esc = GN.esc;
  const COLORS = ['#8296ff', '#5bb8ea', '#5fcaa2', '#f3b43f', '#b592f2', '#f2705a', '#ff9a4d'];
  const col = i => `var(--c${i % 7},${COLORS[i % COLORS.length]})`;
  const C = GN.charts = { COLORS };

  C.gauge = (v, label = 'Tekanan narasi') => {
    const r = 74, cx = 100, cy = 96, a0 = Math.PI * 0.85, a1 = Math.PI * 2.15, p = (a, rr = r) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    const arc = (from, to) => { const [x1, y1] = p(from), [x2, y2] = p(to); return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
    const end = a0 + (a1 - a0) * Math.max(0.001, Math.min(1, v / 100)); const color = v >= 60 ? 'var(--cabai)' : v >= 35 ? 'var(--kunyit)' : 'var(--sirih)';
    const ticks = [0, 25, 50, 75, 100].map(t => { const a = a0 + (a1 - a0) * t / 100, [x1, y1] = p(a, r + 8), [x2, y2] = p(a, r + 13); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--line2)"/>`; }).join('');
    return `<svg viewBox="0 0 200 170" class="chart" role="img" aria-label="${esc(label)} ${v} dari 100"><path d="${arc(a0, a1)}" fill="none" stroke="var(--line)" stroke-width="13" stroke-linecap="round"/><path d="${arc(a0, end)}" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"/>${ticks}<text x="100" y="100" text-anchor="middle" style="font:600 44px var(--serif);fill:var(--text)">${v}</text><text x="100" y="122" text-anchor="middle">${esc(label)}</text></svg>`;
  };

  C.area = (data, { w = 640, h = 220, color = 'var(--primary)', unit = '' } = {}) => {
    if (!data.length) return '<div class="empty">Belum ada data.</div>';
    const pad = { l: 36, r: 10, t: 12, b: 26 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b; const max = Math.max(5, ...data.map(d => d.value)); const x = i => pad.l + (data.length === 1 ? W / 2 : i * W / (data.length - 1)), y = v => pad.t + H - v / max * H;
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(''); const id = 'g' + Math.random().toString(36).slice(2, 7);
    const grid = [0, .25, .5, .75, 1].map(f => `<line class="gl" x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + H * f}" y2="${pad.t + H * f}"/><text x="${pad.l - 6}" y="${pad.t + H * f + 4}" text-anchor="end">${Math.round(max * (1 - f))}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Grafik volume"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".38"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${line} L${x(data.length - 1)} ${pad.t + H} L${x(0)} ${pad.t + H}Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>${data.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.value)}" r="4.5" fill="var(--bg2)" stroke="${color}" stroke-width="2" data-tip="${esc(d.label)}\n${d.value}${unit}${d.items !== undefined ? ' · ' + d.items + ' item' : ''}"/>`).join('')}${data.map((d, i) => `<text x="${x(i)}" y="${h - 7}" text-anchor="middle">${esc(d.label)}</text>`).join('')}</svg>`;
  };

  C.stacked = (days, series, { w = 640, h = 230 } = {}) => {
    const pad = { l: 36, r: 10, t: 12, b: 26 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b; const totals = days.map((_, i) => series.reduce((a, s) => a + s.values[i], 0)); const max = Math.max(5, ...totals); const bw = Math.min(46, W / days.length * 0.6);
    const grid = [0, .5, 1].map(f => `<line class="gl" x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + H * f}" y2="${pad.t + H * f}"/><text x="${pad.l - 6}" y="${pad.t + H * f + 4}" text-anchor="end">${Math.round(max * (1 - f))}</text>`).join('');
    const bars = days.map((d, i) => { let acc = 0; const cx = pad.l + (i + .5) * W / days.length; return series.map((s, k) => { const v = s.values[i], hh = v / max * H, y = pad.t + H - acc - hh; acc += hh; return v ? `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${Math.max(0, hh - 1)}" rx="2" fill="${C.COLORS[k % 7]}" data-tip="${esc(d.label)} · ${esc(s.topic)}\n${v} catatan"/>` : ''; }).join('') + `<text x="${cx}" y="${h - 7}" text-anchor="middle">${esc(d.label)}</text>`; }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Volume per topik per hari">${grid}${bars}</svg>` + `<div class="legend" style="margin-top:8px">${series.map((s, k) => `<span><i style="background:${C.COLORS[k % 7]}"></i>${esc(s.topic)}</span>`).join('')}</div>`;
  };

  C.heat = (rows, labels) => {
    const max = Math.max(1, ...rows.flatMap(r => r.buckets));
    return `<div style="overflow-x:auto"><div style="min-width:560px">${rows.map(r => `<div style="display:grid;grid-template-columns:150px 1fr;gap:10px;align-items:center;margin-bottom:5px"><span style="font-size:12px;color:var(--muted)">${esc(r.topic)}</span><div class="heat" style="grid-template-columns:repeat(24,1fr)">${r.buckets.map((v, i) => `<div class="c" style="background:${v ? `color-mix(in srgb,var(--primary) ${Math.round(20 + v / max * 80)}%,transparent)` : 'var(--line)'}" data-tip="${esc(r.topic)}\n${esc(labels[i])} · ${v} item"></div>`).join('')}</div></div>`).join('')}<div style="display:grid;grid-template-columns:150px 1fr;gap:10px"><span></span><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--faint)"><span>${esc(labels[0])}</span><span>${esc(labels[12])}</span><span>${esc(labels[23])}</span></div></div></div></div>`;
  };

  C.spark = (series, color = 'var(--primary)') => {
    const w = 96, h = 26, max = Math.max(1, ...series), n = series.length; if (n < 2) return '';
    const pts = series.map((v, i) => `${(i * (w - 4) / (n - 1) + 2).toFixed(1)},${(h - 3 - v / max * (h - 6)).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" class="spark" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${pts.split(' ').pop().split(',')[0]}" cy="${pts.split(' ').pop().split(',')[1]}" r="2.6" fill="${color}"/></svg>`;
  };

  C.seg = (parts) => { const tot = parts.reduce((a, p) => a + p.v, 0) || 1; return `<div class="seg" role="img" aria-label="Komposisi">${parts.map(p => `<i style="width:${p.v / tot * 100}%;background:${p.color}" data-tip="${esc(p.label)}: ${p.v}"></i>`).join('')}</div><div class="legend" style="margin-top:8px">${parts.map(p => `<span><i style="background:${p.color}"></i>${esc(p.label)} <b style="color:var(--text)">${p.v}</b></span>`).join('')}</div>`; };
  C.hbars = (rows, { max, color = 'var(--primary)' } = {}) => { const m = max || Math.max(1, ...rows.map(r => r.v)); return rows.map(r => `<div style="margin-bottom:11px"><div class="mrow"><span>${esc(r.label)}</span><b style="color:var(--text)">${esc(r.right ?? r.v)}</b></div><div class="meter"><i style="width:${Math.min(100, r.v / m * 100)}%;background:${r.color || color}"></i></div></div>`).join(''); };

  C.tilemap = (provinces, { selected, mode = 'verified', onPick } = {}) => {
    const val = p => mode === 'candidate' ? p.candidate : p.verified; const max = Math.max(1, ...provinces.map(val)); const cols = 16, rows = 8; const cells = [];
    const idx = new Map(provinces.map(p => [p.col + ',' + p.row, p]));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const p = idx.get(c + ',' + r); if (!p) { cells.push('<div></div>'); continue; } const v = val(p);
      const bg = v ? `color-mix(in srgb,${p.avgUrgency >= 70 ? 'var(--cabai)' : p.avgUrgency >= 45 ? 'var(--kunyit)' : 'var(--sirih)'} ${Math.round(25 + v / max * 60)}%,var(--panel2))` : 'var(--panel2)';
      cells.push(`<button class="tile ${selected === p.code ? 'sel' : ''}" data-prov="${p.code}" style="background:${bg};${v ? 'color:var(--text)' : ''}" data-tip="${esc(p.name)}\nTerverifikasi: ${p.verified}\nKandidat: ${p.candidate}${p.verified ? '\nRata-rata urgensi: ' + p.avgUrgency : ''}" aria-label="${esc(p.name)}: ${v} item">${v ? `<b>${v}</b>` : ''}<span>${p.code.slice(3)}</span>${mode === 'verified' && p.candidate ? '<i></i>' : ''}</button>`); }
    return `<div class="tilemap" style="grid-template-columns:repeat(${cols},minmax(0,1fr))" role="group" aria-label="Peta kartogram provinsi Indonesia">${cells.join('')}</div>`;
  };
})();
