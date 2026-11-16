// Desi Toon sets: flat-vector Indian places, drawn in code for a W x H frame (made for 1080x1920 portrait).
// Flat colour bands instead of gradients; glow only for real light sources (bulbs, moon, screens).
import { shade, rgba, hash, clamp } from './pal.js';
const TAU = Math.PI * 2;
function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function glow(g, x, y, r, c, a = .5) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }

// a strand of string lights between two points, sagging, twinkling
export function stringLights(g, x0, y0, x1, y1, sag, n, t, colors = ['#FFD36B', '#FF8A5C', '#FFF1B8']) {
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1); g.lineWidth = 3; g.strokeStyle = 'rgba(30,20,20,.7)'; g.stroke();
  for (let i = 1; i < n; i++) {
    const k = i / n, x = (1 - k) ** 2 * x0 + 2 * (1 - k) * k * (x0 + x1) / 2 + k * k * x1, y = (1 - k) ** 2 * y0 + 2 * (1 - k) * k * (Math.max(y0, y1) + sag) + k * k * y1;
    const c = colors[i % colors.length], tw = .6 + .4 * Math.sin(t * 3 + i * 1.7);
    glow(g, x, y + 8, 26, c, .35 * tw); ell(g, x, y + 8, 7, 9); g.fillStyle = c; g.fill();
  }
}
// marigold garland hanging straight down, swaying a little
export function marigold(g, x, y0, len, t, seed = 0) {
  const sw = Math.sin(t * 1.4 + seed) * 6;
  for (let i = 0; i < len; i++) { const k = i / len, x1 = x + sw * k * k; ell(g, x1, y0 + i * 26, 15, 14); g.fillStyle = i % 2 ? '#F59E0B' : '#FCC419'; g.fill(); ell(g, x1 - 4, y0 + i * 26 - 4, 5, 4); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill(); }
  ell(g, x + sw, y0 + len * 26, 10, 14); g.fillStyle = '#E8590C'; g.fill();
}

// --- the sangeet hall: warm drapes, marigold strings, fairy lights, dancing guests in the back ---
export function hall(g, W, H, t, o = {}) {
  g.fillStyle = '#4A1733'; g.fillRect(0, 0, W, H);
  // drapes
  for (let i = 0; i < 9; i++) { const x = i * W / 8; g.fillStyle = i % 2 ? '#5E1D40' : '#541A3A'; g.beginPath(); g.moveTo(x - 80, 0); g.quadraticCurveTo(x, H * .5, x - 60, H * .72); g.lineTo(x + 70, H * .72); g.quadraticCurveTo(x + 10, H * .5, x + 80, 0); g.fill(); }
  // marigold curtain at the top
  for (let i = 0; i < 12; i++) marigold(g, 40 + i * (W - 80) / 11, -10, 6 + (i % 3) * 3, t, i);
  stringLights(g, -20, 120, W + 20, 160, 160, 16, t);
  stringLights(g, -20, 330, W + 20, 300, 120, 14, t + 1, ['#FFE08A', '#FFB4C8', '#FFFFFF']);
  // floor
  g.fillStyle = '#2B0F1F'; g.fillRect(0, H * .72, W, H * .28);
  g.fillStyle = '#35142A'; for (let i = 0; i < 6; i++) g.fillRect(0, H * .72 + i * 90, W, 40);
  // dancing guests in silhouette (bobbing to the beat)
  if (o.crowd !== false) for (let i = 0; i < 7; i++) {
    const x = 60 + i * 165 + (i % 2) * 30, b = Math.abs(Math.sin(t * 4.2 + i)) * 22, y = H * .62 - b, c = ['#6E2550', '#7A2B5A', '#622047'][i % 3];
    ell(g, x, y - 120, 42, 50); g.fillStyle = c; g.fill();
    g.beginPath(); g.moveTo(x - 70, H * .76); g.quadraticCurveTo(x - 66, y - 60, x, y - 66); g.quadraticCurveTo(x + 66, y - 60, x + 70, H * .76); g.fill();
    const a = Math.sin(t * 4.2 + i) * .6; g.lineWidth = 26; g.lineCap = 'round'; g.strokeStyle = c;
    g.beginPath(); g.moveTo(x + 40, y - 30); g.lineTo(x + 40 + Math.cos(-1.2 + a) * 90, y - 30 + Math.sin(-1.2 + a) * 90); g.stroke();
    g.beginPath(); g.moveTo(x - 40, y - 30); g.lineTo(x - 40 - Math.cos(-1.2 - a) * 90, y - 30 + Math.sin(-1.2 - a) * 90); g.stroke();
  }
  // warm wash
  if (o.dim) { g.fillStyle = rgba('#0b0610', o.dim); g.fillRect(0, 0, W, H); }
}

