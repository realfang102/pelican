// Section 2 — Egyptian Wall Painting (c. 1300 BCE, a New Kingdom Theban tomb chapel: Nebamun, Nakht, Menna)
// Tempera on gypsum plaster. Upper register: a noble couple before an offering table, a cartouche that spells
// p-l-k-n t-s-t (+ a pelican-on-bicycle determinative) and three offering bearers. The main register is still in
// the draughtsman's red underdrawing on its canon grid — a fan-bearer, an adorer, and between them the reserved
// outline of a pelican on a bicycle. The pelican rides in, strikes exactly that pose and freezes on it (bar 2,
// beat 2): the grid lights up, it fits the squares, and the people above are already facing it with arms raised.
// Then it rides on as if nothing had happened; the last bearer has turned his head to look after it.
//
// Technique: flat mineral colours are Canvas 2D fills; every contour is a p5.brush reed-pen line baked on white
// and multiplied over the paint. A raster "hidden-line" mask (each later fill erases the contours it covers) keeps
// the outlines in painter's order. Paint and lines are then weathered by a flake mask anchored to the wall; cracks
// and plaster losses (mud-and-straw underlayer) lie over everything, the pelican included. The changing figures are
// baked in their own rows of a sprite sheet and stamped onto the wall once per state, so a state change is one blit.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const C = {
  white: '#f3ecda', black: '#1e1a16', ink: '#1c1611', red: '#a9442a', line: '#5a2212', sketch: '#b65a40',
  skinM: '#a74c2c', skinF: '#dcab50', yellow: '#d9a53d', band: '#dcaa46', gold: '#dba935', goldDk: '#b18526',
  blue: '#2d6c97', deep: '#1f4a69', water: '#6fa2b9', green: '#4f8c61', orange: '#c8772c', mud: '#8d7250',
  leg: '#dd9230', legFar: '#b9772a', beak: '#e6b648', pouch: '#d98838', field: '#f2e8cd', glyph: '#22405a',
};
const ROAD = K.ROAD_Y; // 800
const REG_Y = 452; // ground line of the upper register
const STRIP_Y = 135, STRIP_H = 330; // the strip of wall that exists in three states (all multiples of 5 → whole pixels at res 1.2)
const G_UP = 15, G_NOB = 17.5, G_LANE = 20; // canon-grid modules: bearers, the (larger) noble couple, the pelican
const RES = 1.2;
const T_POSE = 2.15, T_ON = 2.5, T_OFF = 3.5, T_LOOK = 5.5; // ease into the pose · freeze · release · the head turns
const SEC_T0 = 5 + 6 * (2 - 1); // film time at which this section starts
const ARM_TO = [72, -210]; // rig-local target of the raised wing (kept just below the shoulder so the elbow never flips)
const SPOKE_PHI = -Math.PI / 2 - (K.sectionX(2) - K.FRAME + K.PITCH * 0.5) / Rig.GEO.WR; // one spoke is plumb while frozen
let L = null;

// ------------------------------------------------------------------------------------------------ acting
const poseK = (t) => K.smoothstep(T_POSE, T_ON, t) * (1 - K.smoothstep(T_OFF, T_OFF + 0.35, t));
function applyAct(t, p) {
  const k = poseK(t);
  if (k > 0) {
    p.neck = k; // neck erect
    p.headTilt = 0.2 * k; // beak level
    p.head = [0, -5.34 * k]; // crown on the 16th grid line
    p.bob = 1 - k;
    p.wind = Math.max(p.wind ?? 0, 0.95 * k); // the streamers stay caught in mid-air, as painted ones do
    p.armTo = [K.lerp(Rig.GEO.grip[0], ARM_TO[0], k), K.lerp(Rig.GEO.grip[1], ARM_TO[1], k)];
  }
  // painted figures do not flutter: the rig's clock stops for the hold and catches up while it rides away
  const hold = T_OFF - T_ON;
  p.t -= t <= T_ON ? 0 : t < T_OFF ? t - T_ON : hold * (1 - K.smoothstep(T_OFF, 5.3, t));
}
/** the frozen pose, solved exactly as the film solves it (used for the underdrawing) */
function freezePose() {
  const u = 0.5, wx = K.sectionX(2) - K.FRAME + K.PITCH * u;
  const p = { x: wx - K.sectionX(2), y: ROAD, s: 1, rot: 0, crank: K.TAU * 6 * (1 + u) + 0.9, wheel: wx / Rig.GEO.WR, t: SEC_T0 + 3, wind: 0 };
  applyAct(3, p);
  return Rig.solve(p);
}

