// YouTube thumbnail (1280x720): best photo + big 2-4 word headline + red circle/arrow on the subject + channel badge.
import fs from 'fs'; import path from 'path';
import { ROOT, settings } from '../store.js';
import { run } from '../pipeline.js';

export async function makeThumbnail({ dir, plan, TL, channel, text: forced, log = () => {} }) {
  const tdir = path.join(dir, 'thumbpage'), imgDir = path.join(dir, 'img'); fs.mkdirSync(tdir, { recursive: true });
  for (const f of ['index.html', 'thumb.js']) fs.copyFileSync(path.join(ROOT, 'engine', 'thumb', f), path.join(tdir, f));
  fs.copyFileSync(path.join(ROOT, 'engine', 'fonts.css'), path.join(tdir, 'fonts.css')); fs.cpSync(path.join(ROOT, 'engine', 'fonts'), path.join(tdir, 'fonts'), { recursive: true });
  const has = id => id && fs.existsSync(path.join(imgDir, id + '.jpg'));
  const shots = (TL && TL.shots) || [];
  const pick = [plan.thumbImg, ...shots.filter(s => s.type === 'headline' && s.img).map(s => s.img), ...shots.filter(s => s.img).map(s => s.img), ...(plan.images || []).map(i => i.id)].find(has);
  if (pick) fs.copyFileSync(path.join(imgDir, pick + '.jpg'), path.join(tdir, 'bg.jpg'));
  const text = forced || plan.thumbText || String(plan.title || '').split(/[:\-–—?!]/)[0].split(/\s+/).slice(0, 4).join(' ');
  fs.writeFileSync(path.join(tdir, 'thumbspec.js'), 'window.THUMB=' + JSON.stringify({ img: pick ? 'bg.jpg' : '', focus: ((plan.focus || TL?.focus || {})[pick]) || [.5, .4], text, channel }) + ';');
  for (const f of fs.readdirSync(tdir)) if (f.startsWith('yt_')) fs.rmSync(path.join(tdir, f));
  await run('node', ['core/render/still.mjs', tdir, '0', '--size', '1280x720', '--out', tdir, '--prefix', 'yt_'], { cwd: settings().libraryPath });
  const yt = fs.readdirSync(tdir).find(f => f.startsWith('yt_')); if (!yt) throw new Error('thumbnail render produced no image');
  fs.copyFileSync(path.join(tdir, yt), path.join(dir, 'thumb.jpg')); log('thumbnail: "' + text + '"'); return { text, img: pick };
}
