// Character pipeline: the words sent to Claude (planning) and to Gemini (photos, frames and clips). Pure functions, no I/O.
// A character video has a cast that Claude designs for THIS script (plan.cast: 1-3 people with name, role, look, voice).
// Every line says who speaks it and how:
//   line.speaker  - a cast id, or "narrator" (a line that belongs to nobody: the channel's narrator voice)
//   line.camera   - "on": the speaker is seen saying it (an Omni Flash clip, full screen)
//                   "off": only the voice is heard over the line's own shots (screens, graphics), and no person is shown
//   line.withWho  - other cast ids seen in an "on" clip (listeners); at most 2 people on screen in one clip
//   line.emotion, line.pitch, line.action, line.setting
// Rules the owner set: a voice-only line shows no people; a line someone is seen speaking has no other voice over it;
// a character's line always sounds in that character's voice, seen or not.

export const NARRATOR = 'narrator';
export const CAMERA = { on: 'on', off: 'off' };
export const EMOTIONS = ['neutral', 'friendly', 'happy', 'excited', 'confident', 'curious', 'surprised', 'worried', 'frustrated', 'angry', 'sad', 'relieved', 'serious'];
export const PITCHES = ['low', 'medium', 'high'];
export const MAX_CAST = 3, MAX_ON_SCREEN = 2, MAX_LINE_WORDS = 18;
const SPOKEN = { hinglish: 'Hindi (Hinglish: everyday English words stay in English)', hindi: 'Hindi', english: 'English' };
const PITCH_WORDS = { low: 'a low, deep pitch', medium: 'a natural mid pitch', high: 'a higher, lighter pitch' };

// seconds of clip a line needs at a natural talking pace (about 2.8 words a second) plus a short breath (Omni takes 3-15 s);
// a longer clip makes the actor drag the line out to fill it. Leftover silence at the ends is cut afterwards (clips.js).
export function clipSeconds(say) {
  const words = String(say || '').split(/\s+/).filter(Boolean).length;
  return Math.min(10, Math.max(3, Math.ceil(words / 2.8 + 0.8)));
}

// planner rules added to the plan prompt of a character video
export function characterPlanRules() {
  return `CHARACTER VIDEO: realistic AI actors speak their lines on camera (each such line is one 3-10 second clip with their own voice and lip-sync).
CAST: design 1-${MAX_CAST} characters that THIS script needs (e.g. a shopkeeper and a customer, or one CA explaining). Add to the plan:
"cast": [{"id": "c1", "name": "short first name", "role": "who they are in the story", "look": "gender, age, build, face, hair, clothes and one detail, in one sentence", "voice": "gender, age, tone, accent and manner, in one sentence", "setting": "their usual place in full words, specific and real (never \"same shop\" or \"same place\": name it)"}]
Chapters are the SCENES of the video. Every scene (chapter) also has:
- "place": the ONE real place where the whole scene happens, in full words (e.g. "inside Raju's kirana shop, at the counter, evening tube light").
- "blocking": where each character in the scene stands and what they hold, kept the same through the scene (e.g. "Raju behind the counter on the right; Meena in front of it on the left, a carton in her hands").
A scene keeps its place and positions from line to line; a character only moves when an "action" says so.
Every line has:
- "speaker": a cast id, or "${NARRATOR}" for a line that belongs to no character (a neutral explainer voice).
- "camera": "on" = the speaker is SEEN saying it (only for a cast speaker), "off" = only the voice is heard over the line's own scene shots.
- "withWho": other cast ids also seen in an "on" clip (a listener), [] when alone; at most ${MAX_ON_SCREEN} people on screen in one line.
- "emotion": one of ${EMOTIONS.join(', ')}. "pitch": one of ${PITCHES.join(', ')}.
- "action": for "on" lines, what the speaker does while speaking (gesture, expression, what they handle); "punch": one word of "say" to punch in on (the emotional or key word, e.g. "jeb", "bhool"), or null.
RULES:
- An "on" line has exactly "shots": [{"type": "character"}]. Nothing else is heard over it.
- An "off" line has its usual scene shots, and they show NO people or characters at all: only the real app screens, objects, icons, graphics and text.
- A character's line is always in that character's voice, also when "off" (heard over the screens).
- Use "on" for the hook, the pain, conversations, reactions and the call to action; use "off" for the product (real app screens, zoom) and for facts shown as graphics.
- "say" is exactly what is said out loud: natural and conversational, at most ${MAX_LINE_WORDS} words.
- The product is shown only through the real app screens in "off" lines; no character ever shows a readable phone or laptop screen.`;
}

const describe = m => `${m.name} (${m.role || 'a person'}; the person in their reference photo: same face, hair and exactly the same clothes): ${clean(m.look)}`;
// the clothes never change within a video: every frame and clip repeats the whole cast's outfits and allows nobody else
const wardrobe = (people, cast) => `WARDROBE (identical in every shot of this video, as in the reference photos): ${cast.map(m => `${m.name}: ${clean(m.look)}`).join('; ')}. Only ${people.map(m => m.name).join(' and ')} ${people.length > 1 ? 'are' : 'is'} in the frame; no other people.`;
const clean = t => String(t || '').trim().replace(/[\s.]+$/, '');   // no trailing full stop: phrases are joined into sentences
// the background: the scene's one place (or, for an older plan, the speaker's usual place)
const isReference = t => /^(the )?same\b/i.test(clean(t));   // "same shop": points at another character's place
const placeOf = (line, speaker, cast, scene = {}) => {
  if (scene.place) return clean(scene.place);
  const home = isReference(speaker.setting) ? (cast.find(m => m.setting && !isReference(m.setting)) || speaker).setting : speaker.setting;
  return [clean(home) || 'a real, everyday Indian setting', line.setting && `in this shot: ${clean(line.setting)}`].filter(Boolean).join('; ');
};
const continuity = scene => scene.blocking ? `CONTINUITY (same as the rest of this scene): ${clean(scene.blocking)}.` : '';
const castById = (cast, ids) => ids.map(id => cast.find(m => m.id === id)).filter(Boolean);
export const onScreenOf = (line, cast) => castById(cast, [line.speaker, ...(line.withWho || [])]).slice(0, MAX_ON_SCREEN);

