// Finds and downloads freely licensed images from Wikimedia Commons for documentary scenes.
//
//   import { findImages } from './lib/images.js';
//   const results = await findImages(requests, outDir, { log, choose });
//
// requests: [{ id, want, queries: [...], historical }]
// Writes <outDir>/<id>.jpg (long side <= 2400 px) and <outDir>/credits.json.
// Returns [{ id, ok, file?, credit?, error? }] and never throws for a single image.
//
// Downloads are treated as untrusted data: they are only ever handed to ffmpeg as image input
// (with the demuxer forced from their magic bytes), never executed or opened otherwise.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import * as JC from './jobctx.js';
import { fileURLToPath } from 'url';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'AutoTubeStudio/1.0 (personal video tool)';
const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(PROJECT, 'data', 'commons-cache');
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
const MIN_GAP_MS = 1100;          // at most ~1 request per second, shared by API calls and downloads
const TIMEOUT_MS = 30000;
const MAX_TRIES = 6;
const DOWNLOAD_TRIES = 3;        // then fall back to a smaller thumb / the next candidate
const MAX_BYTES = 60 * 1024 * 1024;
const LONG_SIDE = 2400;
const SEARCH_LIMIT = 12;
const MAX_QUERIES = 4;
const CHOOSE_TOP = 8;
const CHOOSE_TIMEOUT_MS = 3 * 60 * 1000;

// ---------- polite request queue (module-wide, so parallel callers share it) ----------
// Every request goes through one serial queue. API calls are spaced >= 1.1 s apart; media downloads
// from upload.wikimedia.org get a longer gap because that host rate-limits unidentified tools hard
// (it answers 429 with Retry-After: 600 when pushed).
const MEDIA_GAP_MS = 3000;
const MAX_INLINE_WAIT_MS = 90000;  // a Retry-After longer than this marks the host as blocked instead of sleeping
let queueTail = Promise.resolve();
let lastRequestAt = 0;
function paced(fn, gap = MIN_GAP_MS) {
  const run = queueTail.then(async () => {
    const wait = lastRequestAt + gap - Date.now();
    if (wait > 0) await sleep(wait);
    try { return await fn(); } finally { lastRequestAt = Date.now(); }
  });
  queueTail = run.catch(() => {});
  return run;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// host -> epoch ms until which we must not contact it (persisted so quick re-runs also back off)
const BLOCK_FILE = path.join(CACHE_DIR, '_blocked.json');
let blocked = {};
try { blocked = JSON.parse(fs.readFileSync(BLOCK_FILE, 'utf8')) || {}; } catch {}
function setBlocked(host, until) {
  blocked[host] = until;
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(BLOCK_FILE, JSON.stringify(blocked)); } catch {}
}
function blockedError(host) {
  const until = blocked[host] || 0;
  if (until <= Date.now()) return null;
  return Object.assign(new Error(`${host} rate-limited us; retry after ${new Date(until).toLocaleTimeString()}`), { fatal: true, rateLimited: true });
}

function retryAfterRaw(res) {
  const h = res?.headers?.get?.('retry-after');
  if (!h) return null;
  const s = Number(h);
  if (Number.isFinite(s)) return s * 1000;
  const d = Date.parse(h);
  return Number.isFinite(d) ? d - Date.now() : null;
}
function retryAfterMs(res, attempt) {
  const r = retryAfterRaw(res);
  if (r != null) return Math.min(MAX_INLINE_WAIT_MS, Math.max(1000, r));
  return Math.min(60000, 2000 * 2 ** attempt) + Math.floor(Math.random() * 500);
}

