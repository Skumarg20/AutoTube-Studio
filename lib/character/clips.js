// Character pipeline, per video: the first frame of every line a character is seen saying (for the storyboard), then one
// Omni Flash clip per character line. A clip's sound is that line's voice; its picture plays full screen when the line is
// "on" camera, and is not used when the line is "off" (the voice is heard over the line's screens, nobody is shown).
// Narrator lines are not made here: lib/v2/voice.js speaks them with the channel's narrator voice.
// Continuity: a scene's frames are made in order, each with the previous one as a reference, so the place and the people's
// positions carry over. Pace: the silence Omni leaves at both ends of a clip is cut, so lines follow each other tightly.
// Everything comes from the job itself (plan.cast and the approved photos in jobs/<id>/char/cast/), so any render
// worker can make the clips.
import fs from 'fs'; import path from 'path';
import { ROOT, settings } from '../store.js';
import { run } from '../pipeline.js';
import { generateImage, generateVideo } from '../gemini.js';
import { castOf, castRefs } from './cast.js';
import { keyframePrompt, clipPrompt, clipSeconds, onScreenOf, NARRATOR, CAMERA } from './prompts.js';

const CLIP_DIR = 'char';                                   // jobs/<id>/char/<line id>.png | .mp4 | .cut.mp4
const keyframeOf = (jobDir, lineId) => path.join(jobDir, CLIP_DIR, lineId + '.png');
const clipOf = (jobDir, lineId) => path.join(jobDir, CLIP_DIR, lineId + '.mp4');
const cutOf = (jobDir, lineId) => path.join(jobDir, CLIP_DIR, lineId + '.cut.mp4');
const isCharacterLine = l => l.id && l.speaker && l.speaker !== NARRATOR;
export const characterLines = plan => plan.chapters.flatMap(c => c.lines).filter(isCharacterLine);
// the scenes with their character lines; "seen" = the lines a character is seen saying
const scenesOf = plan => plan.chapters.map(scene => ({ scene, lines: scene.lines.filter(isCharacterLine) }));

