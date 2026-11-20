// AutoTube Studio page for EVERY video (THEMES.md): each chapter is drawn by a Lemo Opuscar library theme, nothing else.
//   whiteboard     → Whiteboard Explainer (styles/whiteboard engine wb.js)
//   cel-anime-80s  → 80s Cel Anime (styles/cel-anime-80s modules + its CRT tape pass)
// Long videos are 1920x1080, Shorts 1080x1920. This file only picks the current chapter's theme and puts that theme's own
// subtitle style on top. Claude provides the content (narration, notes, formulas, diagrams, quizzes); the look is the library's.
window.HS_NO_AUTORUN = true;
const TL = window.TL, VERT = (TL.meta && TL.meta.format) === 'short', W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
const used = new Set((TL.chapters || []).map(c => c.style));
const WB = used.has('whiteboard') ? await import('./whiteboard.js') : null;
const AN = TL.shots.some(x => x.type === 'anime') ? await import('./anime.js') : null;
// this video's directed scenes (lib/v2/director.js): written for this video with each theme's own tools
let SCN = { default: {}, subtitles: {} }; try { SCN = await import('./scenes.js'); } catch (err) { console.error('scenes.js: ' + err); }
const SCENES = SCN.default || {}, SUBS = SCN.subtitles || {}, sceneShots = TL.shots.filter(x => x.type === 'scene');
const IMGS = {}; await Promise.all([...new Set(sceneShots.map(x => x.img).filter(Boolean))].map(id => new Promise(res => { const im = new Image(); im.onload = () => { IMGS[id] = im; res(); }; im.onerror = () => { if (im.src.endsWith('.jpg')) im.src = 'img/' + id + '.png'; else res(); }; im.src = 'img/' + id + '.jpg'; })));
const mouthAt = t => { const m = (TL.mouth || []).find(x => t >= x[0] && t < x[1]); return m ? ({ A: 'closed', B: 'talk', C: 'talk', D: 'smileopen', E: 'oh', F: 'oh', G: 'talk', H: 'talk' })[m[2]] || null : null; };
const wb = WB ? await WB.build({ vertical: VERT, only: 'whiteboard' }) : null;
const an = AN ? await AN.build({ vertical: VERT }) : null;
await document.fonts.load('48px AD'); try { await document.fonts.load('700 60px "Barlow SC"'); } catch { }

