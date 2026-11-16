// "How a Pinch of Salt Shook an Empire": multi-style documentary engine (preview of History Studio v2).
// Deterministic: window.render(t) depends only on t. Data: timeline.js (window.TL), map.js (window.MAP), img/*.jpg.
(function () {
  const TL = window.TL, cv = document.getElementById('c'), W = innerWidth, H = innerHeight;
  cv.width = W; cv.height = H; const g = cv.getContext('2d'); const U = H / 1080;
  window.DUR = TL.dur;
  const F = { anton: 'Anton, Impact, sans-serif', inter: 'Inter, Arial, sans-serif', type: '"Special Elite", "Courier New", monospace', fell: '"IM Fell English", Georgia, serif', mono: '"JetBrains Mono", Consolas, monospace', corm: '"Cormorant Garamond", Georgia, serif', bebas: '"Bebas Neue", Anton, sans-serif' };
  // ---------- utils ----------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
  const eOut = x => 1 - Math.pow(1 - clamp(x), 3), eIO = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const eBack = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const font = (px, fam, w = 400, it = false) => { g.font = `${it ? 'italic ' : ''}${w} ${Math.round(px)}px ${fam}`; };
  const fr = t => Math.floor(t * 30);
  function fitText(txt, fam, w, max, maxW) { let s = max; font(s, fam, w); while (g.measureText(txt).width > maxW && s > 10) { s *= 0.94; font(s, fam, w); } return s; }
  function wrap(text, maxW) { const ws = String(text).split(/\s+/), L = []; let c = ''; for (const w of ws) { const t2 = c ? c + ' ' + w : w; if (g.measureText(t2).width > maxW && c) { L.push(c); c = w; } else c = t2; } if (c) L.push(c); return L; }
  function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }

  // ---------- images ----------
  const IMG = {}; const want = new Set();
  for (const s of TL.shots) for (const k of ['img', 'a', 'b', 'inset']) if (s[k]) want.add(s[k]);
  ['img19', 'img06', 'img15', 'img14', 'img05', 'img04', 'img01', 'img03', 'img20'].forEach(x => want.add(x));
  // stand-ins when a slot has no licensed photo
  const ALIAS = { img17: 'img16', img20: 'img11_b', img12: 'img14', img18: 'img01', img19: 'img05' };
  const loadOne = (id, src) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[id] = im; res(true); }; im.onerror = () => res(false); im.src = 'img/' + src + '.jpg'; });
  const loads = [...want].map(id => loadOne(id, id).then(ok => ok || !ALIAS[id] ? 0 : loadOne(id, ALIAS[id])));
  // where the subject sits in each photo (for crops)
  const FOC = { img02: [.38, .55], img05: [.5, .14], img15: [.5, .28], img13: [.5, .22], img14: [.5, .12], img11: [.45, .45], img11_b: [.4, .35], img01: [.5, .45], img03: [.5, .5] };
  const foc = (id, d) => FOC[id] || d;
  // draw image to cover box with ken-burns zoom z around focus (fx, fy in 0..1)
  function cover(im, x, y, w, h, z = 1, fx = .5, fy = .5, filter = '') {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (!im) { const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#5b5248'); gr.addColorStop(1, '#2c2722'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore(); return; }
    const s = Math.max(w / im.width, h / im.height) * z, iw = im.width * s, ih = im.height * s;
    const ox = x + (w - iw) * fx, oy = y + (h - ih) * fy;
    if (filter) g.filter = filter; g.drawImage(im, ox, oy, iw, ih); g.filter = 'none'; g.restore();
  }
  // ---------- textures ----------
  const GR = [0, 1, 2, 3, 4, 5].map(k => mk(512, 512, (c, w, h) => { const d = c.createImageData(w, h); for (let i = 0; i < w * h; i++) { const v = hash(i * 1.37 + k * 9973) * 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; } c.putImageData(d, 0, 0); }));
  function grain(t, a, mode = 'overlay') { g.save(); g.globalAlpha = a; g.globalCompositeOperation = mode; const p = g.createPattern(GR[fr(t) % 6], 'repeat'); g.translate((fr(t) * 37) % 512, (fr(t) * 91) % 512); g.fillStyle = p; g.fillRect(-512, -512, W + 1024, H + 1024); g.restore(); }
  const CORK = mk(W, H, (c, w, h) => { c.fillStyle = '#9c6b3f'; c.fillRect(0, 0, w, h); for (let i = 0; i < 60000; i++) { const v = hash(i * 2.1); c.fillStyle = v > .5 ? `rgba(60,30,10,${hash(i) * .35})` : `rgba(230,180,120,${hash(i + 7) * .25})`; c.fillRect(hash(i * 3.3) * w, hash(i * 5.7) * h, 1 + hash(i * 7.1) * 3, 1 + hash(i * 1.9) * 3); } const v = c.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, w * .7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = v; c.fillRect(0, 0, w, h); });
  const LIGHT = mk(W, H, (c, w, h) => { const gr = c.createRadialGradient(w * .5, h * .45, 50, w * .5, h * .5, w * .75); gr.addColorStop(0, '#fffdf6'); gr.addColorStop(.6, '#efe9da'); gr.addColorStop(1, '#bdb4a0'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(120,110,90,.10)'; c.lineWidth = 1; for (let x = 0; x < w; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  function vignette(a, inner = .35) { const v = g.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, W * .72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }

  // ---------- shot lookup ----------
  const S = TL.shots;
  const shotAt = t => { let i = 0; while (i + 1 < S.length && S[i + 1].t <= t) i++; return i; };
  const endOf = i => i + 1 < S.length ? S[i + 1].t : TL.dur;

  // ================= NEWS (caption-news) =================
  function ticker(t, label = 'SALT MARCH · 1930') {
    const h = 64 * U, y = H - h; g.fillStyle = '#c8102e'; g.fillRect(0, y, 230 * U, h); g.fillStyle = '#111'; g.fillRect(230 * U, y, W, h);
    font(30 * U, F.anton); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText('MAP & MYTH', 115 * U, y + h / 2);
    g.save(); g.beginPath(); g.rect(240 * U, y, W, h); g.clip(); font(28 * U, F.inter, 700); g.textAlign = 'left'; g.fillStyle = '#f2f2f2';
    const msg = `${label}   ●   A PINCH OF SALT VS THE BRITISH EMPIRE   ●   385 KM ON FOOT   ●   24 DAYS   ●   60,000 ARRESTS   ●   `; const mw = g.measureText(msg).width, x0 = 260 * U - ((t * 140 * U) % mw);
    for (let x = x0; x < W; x += mw) g.fillText(msg, x, y + h / 2 + 1); g.restore(); g.textBaseline = 'alphabetic';
  }
  function halftone(alpha, col) { g.save(); g.globalAlpha = alpha; g.fillStyle = col; const s = 16 * U; for (let y = 0; y < H; y += s) for (let x = (y / s % 2) * s / 2; x < W; x += s) { const r = s * .42 * (0.3 + 0.7 * (y / H)); g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill(); } g.restore(); }
  function newsBg(s, lt, dim = .42) {
    cover(IMG[s.img], 0, 0, W, H, 1.08 + lt * 0.02, ...foc(s.img, [.5, .4]), `grayscale(.4) brightness(${dim}) contrast(1.15)`);
    g.fillStyle = 'rgba(160,0,20,0.18)'; g.fillRect(0, 0, W, H); halftone(.10, '#000'); vignette(.6);
  }
  function tag(txt, x, y, p, bg = '#c8102e', fg = '#fff', size = 34) {
    font(size * U, F.anton); const w = g.measureText(txt).width + 36 * U, h = size * 1.5 * U; g.save(); g.translate(x, y); g.scale(eBack(p), 1);
    g.fillStyle = bg; g.fillRect(0, -h / 2, w, h); g.fillStyle = fg; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(txt, 18 * U, 2 * U); g.restore(); g.textBaseline = 'alphabetic';
  }
  const NEWS = {
    news(s, lt) {
      newsBg(s, lt);
      const x = 120 * U; let y = H * .30;
      tag(s.kicker || 'BREAKING', x, y - 40 * U, lt / 0.25, '#c8102e', '#fff', 44);
      s.head.forEach((ln, i) => {
        const p = eOut((lt - 0.08 - i * 0.12) / 0.3), size = fitText(ln, F.anton, 400, 150 * U, W - 260 * U);
        font(size, F.anton); const w = g.measureText(ln).width, yy = y + 40 * U + (i + 1) * size * 1.02;
        g.save(); g.globalAlpha = p; g.translate((1 - p) * -60 * U, 0);
        if (i === s.hl) { g.fillStyle = '#ffd400'; g.fillRect(x - 14 * U, yy - size * .86, (w + 28 * U) * eOut((lt - .25 - i * .12) / .3), size * .98); g.fillStyle = '#111'; } else g.fillStyle = '#fff';
        g.textAlign = 'left'; g.fillText(ln, x, yy); g.restore();
      });
      ticker(lt + s.t);
    },
    punch(s, lt) {
      const k = S.indexOf(s), bg = s.gold ? '#ffd400' : (k % 2 ? '#111' : '#c8102e');
      if (s.img) { cover(IMG[s.img], 0, 0, W, H, 1.25 - lt * .03, .5, .5, 'brightness(.55) saturate(1.2)'); g.fillStyle = 'rgba(255,212,0,.55)'; g.fillRect(0, 0, W, H); } else { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
      const sh = (1 - clamp(lt / .25)) * 18 * U, p = eBack(lt / .22);
      g.save(); g.translate(W / 2 + (hash(fr(lt)) - .5) * sh, H / 2 + (hash(fr(lt) + 3) - .5) * sh); g.scale(1.6 - .6 * p, 1.6 - .6 * p);
      const size = fitText(s.text, F.anton, 400, 230 * U, W * .86); font(size, F.anton); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = s.gold || s.img ? '#111' : '#fff'; g.fillText(s.text, 0, 0); g.restore(); g.textBaseline = 'alphabetic';
    },
    newslist(s, lt) {
      newsBg(s, lt, .35); tag('THE STORY', 120 * U, 230 * U, lt / .25);
      s.items.forEach(([txt, at], i) => {
        const p = eOut((s.t + lt - at) / .25); if (p <= 0) return; const y = 330 * U + i * 170 * U;
        font(110 * U, F.anton); const w = g.measureText(txt).width;
        g.save(); g.translate((1 - p) * -W * .3, 0); g.fillStyle = i === 2 ? '#ffd400' : '#fff'; g.fillRect(100 * U, y, w + 60 * U, 140 * U);
        g.fillStyle = '#111'; g.textAlign = 'left'; g.fillText(txt, 130 * U, y + 115 * U); g.restore();
      });
      ticker(lt + s.t);
    },
    tease(s, lt) {
      cover(IMG[s.img], 0, 0, W, H, 1.1 + lt * .02, .5, .5, `blur(${Math.max(4, 26 - lt * 4) * U}px) brightness(.5)`); halftone(.12, '#000');
      const p = eBack(lt / .3); g.save(); g.translate(W / 2, H * .44); g.scale(p, p); font(170 * U, F.anton); g.textAlign = 'center'; g.fillStyle = '#ffd400'; g.fillText(s.head, 0, 0); g.restore();
      font(56 * U, F.inter, 900); g.textAlign = 'center'; g.fillStyle = '#fff'; g.globalAlpha = eOut((lt - .4) / .4); g.fillText(s.sub, W / 2, H * .44 + 110 * U); g.globalAlpha = 1;
      // pulsing "?" ring
      g.strokeStyle = 'rgba(255,212,0,.6)'; g.lineWidth = 6 * U; const r = (200 + (lt * 260) % 260) * U; g.globalAlpha = 1 - ((lt * 260) % 260) / 260; g.beginPath(); g.arc(W / 2, H * .4, r, 0, 6.29); g.stroke(); g.globalAlpha = 1;
      ticker(lt + s.t);
    },
    end(s, lt) {
      g.fillStyle = '#111'; g.fillRect(0, 0, W, H); halftone(.08, '#c8102e');
      const p = eBack(lt / .4); g.save(); g.translate(W / 2, H * .3); g.scale(p, p); font(140 * U, F.anton); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('MAP & MYTH', 0, 0); g.restore();
      // subscribe button with click
      const bp = eBack((lt - .5) / .3), bx = W / 2, by = H * .46; g.save(); g.translate(bx, by); g.scale(bp, bp); const clicked = lt > 1.6;
      g.fillStyle = clicked ? '#3a3a3a' : '#c8102e'; rr(-230 * U, -55 * U, 460 * U, 110 * U, 18 * U); g.fill(); font(54 * U, F.inter, 900); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(clicked ? 'SUBSCRIBED ✓' : 'SUBSCRIBE', 0, 4 * U); g.restore(); g.textBaseline = 'alphabetic';
      // cursor
      const cp = eIO((lt - .8) / .7); g.fillStyle = '#fff'; g.save(); g.translate(lerp(W * .8, bx + 60 * U, cp), lerp(H * .85, by + 20 * U, cp)); g.scale(lt > 1.55 && lt < 1.7 ? .85 : 1, lt > 1.55 && lt < 1.7 ? .85 : 1); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 48 * U); g.lineTo(13 * U, 36 * U); g.lineTo(24 * U, 58 * U); g.lineTo(32 * U, 54 * U); g.lineTo(21 * U, 33 * U); g.lineTo(38 * U, 33 * U); g.closePath(); g.fill(); g.restore();
      // next episode card
      const np = eOut((lt - 2.2) / .5); g.globalAlpha = np; g.fillStyle = '#ffd400'; g.fillRect(W / 2 - 420 * U, H * .62, 840 * U, 190 * U); g.fillStyle = '#111'; font(34 * U, F.inter, 900); g.textAlign = 'center'; g.fillText('NEXT EPISODE', W / 2, H * .62 + 60 * U); font(80 * U, F.anton); g.fillText('THE DARK STORY OF SUGAR', W / 2, H * .62 + 150 * U); g.globalAlpha = 1;
    },
  };

  // ================= LIGHT TABLE (archive) =================
  function tape(x, y, w, h, rot) { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = 'rgba(240,230,190,.72)'; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = 'rgba(0,0,0,.06)'; g.strokeRect(-w / 2, -h / 2, w, h); g.restore(); }
  function lightBase(t) { g.drawImage(LIGHT, 0, 0); grain(t, .05); }
  function label(txt, x, y, rot = -0.02) { font(38 * U, F.type); const w = g.measureText(txt).width + 40 * U; g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = '#fbf7ea'; g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 8 * U; g.fillRect(-w / 2, -32 * U, w, 64 * U); g.shadowBlur = 0; g.fillStyle = '#2a2a2a'; g.textAlign = 'center'; g.fillText(txt, 0, 12 * U); g.restore(); }
  function stamp(txt, x, y, p, rot = -0.18, size = 86) {
    if (p <= 0) return; const s = 1 + 1.4 * (1 - eOut(p / .25)); font(size * U, F.anton); const w = g.measureText(txt).width + 60 * U, h = size * 1.35 * U;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.globalAlpha = .88 * clamp(p / .12); g.strokeStyle = '#c0141c'; g.lineWidth = 9 * U; g.strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle = '#c0141c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 4 * U); g.restore(); g.textBaseline = 'alphabetic';
  }
  const LIGHTS = {
    photo(s, lt, d) {
      lightBase(s.t + lt); const k = S.indexOf(s), rot = (hash(k) - .5) * .06, pw = W * .6, ph = H * .6, cx = W / 2 + (hash(k + 2) - .5) * 80 * U, cy = H * .42;
      const p = eOut(lt / .35); g.save(); g.translate(cx + (1 - p) * 200 * U, cy); g.rotate(rot + (1 - p) * .1);
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 40 * U; g.shadowOffsetY = 14 * U; g.fillStyle = '#fbfaf5'; g.fillRect(-pw / 2 - 22 * U, -ph / 2 - 22 * U, pw + 44 * U, ph + 44 * U); g.shadowBlur = 0; g.shadowOffsetY = 0;
      const z = lerp(s.zoom[0], s.zoom[1], clamp(lt / d)); cover(IMG[s.img], -pw / 2, -ph / 2, pw, ph, z, s.focus[0], s.focus[1], 'sepia(.25) contrast(1.05)');
      tape(-pw / 2 + 30 * U, -ph / 2 - 10 * U, 160 * U, 44 * U, -.5); tape(pw / 2 - 30 * U, -ph / 2 - 10 * U, 160 * U, 44 * U, .5); g.restore();
      label(s.label, cx - pw * .2, cy + ph / 2 + 60 * U);
      // loupe that drifts over the photo
      const lx = cx + Math.sin((s.t + lt) * .5) * pw * .25, ly = cy + Math.cos((s.t + lt) * .4) * ph * .15, R = 120 * U;
      g.save(); g.globalAlpha = .9 * eOut((lt - .6) / .5); g.beginPath(); g.arc(lx, ly, R, 0, 6.29); g.clip(); g.translate(lx, ly); g.scale(1.6, 1.6); g.translate(-lx, -ly);
      g.translate(cx, cy); g.rotate(rot); cover(IMG[s.img], -pw / 2, -ph / 2, pw, ph, z, s.focus[0], s.focus[1], 'sepia(.25) contrast(1.1)'); g.restore();
      g.save(); g.globalAlpha = eOut((lt - .6) / .5); g.strokeStyle = '#222'; g.lineWidth = 10 * U; g.beginPath(); g.arc(lx, ly, R, 0, 6.29); g.stroke(); g.lineWidth = 22 * U; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx + R * .72, ly + R * .72); g.lineTo(lx + R * 1.3, ly + R * 1.3); g.stroke(); g.restore();
    },
    card(s, lt) {
      lightBase(s.t + lt); const cw = W * .62, ch = H * .52, cx = W / 2, cy = H * .46, p = eOut(lt / .3);
      g.save(); g.translate(cx, cy + (1 - p) * 80 * U); g.rotate(-.015); g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 30 * U; g.shadowOffsetY = 10 * U; g.fillStyle = '#fbf7e6'; g.fillRect(-cw / 2, -ch / 2, cw, ch); g.shadowBlur = 0; g.shadowOffsetY = 0;
      g.strokeStyle = 'rgba(70,110,200,.35)'; g.lineWidth = 2 * U; for (let y = -ch / 2 + 110 * U; y < ch / 2; y += 56 * U) { g.beginPath(); g.moveTo(-cw / 2, y); g.lineTo(cw / 2, y); g.stroke(); }
      g.strokeStyle = 'rgba(220,60,60,.6)'; g.beginPath(); g.moveTo(-cw / 2, -ch / 2 + 80 * U); g.lineTo(cw / 2, -ch / 2 + 80 * U); g.stroke();
      const total = s.lines.join(' ').length, n = Math.floor(clamp((lt - .15) / Math.max(.6, total / 38)) * total); let used = 0;
      s.lines.forEach((ln, i) => { const size = fitText(ln, F.type, 400, 92 * U, cw - 120 * U); font(size, F.type); g.fillStyle = s.red === i ? '#b3121a' : '#1d1d1d'; g.textAlign = 'center'; const vis = ln.slice(0, Math.max(0, n - used)); used += ln.length + 1; g.fillText(vis, 0, -30 * U + i * 120 * U - (s.lines.length - 1) * 50 * U); });
      g.restore();
      if (s.stamp) stamp(s.stamp, cx + cw * .25, cy + ch * .3, lt - .5);
    },
  };

  // ================= EVIDENCE BOARD =================
  const PINS = {
    raj: { x: 360, y: 290, kind: 'photo', img: 'img19', cap: 'THE VICEROY' },
    act: { x: 960, y: 170, kind: 'card', lines: ['THE SALT ACT', '1882'], stamp: 'GOVT MONOPOLY', so: [70, 125] },
    make: { x: 1580, y: 330, kind: 'list', lines: ['✗ MAKE IT', '✗ COLLECT IT', '✗ SELL IT'] },
    shore: { x: 330, y: 780, kind: 'photo', img: 'img06', cap: 'THE SEA SHORE', stamp: 'ARREST' },
    tax: { x: 1580, y: 640, kind: 'card', lines: ['TAX ON', 'EVERY PINCH'] },
    poor: { x: 1580, y: 900, kind: 'card', lines: ['POOREST', 'HIT HARDEST'], red: true },
    gandhi: { x: 960, y: 540, kind: 'photo', img: 'img15', cap: 'M. K. GANDHI', big: true },
    life: { x: 960, y: 870, kind: 'marker', lines: ['A TAX ON SALT = A TAX ON LIFE'] },
  };
  const firstSeen = {}; for (const s of S) if (s.type === 'board') for (const p of s.pins) if (firstSeen[p] === undefined) firstSeen[p] = s.t;
  function boardCam(s) { if (s.focus === 'all' || !PINS[s.focus]) return { x: 960, y: 520, z: .92 }; const p = PINS[s.focus]; return { x: p.x, y: p.y, z: 1.55 }; }
  function drawPin(key, t) {
    const P = PINS[key], a = t - firstSeen[key]; if (a < 0) return; const p = eBack(a / .35), rot = (hash(key.length * 7 + P.x) - .5) * .12;
    g.save(); g.translate(P.x * U, P.y * U); g.rotate(rot + (1 - clamp(a / .35)) * .4); g.scale(p, p); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 20 * U; g.shadowOffsetY = 10 * U;
    if (P.kind === 'photo') { const w = (P.big ? 360 : 300) * U, h = w * 1.12; g.fillStyle = '#f6f3ea'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0; g.shadowOffsetY = 0; cover(IMG[P.img], -w / 2 + 16 * U, -h / 2 + 16 * U, w - 32 * U, w - 32 * U, 1.05, ...foc(P.img, [.5, .3]), 'sepia(.3) contrast(1.1)'); font(30 * U, F.type); g.fillStyle = '#222'; g.textAlign = 'center'; g.fillText(P.cap, 0, h / 2 - 26 * U); }
    else if (P.kind === 'marker') { const w = 820 * U, h = 130 * U; g.fillStyle = '#fff59d'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0; g.shadowOffsetY = 0; font(58 * U, F.anton); g.fillStyle = '#b3121a'; g.textAlign = 'center'; g.fillText(P.lines[0], 0, 20 * U); }
    else { const w = 380 * U, h = (P.kind === 'list' ? 260 : 200) * U; g.fillStyle = '#fbf7e6'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0; g.shadowOffsetY = 0;
      font(P.kind === 'list' ? 44 * U : 52 * U, F.type); g.textAlign = 'center'; g.fillStyle = P.red ? '#b3121a' : '#1d1d1d';
      P.lines.forEach((ln, i) => { const show = P.kind !== 'list' || !REV[i] || t >= REV[i]; if (show) g.fillText(ln, 0, -h / 2 + 70 * U + i * (P.kind === 'list' ? 62 : 70) * U); }); }
    g.restore();
    // pushpin
    g.fillStyle = '#d32f2f'; g.beginPath(); g.arc(P.x * U, (P.y - (P.kind === 'photo' ? (P.big ? 190 : 160) : P.kind === 'list' ? 120 : 90)) * U, 13 * U * p, 0, 6.29); g.fill();
    if (P.stamp) { const so = P.so || [40, 30]; stamp(P.stamp, P.x * U + so[0] * U, P.y * U + so[1] * U, a - .4, -.12, 46); }
  }
  let curShot = null;
  const REV = (S.find(x => x.reveal) || { reveal: [] }).reveal.map(r => r[1]);
  const STRINGS = [['raj', 'act'], ['act', 'make'], ['act', 'shore'], ['shore', 'tax'], ['tax', 'poor'], ['poor', 'gandhi'], ['tax', 'gandhi'], ['raj', 'gandhi'], ['make', 'gandhi'], ['gandhi', 'life']];
  function boardShot(s, lt, d, i) {
    const t = s.t + lt, prev = S[i - 1] && S[i - 1].type === 'board' ? boardCam(S[i - 1]) : { x: 960, y: 560, z: .8 }, cam = boardCam(s), k = eIO(lt / .9);
    const cx = lerp(prev.x, cam.x, k), cy = lerp(prev.y, cam.y, k), z = lerp(prev.z, cam.z, k) * (1 + lt * .01);
    g.drawImage(CORK, 0, 0); g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-cx * U, -cy * U);
    // strings first (under pins)
    for (const [a, b] of STRINGS) { if (firstSeen[a] === undefined || firstSeen[b] === undefined) continue; const st = Math.max(firstSeen[a], firstSeen[b]) + .3; let pr = clamp((t - st) / .6); if (b === 'gandhi' || a === 'gandhi') pr = s.strings || S.indexOf(s) > S.findIndex(x => x.strings) && S.findIndex(x => x.strings) > -1 ? clamp((t - (S.find(x => x.strings).t + .2)) / .8) : 0; if (pr <= 0) continue;
      const A = PINS[a], B = PINS[b]; g.strokeStyle = '#b71c1c'; g.lineWidth = 4 * U; g.beginPath(); g.moveTo(A.x * U, A.y * U); const mx = lerp(A.x, B.x, pr), my = lerp(A.y, B.y, pr) + Math.sin(pr * Math.PI) * 30; g.quadraticCurveTo(lerp(A.x, mx, .5) * U, (lerp(A.y, my, .5) + 25) * U, mx * U, my * U); g.stroke(); }
    for (const key of Object.keys(PINS)) if (s.pins.includes(key) || (firstSeen[key] !== undefined && firstSeen[key] <= t && S.slice(0, i + 1).some(x => x.type === 'board' && x.pins.includes(key)))) drawPin(key, t);
    g.restore(); vignette(.45); grain(t, .06);
  }

  // ================= SATELLITE MAP =================
  const MAPR = []; for (const c of window.MAP || []) for (const r of c.p) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let k = 0; k < r.length; k += 2) { x0 = Math.min(x0, r[k]); x1 = Math.max(x1, r[k]); y0 = Math.min(y0, r[k + 1]); y1 = Math.max(y1, r[k + 1]); } MAPR.push({ r, x0, x1, y0, y1, india: c.n === 'India' }); }
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
  const ROUTE = [[72.58, 23.06], [72.59, 22.92], [72.86, 22.69], [72.95, 22.56], [72.90, 22.41], [72.86, 22.27], [72.80, 22.05], [72.98, 21.70], [73.00, 21.63], [72.83, 21.17], [72.92, 20.95], [72.80, 20.89]];
  const TOWNS = [['Nadiad', 2], ['Anand', 3], ['Borsad', 4], ['Jambusar', 6], ['Bharuch', 7], ['Surat', 9], ['Navsari', 10]];
  const PLACES = { delhi: [77.21, 28.61, 'DELHI · VICEROY'], ashram: [72.58, 23.06, 'SABARMATI ASHRAM'], dandi: [72.80, 20.89, 'DANDI'] };
  const rlen = []; let tot = 0; for (let k = 1; k < ROUTE.length; k++) { tot += Math.hypot(ROUTE[k][0] - ROUTE[k - 1][0], ROUTE[k][1] - ROUTE[k - 1][1]); rlen.push(tot); }
  function routePt(p) { const d = p * tot; let k = 0; while (k < rlen.length - 1 && rlen[k] < d) k++; const d0 = k ? rlen[k - 1] : 0, f = (d - d0) / (rlen[k] - d0 || 1); return [lerp(ROUTE[k][0], ROUTE[k + 1][0], f), lerp(ROUTE[k][1], ROUTE[k + 1][1], f), k]; }
  const routeP = t => clamp((t - TL.route.t0) / (TL.route.t1 - TL.route.t0));
  function camFor(s, t) {
    if (s.cam === 'india') return [79, 22.5, 30]; if (s.cam === 'gujarat') return [72.4, 22.6, 260]; if (s.cam === 'route') return [72.85, 21.95, 330];
    if (s.cam === 'dandi') return [72.82, 20.95, 900];
    const [x, y] = routePt(routeP(t)); return [x + .15, y - .05, 520];
  }
  const camCache = {};
  function camAt(i, t) {
    const s = S[i], target = camFor(s, t), prevI = i - 1, lt = t - s.t;
    if (!S[prevI] || S[prevI].type !== 'map' || lt >= 1.4) return target;
    const from = camAt(prevI, s.t), k = eIO(lt / 1.4);
    const lz = Math.exp(lerp(Math.log(from[2]), Math.log(target[2]), k)); return [lerp(from[0], target[0], k), lerp(from[1], target[1], k), lz];
  }
  function mapShot(s, lt, d, i) {
    const t = s.t + lt, [cx, cy, z] = camAt(i, t), mcy = merc(cy);
    const X = lon => W / 2 + (lon - cx) * z * U, Y = lat => H / 2 - (merc(lat) - mcy) * z * U;
    // sea
    const sg = g.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, '#071a2b'); sg.addColorStop(1, '#03101c'); g.fillStyle = sg; g.fillRect(0, 0, W, H);
    // land
    const vx0 = cx - W / 2 / (z * U) - 1, vx1 = cx + W / 2 / (z * U) + 1, vy0 = cy - 30, vy1 = cy + 30;
    g.beginPath(); for (const R of MAPR) { if (R.x1 < vx0 || R.x0 > vx1 || R.y1 < vy0 - 40 || R.y0 > vy1 + 40) continue; const r = R.r; g.moveTo(X(r[0]), Y(r[1])); for (let k = 2; k < r.length; k += 2) g.lineTo(X(r[k]), Y(r[k + 1])); g.closePath(); }
    g.fillStyle = '#1e2c25'; g.fill(); g.save(); g.clip(); { const lg = g.createRadialGradient(W * .3, H * .3, 0, W * .5, H * .5, W * .8); lg.addColorStop(0, 'rgba(90,120,70,.35)'); lg.addColorStop(1, 'rgba(40,50,30,.0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H); g.globalAlpha = .35; g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(GR[0], 'repeat'); g.save(); g.translate(-cx * z * U % 512, merc(cy) * z * U % 512); g.fillRect(-512, -512, W + 1024, H + 1024); g.restore(); } g.restore(); g.strokeStyle = 'rgba(120,220,200,.35)'; g.lineWidth = 1.4 * U; g.stroke();
    // India highlighted
    g.beginPath(); for (const R of MAPR) { if (!R.india) continue; const r = R.r; g.moveTo(X(r[0]), Y(r[1])); for (let k = 2; k < r.length; k += 2) g.lineTo(X(r[k]), Y(r[k + 1])); g.closePath(); } g.fillStyle = 'rgba(70,120,95,.55)'; g.fill(); g.strokeStyle = 'rgba(150,255,220,.6)'; g.lineWidth = 2 * U; g.stroke();
    grain(t, .07);
    // graticule
    g.strokeStyle = 'rgba(120,220,255,.12)'; g.lineWidth = 1; const step = z > 200 ? .5 : 5; font(16 * U, F.mono); g.fillStyle = 'rgba(150,230,255,.5)';
    for (let lon = Math.floor(vx0 / step) * step; lon < vx1; lon += step) { const x = X(lon); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); g.fillText(lon.toFixed(1) + '°E', x + 4, H - 80 * U); }
    for (let lat = Math.floor((cy - 25) / step) * step; lat < cy + 25; lat += step) { const y = Y(lat); if (y < 0 || y > H) continue; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.fillText(lat.toFixed(1) + '°N', 8, y - 4); }
    // route
    const rp = s.route ? routeP(t) : 0;
    if (s.dashed || s.route) { g.setLineDash([12 * U, 10 * U]); g.strokeStyle = 'rgba(255,190,90,.45)'; g.lineWidth = 3 * U; g.beginPath(); ROUTE.forEach(([a, b], k) => k ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b))); g.stroke(); g.setLineDash([]); }
    if (s.route && rp > 0) {
      const [hx, hy, hk] = routePt(rp); g.strokeStyle = '#ffb347'; g.lineWidth = 7 * U; g.shadowColor = '#ff8a00'; g.shadowBlur = 24 * U; g.beginPath();
      for (let k = 0; k <= hk; k++) k ? g.lineTo(X(ROUTE[k][0]), Y(ROUTE[k][1])) : g.moveTo(X(ROUTE[0][0]), Y(ROUTE[0][1])); g.lineTo(X(hx), Y(hy)); g.stroke(); g.shadowBlur = 0;
      // crowd dots trailing the head
      if (s.crowd) { const n = Math.floor(30 + rp * 420); for (let k = 0; k < n; k++) { const q = rp - hash(k) * Math.min(rp, .25); const [qx, qy] = routePt(clamp(q)); g.fillStyle = `rgba(255,230,180,${.35 + .4 * hash(k + 3)})`; g.fillRect(X(qx) + (hash(k + 1) - .5) * 40 * U, Y(qy) + (hash(k + 2) - .5) * 40 * U, 3 * U, 3 * U); } }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(hx), Y(hy), 10 * U, 0, 6.29); g.fill(); const pr = (t * 1.5) % 1; g.strokeStyle = `rgba(255,180,70,${1 - pr})`; g.lineWidth = 3 * U; g.beginPath(); g.arc(X(hx), Y(hy), (10 + pr * 50) * U, 0, 6.29); g.stroke();
      // town labels as the march passes
      font(22 * U, F.mono); g.fillStyle = '#cfefff'; for (const [nm, k] of TOWNS) if (hk >= k - 1) { const x = X(ROUTE[k][0]), y = Y(ROUTE[k][1]); g.fillRect(x - 4 * U, y - 4 * U, 8 * U, 8 * U); g.textAlign = 'left'; g.fillText(nm.toUpperCase(), x + 14 * U, y + 7 * U); }
    }
    // pins
    for (const key of s.pins || []) { const [lo, la, nm] = PLACES[key], x = X(lo), y = Y(la), pp = eBack((lt - .2) / .4); g.save(); g.translate(x, y); g.scale(pp, pp); g.fillStyle = key === 'dandi' ? '#ff5252' : '#4fe3ff'; g.beginPath(); g.arc(0, 0, 12 * U, 0, 6.29); g.fill(); const pr = (t * 1.2) % 1; g.strokeStyle = `rgba(79,227,255,${1 - pr})`; g.lineWidth = 3 * U; g.beginPath(); g.arc(0, 0, (12 + pr * 60) * U, 0, 6.29); g.stroke(); font(28 * U, F.mono, 700); g.fillStyle = '#e8fbff'; g.textAlign = 'left'; g.fillText(nm, 24 * U, 10 * U); g.restore(); }
    if (s.arrive || (s.route && rp >= 1)) { const [lo, la] = PLACES.dandi; g.fillStyle = '#ff5252'; g.beginPath(); g.arc(X(lo), Y(la), 16 * U, 0, 6.29); g.fill(); font(34 * U, F.mono, 700); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('DANDI ✓', X(lo) + 26 * U, Y(la) + 12 * U); }
    // marchers grid
    if (s.marchers) { const n = Math.floor(clamp((lt - .1) / 1.2) * s.marchers); const [lo, la] = PLACES.ashram; for (let k = 0; k < n; k++) { g.fillStyle = '#ffd27a'; g.fillRect(X(lo) + 60 * U + (k % 13) * 16 * U, Y(la) + 30 * U + Math.floor(k / 13) * 16 * U, 10 * U, 10 * U); } font(56 * U, F.mono, 700); g.fillStyle = '#ffd27a'; g.textAlign = 'left'; g.fillText(`MARCHERS: ${n}`, X(lo) + 60 * U, Y(la) + 170 * U); }
    // HUD
    scan(t); hudFrame(t, s, rp);
    if (s.inset) { const im = IMG[s.inset]; if (im) im._f = foc(s.inset, [.5, .35]); inset(im, s.insetLabel, lt); }
    if (s.big) { const p = eBack(lt / .25); g.save(); g.translate(W / 2, H * .5); g.scale(p, p); font(190 * U, F.anton); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText(s.big, 6 * U, 6 * U); g.fillStyle = '#ffd27a'; g.fillText(s.big, 0, 0); g.restore(); g.textBaseline = 'alphabetic'; }
    if (s.alert && (fr(lt) % 18 < 12)) { g.fillStyle = 'rgba(200,0,0,.85)'; g.fillRect(0, H * .16, W, 90 * U); font(48 * U, F.mono, 700); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('⚠ ' + s.alert, W / 2, H * .16 + 62 * U); }
  }
  function scan(t) { g.fillStyle = 'rgba(120,220,255,.035)'; for (let y = (t * 60) % 6; y < H; y += 6 * U) g.fillRect(0, y, W, 1.5 * U); const sy = ((t * .35) % 1) * H; const gr = g.createLinearGradient(0, sy - 120 * U, 0, sy); gr.addColorStop(0, 'rgba(79,227,255,0)'); gr.addColorStop(1, 'rgba(79,227,255,.10)'); g.fillStyle = gr; g.fillRect(0, sy - 120 * U, W, 120 * U); }
  function hudFrame(t, s, rp) {
    const m = 40 * U, L = 80 * U; g.strokeStyle = 'rgba(79,227,255,.85)'; g.lineWidth = 3 * U;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, a, b]) => { g.beginPath(); g.moveTo(x, y + b * L); g.lineTo(x, y); g.lineTo(x + a * L, y); g.stroke(); });
    font(24 * U, F.mono, 700); g.fillStyle = '#4fe3ff'; g.textAlign = 'left'; g.fillText('SAT-BRIEF // OPERATION SALT · 1930', m + 20 * U, m + 44 * U);
    const day = s.route ? Math.min(24, 1 + Math.floor(rp * 24)) : null, km = s.route ? Math.round(rp * 385) : null;
    g.textAlign = 'right'; g.fillText(s.hud || (day ? `DAY ${String(day).padStart(2, '0')} / 24` : ''), W - m - 20 * U, m + 44 * U);
    if (km !== null) { font(64 * U, F.mono, 700); g.fillStyle = '#ffd27a'; g.fillText(`${km} KM`, W - m - 20 * U, m + 120 * U); font(22 * U, F.mono); g.fillStyle = '#4fe3ff'; g.fillText('WALKED', W - m - 20 * U, m + 150 * U); }
    font(18 * U, F.mono); g.fillStyle = 'rgba(79,227,255,.7)'; g.textAlign = 'left'; g.fillText('● REC  ' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0') + ':' + String(fr(t) % 30).padStart(2, '0'), m + 20 * U, H - m - 20 * U);
  }
  function inset(im, lab, lt) {
    const w = 520 * U, h = 360 * U, x = W - w - 90 * U, y = H * .30, p = eOut((lt - .25) / .4); if (p <= 0) return;
    g.save(); g.globalAlpha = p; g.translate((1 - p) * 120 * U, 0); g.fillStyle = 'rgba(0,20,30,.7)'; g.fillRect(x - 10 * U, y - 10 * U, w + 20 * U, h + 76 * U);
    cover(im, x, y, w, h, 1.05 + lt * .02, ...(im && im._f || [.5, .35]), 'grayscale(.5) contrast(1.1) brightness(.95) sepia(.2) hue-rotate(150deg) saturate(.6)');
    g.strokeStyle = '#4fe3ff'; g.lineWidth = 2 * U; g.strokeRect(x, y, w, h); font(26 * U, F.mono, 700); g.fillStyle = '#e8fbff'; g.textAlign = 'left'; g.fillText(lab, x + 4 * U, y + h + 46 * U); g.restore();
  }

  // ================= SILENT REEL =================
  function reelPost(t, heavy = 1) {
    grain(t, .22 * heavy, 'overlay'); grain(t + 7, .10 * heavy, 'multiply');
    const f = fr(t); g.fillStyle = `rgba(255,255,255,${.04 * hash(f * 1.3)})`; g.fillRect(0, 0, W, H); // flicker
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.5 * U; for (let k = 0; k < 2; k++) if (hash(f * 3 + k) > .6) { const x = hash(f * 7 + k) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8 * U, H); g.stroke(); }
    if (hash(f * 11) > .9) { g.fillStyle = 'rgba(20,20,20,.7)'; g.beginPath(); g.arc(hash(f) * W, hash(f + 1) * H, (2 + hash(f + 2) * 5) * U, 0, 6.29); g.fill(); }
    vignette(.85, .25);
    g.strokeStyle = '#000'; g.lineWidth = 60 * U; rr(-20 * U, -20 * U, W + 40 * U, H + 40 * U, 90 * U); g.stroke();
  }
  const weave = t => [(hash(fr(t) * .7) - .5) * 4 * U, (hash(fr(t) * .9 + 5) - .5) * 5 * U];
  const REEL = {
    reel(s, lt, d) {
      g.fillStyle = '#111'; g.fillRect(0, 0, W, H); const [wx, wy] = weave(s.t + lt), sh = s.shake ? Math.sin(lt * 50) * 10 * U * clamp(1 - lt / 1.5) : 0;
      const z = lerp(s.zoom[0], s.zoom[1], eIO(lt / d)); cover(IMG[s.img], wx + sh, wy, W, H, z, s.focus[0], s.focus[1], 'grayscale(1) contrast(1.35) brightness(.95) sepia(.18)');
      if (s.inter && lt < 1.8) { const a = clamp(1 - (lt - 1.4) / .4); g.globalAlpha = a; interCard(s.inter, null, lt, true); g.globalAlpha = 1; }
      if (s.bar) { const p = eOut((lt - .3) / .4); g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(0, H * .72, W * p, 110 * U); font(56 * U, F.fell); g.fillStyle = '#f3eee2'; g.textAlign = 'left'; g.fillText(s.bar, 120 * U, H * .72 + 74 * U); }
      if (s.counter) { const n = Math.round(s.counter * eOut(lt / 1.8)); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, W, H); font(250 * U, F.anton); g.textAlign = 'center'; g.fillStyle = '#f3eee2'; g.fillText(n.toLocaleString('en-US'), W / 2, H * .52); font(80 * U, F.fell, 400, true); g.fillText(s.counterLabel, W / 2, H * .52 + 110 * U); }
      if (s.stamp) { const p = eBack((lt - .1) / .3); g.save(); g.translate(W / 2, H * .5); g.scale(p, p); g.rotate(-.05); font(110 * U, F.anton); const w = g.measureText(s.stamp).width + 80 * U; g.fillStyle = '#f3eee2'; g.fillRect(-w / 2, -95 * U, w, 150 * U); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText(s.stamp, 0, 30 * U); g.restore(); }
      reelPost(s.t + lt);
    },
    intertitle(s, lt) { g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H); interCard(s.quote, s.by, lt); reelPost(s.t + lt, .8); },
    black(s, lt) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); font(96 * U, F.type); g.fillStyle = '#eee'; g.textAlign = 'center'; const n = Math.floor(clamp(lt / 1.0) * s.text.length); g.fillText(s.text.slice(0, n), W / 2, H / 2); },
    spin(s, lt) {
      g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, W, H); const p = eOut(lt / 1.1), rot = (1 - p) * Math.PI * 6, sc = lerp(.05, 1, p), w = W * .56, h = H * .78;
      g.save(); g.translate(W / 2, H / 2); g.rotate(rot); g.scale(sc, sc); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40 * U; g.fillStyle = '#eee'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0;
      cover(IMG[s.img], -w / 2 + 14 * U, -h / 2 + 14 * U, w - 28 * U, h - 28 * U, 1.0, .5, .2, 'grayscale(1) contrast(1.2)'); g.restore();
      if (lt > 1.1) { const q = eBack((lt - 1.1) / .3); g.save(); g.translate(W / 2, H * .1); g.scale(q, q); font(70 * U, F.anton); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('THE WORLD READ IT', 0, 0); g.restore(); }
      reelPost(s.t + lt, .9);
    },
    globe(s, lt) {
      g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H); const z = 5.2, X = lon => W / 2 + (lon - 20) * z * U, Y = lat => H * .52 - merc(lat) * z * U;
      g.beginPath(); for (const R of MAPR) { const r = R.r; g.moveTo(X(r[0]), Y(r[1])); for (let k = 2; k < r.length; k += 2) g.lineTo(X(r[k]), Y(r[k + 1])); g.closePath(); } g.fillStyle = '#d8d2c4'; g.fill();
      const cities = [[-74, 40.7], [-0.1, 51.5], [2.35, 48.85], [72.8, 19], [88.4, 22.6], [139.7, 35.7], [-87.6, 41.9], [13.4, 52.5], [151.2, -33.9], [-46.6, -23.5], [31.2, 30], [116.4, 39.9], [77.2, 28.6], [-122.4, 37.8], [18.4, -33.9]];
      cities.forEach(([lo, la], k) => { const st = k * .12; const pr = clamp((lt - st) / .6); if (pr <= 0) return; g.strokeStyle = `rgba(20,20,20,${1 - pr})`; g.lineWidth = 4 * U; g.beginPath(); g.arc(X(lo), Y(la), 6 * U + pr * 50 * U, 0, 6.29); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(X(lo), Y(la), 7 * U, 0, 6.29); g.fill(); });
      const p = eOut((lt - .8) / .5); g.globalAlpha = p; g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(0, H * .05, W, 140 * U); font(90 * U, F.fell); g.fillStyle = '#f3eee2'; g.textAlign = 'center'; g.fillText(s.text, W / 2, H * .05 + 100 * U); g.globalAlpha = 1;
      reelPost(s.t + lt, .7);
    },
  };
  function interCard(text, by, lt, overlay) {
    const w = W * .74, h = H * .62, x = (W - w) / 2, y = (H - h) / 2; if (overlay) { g.fillStyle = 'rgba(0,0,0,.82)'; g.fillRect(x, y + h * .3, w, h * .4); }
    else { g.strokeStyle = '#e9e2d0'; g.lineWidth = 4 * U; g.strokeRect(x, y, w, h); g.lineWidth = 1.5 * U; g.strokeRect(x + 16 * U, y + 16 * U, w - 32 * U, h - 32 * U);
      for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { g.beginPath(); g.arc(cx, cy, 26 * U, 0, 6.29); g.stroke(); } }
    font(overlay ? 64 * U : 78 * U, F.fell, 400, !overlay); g.fillStyle = '#f3eee2'; g.textAlign = 'center'; const L = wrap(text, w - 160 * U);
    L.forEach((ln, i) => g.fillText(ln, W / 2, H / 2 - (L.length - 1) * 48 * U + i * 96 * U + (overlay ? 20 * U : 0)));
    if (by) { font(40 * U, F.fell); g.globalAlpha *= eOut((lt - .8) / .5); g.fillText('— ' + by, W / 2, y + h - 70 * U); g.globalAlpha = 1; }
  }

  // ================= COUNTDOWN =================
  function countBg(t) { g.fillStyle = '#ffd400'; g.fillRect(0, 0, W, H); g.save(); g.globalAlpha = .1; g.fillStyle = '#000'; const s = 120 * U, o = (t * 80 * U) % (s * 2); for (let x = -H - s * 2 + o; x < W + H; x += s * 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + s, 0); g.lineTo(x + s + H, H); g.lineTo(x + H, H); g.closePath(); g.fill(); } g.restore(); }
  const COUNT = {
    countintro(s, lt) { countBg(s.t + lt); const p = eBack(lt / .3); g.save(); g.translate(W / 2, H * .5); g.scale(p, p); font(260 * U, F.anton); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#111'; g.fillText('3 THINGS', 0, 0); g.restore(); g.textBaseline = 'alphabetic'; font(60 * U, F.inter, 900); g.fillStyle = '#111'; g.textAlign = 'center'; g.globalAlpha = eOut((lt - .4) / .3); g.fillText('A PINCH OF SALT CHANGED', W / 2, H * .5 + 180 * U); g.globalAlpha = 1; },
    num(s, lt) {
      countBg(s.t + lt); const p = eBack(lt / .28), sh = (1 - clamp(lt / .3)) * 20 * U;
      g.save(); g.translate(W / 2 + (hash(fr(lt)) - .5) * sh, H / 2 + (hash(fr(lt) + 1) - .5) * sh); g.scale(2.2 - 1.2 * p, 2.2 - 1.2 * p);
      g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, 330 * U, 0, 6.29); g.fill(); g.strokeStyle = '#ffd400'; g.lineWidth = 16 * U; g.beginPath(); g.arc(0, 0, 290 * U, -Math.PI / 2, -Math.PI / 2 + 6.283 * clamp(lt / 1.2)); g.stroke();
      font(480 * U, F.anton); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd400'; g.fillText(String(s.n), 0, 20 * U); g.restore(); g.textBaseline = 'alphabetic';
      font(48 * U, F.inter, 900); g.fillStyle = '#111'; g.textAlign = 'left'; g.fillText('#' + s.n, 80 * U, 120 * U);
    },
    countcard(s, lt, d) {
      countBg(s.t + lt); const p = eOut(lt / .35), w = s.big ? W * .55 : W * .44, h = s.big ? H * .66 : H * .62, x = s.big ? W * .06 : W * .07, y = H * .17;
      g.save(); g.translate(x + w / 2 - (1 - p) * W * .4, y + h / 2); g.rotate(-.03); g.fillStyle = '#111'; g.fillRect(-w / 2 - 18 * U, -h / 2 - 18 * U, w + 36 * U, h + 36 * U); cover(IMG[s.img], -w / 2, -h / 2, w, h, 1.04 + lt * .02, ...foc(s.img, [.5, .3]), s.img === 'img13' || s.img === 'img18' ? 'contrast(1.1)' : 'grayscale(1) contrast(1.2)'); g.restore();
      const tx = x + w + 90 * U, tw = W - tx - 80 * U, q = eOut((lt - .2) / .35);
      g.save(); g.globalAlpha = q; g.translate((1 - q) * 80 * U, 0); const hs = fitText(s.head, F.anton, 400, s.big ? 300 * U : 120 * U, tw); font(hs, F.anton); g.fillStyle = '#111'; g.textAlign = 'left'; const HL = s.big ? [s.head] : wrap(s.head, tw); HL.forEach((ln, i) => g.fillText(ln, tx, H * .42 + i * hs * 1.02));
      font(46 * U, F.inter, 900); const SL = wrap(s.sub, tw); SL.forEach((ln, i) => g.fillText(ln, tx, H * .42 + HL.length * hs * 1.02 + 30 * U + i * 56 * U)); g.restore();
    },
    split(s, lt) {
      countBg(s.t + lt); const w = W * .4, h = H * .52, y = H * .2, p = eOut(lt / .4);
      [[s.a, s.la, W * .07, -1], [s.b, s.lb, W * .53, 1]].forEach(([im, lab, x, dir]) => { g.save(); g.translate(dir * (1 - p) * W * .5, 0); g.fillStyle = '#111'; g.fillRect(x - 14 * U, y - 14 * U, w + 28 * U, h + 28 * U); cover(IMG[im], x, y, w, h, 1.05, ...foc(im, [.5, .3]), 'grayscale(1) contrast(1.2)'); g.fillStyle = '#111'; g.fillRect(x - 14 * U, y + h - 10 * U, w + 28 * U, 90 * U); font(54 * U, F.anton); g.fillStyle = '#ffd400'; g.textAlign = 'center'; g.fillText(lab, x + w / 2, y + h + 58 * U); g.restore(); });
      const q = eBack((lt - .4) / .3); g.save(); g.translate(W / 2, y + h / 2); g.scale(q, q); g.fillStyle = '#c8102e'; g.beginPath(); g.arc(0, 0, 90 * U, 0, 6.29); g.fill(); font(70 * U, F.anton); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('&', 0, 6 * U); g.restore(); g.textBaseline = 'alphabetic';
      font(76 * U, F.anton); g.fillStyle = '#111'; g.textAlign = 'center'; g.globalAlpha = eOut((lt - .6) / .4); g.fillText(s.head, W / 2, H * .13); g.globalAlpha = 1;
    },
  };

  // ================= CHAPTER CARDS =================
  function chapterCard(s, lt) {
    const [a, b] = s.title, st = s.style, p = eBack(lt / .35);
    if (st === 'light') { lightBase(s.t + lt); g.save(); g.translate(W / 2, H / 2); g.rotate(-.02); g.scale(p, p); g.fillStyle = '#fbf7e6'; g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 30 * U; g.fillRect(-560 * U, -200 * U, 1120 * U, 400 * U); g.shadowBlur = 0; font(44 * U, F.type); g.fillStyle = '#b3121a'; g.textAlign = 'center'; g.fillText(a, 0, -80 * U); font(150 * U, F.fell); g.fillStyle = '#1d1d1d'; g.fillText(b, 0, 80 * U); g.restore(); }
    else if (st === 'board') { g.drawImage(CORK, 0, 0); g.save(); g.translate(W / 2, H / 2); g.rotate(.03); g.scale(p, p); g.fillStyle = '#f3ecd8'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30 * U; g.fillRect(-600 * U, -190 * U, 1200 * U, 380 * U); g.shadowBlur = 0; font(44 * U, F.type); g.fillStyle = '#333'; g.textAlign = 'center'; g.fillText('CASE FILE · ' + a, 0, -80 * U); font(150 * U, F.anton); g.fillStyle = '#111'; g.fillText(b, 0, 90 * U); g.restore(); stamp('CLASSIFIED', W * .7, H * .72, lt - .5, -.15, 70); vignette(.5); }
    else if (st === 'map') { g.fillStyle = '#03101c'; g.fillRect(0, 0, W, H); scan(s.t + lt); font(40 * U, F.mono, 700); g.fillStyle = '#4fe3ff'; g.textAlign = 'center'; const txt = 'MISSION 03 // ' + b; const n = Math.floor(clamp(lt / .8) * txt.length); g.fillText(txt.slice(0, n) + (fr(lt) % 20 < 10 ? '█' : ''), W / 2, H / 2 - 40 * U); font(150 * U, F.anton); g.fillStyle = '#e8fbff'; g.globalAlpha = eOut((lt - .5) / .4); g.fillText(b, W / 2, H / 2 + 120 * U); g.globalAlpha = 1; hudFrame(s.t + lt, { hud: 'LIVE' }, 0); }
    else if (st === 'reel') { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, W, H); if (lt < 1.2) { const n = 3 - Math.floor(lt / .4), sw = (lt % .4) / .4; g.strokeStyle = '#ddd'; g.lineWidth = 6 * U; g.beginPath(); g.arc(W / 2, H / 2, 300 * U, 0, 6.29); g.stroke(); g.beginPath(); g.moveTo(W / 2 - 420 * U, H / 2); g.lineTo(W / 2 + 420 * U, H / 2); g.moveTo(W / 2, H / 2 - 420 * U); g.lineTo(W / 2, H / 2 + 420 * U); g.stroke(); g.fillStyle = 'rgba(220,220,220,.35)'; g.beginPath(); g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, 300 * U, -Math.PI / 2, -Math.PI / 2 + sw * 6.283); g.fill(); font(360 * U, F.fell); g.fillStyle = '#eee'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), W / 2, H / 2 + 20 * U); g.textBaseline = 'alphabetic'; }
      else { g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H); interCard(b, a.replace('CHAPTER 4', 'CHAPTER IV'), lt - 1.2); } reelPost(s.t + lt); }
    else if (st === 'count') { countBg(s.t + lt); g.save(); g.translate(W / 2, H / 2); g.scale(p, p); font(56 * U, F.inter, 900); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText(a, 0, -120 * U); font(190 * U, F.anton); g.fillText(b, 0, 80 * U); g.restore(); }
  }

  // ================= CAPTIONS =================
  const PH = TL.phrases;
  const CAPSTYLE = { news: [F.anton, 70, '#fff', '#ffd400', 'rgba(0,0,0,.0)', true], light: [F.inter, 54, '#1b1b1b', '#c0141c', 'rgba(251,247,234,.92)'], board: [F.inter, 54, '#fff', '#ffd400', 'rgba(0,0,0,.72)'], map: [F.mono, 46, '#e8fbff', '#ffd27a', 'rgba(0,20,30,.78)'], reel: [F.fell, 60, '#f3eee2', '#ffffff', 'rgba(0,0,0,.75)'], count: [F.anton, 70, '#111', '#c8102e', 'rgba(255,255,255,.0)', true] };
  function captions(t, style) {
    const ph = PH.find(p => t >= p.s - .05 && t < p.e + .25); if (!ph) return; const [fam, sz, col, hi, bg, outline] = CAPSTYLE[style] || CAPSTYLE.board;
    const size = sz * U; font(size, fam, 700); const txt = ph.w.map(w => style === 'news' || style === 'count' ? w.w.toUpperCase() : w.w);
    const sp = g.measureText(' ').width * 1.35 + 6 * U, widths = txt.map(w => g.measureText(w).width), total = widths.reduce((a, b) => a + b, 0) + sp * (txt.length - 1);
    const y = style === 'news' ? H - 120 * U : H - 92 * U, x0 = W / 2 - total / 2;
    if (bg !== 'rgba(0,0,0,.0)' && bg !== 'rgba(255,255,255,.0)') { g.fillStyle = bg; rr(x0 - 26 * U, y - size * .95, total + 52 * U, size * 1.35, 12 * U); g.fill(); }
    let x = x0; g.textAlign = 'left';
    txt.forEach((w, i) => { const on = t >= ph.w[i].s - .03 && t < (ph.w[i + 1] ? ph.w[i + 1].s : ph.e + .25); const pop = on ? 1 + .12 * (1 - clamp((t - ph.w[i].s) / .12)) : 1;
      g.save(); g.translate(x + widths[i] / 2, y - size * .3); g.scale(pop, pop); g.translate(-(x + widths[i] / 2), -(y - size * .3));
      if (outline) { g.lineWidth = 10 * U; g.strokeStyle = style === 'count' ? '#ffd400' : '#000'; g.lineJoin = 'round'; g.strokeText(w, x, y); }
      g.fillStyle = on ? hi : col; g.fillText(w, x, y); g.restore(); x += widths[i] + sp; });
  }
  // chapter progress (top-right) for chapters 1-5
  function progress(t, chId) {
    if (chId < 1 || chId > 5) return; const x = W / 2 - 158 * U, y = 22 * U; for (let k = 1; k <= 5; k++) { const c = TL.chapters[k], f = clamp((t - c.t0) / (c.t1 - c.t0)); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + (k - 1) * 64 * U, y, 56 * U, 8 * U); g.fillStyle = k === chId ? '#ffd400' : '#fff'; g.fillRect(x + (k - 1) * 64 * U, y, 56 * U * f, 8 * U); }
  }

  // ================= RENDER =================
  const DRAW = { ...NEWS, ...LIGHTS, ...REEL, ...COUNT };
  window.render = function (t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowBlur = 0;
    const i = shotAt(t), s = S[i], lt = Math.max(0, t - s.t), d = endOf(i) - s.t; curShot = s;
    if (s.type === 'chapter') chapterCard(s, lt);
    else if (s.type === 'board') boardShot(s, lt, d, i);
    else if (s.type === 'map') mapShot(s, lt, d, i);
    else (DRAW[s.type] || NEWS.punch)(s, lt, d, i);
    // cut flash (first 3 frames of a shot)
    if (lt < .1 && i > 0 && S[i - 1].style !== s.style) { g.fillStyle = s.style === 'reel' ? `rgba(255,240,200,${1 - lt / .1})` : `rgba(255,255,255,${.9 - lt * 9})`; g.fillRect(0, 0, W, H); }
    if (s.type !== 'chapter' && s.type !== 'end') captions(t, s.style);
    progress(t, s.ch);
    const f = Math.max(clamp(1 - t / .4), clamp((t - (TL.dur - .6)) / .6)); if (f > 0) { g.globalAlpha = f; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  };
  window.TEXTS = () => [];
  Promise.all([document.fonts.ready, ...loads, ...['400 40px Anton', '700 40px Inter', '900 40px Inter', '400 40px "Special Elite"', '400 40px "IM Fell English"', 'italic 400 40px "IM Fell English"', '700 40px "JetBrains Mono"', '400 40px "Bebas Neue"'].map(f => document.fonts.load(f))]).then(() => { window.render(0); window.READY = true; });
})();