// fetch with pacing, timeout and retry on 429 / 5xx / network errors. `read` turns the Response into data.
async function politeFetch(url, read, log, tries = MAX_TRIES, gap = MIN_GAP_MS) {
  const host = new URL(url).hostname;
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    let res;
    try {
      const be = blockedError(host);
      if (be) throw be;
      res = await paced(() => fetch(url, {
        headers: { 'User-Agent': UA, 'Api-User-Agent': UA, Accept: '*/*' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      }), gap);
      if (res.status === 429 || res.status >= 500) {
        try { await res.body?.cancel(); } catch {}
        const ra = retryAfterRaw(res);
        if (ra != null && ra > MAX_INLINE_WAIT_MS) {
          setBlocked(host, Date.now() + ra);
          throw blockedError(host);
        }
        const wait = retryAfterMs(res, attempt);
        lastErr = new Error(`HTTP ${res.status}`);
        log?.(`  ${host}: HTTP ${res.status}, retrying in ${Math.round(wait / 1000)}s`);
        if (attempt < tries - 1) await sleep(wait);
        continue;
      }
      if (!res.ok) { try { await res.body?.cancel(); } catch {} throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true }); }
      const data = await read(res);
      if (data && data.__retry) {   // e.g. API maxlag
        const wait = retryAfterMs(res, attempt);
        lastErr = new Error(data.__retry);
        log?.(`  ${host}: ${data.__retry}, retrying in ${Math.round(wait / 1000)}s`);
        if (attempt < tries - 1) await sleep(wait);
        continue;
      }
      return data;
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
      const wait = Math.min(60000, 2000 * 2 ** attempt);
      log?.(`  ${host}: ${e.name === 'TimeoutError' ? 'timeout' : e.message}, retrying in ${Math.round(wait / 1000)}s`);
      if (attempt < tries - 1) await sleep(wait);
    }
  }
  throw lastErr || new Error('request failed');
}

// ---------- API with JSON cache ----------
function cachePath(url) {
  return path.join(CACHE_DIR, crypto.createHash('sha1').update(url).digest('hex') + '.json');
}

async function api(params, log) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  const url = `${API}?${qs}`;
  const cp = cachePath(url);
  try {
    const st = fs.statSync(cp);
    if (Date.now() - st.mtimeMs < CACHE_TTL_MS) {
      const c = JSON.parse(fs.readFileSync(cp, 'utf8'));
      if (c && c.url === url) return c.data;
    }
  } catch {}
  const data = await politeFetch(url, async res => {
    const text = await res.text();
    let j;
    try { j = JSON.parse(text); } catch { throw new Error('Commons returned non-JSON'); }
    if (j.error?.code === 'maxlag') return { __retry: 'server lagged (maxlag)' };
    if (j.error) throw Object.assign(new Error(`Commons API: ${j.error.code} ${j.error.info || ''}`.trim()), { fatal: true });
    return j;
  }, log);
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const tmp = cp + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ url, at: new Date().toISOString(), data }));
    fs.renameSync(tmp, cp);
  } catch {}
  return data;
}

async function searchFiles(query, log) {
  const j = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: String(SEARCH_LIMIT),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(LONG_SIDE),
    iiextmetadatafilter: 'LicenseShortName|License|LicenseUrl|UsageTerms|Copyrighted|NonFree|Artist|Credit|ImageDescription|ObjectName|DateTimeOriginal|DateTime|Categories|AttributionRequired|Restrictions',
  }, log);
  const pages = j?.query?.pages || [];
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(p => ({ page: p, info: p.imageinfo?.[0] }))
    .filter(x => x.info);
}

// ---------- text helpers ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', copy: '(c)' };
export function stripHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(span|div)\b[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/\1>/gi, ' ')   // hidden duplicates (e.g. author)
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function safeChar(n) { try { return n > 31 && n < 0x110000 ? String.fromCodePoint(n) : ' '; } catch { return ' '; } }
const clip = (s, n = 199) => (s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...' : s);
const meta = (info, k) => stripHtml(info?.extmetadata?.[k]?.value ?? '');

const STOP = new Set('a an the of and or in on at to for from with by as is are was were be old photo photograph image picture historical history view early showing'.split(' '));
function terms(s) {
  return [...new Set(String(s).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w)))];
}

