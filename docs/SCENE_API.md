# Scene API — how to paint one section of *The Pelican Test*

Read this once, then read a finished scene: `src/scenes/s01_sahara.js` (p5.brush pigment + cut-out onlookers),
`src/scenes/s05_song.js` (ink toolkit, path/scale change, camera push-in), `src/scenes/s19_vertical.js`
(pure Canvas 2D, screen-space overlay, `env.hero`). Batch 1 is finished too and worth a look for technique:
`s02_egypt.js` (profile freeze + acting), `s03_han.js` (per-frame pelican through a texture treatment),
`s04_tang.js` (hidden-line baked drawing + per-frame billowing lines), `s06_qingming.js` (path over an arch, a
crowd that reacts), `s07_maya.js` (crisp 2D, counting on the beat).

## The world

- The film is one long wall of square pictures. **Your section is a 1000 × 1000 unit picture**; origin top-left, y down.
  At normal zoom 1 unit = 1 output pixel (1920×1080 output), so the picture is seen at about 1000 px.
- A road runs through every picture. **The riding line is `y = K.ROAD_Y` (800).** The pelican's wheels touch it.
  Draw the road in your style, and keep it continuous to both edges at that height.
- The pelican rides left → right. It is about 270 units long and 305 tall at scale 1 (head top ≈ y 495, beak tip ≈ +134
  ahead of its centre). Keep the band y ≈ 480–800 readable where it passes; put onlookers above, behind or below.
- The frame crossing: at local time `t = 0` the pelican's centre is on your LEFT frame; at `t = 6` on your RIGHT frame.
  The compositor clips to your square, so half a pelican at an edge is normal — the other half is in the neighbour's style.

## Time

120 BPM. A section is 3 bars = 6 s = 12 beats (`t` in seconds, section-local).

| bar | t | what happens |
|---|---|---|
| 1 | 0–2 | the pelican enters |
| 2 | 2–4 | **the gag / visual highlight lands** (hit a beat: t = 2.0, 2.5, 3.0 …) |
| 3 | 4–6 | it rides on toward the next frame |

`render` is called for **any** `t`, in any order: from about −7 s (your picture is visible to the right of the previous
section before the pelican arrives) to about +13 s (it lingers on the left afterwards). Give the picture a calm
"before" state (t < 0) and an "after" state (t > 6). **Everything must be a pure function of `t`** — no `Math.random()`,
no `Date`, no state carried between calls. Use `K.rng(seed)`, `K.noise1/2`, `K.wobble(t, speed, seed)`.

Beat helpers (`env.Beat` or `import * as Beat from '../beat/index.js'`): `Beat.BEAT` 0.5, `Beat.BAR` 2,
`Beat.at(bar, beat)` → t, `Beat.hit(t, t0, sharp)` → 1→0 pulse from t0, `Beat.local(t)` → `{bar, beat, beatPhase}`.

## The scene module

```js
import * as K from '../kit/index.js';      // drawing toolkit (also passed as env.K)
import * as Rig from '../rig/index.js';    // pelican + bicycle
import { TITLES } from './titles.js';

let L = null;                               // baked layers live in module scope

export default {
  id: 7, key: 'maya', title: TITLES[7],
  heroT: 3.2,                // local time of the still shown on the outro wall ("frozen on its era's pelican")

  // --- optional choreography ---------------------------------------------------------------------------
  profile: [[0, 0], [2.2, 0.5], [3.6, 0.5], [6, 1]],   // [t, fraction across]; flat run = freeze. Default: steady ride.
  path(u) { return { dy: 0, s: 1, rot: 0 }; },          // lift / scale / tilt the pelican along the way (u = 0..1 across)
  act(t, p) { p.neck = 1; p.eye = [0, -1]; },           // acting: mutate rig params (see Rig DEFAULTS)
  camera(t, c) { return { zoom: 1.4, dx: 0, dy: -60 }; }, // extra camera move while the pelican is in your section
  stutter: 10,                                           // quantise the pelican's pose to N updates/s (period stutter)

  async init(K) { /* build + bake static layers ONCE */ },
  render(ctx, t, env) { /* draw the whole 1000×1000 picture for local time t */ },
  overlay(ctx, t, env) { /* optional: draw in SCREEN space (1920×1080), for t in −1…7 */ },
};
```

