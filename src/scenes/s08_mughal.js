// Section 8 — Mughal Miniature (c. 1600) — a leaf from an imperial album of Akbar's / Jahangir's atelier:
// opaque watercolour and gold on burnished paper. An indigo margin with a gold arabesque scroll and gold flecks,
// ruled lines in gold, blue and white, calligraphy cartouches above and below, and inside them a court garden in
// the stacked perspective of the miniature: a pavilion seen frontally, its carpet and the tiled terrace seen from
// above, a charbagh pool with channels in plan and its fountain in elevation, cypresses, a hill horizon.
//
// The gag: an ordinary garden party (the cup goes up and down, the musicians play, the fly-whisk waves, the fountain
// plays, birds drift across the sky). On the downbeat of bar 2 the whole picture stops — cup halfway to the mouth,
// hands off the strings, droplets hanging in the air — every head snaps round to the pelican, ladies come to the
// lattice, the falcon lifts off the glove, and three courtiers raise the finger of astonishment to their lips.
// From then on only the heads move, turning one by one as it passes. In the corner the court painter, who never
// stopped working, is already painting it. Afterwards: everyone left staring down the walk.
//
// Technique: Canvas 2D throughout (fine even line + flat jewel colour is the miniature's manner). The page is baked
// once from parametric generators (courtier, head, cypress, tree, tile, carpet, scroll, cloud-band); heads are
// sprites that flip and tilt; a few forearms, the fountain, the falcon and the pelican are drawn per frame.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const TAU = Math.PI * 2;
const RES = 1.6;
const SNAP = 2.0; // the downbeat of bar 2
const C = {
  paper: '#efe4c6', cream: '#f4ecd6', ink: '#21140c', line: '#3b2619',
  indigo: '#1a2550', lapis: '#27469b', lapisLt: '#5d80cc', turq: '#3fa39b',
  verm: '#c63c28', crimson: '#a8263a', orp: '#e3b43a', saffron: '#e58a2b', mauve: '#8a6aa0',
  mal: '#4f9a6c', malDk: '#2f7350',
  stone: '#b5583f', stoneLt: '#cf7c5c', stoneDk: '#8c3f2d', marble: '#f3eddd', marbleSh: '#d7cdb8',
  gold: '#c9a23e',
};
let LY = null; // baked layers
let GOLD = C.gold; // becomes the gold-leaf pattern in init
const col = (c) => (c === 'gold' ? GOLD : c);

// ------------------------------------------------------------------------------------------- layout
const M = 54; // width of the illuminated margin
const X0 = 66, X1 = 934, Y0 = 66, Y1 = 934; // inside the rules
const TP = 172, PY = 176; // bottom of the title panel, top of the picture proper
const TER0 = 330, TER1 = 486; // the tiled terrace
const LAWN0 = 492;
const WALK0 = 784, WALK1 = 834; // the sandstone walk (riding line y = 800)
const POOL = { x: 532, y: 391, w: 86, h: 58 };
const FOUNT = [575, 402];
const BOARD = { x: 730, y: 864, w: 44, h: 40 };
const JALI = { x: 802, y: 406, w: 102, h: 62 };

// ------------------------------------------------------------------------------------------- primitives
let Q = 1; // line-weight compensation inside scaled figures
const LW = 0.85;
function trace(ctx, pts, closed = true, smooth = true) {
  smooth ? K.spline(ctx, pts, closed) : K.path(ctx, pts, closed);
}
function shape(ctx, pts, o = {}) {
  trace(ctx, pts, o.closed !== false, o.smooth !== false);
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  const w = o.w ?? LW * Q;
  if (o.stroke !== null && w > 0) {
    ctx.strokeStyle = o.stroke ?? C.line;
    ctx.lineWidth = w;
    ctx.stroke();
  }
}
const stroke = (ctx, pts, w = LW * Q, c = C.line, smooth = true) => shape(ctx, pts, { closed: false, w, stroke: c, smooth });
function disc(ctx, x, y, r, fill, w = 0, c = C.line) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.05, r), 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (w > 0) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.stroke();
  }
}
function box(ctx, x, y, w, h, fill, lw = 0, c = C.line) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  if (lw > 0) {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.strokeRect(x, y, w, h);
  }
}
/** a lanceolate leaf / petal from (x, y) in direction a */
function leaf(ctx, x, y, a, len, wid, fill, lw = 0, lc = C.line) {
  const c = Math.cos(a), s = Math.sin(a);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + c * len * 0.5 - s * wid, y + s * len * 0.5 + c * wid, x + c * len, y + s * len);
  ctx.quadraticCurveTo(x + c * len * 0.5 + s * wid, y + s * len * 0.5 - c * wid, x, y);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    ctx.strokeStyle = lc;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
function rosette(ctx, x, y, r, n, fill, centre, a0 = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU, px = x + Math.cos(a) * r * 0.6, py = y + Math.sin(a) * r * 0.6;
    ctx.moveTo(px + r * 0.42, py);
    ctx.arc(px, py, r * 0.42, 0, TAU);
  }
  ctx.fill();
  if (centre) disc(ctx, x, y, r * 0.3, centre);
}
function spiralPts(cx, cy, r0, r1, a0, a1, n = 22) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = K.lerp(a0, a1, u), r = K.lerp(r0, r1, u);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
function archTo(ctx, x0, x1, yB, yS, yT) {
  const xm = (x0 + x1) / 2, w = x1 - x0, h = yS - yT;
  ctx.moveTo(x0, yB);
  ctx.lineTo(x0, yS);
  ctx.bezierCurveTo(x0, yS - h * 0.75, xm - w * 0.16, yT + h * 0.1, xm, yT);
  ctx.bezierCurveTo(xm + w * 0.16, yT + h * 0.1, x1, yS - h * 0.75, x1, yS);
  ctx.lineTo(x1, yB);
  ctx.closePath();
}
function arch(ctx, x0, x1, yB, yS, yT) {
  ctx.beginPath();
  archTo(ctx, x0, x1, yB, yS, yT);
}
function bboxOf(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}
function grid(x0, y0, x1, y1, step, fn) {
  let row = 0;
  for (let y = y0; y <= y1; y += step * 0.86, row++) for (let x = x0 + (row % 2 ? step / 2 : 0); x <= x1; x += step) fn(x, y, row);
}
function ikDown(S, H, l1, l2) {
  const dx = H[0] - S[0], dy = H[1] - S[1];
  const d = K.clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
  const a = Math.acos(K.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), b = Math.atan2(dy, dx);
  const e1 = [S[0] + Math.cos(b - a) * l1, S[1] + Math.sin(b - a) * l1], e2 = [S[0] + Math.cos(b + a) * l1, S[1] + Math.sin(b + a) * l1];
  return e1[1] > e2[1] ? e1 : e2;
}
const wrap1 = (x) => ((x % 1) + 1) % 1;

// ------------------------------------------------------------------------------------------- gold leaf
function buildGold() {
  return K.layer(1000, 1000, 1, (ctx) => {
    ctx.fillStyle = K.linGrad(ctx, 0, 0, 1000, 1000, [[0, '#d4ab44'], [0.5, '#c59b36'], [1, '#d0a640']]);
    ctx.fillRect(0, 0, 1000, 1000);
    // burnish: lighter clouds drawn out along the stroke of the agate, darker where the leaf is thin
    ctx.drawImage(K.noiseLayer({ scale: 70, oct: 3, seed: 801, color: '#f6e29a', lo: 0.42, hi: 0.82, alpha: 0.8, res: 0.4, stretch: [1.7, 0.5] }), 0, 0, 1000, 1000);
    ctx.drawImage(K.noiseLayer({ scale: 46, oct: 3, seed: 802, color: '#93701f', lo: 0.5, hi: 0.9, alpha: 0.5, res: 0.4 }), 0, 0, 1000, 1000);
    K.grain(ctx, 0, 0, 1000, 1000, { color: '#fff8cf', alpha: 0.9, seed: 803, size: 1, density: 0.09 });
    K.grain(ctx, 0, 0, 1000, 1000, { color: '#6e5014', alpha: 0.5, seed: 804, size: 1, density: 0.06 });
  });
}

// ------------------------------------------------------------------------------------------- illumination
/** a gold arabesque scroll along the straight run A→B: an undulating stem with a spiral tendril and blossom in every bay */
function scrollRun(ctx, ax, ay, bx, by, o = {}) {
  const amp = o.amp ?? 12.5, lw = o.lw ?? 1.35;
  const len = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / len, dy = (by - ay) / len, nx = -dy, ny = dx;
  const nW = Math.max(1, Math.round(len / (o.wl ?? 90))), wl = len / nW, rot = Math.atan2(dy, dx);
  const P = (s, off) => [ax + dx * s + nx * off, ay + dy * s + ny * off];
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const stem = [];
  for (let i = 0, n = Math.ceil(len / 3); i <= n; i++) {
    const s = (i / n) * len;
    stem.push(P(s, amp * Math.sin((s / wl) * TAU)));
  }
  K.path(ctx, stem);
  ctx.lineWidth = lw;
  ctx.stroke();
  for (let k = 0; k < nW * 2; k++) {
    const sign = k % 2 ? -1 : 1, s0 = (k * wl) / 2, se = s0 + wl / 4, cOff = -sign * amp * 0.22;
    const r0 = Math.hypot(wl / 4, cOff), th0 = Math.atan2(-cOff, -wl / 4), sp = [];
    for (let i = 0; i <= 46; i++) {
      const u = i / 46, th = th0 + sign * u * 1.32 * TAU, r = r0 * Math.pow(1 - u, 1.15) + 2 * u;
      sp.push(P(se + Math.cos(th) * r, cOff + Math.sin(th) * r));
    }
    K.path(ctx, sp);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = lw * 0.85;
    ctx.stroke();
    for (const i of [7, 14, 21, 28, 35]) {
      const a = Math.atan2(sp[i + 1][1] - sp[i][1], sp[i + 1][0] - sp[i][0]);
      leaf(ctx, sp[i][0], sp[i][1], a - sign * 0.9, 7 - i * 0.1, 1.8, GOLD);
      if (i < 22) leaf(ctx, sp[i][0], sp[i][1], a + sign * 1.0, 4.4, 1.3, GOLD);
    }
    const [fx, fy] = P(se, cOff);
    if (k % 3 === 1) {
      for (const da of [-0.75, 0, 0.75]) leaf(ctx, fx, fy, rot - sign * Math.PI / 2 + da, 7.5, 2.4, GOLD);
      disc(ctx, fx, fy, 1.7, '#f6efdc');
    } else rosette(ctx, fx, fy, 5, 6, GOLD, k % 3 ? C.verm : '#f6efdc', k);
    // where the stem crests: a bud on the outer side
    const [bx2, by2] = P(se, sign * amp);
    leaf(ctx, bx2, by2, rot + sign * Math.PI / 2 - 0.5, 6.5, 1.9, GOLD);
    leaf(ctx, bx2, by2, rot + sign * Math.PI / 2 + 0.5, 6.5, 1.9, GOLD);
    disc(ctx, bx2 + nx * sign * 6.2, by2 + ny * sign * 6.2, 1.5, GOLD);
  }
  ctx.restore();
}
function medallion(ctx, x, y, r) {
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * TAU, rr = r * (0.87 + 0.13 * Math.cos(a * 8));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  shape(ctx, pts, { fill: C.lapis, stroke: GOLD, w: 1.7 });
  disc(ctx, x, y, r * 0.6, null, 0.9, GOLD);
  rosette(ctx, x, y, r * 0.44, 8, GOLD, C.verm);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    disc(ctx, x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, 1.1, GOLD);
  }
}
/** the Chinese-derived cloud band of Persianate illumination: a ruyi-headed cloud trailing two wisps */
function cloudBand(ctx, cx, cy, s, o = {}) {
  const fill = o.fill ?? GOLD, ink = o.ink ?? 'rgba(84,54,8,0.85)', dir = o.dir ?? 1;
  const bumps = [[-17, 2, 6.5], [-8, -4, 8], [3, -6.5, 9.5], [13, -3, 7.5], [20, 2.5, 5.5]];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s * dir, s);
  ctx.lineCap = 'round';
  const body = () => {
    ctx.beginPath();
    for (const [x, y, r] of bumps) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.moveTo(23, 4);
    ctx.ellipse(1, 4, 22, 5.5, 0, 0, TAU);
  };
  const tails = [K.ribbonPoly(K.catmull([[-16, 6], [-28, 10], [-38, 6.5], [-49, 10]], 6), (u) => 6.5 * (1 - u) + 0.5), K.ribbonPoly(K.catmull([[16, 6], [27, 10.5], [36, 7], [46, 11]], 6), (u) => 6 * (1 - u) + 0.5)];
  if (o.outline) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5 / s;
    body();
    ctx.stroke();
    for (const t of tails) {
      K.path(ctx, t, true);
      ctx.stroke();
    }
  }
  ctx.fillStyle = fill;
  body();
  ctx.fill();
  for (const t of tails) {
    K.path(ctx, t, true);
    ctx.fill();
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.75 / s;
  bumps.forEach(([x, y, r], i) => {
    const a0 = Math.PI * (i % 2 ? 0.1 : 0.9);
    K.path(ctx, spiralPts(x, y, r * 0.76, r * 0.12, a0, a0 + (i % 2 ? -1 : 1) * 7.2, 24));
    ctx.stroke();
  });
  ctx.restore();
}
function cartouchePts(x0, y0, x1, y1, r) {
  const cy = (y0 + y1) / 2, h = y1 - y0;
  const end = (xe, d) => [
    [xe - d * r, y0], [xe - d * r * 0.5, y0 + h * 0.06], [xe - d * r * 0.42, y0 + h * 0.24], [xe - d * r * 0.66, y0 + h * 0.33],
    [xe - d * r * 0.2, y0 + h * 0.42], [xe, cy], [xe - d * r * 0.2, y1 - h * 0.42],
    [xe - d * r * 0.66, y1 - h * 0.33], [xe - d * r * 0.42, y1 - h * 0.24], [xe - d * r * 0.5, y1 - h * 0.06], [xe - d * r, y1],
  ];
  return [[x0 + r + 30, y0], [x1 - r - 30, y0], ...end(x1, 1), [x1 - r - 30, y1], [x0 + r + 30, y1], ...end(x0, -1).reverse()];
}
function rules(ctx, x0, y0, x1, y1) {
  ctx.save();
  ctx.lineJoin = 'miter';
  const R = (d, w, c) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.strokeRect(x0 - d, y0 - d, x1 - x0 + 2 * d, y1 - y0 + 2 * d);
  };
  R(6, 12, C.cream);
  R(9.7, 3.8, GOLD);
  R(11.8, 0.7, C.ink);
  R(7.6, 0.5, C.ink);
  R(6.4, 1.9, C.lapisLt);
  R(5.2, 0.5, C.ink);
  R(3.2, 0.5, C.ink);
  R(1.8, 1.7, GOLD);
  R(0.4, 0.8, C.ink);
  ctx.restore();
}
function drawMargin(ctx) {
  ctx.fillStyle = C.indigo;
  ctx.fillRect(0, 0, 1000, 1000);
  ctx.drawImage(K.noiseLayer({ scale: 60, oct: 3, seed: 811, color: '#33498f', lo: 0.42, hi: 0.85, alpha: 0.5, res: 0.4 }), 0, 0, 1000, 1000);
  ctx.drawImage(K.noiseLayer({ scale: 30, oct: 3, seed: 812, color: '#0c1330', lo: 0.5, hi: 0.9, alpha: 0.45, res: 0.4 }), 0, 0, 1000, 1000);
  const r = K.rng(813);
  ctx.fillStyle = GOLD;
  for (let i = 0; i < 7500; i++) {
    const x = r() * 1000, y = r() * 1000, rad = r.range(0.3, 0.95);
    if (x > M && x < 1000 - M && y > M && y < 1000 - M) continue;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU);
    ctx.fill();
  }
  const c = M / 2 - 1;
  scrollRun(ctx, 58, c, 942, c);
  scrollRun(ctx, 942, 1000 - c, 58, 1000 - c);
  scrollRun(ctx, c, 772, c, 58);
  scrollRun(ctx, c, 942, c, 846);
  scrollRun(ctx, 1000 - c, 58, 1000 - c, 772);
  scrollRun(ctx, 1000 - c, 846, 1000 - c, 942);
  for (const [x, y] of [[c, c], [1000 - c, c], [c, 1000 - c], [1000 - c, 1000 - c]]) medallion(ctx, x, y, 17);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.3;
  ctx.strokeRect(4.5, 4.5, 991, 991);
}
function drawTitlePanel(ctx) {
  const T = TITLES[8], h = TP - Y0;
  box(ctx, X0, Y0, X1 - X0, h, GOLD);
  // small blossoms pricked over the gold
  grid(190, Y0 + 5, 812, TP - 4, 13, (x, y, row) => {
    leaf(ctx, x, y, 2.4, 4.6, 1.2, '#2f7350');
    leaf(ctx, x, y, 0.7, 4.6, 1.2, '#2f7350');
    rosette(ctx, x, y - 1, 2.5, 5, (row + Math.round(x / 13)) % 2 ? C.verm : C.lapis, '#f6efdc');
  });
  for (const [a, b, dir] of [[X0, 184, 1], [816, X1, -1]]) {
    box(ctx, a, Y0, b - a, h, C.lapis);
    ctx.save();
    ctx.beginPath();
    ctx.rect(a, Y0, b - a, h);
    ctx.clip();
    ctx.drawImage(K.noiseLayer({ w: 120, h: 110, scale: 30, oct: 3, seed: 821, color: '#1a2f78', lo: 0.4, hi: 0.9, alpha: 0.6, res: 0.5 }), a, Y0, b - a, h);
    cloudBand(ctx, (a + b) / 2, Y0 + 36, 1.0, { dir });
    cloudBand(ctx, (a + b) / 2 + 5 * dir, Y0 + 78, 0.82, { dir: -dir });
    for (const [px, py] of [[a + 10, Y0 + 10], [b - 10, Y0 + 10], [a + 10, TP - 9], [b - 10, TP - 9], [(a + b) / 2, Y0 + 57]]) rosette(ctx, px, py, 2.6, 5, GOLD, '#f6efdc');
    ctx.restore();
    const x = dir > 0 ? b : a;
    box(ctx, x - 2.2, Y0, 4.4, h, C.cream);
    box(ctx, x - 1.1, Y0, 2.2, h, C.verm);
    stroke(ctx, [[x - 2.2, Y0], [x - 2.2, TP]], 0.5, C.ink, false);
    stroke(ctx, [[x + 2.2, Y0], [x + 2.2, TP]], 0.5, C.ink, false);
  }
  shape(ctx, cartouchePts(196, Y0 + 9, 804, TP - 9, 36), { fill: C.cream, w: 1.2, stroke: C.ink });
  shape(ctx, cartouchePts(202, Y0 + 13.5, 798, TP - 13.5, 33), { fill: null, w: 0.9, stroke: C.lapis });
  for (const x of [226, 774]) {
    rosette(ctx, x, (Y0 + TP) / 2, 4.2, 6, GOLD, C.verm);
    disc(ctx, x + (x < 500 ? 13 : -13), (Y0 + TP) / 2, 1.5, C.lapis);
  }
  K.text(ctx, T.zh, 500, Y0 + 40, { size: 47, font: K.FONT.cjkSerif, weight: 700, align: 'center', baseline: 'middle', color: C.ink, tracking: 5 });
  K.text(ctx, T.en, 500, Y0 + 78.5, { size: 30, font: K.FONT.book, weight: 600, italic: true, align: 'center', baseline: 'middle', color: C.ink, tracking: 0.6 });
  // the rule between the panel and the picture
  box(ctx, X0, TP, X1 - X0, PY - TP, GOLD);
  stroke(ctx, [[X0, TP], [X1, TP]], 0.7, C.ink, false);
  stroke(ctx, [[X0, PY], [X1, PY]], 0.7, C.ink, false);
}
function drawDate(ctx) {
  const x0 = 346, x1 = 654, y0 = 880, y1 = Y1;
  box(ctx, x0, y0, x1 - x0, y1 - y0, C.lapis);
  const r = K.rng(831);
  for (let i = 0; i < 130; i++) disc(ctx, r.range(x0 + 3, x1 - 3), r.range(y0 + 3, y1 - 2), r.range(0.3, 0.8), GOLD);
  cloudBand(ctx, x0 + 29, y0 + 28, 0.5, {});
  cloudBand(ctx, x1 - 29, y0 + 28, 0.5, { dir: -1 });
  shape(ctx, cartouchePts(x0 + 54, y0 + 6.5, x1 - 54, y1 - 5, 22), { fill: C.cream, w: 1.1, stroke: C.ink });
  K.text(ctx, TITLES[8].date, 500, (y0 + y1) / 2 + 1.5, { size: 32, font: K.FONT.book, weight: 600, italic: true, align: 'center', baseline: 'middle', color: C.ink, tracking: 1 });
  ctx.lineJoin = 'miter';
  box(ctx, x0, y0, x1 - x0, y1 - y0 + 6, null, 2.6, GOLD);
  box(ctx, x0 - 1.4, y0 - 1.4, x1 - x0 + 2.8, y1 - y0 + 8, null, 0.6, C.ink);
  box(ctx, x0 + 1.4, y0 + 1.4, x1 - x0 - 2.8, y1 - y0 + 4, null, 0.5, C.ink);
  ctx.lineJoin = 'round';
}

