// Section 9 — Bada Shanren, Freehand Ink (c. 1690) — an album leaf in the xieyi 寫意 manner of Zhu Da.
// A few strokes and a great deal of bare xuan paper: one lotus leaf on its stalk, one small fish, one dry stroke
// for the road, a signature and two seals. The pelican is about a dozen brush marks. Its eye is a ring with the
// pupil shoved against the rim — and on the beat it rolls. Half a beat later so does the fish's, and that one stays.
//
// Technique. Every mark, static or moving, comes from one brush model (`mark`): a stroke is a row of bristle
// bands along a spine; each band carries its own ink tone (so a side-loaded brush grades from dark to pale across
// its width) and runs dry on its own (flying white). Wet marks are then "developed" into the paper (`develop`):
// the ink edge creeps along the paper fibres, pools unevenly, and leaves the paler water halo that wet ink leaves in
// unsized xuan. The lotus stalk, veins and dry scumbles are p5.brush strokes (K.ink batch) with K.ink.bleed halos.
// The rigid parts of the pelican (body blot, head with beak and pouch, the two wheel rings, the frame) are developed
// once as ink-on-white sprites and multiplied on with the rig's matrices; the parts that flex (neck, wing-arm, legs)
// are drawn every frame with the same brush model and fixed seeds, so nothing boils.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const I = K.ink;
const RES = 1.6; // px per unit of the leaf (covers the push-in on the eye)
const SPR = 2.5; // px per unit of the pelican's marks
const sstep = K.smoothstep, TAU = K.TAU;
const GEO = Rig.GEO;
let L = null;

// ------------------------------------------------------------------------------------------- ink
// density 0 = bare paper · 0.2 qing · 0.4 dan · 0.6 zhong · 0.8 nong · 1 jiao
const toneCache = new Map();
function toneOf(d) {
  const q = Math.round(K.clamp(d) * 50);
  let c = toneCache.get(q);
  if (!c) {
    const x = q / 50;
    c = x < 0.2 ? K.mix('#ffffff', I.TONES.qing, x / 0.2) : I.tone((x - 0.2) / 0.8);
    toneCache.set(q, c);
  }
  return c;
}
/** piecewise-linear envelope through [u, value] pairs */
const pw = (...k) => (u) => {
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (u <= k[i][0]) {
      const a = k[i - 1], b = k[i];
      return a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0]);
    }
  }
  return k[k.length - 1][1];
};
const one = () => 1;

/**
 * One brush mark: bristle bands laid side by side along a spine.
 *   pts       spine (smoothed unless o.raw)          o.n     samples along it — fixed, so the texture never boils
 *   o.width   (u) → full width                       o.tone  (v, k) → ink density across the brush (v 0…1, the +normal
 *                                                             side is v = 1) and along it (k 0…1, with o.stops > 1)
 *   o.load    (u) → 1 flooded … 0 starved: bristles skip, edge bristles first (flying white)
 *   o.len     nominal length that the skip pattern is laid along      o.skip  length of a skip
 */
function mark(ctx, pts, o) {
  const n = o.n ?? 30, seed = o.seed ?? 1, len = o.len ?? 100;
  const C = o.raw ? pts : K.catmull(pts, o.seg ?? 6);
  const AL = K.arcLen(C);
  const PX = new Float32Array(n), PY = new Float32Array(n), NX = new Float32Array(n), NY = new Float32Array(n), W = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = K.pointAt(C, i / (n - 1), AL);
    PX[i] = p[0];
    PY[i] = p[1];
  }
  let wMax = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const dx = PX[b] - PX[a], dy = PY[b] - PY[a], m = Math.hypot(dx, dy) || 1;
    NX[i] = -dy / m;
    NY[i] = dx / m;
    const u = i / (n - 1);
    let w = o.width(u);
    if (o.wob) w *= 1 + o.wob * (K.noise1((u * len) / (o.wobLen ?? 11), seed + 77) * 2 - 1);
    W[i] = w > 0.25 ? w : 0.25;
    if (W[i] > wMax) wMax = W[i];
  }
  const nb = o.nb ?? K.clamp(Math.round(wMax / 1.4), 3, 26);
  const skip = o.skip ?? Math.max(9, wMax * 2.6);
  const ov = o.overlap ?? 0.14, load = o.load ?? one, stops = o.stops ?? 1;
  for (let j = 0; j < nb; j++) {
    const v = (j + 0.5) / nb, edge = Math.abs(v * 2 - 1);
    const v0 = (j - ov) / nb - 0.5, v1 = (j + 1 + ov) / nb - 0.5;
    const ph = K.hash1(seed * 53 + j * 7) * 97;
    if (stops > 1) {
      const g = ctx.createLinearGradient(PX[0], PY[0], PX[n - 1], PY[n - 1]);
      for (let k = 0; k < stops; k++) g.addColorStop(k / (stops - 1), toneOf(o.tone(v, k / (stops - 1))));
      ctx.fillStyle = g;
    } else ctx.fillStyle = toneOf(o.tone(v, 0.5));
    ctx.beginPath();
    let i0 = -1;
    const flush = (i1) => {
      if (i0 >= 0 && i1 > i0) {
        ctx.moveTo(PX[i0] + NX[i0] * v0 * W[i0], PY[i0] + NY[i0] * v0 * W[i0]);
        for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(PX[i] + NX[i] * v0 * W[i], PY[i] + NY[i] * v0 * W[i]);
        for (let i = i1; i >= i0; i--) ctx.lineTo(PX[i] + NX[i] * v1 * W[i], PY[i] + NY[i] * v1 * W[i]);
        ctx.closePath();
      }
      i0 = -1;
    };
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), dry = 1 - load(u);
      let on = true;
      if (dry > 0.02) {
        const s = (u * len) / skip;
        const nz = 0.7 * K.noise1(s + ph, seed + j * 13) + 0.3 * K.noise1(s * 4.3 + ph * 3, seed + j * 13 + 5);
        on = nz > dry * (0.42 + 0.5 * edge) + 0.04;
      }
      if (on) {
        if (i0 < 0) i0 = i;
      } else flush(i - 1);
    }
    flush(n - 1);
    ctx.fill();
  }
}