// ------------------------------------------------------------------------------------------------ the pelican, Egyptian canon
function paintPelican(ctx, pose, o = {}) {
  const s = pose.s, lw = o.lw ?? 2.2 * s, simple = !!o.simple, kHand = o.k ?? 0, S = pose.shapes;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const stroke = (pts, col, w) => {
    K.path(ctx, pts);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  const poly = (pts, col, line = C.line, w = lw) => {
    K.path(ctx, pts, true);
    ctx.fillStyle = col;
    ctx.fill();
    if (line) {
      ctx.strokeStyle = line;
      ctx.lineWidth = w;
      ctx.stroke();
    }
  };
  const tube = (pts, w, col, line = C.line, ow = lw) => {
    stroke(pts, line, w + ow * 1.7);
    stroke(pts, col, w);
  };
  const disc = (c, r, col, line = C.black, w = lw * 0.7) => {
    K.circle(ctx, c[0], c[1], r);
    ctx.fillStyle = col;
    ctx.fill();
    if (line) {
      ctx.strokeStyle = line;
      ctx.lineWidth = w;
      ctx.stroke();
    }
  };
  const ring = (c, r, w, col) => {
    K.circle(ctx, c[0], c[1], r);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  // six-spoked chariot wheel: black tyre, gilded felloe, gilded spokes
  const wheel = (p) => {
    const r = p.r;
    ring(p.c, r * 0.93, r * 0.14, C.black);
    ring(p.c, r * 0.815, r * 0.075, C.gold);
    ring(p.c, r * 0.775, Math.max(0.4, 0.9 * s), C.black);
    for (const [a, b] of Rig.spokes({ c: p.c, r, a: p.a + SPOKE_PHI }, 6, 0.12, 0.79)) stroke([a, b], C.black, 5.2 * s);
    if (!simple) for (const [a, b] of Rig.spokes({ c: p.c, r, a: p.a + SPOKE_PHI }, 6, 0.12, 0.79)) stroke([a, b], C.gold, 2.5 * s);
    disc(p.c, r * 0.17, C.gold, C.black, Math.max(0.5, 1.5 * s));
    if (!simple) disc(p.c, r * 0.06, C.red, null);
  };
  // folded wing with bands of coloured feathers, like a Horus falcon
  const wing = (pts) => {
    poly(pts, C.blue, null);
    const G = pose.G.body, dl = Math.hypot(G[2], G[3]) || 1, dn = [G[2] / dl, G[3] / dl];
    const ext = (m, e) => {
      const a = m[0], b = m[1], y = m[m.length - 2], z = m[m.length - 1];
      const l1 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, l2 = Math.hypot(z[0] - y[0], z[1] - y[1]) || 1;
      return [[a[0] + ((a[0] - b[0]) / l1) * e, a[1] + ((a[1] - b[1]) / l1) * e], ...m, [z[0] + ((z[0] - y[0]) / l2) * e, z[1] + ((z[1] - y[1]) / l2) * e]];
    };
    ctx.save();
    K.path(ctx, pts, true);
    ctx.clip();
    const E = S.wingMarks.map((m) => ext(m, 70 * s));
    const cols = [C.green, C.red, C.white];
    E.forEach((e, i) => K.fillPoly(ctx, e.concat(e.slice().reverse().map(([x, y]) => [x + dn[0] * 90 * s, y + dn[1] * 90 * s])), cols[i]));
    for (const e of E) stroke(e, C.line, lw * 0.6);
    if (!simple) {
      const M = S.wingMarks;
      for (let i = 0; i < 2; i++) for (let u = 0.1; u < 0.97; u += 0.115) stroke([K.pointAt(M[i], u), K.pointAt(M[i + 1], Math.max(0, u - 0.06))], C.line, lw * 0.45);
      for (let u = 0.12; u < 0.98; u += 0.2) {
        const a = K.pointAt(M[2], u);
        stroke([a, [a[0] + dn[0] * 14 * s - 4 * s, a[1] + dn[1] * 14 * s]], C.line, lw * 0.45);
      }
      ctx.fillStyle = C.white;
      for (const [d, ph] of [[6.5, 0], [13, 0.045]]) for (let u = 0.05 + ph; u < 0.95; u += 0.09) {
        const a = K.pointAt(M[0], u);
        K.circle(ctx, a[0] - dn[0] * d * s, a[1] - dn[1] * d * s, 1.25 * s);
        ctx.fill();
      }
    }
    ctx.restore();
    K.path(ctx, pts, true);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  // broad collar (wesekh) round the base of the neck
  const collar = () => {
    const n = S.neck, c = [(n[2][0] + n[n.length - 3][0]) / 2, (n[2][1] + n[n.length - 3][1]) / 2];
    ctx.save();
    ctx.beginPath();
    for (const pts of [S.body, S.neck]) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    }
    ctx.clip();
    for (const [r, w, col] of [[31.4, 4.6, C.blue], [26.6, 4.6, C.gold], [21.8, 4.6, C.red], [17.4, 3.8, C.green]]) ring(c, r * s, w * s, col);
    for (const r of [33.9, 29, 24.2, 19.4, 15.4]) ring(c, r * s, 0.9 * s, C.line);
    ctx.restore();
  };
  // frontal almond eye with kohl line and brow
  const eye = (p) => {
    if (simple) {
      K.circle(ctx, p.c[0], p.c[1], Math.max(0.7, 1.7 * s));
      ctx.fillStyle = C.black;
      ctx.fill();
      return;
    }
    const bt = pose.pt.beakTip, bb = pose.pt.beakBase, a = Math.atan2(bt[1] - bb[1], bt[0] - bb[0]);
    const e1 = [Math.cos(a), Math.sin(a)], e2 = [-e1[1], e1[0]];
    const c = [p.c[0] - e1[0] * 4.6 * s, p.c[1] - e1[1] * 4.6 * s];
    const at = (u, v) => [c[0] + (e1[0] * u + e2[0] * v) * s, c[1] + (e1[1] * u + e2[1] * v) * s];
    const A = at(-6.8, 0.3), B = at(6.3, 0), U = at(0, -7), D = at(0, 5.4);
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.quadraticCurveTo(U[0], U[1], B[0], B[1]);
    ctx.quadraticCurveTo(D[0], D[1], A[0], A[1]);
    ctx.closePath();
    ctx.fillStyle = '#fbf7ea';
    ctx.fill();
    ctx.strokeStyle = C.black;
    ctx.lineWidth = 1.35 * s;
    ctx.stroke();
    const pu = at(0.4 + (p.pupil[0] - p.c[0]) * 0.9, -0.4 + (p.pupil[1] - p.c[1]) * 0.6);
    K.circle(ctx, pu[0], pu[1], 2.5 * s);
    ctx.fillStyle = C.black;
    ctx.fill();
    stroke([A, at(-11.6, 0.6)], C.black, 1.9 * s);
    const b0 = at(-9.4, -3.4), b1 = at(-1, -9.6), b2 = at(6.4, -4);
    ctx.beginPath();
    ctx.moveTo(b0[0], b0[1]);
    ctx.quadraticCurveTo(b1[0], b1[1], b2[0], b2[1]);
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
  };
  // the wing-hand: three long feather fingers; they turn palm-out as the wing is raised
  const hand = () => {
    const h = pose.pt.hand, e = pose.pt.elbow;
    if (simple) return disc(h, 4 * s, C.white, C.line, lw * 0.8);
    const hd = Math.atan2(h[1] - e[1], h[0] - e[0]);
    const th = K.lerp(hd + 0.9, -Math.PI / 2 - 0.05, kHand);
    for (const [da, len] of [[-0.36, 19], [0.36, 19], [0, 26]]) {
      const a = th + da, c = Math.cos(a), sn = Math.sin(a), Ln = len * s, hw = 3.7 * s;
      poly([[h[0] + sn * hw * 0.6, h[1] - c * hw * 0.6], [h[0] + c * Ln * 0.5 + sn * hw, h[1] + sn * Ln * 0.5 - c * hw], [h[0] + c * Ln, h[1] + sn * Ln], [h[0] + c * Ln * 0.5 - sn * hw, h[1] + sn * Ln * 0.5 + c * hw], [h[0] - sn * hw * 0.6, h[1] + c * hw * 0.6]], C.white, C.line, lw * 0.75);
    }
    disc(h, 4.6 * s, C.white, C.line, lw * 0.75);
  };

  for (const p of Rig.parts(pose)) {
    const n = p.name;
    if (p.kind === 'wheel') wheel(p);
    else if (p.kind === 'disc') {
      disc(p.c, p.r, C.gold, C.black, Math.max(0.5, 1.4 * s));
      if (n === 'chainring' && !simple) disc(p.c, p.r * 0.36, C.black, null);
    } else if (p.kind === 'eye') eye(p);
    else if (p.role === 'frame') {
      stroke(p.pts, C.black, p.w);
      if (!simple && n !== 'headTube') for (const [u0, u1] of [[0.15, 0.25], [0.75, 0.85]]) stroke([K.pointAt(p.pts, u0), K.pointAt(p.pts, u1)], C.gold, Math.max(1, p.w - 2.2 * s));
    } else if (n === 'chain' || n === 'chain2') stroke(p.pts, C.black, Math.max(0.4, 1.3 * s));
    else if (p.role === 'metal') {
      if (p.kind === 'poly') poly(p.pts, p.far ? C.goldDk : C.gold, C.black, lw * 0.7);
      else tube(p.pts, p.w * 0.78, p.far ? C.goldDk : C.gold, C.black, lw * 0.55);
    } else if (p.role === 'saddle') poly(p.pts, C.red, C.black, lw * 0.8);
    else if (p.role === 'leg') tube(p.pts, p.w, p.far ? C.legFar : C.leg);
    else if (p.role === 'foot') poly(p.pts, p.far ? C.legFar : C.leg);
    else if (p.role === 'tail') {
      poly(p.pts, C.white);
      if (!simple) poly([p.pts[3], p.pts[4], p.pts[5]], C.black, C.black, lw * 0.5);
    } else if (n === 'body') poly(p.pts, C.white);
    else if (n === 'wing') wing(p.pts);
    else if (n === 'neck') poly(p.pts, C.white);
    else if (p.role === 'scarf') {
      if (p.kind === 'poly') poly(p.pts, C.red);
      else tube(p.pts, p.w * 0.75, C.red);
    } else if (n === 'arm') {
      poly(p.pts, C.white);
      if (!simple) {
        const a = p.pts, m = a.length - 1;
        poly([a[7], a[8], a[m - 8], a[m - 7]], C.gold, C.line, lw * 0.7); // armlet
        collar();
      }
      hand();
    } else if (n.startsWith('crest')) stroke(p.pts, C.black, Math.max(0.5, 2.2 * s));
    else if (n === 'head') poly(p.pts, C.white);
    else if (n === 'pouch') poly(p.pts, C.pouch);
    else if (n === 'beakUpper') poly(p.pts, C.beak);
    else if (n === 'beakLine') stroke(p.pts, C.line, lw * 0.7);
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ paint jobs
// A job list is painted three ways: flat fills on a 2D "paint" canvas, contour lines with p5.brush, and a
// hidden-line mask (a later fill erases the contours it covers), so outlines obey painter's order.
function makeJobs() {
  const list = [];
  let oy = 0, sk = false;
  const sh = (pts) => (oy ? pts.map((p) => [p[0], p[1] + oy]) : pts);
  const dense = (pts, closed) => {
    const P = closed ? pts.concat([pts[0]]) : pts;
    const A = K.arcLen(P), len = A[A.length - 1];
    return K.resample(P, len < 50 ? 1.5 : len < 220 ? 2.5 : 4);
  };
  const J = {
    list,
    row(y) {
      oy = y;
    },
    sketch(on) {
      sk = on;
    },
    fill(pts, color, smooth = false) {
      const P = sh(smooth ? K.catmull(pts, 5, true) : pts);
      list.push(sk ? { k: 'hide', pts: P } : { k: 'fill', pts: P, color });
      return J;
    },
    line(pts, w = 1, o = {}) {
      const P = o.smooth ? K.catmull(pts, 5, !!o.closed) : pts;
      list.push({ k: 'line', pts: sh(dense(P, !!o.closed)), w, group: sk ? 'sketch' : o.group ?? 'red', curve: o.smooth ? 0.5 : 0.25 });
      return J;
    },
    shape(pts, color, o = {}) {
      const P = o.smooth ? K.catmull(pts, 5, true) : pts;
      J.fill(P, color);
      J.line(P, o.w ?? 1, { closed: true, group: o.group });
      return P;
    },
    stroke(pts, color, w, o = {}) {
      if (sk) return J;
      const P = o.smooth ? K.catmull(pts, 5, !!o.closed) : pts;
      list.push({ k: 'stroke', pts: sh(o.closed ? P.concat([P[0]]) : P), color, w });
      return J;
    },
    custom(fn) {
      if (!sk) list.push({ k: 'custom', fn, oy });
      return J;
    },
  };
  return J;
}

async function renderSheet(J, w, h, seed) {
  const paint = K.layer(w, h, RES), pc = paint.getContext('2d');
  const mask = K.layer(w, h, RES), mc = mask.getContext('2d');
  mc.fillStyle = '#ffffff';
  mc.fillRect(0, 0, w, h);
  for (const c of [pc, mc]) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
  }
  for (const j of J.list) {
    if (j.k === 'fill') {
      K.fillPoly(pc, j.pts, j.color);
      K.fillPoly(mc, j.pts, '#ffffff');
    } else if (j.k === 'hide') K.fillPoly(mc, j.pts, '#ffffff');
    else if (j.k === 'stroke') {
      K.strokePoly(pc, j.pts, j.color, j.w);
      K.strokePoly(mc, j.pts, '#ffffff', j.w);
    } else if (j.k === 'line') K.strokePoly(mc, j.pts, '#000000', j.w * 2.4 + 3.4);
    else if (j.k === 'custom') {
      pc.save();
      pc.translate(0, j.oy);
      j.fn(pc);
      pc.restore();
    }
  }
  const lines = await K.bake({ w, h, res: RES, bg: '#ffffff', seed }, (b) => {
    for (const [name, color, k] of [['sketch', C.sketch, 0.9], ['red', C.line, 1.05], ['black', C.black, 0.95]]) {
      const set = J.list.filter((j) => j.k === 'line' && j.group === name);
      if (!set.length) continue;
      b.set('ink', color, 1);
      set.forEach((j, i) => {
        b.strokeWeight(j.w * k);
        if (j.pts.length < 3) b.line(j.pts[0][0], j.pts[0][1], j.pts[j.pts.length - 1][0], j.pts[j.pts.length - 1][1]);
        else b.spline(j.pts.map((p, n) => [p[0], p[1], 0.86 + 0.3 * K.noise1(n * 0.21, i * 13 + 5)]), j.curve);
      });
    }
  });
  const lc = lines.getContext('2d');
  lc.globalCompositeOperation = 'lighten'; // white where a later fill covers the line
  lc.drawImage(mask, 0, 0, lines.width, lines.height);
  lc.globalCompositeOperation = 'source-over';
  return { paint, lines };
}

// ------------------------------------------------------------------------------------------------ motifs
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function roundRectPts(x0, y0, x1, y1, r, n = 6) {
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((i / n) * Math.PI) / 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x1 - r, y0 + r, -Math.PI / 2);
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, Math.PI / 2);
  corner(x0 + r, y0 + r, Math.PI);
  return pts;
}

/** blue lotus in side view; (x, y) = base of the calyx, s = height, ang = direction it points (−π/2 = up) */
function lotus(J, x, y, s, ang = -Math.PI / 2, lw = 0.55) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const T = (u, v) => [x + (ca * v - sa * u) * s, y + (sa * v + ca * u) * s]; // v along the axis, u across
  const petal = (a, len, wid) => {
    const c = Math.cos(a), sn = Math.sin(a);
    return [[0, 0.04], [-wid, len * 0.45], [0, len], [wid, len * 0.45]].map(([u, v]) => T(u * c + v * sn, -u * sn + v * c));
  };
  for (const a of [-0.52, 0.52]) J.fill(petal(a, 0.86, 0.1), '#bcd3dc');
  for (const a of [-0.24, 0.24]) J.fill(petal(a, 0.96, 0.1), C.white);
  for (const a of [-0.78, 0.78, 0]) {
    const p = petal(a, a ? 0.9 : 1, 0.115);
    if (lw) J.shape(p, C.green, { w: lw });
    else J.fill(p, C.green);
  }
  J.fill([T(-0.15, 0.02), T(0, -0.1), T(0.15, 0.02), T(0.1, 0.2), T(-0.1, 0.2)], C.green);
}
function bud(J, x, y, s, ang = -Math.PI / 2) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const T = (u, v) => [x + (ca * v - sa * u) * s, y + (sa * v + ca * u) * s];
  J.fill([T(0, 0), T(-0.1, 0.4), T(0, 0.85), T(0.1, 0.4)], C.green);
  J.fill([T(-0.04, 0.62), T(0, 0.85), T(0.04, 0.62)], C.white);
}

