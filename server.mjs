// AutoTube Studio: local dashboard + automation.  Start: node server.mjs   then open http://localhost:4747
import './lib/env.mjs';   // config/.env first (keys, tunnel, port)
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn, execFileSync } from 'child_process';
import { ROOT, settings, saveSettings, db, save, job, newId, today } from './lib/store.mjs';
import { askClaude, extractJSON, scriptPrompt, topicsPrompt, anglesPrompt } from './lib/claude.mjs';
import { buildVideo, validateScript } from './lib/pipeline.mjs';
import { listStyles, styleOf } from './lib/styles.mjs';
import { planPrompt, normalizePlan, PACKS, STYLES as V2ALL, MY_STYLES } from './lib/v2/plan.mjs';
const V2STYLES = Object.fromEntries(Object.entries(V2ALL).filter(([k]) => MY_STYLES.includes(k)));
import { buildVideoV2 } from './lib/v2/build.mjs';
import { examPlanPrompt } from './lib/v2/exam.mjs';
import { histPlanPrompt } from './lib/v2/histprompt.mjs';
import * as FL from './lib/flows.mjs';
import * as CN from './lib/connect.mjs';
import * as EL from './lib/eleven.mjs';
import * as WK from './lib/workers.mjs';
import * as ID from './lib/ideas.mjs';
import * as OP from './lib/ops.mjs';
import * as TN from './lib/tunnel.mjs';
import * as CA from './lib/claudeauth.mjs';
import { themeRules, themesFor } from './lib/v2/themes.mjs';
import { limitPause } from './lib/claude.mjs';
import { run as runCmd } from './lib/pipeline.mjs';
const isV2 = j => j.engine === 'v2';
// plan problems Claude can fix by itself: theme rules and a Short that runs too long
const FIXABLE = e => e.startsWith('theme rules') || /^Short is about/.test(e);
const LEN_FIX = 'Keep every line\'s "say" word for word, EXCEPT when a rule says the Short is too long: then shorten "say" by cutting filler words (never facts, numbers or names) until the Short is under 55 seconds, and keep every "at" word in its line.';
const validate = j => isV2(j) ? normalizePlan(j.script, j.format) : validateScript(j.script, j.format);

const PORT = +process.env.PORT || 4747;
const WORKER = !process.env.NO_WORKER;   // NO_WORKER=1: dashboard only (no scheduler, no rendering)
const SLOTS = [['long1', 'long'], ['long2', 'long'], ['short1', 'short'], ['short2', 'short'], ['short3', 'short'], ['short4', 'short']];
const activity = [];
function note(msg) { const line = `${new Date().toLocaleTimeString()}  ${msg}`; activity.unshift(line); activity.length = Math.min(activity.length, 200); console.log(line); }
function jlog(j, msg) { j.log = j.log || []; j.log.push(`${new Date().toLocaleTimeString()} ${msg}`); if (j.log.length > 300) j.log.splice(0, j.log.length - 300); }
function setStatus(j, s, msg) { j.status = s; j.updatedAt = Date.now(); if (msg) jlog(j, msg); save(); note(`${j.slot || j.format} "${j.topic}": ${s}${msg ? ' - ' + msg : ''}`); }

// ---------------- topics ----------------
function theme(name) { return db().themes.find(t => t.name === name); }
async function suggestTopics(name) {
  const th = theme(name); if (!th) throw new Error('unknown theme');
  const reply = await askClaude(topicsPrompt({ theme: name, channel: settings().channelName, existing: [...th.topics, ...db().usedTopics] }), { model: settings().claudeModel });
  const list = extractJSON(reply).map(x => x.topic || x).filter(Boolean);
  th.topics.push(...list.filter(t => !th.topics.includes(t))); save(); return list;
}
async function takeTopic(name) {
  const th = theme(name) || db().themes[0];
  if (!th.topics.length) await suggestTopics(th.name);
  const t = th.topics.shift(); db().usedTopics.push(t); save(); return t;
}

// ---------------- jobs ----------------
function pickStyle(format, th, wanted) {
  const T = theme(th) || {};
  let s = wanted || (format === 'long' ? T.longStyle : T.shortStyle) || 'archive-lighttable';
  if (format === 'long' && styleOf(s)?.mode === 'ai') s = (styleOf(T.longStyle)?.mode === 'fast' && T.longStyle) || 'archive-lighttable';
  return s;
}
function createJob({ format, theme: th, topic, slot = null, date = today(), angle = null, parent = null, style = null, special = false, specialStyle = null, flowId = null, publishAt = null, mode = 'auto', brief = null, draft = false, fromIdea = null }) {
  const j = { id: newId(date, slot || format), date, slot, format, theme: th, topic, angle, parent, engine: settings().engine || 'v2', pack: (flowId && FL.getFlow(flowId) ? FL.getFlow(flowId).pack : (theme(th) || {}).pack) || 'auto', flowId, publishAt, mode, brief, media: [], channelName: flowId && FL.getFlow(flowId) ? FL.getFlow(flowId).channel.name : settings().channelName, voice: flowId && FL.getFlow(flowId) ? FL.getFlow(flowId).voice : undefined, style: pickStyle(format, th, style), status: 'writing', createdAt: Date.now(), log: [], uploads: {} };
  if (draft) j.status = 'draft';
  if (fromIdea) j.fromIdea = fromIdea;   // set before the plan writer starts, so it researches the title on the web first
  db().jobs.push(j); save(); if (!draft) queueWrite(j.id); return j;
}
const writeQ = [], renderQ = [];
let writing = 0;   // plans being written right now (Claude runs several at once)
function queueWrite(id) { if (!writeQ.includes(id)) writeQ.push(id); pump(); }
function queueRender(id) { const j = job(id); if (j) { WK.queued(j); save(); } }   // a worker picks it up within a few seconds
// a worker finished a video: review it, or publish it on autopilot
function onRendered(j) {
  setStatus(j, 'video_review', 'video ready for review');
  const fl = j.flowId ? FL.getFlow(j.flowId) : null; if (fl && fl.approvals === 'none') { j.targets = { youtube: !!fl.upload.youtube, instagram: !!fl.upload.instagram && j.format === 'short', facebook: !!fl.upload.facebook }; setStatus(j, 'approved', `autopilot: will publish at ${j.publishAt || 'next check'}`); }
}

