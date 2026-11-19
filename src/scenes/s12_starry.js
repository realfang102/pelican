// Section 12 — Van Gogh, The Starry Night (1889) — oil on canvas, thick directional impasto.
//
// The whole picture is short loaded dashes laid side by side along flow lines. A flow field (two vortices for the
// great double whorl, a ring field round every star and the moon, a rolling drift elsewhere) is traced into
// streamlines; each streamline is a string of dashes in one colour family, and an occupancy grid keeps neighbouring
// streamlines a brush-width apart, so strokes sit beside each other instead of piling up. Every dash is drawn as
// raised paint: a cast shadow down-right, the body, a wet highlight along the upper-left edge and a bristle furrow.
// Hills follow their contours, the cypress licks upward, the road runs in ochre and violet.
//
// Gag: the heavens are geared to the bicycle. The two cloud whorls and every star halo are separate round sprites
// (their outer dashes thin out so they sit seamlessly on the static sky, which is painted in rings of the same
// colours there) and they turn by the pelican's wheel angle — the stars at exactly the wheel rate, the big whorl at
// half of it, the small one counter-rotating. The pelican's wheels ARE two small stars from the same generator,
// turning with the same angle, so wheels and stars are always in unison. On the downbeat of bar 2 the halos swell.
// The sleeping village wakes up window by window, on the beat, as the pelican passes each house.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const RES = 1.3, TAU = K.TAU, sstep = K.smoothstep, lerp = K.lerp;
const ROAD = K.ROAD_Y;
let L = null;

// ------------------------------------------------------------------------------------------------ palette
const OUT = '#0d1b45'; // Prussian blue contour
const OUTV = '#0b1535';
const SHD = 'rgba(5,9,26,0.55)';
const DEEP = ['#121f55', '#16296a', '#1c3478', '#0f1a47', '#1a2f70'];
const DARK = ['#1c3478', '#22408f', '#2b55b5', '#27499e', '#16296a', '#3462bd', '#2a4fa8'];
const PALE = ['#8fbfe0', '#a8d2dc', '#cfe6e6', '#7ea6d8', '#eef0d8', '#b9dcc8', '#9cc4e4'];
const GLOW = ['#dfe8b0', '#cfe6e6', '#f1e9a8', '#a8d2dc', '#eef0d8', '#b9dcc8'];
const RIM = ['#6f9bd0', '#5f8fcf', '#8db7dc', '#4a7ac4'];
const ORBPAL = {
  y: { core: ['#fbf7dc', '#f7e489'], in: ['#f3d84c', '#f7e489', '#efc63a'], mid: ['#dfe39a', '#c6dc9a', '#f1e9a8'], out: ['#9fd0c8', '#8fbfe0', '#a8d2dc'] },
  o: { core: ['#f7e489', '#f3c64a'], in: ['#f0a534', '#eb8f2a', '#f3c64a'], mid: ['#f3d84c', '#e7d27a', '#d6dc9a'], out: ['#9fd0c8', '#8fbfe0', '#b9dcc8'] },
  w: { core: ['#ffffff', '#fbf7dc'], in: ['#fbf7dc', '#eef0d8', '#f7e489'], mid: ['#cfe6e6', '#dfe8b0', '#a8d2dc'], out: ['#8fbfe0', '#7ea6d8', '#a8d2dc'] },
  m: { core: ['#f7e489', '#f3d84c'], in: ['#f3d84c', '#f1e08a', '#efc63a'], mid: ['#e3e08e', '#c6dc9a', '#b9dcc8'], out: ['#9fd0c8', '#8fbfe0', '#a8d2dc'] },
};

// ------------------------------------------------------------------------------------------------ composition
const VORT = [
  { x: 455, y: 330, R: 150, dir: 1, ph: 0.4, gear: 0.5 },
  { x: 690, y: 412, R: 95, dir: -1, ph: 2.1, gear: -0.75 },
];
const ORBS = [
  { x: 58, y: 98, R: 40, k: 'y' },
  { x: 66, y: 292, R: 34, k: 'y' },
  { x: 300, y: 66, R: 40, k: 'o' },
  { x: 288, y: 448, R: 50, k: 'w' },
  { x: 438, y: 128, R: 36, k: 'y' },
  { x: 592, y: 60, R: 44, k: 'o' },
  { x: 722, y: 176, R: 36, k: 'y' },
  { x: 836, y: 328, R: 40, k: 'o' },
  { x: 948, y: 436, R: 33, k: 'y' },
  { x: 54, y: 468, R: 30, k: 'w' },
  { x: 884, y: 118, R: 86, k: 'm' },
];
const ARMS = 6; // pinwheel arms shared by the stars and the wheels
const FQ = 2.2; // pale/dark rings per whorl radius

const hillY = (x) => 590 - 44 * sstep(250, 1000, x) + 9 * Math.sin(x * 0.0125 + 1) + 5 * Math.sin(x * 0.033);
const roadTop = (x) => 783 + 2 * Math.sin(x * 0.021);
const ROAD_BOT = 853;

const edgeThr = (x, y) => 4 + 12 * K.noise2(x * 0.02, y * 0.02, 9);
function painted(x, y) {
  const t = edgeThr(x, y);
  if (y < t || y > 1000 - t) return false;
  if (y > 772 && y < 866) return x > -6 && x < 1006; // the road runs off both edges
  return x > t && x < 1000 - t;
}

// cypress: a dark flame standing on the far side of the lane
const CYP = [
  { ax: 172, top: 58, base: 787, hw: 66 },
  { ax: 248, top: 430, base: 787, hw: 30 },
];
function cypAxis(c, y) {
  return c.ax + 9 * Math.sin(y * 0.011 + c.ax);
}
function cypHalf(c, x, y) {
  const v = (y - c.top) / (c.base - c.top);
  if (v < 0 || v > 1) return -1;
  const side = x < cypAxis(c, y) ? 1.3 : 4.1;
  return c.hw * Math.pow(v, 0.72) * (1 - 0.22 * sstep(0.72, 1, v)) + (2 + 8 * v) * Math.sin(y * 0.058 + side) + 2;
}
const inCyp = (x, y) => CYP.some((c) => Math.abs(x - cypAxis(c, y)) < cypHalf(c, x, y));

