// "sim" shots for engine v2: real physics on screen, deterministic (a function of t only, so parallel render workers agree).
// Teaching presets use exact physics (closed form or RK4) so every number shown is correct for JEE/NEET:
//   drop {masses:[1,5], h}            two masses fall from the same height and land together
//   projectile {v, angles:[30,45,60]} launches with trails and the range of each
//   pendulum {L, theta}               swinging bob, period T = 2*pi*sqrt(L/g) (large angles solved with RK4)
//   spring {k, m, A}                  block on a spring, simple harmonic motion, T = 2*pi*sqrt(m/k)
//   collision {m1, m2, v1, v2, e}     1-D collision, momentum before/after, e = coefficient of restitution
//   incline {angle, mu}               block on a rough ramp: slides with a = g(sin - mu cos) or stays put
// Spectacle presets use the Matter.js engine (MIT, vendor/matter.min.js), stepped at a fixed 1/120 s from the start of the shot:
//   dominoes {n}  ·  pile {n}
window.makeSim = function (env) {
  const { W, H, U, V, F, TL, clamp, lerp, eOut, eBack, font, fitText, rr } = env;
  const G = () => env.g, g9 = 9.8;
  const skin = st => st === 'chalk' ? { ink: '#f3f1e7', acc: '#ffd166', a: '#7cc6fe', b: '#ff8f7e', c: '#8ee88f', card: null }
    : st === 'whiteboard' ? { ink: '#1c1c1f', acc: '#e4573d', a: '#1a64d6', b: '#d93025', c: '#188038', card: null }
    : { ink: '#f5f6f8', acc: '#ffd400', a: '#4fb3ff', b: '#ff5d7a', c: '#35d07f', card: 'rgba(10,12,18,.88)' };
  const box = () => V ? { x: W * .06, y: H * .12, w: W * .88, h: H * .54 } : { x: W * .07, y: H * .09, w: W * .86, h: H * .7 };
  function frame(st, s, lt) {
    const g = G(), sk = skin(st), B = box(); env.SK[st].bg(s.t + lt);
    if (sk.card) { g.save(); g.fillStyle = sk.card; rr(B.x - 20 * U, B.y - 20 * U, B.w + 40 * U, B.h + 40 * U, 26 * U); g.fill(); g.restore(); }
    return { g, sk, B };
  }
  const txt = (s, x, y, size, col, align = 'center', fam = F.inter, w = 800) => { const g = G(); font(size * U, fam, w); g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y); };
  const ball = (x, y, r, col, sk) => { const g = G(); g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = 3 * U; g.strokeStyle = sk.card ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.45)'; g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x - r * .35, y - r * .35, r * .25, 0, 7); g.fill(); };
  const arrow = (x0, y0, x1, y1, col, lw = 5) => { const g = G(), a = Math.atan2(y1 - y0, x1 - x0), h = 16 * U; if (Math.hypot(x1 - x0, y1 - y0) < 4) return; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw * U; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - h * Math.cos(a - .45), y1 - h * Math.sin(a - .45)); g.lineTo(x1 - h * Math.cos(a + .45), y1 - h * Math.sin(a + .45)); g.closePath(); g.fill(); };
  const readout = (sk, B, lines) => { const g = G(); font(30 * U, F.mono, 700); const w = Math.max(...lines.map(l => g.measureText(l).width)) + 36 * U, h = lines.length * 42 * U + 20 * U; g.fillStyle = sk.card ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.18)'; rr(B.x + 6 * U, B.y + 6 * U, w, h, 14 * U); g.fill(); lines.forEach((l, k) => { g.fillStyle = k ? sk.ink : sk.acc; g.textAlign = 'left'; g.fillText(l, B.x + 24 * U, B.y + 46 * U + k * 42 * U); }); };
  const flash = (text, sk, B, since) => { if (since < 0) return; const p = eBack(clamp(since / .35)), g = G(); g.save(); g.translate(W / 2, B.y + B.h * .2); g.scale(p, p); g.rotate(-.04); const sz = fitText(text, F.anton, 400, 92 * U, B.w * .8); font(sz, F.anton); g.lineWidth = 10 * U; g.strokeStyle = 'rgba(0,0,0,.55)'; g.textAlign = 'center'; g.strokeText(text, 0, 0); g.fillStyle = sk.acc; g.fillText(text, 0, 0); g.restore(); };
  const f2 = x => (Math.round(x * 100) / 100).toFixed(2), f1 = x => (Math.round(x * 10) / 10).toFixed(1);
  const T0 = .5;   // everything starts half a second into the shot, so the viewer sees the setup first

  const P = {};
  P.drop = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), ms = (s.masses || [1, 5]).slice(0, 3), h = +s.h || 5, gy = B.y + B.h * .92, sc = (gy - B.y - B.h * .22) / h;
    const tf = Math.sqrt(2 * h / g9), τ = clamp(lt - T0, 0, tf * 3);
    g.strokeStyle = sk.ink; g.lineWidth = 4 * U; g.beginPath(); g.moveTo(B.x, gy); g.lineTo(B.x + B.w, gy); g.stroke();
    ms.forEach((m, k) => { const x = B.x + B.w * (k + 1) / (ms.length + 1), r = (26 + 10 * Math.cbrt(m)) * U, y = Math.max(0, h - .5 * g9 * τ * τ), py = gy - y * sc - r;
      for (let q = 0; q < Math.min(τ, tf); q += .06) { const yy = h - .5 * g9 * q * q; g.fillStyle = sk.ink; g.globalAlpha = .35; g.beginPath(); g.arc(x, gy - yy * sc - r, 4 * U, 0, 7); g.fill(); g.globalAlpha = 1; }
      ball(x, py, r, [sk.a, sk.b, sk.c][k], sk); txt(`${m} kg`, x, py + 10 * U, 26, '#111', 'center', F.inter, 900); });
    readout(sk, B, [`h = ${h} m`, `t = ${f2(Math.min(τ, tf))} s`, `v = ${f1(g9 * Math.min(τ, tf))} m/s`]);
    if (τ >= tf) { flash(s.flash || 'SAME TIME!', sk, B, τ - tf); txt(`t = √(2h/g) = ${f2(tf)} s`, W / 2, gy + 56 * U, 34, sk.ink); }
  };
  P.projectile = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), v = +s.v || 10, angs = (s.angles || [30, 45, 60]).slice(0, 4), cols = [sk.a, sk.acc, sk.b, sk.c];
    const R = a => v * v * Math.sin(2 * a * Math.PI / 180) / g9, Hm = a => (v * Math.sin(a * Math.PI / 180)) ** 2 / (2 * g9), Tf = a => 2 * v * Math.sin(a * Math.PI / 180) / g9;
    const maxR = Math.max(...angs.map(R)), maxH = Math.max(...angs.map(Hm)), x0 = B.x + B.w * .06, gy = B.y + B.h * .9, sc = Math.min((B.w * .88) / maxR, (gy - B.y - B.h * .25) / maxH);
    const τ = Math.max(0, lt - T0) * (s.speed || 1);
    g.strokeStyle = sk.ink; g.lineWidth = 4 * U; g.beginPath(); g.moveTo(B.x, gy); g.lineTo(B.x + B.w, gy); g.stroke();
    angs.forEach((a, k) => { const r = a * Math.PI / 180, vx = v * Math.cos(r), vy = v * Math.sin(r), tf = Tf(a), q = Math.min(τ, tf);
      g.fillStyle = cols[k]; for (let u = 0; u <= q; u += tf / 40) { const X = x0 + vx * u * sc, Y = gy - (vy * u - .5 * g9 * u * u) * sc; g.globalAlpha = .55; g.beginPath(); g.arc(X, Y, 4.5 * U, 0, 7); g.fill(); } g.globalAlpha = 1;
      const X = x0 + vx * q * sc, Y = gy - (vy * q - .5 * g9 * q * q) * sc; ball(X, Y - 14 * U, 14 * U, cols[k], sk);
      if (τ < tf && s.arrows !== false) arrow(X, Y - 14 * U, X + vx * 5 * U, Y - 14 * U - (vy - g9 * q) * 5 * U, cols[k], 4);
      if (τ >= tf) { g.fillStyle = cols[k]; g.fillRect(x0 + R(a) * sc - 3 * U, gy - 18 * U, 6 * U, 36 * U); txt(`${a}°: ${f1(R(a))} m`, x0 + R(a) * sc, gy + 46 * U + (k % 2) * 34 * U, 26, cols[k]); } });
    readout(sk, B, [`u = ${v} m/s`, `t = ${f2(Math.min(τ, Math.max(...angs.map(Tf))))} s`]);
    if (angs.includes(45) && τ >= Math.max(...angs.map(Tf))) flash(s.flash || '45° GOES FARTHEST', sk, B, τ - Math.max(...angs.map(Tf)));
  };
  P.pendulum = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), L = +s.L || 1, th0 = (+s.theta || 20) * Math.PI / 180, cx = W / 2, cy = B.y + B.h * .12, sc = B.h * .66 / L;
    // RK4 on theta'' = -(g/L) sin(theta), fixed step, from the start of the shot (exact enough for any amplitude)
    let th = th0, w = 0; const dt = 1 / 240, n = Math.floor(Math.max(0, lt - T0) / dt), f = (a) => -(g9 / L) * Math.sin(a);
    for (let k = 0; k < n; k++) { const k1 = w, l1 = f(th), k2 = w + l1 * dt / 2, l2 = f(th + k1 * dt / 2), k3 = w + l2 * dt / 2, l3 = f(th + k2 * dt / 2), k4 = w + l3 * dt, l4 = f(th + k3 * dt); th += dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4); w += dt / 6 * (l1 + 2 * l2 + 2 * l3 + l4); }
    g.strokeStyle = sk.ink; g.globalAlpha = .3; g.setLineDash([8 * U, 10 * U]); g.lineWidth = 3 * U; g.beginPath(); g.arc(cx, cy, L * sc, Math.PI / 2 - th0, Math.PI / 2 + th0); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    g.fillStyle = sk.ink; g.fillRect(cx - 90 * U, cy - 10 * U, 180 * U, 10 * U);
    const bx = cx + Math.sin(th) * L * sc, by = cy + Math.cos(th) * L * sc; g.strokeStyle = sk.ink; g.lineWidth = 3 * U; g.beginPath(); g.moveTo(cx, cy); g.lineTo(bx, by); g.stroke(); ball(bx, by, 30 * U, sk.b, sk);
    const T = 2 * Math.PI * Math.sqrt(L / g9);
    readout(sk, B, [`L = ${L} m`, `T = 2π√(L/g) = ${f2(T)} s`, `t = ${f2(n * dt)} s`]);
  };
  P.spring = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), k = +s.k || 20, m = +s.m || .5, A = +s.A || .3, om = Math.sqrt(k / m), T = 2 * Math.PI / om, τ = Math.max(0, lt - T0);
    const wallX = B.x + B.w * .08, eqX = B.x + B.w * .55, y = B.y + B.h * .55, sc = B.w * .22 / A, x = A * Math.cos(om * τ), bx = eqX + x * sc, bw = 110 * U;
    g.fillStyle = sk.ink; g.fillRect(wallX - 14 * U, y - 90 * U, 14 * U, 180 * U); g.fillRect(B.x, y + bw / 2, B.w, 5 * U);
    g.strokeStyle = sk.acc; g.lineWidth = 5 * U; g.beginPath(); const n = 14, x1 = bx - bw / 2; g.moveTo(wallX, y); for (let q = 1; q < n; q++) g.lineTo(wallX + (x1 - wallX) * q / n, y + (q % 2 ? -1 : 1) * 26 * U); g.lineTo(x1, y); g.stroke();
    g.fillStyle = sk.a; rr(bx - bw / 2, y - bw / 2, bw, bw, 10 * U); g.fill(); txt(`${m} kg`, bx, y + 12 * U, 28, '#111', 'center', F.inter, 900);
    g.strokeStyle = sk.ink; g.globalAlpha = .4; g.setLineDash([6 * U, 8 * U]); g.beginPath(); g.moveTo(eqX, y - 120 * U); g.lineTo(eqX, y + 120 * U); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; txt('x = 0', eqX, y - 132 * U, 24, sk.ink);
    arrow(bx, y - bw * .8, bx - A * Math.sin(om * τ) * om * 90 * U, y - bw * .8, sk.c, 4);
    readout(sk, B, [`k = ${k} N/m, m = ${m} kg`, `T = 2π√(m/k) = ${f2(T)} s`, `x = ${f2(x)} m`]);
  };
  P.collision = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), m1 = +s.m1 || 2, m2 = +s.m2 || 1, u1 = s.v1 != null ? +s.v1 : 3, u2 = +s.v2 || 0, e = s.e != null ? clamp(+s.e) : 1;
    const v1 = (m1 * u1 + m2 * u2 - m2 * e * (u1 - u2)) / (m1 + m2), v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / (m1 + m2);
    const r1 = (40 + 16 * Math.cbrt(m1)) * U, r2 = (40 + 16 * Math.cbrt(m2)) * U, y = B.y + B.h * .6, rel = Math.max(.2, u1 - u2), τ = Math.max(0, lt - T0);
    // world in metres: start 2.5 m apart; scale so both balls stay on screen for the whole shot
    const gapM = 2.5, tcM = gapM / rel, tEnd = Math.max(tcM + .5, d - T0), xs = [0, gapM, u1 * tcM + v1 * (tEnd - tcM), gapM + u2 * tcM + v2 * (tEnd - tcM)], lo = Math.min(...xs), hi = Math.max(...xs);
    const sc = Math.min(B.w * .3, (B.w - 2 * (r1 + r2) - 40 * U) / Math.max(.5, hi - lo)), gap0 = gapM * sc + r1 + r2, tc = tcM;
    const x10 = B.x + r1 + 20 * U + (0 - lo) * sc, x20 = x10 + gap0, after = τ > tc, dtA = Math.max(0, τ - tc);
    const x1 = after ? x10 + u1 * tc * sc + v1 * dtA * sc : x10 + u1 * τ * sc, x2 = after ? x20 + u2 * tc * sc + v2 * dtA * sc : x20 + u2 * τ * sc;
    g.fillStyle = sk.ink; g.fillRect(B.x, y + Math.max(r1, r2), B.w, 5 * U);
    ball(x1, y + Math.max(r1, r2) - r1, r1, sk.a, sk); ball(x2, y + Math.max(r1, r2) - r2, r2, sk.b, sk);
    txt(`${m1} kg`, x1, y + Math.max(r1, r2) - r1 + 10 * U, 26, '#111', 'center', F.inter, 900); txt(`${m2} kg`, x2, y + Math.max(r1, r2) - r2 + 10 * U, 26, '#111', 'center', F.inter, 900);
    const c1 = after ? v1 : u1, c2 = after ? v2 : u2; arrow(x1, y - r1 * 2 - 20 * U, x1 + c1 * 45 * U, y - r1 * 2 - 20 * U, sk.a, 5); arrow(x2, y - r2 * 2 - 20 * U, x2 + c2 * 45 * U, y - r2 * 2 - 20 * U, sk.b, 5);
    readout(sk, B, [after ? 'AFTER' : 'BEFORE', `v₁ = ${f2(c1)} m/s, v₂ = ${f2(c2)} m/s`, `p = ${f2(m1 * c1 + m2 * c2)} kg·m/s`, `e = ${e}`]);
    if (after) flash(s.flash || 'MOMENTUM SAME!', sk, B, dtA - .2);
  };
  P.incline = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt), th = (+s.angle || 30) * Math.PI / 180, mu = s.mu != null ? +s.mu : .2, a = g9 * (Math.sin(th) - mu * Math.cos(th)), slides = a > 0, Lm = 4, τ = Math.max(0, lt - T0);
    const len = Math.min(B.w * .9, (B.h * .75) / Math.sin(th)), x0 = B.x + B.w * .05 + (B.w * .9 - len * Math.cos(th)), ytop = B.y + B.h * .9 - len * Math.sin(th), xb = x0 + len * Math.cos(th), yb = B.y + B.h * .9;
    g.fillStyle = sk.card ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'; g.beginPath(); g.moveTo(x0, ytop); g.lineTo(xb, yb); g.lineTo(x0, yb); g.closePath(); g.fill(); g.strokeStyle = sk.ink; g.lineWidth = 4 * U; g.stroke();
    const sc = len / Lm, sMove = slides ? Math.min(Lm * .82, .5 * a * τ * τ) : 0, sPos = .3 + sMove, cx = x0 + sPos * sc * Math.cos(th), cy = ytop + sPos * sc * Math.sin(th), bs = 90 * U;
    g.save(); g.translate(cx, cy); g.rotate(th); g.fillStyle = sk.a; rr(-bs / 2, -bs, bs, bs, 8 * U); g.fill(); g.restore();
    txt(`${Math.round(th * 180 / Math.PI)}°`, xb - 80 * U, yb - 20 * U, 30, sk.ink);
    readout(sk, B, [`θ = ${Math.round(th * 180 / Math.PI)}°, μ = ${mu}`, slides ? `a = g(sinθ − μcosθ) = ${f2(a)} m/s²` : `tanθ = ${f2(Math.tan(th))} ≤ μ: stays at rest`]);
    if (!slides) flash(s.flash || 'NO SLIDING', sk, B, τ - .6);
  };

  // ---- Matter.js spectacle presets: fixed 1/120 s steps from the start of the shot, cached per shot ----
  const M = window.Matter, worlds = new Map(), DT = 1000 / 120;
  function world(s, build) {
    let w = worlds.get(s); if (!w) { const e = M.Engine.create(); e.gravity.y = 1; build(e); w = { e, steps: 0, build }; worlds.set(s, w); }
    return w;
  }
  const drawBodies = (e, sk, cols) => { const g = G(); for (const b of M.Composite.allBodies(e.world)) { if (b.render && b.render.visible === false) continue; g.beginPath(); b.vertices.forEach((v, k) => k ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)); g.closePath(); g.fillStyle = b.isStatic ? (sk.card ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.2)') : cols[b.id % cols.length]; g.fill(); g.lineWidth = 2.5 * U; g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke(); } };
  P.dominoes = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt); if (!M) return;
    const n = Math.min(24, +s.n || 14), gy = B.y + B.h * .85, wd = 18 * U, ht = 120 * U, gap = (B.w * .8) / n;
    const w = world(s, e => { M.Composite.add(e.world, M.Bodies.rectangle(W / 2, gy + 20 * U, W * 1.2, 40 * U, { isStatic: true }));
      for (let k = 0; k < n; k++) M.Composite.add(e.world, M.Bodies.rectangle(B.x + B.w * .1 + k * gap, gy - ht / 2, wd, ht, { friction: .4, density: .002 }));
      const first = M.Composite.allBodies(e.world)[1]; e._push = first; });
    const steps = Math.floor(Math.max(0, lt - T0) * 120);
    let ww = worlds.get(s) || w; if (steps < ww.steps) { worlds.delete(s); ww = world(s, w.build); }
    while (ww.steps < steps) { if (ww.steps === 0) M.Body.setAngularVelocity(ww.e._push, .08); M.Engine.update(ww.e, DT); ww.steps++; }   // the first domino gets one push
    drawBodies(ww.e, sk, [sk.a, sk.b, sk.acc, sk.c]);
    if (s.label) txt(s.label, W / 2, B.y + 60 * U, 40, sk.acc, 'center', F.anton, 400);
  };
  P.pile = (st, s, lt, d) => {
    const { g, sk, B } = frame(st, s, lt); if (!M) return;
    const n = Math.min(60, +s.n || 30), gy = B.y + B.h * .9;
    const w = world(s, e => { const o = { isStatic: true }; M.Composite.add(e.world, [M.Bodies.rectangle(W / 2, gy + 20 * U, B.w, 40 * U, o), M.Bodies.rectangle(B.x + B.w * .2, gy - 150 * U, 20 * U, 300 * U, o), M.Bodies.rectangle(B.x + B.w * .8, gy - 150 * U, 20 * U, 300 * U, o)]); e._k = 0; });
    const steps = Math.floor(Math.max(0, lt - T0) * 120);
    // drop one ball every 0.12 s from fixed spots (deterministic)
    let ww = worlds.get(s) || w; if (steps < ww.steps) { worlds.delete(s); ww = world(s, w.build); }
    while (ww.steps < steps) { if (ww.steps % 14 === 0 && ww.e._k < n) { const k = ww.e._k++; M.Composite.add(ww.e.world, M.Bodies.circle(W / 2 + ((k * 37) % 9 - 4) * 12 * U, B.y + 40 * U, (18 + (k % 3) * 6) * U, { restitution: .4, friction: .1 })); } M.Engine.update(ww.e, DT); ww.steps++; }
    drawBodies(ww.e, sk, [sk.a, sk.b, sk.acc, sk.c]); if (s.label) txt(s.label, W / 2, B.y + 60 * U, 40, sk.acc, 'center', F.anton, 400);
  };

  return { has: t => t === 'sim', draw: (st, s, lt, d) => (P[s.preset] || P.drop)(st, s, lt, d), presets: Object.keys(P) };
};
