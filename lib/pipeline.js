// Turns an approved script into a finished video: voice -> timing -> picture -> music -> master -> subtitles -> thumbnail.
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { ROOT, settings } from './store.js';
import { styleOf } from './styles.js';
import { askClaude } from './claude.js';
import * as JC from './jobctx.js';

export function aiBuildPrompt({ dir, lib, slug, name, size, dur }) {
  const [w, h] = size.split('x');
  return `You are building ONE finished short film page in the "${name}" visual style, inside the folder ${dir} (your working directory). The lemo-opuscar film library is at ${lib}.

Read first: ${lib}/CLAUDE.md (how films are built and checked), the style guide ${lib}/styles/${slug}/STYLE.md, and skim the style's demo source in ${lib}/styles/${slug}/demo/ for technique (do not copy its story).

Fixed inputs (do NOT edit them): spec.js sets window.SPEC = { dur: ${dur}, scenes: [{ start, end, kind, heading, sub, big, items, narration }], captions: [{ s, e, text }] }. The narration audio is already recorded to those exact times; music is added later. voices/ holds the audio, don't touch it.

Your job: rewrite film.js (and index.html / extra files in THIS folder only, no network assets; fonts.css + fonts/ are available) so the page renders a striking, polished ${name} film that visualises what each scene's narration is saying, at its exact start/end times. Make it look like the best films in this style, not a slideshow.
Contract: window.DUR = SPEC.dur; window.render(t) must be deterministic (pure function of t, no Math.random without a seed, no Date); set window.READY = true after fonts/images load; canvas size = innerWidth x innerHeight (${w}x${h}, vertical); show SPEC.captions as clear burned-in subtitles in the lower third; on-screen facts, names and numbers must come only from the spec.
Check your work: from ${lib} run  node core/render/still.mjs "${dir}" <t> --size ${size} --out "${dir}/check"  at 6-8 times across the film, look at the images, and fix anything broken, unreadable or ugly. Do NOT render the full video. Stop when the stills look good, and reply DONE.`;
}

