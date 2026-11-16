// Tiny JSON-file database: data/db.json (jobs, themes) and config/settings.json.
import fs from 'fs'; import path from 'path'; import os from 'os'; import { fileURLToPath } from 'url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = path.join(ROOT, 'data', 'db.json'), SET = path.join(ROOT, 'config', 'settings.json');

const DEFAULT_SETTINGS = {
  channelName: 'My channel',
  libraryPath: path.join(os.homedir(), 'lemo-opuscar-src', 'lemo-opuscar-main'),
  claudeModel: '',            // empty = Claude Code's default model
  voice: 'bf_emma', voiceSpeed: 0.97,
  longMinutes: 8,
  dailyRunTime: '06:00',      // when the day's 6 jobs are created and scripts written
  publishTimes: { long1: '18:00', long2: '20:00', short1: '09:00', short2: '12:00', short3: '15:00', short4: '21:00' },
  activeTheme: 'History of Everyday Things',
  autoDaily: false,          // old single-channel mode; channels (lib/flows.mjs) have their own on/off
  autoRenderOnApprove: true,
  youtube: true, instagram: true,
  youtubePrivacy: 'public',
  burnCaptions: true, fps: 24, renderWorkers: 5,
  engine: 'v2', fps2: 30, claudePicksImages: true,
};
const DEFAULT_THEMES = [
  { name: 'History of Everyday Things', pack: 'investigation', topics: ['How chai conquered India', 'How salt built empires', 'The story of sugar', 'Why we use forks', 'The history of the bicycle'] },
  { name: 'Lost Cities', pack: 'mystery', topics: ['Dholavira: the Harappan city of water', 'Hampi: the fall of Vijayanagara', 'Petra: the rose-red city'] },
  { name: 'Trade Routes That Changed the World', pack: 'worlddesk', topics: ['The Silk Road', 'The spice route to Kerala', 'The Grand Trunk Road'] },
  { name: 'Rivers of India', pack: 'worlddesk', topics: ['The Ganga: a river and a civilisation', 'The lost Saraswati river debate', 'The Brahmaputra'] },
  { name: 'Why Is This Country Shaped Like This?', pack: 'classroom', topics: ['Why Chile is so long and thin', 'Why India has the Chicken\'s Neck', 'Why Gambia sits inside Senegal'] },
];

function readJSON(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } }
function writeJSON(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); const tmp = p + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(v, null, 1)); fs.renameSync(tmp, p); }

let _set = null, _db = null;
export function settings() { if (!_set) { _set = { ...DEFAULT_SETTINGS, ...readJSON(SET, {}) }; _set.publishTimes = { ...DEFAULT_SETTINGS.publishTimes, ..._set.publishTimes }; if (process.env.HS_LIBRARY) _set.libraryPath = process.env.HS_LIBRARY; if (process.env.CLAUDE_MODEL) _set.claudeModel = process.env.CLAUDE_MODEL; } return _set; }
export function reloadSettings() { _set = null; }   // worker processes re-read settings before each video
export function saveSettings(patch) { _set = { ...settings(), ...patch }; writeJSON(SET, _set); return _set; }
export function db() { if (!_db) _db = readJSON(DB, null) || { jobs: [], themes: DEFAULT_THEMES, usedTopics: [] }; return _db; }
export function save() { writeJSON(DB, db()); }
export const job = id => db().jobs.find(j => j.id === id);
export function newId(date, slot) { return `${date}_${slot}_${Math.random().toString(36).slice(2, 6)}`; }
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
