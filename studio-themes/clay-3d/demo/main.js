// Clay 3D demo (study only; scenes import clay.js, never this file): a clay student drops a ball and a feather —
// which lands first? ~7 s. Portrait 1080x1920 by default (?w=&h=).
import { THREE, PAL, world, character, setFace, setArm, talk, blob, slab, card, disc, cam, draw, place, stopTime, boil, subtitle, clamp } from './clay.js';
const q = new URLSearchParams(location.search), W = +(q.get('w') || 1080), H = +(q.get('h') || 1920);
const cv = document.getElementById('c'); cv.width = W; cv.height = H; const g = cv.getContext('2d');

const Wd = world(W, H, { floor: PAL.sand, back: '#9FD0E6' });
const kid = character({ body: PAL.coral, skin: PAL.skin[2], hair: PAL.ink, pants: PAL.navy, seed: 3 }); kid.position.set(-.35, 0, .4); kid.rotation.y = .35; Wd.scene.add(kid);
const ball = blob(.2, PAL.mustard, { seed: 4 }); Wd.scene.add(ball);
const leaf = blob(.18, PAL.leaf, { seed: 6, sx: 1.6, sy: .25, sz: .8 }); Wd.scene.add(leaf);
const stool = slab(.9, .5, .9, PAL.teal, { seed: 7 }); stool.position.set(1.1, .25, -.2); Wd.scene.add(stool);
const sign = card('Kaun pehle girega?', { w: 2.2, h: .8, bg: PAL.white }); sign.position.set(0, 2.9, -1.2); Wd.scene.add(sign);
const ans = card('Hawa nahi = dono saath!', { w: 2.4, h: .8, bg: PAL.mustard }); ans.position.set(0, 2.0, -1.2); Wd.scene.add(ans);
for (let i = 0; i < 5; i++) { const p = blob(.12 + i * .02, [PAL.pink, PAL.plum, PAL.leaf, PAL.mustard, PAL.coral][i], { seed: 20 + i }); p.position.set(-2.3 + i * .25, .1, 1.2 - i * .5); Wd.scene.add(p); }

window.render = t => {
  const s = stopTime(t);
  // the kid raises both hands holding the ball (left) and the leaf (right), then lets go at 2.6 s
  const raise = clamp(s / 1.2); setArm(kid, -1, raise); setArm(kid, 1, raise);
  if (s < 2.6) talk(kid, s, s > .3 && s < 2.2); else setFace(kid, { mouth: s > 3.4 ? 'o' : 'smile', brow: s > 3.4 ? 'up' : 'flat', look: .6 });
  boil(kid, s, 1, 3);
  const hand = (side) => { const v = new THREE.Vector3(); kid.userData.parts.arms[side < 0 ? 0 : 1].children[1].getWorldPosition(v); return v; };
  kid.updateMatrixWorld(true);
  const drop = Math.max(0, s - 2.6), fallBall = Math.min(1, drop * drop * 4.9 / 2.1), fallLeaf = Math.min(1, drop * .35 + Math.sin(drop * 6) * .02);
  const hl = hand(-1), hr = hand(1);
  ball.position.set(hl.x, s < 2.6 ? hl.y + .15 : lerpY(hl.y + .15, .2, fallBall), hl.z + .1);
  leaf.position.set(hr.x + (s < 2.6 ? 0 : Math.sin(drop * 4) * .25), s < 2.6 ? hr.y + .12 : lerpY(hr.y + .12, .05, fallLeaf), hr.z + .1); leaf.rotation.z = s < 2.6 ? 0 : Math.sin(drop * 5) * .5;
  sign.visible = s >= .4; place(ans, 2.0, (s - 4.2) / .6, .9);
  cam(Wd, { az: -8, el: 9, dist: 6.2, y: 1.3 }, { az: 10, el: 7, dist: 5.2, y: 1.4 }, clamp(t / 7), new THREE.Vector3(0, 1.2, 0));
  draw(Wd, g);
  if (!q.get('nosubs')) subtitle(g, t < 2.6 ? 'Ball aur patta ek saath chhodo...' : t < 4.2 ? 'Ball pehle girti hai, hawa ki wajah se.' : 'Vacuum mein dono ek saath girte hain!', W, H);
};
function lerpY(a, b, k) { return a + (b - a) * k; }
window.DUR = 7; window.render(0); window.READY = true;
