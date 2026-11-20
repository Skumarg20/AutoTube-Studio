// Checks the Gemini setup without spending: signs in and asks whether the image and video models answer.
// usage: node tools/gemini_check.js
import '../lib/env.js';
import { geminiStatus } from '../lib/gemini.js';

const s = await geminiStatus();
console.log(JSON.stringify(s, null, 1));
process.exit(s.ok ? 0 : 1);
