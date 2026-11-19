# The Pelican Test — shared art direction

**Premise.** "Humans have been obsessed with drawing pelicans riding bicycles since ancient times — long before the
bicycle was invented." A pelican rides a bicycle along one road through 20 pictures; each time it crosses a picture
frame the art style changes. Museum-deadpan: **every era turns in a polished, sincere submission.** The humour is small
visual gags played completely straight. Nothing winks at the camera; no comedy fonts, no "meme" energy.

**Quality bar.** Each picture should pass, at a glance, for a careful work of its period: real substrate (stone, plaster,
silk, paper, canvas, phosphor, pixels), real technique (how the marks were actually made), a real composition with
fore-, middle- and background — not colour blocks with a label. Then the pelican is simply *there*, drawn exactly as
that period would have drawn anything else.

**Constants** (see `docs/SCENE_API.md`): 1000 × 1000 picture; road line `y = 800`; pelican rides left → right; 6 s per
section at 120 BPM; pelican enters in bar 1, gag lands on a beat in bar 2, it rides on in bar 3; a calm "before" (t < 0)
and "after" (t > 6) state because the picture is on screen for about 16 s in total (it is visible beside its neighbours).

**Every section must have**
1. the road at y = 800, edge to edge, in period dress;
2. the pelican redesigned for the period (still instantly a pelican on a bicycle: huge beak with pouch, two wheels, pedalling legs);
3. onlookers or surroundings that *react* — small, on the beat, deadpan;
4. a title card that belongs to the period (cartouche, colophon, intertitle, nameplate, HUD …) carrying
   `TITLES[id].zh`, `.en`, `.date` — clearly legible at 1080p (zh ≥ 40 units, en ≥ 24, date ≥ 21, strong contrast),
   placed away from the pelican's band (y ≈ 480–800);
5. `heroT`: a moment in bar 2 with the pelican well inside the picture — it becomes the frozen panel on the outro wall.

**Copyright.** Pay homage only to public-domain works (everything named in the briefs is). Do not reproduce or imitate
any real album cover, film shot, game character or level, software UI, logo, mascot, icon set or notification design.
Names, apps, games and signage are fictional. No real people.

**Engineering.** One file per section: `src/scenes/sNN_key.js`. Do not edit the kit, rig, beat or main modules (if you
are missing a helper, write it inside your scene file and mention it in your report). Pure function of `t`. Bake static
artwork in `init` (p5.brush for natural media — group strokes by colour!), draw only what moves in `render`.
Budgets: init ≤ ~15 s, render ≤ ~25 ms/frame, as printed by `tools/sheet.mjs`.

**Working loop.** Render → *look at the image* → fix → repeat, at least three rounds: (1) composition and substrate,
(2) pelican + road + title legibility, (3) the gag's timing on the beat and the before/after states. Check the solo
sheet, the in-film sheet (frames, camera, neighbours) and the hero still.
