// Clay 3D theme kit (AutoTube Studio's own theme; see ../STYLE.md). three.js, deterministic.
// Import in a scenes module as './stheme/clay-3d/clay.js' (the page maps "three" to the library's three.js).
// Font: Baloo 2 (SIL OFL, fonts/OFL-Baloo2.txt), also covers Devanagari.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE };

try { const f = new FontFace('Clay Baloo', `url(${new URL('./fonts/Baloo2.ttf', import.meta.url).href})`, { weight: '400 800' }); await f.load(); document.fonts.add(f); } catch (e) { console.warn('clay font: ' + e); }
export const FONT = "'Clay Baloo', 'Arial Rounded MT Bold', sans-serif";

export const PAL = {
  cream: '#F3E6CF', sand: '#E8C89A', terracotta: '#D9714E', coral: '#F07A6A', mustard: '#E8B33A', leaf: '#6DAE5B', teal: '#3E9C9A',
  sky: '#8CC8E8', navy: '#2E4A7A', plum: '#8A5A9E', pink: '#F2A3B5', brown: '#8B5A3C', ink: '#2B2320', white: '#FBF7EF',
  skin: ['#F2CBA6', '#E2A97E', '#C98B5E', '#A0663F', '#6E4329'],
};

// ---- deterministic helpers ----
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = k => (k = clamp(k), k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
export const easeOut = k => 1 - (1 - clamp(k)) ** 3;
export const back = k => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// stop motion: characters and props move on twos (12 poses per second)
export const stopTime = (t, fps = 12) => Math.floor(t * fps + 1e-6) / fps;
// tiny per-pose wobble, as if the animator re-touched the clay (apply after setting the pose)
export function boil(obj, t, amt = 1, seed = 1) { const p = Math.floor(t * 12); obj.rotation.z += (hash(p * 1.7 + seed) - .5) * .012 * amt; obj.position.y += (hash(p * 3.1 + seed) - .5) * .004 * amt; }
// squash & stretch around the base: k > 0 squash, k < 0 stretch
export function squash(obj, k) { obj.scale.set(1 + k * .25, 1 - k * .3, 1 + k * .25); }

// ---- clay material: matte, thumb-pressed bump, slight colour wobble ----
const _bump = new Map();
function bumpTex(seed) {
  if (!_bump.has(seed)) {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) { const cx = r() * S, cy = r() * S, R = 10 + r() * 26; for (let k = 0; k < 7; k++) { x.beginPath(); x.ellipse(cx, cy, Math.max(1, R - k * 3), Math.max(1, (R - k * 3) * .7), r() * 3, .3, 5.6); x.strokeStyle = `rgba(${k % 2 ? 150 : 100},${k % 2 ? 150 : 100},${k % 2 ? 150 : 100},.5)`; x.lineWidth = 1.2; x.stroke(); } }
    for (let i = 0; i < 1400; i++) { const v = 90 + r() * 80; x.fillStyle = `rgba(${v},${v},${v},.35)`; x.fillRect(r() * S, r() * S, 2, 2); }
    for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(r() * S, r() * S); x.lineTo(r() * S, r() * S); x.strokeStyle = 'rgba(70,70,70,.35)'; x.lineWidth = 1.5; x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); _bump.set(seed, t);
  }
  return _bump.get(seed);
}
export function clay(color, { seed = 1, rough = .88, sheen = .25 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0, sheen, sheenRoughness: .8, sheenColor: new THREE.Color('#ffffff'), bumpMap: bumpTex(seed % 5), bumpScale: 1.2 });
  return m;
}
// lumpy hand-made geometry: displace vertices a little with smooth deterministic noise
function lumpy(geo, amt = .03, seed = 1) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 5.1 + seed) * Math.sin(v.y * 4.3 + seed * 2) * Math.sin(v.z * 4.7 + seed * 3); v.multiplyScalar(1 + n * amt); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals(); return geo;
}
const shadowed = m => { m.castShadow = true; m.receiveShadow = true; return m; };
export function blob(r, color, { seed = 1, sx = 1, sy = 1, sz = 1, lump = .04 } = {}) { const m = shadowed(new THREE.Mesh(lumpy(new THREE.SphereGeometry(r, 48, 32), lump, seed), clay(color, { seed }))); m.scale.set(sx, sy, sz); return m; }
export function roll(len, r, color, { seed = 2 } = {}) { const m = shadowed(new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(r, len, 12, 24), .03, seed), clay(color, { seed }))); return m; }
export function slab(w, h, d, color, { seed = 3, radius = null } = {}) { return shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, radius ?? Math.min(w, h, d) * .25), clay(color, { seed }))); }
export function disc(r, h, color, { seed = 4 } = {}) { const m = clay(color, { seed }); m.bumpScale = .12; return shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, h, 96, 1), m)); }