/** duck / goose; (x, y) = centre of the body, S = body length, dir ±1, rot (rad, − = head up) */
function duck(J, x, y, S, dir, rot = 0, o = {}) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const T = ([a, b]) => {
    const u = a * S, v = -b * S;
    return [x + dir * (u * c - v * s), y + u * s + v * c];
  };
  const M = (pts) => pts.map(T);
  if (o.legs !== false) {
    const dangle = o.dangle ? 0.06 : 0;
    for (const dx of [-0.12, 0.06]) J.stroke(M([[dx, -0.2], [dx + 0.02 - dangle, -0.48], [dx + 0.15 - dangle * 2, -0.5 - dangle]]), C.red, Math.max(1.2, S * 0.045));
  }
  J.shape(M([[-0.4, 0.1], [-0.74, 0.2], [-0.64, 0.02], [-0.4, -0.06]]), C.black, { w: 0.6 });
  J.shape(M([[-0.5, 0.04], [-0.3, 0.2], [0.1, 0.24], [0.38, 0.13], [0.46, -0.04], [0.3, -0.21], [-0.1, -0.26], [-0.4, -0.15]]), '#ece3cd', { smooth: true, w: 0.8 });
  J.shape(M([[-0.52, 0.1], [-0.3, 0.17], [-0.02, 0.19], [0.2, 0.1], [0.08, -0.05], [-0.28, -0.07]]), '#8c5a36', { smooth: true, w: 0.6 });
  J.fill(M([[-0.52, 0.1], [-0.36, 0.14], [-0.3, 0.0], [-0.4, -0.03]]), C.blue);
  // neck and head
  const spine = K.catmull(M([[0.3, 0.06], [0.43, 0.3], [0.45, 0.5]]), 5), n = spine.length;
  const neck = K.ribbonPoly(spine, (u) => K.lerp(0.22, 0.12, u) * S);
  J.fill(neck, C.green);
  J.line(neck.slice(0, n), 0.6).line(neck.slice(n), 0.6);
  J.shape(M([[0.56, 0.6], [0.84, 0.55], [0.82, 0.5], [0.56, 0.49]]), C.yellow, { w: 0.5 });
  J.shape(K.ellipsePts(...T([0.48, 0.55]), 0.115 * S, 0.105 * S, 14), C.green, { w: 0.6 });
  J.fill(K.ellipsePts(...T([0.51, 0.57]), 0.03 * S, 0.03 * S, 8), C.white);
  J.fill(K.ellipsePts(...T([0.515, 0.57]), 0.015 * S, 0.015 * S, 6), C.black);
}

function fish(J, x, y, S, dir) {
  const M = (pts) => pts.map(([a, b]) => [x + dir * a * S, y - b * S]);
  J.shape(M([[-0.42, 0], [-0.74, 0.2], [-0.64, 0], [-0.74, -0.2]]), C.red, { w: 0.6 });
  J.shape(M([[-0.2, 0.17], [0.0, 0.34], [0.3, 0.3], [0.32, 0.15]]), C.red, { w: 0.6 });
  J.shape(M([[-0.5, 0], [-0.25, 0.2], [0.15, 0.22], [0.42, 0.1], [0.5, 0], [0.42, -0.1], [0.15, -0.2], [-0.25, -0.18]]), '#c9cdb8', { smooth: true, w: 0.7 });
  J.stroke(M([[0.24, 0.17], [0.2, 0], [0.24, -0.15]]), C.line, 0.9, { smooth: true });
  J.fill(K.ellipsePts(...M([[0.36, 0.04]])[0], 0.035 * S, 0.035 * S, 8), C.black);
}

/** a basket of loaves; P maps canon squares → picture */
function tray(J, P, g, cx, cy) {
  const circ = (a, b, r, col) => J.shape(K.ellipsePts(...P(a, b), r * g, r * g, 14), col, { w: 0.7 });
  circ(cx - 0.72, cy + 1.05, 0.42, C.white);
  circ(cx + 0.76, cy + 1.05, 0.42, C.yellow);
  circ(cx + 0.02, cy + 1.2, 0.46, '#b5632f');
  J.shape([[cx - 1.0, cy], [cx + 1.0, cy], [cx + 1.3, cy + 0.72], [cx - 1.3, cy + 0.72]].map((p) => P(...p)), C.yellow, { w: 0.8 });
  J.line([[cx - 1.14, cy + 0.36], [cx + 1.14, cy + 0.36]].map((p) => P(...p)), 0.5);
}
const JAR = [[-0.32, 0], [0.32, 0], [0.5, 0.5], [0.78, 1.7], [0.8, 2.4], [0.6, 2.9], [0.34, 3.1], [0.34, 3.35], [0.46, 3.5], [-0.46, 3.5], [-0.34, 3.35], [-0.34, 3.1], [-0.6, 2.9], [-0.8, 2.4], [-0.78, 1.7], [-0.5, 0.5]];
function jar(J, P, g, cx, cy) {
  const M = (pts) => pts.map(([a, b]) => P(cx + a, cy + b));
  J.shape(M([[-0.4, 3.5], [0.4, 3.5], [0.2, 3.98], [-0.2, 3.98]]), '#4b4036', { w: 0.7 });
  J.fill(M(JAR), '#b3572f');
  J.fill(M([[-0.79, 1.85], [0.79, 1.85], [0.8, 2.2], [-0.8, 2.2]]), C.white);
  J.fill(M([[-0.8, 2.2], [0.8, 2.2], [0.79, 2.42], [-0.79, 2.42]]), C.blue);
  J.line(M(JAR), 0.9, { closed: true });
}

function offeringTable(J, x, y, g) {
  const P = (a, b) => [x + a * g, y - b * g];
  const M = (pts) => pts.map(([a, b]) => P(a, b));
  const circ = (a, b, r, col) => J.shape(K.ellipsePts(...P(a, b), r * g, r * g, 16), col, { w: 0.8 });
  J.shape(M([[-1.2, 0], [1.2, 0], [0.5, 0.9], [0.3, 2.2], [0.3, 4.4], [0.9, 5.0], [-0.9, 5.0], [-0.3, 4.4], [-0.3, 2.2], [-0.5, 0.9]]), C.white, { w: 0.9 });
  J.shape(M([[-2.7, 5.0], [2.7, 5.0], [2.7, 5.45], [-2.7, 5.45]]), C.white, { w: 0.9 });
  // first tier
  circ(-1.8, 6.17, 0.72, C.yellow);
  J.shape(M([[-1.02, 5.45], [0.16, 5.45], [-0.42, 7.5]]), C.white, { w: 0.8 });
  circ(0.92, 6.13, 0.68, '#b5632f');
  for (const [a, b] of [[1.72, 6.5], [2.28, 6.5], [2.0, 6.82]]) circ(a, b, 0.27, C.red);
  J.shape(M([[1.42, 5.45], [2.58, 5.45], [2.72, 6.35], [1.28, 6.35]]), C.blue, { w: 0.8 });
  // second tier: a trussed duck, a haunch, a gourd, grapes
  J.stroke(M([[-1.9, 7.9], [-2.45, 7.6], [-2.5, 7.15]]), '#ece3cd', 0.24 * g, { smooth: true });
  J.shape(K.ellipsePts(...P(-1.0, 7.95), 1.12 * g, 0.5 * g, 18), '#ece3cd', { w: 0.8 });
  J.shape(M([[0.3, 7.3], [1.5, 7.2], [2.35, 7.6], [2.25, 8.2], [1.2, 8.35], [0.5, 8.0]]), C.red, { smooth: true, w: 0.8 });
  J.shape(M([[-0.7, 8.55], [0.4, 8.78], [1.4, 8.62], [1.45, 8.95], [0.4, 9.12], [-0.75, 8.88]]), C.green, { smooth: true, w: 0.7 });
  for (const [a, b] of [[-1.75, 8.72], [-1.35, 8.72], [-1.55, 9.02], [-1.95, 9.02], [-1.15, 9.02], [-1.55, 8.42]]) J.fill(K.ellipsePts(...P(a, b), 0.23 * g, 0.23 * g, 10), C.deep);
  lotus(J, ...P(-0.2, 9.15), 1.5 * g, -Math.PI / 2 - 0.55);
  bud(J, ...P(0.7, 9.1), 1.5 * g, -Math.PI / 2 + 0.6);
}

