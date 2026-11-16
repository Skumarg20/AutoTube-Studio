#!/usr/bin/env node
// Instagram Reels uploader (Instagram Graph API, resumable upload of a local file).
// No dependencies; Node 18+ built-in fetch.
//
//   node uploaders/instagram.mjs upload <video.mp4> <meta.json>
//   node uploaders/instagram.mjs status
//
// Contract: the LAST stdout line is always one JSON object ({"ok":true,...} or
// {"ok":false,...}). Progress/diagnostics go to stderr. Exit code 0 = ok, 1 = failure.
//
// Flow (per developers.facebook.com/docs/instagram-platform/content-publishing/resumable-uploads):
//   1. POST {graph}/{ver}/{ig-user-id}/media  media_type=REELS upload_type=resumable caption=...
//        -> { id, uri }
//   2. POST https://rupload.facebook.com/ig-api-upload/{ver}/{container-id}
//        headers: Authorization: OAuth <token>, offset: 0, file_size: <bytes>; body = file bytes
//   3. GET  {graph}/{ver}/{container-id}?fields=status_code,status,video_status  until FINISHED
//   4. POST {graph}/{ver}/{ig-user-id}/media_publish  creation_id=<container-id>
//   5. GET  {graph}/{ver}/{media-id}?fields=permalink
//
// Test-only overrides:
//   HS_UPLOADER_ROOT  project root (default: parent folder of uploaders/)
//   IG_GRAPH_BASE     default https://graph.facebook.com
//   IG_RUPLOAD_BASE   default https://rupload.facebook.com/ig-api-upload
//   IG_POLL_MS        poll interval (default 5000)
//   IG_TIMEOUT_MS     processing timeout (default 600000 = 10 min)

