// kit/bake — the p5.js + p5.brush painting stage.
//
// p5.brush 2.x only paints onto a p5 WEBGL canvas, and it is far too slow to repaint a whole picture 60 times a
// second. So p5 owns one hidden WEBGL "stage"; scenes paint their artwork onto it with p5.brush ONCE (in init),
// and bake() hands back an ordinary 2D canvas layer that the compositor blits every frame.
//
//   const rock = await K.bake({ w: 1000, h: 1000, res: 1.2, bg: '#ffffff', seed: 3 }, (brush, p) => {
//     brush.set('charcoal', '#5a2a12', 4);
//     brush.spline([[100, 500, 0.8], [400, 420, 1.3], [900, 520, 0.6]], 0.5);   // [x, y, pressure]
//   });
//   ...
//   K.putBlend(ctx, rock, 'multiply');      // white background drops out, pigment darkens the paper
//
// Coordinates inside the callback are layer units (0..w, 0..h); the stage scales them by `res`.
// The stage is STAGE px square and is never resized (resizing breaks p5.brush), so w*res and h*res must be ≤ STAGE.
import { makeCanvas } from './canvas.js';

export const STAGE = 2048;
let P = null, booting = null, job = null, jobError = null, chain = Promise.resolve();
const stats = { bakes: 0, ms: 0 };

/** extra brushes on top of the built-ins (pen, rotring, 2B, HB, 2H, cpencil, pastel, crayon, charcoal, spray, marker) */
function registerBrushes(b) {
  // Pressure as an array [start, middle, end] is a fixed envelope (p5.brush's {curve,min_max} form is randomised per stroke).
  // pointed wet ink brush: swells and tapers
  b.add('ink', { type: 'default', weight: 0.9, scatter: 0.35, sharpness: 0.92, grain: 22, opacity: 225, spacing: 0.03, pressure: [0.55, 1.15, 0.45], rotate: 'none' });
  // hair-thin, even "iron wire" line for baimiao outlines and ruled-line (jiehua) work
  b.add('inkFine', { type: 'default', weight: 0.36, scatter: 0.12, sharpness: 1, grain: 30, opacity: 235, spacing: 0.03, pressure: [0.8, 1.05, 0.7], rotate: 'none' });
  // half-dry brush: ragged, broken edge (flying white)
  b.add('inkDry', { type: 'default', weight: 1.3, scatter: 2.2, sharpness: 0.45, grain: 4, opacity: 120, spacing: 0.06, pressure: [0.9, 1.1, 0.6], rotate: 'none' });
  // pale wet wash stroke
  b.add('inkWash', { type: 'default', weight: 4, scatter: 3, sharpness: 0.15, grain: 3, opacity: 6, spacing: 0.08, pressure: [1, 1.1, 0.9], rotate: 'none' });
  // finger-painted mineral pigment on rock
  b.add('ochre', { type: 'default', weight: 1.4, scatter: 2.0, sharpness: 0.55, grain: 6, opacity: 150, spacing: 0.05, pressure: [0.9, 1.1, 0.8], rotate: 'natural' });
  // opaque flat paint (gouache / tempera / distemper)
  b.add('gouache', { type: 'marker', weight: 2.2, scatter: 0.2, sharpness: null, grain: null, opacity: 12, spacing: 0.03, pressure: [0.9, 1.1, 0.9], rotate: 'none' });
  // thick loaded oil dab
  b.add('oil', { type: 'marker', weight: 3, scatter: 0.5, sharpness: null, grain: null, opacity: 18, spacing: 0.035, pressure: [0.8, 1.2, 0.7], rotate: 'none' });
  // soft chalk / conté
  b.add('chalk', { type: 'default', weight: 1.2, scatter: 3, sharpness: 0.35, grain: 4, opacity: 80, spacing: 0.07, pressure: [1, 1.1, 0.9], rotate: 'natural' });
}

function resetState(b) {
  b.noFill();
  b.noHatch();
  b.noWash?.();
  b.noMass?.();
  b.noField();
  b.noStroke();
}