// ------------------------------------------------------------------------------------------- architecture
function sandstone(ctx, x, y, w, h, seed = 1) {
  ctx.fillStyle = K.linGrad(ctx, x, 0, x + w, 0, [[0, '#b9604a'], [0.5, '#c36c52'], [1, '#ad553f']]);
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(95,40,28,0.33)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let yy = y + 9; yy < y + h; yy += 9) {
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
  }
  let row = 0;
  for (let yy = y; yy < y + h; yy += 9, row++) {
    for (let xx = x + (row % 2 ? 9 : 0) + ((seed * 5) % 7); xx < x + w; xx += 18) {
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx, yy + 9);
    }
  }
  ctx.stroke();
  ctx.restore();
}
function merlons(ctx, x0, x1, y, w = 8, h = 7, fill = C.stoneLt) {
  const n = Math.round((x1 - x0) / w), ww = (x1 - x0) / n;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = x0 + i * ww;
    ctx.moveTo(x + 0.7, y);
    ctx.lineTo(x + 0.7, y - h * 0.5);
    ctx.lineTo(x + ww / 2, y - h);
    ctx.lineTo(x + ww - 0.7, y - h * 0.5);
    ctx.lineTo(x + ww - 0.7, y);
    ctx.closePath();
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 0.45;
  ctx.stroke();
}
function lattice(ctx, x, y, w, h, step, lw, c, edge) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.lineCap = 'butt';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? c : edge;
    ctx.lineWidth = pass ? lw : lw + 0.9;
    ctx.beginPath();
    for (let d = -h; d < w + h; d += step) {
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d + h, y + h);
      ctx.moveTo(x + d + h, y);
      ctx.lineTo(x + d, y + h);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function column(ctx, cx, y0, y1, w) {
  ctx.fillStyle = K.linGrad(ctx, cx - w / 2, 0, cx + w / 2, 0, [[0, '#d5cab4'], [0.4, '#f8f4e8'], [1, '#cbbfa8']]);
  ctx.fillRect(cx - w / 2, y0 + 8, w, y1 - y0 - 14);
  box(ctx, cx - w / 2, y0 + 8, w, y1 - y0 - 14, null, 0.6);
  shape(ctx, [[cx - w / 2, y1 - 7], [cx + w / 2, y1 - 7], [cx + w * 0.9, y1], [cx - w * 0.9, y1]], { fill: C.marble, smooth: false, w: 0.6 });
  shape(ctx, [[cx - w * 0.5, y0 + 9], [cx - w * 1.7, y0], [cx + w * 1.7, y0], [cx + w * 0.5, y0 + 9]], { fill: C.marble, smooth: false, w: 0.6 });
  box(ctx, cx - w / 2, y0 + 12, w, 1.7, GOLD);
  box(ctx, cx - w / 2, y1 - 10.5, w, 1.7, GOLD);
  box(ctx, cx - w / 2, (y0 + y1) / 2, w, 1.2, C.lapis);
}
function chhatri(ctx, cx, yb, w, h) {
  const yE = yb - h * 0.44;
  for (const sx of [-0.14, 0.14]) box(ctx, cx + sx * w - 0.9, yE, 1.8, yb - 2.5 - yE, C.marbleSh, 0.4);
  box(ctx, cx - w * 0.5, yb - 2.5, w, 2.5, C.marble, 0.5);
  for (const sx of [-0.36, 0.36]) box(ctx, cx + sx * w - 1.3, yE, 2.6, yb - 2.5 - yE, C.marble, 0.5);
  shape(ctx, [[cx - w * 0.64, yE + 1.5], [cx - w * 0.5, yE - 2.5], [cx + w * 0.5, yE - 2.5], [cx + w * 0.64, yE + 1.5]], { fill: C.stoneLt, smooth: false, w: 0.5 });
  box(ctx, cx - w * 0.4, yE - 5.5, w * 0.8, 3, C.marble, 0.5);
  const y0 = yE - 5.5, yt = yb - h * 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.36, y0);
  ctx.bezierCurveTo(cx - w * 0.5, y0 - (y0 - yt) * 0.55, cx - w * 0.2, yt + 1, cx, yt);
  ctx.bezierCurveTo(cx + w * 0.2, yt + 1, cx + w * 0.5, y0 - (y0 - yt) * 0.55, cx + w * 0.36, y0);
  ctx.closePath();
  ctx.fillStyle = K.linGrad(ctx, cx - w * 0.4, 0, cx + w * 0.4, 0, [[0, '#d2c7b0'], [0.38, '#fcf9ef'], [1, '#c5b9a1']]);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,100,80,0.45)';
  ctx.lineWidth = 0.4;
  for (const k of [-0.5, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(cx + k * w * 0.36, y0);
    ctx.quadraticCurveTo(cx + k * w * 0.42, (y0 + yt) / 2, cx, yt);
    ctx.stroke();
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, yt);
  ctx.lineTo(cx, yb - h);
  ctx.stroke();
  disc(ctx, cx, yt - 1.4, 1.8, GOLD, 0.4);
  disc(ctx, cx, yb - h + 0.4, 1, GOLD, 0.3);
}
function hexTiles(ctx, x0, y0, x1, y1, r) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  const w = Math.sqrt(3) * r, cols = ['#f1e8d2', '#b9dccf', '#ead3a2'];
  ctx.strokeStyle = 'rgba(96,66,44,0.55)';
  ctx.lineWidth = 0.45;
  let j = 0;
  for (let y = y0 - r; y < y1 + r; y += 1.5 * r, j++) {
    let i = 0;
    for (let x = x0 - w + (j % 2 ? w / 2 : 0); x < x1 + w; x += w, i++) {
      const q = i - (j >> 1), c = (((q - j) % 3) + 3) % 3;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = cols[c];
      ctx.fill();
      ctx.stroke();
      if (c === 0) rosette(ctx, x, y, r * 0.42, 6, '#3f7fb8', C.orp);
      else disc(ctx, x, y, r * 0.16, c === 1 ? '#2a6a8a' : C.verm);
    }
  }
  ctx.restore();
}
function water(ctx, x, y, w, h) {
  ctx.fillStyle = K.linGrad(ctx, 0, y, 0, y + h, [[0, '#b2d3d8'], [1, '#8bb8c6']]);
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.lineWidth = 0.55;
  let row = 0;
  for (let yy = y + 2.5; yy < y + h + 2; yy += 3.6, row++) {
    ctx.strokeStyle = row % 2 ? 'rgba(255,255,255,0.8)' : 'rgba(62,104,140,0.6)';
    ctx.beginPath();
    for (let xx = x - 4 + (row % 2 ? 3.5 : 0); xx < x + w + 4; xx += 7) {
      ctx.moveTo(xx, yy);
      ctx.quadraticCurveTo(xx + 1.75, yy - 2, xx + 3.5, yy);
      ctx.quadraticCurveTo(xx + 5.2, yy + 1.4, xx + 7, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  box(ctx, x, y, w, h, null, 0.5);
}
function carpet(ctx, x, y, w, h) {
  box(ctx, x, y, w, h, C.verm, 0.7);
  box(ctx, x + 2, y + 2, w - 4, h - 4, GOLD);
  box(ctx, x + 3.2, y + 3.2, w - 6.4, h - 6.4, C.crimson);
  // border of rosettes
  const n = Math.round((w - 14) / 9);
  for (let i = 0; i <= n; i++) {
    const px = x + 7 + (i * (w - 14)) / n;
    for (const py of [y + 6.6, y + h - 6.6]) rosette(ctx, px, py, 2.3, 4, i % 2 ? '#f6efdc' : GOLD, i % 2 ? C.lapis : C.verm, 0.785);
  }
  for (const px of [x + 6.6, x + w - 6.6]) for (let py = y + 15; py < y + h - 12; py += 8) rosette(ctx, px, py, 2.3, 4, GOLD, C.verm, 0.785);
  // field
  box(ctx, x + 10.5, y + 10.5, w - 21, h - 21, C.lapis, 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 10.5, y + 10.5, w - 21, h - 21);
  ctx.clip();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.6;
  grid(x + 12, y + 12, x + w - 8, y + h - 8, 11, (px, py, row) => {
    ctx.beginPath();
    ctx.moveTo(px - 5.5, py);
    ctx.quadraticCurveTo(px - 2.7, py - 3.2, px, py);
    ctx.quadraticCurveTo(px + 2.7, py + 3.2, px + 5.5, py);
    ctx.stroke();
    rosette(ctx, px, py, 2.6, 5, row % 2 ? '#f0b9b4' : '#f6efdc', row % 2 ? C.crimson : C.orp);
  });
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- plants
function cypress(ctx, x, yb, h, w, seed) {
  const r = K.rng(seed);
  box(ctx, x - 1.7, yb - 10, 3.4, 10, '#7a5234', 0.5);
  const wid = (u) => (w / 2) * (u < 0.28 ? 0.5 + 0.5 * Math.sin((u / 0.28) * Math.PI * 0.5) : Math.pow(Math.cos(((u - 0.28) / 0.72) * Math.PI * 0.5), 0.75));
  const Lp = [], Rp = [];
  for (let i = 0; i <= 26; i++) {
    const u = i / 26, y = yb - 8 - u * (h - 8), ww = wid(u) + 0.7 * Math.sin(u * 46);
    Lp.push([x - ww, y]);
    Rp.push([x + ww, y]);
  }
  const pts = Lp.concat(Rp.reverse());
  K.spline(ctx, pts, true);
  ctx.fillStyle = K.linGrad(ctx, x - w / 2, 0, x + w / 2, 0, [[0, '#17402f'], [0.42, '#2c6447'], [1, '#143a2b']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = 0.6;
  for (const [c, n] of [['rgba(96,160,104,0.75)', 150], ['rgba(10,36,26,0.7)', 110]]) {
    ctx.strokeStyle = c;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const u = r(), v = r.range(-1, 1), px = x + v * wid(u), py = yb - 8 - u * (h - 8);
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + v * 1.2, py - 3, px + v * 0.4, py - 6.5);
    }
    ctx.stroke();
  }
  ctx.restore();
  K.spline(ctx, pts, true);
  ctx.strokeStyle = '#0f2e22';
  ctx.lineWidth = 0.7;
  ctx.stroke();
}
function tree(ctx, o) {
  const r = K.rng(o.seed), { x, yb, cx, cy, rx, ry } = o, tc = o.trunk ?? '#8f6a50';
  const tr = K.catmull([[x, yb], [x + (o.bend ?? 4), K.lerp(yb, cy, 0.45)], [cx - 2, cy + ry * 0.35], [cx, cy]], 6);
  shape(ctx, K.ribbonPoly(tr, (u) => K.lerp(o.tw ?? 7, 2.2, u)), { fill: tc, smooth: false, w: 0.7 });
  for (let i = 0; i < 4; i++) stroke(ctx, [[x + r.range(-2, 2), yb - 8 - i * 9], [x + r.range(-1, 3), yb - 12 - i * 9]], 0.5, 'rgba(60,35,20,0.6)');
  const nb = o.branches ?? 5;
  for (let i = 0; i < nb; i++) {
    const a = -Math.PI / 2 + (i / (nb - 1) - 0.5) * 2.5, p0 = tr[Math.floor((0.42 + 0.14 * r()) * (tr.length - 1))];
    const p1 = [cx + Math.cos(a) * rx * 0.78, cy + Math.sin(a) * ry * 0.72];
    const br = K.catmull([p0, [K.lerp(p0[0], p1[0], 0.5) + r.range(-4, 4), K.lerp(p0[1], p1[1], 0.5) + 4], p1], 5);
    shape(ctx, K.ribbonPoly(br, (u) => K.lerp(3, 0.9, u)), { fill: tc, smooth: false, w: 0.5 });
  }
  const cl = [];
  let guard = 0;
  while (cl.length < o.n && guard++ < 5000) {
    const a = r() * TAU, d = Math.sqrt(r()), px = cx + Math.cos(a) * rx * d, py = cy + Math.sin(a) * ry * d;
    if (cl.every((c) => Math.hypot(c[0] - px, c[1] - py) > (o.gap ?? 9))) cl.push([px, py, r()]);
  }
  cl.sort((a, b) => a[1] - b[1]);
  if (o.mass) for (const c of cl) disc(ctx, c[0], c[1], (o.gap ?? 9) * 0.95, o.mass);
  const half = Math.floor(cl.length * (o.split ?? 1));
  cl.slice(0, half).forEach((c) => o.cluster(ctx, c[0], c[1], r, c[2]));
  if (o.mid) o.mid();
  cl.slice(half).forEach((c) => o.cluster(ctx, c[0], c[1], r, c[2]));
}
const mangoCluster = (ctx, x, y, r, v) => {
  const a0 = r() * TAU, g = K.mix('#2f6e45', '#62a056', v);
  for (let i = 0; i < 7; i++) leaf(ctx, x, y, a0 + (i / 7) * TAU, 8.5 + r() * 2.5, 1.9, g, 0.45, '#1a4630');
  if (v > 0.7) {
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, 2.3, 3.1, 0.3, 0, TAU);
    ctx.fillStyle = v > 0.86 ? C.saffron : C.orp;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
};
const blossomCluster = (ctx, x, y, r, v) => {
  for (let i = 0; i < 4; i++) leaf(ctx, x, y, r() * TAU, 6 + r() * 2.5, 1.7, K.mix('#4f8d55', '#86b86c', v), 0.4, '#2a5a3a');
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const px = x + r.range(-5.5, 5.5), py = y + r.range(-5.5, 5.5);
    rosette(ctx, px, py, 2.7, 5, v > 0.45 ? '#fbeae8' : '#f3b7c2', C.crimson, r() * 6);
  }
};
function drawLawn(ctx, x0, y0, x1, y1, seed, top = '#4f9c72', bot = '#448e66') {
  ctx.fillStyle = K.linGrad(ctx, 0, y0, 0, y1, [[0, top], [1, bot]]);
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const r = K.rng(seed), flowers = ['#f6f1e2', '#d9483a', '#ecbc40', '#f3aab8', '#8fa6ea'];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  let row = 0;
  for (let y = y0 + 11; y < y1 - 1; y += 17, row++) {
    for (let x = x0 + 8 + (row % 2 ? 14 : 0); x < x1; x += 28) {
      const px = x + r.range(-5, 5), py = y + r.range(-4, 4), s = r.range(0.8, 1.25);
      ctx.strokeStyle = r() < 0.5 ? '#2c6e4c' : '#387e56';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      const n = 5 + Math.floor(r() * 3), tips = [];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.7 + r.range(-0.12, 0.12), len = s * r.range(4, 7.5);
        const tx = px + Math.cos(a) * len, ty = py + Math.sin(a) * len;
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.cos(a) * len * 0.3, py - len * 0.55, tx, ty);
        tips.push([tx, ty]);
      }
      ctx.stroke();
      if (r() < 0.55) {
        const c = r.pick(flowers);
        for (let i = 0; i < n; i += 2) disc(ctx, tips[i][0], tips[i][1], 1.05 * s, c, 0.3, 'rgba(40,30,20,0.6)');
      }
    }
  }
  ctx.restore();
}
function bloom(ctx, x, y, s, kind) {
  const ol = 'rgba(70,25,20,0.75)';
  if (kind === 'poppy') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      disc(ctx, x + Math.cos(a) * s * 0.62, y + Math.sin(a) * s * 0.62, s * 0.62, i % 2 ? '#d7442e' : C.verm, 0.4, ol);
    }
    disc(ctx, x, y, s * 0.34, '#2a1a18');
  } else if (kind === 'iris') {
    for (const a of [0.5, Math.PI - 0.5]) leaf(ctx, x, y, a, s * 1.9, s * 0.7, '#a184cc', 0.4, '#3a2560');
    for (const a of [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8, -Math.PI / 2]) leaf(ctx, x, y, a, s * 2.3, s * 0.78, '#7a5aa8', 0.4, '#3a2560');
    disc(ctx, x, y, s * 0.3, '#ecbc40');
  } else if (kind === 'lily') {
    for (let i = 0; i < 6; i++) leaf(ctx, x, y, (i / 6) * TAU + 0.2, s * 1.9, s * 0.6, '#faf6ea', 0.4, 'rgba(90,70,50,0.8)');
    disc(ctx, x, y, s * 0.42, C.saffron, 0.3);
  } else {
    for (const a of [-Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45, -Math.PI / 2]) leaf(ctx, x, y + s * 0.6, a, s * 2.5, s * 0.9, a === -Math.PI / 2 ? '#e4603e' : C.verm, 0.4, ol);
  }
}
function flower(ctx, x, y, h, kind, seed) {
  const r = K.rng(seed);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.36 + r.range(-0.08, 0.08), len = h * r.range(0.4, 0.62);
    const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len];
    const mid = [x + Math.cos(a) * len * 0.5 - Math.sin(a) * len * 0.1 * Math.sign(i - 2.5), y + Math.sin(a) * len * 0.55];
    shape(ctx, K.ribbonPoly(K.catmull([[x, y], mid, tip], 5), (u) => 3.4 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)) + 0.3), { fill: i % 2 ? '#3f8452' : '#2f6e48', smooth: false, w: 0.45, stroke: '#1d4a32' });
  }
  const n = kind === 'iris' || kind === 'tulip' ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const tx = x + (i - (n - 1) / 2) * h * 0.32 + r.range(-2, 2), ty = y - h * r.range(0.78, 1);
    ctx.strokeStyle = '#2a6844';
    ctx.lineWidth = 1;
    K.path(ctx, K.catmull([[x, y], [K.lerp(x, tx, 0.3), K.lerp(y, ty, 0.55)], [tx, ty]], 5));
    ctx.stroke();
    bloom(ctx, tx, ty, h * 0.11, kind);
  }
}

