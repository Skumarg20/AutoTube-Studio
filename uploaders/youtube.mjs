#!/usr/bin/env node
// YouTube uploader (YouTube Data API v3). No dependencies; Node 18+ built-in fetch.
//
//   node uploaders/youtube.mjs auth
//   node uploaders/youtube.mjs upload <video.mp4> <meta.json>
//   node uploaders/youtube.mjs status
//
// Contract: the LAST stdout line is always one JSON object ({"ok":true,...} or
// {"ok":false,...}). Progress/diagnostics go to stderr. Exit code 0 = ok, 1 = failure.
//
// Test-only overrides (never needed in normal use):
//   HS_UPLOADER_ROOT  project root (default: parent folder of uploaders/)
//   YT_TOKEN_URL      default https://oauth2.googleapis.com/token
//   YT_API_BASE       default https://www.googleapis.com/youtube/v3
//   YT_UPLOAD_BASE    default https://www.googleapis.com/upload/youtube/v3
//   YT_CHUNK_SIZE     bytes per chunk (default 8 MiB; must be a multiple of 256 KiB)
//   YT_NO_BROWSER=1   do not try to open the browser during auth

import http, { createServer } from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, open, stat, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PLATFORM = 'youtube';
const ROOT = process.env.HS_UPLOADER_ROOT
  ? path.resolve(process.env.HS_UPLOADER_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_FILE = path.join(ROOT, 'config', 'youtube_client.json');
const TOKEN_FILE = path.join(ROOT, 'data', 'youtube_token.json');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = process.env.YT_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const API_BASE = (process.env.YT_API_BASE || 'https://www.googleapis.com/youtube/v3').replace(/\/$/, '');
const UPLOAD_BASE = (process.env.YT_UPLOAD_BASE || 'https://www.googleapis.com/upload/youtube/v3').replace(/\/$/, '');
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];
const CHUNK = Number(process.env.YT_CHUNK_SIZE) || 8 * 1024 * 1024;
const MAX_RETRIES = 12;
const CATEGORY_EDUCATION = '27';

// ---------- helpers ----------
const log = (...a) => console.error('[youtube]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class UserError extends Error {}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function readJson(file, what) {
  let text;
  try { text = await readFile(file, 'utf8'); } catch {
    throw new UserError(`${what} not found at ${file}`);
  }
  try { return JSON.parse(text.replace(/^﻿/, '')); } catch (e) {
    throw new UserError(`${what} at ${file} is not valid JSON: ${e.message}`);
  }
}

async function loadClient() {
  if (!(await exists(CLIENT_FILE))) {
    throw new UserError(`OAuth client file missing: ${CLIENT_FILE}. Download the "Desktop app" OAuth client JSON from Google Cloud Console and save it there (see uploaders/SETUP.md).`);
  }
  const j = await readJson(CLIENT_FILE, 'OAuth client file');
  const c = j.installed || j.web || j;
  if (!c.client_id || !c.client_secret) {
    throw new UserError(`${CLIENT_FILE} has no installed.client_id / installed.client_secret. Make sure you downloaded the OAuth client of type "Desktop app".`);
  }
  return { clientId: c.client_id, clientSecret: c.client_secret };
}

async function loadToken() {
  if (!(await exists(TOKEN_FILE))) {
    throw new UserError(`Not connected: ${TOKEN_FILE} missing. Run: node uploaders/youtube.mjs auth`);
  }
  const t = await readJson(TOKEN_FILE, 'Token file');
  if (!t.refresh_token) throw new UserError(`Token file has no refresh_token. Run: node uploaders/youtube.mjs auth`);
  return t;
}

async function postForm(url, params) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  } catch (e) {
    throw new Error(`Network error contacting ${url}: ${e.cause?.code || e.message}`);
  }
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
  return { res, body };
}

async function getAccessToken() {
  const { clientId, clientSecret } = await loadClient();
  const tok = await loadToken();
  const { res, body } = await postForm(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tok.refresh_token,
    grant_type: 'refresh_token',
  });
  if (!res.ok || !body.access_token) {
    const why = body.error_description || body.error || `HTTP ${res.status}`;
    if (body.error === 'invalid_grant') {
      throw new UserError(`Refresh token rejected (${why}). It may have expired (tokens of apps in "Testing" mode expire after 7 days) or been revoked. Run: node uploaders/youtube.mjs auth`);
    }
    throw new Error(`Token refresh failed: ${why}`);
  }
  return body.access_token;
}

function apiError(res, text) {
  let msg = text;
  try {
    const j = JSON.parse(text);
    const e = j.error;
    if (e) {
      const reason = e.errors?.[0]?.reason;
      msg = (e.message || JSON.stringify(e)) + (reason ? ` (${reason})` : '');
    }
  } catch { /* keep raw */ }
  return `HTTP ${res.status}: ${String(msg).slice(0, 500)}`;
}