const R1 = [Math.cos(0.6), Math.sin(0.6)], R2 = [Math.cos(-1.1), Math.sin(-1.1)];
/** value noise in two rotated octaves, so that its grid never shows in the ink */
function gn(X, Y, scale, seed) {
  const k1 = 1 / scale, k2 = 2.13 / scale;
  return 0.62 * K.noise2((X * R1[0] - Y * R1[1]) * k1 + 7.3, (X * R1[1] + Y * R1[0]) * k1 - 2.1, seed) + 0.38 * K.noise2((X * R2[0] - Y * R2[1]) * k2 - 3.7, (X * R2[1] + Y * R2[0]) * k2 + 9.2, seed + 1);
}

/**
 * Develop ink into xuan paper. `wet` and `dry` are same-size canvases of marks on transparent; returns an opaque
 * ink-on-white canvas to be multiplied onto the paper.
 *   wet ink: the edge creeps irregularly along the fibres (feather), the wash pools unevenly, and a paler halo of
 *            water spreads beyond the ink with a faint tide line at its front
 *   dry ink: stays where the bristles put it, but skips the hollows of the paper
 * o.warp (units) lets the wet ink wander off the stroke as it soaks in, so no blot keeps a drawn outline.
 */
function develop(wet, dry, o = {}) {
  const w = wet.width, h = wet.height, res = o.res ?? RES, seed = o.seed ?? 1;
  const blurred = (src, r) => {
    const c = K.makeCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.filter = `blur(${r * res}px)`;
    x.drawImage(src, 0, 0);
    return x.getImageData(0, 0, w, h).data;
  };
  const A = blurred(wet, o.feather ?? 1.6), B = blurred(wet, o.halo ?? 8), D = blurred(dry, 0.3);
  const out = K.makeCanvas(w, h), octx = out.getContext('2d'), img = octx.createImageData(w, h), d = img.data;
  const [hr, hg, hb] = K.rgb(o.haloTone ?? '#8a8377').map((x) => 1 - x / 255);
  const hs = o.haloStrength ?? 1, ox = o.ox ?? 0, oy = o.oy ?? 0, tooth = o.tooth ?? 0.34, warp = (o.warp ?? 0) * res, bloom = o.bloom ?? 0.3;
  for (let y = 0, i = 0; y < h; y++) {
    const Y = y / res + oy;
    for (let x = 0; x < w; x++, i += 4) {
      const X = x / res + ox;
      // where this bit of paper drew its ink from
      let j = i;
      if (warp > 0) {
        const wx = Math.round(x + warp * ((gn(X, Y, 24, seed + 20) - 0.5) * 2.4 + (gn(X, Y, 5, seed + 22) - 0.5) * 0.7));
        const wy = Math.round(y + warp * ((gn(X, Y, 24, seed + 21) - 0.5) * 2.4 + (gn(X, Y, 5, seed + 23) - 0.5) * 0.7));
        j = (Math.min(h - 1, Math.max(0, wy)) * w + Math.min(w - 1, Math.max(0, wx))) * 4;
      }
      const aA = A[j + 3], aB = B[j + 3], aD = D[i + 3];
      let r = 255, g = 255, b = 255;
      if (aA > 1 || aB > 1 || aD > 1) {
        const nf = gn(X, Y, 2.6, seed), nm = gn(X, Y, 17, seed + 3);
        if (aB > 1) {
          const h0 = aB / 255 + 0.3 * (nm - 0.5) + 0.14 * (nf - 0.5);
          const e = (h0 - 0.15) / 0.035;
          const dk = 1 - (0.3 * B[j] + 0.59 * B[j + 1] + 0.11 * B[j + 2]) / 255; // how dark the ink that bleeds is
          const k = Math.min(1, (0.3 * sstep(0.11, 0.3, h0) + 0.1 * Math.exp(-e * e)) * (0.3 + 1.05 * dk) * hs);
          r *= 1 - k * hr;
          g *= 1 - k * hg;
          b *= 1 - k * hb;
        }
        if (aA > 1) {
          let c = sstep(0.34, 0.62, aA / 255 + 0.5 * (nf - 0.5) + 0.2 * (nm - 0.5));
          c *= 0.86 + 0.3 * gn(X, Y, 8, seed + 9);
          if (c > 1) c = 1;
          c *= 1 - bloom * sstep(0.52, 0.72, gn(X, Y, 36, seed + 12)); // pale blooms where the water stood
          r *= 1 - c * (1 - A[j] / 255);
          g *= 1 - c * (1 - A[j + 1] / 255);
          b *= 1 - c * (1 - A[j + 2] / 255);
        }
        if (aD > 1) {
          const c = (aD / 255) * (1 - tooth * sstep(0.5, 0.74, gn(X, Y, 1.7, seed + 5)));
          r *= 1 - c * (1 - D[i] / 255);
          g *= 1 - c * (1 - D[i + 1] / 255);
          b *= 1 - c * (1 - D[i + 2] / 255);
        }
      }
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}
/** a pair of mark canvases covering the unit rect (x0, y0, w, h) at `res` */
function sheets(x0, y0, w, h, res) {
  const pw_ = Math.ceil(w * res), ph_ = Math.ceil(h * res);
  const mk = () => {
    const c = K.makeCanvas(pw_, ph_), x = c.getContext('2d');
    x.scale(pw_ / w, ph_ / h);
    x.translate(-x0, -y0);
    x.globalCompositeOperation = 'multiply'; // ink over ink darkens
    return [c, x];
  };
  return [...mk(), ...mk()];
}
/** an ink-on-white sprite of the marks painted by paint(wetCtx, dryCtx), in the coordinates it was painted in */
function sprite(x0, y0, w, h, seed, paint, o = {}) {
  const [wet, wctx, dry, dctx] = sheets(x0, y0, w, h, SPR);
  paint(wctx, dctx);
  return { c: develop(wet, dry, { res: SPR, seed, ox: x0, oy: y0, feather: 1.1, halo: 6, warp: 1.1, bloom: 0.1, ...o }), x: x0, y: y0, w, h };
}

// ------------------------------------------------------------------------------------------- the lotus
// One leaf, seen a little from the side: broad side-loaded strokes fanned out from the navel so that they run
// together into a single blot, dark on the near side, paler behind, with one split left as bare paper.
const HUB = [262, 160], SQUAT = 0.72;
// angle°, length, tone at the anticlockwise edge, tone at the clockwise edge, ink left at the rim, half-angle°
const LOBES = [
  [-146, 150, 0.64, 0.5, 0.6, 22],
  [-106, 118, 0.42, 0.32, 1, 23],
  [-66, 140, 0.34, 0.46, 0.9, 23],
  [-26, 178, 0.84, 0.6, 0.25, 22],
  [8, 160, 0.3, 0.44, 0.8, 20],
  [72, 138, 0.95, 0.84, 0.7, 20],
  [106, 172, 0.98, 0.9, 0.6, 21],
  [142, 196, 0.95, 0.7, 0.25, 22],
  [180, 222, 0.76, 0.52, 0.22, 20],
];
const squat = ([x, y]) => [x, HUB[1] + (y - HUB[1]) * SQUAT];
const lobeAt = (deg, len, u, off = 0) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [HUB[0] + c * len * u - s * off, HUB[1] + s * len * u + c * off];
};
const STEM = [[259, 250], [258, 320], [250, 420], [232, 525], [203, 635], [166, 745], [134, 850], [110, 950], [100, 1016]];

function paintLeaf(wet, dry) {
  wet.save();
  wet.translate(0, HUB[1]);
  wet.scale(1, SQUAT);
  wet.translate(0, -HUB[1]);
  LOBES.forEach(([deg, len, d0, d1, tip, half], i) => {
    const bend = (K.hash1(700 + i) - 0.5) * 16, spread = 2 * len * Math.tan((half * Math.PI) / 180);
    const pts = [lobeAt(deg, len, 0), lobeAt(deg, len, 0.4, bend * 0.5), lobeAt(deg, len, 0.75, bend), lobeAt(deg, len, 1, bend * 0.7)];
    const cap = (u) => (u < 0.84 ? 1 : 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - ((u - 0.84) / 0.16) ** 2)));
    mark(wet, pts, { n: 46, len, seed: 900 + i, nb: 24, skip: 34, stops: 2, wob: 0.15, wobLen: 13, width: (u) => (9 + spread * u) * cap(u), tone: (v, k) => K.lerp(d0, d1, v) * (1.06 - 0.16 * k), load: pw([0, 1], [0.62, 1], [1, tip]) });
  });
  // the navel
  wet.fillStyle = toneOf(0.97);
  wet.beginPath();
  wet.ellipse(HUB[0], HUB[1], 17, 15, 0.3, 0, TAU);
  wet.fill();
  wet.restore();
  // the stalk: one long wet stroke, darker down one side
  mark(wet, STEM, { n: 130, len: 780, seed: 908, nb: 6, skip: 70, stops: 3, wob: 0.16, wobLen: 80, width: pw([0, 8], [0.3, 6.6], [0.62, 8.4], [1, 10.5]), tone: (v, k) => 0.8 - 0.3 * v - 0.08 * Math.sin(k * 3.1), load: pw([0, 1], [0.45, 0.92], [0.7, 0.75], [1, 0.9]) });
}
function paintLeafBrush(q) {
  const r = K.rng(93);
  // thorns flicked on to the stalk
  for (let i = 0; i < 13; i++) {
    const u = 0.1 + (0.86 * (i + r())) / 13, k = u * (STEM.length - 1), a = STEM[Math.floor(k)], b = STEM[Math.min(STEM.length - 1, Math.floor(k) + 1)], f = k % 1;
    const x = K.lerp(a[0], b[0], f) + (i % 2 ? 5.4 : -5.2), y = K.lerp(a[1], b[1], f);
    q.add('ink', 1, { w: r.range(1.1, 1.9), line: [x, y, x + r.range(-1.5, 1.5), y + r.range(1.5, 3.4)] });
  }
  // a few veins, pulled out of the navel into the wet leaf: heavy where the brush came down, gone by half-way
  for (const i of [0, 2, 3, 4, 8]) {
    const [deg, len] = LOBES[i], d = deg + r.range(-8, 8), bend = r.range(-16, 16);
    const pts = [lobeAt(d, len, 0.05), lobeAt(d, len, 0.22, bend * 0.3), lobeAt(d, len, 0.42, bend * 0.8), lobeAt(d, len, r.range(0.62, 0.82), bend * 1.6)].map(squat);
    I.stroke(q, pts, { brush: 'ink', tone: 1, weight: r.range(2.0, 2.8), press: [1.4, 0.95, 0.2] });
  }
  // the brush dragged dry along the near rim
  for (const [a0, a1, rad, w] of [[118, 168, 196, 2.3], [150, 186, 214, 1.9], [-40, -14, 170, 2.0]]) {
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const deg = K.lerp(a0, a1, k / 5), a = (deg * Math.PI) / 180, rr = rad * (1 + 0.04 * Math.sin(k * 1.7));
      pts.push(squat([HUB[0] + Math.cos(a) * rr, HUB[1] + Math.sin(a) * rr]));
    }
    I.stroke(q, pts, { brush: 'inkDry', tone: 0.75, weight: w, press: [1.1, 0.85, 0.35] });
  }
}