Rules for the choreography hooks — the pelican must be **exactly on the road, scale 1, upright and in its neutral
pose at both frames**:

- `profile` must start `[0,0]` and end `[6,1]`; slopes at the ends are forced to cruising speed.
- `path(u)`: return `dy = 0, s = 1, rot = 0` for `u < 0.07` and `u > 0.93` (ease in/out of anything else).
- `act(t, p)`: fade your changes in after t ≈ 0.4 and out before t ≈ 5.6 (`K.gate(t, 0.5, 5.5, 0.3)`).
- `camera(t, c)`: return `null`/identity near t = 0 and t = 6. `c = { u, px, py, ps }` (pelican x, y, scale in your coords).
  The default camera already keeps the pelican centred horizontally and adds a slight push-in at each frame crossing.
- With `stutter`, only the pelican's pose is quantised; the camera pan stays smooth. Quantise your own animation
  with `Beat.quantize(t, hz)`.

### `env`

| field | meaning |
|---|---|
| `env.pose` | the solved pelican pose in your picture's coordinates, or `null` when it is nowhere near. **Draw it yourself, in your style.** |
| `env.poseAt(t2)` | pose at another local time (ghosts, trails, phosphor persistence) |
| `env.rider` | `{ u, lx, y, s, speed }` — progress 0..1, pelican x in your coords (can be < 0 or > 1000), speed in units/s |
| `env.owner` | true while the pelican is in your section |
| `env.hero` | true when rendering the frozen still for the outro wall (no camera, no overlay: put any screen-space gimmick inside the square here) |
| `env.zoom` | current camera zoom (≥ 1 normally). Bake layers at `res ≥ 1.2`; if you zoom past ~1.5 see s05 for hi-res tiles |
| `env.K`, `env.Rig`, `env.Beat`, `env.title`, `env.t`, `env.T` (film time) | |

## The pelican (`Rig`)

`env.pose` contains everything, in your coordinates:

- `pose.x, pose.y, pose.s, pose.rot` — ground contact point, scale, slope.
- `pose.pt.*` — named joints: `hubR hubF bb saddle grip pedalN pedalF hip kneeN ankleN shoulder elbow hand neckBase head eye beakBase beakTip`.
- `pose.shapes.*` — outlines as `[[x,y],…]`: `body wing tail[3] arm neck head beakUpper pouch saddle footN footF pedalN pedalF`
  (closed), `wingMarks[3] fingers[3] crest[3] scarf[2] beakLine legN legF crankN crankF` (open polylines).
- `pose.wheels[2]` `{c, r, a}`, `pose.tubes.*` (frame tubes as point pairs), `pose.eye {c, r, pupil, pr, lid}`, `pose.bbox`.
- `pose.M`, `pose.G.{body,head,wheelR,wheelF,crank}` — canvas matrices `[a,b,c,d,e,f]` from rig-rest space to your picture,
  for placing baked sprites (bake from `Rig.rest()`; see below).

**The quick way to draw it — one loop, back to front:**

```js
for (const p of Rig.parts(pose)) {           // { name, role, kind, far?, … }
  if (p.kind === 'poly')  { /* p.pts closed outline */ }
  if (p.kind === 'line')  { /* p.pts polyline, p.w suggested width */ }
  if (p.kind === 'wheel') { /* p.c, p.r, p.a; Rig.spokes(p, n) → [[hub, rim], …] */ }
  if (p.kind === 'disc')  { /* p.c, p.r (chainring, cog) */ }
  if (p.kind === 'eye')   { /* p.c, p.r, p.pupil, p.pr, p.lid */ }
}
// roles: tire frame metal saddle leg foot body wing tail neck head beak pouch eye scarf mark
```

Helpers: `Rig.drawFlat(ctx, pose, style)` (flat colours — fine as a base to restyle), `Rig.drawSilhouette(ctx, pose, color, {grow})`.
**Redesign the pelican for your era** — outline quality, fill, pattern, what is omitted. It must still read instantly as a
pelican on a bicycle: big beak + pouch, two wheels, pedalling legs. Give each part a fixed seed so its line does not
boil from frame to frame.