// village
const HOUSES = [], WINDOWS = [], TREES = [];
(function buildVillage() {
  const r = K.rng(1212);
  const tPass = (x) => ((x + 30) / 1060) * 6;
  const add = (h) => {
    h.wins = [];
    const n = h.w > 62 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const front = h.row === 1;
      const wd = { x: h.x + h.w * (n === 2 ? 0.3 + 0.4 * i : r.range(0.35, 0.65)), y: h.y - h.h * 0.52, w: front ? 9 : 6.5, h: front ? 12 : 8.5 };
      const always = r() < 0.16;
      // lights on the half-beat after the pelican has passed (back row a beat later)
      wd.t = always ? -1e3 : Math.ceil(tPass(wd.x) * 2 + 0.2) / 2 + (front ? 0 : 0.5) + (i ? 0.5 : 0);
      h.wins.push(wd);
      WINDOWS.push(wd);
    }
    HOUSES.push(h);
  };
  let x = 266;
  while (x < 990) {
    const w = r.range(40, 62);
    if (!(x + w > 548 && x < 656)) add({ x, w, y: 742 + r.range(-4, 4), h: r.range(22, 32), rh: r.range(14, 22), row: 0, gable: r() < 0.35 });
    x += w + r.range(12, 44);
  }
  x = 262;
  while (x < 1004) {
    const w = r.range(52, 86);
    if (!(x + w > 536 && x < 664)) {
      add({ x, w, y: 781 + r.range(-2, 1), h: r.range(30, 44), rh: r.range(18, 27), row: 1, gable: r() < 0.3 });
      x += w + r.range(5, 30);
    } else x = 664;
  }
  add({ x: 6, w: 86, y: 781, h: 36, rh: 22, row: 1, gable: false });
  // church windows
  WINDOWS.push({ x: 566, y: 758, w: 8, h: 14, t: Math.ceil(tPass(566) * 2 + 0.2) / 2, church: true });
  WINDOWS.push({ x: 634, y: 758, w: 8, h: 14, t: Math.ceil(tPass(634) * 2 + 0.2) / 2, church: true });
  WINDOWS.push({ x: 600, y: 690, w: 7, h: 11, t: Math.ceil(tPass(600) * 2 + 0.2) / 2 + 0.5, church: true });
  for (let tx = 250; tx < 1000; tx += r.range(46, 92)) TREES.push({ x: tx, y: 736 + r.range(-6, 6), R: r.range(10, 15), row: 0 });
  for (let tx = 268; tx < 1000; tx += r.range(60, 120)) TREES.push({ x: tx, y: 768 + r.range(-3, 3), R: r.range(13, 19), row: 1 });
  TREES.push({ x: 108, y: 770, R: 15, row: 1 });
})();

// ------------------------------------------------------------------------------------------------ paint dashes
const jit = (c, r, k = 0.2) => K.shade(c, (r() - 0.5) * k);
function trace(ctx, P, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(P[0][0] + dx, P[0][1] + dy);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0] + dx, P[i][1] + dy);
}
/** one loaded dash of oil paint, lit from the upper left */
function dash(ctx, P, w, col) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  trace(ctx, P, w * 0.17, w * 0.23);
  ctx.strokeStyle = SHD;
  ctx.lineWidth = w;
  ctx.stroke();
  trace(ctx, P, 0, 0);
  ctx.strokeStyle = col;
  ctx.stroke();
  trace(ctx, P, -w * 0.2, -w * 0.24);
  ctx.strokeStyle = K.shade(col, 0.3);
  ctx.lineWidth = w * 0.28;
  ctx.stroke();
  trace(ctx, P, w * 0.06, w * 0.1);
  ctx.strokeStyle = K.shade(col, -0.18);
  ctx.lineWidth = w * 0.13;
  ctx.stroke();
}

/**
 * Lay dashes along the streamlines of a direction field.
 *   o.x0,y0,x1,y1  bounding box          o.inside(x,y)     region test
 *   o.dir(x,y)     unit direction        o.pick(x,y,r)     colour of a streamline (null = leave bare)
 *   o.w, o.len     dash width / length   o.gap             gap between consecutive dashes
 *   o.sep          lane spacing          o.nDash           dashes per streamline      o.seedGap  seed grid pitch
 */
function flowPaint(ctx, o) {
  const { x0, y0, x1, y1, sep } = o;
  const r = K.rng(o.seed ?? 1);
  const cols = Math.ceil((x1 - x0) / sep) + 2, rows = Math.ceil((y1 - y0) / sep) + 2;
  const occ = new Int32Array(cols * rows);
  const cellOf = (x, y) => {
    const i = Math.floor((x - x0) / sep) + 1, j = Math.floor((y - y0) / sep) + 1;
    return i < 0 || j < 0 || i >= cols || j >= rows ? -1 : j * cols + i;
  };
  const sp = o.seedGap ?? sep, seeds = [];
  for (let y = y0; y < y1; y += sp) for (let x = x0; x < x1; x += sp) seeds.push([x + r() * sp, y + r() * sp]);
  for (let i = seeds.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1)), t = seeds[i];
    seeds[i] = seeds[j];
    seeds[j] = t;
  }
  const nD = o.nDash ?? 4, gap = o.gap ?? 3;
  let id = 0, count = 0;
  for (const [sx, sy] of seeds) {
    if (!o.inside(sx, sy)) continue;
    const c0 = cellOf(sx, sy);
    if (c0 < 0 || occ[c0]) continue;
    const col0 = o.pick(sx, sy, r);
    if (!col0) continue;
    id++;
    let x = sx, y = sy, pd = null;
    for (let k = 0; k < nD; k++) {
      const len = o.len * (0.75 + 0.5 * r()), w = o.w * (0.85 + 0.3 * r()), h = len / 4;
      const P = [[x, y]];
      let ok = true;
      for (let i = 0; i < 4; i++) {
        let d = o.dir(x, y);
        if (pd && d[0] * pd[0] + d[1] * pd[1] < 0) d = [-d[0], -d[1]];
        pd = d;
        x += d[0] * h;
        y += d[1] * h;
        const c = cellOf(x, y);
        if (c < 0 || (occ[c] && occ[c] !== id) || !o.inside(x, y)) {
          ok = false;
          break;
        }
        P.push([x, y]);
      }
      if (P.length < 3) break;
      for (const p of P) {
        const c = cellOf(p[0], p[1]);
        if (c >= 0) occ[c] = id;
      }
      dash(ctx, P, w, jit(k && o.repick ? o.pick(x, y, r) || col0 : col0, r, o.jit ?? 0.2));
      count++;
      if (!ok) break;
      x += pd[0] * (w * 0.6 + gap);
      y += pd[1] * (w * 0.6 + gap);
    }
  }
  return count;
}

