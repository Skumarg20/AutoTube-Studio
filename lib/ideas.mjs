// Ideas: the owner gives a prompt, Claude researches on the web and proposes video titles (each marked Short or Long).
// The owner approves a title -> a "brief" job is made from it -> Claude researches again and writes the plan -> the owner
// approves the plan -> the video is made -> the owner approves the video -> it is uploaded. (The steps after the title are
// the normal job pipeline; THEMES.md rules apply to the plan as always.)
import crypto from 'crypto';
import { db, save, settings } from './store.mjs';
import { askClaude, extractJSON } from './claude.mjs';
import * as FL from './flows.mjs';
import * as YS from './ytstats.mjs';

export const WEB_TOOLS = ['--allowedTools', 'WebSearch', 'WebFetch'];
const id = () => crypto.randomBytes(4).toString('hex');
export const runs = () => (db().ideaRuns ||= []);
export const findRun = rid => runs().find(r => r.id === rid);

function usedTitles(flowId) {
  const J = db().jobs.filter(j => !flowId || j.flowId === flowId);
  const ideas = runs().filter(r => !flowId || r.flowId === flowId).flatMap(r => r.ideas || []).filter(i => i.status !== 'rejected');
  return [...new Set([...J.map(j => j.script?.title || j.brief?.title || j.topic), ...ideas.map(i => i.title)].filter(Boolean))].slice(-120);
}

export function ideasPrompt({ prompt, flow, format, n, used, results = '' }) {
  const c = flow ? flow.channel : { name: settings().channelName, niche: settings().activeTheme || 'history' };
  const exam = flow && flow.domain === 'exam';
  const lang = flow ? (flow.language || (exam ? 'hinglish' : 'english')) : 'english';
  const fmt = format === 'short' ? 'Every idea must be a Short (about 45 seconds: one surprising point, answer or trap).'
    : format === 'long' ? 'Every idea must be a long video (8-12 minutes: a full story, a full chapter revision or a complete plan).'
    : 'For each idea choose the format that suits it best: "short" (about 45 seconds: one surprising point, answer or trap) or "long" (8-12 minutes: a full story, chapter or plan). Give a mix of both.';
  return `You are the research lead of the YouTube channel "${c.name}"${c.niche ? ` (focus: ${c.niche})` : ''}${c.audience ? `, audience: ${c.audience}` : ''}.
The owner wants video ideas for this request:
"""${prompt}"""

RESEARCH FIRST, with WebSearch and WebFetch (several searches): what this audience is searching for right now, recent news, exam dates or anniversaries that make a topic timely, questions people keep asking (forums, comments, "people also ask"), and what other channels have already covered, so each idea has a fresh angle. Check every fact a title promises against reliable sources.${exam ? ' For JEE/NEET: use the current syllabus and real previous-year question patterns; never invent exam dates or cutoffs.' : ' For history: well-documented stories only; no invented quotes, dates or numbers.'}

${results ? results + String.fromCharCode(10, 10) : ''}Then propose ${n} video ideas.
- ${fmt}
- Titles: specific, curiosity-driven, honest (no clickbait lies), at most 70 characters${lang !== 'english' ? `, in the channel's language (${lang}, written in Latin script like the channel's other titles)` : ''}.
- Different from each other and from what this channel already made or proposed: ${used.length ? used.map(t => `"${t}"`).join('; ') : 'nothing yet'}.
- Rank them: the strongest idea first.

Return ONLY a JSON array, no commentary:
[{"title": "...", "format": "short" | "long", "hook": "the first line the narrator says", "angle": "2-3 sentences: what the video covers and the surprise or payoff", "why": "one sentence: the search demand, trend or gap that makes it work now", "sources": ["https://... (1-3 pages you used)"]}]`;
}

// start a research run in the background; the dashboard polls /api/state for it
export function startRun({ prompt, flowId, format = 'any', n = 10 }, note = () => {}) {
  const flow = flowId ? FL.getFlow(flowId) : null;
  if (!flow && !FL.flows().length) throw new Error('Create a channel first (Channels > Add a channel). Claude researches ideas for a channel.');
  const r = { id: id(), prompt: String(prompt || '').trim().slice(0, 3000), flowId: flow ? flow.id : null, channel: flow ? flow.channel.name : settings().channelName, format, n: Math.max(3, Math.min(25, +n || 10)), status: 'researching', at: Date.now(), ideas: [] };
  if (!r.prompt) throw new Error('Write what kind of videos you want first.');
  runs().push(r); save();
  note(`ideas: Claude is researching "${r.prompt.slice(0, 80)}" for ${r.channel}`);
  (async () => {
    try {
      // the channel's own YouTube results (refreshed at most every 12 hours) so Claude proposes more of what works
      let results = '';
      if (flow) { try { let st = YS.savedStats(flow.id); if (!st || Date.now() - Date.parse(st.at) > 12 * 36e5) st = await YS.fetchStats(flow.id); results = YS.statsBrief(st); } catch {} }
      const reply = await askClaude(ideasPrompt({ prompt: r.prompt, flow, format, n: r.n, used: usedTitles(r.flowId), results }), { model: settings().claudeModel, timeoutMs: 25 * 60 * 1000, extraArgs: WEB_TOOLS });
      const list = extractJSON(reply);
      if (!Array.isArray(list) || !list.length) throw new Error('Claude returned no ideas');
      r.ideas = list.filter(x => x && x.title).map(x => ({ id: id(), title: String(x.title).slice(0, 100), format: format !== 'any' ? format : (x.format === 'long' ? 'long' : 'short'), hook: String(x.hook || ''), angle: String(x.angle || ''), why: String(x.why || ''), sources: (Array.isArray(x.sources) ? x.sources : []).filter(s => /^https?:\/\//.test(s)).slice(0, 3), status: 'new' }));
      r.status = 'done'; r.doneAt = Date.now(); note(`ideas: ${r.ideas.length} titles ready for you to pick from`);
    } catch (e) { r.status = 'failed'; r.error = String(e.message || e).slice(0, 400); note('ideas: research failed: ' + r.error.slice(0, 120)); }
    save();
  })();
  return r;
}

// the brief Claude plans from, once the owner approves a title
export function briefFor(r, i) {
  return [
    `Owner's request: ${r.prompt}`,
    `Approved title: ${i.title}`,
    i.hook && `Hook (first line): ${i.hook}`,
    i.angle && `What the video covers: ${i.angle}`,
    i.why && `Why now: ${i.why}`,
    i.sources.length && `Sources found while researching the idea: ${i.sources.join(' ; ')}`,
  ].filter(Boolean).join('\n');
}

// app restarted while a run was going: say so instead of spinning forever
export function recover() { for (const r of runs()) if (r.status === 'researching') { r.status = 'failed'; r.error = 'the app was restarted during the research; press Try again'; } save(); }