// ------------------------------------------------------------------------------------------- courtiers
// Figure-local coordinates: facing +x, y down, standing / sitting on y = 0. Bodies are baked; heads are sprites.
const SKIN = ['#eccaa2', '#deb083', '#c8935f', '#a87248'];
const NECK = { stand: [0, -96.5], kneel: [0.5, -67.5], cross: [0, -66], bust: [0.5, -35.5] };
const WAIST = { stand: -65, kneel: -36, cross: -34.5, bust: -4 };
function withFig(ctx, f, fn) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.k * f.dir, f.k);
  const q = Q;
  Q = 1 / f.k;
  fn();
  Q = q;
  ctx.restore();
}
const toWorld = (f, p) => [f.x + p[0] * f.k * f.dir, f.y + p[1] * f.k];
const toLocal = (f, p) => [(p[0] - f.x) / (f.k * f.dir), (p[1] - f.y) / f.k];
/** a garment: flat colour, a minute repeating pattern clipped to it, a fine outline */
function cloth(ctx, pts, base, pat, smooth = true) {
  trace(ctx, pts, true, smooth);
  ctx.fillStyle = col(base);
  ctx.fill();
  if (pat) {
    ctx.save();
    ctx.clip();
    const b = bboxOf(pts), st = pat.step ?? 4.2, pc = col(pat.col);
    ctx.fillStyle = pc;
    ctx.strokeStyle = pc;
    if (pat.kind === 'dots') {
      ctx.beginPath();
      grid(b.x0, b.y0, b.x1, b.y1, st, (x, y) => {
        ctx.moveTo(x + st * 0.15, y);
        ctx.arc(x, y, st * 0.15, 0, TAU);
      });
      ctx.fill();
    } else if (pat.kind === 'sprig') {
      ctx.beginPath();
      grid(b.x0, b.y0, b.x1, b.y1, st, (x, y) => {
        for (let k = 0; k < 3; k++) {
          const a = -Math.PI / 2 + (k - 1) * 1.1, px = x + Math.cos(a) * st * 0.2, py = y + Math.sin(a) * st * 0.2;
          ctx.moveTo(px + st * 0.11, py);
          ctx.arc(px, py, st * 0.11, 0, TAU);
        }
      });
      ctx.fill();
    } else if (pat.kind === 'stripe') {
      ctx.lineWidth = st * 0.2;
      ctx.beginPath();
      for (let x = b.x0; x <= b.x1; x += st) {
        ctx.moveTo(x, b.y0);
        ctx.lineTo(x, b.y1);
      }
      ctx.stroke();
    }
    ctx.restore();
    trace(ctx, pts, true, smooth);
  }
  ctx.strokeStyle = C.line;
  ctx.lineWidth = LW * Q;
  ctx.stroke();
}
function arm(ctx, S, E, H, c, skin, o = {}) {
  const pts = K.catmull([S, E, H], 5), w0 = o.w0 ?? 7, w1 = o.w1 ?? 4.4, lw = LW * Q;
  shape(ctx, K.ribbonPoly(pts, (u) => K.lerp(w0, w1, u)), { fill: col(c), smooth: false });
  const d = [H[0] - E[0], H[1] - E[1]], m = Math.hypot(d[0], d[1]) || 1, ux = d[0] / m, uy = d[1] / m;
  const cx = H[0] - ux * 1.4, cy = H[1] - uy * 1.4;
  stroke(ctx, [[cx - uy * w1 * 0.5, cy + ux * w1 * 0.5], [cx + uy * w1 * 0.5, cy - ux * w1 * 0.5]], lw * 1.4, o.cuff ?? GOLD, false);
  if (o.hand === false) return;
  const hx = H[0] + ux * 1.7, hy = H[1] + uy * 1.7;
  if (o.point) {
    stroke(ctx, [[hx, hy], [hx + ux * 4.6, hy + uy * 4.6]], 2, C.line, false);
    stroke(ctx, [[hx, hy], [hx + ux * 4.6, hy + uy * 4.6]], 1.2, skin, false);
  }
  disc(ctx, hx, hy, o.glove ? 3.2 : 2.3, o.glove ?? skin, lw * 0.8);
}
function torso(ctx, f, wy) {
  const lw = LW * Q, fold = 'rgba(60,35,20,0.5)';
  cloth(ctx, [[-10.5, wy - 27], [-4, wy - 30.5], [4, wy - 30.5], [10.5, wy - 27], [11.5, wy - 15], [8.8, wy + 1], [-8.8, wy + 1], [-11.5, wy - 15]], f.jama, f.pat);
  shape(ctx, [[-3, wy - 34.5], [3.2, wy - 34.5], [3.6, wy - 29.5], [-3.4, wy - 29.5]], { fill: f.skin, smooth: false, w: lw * 0.8 });
  if (f.lady) {
    shape(ctx, [[-3.6, wy - 30], [0.2, wy - 21.5], [3.8, wy - 30]], { fill: f.skin, smooth: false, w: lw * 0.7 });
    shape(ctx, [[-10.8, wy - 27], [-5, wy - 30.4], [1.5, wy - 17], [-2.5, wy + 1], [-9, wy + 1], [-11.6, wy - 15]], { fill: K.rgba(f.veil, 0.62), w: lw * 0.6 });
    stroke(ctx, [[-5, wy - 30.4], [1.5, wy - 17], [-2.5, wy + 1]], lw * 1.1, GOLD);
    for (const rr of [4.6, 7.8]) {
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI * (0.12 + (0.76 * i) / 6);
        disc(ctx, 0.2 + Math.cos(a) * rr * 0.9, wy - 30 + Math.sin(a) * rr, 0.62, '#fbf7ea', lw * 0.35);
      }
    }
  } else {
    stroke(ctx, [[-3.4, wy - 30], [0.4, wy - 25], [3.6, wy - 30]], lw * 1.4, GOLD, false);
    stroke(ctx, [[0.4, wy - 25], [-3, wy - 16], [-7.8, wy - 6]], lw * 0.7);
    stroke(ctx, [[5, wy - 22], [6.5, wy - 12], [5.5, wy - 4]], lw * 0.5, fold);
    disc(ctx, -7.6, wy - 6.5, 0.9, GOLD, lw * 0.4);
    if (f.pearls) {
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (0.1 + (0.8 * i) / 8);
        disc(ctx, 0.3 + Math.cos(a) * 6.4, wy - 29.5 + Math.sin(a) * 9.5, 0.72, '#fbf7ea', lw * 0.35);
      }
      disc(ctx, 0.3, wy - 19.4, 1.1, C.verm, lw * 0.35);
    }
  }
  shape(ctx, [[-9, wy - 2.8], [9, wy - 2.8], [9.1, wy + 2.6], [-9.1, wy + 2.6]], { fill: col(f.sash), smooth: false });
  stroke(ctx, [[-9, wy - 0.1], [9, wy - 0.1]], lw * 0.5, 'rgba(60,35,20,0.6)', false);
  if (f.pose === 'stand') {
    for (const [xa, xb, yb] of [[1, 0, wy + 24], [4.2, 5.8, wy + 22]]) {
      shape(ctx, [[xa - 1.8, wy + 2.4], [xa + 1.8, wy + 2.4], [xb + 2.1, yb], [xb - 2.1, yb]], { fill: col(f.sash), smooth: false, w: lw * 0.8 });
      stroke(ctx, [[xb - 2, yb - 3], [xb + 2, yb - 3]], lw * 1.2, f.sash === 'gold' ? C.verm : GOLD, false);
    }
    if (f.dagger) shape(ctx, [[-5.6, wy - 6.5], [-3.2, wy - 7], [-2.6, wy + 3.4], [-4.6, wy + 3.8]], { fill: GOLD, smooth: false, w: lw * 0.6 });
  }
}
function body(ctx, f) {
  const lw = LW * Q, J = f.jama, pat = f.pat, fold = 'rgba(60,35,20,0.5)';
  if (f.pose === 'stand') {
    for (const sx of [-4.6, 4.2]) {
      shape(ctx, [[sx - 3, -40], [sx + 3, -40], [sx + 2.4, -5], [sx - 2.2, -5]], { fill: f.trouser ?? '#f0e6cf', smooth: false });
      stroke(ctx, [[sx - 2, -9], [sx + 2.2, -10.5]], lw * 0.6, C.line, false);
      stroke(ctx, [[sx - 2, -12.5], [sx + 2.2, -14]], lw * 0.6, C.line, false);
      shape(ctx, [[sx - 3.2, -5], [sx + 2.6, -5.4], [sx + 7.4, -2.6], [sx + 9.2, -4.2], [sx + 8.4, 0], [sx - 3.2, 0]], { fill: f.shoe ?? C.verm, smooth: false });
    }
    cloth(ctx, [[-8.6, -65], [8.6, -65], [14.5, -52], [19, -37.5], [10, -35], [0, -36.4], [-10, -35], [-19, -37.5], [-14.5, -52]], J, pat);
    for (const [a, b] of [[-4, -13], [1, 2], [5, 12]]) stroke(ctx, [[a, -62], [(a + b) / 2, -50], [b, -37.5]], lw * 0.55, fold);
    stroke(ctx, [[-17.4, -39.8], [-10, -37.4], [0, -38.8], [10, -37.4], [17.4, -39.8]], lw * 1.3, GOLD);
  } else if (f.pose === 'kneel') {
    shape(ctx, [[-16, -1], [-23, -3.6], [-25.5, -0.4], [-18, 0.6]], { fill: f.shoe ?? f.skin });
    cloth(ctx, [[-17, 0], [-18.5, -8], [-12.5, -22], [-8, -35], [8, -35], [15.5, -25], [27, -14], [30.5, -5], [27.5, 0]], J, pat);
    stroke(ctx, [[2, -31], [14, -20], [25, -8]], lw * 0.55, fold);
    stroke(ctx, [[-4, -30], [-10, -16], [-15, -4]], lw * 0.55, fold);
    stroke(ctx, [[6, -25], [12, -12], [13, -2]], lw * 0.55, fold);
    stroke(ctx, [[-16, -2.4], [5, -2.8], [27, -2.4]], lw * 1.2, GOLD);
  } else if (f.pose === 'cross') {
    cloth(ctx, [[-25, 0], [-27, -6.5], [-19, -15], [-8, -33.5], [8, -33.5], [19, -15], [27, -6.5], [25, 0]], J, pat);
    stroke(ctx, [[-22, -5], [-8, -9.5], [5, -3]], lw * 0.55, fold);
    stroke(ctx, [[22, -5], [9, -10.5], [-4, -3]], lw * 0.55, fold);
    shape(ctx, [[-3, -3.4], [4, -4.6], [7.5, -1.6], [1, -0.4]], { fill: f.skin, w: lw * 0.8 });
  }
  torso(ctx, f, WAIST[f.pose]);
  if (f.prop) f.prop(ctx);
  for (const a of f.arms || []) arm(ctx, a.S, a.E, a.H, a.col ?? J, f.skin, a);
}
function tanpura(ctx) {
  // held upright before him, the long neck rising past his face
  stroke(ctx, [[14, -36], [24, -90]], 2.8, C.line, false);
  stroke(ctx, [[14, -36], [24, -90]], 1.8, '#8a5a2c', false);
  for (const u of [0.9, 0.97]) {
    const x = K.lerp(14, 24, u), y = K.lerp(-36, -90, u);
    stroke(ctx, [[x - 2.4, y - 1.3], [x + 2.4, y + 1.3]], 1, C.line, false);
  }
  disc(ctx, 13.5, -33, 7.8, '#c98b3c', LW * Q);
  disc(ctx, 13.5, -33, 4.8, null, 0.5 * Q, 'rgba(90,50,20,0.7)');
  disc(ctx, 13.5, -33, 1.6, '#5a3418');
  stroke(ctx, [[12.6, -30], [23.4, -89]], 0.4, '#fbf7ea', false);
}
function mace(ctx) {
  stroke(ctx, [[13, -3], [13, -106]], 2.3, C.line, false);
  stroke(ctx, [[13, -3], [13, -106]], 1.4, GOLD, false);
  disc(ctx, 13, -108, 2.8, GOLD, 0.5 * Q);
  disc(ctx, 13, -108, 1, C.verm);
}
function drums(ctx) {
  for (const [x, w, c] of [[15, 6.6, '#b9703a'], [25.5, 5.6, '#8a4a2a']]) {
    shape(ctx, [[x - w, -15], [x + w, -15], [x + w * 0.8, -1], [x - w * 0.8, -1]], { fill: c, smooth: false });
    for (let i = -2; i <= 2; i++) stroke(ctx, [[x + i * w * 0.36, -14], [x + (i + 0.5) * w * 0.3, -1.5]], 0.45 * Q, 'rgba(250,240,215,0.75)', false);
    ctx.beginPath();
    ctx.ellipse(x, -15, w, 2.3, 0, 0, TAU);
    ctx.fillStyle = '#f1e7cc';
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = LW * Q;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, -15, w * 0.45, 1, 0, 0, TAU);
    ctx.fillStyle = '#3a2a20';
    ctx.fill();
  }
}
const F = {
  lady1: { x: 107, y: 409, k: 0.82, dir: 1, pose: 'bust', lady: true, jama: C.crimson, pat: { kind: 'dots', col: 'gold', step: 3.6 }, veil: '#e58a2b', sash: 'gold', skin: SKIN[0],
    arms: [{ S: [-8, -29], E: [-11.5, -14], H: [-5, -4.5] }, { S: [8, -29], E: [11.5, -14], H: [5, -4.5] }] },
  att: { x: 174, y: 468, k: 0.84, dir: 1, pose: 'stand', jama: '#efe7d3', pat: { kind: 'sprig', col: '#b8323a', step: 5 }, sash: C.crimson, trouser: C.saffron, shoe: '#2a3f8a', skin: SKIN[2],
    arms: [{ S: [7, -90], E: [15, -82], H: [20, -92] }] },
  prince: { x: 220, y: 461, k: 0.9, dir: 1, pose: 'kneel', jama: '#e6b63c', pat: { kind: 'sprig', col: '#b8323a', step: 5.2 }, sash: C.lapis, skin: SKIN[0], pearls: true,
    arms: [{ S: [-4, -61], E: [-1, -46], H: [9, -37] }] },
  lute: { x: 300, y: 467, k: 0.84, dir: -1, pose: 'kneel', jama: '#3f8a5a', pat: { kind: 'dots', col: 'gold', step: 4 }, sash: C.orp, skin: SKIN[1], prop: tanpura,
    arms: [{ S: [-5, -61], E: [7, -55], H: [19, -63.5] }] },
  drum: { x: 356, y: 467, k: 0.84, dir: -1, pose: 'cross', jama: C.mauve, pat: { kind: 'stripe', col: 'gold', step: 3.4 }, sash: C.verm, skin: SKIN[3], prop: drums, arms: [] },
  gard: { x: 486, y: 352, k: 0.72, dir: 1, pose: 'kneel', jama: '#ece3cc', pat: null, sash: C.verm, skin: SKIN[3],
    arms: [{ S: [-6, -61], E: [-10, -48], H: [-2, -40] }, { S: [6, -61], E: [14, -70], H: [18, -84] }] },
  falc: { x: 716, y: 482, k: 1, dir: 1, pose: 'stand', jama: C.lapis, pat: { kind: 'sprig', col: 'gold', step: 5 }, sash: C.verm, trouser: '#f0e6cf', shoe: C.verm, skin: SKIN[1], dagger: true,
    arms: [{ S: [-8, -91], E: [-12.5, -78], H: [-6, -67] }, { S: [7, -91], E: [17, -80], H: [24, -88], glove: '#b98a52' }] },
  lady2: { x: 812, y: 351, k: 0.86, dir: 1, pose: 'bust', lady: true, jama: C.saffron, pat: { kind: 'dots', col: '#f6efdc', step: 3.6 }, veil: '#a8263a', sash: 'gold', skin: SKIN[0],
    arms: [{ S: [-8, -29], E: [-11.5, -14], H: [-5, -4.5] }] },
  lady3: { x: 878, y: 351, k: 0.86, dir: -1, pose: 'bust', lady: true, jama: '#3f8a5a', pat: { kind: 'dots', col: 'gold', step: 3.6 }, veil: '#e3b43a', sash: 'gold', skin: SKIN[1],
    arms: [{ S: [-8, -29], E: [-11.5, -14], H: [-5, -4.5] }, { S: [8, -29], E: [11.5, -14], H: [5, -4.5] }] },
  serv: { x: 172, y: 922, k: 0.9, dir: 1, pose: 'kneel', jama: '#d98a8f', pat: { kind: 'dots', col: '#f6efdc', step: 4 }, sash: '#3f8a5a', skin: SKIN[2],
    arms: [{ S: [6, -61], E: [14, -48], H: [25, -40] }] },
  c1: { x: 434, y: 484, k: 0.92, dir: 1, pose: 'stand', jama: C.saffron, pat: { kind: 'dots', col: '#f6efdc', step: 4.4 }, sash: '#3f8a5a', trouser: '#f0e6cf', shoe: C.lapis, skin: SKIN[1],
    arms: [{ S: [-8, -91], E: [-11.5, -78], H: [-2.5, -68] }, { S: [8, -91], E: [11.5, -78], H: [2.5, -66] }] },
  c2: { x: 494, y: 484, k: 0.92, dir: -1, pose: 'stand', jama: C.turq, pat: { kind: 'sprig', col: 'gold', step: 5 }, sash: C.crimson, trouser: C.orp, shoe: C.verm, skin: SKIN[2], dagger: true,
    arms: [{ S: [8, -91], E: [11.5, -78], H: [3, -67] }] },
  c3: { x: 654, y: 484, k: 0.94, dir: 1, pose: 'stand', jama: '#d9603a', pat: { kind: 'dots', col: 'gold', step: 4.4 }, sash: C.lapis, trouser: '#f0e6cf', shoe: '#2f8a5a', skin: SKIN[0], prop: mace,
    arms: [{ S: [-8, -91], E: [-11.5, -78], H: [-3, -67] }, { S: [7, -91], E: [15, -83], H: [12.4, -73] }] },
  painter: { x: 800, y: 922, k: 0.92, dir: -1, pose: 'cross', jama: '#efe7d3', pat: { kind: 'stripe', col: '#7f9bd0', step: 3 }, sash: C.orp, skin: SKIN[1],
    arms: [{ S: [-6, -59], E: [-5, -45], H: [7, -37] }] },
};