// --- night terrace: sky bands, moon, skyline with lit windows, railing with fairy lights ---
export function terrace(g, W, H, t, o = {}) {
  const bands = ['#0E1233', '#141A44', '#1B2352', '#232C5E'];
  bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * H * .16, W, H * .16 + 2); });
  g.fillStyle = '#2A3366'; g.fillRect(0, H * .64, W, H * .1);
  for (let i = 0; i < 40; i++) { const x = hash(i) * W, y = hash(i + 50) * H * .5, tw = .4 + .6 * Math.abs(Math.sin(t * 1.5 + i)); ell(g, x, y, 2.5, 2.5); g.fillStyle = rgba('#ffffff', .8 * tw); g.fill(); }
  const mx = o.moonX ?? W * .76, my = H * .14; glow(g, mx, my, 220, '#FFF4D6', .22); ell(g, mx, my, 70, 70); g.fillStyle = '#FFF4D6'; g.fill();
  ell(g, mx - 20, my - 12, 14, 12); g.fillStyle = '#F1E4C2'; g.fill(); ell(g, mx + 22, my + 18, 10, 9); g.fill();
  // skyline
  for (let i = 0; i < 12; i++) {
    const w = 80 + hash(i + 7) * 110, x = i * 100 - 40, h = 200 + hash(i + 3) * 380, y = H * .7 - h;
    g.fillStyle = i % 2 ? '#0B0F2A' : '#10153A'; g.fillRect(x, y, w, h + 10);
    for (let r = 0; r < 12; r++) for (let c = 0; c < 4; c++) if (hash(i * 97 + r * 13 + c) > .62 && y + 30 + r * 46 < H * .69) { g.fillStyle = hash(i + r + c * 3) > .5 ? '#FFD36B' : '#FFB86B'; g.fillRect(x + 14 + c * (w - 28) / 4, y + 30 + r * 46, 14, 20); }
  }
  // terrace floor and parapet
  g.fillStyle = '#3A3550'; g.fillRect(0, H * .7, W, H * .3);
  g.fillStyle = '#4A4466'; g.fillRect(0, H * .7, W, 60);
  g.fillStyle = '#58517A'; for (let x = 20; x < W; x += 140) g.fillRect(x, H * .7 - 130, 26, 140);
  g.fillRect(0, H * .7 - 140, W, 22);
  stringLights(g, -20, H * .7 - 150, W + 20, H * .7 - 140, 70, 13, t);
  // potted plant
  if (o.plant !== false) { const px = W * .1, py = H * .78; g.fillStyle = '#B5562E'; g.beginPath(); g.moveTo(px - 60, py); g.lineTo(px + 60, py); g.lineTo(px + 44, py + 110); g.lineTo(px - 44, py + 110); g.fill();
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .35 + Math.sin(t * 1.2 + i) * .04; g.save(); g.translate(px, py); g.rotate(a + Math.PI / 2); ell(g, 0, -80, 22, 80); g.fillStyle = i % 2 ? '#2F7D4A' : '#3A9159'; g.fill(); g.restore(); } }
  if (o.dim) { g.fillStyle = rgba('#05060f', o.dim); g.fillRect(0, 0, W, H); }
}

// --- inside, the stairwell door opening onto the moonlit terrace ---
export function doorway(g, W, H, t, open = 1) {
  g.fillStyle = '#2B2238'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#332944'; for (let y = 0; y < H; y += 120) g.fillRect(0, y, W, 60);
  const dx = W * .25, dw = W * .5, dy = H * .18, dh = H * .6;
  g.fillStyle = '#1A1428'; g.fillRect(dx - 30, dy - 30, dw + 60, dh + 30);
  g.save(); g.beginPath(); g.rect(dx, dy, dw, dh); g.clip(); terrace(g, W, H, t, { plant: false, moonX: W * .6 }); g.restore();
  // the door leaf swinging open
  g.fillStyle = '#5B3A2A'; g.fillRect(dx, dy, dw * (1 - open * .82), dh);
  // moonlight spilling on the floor
  g.fillStyle = rgba('#AFC3FF', .16); g.beginPath(); g.moveTo(dx, dy + dh); g.lineTo(dx + dw, dy + dh); g.lineTo(dx + dw + 240, H); g.lineTo(dx - 240, H); g.fill();
}

