// AutoTube Studio director for the Lemo Opuscar "whiteboard" theme (styles/whiteboard, Whiteboard Explainer).
// The look, ink, markers, eraser, board, camera and subtitle plate are the LIBRARY'S OWN engine (wb.js, imported unchanged);
// this file only turns an AutoTube Studio timeline (window.TL: chapters, lines, write/quiz/steps/sim shots with spoken-word times)
// into that engine's shapes, pens, erasers and camera keys. No hands: floating markers, as the style requires.
import * as W from '/styles/whiteboard/demo/engine/wb.js';
import { clamp, lerp, mulberry } from '/core/lib.js';

const { INK } = W;
const TL = window.TL;
const WORLD = { W: 11900, H: 6700 };
// board regions ("pages"), each one camera frame at zoom 1; reused after an eraser pass when the board is full

export async function build(opts = {}) {
  // landscape (long videos) or portrait (Shorts). Portrait keeps the library engine untouched: the camera turns the board a
  // quarter turn inside its own 1920x1080 frame and the composer turns the frame back upright, so every pixel stays native.
  const VERT = !!opts.vertical, ROT = VERT ? -Math.PI / 2 : 0, VZ = VERT ? 1.4 : 1, PW = VERT ? 1080 / VZ : 1920, PH = VERT ? 1920 / VZ : 1080;   // portrait: the camera sits closer so phone text is big
  const NC = VERT ? 10 : 6, NR = VERT ? 3 : 6, SX = VERT ? 1140 : 1940, SY = VERT ? 2000 : 1100;
  const CELLS = []; for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) CELLS.push([PW / 2 + 160 + i * SX, PH / 2 + 120 + j * SY]);
  const ORDER = []; for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) ORDER.push(j * NC + (j % 2 ? NC - 1 - i : i));   // snake: the camera travels
  await W.loadFont('tech', 'fonts/hs_tech.json');
  await document.fonts.load('44px AD');
  const tl = new W.Timeline();
  const P = {
    black: new W.Pen('black', INK.black, { park: [2200, 1320] }),
    orange: new W.Pen('orange', INK.orange, { park: [2350, 1150] }),
    blue: new W.Pen('blue', INK.blue, { park: [2100, 1420] }),
    red: new W.Pen('red', INK.red, { park: [2300, 1250] }),
    green: new W.Pen('green', INK.green, { park: [2150, 1380] }),
  };
  const PENS = Object.values(P);
  const penOf = col => ({ red: P.red, green: P.green, blue: P.blue, acc: P.orange, orange: P.orange })[col] || P.black;
  const T = W.text;
  const busy = new Map();   // pen -> time it is free
  // draw shapes with a pen starting at t, finishing before `limit` if the natural speed would overrun it
  const D = (pen, shapes, t, limit, o = {}) => {
    const list = [].concat(shapes).flat(9).filter(Boolean); if (!list.length) return t;
    t = Math.max(t, (busy.get(pen) || 0) + .05);
    const len = list.reduce((a, s) => a + s.len, 0), natural = len / (o.speed || 1300) + list.length * .06;
    const end = limit != null && t + natural > limit - .05 ? Math.max(t + .25 + list.length * .02, limit - .05) : null;
    const e = tl.draw(pen, list, t, end ? { by: end, ...o } : o); busy.set(pen, e); return e;
  };

  // ───────── a tiny TeX subset → handwriting strokes (fractions, powers, indices, roots, vectors, Greek, relations)
  const SYM = { mu: 'μ', theta: 'θ', Delta: 'Δ', delta: 'δ', alpha: 'α', beta: 'β', gamma: 'γ', omega: 'ω', Omega: 'Ω', lambda: 'λ', pi: 'π', sigma: 'σ', Sigma: 'Σ', rho: 'ρ', tau: 'τ', phi: 'φ', varphi: 'φ', epsilon: 'ε', varepsilon: 'ε', eta: 'η', nu: 'ν',
    le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', sim: '≈', times: '×', cdot: '·', to: '→', rightarrow: '→', Rightarrow: '⇒', implies: '⇒', leftarrow: '←', uparrow: '↑', downarrow: '↓', pm: '±', infty: '∞', propto: '∝', sum: 'Σ', int: '∫', circ: '°', degree: '°', prime: '′', therefore: '⇒',
    sin: 'sin', cos: 'cos', tan: 'tan', log: 'log', ln: 'ln', max: 'max', min: 'min', quad: '  ', qquad: '    ', ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ', '%': '%', '{': '(', '}': ')', '_': '_', '&': '&', '#': '#', '$': '$' };
  function parse(s) {
    let i = 0;
    const group = () => { if (s[i] === '{') { i++; const n = seq('}'); i++; return n; } if (s[i] === '\\') return [cmd()].flat(); const c = s[i++]; return c == null ? [] : [{ k: 's', v: c === '-' ? '−' : c }]; };
    const cmd = () => {
      i++; let name = ''; if (/[a-zA-Z]/.test(s[i])) { while (i < s.length && /[a-zA-Z]/.test(s[i])) name += s[i++]; } else name = s[i++];
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') return { k: 'f', a: group(), b: group() };
      if (name === 'sqrt') { if (s[i] === '[') { while (i < s.length && s[i] !== ']') i++; i++; } return { k: 'r', a: group() }; }
      if (name === 'vec' || name === 'overrightarrow') return { k: 'v', a: group() };
      if (name === 'hat' || name === 'bar' || name === 'overline') return { k: 'o', a: group() };
      if (['text', 'mathrm', 'textbf', 'mathbf', 'mathit', 'operatorname', 'boldsymbol', 'mbox'].includes(name)) return { k: 'g', a: (() => { if (s[i] !== '{') return group(); i++; let d = 1, v = ''; while (i < s.length) { if (s[i] === '{') d++; if (s[i] === '}' && !--d) break; v += s[i++]; } i++; return [...v].map(c => ({ k: 's', v: c })); })() };
      if (['left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'displaystyle', 'limits'].includes(name)) return { k: 'g', a: [] };
      const v = SYM[name]; return { k: 's', v: v != null ? v : name };
    };
    const seq = end => {
      const out = [];
      while (i < s.length && s[i] !== end) {
        const c = s[i];
        if (c === '^' || c === '_') { i++; const arg = group(), prev = out.length && out[out.length - 1].k === 'x' ? out.pop() : { k: 'x', base: out.length ? [out.pop()] : [], sup: null, sub: null }; prev[c === '^' ? 'sup' : 'sub'] = arg; out.push(prev); continue; }
        if (c === '\\') { out.push(cmd()); continue; }
        if (c === '{') { i++; out.push({ k: 'g', a: seq('}') }); i++; continue; }
        if (c === ' ') { i++; continue; }
        i++; out.push({ k: 's', v: c === '-' ? '−' : c === '*' ? '×' : c });
      }
      return out;
    };
    return seq(null);
  }
  // lay out nodes at (x, baseline y) with cap height h; returns width; pushes strokes into out (unless out is null)
  function lay(nodes, x, y, h, out, o) {
    let cx = x, run = '';
    const flush = () => { if (!run) return; const st = T(run, cx, y, { h, w: Math.max(4.5, h * .12), ...o }); if (out) out.push(...st); cx += st.width + h * .04; run = ''; };
    for (const n of nodes) {
      if (n.k === 's') { run += (n.v === '=' || n.v === '+' || n.v === '−' || n.v === '≤' || n.v === '≥' || n.v === '⇒' || n.v === '→' || n.v === '≈' || n.v === '×') ? ` ${n.v} ` : n.v; continue; }
      flush();
      if (n.k === 'g') cx += lay(n.a, cx, y, h, out, o);
      else if (n.k === 'x') {
        cx += lay(n.base, cx, y, h, out, o);
        const ws = n.sup ? lay(n.sup, cx + h * .05, y - h * .62, h * .62, out, o) : 0, wb = n.sub ? lay(n.sub, cx + h * .05, y + h * .32, h * .6, out, o) : 0;
        cx += Math.max(ws, wb) + h * .12;
      } else if (n.k === 'f') {
        const hh = h * .78, wa = lay(n.a, 0, 0, hh, null, o), wb = lay(n.b, 0, 0, hh, null, o), w = Math.max(wa, wb) + h * .3, ax = y - h * .36;
        lay(n.a, cx + (w - wa) / 2, ax - h * .2, hh, out, o);
        if (out) out.push(W.line(cx, ax, cx + w, ax, { w: Math.max(4, h * .1), ...o }));
        lay(n.b, cx + (w - wb) / 2, ax + h * .2 + hh, hh, out, o);
        cx += w + h * .15;
      } else if (n.k === 'r') {
        const wa = lay(n.a, 0, 0, h, null, o);
        if (out) out.push(W.poly([[cx, y - h * .4], [cx + h * .15, y - h * .48], [cx + h * .32, y + h * .08], [cx + h * .52, y - h * 1.12], [cx + h * .62 + wa + h * .1, y - h * 1.12]], { w: Math.max(4, h * .1), ...o }));
        lay(n.a, cx + h * .62, y, h, out, o); cx += h * .72 + wa + h * .12;
      } else if (n.k === 'v' || n.k === 'o') {
        const wa = lay(n.a, cx, y, h, out, o);
        if (out) out.push(...(n.k === 'v' ? W.arrow(cx, y - h * 1.18, cx + wa, y - h * 1.18, { w: Math.max(4, h * .08), head: h * .22, ...o }) : [W.line(cx, y - h * 1.15, cx + wa, y - h * 1.15, { w: Math.max(4, h * .08), ...o })]));
        cx += wa;
      }
    }
    flush();
    return cx - x;
  }
  const hasFrac = nodes => nodes.some(n => n.k === 'f' || (n.a && hasFrac(n.a)) || (n.base && hasFrac(n.base)));
  const tex = (src, x, y, h, o = {}) => { const nodes = parse(String(src)), out = []; const w = lay(nodes, x, y, h, out, o); out.width = w; out.tall = hasFrac(nodes); return out; };
  const texW = (src, h) => lay(parse(String(src)), 0, 0, h, null, {});

  // wrap plain text to a width
  const wrapText = (str, h, maxW) => {
    const ws = String(str).replace(/->/g, '→').split(/\s+/), L = []; let cur = '';
    for (const w of ws) { const t2 = cur ? cur + ' ' + w : w; if (cur && T(t2, 0, 0, { h }).width > maxW) { L.push(cur); cur = w; } else cur = t2; }
    if (cur) L.push(cur); return L;
  };

  // ───────── SVG diagram → strokes (drawn in document order, scaled into a box)
  const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); host.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:800px;height:600px'); document.body.appendChild(host);
  const COL = c => { c = String(c || '').trim(); return /RED/i.test(c) ? 'red' : /GREEN/i.test(c) ? 'green' : /BLUE/i.test(c) ? 'blue' : /ACC/i.test(c) ? 'orange' : 'black'; };
  function svgShapes(svgText, bx, by, bw, bh) {
    const doc = new DOMParser().parseFromString(String(svgText), 'image/svg+xml'), root = doc.documentElement;
    const vb = (root.getAttribute('viewBox') || '0 0 800 600').split(/[\s,]+/).map(Number), [vx, vy, vw, vh] = vb.length === 4 ? vb : [0, 0, 800, 600];
    const k = Math.min(bw / vw, bh / vh), ox = bx + (bw - vw * k) / 2 - vx * k, oy = by + (bh - vh * k) / 2 - vy * k;
    host.innerHTML = ''; const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); host.appendChild(g);
    const groups = [];   // one group per top-level element, in order: [{pen, strokes}]
    const walk = (el, inherit) => {
      const tag = el.tagName && el.tagName.toLowerCase(); if (!tag || tag === 'defs' || tag === 'title' || tag === 'desc' || tag === 'marker') return [];
      const stroke = el.getAttribute('stroke') || inherit.stroke, fill = el.getAttribute('fill') || inherit.fill;
      const sw = +(el.getAttribute('stroke-width') || inherit.sw || 5), dash = el.getAttribute('stroke-dasharray') || inherit.dash, me = el.getAttribute('marker-end') || inherit.me, ms = el.getAttribute('marker-start');
      const inh = { stroke, fill, sw, dash, me: null };
      const clone = el.cloneNode(false); g.innerHTML = ''; let node = clone;
      // apply ancestor transforms by nesting copies
      const chain = []; let p = el.parentNode; while (p && p !== root && p.getAttribute) { if (p.getAttribute('transform')) chain.unshift(p.getAttribute('transform')); p = p.parentNode; }
      let parent = g; for (const tr of chain) { const gg = document.createElementNS('http://www.w3.org/2000/svg', 'g'); gg.setAttribute('transform', tr); parent.appendChild(gg); parent = gg; }
      const pen = COL(stroke && stroke !== 'none' ? stroke : fill), o = { w: clamp(sw * k * 1.15, 4, 14) }, out = [];
      const M = pt => { const m = node.getCTM ? node.getCTM() : null, q = m ? pt.matrixTransform(m) : pt; return [ox + q.x * k, oy + q.y * k]; };
      if (tag === 'g' || tag === 'svg') { for (const c of el.children) out.push(...walk(c, { ...inh, me })); return out; }
      if (tag === 'text') {
        const t = el.textContent.trim(); if (!t) return [];
        const fs = +(el.getAttribute('font-size') || inherit.fs || 36), anc = el.getAttribute('text-anchor') || 'start';
        node = document.createElementNS('http://www.w3.org/2000/svg', 'text'); for (const a of ['x', 'y', 'transform']) if (el.getAttribute(a)) node.setAttribute(a, el.getAttribute(a)); parent.appendChild(node);
        const pt = host.createSVGPoint(); pt.x = parseFloat(el.getAttribute('x') || 0); pt.y = parseFloat(el.getAttribute('y') || 0); const m = node.getCTM(); const q = m ? pt.matrixTransform(m) : pt;
        const st = T(t.replace(/->/g, '→'), ox + q.x * k, oy + q.y * k, { h: Math.max(22, fs * k * .7), align: anc === 'middle' ? 'center' : anc === 'end' ? 'right' : 'left', w: Math.max(4, fs * k * .09) });
        return [{ pen: COL(fill && fill !== 'none' ? fill : stroke), strokes: st }];
      }
      parent.appendChild(node);
      let geo = null;
      if (['line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'path'].includes(tag)) {
        let d = null;
        if (tag === 'path') d = el.getAttribute('d') || '';
        const subs = [];
        if (tag === 'path') { for (const part of d.match(/[Mm][^Mm]*/g) || []) subs.push(part); }
        const sample = el2 => { const L = el2.getTotalLength(); if (!(L > 0)) return null; const n = clamp(Math.ceil(L / 6), 2, 400), pts = []; for (let i = 0; i <= n; i++) { const q = el2.getPointAtLength(L * i / n); const pt = host.createSVGPoint(); pt.x = q.x; pt.y = q.y; pts.push(M(pt)); } return pts; };
        if (tag === 'path') {
          // sample each subpath separately (a pen lift between them); relative moves resolved by the browser on the full path
          const full = node; let start = 0; const L = full.getTotalLength ? full.getTotalLength() : 0;
          if (subs.length <= 1) { const s = sample(full); if (s) geo = [s]; }
          else { geo = []; let acc = ''; for (const part of subs) { const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path'); acc += part; tmp.setAttribute('d', acc); parent.appendChild(tmp); const Lacc = tmp.getTotalLength(); const n = clamp(Math.ceil((Lacc - start) / 6), 2, 300), pts = []; for (let i = 0; i <= n; i++) { const q = tmp.getPointAtLength(start + (Lacc - start) * i / n); const pt = host.createSVGPoint(); pt.x = q.x; pt.y = q.y; pts.push(M(pt)); } if (Lacc - start > 1) geo.push(pts); start = Lacc; tmp.remove(); } }
          void L;
        } else if (tag === 'rect') { const s = sample(node); if (s) geo = [s]; }
        else { const s = sample(node); if (s) geo = [s]; }
      }
      if (!geo) return [];
      const dashed = dash && dash !== 'none';
      for (const pts of geo) {
        if (pts.length < 2) continue;
        const flatp = pts.map(p => [p[0], p[1]]);
        if (dashed) out.push(...[].concat(W.dashed(flatp, o))); else out.push(tag === 'circle' || tag === 'ellipse' || tag === 'path' ? W.curve(flatp, { ...o, smooth: 1 }) : W.poly(flatp, o));
      }
      // arrowheads where the source used markers
      const headAt = (pts, atEnd) => { const n = pts.length, a = atEnd ? pts[n - 1] : pts[0], b = atEnd ? pts[Math.max(0, n - 4)] : pts[Math.min(n - 1, 3)]; const ang = Math.atan2(a[1] - b[1], a[0] - b[0]), s = clamp(18 * k * 1.6, 12, 30); return W.poly([[a[0] - s * Math.cos(ang - .45), a[1] - s * Math.sin(ang - .45)], a, [a[0] - s * Math.cos(ang + .45), a[1] - s * Math.sin(ang + .45)]], o); };
      if (me && geo.length) out.push(headAt(geo[geo.length - 1], true));
      if (ms && geo.length) out.push(headAt(geo[0], false));
      return out.length ? [{ pen, strokes: out }] : [];
    };
    for (const c of root.children) { const r = walk(c, { stroke: root.getAttribute('stroke'), fill: root.getAttribute('fill'), sw: root.getAttribute('stroke-width') }); if (r.length) groups.push(...r.map(x => Array.isArray(x.strokes) ? x : { ...x, strokes: [x.strokes] })); }
    host.innerHTML = '';
    return groups;
  }
  const DG = Object.fromEntries((TL.diagrams || []).map(d => [d.id, d.svg]));

  // ───────── pages: walk the timeline and place everything on the board
  const shots = TL.shots, dur = TL.dur, keys = [];   // camera keys
  let cell = -1, used = 0, page = null, eraseEpoch = 0;
  const L0 = VERT ? 46 : 120, COLW = 1000, TOP = VERT ? 120 : 120, BOT = VERT ? 1060 : 900;   // inside a page (relative to its top-left)
  function newPage(t, kind = 'notes') {
    used++; cell = ORDER[(used - 1) % ORDER.length];
    const [cx, cy] = CELLS[cell], x0 = cx - PW / 2, y0 = cy - PH / 2;
    if (used > ORDER.length) { tl.erase(W.zigzag(x0 + 10, y0 + 20, PW - 20, PH - 40, VERT ? 14 : 9).flatMap(p => [p, p, p, p]), Math.max(0, t - 1.4), 1.2, { width: 280, strength: 1 }); eraseEpoch++; }
    page = { cx, cy, x0, y0, y: y0 + TOP, kind, t, dgN: 0, hasDg: false };
    // camera: travel to the new page (a pull-back on long trips), settle, then a slow push while writing
    const prev = keys.length ? keys[keys.length - 1] : null;
    if (!prev) keys.push([0, cx, cy, VZ, ROT, 'io']);
    else {
      const ta = Math.max(prev[0] + .2, t - .95), far = Math.hypot(cx - prev[1], cy - prev[2]) > 2500;
      keys.push([ta, prev[1], prev[2], prev[3], ROT, 'h']);
      if (far) keys.push([ta + .45, (prev[1] + cx) / 2, (prev[2] + cy) / 2, .42 * VZ, ROT, 'io']);
      keys.push([Math.max(ta + .5, t - .05), cx, cy, VZ, ROT, 'io']);
    }
    return page;
  }
  const settle = (t1) => { if (page && keys.length) { const k = keys[keys.length - 1]; if (t1 > k[0] + 1) keys.push([t1, page.cx + 10, page.cy + 6, 1.035 * VZ, ROT, 'l']); } };

  // flow item placement inside the current page
  const room = h => page && page.y + h <= page.y0 + BOT;
  function place(h, t) { if (!room(h)) { settle(t - 1); newPage(t); } const y = page.y; page.y += h; return y; }
  const colX = () => page.x0 + L0, colW = () => VERT ? 690 : page.hasDg ? COLW : 1660;

  function writeEl(e, t, limit) {
    if (e.k === 'h') {
      const txt = String(e.text).toUpperCase().replace(/->/g, '→'), hh = Math.min(70, 70 * (colW() - 20) / Math.max(1, T(txt, 0, 0, { h: 70 }).width)), y = place(150, t) + 92, st = T(txt, colX(), y, { h: hh, w: Math.max(6, hh * .13) });
      const e1 = D(P.orange, st, t, limit, { speed: 1500 });
      return D(P.orange, W.line(colX() - 6, y + 26, colX() + st.width + 10, y + 22, { w: 8 }), e1, limit);
    }
    if (e.k === 't') {
      const hh = 48, lines = wrapText(e.text, hh, colW() - 70), y0 = place(lines.length * 74 + 18, t);
      const pen = penOf(e.col); let end = t; const all = [], bullet = W.circle(colX() + 14, y0 + 40, 6, { w: 9 });
      lines.forEach((ln, i) => all.push(...T(ln, colX() + 50, y0 + 62 + i * 74, { h: hh, w: 7 })));
      end = D(pen, [bullet, ...all], t, limit, { speed: 1400 });
      const wMax = Math.max(...lines.map(ln => T(ln, 0, 0, { h: hh }).width));
      return marks(e, colX() + 50, y0 + 18, wMax, lines.length * 74, end, limit);
    }
    if (e.k === 'tex') {
      const hh = 60, tall = hasFrac(parse(String(e.tex))), H = tall ? 180 : 110, y0 = place(H + (e.box ? 30 : 10), t), base = y0 + (tall ? 120 : 82);
      const fitH = Math.min(hh, hh * (colW() - 60 - (e.ok != null ? 110 : 0)) / Math.max(1, texW(e.tex, hh))), st = tex(e.tex, colX() + 30, base, fitH, {}), pen = penOf(e.col);
      const end = D(pen, st, t, limit, { speed: 1400 });
      return marks(e, colX() + 30, base - (tall ? 110 : 72), st.width, tall ? 160 : 96, end, limit);
    }
    if (e.k === 'dg') return drawDg(e.d, t, limit);
    return t;
  }
  // a hand-drawn box, a tick (right) or a strike + cross (wrong) after the item is written
  function marks(e, x, y, w, h, t, limit) {
    let end = t;
    if (e.box) end = D(P.orange, W.roundRect(x - 24, y - 12, w + 48, h + 24, 18, { w: 8 }), end + .1, limit ? limit + .6 : null);
    if (e.ok === false) { end = D(P.red, [W.line(x - 10, y + h * .55, x + w + 10, y + h * .45, { w: 9 })], end + .1, null); end = D(P.red, T('×', x + w + 50, y + h * .8, { h: 70, w: 10 }), end + .05, null); }
    if (e.ok === true) end = D(P.green, T('✓', x + w + 50, y + h * .85, { h: 80, w: 10 }), end + .1, null);
    return end;
  }
  function drawDg(id, t, limit, big = false) {
    if (!DG[id]) return t;
    let bx, by, bw, bh;
    if (big) { newPage(t, 'dg'); if (VERT) { bx = page.x0 + 40; by = page.y0 + 120; bw = 690; bh = 900; } else { bx = page.x0 + 160; by = page.y0 + 110; bw = 1600; bh = 760; } page.y = page.y0 + BOT; }
    else if (VERT) { if (!page) newPage(t); const y = place(470, t); bx = page.x0 + 40; by = y + 10; bw = 690; bh = 450; }
    else {
      if (!page || page.dgN >= 2) newPage(t);
      page.hasDg = true; const n = page.dgN++;
      bx = page.x0 + 1160; bw = 680; bh = 360; by = page.y0 + 130 + n * 390;
    }
    const groups = svgShapes(DG[id], bx, by, bw, bh);
    const total = groups.reduce((a, g) => a + g.strokes.reduce((b, s) => b + s.len, 0), 0), budget = clamp(total / 1500, 1.4, 4.5);
    let tt = t;
    const span = limit ? Math.max(1.2, Math.min(budget, limit - t)) : budget;
    for (const gr of groups) {
      const len = gr.strokes.reduce((b, s) => b + s.len, 0), share = span * len / (total || 1);
      tt = Math.max(tt, D(P[gr.pen] || P.black, gr.strokes, tt, tt + Math.max(.12, share), { speed: 2000, minGap: .02, maxGap: .08 }));
    }
    return tt;
  }

  // ───────── physics on the board: magnets for the moving bodies, the pen draws the dotted trail and the readout
  const mover = [];   // {t0,t1, pos(t)->[x,y], size, line?:(t)->[x0,y0,x1,y1]}
  function sim(s, t, limit) {
    if (VERT) { if (!page || page.kind !== 'notes') newPage(t); return writeEl({ k: 't', text: s.flash || s.preset, col: 'acc' }, t, limit); }
    newPage(t, 'sim'); const X0 = page.x0, Y0 = page.y0, g = 9.8;
    const ground = Y0 + 820, end0 = Math.min(limit || t + 8, t + 9);
    const write = (str, x, y, h = 46, pen = P.black, tt) => D(pen, T(str, x, y, { h, w: 7 }), tt, null);
    let tt = t;
    if (s.preset === 'projectile') {
      const v = +s.v || 20, angs = (s.angles || [30, 45, 60]).slice(0, 3), Rmax = v * v / g, sc = 1350 / Math.max(Rmax, 1), x0 = X0 + 220;
      tt = D(P.black, [W.line(X0 + 150, ground, X0 + 1780, ground, { w: 8 })], tt, tt + .6);
      const cols = [P.blue, P.orange, P.green];
      angs.forEach((a, i) => {
        const r = a * Math.PI / 180, T1 = 2 * v * Math.sin(r) / g, Rg = v * v * Math.sin(2 * r) / g, real = clamp(T1, 1.2, 2.4), t0 = tt + .2;
        const pos = u => { const tf = u * T1; return [x0 + v * Math.cos(r) * tf * sc, ground - (v * Math.sin(r) * tf - .5 * g * tf * tf) * sc]; };
        mover.push({ t0, t1: t0 + real, pos: tm => pos(clamp((tm - t0) / real)), size: 54 });
        const pts = []; for (let k = 0; k <= 40; k++) pts.push(pos(k / 40));
        D(cols[i], W.dashed(pts, { w: 6 }), t0, t0 + real);
        tt = write(`${a}° → R = ${Rg.toFixed(1)} m`, x0 + Rg * sc - 120, ground + 70 + (i % 2) * 0, 34, cols[i], t0 + real + .1) + .1;
      });
    } else if (s.preset === 'drop') {
      const hgt = +s.h || 5, ms = (s.masses || [1, 5]).slice(0, 2), Tf = Math.sqrt(2 * hgt / g), sc = 600 / hgt, real = clamp(Tf, 1, 2.6), top = ground - hgt * sc;
      tt = D(P.black, [W.line(X0 + 300, ground, X0 + 1500, ground, { w: 8 }), ...T(`h = ${hgt} m`, X0 + 1180, (ground + top) / 2, { h: 40 })], tt, tt + 1);
      const t0 = tt + .4;
      ms.forEach((m, i) => { const x = X0 + 650 + i * 330; tt = Math.max(tt, write(`${m} kg`, x - 40, top - 80, 40, P.black, t0 - .3)); mover.push({ t0, t1: t0 + real, pos: tm => { const u = clamp((tm - t0) / real); return [x, top + (ground - top - 30) * u * u]; }, size: 30 + 12 * i }); });
      tt = write(`t = ${Tf.toFixed(2)} s`, X0 + 760, ground + 80, 44, P.blue, t0 + real + .1);
    } else if (s.preset === 'incline') {
      const a = (+s.angle || 30) * Math.PI / 180, mu = +s.mu || 0, L = 1100, bx = X0 + 300, by = ground, tx = bx + L * Math.cos(a), ty = by - L * Math.sin(a);
      tt = D(P.black, [W.poly([[bx, by], [bx + L * Math.cos(a), by], [tx, ty], [bx, by]], { w: 8 }), ...T(`${s.angle || 30}°`, bx + 150, by - 20, { h: 38 })], tt, tt + 1.2);
      const acc = g * (Math.sin(a) - mu * Math.cos(a)), slides = Math.tan(a) > mu;
      tt = write(`μ = ${mu}`, X0 + 1300, Y0 + 260, 46, P.black, tt + .1);
      const t0 = tt + .3, real = 2.2, dist = slides ? Math.min(L * .8, .5 * acc * real * real * 120) : 0;
      mover.push({ t0, t1: t0 + real, pos: tm => { const u = clamp((tm - t0) / real), d = dist * u * u; return [tx - (d + 60) * Math.cos(a) - 30 * Math.sin(a), ty + (d + 60) * Math.sin(a) - 30 * Math.cos(a)]; }, size: 46 });
      tt = write(slides ? `a = ${acc.toFixed(1)} m/s²` : `tanθ ≤ μ → stays`, X0 + 1300, Y0 + 340, 46, slides ? P.blue : P.red, t0 + real + .1);
    } else if (s.preset === 'collision') {
      const m1 = +s.m1 || 1, m2 = +s.m2 || 1, v1 = +s.v1 || 4, v2 = +s.v2 || 0, e = s.e == null ? 1 : +s.e;
      const u1 = (m1 * v1 + m2 * v2 - m2 * e * (v1 - v2)) / (m1 + m2), u2 = (m1 * v1 + m2 * v2 + m1 * e * (v1 - v2)) / (m1 + m2);
      tt = D(P.black, [W.line(X0 + 150, ground, X0 + 1780, ground, { w: 8 })], tt, tt + .5);
      tt = write(`${m1} kg, ${v1} m/s → ← ${m2} kg, ${v2} m/s`, X0 + 260, Y0 + 260, 40, P.black, tt + .1);
      const t0 = tt + .3, sc = 120, xa = X0 + 400, xb = X0 + 1000, meet = (xb - xa - 90) / Math.max(.1, (v1 - v2) * sc), tc = clamp(meet, .6, 2), k = meet / tc, after = 1.8;
      const pa = tm => tm < t0 + tc ? xa + v1 * sc * k * (tm - t0) : xa + v1 * sc * k * tc + u1 * sc * k * (tm - t0 - tc), pb = tm => tm < t0 + tc ? xb + v2 * sc * k * (tm - t0) : xb + v2 * sc * k * tc + u2 * sc * k * (tm - t0 - tc);
      mover.push({ t0, t1: t0 + tc + after, pos: tm => [pa(clamp(tm, t0, t0 + tc + after)), ground - 45], size: 40 + 8 * Math.min(m1, 4) });
      mover.push({ t0, t1: t0 + tc + after, pos: tm => [pb(clamp(tm, t0, t0 + tc + after)), ground - 45], size: 40 + 8 * Math.min(m2, 4) });
      tt = write(`after: ${u1.toFixed(1)} m/s, ${u2.toFixed(1)} m/s`, X0 + 260, Y0 + 340, 40, P.blue, t0 + tc + .2);
      tt = write(`p = ${(m1 * v1 + m2 * v2).toFixed(1)} = ${(m1 * u1 + m2 * u2).toFixed(1)} kg·m/s`, X0 + 260, Y0 + 420, 40, P.green, tt + .1);
    } else if (s.preset === 'pendulum' || s.preset === 'spring') {
      const pend = s.preset === 'pendulum', Lm = +s.L || 1, th = (+s.theta || 15) * Math.PI / 180, k = +s.k || 20, m = +s.m || 1, A = +s.A || .2;
      const Tp = pend ? 2 * Math.PI * Math.sqrt(Lm / g) : 2 * Math.PI * Math.sqrt(m / k), px = X0 + 760, py = Y0 + 200, len = 520;
      tt = D(P.black, pend ? [W.line(px - 160, py, px + 160, py, { w: 8 })] : [W.line(X0 + 300, Y0 + 300, X0 + 300, Y0 + 700, { w: 8 }), W.line(X0 + 300, Y0 + 700, X0 + 1500, Y0 + 700, { w: 8 })], tt, tt + .6);
      const t0 = tt + .2, t1 = Math.max(t0 + 3, Math.min(end0, t0 + 6)), slow = clamp(Tp, 1, 2.5) / Tp;
      const pos = tm => { const ph = 2 * Math.PI * (tm - t0) / (Tp / slow) ; if (pend) { const a = th * Math.cos(ph); return [px + len * Math.sin(a), py + len * Math.cos(a)]; } return [X0 + 760 + A / .2 * 260 * Math.cos(ph), Y0 + 650]; };
      mover.push({ t0, t1, pos, size: 48, line: pend ? tm => { const [x, y] = pos(tm); return [px, py, x, y]; } : tm => { const [x, y] = pos(tm); return ['spring', X0 + 300, y, x - 40, y]; } });
      tt = write(pend ? `T = 2π√(L/g) = ${Tp.toFixed(2)} s` : `T = 2π√(m/k) = ${Tp.toFixed(2)} s`, X0 + 1150, Y0 + 300, 44, P.blue, t0 + 1);
    } else {
      tt = write(String(s.flash || s.preset || 'SIMULATION').toUpperCase(), X0 + 300, Y0 + 400, 70, P.orange, tt);
    }
    if (s.flash) tt = D(P.orange, T(String(s.flash).toUpperCase(), page.x0 + 1050, page.y0 + 170, { h: 64, w: 9 }), tt + .15, null);
    return tt;
  }

  // ───────── quiz on the board: question, options, 3-2-1, then circle the right one and strike the rest
  function quiz(s, t, limit) {
    newPage(t, "quiz"); const X = page.x0 + (VERT ? 50 : 120), R = s.revealT ?? (t + 6);
    const QH = VERT ? 36 : 46, QL = VERT ? 54 : 70, qL = wrapText(s.q, QH, VERT ? PW - 170 : PW - 260); let tt = D(P.black, qL.flatMap((ln, i) => T(ln, X, page.y0 + (VERT ? 120 : 150) + i * QL, { h: QH, w: 7 })), t, Math.min(R - 3.4, t + 3.5));
    let y = page.y0 + (VERT ? 120 : 170) + qL.length * QL;
    if (s.tex) { const st = tex(s.tex, X + 40, y + 70, 54); tt = D(P.blue, st, tt + .05, R - 3.2); y += 140; }
    const opts = (s.opts || []).slice(0, 4), boxes = [];
    opts.forEach((o, i) => {
      const cx = VERT ? X : X + (i % 2) * 850, cy = VERT ? y + 80 + i * 118 : y + 90 + Math.floor(i / 2) * 150;
      const lab = T('ABCD'[i], cx + 26, cy + 22, { h: 54, w: 9 }), ot = String(o).replace(/->/g, '→'), oh = Math.min(VERT ? 44 : 50, 50 * (VERT ? PW - 320 : 700) / Math.max(1, T(ot, 0, 0, { h: 50 }).width)), txt = T(ot, cx + 110, cy + 22, { h: oh, w: Math.max(5, oh * .14) });
      tt = D(P.black, [W.circle(cx + 46, cy, 46, { w: 6 }), ...lab, ...txt], tt + .05, Math.max(tt + .5, R - 3.1 + i * 0));
      boxes.push({ cx, cy, w: txt.width + 130 });
    });
    // countdown written big on the right
    [3, 2, 1].forEach((n, i) => { const tc = R - 3 + i; if (tc > tt) D(P.orange, T(String(n), VERT ? page.x0 + 200 + i * 300 : page.x0 + 1700, VERT ? page.y0 + 1420 : page.y0 + 260 + i * 170, { h: 120, w: 12 }), tc, tc + .5); });
    // reveal
    let end = R;
    boxes.forEach((b, i) => {
      if (i === +s.ans) { end = Math.max(end, D(P.green, [W.roundRect(b.cx - 20, b.cy - 70, b.w + 40, 140, 40, { w: 10 }), ...T('✓', b.cx + b.w + 60, b.cy + 40, { h: 90, w: 12 })], R, R + 1)); }
      else end = Math.max(end, D(P.red, [W.line(b.cx + 100, b.cy + 4, b.cx + b.w - 10, b.cy - 6, { w: 8 })], R + .5 + i * .15, R + 1.1 + i * .15));
    });
    page.y = page.y0 + BOT; return end;
  }

  // ───────── walk all shots in time order
  let chapter = -1;
  shots.forEach((s, i) => {
    if (opts.only && s.style && s.style !== opts.only) return;
    const t = s.t, next = shots[i + 1] ? shots[i + 1].t : dur;
    if (s.type === 'chapter') {
      chapter = s.ch; settle(t - .5); newPage(t, 'title');
      const ttl = [].concat(s.title || []).map(String), big = ttl[ttl.length - 1] || '', small = ttl.length > 1 ? ttl[0] : '';
      let e = t + .15;
      if (small) e = D(P.orange, T(small.toUpperCase(), page.cx, page.cy - 120, { h: 54, align: 'center', w: 8 }), e, e + .6);
      const bt = T(big.toUpperCase(), page.cx, page.cy + 30, { h: 110, align: 'center', w: 12 });
      e = D(P.black, bt, e + .05, next - .3);
      D(P.orange, W.line(page.cx - bt.width / 2, page.cy + 70, page.cx + bt.width / 2, page.cy + 64, { w: 9 }), e, next - .1);
      page.y = page.y0 + BOT; return;
    }
    if (s.type === 'write') {
      const els = (s.els || []).map((e, k) => ({ ...e, t: Math.min(e.t != null ? Math.max(e.t, t) : t + .25 + k * .9, Math.max(t, next - .5)) })).sort((a, b) => a.t - b.t);
      // the camera reaches a fresh page just as the first note starts, so the viewer never waits on an empty board
      if (s.new || !page || ['title', 'quiz', 'sim', 'dg'].includes(page.kind) || s.ch !== chapter) { const t1 = els.length ? Math.max(t, els[0].t - .35) : t; settle(t1 - .5); newPage(t1); chapter = s.ch; }
      els.forEach((e, k) => writeEl(e, e.t, els[k + 1] ? els[k + 1].t + .8 : next + .5));
      return;
    }
    if (s.type === 'eq') { if (!page || page.kind !== 'notes') newPage(t); writeEl({ k: 'tex', tex: s.tex, box: s.box, col: s.hl }, t + .1, next); if (s.label) writeEl({ k: 't', text: s.label }, t + .6, next); return; }
    if (s.type === 'steps') {
      settle(t - .5); newPage(t);
      if (s.head) writeEl({ k: 'h', text: s.head }, t + .1, t + 1.2);
      (s.items || []).forEach(([tx, ti], k) => { const at = Math.max(t + .2, ti ?? t + .3 + k * 1.2); const y0 = place(130, at), st = tex(tx, colX() + 90, y0 + 92, 58); D(P.blue, T(`${k + 1}.`, colX() + 10, y0 + 92, { h: 50, w: 8 }), at, at + .4); D(P.black, st, at + .1, (s.items[k + 1] && s.items[k + 1][1]) || next); });
      return;
    }
    if (s.type === 'mistake') {
      if (!page || page.kind !== 'notes') { settle(t - .5); newPage(t); }
      const R = s.revealT ?? t + 2.5;
      if (s.head) writeEl({ k: 'h', text: s.head }, t + .1, t + 1);
      writeEl(s.wtex ? { k: 'tex', tex: s.wtex, col: 'red', ok: false } : { k: 't', text: s.wrong, col: 'red', ok: false }, t + .4, R - .2);
      writeEl(s.rtex ? { k: 'tex', tex: s.rtex, col: 'green', ok: true } : { k: 't', text: s.right, col: 'green', ok: true }, R, next);
      return;
    }
    if (s.type === 'diagram') { settle(t - .5); drawDg(s.d, t + .1, next, true); if (s.label) D(P.orange, T(String(s.label).toUpperCase(), page.cx, page.y0 + 930, { h: 46, align: 'center', w: 8 }), t + .4, next); return; }
    if (s.type === 'quiz') { settle(t - .5); quiz(s, t + .1, next); return; }
    if (s.type === 'sim') { settle(t - .5); sim(s, t + .1, next); return; }
    if (s.type === 'end') { newPage(t, 'title'); D(P.black, T('SUBSCRIBE', page.cx, page.cy, { h: 120, align: 'center', w: 12 }), t + .2, t + 2); return; }
    // anything else: a short note of its text on the current page
    const txt = s.text || (s.lines && s.lines.join(' ')) || s.head || '';
    if (txt) { if (!page || page.kind !== 'notes') newPage(t); writeEl({ k: 't', text: txt }, t + .1, next); }
  });
  settle(dur);
  keys.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < keys.length; i++) if (keys[i][0] <= keys[i - 1][0]) keys[i][0] = keys[i - 1][0] + .01;
  const cam = new W.Camera(keys.length ? keys : [[0, 960, 540, 1, ROT]]);
  tl.end();

  // ghosts of old lessons (the style's faint residue), seeded
  const ghosts = [], gR = mulberry(99);
  for (let i = 0; i < 110; i++) {
    const x = gR() * 11400 + 200, y = gR() * 6200 + 200, k = gR(), o = { w: 12, alpha: .05 + gR() * .05, color: gR() < .2 ? '#8aa0c8' : '#9aa0a8' };
    if (k < .3) ghosts.push(...T(['x = 4', 'F = ma', 'Q.2', 'v²', 'f(x)', 'pH 7', 'due fri', '→ 12', 'ok!'][i % 9], x, y, { h: 50 + gR() * 40, ...o }));
    else if (k < .55) ghosts.push(W.circle(x, y, 40 + gR() * 110, o));
    else if (k < .8) ghosts.push(...W.arrow(x, y, x + (gR() - .5) * 500, y + (gR() - .5) * 300, o));
    else ghosts.push(W.line(x, y, x + 200 + gR() * 500, y + (gR() - .5) * 80, o));
  }
  const board = new W.Board(tl, { ghosts, ...WORLD });
  // moving bodies: the library's round magnets; strings/springs in black marker
  board.objs.push({ draw: (ctx, t, c) => {
    for (const m of mover) {
      if (t < m.t0 - 1.2) continue; const tm = Math.min(t, m.t1), [x, y] = m.pos(tm);
      if (m.line) { const L = m.line(tm); ctx.strokeStyle = INK.black; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
        if (L[0] === 'spring') { const [, x0, y0, x1] = L, n = 14; ctx.moveTo(x0, y0); for (let k = 1; k < n; k++) ctx.lineTo(x0 + (x1 - x0) * k / n, y0 + (k % 2 ? -26 : 26)); ctx.lineTo(x1, y0); }
        else { ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); }
        ctx.stroke(); }
      W.drawPinMagnet(ctx, x, y, c, { lift: t < m.t0 ? clamp((m.t0 - t) / 1.2) : 0, rot: ROT, size: m.size * 2.2 });
    }
  } });
  board.objs.push({ draw: (ctx, t, c) => { for (const e of tl.erasers) W.drawEraser(ctx, e, t, c); } });
  board.objs.push({ draw: (ctx, t, c) => { for (const p of PENS) { const po = W.penPose(p, t, cam); W.drawMarker(ctx, p, po && VERT ? { ...po, ang: -0.95 - po.lift * .06 + Math.sin(t * 5.3 + p.id.length) * .02 + ROT } : po, c, t); } } });

  // subtitle plate, exactly the style's: cream plate, Architects Daughter, orange tick
  const subs = (TL.phrases || []).map(p => ({ t0: p.s - .05, t1: p.e + .3, text: p.w.map(w => w.w).join(' ') }));
  for (let i = 0; i < subs.length - 1; i++) subs[i].t1 = Math.min(Math.max(subs[i].t1, subs[i].t0 + 1.2), subs[i + 1].t0 - .04);
  if (!VERT) board.overlays.push({ draw: (ctx, t) => {
    const s = subs.find(s => t >= s.t0 && t < s.t1); if (!s) return;
    const a = Math.min(1, (t - s.t0) / .12, (s.t1 - t) / .12); ctx.font = '44px AD';
    let rows = [s.text];
    if (ctx.measureText(s.text).width > 1250) { const ws = s.text.split(' '); let best = 1, bd = 1e9; for (let i = 1; i < ws.length; i++) { const d = Math.abs(ctx.measureText(ws.slice(0, i).join(' ')).width - ctx.measureText(ws.slice(i).join(' ')).width); if (d < bd) { bd = d; best = i; } } rows = [ws.slice(0, best).join(' '), ws.slice(best).join(' ')]; }
    const w = Math.max(...rows.map(r => ctx.measureText(r).width)) + 64, h = 70 + (rows.length - 1) * 52, y0 = 1038 - h;
    ctx.globalAlpha = a * .9; ctx.fillStyle = '#fdfcf8'; ctx.shadowColor = 'rgba(30,30,40,.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.roundRect(960 - w / 2, y0, w, h, 14); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.globalAlpha = a;
    ctx.fillStyle = INK.orange; ctx.fillRect(960 - w / 2 + 22, y0 + h - 12, 36, 4);
    ctx.fillStyle = '#23262c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; rows.forEach((r, i) => ctx.fillText(r, 960, y0 + 37 + i * 52));
  } });
  if (new URLSearchParams(location.search).has('nosubs')) board.overlays.length = 0;

  // frame render with the style's camera motion blur on fast moves
  const off = new OffscreenCanvas(1920, 1080), oc = off.getContext('2d');
  function render(ctx, t) {
    const dt = 1 / 30, a = cam.at(t), b = cam.at(Math.max(0, t - dt));
    const sp = Math.hypot((a.x - b.x) * a.z, (a.y - b.y) * a.z) + Math.abs(Math.log(a.z / b.z)) * 900, N = sp > 14 ? Math.min(12, Math.ceil(sp * .5 / 4)) : 1;
    if (N === 1) { board.render(ctx, t, cam); return; }
    const ov = board.overlays; board.overlays = [];
    for (let i = 0; i < N; i++) { board.render(oc, t - dt * .5 * i / (N - 1), cam); ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(off, 0, 0); }
    ctx.globalAlpha = 1; board.overlays = ov; for (const o of ov) { ctx.save(); o.draw(ctx, t); ctx.restore(); }
  }
  // sound events for the mix (marker writes, taps, erasers), panned by where they happen on screen
  const ev = tl.ev.map(e => { if (e.x == null) return e; const c = cam.at(e.t), [px] = W.toScreen(c, e.x, e.y); return { ...e, pan: +clamp((px - 960) / 1400, -.7, .7).toFixed(2) }; });
  return { dur, render, ev, subs, cam, vertical: VERT };
}

if (!window.HS_NO_AUTORUN) {
  const F = await build();
  const ctx = document.getElementById('c').getContext('2d');
  window.DUR = F.dur; window.EV = F.ev;
  window.render = t => F.render(ctx, t);
  window.READY = true;
}
