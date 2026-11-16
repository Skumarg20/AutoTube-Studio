#!/usr/bin/env node
// ElevenLabs voice for AutoTube Studio. Key and voices live in config/elevenlabs.json (private, this PC only).
//
//   node tools/eleven.mjs check                      -> can this key make speech / clone voices?
//   node tools/eleven.mjs clone "<name>" <audio...>  -> instant voice clone from your recording(s), saved to config
//   node tools/eleven.mjs tts <lines.json> <out_dir> -> out_dir/<id>.wav (24 kHz mono, silence trimmed), dur.json, words.json
//   node tools/eleven.mjs sample <voiceId> <out.mp3> ["text"]
//
// lines.json: [{ id, text, voice: "eleven:<voiceId>" }]. words.json matches the Kokoro pipeline: { id: [[word, start, end], ...] }.
// Last stdout line is JSON ({ok:true,...} / {ok:false,error}).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = path.join(ROOT, 'config', 'elevenlabs.json');
const API = 'https://api.elevenlabs.io/v1';
const SR = 24000;
const log = (...a) => console.error('[eleven]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
class UserError extends Error {}

export function loadCfg() { let c = {}; try { c = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch {} if (process.env.ELEVENLABS_API_KEY) c.apiKey = process.env.ELEVENLABS_API_KEY; return c; }
export function saveCfg(c) { fs.mkdirSync(path.dirname(CFG), { recursive: true }); fs.writeFileSync(CFG, JSON.stringify(c, null, 2)); }
function key() { const k = loadCfg().apiKey; if (!k) throw new UserError('No ElevenLabs API key. Add it in Settings > Your voice.'); return k; }

function explain(status, body) {
  const d = body?.detail; const msg = typeof d === 'string' ? d : d?.message || (Array.isArray(d) ? d.map(x => x.msg).join('; ') : '') || JSON.stringify(body).slice(0, 300);
  if (d?.status === 'missing_permissions') return `${msg} Make a new key in ElevenLabs (Developers > API keys) with Text to Speech and Voices "Write" allowed.`;
  if (d?.status === 'quota_exceeded') return `ElevenLabs credits used up for this month: ${msg}`;
  if (status === 401) return `ElevenLabs rejected the key: ${msg}`;
  return `ElevenLabs HTTP ${status}: ${msg}`;
}
async function call(pathq, init = {}, tries = 5, binary = false) {
  for (let a = 0; ; a++) {
    let res;
    try { res = await fetch(API + pathq, { ...init, headers: { 'xi-api-key': key(), ...(init.headers || {}) } }); }
    catch (e) { if (a < tries) { await sleep(2000 * (a + 1)); continue; } throw new Error('Network error reaching ElevenLabs: ' + (e.cause?.code || e.message)); }
    if ((res.status === 429 || res.status >= 500) && a < tries) { log(`busy (HTTP ${res.status}), retrying`); await sleep(3000 * (a + 1)); continue; }
    if (binary && res.ok) return { res, body: Buffer.from(await res.arrayBuffer()) };
    const text = await res.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) throw new UserError(explain(res.status, body));
    return { res, body };
  }
}

// ---------- audio helpers ----------
function wav(pcm) { // pcm: Int16Array mono @ SR
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(pcm.length * 2, 40); Buffer.from(pcm.buffer, pcm.byteOffset, pcm.length * 2).copy(b, 44); return b;
}
function trimBounds(pcm) { // first/last sample louder than about -40 dB, with a little air kept
  const th = 330; let a = 0, z = pcm.length - 1;
  while (a < pcm.length && Math.abs(pcm[a]) < th) a++;
  while (z > a && Math.abs(pcm[z]) < th) z--;
  return [Math.max(0, a - Math.round(0.04 * SR)), Math.min(pcm.length, z + Math.round(0.12 * SR))];
}
// mouth shapes from letter timings (no extra program needed): A closed (m b p), B teeth (most consonants), C open (e i), D wide (a),
// E round (o), F pucker (u w), G lip-on-teeth (f v), H tongue (l), X rest. Returns [[start, end, shape], ...] in seconds from the line start.
const SHAPE = ch => /[mbp]/.test(ch) ? 'A' : /[fv]/.test(ch) ? 'G' : /[l]/.test(ch) ? 'H' : /[a]/.test(ch) ? 'D' : /[ei]/.test(ch) ? 'C' : /[o]/.test(ch) ? 'E' : /[uw]/.test(ch) ? 'F' : /[a-z]/.test(ch) ? 'B' : null;
function mouthFrom(al, offset, k = 1) {
  const out = []; if (!al?.characters) return out; let tag = false;
  al.characters.forEach((raw, i) => {
    const ch = String(raw).toLowerCase(); if (ch === '[') { tag = true; return; } if (tag) { if (ch === ']') tag = false; return; }
    const a = Math.max(0, al.character_start_times_seconds[i] - offset) / k, b = Math.max(0, al.character_end_times_seconds[i] - offset) / k, sh = SHAPE(ch);
    if (!sh) { if (b - a > .12) out.push([+a.toFixed(3), +b.toFixed(3), 'X']); return; }
    const last = out[out.length - 1]; if (last && last[2] === sh && a - last[1] < .03) last[1] = +b.toFixed(3); else out.push([+a.toFixed(3), +Math.max(b, a + .04).toFixed(3), sh]);
  });
  return out;
}
function wordsFrom(al, offset) {
  const out = []; if (!al?.characters) return out; let w = '', s = null, e = 0, tag = false;
  al.characters.forEach((ch, i) => {
    // v3 audio tags like [excited] or [clears throat] direct the voice; they are not spoken words, so no captions for them
    if (ch === '[') { tag = true; return; } if (tag) { if (ch === ']') tag = false; return; }
    if (/\s/.test(ch)) { if (w) out.push([w, s, e]); w = ''; s = null; return; }
    if (s === null) s = al.character_start_times_seconds[i]; w += ch; e = al.character_end_times_seconds[i];
  });
  if (w) out.push([w, s, e]);
  return out.map(([t, a, b]) => [t, +Math.max(0, a - offset).toFixed(3), +Math.max(0, b - offset).toFixed(3)]);
}

// ---------- commands ----------
async function cmdCheck() {
  const c = loadCfg(); const vid = c.defaultVoice || (c.voices || [])[0]?.id || 'JBFqnCBsd6RMkjVDRZzb';
  const out = { ok: true, hasKey: !!c.apiKey, tts: false, clone: null };
  if (!c.apiKey) return { ...out, error: 'no key' };
  try { await call(`/text-to-speech/${vid}?output_format=mp3_22050_32`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Hi.', model_id: c.model || 'eleven_multilingual_v2' }) }, 1, true); out.tts = true; }
  catch (e) { out.error = e.message; }
  return out;
}

async function cmdClone(name, files) {
  if (!name || !files.length) throw new UserError('Usage: clone "<name>" <audio files...>');
  const fd = new FormData(); fd.append('name', name); fd.append('description', 'AutoTube Studio narrator, cloned from my own recording');
  fd.append('remove_background_noise', 'false');
  for (const f of files) { const st = fs.statSync(f); if (st.size > 11 * 1024 * 1024) throw new UserError(`${path.basename(f)} is over 11 MB; use a compressed (mp3) copy.`); fd.append('files', await fs.openAsBlob(f, { type: f.endsWith('.mp3') ? 'audio/mpeg' : f.endsWith('.wav') ? 'audio/wav' : 'application/octet-stream' }), path.basename(f)); }
  log(`cloning voice "${name}" from ${files.length} file(s)`);
  const { body } = await call('/voices/add', { method: 'POST', body: fd }, 2);
  const c = loadCfg(); c.voices = (c.voices || []).filter(v => v.id !== body.voice_id); c.voices.push({ id: body.voice_id, name, createdAt: new Date().toISOString() });
  if (!c.defaultVoice) c.defaultVoice = body.voice_id; saveCfg(c);
  return { ok: true, voiceId: body.voice_id, name };
}

// eleven_v3 is the most human, expressive model (and the best at Hindi/Hinglish); its stability only takes 0, 0.5 or 1
export const modelOf = c => c.model || 'eleven_v3';
export function voiceSettings(c, model = modelOf(c)) {
  if (model === 'eleven_v3') { const s = c.stability ?? 0.5; return { stability: s < 0.25 ? 0 : s > 0.75 ? 1 : 0.5, similarity_boost: c.similarity ?? 0.8, use_speaker_boost: true }; }
  return { stability: c.stability ?? 0.45, similarity_boost: c.similarity ?? 0.8, style: c.style ?? 0, use_speaker_boost: true, speed: c.speed ?? 1.0 };
}
// physics/chemistry symbols must be read letter by letter ("mg" -> "M G", not "muh"); applied only to what the voice reads
const SYMBOLS = /\b(mgh|mg|mv|kx|qE|qV|IR|KE|PE|EMF|emf|dv|dt|dx|dy|LHS|RHS|NCERT|PYQ|JEE|NEET|IIT|SI)\b/g;
export const speakable = t => String(t).replace(SYMBOLS, m => m.toUpperCase().split('').join(' ')).replace(/\s+/g, ' ').trim();

async function speak(voiceId, text, ctx = {}) {
  const c = loadCfg(), model = modelOf(c);
  const { body } = await call(`/text-to-speech/${voiceId}/with-timestamps?output_format=pcm_24000`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: model, ...(model === 'eleven_v3' ? {} : { previous_text: ctx.prev || undefined, next_text: ctx.next || undefined }), voice_settings: voiceSettings(c, model) }),
  });
  const raw = Buffer.from(body.audio_base64, 'base64');
  return { pcm: new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2)), al: body.alignment || body.normalized_alignment };
}

