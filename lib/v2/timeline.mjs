// Timeline builder for engine v2: plan (chapters -> lines -> shots) + voice durations + word timings -> TL (page) + mix plan.
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
const sim = (a, b) => { a = norm(a); b = norm(b); if (!a || !b) return 0; return 1 - lev(a, b) / Math.max(a.length, b.length); };

// replace words the speech recogniser misheard with the closest word from the script line
// captions show the SCRIPT's words; speech recognition only supplies the timing. The recognised words are aligned to the
// script words in order (edit-distance alignment), so a misheard word ("waded" for "weighed") still gets the script's word.
function correctWords(list, script) {
  const sw = String(script).replace(/\[[^\]]{2,30}\]\s*/g, '').split(/\s+/).filter(Boolean);
  if (!list.length || !sw.length) return list;
  if (sw.length === list.length) return list.map(([, s, e], i) => [sw[i], s, e]);
  const n = list.length, m = sw.length, GAP = .8, D = [], B = [];
  for (let i = 0; i <= n; i++) { D.push(new Float64Array(m + 1)); B.push(new Int8Array(m + 1)); }
  for (let i = 1; i <= n; i++) { D[i][0] = i * GAP; B[i][0] = 1; }
  for (let j = 1; j <= m; j++) { D[0][j] = j * GAP; B[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const a = norm(list[i - 1][0]), b = norm(sw[j - 1]), c = a === b ? 0 : 1 - sim(list[i - 1][0], sw[j - 1]);
    const d = D[i - 1][j - 1] + c, u = D[i - 1][j] + GAP, l = D[i][j - 1] + GAP;
    if (d <= u && d <= l) { D[i][j] = d; B[i][j] = 0; } else if (u <= l) { D[i][j] = u; B[i][j] = 1; } else { D[i][j] = l; B[i][j] = 2; }
  }
  const out = list.map(x => [...x]), pre = new Array(n).fill(''), post = new Array(n).fill('');
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const k = i > 0 && j > 0 ? B[i][j] : i > 0 ? 1 : 2;
    if (k === 0) { out[i - 1][0] = sw[j - 1]; i--; j--; }
    else if (k === 1) { out[i - 1][0] = ''; i--; }                                       // heard but not in the script (fillers): dropped
    else { if (i > 0) post[i - 1] = sw[j - 1] + ' ' + post[i - 1]; else pre[0] = sw[j - 1] + ' ' + pre[0]; j--; }   // script word not heard: show it with its neighbour
  }
  return out.map(([w, s, e], k) => [(pre[k] + w + (post[k] ? ' ' + post[k] : '')).trim(), s, e]).filter(x => x[0]);
}
// time (relative to line start) at which word `at` is spoken; fuzzy, falls back to its position in the text
function wordTime(list, at, say, dur) {
  const [w, n] = String(at).split('#'), k = +(n || 1), want = norm(w); let c = 0;
  for (const x of list) if (norm(x[0]) === want && ++c === k) return x[1];
  let best = null, bs = 0; for (const x of list) { const v = sim(x[0], w); if (v > bs) { bs = v; best = x; } } if (best && bs >= .6) return best[1];
  const i = String(say).toLowerCase().indexOf(String(w).toLowerCase()); if (i >= 0) return dur * i / Math.max(1, say.length);
  return null;
}

// evidence-board slot layouts (world coords: landscape 1920x1080, vertical 1080x1920)
const SLOTS_H = [[360, 290], [960, 170], [1580, 330], [330, 780], [1580, 640], [1580, 900], [330, 520], [1580, 120]];
const SLOTS_V = [[280, 240], [800, 240], [280, 580], [800, 580], [260, 1250], [820, 1250], [280, 1480], [800, 1480]];
function layoutBoard(board) {
  let k = 0; return (board || []).slice(0, 10).map(p => {
    if (p.center) return { ...p, ph: [960, 540], pv: [540, 910] };
    if (p.kind === 'marker') return { ...p, ph: [960, 880], pv: [540, 1690] };
    const i = k++ % SLOTS_H.length; return { ...p, ph: SLOTS_H[i], pv: SLOTS_V[i] };
  });
}

