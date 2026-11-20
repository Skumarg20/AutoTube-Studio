// AutoTube Studio: local dashboard + automation.  Start: node server.js   then open http://localhost:4747
import './lib/env.js';   // config/.env first (keys, tunnel, port)
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn, execFileSync } from 'child_process';
import { ROOT, settings, saveSettings, db, save, job, newId, today } from './lib/store.js';
import { askClaude, extractJSON, scriptPrompt, topicsPrompt, anglesPrompt } from './lib/claude.js';
import { buildVideo, validateScript } from './lib/pipeline.js';
import { listStyles, styleOf } from './lib/styles.js';
import { planPrompt, normalizePlan, PACKS, STYLES as V2ALL, MY_STYLES } from './lib/v2/plan.js';
const V2STYLES = Object.fromEntries(Object.entries(V2ALL).filter(([k]) => MY_STYLES.includes(k)));
import { buildVideoV2 } from './lib/v2/build.js';
import { examPlanPrompt } from './lib/v2/exam.js';
import { histPlanPrompt } from './lib/v2/histprompt.js';
import * as FL from './lib/flows.js';
import * as CN from './lib/connect.js';
import * as EL from './lib/eleven.js';
import * as WK from './lib/workers.js';
import * as ID from './lib/ideas.js';
import * as OP from './lib/ops.js';
import * as TN from './lib/tunnel.js';
import * as CA from './lib/claudeauth.js';
import * as KB from './lib/kb.js';
import * as BR from './lib/brand.js';
import { PIPELINE, pipelineOf, castOf, castKey, castApproved, dropStaleApprovals, makeCastPhotos } from './lib/character/cast.js';
import { makeKeyframes } from './lib/character/clips.js';
import { castChangePrompt, videoPrompts, CAMERA } from './lib/character/prompts.js';
import { geminiReady, GEMINI_SETUP } from './lib/gemini.js';
import { themeRules, themesFor, themeOf, CHARACTER_SHOT } from './lib/v2/themes.js';
import { FILM_RULES } from './lib/v2/director.js';
import { limitPause } from './lib/claude.js';
import { run as runCmd } from './lib/pipeline.js';
const isV2 = j => j.engine === 'v2';
// what an editor can change in a finished video without making it from scratch (see lib/character/clips.js, lib/v2/voice.js)
const EDIT_TOOLS = `EDITING (this video is already made; prefer these small edits over rewriting):
- "trim": {"start": seconds, "end": seconds} on a line cuts that much (0-1.5) off the start or the end of what is seen and heard in that line.
- "speed" (0.85-1.3) plays a line slower or faster (picture and voice together); "gap" (0-1.5 s) is the pause after a line.
- "caption" on a line changes only the subtitle text (a typo, a shorter subtitle); top-level "captions": {"style": "word"|"phrase"|"off", "position": "low"|"middle"|"high", "size": "m"|"l"|"xl"} changes how subtitles look.
- A shot's "at" (a plain word of its line) sets when that shot starts; reorder, add or remove a line's shots to change what is on screen and when.
- A scene's "place"/"blocking" and a line's "action" change what a character clip shows; a line's "say", "emotion" or "pitch" changes what is said.
  Each of these makes that one line's clip again (it costs money), so change them only when a note asks for it; every other edit is free.`;
const LINE_EDIT_KEYS = ['trim', 'speed', 'gap', 'caption'];   // what the owner may change on a line by hand (lib/v2/plan.js normalizeLineEdits)
const PLAN_META = ['userMedia', 'domain', 'look', 'avoidOpen', 'fast', 'pipeline', 'language', 'captions'];
const keepPlanMeta = (from, to) => { for (const k of PLAN_META) if (from[k] !== undefined) to[k] = from[k]; return to; };
// plan problems Claude can fix by itself: theme rules and a Short that runs too long
const FIXABLE = e => e.startsWith('theme rules') || /^Short is about/.test(e);
const LEN_FIX = 'Keep every line\'s "say" word for word, EXCEPT when a rule says the Short is too long: then shorten "say" by cutting filler words (never facts, numbers or names) until the Short is under 55 seconds, and keep every "at" word in its line.';
// themes the owner picked by hand on the plan page win over the theme mixing rules: those rules become warnings
function ownerWins(j, v) {
  if (!j.ownerThemes || !Object.keys(j.ownerThemes).length || !v || !v.errs) return v;
  const own = v.errs.filter(e => e.startsWith('theme rules')); v.errs = v.errs.filter(e => !own.includes(e)); v.warns = [...own.map(e => e + ' (kept: you chose these themes)'), ...(v.warns || [])]; return v;
}
const validate = j => isV2(j) ? ownerWins(j, normalizePlan(j.script, j.format)) : validateScript(j.script, j.format);

