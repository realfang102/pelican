// Section 13 — Munch, The Scream (1893)
// Thin tempera and crayon dragged over brown cardboard: a blood-orange sky in long undulating ribbons, the fjord
// swirling in the same rhythm, and the bridge — deck planks and a railing converging steeply to the left.
//
// Technique: every band is a "streak" — a ribbon of separate dry bristles that skip, so the board shows between them
// (Canvas 2D), with p5.brush crayon lines worked over the top. Sky + fjord are baked into one layer that is redrawn in
// narrow columns with sine offsets (the undulation; its amplitude follows the scream). Deck, railing, the two men and
// the title are a static front layer. The figure and the pelican are painted every frame from a few parameters and
// scrubbed with a board-anchored mask so the cardboard shows through them as well.
//
// Gag: the figure screams as painted until beat 2 of bar 2 (t = 2.5), when the pelican comes level: hands down, mouth a
// small "o", head turns to follow the bicycle; the landscape calms. Afterwards it looks after the pelican, then slowly
// raises its hands again.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const INK = '#141a29';
const SKIN = '#cdbd8c';
const MY = 40, BH = 790, BTOT = MY + BH; // back layer rows: picture y −40 … 790
const TW = 470, TH = 470, TRES = 1.25; // scratch canvas for the scrubbed sprites
const T_SNAP = 2.5;
const FX = 735, FY = 782; // the figure: x, feet

// ---- the bridge's perspective: everything converges on VP, far off to the left
const VP = [-420, 370];
const pf = (x) => (x + 420) / 1420; // 0 at the vanishing point … 1 at the right edge
const railY = (x, k) => VP[1] + k * pf(x);
const RAIL_TOP = 215, RAIL_MID = 292, RAIL_BASE = 365;

// ---- the picture's rhythm
const HZ = (x) => 350 + 7 * Math.sin(x * 0.0062 + 1.0) + 4 * Math.sin(x * 0.017);
const skyY = (x, y0, seed) => {
  const A = 8 + 17 * Math.sin(Math.PI * K.clamp((y0 + 30) / 400));
  return y0 + A * Math.sin(x * 0.0068 + 0.6 + y0 * 0.0045) + A * 0.45 * Math.sin(x * 0.0155 + 2.0 - y0 * 0.008) + (K.noise1(x * 0.004, seed) - 0.5) * 10;
};
const DEPTH = (x) => railY(x, RAIL_BASE) + 18 - HZ(x);
const landY = (x, d, seed = 0) =>
  HZ(x) + d * DEPTH(x) + d * 40 * Math.sin(x * 0.0082 + 1.1 + d * 2.6) * K.smoothstep(-100, 350, x) +
  Math.pow(Math.max(d, 0), 1.3) * 150 * Math.pow(K.smoothstep(740, 1060, x), 2) + (K.noise1(x * 0.005, seed) - 0.5) * 8 * (0.3 + Math.max(d, 0));