function openBrowser(url) {
  if (process.env.YT_NO_BROWSER) return;
  try {
    let child;
    if (process.platform === 'win32') {
      child = spawn('cmd', ['/c', 'start', '""', `"${url}"`], { windowsVerbatimArguments: true, detached: true, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      child = spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    }
    child.on('error', () => {});
    child.unref();
  } catch { /* user can copy the URL */ }
}

// ---------- auth ----------
async function cmdAuth() {
  const { clientId, clientSecret } = await loadClient();
  const state = randomBytes(16).toString('hex');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  let redirectUri;
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { server.close(); reject(new UserError('Timed out after 5 minutes waiting for Google consent.')); }, 5 * 60 * 1000);
    const server = createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/') { res.writeHead(404); res.end(); return; }
      const finish = (ok, msg) => {
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="font-family:sans-serif;padding:2em"><h2>${ok ? 'YouTube connected' : 'Authorisation failed'}</h2><p>${msg}</p><p>You can close this tab.</p></body></html>`);
      };
      const err = u.searchParams.get('error');
      if (err) { finish(false, err); clearTimeout(timer); server.close(); reject(new UserError(`Google returned error: ${err}`)); return; }
      const c = u.searchParams.get('code');
      if (!c) { finish(false, 'No code in request.'); return; }
      if (u.searchParams.get('state') !== state) { finish(false, 'State mismatch.'); return; }
      finish(true, 'AutoTube Studio can now upload to your channel.');
      clearTimeout(timer);
      server.close();
      resolve(c);
    });
    server.on('error', (e) => { clearTimeout(timer); reject(e); });
    server.listen(0, '127.0.0.1', () => {
      redirectUri = `http://127.0.0.1:${server.address().port}`;
      const url = `${AUTH_URL}?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });
      log('Open this URL in your browser and approve access (it should open automatically):');
      log(url);
      openBrowser(url);
    });
  });

  log('Got authorisation code, exchanging for tokens...');
  const { res, body } = await postForm(TOKEN_URL, {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${body.error_description || body.error || 'HTTP ' + res.status}`);
  if (!body.refresh_token) throw new UserError('Google did not return a refresh_token. Remove the app at https://myaccount.google.com/permissions and run auth again.');
  await mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify({
    refresh_token: body.refresh_token,
    scope: body.scope,
    token_type: body.token_type,
    created_at: new Date().toISOString(),
  }, null, 2));
  log(`Saved ${TOKEN_FILE}`);
  let channel = null;
  try { channel = (await fetchChannel(body.access_token))?.snippet?.title ?? null; } catch (e) { log('Could not read channel name:', e.message); }
  return { ok: true, platform: PLATFORM, connected: true, channel };
}

// ---------- status ----------
async function fetchChannel(accessToken) {
  let res;
  try {
    res = await fetch(`${API_BASE}/channels?part=snippet&mine=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (e) { throw new Error(`Network error: ${e.cause?.code || e.message}`); }
  const text = await res.text();
  if (!res.ok) throw new Error(apiError(res, text));
  return JSON.parse(text).items?.[0] ?? null;
}

async function cmdStatus() {
  try {
    const at = await getAccessToken();
    const ch = await fetchChannel(at);
    if (!ch) return { ok: true, connected: false, channel: null, error: 'Authorised Google account has no YouTube channel.' };
    return { ok: true, connected: true, channel: ch.snippet?.title ?? '' };
  } catch (e) {
    return { ok: true, connected: false, channel: null, error: e.message };
  }
}

// ---------- upload ----------
const clean = (s) => String(s ?? '').replace(/[<>]/g, '');

function buildMetadata(meta) {
  let title = clean(meta.title).trim() || 'Untitled';
  let description = clean(meta.description);
  if (meta.isShort && !/#shorts\b/i.test(title + ' ' + description)) {
    if (title.length + 8 <= 100) title = `${title} #Shorts`;
    else description = description ? `${description}\n\n#Shorts` : '#Shorts';
  }
  if (title.length > 100) title = title.slice(0, 100).trim();
  if (Buffer.byteLength(description) > 5000) description = Buffer.from(description).subarray(0, 4990).toString().replace(/�+$/, '');

  // Tags: total length limit ~500 chars (tags with spaces count quotes).
  const tags = [];
  let total = 0;
  for (const raw of Array.isArray(meta.tags) ? meta.tags : []) {
    const t = clean(raw).replace(/,/g, ' ').replace(/^#+/, '').trim();
    if (!t || tags.includes(t)) continue;
    const cost = t.length + (t.includes(' ') ? 2 : 0) + (tags.length ? 1 : 0);
    if (total + cost > 480) break;
    tags.push(t); total += cost;
  }

  const allowed = ['private', 'unlisted', 'public'];
  let privacyStatus = allowed.includes(meta.privacy) ? meta.privacy : 'private';
  const status = { privacyStatus, selfDeclaredMadeForKids: meta.madeForKids === true, embeddable: true };
  if (meta.publishAt) {
    const d = new Date(meta.publishAt);
    if (isNaN(d)) throw new UserError(`meta.publishAt is not a valid ISO date: ${meta.publishAt}`);
    if (d.getTime() > Date.now()) {
      status.privacyStatus = 'private';
      status.publishAt = d.toISOString();
    } else {
      log(`publishAt ${meta.publishAt} is in the past; ignoring it.`);
    }
  }
  return {
    snippet: { title, description, tags, categoryId: CATEGORY_EDUCATION },
    status,
  };
}

async function startSession(accessToken, metadata, size, mime) {
  const url = `${UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`;
  for (let attempt = 0; ; attempt++) {
    let res, text;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(size),
          'X-Upload-Content-Type': mime,
        },
        body: JSON.stringify(metadata),
      });
      text = await res.text();
    } catch (e) {
      if (attempt >= MAX_RETRIES) throw new Error(`Network error starting upload: ${e.cause?.code || e.message}`);
      await backoff(attempt, e.cause?.code || e.message); continue;
    }
    if (res.ok && res.headers.get('location')) return res.headers.get('location');
    if (res.status >= 500 && attempt < MAX_RETRIES) { await backoff(attempt, `HTTP ${res.status}`); continue; }
    throw new Error(`Could not start upload: ${apiError(res, text)}`);
  }
}

