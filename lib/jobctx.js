// Which video a running program belongs to, so ONE video can be stopped (Hold, Delete) without touching the others
// the worker is making at the same time. The worker runs each build inside run(jobId, fn); every program the build
// starts (Claude, the renderer, ffmpeg, Python) is registered with track(); cancel(jobId) stops that video's programs.
import { AsyncLocalStorage } from 'async_hooks';
import { spawn } from 'child_process';

const als = new AsyncLocalStorage(), jobs = new Map();
export class Cancelled extends Error { constructor(id) { super('stopped: the video was put on hold or removed'); this.cancelled = true; this.jobId = id; } }

export function run(jobId, fn) { const st = { jobId, procs: new Set(), cancelled: false }; jobs.set(jobId, st); return als.run(st, fn).finally(() => jobs.delete(jobId)); }
export function current() { return als.getStore() || null; }
export function check() { const st = als.getStore(); if (st && st.cancelled) throw new Cancelled(st.jobId); }
function killTree(p) { try { if (process.platform === 'win32') spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { windowsHide: true }); else p.kill('SIGKILL'); } catch {} }
export function track(p) {
  const st = als.getStore(); if (!st || !p) return p;
  if (st.cancelled) { killTree(p); return p; }
  st.procs.add(p); p.on('exit', () => st.procs.delete(p));
  return p;
}
export function cancel(jobId) {
  const st = jobs.get(jobId); if (!st || st.cancelled) return false;
  st.cancelled = true; for (const p of st.procs) killTree(p); st.procs.clear();
  return true;
}
export const isCancelled = jobId => !!jobs.get(jobId)?.cancelled;
