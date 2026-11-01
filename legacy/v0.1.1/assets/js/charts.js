/* Small dependency-free canvas charts for the hackathon prototype. */
(() => {
  'use strict';
  function setupCanvas(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(280, rect.width || 600), height = Math.max(180, rect.height || 240);
    canvas.width = width * ratio; canvas.height = height * ratio;
    const ctx = canvas.getContext('2d'); ctx.scale(ratio,ratio);
    return {ctx,width,height};
  }
  function drawVolume(canvas, entries) {
    const setup=setupCanvas(canvas); if(!setup)return;
    const {ctx,width,height}=setup; ctx.clearRect(0,0,width,height);
    const pad={l:38,r:12,t:16,b:32}; const chartW=width-pad.l-pad.r, chartH=height-pad.t-pad.b;
    const max=Math.max(5,...entries.map(e=>e.value));
    ctx.font='11px Inter, system-ui, sans-serif'; ctx.fillStyle='#8490a1'; ctx.strokeStyle='#e9edf2'; ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const y=pad.t+chartH*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();ctx.fillText(String(Math.round(max*(1-i/4))),4,y+4);}
    const step=chartW/Math.max(1,entries.length), barW=Math.min(28,step*.48);
    entries.forEach((e,i)=>{const x=pad.l+step*i+(step-barW)/2;const h=(e.value/max)*chartH;const y=pad.t+chartH-h;const grad=ctx.createLinearGradient(0,y,0,pad.t+chartH);grad.addColorStop(0,'#31b7a6');grad.addColorStop(1,'#a8e1d9');ctx.fillStyle=grad;roundRect(ctx,x,y,barW,h,6);ctx.fill();ctx.fillStyle='#7c8796';ctx.textAlign='center';ctx.fillText(e.label, x+barW/2,height-9);});
  }
  function drawDonut(element, counts) {
    if(!element)return; const total=counts.positive+counts.negative+counts.neutral;
    const safeTotal=Math.max(1,total), positive=counts.positive/safeTotal, negative=counts.negative/safeTotal;
    const degrees=[positive*360,negative*360];
    element.style.background=`conic-gradient(#2db49f 0 ${degrees[0]}deg,#ec7777 ${degrees[0]}deg ${degrees[0]+degrees[1]}deg,#9ba8b8 ${degrees[0]+degrees[1]}deg 360deg)`;
  }
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  window.GardaCharts={drawVolume,drawDonut};
})();
