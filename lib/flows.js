// Autoflows: one automated pipeline per channel (YouTube + Instagram account).
// A flow has channel details, a schedule (days, how many long videos/Shorts, a "ready for me by" time, publish times),
// an approval mode and its own upload accounts (channels/<flowId>/config + data, used by the uploaders via HS_UPLOADER_ROOT).
import fs from 'fs'; import path from 'path';
import { ROOT, settings, db, save, today } from './store.js';
import { askClaude, extractJSON } from './claude.js';
import { flowTopicsPrompt } from './v2/plan.js';
import { examTopicsPrompt } from './v2/exam.js';

const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const flowRoot = id => path.join(ROOT, 'channels', id);

export function defaultFlow(over = {}) {
  const st = settings();
  return {
    id: 'f' + Math.random().toString(36).slice(2, 7), name: 'New channel', enabled: false,
    channel: { name: 'New channel', niche: '', audience: '', tone: 'warm, clear and friendly', language: 'English' },
    pack: 'auto', voice: st.voice, longMinutes: st.longMinutes || 8,
    schedule: { days: [0, 1, 2, 3, 4, 5, 6], longs: 1, shorts: 2, readyBy: '09:00', leadHours: 8, publishLong: ['18:00', '20:00'], publishShort: ['09:00', '12:00', '15:00', '21:00'] },
    approvals: 'both',            // both = I review plan + video · video = auto-approve plans, I review videos · none = autopilot
    research: 'auto',             // auto = Claude researches topics when the queue runs low · queue = only my topic list
    topics: [], used: [], runs: {},
    upload: { youtube: true, instagram: true, privacy: 'public' },
    domain: 'general',            // general = any subject · history = documentaries · exam = JEE / NEET preparation (equations, quizzes, diagrams)
    language: 'english',          // english | hinglish | hindi (Hinglish and Hindi need an ElevenLabs voice)
    createdAt: Date.now(), ...over,
  };
}
export function flows() { const D = db(); if (!Array.isArray(D.flows)) D.flows = []; return D.flows; }
export const getFlow = id => flows().find(f => f.id === id);

// first start: turn the old single-channel setup into flow #1 so nothing is lost
export function migrate() {
  const D = db(); if (Array.isArray(D.flows) && D.flows.length) return;
  if (!(D.jobs || []).length && !(D.usedTopics || []).length) { flows(); return; }   // fresh install: start with no channels, nothing runs until the owner adds one
  const st = settings(), th = (D.themes || []).find(t => t.name === st.activeTheme) || (D.themes || [])[0] || { name: 'History', topics: [] };
  D.flows = [defaultFlow({ id: 'f1', name: st.channelName || 'My channel', enabled: !!st.autoDaily,
    channel: { name: st.channelName || 'My channel', niche: 'History documentaries · ' + th.name, audience: 'curious adults worldwide, many watching in English as a second language', tone: 'warm, curious storyteller', language: 'English' },
    pack: th.pack || 'auto', topics: [...(th.topics || [])], used: [...(D.usedTopics || [])], theme: th.name,
    schedule: { days: [0, 1, 2, 3, 4, 5, 6], longs: 2, shorts: 4, readyBy: '09:00', leadHours: 8, publishLong: [st.publishTimes?.long1 || '18:00', st.publishTimes?.long2 || '20:00'], publishShort: [st.publishTimes?.short1 || '09:00', st.publishTimes?.short2 || '12:00', st.publishTimes?.short3 || '15:00', st.publishTimes?.short4 || '21:00'] } })];
  save();
}

export async function researchTopics(f, n = 12) {
  const prompt = f.domain === 'exam' ? examTopicsPrompt({ name: f.channel.name, niche: f.channel.niche, audience: f.channel.audience, existing: [...f.topics, ...f.used], n }) : flowTopicsPrompt({ name: f.channel.name, niche: f.channel.niche, audience: f.channel.audience, tone: f.channel.tone, existing: [...f.topics, ...f.used], n, domain: f.domain || 'history' });
  const reply = await askClaude(prompt, { model: settings().claudeModel, timeoutMs: 10 * 60e3 });
  const list = extractJSON(reply).map(x => (typeof x === 'string' ? { topic: x } : x)).filter(x => x && x.topic);
  for (const x of list) if (!f.topics.includes(x.topic) && !f.used.includes(x.topic)) f.topics.push(x.topic);
  save(); return list;
}
async function takeTopic(f, kind = 'long') {
  if (kind === 'short' && Array.isArray(f.shortTopics) && f.shortTopics.length) { const t = f.shortTopics.shift(); f.used.push(t); save(); return t; }
  if (!f.topics.length && f.research !== 'queue') await researchTopics(f);
  const t = f.topics.shift(); if (!t) throw new Error(`flow "${f.name}" has no topics left: add some or switch research to auto`);
  f.used.push(t); save(); return t;
}

