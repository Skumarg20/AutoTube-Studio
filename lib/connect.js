// In-dashboard account connection: Google OAuth (YouTube) and Facebook Login (Instagram + Facebook Page),
// plus test uploads. Credentials stay on this PC in <root>/config and <root>/data, where root is the
// studio folder ("studio" scope) or channels/<flowId> (a channel's own accounts).
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import { ROOT, db } from './store.js';
import * as FL from './flows.js';

const PORT = +process.env.PORT || 4747;
export const GOOGLE_REDIRECT = `http://127.0.0.1:${PORT}`;            // loopback: works with a "Desktop app" client, no registration needed
export const META_REDIRECT = `http://localhost:${PORT}/oauth/meta`;     // localhost redirects are allowed while a Meta app is in Development mode
const GV = 'v21.0';
const META_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish'];
const YT_SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

// ---------- files ----------
export function rootOf(scope) {
  if (!scope || scope === 'studio') return ROOT;
  if (!FL.getFlow(scope)) throw new Error('unknown channel ' + scope);
  return FL.flowRoot(scope);
}
const F = {
  googleClient: r => path.join(r, 'config', 'youtube_client.json'),
  ytToken: r => path.join(r, 'data', 'youtube_token.json'),
  metaApp: r => path.join(r, 'config', 'meta_app.json'),
  metaPages: r => path.join(r, 'data', 'meta_pages.json'),
  instagram: r => path.join(r, 'config', 'instagram.json'),
  facebook: r => path.join(r, 'config', 'facebook.json'),
};
const PF_FILE = { youtube: F.ytToken, instagram: F.instagram, facebook: F.facebook };
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
const wj = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2)); };
const rm = f => { try { fs.unlinkSync(f); } catch {} };

// which folder the uploader for platform pf should use for a job of flow f: the channel's own login if it has one, else the studio login
// a channel uploads ONLY with its own login, or with the studio login when it is explicitly marked "useStudioAccounts"
// (never silently with another channel's account). Returns null when the channel has no account for that platform.
export function envFor(f, pf) {
  if (f) { const r = FL.flowRoot(f.id); if (fs.existsSync(PF_FILE[pf](r))) return { HS_UPLOADER_ROOT: r }; return f.useStudioAccounts ? { HS_UPLOADER_ROOT: ROOT } : null; }
  return { HS_UPLOADER_ROOT: ROOT };
}

// ---------- credentials ----------
export function saveGoogleClient(scope, b) {
  let c;
  if (b.json) { let j; try { j = typeof b.json === 'string' ? JSON.parse(b.json) : b.json; } catch { throw new Error('That file is not valid JSON. Download the OAuth client JSON again.'); } c = j.installed || j.web || j; }
  else c = { client_id: (b.clientId || '').trim(), client_secret: (b.clientSecret || '').trim() };
  if (!/\.apps\.googleusercontent\.com$/.test(c.client_id || '') || !c.client_secret) throw new Error('Need a Google OAuth client ID (ends in .apps.googleusercontent.com) and its client secret.');
  wj(F.googleClient(rootOf(scope)), { installed: { client_id: c.client_id, client_secret: c.client_secret, auth_uri: 'https://accounts.google.com/o/oauth2/auth', token_uri: 'https://oauth2.googleapis.com/token', redirect_uris: ['http://localhost'] } });
  return { ok: true };
}
export function saveMetaApp(scope, b) {
  const appId = String(b.appId || '').trim(), appSecret = String(b.appSecret || '').trim();
  if (!/^\d{6,}$/.test(appId) || !/^[a-f0-9]{20,}$/i.test(appSecret)) throw new Error('Need the Meta App ID (numbers) and App secret (from App settings > Basic).');
  wj(F.metaApp(rootOf(scope)), { appId, appSecret });
  return { ok: true };
}
export function disconnect(scope, what) {
  const r = rootOf(scope);
  if (what === 'youtube') rm(F.ytToken(r));
  else if (what === 'google-client') { rm(F.ytToken(r)); rm(F.googleClient(r)); }
  else if (what === 'instagram') rm(F.instagram(r));
  else if (what === 'facebook') rm(F.facebook(r));
  else if (what === 'meta') { rm(F.instagram(r)); rm(F.facebook(r)); rm(F.metaPages(r)); }
  else if (what === 'meta-app') { rm(F.instagram(r)); rm(F.facebook(r)); rm(F.metaPages(r)); rm(F.metaApp(r)); }
  else throw new Error('unknown account');
  return { ok: true };
}

// ---------- OAuth ----------
const pending = new Map();   // state -> { kind, scope, verifier, back, at }
function newState(o) { for (const [k, v] of pending) if (Date.now() - v.at > 15 * 60e3) pending.delete(k); const s = crypto.randomBytes(16).toString('hex'); pending.set(s, { ...o, at: Date.now() }); return s; }
export const isPending = s => pending.has(s);

