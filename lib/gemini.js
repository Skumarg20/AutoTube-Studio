// Google Gemini for the character pipeline: Nano Banana (images) and Omni Flash (video with the character's own voice).
// Two ways in, picked by what is configured (the service account wins when both are set):
//   Vertex AI   - a Google Cloud service account: GOOGLE_APPLICATION_CREDENTIALS in config/.env, or
//                 config/google-service-account.json (billed to that Cloud project)
//   Gemini API  - an AI Studio key: GEMINI_API_KEY in config/.env
// Every paid call goes through one place that checks the budget first, records what it cost, and caches the result on disk,
// so asking again for the same picture or clip (a re-render, a retry, an unchanged storyboard frame) costs nothing.
// Models and budgets: settings (config/settings.json), defaults below.
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import { ROOT, settings, today } from './store.js';

const CACHE = path.join(ROOT, 'data', 'gemini-cache');
const LEDGER = path.join(ROOT, 'data', 'gemini-spend.json');

// USD list prices (Gemini pricing, Nov 2026; the same on Vertex AI). Used to keep spending under the budget, not for billing.
const IMAGE_PRICE = { '1K': 0.0336, '2K': 0.0504, '4K': 0.113 };
const VIDEO_PRICE_PER_SECOND = { '360p': 0.023, '720p': 0.0695, '1080p': 0.104, '4k': 0.209 };

const config = () => {
  const s = settings();
  return {
    imageModel: s.geminiImageModel || 'gemini-nano-banana-2.1',
    videoModel: s.geminiVideoModel || 'gemini-omni-1.2-flash',
    perVideo: +s.geminiBudgetPerVideo || 6,
    perDay: +s.geminiBudgetPerDay || 25,
  };
};

export class BudgetError extends Error {}

// ---------- transport: Vertex AI (service account) or the Gemini API (key) ----------
const serviceAccountFile = () => [process.env.GOOGLE_APPLICATION_CREDENTIALS, path.join(ROOT, 'config', 'google-service-account.json')].find(f => f && fs.existsSync(f));
let vertexToken = null;   // { value, until }
async function vertexAuth(sa) {
  if (vertexToken && vertexToken.until > Date.now() + 60e3) return vertexToken.value;
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: sa.token_uri, iat: now, exp: now + 3600 });
  const assertion = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const r = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const j = await r.json(); if (!r.ok) throw new Error('Google Cloud sign-in failed: ' + (j.error_description || j.error || r.status));
  vertexToken = { value: j.access_token, until: Date.now() + j.expires_in * 1000 };
  return vertexToken.value;
}
function transport() {
  const file = serviceAccountFile();
  if (file) {
    const sa = JSON.parse(fs.readFileSync(file, 'utf8')), base = `https://aiplatform.googleapis.com/v1beta1/projects/${sa.project_id}/locations/global`;
    return { name: 'vertex', headers: async () => ({ Authorization: 'Bearer ' + await vertexAuth(sa) }), imageUrl: m => `${base}/publishers/google/models/${m}:generateContent`, videoUrl: `${base}/interactions` };
  }
  if (process.env.GEMINI_API_KEY) {
    const base = 'https://generativelanguage.googleapis.com/v1beta';
    return { name: 'gemini', base, headers: async () => ({ 'x-goog-api-key': process.env.GEMINI_API_KEY }), imageUrl: m => `${base}/models/${m}:generateContent`, videoUrl: `${base}/interactions` };
  }
  return null;
}
export const geminiReady = () => !!transport();

// free check of the setup (tools/gemini_check.js, doctor): signs in and asks whether each model is there
export async function geminiStatus() {
  const T = transport(); if (!T) return { ok: false, error: 'not set up: ' + GEMINI_SETUP };
  const out = { via: T.name, ok: true, models: {} };
  try { await T.headers(); } catch (e) { return { ...out, ok: false, error: e.message }; }
  const { imageModel, videoModel } = config();
  for (const m of [imageModel, videoModel]) {
    const url = T.name === 'vertex' ? `https://aiplatform.googleapis.com/v1beta1/publishers/google/models/${m}` : `${T.base}/models/${m}`;
    const r = await fetch(url, { headers: await T.headers() });
    out.models[m] = r.ok ? 'available' : `${r.status} ${(await r.text()).slice(0, 160)}`;
  }
  return out;
}
export const GEMINI_SETUP = 'add a Google Cloud service account (config/google-service-account.json) or GEMINI_API_KEY in config/.env';

// ---------- spend ledger: { days: { "2026-11-18": usd }, jobs: { "<job id>": usd } } ----------
const readLedger = () => { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { days: {}, jobs: {} }; } };
function reserve(jobId, usd) {
  const L = readLedger(), c = config(), day = (L.days[today()] || 0) + usd, job = (L.jobs[jobId] || 0) + usd;
  if (day > c.perDay) throw new BudgetError(`Gemini budget for today is used up ($${(L.days[today()] || 0).toFixed(2)} of $${c.perDay}). Raise "geminiBudgetPerDay" in Settings or try tomorrow.`);
  if (jobId && job > c.perVideo) throw new BudgetError(`this video reached its Gemini budget ($${(L.jobs[jobId] || 0).toFixed(2)} of $${c.perVideo}). Raise "geminiBudgetPerVideo" in Settings to continue.`);
}
function record(jobId, usd) {
  const L = readLedger(); L.days[today()] = +((L.days[today()] || 0) + usd).toFixed(4);
  if (jobId) L.jobs[jobId] = +((L.jobs[jobId] || 0) + usd).toFixed(4);
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1));
}
export const spentOn = jobId => readLedger().jobs[jobId] || 0;

