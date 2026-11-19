// Section 6 — Along the River During the Qingming Festival (c. 1100, ink and light colour on silk)
// Homage to the Rainbow Bridge passage of Zhang Zeduan's handscroll. The road climbs over the great timber arch;
// under it a grain boat is lowering its mast. Everybody turns to watch the pelican go by.
//
// Technique: 界畫 jiehua — ruled-line painting. Every static line is a p5.brush 'inkFine' stroke (architecture, boat,
// bridge) or a brisk 'ink' stroke (figures, willows), baked once. The picture is built as a little vector painter's
// algorithm: elements are declared FRONT → BACK, each with an occluding silhouette, and every stroke of the things
// behind is cut where a nearer silhouette covers it — so lines stop at figures and roofs the way a painter leaves
// them out, with no ghost lines. Light colour is Canvas 2D washes multiplied in under the ink.
// Per frame: only the crowd's heads and pointing arms, a lost hat, the pelican, and the near railing laid over it.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const I = K.ink;
const TAU = Math.PI * 2;
const GROUND = '#c8b081';
const RES = 1.5;
const RY = K.ROAD_Y;
const STEP = 1.6; // sampling step of the occlusion test, in units
let L = null;

const C = {
  roof: '#5b6a76', thatch: '#94733f', wood: '#93503c', wall: '#ad8850', water: '#6a8888', leaf: '#71895a', earth: '#a2824c',
  hull: '#8a6638', mat: '#b29452', red: '#a84a36', indigo: '#5a6e88', ochre: '#b98a42', green: '#74835c', stone: '#878066',
};
const INKC = '#1a1714', FLESH = '#e4cfa8', STRAW = '#cdb279';

// ------------------------------------------------------------------------------------------- the bridge
const BX0 = 126, BX1 = 874, BH = 142, BC = 500, BW = 374;
/** riding line: y = 800 on both banks, a bell-shaped climb over the arch (flat within 126 units of each edge) */
const deckY = (x) => (x <= BX0 || x >= BX1 ? RY : RY - BH * 0.5 * (1 + Math.cos((Math.PI * (x - BC)) / BW)));
const EDGE = 5; // the deck's near edge (and the near railing) runs this far below the riding line
const nearY = (x) => deckY(x) + EDGE;
const FD = [30, -56]; // oblique offset of the deck's far edge
const farY = (x) => deckY(x - FD[0]) + FD[1];
/** a point on the roadway: x along, f across (0 = near edge … 1 = far edge) */
const onDeck = (x, f) => [x + FD[0] * f, deckY(x) + EDGE * (1 - f) + FD[1] * f];
const rideY = (lx) => (deckY(lx - 80) + deckY(lx + 80)) / 2;
/** local time at which the pelican's centre is at x (steady ride) */
const tAt = (x) => ((x + K.FRAME) * 6) / K.PITCH;
// the timber arch: concentric ribs about (BC, ACY), springing at x = 268 / 732 on the water line
const AR = 251.8, ACY = 955.8, AT = 34, TH = Math.asin(232 / AR);
const arcPt = (th, r) => [BC + r * Math.sin(th), ACY - r * Math.cos(th)];
const arcY = (x, r) => ACY - Math.sqrt(Math.max(0, r * r - (x - BC) * (x - BC)));
const mirr = (x) => (x > 500 ? 1000 - x : x);
const wallBot = (x) => {
  const m = mirr(x);
  return m <= 196 ? 824 : m <= 236 ? K.lerp(824, 846, (m - 196) / 40) : K.lerp(846, 858, K.clamp((m - 236) / 32));
};
const BANK_L = [[268, 859], [240, 872], [205, 905], [165, 950], [128, 1002]];
const BANK_R = [[732, 859], [748, 880], [753, 915], [743, 955], [726, 1002]];
const FAR_L = [[278, 714], [296, 660], [322, 596], [354, 524], [394, 448], [438, 380], [484, 318], [520, 270]];
const FAR_R = [[788, 718], [800, 660], [816, 590], [836, 516], [866, 440], [906, 372], [952, 318], [990, 276]];
const RAILBOX = { x: 120, y: 626, w: 770, h: 190 };

// the grain boat: local x toward the bow, y down, origin amidships on the deck line
const BOAT = { x: 492, y: 893, c: Math.cos(-0.122), s: Math.sin(-0.122) };
const bw = (x, y) => [BOAT.x + x * BOAT.c - y * BOAT.s, BOAT.y + x * BOAT.s + y * BOAT.c];
const BWs = (pts) => pts.map(([x, y]) => bw(x, y));
const sheer = (x) => -Math.pow(Math.abs(x) / 205, 2.6) * 26 - (x < 0 ? 4 * (x / 205) * (x / 205) : 0);
const keel = (x) => 34 - Math.pow(Math.abs(x) / 205, 3) * (x > 0 ? 40 : 30);

// ------------------------------------------------------------------------------------------- small helpers
const inPoly = (x, y, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const fpts = (fn, x0, x1, step = 10, dx = 0, dy = 0) => {
  const n = Math.max(2, Math.round((x1 - x0) / step)), out = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    out.push([x + dx, fn(x) + dy]);
  }
  return out;
};
const tint = (ctx, poly, color, a) => K.fillPoly(ctx, poly, K.rgba(color, a));
const mir = (pts) => pts.map(([x, y]) => [-x, y]);

// ------------------------------------------------------------------------------------------- the stage
function makeStage() {
  const main = new Map(), rail = new Map();
  const occs = [], ops = [], texts = [], figs = [], stills = [];
  let target = main, clipOn = true;
  const tkey = (d) => (typeof d === 'string' ? d : Math.round(K.clamp(d) * 8) / 8);
  const push = (brush, tone, cmd) => {
    const key = brush + '|' + tkey(tone);
    let g = target.get(key);
    if (!g) target.set(key, (g = { brush, color: I.tone(tkey(tone)), cmds: [] }));
    g.cmds.push(cmd);
  };
  const nearOcc = (x0, y0, x1, y1) => {
    const out = [];
    if (!clipOn) return out;
    for (const o of occs) if (o.x1 >= x0 && o.x0 <= x1 && o.y1 >= y0 && o.y0 <= y1) out.push(o);
    return out;
  };
  const hidden = (list, x, y) => {
    for (const o of list) if (x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1 && inPoly(x, y, o.poly)) return true;
    return false;
  };
  const E = {
    /** ruled straight line */
    line(x0, y0, x1, y1, o = {}) {
      const brush = o.b ?? 'inkFine', tone = o.t ?? 'nong', w = o.w ?? 1;
      const list = nearOcc(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1));
      if (!list.length) {
        push(brush, tone, { w, line: [x0, y0, x1, y1] });
        return;
      }
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / STEP));
      let a = -1;
      for (let i = 0; i <= n; i++) {
        const u = i / n, vis = !hidden(list, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u);
        if (vis && a < 0) a = i;
        if (a >= 0 && (!vis || i === n)) {
          const b = vis ? i : i - 1;
          if (b > a) push(brush, tone, { w, line: [x0 + ((x1 - x0) * a) / n, y0 + ((y1 - y0) * a) / n, x0 + ((x1 - x0) * b) / n, y0 + ((y1 - y0) * b) / n] });
          a = -1;
        }
      }
    },
    /** polyline of ruled segments */
    pl(pts, o = {}, closed = false) {
      for (let i = 0; i < pts.length - 1; i++) E.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o);
      if (closed) E.line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], o);
    },
    /** smooth stroke through pts */
    curve(pts, o = {}) {
      const brush = o.b ?? 'inkFine', tone = o.t ?? 'nong', w = o.w ?? 1;
      const press = o.press ?? (brush === 'inkFine' ? [1, 1, 1] : [0.7, 1.15, 0.5]);
      let P = o.smooth === false || pts.length < 3 ? pts : K.catmull(pts, 6);
      P = K.resample(P, STEP);
      const n = P.length, stride = o.stride ?? 4;
      const pr = (i) => {
        const u = n > 1 ? i / (n - 1) : 0;
        return u < 0.5 ? K.lerp(press[0], press[1], u * 2) : K.lerp(press[1], press[2], u * 2 - 1);
      };
      const out = (a, b) => {
        if (b - a < 1) return;
        const run = [];
        for (let i = a; i < b - 1; i += stride) run.push([P[i][0], P[i][1], pr(i)]);
        run.push([P[b][0], P[b][1], pr(b)]);
        if (run.length < 2) return;
        if (run.length === 2) push(brush, tone, { w, line: [run[0][0], run[0][1], run[1][0], run[1][1]] });
        else push(brush, tone, { w, pts: run, curve: o.curve ?? 0.5 });
      };
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of P) {
        x0 = Math.min(x0, p[0]);
        y0 = Math.min(y0, p[1]);
        x1 = Math.max(x1, p[0]);
        y1 = Math.max(y1, p[1]);
      }
      const list = nearOcc(x0, y0, x1, y1);
      if (!list.length) {
        out(0, n - 1);
        return;
      }
      let a = -1;
      for (let i = 0; i < n; i++) {
        const vis = !hidden(list, P[i][0], P[i][1]);
        if (vis && a < 0) a = i;
        if (a >= 0 && (!vis || i === n - 1)) {
          out(a, vis ? i : i - 1);
          a = -1;
        }
      }
    },
  };
  return {
    main, rail, ops, texts, figs, stills,
    /** declare one element (front → back): ink(E) strokes, occ silhouettes, wash(ctx) / lite(ctx) colour */
    el(def) {
      if (def.ink) def.ink(E);
      ops.push(def);
      if (def.occ) {
        for (const p of def.occ) {
          if (!p || p.length < 3) continue;
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const q of p) {
            x0 = Math.min(x0, q[0]);
            y0 = Math.min(y0, q[1]);
            x1 = Math.max(x1, q[0]);
            y1 = Math.max(y1, q[1]);
          }
          occs.push({ poly: p, x0, y0, x1, y1 });
        }
      }
    },
    /** strokes for the overlay that is laid over the pelican (never clipped) */
    free(fn) {
      target = rail;
      clipOn = false;
      fn(E);
      target = main;
      clipOn = true;
    },
  };
}
function flush(groups, b) {
  const lum = (c) => parseInt(c.slice(1, 3), 16);
  const list = [...groups.values()].sort((x, y) => lum(y.color) - lum(x.color));
  for (const g of list) {
    b.set(g.brush, g.color, 1);
    for (const c of g.cmds) {
      b.strokeWeight(c.w);
      if (c.line) b.line(c.line[0], c.line[1], c.line[2], c.line[3]);
      else b.spline(c.pts, c.curve);
    }
  }
}

// ------------------------------------------------------------------------------------------- people
const ROBES = [['lite', '#ebe0c4', 0.86], ['wash', '#5a6e88', 0.5], ['wash', '#b98a42', 0.42], ['wash', '#857e73', 0.42], ['wash', '#a84a36', 0.42], ['wash', '#74835c', 0.44], ['lite', '#e2d5b2', 0.8], ['wash', '#8a6a48', 0.4]];
/**
 * One small figure: body baked in brisk ink strokes with a dab of colour; the head (and for a few a pointing arm)
 * is left to render() so it can turn. kind: robe | tunic | carry | woman | sit | lean | child
 */
