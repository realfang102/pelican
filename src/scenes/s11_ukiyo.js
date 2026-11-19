// Section 11 — Ukiyo-e (1830s) — a colour woodblock print in the manner of Hiroshige's Tōkaidō stations.
// The coast road on its embankment, old pines, a thatched tea stall with a banner, sails and a snow-capped cone
// under a Prussian-blue bokashi sky; travellers on the lower path. Vermilion title cartouche, series cartouche, seals.
//
// The gag: on the downbeat of bar 2 a sudden shower — hundreds of fine, long, nearly parallel black lines in two
// crossing angles sweep over the whole print, the top of the sky goes sumi-grey; the travellers flinch, duck under
// hats and a mat and run, the stall-keeper hauls in the banner — and the pelican just rides on, sedge hat tipped
// forward. The rain thins and stops in bar 3; afterwards one traveller looks out from under his mat.
//
// Technique: no p5.brush — a woodcut line is a crisp carved line. Colour blocks are painted on a transparent layer
// (bokashi = alpha gradients), cut with a procedural wood grain and baren specks, printed over the paper in multiply
// and slightly out of register with the key block (variable-width filled lines). Figures, banner, pelican and rain are
// drawn per frame in the same manner; one paper/grain layer goes over everything so moving and static ink share a sheet.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const TAU = Math.PI * 2;
const RES = 1.25;
const HOR = 436; // horizon
const C = {
  paper: '#eadfc3', white: '#f2ead3', ink: '#1c1917',
  blue: '#1b4b9b', indigo: '#2a466f', rose: '#e39a7c', verm: '#c8402a', beni: '#c4472f',
  yellow: '#e9bd45', orange: '#dc6c33', straw: '#dcc27d', thatch: '#c8a45e',
  pine: '#47755c', pineDk: '#1d3b3a', grass: '#8ea76a', grassDk: '#4f7f5c',
  trunk: '#94633f', trunkDk: '#4b3324', wood: '#b68a55', skin: '#e4bf98', road: '#dcc48e',
};
let L = null;