Acting params for `act(t, p)` (all optional): `p.neck` (−1 hunched … 1 craned), `p.head = [dx, dy]`, `p.headTilt` (rad, + = beak up),
`p.beakOpen` 0..1, `p.eye = [x, y]` (−1..1; `[0,-1]` = rolled up), `p.lid` 0..1, `p.wave` 0..1 (wing off the bar, raised),
`p.armTo = [x, y]` (rig-local target), `p.lean` (rad), `p.crest` 0..1, `p.tailWag`, `p.wind`, `p.bob`, `p.squash`,
and `p.x`, `p.y` (e.g. a jump: `p.y -= h`).

## The toolkit (`K`) — what you will actually use

**Layers** — build static artwork once in `init`, blit it every frame:
`K.layer(w, h, res, (ctx) => {…})` → canvas · `K.put(ctx, layer, x, y, w, h)` · `K.putBlend(ctx, layer, 'multiply', alpha)`.

**p5.brush (natural media) — `await K.bake({ w, h, res: 1.2, bg: '#ffffff', seed }, (brush, p) => {…})`** → layer.
Paint dark media on white and `putBlend(…,'multiply')` onto your ground; light media on black with `'screen'`.
Coordinates are layer units. API inside the callback (p5.brush 2.x):

```js
brush.set('charcoal', '#402010', 2);                      // brush, colour, weight
brush.line(x0, y0, x1, y1);
brush.spline([[x, y, pressure], …], 0.5);                 // smooth stroke, per-point pressure
brush.fill('#2a4d7a', 200); brush.fillBleed(0.2); brush.fillTexture(0.5, 0.4);   // watercolour fill for the next shapes
brush.wash('#1d5c3a', 255);                               // flat opaque fill for the next shapes
brush.hatch(8, 45, { rand: 0.1 }); brush.hatchStyle('2B', '#222', 1.5);          // hatch the next shapes (angle in DEGREES)
brush.rect(x, y, w, h); brush.circle(x, y, r); brush.polygon([[x, y], …]);
brush.beginShape(0.3); brush.vertex(x, y); …; brush.endShape(p.CLOSE);
brush.noFill(); brush.noHatch(); brush.noWash(); brush.noStroke();
```

Brushes: built-in `pen rotring 2B HB 2H cpencil pastel crayon charcoal spray marker`; ours `ink` (pointed, swelling),
`inkFine` (even hairline), `inkDry` (ragged dry brush), `inkWash` (pale soft), `ochre` (finger-painted pigment),
`gouache` and `oil` (opaque flat paint), `chalk`. Width ≈ `ink` 2.2 px × weight, `inkFine` 1 px × weight,
`gouache` 3.5 px × weight, `charcoal` ≈ 1.2 px × weight. `node scratch/calib.mjs` renders a chart.

> **Performance law of p5.brush here (software GL): every change of stroke COLOUR forces a composite.**
> Thousands of strokes in one colour take a second; a few hundred strokes that alternate colours take a minute.
> **Group strokes by colour**: set the colour once, vary only `brush.strokeWeight(w)`. For ink use `K.ink.batch(brush)`
> which does this for you. Thin strokes ≈ 0.5 ms each, strokes wider than ~15 px ≈ 50 ms each, each watercolour
> `brush.fill` ≈ 0.2 s — cover big areas with Canvas 2D fills + `K.noiseLayer`/`K.grain` textures instead.
> Budget: **`init` under ~15 s** (the tool prints it), **render under ~25 ms/frame**.
>
> Two more things learned in batch 1: (1) p5.brush stamps thinner than about 1 px alias into dashes — give `inkFine`
> weights of roughly 2.5–6 (its stamp is ≈ 0.36 × weight units across, and stamp size grows with pressure *squared*,
> so pass the square root of the width profile you want as pressure). (2) Many finished scenes use **no p5.brush at
> all** and are excellent (s03, s07): crisp Canvas 2D drawing + `K.noiseLayer`/`K.grain` wear layers is a perfectly
> good way to make a period surface. Use p5.brush where real brush or crayon texture is the point.
> The first frame after `init` costs a one-off ~0.4 s (layer upload) — ignore it when reading ms/frame.