function amphora(J, x, y, g) {
  const M = (pts) => pts.map(([a, b]) => [x + a * g, y - b * g]);
  const body = [[0, 0.5], [0.45, 1.3], [0.85, 3.2], [0.9, 4.6], [0.7, 5.5], [0.36, 5.9], [0.36, 6.3], [0.5, 6.45], [-0.5, 6.45], [-0.36, 6.3], [-0.36, 5.9], [-0.7, 5.5], [-0.9, 4.6], [-0.85, 3.2], [-0.45, 1.3]];
  J.shape(M([[-0.42, 6.45], [0.42, 6.45], [0.2, 7.05], [-0.2, 7.05]]), '#4b4036', { w: 0.7 });
  J.fill(M(body), '#b3572f');
  J.fill(M([[-0.9, 4.25], [0.9, 4.25], [0.9, 4.7], [-0.9, 4.7]]), C.white);
  J.line(M(body), 0.9, { closed: true });
  J.shape(M([[-0.95, 0], [0.95, 0], [0.62, 1.3], [-0.62, 1.3]]), C.white, { w: 0.8 });
  J.stroke(M([[-0.4, 6.0], [0.5, 5.75], [1.0, 5.2]]), C.green, 1.5, { smooth: true });
  lotus(J, ...M([[1.0, 5.25]])[0], 1.35 * g, Math.PI / 2 - 0.5);
}

/** uniliteral signs and a few common ideograms, drawn in a 1 × 1 quadrat of q units centred on (cx, cy) */
function glyph(J, name, cx, cy, q, o = {}) {
  const col = o.col ?? C.glyph, poly = !!o.poly;
  const T = (pts) => pts.map(([a, b]) => [cx + a * q, cy - b * q]);
  const F = (pts, c, smooth = false) => (poly ? J.shape(T(pts), c, { smooth, w: 0.55, group: 'black' }) : J.fill(T(pts), col, smooth));
  const S = (pts, c, w, smooth = false, closed = false) => J.stroke(T(pts), poly ? c : col, w * q, { smooth, closed });
  const bowl = [[-0.5, 0.14], [0.5, 0.14], [0.43, -0.03], [0.22, -0.15], [-0.22, -0.15], [-0.43, -0.03]];
  const lens = [[-0.5, 0], [-0.25, 0.13], [0, 0.17], [0.25, 0.13], [0.5, 0], [0.25, -0.13], [0, -0.17], [-0.25, -0.13]];
  switch (name) {
    case 'p': // reed mat
      if (poly) {
        F(rect(-0.31, -0.31, 0.62, 0.62), C.green);
        for (const d of [-0.1, 0.1]) {
          J.stroke(T([[d, -0.31], [d, 0.31]]), C.black, 0.9);
          J.stroke(T([[-0.31, d], [0.31, d]]), C.black, 0.9);
        }
      } else {
        S(rect(-0.28, -0.28, 0.56, 0.56), col, 0.08, false, true);
        S([[0, -0.28], [0, 0.28]], col, 0.06);
        S([[-0.28, 0], [0.28, 0]], col, 0.06);
      }
      break;
    case 'r': // mouth (r / l)
      F(lens, C.red, true);
      break;
    case 'k': // basket with a handle
      S([[0.34, 0.14], [0.47, 0.29], [0.6, 0.2], [0.5, 0.1]], C.yellow, 0.07, true);
      F(bowl, C.yellow);
      if (poly) J.stroke(T([[-0.4, 0.02], [0.4, 0.02]]), C.red, 0.9);
      break;
    case 'nb':
      F(bowl, C.green);
      break;
    case 'n': { // water
      const z = [];
      for (let i = 0; i <= 12; i++) z.push([-0.5 + i / 12, i % 2 ? 0.075 : -0.075]);
      S(z, C.blue, 0.09);
      break;
    }
    case 't': // bread loaf
      F([[-0.24, -0.11], [-0.22, 0.02], [-0.12, 0.12], [0.12, 0.12], [0.22, 0.02], [0.24, -0.11]], '#2c3a48');
      break;
    case 's': // folded cloth
      S([[-0.07, -0.45], [-0.07, 0.34], [-0.03, 0.43], [0.05, 0.45], [0.11, 0.36], [0.11, 0.02]], C.red, 0.09);
      break;
    case 'sun':
      F(K.ellipsePts(0, 0, 0.21, 0.21, 16), C.red);
      if (poly) J.fill(T(K.ellipsePts(0, 0, 0.05, 0.05, 8)), C.black);
      break;
    case 'goose':
      S([[0.05, -0.12], [0.07, -0.36], [0.2, -0.36]], C.red, 0.05);
      S([[-0.1, -0.13], [-0.08, -0.36], [0.05, -0.36]], C.red, 0.05);
      F([[-0.44, 0.02], [-0.2, 0.12], [0.05, 0.14], [0.2, 0.2], [0.24, 0.36], [0.34, 0.43], [0.47, 0.38], [0.36, 0.33], [0.31, 0.2], [0.3, 0.0], [0.15, -0.12], [-0.1, -0.14], [-0.3, -0.06]], C.white);
      if (poly) J.fill(T([[-0.3, 0.06], [-0.05, 0.1], [0.12, 0.04], [-0.02, -0.06], [-0.24, -0.04]]), '#8c5a36');
      break;
    case 'ankh':
      S(K.ellipsePts(0, 0.22, 0.12, 0.2, 14), col, 0.085, false, true);
      S([[0, 0.02], [0, -0.46]], col, 0.085);
      S([[-0.25, 0], [0.25, 0]], col, 0.085);
      break;
    case 'reed':
      F([[-0.03, -0.45], [-0.13, 0.08], [-0.03, 0.47], [0.12, 0.1], [0.04, -0.45]], C.green);
      break;
    case 'plural':
      for (const d of [-0.2, 0, 0.2]) F(rect(d - 0.04, -0.15, 0.08, 0.3), col);
      break;
    case 'house':
      S([[-0.07, -0.2], [-0.38, -0.2], [-0.38, 0.2], [0.38, 0.2], [0.38, -0.2], [0.07, -0.2]], col, 0.08);
      break;
    case 'di':
      F([[-0.2, -0.3], [0, 0.36], [0.2, -0.3]], col);
      break;
    case 'htp':
      F(rect(-0.48, -0.13, 0.96, 0.11), col);
      F([[-0.13, -0.02], [-0.1, 0.14], [0, 0.2], [0.1, 0.14], [0.13, -0.02]], col);
      break;
    case 'sw':
      S([[0, -0.45], [0, 0.3]], col, 0.07);
      for (const [a, b] of [[[0, 0.3], [-0.18, 0.45]], [[0, 0.3], [0.18, 0.45]], [[0, 0.05], [-0.2, 0.2]], [[0, -0.1], [0.2, 0.05]]]) S([a, b], col, 0.07);
      break;
    case 'eye':
      S(lens.map(([a, b]) => [a * 0.9, b * 1.2]), col, 0.06, true, true);
      F(K.ellipsePts(0, 0, 0.08, 0.08, 8), col);
      break;
    default:
      break;
  }
}

// ---- the human figure, on the 18-square canon (x forward, y up, in squares; feet on y = 0) -------------------
const TORSO = [[-3.0, 15.75], [-2.55, 16.15], [-0.7, 16.3], [0.7, 16.3], [2.55, 16.15], [3.0, 15.75], [2.75, 14.5], [2.0, 12.9], [1.45, 11.2], [-1.45, 11.2], [-1.85, 12.9], [-2.6, 14.5]];
const HEAD_SKIN = [[0.55, 16.25], [0.62, 16.85], [1.08, 16.78], [1.2, 17.0], [1.22, 17.14], [1.1, 17.22], [1.27, 17.32], [1.22, 17.5], [1.6, 17.58], [1.42, 17.85], [1.2, 18.1], [1.18, 18.5], [1.0, 18.85], [0.2, 19.05], [-0.9, 18.5], [-1.0, 17.3], [-0.55, 16.25]];
const WIG_M = [[1.02, 18.9], [0.55, 19.2], [-0.4, 19.25], [-1.15, 18.8], [-1.55, 17.9], [-1.6, 16.6], [-1.2, 16.25], [-0.15, 16.35], [0.0, 17.4], [0.2, 18.2], [0.7, 18.42]];
const WIG_F = [[1.02, 18.9], [0.55, 19.2], [-0.5, 19.25], [-1.3, 18.7], [-1.7, 17.5], [-1.8, 15.0], [-0.9, 14.8], [0.85, 14.7], [0.9, 16.0], [0.4, 16.7], [0.1, 17.4], [0.2, 18.25], [0.75, 18.42]];
const EYE = [[0.24, 17.98], [0.45, 18.12], [0.72, 18.13], [1.0, 17.99], [0.72, 17.86], [0.45, 17.86]];
const BROW = [[0.2, 18.3], [0.6, 18.38], [1.04, 18.27]];
const KILT = [[-1.45, 11.3], [1.45, 11.3], [1.75, 10.2], [2.3, 8.4], [2.9, 6.7], [0.4, 6.5], [-2.45, 6.6], [-2.0, 8.6], [-1.7, 10.2]];
const FOOT = [[0.95, 1.3], [1.9, 1.25], [2.5, 0.75], [3.6, 0.4], [3.85, 0.12], [3.7, 0], [0.85, 0], [0.75, 0.5]];
const OPEN = [[0, -0.36], [0.6, -0.4], [1.25, -0.36], [1.8, -0.24], [1.92, 0], [1.78, 0.22], [1.2, 0.3], [0.98, 0.34], [1.1, 0.62], [0.9, 0.76], [0.52, 0.52], [0, 0.36]];
const FIST = [[0, -0.38], [0.55, -0.5], [1.0, -0.4], [1.12, 0.08], [0.92, 0.5], [0.4, 0.52], [0, 0.38]];
const ARMS = {
  hangF: { S: [2.6, 15.45], E: [2.85, 12.4], W: [2.6, 9.9], hand: 'fist', hd: [0, -1] },
  hangR: { S: [-2.6, 15.45], E: [-2.85, 12.4], W: [-2.6, 9.9], hand: 'fist', hd: [0, -1] },
  adoreF: { S: [2.6, 15.45], E: [4.5, 13.2], W: [5.4, 16.1], hand: 'open', hd: [0.1, 1] },
  adoreR: { S: [-2.3, 15.4], E: [2.1, 12.9], W: [3.8, 15.8], hand: 'open', hd: [0.1, 1] },
  trayF: { S: [2.6, 15.45], E: [3.9, 13.3], W: [4.5, 15.5], hand: 'open', hd: [1, 0.12] },
  duckF: { S: [2.6, 15.45], E: [3.3, 12.7], W: [5.2, 12.5], hand: 'fist', hd: [1, 0] },
  jarR: { S: [-2.6, 15.45], E: [-4.1, 14.3], W: [-3.4, 16.7], hand: 'open', hd: [0.3, 1] },
  reachF: { S: [2.6, 15.45], E: [4.0, 13.3], W: [6.1, 13.5], hand: 'open', hd: [1, -0.05] },
  lapR: { S: [-2.6, 15.45], E: [-2.4, 12.5], W: [0.4, 11.2], hand: 'fist', hd: [1, -0.1] },
  fanF: { S: [2.6, 15.45], E: [3.9, 13.2], W: [4.9, 14.9], hand: 'fist', hd: [0.5, 0.85] },
  fanR: { S: [-2.3, 15.4], E: [1.4, 12.6], W: [3.3, 12.0], hand: 'fist', hd: [0.5, 0.85] },
  // the lady: an arm round her husband (only the hand shows on his far shoulder) / raised between her face and his wig
  ladyStub: { S: [2.6, 15.45], E: [3.6, 15.0], W: [4.6, 15.4] },
  ladyHand: { W: [8.25, 15.85], hand: 'open', hd: [1, -0.12] },
  ladyUp: { S: [2.6, 15.45], E: [3.4, 13.6], W: [3.9, 16.4], hand: 'open', hd: [0.05, 1] },
};

