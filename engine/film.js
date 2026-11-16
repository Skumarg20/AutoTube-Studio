// AutoTube Studio engine v2: multi-style documentary renderer.
// Reads window.TL (timeline.js: shots, phrases, chapters, board, places, route, ticker, meta) + window.MAP + img/<id>.jpg.
// Deterministic: window.render(t) depends only on t. Works at 1920x1080 (long) and 1080x1920 (shorts).
(function () {
  const TL = window.TL, M = TL.meta || {}, cv = document.getElementById('c'), W = innerWidth, H = innerHeight;
  cv.width = W; cv.height = H; let g = cv.getContext('2d');
  const V = H > W, U = Math.min(W, H) / 1080;
  window.DUR = TL.dur;
  const F = { anton: 'Anton, Impact, sans-serif', inter: 'Inter, Arial, sans-serif', type: '"Special Elite", "Courier New", monospace', fell: '"IM Fell English", Georgia, serif', mono: '"JetBrains Mono", Consolas, monospace', corm: '"Cormorant Garamond", Georgia, serif', bebas: '"Bebas Neue", Anton, sans-serif', chalk: 'Caveat, cursive' };
  // ---------- utils ----------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
  const eOut = x => 1 - Math.pow(1 - clamp(x), 3), eIO = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const eBack = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const font = (px, fam, w = 400, it = false) => { g.font = `${it ? 'italic ' : ''}${w} ${Math.round(px)}px ${fam}`; };
  const fr = t => Math.floor(t * 30);
  function fitText(txt, fam, w, max, maxW, it = false) { let s = max; font(s, fam, w, it); while (g.measureText(txt).width > maxW && s > 10) { s *= 0.94; font(s, fam, w, it); } return s; }
  function wrap(text, maxW) { const ws = String(text || '').split(/\s+/), L = []; let c = ''; for (const w of ws) { const t2 = c ? c + ' ' + w : w; if (g.measureText(t2).width > maxW && c) { L.push(c); c = w; } else c = t2; } if (c) L.push(c); return L; }
  // wrap + shrink until it fits maxLines
  function fitWrap(text, fam, w, max, maxW, maxLines, it = false) { let s = max, L; for (; s > 14 * U; s *= .92) { font(s, fam, w, it); L = wrap(text, maxW); if (L.length <= maxLines && L.every(l => g.measureText(l).width <= maxW)) break; } font(s, fam, w, it); return { size: s, lines: wrap(text, maxW) }; }
  function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
  const linesOf = s => s.lines || (s.text ? [s.text] : s.head ? [].concat(s.head) : []);

  // ---------- images ----------
  const IMG = {}, want = new Set(), ALIAS = TL.alias || {};
  for (const s of TL.shots) for (const k of ['img', 'a', 'b', 'inset', 'bgimg']) if (s[k]) want.add(s[k]);
  for (const p of TL.board || []) if (p.img) want.add(p.img);
  const loadOne = (id, src) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[id] = im; res(true); }; im.onerror = () => res(false); im.src = 'img/' + src + '.jpg'; });
  const loads = [...want].map(id => loadOne(id, id).then(ok => ok || !ALIAS[id] ? 0 : loadOne(id, ALIAS[id])));
  const FOC = TL.focus || {};
  const foc = (id, d) => FOC[id] || d;
  function cover(im, x, y, w, h, z = 1, fx = .5, fy = .5, filter = '') {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (!im) { const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#5b5248'); gr.addColorStop(1, '#2c2722'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore(); return; }
    const s = Math.max(w / im.width, h / im.height) * z, iw = im.width * s, ih = im.height * s;
    if (filter) g.filter = filter; g.drawImage(im, x + (w - iw) * fx, y + (h - ih) * fy, iw, ih); g.filter = 'none'; g.restore();
  }
  // ---------- textures ----------
  const GR = [0, 1, 2, 3, 4, 5].map(k => mk(512, 512, (c, w, h) => { const d = c.createImageData(w, h); for (let i = 0; i < w * h; i++) { const v = hash(i * 1.37 + k * 9973) * 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; } c.putImageData(d, 0, 0); }));
  function grain(t, a, mode = 'overlay') { g.save(); g.globalAlpha = a; g.globalCompositeOperation = mode; const p = g.createPattern(GR[fr(t) % 6], 'repeat'); g.translate((fr(t) * 37) % 512, (fr(t) * 91) % 512); g.fillStyle = p; g.fillRect(-512, -512, W + 1024, H + 1024); g.restore(); }
  const CORK = mk(W, H, (c, w, h) => { c.fillStyle = '#9c6b3f'; c.fillRect(0, 0, w, h); for (let i = 0; i < 60000; i++) { const v = hash(i * 2.1); c.fillStyle = v > .5 ? `rgba(60,30,10,${hash(i) * .35})` : `rgba(230,180,120,${hash(i + 7) * .25})`; c.fillRect(hash(i * 3.3) * w, hash(i * 5.7) * h, 1 + hash(i * 7.1) * 3, 1 + hash(i * 1.9) * 3); } const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = v; c.fillRect(0, 0, w, h); });
  const LIGHT = mk(W, H, (c, w, h) => { const gr = c.createRadialGradient(w * .5, h * .45, 50, w * .5, h * .5, Math.max(w, h) * .75); gr.addColorStop(0, '#fffdf6'); gr.addColorStop(.6, '#efe9da'); gr.addColorStop(1, '#bdb4a0'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(120,110,90,.10)'; c.lineWidth = 1; for (let x = 0; x < w; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  const BOARD = mk(W, H, (c, w, h) => { c.fillStyle = '#22352c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { const x = hash(i) * w, y = hash(i + 9) * h, r = (200 + hash(i + 3) * 500) * U; const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,0.045)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; c.fillRect(x - r, y - r, 2 * r, 2 * r); } c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 4000; i++) c.fillRect(hash(i * 1.3) * w, hash(i * 2.9) * h, 1.5 * U, 1.5 * U); c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 70 * U; c.lineCap = 'round'; for (let i = 0; i < 6; i++) { c.beginPath(); const y = hash(i + 40) * h; c.moveTo(-50, y); c.bezierCurveTo(w * .3, y + 80 * U, w * .6, y - 80 * U, w + 50, y + 20 * U); c.stroke(); } const m = 22 * U; c.strokeStyle = '#6b4a2b'; c.lineWidth = m * 1.6; c.strokeRect(0, 0, w, h); });
  const WASHI = mk(W, H, (c, w, h) => { c.fillStyle = '#efe6d3'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(120,95,60,${hash(i * 1.1) * .08})`; c.fillRect(hash(i * 1.7) * w, hash(i * 2.3) * h, 1.4 * U, 1.4 * U); } c.strokeStyle = 'rgba(120,95,60,.07)'; for (let i = 0; i < 400; i++) { const x = hash(i + 3e3) * w, y = hash(i + 4e3) * h, a = hash(i + 5e3) * 6.28, l = (10 + hash(i + 6e3) * 50) * U; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } for (let L = 0; L < 4; L++) { const base = h * (.74 + L * .07), amp = (130 - L * 22) * U; c.fillStyle = `rgba(30,30,30,${.06 + L * .05})`; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 8 * U) { const u = x / w; c.lineTo(x, base - amp * (Math.abs(Math.sin(u * 3.1 + L * 2)) * .7 + .3 * Math.sin(u * 11 + L))); } c.lineTo(w, h); c.fill(); } });
  function vignette(a, inner = .35) { const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * inner, W / 2, H / 2, Math.max(W, H) * .72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
  function stamp(txt, x, y, p, rot = -0.18, size = 86, col = '#c0141c') {
    if (p <= 0) return; const s = 1 + 1.4 * (1 - eOut(p / .25)); font(size * U, F.anton); const w = g.measureText(txt).width + 60 * U, h = size * 1.35 * U;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.globalAlpha = .88 * clamp(p / .12); g.strokeStyle = col; g.lineWidth = 9 * U; g.strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 4 * U); g.restore(); g.textBaseline = 'alphabetic';
  }
  const S = TL.shots;
  const shotAt = t => { let i = 0; while (i + 1 < S.length && S[i + 1].t <= t) i++; return i; };
  const endOf = i => i + 1 < S.length ? S[i + 1].t : TL.dur;
  const countUp = (n, lt, d = 1.6) => Math.round(n * eOut(lt / d));
  const fmtNum = (n, pre = '', suf = '') => { n = Number(n); const yearish = Number.isInteger(n) && n >= 1000 && n <= 2100 && !suf; return pre + (yearish ? String(n) : n.toLocaleString('en-US')) + suf; };

  // =====================================================================
  // SKINS: palette + fonts + background + post for the generic shot set
  // =====================================================================
  const SK = {
    news: { bg: t => { g.fillStyle = '#111'; g.fillRect(0, 0, W, H); }, head: F.anton, body: F.inter, ink: '#fff', acc: '#ffd400', red: '#c8102e', filt: 'grayscale(.4) brightness(.5) contrast(1.15)', post: () => {} },
    light: { bg: t => { g.drawImage(LIGHT, 0, 0); grain(t, .05); }, head: F.fell, body: F.type, ink: '#1d1d1d', acc: '#b3121a', filt: 'sepia(.25) contrast(1.05)', post: () => {} },
    board: { bg: t => { g.drawImage(CORK, 0, 0); }, head: F.anton, body: F.type, ink: '#1d1d1d', acc: '#b71c1c', filt: 'sepia(.3) contrast(1.1)', post: t => { vignette(.45); grain(t, .06); } },
    map: { bg: t => { const sg = g.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, '#071a2b'); sg.addColorStop(1, '#03101c'); g.fillStyle = sg; g.fillRect(0, 0, W, H); }, head: F.mono, body: F.mono, ink: '#e8fbff', acc: '#ffd27a', filt: 'grayscale(.5) contrast(1.1) sepia(.2) hue-rotate(150deg) saturate(.6)', post: t => { scan(t); } },
    reel: { bg: t => { g.fillStyle = '#111'; g.fillRect(0, 0, W, H); }, head: F.fell, body: F.fell, ink: '#f3eee2', acc: '#ffffff', filt: 'grayscale(1) contrast(1.35) brightness(.95) sepia(.18)', post: t => reelPost(t) },
    count: { bg: t => countBg(t), head: F.anton, body: F.inter, ink: '#111', acc: '#c8102e', filt: 'grayscale(1) contrast(1.2)', post: () => {} },
    chalk: { bg: t => { g.drawImage(BOARD, 0, 0); }, head: F.chalk, body: F.chalk, ink: '#f3f1e7', acc: '#f6b26b', filt: 'grayscale(1) contrast(1.1) brightness(1.05)', post: t => vignette(.35) },
    blueprint: { bg: t => bpBg(t), head: F.mono, body: F.mono, ink: '#f2f7ff', acc: '#ffd166', filt: 'grayscale(1) contrast(1.2) sepia(1) hue-rotate(180deg) saturate(2.2) brightness(.9)', post: () => {} },
    ink: { bg: t => { g.drawImage(WASHI, 0, 0); }, head: F.fell, body: F.corm, ink: '#161616', acc: '#b8312f', filt: 'grayscale(1) sepia(.45) contrast(1.15) brightness(1.05)', post: t => grain(t, .04) },
    whiteboard: { bg: t => { window.ILLUS.bg(g, W, H, 'whiteboard', 'blank', t); }, head: F.chalk, body: F.chalk, ink: '#1c1c1f', acc: '#e4573d', filt: 'grayscale(.15) contrast(1.05)', post: () => {} },
    cartoon: { bg: t => { window.ILLUS.bg(g, W, H, 'cartoon', 'blank', t); }, head: F.anton, body: F.inter, ink: '#2a2737', acc: '#e4573d', filt: 'saturate(1.1) contrast(1.05)', post: () => vignette(.18) },
    rubberhose: { bg: t => { window.ILLUS.bg(g, W, H, 'rubberhose', 'blank', t); }, head: F.bebas, body: F.bebas, ink: '#111', acc: '#111', filt: 'grayscale(1) sepia(.35) contrast(1.25)', post: t => { grain(t, .18, 'overlay'); vignette(.75, .3); } },
    paper: { bg: t => { window.ILLUS.bg(g, W, H, 'paper', 'blank', t); }, head: F.anton, body: F.inter, ink: '#3a3438', acc: '#e05a47', filt: 'saturate(1.05)', post: t => { grain(t, .05); vignette(.3); } },
    hud: { bg: t => hudBg(t), head: F.mono, body: F.mono, ink: '#c9fbff', acc: '#00e5ff', red: '#ff3df2', filt: 'grayscale(1) contrast(1.25) sepia(1) hue-rotate(140deg) saturate(2.5) brightness(.85)', post: t => { g.fillStyle = 'rgba(0,229,255,0.045)'; for (let y = (t * 40 * U) % (4 * U); y < H; y += 4 * U) g.fillRect(0, y, W, 1.4 * U); vignette(.5); } },
  };
  if (window.makeSkins) Object.assign(SK, window.makeSkins({ get g() { return g; }, W, H, U, V, F, clamp, hash, grain, vignette, cover, rr, font, mk }));
  function bpBg(t) { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#1f5aa6'); gr.addColorStop(1, '#173f7a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); const s = 40 * U, ox = (t * 6 * U) % s; g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.08)'; for (let x = -s + ox; x < W; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = -s + ox; y < H; y += s) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.strokeStyle = 'rgba(255,255,255,0.18)'; for (let x = -s * 5 + ox; x < W; x += s * 5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = -s * 5 + ox; y < H; y += s * 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } const m = 30 * U; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2 * U; g.strokeRect(m, m, W - 2 * m, H - 2 * m); font(18 * U, F.mono); g.fillStyle = 'rgba(255,255,255,0.6)'; g.textAlign = 'right'; g.fillText('SHEET ' + String(1 + Math.floor(t / 10)).padStart(2, '0') + '  ·  ' + String(M.channel || '').toUpperCase(), W - m - 14 * U, H - m - 14 * U); }
  function hudBg(t) { g.fillStyle = '#03070d'; g.fillRect(0, 0, W, H); const hz = H * .66; g.strokeStyle = 'rgba(0,229,255,0.22)'; g.lineWidth = 1.2 * U; for (let i = -20; i <= 20; i++) { g.beginPath(); g.moveTo(W / 2 + i * 30 * U, hz); g.lineTo(W / 2 + i * 260 * U, H); g.stroke(); } for (let k = 0; k < 14; k++) { const p = ((k + (t * 0.6) % 1) / 14), y = hz + (H - hz) * p * p; g.globalAlpha = p; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.globalAlpha = 1; const m = 40 * U, L = 70 * U; g.strokeStyle = 'rgba(0,229,255,0.7)'; g.lineWidth = 3 * U; [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, a, b]) => { g.beginPath(); g.moveTo(x, y + b * L); g.lineTo(x, y); g.lineTo(x + a * L, y); g.stroke(); }); font(18 * U, F.mono); g.fillStyle = 'rgba(0,229,255,0.7)'; g.textAlign = 'left'; g.fillText('ARCHIVE SCAN // ' + String(M.channel || '').toUpperCase(), m + 10 * U, m + 40 * U); }

  // generic framed photo, per skin
  function framedPhoto(st, s, lt, d, box) {
    const k = S.indexOf(s), K = SK[st]; const { x, y, w, h } = box; const z = s.zoom ? lerp(s.zoom[0], s.zoom[1], eIO(lt / d)) : 1.04 + .08 * clamp(lt / d);
    const [fx, fy] = s.focus || foc(s.img, [.5, .45]);
    if (K.frame) { K.frame(IMG[s.img], box, z, fx, fy, lt, s); return; }
    if (st === 'chalk') { cover(IMG[s.img], x, y, w, h, z, fx, fy, K.filt); g.strokeStyle = 'rgba(243,241,231,.85)'; g.lineWidth = 5 * U; g.strokeRect(x - 10 * U, y - 10 * U, w + 20 * U, h + 20 * U); }
    else if (st === 'blueprint') { cover(IMG[s.img], x, y, w, h, z, fx, fy, K.filt); g.strokeStyle = '#fff'; g.lineWidth = 2 * U; g.strokeRect(x, y, w, h); g.setLineDash([8 * U, 6 * U]); g.beginPath(); g.moveTo(x, y + h + 40 * U); g.lineTo(x + w, y + h + 40 * U); g.stroke(); g.setLineDash([]); font(22 * U, F.mono); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('FIG. ' + (k % 40 + 1), x + w / 2, y + h + 32 * U); }
    else if (st === 'ink') { g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 30 * U; g.fillStyle = '#f7f1e3'; g.fillRect(x - 24 * U, y - 24 * U, w + 48 * U, h + 48 * U); g.restore(); cover(IMG[s.img], x, y, w, h, z, fx, fy, K.filt); g.fillStyle = '#b8312f'; g.fillRect(x + w - 30 * U, y + h - 10 * U, 64 * U, 64 * U); font(24 * U, F.corm, 600); g.fillStyle = '#f7f1e3'; g.textAlign = 'center'; g.fillText(String(M.channel || 'MM').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(), x + w + 2 * U, y + h + 32 * U); }
    else if (st === 'whiteboard') { g.save(); g.rotate(-.01); cover(IMG[s.img], x, y, w, h, z, fx, fy, K.filt); g.strokeStyle = '#1c1c1f'; g.lineWidth = 4 * U; g.strokeRect(x, y, w, h); g.fillStyle = 'rgba(240,230,190,.8)'; g.fillRect(x + w / 2 - 70 * U, y - 18 * U, 140 * U, 36 * U); g.restore(); }
    else if (st === 'paper') { g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 24 * U; g.shadowOffsetY = 12 * U; g.fillStyle = '#fffdf7'; g.fillRect(x - 18 * U, y - 18 * U, w + 36 * U, h + 36 * U); g.restore(); cover(IMG[s.img], x, y, w, h, z, fx, fy, K.filt); }
    else if (st === 'rubberhose') { g.save(); g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 6.29); g.clip(); cover(IMG[s.img], x, y, w, h, z, fx, fy, K.filt); g.restore(); g.strokeStyle = '#111'; g.lineWidth = 10 * U; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 6.29); g.stroke(); }
    else if (st === 'cartoon') { g.save(); rr(x, y, w, h, 28 * U); g.clip(); cover(IMG[s.img], x, y, w, h, z, fx, fy, K.filt); g.restore(); g.strokeStyle = '#2a2737'; g.lineWidth = 8 * U; rr(x, y, w, h, 28 * U); g.stroke(); }
    else if (st === 'hud') { cover(IMG[s.img], x, y, w, h, z, fx, fy, K.filt); g.strokeStyle = '#00e5ff'; g.lineWidth = 2 * U; g.strokeRect(x, y, w, h); const sy = y + ((lt * .5) % 1) * h; g.fillStyle = 'rgba(0,229,255,.25)'; g.fillRect(x, sy, w, 4 * U); font(18 * U, F.mono); g.fillStyle = '#00e5ff'; g.textAlign = 'left'; g.fillText('MATCH ' + (90 + (k * 7) % 10) + '%  //  ID ' + (s.img || '').toUpperCase(), x, y - 12 * U); }
    else cover(IMG[s.img], x, y, w, h, z, fx, fy, K.filt);
  }
  function skinText(st, ln, x, y, size, col, lt, i, align = 'center', it = false) {
    const K = SK[st]; font(size, K.head, st === 'chalk' || st === 'whiteboard' ? 600 : 400, it); g.textAlign = align; g.fillStyle = col;
    if (st === 'chalk' || st === 'whiteboard') { const w = g.measureText(ln).width, p = clamp((lt - i * .35) / .6); g.save(); g.beginPath(); const x0 = align === 'center' ? x - w / 2 : x; g.rect(x0 - 10, y - size, (w + 20) * p, size * 1.4); g.clip(); g.fillText(ln, x, y); g.restore(); }
    else if (st === 'blueprint' || st === 'hud') { const n = Math.floor(clamp((lt - i * .25) / .7) * ln.length); g.fillText(ln.slice(0, n) + (n < ln.length && fr(lt) % 10 < 5 ? '█' : ''), x, y); }
    else { const p = eOut((lt - i * .12) / .5); g.save(); g.globalAlpha *= p; if (K.outline) { const f0 = g.fillStyle; g.lineWidth = size * .12; g.lineJoin = 'round'; g.strokeStyle = K.outline; g.strokeText(ln, x, y + (1 - p) * 20 * U); g.fillStyle = f0; } g.fillText(ln, x, y + (1 - p) * 20 * U); g.restore(); }
  }
  // ----- generic shots -----
  const GEN = {
    photo(st, s, lt, d) {
      SK[st].bg(s.t + lt);
      const box = V ? { x: W * .07, y: H * .2, w: W * .86, h: H * .42 } : { x: W * .2, y: H * .12, w: W * .6, h: H * .62 };
      framedPhoto(st, s, lt, d, box);
      if (s.label) { const K = SK[st]; font(42 * U, K.body); g.fillStyle = K.ink; g.textAlign = 'center'; const L = wrap(s.label, box.w); L.slice(0, 2).forEach((l, i) => skinText(st, l, W / 2, box.y + box.h + 78 * U + i * 52 * U, 42 * U, K.ink, lt - .3, i)); }
      SK[st].post(s.t + lt);
    },
    text(st, s, lt) {
      const K = SK[st]; K.bg(s.t + lt); const L = linesOf(s), maxW = V ? W * .84 : W * .78;
      const sizes = L.map(l => fitText(l, K.head, st === 'chalk' ? 600 : 400, (V ? 120 : 130) * U, maxW)), size = Math.min(...sizes), tot = L.length * size * 1.15, y0 = H * (V ? .4 : .5) - tot / 2 + size * .85;
      L.forEach((l, i) => skinText(st, l, W / 2, y0 + i * size * 1.15, size, i === s.red ? K.acc : K.ink, lt, i));
      if (s.stamp) stamp(s.stamp, W / 2 + (V ? 0 : W * .18), y0 + tot + 30 * U, lt - .6, -.12, 70, st === 'hud' ? '#ff3df2' : '#c0141c');
      K.post(s.t + lt);
    },
    quote(st, s, lt) {
      const K = SK[st]; K.bg(s.t + lt); const maxW = V ? W * .82 : W * .7; const Q = fitWrap(s.quote, K.head === F.anton ? F.fell : K.head, 400, (V ? 84 : 78) * U, maxW, V ? 7 : 4, true);
      font(260 * U, F.fell); g.fillStyle = K.acc; g.globalAlpha = .35; g.textAlign = 'center'; g.fillText('“', W / 2, H * (V ? .3 : .3)); g.globalAlpha = 1;
      const y0 = H * (V ? .42 : .46) - (Q.lines.length - 1) * Q.size * .6; Q.lines.forEach((l, i) => { font(Q.size, K.head === F.anton ? F.fell : K.head, 400, true); const p = eOut((lt - i * .15) / .6); g.globalAlpha = p; g.fillStyle = K.ink; g.textAlign = 'center'; g.fillText(l, W / 2, y0 + i * Q.size * 1.2); g.globalAlpha = 1; });
      if (s.by) { font(38 * U, K.body); g.fillStyle = K.acc; g.globalAlpha = eOut((lt - .9) / .4); g.fillText('— ' + s.by, W / 2, y0 + Q.lines.length * Q.size * 1.2 + 40 * U); g.globalAlpha = 1; }
      K.post(s.t + lt);
    },
    stat(st, s, lt) {
      const K = SK[st]; K.bg(s.t + lt); if (s.img) { cover(IMG[s.img], 0, 0, W, H, 1.1, .5, .4, K.filt + ' brightness(.45)'); }
      const n = countUp(+s.value || 0, lt), txt = fmtNum(n, s.prefix || '', s.suffix || ''); const size = fitText(fmtNum(s.value, s.prefix || '', s.suffix || ''), K.head === F.fell ? F.anton : K.head, st === 'chalk' ? 600 : 400, (V ? 230 : 260) * U, W * .86);
      const p = eBack(lt / .3); g.save(); g.translate(W / 2, H * (V ? .42 : .5)); g.scale(p, p); font(size, K.head === F.fell ? F.anton : K.head, st === 'chalk' ? 600 : 400); g.textAlign = 'center'; g.fillStyle = s.img && (st === 'light' || st === 'ink' || st === 'count') ? '#fff' : K.acc; g.fillText(txt, 0, 0); g.restore();
      const Lb = fitWrap(s.label || '', K.body, 700, 64 * U, W * .8, 2); Lb.lines.forEach((l, i) => { font(Lb.size, K.body, 700); g.textAlign = 'center'; g.fillStyle = s.img && (st === 'light' || st === 'ink' || st === 'count') ? '#fff' : K.ink; g.globalAlpha = eOut((lt - .5) / .4); g.fillText(l, W / 2, H * (V ? .42 : .5) + size * .42 + Lb.size * 1.1 + i * Lb.size * 1.2); g.globalAlpha = 1; });
      K.post(s.t + lt);
    },
    list(st, s, lt) {
      const K = SK[st]; K.bg(s.t + lt); const maxW = V ? W * .8 : W * .62;
      if (s.head) { const hs = fitText(s.head, K.head, st === 'chalk' ? 600 : 400, 90 * U, maxW); skinText(st, s.head, W / 2, H * (V ? .22 : .2), hs, K.acc, lt, 0); }
      const items = s.items || []; const x = V ? W * .1 : W * .22;
      items.forEach(([txt, at], i) => { const p = eOut((s.t + lt - at) / .3); if (p <= 0) return; const y = H * (V ? .32 : .34) + i * (V ? 170 : 130) * U; const R = fitWrap(txt, K.body, 700, 64 * U, maxW - 80 * U, 2);
        g.save(); g.globalAlpha = p; g.translate((1 - p) * -60 * U, 0); g.fillStyle = K.acc; font(64 * U, K.head === F.fell ? F.anton : K.head); g.textAlign = 'left'; g.fillText(st === 'count' ? (items.length - i) + '' : '•', x, y);
        R.lines.forEach((l, k) => { font(R.size, K.body, 700); g.fillStyle = K.ink; g.fillText(l, x + 70 * U, y + k * R.size * 1.15); }); g.restore(); });
      K.post(s.t + lt);
    },
    split(st, s, lt) {
      const K = SK[st]; K.bg(s.t + lt); const p = eOut(lt / .4);
      const boxes = V ? [{ x: W * .1, y: H * .13, w: W * .8, h: H * .26 }, { x: W * .1, y: H * .44, w: W * .8, h: H * .26 }] : [{ x: W * .07, y: H * .2, w: W * .4, h: H * .52 }, { x: W * .53, y: H * .2, w: W * .4, h: H * .52 }];
      [[s.a, s.la], [s.b, s.lb]].forEach(([im, lab], i) => { const b = boxes[i]; g.save(); g.translate((i ? 1 : -1) * (1 - p) * W * .5, 0); g.fillStyle = st === 'count' || st === 'news' ? '#111' : 'rgba(0,0,0,.25)'; g.fillRect(b.x - 12 * U, b.y - 12 * U, b.w + 24 * U, b.h + 24 * U); cover(IMG[im], b.x, b.y, b.w, b.h, 1.05, ...foc(im, [.5, .3]), K.filt); if (lab) { g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(b.x, b.y + b.h - 70 * U, b.w, 70 * U); font(44 * U, F.anton); g.fillStyle = st === 'count' ? '#ffd400' : '#fff'; g.textAlign = 'center'; g.fillText(lab, b.x + b.w / 2, b.y + b.h - 20 * U); } g.restore(); });
      const q = eBack((lt - .4) / .3), cy = V ? H * .415 : H * .46; g.save(); g.translate(W / 2, cy); g.scale(q, q); g.fillStyle = K.acc; g.beginPath(); g.arc(0, 0, 70 * U, 0, 6.29); g.fill(); font(56 * U, F.anton); g.fillStyle = st === 'count' || st === 'light' || st === 'ink' ? '#fff' : '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.vs || 'VS', 0, 4 * U); g.restore(); g.textBaseline = 'alphabetic';
      if (s.head) { const hs = fitText(s.head, F.anton, 400, 76 * U, W * .9); font(hs, F.anton); g.fillStyle = K.ink; g.textAlign = 'center'; g.globalAlpha = eOut((lt - .6) / .4); g.fillText(s.head, W / 2, H * (V ? .09 : .13)); g.globalAlpha = 1; }
      K.post(s.t + lt);
    },
    headline(st, s, lt) { // big headline over a dimmed photo, in skin colours
      const K = SK[st]; K.bg(s.t + lt); if (s.img) cover(IMG[s.img], 0, 0, W, H, 1.08 + lt * .02, ...foc(s.img, [.5, .4]), K.filt + ' brightness(.5)');
      const L = [].concat(s.head || s.lines || []), x = V ? W * .08 : 120 * U, maxW = V ? W * .84 : W - 260 * U;
      if (s.kicker) { font(40 * U, K.body, 700); const w = g.measureText(s.kicker).width + 36 * U; g.fillStyle = K.acc; g.fillRect(x, H * (V ? .26 : .27), w * eOut(lt / .3), 58 * U); g.fillStyle = st === 'news' || st === 'count' ? '#111' : '#000'; g.textAlign = 'left'; g.fillText(s.kicker, x + 18 * U, H * (V ? .26 : .27) + 44 * U); }
      L.forEach((ln, i) => { const size = fitText(ln, F.anton, 400, (V ? 130 : 150) * U, maxW); const p = eOut((lt - .08 - i * .12) / .3); font(size, F.anton); const yy = H * (V ? .3 : .31) + 60 * U + (i + 1) * size * 1.02; g.save(); g.globalAlpha = p; g.translate((1 - p) * -60 * U, 0); if (i === s.hl) { g.fillStyle = K.acc; g.fillRect(x - 14 * U, yy - size * .86, (g.measureText(ln).width + 28 * U) * eOut((lt - .25 - i * .12) / .3), size * .98); g.fillStyle = '#111'; } else g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(ln, x, yy); g.restore(); });
      K.post(s.t + lt);
    },
    punch(st, s, lt) {
      const K = SK[st], k = S.indexOf(s); K.bg(s.t + lt); if (s.img) { cover(IMG[s.img], 0, 0, W, H, 1.25 - lt * .03, .5, .5, K.filt + ' brightness(.45)'); }
      if (st === 'news') { g.fillStyle = s.img ? 'rgba(255,212,0,.55)' : (k % 2 ? '#111' : '#c8102e'); g.fillRect(0, 0, W, H); }
      const sh = (1 - clamp(lt / .25)) * 18 * U, p = eBack(lt / .22); const txt = s.text || linesOf(s).join(' ');
      g.save(); g.translate(W / 2 + (hash(fr(lt)) - .5) * sh, H * (V ? .42 : .5) + (hash(fr(lt) + 3) - .5) * sh); g.scale(1.6 - .6 * p, 1.6 - .6 * p);
      const R = fitWrap(txt, st === 'chalk' ? F.chalk : F.anton, st === 'chalk' ? 600 : 400, (V ? 170 : 220) * U, W * .86, V ? 3 : 2); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = st === 'news' ? (s.img ? '#111' : '#fff') : K.acc; R.lines.forEach((l, i) => { font(R.size, st === 'chalk' ? F.chalk : F.anton, st === 'chalk' ? 600 : 400); const yy = (i - (R.lines.length - 1) / 2) * R.size * 1.05; if (K.outline) { g.save(); g.lineWidth = R.size * .12; g.lineJoin = 'round'; g.strokeStyle = K.outline; g.strokeText(l, 0, yy); g.restore(); } g.fillText(l, 0, yy); }); g.restore(); g.textBaseline = 'alphabetic';
      K.post(s.t + lt);
    },
    black(st, s, lt) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const R = fitWrap(s.text || '', F.type, 400, 96 * U, W * .84, 3); const n = Math.floor(clamp(lt / 1.0) * (s.text || '').length); let used = 0; R.lines.forEach((l, i) => { font(R.size, F.type); g.fillStyle = '#eee'; g.textAlign = 'center'; g.fillText(l.slice(0, Math.max(0, n - used)), W / 2, H / 2 + (i - (R.lines.length - 1) / 2) * R.size * 1.2); used += l.length + 1; }); },
  };

  // =====================================================================
  // STYLE-SPECIFIC SHOTS (hand-tuned)
  // =====================================================================
  // ---- news ----
  function ticker(t) {
    const h = 64 * U, y = H - h; g.fillStyle = '#c8102e'; g.fillRect(0, y, 230 * U, h); g.fillStyle = '#111'; g.fillRect(230 * U, y, W, h);
    font(28 * U, F.anton); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(String(M.channel || '').toUpperCase().slice(0, 14), 115 * U, y + h / 2);
    g.save(); g.beginPath(); g.rect(240 * U, y, W, h); g.clip(); font(28 * U, F.inter, 700); g.textAlign = 'left'; g.fillStyle = '#f2f2f2';
    const msg = (TL.ticker || []).join('   ●   ') + '   ●   '; const mw = g.measureText(msg).width || 1, x0 = 260 * U - ((t * 140 * U) % mw);
    for (let x = x0; x < W; x += mw) g.fillText(msg, x, y + h / 2 + 1); g.restore(); g.textBaseline = 'alphabetic';
  }
  function halftone(alpha, col) { g.save(); g.globalAlpha = alpha; g.fillStyle = col; const s = 16 * U; for (let y = 0; y < H; y += s) for (let x = (y / s % 2) * s / 2; x < W; x += s) { const r = s * .42 * (0.3 + 0.7 * (y / H)); g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill(); } g.restore(); }
  const NEWS = {
    headline(s, lt) {
      cover(IMG[s.img], 0, 0, W, H, 1.08 + lt * 0.02, ...foc(s.img, [.5, .4]), 'grayscale(.4) brightness(.42) contrast(1.15)'); g.fillStyle = 'rgba(160,0,20,0.18)'; g.fillRect(0, 0, W, H); halftone(.10, '#000'); vignette(.6);
      const x = V ? W * .07 : 120 * U, y = H * (V ? .26 : .30), maxW = V ? W * .86 : W - 260 * U;
      font(44 * U, F.anton); const kw = g.measureText(s.kicker || 'BREAKING').width + 36 * U; g.save(); g.translate(x, y - 40 * U); g.scale(eBack(lt / .25), 1); g.fillStyle = '#c8102e'; g.fillRect(0, -33 * U, kw, 66 * U); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(s.kicker || 'BREAKING', 18 * U, 2 * U); g.restore(); g.textBaseline = 'alphabetic';
      [].concat(s.head || []).forEach((ln, i) => { const p = eOut((lt - 0.08 - i * 0.12) / 0.3), size = fitText(ln, F.anton, 400, (V ? 130 : 150) * U, maxW); font(size, F.anton); const w = g.measureText(ln).width, yy = y + 40 * U + (i + 1) * size * 1.02;
        g.save(); g.globalAlpha = p; g.translate((1 - p) * -60 * U, 0); if (i === s.hl) { g.fillStyle = '#ffd400'; g.fillRect(x - 14 * U, yy - size * .86, (w + 28 * U) * eOut((lt - .25 - i * .12) / .3), size * .98); g.fillStyle = '#111'; } else g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(ln, x, yy); g.restore(); });
      ticker(lt + s.t);
    },
    list(s, lt) {
      cover(IMG[s.img], 0, 0, W, H, 1.08 + lt * 0.02, ...foc(s.img, [.5, .4]), 'grayscale(.4) brightness(.35) contrast(1.15)'); halftone(.1, '#000'); vignette(.6);
      (s.items || []).forEach(([txt, at], i) => { const p = eOut((s.t + lt - at) / .25); if (p <= 0) return; const y = H * (V ? .25 : .3) + i * (V ? 190 : 170) * U; const size = fitText(txt, F.anton, 400, 110 * U, (V ? W * .82 : W * .8));
        font(size, F.anton); const w = g.measureText(txt).width; g.save(); g.translate((1 - p) * -W * .3, 0); g.fillStyle = i === (s.items.length - 1) ? '#ffd400' : '#fff'; g.fillRect(V ? W * .06 : 100 * U, y, w + 60 * U, size * 1.27); g.fillStyle = '#111'; g.textAlign = 'left'; g.fillText(txt, (V ? W * .06 : 100 * U) + 30 * U, y + size * 1.05); g.restore(); });
      ticker(lt + s.t);
    },
    tease(s, lt) {
      cover(IMG[s.img], 0, 0, W, H, 1.1 + lt * .02, .5, .5, `blur(${Math.max(4, 26 - lt * 4) * U}px) brightness(.5)`); halftone(.12, '#000');
      const p = eBack(lt / .3); g.save(); g.translate(W / 2, H * .44); g.scale(p, p); const hs = fitText(s.head || '', F.anton, 400, 170 * U, W * .88); font(hs, F.anton); g.textAlign = 'center'; g.fillStyle = '#ffd400'; g.fillText(s.head || '', 0, 0); g.restore();
      const R = fitWrap(s.sub || '', F.inter, 900, 56 * U, W * .84, 2); g.globalAlpha = eOut((lt - .4) / .4); R.lines.forEach((l, i) => { font(R.size, F.inter, 900); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(l, W / 2, H * .44 + 110 * U + i * R.size * 1.2); }); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,212,0,.6)'; g.lineWidth = 6 * U; const r = (200 + (lt * 260) % 260) * U; g.globalAlpha = 1 - ((lt * 260) % 260) / 260; g.beginPath(); g.arc(W / 2, H * .4, r, 0, 6.29); g.stroke(); g.globalAlpha = 1;
      ticker(lt + s.t);
    },
    end(s, lt) {
      g.fillStyle = '#111'; g.fillRect(0, 0, W, H); halftone(.08, '#c8102e');
      const p = eBack(lt / .4); g.save(); g.translate(W / 2, H * .3); g.scale(p, p); const cs = fitText(String(M.channel || '').toUpperCase(), F.anton, 400, 140 * U, W * .86); font(cs, F.anton); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(String(M.channel || '').toUpperCase(), 0, 0); g.restore();
      const bp = eBack((lt - .5) / .3), bx = W / 2, by = H * .46; g.save(); g.translate(bx, by); g.scale(bp, bp); const clicked = lt > 1.6;
      g.fillStyle = clicked ? '#3a3a3a' : '#c8102e'; rr(-230 * U, -55 * U, 460 * U, 110 * U, 18 * U); g.fill(); font(54 * U, F.inter, 900); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(clicked ? 'SUBSCRIBED ✓' : 'SUBSCRIBE', 0, 4 * U); g.restore(); g.textBaseline = 'alphabetic';
      const cp = eIO((lt - .8) / .7); g.fillStyle = '#fff'; g.save(); g.translate(lerp(W * .8, bx + 60 * U, cp), lerp(H * .85, by + 20 * U, cp)); const sq = lt > 1.55 && lt < 1.7 ? .85 : 1; g.scale(sq, sq); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 48 * U); g.lineTo(13 * U, 36 * U); g.lineTo(24 * U, 58 * U); g.lineTo(32 * U, 54 * U); g.lineTo(21 * U, 33 * U); g.lineTo(38 * U, 33 * U); g.closePath(); g.fill(); g.restore();
      if (M.next) { const np = eOut((lt - 2.2) / .5), bw = Math.min(W * .9, 840 * U); g.globalAlpha = np; g.fillStyle = '#ffd400'; g.fillRect(W / 2 - bw / 2, H * .62, bw, 190 * U); g.fillStyle = '#111'; font(34 * U, F.inter, 900); g.textAlign = 'center'; g.fillText(V ? 'NEXT' : 'NEXT EPISODE', W / 2, H * .62 + 60 * U); const ns = fitText(M.next.toUpperCase(), F.anton, 400, 80 * U, bw - 40 * U); font(ns, F.anton); g.fillText(M.next.toUpperCase(), W / 2, H * .62 + 150 * U); g.globalAlpha = 1; }
    },
  };
  NEWS.punch = (s, lt) => GEN.punch('news', s, lt);

  // ---- light table ----
  function tape(x, y, w, h, rot) { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = 'rgba(240,230,190,.72)'; g.fillRect(-w / 2, -h / 2, w, h); g.restore(); }
  function label(txt, x, y, rot = -0.02) { font(38 * U, F.type); const w = Math.min(g.measureText(txt).width + 40 * U, W * .9); g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = '#fbf7ea'; g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 8 * U; g.fillRect(-w / 2, -32 * U, w, 64 * U); g.shadowBlur = 0; g.fillStyle = '#2a2a2a'; g.textAlign = 'center'; g.fillText(txt, 0, 12 * U, w - 30 * U); g.restore(); }
  const LIGHTS = {
    photo(s, lt, d) {
      SK.light.bg(s.t + lt); const k = S.indexOf(s), rot = (hash(k) - .5) * .06, pw = V ? W * .86 : W * .6, ph = V ? H * .44 : H * .6, cx = W / 2 + (hash(k + 2) - .5) * 60 * U, cy = H * (V ? .38 : .42);
      const p = eOut(lt / .35), z = s.zoom ? lerp(s.zoom[0], s.zoom[1], clamp(lt / d)) : 1.04 + .1 * clamp(lt / d), [fx, fy] = s.focus || foc(s.img, [.5, .45]);
      g.save(); g.translate(cx + (1 - p) * 200 * U, cy); g.rotate(rot + (1 - p) * .1);
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 40 * U; g.shadowOffsetY = 14 * U; g.fillStyle = '#fbfaf5'; g.fillRect(-pw / 2 - 22 * U, -ph / 2 - 22 * U, pw + 44 * U, ph + 44 * U); g.shadowBlur = 0; g.shadowOffsetY = 0;
      cover(IMG[s.img], -pw / 2, -ph / 2, pw, ph, z, fx, fy, 'sepia(.25) contrast(1.05)');
      tape(-pw / 2 + 30 * U, -ph / 2 - 10 * U, 160 * U, 44 * U, -.5); tape(pw / 2 - 30 * U, -ph / 2 - 10 * U, 160 * U, 44 * U, .5); g.restore();
      if (s.label) label(s.label, cx - (V ? 0 : pw * .2), cy + ph / 2 + 60 * U);
      const lx = cx + Math.sin((s.t + lt) * .5) * pw * .25, ly = cy + Math.cos((s.t + lt) * .4) * ph * .15, R = 120 * U;
      g.save(); g.globalAlpha = .9 * eOut((lt - .6) / .5); g.beginPath(); g.arc(lx, ly, R, 0, 6.29); g.clip(); g.translate(lx, ly); g.scale(1.6, 1.6); g.translate(-lx, -ly);
      g.translate(cx, cy); g.rotate(rot); cover(IMG[s.img], -pw / 2, -ph / 2, pw, ph, z, fx, fy, 'sepia(.25) contrast(1.1)'); g.restore();
      g.save(); g.globalAlpha = eOut((lt - .6) / .5); g.strokeStyle = '#222'; g.lineWidth = 10 * U; g.beginPath(); g.arc(lx, ly, R, 0, 6.29); g.stroke(); g.lineWidth = 22 * U; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx + R * .72, ly + R * .72); g.lineTo(lx + R * 1.3, ly + R * 1.3); g.stroke(); g.restore();
    },
    text(s, lt) {
      SK.light.bg(s.t + lt); const L = linesOf(s), cw = V ? W * .88 : W * .62, ch = V ? H * .34 : H * .52, cx = W / 2, cy = H * (V ? .4 : .46), p = eOut(lt / .3);
      g.save(); g.translate(cx, cy + (1 - p) * 80 * U); g.rotate(-.015); g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 30 * U; g.shadowOffsetY = 10 * U; g.fillStyle = '#fbf7e6'; g.fillRect(-cw / 2, -ch / 2, cw, ch); g.shadowBlur = 0; g.shadowOffsetY = 0;
      g.strokeStyle = 'rgba(70,110,200,.35)'; g.lineWidth = 2 * U; for (let y = -ch / 2 + 110 * U; y < ch / 2; y += 56 * U) { g.beginPath(); g.moveTo(-cw / 2, y); g.lineTo(cw / 2, y); g.stroke(); }
      g.strokeStyle = 'rgba(220,60,60,.6)'; g.beginPath(); g.moveTo(-cw / 2, -ch / 2 + 80 * U); g.lineTo(cw / 2, -ch / 2 + 80 * U); g.stroke();
      const total = L.join(' ').length, n = Math.floor(clamp((lt - .15) / Math.max(.6, total / 38)) * total); let used = 0; const size = Math.min(...L.map(l => fitText(l, F.type, 400, 92 * U, cw - 100 * U)));
      L.forEach((ln, i) => { font(size, F.type); g.fillStyle = s.red === i ? '#b3121a' : '#1d1d1d'; g.textAlign = 'center'; const vis = ln.slice(0, Math.max(0, n - used)); used += ln.length + 1; g.fillText(vis, 0, -30 * U + i * size * 1.3 - (L.length - 1) * size * .55); });
      g.restore(); if (s.stamp) stamp(s.stamp, cx + cw * .25, cy + ch * .3, lt - .5);
    },
  };

  // ---- evidence board (pins laid out by the timeline builder) ----
  const PINS = {}; (TL.board || []).forEach(p => PINS[p.id] = p);
  const order = (TL.board || []).map(p => p.id);
  const firstSeen = {}; for (const s of S) if (s.type === 'board') for (const p of s.pins || []) if (firstSeen[p] === undefined) firstSeen[p] = s.t;
  const centerId = ((TL.board || []).find(p => p.center) || {}).id;
  const BW = V ? 1080 : 1920, BH = V ? 1920 : 1080;   // board world size (layout computed per orientation)
  const pos = id => (V ? PINS[id].pv : PINS[id].ph) || [BW / 2, BH / 2];
  function boardCam(s) { if (!s.focus || s.focus === 'all' || !PINS[s.focus]) return { x: BW / 2, y: BH * .48, z: .92 }; const [x, y] = pos(s.focus); return { x, y, z: 1.55 }; }
  function drawPin(key, t) {
    const P = PINS[key], a = t - firstSeen[key]; if (a < 0) return; const [px, py] = pos(key); const p = eBack(a / .35), rot = (hash(key.length * 7 + px) - .5) * .12;
    g.save(); g.translate(px * U, py * U); g.rotate(rot + (1 - clamp(a / .35)) * .4); g.scale(p, p); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 20 * U; g.shadowOffsetY = 10 * U;
    let top = 90;
    if (P.kind === 'photo') { const w = (P.center ? 360 : 300) * U, h = w * 1.12; top = (P.center ? 190 : 160); g.fillStyle = '#f6f3ea'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0; g.shadowOffsetY = 0; cover(IMG[P.img], -w / 2 + 16 * U, -h / 2 + 16 * U, w - 32 * U, w - 32 * U, 1.05, ...foc(P.img, [.5, .3]), 'sepia(.3) contrast(1.1)'); font(28 * U, F.type); g.fillStyle = '#222'; g.textAlign = 'center'; g.fillText(P.cap || '', 0, h / 2 - 26 * U, w - 20 * U); }
    else if (P.kind === 'marker') { const w = 820 * U, h = 130 * U; g.fillStyle = '#fff59d'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0; g.shadowOffsetY = 0; const ms = fitText((P.lines || [])[0] || '', F.anton, 400, 58 * U, w - 40 * U); font(ms, F.anton); g.fillStyle = '#b3121a'; g.textAlign = 'center'; g.fillText((P.lines || [])[0] || '', 0, 20 * U); top = 70; }
    else { const L = P.lines || [], w = 380 * U, h = Math.max(200, 80 + L.length * 64) * U; top = h / U / 2 + 4; g.fillStyle = '#fbf7e6'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0; g.shadowOffsetY = 0;
      const sz = Math.min(...L.map(l => fitText(l, F.type, 400, 52 * U, w - 40 * U)), 52 * U); g.textAlign = 'center'; g.fillStyle = P.red ? '#b3121a' : '#1d1d1d';
      L.forEach((ln, i) => { if (L.length > 2 && a < .4 + i * .35) return; font(sz, F.type); g.fillText(ln, 0, -h / 2 + 70 * U + i * sz * 1.25); }); }
    g.restore();
    g.fillStyle = '#d32f2f'; g.beginPath(); g.arc(px * U, (py - top) * U, 13 * U * p, 0, 6.29); g.fill();
    if (P.stamp) stamp(P.stamp, px * U + 60 * U, py * U + (P.kind === 'photo' ? 60 : 90) * U, a - .5, -.12, 46);
  }
  function boardShot(s, lt, d, i) {
    const t = s.t + lt, prevS = S[i - 1] && S[i - 1].type === 'board' ? S[i - 1] : null, prev = prevS ? boardCam(prevS) : { x: BW / 2, y: BH / 2, z: .8 }, cam = boardCam(s), k = eIO(lt / .9);
    const cx = lerp(prev.x, cam.x, k), cy = lerp(prev.y, cam.y, k), z = lerp(prev.z, cam.z, k) * (1 + lt * .01);
    g.drawImage(CORK, 0, 0); g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-cx * U, -cy * U);
    const seen = order.filter(id => firstSeen[id] !== undefined && firstSeen[id] <= t);
    // strings: chain in reveal order, plus every pin to the centre pin once it appears
    const pairs = []; for (let k2 = 1; k2 < seen.length; k2++) if (seen[k2] !== centerId && seen[k2 - 1] !== centerId) pairs.push([seen[k2 - 1], seen[k2], Math.max(firstSeen[seen[k2 - 1]], firstSeen[seen[k2]]) + .3]);
    if (centerId && seen.includes(centerId)) seen.forEach((id, k2) => { if (id !== centerId) pairs.push([id, centerId, firstSeen[centerId] + .4 + k2 * .15]); });
    for (const [a, b, st] of pairs) { const pr = clamp((t - st) / .6); if (pr <= 0) continue; const [ax, ay] = pos(a), [bx, by] = pos(b); g.strokeStyle = '#b71c1c'; g.lineWidth = 4 * U; g.beginPath(); g.moveTo(ax * U, ay * U); const mx = lerp(ax, bx, pr), my = lerp(ay, by, pr); g.quadraticCurveTo(lerp(ax, mx, .5) * U, (lerp(ay, my, .5) + 25) * U, mx * U, my * U); g.stroke(); }
    for (const id of seen) drawPin(id, t);
    g.restore(); vignette(.45); grain(t, .06);
  }

  // ---- satellite map ----
  const MAPR = []; for (const c of window.MAP || []) for (const r of c.p) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let k = 0; k < r.length; k += 2) { x0 = Math.min(x0, r[k]); x1 = Math.max(x1, r[k]); y0 = Math.min(y0, r[k + 1]); y1 = Math.max(y1, r[k + 1]); } MAPR.push({ r, x0, x1, y0, y1, n: c.n }); }
  const HL = new Set((TL.highlight || []));
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + clamp(lat, -85, 85) * Math.PI / 360)) * 180 / Math.PI;
  const PLACES = {}; (TL.places || []).forEach(p => PLACES[p.id] = p);
  const RT = TL.route || null, ROUTE = RT ? RT.points : [];
  const rlen = []; let tot = 0; for (let k = 1; k < ROUTE.length; k++) { tot += Math.hypot(ROUTE[k][0] - ROUTE[k - 1][0], ROUTE[k][1] - ROUTE[k - 1][1]); rlen.push(tot); }
  function routePt(p) { if (ROUTE.length < 2) return [0, 0, 0]; const d = p * tot; let k = 0; while (k < rlen.length - 1 && rlen[k] < d) k++; const d0 = k ? rlen[k - 1] : 0, f = (d - d0) / (rlen[k] - d0 || 1); return [lerp(ROUTE[k][0], ROUTE[k + 1][0], f), lerp(ROUTE[k][1], ROUTE[k + 1][1], f), k]; }
  const routeP = t => RT ? clamp((t - RT.t0) / (RT.t1 - RT.t0 || 1)) : 0;
  function fitCam(pts, pad = 1.6) { if (!pts.length) return [0, 20, 6]; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, merc(y)); y1 = Math.max(y1, merc(y)); } const cx = (x0 + x1) / 2, cyM = (y0 + y1) / 2; const sx = Math.max(x1 - x0, .5) * pad, sy = Math.max(y1 - y0, .5) * pad; const z = Math.min(W / U / sx, H / U / sy); const lat = Math.atan(Math.sinh(cyM * Math.PI / 180)) * 180 / Math.PI; return [cx, lat, z]; }
  const allPts = [...(TL.places || []).map(p => [p.lon, p.lat]), ...ROUTE];
  function camFor(s, t) {
    const c = s.cam || 'fit';
    if (c === 'world') return [20, 20, V ? 3 : 5];
    if (c === 'wide') { const f = fitCam(allPts, 1.6); return [f[0], f[1], f[2] / 6]; }
    if (c === 'fit') return fitCam(allPts, 1.5);
    if (c === 'route') return fitCam(ROUTE.length ? ROUTE : allPts, 1.4);
    if (c === 'follow') { const [x, y] = routePt(routeP(t)); const f = fitCam(ROUTE.length ? ROUTE : allPts, 1.4); return [x, y, f[2] * 1.7]; }
    if (c === 'end' && ROUTE.length) { const e = ROUTE[ROUTE.length - 1], f = fitCam(ROUTE, 1.4); return [e[0], e[1], f[2] * 2.6]; }
    if (PLACES[c]) { const f = fitCam(allPts, 1.5); return [PLACES[c].lon, PLACES[c].lat, f[2] * 2.2]; }
    return fitCam(allPts, 1.5);
  }
  function camAt(i, t) { const s = S[i], target = camFor(s, t), lt = t - s.t; if (!S[i - 1] || S[i - 1].type !== 'map' || lt >= 1.4) return target; const from = camAt(i - 1, s.t), k = eIO(lt / 1.4); return [lerp(from[0], target[0], k), lerp(from[1], target[1], k), Math.exp(lerp(Math.log(from[2]), Math.log(target[2]), k))]; }
  function drawLand(X, Y, vx0, vx1, cy, z) {
    g.beginPath(); for (const R of MAPR) { if (R.x1 < vx0 || R.x0 > vx1 || R.y1 < cy - 80 || R.y0 > cy + 80) continue; const r = R.r; g.moveTo(X(r[0]), Y(r[1])); for (let k = 2; k < r.length; k += 2) g.lineTo(X(r[k]), Y(r[k + 1])); g.closePath(); }
    g.fillStyle = '#1e2c25'; g.fill(); g.save(); g.clip(); g.globalAlpha = .35; g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(GR[0], 'repeat'); g.fillRect(0, 0, W, H); g.restore(); g.strokeStyle = 'rgba(120,220,200,.35)'; g.lineWidth = 1.4 * U; g.stroke();
    if (HL.size) { g.beginPath(); for (const R of MAPR) { if (!HL.has(R.n)) continue; const r = R.r; g.moveTo(X(r[0]), Y(r[1])); for (let k = 2; k < r.length; k += 2) g.lineTo(X(r[k]), Y(r[k + 1])); g.closePath(); } g.fillStyle = 'rgba(70,120,95,.55)'; g.fill(); g.strokeStyle = 'rgba(150,255,220,.6)'; g.lineWidth = 2 * U; g.stroke(); }
  }
  function mapShot(s, lt, d, i) {
    const t = s.t + lt, [cx, cy, z] = camAt(i, t), mcy = merc(cy);
    const X = lon => W / 2 + (lon - cx) * z * U, Y = lat => H / 2 - (merc(lat) - mcy) * z * U;
    SK.map.bg(t); const vx0 = cx - W / 2 / (z * U) - 1, vx1 = cx + W / 2 / (z * U) + 1; drawLand(X, Y, vx0, vx1, cy, z); grain(t, .07);
    g.strokeStyle = 'rgba(120,220,255,.12)'; g.lineWidth = 1; const step = z > 200 ? .5 : z > 40 ? 2 : z > 12 ? 5 : 15; font(16 * U, F.mono); g.fillStyle = 'rgba(150,230,255,.5)';
    for (let lon = Math.floor(vx0 / step) * step; lon < vx1; lon += step) { const x = X(lon); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); g.textAlign = 'left'; g.fillText(Math.abs(lon).toFixed(1) + (lon >= 0 ? '°E' : '°W'), x + 4, H - 80 * U); }
    const span = H / 2 / (z * U); for (let lat = Math.floor((cy - span * 1.5) / step) * step; lat < cy + span * 1.5; lat += step) { const y = Y(lat); if (y < 0 || y > H) continue; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.fillText(Math.abs(lat).toFixed(1) + (lat >= 0 ? '°N' : '°S'), 8, y - 4); }
    const rp = s.route ? routeP(t) : 0;
    if ((s.dashed || s.route) && ROUTE.length) { g.setLineDash([12 * U, 10 * U]); g.strokeStyle = 'rgba(255,190,90,.45)'; g.lineWidth = 3 * U; g.beginPath(); ROUTE.forEach(([a, b], k) => k ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b))); g.stroke(); g.setLineDash([]); }
    if (s.route && rp > 0 && ROUTE.length > 1) {
      const [hx, hy, hk] = routePt(rp); g.strokeStyle = '#ffb347'; g.lineWidth = 7 * U; g.shadowColor = '#ff8a00'; g.shadowBlur = 24 * U; g.beginPath();
      for (let k = 0; k <= hk; k++) k ? g.lineTo(X(ROUTE[k][0]), Y(ROUTE[k][1])) : g.moveTo(X(ROUTE[0][0]), Y(ROUTE[0][1])); g.lineTo(X(hx), Y(hy)); g.stroke(); g.shadowBlur = 0;
      if (s.crowd) { const n = Math.floor(30 + rp * 420); for (let k = 0; k < n; k++) { const q = rp - hash(k) * Math.min(rp, .25); const [qx, qy] = routePt(clamp(q)); g.fillStyle = `rgba(255,230,180,${.35 + .4 * hash(k + 3)})`; g.fillRect(X(qx) + (hash(k + 1) - .5) * 40 * U, Y(qy) + (hash(k + 2) - .5) * 40 * U, 3 * U, 3 * U); } }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(hx), Y(hy), 10 * U, 0, 6.29); g.fill(); const pr = (t * 1.5) % 1; g.strokeStyle = `rgba(255,180,70,${1 - pr})`; g.lineWidth = 3 * U; g.beginPath(); g.arc(X(hx), Y(hy), (10 + pr * 50) * U, 0, 6.29); g.stroke();
      font(22 * U, F.mono); g.fillStyle = '#cfefff'; for (const [nm, k] of RT.labels || []) if (hk >= k - 1 && ROUTE[k]) { const x = X(ROUTE[k][0]), y = Y(ROUTE[k][1]); g.fillRect(x - 4 * U, y - 4 * U, 8 * U, 8 * U); g.textAlign = 'left'; g.fillText(String(nm).toUpperCase(), x + 14 * U, y + 7 * U); }
    }
    for (const key of s.pins || []) { const P = PLACES[key]; if (!P) continue; const x = X(P.lon), y = Y(P.lat), pp = eBack((lt - .2) / .4); g.save(); g.translate(x, y); g.scale(pp, pp); g.fillStyle = P.color || '#4fe3ff'; g.beginPath(); g.arc(0, 0, 12 * U, 0, 6.29); g.fill(); const pr = (t * 1.2) % 1; g.strokeStyle = `rgba(79,227,255,${1 - pr})`; g.lineWidth = 3 * U; g.beginPath(); g.arc(0, 0, (12 + pr * 60) * U, 0, 6.29); g.stroke(); font(28 * U, F.mono, 700); g.fillStyle = '#e8fbff'; g.textAlign = x > W * .7 ? 'right' : 'left'; g.fillText(String(P.name || key).toUpperCase(), x > W * .7 ? -24 * U : 24 * U, 10 * U); g.restore(); }
    if ((s.arrive || (s.route && rp >= 1)) && ROUTE.length) { const e = ROUTE[ROUTE.length - 1]; g.fillStyle = '#ff5252'; g.beginPath(); g.arc(X(e[0]), Y(e[1]), 16 * U, 0, 6.29); g.fill(); font(34 * U, F.mono, 700); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(String(RT.endName || 'ARRIVED').toUpperCase() + ' ✓', X(e[0]) + 26 * U, Y(e[1]) + 12 * U); }
    if (s.count) { const n = Math.floor(clamp((lt - .1) / 1.2) * Math.min(+s.count, 400)); const P = PLACES[(s.pins || [])[0]] || { lon: cx, lat: cy }; for (let k = 0; k < n; k++) { g.fillStyle = '#ffd27a'; g.fillRect(X(P.lon) + 60 * U + (k % 13) * 16 * U, Y(P.lat) + 30 * U + Math.floor(k / 13) * 16 * U, 10 * U, 10 * U); } font(52 * U, F.mono, 700); g.fillStyle = '#ffd27a'; g.textAlign = 'left'; g.fillText(`${s.countLabel || 'COUNT'}: ${Math.round(clamp((lt - .1) / 1.2) * s.count)}`, X(P.lon) + 60 * U, Y(P.lat) + 30 * U + (Math.ceil(Math.min(+s.count, 400) / 13) + 2) * 16 * U); }
    SK.map.post(t); hudFrame(t, s, rp);
    if (s.inset) inset(IMG[s.inset], s.insetLabel || '', lt, s.inset);
    if (s.big) { const p = eBack(lt / .25); g.save(); g.translate(W / 2, H * .5); g.scale(p, p); const bs = fitText(s.big, F.anton, 400, 190 * U, W * .9); font(bs, F.anton); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText(s.big, 6 * U, 6 * U); g.fillStyle = '#ffd27a'; g.fillText(s.big, 0, 0); g.restore(); g.textBaseline = 'alphabetic'; }
    if (s.alert && (fr(lt) % 18 < 12)) { g.fillStyle = 'rgba(200,0,0,.85)'; g.fillRect(0, H * .16, W, 90 * U); const as = fitText('⚠ ' + s.alert, F.mono, 700, 48 * U, W * .92); font(as, F.mono, 700); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('⚠ ' + s.alert, W / 2, H * .16 + 62 * U); }
  }
  function scan(t) { g.fillStyle = 'rgba(120,220,255,.035)'; for (let y = (t * 60) % 6; y < H; y += 6 * U) g.fillRect(0, y, W, 1.5 * U); const sy = ((t * .35) % 1) * H; const gr = g.createLinearGradient(0, sy - 120 * U, 0, sy); gr.addColorStop(0, 'rgba(79,227,255,0)'); gr.addColorStop(1, 'rgba(79,227,255,.10)'); g.fillStyle = gr; g.fillRect(0, sy - 120 * U, W, 120 * U); }
  function hudFrame(t, s, rp) {
    const m = 40 * U, L = 80 * U; g.strokeStyle = 'rgba(79,227,255,.85)'; g.lineWidth = 3 * U;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, a, b]) => { g.beginPath(); g.moveTo(x, y + b * L); g.lineTo(x, y); g.lineTo(x + a * L, y); g.stroke(); });
    font(22 * U, F.mono, 700); g.fillStyle = '#4fe3ff'; g.textAlign = 'left'; g.fillText(('SAT-BRIEF // ' + (M.op || M.title || '')).toUpperCase().slice(0, V ? 28 : 60), m + 20 * U, m + 44 * U);
    const days = RT && RT.days, km = RT && RT.km;
    g.textAlign = 'right'; g.fillText(s.hud || (s.route && days ? `DAY ${String(Math.min(days, 1 + Math.floor(rp * days))).padStart(2, '0')} / ${days}` : ''), W - m - 20 * U, m + (V ? 84 : 44) * U);
    if (s.route && km) { font(64 * U, F.mono, 700); g.fillStyle = '#ffd27a'; g.fillText(`${Math.round(rp * km)} ${RT.unit || 'KM'}`, W - m - 20 * U, m + (V ? 160 : 120) * U); }
    font(18 * U, F.mono); g.fillStyle = 'rgba(79,227,255,.7)'; g.textAlign = 'left'; g.fillText('● REC  ' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0') + ':' + String(fr(t) % 30).padStart(2, '0'), m + 20 * U, H - m - 20 * U);
  }
  function inset(im, lab, lt, id) {
    const w = (V ? 700 : 520) * U, h = (V ? 460 : 360) * U, x = V ? (W - w) / 2 : W - w - 90 * U, y = V ? H * .12 : H * .30, p = eOut((lt - .25) / .4); if (p <= 0) return;
    g.save(); g.globalAlpha = p; g.translate((1 - p) * 120 * U, 0); g.fillStyle = 'rgba(0,20,30,.7)'; g.fillRect(x - 10 * U, y - 10 * U, w + 20 * U, h + 76 * U);
    cover(im, x, y, w, h, 1.05 + lt * .02, ...foc(id, [.5, .35]), SK.map.filt); g.strokeStyle = '#4fe3ff'; g.lineWidth = 2 * U; g.strokeRect(x, y, w, h); font(26 * U, F.mono, 700); g.fillStyle = '#e8fbff'; g.textAlign = 'left'; g.fillText(String(lab).toUpperCase(), x + 4 * U, y + h + 46 * U, w); g.restore();
  }
  const MAPS = {
    photo(s, lt, d, i) { mapShot({ ...s, inset: s.img, insetLabel: s.label, cam: s.cam || (S[i - 1] && S[i - 1].cam) || 'fit' }, lt, d, i); },
    stat(s, lt, d, i) { mapShot({ ...s, cam: s.cam || 'fit', big: fmtNum(countUp(+s.value || 0, lt), s.prefix || '', s.suffix || '') + (s.label ? ' ' + s.label : '') }, lt, d, i); },
    text(s, lt, d, i) { mapShot({ ...s, cam: s.cam || 'fit', big: linesOf(s).join(' ') }, lt, d, i); },
  };

  // ---- silent reel ----
  function reelPost(t, heavy = 1) {
    grain(t, .22 * heavy, 'overlay'); grain(t + 7, .10 * heavy, 'multiply');
    const f = fr(t); g.fillStyle = `rgba(255,255,255,${.04 * hash(f * 1.3)})`; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.5 * U; for (let k = 0; k < 2; k++) if (hash(f * 3 + k) > .6) { const x = hash(f * 7 + k) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8 * U, H); g.stroke(); }
    if (hash(f * 11) > .9) { g.fillStyle = 'rgba(20,20,20,.7)'; g.beginPath(); g.arc(hash(f) * W, hash(f + 1) * H, (2 + hash(f + 2) * 5) * U, 0, 6.29); g.fill(); }
    vignette(.85, .25); g.strokeStyle = '#000'; g.lineWidth = 60 * U; rr(-20 * U, -20 * U, W + 40 * U, H + 40 * U, 90 * U); g.stroke();
  }
  const weave = t => [(hash(fr(t) * .7) - .5) * 4 * U, (hash(fr(t) * .9 + 5) - .5) * 5 * U];
  function interCard(text, by, lt, overlay) {
    const w = W * (V ? .88 : .74), h = H * (V ? .44 : .62), x = (W - w) / 2, y = (H - h) / 2 - (V ? H * .06 : 0); if (overlay) { g.fillStyle = 'rgba(0,0,0,.82)'; g.fillRect(x, y + h * .3, w, h * .4); }
    else { g.strokeStyle = '#e9e2d0'; g.lineWidth = 4 * U; g.strokeRect(x, y, w, h); g.lineWidth = 1.5 * U; g.strokeRect(x + 16 * U, y + 16 * U, w - 32 * U, h - 32 * U); for (const [cx2, cy2] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { g.beginPath(); g.arc(cx2, cy2, 26 * U, 0, 6.29); g.stroke(); } }
    const R = fitWrap(text, F.fell, 400, overlay ? 64 * U : 78 * U, w - 140 * U, overlay ? 2 : (V ? 6 : 4), !overlay); g.fillStyle = '#f3eee2'; g.textAlign = 'center';
    R.lines.forEach((ln, i) => { font(R.size, F.fell, 400, !overlay); g.fillText(ln, W / 2, y + h / 2 - (R.lines.length - 1) * R.size * .6 + i * R.size * 1.2 + (overlay ? 20 * U : 0)); });
    if (by) { font(40 * U, F.fell); g.globalAlpha *= eOut((lt - .8) / .5); g.fillText('— ' + by, W / 2, y + h - 70 * U); g.globalAlpha = 1; }
  }
  const REEL = {
    photo(s, lt, d) {
      g.fillStyle = '#111'; g.fillRect(0, 0, W, H); const [wx, wy] = weave(s.t + lt), sh = s.shake ? Math.sin(lt * 50) * 10 * U * clamp(1 - lt / 1.5) : 0;
      const z = s.zoom ? lerp(s.zoom[0], s.zoom[1], eIO(lt / d)) : 1.02 + .1 * eIO(lt / d); cover(IMG[s.img], wx + sh, wy, W, H, z, ...(s.focus || foc(s.img, [.5, .45])), SK.reel.filt);
      if (s.inter && lt < 1.8) { g.globalAlpha = clamp(1 - (lt - 1.4) / .4); interCard(s.inter, null, lt, true); g.globalAlpha = 1; }
      if (s.label) { const p = eOut((lt - .3) / .4), bs = fitText(s.label, F.fell, 400, 56 * U, W * .84); g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(0, H * (V ? .62 : .72), W * p, 110 * U); font(bs, F.fell); g.fillStyle = '#f3eee2'; g.textAlign = 'left'; g.fillText(s.label, (V ? 50 : 120) * U, H * (V ? .62 : .72) + 74 * U); }
      if (s.stamp) { const p = eBack((lt - .1) / .3); g.save(); g.translate(W / 2, H * (V ? .42 : .5)); g.scale(p, p); g.rotate(-.05); const ss = fitText(s.stamp, F.anton, 400, 110 * U, W * .8); font(ss, F.anton); const w = g.measureText(s.stamp).width + 80 * U; g.fillStyle = '#f3eee2'; g.fillRect(-w / 2, -ss * .86, w, ss * 1.36); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText(s.stamp, 0, ss * .27); g.restore(); }
      reelPost(s.t + lt);
    },
    stat(s, lt) {
      g.fillStyle = '#111'; g.fillRect(0, 0, W, H); if (s.img) cover(IMG[s.img], 0, 0, W, H, 1.08 - lt * .01, .5, .5, SK.reel.filt + ' brightness(.6)'); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, H);
      const txt = fmtNum(countUp(+s.value || 0, lt, 1.8), s.prefix || '', s.suffix || ''); const ss = fitText(fmtNum(s.value, s.prefix || '', s.suffix || ''), F.anton, 400, 250 * U, W * .86); font(ss, F.anton); g.textAlign = 'center'; g.fillStyle = '#f3eee2'; g.fillText(txt, W / 2, H * (V ? .44 : .52)); const ls = fitText(s.label || '', F.fell, 400, 80 * U, W * .84, true); font(ls, F.fell, 400, true); g.fillText(s.label || '', W / 2, H * (V ? .44 : .52) + 110 * U);
      reelPost(s.t + lt);
    },
    quote(s, lt) { g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H); interCard(s.quote, s.by, lt); reelPost(s.t + lt, .8); },
    text(s, lt) { g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H); interCard(linesOf(s).join(' '), null, lt); reelPost(s.t + lt, .8); },
    spin(s, lt) {
      g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, W, H); const p = eOut(lt / 1.1), rot = (1 - p) * Math.PI * 6, sc = lerp(.05, 1, p), w = W * (V ? .84 : .56), h = H * (V ? .6 : .78);
      g.save(); g.translate(W / 2, H / 2); g.rotate(rot); g.scale(sc, sc); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40 * U; g.fillStyle = '#eee'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0;
      cover(IMG[s.img], -w / 2 + 14 * U, -h / 2 + 14 * U, w - 28 * U, h - 28 * U, 1.0, ...foc(s.img, [.5, .2]), 'grayscale(1) contrast(1.2)'); g.restore();
      if (lt > 1.1 && s.text) { const q = eBack((lt - 1.1) / .3); g.save(); g.translate(W / 2, H * .1); g.scale(q, q); const ts = fitText(s.text, F.anton, 400, 70 * U, W * .9); font(ts, F.anton); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(s.text, 0, 0); g.restore(); }
      reelPost(s.t + lt, .9);
    },
    globe(s, lt) {
      g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H); const z = V ? 3.2 : 5.2, X = lon => W / 2 + (lon - 20) * z * U, Y = lat => H * .52 - merc(lat) * z * U;
      g.beginPath(); for (const R of MAPR) { const r = R.r; g.moveTo(X(r[0]), Y(r[1])); for (let k = 2; k < r.length; k += 2) g.lineTo(X(r[k]), Y(r[k + 1])); g.closePath(); } g.fillStyle = '#d8d2c4'; g.fill();
      const cities = [[-74, 40.7], [-0.1, 51.5], [2.35, 48.85], [72.8, 19], [88.4, 22.6], [139.7, 35.7], [-87.6, 41.9], [13.4, 52.5], [151.2, -33.9], [-46.6, -23.5], [31.2, 30], [116.4, 39.9], [77.2, 28.6], [-122.4, 37.8], [18.4, -33.9]];
      cities.forEach(([lo, la], k) => { const pr = clamp((lt - k * .12) / .6); if (pr <= 0) return; g.strokeStyle = `rgba(20,20,20,${1 - pr})`; g.lineWidth = 4 * U; g.beginPath(); g.arc(X(lo), Y(la), 6 * U + pr * 50 * U, 0, 6.29); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(X(lo), Y(la), 7 * U, 0, 6.29); g.fill(); });
      if (s.text) { const p = eOut((lt - .8) / .5), ts = fitText(s.text, F.fell, 400, 90 * U, W * .9); g.globalAlpha = p; g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(0, H * .05, W, 140 * U); font(ts, F.fell); g.fillStyle = '#f3eee2'; g.textAlign = 'center'; g.fillText(s.text, W / 2, H * .05 + 100 * U); g.globalAlpha = 1; }
      reelPost(s.t + lt, .7);
    },
  };

  // ---- countdown ----
  function countBg(t) { g.fillStyle = '#ffd400'; g.fillRect(0, 0, W, H); g.save(); g.globalAlpha = .1; g.fillStyle = '#000'; const s = 120 * U, o = (t * 80 * U) % (s * 2); for (let x = -H - s * 2 + o; x < W + H; x += s * 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + s, 0); g.lineTo(x + s + H, H); g.lineTo(x + H, H); g.closePath(); g.fill(); } g.restore(); }
  const COUNT = {
    countintro(s, lt) { countBg(s.t + lt); const p = eBack(lt / .3), txt = s.text || '3 THINGS'; g.save(); g.translate(W / 2, H * (V ? .42 : .5)); g.scale(p, p); const ts = fitText(txt, F.anton, 400, 260 * U, W * .9); font(ts, F.anton); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#111'; g.fillText(txt, 0, 0); g.restore(); g.textBaseline = 'alphabetic'; if (s.sub) { const R = fitWrap(s.sub, F.inter, 900, 60 * U, W * .86, 2); g.globalAlpha = eOut((lt - .4) / .3); R.lines.forEach((l, i) => { font(R.size, F.inter, 900); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText(l, W / 2, H * (V ? .42 : .5) + 180 * U + i * R.size * 1.2); }); g.globalAlpha = 1; } },
    num(s, lt) {
      countBg(s.t + lt); const p = eBack(lt / .28), sh = (1 - clamp(lt / .3)) * 20 * U;
      g.save(); g.translate(W / 2 + (hash(fr(lt)) - .5) * sh, H * (V ? .42 : .5) + (hash(fr(lt) + 1) - .5) * sh); g.scale(2.2 - 1.2 * p, 2.2 - 1.2 * p);
      g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, 330 * U, 0, 6.29); g.fill(); g.strokeStyle = '#ffd400'; g.lineWidth = 16 * U; g.beginPath(); g.arc(0, 0, 290 * U, -Math.PI / 2, -Math.PI / 2 + 6.283 * clamp(lt / 1.2)); g.stroke();
      font(480 * U, F.anton); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd400'; g.fillText(String(s.n), 0, 20 * U); g.restore(); g.textBaseline = 'alphabetic';
      font(48 * U, F.inter, 900); g.fillStyle = '#111'; g.textAlign = 'left'; g.fillText('#' + s.n, 80 * U, 120 * U);
    },
    photo(s, lt) {
      countBg(s.t + lt); const p = eOut(lt / .35); const big = !!s.big;
      const box = V ? { x: W * .08, y: H * .12, w: W * .84, h: H * .36 } : { x: W * .06, y: H * .17, w: big ? W * .55 : W * .44, h: big ? H * .66 : H * .62 };
      g.save(); g.translate(box.x + box.w / 2 - (1 - p) * W * .4, box.y + box.h / 2); g.rotate(-.03); g.fillStyle = '#111'; g.fillRect(-box.w / 2 - 18 * U, -box.h / 2 - 18 * U, box.w + 36 * U, box.h + 36 * U); cover(IMG[s.img], -box.w / 2, -box.h / 2, box.w, box.h, 1.04 + lt * .02, ...(s.focus || foc(s.img, [.5, .3])), s.color ? 'contrast(1.1)' : 'grayscale(1) contrast(1.2)'); g.restore();
      const tx = V ? W * .08 : box.x + box.w + 90 * U, tw = V ? W * .84 : W - tx - 80 * U, ty = V ? box.y + box.h + 190 * U : H * .42, q = eOut((lt - .2) / .35), head = s.head || s.label || '';
      g.save(); g.globalAlpha = q; g.translate((1 - q) * 80 * U, 0); const HR = big && !V ? { size: fitText(head, F.anton, 400, 300 * U, tw), lines: [head] } : fitWrap(head, F.anton, 400, 120 * U, tw, 3); g.fillStyle = '#111'; g.textAlign = 'left'; HR.lines.forEach((ln, i) => { font(HR.size, F.anton); g.fillText(ln, tx, ty + i * HR.size * 1.02); });
      if (s.sub) { const SR = fitWrap(s.sub, F.inter, 900, 46 * U, tw, 3); SR.lines.forEach((ln, i) => { font(SR.size, F.inter, 900); g.fillText(ln, tx, ty + HR.lines.length * HR.size * 1.02 + 30 * U + i * SR.size * 1.2); }); } g.restore();
    },
  };

  // ---- chapter cards ----
  function chapterCard(s, lt) {
    const [a, b] = s.title || ['', ''], st = s.style, p = eBack(lt / .35), K = SK[st] || SK.light;
    const bs = (fam, max) => fitText(b, fam, st === 'chalk' ? 600 : 400, max, W * .84);
    if (st === 'light') { K.bg(s.t + lt); g.save(); g.translate(W / 2, H / 2); g.rotate(-.02); g.scale(p, p); const cw = Math.min(1120 * U, W * .92); g.fillStyle = '#fbf7e6'; g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 30 * U; g.fillRect(-cw / 2, -200 * U, cw, 400 * U); g.shadowBlur = 0; font(44 * U, F.type); g.fillStyle = '#b3121a'; g.textAlign = 'center'; g.fillText(a, 0, -80 * U); const z = fitText(b, F.fell, 400, 150 * U, cw - 80 * U); font(z, F.fell); g.fillStyle = '#1d1d1d'; g.fillText(b, 0, 80 * U); g.restore(); }
    else if (st === 'board') { K.bg(s.t + lt); g.save(); g.translate(W / 2, H / 2); g.rotate(.03); g.scale(p, p); const cw = Math.min(1200 * U, W * .92); g.fillStyle = '#f3ecd8'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30 * U; g.fillRect(-cw / 2, -190 * U, cw, 380 * U); g.shadowBlur = 0; font(40 * U, F.type); g.fillStyle = '#333'; g.textAlign = 'center'; g.fillText('CASE FILE · ' + a, 0, -80 * U); const z = fitText(b, F.anton, 400, 150 * U, cw - 80 * U); font(z, F.anton); g.fillStyle = '#111'; g.fillText(b, 0, 90 * U); g.restore(); stamp('CLASSIFIED', W * .68, H * .72, lt - .5, -.15, 70); vignette(.5); }
    else if (st === 'map') { K.bg(s.t + lt); scan(s.t + lt); font(40 * U, F.mono, 700); g.fillStyle = '#4fe3ff'; g.textAlign = 'center'; const txt = 'MISSION // ' + a; const n = Math.floor(clamp(lt / .8) * txt.length); g.fillText(txt.slice(0, n) + (fr(lt) % 20 < 10 ? '█' : ''), W / 2, H / 2 - 40 * U); font(bs(F.anton, 150 * U), F.anton); g.fillStyle = '#e8fbff'; g.globalAlpha = eOut((lt - .5) / .4); g.fillText(b, W / 2, H / 2 + 120 * U); g.globalAlpha = 1; hudFrame(s.t + lt, { hud: 'LIVE' }, 0); }
    else if (st === 'reel') { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, W, H); if (lt < 1.2) { const n = 3 - Math.floor(lt / .4), sw = (lt % .4) / .4, R = 300 * U; g.strokeStyle = '#ddd'; g.lineWidth = 6 * U; g.beginPath(); g.arc(W / 2, H / 2, R, 0, 6.29); g.stroke(); g.beginPath(); g.moveTo(W / 2 - 420 * U, H / 2); g.lineTo(W / 2 + 420 * U, H / 2); g.moveTo(W / 2, H / 2 - 420 * U); g.lineTo(W / 2, H / 2 + 420 * U); g.stroke(); g.fillStyle = 'rgba(220,220,220,.35)'; g.beginPath(); g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, R, -Math.PI / 2, -Math.PI / 2 + sw * 6.283); g.fill(); font(360 * U, F.fell); g.fillStyle = '#eee'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), W / 2, H / 2 + 20 * U); g.textBaseline = 'alphabetic'; }
      else { g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H); interCard(b, a, lt - 1.2); } reelPost(s.t + lt); }
    else if (st === 'count') { K.bg(s.t + lt); g.save(); g.translate(W / 2, H / 2); g.scale(p, p); font(56 * U, F.inter, 900); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText(a, 0, -120 * U); font(bs(F.anton, 190 * U), F.anton); g.fillText(b, 0, 80 * U); g.restore(); }
    else if (st === 'news') { g.fillStyle = '#c8102e'; g.fillRect(0, 0, W, H); halftone(.12, '#000'); g.save(); g.translate(W / 2, H / 2); g.scale(p, p); font(50 * U, F.inter, 900); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(a, 0, -110 * U); font(bs(F.anton, 180 * U), F.anton); g.fillText(b, 0, 80 * U); g.restore(); }
    else { // chalk, blueprint, ink, hud
      K.bg(s.t + lt); font(46 * U, K.body, st === 'chalk' ? 600 : 400); g.fillStyle = K.acc; g.textAlign = 'center'; skinText(st, a, W / 2, H / 2 - 90 * U, 46 * U, K.acc, lt, 0);
      skinText(st, b, W / 2, H / 2 + 80 * U, bs(K.head, 150 * U), K.ink, lt - .2, 1); if (st === 'ink') { g.fillStyle = '#b8312f'; g.globalAlpha = eOut((lt - .6) / .3); g.fillRect(W / 2 + Math.min(g.measureText(b).width / 2, W * .4), H / 2 + 20 * U, 70 * U, 90 * U); g.globalAlpha = 1; }
      K.post(s.t + lt);
    }
  }

  // ---- captions ----
  const PH = TL.phrases;
  const CAPSTYLE = { news: [F.anton, 70, '#fff', '#ffd400', null, '#000'], light: [F.inter, 54, '#1b1b1b', '#c0141c', 'rgba(251,247,234,.92)'], board: [F.inter, 54, '#fff', '#ffd400', 'rgba(0,0,0,.72)'], map: [F.mono, 46, '#e8fbff', '#ffd27a', 'rgba(0,20,30,.78)'], reel: [F.fell, 60, '#f3eee2', '#ffffff', 'rgba(0,0,0,.75)'], count: [F.anton, 70, '#111', '#c8102e', null, '#ffd400'], chalk: [F.chalk, 66, '#f3f1e7', '#f6b26b', 'rgba(10,25,18,.6)'], blueprint: [F.mono, 46, '#ffffff', '#ffd166', 'rgba(8,30,66,.85)'], ink: [F.corm, 60, '#161616', '#b8312f', 'rgba(245,239,226,.9)'], hud: [F.mono, 46, '#c9fbff', '#ff3df2', 'rgba(0,20,30,.78)'], whiteboard: [F.chalk, 66, '#1c1c1f', '#e4573d', 'rgba(255,255,255,.88)'], cartoon: [F.anton, 66, '#fff', '#ffd400', null, '#2a2737'], rubberhose: [F.bebas, 66, '#f4f1ea', '#ffffff', 'rgba(17,17,17,.85)'], paper: [F.inter, 54, '#3a3438', '#e05a47', 'rgba(255,253,247,.94)'] };
  function captions(t, style) {
    const ph = PH.find(p => t >= p.s - .05 && t < p.e + .25); if (!ph) return; const [fam, sz, col, hi, bg, outline] = CAPSTYLE[style] || (SK[style] && SK[style].cap) || CAPSTYLE.board;
    let size = (V ? sz * 1.15 : sz) * U; font(size, fam, 700); const txt = ph.w.map(w => fam === F.anton ? w.w.toUpperCase() : w.w);
    let sp = g.measureText(' ').width * 1.35 + 6 * U, widths = txt.map(w => g.measureText(w).width), total = widths.reduce((a, b) => a + b, 0) + sp * (txt.length - 1);
    const maxW = W * .92; if (total > maxW) { const k = maxW / total; size *= k; font(size, fam, 700); sp = g.measureText(' ').width * 1.35 + 6 * U; widths = txt.map(w => g.measureText(w).width); total = widths.reduce((a, b) => a + b, 0) + sp * (txt.length - 1); }
    const y = V ? H * .74 : (style === 'news' ? H - 120 * U : H - 92 * U), x0 = W / 2 - total / 2;
    if (bg) { g.fillStyle = bg; rr(x0 - 26 * U, y - size * .95, total + 52 * U, size * 1.35, 12 * U); g.fill(); }
    let x = x0; g.textAlign = 'left';
    txt.forEach((w, i) => { const on = t >= ph.w[i].s - .03 && t < (ph.w[i + 1] ? ph.w[i + 1].s : ph.e + .25); const pop = on ? 1 + .12 * (1 - clamp((t - ph.w[i].s) / .12)) : 1;
      g.save(); g.translate(x + widths[i] / 2, y - size * .3); g.scale(pop, pop); g.translate(-(x + widths[i] / 2), -(y - size * .3));
      if (outline || V) { g.lineWidth = 10 * U; g.strokeStyle = outline || 'rgba(0,0,0,.85)'; g.lineJoin = 'round'; if (!bg) g.strokeText(w, x, y); }
      g.fillStyle = on ? hi : col; g.fillText(w, x, y); g.restore(); x += widths[i] + sp; });
  }
  function progress(t, s) {
    const chs = TL.chapters.filter(c => c.title); if (chs.length < 2 || V) return; const k = chs.findIndex(c => t >= c.t0 && t < c.t1); if (k < 0) return;
    const x = W / 2 - (chs.length * 64 * U) / 2, y = 22 * U; chs.forEach((c, j) => { const f = clamp((t - c.t0) / (c.t1 - c.t0)); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + j * 64 * U, y, 56 * U, 8 * U); g.fillStyle = j === k ? '#ffd400' : '#fff'; g.fillRect(x + j * 64 * U, y, 56 * U * f, 8 * U); });
  }
  function shortsBar(t) { if (!V) return; g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, W, 8 * U); g.fillStyle = '#ffd400'; g.fillRect(0, 0, W * clamp(t / TL.dur), 8 * U); }

  // ---- dispatch ----
  const SPECIAL = { news: NEWS, light: LIGHTS, map: MAPS, reel: REEL, count: COUNT };
  const ENV = { get g() { return g; }, SK, IMG, cover, W, H, U, V, F, TL, clamp, lerp, eOut, eIO, eBack, hash, font, fitText, fitWrap, rr, grain, vignette };
  const drawShot = window.makeDrawShot ? window.makeDrawShot(ENV) : null;
  const FX = window.makeFX ? window.makeFX(ENV) : null;
  const EXAM = window.makeExam ? window.makeExam(ENV) : null;
  const SIM = window.makeSim ? window.makeSim(ENV) : null;     // real physics: projectile, drop, pendulum, spring, collision, incline, dominoes, pile   // JEE/NEET shots: eq, steps, quiz, mistake, diagram
  const BUF = document.createElement('canvas'); BUF.width = W; BUF.height = H; const BCTX = BUF.getContext('2d');
  // default transition per style (a shot may set "trans")
  const DRAWSKIN = { anime: 'cel', scifi: 'cartoon', news: 'cartoon', light: 'paper', board: 'paper', map: 'cartoon', reel: 'rubberhose', count: 'cartoon', chalk: 'paper', blueprint: 'paper', ink: 'paper', hud: 'cartoon' };
  const TRANS = { news: 'whip', light: 'slide', board: 'zoom', map: 'glitch', reel: 'iris', count: 'whip', chalk: 'ink', blueprint: 'slide', ink: 'ink', hud: 'glitch', whiteboard: 'slide', cartoon: 'whip', rubberhose: 'iris', paper: 'tear' };
  // every non-camera shot gets a slow drifting camera so nothing is ever static
  function cam(s, lt, d, i) {
    if (['map', 'board', 'draw', 'chapter', 'end', 'black', 'write'].includes(s.type)) return; const k = i * 1.37, p = lt / Math.max(d, 1);
    g.translate(W / 2, H / 2); g.rotate(Math.sin(k) * .008 * p + Math.sin(lt * .7 + k) * .0025); const z = 1 + .04 * p + .01 * Math.sin(lt * 1.3 + k); g.scale(z, z); g.translate(-W / 2 + Math.sin(k) * 14 * U * p, -H / 2 + Math.cos(k) * 9 * U * p);
  }
  // the creator's own video clips: pre-extracted frames, loaded just in time (render() awaits them)
  const CLIPC = new Map();
  async function needFrames(t) {
    const i = shotAt(t);
    for (const k of [i, i - 1]) { const c = S[k]; if (!c || c.type !== 'clip' || !c.frames) continue;
      const f = Math.max(1, Math.min(c.frames, 1 + Math.floor((t - c.t) * (c.fps || 30)))), key = c.clipDir + '/' + f;
      if (!CLIPC.has(key)) { const im = new Image(); im.src = `${c.clipDir}/f${String(f).padStart(5, '0')}.jpg`; try { await im.decode(); } catch {} CLIPC.set(key, im); if (CLIPC.size > 90) CLIPC.delete(CLIPC.keys().next().value); }
      c._frame = CLIPC.get(key); }
  }
  function clipShot(st, c, lt, d) {
    const K = SK[st] || SK.light, period = ['reel', 'citysym', 'kino'].includes(st);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    cover(c._frame && c._frame.naturalWidth ? c._frame : null, 0, 0, W, H, 1.02 + .03 * clamp(lt / Math.max(d, 1)), .5, .5, period ? K.filt : 'none');
    if (c.label) { const p = eOut((lt - .3) / .4), bs = fitText(c.label, F.anton, 400, 54 * U, W * .8); g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, H * (V ? .62 : .74), W * p, 96 * U); font(bs, F.anton); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(c.label, (V ? 40 : 90) * U, H * (V ? .62 : .74) + 66 * U); }
    if (period) K.post(c.t + lt);
  }
  function paint(i, t) {
    const s = S[i], lt = Math.max(0, t - s.t), d = endOf(i) - s.t, st = SK[s.style] ? s.style : 'light';
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowBlur = 0; curShot = s;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.save(); cam(s, lt, d, i);
    if (s.type === 'chapter') chapterCard({ ...s, style: st }, lt);
    else if (s.type === 'draw' && drawShot) drawShot({ ...s, style: st, drawSkin: SK[st].draw || DRAWSKIN[st], scene: s.scene || SK[st].scene, ownBg: ['whiteboard', 'cartoon', 'rubberhose', 'paper'].includes(st) ? null : () => SK[st].bg(s.t + lt) }, lt, d);
    else if (s.type === 'clip') clipShot(st, s, lt, d);
    else if (s.type === 'board') boardShot(s, lt, d, i);
    else if (s.type === 'map') mapShot(s, lt, d, i);
    else if (s.type === 'num' || s.type === 'countintro') COUNT[s.type](s, lt, d, i);
    else if (['tease', 'end'].includes(s.type)) NEWS[s.type](s, lt, d, i);
    else if (['spin', 'globe'].includes(s.type)) REEL[s.type](s, lt, d, i);
    else if (s.type === 'black') GEN.black(st, s, lt);
    else if (EXAM && EXAM.has(s.type)) EXAM.draw(st, s, lt, d, i);
    else if (SIM && SIM.has(s.type)) SIM.draw(st, s, lt, d, i);
    else if (SPECIAL[st] && SPECIAL[st][s.type]) SPECIAL[st][s.type](s, lt, d, i);
    else (GEN[s.type] || GEN.text)(st, s, lt, d, i);
    g.restore(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0; g.globalCompositeOperation = 'source-over';
    let gx = s.gfx; if (st === 'telestrator' && s.type === 'photo' && !gx) { const [fx, fy] = s.focus || foc(s.img, [.5, .45]); gx = [{ k: 'circle', x: fx, y: fy, r: .14, t: s.t + .5 }, { k: 'arrow', from: [Math.min(.9, fx + .3), Math.max(.12, fy - .28)], to: [fx + .08, fy - .06], t: s.t + 1.1 }]; }
    if (FX && gx) FX.gfx({ ...s, style: st, gfx: gx }, lt, d);
  }
  window.render = async function (t) { await needFrames(t); renderSync(t); };
  function renderSync(t) {
    const i = shotAt(t), s = S[i], lt = Math.max(0, t - s.t), st = SK[s.style] ? s.style : 'light';
    paint(i, t);
    const change = i > 0 && S[i - 1].style !== s.style, TD = s.trans === 'cut' || (EXAM && EXAM.samePage && EXAM.samePage(S[i - 1], s)) ? 0 : (change || s.type === 'chapter') ? .5 : .32;
    if (i > 0 && lt < TD && FX) { const main = g; g = BCTX; paint(i - 1, t); g = main; g.setTransform(1, 0, 0, 1, 0, 0); FX.transition(s.trans || TRANS[s.style] || (SK[s.style] && SK[s.style].trans) || 'whip', lt / TD, BUF); }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
    if (s.type !== 'chapter' && s.type !== 'end') captions(t, st);
    progress(t, s); shortsBar(t);
    const f = Math.max(clamp(1 - t / .4), clamp((t - (TL.dur - .6)) / .6)); if (f > 0) { g.globalAlpha = f; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  };
  window.TEXTS = () => [];
  Promise.all([document.fonts.ready, ...loads, ...(EXAM ? [EXAM.ready] : []), ...['400 40px Anton', '700 40px Inter', '900 40px Inter', '400 40px "Special Elite"', '400 40px "IM Fell English"', 'italic 400 40px "IM Fell English"', '700 40px "JetBrains Mono"', '400 40px "Bebas Neue"', '600 40px Caveat', '600 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"'].map(f => document.fonts.load(f))]).then(() => { window.render(0); window.READY = true; });
})();
