// Narration of one video: who speaks the plan's lines. Every narrator writes the same files into <vdir>:
// <line id>.wav, dur.json and, when it can, words.json (word timings for the captions), so the timeline, the mixer and the
// captions work the same whatever spoke. build.js asks for one by the job; the choice is made only here.
//   recording  - the creator's own recording, split into lines
//   eleven     - an ElevenLabs voice (falls back to the built-in voices when ElevenLabs cannot speak)
//   builtin    - the library's offline Kokoro voices
//   character  - a character video: each character's lines in their own voice (Omni Flash clips, lib/character),
//                the lines that belong to nobody in the narrator voice above
import fs from 'fs'; import path from 'path';
import { ROOT, settings } from '../store.js';
import { run } from '../pipeline.js';
import { askClaude, extractJSON } from '../claude.js';
import { speakCharacterLines } from '../character/clips.js';
import { NARRATOR } from '../character/prompts.js';
import { PIPELINE } from '../character/cast.js';
import { info as elevenInfo } from '../eleven.js';

const LIB = () => settings().libraryPath;
const PY = () => path.join(LIB(), '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const HINGLISH = /\b(hai|hain|nahi|kya|kaise|mein|toh|aur|yeh|woh|kar|karo|hota|hoti|tum|aap|bhi|sirf|wala|wali|kyun|abhi|sab|jab|tab)\b/gi;
export const VOICE_KIND = { eleven: 'eleven', own: 'own', tts: 'tts', character: 'character' };   // mixer: real voices stay close, no room

const writeLines = (dir, lines) => fs.writeFileSync(path.join(dir, 'lines.json'), JSON.stringify(lines, null, 1));
async function alignWords(dir, vdir, log) {
  log('timing: word-level alignment');
  try { await run(PY(), [path.join(LIB(), 'core/tts/asr_check.py'), path.join(dir, 'lines.json'), vdir, '--lang', 'en', '--model', 'small.en'], { cwd: LIB(), env: { PYTHONIOENCODING: 'utf-8' } }); } catch { /* asr_check exits non-zero on differences; words.json is still written */ }
}

async function speakBuiltin(lines, dir, vdir, log) {
  writeLines(dir, lines);
  await run(PY(), [path.join(LIB(), 'core/tts/tts.py'), path.join(dir, 'lines.json'), vdir], { cwd: LIB() });
  await alignWords(dir, vdir, log);
}

// Built-in voices when ElevenLabs cannot speak (credits used up etc.). Hinglish / Hindi lines go to Microsoft's Indian
// neural voices (edge-tts, the library's tts_zh.py); English, or no internet, goes to the offline Kokoro voice.
async function speakFallback(lines, dir, vdir, log, why) {
  const all = lines.map(l => l.text).join(' '), words = all.split(/\s+/).length || 1;
  const hindi = /[ऀ-ॿ]/.test(all), hinglish = !hindi && (all.match(HINGLISH) || []).length / words > 0.04;
  const kokoro = () => { log(`voice: ElevenLabs could not speak (${why}) - using the default voice bf_emma (Kokoro, offline) instead`); return speakBuiltin(lines.map(l => ({ ...l, voice: 'bf_emma' })), dir, vdir, log); };
  if (!hindi && !hinglish) return kokoro();
  // a Hindi neural voice reads Devanagari properly; captions keep the plan's text, only the spoken words ("say") change
  const voice = settings().hindiVoice || 'hi-IN-MadhurNeural';
  let deva = {};
  if (hinglish) {
    try {
      log('voice: writing the Hinglish lines in Devanagari for the Hindi voice');
      deva = extractJSON(await askClaude(`Rewrite each Hinglish line (Roman script) in Devanagari so that a Hindi text-to-speech voice pronounces it naturally, the way an Indian speaker says it. Keep the meaning and every word. Write ONLY the Hindi words in Devanagari; every English word stays in English (Latin letters), exactly as in the line: e.g. "Dashboard par sab ek jagah dikhta hai" -> "Dashboard पर सब एक जगह दिखता है", "Not Generated wale bills chuniye" -> "Not Generated वाले bills चुनिए". Brand and product names stay as they are (MargBooks, GST, Google Play). Keep the punctuation, so the voice pauses in the same places. Return ONLY a JSON object {"<id>": "<Devanagari line>"}.\n\n${JSON.stringify(Object.fromEntries(lines.map(l => [l.id, l.text])))}`, { model: settings().claudeModel, timeoutMs: 5 * 60 * 1000 }));
    } catch (e) { log('voice: Devanagari rewrite failed (' + String(e.message).slice(0, 120) + '), the Hindi voice reads the Roman text'); }
  }
  const said = lines.map(({ speed, ...l }) => ({ ...l, voice, rate: '-6%', ...(typeof deva[l.id] === 'string' && deva[l.id].trim() ? { say: deva[l.id].trim() } : {}) }));
  writeLines(dir, said);
  log(`voice: ElevenLabs could not speak (${why}) - using the default Hindi voice ${voice} (${said.filter(l => l.say).length} of ${said.length} lines in Devanagari)`);
  try {
    await run(PY(), [path.join(LIB(), 'core/tts/tts_zh.py'), path.join(dir, 'lines.json'), vdir], { cwd: LIB(), env: { PYTHONIOENCODING: 'utf-8' } });
    // English speech recognition cannot time Hindi speech (it gives one-word captions): captions are spread over each line instead
    fs.rmSync(path.join(vdir, 'words.json'), { force: true });
    log('timing: Hindi voice, captions spread evenly over each spoken line');
  } catch (e) { log('voice: the online Indian voice failed too (' + String(e.message).slice(0, 120) + ')'); await kokoro(); }
}

async function speakEleven(lines, plan, dir, vdir, log, voiceName) {
  log(`voice: ${lines.length} lines with ElevenLabs (${voiceName})`);
  writeLines(dir, lines);
  let elErr = '';
  try {
    // word timings come back with the audio, no speech recognition needed
    await run('node', [path.join(ROOT, 'tools', 'eleven.js'), 'tts', path.join(dir, 'lines.json'), vdir], { cwd: ROOT, log: m => { const k = /line (\d+)\//.exec(m); if (m.startsWith('{"ok":false')) { elErr = m; log('voice: ' + m); } else if (k && +k[1] % 10 === 0) log('voice: ' + m.replace('[eleven] ', '')); } });
    return VOICE_KIND.eleven;
  } catch (e) {
    // ElevenLabs failed (credits used up, key rejected, network...): make the video with the built-in voices instead of stopping
    let why = String(e.message || e); try { why = JSON.parse(elErr).error || why; } catch {}
    for (const f of fs.readdirSync(vdir)) if (!f.startsWith('.')) fs.rmSync(path.join(vdir, f), { force: true, recursive: true });   // no half-ElevenLabs mix
    const clean = plan.chapters.flatMap(ch => ch.lines.map(l => ({ id: l.id, text: l.say, speed: lines[0].speed })));   // without the [tag] directions
    await speakFallback(clean, dir, vdir, log, why.slice(0, 200));
    return VOICE_KIND.tts;
  }
}

// the job's voice; an ElevenLabs voice that is no longer on the account (removed, or the key changed) becomes the default one
function voiceOf(job) {
  const name = job.voice || settings().voice; if (!String(name).startsWith('eleven:')) return name;
  const { voices, defaultVoice } = elevenInfo(), id = name.slice('eleven:'.length);
  return voices.some(v => v.id === id) || !defaultVoice ? name : 'eleven:' + defaultVoice;
}

// the editor's cut and speed on narrator lines (plan line "trim" {start, end} and "speed"): shortens / speeds up each
// line's audio and moves its word timings with it, so captions stay on the words
async function applyLineEdits(plan, vdir) {
  const edited = plan.chapters.flatMap(c => c.lines).filter(l => l.trim || (l.speed && l.speed !== 1)); if (!edited.length) return;
  const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const dur = readJSON(path.join(vdir, 'dur.json')) || {}, words = readJSON(path.join(vdir, 'words.json'));
  for (const l of edited) {
    const f = path.join(vdir, l.id + '.wav'); if (!fs.existsSync(f) || !dur[l.id]) continue;
    const from = l.trim?.start || 0, keep = Math.max(0.5, dur[l.id] - from - (l.trim?.end || 0)), speed = l.speed || 1, out = f + '.edit.wav';
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(from), '-t', keep.toFixed(3), '-i', f, ...(speed !== 1 ? ['-filter:a', `atempo=${speed}`] : []), out]); fs.renameSync(out, f);
    dur[l.id] = +(keep / speed).toFixed(3);
    if (words?.[l.id]) words[l.id] = words[l.id].map(([w, s, e]) => [w, +((s - from) / speed).toFixed(3), +((e - from) / speed).toFixed(3)]).filter(([, s, e]) => e > 0 && s < dur[l.id]);
  }
  fs.writeFileSync(path.join(vdir, 'dur.json'), JSON.stringify(dur, null, 1)); if (words) fs.writeFileSync(path.join(vdir, 'words.json'), JSON.stringify(words));
}

// one narrator for a whole (classic) video, with the editor's cuts applied
async function narrateClassic(ctx) {
  const kind = await speakNarrator(ctx);
  await applyLineEdits(ctx.plan, ctx.vdir);
  return kind;
}

// who reads the lines: the creator's recording, ElevenLabs, or the built-in voice
async function speakNarrator({ job, plan, dir, vdir, log }) {
  const st = settings(), voiceName = voiceOf(job), eleven = String(voiceName).startsWith('eleven:');
  // the lines as said: ElevenLabs reads the [tag] voice directions (l.tts), every other voice the clean text
  const lines = plan.chapters.flatMap(ch => ch.lines.map(l => ({ id: l.id, text: eleven && l.tts ? l.tts : l.say, voice: voiceName, speed: +st.voiceSpeed || 0.97 })));
  if (job.voiceFile && fs.existsSync(path.join(dir, job.voiceFile))) {
    log('voice: using YOUR recording (splitting it into lines with speech recognition)');
    writeLines(dir, lines);
    await run(PY(), [path.join(ROOT, 'tools', 'split_recording.py'), path.join(dir, job.voiceFile), path.join(dir, 'lines.json'), vdir], { cwd: LIB(), env: { PYTHONIOENCODING: 'utf-8' }, log: m => /matched|WARNING/.test(m) && log('voice: ' + m) });
    return VOICE_KIND.own;
  }
  if (eleven) return speakEleven(lines, plan, dir, vdir, log, voiceName);
  log(`voice: ${lines.length} lines (${voiceName})`);
  await speakBuiltin(lines, dir, vdir, log);
  return VOICE_KIND.tts;
}

// a character video: each character's lines in that character's own voice (Omni Flash clips), and the lines that belong
// to nobody in the channel's narrator voice (spoken apart, then merged into the same files)
async function narrateCharacterVideo(ctx) {
  const { plan, vdir, log } = ctx, readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
  const narratorLines = plan.chapters.flatMap(c => c.lines).filter(l => !l.speaker || l.speaker === NARRATOR);
  const dur = {}, words = {};
  if (narratorLines.length) {
    const tmp = path.join(vdir, 'narrator'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    // ElevenLabs acts on a [tag]: the line's emotion becomes one
    const lines = narratorLines.map(l => ({ ...l, tts: l.emotion && l.emotion !== 'neutral' ? `[${l.emotion}] ${l.say}` : l.tts }));
    log(`voice: ${lines.length} narrator lines`);
    await narrateClassic({ ...ctx, plan: { ...plan, chapters: [{ lines }] }, vdir: tmp });
    for (const l of lines) fs.renameSync(path.join(tmp, l.id + '.wav'), path.join(vdir, l.id + '.wav'));
    Object.assign(dur, readJSON(path.join(tmp, 'dur.json'))); Object.assign(words, readJSON(path.join(tmp, 'words.json')));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  Object.assign(dur, await speakCharacterLines(ctx));   // character lines have no word timings: captions spread over the line
  fs.writeFileSync(path.join(vdir, 'dur.json'), JSON.stringify(dur, null, 1));
  if (Object.keys(words).length) fs.writeFileSync(path.join(vdir, 'words.json'), JSON.stringify(words)); else fs.rmSync(path.join(vdir, 'words.json'), { force: true });
  return VOICE_KIND.character;
}

// speaks the plan into <vdir>; returns the voice kind for the mixer
export async function narrate(ctx) {
  const { job, vdir, log } = ctx;
  fs.mkdirSync(vdir, { recursive: true });
  if (process.env.HS_REUSE_VOICE && fs.existsSync(path.join(vdir, 'dur.json'))) {
    log('voice: reusing the lines already recorded for this job (no new cost)');
    return job.pipeline === PIPELINE.character ? VOICE_KIND.character : String(job.voice || settings().voice).startsWith('eleven:') ? VOICE_KIND.eleven : VOICE_KIND.tts;
  }
  return job.pipeline === PIPELINE.character ? narrateCharacterVideo(ctx) : narrateClassic(ctx);
}