function person(S, o) {
  const k = o.k ?? 1, bd = o.bd ?? 1, kind = o.kind ?? 'robe', d = o.d ?? 0.95;
  const P = (x, y) => [o.x + x * k * bd, o.y + y * k];
  const M = (pts) => pts.map(([x, y]) => P(x, y));
  const st = []; // [points, weight, tone offset]
  let sil, hy = -41, shY = -33;
  if (kind === 'robe' || kind === 'lean') {
    sil = [[-4.6, -36.5], [4.6, -36.5], [8.4, -25], [7.3, -5], [5.4, 0.4], [-5.4, 0.4], [-7.3, -5], [-8.4, -25]];
    const side = [[-3.6, -36.8], [-7.8, -26], [-7.4, -15], [-6.9, -5.4]];
    st.push([side, 1], [mir(side), 1], [[[-6.9, -5.4], [0, -4.5], [6.9, -5.4]], 0.85]);
    if (kind === 'robe') {
      const sl = [[-7.6, -25], [-4, -19.5], [-0.6, -21.5]];
      st.push([sl, 0.8], [[[-2.4, -36.6], [0.4, -31.5], [2.6, -36.4]], 0.7, -0.25], [[[0.4, -19], [0.8, -12], [0.2, -5.6]], 0.6, -0.375]);
      if (!o.point) st.push([mir(sl), 0.8]);
    } else {
      hy = -39.5;
      const arm = [[-7.4, -28], [-10.8, -22.5], [-9.6, -20]];
      st.push([arm, 0.8], [mir(arm), 0.8], [[[0, -35], [0.4, -20], [0, -6]], 0.6, -0.375]);
    }
    st.push([[[-4.6, -3.6], [-4.2, -0.4]], 1.5], [[[4.2, -3.6], [5.2, -0.4]], 1.5]);
  } else if (kind === 'woman') {
    sil = [[-3.8, -36.5], [3.8, -36.5], [6, -27], [4.8, -22], [7.8, -0.6], [-7.8, -0.6], [-4.8, -22], [-6, -27]];
    const side = [[-3, -36.8], [-5.7, -28], [-4.3, -22], [-7.5, -1.4]];
    const sl = [[-5.5, -28], [-2, -23.5], [0.6, -25]];
    st.push([side, 1], [mir(side), 1], [[[-7.5, -1.4], [0, -0.3], [7.5, -1.4]], 0.85], [[[-4.4, -22.4], [4.4, -22.4]], 0.7], [[[1, -22], [2.2, -12], [1.2, -5]], 0.6, -0.25], [sl, 0.75]);
    if (!o.point) st.push([mir(sl), 0.75]);
  } else if (kind === 'sit') {
    hy = -30;
    shY = -23;
    sil = [[-4.4, -25.6], [4.4, -25.6], [6.9, -15], [9.6, -9], [9.2, 0.4], [4.4, 0.4], [4, -6], [-6.3, -6], [-6.7, -15]];
    st.push([[[-3.4, -25.9], [-6.5, -16], [-6, -6.3]], 1], [[[3.4, -25.9], [6.5, -17], [9.3, -9.4], [8.7, -0.4]], 1], [[[-6, -6.3], [3.8, -6.3], [4.4, -0.4]], 0.85], [[[-6.2, -17], [-1, -13], [3, -14.6]], 0.8]);
  } else {
    // tunic and trousers (porters, boatmen, children); 'carry' adds a shoulder pole with two loads
    sil = [[-4.4, -36.5], [4.4, -36.5], [7.2, -26], [6.2, -18], [6.8, 0.4], [1.2, 0.4], [0, -11], [-1.2, 0.4], [-6.8, 0.4], [-6.2, -18], [-7.2, -26]];
    const side = [[-3.4, -36.8], [-6.6, -27], [-5.8, -18.4]];
    st.push([side, 1], [mir(side), 1], [[[-5.8, -18.4], [0, -17.6], [5.8, -18.4]], 0.85], [[[-5.8, -23.6], [5.8, -23.6]], 0.7]);
    st.push([[[-3.8, -17.8], [-5.2, -9], [-4.6, -0.6]], 1.1], [[[2.8, -17.8], [4.9, -9], [5.4, -0.6]], 1.1], [[[-1, -17.6], [-2, -9], [-2.4, -1]], 0.7], [[[0.6, -17.6], [2.3, -9], [3, -1]], 0.7]);
    if (kind === 'carry') st.push([[[-5.6, -33], [-9, -34.6], [-11.5, -37]], 0.8], [[[5.6, -33], [9, -34.6], [11.5, -37.6]], 0.8]);
    else {
      st.push([[[-5.6, -33], [-8.4, -25], [-7.4, -19.5]], 0.8]);
      if (!o.point) st.push([[[5.6, -33], [8.4, -25], [7.4, -19.5]], 0.8]);
    }
  }
  const hw = P(0, hy), robe = ROBES[(o.col ?? 0) % ROBES.length];
  const occ = [M(sil), K.ellipsePts(hw[0], hw[1] - 0.6 * k, 5.6 * k, 6.2 * k, 10)];
  const baskets = kind === 'carry' ? [M([[-30, -24], [-20, -24], [-21.5, -14], [-28.5, -14]]), M([[20, -24.6], [30, -24.6], [28.5, -14.6], [21.5, -14.6]])] : [];
  S.el({
    occ: occ.concat(baskets),
    ink(E) {
      const w = 0.6 * Math.max(0.75, k);
      for (const [p, wm, dt] of st) E.curve(M(p), { b: 'ink', t: d + (dt ?? 0), w: w * wm, press: [0.9, 1.15, 0.7] });
      if (kind === 'carry') {
        E.curve(M([[-25, -35.4], [0, -38.8], [25, -36]]), { t: d, w: 1.3 });
        for (const [bx, by] of [[-25, -35.4], [25, -36]]) {
          E.line(...P(bx, by), ...P(bx - 5, -24.3), { t: d - 0.25, w: 0.6 });
          E.line(...P(bx, by), ...P(bx + 5, -24.3), { t: d - 0.25, w: 0.6 });
        }
        for (const b of baskets) {
          E.pl(b, { t: d, w: 0.9 }, true);
          E.line(K.lerp(b[0][0], b[3][0], 0.45), K.lerp(b[0][1], b[3][1], 0.45), K.lerp(b[1][0], b[2][0], 0.45), K.lerp(b[1][1], b[2][1], 0.45), { t: d - 0.375, w: 0.6 });
        }
      }
      if (kind === 'sit') E.pl([P(-7.5, -6), P(-7.5, 0.2)], { t: d - 0.125, w: 0.8 });
    },
    wash(c) {
      if (robe[0] === 'wash') tint(c, M(sil), robe[1], robe[2] * (o.still ? 0.7 : 1));
      for (const b of baskets) tint(c, b, C.ochre, 0.42);
    },
    lite(c) {
      if (robe[0] === 'lite') tint(c, M(sil), robe[1], robe[2] * (o.still ? 0.6 : 1));
    },
  });
  if (o.still) {
    // far-off walk-ons: painted once, never animated
    S.stills.push({ x: hw[0], y: hw[1], r: 4.7 * k, ht: o.head ?? 0, face: o.d0 ?? 1, a: 0.5 + 0.5 * d });
    return;
  }
  const h1 = K.hash1(Math.round(o.x * 7 + o.y * 3));
  const R = o.R ?? 60 + 90 * h1;
  S.figs.push({
    x: hw[0], y: hw[1], r: 4.6 * k * (o.hr ?? 1), k, ht: o.head ?? 0, d0: o.d0 ?? 1, back: kind === 'lean', beard: o.beard ?? (kind === 'robe' && h1 > 0.62),
    tN: Math.max(-0.45 + hw[0] / 480, Math.round(tAt(hw[0] - R - 134) * 8) / 8), tP: tAt(hw[0] - 8),
    pt: !!o.point, sh: P(0, shY), side: bd, cloth: robe[0] === 'lite' ? robe[1] : K.mix('#d8c89e', robe[1], 0.55),
    grp: o.grp ?? 0, lag: 0.05 * K.hash1(Math.round(o.x * 13 + 5)), loser: !!o.loser,
  });
}

function donkey(S, x, y, k, dir, pack = true) {
  const P = (px, py) => [x + px * k * dir, y + py * k];
  const M = (pts) => pts.map(([px, py]) => P(px, py));
  const sil = M([[-16, -22], [-6, -24.4], [8, -24], [15, -27.4], [21, -34], [27, -31.4], [28, -26.4], [22, -23.4], [17.6, -16], [15, -10], [15, 0.4], [8, 0.4], [8, -10], [-10, -10.6], [-10, 0.4], [-17, 0.4], [-17.6, -14]]);
  const sacks = pack ? [K.ellipsePts(...P(-3, -27.5), 9.5 * k, 6 * k, 12), K.ellipsePts(...P(4, -31.5), 7 * k, 4.6 * k, 10)] : [];
  S.el({
    occ: [sil].concat(sacks),
    ink(E) {
      const o = { b: 'ink', t: 0.95, w: 0.62 * k, press: [0.9, 1.15, 0.7] };
      for (const p of [
        [[-16, -21], [-6, -23.8], [8, -23.2], [14, -26]], [[14, -26], [19, -32], [22, -34.2]], [[22, -34.2], [27.2, -30.8], [27.8, -27], [23, -25.4]], [[23, -25.4], [18.6, -21], [16.6, -15]],
        [[16.6, -15], [4, -11], [-10, -11.6], [-15, -14]], [[-16, -21], [-18.2, -16], [-15.4, -12]], [[13, -12], [14, -5], [13.4, 0]], [[9.6, -11], [9, -5], [9.8, 0]],
        [[-11, -11.6], [-12.6, -5], [-11.6, 0]], [[-14.6, -13], [-16.6, -6], [-15.6, 0]], [[21.4, -33.6], [20.4, -40.6]], [[23, -33.8], [24.4, -40]], [[-17.6, -19], [-21.4, -13], [-20.2, -8]],
      ]) E.curve(M(p), o);
      E.line(...P(24.6, -30.4), ...P(25.4, -29.6), { b: 'ink', t: 1, w: 1.2 * k });
      for (const s of sacks) E.curve(s.concat([s[0]]), { t: 0.9, w: 0.8, smooth: false });
      if (pack) E.line(...P(-1, -22), ...P(-1, -12), { t: 0.7, w: 0.7 });
    },
    wash(c) {
      tint(c, sil, '#6f675c', 0.42);
      for (const s of sacks) tint(c, s, C.ochre, 0.32);
    },
  });
}

/** a table of wares under one of the scroll's big square umbrellas; (x, y) = near-left foot of the table */
function stall(S, o) {
  const { x, y } = o, k = o.k ?? 1;
  const P = (px, py) => [x + px * k, y + py * k];
  const FL = P(-18, -60), FR = P(54, -60), BR = P(70, -80), BL = P(-2, -80);
  const canopy = [FL, FR, BR, BL];
  const val = [P(-18, -60), P(54, -60), P(70, -80), P(70, -75.4), P(54, -55.2), P(-18, -55.2)];
  const top = [P(0, -17), P(44, -17), P(53, -27), P(9, -27)];
  // umbrella first: it is nearer than the table it shades
  S.el({
    occ: [canopy, val, rect(P(26, 0)[0] - 1.4 * k, P(0, -60)[1], P(26, 0)[0] + 1.4 * k, P(0, -22)[1])],
    ink(E) {
      const t = 0.95;
      E.pl(canopy, { t, w: 1.2 }, true);
      E.pl([P(-18, -55.2), P(54, -55.2), P(70, -75.4)], { t, w: 0.9 });
      E.line(...FL, ...P(-18, -55.2), { t, w: 0.9 });
      E.line(...FR, ...P(54, -55.2), { t, w: 0.9 });
      E.line(...BR, ...P(70, -75.4), { t, w: 0.9 });
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      for (const [a, b] of [[FL, BR], [FR, BL], [mid(FL, FR), mid(BL, BR)], [mid(FL, BL), mid(FR, BR)]]) E.line(a[0], a[1], b[0], b[1], { t: 0.7, w: 0.7 });
      for (let i = 1; i < 12; i++) E.line(...P(-18 + i * 6, -60), ...P(-18 + i * 6, -55.2), { t: 0.55, w: 0.55 });
      E.line(...P(25.2, -60), ...P(25.2, -22), { t, w: 0.9 });
      E.line(...P(27, -60), ...P(27, -22), { t, w: 0.9 });
    },
    wash(c) {
      if (o.canopy) tint(c, canopy, o.canopy, 0.4);
      tint(c, val, o.trim ?? C.indigo, 0.5);
    },
    lite(c) {
      if (!o.canopy) tint(c, canopy, '#e9dec0', 0.88);
    },
  });
  S.el({
    occ: [top.concat([P(53, -9), P(44, 0), P(0, 0)])],
    ink(E) {
      const t = 0.95;
      E.pl(top, { t, w: 1.1 }, true);
      E.line(...P(0, -13.4), ...P(44, -13.4), { t, w: 0.8 });
      E.line(...P(44, -13.4), ...P(53, -23.4), { t, w: 0.8 });
      for (const [a, b] of [[P(1, -17), P(1, 0)], [P(43, -17), P(43, 0)], [P(52.4, -26), P(52.4, -9)]]) E.line(a[0], a[1], b[0], b[1], { t, w: 1.0 });
      // wares: bowls and stacked cakes in ruled rows
      for (let i = 0; i < 5; i++) {
        const c = P(9 + i * 8.4, -21.6 - (i % 2) * 3);
        E.curve([[c[0] - 2.8 * k, c[1]], [c[0], c[1] - 3 * k], [c[0] + 2.8 * k, c[1]]], { t: 0.8, w: 0.7 });
        E.line(c[0] - 2.8 * k, c[1], c[0] + 2.8 * k, c[1], { t: 0.8, w: 0.7 });
      }
    },
    wash(c) {
      tint(c, top, C.ochre, 0.3);
      tint(c, [P(0, -17), P(44, -17), P(44, -13.4), P(0, -13.4)], C.wood, 0.4);
    },
  });
}

function sedan(S, x, y, k) {
  const P = (px, py) => [x + px * k, y + py * k];
  const box = [P(-17, -52), P(17, -52), P(17, -12), P(-17, -12)], roof = [P(-21.5, -52), P(21.5, -52), P(15, -61.5), P(-15, -61.5)];
  S.el({
    occ: [rect(P(-58, 0)[0], P(0, -25.4)[1], P(58, 0)[0], P(0, -21)[1])],
    ink(E) {
      E.line(...P(-58, -25), ...P(58, -25), { t: 0.95, w: 1.1 });
      E.line(...P(-58, -21.6), ...P(58, -21.6), { t: 0.95, w: 1.1 });
    },
    wash(c) {
      tint(c, rect(P(-58, 0)[0], P(0, -25)[1], P(58, 0)[0], P(0, -21.6)[1]), C.wood, 0.45);
    },
  });
  S.el({
    occ: [box, roof],
    ink(E) {
      const t = 0.95;
      E.pl(box, { t, w: 1.2 }, true);
      E.pl(roof, { t, w: 1.2 }, true);
      E.line(...P(0, -61.5), ...P(0, -66.5), { t, w: 1.1 });
      E.line(...P(-2.4, -66.5), ...P(2.4, -66.5), { t, w: 1.3 });
      E.pl([P(-11, -46), P(11, -46), P(11, -29), P(-11, -29)], { t, w: 0.9 }, true);
      for (let i = -7.4; i < 11; i += 3.7) E.line(...P(i, -46), ...P(i, -37.5), { t: 0.6, w: 0.55 });
      for (const yy of [-42, -37.5]) E.line(...P(-11, yy), ...P(11, yy), { t: 0.6, w: 0.55 });
      E.curve([P(-11, -37.5), P(-5, -33), P(0, -35.6), P(6, -32.6), P(11, -37.5)], { t: 0.8, w: 0.7 });
      E.line(...P(-17, -16.4), ...P(17, -16.4), { t, w: 0.8 });
      for (const sx of [-15, 15]) E.line(...P(sx, -12), ...P(sx, -6.4), { t, w: 1.1 });
      for (let i = -17; i <= 17; i += 4.25) E.line(...P(i * 1.22, -52), ...P(i * 0.9, -60.5), { t: 0.55, w: 0.55 });
    },
    wash(c) {
      tint(c, box, C.green, 0.42);
      tint(c, roof, C.indigo, 0.5);
      tint(c, [P(-11, -37.5), P(11, -37.5), P(11, -29), P(-11, -29)], C.red, 0.5);
    },
  });
}

// ------------------------------------------------------------------------------------------- architecture
/**
 * A hall in oblique ruled line: front wall x0..x1 on the ground line yb, side wall receding by (sx, sy),
 * overhanging tiled (or thatched) roof. d = ink strength with distance (1 near … 0.5 far).
 */