// ---- heads: profile, facing +x, origin at the base of the neck
const FACE = [[-3.4, 1.5], [-3.6, -4.5], [-7.2, -9], [-8.2, -14.5], [-5.5, -20], [0.5, -22], [5.2, -20.2], [6.6, -16.6], [6.9, -14.2], [7.4, -12.6], [9.7, -9.9], [7.9, -9], [8.1, -7.9], [7.5, -7.2], [7.8, -6.3], [6.9, -5.2], [7, -3.8], [5, -2.4], [2.6, -2.6], [3.2, 1.5]];
const HEADS = {
  lady1: { lady: true, skin: SKIN[0], veil: '#e58a2b' },
  att: { skin: SKIN[2], turban: '#efe7d3', band: C.verm, mustache: true, jewel: false },
  prince: { skin: SKIN[0], turban: '#e99a2e', band: 'gold', plume: true, mustache: true, halo: true },
  lute: { skin: SKIN[1], turban: '#d7848a', band: 'gold', beard: '#1c1210' },
  drum: { skin: SKIN[3], turban: '#f1ead8', band: C.lapis, mustache: true, jewel: false },
  gard: { skin: SKIN[3], turban: '#d8c69c', beard: '#dcd6ca', jewel: false },
  falc: { skin: SKIN[1], turban: C.verm, band: 'gold', plume: true, mustache: true },
  lady2: { lady: true, skin: SKIN[0], veil: '#a8263a' },
  lady3: { lady: true, skin: SKIN[1], veil: '#e3b43a' },
  jali1: { lady: true, skin: SKIN[1], veil: '#8a6aa0' },
  jali2: { lady: true, skin: SKIN[0], veil: '#3fa39b' },
  serv: { skin: SKIN[2], turban: '#7f9bd0', band: '#f1ead8', jewel: false },
  painter: { skin: SKIN[1], turban: '#f1ead8', band: C.orp, beard: '#dcd6ca', jewel: false },
  c1: { skin: SKIN[1], turban: '#4f9a5c', band: 'gold', mustache: true },
  c2: { skin: SKIN[2], turban: '#f1ead8', band: C.verm, beard: '#1c1210' },
  c3: { skin: SKIN[0], turban: '#3a5db0', band: 'gold', mustache: true, plume: true },
};
function headDraw(ctx, h) {
  const lw = 0.55, dk = '#1c1210';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (h.halo) {
    disc(ctx, -0.5, -13, 13.2, GOLD, 0.5, 'rgba(90,60,10,0.8)');
    disc(ctx, -0.5, -13, 11.6, null, 0.4, 'rgba(255,246,200,0.8)');
  }
  if (h.lady) shape(ctx, [[5.4, -21.6], [-1, -24.2], [-8.5, -21], [-11.8, -12], [-12.6, 0], [-11, 7], [-4.5, 7.5], [-4.2, -2], [-7.6, -9], [-6.5, -17], [0, -20.6]], { fill: h.veil, w: lw });
  shape(ctx, [[-8.3, -15], [-2.5, -15.5], [-3.2, -6.5], [-4.2, -4], [-7.4, -8.6]], { fill: dk, w: 0 });
  shape(ctx, FACE, { fill: h.skin, w: lw });
  // soft modelling under the jaw and at the cheek
  ctx.save();
  K.spline(ctx, FACE, true);
  ctx.clip();
  ctx.fillStyle = K.radGrad(ctx, 1.5, -3, 0.5, 6, [[0, 'rgba(120,60,30,0.3)'], [1, 'rgba(120,60,30,0)']]);
  ctx.fillRect(-10, -12, 22, 16);
  ctx.fillStyle = K.radGrad(ctx, 4.6, -9.6, 0.2, 3.2, [[0, 'rgba(200,80,60,0.22)'], [1, 'rgba(200,80,60,0)']]);
  ctx.fillRect(0, -14, 10, 9);
  ctx.restore();
  if (h.beard) {
    shape(ctx, [[-1.6, -10.2], [0.5, -5.5], [3.6, -1.6], [6.6, -1.2], [7.3, -3.8], [6.9, -5.3], [5.2, -6.2], [2.6, -8.6], [0.4, -11]], { fill: h.beard, w: lw * 0.7 });
    stroke(ctx, [[7.7, -8.2], [6.2, -7.8], [4.2, -6.6]], lw * 1.3, h.beard);
  } else if (h.mustache) stroke(ctx, [[7.8, -8.3], [6.3, -7.9], [4.5, -6.9]], lw * 1.25, dk);
  ctx.beginPath();
  ctx.ellipse(-1.3, -11.8, 1.25, 2.1, 0.15, 0, TAU);
  ctx.fillStyle = h.skin;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  // the long eye of the miniature
  shape(ctx, [[2.5, -13.1], [4.2, -14.1], [6.1, -13.4], [4.4, -12.5]], { fill: '#fdfaf0', w: lw * 0.5 });
  disc(ctx, 4.8, -13.3, 0.84, '#1a100a');
  stroke(ctx, [[1.7, -12.8], [4.2, -14.25], [6.35, -13.4]], lw * 1.3, '#1a100a');
  stroke(ctx, [[2.1, -15.5], [4.4, -16.4], [6.6, -15.5]], lw * 0.95, dk);
  stroke(ctx, [[7.6, -7.2], [6.1, -7.45]], lw * 1.1, '#9a3024', false);
  disc(ctx, 8.35, -9.45, 0.28, C.line);
  if (h.lady) {
    shape(ctx, [[6.6, -16.6], [6.5, -19.6], [3.5, -22], [-1, -22.6], [-6, -20.6], [-8.6, -15.5], [-8.4, -9], [-5.6, -3], [-3.6, -4.6], [-4.4, -9.5], [-2.4, -14.5], [1.6, -16.8]], { fill: dk, w: 0 });
    shape(ctx, [[5.2, -21.8], [-1, -24.4], [-8.6, -21.2], [-11.8, -12], [-9, -13], [-6.4, -19.4], [-0.5, -22.4], [4.6, -20.4]], { fill: K.rgba(h.veil, 0.78), w: lw * 0.8, stroke: GOLD });
    for (let i = 0; i <= 4; i++) disc(ctx, K.lerp(6.5, 1.6, i / 4), K.lerp(-17.6, -22, i / 4), 0.5, '#fbf7ea', 0.2);
    disc(ctx, 6.9, -16.6, 0.8, C.verm, 0.25);
    disc(ctx, -1.1, -9, 1.15, GOLD, 0.3);
    disc(ctx, -1.1, -7.3, 0.6, '#fbf7ea', 0.2);
    disc(ctx, 9.1, -9, 0.75, null, 0.4, GOLD);
    stroke(ctx, [[7.6, -7.1], [6.4, -7.3]], lw * 1.6, '#b8281e', false);
  } else {
    const T = [[7, -16.2], [7.8, -19.6], [5.6, -23.4], [0, -25.2], [-6, -24.4], [-10.6, -20.6], [-10.9, -16], [-8.6, -13.2], [-3, -15.5], [2, -16.6]];
    shape(ctx, T, { fill: h.turban, w: lw });
    ctx.save();
    K.spline(ctx, T, true);
    ctx.clip();
    ctx.strokeStyle = K.rgba(K.shade(h.turban, -0.5), 0.75);
    ctx.lineWidth = lw * 0.7;
    for (const [a, b, c, d] of [[6.5, -17, -2, -25.5], [3, -16.6, -6.5, -24.8], [-1, -15.8, -10, -22], [7.6, -20, 3, -25], [-5, -14.6, -11, -18]]) {
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.quadraticCurveTo((a + c) / 2 + 1.5, (b + d) / 2 - 1.5, c, d);
      ctx.stroke();
    }
    if (h.band) {
      ctx.beginPath();
      ctx.moveTo(-11.5, -17.4);
      ctx.quadraticCurveTo(-2, -20.8, 8.4, -18.3);
      ctx.strokeStyle = 'rgba(50,30,15,0.8)';
      ctx.lineWidth = 2.7;
      ctx.stroke();
      ctx.strokeStyle = col(h.band);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    if (h.plume) {
      shape(ctx, [[5.4, -22.4], [6.6, -27], [4.6, -31.6], [3.2, -27.4], [4, -23]], { fill: '#1c1c22', w: lw * 0.6 });
      disc(ctx, 4.6, -32, 0.8, '#fbf7ea', 0.25);
    }
    if (h.jewel !== false) {
      disc(ctx, 6.7, -19.5, 1.3, GOLD, lw * 0.6);
      disc(ctx, 6.7, -19.5, 0.55, C.verm);
    }
    disc(ctx, -1.2, -9.1, 0.7, '#fbf7ea', 0.25);
  }
}
const HEAD_BOX = [-15, -34, 30, 43];
const headSprite = (h) => K.layer(HEAD_BOX[2], HEAD_BOX[3], 5, (ctx) => {
  ctx.translate(-HEAD_BOX[0], -HEAD_BOX[1]);
  headDraw(ctx, h);
});

// ------------------------------------------------------------------------------------------- the picture, part by part
let ridgeMid = null;
function drawSky(ctx) {
  ctx.fillStyle = K.linGrad(ctx, 0, PY, 0, 300, [[0, '#74abba'], [0.4, '#a8ccc6'], [0.75, '#e6dcb4'], [1, '#f3d79c']]);
  ctx.fillRect(X0, PY, X1 - X0, 300 - PY);
  const r = K.rng(31);
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 10; i++) {
    const x = r.range(X0, X1 - 120), y = r.range(244, 282), w = r.range(60, 190);
    K.ribbon(ctx, K.catmull([[x, y], [x + w * 0.5, y - 1.4], [x + w, y + 0.6]], 6), (u) => 2.6 * Math.sin(Math.PI * u) + 0.2, GOLD);
  }
  ctx.globalAlpha = 1;
  const o = { fill: '#fcf7ec', ink: 'rgba(170,104,100,0.85)', outline: true };
  cloudBand(ctx, 296, 206, 0.95, o);
  cloudBand(ctx, 724, 230, 0.7, { ...o, dir: -1 });
  cloudBand(ctx, 496, 198, 0.6, o);
}
function drawHills(ctx) {
  const ridge = (y0, amp, seed, fill, edge) => {
    const f = (x) => y0 - amp * (K.noise1(x * 0.011, seed) - 0.5) * 2 - amp * 0.5 * K.noise1(x * 0.045, seed + 3);
    const pts = [[X0, 304]];
    for (let x = X0; x <= X1 + 4; x += 5) pts.push([x, f(x)]);
    pts.push([X1 + 4, 304]);
    K.fillPoly(ctx, pts, fill);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.6;
    K.path(ctx, pts.slice(1, -1));
    ctx.stroke();
    return f;
  };
  const far = ridge(252, 16, 41, '#a4b7d0', 'rgba(70,90,130,0.55)');
  const r = K.rng(45);
  for (let i = 0; i < 40; i++) {
    const x = r.range(X0, X1);
    disc(ctx, x, far(x) + r.range(3, 12), r.range(1, 2.2), 'rgba(84,112,140,0.5)');
  }
  ridgeMid = ridge(268, 10, 42, '#bccbaa', 'rgba(70,100,80,0.5)');
  // far towns, white on the middle range
  const town = (x0, n, seed) => {
    const q = K.rng(seed);
    box(ctx, x0 - 5, ridgeMid(x0) + 2, n * 7.5 + 10, 3, '#efe2cf', 0.4, 'rgba(90,60,50,0.7)');
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 7.5 + q.range(-1, 1), yb = ridgeMid(x0) + 2, h = q.range(5, 12), w = q.range(5, 8);
      box(ctx, x, yb - h, w, h, i % 3 ? '#f6f0e2' : '#f1d5c6', 0.4, 'rgba(90,60,50,0.7)');
      const k = q();
      if (k < 0.45) {
        ctx.beginPath();
        ctx.arc(x + w / 2, yb - h, w * 0.42, Math.PI, 0);
        ctx.fillStyle = '#fbf8ee';
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,60,50,0.7)';
        ctx.lineWidth = 0.4;
        ctx.stroke();
      } else if (k < 0.7) box(ctx, x + w / 2 - 0.8, yb - h - 7, 1.6, 7, '#f6f0e2', 0.35, 'rgba(90,60,50,0.7)');
      disc(ctx, x + w / 2, yb - h * 0.45, 0.6, 'rgba(60,50,70,0.7)');
    }
  };
  town(222, 13, 46);
  town(712, 6, 47);
  for (let i = 0; i < 60; i++) {
    const x = r.range(X0, X1), y = ridgeMid(x) + r.range(4, 16);
    disc(ctx, x, y, r.range(1.4, 2.8), 'rgba(70,116,84,0.75)');
  }
  ridge(286, 5, 43, '#9dbf8d', 'rgba(50,90,60,0.5)');
}
function drawBackWall(ctx) {
  const r = K.rng(51);
  for (let x = 400; x < 776; x += r.range(15, 24)) {
    const rad = r.range(9, 14), y = 297 - rad * 0.3;
    disc(ctx, x, y, rad, K.mix('#3f6f5a', '#5d8a66', r()), 0.5, 'rgba(30,60,45,0.7)');
    for (let i = 0; i < 12; i++) disc(ctx, x + r.range(-rad, rad) * 0.7, y + r.range(-rad, rad) * 0.7, 0.8, 'rgba(160,196,136,0.75)');
  }
  for (const px of [440, 708]) {
    stroke(ctx, [[px, 298], [px + 1.5, 280], [px + 1, 262]], 1.6, '#7a5a40');
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.42;
      leaf(ctx, px + 1, 262, a, 13, 1.8, '#3f7a52', 0.35, '#1d4a32');
    }
  }
  sandstone(ctx, 396, 298, 376, 32, 2);
  box(ctx, 396, 309, 376, 4, C.marble, 0.4);
  for (let x = 400; x < 772; x += 8) disc(ctx, x, 311, 0.9, x % 16 ? C.lapis : C.verm);
  merlons(ctx, 396, 772, 298, 8, 6.5, C.stoneLt);
  box(ctx, 396, 327, 376, 3, C.marble, 0.4);
}
function drawGarden(ctx) {
  hexTiles(ctx, 396, TER0, 772, TER1, 7.5);
  // flower beds in the upper quarters
  for (const [a, b] of [[404, 556], [594, 764]]) {
    box(ctx, a - 2, 336, b - a + 4, 70, C.marble, 0.5);
    ctx.fillStyle = K.linGrad(ctx, 0, 338, 0, 404, [[0, '#3a7a55'], [1, '#448860']]);
    ctx.fillRect(a, 338, b - a, 66);
    box(ctx, a, 338, b - a, 66, null, 0.4);
    grid(a + 6, 345, b - 4, 400, 9.5, (x, y, row) => {
      stroke(ctx, [[x, y + 3], [x, y]], 0.6, '#1f5238', false);
      leaf(ctx, x, y + 3, -2.3, 3.4, 1, '#2a6a44');
      leaf(ctx, x, y + 3, -0.85, 3.4, 1, '#2a6a44');
      rosette(ctx, x, y - 0.6, 1.9, 5, ['#f6f1e2', '#e0503c', '#ecbc40', '#f3aab8'][(row + Math.round(x / 9.5)) % 4], null);
    });
  }
  // water: channels in plan, marble kerbs
  for (const [x, y, w, h] of [[563, TER0, 24, 58], [396, 408, 133, 24], [621, 408, 151, 24]]) box(ctx, x, y, w, h, C.marble, 0.5);
  water(ctx, 566, TER0, 18, 58);
  water(ctx, 396, 411, 131, 18);
  water(ctx, 623, 411, 149, 18);
  // the pool
  box(ctx, POOL.x - 6, POOL.y - 6, POOL.w + 12, POOL.h + 12, C.marble, 0.6);
  for (let x = POOL.x - 2; x < POOL.x + POOL.w + 4; x += 6) for (const y of [POOL.y - 3, POOL.y + POOL.h + 3]) disc(ctx, x, y, 0.8, x % 12 < 6 ? C.lapis : C.verm);
  for (let y = POOL.y + 2; y < POOL.y + POOL.h; y += 6) for (const x of [POOL.x - 3, POOL.x + POOL.w + 3]) disc(ctx, x, y, 0.8, y % 12 < 6 ? C.lapis : C.verm);
  water(ctx, POOL.x, POOL.y, POOL.w, POOL.h);
  // the fountain, in elevation
  ctx.beginPath();
  ctx.ellipse(575, 426, 10, 4, 0, 0, TAU);
  ctx.fillStyle = C.marble;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  shape(ctx, [[572, 425], [573.4, 414], [571, 410], [573.6, 406], [576.4, 406], [579, 410], [576.6, 414], [578, 425]], { fill: C.marble, w: 0.6 });
  shape(ctx, [[572.2, 406], [575, 400.5], [577.8, 406]], { fill: GOLD, w: 0.5 });
}
function drawTrees(ctx) {
  cypress(ctx, 414, 400, 160, 23, 61);
  tree(ctx, {
    x: 462, yb: 400, cx: 464, cy: 300, rx: 54, ry: 50, n: 60, gap: 10.5, seed: 62, bend: -5, tw: 8, mass: '#24553a', cluster: mangoCluster, split: 0.62,
    mid: () => {
      // the bough he sits on, then the gardener himself
      stroke(ctx, [[462, 372], [478, 356], [502, 349]], 4.6, C.line);
      stroke(ctx, [[462, 372], [478, 356], [502, 349]], 3.4, '#8f6a50');
      withFig(ctx, F.gard, () => body(ctx, F.gard));
    },
  });
  cypress(ctx, 548, 400, 168, 24, 63);
  cypress(ctx, 602, 400, 168, 24, 64);
  tree(ctx, { x: 652, yb: 400, cx: 662, cy: 294, rx: 44, ry: 40, n: 44, gap: 10, seed: 65, bend: 10, tw: 6.5, trunk: '#a57a6a', cluster: blossomCluster });
}
function niche(ctx, x, y, i) {
  arch(ctx, x, x + 14, y + 24, y + 9, y);
  ctx.fillStyle = '#dccba8';
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 0.5;
  ctx.stroke();
  const cx = x + 7, yb = y + 23.5, c = [C.lapis, GOLD, C.turq, C.verm, '#f6f1e2'][i % 5];
  if (i % 3 === 2) {
    // a bowl of fruit
    shape(ctx, [[cx - 4.5, yb - 5], [cx + 4.5, yb - 5], [cx + 2.4, yb], [cx - 2.4, yb]], { fill: c, smooth: false, w: 0.45 });
    for (const [dx, dy] of [[-2, -6.6], [2, -6.6], [0, -8.6]]) disc(ctx, cx + dx, yb + dy, 1.9, dx ? C.saffron : C.verm, 0.35);
  } else {
    // a long-necked flask
    shape(ctx, [[cx - 1.4, yb], [cx - 3.8, yb - 4], [cx - 3, yb - 8], [cx - 0.9, yb - 10], [cx - 0.8, yb - 15], [cx + 0.8, yb - 15], [cx + 0.9, yb - 10], [cx + 3, yb - 8], [cx + 3.8, yb - 4], [cx + 1.4, yb]], { fill: c, w: 0.45 });
    disc(ctx, cx, yb - 16, 1, c, 0.3);
  }
}
function drawPavilion(ctx) {
  // ---- the tower with the jharokha
  sandstone(ctx, X0, 244, 82, 248, 3);
  box(ctx, 143, 244, 5, 248, C.marble, 0.5);
  box(ctx, X0, 318, 77, 4, C.marble, 0.4);
  box(ctx, X0, 436, 77, 4, C.marble, 0.4);
  box(ctx, X0, 238, 82, 6, C.marble, 0.5);
  merlons(ctx, X0, 148, 238, 8.2, 7, C.stoneLt);
  chhatri(ctx, 107, 231, 36, 48);
  // blind window with a lattice
  arch(ctx, 93, 121, 306, 278, 262);
  ctx.fillStyle = '#35222a';
  ctx.fill();
  ctx.save();
  ctx.clip();
  lattice(ctx, 93, 262, 28, 44, 5, 1.3, C.marble, 'rgba(50,25,20,0.8)');
  ctx.restore();
  arch(ctx, 93, 121, 306, 278, 262);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.strokeStyle = C.marble;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // carved panels on the lower tower
  for (const y of [446, 466]) for (const x of [76, 110]) {
    box(ctx, x, y, 28, 14, null, 0.5, 'rgba(250,236,214,0.8)');
    rosette(ctx, x + 14, y + 7, 3.2, 6, 'rgba(250,236,214,0.85)', C.stoneDk);
  }
  // the jharokha: dark room, the lady, the frame, sill and canopy
  arch(ctx, 87, 127, 409, 368, 351);
  ctx.fillStyle = '#2e1d28';
  ctx.fill();
  box(ctx, 87, 372, 40, 5, '#234a3a');
  withFig(ctx, F.lady1, () => body(ctx, F.lady1));
  arch(ctx, 87, 127, 409, 368, 351);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 4.2;
  ctx.stroke();
  ctx.strokeStyle = C.marble;
  ctx.lineWidth = 3;
  ctx.stroke();
  box(ctx, 82, 366, 4.5, 43, C.marble, 0.5);
  box(ctx, 127.5, 366, 4.5, 43, C.marble, 0.5);
  shape(ctx, [[84, 416], [85, 429], [92, 416]], { fill: C.marble, w: 0.5 });
  shape(ctx, [[130, 416], [129, 429], [122, 416]], { fill: C.marble, w: 0.5 });
  box(ctx, 78, 409, 58, 7.5, C.marble, 0.6);
  for (let x = 82; x < 134; x += 5) disc(ctx, x, 412.8, 0.9, x % 10 < 5 ? C.lapis : C.verm);
  shape(ctx, [[76, 353], [85, 342], [107, 337], [129, 342], [138, 353], [138, 356.5], [76, 356.5]], { fill: C.marble, smooth: false, w: 0.6 });
  stroke(ctx, [[78, 354.6], [136, 354.6]], 1.2, C.verm, false);
  stroke(ctx, [[107, 337], [107, 330]], 1.2, GOLD, false);
  disc(ctx, 107, 331.6, 1.8, GOLD, 0.4);

  // ---- the hall
  box(ctx, 148, 344, 244, 84, '#f1e8d3');
  for (const a of [158, 276]) for (let i = 0; i < 5; i++) niche(ctx, a + 6 + i * 20.4, 355, i + (a > 200 ? 2 : 0));
  stroke(ctx, [[148, 386], [392, 386]], 1.4, C.malDk, false);
  stroke(ctx, [[148, 388.4], [392, 388.4]], 0.6, GOLD, false);
  grid(160, 398, 388, 424, 15, (x, y) => {
    leaf(ctx, x, y, -Math.PI / 2 - 0.5, 3.6, 1, 'rgba(60,120,80,0.5)');
    leaf(ctx, x, y, -Math.PI / 2 + 0.5, 3.6, 1, 'rgba(60,120,80,0.5)');
    disc(ctx, x, y - 4, 1, 'rgba(198,60,40,0.5)');
  });
  box(ctx, 148, 428, 244, 42, C.marble);
  carpet(ctx, 156, 428, 228, 42);
  sandstone(ctx, 144, 470, 252, 22, 5);
  box(ctx, 144, 470, 252, 3.4, C.marble, 0.4);
  for (let x = 152; x < 390; x += 34) {
    shape(ctx, cartouchePts(x - 16, 477, x + 22, 488, 5).map(([px, py]) => [px, py]), { fill: null, w: 0.6, stroke: 'rgba(250,236,214,0.85)' });
    disc(ctx, x + 3, 482.5, 1.3, 'rgba(250,236,214,0.9)');
  }
  // the prince's seat and bolster
  box(ctx, 186, 461, 66, 6, '#f6f1e2', 0.6);
  for (let x = 190; x < 250; x += 5) disc(ctx, x, 464, 0.9, x % 10 < 5 ? C.verm : C.lapis);
  ctx.save();
  ctx.translate(199, 440);
  ctx.rotate(-0.16);
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 21, 0, 0, TAU);
  ctx.fillStyle = C.crimson;
  ctx.fill();
  ctx.save();
  ctx.clip();
  grid(-9, -21, 9, 21, 5, (x, y) => rosette(ctx, x, y, 1.5, 4, GOLD, null));
  ctx.restore();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  for (const y of [-21, 21]) disc(ctx, 0, y, 2.2, GOLD, 0.5);
  ctx.restore();
  for (const id of ['att', 'prince', 'lute', 'drum']) withFig(ctx, F[id], () => body(ctx, F[id]));
  for (const cx of [152, 270, 388]) column(ctx, cx, 344, 470, 7);
  // rolled blinds under the lintel
  for (const [a, b] of [[160, 262], [278, 380]]) {
    box(ctx, a, 344, b - a, 6.5, C.crimson, 0.5);
    for (let x = a + 6; x < b; x += 12) box(ctx, x, 344, 2, 6.5, GOLD);
    for (const x of [a + 12, b - 12]) {
      stroke(ctx, [[x, 350.5], [x, 357]], 0.6, GOLD, false);
      disc(ctx, x, 358, 1.3, GOLD, 0.3);
    }
  }
  box(ctx, 146, 330, 248, 14, C.marble, 0.6);
  for (let x = 153; x < 392; x += 11) {
    shape(ctx, [[x, 337], [x + 3.4, 333.4], [x + 6.8, 337], [x + 3.4, 340.6]], { fill: (x / 11) % 2 < 1 ? C.lapis : GOLD, smooth: false, w: 0.35 });
  }
  shape(ctx, [[138, 331], [402, 331], [396, 321], [144, 321]], { fill: C.stoneLt, smooth: false, w: 0.6 });
  stroke(ctx, [[140, 329.4], [400, 329.4]], 1, 'rgba(110,50,35,0.6)', false);
  box(ctx, 148, 300, 244, 21, C.marble, 0.6);
  for (let x = 154; x < 386; x += 12) {
    arch(ctx, x, x + 8, 318, 310, 304.5);
    ctx.fillStyle = 'rgba(39,70,155,0.2)';
    ctx.fill();
    ctx.strokeStyle = C.lapis;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  merlons(ctx, 148, 392, 300, 8.1, 6, C.marble);
  chhatri(ctx, 182, 294, 30, 40);
  chhatri(ctx, 358, 294, 30, 40);
}
function drawGatehouse(ctx) {
  const x0 = 772, W = X1 - x0;
  sandstone(ctx, x0, 262, W, 224, 7);
  // the balcony recess with its hanging
  box(ctx, 778, 288, 150, 62, '#214838');
  grid(784, 296, 926, 348, 10, (x, y) => rosette(ctx, x, y, 1.7, 4, GOLD, null, 0.785));
  box(ctx, 778, 288, 150, 6, C.crimson, 0.4);
  for (let x = 786; x < 926; x += 12) box(ctx, x, 288, 2, 6, GOLD);
  withFig(ctx, F.lady2, () => body(ctx, F.lady2));
  withFig(ctx, F.lady3, () => body(ctx, F.lady3));
  // arch spandrels
  ctx.beginPath();
  ctx.rect(776, 284, 154, 30);
  archTo(ctx, 780, 926, 316, 314, 290);
  ctx.fillStyle = C.marble;
  ctx.fill('evenodd');
  arch(ctx, 780, 926, 316, 314, 290);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  for (const x of [790, 916]) rosette(ctx, x, 293, 3, 6, C.lapis, C.orp);
  box(ctx, 772, 290, 7, 60, C.marble, 0.5);
  box(ctx, 927, 290, 7, 60, C.marble, 0.5);
  // railing
  box(ctx, 764, 350, X1 - 764, 22, '#4a3028');
  lattice(ctx, 764, 352, X1 - 764, 18, 6, 1.5, C.marble, 'rgba(50,25,20,0.8)');
  box(ctx, 764, 349, X1 - 764, 3.4, C.marble, 0.5);
  box(ctx, 764, 369, X1 - 764, 3.4, C.marble, 0.5);
  for (const x of [766, 820, 874, 928]) box(ctx, x, 349, 4, 23.4, C.marble, 0.5);
  // slab and brackets
  box(ctx, 760, 372.4, X1 - 760, 8, C.marble, 0.6);
  for (let x = 766; x < X1; x += 6) disc(ctx, x, 376.4, 0.9, x % 12 < 6 ? C.lapis : C.verm);
  for (const x of [778, 852, 924]) shape(ctx, [[x - 5, 380.4], [x + 5, 380.4], [x + 2, 386], [x + 3, 393], [x - 3, 393], [x - 2, 386]], { fill: C.marble, w: 0.5 });
  // eave, parapet, dome
  shape(ctx, [[756, 287], [X1 + 4, 287], [X1 + 4, 277], [765, 277]], { fill: C.stoneLt, smooth: false, w: 0.6 });
  stroke(ctx, [[758, 285.4], [X1, 285.4]], 1, 'rgba(110,50,35,0.6)', false);
  box(ctx, x0, 256, W, 21, C.marble, 0.6);
  for (let x = x0 + 5; x < X1 - 8; x += 12) {
    arch(ctx, x, x + 8, 274, 266, 260.5);
    ctx.fillStyle = 'rgba(39,70,155,0.2)';
    ctx.fill();
    ctx.strokeStyle = C.lapis;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  merlons(ctx, x0, X1, 256, 8.1, 6, C.marble);
  chhatri(ctx, 853, 250, 46, 52);
  // the screen (its lattice is laid over the watchers per frame)
  box(ctx, 794, 398, 118, 78, C.marble, 0.6);
  box(ctx, 797.5, 401.5, 111, 71, null, 0.5, C.lapis);
  box(ctx, JALI.x, JALI.y, JALI.w, JALI.h, '#2a1b22', 0.5);
  for (const x of [782, 922]) {
    box(ctx, x - 5, 408, 10, 56, null, 0.5, 'rgba(250,236,214,0.8)');
    rosette(ctx, x, 436, 3, 6, 'rgba(250,236,214,0.85)', C.stoneDk);
  }
  box(ctx, x0, 478, W, 8, C.marble, 0.5);
}
function drawWalk(ctx) {
  const y0 = WALK0, y1 = WALK1, ya = y0 + 6, yb = y1 - 6, ym = (ya + yb) / 2, r = K.rng(61);
  ctx.fillStyle = K.linGrad(ctx, 0, y0, 0, y1, [[0, '#c66e50'], [1, '#b45e44']]);
  ctx.fillRect(0, y0, 1000, y1 - y0);
  for (let row = 0; row < 2; row++) {
    for (let x = -30 + row * 26; x < 1000; x += 52) {
      ctx.fillStyle = K.rgba(r() < 0.5 ? '#de8f6c' : '#8f4530', r.range(0.05, 0.24));
      ctx.fillRect(x, row ? ym : ya, 52, ym - ya);
    }
  }
  K.grain(ctx, 0, ya, 1000, yb - ya, { color: '#5a2a1c', alpha: 0.14, seed: 62, size: 1 });
  ctx.strokeStyle = 'rgba(84,36,24,0.55)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, ym);
  ctx.lineTo(1000, ym);
  for (let row = 0; row < 2; row++) {
    for (let x = -30 + row * 26; x < 1000; x += 52) {
      ctx.moveTo(x, row ? ym : ya);
      ctx.lineTo(x, row ? yb : ym);
    }
  }
  ctx.stroke();
  for (const y of [y0, yb]) {
    box(ctx, 0, y, 1000, 6, C.marble);
    for (let x = 5, i = 0; x < 1000; x += 11, i++) shape(ctx, [[x - 3, y + 3], [x, y + 0.9], [x + 3, y + 3], [x, y + 5.1]], { fill: i % 2 ? C.verm : C.lapis, smooth: false, w: 0 });
    stroke(ctx, [[0, y], [1000, y]], 0.6, C.line, false);
    stroke(ctx, [[0, y + 6], [1000, y + 6]], 0.6, C.line, false);
  }
}
function surahi(ctx, x, yb, s, fill, deco) {
  ctx.save();
  ctx.translate(x, yb);
  ctx.scale(s, s);
  shape(ctx, [[-3, 0], [-7.5, -7], [-6, -14], [-1.6, -18], [-1.3, -29], [-2.8, -31.5], [2.8, -31.5], [1.3, -29], [1.6, -18], [6, -14], [7.5, -7], [3, 0]], { fill, w: 0.7 });
  const c = deco ?? 'rgba(90,60,10,0.8)';
  stroke(ctx, [[-7, -5.4], [7, -5.4]], 0.6, c, false);
  stroke(ctx, [[-6.6, -11.6], [6.6, -11.6]], 0.6, c, false);
  for (const dx of [-3.6, 0, 3.6]) rosette(ctx, dx, -8.5, 1.3, 4, c, null);
  stroke(ctx, [[-1.5, -20], [1.5, -20]], 0.6, c, false);
  disc(ctx, 0, -33, 1.5, fill, 0.5);
  ctx.restore();
}
function drawForeground(ctx) {
  flower(ctx, 98, 928, 62, 'iris', 71);
  flower(ctx, 316, 929, 50, 'poppy', 72);
  flower(ctx, 684, 929, 52, 'lily', 73);
  flower(ctx, 903, 929, 54, 'tulip', 74);
  // the servant, his tray of fruit and the wine flasks
  ctx.beginPath();
  ctx.ellipse(225, 917, 23, 5.5, 0, 0, TAU);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  for (const [x, y, c, rr] of [[212, 912, C.verm, 4], [221, 911, C.orp, 3.6], [231, 912.5, C.verm, 4], [239, 913.4, '#7a9a3a', 3.2], [226, 906.6, C.saffron, 3.4]]) disc(ctx, x, y, rr, c, 0.5);
  surahi(ctx, 264, 925, 1.0, GOLD);
  surahi(ctx, 286, 926, 0.9, '#f6f2e6', C.lapis);
  withFig(ctx, F.serv, () => body(ctx, F.serv));
  // the painter: easel and board, shells of colour, water jar
  stroke(ctx, [[734, 904], [728, 925]], 2.6, C.line, false);
  stroke(ctx, [[734, 904], [728, 925]], 1.6, '#8a623c', false);
  stroke(ctx, [[770, 904], [776, 925]], 2.6, C.line, false);
  stroke(ctx, [[770, 904], [776, 925]], 1.6, '#8a623c', false);
  box(ctx, BOARD.x - 3, BOARD.y - 3, BOARD.w + 6, BOARD.h + 6, '#8a623c', 0.7);
  box(ctx, BOARD.x, BOARD.y, BOARD.w, BOARD.h, C.cream, 0.4);
  withFig(ctx, F.painter, () => body(ctx, F.painter));
  [[700, 924, C.verm], [710, 927, C.lapis], [720, 923.4, '#3f8a5a'], [705, 917, C.orp], [716, 916, '#f6f2e6']].forEach(([x, y, c]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, 4.4, 2.6, -0.2, 0, TAU);
    ctx.fillStyle = '#efe6d2';
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, 2.8, 1.5, -0.2, 0, TAU);
    ctx.fillStyle = c;
    ctx.fill();
  });
  shape(ctx, [[836, 928], [832, 920], [835, 913], [845, 913], [848, 920], [844, 928]], { fill: C.lapisLt, w: 0.6 });
  stroke(ctx, [[838, 913], [836, 902]], 0.9, '#6a4526', false);
  stroke(ctx, [[842, 913], [846, 903]], 0.9, '#6a4526', false);
  drawDate(ctx);
}

