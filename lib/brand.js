// A channel's brand kit (logo, app screenshots, icons) from the company's content drive, offered to the planner as ready images.
// The flow names a folder with "brandKit" (relative to the studio root). That folder holds brand.json:
//   [{"file": "Logos/MargBooks New Logo.png", "desc": "what it shows (for the planner)", "role": "logo" | "screen" | "icon"}]
// Items are copied into the job as media b01, b02... (kind image) so scenes can use them in "img" like the creator's own photos.
import fs from 'fs'; import path from 'path';
import { ROOT } from './store.js';

export function kitOf(fl) {
  if (!fl || !fl.brandKit) return [];
  const dir = path.resolve(ROOT, fl.brandKit);
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8')).filter(x => x.file && fs.existsSync(path.join(dir, x.file))).map(x => ({ ...x, abs: path.join(dir, x.file) })); }
  catch { return []; }
}

// copy the kit into the job (once) and return the brand media for the prompt
export function attachBrand(j, fl) {
  const kit = kitOf(fl); if (!kit.length) return [];
  j.media = (j.media || []).filter(m => !m.brand);   // refresh: the kit may have changed since the last plan
  const mdir = path.join(ROOT, 'jobs', j.id, 'media'); fs.mkdirSync(mdir, { recursive: true });
  const out = kit.map((x, i) => {
    const id = 'b' + String(i + 1).padStart(2, '0'), ext = path.extname(x.file).toLowerCase(), file = 'media/' + id + ext;
    try { fs.copyFileSync(x.abs, path.join(ROOT, 'jobs', j.id, file)); } catch { return null; }
    return { id, file, kind: 'image', name: path.basename(x.file), dur: 0, desc: `${(x.role || 'image').toUpperCase()}: ${x.desc}` + (x.regions ? ` | zoom targets: ${Object.keys(x.regions).join(', ')}` : ''), brand: true, ...(x.regions ? { regions: x.regions } : {}) };
  }).filter(Boolean);
  j.media.push(...out);
  return out;
}