function building(S, o) {
  const { x0, x1, yb, wh } = o;
  const sx = o.sx ?? 28, sy = o.sy ?? -31, rh = o.rh ?? 28, ov = o.ov ?? 9, d = o.d ?? 1;
  const TL = 0.95 * d, TT = 0.6 * d;
  const yE = yb - wh;
  const eL = [x0 - ov, yE + 3], eR = [x1 + ov, yE + 3];
  const rL = [eL[0] + sx / 2, eL[1] + sy / 2 - rh], rR = [eR[0] + sx / 2, eR[1] + sy / 2 - rh], bR = [eR[0] + sx, eR[1] + sy];
  const thatch = o.roof === 'thatch';
  S.el({
    occ: [[eL, eR, rR, rL], [eR, bR, rR]],
    ink(E) {
      E.line(eL[0], eL[1], eR[0], eR[1], { t: TL, w: 1.4 });
      E.line(rL[0], rL[1], rR[0], rR[1], { t: TL, w: 2.1 });
      E.line(rL[0] + 1, rL[1] + 3.2, rR[0] + 1, rR[1] + 3.2, { t: TL, w: 0.8 });
      E.line(rL[0], rL[1], rL[0] - 4, rL[1] - 4.5, { t: TL, w: 1.5 });
      E.line(rR[0], rR[1], rR[0] + 4.5, rR[1] - 4.5, { t: TL, w: 1.5 });
      E.line(eL[0], eL[1], rL[0], rL[1], { t: TL, w: 1.1 });
      E.line(eR[0], eR[1], rR[0], rR[1], { t: TL, w: 1.3 });
      E.line(eR[0] + 2.6, eR[1] - 1, rR[0] + 1.8, rR[1] + 3.6, { t: TL, w: 0.7 });
      E.line(rR[0], rR[1], bR[0], bR[1], { t: TL, w: 1.2 });
      E.line(rR[0] + 0.4, rR[1] + 3.8, bR[0] - 2.4, bR[1] + 1.2, { t: TL, w: 0.7 });
      E.line(rR[0] + 0.8, rR[1] + 3, rR[0] + 0.8, rR[1] + 10, { t: TL, w: 0.9 });
      if (thatch) {
        const rr = K.rng(Math.round(x0 * 7 + yb));
        for (let j = 1; j <= 4; j++) {
          const v = j / 5, ax = K.lerp(rL[0], eL[0], v), bx = K.lerp(rR[0], eR[0], v), yy = K.lerp(rL[1], eL[1], v);
          for (let x = ax + rr.range(0, 6); x < bx - 6; x += rr.range(9, 16)) E.line(x, yy + rr.range(-1, 1), x + rr.range(5, 10), yy + rr.range(-1, 1), { b: 'ink', t: TT, w: 0.5 });
        }
      } else {
        E.line(eL[0], eL[1] - 2.6, eR[0], eR[1] - 2.6, { t: TL, w: 0.8 });
        const n = Math.max(4, Math.round((eR[0] - eL[0]) / (o.sp ?? 5)));
        for (let i = 1; i < n; i++) {
          const u = i / n;
          E.line(K.lerp(rL[0], rR[0], u) + 0.6, rL[1] + 3.6, K.lerp(eL[0], eR[0], u), eL[1] - 2.9, { t: TT, w: 0.65 });
        }
      }
    },
    wash(c) {
      tint(c, [eL, eR, rR, rL], thatch ? C.thatch : C.roof, (thatch ? 0.36 : 0.46) * (0.5 + 0.5 * d));
      tint(c, [eR, bR, rR], C.wall, 0.22 * d);
    },
  });
  const bays = o.bays ?? Math.max(1, Math.round((x1 - x0) / 44));
  const fronts = Array.isArray(o.front) ? o.front : [o.front ?? 'wall'];
  const two = o.floors === 2, yM = yb - wh * 0.5, top = yE + 13.6;
  const side = [[x1, yb], [x1 + sx, yb + sy], [x1 + sx, yE + sy], [x1, yE]];
  const zones = [];
  for (let i = 0; i < bays; i++) {
    const a = K.lerp(x0, x1, i / bays) + 1.5, b = K.lerp(x0, x1, (i + 1) / bays) - 1.5;
    if (two) zones.push([a, b, top, yM - 9, 'grid'], [a, b, yM + 3, yb, fronts[i % fronts.length]]);
    else zones.push([a, b, top, yb, fronts[i % fronts.length]]);
  }
  S.el({
    occ: [rect(x0, yE, x1, yb), side],
    ink(E) {
      E.line(x0, yb, x1, yb, { t: TL, w: 1.1 });
      E.line(x1, yb, x1 + sx, yb + sy, { t: TL, w: 1.0 });
      E.line(x1 + sx, yb + sy, x1 + sx, yE + sy + 4, { t: TL, w: 1.0 });
      E.line(x0, yE + 11, x1, yE + 11, { t: TL, w: 1.0 });
      E.line(x0, top, x1, top, { t: TL, w: 0.7 });
      E.line(x1, yE + 11, x1 + sx, yE + 11 + sy, { t: TL, w: 0.8 });
      for (let i = 0; i <= bays; i++) {
        const cx = K.lerp(x0, x1, i / bays);
        E.line(cx - 1.5, yb, cx - 1.5, yE + 3.5, { t: TL, w: 0.95 });
        E.line(cx + 1.5, yb, cx + 1.5, yE + 3.5, { t: TL, w: 0.95 });
      }
      if (two) {
        E.line(x0 - 4, yM, x1 + 4, yM, { t: TL, w: 1.2 });
        E.line(x0 - 4, yM + 2.6, x1 + 4, yM + 2.6, { t: TL, w: 0.7 });
        E.line(x0 - 4, yM - 8.6, x1 + 4, yM - 8.6, { t: TL, w: 0.9 });
        for (let x = x0 - 4; x <= x1 + 4.1; x += 6) E.line(x, yM - 8.6, x, yM, { t: TT, w: 0.6 });
      }
      for (const [a, b, t0, t1, kind] of zones) {
        if (kind === 'lattice' || kind === 'grid') {
          const mid = kind === 'grid' ? t1 : t1 - (t1 - t0) * 0.36;
          E.line(a, mid, b, mid, { t: TL, w: 0.9 });
          for (let x = a + 4.2; x < b - 1; x += 4.2) E.line(x, t0, x, mid, { t: TT, w: 0.55 });
          for (let yy = t0 + 4.2; yy < mid - 1; yy += 4.2) E.line(a, yy, b, yy, { t: TT, w: 0.55 });
          if (kind === 'lattice') E.line((a + b) / 2, mid, (a + b) / 2, t1, { t: TT, w: 0.7 });
        } else if (kind === 'door') {
          E.line((a + b) / 2, t0, (a + b) / 2, t1, { t: TL, w: 0.8 });
          for (const u of [0.3, 0.62]) E.line(a, K.lerp(t0, t1, u), b, K.lerp(t0, t1, u), { t: TT, w: 0.6 });
        } else if (kind === 'wall') {
          const wx = (a + b) / 2, wy = K.lerp(t0, t1, 0.36);
          E.pl(rect(wx - 7, wy - 6, wx + 7, wy + 6), { t: TL, w: 0.8 }, true);
          for (const dx of [-3.5, 0, 3.5]) E.line(wx + dx, wy - 6, wx + dx, wy + 6, { t: TT, w: 0.55 });
        } else if (kind === 'open') {
          // open shop front: a scalloped cloth valance under the lintel
          E.line(a, t0 + 9, b, t0 + 9, { t: TT, w: 0.7 });
          const n = Math.max(2, Math.round((b - a) / 7));
          for (let j = 0; j < n; j++) {
            const xa = K.lerp(a, b, j / n), xb = K.lerp(a, b, (j + 1) / n);
            E.curve([[xa, t0 + 9], [(xa + xb) / 2, t0 + 12.6], [xb, t0 + 9]], { t: TT, w: 0.6 });
          }
        }
      }
      const yy = (x, y) => y + ((x - x1) / sx) * sy;
      const wx0 = x1 + sx * 0.28, wx1 = x1 + sx * 0.72, wt = yE + wh * 0.34, wb = yE + wh * 0.56;
      E.pl([[wx0, yy(wx0, wt)], [wx1, yy(wx1, wt)], [wx1, yy(wx1, wb)], [wx0, yy(wx0, wb)]], { t: TL, w: 0.75 }, true);
      E.line((wx0 + wx1) / 2, yy((wx0 + wx1) / 2, wt), (wx0 + wx1) / 2, yy((wx0 + wx1) / 2, wb), { t: TT, w: 0.55 });
    },
    wash(c) {
      tint(c, rect(x0, yE, x1, yb), C.wall, 0.13 * d);
      tint(c, side, C.wall, 0.3 * d);
      tint(c, rect(x0, yE + 3, x1, top), '#3a342c', 0.24 * d);
      for (let i = 0; i <= bays; i++) {
        const cx = K.lerp(x0, x1, i / bays);
        tint(c, rect(cx - 1.5, yE + 3.5, cx + 1.5, yb), C.wood, 0.55 * d);
      }
      if (two) tint(c, rect(x0 - 4, yM - 8.6, x1 + 4, yM + 2.6), C.wood, 0.36 * d);
      for (const [a, b, t0, t1, kind] of zones) {
        if (kind === 'open') {
          tint(c, rect(a, t0, b, t1), '#3a342c', 0.15 * d);
          tint(c, rect(a, t0, b, t0 + 10), o.cloth ?? C.indigo, 0.45 * d);
        } else if (kind === 'door') tint(c, rect(a, t0, b, t1), C.wood, 0.26 * d);
      }
    },
    lite(c) {
      for (const [a, b, t0, t1, kind] of zones) if (kind === 'lattice' || kind === 'grid') tint(c, rect(a, t0, b, kind === 'grid' ? t1 : t1 - (t1 - t0) * 0.36), '#e6dabb', 0.4 * d);
    },
  });
}

function signBoard(S, x, y, w, h, str, size, o = {}) {
  S.el({
    occ: [rect(x, y, x + w, y + h)],
    ink(E) {
      E.pl(rect(x, y, x + w, y + h), { t: 0.95, w: 1.0 }, true);
      if (o.hang) E.line(x + w / 2, y, x + w / 2, y - o.hang, { t: 0.95, w: 0.8 });
      if (o.feet) for (const fx of [x + 2, x + w - 2]) E.line(fx, y + h, fx, y + h + o.feet, { t: 0.95, w: 1.0 });
      if (o.cap) E.line(x - 3, y - 0.2, x + w + 3, y - 0.2, { t: 0.95, w: 1.6 });
    },
    wash(c) {
      if (o.trim) {
        tint(c, rect(x, y, x + w, y + 4), o.trim, 0.55);
        tint(c, rect(x, y + h - 4, x + w, y + h), o.trim, 0.55);
      }
    },
    lite(c) {
      tint(c, rect(x, y, x + w, y + h), o.paper ?? '#eadfc0', 0.92);
    },
  });
  S.texts.push({ str, x: x + w / 2, y: y + (o.pad ?? 4) + size * 0.55, size });
}

/** pollarded willow in new leaf: knotty dark trunk, sprays of hair-fine twigs, a breath of green */
function willow(S, x, y, h, o = {}) {
  const r = K.rng(o.seed ?? Math.round(x * 3 + y)), d = o.d ?? 1, k = h / 170, lean = o.lean ?? r.range(-0.25, 0.25);
  const top = [x + lean * h * 0.5, y - h * 0.46];
  const trunk = [[x, y], [x + lean * h * 0.12 + r.range(-4, 4) * k, y - h * 0.22], top];
  const nb = o.heads ?? 4, heads = [];
  for (let i = 0; i < nb; i++) {
    const a = -Math.PI / 2 + (i / (nb - 1) - 0.5) * 1.9 + r.range(-0.15, 0.15), len = h * r.range(0.14, 0.26);
    heads.push([top[0] + Math.cos(a) * len, top[1] + Math.sin(a) * len * 0.8]);
  }
  const body = K.ribbonPoly(K.catmull(trunk, 4), (u) => K.lerp(11, 6, u) * k);
  S.el({
    occ: [body],
    ink(E) {
      const kk = Math.max(0.7, k);
      for (const sgn of [-1, 1]) E.curve(trunk.map(([px, py], i) => [px + sgn * K.lerp(5.4, 3, i / 2) * k + r.range(-1, 1) * k, py]), { b: 'ink', t: 0.95 * d, w: 0.9 * kk, press: [1.2, 0.9, 1.0] });
      for (let i = 0; i < 9; i++) {
        const p = K.pointAt(trunk, r());
        const dx = r.range(-3, 3) * k;
        E.line(p[0] + dx, p[1], p[0] + dx + r.range(-1.5, 1.5) * k, p[1] + r.range(3, 7) * k, { b: 'ink', t: 0.7 * d, w: 0.7 });
      }
      for (const hd of heads) {
        E.curve([top, [(top[0] + hd[0]) / 2 + r.range(-3, 3), (top[1] + hd[1]) / 2 - 3 * k], hd], { b: 'ink', t: 0.95 * d, w: 1.2 * kk, press: [1.2, 0.9, 0.6] });
        const n = Math.round((o.twigs ?? 13) * (0.8 + 0.4 * r()));
        for (let j = 0; j < n; j++) {
          const a = -Math.PI / 2 + r.range(-1.25, 1.25), up = h * r.range(0.1, 0.24), out = Math.cos(a) * up * 1.25 + r.range(-6, 6) * k, drop = h * r.range(0.2, 0.5);
          const p1 = [hd[0] + out * 0.55, hd[1] + Math.sin(a) * up], p2 = [hd[0] + out, hd[1] + Math.sin(a) * up * 0.6 + drop * 0.35], p3 = [hd[0] + out * 1.08 + r.range(-3, 3) * k, hd[1] + drop];
          E.curve([hd, p1, p2, p3], { t: (r() < 0.5 ? 0.75 : 0.5) * d, w: 0.6, stride: 5 });
        }
      }
    },
    wash(c) {
      for (const hd of heads) I.wash(c, K.ellipsePts(hd[0], hd[1] + h * 0.13, h * 0.2, h * 0.25, 10), C.leaf, 0.34 * d, { feather: 9 * k + 3, mottle: 0.4, seed: Math.round(hd[0]) });
      tint(c, body, '#4a443c', 0.42 * d);
    },
  });
}