// ------------------------------------------------------------------------------------------- the road
function paintRoad(wet, dry) {
  const pts = [];
  for (let x = -40; x <= 1040; x += 45) pts.push([x, 807.5 + 5 * (K.noise1(x / 210, 91) - 0.5) + 1.6 * (K.noise1(x / 45, 92) - 0.5)]);
  const width = pw([0, 19], [0.1, 17], [0.3, 14], [0.5, 17], [0.62, 18], [0.8, 13.5], [1, 15]);
  const tone = (v, k) => 0.95 - 0.1 * v - 0.08 * k;
  mark(dry, pts, { n: 260, len: 1080, seed: 911, nb: 15, skip: 80, stops: 3, wob: 0.14, wobLen: 70, width, tone, load: pw([0, 0.9], [0.06, 0.72], [0.16, 0.4], [0.4, 0.16], [0.5, 0.5], [0.58, 0.4], [0.7, 0.18], [0.88, 0.08], [1, 0.2]) });
  // where the loaded brush came down, the stroke is still wet
  mark(wet, pts.slice(0, 4), { n: 24, len: 130, seed: 912, nb: 12, width: (u) => width(u * 0.12) * (0.9 - 0.5 * sstep(0.35, 1, u)), tone: (v) => 0.9 - 0.14 * v, load: pw([0, 1], [0.5, 1], [1, 0.3]), skip: 30 });
}

