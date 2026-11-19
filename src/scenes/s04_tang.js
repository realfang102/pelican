// Section 4 — Tang Dynasty Baimiao Line Drawing (c. 750, ink on silk) — "Wu's drapery in the wind" 吳帶當風
// Plain-line figure painting in the manner attributed to Wu Daozi (think of the Eighty-Seven Immortals scroll):
// a celestial procession walks a balustraded bridge above clouds and lotus — banner bearers, a lady with a tray of
// peaches, a pipa player, an immortal lord under a floating canopy — and has left a pelican-sized place in the line.
// On the downbeat of bar 2 the pelican's sashes unfurl into long rippling streamers; a beat later every sash,
// banner, tassel, beard and wisp of incense in the procession lifts in the same wind.
//
// Technique (shared ink toolkit K.ink, kept strictly to baimiao): ink OUTLINE only, no wash but a breath of pale ink
// in the hair. Every static line is generated as a long smooth curve (Catmull-Rom) with its own pressure profile
// (orchid-leaf, nail-head, iron-wire), hidden-line-clipped against the shapes in front of it, and baked in ONE
// p5.brush pass ('inkFine', batched by tone). Everything the wind moves is drawn per frame with fixed seeds as
// twisting two-edged ribbons; overlaps are resolved by knocking shapes out with the silk itself (a pattern fill of
// the ground), so lines behind a sash, a figure or the bird never show through.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const I = K.ink;
const GROUND = '#c5ac7c';
const RES = 1.6;
const INK = I.TONES.jiao;
const PI = Math.PI, TAU = Math.PI * 2;
let L = null;

// ------------------------------------------------------------------------------------------- small geometry
const lerpP = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rev = (a) => a.slice().reverse();
const bboxOf = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1 };
};
const inPoly = (x, y, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** n points evenly spaced along a polyline */
function resN(pts, n) {
  const Ls = K.arcLen(pts), tot = Ls[Ls.length - 1] || 1, out = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * tot;
    while (j < Ls.length - 1 && Ls[j] < s) j++;
    out.push(lerpP(pts[j - 1], pts[j], (s - Ls[j - 1]) / (Ls[j] - Ls[j - 1] || 1)));
  }
  return out;
}
const circ = (x, y, rx, ry = rx, n = 20, rot = 0) => {
  const p = K.ellipsePts(x, y, rx, ry, n, rot);
  p.push(p[0].slice());
  return p;
};
const seg = (a, b, seed = 1, amp = 0.45) => K.jitter(K.resample([a, b], 9), amp, 0.02, seed);
const ap = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
const seedOf = (name) => {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973;
  return h;
};

