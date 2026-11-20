#!/usr/bin/env node
// Facebook Page video uploader (Graph API). No dependencies; Node 20+ (fetch, FormData, fs.openAsBlob).
//
//   node uploaders/facebook.js upload <video.mp4> <meta.json>
//   node uploaders/facebook.js status
//
// Reads config/facebook.json: { "pageId": "...", "pageName": "...", "pageToken": "...", "graphVersion": "v21.0" }
// (written by the dashboard's "Connect with Facebook" button).
// meta.privacy === 'private' uploads the video unpublished (only Page admins can see it in Meta Business Suite).
//
// Contract: the LAST stdout line is one JSON object ({"ok":true,...} or {"ok":false,...}).

import { readFile, stat, access } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PLATFORM = 'facebook';
const ROOT = process.env.HS_UPLOADER_ROOT
  ? path.resolve(process.env.HS_UPLOADER_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(ROOT, 'config', 'facebook.json');
const GRAPH = (process.env.FB_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/$/, '');
const GRAPH_VIDEO = (process.env.FB_GRAPH_VIDEO_BASE || 'https://graph-video.facebook.com').replace(/\/$/, '');

const log = (...a) => console.error('[facebook]', ...a);
class UserError extends Error {}
let TOKEN = null;
const scrub = (s) => (TOKEN ? String(s).split(TOKEN).join('***') : String(s));

async function loadConfig() {
  try { await access(CONFIG_FILE); } catch { throw new UserError(`Facebook Page not connected (${CONFIG_FILE} missing). Use "Connect with Facebook" in the dashboard.`); }
  const c = JSON.parse((await readFile(CONFIG_FILE, 'utf8')).replace(/^﻿/, ''));
  if (!c.pageId || !c.pageToken) throw new UserError(`${CONFIG_FILE} needs pageId and pageToken.`);
  TOKEN = c.pageToken;
  return { pageId: String(c.pageId), token: c.pageToken, version: c.graphVersion || 'v21.0', pageName: c.pageName || '' };
}

async function call(url, init = {}) {
  let res;
  try { res = await fetch(url, init); } catch (e) { throw new Error(`Network error: ${e.cause?.code || e.message}`); }
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { j = { raw: text.slice(0, 300) }; }
  if (!res.ok || j.error) throw new Error(`HTTP ${res.status}: ${j.error?.message || j.raw || text.slice(0, 300)}`);
  return j;
}

async function cmdStatus() {
  try {
    const c = await loadConfig();
    const me = await call(`${GRAPH}/${c.version}/${c.pageId}?fields=name`, { headers: { Authorization: `OAuth ${c.token}` } });
    return { ok: true, connected: true, page: me.name || c.pageName };
  } catch (e) { return { ok: true, connected: false, page: null, error: scrub(e.message) }; }
}

async function cmdUpload(videoArg, metaArg) {
  if (!videoArg || !metaArg) throw new UserError('Usage: node uploaders/facebook.js upload <video.mp4> <meta.json>');
  const c = await loadConfig();
  const video = path.resolve(videoArg);
  const meta = JSON.parse((await readFile(path.resolve(metaArg), 'utf8')).replace(/^﻿/, ''));
  const size = (await stat(video)).size;
  if (size > 1024 * 1024 * 1024) throw new UserError('Video is over 1 GB; Facebook simple upload limit.');
  const tags = (Array.isArray(meta.tags) ? meta.tags : []).slice(0, 15).map(t => '#' + String(t).replace(/[^\p{L}\p{N}]/gu, '')).filter(t => t.length > 1);
  const fd = new FormData();
  fd.append('title', String(meta.title || 'Untitled').slice(0, 250));
  fd.append('description', [meta.description || '', tags.join(' ')].filter(Boolean).join('\n\n').slice(0, 5000));
  fd.append('published', meta.privacy === 'private' ? 'false' : 'true');
  fd.append('source', await openAsBlob(video, { type: 'video/mp4' }), path.basename(video));
  log(`uploading ${(size / 1048576).toFixed(1)} MB to Page ${c.pageName || c.pageId}${meta.privacy === 'private' ? ' (unpublished)' : ''}`);
  const r = await call(`${GRAPH_VIDEO}/${c.version}/${c.pageId}/videos`, { method: 'POST', headers: { Authorization: `OAuth ${c.token}` }, body: fd });
  return { ok: true, platform: PLATFORM, id: r.id, url: `https://www.facebook.com/${c.pageId}/videos/${r.id}`, published: meta.privacy !== 'private' };
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    let out;
    if (cmd === 'upload') out = await cmdUpload(args[0], args[1]);
    else if (cmd === 'status') out = await cmdStatus();
    else throw new UserError('Usage: node uploaders/facebook.js upload <video.mp4> <meta.json> | status');
    process.stdout.write(JSON.stringify(out) + '\n');
    process.exitCode = out.ok ? 0 : 1;
  } catch (e) {
    if (!(e instanceof UserError) && process.env.HS_DEBUG) log(scrub(e.stack));
    process.stdout.write(JSON.stringify({ ok: false, platform: PLATFORM, error: scrub(e.message || String(e)) }) + '\n');
    process.exitCode = 1;
  }
}
main();
