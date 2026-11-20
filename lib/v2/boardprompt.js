// Exam channels (JEE / NEET): the teaching core is written live on the whiteboard theme (notes, LaTeX formulas, diagrams,
// quizzes, sims, solutions), and every other part of the video is drawn in whichever Lemo Opuscar theme fits that part best
// (all non-3D library themes; owner 2026-11-14). Same plan JSON as every other video.
import { LANG, DIRECT, VIDEO_TYPES } from './exam.js';
import { themeRules, themesFor } from './themes.js';

export function boardPlanPrompt({ format, topic, channel, minutes, angle, info = {}, language = 'hinglish', brief = null, narration = null, direct = false, recent = [], openers = [] }) {
  const long = format === 'long', words = long ? Math.round(minutes * 150) : 120;
  const m = /^\s*([A-Za-z]+)\s*\|\s*([^|]+)\|\s*(.+)$/.exec(topic || ''), vtype = m && VIDEO_TYPES[m[1].toLowerCase()] ? m[1].toLowerCase() : null;
  return `You are the best IIT JEE / NEET teacher and video director on YouTube, for the channel "${channel}". Plan ONE ${long ? `long class of about ${minutes} minutes (${words} spoken words, ±10%)` : 'YouTube Short of 40-55 seconds (100-130 spoken words)'}.
Topic: ${m ? m[3].trim() : topic}${m ? `\nSubject / area: ${m[2].trim()}` : ''}${vtype ? `\nVideo type: ${vtype} - ${VIDEO_TYPES[vtype]}` : `\nVideo type: pick the best one for the topic from: ${Object.keys(VIDEO_TYPES).join(', ')}`}${angle ? `\nAngle: ${angle}` : ''}${info.niche ? `\nChannel focus: ${info.niche}` : ''}${info.audience ? `\nAudience: ${info.audience}` : ''}${info.tone ? `\nTeacher's tone: ${info.tone}` : ''}
${brief && brief.title ? `\nThe creator chose this exact video TITLE (use it unchanged as "title"): ${brief.title}` : ''}${brief && brief.prompt ? `\nThe creator's brief (follow it closely): ${brief.prompt}` : ''}
${narration ? `\nFIXED NARRATION: use EXACTLY this narration as the "say" text, split into lines at sentence boundaries, in order:\n"""${narration}"""` : ''}

${LANG[language] || LANG.hinglish}
${direct ? DIRECT : ''}

SPOKEN SYMBOLS: "say" is read aloud by a voice, so write symbols the way a teacher SAYS them: products of letters as separate capitals ("M G", "M V"), never "mg" glued together; "v squared", "F net", "mu" for the friction coefficient, "by" for fractions; units in words. Formulas still go on the board as LaTeX.

ACCURACY IS NON-NEGOTIABLE: every formula, number, unit, sign, option and step must be correct; re-derive each answer before writing it. SI units. Never invent past-paper facts or statistics. Books: only real standard ones, NCERT first.

${themeRules(long, 'exam', recent, openers)}
HOW THE THEMES SPLIT THE WORK IN A JEE / NEET VIDEO:
${long ? '- "whiteboard" ONLY where written working is truly needed: a derivation, a multi-step solution, a diagram that must be built step by step, or a sim. Everything else (a single formula, a number, a fact, a quiz, a trap, a recap) is shown INSIDE the world of a fitting theme with scene shots whose "text" carries it (a formula chalked on a chalkboard, a quiz as a game show, a wrong-vs-right as a case file). At most 3 whiteboard chapters, and none at all if the topic needs no written working.' : `- A SHORT looks best told WITHOUT the whiteboard: show the formula, number, trap or answer INSIDE a fitting theme's own world (a formula chalked on a chalkboard, a number on a chart or a scoreboard, a quiz as a game show, a wrong-vs-right as a case file, a rule on a sign or a blueprint) using scene shots whose "text" carries the formula or number. Plan THIS Short with NO whiteboard chapter. Only if the idea truly cannot be understood without written working (a derivation or 2-4 numeric steps) may it have ONE short whiteboard chapter.`}
- Every other part gets the library theme that fits what that part is about, chosen fresh for this video: the real-life situation, the hook, a story of how a law was discovered, a lab or nature close-up, a circuit, a graph of data, a comparison of books or strategies, a countdown to the exam, a game-like challenge, a mystery, the "aha" moment. Read each theme's USE FOR above and pick by content.
- Clear, never confusing: one idea at a time, and each non-whiteboard chapter shows ONE clear thing that helps the student understand or remember. Talk like a real class; board phrases ("Dekho, main board pe likhta hoon...", "Isko box kar lo") only in whiteboard chapters.
TEACHING FLOW in whiteboard chapters, when there are any (clear, never confusing):
- ONE idea per board page. A page starts with a heading, then builds: intuition note -> real-life example (spoken, Indian everyday life: bus brake, cricket ball, lift, Diwali rocket) drawn as a SIMPLE line diagram -> formula -> a mini example -> the trap. Then the next page.
- Slow and clear: at most ONE new thing written per spoken sentence; the viewer must never feel lost. Say it, then write it. Recap the page in one sentence before moving on.
- Board notes are 2-7 words (key words, not sentences). The voice explains; the board keeps the summary a student would copy.
- Real-life examples are simple sketch diagrams (a box for the bus, a circle for the ball, arrows for forces; a tiny stick figure inside a diagram is fine).
- Mark mistakes like a teacher: write the wrong formula/belief with "ok": false (struck through with a red cross), then the right one with "ok": true (green tick). Box the key formula ("box": true).
- Pause-and-think: ${long ? '3-5 pause-and-think questions (question + options + 3-2-1 countdown + reveal), mostly asked inside other themes (a game-show board, a scoreboard, an exam hall) as scene shots; a quiz shot on the whiteboard only when the solution is then worked out there.' : 'ONE pause-and-think moment: a quiz shot on a whiteboard chapter, or (better in a Short) the question asked inside another theme, e.g. a game-show board with options and a countdown, as scene shots.'}${long ? ' When the answer needs working, solve it on the board with write or steps.' : ''}
- Mechanics: use a "sim" (a real physics simulation on the board: magnets are the moving bodies, the marker draws the trail) when it proves a point (${long ? '2-5 per video' : 'at most 1'}).


SHOT TYPES:
- write {new?: true to wipe and start a fresh page, els: [1-3 elements, each with "at": a plain word of THIS line when the hand starts writing it]} : the main shot (at least 75% of lines). Consecutive write shots keep writing on the SAME page until "new": true (a full page also wipes automatically). Elements:
    {"k":"h","text":"PAGE HEADING 1-4 WORDS"} (underlined; starts each page)
    {"k":"t","text":"short note, 2-7 words","col"?: "red"|"green"|"blue"|"acc","ok"?: true|false} (a bullet note; "->" arrows allowed)
    {"k":"tex","tex":"LaTeX (escape backslashes for JSON)","col"?: "red"|"green"|"blue","box"?: true,"ok"?: true|false}
    {"k":"dg","d":"diagram id"} (drawn stroke by stroke on the right half of the board; max 2 per page)
  A page holds about 6-7 notes/formulas plus 1-2 diagrams.
- quiz {q: "question in English, max 25 words", tex?, opts: [2-4 short options], ans: index, reveal: a word of THIS line when the answer is revealed ("Socho... teen, do, ek... answer hai option B!" with reveal "B")}
- steps {head?: "SOLUTION", items: [["LaTeX step", "cut word"], ...] 2-5 steps}
- sim {preset, ...params, flash?: "2-4 WORD REVEAL"}: drop {masses:[1,5], h} · projectile {v, angles:[30,45,60]} · pendulum {L, theta} · spring {k, m, A} · collision {m1, m2, v1, v2, e} · incline {angle, mu}. Say the same numbers in the narration.
- diagram {d, label?}: one diagram drawn big over the whole board (for a complex figure).
- anime {action: "REQUIRED: what happens on screen in 1-2 sentences: who and what moves, the objects (a bag, a lift, a cricket ball, a rocket...), where, and one camera move (crane, side track, rear view, held bust with light bands, insert close-up, extreme close-up on eyes). This scene is animated by hand for THIS video in the 80s OVA style, so describe a real, physically correct action, e.g. 'the lift cable snaps; the lift and the student fall together and she floats off the weighing machine, its needle dropping to zero'", expr: "determined" | "surprised" | "smileopen" | "smile" | "talk" | "neutral", bg: "night" | "dusk", fx?: "impact" (2-frame impact flash, radial lines, shake) | "speed" (radial speed lines), glint?: true (eye glint for the aha)} : ONLY in "cel-anime-80s" chapters, 1-2 per line (the second one cuts on an "at" word for the impact). The character's lips move with the voice automatically.
- scene {action: "REQUIRED: what happens on screen in 1-2 sentences, written for that chapter's theme (its look and grammar): what moves, the objects, the place, the light, and one camera move. It is animated by hand for THIS video with that theme's own tools, so describe a concrete, physically and scientifically correct image.", text?: "1-4 words, or ONE short formula or number (e.g. N = m(g + a), 72 kg, +4 / -1), that the scene shows inside its own world (a label, a sign, a screen, a page, a chalkboard, a scoreboard)", img?: "image id from images, only for themes built on real photos"}
- Which shots go where: "whiteboard" chapters use write, quiz, steps, sim, diagram. "cel-anime-80s" chapters use anime. EVERY OTHER theme's chapters use only scene shots.
"sfx" only where useful: ding (correct answer), alarm (mistake), riser (before a reveal), none. Keep it calm, no whooshes.

DIAGRAMS ("diagrams": [{"id":"d1","svg":"<svg viewBox='0 0 800 600' xmlns='http://www.w3.org/2000/svg'>...</svg>","alt":"what it shows"}]):
- Plain hand-drawable SVG: line, polyline, path, rect, circle, ellipse, polygon, text, g with transform, defs/marker for arrowheads. No scripts, images, links or CSS classes.
- Colours: ONLY the tokens INK, RED, GREEN, BLUE, ACC and "none" as fill/stroke (swapped for the board's marker colours). No background rectangle. Mostly INK outlines with fill "none", forces in RED/BLUE, one highlight in ACC.
- viewBox '0 0 800 600'; stroke-width 5-7; text font-size 34-44, font-family Arial; 40px margin. Top-level elements appear one by one in order, so order them the way you would draw them while talking (surface, block, then each force arrow with its label).
- Simple and exactly right: free-body diagrams, inclines, pulleys, lifts, circuits, ray diagrams, graphs with labelled axes, vectors, simple sketches of the real-life example.

Return ONLY this JSON (no markdown):
{"domain": "exam", "look": "lib",
 "title": "YouTube title, max 70 chars, curiosity + benefit",
 "description": "YouTube description: 2-3 short paragraphs + 4-6 hashtags like #JEE #NEET #Physics",
 "tags": ["8-15 tags"], "next": "teaser for the next video", "thumbText": "2-4 WORD THUMBNAIL TEXT", "thumbImg": null,
 "op": "short label, e.g. PHYSICS · LAWS OF MOTION", "ticker": [], "images": [] or real public-domain photos for themes built on real material ([{"id": "img01", "want": "exactly what the photo must show", "queries": ["2-3 Wikimedia Commons search queries"], "historical": true}]),
 "diagrams": [...], "places": [], "route": null, "board": [], "highlight": [],
 "chapters": [{"style": "one theme slug from THEMES above", "why": "one sentence", "mood": "curious"|"tense"|"suspense"|"rise"|"drama"|"outro", "title": null or ["PART 1", "SHORT NAME"], "lines": [{"say": "...", "shots": [{"type": "write", "new": true, "els": [{"k":"h","text":"NEWTON'S FIRST LAW","at":"pehla"}]}]}]}]}

Limits: ${long ? '55-85 lines, 6-12 diagrams' : '7-11 lines, 1-2 diagrams'}. Every "d" must exist in "diagrams".`;
}
