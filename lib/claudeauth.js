// Claude connection for the dashboard (Settings > Claude). Two ways, like Claude Code itself:
//   1. a Claude account (Pro/Max/Team): `claude auth login` on THIS computer (opens the browser), usage comes from the plan
//   2. an Anthropic API key: saved in config/.env as ANTHROPIC_API_KEY, billed per use; it wins over the account
// Never returns the key, the account's email or tokens to the dashboard: only whether they are there.
import fs from 'fs'; import path from 'path'; import { spawn, execFile } from 'child_process';
import { ROOT } from './store.js';
import { askClaudeOnce } from './claude.js';

const ENV = path.join(ROOT, 'config', '.env'), WIN = process.platform === 'win32';
let cache = null, cacheAt = 0, loginProc = null;

function cli(args, timeout = 20000) {
  return new Promise(res => execFile('claude', args, { shell: WIN, windowsHide: true, timeout }, (e, out, err) => res({ ok: !e, out: String(out || ''), err: String(err || (e && e.message) || '') })));
}

export async function status(fresh = false) {
  if (!fresh && cache && Date.now() - cacheAt < 30e3) return cache;
  const s = { installed: false, loggedIn: false, method: null, plan: null, apiKey: !!process.env.ANTHROPIC_API_KEY, signingIn: !!loginProc };
  const v = await cli(['--version'], 15000);
  if (v.ok) {
    s.installed = true; s.version = v.out.trim().split(/\s/)[0];
    const r = await cli(['auth', 'status', '--json']);
    try { const j = JSON.parse(r.out); s.loggedIn = !!j.loggedIn; s.method = j.authMethod || null; s.plan = j.subscriptionType || j.planTier || null; } catch {}
  }
  s.ready = s.installed && (s.apiKey || s.loggedIn);
  cache = s; cacheAt = Date.now(); return s;
}

// opens Claude's sign-in in a window on the computer that runs the studio (the browser opens there)
export function login(mode = 'claudeai') {
  const flag = mode === 'console' ? '--console' : '--claudeai';
  // a visible window, so the owner sees what Claude asks; it stays open with the result
  const p = WIN
    ? spawn('cmd.exe', ['/c', 'start', '"Sign in to Claude"', 'cmd', '/k', `claude auth login ${flag} && echo. && echo Signed in. You can close this window and go back to AutoTube Studio.`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true })
    : spawn('claude', ['auth', 'login', flag], { stdio: 'ignore', detached: true });
  p.on('error', () => {}); p.unref();
  loginProc = true; setTimeout(() => { loginProc = null; }, 5 * 60e3); cache = null;
  return { started: true };
}

export async function logout() { const r = await cli(['auth', 'logout']); cache = null; return { ok: r.ok }; }

// save (or with '' remove) the API key in config/.env, keeping every other line; takes effect at once
export function setKey(key) {
  key = String(key || '').trim();
  if (key && !/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(key)) throw new Error('That does not look like an Anthropic API key (it starts with sk-ant-).');
  let lines = []; try { lines = fs.readFileSync(ENV, 'utf8').replace(/^﻿/, '').split(/\r?\n/); } catch {}
  let hit = false;
  lines = lines.map(l => /^\s*#?\s*ANTHROPIC_API_KEY\s*=/.test(l) ? (hit = true, `ANTHROPIC_API_KEY=${key}`) : l);
  if (!hit) lines.push(`ANTHROPIC_API_KEY=${key}`);
  fs.mkdirSync(path.dirname(ENV), { recursive: true }); fs.writeFileSync(ENV, lines.join('\r\n'));
  if (key) process.env.ANTHROPIC_API_KEY = key; else delete process.env.ANTHROPIC_API_KEY;
  cache = null; return { apiKey: !!key };
}

// one tiny real request, so the owner knows planning will work
export async function test() {
  const t0 = Date.now();
  try { const r = await askClaudeOnce('Reply with exactly the word OK and nothing else.', { timeoutMs: 120e3 }); return { ok: /ok/i.test(String(r)), seconds: Math.round((Date.now() - t0) / 1000) }; }
  catch (e) { return { ok: false, error: String(e.message || e).replace(/sk-ant-[A-Za-z0-9_\-]+/g, 'sk-ant-…').slice(0, 300) }; }
}
