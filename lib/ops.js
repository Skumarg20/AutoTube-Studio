// Production helpers: dashboard login for other devices, daily backups, disk clean-up, health check.
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import { ROOT, settings, saveSettings, db, save } from './store.js';

// ---------- login (only when a password was set with: node tools/set-password.js) ----------
const COOKIE = 'hs_session', DAYS = 30;
export const loginOn = () => !!(settings().remote && settings().remote.hash);
export function setPassword(pw) {
  if (!pw || pw.length < 10) throw new Error('use at least 10 characters');
  const salt = crypto.randomBytes(16).toString('hex'), hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  saveSettings({ remote: { salt, hash, secret: crypto.randomBytes(32).toString('hex') } });   // new secret = everyone is signed out
}
export function clearPassword() { saveSettings({ remote: null }); }
const sign = v => crypto.createHmac('sha256', settings().remote.secret).update(v).digest('hex');
function checkPw(pw) {
  const r = settings().remote; if (!r || typeof pw !== 'string') return false;
  const h = crypto.scryptSync(pw, r.salt, 64), want = Buffer.from(r.hash, 'hex');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(a => a[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])); }
export function signedIn(req) {
  if (!loginOn()) return false;
  const c = cookies(req)[COOKIE]; if (!c) return false;
  const [exp, mac] = c.split('.'); if (!exp || !mac || +exp < Date.now()) return false;
  const want = sign(exp); return mac.length === want.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want));
}
// a request is "local" only if it comes straight from this machine and not through a proxy
export function isLocal(req) {
  const h = req.headers;   // anything that came through a proxy or the Cloudflare tunnel is NOT local
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !h['x-forwarded-for'] && !h['x-real-ip'] && !h['cf-connecting-ip'] && !h['cf-ray'];
}
const fails = new Map();   // ip -> [times]
function ipOf(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
const PAGE = msg => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>AutoTube Studio</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c0f;color:#e8e6e1;font:16px system-ui,sans-serif}form{display:grid;gap:12px;width:min(320px,90vw)}
input,button{font:inherit;padding:12px 14px;border-radius:10px;border:1px solid #333;background:#16181d;color:inherit}button{background:#e8b04a;color:#111;border:0;font-weight:600;cursor:pointer}p{margin:0;color:#e57373}</style>
<form method=post action=/login><h2 style="margin:0 0 6px">AutoTube Studio</h2>${msg ? `<p>${msg}</p>` : ''}<input type=password name=password placeholder=Password autofocus autocomplete=current-password><button>Sign in</button></form>`;
// returns true when it answered the request
export async function loginRoute(req, res, p, readBody) {
  if (p === '/logout') { res.writeHead(302, { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0`, Location: '/login' }); res.end(); return true; }
  if (p !== '/login') return false;
  if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(PAGE('')); return true; }
  const ip = ipOf(req), now = Date.now(), recent = (fails.get(ip) || []).filter(t => now - t < 15 * 60e3);
  if (recent.length >= 5) { res.writeHead(429, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(PAGE('Too many tries. Wait 15 minutes.')); return true; }
  const raw = await readBody(); const pw = new URLSearchParams(raw).get('password') || '';
  if (!checkPw(pw)) { recent.push(now); fails.set(ip, recent); console.log(`login: wrong password from ${ip}`); res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(PAGE('Wrong password.')); return true; }
  fails.delete(ip);
  const exp = String(now + DAYS * 864e5), secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  res.writeHead(302, { 'Set-Cookie': `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DAYS * 86400}${secure}`, Location: '/' }); res.end(); return true;
}
// a signed-in browser on another device: block cross-site form posts (CSRF)
export function sameOrigin(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const o = req.headers.origin || req.headers.referer; if (!o) return true;
  try { return new URL(o).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
}

// ---------- backups: data/db.json + config/*.json, once a day, keep 14 ----------
const BK = path.join(ROOT, 'data', 'backups');
export function backup(force = false) {
  try {
    const day = new Date().toISOString().slice(0, 10), dir = path.join(BK, day);
    if (fs.existsSync(dir) && !force) return null;
    fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
    save();
    fs.copyFileSync(path.join(ROOT, 'data', 'db.json'), path.join(dir, 'db.json'));
    for (const f of fs.readdirSync(path.join(ROOT, 'config'))) { const s = path.join(ROOT, 'config', f); if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(dir, 'config', f)); }
    for (const f of ['youtube_token.json', 'meta_pages.json']) { const s = path.join(ROOT, 'data', f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(dir, f)); }
    const CH = path.join(ROOT, 'channels');   // per-channel sign-ins (channels/<id>/config|data/*.json)
    if (fs.existsSync(CH)) for (const c of fs.readdirSync(CH)) for (const sub of ['config', 'data']) { const d = path.join(CH, c, sub); if (!fs.existsSync(d)) continue; const to = path.join(dir, 'channels', c, sub); fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) fs.copyFileSync(path.join(d, f), path.join(to, f)); }
    const old = fs.readdirSync(BK).filter(d => /^\d{4}-\d\d-\d\d$/.test(d)).sort().slice(0, -14);
    for (const d of old) fs.rmSync(path.join(BK, d), { recursive: true, force: true });
    return dir;
  } catch (e) { console.log('backup failed: ' + e.message); return null; }
}

// ---------- disk clean-up: the out/ folder (raw picture + sound before mixing, ~0.7 GB per long video) ----------
// kept until the video is published (or rejected) and a few days have passed; final.mp4, plan, voices and images are always kept.
export function cleanup({ days = settings().keepWorkDays ?? 3, dry = false } = {}) {
  let freed = 0, n = 0; const cut = Date.now() - days * 864e5;
  for (const j of db().jobs) {
    if (!['published', 'rejected'].includes(j.status) || (j.updatedAt || 0) > cut) continue;
    const out = path.join(ROOT, 'jobs', j.id, 'out'); if (!fs.existsSync(out)) continue;
    freed += dirSize(out); n++; if (!dry) fs.rmSync(out, { recursive: true, force: true });
  }
  return { jobs: n, freedGB: +(freed / 1e9).toFixed(2) };
}
function dirSize(d) { let s = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); s += e.isDirectory() ? dirSize(f) : fs.statSync(f).size; } return s; }
export function freeGB(p = ROOT) { try { const s = fs.statfsSync(p); return +(s.bavail * s.bsize / 1e9).toFixed(1); } catch { return null; } }

// ---------- daily housekeeping ----------
export function startHousekeeping(note) {
  const tick = () => {
    const b = backup(); if (b) note('backup saved: ' + path.relative(ROOT, b));
    const c = cleanup(); if (c.jobs) note(`clean-up: removed work files of ${c.jobs} finished video(s), ${c.freedGB} GB freed`);
    const free = freeGB(); if (free !== null && free < 15) note(`WARNING: only ${free} GB free on the disk. Videos need ~1 GB each; free some space.`);
  };
  setTimeout(tick, 60e3); setInterval(tick, 6 * 3600e3);
}