// ------------------------------------------------------------------------------------------- the line drawing
// A drawing is a back-to-front list of brush lines and opaque shapes. A shape hides every line drawn before it
// (hidden-line removal is done on the polylines, so the whole picture still bakes in one pass, one colour at a time).
// Width profiles along a stroke (fraction of the style's full width). p5.brush stamps grow with pressure², so the
// brush is given sqrt(profile); an 'inkFine' stamp is 0.36 × weight units across.
const PR = {
  orchid: (u) => 0.3 + 0.7 * Math.pow(Math.sin(PI * Math.pow(u, 0.8)), 0.7), // thin entry, swelling belly, long thin exit
  nail: (u) => (1 - 0.3 * K.smoothstep(0.02, 0.14, u)) * (1 - 0.6 * Math.pow(u, 1.7)), // nail head, rat tail
  iron: () => 0.92,
  soft: (u) => 0.6 + 0.4 * Math.sin(PI * u),
  hair: (u) => 1 - 0.5 * u,
  tail: (u) => 0.35 + 0.65 * Math.sin(PI * Math.pow(u, 0.5)) * (1 - 0.45 * u),
  curl: (u) => 1 - 0.6 * u,
};
const TIP = 0.36;
const STYLE = {
  contour: { tone: 'jiao', w: 2.25, pr: 'orchid', step: 6 },
  robe: { tone: 'jiao', w: 1.75, pr: 'orchid', step: 5 },
  fold: { tone: 'nong', w: 1.3, pr: 'nail', step: 6 },
  wire: { tone: 'nong', w: 1.2, pr: 'iron', step: 6 },
  fine: { tone: 'jiao', w: 1.15, pr: 'soft', step: 2.2 },
  hair: { tone: 'nong', w: 0.9, pr: 'hair', step: 2.6 },
  far: { tone: 'zhong', w: 1.15, pr: 'iron', step: 7 },
  cloud: { tone: 'zhong', w: 1.4, pr: 'tail', step: 3.4 },
  pond: { tone: 'nong', w: 1.4, pr: 'orchid', step: 4 },
};
function makeDrawing() {
  const strokes = [], masks = [], fills = [];
  let z = 0;
  return {
    strokes, masks, fills,
    /** an opaque shape: hides every line drawn before it; breath > 0 leaves a pale ink tone inside (hair) */
    mask(poly, breath = 0) {
      z++;
      masks.push({ z, poly: poly.length > 90 ? poly.filter((_, i) => i % 2 === 0) : poly, bb: bboxOf(poly) });
      fills.push({ poly, breath });
      return poly;
    },
    dot(p, r) {
      fills.push({ dot: p, r });
    },
    line(pts, style = 'fold', o = {}) {
      if (pts.length > 1) strokes.push({ z, pts, style, o });
    },
  };
}
/** clip every line against the shapes in front of it → visible runs of [x, y, pressure] */
function resolve(D) {
  const out = [];
  for (const s of D.strokes) {
    const st = STYLE[s.style], prf = PR[s.o.pr ?? st.pr];
    const pts = K.resample(s.pts, 2.5), Ls = K.arcLen(pts), tot = Ls[Ls.length - 1] || 1;
    const P = pts.map((p, i) => [p[0], p[1], Math.sqrt(prf(Ls[i] / tot))]);
    const bb = bboxOf(pts), cand = [];
    for (const m of D.masks) if (m.z > s.z && m.bb.x1 >= bb.x0 && m.bb.x0 <= bb.x1 && m.bb.y1 >= bb.y0 && m.bb.y0 <= bb.y1) cand.push(m);
    let runs;
    if (!cand.length) runs = [P];
    else {
      const hidden = (x, y) => {
        for (const m of cand) if (x >= m.bb.x0 && x <= m.bb.x1 && y >= m.bb.y0 && y <= m.bb.y1 && inPoly(x, y, m.poly)) return true;
        return false;
      };
      runs = [];
      let cur = null, prev = null, prevHid = false;
      for (const p of P) {
        const h = hidden(p[0], p[1]);
        if (prev && h !== prevHid) {
          let a = prev, b = p;
          for (let it = 0; it < 5; it++) {
            const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
            if (hidden(m[0], m[1]) === prevHid) a = m;
            else b = m;
          }
          if (prevHid) cur = [b];
          else {
            cur.push(a);
            runs.push(cur);
            cur = null;
          }
        }
        if (!h) {
          if (!cur) cur = [];
          cur.push(p);
        }
        prev = p;
        prevHid = h;
      }
      if (cur) runs.push(cur);
    }
    for (const run of runs) if (run.length >= 2) out.push({ pts: run, tone: s.o.tone ?? st.tone, w: s.o.w ?? st.w, step: st.step });
  }
  return out;
}
/** hand the visible runs to p5.brush, grouped by tone */
function emit(q, runs) {
  let count = 0;
  for (const s of runs) {
    const P = s.pts, Ls = [0];
    for (let i = 1; i < P.length; i++) Ls.push(Ls[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const tot = Ls[Ls.length - 1];
    if (tot < 0.9) continue;
    const n = Math.max(3, Math.min(64, Math.round(tot / s.step) + 1)), pts = [];
    let j = 1;
    for (let i = 0; i < n; i++) {
      const d = (i / (n - 1)) * tot;
      while (j < Ls.length - 1 && Ls[j] < d) j++;
      const f = (d - Ls[j - 1]) / (Ls[j] - Ls[j - 1] || 1);
      pts.push([K.lerp(P[j - 1][0], P[j][0], f), K.lerp(P[j - 1][1], P[j][1], f), K.lerp(P[j - 1][2], P[j][2], f)]);
    }
    q.add('inkFine', s.tone, { w: s.w / TIP, pts, curve: 0.5 });
    count++;
  }
  return count;
}

/** long drapery lines between two guide curves (both run top → hem): they gather at the top and fan out below */
function foldLines(A, B, n, o = {}) {
  const N = 41, a = resN(A, N), b = resN(B, N), r = K.rng(Math.round(o.seed ?? 1) + 1);
  const s0 = o.s0 ?? 0.07, s1 = o.s1 ?? 0.93, focus = o.focus ?? 0.5, gather = o.gather ?? 0.3;
  const lines = [], ends = [];
  for (let i = 0; i < n; i++) {
    const s = K.lerp(s0, s1, (i + 0.5 + r.range(-0.36, 0.36)) / n);
    const reach = !o.hem || r() < 0.6 || i === 0 || i === n - 1;
    const u0 = (o.top ?? 0.03) + r() * (o.topVar ?? 0.2) + (reach ? 0 : r() * 0.2), u1 = (o.end ?? 1) - r() * (o.endVar ?? 0) - (reach ? 0 : r.range(0.07, 0.3));
    const i0 = Math.round(u0 * (N - 1)), i1 = Math.min(N - 1, Math.max(i0 + 3, Math.round(u1 * (N - 1))));
    const pts = [];
    for (let k = i0; k <= i1; k++) {
      if ((k - i0) % 2 && k !== i1) continue;
      const u = k / (N - 1);
      pts.push(lerpP(a[k], b[k], focus + (s - focus) * (1 - gather * (1 - u) * (1 - u))));
    }
    lines.push(K.catmull(pts, 3));
    if (reach) ends.push({ s, p: pts[pts.length - 1] });
  }
  return { lines, ends };
}
/** the rippling hem: it dips between the folds and tucks up where each fold ends */
function hemLine(A, B, ends, dip) {
  const a = A[A.length - 1], b = B[B.length - 1], E = ends.slice().sort((p, q) => p.s - q.s), pts = [a];
  let ps = 0;
  for (const e of E) {
    const v = lerpP(a, b, (ps + e.s) / 2);
    pts.push([v[0], v[1] + dip], e.p);
    ps = e.s;
  }
  const v = lerpP(a, b, (ps + 1) / 2);
  pts.push([v[0], v[1] + dip], b);
  return K.catmull(pts, 4);
}

// ------------------------------------------------------------------------------------------- heads
// Head space: centre of the face at (0,0), facing +x in three-quarter view, about 26 × 37 units before scaling.
function headOf(D, M, out, cx, cy, s, o) {
  const look = o.look ?? 1, tl = (o.tilt ?? 0) * look, ct = Math.cos(tl), sn = Math.sin(tl);
  const Hp = (p) => [cx + s * (p[0] * look * ct - p[1] * sn), cy + s * (p[0] * look * sn + p[1] * ct)];
  const HC = (pts, sg = 6) => K.catmull(pts.map(Hp), sg);
  const loop = (pts, sg = 6) => {
    const c = K.catmull(pts.map(Hp), sg, true);
    c.push(c[0].slice());
    return c;
  };
  const ell = (x, y, rx, ry, rot = 0, n = 26) => circ(x, y, rx, ry, n, rot).map(Hp);
  const HM = (poly, breath) => {
    out.heads.push(poly);
    return M(poly, breath);
  };
  const hair = o.hair;
  let tie = [-12, -24]; // where the hair ribbons are tied
  if (o.lord) {
    D.line(ell(1, -3, 35, 35, 0, 60), 'wire', { w: 1.69 });
    D.line(ell(1, -3, 31.5, 31.5, 0, 54), 'hair', { pr: 'iron' });
  }
  // --- what sits on top of the skull
  if (hair === 'tall') {
    const knot = loop([[-9, -18], [-13, -30], [-11, -44], [-4, -52], [4, -50], [8, -39], [6.5, -27], [3.5, -19]]);
    HM(knot, 0.5);
    D.line(knot, 'robe', { w: 1.62, pr: 'soft' });
    D.line(HC([[-6, -21], [-9.5, -32], [-7, -44], [-2, -49]]), 'hair');
    D.line(HC([[-2, -21], [-4.5, -33], [-1.5, -43], [3, -46]]), 'hair');
    D.line(HC([[2.5, -21], [2.5, -32], [4.5, -40]]), 'hair');
    D.line(HC([[-10.5, -22], [-3, -25.5], [5.5, -22]]), 'fine');
    D.line(HC([[-11.5, -26], [-3, -29.5], [6.5, -26]]), 'fine');
    // a pin with a bead, and a flower at the front of the knot
    D.line([Hp([6, -30]), Hp([15.5, -36.5])], 'fine', { pr: 'iron' });
    D.line(ell(17, -37.5, 1.9, 1.9, 0, 10), 'fine');
    for (let i = 0; i < 5; i++) D.line(ell(7.5 + Math.cos(i * 1.257) * 2.6, -20.5 + Math.sin(i * 1.257) * 2.6, 1.5, 1.5, 0, 8), 'hair', { pr: 'iron' });
    tie = [-11, -26];
  } else if (hair === 'loops') {
    for (const [x, y, rx, ry, rot] of [[-8, -43, 6.4, 16.5, -0.2], [5.5, -42, 6, 15.5, 0.2]]) {
      const o1 = ell(x, y, rx, ry, rot, 30);
      HM(o1, 0.5);
      D.line(o1, 'robe', { w: 1.56, pr: 'soft' });
      D.line(ell(x, y, rx - 1.8, ry - 2.2, rot, 26), 'hair', { pr: 'iron' });
      const i1 = ell(x, y, rx - 3.6, ry - 4.4, rot, 22);
      HM(i1, 0);
      D.line(i1, 'fine', { pr: 'iron', w: 1.12 });
    }
    const bun = loop([[-8, -18], [-10, -26], [-4, -31], [3, -30], [6.5, -24], [4, -18]]);
    HM(bun, 0.5);
    D.line(bun, 'robe', { w: 1.56, pr: 'soft' });
    D.line(HC([[-9, -23], [-2, -26.5], [5.5, -23]]), 'fine');
    for (let i = 0; i < 5; i++) D.line(ell(-1.5 + Math.cos(i * 1.257) * 2.5, -30 + Math.sin(i * 1.257) * 2.5, 1.4, 1.4, 0, 8), 'hair', { pr: 'iron' });
    tie = [-11, -27];
  } else if (hair === 'buns') {
    for (const [x, y, R] of [[-10.5, -24, 8.4], [6.5, -25.5, 7.6]]) {
      const c = ell(x, y, R, R * 0.95, 0, 26);
      HM(c, 0.5);
      D.line(c, 'robe', { w: 1.56, pr: 'soft' });
      const sp = [];
      for (let i = 0; i <= 16; i++) {
        const a = 1.6 + (i / 16) * 6.6, rad = R * (0.74 - 0.5 * (i / 16));
        sp.push(Hp([x + Math.cos(a) * rad, y + Math.sin(a) * rad]));
      }
      D.line(sp, 'hair', { pr: 'iron' });
    }
    tie = [-15, -19];
  } else if (hair === 'crown') {
    const cr = loop([[-8, -19], [-11, -31], [-7, -42], [-1, -46.5], [5, -42], [8.5, -31], [5.5, -19]]);
    HM(cr, 0);
    D.line(cr, 'robe', { w: 1.62, pr: 'soft' });
    D.line(HC([[-3.2, -21], [-4.2, -34], [-1, -45], [2.2, -34], [1.4, -21]]), 'fine');
    D.line(HC([[-8, -23], [-8.5, -34], [-5.5, -41]]), 'fine');
    D.line(HC([[5.5, -23], [6.5, -33], [3.5, -41]]), 'fine');
    D.line(HC([[-9.5, -22], [-1.5, -25.2], [6.5, -22]]), 'fine');
    D.line([Hp([-18, -29.5]), Hp([15.5, -33])], 'wire', { w: 1.62 });
    D.line(ell(-19.6, -29.3, 2.1, 2.1, 0, 10), 'fine');
    tie = [-17, -28];
  }
  // --- hair on the skull, or the gauze cap of an attendant
  if (hair === 'cap') {
    const cap = loop([[9, -13.5], [8.5, -19.5], [3, -24], [-3, -23.5], [-5.5, -30.5], [-11.5, -33], [-16.5, -27], [-17, -16], [-15.5, -6], [-13.5, 3.5], [-9.5, 8], [-8, -1], [-7, -8], [-3, -13], [3, -15.5]], 5);
    HM(cap, 0.62);
    D.line(HC([[9, -13.5], [8.5, -19.5], [3, -24], [-3, -23.5], [-5.5, -30.5], [-11.5, -33], [-16.5, -27], [-17, -16], [-15.5, -6], [-13.5, 3.5], [-9.5, 8]], 5), 'robe', { w: 1.69, pr: 'soft' });
    D.line(HC([[-3, -23.5], [-6, -17], [-12.5, -12.5]]), 'fine');
    D.line(HC([[8.5, -17.5], [2, -20], [-5, -19]]), 'hair');
    D.line(ell(-15.5, -2, 2.6, 3.2, 0, 12), 'fine');
    tie = [-15.5, 0];
  } else {
    const outer = [[8.5, -13.5], [6, -19], [-1, -22], [-9, -20], [-14.5, -13], [-16, -4], [-13.5, 4], [-9.5, 8]];
    HM(HC(outer).concat(HC([[-8, -1], [-7, -8], [-3, -13], [3, -15.5], [8.5, -13.5]])), 0.5);
    D.line(HC(outer), 'robe', { w: 1.62, pr: 'soft' });
    D.line(HC([[7, -15.5], [1, -19.5], [-6, -19.5], [-11, -15]]), 'hair');
    D.line(HC([[4, -15.5], [-2, -17.5], [-8, -15], [-12.5, -8]]), 'hair');
    D.line(HC([[-3, -13.5], [-8, -10.5], [-12.5, -3], [-12, 3]]), 'hair');
    D.line(HC([[-6.5, -8.5], [-10, -3], [-10.5, 4]]), 'hair');
  }
  // --- the face
  const faceC = HC([[8.5, -13.5], [11.6, -8], [12.7, -2], [12.3, 4], [10.5, 9.5], [6.6, 14], [1.6, 15.7], [-3.4, 13.6], [-7.4, 8.6], [-9, 3]]);
  const hairline = HC([[-9, 3], [-8, -1], [-7, -8], [-3, -13], [3, -15.5], [8.5, -13.5]]);
  HM(faceC.concat(hairline));
  D.line(faceC, 'robe', { w: 1.69, pr: 'soft' });
  D.line(hairline, 'fine', { w: 1.12 });
  D.line(HC([[-1.5, -6.2], [2.5, -8.3], [7, -7.4]], 5), 'fine', { pr: 'orchid', w: o.male ? 1.3 : 1.05 });
  D.line(HC([[9.3, -7.6], [11, -8.1], [12.2, -7.2]], 5), 'fine', { w: 1.12 });
  D.line(HC([[-0.3, -2.5], [3, -4.1], [6.7, -3.1]], 5), 'fine', { w: 1.5 });
  D.line(HC([[1, -2], [3.6, -1.5], [6, -2.6]], 5), 'hair', { pr: 'iron' });
  D.dot(Hp([3.7, -2.95]), 0.95 * s);
  D.line(HC([[9.5, -3.5], [10.8, -4.3], [12, -3.5]], 5), 'fine', { w: 1.31 });
  D.dot(Hp([10.9, -3.45]), 0.75 * s);
  D.line(HC([[8.7, -5.4], [10.3, -1], [11.8, 3], [10.5, 4.3], [8.9, 3.6]], 5), 'fine', { w: 1.19 });
  D.line(HC([[6.5, 8.3], [8.3, 7.6], [9.4, 8.1], [10.5, 7.6]], 5), 'fine', { w: 1.31 });
  D.line(HC([[7.2, 9.8], [8.7, 10.5], [9.9, 9.7]], 5), 'hair', { pr: 'iron' });
  if (o.male) D.line(HC(o.lord ? [[5.5, 6.4], [8.8, 5.8], [12.6, 8.6]] : [[6.3, 6.4], [8.8, 5.9], [11.6, 7.3]], 5), 'fine', { pr: 'hair', w: 1.38 });
  // long-lobed ear
  const ear = loop([[-8.6, -3.6], [-11, -1.5], [-11.5, 3], [-10, 6.8], [-8.6, 5], [-8.9, 0.5]], 4);
  HM(ear);
  D.line(ear, 'fine', { w: 1.12 });
  // --- what the wind will move
  const hs = out.seed * 10;
  if (hair === 'cap') {
    for (let i = 0; i < 2; i++) out.dyn.push({ layer: 'back', kind: 'band', at: Hp(tie), len: (46 - i * 6) * s, W: 4.6 * s, hang: 1.62 + i * 0.16, curl: 0.08, up: 0.3, droop: 0.5, lam: 52, amp: 0.8, speed: 13, ph: i * 2 + hs, tw: 62, seed: hs + 60 + i, lw: 1.3 });
  } else {
    for (let i = 0; i < 2; i++) out.dyn.push({ layer: 'back', kind: 'band', at: Hp(tie), len: (64 - i * 14) * s, W: 3.3 * s, hang: 1.6 + i * 0.2, curl: 0.12, up: 0.42 - i * 0.2, droop: 0.5, lam: 56, amp: 0.85, speed: 13.5, ph: i * 2.4 + hs, tw: 72, seed: hs + 60 + i, lw: 1.2 });
  }
  if (o.lord) {
    // a five-strand beard: it lifts in the wind like everything else
    const roots = [[10.2, 10.4], [8, 13.3], [5, 15.2], [2, 14.8], [-1, 13.2]];
    roots.forEach((p, i) => out.dyn.push({ layer: 'front', kind: 'line', at: Hp(p), len: (30 + 12 * Math.sin((i + 0.6) * 0.75)) * s, hang: 1.5 + i * 0.03, curl: 0.06, up: 0.05, droop: 0.5, lam: 44, amp: 0.55, speed: 12, ph: i * 0.8, seed: hs + 70 + i, lw: 1.05, taper: [0.02, 0.6] }));
  }
}

function hand(D, M, x, y, s, rot = 0) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  const T = (p) => [x + s * (p[0] * c - p[1] * sn), y + s * (p[0] * sn + p[1] * c)];
  const o = K.catmull([[0, 0], [5, -3], [10, -1.5], [11.5, 3], [9, 7], [3.5, 7.5], [-0.5, 4]].map(T), 5, true);
  o.push(o[0].slice());
  M(o);
  D.line(o, 'fine', { w: 1.38 });
  for (const yy of [1.2, 3.4, 5.6]) D.line(K.catmull([[4.5, yy], [7.5, yy + 0.5], [10.2, yy + 0.2]].map(T), 4), 'hair', { pr: 'iron' });
}
function staff(D, M, a, b, hw, seed) {
  const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy), nx = (-dy / m) * hw, ny = (dx / m) * hw;
  M([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
  D.line(seg([a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], seed), 'wire', { w: 1.56 });
  D.line(seg([a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], seed + 1), 'wire', { w: 1.56 });
}
function petalPoly(bx, by, len, wid, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const prof = [[0, 0], [0.22, 0.36], [0.5, 0.5], [0.78, 0.36], [1, 0]];
  const side = (sg) => K.catmull(prof.map(([u, h]) => [bx + c * u * len - s * sg * h * wid, by + s * u * len + c * sg * h * wid]), 5);
  const a = side(1), b = side(-1);
  return { a, b, poly: a.concat(rev(b)), tip: [bx + c * len, by + s * len] };
}
function petal(D, bx, by, len, wid, ang, style = 'pond', M = null) {
  const p = petalPoly(bx, by, len, wid, ang);
  (M ?? ((q) => D.mask(q)))(p.poly);
  D.line(p.a, style, { w: 1.56, pr: 'orchid' });
  D.line(p.b, style, { w: 1.56, pr: 'orchid' });
  D.line([[bx, by], lerpP([bx, by], p.tip, 0.72)], 'hair');
  return p;
}
/** an open lotus in profile: petals laid back to front */
function lotus(D, x, y, s, M = null) {
  const up = -PI / 2;
  const row = (angs, len, wid, dy) => {
    for (const a of angs) petal(D, x + Math.sin(a) * 4 * s, y + dy * s, len * s * (1 - 0.1 * Math.abs(a)), wid * s, up + a, 'pond', M);
  };
  row([-1.3, 1.3], 30, 13, 2);
  row([-0.95, 0.95, -0.5, 0.5, 0], 36, 15, 0);
  row([-0.72, 0.72, -0.28, 0.28], 28, 14, 3);
  row([0], 21, 15, 5);
}

// ------------------------------------------------------------------------------------------- one figure
// Local space: feet on (0,0), y up is negative, facing +x in three-quarter view, about 300 units to the top of the skull.
function figure(D, f, S) {
  const k = f.k ?? 1, lean = f.lean ?? 0, tr = f.train ?? 1, sl = f.sl ?? 1, r = K.rng(f.seed);
  const P = (p) => [f.x + k * (p[0] - lean * p[1]), f.y + k * p[1]];
  const C = (pts, sg = 8) => K.catmull(pts.map(P), sg);
  const SL = (p) => [p[0], p[1] > -204 ? -204 + (p[1] + 204) * sl : p[1]]; // sleeve length
  const out = { x: f.x, seed: f.seed, own: [], sleeves: [], heads: [], dyn: [] };
  const M = (poly, breath) => {
    out.own.push(poly);
    return D.mask(poly, breath);
  };
  const Ms = (poly) => {
    out.sleeves.push(poly);
    return M(poly);
  };

  // cloud-toe shoe under the front hem
  D.line(C([[51, -5], [60, -2.6], [69, -3.2], [73.5, -8.5], [70.5, -14], [65, -13], [65.5, -9]], 6), 'robe', { w: 1.62 });
  D.line(C([[55, -9.5], [61, -12.5], [66, -12.5]], 5), 'fold', { pr: 'soft' });

  // underskirt and its train
  {
    const A = C([[-50, -103], [-54, -78], [-61, -53], [-66 - 10 * tr, -31], [-72 - 28 * tr, -14.5], [-80 - 44 * tr, -6], [-86 - 54 * tr, -2]]);
    const B = C([[36, -103], [41, -78], [45, -52], [49, -28], [54, -11], [60, -3]]);
    const fl = foldLines(A, B, 13, { seed: r() * 999, top: 0.02, topVar: 0.3, end: 0.93, gather: 0.25, hem: true });
    const hm = hemLine(A, B, fl.ends, 2.8 * k);
    M(A.concat(hm, rev(B)));
    D.line(A, 'contour');
    D.line(B, 'contour');
    D.line(hm, 'robe', { pr: 'soft', w: 1.69 });
    for (const l of fl.lines) D.line(l, 'fold');
  }
  // over-robe: waist to knee, with its own rippling hem
  {
    const A = C([[-24, -206], [-31, -182], [-38, -152], [-45, -124], [-53, -104], [-64, -90]]);
    const B = C([[24, -206], [30, -182], [34, -152], [37, -124], [39, -106], [42, -94]]);
    const fl = foldLines(A, B, 10, { seed: r() * 999, top: 0.03, topVar: 0.25, end: 0.93, gather: 0.3, hem: true });
    const hm = hemLine(A, B, fl.ends, 3.2 * k);
    M(A.concat(hm, rev(B)));
    D.line(A, 'contour');
    D.line(B, 'contour');
    D.line(hm, 'robe', { pr: 'soft', w: 1.69 });
    for (const l of fl.lines) D.line(l, 'fold');
  }
  // the long front sash of the girdle: it shows below the sleeves, fringed at the end
  {
    const a = C([[5, -204], [4, -140], [6, -70], [7, -26]]), b = C([[17, -204], [18, -140], [20.5, -70], [22, -28]]);
    M(a.concat(rev(b)));
    D.line(a, 'robe', { w: 1.7 });
    D.line(b, 'robe', { w: 1.7 });
    D.line(C([[7, -26], [14, -22.5], [22, -28]], 5), 'robe', { w: 1.6, pr: 'soft' });
    D.line(C([[6.7, -38], [14, -35], [21.6, -40]], 5), 'fold', { pr: 'soft' });
    D.line(C([[6.5, -44], [14, -41], [21.3, -46]], 5), 'fold', { pr: 'soft' });
    D.line(C([[12, -200], [12.5, -120], [14, -48]]), 'fold');
  }
  // chest: crossed collar and the high waistband
  M(C([[-14, -249], [8, -253], [20, -243], [28, -229], [30, -213], [26, -203], [-22, -203], [-29, -224], [-25, -241]], 5));
  D.line(C([[12, -251], [21, -242], [28, -228], [30, -214]]), 'contour', { w: 2 });
  D.line(C([[-8, -251], [2, -239], [14, -225], [22, -214]]), 'robe');
  D.line(C([[-4, -252.5], [6, -240], [17, -227], [24.5, -217]]), 'fold', { pr: 'soft' });
  D.line(C([[10.5, -252], [8.5, -242], [5, -234]]), 'robe', { w: 1.5 });
  D.line(C([[13, -250.5], [11.5, -242], [8.5, -235.5]]), 'fold', { pr: 'soft' });
  D.line(C([[29.5, -214], [12, -209.5], [-6, -211]]), 'fold', { pr: 'soft' });
  D.line(C([[28, -207.5], [12, -203.5], [-6, -205]]), 'fold', { pr: 'soft' });

  // far sleeve: a strip of it hangs beyond the near one
  {
    const o1 = C([[40, -217], [54, -214], [64, -202], [70, -176], [71, -142], [65, -113], [56, -101], [48, -104]].map(SL));
    const i1 = C([[48, -104], [42, -118], [38, -150], [34, -190], [36, -214]].map(SL));
    Ms(o1.concat(i1));
    D.line(o1, 'contour');
    D.line(C([[49, -212], [57, -205], [63.5, -180], [64.5, -146], [60, -117], [53, -107]].map(SL)), 'fold', { pr: 'soft' });
    D.line(C([[47, -210], [54.5, -186], [56, -150], [52.5, -122]].map(SL)), 'fold');
  }

  // --- what is carried behind the near sleeve
  const grip = P([45, -214]);
  if (f.attr === 'banner') {
    const top = [grip[0] + 11 * k, f.top], foot = [grip[0] - 5 * k, f.y - 3];
    staff(D, M, foot, top, 1.9 * k, f.seed);
    const [tx, ty] = top;
    D.line(K.catmull([[tx, ty + 3], [tx - 0.5, ty - 11], [tx - 8, ty - 19], [tx - 17.5, ty - 14], [tx - 18.5, ty - 4.5]], 7), 'contour', { w: 2.25, pr: 'curl' });
    D.line(circ(tx, ty + 7, 3.2, 3.2, 12), 'fine');
    D.line(circ(tx - 18.5, ty - 2, 2.5, 2.5, 10), 'fine');
    S.banners.push({
      at: [tx - 18.5, ty + 0.5], x: tx, len: 176, W: 25, hang: PI / 2, curl: 0.03, up: 0.1, droop: 0.34, pw: 1.3, lam: 128, amp: 0.62, speed: 9.5, ph: f.seed, seed: f.seed * 10,
      linger: !!f.linger,
      side: { len: 150, W: 4.6, hang: PI / 2, curl: 0.05, up: 0.18, droop: 0.42, lam: 88, amp: 0.8, speed: 12.5, tw: 104, lw: 1.3 },
    });
  } else if (f.attr === 'lotus') {
    const st = C([[45, -212], [51, -250], [59, -290], [61, -306]]);
    const rp = K.ribbonPoly(st, 3.2 * k), h = rp.length / 2;
    M(rp);
    D.line(rp.slice(0, h), 'wire');
    D.line(rp.slice(h), 'wire');
    const c = P([62, -310]);
    lotus(D, c[0], c[1], 0.84 * k, M);
  } else if (f.attr === 'tablet') {
    const tb = K.catmull([[40.5, -206], [39.5, -262], [42, -267.5], [47.5, -267.5], [50, -262], [50.5, -206]].map(P), 5, true);
    tb.push(tb[0].slice());
    M(tb);
    D.line(tb, 'robe', { w: 1.69, pr: 'soft' });
  }

  // near sleeve: the great hanging sleeve, folds running from the forearm to its tip
  {
    const back = C([[-16, -243], [-25, -234], [-28, -213], [-20, -187], [-6, -159], [8, -131], [23, -107], [38, -97]].map(SL));
    const cuff = C([[41, -217], [52, -205], [58, -177], [57, -142], [49, -112], [38, -97]].map(SL));
    const top = C([[-16, -243], [0, -242], [9, -226], [11, -207], [26, -213], [41, -217]]);
    Ms(back.concat(rev(cuff), rev(top)));
    D.line(back, 'contour');
    D.line(cuff, 'contour');
    D.line(C([[0, -242], [9, -226], [11, -207]]), 'robe');
    D.line(C([[11, -207], [26, -213], [41, -217]]), 'robe');
    const sA = C([[-20, -187], [-6, -159], [8, -131], [23, -107], [38, -97]].map(SL));
    for (const l of foldLines(sA, cuff, 5, { seed: r() * 999, s0: 0.16, s1: 0.8, top: 0.03, topVar: 0.1, end: 0.9, endVar: 0.3, gather: 0 }).lines) D.line(l, 'fold');
    D.line(foldLines(sA, cuff, 1, { s0: 0.9, s1: 0.9, top: 0, topVar: 0, end: 0.97, gather: 0 }).lines[0], 'fold', { pr: 'soft' });
    D.line(C([[38, -97], [33, -109], [34, -127], [39, -147]].map(SL)), 'fold', { pr: 'soft' });
    D.line(C([[-10, -240], [-17, -222], [-15, -203], [-7, -188]]), 'fold');
    D.line(C([[-3, -238], [-7, -221], [-1, -206]]), 'fold');
    D.line(C([[11, -207], [2, -202.5], [-7, -203.5]]), 'fold');
    D.line(C([[12, -205], [6, -197.5], [-1, -195.5]]), 'fold');
  }
  // shawl over the near shoulder (its two ends are left to the wind)
  {
    const o1 = C([[-21, -239], [-9, -246.5], [3, -239], [9.5, -223], [10, -208]]);
    const i1 = C([[-25, -230], [-13, -236.5], [-3, -229], [2.5, -215], [3, -205]]);
    Ms(o1.concat(rev(i1)));
    D.line(o1, 'robe');
    D.line(i1, 'robe');
    D.line(C([[-17, -238], [-7, -241], [0.5, -233], [5.5, -219]]), 'fold', { pr: 'soft' });
  }
  // neck
  M(C([[-3, -262], [12, -259], [12.5, -250], [5, -246], [-11, -246], [-8, -256]], 4));
  D.line(C([[11.5, -259], [11, -253], [12, -249]]), 'fine', { w: 1.5 });
  D.line(C([[-4, -262], [-8, -254], [-13, -247]]), 'fine', { w: 1.5 });
  D.line(C([[-1, -252], [4, -250.5], [9, -252]]), 'hair', { pr: 'iron' });
  // head
  const look = f.look ?? 1, hc = P([look > 0 ? 8 : 5, -272]);
  headOf(D, M, out, hc[0], hc[1], 1.1 * k, { look, tilt: f.tilt ?? 0, hair: f.hair, male: f.male, lord: f.lord });

  // --- what is carried in front
  if (f.attr === 'banner') {
    const h = P([40.5, -222]);
    hand(D, Ms, h[0], h[1], 1.0 * k, 0.1);
  } else if (f.attr === 'tray') {
    // a footed tray of the peaches of immortality
    const body = K.catmull([[30, -226], [35, -218], [45, -213.5], [59, -213.5], [69, -218], [74, -226], [52, -230.5]].map(P), 5, true);
    Ms(body);
    D.line(C([[30, -226], [35, -218], [45, -213.5], [59, -213.5], [69, -218], [74, -226]], 5), 'robe', { w: 1.69, pr: 'soft' });
    D.line(circ(52, -226, 22, 4.2, 30).map(P), 'fine', { pr: 'iron' });
    D.line(C([[46, -213.5], [45, -209.5], [59, -209.5], [58, -213.5]], 4), 'fine', { pr: 'iron' });
    for (const [lx, ly, a] of [[37, -229, PI + 0.55], [67, -229, -0.55]]) {
      const q = P([lx, ly]);
      petal(D, q[0], q[1], 12 * k, 5.5 * k, a, 'robe', Ms);
    }
    for (const [px, py] of [[52, -247], [43.5, -236], [60.5, -236]]) {
      const pc = K.catmull([[0, -11.5], [3.6, -8.6], [8.4, -2], [7, 5.6], [0, 8.4], [-7, 5.6], [-8.4, -2], [-3.6, -8.6]].map(([x, y]) => P([px + x, py + y])), 5, true);
      pc.push(pc[0].slice());
      Ms(pc);
      D.line(pc, 'robe', { w: 1.62, pr: 'soft' });
      D.line(C([[px + 0.5, py - 10.5], [px - 2.6, py - 3], [px - 1, py + 6]], 5), 'hair');
    }
  } else if (f.attr === 'pipa') {
    // a bent-necked pipa held across the sleeves
    const o = P([35, -168]), ph = 0.56, ax = [Math.sin(ph), -Math.cos(ph)], bx = [Math.cos(ph), Math.sin(ph)];
    const Q = (v, h) => [o[0] + k * (ax[0] * v + bx[0] * h), o[1] + k * (ax[1] * v + bx[1] * h)];
    const prof = [[-37, 0.5], [-34, 8.5], [-25, 16], [-11, 19.5], [5, 16.5], [19, 9.5], [29, 5], [38, 3.5], [62, 3]];
    const right = K.catmull(prof.map(([v, h]) => Q(v, h)), 6), left = K.catmull(prof.map(([v, h]) => Q(v, -h)), 6);
    const peg = K.catmull([Q(62, 3), Q(67.5, 2), Q(71, -6), Q(70, -19), Q(66.5, -22.5)], 5), peg2 = K.catmull([Q(62, -3), Q(64.5, -7), Q(64.5, -18), Q(66.5, -22.5)], 5);
    Ms(right.concat(peg, rev(peg2), rev(left)));
    D.line(rev(right), 'contour', { w: 2.06 });
    D.line(rev(left), 'contour', { w: 2.06 });
    D.line(peg, 'robe', { w: 1.62 });
    D.line(peg2, 'robe', { w: 1.62 });
    for (const v of [-10, -15.5]) D.line([Q(64.5, v + 1.5), Q(60, v), Q(75.5, v + 2.6)].slice(1), 'wire');
    for (const j of [-1.5, -0.5, 0.5, 1.5]) D.line(seg(Q(-22, j * 2.1), Q(62, j * 0.95), 3 + j, 0.2), 'hair', { pr: 'iron', w: 0.94 });
    D.line([Q(-23.5, -7.5), Q(-23.5, 7.5)], 'wire');
    D.line([Q(-21, -6.5), Q(-21, 6.5)], 'wire');
    D.line(K.catmull([Q(7, 7), Q(3, 10), Q(-1.5, 7.5)], 5), 'fine');
    D.line(K.catmull([Q(7, -7), Q(3, -10), Q(-1.5, -7.5)], 5), 'fine');
    D.line(K.catmull([Q(-4.5, -17.6), Q(-7.5, 0), Q(-4.5, 17.6)], 6), 'fine', { pr: 'iron' });
    D.line(K.catmull([Q(-14, -19), Q(-17, 0), Q(-14, 19)], 6), 'fine', { pr: 'iron' });
    const h1 = Q(-13, 1), h2 = Q(41, 6.5);
    hand(D, Ms, h1[0], h1[1], 0.95 * k, 0.75);
    hand(D, Ms, h2[0], h2[1], 0.9 * k, 2.5);
  } else if (f.attr === 'censer') {
    // long-handled censer; a thread of smoke rises from it
    const a = P([38, -213]), b = P([77, -221.5]);
    staff(D, Ms, a, b, 1.3 * k, 5);
    const cup = K.catmull([[73, -230], [75.5, -223], [81, -219.5], [89, -219.5], [94.5, -223], [97, -230]].map(P), 5);
    Ms(cup);
    D.line(cup, 'robe', { w: 1.62, pr: 'soft' });
    D.line([P([71, -230]), P([99, -230])], 'wire');
    D.line(C([[81, -219.5], [80, -215.5], [90, -215.5], [89, -219.5]], 4), 'fine', { pr: 'iron' });
    const sm = P([85, -231]);
    S.air.push({ kind: 'line', at: sm, x: sm[0], len: 78, hang: 1.5 * PI, curl: 0.3, drift: 1.1, up: 0.22, droop: 0.3, lam: 60, amp: 0.45, speed: 9, ph: 1.3, seed: 88, lw: 1.25, a: 0.72, taper: [0.1, 0.55] });
  }

  // --- sashes: hanging in still air, streaming when the wind comes
  const ph = (f.seed % 7) * 0.9, sd = f.seed * 10;
  if (!f.lord) out.dyn.push({ layer: 'back', kind: 'band', at: P([-24, -233]), len: (f.shawl ?? 166) * k, W: 9.5 * k, hang: 1.66, curl: 0.13, up: f.shawlUp ?? 0.28, droop: 0.44, lam: 104, amp: 0.78, speed: 10.5, ph, tw: 132, seed: sd + 1 });
  out.dyn.push({ layer: 'mid', kind: 'band', at: P([-25, -200]), len: (f.lord ? 74 : 108) * k, lift: f.lord ? 0.5 : 1, W: 6 * k, hang: 1.63, curl: 0.1, up: 0.08, droop: 0.5, lam: 74, amp: 0.8, speed: 12, ph: ph + 1.3, tw: 92, seed: sd + 2, lw: 1.4 });
  out.dyn.push({ layer: 'mid', kind: 'band', at: P([-25, -200]), len: (f.lord ? 58 : 84) * k, lift: f.lord ? 0.5 : 1, W: 5.4 * k, hang: 1.76, curl: 0.12, up: -0.12, droop: 0.5, lam: 66, amp: 0.8, speed: 12.6, ph: ph + 3.1, tw: 80, seed: sd + 3, lw: 1.4 });
  out.dyn.push({ layer: 'front', kind: 'band', at: P([6, -205]), len: (f.lord ? 66 : 104) * k * sl, W: 9 * k, hang: 1.46, curl: 0.1, up: 0.36, droop: 0.5, lam: 88, amp: 0.7, speed: 11, ph: ph + 2.2, tw: 112, seed: sd + 4 });
  return out;
}

// ------------------------------------------------------------------------------------------- scenery
function curlPts(cx, cy, R, a0, turns, sgn) {
  const n = Math.round(24 * turns) + 6, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = a0 + sgn * u * turns * TAU, rad = R * (1 - 0.74 * Math.pow(u, 0.85));
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.92]);
  }
  return pts;
}
function cloudTails(D, x, y, s, dir, seed, style = 'cloud') {
  const r = K.rng(seed);
  for (let j = 0; j < 3; j++) {
    const len = (110 + r() * 80) * s, y0 = y + (7 + j * 6.5) * s, x0 = x - dir * (34 + j * 8) * s, yt = y + (16 + r.range(-5, 8)) * s, pts = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      pts.push([x0 - dir * u * len, K.lerp(y0, yt, u * u * (3 - 2 * u)) + Math.sin(u * 5 + j * 1.3 + seed) * 2.4 * s * (1 - u * 0.7)]);
    }
    D.line(K.catmull(pts, 3), style, { pr: 'tail' });
  }
}
function cloudHead(D, x, y, s, dir, style = 'cloud') {
  for (const [lx, ly, R, sg] of [[-42, 9, 12.5, -1], [40, 10, 12, 1], [-21, -1, 16.5, -1], [19, 0, 16, 1], [-1, -12, 21, 1]]) {
    const cx = x + dir * lx * s, cy = y + ly * s, sgn = sg * dir, a0 = sgn > 0 ? 0.78 * PI : 0.22 * PI;
    D.mask(K.ellipsePts(cx, cy, R * s * 0.99, R * s * 0.91, 22));
    D.line(curlPts(cx, cy, R * s, a0, 1.42, sgn), style, { pr: 'curl' });
    D.line(curlPts(cx, cy, R * s * 0.99, a0 + sgn * 0.5, 0.36, sgn).map(([px, py]) => [cx + (px - cx) * 0.8, cy + (py - cy) * 0.8]), style, { pr: 'soft', w: 1.0 });
  }
  D.line(K.catmull([[x - dir * 55 * s, y + 16 * s], [x - dir * 26 * s, y + 22 * s], [x + dir * 6 * s, y + 19 * s], [x + dir * 34 * s, y + 21 * s], [x + dir * 52 * s, y + 17 * s]], 6), style, { pr: 'soft' });
}
function lotusLeaf(D, x, y, rx, ry, rot, seed) {
  const n = 46, pts = [], cr = Math.cos(rot), sr = Math.sin(rot);
  const at = (a, f) => {
    const w = f * (1 + 0.07 * Math.sin(a * 5 + seed) + 0.045 * Math.sin(a * 9 + seed * 2.3) + 0.03 * Math.sin(a * 14 + seed));
    const px = Math.cos(a) * rx * w, py = Math.sin(a) * ry * w;
    return [x + px * cr - py * sr, y + px * sr + py * cr];
  };
  for (let i = 0; i <= n; i++) pts.push(at((i / n) * TAU, 1));
  D.mask(pts);
  for (let k = 0; k < 3; k++) D.line(pts.slice(Math.floor((k * n) / 3), Math.floor(((k + 1) * n) / 3) + 2), 'pond', { w: 1.75 });
  const nav = [x + rx * 0.08 * cr + ry * 0.14 * sr, y + rx * 0.08 * sr - ry * 0.14 * cr];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.2, e = at(a, 0.9), m = at(a + 0.1, 0.5);
    D.line(K.catmull([nav, lerpP(nav, m, 0.9), e], 5), 'hair', { tone: 'nong' });
  }
  D.line(circ(nav[0], nav[1], 2.2, 1.4, 10), 'hair', { pr: 'iron' });
}
function stem(D, pts, w = 3) {
  const rp = K.ribbonPoly(K.catmull(pts, 6), w), h = rp.length / 2;
  D.mask(rp);
  D.line(rp.slice(0, h), 'pond', { pr: 'iron', w: 1.31 });
  D.line(rp.slice(h), 'pond', { pr: 'iron', w: 1.31 });
}
function censer(D, cx, by, s) {
  const Lc = (pts, sg = 5) => K.catmull(pts.map(([x, y]) => [cx + x * s, by + y * s]), sg);
  D.mask(Lc([[-17, 0], [-15, -7], [-6, -11], [-4, -22], [-5, -27], [-14, -31], [-17, -42], [-13, -46], [-9, -55], [-4, -66], [0, -77], [4, -66], [9, -55], [13, -46], [17, -42], [14, -31], [5, -27], [4, -22], [6, -11], [15, -7], [17, 0]], 3));
  D.line(Lc([[-17, 0], [-15.5, -7], [-6, -11], [6, -11], [15.5, -7], [17, 0]]), 'robe', { w: 1.62, pr: 'soft' });
  D.line(Lc([[-18, 0], [18, 0]], 2), 'wire');
  for (const m of [-1, 1]) {
    D.line(Lc([[9 * m, 0], [10 * m, -6], [5 * m, -10.5]]), 'fine');
    D.line(Lc([[4 * m, -11], [3.2 * m, -17], [4.5 * m, -22], [5 * m, -27]]), 'wire');
    D.line(Lc([[5 * m, -27], [14.5 * m, -32], [16.5 * m, -42]]), 'robe', { w: 1.62 });
  }
  D.line(Lc([[0, 0], [0, -10.5]], 2), 'fine');
  D.line(Lc([[-6, -18.5], [0, -17.3], [6, -18.5]]), 'hair', { pr: 'iron' });
  D.line(Lc([[-5, -27], [5, -27]], 2), 'wire');
  D.line(Lc([[-18.5, -42], [18.5, -42]], 2), 'wire');
  D.line(Lc([[-17.5, -45], [17.5, -45]], 2), 'wire');
  D.line(Lc([[-13, -45], [-11, -52], [-8, -57.5], [-6, -53], [-3.5, -63], [0, -77], [3.5, -63], [6, -53], [8, -57.5], [11, -52], [13, -45]], 4), 'robe', { w: 1.56, pr: 'soft' });
  D.line(Lc([[-7, -45.5], [-4.5, -52], [-2, -47.5], [0, -57], [2, -47.5], [4.5, -52], [7, -45.5]], 4), 'hair', { pr: 'iron' });
  return [cx, by - 78 * s];
}
/** the jewelled canopy that floats above the lord */
function canopy(D, cx, y0, S) {
  const X = (dx) => cx + dx;
  const rimY = (dx) => y0 + 50 + 8 * (1 - (dx / 66) * (dx / 66));
  const dome = K.catmull([[X(-66), y0 + 50], [X(-54), y0 + 27], [X(-29), y0 + 10], [X(0), y0 + 3], [X(29), y0 + 10], [X(54), y0 + 27], [X(66), y0 + 50]], 8);
  const rimT = [], rimB = [];
  for (let dx = -66; dx <= 66; dx += 6) {
    rimT.push([X(dx), rimY(dx)]);
    rimB.push([X(dx * 0.96), rimY(dx) + 10]);
  }
  const nL = 9, wL = (63.4 * 2) / nL, lap = [], tips = [];
  for (let i = 0; i <= nL; i++) {
    const dx = -63.4 + i * wL;
    lap.push([X(dx), rimY(dx / 0.96) + 27]);
    if (i < nL) {
      const dm = dx + wL / 2;
      lap.push([X(dm), rimY(dm / 0.96) + 39]);
      tips.push([X(dm), rimY(dm / 0.96) + 39]);
    }
  }
  D.mask(dome.concat(rev(lap)));
  D.line(dome, 'contour', { w: 2.25 });
  for (const m of [-1, 1]) D.line(K.catmull([[X(66 * m), y0 + 50], [X(73 * m), y0 + 47], [X(78 * m), y0 + 40], [X(77 * m), y0 + 33]], 6), 'robe', { pr: 'curl' });
  for (const dx of [-44, -22, 0, 22, 44]) D.line(K.catmull([[X(dx * 0.06), y0 + 4], [X(dx * 0.66), y0 + 21 + Math.abs(dx) * 0.08], [X(dx), rimY(dx)]], 6), 'fold', { pr: 'soft' });
  D.line(rimT, 'robe');
  D.line(rimB, 'robe');
  for (let dx = -55; dx <= 55; dx += 11) D.line(circ(X(dx * 0.98), rimY(dx) + 5, 1.8, 1.8, 9), 'hair', { pr: 'iron' });
  for (let i = 0; i <= nL; i++) {
    const p = lap[i * 2];
    D.line([[p[0], p[1] - 17], [p[0], p[1]]], 'fold');
    if (i < nL) D.line([p, lap[i * 2 + 1], lap[i * 2 + 2]], 'robe', { w: 1.5, pr: 'soft' });
  }
  // flaming pearl on a lotus base
  D.line(K.catmull([[X(-8), y0 + 4], [X(-5), y0 - 2], [X(0), y0 - 4], [X(5), y0 - 2], [X(8), y0 + 4]], 5), 'robe', { w: 1.5 });
  D.mask(K.ellipsePts(cx, y0 - 10.5, 6.5, 6.5, 16));
  D.line(circ(cx, y0 - 10.5, 6.5, 6.5, 18), 'robe', { w: 1.56, pr: 'soft' });
  D.line(K.catmull([[X(-6), y0 - 8], [X(-8.5), y0 - 18], [X(-2), y0 - 26], [X(1.5), y0 - 35]], 6), 'fine', { pr: 'hair' });
  D.line(K.catmull([[X(6), y0 - 8], [X(9), y0 - 17], [X(5), y0 - 25], [X(1.5), y0 - 35]], 6), 'fine', { pr: 'hair' });
  D.line(K.catmull([[X(0), y0 - 18.5], [X(2.2), y0 - 23.5], [X(1), y0 - 29]], 5), 'hair');
  // tassels on the lappets, long ribbons at the eaves
  tips.forEach((p, i) => S.air.push({ kind: 'line', at: p, x: p[0], len: 27 + 6 * Math.sin(i * 2.1), hang: PI / 2, curl: 0.04, up: 0.12, droop: 0.5, lam: 44, amp: 0.7, speed: 13, ph: i * 1.1, seed: 300 + i, lw: 1.25, bead: 0.3, tuft: true, taper: [0.02, 0.1] }));
  for (const m of [-1, 1]) S.air.push({ kind: 'band', at: [X(77 * m), y0 + 33], x: X(77 * m), len: m < 0 ? 118 : 100, W: 6.4, hang: PI / 2 + 0.03 * m, curl: 0.07, up: 0.2, droop: 0.42, lam: 80, amp: 0.8, speed: 12, ph: 2 + m, tw: 92, seed: 320 + m, lw: 1.4 });
}

