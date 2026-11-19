# The Pelican Test

*Humans have been obsessed with drawing pelicans riding bicycles since ancient times — long before the bicycle was invented.*

A code-generated animated short, 2 min 17 s. A pelican rides a bicycle along one road through 20 pictures spanning
six thousand years of art; every time it crosses a picture frame the style changes. Every frame is drawn by code
(p5.js + p5.brush for the natural media, Canvas 2D for compositing and everything that moves) and every sound is
synthesised by code (Web Audio). No images, samples or recordings are used.

| | |
|---|---|
| Runtime | 137 s at 120 BPM: intro 2½ bars · 20 sections × 3 bars · outro 6 bars |
| Output | 1920 × 1080, H.264 + AAC |
| Stack | Node.js 20+, Google Chrome, ffmpeg · p5.js 2.3.4, p5.brush 2.x (vendored) · puppeteer-core |

## Run it

```bash
npm install                 # puppeteer-core (p5 and p5.brush are already in vendor/)
npm run preview             # → http://localhost:5173/  play / pause, scrubber, section name, live Web Audio
```

Preview keys: space play/pause · ←/→ half a second (shift = one section) · , / . one frame · m mute.
The first visit paints all 20 pictures (a progress note shows); after that scrubbing is instant.

```bash
npm run render              # frame-by-frame export → out/segments/*.mp4 (one file per segment)
npm run audio               # offline score → out/score.wav
npm run build               # concat (stream copy) + soundtrack → out/the-pelican-test.mp4
npm run film                # all three
```

Looking at the film without playing it:

```bash
node tools/sheet.mjs --from 0 --to 137 --n 24 --cols 6      # contact sheet of the whole film
node tools/sheet.mjs --section 12 --n 8                     # one section as it appears in the film
node tools/sheet.mjs --scene 12 --lt -1,0.5,2,3,4.5,7       # one section alone, at section-local times
node tools/shot.mjs --t 73.5                                # a full-resolution still
python3 tools/audiocheck.py out/score.wav                   # levels, beat alignment, bell at every crossing
```

`CHROME_PATH` points the tools at a specific Chrome; `PELICAN_GL=hardware|software` overrides GPU detection
(headless Linux without a display uses software GL).

## How it is built

```
src/kit     shared drawing toolkit: maths, seeded noise, colour, layers, textures, strokes, type,
            the p5.brush bake stage, the ink-painting toolkit (xuan / silk, ink density, dry brush, bleed)
src/beat    tempo, bar grid, timeline, motion profiles
src/rig     the pelican and bicycle as one parametric skeleton → a pose every style draws its own way
src/scenes  one file per section (s01 … s20), the intro page (s00) and the press-conference panel (s21)
src/main    scene scheduling, the rider, the camera, picture frames, the outro wall, the preview player
audio       the score: synth voices, per-era arrangements, the vaporwave tape chain, live engine, offline render
tools       static server, frame export, stills, contact sheets, soundtrack render, final build
briefs      the art brief for each section and the shared style guide
docs        SCENE_API.md — the contract a scene is written against
```

- **One wall, one road.** Every section is a 1000 × 1000-unit picture in a frame; the road's riding line is at the
  same height in all of them. The camera follows the pelican along the wall, so you see the current picture with a
  slice of the previous and the next. At a frame the pelican is drawn half in one style and half in the next from the
  *same pose*, which is what makes the ride continuous. The outro pulls back to show the same wall as a 7 × 3 grid.
- **A pure function of time.** `film.renderAt(ctx, T)` draws any instant in any order, so the preview can scrub and
  the export can render segments in parallel. Randomness is seeded; nothing reads the clock.
- **p5.brush is baked, not animated.** p5 owns a hidden WEBGL stage; each scene paints its static artwork there once
  (`K.bake`) and gets back an ordinary canvas layer. What moves — the pelican, onlookers' heads, sashes, rain — is
  drawn per frame in Canvas 2D with seeded strokes, so lines do not boil.
- **Every crossing is a downbeat.** Sections are three bars: enter, gag, ride on. Pedalling is tied to distance — one
  revolution every two beats at cruising speed.
- **One melody, twenty bands.** `audio/score.js` holds a two-phrase tune in D pentatonic; each section re-orchestrates
  it (hand drums and chant, harp, bronze bells, pipa, guqin, flute and gongs, ocarina, sitar and tabla, xiao, gamelan,
  shamisen, strings, piano and organ, sine and valve hum, chiptune, ringtone, cassette, pop, piano and synth). A
  bicycle bell rings at every frame. The same scheduling code feeds the live preview and the offline render.

Licensing of third-party components and the homage/reference statement are in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
