// Engine v2 production pipeline for one job:
// images -> narration -> word timing -> timeline -> picture -> score/sfx mix -> master -> subtitles, thumbnail, credits.
import fs from 'fs'; import path from 'path';
import { ROOT, settings } from '../store.mjs';
import { run } from '../pipeline.mjs';
import { buildTimeline, srtFrom } from './timeline.mjs';
import { askClaude, extractJSON } from '../claude.mjs';
import { normalizePlan } from './plan.mjs';
import { makeThumbnail } from './thumb.mjs';

const LIB = () => settings().libraryPath;
const PY = () => path.join(LIB(), '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const BASH = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'sh';

// when a requested photo couldn't be found, turn the shots that needed it into ones that don't
function repairMissing(plan, have) {
  const ok = id => !id || have.has(id);
  for (const ch of plan.chapters) for (const l of ch.lines) l.shots = l.shots.map(s => {
    s = { ...s };
    if (s.inset && !ok(s.inset)) { delete s.inset; delete s.insetLabel; }
    if (s.img && !ok(s.img)) {
      if (['photo', 'spin'].includes(s.type)) { const lab = String(s.label || s.text || '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(); return { ...s, type: 'punch', img: undefined, text: (lab || l.say.split(/\s+/).slice(0, 5).join(' ')).toUpperCase() }; }
      delete s.img;
    }
    if (s.type === 'split' && (!ok(s.a) || !ok(s.b))) return { type: 'text', lines: [s.la || '', s.vs || 'VS', s.lb || ''].filter(Boolean), at: s.at, sfx: s.sfx };
    return s;
  });
  for (const b of plan.board || []) if (b.img && !have.has(b.img)) { b.kind = 'card'; b.lines = b.lines || [b.cap || '']; delete b.img; }
  return plan;
}

export async function buildVideoV2(job, log) {
  const st = settings(), dir = path.join(ROOT, 'jobs', job.id), short = job.format === 'short';
  let plan = JSON.parse(JSON.stringify(job.script));
  if (plan.chapters.some(c => c.lines.some(l => !l.id))) plan = normalizePlan(plan, job.format).plan;   // ids, number spelling, repairs
  // OWNER'S RULE (THEMES.md): every video uses only Lemo Opuscar library themes. Refuse anything else, no exceptions.
  const { themeOf } = await import('./themes.mjs');   // the only themes that exist (lib/v2/themes.mjs)
  const bad = plan.look !== 'lib' ? 'its plan is not a Lemo Opuscar library-theme plan' : plan.chapters.map(c => c.style).find(st => !themeOf(st));
  if (bad) throw new Error('Blocked by THEMES.md: ' + (bad.startsWith('its') ? bad : `"${bad}" is not a Lemo Opuscar theme in lib/v2/themes.mjs`) + '. Only Lemo Opuscar themes may be rendered (the themes in lib/v2/themes.mjs). Make a new plan for this video.');
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  for (const f of ['index.html', 'film.js', 'illus.js', 'draw.js', 'fx.js', 'exam.js', 'sim.js', 'styles2.js', 'fonts.css', 'map.js']) fs.copyFileSync(path.join(ROOT, 'engine', f), path.join(dir, f));
  fs.cpSync(path.join(ROOT, 'engine', 'fonts'), path.join(dir, 'fonts'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'engine', 'vendor'), path.join(dir, 'vendor'), { recursive: true });

  // 0. the creator's own media: photos are converted into img/<id>.jpg, video clips are cut into frames later
  const media = Array.isArray(job.media) ? job.media : [];
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  for (const m of media.filter(m => m.kind === 'image')) {
    const outImg = path.join(dir, 'img', m.id + '.jpg');
    if (!fs.existsSync(outImg)) await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, m.file), '-vf', "scale='min(2400,iw)':-2", '-q:v', '3', outImg]);
  }
  if (media.length) log(`your media: ${media.filter(m => m.kind === 'image').length} photos, ${media.filter(m => m.kind === 'video').length} video clips`);
  // 1. photos (Wikimedia Commons, free licences only); reuse earlier downloads on re-render
  const imgDir = path.join(dir, 'img'); fs.mkdirSync(imgDir, { recursive: true });
  const need = (plan.images || []).filter(r => !fs.existsSync(path.join(imgDir, r.id + '.jpg')));
  let credits = []; try { credits = JSON.parse(fs.readFileSync(path.join(imgDir, 'credits.json'), 'utf8')); } catch {}
  if (need.length) {
    log(`photos: searching Wikimedia Commons for ${need.length} images`);
    try {
      const { findImages } = await import('../images.mjs');
      const choose = st.claudePicksImages ? async (want, cands) => {
        const r = await askClaude(`Pick the best image for a history documentary shot. Needed: "${want}". Prefer real historical photographs, paintings, engravings, documents and good photos of the actual place or object. Never pick book covers, posters, adverts, logos, modern illustrations or fan art, images dominated by text, or pictures of a different place/person. Reply with ONLY the index number (0-${cands.length - 1}), or -1 if none fits.\n` + cands.map((c, i) => `${i}: ${c.title} | ${c.description || ''} | ${c.date || ''} | ${c.width}x${c.height}`).join('\n'), { model: st.claudeModel, timeoutMs: 120000 });
        const n = parseInt(String(r).match(/-?\d+/)?.[0] ?? '0', 10); return n;
      } : undefined;
      let res = await findImages(need, imgDir, { log, choose });
      // Wikimedia sometimes rate-limits for ~10 minutes: wait it out and retry the missing ones (up to 2 more rounds)
      for (let round = 1; round <= 2; round++) {
        const limited = (res || []).filter(r => !r.ok && /rate-limit/i.test(r.error || ''));
        if (!limited.length || limited.length < Math.max(2, need.length * 0.25)) break;   // a couple of missing photos isn't worth a 10-minute wait
        const m = /retry after ([0-9:]+\s*[ap]m)/i.exec(limited[0].error || ''); let waitMs = 6 * 60e3;
        if (m) { const [hh, mm, ss] = m[1].match(/\d+/g).map(Number), pm = /pm/i.test(m[1]); const d = new Date(); d.setHours((hh % 12) + (pm ? 12 : 0), mm, ss || 0, 0); waitMs = Math.min(15 * 60e3, Math.max(30e3, d - Date.now() + 15e3)); }
        log(`photos: Wikimedia asked us to slow down; waiting ${Math.round(waitMs / 60000)} min, then retrying ${limited.length} photos`);
        await new Promise(r => setTimeout(r, waitMs));
        const again = need.filter(r => limited.some(x => x.id === r.id));
        const { findImages: fi2 } = await import('../images.mjs?r=' + round + Date.now());   // fresh module state (clears the blocked-host flag)
        res = await fi2(again, imgDir, { log, choose });
      }
      try { credits = JSON.parse(fs.readFileSync(path.join(imgDir, 'credits.json'), 'utf8')); } catch {}
    } catch (e) { log('photos: search failed (' + e.message.slice(0, 200) + '), continuing without some photos'); }
  }
  const have = new Set(fs.readdirSync(imgDir).filter(f => f.endsWith('.jpg')).map(f => f.replace(/\.jpg$/, '')));
  log(`photos: ${have.size} of ${(plan.images || []).length} found`);
  repairMissing(plan, have);

  // 2. narration
  const elevenVoice = String(job.voice || st.voice).startsWith('eleven:');   // only ElevenLabs reads the [tag] voice directions
  const lines = plan.chapters.flatMap(ch => ch.lines.map(l => ({ id: l.id, text: elevenVoice && l.tts ? l.tts : l.say, voice: job.voice || st.voice, speed: +st.voiceSpeed || 0.97 })));
  fs.writeFileSync(path.join(dir, 'lines.json'), JSON.stringify(lines, null, 1));
  const vdir = path.join(dir, 'voices'); fs.mkdirSync(vdir, { recursive: true });
  const myVoice = job.voiceFile && fs.existsSync(path.join(dir, job.voiceFile));
  if (process.env.HS_REUSE_VOICE && fs.existsSync(path.join(vdir, 'dur.json'))) {
    log('voice: reusing the recorded lines already in this job (same narration, no new ElevenLabs cost)');
  } else if (myVoice) {
    // a real human recording: split it into the plan's lines and get word timings in one go
    log('voice: using YOUR recording (splitting it into lines with speech recognition)');
    await run(PY(), [path.join(ROOT, 'tools', 'split_recording.py'), path.join(dir, job.voiceFile), path.join(dir, 'lines.json'), vdir], { cwd: LIB(), env: { PYTHONIOENCODING: 'utf-8' }, log: m => /matched|WARNING/.test(m) && log('voice: ' + m) });
  } else if (String(job.voice || st.voice).startsWith('eleven:')) {
    // ElevenLabs (e.g. the user's own cloned voice): word timings come back with the audio, no speech recognition needed
    log(`voice: ${lines.length} lines with ElevenLabs (${job.voice || st.voice})`);
    await run('node', [path.join(ROOT, 'tools', 'eleven.mjs'), 'tts', path.join(dir, 'lines.json'), vdir], { cwd: ROOT, log: m => { const k = /line (\d+)\//.exec(m); if (m.startsWith('{"ok":false')) log('voice: ' + m); else if (k && +k[1] % 10 === 0) log('voice: ' + m.replace('[eleven] ', '')); } });
  } else {
    log(`voice: ${lines.length} lines (${job.voice || st.voice})`);
    await run(PY(), [path.join(LIB(), 'core/tts/tts.py'), path.join(dir, 'lines.json'), vdir], { cwd: LIB() });
    // 3. word timing (speech recognition); mismatches are expected and only used to align captions
    log('timing: word-level alignment');
    try { await run(PY(), [path.join(LIB(), 'core/tts/asr_check.py'), path.join(dir, 'lines.json'), vdir, '--lang', 'en', '--model', 'small.en'], { cwd: LIB(), env: { PYTHONIOENCODING: 'utf-8' } }); } catch (e) { /* asr_check exits non-zero on differences; words.json is still written */ }
  }
  const dur = JSON.parse(fs.readFileSync(path.join(vdir, 'dur.json'), 'utf8'));
  let words = {}; try { words = JSON.parse(fs.readFileSync(path.join(vdir, 'words.json'), 'utf8')); } catch { log('timing: no word timings, using even spacing'); }

  // 4. timeline
  const { TL, mix, stats } = buildTimeline(plan, dur, words, { channel: st.channelName, format: job.format });
  for (let k = 0; k < TL.shots.length; k++) {
    const s = TL.shots[k]; if (s.type !== 'clip') continue; const m = media.find(x => x.id === s.clip); if (!m) { s.type = 'text'; s.lines = [String(s.label || '').toUpperCase() || ' ']; continue; }
    const len = ((TL.shots[k + 1] ? TL.shots[k + 1].t : TL.dur) - s.t) + .6, cdir = path.join(dir, 'img', 'clips', 'c' + k);
    fs.rmSync(cdir, { recursive: true, force: true }); fs.mkdirSync(cdir, { recursive: true });
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, +s.from || 0)), '-t', len.toFixed(2), '-i', path.join(dir, m.file), '-vf', `fps=${st.fps2 || 30},scale=${short ? '1080:-2' : '1920:-2'}`, '-q:v', '4', path.join(cdir, 'f%05d.jpg')]);
    s.clipDir = 'img/clips/c' + k; s.frames = fs.readdirSync(cdir).length; s.fps = st.fps2 || 30;
  }
  if (plan.diagrams && plan.diagrams.length) TL.diagrams = plan.diagrams;   // exam channels: vector diagrams drawn by engine/exam.js
  // painted backgrounds: each draw scene with a "bg" description gets an original anime-style painting (CPU, OpenVINO), cached by prompt
  const bgShots = TL.shots.filter(s => s.type === 'draw' && s.bg && typeof s.bg === 'string');
  if (bgShots.length && st.paintBackgrounds !== false) {
    const crypto = await import('crypto'), cache = path.join(ROOT, 'data', 'bgcache'), [bw, bh] = short ? [576, 1024] : [1024, 576], jobsP = [];
    for (const s of bgShots) { const h = crypto.createHash('sha1').update(s.bg + '|' + bw + 'x' + bh).digest('hex').slice(0, 12); s.bgimg = 'bg_' + h; jobsP.push({ prompt: s.bg, out: path.join(cache, h + '.jpg'), w: bw, h: bh }); }
    const uniq = [...new Map(jobsP.map(j => [j.out, j])).values()];
    fs.mkdirSync(cache, { recursive: true }); fs.writeFileSync(path.join(dir, 'out', 'paint.json'), JSON.stringify(uniq));
    log(`backgrounds: painting ${uniq.filter(j => !fs.existsSync(j.out)).length} new of ${uniq.length} (about 1 to 3 minutes each on this laptop CPU, cached afterwards)`);
    try { await run('python', [path.join(ROOT, 'tools', 'paint.py'), path.join(dir, 'out', 'paint.json')], { cwd: ROOT, env: { PYTHONIOENCODING: 'utf-8' }, log: m => /painted \d/.test(m) && log('backgrounds: ' + m) }); }
    catch (e) { log('backgrounds: painting failed, using drawn backgrounds (' + e.message.slice(0, 160) + ')'); }
    for (const j of uniq) if (fs.existsSync(j.out)) fs.copyFileSync(j.out, path.join(dir, 'img', 'bg_' + path.basename(j.out)));
    for (const s of bgShots) if (!fs.existsSync(path.join(dir, 'img', s.bgimg + '.jpg'))) delete s.bgimg;
  }
  // close-up reaction faces (Open Peeps, CC0): one SVG per cast member and emotion
  if (TL.shots.some(s => s.type === 'react')) { const { peep } = await import('./peeps.mjs'); for (const s of TL.shots) if (s.type === 'react') s.peep = await peep(dir, s.who, s.emotion); log(`faces: ${new Set(TL.shots.filter(s => s.type === 'react').map(s => s.peep)).size} close-up reactions`); }
  // lip-sync: put each line's mouth shapes (from the voice's letter timings) on the video clock, for talking characters
  try { const mo = JSON.parse(fs.readFileSync(path.join(vdir, 'mouth.json'), 'utf8')); TL.mouth = (mix.voice || []).flatMap(v => (mo[v.id] || []).map(([a, b, sh]) => [+(v.at + a).toFixed(3), +(v.at + b).toFixed(3), sh])); } catch { /* built-in voices: mouths open and close with the words instead */ }
  fs.writeFileSync(path.join(dir, 'timeline.js'), 'window.TL=' + JSON.stringify(TL) + ';');
  // Lemo Opuscar library theme (THEMES.md): the page is the library's own engine driven by our director, plus its board foley
  if (plan.look === 'lib') {
    const L = path.join(ROOT, 'engine', 'lib');
    fs.copyFileSync(path.join(L, 'mix.html'), path.join(dir, 'index.html'));
    for (const f of ['whiteboard.js', 'anime.js', 'mix.js']) fs.copyFileSync(path.join(L, f), path.join(dir, f));
    for (const f of fs.readdirSync(path.join(L, 'fonts'))) fs.copyFileSync(path.join(L, 'fonts', f), path.join(dir, 'fonts', f));
    const { EXTRA_GLYPHS } = await import('../../engine/lib/glyphs.mjs');
    const font = JSON.parse(fs.readFileSync(path.join(LIB(), 'styles', 'whiteboard', 'demo', 'fonts', 'EMSTech.json'), 'utf8')); Object.assign(font.glyphs, EXTRA_GLYPHS);
    fs.writeFileSync(path.join(dir, 'fonts', 'hs_tech.json'), JSON.stringify(font));
    // per-video scene direction (the library's way of making a film): Claude writes this video's anime scenes with the theme's tools and checks frames
    { const { directAnime, directScenes } = await import('./director.mjs'), D = { dir, TL, plan, lib: LIB(), size: short ? '1080x1920' : '1920x1080', log, model: st.claudeModel }; await directAnime(D); await directScenes(D); }
    await run('node', ['core/render/events.mjs', dir], { cwd: LIB() });
    await run(PY(), [path.join(ROOT, 'tools', 'board_foley.py'), path.join(dir, 'events.json'), path.join(dir, 'out', 'foley.wav')], { env: { HS_LIB: LIB() } });
    mix.foley = path.join(dir, 'out', 'foley.wav'); mix.foleyGain = .5;
    mix.sfx = (mix.sfx || []).filter(e => ['ding', 'alarm', 'riser'].includes(e.k));   // the board makes its own sounds; no whooshes
    log('themes: Lemo Opuscar ' + [...new Set(plan.chapters.map(c => c.style))].join(' + ') + ' (library engines) + board foley');
  }
  mix.voiceKind = elevenVoice ? 'eleven' : myVoice ? 'own' : 'tts';   // the mixer keeps real voices close and punchy (no room reverb)
  fs.writeFileSync(path.join(dir, 'out', 'mixplan.json'), JSON.stringify(mix));
  log(`timeline: ${stats.dur.toFixed(1)} s, ${stats.shots} shots, a new shot every ${stats.avgShot} s`);

  // 5. picture
  const size = short ? '1080x1920' : '1920x1080', fps = st.fps2 || 30;
  log(`picture: rendering ${size} @ ${fps} fps (slow step: about ${Math.round(stats.dur * 1.8 / 60)} min)`);
  let lastPct = -1;
  // heavy frames can starve a worker when many browsers run at once: on a stall, retry with fewer workers
  const tries = [...new Set([+process.env.HS_RENDER_WORKERS || st.renderWorkers || 3, 2, 1])];
  for (let k = 0; k < tries.length; k++) {
    try {
      lastPct = -1; fs.rmSync(path.join(dir, 'out', 'video.mp4.lock'), { force: true });
      await run('node', ['core/render/video.mjs', dir, '--fps', String(fps), '--workers', String(tries[k]), '--size', size, '--out', path.join(dir, 'out', 'video.mp4')], { cwd: LIB(), log: m => { const mm = /(\d+)\/(\d+)/.exec(m); if (mm) { const p = Math.floor(+mm[1] / +mm[2] * 10) * 10; if (p > lastPct) { lastPct = p; log(`picture: ${p}%`); } } else if (/done|error/i.test(m)) log(m); } });
      break;
    } catch (e) { if (k === tries.length - 1 || !/Timeout|stopped/i.test(e.message)) throw e; log(`picture: a render worker stalled, retrying with ${tries[k + 1]} workers`); }
  }
  // 6. score + sfx + voice
  log('audio: score, sound effects, narration');
  await run(PY(), [path.join(ROOT, 'engine', 'mix.py'), path.join(dir, 'out', 'mixplan.json'), vdir, path.join(dir, 'out', 'mix.wav')], { env: { HS_LIB: LIB() } });
  // 7. master
  const final = path.join(dir, 'final.mp4');
  await run(BASH, ['core/render/mux.sh', path.join(dir, 'out', 'video.mp4'), path.join(dir, 'out', 'mix.wav'), final, String(fps), '0'], { cwd: LIB(), log: m => /LUFS|Peak/.test(m) && log('master: ' + m.trim()) });
  // 8. subtitles, thumbnail, credits
  fs.writeFileSync(path.join(dir, 'captions.srt'), srtFrom(TL));
  const hs = plan.look === 'lib' ? (TL.shots.find(s => s.type === 'anime' && s.text) || TL.shots.find(s => s.type === 'write' && (s.els || []).some(e => e.box)) || TL.shots[Math.floor(TL.shots.length / 3)]) : (TL.shots.find(s => s.type === 'headline' && s.img) || TL.shots.find(s => s.img) || TL.shots[0]);
  const tt = Math.min(TL.dur - .5, hs.t + (plan.look === 'lib' ? 2.4 : 1.2));
  await run('node', ['core/render/still.mjs', dir, tt.toFixed(2), '--size', size, ...(plan.look === 'lib' ? ['--q', 'nosubs=1'] : []), '--out', path.join(dir, 'out'), '--prefix', 'thumb_'], { cwd: LIB() });
  const th = fs.readdirSync(path.join(dir, 'out')).find(f => f.startsWith('thumb_')); if (th) fs.copyFileSync(path.join(dir, 'out', th), path.join(dir, 'thumb.jpg'));
  const used = new Set(); TL.shots.forEach(s => ['img', 'a', 'b', 'inset'].forEach(k => s[k] && used.add(s[k]))); (TL.board || []).forEach(b => b.img && used.add(b.img));
  const cr = credits.filter(c => used.has(c.id || String(c.file || '').replace(/\.jpg$/, '')));
  const creditText = cr.length ? 'Images (Wikimedia Commons): ' + cr.map(c => `${String(c.title || '').replace(/^File:/, '')} by ${c.author || 'unknown'} (${c.license})`).join('; ') + '.' : '';
  fs.writeFileSync(path.join(dir, 'CREDITS.txt'), creditText + '\nNarration: synthetic voice (Kokoro). Music and sound effects: generated. Map data: Natural Earth.\n');
  if (!short && plan.look !== 'lib') { try { await makeThumbnail({ dir, plan, TL, channel: job.channelName || st.channelName, log }); } catch (e) { log('thumbnail: kept a video frame (' + e.message.slice(0, 120) + ')'); } }
  log('done: ' + final);
  return { video: `jobs/${job.id}/final.mp4`, thumb: `jobs/${job.id}/thumb.jpg`, srt: `jobs/${job.id}/captions.srt`, duration: stats.dur, shots: stats.shots, avgShot: stats.avgShot, photos: have.size, credits: creditText };
}
