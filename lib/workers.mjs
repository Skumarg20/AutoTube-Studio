// Render queue + worker pool.
// Videos waiting to be made sit in db.jobs with status "queued_render". Worker processes (worker.mjs) on this PC
// or on other PCs ask for the next one (Shorts first), report progress, and hand back the finished files.
// A worker that stops answering loses its videos after a short lease; they go back into the queue.
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import os from 'os'; import { spawn } from 'child_process';
import { ROOT, db, save, job, settings, saveSettings } from './store.mjs';

const LEASE_MS = 10 * 60 * 1000;     // a worker must check in at least this often per video (directing a video can keep a PC very busy)
const MAX_TRIES = 3;                 // a video that crashes workers this many times is marked failed
const workers = new Map();           // id -> { id, name, host, slots, jobs: [], lastSeen, shared }
let hooks = null;                    // { setStatus, jlog, onRendered, note }

export function init(h) { hooks = h; setInterval(expireLeases, 15 * 1000); }
export function token() { let t = settings().workerToken; if (!t) { t = crypto.randomBytes(18).toString('base64url'); saveSettings({ workerToken: t }); } return t; }
export const authOk = req => req.headers['x-worker-token'] === token();

// order: Shorts first (they are quick and often waited for), then whatever has waited longest
function nextJob(busy = [], longBusy = false) {   // never hand out a video some worker is still building; at most settings.longsPerPC (2) long videos per PC, so a Short slot stays free
  return db().jobs.filter(j => j.status === 'queued_render' && !busy.includes(j.id) && !(longBusy && j.format === 'long'))
    .sort((a, b) => (a.format === 'short' ? 0 : 1) - (b.format === 'short' ? 0 : 1) || (a.queuedAt || a.updatedAt || 0) - (b.queuedAt || b.updatedAt || 0))[0];
}
export function queued(j) { j.queuedAt = Date.now(); delete j.lease; }
export function stats() {
  const J = db().jobs;
  return { rendering: J.filter(j => j.status === 'rendering').length, waiting: J.filter(j => j.status === 'queued_render').length,
    workers: [...workers.values()].filter(w => Date.now() - w.lastSeen < 60e3).map(w => ({ id: w.id, name: w.name, host: w.host, slots: w.slots, shared: w.shared, jobs: w.jobs, lastSeen: w.lastSeen })) };
}
function seen(b, req) {
  const w = workers.get(b.id) || { id: b.id, jobs: [] };
  Object.assign(w, { name: b.name || w.name || b.id, slots: +b.slots || w.slots || 1, host: (req.socket.remoteAddress || '').replace('::ffff:', ''), lastSeen: Date.now() });
  if (b.root) w.shared = path.resolve(b.root).toLowerCase() === path.resolve(ROOT).toLowerCase();
  workers.set(b.id, w); return w;
}
let lastTick = Date.now();
function expireLeases() {
  const now = Date.now(), gap = now - lastTick; lastTick = now;
  // the PC was asleep (this timer runs every 15 s): every worker was frozen too, so give them a fresh lease instead of
  // throwing their videos back into the queue (that restarted finished videos from scratch)
  if (gap > 60 * 1000) { for (const j of db().jobs.filter(j => j.status === 'rendering' && j.lease)) j.lease.until = now + LEASE_MS; save(); return; }
  for (const j of db().jobs.filter(j => j.status === 'rendering' && j.lease && j.lease.until < now)) {
    j.renderTries = (j.renderTries || 0) + 1;
    if (j.renderTries >= MAX_TRIES) hooks.setStatus(j, 'failed', `render failed: worker "${j.lease.name}" stopped responding ${j.renderTries} times`);
    else { hooks.setStatus(j, 'queued_render', `worker "${j.lease.name}" stopped responding; back in the queue`); queued(j); }
    delete j.lease; save();
  }
}

// files a worker on ANOTHER PC needs before it can build: the creator's own media and voice recording
function inputs(j) {
  const dir = path.join(ROOT, 'jobs', j.id), out = [];
  const walk = rel => { const p = path.join(dir, rel); if (!fs.existsSync(p)) return; for (const f of fs.readdirSync(p, { withFileTypes: true })) { const r = rel ? rel + '/' + f.name : f.name; if (f.isDirectory()) walk(r); else out.push(r); } };
  walk('media'); if (j.voiceFile && fs.existsSync(path.join(dir, j.voiceFile))) out.push(j.voiceFile);
  return out;
}
const safeRel = r => { const n = path.posix.normalize(String(r || '').replace(/\\/g, '/')); return n && !n.startsWith('..') && !path.isAbsolute(n) && !n.includes('\0') ? n : null; };

