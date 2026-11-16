// History / documentary channels in Lemo Opuscar themes only (THEMES.md). Same plan JSON as every video; every visual chapter is a
// library theme. Directed themes are animated per video by lib/v2/director.mjs from each shot's "action", with the theme's own tools.
import { themeRules, themesFor } from './themes.mjs';

const LANGS = {
  english: 'LANGUAGE: clear, vivid spoken English for an international audience (many watch in English as a second language). Short sentences. On-screen text in English.',
  hinglish: 'LANGUAGE: Hinglish written in ROMAN script, the way popular Indian YouTubers talk: Hindi sentence flow with everyday English words. Short punchy sentences. On-screen text in English.',
  hindi: 'LANGUAGE: Hindi in DEVANAGARI script for "say" (keep common English terms in English). On-screen text in English.',
};
// domain: "history" (documentaries) or "general" (any subject: explainers, stories, facts, how-to, reviews, news...)
export function histPlanPrompt({ format, topic, channel, minutes, angle, info = {}, brief = null, narration = null, direct = false, recent = [], openers = [], domain = 'history', language = 'english' }) {
  const long = format === 'long', words = long ? Math.round(minutes * 150) : 120, gen = domain === 'general';
  return `You are the writer and director of the YouTube/Instagram ${gen ? '' : 'history '}channel "${channel}"${gen && info.niche ? ` (about: ${info.niche})` : ''}. Plan ONE ${long ? `${gen ? 'video' : 'documentary'} of about ${minutes} minutes (${words} spoken words, ±10%)` : 'YouTube Short / Reel of 40-55 seconds (100-130 spoken words)'}.
Topic: ${topic}${angle ? `\nAngle: ${angle}` : ''}${info.niche ? `\nChannel focus: ${info.niche}` : ''}${info.audience ? `\nAudience: ${info.audience}` : ''}${info.tone ? `\nNarrator's tone: ${info.tone}` : ''}
${brief && brief.title ? `\nThe creator chose this exact video TITLE (use it unchanged as "title"): ${brief.title}` : ''}${brief && brief.prompt ? `\nThe creator's brief (follow it closely): ${brief.prompt}` : ''}
${narration ? `\nFIXED NARRATION: use EXACTLY this narration as the "say" text, split into lines at sentence boundaries, in order:\n"""${narration}"""` : ''}

${LANGS[language] || LANGS.english}
${direct ? 'VOICE: the narrator is an ElevenLabs v3 voice that acts on audio tags; start most lines with one tag like [curious], [serious], [whispers], [excited], [awed]; never more than one per sentence.' : ''}

${gen ? 'ACCURACY: every fact, number, name, price, date and claim must be true and checkable; when sources disagree, say so. Advice must be safe and practical. No invented quotes, statistics or reviews. Opinions are clearly opinions.' : 'ACCURACY: only true, well-documented history. Dates, names, numbers and places must be right; when historians disagree, say so ("historians still argue..."). Legends are told as legends ("the story goes..."). No invented quotes.'}

STORY (viewers must watch to the end):
1. Line 1 is a hook with stakes or a mystery in under 3 seconds. No greetings.
2. ${long ? 'Promise a payoff in the first 20 seconds and deliver it near the end. Chapters end on a question or a turn.' : 'The last line loops back to the first or asks a question for the comments.'}
3. Something changes on screen every 3-6 seconds: each line (8-25 words) gets 1-2 scene shots; the second cuts on an "at" word of the line.
4. Show, don't tell: every scene's "action" says exactly what the viewer sees moving.

${themeRules(long, 'history', recent, openers)}

SHOT TYPE (every chapter of this video uses only this):
- scene {action: "REQUIRED: what happens on screen in 1-2 sentences, written for that chapter's theme (its look and grammar): who and what moves, the objects, the place, the light, and one camera move. It is animated by hand for THIS video with the theme's own tools, so describe a concrete, historically accurate image (period clothes, buildings, ships, tools).", text?: "1-4 WORD on-screen title or caption the theme would show (a date card, a place name, an intertitle)", img?: "image id from images, when the theme shows real archive material (newsreel, archive-lighttable, visual-investigation, kino-montage, satellite-briefing)", at?: "a plain word of this line where this shot starts (not for the first shot of a line)"}
Every shot may add "sfx": impact, whoosh, ding, none.

IMAGES: themes built on real material need real public-domain archive photos. Request them in "images" (0-8): [{"id": "img01", "want": "exactly what the photo must show", "queries": ["2-3 Wikimedia Commons search queries"], "historical": true}] and use the id in "img". Never request photos of things that have no real photo.

Return ONLY this JSON (no markdown):
{"look": "lib",
 "title": "YouTube title, max 70 chars, curiosity + benefit",
 "description": "YouTube description: 2-3 short paragraphs + 4-6 hashtags",
 "tags": ["8-15 tags"], "next": "teaser for the next video", "thumbText": "2-4 WORD THUMBNAIL TEXT", "thumbImg": null,
 "era": "e.g. 1920s, medieval, ancient, modern", "op": "short label, e.g. HISTORY · TRADE",
 "ticker": [], "images": [...], "places": [], "route": null, "board": [], "highlight": [],
 "chapters": [{"style": "one theme slug from THEMES above", "why": "one sentence", "mood": "curious"|"tense"|"suspense"|"rise"|"drama"|"outro", "title": null or ["PART 1", "SHORT NAME"], "lines": [{"say": "...", "shots": [{"type": "scene", "action": "...", "text": "..."}, {"at": "word", "type": "scene", "action": "..."}]}]}]}

Limits: ${long ? '50-90 lines' : '7-11 lines'}. Every "img" must exist in "images".`;
}