// ---------- licence filter ----------
// Returns { ok, license, licenseUrl, reason }.
export function checkLicense(info) {
  const short = meta(info, 'LicenseShortName');
  const lic = meta(info, 'License');
  const terms_ = meta(info, 'UsageTerms');
  const nonFree = meta(info, 'NonFree').toLowerCase();
  const restrictions = meta(info, 'Restrictions').toLowerCase();
  const licenseUrl = meta(info, 'LicenseUrl');
  const t = `${short} | ${lic} | ${terms_}`.toLowerCase();
  const no = reason => ({ ok: false, license: short || lic || 'unknown', licenseUrl, reason });
  if (nonFree && nonFree !== 'false' && nonFree !== '0') return no('non-free');
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv|noderivs|fair[ -]?use|non-?free|all rights reserved/.test(t)) return no(`restricted licence (${short || lic})`);
  if (/insignia|trademark/.test(restrictions) && !/public domain|\bpd\b/.test(t)) return no('restricted');
  let kind = null;
  if (/public domain|^pd\b|\bpd[- ]|\bpd$|\bpd\b|cc0|cc-zero|cc zero/.test(t)) kind = 'pd';
  else if (/\bcc[- ]by[- ]sa\b|cc-by-sa|attribution[- ]share ?alike/.test(t)) kind = 'by-sa';
  else if (/\bcc[- ]by\b|cc-by-\d|creative commons attribution(?! non)/.test(t)) kind = 'by';
  if (!kind) {
    if (/gfdl|gnu free documentation/.test(t)) return no('GFDL-only');
    return no(`unknown licence (${short || lic || 'none'})`);
  }
  // A licence URL, if any, must not point at an NC/ND licence.
  if (/\/by-nc|\/by-nd|-nc-|-nd-/.test(licenseUrl.toLowerCase())) return no('restricted licence URL');
  return { ok: true, license: short || (kind === 'pd' ? 'Public domain' : lic), licenseUrl, kind };
}

// ---------- content filters ----------
const OK_MIME = new Set(['image/jpeg', 'image/png', 'image/tiff']);
function yearsIn(s) {
  return [...String(s).matchAll(/\b(1[0-9]{3}|20[0-2][0-9])s?\b/g)].map(m => +m[1]);
}
function candidateYear(info, title) {
  const d = meta(info, 'DateTimeOriginal');
  const ys = yearsIn(d);
  if (ys.length) return Math.min(...ys);
  const ty = yearsIn(title);
  return ty.length ? Math.min(...ty) : null;
}

const BAD_TITLE = [
  ['diagram', /\b(diagram|schematic|chart|graph|infographic|flowchart)\b/],
  ['coat of arms', /\b(coat[ _-]of[ _-]arms|blason|wappen|escudo|emblem|seal of)\b/],
  ['flag', /\bflags?\b|\bbandera\b/],
  ['signature', /\b(signature|autograph|firma|unterschrift)\b/],
  ['logo', /\b(logo|logotype|icon|pictogram|wordmark)\b/],
];

function rejectReason(c, want, historical) {
  const { info, page } = c;
  const title = page.title.toLowerCase();
  const w = String(want).toLowerCase();
  if (!OK_MIME.has(info.mime)) return `mime ${info.mime}`;
  if (/\.svg$/i.test(page.title)) return 'svg';
  for (const [name, re] of BAD_TITLE) {
    if (re.test(title) && !re.test(w)) return name;
  }
  if (historical && /\bmaps?\b|\blocator\b|\blocation\b|\bborders?\b/.test(title) && !/\bmap\b/.test(w)) {
    const y = candidateYear(info, page.title);
    if (y == null || y >= 1950 || /\blocator\b|\blocation\b|\bborders?\b/.test(title)) return 'modern map';
  }
  if (/\b(screenshot|screen ?shot|scan of text|page \d+)\b/.test(title)) return 'non-picture';
  if (!info.thumburl && !info.url) return 'no url';
  return null;
}

