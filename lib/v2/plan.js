// Engine v2 planning: style catalog, style packs, Claude prompt, and plan validation/repair.
export const STYLES = {
  news: { name: 'Caption News', lib: 'caption-news', use: 'Hooks, cold opens, breaking-news reveals, endings. Bold headlines over darkened photos, red/yellow bars, a scrolling ticker.' },
  light: { name: 'Archive Light Table', lib: 'archive-lighttable', use: 'Telling the story through archive photos and documents: taped prints, magnifier, typed index cards, rubber stamps.' },
  board: { name: 'Briefing Board', lib: 'briefing-board', use: 'Evidence and causes: a cork board where pins, photos and cards appear and get linked by red string. Mysteries, laws, "why it happened".' },
  map: { name: 'Satellite Briefing', lib: 'satellite-briefing', use: 'Geography: dark satellite map, pins, zooms, a route that draws itself with live day/distance counters, HUD.' },
  reel: { name: 'Silent Film', lib: 'silent-film', use: 'Drama and the past: black-and-white film with grain and flicker, intertitle cards for quotes, a 3-2-1 film leader, spinning newspapers.' },
  count: { name: 'Countdown', lib: 'countdown', use: 'Top-3 / top-5 lists and consequences: yellow-black stripes, giant numbers slamming in.' },
  chalk: { name: 'Chalkboard', lib: 'chalkboard', use: 'Explaining an idea step by step: chalk handwriting on a green board, lists, simple facts.' },
  blueprint: { name: 'Blueprint', lib: 'blueprint', use: 'How things were built or worked: blueprint grid, typed technical labels, figures.' },
  ink: { name: 'Ink Wash', lib: 'ink-wash', use: 'Asian history, legends, calm or poetic moments: washi paper, sumi mountains, red seal.' },
  whiteboard: { name: 'Whiteboard Explainer', lib: 'whiteboard', use: 'Explaining HOW and WHY: a hand draws characters, props, arrows and labels on a whiteboard, step by step. Best for processes, comparisons, cause and effect.' },
  cartoon: { name: 'Flat Cartoon Story', lib: 'midcentury-toon', use: 'Acting the story out: colourful flat characters walk, talk (speech bubbles), carry things through scenes (desert, sea, city, palace, village, mountains, road, night).' },
  rubberhose: { name: 'Rubber-Hose Retro Cartoon', lib: 'rubber-hose', use: 'Funny or dramatic anecdotes, heists, legends: bouncy 1930s black-and-white cartoon characters with film grain and ragtime music.' },
  paper: { name: 'Paper Cut-out', lib: 'paper-popup', use: 'Lists of things, what changed, simple stories: paper cut-out characters and props with shadows on kraft paper.' },
  ukiyoe: { name: 'Ukiyo-e', lib: 'ukiyoe', use: 'Japanese woodblock print look: indigo and red, rolling waves, red sun. Legends, Asia, calm-before-the-storm moments.' },
  telestrator: { name: 'Telestrator', lib: 'telestrator', use: 'Sports-TV analysis over full-screen photos: a pen circles and points at the key detail. Breaking down a photo, a battle, a map.' },
  investig: { name: 'Visual Investigation', lib: 'visual-investigation', use: 'Forensic evidence screen: exhibits with ID tags, red highlights, scanlines. Mysteries, "what really happened", proof.' },
  newspkg: { name: 'News Package', lib: 'news-package', use: 'Bright TV news package: blue studio, LIVE bugs, lower thirds. Recaps, "here is what happened", facts in a row.' },
  citysym: { name: 'City Symphony', lib: 'city-symphony', use: '1920s black-and-white city montage with bold diagonals. Cities, industry, the rhythm of modern life.' },
  kino: { name: 'Kino Montage', lib: 'kino-montage', use: 'Soviet constructivist poster montage in red, black and cream. Revolutions, masses, propaganda, struggle.' },
  datap: { name: 'Data Physical', lib: 'data-physical', use: 'Data on a wooden desk: numbers, comparisons, charts and counted objects. Use with bars/pie/icons graphics.' },
  papercut: { name: 'Papercut Red', lib: 'papercut-red', use: 'Chinese red paper-cutting with gold borders. China, festivals, dynasties, legends.' },
  shadow: { name: 'Shadow Puppet', lib: 'shadow-puppet', use: 'Black silhouette characters on a glowing lamp-lit screen. Folk tales, legends, dramatic stories.' },
  teardown: { name: 'Teardown', lib: 'teardown', use: 'Dark technical breakdown with orange callouts and dashed outlines. How a machine, weapon, ship or building works.' },
  whitemodel: { name: 'White Model', lib: 'white-model', use: 'Clean white architectural model with soft shadows and clay figures. Buildings, cities, plans, scale.' },
  sketch: { name: 'Urban Sketch', lib: 'urban-sketch', use: 'Pen-and-watercolour sketchbook. Travel, places, everyday life, a calm explanatory tone.' },
  deco: { name: 'Art Deco', lib: 'art-deco', use: 'Black and gold 1920s geometry and sunbursts. The roaring twenties, luxury, empires at their peak.' },
  ascii: { name: 'ASCII / CRT', lib: 'ascii-crt', use: 'Green phosphor terminal and code rain. Codes, secrets, early computers, "decrypting" history.' },
  scifi: { name: 'Sci-Fi Toon', lib: 'scifi-toon', use: 'Neon space cartoon with planets. "What if", inventions, the future seen from the past.' },
  anime: { name: '80s Cel Anime', lib: 'cel-anime-80s', use: 'Retro anime sunset with speed lines. Heroic moments, rivalries, big turning points.' },
  desktop: { name: 'Desktop Flythrough', lib: 'desktop-flythrough', use: 'Retro computer desktop: photos and facts open in windows. Research, files, "let\'s look closer".' },
  hd2d: { name: 'HD-2D', lib: 'hd-2d', use: 'Pixel-art photos in a glowing bokeh diorama, like a video game. Adventures, journeys, epic quests.' },
  hud: { name: 'Hologram HUD', lib: 'hologram-hud', use: 'Modern or futuristic angles, data, scanning documents: neon cyan display, scanlines.' },
};
// library styles (66) -> engine style
export const LIB_TO_ENGINE = {
  'ukiyoe': 'ukiyoe', 'telestrator': 'telestrator', 'visual-investigation': 'investig', 'news-package': 'newspkg', 'city-symphony': 'citysym', 'kino-montage': 'kino', 'data-physical': 'datap', 'papercut-red': 'papercut', 'shadow-puppet': 'shadow', 'teardown': 'teardown', 'white-model': 'whitemodel', 'urban-sketch': 'sketch', 'art-deco': 'deco', 'ascii-crt': 'ascii', 'scifi-toon': 'scifi', 'cel-anime-80s': 'anime', 'desktop-flythrough': 'desktop', 'hd-2d': 'hd2d',
  'caption-news': 'news', 'news-package': 'news', 'game-show': 'news', 'spy-titles': 'news', 'swiss-motion': 'news', 'dark-keynote': 'news', 'pictogram-motion': 'news',
  'archive-lighttable': 'light', 'engraving': 'light', 'printed-long-take': 'light', 'risograph': 'light', 'silkscreen-poster': 'light', 'art-deco': 'light', 'urban-sketch': 'light', 'watercolor': 'light', 'impasto': 'light', 'stained-glass': 'light',
  'briefing-board': 'board', 'visual-investigation': 'board', 'halftone-dossier': 'board', 'telestrator': 'board', 'backrooms': 'board',
  'satellite-briefing': 'map', 'transit-map': 'map', 'lidar-survey': 'map', 'tilt-shift': 'map', 'lowpoly-island': 'map', 'iso-infographic': 'map',
  'silent-film': 'reel', 'newsreel': 'reel', 'kino-montage': 'reel', 'city-symphony': 'reel', 'shadow-puppet': 'reel',
  'countdown': 'count', 'data-physical': 'count', 'dataviz': 'count', 'microgame': 'count',
  'chalkboard': 'chalk', 'whiteboard': 'whiteboard', 'one-line': 'whiteboard', 'crayon-book': 'cartoon',
  'blueprint': 'blueprint', 'teardown': 'blueprint', 'white-model': 'blueprint', 'circuit-board': 'blueprint', 'glass-product': 'blueprint', 'microscope': 'blueprint', 'isometric-picture-book': 'blueprint',
  'ink-wash': 'ink', 'ukiyoe': 'ink', 'woodcut': 'ink', 'papercut-red': 'paper', 'paper-lantern': 'paper', 'paper-popup': 'paper',
  'hologram-hud': 'hud', 'ascii-crt': 'hud', 'scifi-toon': 'hud', 'desktop-flythrough': 'hud', 'living-screencast': 'hud', 'cel-anime-80s': 'cartoon', 'hd-2d': 'cartoon', 'pixel-rpg': 'hud', 'rubber-hose': 'rubberhose', 'midcentury-toon': 'cartoon', 'memphis-diorama': 'cartoon', 'brick-toy': 'cartoon', 'isometric-picture-book': 'cartoon', 'lowpoly-island': 'cartoon', 'shadow-puppet': 'paper',
};
import { EXAM_SHOTS, sanitizeSvg } from './exam.js';
import { checkThemes, THEME_SLUGS, themeOf, CHARACTER_SHOT, acceptsShot } from './themes.js';
import { NARRATOR, CAMERA, EMOTIONS, PITCHES, MAX_CAST, MAX_ON_SCREEN, MAX_LINE_WORDS } from '../character/prompts.js';
import { PIPELINE } from '../character/cast.js';
export const MY_STYLES = ['news', 'ukiyoe', 'investig', 'newspkg', 'map', 'citysym', 'reel', 'chalk', 'light', 'papercut', 'whiteboard', 'kino', 'shadow', 'count', 'telestrator', 'board', 'sketch', 'deco', 'ascii', 'scifi', 'anime', 'desktop', 'cartoon', 'rubberhose', 'paper'];
// ERA RULES: the look must belong to the time of the story.
// modern-only looks are never used for stories set before 1960; timeless explainer looks fit any era.
// NO 3D: these library looks are real 3D renders (three.js / WebGL scenes). The user finds them odd; never use them.
export const NO_3D = { teardown: ['whiteboard', 'cartoon', 'chalk'], datap: ['board', 'chalk', 'count'], whitemodel: ['sketch', 'paper', 'whiteboard'], hd2d: ['cartoon', 'paper', 'sketch'] };
export const MODERN_ONLY = ['anime', 'scifi', 'ascii', 'desktop'];
export const PERIOD_SWAP = { anime: 'rubberhose', scifi: 'deco', ascii: 'reel', desktop: 'light' };
export const ERA_STYLES = {
  ancient: ['papercut', 'shadow', 'ukiyoe', 'sketch', 'light', 'map', 'whiteboard', 'board', 'paper', 'cartoon', 'count', 'news'],
  early: ['light', 'sketch', 'ukiyoe', 'papercut', 'shadow', 'map', 'board', 'investig', 'whiteboard', 'paper', 'cartoon', 'count', 'news'],
  colonial: ['reel', 'citysym', 'kino', 'deco', 'light', 'rubberhose', 'board', 'investig', 'telestrator', 'map', 'whiteboard', 'sketch', 'cartoon', 'count', 'news'],
  modern: ['newspkg', 'news', 'telestrator', 'investig', 'map', 'whiteboard', 'board', 'count', 'anime', 'scifi', 'ascii', 'desktop', 'cartoon', 'rubberhose', 'paper'],
};
export const eraOf = y => { y = +y; if (!isFinite(y)) return null; return y < 500 ? 'ancient' : y < 1850 ? 'early' : y < 1960 ? 'colonial' : 'modern'; };
export const PACKS = {
  auto: { name: 'Auto: Claude picks from your styles', long: null, short: null },
  explainer: { name: 'Animated Explainer', long: ['news', 'whiteboard', 'map', 'cartoon', 'whiteboard', 'count'], short: ['news', 'whiteboard'], for: 'how and why things happened' },
  investigation: { name: 'Investigation', long: ['news', 'board', 'investig', 'telestrator', 'map', 'reel', 'count'], short: ['news', 'investig'], for: 'revolutions, protests, "how X beat Y"' },
  mystery: { name: 'Mystery File', long: ['news', 'investig', 'board', 'desktop', 'map', 'reel'], short: ['investig', 'board'], for: 'lost cities, unsolved history' },
  storybook: { name: 'Cartoon Storybook', long: ['papercut', 'shadow', 'cartoon', 'map', 'rubberhose', 'count'], short: ['shadow', 'cartoon'], for: 'legends, heists, adventures' },
  timemachine: { name: 'Time Machine', long: ['reel', 'citysym', 'light', 'map', 'kino', 'count'], short: ['reel', 'count'], for: 'inventions, everyday things, old cities' },
  worlddesk: { name: 'World Desk', long: ['newspkg', 'map', 'whiteboard', 'count', 'news'], short: ['map', 'newspkg'], for: 'trade routes, rivers, borders' },
  classroom: { name: 'Classroom', long: ['chalk', 'whiteboard', 'cartoon', 'map', 'paper', 'count'], short: ['whiteboard', 'count'], for: 'maps and "how it worked" explainers' },
  ancientasia: { name: 'Ancient Asia', long: ['ukiyoe', 'papercut', 'shadow', 'map', 'sketch', 'count'], short: ['ukiyoe', 'papercut'], for: 'China, Japan, India, Silk Road' },
  retro: { name: 'Retro Arcade', long: ['ascii', 'scifi', 'anime', 'cartoon', 'map', 'count'], short: ['ascii', 'anime'], for: 'wars, empires and rivalries told like a game' },
  goldenage: { name: 'Golden Age', long: ['deco', 'citysym', 'reel', 'newspkg', 'map', 'count'], short: ['deco', 'reel'], for: 'the 1900s-1950s, cities, brands' },
  sketchbook: { name: 'Sketchbook Journey', long: ['sketch', 'map', 'whiteboard', 'light', 'papercut', 'count'], short: ['sketch', 'map'], for: 'travels, explorers, places' },
};
const ANY = ['headline', 'punch', 'photo', 'text', 'quote', 'stat', 'list', 'split', 'black', 'draw', 'clip'];
export const SPECIAL_SHOTS = { map: ['map'], board: ['board'], count: ['num', 'countintro'], news: ['tease', 'end'], reel: ['spin', 'globe'], whiteboard: ['draw'], cartoon: ['draw'], rubberhose: ['draw'], paper: ['draw'] };
export const ICONS = 'camel horse elephant ship boat cart train fort palace temple pyramid hut house city wall tower coin coins goldbar moneybag chest crown sword shield spear cannon scroll book letter quill compass globe flag sack barrel crate amphora teacup silk spice salt wheat tree palm mountain sun moon cloud waves factory chains bars fire skull hourglass bulb question exclaim scale handshake magnifier tent well map anchor bridge tea road arrowR cane people ball cricketball phone car bike apple table rocket clock laptop magnet battery flask heart trophy building pendulum'.split(' ');
export const COSTUMES = 'merchant king emperor soldier roman officer farmer worker monk scholar woman gandhi explorer sailor viking child mongol general knight pharaoh maharaja samurai student studentgirl teacher doctor cricketer'.split(' ');
export const POSES = 'stand walk run point talk cheer think shock carry wave sad fight bow'.split(' ');
export const SCENES = 'blank desert sea city palace village mountains road night'.split(' ');
const SFX = ['impact', 'hit', 'whoosh', 'whooshbig', 'pop', 'stamp', 'type', 'pin', 'beep', 'alarm', 'riser', 'projector', 'prison', 'ding', 'none'];

