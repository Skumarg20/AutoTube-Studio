// Desi Toon character kit: original flat-vector Indian characters, drawn in code (no images).
// person(g, P, o): P = who (skin, hair, outfit, accessories); o = how this frame (where, size, expression, mouth, gaze, arms).
// Local coordinates: (0,0) is the base of the neck; the head sits around y = -175; the torso runs down to y = 430.
import { SKIN, HAIR, INK, EYEW, shade, mix, rgba, clamp } from './pal.js';

const TAU = Math.PI * 2;
function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fill(g, c) { g.fillStyle = c; g.fill(); }

// the face ellipse (used to clip shading and hair)
const HX = 0, HY = -172, HW = 86, HH = 104;
function facePath(g) { ell(g, HX, HY, HW, HH); }

// ---------- hair ----------
function hairBack(g, P, back) {
  const c = P.hair.color, h = P.hair.style;
  if (back) {   // seen from behind: the whole head is hair
    g.fillStyle = c;
    if (h === 'bald') { ell(g, 0, HY, HW, HH); fill(g, SKIN[P.skin] || P.skin); ell(g, 0, HY + 30, HW + 2, HH - 40); fill(g, c); return; }
    ell(g, 0, HY - 4, HW + 8, HH + 8); g.fill();
    if (h === 'curly') for (let i = 0; i < 14; i++) { const a = -Math.PI + i / 13 * Math.PI; ell(g, Math.cos(a) * 84, HY - 8 + Math.sin(a) * 100, 22, 22); g.fill(); }
    if (h === 'long' || h === 'open') { rr(g, -100, HY - 20, 200, 300, 70); g.fill(); }
    if (h === 'bun') { ell(g, 0, HY - 36, 38, 34); g.fillStyle = shade(c, .08); g.fill(); }
    // a soft shine so the back of the head reads as round
    ell(g, -26, HY - 46, 34, 20, -.4); g.fillStyle = rgba('#ffffff', .07); g.fill();
    return;
  }
  if (h === 'long') { g.fillStyle = c; rr(g, -104, HY - 40, 208, 270, 80); g.fill(); ell(g, 0, HY - 10, HW + 14, HH + 10); g.fill(); }
  if (h === 'open') { g.fillStyle = c; rr(g, -110, HY - 30, 220, 300, 90); g.fill(); ell(g, 0, HY - 6, HW + 16, HH + 12); g.fill(); }
  if (h === 'bun') { ell(g, 0, HY - HH - 18, 34, 30); fill(g, c); }
}
function hairFront(g, P) {
  const c = P.hair.color, h = P.hair.style;
  g.fillStyle = c;
  if (h === 'bald') {   // grey side tufts
    for (const s of [-1, 1]) { ell(g, s * 82, HY - 6, 18, 34, s * .2); g.fill(); }
    return;
  }
  g.beginPath();
  g.moveTo(-HW - 4, HY + 8);
  g.bezierCurveTo(-HW - 14, HY - HH - 40, HW + 14, HY - HH - 40, HW + 4, HY + 8);
  if (h === 'short' || h === 'curly') {   // men: a hairline with a little quiff, sideburns down to the ears
    g.lineTo(HW - 4, HY - 16);
    g.bezierCurveTo(HW - 16, HY - 64, 40, HY - 74, 10, HY - 66);
    g.bezierCurveTo(-20, HY - 80, -HW + 10, HY - 66, -HW + 4, HY - 16);
  } else {   // women: a centre parting, hair framing the face down to the jaw
    g.lineTo(HW - 2, HY + 50);
    g.bezierCurveTo(HW - 10, HY - 40, 30, HY - 74, 2, HY - 84);
    g.bezierCurveTo(-30, HY - 74, -HW + 10, HY - 40, -HW + 2, HY + 50);
  }
  g.closePath(); g.fill();
  if (h === 'curly') for (let i = 0; i < 9; i++) { const a = -Math.PI * .95 + i / 8 * Math.PI * .9; ell(g, Math.cos(a) * 80, HY - 20 + Math.sin(a) * 94, 21, 21); g.fill(); }
  if (h === 'short') { g.beginPath(); g.moveTo(-40, HY - 96); g.quadraticCurveTo(20, HY - 130, 70, HY - 86); g.quadraticCurveTo(20, HY - 104, -40, HY - 96); g.fillStyle = shade(c, .14); g.fill(); }
  // shine
  g.beginPath(); g.ellipse(-30, HY - 86, 26, 9, -.35, 0, TAU); g.fillStyle = rgba('#ffffff', .1); g.fill();
}

