# Comic Book — demo notes

The demo (`demo/main.js`, study only) tells a JEE myth as a three-panel page: a classmate claims numericals have
negative marking, the hero panel shouts "WHAT?!", the last panel shows the real rule on signs inside the picture.

How it is built with the kit (`demo/comic.js`):
- `paper()` newsprint ground, `layout()` stacks panels (portrait: 3 rows; landscape: 2 + 1), `panel()` clips each
  panel's art and draws the ink border, popping in with a small scale.
- Art: flat fills with `ink()` outlines and Ben-Day `dots()` shading; original characters with `person()`
  (moods: happy, shock, angry, sad, think; arm raise; mouth open for lip-sync).
- Words in the picture: `caption()` yellow narration box, `balloon()` speech / thought / shout, `sign()` for numbers
  and rules, `sfx()` for one sound-effect word on the impact beat; `speed()` lines behind the shock.
- Camera: `camPan()` moves across the page and never shows the page edge; `pageTurn()` between scenes; `print()`
  adds the paper tooth over the final frame; `subtitle()` is the bottom caption strip.

Do NOT reuse the demo's story, panels or lines; build each video's own page from its plan.
