// Graphics layer + transitions for engine v2.
//   gfx: animated overlays on top of any shot (telestrator pen, magnifier, icons, icon arrays, bar/pie charts, timelines, particles, badges, counters)
//   transitions: whip, ink, tear, glitch, burn, iris, zoom, slide between shots (needs the previous shot rendered into a buffer)
window.makeFX = function (env) {
  const { W, H, U, V, F, TL, clamp, lerp, eOut, eIO, eBack, hash, font, fitText, rr } = env;
  const G = () => env.g;
  const IL = window.ILLUS;
  let ZB = null;
  const PEN = { yellow: '#ffd400', red: '#ff3b30', white: '#ffffff', cyan: '#00e5ff', black: '#111111' };
  // telestrator-style hand-drawn stroke along a point list, progress p
  function penPath(pts, p, col, lw) {
    const g = G(); const n = pts.length - 1; if (n < 1) return; const m = Math.max(1, Math.floor(n * clamp(p)));
    g.save(); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 6 * U;
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= m; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); g.restore();
    return pts[m];
  }
  function circlePts(cx, cy, rx, ry, seed) { const pts = []; for (let k = 0; k <= 64; k++) { const a = -Math.PI / 2 + k / 64 * Math.PI * 2.15, w = 1 + .06 * Math.sin(k * .7 + seed); pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]); } return pts; }
  function arrowPts(x0, y0, x1, y1, bend) { const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend, pts = []; for (let k = 0; k <= 30; k++) { const q = k / 30; pts.push([(1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * mx + q * q * x1, (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * my + q * q * y1]); } return pts; }
  const COLS = { news: '#ffd400', board: '#ff3b30', light: '#c0141c', map: '#ffd27a', reel: '#ffffff', count: '#c8102e', hud: '#00e5ff', ascii: '#33ff66', scifi: '#ff3df2', desktop: '#2f80ff' };
  const accent = st => COLS[st] || '#ffd400';
  const ICON_SKIN = { whiteboard: 'whiteboard', rubberhose: 'rubberhose', paper: 'paper', papercut: 'paper', shadow: 'rubberhose', reel: 'rubberhose', kino: 'rubberhose', citysym: 'rubberhose' };
  function badge(text, x, y, p, bg = '#111', fg = '#fff', size = 34) {
    const g = G(); if (p <= 0) return; font(size * U, F.anton); const w = g.measureText(text).width + 32 * U, h = size * 1.45 * U, s = eBack(p / .3);
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = bg; g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 10 * U; rr(-w / 2, -h / 2, w, h, 8 * U); g.fill(); g.shadowBlur = 0; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 2 * U); g.restore(); g.textBaseline = 'alphabetic';
  }
  function particles(kind, t, a) {
    const g = G(), n = kind === 'confetti' ? 90 : kind === 'snow' ? 120 : 70; g.save();
    for (let k = 0; k < n; k++) {
      const sp = .4 + hash(k) * .9, x0 = hash(k + 1) * W, life = (t * sp * .25 + hash(k + 2)) % 1;
      let x = x0, y, r = (2 + hash(k + 3) * 4) * U, c;
      if (kind === 'embers' || kind === 'sparks') { y = H * (1.05 - life * 1.1); x += Math.sin(t * 2 + k) * 30 * U; c = kind === 'embers' ? `rgba(255,${120 + (k % 80)},40,${(1 - life) * .9})` : `rgba(255,230,140,${(1 - life)})`; }
      else if (kind === 'snow') { y = H * (life * 1.1 - .05); x += Math.sin(t + k) * 40 * U; c = `rgba(255,255,255,${.8 - life * .3})`; }
      else if (kind === 'coins') { y = H * (life * 1.15 - .1); c = '#f4b630'; }
      else if (kind === 'confetti') { y = H * (life * 1.15 - .1); x += Math.sin(t * 3 + k) * 50 * U; c = ['#e4573d', '#3a78d4', '#f2bf3a', '#3fa36b', '#8a4fbf'][k % 5]; }
      else { y = H * (hash(k + 4) + Math.sin(t * .2 + k) * .03); x = (x0 + t * 12 * U * sp) % W; c = `rgba(255,245,220,${.18 + .2 * hash(k + 5)})`; }
      g.globalAlpha = a; g.fillStyle = c;
      if (kind === 'coins') { g.beginPath(); g.ellipse(x, y, r * 2.4, r * 2.4 * Math.abs(Math.cos(t * 6 + k)), 0, 0, 6.29); g.fill(); g.strokeStyle = '#a8701c'; g.lineWidth = 2 * U; g.stroke(); }
      else if (kind === 'confetti') { g.save(); g.translate(x, y); g.rotate(t * 4 + k); g.fillRect(-r, -r * 2, r * 2, r * 4); g.restore(); }
      else { g.beginPath(); g.arc(x, y, r * (kind === 'dust' ? .7 : 1), 0, 6.29); g.fill(); }
    }
    g.restore();
  }
  // ---- gfx overlay renderer ----
  function gfx(s, lt, d) {
    const list = s.gfx; if (!Array.isArray(list) || !list.length) return; const g = G(), t = s.t + lt, col = accent(s.style);
    let auto = s.t + .35;
    list.forEach((e, k) => {
      const t0 = e.t != null ? e.t : auto; if (e.t == null) auto += .45; const a = t - t0; if (a < 0) return;
      const X = (e.x ?? .5) * W, Y = (e.y ?? .5) * H, pc = e.color ? (PEN[e.color] || e.color) : col;
      switch (e.k) {
        case 'circle': { const r = (e.r ?? .12) * H; penPath(circlePts(X, Y, r * (e.wide || 1.25), r, k), eOut(a / .55), pc, 8 * U); break; }
        case 'arrow': { const [x0, y0] = e.from || [.2, .2], [x1, y1] = e.to || [.5, .5]; const pts = arrowPts(x0 * W, y0 * H, x1 * W, y1 * H, e.bend ?? .2); const p = eOut(a / .5), tip = penPath(pts, p, pc, 8 * U); if (p > .97) { const [bx, by] = pts[pts.length - 4], an = Math.atan2(y1 * H - by, x1 * W - bx), L = 34 * U; penPath([[x1 * W - Math.cos(an - .5) * L, y1 * H - Math.sin(an - .5) * L], [x1 * W, y1 * H], [x1 * W - Math.cos(an + .5) * L, y1 * H - Math.sin(an + .5) * L]], 1, pc, 8 * U); } break; }
        case 'box': { const w = (e.w ?? .2) * W, h = (e.h ?? .15) * H, x0 = X - w / 2, y0 = Y - h / 2; penPath([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0 - 4 * U]], eOut(a / .6), pc, 7 * U); break; }
        case 'underline': { const w = (e.w ?? .25) * W; penPath([[X - w / 2, Y], [X + w / 2, Y + 4 * U]], eOut(a / .35), pc, 10 * U); break; }
        case 'zoom': { // magnifier on a detail of what is on screen now
          const r = (e.r ?? .14) * H, z = e.z || 2.2, sx = (e.sx ?? e.x ?? .5) * W, sy = (e.sy ?? e.y ?? .5) * H, p = eBack(a / .4), cx = (e.dx ?? Math.min(.8, (e.x ?? .5) + .18)) * W, cy = (e.dy ?? Math.max(.25, (e.y ?? .5) - .1)) * H;
          const tw = Math.max(4, Math.round(2 * r / z)); if (!ZB || ZB.width !== tw) { ZB = document.createElement('canvas'); ZB.width = ZB.height = tw; } const zc = ZB.getContext('2d'); zc.clearRect(0, 0, tw, tw); zc.drawImage(g.canvas, Math.max(0, sx - tw / 2), Math.max(0, sy - tw / 2), tw, tw, 0, 0, tw, tw);
          g.save(); g.translate(cx, cy); g.scale(p, p); g.beginPath(); g.arc(0, 0, r, 0, 6.29); g.save(); g.clip(); g.drawImage(ZB, -r, -r, 2 * r, 2 * r); g.restore();
          g.lineWidth = 10 * U; g.strokeStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 16 * U; g.stroke(); g.restore();
          if (p > .9) penPath([[sx, sy], [cx - (cx - sx) * .0 - r * Math.sign(cx - sx) * .7, cy + r * .7]], 1, '#fff', 4 * U);
          break; }
        case 'icon': {
          const size = (e.size ?? .22) * H, anim = e.anim || 'pop', skin = ICON_SKIN[s.style] || 'cartoon';
          let x = X, y = Y + size / 2, sc = 1, rot = 0;
          if (anim === 'pop') sc = eBack(a / .35); if (anim === 'float') { sc = eOut(a / .3); y += Math.sin(t * 2 + k) * 12 * U; } if (anim === 'spin') { sc = eOut(a / .3); rot = Math.sin(t * 3) * .3; } if (anim === 'bounce') { sc = eOut(a / .2); y -= Math.abs(Math.sin(t * 5 + k)) * 30 * U; }
          if (anim === 'fly' && e.from) { const q = eIO(a / .8); x = lerp(e.from[0] * W, X, q); y = lerp(e.from[1] * H, Y, q) + size / 2 - Math.sin(q * Math.PI) * 120 * U; }
          if (sc <= 0) break; g.save(); g.translate(x, y); g.scale(sc, sc); g.translate(-x, -y); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14 * U; g.shadowOffsetY = 8 * U; IL.drawIcon(g, e.icon, x, y, size, skin, 1, t, { rot }); g.restore();
          if (e.label) badge(e.label, x, y + 30 * U, a - .2, '#111', '#fff', 30);
          break; }
        case 'icons': { // icon array that counts up
          const n = Math.min(e.n || 10, 60), cols = e.cols || Math.min(n, 10), size = (e.size ?? (V ? .05 : .075)) * H, w = cols * size * 1.15, x0 = X - w / 2, rows = Math.ceil(n / cols), y0 = Y - rows * size * 1.15 / 2, skin = ICON_SKIN[s.style] || 'cartoon';
          const shown = Math.floor(clamp(a / Math.max(.6, Math.min(2.2, n * .06))) * n);
          for (let q = 0; q < shown; q++) { const cx = x0 + (q % cols + .5) * size * 1.15, cy = y0 + (Math.floor(q / cols) + 1) * size * 1.15; IL.drawIcon(g, e.icon || 'people', cx, cy, size, skin, 1, t); }
          if (e.label) badge(`${Math.round(shown * (e.per || 1)).toLocaleString('en-US')}${e.unit ? ' ' + e.unit : ''} ${e.label}`, X, y0 + rows * size * 1.15 + 50 * U, a, '#111', '#fff', 34);
          break; }
        case 'bars': {
          const items = (e.items || []).slice(0, 6), bw = (e.w ?? .6) * W, bh = (e.h ?? .4) * H, x0 = X - bw / 2, y0 = Y + bh / 2, mx = Math.max(...items.map(i => +i[1] || 0), 1), slot = bw / Math.max(1, items.length);
          g.save(); g.fillStyle = 'rgba(0,0,0,.45)'; rr(x0 - 30 * U, y0 - bh - 70 * U, bw + 60 * U, bh + 150 * U, 18 * U); g.fill();
          items.forEach(([lab, v], q) => { const p = eOut((a - q * .18) / .7), h = bh * (v / mx) * p, x = x0 + q * slot + slot * .15, w = slot * .7; g.fillStyle = q === (e.hl ?? -1) ? '#ffd400' : ['#4fc3f7', '#ff8a65', '#aed581', '#ba68c8', '#ffd54f', '#e57373'][q % 6]; g.fillRect(x, y0 - h, w, h); font(30 * U, F.anton); g.fillStyle = '#fff'; g.textAlign = 'center'; if (p > .05) g.fillText(Math.round(v * p).toLocaleString('en-US') + (e.unit || ''), x + w / 2, y0 - h - 12 * U); font(24 * U, F.inter, 700); g.fillText(String(lab).slice(0, 14), x + w / 2, y0 + 34 * U); });
          if (e.title) { font(40 * U, F.anton); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(e.title, X, y0 - bh - 22 * U); } g.restore(); break; }
        case 'pie': {
          const r = (e.r ?? .16) * H, v = clamp((+e.value || 0) / 100), p = eOut(a / 1.0);
          g.save(); g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(X, Y, r + 16 * U, 0, 6.29); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(X, Y, r, 0, 6.29); g.fill();
          g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(X, Y); g.arc(X, Y, r, -Math.PI / 2, -Math.PI / 2 + v * p * 6.283); g.closePath(); g.fill();
          font(r * .5, F.anton); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Math.round(v * p * 100) + '%', X, Y); g.textBaseline = 'alphabetic'; g.restore(); if (e.label) badge(e.label, X, Y + r + 50 * U, a - .3); break; }
        case 'timeline': {
          const items = (e.items || []).slice(0, 7), y = Y, x0 = W * (V ? .08 : .1), x1 = W * (V ? .92 : .9), p = eOut(a / .8);
          g.save(); g.strokeStyle = '#fff'; g.lineWidth = 6 * U; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8 * U; g.beginPath(); g.moveTo(x0, y); g.lineTo(lerp(x0, x1, p), y); g.stroke();
          items.forEach(([yr, lab], q) => { const f = items.length > 1 ? q / (items.length - 1) : .5, x = lerp(x0, x1, f), pq = eBack((a - .3 - q * .3) / .3); if (pq <= 0) return; g.fillStyle = q === items.length - 1 ? '#ffd400' : '#fff'; g.beginPath(); g.arc(x, y, 12 * U * pq, 0, 6.29); g.fill(); font(40 * U, F.anton); g.textAlign = 'center'; g.fillText(String(yr), x, y - 30 * U); font(24 * U, F.inter, 700); g.fillText(String(lab || '').slice(0, 18), x, y + 48 * U); });
          g.restore(); break; }
        case 'particles': particles(e.kind || 'dust', t, clamp(a / .4) * (e.a ?? 1)); break;
        case 'stamp': { const p = a; if (p <= 0) break; const s2 = 1 + 1.4 * (1 - eOut(p / .25)); font((e.size || 90) * U, F.anton); const w = g.measureText(e.text || '').width + 60 * U, h = (e.size || 90) * 1.35 * U; g.save(); g.translate(X, Y); g.rotate(e.rot ?? -.16); g.scale(s2, s2); g.globalAlpha = .9 * clamp(p / .12); g.strokeStyle = e.color || '#d1121a'; g.lineWidth = 10 * U; g.strokeRect(-w / 2, -h / 2, w, h); g.fillStyle = e.color || '#d1121a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e.text || '', 0, 4 * U); g.restore(); g.textBaseline = 'alphabetic'; break; }
        case 'badge': badge(e.text || '', X, Y, a, e.bg || '#111', e.fg || '#fff', e.size || 36); break;
        case 'counter': { const v = Math.round((+e.value || 0) * eOut(a / 1.4)), txt = (e.prefix || '') + ((v >= 1000 && v <= 2100 && !e.suffix) ? String(v) : v.toLocaleString('en-US')) + (e.suffix || ''); const p = eBack(a / .3); font((e.size || 120) * U, F.anton); g.save(); g.translate(X, Y); g.scale(p, p); g.lineWidth = 12 * U; g.strokeStyle = '#111'; g.lineJoin = 'round'; g.textAlign = 'center'; g.strokeText(txt, 0, 0); g.fillStyle = '#ffd400'; g.fillText(txt, 0, 0); g.restore(); if (e.label) badge(e.label, X, Y + 50 * U, a - .3); break; }
      }
    });
  }
  // ---- transitions: composite the previous shot (buffer) over the current frame ----
  function transition(kind, p, buf) {
    const g = G(); p = clamp(p); const q = eIO(p);
    g.save();
    switch (kind) {
      case 'whip': { for (let k = 4; k >= 0; k--) { g.globalAlpha = (1 - q) * (k ? .18 : 1); g.drawImage(buf, -W * q - k * 40 * U * (1 - q) * 2, 0); } break; }
      case 'slide': g.drawImage(buf, 0, H * q); break;
      case 'zoom': { const s = 1 + q * .8; g.globalAlpha = 1 - q; g.filter = `blur(${q * 12 * U}px)`; g.translate(W / 2, H / 2); g.scale(s, s); g.drawImage(buf, -W / 2, -H / 2); g.filter = 'none'; break; }
      case 'iris': { const r = Math.hypot(W, H) * .6 * q; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, r, 0, 6.29, true); g.clip('evenodd'); g.drawImage(buf, 0, 0); g.restore(); g.save(); g.strokeStyle = '#000'; g.lineWidth = 20 * U; g.beginPath(); g.arc(W / 2, H / 2, r, 0, 6.29); g.stroke(); break; }
      case 'ink': { const b = document.createElement('canvas'); b.width = W; b.height = H; const c = b.getContext('2d'); c.drawImage(buf, 0, 0); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
        for (let k = 0; k < 7; k++) { const cx = W * (.2 + hash(k) * .6), cy = H * (.2 + hash(k + 5) * .6), r = Math.hypot(W, H) * .5 * clamp(q * 1.4 - k * .06); c.beginPath(); for (let a = 0; a <= 6.3; a += .2) { const rr2 = r * (1 + .12 * Math.sin(a * 5 + k)); c.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } c.fill(); }
        g.drawImage(b, 0, 0); break; }
      case 'tear': { const ex = W * q * 1.1 - W * .05; g.beginPath(); g.moveTo(ex, 0); for (let y = 0; y <= H; y += 30 * U) g.lineTo(ex + (hash(y * .37) - .5) * 40 * U, y); g.lineTo(W, H); g.lineTo(W, 0); g.closePath(); g.save(); g.clip(); g.drawImage(buf, 0, 0); g.restore();
        g.strokeStyle = '#f4ecda'; g.lineWidth = 14 * U; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 14 * U; g.beginPath(); g.moveTo(ex, 0); for (let y = 0; y <= H; y += 30 * U) g.lineTo(ex + (hash(y * .37) - .5) * 40 * U, y); g.stroke(); break; }
      case 'glitch': { const n = 14; for (let k = 0; k < n; k++) { if (hash(k + Math.floor(p * 20)) < p) continue; const y = H * k / n, h = H / n, off = (hash(k * 3 + Math.floor(p * 30)) - .5) * 160 * U * p; g.globalAlpha = 1; g.drawImage(buf, 0, y, W, h, off, y, W, h); } g.globalCompositeOperation = 'lighter'; g.globalAlpha = .25 * (1 - p); g.fillStyle = '#ff004c'; g.fillRect(0, 0, W, H); break; }
      case 'burn': { g.globalAlpha = 1 - q; g.drawImage(buf, 0, 0); g.globalAlpha = 1; const r = Math.hypot(W, H) * q; const gr = g.createRadialGradient(W * .3, H * .6, 0, W * .3, H * .6, r + 1); gr.addColorStop(0, 'rgba(255,255,230,0)'); gr.addColorStop(.85, `rgba(255,170,60,${.8 * (1 - p)})`); gr.addColorStop(1, 'rgba(255,90,0,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, 0, W, H); break; }
      default: { g.globalAlpha = 1 - q; g.drawImage(buf, 0, 0); }
    }
    g.restore();
  }
  return { gfx, transition, particles, badge };
};
