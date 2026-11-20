# Comic Book — Style Prompt

> A printed comic page comes alive. Thick black ink borders cut the frame into panels; inside them, flat
> colours printed with Ben-Day dots, bold ink outlines, speech balloons, square caption boxes, speed lines
> and big sound-effect words. The camera moves from panel to panel the way an eye reads a page.
> References (grammar only, nothing copied): Silver-Age newsprint comics, pop-art halftone, Indian
> picture-story comics. All characters and settings are original.

## 1. The page
- Background is **newsprint**: warm off-white `#F3E9D2` with faint paper fibre (`paper()`), never pure white.
- Every frame shows **panels** with 10–16 px black gutters' borders (`panel()`); 1–4 panels on screen.
  Portrait 9:16: stack panels vertically, one big panel per beat is fine.
- Light misregistration: the colour layer sits 2–3 px off the ink layer (`print()` does it).

## 2. Colour and shading
- Flat CMYK-style fills from `PAL` only (red, yellow, cyan, blue, skin tones, ink). No gradients on
  characters and objects.
- Shading is **Ben-Day dots** (`dots()`): one dot screen per shadow area, dots 6–14 px, never soft
  airbrush. Big skies or backgrounds may use a dot gradient (dot size changes, not colour).
- Ink outlines 4–8 px, thicker on the outside of a shape than on inner details (`ink()`).

## 3. Characters and acting
- Original characters drawn with simple shapes: bold silhouette, big readable faces, 3–4 head-height
  bodies for kids/fun, 6 for drama. Expressions are pushed (wide eyes, open mouths, sweat drops).
- Motion is **held poses with snap transitions** (comics read pose to pose): ease into a pose, hold,
  snap to the next; add `speed()` lines on fast moves and impact.

## 4. Words in the picture
- Dialogue lives in **speech balloons** (`balloon()`), thought in cloud balloons, narration in yellow
  **caption boxes** (`caption()`), all lettered in the comic hand font, uppercase.
- Sound effects (`sfx()`) are drawn words with a thick outline and a pop colour, tilted, part of the
  art. Use them on impacts and reveals only (max one per shot).
- Numbers and formulas for exam topics go on a caption box, a blackboard inside the panel, or a sign.

## 5. Camera and transitions
- The camera glides across the page from panel to panel (`camPan()`), small push-ins on the key panel.
- Transitions: a new panel slides in with its border first, then the art "prints" in (dots fill),
  or a page-turn wipe between scenes (`pageTurn()`).

## 6. Subtitles
- Bottom caption strip: black box with yellow uppercase comic lettering, 2 lines max, inside the frame
  (portrait: about 260 px above the bottom). Never over a balloon.

## 7. Never
- 3D shading, photographic light, soft gradients on characters, real brands or copyrighted heroes,
  costumes or logos of existing comic characters.