async function backoff(attempt, why) {
  const ms = Math.min(60000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 1000);
  log(`Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(ms / 1000)}s (${why})`);
  await sleep(ms);
}

// PUT on a brand-new connection every time (no keep-alive). Google sometimes drops the upload
// connection mid-chunk; with fetch's pooled sockets the next request then reused the dead socket
// and failed too ("terminated"), so whole uploads gave up. Returns { status, headers.get, text }.
function freshPut(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), mod = u.protocol === 'http:' ? http : https;
    const req = mod.request(u, { method: 'PUT', agent: false, timeout: 180000,
      headers: { ...headers, 'Content-Length': String(body ? body.length : 0), Connection: 'close' } }, (res) => {
      const parts = []; res.on('data', (c) => parts.push(c)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300,
        headers: { get: (k) => { const v = res.headers[k.toLowerCase()]; return Array.isArray(v) ? v[0] : v ?? null; } },
        text: Buffer.concat(parts).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('no response for 3 minutes')));
    req.on('error', reject);
    if (body && body.length) req.write(body);
    req.end();
  });
}

// Ask the server how many bytes it has. Returns {done, offset, body}.
async function queryOffset(sessionUrl, accessToken, size) {
  const res = await freshPut(sessionUrl, { Authorization: `Bearer ${accessToken}`, 'Content-Range': `bytes */${size}` }, null);
  const text = res.text;
  if (res.status === 200 || res.status === 201) return { done: true, body: JSON.parse(text) };
  if (res.status === 308) return { done: false, offset: rangeEnd(res) };
  const err = new Error(`Upload status check failed: ${apiError(res, text)}`);
  err.status = res.status;
  throw err;
}

function rangeEnd(res) {
  const r = res.headers.get('range'); // "bytes=0-12345"
  const m = r && /bytes=\d+-(\d+)/.exec(r);
  return m ? Number(m[1]) + 1 : 0;
}