function buildBase() {
  return K.layer(1000, 1000, RES, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawMargin(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(X0, PY, X1 - X0, Y1 - PY);
    ctx.clip();
    box(ctx, X0, PY, X1 - X0, Y1 - PY, '#4f9c72');
    drawSky(ctx);
    drawHills(ctx);
    drawBackWall(ctx);
    drawGarden(ctx);
    drawTrees(ctx);
    drawPavilion(ctx);
    drawGatehouse(ctx);
    box(ctx, 396, TER1, 376, 6, C.marble, 0.5);
    drawLawn(ctx, X0, LAWN0, X1, WALK0, 21);
    // flowering plants set out over the ground, each one a small study
    {
      const kinds = ['lily', 'poppy', 'iris', 'tulip'], q = K.rng(85);
      let i = 0;
      for (const [y, off] of [[566, 0], [640, 56], [714, 0]]) {
        for (let x = 104 + off; x < 912; x += 112, i++) flower(ctx, x + q.range(-8, 8), y + q.range(-6, 6), q.range(25, 31), kinds[(i * 3 + (off ? 1 : 0)) % 4], 90 + i);
      }
    }
    flower(ctx, 150, 783, 40, 'poppy', 81);
    flower(ctx, 402, 783, 38, 'lily', 82);
    flower(ctx, 640, 783, 40, 'iris', 83);
    flower(ctx, 884, 783, 38, 'tulip', 84);
    for (const id of ['c1', 'c2', 'c3', 'falc']) withFig(ctx, F[id], () => body(ctx, F[id]));
    drawLawn(ctx, X0, WALK1, X1, Y1, 22, '#458f66', '#3a7f5a');
    // broad pigment mottle over the painted grounds
    ctx.drawImage(K.noiseLayer({ scale: 110, oct: 3, seed: 841, color: '#1f4a34', lo: 0.45, hi: 0.9, alpha: 0.16, res: 0.3 }), 0, 0, 1000, 1000);
    drawForeground(ctx);
    ctx.restore();
    drawTitlePanel(ctx);
    rules(ctx, X0, Y0, X1, Y1);
    drawWalk(ctx);
  });
}
function buildFinish() {
  return K.layer(1000, 1000, 1, (ctx) => {
    ctx.drawImage(K.noiseLayer({ scale: 240, oct: 4, seed: 871, color: '#7a5a2a', lo: 0.5, hi: 0.9, alpha: 0.12, res: 0.25 }), 0, 0, 1000, 1000);
    K.grain(ctx, 0, 0, 1000, 1000, { color: '#2a1a08', alpha: 0.05, seed: 872, size: 1 });
    K.grain(ctx, 0, 0, 1000, 1000, { color: '#fff8e0', alpha: 0.05, seed: 873, size: 1 });
    K.cracks(ctx, 1000, 1000, { n: 22, seed: 874, color: '#3a2a18', alpha: 0.12, width: 0.6, len: 120, branch: 0.6, wander: 0.9 });
    K.vignette(ctx, 1000, 1000, 0.16, '#2a1a0a', 0.6);
  });
}

