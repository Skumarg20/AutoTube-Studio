// Pace of one video, before the slow picture render:
//   fixPace    - right after the voices: cuts long pauses inside lines and the silence around narrator lines, plays dragged
//                narrator lines a little faster, and speeds the whole video up a little when a Short runs over its limit.
//                It edits the line files (wav, and a character's clip with it), so nothing is generated again.
//   paceReport - after the timeline: how fast each line is spoken, where the voice stops, and how long the video is.
// The owner's own edits (a line's "speed") are kept; settings autoPaceFix: false turns the fixing off.
import fs from 'fs'; import path from 'path';
import { run } from '../pipeline.js';
import { settings } from '../store.js';
import { NARRATOR } from '../character/prompts.js';

export const SHORT_LIMIT = 59;          // seconds a Short may last
const SLOW_WORDS_PER_SECOND = 2.2;      // below this a line sounds dragged
const DEAD_AIR = 0.4;                   // a stop in the voice longer than this is felt as a gap

const wordsIn = s => String(s).split(/\s+/).filter(Boolean).length;

// stops longer than `min` seconds in one line's audio, as [start, seconds]; a stop that runs to the end has no
// silence_end, so it lasts to the end of the file
const durationOf = async file => +(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).trim();
async function pausesIn(wav, min = DEAD_AIR) {
  const out = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', `silencedetect=noise=-35dB:d=${min}`, '-f', 'null', '-']);
  const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), lengths = [...out.matchAll(/silence_duration: ([\d.]+)/g)].map(m => +m[1]);
  if (starts.length > lengths.length) lengths.push(Math.max(0, await durationOf(wav) - starts[starts.length - 1]));
  return lengths.map((len, i) => [starts[i], len]);
}

// ---------- fixing ----------
const KEEP_PAUSE = 0.3;                          // a long pause inside a line is shortened to this
const EDGE_KEEP = { lead: 0.05, tail: 0.12 };    // silence left before / after a narrator line
const TARGET_WORDS_PER_SECOND = 2.6, MAX_LINE_SPEED = 1.15, MAX_FIT_SPEED = 1.1;
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const sum = a => a.reduce((x, y) => x + y, 0);

// cuts [from, to] segments out of a file (the picture too for a clip), and/or plays it `speed` times faster
async function editFile(file, { cut = [], speed = 1 }, video) {
  const keep = cut.length ? `not(${cut.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+')})` : null, out = file + '.pace' + path.extname(file);
  const af = [keep && `aselect='${keep}',asetpts=N/SR/TB`, speed !== 1 && `atempo=${speed}`].filter(Boolean).join(',');
  const vf = [keep && `select='${keep}',setpts=N/FRAME_RATE/TB`, speed !== 1 && `setpts=PTS/${speed}`].filter(Boolean).join(',');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-af', af, ...(video ? ['-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac'] : []), out]);
  fs.renameSync(out, file);
}
// a moment in the line before the cuts -> the same moment after them
const afterCuts = (t, cut) => t - sum(cut.map(([a, b]) => Math.max(0, Math.min(t, b) - a)));

