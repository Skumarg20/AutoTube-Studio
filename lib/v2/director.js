// Per-video scene direction (the Lemo Opuscar workflow, like films/s-*): for every video, Claude writes THAT video's scenes
// for a theme, using only the theme's own tools and following its STYLE.md, then renders test frames, looks at them and fixes.
// Currently: the "cel-anime-80s" chapters → jobs/<id>/anime_scenes.js. The whiteboard chapters are written live by the
// whiteboard theme's own engine from the plan (notes, formulas, diagrams), so they need no scene code.
import fs from 'fs'; import path from 'path';
import { askClaude } from '../claude.js';
import { WEBGL, STUDIO_THEMES } from './themes.js';
import { PIPELINE } from '../character/cast.js';

const STUDIO_DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', 'studio-themes');
const ALLOWED_IMPORT = /^\/styles\/cel-anime-80s\/demo\/(cel|head80|pal|fx|bg|hands)\.js$/;

// film-directing rules for every directed scene, in our own words (owner 2026-11-15, after checking DirectorSKILL,
// smixs/visual-skills and cinematic-skill; copies kept for reference in vendor/). They apply inside each theme's own grammar.
export const FILM_RULES = `FILM DIRECTING RULES (apply inside the theme's own look and tools):
1. Every shot must change something for the viewer: a new fact, more pressure, or a new feeling. A shot that only repeats the line is wasted; show what the words cannot.
2. One hero per shot: one thing the eye goes to first (biggest, brightest, sharpest, in the middle third). Dim or blur the rest.
3. Block first, then frame: decide what moves, from where to where, and only then place and move the camera so it follows that motion. Every camera move has a reason (reveal, follow, push in for the point).
4. Hits land on the spoken word: a stamp, a number, an impact or a reveal starts on the word it belongs to, not at the start of the line.
5. Keep screen direction: something moving left-to-right keeps moving left-to-right across cuts; characters looking at each other keep their eyelines. Cut between clearly different sizes or angles (never a tiny 'jump' of the same framing).
6. Three real physical details make a place believable (a ticket stub, a dripping tap, a scuffed shoe); choose them for this story.
7. Motion never stops dead: hold moments still breathe (a slow push, drifting dust, a blink, light flicker).
8. Text must be readable on a phone in one second: large, short, high contrast, inside the scene's world.
9. Rhythm: the shot length follows the emotion; fast cuts for tension, a longer hold for the reveal. The final image lands the point of the video.
10. Nothing invented that looks like real evidence: a document drawn in code is clearly a recreation and quotes only real words.`;