// ---------------- numbers -> words (Kokoro reads digits badly) ----------------
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function n2w(n) { n = Math.floor(n); if (n < 20) return ONES[n]; if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + n2w(n % 100) : ''); for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) if (n >= v) return n2w(n / v) + ' ' + w + (n % v ? (n % v < 100 ? ' and ' : ' ') + n2w(n % v) : ''); return String(n); }
function year2w(y) { if (y >= 2000 && y < 2010) return n2w(y); const a = Math.floor(y / 100), b = y % 100; return n2w(a) + ' ' + (b === 0 ? 'hundred' : b < 10 ? 'oh ' + n2w(b) : n2w(b)); }
export function speakNumbers(text) {
  return String(text)
    .replace(/(\d{1,3}(?:,\d{3})+|\d+)\s?(BCE|BC|CE|AD)\b/g, (m, n, e) => { const v = +n.replace(/,/g, ''); return `${(!n.includes(',') && v >= 1000 && v < 2100) ? year2w(v) : n2w(v)} ${e.split('').join(' ')}`; })
    .replace(/(\d)\s?km\b/g, '$1 kilometres').replace(/(\d)\s?kg\b/g, '$1 kilograms')
    .replace(/\b(1[0-9]{3}|20[0-9]{2})s\b/g, (m, y) => year2w(+y).replace(/(\w+)$/, w => w.replace(/y$/, 'ie') + 's'))
    .replace(/\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\b/g, (m, a, dec, off, str) => { const n = +a.replace(/,/g, ''); const isYear = !a.includes(',') && n >= 1000 && n < 2100 && !dec; const w = isYear ? year2w(n) : n2w(n); return dec ? w + ' point ' + dec.split('').map(d => ONES[+d]).join(' ') : w; })
    .replace(/%/g, ' percent').replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
}

