// Comic Book theme kit (AutoTube Studio's own theme; see ../STYLE.md). Canvas 2D only, deterministic.
// Import in a scenes module as './stheme/comic-book/comic.js'.
// Fonts: Bangers (titles / sound effects) and Comic Neue Bold (balloons, captions), both SIL OFL (fonts/OFL-*.txt).

const FONT_URL = n => new URL('./fonts/' + n, import.meta.url).href;
try {
  const fs = [new FontFace('CB Bangers', `url(${FONT_URL('Bangers-Regular.ttf')})`), new FontFace('CB Neue', `url(${FONT_URL('ComicNeue-Bold.ttf')})`, { weight: '700' })];
  await Promise.all(fs.map(f => f.load().then(x => document.fonts.add(x))));
} catch (e) { console.warn('comic fonts: ' + e); }
export const FONT = { title: "'CB Bangers', Impact, sans-serif", text: "'CB Neue', 'Comic Sans MS', sans-serif" };

// ---- colour: flat print inks only ----
export const PAL = {
  paper: '#F3E9D2', paperDark: '#E4D5B5', ink: '#141210',
  red: '#E23B2E', yellow: '#FFD23A', cyan: '#2BB3E0', blue: '#1F4FA8', green: '#3DA35D', orange: '#F28C28', purple: '#7B4FA8',
  skin: ['#F4C9A0', '#E0A877', '#C98B5E', '#9E6640', '#6E4329'], hair: ['#141210', '#4A2A1A', '#C9A14A', '#B9B3AE'],
  sky: '#8FD3F0', night: '#1E2A5A', white: '#FFFDF6',
};