// ---------- face ----------
const EXPR = {   // brow lift/angle, eye open (1 = normal), pupil size, resting mouth
  neutral: { by: 0, ba: .05, eo: 1, ps: 1, m: 'line' }, happy: { by: -4, ba: -.08, eo: .95, ps: 1, m: 'smile' },
  joy: { by: -8, ba: -.1, eo: .5, ps: 1, m: 'grin', squint: true }, shock: { by: -18, ba: -.12, eo: 1.25, ps: .62, m: 'o' },
  sad: { by: -6, ba: -.42, eo: .9, ps: 1, m: 'frown' }, worried: { by: -10, ba: -.38, eo: 1.05, ps: .8, m: 'wavy' },
  angry: { by: 6, ba: .45, eo: .85, ps: .9, m: 'frown' }, whisper: { by: 2, ba: -.2, eo: .62, ps: 1, m: 'line', lid: .45 },
  sly: { by: 0, ba: .15, eo: .7, ps: 1, m: 'smirk', lid: .35 }, plead: { by: -12, ba: -.5, eo: 1.08, ps: .85, m: 'wavy' },
};
function eyes(g, P, o, E) {
  const sk = SKIN[P.skin] || P.skin, open = o.blink ? .08 : E.eo, [lx, ly] = o.look || [0, 0];
  for (const s of [-1, 1]) {
    const x = s * 34, y = HY + 4;
    if (E.squint && !o.blink) {   // happy closed eyes: upward arcs
      g.beginPath(); g.moveTo(x - 18, y + 4); g.quadraticCurveTo(x, y - 16, x + 18, y + 4); g.lineWidth = 7; g.lineCap = 'round'; g.strokeStyle = INK; g.stroke(); continue;
    }
    ell(g, x, y, 21, 25 * open); fill(g, EYEW);
    g.save(); ell(g, x, y, 21, 25 * open); g.clip();
    ell(g, x + lx * 7, y + ly * 7 + 2, 12 * E.ps + 2, 13 * E.ps + 2); fill(g, INK);
    ell(g, x + lx * 7 - 4, y + ly * 7 - 4, 4, 4); fill(g, '#fff');
    if (E.lid) { g.fillStyle = sk; g.fillRect(x - 24, y - 30, 48, 30 * E.lid * 1.9); }
    g.restore();
    if (o.tears) {   // a tear line and a falling drop
      const k = ((o.t || 0) * .8 + (s > 0 ? .5 : 0)) % 1;
      ell(g, x + s * 6, y + 30 + k * 70, 6, 9); fill(g, rgba('#7FD3FF', .9 * (1 - k * .6)));
      g.beginPath(); g.moveTo(x + s * 4, y + 20); g.lineTo(x + s * 6, y + 30 + k * 60); g.lineWidth = 4; g.strokeStyle = rgba('#9FE0FF', .6); g.stroke();
    }
  }
  // brows
  g.fillStyle = P.brow || shade(P.hair.color === HAIR.grey || P.hair.color === HAIR.white ? '#6b625c' : P.hair.color, -.1);
  for (const s of [-1, 1]) {
    g.save(); g.translate(s * 36, HY - 36 + E.by); g.rotate(-s * E.ba); rr(g, -22, -6, 44, 12, 6); g.fill(); g.restore();
  }
}
function mouth(g, P, o, E) {
  const sk = SKIN[P.skin] || P.skin, lip = shade(sk, -.38), dark = '#3a1414', y = HY + 64;
  g.lineCap = 'round';
  const shape = o.mouth || null;
  const open = (rx, ry, tongue = false, teeth = true) => {
    ell(g, 0, y, rx, ry); fill(g, dark);
    g.save(); ell(g, 0, y, rx, ry); g.clip();
    if (teeth) { g.fillStyle = '#fff'; g.fillRect(-rx, y - ry, rx * 2, Math.min(ry * .55, 7)); }
    if (tongue) { ell(g, 0, y + ry * .8, rx * .7, ry * .6); fill(g, '#d9606a'); }
    g.restore();
  };
  if (shape) {
    switch (shape) {
      case 'A': case 'X': g.beginPath(); g.moveTo(-14, y); g.lineTo(14, y); g.lineWidth = 6; g.strokeStyle = lip; g.stroke(); return;
      case 'B': open(15, 6); return;
      case 'C': open(16, 11, true); return;
      case 'D': open(20, 15, true); return;
      case 'E': open(11, 12, false, false); return;
      case 'F': open(8, 8, false, false); return;
      case 'G': rr(g, -15, y - 5, 30, 10, 4); fill(g, '#fff'); g.lineWidth = 3; g.strokeStyle = lip; g.stroke(); return;
      case 'H': open(15, 11, true); return;
    }
  }
  g.strokeStyle = E.m === 'line' ? lip : dark; g.lineWidth = 6; g.beginPath();
  switch (E.m) {
    case 'smile': g.moveTo(-20, y - 4); g.quadraticCurveTo(0, y + 14, 20, y - 4); g.stroke(); break;
    case 'grin': g.moveTo(-24, y - 6); g.quadraticCurveTo(0, y + 26, 24, y - 6); g.closePath(); g.fillStyle = dark; g.fill();
      g.save(); g.clip(); g.fillStyle = '#fff'; g.fillRect(-26, y - 8, 52, 9); g.restore(); break;
    case 'o': open(12, 15, false, false); break;
    case 'frown': g.moveTo(-17, y + 6); g.quadraticCurveTo(0, y - 8, 17, y + 6); g.stroke(); break;
    case 'wavy': g.moveTo(-18, y + 2); g.bezierCurveTo(-8, y - 8, 4, y + 10, 18, y - 2); g.stroke(); break;
    case 'smirk': g.moveTo(-14, y + 2); g.quadraticCurveTo(6, y + 6, 20, y - 8); g.stroke(); break;
    default: g.moveTo(-14, y); g.lineTo(14, y); g.stroke();
  }
}
function face(g, P, o) {
  const sk = SKIN[P.skin] || P.skin, E = EXPR[o.expr] || EXPR.neutral;
  // ears
  for (const s of [-1, 1]) { ell(g, s * (HW - 2), HY + 8, 15, 22); fill(g, s > 0 ? shade(sk, -.14) : sk); }
  facePath(g); fill(g, sk);
  // the shadow side: the right ~40% of the face, one flat darker tone
  g.save(); facePath(g); g.clip();
  g.beginPath(); g.moveTo(22, HY - HH); g.bezierCurveTo(44, HY - 30, 34, HY + 50, 10, HY + HH); g.lineTo(HW + 10, HY + HH); g.lineTo(HW + 10, HY - HH); g.closePath(); g.fillStyle = shade(sk, -.12); g.fill();
  if (P.stubble) { ell(g, 0, HY + 60, HW - 6, 50); g.fillStyle = rgba('#2a1a12', .22); g.fill(); }
  if (P.blush || o.expr === 'joy' || o.expr === 'happy') for (const s of [-1, 1]) { ell(g, s * 52, HY + 40, 16, 9); g.fillStyle = rgba('#e0606a', .28); g.fill(); }
  g.restore();
  eyes(g, P, o, EXPR[o.expr] || EXPR.neutral);
  // nose
  g.beginPath(); g.moveTo(6, HY + 14); g.quadraticCurveTo(14, HY + 38, 2, HY + 42); g.lineWidth = 6; g.lineCap = 'round'; g.strokeStyle = shade(sk, -.28); g.stroke();
  if (P.mustache) { g.beginPath(); g.moveTo(-34, HY + 58); g.quadraticCurveTo(0, HY + 36, 34, HY + 58); g.quadraticCurveTo(0, HY + 48, -34, HY + 58); g.fillStyle = P.hair.color === HAIR.grey ? '#8d8580' : INK; g.fill(); }
  mouth(g, P, o, E);
  // accessories on the face
  if (P.bindi) { ell(g, 0, HY - 52, 7, 7); fill(g, '#C8102E'); }
  if (P.tikka) { g.beginPath(); g.moveTo(0, HY - HH + 8); g.lineTo(0, HY - 72); g.lineWidth = 3; g.strokeStyle = '#E2B13C'; g.stroke(); ell(g, 0, HY - 66, 10, 12); fill(g, '#E2B13C'); ell(g, 0, HY - 64, 5, 6); fill(g, '#C8102E'); }
  if (P.nosering) { g.beginPath(); g.arc(16, HY + 40, 9, -.2, Math.PI * 1.4); g.lineWidth = 3.5; g.strokeStyle = '#E2B13C'; g.stroke(); }
  if (P.earrings) for (const s of [-1, 1]) { ell(g, s * (HW - 2), HY + 40, 7, 10); fill(g, '#E2B13C'); }
  if (P.glasses) { g.lineWidth = 5; g.strokeStyle = '#2b2b2b'; for (const s of [-1, 1]) { rr(g, s * 34 - 28, HY - 22, 56, 46, 14); g.stroke(); } g.beginPath(); g.moveTo(-6, HY); g.lineTo(6, HY); g.stroke(); }
  if (o.sweat) { const k = ((o.t || 0) * .6) % 1; g.beginPath(); g.moveTo(HW - 10, HY - 60 + k * 30); g.quadraticCurveTo(HW + 6, HY - 30 + k * 30, HW - 6, HY - 22 + k * 30); g.quadraticCurveTo(HW - 22, HY - 30 + k * 30, HW - 10, HY - 60 + k * 30); fill(g, rgba('#BFE9FF', .95)); }
}