// ---------------- prompt ----------------
export function planPrompt({ format, theme, topic, channel, minutes, angle, pack, next, info = {}, brief = null, media = [], narration = null }) {
  const long = format === 'long', P = PACKS[pack] || PACKS.auto;
  const styleList = Object.entries(STYLES).filter(([k]) => MY_STYLES.includes(k)).map(([k, v]) => `- "${k}" (${v.name}): ${v.use}${SPECIAL_SHOTS[k] ? ` Special shots: ${SPECIAL_SHOTS[k].join(', ')}.` : ''}`).join('\n');
  const packLine = long ? (P.long ? `Use this style pack, in this order, one style per chapter (repeat or drop the last ones to fit): ${P.long.join(' → ')}.` : 'Pick 5-7 different styles from the list, one per chapter, that best fit each part of the story. Use "map" whenever places or routes matter. Open with "news" or "newspkg" and finish with "count".')
    : (P.short ? `Use exactly 2 styles: a hook chapter in "${P.short[0]}" then the story chapter in "${P.short[1]}".` : 'Use exactly 2 styles: a hook chapter (news or count) then a story chapter in the style that fits best.');
  const words = long ? Math.round(minutes * 165) : 125;
  return `You are the head writer and director of the faceless history channel "${channel}". Series: "${theme}". Plan ONE ${long ? `long-form YouTube documentary of about ${minutes} minutes (${words} spoken words, ±10%)` : 'YouTube Short / Instagram Reel of 40-50 seconds (110-130 spoken words)'}.
Topic: ${topic}${angle ? `\nAngle: ${angle}` : ''}${info.niche ? `\nChannel focus: ${info.niche}` : ''}${info.audience ? `\nAudience: ${info.audience}` : ''}${info.tone ? `\nTone of voice: ${info.tone}` : ''}
${brief && brief.title ? `\nThe creator chose this exact video TITLE (use it as "title", unchanged): ${brief.title}` : ''}${brief && brief.prompt ? `\nThe creator's brief for this video (follow it closely): ${brief.prompt}` : ''}
${media.length ? `\nTHE CREATOR'S OWN MEDIA (use every item at least once, in the shots where it fits best; do not request Commons photos for things these already show):\n${media.map(m => `- ${m.id} (${m.kind}${m.dur ? ', ' + m.dur.toFixed(1) + ' s' : ''}): ${m.desc || m.name}`).join('\n')}\nPhotos: use their id as "img" in photo/headline/split/board shots. Videos: use a shot {"type":"clip","clip": id,"from": start second inside the clip,"label"?: caption}.` : ''}
${narration ? `\nFIXED NARRATION: the creator already recorded the voice-over. Use EXACTLY this narration as the "say" text, split into lines at sentence boundaries, in order, without rewriting it (only fix obvious transcription errors). Plan the visuals around it:\n"""${narration}"""` : ''}

GOAL: maximum audience retention (viewers watch to the very end). Follow these rules:
1. The first line is a hook that lands in under 3 seconds: the most surprising true claim. No greetings, no "in this video".
2. ${long ? 'Within 20 seconds, open a loop: promise a payoff that only comes at the end (and pay it off).' : 'Every line must raise curiosity; the last line must flow straight back into the first line so the Short loops.'}
3. The picture changes every 2.5-5 seconds: give each line 1-3 shots. A line is 8-30 words; later shots cut on a word from that line ("at").
4. ${long ? 'Each chapter ends on a cliffhanger or question. Use one "black" silent-beat shot at the emotional peak. Last chapter is "count" (top 3 consequences) or "news"; the very last shot of the video is {"type":"end"} in a "news" chapter.' : 'No chapter title cards. No "end" shot. Keep it tight.'}
5. Real evidence: request archive photos, paintings, documents and engravings (public domain on Wikimedia Commons). Use maps whenever geography matters. Accuracy is everything: no invented quotes, numbers or dates; if historians disagree, say so. Quotes only if well attested ("reportedly" when needed).
5b. ERA-MATCHED LOOK: the styles must feel like the time of the story. Set "era": the main year of the story (e.g. 1930). For stories before 1960 NEVER use anime, scifi, ascii, hd2d or desktop; prefer period looks: before 1850 → light, sketch, ukiyoe, papercut, shadow, map, board; 1850-1960 (colonial era, pre-independence India, world wars) → reel (1920s silent film / newsreel), citysym, kino, deco, light (archive photos), rubberhose (1930s cartoon), board, investig, map. Explainer looks (whiteboard, map, count, news) are fine in any era.
6b. MAKE IT CRAZY TO WATCH: give at least 70% of shots a "gfx" overlay. Every graphic must MEAN something that is being said right now: point at the person or object being named, count what is being counted, date what is being dated. NO decorative filler (no floating suns, clouds, exclamation or question marks, random icons). On photos, put circles/arrows/zoom exactly on the subject (use the photo's focus point). Do not draw circles, arrows or icons on map shots (maps already animate) - only a badge or counter. Max 2 graphics per shot. Real photos almost always get a circle/arrow/zoom/badge on the key detail; numbers become counters, bars, pies or icon arrays; dates become timelines; money becomes coins; fire/war gets embers or sparks. Use "draw" scenes (characters + props acting it out) in every chapter, not only in drawn styles.
6a. In drawn styles (whiteboard, cartoon, rubberhose, paper) most shots should be "draw" scenes with characters and props acting out what the narration says; mix in a real photo now and then as evidence.
6. Show, don't tell: at least 60% of shots must show a real picture (photo, headline or split with images, stat with img, map, board, spin). Never put more than 2 text-only shots (text/punch/quote/list without img) in a row. Request enough photos for that.
7. Simple, vivid spoken English for a global audience (many viewers speak English as a second language). In "say", write numbers as words ("nineteen thirty", "sixty thousand"), no digits, no abbreviations.

STYLES (each chapter has one style; it changes the whole look):
${styleList}
${packLine}
LOOK RULE: every chapter is flat 2D: drawn, printed, paper or classic cel animation. Never a 3D-rendered look. When people act out the story (journeys, escapes, deals, battles, inventions), give that chapter a character-animation look (cartoon, rubberhose, paper, shadow or whiteboard) so the characters walk, talk and carry things like a classic 2D cartoon.

SHOT TYPES (fields). Any style:
- headline {img, kicker, head:[1-3 short lines, UPPERCASE], hl: index of the highlighted line}
- punch {text (2-6 words, UPPERCASE), img?} : a slam card for big moments
- photo {img, label (short caption), zoom?:[from,to] (1.0-1.6), focus?:[x,y] 0-1 where the subject is}
- text {lines:[1-3 short lines], red?: index of the line to colour, stamp?: 1-2 word stamp}
- quote {quote, by}
- stat {value: number, prefix?, suffix?, label, img?} : a number that counts up
- list {head?, items: [["ITEM TEXT", "cutword"], ...] (2-4 items, each appears when its cut word is spoken), img? (news only)}
- split {a: img, b: img, la, lb, head, vs?: "VS" or "&"}
- black {text} : silent beat, music stops (max once)
Special (only in their style):
- map (map) {cam: "world"|"wide"|"fit"|"route"|"follow"|"end"|<place id>, pins:[place ids], route: true to draw the route, dashed?: true to preview it, crowd?: true, count?: number of people/units to show as dots, countLabel?, inset?: img, insetLabel?, big?: short big text, alert?: warning banner text, hud?: short date/status text}
- board (board) {pins: [ALL board pin ids visible so far, in order], focus: pin id or "all"}
- num (count) {n} ; countintro (count) {text: e.g. "3 THINGS", sub}
- tease (news) {img, head, sub} : a blurred-photo teaser for the open loop
- end (news) {} : subscribe end card (long only)
- spin (reel) {img: a newspaper/document image, text}
- globe (reel) {text} : world map with flashing cities ("the world was watching")
- draw (whiteboard | cartoon | rubberhose | paper) {scene: one of ${SCENES.join(", ")}, els: [elements]} : an ANIMATED ILLUSTRATED SCENE. Elements (2-7 per shot), each may have "at": a word from the line when it appears:
    {"k":"char", "id":"short id (reuse the same id for the same person across shots)", "costume": one of ${COSTUMES.join(", ")}, "x": 0-1 position, "pose": one of ${POSES.join(", ")}, "from": [x0] to walk in from x0 to x, "face": "left"|"right", "talk": true (mouth moves with the narration), "hold": icon name}
    {"k":"prop", "icon": one of ${ICONS.join(", ")}, "x": 0-1, "size": 0.4-1.6, "from": [x0] to move it (camels, ships, carts)}
    {"k":"label", "text": "1-4 WORDS", "x": 0-1, "y": 0-1 (0.15-0.3 = top), "big": true for the key word}
    {"k":"arrow", "from": [x,y], "to": [x,y], "bend": 0-0.4}
    {"k":"bubble", "of": char id, "text": "short line the character says (max 8 words, fun but historically fair)"}
    {"k":"count", "value": number, "prefix"?, "suffix"?, "label"?, "x", "y"}
    {"k":"crowd", "n": 4-14, "x": 0-1, "w": 0.2-0.8, "pose": "cheer"|"stand"|"shock"}
  Use draw scenes to EXPLAIN and to ACT OUT the story: show who did what, where things moved, cause and effect. Characters are simple flat cartoons; costumes are approximate, so label people with a "label" when it matters. Costume guide: officer = British colonial officer (pith helmet); general = Chinese/Asian commander; soldier = generic European soldier; roman = Roman legionary; mongol = steppe horseman; king = European king; emperor = Chinese emperor; maharaja = Indian ruler; pharaoh = Egyptian ruler; gandhi = Gandhi only.
GRAPHICS LAYER: any shot may add "gfx": [1-3 animated overlay elements], drawn on top (x, y are 0-1 screen positions; each may have "at": a word from the line when it appears):
- {"k":"circle","x","y","r":0.05-0.2} pen circle on a detail · {"k":"arrow","from":[x,y],"to":[x,y]} · {"k":"box","x","y","w","h"} · {"k":"underline","x","y","w"}
- {"k":"zoom","x","y","r":0.1-0.18,"z":2-3} magnifier enlarging a detail of the photo
- {"k":"icon","icon": an icon name,"x","y","size":0.1-0.3,"anim":"pop"|"float"|"bounce"|"spin"|"fly","from":[x,y] for fly,"label"?}
- {"k":"icons","icon","n": 5-60,"cols"?,"x","y","label","per"?: value per icon,"unit"?} an icon array that counts up (78 marchers, 10 ships...)
- {"k":"bars","items":[["LABEL",value],...],"x","y","w","h","title"?,"hl"?: index} animated bar chart · {"k":"pie","value": 0-100,"label","x","y"}
- {"k":"timeline","items":[["1930","Salt March"],...],"y"} · {"k":"counter","value","prefix"?,"suffix"?,"label","x","y"} · {"k":"badge","text","x","y"} · {"k":"stamp","text","x","y"}
- {"k":"particles","kind":"dust"|"embers"|"sparks"|"snow"|"coins"|"confetti"}
Every shot may add "sfx": one of ${SFX.join(', ')}. Shots after the first in a line need "at": a word that appears in that line's "say".

Return ONLY this JSON (no markdown):
{"title": "YouTube title, max 70 chars, curiosity-driven, honest",
 "description": "YouTube description: 2-4 short paragraphs + 3-5 hashtags",
 "tags": ["8-15 tags"],
 "next": "teaser title for the next episode (short)",
 "thumbText": "2-4 WORD THUMBNAIL HEADLINE, punchy, curiosity-driven, different from the title (e.g. 'SALT BEAT AN EMPIRE')",
 "thumbImg": "id of the most striking image for the thumbnail (a face or dramatic moment)",
 "op": "short HUD operation name, e.g. OPERATION SALT · 1930",
 "ticker": ["4-6 short UPPERCASE facts for the news ticker"],
 "era": main year of the story as a number (e.g. 1930),
 "highlight": ["country names (Natural Earth English names) to highlight on maps"],
 "images": [{"id": "img01", "want": "exactly what the picture must show", "queries": ["2-3 Wikimedia Commons search queries"], "historical": true}],
 "places": [{"id": "p1", "name": "PLACE NAME", "lat": 0.0, "lon": 0.0}],
 "route": null or {"points": [[lon, lat], ...] (5-15 accurate points along the real path), "labels": [["Town", pointIndex], ...], "km": number or null, "days": number or null, "endName": "PLACE"},
 "board": [{"id": "b1", "kind": "photo"|"card"|"marker", "img"?: "imgNN", "cap"?: "LABEL", "lines"?: ["1-3 short lines"], "stamp"?: "WORD", "red"?: true, "center"?: true (one key pin, usually the main person)}],
 "chapters": [{"style": "news", "mood": "tense"|"curious"|"suspense"|"march"|"drama"|"rise"|"outro", "title": null or ["CHAPTER 1", "CHAPTER NAME"], "lines": [{"say": "...", "shots": [{"type": "...", ...}, {"at": "word", "type": "...", ...}], "gap": 0.3}]}]}

Limits: ${long ? '18-28 images, 5-8 chapters (the first one, the cold open, has title null), 45-75 lines' : '4-8 images, exactly 2 chapters with title null, 6-10 lines'}. Every img referenced must be in "images". Use "board" and "places"/"route" only if a board/map chapter uses them (else []/null). Give each photo a different image where possible.`;
}

// ---------------- validation / repair ----------------
const wordsOf = t => String(t || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const namedIn = (text, name) => { const w = wordsOf(text), n = wordsOf(name); return n.length > 0 && w.some((_, i) => n.every((x, k) => w[i + k] === x)); };   // the whole name, as words
// the video editor's settings (dashboard "Edit video", or Claude's edits). None of them makes a clip or a voice again.
export const LINE_EDIT_LIMITS = { trim: [0, 1.5], speed: [0.85, 1.3], gap: [0, 1.5] };
export const CAPTION_LOOK = { style: ['word', 'phrase', 'off'], position: ['low', 'middle', 'high'], size: ['m', 'l', 'xl'] };
const clampTo = ([lo, hi], v) => Math.min(hi, Math.max(lo, +v || 0));
function normalizeLineEdits(l) {
  if (l.trim) { const start = clampTo(LINE_EDIT_LIMITS.trim, l.trim.start), end = clampTo(LINE_EDIT_LIMITS.trim, l.trim.end); if (start || end) l.trim = { start, end }; else delete l.trim; }   // seconds off the start / end
  if (l.speed !== undefined) { const v = +clampTo(LINE_EDIT_LIMITS.speed, l.speed).toFixed(2); if (v && v !== 1) l.speed = v; else delete l.speed; }   // played faster / slower
  if (l.gap !== undefined) l.gap = +clampTo(LINE_EDIT_LIMITS.gap, l.gap).toFixed(2);   // pause after the line
  if (typeof l.caption === 'string' && l.caption.trim() && l.caption.trim() !== l.say) l.caption = l.caption.replace(/\s+/g, ' ').trim(); else delete l.caption;   // the subtitle text, when it differs from what is said
}
function normalizeCaptionLook(c) {
  if (!c || typeof c !== 'object') return undefined;
  const out = Object.fromEntries(Object.entries(CAPTION_LOOK).filter(([k, ok]) => ok.includes(c[k])).map(([k]) => [k, c[k]]));
  return Object.keys(out).length ? out : undefined;
}

export function normalizePlan(p, format) {
  const errs = [], warns = [], fix = [];
  if (!p || !Array.isArray(p.chapters) || !p.chapters.length) return { plan: p, errs: ['plan has no chapters'], warns, words: 0, estSeconds: 0 };
  p.images = Array.isArray(p.images) ? p.images.filter(i => i && i.id) : [];
  const imgIds = new Set([...p.images.map(i => i.id), ...((p.userMedia || []).filter(m => m.kind === 'image').map(m => m.id))]);
  const clipIds = new Set((p.userMedia || []).filter(m => m.kind === 'video').map(m => m.id));
  p.places = Array.isArray(p.places) ? p.places.filter(x => x && isFinite(x.lat) && isFinite(x.lon)) : [];
  const placeIds = new Set(p.places.map(x => x.id));
  p.board = Array.isArray(p.board) ? p.board : [];
  const isExam = p.domain === 'exam';
  if (isExam) { p.diagrams = (Array.isArray(p.diagrams) ? p.diagrams : []).map(d => d && d.id ? { ...d, svg: sanitizeSvg(d.svg) } : null).filter(d => d && d.svg); }
  const dgIds = new Set((p.diagrams || []).map(d => d.id));
  const pinIds = new Set(p.board.map(x => x.id));
  if (p.route && !(Array.isArray(p.route.points) && p.route.points.length > 1)) p.route = null;
  let n = 0, words = 0;
  const era = eraOf(p.era);
  const DECOR = new Set(['sun', 'cloud', 'moon', 'exclaim', 'question', 'bulb']);
  const CHARACTER = p.pipeline === PIPELINE.character;   // characters speak their own lines (lib/character)
  p.captions = normalizeCaptionLook(p.captions); if (!p.captions) delete p.captions;
  if (CHARACTER) {
    p.cast = (Array.isArray(p.cast) ? p.cast : []).filter(m => m && m.name && m.look && m.voice).slice(0, MAX_CAST).map((m, i) => ({ ...m, id: m.id || 'c' + (i + 1) }));
    if (!p.cast.length) errs.push('no "cast" (name, look, voice) for this character video');
  }
  const castIds = new Set((p.cast || []).map(m => m.id));
  const LIBLOOK = p.look === 'lib', BOARD = isExam && (p.look === 'board' || LIBLOOK), LIB_STYLES = THEME_SLUGS, BOARD_OK = ['anime', 'scene', 'write', 'quiz', 'sim', 'diagram', 'steps', 'eq', 'mistake'];
  p.chapters.forEach((ch, ci) => {
    if (LIBLOOK && !LIB_STYLES.includes(ch.style)) { fix.push(`chapter ${ci + 1}: "${ch.style}" → whiteboard (library themes built so far: ${LIB_STYLES.join(', ')})`); ch.style = 'whiteboard'; }
    if (!LIBLOOK && BOARD && !['chalk', 'whiteboard'].includes(ch.style)) { fix.push(`chapter ${ci + 1}: "${ch.style}" → whiteboard (board-only look)`); ch.style = 'whiteboard'; }
    if (!LIBLOOK && !STYLES[ch.style]) { fix.push(`chapter ${ci + 1}: unknown style "${ch.style}" → light`); ch.style = LIB_TO_ENGINE[ch.style] || 'light'; }
    if (!LIBLOOK && NO_3D[ch.style]) { const nb = [p.chapters[ci - 1]?.style, p.chapters[ci + 1]?.style], sw = NO_3D[ch.style].find(x => !nb.includes(x)) || NO_3D[ch.style][0]; fix.push(`chapter ${ci + 1}: "${ch.style}" is a 3D look → ${sw}`); ch.style = sw; }
    if (!LIBLOOK && era && era !== 'modern' && MODERN_ONLY.includes(ch.style)) { const sw = PERIOD_SWAP[ch.style]; fix.push(`chapter ${ci + 1}: "${ch.style}" does not fit a ${p.era} story → ${sw}`); ch.style = sw; }
    if (!LIBLOOK && !MY_STYLES.includes(ch.style)) { const sw = { blueprint: 'whiteboard', ink: 'ukiyoe', hud: 'ascii' }[ch.style] || 'light'; fix.push(`chapter ${ci + 1}: "${ch.style}" is not one of your styles → ${sw}`); ch.style = sw; }
    if (format === 'short') ch.title = null;
    ch.lines = (ch.lines || []).filter(l => l && String(l.say || '').trim());
    ch.lines.forEach(l => {
      l.id = 'l' + String(++n).padStart(3, '0');
      // v3 voice direction: "[curious] Top point par..." -> the voice reads l.tts (with tags), captions and timing use l.say (clean)
      if (/\[[^\]]{2,30}\]/.test(l.say) || l.tts) { l.tts = speakNumbers(l.tts || l.say); l.say = l.say.replace(/\[[^\]]{2,30}\]\s*/g, '').replace(/\s+/g, ' ').trim(); }
      const said = speakNumbers(l.say); if (said !== l.say) l.say = said;
      words += l.say.split(/\s+/).length;
      normalizeLineEdits(l);
      l.shots = (l.shots || []).filter(s => s && s.type && (CHARACTER || s.type !== CHARACTER_SHOT));
      if (CHARACTER) {   // owner's rules: a seen speaker has no other voice over them; a voice-only line shows no people
        if (!castIds.has(l.speaker)) l.speaker = NARRATOR;
        l.camera = l.speaker !== NARRATOR && l.camera === CAMERA.on ? CAMERA.on : CAMERA.off;
        l.withWho = l.camera === CAMERA.on ? [...new Set((Array.isArray(l.withWho) ? l.withWho : []).filter(id => castIds.has(id) && id !== l.speaker))].slice(0, MAX_ON_SCREEN - 1) : [];
        // a character the scene's blocking places in the shot is in the frame too: with their own photo and clothes, not a stranger
        if (l.camera === CAMERA.on && ch.blocking) for (const m of p.cast) if (m.id !== l.speaker && !l.withWho.includes(m.id) && l.withWho.length < MAX_ON_SCREEN - 1 && namedIn(ch.blocking, m.name)) l.withWho.push(m.id);
        if (!EMOTIONS.includes(l.emotion)) l.emotion = 'friendly';
        if (!PITCHES.includes(l.pitch)) l.pitch = 'medium';
        if (typeof l.punch !== 'string' || !l.say.toLowerCase().includes(l.punch.toLowerCase())) delete l.punch;   // a word of this line, or nothing
        if (l.gap === undefined) l.gap = 0.08;   // lines follow each other like a real conversation, no dead air
        l.shots = l.camera === CAMERA.on ? [{ type: CHARACTER_SHOT }] : l.shots.filter(s => s.type !== CHARACTER_SHOT);
        const said = l.say.split(/\s+/).length;
        if (l.speaker !== NARRATOR && said > MAX_LINE_WORDS + 4) errs.push(`${l.id}: ${said} words; a character line is one clip of at most ${MAX_LINE_WORDS} words, split it`);
      }
      if (!l.shots.length) l.shots = [{ type: 'text', lines: [l.say.split(/\s+/).slice(0, 5).join(' ').toUpperCase()] }];
      if (BOARD) { const n0 = l.shots.length; l.shots = l.shots.filter(s => BOARD_OK.includes(s.type)); if (l.shots.length < n0) fix.push(`${l.id}: removed ${n0 - l.shots.length} non-board shot(s)`);if (!l.shots.length) l.shots = [{ type: 'write', els: [] }]; }
      l.shots = l.shots.map((s, i) => {
        const T = s.type; const allowed = (LIBLOOK && acceptsShot(themeOf(ch.style) || { shots: [] }, T)) || ANY.includes(T) || (SPECIAL_SHOTS[ch.style] || []).includes(T) || (isExam && (EXAM_SHOTS.includes(T) || T === 'end' || T === 'num' || T === 'countintro'));
        if (!allowed) { fix.push(`${l.id}: "${T}" not available in ${ch.style}`); s = { ...s, type: s.img ? 'photo' : 'text', lines: s.lines || [String(s.big || s.text || s.head || '').toUpperCase()].filter(Boolean) }; if (!s.lines.length && s.type === 'text') s.lines = [l.say.split(/\s+/).slice(0, 5).join(' ').toUpperCase()]; }
        for (const k of ['img', 'a', 'b', 'inset']) if (s[k] && !imgIds.has(s[k])) { fix.push(`${l.id}: unknown image ${s[k]}`); delete s[k]; }
        if (s.type === 'map') { s.pins = (s.pins || []).filter(x => placeIds.has(x)); if (s.route && !p.route) delete s.route; if (s.cam && !['world', 'wide', 'fit', 'route', 'follow', 'end'].includes(s.cam) && !placeIds.has(s.cam)) s.cam = 'fit'; }
        if (s.type === 'board') { s.pins = (s.pins || []).filter(x => pinIds.has(x)); if (!s.pins.length) { s = { type: 'text', lines: ['EVIDENCE'] }; } }
        if (i > 0 && s.at && !new RegExp('\\b' + String(s.at).split('#')[0].replace(/[^\w]/g, '') , 'i').test(l.say)) { delete s.at; }
        if (s.sfx && !SFX.includes(s.sfx)) delete s.sfx;
        if (Array.isArray(s.gfx)) {
          let gx = s.gfx.filter(e => e && e.k && !(e.k === 'icon' && DECOR.has(e.icon)) && !(e.k === 'icons' && DECOR.has(e.icon)));
          if (s.type === 'map') gx = gx.filter(e => ['badge', 'counter', 'stamp'].includes(e.k));
          if (s.type === 'photo' && s.focus) gx = gx.map(e => ['circle', 'zoom'].includes(e.k) && (Math.abs((e.x ?? .5) - s.focus[0]) > .3 || Math.abs((e.y ?? .5) - s.focus[1]) > .3) ? { ...e, x: s.focus[0], y: s.focus[1] } : e);
          s.gfx = gx.slice(0, 2); if (!s.gfx.length) delete s.gfx;
        }
        if (s.type === 'clip' && !clipIds.has(s.clip)) s = { type: 'text', lines: [String(s.label || l.say.split(/\s+/).slice(0, 5).join(' ')).toUpperCase()] };
        if (s.type === 'quote' && !s.quote) s = { ...s, type: 'text' };
        // exam shots: fall back to a text card when something essential is missing
        const asText = t => ({ type: 'text', lines: [String(t || l.say.split(/\s+/).slice(0, 5).join(' ')).toUpperCase().slice(0, 40)], ...(s.at ? { at: s.at } : {}) });
        if (s.type === 'diagram' && !dgIds.has(s.d)) { fix.push(`${l.id}: diagram ${s.d} missing`); s = asText(s.label); }
        if (s.type === 'eq' && !s.tex) s = asText(s.label);
        if (s.type === 'steps') { s.items = (Array.isArray(s.items) ? s.items : []).map(it => Array.isArray(it) ? it : [String(it), null]).filter(it => it[0]).slice(0, 6); if (!s.items.length) s = asText(s.head); }
        if (s.type === 'quiz') { s.opts = (Array.isArray(s.opts) ? s.opts : []).map(String).slice(0, 4); s.ans = +s.ans; if (!s.q || s.opts.length < 2 || !(s.ans >= 0 && s.ans < s.opts.length)) { fix.push(`${l.id}: quiz incomplete`); s = asText(s.q); } }
        if (s.type === 'mistake' && !(s.wrong || s.wtex) ) s = asText(s.head);
        if (s.type === 'write') { s.els = (Array.isArray(s.els) ? s.els : []).filter(e => e && ((['h', 't'].includes(e.k) && e.text) || (e.k === 'tex' && e.tex) || (e.k === 'dg' && dgIds.has(e.d)))).slice(0, 6); s.els.forEach(e => { if (e.at && !new RegExp('\\b' + String(e.at).split('#')[0].replace(/[^\w]/g, ''), 'i').test(l.say)) delete e.at; }); }
        if (s.type === 'stat') s.value = +String(s.value).replace(/[^\d.]/g, '') || 0;
        if (s.type === 'list' && Array.isArray(s.items)) s.items = s.items.slice(0, 5).map(it => Array.isArray(it) ? it : [String(it), null]);
        return s;
      });
    });
  });
  p.board.forEach(b => { if (b.img && !imgIds.has(b.img)) { b.kind = 'card'; b.lines = b.lines || [b.cap || '']; delete b.img; } });
  const est = words / (CHARACTER ? 2.3 : 2.75) + p.chapters.filter(c => c.title).length * 2.3 + n * .35;
  if (format === 'short' && est > 59) errs.push(`Short is about ${Math.round(est)} s: cut it under 59 s`);
  if (format === 'long' && est < 150) warns.push(`long video is only about ${Math.round(est / 60)} min`);
  if (LIBLOOK) errs.push(...checkThemes(p, format, p.domain));   // THEMES.md mixing rules (lib/v2/themes.js)
  if (!p.title) errs.push('missing title'); else if (p.title.length > 100) errs.push('title over 100 characters');
  if (p.images.length === 0) warns.push('no images requested');
  if (fix.length) warns.push(...fix.slice(0, 12).map(x => 'auto-fixed: ' + x));
  return { plan: p, errs, warns, words, estSeconds: Math.round(est), lines: n };
}

export function flowTopicsPrompt({ name, niche, audience, tone, existing, n = 12, domain = 'history' }) {
  if (domain === 'general') return `You are the research lead of the YouTube/Instagram channel "${name}".
Channel focus: ${niche || 'general interest'}${audience ? `
Audience: ${audience}` : ''}${tone ? `
Tone: ${tone}` : ''}
Research ${n} NEW video topics that fit this channel's focus exactly: specific, accurate, with a strong hook and high curiosity (good for YouTube search, Shorts and retention), each able to carry a long video plus 2 short spin-offs. Avoid these existing topics: ${(existing || []).slice(-80).join('; ') || 'none'}.
Return ONLY a JSON array: [{"topic": "<short topic>", "title": "<curiosity title, max 70 chars>", "hook": "<one-line hook>", "year": null}]`;
  return `You are the research lead of the YouTube/Instagram channel "${name}".
Channel focus: ${niche || 'history'}${audience ? `\nAudience: ${audience}` : ''}${tone ? `\nTone: ${tone}` : ''}
Research ${n} NEW video topics for this channel: specific, well-documented true stories with a strong hook and high curiosity (good for YouTube search, Shorts and retention), each able to carry an 8-10 minute documentary plus 2 short spin-offs. Mix famous and surprising lesser-known stories. Avoid these (already used or queued): ${existing.slice(0, 120).join('; ') || 'none'}.
Return ONLY a JSON array: [{"topic": "<short topic>", "title": "<curiosity title, max 70 chars>", "hook": "<one-line hook>", "year": <main year as a number>}]`;
}