// ------------------------------------------------------------------------------------------------ the sky field
function skyDir(x, y) {
  const a0 = -0.06 + 0.22 * Math.sin(x * 0.0052 + y * 0.0031 + 0.6) + 0.5 * (K.noise2(x * 0.006, y * 0.009, 31) - 0.5);
  let vx = Math.cos(a0), vy = Math.sin(a0);
  for (const v of VORT) {
    const rx = x - v.x, ry = y - v.y, d = Math.hypot(rx, ry) + 1e-3, q = d / (v.R * 1.2);
    const w = 5 / (1 + q * q * q * q);
    vx += w * ((v.dir * -ry) / d - (0.1 * rx) / d);
    vy += w * ((v.dir * rx) / d - (0.1 * ry) / d);
  }
  for (const s of ORBS) {
    const rx = x - s.x, ry = y - s.y, d = Math.hypot(rx, ry) + 1e-3, q = d / (s.R * 1.2);
    const q2 = q * q, w = 7 / (1 + q2 * q2 * q2);
    vx += (w * -ry) / d;
    vy += (w * rx) / d;
  }
  const m = Math.hypot(vx, vy) || 1;
  return [vx / m, vy / m];
}
function orbCol(k, d, th, r, arms) {
  const p = ORBPAL[k];
  let z = d + (r() - 0.5) * 0.12;
  if (arms && d > 0.2 && d < 0.88 && Math.cos(arms * th + d * 6) > 0.3) z -= 0.25;
  if (z < 0.2) return r.pick(p.core);
  if (z < 0.46) return r.pick(p.in);
  if (z < 0.68) return r.pick(p.mid);
  if (z < 0.9) return r.pick(p.out);
  return r.pick(RIM);
}
const whorlW = (d) => sstep(0.95, 0.5, d);
function whorlCol(v, d, th, r) {
  if (d < 0.13) return r.pick(['#f4ecb0', '#f2dc6a', '#fbf7dc', '#dfe8b0']);
  const P = 0.5 + 0.5 * Math.cos(d * TAU * FQ + v.ph + 2 * th * whorlW(d));
  if (r() < 0.1 + 0.82 * P * P) return r() < 0.14 * (1 - d) ? r.pick(['#f1e9a8', '#dfe8b0']) : r.pick(PALE);
  return r.pick(DARK);
}
function skyPale(x, y) {
  let P = 0;
  for (const v of VORT) {
    const d = Math.hypot(x - v.x, y - v.y) / v.R;
    if (d < 1.4) P = Math.max(P, (0.5 + 0.5 * Math.cos(d * TAU * FQ + v.ph)) * sstep(1.4, 0.95, d));
  }
  // the pale stream rolling in from the left over the top of the great whorl
  const ys = 262 - 78 * sstep(40, 440, x);
  P = Math.max(P, 0.78 * K.bump(y, ys, 34) * sstep(500, 380, x));
  P = Math.max(P, 0.6 * K.bump(y, 512 - 0.02 * x, 20) * sstep(560, 700, x));
  P = Math.max(P, 0.5 * sstep(0.6, 0.8, K.noise2(x * 0.004, y * 0.014, 77)));
  return P;
}
function skyPick(x, y, r) {
  for (const s of ORBS) {
    const d = Math.hypot(x - s.x, y - s.y) / s.R;
    if (d < 1) return orbCol(s.k, d, 0, r, 0);
    if (d < 1.5 && r() < 0.75 * sstep(1.5, 1.0, d)) return r.pick(RIM);
  }
  const hz = K.bump(y, hillY(x) - 30, 30); // the band of light lying on the hills
  if (r() < 0.88 * hz) return r.pick(GLOW);
  if (r() < skyPale(x, y)) return r.pick(PALE);
  return r() < 0.75 * (1 - y / 560) ? r.pick(DEEP) : r.pick(DARK);
}