// ---- deterministic helpers ----
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = k => (k = clamp(k), k < .5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const easeOut = k => 1 - (1 - clamp(k)) ** 3;
export const back = k => { k = clamp(k); const c = 1.70158; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// comics read pose to pose: hold, then snap (k goes 0..1 in steps with a short eased move between)
// pose(t, [t0, t1, ...]) -> { i: current pose index, k: 0..1 snap into it }
export function pose(t, times) { let i = 0; while (i < times.length - 1 && t >= times[i + 1]) i++; return { i, k: easeOut((t - times[i]) / .22) }; }

// ---- paper ----
const _paper = new Map();
export function paper(g, W, H, seed = 1) {
  const key = W + 'x' + H + ':' + seed;
  if (!_paper.has(key)) {
    const c = new OffscreenCanvas(W, H), x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = PAL.paper; x.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 900; i++) { x.fillStyle = `rgba(120,90,40,${.03 + r() * .05})`; x.fillRect(r() * W, r() * H, 1 + r() * 3, 1); }
    for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(110,80,40,${.03 + r() * .04})`; x.lineWidth = 1; x.beginPath(); const y = r() * H; x.moveTo(r() * W, y); x.lineTo(r() * W, y + (r() - .5) * 30); x.stroke(); }
    _paper.set(key, c);
  }
  g.drawImage(_paper.get(key), 0, 0);
}

// ---- Ben-Day dots: fill a path (callback draws the path) with a dot screen ----
const _dots = new Map();
function dotTile(color, size, gap) {
  const key = color + size + ':' + gap;
  if (!_dots.has(key)) {
    const s = gap, c = new OffscreenCanvas(s * 2, s * 2), x = c.getContext('2d'); x.fillStyle = color;
    for (const [px, py] of [[0, 0], [s, s], [s * 2, 0], [0, s * 2], [s * 2, s * 2]]) { x.beginPath(); x.arc(px, py, size / 2, 0, Math.PI * 2); x.fill(); }
    _dots.set(key, c);
  }
  return _dots.get(key);
}
export function dots(g, pathFn, color = PAL.ink, size = 8, gap = 14, alpha = .5) {
  g.save(); g.beginPath(); pathFn(g); g.clip(); g.globalAlpha = alpha;
  const p = g.createPattern(dotTile(color, size, gap), 'repeat'); g.fillStyle = p; g.fillRect(-4000, -4000, 8000, 8000); g.restore();
}

// ---- ink: fill + thick outline (fill first, then ink on top, offset to look printed) ----
export function ink(g, pathFn, fill, w = 6, { shade = null, shadeColor = PAL.ink, misreg = 2.5 } = {}) {
  if (fill) { g.save(); g.translate(misreg, misreg * .6); g.beginPath(); pathFn(g); g.fillStyle = fill; g.fill(); g.restore(); }
  if (shade) dots(g, shade, shadeColor, 7, 13, .45);
  g.save(); g.beginPath(); pathFn(g); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = PAL.ink; g.lineWidth = w; g.stroke(); g.restore();
}

// ---- panels ----
// panel(g, x, y, w, h, drawFn, {border, bg}) clips drawFn to the panel and draws the black border on top.
export function panel(g, x, y, w, h, drawFn, { border = 10, bg = PAL.white, tilt = 0, k = 1 } = {}) {
  if (k <= 0) return;
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(tilt); const s = lerp(.9, 1, easeOut(k)); g.scale(s, s); g.globalAlpha = clamp(k * 2.5);
  g.translate(-w / 2, -h / 2);
  g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip(); g.fillStyle = bg; g.fillRect(0, 0, w, h); drawFn(g, w, h); g.restore();
  g.lineWidth = border; g.strokeStyle = PAL.ink; g.strokeRect(0, 0, w, h);
  g.restore();
}
// a simple layout: rows of panels inside a margin. rows = [[1],[0.6,0.4]] (widths per row). Returns rects.
export function layout(W, H, rows, { m = 36, gut = 22, heights = null } = {}) {
  const out = [], hs = heights || rows.map(() => 1 / rows.length); let y = m; const ih = H - 2 * m - gut * (rows.length - 1);
  rows.forEach((row, ri) => { const rh = ih * hs[ri], iw = W - 2 * m - gut * (row.length - 1); let x = m; for (const f of row) { out.push({ x, y, w: iw * f, h: rh }); x += iw * f + gut; } y += rh + gut; });
  return out;
}

// ---- speed lines (radial burst or parallel) ----
export function speed(g, cx, cy, w, h, { radial = true, n = 48, color = PAL.ink, seed = 3, angle = 0, inner = .35 } = {}) {
  const r = rng(seed); g.save(); g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    if (radial) { const a = (i / n) * Math.PI * 2 + r() * .08, R = Math.hypot(w, h), r0 = R * (inner + r() * .15), wd = .012 + r() * .02;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R); g.lineTo(cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R); g.fill(); }
    else { const y = cy - h / 2 + r() * h, l = w * (.3 + r() * .6), x = cx - w / 2 + r() * (w - l); g.save(); g.translate(cx, cy); g.rotate(angle); g.translate(-cx, -cy); g.fillRect(x, y, l, 2 + r() * 4); g.restore(); }
  }
  g.restore();
}

// ---- lettering ----
function wrap(g, text, maxW) { const words = String(text).toUpperCase().split(/\s+/), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
// speech balloon with a tail pointing at (tx, ty). kind: 'speech' | 'thought' | 'shout'. k = 0..1 pop-in.
export function balloon(g, x, y, text, tx, ty, { size = 40, maxW = 520, kind = 'speech', k = 1 } = {}) {
  if (k <= 0) return;
  g.save(); g.font = `700 ${size}px ${FONT.text}`; const lines = wrap(g, text, maxW), lh = size * 1.12;
  const w = Math.max(...lines.map(l => g.measureText(l).width)) + size * 1.4, h = lines.length * lh + size * 1.0;
  const s = back(k); g.translate(x, y); g.scale(s, s);
  const draw = c => {
    if (kind === 'thought') { const n = 12; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; c.moveTo(Math.cos(a) * w * .55 + w * .1, Math.sin(a) * h * .6); c.arc(Math.cos(a) * w * .5, Math.sin(a) * h * .55, h * .28, 0, Math.PI * 2); } }
    else if (kind === 'shout') { const n = 18; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, R = i % 2 ? 1.18 : .95; const px = Math.cos(a) * w * .58 * R, py = Math.sin(a) * h * .62 * R; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
    else c.ellipse(0, 0, w * .58, h * .62, 0, 0, Math.PI * 2);
  };
  // tail
  const ax = (tx - x) / s, ay = (ty - y) / s, d = Math.hypot(ax, ay) || 1, nx = -ay / d, ny = ax / d;
  if (kind === 'thought') { for (let i = 1; i <= 3; i++) { const f = .5 + i * .14, r = h * (.12 - i * .025); g.beginPath(); g.arc(ax * f * .7, ay * f * .7, r, 0, Math.PI * 2); g.fillStyle = PAL.white; g.fill(); g.lineWidth = 4; g.strokeStyle = PAL.ink; g.stroke(); } }
  else { g.beginPath(); g.moveTo(nx * w * .12, ny * w * .12); g.lineTo(ax * .8, ay * .8); g.lineTo(-nx * w * .04, -ny * w * .04); g.closePath(); g.fillStyle = PAL.white; g.fill(); g.lineWidth = 5; g.strokeStyle = PAL.ink; g.stroke(); }
  g.beginPath(); draw(g); g.fillStyle = PAL.white; g.fill(); g.lineWidth = 5; g.strokeStyle = PAL.ink; g.stroke();
  if (kind !== 'thought') { g.beginPath(); g.moveTo(nx * w * .1, ny * w * .1); g.lineTo(-nx * w * .02, -ny * w * .02); g.lineWidth = 8; g.strokeStyle = PAL.white; g.stroke(); }
  g.fillStyle = PAL.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
  g.restore();
}
// yellow narration box (top-left of a panel). k = 0..1 slide-in.
export function caption(g, x, y, text, { size = 34, maxW = 640, color = PAL.yellow, k = 1 } = {}) {
  if (k <= 0) return;
  g.save(); g.font = `700 ${size}px ${FONT.text}`; const lines = wrap(g, text, maxW), lh = size * 1.15, pad = size * .5;
  const w = Math.max(...lines.map(l => g.measureText(l).width)) + pad * 2, h = lines.length * lh + pad * 1.4;
  g.translate(x - (1 - easeOut(k)) * 60, y); g.globalAlpha = clamp(k * 3);
  g.fillStyle = PAL.ink; g.fillRect(6, 6, w, h); g.fillStyle = color; g.fillRect(0, 0, w, h); g.lineWidth = 4; g.strokeStyle = PAL.ink; g.strokeRect(0, 0, w, h);
  g.fillStyle = PAL.ink; g.textBaseline = 'top'; lines.forEach((l, i) => g.fillText(l, pad, pad * .7 + i * lh));
  g.restore(); return { w, h };
}
// sound effect word: thick outline, pop colour, tilted, pops in with overshoot
export function sfx(g, x, y, word, { size = 150, color = PAL.yellow, outline = PAL.red, tilt = -.12, k = 1 } = {}) {
  if (k <= 0) return;
  g.save(); g.translate(x, y); g.rotate(tilt); const s = back(k) * (1 + .04 * Math.sin(k * 20) * (1 - clamp(k))); g.scale(s, s);
  g.font = `${size}px ${FONT.title}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = size * .22; g.strokeStyle = PAL.ink; g.strokeText(word, 8, 8);
  g.lineWidth = size * .16; g.strokeStyle = outline; g.strokeText(word, 0, 0);
  g.fillStyle = color; g.fillText(word, 0, 0);
  g.restore();
}
// a sign / board / label inside the picture (for numbers, formulas, names)
export function sign(g, x, y, text, { size = 44, bg = PAL.white, fg = PAL.ink, tilt = 0, pad = 18 } = {}) {
  g.save(); g.translate(x, y); g.rotate(tilt); g.font = `${size}px ${FONT.title}`; const w = g.measureText(text).width + pad * 2, h = size * 1.25;
  ink(g, c => c.rect(-w / 2, -h / 2, w, h), bg, 5); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 3); g.restore();
}

// ---- simple original characters (bold comic shapes) ----
// person(g, x, y, s, opts): x,y = feet; s = height in px. opts: skin, hair, shirt, pants, mood ('happy'|'shock'|'angry'|'sad'|'think'), arm (-1..1 raise), look (-1..1), mouth (0..1 open), walk (phase)
export function person(g, x, y, s, o = {}) {
  const skin = o.skin || PAL.skin[1], hair = o.hair || PAL.hair[0], shirt = o.shirt || PAL.red, pants = o.pants || PAL.blue, mood = o.mood || 'happy';
  const u = s / 6, hx = x, hy = y - s + u * .95, lk = (o.look || 0) * u * .18, wp = o.walk || 0, sw = Math.sin(wp) * u * .35;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  // legs
  ink(g, c => { c.moveTo(x - u * .35, y - u * 2.4); c.lineTo(x - u * .35 + sw, y); c.lineTo(x - u * .05 + sw, y); c.lineTo(x, y - u * 2.2); c.lineTo(x + u * .05 - sw, y); c.lineTo(x + u * .35 - sw, y); c.lineTo(x + u * .35, y - u * 2.4); c.closePath(); }, pants, 5);
  // body
  ink(g, c => { c.moveTo(x - u * .7, y - u * 4.3); c.quadraticCurveTo(x, y - u * 4.6, x + u * .7, y - u * 4.3); c.lineTo(x + u * .55, y - u * 2.3); c.lineTo(x - u * .55, y - u * 2.3); c.closePath(); }, shirt, 6,
    { shade: c => { c.moveTo(x + u * .1, y - u * 4.4); c.lineTo(x + u * .7, y - u * 4.3); c.lineTo(x + u * .55, y - u * 2.3); c.lineTo(x + u * .1, y - u * 2.3); c.closePath(); } });
  // arms
  const arm = (side, raise) => { const sx = x + side * u * .65, sy = y - u * 4.1, a = side * (.25 + raise * 2.2), ex = sx + Math.sin(a) * u * 1.9, ey = sy + Math.cos(a) * u * 1.9 * (raise > .5 ? -1 : 1) * (raise > .5 ? .2 + (raise - .5) : 1);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.lineWidth = u * .42; g.strokeStyle = PAL.ink; g.stroke(); g.lineWidth = u * .28; g.strokeStyle = shirt; g.stroke();
    g.beginPath(); g.arc(ex, ey, u * .2, 0, Math.PI * 2); g.fillStyle = skin; g.fill(); g.lineWidth = 4; g.strokeStyle = PAL.ink; g.stroke(); };
  arm(-1, 0); arm(1, clamp(o.arm || 0, 0, 1));
  // head
  ink(g, c => c.ellipse(hx, hy, u * .78, u * .88, 0, 0, Math.PI * 2), skin, 6, { shade: c => c.ellipse(hx + u * .45, hy + u * .1, u * .45, u * .8, 0, 0, Math.PI * 2) });
  ink(g, c => { c.moveTo(hx - u * .8, hy - u * .1); c.quadraticCurveTo(hx - u * .9, hy - u * 1.1, hx, hy - u * .95); c.quadraticCurveTo(hx + u * .9, hy - u * 1.1, hx + u * .8, hy - u * .1); c.quadraticCurveTo(hx + u * .3, hy - u * .55, hx - u * .8, hy - u * .1); }, hair, 5);
  // face
  const ey = hy - u * .05, er = mood === 'shock' ? u * .17 : u * .13;
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(hx + sd * u * .3 + lk, ey, er, er * 1.25, 0, 0, Math.PI * 2); g.fillStyle = PAL.white; g.fill(); g.lineWidth = 3; g.strokeStyle = PAL.ink; g.stroke(); g.beginPath(); g.arc(hx + sd * u * .3 + lk * 1.6, ey + er * .15, er * .5, 0, Math.PI * 2); g.fillStyle = PAL.ink; g.fill();
    g.beginPath(); const by = ey - er * 1.7 - (mood === 'shock' ? u * .12 : 0); const tilt = mood === 'angry' ? sd * .25 : mood === 'sad' ? -sd * .2 : 0; g.moveTo(hx + sd * u * .12, by + tilt * u); g.lineTo(hx + sd * u * .48, by - tilt * u); g.lineWidth = 5; g.stroke(); }
  const mo = clamp(o.mouth ?? (mood === 'shock' ? .8 : 0)), my = hy + u * .45;
  g.beginPath(); if (mo > .15) { g.ellipse(hx + lk, my, u * .2, u * .1 + mo * u * .18, 0, 0, Math.PI * 2); g.fillStyle = '#7A1F1F'; g.fill(); g.lineWidth = 4; g.strokeStyle = PAL.ink; g.stroke(); }
  else { const c = mood === 'sad' || mood === 'angry' ? -1 : 1; g.moveTo(hx - u * .25 + lk, my); g.quadraticCurveTo(hx + lk, my + c * u * .2, hx + u * .25 + lk, my); g.lineWidth = 5; g.strokeStyle = PAL.ink; g.stroke(); }
  if (mood === 'shock' || mood === 'think') { g.beginPath(); g.moveTo(hx + u * .85, hy - u * .5); g.quadraticCurveTo(hx + u * 1.05, hy - u * .2, hx + u * .9, hy - u * .05); g.quadraticCurveTo(hx + u * .75, hy - u * .2, hx + u * .85, hy - u * .5); g.fillStyle = PAL.cyan; g.fill(); g.lineWidth = 3; g.stroke(); }
  g.restore();
}

