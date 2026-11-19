# Third-party notices

All drawing, animation, music and tooling code in this repository was written for this project.
**No code, artwork, audio, text or data from the reference repository
[`Tunai-0511/meme67-art-history`](https://github.com/Tunai-0511/meme67-art-history) is reused here.** That project's
`README.md`, `README_SHARE.md`, `LICENSE`, `LICENSE-MEDIA.md` and `NOTICE.md` were read in full before work began
(its code is MIT, © 2026 Tunai-0511; its film, cover, rendered frames and audio are all rights reserved and were not
used or adapted in any way). What was borrowed is the *approach* named in the brief: a shared drawing kit, a beat
module, one scene file per section rendered by a pure function of time, Puppeteer frame export with ffmpeg, contact
sheets, and art briefs handed to subagents.

## Vendored libraries (unmodified)

| File | Library | Licence | Upstream |
|---|---|---|---|
| `vendor/p5.min.js` | p5.js 2.3.4 | LGPL-2.1 (text in `vendor/LICENSE-p5.js-LGPL-2.1.txt`) | https://p5js.org · https://github.com/processing/p5.js |
| `vendor/p5.brush.js` | p5.brush 2.x | MIT (below) | https://github.com/acamposuribe/p5.brush |

The two files are byte-for-byte copies of the upstream release builds. Because this machine could not install from
npm, they were copied from the reference repository's `public/vendor/` directory, where the same upstream builds are
vendored (they are third-party components listed in that project's `NOTICE.md`, not part of its own code or media).
SHA-256: `bb8b82b9…fce559` (p5.min.js), `41c25108…61fc31a` (p5.brush.js). To replace them with copies fetched directly
from npm: `npm install` and copy `node_modules/p5/lib/p5.min.js` and `node_modules/p5.brush/dist/p5.brush.js` into `vendor/`.

p5.js is used as a separate, unmodified library file (LGPL-2.1 §5–6): you may replace `vendor/p5.min.js` with any
compatible build; its source is available from the upstream repository above.

### p5.brush — MIT License

Copyright (c) Alejandro Campos Uribe (see the upstream repository's `LICENSE.md` for the original notice)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Tools (not bundled)

- **puppeteer-core** — Apache-2.0 — drives Chrome for frame export and the offline audio render.
- **Google Chrome**, **ffmpeg** (LGPL/GPL) — required on the machine that renders; not distributed with this project.
- **Fonts** — system fonts only (Cardo, Crimson Text, Noto Serif/Sans CJK TC, Inter, Poppins, DejaVu Sans Mono, Unifont,
  Comic Relief, …); none are included. On another machine the browser falls back to its own serif/sans/mono faces.

## Homage

The 20 pictures are original procedural drawings in the manner of historical styles. The specific works referred to —
Fan Kuan's *Travelers among Mountains and Streams*, Zhang Zeduan's *Along the River During the Qingming Festival*,
Bada Shanren's album leaves, Hiroshige's Tōkaidō prints, Van Gogh's *The Starry Night*, Munch's *The Scream* and
Murnau's *Nosferatu* (1922) — are in the public domain. The chat client, short-video app, game, shop signs and book
title that appear are fictional; no real logo, mascot, interface, character, level or notification sound is reproduced.
All music and sound effects are original and synthesised by the code in `audio/`.
