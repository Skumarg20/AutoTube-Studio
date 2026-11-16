// AutoTube Studio film template: "Archive Paper" style.
// Reads window.SPEC (written by the pipeline) and draws it deterministically: window.render(t) is a pure function of t.
(function () {
  const S = window.SPEC;
  const cv = document.getElementById('c');
  const W = innerWidth, H = innerHeight;
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const VERT = H > W;
  const U = Math.min(W, H) / 1080;           // 1 unit = 1px at 1080p short side
  const C = { paper: '#efe2c4', paper2: '#e3d1aa', ink: '#2a1f16', soft: '#6b5640', red: '#8c2e1c', gold: '#a7803f', capBg: 'rgba(32,22,14,0.80)', capInk: '#f6ecd6' };
  let SERIF = '"Cormorant Garamond", Georgia, serif'; const HAND = 'Caveat, cursive', MONO = '"IBM Plex Mono", monospace';
  // ---------- style presets: palette, heading font, background ----------
  const PRE = {
    paper: {},
    chalkboard: { head: 'Caveat, cursive', C: { ink: '#f3f1e7', soft: '#c9d6c8', red: '#f6b26b', gold: '#e8e3a8', capBg: 'rgba(10,25,18,0.82)', capInk: '#f3f1e7' } },
    blueprint: { head: '"IBM Plex Mono", monospace', C: { ink: '#f2f7ff', soft: '#a9c4ea', red: '#ffd166', gold: '#ffffff', capBg: 'rgba(8,30,66,0.85)', capInk: '#ffffff' } },
    newsreel: { C: { ink: '#f4f1ea', soft: '#c7c2b6', red: '#ffffff', gold: '#d8d2c2', capBg: 'rgba(0,0,0,0.75)', capInk: '#ffffff' } },
    hologram: { head: '"IBM Plex Mono", monospace', glow: true, C: { ink: '#c9fbff', soft: '#6fc3d1', red: '#00e5ff', gold: '#ff3df2', capBg: 'rgba(0,20,30,0.75)', capInk: '#c9fbff' } },
    risograph: { C: { ink: '#1d3b8c', soft: '#3c5aa8', red: '#ff3d9a', gold: '#ff3d9a', capBg: 'rgba(29,59,140,0.92)', capInk: '#fff4ea' } },
    keynote: { C: { ink: '#ffffff', soft: '#a7a7ad', red: '#ff6a3d', gold: '#ff6a3d', capBg: 'rgba(255,255,255,0.10)', capInk: '#ffffff' } },
    inkwash: { C: { ink: '#161616', soft: '#5b5751', red: '#b8312f', gold: '#b8312f', capBg: 'rgba(22,22,22,0.82)', capInk: '#f5efe2' } },
  };
  const STY = PRE[S.style] || PRE.paper; Object.assign(C, STY.C || {}); if (STY.head) SERIF = STY.head;
  window.DUR = S.dur;

  // ---------- helpers ----------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const eOut = x => 1 - Math.pow(1 - clamp(x), 3);
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function font(size, fam = SERIF, w = 500, it = false) { g.font = `${it ? 'italic ' : ''}${w} ${Math.round(size)}px ${fam}`; }
  function wrap(text, maxW) {
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
    for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (g.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; }
    if (cur) lines.push(cur); return lines;
  }
  // pick the biggest size (<= max) whose wrapped text fits in maxLines
  function fit(text, max, maxW, maxLines, fam = SERIF, w = 500, it = false) {
    let s = max, lines;
    for (; s > 14 * U; s *= 0.92) { font(s, fam, w, it); lines = wrap(text, maxW); if (lines.length <= maxLines && lines.every(l => g.measureText(l).width <= maxW)) break; }
    font(s, fam, w, it); return { size: s, lines: wrap(text, maxW) };
  }
  // text lines that rise and fade in, staggered
  function lines(L, x, y, size, lt, delay = 0, color = C.ink, align = 'center', lh = 1.12) {
    g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = color;
    L.lines.forEach((ln, i) => {
      const p = eOut((lt - delay - i * 0.12) / 0.7);
      g.globalAlpha *= 1; const a0 = g.globalAlpha;
      g.globalAlpha = a0 * p; g.fillText(ln, x, y + i * size * lh + (1 - p) * 18 * U);
      g.globalAlpha = a0;
    });
    return y + L.lines.length * size * lh;
  }
  function rule(cx, y, half, p, color = C.gold) {
    const h = half * ease(p); g.strokeStyle = color; g.lineWidth = 2 * U;
    g.beginPath(); g.moveTo(cx - h, y); g.lineTo(cx + h, y); g.stroke();
    if (p > 0.3) { g.fillStyle = color; g.save(); g.translate(cx, y); g.rotate(Math.PI / 4); const d = 7 * U * clamp((p - .3) / .4); g.fillRect(-d, -d, 2 * d, 2 * d); g.restore(); }
  }
  const textW = VERT ? W * 0.84 : W * 0.72;

  // ---------- paper background (built once) ----------
  const bg = document.createElement('canvas'); bg.width = Math.ceil(W * 1.08); bg.height = Math.ceil(H * 1.08);
  (function buildPaper() {
    const b = bg.getContext('2d'), BW = bg.width, BH = bg.height;
    const gr = b.createLinearGradient(0, 0, BW, BH); gr.addColorStop(0, C.paper); gr.addColorStop(1, C.paper2);
    b.fillStyle = gr; b.fillRect(0, 0, BW, BH);
    // blotches
    for (let i = 0; i < 26; i++) {
      const x = hash(i) * BW, y = hash(i + 50) * BH, r = (120 + hash(i + 99) * 380) * U;
      const rg = b.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(150,110,60,${0.035 + hash(i + 7) * 0.04})`); rg.addColorStop(1, 'rgba(150,110,60,0)');
      b.fillStyle = rg; b.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // speckle + fibres
    for (let i = 0; i < 9000; i++) { b.fillStyle = `rgba(60,40,20,${hash(i * 3.1) * 0.08})`; b.fillRect(hash(i * 1.7) * BW, hash(i * 2.3) * BH, 1.4 * U, 1.4 * U); }
    b.strokeStyle = 'rgba(90,60,30,0.06)'; b.lineWidth = 1;
    for (let i = 0; i < 260; i++) { const x = hash(i + 3e3) * BW, y = hash(i + 4e3) * BH, a = hash(i + 5e3) * 6.28, l = (10 + hash(i + 6e3) * 40) * U; b.beginPath(); b.moveTo(x, y); b.quadraticCurveTo(x + Math.cos(a + .5) * l * .5, y + Math.sin(a + .5) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); b.stroke(); }
    // vignette
    const vg = b.createRadialGradient(BW / 2, BH / 2, Math.min(BW, BH) * 0.35, BW / 2, BH / 2, Math.max(BW, BH) * 0.75);
    vg.addColorStop(0, 'rgba(40,25,10,0)'); vg.addColorStop(1, 'rgba(40,25,10,0.38)');
    b.fillStyle = vg; b.fillRect(0, 0, BW, BH);
  })();

  function paperBackground(t) {
    const dx = Math.sin(t * 0.05) * W * 0.03 - W * 0.04, dy = Math.cos(t * 0.04) * H * 0.03 - H * 0.04;
    g.drawImage(bg, dx, dy);
    // drifting graticule (map grid) - gives every scene a quiet "atlas" texture
    g.save(); g.strokeStyle = 'rgba(110,80,45,0.10)'; g.lineWidth = 1.2 * U;
    const R = Math.max(W, H) * 0.9, cx = W * 0.5 + Math.sin(t * 0.03) * 60 * U, cy = H * 1.15;
    for (let k = -6; k <= 6; k++) {   // meridians as ellipse arcs
      const rx = Math.abs(Math.sin((k / 6) * Math.PI / 2 + t * 0.01)) * R;
      g.beginPath(); g.ellipse(cx, cy, rx, R, 0, Math.PI, 2 * Math.PI); g.stroke();
    }
    for (let j = 1; j <= 7; j++) { const r = R * j / 7; g.beginPath(); g.ellipse(cx, cy, R, r, 0, Math.PI, 2 * Math.PI); g.stroke(); }
    g.restore();
    // floating dust
    for (let i = 0; i < 46; i++) {
      const sp = 6 + hash(i) * 14, x = (hash(i + 11) * W + Math.sin(t * 0.2 + i) * 30 * U) % W, y = ((hash(i + 23) * H - t * sp * U) % H + H) % H;
      g.fillStyle = `rgba(90,60,30,${0.10 + 0.12 * hash(i + 5)})`; g.beginPath(); g.arc(x, y, (1 + hash(i + 9) * 2.2) * U, 0, 6.29); g.fill();
    }
    // double frame
    const m = 34 * U; g.strokeStyle = 'rgba(80,55,30,0.45)'; g.lineWidth = 2 * U; g.strokeRect(m, m, W - 2 * m, H - 2 * m);
    g.lineWidth = 1 * U; g.strokeRect(m + 9 * U, m + 9 * U, W - 2 * m - 18 * U, H - 2 * m - 18 * U);
  }

  // ---------- other backgrounds ----------
  const fr = t => Math.floor(t * 24);
  function grain(t, n, col, sz = 1.6) { const f = fr(t); g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(hash(f * 977 + i) * W, hash(f * 613 + i * 3.7) * H, sz * U, sz * U); }
  function vignette(a) { const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,' + a + ')'); g.fillStyle = v; g.fillRect(0, 0, W, H); }
  const BGS = {
    paper: paperBackground,
    chalkboard(t) {
      g.fillStyle = '#23392f'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 18; i++) { const x = hash(i) * W, y = hash(i + 9) * H, r = (200 + hash(i + 3) * 500) * U; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,0.035)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 2500; i++) g.fillRect(hash(i * 1.3) * W, hash(i * 2.9) * H, 1.5 * U, 1.5 * U);
      g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 60 * U; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) { g.beginPath(); const y = hash(i + 40) * H; g.moveTo(-50, y); g.bezierCurveTo(W * .3, y + 80 * U, W * .6, y - 80 * U, W + 50, y + 20 * U); g.stroke(); }
      g.lineCap = 'butt';
      const m = 26 * U; g.strokeStyle = '#6b4a2b'; g.lineWidth = m * 1.4; g.strokeRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3 * U; g.strokeRect(m * .7, m * .7, W - m * 1.4, H - m * 1.4);
      vignette(0.35);
    },
    blueprint(t) {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#1f5aa6'); gr.addColorStop(1, '#173f7a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const s = 40 * U, ox = (t * 6 * U) % s;
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
      for (let x = -s + ox; x < W; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = -s + ox; y < H; y += s) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      for (let x = -s * 5 + ox; x < W; x += s * 5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = -s * 5 + ox; y < H; y += s * 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.setLineDash([10 * U, 8 * U]); g.beginPath(); g.arc(W * .82, H * .2, 160 * U, 0, 6.29); g.stroke(); g.setLineDash([]);
      g.save(); g.translate(W * .82, H * .2); g.rotate(t * 0.15); g.beginPath(); g.moveTo(-200 * U, 0); g.lineTo(200 * U, 0); g.moveTo(0, -200 * U); g.lineTo(0, 200 * U); g.stroke(); g.restore();
      const m = 30 * U; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2 * U; g.strokeRect(m, m, W - 2 * m, H - 2 * m);
      font(18 * U, MONO, 400); g.fillStyle = 'rgba(255,255,255,0.6)'; g.textAlign = 'right'; g.fillText('SHEET ' + String(1 + Math.floor(t / 10)).padStart(2, '0') + '  ·  ' + String(S.channel || '').toUpperCase(), W - m - 14 * U, H - m - 14 * U);
    },
    newsreel(t) {
      const f = fr(t), fl = 0.9 + 0.1 * hash(f * 1.7);
      const gr = g.createRadialGradient(W / 2, H * .45, 0, W / 2, H / 2, Math.max(W, H) * .7); gr.addColorStop(0, `rgb(${70 * fl | 0},${68 * fl | 0},${64 * fl | 0})`); gr.addColorStop(1, '#0d0d0c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      grain(t, 1600, 'rgba(255,255,255,0.06)'); grain(t + 99, 1200, 'rgba(0,0,0,0.25)');
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5 * U; for (let k = 0; k < 2; k++) { if (hash(f * 3 + k) > .55) { const x = hash(f * 7 + k) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6 * U, H); g.stroke(); } }
      if (hash(f * 11) > .93) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(hash(f) * W, hash(f + 1) * H, (3 + hash(f + 2) * 6) * U, 0, 6.29); g.fill(); }
      vignette(0.7);
      const m = 22 * U; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = m * 2; if (g.roundRect) { g.beginPath(); g.roundRect(-m * .2, -m * .2, W + m * .4, H + m * .4, 60 * U); g.stroke(); }
    },
    hologram(t) {
      g.fillStyle = '#03070d'; g.fillRect(0, 0, W, H);
      const hz = H * .62; g.strokeStyle = 'rgba(0,229,255,0.25)'; g.lineWidth = 1.2 * U;
      for (let i = -20; i <= 20; i++) { g.beginPath(); g.moveTo(W / 2 + i * 30 * U, hz); g.lineTo(W / 2 + i * 260 * U, H); g.stroke(); }
      for (let k = 0; k < 14; k++) { const p = ((k + (t * 0.6) % 1) / 14), y = hz + (H - hz) * p * p; g.globalAlpha = p; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.globalAlpha = 1;
      const hg = g.createLinearGradient(0, hz - 120 * U, 0, hz + 30 * U); hg.addColorStop(0, 'rgba(255,61,242,0)'); hg.addColorStop(1, 'rgba(255,61,242,0.18)'); g.fillStyle = hg; g.fillRect(0, hz - 120 * U, W, 150 * U);
      g.fillStyle = 'rgba(0,229,255,0.04)'; for (let y = (t * 40 * U) % (4 * U); y < H; y += 4 * U) g.fillRect(0, y, W, 1.2 * U);
      const m = 40 * U, L = 70 * U; g.strokeStyle = 'rgba(0,229,255,0.7)'; g.lineWidth = 3 * U;
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, a, b]) => { g.beginPath(); g.moveTo(x, y + b * L); g.lineTo(x, y); g.lineTo(x + a * L, y); g.stroke(); });
      const ss = Math.floor(t), tc = String(Math.floor(ss / 60)).padStart(2, '0') + ':' + String(ss % 60).padStart(2, '0') + ':' + String(fr(t) % 24).padStart(2, '0');
      font(18 * U, MONO, 400); g.fillStyle = 'rgba(0,229,255,0.7)'; g.textAlign = 'left'; g.fillText('REC ● ' + tc + '  //  ARCHIVE SCAN', m + 10 * U, m + 40 * U);
    },
    risograph(t) {
      g.fillStyle = '#f6f0e4'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'multiply';
      const blobs = [['#ff48b0', .2, .25, 380], ['#0078bf', .78, .3, 300], ['#ffe800', .7, .82, 340], ['#0078bf', .15, .85, 260]];
      blobs.forEach(([c, x, y, r], i) => {
        const cx = W * x + Math.sin(t * .2 + i) * 40 * U, cy = H * y + Math.cos(t * .17 + i) * 40 * U, R = r * U, st = 14 * U;
        g.fillStyle = c; g.globalAlpha = 0.55;
        for (let yy = cy - R; yy < cy + R; yy += st) for (let xx = cx - R; xx < cx + R; xx += st) { const d = Math.hypot(xx - cx, yy - cy) / R; if (d < 1) { g.beginPath(); g.arc(xx + i * 3 * U, yy, st * .48 * (1 - d * .7), 0, 6.29); g.fill(); } }
      });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 2500; i++) g.fillRect(hash(i * 1.9) * W, hash(i * 3.3) * H, 1.4 * U, 1.4 * U);
    },
    keynote(t) {
      g.fillStyle = '#050506'; g.fillRect(0, 0, W, H);
      const x = W * (.5 + .12 * Math.sin(t * .1)), y = H * .38, rg = g.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * .6);
      rg.addColorStop(0, 'rgba(255,106,61,0.20)'); rg.addColorStop(.5, 'rgba(90,40,160,0.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
      grain(t, 500, 'rgba(255,255,255,0.025)');
    },
    inkwash(t) {
      g.fillStyle = '#f2ebdd'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(120,100,70,0.05)'; for (let i = 0; i < 3000; i++) g.fillRect(hash(i * 1.1) * W, hash(i * 2.7) * H, 1.5 * U, 1.5 * U);
      for (let L = 0; L < 4; L++) {
        const base = H * (.72 + L * .07), amp = (120 - L * 20) * U, a = 0.10 + L * 0.07, off = t * (2 + L * 3) * U;
        g.fillStyle = `rgba(22,22,22,${a})`; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8 * U) { const u = (x + off) / W; g.lineTo(x, base - amp * (Math.abs(Math.sin(u * 3.1 + L * 2)) * .7 + .3 * Math.sin(u * 11 + L))); }
        g.lineTo(W, H); g.fill();
      }
      g.fillStyle = 'rgba(184,49,47,0.85)'; g.beginPath(); g.arc(W * .8, H * (VERT ? .14 : .2), 70 * U, 0, 6.29); g.fill();
      const sx = 60 * U, sy = H - 150 * U; g.fillStyle = '#b8312f'; g.fillRect(sx, sy, 70 * U, 90 * U); font(26 * U, SERIF, 500); g.fillStyle = '#f2ebdd'; g.textAlign = 'center';
      String(S.channel || 'MM').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase().split('').forEach((ch, i) => g.fillText(ch, sx + 35 * U, sy + 38 * U + i * 30 * U));
    },
  };
  function background(t) { (BGS[S.style] || paperBackground)(t); }

  // ---------- scenes ----------
  const cy0 = VERT ? H * 0.40 : H * 0.46;   // optical centre (leave room for captions)
  const SC = {
    title(s, lt) {
      font(26 * U, MONO, 400); g.textAlign = 'center'; g.fillStyle = C.red;
      g.globalAlpha *= 1; const a = g.globalAlpha; g.globalAlpha = a * eOut(lt / 0.6);
      g.fillText(String(s.kicker || S.series || '').toUpperCase().split('').join(' '), W / 2, cy0 - 150 * U); g.globalAlpha = a;
      const L = fit(s.heading, (VERT ? 120 : 132) * U, textW, 3);
      const yEnd = lines(L, W / 2, cy0 - 40 * U, L.size, lt, 0.25);
      rule(W / 2, yEnd - L.size * 0.55 + 40 * U, 180 * U, (lt - 0.8) / 0.9);
      if (s.sub) { const M = fit(s.sub, 48 * U, textW * 0.9, 2, SERIF, 400, true); lines(M, W / 2, yEnd + 70 * U, M.size, lt, 1.1, C.soft); }
    },
    chapter(s, lt) {
      g.save(); font((VERT ? 520 : 620) * U, SERIF, 500); g.textAlign = 'center'; g.fillStyle = 'rgba(140,46,28,0.07)';
      g.fillText(roman(s.n || 1), W / 2 + Math.sin(lt * 0.3) * 20 * U, cy0 + 200 * U); g.restore();
      font(28 * U, MONO, 400); g.textAlign = 'center'; g.fillStyle = C.red; const a = g.globalAlpha; g.globalAlpha = a * eOut(lt / .6);
      g.fillText(('Chapter ' + roman(s.n || 1)).toUpperCase().split('').join(' '), W / 2, cy0 - 90 * U); g.globalAlpha = a;
      rule(W / 2, cy0 - 60 * U, 120 * U, (lt - .2) / .8);
      const L = fit(s.heading, 104 * U, textW, 3); const y = lines(L, W / 2, cy0 + 40 * U, L.size, lt, .4);
      if (s.sub) { const M = fit(s.sub, 44 * U, textW * .9, 2, SERIF, 400, true); lines(M, W / 2, y + 30 * U, M.size, lt, 1, C.soft); }
    },
    date(s, lt, d) {
      const raw = String(s.big || ''), m = /^(\D*?)(\d{2,4})(.*)$/.exec(raw);
      let shown = raw;
      if (m && !/BC/i.test(raw)) { const yr = +m[2], p = ease(lt / 1.6); shown = m[1] + Math.round(yr - (1 - p) * Math.min(60, yr * 0.1)) + m[3]; }
      let bs = (VERT ? 230 : 260) * U; font(bs, SERIF, 500); const bw = g.measureText(raw).width; if (bw > textW) { bs *= textW / bw; font(bs, SERIF, 500); }
      g.textAlign = 'center'; g.fillStyle = C.red;
      const a = g.globalAlpha; g.globalAlpha = a * eOut(lt / .5); g.fillText(shown, W / 2, cy0 + 20 * U); g.globalAlpha = a;
      // timeline
      const y = cy0 + 105 * U, x0 = W * (VERT ? .1 : .16), x1 = W - x0, p = ease(lt / 1.2);
      g.strokeStyle = C.ink; g.lineWidth = 2 * U; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + (x1 - x0) * p, y); g.stroke();
      for (let i = 0; i <= 20; i++) { const x = x0 + (x1 - x0) * i / 20; if (x > x0 + (x1 - x0) * p) break; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - (i % 5 ? 8 : 18) * U); g.stroke(); }
      const mk = x0 + (x1 - x0) * (0.25 + 0.5 * ease(lt / Math.max(2, d))); g.fillStyle = C.red; g.beginPath(); g.arc(mk, y, 9 * U * eOut((lt - .6) / .4), 0, 6.29); g.fill();
      const L = fit(s.heading, 64 * U, textW, 2); const y2 = lines(L, W / 2, y + 100 * U, L.size, lt, .7);
      if (s.sub) { const M = fit(s.sub, 40 * U, textW * .9, 2, SERIF, 400, true); lines(M, W / 2, y2 + 14 * U, M.size, lt, 1.1, C.soft); }
    },
    place(s, lt) {
      const r = (VERT ? 150 : 170) * U, cx = W / 2, cy = cy0 - r * 0.9;
      compass(cx, cy, r, lt);
      const L = fit(s.heading, 110 * U, textW, 2); const y = lines(L, W / 2, cy + r + 120 * U, L.size, lt, .5);
      if (s.sub) { font(30 * U, MONO, 400); const M = { lines: wrap(String(s.sub).toUpperCase(), textW) }; lines(M, W / 2, y + 10 * U, 30 * U, lt, 1, C.soft, 'center', 1.4); }
    },
    fact(s, lt) {
      const B = fit(s.big || s.heading, (VERT ? 200 : 220) * U, textW, 2);
      g.save(); const sc = 0.85 + 0.15 * eOut(lt / .7); g.translate(W / 2, cy0); g.scale(sc, sc); g.translate(-W / 2, -cy0);
      const y = lines(B, W / 2, cy0 - (B.lines.length - 1) * B.size * 0.5, B.size, lt, 0, C.red); g.restore();
      rule(W / 2, y - B.size * 0.6 + 50 * U, 140 * U, (lt - .5) / .8);
      const L = fit(s.big ? s.heading : s.sub, 58 * U, textW, 3); lines(L, W / 2, y + 60 * U, L.size, lt, .7);
    },
    quote(s, lt) {
      font(300 * U, SERIF, 500); g.textAlign = 'center'; g.fillStyle = 'rgba(140,46,28,0.18)'; g.fillText('“', W / 2, cy0 - 70 * U);
      const L = fit(s.heading, 74 * U, textW, VERT ? 7 : 4, SERIF, 400, true);
      const y = lines(L, W / 2, cy0 - (L.lines.length - 1) * L.size * 0.55 + 20 * U, L.size, lt, .2);
      if (s.sub) { font(30 * U, MONO, 400); const M = { lines: ['— ' + String(s.sub).toUpperCase()] }; lines(M, W / 2, y + 40 * U, 30 * U, lt, 1.2, C.red); }
    },
    list(s, lt, d) {
      const items = (s.items || []).slice(0, 5);
      const H1 = fit(s.heading, 80 * U, textW, 2); let y = lines(H1, W / 2, cy0 - (VERT ? 260 : 210) * U, H1.size, lt, 0);
      rule(W / 2, y - H1.size * 0.6 + 34 * U, 160 * U, (lt - .3) / .7); y += 50 * U;
      const step = Math.max(0.6, (d - 1) / Math.max(1, items.length));
      const x = VERT ? W * 0.12 : W * 0.25, iw = VERT ? W * 0.76 : W * 0.55;
      items.forEach((it, i) => {
        const p = eOut((lt - 0.6 - i * step) / 0.6); if (p <= 0) return;
        const I = fit(it, 52 * U, iw - 60 * U, 2);
        const a = g.globalAlpha; g.globalAlpha = a * p;
        g.fillStyle = C.red; g.beginPath(); g.arc(x + 14 * U, y - I.size * 0.32, 8 * U, 0, 6.29); g.fill();
        g.fillStyle = C.ink; g.textAlign = 'left'; I.lines.forEach((ln, k) => g.fillText(ln, x + 48 * U + (1 - p) * 30 * U, y + k * I.size * 1.1));
        g.globalAlpha = a; y += I.lines.length * I.size * 1.1 + 26 * U;
      });
    },
    outro(s, lt) {
      font(30 * U, MONO, 400); g.textAlign = 'center'; g.fillStyle = C.red; const a = g.globalAlpha; g.globalAlpha = a * eOut(lt / .6);
      g.fillText(String(S.channel || '').toUpperCase().split('').join(' '), W / 2, cy0 - 120 * U); g.globalAlpha = a;
      const L = fit(s.heading || 'Thanks for watching', 100 * U, textW, 3); const y = lines(L, W / 2, cy0, L.size, lt, .2);
      rule(W / 2, y - L.size * 0.6 + 40 * U, 160 * U, (lt - .6) / .8);
      if (s.sub) { const M = fit(s.sub, 56 * U, textW, 2, HAND, 600); lines(M, W / 2, y + 90 * U, M.size, lt, 1, C.soft); }
    },
  };
  SC.text = function (s, lt) {
    const L = fit(s.heading, 96 * U, textW, 3); const y = lines(L, W / 2, cy0 - (L.lines.length - 1) * L.size * 0.5, L.size, lt, 0);
    if (s.sub) { const M = fit(s.sub, 46 * U, textW * .9, 3, SERIF, 400, true); lines(M, W / 2, y + 20 * U, M.size, lt, .6, C.soft); }
  };

  function roman(n) { const v = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; n = Math.max(1, Math.min(39, n | 0)); for (const [k, r] of v) while (n >= k) { s += r; n -= k; } return s; }
  function compass(cx, cy, r, lt) {
    const p = ease(lt / 1.2), rot = (1 - p) * 1.4 + Math.sin(lt * 0.4) * 0.04;
    g.save(); g.translate(cx, cy); g.rotate(rot); g.globalAlpha *= p;
    g.strokeStyle = C.ink; g.lineWidth = 2 * U; g.beginPath(); g.arc(0, 0, r, 0, 6.29); g.stroke();
    g.lineWidth = 1 * U; g.beginPath(); g.arc(0, 0, r * 0.86, 0, 6.29); g.stroke();
    for (let i = 0; i < 32; i++) { const a = i / 32 * 6.283, l = i % 8 ? (i % 4 ? .06 : .1) : .14; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * r * (1 - l), Math.sin(a) * r * (1 - l)); g.stroke(); }
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * 6.283 - Math.PI / 2, L = i % 2 ? r * .45 : r * .8, w = r * (i % 2 ? .07 : .11);
      g.fillStyle = i % 2 ? C.gold : (i === 0 ? C.red : C.ink);
      g.beginPath(); g.moveTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + 1.5708) * w, Math.sin(a + 1.5708) * w); g.lineTo(0, 0); g.lineTo(Math.cos(a - 1.5708) * w, Math.sin(a - 1.5708) * w); g.closePath(); g.fill();
    }
    g.rotate(-rot); font(r * 0.2, SERIF, 500); g.fillStyle = C.red; g.textAlign = 'center'; g.fillText('N', 0, -r - 14 * U);
    g.restore();
  }

  // ---------- captions ----------
  function captions(t) {
    const c = (S.captions || []).find(c => t >= c.s && t < c.e); if (!c) return;
    const size = (VERT ? 62 : 46) * U; font(size, SERIF, 500);
    const L = wrap(c.text, VERT ? W * 0.82 : W * 0.7).slice(0, 2), lh = size * 1.18;
    const bw = Math.max(...L.map(l => g.measureText(l).width)) + 56 * U, bh = L.length * lh + 30 * U;
    const by = VERT ? H * 0.70 : H - 70 * U - bh;
    const a = clamp((t - c.s) / 0.12) * clamp((c.e - t) / 0.12);
    g.save(); g.globalAlpha = a; g.fillStyle = C.capBg;
    rr(W / 2 - bw / 2, by, bw, bh, 12 * U); g.fill();
    g.fillStyle = C.capInk; g.textAlign = 'center'; g.textBaseline = 'middle';
    L.forEach((l, i) => g.fillText(l, W / 2, by + 15 * U + lh * (i + 0.5)));
    g.restore(); g.textBaseline = 'alphabetic';
  }
  function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ---------- render ----------
  // tolerate scripts that put the year / number in "sub" instead of "big"
  const scenes = S.scenes.map(s => {
    s = { ...s };
    if ((s.kind === 'date' || s.kind === 'fact') && !s.big) {
      const yearish = v => /d/.test(v || '') && String(v).length <= 24;
      if (yearish(s.sub)) { s.big = s.sub; s.sub = ''; } else if (yearish(s.heading) && s.sub) { s.big = s.heading; s.heading = s.sub; s.sub = ''; }
      else if (s.kind === 'date') s.kind = 'text';
    }
    return s;
  });
  function drawScene(s, t, alpha) {
    if (!s || alpha <= 0) return;
    const fn = SC[s.kind] || SC.text, lt = t - s.start, d = s.end - s.start;
    g.save(); g.globalAlpha = alpha;
    const z = 1 + 0.025 * clamp(lt / Math.max(d, 1));   // slow push-in
    g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
    fn(s, lt, d); g.restore();
  }
  window.render = function (t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    background(t);
    let i = scenes.findIndex(s => t >= s.start && t < s.end); if (i < 0) i = t < 0.01 ? 0 : scenes.length - 1;
    const s = scenes[i], lt = t - s.start, X = 0.5;
    if (i > 0 && lt < X) drawScene(scenes[i - 1], t, 1 - lt / X);
    if (STY.glow) { g.shadowColor = C.red; g.shadowBlur = 18 * U; }
    drawScene(s, t, i > 0 ? clamp(lt / X) : 1);
    g.shadowBlur = 0;
    captions(t);
    // fade from/to black at the very start and end
    const f = Math.max(clamp(1 - t / 0.5), clamp((t - (S.dur - 0.8)) / 0.8));
    if (f > 0) { g.globalAlpha = f; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  };
  window.TEXTS = t => []; // readcheck not used
  document.fonts.ready.then(() => Promise.all([
    document.fonts.load(`500 40px "Cormorant Garamond"`), document.fonts.load(`italic 400 40px "Cormorant Garamond"`),
    document.fonts.load(`600 40px Caveat`), document.fonts.load(`400 20px "IBM Plex Mono"`)])).then(() => { window.render(0); window.READY = true; });
})();