// a channel can reuse the studio's Google sign-in key (one Google Cloud project for every YouTube channel)
function googleClientFor(scope) { const own = rj(F.googleClient(rootOf(scope))); if (own) return own; return rj(F.googleClient(ROOT)); }
export function googleStart(scope, back) {
  const c = googleClientFor(scope); const cl = c && (c.installed || c.web);
  if (!cl) throw new Error('Add your Google OAuth client first (step 1).');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const state = newState({ kind: 'google', scope, verifier, back });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: cl.client_id, redirect_uri: GOOGLE_REDIRECT, response_type: 'code', scope: YT_SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account',
    include_granted_scopes: 'true', state, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
}
export async function googleCallback(q) {
  const st = pending.get(q.get('state')); pending.delete(q.get('state'));
  if (!st || st.kind !== 'google') throw new Error('This sign-in link expired. Press Connect YouTube again.');
  if (q.get('error')) throw Object.assign(new Error('Google said: ' + q.get('error')), { back: st.back });
  const r = rootOf(st.scope), cj = googleClientFor(st.scope), cl = (cj || {}).installed || (cj || {}).web;
  if (!fs.existsSync(F.googleClient(r))) wj(F.googleClient(r), cj);   // the uploader for this channel needs the key next to its token
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: q.get('code'), client_id: cl.client_id, client_secret: cl.client_secret, redirect_uri: GOOGLE_REDIRECT, grant_type: 'authorization_code', code_verifier: st.verifier }) });
  const t = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error('Google token exchange failed: ' + (t.error_description || t.error || res.status)), { back: st.back });
  if (!t.refresh_token) throw Object.assign(new Error('Google gave no long-term login. Remove "AutoTube Studio" at myaccount.google.com/permissions and connect again.'), { back: st.back });
  wj(F.ytToken(r), { refresh_token: t.refresh_token, scope: t.scope, token_type: t.token_type, created_at: new Date().toISOString() });
  let channel = '';
  try { const c = await (await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: 'Bearer ' + t.access_token } })).json(); channel = c.items?.[0]?.snippet?.title || ''; } catch {}
  return { back: st.back, msg: channel ? `YouTube connected: ${channel}` : 'YouTube connected (this Google account has no channel yet)' };
}

export function metaStart(scope, back) {
  const app = rj(F.metaApp(rootOf(scope)));
  if (!app) throw new Error('Add your Meta app ID and secret first (step 1).');
  const state = newState({ kind: 'meta', scope, back });
  return `https://www.facebook.com/${GV}/dialog/oauth?` + new URLSearchParams({ client_id: app.appId, redirect_uri: META_REDIRECT, state, response_type: 'code', scope: META_SCOPES.join(',') });
}
async function graph(pathq, token) {
  const res = await fetch(`https://graph.facebook.com/${GV}/${pathq}`, token ? { headers: { Authorization: 'OAuth ' + token } } : {});
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j.error?.message || 'Facebook HTTP ' + res.status);
  return j;
}
// turn a user token into a long-lived one and list the Pages (and linked Instagram accounts) it can post to
async function useUserToken(r, userToken) {
  const app = rj(F.metaApp(r));
  let long = userToken, expiresAt = null;
  if (app) {
    try { const x = await graph('oauth/access_token?' + new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: app.appId, client_secret: app.appSecret, fb_exchange_token: userToken })); long = x.access_token; if (x.expires_in) expiresAt = Date.now() + x.expires_in * 1000; } catch {}
  }
  const me = await graph('me?fields=name', long);
  const acc = await graph('me/accounts?limit=100&fields=id,name,access_token,instagram_business_account{id,username}', long);
  const pages = (acc.data || []).map(p => ({ id: p.id, name: p.name, token: p.access_token, ig: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username || '' } : null }));
  wj(F.metaPages(r), { user: me.name, userToken: long, expiresAt, pages, at: Date.now() });
  if (!pages.length) throw new Error(`Logged in as ${me.name}, but no Facebook Page was shared with the app. Connect again and tick your Page (and its Instagram account) on the Facebook screen.`);
  const pick = pages.find(p => p.ig) || pages[0];
  if (pages.length === 1 || pages.filter(p => p.ig).length === 1) selectPage(r, pick.id);
  return { user: me.name, pages: pages.length, picked: pages.length === 1 || pages.filter(p => p.ig).length === 1 ? pick : null };
}
function selectPage(r, pageId) {
  const d = rj(F.metaPages(r)); const p = d && d.pages.find(x => x.id === pageId);
  if (!p) throw new Error('That Page is not in the list. Connect with Facebook again.');
  wj(F.facebook(r), { pageId: p.id, pageName: p.name, pageToken: p.token, graphVersion: GV, connectedAt: new Date().toISOString() });
  if (p.ig) wj(F.instagram(r), { igUserId: p.ig.id, username: p.ig.username, accessToken: p.token, graphVersion: GV, pageId: p.id, pageName: p.name, connectedAt: new Date().toISOString() });
  else rm(F.instagram(r));
  return p;
}
export function metaSelect(scope, pageId) { const p = selectPage(rootOf(scope), pageId); return { ok: true, page: p.name, instagram: p.ig ? p.ig.username : null }; }
export async function metaToken(scope, token) { if (!token || token.length < 30) throw new Error('Paste the whole access token.'); return useUserToken(rootOf(scope), token.trim()); }
export async function metaCallback(q) {
  const st = pending.get(q.get('state')); pending.delete(q.get('state'));
  if (!st || st.kind !== 'meta') throw new Error('This login link expired. Press Connect with Facebook again.');
  if (q.get('error')) throw Object.assign(new Error('Facebook said: ' + (q.get('error_description') || q.get('error'))), { back: st.back });
  const r = rootOf(st.scope), app = rj(F.metaApp(r));
  try {
    const t = await graph('oauth/access_token?' + new URLSearchParams({ client_id: app.appId, client_secret: app.appSecret, redirect_uri: META_REDIRECT, code: q.get('code') }));
    const x = await useUserToken(r, t.access_token);
    return { back: st.back, msg: x.picked ? `Connected: Facebook Page "${x.picked.name}"${x.picked.ig ? ` and Instagram @${x.picked.ig.username}` : ' (no Instagram account is linked to this Page)'}` : `Logged in as ${x.user}. Pick which Page to use.` };
  } catch (e) { throw Object.assign(e, { back: st.back }); }
}

