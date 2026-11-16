// 18 more chapter styles for engine v2 (the user's library styles), registered into film.js's skin table.
// Each: bg(t) background, head/body fonts, ink/acc colours, filt (photo filter), frame(im, box, z, fx, fy, lt, s) photo treatment,
// post(t) overlay, cap (caption style), trans (default transition), draw (illustration skin for draw shots), scene (default draw scene).
window.makeSkins = function (C) {
  const { W, H, U, V, F, clamp, hash, grain, vignette, cover, rr, font, mk } = C; const G = () => C.g;
  const tex = {};
  const once = (k, fn) => tex[k] || (tex[k] = mk(W, H, fn));
  const scan = (a, col = '0,0,0') => { const g = G(); g.fillStyle = `rgba(${col},${a})`; for (let y = 0; y < H; y += 4 * U) g.fillRect(0, y, W, 1.6 * U); };
  const shadowBox = (x, y, w, h, col = '#fff', pad = 16, blur = 24) => { const g = G(); g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = blur * U; g.shadowOffsetY = 10 * U; g.fillStyle = col; g.fillRect(x - pad * U, y - pad * U, w + 2 * pad * U, h + 2 * pad * U); g.restore(); };
  function pixelate(im, box, z, fx, fy, filt, px = 6) { const g = G(); const w = Math.max(8, Math.round(box.w / (px * U))), h = Math.max(8, Math.round(box.h / (px * U))); const c = tex['pix' + w + 'x' + h] || (tex['pix' + w + 'x' + h] = mk(w, h, () => {})); const cg = c.getContext('2d'); cg.clearRect(0, 0, w, h); if (im) { const s = Math.max(w / im.width, h / im.height) * z, iw = im.width * s, ih = im.height * s; cg.filter = filt || 'none'; cg.drawImage(im, (w - iw) * fx, (h - ih) * fy, iw, ih); cg.filter = 'none'; } g.save(); g.imageSmoothingEnabled = false; g.drawImage(c, box.x, box.y, box.w, box.h); g.restore(); }
  return {
    ukiyoe: {
      outline: '#efe3c6',
      bg: t => { const g = G(); g.drawImage(once('uki', (c, w, h) => { c.fillStyle = '#efe3c6'; c.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(110,80,40,${hash(i) * .07})`; c.fillRect(hash(i * 1.3) * w, hash(i * 2.1) * h, 2, 2); } c.fillStyle = '#c0392b'; c.beginPath(); c.arc(w * .82, h * .22, Math.min(w, h) * .09, 0, 6.29); c.fill(); }), 0, 0);
        // seigaiha waves rolling along the bottom
        const r = 46 * U, off = (t * 20 * U) % (r * 2); for (let row = 0; row < 4; row++) { const y = H - row * r * .55; for (let x = -r * 2 + off + (row % 2) * r; x < W + r; x += r * 2) { for (let k = 4; k >= 1; k--) { g.fillStyle = k % 2 ? '#1d3a6b' : '#efe3c6'; g.beginPath(); g.arc(x, y, r * k / 4, Math.PI, 0); g.fill(); } } } },
      head: F.corm, body: F.corm, ink: '#1d2a44', acc: '#c0392b', filt: 'sepia(.55) saturate(.7) contrast(1.15)', trans: 'ink', draw: 'paper', scene: 'mountains',
      frame: (im, b, z, fx, fy) => { const g = G(); shadowBox(b.x, b.y, b.w, b.h, '#1d2a44', 14, 20); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'sepia(.55) saturate(.7) contrast(1.15)'); g.fillStyle = '#c0392b'; g.fillRect(b.x + b.w - 40 * U, b.y + 20 * U, 60 * U, 80 * U); },
      post: t => grain(t, .05), cap: [F.corm, 60, '#1d2a44', '#c0392b', 'rgba(239,227,198,.92)'] },
    telestrator: {
      outline: '#000000',
      bg: t => { const g = G(); g.fillStyle = '#0d1117'; g.fillRect(0, 0, W, H); }, head: F.anton, body: F.inter, ink: '#ffffff', acc: '#ffd400', filt: 'contrast(1.1) saturate(1.05)', trans: 'zoom', draw: 'cartoon',
      frame: (im, b, z, fx, fy, lt) => { const g = G(); cover(im, 0, 0, W, H, z * 1.02, fx, fy, 'contrast(1.1) saturate(1.05)'); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, H); font(26 * U, F.inter, 900); g.fillStyle = '#ffd400'; g.fillRect(40 * U, 40 * U, 230 * U, 50 * U); g.fillStyle = '#111'; g.textAlign = 'left'; g.fillText('● ANALYSIS', 58 * U, 74 * U); },
      post: t => {}, cap: [F.anton, 66, '#fff', '#ffd400', null, '#000'] },
    investig: {
      bg: t => { const g = G(); g.fillStyle = '#0a1020'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(80,140,255,.08)'; g.lineWidth = 1; for (let x = 0; x < W; x += 50 * U) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 50 * U) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } },
      head: F.mono, body: F.mono, ink: '#e6eeff', acc: '#ff3b30', filt: 'grayscale(.6) contrast(1.25) brightness(.95)', trans: 'glitch', draw: 'cartoon', scene: 'night',
      frame: (im, b, z, fx, fy, lt, s) => { const g = G(); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'grayscale(.6) contrast(1.25)'); g.strokeStyle = '#ff3b30'; g.lineWidth = 3 * U; g.strokeRect(b.x, b.y, b.w, b.h); font(22 * U, F.mono, 700); g.fillStyle = '#ff3b30'; g.textAlign = 'left'; g.fillText('EXHIBIT ' + String.fromCharCode(65 + ((s && s.t | 0) % 26)) + '  //  ' + (s && s.img || '').toUpperCase(), b.x, b.y - 14 * U); const sy = b.y + ((lt * .6) % 1) * b.h; g.fillStyle = 'rgba(255,59,48,.35)'; g.fillRect(b.x, sy, b.w, 3 * U); },
      post: t => { scan(.12); vignette(.5); }, cap: [F.mono, 46, '#e6eeff', '#ff3b30', 'rgba(10,16,32,.85)'] },
    newspkg: {
      outline: '#062a78',
      bg: t => { const g = G(); const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#062a78'); gr.addColorStop(1, '#0a5cff'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.06)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(W * (k / 6) + (t * 30 * U) % (W / 6), 0); g.lineTo(W * (k / 6) + W * .25 + (t * 30 * U) % (W / 6), H); g.lineTo(W * (k / 6) + W * .3 + (t * 30 * U) % (W / 6), H); g.lineTo(W * (k / 6) + W * .05 + (t * 30 * U) % (W / 6), 0); g.fill(); } },
      head: F.inter, body: F.inter, ink: '#ffffff', acc: '#ffcc00', filt: 'contrast(1.08) saturate(1.1)', trans: 'whip', draw: 'cartoon', scene: 'city',
      frame: (im, b, z, fx, fy) => { const g = G(); shadowBox(b.x, b.y, b.w, b.h, '#fff', 8, 30); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'contrast(1.08) saturate(1.1)'); g.fillStyle = '#e01e1e'; g.fillRect(b.x, b.y, 110 * U, 44 * U); font(26 * U, F.inter, 900); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('LIVE', b.x + 22 * U, b.y + 32 * U); },
      post: t => {}, cap: [F.inter, 54, '#ffffff', '#ffcc00', 'rgba(6,30,90,.88)'] },
    citysym: {
      outline: '#111111',
      bg: t => { const g = G(); g.fillStyle = '#111'; g.fillRect(0, 0, W, H); g.fillStyle = '#eee'; g.save(); g.translate(W / 2, H / 2); g.rotate(-.35); g.fillRect(-W, -40 * U + Math.sin(t) * 10 * U, W * 2, 18 * U); g.fillRect(-W, 60 * U, W * 2, 6 * U); g.restore(); },
      head: F.bebas, body: F.bebas, ink: '#f2f2f2', acc: '#ffffff', filt: 'grayscale(1) contrast(1.6) brightness(1.05)', trans: 'whip', draw: 'rubberhose', scene: 'city',
      frame: (im, b, z, fx, fy, lt) => { const g = G(); g.save(); g.beginPath(); g.moveTo(b.x + b.w * .08, b.y); g.lineTo(b.x + b.w, b.y); g.lineTo(b.x + b.w * .92, b.y + b.h); g.lineTo(b.x, b.y + b.h); g.closePath(); g.clip(); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'grayscale(1) contrast(1.6)'); g.restore(); },
      post: t => { grain(t, .2, 'overlay'); vignette(.6); }, cap: [F.bebas, 70, '#f2f2f2', '#ffffff', 'rgba(0,0,0,.78)'] },
    kino: {
      outline: '#efe6d2',
      bg: t => { const g = G(); g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H); g.save(); g.translate(W * .5, H * .5); g.rotate(-.5); g.fillStyle = '#d0021b'; g.fillRect(-W, -H * .18, W * 2, H * .2); g.fillStyle = '#111'; g.fillRect(-W, H * .1, W * 2, H * .06); g.restore(); },
      head: F.anton, body: F.anton, ink: '#111111', acc: '#d0021b', filt: 'grayscale(1) contrast(1.5)', trans: 'whip', draw: 'rubberhose',
      frame: (im, b, z, fx, fy) => { const g = G(); g.save(); g.beginPath(); g.moveTo(b.x, b.y + b.h * .12); g.lineTo(b.x + b.w, b.y); g.lineTo(b.x + b.w, b.y + b.h * .88); g.lineTo(b.x, b.y + b.h); g.closePath(); g.clip(); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'grayscale(1) contrast(1.5)'); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(208,2,27,.35)'; g.fillRect(b.x, b.y, b.w * .4, b.h); g.restore(); },
      post: t => grain(t, .08), cap: [F.anton, 66, '#efe6d2', '#d0021b', 'rgba(17,17,17,.9)'] },
    datap: {
      bg: t => { const g = G(); g.drawImage(once('wood', (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e9dcc4'); gr.addColorStop(1, '#cdb48c'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(120,80,40,.12)'; for (let y = 0; y < h; y += 7) { c.beginPath(); c.moveTo(0, y + Math.sin(y) * 3); c.bezierCurveTo(w * .3, y + 6, w * .6, y - 6, w, y); c.stroke(); } }), 0, 0); vignette(.35); },
      head: F.inter, body: F.inter, ink: '#2b2118', acc: '#ff6b35', filt: 'contrast(1.05) saturate(.95)', trans: 'zoom', draw: 'paper',
      frame: (im, b, z, fx, fy) => { shadowBox(b.x, b.y, b.w, b.h, '#fff', 14, 30); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'contrast(1.05) saturate(.95)'); },
      post: t => {}, cap: [F.inter, 54, '#2b2118', '#ff6b35', 'rgba(255,250,240,.92)'] },
    papercut: {
      outline: '#6e080e',
      bg: t => { const g = G(); g.drawImage(once('pcut', (c, w, h) => { c.fillStyle = '#a3101a'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,200,120,.07)'; for (let i = 0; i < 40; i++) { const x = hash(i) * w, y = hash(i + 3) * h, r = 40 + hash(i + 7) * 160; c.beginPath(); for (let a = 0; a < 6.3; a += .5) c.lineTo(x + Math.cos(a) * r * (a % 1 > .5 ? 1 : .55), y + Math.sin(a) * r * (a % 1 > .5 ? 1 : .55)); c.fill(); } c.strokeStyle = '#e9b44c'; c.lineWidth = 8; c.strokeRect(24, 24, w - 48, h - 48); c.lineWidth = 2; c.strokeRect(40, 40, w - 80, h - 80); }), 0, 0); },
      head: F.corm, body: F.corm, ink: '#fff3e0', acc: '#e9b44c', filt: 'sepia(.4) saturate(1.2) contrast(1.1)', trans: 'tear', draw: 'paper', scene: 'palace',
      frame: (im, b, z, fx, fy) => { const g = G(); shadowBox(b.x, b.y, b.w, b.h, '#e9b44c', 12, 24); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'sepia(.4) saturate(1.2) contrast(1.1)'); },
      post: t => grain(t, .05), cap: [F.corm, 60, '#fff3e0', '#e9b44c', 'rgba(110,8,14,.85)'] },
    shadow: {
      bg: t => { const g = G(); const gr = g.createRadialGradient(W / 2, H * .45, 0, W / 2, H / 2, Math.max(W, H) * .7); gr.addColorStop(0, '#ffcf7a'); gr.addColorStop(.6, '#e88a2c'); gr.addColorStop(1, '#5a2a08'); g.fillStyle = gr; g.fillRect(0, 0, W, H); const fl = .9 + .1 * Math.sin(t * 13) * Math.sin(t * 7); g.fillStyle = `rgba(0,0,0,${.12 * (1 - fl)})`; g.fillRect(0, 0, W, H); },
      head: F.fell, body: F.fell, ink: '#1a0d04', acc: '#1a0d04', filt: 'grayscale(1) sepia(1) contrast(1.3) brightness(.8)', trans: 'iris', draw: 'shadow', scene: 'blank',
      frame: (im, b, z, fx, fy) => { const g = G(); g.save(); g.globalCompositeOperation = 'multiply'; cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'grayscale(1) sepia(1) contrast(1.4) brightness(.85)'); g.restore(); },
      post: t => vignette(.7, .3), cap: [F.fell, 60, '#fff1d6', '#ffffff', 'rgba(26,13,4,.8)'] },
    teardown: {
      bg: t => { const g = G(); g.fillStyle = '#1d2024'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(255,138,0,.10)'; g.lineWidth = 1; for (let x = 0; x < W; x += 40 * U) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 40 * U) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } },
      head: F.mono, body: F.mono, ink: '#f4f4f4', acc: '#ff8a00', filt: 'grayscale(.4) contrast(1.2)', trans: 'slide', draw: 'cartoon', scene: 'blank',
      frame: (im, b, z, fx, fy, lt) => { const g = G(); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'grayscale(.4) contrast(1.2)'); g.strokeStyle = '#ff8a00'; g.lineWidth = 2 * U; g.setLineDash([10 * U, 8 * U]); g.strokeRect(b.x - 18 * U, b.y - 18 * U, b.w + 36 * U, b.h + 36 * U); g.setLineDash([]); for (const [cx, cy] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) { g.beginPath(); g.arc(cx, cy, 8 * U, 0, 6.29); g.fillStyle = '#ff8a00'; g.fill(); } },
      post: t => vignette(.4), cap: [F.mono, 46, '#f4f4f4', '#ff8a00', 'rgba(29,32,36,.9)'] },
    whitemodel: {
      bg: t => { const g = G(); const gr = g.createRadialGradient(W / 2, H * .4, 0, W / 2, H / 2, Math.max(W, H) * .8); gr.addColorStop(0, '#fbfbfa'); gr.addColorStop(1, '#d4d4d0'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.ellipse(W / 2, H * .82, W * .4, H * .05, 0, 0, 6.29); g.fill(); },
      head: F.inter, body: F.inter, ink: '#2a2a2a', acc: '#ff5a36', filt: 'grayscale(1) contrast(.95) brightness(1.12)', trans: 'zoom', draw: 'clay', scene: 'blank',
      frame: (im, b, z, fx, fy) => { shadowBox(b.x, b.y, b.w, b.h, '#f6f6f4', 20, 40); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'grayscale(1) contrast(.95) brightness(1.12)'); },
      post: t => {}, cap: [F.inter, 54, '#2a2a2a', '#ff5a36', 'rgba(255,255,255,.9)'] },
    sketch: {
      bg: t => { const g = G(); g.drawImage(once('sk', (c, w, h) => { c.fillStyle = '#f6f1e4'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(60,60,80,.06)'; for (let i = 0; i < 400; i++) { const x = hash(i) * w, y = hash(i + 1) * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y - 18); c.stroke(); } c.fillStyle = 'rgba(120,170,210,.12)'; c.beginPath(); c.ellipse(w * .7, h * .3, w * .3, h * .2, .3, 0, 6.29); c.fill(); c.fillStyle = 'rgba(230,160,110,.10)'; c.beginPath(); c.ellipse(w * .25, h * .7, w * .3, h * .2, -.2, 0, 6.29); c.fill(); }), 0, 0); },
      head: F.chalk, body: F.chalk, ink: '#2b2b3a', acc: '#d1495b', filt: 'grayscale(1) contrast(1.5) brightness(1.1)', trans: 'slide', draw: 'whiteboard', scene: 'blank',
      frame: (im, b, z, fx, fy) => { const g = G(); g.save(); g.globalCompositeOperation = 'multiply'; cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'grayscale(1) contrast(1.6) brightness(1.15)'); g.restore(); g.strokeStyle = '#2b2b3a'; g.lineWidth = 2.5 * U; g.beginPath(); g.moveTo(b.x - 10 * U, b.y + 4 * U); g.lineTo(b.x + b.w + 12 * U, b.y - 3 * U); g.lineTo(b.x + b.w + 4 * U, b.y + b.h + 8 * U); g.lineTo(b.x - 6 * U, b.y + b.h); g.closePath(); g.stroke(); },
      post: t => {}, cap: [F.chalk, 66, '#2b2b3a', '#d1495b', 'rgba(246,241,228,.92)'] },
    deco: {
      outline: '#0e0e10',
      bg: t => { const g = G(); g.fillStyle = '#0e0e10'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(212,175,55,.35)'; g.lineWidth = 2 * U; for (let k = 0; k < 24; k++) { const a = Math.PI + k / 23 * Math.PI; g.beginPath(); g.moveTo(W / 2, H * 1.05); g.lineTo(W / 2 + Math.cos(a) * W, H * 1.05 + Math.sin(a) * W); g.stroke(); } g.strokeStyle = '#d4af37'; g.lineWidth = 3 * U; g.strokeRect(30 * U, 30 * U, W - 60 * U, H - 60 * U); g.lineWidth = 1.5 * U; g.strokeRect(44 * U, 44 * U, W - 88 * U, H - 88 * U); },
      head: F.bebas, body: F.bebas, ink: '#f3e7c4', acc: '#d4af37', filt: 'grayscale(.7) sepia(.4) contrast(1.2)', trans: 'iris', draw: 'rubberhose', scene: 'palace',
      frame: (im, b, z, fx, fy) => { const g = G(); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'grayscale(.7) sepia(.4) contrast(1.2)'); g.strokeStyle = '#d4af37'; g.lineWidth = 6 * U; g.strokeRect(b.x - 12 * U, b.y - 12 * U, b.w + 24 * U, b.h + 24 * U); g.lineWidth = 2 * U; g.strokeRect(b.x - 24 * U, b.y - 24 * U, b.w + 48 * U, b.h + 48 * U); },
      post: t => vignette(.4), cap: [F.bebas, 68, '#f3e7c4', '#d4af37', 'rgba(14,14,16,.88)'] },
    ascii: {
      bg: t => { const g = G(); g.fillStyle = '#020a02'; g.fillRect(0, 0, W, H); font(20 * U, F.mono); g.fillStyle = 'rgba(51,255,102,.10)'; for (let y = 30 * U; y < H; y += 26 * U) { let s = ''; for (let k = 0; k < 120; k++) s += '01#*+=-.'[Math.floor(hash(k + y + Math.floor(t * 4)) * 8)]; g.fillText(s, 0, y); } },
      head: F.mono, body: F.mono, ink: '#33ff66', acc: '#b6ffcc', filt: 'grayscale(1) contrast(1.6) sepia(1) hue-rotate(70deg) saturate(3) brightness(.9)', trans: 'glitch', draw: 'cartoon', scene: 'night',
      frame: (im, b, z, fx, fy) => { const g = G(); pixelate(im, b, z, fx, fy, 'grayscale(1) contrast(1.6) sepia(1) hue-rotate(70deg) saturate(3)', 5); g.strokeStyle = '#33ff66'; g.lineWidth = 2 * U; g.strokeRect(b.x, b.y, b.w, b.h); font(22 * U, F.mono, 700); g.fillStyle = '#33ff66'; g.textAlign = 'left'; g.fillText('> LOAD ARCHIVE.IMG', b.x, b.y - 14 * U); },
      post: t => { scan(.25); vignette(.6); }, cap: [F.mono, 46, '#33ff66', '#ffffff', 'rgba(2,10,2,.88)'] },
    scifi: {
      outline: '#120a2a',
      bg: t => { const g = G(); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#120a2a'); gr.addColorStop(1, '#3b0f5c'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; for (let k = 0; k < 90; k++) { g.globalAlpha = .3 + .7 * hash(k + Math.floor(t * 3)); g.fillRect(hash(k) * W, hash(k + 9) * H, 2.5 * U, 2.5 * U); } g.globalAlpha = 1; g.fillStyle = '#ff3df2'; g.beginPath(); g.arc(W * .85, H * .25, 90 * U, 0, 6.29); g.fill(); g.strokeStyle = '#00e5ff'; g.lineWidth = 6 * U; g.beginPath(); g.ellipse(W * .85, H * .25, 150 * U, 30 * U, -.3, 0, 6.29); g.stroke(); },
      head: F.anton, body: F.inter, ink: '#ffffff', acc: '#ff3df2', filt: 'saturate(1.4) contrast(1.15) hue-rotate(-20deg)', trans: 'glitch', draw: 'cartoon', scene: 'night',
      frame: (im, b, z, fx, fy) => { const g = G(); g.save(); rr(b.x, b.y, b.w, b.h, 30 * U); g.clip(); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'saturate(1.4) contrast(1.15) hue-rotate(-20deg)'); g.restore(); g.strokeStyle = '#00e5ff'; g.lineWidth = 6 * U; g.shadowColor = '#00e5ff'; g.shadowBlur = 20 * U; rr(b.x, b.y, b.w, b.h, 30 * U); g.stroke(); g.shadowBlur = 0; },
      post: t => {}, cap: [F.anton, 66, '#ffffff', '#ff3df2', null, '#120a2a'] },
    anime: {
      outline: '#2b1055',
      bg: t => { const g = G(); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2b1055'); gr.addColorStop(.6, '#d5426b'); gr.addColorStop(1, '#ffb347'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.save(); g.translate(W / 2, H / 2); g.strokeStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < 40; k++) { const a = hash(k) * 6.28, r0 = Math.min(W, H) * (.3 + .2 * hash(k + 1)), r1 = Math.max(W, H); g.lineWidth = (1 + hash(k + 2) * 4) * U; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke(); } g.restore(); },
      head: F.anton, body: F.inter, ink: '#ffffff', acc: '#ff2a6d', filt: 'saturate(1.5) contrast(1.2)', trans: 'whip', draw: 'cel', scene: 'city',
      frame: (im, b, z, fx, fy) => { const g = G(); g.save(); g.translate(b.x + b.w / 2, b.y + b.h / 2); g.rotate(-.03); g.fillStyle = '#fff'; g.fillRect(-b.w / 2 - 14 * U, -b.h / 2 - 14 * U, b.w + 28 * U, b.h + 28 * U); cover(im, -b.w / 2, -b.h / 2, b.w, b.h, z, fx, fy, 'saturate(1.5) contrast(1.2)'); g.restore(); },
      post: t => { grain(t, .07); scan(.05); vignette(.3); }, cap: [F.anton, 68, '#ffffff', '#ff2a6d', null, '#2b1055'] },   // broadcast cel-anime texture: film grain + soft scanlines
    desktop: {
      bg: t => { const g = G(); g.fillStyle = '#0f6e6e'; g.fillRect(0, 0, W, H); g.fillStyle = '#c0c0c0'; g.fillRect(0, H - 54 * U, W, 54 * U); g.fillStyle = '#e0e0e0'; g.fillRect(8 * U, H - 46 * U, 150 * U, 38 * U); font(24 * U, F.inter, 900); g.fillStyle = '#111'; g.textAlign = 'left'; g.fillText('▶ Start', 22 * U, H - 19 * U); },
      head: F.inter, body: F.inter, ink: '#111111', acc: '#2f80ff', filt: 'contrast(1.05)', trans: 'zoom', draw: 'cartoon', scene: 'city',
      frame: (im, b, z, fx, fy, lt, s) => { const g = G(); const bar = 46 * U; g.save(); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 20 * U; g.fillStyle = '#c0c0c0'; g.fillRect(b.x - 8 * U, b.y - bar - 8 * U, b.w + 16 * U, b.h + bar + 16 * U); g.restore(); g.fillStyle = '#1f3fa8'; g.fillRect(b.x - 4 * U, b.y - bar - 4 * U, b.w + 8 * U, bar); font(24 * U, F.inter, 700); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(((s && s.label) || 'archive') + '.jpg', b.x + 10 * U, b.y - 16 * U); g.fillStyle = '#c0c0c0'; for (let k = 0; k < 3; k++) g.fillRect(b.x + b.w - (k + 1) * 40 * U, b.y - bar + 4 * U, 32 * U, 30 * U); cover(im, b.x, b.y, b.w, b.h, z, fx, fy, 'contrast(1.05)'); },
      post: t => {}, cap: [F.inter, 52, '#111111', '#2f80ff', 'rgba(255,255,225,.95)'] },
    hd2d: {
      outline: '#1b2a4a',
      bg: t => { const g = G(); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1b2a4a'); gr.addColorStop(1, '#3d6b5a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); for (let k = 0; k < 26; k++) { const x = (hash(k) * W + t * 10 * U * (1 + hash(k + 2))) % W, y = hash(k + 1) * H * .7, r = (20 + hash(k + 3) * 60) * U; const b = g.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, `rgba(255,220,150,${.25 * hash(k + 4)})`); b.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = b; g.fillRect(x - r, y - r, r * 2, r * 2); } },
      head: F.bebas, body: F.inter, ink: '#fff6dc', acc: '#ffcf5a', filt: 'saturate(1.2) contrast(1.1)', trans: 'iris', draw: 'cartoon', scene: 'village',
      frame: (im, b, z, fx, fy) => { const g = G(); pixelate(im, b, z, fx, fy, 'saturate(1.25) contrast(1.1)', 7); g.strokeStyle = '#ffcf5a'; g.lineWidth = 6 * U; g.strokeRect(b.x, b.y, b.w, b.h); },
      post: t => vignette(.45), cap: [F.bebas, 66, '#fff6dc', '#ffcf5a', 'rgba(20,30,50,.85)'] },
  };
};