import { readFile, stat, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PLATFORM = 'instagram';
const ROOT = process.env.HS_UPLOADER_ROOT
  ? path.resolve(process.env.HS_UPLOADER_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(ROOT, 'config', 'instagram.json');
const GRAPH_BASE = (process.env.IG_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/$/, '');
const RUPLOAD_BASE = process.env.IG_RUPLOAD_BASE ? process.env.IG_RUPLOAD_BASE.replace(/\/$/, '') : null;
const POLL_MS = Number(process.env.IG_POLL_MS) || 5000;
const TIMEOUT_MS = Number(process.env.IG_TIMEOUT_MS) || 10 * 60 * 1000;
const MAX_HASHTAGS = 30;
const MAX_CAPTION = 2200;

const log = (...a) => console.error('[instagram]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class UserError extends Error {}

let TOKEN = null; // kept to scrub it from any error text
const scrub = (s) => (TOKEN ? String(s).split(TOKEN).join('***') : String(s));

async function readJson(file, what) {
  let text;
  try { text = await readFile(file, 'utf8'); } catch {
    throw new UserError(`${what} not found at ${file}`);
  }
  try { return JSON.parse(text.replace(/^﻿/, '')); } catch (e) {
    throw new UserError(`${what} at ${file} is not valid JSON: ${e.message}`);
  }
}

async function loadConfig() {
  try { await access(CONFIG_FILE); } catch {
    throw new UserError(`Instagram config missing: ${CONFIG_FILE}. Copy config/instagram.example.json to config/instagram.json and fill in igUserId and accessToken (see uploaders/SETUP.md).`);
  }
  const c = await readJson(CONFIG_FILE, 'Instagram config');
  if (!c.igUserId || !c.accessToken || /^(YOUR|<)/i.test(c.igUserId) || /^(YOUR|<)/i.test(c.accessToken)) {
    throw new UserError(`${CONFIG_FILE} must contain real "igUserId" and "accessToken" values.`);
  }
  TOKEN = c.accessToken;
  return { igUserId: String(c.igUserId), token: c.accessToken, version: c.graphVersion || 'v21.0' };
}

// Graph API call. Uses the Authorization header so the token never appears in URLs.
async function graph(cfg, method, pathAndQuery, form) {
  const url = `${GRAPH_BASE}/${cfg.version}/${pathAndQuery}`;
  const init = { method, headers: { Authorization: `OAuth ${cfg.token}` } };
  if (form) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(form).toString();
  }
  let res;
  try { res = await fetch(url, init); } catch (e) {
    const err = new Error(`Network error calling Graph API (${pathAndQuery.split('?')[0]}): ${e.cause?.code || e.message}`);
    err.network = true;
    throw err;
  }
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
  if (!res.ok || body.error) {
    const e = body.error || {};
    const msg = e.error_user_msg || e.message || body.raw || `HTTP ${res.status}`;
    const err = new Error(scrub(`Graph API ${method} ${pathAndQuery.split('?')[0]} failed: ${msg}` +
      (e.code ? ` (code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''})` : '')));
    err.status = res.status; err.code = e.code; err.subcode = e.error_subcode; err.transient = e.is_transient;
    throw err;
  }
  return body;
}

function buildCaption(meta) {
  const title = String(meta.title ?? '').trim();
  const desc = String(meta.description ?? '').trim();
  let text = [title, desc].filter(Boolean).join('\n\n');
  const existing = new Set((text.match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.toLowerCase()));
  let budget = Math.max(0, MAX_HASHTAGS - existing.size);
  const tags = [];
  for (const raw of Array.isArray(meta.tags) ? meta.tags : []) {
    if (budget <= 0) break;
    const t = String(raw).replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
    if (!t) continue;
    const h = `#${t}`;
    if (existing.has(h.toLowerCase())) continue;
    existing.add(h.toLowerCase());
    tags.push(h);
    budget--;
  }
  const tagLine = tags.join(' ');
  if (tagLine) {
    const room = MAX_CAPTION - tagLine.length - 2;
    if (text.length > room) text = text.slice(0, Math.max(0, room - 1)).trimEnd() + '…';
    text = text ? `${text}\n\n${tagLine}` : tagLine;
  }
  if (text.length > MAX_CAPTION) text = text.slice(0, MAX_CAPTION - 1) + '…';
  return text;
}

async function uploadBytes(cfg, uploadUrl, data) {
  let offset = 0;
  for (let attempt = 0; attempt <= 4; attempt++) {
    let res, text;
    try {
      res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `OAuth ${cfg.token}`,
          offset: String(offset),
          file_size: String(data.length),
          'Content-Type': 'application/octet-stream',
        },
        body: offset ? data.subarray(offset) : data,
      });
      text = await res.text();
    } catch (e) {
      res = null; text = e.cause?.code || e.message;
    }
    let body = {}; try { body = JSON.parse(text); } catch { /* ignore */ }
    if (res && res.ok && body.success !== false) { log('Upload to Meta complete.'); return; }
    const retriable = !res || res.status >= 500 || body.debug_info?.retriable === true;
    const why = res ? `HTTP ${res.status}: ${body.debug_info?.message || body.error?.message || text.slice(0, 300)}` : text;
    if (!retriable || attempt === 4) throw new Error(scrub(`Video byte upload failed: ${why}`));
    const ms = 2000 * 2 ** attempt;
    log(`Upload attempt ${attempt + 1} failed (${scrub(why)}); retrying in ${ms / 1000}s`);
    await sleep(ms);
    offset = 0;
    try { // resume from what Meta already has, if it tells us
      const st = await graph(cfg, 'GET', `${cfg.containerId}?fields=video_status`);
      const done = Number(st.video_status?.uploading_phase?.bytes_transferred);
      if (Number.isFinite(done) && done > 0 && done < data.length) { offset = done; log(`Resuming at byte ${offset}`); }
    } catch { /* restart from 0 */ }
  }
}

async function waitForContainer(cfg, containerId) {
  const deadline = Date.now() + TIMEOUT_MS;
  let last = '';
  let netErrors = 0;
  while (Date.now() < deadline) {
    let st;
    try {
      st = await graph(cfg, 'GET', `${containerId}?fields=status_code,status`);
      netErrors = 0;
    } catch (e) {
      if ((e.network || e.status >= 500 || e.transient) && ++netErrors < 6) { log('Status check failed, retrying:', e.message); await sleep(POLL_MS); continue; }
      throw e;
    }
    const code = st.status_code;
    if (code !== last) { log(`Container status: ${code}${st.status ? ' - ' + st.status : ''}`); last = code; }
    if (code === 'FINISHED') return;
    if (code === 'PUBLISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`Instagram could not process the video (${code}${st.status ? ': ' + st.status : ''}). Reels must be MP4/MOV (H.264, AAC), 9:16, 3 s to 15 min.`);
    }
    await sleep(POLL_MS);
  }
  throw new Error(`Timed out after ${Math.round(TIMEOUT_MS / 60000)} min waiting for Instagram to process the video (last status: ${last || 'unknown'}).`);
}

