// The 66 visual styles from the lemo-opuscar library.
// FAST styles have a built-in template preset (any length, minutes to build).
// All other styles are AI-BUILT: Claude Code designs a custom film page in that style for each video (Shorts only, slow).
import fs from 'fs'; import path from 'path'; import os from 'os';
import { settings } from './store.mjs';

export const PRESETS = {
  'archive-lighttable': 'paper', 'engraving': 'paper',
  'chalkboard': 'chalkboard', 'whiteboard': 'chalkboard',
  'blueprint': 'blueprint', 'teardown': 'blueprint',
  'newsreel': 'newsreel', 'silent-film': 'newsreel', 'kino-montage': 'newsreel',
  'hologram-hud': 'hologram', 'ascii-crt': 'hologram', 'satellite-briefing': 'hologram',
  'risograph': 'risograph', 'silkscreen-poster': 'risograph', 'halftone-dossier': 'risograph',
  'dark-keynote': 'keynote', 'swiss-motion': 'keynote', 'spy-titles': 'keynote',
  'ink-wash': 'inkwash', 'ukiyoe': 'inkwash',
};
// the "home" slug of each preset (the one whose name the template look is designed after)
export const PRESET_HOME = { paper: 'archive-lighttable', chalkboard: 'chalkboard', blueprint: 'blueprint', newsreel: 'newsreel', hologram: 'hologram-hud', risograph: 'risograph', keynote: 'dark-keynote', inkwash: 'ink-wash' };

let cache = null;
export function listStyles() {
  if (cache) return cache;
  const dir = path.join(settings().libraryPath, 'styles');
  const prevDir = settings().previewDir || path.join(os.homedir(), 'Downloads', 'all-styles-videos');
  cache = fs.readdirSync(dir).filter(n => !n.startsWith('_') && fs.existsSync(path.join(dir, n, 'style.json'))).map(slug => {
    let j = {}; try { j = JSON.parse(fs.readFileSync(path.join(dir, slug, 'style.json'), 'utf8')); } catch {}
    const preview = fs.existsSync(path.join(prevDir, slug + '.mp4')) ? path.join(prevDir, slug + '.mp4') : null;
    return {
      slug, name: j.en || slug, category: j.category_en || 'Other', line: j.line || '', uses: j.uses || [],
      preset: PRESETS[slug] || null, mode: PRESETS[slug] ? 'fast' : 'ai',
      hasPreview: !!preview, previewPath: preview, posterPath: fs.existsSync(path.join(dir, slug, 'poster.jpg')) ? path.join(dir, slug, 'poster.jpg') : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}
export const styleOf = slug => listStyles().find(s => s.slug === slug);
