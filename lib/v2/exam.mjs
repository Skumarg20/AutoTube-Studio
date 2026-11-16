// JEE / NEET exam-prep channels: planner prompt, topic research prompt and the extra shot types.
// The plan uses the same JSON as history videos (chapters > lines > shots), so voice, timing, render, thumbnails and uploads are shared.
import { COSTUMES, POSES, SCENES, ICONS } from './plan.mjs';
import { boardPlanPrompt } from './boardprompt.mjs';

export const EXAM_SHOTS = ['eq', 'steps', 'quiz', 'mistake', 'diagram', 'sim', 'react', 'write', 'anime'];
export const EXAM_STYLES = ['chalk', 'whiteboard', 'count', 'news', 'cartoon', 'paper', 'board'];
export const VIDEO_TYPES = {
  mistakes: 'Common mistakes: the trap, why students fall in it, the right method, a quick check',
  concept: 'Concept explained: intuition first, then the formula, a mini example, the classic trap',
  pyq: 'Exam-style question solved: pause-and-think question with options, countdown, step-by-step solution, shortcut',
  trick: 'Trick or shortcut: the long way vs the fast way, when the trick works and when it fails',
  quiz: 'Quiz: one sharp question, countdown, reveal, 1-line explanation, "comment your answer"',
  formula: 'Formula revision: 4-8 must-know formulas with when to use each',
  strategy: 'Preparation strategy: plans, timetables, how to cover the syllabus, mock tests, revision cycles',
  tips: 'Exam-day and exam-hall tips: time management, attempt order, avoiding negative marking',
  books: 'Best books and resources: honest pros and cons of standard books (NCERT first), when to use which',
  notes: 'How to make notes, short notes, formula sheets, error logs and revision',
  motivation: 'Mindset: dealing with backlogs, low mock scores, burnout, consistency (practical, no empty hype)',
};

export const LANG = {
  hinglish: `LANGUAGE: Hinglish, written in ROMAN script, the way top Indian JEE/NEET teachers talk on YouTube: Hindi sentence flow with English technical words ("Dekho, yahan ninety percent students galti karte hain. Wo sochte hain ki top par acceleration zero hai. Galat!"). Short punchy sentences. Address the viewer as "aap" or "tum" consistently. All ON-SCREEN text (labels, heads, quiz questions and options, list items, title, thumbText) is in clear English so it is readable for everyone; formulas are LaTeX.`,
  english: `LANGUAGE: simple, energetic Indian English, like a favourite teacher. Short punchy sentences. On-screen text in English; formulas are LaTeX.`,
  hindi: `LANGUAGE: Hindi in DEVANAGARI script for "say", with English technical terms kept in English (e.g. "acceleration", "NCERT"). ON-SCREEN text stays English; formulas are LaTeX.`,
};

export const DIRECT = `VOICE DIRECTION (the narrator is a real teacher's cloned voice on ElevenLabs v3, which ACTS on audio tags): make it sound like a HIGH-ENERGY, warm YouTube teacher talking live to one student, never a calm narrator reading. Keep the energy UP from the first word to the last: punchy short sentences, exclamations, rising curiosity, a smile in the voice.
- Start most lines with ONE audio tag in square brackets that sets the delivery: [curious], [excited], [serious], [surprised], [confident], [warm], [whispers] (for a secret trick), [laughs] or [chuckles] (light moments), [sighs] (at most once per video, for a common mistake), [emphatic], [energetic], [enthusiastic], [playful]. Most lines should use an upbeat tag ([excited], [energetic], [enthusiastic], [confident], [playful], [surprised]); calm tags are the exception. Change emotion as the content changes; never more than one tag per sentence; never the same tag on 3 lines in a row.
- Use "..." for a natural thinking pause ("Pause karo... socho..."), a dash for a quick break, and CAPITALS for at most ONE stressed word in a line ("acceleration ZERO nahi hota").
- Talk TO the student: questions, "dekho", "suno", "yaad rakho", light humour. Short sentences.
- Tags and stress are only in "say"; never inside on-screen text, formulas, quiz options or "at"/"reveal" words ("at" words must be plain words of the line).`;