async function publish(cfg, containerId) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await graph(cfg, 'POST', `${cfg.igUserId}/media_publish`, { creation_id: containerId });
    } catch (e) {
      // 9007 = media not ready yet; also retry transient/5xx a few times.
      const retry = e.code === 9007 || e.subcode === 2207027 || e.transient || e.network || e.status >= 500;
      if (!retry || attempt >= 5) throw e;
      log(`Publish not ready (${e.message}); retrying in 10s`);
      await sleep(10000);
    }
  }
}

async function cmdUpload(videoArg, metaArg) {
  if (!videoArg || !metaArg) throw new UserError('Usage: node uploaders/instagram.mjs upload <video.mp4> <meta.json>');
  const cfg = await loadConfig();
  const video = path.resolve(videoArg);
  let st;
  try { st = await stat(video); } catch { throw new UserError(`Video file not found: ${video}`); }
  if (!st.isFile() || st.size === 0) throw new UserError(`Video file is empty or not a file: ${video}`);
  if (st.size > 1024 * 1024 * 1024) throw new UserError(`Video is ${(st.size / 1048576).toFixed(0)} MB; Instagram Reels allow at most 1 GB.`);
  const meta = await readJson(path.resolve(metaArg), 'Meta file');
  const caption = buildCaption(meta);

  log('Creating Reels container...');
  // share_to_feed is documented for REELS containers, but the resumable-upload page says
  // "other parameters are not supported". Send it; if Meta rejects the params (code 100),
  // retry without it (Reels are shown in the feed by default anyway).
  const params = { media_type: 'REELS', upload_type: 'resumable', caption, share_to_feed: 'true' };
  let container;
  try {
    container = await graph(cfg, 'POST', `${cfg.igUserId}/media`, params);
  } catch (e) {
    if (e.code !== 100) throw e;
    log(`Container creation rejected (${e.message}); retrying without share_to_feed`);
    delete params.share_to_feed;
    container = await graph(cfg, 'POST', `${cfg.igUserId}/media`, params);
  }
  const containerId = container.id;
  if (!containerId) throw new Error('Container creation returned no id.');
  cfg.containerId = containerId;
  const uploadUrl = RUPLOAD_BASE
    ? `${RUPLOAD_BASE}/${cfg.version}/${containerId}`
    : (container.uri || `https://rupload.facebook.com/ig-api-upload/${cfg.version}/${containerId}`);
  log(`Container ${containerId}; uploading ${(st.size / 1048576).toFixed(1)} MB...`);

  const data = await readFile(video);
  await uploadBytes(cfg, uploadUrl, data);

  log('Waiting for Instagram to process the video...');
  await waitForContainer(cfg, containerId);

  log('Publishing...');
  const pub = await publish(cfg, containerId);
  const mediaId = pub.id;
  if (!mediaId) throw new Error('media_publish returned no media id.');

  let permalink = null;
  try {
    permalink = (await graph(cfg, 'GET', `${mediaId}?fields=permalink`)).permalink || null;
  } catch (e) { log('WARNING: could not fetch permalink:', e.message); }
  return { ok: true, platform: PLATFORM, id: mediaId, url: permalink || `https://www.instagram.com/` };
}

async function cmdStatus() {
  try {
    const cfg = await loadConfig();
    const me = await graph(cfg, 'GET', `${cfg.igUserId}?fields=username`);
    return { ok: true, connected: true, account: me.username ?? '' };
  } catch (e) {
    return { ok: true, connected: false, account: null, error: scrub(e.message) };
  }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    let out;
    if (cmd === 'upload') out = await cmdUpload(args[0], args[1]);
    else if (cmd === 'status') out = await cmdStatus();
    else throw new UserError('Usage: node uploaders/instagram.mjs upload <video.mp4> <meta.json> | status');
    process.stdout.write(JSON.stringify(out) + '\n');
    process.exitCode = out.ok ? 0 : 1;
  } catch (e) {
    if (!(e instanceof UserError) && process.env.HS_DEBUG) log(scrub(e.stack));
    process.stdout.write(JSON.stringify({ ok: false, platform: PLATFORM, error: scrub(e.message || String(e)) }) + '\n');
    process.exitCode = 1;
  }
}

main();