// HTTP API for workers: returns true when it handled the request
export async function handle(req, res, p, readBody, send) {
  if (!p.startsWith('/api/worker/')) return false;
  if (!authOk(req)) { send(res, 403, { error: 'bad worker token' }); return true; }
  const a = p.slice('/api/worker/'.length);
  if (a.startsWith('upload/') && req.method === 'PUT') {   // a remote worker sends back a finished file
    const id = a.slice(7), j = job(id), rel = safeRel(new URL(req.url, 'http://x').searchParams.get('path'));
    if (!j || !rel) { send(res, 400, { error: 'bad upload' }); return true; }
    const f = path.join(ROOT, 'jobs', id, rel); fs.mkdirSync(path.dirname(f), { recursive: true });
    const ws = fs.createWriteStream(f + '.part'); req.pipe(ws); await new Promise((ok, bad) => { ws.on('finish', ok); ws.on('error', bad); });
    fs.renameSync(f + '.part', f); send(res, 200, { ok: true }); return true;
  }
  const b = await readBody(req), w = seen(b, req);
  if (a === 'hello') { send(res, 200, { ok: true, shared: w.shared, serverRoot: ROOT }); return true; }
  if (a === 'claim') {
    const busyIds = [...workers.values()].flatMap(x => x.jobs || []), j = nextJob(busyIds, (w.jobs || []).filter(id => { const x = db().jobs.find(q => q.id === id); return x && x.format === 'long' && x.status === 'rendering'; }).length >= Math.max(1, +settings().longsPerPC || 2)); if (!j) { send(res, 200, { job: null }); return true; }
    j.lease = { worker: w.id, name: w.name, until: Date.now() + LEASE_MS }; w.jobs = [...new Set([...w.jobs, j.id])];
    hooks.setStatus(j, 'rendering', `being made on "${w.name}"`);
    const st = settings(), voice = String(j.voice || st.voice || '');
    let eleven = null; if (!w.shared && voice.startsWith('eleven:')) { try { eleven = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'elevenlabs.json'), 'utf8')); } catch {} }
    send(res, 200, { job: j, settings: st, eleven, inputs: w.shared ? [] : inputs(j), browsers: +b.browsers || st.renderWorkers || 2 }); return true;
  }
  if (a === 'heartbeat') {
    const cancel = [];
    for (const id of b.jobs || []) { const j = job(id); if (j && j.status === 'rendering' && j.lease && j.lease.worker === w.id) j.lease.until = Date.now() + LEASE_MS; else cancel.push(id); }
    w.jobs = (b.jobs || []).filter(id => !cancel.includes(id)); send(res, 200, { ok: true, cancel }); return true;
  }
  if (a === 'log') { const j = job(b.jobId); if (j && j.lease && j.lease.worker === w.id) { for (const l of (b.lines || []).slice(0, 200)) hooks.jlog(j, String(l).slice(0, 400)); j.lease.until = Date.now() + LEASE_MS; j.updatedAt = Date.now(); save(); } send(res, 200, { ok: true }); return true; }
  if (a === 'done') {
    const j = job(b.jobId); w.jobs = w.jobs.filter(x => x !== b.jobId);
    // a finished video is kept even if its lease ran out meanwhile, as long as nobody else has started it again
    const late = j && !b.error && (j.status === 'queued_render' || (j.status === 'rendering' && j.lease && j.lease.worker === w.id));
    if (!j || (!late && (!j.lease || j.lease.worker !== w.id))) { send(res, 200, { ok: false, error: 'not your job any more' }); return true; }
    delete j.lease;
    if (b.error) { j.renderTries = (j.renderTries || 0) + 1; hooks.setStatus(j, 'failed', 'render failed: ' + String(b.error).slice(0, 500)); }
    else { j.files = b.files; delete j.renderTries; hooks.onRendered(j); }
    save(); send(res, 200, { ok: true }); return true;
  }
  send(res, 404, { error: 'unknown worker call' }); return true;
}

// the worker on this PC: started with the server, restarted if it crashes, stopped with the server
let local = null, stopping = false;
export function startLocal(port) {
  if (settings().localWorker === false) return;
  const args = [path.join(ROOT, 'worker.mjs'), '--server', `http://127.0.0.1:${port}`, '--name', 'This PC', '--slots', String(settings().renderSlots || 2), '--parent', String(process.pid)];
  local = spawn(process.execPath, args, { cwd: ROOT, windowsHide: true, env: { ...process.env, HS_WORKER_TOKEN: token() }, stdio: ['ignore', 'pipe', 'pipe'] });
  local.stdout.on('data', d => String(d).split(/\r?\n/).filter(Boolean).forEach(l => hooks.note('worker: ' + l.slice(0, 200))));
  local.stderr.on('data', d => String(d).split(/\r?\n/).filter(x => /error|fail/i.test(x)).forEach(l => hooks.note('worker error: ' + l.slice(0, 200))));
  local.on('exit', c => { local = null; if (!stopping) { hooks.note(`worker on this PC stopped (${c}); restarting in 5 s`); setTimeout(() => startLocal(port), 5000); } });
}
export function restartLocal(port) { if (local) local.kill(); else startLocal(port); }   // the exit handler starts a fresh one
export function stopLocal() { stopping = true; if (local) try { local.kill(); } catch {} }
export function lanAddresses() { return Object.values(os.networkInterfaces()).flat().filter(x => x && x.family === 'IPv4' && !x.internal).map(x => x.address); }
