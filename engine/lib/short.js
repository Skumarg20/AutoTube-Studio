// AutoTube Studio Short (1080x1920) mixing two Lemo Opuscar library themes by chapter:
//   "whiteboard" (Whiteboard Explainer) and "cel-anime-80s" (80s Cel Anime). Each theme is drawn by its own director over the
// library's own engine; this file only picks the theme of the current chapter and puts each theme's own subtitle style on top.
window.HS_NO_AUTORUN = true;
const TL = window.TL;
const WB = await import('./whiteboard.js');
const AN = await import('./anime.js');
const wb = await WB.build({ vertical: true, only: 'whiteboard' });
const an = await AN.build();
await document.fonts.load('48px AD');

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const buf = new OffscreenCanvas(1920, 1080), bctx = buf.getContext('2d');
const styleAt = t => { const c = (TL.chapters || []).find(c => t >= c.t0 && t < c.t1) || (TL.chapters || [])[TL.chapters.length - 1]; return c ? c.style : 'whiteboard'; };
const subs = (TL.phrases || []).map(p => ({ t0: p.s - .05, t1: p.e + .25, text: p.w.map(w => w.w).join(' ') }));
for (let i = 0; i < subs.length - 1; i++) subs[i].t1 = Math.min(Math.max(subs[i].t1, subs[i].t0 + 1), subs[i + 1].t0 - .04);

function wrap2(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return [text];
  const ws = text.split(' '); let best = 1, bd = 1e9;
  for (let i = 1; i < ws.length; i++) { const d = Math.abs(ctx.measureText(ws.slice(0, i).join(' ')).width - ctx.measureText(ws.slice(i).join(' ')).width); if (d < bd) { bd = d; best = i; } }
  return [ws.slice(0, best).join(' '), ws.slice(best).join(' ')];
}
// whiteboard's own subtitle plate: cream plate, Architects Daughter, orange tick
function plate(t) {
  const s = subs.find(s => t >= s.t0 && t < s.t1); if (!s) return;
  const a = Math.min(1, (t - s.t0) / .12, (s.t1 - t) / .12); ctx.save(); ctx.font = '64px AD';
  const rows = wrap2(s.text, 940), w = Math.max(...rows.map(r => ctx.measureText(r).width)) + 64, h = 92 + (rows.length - 1) * 72, y0 = 1660 - h;
  ctx.globalAlpha = a * .92; ctx.fillStyle = '#fdfcf8'; ctx.shadowColor = 'rgba(30,30,40,.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
  ctx.beginPath(); ctx.roundRect(540 - w / 2, y0, w, h, 16); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.globalAlpha = a;
  ctx.fillStyle = '#d97757'; ctx.fillRect(540 - w / 2 + 22, y0 + h - 12, 36, 4);
  ctx.fillStyle = '#23262c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; rows.forEach((r, i) => ctx.fillText(r, 540, y0 + 48 + i * 72)); ctx.restore();
}
// 80s cel anime's subtitle style: semi-condensed sans, cream-yellow, thick dark outline, soft shadow
function tapeSub(t) {
  const s = subs.find(s => t >= s.t0 && t < s.t1); if (!s) return;
  ctx.save(); ctx.font = '700 76px "Barlow SC"'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  const rows = wrap2(s.text, 960);
  rows.forEach((r, i) => { const y = 1660 - (rows.length - 1 - i) * 86; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10; ctx.strokeStyle = '#140a24'; ctx.lineWidth = 12; ctx.strokeText(r, 540, y); ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff3b0'; ctx.fillText(r, 540, y); });
  ctx.restore();
}
function render(t) {
  const st = styleAt(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  if (st === 'cel-anime-80s') { const glc = an.render(t); ctx.drawImage(glc, 0, 0); tapeSub(t); }
  else {
    wb.render(bctx, t);
    ctx.setTransform(0, 1, -1, 0, 1080, 0); ctx.drawImage(buf, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0);   // the board, turned upright
    plate(t);
  }
  // a 3-frame white flash on every cut into the anime tape (the impact grammar of the era)
  const c = (TL.chapters || []).find(c => c.style === 'cel-anime-80s' && t >= c.t0 && t < c.t0 + 3 / 30);
  if (c && c.t0 > .2) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, 0, 1080, 1920); }
}
window.DUR = TL.dur; window.EV = wb.ev.filter(e => styleAt(e.t) === 'whiteboard');
window.render = render;
window.READY = true;