export async function fixPace({ plan, dir, vdir, format, log }) {
  if (settings().autoPaceFix === false) return [];
  const dur = readJSON(path.join(vdir, 'dur.json')) || {}, words = readJSON(path.join(vdir, 'words.json')), fixed = [];
  const lines = plan.chapters.flatMap(c => c.lines).filter(l => dur[l.id] && fs.existsSync(path.join(vdir, l.id + '.wav')));
  const clipOf = l => { const f = path.join(dir, 'char', l.id + '.cut.mp4'); return l.speaker && l.speaker !== NARRATOR && fs.existsSync(f) ? f : null; };
  // edits a line's sound (a character line: its clip, then the sound is taken from the clip again); dur and word timings follow
  async function edit(l, op) {
    const wav = path.join(vdir, l.id + '.wav'), clip = clipOf(l);
    if (clip) { await editFile(clip, op, true); await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', clip, '-vn', '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', wav]); }
    else await editFile(wav, op, false);
    dur[l.id] = +(await durationOf(wav)).toFixed(3);
    const at = t => +(afterCuts(t, op.cut || []) / (op.speed || 1)).toFixed(3);
    if (words?.[l.id]) words[l.id] = words[l.id].map(([w, s, e]) => [w, at(s), at(e)]).filter(([, s, e]) => e > 0 && s < dur[l.id]);
  }
  for (const l of lines) {
    const d = dur[l.id], clip = clipOf(l), cut = [];
    for (const [s, len] of await pausesIn(path.join(vdir, l.id + '.wav'))) {
      if (s <= 0.05) { if (!clip && len > EDGE_KEEP.lead) cut.push([0, len - EDGE_KEEP.lead]); }   // a clip's edges were cut when it was made
      else if (s + len >= d - 0.05) { if (!clip && len > EDGE_KEEP.tail) cut.push([s + EDGE_KEEP.tail, d + 1]); }
      else cut.push([s + KEEP_PAUSE / 2, s + len - KEEP_PAUSE / 2]);
    }
    if (cut.length) { const before = d; await edit(l, { cut }); fixed.push(`${l.id}: ${(before - dur[l.id]).toFixed(1)} s of silence cut`); }
    const wps = wordsIn(l.say) / dur[l.id];
    if (!clip && !l.speed && wps < TARGET_WORDS_PER_SECOND - 0.2) {   // a character's clip got its pace when it was cut (lib/character/clips.js)
      const speed = +Math.min(MAX_LINE_SPEED, TARGET_WORDS_PER_SECOND / wps).toFixed(3);
      await edit(l, { speed }); fixed.push(`${l.id}: played ${speed}x (was ${wps.toFixed(1)} words/s)`);
    }
  }
  // a Short over its limit: everything a little faster (up to MAX_FIT_SPEED); what is still over is the owner's call
  const total = () => 0.4 + sum(lines.map(l => dur[l.id] + (l.gap ?? 0.3))) + 0.6;
  if (format === 'short' && total() > SHORT_LIMIT) {
    const speed = +Math.min(MAX_FIT_SPEED, total() / (SHORT_LIMIT - 1)).toFixed(3), was = total();
    for (const l of lines) await edit(l, { speed });
    fixed.push(`whole video played ${speed}x to fit the ${SHORT_LIMIT} s limit (${was.toFixed(1)} -> ${total().toFixed(1)} s)`);
  }
  fs.writeFileSync(path.join(vdir, 'dur.json'), JSON.stringify(dur, null, 1)); if (words) fs.writeFileSync(path.join(vdir, 'words.json'), JSON.stringify(words));
  log(`pace fix: ${fixed.length ? fixed.join('; ') : 'nothing to fix'}`);
  return fixed;
}

// mix.voice: [{ id, at }] in playing order; dur: { line id: seconds }
export async function paceReport({ plan, mix, dur, vdir, format, log }) {
  const sceneOf = new Map(plan.chapters.flatMap((c, i) => c.lines.map(l => [l.id, i + 1]))), lineOf = new Map(plan.chapters.flatMap(c => c.lines).map(l => [l.id, l]));
  const lines = [], gaps = [];
  for (let k = 0; k < mix.voice.length; k++) {
    const { id, at } = mix.voice[k], line = lineOf.get(id); if (!line || !dur[id]) continue;
    const all = await pausesIn(path.join(vdir, id + '.wav')), atEdge = ([s, len]) => s <= 0.05 || s + len >= dur[id] - 0.05;
    const lead = all.find(([s]) => s <= 0.05)?.[1] || 0, tail = all.find(([s, len]) => s > 0.05 && s + len >= dur[id] - 0.05)?.[1] || 0;
    const spoken = Math.max(0.5, dur[id] - lead - tail), wps = +(wordsIn(line.say) / spoken).toFixed(2);
    lines.push({ id, scene: sceneOf.get(id), at: +at.toFixed(2), seconds: dur[id], wps, slow: wps < SLOW_WORDS_PER_SECOND, lead: +lead.toFixed(2), tail: +tail.toFixed(2), pauses: all.filter(p => !atEdge(p)).map(([, len]) => +len.toFixed(2)) });
    const next = mix.voice[k + 1]; if (!next) continue;
    lines[lines.length - 1].nextAt = next.at;
    lines[lines.length - 1].nextId = next.id;
  }
  // what the viewer hears as a gap: the silence at the end of a line + the space between the files + the silence before the next line
  for (let k = 0; k + 1 < lines.length; k++) {
    const a = lines[k], b = lines[k + 1]; if (a.nextId !== b.id) continue;
    const seconds = +(a.tail + (a.nextAt - mix.voice.find(v => v.id === a.id).at - a.seconds) + b.lead).toFixed(2);
    if (seconds > DEAD_AIR) gaps.push({ after: a.id, seconds, betweenScenes: a.scene !== b.scene });
  }
  const end = mix.voice.length ? Math.max(...mix.voice.map(v => v.at + (dur[v.id] || 0))) : 0;
  const report = {
    seconds: +end.toFixed(1), overLimit: format === 'short' && end > SHORT_LIMIT,
    wordsPerSecond: +(lines.reduce((a, l) => a + l.wps * l.seconds, 0) / Math.max(1, lines.reduce((a, l) => a + l.seconds, 0))).toFixed(2),
    slowLines: lines.filter(l => l.slow).map(l => l.id), gaps, pausesInLines: lines.filter(l => l.pauses.length).map(l => ({ id: l.id, pauses: l.pauses })), lines,
  };
  const problems = [
    report.overLimit && `${report.seconds} s is over the ${SHORT_LIMIT} s Short limit`,
    report.gaps.length && `${report.gaps.length} gap(s) between lines: ${report.gaps.map(g => `${g.seconds} s after ${g.after}${g.betweenScenes ? ' (scene change)' : ''}`).join(', ')}`,
    report.slowLines.length && `slow line(s): ${report.slowLines.map(id => `${id} ${lines.find(l => l.id === id).wps} words/s`).join(', ')}`,
    report.pausesInLines.length && `pause(s) inside: ${report.pausesInLines.map(p => `${p.id} ${p.pauses.join('+')} s`).join(', ')}`,
  ].filter(Boolean);
  log(`pace: voice ${report.seconds} s, ${report.wordsPerSecond} words/s on average; ${problems.length ? problems.join('; ') : 'no gaps, no slow lines'}`);
  return report;
}
