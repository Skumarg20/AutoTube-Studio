# Clay 3D — demo notes

The demo (`demo/main.js`, study only): a clay student holds up a ball and a leaf, lets go, the ball lands first,
then a mustard card drops in with the rule for a vacuum. About 7 seconds, portrait.

How it is built with the kit (`demo/clay.js`, three.js):
- `world(W, H)` makes the renderer, a curved paper backdrop, a clay table disc, warm key + cool fill + rim lights.
- Objects: `character()` (original clay figure with replacement faces `setFace()`, arms `setArm()`, speech `talk()`),
  `blob()`, `roll()`, `slab()`, `disc()`, all with the matte fingerprinted `clay()` material.
- Words live on `card()` signs inside the set. `place()` drops a prop in with a squash.
- Motion steps on twos with `stopTime(t)` and a tiny `boil()` re-touch wobble; the camera moves smoothly with `cam()`
  (portrait frames are pulled back automatically).
- `draw(world, S.g)` renders the 3D set onto the 2D frame with a lens vignette; `subtitle()` is the cream clay pill.

Do NOT reuse the demo's story, set or lines; build each video's own set from its plan.
