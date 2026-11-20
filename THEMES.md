# THEMES — the only looks AutoTube Studio may use

Source of truth: the Lemo Opuscar library at `<libraryPath>\styles\<slug>\` (libraryPath is in Settings; default `%USERPROFILE%\lemo-opuscar-src\lemo-opuscar-main`)
(each has `STYLE.md` = the rules of the look, `DEMO.md` + `demo/` = working source code, `style.json`, `poster.jpg`).

## The rules (set by the owner, 2026-11-13)

1. **Every video uses only themes from this list.** No home-made looks, no "simplified copies", no mixing in my own styles.
2. **Before building a video, read that theme's `STYLE.md` and `DEMO.md` and follow them** (materials, colours, type, motion, camera, transitions, what it is *not*). Use its demo source code as the starting point, not a re-drawing from memory.
3. **The plan shows the exact themes** (library slug + name) for every chapter, before anything is rendered, so the owner can check it.
4. **Nothing new without the owner.** A new theme, skill or custom style is added only when the owner says so; then it gets a row here.
5. If no theme fits a video, **stop and ask** instead of inventing one.
6. Lemo Opuscar is the base for picture and render. Voice (ElevenLabs), timing, quizzes, formulas, uploads stay AutoTube Studio's job, but they must be drawn *in the chosen theme's look*.
7. All themes are on, the 3D ones too (owner 2026-11-16: "band kyu hai on kro sab"). 3D themes are drawn with three.js (the page maps "three"). The studio also has its own themes in `studio-themes/<slug>` (STYLE.md, DEMO.md, demo/ kit): **comic-book** and **clay-3d** (owner 2026-11-16: "jo nhi hai wo add kro").

Default picks:
- **IIT JEE / NEET channels:** `chalkboard` (solved questions, traps, one-idea lessons) and `whiteboard` (concepts, "how does X work"). Optional: `dataviz` (graphs), `blueprint` (mechanics / devices), `midcentury-toon` (step-by-step how-to: notes, timetables), `isometric-picture-book` (exam-day rules, strategy).
- **History channels:** `newsreel`, `silent-film`, `ink-wash`, `ukiyoe`, `woodcut`, `engraving`, `shadow-puppet`, `stained-glass`, `watercolor`, `kino-montage`, `transit-map`/`satellite-briefing` for routes and places, `visual-investigation` for mysteries.
- **Shorts:** `caption-news`, `halftone-dossier`, `chalkboard` (one-idea trick), `microgame` (quiz Shorts).

## All 66 themes: what, when, why

Columns: **Theme** (slug) · **What it looks like** · **Use it for** · **Why / when it works** · **Fit** (J = JEE/NEET, H = history, S = Shorts).

### Hand-drawn & painting
| Theme | What it looks like | Use it for | Why / when | Fit |
|---|---|---|---|---|
| `chalkboard` | Real classroom blackboard, chalk writes itself stroke by stroke, no hand; write the wrong idea, wipe once, rewrite the truth in place | One-idea lessons, myth-busting, a worked problem | Feels like a real teacher; the write–wipe–rewrite move is perfect for "common mistake" videos | **J** S |
| `whiteboard` | Glossy dry-erase board, handwriting written stroke by stroke, floating markers, magnets, eraser, camera travels across a knowledge map | Concept explainers, online-course style, science "how it works" | Holds many connected ideas on one board; camera move keeps it alive for long videos | **J** |
| `watercolor` | Journal page that paints itself, translucent brush strokes, handwritten notes, no vector lines | Nature, travel, gentle science explainers | Calm and beautiful; good for biology (NEET) and soft history stories | H J |
| `crayon-book` | Wax crayon on toothy paper, watercolour wash reveals hidden parts | Kids' learning, bedtime stories | Warm, childlike; only for very light topics | — |
| `one-line` | One continuous ink line that never lifts; scenes morph instead of cut | Life milestones, minimal brand stories | Elegant for a single biography thread | H |
| `urban-sketch` | Sepia fineliner + loose watercolour, sketchbook drawn on location | Cities, architecture, travel | Places and monuments in history videos | H |
| `impasto` | Thick palette-knife oil paint, raked light | Emotional moments, art & culture | Dramatic peak of a story (a battle, a death) | H |
| `ink-wash` | Chinese xieyi ink on rice paper; one stroke = a mountain or a cut | Poetry, legends, martial stories | Great for Asian history and myths | H |

### Cartoon & anime
| Theme | What it looks like | Use it for | Why / when | Fit |
|---|---|---|---|---|
| `cel-anime-80s` | Hand-painted OVA cels, airbrushed backgrounds, neon, CRT playback | Music videos, nostalgia, dramatic hooks | High energy; only if the owner wants anime | (ask) |
| `midcentury-toon` | 1950s flat colour, limited animation, calm classroom narrator, "follow along" | How-to and set-up guides | Clear step-by-step: how to make notes, a timetable, an error log | J |
| `rubber-hose` | 1930s black-and-white inked cartoon, everything swings to jazz | Retro fun, kids, food | Comedy beats; rarely fits study content | — |
| `scifi-toon` | Adult sci-fi sitcom, thick boiling outlines, portal | Comedy, tech | Not for teaching | — |

### Graphic & type
| Theme | What it looks like | Use it for | Why / when | Fit |
|---|---|---|---|---|
| `blueprint` | White technical line work drawn in drafting order on Prussian blue | Engineering, hardware, tech explainers | Mechanics, machines, circuits, how a device works | J |
| `swiss-motion` | Strict grid, one typeface, one signal colour, precise motion | Design education, identity | Clean formula/list recaps | S |
| `art-deco` | Black lacquer, gold lines, 1930s poster on a centre axis | Galas, luxury | 1920s–30s history (jazz age, Raj-era palaces) | H |
| `ascii-crt` | Everything is characters on a monochrome CRT | Developer, sci-fi | Computer history only | — |
| `pictogram-motion` | Beat-locked square grid with pictograms | Public services, explainers by signs | Simple facts and rules without words | S |
| `spy-titles` | 60s cut-paper title sequence, brass stabs | Openers, trailers | Cold-war/spy history intros | H |
| `stained-glass` | Medieval window lit by moving sunlight in a dark hall | Legends, heritage, holidays | Medieval and religious history | H |

### Print & printmaking
| Theme | What it looks like | Use it for | Why / when | Fit |
|---|---|---|---|---|
| `engraving` | Copperplate burin lines, hatching builds up, proof pulled | Museum labels, science history | Scientists and inventions (Newton, Darwin) | H J |
| `woodcut` | Relief print carving itself, black block, one burning colour | Folk tales, dark stories | Myths, plagues, wars | H |
| `risograph` | 2–3 overprinted spot inks, halftone, misregistration | Indie, zines | Light lifestyle Shorts | S |
| `silkscreen-poster` | 4–6 flat inks pulled one colour at a time | Travel, events | Places and destinations | H |
| `halftone-dossier` | Retro case file, halftone dots, huge headlines, slamming stamps | Humour, social Shorts | Punchy fact/"case file" Shorts | S H |
| `printed-long-take` | Scratchboard world, one unbroken camera move, one red | Journeys, landscapes | Long journeys and expeditions | H |

### Information & keynote
| Theme | What it looks like | Use it for | Why / when | Fit |
|---|---|---|---|---|
| `dataviz` | Real data drawn mark by mark on cream paper with red–blue pencil, handwritten notes | Data stories, reports, science | Graphs: v–t, x–t, cut-off trends, rank vs marks | J H |
| `iso-infographic` | Isometric diorama of flat blocks, Isotype numbers, things open to show insides | Process explainers, supply chains | How a process works (chemistry plants, digestion) | J |
| `isometric-picture-book` | One real place in isometric, faceless people do things in order, serif type lands | Everyday rules, queues | Exam-day rules, strategy steps | J |
| `circuit-board` | Subject drawn as a PCB from above: traces, pads, silkscreen | Energy, devices, flows | Current electricity, flows of anything | J |
| `transit-map` | Metro schematic on paper, glowing pen draws lines | Networks, growth over time | Empires, trade routes, a syllabus roadmap | H J |
| `dark-keynote` | Near-black UI launch film, one accent, giant number | Product launches | Channel announcements only | — |
| `hologram-hud` | Object scanned to wireframe, target boxes, rolling numbers | Spec walkthroughs | Sci-fi feel; avoid for teaching | — |
| `living-screencast` | Real-looking screen recording with a pixel mascot | Software tutorials | App/tool tutorials only | — |

### Edit & documentary (need real footage/photos)
| Theme | What it looks like | Use it for | Why / when | Fit |
|---|---|---|---|---|
| `caption-news` | Real footage + huge captions chunk by chunk, keyword on yellow | Social news, data Shorts | Works with sound off; news-style Shorts | S |
| `news-package` | TV newsroom package: sting, rundown, lower third | News round-ups | Exam news (dates, notifications) | S J |
| `newsreel` | Late-1920s sound newsreel from archive material | History, eras | 1900–1950 history stories | **H** |
| `kino-montage` | Archive cut as one red constructivist poster on a machine beat | Industry histories, revolutions | Revolutions, industrial history | H |
| `city-symphony` | Time-lapse city cut like minimalist music | City films, openers | Openers about cities | H |
| `countdown` | Real event in real time, ticking clock, split screen | Launches, live events | Rocket launches, result-day countdowns | S |
| `telestrator` | Sports clip, rewind, freeze, draw rings and arrows on it | Sports analysis | Analysing a real clip (cricket physics) | J S |
| `visual-investigation` | Evidence on one shared clock: footage, documents, maps | Reconstructions, fact-checks | Historical mysteries, myth-busting with sources | H |

### Evidence films (real material, sourced numbers)
| Theme | What it looks like | Use it for | Why / when | Fit |
|---|---|---|---|---|
| `archive-lighttable` | Archive objects on a backlit table, a loupe brings one alive | Archive and museum stories | Letters, photos, old documents in history | **H** |
| `briefing-board` | Real whiteboard wall with cut-out photos, magnets, stamps, marker | Option comparisons, briefings | Comparing books/coaching options, strategies | J H |
| `data-physical` | Statistics built as real stacked objects in a studio | Reports, energy data | Big numbers made physical | — (3D) |
| `lidar-survey` | Laser point cloud of a real place condensing into a surface | Heritage sites, environment | Forts and ruins | H |
| `microscope` | Real microscopy, continuous zoom from slide to cell | Biomedicine, materials | NEET biology: cells, tissues | J |
| `satellite-briefing` | Real satellite imagery, measurement lines, one zoom | Climate, geography | Battlefields, places on Earth | H |
| `teardown` | Real product exploded from its CAD files | Hardware | Not for our channels | — (3D) |
| `white-model` | White massing model with data projected on it | Urban planning | City history with data | — (3D) |

### Materials & 3D (on since 2026-11-16)
| Theme | What it looks like | Use it for | Fit |
|---|---|---|---|
| `brick-toy` | Toy-brick stop motion on a desk | Toys, kids | — (3D) |
| `desktop-flythrough` | App screens as paper cards, voxel pixel characters, one camera flight | App workflows | — (3D) |
| `glass-product` | Glass product render, caustics, exploded views | Product launches | — (3D) |
| `lowpoly-island` | Faceted isometric world, bouncy arrivals | World building | — (3D) |
| `memphis-diorama` | Tabletop paper model in Memphis colours | Ambient loops | — (3D) |
| `paper-popup` | Pop-up book on a desk, paper actors | Children's stories | H (3D) |
| `tilt-shift` | Real place made to look like a miniature | City promos | — (3D) |

### Games
| Theme | What it looks like | Use it for | Fit |
|---|---|---|---|
| `game-show` | Rhythm-game variety show, mascots, judgement words | Year in review, timelines | S |
| `hd-2d` | Pixel sprites in a lit 3D diorama | Fantasy stories | — (3D) |
| `microgame` | Rapid-fire party games, each in a different art style | Quiz Shorts | S J |
| `pixel-rpg` | Mid-90s console RPG, text boxes, chip music | Recaps, nostalgia | S |

### East Asian traditions
| Theme | What it looks like | Use it for | Fit |
|---|---|---|---|
| `paper-lantern` | Layered paper-cut lightbox, warm light through holes | Journeys, farewells, places | H |
| `papercut-red` | Red Chinese window-flower paper-cuts come alive | Festivals, folk tales | H |
| `shadow-puppet` | Dyed-hide puppets on a lit cotton screen | Myths, folklore | **H** |
| `ukiyoe` | Edo woodblock prints, camera unrolls like a handscroll | Japan, poetry, travel | H |

## Status

As of 2026-11-13, every video made so far (19) used AutoTube Studio's own simplified looks; only the repo's renderer was used.
That is now forbidden. The engine must be rebuilt on the library themes before the next video, starting with
`chalkboard` + `whiteboard` for the JEE channel. Autoflows are paused until then.

## Owner decisions (2026-11-13)
- **No hand** on chalkboard/whiteboard: follow the library exactly (chalk and markers write by themselves).
- **Real footage is allowed:** download public-domain / licence-clean archive photos and footage for themes built on real material (newsreel, caption-news, archive-lighttable, kino-montage, visual-investigation...). Keep credits in CREDITS.txt.
- **I choose the theme per part of the video**, from this list, based on that part's text and content. The plan shows the choice and a one-line reason per chapter; the owner approves the plan.

## How the project is set up (2026-11-13)

- **Built themes (the only ones the app can render):** `whiteboard` (Whiteboard Explainer) and `cel-anime-80s` (80s Cel Anime), for long videos (1920x1080) and Shorts (1080x1920).
- **Every video goes through one page:** `engine/lib/mix.html` + `mix.js`. Each chapter is drawn by its library theme's own engine, imported unchanged from the library folder: `styles/whiteboard/demo/engine/wb.js`, and `styles/cel-anime-80s/demo/` (head80, pal, cel, fx, bg plates, post CRT pass). The director files (`engine/lib/whiteboard.js`, `anime.js`) only feed content and timing into those engines.
- **What Claude makes:** only the content: narration, board notes, formulas, diagram line drawings, quiz questions, and the choice of theme per chapter (with a reason shown in the plan). No looks, characters, backgrounds, thumbnail designs or effects of its own.
- **Thumbnails** are a frame from the video itself (the anime title frame or a boxed formula), not a separate design.
- **Sound:** your ElevenLabs voice, the whiteboard theme's marker/eraser foley, and the score.
- **Hard blocks in code:** approving a plan that is not a library-theme plan is refused; rendering anything that is not a built library theme for that format is refused (`lib/v2/build.js`, `LIB_BUILT`); channels without built themes (history) are refused at planning; the old template engine is retired.
- **Adding a theme:** only when the owner asks. Build its director over the library engine, add it to `LIB_BUILT`, `LIB_STYLES` (plan.js), the planner prompt, and this file.

## Theme rules for planning (lib/v2/themes.js)

Theme mixing is decided in PLANNING, not in the engines. `lib/v2/themes.js` lists every usable theme with its look, what it is
USED FOR, what it is NEVER FOR, the shots it accepts and its length, plus the mixing rules. The planner prompt
(`lib/v2/boardprompt.js`) is built from it, and every plan is checked against it (`checkThemes`, called from `lib/v2/plan.js`):
- every available theme is used at least once (twice each in long videos); a single-theme video is rejected;
- themes alternate by content type (drama/hook/reveal vs teaching); never two chapters of the same theme in a row;
- theme changes every 5-15 s in Shorts, every 1-2 min in long videos; 3-5 chapters (Shorts), 6-10 (long);
- each chapter uses only its theme's shots; every chapter carries a "why" (shown in the plan review);
- a plan that breaks a rule cannot be approved.
To add a theme: add one row to THEMES in `lib/v2/themes.js` (once it can be rendered). The rules then include it automatically.

## Per-video scene direction (owner decision, 2026-11-13) — replaces "nothing built by Claude"

Videos are made the way the Lemo Opuscar library makes its films (like `films/s-*` and the theme demos):
1. **Plan**: content + theme per chapter (theme rules above). Every anime shot carries an **action**: what happens on screen.
2. **Direct** (`lib/v2/director.js`, during the build): Claude reads the theme's `STYLE.md`, `DEMO.md`, the demo source and the finished
   film `films/s-cel-anime-80s`, then writes **this video's** anime scenes (`jobs/<id>/anime_scenes.js`) — only with the theme's own
   modules (`/styles/cel-anime-80s/demo/cel.js, head80.js, pal.js, fx.js, bg.js, hands.js`), deterministic, no network — renders test
   frames with the library's `still.mjs`, looks at them and fixes until they match STYLE.md.
3. **Check**: the file is rejected if it imports anything else, uses randomness/clocks, or loads anything external; the build then fails.
4. **Render**: whiteboard chapters by the whiteboard engine, anime chapters by the scene code just written, CRT tape pass by the theme.
Allowed: Claude writing scenes/objects/characters for a video **with the theme's own tools and rules**. Not allowed: any look, tool or effect from outside the library theme.

## All channels (2026-11-14, owner: "we have 66 themes and we need to use all based on the video")

- **Every channel can use every non-3D library theme (55 of the 66).** The planner picks a theme for each chapter from what that part is about, varies them between videos (it is told the channel's recent themes), and gives a reason. 3D themes stay out unless the owner asks.
- **JEE/NEET:** `whiteboard` (engine) carries everything that is WRITTEN: formulas, derivations, quizzes, sims, solutions. Every other part uses the best-fitting theme (chalkboard, microscope, circuit-board, dataviz, blueprint, cel-anime-80s, countdown, game-show...).
- The list is built in `lib/v2/themes.js` from the hand-written rows there plus `lib/v2/catalog.js` (generated from the table above).

## All channels (2026-11-13, replaced by the section above)

- **JEE/NEET (exam)**: `whiteboard` (engine) + `cel-anime-80s` (directed). Planner: `lib/v2/boardprompt.js`.
- **History and any-topic channels**: 16 documentary themes from the library — newsreel,
  silent-film, archive-lighttable, visual-investigation, kino-montage, transit-map, satellite-briefing, shadow-puppet, ink-wash,
  ukiyoe, woodcut, engraving, stained-glass, paper-lantern, papercut-red, watercolor — plus cel-anime-80s for action/drama.
  Planner: `lib/v2/histprompt.js` (shot type `scene` with an `action`, optional `text` and archive `img`).
  At least 2 themes per Short and 3 per long video (4-6 best), alternating, each with a "why".
- **Directed themes** are animated per video by `directScenes` in `lib/v2/director.js` → `jobs/<id>/scenes.js` (imports only
  `/styles/<theme>/demo/*.js` of the themes used, or `/core/lib.js`; exports one function per shot + each theme's subtitle style).
- The theme list and rules for every channel live in `lib/v2/themes.js`; the build refuses any style not in that list.


## Studio themes (made in AutoTube Studio, not in the library)

| Theme | What it looks like | Use it for | Fit |
|---|---|---|---|
| `comic-book` | Printed comic page: ink panels, Ben-Day dots, balloons, captions, sound-effect words | Stories with drama, myths, exam tricks as hero vs villain, ads | H J S |
| `clay-3d` | Plasticine stop-motion on a tabletop set, fingerprinted clay, soft light | Friendly explainers, folk tales, everyday science, cute ads | H J S |

Kits: `studio-themes/<slug>/demo/*.js` (copied into each job as `stheme/<slug>/`). Rules: `studio-themes/<slug>/STYLE.md`.
