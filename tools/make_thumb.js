// node tools/make_thumb.js <jobId> ["HEADLINE TEXT"]: (re)make the YouTube thumbnail of a finished v2 video
import fs from 'fs'; import path from 'path';
import { ROOT, db, settings } from '../lib/store.js';
import { makeThumbnail } from '../lib/v2/thumb.js';
const [id, text] = process.argv.slice(2), j = db().jobs.find(x => x.id === id); if (!j || !j.script) { console.error('no such v2 job'); process.exit(1); }
const dir = path.join(ROOT, 'jobs', id); let TL = null; try { TL = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.js'), 'utf8').replace(/^window\.TL=/, '').replace(/;\s*$/, '')); } catch {}
console.log(await makeThumbnail({ dir, plan: j.script, TL, channel: j.channelName || settings().channelName, text, log: console.log }));