async function uploadChunks(sessionUrl, accessToken, file, size, mime) {
  const fh = await open(file, 'r');
  try {
    let offset = 0;
    let attempt = 0;
    let lastPct = -1;
    while (true) {
      const len = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(len);
      if (len > 0) {
        const { bytesRead } = await fh.read(buf, 0, len, offset);
        if (bytesRead !== len) throw new Error(`Short read from ${file}`);
      }
      let res, text;
      try {
        res = await freshPut(sessionUrl, {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': mime,
          'Content-Range': len > 0 ? `bytes ${offset}-${offset + len - 1}/${size}` : `bytes */${size}`,
        }, buf);
        text = res.text;
      } catch (e) {
        res = null; text = `connection dropped (${e.code || e.message})`;
      }

      if (res && (res.status === 200 || res.status === 201)) {
        log('Upload 100%');
        return JSON.parse(text);
      }
      if (res && res.status === 308) {
        offset = rangeEnd(res);
        attempt = 0;
        const pct = Math.floor((offset / size) * 100);
        if (pct !== lastPct) { log(`Upload ${pct}% (${offset}/${size} bytes)`); lastPct = pct; }
        continue;
      }
      if (res && res.status === 404) throw new Error('Upload session expired (HTTP 404). Please retry the upload.');
      if (res && res.status < 500) throw new Error(`Chunk upload rejected: ${apiError(res, text)}`);

      // 5xx or network error: back off, then ask the server where to resume.
      if (attempt >= MAX_RETRIES) throw new Error(`Upload failed after ${MAX_RETRIES} retries: ${res ? apiError(res, text) : text}`);
      await backoff(attempt++, res ? `HTTP ${res.status}` : text);
      try {
        const q = await queryOffset(sessionUrl, accessToken, size);
        if (q.done) { log('Upload 100%'); return q.body; }
        offset = q.offset;
        log(`Resuming at byte ${offset}`);
      } catch (e) {
        if (e.status === 404) throw new Error('Upload session expired (HTTP 404). Please retry the upload.');
        if (e.status && e.status < 500) throw e;
        log('Status check failed, will retry:', e.message);
      }
    }
  } finally {
    await fh.close();
  }
}

async function setThumbnail(accessToken, videoId, thumbPath) {
  // Absolute paths as-is; relative paths: try cwd first, then project root.
  let p = path.resolve(thumbPath);
  if (!path.isAbsolute(thumbPath) && !(await exists(p))) p = path.resolve(ROOT, thumbPath);
  const data = await readFile(p);
  const ext = path.extname(p).toLowerCase();
  const type = ext === '.png' ? 'image/png' : 'image/jpeg';
  const res = await fetch(`${UPLOAD_BASE}/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': type },
    body: data,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(apiError(res, text));
}

async function cmdUpload(videoArg, metaArg) {
  if (!videoArg || !metaArg) throw new UserError('Usage: node uploaders/youtube.mjs upload <video.mp4> <meta.json>');
  await loadClient(); // fail fast with a setup hint before touching the network
  await loadToken();
  const video = path.resolve(videoArg);
  let st;
  try { st = await stat(video); } catch { throw new UserError(`Video file not found: ${video}`); }
  if (!st.isFile() || st.size === 0) throw new UserError(`Video file is empty or not a file: ${video}`);
  const meta = await readJson(path.resolve(metaArg), 'Meta file');
  const metadata = buildMetadata(meta);
  const ext = path.extname(video).toLowerCase();
  const mime = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska' }[ext] || 'application/octet-stream';

  log('Refreshing access token...');
  const at = await getAccessToken();
  log(`Starting resumable upload of ${path.basename(video)} (${(st.size / 1048576).toFixed(1)} MB), title: ${metadata.snippet.title}`);
  const sessionUrl = await startSession(at, metadata, st.size, mime);
  const result = await uploadChunks(sessionUrl, at, video, st.size, mime);
  const id = result?.id;
  if (!id) throw new Error(`Upload finished but no video id returned: ${JSON.stringify(result).slice(0, 300)}`);
  log(`Uploaded video id ${id} (status: ${result.status?.uploadStatus ?? 'unknown'}, privacy: ${result.status?.privacyStatus ?? '?'})`);

  if (meta.thumbnail) {
    try {
      await setThumbnail(at, id, meta.thumbnail);
      log('Thumbnail set.');
    } catch (e) {
      log(`WARNING: thumbnail not set (${e.message}). Unverified channels cannot set custom thumbnails; verify at https://www.youtube.com/verify`);
    }
  }
  return { ok: true, platform: PLATFORM, id, url: `https://youtu.be/${id}` };
}

// ---------- main ----------
async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    let out;
    if (cmd === 'auth') out = await cmdAuth();
    else if (cmd === 'upload') out = await cmdUpload(args[0], args[1]);
    else if (cmd === 'status') out = await cmdStatus();
    else if (cmd === 'thumb') { if (!args[0] || !args[1]) throw new UserError('Usage: node uploaders/youtube.mjs thumb <videoId> <image.jpg>'); const at = await getAccessToken(); await setThumbnail(at, args[0], args[1]); out = { ok: true, platform: PLATFORM, id: args[0], thumbnail: true }; }
    else throw new UserError('Usage: node uploaders/youtube.mjs auth | upload <video.mp4> <meta.json> | status');
    process.stdout.write(JSON.stringify(out) + '\n');
    process.exitCode = out.ok ? 0 : 1;
  } catch (e) {
    if (!(e instanceof UserError) && process.env.HS_DEBUG) log(e.stack);
    process.stdout.write(JSON.stringify({ ok: false, platform: PLATFORM, error: e.message || String(e) }) + '\n');
    process.exitCode = 1;
  }
}

main();
