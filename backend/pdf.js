'use strict';
/* Penulis PDF minimal (tanpa dependensi): Helvetica, WinAnsi, teks berbungkus, kotak berwarna. */
const W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const WIN = { '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, '…': 0x85, '•': 0x95, '·': 0xB7, '≥': 0x3E, '≤': 0x3C, '→': 0x2D, '×': 0xD7, '±': 0xB1 };
function enc(s) { const bytes = []; for (const ch of String(s)) { const c = ch.codePointAt(0); if (c >= 32 && c < 127) bytes.push(c); else if (WIN[ch]) bytes.push(WIN[ch]); else if (c >= 0xA0 && c <= 0xFF) bytes.push(c); else if (c === 9 || c === 10) bytes.push(32); else bytes.push(63); } return Buffer.from(bytes); }
function esc(buf) { let o = ''; for (const b of buf) { if (b === 40 || b === 41 || b === 92) o += '\\' + String.fromCharCode(b); else if (b < 32 || b > 126) o += '\\' + b.toString(8).padStart(3, '0'); else o += String.fromCharCode(b); } return o; }
function width(s, size, bold) { let w = 0; for (const b of enc(s)) w += (b >= 32 && b <= 126 ? W[b - 32] : 556) ; return (w * (bold ? 1.06 : 1) * size) / 1000; }
function wrap(s, size, maxW, bold) {
  const lines = []; for (const para of String(s).split(/\n/)) {
    let cur = ''; for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = cur ? cur + ' ' + word : word; if (width(t, size, bold) <= maxW) cur = t; else { if (cur) lines.push(cur); let w = word; while (width(w, size, bold) > maxW && w.length > 1) { let k = w.length - 1; while (k > 1 && width(w.slice(0, k), size, bold) > maxW) k--; lines.push(w.slice(0, k)); w = w.slice(k); } cur = w; }
    } lines.push(cur);
  } return lines;
}
const hex = c => { const n = parseInt(c.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => (v / 255).toFixed(3)).join(' '); };

class Pdf {
  constructor({ title = 'Laporan', footer = '' } = {}) { this.pages = []; this.title = title; this.footer = footer; this.PW = 595.28; this.PH = 841.89; this.M = 48; this.newPage(); }
  newPage() { this.cur = []; this.pages.push(this.cur); this.y = this.PH - this.M; }
  ensure(h) { if (this.y - h < this.M + 18) this.newPage(); }
  raw(s) { this.cur.push(s); }
  text(x, y, s, { size = 10, bold = false, color = '#1b2330' } = {}) { this.raw(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${hex(color)} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(enc(s))}) Tj ET`); }
  rect(x, y, w, h, color) { this.raw(`${hex(color)} rg ${x.toFixed(1)} ${y.toFixed(1)} ${Math.max(0, w).toFixed(1)} ${h.toFixed(1)} re f`); }
  line(x1, y1, x2, y2, color = '#cfd6e0') { this.raw(`${hex(color)} RG 0.6 w ${x1} ${y1} m ${x2} ${y2} l S`); }
  para(s, { size = 10, bold = false, color = '#1b2330', gap = 4, indent = 0, lead = 1.38 } = {}) {
    const lines = wrap(s, size, this.PW - 2 * this.M - indent, bold); lines.forEach(l => { this.ensure(size * lead); this.y -= size * lead; this.text(this.M + indent, this.y, l, { size, bold, color }); }); this.y -= gap;
  }
  h1(s) { this.ensure(40); this.y -= 6; this.para(s, { size: 20, bold: true, gap: 6, color: '#101a3a' }); }
  h2(s) { this.ensure(34); this.y -= 8; this.para(s, { size: 13, bold: true, gap: 3, color: '#101a3a' }); this.line(this.M, this.y + 1, this.PW - this.M, this.y + 1); this.y -= 6; }
  bar(label, value, max, { color = '#2f6f8f', right = '' } = {}) {
    this.ensure(16); this.y -= 14; const lw = 190, bw = this.PW - 2 * this.M - lw - 70; this.text(this.M, this.y, label.length > 38 ? label.slice(0, 36) + '…' : label, { size: 9 });
    this.rect(this.M + lw, this.y - 2, bw, 9, '#e6eaf0'); this.rect(this.M + lw, this.y - 2, bw * Math.min(1, value / Math.max(1, max)), 9, color); this.text(this.M + lw + bw + 6, this.y, String(right || value), { size: 9, bold: true });
  }
  table(cols, rows, { size = 8.5 } = {}) {
    const total = cols.reduce((a, c) => a + c.w, 0), scale = (this.PW - 2 * this.M) / total;
    const drawRow = (cells, head) => {
      const wrapped = cells.map((c, i) => wrap(String(c ?? ''), size, cols[i].w * scale - 6, head)); const h = Math.max(...wrapped.map(l => l.length)) * size * 1.3 + 6;
      this.ensure(h); if (head) this.rect(this.M, this.y - h, this.PW - 2 * this.M, h, '#e9edf5');
      let x = this.M; wrapped.forEach((lines, i) => { lines.forEach((l, k) => this.text(x + 3, this.y - 4 - size * 1.15 - k * size * 1.3, l, { size, bold: head, color: head ? '#101a3a' : '#1b2330' })); x += cols[i].w * scale; });
      this.y -= h; this.line(this.M, this.y, this.PW - this.M, this.y, '#e1e6ee');
    };
    drawRow(cols.map(c => c.label), true); rows.forEach(r => drawRow(r, false)); this.y -= 6;
  }
  build() {
    const objs = []; const add = s => { objs.push(s); return objs.length; };
    const catalog = add(''), pagesObj = add(''), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    this.pages.forEach((ops, i) => {
      const foot = `BT /F1 8 Tf 0.45 0.5 0.58 rg ${this.M} 28 Td (${esc(enc(this.footer))}) Tj ET BT /F1 8 Tf 0.45 0.5 0.58 rg ${this.PW - this.M - 40} 28 Td (${esc(enc(`Hal. ${i + 1}/${this.pages.length}`))}) Tj ET`;
      const content = ops.join('\n') + '\n' + foot; const c = add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${this.PW} ${this.PH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`));
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`; objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    const info = add(`<< /Title (${esc(enc(this.title))}) /Producer (GARDA NARASI 0.2.0) >>`);
    let out = '%PDF-1.4\n'; const offs = []; objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = Buffer.byteLength(out, 'latin1'); out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out, 'latin1');
  }
}
module.exports = { Pdf, wrap, width };