// ------------------------------------------------------------------------------------------- the pelican, as a bird study
const PL = { line: '#4a3324', white: '#f9f5ea', leg: '#e9a08c', legFar: '#cf8873', dark: '#4d443f' };
const BODY = { x: -128, y: -248, w: 152, h: 120 };
function buildPelicanBody() {
  const S = Rig.rest().shapes;
  return K.layer(BODY.w, BODY.h, 4, (ctx) => {
    ctx.translate(-BODY.x, -BODY.y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const r = K.rng(8801);
    K.path(ctx, S.body, true);
    ctx.fillStyle = K.linGrad(ctx, 0, -238, 0, -142, [[0, '#fcf9f0'], [0.5, '#f6f0e2'], [1, '#d8ccba']]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = K.radGrad(ctx, -50, -138, 4, 72, [[0, 'rgba(120,95,75,0.42)'], [1, 'rgba(120,95,75,0)']]);
    ctx.fillRect(BODY.x, BODY.y, BODY.w, BODY.h);
    ctx.fillStyle = K.radGrad(ctx, 0, -192, 2, 40, [[0, 'rgba(236,204,124,0.4)'], [1, 'rgba(236,204,124,0)']]);
    ctx.fillRect(BODY.x, BODY.y, BODY.w, BODY.h);
    // feather hatching: denser toward the belly
    ctx.strokeStyle = 'rgba(105,88,74,0.55)';
    ctx.lineWidth = 0.42;
    ctx.beginPath();
    for (let y = -236; y < -140; y += 2.8) {
      for (let x = -112 + r() * 4; x < 10; x += 4.3) {
        const xx = x + r.range(-1, 1), yy = y + r.range(-0.8, 0.8), k = (yy + 236) / 96;
        if (r() > 0.3 + 0.7 * k) continue;
        const droop = 0.5 + k * 1.2;
        ctx.moveTo(xx, yy);
        ctx.quadraticCurveTo(xx - 1.8, yy + droop, xx - 3.6, yy + droop * 0.6);
      }
    }
    ctx.stroke();
    ctx.restore();
    K.path(ctx, S.body, true);
    ctx.strokeStyle = PL.line;
    ctx.lineWidth = 1.05;
    ctx.stroke();
    // the folded wing: scalloped coverts, grey secondaries, dark primaries
    K.path(ctx, S.wing, true);
    ctx.fillStyle = K.linGrad(ctx, 0, -228, 0, -172, [[0, '#fdfaf2'], [1, '#eee6d6']]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const d = [-0.918, 0.396], n = [-0.396, -0.918], ang = Math.atan2(d[1], d[0]);
    ctx.strokeStyle = 'rgba(110,92,80,0.7)';
    ctx.lineWidth = 0.5;
    for (let row = -3; row < 9; row++) {
      for (let s = -6 + (row % 2 ? 3.4 : 0); s < 124; s += 6.8) {
        const px = -6 + d[0] * s - n[0] * (row * 5.4 - 14), py = -220 + d[1] * s - n[1] * (row * 5.4 - 14);
        ctx.beginPath();
        ctx.arc(px, py, 3.5, ang - 1.25, ang + 1.25);
        ctx.stroke();
      }
    }
    const E = K.catmull([[-116, -181], [-92, -178], [-66, -172], [-36, -172], [-16, -181]], 8);
    K.path(ctx, E);
    ctx.strokeStyle = '#c3b9ac';
    ctx.lineWidth = 24;
    ctx.stroke();
    ctx.strokeStyle = PL.dark;
    ctx.lineWidth = 13;
    ctx.stroke();
    for (let i = 1; i < E.length - 1; i += 2) {
      const [x, y] = E[i];
      ctx.beginPath();
      ctx.moveTo(x - 1, y + 1);
      ctx.lineTo(x + 5.5, y - 6.2);
      ctx.strokeStyle = 'rgba(244,236,220,0.6)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 5.5, y - 6.2);
      ctx.lineTo(x + 10.5, y - 11.8);
      ctx.strokeStyle = 'rgba(90,78,70,0.7)';
      ctx.stroke();
    }
    ctx.restore();
    K.path(ctx, S.wing, true);
    ctx.strokeStyle = PL.line;
    ctx.lineWidth = 1.05;
    ctx.stroke();
  });
}
function buildWheel() {
  return K.layer(104, 104, 4, (ctx) => {
    ctx.translate(52, 52);
    ctx.lineCap = 'round';
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? GOLD : 'rgba(66,42,10,0.95)';
      ctx.lineWidth = pass ? 0.95 : 1.9;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * 41, Math.sin(a) * 41);
      }
      // lotus arches between the spokes
      for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * TAU, a1 = ((i + 1) / 16) * TAU, am = (a0 + a1) / 2;
        ctx.moveTo(Math.cos(a0) * 40, Math.sin(a0) * 40);
        ctx.quadraticCurveTo(Math.cos(am) * 28, Math.sin(am) * 28, Math.cos(a1) * 40, Math.sin(a1) * 40);
      }
      ctx.stroke();
    }
    disc(ctx, 0, 0, 48.3, null, 3.4, '#33241c');
    disc(ctx, 0, 0, 43.4, null, 6.2, GOLD);
    disc(ctx, 0, 0, 46.5, null, 0.6, 'rgba(60,38,8,0.9)');
    disc(ctx, 0, 0, 40.3, null, 0.6, 'rgba(60,38,8,0.9)');
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + 0.13, x = Math.cos(a) * 43.4, y = Math.sin(a) * 43.4;
      disc(ctx, x, y, 1.55, [C.crimson, C.lapis, '#2f8a5a'][i % 3], 0.35, 'rgba(40,20,5,0.9)');
      disc(ctx, x - 0.4, y - 0.4, 0.45, 'rgba(255,255,255,0.7)');
    }
    disc(ctx, 0, 0, 7.4, GOLD, 0.7, 'rgba(60,38,8,0.9)');
    rosette(ctx, 0, 0, 5.4, 8, 'rgba(110,76,18,0.75)', null);
    disc(ctx, 0, 0, 2.3, C.crimson, 0.4, 'rgba(40,20,5,0.9)');
  });
}
function goldTube(ctx, pts, w) {
  K.path(ctx, pts);
  ctx.strokeStyle = PL.line;
  ctx.lineWidth = w + 1.6;
  ctx.stroke();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.save();
  ctx.translate(-w * 0.14, -w * 0.2);
  K.path(ctx, pts);
  ctx.strokeStyle = 'rgba(255,246,196,0.75)';
  ctx.lineWidth = w * 0.24;
  ctx.stroke();
  ctx.restore();
}
function drawPelican(ctx, pose) {
  const s = pose.s, lw = 1.05 * s, Mx = pose.M, G = pose.G.head;
  const B = (x, y) => [Mx[0] * x + Mx[2] * y + Mx[4], Mx[1] * x + Mx[3] * y + Mx[5]];
  const H0 = Rig.GEO.head, cb = Math.cos(-0.2), sb = Math.sin(-0.2);
  const bk = (u, v) => {
    const x = H0[0] + u * cb - v * sb, y = H0[1] - (u * sb + v * cb);
    return [G[0] * x + G[2] * y + G[4], G[1] * x + G[3] * y + G[5]];
  };
  const ol = (w = lw) => {
    ctx.strokeStyle = PL.line;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of Rig.parts(pose)) {
    const nm = p.name;
    if (nm === 'wing' || nm.startsWith('wingMark')) continue;
    if (p.kind === 'wheel') {
      const rear = nm === 'wheel_rear', W = rear ? pose.G.wheelR : pose.G.wheelF, hub = rear ? Rig.GEO.hubR : Rig.GEO.hubF;
      ctx.save();
      ctx.transform(W[0], W[1], W[2], W[3], W[4], W[5]);
      ctx.drawImage(LY.wheel, hub[0] - 52, hub[1] - 52, 104, 104);
      ctx.restore();
    } else if (p.kind === 'disc') {
      disc(ctx, p.c[0], p.c[1], p.r, GOLD, lw * 0.9, PL.line);
      if (nm === 'chainring') {
        rosette(ctx, p.c[0], p.c[1], p.r * 0.72, 6, 'rgba(96,66,14,0.7)', null, pose.crank);
        disc(ctx, p.c[0], p.c[1], p.r * 0.22, C.crimson, lw * 0.4, PL.line);
      }
    } else if (p.kind === 'eye') {
      disc(ctx, p.c[0], p.c[1], p.r * 1.05, '#f6e6a6', lw * 0.7, PL.line);
      if (p.lid > 0.5) stroke(ctx, [[p.c[0] - p.r, p.c[1]], [p.c[0] + p.r, p.c[1]]], lw * 0.9, PL.line, false);
      else {
        disc(ctx, p.pupil[0], p.pupil[1], p.pr * 1.08, '#1a120c');
        disc(ctx, p.pupil[0] - p.pr * 0.35, p.pupil[1] - p.pr * 0.4, p.pr * 0.3, 'rgba(255,255,255,0.85)');
      }
    } else if (p.kind === 'line') {
      const q = p.pts;
      if (p.role === 'frame') {
        goldTube(ctx, q, p.w * 0.92);
        if (q.length === 2) [0.3, 0.7].forEach((u, i) => disc(ctx, K.lerp(q[0][0], q[1][0], u), K.lerp(q[0][1], q[1][1], u), p.w * 0.24, i ? C.crimson : C.lapis, lw * 0.3, PL.line));
      } else if (p.role === 'metal') {
        if (nm.startsWith('chain')) {
          K.path(ctx, q);
          ctx.strokeStyle = 'rgba(96,66,14,0.9)';
          ctx.lineWidth = 1.1 * s;
          ctx.stroke();
        } else goldTube(ctx, q, p.w * 0.85);
      } else if (p.role === 'leg') {
        const w = p.w * 0.72;
        K.path(ctx, q);
        ol(w + lw * 1.6);
        ctx.strokeStyle = p.far ? PL.legFar : PL.leg;
        ctx.lineWidth = w;
        ctx.stroke();
      } else if (p.role === 'scarf') {
        const w = p.w * 0.8;
        K.path(ctx, q);
        ol(w + lw * 1.3);
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = w;
        ctx.stroke();
        ctx.strokeStyle = C.crimson;
        ctx.lineWidth = Math.max(1, w - 2.2 * s);
        ctx.stroke();
      } else if (p.role === 'wing') {
        K.path(ctx, q);
        ol(p.w + lw * 1.4);
        ctx.strokeStyle = PL.dark;
        ctx.lineWidth = p.w;
        ctx.stroke();
      } else if (p.role === 'head') {
        K.path(ctx, q);
        ol(2.9 * s);
        ctx.strokeStyle = PL.white;
        ctx.lineWidth = 1.6 * s;
        ctx.stroke();
      } else {
        K.path(ctx, q);
        ol(lw * 0.7);
      }
    } else if (p.kind === 'poly') {
      const q = p.pts, n = q.length;
      if (nm === 'body') {
        const Bd = pose.G.body;
        ctx.save();
        ctx.transform(Bd[0], Bd[1], Bd[2], Bd[3], Bd[4], Bd[5]);
        ctx.drawImage(LY.pelBody, BODY.x, BODY.y, BODY.w, BODY.h);
        ctx.restore();
        continue;
      }
      K.path(ctx, q, true);
      if (p.role === 'metal') {
        ctx.fillStyle = GOLD;
        ctx.fill();
        ol(lw * 0.8);
      } else if (p.role === 'saddle') {
        ctx.fillStyle = C.verm;
        ctx.fill();
        ol();
        stroke(ctx, [q[0], q[1], q[2], q[3]], 1.3 * s, GOLD, false);
        for (const [x, y] of [[-66, -135], [-58, -133.4]]) {
          const a = B(x, y), b = B(x - 1, y + 9);
          stroke(ctx, [a, b], 0.8 * s, GOLD, false);
          disc(ctx, b[0], b[1], 1.5 * s, GOLD, 0.3 * s, PL.line);
        }
      } else if (p.role === 'foot') {
        ctx.fillStyle = p.far ? PL.legFar : PL.leg;
        ctx.fill();
        ol(lw * 0.9);
        stroke(ctx, [q[1], q[4]], lw * 0.5, 'rgba(120,60,30,0.7)', false);
        stroke(ctx, [q[0], q[5]], lw * 0.5, 'rgba(120,60,30,0.7)', false);
      } else if (p.role === 'tail') {
        ctx.fillStyle = '#efe8d8';
        ctx.fill();
        ol(lw * 0.85);
        stroke(ctx, [mix(q[0], q[8 % n], 0.5), q[4]], lw * 0.5, 'rgba(110,92,80,0.7)', false);
      } else if (p.role === 'neck') {
        ctx.fillStyle = PL.white;
        ctx.fill();
        ctx.save();
        ctx.clip();
        K.path(ctx, q.slice(n / 2));
        ctx.strokeStyle = 'rgba(150,128,108,0.3)';
        ctx.lineWidth = 9 * s;
        ctx.stroke();
        ctx.restore();
        // feather ticks along the nape and throat
        const h = n / 2;
        ctx.beginPath();
        for (let i = 1; i < h - 2; i++) {
          for (const u of [0.3, 0.55, 0.8]) {
            const a = mix(q[i], q[n - 1 - i], u), b = mix(q[i + 1], q[n - 2 - i], u + 0.06);
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(K.lerp(a[0], b[0], 0.5), K.lerp(a[1], b[1], 0.5));
          }
        }
        ctx.strokeStyle = 'rgba(105,88,74,0.5)';
        ctx.lineWidth = 0.5 * s;
        ctx.stroke();
        K.path(ctx, q, true);
        ol();
        // a string of pearls with a ruby drop
        const a = q[5], b = q[n - 6], mid = mix(a, b, 0.5), dn = mix(q[4], q[n - 5], 0.5);
        const sag = [mid[0] + (dn[0] - mid[0]) * 0.9, mid[1] + (dn[1] - mid[1]) * 0.9];
        for (let i = 0; i <= 6; i++) {
          const u = i / 6, k = 4 * u * (1 - u);
          disc(ctx, K.lerp(a[0], b[0], u) + (sag[0] - mid[0]) * k, K.lerp(a[1], b[1], u) + (sag[1] - mid[1]) * k, 1.55 * s, '#fdfaf0', 0.4 * s, PL.line);
        }
        disc(ctx, sag[0] + (dn[0] - mid[0]) * 0.6, sag[1] + (dn[1] - mid[1]) * 0.6, 2.1 * s, C.crimson, 0.5 * s, PL.line);
      } else if (p.role === 'wing') {
        ctx.fillStyle = PL.white;
        ctx.fill();
        const h = n / 2;
        ctx.beginPath();
        for (let i = 1; i < h - 1; i++) {
          const a = mix(q[i], q[n - 1 - i], 0.22), b = mix(q[i + 1], q[n - 2 - i], 0.6);
          ctx.moveTo(a[0], a[1]);
          ctx.quadraticCurveTo(K.lerp(a[0], b[0], 0.7), a[1], b[0], b[1]);
        }
        ctx.strokeStyle = 'rgba(105,88,74,0.6)';
        ctx.lineWidth = 0.5 * s;
        ctx.stroke();
        K.path(ctx, q, true);
        ol();
      } else if (p.role === 'head') {
        ctx.fillStyle = PL.white;
        ctx.fill();
        ol();
        ctx.beginPath();
        ctx.ellipse(pose.eye.c[0] + 1.5 * s, pose.eye.c[1] + 0.5 * s, 8.6 * s, 6.4 * s, pose.rot - 0.2, 0, TAU);
        ctx.fillStyle = 'rgba(238,186,160,0.85)';
        ctx.fill();
      } else if (p.role === 'pouch') {
        const a = pose.pt.beakBase, b = pose.pt.beakTip;
        ctx.fillStyle = K.linGrad(ctx, a[0], a[1], b[0], b[1], [[0, '#f0b452'], [1, '#e8923a']]);
        ctx.fill();
        ctx.beginPath();
        for (const [i, j] of [[2, 26], [4, 22], [6, 18], [7, 15]]) {
          ctx.moveTo(q[i % n][0], q[i % n][1]);
          ctx.lineTo(q[j % n][0], q[j % n][1]);
        }
        ctx.strokeStyle = 'rgba(160,84,36,0.55)';
        ctx.lineWidth = 0.6 * s;
        ctx.stroke();
        K.path(ctx, q, true);
        ol();
      } else if (p.role === 'beak') {
        const a = pose.pt.beakBase, b = pose.pt.beakTip;
        ctx.fillStyle = K.linGrad(ctx, a[0], a[1], b[0], b[1], [[0, '#edc564'], [0.8, '#e3aa44'], [1, '#d88a3a']]);
        ctx.fill();
        ol();
        K.fillPoly(ctx, [bk(99, 4.6), bk(110, 0.5), bk(108, -6), bk(101, -1.5)], '#c94e2c', true);
        ol(lw * 0.7);
        stroke(ctx, [bk(14, 5.6), bk(60, 5), bk(98, 2.6)], 1.2 * s, 'rgba(104,116,140,0.6)');
        stroke(ctx, [bk(22, 6.6), bk(31, 6.8)], 0.9 * s, PL.line, false);
      } else {
        ctx.fillStyle = C.crimson;
        ctx.fill();
        ol(lw * 0.9);
      }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the painter's little page
function miniPainting(colour) {
  return K.layer(BOARD.w, BOARD.h, 6, (ctx) => {
    box(ctx, 0, 0, BOARD.w, BOARD.h, C.cream);
    if (colour) {
      box(ctx, 0, 0, BOARD.w, BOARD.h, C.indigo);
      box(ctx, 1.4, 1.4, BOARD.w - 2.8, BOARD.h - 2.8, null, 0.7, GOLD);
      ctx.fillStyle = K.linGrad(ctx, 0, 4, 0, 16, [[0, '#8fbcc4'], [1, '#ecdcae']]);
      ctx.fillRect(4, 4, BOARD.w - 8, 14);
      box(ctx, 4, 16, BOARD.w - 8, BOARD.h - 20, '#5ca676');
      box(ctx, 4, 28.6, BOARD.w - 8, 4.4, '#c26a4c');
      box(ctx, 4, 4, BOARD.w - 8, BOARD.h - 8, null, 0.5, GOLD);
    } else {
      box(ctx, 3.6, 3.6, BOARD.w - 7.2, BOARD.h - 7.2, null, 0.4, 'rgba(160,74,44,0.7)');
      stroke(ctx, [[4, 29.4], [40, 29.4]], 0.4, 'rgba(160,74,44,0.7)', false);
    }
    ctx.save();
    ctx.translate(22.5, 29.6);
    ctx.scale(0.079, 0.079);
    const paper = C.cream;
    Rig.drawFlat(ctx, Rig.rest(), colour
      ? { lw: 5, line: '#3b2619', fill: { frame: '#c9a23e', metal: '#a8842c', tire: '#3a2a20', saddle: C.verm, scarf: C.crimson, leg: PL.leg, foot: PL.leg, beak: '#e9b84e', pouch: '#e8943c', wing: '#efe8d8', tail: '#e6dece' } }
      : { lw: 7, line: '#a04a2c', far: null, fill: { tire: '#a04a2c', frame: '#a04a2c', metal: '#a04a2c', saddle: paper, leg: paper, foot: paper, body: paper, wing: paper, tail: paper, neck: paper, head: paper, beak: paper, pouch: paper, scarf: paper, mark: '#a04a2c' } });
    ctx.restore();
  });
}

// ------------------------------------------------------------------------------------------- what moves
/** the garden's own motion: it runs with t until the downbeat of bar 2 and then simply stops */
const partyTime = (t) => Math.min(t, SNAP);
const cupPhase = (tau) => 0.5 + 0.5 * Math.sin((TAU * (tau - SNAP)) / 4);
const glance = (t) => K.gate(((t % 2) + 2) % 2, 1.15, 2.0, 0.14, 0.14); // 1 = the painter's eyes are on his board

function buildWatchers() {
  const mk = (id, o = {}) => {
    const f = F[id];
    return { id, fig: f, k: f.k, p: toWorld(f, NECK[f.pose]), sprite: headSprite(HEADS[id]), face0: 1, tilt0: 0, tn: SNAP, ...o };
  };
  return [
    mk('lady1', { tilt0: 0.25, tn: 0.5 }),
    mk('att', { tilt0: 0.2 }),
    mk('prince', { tilt0: 0.04, party: (tau) => -0.24 * K.smoothstep(0.7, 1, cupPhase(tau)) }),
    mk('lute', { face0: -1, tilt0: 0.12, party: (tau) => 0.07 * Math.sin(tau * Math.PI) }),
    mk('drum', { face0: -1, tilt0: 0.14, party: (tau) => 0.08 * Math.abs(Math.sin(tau * TAU)) }),
    mk('gard', { tilt0: -0.5 }),
    mk('c1', { tilt0: 0.02, party: (tau) => 0.06 * Math.sin(tau * 2.1) }),
    mk('c2', { face0: -1, tilt0: 0.02, party: (tau) => 0.06 * Math.sin(tau * 2.1 + 1.6) }),
    mk('c3', { tilt0: 0 }),
    mk('falc', { tilt0: -0.04, party: (tau) => 0.04 * Math.sin(tau * 1.7) }),
    mk('lady2', { tilt0: 0.02, party: (tau) => 0.07 * Math.sin(tau * 2.3) }),
    mk('lady3', { face0: -1, tilt0: 0.02, party: (tau) => 0.07 * Math.sin(tau * 2.3 + 2) }),
    { id: 'jali1', jali: true, k: 1.08, p: [829, 463], sprite: headSprite(HEADS.jali1), face0: -1, tilt0: 0, tn: SNAP },
    { id: 'jali2', jali: true, k: 1.08, p: [878, 466], sprite: headSprite(HEADS.jali2), face0: -1, tilt0: 0, tn: SNAP + 0.06 },
    mk('serv', { tilt0: 0.3, tn: 1.0 }),
    mk('painter', { face0: -1, painter: true, tn: -99 }),
  ];
}
const WONDER = {
  att: { S: [-6, -89], rest: [2, -67], l: 13 },
  c2: { S: [-6, -89], rest: [-3, -67], l: 13 },
  lady2: { S: [8, -29], rest: [5, -4.5], l: 13.5 },
  serv: { S: [-5, -60], rest: [7, -38], l: 13 },
};
function headState(w, t, tau, tx, ty) {
  const [hx, hy] = w.p;
  const d = tx - hx, f1 = d >= 0 ? 1 : -1;
  const aim = K.clamp(Math.atan2(ty - (hy - 10 * w.k), Math.abs(d) + 28) * 0.8, -0.62, 0.72);
  const cross = 0.5 + 0.5 * K.smoothstep(0, 24, Math.abs(d)); // turning as it passes beneath
  if (w.painter) {
    const g = glance(t), edge = Math.abs(g - 0.5) * 2;
    return { face: g > 0.5 ? -1 : f1, tilt: K.lerp(aim, 0.42, g), sq: (f1 === -1 ? 1 : 0.55 + 0.45 * edge) * (g > 0.5 ? 1 : cross), lift: 0 };
  }
  const tilt0 = w.tilt0 + (w.party ? w.party(tau) : 0);
  if (t < w.tn) return { face: w.face0, tilt: tilt0, sq: 1, lift: 0 };
  const e = K.prog(t, w.tn, 0.16);
  return { face: f1, tilt: K.lerp(tilt0, aim, K.ease.outBack(e, 2.4)), sq: cross * (f1 !== w.face0 ? 0.55 + 0.45 * e : 1), lift: e < 1 ? 2.6 * Math.sin(Math.PI * e) : 0 };
}
function putHead(ctx, w, st) {
  ctx.save();
  ctx.translate(w.p[0], w.p[1] - st.lift);
  ctx.scale(w.k * st.face * st.sq, w.k);
  ctx.rotate(st.tilt);
  ctx.drawImage(w.sprite, HEAD_BOX[0], HEAD_BOX[1], HEAD_BOX[2], HEAD_BOX[3]);
  ctx.restore();
}
function headPoint(w, st, p) {
  const c = Math.cos(st.tilt), s = Math.sin(st.tilt);
  return [w.p[0] + (p[0] * c - p[1] * s) * w.k * st.face * st.sq, w.p[1] - st.lift + (p[0] * s + p[1] * c) * w.k];
}
function drawBirds(ctx, tau) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    const x = 600 + tau * 4.5 - row * 13, y = 204 + side * row * 6 + 1.2 * Math.sin(tau * 1.3 + i), fl = Math.sin(tau * 7 + i * 1.3);
    for (const [c, w] of [['#4a3a30', 1.9], ['#fbf8ee', 1.1]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x - 5.5, y - 1 - 3.2 * fl);
      ctx.quadraticCurveTo(x - 2.4, y - 2.4 - 1.2 * fl, x, y);
      ctx.quadraticCurveTo(x + 1.6, y - 2.6 - 1.2 * fl, x + 3.4, y - 1.4 - 3 * fl);
      ctx.moveTo(x - 2, y + 0.6);
      ctx.lineTo(x + 3.6, y + 0.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawFountain(ctx, tau) {
  const [fx, fy] = FOUNT;
  ctx.save();
  ctx.lineCap = 'round';
  // rings spreading over the pool
  ctx.save();
  ctx.beginPath();
  ctx.rect(POOL.x, POOL.y, POOL.w, POOL.h);
  ctx.clip();
  for (let k = 0; k < 3; k++) {
    const u = wrap1(tau * 0.5 + k / 3);
    ctx.beginPath();
    ctx.ellipse(fx, fy + 24, 8 + 34 * u, (8 + 34 * u) * 0.42, 0, 0, TAU);
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - u)})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();
  for (let j = 0; j < 7; j++) {
    const vx = (j - 3) * 6.2, at = (s) => [fx + vx * s, fy - 60 * s + 55 * s * s];
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const [x, y] = at((i / 14) * 1.3);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const [x, y] = at(wrap1(tau * 0.9 + i / 5 + j * 0.13) * 1.3);
      disc(ctx, x, y, 1.05, '#ffffff', 0.35, 'rgba(60,100,130,0.7)');
    }
  }
  ctx.restore();
}
function drawWhisk(ctx, tau) {
  const H = toWorld(F.att, [21.5, -93.5]), a = -1.05 + 0.4 * Math.sin(Math.PI * tau), lag = 0.3 * Math.cos(Math.PI * tau);
  const T = [H[0] + Math.cos(a) * 15, H[1] + Math.sin(a) * 15];
  stroke(ctx, [H, T], 2.2, C.line, false);
  stroke(ctx, [H, T], 1.3, GOLD, false);
  const pl = K.catmull([T, [T[0] + 8 + 3 * lag, T[1] - 1], [T[0] + 16 + 6 * lag, T[1] + 6], [T[0] + 19 + 10 * lag, T[1] + 17]], 6);
  shape(ctx, K.ribbonPoly(pl, (u) => 1.2 + 6 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - 0.3 * u)), { fill: '#fbf8ee', smooth: false, w: 0.6 });
  for (const k of [-1.4, 0, 1.4]) stroke(ctx, pl.slice(4).map(([x, y], i) => [x + k * Math.min(1, i / 8), y]), 0.4, 'rgba(120,100,80,0.6)', false);
  disc(ctx, T[0], T[1], 1.6, GOLD, 0.4);
}
function wingPoly(sx, sy, a, len) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[sx, sy], [sx + c * len * 0.45 - s * 5, sy + s * len * 0.45 + c * 5], [sx + c * len, sy + s * len], [sx + c * len * 0.5 + s * 3.4, sy + s * len * 0.5 - c * 3.4]];
}
function drawFalcon(ctx, x, y, face, open, flap) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face, 1);
  const lw = 0.6, brown = '#6b5a4c';
  shape(ctx, [[-3.5, -6], [-9.5, 3.5], [-6.5, 4.6], [-1, -3]], { fill: brown, w: lw, smooth: false });
  if (open > 0.03) {
    const w = wingPoly(0.5, -14, -0.25 - 0.9 * flap, 21 * open);
    shape(ctx, w, { fill: '#584a3e', w: lw });
  }
  stroke(ctx, [[-0.6, -5], [-0.3, 0]], 1.1, '#d9a53a', false);
  stroke(ctx, [[1.6, -5], [1.5, 0]], 1.1, '#d9a53a', false);
  shape(ctx, [[-4.2, -5.5], [-5.4, -12], [-2.6, -17], [1.6, -17.4], [4.4, -13], [3.8, -7.5], [0.5, -4]], { fill: '#f1e5ce', w: lw });
  for (const [bx, by] of [[1.6, -14], [2.6, -11.6], [1.2, -9.4], [2.4, -7.4], [-0.4, -12]]) stroke(ctx, [[bx - 0.9, by], [bx + 0.9, by + 0.3]], 0.45, brown, false);
  if (open < 0.97) {
    ctx.globalAlpha = 1 - open;
    shape(ctx, [[-4.6, -15.6], [-6.4, -9], [-5.4, -2.2], [-1.8, -6.5], [-0.6, -12.5]], { fill: brown, w: lw });
    ctx.globalAlpha = 1;
  }
  if (open > 0.03) {
    const w = wingPoly(-2.4, -14, -2.9 + 0.9 * flap, 23 * open);
    shape(ctx, w, { fill: brown, w: lw });
    for (const u of [0.35, 0.55, 0.75]) stroke(ctx, [[K.lerp(w[3][0], w[2][0], u * 0.6), K.lerp(w[3][1], w[2][1], u * 0.6)], [K.lerp(w[1][0], w[2][0], u), K.lerp(w[1][1], w[2][1], u)]], 0.4, 'rgba(240,228,206,0.6)', false);
  }
  disc(ctx, 2.2, -19.2, 3.5, '#f1e5ce', lw);
  shape(ctx, [[-1.3, -20], [1.5, -22.9], [5, -21.1], [3, -19.7], [0.5, -18.4]], { fill: '#4e4036', w: 0 });
  stroke(ctx, [[3.2, -18.8], [3, -16.6]], 0.8, '#4e4036', false);
  disc(ctx, 3.4, -19.9, 0.75, '#1a100a');
  shape(ctx, [[5.3, -19.7], [7.7, -18.6], [6.3, -17.1], [5.2, -17.9]], { fill: '#d9a53a', w: lw * 0.8, smooth: false });
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the scene
export default {
  id: 8, key: 'mughal', title: TITLES[8], heroT: 3.0,
  // it lingers in front of the court through bar 2
  profile: [[0, 0], [2.0, 0.36], [4.0, 0.63], [6, 1]],

  act(t, p) {
    const g = K.gate(t, 1.9, 5.2, 0.35, 0.5); // under the eyes of the court it sits up
    const look = K.gate(t, 2.5, 3.4, 0.1, 0.25); // one sidelong look at the watchers, then eyes front
    p.neck = 0.45 * g;
    p.headTilt = 0.07 * g;
    p.bob = 1 - 0.4 * g;
    p.eye = [K.lerp(0.2 * g, -0.7, look), K.lerp(0, -0.8, look)];
  },
  camera(t) {
    const k = K.ease.io3(K.prog(t, 1.75, 0.6)) * (1 - K.ease.io3(K.prog(t, 4.2, 1.0)));
    return k > 0 ? { zoom: 1 + 0.13 * k, dy: -22 * k } : null;
  },

  async init() {
    const sheet = buildGold();
    GOLD = K.makeCanvas(2, 2).getContext('2d').createPattern(sheet, 'repeat');
    LY = { gold: sheet };
    LY.base = buildBase();
    LY.finish = buildFinish();
    LY.jali = K.layer(JALI.w, JALI.h, 3, (ctx) => {
      lattice(ctx, 0, 0, JALI.w, JALI.h, 12.5, 2, C.marble, 'rgba(50,25,20,0.85)');
      box(ctx, 0, 0, JALI.w, JALI.h, null, 1.6, C.marble);
    });
    LY.pelBody = buildPelicanBody();
    LY.wheel = buildWheel();
    LY.sketch = miniPainting(false);
    LY.painted = miniPainting(true);
    LY.watch = buildWatchers();
  },

  render(ctx, t, env) {
    K.put(ctx, LY.base);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const tau = partyTime(t), pose = env.pose;
    const tx = pose ? pose.pt.head[0] : env.rider.lx + 24, ty = pose ? pose.pt.head[1] : 524;

    drawBirds(ctx, tau);
    drawFountain(ctx, tau);
    drawWhisk(ctx, tau);

    // the painter's page: an underdrawing before, coloured in a little more with every beat as the sitter passes
    K.put(ctx, LY.sketch, BOARD.x, BOARD.y, BOARD.w, BOARD.h);
    const nb = Math.max(0, t) / 0.5, done = K.clamp((Math.floor(nb) - 1 + K.smoothstep(0, 0.3, nb - Math.floor(nb))) / 9);
    if (done > 0) {
      ctx.globalAlpha = done;
      K.put(ctx, LY.painted, BOARD.x, BOARD.y, BOARD.w, BOARD.h);
      ctx.globalAlpha = 1;
    }

    // heads
    const st = {};
    for (const w of LY.watch) st[w.id] = headState(w, t, tau, tx, ty);
    ctx.save();
    ctx.beginPath();
    ctx.rect(JALI.x, JALI.y, JALI.w, JALI.h);
    ctx.clip();
    for (const w of LY.watch) {
      if (!w.jali) continue;
      const a = K.ease.out3(K.prog(t, w.tn, 0.22));
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      putHead(ctx, w, { ...st[w.id], lift: -9 * (1 - a) });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    K.put(ctx, LY.jali, JALI.x, JALI.y, JALI.w, JALI.h);
    for (const w of LY.watch) if (!w.jali) putHead(ctx, w, st[w.id]);

    // the prince's cup: up to the lips and down again — until it stops half-way
    {
      const f = F.prince, c = cupPhase(tau), S = [6, -60];
      const H = K.mixPt([20, -36], [12.5, -72.5], K.ease.io2(c)), E = ikDown(S, H, 15, 15);
      withFig(ctx, f, () => {
        arm(ctx, S, E, H, f.jama, f.skin);
        ctx.save();
        ctx.translate(H[0] + 2.6, H[1] - 2.6);
        ctx.rotate(-0.5 * K.smoothstep(0.75, 1, c));
        ctx.beginPath();
        ctx.arc(0, 0, 3.4, 0, Math.PI);
        ctx.closePath();
        ctx.fillStyle = GOLD;
        ctx.fill();
        ctx.strokeStyle = C.line;
        ctx.lineWidth = LW * Q * 0.8;
        ctx.stroke();
        ctx.restore();
      });
    }
    // the musicians' hands
    {
      const f = F.lute, sw = Math.sin(tau * TAU * 2), S = [6, -60], H = [12 + 2.6 * sw, -39 + 2.2 * sw];
      withFig(ctx, f, () => arm(ctx, S, ikDown(S, H, 13, 13), H, f.jama, f.skin));
      const g = F.drum, l1 = 6.5 * Math.pow(Math.abs(Math.sin(tau * TAU)), 0.6), l2 = 6.5 * Math.pow(Math.abs(Math.cos(tau * TAU)), 0.6);
      withFig(ctx, g, () => {
        for (const [S2, H2] of [[[1.5, -58], [25.5, -18.5 - l2]], [[6.5, -58], [15, -18.5 - l1]]]) arm(ctx, S2, ikDown(S2, H2, 24.5, 24.5), H2, g.jama, g.skin);
      });
    }
    // fingers of astonishment
    for (const w of LY.watch) {
      const cfg = WONDER[w.id];
      if (!cfg) continue;
      const f = w.fig, a = K.ease.outBack(K.prog(t, w.tn + 0.06, 0.28), 1.3);
      const lips = toLocal(f, headPoint(w, st[w.id], [10.6, -6.2]));
      const H = K.mixPt(cfg.rest, lips, K.clamp(a, 0, 1.04));
      withFig(ctx, f, () => arm(ctx, cfg.S, ikDown(cfg.S, H, cfg.l, cfg.l), H, f.jama, f.skin, { point: a > 0.5 }));
    }
    // the painter's brush never stops
    {
      const f = F.painter, g = glance(t);
      const on = [BOARD.x + BOARD.w * 0.5 + 9 * Math.sin(t * 3.1 + 1), BOARD.y + BOARD.h * 0.55 + 7 * Math.sin(t * 4.3)];
      const tip = toLocal(f, K.mixPt([772, 888], on, g)), S = [6, -58];
      const d = [S[0] - tip[0], S[1] - tip[1]], m = Math.hypot(d[0], d[1]) || 1, H = [tip[0] + (d[0] / m) * 15, tip[1] + (d[1] / m) * 15];
      withFig(ctx, f, () => {
        arm(ctx, S, ikDown(S, H, 17, 17), H, f.jama, f.skin);
        stroke(ctx, [H, tip], 1.5, C.line, false);
        stroke(ctx, [H, K.mixPt(H, tip, 0.8)], 0.8, '#b98a52', false);
      });
    }
    // the falcon: on the glove, then off it
    {
      const G = toWorld(F.falc, [25.6, -93.2]);
      const up = K.ease.outBack(K.prog(t, SNAP, 0.4), 1.6) * (1 - K.ease.io2(K.prog(t, 6.3, 0.9)));
      const fx = G[0] + 5 * up, fy = G[1] - 27 * up + (up > 0.05 ? 2.2 * Math.sin(t * 9) * Math.min(1, up) : 0);
      if (up > 0.02) {
        stroke(ctx, [[fx - 0.5, fy], [G[0] - 1, G[1] - 1]], 0.6, '#7a4a2a', false);
        stroke(ctx, [[fx + 1.5, fy], [G[0] + 1.5, G[1] - 1]], 0.6, '#7a4a2a', false);
      }
      drawFalcon(ctx, fx, fy, t < SNAP ? -1 : tx >= fx ? 1 : -1, K.clamp(up), Math.sin(t * 21));
    }

    if (pose) drawPelican(ctx, pose);
    ctx.restore();
    K.put(ctx, LY.finish);
  },
};