/** Start p5 and p5.brush (idempotent). Resolves when the stage is ready. */
export function bootBrush() {
  if (booting) return booting;
  booting = new Promise((resolve, reject) => {
    if (typeof p5 === 'undefined' || typeof brush === 'undefined') {
      reject(new Error('p5.js / p5.brush are not loaded (vendor/p5.min.js, vendor/p5.brush.js)'));
      return;
    }
    const host = document.createElement('div');
    host.id = 'p5-brush-stage';
    host.style.cssText = 'position:fixed;left:-30000px;top:0;width:8px;height:8px;overflow:hidden;pointer-events:none';
    document.body.appendChild(host);
    new p5((p) => {
      P = p;
      p.setup = async () => {
        p.pixelDensity(1);
        p.createCanvas(STAGE, STAGE, p.WEBGL);
        p.noLoop();
        brush.instance(p);
        brush.load();
        registerBrushes(brush);
        // p5.brush initialises its fill pipeline lazily and drops the first fill of a page: burn one frame.
        job = (pp) => {
          pp.background(255);
          brush.noStroke();
          brush.fill('#000000', 8);
          brush.circle(40, 40, 12);
          brush.noFill();
        };
        await p.redraw();
        job = null;
        resolve(p);
      };
      p.draw = () => {
        p.translate(-p.width / 2, -p.height / 2);
        if (!job) return;
        try {
          job(p);
        } catch (e) {
          jobError = e;
        }
      };
    }, host);
  });
  return booting;
}

/**
 * Paint a layer with p5.brush. Returns a Promise of a 2D canvas layer (.uw/.uh/.res set).
 *   opts.w, opts.h  size in units           opts.res   px per unit (default 1.2; w*res and h*res ≤ 2048)
 *   opts.bg         CSS colour, or null for a transparent layer (edges of strokes on transparent can fringe —
 *                   for dark media prefer bg '#ffffff' and blit with 'multiply')
 *   opts.seed       seeds p5.brush's randomness so every worker bakes the identical picture
 * fn(brush, p) receives the p5.brush API and the p5 instance. Brush state is reset before every bake.
 * A stroke is about (brush weight × the weight you pass to brush.set) px wide: 'ink' at 1 ≈ 5 px, 'charcoal' at 3 ≈ 4 px.
 * Cost guide (software GL): thin strokes ≈ 1.5 ms each; fat strokes (> 15 px) 50–100 ms each; a watercolour
 * brush.fill ≈ 150–250 ms. So: thin and medium strokes freely, fat strokes and fills sparingly — cover large areas
 * with Canvas 2D fills + kit textures instead.
 */
export function bake(opts, fn) {
  const run = async () => {
    await bootBrush();
    const t0 = performance.now();
    const { w, h, res = 1.2, bg = '#ffffff', seed = 1 } = opts;
    const pw = Math.ceil(w * res), ph = Math.ceil(h * res);
    if (pw > STAGE || ph > STAGE) throw new Error(`bake: ${pw}×${ph}px exceeds the ${STAGE}px stage — lower res or split the layer`);
    jobError = null;
    job = (p) => {
      if (bg === null) p.clear();
      else p.background(bg);
      resetState(brush);
      brush.seed(seed);
      brush.noiseSeed(seed);
      p.randomSeed(seed);
      p.noiseSeed(seed);
      p.scale(res);
      fn(brush, p);
      resetState(brush);
    };
    await P.redraw();
    job = null;
    if (jobError) throw jobError;
    const out = makeCanvas(pw, ph);
    out.getContext('2d').drawImage(P.drawingContext.canvas, 0, 0, pw, ph, 0, 0, pw, ph);
    out.uw = w;
    out.uh = h;
    out.res = res;
    stats.bakes++;
    stats.ms += performance.now() - t0;
    return out;
  };
  const pr = chain.then(run);
  chain = pr.catch(() => {});
  return pr;
}

export const bakeStats = () => ({ ...stats });