// ------------------------------------------------------------------------------------------------ round sprites
/** a disc of concentric dashes; its outer dashes thin out so it sits on the static sky without a seam */
function discSprite(R, o) {
  const S = R + 8;
  const lay = K.layer(2 * S, 2 * S, o.res ?? RES, (ctx) => {
    ctx.translate(S, S);
    const r = K.rng(o.seed);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    for (const [d, c] of o.under) g.addColorStop(d, c);
    ctx.fillStyle = g;
    K.circle(ctx, 0, 0, o.solid ? R - 1 : R * 0.84);
    ctx.fill();
    if (!o.solid) {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = K.radGrad(ctx, 0, 0, R * 0.58, R * 0.84, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      ctx.fillRect(-S, -S, 2 * S, 2 * S);
      ctx.globalCompositeOperation = 'source-over';
    }
    const w = o.w, step = w * 0.9;
    for (let rr = R - w * 0.55; rr > w * 0.35; rr -= step) {
      const d = rr / R;
      const keep = o.solid ? 1 : 1 - 0.9 * sstep(0.76, 1.0, d);
      const len = Math.min(o.len, rr * 1.5);
      const n = Math.max(3, Math.round((TAU * rr) / (len + w * 0.95)));
      const off = r() * TAU;
      const pitch = o.pitch ? o.pitch(d) : 0;
      for (let j = 0; j < n; j++) {
        const a0 = off + ((j + (r() - 0.5) * 0.3) / n) * TAU, da = (len * (0.8 + 0.4 * r())) / rr;
        const ww = w * (0.85 + 0.3 * r());
        const col = o.col(d, a0 + da / 2, r);
        if (r() > keep) continue;
        const P = [];
        for (let i = 0; i <= 4; i++) {
          const a = a0 + (da * i) / 4, q = rr + pitch * R * (a - a0 - da / 2);
          P.push([Math.cos(a) * q, Math.sin(a) * q]);
        }
        dash(ctx, P, ww, jit(col, r, 0.14));
      }
    }
    if (o.core) dash(ctx, [[-1.5, 0.5], [0, -0.5], [1.5, 0.5]], w * 1.25, o.core);
    if (o.outline) {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3.2;
      K.circle(ctx, 0, 0, R - 1.4);
      ctx.stroke();
    }
  });
  return lay;
}
function spin(ctx, spr, x, y, ang, sc = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (sc !== 1) ctx.scale(sc, sc);
  ctx.drawImage(spr, -spr.uw / 2, -spr.uh / 2, spr.uw, spr.uh);
  ctx.restore();
}
function wheelCol(d, th, r) {
  if (d > 0.8) return r.pick(['#fbf3c0', '#f6e27c', '#ffffff', '#f7e9a0']);
  if (d < 0.2) return r.pick(['#ffffff', '#fbf7dc']);
  if (Math.cos(ARMS * th + d * 6) > 0.2) return r.pick(['#f0a534', '#eb8f2a', '#f3c64a']);
  return d < 0.52 ? r.pick(['#f3d84c', '#f7e489']) : r.pick(['#9fd0c8', '#8fbfe0', '#dfe39a']);
}

// ------------------------------------------------------------------------------------------------ land
function hillDir(x, y) {
  const slope = (hillY(x + 5) - hillY(x - 5)) / 10, depth = K.clamp((y - hillY(x)) / 120);
  const a = Math.atan(slope) * (1 - 0.6 * depth) + 0.34 * Math.sin(x * 0.017 + y * 0.045) + 0.4 * (K.noise2(x * 0.01, y * 0.015, 21) - 0.5);
  return [Math.cos(a), Math.sin(a)];
}
function hillPick(x, y, r) {
  const depth = (y - hillY(x)) / 100;
  if (depth < 0.16) return r.pick(['#3a6cc4', '#4a82cc', '#2b55b5', '#3f78c8']);
  if (K.noise2(x * 0.008, y * 0.02, 23) > 0.58) return r.pick(['#2a6a7a', '#2f7a6a', '#1e4a5a', '#27606a']);
  return r.pick(['#1f3f8a', '#2a56a8', '#16306a', '#234a96', '#1a3878', '#2d5fae']);
}
const inTitle = (x, y) => x > 536 + 26 * K.noise1(y * 0.05, 3) && y > 860 + 7 * K.noise1(x * 0.03, 4);
function fgDir(x, y) {
  const a = inTitle(x, y) ? 0.07 * Math.sin(x * 0.02 + y * 0.1) : -1.1 + 0.55 * Math.sin(x * 0.017 + y * 0.021) + 0.8 * (K.noise2(x * 0.012, y * 0.012, 41) - 0.5);
  return [Math.cos(a), Math.sin(a)];
}
function fgPick(x, y, r) {
  if (inTitle(x, y)) return r.pick(['#13263a', '#172e40', '#1b3542', '#11203a', '#1a3340']);
  const n = K.noise2(x * 0.01, y * 0.02, 43);
  if (n < 0.4) return r.pick(['#1f4a34', '#2c5a3c', '#16382e', '#245058', '#3d6a3a']);
  if (n < 0.68) return r.pick(['#3f7046', '#567f3e', '#7a8a3a', '#2f5a3a', '#4a7a52']);
  return r.pick(['#b89a45', '#c9a94e', '#8f8a3e', '#d8bc62', '#a8923e']);
}
function roadPick(x, y, r) {
  const v = (y - 783) / 70, nz = K.noise2(x * 0.012, y * 0.05, 51);
  if (v < 0.13 || v > 0.86 || nz > 0.66) return r.pick(['#7d6aa8', '#8f7fc0', '#6a5c98', '#a593c9', '#5a4f8a']);
  return r.pick(['#c9a55a', '#d8bc72', '#e6d394', '#b58a4a', '#d2b060', '#dcc47c']);
}
function cypDir(x, y) {
  const a = -Math.PI / 2 + 0.5 * Math.sin(y * 0.03 + x * 0.045) + 0.5 * (K.noise2(x * 0.02, y * 0.012, 61) - 0.5);
  return [Math.cos(a), Math.sin(a)];
}
function cypPick(x, y, r) {
  const q = r();
  if (q < 0.08) return r.pick(['#5e7a3a', '#6b4a22', '#4a6a35']);
  if (q < 0.3) return r.pick(['#3a2c1c', '#4a3a1e', '#2a4a30', '#35552f']);
  return r.pick(['#0f1f1c', '#16302a', '#1f3d2c', '#10233f', '#12261e', '#1a3526']);
}

const WALLS = ['#1d2f66', '#24386e', '#2b3272', '#1a2a58', '#2f4480', '#27306a'];
const ROOFS = ['#35557e', '#3f6a7c', '#5a4a78', '#2c4a70', '#4a6f8c', '#44507e'];
function rowDashes(ctx, xa, xb, y, w, col, r) {
  let x = xa + r() * 3;
  while (x < xb - 7) {
    const l = Math.min(r.range(12, 22), xb - x);
    dash(ctx, [[x, y], [x + l / 2, y + r.range(-0.8, 0.8)], [x + l, y]], w, jit(col, r, 0.28));
    x += l + w * 0.9;
  }
}
function litWin(ctx, wd, pop = 0) {
  const s = 1 + 0.6 * pop, hw = (wd.w / 2) * s, hh = (wd.h / 2) * s;
  ctx.fillStyle = 'rgba(243,178,51,0.2)';
  K.circle(ctx, wd.x, wd.y, 13 + 10 * pop);
  ctx.fill();
  ctx.fillStyle = '#f0a22c';
  ctx.fillRect(wd.x - hw, wd.y - hh, 2 * hw, 2 * hh);
  ctx.fillStyle = '#fbe27a';
  ctx.fillRect(wd.x - hw, wd.y - hh, hw * 1.25, hh * 1.3);
  ctx.strokeStyle = OUTV;
  ctx.lineWidth = 1.7;
  ctx.strokeRect(wd.x - hw, wd.y - hh, 2 * hw, 2 * hh);
}
function paintHouse(ctx, h, r) {
  const { x, w, y, rh } = h, top = y - h.h;
  const wall = r.pick(WALLS), roof = r.pick(ROOFS);
  ctx.fillStyle = wall;
  ctx.fillRect(x, top, w, h.h);
  for (let yy = top + 5; yy < y - 2; yy += 6.5) rowDashes(ctx, x + 3, x + w - 3, yy, 5.5, wall, r);
  const apex = h.gable ? rh * 1.25 : rh;
  const R = h.gable ? [[x - 4, top], [x + w + 4, top], [x + w / 2, top - apex]] : [[x - 4, top], [x + w + 4, top], [x + w - w * 0.16, top - rh], [x + w * 0.12, top - rh]];
  K.fillPoly(ctx, R, roof);
  for (let k = 0; k < 3; k++) {
    const f = ((k + 0.5) / 3) * 0.86;
    const xa = lerp(x - 1, h.gable ? x + w / 2 : x + w * 0.12, f) + 3, xb = lerp(x + w + 1, h.gable ? x + w / 2 : x + w - w * 0.16, f) - 3;
    if (xb - xa > 9) rowDashes(ctx, xa, xb, top - apex * f - 1, 5, roof, r);
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUTV;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, top, w, h.h);
  K.strokePoly(ctx, R, OUTV, 3, true);
  for (const wd of h.wins) {
    ctx.fillStyle = '#0a1230';
    ctx.fillRect(wd.x - wd.w / 2, wd.y - wd.h / 2, wd.w, wd.h);
    if (wd.t < -100) litWin(ctx, wd);
  }
}
function paintChurch(ctx, r) {
  paintHouse(ctx, { x: 546, w: 108, y: 781, h: 42, rh: 24, gable: false, wins: [] }, r);
  ctx.fillStyle = '#24386e';
  ctx.fillRect(588, 668, 24, 74);
  for (let yy = 674; yy < 738; yy += 7) rowDashes(ctx, 590, 610, yy, 5, '#27407a', r);
  const sp = [[584, 668], [616, 668], [600, 528]];
  K.fillPoly(ctx, sp, '#1f3672');
  dash(ctx, [[595, 660], [598, 610], [600, 556]], 5, '#35589e');
  dash(ctx, [[606, 660], [603, 620], [601, 580]], 4.5, '#1a2c62');
  ctx.strokeStyle = OUTV;
  ctx.lineWidth = 3;
  ctx.strokeRect(588, 668, 24, 74);
  K.strokePoly(ctx, sp, OUTV, 3, true);
  for (const wd of WINDOWS) if (wd.church) {
    ctx.fillStyle = '#0a1230';
    ctx.fillRect(wd.x - wd.w / 2, wd.y - wd.h / 2, wd.w, wd.h);
  }
}
function paintTree(ctx, tr, r) {
  ctx.fillStyle = '#10241c';
  K.circle(ctx, tr.x, tr.y, tr.R);
  ctx.fill();
  for (let rr = tr.R - 2; rr > 1.5; rr -= 4.4) {
    const n = Math.max(2, Math.round((TAU * rr) / 15)), off = r() * TAU;
    for (let j = 0; j < n; j++) {
      const a0 = off + (j / n) * TAU, da = 11 / Math.max(rr, 5);
      const P = [0, 1, 2, 3].map((i) => [tr.x + Math.cos(a0 + (da * i) / 3) * rr, tr.y + Math.sin(a0 + (da * i) / 3) * rr * 0.92]);
      dash(ctx, P, 4.6, jit(r.pick(['#1c3b2e', '#2c5a3c', '#16302a', '#3d6a3a', '#1a3a44', '#234a34']), r, 0.2));
    }
  }
}

// ------------------------------------------------------------------------------------------------ title
function titleLayer() {
  const T = TITLES[12];
  const W = 450, H = 132, X = 442;
  const tl = K.layer(W, H, 2, (c) => {
    const lines = [
      [T.zh, 50, 48, { font: K.FONT.cjkSerif, weight: 700 }, '#f3d24e', '#fdf0a8'],
      [T.en, 86, 32, { font: K.FONT.script, weight: 400 }, '#f2e6b8', '#fffbe6'],
      [T.date, 118, 27, { font: K.FONT.serif, weight: 700, italic: true }, '#f0a534', '#f9cf7a'],
    ];
    for (const [str, y, size, f, col, hi] of lines) {
      const o = { ...f, size, align: 'right' };
      const sh = 'rgba(3,7,20,0.85)';
      K.text(c, str, X + 1.7, y + 2.3, { ...o, color: sh, stroke: { color: sh, width: 2.2 } });
      K.text(c, str, X, y, { ...o, color: col, stroke: { color: col, width: 1.3 } });
      K.text(c, str, X - 0.6, y - 0.8, { ...o, color: hi, alpha: 0.75 });
    }
  });
  return tl;
}
/** blit a layer in thin strips with a wandering baseline, so type reads as lettered by hand */
function wobbleBlit(ctx, lay, x, y, amp, seed) {
  const res = lay.res, sw = 3;
  for (let sx = 0; sx < lay.uw; sx += sw) {
    const dy = (K.noise1(sx * 0.028, seed) - 0.5) * 2 * amp;
    ctx.drawImage(lay, sx * res, 0, Math.min(sw * res + 1, lay.width - sx * res), lay.height, x + sx, y + dy, sw + 1 / res, lay.uh);
  }
}

// ------------------------------------------------------------------------------------------------ bake
function bakeGround() {
  return K.layer(1000, 1000, RES, (ctx) => {
    ctx.fillStyle = '#cbbb96';
    ctx.fillRect(0, 0, 1000, 1000);
    K.grain(ctx, 0, 0, 1000, 1000, { color: '#6a5a3a', alpha: 0.16, seed: 3, size: 1.2 });
    // underpainting inside a ragged edge: bare canvas shows round the border
    ctx.save();
    ctx.beginPath();
    for (let x = 0; x <= 1000; x += 8) ctx.lineTo(x, edgeThr(x, 0));
    for (let y = 0; y <= 1000; y += 8) ctx.lineTo(y > 772 && y < 866 ? 1000 : 1000 - edgeThr(1000, y), y);
    for (let x = 1000; x >= 0; x -= 8) ctx.lineTo(x, 1000 - edgeThr(x, 1000));
    for (let y = 1000; y >= 0; y -= 8) ctx.lineTo(y > 772 && y < 866 ? 0 : edgeThr(0, y), y);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 600, [[0, '#101c4c'], [0.6, '#172a66'], [1, '#22407e']]);
    ctx.fillRect(0, 0, 1000, 620);
    ctx.beginPath();
    ctx.moveTo(0, 1000);
    for (let x = 0; x <= 1000; x += 10) ctx.lineTo(x, hillY(x));
    ctx.lineTo(1000, 1000);
    ctx.closePath();
    ctx.fillStyle = '#142659';
    ctx.fill();
    ctx.fillStyle = '#121d48';
    ctx.fillRect(0, 700, 1000, 90);
    ctx.fillStyle = '#8a7448';
    ctx.fillRect(0, 780, 1000, 76);
    ctx.fillStyle = '#16302a';
    ctx.fillRect(0, ROAD_BOT, 1000, 150);
    ctx.restore();

    // --- sky
    flowPaint(ctx, { x0: -4, y0: 0, x1: 1004, y1: 610, sep: 7.6, w: 8.6, len: 27, gap: 2.5, nDash: 5, seed: 12, inside: (x, y) => painted(x, y) && y < hillY(x) + 5, dir: skyDir, pick: skyPick, repick: true });
    flowPaint(ctx, {
      x0: -4, y0: 0, x1: 1004, y1: 600, sep: 13, seedGap: 13, w: 5.6, len: 22, gap: 5, nDash: 3, seed: 13,
      inside: (x, y) => painted(x, y) && y < hillY(x) - 4, dir: skyDir,
      pick: (x, y, r) => {
        for (const s of ORBS) if (Math.hypot(x - s.x, y - s.y) < s.R * 1.1) return null;
        if (r() < 0.3) return null;
        const P = Math.max(skyPale(x, y), K.bump(y, hillY(x) - 30, 30));
        return r() < P ? r.pick(['#eef0d8', '#ffffff', '#dfe8b0', '#cfe6e6', '#f1e9a8']) : r.pick(['#3f74c8', '#4a7ac4', '#5f8fcf', '#2f5fc0', '#6f9bd0']);
      },
    });

    // --- hills
    flowPaint(ctx, { x0: -4, y0: 530, x1: 1004, y1: 792, sep: 7.2, w: 8.2, len: 26, gap: 2.5, nDash: 5, seed: 21, inside: (x, y) => painted(x, y) && y > hillY(x) + 5 && y < 788, dir: hillDir, pick: hillPick });
    const rr = K.rng(22);
    for (const [off, w, amp] of [[1, 5.5, 0], [44, 4.6, 10], [84, 4.2, 14]]) {
      const yy = (x) => hillY(x) + off + amp * Math.sin(x * 0.019 + off);
      for (let x = 6 + rr() * 10; x < 992; ) {
        const l = rr.range(22, 38);
        dash(ctx, [0, 1, 2, 3].map((i) => [x + (l * i) / 3, yy(x + (l * i) / 3)]), w, jit(OUT, rr, 0.12));
        x += l + rr.range(5, off > 1 ? 40 : 9);
      }
    }

    // --- village
    const rv = K.rng(31);
    for (const tr of TREES) if (tr.row === 0) paintTree(ctx, tr, rv);
    for (const h of HOUSES) if (h.row === 0) paintHouse(ctx, h, rv);
    for (const tr of TREES) if (tr.row === 1) paintTree(ctx, tr, rv);
    paintChurch(ctx, rv);
    for (const h of HOUSES) if (h.row === 1) paintHouse(ctx, h, rv);

    // --- the lane
    flowPaint(ctx, {
      x0: -8, y0: 778, x1: 1008, y1: 858, sep: 6.6, w: 7.6, len: 30, gap: 2.5, nDash: 6, seed: 41,
      inside: (x, y) => y > roadTop(x) && y < ROAD_BOT && x > -8 && x < 1008,
      dir: (x, y) => {
        const a = 0.05 * Math.sin(x * 0.013 + y * 0.07) + 0.12 * (K.noise2(x * 0.01, y * 0.03, 53) - 0.5);
        return [Math.cos(a), Math.sin(a)];
      },
      pick: roadPick,
    });
    const re = K.rng(42);
    for (let x = -4 + re() * 8; x < 1004; ) {
      const l = re.range(24, 40);
      dash(ctx, [[x, roadTop(x)], [x + l / 2, roadTop(x + l / 2)], [x + l, roadTop(x + l)]], 4.4, jit('#231d50', re, 0.15));
      x += l + re.range(4, 12);
    }
    for (let x = -4 + re() * 8; x < 1004; ) {
      const l = re.range(22, 36), yy = ROAD_BOT + re.range(-1.5, 1.5);
      dash(ctx, [[x, yy], [x + l / 2, yy + re.range(-1, 1)], [x + l, yy]], 4.8, jit('#182a2a', re, 0.15));
      x += l + re.range(3, 10);
    }

    // --- wheat and hedge
    flowPaint(ctx, { x0: -4, y0: ROAD_BOT + 2, x1: 1004, y1: 1000, sep: 6.4, w: 7, len: 24, gap: 2, nDash: 4, seed: 51, inside: (x, y) => painted(x, y) && y > ROAD_BOT + 3, dir: fgDir, pick: fgPick });
    flowPaint(ctx, {
      x0: -4, y0: ROAD_BOT + 2, x1: 1004, y1: 1000, sep: 12, seedGap: 12, w: 4.6, len: 20, gap: 4, nDash: 2, seed: 52,
      inside: (x, y) => painted(x, y) && y > ROAD_BOT + 6 && !inTitle(x, y) && !inTitle(x + 14, y + 8), dir: fgDir,
      pick: (x, y, r) => (r() < 0.45 ? null : r.pick(['#d8bc62', '#e6d394', '#8fb04a', '#c9a94e', '#6f9a52', '#f0d878'])),
    });

    // --- signed in paint, lower right
    ctx.save();
    ctx.translate(972, 992);
    ctx.rotate(-0.022);
    wobbleBlit(ctx, titleLayer(), -442, -128, 1.6, 7);
    ctx.restore();
  });
}