const skyPath = (y0, xa, xb, seed, step = 6) => {
  const pts = [];
  for (let x = xa; x <= xb; x += step) pts.push([x, skyY(x, y0, seed)]);
  return pts;
};
const landPath = (d, xa, xb, seed, step = 6) => {
  const pts = [];
  for (let x = xa; x <= xb; x += step) pts.push([x, landY(x, d, seed)]);
  return pts;
};
const pl = (u, stops) => {
  if (u <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (u <= stops[i][0]) return K.lerp(stops[i - 1][1], stops[i][1], (u - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return stops[stops.length - 1][1];
};
const nameSeed = (s) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return h;
};

/**
 * A dragged stroke of thin paint: `w` wide, made of separate bristles that vary in tone and run dry (skip).
 * o.dry 0..1, o.alpha, o.vary tone variation, o.skip length of the dry patches, o.press(u) width multiplier,
 * o.rag ragged ends, o.bristle bristle spacing.
 */
function streak(ctx, pts, w, col, seed, o = {}) {
  const n = pts.length;
  if (n < 2) return;
  const dry = o.dry ?? 0.42, alpha = o.alpha ?? 0.9, vary = o.vary ?? 0.17, rag = o.rag ?? 0.07;
  const L = K.arcLen(pts), total = L[n - 1] || 1;
  const nx = new Array(n), ny = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const x = -(b[1] - a[1]), y = b[0] - a[0], m = Math.hypot(x, y) || 1;
    nx[i] = x / m;
    ny[i] = y / m;
  }
  const nb = Math.max(2, Math.round(w / (o.bristle ?? 1.9)));
  const r = K.rng(seed * 7919 + 17);
  const lw = Math.max(0.9, (w / nb) * 1.3);
  const skip = o.skip ?? Math.max(70, w * 7);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const base = ctx.globalAlpha * alpha;
  for (let j = 0; j < nb; j++) {
    const v = (j + 0.5) / nb - 0.5 + ((r() - 0.5) * 0.5) / nb;
    const th = dry * (0.72 + 0.56 * Math.abs(v) * 2);
    const ph = r() * 1000, u0 = r() * rag, u1 = 1 - r() * rag;
    ctx.strokeStyle = K.shade(col, (r() - 0.5) * 2 * vary);
    ctx.globalAlpha = base * (0.55 + 0.45 * r());
    ctx.lineWidth = lw * (0.7 + 0.6 * r());
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < n; i++) {
      const u = L[i] / total;
      if (u >= u0 && u <= u1 && K.noise1(L[i] / skip + ph, seed + j) > th) {
        const ww = v * w * (o.press ? o.press(u) : 1);
        const x = pts[i][0] + nx[i] * ww, y = pts[i][1] + ny[i] * ww;
        if (pen) ctx.lineTo(x, y);
        else {
          ctx.moveTo(x, y);
          pen = true;
        }
      } else pen = false;
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---- timeline -------------------------------------------------------------------------------------------------
const out3 = (x) => 1 - Math.pow(1 - K.clamp(x), 3);
const screamAt = (t) => (t < T_SNAP ? 1 : t < 8.6 ? 1 - out3((t - T_SNAP) / 0.14) : K.smoothstep(8.6, 11.8, t));
const turnAt = (t) => (t < T_SNAP ? 0 : Math.min(out3((t - T_SNAP) / 0.16), 1 - K.smoothstep(8.8, 10.6, t)));
const calmAt = (t) => (t < T_SNAP ? 1 : t < 8.6 ? Math.exp(-(t - T_SNAP) * 4.5) : K.smoothstep(8.8, 12.2, t)); // 1 = undulating
const tick = (t, c, w = 0.07) => K.clamp(1 - Math.abs(t - c) / w);

let L = null;

// ---- the figure, painted per frame ----------------------------------------------------------------------------
const ROBE = [[-0.36, '#2d3a5e', 9], [-0.16, '#27463c', 8], [0.04, '#101622', 9], [0.2, '#3b4d70', 7], [0.38, '#263352', 9], [-0.02, '#4a5f7a', 4]];

function drawFigure(g, t, s, d, o) {
  g.lineJoin = g.lineCap = 'round';
  const N = 12, cl = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, y = K.lerp(FY, 504, u) - o.bob * u;
    const sc = Math.sin(u * 4.4 + 0.5) * 12 * (0.25 + 0.75 * s) * (0.3 + 0.7 * u);
    const sw = s * 6 * Math.sin(t * 2.1 + u * 3.2) * u;
    cl.push([FX + sc + sw, y]);
  }
  const sh = K.lerp(90, 78, s);
  const wAt = (u) => pl(u, [[0, 98], [0.3, 76], [0.6, 66], [0.88, sh], [0.95, sh * 0.84], [1, 40]]);
  const robe = K.ribbonPoly(cl, wAt);
  K.fillPoly(g, robe, '#1b2334');
  ROBE.forEach(([v, col, w], k) => {
    streak(g, cl.map((p, i) => [p[0] + v * wAt(i / N), p[1]]), w, col, 700 + k, { dry: 0.3, alpha: 0.9, skip: 70 });
  });
  g.strokeStyle = INK;
  g.lineWidth = 2.6;
  g.globalAlpha = 0.9;
  K.path(g, K.jitter(robe, 1.6, 0.04, 71), true);
  g.stroke();
  g.globalAlpha = 1;

  // head
  const n = cl[N];
  const hx = n[0] + d * 5, hy = n[1] - 60 - s * 3;
  const half = [[0, -52], [22, -48], [37, -32], [43, -10], [K.lerp(38, 34, s), 12], [K.lerp(30, 22, s), 32], [K.lerp(18, 13, s), K.lerp(47, 52, s)]];
  const warp = (x, y) => {
    let xx = x + d * 10 * K.smoothstep(-15, 55, y);
    if (x * d > 0) xx += d * 7 * Math.exp(-Math.pow((y - 12) / 14, 2)); // nose and cheek on the side it faces
    else if (x * d < 0) xx -= d * 9 * Math.exp(-Math.pow((y + 26) / 26, 2)); // back of the skull
    return [hx + xx, hy + y];
  };
  const hp = half.map(([x, y]) => warp(x, y));
  hp.push(warp(0, K.lerp(54, 60, s)));
  for (let i = half.length - 1; i >= 1; i--) hp.push(warp(-half[i][0], half[i][1]));
  g.fillStyle = SKIN;
  K.spline(g, hp, true);
  g.fill();
  for (const sg of [-1, 1]) {
    streak(g, K.catmull([warp(sg * 31, -30), warp(sg * 35, 0), warp(sg * 22, 36)], 5), 9, '#98a07a', 720 + sg, { dry: 0.32, alpha: 0.75, skip: 30 });
  }
  streak(g, K.catmull([warp(-22, -36), warp(0, -41), warp(22, -36)], 5), 10, '#e6dbae', 724, { dry: 0.3, alpha: 0.8, skip: 30 });
  g.strokeStyle = INK;
  g.lineWidth = 2.6;
  K.spline(g, K.jitter(hp, 1.1, 0.05, 73), true);
  g.stroke();

  // face
  const fx = hx + d * 21, ey = hy - 10 - s * 2;
  const R = K.lerp(5.4, 8.8, s);
  for (const sg of [-1, 1]) {
    const far = K.clamp(sg * d, 0, 1);
    const ex = fx + sg * 15 * (1 - 0.5 * far), rx = R * (1 - 0.5 * far), ry = Math.max(0.8, R * (1 - o.lid));
    g.fillStyle = '#ece3c4';
    g.beginPath();
    g.ellipse(ex, ey, rx, ry, 0, 0, K.TAU);
    g.fill();
    g.lineWidth = 2;
    g.stroke();
    if (o.lid < 0.6) {
      g.fillStyle = INK;
      g.beginPath();
      g.arc(ex + o.gaze[0] * (rx - 2.6), ey + o.gaze[1] * (R - 2.8), K.lerp(2.4, 2.7, s), 0, K.TAU);
      g.fill();
    }
  }
  g.fillStyle = INK;
  for (const sg of [-1, 1]) {
    g.beginPath();
    g.arc(fx + sg * 3.6 + d * 2, hy + 14, 1.5, 0, K.TAU);
    g.fill();
  }
  if (Math.abs(d) > 0.05) {
    g.globalAlpha = K.clamp(Math.abs(d) * 1.4);
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(fx + Math.sign(d) * 2, hy - 2);
    g.quadraticCurveTo(fx + d * 13, hy + 9, fx + d * 8, hy + 14);
    g.stroke();
    g.globalAlpha = 1;
  }
  g.fillStyle = '#35191a';
  g.beginPath();
  g.ellipse(fx + d * 1.5, hy + K.lerp(31, 36, s), K.lerp(4.3, 9.6, s), K.lerp(4.8, 17, s), 0, 0, K.TAU);
  g.fill();
  g.lineWidth = 2;
  g.stroke();

  // arms: hands on the cheeks (s = 1) … hanging at the sides (s = 0)
  for (const sg of [-1, 1]) {
    const S = [n[0] + sg * K.lerp(41, 33, s), n[1] + 22];
    const E = K.mixPt([n[0] + sg * 53, n[1] + 102], [n[0] + sg * 68, n[1] + 88], s);
    const Wr = K.mixPt([FX + sg * 56, n[1] + 184], [hx + sg * 46, hy + 42], s);
    const Tp = K.mixPt([FX + sg * 57, n[1] + 232], [hx + sg * 38, hy - 20], s);
    const sleeve = K.ribbonPoly(K.catmull([S, E, Wr], 6), (u) => K.lerp(31, 20, u));
    K.fillPoly(g, sleeve, '#212b42');
    streak(g, K.catmull([S, E, Wr], 6), 9, '#3b4c6e', 730 + sg, { dry: 0.34, alpha: 0.85, skip: 40 });
    g.strokeStyle = INK;
    g.lineWidth = 2.2;
    g.globalAlpha = 0.85;
    K.path(g, K.jitter(sleeve, 1.2, 0.05, 75 + sg), true);
    g.stroke();
    g.globalAlpha = 1;
    const mid = [(Wr[0] + Tp[0]) / 2 + sg * 3, (Wr[1] + Tp[1]) / 2];
    const hand = K.ribbonPoly(K.catmull([Wr, mid, Tp], 5), (u) => pl(u, [[0, 13], [0.45, 17], [1, 7]]));
    K.fillPoly(g, hand, SKIN, true);
    g.lineWidth = 2;
    K.spline(g, K.jitter(hand, 0.8, 0.06, 77 + sg), true);
    g.stroke();
    g.globalAlpha = 0.6;
    g.lineWidth = 1.3;
    K.path(g, [K.mixPt(Wr, Tp, 0.45), K.mixPt(Wr, Tp, 0.9)]);
    g.stroke();
    g.globalAlpha = 1;
  }
}

// ---- the pelican, in Munch's manner: flat murky colour, wavering blue-black contour ------------------------------
const PEL = { body: '#e0d5b4', wing: '#cabf9e', tail: '#b9b197', neck: '#e0d5b4', head: '#e4dabb', beak: '#c98a2c', pouch: '#dda540', foot: '#b9792b', saddle: '#3a2921', scarf: '#a5301c', metal: '#1b2233', mark: INK };
const BODY_STREAKS = ['#b6c2b0', '#d6b972', '#c9a58c', '#b6c2b0', '#e9d9a0', '#c9a58c'];

function drawPelican(g, pose) {
  const s = pose.s;
  g.lineJoin = g.lineCap = 'round';
  const line = (pts, w, col, a = 1) => {
    g.globalAlpha = a;
    g.strokeStyle = col;
    g.lineWidth = w;
    K.path(g, pts);
    g.stroke();
    g.globalAlpha = 1;
  };
  for (const p of Rig.parts(pose)) {
    const seed = nameSeed(p.name);
    if (p.kind === 'wheel') {
      const ring = K.jitter(K.ellipsePts(p.c[0], p.c[1], p.r - 2.6 * s, p.r - 2.6 * s, 44), 1.7 * s, 0.03, seed);
      g.strokeStyle = INK;
      g.lineWidth = 5.6 * s;
      K.path(g, ring, true);
      g.stroke();
      g.strokeStyle = '#3a4a68';
      g.lineWidth = 1.5 * s;
      g.globalAlpha = 0.8;
      K.path(g, K.jitter(K.ellipsePts(p.c[0], p.c[1], p.r - 6.5 * s, p.r - 6.5 * s, 36), 1.4 * s, 0.04, seed + 5), true);
      g.stroke();
      g.globalAlpha = 0.75;
      g.strokeStyle = INK;
      g.lineWidth = 1.4 * s;
      g.beginPath();
      for (const [a, b] of Rig.spokes(p, 8)) {
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
      }
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = INK;
      g.beginPath();
      g.arc(p.c[0], p.c[1], 4.2 * s, 0, K.TAU);
      g.fill();
    } else if (p.kind === 'disc') {
      g.strokeStyle = INK;
      g.lineWidth = 2.6 * s;
      g.beginPath();
      g.arc(p.c[0], p.c[1], p.r, 0, K.TAU);
      g.stroke();
    } else if (p.kind === 'eye') {
      g.fillStyle = '#f0e8d0';
      g.beginPath();
      g.arc(p.c[0], p.c[1], p.r * 1.08, 0, K.TAU);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.8 * s;
      g.stroke();
      const pu = Array.isArray(p.pupil) ? p.pupil : p.c;
      g.fillStyle = INK;
      g.beginPath();
      g.arc(pu[0], pu[1], (p.pr || p.r * 0.5) * 1.05, 0, K.TAU);
      g.fill();
    } else if (p.kind === 'line') {
      if (p.role === 'frame') {
        line(p.pts, p.w * 1.08, INK);
        line(p.pts.map(([x, y]) => [x - 0.8 * s, y - 1.1 * s]), Math.max(1, p.w * 0.28), '#42547a', 0.75);
      } else if (p.role === 'metal') line(p.pts, p.w, PEL.metal);
      else if (p.role === 'leg') {
        line(p.pts, p.w + 3.2 * s, INK, 0.9);
        line(p.pts, p.w, p.far ? '#8d5b24' : PEL.foot);
      } else if (p.role === 'wing') {
        line(p.pts, p.w + 2.6 * s, INK, 0.9);
        line(p.pts, p.w, PEL.wing);
      } else if (p.role === 'head') {
        line(p.pts, p.w + 2.2 * s, INK, 0.85);
        line(p.pts, p.w, PEL.head);
      } else if (p.role === 'scarf') {
        line(p.pts, p.w, PEL.scarf);
        line(p.pts.map(([x, y]) => [x, y + p.w * 0.3]), 1.6 * s, '#6c1b12', 0.8);
      } else line(p.pts, Math.max(1.6 * s, p.w), INK, 0.65);
    } else if (p.kind === 'poly') {
      let col = PEL[p.role] ?? PEL.body;
      if (p.far) col = K.shade(col, -0.28);
      g.fillStyle = col;
      K.path(g, p.pts, true);
      g.fill();
      if (p.name === 'body') {
        // strokes that echo the sky's rhythm, dragged across the body
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const [x, y] of p.pts) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
        g.save();
        K.path(g, p.pts, true);
        g.clip();
        g.lineWidth = 4 * s;
        for (let k = 0; k < 6; k++) {
          g.strokeStyle = BODY_STREAKS[k];
          g.globalAlpha = 0.72;
          const yy = K.lerp(y0, y1, (k + 0.6) / 6.4);
          g.beginPath();
          for (let x = x0 - 4; x <= x1 + 4; x += 10) {
            const y = yy + 5 * s * Math.sin((x - x0) * 0.04 + k * 1.3);
            if (x === x0 - 4) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.stroke();
        }
        g.restore();
      }
      g.strokeStyle = INK;
      g.lineWidth = (p.role === 'body' || p.role === 'beak' || p.role === 'pouch' ? 2.8 : 2.2) * s;
      g.globalAlpha = 0.92;
      K.path(g, K.jitter(p.pts, 1.2 * s, 0.05, seed), true);
      g.stroke();
      g.globalAlpha = 1;
    }
  }
}

function scrub(ctx, ox, oy, fn) {
  const g = L.tctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, L.tmp.width, L.tmp.height);
  g.setTransform(TRES, 0, 0, TRES, -ox * TRES, -oy * TRES);
  fn(g);
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = 1;
  g.drawImage(L.mask, 0, 0, 1000, 1000);
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(L.tmp, ox, oy, TW, TH);
}

export default {
  id: 13, key: 'scream', title: TITLES[13], heroT: 3.0,
  profile: [[0, 0], [2.5, 0.49], [6, 1]],

  act(t, p) {
    // a glance up at the person on the bridge, nothing more
    const g = K.gate(t, 2.8, 4.7, 0.25);
    if (g > 0.01) p.eye = [0.7 * g, -0.55 * g];
  },

  async init() {
    const res = 1.2;
    const board = K.paper({ w: 1000, h: 1000, res: 0.8, base: '#a67f56', seed: 13, mottle: 0.6, mottleColor: '#6f5133', lightColor: '#c9a776', fiber: 0.35, speck: 0.5, stains: 0.3, edge: 0 });
    const tooth = K.noiseLayer({ w: 1000, h: 1000, res: 0.7, scale: 7, oct: 2, seed: 21, color: '#000000', lo: 0.5, hi: 0.8, alpha: 0.62, stretch: [0.16, 1] });
    const bare = K.noiseLayer({ w: 1000, h: 1000, res: 0.25, scale: 110, oct: 3, seed: 22, color: '#000000', lo: 0.56, hi: 0.85, alpha: 0.6 });
    const erode = (c, y = 0, heavy = false) => {
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.drawImage(tooth, 0, y, 1000, 1000);
      if (heavy) c.drawImage(bare, 0, y, 1000, 1000);
      c.restore();
    };

    // ============================================================ BACK: sky, fjord, far shore (undulates)
    const SKY = [
      ['#9e2a1a', '#9e2a1a', '#9e2a1a', '#c8451c', '#c8451c', '#c8451c', '#5d6f78', '#d98a2b'],
      ['#d4501e', '#d4501e', '#d4501e', '#d4501e', '#e3a02e', '#e3a02e', '#e3a02e', '#b4301c', '#b4301c', '#ecc45a'],
      ['#9fb6a6', '#9fb6a6', '#9fb6a6', '#e8bf55', '#e8bf55', '#d4501e', '#d4501e', '#6f8d92'],
      ['#e3a02e', '#e3a02e', '#e3a02e', '#d4501e', '#d4501e', '#d4501e', '#ecc45a', '#ecc45a', '#b4301c'],
      ['#ecc45a', '#ecc45a', '#d98a2b', '#d98a2b', '#8fa9a2', '#8fa9a2', '#c8451c'],
    ];
    const skyZone = (v) => SKY[v < 0.14 ? 0 : v < 0.42 ? 1 : v < 0.58 ? 2 : v < 0.85 ? 3 : 4];
    const LAND_L = ['#3f4a33', '#4b4030', '#2e3a34', '#5a5136'];
    const HILL_R = ['#232c46', '#1a2130', '#2f3a5c', '#3a4a66'];
    const FJ_LIGHT = ['#d7b566', '#c9a04a', '#9fb39f', '#d58a3a', '#b9c0a0', '#d7b566'];
    const FJ_MID = ['#4f6f86', '#3a5570', '#3d6a5a', '#6f8fa0', '#27304a'];
    const FJ_DARK = ['#1a2130', '#1a2130', '#27304f', '#27304f', '#2f4a3c', '#2f5a48', '#3e5f7a', '#3e5f7a', '#1f3340', '#6f8fa0', '#34407a'];
    const landCol = (x, d, r) => {
      if (d < 0.13) return r.pick(x < 430 ? LAND_L : HILL_R);
      if (d < 0.52) return r() < 0.92 * Math.exp(-Math.pow((x - 400) / 430, 2)) ? r.pick(FJ_LIGHT) : r.pick(FJ_MID);
      return r.pick(FJ_DARK);
    };

    const under = K.layer(1000, BTOT, 0.6, (c) => {
      c.translate(0, MY);
      c.globalAlpha = 0.36;
      c.fillStyle = K.linGrad(c, 0, -MY, 0, 360, [[0, '#a8301c'], [0.3, '#d4581f'], [0.55, '#dc9a3a'], [0.8, '#e0a83c'], [1, '#d9b866']]);
      c.fillRect(0, -MY, 1000, 420);
      const zone = (d0, col, a) => {
        c.globalAlpha = a;
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(-10, 800);
        for (let x = -10; x <= 1010; x += 20) c.lineTo(x, landY(x, d0));
        c.lineTo(1010, 800);
        c.closePath();
        c.fill();
      };
      zone(-0.06, '#252e46', 0.9);
      zone(0.14, '#39506a', 0.55);
      zone(0.5, '#1c2436', 0.75);
      // the light lying on the fjord
      c.globalAlpha = 1;
      c.fillStyle = K.linGrad(c, 60, 0, 820, 0, [[0, 'rgba(206,174,100,0)'], [0.45, 'rgba(214,182,104,0.85)'], [1, 'rgba(206,174,100,0)']]);
      c.beginPath();
      for (let x = 60; x <= 820; x += 20) c.lineTo(x, landY(x, 0.15));
      for (let x = 820; x >= 60; x -= 20) c.lineTo(x, landY(x, 0.5));
      c.closePath();
      c.fill();
      erode(c, -MY, true);
    });

    const paint = K.layer(1000, BTOT, res, (c) => {
      c.translate(0, MY);
      K.put(c, under, 0, -MY, 1000, BTOT);
      const r = K.rng(1301);
      // --- sky ribbons
      const NS = 165;
      const order = [...Array(NS).keys()].sort((a, b) => K.hash1(a * 17 + 3) - K.hash1(b * 17 + 3));
      for (const i of order) {
        const y0 = -34 + (394 * (i + r())) / NS;
        const col = r.pick(skyZone(y0 / 350));
        const full = r() < 0.4;
        const xa = full ? -30 : r.range(-80, 560), xb = full ? 1030 : Math.min(1030, xa + r.range(380, 1000));
        streak(c, skyPath(y0, xa, xb, i), r.range(9, 29), col, 100 + i, { dry: r.range(0.32, 0.58), alpha: 0.94 });
      }
      // --- far shore, fjord: ribbons squeezed toward the left, plunging on the right
      const NL = 170;
      const lorder = [...Array(NL).keys()].sort((a, b) => K.hash1(a * 29 + 7) - K.hash1(b * 29 + 7));
      for (const i of lorder) {
        const d = -0.07 + (1.1 * (i + r())) / NL;
        const full = r() < 0.3;
        const xa = full ? -30 : r.range(-120, 700), xb = full ? 1030 : Math.min(1030, xa + r.range(260, 760));
        const col = landCol((xa + xb) / 2, d, r);
        const k = DEPTH(1000);
        streak(c, landPath(d, xa, xb, 400 + i), r.range(9, 24), col, 300 + i, { dry: r.range(0.28, 0.5), alpha: 0.94, press: (u) => DEPTH(K.lerp(xa, xb, u)) / k });
      }
      // --- the whirl of the fjord beside the head: concentric dragged arcs
      for (let k = 0; k < 11; k++) {
        const rr = 26 + k * 9.5 + r.range(-3, 3), a0 = r.range(1.6, 4.4), a1 = a0 + r.range(1.7, 3.4);
        const cx = 880 + r.range(-14, 14), cy = 466 + r.range(-6, 6), arc = [];
        for (let a = a0; a <= a1; a += 0.1) arc.push([cx + Math.cos(a) * rr * 2.0 - Math.sin(a) * rr * 0.15, cy + Math.sin(a) * rr * 0.9 + Math.cos(a) * rr * 0.22]);
        streak(c, arc, r.range(11, 19), r.pick(k % 4 === 0 ? FJ_LIGHT : k % 2 ? FJ_MID : FJ_DARK), 560 + k, { dry: r.range(0.3, 0.46), alpha: 0.94 });
      }
      // --- a hint of town on the far shore, and two boats
      const hz = (x) => landY(x, -0.03);
      streak(c, [[300, hz(300) - 24], [301, hz(300) - 10], [301, hz(300) + 5]], 4, '#1a2130', 601, { dry: 0.1, skip: 200 });
      streak(c, [[292, hz(300) - 2], [310, hz(300) - 3]], 5, '#1a2130', 602, { dry: 0.1 });
      for (const [x, w] of [[236, 16], [262, 12], [330, 18], [362, 12], [392, 14], [205, 10]]) {
        streak(c, [[x, hz(x) + 3], [x + w, hz(x + w) + 2]], 5, '#dccba2', 610 + x, { dry: 0.2, alpha: 0.9, skip: 14 });
      }
      for (const [x, d, sc] of [[505, 0.3, 1], [588, 0.24, 0.8]]) {
        const y = landY(x, d);
        streak(c, [[x - 13 * sc, y], [x, y + 2 * sc], [x + 14 * sc, y - 1]], 5 * sc, '#141a26', 620 + x, { dry: 0.1, skip: 200 });
        streak(c, [[x + 1, y - 1], [x + 2, y - 22 * sc]], 2.4, '#141a26', 625 + x, { dry: 0.1, skip: 200 });
        streak(c, [[x + 6 * sc, y - 4 * sc], [x + 5 * sc, y - 18 * sc]], 5 * sc, '#e2d3a6', 628 + x, { dry: 0.2, skip: 12 });
      }
      erode(c, -MY, false);
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.globalAlpha = 0.6;
      c.drawImage(bare, 0, -MY, 1000, 1000);
      c.restore();
    });

    const crayA = await K.bake({ w: 1000, h: BTOT, res, bg: '#ffffff', seed: 131 }, (b) => {
      const r = K.rng(1401);
      const sp = (pts, press, k) => pts.length > 2 && b.spline(pts.map(([x, y], i) => [x, y + MY, press * (0.7 + 0.6 * K.noise1(i * 0.9, k))]), 0.5);
      b.set('crayon', '#8f2718', 2.2);
      for (let i = 0; i < 34; i++) {
        const y0 = r.range(-10, 335), xa = r.range(-40, 520), xb = Math.min(1040, xa + r.range(300, 900));
        sp(skyPath(y0, xa, xb, 500 + i, 64), 1, i);
      }
      b.set('crayon', '#3f5566', 2.2);
      for (let i = 0; i < 16; i++) {
        const y0 = r.range(110, 345), xa = r.range(-40, 520), xb = Math.min(1040, xa + r.range(300, 900));
        sp(skyPath(y0, xa, xb, 540 + i, 64), 1, 40 + i);
      }
      for (let i = 0; i < 22; i++) {
        const d = r.range(0.14, 0.55), xa = r.range(-40, 560), xb = Math.min(1040, xa + r.range(260, 700));
        sp(landPath(d, xa, xb, 560 + i, 56), 1, 60 + i);
      }
      b.set('crayon', '#131a2a', 2.4);
      for (let i = 0; i < 46; i++) {
        const d = i < 12 ? r.range(-0.07, 0.14) : r.range(0.1, 1.02), xa = r.range(-40, 640), xb = Math.min(1040, xa + r.range(240, 700));
        sp(landPath(d, xa, xb, 600 + i, 56), 1.1, 90 + i);
      }
    });

    const back = K.layer(1000, BTOT, res, (c) => {
      c.translate(0, MY);
      K.put(c, board, 0, -MY);
      K.put(c, paint, 0, -MY, 1000, BTOT);
      K.putBlend(c, crayA, 'multiply', 0.85, 0, -MY, 1000, BTOT);
      // pale crayon over the top (yellow in the sky, grey-blue on the water)
      const r = K.rng(1501);
      for (let i = 0; i < 18; i++) {
        const y0 = r.range(60, 340), xa = r.range(-40, 600), xb = Math.min(1040, xa + r.range(260, 700));
        streak(c, skyPath(y0, xa, xb, 700 + i, 10), 3.4, '#f1dc90', 800 + i, { dry: 0.5, alpha: 0.85, bristle: 1.2, skip: 26 });
      }
      for (let i = 0; i < 16; i++) {
        const d = r.range(0.16, 0.95), xa = r.range(-40, 640), xb = Math.min(1040, xa + r.range(220, 600));
        streak(c, landPath(d, xa, xb, 740 + i, 10), 3.2, '#a9c0c4', 840 + i, { dry: 0.52, alpha: 0.8, bristle: 1.2, skip: 26 });
      }
      K.grain(c, 0, -MY, 1000, BTOT, { color: '#2a1c10', alpha: 0.1, seed: 9, size: 1.1 });
    });

    // ============================================================ FRONT: deck, railing, the two men, title (static)
    const deckPoly = [[-10, railY(-10, RAIL_BASE) - 3], [1010, railY(1010, RAIL_BASE) - 3], [1010, 1010], [-10, 1010]];
    const T0 = RAIL_BASE / 1420, T1 = 1.52; // tan of the ray angles covering the deck
    const ray = (tan, ra, rb, wob = 0, seed = 0, step = 30) => {
      const cs = 1 / Math.hypot(1, tan), sn = tan * cs, pts = [];
      for (let q = ra; q <= rb + 1; q += step) {
        const k = wob ? (K.noise1(q * 0.006, seed) - 0.5) * 2 * wob * (q / 1400) : 0;
        pts.push([VP[0] + cs * q - sn * k, VP[1] + sn * q + cs * k]);
      }
      return pts;
    };
    const rayRange = (tan) => {
      const cs = 1 / Math.hypot(1, tan), sn = tan * cs;
      return [420 / cs, Math.min(1440 / cs, 650 / sn)];
    };
    const DECK = ['#b88a50', '#b88a50', '#b88a50', '#a9704c', '#a9704c', '#a9704c', '#8c4e38', '#8c4e38', '#d2b077', '#d2b077', '#6e7c80', '#74452c'];

    const deckPaint = K.layer(1000, 1000, res, (c) => {
      c.save();
      K.path(c, deckPoly, true);
      c.clip();
      c.globalAlpha = 0.5;
      c.fillStyle = '#a9794c';
      c.fillRect(0, 400, 1000, 600);
      c.globalAlpha = 1;
      const r = K.rng(1601);
      for (let i = 0; i < 230; i++) {
        const tan = K.lerp(T0, T1, (i + r()) / 230);
        const [q0, q1] = rayRange(tan);
        if (q1 - q0 < 30) continue;
        const ra = r() < 0.4 ? q0 - 20 : q0 + r() * (q1 - q0) * 0.6, rb = Math.min(q1 + 20, ra + r.range(320, 1150));
        streak(c, ray(tan, ra, rb, 3, i), r.range(8, 19), r.pick(DECK), 900 + i, { dry: r.range(0.3, 0.52), alpha: 0.93, press: (u) => K.lerp(ra, rb, u) / 1450 });
      }
      // a dark, scrubbed patch of boards under the title, so the pale crayon lettering stands out
      const DARKB = ['#3a2a2c', '#2a2332', '#4a2f24', '#33263a', '#3e2c22'];
      for (let i = 0; i < 22; i++) {
        const y = 836 + i * 7.6, tan = (y - VP[1]) / (300 - VP[0]);
        const [q0, q1] = rayRange(tan);
        const cs = 1 / Math.hypot(1, tan), sn = tan * cs;
        const ra = Math.max(q0 - 10, (822 - VP[1]) / sn), rb = Math.min(q1 + 20, (r.range(400, 450) - VP[0]) / cs);
        if (rb - ra > 40) streak(c, ray(tan, ra, rb, 2, 50 + i), 15, DARKB[i % DARKB.length], 1200 + i, { dry: 0.16, alpha: 0.88, rag: 0.12 });
      }
      c.restore();
      erode(c, 0, false);
    });

    const crayB = await K.bake({ w: 1000, h: 1000, res, bg: '#ffffff', seed: 137 }, (b) => {
      const r = K.rng(1701);
      const sp = (pts, press, k) => pts.length > 2 && b.spline(pts.map(([x, y], i) => [x, y, press * (0.7 + 0.6 * K.noise1(i * 0.9, k))]), 0.5);
      b.set('crayon', '#131a2a', 2.3);
      for (let k = 1; k < 52; k++) {
        const tan = (RAIL_BASE + k * 34) / 1420;
        if (tan > T1) break;
        const [q0, q1] = rayRange(tan);
        if (q1 - q0 < 60) continue;
        sp(ray(tan, q0 - 10, q1 + 10, 2.5, 300 + k, 110), 1, k);
      }
      b.set('crayon', '#6e3220', 2.2);
      for (let i = 0; i < 30; i++) {
        const tan = r.range(T0 + 0.01, T1);
        const [q0, q1] = rayRange(tan);
        if (q1 - q0 < 200) continue;
        const ra = q0 + r() * (q1 - q0) * 0.5;
        sp(ray(tan, ra, Math.min(q1, ra + r.range(250, 800)), 3, 400 + i, 100), 1, 100 + i);
      }
    });

    const titleLay = K.layer(620, 170, 1.4, (c) => {
      const font = { zh: { size: 54, font: K.FONT.cjkSans, weight: 900 }, en: { size: 35, font: K.FONT.book, weight: 700, italic: true }, date: { size: 30, font: K.FONT.book, weight: 700, italic: true } };
      const withStroke = (col, w) => {
        const o = { color: col, gap: 1.18 };
        for (const k of ['zh', 'en', 'date']) o[k] = { ...font[k], color: col, stroke: { color: col, width: w } };
        return o;
      };
      // dark under-scrawl, then the lettering in pale ochre crayon
      c.globalAlpha = 0.92;
      K.titleBlock(c, TITLES[13], 8.5, 8.5, withStroke('#120e14', 7));
      c.globalAlpha = 1;
      K.titleBlock(c, TITLES[13], 6, 6, withStroke('#f3e2ae', 1.4));
      K.grain(c, 0, 0, 620, 170, { color: '#000000', alpha: 0.45, seed: 47, size: 1.1, density: 0.12, mode: 'destination-out' });
    });

    const front = K.layer(1000, 1000, res, (c) => {
      c.save();
      K.path(c, deckPoly, true);
      c.clip();
      K.put(c, board);
      K.put(c, deckPaint);
      K.putBlend(c, crayB, 'multiply', 0.85);
      c.restore();

      // --- railing: three rails and the posts, all running to the vanishing point
      const rail = (k, w, seed) => {
        const pts = [];
        for (let x = -24; x <= 1024; x += 32) pts.push([x, railY(x, k) + (K.noise1(x * 0.006, seed) - 0.5) * 7 * pf(x)]);
        const press = (u) => pf(K.lerp(-24, 1024, u));
        K.ribbon(c, pts, (u) => w * press(u) * 0.86, K.rgba('#5f3324', 0.86));
        streak(c, pts, w, '#8a4a2e', seed, { dry: 0.26, press, alpha: 0.95 });
        streak(c, pts.map(([x, y]) => [x, y - w * 0.22 * pf(x)]), w * 0.45, '#c08f55', seed + 1, { dry: 0.45, press, alpha: 0.9 });
        streak(c, pts.map(([x, y]) => [x, y + w * 0.5 * pf(x)]), 3.2, INK, seed + 2, { dry: 0.3, alpha: 0.9, bristle: 1.2 });
        streak(c, pts.map(([x, y]) => [x, y - w * 0.5 * pf(x)]), 2.6, INK, seed + 3, { dry: 0.45, alpha: 0.8, bristle: 1.2 });
      };
      for (const x of [900, 595, 405, 275, 180, 108, 51, 6]) {
        const k = pf(x), w = 25 * k;
        const pts = [[x - 2 * k, railY(x, RAIL_TOP) - 16 * k], [x + 1.5 * k, railY(x, RAIL_MID)], [x + 4 * k, railY(x, RAIL_BASE) + 5 * k]];
        const P = K.catmull(pts, 6);
        K.ribbon(c, P, w * 0.86, K.rgba('#5a3022', 0.88));
        streak(c, P, w, '#7c4530', 950 + x, { dry: 0.24, alpha: 0.95, skip: 60 });
        streak(c, P.map(([px, py]) => [px - w * 0.2, py]), w * 0.4, '#b98a52', 951 + x, { dry: 0.45, skip: 40 });
        streak(c, P.map(([px, py]) => [px + w * 0.5, py]), 2.8, INK, 952 + x, { dry: 0.3, bristle: 1.2 });
        streak(c, P.map(([px, py]) => [px - w * 0.5, py]), 2.4, INK, 953 + x, { dry: 0.4, bristle: 1.2, alpha: 0.8 });
      }
      rail(RAIL_BASE, 22, 961);
      rail(RAIL_MID, 15, 965);
      rail(RAIL_TOP, 29, 969);

      // --- the two gentlemen in top hats, far along the bridge
      for (const [x, fy, h, lean, seed] of [[112, 566, 128, -1, 31], [166, 576, 136, 1, 37]]) {
        const cl = K.catmull([[x + lean * 2, fy], [x, fy - h * 0.45], [x + lean * 2.5, fy - h * 0.8]], 6);
        K.ribbon(c, cl, (u) => h * pl(u, [[0, 0.2], [0.5, 0.25], [0.9, 0.26], [1, 0.12]]), '#151b28');
        streak(c, cl.map(([px, py]) => [px - h * 0.05, py]), h * 0.09, '#2f3d5e', seed, { dry: 0.35, skip: 40 });
        streak(c, cl.map(([px, py]) => [px + h * 0.06, py]), h * 0.07, '#0c1018', seed + 1, { dry: 0.3, skip: 40 });
        const hx = x + lean * 2.5, hy = fy - h * 0.86;
        c.fillStyle = '#8f8468';
        c.beginPath();
        c.ellipse(hx, hy, h * 0.058, h * 0.068, 0, 0, K.TAU);
        c.fill();
        c.fillStyle = '#10141e';
        c.beginPath();
        c.ellipse(hx - lean * 1.2, hy - h * 0.012, h * 0.06, h * 0.06, 0, 0, K.TAU);
        c.fill();
        K.fillPoly(c, [[hx - h * 0.07, hy - h * 0.05], [hx - h * 0.066, hy - h * 0.23], [hx + h * 0.066, hy - h * 0.23], [hx + h * 0.07, hy - h * 0.05]], '#10141e');
        streak(c, [[hx - h * 0.135, hy - h * 0.05], [hx + h * 0.135, hy - h * 0.056]], 5, '#10141e', seed + 2, { dry: 0.02, skip: 300 });
        streak(c, [[x - 14, fy + 2], [x + 30, fy + 9]], 7, '#2a2f45', seed + 3, { dry: 0.4, alpha: 0.6 });
      }

      // --- the figure's shadow and the wheel-worn track along the riding line
      streak(c, [[FX - 52, FY - 2], [FX + 10, FY + 3], [FX + 96, FY + 12]], 16, '#27304a', 41, { dry: 0.4, alpha: 0.6, skip: 40 });
      const track = [];
      for (let x = -10; x <= 1010; x += 30) track.push([x, K.ROAD_Y + 7 + (K.noise1(x * 0.01, 5) - 0.5) * 4]);
      streak(c, track, 12, '#dcc590', 43, { dry: 0.56, alpha: 0.6, skip: 90 });
      streak(c, track.map(([x, y]) => [x, y - 6]), 3, INK, 44, { dry: 0.52, alpha: 0.45, bristle: 1.2, skip: 80 });

      // --- title, scrawled in crayon on the boards
      c.save();
      c.translate(38, 842);
      c.rotate(-0.018);
      K.put(c, titleLay);
      c.restore();
      K.grain(c, 0, 400, 1000, 600, { color: '#2a1c10', alpha: 0.1, seed: 10, size: 1.1, mode: 'source-atop' });
    });

    // board-anchored scrub for the per-frame sprites: the cardboard shows through them too
    const mask = K.layer(1000, 1000, 0.8, (c) => {
      c.drawImage(K.noiseLayer({ w: 1000, h: 1000, res: 0.7, scale: 8, oct: 2, seed: 61, color: '#000000', lo: 0.56, hi: 0.86, alpha: 0.42, stretch: [0.14, 1] }), 0, 0, 1000, 1000);
      K.grain(c, 0, 0, 1000, 1000, { color: '#000000', alpha: 0.3, seed: 63, size: 1.3, density: 0.22 });
    });
    const tmp = K.layer(TW, TH, TRES);
    L = { back, front, mask, tmp, tctx: tmp.getContext('2d') };
  },

  render(ctx, t, env) {
    // ---- the landscape undulates with the scream: baked layer redrawn in columns with sine offsets
    const calm = calmAt(t);
    const amp = 1.1 + calm * (11 + 8 * K.gate(t, 0.7, 2.6, 0.7, 0.05));
    const ph = t * 1.7;
    const back = L.back, res = back.width / 1000, CW = 8;
    for (let x = 0; x < 1000; x += CW) {
      const dy = amp * (Math.sin(x * 0.0105 - ph) + 0.5 * Math.sin(x * 0.023 + ph * 0.6 + 1.3));
      ctx.drawImage(back, x * res, 0, (CW + 1) * res, back.height, x, -MY + dy, CW + 1, BTOT);
    }
    K.put(ctx, L.front);

    // ---- the figure
    const px = env.rider && Number.isFinite(env.rider.lx) ? env.rider.lx : (t / 6) * 1000;
    const s = screamAt(t), w = turnAt(t);
    const track = K.clamp((px + 50 - FX) / 240, -1, 1);
    const d = w * Math.sign(track) * Math.pow(Math.abs(track), 0.6);
    const startle = t >= T_SNAP ? Math.exp(-7 * (t - T_SNAP)) : 0;
    const o = {
      bob: 10 * startle,
      gaze: [w * 0.9 * track, w * (0.3 + 0.5 * (1 - Math.abs(track)))],
      lid: Math.max(tick(t, 3.3), tick(t, 7.1)),
    };
    scrub(ctx, FX - 215, 335, (g) => drawFigure(g, t, s, d, o));

    // ---- the pelican
    const pose = env.pose;
    if (pose) {
      const sh = [];
      for (let x = -120; x <= 125; x += 35) sh.push([pose.x + x * pose.s, pose.y + 6 + Math.abs(x) * 0.012]);
      streak(ctx, sh, 13 * pose.s, '#252b44', 5, { dry: 0.3, alpha: 0.5, skip: 60 });
      scrub(ctx, pose.x - 235, pose.y - 412, (g) => drawPelican(g, pose));
    }
  },
};