// runs fn over items, at most `limit` at a time, keeping the order of results
async function inParallel(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

// one scene's frames, in order: each new frame also sees the previous one (same place, same positions)
async function sceneKeyframes(job, plan, dir, scene, lines) {
  const cast = castOf(plan), made = []; let previous = null;
  for (const line of lines.filter(l => l.camera === CAMERA.on)) {
    const refs = [...castRefs(dir, onScreenOf(line, cast)), ...(previous ? [previous] : [])];
    made.push(await generateImage({ prompt: keyframePrompt(line, cast, scene), refs, size: '1K', jobId: job.id, out: keyframeOf(dir, line.id) }));
    previous = keyframeOf(dir, line.id);
  }
  return made;
}

// storyboard stage (after the owner approved the cast). Unchanged frames come from the cache, so editing a plan only pays
// for the frames that changed. Scenes run side by side; the frames inside a scene one after the other.
export async function makeKeyframes(job, log) {
  const dir = path.join(ROOT, 'jobs', job.id), res = (await inParallel(scenesOf(job.script), 3, ({ scene, lines }) => sceneKeyframes(job, job.script, dir, scene, lines))).flat();
  const paid = res.filter(r => !r.cached);
  log(`cast: ${res.length} storyboard frames${paid.length ? ` (${paid.length} new, $${paid.reduce((a, r) => a + r.usd, 0).toFixed(2)})` : ', all unchanged'}`);
}

// where the speech starts and ends in a clip (ffmpeg silencedetect), to cut the silence Omni leaves around a line
async function speechSpan(file, dur) {
  const out = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-35dB:d=0.15', '-f', 'null', '-']);
  const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  const begin = starts.length && starts[0] < 0.05 && ends.length ? ends[0] : 0;
  const lastStart = starts.length ? starts[starts.length - 1] : null, finish = lastStart !== null && lastStart > begin && (ends.length < starts.length || ends[ends.length - 1] >= dur - 0.05) ? lastStart : dur;
  return { from: Math.max(0, begin - 0.08), to: Math.min(dur, finish + 0.15) };
}
// how much faster to play a line Omni spoke slowly: up to the target pace (settings characterWordsPerSecond, default 2.6),
// at most 1.15x so the voice still sounds natural; 1 = as made
const MAX_SPEED_UP = 1.15;
function paceSpeed(say, seconds, st) {
  const wps = String(say).split(/\s+/).filter(Boolean).length / Math.max(0.5, seconds), target = +st.characterWordsPerSecond || 2.6;
  return wps >= target ? 1 : +Math.min(MAX_SPEED_UP, target / wps).toFixed(3);
}
const durationOf = async file => +(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).trim();

// render stage: speaks the character lines into <vdir>/<line id>.wav; returns { line id: seconds }
export async function speakCharacterLines({ job, plan, dir, vdir, log }) {
  const st = settings(), cast = castOf(plan), lines = characterLines(plan), dur = {};
  if (lines.some(l => !castRefs(dir, [cast.find(m => m.id === l.speaker)].filter(Boolean)).length)) throw new Error('a character in this video has no approved photo yet: approve the cast at the top of the plan first');
  const sceneOf = new Map(plan.chapters.flatMap(scene => scene.lines.map(l => [l.id, scene])));
  for (const { scene, lines: ls } of scenesOf(plan)) if (ls.some(l => l.camera === CAMERA.on && !fs.existsSync(keyframeOf(dir, l.id)))) await sceneKeyframes(job, plan, dir, scene, ls);
  log(`cast: ${lines.length} character lines with Omni Flash`);
  let made = 0;
  await inParallel(lines, 3, async line => {
    const seen = line.camera === CAMERA.on, seconds = clipSeconds(line.say), scene = sceneOf.get(line.id) || {};
    const resolution = seen ? (st.characterResolution || '720p') : (st.characterVoiceOnlyResolution || '360p');   // a voice-only clip is never seen
    const images = [...(seen ? [keyframeOf(dir, line.id)] : []), ...castRefs(dir, seen ? onScreenOf(line, cast) : cast.filter(m => m.id === line.speaker))];
    const clip = await generateVideo({ prompt: clipPrompt(line, cast, { seconds, language: plan.language, scene }), images, seconds, resolution, jobId: job.id, out: clipOf(dir, line.id) });
    // cut the silence at both ends (picture and sound together, so lip-sync holds)
    const span = await speechSpan(clip.file, await durationOf(clip.file)), cut = cutOf(dir, line.id), trim = line.trim || {};
    span.from += trim.start || 0; span.to = Math.max(span.from + 0.5, span.to - (trim.end || 0));   // the editor's cut, on top
    const speed = line.speed || paceSpeed(line.say, span.to - span.from, st);   // the editor's speed, else a dragged line a little faster (picture and sound together)
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', span.from.toFixed(3), '-to', span.to.toFixed(3), '-i', clip.file,
      ...(speed !== 1 ? ['-filter:v', `setpts=PTS/${speed}`, '-filter:a', `atempo=${speed}`] : []), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', cut]);
    const wav = path.join(vdir, line.id + '.wav');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', cut, '-vn', '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', wav]);
    dur[line.id] = +((fs.statSync(wav).size - 44) / (24000 * 2)).toFixed(3);   // 16-bit mono PCM after a 44-byte header
    log(`cast: line ${++made}/${lines.length} (${line.id}, ${seen ? 'on camera' : 'voice only'}, ${dur[line.id].toFixed(1)} of ${seconds} s spoken${speed !== 1 ? `, played ${speed}x` : ''}, ${resolution}${clip.cached ? ', cached' : `, $${clip.usd.toFixed(2)}`})`);
  });
  return dur;
}

// after the timeline: cut each on-camera clip into frames at the video's frame rate and tell the page where it plays,
// and when to punch in (the line's "punch" word, timed by the captions)
export async function addClipsToTimeline({ TL, mix, plan, dir, fps, width }) {
  const seen = new Map(characterLines(plan).filter(l => l.camera === CAMERA.on).map(l => [l.id, l])), norm = w => String(w).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  TL.characters = [];
  for (const v of mix.voice) {
    const line = seen.get(v.id); if (!line) continue;
    const rel = `img/${CLIP_DIR}/${v.id}`, out = path.join(dir, rel);
    fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', cutOf(dir, v.id), '-vf', `fps=${fps},scale=${width}:-2`, '-q:v', '3', path.join(out, 'f%05d.jpg')]);
    const frames = fs.readdirSync(out).length, word = line.punch && norm(line.punch);
    const hit = word && TL.phrases.flatMap(p => p.w).find(w => w.line === v.id && norm(w.w).includes(word));
    TL.characters.push({ line: v.id, t0: v.at, t1: +(v.at + frames / fps).toFixed(3), dir: rel, frames, fps, ...(hit ? { punch: hit.s } : {}) });
  }
}
