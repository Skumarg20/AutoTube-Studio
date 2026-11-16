// Builds the timeline: shot list (below) + narration durations + word timings -> timeline.js (for the page) and timeline.json (for the mixer).
// Shot cut points are words: at:'word' cuts just before that word is spoken ('word#2' = its 2nd occurrence in the line).
import fs from 'fs';
const dur = JSON.parse(fs.readFileSync('voices/dur.json', 'utf8'));
const words = JSON.parse(fs.readFileSync('voices/words.json', 'utf8'));

// chapters: style drives the look of every shot, the captions and the music mood
const CH = [
  { id: 0, style: 'news', mood: 'tense', title: null, lines: [
    ['v01', [{ type: 'news', img: 'img01', kicker: 'BREAKING · 1930', head: ['THE MOST POWERFUL', 'EMPIRE ON EARTH'], hl: 1, sfx: 'impact' },
             { at: 'beaten', type: 'news', img: 'img07', kicker: 'DEFEATED BY…', head: ['SOMETHING IN', 'YOUR KITCHEN'], hl: 1 }]],
    ['v02', [{ type: 'punch', text: 'NOT A WEAPON.', sfx: 'hit' }, { at: 'not#2', type: 'punch', text: 'NOT AN ARMY.', sfx: 'hit' }, { at: 'pinch', type: 'punch', text: 'A PINCH OF SALT.', img: 'img07', gold: true, sfx: 'impact' }]],
    ['v03', [{ type: 'newslist', img: 'img01', items: [['ONE OLD MAN', 'old'], ['ONE LONG WALK', 'walk'], ['ONE HANDFUL OF MUD', 'mud']] },
             { at: 'craziest', type: 'tease', img: 'img02', head: 'THE CRAZIEST PART?', sub: 'IT HAPPENS ON A QUIET BEACH…', sfx: 'riser' }], 0.6],
  ] },
  { id: 1, style: 'light', mood: 'curious', title: ['CHAPTER 1', 'WHITE GOLD'], lines: [
    ['v04', [{ type: 'photo', img: 'img07', label: 'Salt · sodium chloride', zoom: [1.0, 1.18], focus: [0.5, 0.5] }, { at: 'before', type: 'photo', img: 'img06', label: 'Salt pans', zoom: [1.12, 1.0], focus: [0.4, 0.5] }]],
    ['v05', [{ type: 'card', lines: ['NO SALT', '= NO FOOD'], sfx: 'type' }, { at: 'whoever', type: 'card', lines: ['WHOEVER CONTROLS SALT', 'CONTROLS PEOPLE'], red: 1, sfx: 'stamp' }]],
    ['v06', [{ type: 'photo', img: 'img08', label: 'Han dynasty China', zoom: [1.0, 1.15], focus: [0.5, 0.45] }, { at: 'prophets', type: 'card', lines: ['SALT PROFITS', '→ ARMIES'], sfx: 'type' }]],
    ['v06b', [{ type: 'card', lines: ['SAHARA', 'SALT  ⇄  GOLD'], red: 1, sfx: 'type' }]],
    ['v07', [{ type: 'photo', img: 'img09', label: 'France · the gabelle', zoom: [1.15, 1.0], focus: [0.5, 0.5] }, { at: 'revolution', type: 'card', lines: ['THE GABELLE', 'ABOLISHED · 1790'], stamp: 'ABOLISHED', sfx: 'stamp' }]],
    ['v08', [{ type: 'photo', img: 'img10', label: 'Rome', zoom: [1.0, 1.2], focus: [0.5, 0.4] }, { at: 'salary', type: 'card', lines: ['SAL  →  SALARY ?'], sfx: 'type' }, { at: 'historians', type: 'card', lines: ['SAL  →  SALARY ?'], stamp: 'DEBATED', sfx: 'stamp' }], 0.9],
  ] },
  { id: 2, style: 'board', mood: 'suspense', title: ['CHAPTER 2', 'THE SALT LAW'], lines: [
    ['v09', [{ type: 'board', pins: ['raj'], focus: 'raj', sfx: 'pin' }, { at: '1882', type: 'board', pins: ['raj', 'act'], focus: 'act', sfx: 'stamp' }]],
    ['v10', [{ type: 'board', pins: ['raj', 'act', 'make'], focus: 'act', reveal: [['make', 'make'], ['collect', 'collect'], ['sell', 'sell']] }, { at: 'scooping', type: 'board', pins: ['raj', 'act', 'make', 'shore'], focus: 'shore', sfx: 'pin' }]],
    ['v11', [{ type: 'board', pins: ['raj', 'act', 'make', 'shore', 'tax'], focus: 'tax', sfx: 'pin' }, { at: 'poorest', type: 'board', pins: ['raj', 'act', 'make', 'shore', 'tax', 'poor'], focus: 'poor', sfx: 'pin' }]],
    ['v12', [{ type: 'board', pins: ['raj', 'act', 'make', 'shore', 'tax', 'poor'], focus: 'all' }, { at: 'gandhi', type: 'board', pins: ['raj', 'act', 'make', 'shore', 'tax', 'poor', 'gandhi'], focus: 'gandhi', sfx: 'pin' }]],
    ['v13', [{ type: 'board', pins: ['raj', 'act', 'make', 'shore', 'tax', 'poor', 'gandhi', 'life'], focus: 'all', strings: true, sfx: 'stamp' }], 1.0],
  ] },
  { id: 3, style: 'map', mood: 'march', title: ['CHAPTER 3', 'THE MARCH'], lines: [
    ['v14', [{ type: 'map', cam: 'india', pins: ['delhi'], inset: 'img05', insetLabel: 'LORD IRWIN · VICEROY', hud: '02 MAR 1930' }, { at: 'warned', type: 'map', cam: 'india', pins: ['delhi'], alert: 'WARNING: SALT LAW WILL BE BROKEN', hud: '02 MAR 1930', sfx: 'alarm' }]],
    ['v15', [{ type: 'map', cam: 'gujarat', pins: ['ashram'], inset: 'img04', insetLabel: 'SABARMATI ASHRAM', hud: '12 MAR 1930' }, { at: '78', type: 'map', cam: 'gujarat', pins: ['ashram'], marchers: 78, hud: '12 MAR 1930', sfx: 'beep' }]],
    ['v16', [{ type: 'map', cam: 'route', pins: ['ashram', 'dandi'], dashed: true, hud: 'TARGET: DANDI' }, { at: '385', type: 'map', cam: 'route', pins: ['ashram', 'dandi'], dashed: true, big: '385 KM', sfx: 'beep' }, { at: 'foot', type: 'map', cam: 'route', pins: ['ashram', 'dandi'], dashed: true, big: 'ON FOOT', sfx: 'hit' }]],
    ['v17', [{ type: 'map', cam: 'follow', route: true, inset: 'img11_b', insetLabel: 'AGE 60 · ~16 KM A DAY' }]],
    ['v18', [{ type: 'map', cam: 'follow', route: true, crowd: true, inset: 'img03', insetLabel: 'THE CROWDS GROW' }, { at: 'reporters', type: 'map', cam: 'follow', route: true, crowd: true, inset: 'img14', insetLabel: 'WORLD PRESS', sfx: 'beep' }]],
    ['v19', [{ type: 'map', cam: 'follow', route: true, crowd: true, inset: 'img03', insetLabel: 'OFFICIALS RESIGN' }, { at: 'river', type: 'map', cam: 'follow', route: true, crowd: true, big: 'THOUSANDS', sfx: 'hit' }]],
    ['v19b', [{ type: 'map', cam: 'follow', route: true, crowd: true, inset: 'img20', insetLabel: 'VILLAGE STOPS' }]],
    ['v20', [{ type: 'map', cam: 'dandi', route: true, crowd: true, arrive: true, hud: '05 APR 1930 · DANDI', sfx: 'impact' }], 1.2],
  ] },
  { id: 4, style: 'reel', mood: 'drama', title: ['CHAPTER 4', 'THE BEACH'], lines: [
    ['v21', [{ type: 'reel', img: 'img02', zoom: [1.0, 1.1], focus: [0.4, 0.45], inter: 'APRIL 1930 · DANDI BEACH' }, { at: 'picked', type: 'reel', img: 'img02', zoom: [1.3, 1.55], focus: [0.3, 0.6] }]],
    ['v22', [{ type: 'black', text: 'ONE TINY, ILLEGAL ACT.', sfx: 'hit' }, { at: 'reportedly', type: 'intertitle', quote: '“With this, I am shaking the foundations of the British Empire.”', by: 'M. K. GANDHI · DANDI', sfx: 'projector' }], 0.8, 1.0],
    ['v23', [{ type: 'reel', img: 'img17', zoom: [1.0, 1.15], focus: [0.5, 0.5] }, { at: 'law', type: 'reel', img: 'img17', zoom: [1.15, 1.2], focus: [0.5, 0.5], stamp: 'THE LAW STOPPED WORKING', sfx: 'stamp' }]],
    ['v24', [{ type: 'reel', img: 'img03', zoom: [1.1, 1.0], focus: [0.5, 0.5], counter: 60000, counterLabel: 'ARRESTED', sfx: 'hit' }, { at: 'may', type: 'reel', img: 'img15', zoom: [1.0, 1.12], focus: [0.5, 0.35], bar: 'MAY 1930 · GANDHI JAILED', sfx: 'prison' }]],
    ['v24b', [{ type: 'reel', img: 'img11', zoom: [1.0, 1.12], focus: [0.5, 0.4], bar: 'SAROJINI NAIDU' }]],
    ['v25', [{ type: 'reel', img: 'img11', zoom: [1.0, 1.15], focus: [0.5, 0.5] }, { at: 'row', type: 'reel', img: 'img11', zoom: [1.15, 1.3], focus: [0.5, 0.5], shake: true, sfx: 'hit' }, { at: 'not', type: 'intertitle', quote: 'Not one of them fought back.', sfx: 'projector' }], 0.5],
    ['v26', [{ type: 'reel', img: 'img12', zoom: [1.0, 1.12], focus: [0.5, 0.4], bar: 'WEBB MILLER · UNITED PRESS' }, { at: 'printed', type: 'spin', img: 'img14', sfx: 'whooshbig' }]],
    ['v27', [{ type: 'globe', text: 'THE WORLD WAS WATCHING', sfx: 'impact' }], 1.0],
  ] },
  { id: 5, style: 'count', mood: 'rise', title: ['CHAPTER 5', 'WHAT IT CHANGED'], lines: [
    ['v28', [{ type: 'countintro' }]],
    ['v29', [{ type: 'num', n: 3, sfx: 'impact' }, { at: 'time', type: 'countcard', img: 'img15', head: 'MAN OF THE YEAR', sub: 'TIME MAGAZINE · 1930' }]],
    ['v30', [{ type: 'num', n: 2, sfx: 'impact' }, { at: 'viceroy', type: 'split', a: 'img05', b: 'img15', la: 'LORD IRWIN', lb: 'GANDHI', head: 'GANDHI–IRWIN PACT · 1931' }]],
    ['v31', [{ type: 'num', n: 1, sfx: 'impact' }, { at: 'proved', type: 'countcard', img: 'img01', head: 'NO WEAPONS NEEDED', sub: 'NON-VIOLENT RESISTANCE' }, { at: 'martin', type: 'countcard', img: 'img13', head: 'MARTIN LUTHER KING JR.', sub: 'STUDIED THESE METHODS' }]],
    ['v32', [{ type: 'countcard', img: 'img18', head: '1947', sub: 'INDIA BECOMES INDEPENDENT', big: true, sfx: 'impact' }], 1.0],
  ] },
  { id: 6, style: 'news', mood: 'outro', title: null, lines: [
    ['v33', [{ type: 'news', img: 'img07', kicker: 'REMEMBER', head: ['THE SMALLEST THING'], hl: 0 }, { at: 'biggest', type: 'news', img: 'img01', kicker: 'CAN SHAKE', head: ['THE BIGGEST', 'EMPIRE'], hl: 1, sfx: 'impact' }]],
    ['v34', [{ type: 'news', img: 'img07', kicker: 'NEXT TIME', head: ['WHAT ELSE IS', 'IN YOUR KITCHEN?'], hl: 1 }, { at: 'subscribe', type: 'end', sfx: 'ding' }], 2.5],
  ] },
];