// ------------------------------------------------------------------------------------------- the fish
const FISH = { x: 672, y: 908, rot: 0.07, eye: [-64, -2], rx: 10.6, ry: 9.2, pr: 3.9 };
const fishPt = (x, y) => {
  const c = Math.cos(FISH.rot), s = Math.sin(FISH.rot);
  return [FISH.x + x * c - y * s, FISH.y + x * s + y * c];
};
const fishPts = (list) => list.map(([x, y]) => fishPt(x, y));
function ringPts(cx, cy, rx, ry, rot, a0, sweep, p = 2.5, n = 64) {
  const out = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n, ca = Math.cos(a), sa = Math.sin(a);
    const x = rx * Math.sign(ca) * Math.abs(ca) ** (2 / p), y = ry * Math.sign(sa) * Math.abs(sa) ** (2 / p);
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}
function paintFish(wet, dry) {
  // a breath of wash for the flank; the belly is left as paper
  mark(wet, fishPts([[-72, 0], [-20, 1], [38, 2], [62, 2]]), { n: 30, len: 140, seed: 921, nb: 14, width: pw([0, 14], [0.3, 30], [0.75, 22], [1, 5]), tone: (v) => 0.36 - 0.3 * v, load: one });
  // the back: one loaded stroke, snout to tail
  mark(wet, fishPts([[-88, -3], [-62, -16.5], [-20, -21], [26, -15], [63, -2]]), { n: 40, len: 160, seed: 922, nb: 9, skip: 26, wob: 0.1, width: pw([0, 4.5], [0.18, 10], [0.5, 13], [0.82, 8.5], [1, 3.5]), tone: (v) => 0.98 - 0.36 * v, load: pw([0, 1], [0.7, 1], [1, 0.7]) });
  // belly: a thin dry line that does not quite close
  mark(dry, fishPts([[-83, 9], [-50, 19.5], [0, 21.5], [38, 14], [58, 6]]), { n: 34, len: 150, seed: 923, nb: 3, skip: 34, width: pw([0, 1.8], [0.4, 2.6], [1, 1.5]), tone: () => 0.62, load: pw([0, 0.9], [0.5, 0.6], [1, 0.45]) });
  // tail: two flicks
  mark(dry, fishPts([[59, -1], [79, -9], [98, -23]]), { n: 20, len: 46, seed: 924, nb: 5, skip: 16, width: pw([0, 5], [0.35, 8], [1, 1.6]), tone: () => 0.95, load: pw([0, 1], [0.4, 0.75], [1, 0.25]) });
  mark(dry, fishPts([[59, 2], [78, 11], [95, 25]]), { n: 20, len: 44, seed: 925, nb: 5, skip: 16, width: pw([0, 4.5], [0.35, 7], [1, 1.5]), tone: () => 0.92, load: pw([0, 1], [0.4, 0.7], [1, 0.2]) });
  // fins: dabs
  mark(wet, fishPts([[-10, -23], [8, -32.5], [25, -27]]), { n: 14, len: 40, seed: 926, nb: 5, width: pw([0, 3], [0.4, 7], [1, 2]), tone: (v) => 0.9 - 0.2 * v, load: pw([0, 1], [1, 0.6]) });
  mark(wet, fishPts([[-45, 9], [-35, 21], [-22, 27]]), { n: 12, len: 30, seed: 927, nb: 4, width: pw([0, 5.5], [0.5, 4.5], [1, 1.4]), tone: () => 0.5, load: one });
  mark(dry, fishPts([[13, 18], [20, 25], [29, 28]]), { n: 10, len: 20, seed: 928, nb: 3, width: pw([0, 4], [1, 1.4]), tone: () => 0.6, load: pw([0, 1], [1, 0.5]) });
  // gill, mouth
  mark(dry, fishPts([[-46, -11], [-42.5, 2], [-47, 13]]), { n: 14, len: 26, seed: 929, nb: 3, width: pw([0, 1.6], [0.5, 2.4], [1, 1.2]), tone: () => 0.75, load: pw([0, 1], [1, 0.5]) });
  mark(wet, fishPts([[-90, 3.5], [-84, 6.5], [-78, 6]]), { n: 8, len: 12, seed: 930, nb: 3, width: pw([0, 2.6], [1, 1.2]), tone: () => 0.95, load: one });
  // the eye: a ring. The pupil is drawn every frame
  const e = fishPt(FISH.eye[0], FISH.eye[1]);
  mark(wet, ringPts(e[0], e[1], FISH.rx, FISH.ry, FISH.rot - 0.1, 2.3, TAU + 0.4), { raw: true, n: 56, len: 64, seed: 931, nb: 3, width: pw([0, 2.8], [0.3, 2.3], [1, 1.7]), tone: () => 0.97, load: one });
}