function smallBoat(S, x, y, k, o = {}) {
  const d = o.d ?? 0.6, dir = o.dir ?? 1;
  const P = (px, py) => [x + px * k * dir, y + py * k];
  const hull = [P(-40, -6), P(-30, 2), P(0, 5), P(30, 2), P(42, -8), P(30, -5), P(0, -3), P(-28, -5)];
  const cabin = [P(-22, -4), P(-21, -13), P(-4, -16), P(13, -13), P(14, -4)];
  const sail = o.sail ? [P(3, -60), P(33, -60), P(33, -20), P(3, -20)] : null;
  S.el({
    occ: [hull, cabin].concat(sail ? [sail] : []),
    ink(E) {
      E.curve([P(-40, -6), P(-28, 2.5), P(0, 5), P(30, 2), P(42, -8)], { t: 0.9 * d, w: 1.0 });
      E.curve([P(-40, -6), P(-26, -4.5), P(0, -3), P(28, -4.5), P(42, -8)], { t: 0.9 * d, w: 0.8 });
      E.curve(cabin, { t: 0.9 * d, w: 0.8 });
      for (let i = -16; i <= 10; i += 6) E.line(...P(i, -14.4), ...P(i, -4), { t: 0.55 * d, w: 0.55 });
      if (o.mast) {
        E.line(...P(18, -4), ...P(18, -66), { t: 0.9 * d, w: 1.0 });
        if (sail) {
          E.pl(sail, { t: 0.9 * d, w: 0.8 }, true);
          for (let yy = -55; yy < -21; yy += 5) E.line(...P(3, yy), ...P(33, yy), { t: 0.55 * d, w: 0.55 });
        } else {
          E.line(...P(18, -66), ...P(40, -8), { t: 0.6 * d, w: 0.55 });
          E.line(...P(18, -66), ...P(-38, -6), { t: 0.6 * d, w: 0.55 });
        }
      }
    },
    wash(c) {
      tint(c, hull, C.hull, 0.36 * d);
      tint(c, cabin, C.mat, 0.36 * d);
      if (sail) tint(c, sail, C.mat, 0.3 * d);
    },
  });
}

// ------------------------------------------------------------------------------------------- the wine shop's gate
function wineGate(S) {
  const cx = 925, y0 = 748, xs = [867, 903, 947, 983], y1 = 690, y2 = 652, y3 = 614, apex = [cx, 536];
  const lines = [], heavy = [];
  const add = (a, b, c, d, w = 1.0) => {
    lines.push([a, b, c, d, w]);
    if (w >= 1.25) heavy.push(K.ribbonPoly([[a, b], [c, d]], 3.2));
  };
  const ext = (a, b, c, d, e = 6) => {
    const l = Math.hypot(c - a, d - b) || 1, ux = (c - a) / l, uy = (d - b) / l;
    return [a - ux * e, b - uy * e, c + ux * e, d + uy * e];
  };
  const slopeY = (x) => y3 - (1 - Math.abs(x - cx) / (xs[3] + 4 - cx)) * (y3 - apex[1]);
  for (const x of xs) add(x, y0, x, slopeY(x) - 7, 1.5);
  for (const yy of [y1, y2, y3]) add(...ext(xs[0], yy, xs[3], yy, 8), 1.3);
  add(...ext(xs[0] - 4, y3, apex[0], apex[1], 9), 1.4);
  add(...ext(xs[3] + 4, y3, apex[0], apex[1], 9), 1.4);
  add(cx, y3, cx, apex[1] - 18, 1.3);
  for (const yy of [588, 562]) {
    const hx = (xs[3] + 4 - cx) * (1 - (y3 - yy) / (y3 - apex[1]));
    add(...ext(cx - hx, yy, cx + hx, yy, 6), 1.0);
  }
  const X = (xa, ya, xb, yb, w = 0.75) => {
    add(xa, ya, xb, yb, w);
    add(xa, yb, xb, ya, w);
  };
  const ym = (y0 + y1) / 2;
  for (const i of [0, 2]) {
    X(xs[i], y0, xs[i + 1], ym);
    X(xs[i], ym, xs[i + 1], y1);
    add(xs[i], ym, xs[i + 1], ym, 0.9);
  }
  for (let i = 0; i < 3; i++) {
    const m = (xs[i] + xs[i + 1]) / 2;
    X(xs[i], y1, m, y2);
    X(m, y1, xs[i + 1], y2);
    X(xs[i], y2, m, y3);
    X(m, y2, xs[i + 1], y3);
  }
  X(xs[1], y3, cx, 588);
  X(cx, y3, xs[2], 588);
  X(xs[1] + 8, 588, cx, 562);
  X(cx, 588, xs[2] - 8, 562);
  S.el({
    occ: heavy,
    ink(E) {
      for (const [a, b, c, d, w] of lines) E.line(a, b, c, d, { t: w >= 1.25 ? 1 : 0.85, w });
      // the door valance and a pennant on the peak
      for (let j = 0; j < 6; j++) {
        const xa = K.lerp(xs[1], xs[2], j / 6), xb = K.lerp(xs[1], xs[2], (j + 1) / 6);
        E.curve([[xa, y1 + 9], [(xa + xb) / 2, y1 + 13], [xb, y1 + 9]], { t: 0.8, w: 0.6 });
      }
      E.pl([[cx, 520], [942, 525], [cx, 530]], { t: 0.9, w: 0.8 });
    },
    wash(c) {
      tint(c, rect(xs[1], y1, xs[2], y1 + 10), C.red, 0.5);
      tint(c, [[cx, 520], [942, 525], [cx, 530]], C.red, 0.55);
      // silk wound round the poles, cloth strips hung from the beams
      xs.forEach((x, i) => {
        for (let yy = y0 - 22, n = 0; yy > slopeY(x) + 4; yy -= 27, n++) tint(c, rect(x - 2.3, yy - 5, x + 2.3, yy + 5), (n + i) % 2 ? C.indigo : C.red, 0.55);
      });
      for (let x = xs[0] + 3, n = 0; x < xs[3] - 3; x += 8.5, n++) if (n % 3 !== 2) tint(c, rect(x, y3 + 1.5, x + 4.4, y3 + 12 + (n % 2) * 4), n % 3 ? C.indigo : C.red, 0.5);
    },
    lite(c) {
      for (let x = xs[0] + 3, n = 0; x < xs[3] - 3; x += 8.5, n++) if (n % 3 === 2) tint(c, rect(x, y3 + 1.5, x + 4.4, y3 + 15), '#ece1c4', 0.85);
    },
  });
}

// ------------------------------------------------------------------------------------------- the grain boat
function grainBoat(S) {
  const t = 0.95;
  const hullPts = [];
  for (let x = -205; x <= 210; x += 15) hullPts.push([x, sheer(x)]);
  hullPts.push([212, sheer(210) + 1], [207, keel(210)]);
  for (let x = 195; x >= -205; x -= 16) hullPts.push([x, keel(x)]);
  hullPts.push([-208, sheer(-205)]);
  const hull = BWs(hullPts);
  const roof = BWs([[-158, -30], [-155, -42], [-147, -46.5], [84, -46.5], [92, -42], [95, -30]]);
  const cabin = [];
  for (let x = -150; x <= 86; x += 16) cabin.push([x, -31]);
  for (let x = 86; x >= -150; x -= 16) cabin.push([x, sheer(x) - 0.5]);
  const cabinW = BWs(cabin);
  const tip = [-150, -122], pivot = [60, -48];
  // rigging and the lowered mast
  S.el({
    occ: [K.ribbonPoly([bw(...pivot), bw(...tip)], 4.4), K.ribbonPoly([bw(-136, -46.5), bw(-136, -115)], 3.6)],
    ink(E) {
      const L2 = (a, b, o) => E.line(...bw(a[0], a[1]), ...bw(b[0], b[1]), o);
      L2([pivot[0], pivot[1] - 1.6], [tip[0] + 0.5, tip[1] - 1.2], { t, w: 1.1 });
      L2([pivot[0], pivot[1] + 1.8], [tip[0] - 0.5, tip[1] + 1.0], { t, w: 1.1 });
      L2([tip[0] - 2, tip[1] - 5], [tip[0] + 2.5, tip[1] + 5], { t, w: 1.3 });
      for (const u of [0.25, 0.5, 0.75]) {
        const m = [K.lerp(pivot[0], tip[0], u), K.lerp(pivot[1], tip[1], u)];
        L2([m[0] - 0.9, m[1] - 2.4], [m[0] + 0.9, m[1] + 2.6], { t: 0.7, w: 0.7 });
      }
      // the crutch it is being lowered onto
      L2([-137.4, -46.5], [-137.4, -112], { t, w: 1.0 });
      L2([-134.6, -46.5], [-134.6, -112], { t, w: 1.0 });
      L2([-136, -112], [-142, -120], { t, w: 1.1 });
      L2([-136, -112], [-130, -119], { t, w: 1.1 });
      // stays and a slack halyard
      L2(tip, [-204, -31], { t: 0.7, w: 0.6 });
      L2(tip, [98, -30], { t: 0.7, w: 0.6 });
      E.curve(BWs([tip, [-112, -74], [-62, -47]]), { t: 0.6, w: 0.6 });
      E.curve(BWs([[58, -50], [44, -66], [36, -74]]), { t: 0.7, w: 0.6 });
      // tabernacle
      L2([54, -46.5], [54, -56], { t, w: 1.1 });
      L2([66, -46.5], [66, -56], { t, w: 1.1 });
      L2([52, -56], [68, -56], { t, w: 1.1 });
    },
    wash(c) {
      tint(c, K.ribbonPoly([bw(...pivot), bw(...tip)], 3.4), C.hull, 0.4);
    },
  });
  // mat roof
  S.el({
    occ: [roof],
    ink(E) {
      E.curve(roof, { t, w: 1.2, smooth: false });
      E.line(...bw(-158, -30), ...bw(95, -30), { t, w: 1.2 });
      E.line(...bw(-153, -38.6), ...bw(90, -38.6), { t: 0.7, w: 0.7 });
      for (let x = -150; x < 84; x += 5.2) {
        E.line(...bw(x, -31), ...bw(Math.min(88, x + 8.4), -45.6), { t: 0.5, w: 0.5 });
        E.line(...bw(x + 8.4, -31), ...bw(Math.max(-152, x), -45.6), { t: 0.5, w: 0.5 });
      }
      for (let x = -124; x < 80; x += 34) {
        E.line(...bw(x, -30.4), ...bw(x, -46.2), { t, w: 0.9 });
        E.line(...bw(x + 2.2, -30.4), ...bw(x + 2.2, -46.2), { t, w: 0.9 });
      }
    },
    wash(c) {
      tint(c, roof, C.mat, 0.46);
    },
  });
  // cabin walls: shuttered panels
  S.el({
    occ: [cabinW],
    ink(E) {
      for (let x = -150, n = 0; x <= 86.1; x += 13.1, n++) {
        const bot = sheer(x) - 0.6;
        E.line(...bw(x, -30), ...bw(x, bot), { t, w: 0.9 });
        if (x < 80) {
          if (n % 3 === 1) {
            for (let q = 3.3; q < 12; q += 3.3) E.line(...bw(x + q, -28), ...bw(x + q, -21.6), { t: 0.55, w: 0.5 });
            E.line(...bw(x, -24.8), ...bw(x + 13.1, -24.8), { t: 0.55, w: 0.5 });
          } else if (n % 3 === 2) {
            E.line(...bw(x + 1.5, -28), ...bw(x + 11.6, -21.6), { t: 0.55, w: 0.5 });
            E.line(...bw(x + 11.6, -28), ...bw(x + 1.5, -21.6), { t: 0.55, w: 0.5 });
          }
        }
      }
      E.line(...bw(-150, -21), ...bw(86, -21), { t, w: 0.8 });
      E.line(...bw(-150, -17.6), ...bw(86, -15), { t: 0.6, w: 0.6 });
    },
    wash(c) {
      tint(c, cabinW, C.ochre, 0.26);
      for (let x = -150, n = 0; x < 80; x += 13.1, n++) if (n % 3 === 0) tint(c, BWs([[x + 1, -29], [x + 12, -29], [x + 12, -22], [x + 1, -22]]), '#2f2a24', 0.4);
    },
  });
  // hull: long ruled strakes with rows of nail heads, flat raked bow, big stern rudder
  S.el({
    occ: [hull],
    ink(E) {
      const sh = [], kl = [];
      for (let x = -205; x <= 210; x += 12) {
        sh.push(bw(x, sheer(x)));
        kl.push(bw(x, keel(x)));
      }
      E.curve(sh, { t: 1, w: 1.6 });
      E.curve(kl, { t: 1, w: 1.4 });
      for (const [v, w, tt] of [[0.12, 1.1, t], [0.34, 0.75, 0.8], [0.58, 0.75, 0.8], [0.82, 0.7, 0.7]]) {
        const p = [];
        for (let x = -205; x <= 210; x += 12) p.push(bw(x, K.lerp(sheer(x), keel(x), v)));
        E.curve(p, { t: tt, w });
      }
      for (const v of [0.23, 0.46, 0.7]) for (let x = -196; x <= 204; x += 9) E.line(...bw(x, K.lerp(sheer(x), keel(x), v) - 0.9), ...bw(x, K.lerp(sheer(x), keel(x), v) + 0.9), { t: 0.6, w: 0.7 });
      E.line(...bw(212, sheer(210) + 1), ...bw(207, keel(210)), { t: 1, w: 1.4 });
      E.line(...bw(-208, sheer(-205)), ...bw(-205, keel(-205)), { t: 1, w: 1.4 });
      for (const x of [112, 150, 188]) E.line(...bw(x, sheer(x)), ...bw(x, sheer(x) - 6), { t, w: 1.3 }); // bollards
      E.pl(BWs([[130, -6], [130, -13], [146, -13.6], [146, -6.6]]), { t, w: 0.9 }); // hatch
    },
    wash(c) {
      tint(c, hull, C.hull, 0.4);
      const low = [];
      for (let x = -205; x <= 210; x += 15) low.push(bw(x, K.lerp(sheer(x), keel(x), 0.58)));
      for (let x = 210; x >= -205; x -= 15) low.push(bw(x, keel(x)));
      tint(c, low, '#3c342a', 0.22);
    },
  });
  // rudder and the stern sweep
  const blade = BWs([[-209, 2], [-238, 8], [-243, 40], [-211, 37]]);
  S.el({
    occ: [blade],
    ink(E) {
      E.pl(blade, { t, w: 1.1 }, true);
      E.line(...bw(-209, -30), ...bw(-212, 37), { t, w: 1.3 });
      for (const u of [0.33, 0.66]) E.line(...bw(-209 - 30 * u, 3.5 + 2 * u), ...bw(-211 - 31 * u, 37.5 + 2 * u), { t: 0.6, w: 0.6 });
    },
    wash(c) {
      tint(c, blade, C.hull, 0.42);
    },
  });
}

