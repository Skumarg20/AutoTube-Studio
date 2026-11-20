// Public link through a Cloudflare Tunnel (outbound only, so no ports have to be opened on the server).
//   HS_TUNNEL=quick (default when cloudflared is present): free random https://<words>.trycloudflare.com link, new on every start
//   CLOUDFLARE_TUNNEL_TOKEN=...: your own named tunnel / fixed domain (set HS_PUBLIC_URL so the studio can show it)
//   HS_TUNNEL=off: none
// The dashboard only opens through the link when a password is set (node tools/set-password.js).
import fs from 'fs'; import path from 'path'; import os from 'os'; import { spawn, execFileSync } from 'child_process';
import { ROOT } from './store.js';

let url = null, proc = null, stopping = false;
export const publicUrl = () => url;
const FILE = path.join(ROOT, 'data', 'public-url.txt');

function findCloudflared() {
  const local = path.join(ROOT, 'tools', 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  if (fs.existsSync(local)) return local;
  try { execFileSync(process.platform === 'win32' ? 'where' : 'which', ['cloudflared'], { stdio: 'ignore' }); return 'cloudflared'; } catch { return null; }
}

function publish(u, note) {
  url = u; note(`public link: ${u}`);
  try { fs.writeFileSync(FILE, u + '\r\n'); } catch {}
  if (process.platform === 'win32') {   // a clickable shortcut on the server's desktop, refreshed on every start
    for (const d of [path.join(os.homedir(), 'Desktop'), 'C:\\Users\\Public\\Desktop']) {
      try { if (fs.existsSync(d)) { fs.writeFileSync(path.join(d, 'AutoTube Studio link.url'), `[InternetShortcut]\r\nURL=${u}\r\n`); break; } } catch {}
    }
  }
}

export function startTunnel(port, note, loginOn) {
  const mode = (process.env.HS_TUNNEL || 'quick').toLowerCase(), token = process.env.CLOUDFLARE_TUNNEL_TOKEN;
  if (mode === 'off' && !token) return;
  const exe = findCloudflared();
  if (!exe) { if (token || process.env.HS_TUNNEL) note('public link: cloudflared is not installed (deploy\\setup-server.ps1 installs it into tools\\bin)'); return; }
  if (!loginOn()) note('public link: WARNING no dashboard password is set, so the link only shows "set a password". Run: node tools\\set-password.js');
  const args = token ? ['tunnel', '--no-autoupdate', 'run', '--token', token] : ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`];
  let fails = 0;
  const run = () => {
    if (stopping) return;
    const t0 = Date.now();
    proc = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    if (token && process.env.HS_PUBLIC_URL) publish(process.env.HS_PUBLIC_URL.replace(/\/$/, ''), note);
    const scan = d => { const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(d)); if (m && m[0] !== url) publish(m[0], note); };
    proc.stdout.on('data', scan); proc.stderr.on('data', scan);
    proc.on('exit', code => {
      proc = null; if (stopping) return;
      fails = Date.now() - t0 < 60e3 ? fails + 1 : 0;
      const wait = Math.min(300, 10 * 2 ** Math.min(fails, 5));
      note(`public link: tunnel stopped (code ${code}); reconnecting in ${wait} s`);
      setTimeout(run, wait * 1000);
    });
  };
  run();
}
export function stopTunnel() { stopping = true; try { if (proc) { if (process.platform === 'win32') spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true }); else proc.kill(); } } catch {} }
