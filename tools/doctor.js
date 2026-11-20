// Pre-flight check for a machine that runs AutoTube Studio (run it on the VM before going live, and after any change):
//   node tools/doctor.js
// Prints PASS / WARN / FAIL for every thing the studio needs. Never prints secrets.
process.noDeprecation = true;
import '../lib/env.js';
import fs from 'fs'; import path from 'path'; import os from 'os'; import { execFileSync } from 'child_process';
import { ROOT, settings } from '../lib/store.js';
import { freeGB, loginOn } from '../lib/ops.js';

const WIN = process.platform === 'win32';
let fails = 0, warns = 0;
const out = (k, name, msg) => { if (k === 'FAIL') fails++; if (k === 'WARN') warns++; console.log(`${k.padEnd(4)}  ${name}${msg ? ' - ' + msg : ''}`); };
const run = (cmd, args, opt = {}) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, shell: WIN && !/[\\/]/.test(cmd), windowsHide: true, ...opt }).trim(); } catch (e) { return null; } };
const exists = p => { try { return fs.existsSync(p); } catch { return false; } };
const S = settings(), LIB = S.libraryPath;

console.log(`AutoTube Studio doctor - ${os.hostname()} - ${new Date().toString()}\n`);

// --- software ---
const nodeMajor = +process.versions.node.split('.')[0];
nodeMajor >= 20 ? out('PASS', 'Node.js', process.version) : out('FAIL', 'Node.js', `${process.version}: install Node 20 or newer`);
for (const t of ['ffmpeg', 'ffprobe']) { const v = run(t, ['-version']); v ? out('PASS', t, v.split('\n')[0].slice(0, 60)) : out('FAIL', t, 'not found on PATH: install ffmpeg and add its bin folder to PATH'); }
if (WIN) { const b = 'C:\\Program Files\\Git\\bin\\bash.exe'; exists(b) ? out('PASS', 'Git Bash', b) : out('FAIL', 'Git Bash', `missing ${b}: install Git for Windows (the sound mix uses it)`); }
const cv = run('claude', ['--version']);
cv ? out('PASS', 'Claude Code CLI', cv) : out('FAIL', 'Claude Code CLI', 'not found: install Claude Code, then run "claude" once and sign in');
const cred = path.join(os.homedir(), '.claude', '.credentials.json');
if (process.env.ANTHROPIC_API_KEY) out('WARN', 'Claude sign-in', 'ANTHROPIC_API_KEY is set: Claude calls will be billed to that API key, not your subscription');
else exists(cred) ? out('PASS', 'Claude sign-in', 'signed in for user ' + os.userInfo().username) : out('FAIL', 'Claude sign-in', `no login for user ${os.userInfo().username}: run "claude" in a terminal as THIS user and sign in (the studio must run as the same Windows user)`);

