// Exam-prep shots (JEE / NEET channels) for engine v2.
//   eq       {tex, label?, box?, hl?: 'red'|'green'|'blue'}           one big formula, written on with a pen
//   steps    {head?, items: [[tex, t], ...]}                           a worked solution, one line at a time
//   quiz     {q, tex?, opts: [..], ans, revealT?}                      question + options, 3-2-1 countdown, answer turns green
//   mistake  {head?, wrong, right, wtex?, rtex?, revealT?}             the common mistake (red) then the right way (green)
//   diagram  {d, label?}                                               a vector diagram from TL.diagrams (free-body, circuit, rays, graph...)
// Formulas are LaTeX turned into crisp SVG by the bundled MathJax (vendor/tex-svg.js), once, before the first frame.
window.makeExam = function (env) {
  const { W, H, U, V, F, TL, clamp, lerp, eOut, eIO, eBack, font, fitText, fitWrap, rr } = env;
  const G = () => env.g;
  const TYPES = new Set(['eq', 'steps', 'quiz', 'mistake', 'diagram', 'react', 'write']);
  const PEEP = {};   // close-up faces (Open Peeps SVG, written by the build into img/)
  const shots = TL.shots.filter(s => TYPES.has(s.type));

  // ---------- skins ----------
  function skin(st) {
    if (st === 'chalk') return { ink: '#f3f1e7', acc: '#ffd166', red: '#ff7b72', green: '#8ee88f', blue: '#86c9ff', card: null, body: F.chalk || F.inter, head: F.chalk || F.anton };
    if (st === 'whiteboard') return { ink: '#1c1c1f', acc: '#e4573d', red: '#d93025', green: '#188038', blue: '#1a64d6', card: null, body: F.chalk || F.inter, head: F.chalk || F.anton };
    return { ink: '#f5f6f8', acc: '#ffd400', red: '#ff4d4d', green: '#35d07f', blue: '#4fb3ff', card: 'rgba(10,12,18,.9)', body: F.inter, head: F.anton };
  }
  const colorOf = (sk, k) => ({ red: sk.red, green: sk.green, blue: sk.blue, acc: sk.acc })[k] || sk.ink;

  // ---------- LaTeX -> image ----------
  const EQ = {}, DG = {};
  const key = (tex, col) => col + '|' + tex;
  async function texImg(tex, col) {
    const k = key(tex, col); if (EQ[k]) return;
    try {
      const node = window.MathJax.tex2svg(String(tex), { display: true }), svg = node.querySelector('svg');
      const ex = 26, w = parseFloat(svg.getAttribute('width')) * ex, h = parseFloat(svg.getAttribute('height')) * ex;
      svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const src = new XMLSerializer().serializeToString(svg).split('currentColor').join(col);
      const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); await im.decode();
      EQ[k] = { im, w, h };
    } catch (e) { EQ[k] = { text: String(tex) }; }
  }
  // diagram svg uses colour tokens INK RED GREEN BLUE ACC, replaced by the shot's skin
  async function dgImg(id, sk) {
    const k = id + '|' + sk.ink; if (DG[k]) return; const d = (TL.diagrams || []).find(x => x.id === id); if (!d) return;
    let s = String(d.svg).replace(/\bINK\b/g, sk.ink).replace(/\bRED\b/g, sk.red).replace(/\bGREEN\b/g, sk.green).replace(/\bBLUE\b/g, sk.blue).replace(/\bACC\b/g, sk.acc);
    if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s), vw = vb ? +vb[1] : 800, vh = vb ? +vb[2] : 500;
    s = s.replace(/<svg([^>]*?)\swidth\s*=\s*["'][^"']*["']/, '<svg$1').replace(/<svg([^>]*?)\sheight\s*=\s*["'][^"']*["']/, '<svg$1').replace('<svg', `<svg width="${vw * 2}" height="${vh * 2}"`);
    // build-up animation: one cumulative image per top-level element (incline, block, then each force arrow...)
    const layers = [];
    try {
      const doc = new DOMParser().parseFromString(s, 'image/svg+xml'), root = doc.documentElement;
      const kids = [...root.children].filter(c => c.tagName !== 'defs'), defs = [...root.children].filter(c => c.tagName === 'defs');
      const per = Math.max(1, Math.ceil(kids.length / 10));
      for (let n = per; n < kids.length + per; n += per) {
        const r2 = root.cloneNode(false); defs.forEach(x => r2.appendChild(x.cloneNode(true))); kids.slice(0, Math.min(n, kids.length)).forEach(x => r2.appendChild(x.cloneNode(true)));
        const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(r2)); await im.decode(); layers.push(im);
      }
    } catch (e) { layers.length = 0; }
    const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    try { await im.decode(); DG[k] = { im, layers: layers.length > 1 ? layers : null, w: vw * 2, h: vh * 2 }; } catch (e) { DG[k] = null; }
  }
  const ready = (async () => {
    if (!shots.length) return;
    const jobs = [];
    if (window.MathJax && window.MathJax.startup) { await window.MathJax.startup.promise;
      for (const s of shots) { const sk = skin(s.style);
        if (s.type === 'eq' && s.tex) jobs.push(texImg(s.tex, colorOf(sk, s.hl)));
        if (s.type === 'steps') for (const [tx] of s.items || []) jobs.push(texImg(tx, sk.ink));
        if (s.type === 'quiz' && s.tex) jobs.push(texImg(s.tex, sk.ink));
        if (s.type === 'mistake') { if (s.wtex) jobs.push(texImg(s.wtex, sk.red)); if (s.rtex) jobs.push(texImg(s.rtex, sk.green)); }
        if (s.type === 'write') for (const e of s.els || []) if (e.k === 'tex' && e.tex) jobs.push(texImg(e.tex, colorOf(sk, e.col)));
      } }
    for (const s of shots) if (s.type === 'diagram') jobs.push(dgImg(s.d, skin(s.style)));
    for (const s of shots) if (s.type === 'write') for (const e of s.els || []) if (e.k === 'dg' && e.d) jobs.push(dgImg(e.d, skin(s.style)));
    for (const s of shots) if (s.type === 'react' && s.peep && !PEEP[s.peep]) { const im = new Image(); PEEP[s.peep] = im; im.src = s.peep; jobs.push(im.decode().catch(() => { PEEP[s.peep] = null; })); }
    await Promise.all(jobs);
  })();

  // ---------- layout helpers ----------
  const box = () => V ? { x: W * .06, y: H * .12, w: W * .88, h: H * .54 } : { x: W * .07, y: H * .09, w: W * .86, h: H * .7 };
  function frame(st, s, lt) {
    const g = G(), sk = skin(st), B = box(); env.SK[st].bg(s.t + lt);
    if (sk.card) { g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40 * U; g.fillStyle = sk.card; rr(B.x - 24 * U, B.y - 24 * U, B.w + 48 * U, B.h + 48 * U, 28 * U); g.fill(); g.restore(); }
    return { g, sk, B };
  }
  // draw an equation image (or plain text fallback) fitted in a box, revealed left-to-right by p with a pen dot
  function drawTex(tex, col, cx, cy, maxW, maxH, p = 1, maxScale = 2.4) {
    const g = G(), e = EQ[key(tex, col)];
    if (!e || !e.im) { const sz = fitText(String(tex), F.mono, 700, maxH * .6, maxW); font(sz, F.mono, 700); g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.beginPath(); g.rect(cx - maxW / 2, cy - maxH / 2, maxW * p, maxH); g.clip(); g.fillText(String(tex), cx, cy); g.restore(); g.textBaseline = 'alphabetic'; return { w: maxW, h: maxH * .6 }; }
    const sc = Math.min(maxW / e.w, maxH / e.h, maxScale * U), w = e.w * sc, h = e.h * sc, x = cx - w / 2, y = cy - h / 2;
    g.save(); g.beginPath(); g.rect(x - 4, y - 8, (w + 8) * clamp(p), h + 16); g.clip(); g.drawImage(e.im, x, y, w, h); g.restore();
    if (p > 0 && p < 1) { g.fillStyle = col; g.globalAlpha = .9; g.beginPath(); g.arc(x + w * p, y + h * .5 + Math.sin(p * 40) * h * .25, 7 * U, 0, 7); g.fill(); g.globalAlpha = 1; }
    return { w, h, x, y };
  }
  function label(txt, sk, x, y, maxW, size = 46, col) { const g = G(); const sz = fitText(String(txt).toUpperCase(), sk.head, 400, size * U, maxW); font(sz, sk.head); g.fillStyle = col || sk.acc; g.textAlign = 'center'; g.fillText(String(txt).toUpperCase(), x, y); return sz; }
  function tick(x, y, r, col, p) { const g = G(); g.strokeStyle = col; g.lineWidth = r * .28; g.lineCap = 'round'; g.lineJoin = 'round'; const a = [x - r * .55, y], b = [x - r * .15, y + r * .45], c = [x + r * .6, y - r * .45]; g.beginPath(); g.moveTo(...a); if (p < .4) g.lineTo(lerp(a[0], b[0], p / .4), lerp(a[1], b[1], p / .4)); else { g.lineTo(...b); const q = (p - .4) / .6; g.lineTo(lerp(b[0], c[0], q), lerp(b[1], c[1], q)); } g.stroke(); }
  function cross(x, y, r, col, p) { const g = G(); g.strokeStyle = col; g.lineWidth = r * .28; g.lineCap = 'round'; const q1 = clamp(p * 2), q2 = clamp(p * 2 - 1); g.beginPath(); g.moveTo(x - r * .5, y - r * .5); g.lineTo(x - r * .5 + r * q1, y - r * .5 + r * q1); if (q2 > 0) { g.moveTo(x + r * .5, y - r * .5); g.lineTo(x + r * .5 - r * q2, y - r * .5 + r * q2); } g.stroke(); }

  // ---------- shots ----------
  const D = {};
  D.eq = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt); let top = B.y;
    if (s.label) { label(s.label, sk, W / 2, B.y + 50 * U, B.w * .9); top += 80 * U; }
    const col = colorOf(sk, s.hl), p = eOut((lt - .15) / Math.min(1.1, d * .45));
    const r = drawTex(s.tex, col, W / 2, (top + B.y + B.h) / 2, B.w * .92, (B.y + B.h - top) * .8, p, V ? 2.6 : 2.4);
    if (s.box && r.x != null) { const q = eOut((lt - 1.25) / .5); if (q > 0) { g.strokeStyle = sk.acc; g.lineWidth = 6 * U; const pad = 26 * U; rr(r.x - pad, r.y - pad, (r.w + pad * 2), r.h + pad * 2, 18 * U); g.setLineDash([(r.w + r.h) * 2.4 * q + 1, 99999]); g.stroke(); g.setLineDash([]); } }
  };
  D.steps = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), now = s.t + lt, its = s.items || []; let top = B.y + 10 * U;
    if (s.head) { label(s.head, sk, W / 2, B.y + 46 * U, B.w * .9, 44); top += 76 * U; }
    const n = Math.max(1, its.length), rowH = Math.min((B.y + B.h - top) / n, V ? 230 * U : 200 * U);
    its.forEach(([tx, t0], k) => {
      const lt2 = now - (t0 ?? s.t), p = eOut(lt2 / .7); if (lt2 < 0) return;
      const cy = top + rowH * (k + .5), cur = k === its.filter(([, t]) => (t ?? s.t) <= now).length - 1;
      g.globalAlpha = cur ? 1 : .55;
      g.fillStyle = sk.acc; g.beginPath(); g.arc(B.x + 34 * U, cy, 24 * U * eBack(clamp(lt2 / .35)), 0, 7); g.fill();
      font(28 * U, F.inter, 900); g.fillStyle = sk.card ? '#111' : (st === 'chalk' ? '#163a2a' : '#fff'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(k + 1), B.x + 34 * U, cy + 1); g.textBaseline = 'alphabetic';
      drawTex(tx, sk.ink, B.x + 80 * U + (B.w - 80 * U) / 2, cy, B.w - 100 * U, rowH * .78, p, 1.8);
      g.globalAlpha = 1;
    });
  };
  D.quiz = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), now = s.t + lt, R = s.revealT ?? (s.t + d * .62), opts = (s.opts || []).slice(0, 4);
    // question
    const QW = fitWrap(s.q || '', sk.body, 800, (V ? 58 : 54) * U, B.w * .9, 3), qs = QW.size, lines = QW.lines.slice(0, 3); font(qs, sk.body, 800);
    g.fillStyle = sk.ink; g.textAlign = 'center'; const qa = eOut(lt / .4); g.globalAlpha = qa;
    lines.forEach((l, k) => g.fillText(l, W / 2, B.y + qs * (1.1 + k * 1.2)));
    g.globalAlpha = 1; let y = B.y + qs * (1.4 + lines.length * 1.2);
    if (s.tex) { const r = drawTex(s.tex, sk.ink, W / 2, y + 60 * U, B.w * .8, 120 * U, eOut((lt - .3) / .6), 1.6); y += (r.h || 100 * U) + 40 * U; }
    // options
    const cols = V ? 1 : 2, rows = Math.ceil(opts.length / cols), gap = 18 * U, ow = (B.w - gap * (cols - 1)) / cols, oh = Math.min((B.y + B.h - y - gap * (rows - 1)) / rows, 110 * U);
    opts.forEach((o, k) => {
      const cx = B.x + (k % cols) * (ow + gap), cy = y + Math.floor(k / cols) * (oh + gap), a = eBack(clamp((lt - .5 - k * .18) / .35)); if (a <= 0) return;
      const rev = now >= R, ok = k === s.ans, rp = eOut((now - R) / .35);
      g.save(); g.translate(cx + ow / 2, cy + oh / 2); const z = rev && ok ? 1 + .06 * Math.sin(clamp(rp) * Math.PI) : 1; g.scale(a * z, a * z); g.translate(-ow / 2, -oh / 2);
      g.globalAlpha = rev && !ok ? 1 - .55 * rp : 1;
      g.fillStyle = rev && ok ? sk.green : (sk.card ? 'rgba(255,255,255,.08)' : (st === 'chalk' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'));
      rr(0, 0, ow, oh, 16 * U); g.fill(); g.strokeStyle = rev && ok ? sk.green : sk.ink; g.globalAlpha *= .9; g.lineWidth = 3 * U; g.stroke(); g.globalAlpha = rev && !ok ? 1 - .55 * rp : 1;
      g.fillStyle = sk.acc; g.beginPath(); g.arc(oh * .5, oh * .5, oh * .3, 0, 7); g.fill();
      font(oh * .32, F.inter, 900); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], oh * .5, oh * .52);
      const ts = fitText(String(o), sk.body, 700, oh * .42, ow - oh * 1.5); font(ts, sk.body, 700); g.fillStyle = rev && ok ? '#0b1a10' : sk.ink; g.textAlign = 'left'; g.fillText(String(o), oh * 1.0, oh * .53); g.textBaseline = 'alphabetic';
      if (rev) { if (ok) tick(ow - oh * .5, oh * .5, oh * .34, '#0b1a10', clamp(rp * 1.4)); else cross(ow - oh * .5, oh * .5, oh * .3, sk.red, clamp(rp * 1.4)); }
      g.restore(); g.globalAlpha = 1;
    });
    // countdown ring before the reveal
    const left = R - now; if (left > 0 && left <= 3.2 && lt > .8) { const rx = B.x + B.w - 40 * U, ry = B.y - 4 * U, rad = 46 * U; g.fillStyle = sk.card ? '#000' : sk.acc; g.beginPath(); g.arc(rx, ry, rad, 0, 7); g.fill(); g.strokeStyle = sk.red; g.lineWidth = 9 * U; g.beginPath(); g.arc(rx, ry, rad - 5 * U, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left % 1 || 1)); g.stroke(); font(48 * U, F.anton); g.fillStyle = sk.card ? '#fff' : '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(Math.ceil(left)), rx, ry + 2); g.textBaseline = 'alphabetic'; }
  };
  D.mistake = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), now = s.t + lt, R = s.revealT ?? (s.t + d * .45); let top = B.y;
    if (s.head) { label(s.head, sk, W / 2, B.y + 46 * U, B.w * .9, 44, sk.red); top += 74 * U; }
    const hh = (B.y + B.h - top - 24 * U) / 2;
    const panel = (y, txt, tex, col, isRight, p) => {
      if (p <= 0) return; g.save(); g.globalAlpha = clamp(p * 1.5); g.translate(0, (1 - p) * 30 * U);
      g.strokeStyle = col; g.lineWidth = 5 * U; g.fillStyle = sk.card ? 'rgba(255,255,255,.05)' : 'rgba(127,127,127,.08)'; rr(B.x, y, B.w, hh, 20 * U); g.fill(); g.stroke();
      const ic = Math.min(hh * .28, 60 * U); g.fillStyle = col; g.beginPath(); g.arc(B.x + ic * 1.4, y + hh / 2, ic, 0, 7); g.fill();
      (isRight ? tick : cross)(B.x + ic * 1.4, y + hh / 2, ic * .9, sk.card ? '#111' : '#fff', clamp(p * 1.6));
      font(26 * U, F.inter, 900); g.fillStyle = col; g.textAlign = 'left'; g.fillText(isRight ? 'RIGHT' : 'WRONG', B.x + ic * 2.8, y + 40 * U);
      const tx0 = B.x + ic * 2.8, tw = B.w - ic * 2.8 - 24 * U;
      if (tex) drawTex(tex, col, tx0 + tw / 2, y + hh * .58, tw, hh * .62, clamp(p * 1.3), 1.7);
      else { const TW = fitWrap(String(txt || ''), sk.body, 700, (V ? 50 : 46) * U, tw, 3), sz = TW.size, L = TW.lines; font(sz, sk.body, 700); g.fillStyle = sk.ink; const y0 = y + hh * .55 - (L.length - 1) * sz * .6; L.slice(0, 3).forEach((l, k) => g.fillText(l, tx0, y0 + k * sz * 1.2)); }
      if (!isRight && now > R) { const q = eOut((now - R) / .4); g.strokeStyle = sk.red; g.lineWidth = 6 * U; g.beginPath(); g.moveTo(tx0, y + hh * .55); g.lineTo(tx0 + tw * q, y + hh * .5); g.stroke(); }
      g.restore();
    };
    panel(top, s.wrong, s.wtex, sk.red, false, eOut(lt / .45));
    panel(top + hh + 24 * U, s.right, s.rtex, sk.green, true, eOut((now - R) / .45));
  };
  D.diagram = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), e = DG[s.d + '|' + sk.ink]; let bottom = B.y + B.h;
    if (s.label) { label(s.label, sk, W / 2, B.y + B.h - 10 * U, B.w * .9, 42); bottom -= 70 * U; }
    if (!e) { label('DIAGRAM', sk, W / 2, B.y + B.h / 2, B.w); return; }
    const sc = Math.min(B.w / e.w, (bottom - B.y) / e.h), w = e.w * sc, h = e.h * sc, z = 1 + .035 * clamp(lt / Math.max(d, 1)), x = W / 2 - w * z / 2, y = (B.y + bottom) / 2 - h * z / 2, p = eOut((lt - .1) / Math.min(1.3, d * .5));
    if (e.layers) {   // build it up piece by piece across the shot, each new piece popping in
      const n = e.layers.length, span = Math.max(1.2, Math.min(d * .75, n * .7)), q = clamp((lt - .1) / span) * n, k = Math.min(n - 1, Math.floor(q)), f = eOut(q - k);
      if (k > 0) g.drawImage(e.layers[k - 1], x, y, w * z, h * z);
      g.save(); g.globalAlpha = k === n - 1 && q >= n ? 1 : f; const sc = 1 + .04 * (1 - f); g.translate(W / 2, (B.y + bottom) / 2); g.scale(sc, sc); g.translate(-W / 2, -(B.y + bottom) / 2); g.drawImage(e.layers[k], x, y, w * z, h * z); g.restore();
    } else { g.save(); g.beginPath(); g.rect(x - 10, y - 10, (w * z + 20) * p, h * z + 20); g.clip(); g.drawImage(e.im, x, y, w * z, h * z); g.restore(); }
  };
  // react: an anime-style close-up reaction. Big face bursts in over radial speed lines, the reaction words slam on.
  D.react = (st, s, lt, d) => {
    const g = G(), sk = skin(st); env.SK[st].bg(s.t + lt);
    const cx = W * (s.side === 'left' ? .38 : s.side === 'right' ? .62 : .5), cy = H * (V ? .4 : .48), burst = eOut(lt / .25);
    // radial burst
    g.save(); g.translate(cx, cy); g.rotate(lt * .15);
    for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; g.fillStyle = k % 2 ? 'rgba(255,255,255,.10)' : (sk.card ? 'rgba(255,212,0,.16)' : 'rgba(0,0,0,.06)'); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, Math.max(W, H) * burst, a, a + Math.PI / 28); g.closePath(); g.fill(); }
    g.restore();
    const im = PEEP[s.peep], sz = Math.min(W * .92, H * (V ? .5 : .78)), pop = eBack(clamp((lt - .05) / .35)), shake = ['shock', 'scared', 'angry', 'panic'].includes(s.emotion) && lt < .6 ? Math.sin(lt * 70) * 10 * U * (1 - lt / .6) : 0;
    if (im) { g.save(); g.translate(cx + shake, cy + (1 - pop) * 60 * U); g.scale(pop, pop); g.fillStyle = sk.card ? '#fff6e8' : 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(0, 0, sz * .46, 0, 7); g.fill(); g.lineWidth = 8 * U; g.strokeStyle = sk.acc; g.stroke(); g.save(); g.beginPath(); g.arc(0, 0, sz * .46, 0, 7); g.clip(); g.drawImage(im, -sz / 2, -sz * .42, sz, sz); g.restore(); g.restore(); }
    if (s.text) { const p = eBack(clamp((lt - .25) / .3)), ty = V ? H * .12 : H * .14; g.save(); g.translate(W / 2, ty + 40 * U); g.scale(p, p); g.rotate(-.05); const fs2 = fitText(String(s.text).toUpperCase(), F.anton, 400, (V ? 150 : 130) * U, W * .86); font(fs2, F.anton); g.textAlign = 'center'; g.lineWidth = 14 * U; g.strokeStyle = '#120a24'; g.strokeText(String(s.text).toUpperCase(), 0, 0); g.fillStyle = sk.acc; g.fillText(String(s.text).toUpperCase(), 0, 0); g.restore(); }
  };
  // ---------- write: a real teacher's board ----------
  // Consecutive "write" shots share one board page; each element (heading, note, formula, diagram) is written by a hand
  // with a marker (whiteboard) or chalk (chalkboard) on the word it is spoken. A full page is wiped and writing continues.
  const PAGES = []; {
    let cur = null;
    for (const s of TL.shots) {
      if (s.type !== 'write') continue;
      if (!cur || s.new || cur.style !== s.style || cur.ch !== s.ch) { cur = { style: s.style, ch: s.ch, items: [], boards: null }; PAGES.push(cur); }
      s._pg = cur; let k = 0;
      for (const e of s.els || []) { const t = e.t != null ? Math.max(e.t, s.t) : s.t + .25 + k * .9; k++; cur.items.push({ ...e, t }); }
    }
    for (const P of PAGES) P.items.sort((a, b) => a.t - b.t);
  }
  const BOARDTOP = () => H * (V ? .1 : .085), BOARDBOT = () => H * (V ? .66 : .8);
  function layoutPage(P, sk) {
    if (P.boards) return P.boards;
    const g = G(), hasDg = !V && P.items.some(e => e.k === 'dg'), x0 = W * (V ? .07 : .06), colW = (hasDg ? W * .5 : W * .86) - (V ? 0 : 0), top = BOARDTOP(), bot = BOARDBOT();
    const boards = []; let b = null, y = 0, dgs = 0;
    const newBoard = it => { b = { t: it.t, items: [], dgs: [] }; boards.push(b); y = top; };
    for (const it of P.items) {
      if (!b) newBoard(it);
      const o = { ...it };
      if (it.k === 'dg' && !V) { if (b.dgs.length >= 2) newBoard(it); b.dgs.push(o); b.items.push(o); o.dur = 2.6; continue; }
      if (it.k === 'h') { const sz = fitText(String(it.text || '').replace(/->/g, '→'), sk.head, 700, (V ? 84 : 80) * U, colW); o.size = sz; o.lines = [String(it.text || '').replace(/->/g, '→')]; o.h = sz * 1.45; }
      else if (it.k === 'tex') { const e = EQ[key(it.tex, colorOf(sk, it.col))]; const mh = (V ? 150 : 150) * U; if (e && e.im) { const sc = Math.min(colW * .96 / e.w, mh / e.h, (V ? 2.4 : 2.4) * U); o.w = e.w * sc; o.hh = e.h * sc; } else { o.w = colW * .8; o.hh = mh * .7; } o.h = o.hh + (it.box ? 46 : 26) * U; }
      else if (it.k === 'dg') { o.w = colW; o.hh = H * .24; o.h = o.hh + 20 * U; o.dur = 2.4; }
      else { const R = fitWrap(String(it.text || '').replace(/->/g, '→'), sk.body, 600, (V ? 68 : 64) * U, colW - 60 * U, 2); o.size = R.size; o.lines = R.lines.slice(0, 2); o.h = R.size * 1.18 * o.lines.length + 14 * U; }
      if (y + o.h > bot && b.items.some(x => x.k !== 'dg' || V)) newBoard(it);
      o.x = x0 + (it.k === 't' ? 34 * U : 0); o.y = y; y += o.h;
      if (o.dur == null) o.dur = it.k === 'tex' ? 1.3 : clamp(String((o.lines || []).join(' ')).length * .045, .55, 1.8);
      b.items.push(o);
    }
    // diagrams fill the right half, one or two stacked
    for (const B of boards) B.dgs.forEach((o, k) => { const n = B.dgs.length, h = (bot - top) / n; o.x = W * .57; o.y = top + h * k; o.w = W * .38; o.hh = h - 20 * U; });
    for (const B of boards) for (const o of B.items) o.end = o.t + o.dur;
    return (P.boards = boards);
  }
  // pen-tip position of an item at progress p
  function tipOf(o, p, sk) {
    const g = G();
    if (o.k === 'tex') return [o.x + o.w * p, o.y + o.hh * (.5 + .25 * Math.sin(p * 30))];
    if (o.k === 'dg') { const e = DG[o.d + '|' + sk.ink]; const sc = e ? Math.min(o.w / e.w, o.hh / e.h) : 1, w = e ? e.w * sc : o.w, h = e ? e.h * sc : o.hh; const a = p * 9.3; return [o.x + (o.w - w) / 2 + w * (.5 + .38 * Math.sin(a)), o.y + (o.hh - h) / 2 + h * (.5 + .34 * Math.sin(a * 1.7 + 1))]; }
    const L = o.lines || [''], n = L.length, li = Math.min(n - 1, Math.floor(p * n)), q = p * n - li; font(o.size, o.k === 'h' ? sk.head : sk.body, o.k === 'h' ? 700 : 600); const w = g.measureText(L[li]).width;
    return [o.x + w * clamp(q), o.y + o.size * (1.0 + li * 1.18) - o.size * .25];
  }
  function drawItem(o, now, sk, st) {
    const g = G(), p = clamp((now - o.t) / o.dur); if (now < o.t) return;
    const col = colorOf(sk, o.col || (o.k === 'h' ? 'acc' : null));
    if (o.k === 'h' || o.k === 't') {
      font(o.size, o.k === 'h' ? sk.head : sk.body, o.k === 'h' ? 700 : 600); g.fillStyle = col; g.textAlign = 'left';
      const n = o.lines.length;
      if (o.k === 't') { g.beginPath(); g.arc(o.x - 24 * U, o.y + o.size * .72, 7 * U, 0, 7); g.fill(); }
      o.lines.forEach((l, k) => { const q = clamp(p * n - k); if (q <= 0) return; const w = g.measureText(l).width, by = o.y + o.size * (1.0 + k * 1.18); g.save(); g.beginPath(); g.rect(o.x - 6, by - o.size * 1.1, (w + 12) * q, o.size * 1.5); g.clip(); g.fillText(l, o.x, by); g.restore(); });
      if (o.k === 'h') { const w = g.measureText(o.lines[0]).width, q = clamp((now - o.end) / .35); if (q > 0) { g.strokeStyle = col; g.lineWidth = 4 * U; g.lineCap = 'round'; g.beginPath(); const yy = o.y + o.size * 1.22; g.moveTo(o.x, yy); g.quadraticCurveTo(o.x + w * q / 2, yy + 6 * U, o.x + w * q, yy - 2 * U); g.stroke(); } }
    } else if (o.k === 'tex') {
      drawTex(o.tex, col, o.x + o.w / 2, o.y + o.hh / 2 + (o.box ? 12 * U : 4 * U), o.w + 2, o.hh + 2, p, 99);
    } else if (o.k === 'dg') {
      const e = DG[o.d + '|' + sk.ink]; if (!e) return; const sc = Math.min(o.w / e.w, o.hh / e.h), w = e.w * sc, h = e.h * sc, x = o.x + (o.w - w) / 2, y = o.y + (o.hh - h) / 2;
      if (e.layers) { const n = e.layers.length, q = p * n, k = Math.min(n - 1, Math.floor(q)); if (k > 0) g.drawImage(e.layers[k - 1], x, y, w, h); g.save(); g.globalAlpha = p >= 1 ? 1 : eOut(q - k); g.drawImage(e.layers[k], x, y, w, h); g.restore(); }
      else { g.save(); g.beginPath(); g.rect(x - 10, y - 10, (w + 20) * p, h + 20); g.clip(); g.drawImage(e.im, x, y, w, h); g.restore(); }
    }
    // marks after writing: a hand-drawn box, a tick (right) or a cross + strike (wrong)
    const after = now - o.end; if (after <= 0 || o.k === 'dg') return;
    let w = o.w || 0; if (o.k !== 'tex') { font(o.size, o.k === 'h' ? sk.head : sk.body, 600); w = Math.max(...o.lines.map(l => g.measureText(l).width)); }
    const x0 = o.k === 'tex' ? o.x + (o.w - (EQ[key(o.tex, col)] && EQ[key(o.tex, col)].im ? Math.min(o.w, o.w) : o.w)) / 2 : o.x, hh = o.k === 'tex' ? o.hh : o.h - 14 * U, y0 = o.k === 'tex' ? o.y + (o.box ? 12 * U : 4 * U) : o.y + 6 * U;
    if (o.box) { const q = eOut(after / .45), pad = 16 * U; g.strokeStyle = sk.acc; g.lineWidth = 5 * U; g.lineJoin = 'round'; rr(x0 - pad, y0 - pad * .6, w + pad * 2, hh + pad * 1.2, 10 * U); g.setLineDash([(w + hh) * 2.6 * q + 1, 99999]); g.stroke(); g.setLineDash([]); }
    if (o.ok === false) { const q = eOut(after / .35); g.strokeStyle = sk.red; g.lineWidth = 6 * U; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 - 6 * U, y0 + hh * .55); g.lineTo(x0 - 6 * U + (w + 12 * U) * q, y0 + hh * .45); g.stroke(); cross(x0 + w + 54 * U, y0 + hh / 2, 40 * U, sk.red, clamp(after / .4)); }
    if (o.ok === true) tick(x0 + w + 54 * U, y0 + hh / 2, 44 * U, sk.green, clamp(after / .4));
  }
  // the writing hand: a marker (whiteboard) or a chalk stick (chalkboard) held in a simple 2D hand with a shirt cuff
  function hand(x, y, st, now, writing) {
    const g = G(), chalk = st === 'chalk', wob = writing ? Math.sin(now * 23) * 3 * U : 0;
    g.save(); g.translate(x, y + wob); g.rotate(.62); const s = U * (V ? 1.15 : 1);
    for (const pass of [0, 1]) {
      g.save(); if (!pass) { g.translate(16 * s, 22 * s); g.globalAlpha = chalk ? .28 : .14; } const sh = c => pass ? c : '#000';
      // sleeve + forearm going off screen
      g.fillStyle = sh('#4a6fa8'); g.beginPath(); g.moveTo(30 * s, -100 * s); g.lineTo(170 * s, 360 * s); g.lineTo(330 * s, 360 * s); g.lineTo(125 * s, -128 * s); g.closePath(); g.fill();
      g.fillStyle = sh('#e7eef9'); g.beginPath(); g.moveTo(40 * s, -86 * s); g.lineTo(58 * s, -44 * s); g.lineTo(148 * s, -84 * s); g.lineTo(126 * s, -124 * s); g.closePath(); g.fill();
      // pen / chalk
      if (chalk) { g.fillStyle = sh('#f4f1e6'); rr(-9 * s, -110 * s, 18 * s, 110 * s, 7 * s); g.fill(); }
      else { g.fillStyle = sh('#1d2a44'); g.beginPath(); g.moveTo(0, 0); g.lineTo(-8 * s, -20 * s); g.lineTo(8 * s, -20 * s); g.closePath(); g.fill(); g.fillStyle = sh('#f5f5f2'); rr(-13 * s, -150 * s, 26 * s, 132 * s, 6 * s); g.fill(); g.fillStyle = sh(st === 'whiteboard' ? '#1d2a44' : '#e4573d'); rr(-14 * s, -178 * s, 28 * s, 40 * s, 7 * s); g.fill(); }
      // hand: palm, fingers around the pen, thumb
      g.fillStyle = sh('#e3a982'); g.strokeStyle = sh('#9a6447'); g.lineWidth = 3 * s;
      g.beginPath(); g.ellipse(56 * s, -104 * s, 58 * s, 46 * s, -.35, 0, 7); g.fill(); if (pass) g.stroke();
      for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse((16 + k * 6) * s, (-70 - k * 20) * s, 22 * s, 13 * s, -.2, 0, 7); g.fill(); if (pass) g.stroke(); }
      g.beginPath(); g.ellipse(-10 * s, -100 * s, 12 * s, 28 * s, .5, 0, 7); g.fill(); if (pass) g.stroke();
      g.restore();
    }
    g.restore();
  }
  D.write = (st, s, lt, d) => {
    const g = G(), sk = skin(st), now = s.t + lt, P = s._pg; env.SK[st].bg(now); if (!P) return;
    const boards = layoutPage(P, sk); let bi = 0; while (bi + 1 < boards.length && boards[bi + 1].t <= now) bi++;
    const B = boards[bi], wipe = bi > 0 ? clamp((now - B.t) / .6) : 1;
    if (wipe < 1) { g.save(); g.globalAlpha = 1 - eOut(wipe); boards[bi - 1].items.forEach(o => drawItem(o, now, sk, st)); g.restore(); }
    B.items.forEach(o => drawItem(o, now, sk, st));
    // hand: on the tip while writing, travelling between items, resting off-screen when idle
    const REST = [W * 1.08, H * 1.05], its = B.items, act = its.find(o => now >= o.t && now <= o.end);
    let hp = REST, writing = false;
    if (act) { hp = tipOf(act, clamp((now - act.t) / act.dur), sk); writing = true; }
    else {
      const prev = [...its].reverse().find(o => o.end < now), next = its.find(o => o.t > now);
      const pe = prev ? tipOf(prev, 1, sk) : REST, ns = next ? tipOf(next, 0, sk) : REST;
      if (prev && next && next.t - prev.end < 1.4) hp = [lerp(pe[0], ns[0], eIO((now - prev.end) / (next.t - prev.end))), lerp(pe[1], ns[1], eIO((now - prev.end) / (next.t - prev.end)))];
      else if (prev && now - prev.end < .6) { const q = eIO((now - prev.end) / .6); hp = [lerp(pe[0], REST[0], q), lerp(pe[1], REST[1], q)]; }
      else if (next && next.t - now < .6) { const q = eIO(1 - (next.t - now) / .6); hp = [lerp(REST[0], ns[0], q), lerp(REST[1], ns[1], q)]; }
    }
    if (hp[0] < W * 1.05) hand(hp[0], hp[1], st, now, writing);
  };
  return { has: t => TYPES.has(t), draw: (st, s, lt, d, i) => D[s.type](st, s, lt, d, i), ready, samePage: (a, b) => a && b && a.type === 'write' && b.type === 'write' && a._pg === b._pg };
};