// create one day's jobs for a flow (long videos first; Shorts spin off them, or get their own topics)
export async function runFlow(f, date, createJob, note) {
  if (f.runs[date]) return db().jobs.filter(j => j.flowId === f.id && j.date === date);
  f.runs[date] = Date.now(); save();
  const S = f.schedule, longs = [];
  // a month plan has this day's exact titles: make exactly those (Claude researches each title on the web, then plans it)
  const MP = (f.month || {})[date];
  if (Array.isArray(MP) && MP.length) {
    note(`autoflow "${f.name}": making the ${MP.length} planned titles for ${date}`);
    let ns = 0, nl = 0;
    for (const it of MP) {
      if (it.jobId && db().jobs.some(j => j.id === it.jobId)) continue;
      const long = it.format === 'long', k = long ? nl++ : ns++, P = long ? S.publishLong : S.publishShort;
      const j = createJob({ format: long ? 'long' : 'short', theme: f.channel.niche, topic: it.title, slot: `${long ? 'L' : 'S'}${k + 1}`, date, flowId: f.id, mode: 'brief',
        publishAt: it.publishAt || P[k] || P[P.length - 1] || '12:00', brief: { title: it.title, prompt: monthBrief(it), themes: it.themes || [] }, fromIdea: { month: date, id: it.id, sources: it.sources || [] } });
      it.jobId = j.id; save();
    }
    return db().jobs.filter(j => j.flowId === f.id && j.date === date);
  }
  note(`autoflow "${f.name}": planning ${Array.isArray(S.longDays) && S.longDays.length && !S.longDays.includes(new Date(date + 'T12:00:00').getDay()) ? 0 : S.longs} long + ${S.shorts} Shorts for ${date}`);
  const dow = new Date(date + 'T12:00:00').getDay(), nLong = Array.isArray(S.longDays) && S.longDays.length ? (S.longDays.includes(dow) ? S.longs : 0) : S.longs;
  for (let k = 0; k < nLong; k++) longs.push(createJob({ format: 'long', theme: f.channel.niche, topic: await takeTopic(f), slot: `L${k + 1}`, date, flowId: f.id, publishAt: S.publishLong[k] || S.publishLong[S.publishLong.length - 1] || '18:00' }));
  for (let k = 0; k < S.shorts; k++) {
    const own = f.shortsOwnTopics || (Array.isArray(f.shortTopics) && f.shortTopics.length), parent = !own && longs.length ? longs[k % longs.length] : null;
    createJob({ format: 'short', theme: f.channel.niche, topic: parent ? parent.topic : await takeTopic(f, 'short'), slot: `S${k + 1}`, date, flowId: f.id, parent: parent ? parent.id : null, publishAt: S.publishShort[k] || S.publishShort[S.publishShort.length - 1] || '12:00' });
  }
  return db().jobs.filter(j => j.flowId === f.id && j.date === date);
}
// the brief for a month-plan title: the owner's chosen themes (if any) go to the planner as a firm wish
export function monthBrief(it) {
  const th = (it.themes || []).filter(Boolean);
  return [
    `Planned title (from the channel's month plan, based on its own YouTube results and similar channels): ${it.title}`,
    it.kind && `Kind of video: ${it.kind}`,
    it.hook && `Hook (first line): ${it.hook}`,
    it.angle && `What the video covers: ${it.angle}`,
    it.why && `Why it should work: ${it.why}`,
    (it.sources || []).length && `Sources: ${it.sources.join(' ; ')}`,
    th.length && `THEMES CHOSEN BY THE OWNER: build this video's chapters with ${th.map(s => `"${s}"`).join(', ')}${th.length === 1 ? ' as the main theme (the hook or the main chapter)' : ''}. Add other themes only where the theme mixing rules need more.`,
    'End with one question the viewer wants to answer in the comments.',
  ].filter(Boolean).join('\n');
}
// owner edits one month-plan title (title, themes, publish time) or removes it
export function editMonth(f, date, id, ch) {
  const day = (f.month || {})[date] || [], it = day.find(x => x.id === id);
  if (!it) throw new Error('That planned title is not in the month plan any more.');
  if (it.jobId && db().jobs.some(j => j.id === it.jobId)) throw new Error('This video is already being made; change it in Videos instead.');
  if (ch.remove) { f.month[date] = day.filter(x => x !== it); if (!f.month[date].length) delete f.month[date]; save(); return null; }
  if (typeof ch.title === 'string' && ch.title.trim()) it.title = ch.title.trim().slice(0, 100);
  if (Array.isArray(ch.themes)) it.themes = ch.themes.filter(s => typeof s === 'string').slice(0, 4);
  if (typeof ch.publishAt === 'string' && /^\d\d:\d\d$/.test(ch.publishAt)) it.publishAt = ch.publishAt;
  if (ch.newDate && ch.newDate !== date && /^\d{4}-\d\d-\d\d$/.test(ch.newDate)) { f.month[date] = day.filter(x => x !== it); if (!f.month[date].length) delete f.month[date]; (f.month[ch.newDate] ||= []).push(it); }
  save(); return it;
}
// when a day's work must start so that everything is ready by "readyBy"
export function startTime(f, date) { const [y, m, d] = date.split('-').map(Number); const at = new Date(y, m - 1, d, 0, 0, 0); return new Date(at.getTime() + (hm(f.schedule.readyBy) - (+f.schedule.leadHours || 8) * 60) * 60e3); }
export function nextRun(f, now = new Date()) {
  for (let k = 0; k < 9; k++) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k), ds = dstr(d); if (!f.schedule.days.includes(d.getDay()) || f.runs[ds]) continue; const s = startTime(f, ds), ready = new Date(s.getTime() + (+f.schedule.leadHours || 8) * 3600e3); if (ready.getTime() + 6 * 3600e3 > now.getTime()) return { date: ds, start: s.getTime(), ready: ready.getTime() }; }
  return null;
}
export async function tick(createJob, note) {
  const now = new Date();
  for (const f of flows()) {
    if (!f.enabled) continue;
    for (const k of [0, 1]) {   // today, and tomorrow (when the lead time starts the evening before)
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k), ds = dstr(d);
      if (!f.schedule.days.includes(d.getDay()) || f.runs[ds]) continue;
      const s = startTime(f, ds), ready = new Date(s.getTime() + (+f.schedule.leadHours || 8) * 3600e3);
      if (now >= s && now < new Date(ready.getTime() + 6 * 3600e3)) { try { await runFlow(f, ds, createJob, note); } catch (e) { note(`autoflow "${f.name}": ${e.message}`); } }
    }
  }
}
// upload accounts for a flow live in channels/<id>/config (youtube_client.json, instagram.json) and channels/<id>/data (token)
export function uploaderEnv(f) {
  if (!f) return {}; const r = flowRoot(f.id); fs.mkdirSync(path.join(r, 'config'), { recursive: true }); fs.mkdirSync(path.join(r, 'data'), { recursive: true });
  return { HS_UPLOADER_ROOT: r };
}