// the procession: back rank first, then the front rank which overlaps it. The line leaves a place at x ≈ 370–650.
const FIGS = [
  { id: 'A', x: -18, y: 766, k: 0.96, lean: -0.02, hair: 'tall', attr: 'lotus', seed: 11, train: 0.8 },
  { id: 'C', x: 190, y: 766, k: 0.95, lean: -0.05, hair: 'loops', look: -1, tilt: 0.06, attr: 'tray', seed: 13, train: 0.7 },
  { id: 'G', x: 808, y: 766, k: 0.93, lean: 0.005, hair: 'buns', look: -1, attr: 'censer', seed: 17, train: 0.55, sl: 0.9 },
  { id: 'J', x: 1008, y: 766, k: 0.96, lean: -0.03, hair: 'tall', seed: 19, train: 0.9 },
  { id: 'B', x: 86, y: 782, k: 1.0, lean: 0.015, hair: 'cap', male: true, attr: 'banner', top: 246, seed: 12, train: 0.45, sl: 0.88 },
  { id: 'D', x: 294, y: 782, k: 1.0, lean: -0.045, hair: 'tall', tilt: -0.08, attr: 'pipa', seed: 14, train: 1 },
  { id: 'F', x: 708, y: 782, k: 1.08, lean: -0.012, hair: 'crown', male: true, lord: true, attr: 'tablet', seed: 16, train: 1.05, sl: 1.12 },
  { id: 'H', x: 904, y: 782, k: 1.0, lean: 0.012, hair: 'cap', male: true, attr: 'banner', top: 236, linger: true, seed: 18, train: 0.45, sl: 0.88 },
];