// ---------- body ----------
function torso(g, P, o, back) {
  const c = P.outfit.color, a = P.outfit.accent || '#E2B13C', sk = SKIN[P.skin] || P.skin, type = P.outfit.type;
  // neck
  rr(g, -26, -80, 52, 96, 18); fill(g, shade(sk, back ? -.05 : -.1));
  // shoulders and chest
  g.beginPath(); g.moveTo(-58, 2); g.bezierCurveTo(-120, 8, -160, 30, -168, 110); g.lineTo(-176, 440); g.lineTo(176, 440); g.lineTo(168, 110); g.bezierCurveTo(160, 30, 120, 8, 58, 2); g.closePath();
  g.fillStyle = c; g.fill();
  g.save(); g.clip(); g.beginPath(); g.moveTo(60, 0); g.bezierCurveTo(90, 120, 80, 300, 70, 440); g.lineTo(200, 440); g.lineTo(200, 0); g.closePath(); g.fillStyle = shade(c, -.14); g.fill();
  if (!back) {
    if (type === 'kurta' || type === 'sherwani') {   // a mandarin collar and a button placket
      rr(g, -50, -6, 100, 26, 12); fill(g, type === 'sherwani' ? a : shade(c, -.2));
      g.fillStyle = type === 'sherwani' ? a : shade(c, -.25); g.fillRect(-7, 18, 14, 420);
      for (let i = 0; i < 6; i++) { ell(g, 0, 50 + i * 62, 6, 6); fill(g, type === 'sherwani' ? '#fff3c8' : a); }
      if (type === 'sherwani') for (let i = 0; i < 18; i++) { ell(g, -150 + (i % 2) * 6, 120 + i * 18, 3, 3); fill(g, a); ell(g, 150 - (i % 2) * 6, 120 + i * 18, 3, 3); fill(g, a); }
    }
    if (type === 'choli' || type === 'saree') {   // neckline + dupatta / pallu across the body
      g.beginPath(); g.moveTo(-54, 2); g.quadraticCurveTo(0, 70, 54, 2); g.lineTo(54, -2); g.lineTo(-54, -2); g.closePath(); fill(g, sk);
      if (P.necklace) { g.beginPath(); g.arc(0, 10, 54, .25, Math.PI - .25); g.lineWidth = 8; g.strokeStyle = '#E2B13C'; g.stroke(); for (let i = 0; i < 7; i++) { const an = .35 + i / 6 * (Math.PI - .7); ell(g, Math.cos(an) * 54, 10 + Math.sin(an) * 54 + 8, 6, 8); fill(g, i === 3 ? '#C8102E' : '#E2B13C'); } }
      const d = P.outfit.drape || a;
      g.beginPath(); g.moveTo(-150, 30); g.lineTo(-90, 10); g.lineTo(190, 400); g.lineTo(190, 440); g.lineTo(120, 440); g.closePath(); fill(g, d);
      g.beginPath(); g.moveTo(-150, 30); g.lineTo(-90, 10); g.lineTo(-84, 22); g.lineTo(-146, 44); g.closePath(); fill(g, '#F2C14E');
      g.beginPath(); g.moveTo(-90, 10); g.lineTo(190, 400); g.lineTo(190, 416); g.lineTo(-96, 24); g.closePath(); fill(g, '#F2C14E');
      for (let i = 0; i < 9; i++) { ell(g, -40 + i * 26, 60 + i * 36, 4, 4); fill(g, rgba('#FFE7A0', .8)); }
    }
    if (type === 'hoodie') { rr(g, -70, -20, 140, 50, 24); fill(g, shade(c, -.2)); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 24, 20); g.lineTo(s * 30, 130); g.lineWidth = 5; g.strokeStyle = '#eee'; g.stroke(); } }
    if (type === 'shirt') { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4, 2); g.lineTo(s * 56, -4); g.lineTo(s * 30, 46); g.closePath(); fill(g, shade(c, .15)); } g.fillStyle = shade(c, -.2); g.fillRect(-4, 40, 8, 400); }
  } else if (type === 'choli' || type === 'saree') {
    g.beginPath(); g.moveTo(-170, 60); g.lineTo(-60, 0); g.lineTo(-20, 0); g.lineTo(-150, 440); g.lineTo(-180, 440); g.closePath(); fill(g, P.outfit.drape || a);
  }
  g.restore();
}