/**
 * o: { x, y (ground), g (square), dir ±1, seated, lady, cone, head: 'fwd'|'back'|'none', only: 'head'|'arms',
 *      arms: [arm spec | (P) => void …] in drawing order, before(P), behind(P) }
 */
function person(J, o) {
  const g = o.g, yo = o.seated ? -4 : 0, skin = o.lady ? C.skinF : C.skinM, dir = o.dir;
  const P = (x, y) => [o.x + dir * x * g, o.y - y * g];
  const M = (pts, dx = 0, dy = 0, mx = 1) => pts.map(([x, y]) => P(x * mx + dx, y + dy));
  const limb = (joints, widths, col = skin) => {
    const spine = K.catmull(joints.map(([x, y]) => P(x, y)), 6), n = spine.length, m = widths.length - 1;
    const poly = K.ribbonPoly(spine, (u) => {
      const x = Math.min(m - 1e-6, u * m), i = Math.floor(x);
      return K.lerp(widths[i], widths[i + 1], x - i) * g;
    });
    J.fill(poly, col);
    J.line(poly.slice(0, n), 1).line(poly.slice(n), 1);
  };
  const hand = (W, hd, kind) => {
    const Ln = Math.hypot(hd[0], hd[1]), ux = hd[0] / Ln, uy = hd[1] / Ln, vx = -uy, vy = ux;
    const map = ([a, b]) => P(W[0] + ux * a + vx * b, W[1] + uy * a + vy * b);
    J.shape((kind === 'open' ? OPEN : FIST).map(map), skin, { smooth: true, w: 0.8 });
    J.shape([[-0.3, -0.45], [0.16, -0.45], [0.16, 0.45], [-0.3, 0.45]].map(map), C.white, { w: 0.7 }); // bracelet
  };
  const arm = (a) => {
    const W = [a.W[0], a.W[1] + yo];
    if (a.S) limb([[a.S[0], a.S[1] + yo], [a.E[0], a.E[1] + yo], W], [1.2, 1.0, 0.74]);
    if (a.hand) hand(W, a.hd ?? [a.W[0] - a.E[0], a.W[1] - a.E[1]], a.hand);
  };
  const head = (mx) => {
    J.fill(M(HEAD_SKIN, 0, yo, mx), skin);
    J.line(M(HEAD_SKIN.slice(0, 13), 0, yo, mx), 0.8);
    J.shape(M(o.lady ? WIG_F : WIG_M, 0, yo, mx), C.black, { smooth: true, w: 0.8, group: 'black' });
    J.shape(M(EYE, 0, yo, mx), '#fbf6e8', { smooth: true, w: 0.45, group: 'black' });
    J.fill(K.ellipsePts(...P(0.68 * mx, 17.99 + yo), 0.115 * g, 0.115 * g, 10), C.black);
    J.stroke(M(BROW, 0, yo, mx), C.black, 0.09 * g, { smooth: true });
    if (o.lady) {
      J.stroke(M([[1.02, 18.7], [0.2, 18.62], [-1.45, 18.3]], 0, yo, mx), C.white, 0.13 * g, { smooth: true });
      lotus(J, ...P(1.08 * mx, 18.78 + yo), 1.25 * g, dir * mx > 0 ? 0.3 : Math.PI - 0.3, 0.45);
    }
    if (o.cone) {
      J.shape(M([[-0.5, 19.18], [0.45, 19.18], [0.32, 19.95], [0.05, 20.38], [-0.25, 19.95]], 0, yo, mx), C.white, { w: 0.8 });
      J.fill(M([[-0.15, 20.05], [0.05, 20.38], [0.22, 20.05]], 0, yo, mx), C.orange);
    }
  };
  const chair = () => {
    J.shape(M([[-2.9, 5.0], [-2.35, 5.0], [-3.3, 8.9], [-3.8, 8.8]]), C.black, { w: 0.8, group: 'black' });
    for (const dx of [0, -5.3]) {
      J.shape(M([[2.5, 4.5], [3.4, 4.5], [3.55, 3.2], [3.2, 1.9], [3.3, 0.95], [3.75, 0.5], [3.7, 0.28], [2.75, 0.28], [2.7, 0.95], [2.75, 2.0], [2.6, 3.2]], dx), C.black, { smooth: true, w: 0.8, group: 'black' });
      J.shape(M([[2.65, 0.28], [3.8, 0.28], [3.75, 0], [2.7, 0]], dx), C.yellow, { w: 0.7 });
    }
    J.shape(M([[-2.95, 5.0], [3.55, 5.0], [3.55, 4.45], [-2.95, 4.45]]), C.black, { w: 0.8, group: 'black' });
    J.stroke(M([[-2.8, 4.72], [3.4, 4.72]]), C.yellow, 0.11 * g);
    J.shape(M([[-3.0, 5.38], [3.3, 5.38], [3.5, 5.0], [-2.95, 5.0]]), C.white, { w: 0.8 });
    J.shape(M([[-3.9, 9.1], [-3.2, 9.3], [-3.0, 8.3], [-3.65, 8.15]]), C.white, { w: 0.8 });
  };
  if (!o.only) {
    if (o.before) o.before(P);
    if (o.seated) {
      chair();
      J.shape(M(FOOT, 2.85), skin, { w: 0.8 });
      limb([[4.65, 5.6], [4.45, 3.4], [4.3, 1.15]], [1.3, 1.45, 0.8]);
      J.shape(M(FOOT, 2.5), skin, { w: 0.8 });
      limb([[4.3, 5.6], [4.1, 3.4], [3.95, 1.15]], [1.3, 1.45, 0.8]);
      limb([[0.2, 5.95], [2.4, 6.15], [4.5, 5.95]], [2.3, 2.1, 1.5]);
    } else {
      J.shape(M(FOOT), skin, { w: 0.8 });
      limb([[0.55, 9.6], [1.25, 6.0], [1.55, 3.4], [1.45, 1.15]], [2.3, 1.3, 1.5, 0.8]);
      J.shape(M(FOOT, -4.05), skin, { w: 0.8 });
      limb([[-0.4, 9.6], [-1.5, 6.0], [-2.0, 3.4], [-2.55, 1.15]], [2.3, 1.3, 1.5, 0.8]);
    }
    J.shape(M(TORSO, 0, yo), skin, { smooth: true });
    J.fill(M([[-0.6, 16.1], [0.6, 16.1], [0.56, 17.3], [-0.56, 17.3]], 0, yo), skin);
    // broad collar
    const arc = (r) => {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const a = Math.PI + (i / 14) * Math.PI;
        pts.push([Math.cos(a) * r, 16.28 + yo + Math.sin(a) * r * 0.9]);
      }
      return pts;
    };
    const cres = (r0, r1) => M(arc(r1).concat(arc(r0).reverse()));
    J.fill(cres(0.6, 1.85), C.blue).fill(cres(0.6, 1.45), C.white).fill(cres(0.6, 1.05), C.green);
    J.line(cres(0.6, 1.85), 0.7, { closed: true }).line(M(arc(1.45)), 0.5).line(M(arc(1.05)), 0.5);
    // dress
    if (o.seated && o.lady) {
      J.shape(M([[-1.35, 10.9], [1.35, 10.9], [1.45, 7.3], [2.4, 7.3], [4.7, 6.85], [5.25, 6.1], [5.1, 1.5], [3.5, 1.4], [3.45, 4.95], [-1.9, 5.0], [-2.1, 6.2], [-1.5, 7.3]]), C.white);
      for (const sx of [-1, 1]) J.stroke(M([[0.95 * sx, 10.9], [1.25 * sx, 12.1]]), C.white, 0.34 * g);
    } else if (o.seated) {
      J.shape(M([[-1.45, 7.3], [1.45, 7.3], [2.4, 7.3], [4.7, 6.85], [5.25, 6.1], [5.1, 2.7], [3.5, 2.6], [3.45, 4.95], [-1.9, 5.0], [-2.1, 6.2]]), C.white);
      J.line(M([[1.5, 7.2], [3.2, 5.2]]), 0.5).line(M([[2.6, 7.15], [4.2, 5.4], [4.5, 2.8]]), 0.5);
    } else {
      J.shape(M(KILT), C.white);
      for (const e of [[2.55, 6.75], [1.7, 6.62], [0.5, 6.55]]) J.line(M([[0.95, 10.8], e]), 0.5);
      J.shape(M([[0.55, 10.85], [1.05, 10.85], [1.3, 8.8], [0.8, 8.8]]), C.white, { w: 0.7 });
      J.shape(M([[-1.5, 11.38], [1.5, 11.38], [1.56, 10.85], [-1.56, 10.85]]), C.white, { w: 0.8 });
    }
    if (o.behind) o.behind(P);
  }
  if (o.only !== 'arms' && o.head !== 'none') head(o.head === 'back' ? -1 : 1);
  if (o.only !== 'head') for (const a of o.arms ?? []) (typeof a === 'function' ? a(P) : arm(a));
}