// ------------------------------------------------------------------------------------------- build the picture
function buildScene() {
  const S = makeStage();
  const byNear = (list) => list.sort((a, b) => b.z - a.z).forEach((e) => e.fn());

  // ---- the near railing: baked on its own and laid over the pelican
  S.free((E) => {
    const X0 = 150, X1 = 850, H = 17;
    for (const [dy, w, t] of [[-H, 1.5, 'jiao'], [-H + 2.6, 0.8, 'nong'], [-8.6, 1.0, 'nong'], [-1.6, 0.9, 'nong']]) E.curve(fpts(nearY, X0, X1, 10, 0, dy), { t, w, smooth: false });
    for (let i = 0; i <= 28; i++) {
      const x = X0 + i * 25, y = nearY(x), h = i === 0 || i === 28 ? H + 9 : H + 3;
      E.line(x - 1.4, y, x - 1.4, y - h, { t: 'jiao', w: 1.1 });
      E.line(x + 1.4, y, x + 1.4, y - h, { t: 'jiao', w: 1.1 });
      E.line(x - 2.8, y - h, x + 2.8, y - h, { t: 'jiao', w: 1.4 });
    }
  });

  // ---- 1. the quays in the foreground
  const fg = [];
  const F = (z, fn) => fg.push({ z, fn });
  // left quay
  F(934, () => stall(S, { x: 20, y: 934, k: 1.12 }));
  F(925, () => person(S, { x: 60, y: 925, k: 1.15, kind: 'sit', col: 3, head: 0, d0: 1, R: 70 }));
  F(944, () => person(S, { x: 108, y: 944, k: 1.2, kind: 'robe', col: 1, head: 0, d0: -1, bd: -1, R: 110 }));
  F(936, () => person(S, { x: 138, y: 936, k: 0.74, kind: 'child', col: 4, head: 4, d0: -1, point: true, R: 130 }));
  F(988, () => person(S, { x: 62, y: 988, k: 1.22, kind: 'carry', col: 6, head: 2, d0: 1, R: 60 }));
  F(880, () => person(S, { x: 150, y: 880, k: 1.1, kind: 'woman', col: 5, head: 3, d0: 1, R: 90 }));
  // right quay
  F(968, () => sedan(S, 838, 968, 1.15));
  F(974, () => person(S, { x: 778, y: 974, k: 1.18, kind: 'tunic', col: 3, head: 1, d0: 1, R: 120 }));
  F(973, () => person(S, { x: 898, y: 973, k: 1.18, kind: 'tunic', col: 7, head: 2, d0: 1, R: 70 }));
  F(898, () => donkey(S, 796, 898, 1.15, -1));
  F(902, () => person(S, { x: 832, y: 902, k: 1.12, kind: 'tunic', col: 0, head: 1, d0: -1, bd: -1, R: 140 }));
  F(910, () => stall(S, { x: 926, y: 910, k: 1.1, canopy: C.ochre, trim: C.red }));
  F(902, () => person(S, { x: 968, y: 902, k: 1.12, kind: 'sit', col: 1, head: 0, d0: -1, bd: -1, R: 90 }));
  F(920, () => person(S, { x: 908, y: 920, k: 1.15, kind: 'woman', col: 4, head: 3, d0: 1, R: 110 }));
  F(982, () => person(S, { x: 964, y: 982, k: 1.2, kind: 'robe', col: 2, head: 0, d0: -1, point: true, R: 150 }));
  F(880, () => person(S, { x: 872, y: 880, k: 1.08, kind: 'robe', col: 6, head: 0, d0: 1, R: 80, beard: true }));
  byNear(fg);

  // ---- 2. the grain boat and its crew
  const crew = [
    { x: -186, y: -27, kind: 'tunic', head: 2, d0: -1, col: 3, bd: -1 },
    { x: -160, y: -18, kind: 'woman', head: 3, d0: 1, col: 4, k: 0.9 },
    { x: -122, y: -46.5, kind: 'tunic', head: 1, d0: 1, col: 0 },
    { x: -72, y: -46.5, kind: 'robe', head: 0, d0: -1, col: 1, point: true },
    { x: -22, y: -46.5, kind: 'tunic', head: 2, d0: 1, col: 6, loser: true, point: true, hr: 1.12 },
    { x: 30, y: -46.5, kind: 'tunic', head: 1, d0: -1, col: 7, bd: -1 },
    { x: 96, y: -4, kind: 'tunic', head: 2, d0: 1, col: 3 },
    { x: 128, y: -6, kind: 'tunic', head: 1, d0: 1, col: 0 },
    { x: 170, y: -13, kind: 'sit', head: 2, d0: 1, col: 5 },
  ];
  // poles first (they pass in front of everything on the boat)
  const poles = [[[-112, -70], [-52, 62]], [[-12, -72], [48, 60]], [[120, -32], [196, -105]], [[-178, -52], [-246, 16]]];
  for (const [a, b] of poles) {
    const A = bw(...a), B = bw(...b);
    S.el({
      occ: [K.ribbonPoly([A, B], 2.6)],
      ink(E) {
        E.line(A[0], A[1], B[0], B[1], { t: 1, w: 1.2 });
      },
    });
  }
  // the boat-hook's iron
  S.el({ ink(E) { const p = bw(196, -105), q = bw(203, -103), s = bw(199, -111); E.line(p[0], p[1], q[0], q[1], { t: 1, w: 1.1 }); E.line(p[0], p[1], s[0], s[1], { t: 1, w: 1.1 }); } });
  crew.sort((a, b) => b.y - a.y || a.x - b.x).forEach((m) => {
    const [wx, wy] = bw(m.x, m.y);
    person(S, { ...m, x: wx, y: wy, k: m.k ?? 0.98, grp: 1 });
  });
  grainBoat(S);

  // ---- 3. on the bridge and along the bank road
  const mid = [];
  const D = (z, fn) => mid.push({ z, fn });
  const rc = K.rng(77);
  const kinds = ['robe', 'robe', 'robe', 'tunic', 'tunic', 'woman', 'robe', 'carry', 'robe', 'child', 'tunic', 'robe', 'woman'];
  const headOf = (kind, r) => (kind === 'woman' ? 3 : kind === 'child' ? 4 : kind === 'robe' ? (r < 0.8 ? 0 : 1) : r < 0.45 ? 2 : 1);
  for (let x = 162; x < 846; x += rc.range(14, 21)) {
    let f = rc.range(0.3, 0.98), kind = rc.pick(kinds);
    if ((Math.abs(x - 322) < 46 || Math.abs(x - 664) < 46) && f > 0.55) f = rc.range(0.28, 0.52);
    if (Math.abs(x - 745) < 34 && f < 0.72) continue;
    if (x > 392 && x < 640 && f > 0.86) continue; // the far railing at the crest belongs to the leaners
    if (kind === 'carry' && f > 0.75) kind = 'tunic';
    const [px, py] = onDeck(x, f), hr = rc();
    const o = { x: px, y: py, kind, k: kind === 'child' ? 0.64 : rc.range(0.94, 1.05), col: rc.int(0, 7), head: headOf(kind, hr), d0: rc() < 0.72 ? 1 : -1, bd: rc.sign(), point: kind !== 'carry' && rc() < 0.17 };
    D(-f * 56, () => person(S, o));
  }
  for (const x of [398, 426, 462, 516, 548, 590, 622]) {
    const [px, py] = onDeck(x, 0.985);
    D(-55.4, () => person(S, { x: px, y: py, kind: 'lean', col: (x * 3) % 8, head: x % 3 === 0 ? 1 : 0, d0: -1, k: 0.98, R: 90 + (x % 5) * 14 }));
  }
  // stalls under umbrellas on the far side of the roadway
  for (const [x, tintC] of [[296, null], [640, C.ochre]]) {
    const [px, py] = onDeck(x, 0.74);
    D(-0.74 * 56, () => stall(S, { x: px, y: py, k: 0.92, canopy: tintC, trim: tintC ? C.indigo : C.red }));
    const [vx, vy] = onDeck(x + 30, 0.97);
    D(-0.97 * 56, () => person(S, { x: vx, y: vy, kind: 'sit', k: 0.95, col: x < 500 ? 5 : 1, head: 0, d0: x < 500 ? 1 : -1 }));
  }
  // a pack donkey being led up the far slope
  {
    const [dx, dy] = onDeck(742, 0.5), [gx, gy] = onDeck(770, 0.56);
    D(-0.5 * 56, () => donkey(S, dx, dy, 0.98, -1));
    D(-0.56 * 56, () => person(S, { x: gx, y: gy, kind: 'tunic', col: 7, head: 2, d0: -1, bd: -1, k: 0.98 }));
  }
  // bank road
  for (const [x, y, kind, col, head, d0, point] of [
    [20, 776, 'robe', 1, 0, 1, false], [46, 762, 'woman', 4, 3, -1, false], [78, 782, 'tunic', 3, 1, 1, true], [110, 766, 'robe', 0, 0, -1, false],
    [898, 772, 'robe', 2, 0, -1, false], [930, 783, 'carry', 6, 2, 1, false], [962, 768, 'robe', 5, 0, 1, true], [990, 781, 'child', 4, 4, -1, false],
    [914, 753, 'robe', 0, 0, 1, false], [938, 752, 'woman', 1, 3, -1, false],
  ]) D(y - 805, () => person(S, { x, y, kind, col, head, d0, point, k: kind === 'child' ? 0.64 : y < 756 ? 0.94 : 1 }));
  byNear(mid);

  // ---- 4. the bridge itself
  // near face: stone abutments, the timber arch, deck fascia
  {
    const top = fpts(nearY, 0, 1000, 10), arc = [];
    for (let i = 0; i <= 48; i++) arc.push(arcPt(TH - (i / 48) * 2 * TH, AR));
    const poly = top.concat([[1000, 824], [804, 824], [764, 846]], arc, [[236, 846], [196, 824], [0, 824]]);
    const masBot = (m) => (m < 236.7 ? wallBot(m) : arcY(m, AR + AT));
    const inMas = (m, y) => m >= 0 && m < 332 && y > nearY(m) + 4.4 && y < masBot(m) - 0.8;
    const band = [];
    for (let i = 0; i <= 48; i++) {
      const p = arcPt(-TH + (i / 48) * 2 * TH, AR + AT);
      band.push([p[0], Math.max(p[1], nearY(p[0]) + 3)]);
    }
    S.el({
      occ: [poly],
      ink(E) {
        E.curve(top, { t: 'jiao', w: 1.7, smooth: false });
        E.curve(fpts(nearY, 0, 1000, 10, 0, 3), { t: 'nong', w: 0.8, smooth: false });
        for (let j = 0; j <= 4; j++) {
          const rr = AR + (AT * j) / 4;
          let run = [];
          const end = () => {
            if (run.length > 2) E.curve(run, { t: j === 0 || j === 4 ? 'jiao' : 'nong', w: j === 0 ? 1.8 : j === 4 ? 1.3 : 0.8, smooth: false });
            run = [];
          };
          for (let th = -TH; th <= TH + 1e-6; th += TH / 90) {
            const p = arcPt(th, rr);
            if (p[1] > nearY(p[0]) + 3.8) run.push(p);
            else end();
          }
          end();
        }
        for (const sgn of [-1, 1]) {
          const a = arcPt(sgn * TH, AR), b = arcPt(sgn * TH, AR + AT);
          E.line(a[0], a[1], b[0], b[1], { t: 'jiao', w: 1.3 });
        }
        // iron straps across the ribs, and the ends of the cross-beams woven between them
        for (let i = -14; i <= 14; i++) {
          const th = (i * TH) / 14.6;
          let r1 = AR + AT - 1.2;
          while (r1 > AR + 4 && arcPt(th, r1)[1] < nearY(arcPt(th, r1)[0]) + 4.2) r1 -= 1.5;
          if (r1 > AR + 7) {
            for (const dth of [-0.0045, 0.0045]) {
              const a = arcPt(th + dth, AR + 1.4), b = arcPt(th + dth, r1);
              E.line(a[0], a[1], b[0], b[1], { t: 'nong', w: 0.8 });
            }
          }
          const tm = th + TH / 29.2, c = arcPt(tm, AR + AT * 0.5);
          if (i < 14 && c[1] > nearY(c[0]) + 9) {
            const cs = Math.cos(tm), sn = Math.sin(tm);
            E.pl([[-2.2, -2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2]].map(([u, v]) => [c[0] + u * cs - v * sn, c[1] + u * sn + v * cs]), { t: 'jiao', w: 0.85 }, true);
          }
        }
        // coursed masonry of the abutments and the road embankment
        for (const mx of [(x) => x, (x) => 1000 - x]) {
          for (let j = -4; j <= 9; j++) {
            const y = 824 - 8.5 * j;
            let a = null;
            for (let m = 0; m <= 332; m += 2) {
              const ok = inMas(m, y);
              if (ok && a == null) a = m;
              if (a != null && (!ok || m === 332)) {
                const b = ok ? m : m - 2;
                if (b - a > 3) E.line(mx(a), y, mx(b), y, { t: 0.7, w: 0.75 });
                a = null;
              }
            }
            for (let m = (j & 1 ? 11 : 0) + 5; m < 330; m += 22) {
              const ya = Math.max(y - 8.5, nearY(m) + 4.4), yb = Math.min(y, masBot(m) - 0.8);
              if (yb - ya > 3.5 && inMas(m, (ya + yb) / 2)) E.line(mx(m), ya, mx(m), yb, { t: 0.6, w: 0.65 });
            }
          }
          E.pl([[mx(0), 824], [mx(196), 824], [mx(236), 846], [mx(268), 858.4]], { t: 'jiao', w: 1.2 });
        }
      },
      wash(c) {
        for (const mx of [(x) => x, (x) => 1000 - x]) {
          const p = [];
          for (let m = 0; m <= 330; m += 6) p.push([mx(m), nearY(m) + 3]);
          for (let m = 330; m >= 0; m -= 6) p.push([mx(m), masBot(m)]);
          tint(c, p, C.stone, 0.3);
        }
        tint(c, band.concat(arc), C.wood, 0.42);
        tint(c, top.concat(fpts(nearY, 0, 1000, 10, 0, 3).reverse()), '#3a342c', 0.3);
        // shadow on the water under the span
        for (let q = 0; q < 16; q++) {
          const p = [];
          for (let i = 0; i <= 30; i++) p.push(arcPt(-TH + (i / 30) * 2 * TH, AR - q * 5));
          for (let i = 30; i >= 0; i--) p.push(arcPt(-TH + (i / 30) * 2 * TH, AR - (q + 1) * 5 - 0.4));
          tint(c, p, '#3f4a48', 0.34 * Math.pow(1 - q / 16, 1.6));
        }
      },
    });
  }
  // the two poles with wind-vane birds at the far corners of the bridge
  for (const x of [198, 846]) {
    const y = farY(x), top = y - 152;
    S.el({
      occ: [rect(x - 1.7, top, x + 1.7, y)],
      ink(E) {
        E.line(x - 1.1, y, x - 0.7, top, { t: 0.95, w: 0.9 });
        E.line(x + 1.1, y, x + 0.7, top, { t: 0.95, w: 0.9 });
        E.line(x - 10, top + 24, x + 10, top + 24, { t: 0.95, w: 1.2 });
        E.line(x - 10, top + 24, x - 10, top + 29, { t: 0.95, w: 0.9 });
        E.line(x + 10, top + 24, x + 10, top + 29, { t: 0.95, w: 0.9 });
        E.curve([[x - 8, top - 3], [x - 1, top - 7], [x + 5, top - 5.4]], { b: 'ink', t: 0.95, w: 1.4, press: [0.4, 1.3, 0.8] });
        E.curve([[x + 5, top - 5.4], [x + 8, top - 10.6], [x + 11.6, top - 11]], { b: 'ink', t: 0.95, w: 0.6 });
        E.line(x + 11.6, top - 11, x + 15.4, top - 10, { t: 0.95, w: 0.7 });
        E.line(x - 0.6, top - 4, x - 0.6, top, { t: 0.95, w: 0.7 });
      },
      wash(c) {
        tint(c, rect(x - 1.2, top, x + 1.2, y), C.wood, 0.4);
      },
    });
  }
  // roadway and far railing
  {
    const far = fpts(farY, -20, 1020, 10), near = fpts(nearY, -20, 1020, 10);
    const poly = far.concat(near.slice().reverse());
    S.el({
      occ: [poly],
      ink(E) {
        const X0 = 178, X1 = 870;
        E.curve(fpts(farY, X0, X1, 10), { t: 0.95, w: 1.2, smooth: false });
        E.curve(fpts(farY, X0, X1, 10, 0, -14.4), { t: 0.95, w: 1.2, smooth: false });
        E.curve(fpts(farY, X0, X1, 10, 0, -7.6), { t: 0.8, w: 0.8, smooth: false });
        for (let i = 0; i <= 30; i++) {
          const x = X0 + (i * (X1 - X0)) / 30, y = farY(x);
          E.line(x, y, x, y - 17, { t: 0.95, w: 1.0 });
          E.line(x - 2, y - 17, x + 2, y - 17, { t: 0.95, w: 1.2 });
        }
        // ruts and pebbles
        for (const f of [0.36, 0.64]) {
          for (let x = 4 + (f > 0.5 ? 17 : 0); x < 985; x += 47) {
            const a = onDeck(x, f), b = onDeck(x + 27, f);
            E.line(a[0], a[1], b[0], b[1], { t: 0.36, w: 0.7 });
          }
        }
        const r = K.rng(81);
        for (let i = 0; i < 110; i++) {
          const p = onDeck(r.range(0, 1000), r.range(0.08, 0.95));
          E.line(p[0], p[1], p[0] + r.range(1.5, 3.4), p[1] + r.range(-0.5, 0.5), { b: 'ink', t: 0.42, w: 0.5 });
        }
      },
      wash(c) {
        tint(c, poly, '#b79a62', 0.1);
      },
    });
  }

  // ---- 5. the front row of shops on both banks
  wineGate(S);
  S.el({
    ink(E) {
      E.line(866, 702, 820, 596, { t: 0.95, w: 1.2 });
      E.line(817, 598, 817, 604, { t: 0.8, w: 0.7 });
    },
  });
  signBoard(S, 807, 604, 20, 44, '新酒', 15, { trim: C.indigo, pad: 6 });
  signBoard(S, 845, 698, 17, 40, '正店', 13, { cap: true, feet: 9, pad: 5 });
  // seated customers in the tea house
  for (const [x, col, d0] of [[12, 3, 1], [70, 0, -1], [122, 5, 1]]) person(S, { x, y: 741, kind: 'sit', k: 0.9, col, head: 0, d0, bd: d0 });
  signBoard(S, 154, 688, 15, 38, '香茶', 13, { hang: 12, pad: 5 });
  building(S, { x0: 852, x1: 1034, yb: 744, wh: 98, rh: 34, floors: 2, bays: 4, front: ['open', 'door', 'open', 'lattice'], cloth: C.red });
  building(S, { x0: -32, x1: 150, yb: 744, wh: 76, rh: 30, ov: 10, bays: 3, front: 'open' });
  // tea tables inside
  S.el({
    ink(E) {
      for (const x of [26, 86, 136]) {
        E.line(x - 9, 728, x + 9, 728, { t: 0.8, w: 0.9 });
        E.line(x - 7, 728, x - 7, 743, { t: 0.8, w: 0.8 });
        E.line(x + 7, 728, x + 7, 743, { t: 0.8, w: 0.8 });
      }
    },
  });

  // ---- 6. the town and the river beyond, nearest first
  const back = [];
  const B = (z, fn) => back.push({ z, fn });
  B(722, () => willow(S, 246, 722, 178, { seed: 11, lean: 0.12, heads: 5 }));
  B(652, () => building(S, { x0: 60, x1: 236, yb: 652, wh: 64, sx: 26, sy: -29, rh: 27, d: 0.86, bays: 4, front: ['lattice', 'door', 'lattice', 'wall'] }));
  B(651.5, () => signBoard(S, 206, 600, 15, 38, '久住', 13, { pad: 5 }));
  B(640, () => building(S, { x0: -44, x1: 48, yb: 640, wh: 50, rh: 22, d: 0.86, roof: 'thatch', bays: 2, front: 'wall' }));
  B(604, () => willow(S, 838, 604, 118, { seed: 21, lean: -0.2, d: 0.85 }));
  B(600, () => building(S, { x0: 884, x1: 1036, yb: 600, wh: 58, sx: 24, sy: -27, rh: 26, d: 0.84, bays: 3, front: ['lattice', 'wall', 'lattice'] }));
  B(592, () => willow(S, 326, 592, 124, { seed: 12, lean: 0.25, d: 0.82 }));
  B(566, () => willow(S, 12, 566, 116, { seed: 13, lean: 0.1, d: 0.8 }));
  B(556, () => building(S, { x0: 150, x1: 296, yb: 556, wh: 54, sx: 22, sy: -25, rh: 24, d: 0.74, bays: 3, front: ['wall', 'door', 'lattice'] }));
  B(536, () => building(S, { x0: -34, x1: 126, yb: 536, wh: 52, sx: 22, sy: -25, rh: 24, d: 0.74, bays: 3, front: ['lattice', 'wall', 'door'] }));
  B(500, () => building(S, { x0: 908, x1: 1040, yb: 500, wh: 46, sx: 20, sy: -23, rh: 22, d: 0.68, bays: 3, front: 'wall' }));
  B(468, () => willow(S, 874, 468, 92, { seed: 22, lean: -0.15, d: 0.66, twigs: 10 }));
  B(462, () => willow(S, 384, 462, 96, { seed: 14, lean: 0.2, d: 0.64, twigs: 10 }));
  B(452, () => building(S, { x0: 96, x1: 250, yb: 452, wh: 44, sx: 18, sy: -20, rh: 20, d: 0.6, bays: 3, front: 'wall', sp: 5.5 }));
  B(428, () => building(S, { x0: -24, x1: 84, yb: 428, wh: 40, sx: 18, sy: -20, rh: 19, d: 0.56, bays: 2, front: 'wall', roof: 'thatch' }));
  B(420, () => building(S, { x0: 944, x1: 1040, yb: 420, wh: 40, sx: 18, sy: -20, rh: 19, d: 0.56, bays: 2, front: 'wall', sp: 5.5 }));
  B(372, () => willow(S, 300, 372, 80, { seed: 15, d: 0.52, twigs: 9 }));
  B(304, () => building(S, { x0: 36, x1: 160, yb: 304, wh: 30, sx: 14, sy: -15, rh: 15, d: 0.44, bays: 2, front: 'wall', sp: 6 }));
  B(292, () => building(S, { x0: 214, x1: 318, yb: 292, wh: 28, sx: 14, sy: -15, rh: 14, d: 0.4, bays: 2, front: 'wall', sp: 6 }));
  B(282, () => willow(S, 190, 282, 62, { seed: 16, d: 0.42, twigs: 8, heads: 3 }));
  B(276, () => willow(S, 372, 276, 56, { seed: 17, d: 0.38, twigs: 8, heads: 3 }));
  B(300, () => smallBoat(S, 700, 300, 0.34, { d: 0.36, mast: true, sail: true }));
  // river traffic
  B(520, () => smallBoat(S, 380, 522, 0.62, { d: 0.72, dir: -1 }));
  B(486, () => smallBoat(S, 604, 486, 0.7, { d: 0.7, mast: true }));
  B(412, () => smallBoat(S, 742, 412, 0.56, { d: 0.56, mast: true, sail: true }));
  B(356, () => smallBoat(S, 560, 356, 0.4, { d: 0.44, mast: true, dir: -1 }));
  // walk-ons, too far away to care
  for (const [x, y, kind, col] of [
    [272, 700, 'robe', 1], [296, 648, 'tunic', 3], [312, 620, 'robe', 0], [262, 668, 'woman', 4], [336, 560, 'robe', 6], [120, 656, 'robe', 2], [168, 660, 'tunic', 7], [26, 652, 'robe', 0],
    [806, 668, 'robe', 1], [822, 636, 'tunic', 6], [848, 610, 'robe', 4], [140, 560, 'robe', 5], [60, 548, 'tunic', 0], [362, 500, 'robe', 3], [896, 512, 'robe', 0], [868, 520, 'tunic', 2],
    [208, 466, 'robe', 1], [44, 440, 'robe', 6], [402, 430, 'tunic', 0],
  ]) B(y, () => person(S, { x, y, kind, col, still: true, head: kind === 'woman' ? 3 : kind === 'tunic' ? 1 : 0, d0: (x + y) % 2 ? 1 : -1, k: K.remap(y, 420, 700, 0.46, 0.68), d: K.remap(y, 420, 700, 0.62, 0.86) }));
  byNear(back);

  // ---- 7. banks, ground and water (behind everything)
  const r = K.rng(91);
  S.el({
    ink(E) {
      // bank lines: far banks, the two quays
      // an earth bank is a run of short broken strokes with its face hatched down to the water
      const bank = (line, sgn, d0, yMin, wgt) => {
        const P = K.resample(K.catmull(line, 6), 5).filter((p) => p[1] > yMin);
        for (let i = 0; i < P.length - 3; i += 3) {
          const seg = P.slice(i, i + 5).map(([x, y]) => [x + r.range(-1.3, 1.3), y + r.range(-0.8, 0.8)]);
          const d = d0 * K.remap(seg[0][1], yMin, yMin + 110, 0.45, 1);
          E.curve(seg, { b: 'ink', t: d, w: wgt, press: [1.1, 0.9, 0.6] });
          for (let j = 0; j < 2; j++) {
            const q = seg[1 + j * 2];
            if (r() < 0.75) E.line(q[0] + sgn * 1.5, q[1] + 1, q[0] + sgn * r.range(3, 8), q[1] + r.range(3, 7), { b: 'ink', t: d * 0.6, w: 0.5 });
          }
          if (r() < 0.3) {
            const q = seg[2], w = r.range(4, 8);
            E.curve([[q[0] - sgn * 2, q[1]], [q[0] - sgn * (2 + w / 2), q[1] - w * 0.6], [q[0] - sgn * (2 + w), q[1] + 0.5]], { b: 'ink', t: d * 0.8, w: 0.5 });
          }
        }
      };
      bank(FAR_L, 1, 0.8, 338, 0.7);
      bank(FAR_R, -1, 0.8, 338, 0.7);
      bank(BANK_L, 1, 0.95, 0, 0.9);
      bank(BANK_R, -1, 0.95, 0, 0.9);
      // grass and reeds on the banks
      for (const [line, sgn, n, d] of [[BANK_L, -1, 34, 0.8], [BANK_R, 1, 34, 0.8], [FAR_L, -1, 46, 0.55], [FAR_R, 1, 40, 0.55]]) {
        for (let i = 0; i < n; i++) {
          const p = K.pointAt(line, r()), off = sgn * r.range(1, 10), h = r.range(3, 8) * (d + 0.3);
          if (p[1] < 345) continue;
          for (const a of [-0.4, 0, 0.45]) E.line(p[0] + off, p[1], p[0] + off + a * h, p[1] - h, { t: d * r.range(0.6, 1), w: 0.55 });
        }
      }
      // mooring steps on the left quay
      for (let i = 0; i < 5; i++) E.line(176 - i * 7, 912 + i * 8, 198 - i * 7, 906 + i * 8, { t: 0.8, w: 0.8 });
      // tufts and stones on the ground
      for (let i = 0; i < 120; i++) {
        const x = r.range(0, 1000), y = r.range(828, 998);
        if (x > 200 && x < 720) continue;
        E.line(x, y, x + r.range(2, 5), y + r.range(-0.6, 0.6), { b: 'ink', t: 0.42, w: 0.5 });
      }
      // water: near, under the span and round the boat — long easy lines and a few eddies
      const nearWater = [];
      for (let i = 0; i <= 24; i++) nearWater.push(arcPt(-TH + (i / 24) * 2 * TH, AR));
      nearWater.push(...BANK_R.slice(1), ...BANK_L.slice().reverse());
      for (let i = 0; i < 300; i++) {
        const x = r.range(120, 760), y = r.range(712, 1000);
        if (!inPoly(x, y, nearWater)) continue;
        const l = r.range(16, 36), a = -0.1 + r.range(-0.06, 0.06), cs = Math.cos(a), sn = Math.sin(a);
        const q = (u, v) => [x + u * cs - v * sn, y + u * sn + v * cs];
        E.curve([q(-l / 2, 0.9), q(-l / 6, -1.3), q(l / 6, 1.1), q(l / 2, -0.7)], { t: r() < 0.4 ? 0.6 : 0.45, w: 0.65 });
      }
      for (const off of [7, 14, 22]) {
        for (let x0 = -210 + off * 3; x0 < 180; x0 += 96) {
          const p = [];
          for (let x = x0; x <= x0 + 64; x += 16) p.push(bw(x, keel(x) + off + 1.2 * Math.sin(x * 0.2 + off)));
          E.curve(p, { t: 0.6, w: 0.7 });
        }
      }
      for (const [ex, ey, er] of [[292, 936, 11], [706, 884, 10], [330, 868, 8], [676, 946, 9], [250, 968, 8], [566, 968, 9]]) {
        const p = [];
        for (let a = 0; a < 9.6; a += 0.5) {
          const rr = er * (1 - a / 11);
          p.push([ex + Math.cos(a) * rr, ey + Math.sin(a) * rr * 0.42]);
        }
        E.curve(p, { t: 0.6, w: 0.65, stride: 2 });
      }
      // water: the river beyond the bridge, thinning into the distance
      const farWater = FAR_L.concat(FAR_R.slice().reverse());
      for (let i = 0; i < 520; i++) {
        const y = 280 + 470 * Math.sqrt(r()), x = r.range(270, 990);
        if (!inPoly(x, y, farWater)) continue;
        const k = K.remap(y, 300, 740, 0.45, 1), l = r.range(12, 26) * k;
        E.curve([[x - l / 2, y + 0.7 * k], [x - l / 6, y - 1.1 * k], [x + l / 6, y + 0.9 * k], [x + l / 2, y - 0.5 * k]], { t: K.lerp(0.26, 0.5, k) * (r() < 0.3 ? 1.2 : 1), w: 0.6 });
      }
    },
    wash(c) {
      // ground
      tint(c, [[0, 824], [196, 824], [236, 846], ...BANK_L, [0, 1002]], C.earth, 0.17);
      tint(c, [[1000, 824], [804, 824], [764, 846], ...BANK_R, [1000, 1002]], C.earth, 0.17);
      tint(c, [[0, 744], ...FAR_L, [0, 270]], C.earth, 0.08);
      tint(c, [[1000, 744], ...FAR_R, [1000, 270]], C.earth, 0.08);
      I.wash(c, K.ribbonPoly(K.catmull(FAR_L.map(([x, y]) => [x - 13, y]), 4), 22), C.earth, 0.2, { feather: 7, mottle: 0, smooth: false });
      I.wash(c, K.ribbonPoly(K.catmull(FAR_R.map(([x, y]) => [x + 13, y]), 4), 22), C.earth, 0.2, { feather: 7, mottle: 0, smooth: false });
      // water
      const nearWater = [];
      for (let i = 0; i <= 24; i++) nearWater.push(arcPt(-TH + (i / 24) * 2 * TH, AR));
      nearWater.push(...BANK_R.slice(1), ...BANK_L.slice().reverse());
      tint(c, nearWater, C.water, 0.2);
      const farWater = FAR_L.concat(FAR_R.slice().reverse());
      tint(c, farWater, C.water, 0.15);
      for (const line of [FAR_L, FAR_R]) I.wash(c, K.ribbonPoly(K.catmull(line, 4), 26), C.water, 0.22, { feather: 9, mottle: 0, smooth: false });
      for (const [line, sgn] of [[BANK_L, 1], [BANK_R, -1]]) I.wash(c, K.ribbonPoly(K.catmull(line.map(([x, y]) => [x + sgn * 12, y]), 4), 26), C.water, 0.26, { feather: 8, mottle: 0, smooth: false });
      I.wash(c, BWs([[-210, 10], [0, 40], [210, 0], [214, 30], [0, 62], [-214, 40]]), '#3f4a48', 0.2, { feather: 7, mottle: 0 });
    },
  });
  return S;
}

