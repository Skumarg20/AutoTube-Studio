// AutoTube Studio director for the Lemo Opuscar "cel-anime-80s" theme (80s Cel Anime), portrait 1080x1920 for Shorts.
// Uses the LIBRARY'S OWN modules unchanged: head80 (the 80s character head), PAL (per-time-of-day colour models),
// cel tools (vgrad, airbrush, rgba), fx (speed lines, flare), bg (painted skyline plate + emissive pair) and post (the
// videotape-on-CRT WebGL pass). Rules followed from STYLE.md: painted plate + flat two-tone cel + backlit light + tape;
// characters on twos (12 fps), performance (blinks, lip flaps) on threes (8 fps), light bands moved across held cels,
// impact frames (2 frames of inverted silhouette over radial lines), chrome-gradient italic titles that flicker on at 12 fps.
import { canvas, TAU, rgba, vgrad, airbrush, hash, LWK } from '/styles/cel-anime-80s/demo/cel.js';
import { head80 } from '/styles/cel-anime-80s/demo/head80.js';
import { PAL } from '/styles/cel-anime-80s/demo/pal.js';
import { speedLines, flare } from '/styles/cel-anime-80s/demo/fx.js';
import { skylinePlate, NEON } from '/styles/cel-anime-80s/demo/bg.js';
import { makePost } from '/styles/cel-anime-80s/demo/post.js';

const q12 = t => Math.floor(t * 12 + 1e-6) / 12, q8 = t => Math.floor(t * 8 + 1e-6) / 8, f12 = t => Math.floor(t * 12 + 1e-6);
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
// lip-sync: the voice's mouth shapes (from ElevenLabs letter timings) → the head's mouth drawings
const MOUTH = { A: 'closed', X: null, B: 'talk', C: 'talk', D: 'smileopen', E: 'oh', F: 'oh', G: 'talk', H: 'talk' };

