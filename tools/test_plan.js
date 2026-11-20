// node tools/test_plan.js short|long "topic" [pack]
import fs from 'fs';
import { askClaude, extractJSON } from '../lib/claude.js';
import { planPrompt, normalizePlan } from '../lib/v2/plan.js';
const [format = 'short', topic = 'How a pinch of salt shook the British Empire', pack = 'auto'] = process.argv.slice(2);
const t0 = Date.now();
const reply = await askClaude(planPrompt({ format, theme: 'History of Everyday Things', topic, channel: 'Map & Myth', minutes: +(process.env.MIN || 8), pack }), { timeoutMs: 25 * 60e3 });
const v = normalizePlan(extractJSON(reply), format);
fs.writeFileSync(`data/test_plan_${format}.json`, JSON.stringify(v.plan, null, 1));
console.log('seconds', ((Date.now() - t0) / 1000).toFixed(0), '| est', v.estSeconds, 's | lines', v.lines, '| words', v.words, '| images', v.plan.images.length);
console.log('styles', v.plan.chapters.map(c => c.style).join(' → '));
console.log('errs', v.errs, '\nwarns', v.warns.slice(0, 10));
