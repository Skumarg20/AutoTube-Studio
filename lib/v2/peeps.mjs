// Close-up reaction faces from Open Peeps (Pablo Stanley, CC0 artwork) via DiceBear (MIT code).
// A small recurring cast so the same person looks the same in every video; emotions map to Open Peeps face expressions.
import fs from 'fs'; import path from 'path';

export const CAST = {
  student: { head: ['short3'], skinColor: ['d08b5b'], clothingColor: ['2f6bff'] },
  studentgirl: { head: ['long'], skinColor: ['d08b5b'], clothingColor: ['9b4dff'] },
  teacher: { head: ['short5'], skinColor: ['edb98a'], clothingColor: ['ffffff'], accessories: ['glasses'], accessoriesProbability: 100, facialHair: ['moustache1'], facialHairProbability: 100 },
  doctor: { head: ['medium1'], skinColor: ['edb98a'], clothingColor: ['e8f4ff'], accessories: ['glasses2'], accessoriesProbability: 100 },
  cricketer: { head: ['hatHip'], skinColor: ['ae5d29'], clothingColor: ['ffffff'] },
};
export const EMOTIONS = {
  happy: 'smileBig', laugh: 'smileLOL', shock: 'awe', scared: 'fear', worried: 'concerned', determined: 'driven', explain: 'explaining',
  serious: 'serious', cheeky: 'cheeky', suspicious: 'suspicious', angry: 'rage', calm: 'calm', panic: 'hectic', tired: 'tired', proud: 'lovingGrin1', thinking: 'solemn',
};
let lib = null;
async function load() { if (!lib) { const core = await import('@dicebear/core'), style = await import('@dicebear/open-peeps'); lib = { core, style }; } return lib; }

// writes img/peep_<who>_<emotion>.svg in the job folder and returns its relative path
export async function peep(dir, who, emotion) {
  const { core, style } = await load(), w = CAST[who] ? who : 'student', e = EMOTIONS[emotion] ? emotion : 'shock';
  const rel = `img/peep_${w}_${e}.svg`, file = path.join(dir, rel);
  if (!fs.existsSync(file)) {
    const svg = core.createAvatar(style, { seed: w, ...CAST[w], face: [EMOTIONS[e]], maskProbability: 0, ...(CAST[w].facialHair ? {} : { facialHairProbability: 0 }), ...(CAST[w].accessories ? {} : { accessoriesProbability: 0 }) }).toString();
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, svg);
  }
  return rel;
}
