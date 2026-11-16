// THEME RULES for the planner (THEMES.md). The planner may only use the themes listed here; each row says what the theme is,
// what parts of a script it is for, which channel types use it, and which shots it accepts. The mixing rules below decide how
// themes alternate. Two kinds of theme:
//   engine   : drawn by the theme's own engine from the plan's content (whiteboard writes notes/formulas/diagrams live)
//   directed : for every video Claude writes that video's scenes with ONLY the theme's own demo modules, following its STYLE.md
//              (lib/v2/director.mjs), exactly the way the library's films (films/s-*) were made.
// To add a theme: add one row. The prompt, the plan check and the director pick it up automatically.
import { CATALOG, THREE_D } from './catalog.mjs';
const D = (slug, name, look, use, never, channels, length = '1-4 lines (about 4-20 seconds) per chapter') =>
  ({ slug, name, kind: 'directed', look, use, never, channels, shots: ['scene'], length });

const CURATED = [
  { slug: 'whiteboard', name: 'Whiteboard Explainer', kind: 'engine', channels: ['exam'],
    look: 'one big glossy dry-erase board; floating markers (no hands) write notes, formulas and diagrams stroke by stroke as they are spoken; the camera travels from page to page; an eraser wipes old pages',
    use: 'teaching: concepts, formulas, derivations, diagrams, solved questions, quizzes, traps (wrong vs right), recaps, comparisons',
    never: 'pure emotion beats with nothing to write', shots: ['write', 'quiz', 'steps', 'sim', 'diagram', 'eq', 'mistake'], length: 'any length; one idea per page' },
  { slug: 'cel-anime-80s', name: '80s Cel Anime', kind: 'directed', channels: ['exam', 'history'],
    look: 'hand-animated 80s OVA scenes made for this video: painted backgrounds, flat two-tone cel characters and objects acting out the moment, camera moves, backlit light, impact frames, CRT videotape',
    use: 'a real-life situation ACTED OUT by characters: the cable snaps, the ball is hit for six, a chase, a battle charge, a student frozen in the exam hall. Only when the part really is a scene of people in action',
    never: 'explaining formulas, numbers, maps or documents; opening every video; being the default for hooks, surprises, reactions or motivation (many other themes do those better: pick by content)', shots: ['anime', 'scene'], length: '1-3 lines (about 3-12 seconds) per chapter; every anime shot needs an action' },
  // ── history / documentary themes (all directed) ──
  D('newsreel', '1920s Newsreel', 'a late-1920s sound newsreel cut from real archive photos and film: searchlight-and-globe ident, spinning newspaper, place-and-date cards, cheerful announcer energy, black-and-white grain',
    'real events of roughly 1890-1955: openings, announcements, crowds, inventions, wars and their news', 'ancient or medieval stories; anything without real archive pictures', ['history']),
  D('silent-film', '1920s Silent Film', 'an engraved-illustration silent film in a picture house: ink line and silver wash, flickering 4:3 print between velvet curtains, intertitles',
    'comic or dramatic episodes of the 1900s-1930s, characters acting out a scene, a twist told with intertitles', 'maps, data, modern events', ['history']),
  D('archive-lighttable', 'Archive Light Table', 'real archive objects (letters, photos, negatives, telegrams, clippings) on a backlit light table; a loupe comes down and the object comes alive',
    'evidence: an old letter, a photograph, a newspaper, a document that proves the story', 'action, fights, legends without documents', ['history']),
  D('visual-investigation', 'Visual Investigation', 'a cold investigation desk: footage, photos, documents and maps of one event laid on one shared clock so they check each other',
    'mysteries, disputed facts, reconstructing what happened minute by minute, myth vs fact', 'happy celebrations, legends', ['history']),
  D('kino-montage', 'Constructivist Montage', 'real archive pictures printed as one ink-and-paper poster with a single red, cut on a machine beat; diagonal type bands',
    'revolutions, industry, mass movements, collective effort, propaganda eras', 'quiet personal moments, ancient myths', ['history']),
  D('transit-map', 'Transit Map', 'a metro-schematic map on paper drawn by glowing pen tips: lines in eight directions, stops, interchanges, water as flat bands',
    'routes, journeys, trade routes, empires spreading, timelines as lines with stops', 'close-up drama, faces', ['history']),
  D('satellite-briefing', 'Satellite Briefing', 'real satellite imagery graded to analyst grey with thin white measurement lines: lock-on reticle, outlines, a range line, one zoom',
    'real places on Earth: battlefields, cities, ruins, rivers, distances, "where exactly did this happen"', 'myths, people, close-ups', ['history']),
  D('shadow-puppet', 'Shadow Puppetry', 'translucent dyed-hide puppets carved like lace, pressed on a cotton screen lit from behind by oil lamps',
    'myths, folklore, legends, kings and gods, Indian and Asian tales (Raja stories)', 'modern events, data', ['history']),
  D('ink-wash', 'Chinese Ink Wash', 'xieyi ink painting on rice paper, animated: blank paper is space, one brushstroke is a mountain, a wave or a cut',
    'poetic legends, journeys through landscapes, wise men, warriors, Asian history', 'technology, documents, numbers', ['history']),
  D('ukiyoe', 'Ukiyo-e', 'Edo woodblock prints come alive: flat colour blocks, carved lines, bokashi skies, the camera unrolling like a handscroll',
    'Japanese history, sea voyages, travellers, nature and seasons, samurai-era stories', 'modern events', ['history']),
  D('woodcut', 'Woodcut Print', 'a relief print that carves itself: black wood block, light only where the knife cut, one burning colour',
    'dark history: plagues, wars, executions, folk tales, grim turning points', 'cheerful moments', ['history']),
  D('engraving', 'Copperplate Engraving', 'an intaglio plate that engraves itself: burin lines, hatching and cross-hatching, a proof pulled, magnified details',
    'scientists, inventions, explorers, old books and maps, the age of discovery', 'action scenes', ['history']),
  D('stained-glass', 'Stained Glass', 'a medieval stained-glass window inside a dark stone hall, alive only where the sun touches it',
    'medieval and religious history, saints, kings, cathedrals, holy legends', 'modern events, data', ['history']),
  D('paper-lantern', 'Paper-cut Lightbox', 'a layered paper-cut shadow box lit from behind: 6-9 cut card layers, windows and moons glowing through holes',
    'journeys, farewells, places and their stories, night scenes, emotional endings', 'documents, data', ['history']),
  D('papercut-red', 'Red Paper-cut', 'red window-flower paper-cuts brought to life: jointed red cut-outs on paper, the cut is the drawing',
    'festivals, folk tales, celebrations, Asian traditions', 'grim or technical topics', ['history']),
  D('watercolor', 'Watercolor Brush', 'a hand-painted journal page that paints itself: translucent brush strokes, dry-brush, handwritten notes beside the painting',
    'nature, travel, gentle personal stories, places and landscapes, a calm ending', 'battles, documents', ['history']),
];
// ALL library themes except 3D (owner, 2026-11-14: "we have 66 themes and we need to use all based on the video").
// The rows above keep their hand-written notes; every other theme comes from THEMES.md (lib/v2/catalog.mjs).
// Every channel may use every theme; the planner picks per chapter from the content. whiteboard is an engine theme for exam channels.
const fitText = f => [/J/.test(f) && 'JEE/NEET', /H/.test(f) && 'history', /S/.test(f) && 'Shorts'].filter(Boolean).join(', ');
export const THEMES = [
  ...CURATED.map(t => ({ ...t, channels: t.slug === 'whiteboard' ? ['exam'] : ['exam', 'history'] })),
  ...CATALOG.filter(c => !CURATED.some(t => t.slug === c.slug)).map(c => D(c.slug, c.name, c.look,
    c.use + (c.why ? ` (why: ${c.why})` : '') + (fitText(c.fit) ? `; best known fit: ${fitText(c.fit)}` : ''),
    'parts whose content does not match this look', ['exam', 'history'])),
].filter(t => !THREE_D.includes(t.slug));
export const THEME_SLUGS = THEMES.map(t => t.slug);
export const themeOf = slug => THEMES.find(t => t.slug === slug);
export const themesFor = domain => THEMES.filter(t => t.channels.includes(domain === 'exam' ? 'exam' : 'history'));

