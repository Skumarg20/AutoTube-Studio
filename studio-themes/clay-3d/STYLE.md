# Clay 3D — Style Prompt

> Hand-made plasticine models on a small tabletop set, shot like a stop-motion film: soft matte clay with
> fingerprints and tool marks, round chunky characters with big bead eyes, a curved paper backdrop, warm
> key light and soft real shadows. Motion steps "on twos" (12 poses a second) like real stop motion.
> References (grammar only, nothing copied): tabletop claymation and plasticine Shorts in general. Every
> character, set and prop is original.

## 1. The set
- One small **tabletop world** per scene: a coloured clay floor disc or slab on a seamless curved paper
  backdrop (`stage()`), never an endless 3D void.
- Props are simple clay shapes: blobs, rolled snakes, flattened discs, rounded boxes (`blob()`, `roll()`,
  `slab()`). 3–8 props per set. Text or numbers live on a clay sign or a paper card in the set (`card()`).

## 2. Clay material
- Every object uses `clay(color)`: matte (roughness 0.85+), slight sheen, a fingerprint/thumb-press bump
  texture, tiny colour wobble. Never glossy plastic, never metal, never glass.
- Saturated but soft palette from `PAL` (two or three main colours per set plus neutrals).

## 3. Characters
- `character()` builds an original clay figure: pear-shaped body, ball head, bead eyes with highlights,
  little stub arms and feet. Faces change by swapping mouth shapes and brows (`setFace()`), like
  replacement faces in real stop motion. Big heads, readable silhouettes.
- Characters squash and stretch a little on landings and jumps (`squash()`).

## 4. Light and camera
- Warm key light from the upper left with soft shadows, cool fill, a rim light (`lights()`).
  Shallow depth of field feeling: background a little darker and softer.
- Camera: a slow dolly or orbit, low "table height" angle, gentle push-ins on the key moment. No fast
  whip pans. One move per shot.

## 5. Motion
- **Stop-motion timing:** quantize time to 12 fps with `stopTime(t)` for all character and prop motion
  (the camera may move smoothly). Add a tiny per-pose jitter (`boil()`), as hands re-touch the clay.
- Things appear by being "placed": drop in with a squash, or grow from a blob.

## 6. Subtitles
- Rounded clay-coloured pill (cream with a darker outline), bold rounded font, inside the frame
  (portrait: about 260 px above the bottom) — `subtitle()`.

## 7. Never
- Photoreal humans, plastic toy shine, sci-fi chrome, copyrighted characters, real brand logos,
  hard pure-black shadows, more than one camera move per shot.
