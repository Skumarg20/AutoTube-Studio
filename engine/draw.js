// "draw" shots for engine v2: illustrated scenes with animated characters and props (uses ILLUS from illus.js).
// Loaded after film.js helpers via window.DRAWSHOT(g, ctx) registration.
window.makeDrawShot = function (env) {
  const { W, H, U, V, F, TL, clamp, lerp, eOut, eIO, eBack, hash, font, fitText, fitWrap, rr, grain, vignette } = env; let g = env.g;
  const IL = window.ILLUS;
  const SKIN = { anime: 'cel', whiteboard: 'whiteboard', cartoon: 'cartoon', rubberhose: 'rubberhose', paper: 'paper', chalk: 'whiteboard' };
  // mouth openness for a talking character: open while a word is spoken
  const PH = TL.phrases || [];
  function talkAt(t) { const p = PH.find(p => t >= p.s && t < p.e + .05); if (!p) return 0; const w = p.w.find(w => t >= w.s && t < w.e); if (!w) return 0; const k = (t - w.s) / Math.max(.08, w.e - w.s); return Math.abs(Math.sin(k * Math.PI * Math.max(1, Math.round((w.e - w.s) / .14)))); }
  // lip-sync shapes from the voice (TL.mouth: [[start, end, shape]...], sorted): binary search for the shape spoken at t
  const MO = TL.mouth || [];
  function mouthAt(t) { let lo = 0, hi = MO.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (MO[m][1] < t) lo = m + 1; else if (MO[m][0] > t) hi = m - 1; else return MO[m][2]; } return null; }
  function elTimes(s, d) { const els = s.els || []; const wb = SKIN[s.style] === 'whiteboard'; let auto = s.t - .02; return els.map((e, i) => { const t0 = e.t != null ? e.t : auto; if (e.t == null) auto = t0 + (wb ? .75 : .22); return t0; }); }
  function arrow(x0, y0, x1, y1, p, col, lw, bend = .2) {
    const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend;
    const pt = k => [(1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * mx + k * k * x1, (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * my + k * k * y1];
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); const n = 30; for (let i = 0; i <= n * p; i++) { const [x, y] = pt(i / n); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    if (p > .95) { const [ax, ay] = pt(1), [bx, by] = pt(.93), a = Math.atan2(ay - by, ax - bx), L = lw * 5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax - Math.cos(a - .45) * L, ay - Math.sin(a - .45) * L); g.moveTo(ax, ay); g.lineTo(ax - Math.cos(a + .45) * L, ay - Math.sin(a + .45) * L); g.stroke(); }
    return pt(clamp(p));
  }
  function bubble(x, y, text, p, skin) {
    if (p <= 0) return; const R = fitWrap(text, skin === 'whiteboard' ? F.chalk : F.inter, 800, (V ? 50 : 42) * U, (V ? W * .6 : W * .3), 3); const w = Math.max(...R.lines.map(l => { font(R.size, skin === 'whiteboard' ? F.chalk : F.inter, 800); return g.measureText(l).width; })) + 50 * U, h = R.lines.length * R.size * 1.2 + 36 * U;
    const bx = clamp(x - w / 2, 20 * U, W - w - 20 * U), by = Math.max(20 * U, y - h - 40 * U), s = eBack(p / .3);
    g.save(); g.translate(bx + w / 2, by + h); g.scale(s, s); g.translate(-(bx + w / 2), -(by + h));
    if (skin === 'paper') { g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 10 * U; g.shadowOffsetY = 5 * U; }
    g.fillStyle = skin === 'rubberhose' ? '#f4f1ea' : '#fff'; g.strokeStyle = skin === 'paper' ? 'rgba(0,0,0,0)' : '#1c1c1f'; g.lineWidth = 3.5 * U;
    rr(bx, by, w, h, 26 * U); g.fill(); g.stroke(); g.beginPath(); const tx = clamp(x, bx + 30 * U, bx + w - 30 * U); g.moveTo(tx - 16 * U, by + h - 2 * U); g.lineTo(x, y - 10 * U); g.lineTo(tx + 14 * U, by + h - 2 * U); g.fill(); g.stroke();
    g.shadowBlur = 0; g.fillStyle = '#1c1c1f'; g.textAlign = 'center'; R.lines.forEach((l, i) => { font(R.size, skin === 'whiteboard' ? F.chalk : F.inter, 800); g.fillText(l, bx + w / 2, by + 24 * U + R.size * (i + .85) * 1.2 - R.size * .2); }); g.restore();
  }
  function label(text, x, y, p, skin, big) {
    if (p <= 0) return; const fam = skin === 'whiteboard' ? F.chalk : skin === 'rubberhose' ? F.bebas : F.anton; const size = fitText(text, fam, skin === 'whiteboard' ? 600 : 400, (big ? 120 : 64) * U, W * .6);
    font(size, fam, skin === 'whiteboard' ? 600 : 400); g.textAlign = 'center'; const tw = g.measureText(text).width;
    if (skin === 'whiteboard') { g.save(); g.beginPath(); g.rect(x - tw / 2 - 10, y - size, (tw + 20) * clamp(p / .6), size * 1.4); g.clip(); g.fillStyle = big ? '#e4573d' : '#1c1c1f'; g.fillText(text, x, y); g.restore(); return; }
    const s = eBack(p / .3); g.save(); g.translate(x, y - size * .35); g.scale(s, s);
    if (skin === 'paper') { g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 8 * U; g.shadowOffsetY = 4 * U; g.fillStyle = '#fffdf7'; g.fillRect(-tw / 2 - 18 * U, -size * .62, tw + 36 * U, size * 1.2); g.shadowBlur = 0; g.fillStyle = '#3a3438'; }
    else if (skin === 'rubberhose') { g.fillStyle = '#111'; g.fillRect(-tw / 2 - 18 * U, -size * .62, tw + 36 * U, size * 1.2); g.fillStyle = '#f4f1ea'; }
    else { g.lineWidth = 10 * U; g.strokeStyle = '#2a2737'; g.lineJoin = 'round'; g.strokeText(text, 0, size * .35); g.fillStyle = big ? '#ffd400' : '#fff'; }
    g.fillText(text, 0, size * .35); g.restore();
  }
  // main draw shot
  return function drawShot(s, lt, d) {
    g = env.g;
    const skin = SKIN[s.style] || s.drawSkin || 'cartoon', t = s.t + lt, els = s.els || [], times = elTimes(s, d);
    const push = 1 + .05 * eIO(lt / Math.max(d, 1)); g.save(); g.translate(W / 2, H / 2); g.scale(push, push); g.translate(-W / 2, -H / 2);
    // a painted background (tools/paint.py) replaces the drawn scene: slow push-in, then a soft floor shadow so characters sit in it
    const painted = s.bgimg && env.IMG && env.IMG[s.bgimg];
    const gy = painted ? (env.cover(env.IMG[s.bgimg], 0, 0, W, H, 1.03 + .05 * clamp(lt / Math.max(d, 1)), .5, .5, 'saturate(1.08)'), H * (V ? .74 : .82))
      : s.ownBg ? (s.ownBg(), H * (V ? .7 : .8)) : IL.bg(g, W, H, skin, s.scene || (skin === 'whiteboard' ? 'blank' : 'desert'), t);
    if (painted) { const sh = g.createLinearGradient(0, gy - 60 * U, 0, H); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,6,30,.55)'); g.fillStyle = sh; g.fillRect(0, gy - 60 * U, W, H - gy + 60 * U); }
    if (!painted && s.ownBg && s.scene !== 'blank') { g.save(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4 * U; g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke(); g.restore(); }
    const groundY = painted ? H * (V ? .8 : .88) : s.scene === 'blank' || !s.scene ? H * (V ? .7 : .8) : gy + (V ? 40 : 18) * U;
    // a soft contact shadow under anything standing on the ground, so characters sit IN the scene instead of floating
    const contact = (x, y, w) => { g.save(); const r = g.createRadialGradient(x, y, 0, x, y, w); r.addColorStop(0, painted ? 'rgba(10,5,25,.55)' : 'rgba(0,0,0,.28)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.translate(x, y); g.scale(1, .18); g.translate(-x, -y); g.beginPath(); g.arc(x, y, w, 0, 7); g.fill(); g.restore(); };
    const charH = (V ? .34 : .56) * H, propH = (V ? .24 : .38) * H;
    let tip = null; const pos = {};
    // draw order: props behind characters, then labels/arrows/bubbles on top
    const order = els.map((e, i) => i).sort((a, b) => ({ prop: 0, crowd: 1, char: 2, count: 3, arrow: 4, label: 5, bubble: 6 }[els[a].k] ?? 3) - ({ prop: 0, crowd: 1, char: 2, count: 3, arrow: 4, label: 5, bubble: 6 }[els[b].k] ?? 3) || (els[a].y || 1) - (els[b].y || 1));
    for (const i of order) {
      const e = els[i], et = times[i], a = t - et; if (a < 0) continue;
      const pw = skin === 'whiteboard' ? clamp(a / .7) : 1, pp = skin === 'whiteboard' ? 1 : eBack(a / .32);
      const mv = e.from ? eIO((t - et) / Math.max(.8, (s.t + d) - et - .2)) : 1;
      const fx = e.from ? lerp(e.from[0], e.x ?? .5, mv) : (e.x ?? .5), fy = e.from && e.from[1] != null ? lerp(e.from[1], e.y ?? 1, mv) : (e.y ?? 1);
      let X = fx * W, Y = e.k === 'char' || e.k === 'prop' || e.k === 'crowd' ? (e.y != null && e.y < .95 ? e.y * H : groundY) : fy * H;
      const bounce = skin === 'rubberhose' ? Math.abs(Math.sin(t * 6 + i)) * 6 * U : 0;
      let spin = 0;
      // real-life physics: "path" moves a prop the way it really moves (y: 0 top .. 1 ground), with a dotted trail
      //   throw/arc: projectile parabola (peak "h" above the straight line) · fall: speeds up (y ~ t^2) · up: slows down to the top · line: steady
      if (e.k === 'prop' && e.path && e.from) {
        const gyF = groundY / H, x0 = e.from[0], y0 = e.from[1] ?? gyF, x1 = e.x ?? .5, y1 = e.y != null && e.y < .95 ? e.y : gyF;
        const u = clamp((t - et) / Math.max(.6, e.dur || ((s.t + d) - et - .3))), h = e.h ?? .25;
        const at = k => e.path === 'fall' ? [lerp(x0, x1, k), lerp(y0, y1, k * k)] : e.path === 'up' ? [lerp(x0, x1, k), lerp(y0, y1, 1 - (1 - k) * (1 - k))] : e.path === 'line' ? [lerp(x0, x1, k), lerp(y0, y1, k)] : [lerp(x0, x1, k), lerp(y0, y1, k) - h * 4 * k * (1 - k)];
        if (e.trail !== false && u > 0) { g.save(); g.fillStyle = skin === 'whiteboard' || skin === 'paper' ? 'rgba(30,30,40,.55)' : 'rgba(255,255,255,.7)'; for (let k = 0; k <= u; k += .045) { const [tx, ty] = at(k); g.beginPath(); g.arc(tx * W, ty * H - propH * (e.size || 1) * .2, 4.5 * U, 0, 7); g.fill(); } g.restore(); }
        [X, Y] = at(u).map((v, k) => v * (k ? H : W)); spin = e.spin === false ? 0 : (u < 1 ? (t - et) * 6 : 0);
      }
      if (e.k === 'prop') {
        const size = propH * (e.size || 1); const moving = e.from && !e.path && mv < 1; const bob = moving ? Math.abs(Math.sin(t * 8)) * 4 * U : 0;
        g.save(); if (pp !== 1) { g.translate(X, Y); g.scale(pp, pp); g.translate(-X, -Y); }
        if (e.path) { const hgt = clamp((groundY - Y) / (H * .6)); contact(X, groundY + 3 * U, size * (.3 - .18 * hgt)); }   // shadow on the ground under a flying object
        else if (Y >= groundY - 2) contact(X, Y + 3 * U, size * .38);
        const tp = IL.drawIcon(g, e.icon, X, Y - bob - bounce, size, skin, pw, t, { flip: e.flip || (e.from && e.from[0] > (e.x ?? .5)) });
        g.restore(); if (pw < 1 && tp) tip = tp; pos[e.id || e.icon] = [X, Y - size];
      } else if (e.k === 'char') {
        const moving = e.from && mv < 1, size = charH * (e.size || 1);
        const ch = { id: e.id || e.costume, costume: e.costume, pose: moving ? (e.run ? 'run' : 'walk') : (e.pose || 'stand'), face: e.face || (e.from ? (e.from[0] > (e.x ?? .5) ? 'left' : 'right') : 'right'), talk: e.talk ? talkAt(t) : 0, mouth: e.talk && MO.length ? (mouthAt(t) || 'X') : null, hold: e.hold };
        g.save(); if (pp !== 1) { g.translate(X, Y); g.scale(pp, pp); g.translate(-X, -Y); }
        if (skin === 'whiteboard' && pw < 1) { g.save(); g.beginPath(); g.rect(X - size, Y - size * 1.1, size * 2, size * 1.15 * pw); g.clip(); IL.drawChar(g, ch, X, Y - bounce, size, skin, t, 1); g.restore(); tip = [X + size * .2 * Math.sin(a * 20), Y - size * 1.05 + size * 1.1 * pw]; }
        else { if (Y >= groundY - 2) contact(X, Y + 4 * U, size * .32); IL.drawChar(g, ch, X, Y - bounce, size, skin, t, 1); }
        g.restore(); pos[e.id || e.costume] = [X, Y - size * 1.08];
      } else if (e.k === 'crowd') {
        const n = Math.min(e.n || 8, 18), w = (e.w || .5) * W; for (let k = 0; k < n; k++) { const cx = X - w / 2 + w * (k + .5) / n, cs = charH * .55 * (.85 + hash(k) * .3); const ap = clamp((a - k * .05) / .3); if (ap <= 0) continue; g.save(); g.globalAlpha *= ap; IL.drawChar(g, { id: 'cr' + k, costume: ['farmer', 'worker', 'woman', 'merchant', 'child', 'monk'][k % 6], pose: e.pose || (k % 3 ? 'stand' : 'cheer'), face: hash(k + 3) > .5 ? 'left' : 'right' }, cx, Y + (k % 2) * 14 * U, cs, skin, t + k, 1); g.restore(); }
      } else if (e.k === 'arrow') {
        const p = skin === 'whiteboard' ? clamp(a / .6) : eOut(a / .45); const [x0, y0] = e.from || [.3, .5], [x1, y1] = e.to || [.7, .5];
        const tp = arrow(x0 * W, y0 * H, x1 * W, y1 * H, p, skin === 'whiteboard' ? '#e4573d' : skin === 'rubberhose' ? '#111' : skin === 'paper' ? '#3a3438' : '#2a2737', 7 * U, e.bend ?? .18); if (p < 1 && skin === 'whiteboard') tip = tp;
      } else if (e.k === 'label') {
        let ly = (e.y ?? .2) * H;
        if ((e.y ?? .2) > (V ? .66 : .76)) { // a caption meant to sit under an item: put it above the nearest prop/character instead (the bottom is for subtitles)
          let best = null, bd = 1e9; els.forEach(o => { if (o.k === 'prop' || o.k === 'char') { const dd = Math.abs((o.x ?? .5) - (e.x ?? .5)); if (dd < bd) { bd = dd; best = o; } } });
          ly = best && bd < .12 ? groundY - (best.k === 'char' ? charH * 1.15 : propH * (best.size || 1)) - 26 * U : (V ? .66 : .76) * H;
        }
        label(e.text || '', X, ly, a, skin, e.big);
      }
      else if (e.k === 'bubble') { const o = pos[e.of] || [X, H * .4]; bubble(o[0], o[1], e.text || '', a, skin); }
      else if (e.k === 'count') { const n = Math.round((+e.value || 0) * eOut(a / 1.4)); const txt = (e.prefix || '') + (n >= 1000 && n <= 2100 && !e.suffix ? String(n) : n.toLocaleString('en-US')) + (e.suffix || ''); label(txt, X, (e.y ?? .25) * H, a, skin, true); if (e.label) label(e.label, X, (e.y ?? .25) * H + 90 * U, a - .3, skin, false); }
    }
    if (skin === 'whiteboard' && tip) IL.hand(g, tip[0], tip[1], U);
    g.restore();
    if (skin === 'rubberhose') { grain(t, .18, 'overlay'); const f = Math.floor(t * 30); g.fillStyle = `rgba(255,240,210,${.05 * hash(f)})`; g.fillRect(0, 0, W, H); vignette(.75, .3); }
    else if (skin === 'paper') { grain(t, .05); vignette(.3); }
    else if (skin === 'cartoon') vignette(.18);
  };
};