const cv = document.getElementById('c'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
const buf = new OffscreenCanvas(1920, 1080), bctx = buf.getContext('2d');
const styleAt = t => { const C = TL.chapters || []; const c = C.find(c => t >= c.t0 && t < c.t1) || C[C.length - 1]; return c ? c.style : 'whiteboard'; };
const subs = (TL.phrases || []).map(p => ({ t0: p.s - .05, t1: p.e + .25, text: p.w.map(w => w.w).join(' ') }));
for (let i = 0; i < subs.length - 1; i++) subs[i].t1 = Math.min(Math.max(subs[i].t1, subs[i].t0 + 1), subs[i + 1].t0 - .04);
const noSubs = new URLSearchParams(location.search).has('nosubs') || (TL.captionLook || {}).style === 'off';   // the editor can turn subtitles off

function wrap2(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return [text];
  const ws = text.split(' '); let best = 1, bd = 1e9;
  for (let i = 1; i < ws.length; i++) { const d = Math.abs(ctx.measureText(ws.slice(0, i).join(' ')).width - ctx.measureText(ws.slice(i).join(' ')).width); if (d < bd) { bd = d; best = i; } }
  return [ws.slice(0, best).join(' '), ws.slice(best).join(' ')];
}
// Whiteboard Explainer's subtitle plate (cream plate, Architects Daughter, orange tick), sized for the format
function plate(t) {
  const s = subs.find(s => t >= s.t0 && t < s.t1); if (!s) return;
  const fs = VERT ? 64 : 44, lh = VERT ? 72 : 52, cy = VERT ? 1660 : 1038;
  const a = Math.min(1, (t - s.t0) / .12, (s.t1 - t) / .12); ctx.save(); ctx.font = `${fs}px AD`;
  const rows = wrap2(s.text, VERT ? 940 : 1250), w = Math.max(...rows.map(r => ctx.measureText(r).width)) + 64, h = fs + 28 + (rows.length - 1) * lh, y0 = cy - h;
  ctx.globalAlpha = a * .92; ctx.fillStyle = '#fdfcf8'; ctx.shadowColor = 'rgba(30,30,40,.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
  ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y0, w, h, 14); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.globalAlpha = a;
  ctx.fillStyle = '#d97757'; ctx.fillRect(W / 2 - w / 2 + 22, y0 + h - 12, 36, 4);
  ctx.fillStyle = '#23262c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; rows.forEach((r, i) => ctx.fillText(r, W / 2, y0 + (fs + 28) / 2 + i * lh)); ctx.restore();
}
// 80s Cel Anime's subtitle style (STYLE.md §4): semi-condensed sans, cream-yellow, thick dark outline, soft shadow, ~96 px up
function tapeSub(t) {
  const s = subs.find(s => t >= s.t0 && t < s.t1); if (!s) return;
  const fs = VERT ? 76 : 54, lh = VERT ? 86 : 64, base = VERT ? 1660 : H - 96;
  ctx.save(); ctx.font = `700 ${fs}px "Barlow SC"`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  const rows = wrap2(s.text, VERT ? 960 : 1500);
  rows.forEach((r, i) => { const y = base - (rows.length - 1 - i) * lh; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10; ctx.strokeStyle = '#140a24'; ctx.lineWidth = fs * .16; ctx.strokeText(r, W / 2, y); ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff3b0'; ctx.fillText(r, W / 2, y); });
  ctx.restore();
}
function sceneAt(t) { let i = -1; for (let k = 0; k < sceneShots.length; k++) if (sceneShots[k].t <= t) i = k; if (i < 0) return null; const s = sceneShots[i], nx = TL.shots.find(x => x.t > s.t); return { s, i, end: nx ? nx.t : TL.dur }; }
// a character video's on-camera lines (lib/character/clips.js): each clip as frames, full screen; nothing else plays over it
const CLIPS = TL.characters || [], FRAMES = new Map();
async function characterAt(t) {
  const clip = CLIPS.find(c => t >= c.t0 && t < c.t1); if (!clip) return null;
  const n = Math.max(1, Math.min(clip.frames, 1 + Math.floor((t - clip.t0) * clip.fps))), src = `${clip.dir}/f${String(n).padStart(5, '0')}.jpg`;
  let frame = FRAMES.get(src);
  if (!frame) { frame = new Image(); frame.src = src; try { await frame.decode(); } catch { } FRAMES.set(src, frame); if (FRAMES.size > 60) FRAMES.delete(FRAMES.keys().next().value); }
  return { clip, frame };
}
function drawCover(im) { const r = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r; ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); }
// character videos (TL.characters): word-by-word captions on every shot. 2-3 big words at a time; the word being said is
// yellow and pops a little larger. Timing comes from the caption words (TL.phrases).
// The editor's caption look (TL.captionLook): style word | phrase (no highlight) | off, position low | middle | high, size m | l | xl
const CHARACTER_VIDEO = !!TL.characters;
const LOOK = TL.captionLook || {};
const CAPTION_Y = { low: .78, middle: .6, high: .22 }, CAPTION_SIZE = { m: 1, l: 1.2, xl: 1.4 };
function wordCaption(t) {
  const P = TL.phrases || [], i = P.findIndex((p, k) => t >= p.s - .05 && t < (P[k + 1] ? Math.min(P[k + 1].s - .02, p.e + .4) : p.e + .4)); if (i < 0) return;
  const words = P[i].w.map(w => ({ ...w, text: String(w.w).toUpperCase() })), fs = (VERT ? 84 : 62) * (CAPTION_SIZE[LOOK.size] || 1), gap = fs * .3;
  const base = LOOK.position && CAPTION_Y[LOOK.position] ? H * CAPTION_Y[LOOK.position] : (VERT ? 1500 : H - 130), highlight = LOOK.style !== 'phrase';
  ctx.save(); ctx.font = `800 ${fs}px "Barlow SC", Inter, sans-serif`; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  const widths = words.map(w => ctx.measureText(w.text).width), total = widths.reduce((x, y) => x + y, 0) + gap * (words.length - 1);
  let x = W / 2 - total / 2;
  words.forEach((w, k) => {
    const on = highlight && t >= w.s - .03 && t < w.e + .05, pop = on ? 1 + .14 * Math.min(1, (t - w.s + .03) / .08) : 1, cx = x + widths[k] / 2;
    ctx.save(); ctx.translate(cx, base); ctx.scale(pop, pop); ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14; ctx.strokeStyle = '#000'; ctx.lineWidth = fs * .2; ctx.strokeText(w.text, 0, 0);
    ctx.shadowColor = 'transparent'; ctx.fillStyle = on ? '#FFD400' : '#fff'; ctx.fillText(w.text, 0, 0); ctx.restore();
    x += widths[k] + gap;
  });
  ctx.restore();
}
// a character's clip, cover-filled; a quick punch-in on the line's key word (held to the end of the line)
function drawClip(c, im, t) {
  const z = c.punch == null || t < c.punch ? 1 : 1 + .1 * Math.min(1, (t - c.punch) / .12);
  ctx.save(); ctx.translate(W / 2, H * .42); ctx.scale(z, z); ctx.translate(-W / 2, -H * .42); drawCover(im); ctx.restore();
}
function subtitle(t, st) { const sub = SUBS[st], cue = subs.find(c => t >= c.t0 && t < c.t1); if (sub && cue && !noSubs) { ctx.save(); sub(ctx, cue, { t, W, H, VERT }); ctx.restore(); } }
async function render(t) {
  const st = styleAt(t), live = await characterAt(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  if (live) { drawClip(live.clip, live.frame, t); if (!noSubs) wordCaption(t); return; }
  const cur = TL.shots.filter(x => x.t <= t).pop();
  if (cur && cur.type === 'scene') {
    const a = sceneAt(t), fn = a && SCENES['s' + a.i];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (fn) { ctx.save(); fn({ t, lt: t - a.s.t, d: a.end - a.s.t, u: (t - a.s.t) / Math.max(.01, a.end - a.s.t), g: ctx, W, H, VERT, shot: a.s, img: id => IMGS[id] || null, mouthAt }); ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; }
    if (CHARACTER_VIDEO) { if (!noSubs) wordCaption(t); } else subtitle(t, st);
  }
  else if (st === 'cel-anime-80s' && an) { ctx.drawImage(an.render(t), 0, 0); if (!noSubs) tapeSub(t); }
  else if (wb) {
    if (VERT) { wb.render(bctx, t); ctx.setTransform(0, 1, -1, 0, 1080, 0); ctx.drawImage(buf, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); if (!noSubs) plate(t); }
    else wb.render(ctx, t);   // landscape: the whiteboard draws its own subtitle plate
  }
  // the era's impact grammar on each cut into the anime tape: a 3-frame white flash
  const c = (TL.chapters || []).find(c => c.style === 'cel-anime-80s' && t >= c.t0 && t < c.t0 + 3 / 30);
  if (c && c.t0 > .2) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, 0, W, H); }
}
window.DUR = TL.dur; window.EV = wb ? wb.ev.filter(e => styleAt(e.t) === 'whiteboard') : [];
window.render = render;
window.READY = true;