export function examPlanPrompt({ format, topic, channel, minutes, angle, info = {}, language = 'hinglish', brief = null, media = [], narration = null, direct = false, look = 'mix' }) {
  if (look === 'board') return boardPlanPrompt(arguments[0]);
  const long = format === 'long', words = long ? Math.round(minutes * 150) : 120;
  const m = /^\s*([A-Za-z]+)\s*\|\s*([^|]+)\|\s*(.+)$/.exec(topic || ''), vtype = m && VIDEO_TYPES[m[1].toLowerCase()] ? m[1].toLowerCase() : null;
  return `You are the head teacher, writer and video director of the YouTube channel "${channel}" for IIT JEE (Main + Advanced) and NEET aspirants. Plan ONE ${long ? `long video of about ${minutes} minutes (${words} spoken words, ±10%)` : 'YouTube Short / Instagram Reel of 40-55 seconds (100-130 spoken words)'}.
Topic: ${m ? m[3].trim() : topic}${m ? `\nSubject / area: ${m[2].trim()}` : ''}${vtype ? `\nVideo type: ${vtype} - ${VIDEO_TYPES[vtype]}` : `\nVideo type: pick the best one for the topic from: ${Object.keys(VIDEO_TYPES).join(', ')}`}${angle ? `\nAngle: ${angle}` : ''}${info.niche ? `\nChannel focus: ${info.niche}` : ''}${info.audience ? `\nAudience: ${info.audience}` : ''}${info.tone ? `\nTeacher's tone: ${info.tone}` : ''}
${brief && brief.title ? `\nThe creator chose this exact video TITLE (use it unchanged as "title"): ${brief.title}` : ''}${brief && brief.prompt ? `\nThe creator's brief (follow it closely): ${brief.prompt}` : ''}
${media.length ? `\nTHE CREATOR'S OWN MEDIA (use every item at least once): ${media.map(x => `${x.id} (${x.kind}): ${x.desc || x.name}`).join('; ')}. Photos go in "img" of photo/headline shots; videos as {"type":"clip","clip": id,"from": second}.` : ''}
${narration ? `\nFIXED NARRATION: use EXACTLY this narration as the "say" text, split into lines at sentence boundaries, in order:\n"""${narration}"""` : ''}

${LANG[language] || LANG.hinglish}
${direct ? DIRECT : ''}

SPOKEN SYMBOLS: "say" is read aloud by a voice, so write symbols the way a teacher SAYS them: products of letters as separate capitals ("M G", "M V", "K X", "Q E"), never "mg" or "mv" glued together; "v squared", "a equals g", "F net", "delta x", "by" or "divided by" for fractions. Units in words ("nine point eight metres per second squared"). Formulas still go on screen as LaTeX.

ACCURACY IS NON-NEGOTIABLE (students trust this channel with their rank):
- Every formula, number, unit, sign convention, answer option and solution step must be correct. Re-derive each answer before writing it. Use SI units. NEET biology follows NCERT wording.
- Never invent past-paper facts. Say "JEE Main level" / "NEET-style question" unless you are certain of the exact year and paper. No made-up statistics (cut-offs, weightages, success rates); if you mention one, keep it approximate and well known ("roughly", "aksar").
- Books and resources: only real, standard ones (NCERT, H.C. Verma, D.C. Pandey, I.E. Irodov, Cengage, O.P. Tandon, N. Awasthi, M.S. Chouhan, J. D. Lee (simplified), R.D. Sharma, S.L. Loney, Trueman's for biology, previous-year paper books) with honest when-to-use advice. NCERT first, always.
- Strategy advice must be practical and realistic (no "study 16 hours a day"). Be kind; never shame students.

RETENTION (viewers must watch to the very end):
1. Line 1 is a hook in under 3 seconds with stakes: marks, rank, time, a shocking wrong belief ("Ye ek galti aapke 4 marks kha jaati hai."). No greetings, no "is video mein".
2. ${long ? 'In the first 20 seconds promise a payoff that only comes at the end (the best trick, the hardest question) and pay it off.' : 'The last line flows back into the first so the Short loops, or ends with a direct challenge: "Comment karo apna answer".'}
3. Something changes on screen every 2-4 seconds: each line (8-25 words) gets 1-3 shots; later shots cut on a word of that line ("at").
4. Make the viewer THINK: at least one "pause and think" moment with a quiz shot (countdown, then reveal). Contrast wrong vs right with mistake shots. Show formulas being written (eq), solutions step by step (steps), and physics/chemistry/biology/maths visually (diagram).
5. ${long ? 'Chapters end on a question or tease. The last chapter is a fast recap (count style list or formula eq shots) and the very last shot is {"type":"end"} in a "news" chapter.' : 'No chapter titles, no end card. Tight and fast.'}
6. SHOW, DON'T WRITE. Students scroll past walls of text. Rules:
   - At least 40% of shots are ANIMATED SCENES ("draw") or animated diagrams; at most 20% are plain text/punch shots, never two in a row, never as the first shot of the main chapter.
   - On-screen words are few: punch 2-4 words, labels 1-3 words, text cards max 6 words. The narration carries the explanation; the screen SHOWS it.
   - Every concept gets a REAL-LIFE EXAMPLE acted out with characters and moving objects, from Indian everyday life: a cricket ball hit for a six (projectile), a phone slipping off a table (free fall), a bike braking (friction, deceleration), a lift going up (apparent weight), a Diwali rocket (thrust, momentum), an apple falling (gravity), a pressure cooker (gas laws), a mobile charging (current, battery), a doctor with a stethoscope (heart, circulation). Show the motion, then the formula, then the trap.
   - Use the physics "path" on props so things move the way they really do (see draw below): a thrown ball traces a parabola with a dotted trail, a dropped phone speeds up, a launched rocket slows near the top.
   - Diagrams build up piece by piece automatically (each top-level SVG element appears in order), so order the SVG elements in the order you talk about them.
   - Strategy/books/notes/tips videos: students and teachers acting it out (a student at a desk with books and a clock, a timetable, a mock test), list/count recaps.

STYLES (one per chapter; each changes the whole look), all flat 2D animation:
- "anime" : 80s cel-animation look (sunset sky, speed lines, bold colours). Perfect for the HOOK and dramatic reveals ("dono SAATH girte hain!") and real-life action scenes (a cricket shot, a rocket launch).
- "cartoon" : flat colourful cartoon world where characters act out real-life examples (street, home, exam hall, cricket ground).
- "rubberhose" : bouncy black-and-white 1930s-style cartoon, great for funny mistakes and traps.
- "paper" : paper cut-out props, good for lists, tips, books, notes.
- "chalk" : green chalkboard for formulas, solutions and diagrams. "whiteboard" : marker board with hand-drawn scenes.
- "count" : giant numbers for top-N lists and recaps. "news" : bold red/yellow hook and end cards. "board" : cork board for strategy plans.
${long ? 'Long: 6-8 chapters mixing looks, e.g. anime (hook) → cartoon (real-life example) → chalk (formula + diagram) → rubberhose (the trap) → whiteboard (solved question) → count (recap) → news (end).' : 'Short: exactly 2 chapters: a hook chapter in "anime" (or "news"), then the main chapter in "cartoon" (real-life example + formula + diagram) or "chalk" (solution-heavy). Exam shots (eq, quiz, mistake, diagram, steps) work in every style.'}

SHOT TYPES:
Exam shots (any style):
- eq {tex: LaTeX formula (display math, no $ signs, escape backslashes for JSON: "\\\\frac{1}{2}mv^2"), label?: "SHORT CAPTION" (e.g. "WORK-ENERGY THEOREM"), box?: true for the key formula to remember, hl?: "red"|"green"|"blue"}
- steps {head?: "SOLUTION"|"SHORTCUT"|..., items: [["LaTeX step", "cut word"], ...] 2-5 steps; each appears when its cut word (a word of this line's "say") is spoken}
- quiz {q: "question in English, max 25 words", tex?: LaTeX shown under the question, opts: ["option", ...] 2-4 short options (may contain plain text units like 4.3 m/s^2 written as text), ans: index of the correct option, reveal: a word of THIS line's "say" when the answer is revealed. Write the line like: "Socho... teen, do, ek... answer hai option B!" and use "B" or "answer" as reveal}
- mistake {head?: "COMMON MISTAKE", wrong: "short wrong belief", right: "short correct statement", wtex?: LaTeX for the wrong version, rtex?: LaTeX for the right version, reveal: word of this line when the RIGHT panel appears}
- diagram {d: diagram id, label?: "SHORT CAPTION"} : a vector diagram you draw yourself in "diagrams" (see below)
- react {who: "student" | "studentgirl" | "teacher" | "doctor" | "cricketer", emotion: happy | laugh | shock | scared | worried | determined | explain | serious | cheeky | suspicious | angry | calm | panic | tired | proud | thinking, text?: "1-3 WORDS" (e.g. "NAHI!", "WAH!", "GALAT!"), side?: "left" | "right"} : an anime-style CLOSE-UP of a character's face bursting onto the screen for a big reaction (the moment the trap is revealed, the answer lands, a shocking fact). Use 1-3 per Short, 4-8 per long video, never two in a row. The same "who" always looks the same.
- sim {preset, ...params, flash?: "2-4 WORD REVEAL"} : a REAL PHYSICS SIMULATION with live readouts (time, speed, range, period, momentum), the strongest proof on screen. Use it whenever mechanics is involved:
    drop {masses:[1,5], h: metres} (two masses fall and land together) · projectile {v: m/s, angles:[30,45,60]} (paths, ranges; 45 goes farthest) · pendulum {L: m, theta: degrees} (T = 2 pi root L by g) · spring {k: N/m, m: kg, A: m} (SHM) · collision {m1, m2, v1, v2: m/s, e: 0-1} (momentum before = after) · incline {angle: degrees, mu} (slides with a = g(sin - mu cos) or stays) · dominoes {n} / pile {n} (spectacle hooks).
    Pick parameters whose numbers you also say in the narration, so screen and voice agree (e.g. "paanch metre se girao: one point zero one second").
General shots:
- punch {text: 2-6 WORDS UPPERCASE} slam card · text {lines: [1-3 short lines], red?: index, stamp?: 1-2 words} · stat {value: number, prefix?, suffix?, label}
- list {head?, items: [["ITEM", "cut word"], ...] 2-4 items}
- black {text} silent beat (max once) · photo {img, label} only for real photos you request in "images" (scientists, real apparatus, NCERT-style real photos)
- num (count style) {n} ; countintro (count style) {text: e.g. "5 BOOKS", sub}
- end (news style, long only) {}
- draw (any style) {scene: one of ${SCENES.join(', ')} ("blank" on boards, "city"/"road" for streets and traffic, "village"/"mountains" outdoors), els: [3-7 elements]} an ANIMATED real-life scene:
    {"k":"char","id","costume": "student" | "studentgirl" | "teacher" | "doctor" | "cricketer" (modern people; avoid the historical costumes),"x":0-1,"pose": one of ${POSES.join(', ')},"from":[x0] to walk/run in,"face":"left"|"right","talk":true,"hold": icon}
    {"k":"prop","icon": one of ${ICONS.join(', ')},"x","y"?: 0-1 (omit = on the ground),"size": 0.3-1.4,"from":[x0,y0],"path": "throw"|"fall"|"up"|"line","h"?: arc height 0.1-0.45 for throw,"dur"?: seconds} : with "path" the object moves like real physics with a dotted trail (cricketball "throw" from the batsman to far right; phone "fall" from table height y0 0.55 to the ground; rocket "up" from the ground to y 0.1)
    {"k":"label","text":"1-3 WORDS","x","y","big"?} · {"k":"arrow","from":[x,y],"to":[x,y]} (forces, velocity) · {"k":"bubble","of": char id,"text":"max 6 words"} · {"k":"count","value","label","x","y"}
  Each element may have "at": a word of the line when it appears, so the scene unfolds with the narration.
  PAINTED BACKGROUND: give most draw scenes a "bg": a short description of an ORIGINAL background painting for that place, in English, WITHOUT people and WITHOUT any text (e.g. "a Kota hostel room at night with a study lamp, books and a window", "a cricket stadium under a golden evening sky", "a rooftop terrace in an Indian city at sunset"). Reuse the exact same bg text for the same place so it stays consistent. Never name real artists, studios, films or characters.
GRAPHICS LAYER: any shot may add "gfx": 1-2 overlays that MEAN something: {"k":"badge","text","x","y"} · {"k":"stamp","text","x","y"} (e.g. "-4 MARKS", "JEE FAVOURITE") · {"k":"counter","value","suffix"?,"label","x","y"} · {"k":"bars","items":[["LABEL",value],...],"x","y","w","h","title"?} · {"k":"pie","value","label","x","y"} · {"k":"arrow","from":[x,y],"to":[x,y]} · {"k":"circle","x","y","r"} · {"k":"particles","kind":"confetti"} for a correct answer. No decorative filler.
Every shot may add "sfx": impact, hit, whoosh, whooshbig, pop, stamp, ding (correct answer), alarm (mistake), riser (before a reveal), type, none.

DIAGRAMS ("diagrams": [{"id":"d1","svg":"<svg viewBox='0 0 800 500' xmlns='http://www.w3.org/2000/svg'>...</svg>","alt":"what it shows"}]):
- Plain SVG you write by hand: line, polyline, path, rect, circle, ellipse, polygon, text, g with transform, defs/marker for arrowheads. No scripts, no images, no external links, no CSS classes.
- Colours: use ONLY these exact tokens as fill/stroke values: INK (main lines and text), RED, GREEN, BLUE, ACC (highlight), and "none". They are swapped for the board's colours. Never use other colours, never a background rectangle.
- viewBox ${long ? "'0 0 800 500'" : "'0 0 600 600'"}; stroke-width 4-7; text font-size 30-44, font-family Arial; leave 30px margin.
- Keep it simple and exactly right: free-body diagrams (block, incline, forces as labelled arrows with arrowheads), circuits (battery, resistors as zigzags, capacitor plates, arrows for current), ray diagrams (lens/mirror, principal axis, rays), graphs (axes with arrowheads, labelled, curve as path), projectile paths, vectors, simple molecules (skeletal lines with atom labels), cell/organ outlines with label lines. Label every important part.

Return ONLY this JSON (no markdown):
{"domain": "exam",
 "title": "YouTube title, max 70 chars, curiosity + benefit (e.g. 'This 1 Mistake Costs JEE Aspirants 4 Marks | Projectile Motion')",
 "description": "YouTube description: 2-3 short paragraphs (Hinglish/English) + 4-6 hashtags like #JEE #NEET #Physics",
 "tags": ["8-15 tags"],
 "next": "teaser for the next video (short)",
 "thumbText": "2-4 WORD THUMBNAIL TEXT, punchy (e.g. '90% GET THIS WRONG', 'STOP DOING THIS')",
 "thumbImg": null,
 "op": "short label, e.g. PHYSICS · KINEMATICS",
 "ticker": ["3-5 short UPPERCASE key facts or formulas in words"],
 "images": [] or [{"id": "img01", "want": "exactly what the photo must show", "queries": ["2-3 Wikimedia Commons search queries"], "historical": false}] (0-4 real photos, only if they genuinely help),
 "diagrams": [...],
 "places": [], "route": null, "board": [], "highlight": [],
 "chapters": [{"style": "chalk", "mood": "curious"|"tense"|"suspense"|"rise"|"drama"|"outro", "title": null or ["PART 1", "SHORT NAME"], "lines": [{"say": "...", "shots": [{"type": "...", ...}, {"at": "word", "type": "...", ...}]}]}]}

Limits: ${long ? '5-7 chapters (the first one has title null), 45-80 lines, 4-10 diagrams' : 'exactly 2 chapters with title null, 6-11 lines, 0-3 diagrams'}. Every "d" must exist in "diagrams"; every "img" in "images".`;
}

export function examTopicsPrompt({ name, niche, audience, existing = [], n = 12 }) {
  return `You research video ideas for "${name}", a YouTube channel for IIT JEE and NEET aspirants (channel focus: ${niche || 'JEE and NEET preparation'}; audience: ${audience || 'class 11-12 students and droppers preparing for JEE/NEET'}).
Suggest ${n} NEW video ideas that students actually search for and that make great, fast, visual videos. Mix them: about 60% subject videos (physics, chemistry, maths for JEE, biology for NEET; types: mistakes, concept, pyq, trick, quiz, formula) and 40% preparation videos (types: strategy, tips, books, notes, motivation). Cover high-weightage chapters, classic traps, and timely topics (board + JEE balance, last 30 days plan, mock test analysis).
Avoid these (already used or queued): ${existing.slice(-80).join(' ; ') || 'none'}.
Return ONLY a JSON array of strings, each formatted exactly "type | Subject: Chapter | specific video idea", e.g. "mistakes | Physics: Projectile Motion | 5 sign mistakes that cost marks in projectile questions", "books | Chemistry: Organic | Which organic chemistry book after NCERT, honestly", "quiz | Biology: Cell | One NEET question most students get wrong about mitochondria".`;
}

// keep diagrams safe and simple: drop scripts, event handlers, external refs, images and foreign objects
export function sanitizeSvg(svg) {
  let s = String(svg || '').trim();
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) return null;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '').replace(/<image\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/(xlink:)?href\s*=\s*("|')\s*(?!#)[^"']*\2/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  return s.length > 40000 ? null : s;
}