// content calendar for the next n days: videos already made for each date, and what the queue will make on future dates
export function calendar(f, n = 28, back = 1) {
  const S = f.schedule, out = [], longQ = f.topics || [], shortQ = f.shortTopics || [], own = f.shortsOwnTopics || shortQ.length > 0;
  let li = 0, si = 0; const now = new Date();
  for (let k = -back; k < n; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k), ds = dstr(d), dow = d.getDay();
    const jobs = db().jobs.filter(j => j.flowId === f.id && j.date === ds).map(j => ({ id: j.id, format: j.format, title: (j.script && j.script.title) || j.topic, topic: j.topic, status: j.status, publishAt: j.publishAt, urls: Object.fromEntries(Object.entries(j.uploads || {}).filter(([, r]) => r && r.ok && r.url).map(([k, r]) => [k, r.url])) }));
    const planned = [], MP = (f.month || {})[ds];
    if (k >= 0 && Array.isArray(MP) && MP.length) {   // month plan: the exact titles, shown even while the channel is paused
      let ns = 0, nl = 0;
      for (const it of MP) { if (it.jobId && jobs.some(j => j.id === it.jobId)) continue; const long = it.format === 'long', x = long ? nl++ : ns++, P = long ? S.publishLong : S.publishShort;
        planned.push({ format: long ? 'long' : 'short', topic: it.title, title: it.title, mid: it.id, kind: it.kind || '', themes: it.themes || [], publishAt: it.publishAt || P[x] || P[P.length - 1] }); }
    } else if (k >= 0 && !jobs.length && !f.runs[ds] && f.enabled && S.days.includes(dow)) {
      const nLong = Array.isArray(S.longDays) && S.longDays.length ? (S.longDays.includes(dow) ? S.longs : 0) : S.longs, dayLongs = [];
      for (let x = 0; x < nLong; x++) { const t = longQ[li++] || null; dayLongs.push(t); planned.push({ format: 'long', topic: t, publishAt: S.publishLong[x] || S.publishLong[S.publishLong.length - 1] }); }
      for (let x = 0; x < S.shorts; x++) { const t = own ? (shortQ[si++] || null) : (dayLongs[x % Math.max(1, dayLongs.length)] || shortQ[si++] || null); planned.push({ format: 'short', topic: t, publishAt: S.publishShort[x] || S.publishShort[S.publishShort.length - 1] }); }
    }
    if (k >= 0 || jobs.length) out.push({ date: ds, dow, jobs, planned });
  }
  return { days: out, longLeft: Math.max(0, longQ.length - li), shortLeft: Math.max(0, shortQ.length - si), research: f.research };
}