const BEARERS = [{ x: 640, item: 'tray' }, { x: 790, item: 'jar' }, { x: 940, item: 'duck' }];
function bearer(J, i, state, extra = {}) {
  const b = BEARERS[i], g = G_UP, base = { x: b.x, y: REG_Y, g, dir: -1, ...extra };
  if (state === 'B') {
    // adoration: the offering has been set down on the ground line (the duck stands, and looks too)
    const before = (P) => {
      if (b.item === 'tray') tray(J, P, g, 4.95, 0);
      else if (b.item === 'jar') jar(J, P, g, 4.95, 0);
      else duck(J, ...P(4.95, 1.25), 2.5 * g, -1, 0);
    };
    return person(J, { ...base, before, arms: [ARMS.adoreR, ARMS.adoreF] });
  }
  if (b.item === 'tray') return person(J, { ...base, arms: [ARMS.hangR, ARMS.trayF, (P) => tray(J, P, g, 5.45, 15.95)] });
  if (b.item === 'jar') return person(J, { ...base, behind: (P) => jar(J, P, g, -2.35, 16.2), arms: [ARMS.jarR, ARMS.hangF] });
  return person(J, { ...base, arms: [ARMS.hangR, (P) => duck(J, ...P(5.75, 11.2), 2.7 * g, -1, -0.45, { dangle: true }), ARMS.duckF] });
}
function couple(J, state) {
  const g = G_NOB, xm = 195, lady = { x: xm - 6.2 * g, y: REG_Y, g, dir: 1, seated: true, lady: true, cone: true };
  person(J, { ...lady, arms: state === 'A' ? [ARMS.lapR, ARMS.ladyStub] : [ARMS.lapR] });
  person(J, { x: xm, y: REG_Y, g, dir: 1, seated: true, cone: true, arms: state === 'A' ? [ARMS.lapR, ARMS.reachF] : [ARMS.adoreR, ARMS.adoreF] });
  person(J, { ...lady, only: 'arms', arms: [state === 'A' ? ARMS.ladyHand : ARMS.ladyUp] });
}

