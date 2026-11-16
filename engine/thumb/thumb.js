// YouTube thumbnail (1280x720): striking photo, huge 2-4 word headline, red circle + arrow on the subject, channel badge.
(function () {
  const T = window.THUMB || {}, cv = document.getElementById('c'), W = innerWidth, H = innerHeight; cv.width = W; cv.height = H; const g = cv.getContext('2d'), U = H / 720;
  window.DUR = 1;
  const im = new Image(); let ok = false; const loaded = new Promise(r => { im.onload = () => { ok = true; r(); }; im.onerror = r; }); if (T.img) im.src = T.img;
  function fit(txt, max, maxW) { let s = max; g.font = `400 ${s}px Anton, Impact, sans-serif`; while (g.measureText(txt).width > maxW && s > 20) { s -= 4; g.font = `400 ${s}px Anton, Impact, sans-serif`; } return s; }
  window.render = function () {
    const [fx, fy] = T.focus || [.62, .42];
    g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
    // place the photo so its subject lands on the right third (text goes left)
    let sx = W * .72, sy = H * .45;
    if (ok) { const s = Math.max(W / im.width, H / im.height) * 1.18, iw = im.width * s, ih = im.height * s; let ox = W * .72 - fx * iw, oy = H * .45 - fy * ih; ox = Math.min(0, Math.max(W - iw, ox)); oy = Math.min(0, Math.max(H - ih, oy)); sx = ox + fx * iw; sy = oy + fy * ih; g.filter = 'contrast(1.18) saturate(1.25) brightness(1.02)'; g.drawImage(im, ox, oy, iw, ih); g.filter = 'none'; }
    // readability: dark gradient behind the text side
    const textLeft = true, gr = g.createLinearGradient(textLeft ? 0 : W, 0, textLeft ? W * .75 : W * .25, 0); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const v = g.createRadialGradient(W / 2, H / 2, H * .4, W / 2, H / 2, W * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    // subject: red circle
    const cx = Math.max(sx, W * .66), cy = sy, r = H * .19;
    g.save(); g.strokeStyle = '#ff2a2a'; g.lineWidth = 12 * U; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 14 * U; g.beginPath(); g.ellipse(cx, cy, r * 1.15, r, -.1, 0, 6.29); g.stroke(); g.restore();
    // headline
    const words = String(T.text || '').toUpperCase().split(/\s+/).filter(Boolean); const lines = []; if (words.length <= 2) lines.push(...words); else { const half = Math.ceil(words.length / 2); lines.push(words.slice(0, half).join(' '), words.slice(half).join(' ')); }
    const tx = 46 * U, tw = Math.min(W * .52, cx - r * 1.3 - 70 * U); let y = H * .2;
    lines.forEach((ln, i) => { const s = fit(ln, 190 * U, tw); y += s * .92; g.save(); g.font = `400 ${s}px Anton, Impact, sans-serif`; g.textAlign = 'left'; g.lineJoin = 'round'; g.lineWidth = s * .14; g.strokeStyle = '#000'; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 20 * U; g.strokeText(ln, tx, y); g.shadowBlur = 0; g.fillStyle = i % 2 ? '#ffd400' : '#ffffff'; g.fillText(ln, tx, y); g.restore(); y += s * .1; });
    // arrow from the text to the subject
    const ax0 = tx + tw * .45, ay0 = Math.min(H * .9, y + 36 * U), ax1 = cx - r * 1.12, ay1 = cy + r * .35;
    g.save(); g.strokeStyle = '#ff2a2a'; g.fillStyle = '#ff2a2a'; g.lineWidth = 16 * U; g.lineCap = 'round'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12 * U; const mx = (ax0 + ax1) / 2, my = Math.max(ay0, ay1) + 60 * U; g.beginPath(); g.moveTo(ax0, ay0); g.quadraticCurveTo(mx, my, ax1, ay1); g.stroke();
    const an = Math.atan2(ay1 - my, ax1 - mx), L = 46 * U; g.beginPath(); g.moveTo(ax1 + Math.cos(an) * 10 * U, ay1 + Math.sin(an) * 10 * U); g.lineTo(ax1 - Math.cos(an - .5) * L, ay1 - Math.sin(an - .5) * L); g.lineTo(ax1 - Math.cos(an + .5) * L, ay1 - Math.sin(an + .5) * L); g.closePath(); g.fill(); g.restore();
    // channel badge
    if (T.channel) { g.font = `700 ${26 * U}px Inter, Arial, sans-serif`; const bw = g.measureText(T.channel.toUpperCase()).width + 30 * U; g.fillStyle = '#d24a1f'; g.fillRect(W - bw - 24 * U, H - 66 * U, bw, 44 * U); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(T.channel.toUpperCase(), W - bw - 9 * U, H - 35 * U); }
  };
  Promise.all([document.fonts.ready, loaded, document.fonts.load('400 80px Anton'), document.fonts.load('700 30px Inter')]).then(() => { window.render(0); window.READY = true; });
})();