// ---------- heuristic score ----------
function score(c, wantTerms, historical) {
  const { info, page } = c;
  const title = page.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' ');
  const tt = new Set(terms(title));
  const dt = new Set(terms(`${meta(info, 'ImageDescription')} ${meta(info, 'ObjectName')}`));
  const ct = new Set(terms(meta(info, 'Categories')));
  let s = 0;
  for (const w of wantTerms) {
    if (tt.has(w)) s += 3;
    else if (dt.has(w)) s += 1.5;
    if (ct.has(w)) s += 1;
  }
  s += c.hits * 1.5;                                     // found by several queries
  s += Math.max(0, 4 - c.rank * 0.4);                    // Commons relevance order
  const W = info.width || 0, H = info.height || 0;
  s += Math.min(3, Math.max(0, Math.log2(W / 800 + 0.01)) * 1.5);  // resolution
  if (W && H) {
    const r = W / H;
    if (r >= 1.2 && r <= 2.4) s += 2.5; else if (r > 1.0) s += 1.2; else if (r < 0.75) s -= 1.5;
  }
  if (historical) {
    const y = candidateYear(info, page.title);
    const text = `${title} ${meta(info, 'ImageDescription')} ${meta(info, 'Categories')}`.toLowerCase();
    if (y != null) s += y < 1960 ? 3 : y < 1990 ? 0 : -2.5;
    if (/\b(photograph|photo|albumen|daguerreotype|glass plate|negative|engraving|etching|lithograph|woodcut|painting|oil on|watercolou?r|fresco|relief|miniature|manuscript|illustration|drawing)\b/.test(text)) s += 1.5;
    if (/\b(18|19[0-5])\d0s\b|\b1[5-8]\d\d\b|\b19[0-5]\d\b/.test(text)) s += 1;
    if (/\b(reenact|re-enact|replica|reconstruction|modern|tourists?|selfie|cosplay|statue of|reenactor)\b/.test(text)) s -= 1;
  }
  return s;
}

function toChoiceCandidate(c) {
  const { info, page } = c;
  return {
    title: page.title,
    description: clip(meta(info, 'ImageDescription') || meta(info, 'ObjectName'), 300),
    author: clip(meta(info, 'Artist') || meta(info, 'Credit'), 120),
    license: c.lic.license,
    width: info.width, height: info.height,
    date: clip(meta(info, 'DateTimeOriginal'), 60),
    categories: clip(meta(info, 'Categories').replace(/\|/g, ', '), 300),
  };
}

// ---------- download + convert ----------
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg_pipe';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png_pipe';
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0) || (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0 && buf[3] === 0x2a)) return 'tiff_pipe';
  return null;
}

// Commons now hands out thumbs on thumb.wikimedia.org; the same path is served by upload.wikimedia.org,
// so rewrite it there (we only ever download from upload.wikimedia.org).
function toUploadUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol === 'https:' && x.hostname === 'thumb.wikimedia.org') x.hostname = 'upload.wikimedia.org';
    return x.href;
  } catch { return u; }
}

function isUploadHost(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname === 'upload.wikimedia.org'; } catch { return false; }
}

async function download(url, log) {
  if (!isUploadHost(url)) throw new Error('refusing non-upload.wikimedia.org URL');
  return politeFetch(url, async res => {
    if (!isUploadHost(res.url || url)) throw Object.assign(new Error('redirected off upload.wikimedia.org'), { fatal: true });
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) throw Object.assign(new Error('file too large'), { fatal: true });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw Object.assign(new Error('file too large'), { fatal: true });
    return buf;
  }, log, DOWNLOAD_TRIES, MEDIA_GAP_MS);
}

