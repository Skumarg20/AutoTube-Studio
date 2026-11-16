// Talks to Claude through the Claude Code CLI in headless mode (`claude -p`), so it uses the login already on this PC (no API key needed).
import { spawn } from 'child_process';
import * as JC from './jobctx.mjs';

// temporary service/network errors (403 Cloudflare, 429, 5xx, overloaded, connection resets) are retried with a growing pause
const TRANSIENT = /403|429|5\d\d|Cloudflare|overloaded|rate.?limit|ECONNRESET|ECONNREFUSED|Connection refused|ETIMEDOUT|ENOTFOUND|socket hang up|network|temporar/i;
// the Claude plan's usage limit ("You've hit your 5-hour limit · resets 1am (Asia/Kolkata)", weekly: "resets Nov 20, 5am"):
// don't fail the video, wait until the reset and carry on. One shared pause per process so queued calls don't each hit the wall.
export const USAGE_LIMIT = /hit your .{0,40}limit|usage limit|limit reached|out of (extra )?usage/i;
let limitUntil = 0;
export function limitPause() { return limitUntil > Date.now() ? limitUntil : 0; }
export function resetTime(msg, now = new Date()) {
  const m = /resets\s+(?:([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(String(msg));
  if (!m) return null;
  let h = +m[3] % 12 + (/pm/i.test(m[5]) ? 12 : 0), d = new Date(now);
  d.setSeconds(0, 0); d.setHours(h, +(m[4] || 0));
  if (m[1]) { const mo = new Date(`${m[1].slice(0, 3)} 1 2000`).getMonth(); if (!isNaN(mo)) { d.setMonth(mo, +m[2]); if (d < now) d.setFullYear(d.getFullYear() + 1); } }
  else if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function askClaude(prompt, opts = {}) {
  const say = opts.log || (m => console.log(m));
  for (let k = 0, waits = 0; ; ) {
    while (limitUntil > Date.now()) { JC.check(); await sleep(Math.min(15000, limitUntil - Date.now())); }   // wait for the reset, but a video put on hold stops waiting
    JC.check();
    try { return await askClaudeOnce(prompt, opts); }
    catch (e) {
      const msg = String(e.message);
      if (USAGE_LIMIT.test(msg) && waits < 12) {
        waits++;
        const t = resetTime(msg), until = t ? Math.min(t.getTime() + 3 * 60e3, Date.now() + 7 * 864e5) : Date.now() + 30 * 60e3;
        limitUntil = Math.max(limitUntil, until);
        say(`Claude usage limit reached; waiting until ${new Date(limitUntil).toLocaleString()} and then continuing (nothing is lost)`);
        continue;
      }
      if (k >= 4 || !TRANSIENT.test(msg) || /timed out/.test(msg)) throw e;
      await sleep([20, 60, 180, 300][k++] * 1000);
    }
  }
}
export function askClaudeOnce(prompt, { model = '', timeoutMs = 15 * 60 * 1000, cwd, extraArgs = [] } = {}) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', ...extraArgs];
    if (model) args.push('--model', model);
    JC.check();
    const p = JC.track(spawn('claude', args, { shell: process.platform === 'win32', windowsHide: true, cwd }));
    let out = '', err = '';
    const killTree = () => { try { if (process.platform === 'win32') spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { windowsHide: true }); else p.kill('SIGKILL'); } catch {} };   // on Windows p.kill() only stops the shell, not claude
    const timer = setTimeout(() => { killTree(); reject(new Error('Claude timed out')); }, timeoutMs);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', code => {
      clearTimeout(timer);
      let text = out;
      try { const j = JSON.parse(out); if (j.is_error) return reject(new Error(j.result || 'Claude error')); text = j.result ?? out; } catch {}
      if (code !== 0 && !text.trim()) return reject(new Error(err.trim() || `claude exited ${code}`));
      resolve(text);
    });
    p.stdin.end(prompt);
  });
}

