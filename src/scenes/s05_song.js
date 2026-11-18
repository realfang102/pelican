// Section 5 — Song Dynasty Landscape (c. 1000, ink on silk) — homage to Fan Kuan, "Travelers among Mountains and Streams"
// A monumental peak fills the picture; mist cuts it off from wooded knolls, a temple, boulders and a stream.
// The road slips away into the middle distance, so the pelican shrinks to a speck on a mountain trail — and it takes
// a camera push-in (bar 2) to find it.
//
// Technique (shared ink toolkit K.ink): everything is ink on white multiplied onto aged silk. Texture strokes
// (raindrop 雨點皴 on the peak, axe-cut on the boulders), contour lines and trees are p5.brush strokes baked in three
// depth layers; washes and mist are 2D. The trail region is baked a second time at 2.6× so the push-in stays sharp.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const I = K.ink;
const GROUND = '#c9b182';
let L = null;

// ------------------------------------------------------------------------------------------- the trail
// far-ness k: 0 at the frames (full size, on the road line) → 1 on the distant trail (tiny, higher in the picture)
const farK = (lx) => K.smoothstep(40, 300, lx) * (1 - K.smoothstep(700, 960, lx));
const FAR_S = 0.28, FAR_DY = -66;
const trailY = (lx) => K.ROAD_Y + FAR_DY * farK(lx);
const trailS = (lx) => 1 - (1 - FAR_S) * farK(lx);
const trailTh = (lx) => 9 + 30 * (1 - farK(lx));

// ------------------------------------------------------------------------------------------- geometry
const PEAK = [[150, 560], [166, 470], [176, 380], [190, 300], [214, 240], [250, 212], [290, 216], [318, 180], [340, 130], [372, 92], [420, 70], [470, 58], [530, 62], [585, 80], [630, 104], [664, 150], [690, 176], [724, 160], [770, 168], [806, 206], [826, 280], [838, 370], [846, 470], [860, 560]];
const FOLDS = [
  { pts: [[250, 214], [258, 300], [246, 400], [252, 500]], w: 0.9 },
  { pts: [[340, 132], [352, 220], [344, 320], [356, 420], [348, 520]], w: 1.1 },
  { pts: [[455, 64], [462, 160], [448, 260], [458, 360], [452, 480]], w: 0.7 },
  { pts: [[585, 82], [578, 180], [590, 280], [580, 380], [588, 500]], w: 1.0 },
  { pts: [[676, 166], [682, 240], [674, 330], [684, 420], [678, 520]], w: 1.3, gorge: true },
  { pts: [[770, 170], [764, 260], [774, 360], [768, 480]], w: 0.8 },
];
const HILL_L = [[-20, 790], [-20, 650], [30, 606], [100, 580], [180, 592], [250, 626], [320, 612], [390, 650], [436, 704], [452, 790]];
const HILL_R = [[512, 790], [524, 700], [566, 648], [636, 606], [716, 574], [796, 588], [876, 562], [948, 584], [1020, 626], [1020, 790]];
const BOULDERS = [
  [[-20, 1010], [-20, 862], [40, 838], [120, 846], [196, 880], [250, 934], [286, 1010]],
  [[300, 1010], [330, 946], [392, 908], [470, 902], [548, 930], [596, 1010]],
  [[826, 1010], [850, 944], [912, 902], [1020, 896], [1020, 1010]],
  [[612, 1010], [640, 972], [700, 962], [760, 984], [790, 1010]],
];