// ------------------------------------------------------------------------------------------- inscription
/** type blunted into brush writing: jostled, blurred, then re-thresholded against the paper's grain */
function brushGlyphs(str, size, seed) {
  const res = 3, chars = [...str], pitch = size * 1.075, w = size * 1.5, h = pitch * chars.length + size * 0.4;
  const c = K.makeCanvas(w * res, h * res), x = c.getContext('2d');
  x.scale(res, res);
  const r = K.rng(seed);
  chars.forEach((ch, i) => {
    x.save();
    x.translate(w / 2 + r.range(-1.8, 1.8), size * 0.62 + i * pitch);
    x.rotate(r.range(-0.05, 0.05));
    const k = r.range(0.93, 1.07);
    x.scale(k * r.range(0.96, 1.04), k);
    x.font = `900 ${size}px ${K.FONT.cjkSerif}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.lineWidth = size * 0.035;
    x.strokeText(ch, 0, 0);
    x.fillText(ch, 0, 0);
    x.restore();
  });
  const b = K.makeCanvas(c.width, c.height), bx = b.getContext('2d', { willReadFrequently: true });
  bx.filter = `blur(${size * 0.024 * res}px)`;
  bx.drawImage(c, 0, 0);
  const img = bx.getImageData(0, 0, b.width, b.height), d = img.data;
  const ink = K.rgb(I.TONES.jiao);
  for (let y = 0, i = 0; y < b.height; y++) {
    for (let xx = 0; xx < b.width; xx++, i += 4) {
      const a = d[i + 3] / 255;
      if (a <= 0) continue;
      const X = xx / res, Y = y / res;
      const n = K.noise2(X / 1.5, Y / 1.5, seed), m = K.noise2(X / 7, Y / 16, seed + 1);
      let k = sstep(0.36, 0.56, a + 0.16 * (n - 0.5));
      k *= 0.8 + 0.2 * sstep(0.25, 0.6, 0.7 * m + 0.3 * n);
      d[i] = ink[0];
      d[i + 1] = ink[1];
      d[i + 2] = ink[2];
      d[i + 3] = k * 255;
    }
  }
  bx.putImageData(img, 0, 0);
  b.uw = w;
  b.uh = h;
  return b;
}
function titleCard(ctx) {
  const T = TITLES[9];
  // 八大山人寫意 — the title is also the signature
  const zh = brushGlyphs(T.zh, 47, 19);
  I.bleed(ctx, (c) => c.drawImage(zh, 928 - zh.uw / 2, 34, zh.uw, zh.uh), 2.2, 0.3);
  const [e1, e2] = T.en.split(', ');
  const en = { size: 28, font: K.FONT.book, weight: 600, italic: true, align: 'right', color: I.TONES.nong };
  K.text(ctx, e1 + ',', 884, 268, en);
  K.text(ctx, e2, 884, 301, en);
  K.text(ctx, T.date, 884, 332, { ...en, size: 24.5 });
  ctx.save();
  ctx.globalAlpha = 0.88;
  const s1 = K.seal('可得神仙', { size: 41, seed: 91 }), s2 = K.seal('白眼', { size: 42, relief: 'zhu', seed: 92 });
  K.put(ctx, s1, 928 - s1.uw / 2 - 1, 362);
  K.put(ctx, s2, 928 - s2.uw / 2 + 1.5, 362 + s1.uh + 8);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the pelican's marks
// Everything below is in rig-rest coordinates (x forward, y down, origin on the road between the wheels).
const H0 = GEO.head, CB = Math.cos(-0.2), SB = Math.sin(-0.2);
/** beak coordinates: u along the beak from the head's centre, v up */
const bk = (u, v) => [H0[0] + u * CB - v * SB, H0[1] - (u * SB + v * CB)];
const EYE = { c: [25, -286], rx: 15.5, ry: 13.2, rot: -0.14, pr: 5.7, ax: 9.4, ay: 7.3 };

function paintBody(wet, dry) {
  // breast and belly: one flooded pale stroke, shoulder-high at the front and running out at the rump
  mark(wet, [[6, -196], [-46, -189], [-104, -180]], { n: 40, len: 112, seed: 941, nb: 26, stops: 2, wob: 0.06, wobLen: 20, width: pw([0, 38], [0.1, 68], [0.38, 92], [0.7, 76], [0.9, 42], [1, 14]), tone: (v, k) => (0.1 + 0.42 * v ** 1.3) * (0.8 + 0.25 * k), load: one });
  // back and wing: a side-loaded dark stroke laid into it while it is wet, flicked off dry at the tail
  mark(wet, [[-2, -216], [-34, -216], [-70, -203], [-102, -186], [-126, -176]], { n: 40, len: 134, seed: 942, nb: 20, skip: 24, wob: 0.08, width: pw([0, 20], [0.2, 42], [0.5, 40], [0.8, 24], [1, 8]), tone: (v) => 0.55 + 0.43 * v, load: pw([0, 1], [0.6, 1], [0.84, 0.45], [1, 0.25]) });
  // tail: two dry flicks
  mark(dry, [[-98, -191], [-128, -186], [-154, -187]], { n: 20, len: 58, seed: 943, nb: 5, skip: 18, width: pw([0, 7], [0.5, 5], [1, 1.6]), tone: () => 0.95, load: pw([0, 0.9], [1, 0.2]) });
  mark(dry, [[-96, -177], [-124, -165], [-146, -152]], { n: 20, len: 56, seed: 944, nb: 5, skip: 18, width: pw([0, 6.5], [0.5, 4.5], [1, 1.5]), tone: () => 0.92, load: pw([0, 0.9], [1, 0.15]) });
}
function paintHead(wet, dry) {
  // pouch: a swelling pale stroke, tip of the beak back to the throat, darker where the ink settles along the bottom
  mark(wet, [bk(104, -4), bk(86, -12.5), bk(62, -17.5), bk(38, -16.5), bk(18, -9)], { n: 34, len: 92, seed: 951, nb: 16, wob: 0.05, width: pw([0, 2], [0.2, 16], [0.48, 28], [0.75, 25], [1, 8]), tone: (v) => 0.64 - 0.44 * v, load: one });
  // beak: one long dry stroke with a hook at the end of it
  mark(dry, [bk(13, 3), bk(50, 4.6), bk(92, 3), bk(108, 0), bk(108.5, -5.5)], { n: 44, len: 104, seed: 952, nb: 6, skip: 40, width: pw([0, 10], [0.4, 7.4], [0.82, 5], [0.93, 5.2], [1, 2.4]), tone: () => 0.97, load: pw([0, 1], [0.1, 0.95], [0.26, 0.58], [0.8, 0.46], [0.92, 0.9], [1, 0.8]) });
  mark(wet, [bk(13, 3), bk(24, 3.6), bk(34, 4.2)], { n: 10, len: 22, seed: 953, nb: 5, width: pw([0, 10], [1, 6]), tone: () => 0.97, load: pw([0, 1], [0.5, 1], [1, 0.5]) });
  // the eye: a heavy ring, started behind and carried over the top
  mark(wet, ringPts(EYE.c[0], EYE.c[1], EYE.rx, EYE.ry, EYE.rot, 2.5, TAU + 0.45), { raw: true, n: 70, len: 96, seed: 954, nb: 4, skip: 20, width: pw([0, 4.2], [0.3, 3.5], [0.75, 2.6], [1, 2]), tone: () => 0.98, load: pw([0, 1], [0.8, 1], [1, 0.7]) });
  // brow and crown, and the tuft flicked back off it
  mark(wet, [[38, -299], [27, -303.5], [14, -302], [6, -294], [3, -283]], { n: 22, len: 50, seed: 955, nb: 6, width: pw([0, 2.6], [0.3, 6], [0.6, 8], [0.85, 4.6], [1, 2]), tone: (v) => 0.98 - 0.1 * v, load: one });
  mark(dry, [[9, -299], [-7, -301], [-21, -295]], { n: 14, len: 32, seed: 956, nb: 4, skip: 14, width: pw([0, 4.4], [1, 1.4]), tone: () => 0.95, load: pw([0, 1], [1, 0.25]) });
}
function paintRing(wet, dry, seed, a0) {
  const pts = [], N = 110, sweep = TAU + 0.55;
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = a0 + sweep * u;
    const r = 46.3 + 1.1 * Math.sin(2 * a + seed) + 0.7 * Math.sin(3 * a + seed * 2.1) - 2.4 * sstep(0.86, 1, u) + 1.2 * (1 - sstep(0, 0.1, u));
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const width = pw([0, 8], [0.07, 7.2], [0.3, 6.6], [0.75, 6], [1, 3.4]);
  mark(dry, pts, { raw: true, n: 170, len: 310, seed, nb: 5, skip: 40, wob: 0.1, width, tone: () => 0.96, load: pw([0, 1], [0.1, 0.9], [0.26, 0.6], [0.8, 0.44], [1, 0.6]) });
  mark(wet, pts.slice(0, 11), { raw: true, n: 16, len: 40, seed: seed + 1, nb: 5, width: (u) => width(u * 0.095) * (0.92 - 0.5 * sstep(0.5, 1, u)), tone: () => 0.96, load: one });
  wet.fillStyle = toneOf(0.92);
  wet.beginPath();
  wet.ellipse(0, 0, 3.2, 2.6, 0.5, 0, TAU);
  wet.fill();
}
function paintFrame(wet, dry) {
  // seat stay and top tube: up from the rear hub, a turn of the wrist, across
  const s1 = [[-80, -50], [-61, -88], [-45.5, -120], [-41, -128.5], [-31, -131.5], [0, -131], [51, -132.5]];
  mark(dry, s1, { n: 46, len: 180, seed: 961, nb: 5, skip: 34, width: pw([0, 7], [0.2, 5], [0.44, 6.6], [0.6, 4.6], [1, 3.6]), tone: () => 0.96, load: pw([0, 1], [0.12, 0.85], [0.3, 0.45], [0.44, 0.9], [0.6, 0.4], [1, 0.3]) });
  // seat tube and down tube: a V through the bottom bracket
  const s2 = [[-43, -124], [-27, -85], [-12.5, -51], [-8, -45], [3, -51], [30, -80], [56, -108]];
  mark(dry, s2, { n: 46, len: 170, seed: 962, nb: 5, skip: 34, width: pw([0, 6.6], [0.3, 5], [0.47, 7], [0.62, 4.6], [1, 3.4]), tone: () => 0.96, load: pw([0, 1], [0.14, 0.8], [0.34, 0.5], [0.47, 0.95], [0.62, 0.42], [1, 0.28]) });
  // handlebar, head tube and fork in one
  const s3 = [[78, -148], [68, -154.5], [51, -151.5], [49.5, -134], [56, -108], [66, -84], [75, -62], [80, -50]];
  mark(dry, s3, { n: 40, len: 140, seed: 963, nb: 5, skip: 30, width: pw([0, 3.4], [0.14, 5.4], [0.34, 5.8], [0.7, 4.8], [1, 3.2]), tone: () => 0.96, load: pw([0, 1], [0.3, 0.9], [0.5, 0.5], [1, 0.35]) });
  for (const [pts, seed] of [[s1.slice(0, 2), 964], [s2.slice(0, 2), 965]]) mark(wet, pts, { raw: true, n: 8, len: 30, seed, nb: 4, width: pw([0, 5.6], [1, 2.6]), tone: () => 0.96, load: pw([0, 1], [0.5, 1], [1, 0.4]) });
  // saddle: a dab
  mark(wet, [[-67, -139.5], [-45, -141.2], [-22, -138]], { n: 12, len: 46, seed: 966, nb: 5, width: pw([0, 4], [0.45, 8], [1, 3]), tone: () => 0.95, load: one });
}

// ------------------------------------------------------------------------------------------- the pelican, per frame
const ap = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
/** a pupil pressed against the rim: a heavy blot, flattened a little where it meets the ring */
function pupil(ctx, c, r, ang, seed) {
  ctx.fillStyle = I.TONES.jiao;
  ctx.beginPath();
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, rr = r * (1 + 0.1 * (K.hash1(seed + i) - 0.5));
    const x = Math.cos(a) * rr * 0.93, y = Math.sin(a) * rr * 1.08; // x radial, y along the rim
    const px = c[0] + x * ca - y * sa, py = c[1] + x * sa + y * ca;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
function limb(ctx, pts, s, o) {
  const [a, b, c] = pts;
  mark(ctx, [K.mixPt(a, b, o.from ?? 0.1), K.mixPt(a, b, 0.82), b, K.mixPt(b, c, 0.18), c], { n: 24, len: 130, seed: o.seed, seg: 5, nb: 4, skip: 30, width: (u) => o.width(u) * s, tone: o.tone, load: o.load });
}
function foot(ctx, poly, s, tone, seed) {
  const heel = K.mixPt(poly[0], poly[7], 0.5), mid = K.mixPt(poly[2], poly[6], 0.5), toe = K.mixPt(poly[3], poly[5], 0.6);
  mark(ctx, [heel, mid, toe], { n: 12, len: 40, seed, nb: 4, skip: 14, width: (u) => (3.4 + 6 * sstep(0, 0.8, u) - 3.4 * sstep(0.85, 1, u)) * s, tone: () => tone, load: pw([0, 1], [0.6, 0.8], [1, 0.4]) });
}
const A_REST = 0.38; // the pupil at rest: ahead and a little down the road (rad; 0 = forward, −π/2 = up)
function inkPelican(ctx, pose) {
  const s = pose.s, S = pose.shapes, pt = pose.pt, G = pose.G;
  const put = (sp, M, at = null) => {
    ctx.save();
    ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
    if (at) ctx.translate(at[0], at[1]);
    ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h);
    ctx.restore();
  };
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; // ink on paper: every mark darkens what is under it
  // far leg: paler, behind everything
  limb(ctx, S.legF, s, { seed: 971, width: pw([0, 5.6], [0.5, 4.4], [1, 2.8]), tone: () => 0.5, load: pw([0, 1], [0.3, 0.7], [1, 0.4]) });
  foot(ctx, S.footF, s, 0.5, 972);
  // bicycle: two brisk rings and three strokes
  put(L.ringR, G.wheelR, GEO.hubR);
  put(L.ringF, G.wheelF, GEO.hubF);
  put(L.frame, G.bike);
  // near leg
  limb(ctx, S.legN, s, { seed: 973, width: pw([0, 7.4], [0.5, 5.4], [1, 3.4]), tone: () => 0.95, load: pw([0, 1], [0.3, 0.72], [1, 0.42]) });
  foot(ctx, S.footN, s, 0.95, 974);
  // body: one wet blot
  put(L.body, G.body);
  // wing reaching for the bar: a greyer, drier stroke
  limb(ctx, [pt.shoulder, pt.elbow, pt.hand], s, { seed: 975, from: 0.3, width: pw([0, 10], [0.5, 7.5], [1, 3.4]), tone: (v) => 0.66 - 0.16 * v, load: pw([0, 1], [0.35, 0.8], [1, 0.36]) });
  // neck: a single curved line from the shoulder to the back of the eye
  const eyeC = ap(G.head, EYE.c), nk = S.neck, m = nk.length / 2, spine = [];
  for (let i = 0; i < m; i++) {
    const p = K.mixPt(nk[i], nk[nk.length - 1 - i], 0.56);
    if (K.dist(p, eyeC) < 13.5 * s) break;
    spine.push(p);
  }
  if (spine.length > 2) {
    K.ribbon(ctx, spine, (u) => (17 - 9 * u) * s, K.rgba(I.TONES.dan, 0.1));
    K.ribbon(ctx, spine, (u) => (13 - 7 * u) * s, K.rgba(I.TONES.dan, 0.12));
    mark(ctx, spine, { raw: true, n: 30, len: 96, seed: 976, nb: 5, skip: 30, width: (u) => pw([0, 10.5], [0.35, 6.6], [1, 4.4])(u) * s, tone: (v) => 0.97 - 0.12 * v, load: pw([0, 1], [0.6, 0.92], [1, 0.75]) });
  }
  // head: eye-ring, brow, beak, pouch
  put(L.head, G.head);
  // the pupil, shoved against the rim
  const e = pose.params.eye ?? [0, 0], k = 1 - Math.min(1, Math.hypot(e[0], e[1]));
  const ang = Math.atan2(e[1] + k * Math.sin(A_REST), e[0] + k * Math.cos(A_REST)), al = ang - EYE.rot;
  const lx = Math.cos(al) * EYE.ax, ly = Math.sin(al) * EYE.ay, cr = Math.cos(EYE.rot), sr = Math.sin(EYE.rot);
  const pc = ap(G.head, [EYE.c[0] + lx * cr - ly * sr, EYE.c[1] + lx * sr + ly * cr]);
  const headRot = Math.atan2(G.head[1], G.head[0]);
  pupil(ctx, pc, EYE.pr * s, Math.atan2(ly * cr + lx * sr, lx * cr - ly * sr) + headRot, 977);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- acting
const A_TOP = Math.atan2(-1, 0.3); // rolled: up against the top of the rim, p.eye → [0.3, −1]
function gaze(t) {
  const dip = 0.22 * K.bump(t, 2.42, 0.1); // a breath of anticipation
  const up = K.ease.io2(K.prog(t, 2.5, 0.5)); // rolls up, slowly … arriving on the beat at t = 3.0
  const on = 0.42 * K.ease.out2(K.prog(t, 3.0, 0.9)); // … and creeps on round the rim while it holds
  const back = K.ease.io3(K.prog(t, 4.0, 0.5)); // lets go
  return K.lerp(A_REST + dip + (A_TOP - A_REST) * up - on, A_REST, back);
}
const rolled = (t) => K.ease.io2(K.prog(t, 2.5, 0.5)) * (1 - K.ease.io3(K.prog(t, 4.0, 0.5)));
// the fish faces left: ahead is π. It rolls its eye half a beat after the pelican, and leaves it there.
const F_REST = Math.PI - 0.3, F_TOP = 1.5 * Math.PI + 0.25;
const fishGaze = (t) => F_REST + (F_TOP - F_REST) * K.ease.io2(K.prog(t, 2.75, 0.5));
const push = (t) => K.ease.io3(K.prog(t, 1.9, 0.9)) * (1 - K.ease.io3(K.prog(t, 3.95, 0.9)));

export default {
  id: 9, key: 'bada', title: TITLES[9], heroT: 3.0,
  // it all but stops in the middle of the sheet while the eye goes round
  profile: [[0, 0], [2.3, 0.46], [3.7, 0.5], [6, 1]],
  act(t, p) {
    const g = K.gate(t, 0.45, 5.55, 0.3), a = gaze(t), k = rolled(t);
    p.eye = [Math.cos(a) * g, Math.sin(a) * g];
    p.headTilt = 0.09 * k; // a tiny tilt of the head
    p.neck = -0.1 * k;
    p.lid = 0;
  },
  camera(t) {
    const k = push(t);
    return k > 0 ? { zoom: 1 + 0.42 * k, dy: 135 * k } : null;
  },

  async init() {
    const paper = I.xuan({ res: RES, seed: 9, base: '#ede5d0', age: 0.3 });
    // wet and dry marks, developed into the paper
    const [wet, wctx, dry, dctx] = sheets(0, 0, 1000, 1000, RES);
    paintLeaf(wctx, dctx);
    paintRoad(wctx, dctx);
    paintFish(wctx, dctx);
    const ink = develop(wet, dry, { res: RES, seed: 90, feather: 2.2, halo: 9, warp: 3.2 });
    // p5.brush: stalk, veins, dry scumble
    const brushed = await K.bake({ w: 1000, h: 1000, res: RES, bg: '#ffffff', seed: 909 }, (b) => {
      const q = I.batch(b);
      paintLeafBrush(q);
      q.flush();
    });
    const base = K.layer(1000, 1000, RES, (ctx) => {
      ctx.drawImage(paper, 0, 0, 1000, 1000);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(ink, 0, 0, 1000, 1000);
      I.bleed(ctx, (c) => c.drawImage(brushed, 0, 0, 1000, 1000), 3.6, 0.42);
      titleCard(ctx);
    });
    L = {
      base,
      body: sprite(-178, -264, 218, 150, 94, paintBody),
      head: sprite(-38, -324, 190, 96, 95, paintHead),
      ringR: sprite(-62, -62, 124, 124, 96, (w, d) => paintRing(w, d, 3, -2.5)),
      ringF: sprite(-62, -62, 124, 124, 97, (w, d) => paintRing(w, d, 8, -1.2)),
      frame: sprite(-102, -174, 204, 146, 98, paintFrame),
    };
  },

  render(ctx, t, env) {
    K.put(ctx, L.base);
    // the fish's pupil
    const a = fishGaze(t) , al = a - (FISH.rot - 0.1);
    const fx = Math.cos(al) * (FISH.rx - FISH.pr - 0.2), fy = Math.sin(al) * (FISH.ry - FISH.pr - 0.2);
    const cr = Math.cos(FISH.rot - 0.1), sr = Math.sin(FISH.rot - 0.1), fe = fishPt(FISH.eye[0], FISH.eye[1]);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    pupil(ctx, [fe[0] + fx * cr - fy * sr, fe[1] + fx * sr + fy * cr], FISH.pr, Math.atan2(fy * cr + fx * sr, fx * cr - fy * sr), 981);
    ctx.restore();
    if (env.pose) inkPelican(ctx, env.pose);
  },
};