// pull the first JSON object/array out of a reply
export function extractJSON(text) {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text); if (fence) text = fence[1];
  const i = Math.min(...['{', '['].map(c => { const k = text.indexOf(c); return k < 0 ? Infinity : k; }));
  if (!isFinite(i)) throw new Error('no JSON in Claude reply');
  const close = text[i] === '{' ? '}' : ']', j = text.lastIndexOf(close);
  return JSON.parse(text.slice(i, j + 1));
}

const KINDS = `Scene kinds (pick the one that fits what the narration says at that moment):
- "title": opening card. heading = video title, sub = one-line hook, kicker = series name.
- "chapter": section opener. n = chapter number, heading = chapter name, sub optional.
- "date": a year/period. big = the year exactly as shown, e.g. "1839" or "2700 BCE", heading = what happened, sub optional.
- "place": a location. heading = place name, sub = region or coordinates.
- "fact": a striking number. big = the number with unit ("3 billion cups"), heading = what it means.
- "quote": heading = the exact quote (only real, well-attested quotes), sub = who said it.
- "list": heading + items (2-4 short items, max 6 words each).
- "text": heading + optional sub, for anything else.
- "outro": last scene. heading = closing line, sub = call to action.
Every scene also has "narration": what the narrator says during that scene (plain spoken English, no stage directions, numbers written as words where natural).
"date" and "fact" scenes MUST fill "big" (the year or number shown huge); never put the year only in "sub".
Keep on-screen text short: heading max 9 words, sub max 14 words.`;

export function scriptPrompt({ format, theme, topic, channel, minutes, angle }) {
  const long = format === 'long';
  const words = long ? Math.round(minutes * 140) : 115;
  return `You write scripts for a faceless YouTube/Instagram history channel called "${channel}". Series: "${theme}".
Topic: ${topic}${angle ? `\nAngle for this short: ${angle}` : ''}

Write a ${long ? `long-form documentary script of about ${words} spoken words (${minutes} minutes)` : 'YouTube Short / Instagram Reel script of 100-125 spoken words (about 45 seconds)'}.
Rules:
- Historically accurate. No invented quotes, dates or numbers; if historians disagree, say so in the narration. Prefer well-documented facts.
- ${long ? 'Structure: title scene, a strong hook in the first 15 seconds, 4-6 chapters (each opened by a "chapter" scene), then an outro asking viewers to subscribe. Aim for 40-70 scenes, each 6-20 seconds of narration.' : 'First scene is a "title" scene whose narration is a scroll-stopping hook in under 2 seconds of speech. 6-9 scenes total. End with an "outro" scene whose sub says the full story is on the channel.'}
- Warm, curious storyteller tone for a general audience, easy English (many viewers speak English as a second language).
${KINDS}

Return ONLY a JSON object, no commentary:
{"title": "<YouTube title, max 70 chars, curiosity-driven, no clickbait lies>",
 "description": "<YouTube description, 2-4 short paragraphs, ends with 3-5 hashtags>",
 "tags": ["<8-15 tags>"],
 "scenes": [{"kind": "...", "heading": "...", "sub": "...", "big": "...", "items": [], "n": 1, "kicker": "...", "narration": "..."}]}`;
}

export function topicsPrompt({ theme, channel, existing }) {
  return `Suggest 12 video topics for the history series "${theme}" on the channel "${channel}".
Each must be a specific, well-documented story with strong curiosity (good for YouTube search and Shorts), suitable for an 8-10 minute documentary and 2 short spin-offs.
Avoid these (already used): ${existing.slice(0, 80).join('; ') || 'none'}.
Return ONLY a JSON array of objects: [{"topic": "<short topic>", "hook": "<one-line hook>"}]`;
}

export function anglesPrompt({ topic, script }) {
  return `From this documentary script about "${topic}", pick 2 different surprising moments that would each make a great 45-second Short.
Script narration: ${script.scenes.map(s => s.narration).join(' ').slice(0, 9000)}
Return ONLY a JSON array of 2 strings, each a one-sentence angle.`;
}