const MOOD = { ukiyoe: 'drama', telestrator: 'tense', investig: 'suspense', newspkg: 'tense', citysym: 'march', kino: 'march', datap: 'curious', papercut: 'curious', shadow: 'drama', teardown: 'suspense', whitemodel: 'curious', sketch: 'curious', deco: 'bouncy', ascii: 'tense', scifi: 'tense', anime: 'rise', desktop: 'curious', hd2d: 'drama', whiteboard: 'curious', cartoon: 'march', rubberhose: 'bouncy', paper: 'curious', news: 'tense', light: 'curious', board: 'suspense', map: 'march', reel: 'drama', count: 'rise', chalk: 'curious', blueprint: 'suspense', ink: 'drama', hud: 'tense' };

export function buildTimeline(plan, dur, words, { channel = '', format = 'long' } = {}) {
  const shots = [], caps = [], voice = [], sfx = [], chapters = [];
  let t = 0.4;
  plan.chapters.forEach((ch, ci) => {
    const c0 = t, style = ch.style;
    if (ch.title && ch.title.length) { shots.push({ t, type: 'chapter', style, title: ch.title, ch: ci }); sfx.push({ t, k: 'sting', style }); t += format === 'short' ? 1.4 : 2.3; }
    for (const ln of ch.lines) {
      const id = ln.id, d = dur[id]; if (!d) continue;
      const pre = +ln.pre || 0, gap = ln.gap ?? 0.3; t += pre;
      const v0 = t; voice.push({ id, at: v0 });
      const wl = correctWords(words[id] || [], ln.say);
      let lastT = -1;
      (ln.shots || []).forEach((s, i) => {
        let rel = i === 0 ? null : (s.at ? wordTime(wl, s.at, ln.say, d) : null);
        if (i > 0 && rel === null) rel = d * i / ln.shots.length;          // no usable cut word: spread evenly
        let st = i === 0 ? (pre ? v0 - Math.min(pre, 0.4) : v0 - 0.12) : v0 + rel - 0.1;
        if (st < lastT + 0.7) { if (i === 0) st = Math.max(st, lastT + .01); else return; }   // too close to the previous cut: skip
        lastT = st;
        const shot = { ...s, t: +st.toFixed(3), style, ch: ci, line: id }; delete shot.at; delete shot.reveal;
        if (s.reveal) { const r = wordTime(wl, s.reveal, ln.say, d); if (r != null) shot.revealT = +(v0 + r - .05).toFixed(3); }   // quiz answer / "right" panel lands on the spoken word
        if (Array.isArray(s.items)) shot.items = s.items.map((it, k) => { const [txt, w] = Array.isArray(it) ? it : [it, null]; const r = w ? wordTime(wl, w, ln.say, d) : null; return [txt, +(v0 + (r ?? (d * (k + .3) / s.items.length)) - .05).toFixed(3)]; });
        if (Array.isArray(s.gfx)) shot.gfx = s.gfx.map(e => { const o = { ...e }; delete o.at; if (e.at) { const r = wordTime(wl, e.at, ln.say, d); if (r != null) o.t = +(v0 + r - .05).toFixed(3); } return o; });
        if (Array.isArray(s.els)) shot.els = s.els.map(e => { const o = { ...e }; delete o.at; if (e.at) { const r = wordTime(wl, e.at, ln.say, d); if (r != null) o.t = +(v0 + r - .05).toFixed(3); } return o; });
        shots.push(shot);
        if (shot.gfx) shot.gfx.forEach(e => { if (e.t == null) return; const k = { circle: 'marker', arrow: 'marker', box: 'marker', underline: 'marker', stamp: 'stamp', icon: 'pop', icons: 'pop', zoom: 'whoosh', bars: 'whoosh', pie: 'whoosh', timeline: 'whoosh', counter: 'hit', badge: 'pop' }[e.k]; if (k) sfx.push({ t: e.t, k }); });
        if (shot.els && style === 'whiteboard') shot.els.forEach((e, k) => { if (e.t == null) sfx.push({ t: +(shot.t + .15 + k * .75).toFixed(3), k: 'marker' }); });
        if (shot.els) shot.els.forEach(e => { if (e.t != null) sfx.push({ t: e.t, k: e.k === 'char' ? 'pop' : e.k === 'arrow' ? 'whoosh' : 'pop' }); });
        sfx.push({ t: shot.t, k: s.sfx || (i === 0 && !pre ? 'none' : 'whoosh'), style });
        if (shot.items) shot.items.forEach(([, tt]) => sfx.push({ t: tt, k: 'pop' }));
      });
      // glue tokens the recogniser split off, like '60' + ',000' or 'U' + '.S.'
      for (let k = wl.length - 1; k > 0; k--) if (/^[,.'’]\w/.test(wl[k][0])) { wl[k - 1] = [wl[k - 1][0] + wl[k][0], wl[k - 1][1], wl[k][2]]; wl.splice(k, 1); }
      for (const [w, s, e] of wl) caps.push({ w, s: +(v0 + Math.max(0, s)).toFixed(3), e: +(v0 + e).toFixed(3), ch: ci, line: id });
      t = v0 + d + gap;
    }
    chapters.push({ id: ci, style, mood: ch.mood || MOOD[style] || 'curious', t0: +c0.toFixed(3), t1: +t.toFixed(3), title: ch.title || null });
  });
  const DUR = +(t + (format === 'short' ? 0.6 : 1.0)).toFixed(2);
  const bi = shots.findIndex(s => s.type === 'black'); const quiet = bi >= 0 ? [shots[bi].t - 0.3, shots[bi + 1] ? shots[bi + 1].t : shots[bi].t + 1.5] : null;
  let route = null;
  if (plan.route && plan.route.points && plan.route.points.length > 1) {
    const rs = shots.map((s, i) => [s, i]).filter(([s]) => s.type === 'map' && s.route);
    if (rs.length) { const t0 = rs[0][0].t, li = rs[rs.length - 1][1], t1 = (shots[li + 1] ? shots[li + 1].t : DUR) - 0.8; route = { ...plan.route, t0, t1: Math.max(t1, t0 + 2) }; }
    else route = { ...plan.route, t0: 0, t1: 1 };
  }
  const phrases = []; let cur = null;
  for (const c of caps) {
    if (!cur || cur.w.length >= (format === 'short' ? 3 : 5) || c.line !== cur.line || c.s - cur.e > 0.35 || /[.,!?;:]$/.test(cur.w[cur.w.length - 1].w)) { cur = { w: [], ch: c.ch, line: c.line }; phrases.push(cur); }
    cur.w.push(c); cur.s = cur.w[0].s; cur.e = c.e;
  }
  const TL = { dur: DUR, shots, phrases, chapters, route, quiet, board: layoutBoard(plan.board), places: plan.places || [], highlight: plan.highlight || [], ticker: plan.ticker || [], focus: plan.focus || {}, meta: { channel, title: plan.title, next: plan.next || '', op: plan.op || plan.title, format } };
  const mix = { dur: DUR, voice, sfx, chapters, quiet, route };
  const gaps = shots.map((s, i) => (shots[i + 1] ? shots[i + 1].t : DUR) - s.t);
  return { TL, mix, stats: { dur: DUR, shots: shots.length, avgShot: +(DUR / shots.length).toFixed(2), longestShot: +Math.max(...gaps).toFixed(2) } };
}

export function srtFrom(TL) {
  const ts = x => new Date(Math.round(x * 1000)).toISOString().substr(11, 12).replace('.', ',');
  return TL.phrases.map((p, i) => `${i + 1}\n${ts(p.s)} --> ${ts(p.e + .15)}\n${p.w.map(w => w.w).join(' ')}\n`).join('\n');
}