// ------------------------------------------------------------------------------------------------ the wall, job by job
function buildStatic(J, T, glyphPose, fp) {
  // ---- kheker frieze
  J.fill(rect(0, 0, 1000, 58), '#efe6cc');
  for (let k = 0; k < 25; k++) {
    const xc = 20 + k * 40, A = k % 2 ? C.green : C.blue;
    const Tk = (pts) => pts.map(([x, y]) => [xc + x, 1 + y]);
    const outer = [[-11, 47], [-15, 35], [-12, 21], [0, 2], [12, 21], [15, 35], [11, 47]];
    const sc = (k2) => outer.map(([x, y]) => [x * k2, 37 + (y - 37) * k2]);
    J.fill(Tk([[-9, 47], [9, 47], [14, 56], [-14, 56]]), A);
    J.fill(Tk(outer), A, true).fill(Tk(sc(0.64)), C.red, true).fill(Tk(sc(0.3)), C.yellow, true);
    J.line(Tk(outer), 0.7, { smooth: true, closed: true, group: 'black' });
    J.shape(Tk(rect(-10, 43, 20, 5)), C.yellow, { w: 0.6, group: 'black' });
    J.fill(K.ellipsePts(xc + 20, 50, 3.4, 3.4, 10), C.red);
  }
  // ---- block border
  J.fill(rect(0, 58, 1000, 18), C.white);
  J.fill(rect(0, 58, 1000, 2.2), C.black).fill(rect(0, 73.8, 1000, 2.2), C.black);
  for (let k = 0, x = -6; x < 1000; k++, x += 41) {
    J.fill(rect(x, 60.2, 31, 13.6), [C.red, C.blue, C.yellow, C.green][k % 4]);
    J.fill(rect(x + 31, 60.2, 2, 13.6), C.black).fill(rect(x + 39, 60.2, 2, 13.6), C.black);
  }
  // ---- inscription band = the title card
  J.fill(rect(0, 76, 1000, 62), C.band);
  J.fill(rect(0, 76, 1000, 2.6), C.black).fill(rect(0, 135.4, 1000, 2.6), C.black);
  J.custom((ctx) => {
    const y = 107.5;
    const zh = { size: 45, font: K.FONT.cjkSerif, weight: 900, color: C.ink, baseline: 'middle' };
    const en = { size: 31, font: K.FONT.serif, weight: 700, color: C.ink, baseline: 'middle', tracking: 0.4 };
    const dt = { size: 27, font: K.FONT.serif, weight: 700, color: C.ink, baseline: 'middle' };
    const w1 = K.measure(ctx, T.zh, zh), w2 = K.measure(ctx, T.en, en), w3 = K.measure(ctx, T.date, dt), gap = 56;
    let x = (1000 - (w1 + w2 + w3 + 2 * gap)) / 2;
    const sep = (sx) => {
      ctx.fillStyle = C.red;
      ctx.fillRect(sx - 4.2, 84, 2.4, 46);
      ctx.fillRect(sx + 1.8, 84, 2.4, 46);
    };
    K.text(ctx, T.zh, x, y + 1, zh);
    x += w1;
    sep(x + gap / 2);
    x += gap;
    K.text(ctx, T.en, x, y + 2.5, en);
    x += w2;
    sep(x + gap / 2);
    x += gap;
    K.text(ctx, T.date, x, y + 2.5, dt);
  });
  for (const gx of [50, 950]) glyph(J, 'ankh', gx, 107, 46, { col: C.ink });

  // ---- upper register: captions, offering table, wine jar, the cartouche
  for (const x of [327, 365, 403, 441]) J.stroke([[x, 141], [x, 268]], C.red, 1.6);
  J.stroke([[327, 268], [441, 268]], C.red, 1.6);
  [['sw', 'htp', 'di', 'eye'], ['reed', 'n', 'house', 'nb'], ['r', 't', 'ankh', 'plural']].forEach((colm, i) => colm.forEach((nm, k) => glyph(J, nm, 346 + i * 38, 160 + k * 27.5, nm === 't' ? 30 : 25)));
  offeringTable(J, 367, REG_Y, G_UP);
  amphora(J, 432, REG_Y, G_UP);
  for (const x of [456, 544]) J.stroke([[x, 141], [x, 451]], C.blue, 2);
  // "Son of Ra" over the ring
  glyph(J, 'goose', 488, 170, 42, { poly: true });
  glyph(J, 'sun', 522, 158, 34, { poly: true });
  // the cartouche: rope ring, tie bar
  const cx = 500, y0 = 196, y1 = 438, hw = 35;
  J.shape(rect(cx - hw - 6, y1 - 1.5, 2 * hw + 12, 8), C.yellow, { w: 0.9, group: 'black' });
  J.shape(roundRectPts(cx - hw, y0, cx + hw, y1, 30), C.yellow, { w: 0.9, group: 'black' });
  const mid = K.resample(roundRectPts(cx - hw + 3, y0 + 3, cx + hw - 3, y1 - 3, 27).concat([[cx + hw - 30, y0 + 3]]), 7);
  for (let i = 1; i < mid.length - 1; i++) {
    const a = mid[i - 1], b = mid[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, tx = dx / m, ty = dy / m;
    J.stroke([[mid[i][0] - ty * 2.3 - tx * 1.6, mid[i][1] + tx * 2.3 - ty * 1.6], [mid[i][0] + ty * 2.3 + tx * 1.6, mid[i][1] - tx * 2.3 + ty * 1.6]], C.line, 0.9);
  }
  J.shape(roundRectPts(cx - hw + 6, y0 + 6, cx + hw - 6, y1 - 6, 24), C.field, { w: 0.7, group: 'black' });
  glyph(J, 'p', cx, 226, 44, { poly: true });
  glyph(J, 'r', cx, 256, 42, { poly: true });
  glyph(J, 'k', cx - 2, 282, 42, { poly: true });
  glyph(J, 'n', cx, 305, 44, { poly: true });
  glyph(J, 's', cx - 13, 339, 40, { poly: true });
  glyph(J, 't', cx + 9, 329, 40, { poly: true });
  glyph(J, 't', cx + 9, 348, 40, { poly: true });
  J.custom((ctx) => paintPelican(ctx, glyphPose, { lw: 0.75, simple: true }));

  // ---- register line
  J.fill(rect(0, REG_Y, 1000, 5.5), C.black).fill(rect(0, REG_Y + 5.5, 1000, 4.5), C.red);

  // ---- main register: the draughtsman's red underdrawing
  J.sketch(true);
  person(J, { x: 196, y: ROAD, g: G_UP, dir: 1, arms: [(P) => {
    J.line([P(1.97, 9.6), P(6.94, 18.6)], 0.9);
    J.shape([[6.5, 18.3], [7.4, 18.9], [8.2, 20.2], [8.1, 21.4], [7.3, 21.2], [6.6, 20.2], [6.3, 19.0]].map((p) => P(...p)), null, { smooth: true, w: 0.9 });
    for (const e of [[7.9, 20.9], [7.4, 20.6], [7.0, 20.0]]) J.line([P(6.75, 18.7), P(...e)], 0.6);
  }, ARMS.fanR, ARMS.fanF] });
  person(J, { x: 812, y: ROAD, g: G_UP, dir: -1, arms: [ARMS.adoreR, ARMS.adoreF] });
  for (const p of Rig.parts(fp)) {
    if (p.kind === 'poly') J.shape(p.pts, null, { w: 0.85 });
    else if (p.kind === 'line') {
      if (p.name.startsWith('finger')) continue;
      if (p.w >= 6) J.shape(K.ribbonPoly(K.resample(p.pts, 5), p.w), null, { w: 0.75 });
      else J.line(p.pts, p.role === 'mark' ? 0.6 : 0.8);
    } else if (p.kind === 'wheel') {
      for (const r of [1, 0.86]) J.line(K.ellipsePts(p.c[0], p.c[1], p.r * r, p.r * r, 40), 0.85, { closed: true });
      for (const [a, b] of Rig.spokes({ c: p.c, r: p.r, a: p.a + SPOKE_PHI }, 6, 0.17, 0.86)) J.line([a, b], 0.8);
      J.line(K.ellipsePts(p.c[0], p.c[1], p.r * 0.17, p.r * 0.17, 14), 0.7, { closed: true });
    } else if (p.kind === 'disc') J.line(K.ellipsePts(p.c[0], p.c[1], p.r, p.r, 16), 0.7, { closed: true });
  }
  {
    const h = fp.pt.hand; // the raised palm
    for (const [da, len] of [[-0.36, 19], [0.36, 19], [0, 26]]) {
      const a = -Math.PI / 2 - 0.05 + da, c = Math.cos(a), sn = Math.sin(a), hw2 = 3.7;
      J.shape([[h[0] + sn * hw2 * 0.6, h[1] - c * hw2 * 0.6], [h[0] + c * len * 0.5 + sn * hw2, h[1] + sn * len * 0.5 - c * hw2], [h[0] + c * len, h[1] + sn * len], [h[0] + c * len * 0.5 - sn * hw2, h[1] + sn * len * 0.5 + c * hw2], [h[0] - sn * hw2 * 0.6, h[1] + c * hw2 * 0.6]], null, { w: 0.7 });
    }
    const e = fp.eye.c;
    J.line([[e[0] - 11, e[1]], [e[0] - 4.5, e[1] - 3.4], [e[0] + 2, e[1]], [e[0] - 4.5, e[1] + 2.8]], 0.6, { smooth: true, closed: true });
  }
  J.sketch(false);

  // ---- the road: a heavy ground line
  J.fill(rect(0, ROAD, 1000, 6.5), C.black).fill(rect(0, ROAD + 6.5, 1000, 5.5), C.red);

  // ---- below: stripe, a strip of water with lotus, ducks and fish, and the dado
  J.fill(rect(0, 812, 1000, 12), C.yellow).fill(rect(0, 824, 1000, 3), C.black);
  J.fill(rect(0, 827, 1000, 66), C.water);
  for (let r = 0; r < 5; r++) {
    const pts = [];
    for (let i = 0; i <= 143; i++) pts.push([i * 7, 835.5 + r * 12 + (i % 2 ? -3 : 3) * (0.8 + 0.4 * K.noise1(i * 0.37, r * 9 + 2))]);
    J.stroke(pts, C.deep, 1.5);
  }
  const pad = (x, y, r) => {
    const pts = K.ellipsePts(x, y, r, r * 0.42, 18, 0, 0.5, K.TAU - 0.5);
    pts.push([x, y]);
    J.shape(pts, C.green, { w: 0.6 });
  };
  [[52, 0], [170, 1], [336, 0], [496, 2], [668, 0], [842, 1], [948, 0]].forEach(([x, kind], i) => {
    const lean = (K.hash1(i * 7 + 3) - 0.5) * 0.5;
    J.stroke([[x - lean * 30, 893], [x - lean * 10, 872], [x, 856]], C.green, 1.8, { smooth: true });
    if (kind === 0) lotus(J, x, 858, 27, -Math.PI / 2 + lean * 0.5);
    else if (kind === 1) bud(J, x, 860, 26, -Math.PI / 2 + lean * 0.5);
    else lotus(J, x, 858, 24, -Math.PI / 2 + lean * 0.5);
    pad(x + 30 + lean * 20, 878 + (i % 2) * 6, 13);
    if (i % 2 === 0) bud(J, x - 26, 866, 20, -Math.PI / 2 - 0.3);
  });
  duck(J, 252, 859, 46, 1, 0, { legs: false });
  duck(J, 748, 861, 44, -1, 0, { legs: false });
  fish(J, 420, 873, 44, 1);
  fish(J, 585, 868, 38, -1);
  J.fill(rect(0, 893, 1000, 3), C.black);
  J.fill(rect(0, 896, 1000, 13), C.yellow).fill(rect(0, 909, 1000, 3), C.black);
  J.fill(rect(0, 912, 1000, 47), C.red).fill(rect(0, 959, 1000, 3), C.black);
  J.fill(rect(0, 962, 1000, 38), '#2b2928');
}

function buildFigures(J) {
  // row A (procession; the last bearer's head is a separate patch), row B (adoration), two head patches
  J.row(0 - STRIP_Y);
  couple(J, 'A');
  bearer(J, 0, 'A');
  bearer(J, 1, 'A');
  bearer(J, 2, 'A', { head: 'none' });
  J.row(330 - STRIP_Y);
  couple(J, 'B');
  for (let i = 0; i < 3; i++) bearer(J, i, 'B');
  J.row(660 - STRIP_Y);
  bearer(J, 2, 'A', { only: 'head', head: 'fwd' });
  J.row(760 - STRIP_Y);
  bearer(J, 2, 'A', { only: 'head', head: 'back' });
}
const FIG_ROWS = [{ y0: 0, wallY: STRIP_Y, h: 330 }, { y0: 330, wallY: STRIP_Y, h: 330 }, { y0: 660, wallY: STRIP_Y, h: 100 }, { y0: 760, wallY: STRIP_Y, h: 100 }];

/** the artist's snapped-string grid in red ochre */
function gridLines(ctx, x0, x1, y0, y1, g, ax, ay, alpha, seed) {
  ctx.save();
  ctx.strokeStyle = '#b4432a';
  ctx.lineCap = 'butt';
  const seg = (xa, ya, xb, yb, i) => {
    const len = Math.hypot(xb - xa, yb - ya), n = Math.max(1, Math.round(len / 34));
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n;
      ctx.globalAlpha = alpha * (0.35 + 0.65 * K.noise1(k * 0.9 + i * 3.1, seed + i));
      ctx.lineWidth = 0.9 + 0.5 * K.noise1(k * 0.6, seed + i + 50);
      ctx.beginPath();
      ctx.moveTo(xa + (xb - xa) * u0, ya + (yb - ya) * u0);
      ctx.lineTo(xa + (xb - xa) * u1, ya + (yb - ya) * u1);
      ctx.stroke();
    }
  };
  let i = 0;
  for (let x = ax + Math.ceil((x0 - ax) / g) * g; x <= x1 + 1e-6; x += g) seg(x, y0, x, y1, i++);
  for (let y = ay - Math.floor((ay - y0) / g) * g; y <= y1 + 1e-6; y += g) seg(x0, y, x1, y, i++);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ the scene
export default {
  id: 2, key: 'egypt', title: TITLES[2], heroT: 3.0,
  profile: [[0, 0], [2.0, 0.46], [T_ON, 0.5], [T_OFF, 0.5], [4.2, 0.56], [6, 1]],

  act(t, p) {
    applyAct(t, p);
  },
  camera(t) {
    const k = K.smoothstep(2.05, 2.6, t) * (1 - K.smoothstep(T_OFF, 4.3, t));
    return k > 0 ? { zoom: 1 + 0.12 * k, dy: 38 * k } : null;
  },

  async init() {
    const T = TITLES[2];
    // ---------------------------------------------------------------- weathering textures (anchored to the wall)
    const flake = K.layer(1000, 1000, 1, (ctx) => {
      // crisp-edged flecks of lost paint, clustered where the wall has been rubbed …
      ctx.drawImage(K.noiseLayer({ scale: 9, oct: 2, seed: 41, color: '#ffffff', lo: 0.675, hi: 0.705, alpha: 1, res: 1 }), 0, 0, 1000, 1000);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(K.noiseLayer({ scale: 170, oct: 4, seed: 42, color: '#ffffff', lo: 0.53, hi: 0.68, alpha: 1, res: 0.25 }), 0, 0, 1000, 1000);
      ctx.globalCompositeOperation = 'source-over';
      // … and sparse pin-holes everywhere
      ctx.drawImage(K.noiseLayer({ scale: 5, oct: 2, seed: 47, color: '#ffffff', lo: 0.785, hi: 0.81, alpha: 0.9, res: 1 }), 0, 0, 1000, 1000);
      K.grain(ctx, 0, 0, 1000, 1000, { color: '#ffffff', alpha: 0.5, seed: 43, size: 1.4, density: 0.1 });
      // go easy on the inscriptions so they stay legible
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 76, 1000, 62);
      ctx.fillRect(456, 140, 88, 312);
    });
    const mottleD = K.noiseLayer({ scale: 70, oct: 4, seed: 44, color: '#3a2412', lo: 0.45, hi: 0.9, alpha: 0.2, res: 0.5 });
    const mottleL = K.layer(1000, 1000, 0.5, (ctx) => {
      ctx.drawImage(K.noiseLayer({ scale: 44, oct: 4, seed: 45, color: '#fff3d6', lo: 0.5, hi: 0.9, alpha: 0.15, res: 0.5 }), 0, 0, 1000, 1000);
      ctx.drawImage(K.noiseLayer({ scale: 60, oct: 3, seed: 46, color: '#fff3d6', lo: 0.52, hi: 0.85, alpha: 0.1, res: 0.5, stretch: [0.14, 1.3] }), 0, 0, 1000, 1000);
    });
    const weather = (sheet, rows) => {
      const blit = (ctx, lay, mode, alpha) => {
        ctx.globalCompositeOperation = mode;
        ctx.globalAlpha = alpha;
        for (const r of rows) ctx.drawImage(lay, 0, (r.wallY / 1000) * lay.height, lay.width, (r.h / 1000) * lay.height, 0, r.y0, 1000, r.h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      };
      const pc = sheet.paint.getContext('2d');
      blit(pc, mottleD, 'source-atop', 1);
      blit(pc, mottleL, 'source-atop', 1);
      blit(pc, flake, 'destination-out', 1);
      const lc = sheet.lines.getContext('2d');
      lc.setTransform(RES, 0, 0, RES, 0, 0);
      blit(lc, flake, 'source-over', 0.9);
    };

    // ---------------------------------------------------------------- plaster with the preliminary grids
    const plaster = K.layer(1000, 1000, RES, (ctx) => {
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 1000, [[0, '#e2d3ad'], [0.5, '#e9dcba'], [1, '#dfcfa9']]);
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.drawImage(K.noiseLayer({ scale: 380, oct: 4, seed: 21, color: '#f7eed4', lo: 0.45, hi: 0.8, alpha: 0.7, res: 0.25 }), 0, 0, 1000, 1000);
      ctx.drawImage(K.noiseLayer({ scale: 260, oct: 4, seed: 22, color: '#b99a66', lo: 0.5, hi: 0.86, alpha: 0.42, res: 0.25 }), 0, 0, 1000, 1000);
      ctx.drawImage(K.noiseLayer({ scale: 50, oct: 4, seed: 23, color: '#a98a5a', lo: 0.5, hi: 0.92, alpha: 0.22, res: 0.5 }), 0, 0, 1000, 1000);
      ctx.drawImage(K.noiseLayer({ scale: 150, oct: 3, seed: 24, color: '#fff8e2', lo: 0.55, hi: 0.82, alpha: 0.3, res: 0.5, stretch: [0.12, 1.4] }), 0, 0, 1000, 1000);
      K.fibers(ctx, 1000, 1000, { n: 600, seed: 25, color: '#9a7b4a', alpha: 0.22, len: [3, 9], width: 0.8, curl: 0.2 });
      K.grain(ctx, 0, 0, 1000, 1000, { color: '#5a4020', alpha: 0.1, seed: 26, size: 1 });
      K.grain(ctx, 0, 0, 1000, 1000, { color: '#fffaf0', alpha: 0.12, seed: 27, size: 1.5, density: 0.5 });
      // each register has its own module: the nobles are drawn larger than their servants
      gridLines(ctx, 0, 322, 140, REG_Y, G_NOB, 195, REG_Y, 0.2, 61);
      gridLines(ctx, 325, 1000, 140, REG_Y, G_UP, 10, REG_Y, 0.2, 62);
      gridLines(ctx, 0, 1000, REG_Y + 10, ROAD, G_LANE, 10, ROAD, 0.42, 63);
    });

    // ---------------------------------------------------------------- paint + contour sheets
    const fp = freezePose();
    const glyphPose = Rig.rest({ x: 501, y: 426, s: 0.178 });
    const JS = makeJobs(), JF = makeJobs();
    buildStatic(JS, T, glyphPose, fp);
    buildFigures(JF);
    const sheetS = await renderSheet(JS, 1000, 1000, 201);
    const sheetF = await renderSheet(JF, 1000, 860, 202);
    weather(sheetS, [{ y0: 0, wallY: 0, h: 1000 }]);
    weather(sheetF, FIG_ROWS);

    const stamp = (ctx, sheet, sy, h, dy) => {
      ctx.globalAlpha = 0.965;
      ctx.drawImage(sheet.paint, 0, sy * RES, 1000 * RES, h * RES, 0, dy, 1000, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(sheet.lines, 0, sy * RES, 1000 * RES, h * RES, 0, dy, 1000, h);
      ctx.globalCompositeOperation = 'source-over';
    };
    const wallBase = K.layer(1000, 1000, RES, (ctx) => {
      K.put(ctx, plaster);
      stamp(ctx, sheetS, 0, 1000, 0);
    });
    const strip = (draw) => K.layer(1000, STRIP_H, RES, (ctx) => {
      ctx.drawImage(wallBase, 0, STRIP_Y * RES, 1000 * RES, STRIP_H * RES, 0, 0, 1000, STRIP_H);
      draw(ctx);
    });
    const wallA = K.layer(1000, 1000, RES, (ctx) => {
      K.put(ctx, wallBase);
      stamp(ctx, sheetF, 0, 330, STRIP_Y);
      stamp(ctx, sheetF, 660, 100, STRIP_Y);
    });
    const regB = strip((ctx) => stamp(ctx, sheetF, 330, 330, 0));
    const regC = strip((ctx) => {
      stamp(ctx, sheetF, 0, 330, 0);
      stamp(ctx, sheetF, 760, 100, 0);
    });

    // ---------------------------------------------------------------- cracks, losses, grime: over everything
    const over = K.layer(1000, 1000, RES, (ctx) => {
      K.cracks(ctx, 1000, 1000, { n: 7, seed: 31, color: '#3b2a18', alpha: 0.55, width: 1.15, len: 300, branch: 0.6, wander: 0.5 });
      K.cracks(ctx, 1000, 1000, { n: 10, seed: 32, color: '#fff8e4', alpha: 0.3, width: 0.8, len: 130, branch: 0.3 });
      const mudTex = K.noiseLayer({ scale: 16, oct: 3, seed: 33, color: '#4e3a22', lo: 0.4, hi: 0.9, alpha: 0.5, res: 0.5 });
      const chips = [[965, 950, 62, 50], [24, 20, 52, 32], [150, 642, 30, 22], [912, 606, 16, 21], [300, 724, 12, 9], [716, 322, 12, 16], [652, 880, 17, 9], [432, 25, 14, 17], [386, 783, 8, 5.5]];
      const r = K.rng(35);
      for (let i = 0; i < 22; i++) {
        const x = r.range(10, 990), y = r.range(10, 990), rad = r.range(2.5, 6.5);
        if ((y > 70 && y < 142) || (x > 450 && x < 550 && y > 140 && y < 452) || (x > 335 && x < 675 && y > 465 && y < 800) || (y > 145 && y < 265 && (x < 290 || x > 560))) continue; // keep faces, hands and the frozen figure whole
        chips.push([x, y, rad * r.range(0.8, 1.5), rad]);
      }
      chips.forEach(([cx, cy, rx, ry], i) => {
        const poly = K.jitter(K.ellipsePts(cx, cy, rx, ry, 30), Math.min(rx, ry) * 0.34, 0.09 + 0.6 / Math.max(rx, 8), 70 + i);
        ctx.save();
        K.path(ctx, poly, true);
        ctx.clip();
        ctx.fillStyle = '#4d3a24';
        ctx.fillRect(cx - rx * 1.6, cy - ry * 1.6, rx * 3.2, ry * 3.2);
        ctx.translate(1.8, 2.4);
        K.fillPoly(ctx, poly, C.mud);
        ctx.translate(-1.8, -2.4);
        ctx.drawImage(mudTex, 0, 0, 1000, 1000);
        // chopped straw in the mud render
        const q = K.rng(90 + i);
        ctx.lineCap = 'round';
        for (let k = 0; k < rx * ry * 0.09 + 4; k++) {
          const x = cx + q.range(-rx, rx), y = cy + q.range(-ry, ry), a = q.range(0, Math.PI), len = q.range(2, 7);
          ctx.strokeStyle = q() < 0.7 ? 'rgba(214,190,134,0.8)' : 'rgba(60,42,22,0.7)';
          ctx.lineWidth = q.range(0.5, 1.1);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.5);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,248,226,0.5)';
        ctx.lineWidth = 0.9;
        K.path(ctx, poly, true);
        ctx.stroke();
      });
      ctx.drawImage(K.noiseLayer({ scale: 240, oct: 4, seed: 36, color: '#4a3216', lo: 0.52, hi: 0.9, alpha: 0.16, res: 0.25 }), 0, 0, 1000, 1000);
      K.vignette(ctx, 1000, 1000, 0.26, '#3a2810', 0.6);
    });

    // ---------------------------------------------------------------- the grid that lights up round the frozen figure
    const gridLit = K.layer(360, 360, RES, (ctx) => {
      ctx.translate(-320, -450);
      const c1 = 'rgba(196,48,26,1)', c0 = 'rgba(196,48,26,0)';
      ctx.lineWidth = 1.3;
      for (let x = 350; x <= 650; x += G_LANE) {
        ctx.strokeStyle = K.linGrad(ctx, 0, REG_Y + 10, 0, ROAD, [[0, c0], [0.07, c1], [1, c1]]);
        K.path(ctx, [[x, REG_Y + 10], [x, ROAD]]);
        ctx.stroke();
      }
      for (let y = 480; y < ROAD; y += G_LANE) {
        ctx.strokeStyle = K.linGrad(ctx, 326, 0, 674, 0, [[0, c0], [0.07, c1], [0.93, c1], [1, c0]]);
        K.path(ctx, [[326, y], [674, y]]);
        ctx.stroke();
      }
    });

    L = { wallA, regB, regC, over, gridLit, flake, mottleD, buf: K.makeCanvas(412, 440), bufRes: 1.25 };
  },

  render(ctx, t, env) {
    const { pose } = env;
    K.put(ctx, L.wallA);
    if (t >= T_ON && t < T_OFF) ctx.drawImage(L.regB, 0, STRIP_Y, 1000, STRIP_H); // already facing it, arms raised
    else if (t >= T_LOOK) ctx.drawImage(L.regC, 0, STRIP_Y, 1000, STRIP_H); // the last bearer looks after it

    // the canon grid lights up for the hold
    const lit = K.prog(t, T_ON, 0.1) * (1 - K.smoothstep(T_OFF, T_OFF + 0.45, t));
    if (lit > 0.003) {
      ctx.save();
      ctx.globalAlpha = 0.5 * lit;
      ctx.fillStyle = K.radGrad(ctx, 500, 640, 60, 340, [[0, 'rgba(255,246,218,0.62)'], [0.6, 'rgba(255,246,218,0.3)'], [1, 'rgba(255,246,218,0)']]);
      ctx.fillRect(160, 462, 680, 338);
      ctx.globalAlpha = Math.min(1, lit * (1 + 0.25 * env.Beat.hit(t, T_ON, 5)));
      ctx.drawImage(L.gridLit, 320, 450, 360, 360);
      ctx.restore();
    }

    if (pose) {
      const R = L.bufRes, buf = L.buf, bw = buf.width / R, bh = buf.height / R;
      const bx = pose.x - bw / 2, by = pose.y - bh + 14;
      const b = buf.getContext('2d');
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.globalCompositeOperation = 'source-over';
      b.clearRect(0, 0, buf.width, buf.height);
      b.setTransform(R, 0, 0, R, -bx * R, -by * R);
      paintPelican(b, pose, { k: poseK(t) });
      // same tempera, same wall: uneven paint, flaked by the same mask as everything else
      b.globalCompositeOperation = 'source-atop';
      b.drawImage(L.mottleD, 0, 0, 1000, 1000);
      b.globalCompositeOperation = 'destination-out';
      b.drawImage(L.flake, 0, 0, 1000, 1000);
      ctx.drawImage(buf, bx, by, bw, bh);
      if (lit > 0.003) {
        // the squares show through the paint: it fits them exactly
        ctx.save();
        ctx.globalAlpha = 0.3 * lit;
        ctx.drawImage(L.gridLit, 320, 450, 360, 360);
        ctx.restore();
      }
    }
    K.put(ctx, L.over);
  },
};