async function pump() {
  if (!WORKER) return;
  while (writing < Math.max(1, +settings().writeSlots || 2) && writeQ.length) {
    writing++; const j = job(writeQ.shift());
    (async () => {
      if (!j) return;
      try {
        setStatus(j, 'writing', 'Claude is writing the script');
        // shorts that spin off a long video use an angle taken from its script
        if (j.parent && !j.angle) {
          const p = job(j.parent);
          if (p?.script) { try { const scr = p.script.scenes ? p.script : { scenes: p.script.chapters.flatMap(c => c.lines.map(l => ({ narration: l.say }))) }; const angles = extractJSON(await askClaude(anglesPrompt({ topic: p.topic, script: scr }), { model: settings().claudeModel })); const sib = db().jobs.filter(x => x.parent === j.parent).indexOf(j); j.angle = angles[Math.max(0, sib) % angles.length]; } catch {} }
        }
        const st = settings();
        if (isV2(j)) {
          const fl = j.flowId ? FL.getFlow(j.flowId) : null;
          let narration = null;
          if (j.mode === 'own' && j.voiceFile && j.voiceFirst) { jlog(j, 'transcribing your recording so the plan follows it'); const LIBP = settings().libraryPath; narration = (await runCmd(path.join(LIBP, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'), [path.join(ROOT, 'tools', 'transcribe.py'), path.join(ROOT, 'jobs', j.id, j.voiceFile)], { env: { PYTHONIOENCODING: 'utf-8' } })).trim(); }
          const exam = fl && fl.domain === 'exam';
          // exam channels: Hinglish/English/Hindi narration needs a voice that can speak it; the built-in English voices fall back to English
          const voice = j.voice || (fl && fl.voice) || st.voice, want = fl ? (fl.language || (exam ? 'hinglish' : 'english')) : 'english', lang = String(voice).startsWith('eleven:') ? want : 'english';
          if (fl && fl.language && fl.language !== 'english' && lang === 'english') jlog(j, `writing in English: ${fl.language} narration needs your ElevenLabs voice (the built-in voice "${voice}" only speaks English)`);
          const args = { format: j.format, theme: j.theme, topic: j.topic, channel: fl ? fl.channel.name : st.channelName, minutes: fl ? fl.longMinutes : st.longMinutes, angle: j.angle, pack: j.pack, info: fl ? fl.channel : {}, brief: j.brief, media: j.media || [], narration, language: lang, direct: String(voice).startsWith('eleven:'), look: 'board', recent: [...new Set(db().jobs.filter(x => x.flowId === j.flowId && x.id !== j.id && x.script && Array.isArray(x.script.chapters)).slice(-6).flatMap(x => x.script.chapters.map(c => c.style)))] };
          // the opening themes of the channel's last 3 plans: the next plan opens differently
          args.openers = [...new Set(db().jobs.filter(x => x.flowId === j.flowId && x.id !== j.id && x.script && Array.isArray(x.script.chapters) && x.script.chapters[0]).slice(-3).map(x => x.script.chapters[0].style))];   // THEMES.md: every plan is a Lemo Opuscar library-theme plan
          // THEMES.md: every channel plans in Lemo Opuscar library themes (exam: board + anime; history: the documentary themes)
          let planPrompt = exam ? examPlanPrompt(args) : histPlanPrompt({ ...args, domain: fl && fl.domain === 'general' ? 'general' : 'history' });
          if (j.fromIdea) { jlog(j, 'Claude is researching the title on the web, then writing the plan'); planPrompt = `RESEARCH FIRST: before writing anything, use WebSearch and WebFetch to research this video's title properly (several searches; read reliable pages, start with the sources in the brief). Verify every fact, date, number, formula and claim you will use; prefer what you verified over memory. Then write the plan exactly as specified below.

` + planPrompt; }
          const reply = await askClaude(planPrompt, { model: st.claudeModel, timeoutMs: 45 * 60 * 1000, extraArgs: j.fromIdea ? ID.WEB_TOOLS : [] });
          const raw = extractJSON(reply); raw.userMedia = j.media || []; if (j.brief && j.brief.title) raw.title = j.brief.title; if (exam) { raw.domain = 'exam'; raw.look = 'lib'; } else { raw.domain = 'history'; raw.look = 'lib'; }
          raw.avoidOpen = args.openers;
          let v = normalizePlan(raw, j.format);
          const themeErrs = v.errs.filter(FIXABLE);
          if (themeErrs.length) {   // one automatic correction: Claude fixes its own plan against the theme rules
            jlog(j, 'plan breaks the theme rules (' + themeErrs.join('; ') + '): Claude is correcting it');
            try {
              const fixed = extractJSON(await askClaude((exam ? examPlanPrompt(args) : histPlanPrompt({ ...args, domain: fl && fl.domain === 'general' ? 'general' : 'history' })) + `

YOUR PLAN BELOW BREAKS THESE RULES:
- ${themeErrs.join('\n- ')}
Return the complete corrected plan JSON: keep the facts and title; change only the themes that break the rules (style and why) and rewrite the shots of every chapter whose theme you change so they fit that theme (its own shots and look). ${LEN_FIX}

YOUR PLAN:
${JSON.stringify(v.plan)}`, { model: st.claudeModel, timeoutMs: 30 * 60 * 1000 }));
              fixed.userMedia = raw.userMedia; fixed.domain = raw.domain; fixed.look = raw.look; fixed.avoidOpen = raw.avoidOpen; if (j.brief && j.brief.title) fixed.title = j.brief.title;
              const v2 = normalizePlan(fixed, j.format); if (v2.errs.length <= v.errs.length) v = v2;
            } catch (e) { jlog(j, 'theme correction failed: ' + e.message); }
          }
          j.script = v.plan; delete v.plan; j.validation = v;
          setStatus(j, 'script_review', `plan ready: ${j.script.chapters.length} chapters, ${v.lines} lines, ~${Math.round(v.estSeconds / 6) / 10} min, ${(j.script.images || []).length} photos`);
          if (fl && ['video', 'none'].includes(fl.approvals) && !v.errs.length) { setStatus(j, 'queued_render', `plan auto-approved (autoflow "${fl.name}")`); queueRender(j.id); }
        } else {
          throw new Error('Blocked by THEMES.md: the old template engine is retired; only Lemo Opuscar library themes may be used.');
          const reply = await askClaude(scriptPrompt({ format: j.format, theme: j.theme, topic: j.topic, channel: st.channelName, minutes: st.longMinutes, angle: j.angle }), { model: st.claudeModel });
          j.script = extractJSON(reply);
          j.validation = validateScript(j.script, j.format);
          setStatus(j, 'script_review', `script ready: ${j.script.scenes.length} scenes, ~${Math.round(j.validation.estSeconds)} s`);
        }
      } catch (e) { setStatus(j, 'failed', 'script failed: ' + e.message); }
    })().finally(() => { writing--; pump(); });
  }
}

// ---------------- uploads ----------------
function uploader(platform, args, env = {}) {
  return new Promise(resolve => {
    const p = spawn('node', [path.join(ROOT, 'uploaders', platform + '.mjs'), ...args], { cwd: ROOT, windowsHide: true, env: { ...process.env, ...env } });
    let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('error', e => resolve({ ok: false, error: e.message }));
    p.on('close', () => { const last = out.trim().split(/\r?\n/).pop(); try { resolve(JSON.parse(last)); } catch { resolve({ ok: false, error: (err || out || 'no output').slice(-400) }); } });
  });
}
async function publish(j) {
  const dir = path.join(ROOT, 'jobs', j.id), st = settings();
  const meta = { title: j.script.title, description: [j.script.description, j.files?.credits].filter(Boolean).join('\n\n').slice(0, 4900), tags: j.script.tags || [], privacy: (j.flowId && FL.getFlow(j.flowId)?.upload.privacy) || st.youtubePrivacy, isShort: j.format === 'short', thumbnail: path.join(dir, 'thumb.jpg'), madeForKids: false };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  setStatus(j, 'uploading', 'uploading');
  const targets = j.targets || { youtube: st.youtube, instagram: st.instagram && j.format === 'short', facebook: !!st.facebook };
  for (const pf of ['youtube', 'instagram', 'facebook']) {
    if (!targets[pf] || j.uploads[pf]?.ok) continue;
    const fl = j.flowId ? FL.getFlow(j.flowId) : null, env = CN.envFor(fl, pf);
    if (!env) { j.uploads[pf] = { ok: false, error: `"${fl.name}" has no ${pf} account connected, so nothing was uploaded. Connect it in Settings > YouTube channels (or Channels > Edit > Uploads), then press Retry upload.`, at: Date.now() }; jlog(j, `${pf}: not uploaded, channel has no account`); save(); continue; }
    const r = await uploader(pf, ['upload', path.join(dir, 'final.mp4'), path.join(dir, 'meta.json')], env);
    j.uploads[pf] = { ...r, at: Date.now() }; jlog(j, `${pf}: ${r.ok ? 'uploaded ' + r.url : 'FAILED ' + r.error}`); save();
  }
  const bad = Object.entries(j.uploads).filter(([, r]) => !r.ok);
  setStatus(j, bad.length ? 'upload_failed' : 'published', bad.length ? 'some uploads failed; fix settings and press Retry upload' : 'published');
}

// ---------------- scheduler ----------------
async function runDaily(date = today()) {
  const st = settings(), existing = db().jobs.filter(j => j.date === date && j.slot);
  if (existing.length) return existing;
  note(`creating today's plan (${date}) from theme "${st.activeTheme}"`);
  const t1 = await takeTopic(st.activeTheme), t2 = await takeTopic(st.activeTheme);
  const l1 = createJob({ format: 'long', theme: st.activeTheme, topic: t1, slot: 'long1', date });
  const l2 = createJob({ format: 'long', theme: st.activeTheme, topic: t2, slot: 'long2', date });
  [[l1, 'short1'], [l1, 'short2'], [l2, 'short3'], [l2, 'short4']].forEach(([p, s]) => createJob({ format: 'short', theme: st.activeTheme, topic: p.topic, slot: s, date, parent: p.id }));
  return db().jobs.filter(j => j.date === date && j.slot);
}
const hm = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
setInterval(async () => {
  if (!WORKER) return;
  const st = settings(), now = new Date(), mins = now.getHours() * 60 + now.getMinutes(), d = today();
  try {
    // nothing is made automatically until the owner creates a channel (a fresh install starts empty)
    await FL.tick(createJob, note);
    for (const j of db().jobs.filter(j => j.status === 'approved')) {
      const due = j.publishNow || j.date < d || (j.publishAt ? mins >= hm(j.publishAt) : j.slot ? mins >= hm(st.publishTimes[j.slot] || '00:00') : true);
      if (due && !publishing.has(j.id)) { publishing.add(j.id); publish(j).finally(() => publishing.delete(j.id)); }
    }
  } catch (e) { note('scheduler: ' + e.message); }
}, 30 * 1000);
const publishing = new Set();

FL.migrate();
// on start, resume anything interrupted
if (WORKER) for (const j of db().jobs) {
  if (j.status === 'writing') queueWrite(j.id);
  if (j.status === 'rendering' || j.status === 'queued_render') { j.status = 'queued_render'; delete j.lease; if (!j.queuedAt) WK.queued(j); }
  if (j.status === 'uploading') j.status = 'approved';
}

// ---------------- HTTP ----------------
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
const body = req => new Promise(r => { let s = ''; req.on('data', d => s += d); req.on('end', () => { try { r(s ? JSON.parse(s) : {}); } catch { r({}); } }); });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.srt': 'text/plain; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
function serveFile(req, res, file, any = false) {
  if ((!any && !file.startsWith(ROOT)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, { error: 'not found' });
  const size = fs.statSync(file).size, type = MIME[path.extname(file)] || 'application/octet-stream', range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {
    const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
    return fs.createReadStream(file, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', ...(type.startsWith('text/html') ? { 'Cache-Control': 'no-store' } : {}) }); fs.createReadStream(file).pipe(res);
}
// after Google/Facebook sign-in: save, then send the browser back to the dashboard page it came from
function backTo(res, ok, msg, back) {
  const q = new URLSearchParams({ cmsg: msg, cok: ok ? '1' : '0', back: back || 'settings' });
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><meta charset=utf-8><title>AutoTube Studio</title><meta http-equiv=refresh content="1;url=http://localhost:${PORT}/?${q}"><body style="background:#0b0c0f;color:#eee;font:16px system-ui;padding:3em"><h2>${ok ? 'Connected' : 'Not connected'}</h2><p>${msg.replace(/[<>&]/g, '')}</p><p>Taking you back to AutoTube Studio...</p></body>`);
}
async function oauthDone(res, fn) { try { const r = await fn(); connections(true).catch(() => {}); return backTo(res, true, r.msg, r.back); } catch (e) { return backTo(res, false, e.message, e.back); } }
let conn = { youtube: null, instagram: null, facebook: null, at: 0 };
async function connections(force) {
  if (force || Date.now() - conn.at > 5 * 60 * 1000) {
    conn.at = Date.now();
    const [y, i, f] = await Promise.all(['youtube', 'instagram', 'facebook'].map(pf => uploader(pf, ['status'], { HS_UPLOADER_ROOT: ROOT })));
    conn.youtube = y; conn.instagram = i; conn.facebook = f;
  }
  return conn;
}

// A plan that breaks the theme rules (e.g. written before a rule changed): Claude changes only its themes, keeps the
// narration, facts and title, and the plan comes back for approval. Runs in the background.
const fixing = new Set();
async function fixThemes(j) {
  if (fixing.has(j.id)) return; fixing.add(j.id);
  try {
    const before = validate(j), errs = before.errs.filter(FIXABLE); if (!errs.length) return;
    const domain = j.script.domain === 'exam' ? 'exam' : 'history', recent = [...new Set(db().jobs.filter(x => x.flowId === j.flowId && x.id !== j.id && x.script && Array.isArray(x.script.chapters)).slice(-6).flatMap(x => x.script.chapters.map(c => c.style)))];
    setStatus(j, 'writing', 'Claude is fixing the themes of this plan (' + errs.join('; ') + ')');
    const prompt = `You are the director of this video. Its plan (JSON below) breaks these theme rules:
- ${errs.join('\n- ')}

${themeRules(j.format === 'long', domain, recent)}

Return the complete corrected plan JSON, nothing else. Keep the facts, the title, description and tags exactly as they are. ${LEN_FIX} Change only the "style" (and "why") of the chapters you must change, choosing by content from the themes above; for every chapter whose theme changes, rewrite its shots so they fit the new theme: an "anime" shot becomes a "scene" shot with an "action" written for the new theme's look; keep "at" words. Whiteboard teaching shots (write, quiz, steps, sim, diagram) stay on whiteboard chapters.

THE PLAN:
${JSON.stringify(j.script)}`;
    const fixed = extractJSON(await askClaude(prompt, { model: settings().claudeModel, timeoutMs: 30 * 60 * 1000 }));
    for (const k of ['domain', 'look', 'userMedia', 'title']) if (j.script[k] !== undefined) fixed[k] = j.script[k];
    const v = normalizePlan(fixed, j.format);
    if (v.errs.filter(FIXABLE).length >= errs.length) { setStatus(j, 'script_review', 'theme fix did not help; the plan is unchanged (use Rewrite)'); return; }
    j.script = v.plan; delete v.plan; j.validation = v;
    setStatus(j, 'script_review', 'themes fixed: ' + j.script.chapters.map(c => c.style).join(', ') + '. Check it and approve.');
  } catch (e) { setStatus(j, 'script_review', 'theme fix failed: ' + e.message); }
  finally { fixing.delete(j.id); save(); }
}
// what a new user still has to do (shown on the welcome card); only says whether things exist, never their values
function setupStatus() {
  const has = f => { try { return fs.existsSync(f); } catch { return false; } };
  let eleven = !!process.env.ELEVENLABS_API_KEY; try { const k = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'elevenlabs.json'), 'utf8')); eleven = eleven || !!(k.apiKey || k.key); } catch {}
  return {
    claude: !!process.env.ANTHROPIC_API_KEY || has(path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', '.credentials.json')),
    library: has(path.join(settings().libraryPath || '', 'core', 'render', 'video.mjs')),
    youtube: has(path.join(ROOT, 'config', 'youtube_client.json')),
    eleven,
  };
}
// Delete a video for good: its record and its jobs/<id> folder. withIdea also removes the idea it came from;
// otherwise that idea goes back to "new" so it can be made again. Not while it is being rendered or uploaded.
function dropJob(j, withIdea) {
  if (['rendering', 'uploading'].includes(j.status)) return 'It is being ' + (j.status === 'rendering' ? 'made' : 'uploaded') + ' right now. Delete it when that has finished.';
  db().jobs = db().jobs.filter(x => x.id !== j.id);
  for (const r of ID.runs()) for (const i of r.ideas.slice()) if (i.jobId === j.id) {
    if (withIdea) r.ideas = r.ideas.filter(x => x !== i); else { delete i.jobId; delete i.jobStatus; i.status = 'new'; }
  }
  save();
  try { fs.rmSync(path.join(ROOT, 'jobs', j.id), { recursive: true, force: true }); } catch (e) { note('could not remove the folder of ' + j.id + ': ' + e.message); }
  return null;
}
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname, M = req.method;
  // other PCs may only reach the worker API and job files, and only with the worker token; the dashboard stays private to this PC
  // other devices: render workers use the worker token; people use the dashboard password (node tools/set-password.mjs)
  if (p === '/healthz') { const lp = limitPause(); return send(res, 200, { ok: true, uptimeMin: Math.round(process.uptime() / 60), freeGB: OP.freeGB(), claudeLimitUntil: lp ? new Date(lp).toISOString() : null, publicUrl: OP.isLocal(req) ? TN.publicUrl() : undefined }); }
  if (!OP.isLocal(req) && !((p.startsWith('/api/worker/') || p.startsWith('/jobs/')) && WK.authOk(req))) {
    if (!OP.loginOn()) { res.writeHead(403); return res.end('AutoTube Studio: this PC only. To open it from other devices, set a password on the server: node tools/set-password.mjs'); }
    if (await OP.loginRoute(req, res, p, () => new Promise(r => { let s = ''; req.on('data', d => { s += d; if (s.length > 4096) req.destroy(); }); req.on('end', () => r(s)); }))) return;
    if (!OP.signedIn(req)) { if (p.startsWith('/api/')) return send(res, 401, { error: 'sign in first' }); res.writeHead(302, { Location: '/login' }); return res.end(); }
    if (!OP.sameOrigin(req)) { res.writeHead(403); return res.end('blocked: request from another site'); }
  }
  if (p.startsWith('/api/worker/')) { try { await WK.handle(req, res, p, body, send); } catch (e) { send(res, 500, { error: e.message }); } return; }
  try {
    // ---- account connection (OAuth callbacks land here) ----
    if ((p === '/' && u.searchParams.get('state') && CN.isPending(u.searchParams.get('state'))) || p === '/oauth/meta') return oauthDone(res, () => p === '/' ? CN.googleCallback(u.searchParams) : CN.metaCallback(u.searchParams));
    const cs = /^\/connect\/(google|meta)\/start$/.exec(p);
    if (cs) { try { const to = cs[1] === 'google' ? CN.googleStart(u.searchParams.get('scope'), u.searchParams.get('back')) : CN.metaStart(u.searchParams.get('scope'), u.searchParams.get('back')); res.writeHead(302, { Location: to }); return res.end(); } catch (e) { return backTo(res, false, e.message, u.searchParams.get('back')); } }
    // ---- ElevenLabs voice ----
    if (p.startsWith('/eleven-sample/')) return serveFile(req, res, path.join(EL.SAMPLES, path.basename(decodeURIComponent(p))));
    if (p === '/api/eleven' && M === 'GET') return send(res, 200, EL.info());
    // one calendar for every channel: past videos (with status and links) and what each channel will make next
    if (p === '/api/calendar' && M === 'GET') {
      const back = Math.min(60, +u.searchParams.get('back') || 14), ahead = Math.min(90, +u.searchParams.get('days') || 35), byDate = new Map();
      const add = (date, dow, it) => { if (!byDate.has(date)) byDate.set(date, { date, dow, items: [] }); byDate.get(date).items.push(it); };
      for (const f of FL.flows()) for (const d of FL.calendar(f, ahead, back).days) {
        for (const j of d.jobs) add(d.date, d.dow, { ...j, flowId: f.id, channel: f.name });
        for (const q of d.planned) add(d.date, d.dow, { ...q, planned: true, flowId: f.id, channel: f.name });
      }
      const t0 = new Date(); t0.setDate(t0.getDate() - back); const from = t0.toISOString().slice(0, 10);
      for (const j of db().jobs.filter(j => !j.flowId && j.date >= from)) add(j.date, new Date(j.date + 'T12:00:00').getDay(), { id: j.id, format: j.format, title: (j.script && j.script.title) || j.topic, topic: j.topic, status: j.status, publishAt: j.publishAt, flowId: null, channel: 'Made by hand' });
      return send(res, 200, { channels: FL.flows().map(f => ({ id: f.id, name: f.name, enabled: f.enabled })), days: [...byDate.values()].sort((a, b) => a.date < b.date ? -1 : 1) });
    }
    // month plan: dated titles a channel makes on their day (lib/flows.mjs runFlow); the owner edits a title, its themes or its day
    const monm = /^\/api\/flows\/([^/]+)\/month$/.exec(p);
    if (monm) {
      const f = FL.getFlow(monm[1]); if (!f) return send(res, 404, { error: 'no such channel' });
      if (M === 'GET') return send(res, 200, { month: f.month || {}, themes: themesFor(f.domain === 'exam' ? 'exam' : 'history').map(t => ({ slug: t.slug, name: t.name })) });
      if (M === 'POST') { try { const mb = await body(req); return send(res, 200, { ok: true, item: FL.editMonth(f, mb.date, mb.id, mb) }); } catch (e) { return send(res, 400, { error: e.message }); } }
    }
    const calm = /^\/api\/flows\/([^/]+)\/calendar$/.exec(p);
    if (calm && M === 'GET') { const f = FL.getFlow(calm[1]); return f ? send(res, 200, FL.calendar(f, +u.searchParams.get('days') || 28)) : send(res, 404, { error: 'no such channel' }); }
    if (p === '/api/eleven/clone-upload' && M === 'POST') { try { return send(res, 200, await EL.cloneUpload(req, decodeURIComponent(req.headers['x-name'] || ''), decodeURIComponent(req.headers['x-filename'] || ''))); } catch (e) { return send(res, 400, { error: e.message }); } }
    if (p === '/api/connect' && M === 'GET') return send(res, 200, await CN.status(u.searchParams.get('scope'), uploader));
    if (p === '/' || p === '/index.html') return serveFile(req, res, path.join(ROOT, 'dashboard', 'index.html'));
    if (p.startsWith('/jobs/') || p.startsWith('/previews/')) return serveFile(req, res, path.join(ROOT, p.startsWith('/previews/') ? 'dashboard' : '', decodeURIComponent(p)));
    let sm = /^\/style-(preview|poster)\/([a-z0-9-]+)\.(mp4|jpg)$/.exec(p);
    if (sm) { const st = styleOf(sm[2]); const f = st && (sm[1] === 'preview' ? st.previewPath : st.posterPath); return f ? serveFile(req, res, f, true) : send(res, 404, { error: 'no preview' }); }
    if (p === '/api/styles') return send(res, 200, listStyles().map(({ previewPath, posterPath, ...x }) => ({ ...x, previewUrl: x.hasPreview ? `/style-preview/${x.slug}.mp4` : null, posterUrl: posterPath ? `/style-poster/${x.slug}.jpg` : null, presetImg: x.preset ? { h: `/previews/${x.preset}_h.jpg`, v: `/previews/${x.preset}_v.jpg` } : null })));
    if (p === '/api/state') {
      const jobs = db().jobs.slice(-200).map(({ log, script, ...j }) => ({ ...j, title: script?.title, styles: script?.chapters ? script.chapters.map(c => c.style) : undefined, logTail: (log || []).slice(-1)[0] }));
      return send(res, 200, { flows: FL.flows().map(f => ({ ...f, next: FL.nextRun(f), jobs: db().jobs.filter(j => j.flowId === f.id).length })), packs: PACKS, v2styles: V2STYLES, settings: settings(), themes: db().themes, jobs, activity: activity.slice(0, 40), queues: { writing: writeQ.length + writing, rendering: WK.stats().rendering + WK.stats().waiting }, workers: { ...WK.stats(), token: WK.token(), lan: !!settings().lanWorkers, ips: WK.lanAddresses(), port: PORT }, connections: conn, elevenVoices: EL.voiceOptions(), today: today(), publicUrl: TN.publicUrl(), setup: setupStatus(), ideaRuns: ID.runs().slice(-30).map(r => ({ ...r, ideas: r.ideas.map(i => ({ ...i, jobStatus: i.jobId ? job(i.jobId)?.status : undefined })) })) });
    }
    if (p === '/api/connections') return send(res, 200, await connections(true));
    const m = /^\/api\/jobs\/([^/]+)(?:\/(\w[\w-]*))?$/.exec(p);
    // narration script to read aloud, and the user's own voice recording
    // the creator's own photos / video clips for a draft video, then "start" writes the plan around them
    const mm = /^\/api\/jobs\/([^/]+)\/(media|media-remove|start)$/.exec(p);
    if (mm && M === 'POST') {
      const j = job(mm[1]); if (!j) return send(res, 404, { error: 'no job' });
      if (mm[2] === 'media') {
        const name = String(req.headers['x-filename'] || 'file'), ext = path.extname(name).toLowerCase(), kind = /^\.(jpe?g|png|webp|bmp|tiff?)$/.test(ext) ? 'image' : /^\.(mp4|mov|webm|mkv|avi|m4v)$/.test(ext) ? 'video' : null;
        if (!kind) return send(res, 400, { error: 'use a photo (jpg, png, webp) or a video (mp4, mov, webm)' });
        j.media = j.media || []; const id = 'u' + String(j.media.length + 1).padStart(2, '0'); fs.mkdirSync(path.join(ROOT, 'jobs', j.id, 'media'), { recursive: true });
        const file = 'media/' + id + ext, ws = fs.createWriteStream(path.join(ROOT, 'jobs', j.id, file)); req.pipe(ws); await new Promise((ok, bad) => { ws.on('finish', ok); ws.on('error', bad); });
        let dur = 0; if (kind === 'video') { try { dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(ROOT, 'jobs', j.id, file)]).toString().trim() || 0; } catch {} }
        j.media.push({ id, file, kind, name, dur, desc: decodeURIComponent(String(req.headers['x-desc'] || '')) || name }); jlog(j, `added your ${kind} ${name} as ${id}`); save(); return send(res, 200, j);
      }
      if (mm[2] === 'media-remove') { const b2 = await body(req); j.media = (j.media || []).filter(m => m.id !== b2.id); save(); return send(res, 200, j); }
      if (mm[2] === 'start') { if (j.status !== 'draft') return send(res, 400, { error: 'already started' }); setStatus(j, 'writing', 'planning the video around your content'); queueWrite(j.id); return send(res, 200, j); }
    }
    const vm = /^\/api\/jobs\/([^/]+)\/(narration\.txt|voice|voice-remove)$/.exec(p);
    if (vm) {
      const j = job(vm[1]); if (!j || (!j.script && vm[2] === 'narration.txt')) return send(res, 404, { error: 'no job or plan yet' });
      if (vm[2] === 'narration.txt') {
        const said = (j.script.chapters || []).flatMap((c, ci) => [c.title ? `\n— ${c.title.join(': ')} —\n` : '', ...c.lines.map(l => l.say)]).filter(Boolean).join('\n\n');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${j.id}-narration.txt"` });
        return res.end(`${j.script.title}\n\nRead each paragraph in order, calmly, with a short pause between paragraphs. Stumbles are fine: just repeat the sentence.\n\n${said}\n`);
      }
      if (vm[2] === 'voice-remove' && M === 'POST') { delete j.voiceFile; jlog(j, 'own recording removed: the AI voice will be used'); save(); return send(res, 200, j); }
      if (vm[2] === 'voice' && M === 'POST') {
        const ext = (path.extname(String(req.headers['x-filename'] || '')).toLowerCase().match(/^\.(wav|mp3|m4a|aac|ogg|flac|webm|mp4)$/) || ['.wav'])[0];
        const dir = path.join(ROOT, 'jobs', j.id); fs.mkdirSync(dir, { recursive: true });
        const file = 'myvoice' + ext, ws = fs.createWriteStream(path.join(dir, file)); let size = 0;
        req.on('data', d => { size += d.length; if (size > 500 * 1024 * 1024) req.destroy(); });
        req.pipe(ws); await new Promise((ok, bad) => { ws.on('finish', ok); ws.on('error', bad); });
        j.voiceFile = file; jlog(j, `own recording uploaded (${(size / 1048576).toFixed(1)} MB): it will replace the AI voice`); save();
        return send(res, 200, j);
      }
    }
    if (m && M === 'GET') { const j = job(m[1]); return j ? send(res, 200, j) : send(res, 404, { error: 'no job' }); }
    if (M !== 'POST') return send(res, 404, { error: 'not found' });
    const b = await body(req);
    const em = /^\/api\/eleven\/(key|settings|check|clone-extracted|sample|remove|add-id)$/.exec(p);
    if (em && M === 'POST') { try { const a = em[1]; return send(res, 200, a === 'key' ? EL.saveKey(b.apiKey) : a === 'settings' ? EL.saveSettings(b) : a === 'check' ? await EL.check() : a === 'clone-extracted' ? await EL.cloneExtracted(b.name) : a === 'sample' ? await EL.sample(b.voiceId) : a === 'remove' ? EL.removeVoice(b.voiceId) : EL.addVoiceId(b.voiceId, b.name)); } catch (e) { return send(res, 400, { error: e.message }); } }
    const ca = /^\/api\/connect\/(google-client|meta-app|meta-select|meta-token|disconnect|test)$/.exec(p);
    if (ca && M === 'POST') { const a = ca[1], sc = b.scope || 'studio'; let r;
      if (a === 'google-client') r = CN.saveGoogleClient(sc, b); else if (a === 'meta-app') r = CN.saveMetaApp(sc, b); else if (a === 'meta-select') r = CN.metaSelect(sc, b.pageId);
      else if (a === 'meta-token') r = await CN.metaToken(sc, b.token); else if (a === 'disconnect') r = CN.disconnect(sc, b.what); else r = CN.startTest(sc, b.platform, uploader);
      if (sc === 'studio') connections(true).catch(() => {}); return send(res, 200, r); }
    if (p === '/api/settings') { const before = settings().renderSlots; const r = saveSettings(b); if (b.renderSlots != null && +b.renderSlots !== +before) WK.restartLocal(PORT); return send(res, 200, r); }
    if (p === '/api/flows') { let f = b.id ? FL.getFlow(b.id) : null; if (!f) { f = FL.defaultFlow(); FL.flows().push(f); } const keep = { id: f.id, runs: f.runs, used: f.used, createdAt: f.createdAt, month: f.month }, was = { channel: f.channel, schedule: f.schedule, upload: f.upload }; Object.assign(f, b, keep); if (b.channel) f.channel = { ...was.channel, ...b.channel }; if (b.schedule) f.schedule = { ...was.schedule, ...b.schedule }; if (b.upload) f.upload = { ...was.upload, ...b.upload }; save(); return send(res, 200, f); }
    const fm = /^\/api\/flows\/([^/]+)\/(delete|run|research|connections)$/.exec(p);
    if (fm) { const f = FL.getFlow(fm[1]); if (!f) return send(res, 404, { error: 'no such autoflow' });
      if (fm[2] === 'delete') { FL.flows().splice(FL.flows().indexOf(f), 1); save(); return send(res, 200, { ok: true }); }
      if (fm[2] === 'run') { const ds = b.date || today(); delete f.runs[ds]; const js = await FL.runFlow(f, ds, createJob, note); return send(res, 200, { jobs: js.map(j => j.id) }); }
      if (fm[2] === 'research') return send(res, 200, { topics: await FL.researchTopics(f, +b.n || 12) });
      if (fm[2] === 'connections') return send(res, 200, await CN.status(f.id, uploader)); }
    if (p === '/api/themes') { // {name, topics?}
      let th = theme(b.name); if (!th) { th = { name: b.name, topics: [] }; db().themes.push(th); }
      if (Array.isArray(b.topics)) th.topics = b.topics;
      if (b.shortStyle && styleOf(b.shortStyle)) th.shortStyle = b.shortStyle;
      if (b.pack && PACKS[b.pack]) th.pack = b.pack;
      if (b.longStyle) { if (styleOf(b.longStyle)?.mode !== 'fast') return send(res, 400, { error: 'Long videos need a fast template style (AI-built styles are for Shorts only)' }); th.longStyle = b.longStyle; }
      save(); return send(res, 200, th);
    }
    if (p === '/api/themes/delete') { db().themes = db().themes.filter(t => t.name !== b.name); save(); return send(res, 200, { ok: true }); }
    if (p === '/api/topics/suggest') return send(res, 200, { topics: await suggestTopics(b.theme) });
    if (p === '/api/run-daily') return send(res, 200, { jobs: (await runDaily(b.date || today())).map(j => j.id) });
    // Settings > Claude: sign-in state, sign in on this computer, API key, test (never returns the key or the account email)
    if (p === '/api/claude/status') return send(res, 200, await CA.status(!!b.fresh));
    if (p === '/api/claude/login') { if (!OP.isLocal(req)) return send(res, 400, { error: 'Sign in on the computer that runs AutoTube Studio (the browser opens there), or use an API key.' }); return send(res, 200, CA.login(b.mode)); }
    if (p === '/api/claude/logout') { if (!OP.isLocal(req)) return send(res, 400, { error: 'Sign out on the computer that runs AutoTube Studio.' }); return send(res, 200, await CA.logout()); }
    if (p === '/api/claude/key') { try { return send(res, 200, CA.setKey(b.key)); } catch (e) { return send(res, 400, { error: e.message }); } }
    if (p === '/api/claude/test') return send(res, 200, await CA.test());
    if (p === '/api/ideas') { try { return send(res, 200, ID.startRun(b, note)); } catch (e) { return send(res, 400, { error: e.message }); } }
    if (p === '/api/ideas/retry') { const r = ID.findRun(b.run); if (!r) return send(res, 404, { error: 'not found' }); db().ideaRuns = ID.runs().filter(x => x !== r); return send(res, 200, ID.startRun({ prompt: r.prompt, flowId: r.flowId, format: r.format, n: r.n }, note)); }
    if (p === '/api/ideas/delete') { db().ideaRuns = ID.runs().filter(x => x.id !== b.run); save(); return send(res, 200, { ok: true }); }
    if (p === '/api/ideas/remove') {   // one idea; with video: true its video goes too
      const r = ID.findRun(b.run), i = r?.ideas.find(x => x.id === b.id); if (!i) return send(res, 404, { error: 'idea not found' });
      const j = i.jobId && db().jobs.find(x => x.id === i.jobId);
      if (b.video && j) { const why = dropJob(j, true); if (why) return send(res, 400, { error: why }); }
      else { r.ideas = r.ideas.filter(x => x !== i); if (j) delete j.fromIdea; save(); }
      return send(res, 200, { ok: true });
    }
    if (p === '/api/ideas/reject') { const i = ID.findRun(b.run)?.ideas.find(x => x.id === b.id); if (i && i.status === 'new') { i.status = 'rejected'; save(); } return send(res, 200, { ok: true }); }
    if (p === '/api/ideas/approve') {   // the owner picked a title: Claude researches it and writes the plan (it then waits for plan approval as usual)
      const r = ID.findRun(b.run), i = r?.ideas.find(x => x.id === b.id);
      if (!i) return send(res, 404, { error: 'idea not found' }); if (i.jobId) return send(res, 400, { error: 'already approved' });
      const fl = r.flowId ? FL.getFlow(r.flowId) : null, format = b.format === 'long' ? 'long' : b.format === 'short' ? 'short' : i.format;
      const j = createJob({ format, theme: fl ? fl.channel.niche : settings().activeTheme, topic: i.title, date: today(), flowId: fl ? fl.id : null, mode: 'brief', brief: { title: i.title, prompt: ID.briefFor(r, i) } });
      j.fromIdea = { run: r.id, id: i.id, sources: i.sources }; i.status = 'approved'; i.jobId = j.id; i.format = format; save();
      return send(res, 200, j);
    }
    if (p === '/api/jobs') { const fl = b.flowId ? FL.getFlow(b.flowId) : null; if (!fl && !FL.flows().length) return send(res, 400, { error: 'Create a channel first (Channels > Add a channel).' }); const mode = b.mode || 'auto'; let topic = b.topic; if (mode === 'auto' && !topic && fl) { if (!fl.topics.length) await FL.researchTopics(fl); topic = fl.topics.shift(); fl.used.push(topic); save(); } if (mode === 'brief' && !topic) topic = b.title; const j = createJob({ format: b.format || 'short', theme: fl ? fl.channel.niche : (b.theme || settings().activeTheme), topic: topic || 'A surprising true story', date: today(), style: b.style || null, flowId: fl ? fl.id : null, mode, brief: mode === 'brief' || b.title || b.prompt ? { title: b.title || '', prompt: b.prompt || '' } : null, draft: mode === 'own' }); if (mode === 'own') { j.voiceFirst = !!b.voiceFirst; save(); } return send(res, 200, j); }
    if (m) {
      const j = job(m[1]); if (!j) return send(res, 404, { error: 'no job' });
      const a = m[2];
      if (a === 'script') { j.script = b.script; const v = validate(j); if (isV2(j)) { j.script = v.plan; delete v.plan; } j.validation = v; jlog(j, 'script edited'); save(); return send(res, 200, j); }
      if (a === 'approve-script') {
        if (isV2(j) && (j.script || {}).look !== 'lib') return send(res, 400, { error: 'Blocked by THEMES.md: this plan does not use a Lemo Opuscar library theme. Only the themes in lib/v2/themes.mjs may be rendered. Reject it and make a new plan.' });
        { const v = validate(j); if (isV2(j)) { j.script = v.plan; delete v.plan; } j.validation = v; }
        if (isV2(j) && (j.validation.errs || []).some(FIXABLE)) { save(); fixThemes(j); return send(res, 409, { error: 'This plan needs a fix first (' + j.validation.errs.filter(FIXABLE).join('; ') + '). Claude is fixing it now, keeping the facts (about a minute). It comes back as "Plan ready": check it and approve again.' }); }
        if (j.validation.errs.length) return send(res, 400, { error: j.validation.errs.join('; ') });
        setStatus(j, 'queued_render', 'script approved'); queueRender(j.id);
        return send(res, 200, j);
      }
      if (a === 'regenerate') { j.script = null; j.topic = b.topic || j.topic; setStatus(j, 'writing', 'regenerating script' + (b.notes ? ': ' + b.notes : '')); if (b.notes) j.angle = (j.angle ? j.angle + '. ' : '') + 'Editor notes: ' + b.notes; queueWrite(j.id); return send(res, 200, j); }
      if (a === 'style') {
        const st = styleOf(b.style); if (!st) return send(res, 400, { error: 'unknown style' });
        if (j.format === 'long' && st.mode === 'ai') return send(res, 400, { error: 'AI-built styles are for Shorts only. Pick a fast style for long videos.' });
        j.style = b.style; jlog(j, 'style set to ' + st.name); save(); return send(res, 200, j);
      }
      if (a === 'thumbnail') { if (!isV2(j) || !j.files) return send(res, 400, { error: 'finish the video first' }); const { makeThumbnail } = await import('./lib/v2/thumb.mjs'); const dir = path.join(ROOT, 'jobs', j.id); let TL = null; try { TL = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.js'), 'utf8').replace(/^window.TL=/, '').replace(/;s*$/, '')); } catch {} const r = await makeThumbnail({ dir, plan: j.script, TL, channel: j.channelName || settings().channelName, text: b.text || undefined }); if (b.text) j.script.thumbText = b.text; j.updatedAt = Date.now(); jlog(j, 'thumbnail remade: "' + r.text + '"'); save(); return send(res, 200, j); }
      // hold: take a waiting or in-progress video out of the queue (its plan and files stay); resume puts it back
      if (a === 'hold') { if (!['queued_render', 'rendering'].includes(j.status)) return send(res, 400, { error: 'Only a video that is waiting or being made can be put on hold.' }); delete j.lease; setStatus(j, 'on_hold', 'on hold: it will not be made until you press Resume'); return send(res, 200, j); }
      if (a === 'resume') { if (j.status !== 'on_hold') return send(res, 400, { error: 'This video is not on hold.' }); setStatus(j, 'queued_render', 'resumed: back in the queue'); queueRender(j.id); return send(res, 200, j); }
      if (a === 'rerender') { setStatus(j, 'queued_render', 're-render requested'); queueRender(j.id); return send(res, 200, j); }
      if (a === 'approve-video') { j.targets = { youtube: !!b.youtube, instagram: !!b.instagram, facebook: !!b.facebook }; j.publishNow = !!b.now; setStatus(j, 'approved', b.now ? 'approved, publishing now' : `approved, will publish at ${settings().publishTimes[j.slot] || 'next check'}`); return send(res, 200, j); }
      if (a === 'retry-upload') { setStatus(j, 'approved', 'retrying upload'); j.publishNow = true; return send(res, 200, j); }
      if (a === 'reject') { setStatus(j, 'rejected', 'rejected' + (b.reason ? ': ' + b.reason : '')); return send(res, 200, j); }
      if (a === 'delete') { const why = dropJob(j, !!b.idea); return why ? send(res, 400, { error: why }) : send(res, 200, { ok: true }); }
    }
    send(res, 404, { error: 'unknown endpoint' });
  } catch (e) { send(res, 500, { error: e.message }); }
}).listen(PORT, process.env.HS_HOST || (settings().lanWorkers || OP.loginOn() ? '0.0.0.0' : '127.0.0.1'), () => { note(`AutoTube Studio running: http://localhost:${PORT}` + (OP.loginOn() ? ' (other devices: sign in with the dashboard password)' : '')); OP.startHousekeeping(note); TN.startTunnel(PORT, note, OP.loginOn); connections(true).catch(() => {}); pump(); if (WORKER) WK.startLocal(PORT); });
WK.init({ setStatus, jlog, onRendered, note });
ID.recover();
for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'exit']) process.on(sig, () => { try { save(); } catch {} TN.stopTunnel(); WK.stopLocal(); if (sig !== 'exit') process.exit(0); });
// one bad request or a failed background step must not take the whole studio down (the supervisor restarts it if it does die)
process.on('unhandledRejection', e => note('error (kept running): ' + String(e && e.stack || e).slice(0, 400)));
process.on('uncaughtException', e => { note('crash: ' + String(e && e.stack || e).slice(0, 400)); try { save(); } catch {} process.exit(1); });