// ------------------------------------------------------------------------------------------- primitives
/** key-block line: a filled ribbon that swells and thins along its length (noise keyed to arc fraction → no boil) */
function kline(ctx, pts, w = 2, o = {}) {
  if (pts.length < 2) return;
  let P = o.smooth === false ? pts : K.catmull(pts, 6);
  P = K.resample(P, o.step ?? 3);
  const Ls = K.arcLen(P), total = Ls[Ls.length - 1] || 1;
  const n = o.n ?? Math.max(2, total / 34), seed = o.seed ?? 1, amp = o.amp ?? 0.34;
  const [ti, to] = o.taper ?? [0, 0];
  const poly = K.ribbonPoly(P, (u) => {
    const s = u * total;
    let k = 1 + amp * (K.noise1(u * n, seed) - 0.5) * 2;
    if (ti > 0) k *= Math.min(1, 0.2 + (0.8 * s) / ti);
    if (to > 0) k *= Math.min(1, 0.2 + (0.8 * (total - s)) / to);
    return Math.max(0.35, w * k);
  });
  K.path(ctx, poly, true);
  ctx.fillStyle = o.color ?? C.ink;
  ctx.fill();
}
/** closed key-line outline */
function kloop(ctx, pts, w, o = {}) {
  const P = o.smooth ? K.catmull(pts, 6, true) : pts;
  kline(ctx, P.concat([P[0], P[1]]), w, { ...o, smooth: false });
}
function sline(ctx, pts, w = 1.5, closed = false, col = C.ink) {
  K.path(ctx, pts, closed);
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
}
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const ring = (cx, cy, rx, ry = rx, n = 20, a0 = 0) => Array.from({ length: n }, (_, i) => [cx + Math.cos(a0 + (i / n) * TAU) * rx, cy + Math.sin(a0 + (i / n) * TAU) * ry]);
const lg = (ctx, x0, y0, x1, y1, col, stops) => K.linGrad(ctx, x0, y0, x1, y1, stops.map(([o, a, c]) => [o, K.rgba(c ?? col, a)]));
const yAt = (P, x) => {
  for (let i = 1; i < P.length; i++) if (P[i][0] >= x) {
    const a = P[i - 1], b = P[i], u = (x - a[0]) / (b[0] - a[0] || 1);
    return a[1] + (b[1] - a[1]) * u;
  }
  return P[P.length - 1][1];
};
/** a colour block: what was printed there before is cut away, then the new colour (null = bare paper) */
function tone(cc, pts, fill, smooth = false) {
  smooth ? K.spline(cc, pts, true) : K.path(cc, pts, true);
  cc.globalCompositeOperation = 'destination-out';
  cc.fillStyle = '#000';
  cc.fill();
  cc.globalCompositeOperation = 'source-over';
  if (fill) {
    cc.fillStyle = fill;
    cc.fill();
  }
}
/** bokashi: a vertical gradation wiped inside a shape */
function bokashi(cc, pts, y0, y1, col, stops) {
  cc.save();
  K.path(cc, pts, true);
  cc.clip();
  cc.fillStyle = lg(cc, 0, y0, 0, y1, col, stops);
  cc.fillRect(-20, -20, 1040, 1040);
  cc.restore();
}
/** a hand-cut line that breaks here and there */
function broken(lc, pts, w, seed, on = [70, 170], off = [10, 40], o = {}) {
  const r = K.rng(seed), P = K.resample(pts, 4), n = P.length;
  let i = 0;
  while (i < n - 2) {
    const j = Math.min(n - 1, i + Math.round(r.range(on[0], on[1]) / 4));
    if (j - i > 2) kline(lc, P.slice(i, j + 1), w, { smooth: false, seed: seed + i, taper: [8, 10], ...o });
    i = j + Math.round(r.range(off[0], off[1]) / 4);
  }
}
/** wood grain of the block: wavy, nearly horizontal lines that show where the pigment did not take */
function woodGrain(seed, color, res = 0.7) {
  return K.layer(1000, 1000, res, (ctx, c) => {
    const w = c.width, h = c.height, img = ctx.createImageData(w, h), d = img.data, [r, g, b] = K.rgb(color);
    for (let j = 0, i = 0; j < h; j++) {
      for (let x0 = 0; x0 < w; x0++, i += 4) {
        const x = x0 / res, y = j / res;
        const warp = K.fbm2(x / 640, y / 170, 3, seed) * 115 + K.noise2(x / 50, y / 300, seed + 5) * 2.5;
        const v = (y + warp) / 7, f = Math.abs(v - Math.floor(v) - 0.5) * 2;
        const line = 1 - K.smoothstep(0.1, 0.42, f);
        const patch = K.smoothstep(0.36, 0.76, K.fbm2(x / 300 + 9, y / 150, 3, seed + 9));
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = 255 * line * (0.1 + 0.9 * patch);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

// ------------------------------------------------------------------------------------------- the little people
const pose = (lean, a, b, arm, armF, head = 0, hat = 0, air = 0, st = 0.1) => ({ lean, a, b, arm, armF, head, hat, air, st });
const mixA = (p, q, s) => [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s];
function mixPose(p, q, s) {
  if (s <= 0) return p;
  if (s >= 1) return q;
  const l = K.lerp;
  return { lean: l(p.lean, q.lean, s), a: mixA(p.a, q.a, s), b: mixA(p.b, q.b, s), arm: mixA(p.arm, q.arm, s), armF: mixA(p.armF, q.armF, s), head: l(p.head, q.head, s), hat: l(p.hat, q.hat, s), air: l(p.air, q.air, s), st: l(p.st, q.st, s) };
}
const LA = [0.42, 0.1], LB = [-0.36, -0.62]; // walking: leading / trailing leg (thigh, shin from vertical)
const RA = [1.05, 0.2], RB = [-0.7, -1.65]; // running
const HATF = [15, -9], HATB = [9, -11]; // hands on the brim
const STAND = [[0.12, 0.01], [-0.12, -0.08]];
const PO = {
  w0: pose(0.07, LA, LB, [-6, 22], [8, 21]), w1: pose(0.07, LB, LA, [8, 21], [-6, 22]),
  r0: pose(0.5, RA, RB, HATF, HATB, 0.15, 0.32, 3), r1: pose(0.5, RB, RA, HATF, HATB, 0.15, 0.32, 0),
  flinch: pose(-0.1, ...STAND, [11, -5], [-7, -7], -0.35, -0.35),
  look: pose(-0.05, ...STAND, [10, -12], [3, 23], -0.38, -0.55),
  // pilgrim with a staff
  pw0: pose(0.07, LA, LB, [12, 7], [8, 21], 0, 0, 0, 0.14), pw1: pose(0.07, LB, LA, [13, 6], [-6, 22], 0, 0, 0, 0.02),
  pr0: pose(0.5, RA, RB, [13, 8], HATF, 0.15, 0.32, 3, 0.9), pr1: pose(0.5, RB, RA, [14, 8], HATF, 0.15, 0.32, 0, 0.95),
  pflinch: pose(-0.1, ...STAND, [12, 2], [-7, -7], -0.35, -0.35, 0, 0.3),
  plook: pose(-0.05, ...STAND, [12, 6], [10, -12], -0.38, -0.55, 0, 0.1),
  // bearers and porter: one hand on the pole
  bw0: pose(0.1, LA, LB, [7, -3], [6, 20]), bw1: pose(0.1, LB, LA, [7, -3], [-6, 21]),
  br0: pose(0.38, RA, RB, [7, -3], [10, 14], 0.12, 0, 3), br1: pose(0.38, RB, RA, [7, -3], [-8, 16], 0.12, 0, 0),
  bflinch: pose(0, ...STAND, [7, -3], [-5, 4], -0.4, -0.3), blook: pose(0.02, ...STAND, [7, -3], [4, 22], -0.4, -0.5),
  qr0: pose(0.42, RA, RB, [7, -3], HATF, 0.15, 0.32, 3), qr1: pose(0.42, RB, RA, [7, -3], HATF, 0.15, 0.32, 0),
  // groom: one hand back on the lead rope
  gw0: pose(0.07, LA, LB, [8, 20], [-12, 9]), gw1: pose(0.07, LB, LA, [-4, 22], [-12, 10]),
  gh0: pose(0.42, [0.55, 0], [-0.3, -0.8], HATF, [-13, 8], 0.2, 0.34), gh1: pose(0.42, [-0.3, -0.8], [0.55, 0], HATF, [-13, 9], 0.2, 0.34),
  gflinch: pose(-0.1, ...STAND, [11, -5], [-12, 8], -0.35, -0.35), glook: pose(-0.05, ...STAND, [10, -12], [-12, 10], -0.38, -0.55),
  // the man with the mat
  squat: pose(0.62, [1.25, -0.55], [1.0, -0.8], [14, -8], [10, -10], 0.1),
  peek: pose(0.55, [1.25, -0.55], [1.0, -0.8], [15, -11], [11, -12], 0.3),
  // the stall
  kIdle: pose(0.03, [0.08, 0.02], [-0.08, -0.04], [6, 14], [7, 15]),
  kGrab: pose(0.25, [0.3, 0.05], [-0.2, -0.3], [17, -5], [15, 1]),
  kPull: pose(-0.22, [0.35, 0.3], [-0.1, -0.25], [16, -2], [14, 4]),
  kShel: pose(0.02, [0.08, 0.02], [-0.08, -0.04], [15, -1], [6, 14], -0.25),
  sit: pose(0.12, [1.45, 0.05], [1.35, 0.12], [9, 12], [8, 14], 0, 0, 4),
};
function ik2(S, T, l1, l2, bend) {
  const dx = T[0] - S[0], dy = T[1] - S[1], d = K.clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const a = Math.acos(K.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), base = Math.atan2(dy, dx);
  return [S[0] + Math.cos(base + bend * a) * l1, S[1] + Math.sin(base + bend * a) * l1];
}
/**
 * A small traveller, ≈ 100 units tall at k = 1, feet on (x, y), facing +x (dir −1 mirrors).
 * f: { x, y, k, dir, pose, col:{robe, shin, thigh, sleeve, sash, stripe, loin}, hat, bare, long, eye, staff, back, mid, after }
 */
function man(ctx, f) {
  const q = f.pose, k = f.k ?? 1, dir = f.dir ?? 1, lw = 1.5, col = f.col;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(dir * k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const legPts = (g) => {
    const kx = Math.sin(g[0]) * 20, ky = Math.cos(g[0]) * 20;
    return [[kx, ky], [kx + Math.sin(g[1]) * 21, ky + Math.cos(g[1]) * 21]];
  };
  const A = legPts(q.a), B = legPts(q.b);
  const H = [0, -(Math.max(A[1][1], B[1][1]) + 3 + q.air)];
  const up = [Math.sin(q.lean), -Math.cos(q.lean)], fw = [Math.cos(q.lean), Math.sin(q.lean)];
  const pt = (a, b) => [H[0] + up[0] * a + fw[0] * b, H[1] + up[1] * a + fw[1] * b];
  const S = pt(31, 0), ha = q.lean + q.head, HD = [S[0] + Math.sin(ha) * 9.5, S[1] - Math.cos(ha) * 9.5];
  const seg = (pts, w, c1, c2) => {
    K.path(ctx, pts);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = w + lw * 2;
    ctx.stroke();
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.strokeStyle = c2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.strokeStyle = c1;
    ctx.stroke();
  };
  const leg = (Lg, far) => {
    const kn = [H[0] + Lg[0][0], H[1] + Lg[0][1]], an = [H[0] + Lg[1][0], H[1] + Lg[1][1]];
    const c1 = col.thigh ?? C.skin, c2 = col.shin ?? C.skin;
    seg([H, kn, an], 6.2, far ? K.shade(c1, -0.1) : c1, far ? K.shade(c2, -0.12) : c2);
    K.path(ctx, [an, [an[0] + 7, Math.min(-1.4, an[1] + 2.4)]]);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.strokeStyle = C.straw;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  };
  const arm = (T, far) => {
    const d = Math.hypot(T[0], T[1]) || 1, m = Math.min(1, 26.5 / d), hand = [S[0] + T[0] * m, S[1] + T[1] * m];
    const c1 = col.sleeve ?? col.robe;
    seg([S, ik2(S, hand, 14, 13, 1), hand], 4.8, far ? K.shade(c1, -0.12) : c1, C.skin);
    return hand;
  };
  const hF = arm(q.armF, true);
  leg(B, true);
  if (f.back) f.back(ctx, pt);
  leg(A, false);
  // robe: tucked up short for the road, long for the stall-keeper; bearers go bare
  const hem = f.long ? -37 : f.bare ? -5 : -12, fl = f.long ? 9 : f.bare ? 8.5 : 11;
  K.path(ctx, [pt(31, 6), pt(20, 8.5), pt(4, 8), pt(hem, fl), pt(hem - 1, -fl + 1), pt(4, -8.5), pt(20, -8), pt(31, -6.5), pt(34.5, 0)], true);
  ctx.fillStyle = col.robe;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw;
  ctx.stroke();
  if (f.bare) {
    K.path(ctx, [pt(7, 8.4), pt(-6, 9), pt(-7, -8.5), pt(7, -8.6)], true);
    ctx.fillStyle = col.loin ?? C.white;
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
  if (col.stripe) {
    ctx.beginPath();
    for (const b of [-4.5, -1.5, 1.5, 4.5]) {
      const p0 = pt(30, b * 0.9), p1 = pt(hem + 1, b * 1.5);
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
    }
    ctx.strokeStyle = col.stripe;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  if (col.sash) {
    K.path(ctx, [pt(11, 8.7), pt(5.5, 8.4), pt(5.5, -8.8), pt(11, -8.4)], true);
    ctx.fillStyle = col.sash;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const hN = arm(q.arm, false);
  if (f.staff) {
    const dv = [Math.sin(q.st), Math.cos(q.st)], dn = Math.min(60, -hN[1] / Math.max(0.2, dv[1]));
    K.path(ctx, [[hN[0] - dv[0] * 18, hN[1] - dv[1] * 18], [hN[0] + dv[0] * dn, hN[1] + dv[1] * dn]]);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.strokeStyle = '#a9824f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  const pts = { H, S, HD, hN, hF, pt, ha };
  if (f.mid) f.mid(ctx, pts);
  // head (local frame: +x = face, −y = crown)
  ctx.save();
  ctx.translate(HD[0], HD[1]);
  ctx.rotate(ha * 0.7);
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, TAU);
  ctx.fillStyle = C.skin;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw;
  ctx.stroke();
  const hat = f.hat;
  if (hat === 'band' || hat === 'bun') {
    ctx.beginPath();
    ctx.arc(0, 0, 6.3, Math.PI * 0.75, -Math.PI * 0.2);
    ctx.closePath();
    ctx.fillStyle = C.ink;
    ctx.fill();
  }
  if (f.eye) {
    ctx.beginPath();
    ctx.arc(3, -0.8, 2.3, 0, TAU);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3 + f.eye[0] * 1.1, -0.8 + f.eye[1] * 1.1, 1.05, 0, TAU);
    ctx.fillStyle = C.ink;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(3.3, -0.4, 0.9, 0, TAU);
    ctx.fillStyle = C.ink;
    ctx.fill();
  }
  ctx.rotate(q.hat);
  const fs = (fill, w = lw) => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  if (hat === 'kasa') {
    ctx.beginPath();
    ctx.moveTo(-17, -1);
    ctx.lineTo(1, -12.5);
    ctx.lineTo(17.5, -1);
    ctx.quadraticCurveTo(0, 3.8, -17, -1);
    fs(C.straw);
    sline(ctx, [[-8, 1], [1, -12.5], [8, 1.2]], 0.8);
  } else if (hat === 'ami') {
    ctx.beginPath();
    ctx.moveTo(-16.5, 0.5);
    ctx.bezierCurveTo(-15, -14, 16, -14, 17.5, 0.5);
    ctx.quadraticCurveTo(0, 4.5, -16.5, 0.5);
    fs('#e7d39b');
    ctx.beginPath();
    ctx.moveTo(-11.5, -2);
    ctx.quadraticCurveTo(0, -11, 12, -2);
    ctx.moveTo(-6, -5.2);
    ctx.quadraticCurveTo(0, -8.5, 6.4, -5.2);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else if (hat === 'band') {
    sline(ctx, [[-4, -7.2], [1.5, -8.2]], 3.2);
    sline(ctx, [[-6, -1.6], [6.2, -2.6]], 4.2);
    sline(ctx, [[-6, -1.6], [6.2, -2.6]], 2.2, false, C.white);
  } else if (hat === 'bun') {
    ctx.beginPath();
    ctx.arc(-6.6, -5.6, 3.7, 0, TAU);
    ctx.fillStyle = C.ink;
    ctx.fill();
    sline(ctx, [[-3.5, -8], [-1, -9.4]], 1.6, false, C.yellow);
  } else if (hat === 'cloth') {
    ctx.beginPath();
    ctx.moveTo(-6.7, -0.4);
    ctx.bezierCurveTo(-6.6, -9.6, 6.6, -9.6, 6.9, -2);
    ctx.closePath();
    fs('#cdd6d4', 1.2);
    sline(ctx, [[-6.5, -1], [-10, 1.5]], 1.4);
  }
  ctx.restore();
  if (f.after) f.after(ctx, pts);
  ctx.restore();
  const W = (p) => [f.x + dir * k * p[0], f.y + k * p[1]];
  return { S: W(S), hand: W(hN), handF: W(hF), head: W(HD) };
}

/** packhorse with straw bales and an indigo belly-apron; returns its muzzle (world) */
function horse(ctx, f) {
  const k = f.k ?? 1, s = f.swing ?? 0, hd = f.head ?? 0, lw = 1.6, coat = '#96704e', dark = '#74573d';
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const st = (w = lw) => {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  const leg = (x0, ph, c) => {
    const d = s * ph, p = [[x0, -44], [x0 + 3 + d * 5, -22], [x0 + d * 13, -2.6]];
    K.path(ctx, p);
    st(6 + lw * 2);
    ctx.strokeStyle = c;
    ctx.lineWidth = 6;
    ctx.stroke();
    sline(ctx, [[p[2][0] - 1.5, -1.6], [p[2][0] + 4, -1.6]], 4.6);
    sline(ctx, [[p[2][0] - 1.5, -1.6], [p[2][0] + 4, -1.6]], 2.2, false, C.straw);
  };
  leg(-30, -1, dark);
  leg(26, 1, dark);
  K.ribbon(ctx, K.catmull([[-46, -60], [-56, -44], [-55, -24], [-50, -14]], 5), (u) => 2 + 6 * Math.sin(Math.PI * Math.min(1, u * 1.3)), '#2a211b');
  leg(-36, 1, coat);
  leg(20, -1, coat);
  K.spline(ctx, [[-48, -58], [-34, -69], [-8, -68], [18, -70], [34, -62], [37, -46], [22, -37], [-8, -35], [-34, -38], [-49, -46]], true);
  ctx.fillStyle = coat;
  ctx.fill();
  st();
  // neck and head
  const poll = [K.lerp(50, 58, hd), K.lerp(-97, -62, hd)], ang = K.lerp(0.95, 1.25, hd);
  const dv = [Math.cos(ang), Math.sin(ang)], nv = [-Math.sin(ang), Math.cos(ang)];
  const hp = (a, b) => [poll[0] + dv[0] * a + nv[0] * b, poll[1] + dv[1] * a + nv[1] * b];
  K.spline(ctx, [[14, -68], [poll[0] - 8, poll[1] - 2], hp(2, 6.5), [38, -48], [28, -40]], true);
  ctx.fillStyle = coat;
  ctx.fill();
  st();
  K.ribbon(ctx, K.catmull([[12, -70], [(poll[0] + 4) / 2 + 2, (poll[1] - 70) / 2 - 6], [poll[0] - 7, poll[1] - 4]], 5), 4.6, '#2a211b');
  const et = K.clamp(hd, 0, 1);
  K.path(ctx, [hp(-5, -4), hp(K.lerp(-8, -15, et), K.lerp(-14, -7, et)), hp(0, -6)], true);
  ctx.fillStyle = coat;
  ctx.fill();
  st(1.2);
  K.spline(ctx, [hp(-4, -6), hp(8, -7), hp(24, -4.6), hp(28.5, 0), hp(25, 4.2), hp(10, 6), hp(-3, 6)], true);
  ctx.fillStyle = coat;
  ctx.fill();
  st();
  ctx.beginPath();
  ctx.arc(...hp(7, -2.4), 1.2, 0, TAU);
  ctx.fillStyle = C.ink;
  ctx.fill();
  sline(ctx, [hp(18, -5.5), hp(17, 5.5)], 1.6, false, C.beni); // halter
  // apron, saddle cloth, bales
  K.path(ctx, [[-22, -41], [14, -41], [12, -24], [-20, -24]], true);
  ctx.fillStyle = C.indigo;
  ctx.fill();
  st(1.2);
  ctx.beginPath();
  ctx.arc(-4, -32.5, 4.4, 0, TAU);
  ctx.fillStyle = C.white;
  ctx.fill();
  K.path(ctx, [[-31, -71], [15, -72], [19, -53], [-33, -52]], true);
  ctx.fillStyle = C.beni;
  ctx.fill();
  st(1.2);
  K.roundRect(ctx, -36, -97, 50, 28, 9);
  ctx.fillStyle = C.straw;
  ctx.fill();
  st();
  K.roundRect(ctx, -24, -107, 27, 12, 5);
  ctx.fillStyle = '#cfb169';
  ctx.fill();
  st(1.3);
  ctx.beginPath();
  for (const x of [-25, -11, 3]) {
    ctx.moveTo(x, -96.5);
    ctx.lineTo(x, -69.5);
  }
  ctx.moveTo(-35, -83);
  ctx.lineTo(13, -83);
  st(1);
  ctx.restore();
  const m = hp(28, 2);
  return [f.x + k * m[0], f.y + k * m[1]];
}

/** the kago's hanging seat, slung from the pole at (x, y) */
function basket(ctx, x, y, k, cover, sway) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.rotate(sway);
  const fs = (fill, w = 1.4) => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  sline(ctx, [[-21, 1], [-24, 30]], 1.2);
  sline(ctx, [[21, 1], [24, 30]], 1.2);
  if (cover < 0.5) {
    K.spline(ctx, [[-15, 30], [-13, 16], [-3, 10], [8, 12], [15, 22], [16, 30]], true);
    fs('#7f95a3');
    ctx.beginPath();
    ctx.arc(4, 8, 5.3, 0, TAU);
    fs(C.skin);
    ctx.beginPath();
    ctx.arc(4, 8, 5.5, Math.PI * 0.75, -Math.PI * 0.2);
    ctx.closePath();
    ctx.fillStyle = C.ink;
    ctx.fill();
  }
  K.path(ctx, [[-26, 29], [26, 29], [21, 43], [-21, 43]], true);
  fs('#c9a25c');
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    ctx.moveTo(i * 7, 30);
    ctx.lineTo(i * 5.8, 42);
  }
  ctx.moveTo(-23, 36);
  ctx.lineTo(23, 36);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  if (cover >= 0.5) {
    K.path(ctx, [[-29, 2], [29, 2], [27, 32], [-27, 32]], true);
    fs(C.straw);
    ctx.beginPath();
    for (let j = 1; j < 6; j++) {
      ctx.moveTo(-28.5, 2 + j * 5);
      ctx.lineTo(28.5, 2 + j * 5);
    }
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  K.path(ctx, [[-35, -3], [-29, -9.5], [29, -9.5], [35, -3], [35, 3], [-35, 3]], true);
  fs(C.straw);
  sline(ctx, [[-32, -3.5], [32, -3.5]], 0.8);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- how they move (pure time)
const stepE = (v) => K.smoothstep(0, 0.4, v - Math.floor(v));
const steps = (v) => Math.floor(v) + stepE(v);
/** distance travelled relative to where the figure stands when the rain starts (t = 2) */
function travel(t, walk, run, rate = 4) {
  if (t < 2) return walk * (steps(t * 2 + 40) - 44);
  if (t < 2.5) return 0;
  if (t < 5.5) return run * steps((t - 2.5) * rate);
  const d = run * 3 * rate;
  return t < 6.5 ? d : d + walk * steps((t - 6.5) * 2);
}
/** walk → flinch (2.0) → run or hunch (2.5–5.5) → look at the sky (5.5) → walk on (6.5); poses swap on the beat */
function gaitPose(t, calm, rain, flinch, after, rate = 4) {
  const cyc = (seq, v, first) => {
    const n = Math.floor(v), s = stepE(v);
    return n === 0 && first ? mixPose(first, seq[0], s) : mixPose(seq[(n + 1) & 1], seq[n & 1], s);
  };
  if (t < 2) return cyc(calm, t * 2 + 40);
  if (t < 2.5) return mixPose(calm[1], flinch, K.smoothstep(2, 2.1, t));
  if (t < 5.5) return cyc(rain, (t - 2.5) * rate, flinch);
  if (t < 6.5) return mixPose(rain[1], after, K.smoothstep(5.5, 5.64, t));
  return cyc(calm, (t - 6.5) * 2, after);
}
/** −1 … 1, flipping with every step */
function swingAt(t, rate = 2) {
  const f = (v) => {
    const a = Math.floor(v) & 1 ? 1 : -1;
    return K.lerp(-a, a, stepE(v));
  };
  if (t < 2) return f(t * 2 + 40);
  if (t < 2.5) return 1;
  if (t < 5.5) return f((t - 2.5) * rate);
  return t < 6.5 ? 1 : f((t - 6.5) * 2);
}
const inRain = (t) => t >= 2.5 && t < 5.5;

const COL = {
  mat: { robe: '#7e5a40', stripe: '#553a28', shin: C.indigo, sash: '#3a4a52' },
  pilgrim: { robe: '#ece3cb', shin: '#ece3cb', sash: C.indigo },
  bearer: { robe: C.skin, shin: C.skin, loin: C.white },
  groom: { robe: C.indigo, shin: '#ece3cb', sash: '#b9853f', stripe: '#1c3150' },
  porter: { robe: '#6d8a72', shin: C.indigo, sash: '#8a5a3c' },
  keeper: { robe: '#cf8e79', sash: C.indigo, shin: '#cf8e79', stripe: '#b06d5c' },
  guest: { robe: '#7a8d7a', shin: C.indigo, sash: '#4b3a2e', stripe: '#5b6f5d' },
};

/** the straw mat: five stations from its back end to its front end, each an [outer, inner] pair; pk lifts the front */
function matEdges(pk) {
  const F = (a, b) => [K.lerp(a[0], b[0], pk), K.lerp(a[1], b[1], pk)];
  return [
    [[-31, -9], [-19, -6]], [[-23, -50], [-9, -27]], [[0, -71], [9, -42]],
    [F([31, -73], [33, -79]), F([27, -47], [30, -62])], [F([46, -50], [56, -74]), F([37, -37], [44, -64])],
  ];
}
function drawMat(ctx, pk) {
  const E = matEdges(pk), mix = (f) => K.catmull(E.map(([o, i]) => K.mixPt(o, i, f)), 6);
  const poly = mix(0).concat(mix(1).reverse());
  K.path(ctx, poly, true);
  ctx.fillStyle = C.straw;
  ctx.fill();
  ctx.beginPath();
  for (const f of [0.2, 0.4, 0.6, 0.8]) mix(f).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  for (let j = 1; j < 12; j++) {
    const a = mix(0)[j * 2], b = mix(1)[j * 2];
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.strokeStyle = K.rgba('#5d4526', 0.75);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  K.path(ctx, poly, true);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath(); // fringe at both ends
  for (const [k, sg] of [[0, -1], [4, 1]]) {
    const [o, i] = E[k], [o2, i2] = E[k - sg], dx = (o[0] + i[0] - o2[0] - i2[0]) / 2, dy = (o[1] + i[1] - o2[1] - i2[1]) / 2, m = Math.hypot(dx, dy) || 1;
    for (let j = 0; j <= 6; j++) {
      const p = K.mixPt(o, i, j / 6);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0] + (dx / m) * 3.5, p[1] + (dy / m) * 3.5);
    }
  }
  ctx.lineWidth = 0.9;
  ctx.stroke();
}
function matMan(ctx, t) {
  const x = 118 + (t < 2 ? travel(t, 5, 0) : 0);
  let ps, cover = 0, peek = 0;
  if (t < 2) ps = gaitPose(t, [PO.w0, PO.w1]);
  else if (t < 2.5) ps = mixPose(PO.w1, PO.flinch, K.smoothstep(2, 2.1, t));
  else {
    cover = K.smoothstep(2.5, 2.64, t);
    peek = K.smoothstep(6.5, 6.68, t);
    ps = mixPose(mixPose(PO.flinch, PO.squat, cover), PO.peek, peek);
  }
  const rolled = (c, pt) => {
    const a = pt(31, -11), b = pt(5, -12);
    sline(c, [a, b], 12);
    sline(c, [a, b], 9, false, C.straw);
    c.beginPath();
    c.arc(a[0], a[1], 2.2, 0, TAU);
    c.strokeStyle = C.ink;
    c.lineWidth = 0.8;
    c.stroke();
  };
  const under = cover > 0.5;
  man(ctx, {
    x, y: 972, pose: ps, col: COL.mat, hat: 'cloth',
    back: under ? null : rolled,
    mid: under && peek > 0.5 ? (c) => drawMat(c, peek) : null,
    after: under && peek <= 0.5 ? (c) => drawMat(c, peek) : null,
    eye: peek > 0.5 ? (t < 7.5 ? [0.45, -0.9] : [1, 0.1]) : null,
  });
}
function kago(ctx, t) {
  const cx = 300 + travel(t, 5, 7), y = 962, k = 0.95;
  const front = gaitPose(t, [PO.bw0, PO.bw1], [PO.br0, PO.br1], PO.bflinch, PO.blook);
  const rear = gaitPose(t, [PO.bw1, PO.bw0], [PO.br1, PO.br0], PO.bflinch, PO.blook);
  const a = man(ctx, { x: cx - 62, y, k, pose: rear, col: COL.bearer, hat: 'band', bare: true });
  const b = man(ctx, { x: cx + 62, y, k, pose: front, col: COL.bearer, hat: 'band', bare: true });
  const p0 = [a.S[0] - 15, a.S[1] - 2], p1 = [b.S[0] + 15, b.S[1] - 2];
  sline(ctx, [p0, p1], 5.6);
  sline(ctx, [p0, p1], 3, false, '#b08a56');
  const cover = K.smoothstep(2.5, 2.6, t) * (1 - K.smoothstep(6.0, 6.1, t));
  basket(ctx, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, k, cover, 0.05 * swingAt(t, 4) * (inRain(t) ? 1 : 0.3));
}
function pilgrim(ctx, t) {
  man(ctx, {
    x: 440 + travel(t, 5, 7), y: 978, pose: gaitPose(t, [PO.pw0, PO.pw1], [PO.pr0, PO.pr1], PO.pflinch, PO.plook), col: COL.pilgrim, hat: 'ami', staff: true,
    back: (c, pt) => {
      K.path(c, [pt(30, -8), pt(30, -18), pt(13, -19), pt(13, -8)], true);
      c.fillStyle = '#a9824f';
      c.fill();
      c.strokeStyle = C.ink;
      c.lineWidth = 1.3;
      c.stroke();
    },
  });
}
function horseGroup(ctx, t) {
  const d = travel(t, 4, 3, 2), y = 966, ss = K.smoothstep;
  const hd = t < 2 ? 0 : t < 2.5 ? -0.35 * ss(2, 2.08, t) : t < 5.5 ? K.lerp(-0.35, 1, ss(2.5, 2.7, t)) : t < 6.5 ? K.lerp(1, 0.25, ss(5.5, 5.7, t)) : K.lerp(0.25, 0, ss(6.5, 6.7, t));
  const mz = horse(ctx, { x: 640 + d, y, k: 0.98, swing: swingAt(t, 2), head: hd });
  const g = man(ctx, { x: 748 + d, y: y + 5, pose: gaitPose(t, [PO.gw0, PO.gw1], [PO.gh0, PO.gh1], PO.gflinch, PO.glook, 2), col: COL.groom, hat: 'kasa' });
  ctx.beginPath();
  ctx.moveTo(g.handF[0], g.handF[1]);
  ctx.quadraticCurveTo((g.handF[0] + mz[0]) / 2, Math.max(g.handF[1], mz[1]) + 7, mz[0], mz[1]);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}
function porter(ctx, t) {
  const sw = swingAt(t, 4) * (inRain(t) ? 0.24 : 0.07);
  man(ctx, {
    x: 850 + travel(t, 5, 8), y: 976, pose: gaitPose(t, [PO.bw0, PO.bw1], [PO.qr0, PO.qr1], PO.bflinch, PO.blook), col: COL.porter, hat: 'kasa',
    after: (c, m) => {
      const S = m.S;
      K.spline(c, [[S[0] - 40, S[1] + 1], [S[0], S[1] - 3], [S[0] + 40, S[1] + 1]]);
      c.strokeStyle = C.ink;
      c.lineWidth = 4.8;
      c.stroke();
      c.strokeStyle = '#b08a56';
      c.lineWidth = 2.3;
      c.stroke();
      for (const sx of [-1, 1]) {
        c.save();
        c.translate(S[0] + sx * 37, S[1] + 0.5);
        c.rotate(sw * sx);
        sline(c, [[-8, 17], [0, 0], [8, 17]], 1.1);
        K.roundRect(c, -11, 16, 22, 18, 3);
        c.fillStyle = sx < 0 ? C.indigo : C.straw;
        c.fill();
        c.strokeStyle = C.ink;
        c.lineWidth = 1.4;
        c.stroke();
        if (sx < 0) {
          c.beginPath();
          c.arc(0, 25, 4.2, 0, TAU);
          c.fillStyle = C.white;
          c.fill();
        } else sline(c, [[-10.5, 22], [10.5, 22], [10.5, 28], [-10.5, 28]], 0.8);
        c.restore();
      }
    },
  });
}

// ------------------------------------------------------------------------------------------- the stall's banner and keeper
function banner(ctx, t, tilt, gust) {
  const Lp = 222, y0 = -Lp + 10, hgt = 126, wd = 36;
  ctx.save();
  ctx.translate(728, 774);
  ctx.rotate(tilt);
  sline(ctx, [[0, 0], [0, -Lp]], 4.6);
  sline(ctx, [[0, 0], [0, -Lp]], 2.2, false, '#b08a56');
  sline(ctx, [[2, y0 - 3], [-wd - 3, y0 - 3]], 2.4);
  const fl = (v) => (2.5 + 9 * gust) * v * Math.sin(t * (5 + 7 * gust) - v * 3.4) - 13 * gust * v * v;
  const free = [], fix = [];
  for (let i = 0; i <= 8; i++) {
    const v = i / 8;
    free.push([-wd - 2 + fl(v), y0 + v * hgt]);
    fix.push([-3 + fl(v) * 0.12, y0 + v * hgt]);
  }
  const cloth = fix.concat(free.slice().reverse());
  K.path(ctx, cloth, true);
  ctx.fillStyle = C.white;
  ctx.fill();
  K.path(ctx, [fix[0], fix[1], free[1], free[0]], true);
  ctx.fillStyle = C.verm;
  ctx.fill();
  sline(ctx, cloth, 1.5, true);
  [...'御休處'].forEach((ch, i) => {
    const v = 0.32 + i * 0.25;
    K.text(ctx, ch, (-wd - 5) / 2 + fl(v) * 0.56, y0 + v * hgt, { size: 25, font: K.FONT.cjkSerif, weight: 900, align: 'center', baseline: 'middle', color: C.indigo });
  });
  ctx.restore();
}
function stallLife(ctx, t) {
  const ss = K.smoothstep;
  if (t < 3.5 || t >= 7.0) banner(ctx, t, 0.42 * ss(3.0, 3.1, t) * (1 - ss(7.5, 7.6, t)), K.gate(t, 2.0, 3.0, 0.06, 0.3));
  else { // furled and stood inside, out of the wet
    sline(ctx, [[741, 771], [751, 688]], 4.6);
    sline(ctx, [[741, 771], [751, 688]], 2.2, false, '#b08a56');
    sline(ctx, [[742.6, 758], [750, 698]], 9.5);
    sline(ctx, [[742.6, 758], [750, 698]], 6.5, false, C.white);
    sline(ctx, [[749.3, 704], [750, 698]], 6.5, false, C.verm);
  }
  let ps, x;
  if (t < 2) [ps, x] = [PO.kIdle, 758];
  else if (t < 2.5) [ps, x] = [mixPose(PO.kIdle, PO.flinch, ss(2, 2.1, t)), 758];
  else if (t < 3.0) [ps, x] = [mixPose(PO.flinch, PO.kGrab, ss(2.5, 2.62, t)), K.lerp(758, 746, ss(2.5, 2.62, t))];
  else if (t < 3.5) [ps, x] = [mixPose(PO.kGrab, PO.kPull, ss(3.0, 3.12, t)), K.lerp(746, 756, ss(3.0, 3.12, t))];
  else if (t < 7.0) [ps, x] = [mixPose(PO.kPull, PO.kShel, ss(3.5, 3.62, t)), K.lerp(756, 770, ss(3.5, 3.62, t))];
  else if (t < 7.5) [ps, x] = [mixPose(PO.kShel, PO.kPull, ss(7.0, 7.12, t)), K.lerp(770, 756, ss(7.0, 7.12, t))];
  else [ps, x] = [mixPose(PO.kPull, PO.kIdle, ss(7.5, 7.62, t)), K.lerp(756, 758, ss(7.5, 7.62, t))];
  man(ctx, { x, y: 772, k: 0.86, dir: -1, pose: ps, col: COL.keeper, hat: 'bun', long: true });
}

// ------------------------------------------------------------------------------------------- the print (baked once)
const MT = [[168, 436], [250, 392], [318, 338], [372, 286], [404, 252], [416, 241], [428, 238], [440, 241], [450, 237], [462, 243], [476, 258], [512, 296], [566, 344], [640, 396], [722, 436]];
const ZIG = [[526, 311], [508, 305], [499, 324], [483, 301], [471, 328], [458, 299], [445, 332], [432, 301], [420, 326], [408, 297], [395, 318], [384, 297], [371, 310], [356, 301]];
const SHORE = K.catmull([[-10, 650], [150, 641], [330, 632], [520, 625], [700, 613], [860, 604], [1010, 597]], 8);
const BANK = K.catmull([[-10, 908], [250, 905], [520, 902], [760, 899], [1010, 896]], 6);

function paintSky(cc) {
  cc.fillStyle = lg(cc, 0, 0, 0, 150, C.blue, [[0, 0.98], [0.3, 0.9], [0.58, 0.5], [0.82, 0.16], [1, 0]]);
  cc.fillRect(0, 0, 1000, 150);
  cc.fillStyle = lg(cc, 0, 286, 0, HOR, C.rose, [[0, 0], [0.5, 0.32], [1, 0.82]]);
  cc.fillRect(0, 286, 1000, HOR - 286);
}
function paintMountain(cc, lc) {
  const top = K.catmull(MT, 8), poly = top.concat([[722, 442], [168, 442]]), ink = '#26354a';
  cc.save();
  K.path(cc, poly, true);
  cc.clip();
  cc.fillStyle = lg(cc, 0, 236, 0, HOR, '#567599', [[0, 0.95], [0.5, 0.78], [1, 0.22]]);
  cc.fillRect(100, 200, 700, 300);
  cc.globalCompositeOperation = 'destination-out'; // the snow is bare paper
  K.path(cc, [[330, 200], [545, 200], ...ZIG], true);
  cc.fillStyle = '#000';
  cc.fill();
  cc.restore();
  kline(lc, top.slice(0, 67), 1.8, { smooth: false, taper: [30, 0], seed: 3, color: ink });
  kline(lc, top.slice(64), 1.8, { smooth: false, taper: [0, 30], seed: 4, color: ink });
  kline(lc, ZIG, 1, { smooth: false, seed: 5, color: ink });
  for (const [a, b] of [[[388, 330], [352, 384]], [[430, 345], [424, 398]], [[478, 340], [512, 392]], [[330, 352], [290, 396]], [[540, 350], [590, 400]]]) kline(lc, [a, b], 1.1, { seed: a[0], taper: [6, 14], color: ink });
}
function paintHeadland(cc, lc) {
  const top = K.catmull([[640, 437], [700, 428], [760, 413], [820, 397], [872, 373], [930, 361], [1004, 350]], 8), poly = top.concat([[1004, 442], [640, 442]]);
  tone(cc, poly, null);
  bokashi(cc, poly, 350, HOR, '#5f7b86', [[0, 0.9], [0.5, 0.72], [1, 0.42, '#8fa79c']]);
  for (const [x, s] of [[742, 0.8], [790, 1], [826, 0.9], [868, 1.1], [912, 1], [950, 1.2], [984, 1]]) {
    const y = yAt(top, x);
    sline(lc, [[x, y + 1], [x + 1.5 * s, y - 9 * s]], 1.1, false, '#2b3b45');
    for (const [dx, dy, rx] of [[2, -10, 8], [-3, -6, 6]]) {
      cc.beginPath();
      cc.ellipse(x + dx * s, y + dy * s, rx * s, 2.8 * s, 0, 0, TAU);
      cc.fillStyle = K.rgba('#2a4a47', 0.92);
      cc.fill();
    }
  }
  kline(lc, top, 1.3, { smooth: false, color: '#2b3b45', seed: 8, taper: [20, 0] });
}
function paintSea(cc, lc) {
  const poly = [[-10, HOR], [1010, HOR], ...SHORE.slice().reverse()], r = K.rng(1183);
  tone(cc, poly, null);
  bokashi(cc, poly, HOR, 650, C.blue, [[0, 0.97], [0.1, 0.86, '#2f62a0'], [0.3, 0.7, '#6f9dbd'], [0.62, 0.6, '#a5c4cc'], [1, 0.45, '#c3d6c8']]);
  cc.beginPath();
  for (let i = 0; i < 130; i++) {
    const y = 448 + Math.pow(r(), 0.8) * 170, x = r.range(-20, 1000), len = K.lerp(10, 54, (y - 448) / 170) * r.range(0.6, 1.4);
    if (y > yAt(SHORE, x) - 12) continue;
    cc.moveTo(x, y);
    cc.quadraticCurveTo(x + len / 2, y - 2.2, x + len, y);
  }
  cc.strokeStyle = K.rgba('#2a5c96', 0.6);
  cc.lineWidth = 1.1;
  cc.stroke();
  cc.save(); // surf: lines of bare paper along the strand
  cc.globalCompositeOperation = 'destination-out';
  cc.strokeStyle = '#000';
  for (const [dy, w, dash] of [[7, 2.4, [60, 22, 28, 34]], [16, 1.6, [30, 40, 54, 26]]]) {
    cc.setLineDash(dash);
    cc.lineWidth = w;
    K.path(cc, SHORE.map(([x, y]) => [x, y - dy]));
    cc.stroke();
  }
  cc.restore();
  for (const [x, y, s] of [[236, 432, 1], [296, 433, 0.6], [546, 432, 0.82], [598, 434, 0.5]]) {
    const sail = [[x - 9 * s, y - 42 * s], [x + 11 * s, y - 44 * s], [x + 12 * s, y - 7 * s], [x - 10 * s, y - 6 * s]];
    tone(cc, sail, null);
    sline(lc, sail, 1.1, true);
    for (const u of [0.33, 0.66]) sline(lc, [K.mixPt(sail[0], sail[1], u), K.mixPt(sail[3], sail[2], u)], 0.7);
    K.fillPoly(lc, [[x - 17 * s, y - 5 * s], [x + 19 * s, y - 6 * s], [x + 13 * s, y + 2 * s], [x - 12 * s, y + 2 * s]], '#3b3129');
    sline(lc, [[x + s, y - 44 * s], [x + s, y - 50 * s]], 1);
  }
  broken(lc, SHORE, 1.25, 12, [90, 230], [10, 36], { amp: 0.5 });
}
function paintBirds(lc) {
  for (let i = 0; i < 7; i++) {
    const x = 506 + i * 17, y = 208 - i * 7 + (i % 2) * 3;
    kline(lc, [[x - 6.5, y - 2.5], [x - 1, y], [x + 6, y - 3.5]], 1.6, { seed: i, taper: [3, 3] });
    sline(lc, [[x - 1, y], [x + 2.5, y + 2.4]], 1.3);
  }
}
/** on the strand: two boats drawn up, nets drying on poles, reeds at the water's edge */
function paintStrand(cc, lc) {
  const r = K.rng(5521);
  for (const [x, y, s, fl] of [[322, 668, 1, 1], [420, 655, 0.78, -1]]) {
    const u = (a, b) => [x + a * s * fl, y + b * s];
    const hull = [u(-38, -9), u(32, -10), u(46, -18), u(31, 2), u(-29, 3)];
    tone(cc, hull, K.rgba('#c2a070', 0.85));
    kloop(lc, hull, 1.4, { seed: x });
    sline(lc, [u(-33, -3), u(36, -5)], 0.9);
    sline(lc, [u(2, -9), u(9, -50)], 1.5);
    sline(lc, [u(9, -50), u(-20, -10)], 0.7);
  }
  // net rack
  const P = [[506, 668], [520, 626], [548, 622], [566, 664]];
  const net = [[512, 650], [520, 628], [548, 624], [560, 650], [536, 660]];
  tone(cc, net, K.rgba('#8f9a97', 0.45));
  lc.save();
  K.path(lc, net, true);
  lc.clip();
  lc.beginPath();
  for (let i = -8; i < 14; i++) {
    lc.moveTo(500 + i * 6, 620);
    lc.lineTo(524 + i * 6, 664);
    lc.moveTo(524 + i * 6, 620);
    lc.lineTo(500 + i * 6, 664);
  }
  lc.strokeStyle = K.rgba(C.ink, 0.5);
  lc.lineWidth = 0.6;
  lc.stroke();
  lc.restore();
  sline(lc, net, 1, true);
  sline(lc, [P[0], [522, 620]], 1.5);
  sline(lc, [P[3], [546, 616]], 1.5);
  // reeds
  lc.beginPath();
  for (let i = 0; i < 26; i++) {
    const x = r.range(0, 1000), y = yAt(SHORE, x) + r.range(3, 10);
    for (let j = 0; j < 4; j++) {
      lc.moveTo(x + j * 2, y);
      lc.lineTo(x + j * 2 + r.range(-3, 4), y - r.range(6, 13));
    }
  }
  lc.strokeStyle = K.rgba(C.ink, 0.7);
  lc.lineWidth = 1;
  lc.stroke();
}
function paintGround(cc, lc) {
  const r = K.rng(4177);
  const strand = [...SHORE, [1010, 774], [-10, 774]];
  tone(cc, strand, K.rgba('#e4d49f', 0.5));
  bokashi(cc, strand, 774, 694, C.grass, [[0, 0.92], [0.5, 0.45], [1, 0]]);
  paintStrand(cc, lc);
  tone(cc, rect(-10, 772, 1020, 67), K.rgba('#d5bb97', 0.82));
  bokashi(cc, rect(-10, 772, 1020, 67), 772, 798, '#a48d62', [[0, 0.42], [1, 0]]);
  const bank = [[-10, 838], [1010, 838], ...BANK.slice().reverse()];
  tone(cc, bank, null);
  bokashi(cc, bank, 838, 906, C.grassDk, [[0, 0.95], [0.4, 0.8, '#7fa066'], [1, 0.6, '#b9c688']]);
  const path = [...BANK, [1010, 1010], [-10, 1010]];
  tone(cc, path, K.rgba(C.road, 0.6));
  bokashi(cc, path, 1000, 948, '#33463f', [[0, 0.85], [0.5, 0.35], [1, 0]]);
  // the milestone by the old pine
  const ms = [[190, 775], [190, 734], [197, 726], [204, 734], [204, 775]];
  tone(cc, ms, K.rgba('#9a9c8e', 0.9));
  sline(lc, ms, 1.4);
  for (const y of [740, 748, 756]) sline(lc, [[194, y], [200, y + 1], [197, y + 4]], 0.9);
  // edges of road, bank and path
  const wav = (y, sd) => Array.from({ length: 27 }, (_, i) => [-20 + i * 40, y + (K.noise1(i * 0.7, sd) - 0.5) * 3]);
  broken(lc, wav(772.5, 1), 1.8, 21, [110, 240], [8, 24]);
  broken(lc, wav(838, 2), 2.1, 22, [120, 260], [8, 26]);
  broken(lc, BANK, 1.4, 23, [60, 150], [14, 50]);
  const tuft = (x, y, s, n = 4) => {
    for (let j = 0; j < n; j++) {
      const a = -Math.PI / 2 + (j - (n - 1) / 2) * 0.34 + (r() - 0.5) * 0.2, l = s * r.range(0.7, 1.2), ox = (j - (n - 1) / 2) * 1.6;
      lc.moveTo(x + ox, y);
      lc.lineTo(x + ox + Math.cos(a) * l, y + Math.sin(a) * l);
    }
  };
  lc.beginPath();
  for (let i = 0; i < 46; i++) tuft(r.range(0, 1000), 773 + r.range(-1, 2), r.range(5, 10));
  for (let i = 0; i < 180; i++) {
    const x = r.range(0, 1000);
    tuft(x, r.range(846, yAt(BANK, x) - 2), r.range(4, 8), 3);
  }
  for (let i = 0; i < 26; i++) tuft(r.range(0, 1000), r.range(930, 996), r.range(5, 9));
  lc.strokeStyle = K.rgba(C.ink, 0.8);
  lc.lineWidth = 1.05;
  lc.stroke();
  lc.beginPath();
  for (let i = 0; i < 64; i++) {
    const x = r.range(0, 1000), y = i >= 34 ? r.range(918, 992) : r.range(780, 832), l = r.range(4, 13);
    lc.moveTo(x, y);
    lc.lineTo(x + l, y + r.range(-0.6, 0.6));
  }
  lc.strokeStyle = K.rgba(C.ink, 0.45);
  lc.lineWidth = 1;
  lc.stroke();
  // signature and seal of an invented studio
  K.vtext(lc, '鵜齋畫', 976, 852, { size: 16, gap: 18, font: K.FONT.cjkSerif, weight: 700, color: C.ink });
  K.put(lc, K.seal('鵜', { size: 15, relief: 'bai', color: '#b8301f', seed: 7 }), 967, 899);
}
function pad(cc, lc, cx, cy, w, h, seed) {
  const r = K.rng(seed), lobes = Math.max(2, Math.round(w / 50)), N = lobes * 12, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, env = Math.pow(Math.sin(Math.PI * K.lerp(0.05, 0.95, u)), 0.5), lob = Math.pow(Math.abs(Math.sin(Math.PI * lobes * u)), 0.55);
    top.push([cx - w / 2 + u * w, cy - h * env * (0.5 + 0.5 * lob) * (0.82 + 0.36 * K.noise1(u * lobes * 0.9, seed))]);
  }
  for (let i = 0; i <= 8; i++) {
    const u = 1 - i / 8;
    bot.push([cx - w / 2 + u * w, cy + h * 0.13 * Math.sin(Math.PI * u) + (r() - 0.5) * 3]);
  }
  const poly = top.concat(bot);
  tone(lc, poly, null);
  tone(cc, poly, K.rgba(C.pine, 0.96));
  bokashi(cc, poly, cy + h * 0.15, cy - h * 0.8, C.pineDk, [[0, 0.95], [0.5, 0.5], [1, 0]]);
  lc.beginPath();
  for (let i = 0; i <= N; i++) { // needles bristle along the top of each pad
    const p = top[i], k = Math.min(lobes - 1, Math.floor((i / N) * lobes)), lx = cx - w / 2 + ((k + 0.5) * w) / lobes;
    for (let j = 0; j < 2; j++) {
      const a = Math.atan2(p[1] - (cy + h * 0.35), p[0] - lx) + (r() - 0.5) * 0.5, l = r.range(4.5, 9), ox = (r() - 0.5) * 3;
      lc.moveTo(p[0] + ox - Math.cos(a) * 4, p[1] - Math.sin(a) * 4);
      lc.lineTo(p[0] + ox + Math.cos(a) * l, p[1] + Math.sin(a) * l);
    }
  }
  for (let i = 0, n = Math.round((w * h) / 230); i < n; i++) { // … and in little fans inside it
    const u = r.range(0.06, 0.94), x = cx - w / 2 + u * w, y = K.lerp(top[Math.round(u * N)][1] + 9, cy + 2, r());
    for (let j = 0; j < 5; j++) {
      const a = -Math.PI / 2 + (j - 2) * 0.36 + (r() - 0.5) * 0.15, l = r.range(5.5, 8);
      lc.moveTo(x, y);
      lc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
  }
  lc.strokeStyle = K.rgba('#10201e', 0.92);
  lc.lineWidth = 1.05;
  lc.stroke();
  kline(lc, bot, 1.3, { smooth: false, seed, taper: [10, 10] });
}
function pine(cc, lc, limbs, pads, seed) {
  const r = K.rng(seed);
  limbs.forEach(([pts, w0, w1], i) => {
    const P = K.resample(K.catmull(pts, 8), 5), n = P.length;
    const poly = K.ribbonPoly(P, (u) => K.lerp(w0, w1, Math.pow(u, 0.8)) * (0.88 + 0.24 * K.noise1(u * 7, seed + i)));
    tone(lc, poly, null);
    tone(cc, poly, K.rgba(C.trunk, 0.95));
    if (i === 0) bokashi(cc, poly, 778, 560, C.trunkDk, [[0, 0.9], [1, 0]]);
    const w = i ? 1.5 : 2.1;
    kline(lc, poly.slice(0, n), w, { smooth: false, seed: seed * 3 + i, taper: [0, 8] });
    kline(lc, poly.slice(n).reverse(), w, { smooth: false, seed: seed * 5 + i, taper: [0, 8] });
    if (w0 < 10) return;
    for (let s = 0.03; s < 0.9; s += r.range(0.025, 0.05)) { // bark: short curved cuts
      const k = Math.min(n - 2, Math.round(s * (n - 1))), c = P[k], tx = P[k + 1][0] - c[0], ty = P[k + 1][1] - c[1], m = Math.hypot(tx, ty) || 1;
      const nx = -ty / m, ny = tx / m, wd = K.lerp(w0, w1, Math.pow(s, 0.8)), o1 = r.range(-0.42, 0.08) * wd, o2 = o1 + 0.36 * wd, om = (o1 + o2) / 2, b = r.range(3, 5);
      kline(lc, [[c[0] + nx * o1, c[1] + ny * o1], [c[0] + nx * om + (tx / m) * b, c[1] + ny * om + (ty / m) * b], [c[0] + nx * o2, c[1] + ny * o2]], 1.2, { seed: k, taper: [3, 3] });
    }
  });
  pads.forEach(([cx, cy, w, h], i) => pad(cc, lc, cx, cy, w, h, seed * 17 + i));
}
function paintPines(cc, lc) {
  pine(cc, lc, [
    [[[612, 778], [604, 716], [618, 650], [600, 584], [578, 524], [574, 474]], 15, 5],
  ], [[560, 470, 132, 40]], 97);
  pine(cc, lc, [
    [[[664, 778], [676, 710], [660, 640], [636, 570], [644, 500], [668, 440], [660, 380], [640, 342]], 22, 6],
    [[[650, 520], [690, 470], [706, 428]], 7, 4],
  ], [[700, 424, 140, 42], [636, 334, 164, 46]], 83);
  pine(cc, lc, [
    [[[118, 778], [128, 700], [108, 620], [84, 540], [104, 462], [150, 400], [158, 330], [132, 262], [140, 214]], 34, 6],
    [[[98, 482], [64, 452], [30, 438]], 9, 5],
    [[[146, 412], [196, 398], [246, 406]], 8, 4],
    [[[156, 338], [112, 320], [70, 318]], 7, 4],
    [[[136, 272], [186, 262], [226, 266]], 6, 3],
  ], [[40, 434, 150, 46], [250, 404, 170, 50], [72, 318, 150, 44], [226, 266, 150, 44], [134, 206, 172, 50]], 71);
}
function paintStall(cc, lc) {
  const r = K.rng(8831);
  const both = (pts, fill) => {
    tone(lc, pts, null);
    tone(cc, pts, fill);
  };
  const roof = [[716, 680], [778, 592], [924, 592], [988, 680], [852, 685]];
  both(rect(742, 660, 232, 113), null);
  both(rect(746, 682, 114, 72), K.rgba('#36424f', 0.92)); // the open bay, in shadow
  both(rect(866, 682, 104, 72), K.rgba('#e2d3a8', 0.8)); // the plastered bay
  both(rect(884, 706, 64, 30), K.rgba('#3c4753', 0.9));
  both(rect(738, 752, 236, 21), K.rgba(C.wood, 0.9));
  for (const x of [738, 858, 966]) both(rect(x, 682, 8, 71), K.rgba('#7b5535', 0.95));
  for (let i = 0; i < 4; i++) { // the noren
    const p = rect(748 + i * 27.5, 684, 25.5, 25 + (i % 2) * 3);
    both(p, K.rgba(C.indigo, 0.95));
    tone(cc, ring(760.7 + i * 27.5, 697, 5, 5, 14), null);
    sline(lc, p, 1.1, true);
  }
  both(roof, K.rgba(C.thatch, 0.95));
  bokashi(cc, roof, 686, 628, '#6f512c', [[0, 0.75], [1, 0]]);
  both(rect(770, 582, 162, 13), K.rgba('#66503a', 0.95));
  both(rect(786, 745, 68, 14), K.rgba(C.verm, 0.92)); // bench with a red felt
  // key block
  sline(lc, rect(866, 682, 104, 70), 1.3, true);
  sline(lc, rect(884, 706, 64, 30), 1.3, true);
  for (let x = 892; x < 946; x += 8) sline(lc, [[x, 706], [x, 736]], 1);
  for (const x of [738, 858, 966]) sline(lc, rect(x, 682, 8, 70), 1.3, true);
  sline(lc, rect(738, 752, 236, 21), 1.5, true);
  for (const x of [790, 846, 902, 944]) sline(lc, [[x, 752], [x, 773]], 0.9);
  sline(lc, rect(786, 745, 68, 14), 1.4, true);
  sline(lc, [[792, 759], [790, 772]], 2);
  sline(lc, [[848, 759], [850, 772]], 2);
  for (const [x, y] of [[874, 693], [958, 695]]) { // straw sandals for sale, hung from the eave
    sline(lc, [[x, 684], [x, y - 5]], 0.9);
    for (const dx of [-3.5, 3.5]) {
      both(ring(x + dx, y + 2, 3.2, 7, 12), K.rgba(C.straw, 0.95));
      sline(lc, ring(x + dx, y + 2, 3.2, 7, 12), 1, true);
    }
  }
  lc.beginPath(); // thatch
  for (let i = 0; i <= 44; i++) {
    const u = i / 44, xt = K.lerp(780, 922, u), xb = K.lerp(720, 984, u);
    let v = r.range(0, 0.2);
    while (v < 0.98) {
      const v2 = Math.min(1, v + r.range(0.12, 0.4));
      lc.moveTo(K.lerp(xt, xb, v), K.lerp(597, 681, v));
      lc.lineTo(K.lerp(xt, xb, v2), K.lerp(597, 681, v2));
      v = v2 + r.range(0.04, 0.16);
    }
  }
  for (let x = 720; x < 986; x += 4.5) {
    const y = 680 + 5 * Math.sin((Math.PI * (x - 716)) / 272);
    lc.moveTo(x, y);
    lc.lineTo(x + r.range(-1.5, 1.5), y + r.range(3.5, 7));
  }
  lc.strokeStyle = K.rgba(C.ink, 0.62);
  lc.lineWidth = 0.95;
  lc.stroke();
  kline(lc, [[716, 680], [778, 592]], 2.2, { seed: 31, taper: [0, 4] });
  kline(lc, [[924, 592], [988, 680]], 2.2, { seed: 32, taper: [4, 0] });
  kline(lc, [[716, 680], [852, 685], [988, 680]], 2.5, { seed: 33 });
  sline(lc, rect(770, 582, 162, 13), 1.5, true);
  lc.beginPath();
  for (let x = 780; x < 928; x += 18) {
    lc.moveTo(x, 583);
    lc.lineTo(x + 7, 594);
    lc.moveTo(x + 7, 583);
    lc.lineTo(x, 594);
  }
  lc.strokeStyle = C.ink;
  lc.lineWidth = 1.1;
  lc.stroke();
  // a guest on the bench, who stays dry and says nothing
  man(lc, { x: 826, y: 771, k: 0.84, dir: -1, pose: PO.sit, col: COL.guest, hat: 'band' });
}
function buildBase() {
  const col = K.layer(1000, 1000, RES), cc = col.getContext('2d');
  const lin = K.layer(1000, 1000, RES), lc = lin.getContext('2d');
  for (const c of [cc, lc]) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
  }
  paintSky(cc);
  paintMountain(cc, lc);
  paintHeadland(cc, lc);
  paintSea(cc, lc);
  paintBirds(lc);
  paintGround(cc, lc);
  paintPines(cc, lc);
  paintStall(cc, lc);
  // the blocks print unevenly: wood grain, baren streaks, starved specks
  cc.save();
  cc.globalCompositeOperation = 'destination-out';
  cc.globalAlpha = 0.32;
  cc.drawImage(L.grain, 0, 0, 1000, 1000);
  cc.globalAlpha = 1;
  cc.drawImage(K.noiseLayer({ res: 0.4, scale: 70, seed: 31, lo: 0.52, hi: 0.9, alpha: 0.2, stretch: [1, 3.5] }), 0, 0, 1000, 1000);
  cc.restore();
  K.grain(cc, 0, 0, 1000, 1000, { alpha: 0.1, seed: 5, size: 1.3, mode: 'destination-out' });
  K.grain(lc, 0, 0, 1000, 1000, { alpha: 0.14, seed: 6, size: 1.3, density: 0.5, mode: 'destination-out' });
  const paper = K.paper({ res: 1, base: C.paper, seed: 11, mottle: 0.4, fiber: 0.5, speck: 0.5, stains: 0.2, edge: 0.15 });
  return K.layer(1000, 1000, RES, (ctx) => {
    K.put(ctx, paper);
    K.putBlend(ctx, col, 'multiply', 1, 1.5, 1.1); // a hair out of register with the key block
    K.put(ctx, lin);
  });
}
/** sumi bokashi for the shower: the top of the sky goes dark, the whole sheet a little grey */
function buildVeil() {
  return K.layer(1000, 1000, 0.5, (ctx) => {
    ctx.fillStyle = K.rgba('#77808a', 0.2);
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.fillStyle = lg(ctx, 0, 0, 0, 400, '#1d2027', [[0, 0.88], [0.25, 0.74], [0.55, 0.38], [0.82, 0.12], [1, 0]]);
    ctx.fillRect(0, 0, 1000, 400);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 0.22;
    ctx.drawImage(L.grain, 0, 0, 1000, 1000);
  });
}
const CART = { x: 722, y: 32, w: 236, h: 246 };
function buildCart(title) {
  return K.layer(CART.w, CART.h, 1.6, (ctx) => {
    ctx.translate(-CART.x, -CART.y);
    // vermilion title block, characters reserved in the paper
    ctx.fillStyle = C.verm;
    ctx.fillRect(868, 40, 82, 228);
    sline(ctx, rect(873, 45, 72, 218), 1.2, true, C.white);
    K.vtext(ctx, title.zh, 909, 85, { size: 60, gap: 70, font: K.FONT.cjkSerif, weight: 900, color: C.white });
    // series cartouche
    ctx.fillStyle = '#ecd590';
    ctx.fillRect(730, 40, 128, 106);
    sline(ctx, rect(731, 41, 126, 104), 2.2, true);
    sline(ctx, rect(736, 46, 116, 94), 0.9, true);
    K.text(ctx, title.en, 794, 94, { size: 32, font: K.FONT.serif, weight: 700, align: 'center', color: C.ink, maxWidth: 106 });
    sline(ctx, [[762, 104], [826, 104]], 0.9);
    K.text(ctx, title.date, 794, 130, { size: 25, font: K.FONT.serif, weight: 400, align: 'center', color: C.ink });
    // invented publisher's seal and a round "inspected" seal
    K.put(ctx, K.seal('鵜鶘堂', { size: 62, relief: 'zhu', cols: 1, color: '#b8301f', seed: 3 }), 826, 156);
    ctx.beginPath();
    ctx.arc(796, 176, 14, 0, TAU);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    K.text(ctx, '輪', 796, 177, { size: 17, font: K.FONT.cjkSerif, weight: 700, align: 'center', baseline: 'middle', color: C.ink });
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.16;
    ctx.drawImage(L.grain, 0, 0, 1000, 1000);
  });
}
/** one sheet over everything: grain and specks where pigment did not take, foxing, fibres, toned edges */
function buildOver() {
  return K.layer(1000, 1000, RES, (ctx) => {
    ctx.globalAlpha = 0.07;
    ctx.drawImage(L.grain, 0, 0, 1000, 1000);
    ctx.globalAlpha = 1;
    K.grain(ctx, 0, 0, 1000, 1000, { color: C.paper, alpha: 0.1, seed: 21, size: 1.1, density: 0.5 });
    ctx.drawImage(K.noiseLayer({ res: 0.3, scale: 240, seed: 44, color: '#7a5f3a', lo: 0.45, hi: 0.85, alpha: 0.13 }), 0, 0, 1000, 1000);
    K.fibers(ctx, 1000, 1000, { n: 500, seed: 9, color: '#6a5330', alpha: 0.1, len: [10, 46], width: 0.6 });
    K.fibers(ctx, 1000, 1000, { n: 300, seed: 10, color: '#fff6e0', alpha: 0.14, len: [12, 60], width: 0.7 });
    K.vignette(ctx, 1000, 1000, 0.16, '#5a4120', 0.62);
  });
}

// ------------------------------------------------------------------------------------------- the shower
const RAIN_DIR = [[-0.21, 0.978], [-0.33, 0.944]]; // two sets, ≈ 12° and 19° off the vertical
const RAIN = (() => {
  const r = K.rng(1107), out = [];
  for (let i = 0; i < 340; i++) {
    const set = i % 2;
    out.push({ set, x: r.range(-30, set ? 1370 : 1240), len: r.range(380, 1250), ph: r(), v: r.range(2300, 3000), g: r.int(0, 2), off: r() });
  }
  return out;
})();
const RAIN_STYLE = [[1.3, 0.82], [1.05, 0.62], [0.95, 0.42]];
function drawRain(ctx, t) {
  if (t < 2 || t > 5.95) return;
  const front = (t - 2) * 9000; // the first drops race down the sheet on the downbeat
  ctx.save();
  ctx.lineCap = 'butt';
  for (let g = 0; g < 3; g++) {
    ctx.beginPath();
    for (const q of RAIN) {
      if (q.g !== g) continue;
      const d = RAIN_DIR[q.set], span = 1000 / d[1] + 20, per = span + q.len + 160;
      const head = (t * q.v + q.ph * per) % per;
      const s1 = Math.min(head, span, front), s0 = Math.max(head - q.len, 0, (t - (4.2 + q.off * 1.2)) * q.v);
      if (s1 - s0 < 8) continue;
      ctx.moveTo(q.x + d[0] * s0, d[1] * s0);
      ctx.lineTo(q.x + d[0] * s1, d[1] * s1);
    }
    ctx.strokeStyle = K.rgba('#15171a', RAIN_STYLE[g][1]);
    ctx.lineWidth = RAIN_STYLE[g][0];
    ctx.stroke();
  }
  ctx.restore();
}
const veilAt = (t) => Math.max(0.22 * K.smoothstep(1.2, 1.95, t), K.smoothstep(1.98, 2.06, t)) * (1 - K.smoothstep(4.6, 5.8, t));

// ------------------------------------------------------------------------------------------- the pelican
const FILL = { frame: C.beni, saddle: C.indigo, leg: '#e2a43a', foot: '#e2a43a', body: C.white, wing: C.white, tail: '#d3d8cf', neck: C.white, head: C.white, scarf: C.indigo, pouch: '#efc57c', beak: C.yellow, metal: '#6b5540' };
function cartWheel(ctx, p, lw, s, seed) {
  const [cx, cy] = p.c, r = p.r, ri = r * 0.8, wood = '#c99c5e';
  ctx.beginPath();
  ctx.arc(cx, cy, r - lw * 0.4, 0, TAU);
  ctx.arc(cx, cy, ri, 0, TAU, true);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.beginPath();
  for (const [a, b] of Rig.spokes(p, 8, 0.16, 0.82)) {
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.lineCap = 'butt';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 4 * s + lw * 1.2;
  ctx.stroke();
  ctx.strokeStyle = wood;
  ctx.lineWidth = 4 * s;
  ctx.stroke();
  ctx.lineCap = 'round';
  kloop(ctx, ring(cx, cy, r - lw * 0.55, r - lw * 0.55, 48, p.a), lw * 1.15, { seed, n: 5, amp: 0.3 });
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, TAU);
  for (let k = 0; k < 4; k++) { // joints of the felloes
    const a = p.a + (k * TAU) / 4 + 0.39;
    ctx.moveTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri);
    ctx.lineTo(cx + Math.cos(a) * (r - lw), cy + Math.sin(a) * (r - lw));
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw * 0.65;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.2, 0, TAU);
  ctx.fillStyle = '#a97d49';
  ctx.fill();
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.065, 0, TAU);
  ctx.fillStyle = C.ink;
  ctx.fill();
}
const hatTilt = (t) => -0.1 + 0.44 * K.ease.outBack(K.clamp((t - 2.0) / 0.25)) * (1 - K.smoothstep(5.1, 5.5, t));
function drawPelican(ctx, pose, t) {
  const s = pose.s, lw = 2.8 * s, G = pose.G.head, H0 = Rig.GEO.head, mis = [1.3 * s, 1.0 * s];
  const hx = (x, y) => [G[0] * x + G[2] * y + G[4], G[1] * x + G[3] * y + G[5]];
  const bounds = (pts) => pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  let seed = 100;
  for (const p of Rig.parts(pose)) {
    seed += 7;
    if (p.name.startsWith('crest')) continue; // under the hat
    if (p.kind === 'poly') {
      let fill = FILL[p.role] ?? C.white;
      if (p.far) fill = K.shade(fill, -0.14);
      if (p.role === 'beak') { // yellow with a bokashi blush toward the tip
        const a = pose.pt.beakBase, b = pose.pt.beakTip;
        fill = K.linGrad(ctx, a[0], a[1], b[0], b[1], [[0, C.yellow], [0.4, C.yellow], [1, C.orange]]);
      } else if (p.name === 'wing') {
        const b = bounds(p.pts);
        fill = K.linGrad(ctx, b[2], b[1], b[0], b[3], [[0, C.white], [0.5, C.white], [1, '#97abb6']]);
      } else if (p.name === 'pouch') {
        const b = bounds(p.pts);
        fill = K.linGrad(ctx, 0, b[1], 0, b[3], [[0, '#f2d28a'], [0.45, '#efc57c'], [1, '#e6935a']]);
      }
      K.path(ctx, p.pts, true);
      ctx.fillStyle = C.white; // paper first, then the colour block a hair out of register
      ctx.fill();
      if (fill !== C.white) {
        ctx.save();
        ctx.translate(mis[0], mis[1]);
        K.path(ctx, p.pts, true);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();
      }
      kloop(ctx, p.pts, p.role === 'metal' ? lw * 0.7 : lw, { seed, n: 6 });
      if (p.name === 'pouch') { // a few ribs
        const q = p.pts, n = q.length;
        ctx.beginPath();
        for (const [a, b] of [[0.12, 0.78], [0.2, 0.62]]) {
          ctx.moveTo(q[Math.round(a * n)][0], q[Math.round(a * n)][1]);
          ctx.lineTo(q[Math.round(b * n) % n][0], q[Math.round(b * n) % n][1]);
        }
        ctx.strokeStyle = K.rgba(C.ink, 0.7);
        ctx.lineWidth = lw * 0.4;
        ctx.stroke();
      }
    } else if (p.kind === 'line') {
      if (p.role === 'mark') {
        kline(ctx, p.pts, lw * (p.name === 'beakLine' ? 0.6 : 0.75), { seed, smooth: false, taper: [4, 6], n: 3 });
        continue;
      }
      if (p.name.startsWith('chain')) {
        sline(ctx, p.pts, lw * 0.5);
        continue;
      }
      let col = FILL[p.role] ?? C.white;
      if (p.far) col = K.shade(col, -0.14);
      K.path(ctx, p.pts);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = p.w + lw * 1.5;
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = p.w;
      ctx.stroke();
    } else if (p.kind === 'wheel') cartWheel(ctx, p, lw, s, seed);
    else if (p.kind === 'disc') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r, 0, TAU);
      ctx.fillStyle = p.name === 'chainring' ? '#b98c55' : C.ink;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
    } else if (p.kind === 'eye') {
      const [ex, ey] = p.c, R = p.r * 1.08;
      ctx.beginPath();
      ctx.arc(ex, ey, R, 0, TAU);
      ctx.fillStyle = C.white;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.arc(p.pupil[0], p.pupil[1], p.pr * 1.1, 0, TAU);
      ctx.fillStyle = C.ink;
      ctx.fill();
      if (p.lid > 0.04) {
        const yl = ey - R + 2 * R * Math.min(1, p.lid);
        ctx.fillStyle = C.white;
        ctx.fillRect(ex - R - 1, ey - R - 1, 2 * R + 2, yl - (ey - R - 1));
        sline(ctx, [[ex - R, yl], [ex + R, yl]], lw * 0.6);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(ex, ey, R, 0, TAU);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
    }
  }
  // the traveller's sedge hat: tipped back in fair weather, forward into the rain
  const a = hatTilt(t), ca = Math.cos(a), sa = Math.sin(a), ox = H0[0] - 2, oy = H0[1] - 15;
  const hp = (x, y) => hx(ox + x * ca - y * sa, oy + x * sa + y * ca);
  K.spline(ctx, [hp(-13, 4), hx(H0[0] - 9, H0[1] + 8), hx(H0[0] + 1, H0[1] + 17.5), hx(H0[0] + 10, H0[1] + 9), hp(13, 4)]);
  ctx.strokeStyle = C.beni;
  ctx.lineWidth = 1.7 * s;
  ctx.stroke();
  const hat = [hp(-38, 2.5), hp(-2.5, -21), hp(2.5, -21), hp(40, 2.5), hp(20, 4.6), hp(0, 5.2), hp(-20, 4.6)];
  K.path(ctx, hat, true);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.save();
  ctx.translate(mis[0], mis[1]);
  K.path(ctx, hat, true);
  ctx.fillStyle = C.straw;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  for (const u of [-0.74, -0.42, -0.1, 0.24, 0.56, 0.84]) {
    const p0 = hp(0, -20.5), p1 = hp(u * 38, 2.5 + 2.6 * (1 - u * u));
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
  }
  for (const f of [0.42, 0.72]) {
    const p0 = hp(-38 * f, K.lerp(-21, 2.5, f)), pm = hp(0, K.lerp(-21, 5.2, f)), p1 = hp(40 * f, K.lerp(-21, 2.5, f));
    ctx.moveTo(p0[0], p0[1]);
    ctx.quadraticCurveTo(2 * pm[0] - (p0[0] + p1[0]) / 2, 2 * pm[1] - (p0[1] + p1[1]) / 2, p1[0], p1[1]);
  }
  ctx.strokeStyle = K.rgba(C.ink, 0.75);
  ctx.lineWidth = lw * 0.36;
  ctx.stroke();
  kloop(ctx, hat, lw * 0.95, { seed: 991, n: 6 });
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the scene
export default {
  id: 11, key: 'ukiyo', title: TITLES[11], heroT: 3.0,

  act(t, p) {
    const g = K.gate(t, 0.5, 5.5, 0.3);
    const up = K.gate(t, 1.35, 2.05, 0.2, 0.08); // a glance at the darkening sky
    const wet = K.gate(t, 2.0, 5.45, 0.12, 0.45); // head down, beak forward, into the rain
    p.eye = [0.25 * g * (1 - up) + 0.45 * wet, -0.9 * up];
    p.headTilt = 0.2 * up - 0.09 * wet;
    p.neck = 0.35 * up - 0.5 * wet;
    p.lean = 0.05 * wet;
    if (wet > 0.3) p.lid = 0.36 * wet;
    p.wind = 1 + 0.4 * wet;
  },

  async init() {
    L = {};
    L.grain = woodGrain(1830, C.paper);
    L.base = buildBase();
    L.veil = buildVeil();
    L.cart = buildCart(TITLES[11]);
    L.over = buildOver();
  },

  render(ctx, t, env) {
    K.put(ctx, L.base);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    stallLife(ctx, t);
    if (env.pose) drawPelican(ctx, env.pose, t);
    matMan(ctx, t);
    kago(ctx, t);
    horseGroup(ctx, t);
    pilgrim(ctx, t);
    porter(ctx, t);
    ctx.restore();
    const v = veilAt(t);
    if (v > 0.004) K.putBlend(ctx, L.veil, 'multiply', v);
    drawRain(ctx, t);
    K.put(ctx, L.cart, CART.x, CART.y);
    K.put(ctx, L.over);
  },
};
