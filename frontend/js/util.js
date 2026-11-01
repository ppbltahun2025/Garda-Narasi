/* GARDA NARASI — utilitas UI: escape, format, ikon, toast, drawer. */
(function () {
  'use strict';
  const GN = window.GN = window.GN || {};
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeHref = v => { try { const u = new URL(String(v || '')); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const link = (url, text) => { const h = safeHref(url); return h ? `<a href="${esc(h)}" target="_blank" rel="noopener noreferrer">${esc(text || h)}</a>` : esc(text || ''); };
  const nf = new Intl.NumberFormat('id-ID');
  const num = n => nf.format(Math.round(n || 0));
  const dt = (v, time = true) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(d); };
  const ago = v => { const m = Math.max(0, (Date.now() - new Date(v).getTime()) / 60000); if (m < 1) return 'baru saja'; if (m < 60) return Math.floor(m) + ' mnt lalu'; if (m < 1440) return Math.floor(m / 60) + ' jam lalu'; return Math.floor(m / 1440) + ' hari lalu'; };
  const pct = x => Math.round((x || 0) * 100) + '%';

  const P = {
    home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>', trend: '<path d="M3 17 9 11l4 4 8-9"/><path d="M15 6h6v6"/>', net: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="m8 7 8 1M7 8l4 8M17 10l-4 6"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>', check: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    rss: '<path d="M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8"/><circle cx="6" cy="18" r="1.5"/>', flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7.5 15h9"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', play: '<path d="M7 4v16l13-8z"/>', download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>', refresh: '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>', shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

  function toast(msg, type = '') { const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.remove(), type === 'err' ? 6500 : 3800); }
  const tip = document.createElement('div'); tip.className = 'tip hidden'; document.body.append(tip);
  document.addEventListener('pointermove', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (!el) { tip.classList.add('hidden'); return; } tip.innerHTML = esc(el.dataset.tip).replace(/\n/g, '<br>'); tip.classList.remove('hidden'); const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 8, e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 16) + 'px'; });

  function drawer(html, { onClose } = {}) {
    closeDrawer(); const layer = $('#layer'); layer.innerHTML = `<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" tabindex="-1"><button class="ibtn" style="position:absolute;top:14px;right:14px" data-close aria-label="Tutup">${icon('x')}</button>${html}</aside>`;
    GN._onClose = onClose; const d = $('.drawer', layer); d.focus(); return d;
  }
  function closeDrawer() { const l = $('#layer'); if (l.innerHTML) { l.innerHTML = ''; if (GN._onClose) GN._onClose(); GN._onClose = null; } }
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDrawer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  const STATUS = { 'needs-review': ['Perlu verifikasi', 'b-pending'], verified: ['Terverifikasi', 'b-verified'], false: ['Tidak benar', 'b-false'], misleading: ['Menyesatkan', 'b-misleading'], 'context-needed': ['Perlu konteks', 'b-context'] };
  const statusBadge = s => { const x = STATUS[s] || STATUS['needs-review']; return `<span class="badge ${x[1]}">${x[0]}</span>`; };
  const scClass = s => s >= 70 ? 'sc-hi' : s >= 45 ? 'sc-mid' : 'sc-lo';
  const LEVEL = { info: 'Info', watch: 'Pantau', warning: 'Waspada', critical: 'Kritis' };
  const lvl = l => `<span class="lvl lv-${esc(l)}">${esc(LEVEL[l] || l)}</span>`;
  const SENT = { positive: 'Positif', negative: 'Negatif', neutral: 'Netral' };
  const EPI = { unverified: 'Klaim belum terverifikasi', speculation: 'Dugaan', opinion: 'Opini', factual: 'Pernyataan faktual (atributif)', 'verified-fact': 'Fakta terverifikasi', 'verified-no-evidence': 'Verified — bukti belum ada' };
  const epiBadge = d => `<span class="badge ${d.key === 'verified-fact' ? 'b-verified' : 'b-epi'}" data-tip="Penanda otomatis dari pola bahasa. 'Fakta terverifikasi' hanya muncul bila pemeriksa manusia menetapkan Terverifikasi dengan bukti.">${esc(EPI[d.key] || d.label)}</span>`;

  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i], nx = text[i + 1]; if (ch === '"' && q && nx === '"') { cell += '"'; i++; } else if (ch === '"') q = !q; else if (ch === ',' && !q) { row.push(cell); cell = ''; } else if ((ch === '\n' || ch === '\r') && !q) { if (ch === '\r' && nx === '\n') i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ''; } else cell += ch; }
    if (cell.length || row.length) { row.push(cell); rows.push(row); } if (!rows.length) return [];
    const head = rows.shift().map(x => x.trim().replace(/^\ufeff/, ''));
    return rows.map(cols => { const o = {}; head.forEach((h, i) => { o[h] = (cols[i] ?? '').trim(); }); if (o.channels) o.channels = o.channels.split('|').map(x => x.trim()); if (o.hourlyCounts) o.hourlyCounts = o.hourlyCounts.split('|').map(Number); if (o.mentions) o.mentions = Number(o.mentions); if (o.isSynthetic) o.isSynthetic = o.isSynthetic.toLowerCase() === 'true'; return o; });
  }
  function download(name, content, type) { const b = content instanceof Blob ? content : new Blob([content], { type }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
  Object.assign(GN, { $, $$, esc, safeHref, link, num, dt, ago, pct, icon, toast, drawer, closeDrawer, STATUS, statusBadge, scClass, LEVEL, lvl, SENT, EPI, epiBadge, parseCsv, download });
})();