// ---------- status ----------
export async function status(scope, uploader) {
  const r = rootOf(scope), env = { HS_UPLOADER_ROOT: r };
  const gc = rj(F.googleClient(r)), app = rj(F.metaApp(r)), pages = rj(F.metaPages(r)), ig = rj(F.instagram(r)), fb = rj(F.facebook(r));
  const has = { youtube: fs.existsSync(F.ytToken(r)), instagram: !!ig, facebook: !!fb };
  const [y, i, f] = await Promise.all(['youtube', 'instagram', 'facebook'].map(pf => has[pf] ? uploader(pf, ['status'], env) : null));
  const fl = scope && scope !== 'studio' ? FL.getFlow(scope) : null, mayUse = !!(fl && fl.useStudioAccounts);   // only channels marked to use the studio login fall back to it
  const fallback = fl ? { youtube: mayUse && fs.existsSync(F.ytToken(ROOT)), instagram: mayUse && fs.existsSync(F.instagram(ROOT)), facebook: mayUse && fs.existsSync(F.facebook(ROOT)), allowed: mayUse } : null;
  return {
    scope: scope || 'studio', folder: r, googleRedirect: GOOGLE_REDIRECT, metaRedirect: META_REDIRECT, fallback,
    google: (gc || (scope && scope !== 'studio' && rj(F.googleClient(ROOT)))) ? { clientId: ((gc || rj(F.googleClient(ROOT))).installed || (gc || rj(F.googleClient(ROOT))).web || {}).client_id } : null,
    meta: (app || pages) ? { appId: app?.appId || null,user: pages?.user || null, expiresAt: pages?.expiresAt || null, pages: (pages?.pages || []).map(p => ({ id: p.id, name: p.name, ig: p.ig?.username || (p.ig ? 'linked' : null) })) } : null,
    youtube: y, instagram: i ? { ...i, username: ig?.username, page: ig?.pageName } : null, facebook: f ? { ...f, pageId: fb?.pageId } : null,
    tests: Object.fromEntries(Object.entries(tests).filter(([k]) => k.startsWith((scope || 'studio') + ':')).map(([k, v]) => [k.split(':')[1], v])),
  };
}

// ---------- test uploads ----------
const tests = {};   // "scope:platform" -> { running, at, result }
function sampleVideo() {
  const done = db().jobs.filter(j => j.format === 'short' && fs.existsSync(path.join(ROOT, 'jobs', j.id, 'final.mp4'))).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (!done.length) throw new Error('Make at least one Short first; the test uploads a finished Short.');
  return done[0];
}
export function startTest(scope, pf, uploader) {
  if (!['youtube', 'instagram', 'facebook'].includes(pf)) throw new Error('unknown platform');
  const key = (scope || 'studio') + ':' + pf; if (tests[key]?.running) return tests[key];
  const r = rootOf(scope), j = sampleVideo(), dir = path.join(ROOT, 'jobs', j.id), metaFile = path.join(ROOT, 'data', `test_meta_${pf}.json`);
  wj(metaFile, { title: 'AutoTube Studio test upload - ' + new Date().toLocaleString(), description: `Test upload from AutoTube Studio (video: ${j.script?.title || j.topic}). Safe to delete.`, tags: ['history', 'test'], privacy: 'private', isShort: true, madeForKids: false });
  tests[key] = { running: true, at: Date.now(), video: j.script?.title || j.topic };
  uploader(pf, ['upload', path.join(dir, 'final.mp4'), metaFile], { HS_UPLOADER_ROOT: r })
    .then(res => { tests[key] = { running: false, at: Date.now(), video: tests[key].video, result: res }; })
    .catch(e => { tests[key] = { running: false, at: Date.now(), result: { ok: false, error: e.message } }; });
  return tests[key];
}