function bakeCypress() {
  const X0 = 80, Y0 = 30, W = 250, H = 772;
  const lay = K.layer(W, H, RES, (ctx) => {
    ctx.translate(-X0, -Y0);
    for (const c of CYP) {
      ctx.beginPath();
      for (let y = c.top; y <= c.base; y += 4) ctx.lineTo(cypAxis(c, y) - Math.max(0, cypHalf(c, 0, y)), y);
      for (let y = c.base; y >= c.top; y -= 4) ctx.lineTo(cypAxis(c, y) + Math.max(0, cypHalf(c, 999, y)), y);
      ctx.closePath();
      ctx.fillStyle = '#0c1a18';
      ctx.fill();
    }
    flowPaint(ctx, { x0: X0, y0: Y0, x1: X0 + W, y1: Y0 + H, sep: 6.4, w: 7.4, len: 34, gap: 2, nDash: 6, seed: 61, inside: inCyp, dir: cypDir, pick: cypPick, jit: 0.25 });
    flowPaint(ctx, {
      x0: X0, y0: Y0, x1: X0 + W, y1: Y0 + H, sep: 14, seedGap: 14, w: 4.4, len: 30, gap: 4, nDash: 3, seed: 62, inside: inCyp, dir: cypDir,
      pick: (x, y, r) => (r() < 0.5 ? null : r.pick(['#4a6a35', '#6b4a22', '#2f5a48', '#7a5a2a', '#3a6a52'])),
    });
  });
  lay.x0 = X0;
  lay.y0 = Y0;
  return lay;
}