// the mixing rules, as plain instructions; checked again by checkThemes() after planning
export function themeRules(long, domain = 'exam', recent = [], openers = []) {
  const list = themesFor(domain), min = long ? 3 : 2, max = long ? 2 : 1, wb = domain === 'exam' && long ? ' ("whiteboard" is the exception: up to 3 times, and ONLY for written working such as derivations and multi-step solutions; skip it when not needed)' : '';
  // a different random shortlist for every plan, so plans written at the same time do not all pick the same themes
  const pool = list.filter(t => t.slug !== 'whiteboard' && !recent.includes(t.slug) && !openers.includes(t.slug)), fresh = [];
  while (pool.length && fresh.length < 10) fresh.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].slug);
  const rows = list.map(t => `- "${t.slug}" (${t.name}): ${t.look}.\n    USE FOR: ${t.use}. NEVER FOR: ${t.never}. SHOTS: ${t.shots.join(', ')}. LENGTH: ${t.length}.`).join('\n');
  const all = list.length <= 3;
  return `THEMES (Lemo Opuscar library only; every pixel is drawn by the theme's own engine or by scenes written for this video with the theme's own tools). The ONLY themes that exist:
${rows}
THEME MIXING RULES (mandatory; the video must feel like several worlds, not one):
1. Read the script part by part and give EVERY chapter the theme whose "USE FOR" matches that part's content best. Each chapter has "style" (a theme slug) and "why" (one sentence: which content in this part made you pick this theme).
2. ${all ? `Use EVERY theme listed above at least once${long ? ', and at least twice each in a long video' : ''}.` : `Use at least ${min} different themes${long ? ' (4-6 is best)' : ''}.`} A video in a single theme is rejected.
3. The theme changes when the content type changes. Never two chapters of the same theme in a row. Each theme is used at most ${max === 1 ? 'ONCE in a Short' : 'TWICE in a long video'}${wb}.
4. Switch theme often enough to stay fresh: ${long ? 'no single chapter longer than about 90 seconds; a new theme at least every 1-2 minutes' : 'a new theme every 5-15 seconds'}.
5. There are many themes on purpose: choose freshly for THIS video from what each part is about. Do not fall back on the same 2-3 themes every time; if the channel's recent videos used some themes (listed below when known), prefer other themes that fit just as well.
6. Order: the FIRST chapter is the hook. Pick the theme that shows THIS video's hook best (a mystery file, a striking number, a document, a lab close-up, a map, a news flash, a game screen, a scene acted out...); "cel-anime-80s" is only one option among many.${openers.length ? ` Do NOT open with ${openers.map(s => `"${s}"`).join(' or ')}: the channel's last videos opened with it.` : ''} The biggest surprise gets its own short chapter; the LAST chapter ends on a question for the comments.
7. Each chapter uses ONLY the shots listed for its theme.${recent.length ? `
This channel's recent videos used: ${recent.join(', ')}.` : ''}${fresh.length ? `
Fresh themes to consider first for THIS video (a random shortlist; use the ones whose USE FOR fits a part): ${fresh.join(', ')}.` : ''}
8. Plan ${long ? '6-10' : '3-5'} chapters${long ? ' (the first has title null)' : ', all with title null'}.`;
}

// planning-side check: returns errors for plans that break the mixing rules
export function checkThemes(p, format, domain = 'exam') {
  const errs = [], ch = p.chapters || [], used = new Set(ch.map(c => c.style)), list = themesFor(domain), long = format === 'long';
  for (const c of ch) if (!list.some(t => t.slug === c.style)) errs.push(`theme rules: "${c.style}" is not a theme for this channel`);
  if (list.length <= 3) { for (const t of list) if (!used.has(t.slug)) errs.push(`theme rules: "${t.slug}" (${t.name}) is not used; every theme must appear`); }
  else if (used.size < (long ? 3 : 2)) errs.push(`theme rules: only ${used.size} theme(s); use at least ${long ? 3 : 2}`);
  ch.forEach((c, i) => { if (i && c.style === ch[i - 1].style) errs.push(`theme rules: chapters ${i} and ${i + 1} are both "${c.style}"; themes must alternate`); });
  ch.forEach((c, i) => { const T = themeOf(c.style); if (!T) return; const bad = [...new Set(c.lines.flatMap(l => l.shots.map(s => s.type)).filter(x => !T.shots.includes(x)))]; if (bad.length) errs.push(`theme rules: chapter ${i + 1} ("${c.style}") has shots it does not accept: ${bad.join(', ')}`); });
  ch.forEach((c, i) => c.lines.forEach(l => l.shots.forEach(s => { if ((s.type === 'anime' || s.type === 'scene') && !String(s.action || '').trim()) errs.push(`theme rules: chapter ${i + 1} has a ${s.type} shot without an action (what happens on screen)`); })));
  const cnt = {}; ch.forEach(c => { cnt[c.style] = (cnt[c.style] || 0) + 1; });
  for (const [s, k] of Object.entries(cnt)) if (k > (domain === 'exam' && s === 'whiteboard' && long ? 3 : long ? 2 : 1)) errs.push(`theme rules: "${s}" is used in ${k} chapters; at most ${domain === 'exam' && s === 'whiteboard' && long ? '3 times' : long ? 'twice in a long video' : 'once in a Short'}`);
  if (ch[0] && (p.avoidOpen || []).includes(ch[0].style)) errs.push(`theme rules: the video opens with "${ch[0].style}" like the channel's last videos; open with another theme that fits the hook`);
  const n = ch.length, [lo, hi] = long ? [6, 10] : [3, 5];
  if (n < lo || n > hi) errs.push(`theme rules: ${n} chapters; plan ${lo}-${hi}`);
  return errs;
}
