// Comic Book demo (study only; scenes import comic.js, never this file). A JEE myth told as a 3-panel page:
// a student is told "negative marking in numericals!", shock, then the answer card. ~8 s, portrait or landscape (?w=&h=).
import { PAL, paper, panel, layout, person, balloon, caption, sfx, speed, dots, sign, camPan, print, subtitle, pose, clamp, easeOut } from './comic.js';
const q = new URLSearchParams(location.search), W = +(q.get('w') || 1080), H = +(q.get('h') || 1920);
const cv = document.getElementById('c'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
const V = H > W, L = V ? layout(W, H, [[1], [1], [1]], { heights: [.33, .27, .4], m: 40 }) : layout(W, H, [[.5, .5], [1]], { heights: [.55, .45] }), P = V ? L : [L[0], L[1], L[2]];

function page(t) {
  paper(g, W, H, 2);
  // panel 1: the rumour
  panel(g, P[0].x, P[0].y, P[0].w, P[0].h, (c, w, h) => {
    c.fillStyle = PAL.sky; c.fillRect(0, 0, w, h); dots(c, x => x.rect(0, h * .55, w, h), PAL.blue, 7, 14, .35);
    c.fillStyle = '#C9B48A'; c.fillRect(0, h * .78, w, h * .22);
    person(c, w * .3, h * .95, h * .75, { shirt: PAL.green, mood: 'happy', mouth: t > .4 && t < 1.8 ? .4 + .4 * Math.abs(Math.sin(t * 9)) : 0, arm: .6 });
    person(c, w * .72, h * .95, h * .72, { shirt: PAL.red, skin: PAL.skin[2], mood: t > 1.8 ? 'shock' : 'happy', look: -1 });
    caption(c, 24, h - 90, 'Exam hall, 10 minutes before the start...', { k: (t - .1) / .5, size: 30 });
    balloon(c, w * .5, h * .2, 'Numerical mein bhi minus marking hai!', w * .34, h * .38, { k: (t - .5) / .35, size: 34, maxW: 420 });
  }, { k: (t + .3) / .5 });
  // panel 2: shock
  const p2 = (t - 1.6) / .4;
  panel(g, P[1].x, P[1].y, P[1].w, P[1].h, (c, w, h) => {
    c.fillStyle = PAL.yellow; c.fillRect(0, 0, w, h); speed(c, w / 2, h * .5, w, h, { n: 40, seed: 5 });
    person(c, w * .62, h * 1.45, h * 1.3, { shirt: PAL.red, skin: PAL.skin[2], mood: 'shock' });
    sfx(c, w * .27, h * .3, 'WHAT?!', { size: Math.min(w, h) * .32, k: (t - 1.9) / .3 });
  }, { k: p2, tilt: -.02 });
  // panel 3: the truth, written on a card in the picture
  panel(g, P[2].x, P[2].y, P[2].w, P[2].h, (c, w, h) => {
    c.fillStyle = PAL.white; c.fillRect(0, 0, w, h); dots(c, x => x.rect(0, 0, w, h), PAL.cyan, 6, 16, .25);
    person(c, w * .2, h * 1.02, h * .8, { shirt: PAL.purple, skin: PAL.skin[0], hair: PAL.hair[1], mood: 'happy', arm: 1 });
    const ok = pose(t, [0, 2.6, 3.4]);
    if (ok.i >= 1) sign(c, w * .64, h * .2, 'NUMERICAL: NO MINUS!', { size: Math.min(w * .065, 64), bg: PAL.yellow, tilt: -.04 * ok.k });
    if (ok.i >= 2) sign(c, w * .64, h * .42, 'MCQ: -1 ONLY', { size: Math.min(w * .06, 58), bg: PAL.white, tilt: .03 });
    balloon(c, w * .66, h * .64, 'Myth busted! Attempt every numerical!', w * .33, h * .5, { k: (t - 4) / .35, size: 32, maxW: 440, kind: 'shout' });
  }, { k: (t - 2.4) / .5 });
}

window.render = t => {
  g.clearRect(0, 0, W, H);
  // slow camera: whole page, then push towards the last panel
  camPan(g, W, H, { x: W / 2, y: H / 2, z: 1 }, { x: W / 2, y: P[2].y + P[2].h / 2, z: 1.15 }, clamp((t - 4.5) / 2.5), () => page(t));
  print(g, W, H);
  if (!new URLSearchParams(location.search).get('nosubs')) subtitle(g, t < 2 ? 'Numerical mein bhi minus marking hai?' : t < 4.5 ? 'Asli rule kya hai?' : 'Numerical par koi minus nahi.', W, H);
};
window.DUR = 8; window.render(0); window.READY = true;
