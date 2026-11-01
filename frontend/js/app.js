/* GARDA NARASI — shell: router, navigasi, strip pipeline, SSE, tema. */
(function () {
  'use strict';
  const GN = window.GN, { $, $$, esc, icon, toast } = GN, api = GN.api;
  const NAV = [['ringkasan', 'Situasi', 'home'], ['narasi', 'Intelijen narasi', 'layers'], ['tren', 'Tren nasional', 'trend'], ['jaringan', 'Jaringan', 'net'], ['peta', 'Peta isu', 'map'], ['peringatan', 'Peringatan dini', 'bell'], ['verifikasi', 'Verifikasi', 'check'], ['sumber', 'Sumber & pipeline', 'rss'], ['lab', 'Lab & evaluasi', 'flask'], ['laporan', 'Laporan & data', 'file']];
  const GROUPS = { ringkasan: 'Pantau', narasi: null, tren: null, jaringan: null, peta: null, peringatan: 'Tindak', verifikasi: null, sumber: 'Kelola', lab: null, laporan: null };
  let current = 'ringkasan', renderTok = 0;

  function buildNav() { $('#nav').innerHTML = NAV.map(([k, l, i]) => `${GROUPS[k] ? `<div class="nav-label">${GROUPS[k]}</div>` : ''}<a href="#/${k}" data-r="${k}" title="${l}">${icon(i)}<span>${l}</span>${k === 'peringatan' ? '<b class="count hidden" id="alertCount"></b>' : ''}</a>`).join(''); }
  function setNav() { $$('#nav a').forEach(a => a.removeAttribute('aria-current')); const a = $(`#nav a[data-r="${current}"]`); if (a) a.setAttribute('aria-current', 'page'); document.title = `${GN.views[current].title} — GARDA NARASI`; }
  async function render() {
    const k = (location.hash.replace(/^#\//, '').split('?')[0]) || 'ringkasan'; current = GN.views[k] ? k : 'ringkasan'; setNav(); const tok = ++renderTok; const host = $('#view'); host.onclick = null;
    host.innerHTML = '<div class="stack"><div class="skeleton" style="width:40%;height:30px"></div><div class="skeleton" style="height:180px"></div><div class="skeleton" style="height:120px"></div></div>';
    try { await GN.views[current].render(host); } catch (e) { if (tok === renderTok) host.innerHTML = `<div class="card"><div class="empty"><b>Tampilan gagal dimuat</b>${esc(e.message)}</div></div>`; console.error(e); }
    if (tok === renderTok) { host.focus({ preventScroll: true }); }
  }
  GN.refreshView = () => render();
  GN.updatePipeline = async function () {
    try { const p = await api.get('/api/pipeline'); $('#pipeline').innerHTML = p.stages.map((s, i) => `${i ? '<span class="link"></span>' : ''}<a class="stage ${s.value && ['alert', 'verify'].includes(s.key) ? 'hot' : ''}" href="#/${{ collect: 'sumber', clean: 'sumber', normalize: 'sumber', analyze: 'lab', cluster: 'narasi', alert: 'peringatan', verify: 'verifikasi' }[s.key]}" title="${s.label}"><span>${s.label}</span><b>${GN.num(s.value)}</b></a>`).join(''); } catch { /* strip bersifat informatif */ }
  };
  GN.updateBadge = async function () {
    if (api.mode !== 'server') return; try { const a = await api.get('/api/alerts?open=1&limit=200'); const n = a.alerts.length; const c = $('#alertCount'); if (c) { c.textContent = n; c.classList.toggle('hidden', !n); } $('#btnAlerts').innerHTML = icon('bell') + (n ? `<span class="pip">${n}</span>` : ''); } catch { /* abaikan */ }
    GN.updatePipeline();
  };
  function connectStream() {
    if (api.mode !== 'server' || !window.EventSource) return; const es = new EventSource(api.url('/api/stream'));
    es.addEventListener('alert', e => { const a = JSON.parse(e.data); toast(`${GN.LEVEL[a.level]}: ${a.title}`, a.level === 'critical' || a.level === 'warning' ? 'warn' : ''); GN.updateBadge(); if (current === 'ringkasan' || current === 'peringatan') GN.refreshView(); if (GN.browserNotif && 'Notification' in window && Notification.permission === 'granted') new Notification('GARDA NARASI — ' + GN.LEVEL[a.level], { body: a.title }); });
    es.addEventListener('run', () => { GN.updatePipeline(); });
  }
  function theme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('gn.theme', t); $('#btnTheme').innerHTML = icon(t === 'dark' ? 'sun' : 'moon'); document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0e1330' : '#eff1f8'; }
  async function boot() {
    buildNav(); theme(localStorage.getItem('gn.theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
    $('#btnAlerts').innerHTML = icon('bell'); $('#btnWho').innerHTML = icon('user'); $('#btnTheme').onclick = () => theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    $('#btnAlerts').onclick = () => { location.hash = '#/peringatan'; }; $('#btnWho').onclick = () => { const n = prompt('Nama pemeriksa (dicatat pada jejak audit):', api.who); if (n !== null) { api.setWho(n.trim()); toast('Nama pemeriksa disimpan.'); } };
    const mode = await api.init();
    $('#modebox').innerHTML = mode === 'server' ? `<b><span class="dot"></span>Mode server</b><span>Pengumpulan, scheduler & laporan aktif${api.health.authRequired ? ' · token' : ''}</span>` : `<b><span class="dot warn"></span>Mode lokal</b><span>Data di browser Anda; tanpa pengumpulan otomatis</span>`;
    if (mode === 'local') { $('#pipeline').innerHTML = '<span class="muted" style="font-size:12.5px">Mode lokal — mesin analisis berjalan di browser. Jalankan backend untuk pipeline otomatis.</span>'; }
    await GN.updateBadge(); connectStream(); window.addEventListener('hashchange', render); await render(); setInterval(() => { if (!document.hidden) GN.updateBadge(); }, 60000);
  }
  boot().catch(e => { document.body.insertAdjacentHTML('afterbegin', `<pre style="padding:20px;color:#f88">Gagal memulai: ${esc(e.stack || e.message)}</pre>`); });
})();