// ---- a paper card / clay sign with words (numbers, names, formulas live here) ----
export function card(text, { w = 1.6, h = .8, bg = PAL.white, fg = PAL.ink, size = 120, sub = '' } = {}) {
  const px = 512, c = document.createElement('canvas'); c.width = px * (w / h); c.height = px; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  let s = size; x.font = `800 ${s}px ${FONT}`; while (x.measureText(text).width > c.width * .88 && s > 30) { s -= 6; x.font = `800 ${s}px ${FONT}`; }
  x.fillText(text, c.width / 2, sub ? c.height * .42 : c.height / 2);
  if (sub) { x.font = `700 ${s * .45}px ${FONT}`; x.fillText(sub, c.width / 2, c.height * .78); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const g = new THREE.Group();
  const board = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w + .12, h + .12, .08, 4, .04), clay(PAL.brown, { seed: 9 })));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: .95 })); face.position.z = .045; face.receiveShadow = true;
  g.add(board, face); return g;
}

// ---- original clay character ----
// character({ body, skin, hair, height }) -> Group with .parts { body, head, eyes[], mouths{}, brows[], arms[], feet[] }
export function character({ body = PAL.coral, skin = PAL.skin[1], hair = PAL.ink, pants = PAL.navy, height = 1.6, seed = 5, hat = null } = {}) {
  const G = new THREE.Group(), u = height / 1.6, P = {};
  const torso = blob(.42 * u, body, { seed, sy: 1.25, sx: 1, sz: .9 }); torso.position.y = .62 * u; G.add(torso); P.body = torso;
  const hips = blob(.34 * u, pants, { seed: seed + 1, sy: .6 }); hips.position.y = .32 * u; G.add(hips);
  P.feet = [-1, 1].map(s => { const f = blob(.13 * u, pants === PAL.ink ? PAL.brown : PAL.ink, { seed: seed + 2, sx: 1.1, sy: .6, sz: 1.5 }); f.position.set(s * .17 * u, .07 * u, .05 * u); G.add(f); return f; });
  const head = new THREE.Group(); head.position.y = 1.22 * u; G.add(head); P.head = head;
  const skull = blob(.36 * u, skin, { seed: seed + 3, sy: 1.02 }); head.add(skull);
  const hairM = blob(.37 * u, hair, { seed: seed + 4, sy: .62, sz: 1.02 }); hairM.position.set(0, .14 * u, -.03 * u); head.add(hairM);
  if (hat) { const h1 = disc(.26 * u, .22 * u, hat, { seed: seed + 9 }); h1.position.y = .36 * u; head.add(h1); }
  const white = new THREE.MeshStandardMaterial({ color: '#FFFDF8', roughness: .4 }), black = new THREE.MeshStandardMaterial({ color: '#1A1412', roughness: .25 });
  P.eyes = [-1, 1].map(s => { const e = new THREE.Group(); const w = new THREE.Mesh(new THREE.SphereGeometry(.085 * u, 24, 16), white); const p = new THREE.Mesh(new THREE.SphereGeometry(.045 * u, 16, 12), black); p.position.z = .055 * u; e.add(w, p); e.position.set(s * .13 * u, .03 * u, .3 * u); head.add(e); e.userData.pupil = p; return e; });
  P.brows = [-1, 1].map(s => { const b = roll(.09 * u, .022 * u, hair, { seed: seed + 6 }); b.rotation.z = Math.PI / 2; b.position.set(s * .13 * u, .15 * u, .31 * u); head.add(b); return b; });
  const mouthMat = clay('#7A2E2A', { seed: 7 }); P.mouths = {};
  { const m = new THREE.Mesh(new THREE.TorusGeometry(.07 * u, .018 * u, 8, 24, Math.PI), mouthMat); m.rotation.z = Math.PI; m.position.set(0, -.1 * u, .32 * u); P.mouths.smile = m; }
  { const m = new THREE.Mesh(new THREE.TorusGeometry(.07 * u, .018 * u, 8, 24, Math.PI), mouthMat); m.position.set(0, -.15 * u, .31 * u); P.mouths.frown = m; }
  { const m = blob(.055 * u, '#7A2E2A', { seed: 8, sy: 1.3, sz: .5 }); m.position.set(0, -.12 * u, .31 * u); P.mouths.o = m; }
  { const m = roll(.08 * u, .016 * u, '#7A2E2A'); m.rotation.z = Math.PI / 2; m.position.set(0, -.12 * u, .32 * u); P.mouths.flat = m; }
  for (const k in P.mouths) { head.add(P.mouths[k]); P.mouths[k].visible = k === 'smile'; }
  P.arms = [-1, 1].map(s => { const pivot = new THREE.Group(); pivot.position.set(s * .4 * u, .9 * u, 0); const a = roll(.32 * u, .075 * u, body, { seed: seed + 10 }); a.position.y = -.2 * u; const hand = blob(.085 * u, skin, { seed: seed + 11 }); hand.position.y = -.42 * u; pivot.add(a, hand); pivot.rotation.z = s * .15; G.add(pivot); return pivot; });
  G.userData.parts = P; G.userData.u = u; return G;
}
// replacement faces: mouth 'smile' | 'o' | 'flat' | 'frown'; brow 'up' | 'angry' | 'flat' | 'sad'; look -1..1 (pupils)
export function setFace(ch, { mouth = 'smile', brow = 'flat', look = 0, blink = false } = {}) {
  const P = ch.userData.parts, u = ch.userData.u;
  for (const k in P.mouths) P.mouths[k].visible = k === mouth;
  P.brows.forEach((b, i) => { const s = i ? 1 : -1; b.position.y = (brow === 'up' ? .2 : .15) * u; b.rotation.z = Math.PI / 2 + (brow === 'angry' ? -s * .45 : brow === 'sad' ? s * .4 : 0); });
  P.eyes.forEach(e => { e.userData.pupil.position.x = look * .03 * u; e.scale.y = blink ? .15 : 1; });
}
// arm pose: raise 0 (down) .. 1 (up), per side (-1 left, 1 right)
export function setArm(ch, side, raise) { const p = ch.userData.parts.arms[side < 0 ? 0 : 1]; p.rotation.z = (side < 0 ? -1 : 1) * (.15 + raise * 2.6); }
// mouth flap for speech from a lip-sync value (S.mouthAt(t)) or a simple talk phase
export function talk(ch, t, on = true) { if (!on) return setFace(ch, { mouth: 'smile' }); const p = Math.floor(t * 12) % 3; setFace(ch, { mouth: p === 0 ? 'o' : p === 1 ? 'flat' : 'smile' }); }