// ---- camera across the page ----
// camPan(g, W, H, from, to, k, fn): from/to = {x, y, z} page centre and zoom; fn draws the page in page coords
export function camPan(g, W, H, from, to, k, fn) {
  // the view never leaves the page (no black edges): zoom >= 1 and the centre is kept inside
  const e = ease(k), z = Math.max(1, lerp(from.z || 1, to.z || 1, e)), hw = W / 2 / z, hh = H / 2 / z;
  const cx = clamp(lerp(from.x, to.x, e), hw, W - hw), cy = clamp(lerp(from.y, to.y, e), hh, H - hh);
  g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-cx, -cy); fn(g); g.restore();
}
// page-turn wipe: draws `next` revealed by a curling edge moving right-to-left, k = 0..1
export function pageTurn(g, W, H, k, drawPrev, drawNext) {
  const e = ease(k), x = W * (1 - e);
  drawPrev(g);
  g.save(); g.beginPath(); g.rect(x, 0, W - x, H); g.clip(); drawNext(g); g.restore();
  if (k > 0 && k < 1) { const gr = g.createLinearGradient(x - 60, 0, x + 30, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.7, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 60, 0, 90, H); g.fillStyle = PAL.paperDark; g.fillRect(x - 6, 0, 6, H); }
}

// ---- print finish: tiny colour misregistration + paper tooth over the whole frame ----
export function print(g, W, H, seed = 7) {
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = .18; paper(g, W, H, seed); g.restore();
}

// ---- subtitles (STYLE.md §6) ----
export function subtitle(g, text, W, H, { size = null } = {}) {
  if (!text) return; const sz = size || Math.round(Math.min(W, H) * .045);
  g.save(); g.font = `700 ${sz}px ${FONT.text}`; const lines = wrap(g, text, W * .82).slice(0, 2), lh = sz * 1.2, pad = sz * .45;
  const w = Math.max(...lines.map(l => g.measureText(l).width)) + pad * 2, h = lines.length * lh + pad * 1.2, x = (W - w) / 2, y = H - (H > W ? 260 : 70) - h;
  g.fillStyle = PAL.ink; g.fillRect(x, y, w, h); g.fillStyle = PAL.yellow; g.textAlign = 'center'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, W / 2, y + pad * .6 + i * lh)); g.restore();
}