function compose(D) {
  const S = { figs: [], air: [], banners: [] };
  // a cloud scroll beyond the balustrade, in the open stretch of the bridge
  cloudTails(D, 448, 620, 1.25, 1, 21);
  cloudHead(D, 448, 620, 1.25, 1);
  // the far balustrade: rails, little struts, posts with lotus-bud finials
  const rail = (y, w, sd) => {
    for (let x = -20, i = 0; x < 1010; x += 258, i++) D.line(seg([x, y], [x + 262, y], sd + i, 0.5), 'far', { w });
  };
  rail(680, 1.15, 1);
  rail(686.5, 1.0, 5);
  rail(712, 1.05, 9);
  rail(716.5, 0.95, 13);
  rail(734, 0.85, 17);
  rail(752, 1.05, 21);
  rail(758, 1.0, 25);
  rail(765, 1.15, 29);
  const posts = [70, 245, 420, 595, 770, 945];
  for (let x = -17.5; x < 1020; x += 87.5) {
    if (posts.some((p) => Math.abs(p - x) < 20)) continue;
    for (const m of [-1, 1]) D.line(K.catmull([[x + 2 * m, 686.5], [x + 4.6 * m, 696], [x + 2 * m, 706], [x + 3.2 * m, 712]], 5), 'far', { w: 1.19 });
  }
  for (const x of posts) {
    D.mask([[x - 7, 765], [x - 7, 664], [x - 10.5, 659], [x - 6, 654], [x - 4.5, 650], [x - 8, 644], [x - 7, 636], [x, 627], [x + 7, 636], [x + 8, 644], [x + 4.5, 650], [x + 6, 654], [x + 10.5, 659], [x + 7, 664], [x + 7, 765]]);
    for (const m of [-1, 1]) {
      D.line(seg([x + 7 * m, 664], [x + 7 * m, 765], x + m, 0.3), 'far', { w: 1.38 });
      D.line(K.catmull([[x, 627.5], [x + 6.5 * m, 636], [x + 7.5 * m, 644], [x + 4 * m, 650]], 6), 'far', { w: 1.44, pr: 'soft' });
      D.line(K.catmull([[x + 2 * m, 650], [x + 4 * m, 641], [x, 631]], 5), 'far', { w: 1 });
      D.line([[x + 4 * m, 650], [x + 4.5 * m, 654]], 'far', { w: 1.12 });
    }
    D.line(K.catmull([[x - 8.5, 664], [x - 10.5, 659], [x - 6, 654.5], [x + 6, 654.5], [x + 10.5, 659], [x + 8.5, 664]], 5), 'far', { w: 1.38 });
    D.line([[x - 9, 664], [x + 9, 664]], 'far', { w: 1.38 });
  }
  // incense burner standing in the open stretch
  const smoke = censer(D, 512, 780, 1.22);
  S.air.push({ kind: 'line', at: smoke, x: 512, len: 92, hang: 1.5 * PI, curl: 0.26, drift: 1.0, up: 0.2, droop: 0.3, lam: 64, amp: 0.45, speed: 9, ph: 0.4, seed: 87, lw: 1.3, a: 0.72, taper: [0.1, 0.55] });

  for (const f of FIGS) S.figs.push(figure(D, f, S));
  canopy(D, 722, 292, S);

  // the bridge deck (the road) with a band of lotus petals along its edge
  for (const [x0, x1, sd] of [[-10, 352, 1], [344, 702, 2], [694, 1010, 3]]) {
    D.line(seg([x0, 801.6], [x1, 801.6], sd, 0.45), 'contour', { w: 2.5, pr: 'soft' });
    D.line(seg([x0, 811.5], [x1, 811.5], sd + 4, 0.4), 'wire');
    D.line(seg([x0, 846], [x1, 846], sd + 8, 0.4), 'wire');
    D.line(seg([x0, 852], [x1, 852], sd + 12, 0.45), 'robe', { pr: 'soft', w: 1.88 });
  }
  for (let x = -14; x < 1000; x += 28) {
    D.line(K.catmull([[x + 0.5, 843.5], [x + 2.5, 829], [x + 14, 815.5], [x + 25.5, 829], [x + 27.5, 843.5]], 6), 'pond', { w: 1.5, pr: 'soft' });
    D.line(K.catmull([[x + 7, 843.5], [x + 8.5, 832.5], [x + 14, 823], [x + 19.5, 832.5], [x + 21, 843.5]], 5), 'hair', { tone: 'nong', pr: 'iron' });
    D.line([[x + 26.6, 834], [x + 28, 827.5], [x + 29.4, 834]], 'hair', { tone: 'nong', pr: 'iron' });
  }
  // scrolling clouds below the bridge, lotus rising through them
  const clouds = [[118, 900, 1.25, 31], [356, 948, 1.5, 32], [512, 896, 1.15, 33], [742, 946, 1.45, 34], [936, 898, 1.2, 35], [560, 986, 1.0, 37]];
  for (const [x, y, s, sd] of clouds) cloudTails(D, x, y, s, 1, sd);
  for (const [x, y, s] of clouds) cloudHead(D, x, y, s, 1);
  lotusLeaf(D, 236, 962, 74, 30, -0.06, 3);
  lotusLeaf(D, 806, 968, 80, 31, 0.05, 5);
  lotusLeaf(D, 444, 984, 58, 22, 0.08, 7);
  stem(D, [[196, 1004], [204, 960], [222, 922], [232, 905]]);
  lotus(D, 233, 903, 0.95);
  stem(D, [[650, 1004], [652, 962], [640, 930], [634, 912]]);
  lotus(D, 633, 910, 0.9);
  stem(D, [[866, 1004], [872, 962], [884, 930]]);
  petal(D, 884, 932, 38, 17, -PI / 2 + 0.12);
  petal(D, 884, 932, 30, 13, -PI / 2 - 0.2);
  stem(D, [[44, 1004], [40, 960], [30, 934]]);
  petal(D, 30, 936, 34, 15, -PI / 2 - 0.1);
  return S;
}