// ---- the world: renderer, set, lights, camera ----
export function world(W, H, { floor = PAL.sand, back = PAL.sky, fov = 30 } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setSize(W, H, false); renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(back); scene.fog = new THREE.Fog(new THREE.Color(back), 9, 22);
  const camera = new THREE.PerspectiveCamera(fov, W / H, .1, 100); camera.position.set(0, 1.6, 7); camera.lookAt(0, .9, 0);
  // seamless paper backdrop: floor + curved sweep
  const sweep = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 10, 64, 1, true, Math.PI * .75, Math.PI * .5), new THREE.MeshStandardMaterial({ color: back, roughness: 1, side: THREE.BackSide })); sweep.position.set(0, 5, 2); sweep.receiveShadow = true; scene.add(sweep);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: back, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.26; ground.receiveShadow = true; scene.add(ground);
  const table = disc(3.2, .25, floor, { seed: 11 }); table.position.y = -.125; scene.add(table);
  // lights: warm key upper-left with soft shadows, cool fill, rim
  const key = new THREE.DirectionalLight('#FFE3C2', 2.6); key.position.set(-4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -.0004; Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .5, far: 25 }); scene.add(key);
  scene.add(new THREE.HemisphereLight('#CFE4FF', '#6B5040', .9));
  const rim = new THREE.DirectionalLight('#BFD8FF', 1.1); rim.position.set(4, 3, -5); scene.add(rim);
  const W0 = { renderer, scene, camera, canvas, W, H, table, key };
  return W0;
}
// camera helper: orbit/dolly around a target. from/to = { az (deg), el (deg), dist, y }. dist is for landscape;
// in portrait (9:16) it is pulled back automatically so the same set still fits the narrow frame.
export function cam(Wd, from, to, k, target = new THREE.Vector3(0, .9, 0)) {
  const e = ease(k), az = lerp(from.az, to.az, e) * Math.PI / 180, el = lerp(from.el, to.el, e) * Math.PI / 180, d = lerp(from.dist, to.dist, e) * (Wd.W < Wd.H ? 1.75 : 1), ty = lerp(from.y ?? target.y, to.y ?? target.y, e);
  Wd.camera.position.set(target.x + Math.sin(az) * Math.cos(el) * d, ty + Math.sin(el) * d, target.z + Math.cos(az) * Math.cos(el) * d); Wd.camera.lookAt(target.x, ty, target.z);
}
// render the 3D world onto the 2D frame, with a soft vignette like a real lens
export function draw(Wd, g) {
  Wd.renderer.render(Wd.scene, Wd.camera); g.drawImage(Wd.canvas, 0, 0, g.canvas.width, g.canvas.height);
  const W = g.canvas.width, H = g.canvas.height, v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .6);
  v.addColorStop(0, 'rgba(40,25,15,0)'); v.addColorStop(1, 'rgba(40,25,15,.32)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}
// drop-in placement: an object lands at y0 with a squash, k = 0..1
export function place(obj, y0, k, h = 1.2) { const e = clamp(k); if (e <= 0) { obj.visible = false; return; } obj.visible = true; const fall = e < .6 ? 1 - easeOut(e / .6) : 0; obj.position.y = y0 + fall * h; const land = e >= .6 ? Math.sin((e - .6) / .4 * Math.PI) * (1 - (e - .6) / .4) : 0; squash(obj, land * .8); }

// ---- subtitles (STYLE.md §6) ----
export function subtitle(g, text, W, H) {
  if (!text) return; const sz = Math.round(Math.min(W, H) * .046); g.save(); g.font = `800 ${sz}px ${FONT}`;
  const words = String(text).split(/\s+/), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > W * .8 && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur);
  const L = lines.slice(0, 2), lh = sz * 1.15, w = Math.max(...L.map(l => g.measureText(l).width)) + sz * 1.4, h = L.length * lh + sz * .7, x = (W - w) / 2, y = H - (H > W ? 260 : 70) - h, r = h / 2;
  g.beginPath(); g.roundRect(x, y, w, h, Math.min(r, 40)); g.fillStyle = 'rgba(243,230,207,.95)'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#8B5A3C'; g.stroke();
  g.fillStyle = '#3A2A20'; g.textAlign = 'center'; g.textBaseline = 'middle'; L.forEach((l, i) => g.fillText(l, W / 2, y + h / 2 + (i - (L.length - 1) / 2) * lh));
  g.restore();
}
