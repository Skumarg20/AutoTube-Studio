#!/usr/bin/env node
// AutoTube Studio render worker. Takes videos from the studio's queue and makes them, several at once.
//
// On the studio PC it is started automatically by server.js.
// On another PC (same Wi-Fi/LAN): install AutoTube Studio + the style library there, then run
//   node worker.js --server http://<studio-PC-IP>:4747 --token <token from Settings > Workers> --name "Bedroom PC" --slots 2
//
// --slots     videos made at the same time on this PC (default 2)
// --browsers  browser windows drawing frames per video (default: this PC's Settings > Render workers)
// --parent    (internal) exit when that process id is gone
import './lib/env.js';
import fs from 'fs'; import path from 'path'; import os from 'os'; import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { spawn } from 'child_process';

// keep Windows from going to sleep while a video is being made (sleep froze renders and lost their place in the queue)
let awake = null;
function keepAwake(on) {
  if (process.platform !== 'win32') return;
  if (on && !awake) {
    const ps = `$s = Add-Type -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);' -Name P -Namespace W -PassThru; while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { [void]$s::SetThreadExecutionState([uint32]2147483649); Start-Sleep 20 }`;
    awake = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, stdio: 'ignore' });
    awake.on('exit', () => { awake = null; });
  } else if (!on && awake) { try { spawn('taskkill', ['/PID', String(awake.pid), '/T', '/F'], { windowsHide: true }); } catch {} awake = null; }
}
process.on('exit', () => keepAwake(false));

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SERVER = String(arg('server', 'http://127.0.0.1:4747')).replace(/\/$/, '');
const TOKEN = arg('token', process.env.HS_WORKER_TOKEN || '');
const NAME = arg('name', os.hostname());
const SLOTS = Math.max(1, +arg('slots', 2) || 2);
const PARENT = +arg('parent', 0);
const ID = (NAME + '-' + os.hostname()).replace(/[^\w-]/g, '_').slice(0, 60);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = m => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);

if (!TOKEN) { console.error('Missing --token (copy it from AutoTube Studio > Settings > Workers).'); process.exit(2); }
const store = await import('./lib/store.js');
const { buildVideoV2 } = await import('./lib/v2/build.js');
const JC = await import('./lib/jobctx.js');

async function call(p, body) {
  const r = await fetch(SERVER + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-worker-token': TOKEN }, body: JSON.stringify({ id: ID, name: NAME, slots: SLOTS, root: ROOT, browsers: +arg('browsers', 0) || undefined, ...body }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j;
}
async function download(jobId, rel) {
  const r = await fetch(`${SERVER}/jobs/${jobId}/${rel.split('/').map(encodeURIComponent).join('/')}`, { headers: { 'x-worker-token': TOKEN } });
  if (!r.ok) throw new Error(`download ${rel}: HTTP ${r.status}`);
  const f = path.join(ROOT, 'jobs', jobId, rel); fs.mkdirSync(path.dirname(f), { recursive: true });
  await new Promise((ok, bad) => { const ws = fs.createWriteStream(f); Readable.fromWeb(r.body).pipe(ws).on('finish', ok).on('error', bad); });
}
async function upload(jobId, rel) {
  const f = path.join(ROOT, 'jobs', jobId, rel); if (!fs.existsSync(f)) return;
  const r = await fetch(`${SERVER}/api/worker/upload/${jobId}?path=${encodeURIComponent(rel)}`, { method: 'PUT', headers: { 'x-worker-token': TOKEN, 'Content-Length': String(fs.statSync(f).size) }, body: await fs.openAsBlob(f) });
  if (!r.ok) throw new Error(`upload ${rel}: HTTP ${r.status}`);
}

const active = new Set();
let shared = false;
async function make(c) {
  const j = c.job, buf = []; active.add(j.id); keepAwake(true);
  const flush = async () => { if (!buf.length) return; const lines = buf.splice(0); try { await call('/api/worker/log', { jobId: j.id, lines }); } catch { buf.unshift(...lines); } };
  const timer = setInterval(flush, 2500);
  say(`making "${j.topic}" (${j.format})`);
  try {
    process.env.HS_RENDER_WORKERS = String(c.browsers || 2);
    if (shared) store.reloadSettings();
    else {
      // another PC: use the studio's production settings but keep this PC's own paths and CPU settings
      const mine = store.settings(); store.saveSettings({ ...c.settings, libraryPath: mine.libraryPath, renderWorkers: mine.renderWorkers, renderSlots: mine.renderSlots, workerToken: undefined });
      if (c.eleven) { fs.mkdirSync(path.join(ROOT, 'config'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'config', 'elevenlabs.json'), JSON.stringify(c.eleven, null, 2)); }
      for (const rel of c.inputs || []) await download(j.id, rel);
    }
    const files = await JC.run(j.id, () => buildVideoV2(j, m => buf.push(m)));
    if (!shared) {
      buf.push('sending the finished video to the studio');
      const dir = path.join(ROOT, 'jobs', j.id), extra = fs.existsSync(path.join(dir, 'img')) ? fs.readdirSync(path.join(dir, 'img')).filter(f => f.endsWith('.jpg')).map(f => 'img/' + f) : [];
      for (const rel of ['final.mp4', 'thumb.jpg', 'captions.srt', 'timeline.js', 'lines.json', 'CREDITS.txt', ...extra]) await upload(j.id, rel);
    }
    await flush(); await call('/api/worker/done', { jobId: j.id, files }); say(`done "${j.topic}"`);
  } catch (e) {
    if (e.cancelled || JC.isCancelled(j.id)) { buf.length = 0; say(`stopped "${j.topic}" (put on hold or removed in the studio)`); return; }
    await flush(); try { await call('/api/worker/done', { jobId: j.id, error: e.message }); } catch {} say(`failed "${j.topic}": ${e.message.slice(0, 200)}`);
  } finally { clearInterval(timer); active.delete(j.id); if (!active.size) keepAwake(false); }
}

async function slot(k) {
  await sleep(k * 1500);
  for (;;) {
    try { const c = await call('/api/worker/claim', {}); if (c.job) { await make(c); continue; } } catch (e) { if (!/fetch failed|ECONNREFUSED/.test(e.message)) say('claim: ' + e.message); }
    await sleep(3000);
  }
}

// start: introduce ourselves (retry until the studio answers), then keep our videos' leases alive
for (let k = 0; ; k++) { try { const h = await call('/api/worker/hello', {}); shared = !!h.shared; break; } catch (e) { if (k % 10 === 0) say(`waiting for the studio at ${SERVER} (${e.message})`); await sleep(3000); } }
say(`worker "${NAME}" ready: ${SLOTS} video(s) at once, ${shared ? 'same folder as the studio' : 'files sent over the network'}`);
// the studio answers with the videos it no longer wants made (put on hold, deleted): stop exactly those
setInterval(async () => { try { const r = await call('/api/worker/heartbeat', { jobs: [...active] }); for (const id of r.cancel || []) if (JC.cancel(id)) say(`stopping ${id}: the studio no longer wants it made`); } catch {} }, 15000);
if (PARENT) setInterval(() => { try { process.kill(PARENT, 0); } catch { process.exit(0); } }, 5000);
for (let k = 0; k < SLOTS; k++) slot(k);