const PORT = +process.env.PORT || 4747;
const WORKER = !process.env.NO_WORKER;   // NO_WORKER=1: dashboard only (no scheduler, no rendering)
const SLOTS = [['long1', 'long'], ['long2', 'long'], ['short1', 'short'], ['short2', 'short'], ['short3', 'short'], ['short4', 'short']];
const activity = [];
// problems the owner must see on the dashboard (red box at the top) until they press Clear: failed videos, failed
// uploads, studio errors. Kept in memory; the job's own log keeps the full story.
const problems = [];
function problem(msg, jobId = null) { problems.unshift({ at: Date.now(), msg: String(msg).slice(0, 500), jobId }); problems.length = Math.min(problems.length, 30); }
function note(msg) { const line = `${new Date().toLocaleTimeString()}  ${msg}`; activity.unshift(line); activity.length = Math.min(activity.length, 200); console.log(line); if (/^(error \(kept running\)|crash|scheduler:)|\bfailed:/i.test(msg) && !/": (failed|upload_failed) - /.test(msg)) problem(msg); }
function jlog(j, msg) { j.log = j.log || []; j.log.push(`${new Date().toLocaleTimeString()} ${msg}`); if (j.log.length > 300) j.log.splice(0, j.log.length - 300); }
function setStatus(j, s, msg) { j.status = s; j.updatedAt = Date.now(); if (msg) jlog(j, msg); save(); note(`${j.slot || j.format} "${j.topic}": ${s}${msg ? ' - ' + msg : ''}`); if (['failed', 'upload_failed'].includes(s)) problem(`"${(j.script && j.script.title) || j.topic}": ${msg || s}`, j.id); if (s === 'script_review') prepareReview(j); }
// a storyboard of the plan as one image (tools/storyboard.py): every shot with its real screen or a general scene card,
// so anyone can check the video before it is made. Instant, no Claude call; redone whenever the plan changes.
async function prepareReview(j) {
  if (j.pipeline === PIPELINE.character && castOf(j.script).length) {
    const changed = dropStaleApprovals(j); if (changed.length) jlog(j, 'changed since approved: ' + changed.join(', ') + '. Approve the new photo.');
    if (!geminiReady()) jlog(j, 'cast photos not made: Gemini is not set up (' + GEMINI_SETUP + ')');
    else try {
      if (castApproved(j)) await makeKeyframes(j, m => jlog(j, m)); else await makeCastPhotos(j, m => jlog(j, m));
      j.castAt = Date.now(); save();
    } catch (e) { jlog(j, 'cast: ' + String(e.message).slice(0, 300)); }
  }
  makeStoryboard(j);
}
function makeStoryboard(j) {
  try {
    if (!isV2(j) || !j.script || !Array.isArray(j.script.chapters)) return;
    const dir = path.join(ROOT, 'jobs', j.id); fs.mkdirSync(dir, { recursive: true });
    const used = new Set(j.script.chapters.flatMap(c => c.lines.flatMap(l => (l.shots || []).map(x => x.img))));
    const fl = j.flowId ? FL.getFlow(j.flowId) : null;
    // lines a character is seen saying show their storyboard frame (jobs/<id>/char/<line>.png) like an image
    const chapters = j.script.chapters.map(c => ({ ...c, lines: c.lines.map(l => ({ ...l, shots: (l.shots || []).map(x => x.type === CHARACTER_SHOT ? { ...x, img: 'char_' + l.id } : x) })) }));
    const frames = j.script.chapters.flatMap(c => c.lines).filter(l => l.camera === CAMERA.on).map(l => ({ id: 'char_' + l.id, file: `char/${l.id}.png`, label: (castOf(j.script).find(m => m.id === l.speaker) || {}).name || 'CHARACTER' }));
    fs.writeFileSync(path.join(dir, 'storyboard_plan.json'), JSON.stringify({ title: j.script.title, channel: fl ? fl.name : settings().channelName, chapters, media: [...(j.media || []).filter(m => used.has(m.id)), ...frames] }));
    const LIBP = settings().libraryPath, py = path.join(LIBP, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    runCmd(py, [path.join(ROOT, 'tools', 'storyboard.py'), dir, LIBP, ROOT], { env: { PYTHONIOENCODING: 'utf-8' } }).then(() => { j.storyboardAt = Date.now(); save(); }).catch(e => jlog(j, 'storyboard: ' + String(e.message).slice(0, 200)));
  } catch (e) { jlog(j, 'storyboard: ' + e.message); }
}

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
function createJob({ format, theme: th, topic, slot = null, date = today(), angle = null, parent = null, style = null, special = false, specialStyle = null, flowId = null, publishAt = null, mode = 'auto', brief = null, draft = false, fromIdea = null, pipeline = PIPELINE.classic }) {
  const j = { id: newId(date, slot || format), date, slot, format, theme: th, topic, angle, parent, engine: settings().engine || 'v2', pack: (flowId && FL.getFlow(flowId) ? FL.getFlow(flowId).pack : (theme(th) || {}).pack) || 'auto', flowId, publishAt, mode, brief, media: [], channelName: flowId && FL.getFlow(flowId) ? FL.getFlow(flowId).channel.name : settings().channelName, voice: flowId && FL.getFlow(flowId) ? FL.getFlow(flowId).voice : undefined, style: pickStyle(format, th, style), status: 'writing', createdAt: Date.now(), log: [], uploads: {} };
  j.pipeline = pipelineOf(pipeline);
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
          // company channels: the brand kit (logo, app screens, icons from the content drive) and product facts from the company KB
          if (fl && fl.brandKit) { args.brand = BR.attachBrand(j, fl); save(); if (args.brand.length) jlog(j, `brand kit: ${args.brand.length} images offered to the plan (logo, app screens, icons)`); }
          if (fl && fl.fast && j.format !== 'long') { args.fast = fl.fast; jlog(j, `fast mode: at most ${fl.fast.maxThemes || 2} theme(s), ${fl.fast.no3d === false ? '3D allowed' : 'no 3D themes'}${fl.fast.noReview ? ', no frame-check round' : ''}`); }
          if (j.pipeline === PIPELINE.character) { args.characterVideo = true; jlog(j, 'character video: Claude designs the cast; characters speak their own lines (Omni Flash)'); }
          if (fl && fl.kb) { jlog(j, 'reading the product knowledge base'); args.kb = await KB.factsFor([j.brief && j.brief.title, j.topic, j.angle, j.brief && j.brief.prompt && j.brief.prompt.slice(0, 300)], { log: m => jlog(j, m) }); }
          // THEMES.md: every channel plans in Lemo Opuscar library themes (exam: board + anime; history: the documentary themes)
          let planPrompt = exam ? examPlanPrompt(args) : histPlanPrompt({ ...args, domain: fl && fl.domain === 'general' ? 'general' : 'history' });
          if (j.fromIdea) { jlog(j, 'Claude is researching the title on the web, then writing the plan'); planPrompt = `RESEARCH FIRST: before writing anything, use WebSearch and WebFetch to research this video's title properly (several searches; read reliable pages, start with the sources in the brief). Verify every fact, date, number, formula and claim you will use; prefer what you verified over memory. Then write the plan exactly as specified below.

` + planPrompt; }
          const reply = await askClaude(planPrompt, { model: st.claudeModel, timeoutMs: 45 * 60 * 1000, extraArgs: j.fromIdea ? ID.WEB_TOOLS : [] });
          const raw = extractJSON(reply); raw.userMedia = j.media || []; if (j.brief && j.brief.title) raw.title = j.brief.title; if (exam) { raw.domain = 'exam'; raw.look = 'lib'; } else { raw.domain = 'history'; raw.look = 'lib'; }
          raw.avoidOpen = args.openers; if (args.fast) raw.fast = args.fast; raw.pipeline = j.pipeline; raw.language = fl ? fl.language || 'english' : 'english';
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
              keepPlanMeta(raw, fixed); if (j.brief && j.brief.title) fixed.title = j.brief.title;
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
      } catch (e) {
        // a failed plan is tried again by itself (2 more times, 3 min apart) before it needs the owner
        j.writeTries = (j.writeTries || 0) + 1;
        if (j.writeTries < 3 && !/Blocked by THEMES/.test(e.message)) { setStatus(j, 'writing', `plan failed (${e.message.slice(0, 200)}); trying again by itself in 3 min (try ${j.writeTries + 1} of 3)`); setTimeout(() => { if (job(j.id)?.status === 'writing') queueWrite(j.id); }, 3 * 60 * 1000); }
        else setStatus(j, 'failed', `plan failed${j.writeTries > 1 ? ` ${j.writeTries} times` : ''}: ${e.message}. Press "Rewrite the plan" to try again.`);
      }
    })().finally(() => { writing--; pump(); });
  }
}

