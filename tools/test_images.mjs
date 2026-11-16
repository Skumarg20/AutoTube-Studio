// Live test of lib/images.mjs against Wikimedia Commons.
// Usage: node tools/test_images.mjs [outDir]
import path from 'path';
import fs from 'fs';
import { findImages } from '../lib/images.mjs';

const outDir = process.argv[2] || 'C:/Users/SANJEE~1/AppData/Local/Temp/claude/2edfb6718269f857/451abeaf-c4b2-4e19-95b3-904987e286cc/scratchpad/imgtest';

const requests = [
  { id: 'img01', want: 'Gandhi walking during the Salt March of 1930', queries: ['Salt March 1930 Gandhi', 'Gandhi Dandi march'], historical: true },
  { id: 'img02', want: 'old photograph of the Taj Mahal', queries: ['Taj Mahal 19th century photograph', 'Taj Mahal old photo'], historical: true },
  { id: 'img03', want: 'Roman legionaries carved in a stone relief', queries: ['Roman legionaries relief', 'Trajan column legionaries'], historical: true },
  { id: 'img04', want: 'historical photo of a tea plantation in Assam', queries: ['Assam tea plantation historical', 'tea garden Assam 19th century'], historical: true },
  { id: 'img05', want: 'painting of a Silk Road camel caravan', queries: ['Silk Road caravan painting', 'camel caravan painting'], historical: true },
  { id: 'img06', want: 'old photograph of the Great Wall of China', queries: ['Great Wall of China old photo', 'Great Wall of China 1907'], historical: true },
];

const ALLOWED = /public domain|^pd|cc0|^cc by(-sa)? [0-9.]+|^cc by(-sa)?$|^cc-by/i;
const BAD = /\bnc\b|\bnd\b|non-?commercial|no-?deriv|fair use|non-free|gfdl/i;

const t0 = Date.now();
const results = await findImages(requests, outDir, { log: m => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`) });
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const credits = JSON.parse(fs.readFileSync(path.join(outDir, 'credits.json'), 'utf8'));
let fail = 0;
console.log('\n--- results ---');
for (const r of results) {
  if (!r.ok) { console.log(`${r.id}: FAIL ${r.error}`); continue; }
  const c = r.credit;
  const lic = ALLOWED.test(c.license) && !BAD.test(c.license);
  if (!lic) fail++;
  const exists = fs.existsSync(path.join(outDir, c.file));
  const sizeOk = Math.max(c.width, c.height) <= 2400;
  if (!exists || !sizeOk) fail++;
  console.log(`${r.id}: ${lic ? 'OK ' : 'BAD LICENCE '} ${c.license} | ${c.width}x${c.height} | ${c.title}\n       by ${c.author}`);
}
const titles = credits.map(c => c.title);
if (new Set(titles).size !== titles.length) { console.log('DUPLICATE file used'); fail++; }
console.log(`\n${results.filter(r => r.ok).length}/${results.length} found in ${secs}s; credits.json has ${credits.length} entries; ${fail ? fail + ' check failures' : 'all checks passed'}`);
process.exit(fail ? 1 : 0);
