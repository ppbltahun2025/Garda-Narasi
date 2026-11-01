/* GARDA NARASI — transparent, rule-based analysis engine.
   It prioritizes review; it does not classify truth or identify individual accounts. */
(() => {
  'use strict';
  const STOPWORDS = new Set(['yang','dan','atau','di','ke','dari','untuk','pada','dengan','ini','itu','akan','telah','sudah','ada','tidak','dalam','oleh','karena','agar','saat','sebagai','para','kami','mereka','warga','masyarakat','informasi','klaim','bahwa','sebuah','bisa','dapat','tersebut','lebih','juga','masih','dalam','hingga','mulai','dilaporkan']);
  const NEGATIVE = ['palsu','panik','bahaya','rusak','putus','darurat','korban','gagal','krisis','ancaman','meninggal','hilang','kebakaran','banjir','longsor','ditutup','kacau','parah','bocor','racun','meledak'];
  const POSITIVE = ['aman','pulih','selesai','tersedia','berhasil','selamat','normal','dibuka','membaik','bantuan','evakuasi','siaga','terkendali','sembuh','lancar'];
  const STATUS = {
    'needs-review': {label:'Perlu verifikasi', className:'pending'},
    'verified': {label:'Terverifikasi', className:'verified'},
    'false': {label:'Tidak benar', className:'false'},
    'misleading': {label:'Menyesatkan', className:'misleading'},
    'context-needed': {label:'Perlu konteks', className:'context'}
  };

  function normalizeText(value='') {
    return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function tokens(value='') {
    return [...new Set(normalizeText(value).split(' ').filter(t => t.length > 2 && !STOPWORDS.has(t)))];
  }
  function jaccard(a,b) {
    const A = new Set(tokens(a)), B = new Set(tokens(b));
    if (!A.size || !B.size) return 0;
    let shared = 0; A.forEach(x => { if (B.has(x)) shared++; });
    return shared / (A.size + B.size - shared);
  }
  function safeDate(value) {
    const date = new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  function normalizeClaim(raw={}) {
    const channels = Array.isArray(raw.channels) ? raw.channels : String(raw.channels || raw.source || 'Input manual').split('|').map(s=>s.trim()).filter(Boolean);
    return {
      id: String(raw.id || `GN-${Date.now()}-${Math.random().toString(36).slice(2,6)}`),
      date: safeDate(raw.date || raw.lastSeen || new Date().toISOString()),
      firstSeen: safeDate(raw.firstSeen || raw.date || new Date().toISOString()),
      title: String(raw.title || raw.claim || 'Klaim tanpa judul').slice(0,160),
      claim: String(raw.claim || raw.title || '').slice(0,2000),
      topic: String(raw.topic || 'Informasi umum').slice(0,80),
      region: String(raw.region || 'Tidak disebutkan').slice(0,100),
      source: String(raw.source || channels[0] || 'Input manual').slice(0,120),
      sourceUrl: String(raw.sourceUrl || raw.url || '').slice(0,500),
      channels: [...new Set(channels)].slice(0,30),
      mentions: Math.max(1, Math.min(100000, Number(raw.mentions) || 1)),
      status: STATUS[raw.status] ? raw.status : 'needs-review',
      verificationNote: String(raw.verificationNote || '').slice(0,2000),
      evidenceUrl: String(raw.evidenceUrl || '').slice(0,500),
      sentiment: ['positive','negative','neutral'].includes(raw.sentiment) ? raw.sentiment : null,
      hourlyCounts: Array.isArray(raw.hourlyCounts) ? raw.hourlyCounts.slice(-12).map(n=>Math.max(0,Number(n)||0)) : [],
      isSynthetic: raw.isSynthetic === true,
      updatedAt: safeDate(raw.updatedAt || raw.date || new Date().toISOString())
    };
  }
  function sentimentOf(text) {
    const words = tokens(text); let pos=0, neg=0;
    words.forEach(w=>{ if(POSITIVE.includes(w)) pos++; if(NEGATIVE.includes(w)) neg++; });
    if (pos===neg) return {label:'Netral', key:'neutral', positive:pos, negative:neg};
    return pos>neg ? {label:'Positif',key:'positive',positive:pos,negative:neg} : {label:'Negatif',key:'negative',positive:pos,negative:neg};
  }
  function isBurst(claim) {
    const series = claim.hourlyCounts || [];
    if (series.length < 4) return false;
    const recent = series[series.length-1];
    const baseline = series.slice(0,-1).reduce((a,b)=>a+b,0) / (series.length-1);
    return recent >= 5 && recent >= Math.max(3, baseline * 2.5);
  }
  function analyzeClaim(claim, now=new Date()) {
    const mentions = Math.max(1, Number(claim.mentions)||1);
    const channels = Math.max(1, (claim.channels || []).length);
    const last = new Date(claim.date);
    const ageHours = Math.max(0, (now.getTime()-last.getTime())/3600000);
    const recency = ageHours <= 24 ? 1 : ageHours <= 72 ? .72 : ageHours <= 168 ? .42 : .15;
    const volume = Math.min(1, Math.log10(mentions+1)/2.3);
    const diversity = Math.min(1, channels/5);
    const pending = claim.status === 'needs-review' ? 1 : .25;
    const burst = isBurst(claim);
    const score = Math.round(100 * (.30*volume + .25*recency + .25*diversity + .20*pending + (burst ? .08 : 0)) / 1.08);
    const sentiment = sentimentOf(`${claim.title} ${claim.claim}`);
    let urgency = score >= 70 ? 'Tinggi' : score >= 45 ? 'Sedang' : 'Rendah';
    return {score,urgency,volumeScore:Math.round(volume*100),recencyScore:Math.round(recency*100),diversityScore:Math.round(diversity*100),reviewScore:Math.round(pending*100),burst,sentiment,ageHours:Math.round(ageHours)};
  }
  function groupNarratives(claims) {
    const groups = new Map();
    claims.forEach(c=>{
      const key = c.topic || 'Informasi umum';
      if (!groups.has(key)) groups.set(key,{topic:key,claims:[],mentions:0,pending:0,high:0});
      const g=groups.get(key); g.claims.push(c); g.mentions+=c.mentions;
      if(c.status==='needs-review')g.pending++;
      if(analyzeClaim(c).score>=70)g.high++;
    });
    return [...groups.values()].sort((a,b)=>b.mentions-a.mentions);
  }
  function findSimilarClaims(claim, all, threshold=.24) {
    return all.filter(other=>other.id!==claim.id).map(other=>({claim:other,similarity:jaccard(`${claim.title} ${claim.claim}`,`${other.title} ${other.claim}`)})).filter(x=>x.similarity>=threshold).sort((a,b)=>b.similarity-a.similarity).slice(0,4);
  }
  // Deteksi pola amplifikasi hanya pada level klaim dan kanal agregat.
  // Hasil adalah kandidat pemeriksaan, bukan bukti bot atau koordinasi pelaku.
  function findAmplificationSignals(claims, threshold=.34, windowMinutes=90) {
    const signals=[];
    for(let i=0;i<claims.length;i++){
      for(let j=i+1;j<claims.length;j++){
        const a=claims[i], b=claims[j];
        if(a.topic!==b.topic) continue;
        const delta=Math.abs(new Date(a.date).getTime()-new Date(b.date).getTime())/60000;
        if(!Number.isFinite(delta)||delta>windowMinutes) continue;
        const similarity=jaccard(`${a.title} ${a.claim}`,`${b.title} ${b.claim}`);
        const channels=[...new Set([...(a.channels||[]),...(b.channels||[])])];
        const sources=[...new Set([a.source,b.source].filter(Boolean))];
        if(similarity>=threshold && channels.length>=3 && sources.length>=2){
          signals.push({claims:[a,b],similarity,deltaMinutes:Math.round(delta),channels,sources,topic:a.topic});
        }
      }
    }
    return signals.sort((a,b)=>b.similarity-a.similarity);
  }
  function scoreExplanation(analysis) {
    return [
      {label:'Volume pembahasan',value:analysis.volumeScore,detail:'Besarnya catatan pembahasan pada dataset'},
      {label:'Kebaruan isu',value:analysis.recencyScore,detail:'Seberapa baru waktu pembaruan catatan'},
      {label:'Keragaman kanal',value:analysis.diversityScore,detail:'Jumlah kanal/sumber yang tercatat'},
      {label:'Kebutuhan review',value:analysis.reviewScore,detail:'Klaim yang belum ditinjau mendapat prioritas review'}
    ];
  }
  window.GardaEngine = {STATUS,normalizeClaim,normalizeText,tokens,jaccard,sentimentOf,isBurst,analyzeClaim,groupNarratives,findSimilarClaims,findAmplificationSignals,scoreExplanation};
})();