// ---------------- uploads ----------------
function uploader(platform, args, env = {}) {
  return new Promise(resolve => {
    const p = spawn('node', [path.join(ROOT, 'uploaders', platform + '.js'), ...args], { cwd: ROOT, windowsHide: true, env: { ...process.env, ...env } });
    let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('error', e => resolve({ ok: false, error: e.message }));
    p.on('close', () => { const last = out.trim().split(/\r?\n/).pop(); try { resolve(JSON.parse(last)); } catch { resolve({ ok: false, error: (err || out || 'no output').slice(-400) }); } });
  });
}
// HS_TEST_MODE=1: a test copy of the studio (another server or port) that never uploads and never runs channel autopilot
const TEST_MODE = /^(1|true|yes|on)$/i.test(process.env.HS_TEST_MODE || '');
async function publish(j) {
  const dir = path.join(ROOT, 'jobs', j.id), st = settings();
  const meta = { title: j.script.title, description: [j.script.description, j.files?.credits].filter(Boolean).join('\n\n').slice(0, 4900), tags: j.script.tags || [], privacy: (j.flowId && FL.getFlow(j.flowId)?.upload.privacy) || st.youtubePrivacy, isShort: j.format === 'short', thumbnail: path.join(dir, 'thumb.jpg'), madeForKids: false };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  if (TEST_MODE) { j.uploads = { test: { ok: false, error: 'test server: uploads are switched off here (HS_TEST_MODE=1 in config/.env). Download the video from the dashboard, or upload it from the production studio.', at: Date.now() } }; save(); return setStatus(j, 'upload_failed', 'test server: nothing was uploaded'); }
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
    if (!TEST_MODE) await FL.tick(createJob, note);   // a test server makes only the videos the owner starts by hand
    for (const j of db().jobs.filter(j => j.status === 'approved')) {
      const due = j.publishNow || j.date < d || (j.publishAt ? mins >= hm(j.publishAt) : j.slot ? mins >= hm(st.publishTimes[j.slot] || '00:00') : true);
      if (due && !publishing.has(j.id)) { publishing.add(j.id); publish(j).finally(() => publishing.delete(j.id)); }
    }
    // a failed upload (network, YouTube busy) is tried again by itself up to 3 times, 15 min apart; a missing
    // account connection needs the owner, so that one waits for "Try the upload again"
    for (const j of db().jobs.filter(j => j.status === 'upload_failed' && (j.uploadTries || 0) < 3 && Date.now() - (j.updatedAt || 0) > 15 * 60 * 1000)) {
      const errs = Object.values(j.uploads || {}).filter(r => !r.ok).map(r => String(r.error || ''));
      if (!errs.length || errs.some(e => /account connected|not connected|config missing|not set up|invalid_grant|unauthori[sz]ed|permission|quota|test server/i.test(e)) || publishing.has(j.id)) continue;
      j.uploadTries = (j.uploadTries || 0) + 1; jlog(j, `upload: trying again by itself (${j.uploadTries} of 3)`);
      publishing.add(j.id); publish(j).finally(() => publishing.delete(j.id));
    }
  } catch (e) { note('scheduler: ' + e.message); }
}, 30 * 1000);
const publishing = new Set();