function bakeCrescent() {
  return K.layer(100, 100, 2, (ctx) => {
    ctx.translate(50, 50);
    const r = K.rng(71);
    // a dark rim first, so the horn reads against the moon's own glowing disc
    ctx.fillStyle = '#b4521c';
    K.circle(ctx, 0, 0, 40);
    ctx.fill();
    ctx.fillStyle = '#e8922c';
    K.circle(ctx, 0, 0, 36.5);
    ctx.fill();
    for (const [rad, a0, a1, w] of [[31, -1.3, 1.3, 7], [24, -0.75, 0.75, 6.5], [34.5, -1.0, 1.0, 4]]) {
      const n = Math.max(2, Math.round(((a1 - a0) * rad) / 15));
      for (let j = 0; j < n; j++) {
        const b0 = a0 + ((a1 - a0) * j) / n, b1 = a0 + ((a1 - a0) * (j + 0.8)) / n;
        dash(ctx, [0, 1, 2, 3].map((i) => [Math.cos(lerp(b0, b1, i / 3)) * rad, Math.sin(lerp(b0, b1, i / 3)) * rad]), w, jit(r.pick(['#f3b84a', '#e5862a', '#f7d46a', '#ee9c2e']), r, 0.14));
      }
    }
    ctx.globalCompositeOperation = 'destination-out';
    K.circle(ctx, -16, -2, 34);
    ctx.fill();
  });
}

function bakeWeave() {
  const lay = K.layer(1000, 1000, RES, (ctx) => {
    const tile = K.makeCanvas(8, 8), c = tile.getContext('2d');
    c.fillStyle = 'rgba(255,255,255,0.11)';
    c.fillRect(0, 1, 4, 2);
    c.fillRect(4, 5, 4, 2);
    c.fillRect(5, 0, 2, 4);
    c.fillRect(1, 4, 2, 4);
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.fillRect(0, 3, 4, 1);
    c.fillRect(4, 7, 4, 1);
    c.fillRect(7, 0, 1, 4);
    c.fillRect(3, 4, 1, 4);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, 1000 * RES, 1000 * RES);
    ctx.restore();
    K.grain(ctx, 0, 0, 1000, 1000, { color: '#000000', alpha: 0.07, seed: 5, size: 1.3 });
    K.grain(ctx, 0, 0, 1000, 1000, { color: '#ffffff', alpha: 0.05, seed: 6, size: 1.3 });
  });
  return lay;
}