// arms: thick rounded sleeves with round hands; the pose decides where the hands go
const ARMS = {
  down: [], phone: [['r', 120, 60, 70, 210, 30, 140]], together: [['l', -130, 70, -40, 230, -8, 170], ['r', 130, 70, 40, 230, 8, 170]],
  glass: [['r', 140, 60, 200, 120, 190, -70]], reach: [['r', 140, 60, 260, 140, 330, 120]], clap: [['l', -130, 70, -50, 230, -12, 160], ['r', 130, 70, 50, 230, 12, 160]],
  wave: [['r', 140, 60, 210, 40, 230, -80]], point: [['r', 140, 60, 230, 120, 310, 60]], chin: [['r', 130, 70, 80, 120, 40, -40]],
};
function arms(g, P, o) {
  const pose = ARMS[o.arms || 'down'] || [], sk = SKIN[P.skin] || P.skin, c = P.outfit.sleeve || P.outfit.color;
  for (const [side, sx, sy, ex, ey, hx, hy0] of pose) {
    let hy = hy0;
    if (o.arms === 'clap') hy += Math.abs(Math.sin((o.t || 0) * 9)) * -24;
    if (o.arms === 'wave') { const w = Math.sin((o.t || 0) * 8) * 26; g.save(); g.translate(w * .2, 0); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(ex, ey, hx, hy); g.lineWidth = 50; g.strokeStyle = side === 'r' ? shade(c, -.1) : c; g.stroke();
    ell(g, hx, hy, 26, 28); fill(g, sk);
    if (P.mehendi) { ell(g, hx, hy, 14, 15); fill(g, rgba('#8a3b1c', .55)); }
    if (P.bangles) { g.beginPath(); g.arc(hx, hy + 30, 22, Math.PI * .1, Math.PI * .9); g.lineWidth = 6; g.strokeStyle = '#E2B13C'; g.stroke(); }
    if (o.hold === 'glass' && o.arms === 'glass') { rr(g, hx - 18, hy - 70, 36, 64, 6); fill(g, rgba('#ffffff', .55)); g.fillStyle = '#F2A33A'; g.fillRect(hx - 15, hy - 44, 30, 36); }
    if (o.hold === 'phone' && o.arms === 'phone') { rr(g, hx - 30, hy - 90, 60, 110, 10); fill(g, '#1b1b22'); rr(g, hx - 24, hy - 82, 48, 92, 6); fill(g, rgba('#9fd0ff', .9)); }
    if (o.arms === 'wave') g.restore();
  }
}

// ---------- the whole person ----------
export function person(g, P, o = {}) {
  g.save();
  g.translate(o.x || 0, o.y || 0);
  const s = o.s || 1; g.scale(o.flip ? -s : s, s);
  if (o.tilt) g.rotate(o.tilt);
  // a soft idle sway / breathing so nobody is ever frozen
  const t = o.t || 0, br = Math.sin(t * 2.1 + (P.seed || 0)) * 1.2;
  g.translate(0, br);
  const back = !!o.back;
  if (!back) hairBack(g, P, false);
  torso(g, P, o, back);
  g.save(); g.translate(0, -br * .5); if (o.nod) g.rotate(Math.sin(t * 6) * .03);
  if (back) { for (const s2 of [-1, 1]) { ell(g, s2 * (HW - 2), HY + 8, 15, 22); fill(g, shade(SKIN[P.skin] || P.skin, -.1)); } hairBack(g, P, true); }
  else { face(g, P, o); hairFront(g, P); }
  g.restore();
  if (!back) arms(g, P, o);
  g.restore();
}

// automatic blinking: every few seconds, 0.12 s long, different per character
export function blinkAt(t, seed = 0) { const p = 3.1 + (seed % 5) * .37, k = (t + seed * 1.3) % p; return k < .12; }
// the mouth shape at time t from a lip-sync track [[t0, t1, shape], ...] (shapes A-H), or null when silent
export function mouthAt(track, t) { if (!track) return null; for (const [a, b, sh] of track) if (t >= a && t < b) return sh; return null; }

// the eyes-only close-up strip ("their eyes met"): a band across the face
export function eyesStrip(g, P, o) {
  person(g, P, { ...o, arms: 'down' });
}