// ---------- HTTP ----------
async function call(T, method, url, body, { timeoutMs = 120e3, raw = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, { method, signal: ac.signal, headers: { ...await T.headers(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      if (r.ok) return raw ? Buffer.from(await r.arrayBuffer()) : r.json();
      const text = (await r.text()).slice(0, 400);
      // 429 = the project's per-minute quota: wait it out (up to about 7 minutes); a server error: two more tries
      if ((r.status === 429 && attempt < 6) || (r.status >= 500 && attempt < 3)) { await new Promise(res => setTimeout(res, attempt * (r.status === 429 ? 30e3 : 20e3))); continue; }
      throw new Error(`Gemini (${T.name}) ${r.status}: ${text}`);
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`Gemini did not answer within ${Math.round(timeoutMs / 1000)} s`);
      throw e;
    } finally { clearTimeout(timer); }
  }
}
const inlineImage = file => ({ data: fs.readFileSync(file).toString('base64'), mime: /\.png$/i.test(file) ? 'image/png' : 'image/jpeg' });
const digest = s => crypto.createHash('sha1').update(s).digest('hex');

// one paid generation: cached by everything that shapes the result, budget-checked, recorded
async function generate({ request, usd, jobId, out, produce }) {
  const T = transport(); if (!T) throw new Error('Gemini is not set up: ' + GEMINI_SETUP);
  const cached = path.join(CACHE, digest(JSON.stringify(request)) + path.extname(out));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (fs.existsSync(cached)) { fs.copyFileSync(cached, out); return { file: out, usd: 0, cached: true }; }
  reserve(jobId, usd);
  const bytes = await produce(T);
  fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(cached, bytes); fs.copyFileSync(cached, out);
  record(jobId, usd);
  return { file: out, usd, cached: false };
}

// Nano Banana: a still image from a prompt and optional reference images (the character sheet keeps the face the same)
export function generateImage({ prompt, refs = [], aspect = '9:16', size = '2K', jobId = null, out }) {
  const { imageModel } = config(), images = refs.map(inlineImage);
  const request = { model: imageModel, prompt, aspect, size, refs: images.map(i => digest(i.data)) };
  return generate({ request, usd: IMAGE_PRICE[size] || IMAGE_PRICE['2K'], jobId, out, produce: async T => {
    const res = await call(T, 'POST', T.imageUrl(imageModel), {
      contents: [{ role: 'user', parts: [...images.map(i => ({ inline_data: { mime_type: i.mime, data: i.data } })), { text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect, imageSize: size } },
    });
    const part = (res.candidates?.[0]?.content?.parts || []).find(p => p.inlineData || p.inline_data);
    if (!part) throw new Error('Nano Banana returned no image' + (res.candidates?.[0]?.finishReason ? ` (${res.candidates[0].finishReason})` : ''));
    return Buffer.from((part.inlineData || part.inline_data).data, 'base64');
  } });
}

// Omni Flash: a clip with sound (the character speaks the dialogue in the prompt) from a first frame and reference images
export function generateVideo({ prompt, images = [], aspect = '9:16', seconds = 8, resolution = '720p', jobId = null, out }) {
  const { videoModel } = config(), inputs = images.map(inlineImage);
  const request = { model: videoModel, prompt, aspect, seconds, resolution, images: inputs.map(i => digest(i.data)) };
  return generate({ request, usd: seconds * (VIDEO_PRICE_PER_SECOND[resolution] || VIDEO_PRICE_PER_SECOND['720p']), jobId, out, produce: async T => {
    const vertex = T.name === 'vertex';   // Vertex returns the clip inline; the Gemini API stores it as a file to download
    const format = { type: 'video', aspect_ratio: aspect, duration: `${seconds}s`, resolution, delivery: vertex ? 'inline' : 'uri' };
    const res = await call(T, 'POST', T.videoUrl, {
      model: videoModel, store: false, background: false, stream: false,
      input: [{ type: 'text', text: prompt }, ...inputs.map(i => ({ type: 'image', data: i.data, mime_type: i.mime }))],
      response_format: vertex ? [format] : format,
    }, { timeoutMs: 15 * 60e3 });
    const video = (res.steps || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []).find(c => c.type === 'video');
    if (!video) throw new Error('Omni Flash returned no video' + (res.status ? ` (status ${res.status})` : ''));
    if (video.data) return Buffer.from(video.data, 'base64');
    const fileId = /files\/[^/?:]+/.exec(video.uri || '')?.[0];
    if (!fileId) throw new Error('Omni Flash returned neither video data nor a file uri');
    for (let i = 0; i < 60; i++) {   // Gemini API: the file becomes downloadable once it is ACTIVE
      const f = await call(T, 'GET', `${T.base}/${fileId}`);
      if (f.state === 'FAILED') throw new Error('Omni Flash could not store the video');
      if (f.state === 'ACTIVE') return call(T, 'GET', `${T.base}/${fileId}:download?alt=media`, null, { raw: true, timeoutMs: 5 * 60e3 });
      await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error('Omni Flash video was not ready after 5 minutes');
  } });
}
