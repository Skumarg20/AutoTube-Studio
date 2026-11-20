// Server side of the ElevenLabs voice: key, cloning from the user's own recording, samples, defaults.
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { ROOT } from './store.js';

const CFG = path.join(ROOT, 'config', 'elevenlabs.json');
const TOOL = path.join(ROOT, 'tools', 'eleven.js');
const EXTRACTED = path.join(ROOT, 'data', 'voice_src', 'voice_for_clone.mp3');
export const SAMPLES = path.join(ROOT, 'data', 'eleven_samples');
const rd = () => { let c = {}; try { c = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch {} if (process.env.ELEVENLABS_API_KEY) c.apiKey = process.env.ELEVENLABS_API_KEY; return c; };   // config/.env key wins
const wr = c => { fs.mkdirSync(path.dirname(CFG), { recursive: true }); fs.writeFileSync(CFG, JSON.stringify(c, null, 2)); };

function tool(args) {
  return new Promise(resolve => {
    const p = spawn('node', [TOOL, ...args], { cwd: ROOT, windowsHide: true }); let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', () => { try { resolve(JSON.parse(out.trim().split(/\r?\n/).pop())); } catch { resolve({ ok: false, error: (err || out || 'no output').slice(-400) }); } });
  });
}
const ff = args => new Promise((ok, bad) => { const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true }); let e = ''; p.stderr.on('data', d => e += d); p.on('close', c => c ? bad(new Error('ffmpeg: ' + e.slice(-300))) : ok()); });

// what the dashboard needs (never the key itself)
export function info() {
  const c = rd();
  return { hasKey: !!c.apiKey, keyTail: c.apiKey ? '…' + c.apiKey.slice(-4) : null, voices: c.voices || [], defaultVoice: c.defaultVoice || null,
    speed: c.speed ?? 1, stability: c.stability ?? 0.5, similarity: c.similarity ?? 0.85, style: c.style ?? 0.15, model: c.model || 'eleven_multilingual_v2',
    extractedReady: fs.existsSync(EXTRACTED), lastCheck: c.lastCheck || null };
}
export const voiceOptions = () => (rd().voices || []).map(v => ({ value: 'eleven:' + v.id, label: v.name + ' (ElevenLabs)' }));

export function saveKey(apiKey) {
  apiKey = String(apiKey || '').trim(); if (!/^sk_[a-f0-9]{20,}$/i.test(apiKey)) throw new Error('That does not look like an ElevenLabs key (it starts with sk_).');
  const c = rd(); c.apiKey = apiKey; delete c.lastCheck; wr(c); return info();
}
export function saveSettings(b) {
  const c = rd(), num = (v, lo, hi) => Math.min(hi, Math.max(lo, +v));
  if (b.speed != null) c.speed = num(b.speed, 0.7, 1.2); if (b.stability != null) c.stability = num(b.stability, 0, 1);
  if (b.similarity != null) c.similarity = num(b.similarity, 0, 1); if (b.style != null) c.style = num(b.style, 0, 1);
  if (b.model) c.model = String(b.model); if (b.defaultVoice) c.defaultVoice = String(b.defaultVoice); wr(c); return info();
}
export async function check() { const r = await tool(['check']); const c = rd(); c.lastCheck = { ...r, at: Date.now() }; wr(c); return r; }

// clone from the recording already extracted from the user's video, or from an uploaded file
export async function cloneExtracted(name) {
  if (!fs.existsSync(EXTRACTED)) throw new Error('No extracted recording found. Upload a recording instead.');
  const r = await tool(['clone', name || 'My narrator voice', EXTRACTED]); if (!r.ok) throw new Error(r.error); return r;
}
export async function cloneUpload(req, name, filename) {
  const dir = path.join(ROOT, 'data', 'voice_uploads'); fs.mkdirSync(dir, { recursive: true });
  const ext = (path.extname(filename || '') || '.bin').toLowerCase().replace(/[^.a-z0-9]/g, ''), src = path.join(dir, 'upload_' + Date.now() + ext);
  const ws = fs.createWriteStream(src); req.pipe(ws); await new Promise((ok, bad) => { ws.on('finish', ok); ws.on('error', bad); });
  // ElevenLabs wants a few minutes of clean speech under ~11 MB: mono mp3, at most 5 minutes, any input format (video too)
  const mp3 = src.replace(/\.[^.]+$/, '') + '_clone.mp3';
  await ff(['-i', src, '-vn', '-t', '300', '-ac', '1', '-ar', '44100', '-af', 'highpass=f=70,loudnorm=I=-16:TP=-1.5', '-c:a', 'libmp3lame', '-b:a', '192k', mp3]);
  const r = await tool(['clone', name || 'My narrator voice', mp3]); if (!r.ok) throw new Error(r.error); return r;
}
export async function sample(voiceId) {
  if (!/^[A-Za-z0-9]{8,40}$/.test(voiceId || '')) throw new Error('bad voice id');
  const out = path.join(SAMPLES, voiceId + '.mp3'); const r = await tool(['sample', voiceId, out]); if (!r.ok) throw new Error(r.error);
  return { ok: true, url: '/eleven-sample/' + voiceId + '.mp3?' + Date.now() };
}
export function removeVoice(voiceId) { const c = rd(); c.voices = (c.voices || []).filter(v => v.id !== voiceId); if (c.defaultVoice === voiceId) c.defaultVoice = c.voices[0]?.id || null; wr(c); return info(); }
export function addVoiceId(voiceId, name) { // a voice already made on the ElevenLabs website
  if (!/^[A-Za-z0-9]{8,40}$/.test(voiceId || '')) throw new Error('Paste the Voice ID from ElevenLabs (letters and numbers).');
  const c = rd(); c.voices = (c.voices || []).filter(v => v.id !== voiceId); c.voices.push({ id: voiceId, name: name || 'My ElevenLabs voice', createdAt: new Date().toISOString() });
  if (!c.defaultVoice) c.defaultVoice = voiceId; wr(c); return info();
}