// --- a phone in the hand, showing a video call; draw(g, x, y, w, h) paints the caller inside the screen ---
export function phone(g, cx, cy, w, h, t, drawCaller, o = {}) {
  g.save();
  g.translate(cx, cy); if (o.tilt) g.rotate(o.tilt);
  glow(g, 0, 0, w * 1.2, '#9FC3FF', .28);
  g.beginPath(); g.roundRect(-w / 2 - 18, -h / 2 - 18, w + 36, h + 36, 60); g.fillStyle = '#16151C'; g.fill();
  g.save(); g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 44); g.clip();
  drawCaller(g, -w / 2, -h / 2, w, h);
  // call UI
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-w / 2, -h / 2, w, 120);
  g.fillStyle = '#fff'; g.font = '700 40px Inter'; g.textAlign = 'center'; g.fillText(o.name || 'Video call', 0, -h / 2 + 70);
  g.font = '500 28px Inter'; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(o.time || '12:41', 0, -h / 2 + 106);
  g.beginPath(); g.roundRect(w / 2 - 190, h / 2 - 330, 160, 220, 22); g.fillStyle = '#2B2F45'; g.fill();
  if (o.self) { g.save(); g.beginPath(); g.roundRect(w / 2 - 190, h / 2 - 330, 160, 220, 22); g.clip(); o.self(g, w / 2 - 190, h / 2 - 330, 160, 220); g.restore(); }
  ell(g, 0, h / 2 - 80, 46, 46); g.fillStyle = '#E5383B'; g.fill();
  g.save(); g.translate(0, h / 2 - 80); g.rotate(2.3); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-24, -9, 48, 18, 9); g.fill(); g.restore();
  g.restore();
  g.beginPath(); g.roundRect(-60, -h / 2 + 12, 120, 26, 13); g.fillStyle = '#16151C'; g.fill();
  g.restore();
}
// a cosy room behind the caller (her side of the call)
export function room(g, x, y, w, h, t) {
  g.fillStyle = '#3E3358'; g.fillRect(x, y, w, h);
  g.fillStyle = '#4A3E68'; g.fillRect(x, y + h * .62, w, h * .38);
  stringLights(g, x - 10, y + h * .12, x + w + 10, y + h * .1, 50, 9, t, ['#FFE08A', '#FFC3A0']);
  g.fillStyle = '#6E5AA0'; g.fillRect(x + w * .62, y + h * .2, w * .26, h * .2);
  g.fillStyle = '#F4A8C8'; ell(g, x + w * .75, y + h * .3, w * .06, w * .06); g.fill();
}

// --- close-up of a hand dropping a glass of juice onto the tiles; k = 0..1 through the fall, then it shatters ---
export function glassDrop(g, W, H, t, k, sk = '#C98B5E', sleeve = '#1F7A68') {
  g.fillStyle = '#3A3550'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#433D5E'; for (let i = 0; i < 8; i++) for (let j = 0; j < 14; j++) if ((i + j) % 2) g.fillRect(i * 140, j * 140 + H * .2, 140, 140);
  g.fillStyle = '#58517A'; g.fillRect(0, H * .2 - 60, W, 60);
  // the hand, fingers opening
  const hx = W * .62, hy = H * .2 + 60;
  g.lineCap = 'round'; g.lineWidth = 110; g.strokeStyle = sleeve; g.beginPath(); g.moveTo(W + 60, hy - 120); g.lineTo(hx + 120, hy - 10); g.stroke();
  ell(g, hx, hy, 80, 70); g.fillStyle = sk; g.fill();
  for (let i = 0; i < 4; i++) { const a = 1.9 + i * .28 + clamp(k * 3) * .5; g.lineWidth = 34; g.strokeStyle = sk; g.beginPath(); g.moveTo(hx - 20, hy + 10); g.lineTo(hx - 20 + Math.cos(a) * 110, hy + 10 + Math.sin(a) * 110); g.stroke(); }
  const fall = clamp(k / .75), gy = hy + 60 + fall * fall * (H * .78 - hy - 60), floor = H * .82;
  if (k < .75) {
    g.save(); g.translate(hx - 40, gy); g.rotate(fall * 1.6);
    g.beginPath(); g.moveTo(-50, -90); g.lineTo(50, -90); g.lineTo(38, 90); g.lineTo(-38, 90); g.closePath(); g.fillStyle = 'rgba(220,240,255,.45)'; g.fill();
    g.beginPath(); g.moveTo(-46, -40); g.lineTo(46, -40); g.lineTo(38, 90); g.lineTo(-38, 90); g.closePath(); g.fillStyle = '#F29A2E'; g.fill();
    for (let i = 0; i < 6; i++) { ell(g, Math.sin(i * 2 + t * 10) * 50, -110 - i * 26 * fall, 8, 10); g.fillStyle = '#F29A2E'; g.fill(); }
    g.restore();
  } else {   // shatter: a splash and flying shards
    const s = clamp((k - .75) / .25);
    ell(g, hx - 40, floor + 30, 120 + s * 260, 40 + s * 60); g.fillStyle = '#E8892A'; g.fill();
    for (let i = 0; i < 16; i++) { const a = -Math.PI * hash(i), r = s * (180 + hash(i + 9) * 340); g.save(); g.translate(hx - 40 + Math.cos(a) * r, floor + Math.sin(a) * r * .6); g.rotate(i + s * 6); g.beginPath(); g.moveTo(0, -22); g.lineTo(14, 12); g.lineTo(-12, 16); g.closePath(); g.fillStyle = 'rgba(225,245,255,.85)'; g.fill(); g.restore(); }
    for (let i = 0; i < 10; i++) { const a = -Math.PI * hash(i + 30), r = s * (100 + hash(i + 40) * 260); ell(g, hx - 40 + Math.cos(a) * r, floor + Math.sin(a) * r * .5 - s * 40, 12, 12); g.fillStyle = '#F29A2E'; g.fill(); }
  }
}