// Nano Banana: a cast member's photo, approved by the owner; it is then the reference for every frame and clip
export function castPhotoPrompt(m) {
  return [
    `Photorealistic portrait of one person for a video production: ${m.name}, ${m.role || 'a person'}: ${clean(m.look)}.`,
    `Head and shoulders, looking straight into the camera, natural expression. Background: ${clean(m.setting) || 'plain light grey'}, softly out of focus.`,
    'Soft natural light, sharp focus, realistic skin. No text, no logos.',
  ].join('\n');
}

// Nano Banana: the first frame of an "on" line (shown on the storyboard, then animated by Omni)
export function keyframePrompt(line, cast, scene = {}) {
  const people = onScreenOf(line, cast), speaker = people[0];
  return [
    'Photorealistic vertical 9:16 frame from a modern Indian TV commercial.',
    ...people.map((m, i) => `${i ? 'Also in the frame' : 'Speaking'}: ${describe(m)}.`),
    `Place: ${placeOf(line, speaker, cast, scene)}.`,
    continuity(scene),
    wardrobe(people, cast),
    `Moment: ${clean(line.action) || `${speaker.name} looks into the camera`}, a moment before ${speaker.name} speaks; ${speaker.name} looks ${line.emotion || 'friendly'}.`,
    `Framing: ${people.length > 1 ? 'medium two-shot, both faces clearly visible' : 'medium close-up at eye level'}.`,
    'Natural light, sharp focus, realistic skin. A clean photograph: no text, words, stamps, icons, tick marks, stickers or graphics drawn into the picture, no logos, no phone or laptop screen facing the camera.',
  ].filter(Boolean).join('\n');
}

// Omni Flash: one line said by its speaker, in that character's fixed voice with the line's emotion and pitch.
// An "off" line is made as a close-up too, but only its sound is used (heard over the line's screens).
export function clipPrompt(line, cast, { seconds, language = 'english', scene = {} }) {
  const people = line.camera === CAMERA.on ? onScreenOf(line, cast) : castById(cast, [line.speaker]), speaker = people[0];
  return [
    `FORMAT: Vertical 9:16. One continuous shot, no scene cuts. ${seconds} seconds.`,
    `SCENE: ${placeOf(line, speaker, cast, scene)}.`,
    continuity(scene),
    ...people.map(m => `CHARACTER: ${describe(m)}.`),
    wardrobe(people, cast),
    `ACTION: ${line.camera === CAMERA.on && line.action ? clean(line.action) : `${speaker.name} talks to the camera`}.${people.length > 1 ? ` ${people.slice(1).map(m => m.name).join(' and ')} listens and reacts without speaking.` : ''}`,
    `CAMERA: ${people.length > 1 ? 'Medium two-shot, steady.' : 'Medium close-up at eye level, slow push-in.'}`,
    `DIALOGUE: ${speaker.name} says in ${SPOKEN[language] || SPOKEN.english}, ${line.emotion || 'friendly'}, ${PITCH_WORDS[line.pitch] || PITCH_WORDS.medium}, at the brisk, natural pace of a real person talking (not slow, no pauses between words), starting right away and finishing just before the end:`,
    `"${String(line.say || '').replace(/"/g, "'")}"`,
    `VOICE OF ${speaker.name.toUpperCase()} (same in every scene): ${clean(speaker.voice)}.`,
    `AUDIO: Only ${speaker.name}'s voice and soft natural room sound. No music. No other voices.`,
    'AVOID: No on-screen text, subtitles, stamps, icons or logos. No change of clothes. No phone or laptop screen facing the camera. Mouths closed when not speaking.',
  ].filter(Boolean).join('\n');
}

// every prompt this video sends, word for word, for the owner to read on the storyboard:
// { cast: { <id>: photo prompt }, lines: { <line id>: { seconds, frame?, clip?, narrator? } } }
export function videoPrompts(plan) {
  const cast = Array.isArray(plan.cast) ? plan.cast : [], lines = {};
  for (const scene of plan.chapters) for (const l of scene.lines) {
    if (!l.id) continue;
    const seconds = clipSeconds(l.say), byCast = cast.some(m => m.id === l.speaker);
    lines[l.id] = byCast
      ? { seconds, ...(l.camera === CAMERA.on ? { frame: keyframePrompt(l, cast, scene) } : {}), clip: clipPrompt(l, cast, { seconds, language: plan.language, scene }) }
      : { narrator: (l.emotion && l.emotion !== 'neutral' ? `[${l.emotion}] ` : '') + l.say };
  }
  return { cast: Object.fromEntries(cast.map(m => [m.id, castPhotoPrompt(m)])), lines };
}

// Claude: rewrite one cast member after the owner's note on their photo
export function castChangePrompt(m, note) {
  return `This is a character of a video: ${JSON.stringify({ name: m.name, role: m.role, look: m.look, voice: m.voice, setting: m.setting })}
The owner looked at their photo and wants this changed: ${note}
Return ONLY the updated JSON object with the same five keys. Change only what the note asks; keep everything else word for word.`;
}