export async function build(opts = {}) {
  const TL = window.TL, VERT = opts.vertical !== false, W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
  const HX = VERT ? 540 : 960, HY = VERT ? 1010 : 640, HS = VERT ? 3.9 : 3.3, TY = VERT ? 300 : 190;   // head centre, scale, title line
  await document.fonts.load('italic 900 120px Kanit'); await document.fonts.load('600 54px "Barlow SC"'); await document.fonts.load('60px "Dela Gothic One"');
  const [sc, g] = canvas(W, H), [gc, e] = canvas(W, H), [LC, LG] = canvas(W, H), [MC, MG] = canvas(W, H);
  const gl = document.createElement('canvas'); gl.width = W; gl.height = H; gl.style.display = 'none'; document.body.appendChild(gl);
  const post = makePost(gl);
  // painted plates, once at load: a night city and a dusk one (colour + emissive)
  const plates = { night: skylinePlate(VERT ? 2600 : 3840, VERT ? 1150 : 620, 9, 'night'), dusk: skylinePlate(VERT ? 2600 : 3840, VERT ? 1150 : 620, 5, 'dawn') };
  const shots = TL.shots, mouthAt = t => { const m = (TL.mouth || []).find(x => t >= x[0] && t < x[1]); return m ? MOUTH[m[2]] : null; };

  // cel layer at portrait size: drawn offscreen, pasted on the picture, and its silhouette cut out of the glow layer
  function celLayer(fn) {
    LG.setTransform(1, 0, 0, 1, 0, 0); LG.clearRect(0, 0, W, H); fn(LG);
    g.drawImage(LC, 0, 0);
    MG.setTransform(1, 0, 0, 1, 0, 0); MG.globalCompositeOperation = 'source-over'; MG.clearRect(0, 0, W, H); MG.drawImage(LC, 0, 0);
    MG.globalCompositeOperation = 'source-in'; MG.fillStyle = '#000'; MG.fillRect(0, 0, W, H); MG.globalCompositeOperation = 'source-over';
    e.drawImage(MC, 0, 0);
  }
  // backgrounds (painted, then only slid)
  function background(kind, t, lt) {
    const P = plates[kind === 'dusk' || kind === 'dawn' ? 'dusk' : 'night'];
    vgrad(g, 0, 0, W, H, kind === 'dusk' ? [[0, '#2b1650'], [.45, '#a24a7a'], [.75, '#ff9a6a'], [1, '#ffd0a0']] : [[0, '#0a0620'], [.5, '#1d1046'], [1, '#3a1450']]);
    for (let i = 0; i < 9; i++) airbrush(g, hash(i * 7.3) * W, 120 + hash(i * 3.1) * (H - P.h), 200, 90, kind === 'dusk' ? '#ffd2b0' : '#7a5ad8', .18);
    if (kind !== 'dusk') { const R = n => hash(n * 1.37); for (let i = 0; i < 120; i++) { g.fillStyle = rgba('#ffffff', .2 + R(i) * .5); g.fillRect(R(i + 300) * W, R(i + 600) * (H - P.h + 100), 2, 2); } }
    const x = -((lt * 26) % Math.max(1, P.w - W)), y = H - P.h;
    g.drawImage(P.c, x, y); e.drawImage(P.e, x, y);
  }
  // chrome title: heavy italic, sky→white horizon→violet→pink→gold, dark + neon outlines, backlit glow, flickers on at 12 fps
  function chrome(text, cy, lt) {
    const flick = (() => { const k = Math.floor(lt * 12); return k < 1 ? 0 : k === 2 ? .3 : k === 4 ? .6 : 1; })(); if (!flick) return;
    let size = VERT ? 150 : 170; g.font = `italic 900 ${size}px Kanit`; while (g.measureText(text).width > W - 90 && size > 50) { size -= 6; g.font = `italic 900 ${size}px Kanit`; }
    const gr = g.createLinearGradient(0, cy - size * .8, 0, cy + size * .05);
    gr.addColorStop(0, '#e8f6ff'); gr.addColorStop(.46, '#7fc8ff'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(.54, '#3a2a7a'); gr.addColorStop(.8, '#ff6aa0'); gr.addColorStop(1, '#ffd08a');
    g.save(); g.textAlign = 'center'; g.lineJoin = 'round'; g.globalAlpha = Math.min(1, flick + .2);
    g.strokeStyle = '#120830'; g.lineWidth = size * .11; g.strokeText(text, W / 2, cy);
    g.strokeStyle = '#ff3fa4'; g.lineWidth = size * .045; g.strokeText(text, W / 2, cy);
    g.fillStyle = gr; g.fillText(text, W / 2, cy); g.restore();
    e.save(); e.textAlign = 'center'; e.font = `italic 900 ${size}px Kanit`; e.lineJoin = 'round';
    e.strokeStyle = rgba('#ff3fa4', .9 * flick); e.lineWidth = size * .07; e.strokeText(text, W / 2, cy);
    e.fillStyle = rgba('#9fd8ff', .35 * flick); e.fillText(text, W / 2, cy);
    const sx = -300 + seg(lt, .15, 1.1) * 1700; e.globalCompositeOperation = 'lighter';
    const sg = e.createLinearGradient(sx - 100, 0, sx + 100, 0); sg.addColorStop(0, rgba('#ffffff', 0)); sg.addColorStop(.5, rgba('#ffffff', .7)); sg.addColorStop(1, rgba('#ffffff', 0));
    e.fillStyle = sg; e.fillRect(sx - 100, cy - size, 200, size * 1.15); e.restore();
    const ga = Math.sin(seg(lt, .9, 1.4) * Math.PI); if (ga > 0) flare(e, W / 2 - g.measureText(text).width * .42, cy - size * .7, .5 * ga, '#bfe6ff', { ghosts: false, streak: 600 });
  }

  function shot(s, t, lt, d) {
    const P = s.bg === 'dusk' ? PAL.dawn : PAL.night, tq = q12(t), lq = q12(lt), fr = f12(t);
    background(s.bg || 'night', t, lq);
    const impact = s.fx === 'impact', inv = impact && lt < 2 / 24;
    if (impact || s.fx === 'speed') speedLines(g, fr, { type: 'radial', cx: HX, cy: HY - 30, n: 110, col: inv ? '#000000' : '#ffffff', a: inv ? .9 : .5, r0: 380, seed: 7 });
    if (inv) { g.fillStyle = '#f4f0ff'; g.fillRect(0, 0, W, H); speedLines(g, fr, { type: 'radial', cx: HX, cy: HY - 150, n: 140, col: '#120830', a: .95, r0: 300, seed: 9 }); }
    // the student: a big 3/4 close-up, on twos; blinks and lip flaps on threes
    const k8 = Math.floor(q8(t) * 8), blink = !s.expr || s.expr === 'neutral' || s.expr === 'determined' ? (k8 % 29 === 0) : false;
    const talk = mouthAt(q8(t)), expr = blink ? 'closed' : (s.expr || 'determined');
    const shake = impact && lt < .5 ? (hash(fr * 2.1) - .5) * 26 * (1 - lt / .5) : (hash(fr * 2.1) - .5) * 4;
    const sc0 = (s.scale || HS) * (1 + .02 * lq), cy = HY + (impact ? -20 * (1 - seg(lt, 0, .3)) : 0);
    LWK.k = .55;
    celLayer(c => {
      c.translate(HX - 7 * sc0 + shake, cy - 21 * sc0 + shake * .4); c.scale(sc0, sc0);
      head80(c, P, { view: s.view || 'q', expr, mouth: talk || undefined, look: s.look || [.3, 0], ph: (fr % 4) / 4, wind: s.fx === 'speed' ? 1 : .5, reflect: '#ff5fc8', detail: true, rim: { c: s.bg === 'dusk' ? '#ffb070' : '#ff6ad0', d: [1.2, .8] } });
      // move light, not drawings: neon bands sweep across the held cel
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
      for (let k = 0; k < 2; k++) {
        const col = ['#35e7ff', '#ff3fa4'][k], x = -500 + ((lt * 900 + k * 900) % 2400);
        const gr = c.createLinearGradient(x, 0, x + 420, 260); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.5, rgba(col, .2)); gr.addColorStop(1, rgba(col, 0));
        c.fillStyle = gr; c.fillRect(0, 0, W, H);
      }
      if (inv) { c.fillStyle = '#120830'; c.fillRect(0, 0, W, H); }   // impact frame: the cel goes to a dark silhouette
      c.globalCompositeOperation = 'source-over';
    });
    LWK.k = 1;
    // no chrome titles over the picture (owner: gradient words look pasted on); any words live inside the scene
    if (s.kana) { g.save(); g.textAlign = 'center'; g.font = '56px "Dela Gothic One"'; g.fillStyle = '#35e7ff'; g.fillText(s.kana, W / 2, TY - 125); e.save(); e.textAlign = 'center'; e.font = '56px "Dela Gothic One"'; e.fillStyle = rgba('#35e7ff', .7); e.fillText(s.kana, W / 2, TY - 125); e.restore(); g.restore(); }
    // eye glint at the reveal
    if (s.glint) { const ga = Math.sin(seg(lt, .35, .85) * Math.PI); if (ga > 0) flare(e, HX - 7 * sc0 + (-21 - 3.7) * sc0, cy - 21 * sc0 + 19 * sc0, .5 * ga, '#ffffff', { ghosts: false, streak: 500, spikes: 4, rot: .78 }); }
  }

  const list = shots.filter(s => s.type === 'anime');
  // THIS video's scenes, written by Claude for this script (the repo workflow, like films/s-*): anime_scenes.js exports
  // { a0: S => ..., a1: ... } keyed by the anime shot's order. Only the theme's own tools are imported there.
  let SC = {}; try { SC = (await import('./anime_scenes.js')).default || {}; } catch (err) { if (!/Failed to fetch|404|Cannot find|error loading/i.test(String(err))) console.error('anime_scenes.js: ' + err); }
  const helpers = { celLayer, chrome, mouthAt, q8, q12, f12, seg, plates, PAL, VERT };
  function render(t) {
    for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
    let i = -1; for (let k = 0; k < list.length; k++) if (list[k].t <= t) i = k;
    if (i >= 0) {
      const s = list[i], nx = shots.find(x => x.t > s.t), end = nx ? nx.t : TL.dur, fn = SC['a' + i];
      if (fn) { const S = { t, lt: t - s.t, d: end - s.t, u: (t - s.t) / Math.max(.01, end - s.t), g, e, W, H, shot: s, ...helpers };
        g.save(); e.save(); fn(S); g.restore(); e.restore();
        for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
        }
      else shot(s, t, t - s.t, end - s.t);
    }
    post.render(sc, gc, Math.round(t * 24), null, { power: 1, track: 0 });
    return gl;
  }
  return { render, W, H };
}
