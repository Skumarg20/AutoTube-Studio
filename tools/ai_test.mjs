// node tools/ai_test.mjs <jobdir> <style-slug>: runs only the AI-build step on a folder (for testing)
import path from 'path';
import { settings } from '../lib/store.mjs';
import { aiBuildPrompt } from '../lib/pipeline.mjs';
import { askClaude } from '../lib/claude.mjs';
import { styleOf } from '../lib/styles.mjs';
const [dir, slug] = [path.resolve(process.argv[2]), process.argv[3]];
const spec = (await import('fs')).readFileSync(path.join(dir, 'spec.js'), 'utf8'); const dur = JSON.parse(spec.replace(/^window\.SPEC=/, '').replace(/;\s*$/, '')).dur;
const t0 = Date.now();
const r = await askClaude(aiBuildPrompt({ dir, lib: settings().libraryPath, slug, name: styleOf(slug).name, size: '1080x1920', dur }), { cwd: dir, timeoutMs: 75 * 60e3, extraArgs: ['--allowedTools', 'Read,Write,Edit,Glob,Grep,Bash', '--add-dir', settings().libraryPath, '--permission-mode', 'acceptEdits'] });
console.log('minutes', ((Date.now() - t0) / 60e3).toFixed(1)); console.log(r.slice(-600));