// static checks on the written scene file: only the theme's modules, deterministic, no network
export function checkScenes(src) {
  const errs = [];
  for (const m of src.matchAll(/import\s+[^'"]*['"]([^'"]+)['"]/g)) if (!ALLOWED_IMPORT.test(m[1])) errs.push(`import not allowed: ${m[1]} (only the cel-anime-80s theme's own modules)`);
  if (/\bimport\s*\(/.test(src)) errs.push('dynamic import not allowed');
  if (/Math\.random|Date\.now|performance\.now|new Date/.test(src)) errs.push('not deterministic: use the theme rng()/hash() and the time S.t');
  if (/fetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\/(?!www\.w3\.org\/)/.test(src)) errs.push('no internet access: only local files');
  if (!/export\s+default/.test(src)) errs.push('missing export default { a0: S => ..., ... }');
  return errs;
}

export async function directAnime({ dir, TL, plan, lib, size, log, model }) {
  const shots = TL.shots.filter(s => s.type === 'anime');
  const stub = path.join(dir, 'anime_scenes.js');
  if (!shots.length) { fs.writeFileSync(stub, 'export default {};\n'); return { scenes: 0 }; }
  // what each anime shot must show, with its time window and the words spoken during it
  const words = TL.phrases || [];
  const list = shots.map((s, i) => {
    const nx = TL.shots.find(x => x.t > s.t), t1 = nx ? nx.t : TL.dur;
    const said = words.filter(p => p.s < t1 && p.e > s.t).map(p => p.w.map(w => w.w).join(' ')).join(' ');
    return { id: 'a' + i, t0: +s.t.toFixed(2), t1: +t1.toFixed(2), action: s.action || '', expr: s.expr || '', bg: s.bg || 'night', fx: s.fx || '', title: s.text || '', narration: said };
  });
  fs.writeFileSync(path.join(dir, 'anime_shots.json'), JSON.stringify({ format: size, shots: list }, null, 1));
  fs.writeFileSync(stub, 'export default {};\n');   // the page always has a scene file; the director replaces it
  const [W, H] = size.split('x').map(Number), stills = list.flatMap(s => [s.t0 + Math.min(.6, (s.t1 - s.t0) * .2), (s.t0 + s.t1) / 2, s.t1 - .15]).map(x => x.toFixed(2));
  const theme = path.join(lib, 'styles', 'cel-anime-80s'), STILL = lib.split(path.sep).join('/') + '/core/render/still.mjs';
  const prompt = `You are the director and animator of the 80s Cel Anime parts of ONE video for the YouTube channel of an IIT JEE/NEET teacher. Work exactly the way the Lemo Opuscar library makes its films (see the library's films/s-cel-anime-80s for a finished example made this way).

READ FIRST (all of it, before writing):
- ${path.join(theme, 'STYLE.md')}  (the rules of the look: you must follow every section)
- ${path.join(theme, 'DEMO.md')}   (how the demo film was built; do NOT reuse its story, shots, props or timings)
- the theme's tools you may use: ${path.join(theme, 'demo')}\\cel.js, head80.js, pal.js, fx.js, bg.js, hands.js
- how the demo uses them: ${path.join(theme, 'demo')}\\scenes1.js … scenes4.js, shots.js, rider.js (study only; do not import them)
- a finished film made this way: ${path.join(lib, 'films', 's-cel-anime-80s')}\\main.js and plates.js
- this video's anime shots: ${path.join(dir, 'anime_shots.json')} (id, time window t0-t1 in seconds, the ACTION to show, the expression, background mood, effect, and the narration spoken during it)
- the whole plan for context: ${path.join(dir, 'plan.json')}

WRITE: ${stub} — an ES module:
  import { ... } from '/styles/cel-anime-80s/demo/cel.js';   (also head80.js, pal.js, fx.js, bg.js, hands.js — ONLY these, with exactly these absolute paths)
  export default { a0: S => { ... }, a1: S => { ... }, ... }   one function per shot id.
Each function draws ONE frame at time S.t and must depend only on S (deterministic: use the theme's rng(seed)/hash(), never Math.random or clocks).
S gives you: t (video time), lt (time inside the shot), d (shot length), u (0..1 progress), g (picture canvas ctx), e (glow/emissive canvas ctx), W=${W}, H=${H} (${W > H ? 'landscape' : 'portrait 9:16 for a Short: compose vertically, keep faces and action in the middle, nothing important in the bottom 300 px where the subtitles sit'}),
  shot (the plan's shot), celLayer(fn) (draws fn(ctx) as a cel and cuts its silhouette out of the glow layer), mouthAt(t) (the voice's mouth shape for lip-sync: 'closed'|'talk'|'oh'|'smileopen'|null), q8, q12, f12, seg helpers, plates ({night, dusk} painted skyline plates {c, e, w, h}), PAL (palettes), VERT.
The CRT/videotape pass and the subtitles are added for you after your function; do not draw them.
ON-SCREEN WORDS: never put big gradient, chrome, neon or glowing title words over the picture (they look pasted on). If a word or number must be seen, it belongs to the scene's world: written on a paper, board, sign, screen or label inside the picture, in that scene's own colours, light and perspective, and it moves with the camera like everything else.

WHAT TO ANIMATE: for every shot, show its ACTION with real cel animation in this theme's grammar: painted background plates with an emissive pair (only slid), flat two-tone cels with hard shadow/highlight crescents and coloured outlines, the student character (use head80 with ONE consistent design and palette in every shot, plus a body/arms drawn with cel()), the objects of the scene (a bag, a lift, a ball, a phone, a rocket...) drawn as cels with the theme tools, characters on twos (12 fps) and performance on threes (8 fps), light bands moved across held cels, impact frames for hits, speed lines for speed, a camera move from STYLE.md's camera grammar. Lip-sync the character with S.mouthAt(S.t) when the narration runs. The physics shown must be correct (a dropped object speeds up, a falling lift and its rider float together, etc.).
Keep it original: no characters, logos or signature shots from real anime; no titles over the picture (see ON-SCREEN WORDS).
${FILM_RULES}

Do not run any command. After you write the file, the app renders check frames and shows them to you for a review round.
Do not touch any other file. Do not edit the library. When the file is final, reply with one line: DONE <number of shots>.`;
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 1));
  log(`direction: Claude is writing this video's ${list.length} anime scene(s) with the 80s Cel Anime theme's tools, then checking frames`);
  const reply = await askClaude(prompt, { model, cwd: dir, timeoutMs: 45 * 60 * 1000,
    extraArgs: EDIT_TOOLS(lib) });
  const src = fs.existsSync(stub) ? fs.readFileSync(stub, 'utf8') : '';
  const errs = checkScenes(src);
  // any valid way of naming the scenes counts: { a0: S => ... }, { a0(S) {...} }, { "a0": ... } or export default { a0, a1 }
  if (errs.length || !/\ba0\b/.test(src)) {
    if (src) fs.copyFileSync(stub, path.join(dir, 'anime_scenes.rejected.js'));   // kept for checking why
    fs.writeFileSync(stub, 'export default {};\n');
    throw new Error('the scene director did not deliver valid scenes: ' + (errs.join('; ') || String(reply).slice(0, 200)));
  }
  const rv = await reviewRound({ file: stub, dir, lib, size, model, stills, prefix: 'd_', what: 'the anime shots in ' + path.join(dir, 'anime_shots.json') });
  { const e2 = checkScenes(fs.readFileSync(stub, 'utf8')); if (e2.length) throw new Error('anime scenes broke the rules during review: ' + e2.join('; ')); }
  log(`direction: ${list.length} anime scene(s) written, ${rv}`);
  return { scenes: list.length };
}

// ── any directed theme (history channels, and "scene" shots in general): one scenes.js for the whole video ──
export function checkSceneFile(src, slugs) {
  const errs = [], ok = p => p === '/core/lib.js' || ((p === 'three' || p.startsWith('three/addons/')) && slugs.some(s => WEBGL.includes(s))) || slugs.some(s => (p.startsWith(`/styles/${s}/demo/`) || p.startsWith(`./stheme/${s}/`)) && p.endsWith('.js') && !/\/(main|index|test)\.js$/.test(p));
  for (const m of src.matchAll(/import\s+[^'"]*['"]([^'"]+)['"]/g)) if (!ok(m[1])) errs.push(`import not allowed: ${m[1]} (only this video's themes' own demo modules, /core/lib.js, or 'three' for 3D themes)`);
  if (/\bimport\s*\(/.test(src)) errs.push('dynamic import not allowed');
  if (/Math\.random|Date\.now|performance\.now|new Date/.test(src)) errs.push('not deterministic');
  // only real internet access is banned (the library demos themselves use new Image for local files and the SVG namespace URL)
  if (/fetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\/(?!www\.w3\.org\/)/.test(src)) errs.push('no internet access: only local files (the theme folders, the job img/ photos via S.img)');
  if (!/export\s+default/.test(src)) errs.push('missing export default { s0: S => ..., ... }');
  if (!/export\s+const\s+subtitles/.test(src)) errs.push('missing export const subtitles = { "<theme>": (ctx, cue, S) => ... }');
  return errs;
}

const TOOLS = (lib, STILL) => ['--permission-mode', 'acceptEdits', '--add-dir', lib, '--allowedTools', 'Read', 'Write', 'Edit', 'Glob', 'Grep', `Bash(node ${STILL}:*)`, `Bash(node "${STILL}":*)`, `Bash(node ${STILL.split('/').join('\\')}:*)`];

// one director run for a group of shots → scenes_<k>.js; checked, with one repair round
async function directGroup({ k, ids, dir, lib, size, model, log, slugs, reading, STILL, list, noReview = false, brand = [], regions = {}, noPeople = false }) {
  const file = path.join(dir, `scenes_${k}.js`), [W, H] = size.split('x').map(Number);
  const mine = list.filter(s => ids.includes(s.id)), themes = [...new Set(mine.map(s => s.theme))];
  const stills = mine.flatMap(s => [s.t0 + Math.min(.6, (s.t1 - s.t0) * .25), (s.t0 + s.t1) / 2]).map(x => x.toFixed(2));
  fs.writeFileSync(file, 'export default {};\nexport const subtitles = {};\n');
  const cmd = `node ${STILL} "${dir}" ${stills.join(' ')} --size ${size} --q nosubs=1 --out "${path.join(dir, 'out', 'direct')}" --prefix d${k}_`;
  const prompt = `You are the director and animator of part of ONE video. Work exactly the way the Lemo Opuscar library makes its films: every scene is written for this video, in its theme's look, with ONLY that theme's own tools.

READ FIRST, for each theme you animate here:
${reading.filter(r => themes.some(t => r.startsWith(`- "${t}"`))).join('\n')}
The video's shots: ${path.join(dir, 'scene_shots.json')} and the plan: ${path.join(dir, 'plan.json')}. YOU write only these shot ids: ${ids.join(', ')}.

WRITE: ${file} — an ES module.
- Imports ONLY from the themes' own demo modules with absolute paths like '/styles/<theme>/demo/<file>.js' (never main.js/index/test), the studio themes' kits as './stheme/<theme>/<file>.js' (relative), or '/core/lib.js'.${themes.some(t => WEBGL.includes(t)) ? " 3D themes may also import 'three' and 'three/addons/...'." : ''} Nothing else; no effects the theme does not have.${themes.some(t => WEBGL.includes(t)) ? `
- 3D themes (${themes.filter(t => WEBGL.includes(t)).join(', ')}): build the 3D world with three.js the way the theme's demo does, render it into ONE WebGLRenderer per theme created once at module level on an OffscreenCanvas or a detached canvas (preserveDrawingBuffer: true, size W x H), call renderer.render(scene, camera) inside the scene function, then S.g.drawImage(renderer.domElement, 0, 0). Build meshes once and reuse them; only move them per frame. Everything follows S.t (no clocks).` : ''}
- export default { <id>: S => {...}, ... } — one function per id listed above (helpers shared inside the file are fine).
- export const subtitles = { ${themes.map(t => `"${t}": (ctx, cue, S) => {...}`).join(', ')} } — the subtitle text cue.text drawn exactly in that theme's STYLE.md subtitle style, inside the frame${H > W ? ' (portrait: about 260 px above the bottom)' : ''}.
Each scene function draws ONE complete frame at time S.t onto S.g (2D context, W=${W}, H=${H}, ${W > H ? 'landscape' : 'portrait 9:16, important things in the middle'}), depending only on S (deterministic: no Math.random or clocks; use the themes' own rng/hash).
S: t, lt (time in the shot), d (shot length), u (0..1), g, W, H, VERT, shot (the plan shot: action, text, img), img(id) (the plan's archive photo as a loaded image or null), mouthAt(t) (lip-sync shape or null).
Apply each theme's post pass (grain, CRT, print texture, WebGL) the way its demo does, inside your module, so the frame on S.g is final.

ANIMATE each shot's ACTION with real motion in its theme's grammar (camera moves, character/object motion, the theme's transitions and textures), historically accurate, original (no copyrighted characters, logos or signature shots). When shot.text is given, show those words inside the scene (see below), not as a title laid over it.
ON-SCREEN WORDS: never put big gradient, chrome, neon or glowing title words over the picture (they look pasted on). If a word or number must be seen, it belongs to the scene's world: written on a paper, board, sign, screen or label inside the picture, in that scene's own colours, light and perspective, and it moves with the camera like everything else. Real archive photos (S.img) only where the shot has an img.
${FILM_RULES}
${brand.length ? AD_RULES(W, H) : ''}${noPeople ? NO_PEOPLE_RULE : ''}
${mine.some(x => brand.includes(x.img)) ? BRAND_RULES(mine.filter(x => brand.includes(x.img)).map(x => { const r = x.zoom && regions[x.img] && regions[x.img][x.zoom]; return `${x.id}:${x.img}` + (r ? ` ZOOM to "${x.zoom}" = [x ${r[0]}, y ${r[1]}, w ${r[2]}, h ${r[3]}] (fractions of the image)` : ''); }).join('; '), W, H) : ''}
Do not run any command. After you write the file, the app renders check frames and shows them to you for a review round.
Do not touch any other file; never edit the library. Reply: DONE.`;
  void cmd;
  await askClaude(prompt, { model, cwd: dir, timeoutMs: 60 * 60 * 1000, extraArgs: EDIT_TOOLS(lib) });
  // any valid way of naming a scene counts: { s0: S => ... }, { s0(S) {...} }, { "s0": ... } or export default { s0, s1 }
  const missingIn = s => ids.filter(id => !new RegExp('\\b' + id + '["\']?\\s*[:(,}]').test(s));
  let src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '', errs = checkSceneFile(src, slugs);
  if (missingIn(src).length) errs.push('missing scenes: ' + missingIn(src).join(', '));
  if (errs.length && src) {
    log(`direction (part ${k + 1}): fixing ${errs.join('; ')}`); fs.copyFileSync(file, path.join(dir, `scenes_${k}.rejected.js`));
    await askClaude(`The file ${file} breaks these rules of this project: ${errs.join('; ')}. Fix ONLY those problems in place (keep the look). Do not run commands. Reply DONE.`, { model, cwd: dir, timeoutMs: 25 * 60 * 1000, extraArgs: EDIT_TOOLS(lib) });
    src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; errs = checkSceneFile(src, slugs);
    if (missingIn(src).length) errs.push('missing scenes: ' + missingIn(src).join(', '));
  }
  if (errs.length) { if (src) fs.copyFileSync(file, path.join(dir, `scenes_${k}.rejected.js`)); throw new Error(`the scene director did not deliver valid scenes for part ${k + 1}: ${errs.join('; ')}`); }
  // review round: the APP renders the check frames (Claude needs no command permission) and Claude looks at them and fixes
  // fast mode skips the full review, but a brand/ad channel still gets ONE light check: one frame per shot (the zoom hold for
  // screen shots), looking only for the ad problems (small or blurry screens, fake app UI, bad on-screen text)
  const light = noReview && brand.length ? mine.map(s => (s.t0 + (s.t1 - s.t0) * (brand.includes(s.img) ? .85 : .5)).toFixed(2)) : null;
  const rv = noReview && !light ? 'no frame-check round (fast mode)' : await reviewRound({ file, dir, lib, size, model, stills: light || stills, prefix: `d${k}_`, what: `shot ids ${ids.join(', ')} in ${path.join(dir, 'scene_shots.json')}`, prepare: () => mergeParts(dir),
    focus: light ? `This is a product AD; check ONLY these and fix them: (1) every real app screen/logo (S.img brand image) is big (phone >= 55% of the frame height, laptop/tablet/raw screen >= 80% of the width, logo >= 60% of the width), whole, upright and SHARP, and on zoom shots the named field is clearly readable; (2) NO made-up app UI anywhere (drawn dashboards, forms, phones with fake screens, fake buttons/cards that look like the app) - replace it with the shot's real image or with a non-UI picture; (3) on-screen words: fully inside the frame, not cut, not overlapping each other, faces, the screen or the subtitles, short and large. Leave everything else as it is.` : '' });
  src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; errs = checkSceneFile(src, slugs);
  if (errs.length) throw new Error(`part ${k + 1} broke the rules during review: ${errs.join('; ')}`);
  log(`direction (part ${k + 1}): ${ids.length} scene(s) in ${themes.join(', ')}, ${rv}`);
}

// the company's real app screens and logo (brand kit): shown as they are, big and readable, inside any theme
const BRAND_RULES = (pairs, W, H) => `
BRAND IMAGES (shot:image ${pairs}): S.img(id) is the company's REAL app screenshot or logo, already drawn inside its own phone/laptop/tablet mockup on a TRANSPARENT background. They sell the product, so in those shots:
- draw the image whole and upright with ctx.drawImage, keeping its aspect ratio: no tilt, no perspective, no skew, no cropping, no recolouring, never as a small card or a thumbnail;
- BIG: a phone mockup at least 55% of the frame height (${Math.round(H * .55)} px), a laptop/tablet/multi-device mockup at least 80% of the frame width (${Math.round(W * .8)} px), a logo at least 60% of the frame width (${Math.round(W * .6)} px) on a plain light background that keeps it readable;
- centred, in the middle of the frame, never under the subtitles; a short slide/scale-in at the start;
- RAW screens (described as RAW, no device frame): draw them inside a simple clean device frame you draw around them (a monitor or laptop bezel, rounded corners, soft shadow), screen at least 90% of the frame width;
- SHARPNESS: set ctx.imageSmoothingEnabled = true and ctx.imageSmoothingQuality = 'high'; never draw an image larger than 2x its own pixels (on screen width <= 2 x the source width you take from S.img(id).naturalWidth) - a blurry screen is worse than a smaller sharp one;
- ZOOM shots (listed with a ZOOM region): show the whole device for about 0.6 s, then zoom smoothly (about 0.5 s, ease-in-out) until that region fills about 85% of the frame width (but at most 2x its source pixels), centred, and hold it there; draw the zoomed view from the full-resolution image (ctx.drawImage with a source rectangle) so the text stays sharp; then mark the field: a highlight box or ring around it in the theme's accent colour, optionally a cursor that moves to it and clicks (a small press ripple). The words in that field must be readable on a phone screen;
- the theme lives AROUND it (background, frame, a desk, callout rings and arrows, a label in the theme's lettering) but nothing covers the screen itself; callouts may point at a part of it;
- never draw your own fake app screen, blank phone or coloured boxes when a real screenshot is given for the shot.
`;
// every scene of a brand/ad channel (with or without a brand image): no invented product UI, clean readable words
// character videos (lib/character): real actors speak on camera in their own clips; the drawn scenes are voice-only lines
const NO_PEOPLE_RULE = `
NO PEOPLE: these scenes are heard as a voice only (the video's real actors appear in their own clips). Draw NO people, characters, faces, hands or silhouettes: only the app screens, objects, icons, charts, graphics and text.
`;
const AD_RULES = (W, H) => `
AD RULES (this video is an ad for a real software product):
- NEVER draw the product's UI yourself: no drawn dashboards, forms, tables, invoices, app screens, phones or laptops with made-up screens, fake buttons or fake cards that look like the app. The product's UI appears ONLY as the real images given in the shots' "img" (S.img). Shots without an img show the world (people, shop, godown, goods, documents on paper, icons, numbers, the theme's own graphics) but no app UI. A generic message bubble or a bell icon is fine; an imitation of the app is not.
- ON-SCREEN WORDS: at most 4-5 words per label, large (at least ${Math.round(H * .03)} px tall), fully inside the safe area (x ${Math.round(W * .06)}-${Math.round(W * .94)} px, y ${Math.round(H * .08)}-${Math.round(H * .74)} px), never cut by the frame edge, never overlapping another label, a face, a real screen or the subtitle area at the bottom; measure text with ctx.measureText and shrink or wrap it to fit.
`;
const EDIT_TOOLS = lib => ['--permission-mode', 'acceptEdits', '--add-dir', lib, '--allowedTools', 'Read', 'Write', 'Edit', 'Glob', 'Grep'];
// join whatever parts exist into scenes.js so the page can show them (also used for the final merge)
function mergeParts(dir) {
  const parts = fs.readdirSync(dir).filter(f => /^scenes_\d+\.js$/.test(f)).sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7)));
  fs.writeFileSync(path.join(dir, 'scenes.js'), parts.map((f, i) => `import * as p${i} from './${f}';`).join('\n') +
    `\nexport default Object.assign({}, ${parts.map((_, i) => `p${i}.default`).join(', ') || '{}'});\nexport const subtitles = Object.assign({}, ${parts.map((_, i) => `p${i}.subtitles`).join(', ') || '{}'});\n`);
}
// render check frames with the library's still renderer, then one Claude review of those images; returns a short report
async function reviewRound({ file, dir, lib, size, model, stills, prefix, what, prepare, focus = '' }) {
  const { run } = await import('../pipeline.js');
  const out = path.join(dir, 'out', 'direct'); fs.mkdirSync(out, { recursive: true });
  const shoot = async () => {
    for (const f of fs.readdirSync(out)) if (f.startsWith(prefix)) fs.rmSync(path.join(out, f));
    if (prepare) prepare();
    const perr = [];
    try { await run('node', [path.join(lib, 'core', 'render', 'still.mjs'), dir, ...stills, '--size', size, '--q', 'nosubs=1', '--out', out, '--prefix', prefix], { cwd: lib, log: m => { if (/pageerror|Error/.test(m)) perr.push(m.slice(0, 240)); } }); }
    catch (e) { perr.push(String(e.message).slice(0, 400)); }
    return { imgs: fs.readdirSync(out).filter(f => f.startsWith(prefix)).map(f => path.join(out, f)), perr: [...new Set(perr)].slice(0, 8) };
  };
  const a = await shoot();
  if (!a.imgs.length && !a.perr.length) return 'WARNING: no check frames could be rendered';
  await askClaude(`Review round for ${file} (the scenes for ${what}). The app rendered these check frames (the time in seconds is in each file name): ${a.imgs.join(', ')}.
${a.perr.length ? 'Page errors while rendering: ' + a.perr.join(' | ') : 'No page errors.'}
${focus ? focus + ' Open EVERY image. Fix those problems in ' + file + ' (and any page error, blank or black frame).' : `Open EVERY image and compare it with the shot's action and its theme's STYLE.md. Fix every problem in ${file}: errors, blank or black frames, cut-off or unreadable subjects, the action not visible, anything that breaks the theme's look.`} If everything is right, change nothing. Do not run commands; do not touch other files. Reply DONE.`,
    { model, cwd: dir, timeoutMs: 25 * 60 * 1000, extraArgs: EDIT_TOOLS(lib) });
  const b = await shoot();
  return `${focus ? 'ad check' : 'frames checked'} by Claude (${a.imgs.length} frames${a.perr.length ? `, fixed ${a.perr.length} page error(s)` : ''})` + (b.perr.length ? ` — WARNING: still ${b.perr.length} page error(s): ${b.perr[0]}` : '');
}

// ── any directed theme ("scene" shots): written per video, a chapter (or a whole Short) per Claude run, merged into scenes.js ──
export async function directScenes({ dir, TL, plan, lib, size, log, model }) {
  const file = path.join(dir, 'scenes.js');
  for (const f of fs.readdirSync(dir)) if (/^scenes_\d+\.js$/.test(f)) fs.rmSync(path.join(dir, f));
  fs.writeFileSync(file, 'export default {};\nexport const subtitles = {};\n');
  const shots = TL.shots.filter(s => s.type === 'scene');
  if (!shots.length) return { scenes: 0 };
  const words = TL.phrases || [];
  const list = shots.map((s, i) => {
    const nx = TL.shots.find(x => x.t > s.t), t1 = nx ? nx.t : TL.dur;
    const said = words.filter(p => p.s < t1 && p.e > s.t).map(p => p.w.map(w => w.w).join(' ')).join(' ');
    return { id: 's' + i, ch: s.ch, theme: s.style, t0: +s.t.toFixed(2), t1: +t1.toFixed(2), action: s.action || '', text: s.text || '', img: s.img || null, zoom: s.zoom || null, narration: said };
  });
  const slugs = [...new Set(list.map(s => s.theme))];
  fs.writeFileSync(path.join(dir, 'scene_shots.json'), JSON.stringify({ format: size, themes: slugs, shots: list }, null, 1));
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 1));
  const STILL = lib.split(path.sep).join('/') + '/core/render/still.mjs';
  for (const sl of slugs.filter(s => STUDIO_THEMES.includes(s))) fs.cpSync(path.join(STUDIO_DIR, sl, 'demo'), path.join(dir, 'stheme', sl), { recursive: true });
  const reading = slugs.map(sl => { const st = STUDIO_THEMES.includes(sl) ? path.join(STUDIO_DIR, sl) : path.join(lib, 'styles', sl), film = path.join(lib, 'films', 's-' + sl);
    return `- "${sl}": ${path.join(st, 'STYLE.md')} (the rules, follow every section), ${path.join(st, 'DEMO.md')} (how its demo was built; do NOT reuse its story, shots or props), its tools and demo code in ${path.join(st, 'demo')}${STUDIO_THEMES.includes(sl) ? ` (import them as './stheme/${sl}/<file>.js')` : ''}${fs.existsSync(film) ? `, and a finished film made this way in ${film}` : ''}`; });
  // a Short in one run; long videos one chapter per run (big chapters split at 12 shots), two runs at a time
  const groups = [];
  if (list.length <= 20) groups.push(list.map(s => s.id));
  else { let cur = null, ch = null; for (const s of list) { if (!cur || s.ch !== ch || cur.length >= 12) { cur = []; groups.push(cur); ch = s.ch; } cur.push(s.id); } }
  log(`direction: Claude is writing this video's ${list.length} scene(s) in ${slugs.join(', ')} with each theme's own tools (${groups.length} part(s)), checking frames as it goes`);
  const run = k => directGroup({ k, ids: groups[k], dir, lib, size, model, log, slugs, reading, STILL, list, noReview: !!(plan && plan.fast && plan.fast.noReview), brand: (plan && plan.userMedia || []).filter(m => m.brand).map(m => m.id), noPeople: !!(plan && plan.pipeline === PIPELINE.character), regions: Object.fromEntries((plan && plan.userMedia || []).filter(m => m.brand && m.regions).map(m => [m.id, m.regions])) });
  // several parts at once (owner's choice: 4); a new part starts as soon as one finishes
  const PAR = Math.max(1, +process.env.HS_DIRECT_PARALLEL || 4); let next = 0;
  await Promise.all([...Array(Math.min(PAR, groups.length))].map(async () => { while (next < groups.length) await run(next++); }));
  // merge the parts (written by code, not by the director)
  fs.writeFileSync(file, groups.map((_, k) => `import * as p${k} from './scenes_${k}.js';`).join('\n') +
    `\nexport default Object.assign({}, ${groups.map((_, k) => `p${k}.default`).join(', ')});\nexport const subtitles = Object.assign({}, ${groups.map((_, k) => `p${k}.subtitles`).join(', ')});\n`);
  log(`direction: ${list.length} scene(s) written in ${groups.length} part(s)`);
  return { scenes: list.length };
}
