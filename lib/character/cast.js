// A character video's cast (plan.cast: 1-3 people Claude designed for the script). Before anything else is made, one photo
// of each is shown to the owner; frames and clips are made only when every cast member is approved, and changing a
// character needs a new approval. The photos stay in the job (jobs/<id>/char/cast/<cast id>.png) and are the references
// that keep each face the same in every frame and clip.
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import { ROOT } from '../store.js';
import { generateImage } from '../gemini.js';
import { castPhotoPrompt } from './prompts.js';

export const PIPELINE = { classic: 'classic', character: 'character' };
export const pipelineOf = value => value === PIPELINE.character ? PIPELINE.character : PIPELINE.classic;

export const castOf = plan => (plan && Array.isArray(plan.cast) ? plan.cast : []);
export const castPhoto = (jobDir, id) => path.join(jobDir, 'char', 'cast', id + '.png');
export const castRefs = (jobDir, members) => members.map(m => castPhoto(jobDir, m.id)).filter(f => fs.existsSync(f));

// identifies a character's description: an approval is valid only for the description it was given for
export const castKey = m => crypto.createHash('sha1').update(JSON.stringify([m.name, m.role, m.look, m.voice, m.setting])).digest('hex').slice(0, 12);
export const isApproved = (job, m) => !!(job.castOk && job.castOk[m.id] === castKey(m));
export const castApproved = job => castOf(job.script).length > 0 && castOf(job.script).every(m => isApproved(job, m));

// drops approvals whose character has changed since (a note, a plan edit); returns the names that need a new look
export function dropStaleApprovals(job) {
  const stale = castOf(job.script).filter(m => job.castOk && job.castOk[m.id] && !isApproved(job, m));
  for (const m of stale) delete job.castOk[m.id];
  return stale.map(m => m.name);
}

// the photos the owner checks (cached by the description, so an unchanged character costs nothing)
export async function makeCastPhotos(job, log = () => {}) {
  const dir = path.join(ROOT, 'jobs', job.id);
  for (const m of castOf(job.script)) {
    const r = await generateImage({ prompt: castPhotoPrompt(m), aspect: '1:1', size: '1K', jobId: job.id, out: castPhoto(dir, m.id) });
    if (!r.cached) log(`cast: photo of ${m.name} made ($${r.usd.toFixed(2)})`);
  }
}
