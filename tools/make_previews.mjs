// Renders a preview still of every fast template style into dashboard/previews/<preset>_{h,v}.jpg
// node tools/make_previews.mjs
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
import { ROOT, settings } from '../lib/store.mjs';
import { PRESETS } from '../lib/styles.mjs';
const LIB = settings().libraryPath, tmp = path.join(ROOT, 'jobs', '_preview'), out = path.join(ROOT, 'dashboard', 'previews');
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'film.js', 'fonts.css']) { fs.mkdirSync(tmp, { recursive: true }); fs.copyFileSync(path.join(ROOT, 'template', f), path.join(tmp, f)); }
fs.cpSync(path.join(ROOT, 'template', 'fonts'), path.join(tmp, 'fonts'), { recursive: true });
for (const preset of [...new Set(Object.values(PRESETS))]) {
  const spec = { dur: 10, style: preset, series: 'History of Everyday Things', channel: settings().channelName, scenes: [
    { kind: 'date', start: 0, end: 10, big: '1930', heading: 'Gandhi begins the Salt March', sub: '240 miles to Dandi, on foot' }],
    captions: [{ s: 0, e: 10, text: 'In nineteen thirty, Gandhi walked to the sea.' }] };
  fs.writeFileSync(path.join(tmp, 'spec.js'), 'window.SPEC=' + JSON.stringify(spec));
  for (const [k, size] of [['h', '1920x1080'], ['v', '1080x1920']]) {
    execFileSync('node', ['core/render/still.mjs', tmp, '4', '--size', size, '--out', tmp, '--prefix', `${preset}_${k}_`], { cwd: LIB, stdio: 'ignore' });
    const f = fs.readdirSync(tmp).find(n => n.startsWith(`${preset}_${k}_`));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(tmp, f), '-vf', k === 'h' ? 'scale=640:-1' : 'scale=360:-1', path.join(out, `${preset}_${k}.jpg`)]);
    fs.rmSync(path.join(tmp, f));
  }
  console.log('preview', preset);
}
fs.rmSync(tmp, { recursive: true, force: true });