function toPath(polys) {
  const p = new Path2D();
  for (const poly0 of polys) {
    let poly = poly0.length > 60 ? poly0.filter((_, i) => i % 2 === 0) : poly0, a = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] - poly[i][0]) * (poly[j][1] + poly[i][1]);
    if (a < 0) poly = rev(poly);
    p.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) p.lineTo(poly[i][0], poly[i][1]);
    p.closePath();
  }
  return p;
}

// ------------------------------------------------------------------------------------------- the wind
/** 0 = still air … 1 = full gust: whips up from t0 with a little overshoot, dies away after `rel` */
function gust(t, t0, rel, fall) {
  if (t <= t0) return 0;
  return Math.max(0, K.ease.outBack(K.prog(t, t0, 0.42), 1.5) * (1 - K.smoothstep(rel, rel + fall, t)));
}
const pelGust = (t) => gust(t, 2.0, 3.8, 1.4); // the pelican: on the downbeat of bar 2
const windOf = (t, d) => gust(t - d, 2.0, 3.6, 1.35); // the procession: a beat behind (d ≈ 0.5 … 0.75)
const delayOf = (x) => 0.5 + 0.25 * K.clamp((x - 300) / 660);
/** afterwards one banner goes on swaying, slower and slower */
const linger = (t) => (t < 5.3 ? 0 : 0.5 * K.smoothstep(5.3, 6.1, t) * Math.exp(-Math.max(0, t - 5.8) / 3.6) * Math.sin((t - 5.3) * 2.5));

