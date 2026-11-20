// node tools/test_build.js <plan.json> short|long <jobid>: runs the full v2 production pipeline on a plan (no server needed)
import fs from 'fs';
import { buildVideoV2 } from '../lib/v2/build.js';
const [planFile, format = 'short', id = '_e2e_' + format] = process.argv.slice(2);
const job = { id, format, script: JSON.parse(fs.readFileSync(planFile, 'utf8')) };
const t0 = Date.now();
const files = await buildVideoV2(job, m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`));
console.log(JSON.stringify(files, null, 1), '\ntotal minutes', ((Date.now() - t0) / 60000).toFixed(1));