function ffmpegToJpg(buf, demuxer, outFile) {
  return new Promise((resolve, reject) => {
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-f', demuxer, '-i', 'pipe:0',
      '-frames:v', '1',
      '-vf', `scale=w='min(${LONG_SIDE},iw)':h='min(${LONG_SIDE},ih)':force_original_aspect_ratio=decrease,format=yuvj420p`,
      '-q:v', '3', '-f', 'image2', '-c:v', 'mjpeg', outFile];
    const p = JC.track(spawn('ffmpeg', args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] }));
    let err = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('ffmpeg timed out')); }, 120000);
    p.stderr.on('data', d => { if (err.length < 4000) err += d; });
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim().slice(0, 300) || 'exit ' + code}`)); });
    p.stdin.on('error', () => {});
    p.stdin.end(buf);
  });
}

// width/height from a JPEG SOF marker
function jpegSize(file) {
  const b = fs.readFileSync(file);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

const MEDIA_CACHE = path.join(CACHE_DIR, 'media');

async function fetchAndConvert(c, outDir, id, log) {
  const url = toUploadUrl(c.info.thumburl || c.info.url);
  const out = path.join(outDir, id + '.jpg');
  // converted JPEGs are cached by source URL, so re-runs do not download again
  const cached = path.join(MEDIA_CACHE, crypto.createHash('sha1').update(url).digest('hex') + '.jpg');
  try {
    const size = jpegSize(cached);
    if (size && size.width >= 100 && size.height >= 100) { fs.copyFileSync(cached, out); return size; }
  } catch {}
  let buf;
  try { buf = await download(url, log); }
  catch (e) {
    // Commons rounds thumb widths up to standard buckets (2400 -> 3840), which are slow to render and
    // often 429. Fall back to the 1920px bucket of the same file.
    const smaller = /\/\d+px-[^/]+$/.test(new URL(url).pathname) && (c.info.width || 0) > 1920
      ? url.replace(/\/\d+px-([^/?]+)(\?|$)/, '/1920px-$1$2') : null;
    if (!smaller || smaller === url || e.rateLimited) throw e;
    log?.(`  ${id}: thumb failed (${e.message}), trying 1920px thumb`);
    buf = await download(smaller, log);
  }
  const demuxer = sniff(buf);
  if (!demuxer) throw new Error('download is not a JPEG/PNG/TIFF');
  const tmp = path.join(outDir, `.${id}.${process.pid}.tmp.jpg`);
  try {
    await ffmpegToJpg(buf, demuxer, tmp);
    const size = jpegSize(tmp);
    if (!size || size.width < 100 || size.height < 100) throw new Error('converted image is invalid');
    try { fs.mkdirSync(MEDIA_CACHE, { recursive: true }); fs.copyFileSync(tmp, cached); } catch {}
    fs.renameSync(tmp, out);
    return size;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// ---------- one request ----------
async function findOne(req, outDir, used, { log, choose }) {
  const id = String(req.id || '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { id, ok: false, error: 'invalid id' };
  const want = String(req.want || '');
  const historical = !!req.historical;
  let queries = (Array.isArray(req.queries) ? req.queries : []).map(q => String(q).trim()).filter(Boolean);
  if (!queries.length && want) queries = [want];
  queries = queries.slice(0, MAX_QUERIES);
  if (!queries.length) return { id, ok: false, error: 'no queries' };

  const byTitle = new Map();
  for (const q of queries) {
    let found;
    try { found = await searchFiles(q, log); }
    catch (e) { log(`  ${id}: search "${q}" failed: ${e.message}`); continue; }
    found.forEach((f, rank) => {
      const prev = byTitle.get(f.page.title);
      if (prev) { prev.hits++; prev.rank = Math.min(prev.rank, rank); }
      else byTitle.set(f.page.title, { ...f, hits: 0, rank });
    });
  }
  if (!byTitle.size) return { id, ok: false, error: 'no search results' };

  const reasons = {};
  const passing = [];
  for (const c of byTitle.values()) {
    if (used.has(c.page.title)) { reasons.duplicate = (reasons.duplicate || 0) + 1; continue; }
    const why = rejectReason(c, want, historical);
    if (why) { reasons[why] = (reasons[why] || 0) + 1; continue; }
    c.lic = checkLicense(c.info);
    if (!c.lic.ok) { const k = c.lic.reason.split(' (')[0]; reasons[k] = (reasons[k] || 0) + 1; continue; }
    passing.push(c);
  }
  let pool = passing.filter(c => (c.info.width || 0) >= 800);
  if (!pool.length) pool = passing.filter(c => (c.info.width || 0) >= 600);
  const summary = Object.entries(reasons).map(([k, v]) => `${k}:${v}`).join(', ');
  log(`  ${id}: ${byTitle.size} results, ${pool.length} usable${summary ? ` (rejected ${summary})` : ''}`);
  if (!pool.length) return { id, ok: false, error: `no freely licensed image found${summary ? ` (rejected ${summary})` : ''}` };

  const wantTerms = terms(`${want} ${queries.join(' ')}`);
  for (const c of pool) c.score = score(c, wantTerms, historical);
  pool.sort((a, b) => b.score - a.score);
  let order = pool.slice();

  if (typeof choose === 'function' && pool.length > 1) {
    const top = pool.slice(0, CHOOSE_TOP);
    let timer;
    try {
      const pick = await Promise.race([
        Promise.resolve().then(() => choose(want, top.map(toChoiceCandidate))),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('choose timed out')), CHOOSE_TIMEOUT_MS); }),
      ]).finally(() => clearTimeout(timer));
      const k = Number(pick);
      if (Number.isInteger(k) && k >= 0 && k < top.length) {
        order = [top[k], ...pool.filter(c => c !== top[k])];
        log(`  ${id}: chooser picked #${k}`);
      } else if (k === -1 || pick === null) {
        // the chooser saw every top candidate and rejected all of them: better no photo than a wrong one
        log(`  ${id}: chooser found no good match, skipping this photo`);
        return { id, ok: false, error: 'no suitable image (rejected by chooser)' };
      } else {
        log(`  ${id}: chooser returned ${JSON.stringify(pick)}, using heuristic`);
      }
    } catch (e) {
      log(`  ${id}: chooser failed (${e.message}), using heuristic`);
    }
  }

  let lastErr;
  for (const c of order.slice(0, 3)) {
    if (used.has(c.page.title)) continue;
    used.add(c.page.title);   // reserve before the download so a parallel call cannot take it
    try {
      const size = await fetchAndConvert(c, outDir, id, log);
      const info = c.info;
      const credit = {
        id,
        file: `${id}.jpg`,
        title: c.page.title,
        author: clip(meta(info, 'Artist') || meta(info, 'Credit') || 'Unknown author'),
        license: c.lic.license,
        licenseUrl: c.lic.licenseUrl || '',
        source: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(c.page.title.replace(/ /g, '_'))}`,
        width: size.width,
        height: size.height,
        description: clip(meta(info, 'ImageDescription') || meta(info, 'ObjectName') || c.page.title.replace(/^File:/, '')),
      };
      log(`  ${id}: saved ${credit.file} from "${c.page.title}" (${credit.license}, ${size.width}x${size.height})`);
      return { id, ok: true, file: path.join(outDir, credit.file), credit };
    } catch (e) {
      lastErr = e;
      used.delete(c.page.title);
      log(`  ${id}: download of "${c.page.title}" failed: ${e.message}`);
      if (e.rateLimited) break;   // do not keep hammering a host that told us to wait
    }
  }
  return { id, ok: false, error: `download failed: ${lastErr?.message || 'unknown'}` };
}

function writeCredits(outDir, results) {
  const file = path.join(outDir, 'credits.json');
  let old = [];
  try { old = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(old)) old = []; } catch {}
  const ids = new Set(results.map(r => r.id));
  const merged = [...old.filter(c => c && !ids.has(c.id)), ...results.filter(r => r.ok).map(r => r.credit)];
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2));
  fs.renameSync(tmp, file);
}

// ---------- public ----------
export async function findImages(requests, outDir, { log = () => {}, choose } = {}) {
  const say = m => { try { log(m); } catch {} };
  const list = Array.isArray(requests) ? requests : [];
  fs.mkdirSync(outDir, { recursive: true });
  const used = new Set();
  const results = [];
  for (const req of list) {
    const id = String(req?.id ?? '');
    say(`image ${id}: ${String(req?.want || '').slice(0, 100)}`);
    let r;
    try { r = await findOne(req || {}, outDir, used, { log: say, choose }); }
    catch (e) { r = { id, ok: false, error: e.message || String(e) }; }
    if (!r.ok) say(`  ${id}: FAILED - ${r.error}`);
    results.push(r);
  }
  try { writeCredits(outDir, results); } catch (e) { say(`credits.json write failed: ${e.message}`); }
  return results;
}