const inPoly = (x, y, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const peakSmooth = K.jitter(K.catmull(PEAK, 6), 4, 0.035, 9);
const peakPoly = peakSmooth.concat([[860, 640], [150, 640]]);
// ridge height of the peak for every x (first outline crossing from above)
const ridge = new Float32Array(1001).fill(640);
for (let i = 0; i < peakSmooth.length - 1; i++) {
  const a = peakSmooth[i], b = peakSmooth[i + 1];
  const x0 = Math.ceil(Math.min(a[0], b[0])), x1 = Math.floor(Math.max(a[0], b[0]));
  for (let x = x0; x <= x1; x++) {
    if (x < 0 || x > 1000) continue;
    const y = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
    if (y < ridge[x]) ridge[x] = y;
  }
}
const foldX = (f, y) => {
  const p = f.pts;
  if (y < p[0][1] || y > p[p.length - 1][1]) return null;
  for (let i = 0; i < p.length - 1; i++) if (y <= p[i + 1][1]) return p[i][0] + ((p[i + 1][0] - p[i][0]) * (y - p[i][1])) / (p[i + 1][1] - p[i][1]);
  return null;
};
function farDensity(x, y) {
  if (!inPoly(x, y, peakPoly)) return 0;
  let d = 0.26;
  for (const f of FOLDS) {
    const fx = foldX(f, y);
    if (fx == null) continue;
    const dx = x - fx;
    if (dx >= 0 && dx < 58) d += (f.gorge ? 0.9 : 0.55) * (1 - dx / 58);
    else if (dx < 0 && dx > -16) d += (f.gorge ? 0.8 : 0.28) * (1 + dx / 16);
  }
  const top = ridge[Math.round(K.clamp(x, 0, 1000))];
  d += 0.5 * Math.exp(-(y - top) / 60);
  d *= 0.55 + 0.9 * K.noise2(x / 70, y / 110, 5);
  d *= 1 - K.smoothstep(380, 505, y);
  return d;
}
const within = (c, x, y, m = 12) => !c || (x > c.x0 - m && x < c.x1 + m && y > c.y0 - m && y < c.y1 + m);

// ------------------------------------------------------------------------------------------- far: the peak
function paintFar(b0, clip) {
  const b = I.batch(b0);
  const r = K.rng(501);
  // silhouette: strong, angular contour in several lifts of the brush
  for (let i = 0; i < peakSmooth.length - 12; i += 10) {
    const seg = peakSmooth.slice(i, i + 13).filter((_, k) => k % 3 === 0);
    I.stroke(b, seg.map((p) => [p[0] + r.range(-1, 1), p[1] + r.range(-1, 1), r.range(0.7, 1.4)]), { tone: 'jiao', weight: 1.7 });
  }
  // the great vertical creases
  for (const f of FOLDS) {
    I.stroke(b, f.pts.map((p, i) => [p[0], p[1], i === 0 ? 1.4 : 1.1 - i * 0.14]), { tone: 'jiao', weight: f.w * 1.5 });
    I.stroke(b, f.pts.map((p, i) => [p[0] + 5 + r.range(-2, 2), p[1] + 14, 1 - i * 0.16]), { tone: 'nong', weight: f.w * 0.9 });
  }
  // minor cracks
  for (let i = 0; i < 60; i++) {
    const x = r.range(190, 830), y = r.range(110, 440);
    if (farDensity(x, y) <= 0) continue;
    const len = r.range(24, 80);
    I.stroke(b, [[x, y], [x + r.range(-6, 6), y + len * 0.5], [x + r.range(-8, 8), y + len]], { tone: 'zhong', weight: r.range(0.7, 1.1), press: [1.2, 0.8, 0.3] });
  }
  // raindrop texture strokes — thousands of small vertical dabs, denser in the shaded sides of each crease
  I.dabs(b, 26000, (q) => {
    const x = q.range(150, 860), y = q.range(60, 520);
    return q() < farDensity(x, y) ? [x, y, 0.8 + 0.5 * q()] : null;
  }, { seed: 511, len: [4, 9], angle: Math.PI / 2, spread: 0.2, weight: 1.0, tones: [[0.75, 0.5], [0.5, 0.32], [1, 0.18]] });
  // scrub and low forest crowding the summit
  I.dabs(b, 3400, (q) => {
    const x = q.range(196, 826), top = ridge[Math.round(x)];
    const depth = 12 + 34 * K.noise1(x / 40, 7);
    return [x, top - 5 + Math.pow(q(), 1.4) * depth, 1];
  }, { seed: 512, len: [2, 5], angle: Math.PI / 2, spread: 1.4, weight: 1.5, tones: [[1, 0.6], [0.75, 0.4]] });
  for (let i = 0; i < 90; i++) {
    const x = r.range(200, 822), top = ridge[Math.round(x)];
    I.stroke(b, [[x, top + r.range(2, 20)], [x + r.range(-2, 2), top - r.range(6, 14)]], { tone: 'jiao', weight: 0.8 });
  }
  b.flush();
}
function washFar(ctx) {
  ctx.save();
  K.path(ctx, peakPoly, true);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 50, 0, 520);
  g.addColorStop(0, K.rgba(I.TONES.zhong, 0.62));
  g.addColorStop(0.35, K.rgba(I.TONES.dan, 0.5));
  g.addColorStop(0.75, K.rgba(I.TONES.dan, 0.22));
  g.addColorStop(1, K.rgba(I.TONES.dan, 0));
  ctx.fillStyle = g;
  ctx.fillRect(100, 40, 800, 520);
  ctx.drawImage(K.noiseLayer({ w: 760, h: 520, scale: 90, oct: 4, seed: 21, color: I.TONES.zhong, lo: 0.42, hi: 0.85, alpha: 0.4, res: 0.5, stretch: [1.6, 0.5] }), 120, 40, 760, 520);
  // shaded side of each crease
  for (const f of FOLDS) {
    const band = f.pts.map(([x, y]) => [x + (f.gorge ? 4 : 24), y]);
    ctx.save();
    const m = ctx.getTransform();
    ctx.filter = `blur(${10 * Math.hypot(m.a, m.b)}px)`;
    K.ribbon(ctx, K.catmull(band, 5), f.gorge ? 46 : 44, K.rgba(I.TONES.nong, f.gorge ? 0.55 : 0.26));
    ctx.restore();
  }
  // dark cap of vegetation
  ctx.save();
  const m = ctx.getTransform();
  ctx.filter = `blur(${7 * Math.hypot(m.a, m.b)}px)`;
  K.ribbon(ctx, peakSmooth.filter((p) => p[1] < 330).map(([x, y]) => [x, y + 14]), 30, K.rgba(I.TONES.nong, 0.5));
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- middle distance
const TREES_MID = [];
{
  const r = K.rng(601);
  const hillTop = (poly, x) => {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      if (a[0] !== b[0] && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]) && a[1] < 780) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
    return 700;
  };
  for (let x = 8; x < 440; x += r.range(22, 34)) TREES_MID.push({ x, y: hillTop(HILL_L, x) + r.range(4, 26), h: r.range(52, 92), kind: r.pick(['dot', 'jie', 'dot', 'pine']), seed: Math.round(x) });
  for (let x = 540; x < 1000; x += r.range(20, 32)) {
    const temple = x > 706 && x < 812;
    TREES_MID.push({ x, y: hillTop(HILL_R, x) + (temple ? r.range(34, 52) : r.range(4, 28)), h: temple ? r.range(40, 54) : r.range(54, 96), kind: r.pick(['dot', 'jie', 'dot', 'pine']), seed: Math.round(x) });
  }
  // a second, lower rank of trees on the slopes above the trail
  for (let x = 20; x < 1000; x += r.range(46, 78)) {
    if (x > 440 && x < 524) continue;
    TREES_MID.push({ x, y: K.lerp(hillTop(x < 480 ? HILL_L : HILL_R, x), trailY(x), 0.55) + r.range(-8, 8), h: r.range(44, 70), kind: r.pick(['jie', 'dot', 'pine']), seed: Math.round(x) + 7 });
  }
  TREES_MID.sort((a, b) => a.y - b.y);
}
function mule(b, x, y, k, pack = true) {
  const P = (px, py) => [x + px * k, y + py * k];
  I.stroke(b, [P(-15, -16), P(0, -18), P(15, -16)], { tone: 'nong', weight: 5.5 * k, press: [1, 1.2, 1] });
  for (const lx of [-13, -8, 9, 14]) I.stroke(b, [P(lx, -12), P(lx + 1, 0)], { tone: 'jiao', weight: 1.1 * k, press: [1.1, 0.9, 0.7] });
  I.stroke(b, [P(15, -18), P(21, -25), P(27, -24)], { tone: 'nong', weight: 2.6 * k });
  I.stroke(b, [P(21, -26), P(20, -33)], { tone: 'jiao', weight: 0.9 * k });
  I.stroke(b, [P(23, -26), P(24, -33)], { tone: 'jiao', weight: 0.9 * k });
  I.stroke(b, [P(-16, -17), P(-21, -9)], { tone: 'nong', weight: 0.9 * k });
  if (pack) {
    I.stroke(b, [P(-9, -22), P(-9, -31), P(8, -31), P(8, -22)], { brush: 'inkFine', tone: 'jiao', weight: 1.4 * k, press: [1, 1, 1], curve: 0 });
    I.stroke(b, [P(-9, -31), P(8, -22)], { brush: 'inkFine', tone: 'nong', weight: 1.1 * k });
  }
}
function drover(b, x, y, k, dir = 1) {
  const P = (px, py) => [x + px * k * dir, y + py * k];
  I.stroke(b, [P(0, -22), P(-1, -8)], { tone: 'nong', weight: 3.2 * k, press: [1, 1.1, 1] });
  I.stroke(b, [P(-1, -8), P(-3, 0)], { tone: 'jiao', weight: 1.1 * k });
  I.stroke(b, [P(0, -8), P(3, 0)], { tone: 'jiao', weight: 1.1 * k });
  I.stroke(b, [P(-6, -25), P(0, -29), P(6, -25)], { tone: 'jiao', weight: 1.4 * k, press: [1, 1, 1] }); // hat
  I.stroke(b, [P(1, -18), P(8, -14), P(9, -30)], { brush: 'inkFine', tone: 'jiao', weight: 1.1 * k }); // arm + whip
}
function paintMid(b0, clip) {
  const b = I.batch(b0);
  const r = K.rng(611);
  for (const hill of [HILL_L, HILL_R]) {
    const top = hill.slice(1, -1), sm = K.catmull(top, 6);
    for (let i = 0; i < sm.length - 10; i += 8) {
      const seg = sm.slice(i, i + 11).filter((_, k) => k % 2 === 0);
      if (!seg.some((p) => within(clip, p[0], p[1], 40))) continue;
      I.stroke(b, seg.map((p) => [p[0], p[1] + r.range(-1, 1), r.range(0.8, 1.4)]), { tone: 'jiao', weight: 1.5 });
    }
    // inner contours and texture following the slope
    for (let k = 1; k <= 2; k++) {
      const inner = top.map(([x, y]) => [x + (hill === HILL_L ? -8 : 10) * k, y + 26 * k + 8 * Math.sin(x / 30 + k)]);
      if (!inner.some((p) => within(clip, p[0], p[1], 40))) continue;
      I.stroke(b, inner.map((p) => [p[0] + r.range(-6, 6), p[1] + r.range(-5, 5), r.range(0.4, 1)]), { tone: 'qing', weight: 1.0 });
    }
    I.dabs(b, 3200, (q) => {
      const x = q.range(-10, 1010), y = q.range(560, 790);
      if (!within(clip, x, y) || !inPoly(x, y, hill)) return null;
      const yr = trailY(x);
      if (y > yr - 5 && y < yr + trailTh(x) + 4) return null;
      return q() < 0.3 + 0.6 * K.noise2(x / 50, y / 40, 9) ? [x, y, 1] : null;
    }, { seed: 612 + (hill === HILL_L ? 0 : 1), len: [4, 9], angle: Math.PI / 2 + (hill === HILL_L ? 0.25 : -0.25), spread: 0.3, weight: 0.95, tones: [[0.75, 0.55], [0.5, 0.45]] });
  }
  // temple roofs among the trees on the right-hand knoll
  if (within(clip, 760, 570, 80)) {
    const roof = (cx, y, hw, hh) => {
      I.stroke(b, [[cx - hw * 0.72, y - hh], [cx + hw * 0.72, y - hh]], { brush: 'inkFine', tone: 'jiao', weight: 2.2, press: [1, 1, 1] });
      I.stroke(b, [[cx - hw * 0.72, y - hh], [cx - hw * 0.9, y - 4], [cx - hw - 7, y - 7]], { brush: 'inkFine', tone: 'jiao', weight: 1.6, press: [1, 1, 0.6] });
      I.stroke(b, [[cx + hw * 0.72, y - hh], [cx + hw * 0.9, y - 4], [cx + hw + 7, y - 7]], { brush: 'inkFine', tone: 'jiao', weight: 1.6, press: [1, 1, 0.6] });
      I.stroke(b, [[cx - hw - 5, y - 3], [cx, y], [cx + hw + 5, y - 3]], { brush: 'inkFine', tone: 'jiao', weight: 1.8, press: [0.8, 1, 0.8] });
      for (let i = -4; i <= 4; i++) I.stroke(b, [[cx + i * hw * 0.17, y - hh + 1], [cx + i * hw * 0.21, y - 2]], { brush: 'inkFine', tone: 'zhong', weight: 0.8, press: [1, 1, 1] });
      for (const dx of [-0.7, -0.25, 0.25, 0.7]) I.stroke(b, [[cx + dx * hw, y + 1], [cx + dx * hw, y + 20]], { brush: 'inkFine', tone: 'nong', weight: 1.1, press: [1, 1, 1] });
    };
    roof(758, 566, 48, 20);
    roof(700, 590, 24, 12);
    roof(806, 592, 20, 10);
  }
  // trees, back to front
  for (const t of TREES_MID) {
    if (!within(clip, t.x, t.y - t.h / 2, 70)) continue;
    I.tree(b, t.x, t.y, t.h, { kind: t.kind, seed: t.seed, tone: 0.96, density: 1.5, crown: 24 });
  }
  // the trail: lower bank line, pebbles, and a plank bridge over the stream gap
  const bank = [];
  for (let x = -10; x <= 1010; x += 14) bank.push([x, trailY(x) + trailTh(x) + (K.noise1(x * 0.05, 3) - 0.5) * 3]);
  for (let i = 0; i < bank.length - 5; i += 4) {
    const seg = bank.slice(i, i + 6);
    if (!seg.some((p) => within(clip, p[0], p[1], 30))) continue;
    I.stroke(b, seg.map((p) => [p[0], p[1], r.range(0.6, 1.2)]), { tone: 'nong', weight: 0.9 + 1.0 * (1 - farK(seg[2][0])) });
  }
  I.dabs(b, 420, (q) => {
    const x = q.range(0, 1000), y = trailY(x) + q.range(1, trailTh(x) - 1);
    return within(clip, x, y) ? [x, y, 0.4 + 0.6 * (1 - farK(x))] : null;
  }, { seed: 615, len: [1.5, 4], angle: 0, spread: 0.5, weight: 0.7, tones: [[0.5, 1]] });
  if (within(clip, 482, 735, 60)) {
    const y = trailY(482);
    I.stroke(b, [[448, y + 2], [516, y + 2]], { brush: 'inkFine', tone: 'jiao', weight: 1.5, press: [1, 1, 1] });
    I.stroke(b, [[448, y + 8], [516, y + 8]], { brush: 'inkFine', tone: 'jiao', weight: 1.5, press: [1, 1, 1] });
    for (let x = 452; x <= 514; x += 6) I.stroke(b, [[x, y + 2], [x, y + 8]], { brush: 'inkFine', tone: 'nong', weight: 0.9, press: [1, 1, 1] });
    for (const x of [458, 482, 506]) I.stroke(b, [[x, y + 8], [x + 1, y + 26]], { tone: 'jiao', weight: 1.0, press: [1, 1, 0.8] });
    // water threading down between the knolls
    for (let i = 0; i < 9; i++) {
      const x = 470 + i * 3.4;
      I.stroke(b, [[x, 640 + i * 3], [x + 6 + i, 690], [x + 2 + i * 2, y - 4]], { brush: 'inkFine', tone: 'dan', weight: 0.9 });
    }
  }
  // a mule train resting on the trail (the travellers of the original), about to be overtaken
  if (within(clip, 660, 735, 90)) {
    const y = trailY(660) + 1;
    drover(b, 716, y, 0.62, -1);
    mule(b, 688, y, 0.62);
    mule(b, 652, y, 0.62);
    drover(b, 626, y, 0.62, -1);
  }
  b.flush();
}
function washMid(ctx) {
  for (const hill of [HILL_L, HILL_R]) {
    I.wash(ctx, hill, 'dan', 0.55, { feather: 5, seed: 3 });
    I.wash(ctx, hill.map(([x, y]) => [x, Math.min(790, y + 30)]), 'zhong', 0.22, { feather: 14, seed: 4 });
  }
  // foliage mass behind the tree strokes
  for (const t of TREES_MID) I.wash(ctx, K.ellipsePts(t.x, t.y - t.h * 0.72, t.h * 0.34, t.h * 0.3, 10), 'zhong', 0.2, { feather: 7, mottle: 0 });
}
function clearTrail(ctx, alpha = 0.92) {
  const top = [], bot = [];
  for (let x = -10; x <= 1010; x += 10) {
    top.push([x, trailY(x) - 1]);
    bot.push([x, trailY(x) + trailTh(x)]);
  }
  ctx.save();
  const m = ctx.getTransform();
  ctx.filter = `blur(${1.5 * Math.hypot(m.a, m.b)}px)`;
  K.fillPoly(ctx, top.concat(bot.reverse()), K.rgba('#ffffff', alpha));
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- foreground
function paintFore(b0, clip) {
  const b = I.batch(b0);
  const r = K.rng(701);
  BOULDERS.forEach((poly, bi) => {
    const sm = K.catmull(poly.slice(1, -1), 5);
    for (let i = 0; i < sm.length - 8; i += 6) {
      const seg = sm.slice(i, i + 9).filter((_, k) => k % 2 === 0);
      if (!seg.some((p) => within(clip, p[0], p[1], 40))) continue;
      I.stroke(b, seg.map((p) => [p[0], p[1], r.range(0.8, 1.5)]), { tone: 'jiao', weight: 2.6 });
    }
    // facets
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    for (let k = 0; k < 4; k++) {
      const a = poly[1 + ((k * 2) % (poly.length - 2))];
      const pts = [[a[0], a[1] + 4], [K.lerp(a[0], cx, 0.4) + r.range(-12, 12), a[1] + r.range(34, 60)], [K.lerp(a[0], cx, 0.6) + r.range(-10, 10), a[1] + r.range(80, 120)]];
      if (!pts.some((p) => within(clip, p[0], p[1], 30))) continue;
      I.stroke(b, pts, { tone: 'nong', weight: 1.7, press: [1.3, 0.9, 0.4] });
    }
    // axe-cut texture: short slanting wedges
    I.dabs(b, 900, (q) => {
      const x = q.range(-20, 1020), y = q.range(830, 1010);
      if (!within(clip, x, y) || !inPoly(x, y, poly)) return null;
      return q() < 0.35 + 0.6 * K.noise2(x / 40, y / 30, 11 + bi) ? [x, y, 1] : null;
    }, { seed: 711 + bi, len: [6, 14], angle: 1.15, spread: 0.3, weight: 1.6, brush: 'ink', tones: [[0.8, 0.55], [0.55, 0.45]] });
  });
  // big foreground trees
  for (const [x, y, h, kind, seed] of [[62, 852, 150, 'jie', 5], [148, 866, 128, 'dot', 6], [938, 906, 140, 'jie', 7], [990, 900, 110, 'pine', 8], [424, 908, 84, 'dot', 9]]) {
    if (!within(clip, x, y - h / 2, 110)) continue;
    I.tree(b, x, y, h, { kind, seed, tone: 1, density: 1.5, crown: 26, boughs: 5 });
  }
  // the stream: a few long, easy water lines between the rocks; the rest is left as bare silk
  for (let i = 0; i < 7; i++) {
    const x = 590 + i * 30 + r.range(-8, 8), y0 = 872 + r.range(0, 30);
    const pts = [[x, y0], [x + 18, y0 + 44], [x + 44, y0 + 86], [x + 52, 1006]];
    if (!pts.some((p) => within(clip, p[0], p[1], 30))) continue;
    I.stroke(b, pts, { brush: 'inkFine', tone: 'qing', weight: 1.1, press: [0.6, 1, 0.5], curve: 0.8 });
  }
  for (let i = 0; i < 9; i++) {
    const x = r.range(600, 800), y = r.range(900, 990), w = r.range(14, 30);
    if (!within(clip, x, y, 30)) continue;
    I.stroke(b, [[x, y], [x + w * 0.5, y + 2.5], [x + w, y + 0.5]], { brush: 'inkFine', tone: 'dan', weight: 0.9, press: [0.5, 1, 0.4] });
  }
  b.flush();
}
function washFore(ctx) {
  BOULDERS.forEach((poly, i) => {
    I.wash(ctx, poly, 'zhong', 0.55, { feather: 4, seed: 30 + i });
    I.wash(ctx, poly.map(([x, y]) => [x, y + 36]), 'nong', 0.28, { feather: 14, seed: 40 + i });
  });
}

// ------------------------------------------------------------------------------------------- compose a region
async function compose(ground, x0, y0, w, h, res, far, seed) {
  const clip = { x0, y0, x1: x0 + w, y1: y0 + h };
  const bakeOf = (fn, sd) => K.bake({ w, h, res, bg: '#ffffff', seed: sd }, (b, p) => {
    p.translate(-x0, -y0);
    fn(b, clip);
  });
  const farB = far ? await bakeOf(paintFar, seed + 1) : null;
  const midB = await bakeOf(paintMid, seed + 2);
  const foreB = await bakeOf(paintFore, seed + 3);
  const ink = K.layer(w, h, res, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(-x0, -y0);
    ctx.globalCompositeOperation = 'multiply';
    if (far) {
      washFar(ctx);
      ctx.drawImage(farB, x0, y0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
    I.mist(ctx, -10, 418, 1020, 210, { color: '#ffffff', strength: 1, seed: 31, wisps: 0.7 });
    // knolls stand in front of the mist
    for (const hill of [HILL_L, HILL_R]) {
      ctx.save();
      const m = ctx.getTransform();
      ctx.filter = `blur(${3 * Math.hypot(m.a, m.b)}px)`;
      K.fillPoly(ctx, K.catmull(hill, 5, true), 'rgba(255,255,255,0.9)');
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'multiply';
    washMid(ctx);
    ctx.globalCompositeOperation = 'source-over';
    clearTrail(ctx);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(midB, x0, y0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    I.mist(ctx, -10, 742, 1020, 150, { color: '#ffffff', strength: 0.62, seed: 32, wisps: 0.8 });
    clearTrail(ctx, 0.5);
    for (const poly of BOULDERS) {
      ctx.save();
      const m = ctx.getTransform();
      ctx.filter = `blur(${2 * Math.hypot(m.a, m.b)}px)`;
      K.fillPoly(ctx, K.catmull(poly, 5, true), 'rgba(255,255,255,0.94)');
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'multiply';
    washFore(ctx);
    ctx.drawImage(foreB, x0, y0, w, h);
  });
  return K.layer(w, h, res, (ctx) => {
    ctx.drawImage(ground, x0 * ground.res, y0 * ground.res, w * ground.res, h * ground.res, 0, 0, w, h);
    K.putBlend(ctx, ink, 'multiply', 0.95);
    // the waterfall: a thread of bare silk in the dark gorge
    ctx.translate(-x0, -y0);
    ctx.strokeStyle = K.rgba('#dcc89c', 0.85);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    K.spline(ctx, [[681, 228], [679, 290], [682, 350], [678, 410], [681, 470]]);
    ctx.stroke();
    ctx.strokeStyle = K.rgba('#e6d6b0', 0.5);
    ctx.lineWidth = 6;
    K.spline(ctx, [[680, 400], [679, 440], [681, 486]]);
    ctx.stroke();
  });
}

// ------------------------------------------------------------------------------------------- the pelican, in ink
const seedOf = (name) => {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973;
  return h;
};
function inkPelican(ctx, pose) {
  const s = pose.s, lw = Math.max(0.7, 2.1 * s);
  ctx.save();
  for (const p of Rig.parts(pose)) {
    const seed = seedOf(p.name);
    if (p.kind === 'poly') {
      const bird = ['body', 'neck', 'head', 'wing', 'tail', 'pouch', 'beak'].includes(p.role);
      if (bird) {
        K.fillPoly(ctx, p.pts, K.rgba('#eadfbe', 0.94));
        if (p.role === 'wing') K.fillPoly(ctx, p.pts, K.rgba(I.TONES.dan, 0.38));
        if (p.role === 'tail') K.fillPoly(ctx, p.pts, K.rgba(I.TONES.zhong, 0.55));
        if (p.role === 'pouch') K.fillPoly(ctx, p.pts, 'rgba(176,120,60,0.34)');
        if (p.role === 'beak') K.fillPoly(ctx, p.pts, 'rgba(160,110,50,0.22)');
        I.line(ctx, p.pts.concat([p.pts[0]]), { width: lw, d: 0.96, style: 'orchid', seed, smooth: false });
      } else if (p.role === 'scarf') {
        I.blot(ctx, p.pts, 'zhong', 0.8);
      } else {
        I.blot(ctx, p.pts, p.role === 'foot' ? 'zhong' : 'jiao', p.far ? 0.55 : 0.92);
      }
    } else if (p.kind === 'line') {
      if (p.role === 'scarf') I.line(ctx, p.pts, { width: Math.max(1, p.w * 0.8), d: 0.5, style: 'orchid', seed, dry: 0.45 });
      else if (p.role === 'mark') I.line(ctx, p.pts, { width: lw * 0.75, d: 0.7, style: 'nail', seed });
      else I.line(ctx, p.pts, { width: Math.max(lw * 0.9, p.w * (p.role === 'leg' ? 0.55 : 0.46)), d: p.far ? 0.6 : 0.95, style: 'iron', seed, smooth: p.pts.length > 2 ? undefined : false });
    } else if (p.kind === 'wheel') {
      const rim = K.ellipsePts(p.c[0], p.c[1], p.r * 0.93, p.r * 0.93, 40, p.a);
      K.fillPoly(ctx, rim, K.rgba('#e2d3ae', 0.42)); // a breath of body colour so the wheel reads against dark foliage
      I.line(ctx, rim.concat([rim[0], rim[1]]), { width: Math.max(1, 3.4 * s), d: 0.95, style: 'iron', seed, smooth: false });
      ctx.strokeStyle = K.rgba(I.TONES.nong, 0.75);
      ctx.lineWidth = Math.max(0.35, 0.8 * s);
      ctx.beginPath();
      for (const [a, c] of Rig.spokes(p)) {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(c[0], c[1]);
      }
      ctx.stroke();
    } else if (p.kind === 'disc') {
      ctx.fillStyle = I.TONES.nong;
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r, 0, K.TAU);
      ctx.fill();
    } else if (p.kind === 'eye') {
      ctx.fillStyle = I.TONES.jiao;
      ctx.beginPath();
      ctx.arc(p.pupil[0], p.pupil[1], Math.max(0.5, p.pr * 0.95), 0, K.TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the scene
const ZOOM = 2.6;
const push = (t) => K.ease.io3(K.prog(t, 1.9, 1.15)) * (1 - K.ease.io3(K.prog(t, 4.25, 1.15)));

export default {
  id: 5, key: 'song', title: TITLES[5], heroT: 3.2,
  // lingers in the middle distance: slower while it is far away
  profile: [[0, 0], [1.4, 0.3], [4.6, 0.66], [6, 1]],
  path(u) {
    const lx = -K.FRAME + K.PITCH * u;
    return { dy: FAR_DY * farK(lx), s: trailS(lx), rot: Math.atan2(trailY(lx + 3) - trailY(lx - 3), 6) };
  },
  camera(t, c) {
    const k = push(t);
    if (k <= 0) return null;
    const target = K.clamp(c.py - 150 * c.ps, 1080 / 2 / ZOOM + 4, 1000 - 1080 / 2 / ZOOM - 4);
    return { zoom: 1 + (ZOOM - 1) * k, dy: (target - 500) * k };
  },

  async init() {
    const ground = I.silk({ res: 1.2, seed: 5, base: GROUND });
    const base = await compose(ground, 0, 0, 1000, 1000, 1.2, true, 800);
    // colophon and collectors' seals (base only: they sit in the sky, far from the push-in)
    const bctx = base.getContext('2d');
    K.titleBlock(bctx, TITLES[5], 40, 42, {
      color: '#1b1814', zh: { size: 46, weight: 900, font: K.FONT.cjkSerif, tracking: 3 }, en: { size: 26, font: K.FONT.serif, weight: 700 }, date: { size: 23, font: K.FONT.serif, weight: 700 }, gap: 1.26,
    });
    bctx.globalAlpha = 0.86;
    K.put(bctx, K.seal('鵜鶘之印', { size: 46, seed: 3 }), 42, 176);
    K.put(bctx, K.seal('乘風', { size: 34, relief: 'zhu', seed: 4 }), 104, 180);
    K.put(bctx, K.seal('行旅', { size: 40, seed: 6 }), 930, 40);
    K.put(bctx, K.seal('子孫永寶', { size: 44, relief: 'zhu', seed: 7 }), 924, 92);
    bctx.globalAlpha = 1;
    // high-resolution tiles of the trail band for the push-in, feathered into the base
    const tiles = [];
    for (const [x0, w] of [[0, 520], [480, 520]]) {
      const y0 = 500, h = 440;
      const c = await compose(ground, x0, y0, w, h, ZOOM, false, 900 + x0);
      const m = c.getContext('2d');
      m.setTransform(c.width / w, 0, 0, c.height / h, 0, 0);
      m.globalCompositeOperation = 'destination-out';
      const fade = (gx0, gy0, gx1, gy1, rx, ry, rw, rh) => {
        const g = m.createLinearGradient(gx0, gy0, gx1, gy1);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        m.fillStyle = g;
        m.fillRect(rx, ry, rw, rh);
      };
      fade(0, 0, 0, 18, 0, 0, w, 18);
      fade(0, h, 0, h - 18, 0, h - 18, w, 18);
      if (x0 === 0) fade(w, 0, w - 40, 0, w - 40, 0, 40, h);
      else fade(0, 0, 40, 0, 0, 0, 40, h);
      tiles.push({ c, x: x0, y: y0, w, h });
    }
    L = { base, tiles };
  },

  render(ctx, t, env) {
    K.put(ctx, L.base);
    const a = K.smoothstep(1.12, 1.55, env.zoom);
    if (a > 0 && !env.hero) {
      ctx.save();
      ctx.globalAlpha = a;
      for (const tl of L.tiles) ctx.drawImage(tl.c, tl.x, tl.y, tl.w, tl.h);
      ctx.restore();
    }
    if (env.pose) inkPelican(ctx, env.pose);
    I.weave(ctx, 0, 0, 1000, 1000, 0.42);
  },
};