// --- render library ---
if (!LIB || !exists(LIB)) out('FAIL', 'Lemo Opuscar library', `not found at "${LIB}": copy it to the VM and set "libraryPath" in config/settings.json (or the HS_LIBRARY variable)`);
else {
  out('PASS', 'Lemo Opuscar library', LIB);
  exists(path.join(LIB, 'core', 'render', 'video.mjs')) ? out('PASS', 'renderer', 'core/render/video.mjs') : out('FAIL', 'renderer', 'core/render/video.mjs missing: the library copy is incomplete');
  exists(path.join(LIB, 'node_modules', 'playwright-core')) ? out('PASS', 'library packages', 'node_modules present') : out('FAIL', 'library packages', `run "npm install" inside ${LIB}`);
  const pw = process.env.PLAYWRIGHT_CHROME || (() => { const d = process.env.PLAYWRIGHT_BROWSERS_PATH || (WIN ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright') : path.join(os.homedir(), '.cache', 'ms-playwright')); try { return fs.readdirSync(d).some(n => /^chromium/.test(n)) ? d : null; } catch { return null; } })();
  pw ? out('PASS', 'render browser', pw) : out('FAIL', 'render browser', `no Chromium for Playwright: in ${LIB} run "npx playwright install chromium"`);
  const py = path.join(LIB, '.venv', WIN ? 'Scripts/python.exe' : 'bin/python');
  const pv = exists(py) && run(py, ['-c', 'import sys, numpy; print(sys.version.split()[0])']);
  pv ? out('PASS', 'library Python (.venv)', 'Python ' + pv) : out('FAIL', 'library Python (.venv)', `missing or broken (a .venv copied from another PC does not work). In ${LIB}: delete .venv, install Python 3.12, then create it again and pip install -r requirements.txt -r requirements-voice.txt -r requirements-music.txt`);
}
exists(path.join(ROOT, 'node_modules')) ? out('PASS', 'studio packages', 'node_modules present') : out('FAIL', 'studio packages', `run "npm install" in ${ROOT}`);

// --- accounts and keys (only checks they exist) ---
const cfg = f => path.join(ROOT, 'config', f);
try { const k = JSON.parse(fs.readFileSync(cfg('elevenlabs.json'), 'utf8')); (k.apiKey || k.key) ? out('PASS', 'ElevenLabs key', 'present') : out('WARN', 'ElevenLabs key', 'file has no key: add it in the dashboard (Settings > Voice)'); } catch { (process.env.ELEVENLABS_API_KEY ? out('PASS', 'ElevenLabs key', 'from config/.env') : out('PASS', 'ElevenLabs key', 'none (optional): the free built-in English voices are used; add a key for Hindi/Hinglish or your own cloned voice')); }
exists(cfg('youtube_client.json')) ? out('PASS', 'YouTube app', 'config/youtube_client.json') : out('WARN', 'YouTube app', 'not set up yet: videos are made and can be downloaded; for automatic uploads follow Settings > Connections');
{ const tok = [...(exists(path.join(ROOT, 'data', 'youtube_token.json')) ? [['studio', path.join(ROOT, 'data', 'youtube_token.json')]] : []), ...(exists(path.join(ROOT, 'channels')) ? fs.readdirSync(path.join(ROOT, 'channels')).map(c => ['channel ' + c, path.join(ROOT, 'channels', c, 'data', 'youtube_token.json')]) : [])];
  for (const [n, f] of tok) exists(f) ? out('PASS', 'YouTube sign-in', n) : out('WARN', 'YouTube sign-in', `${n}: none. Connect it from the dashboard on THIS computer (Google returns to 127.0.0.1)`); }

// --- this machine ---
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
out('PASS', 'time zone', `${tz} (publish times in the dashboard are read in this zone)`);
const g = freeGB(); g === null ? out('WARN', 'disk space', 'could not read') : g >= 40 ? out('PASS', 'disk space', g + ' GB free') : out(g >= 15 ? 'WARN' : 'FAIL', 'disk space', `${g} GB free: each long video needs ~1 GB (work files are cleaned 3 days after publishing)`);
const cpus = os.cpus().length, ram = Math.round(os.totalmem() / 1e9);
cpus >= 8 && ram >= 16 ? out('PASS', 'CPU / RAM', `${cpus} cores, ${ram} GB`) : out('WARN', 'CPU / RAM', `${cpus} cores, ${ram} GB: 8+ cores and 16+ GB recommended; with less, set renderSlots to 1 or 2 in config/settings.json`);
if (WIN) {
  const q = run('powercfg', ['/query', 'SCHEME_CURRENT', 'SUB_SLEEP', 'STANDBYIDLE']);
  const ac = q && /Current AC Power Setting Index:\s*0x([0-9a-f]+)/i.exec(q);
  !ac ? out('WARN', 'sleep', 'could not read the power plan: make sure the VM never sleeps') : parseInt(ac[1], 16) === 0 ? out('PASS', 'sleep', 'never sleeps') : out('WARN', 'sleep', `the VM sleeps after ${parseInt(ac[1], 16) / 60} min: run "powercfg /change standby-timeout-ac 0" as admin`);
  run('schtasks', ['/query', '/tn', 'AutoTubeStudio']) ? out('PASS', 'auto-start', 'scheduled task AutoTubeStudio exists') : out('WARN', 'auto-start', 'not installed: run deploy\\install-autostart.ps1 (starts the studio with Windows and restarts it if it stops)');
}

// --- settings ---
S.workerToken ? out('PASS', 'worker token', 'set') : out('WARN', 'worker token', 'not set yet (made on first start)');
loginOn() ? out('PASS', 'dashboard login', 'password set: other devices must sign in') : out('PASS', 'dashboard login', 'no password: the dashboard opens only on the VM itself (run tools/set-password.js to use it from your laptop/phone)');
try { const r = await fetch(`http://127.0.0.1:${+process.env.PORT || 4747}/healthz`, { signal: AbortSignal.timeout(3000) }); const h = await r.json(); out('PASS', 'studio running', `up ${h.uptimeMin} min${h.claudeLimitUntil ? ', waiting for Claude limit reset at ' + h.claudeLimitUntil : ''}`); }
catch { out('WARN', 'studio running', 'not running right now (start it, or install auto-start)'); }

console.log(`\n${fails} FAIL, ${warns} WARN.  ${fails ? 'Fix every FAIL before going live.' : 'Ready.'}`);
console.log('Reminder: run one studio per set of channels. Two computers running the same channels would make and upload every video twice (a second PC can help as a render worker: Settings > Workers).');
process.exit(fails ? 1 : 0);