// caption text fixes where speech recognition misheard (display only; timings are kept)
const FIX = { v06: { prophets: 'profits' }, v07: { Gabel: 'gabelle', revolution: 'Revolution' }, v09: { SALT: 'Salt', 'Salt': 'Salt' }, v11: { attacks: 'a tax' }, v13: { Attacks: 'A tax', attacks: 'a tax' }, v16: { dandy: 'Dandi' }, v18: { start: 'stop' }, v21: { Dandy: 'Dandi,' }, v25: { Deresana: 'Dharasana' }, v24b: { Sarajini: 'Sarojini' }, v30: { 'Gandhi-Erwin': 'Gandhi–Irwin' }, v31: { A: 'And' }, v14: { viceroy: 'Viceroy,' } };
const fixw = (id, w) => { const f = FIX[id] || {}, core = w.replace(/[.,!?;:]+$/, ''), tail = w.slice(core.length); return f[core] !== undefined ? f[core] + (f[core].match(/[.,]$/) ? '' : tail) : w; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function wordTime(id, at) {
  const [w, n] = String(at).split('#'), want = norm(w), k = +(n || 1), list = words[id] || [];
  let c = 0; for (const x of list) if (norm(x[0]) === want && ++c === k) return x[1];
  throw new Error(`cut word "${at}" not found in ${id}: ${list.map(x => x[0]).join(' ')}`);
}

const shots = [], caps = [], voice = [], sfx = [], chapters = [];
let t = 0.4;
for (const ch of CH) {
  const c0 = t;
  if (ch.title) { shots.push({ t, type: 'chapter', style: ch.style, title: ch.title, ch: ch.id }); sfx.push({ t, k: 'sting', style: ch.style }); t += 2.3; }
  for (const [id, list, gap = 0.3, pre = 0] of ch.lines) {
    t += pre;
    const v0 = t; voice.push({ id, at: v0 });
    list.forEach((s, i) => {
      const st = i === 0 ? (pre ? v0 - Math.min(pre, 0.4) : v0 - 0.12) : v0 + wordTime(id, s.at) - 0.1;
      const shot = { ...s, t: +st.toFixed(3), style: ch.style, ch: ch.id, line: id };
      if (s.items) shot.items = s.items.map(([txt, w]) => [txt, +(v0 + wordTime(id, w) - 0.05).toFixed(3)]);
      if (s.reveal) shot.reveal = s.reveal.map(([key, w]) => [key, +(v0 + wordTime(id, w) - 0.05).toFixed(3)]);
      shots.push(shot);
      sfx.push({ t: shot.t, k: s.sfx || (i === 0 && !pre ? 'none' : 'whoosh'), style: ch.style });
      if (shot.items) shot.items.forEach(([, tt]) => sfx.push({ t: tt, k: 'pop' }));
      if (shot.reveal) shot.reveal.forEach(([, tt]) => sfx.push({ t: tt, k: 'stamp' }));
    });
    for (const [w, s, e] of words[id] || []) caps.push({ w: fixw(id, w), s: +(v0 + Math.max(0, s)).toFixed(3), e: +(v0 + e).toFixed(3), ch: ch.id, line: id });
    t = v0 + dur[id] + gap;
  }
  chapters.push({ id: ch.id, style: ch.style, mood: ch.mood, t0: +c0.toFixed(3), t1: +t.toFixed(3), title: ch.title });
}
const DUR = +(t + 1.0).toFixed(2);
// the silent beat: music drops out for "That was it. One tiny, illegal act."
const silent = shots.find(s => s.type === 'black'); const quiet = silent ? [silent.t - 0.3, shots[shots.indexOf(silent) + 1].t] : null;
// route timing for the map chapter: from first 'follow' shot to the 'arrive' shot end
const f0 = shots.find(s => s.cam === 'follow'), f1 = shots.find(s => s.arrive);
const route = { t0: f0.t, t1: f1.t + 1.5 };
// phrase captions: groups of <= 5 words, split at punctuation / pauses
const phrases = []; let cur = null;
for (const c of caps) {
  if (!cur || cur.w.length >= 5 || c.line !== cur.line || c.s - cur.e > 0.35 || /[.,!?;:]$/.test(cur.w[cur.w.length - 1].w)) { cur = { w: [], ch: c.ch, line: c.line }; phrases.push(cur); }
  cur.w.push(c); cur.s = cur.w[0].s; cur.e = c.e;
}
const TL = { dur: DUR, shots, phrases, chapters, route, quiet };
fs.writeFileSync('timeline.js', 'window.TL=' + JSON.stringify(TL) + ';');
fs.writeFileSync('timeline.json', JSON.stringify({ dur: DUR, voice, sfx, chapters, quiet, route }, null, 1));
console.log('duration', DUR, 's =', (DUR / 60).toFixed(2), 'min;', shots.length, 'shots;', phrases.length, 'caption phrases');
const gaps = shots.map((s, i) => (shots[i + 1] ? shots[i + 1].t : DUR) - s.t); console.log('avg shot', (DUR / shots.length).toFixed(1), 's, longest', Math.max(...gaps).toFixed(1), 's');
export { CH };