**Canvas 2D strokes for things that move** (per-frame safe): `K.brushStroke(ctx, pts, {width, color, taper:[in,out], dry, wobble, seed})`,
`K.sketchLine`, `K.hatchPoly(ctx, poly, {angle, gap, width, color})`, `K.glowLine` (additive), `K.ribbon(ctx, pts, widthFn, fill)`,
`K.stipple`. Geometry: `K.catmull(pts, seg, closed)`, `K.resample`, `K.jitter(pts, amp, freq, seed)`, `K.ellipsePts`, `K.pointAt`.
Paths: `K.path(ctx, pts, closed)`, `K.spline(ctx, pts, closed)`, `K.fillPoly`, `K.strokePoly`, `K.roundRect`, `K.circle`, `K.linGrad`, `K.radGrad`.

**Textures**: `K.paper({w,h,res,base,seed,mottle,fiber,speck,stains,edge})`, `K.noiseLayer({w,h,res,scale,oct,seed,color,lo,hi,alpha,stretch,ridged})`
(alpha-noise in one colour — mottling, stains, fog, wear), `K.grain(ctx,x,y,w,h,{color,alpha,seed,size,density,mode})`, `K.fibers`, `K.cracks`, `K.vignette`.

**Ink toolkit `K.ink`** (sections 3, 4, 5, 6, 9): grounds `xuan()`, `silk()`, `weave()`; density `TONES`/`tone(d)`;
p5.brush helpers `batch(brush)`, `stroke(q, pts, {brush, tone, weight, press})`, `dabs(q, n, sampler, {...})`, `tree(q, x, y, h, {...})`;
2D helpers `wash()`, `bleed()`, `mist()`, `line(ctx, pts, {style:'iron'|'orchid'|'nail', d, width, dry, seed})`, `blot()`, `rubbingize()`.

**Text**: `K.text(ctx, str, x, y, {size, font, weight, italic, align, baseline, color, tracking, maxWidth, stroke})`, `K.vtext` (vertical CJK),
`K.titleBlock(ctx, title, x, y, {...})`, `K.seal(chars, {size, relief})` → layer, `K.FONT.{serif, book, roman, cjkSerif, cjkSans, sans, display, geo, mono, pixel, chat, script}`.

**Maths / colour**: `K.clamp lerp remap smoothstep prog gate bump ease.{io2,io3,out3,outBack,outElastic,outBounce…}`,
`K.rng(seed)` (`r()`, `r.range`, `r.pick`, `r.gauss`), `K.hash1`, `K.noise1`, `K.noise2`, `K.fbm2`, `K.wobble`,
`K.rgba(hex, a)`, `K.mix`, `K.shade(hex, ±k)`.

## Required in every section

1. **Title card styled for the era**, drawn inside the picture: Chinese title, English title, date (`TITLES[id]`).
   Legible at 1080p: zh ≥ 40 units, en ≥ 24, date ≥ 21, with real contrast. Keep it out of the pelican's band.
2. **The road** at `K.ROAD_Y`, edge to edge.
3. **The pelican**, redesigned for the era, drawn from `env.pose` whenever it is not null.
4. A **before** state (t < 0), the **gag on a beat in bar 2**, an **after** state (t > 6).
5. Fill the whole square edge to edge (the compositor clips; nothing may be left transparent).
6. Original work only: homage to public-domain art is fine; **no real logos, mascots, UI, characters, game levels, album covers**.

## Looking at your work

```bash
# your section alone, square, at section-local times (fast loop; prints init ms and ms/frame)
node tools/sheet.mjs --scene 7 --lt -1,0.5,2,3,4.5,7 --cols 3 --cellW 640 --out scratch/s07.jpg
# as it appears in the film: camera, frames, neighbours, overlays
node tools/sheet.mjs --section 7 --n 8 --cols 4 --cellW 640 --out scratch/s07film.jpg
# the still used on the outro wall
node tools/sheet.mjs --scene 7 --lt 3.2 --hero --cols 1 --cellW 800 --out scratch/s07hero.jpg
# one full-resolution frame at film time T (section i starts at T = 5 + 6·(i−1))
node tools/shot.mjs --t 43.2 --out scratch/s07
```

Then **look at the image** (Read the JPEG) and iterate. Judge it the way a viewer would: is it unmistakably this
era's art at a glance, is the pelican easy to find, is the title legible, does the gag read?