async function cmdTts(linesFile, outDir) {
  const lines = JSON.parse(fs.readFileSync(linesFile, 'utf8')); fs.mkdirSync(outDir, { recursive: true });
  const dur = {}, words = {}, mouth = {}; let chars = 0, done = 0;
  const vid = String(lines[0]?.voice || '').replace(/^eleven:/, '') || loadCfg().defaultVoice;
  if (!vid) throw new UserError('No ElevenLabs voice chosen.');
  // ONE continuous take per chunk of lines (natural flow, breathing and intonation across sentences, like a real teacher),
  // then cut into lines at the pauses between them using the character timings
  const MAX = 2200, chunks = []; let cur = [];
  for (const L of lines) { if (cur.length && cur.reduce((n, x) => n + speakable(x.text).length + 1, 0) + speakable(L.text).length > MAX) { chunks.push(cur); cur = []; } cur.push(L); }
  if (cur.length) chunks.push(cur);
  for (let ci = 0; ci < chunks.length; ci++) {
    const C = chunks[ci], parts = C.map(L => speakable(L.text)), text = parts.join(' ');
    const prevText = ci ? speakable(chunks[ci - 1].slice(-2).map(x => x.text).join(' ')) : undefined, nextText = chunks[ci + 1] ? speakable(chunks[ci + 1].slice(0, 2).map(x => x.text).join(' ')) : undefined;
    const { pcm, al } = await speak(vid, text, { prev: prevText, next: nextText });
    const st = al?.character_start_times_seconds || [], en = al?.character_end_times_seconds || [], total = pcm.length / SR;
    // character range of each line inside the take, and when it is spoken
    let off = 0; const span = parts.map(p => { const a = off, b = off + p.length; off = b + 1; return { a, b, t0: st[a] ?? 0, t1: en[Math.max(a, b - 1)] ?? total }; });
    span.forEach((s, k) => {
      const L = C[k], from = k === 0 ? Math.max(0, s.t0 - 0.08) : (span[k - 1].t1 + s.t0) / 2, to = k === span.length - 1 ? Math.min(total, s.t1 + 0.35) : (s.t1 + span[k + 1].t0) / 2;
      const seg = pcm.slice(Math.round(from * SR), Math.round(to * SR)), [a, z] = trimBounds(seg), cut = seg.slice(a, z), t0 = from + a / SR;
      const file = path.join(outDir, `${L.id}.wav`); fs.writeFileSync(file, wav(cut));
      // energy: a slightly faster pace (pitch kept), like a teacher who holds attention; timings scale with it
      const tempo = Math.min(1.2, Math.max(0.85, +loadCfg().tempo || 1));
      if (Math.abs(tempo - 1) > 0.005) { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-filter:a', `atempo=${tempo}`, file + '.t.wav'], { windowsHide: true }); if (r.status === 0) fs.renameSync(file + '.t.wav', file); }
      const k2 = Math.abs(tempo - 1) > 0.005 ? tempo : 1;
      dur[L.id] = +(cut.length / SR / k2).toFixed(3);
      const sub = { characters: (al?.characters || []).slice(s.a, s.b), character_start_times_seconds: st.slice(s.a, s.b), character_end_times_seconds: en.slice(s.a, s.b) };
      words[L.id] = wordsFrom(sub, t0).map(([w, a, b]) => [w, +(a / k2).toFixed(3), +(b / k2).toFixed(3)]); chars += parts[k].length;
      mouth[L.id] = mouthFrom(sub, t0, k2);
      log(`line ${++done}/${lines.length} ${L.id} ${dur[L.id]}s`);
    });
  }
  fs.writeFileSync(path.join(outDir, 'dur.json'), JSON.stringify(dur, null, 1));
  fs.writeFileSync(path.join(outDir, 'words.json'), JSON.stringify(words));
  fs.writeFileSync(path.join(outDir, 'mouth.json'), JSON.stringify(mouth));   // lip-sync: mouth shapes timed from the voice's own letter timings
  return { ok: true, lines: lines.length, chars };
}

const SAMPLE = 'Four and a half thousand years ago, on a dry island in western India, a city learned to save every drop of rain.';
export async function cmdSample(voiceId, out, text) {
  const c = loadCfg();
  const { body } = await call(`/text-to-speech/${voiceId}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: speakable(text || SAMPLE), model_id: modelOf(c), voice_settings: voiceSettings(c) }) }, 3, true);
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, body);
  return { ok: true, file: out, bytes: body.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  (async () => {
    try {
      let out;
      if (cmd === 'check') out = await cmdCheck();
      else if (cmd === 'clone') out = await cmdClone(args[0], args.slice(1));
      else if (cmd === 'tts') out = await cmdTts(args[0], args[1]);
      else if (cmd === 'sample') out = await cmdSample(args[0], args[1], args[2]);
      else throw new UserError('Usage: check | clone "<name>" <files...> | tts <lines.json> <out_dir> | sample <voiceId> <out.mp3> ["text"]');
      process.stdout.write(JSON.stringify(out) + '\n'); process.exitCode = out.ok ? 0 : 1;
    } catch (e) { process.stdout.write(JSON.stringify({ ok: false, error: e.message }) + '\n'); process.exitCode = 1; }
  })();
}