const LIB = () => settings().libraryPath;
const PY = () => path.join(LIB(), '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const BASH = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'sh';

export function run(cmd, args, { cwd, log, env } = {}) {
  JC.check();   // a video put on hold starts nothing new
  return new Promise((resolve, reject) => {
    const p = JC.track(spawn(cmd, args, { cwd, windowsHide: true, env: { ...process.env, ...env } }));
    let tail = '';
    const take = d => { const s = d.toString(); tail = (tail + s).slice(-4000); if (log) s.split(/\r?\n/).filter(x => x.trim()).forEach(x => log(x.slice(0, 300))); };
    p.stdout.on('data', take); p.stderr.on('data', take);
    p.on('error', reject);
    p.on('close', c => c === 0 ? resolve(tail) : reject(new Error(`${path.basename(cmd)} failed (${c}): ${tail.slice(-600)}`)));
  });
}

// split narration into caption chunks of ~7 words, timed by character share
function captionChunks(text, s, e) {
  const words = text.split(/\s+/).filter(Boolean), chunks = [];
  for (let i = 0; i < words.length;) {
    let n = Math.min(7, words.length - i);
    for (let k = i; k < i + n; k++) if (/[.!?;:]$/.test(words[k]) && k - i >= 2) { n = k - i + 1; break; }
    chunks.push(words.slice(i, i + n).join(' ')); i += n;
  }
  const total = chunks.reduce((a, c) => a + c.length, 0) || 1; let t = s; const out = [];
  for (const c of chunks) { const d = (e - s) * c.length / total; out.push({ s: +t.toFixed(2), e: +(t + d).toFixed(2), text: c }); t += d; }
  return out;
}
const srtTime = x => { const ms = Math.round(x * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

export async function buildVideo(job, log) {
  const st = settings();
  const dir = path.join(ROOT, 'jobs', job.id);
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  // 1. page files
  for (const f of ['index.html', 'film.js', 'fonts.css']) fs.copyFileSync(path.join(ROOT, 'template', f), path.join(dir, f));
  fs.cpSync(path.join(ROOT, 'template', 'fonts'), path.join(dir, 'fonts'), { recursive: true });
  const scenes = job.script.scenes.map((s, i) => ({ ...s, id: 's' + String(i + 1).padStart(3, '0') }));

  // 2. voice
  log('voice: generating narration');
  const lines = scenes.filter(s => (s.narration || '').trim()).map(s => ({ id: s.id, text: s.narration.trim(), voice: st.voice, speed: +st.voiceSpeed || 0.92 }));
  fs.mkdirSync(path.join(dir, 'voices'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lines.json'), JSON.stringify(lines, null, 1));
  await run(PY(), [path.join(LIB(), 'core/tts/tts.py'), path.join(dir, 'lines.json'), path.join(dir, 'voices')], { cwd: LIB(), log });
  const durs = JSON.parse(fs.readFileSync(path.join(dir, 'voices', 'dur.json'), 'utf8'));

  // 3. timing
  let t = 0.4; const voice = [], captions = [];
  for (const s of scenes) {
    const d = durs[s.id] || 0, lead = 0.35, tail = s.kind === 'chapter' || s.kind === 'title' ? 0.9 : 0.5;
    s.start = +t.toFixed(3);
    if (d) { voice.push({ id: s.id, at: t + lead }); captions.push(...captionChunks(s.narration, t + lead, t + lead + d)); }
    const minDur = s.kind === 'list' ? 4 : 2.8;
    t += Math.max(minDur, lead + d + tail); s.end = +t.toFixed(3);
  }
  scenes[0].start = 0;
  const dur = +(t + 1.2).toFixed(2); scenes[scenes.length - 1].end = dur;
  const slug = job.style || 'archive-lighttable', sty = styleOf(slug) || { mode: 'fast', preset: 'paper', name: slug };
  const aiMode = sty.mode === 'ai' && job.format === 'short';
  const spec = { dur, style: sty.preset || 'paper', styleSlug: slug, series: job.theme, channel: st.channelName, format: job.format, scenes, captions: st.burnCaptions ? captions : [] };
  fs.writeFileSync(path.join(dir, 'spec.js'), 'window.SPEC=' + JSON.stringify(spec) + ';\n');
  fs.writeFileSync(path.join(dir, 'out', 'mixplan.json'), JSON.stringify({ dur, voice, seed: job.id.length }));
  log(`timing: ${dur.toFixed(1)} s, ${scenes.length} scenes, style ${sty.name}${aiMode ? ' (AI-built)' : ''}`);
  const size = job.format === 'long' ? '1920x1080' : '1080x1920';

  // 3b. AI-built style: Claude Code designs a custom film page for this video
  if (aiMode) {
    log(`AI build: Claude is designing a ${sty.name} film (this can take 20-60 minutes)`);
    try {
      await askClaude(aiBuildPrompt({ dir, lib: LIB(), slug, name: sty.name, size, dur }), {
        model: st.claudeModel, cwd: dir, timeoutMs: (st.aiBuildMinutes || 75) * 60 * 1000,
        extraArgs: ['--allowedTools', 'Read,Write,Edit,Glob,Grep,Bash', '--add-dir', LIB(), '--permission-mode', 'acceptEdits'],
      });
      // the page must load and draw; otherwise fall back to the template
      await run('node', ['core/render/still.mjs', dir, String((dur / 2).toFixed(1)), '--size', size, '--out', path.join(dir, 'out'), '--prefix', 'aicheck_'], { cwd: LIB() });
      log('AI build: page works');
    } catch (e) {
      log('AI build failed, using the template instead: ' + e.message.slice(0, 300));
      for (const f of ['index.html', 'film.js']) fs.copyFileSync(path.join(ROOT, 'template', f), path.join(dir, f));
    }
  }

  // 4. picture
  log(`picture: rendering ${size} (this is the slow step)`);
  await run('node', ['core/render/video.mjs', dir, '--fps', String(st.fps || 24), '--workers', String(st.renderWorkers || 4), '--size', size, '--out', path.join(dir, 'out', 'video.mp4')], { cwd: LIB(), log: m => /\d+%|frames|done|error|Error/i.test(m) && log(m) });

  // 5. music + mix
  log('audio: mixing narration and music');
  await run(PY(), [path.join(ROOT, 'tools', 'mix.py'), path.join(dir, 'out', 'mixplan.json'), path.join(dir, 'voices'), path.join(dir, 'out', 'mix.wav')], { log });

  // 6. master (loudness -14 LUFS)
  const final = path.join(dir, 'final.mp4');
  await run(BASH, ['core/render/mux.sh', path.join(dir, 'out', 'video.mp4'), path.join(dir, 'out', 'mix.wav'), final, String(st.fps || 24), '1'], { cwd: LIB(), log });

  // 7. subtitles + thumbnail
  fs.writeFileSync(path.join(dir, 'captions.srt'), captions.map((c, i) => `${i + 1}\n${srtTime(c.s)} --> ${srtTime(c.e)}\n${c.text}\n`).join('\n'));
  const thumbT = Math.min(dur - 0.5, (scenes[0].end || 3) - 0.6);
  await run('node', ['core/render/still.mjs', dir, String(thumbT.toFixed(2)), '--size', size, '--out', path.join(dir, 'out'), '--prefix', 'thumb_'], { cwd: LIB() });
  const th = fs.readdirSync(path.join(dir, 'out')).find(f => f.startsWith('thumb_'));
  if (th) fs.copyFileSync(path.join(dir, 'out', th), path.join(dir, 'thumb.jpg'));
  log('done: ' + final);
  return { video: `jobs/${job.id}/final.mp4`, thumb: `jobs/${job.id}/thumb.jpg`, srt: `jobs/${job.id}/captions.srt`, duration: dur };
}

// validation of a script before it can be approved
export function validateScript(sc, format) {
  const errs = [], warns = [];
  if (!sc || !Array.isArray(sc.scenes) || !sc.scenes.length) return { errs: ['script has no scenes'], warns };
  if (!sc.title) errs.push('missing title'); else if (sc.title.length > 100) errs.push('title longer than 100 characters (YouTube limit)');
  const words = sc.scenes.reduce((a, s) => a + String(s.narration || '').split(/\s+/).filter(Boolean).length, 0);
  const secs = words / 2.3;
  if (format === 'short' && secs > 58) errs.push(`short is about ${Math.round(secs)} s; keep it under 60 s`);
  if (format === 'long' && secs < 180) warns.push(`long video is only about ${Math.round(secs / 60)} min`);
  sc.scenes.forEach((s, i) => {
    if (!s.heading && s.kind !== 'date' && s.kind !== 'fact') warns.push(`scene ${i + 1}: no on-screen heading`);
    if ((s.heading || '').split(/\s+/).length > 14) warns.push(`scene ${i + 1}: heading is long`);
    if (/[\u4e00-\u9fff]/.test(s.narration || '')) errs.push(`scene ${i + 1}: non-English characters in narration`);
  });
  if ((sc.description || '').length > 4900) errs.push('description too long');
  return { errs, warns, words, estSeconds: Math.round(secs) };
}