// ------------------------------------------------------------------------------------------- per-frame: heads
const fillPts = (ctx, pts, c) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
};
const ell = (ctx, cx, cy, rx, ry, c) => {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fillStyle = c;
  ctx.fill();
};
const HAT_OUT = [[-2.08, -0.32], [-0.12, -1.98], [1.98, -0.48], [0.9, -0.26], [-1.0, -0.16]];
const HAT_IN = [[-1.76, -0.42], [-0.12, -1.72], [1.68, -0.55], [0.86, -0.42], [-0.96, -0.32]];
function hatShape(ctx) {
  fillPts(ctx, HAT_OUT, INKC);
  fillPts(ctx, HAT_IN, STRAW);
  fillPts(ctx, [[-0.2, -1.7], [-0.02, -1.7], [0.42, -0.45], [0.26, -0.44]], 'rgba(60,46,24,0.55)');
}
/** head in unit space, facing +x. ht: 0 futou cap · 1 topknot · 2 bamboo hat · 3 woman · 4 child */
function headShape(ctx, ht, beard) {
  ell(ctx, 0, 0.9, 0.42, 0.5, FLESH); // neck
  ell(ctx, 0.06, 0.05, 1.0, 1.12, INKC);
  ell(ctx, 0.06, 0.05, 0.85, 0.97, FLESH);
  fillPts(ctx, [[0.78, -0.18], [1.32, 0.14], [0.8, 0.38]], INKC);
  fillPts(ctx, [[0.7, -0.07], [1.13, 0.13], [0.72, 0.27]], FLESH);
  ell(ctx, 0.47, -0.1, 0.13, 0.1, INKC);
  if (beard) fillPts(ctx, [[0.2, 0.78], [0.92, 0.52], [0.64, 1.6]], 'rgba(26,23,20,0.85)');
  if (ht === 0) {
    fillPts(ctx, [[-0.98, 0.25], [-1.08, -0.45], [-0.8, -1.05], [-0.2, -1.3], [0.5, -1.18], [0.95, -0.72], [0.98, -0.42], [0.35, -0.5], [-0.15, -0.38], [-0.42, 0.1], [-0.55, 0.55]], INKC);
    ell(ctx, -0.62, -1.24, 0.38, 0.34, INKC);
    fillPts(ctx, [[-0.9, -0.2], [-1.8, 0.3], [-1.74, 0.46], [-0.86, 0.12]], INKC);
    fillPts(ctx, [[-0.9, 0.0], [-1.56, 0.74], [-1.46, 0.86], [-0.78, 0.26]], INKC);
  } else if (ht === 1) {
    fillPts(ctx, [[-0.95, 0.2], [-1.03, -0.5], [-0.7, -1.0], [0, -1.13], [0.6, -0.99], [0.93, -0.55], [0.3, -0.63], [-0.25, -0.5], [-0.5, 0.0], [-0.6, 0.45]], INKC);
    ell(ctx, -0.12, -1.38, 0.42, 0.38, INKC);
  } else if (ht === 2) {
    fillPts(ctx, [[-0.96, 0.3], [-1.02, -0.4], [-0.3, -0.5], [-0.5, 0.2]], INKC);
    hatShape(ctx);
  } else if (ht === 3) {
    fillPts(ctx, [[-1.0, 0.5], [-1.1, -0.5], [-0.8, -1.05], [0, -1.2], [0.7, -1.0], [0.96, -0.5], [0.4, -0.63], [-0.2, -0.45], [-0.45, 0.1], [-0.6, 0.76]], INKC);
    ell(ctx, -0.76, -1.26, 0.56, 0.5, INKC);
    ell(ctx, -0.26, -1.36, 0.2, 0.18, '#b04a36');
  } else {
    fillPts(ctx, [[-0.9, -0.1], [-0.98, -0.6], [-0.5, -1.0], [0.1, -1.05], [-0.3, -0.7], [-0.6, -0.2]], 'rgba(26,23,20,0.8)');
    ell(ctx, 0.05, -1.14, 0.26, 0.24, INKC);
  }
}
function drawCrowd(ctx, t, px, py) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const f of L.figs) {
    let face, tilt, hop, up, ht = f.ht, a = 1, tx = px, ty = py + 70;
    if (f.grp === 1) {
      // the boat's crew: all look up together on the crest
      const u = K.ease.outBack(K.prog(t, 3.0 + f.lag, 0.17), 2.2), dir = px >= f.x ? 1 : -1;
      face = K.lerp(f.d0, K.clamp((px - f.x) / 18, -1, 1) || dir, K.clamp(u, 0, 1));
      tilt = u * K.clamp(Math.atan2(f.y - py, Math.abs(px - f.x) + 30) * 0.8, 0.22, f.loser ? 1.05 : 0.85);
      hop = 1.8 * f.k * K.bump(t, 3.07 + f.lag, 0.09);
      up = K.clamp(u, 0, 1.1) * (1 - K.ease.io2(K.prog(t, 6.4, 1.2)));
      if (f.loser) {
        if (t >= 3.0) ht = 1;
        // … and once it is in the river, he looks after his hat instead
        const back = K.ease.io2(K.prog(t, 4.25, 0.3));
        face = K.lerp(face, -1, back);
        tilt = K.lerp(tilt, -0.5, back);
        up = K.clamp(u, 0, 1.1) * (1 - K.ease.io2(K.prog(t, 7.4, 1.4)));
        if (back > 0 && L.hat) {
          const d = 1 - Math.exp(-Math.max(0, t - 4) / 4);
          tx = K.lerp(tx, L.hat.x1 - 18 * d, back);
          ty = K.lerp(ty, L.hat.y1 + 8 * d, back);
        }
      }
    } else {
      a = K.ease.outBack(K.prog(t, f.tN, 0.2), 2.2);
      const b = K.ease.io2(K.prog(t, f.tP - 0.1, 0.26));
      face = K.lerp(K.lerp(f.back ? -0.4 : f.d0, -1, a), 1, b);
      tilt = K.clamp(a, 0, 1) * K.clamp(Math.atan2(f.y - py, Math.abs(px - f.x) + 40) * 0.7, 0, 0.6);
      hop = 1.5 * f.k * (K.bump(t, f.tN + 0.07, 0.08) + 0.6 * K.bump(t, f.tP + 0.04, 0.08));
      up = K.clamp(a, 0, 1.1) * (1 - K.ease.io2(K.prog(t, f.tP + 1.3 + f.lag * 8, 0.9)));
    }
    if (f.pt) {
      const aim0 = Math.atan2(ty - f.sh[1], tx - f.sh[0]), aim = aim0 < -Math.PI / 2 || aim0 > Math.PI / 2 ? (aim0 < 0 ? aim0 + TAU : aim0) : aim0;
      const ang = K.lerp(Math.PI / 2 + 0.2 * f.side, aim, up), len = 12.5 * f.k;
      const sx = f.sh[0] + Math.sign(Math.cos(ang) || 1) * Math.min(1, Math.abs(Math.cos(ang)) * 3) * 4.2 * f.k, sy = f.sh[1];
      const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = INKC;
      ctx.lineWidth = 3.5 * f.k;
      ctx.stroke();
      ctx.strokeStyle = f.cloth;
      ctx.lineWidth = 2.1 * f.k;
      ctx.stroke();
      ell(ctx, ex, ey, 1.25 * f.k, 1.25 * f.k, FLESH);
    }
    ctx.save();
    ctx.translate(f.x, f.y - hop);
    if (f.back && a < 0.5) {
      // seen from behind until they notice
      ctx.scale(f.r * (1 - a * 1.2), f.r);
      ell(ctx, 0, 0.9, 0.42, 0.5, FLESH);
      ell(ctx, 0, 0, 1.0, 1.1, INKC);
      ell(ctx, 0, -1.3, 0.42, 0.38, INKC);
    } else {
      const sx = (face < 0 ? -1 : 1) * K.clamp(Math.abs(face), 0.34, 1.12);
      ctx.scale(sx * f.r, f.r);
      if (tilt) ctx.rotate(-tilt);
      headShape(ctx, ht, f.beard);
    }
    ctx.restore();
  }
  ctx.restore();
}
/** the boatman's hat: off his head on the crest (t = 3), into the river on the next downbeat (t = 4), then adrift */
function drawHat(ctx, t) {
  const h = L.hat;
  if (!h || t < 3.0) return;
  const u = K.prog(t, 3.0, 1.0), r = h.r;
  let x, y, rot, sq;
  if (u < 1) {
    x = K.lerp(h.x0, h.x1, u);
    y = h.y0 + (h.y1 - h.y0) * u - 330 * u * (1 - u);
    rot = -0.5 - TAU * 1.25 * K.ease.out2(u);
    sq = 1;
  } else {
    const d = 1 - Math.exp(-(t - 4) / 4), age = t - 4;
    x = h.x1 - 18 * d;
    y = h.y1 + 8 * d + 0.7 * Math.sin(t * 2.4) * Math.exp(-age / 2.5);
    rot = -0.08 + 0.06 * Math.sin(t * 2.4) * Math.exp(-age / 2);
    sq = 0.62;
    ctx.save();
    ctx.strokeStyle = K.rgba('#3a3630', 1);
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) {
      const g = age - i * 0.24;
      if (g <= 0) continue;
      const rad = 6 + 24 * (1 - Math.exp(-g * 1.5));
      ctx.globalAlpha = 0.7 * Math.exp(-g * 0.9);
      ctx.beginPath();
      ctx.ellipse(h.x1, h.y1 + 2, rad, rad * 0.34, 0, 0, TAU);
      ctx.stroke();
    }
    // the ring it floats in
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(x, y + 1.5, 11.5, 3.4, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // a few drops thrown up
    if (age < 0.4) {
      ctx.globalAlpha = 0.8 * (1 - age / 0.4);
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.36, d0 = 5 + 34 * age, d1 = d0 + 4;
        ctx.beginPath();
        ctx.moveTo(h.x1 + Math.cos(a) * d0, h.y1 + Math.sin(a) * d0 + 60 * age * age);
        ctx.lineTo(h.x1 + Math.cos(a) * d1, h.y1 + Math.sin(a) * d1 + 60 * age * age);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(r * 1.15, r * 1.15 * sq);
  ctx.translate(0, 1.1);
  hatShape(ctx);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- per-frame: the pelican
// Fine even line with light colour: a white bird, a touch of ochre on the beak, the bicycle ruled in double lines
// with a wash of faded red between them — drawn in the same weight of line as the little figures.
const PINK = 'rgba(24,20,15,0.93)', WHITE = '#f1e9d6';
function drawPelican(ctx, pose) {
  const s = pose.s, lw = 1.35 * s;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const outline = (pts, closed, w = lw) => {
    K.path(ctx, pts, closed);
    ctx.strokeStyle = PINK;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  const tube = (pts, w, fill) => {
    const poly = K.ribbonPoly(pts.length > 2 ? K.catmull(pts, 4) : pts, w);
    K.fillPoly(ctx, poly, WHITE);
    if (fill) K.fillPoly(ctx, poly, fill);
    outline(poly, true, lw * 0.85);
  };
  for (const p of Rig.parts(pose)) {
    ctx.globalAlpha = p.far ? 0.74 : 1;
    if (p.kind === 'poly') {
      if (p.role === 'saddle') {
        K.fillPoly(ctx, p.pts, 'rgba(34,29,24,0.9)');
      } else if (p.role === 'metal') {
        K.fillPoly(ctx, p.pts, 'rgba(52,46,40,0.85)');
      } else if (p.role === 'foot') {
        K.fillPoly(ctx, p.pts, WHITE);
        K.fillPoly(ctx, p.pts, 'rgba(196,140,66,0.62)');
        outline(p.pts, true, lw * 0.85);
      } else if (p.role === 'scarf') {
        K.fillPoly(ctx, p.pts, 'rgba(172,66,46,0.82)');
        outline(p.pts, true, lw * 0.6);
      } else {
        K.fillPoly(ctx, p.pts, WHITE);
        if (p.role === 'wing') K.fillPoly(ctx, p.pts, 'rgba(126,120,108,0.2)');
        else if (p.role === 'tail') K.fillPoly(ctx, p.pts, 'rgba(70,64,56,0.42)');
        else if (p.role === 'pouch') K.fillPoly(ctx, p.pts, 'rgba(198,130,60,0.5)');
        else if (p.role === 'beak') K.fillPoly(ctx, p.pts, 'rgba(206,164,84,0.42)');
        outline(p.pts, true);
      }
    } else if (p.kind === 'line') {
      if (p.role === 'frame') tube(p.pts, Math.max(3.4 * s, p.w * 0.66), 'rgba(170,70,48,0.5)');
      else if (p.role === 'leg') tube(p.pts, Math.max(3.4 * s, p.w * 0.5), 'rgba(196,140,66,0.6)');
      else if (p.role === 'scarf') {
        const P = K.resample(p.pts, 6);
        K.ribbon(ctx, P, (u) => Math.max(1.2, p.w * (0.75 - 0.4 * u)), 'rgba(172,66,46,0.8)');
        ctx.globalAlpha *= 0.55;
        outline(K.ribbonPoly(P, (u) => Math.max(1.2, p.w * (0.75 - 0.4 * u))), true, lw * 0.55);
      } else if (p.role === 'mark') {
        ctx.globalAlpha = 0.8;
        outline(p.pts, false, lw * 0.75);
        if (p.name !== 'beakLine') {
          // feather barbs: short hair strokes off each quill line
          ctx.beginPath();
          for (let i = 1; i < p.pts.length - 1; i += 2) {
            const a = p.pts[i - 1], b = p.pts[i + 1], q = p.pts[i];
            const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
            ctx.moveTo(q[0], q[1]);
            ctx.lineTo(q[0] + (nx * 5 + (b[0] - a[0]) / l * 3.4) * s, q[1] + (ny * 5 + (b[1] - a[1]) / l * 3.4) * s);
          }
          ctx.lineWidth = lw * 0.5;
          ctx.stroke();
        }
      } else if (p.role === 'metal') {
        K.path(ctx, p.pts, false);
        ctx.strokeStyle = PINK;
        ctx.lineWidth = Math.max(lw, p.w * 0.42);
        ctx.stroke();
      } else outline(p.pts, false, p.role === 'head' ? lw * 0.9 : lw);
    } else if (p.kind === 'wheel') {
      const [cx, cy] = p.c, r = p.r;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.98, 0, TAU);
      ctx.fillStyle = 'rgba(222,208,172,0.56)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.925, 0, TAU);
      ctx.strokeStyle = 'rgba(66,60,52,0.4)';
      ctx.lineWidth = r * 0.125;
      ctx.stroke();
      ctx.strokeStyle = PINK;
      ctx.lineWidth = lw * 1.05;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.987, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = lw * 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.862, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = lw * 0.5;
      ctx.beginPath();
      for (const [a, b] of Rig.spokes(p, 16, 0.1, 0.86)) {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.1, 0, TAU);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();
    } else if (p.kind === 'disc') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r, 0, TAU);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.fillStyle = 'rgba(96,88,76,0.28)';
      ctx.fill();
      ctx.strokeStyle = PINK;
      ctx.lineWidth = lw * 0.85;
      ctx.stroke();
      if (p.r > 9 * s) {
        ctx.lineWidth = lw * 0.6;
        ctx.beginPath();
        ctx.arc(p.c[0], p.c[1], p.r * 0.56, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = pose.crank + (i * TAU) / 5;
          ctx.moveTo(p.c[0] + Math.cos(a) * p.r * 0.56, p.c[1] + Math.sin(a) * p.r * 0.56);
          ctx.lineTo(p.c[0] + Math.cos(a) * p.r, p.c[1] + Math.sin(a) * p.r);
        }
        ctx.stroke();
      }
    } else if (p.kind === 'eye') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r, 0, TAU);
      ctx.fillStyle = '#f6efdc';
      ctx.fill();
      ctx.strokeStyle = PINK;
      ctx.lineWidth = lw * 0.6;
      ctx.stroke();
      if (p.lid < 0.5) {
        ctx.beginPath();
        ctx.arc(p.pupil[0], p.pupil[1], p.pr, 0, TAU);
        ctx.fillStyle = PINK;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(p.c[0] - p.r, p.c[1]);
        ctx.lineTo(p.c[0] + p.r, p.c[1]);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- title slip
function drawTitle(ctx, title) {
  const sx = 902, sy = 30, sw = 66, sh = 288;
  ctx.save();
  ctx.fillStyle = '#e8dbb6';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.drawImage(K.noiseLayer({ w: sw, h: sh, scale: 40, oct: 3, seed: 9, color: '#a88c52', lo: 0.45, hi: 0.9, alpha: 0.3, res: 1 }), sx, sy, sw, sh);
  K.grain(ctx, sx, sy, sw, sh, { color: '#6a5028', alpha: 0.1, seed: 9 });
  ctx.strokeStyle = 'rgba(38,29,18,0.9)';
  ctx.lineWidth = 1.7;
  ctx.strokeRect(sx + 0.9, sy + 0.9, sw - 1.8, sh - 1.8);
  ctx.lineWidth = 0.7;
  ctx.strokeRect(sx + 5, sy + 5, sw - 10, sh - 10);
  ctx.restore();
  K.vtext(ctx, title.zh, sx + sw / 2, sy + 39, { size: 46, gap: 52.5, font: K.FONT.cjkSerif, weight: 900, color: '#17130f' });
  const i = title.en.indexOf(' the Qingming');
  const lines = i > 0 ? [title.en.slice(0, i), title.en.slice(i + 1)] : [title.en];
  const ink = '#1a1511', ex = sx - 18;
  lines.forEach((ln, n) => K.text(ctx, ln, ex, 64 + n * 34, { size: 28, font: K.FONT.serif, weight: 700, align: 'right', color: ink }));
  K.text(ctx, title.date, ex, 64 + lines.length * 34 - 1, { size: 24, font: K.FONT.serif, weight: 700, italic: true, align: 'right', color: ink });
  ctx.save();
  ctx.globalAlpha = 0.88;
  K.put(ctx, K.seal('鵜鶘之印', { size: 46, seed: 3 }), sx + 6, sy + sh + 10);
  K.put(ctx, K.seal('神品', { size: 32, relief: 'zhu', seed: 4 }), ex - 36, 64 + lines.length * 34 + 14);
  K.put(ctx, K.seal('清賞', { size: 36, seed: 5 }), 22, 22);
  K.put(ctx, K.seal('珍玩', { size: 30, relief: 'zhu', seed: 6 }), 26, 70);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the scene
const push = (t) => K.ease.io3(K.prog(t, 1.6, 1.2)) * (1 - K.ease.io3(K.prog(t, 4.4, 1.2)));

export default {
  id: 6, key: 'qingming', title: TITLES[6], heroT: 3.3,

  // over the arch: both wheels on the deck, exactly on the road line within 7 % of each frame
  path(u) {
    if (u < 0.07 || u > 0.93) return { dy: 0, s: 1, rot: 0 };
    const lx = -K.FRAME + K.PITCH * u, yR = deckY(lx - 80), yF = deckY(lx + 80);
    return { dy: (yR + yF) / 2 - RY, s: 1, rot: Math.atan2(yF - yR, 160) };
  },
  act(t, p) {
    const g = K.gate(t, 0.5, 5.5, 0.4), slope = -(p.rot || 0) / 0.54;
    p.lean = 0.09 * slope * g; // into the climb, back on the way down
    p.neck = (0.5 * Math.max(0, slope) - 0.15 * Math.max(0, -slope)) * g;
    const crest = K.bump(t, 3.1, 0.5) * g;
    p.eye = [0.25 * crest, 0.85 * crest]; // one glance down at the river
  },
  camera(t) {
    const k = push(t);
    if (k <= 0) return null;
    return { zoom: 1 + 0.22 * k, dy: 92 * k };
  },

  async init() {
    const S = buildScene();
    const ground = I.silk({ res: RES, seed: 6, base: GROUND });
    const inkRaw = await K.bake({ w: 1000, h: 1000, res: RES, bg: '#ffffff', seed: 606 }, (b) => flush(S.main, b));
    const rail = await K.bake({ w: RAILBOX.w, h: RAILBOX.h, res: RES, bg: '#ffffff', seed: 607 }, (b, p) => {
      p.translate(-RAILBOX.x, -RAILBOX.y);
      flush(S.rail, b);
    });
    {
      const rc = rail.getContext('2d');
      rc.save();
      rc.setTransform(rail.width / RAILBOX.w, 0, 0, rail.height / RAILBOX.h, 0, 0);
      rc.translate(-RAILBOX.x, -RAILBOX.y);
      rc.globalCompositeOperation = 'multiply';
      tint(rc, fpts(nearY, 150, 850, 10, 0, -17).concat(fpts(nearY, 150, 850, 10, 0, -14.4).reverse()), C.wood, 0.5);
      tint(rc, fpts(nearY, 150, 850, 10, 0, -9.6).concat(fpts(nearY, 150, 850, 10, 0, -7.6).reverse()), C.wood, 0.4);
      for (let i = 0; i <= 28; i++) {
        const x = 150 + i * 25, y = nearY(x), h = i === 0 || i === 28 ? 26 : 20;
        tint(rc, rect(x - 1.4, y - h, x + 1.4, y), C.wood, 0.5);
      }
      rc.restore();
    }
    // colour: back → front, each element first clearing its own silhouette out of whatever lies behind it
    const wash = K.layer(1000, 1000, RES, (c) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, 1000, 1000);
    });
    const lite = K.layer(1000, 1000, RES);
    const wc = wash.getContext('2d'), lc = lite.getContext('2d');
    for (let i = S.ops.length - 1; i >= 0; i--) {
      const e = S.ops[i];
      if (e.occ) {
        for (const p of e.occ) {
          if (!p || p.length < 3) continue;
          K.fillPoly(wc, p, '#ffffff');
          lc.globalCompositeOperation = 'destination-out';
          K.fillPoly(lc, p, '#000000');
          lc.globalCompositeOperation = 'source-over';
        }
      }
      if (e.wash) e.wash(wc);
      if (e.lite) e.lite(lc);
    }
    // pigment pools unevenly; the far town thins into mist
    wc.drawImage(K.noiseLayer({ scale: 44, oct: 3, seed: 66, color: '#ffffff', lo: 0.42, hi: 0.9, alpha: 0.36, res: 0.5 }), 0, 0, 1000, 1000);
    const mist = (c) => {
      I.mist(c, -10, 236, 1020, 200, { color: '#ffffff', strength: 0.94, seed: 61, wisps: 0.6 });
      const g = c.createLinearGradient(0, 0, 0, 250);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.3)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1000, 250);
    };
    mist(wc);
    const ink = K.layer(1000, 1000, RES, (c) => {
      K.put(c, inkRaw);
      mist(c);
    });
    const base = K.layer(1000, 1000, RES, (ctx) => {
      K.put(ctx, ground);
      K.put(ctx, lite);
      K.putBlend(ctx, wash, 'multiply', 1);
      K.putBlend(ctx, ink, 'multiply', 0.96);
      for (const s of S.texts) K.vtext(ctx, s.str, s.x, s.y, { size: s.size, gap: s.size * 1.08, font: K.FONT.cjkSerif, weight: 700, color: '#191511' });
      for (const h of S.stills) {
        ctx.save();
        ctx.globalAlpha = h.a;
        ctx.translate(h.x, h.y);
        ctx.scale(h.face * h.r, h.r);
        headShape(ctx, h.ht, false);
        ctx.restore();
      }
      drawTitle(ctx, TITLES[6]);
    });
    const loser = S.figs.find((f) => f.loser);
    L = {
      base, rail, figs: S.figs,
      hat: loser ? { x0: loser.x, y0: loser.y - loser.r * 0.6, r: loser.r, x1: loser.x - 70, y1: 963 } : null,
    };
  },

  render(ctx, t, env) {
    K.put(ctx, L.base);
    const lx = env.rider.lx;
    drawCrowd(ctx, t, lx + 30, rideY(lx) - 250);
    drawHat(ctx, t);
    if (env.pose) drawPelican(ctx, env.pose);
    K.putBlend(ctx, L.rail, 'multiply', 0.96, RAILBOX.x, RAILBOX.y, RAILBOX.w, RAILBOX.h);
    I.weave(ctx, 0, 0, 1000, 1000, 0.4);
  },
};