FL.migrate();
// on start, resume anything interrupted
if (WORKER) for (const j of db().jobs) {
  // a theme fix or theme change cut off by a restart: keep the plan the owner already has instead of writing a new one
  if (j.status === 'writing' && j.script && Array.isArray(j.script.chapters)) { setStatus(j, 'script_review', 'the studio restarted while Claude was changing this plan; the plan is as it was. Change the theme again if needed.'); continue; }
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
    keepPlanMeta(j.script, fixed); fixed.title = j.script.title;
    const v = normalizePlan(fixed, j.format);
    if (v.errs.filter(FIXABLE).length >= errs.length) { setStatus(j, 'script_review', 'theme fix did not help; the plan is unchanged (use Rewrite)'); return; }
    j.script = v.plan; delete v.plan; j.validation = v;
    setStatus(j, 'script_review', 'themes fixed: ' + j.script.chapters.map(c => c.style).join(', ') + '. Check it and approve.');
  } catch (e) { setStatus(j, 'script_review', 'theme fix failed: ' + e.message); }
  finally { fixing.delete(j.id); save(); }
}
// The owner changed some chapters' themes on the plan page. Claude rewrites ONLY those chapters' shots for the new
// theme; narration, facts and the owner's theme choice stay. If Claude fails, the plan is kept with simple shots.
async function rethemeChapters(j, changed) {
  if (fixing.has(j.id)) return; fixing.add(j.id);
  const want = Object.fromEntries(changed.map(i => [i, j.script.chapters[i].style]));
  const list = changed.map(i => { const t = themeOf(want[i]); return `- chapter ${i + 1}: now "${t.slug}" (${t.name}). Look: ${t.look}. Shot types it can draw: ${t.shots.join(', ')}. Never: ${t.never}`; }).join('\n');
  setStatus(j, 'writing', 'Claude is redrawing ' + changed.map(i => `chapter ${i + 1} as ${want[i]}`).join(', ') + ' (your theme change; narration stays)');
  const keep = () => { for (const i of changed) j.script.chapters[i].style = want[i]; };
  try {
    const prompt = `You are the director of this video. The owner changed the theme of some chapters:
${list}

Return the complete plan JSON, nothing else. Rules:
- Keep every chapter's "style" EXACTLY as it is in the plan (the owner chose them). Do not change any other chapter.
- In the changed chapters only, rewrite each line's "shots" so they use only the shot types listed for the new theme and fit its look: an "anime" shot becomes a "scene" shot with an "action" written for the new theme. Keep every "at" word, and keep "say" word for word.
- Update "why" of the changed chapters in one short sentence. Keep the facts, title, description and tags exactly as they are.
${FILM_RULES}

THE PLAN:
${JSON.stringify(j.script)}`;
    const fixed = extractJSON(await askClaude(prompt, { model: settings().claudeModel, timeoutMs: 30 * 60 * 1000 }));
    for (const k of ['domain', 'look', 'userMedia', 'title', 'description', 'tags']) if (j.script[k] !== undefined) fixed[k] = j.script[k];
    if (!Array.isArray(fixed.chapters) || fixed.chapters.length !== j.script.chapters.length) throw new Error('Claude returned a different number of chapters');
    j.script = fixed; keep();
    const v = validate(j); j.script = v.plan; delete v.plan; j.validation = v; keep();
    setStatus(j, 'script_review', 'theme changed: ' + changed.map(i => `chapter ${i + 1} is now ${want[i]}`).join(', ') + '. Check it and approve.');
  } catch (e) {
    keep(); const v = validate(j); j.script = v.plan; delete v.plan; j.validation = v; keep();
    setStatus(j, 'script_review', `theme changed, but Claude could not redraw the shots (${e.message.slice(0, 200)}); the chapter uses simple shots. Change it again or press Rewrite.`);
    problem(`"${j.script.title || j.topic}": theme change could not redraw the shots: ${e.message.slice(0, 200)}`, j.id);
  } finally { fixing.delete(j.id); save(); }
}
// the reviewer's changes from the storyboard: notes for the whole video and/or for single shots ("c-l-s" = chapter, line,
// shot, all from 0). Claude changes ONLY what was asked and keeps the rest of the plan; the storyboard is redone after.
async function reviseWithNotes(j, notes, shotNotes) {
  if (fixing.has(j.id)) return; fixing.add(j.id);
  const afterVideo = j.status === 'video_review';   // notes on the finished video: the video is made again right after
  const sc = j.script, fl = j.flowId ? FL.getFlow(j.flowId) : null;
  const asks = Object.entries(shotNotes || {}).map(([k, txt]) => {
    const [c, l, s] = k.split('-').map(Number), ln = sc.chapters[c] && sc.chapters[c].lines[l], sh = ln && ln.shots[s];
    return sh ? `- chapter ${c + 1}, line ${l + 1} ("${ln.say}"), shot ${s + 1} (now: ${sh.img ? 'image ' + sh.img + (sh.zoom ? ' zoom ' + sh.zoom : '') + '; ' : ''}${sh.text ? 'on screen "' + sh.text + '"; ' : ''}${sh.action || ''}): ${txt}` : null;
  }).filter(Boolean);
  const brand = (j.media || []).filter(m => m.brand).map(m => `- ${m.id}: ${m.desc}`).join('\n');
  const themes = fl && fl.fast && Array.isArray(fl.fast.themes) ? fl.fast.themes.join(', ') : '';
  setStatus(j, 'writing', `Claude is applying your ${afterVideo ? 'notes on the video' : 'storyboard changes'}` + (asks.length ? ` (${asks.length} shot note(s))` : ''));
  try {
    const prompt = `You are the ${afterVideo ? 'editor' : 'director'} of this video ad. The owner ${afterVideo ? 'watched the finished video' : 'reviewed the storyboard'} and wants these changes:
${notes ? `FOR THE WHOLE VIDEO: ${notes}\n` : ''}${asks.length ? `FOR SINGLE SHOTS:\n${asks.join('\n')}\n` : ''}
Return the complete plan JSON, nothing else. Rules:
- Change exactly what the owner asked, as well as you can; keep everything else as it is (other chapters, lines, shots, title, description, tags).
- If a note changes what is said, rewrite that "say" naturally in the same language and style; keep facts true (no invented features, numbers or offers).
- A shot may use one of these real images in "img" (with "zoom" set to one of its zoom targets when a field must be readable), never a made-up screen:
${brand || '(none)'}
${themes ? `- Every chapter "style" must be one of: ${themes}.` : ''}
${afterVideo ? EDIT_TOOLS + '\n' : ''}${FILM_RULES}

THE PLAN:
${JSON.stringify(sc)}`;
    const fixed = extractJSON(await askClaude(prompt, { model: settings().claudeModel, timeoutMs: 30 * 60 * 1000 }));
    if (!Array.isArray(fixed.chapters) || !fixed.chapters.length) throw new Error('Claude returned no chapters');
    keepPlanMeta(sc, fixed);
    j.script = fixed;
    const v = validate(j); j.script = v.plan; delete v.plan; j.validation = v;
    jlog(j, 'storyboard changes applied' + (notes ? ': ' + notes.slice(0, 160) : '') + (asks.length ? ` (+${asks.length} shot note(s))` : ''));
    if (afterVideo && !v.errs.length) { setStatus(j, 'queued_render', 'your notes are applied: the video is being made again (unchanged clips are reused)'); queueRender(j.id); }
    else setStatus(j, 'script_review', 'your changes are in the plan and the storyboard. Check it again, then approve.');
  } catch (e) {
    j.script = sc; setStatus(j, 'script_review', `your changes could not be applied (${String(e.message).slice(0, 200)}); the plan is as it was. Try again.`);
    problem(`"${sc.title || j.topic}": storyboard changes could not be applied: ${String(e.message).slice(0, 200)}`, j.id);
  } finally { fixing.delete(j.id); save(); }
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
  // other devices: render workers use the worker token; people use the dashboard password (node tools/set-password.js)
  if (p === '/healthz') { const lp = limitPause(); return send(res, 200, { ok: true, uptimeMin: Math.round(process.uptime() / 60), freeGB: OP.freeGB(), claudeLimitUntil: lp ? new Date(lp).toISOString() : null, publicUrl: OP.isLocal(req) ? TN.publicUrl() : undefined }); }
  if (!OP.isLocal(req) && !((p.startsWith('/api/worker/') || p.startsWith('/jobs/')) && WK.authOk(req))) {
    if (!OP.loginOn()) { res.writeHead(403); return res.end('AutoTube Studio: this PC only. To open it from other devices, set a password on the server: node tools/set-password.js'); }
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
    // month plan: dated titles a channel makes on their day (lib/flows.js runFlow); the owner edits a title, its themes or its day
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
      return send(res, 200, { flows: FL.flows().map(f => ({ ...f, next: FL.nextRun(f), jobs: db().jobs.filter(j => j.flowId === f.id).length })), packs: PACKS, v2styles: V2STYLES, settings: settings(), themes: db().themes, jobs, activity: activity.slice(0, 40), queues: { writing: writeQ.length + writing, rendering: WK.stats().rendering + WK.stats().waiting }, workers: { ...WK.stats(), token: WK.token(), lan: !!settings().lanWorkers, ips: WK.lanAddresses(), port: PORT }, connections: conn, elevenVoices: EL.voiceOptions(), today: today(), publicUrl: TN.publicUrl(), setup: setupStatus(), problems, limitUntil: limitPause(), testMode: TEST_MODE, themeList: { exam: themesFor('exam').map(t => ({ slug: t.slug, name: t.name, use: t.use })), history: themesFor('history').map(t => ({ slug: t.slug, name: t.name, use: t.use })) }, ideaRuns: ID.runs().slice(-30).map(r => ({ ...r, ideas: r.ideas.map(i => ({ ...i, jobStatus: i.jobId ? job(i.jobId)?.status : undefined })) })) });
    }
    if (p === '/api/problems/clear') { problems.length = 0; return send(res, 200, { ok: true }); }
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
    if (m && M === 'GET') { const j = job(m[1]); if (!j) return send(res, 404, { error: 'no job' }); return send(res, 200, j.pipeline === PIPELINE.character && j.script && Array.isArray(j.script.chapters) ? { ...j, prompts: videoPrompts(j.script) } : j); }   // a character video also shows its exact Gemini prompts
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
      const j = createJob({ format, theme: fl ? fl.channel.niche : settings().activeTheme, topic: i.title, date: today(), flowId: fl ? fl.id : null, mode: 'brief', brief: { title: i.title, prompt: ID.briefFor(r, i) }, pipeline: b.pipeline });
      j.fromIdea = { run: r.id, id: i.id, sources: i.sources }; i.status = 'approved'; i.jobId = j.id; i.format = format; save();
      return send(res, 200, j);
    }
    if (p === '/api/jobs') { const fl = b.flowId ? FL.getFlow(b.flowId) : null; if (!fl && !FL.flows().length) return send(res, 400, { error: 'Create a channel first (Channels > Add a channel).' }); const mode = b.mode || 'auto'; let topic = b.topic; if (mode === 'auto' && !topic && fl) { if (!fl.topics.length) await FL.researchTopics(fl); topic = fl.topics.shift(); fl.used.push(topic); save(); } if (mode === 'brief' && !topic) topic = b.title; const j = createJob({ format: b.format || 'short', theme: fl ? fl.channel.niche : (b.theme || settings().activeTheme), topic: topic || 'A surprising true story', date: today(), style: b.style || null, flowId: fl ? fl.id : null, mode, brief: mode === 'brief' || b.title || b.prompt ? { title: b.title || '', prompt: b.prompt || '' } : null, draft: mode === 'own', pipeline: b.pipeline }); if (mode === 'own') { j.voiceFirst = !!b.voiceFirst; save(); } return send(res, 200, j); }
    if (m) {
      const j = job(m[1]); if (!j) return send(res, 404, { error: 'no job' });
      const a = m[2];
      if (a === 'script' && isV2(j) && j.script && (j.script.look === 'lib') && b.script && Array.isArray(b.script.chapters) && b.script.chapters.length === (j.script.chapters || []).length) {
        // the owner changed a chapter's theme on the plan page: Claude redraws only those chapters' shots in the new theme
        const changed = b.script.chapters.map((c, i) => c.style !== j.script.chapters[i].style ? i : -1).filter(i => i >= 0);
        if (changed.length) {
          const bad = changed.map(i => b.script.chapters[i].style).find(s => !themeOf(s)); if (bad) return send(res, 400, { error: `"${bad}" is not a Lemo Opuscar library theme` });
          if (j.status !== 'script_review' && j.status !== 'failed' && j.status !== 'rejected') return send(res, 400, { error: 'Themes can be changed while the plan waits for you (Plan ready). This video is already past that step.' });
          j.ownerThemes = { ...(j.ownerThemes || {}), ...Object.fromEntries(changed.map(i => [i, b.script.chapters[i].style])) };
          j.script = b.script; save(); rethemeChapters(j, changed); return send(res, 200, j);
        }
      }
      if (a === 'script') { j.script = b.script; const v = validate(j); setTimeout(() => prepareReview(j), 50); if (isV2(j)) { j.script = v.plan; delete v.plan; } j.validation = v; jlog(j, 'script edited'); save(); return send(res, 200, j); }
      // the owner's own edits (dashboard "Edit video"): per line trim / speed / gap / subtitle text, and the subtitle look.
      // Nothing is generated again, so a finished video is made again from its saved clips and voices at no Gemini cost.
      if (a === 'edit') {
        if (!['script_review', 'video_review', 'failed'].includes(j.status) || !j.script) return send(res, 409, { error: 'Only a plan or a finished video waiting for review can be edited.' });
        const lines = new Map(j.script.chapters.flatMap(c => c.lines).map(l => [l.id, l])); let n = 0;
        for (const [id, e] of Object.entries(b.lines || {})) {
          const l = lines.get(id); if (!l || !e) continue; n++;
          for (const k of LINE_EDIT_KEYS) if (k in e) { if (e[k] === null || e[k] === '') delete l[k]; else l[k] = e[k]; }
        }
        if (b.captions !== undefined) j.script.captions = b.captions;
        const v = validate(j); if (isV2(j)) { j.script = v.plan; delete v.plan; } j.validation = v;
        jlog(j, `edited by hand: ${n} line(s)${b.captions !== undefined ? ', subtitle look' : ''}`);
        if (b.remake && j.status !== 'script_review' && !v.errs.length) { j.renderTries = 0; setStatus(j, 'queued_render', 'your edits are applied: the video is being made again from the saved clips'); queueRender(j.id); }
        save(); return send(res, 200, j);
      }
      if (a === 'approve-script') {
        if (fixing.has(j.id) || j.status === 'writing') return send(res, 409, { error: 'Claude is still changing this plan (themes). Wait until it says Plan ready, check it, then approve.' });
        if (j.pipeline === PIPELINE.character) { const why = !geminiReady() ? GEMINI_SETUP : !castApproved(j) ? 'approve every character first (top of the plan)' : ''; if (why) return send(res, 400, { error: 'This character video cannot be made yet: ' + why + '.' }); }
        if (isV2(j) && (j.script || {}).look !== 'lib') return send(res, 400, { error: 'Blocked by THEMES.md: this plan does not use a Lemo Opuscar library theme. Only the themes in lib/v2/themes.js may be rendered. Reject it and make a new plan.' });
        { const v = validate(j); if (isV2(j)) { j.script = v.plan; delete v.plan; } j.validation = v; }
        if (isV2(j) && (j.validation.errs || []).some(FIXABLE)) { save(); fixThemes(j); return send(res, 409, { error: 'This plan needs a fix first (' + j.validation.errs.filter(FIXABLE).join('; ') + '). Claude is fixing it now, keeping the facts (about a minute). It comes back as "Plan ready": check it and approve again.' }); }
        if (j.validation.errs.length) return send(res, 400, { error: j.validation.errs.join('; ') });
        setStatus(j, 'queued_render', 'script approved'); queueRender(j.id);
        return send(res, 200, j);
      }
      if (a === 'cast-ok' || a === 'cast-change') {   // the owner's verdict on one character's photo
        const m = castOf(j.script).find(x => x.id === b.id); if (j.pipeline !== PIPELINE.character || !m) return send(res, 400, { error: 'No such character in this video.' });
        if (a === 'cast-ok') { j.castOk = { ...j.castOk, [m.id]: castKey(m) }; jlog(j, `cast: ${m.name} approved`); save(); prepareReview(j); return send(res, 200, j); }
        const noteText = String(b.note || '').trim().slice(0, 800); if (!noteText) return send(res, 400, { error: 'Write what to change about this character.' });
        try {   // Claude rewrites the character from the note, a new photo is made
          const nm = extractJSON(await askClaude(castChangePrompt(m, noteText), { model: settings().claudeModel, timeoutMs: 5 * 60 * 1000 }));
          if (!nm.name || !nm.look || !nm.voice) throw new Error('Claude returned an incomplete character');
          Object.assign(m, { name: nm.name, role: nm.role || m.role, look: nm.look, voice: nm.voice, setting: nm.setting || m.setting });
          jlog(j, `cast: ${m.name} changed: ${noteText.slice(0, 160)}`); save(); await prepareReview(j); return send(res, 200, j);
        } catch (e) { return send(res, 500, { error: 'Could not change the character: ' + e.message }); }
      }
      if (a === 'revise') {   // storyboard review: notes for the whole video and per shot
        if (!isV2(j) || !j.script || !Array.isArray(j.script.chapters)) return send(res, 400, { error: 'This plan cannot be changed this way.' });
        if (fixing.has(j.id) || j.status === 'writing') return send(res, 409, { error: 'Claude is already changing this plan. Wait until it says the plan is ready.' });
        if (!['script_review', 'video_review', 'failed', 'rejected'].includes(j.status)) return send(res, 409, { error: 'Only a plan or a finished video waiting for review can be changed.' });
        const notes = String(b.notes || '').trim().slice(0, 3000), shots = Object.fromEntries(Object.entries(b.shots || {}).filter(([k, v]) => /^\d+-\d+-\d+$/.test(k) && String(v).trim()).map(([k, v]) => [k, String(v).trim().slice(0, 800)]));
        if (!notes && !Object.keys(shots).length) return send(res, 400, { error: 'Write what to change first (for the whole video or under a shot).' });
        reviseWithNotes(j, notes, shots); return send(res, 200, j);
      }
      if (a === 'regenerate') { j.writeTries = 0; delete j.ownerThemes; j.script = null; j.topic = b.topic || j.topic; setStatus(j, 'writing', 'regenerating script' + (b.notes ? ': ' + b.notes : '')); if (b.notes) j.angle = (j.angle ? j.angle + '. ' : '') + 'Editor notes: ' + b.notes; queueWrite(j.id); return send(res, 200, j); }
      if (a === 'style') {
        const st = styleOf(b.style); if (!st) return send(res, 400, { error: 'unknown style' });
        if (j.format === 'long' && st.mode === 'ai') return send(res, 400, { error: 'AI-built styles are for Shorts only. Pick a fast style for long videos.' });
        j.style = b.style; jlog(j, 'style set to ' + st.name); save(); return send(res, 200, j);
      }
      if (a === 'thumbnail') { if (!isV2(j) || !j.files) return send(res, 400, { error: 'finish the video first' }); const { makeThumbnail } = await import('./lib/v2/thumb.js'); const dir = path.join(ROOT, 'jobs', j.id); let TL = null; try { TL = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.js'), 'utf8').replace(/^window.TL=/, '').replace(/;s*$/, '')); } catch {} const r = await makeThumbnail({ dir, plan: j.script, TL, channel: j.channelName || settings().channelName, text: b.text || undefined }); if (b.text) j.script.thumbText = b.text; j.updatedAt = Date.now(); jlog(j, 'thumbnail remade: "' + r.text + '"'); save(); return send(res, 200, j); }
      // hold: take a waiting or in-progress video out of the queue (its plan and files stay); resume puts it back
      if (a === 'hold') { if (!['queued_render', 'rendering'].includes(j.status)) return send(res, 400, { error: 'Only a video that is waiting or being made can be put on hold.' }); delete j.lease; setStatus(j, 'on_hold', 'on hold: it will not be made until you press Resume'); return send(res, 200, j); }
      if (a === 'resume') { if (j.status !== 'on_hold') return send(res, 400, { error: 'This video is not on hold.' }); setStatus(j, 'queued_render', 'resumed: back in the queue'); queueRender(j.id); return send(res, 200, j); }
      if (a === 'rerender') { j.renderTries = 0; setStatus(j, 'queued_render', 're-render requested'); queueRender(j.id); return send(res, 200, j); }
      if (a === 'approve-video') { j.targets = { youtube: !!b.youtube, instagram: !!b.instagram, facebook: !!b.facebook }; j.publishNow = !!b.now; setStatus(j, 'approved', b.now ? 'approved, publishing now' : `approved, will publish at ${settings().publishTimes[j.slot] || 'next check'}`); return send(res, 200, j); }
      if (a === 'retry-upload') { j.uploadTries = 0; setStatus(j, 'approved', 'retrying upload'); j.publishNow = true; return send(res, 200, j); }
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