/** centre line of a ribbon tied at o.at: hangs in still air, turns into the wind and ripples as w rises */
function ribbonPts(o, w, t, sw0 = 0, sw1 = 0) {
  const n = Math.max(8, Math.round(o.len / 6)), ds = o.len / n, pts = [[o.at[0], o.at[1]]];
  const e = Math.max(0, w), e1 = Math.min(1, e), ph = o.ph ?? 0;
  let x = o.at[0], y = o.at[1];
  for (let i = 1; i <= n; i++) {
    const u = (i - 0.5) / n, s = u * o.len;
    const hang = o.hang + (o.curl ?? 0.1) * Math.sin(u * 3.4 + ph - t * (o.drift ?? 0)) + K.lerp(sw0, sw1, u) + 0.014 * u * Math.sin(t * 0.9 + ph + u * 2);
    const blow = PI + (o.up ?? 0.2) - (o.droop ?? 0.4) * Math.pow(u, o.pw ?? 1.4);
    let kk = K.clamp(e * (1.32 - 0.45 * u), 0, 1);
    kk = kk * kk * (3 - 2 * kk);
    const flut = e1 * (0.82 + 0.18 * Math.sin(t * 1.9 + ph * 3)) * (o.amp ?? 0.7) * Math.pow(u, o.ae ?? 0.6) * Math.sin((s * TAU) / (o.lam ?? 90) - t * (o.speed ?? 10) + ph);
    const th = hang + (blow - hang) * kk + flut;
    x += Math.cos(th) * ds;
    y += Math.sin(th) * ds;
    pts.push([x, y]);
  }
  return pts;
}
/** the two edges of a ribbon; they cross where the silk turns over */
function bandEdges(pts, o) {
  const n = pts.length, Ls = K.arcLen(pts), tot = Ls[n - 1] || 1, A = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const m = Math.hypot(nx, ny) || 1, u = Ls[i] / tot;
    nx /= m;
    ny /= m;
    let c = 1;
    if (o.tw) {
      c = K.clamp(Math.cos((Ls[i] * PI) / o.tw + (o.ph ?? 0) * 1.7) * 4.5, -1, 1);
    }
    const root = o.head ? K.smoothstep(0, o.head, u) : 0.3 + 0.7 * K.smoothstep(0, 0.1, u);
    const tip = o.blunt ? 1 : Math.pow(1 - K.smoothstep(0.88, 1, u), 0.7);
    const h = (o.W / 2) * c * root * tip;
    A.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
    B.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
  }
  return [A, B];
}
function inkStroke(ctx, pts, o = {}) {
  K.brushStroke(ctx, pts, { width: o.w ?? 1.7, color: INK, alpha: o.a ?? 0.92, taper: o.taper ?? [0.06, 0.16], minW: o.minW ?? 0.32, wobble: o.wob ?? 0.18, seed: o.seed ?? 1, seg: 3, smooth: o.smooth, pressure: o.pressure });
}
function knock(ctx, A, B, air = 2.2) {
  ctx.beginPath();
  ctx.moveTo(A[0][0], A[0][1]);
  for (let i = 1; i < A.length; i++) ctx.lineTo(A[i][0], A[i][1]);
  for (let i = B.length - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]);
  ctx.closePath();
  ctx.fillStyle = L.pats.ground;
  ctx.fill();
  if (air) {
    ctx.strokeStyle = L.pats.ground;
    ctx.lineWidth = air;
    ctx.stroke();
  }
}
function drawBand(ctx, pts, o) {
  const [A, B] = bandEdges(pts, o);
  knock(ctx, A, B);
  inkStroke(ctx, A, { w: o.lw ?? 1.8, seed: o.seed });
  inkStroke(ctx, B, { w: o.lw ?? 1.8, seed: o.seed + 5 });
  if (o.W >= 8.5 && pts.length > 12) inkStroke(ctx, pts.slice(2, Math.round(pts.length * 0.72)), { w: 1.0, seed: o.seed + 9, a: 0.8, taper: [0.2, 0.5] });
}
function drawDyn(ctx, el, t) {
  const w = windOf(t, el.delay) * (el.lift ?? 1);
  const pts = ribbonPts(el, w, t);
  if (el.kind === 'band') {
    drawBand(ctx, pts, el);
    return;
  }
  if (!el.tuft) {
    inkStroke(ctx, pts, { w: el.lw ?? 1.3, seed: el.seed, taper: el.taper ?? [0.05, 0.3], a: el.a });
    return;
  }
  const k = pts.length - 3, a = pts[k], b = pts[pts.length - 1], th = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(th), sn = Math.sin(th);
  inkStroke(ctx, pts.slice(0, k + 1), { w: el.lw ?? 1.3, seed: el.seed, taper: [0.02, 0.05] });
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(a[0] + c * 10 - sn * 2.7, a[1] + sn * 10 + c * 2.7);
  ctx.lineTo(a[0] + c * 10 + sn * 2.7, a[1] + sn * 10 - c * 2.7);
  ctx.closePath();
  ctx.fillStyle = L.pats.ground;
  ctx.fill();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(a[0] + c * 10, a[1] + sn * 10);
  ctx.strokeStyle = K.rgba(INK, 0.9);
  ctx.lineWidth = 1.05;
  ctx.stroke();
}
/** a temple banner: triangular head, body in panels with a roundel each, two side streamers */
function drawBanner(ctx, b, t) {
  const w = windOf(t, b.delay), sw0 = b.linger ? linger(t) : 0, sw1 = b.linger ? linger(t - 0.4) * 1.5 : 0;
  const body = ribbonPts(b, w, t, sw0, sw1), n = body.length;
  const [A, B] = bandEdges(body, { W: b.W, head: 0.13, blunt: true });
  const i0 = Math.round((n - 1) * 0.13);
  [A, B].forEach((edge, k) => {
    const o = { ...b.side, at: edge[i0], ph: b.ph + 1 + k * 2.2, seed: b.seed + 20 + k };
    drawBand(ctx, ribbonPts(o, w * (1.04 - 0.1 * k), t, sw0, sw1 * 1.15), o);
  });
  knock(ctx, A, B);
  inkStroke(ctx, A, { w: 1.8, seed: b.seed + 1, taper: [0.02, 0.05] });
  inkStroke(ctx, B, { w: 1.8, seed: b.seed + 2, taper: [0.02, 0.05] });
  ctx.strokeStyle = K.rgba(INK, 0.9);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  const bars = [0.13, 0.155, 0.36, 0.58, 0.8, 1].map((u) => Math.min(n - 1, Math.round(u * (n - 1))));
  for (const i of bars) {
    ctx.moveTo(A[i][0], A[i][1]);
    ctx.lineTo(B[i][0], B[i][1]);
  }
  // the tail is slit into three tongues
  for (const f of [1 / 3, 2 / 3]) {
    for (let i = bars[4]; i < n; i++) {
      const p = lerpP(A[i], B[i], f);
      if (i === bars[4]) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
  }
  ctx.stroke();
  ctx.lineWidth = 1.05;
  for (const u of [0.26, 0.47, 0.69]) {
    const c = body[Math.round(u * (n - 1))];
    ctx.beginPath();
    ctx.arc(c[0], c[1], b.W * 0.22, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c[0], c[1], b.W * 0.07, 0, TAU);
    ctx.stroke();
  }
}
function restore(ctx, path) {
  ctx.fillStyle = L.pats.base;
  ctx.fill(path);
  ctx.strokeStyle = L.pats.base;
  ctx.lineWidth = 2.4;
  ctx.stroke(path);
}

// ------------------------------------------------------------------------------------------- the pelican, in plain line
const yUp = (f) => f.map(([x, y]) => [x, -y]);
const WING_FEATHERS = [
  [[-28, 222], [-62, 214], [-96, 196], [-108, 183.5]],
  [[-24, 214], [-58, 206], [-88, 190], [-100, 180.5]],
  [[-20, 206], [-52, 198], [-78, 186], [-88, 179]],
  [[-16, 198], [-44, 191], [-66, 181], [-74, 175.5]],
  [[-13, 191], [-36, 185], [-54, 177], [-60, 173.5]],
  [[-11, 186], [-28, 180], [-40, 175]],
].map(yUp);
const COVERTS = [[-15, 217], [-22, 215.5], [-29, 213.5], [-36, 211], [-17, 209], [-24, 207], [-31, 204.5]].map(([x, y]) => yUp([[x + 1, y + 3.2], [x - 3.6, y], [x + 1, y - 3.2]]));
const BREAST = [[-14, 163], [-28, 162], [-42, 160], [-56, 160], [-70, 162], [-22, 155], [-36, 153], [-50, 152], [-63, 154]].map(([x, y]) => yUp([[x - 3.6, y + 2], [x, y - 1.3], [x + 3.6, y + 2]]));
// its celestial sashes: [length at rest → in the gust], how steeply each one climbs, ripple
const PSASH = [
  { rest: 124, full: 300, up: [0.34, 1.0], dr: [0.3, 1.0], pw: 1.5, W: 12, lam: 128, amp: [0.3, 0.86], speed: 10, ph: 0.3, tw: 142, seed: 31 },
  { rest: 96, full: 250, up: [0.2, 0.5], dr: [0.3, 0.55], pw: 1.3, W: 11, lam: 110, amp: [0.3, 0.8], speed: 11.5, ph: 2.1, tw: 122, seed: 32 },
  { rest: 0, full: 190, up: [0.1, 0.12], dr: [0.3, 0.3], pw: 1, W: 9, lam: 98, amp: [0.3, 0.78], speed: 12.5, ph: 5.2, tw: 104, seed: 33 },
];
function pelicanSashes(ctx, pose, t) {
  const e = K.ease.io2(K.clamp(pelGust(t))), s = pose.s, nb = pose.pt.neckBase, at = [nb[0] - 8 * s, nb[1] + 3 * s];
  for (const q of PSASH) {
    const len = K.lerp(q.rest, q.full, e) * s;
    if (len < 12) continue;
    const o = { at, len, hang: PI / 2, curl: 0, up: K.lerp(q.up[0], q.up[1], e), droop: K.lerp(q.dr[0], q.dr[1], e), pw: q.pw, lam: q.lam, amp: K.lerp(q.amp[0], q.amp[1], e), speed: q.speed, ph: q.ph, ae: 1.0, W: q.W * s * K.clamp(len / 70), tw: q.tw, seed: q.seed, lw: 1.9 };
    drawBand(ctx, ribbonPts(o, 1, t), o);
  }
}
/** a feather that keeps its own direction at the root and streams into the wind beyond it */
function plumePts(at, a0, len, o, t, e) {
  const n = Math.max(5, Math.round(len / 5)), ds = len / n, pts = [at.slice()];
  let x = at[0], y = at[1];
  for (let i = 1; i <= n; i++) {
    const u = (i - 0.5) / n, blow = PI + o.up - o.droop * u;
    const d = Math.atan2(Math.sin(blow - a0), Math.cos(blow - a0));
    const th = a0 + d * K.smoothstep(0, 0.5, u) * (0.25 + 0.75 * e) + e * o.amp * Math.pow(u, 0.6) * Math.sin((u * len * TAU) / o.lam - t * o.speed + o.ph);
    x += Math.cos(th) * ds;
    y += Math.sin(th) * ds;
    pts.push([x, y]);
  }
  return pts;
}
function inkPelican(ctx, pose, t) {
  const s = pose.s, S = pose.shapes, pt = pose.pt, pats = L.pats, g = K.clamp(pelGust(t));
  const parts = Rig.parts(pose, { scarf: false });
  const col = K.rgba(INK, 0.92);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // 1 — reserve the whole figure as bare silk with a breath of air around it: the procession's lines stop short of it
  ctx.fillStyle = pats.ground;
  ctx.strokeStyle = pats.ground;
  const air = 5 * s;
  for (const p of parts) {
    if (p.kind === 'poly') {
      K.path(ctx, p.pts, true);
      ctx.fill();
      ctx.lineWidth = air;
      ctx.stroke();
    } else if (p.kind === 'line') {
      if (p.role === 'mark' || p.role === 'head') continue;
      K.path(ctx, p.pts);
      ctx.lineWidth = p.w + air;
      ctx.stroke();
    } else if (p.kind === 'wheel') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r + air * 0.5, 0, TAU);
      ctx.fill();
    }
  }
  const wr = pose.wheels[0].r;
  K.path(ctx, [[pt.hubR[0], pt.hubR[1] - wr * 0.9], S.saddle[0], pt.hip, pt.shoulder, pt.hand, pt.grip, [pt.hubF[0], pt.hubF[1] - wr * 0.9], pt.hubF, pt.hubR], true);
  ctx.fill();

  const blank = (pts) => {
    K.path(ctx, pts, true);
    ctx.fillStyle = pats.ground;
    ctx.fill();
  };
  const wire = (pts, closed = false, lw = 1.25) => {
    K.path(ctx, pts, closed);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * s;
    ctx.stroke();
  };
  const ring = (c, r, lw) => {
    ctx.beginPath();
    ctx.arc(c[0], c[1], r, 0, TAU);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * s;
    ctx.stroke();
  };
  // an elastic line that swells and thins as it goes round a shape
  const outline = (pts, w, seed, closed = true) => inkStroke(ctx, closed ? pts.concat([pts[0]]) : pts, { w: w * s, seed, smooth: false, taper: closed ? [0.03, 0.05] : [0.08, 0.12], minW: 0.4, pressure: (u) => 0.84 + 0.28 * Math.sin(u * TAU * 2 + seed) });
  const feather = (pts, w, seed) => inkStroke(ctx, pts, { w: w * s, seed, taper: [0.04, 0.5], minW: 0.2 });
  const viaBody = (f) => f.map((p) => ap(pose.G.body, p));

  // 2 — the drawing, back to front; each part is reserved again so that nearer parts hide the lines of farther ones
  let knot = false;
  for (const p of parts) {
    const seed = seedOf(p.name);
    if (p.kind === 'wheel') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r, 0, TAU);
      ctx.fillStyle = pats.ground;
      ctx.fill();
      ring(p.c, p.r * 0.985, 2.1);
      ring(p.c, p.r * 0.87, 1.35);
      ctx.beginPath();
      for (const [a, b] of Rig.spokes(p, 14, 0.1, 0.87)) {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.lineWidth = 1.0 * s;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r * 0.1, 0, TAU);
      ctx.fill();
      ring(p.c, p.r * 0.1, 1.3);
    } else if (p.kind === 'disc') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r, 0, TAU);
      ctx.fillStyle = pats.ground;
      ctx.fill();
      ring(p.c, p.r, 1.4);
      ring(p.c, p.r * 0.42, 1.1);
    } else if (p.kind === 'eye') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r * 0.92, 0, TAU);
      ctx.fillStyle = pats.ground;
      ctx.fill();
      if (p.lid > 0.5) wire([[p.c[0] - p.r, p.c[1]], [p.c[0], p.c[1] + p.r * 0.35], [p.c[0] + p.r, p.c[1]]], false, 1.2);
      else {
        ring(p.c, p.r * 0.92, 1.3);
        ctx.beginPath();
        ctx.arc(p.pupil[0], p.pupil[1], p.pr * 0.95, 0, TAU);
        ctx.fillStyle = col;
        ctx.fill();
      }
    } else if (p.kind === 'line') {
      if (p.role === 'frame' || p.role === 'metal') {
        if (p.w >= 3.5 * s) {
          const poly = K.ribbonPoly(p.pts.length > 2 ? K.catmull(p.pts, 5) : p.pts, p.w * 0.82);
          blank(poly);
          wire(poly, true, 1.6);
        } else wire(p.pts, false, 1.15);
      } else if (p.role === 'leg') {
        const poly = K.ribbonPoly(K.resample(p.pts, 5), (u) => K.lerp(1.02, 0.6, u) * p.w);
        blank(poly);
        outline(poly, 2.0, seed);
      } else if (p.role === 'head') {
        // crest: at rest the three short plumes of the rig; in the gust they stream out long behind the head
        const i = Number(p.name.slice(-1)), a0 = Math.atan2(p.pts[2][1] - p.pts[0][1], p.pts[2][0] - p.pts[0][0]);
        const len = (20 - i * 3 + g * [42, 60, 34][i]) * s;
        feather(plumePts(p.pts[0], a0, len, { up: 0.5 - i * 0.22, droop: 0.5, amp: 0.6, lam: 58, speed: 13, ph: i * 1.9 }, t, g), 2.3, seed);
      } else if (p.name === 'beakLine') feather(p.pts, 1.3, seed);
      else if (p.role === 'wing') feather(p.pts, 2.0, seed); // wing fingers on the grip
    } else if (p.kind === 'poly') {
      if (p.role === 'tail') {
        const i = Number(p.name.slice(-1)), tip = p.pts[4], base = lerpP(p.pts[0], p.pts[8], 0.5);
        if (g > 0.02) {
          // long tail plumes drawn out by the wind
          const a0 = Math.atan2(tip[1] - base[1], tip[0] - base[0]), len = g * [46, 68, 40][i] * s;
          const c = plumePts(tip, a0, len, { up: 0.16 - i * 0.14, droop: 0.4, amp: 0.55, lam: 66, speed: 12, ph: i * 2.3 + 1 }, t, g);
          const [A, B] = bandEdges(c, { W: 6.2 * s, head: 0.01 });
          knock(ctx, A, B, 1.6);
          feather(A, 1.5, seed + 1);
          feather(B, 1.5, seed + 2);
          feather(c, 0.9, seed + 3);
        }
        blank(p.pts);
        outline(p.pts, 2.0, seed);
        feather([base, lerpP(base, tip, 0.86)], 1.0, seed + 4);
      } else if (p.name === 'neck') {
        blank(p.pts);
        const h = p.pts.length / 2;
        outline(p.pts.slice(0, h), 2.8, seed, false);
        outline(p.pts.slice(h), 2.8, seed + 1, false);
      } else if (p.name === 'arm') {
        if (!knot) {
          knot = true;
          blank(S.scarfKnot);
          outline(S.scarfKnot, 1.7, 77);
        }
        blank(p.pts);
        const h = p.pts.length / 2;
        outline(p.pts.slice(0, h), 2.5, seed, false);
        outline(p.pts.slice(h), 2.5, seed + 1, false);
        // long flight feathers along the wing-arm
        for (const f of [0.3, 0.62]) feather(p.pts.slice(1, h - 1).map((q, i) => lerpP(q, p.pts[p.pts.length - 2 - i], f)), 1.1, seed + 9 * f);
      } else if (p.role === 'body') {
        blank(p.pts);
        outline(p.pts, 3.1, seed);
        for (let i = 0; i < BREAST.length; i++) feather(viaBody(BREAST[i]), 1.3, 40 + i);
      } else if (p.role === 'wing') {
        blank(p.pts);
        outline(p.pts, 2.8, seed);
        for (let i = 0; i < WING_FEATHERS.length; i++) feather(viaBody(WING_FEATHERS[i]), 1.7, 50 + i);
        for (let i = 0; i < COVERTS.length; i++) feather(viaBody(COVERTS[i]), 1.3, 60 + i);
      } else if (p.role === 'pouch') {
        blank(p.pts);
        outline(p.pts, 2.4, seed);
        for (const f of [0.36, 0.66]) {
          const ln = [];
          for (let j = 1; j <= 7; j++) ln.push(lerpP(p.pts[j], p.pts[Math.round(28 - 2.5 * j)], f));
          feather(ln, 1.05, seed + f * 10);
        }
      } else if (p.role === 'beak') {
        blank(p.pts);
        outline(p.pts, 2.7, seed);
        const ln = [];
        for (let j = 1; j <= 7; j++) ln.push(lerpP(p.pts[2 * j], p.pts[32 - j], 0.45));
        feather(ln, 1.0, seed + 3);
      } else if (p.role === 'head') {
        blank(p.pts);
        outline(p.pts, 2.6, seed);
      } else if (p.role === 'foot') {
        blank(p.pts);
        outline(p.pts, 1.8, seed);
        wire([p.pts[2], lerpP(p.pts[4], p.pts[5], 0.5)], false, 0.9);
        wire([lerpP(p.pts[1], p.pts[2], 0.4), p.pts[5]], false, 0.9);
      } else if (p.role !== 'scarf') {
        blank(p.pts); // saddle, pedals
        wire(p.pts, true, 1.5);
      }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the scene
export default {
  id: 4, key: 'tang', title: TITLES[4], heroT: 3.0,

  // the gust: crest up, neck a little prouder, tail streaming (0 before t = 2 and after t ≈ 5.2)
  act(t, p) {
    const g = K.clamp(pelGust(t));
    if (g <= 0) return;
    p.crest = 0.95 * g;
    p.neck = 0.3 * g;
    p.headTilt = 0.07 * g;
    p.wind = Math.min(1.6, (p.wind ?? 1) + 0.5 * g);
    p.tailWag = 0.1 * g * Math.sin(t * 8.5);
    if (K.bump(t, 2.1, 0.08) > 0.5) p.lid = 1; // it blinks as the wind arrives
  },

  async init() {
    const ground = I.silk({ res: RES, seed: 41, base: GROUND });
    const D = makeDrawing();
    const S = compose(D);
    const runs = resolve(D);
    const ink = await K.bake({ w: 1000, h: 1000, res: RES, bg: '#ffffff', seed: 404 }, (b) => {
      const q = I.batch(b);
      emit(q, runs);
      q.flush();
    });
    // a breath of pale ink in the hair, pupils; laid in the same back-to-front order as the shapes
    const breath = K.layer(1000, 1000, RES, (c) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, 1000, 1000);
      for (const f of D.fills) {
        if (f.dot) {
          c.fillStyle = '#1b1916';
          c.beginPath();
          c.arc(f.dot[0], f.dot[1], f.r, 0, TAU);
          c.fill();
        } else {
          K.path(c, f.poly, true);
          c.fillStyle = f.breath ? K.mix('#ffffff', '#6c655a', f.breath) : '#ffffff';
          c.fill();
        }
      }
    });
    const base = K.layer(1000, 1000, RES, (c) => {
      K.put(c, ground);
      K.putBlend(c, breath, 'multiply', 0.9);
      K.putBlend(c, ink, 'multiply', 0.96);
      // colophon in the upper right, with seals
      K.titleBlock(c, TITLES[4], 958, 40, {
        align: 'right', color: '#1b1814', gap: 1.26,
        zh: { size: 50, weight: 900, font: K.FONT.cjkSerif, tracking: 4 }, en: { size: 26, font: K.FONT.serif, weight: 700 }, date: { size: 23, font: K.FONT.serif, weight: 700 },
      });
      c.globalAlpha = 0.88;
      K.put(c, K.seal('吳帶當風', { size: 46, seed: 3 }), 676, 43);
      K.put(c, K.seal('鵜鶘', { size: 30, relief: 'zhu', seed: 4 }), 922, 168);
      K.put(c, K.seal('神品', { size: 34, relief: 'zhu', seed: 6 }), 30, 936);
      c.globalAlpha = 1;
    });
    // patterns of the bare silk and of the finished picture: "knocking out" a shape = filling it with the silk
    const pc = K.makeCanvas(2, 2).getContext('2d'), m = new DOMMatrix().scale(1 / RES);
    const pats = { ground: pc.createPattern(ground, 'no-repeat'), base: pc.createPattern(base, 'no-repeat') };
    pats.ground.setTransform(m);
    pats.base.setTransform(m);
    const heads = [];
    for (const f of S.figs) {
      f.sil = toPath(f.own);
      f.sleevePath = toPath(f.sleeves);
      heads.push(...f.heads);
      const d = delayOf(f.x);
      for (const el of f.dyn) el.delay = d + 0.05 * ((el.seed % 5) / 5);
    }
    for (const el of S.air) el.delay = delayOf(el.x);
    for (const b of S.banners) b.delay = delayOf(b.x);
    L = { base, pats, figs: S.figs, air: S.air, banners: S.banners, headsPath: toPath(heads), strokes: runs.length };
  },

  render(ctx, t, env) {
    K.put(ctx, L.base);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // incense, tassels and ribbons of the canopy
    for (const el of L.air) drawDyn(ctx, el, t);
    // the procession's sashes, figure by figure from the back rank forward; each figure is laid back over what flies behind it
    for (const f of L.figs) {
      for (const el of f.dyn) if (el.layer === 'back') drawDyn(ctx, el, t);
      restore(ctx, f.sil);
      for (const el of f.dyn) if (el.layer === 'mid') drawDyn(ctx, el, t);
      restore(ctx, f.sleevePath);
      for (const el of f.dyn) if (el.layer === 'front') drawDyn(ctx, el, t);
    }
    for (const b of L.banners) drawBanner(ctx, b, t);
    if (env.pose) pelicanSashes(ctx, env.pose, t);
    restore(ctx, L.headsPath); // no sash ever crosses a face
    ctx.restore();
    if (env.pose) inkPelican(ctx, env.pose, t);
    I.weave(ctx, 0, 0, 1000, 1000, 0.4);
  },
};