// ------------------------------------------------------------------------------------------------ the pelican
const hiC = new Map();
const hiOf = (c, k) => {
  const key = c + k;
  let v = hiC.get(key);
  if (!v) hiC.set(key, (v = K.shade(c, k)));
  return v;
};
function pdash(ctx, P, w, col) {
  trace(ctx, P, w * 0.16, w * 0.22);
  ctx.strokeStyle = 'rgba(8,14,40,0.45)';
  ctx.lineWidth = w;
  ctx.stroke();
  trace(ctx, P, 0, 0);
  ctx.strokeStyle = col;
  ctx.stroke();
  trace(ctx, P, -w * 0.2, -w * 0.24);
  ctx.strokeStyle = hiOf(col, 0.35);
  ctx.lineWidth = w * 0.28;
  ctx.stroke();
}
const ST = {
  body: { base: '#e6dcba', lit: ['#fbf6e2', '#f0e6c0', '#f6edd0', '#fffaf0'], shd: ['#b9cfe2', '#a9c2dc', '#d9d6c0', '#c2d2de'], rings: [[0.8, 13, 8], [0.5, 8, 8], [0.2, 4, 7]] },
  wing: { base: '#aac3dc', lit: ['#dbe8ee', '#c2d8e8', '#f0e6c0'], shd: ['#7fa3d2', '#8fb7d6', '#6f93c8'], rings: [[0.74, 10, 7], [0.36, 5, 6.5]] },
  arm: { base: '#b5cbe0', lit: ['#dbe8ee', '#f0e6c0'], shd: ['#8fb0d6', '#7fa3d2'], rings: [[0.55, 6, 5.5]] },
  tail: { base: '#d6dbd2', lit: ['#f0e6c0', '#fbf6e2'], shd: ['#a9c2dc'], rings: [[0.5, 3, 5]] },
  neck: { base: '#ece3c4', lit: ['#fbf6e2', '#f0e6c0'], shd: ['#c9d6dc', '#b9cfe2'], rings: [[0.6, 8, 6]] },
  head: { base: '#f3ecd0', lit: ['#fffaf0', '#f6edd0'], shd: ['#cfd9dc', '#e6dcba'], rings: [[0.5, 5, 6]] },
  beak: { base: '#f0b83a', lit: ['#f7dc6a', '#f3c64a'], shd: ['#e8962c', '#f0a534'], rings: [[0.55, 7, 5]] },
  pouch: { base: '#ee9c2e', lit: ['#f3b84a', '#f0a534'], shd: ['#d9772b', '#e5862a', '#c9602a'], rings: [[0.62, 8, 6], [0.2, 3, 5]] },
  foot: { base: '#e58a2b', lit: ['#f3b84a'], shd: ['#c9602a'], rings: [[0.45, 3, 4]] },
  saddle: { base: '#3a2c4e', lit: ['#5a4a78'], shd: ['#2a2040'], rings: [[0.4, 2, 4]] },
  metal: { base: '#8fb2d8', lit: ['#c8dcee'], shd: ['#6f93c8'], rings: [] },
  scarf: { base: '#c8452f', lit: ['#e8725a'], shd: ['#a83422'], rings: [[0.4, 2, 4]] },
};
const LINE = {
  frame: ['#d9662b', '#f6a860'], metal: ['#8fb2d8', '#dcebf6'], leg: ['#e58a2b', '#f9cf7a'], scarf: ['#c8452f', '#f08a6a'],
  wing: ['#b5cbe0', '#eef4f4'], head: ['#f3ecd0', '#ffffff'], saddle: ['#3a2c4e', '#6a5a88'],
};
function ppoly(ctx, pts, st, seed, far) {
  const n = pts.length;
  let cx = 0, cy = 0, y0 = 1e9, y1 = -1e9;
  for (const p of pts) {
    cx += p[0];
    cy += p[1];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  cx /= n;
  cy /= n;
  K.path(ctx, pts, true);
  ctx.fillStyle = far ? hiOf(st.base, -0.28) : st.base;
  ctx.fill();
  let q = seed * 131;
  for (const [sc, nd, w] of st.rings) {
    const C = pts.map((p) => [cx + (p[0] - cx) * sc, cy + (p[1] - cy) * sc]);
    C.push(C[0]);
    const AL = K.arcLen(C);
    for (let j = 0; j < nd; j++) {
      const h1 = K.hash1(++q), h2 = K.hash1(q + 7777);
      const u0 = (j + 0.25 * h1) / nd, du = 0.72 / nd;
      const P = [0, 1 / 3, 2 / 3, 1].map((k) => K.pointAt(C, (u0 + du * k) % 1, AL));
      const pal = (P[1][1] + P[2][1]) / 2 < cy + (y1 - y0) * 0.08 ? st.lit : st.shd;
      const col = pal[Math.floor(h2 * pal.length)];
      pdash(ctx, P, w, far ? hiOf(col, -0.28) : col);
    }
  }
  K.path(ctx, pts, true);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = st.ow ?? 3.8;
  ctx.stroke();
}
function pline(ctx, pts, w, col, hi) {
  trace(ctx, pts, 0, 0);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w + 3.6;
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
  if (w > 2.5) {
    trace(ctx, pts, -w * 0.18, -w * 0.22);
    ctx.strokeStyle = hi;
    ctx.lineWidth = Math.max(1, w * 0.3);
    ctx.stroke();
  }
}
function drawPelican(ctx, pose, A, fl) {
  const s = pose.s;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // its shadow, in violet dashes on the lane
  const gx = (pose.wheels[0].c[0] + pose.wheels[1].c[0]) / 2, gy = pose.y ?? ROAD;
  for (let i = 0; i < 7; i++) {
    const h = K.hash1(900 + i), x0 = gx - 118 * s + i * 32 * s + h * 8, yy = gy + 3 + ((i * 5) % 9) * 0.9 * s, l = (26 + h * 14) * s;
    pdash(ctx, [[x0, yy], [x0 + l / 2, yy + 0.6], [x0 + l, yy]], 5.5 * s, i % 3 ? '#4f4486' : '#3a3270');
  }
  let i = 0;
  for (const p of Rig.parts(pose)) {
    i++;
    if (p.kind === 'wheel') {
      const sc = p.r / 50;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = K.radGrad(ctx, p.c[0], p.c[1], p.r * 0.5, p.r * (1.5 + 0.5 * fl), [[0, `rgba(255,236,150,${0.2 + 0.3 * fl})`], [1, 'rgba(255,236,150,0)']]);
      K.circle(ctx, p.c[0], p.c[1], p.r * (1.5 + 0.5 * fl));
      ctx.fill();
      ctx.restore();
      spin(ctx, L.wheel, p.c[0], p.c[1], A, sc);
    } else if (p.kind === 'poly') {
      const st = p.name === 'arm' ? ST.arm : p.name === 'scarfKnot' ? ST.scarf : ST[p.role] ?? ST.metal;
      ppoly(ctx, p.pts, st, i, p.far);
    } else if (p.kind === 'line') {
      if (p.role === 'mark') {
        trace(ctx, p.pts, 0, 0);
        ctx.strokeStyle = p.name === 'beakLine' ? '#a8521e' : '#4a6fb0';
        ctx.lineWidth = Math.max(2.4, p.w + 1);
        ctx.stroke();
      } else if (p.w < 2.5 * s) {
        trace(ctx, p.pts, 0, 0);
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.8 * s;
        ctx.stroke();
      } else {
        const c = LINE[p.role] ?? LINE.metal;
        pline(ctx, p.pts, p.w * (p.role === 'frame' ? 1.0 : 0.92), p.far ? hiOf(c[0], -0.3) : c[0], p.far ? c[0] : c[1]);
      }
    } else if (p.kind === 'disc') {
      K.circle(ctx, p.c[0], p.c[1], p.r);
      ctx.fillStyle = '#f0a534';
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      K.circle(ctx, p.c[0] - p.r * 0.2, p.c[1] - p.r * 0.25, p.r * 0.4);
      ctx.fillStyle = '#f9d67a';
      ctx.fill();
    } else if (p.kind === 'eye') {
      K.circle(ctx, p.c[0], p.c[1], p.r * 1.15);
      ctx.fillStyle = '#fffdf2';
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      K.circle(ctx, p.pupil[0], p.pupil[1], p.pr * 1.1);
      ctx.fillStyle = OUT;
      ctx.fill();
      if (p.lid > 0.5) {
        K.circle(ctx, p.c[0], p.c[1], p.r * 1.15);
        ctx.fillStyle = '#e6dcba';
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ time
/** ∫ smoothstep(a, b, ·): 0 before a, slope 1 after b */
function ramp(x, a, b) {
  if (x <= a) return 0;
  if (x >= b) return (b - a) / 2 + (x - b);
  const u = (x - a) / (b - a);
  return (b - a) * (u * u * u - (u * u * u * u) / 2);
}
const pulse = (t, t0, d = 0.3) => (t < t0 - 0.07 ? 0 : t < t0 ? sstep(t0 - 0.07, t0, t) : Math.exp(-(t - t0) / d));
const flare = (t) => Math.min(1.15, pulse(t, 2.0, 0.34) + 0.55 * pulse(t, 3.0, 0.3) + 0.3 * pulse(t, 4.0, 0.3));

export default {
  id: 12,
  key: 'starry',
  title: TITLES[12],
  heroT: 3.0,

  act(t, p) {
    // it glances up at what its wheels are doing to the sky
    const g = K.gate(t, 1.9, 3.8, 0.3);
    p.headTilt = (p.headTilt || 0) + 0.14 * g;
    p.eye = [0.35 * g, -0.9 * g];
    p.neck = (p.neck || 0) + 0.35 * g;
  },

  async init() {
    const bg = bakeGround();
    const cyp = bakeCypress();
    const whorls = VORT.map((v, i) =>
      discSprite(v.R, {
        seed: 80 + i, w: 8.4, len: 27, res: RES,
        under: [[0, '#e9e6b0'], [0.14, '#9fc6dc'], [0.5, '#3a66b8'], [1, '#2b4f9e']],
        col: (d, th, r) => whorlCol(v, d, th, r),
        pitch: (d) => (-2 * whorlW(d)) / (TAU * FQ),
      }),
    );
    const orbs = ORBS.map((s, i) => {
      const p = ORBPAL[s.k];
      return discSprite(s.R, {
        seed: 90 + i, w: s.k === 'm' ? 7.6 : 6.4, len: s.k === 'm' ? 22 : 16, res: 1.7,
        under: [[0, p.core[0]], [0.3, p.in[0]], [0.6, p.mid[0]], [0.85, p.out[0]], [1, '#4a7ac4']],
        col: (d, th, r) => orbCol(s.k, d, th, r, ARMS),
        pitch: () => -0.05,
        core: s.k === 'm' ? null : p.core[0],
      });
    });
    const wheel = discSprite(50, {
      seed: 120, w: 6, len: 14, res: 2.2, solid: true, outline: true,
      under: [[0, '#fbf7dc'], [0.5, '#f0c84a'], [1, '#e9c94a']],
      col: wheelCol,
      pitch: () => -0.05,
      core: '#ffffff',
    });
    L = { bg, cyp, whorls, orbs, wheel, crescent: bakeCrescent(), weave: bakeWeave() };
  },

  render(ctx, t, env) {
    const lx = env.rider ? env.rider.lx : -30 + (1060 * t) / 6;
    const A = (ramp(lx, -200, 0) - ramp(lx, 1000, 1200)) / 50 + 0.3 * t;
    const fl = flare(t);

    K.put(ctx, L.bg, 0, 0);

    // the heavens, geared to the bicycle
    VORT.forEach((v, i) => spin(ctx, L.whorls[i], v.x, v.y, A * v.gear));
    ORBS.forEach((s, i) => {
      const sc = 1 + (s.k === 'm' ? 0.13 : 0.3) * fl;
      spin(ctx, L.orbs[i], s.x, s.y, A, sc);
      if (s.k === 'm') {
        const cs = 100 * (1 + 0.1 * fl);
        ctx.drawImage(L.crescent, s.x - cs / 2, s.y - cs / 2, cs, cs);
      }
    });
    if (fl > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of ORBS) {
        const R = s.R * (1.2 + 0.7 * fl);
        ctx.fillStyle = K.radGrad(ctx, s.x, s.y, 0, R, [[0, `rgba(255,244,170,${0.42 * fl})`], [0.5, `rgba(255,236,150,${0.2 * fl})`], [1, 'rgba(255,236,150,0)']]);
        ctx.fillRect(s.x - R, s.y - R, 2 * R, 2 * R);
      }
      ctx.restore();
    }

    K.put(ctx, L.cyp, L.cyp.x0, L.cyp.y0);

    // the village wakes, window by window
    for (const wd of WINDOWS) if (wd.t > -100 && t >= wd.t) litWin(ctx, wd, Math.exp(-(t - wd.t) / 0.18));

    if (env.pose) drawPelican(ctx, env.pose, A, fl);

    K.put(ctx, L.weave, 0, 0);
  },
};
