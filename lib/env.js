// Optional settings from config/.env (KEY=value per line, # comments). Real environment variables win.
// Import this first in every entry point (server.js, worker.js, tools/doctor.js). See config/.env.example.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const F = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', '.env');
try {
  for (const raw of fs.readFileSync(F, 'utf8').split(/\r?\n/)) {
    const l = raw.trim(); if (!l || l.startsWith('#')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l); if (!m) continue;
    let v = m[2].trim(); if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    if (v !== '' && process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}
