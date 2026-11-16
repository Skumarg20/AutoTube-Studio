// Desi Toon on-screen text: bold captions with ONE yellow keyword, the A/B choice board with a countdown, the end card.
// Flat colours only (white / yellow / dark), a thick dark edge for reading over any scene; no gradients, chrome or neon.
import { TEXT, rgba, clamp, easeBack, easeOut } from './pal.js';
const TAU = Math.PI * 2;
const FONT = (px, w = 900) => `${w} ${px}px Inter, Arial, sans-serif`;

// split a line's timed words [[w, t0, t1], ...] into caption chunks of up to `max` words, breaking after punctuation
export function chunks(words, max = 3) {
  const out = []; let cur = [];
  for (const w of words) { cur.push(w); if (cur.length >= max || /[.,?!]['"]?$|\.\.\.$/.test(w[0])) { out.push(cur); cur = []; } }
  if (cur.length) out.push(cur);
  return out.map(c => ({ t0: c[0][1], t1: c[c.length - 1][2], words: c.map(x => x[0]) }));
}
const clean = w => w.replace(/\.\.\.$/, '').replace(/^['"]|['"]$/g, '').replace(/['"](?=[.,?!]$)/, '');

// draw one caption chunk centred at y; key(word) says which words are the yellow keyword(s)
export function caption(g, W, chunk, age, y, key, o = {}) {
  const words = chunk.words.map(w => clean(w).toUpperCase()).filter(Boolean), size = o.size || 84, maxW = W - 150;
  g.font = FONT(size); g.textBaseline = 'middle';
  // wrap into rows
  const rows = []; let row = [];
  for (const w of words) { const test = [...row, w].join(' '); if (row.length && g.measureText(test).width > maxW) { rows.push(row); row = [w]; } else row.push(w); }
  if (row.length) rows.push(row);
  const pop = easeBack(clamp(age / .14)), lh = size * 1.12;
  g.save(); g.translate(W / 2, y); g.scale(.86 + .14 * pop, .86 + .14 * pop); g.globalAlpha = clamp(age / .06);
  rows.forEach((r, i) => {
    const yy = (i - (rows.length - 1) / 2) * lh, sp = g.measureText(' ').width, widths = r.map(w => g.measureText(w).width), total = widths.reduce((a, b) => a + b, 0) + sp * (r.length - 1);
    let x = -total / 2;
    r.forEach((w, k) => {
      g.lineJoin = 'round'; g.lineWidth = size * .2; g.strokeStyle = TEXT.dark; g.strokeText(w, x, yy + 4); g.strokeText(w, x, yy);
      g.fillStyle = key(w) ? TEXT.yellow : TEXT.white; g.textAlign = 'left'; g.fillText(w, x, yy);
      x += widths[k] + sp;
    });
  });
  g.restore();
}

// the A/B choice board; `pick` (0 or 1) flashes one option during the countdown
export function choice(g, W, H, age, a, b, o = {}) {
  const y0 = o.y || H * .74, h = 120, w = W - 120, x0 = 60;
  [[a, 'A', '#FFD23F', '#141018'], [b, 'B', '#E8445A', '#ffffff']].forEach(([label, L, col, ink], i) => {
    const k = easeOut(clamp((age - i * .18) / .35)), y = y0 + i * (h + 34), slide = (1 - k) * (i ? W : -W);
    const on = o.flash != null && o.flash === i;
    g.save(); g.translate(slide, 0); g.globalAlpha = k;
    if (on) { g.shadowColor = col; g.shadowBlur = 40; }
    g.beginPath(); g.roundRect(x0, y, w, h, 30); g.fillStyle = on || i === 0 && o.flash == null ? col : '#1E1826'; g.fill();
    g.shadowBlur = 0; g.lineWidth = 6; g.strokeStyle = col; g.stroke();
    g.beginPath(); g.arc(x0 + 66, y + h / 2, 40, 0, TAU); g.fillStyle = on || (i === 0 && o.flash == null) ? '#141018' : col; g.fill();
    g.font = FONT(50); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = on || (i === 0 && o.flash == null) ? col : '#141018'; g.fillText(L, x0 + 66, y + h / 2 + 2);
    g.textAlign = 'left'; g.font = FONT(46); g.fillStyle = on || (i === 0 && o.flash == null) ? ink : '#ffffff'; g.fillText(label.toUpperCase(), x0 + 130, y + h / 2 + 2);
    g.restore();
  });
}

// a 3-2-1 countdown ring; frac = 0..1 through the current second
export function countdown(g, x, y, n, frac) {
  g.save();
  g.beginPath(); g.arc(x, y, 74, 0, TAU); g.fillStyle = '#141018'; g.fill();
  g.beginPath(); g.arc(x, y, 64, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - frac)); g.lineWidth = 14; g.lineCap = 'round'; g.strokeStyle = '#FFD23F'; g.stroke();
  const s = 1 + .25 * (1 - easeOut(clamp(frac / .25)));
  g.translate(x, y); g.scale(s, s); g.font = FONT(84); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(String(n), 0, 6);
  g.restore();
}
// a comment bubble icon next to the countdown
export function bubble(g, x, y, t) {
  const b = 1 + .06 * Math.sin(t * 6);
  g.save(); g.translate(x, y); g.scale(b, b);
  g.beginPath(); g.roundRect(-58, -44, 116, 84, 30); g.moveTo(-20, 40); g.lineTo(-34, 70); g.lineTo(6, 40); g.fillStyle = '#ffffff'; g.fill();
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * 28, -2, 9, 0, TAU); g.fillStyle = '#141018'; g.fill(); }
  g.restore();
}

// the end card: "PART 2" with a follow button
export function endCard(g, W, H, age, o = {}) {
  g.fillStyle = '#120E18'; g.fillRect(0, 0, W, H);
  const k = easeBack(clamp(age / .4));
  g.save(); g.translate(W / 2, H * .42); g.scale(k, k);
  // the A/B tiles, our own mark
  [['A', '#FFD23F', '#141018'], ['B', '#E8445A', '#fff']].forEach(([L, c, ink], i) => { g.save(); g.translate((i - .5) * 150, -260); g.rotate((i - .5) * .12); g.beginPath(); g.roundRect(-64, -80, 128, 160, 22); g.fillStyle = c; g.fill(); g.font = FONT(110); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ink; g.fillText(L, 0, 6); g.restore(); });
  g.font = FONT(150); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 26; g.strokeStyle = '#000'; g.lineJoin = 'round';
  g.strokeText(o.title || 'PART 2', 0, 0); g.fillStyle = '#FFD23F'; g.fillText(o.title || 'PART 2', 0, 0);
  g.font = FONT(64); g.fillStyle = '#fff'; g.fillText(o.sub || 'JALD HI', 0, 120);
  g.restore();
  const b = easeOut(clamp((age - .35) / .3)), pulse = 1 + .05 * Math.sin(age * 7);
  g.save(); g.globalAlpha = b; g.translate(W / 2, H * .66); g.scale(pulse, pulse);
  g.beginPath(); g.roundRect(-210, -64, 420, 128, 64); g.fillStyle = '#FFD23F'; g.fill();
  g.font = FONT(60); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#141018'; g.fillText(o.button || 'FOLLOW', 0, 4);
  g.restore();
}
