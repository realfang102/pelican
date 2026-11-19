// Section 7 — Maya Codex (c. 1200) — a page of a Postclassic screenfold book, in the manner of the Dresden Codex.
// Fig-bark paper sized with white lime stucco; fine black-brown line, flat Maya blue / hematite red / yellow ochre;
// thick red frame lines cut the page into compartments; invented glyph blocks run across the top and down the sides.
//
// The gag: a seated scribe keeps a tally of the pelican's pedal strokes in dot-and-bar numerals — one dab of the brush
// per beat, five dots snapping into a bar (with a small red flash) on the 5th and 10th stroke. A rain-god with an
// offering bowl follows the pelican with his eye. Before: a shell (zero). After: two bars and two dots — twelve.
//
// Technique: everything is Canvas 2D (even line + flat fill is exactly the codex manner). The page is baked once;
// the two heads are sprites that nod / turn; the brush arm, the numerals, the god's pupil and the pelican are drawn
// per frame; one "wear" layer (abraded pigment, stains, crazing, flaked stucco showing the bark) is laid over
// everything — the pelican included — so moving and static paint sit in the same worn surface.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const TAU = Math.PI * 2;
const C = {
  stucco: '#efe6d0', white: '#f5eedc', line: '#2a1a11', black: '#241812',
  red: '#a8361f', redHi: '#d24c2a', blue: '#3f96a2', blueLt: '#8cc6c2', ochre: '#d29a30', ochreLt: '#e6c070', skin: '#dba463',
};
const LW = 2.3; // the codex line
let L = null;

// ------------------------------------------------------------------------------------------- page layout
const ROAD = K.ROAD_Y;
const B0 = 28, B1 = 972; // outer border
const YA = 218; // under the title / glyph register
const YB = 474; // between the scribes' register and the pelican's
const XL = 114, XR = 886; // inner edges of the side glyph columns
const XT = 470; // right edge of the title compartment
const SEAT = 452;
const SCRIBE = { x: 348, y: SEAT, k: 0.92, dir: 1 };
const DEITY = { x: 772, y: SEAT, k: 0.92, dir: -1 };
const PIVOT = [-10, -128]; // neck pivot of both heads (figure-local)
const CART = { x: 414, y: 266, w: 162, h: 136 };
const NUM = { cx: 495, rows: [368, 334, 300], dx: 25, r: 11, barH: 20 };
const ORDER = [1, 3, 2, 0, 4]; // the order in which the five dot places of a row are filled
const INK = [423, 417]; // mouth of the conch inkpot
const ARM = { l1: 70, l2: 70, brush: 66, home: [372, 396] };

// ------------------------------------------------------------------------------------------- the tally (pure time)
const countAt = (t) => K.clamp(Math.floor(t / 0.5 + 1e-6), 0, 12);
const slotX = (i) => NUM.cx + (i - 2) * NUM.dx;
/** where brush dab number n (1..12) lands */
const dabPos = (n) => [slotX(ORDER[(n - 1) % 5]), NUM.rows[Math.floor((n - 1) / 5)]];
const speakAt = (t) => K.gate(t, 3.0, 4.5, 0.12, 0.3);

// ------------------------------------------------------------------------------------------- drawing primitives
let Q = 1; // line-weight compensation while drawing inside a scaled figure
function shape(ctx, pts, o = {}) {
  o.smooth === false ? K.path(ctx, pts, o.closed !== false) : K.spline(ctx, pts, o.closed !== false);
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
const line = (ctx, pts, w = LW * Q, smooth = true, col = C.line) => shape(ctx, pts, { closed: false, w, smooth, stroke: col });
function disc(ctx, x, y, r, fill, w = LW * Q, stroke = C.line) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.05, r), 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (w > 0 && stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = w;
    ctx.stroke();
  }
}
/** rounded rectangle as points, with a little hand wobble (seed 0 = exact) */
function rr(x, y, w, h, r, seed = 0, amp = 1) {
  r = Math.min(r, w / 2, h / 2);
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  if (!seed) return pts;
  return pts.map(([px, py], i) => [px + (K.hash1(seed * 131 + i * 7) - 0.5) * 2 * amp, py + (K.hash1(seed * 137 + i * 11) - 0.5) * 2 * amp]);
}
function spiral(cx, cy, r0, r1, a0, a1, n = 26) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = K.lerp(a0, a1, u), r = K.lerp(r0, r1, u);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
/** a long plume from a to b: leaf-shaped, curved, with a centre vein */
function feather(ctx, a, b, w, fill, bend = 0.16, lw = LW * Q) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const cl = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, off = Math.sin(u * Math.PI) * bend * len;
    cl.push([a[0] + dx * u + nx * off, a[1] + dy * u + ny * off]);
  }
  const poly = K.ribbonPoly(cl, (u) => w * (0.3 + 0.7 * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5)) * (u > 0.7 ? Math.max(0.02, (1 - u) / 0.3) : 1));
  shape(ctx, poly, { fill, smooth: false, w: lw });
  line(ctx, cl.slice(1, 10), lw * 0.6, false);
}
function withFig(ctx, f, fn) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.k * f.dir, f.k);
  Q = 1 / f.k;
  fn();
  Q = 1;
  ctx.restore();
}
const toWorld = (f, p) => [f.x + p[0] * f.k * f.dir, f.y + p[1] * f.k];
const mixPt = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
/** hand-ruled frame line in hematite red: width wavers like a loaded brush drawn along a straightedge */
function redLine(ctx, x0, y0, x1, y1, w, seed) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / 80));
  const nx = -(y1 - y0) / len, ny = (x1 - x0) / len, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, wob = i === 0 || i === n ? 0 : (K.hash1(seed * 53 + i) - 0.5) * 1.6;
    pts.push([K.lerp(x0, x1, u) + nx * wob, K.lerp(y0, y1, u) + ny * wob]);
  }
  K.brushStroke(ctx, pts, { width: w, color: C.red, taper: [0, 0], minW: 1, wobble: 0.11, seed });
}

// ------------------------------------------------------------------------------------------- invented glyph blocks
// Main signs: abstract faces, hands, rings, frets … drawn in a unit box (u(a,b) → page), m = the box's short side.
const SIGNS = [
  (ctx, u, m, lw) => { // a face in profile
    line(ctx, [u(0.6, 0.04), u(0.35, 0.2), u(0.25, 0.5), u(0.34, 0.94)], lw);
    for (const v of [0.3, 0.48, 0.66]) line(ctx, [u(0.08, v), u(0.26, v + 0.03)], lw * 0.8, false);
    disc(ctx, ...u(0.63, 0.4), m * 0.12, null, lw);
    disc(ctx, ...u(0.66, 0.43), m * 0.05, C.black, 0);
    line(ctx, [u(0.46, 0.25), u(0.63, 0.19), u(0.84, 0.27)], lw * 0.8);
    line(ctx, [u(0.58, 0.74), u(0.76, 0.78), u(0.94, 0.68)], lw);
    disc(ctx, ...u(0.48, 0.66), m * 0.035, C.black, 0);
  },
  (ctx, u, m, lw) => { // a hand with a beaded cuff
    line(ctx, [u(0.2, 0.08), u(0.18, 0.92)], lw);
    line(ctx, [u(0.33, 0.08), u(0.31, 0.92)], lw);
    for (const v of [0.3, 0.52, 0.74]) disc(ctx, ...u(0.255, v), m * 0.035, C.black, 0);
    line(ctx, [u(0.33, 0.4), u(0.5, 0.2), u(0.72, 0.16), u(0.8, 0.3), u(0.6, 0.38), u(0.46, 0.44)], lw);
    for (const v of [0.56, 0.7, 0.84]) line(ctx, [u(0.33, v), u(0.86, v - 0.02)], lw * 0.85, false);
    for (const v of [0.49, 0.63, 0.77]) line(ctx, [u(0.8, v), u(0.86, v + 0.05)], lw * 0.7, false);
  },
  (ctx, u, m, lw, acc) => { // ring and four pips
    disc(ctx, ...u(0.5, 0.5), m * 0.3, null, lw);
    disc(ctx, ...u(0.5, 0.5), m * 0.13, acc, lw * 0.9);
    for (const [a, b] of [[0.16, 0.16], [0.84, 0.16], [0.16, 0.84], [0.84, 0.84]]) disc(ctx, ...u(a, b), m * 0.05, C.black, 0);
  },
  (ctx, u, m, lw) => { // crossed bands
    for (const d of [-0.07, 0.07]) {
      line(ctx, [u(0.05 + d, 0.05 - d), u(0.95 + d, 0.95 - d)], lw * 0.9, false);
      line(ctx, [u(0.95 + d, 0.05 + d), u(0.05 + d, 0.95 + d)], lw * 0.9, false);
    }
    disc(ctx, ...u(0.5, 0.5), m * 0.1, C.stucco, lw * 0.9);
    disc(ctx, ...u(0.5, 0.16), m * 0.04, C.black, 0);
    disc(ctx, ...u(0.5, 0.84), m * 0.04, C.black, 0);
  },
  (ctx, u, m, lw) => { // volute
    const [cx, cy] = u(0.52, 0.54);
    line(ctx, spiral(cx, cy, m * 0.4, m * 0.07, -2.4, 6.2), lw, false);
    disc(ctx, cx, cy, m * 0.045, C.black, 0);
    line(ctx, [u(0.06, 0.2), u(0.2, 0.1), u(0.3, 0.2)], lw * 0.8);
  },
  (ctx, u, m, lw, acc) => { // stepped fret
    shape(ctx, [u(0.0, 1.0), u(0.0, 0.62), u(0.28, 0.62), u(0.28, 0.34), u(0.56, 0.34), u(0.56, 0.62), u(0.78, 0.62), u(0.78, 1.0)], { fill: acc, smooth: false, w: lw });
    line(ctx, [u(0.56, 0.34), u(0.56, 0.12), u(0.82, 0.12), u(0.82, 0.3), u(0.7, 0.3)], lw, false);
    disc(ctx, ...u(0.16, 0.3), m * 0.05, C.black, 0);
  },
  (ctx, u, m, lw) => { // fan of three leaves
    for (const [a, b, c, d] of [[0.2, 0.3, 0.3, 0.08], [0.45, 0.4, 0.66, 0.12], [0.62, 0.62, 0.92, 0.42]]) line(ctx, [u(0.16, 0.86), u(a, b), u(c, d)], lw);
    line(ctx, [u(0.3, 0.08), u(0.5, 0.2), u(0.66, 0.12)], lw * 0.8);
    line(ctx, [u(0.66, 0.12), u(0.84, 0.3), u(0.92, 0.42)], lw * 0.8);
    disc(ctx, ...u(0.18, 0.84), m * 0.09, C.stucco, lw);
    disc(ctx, ...u(0.7, 0.8), m * 0.045, C.black, 0);
  },
  (ctx, u, m, lw, acc) => { // lozenge
    shape(ctx, [u(0.5, 0.1), u(0.88, 0.5), u(0.5, 0.9), u(0.12, 0.5)], { fill: null, smooth: false, w: lw });
    disc(ctx, ...u(0.5, 0.5), m * 0.12, acc, lw * 0.9);
    for (const k of [0.06, 0.14, 0.22]) line(ctx, [u(0.0, 0.72 + k), u(0.28 - k, 1.0)], lw * 0.7, false);
    for (const k of [0.06, 0.14, 0.22]) line(ctx, [u(1.0, 0.28 - k), u(0.72 + k, 0.0)], lw * 0.7, false);
  },
  (ctx, u, m, lw) => { // nested U
    line(ctx, [u(0.16, 0.0), u(0.18, 0.56), u(0.5, 0.82), u(0.82, 0.56), u(0.84, 0.0)], lw);
    line(ctx, [u(0.34, 0.0), u(0.36, 0.46), u(0.5, 0.58), u(0.64, 0.46), u(0.66, 0.0)], lw);
    disc(ctx, ...u(0.5, 0.3), m * 0.055, C.black, 0);
    disc(ctx, ...u(0.2, 0.88), m * 0.04, C.black, 0);
    disc(ctx, ...u(0.8, 0.88), m * 0.04, C.black, 0);
  },
  (ctx, u, m, lw, acc) => { // dark water below, two beads above
    shape(ctx, [u(-0.1, 0.6), u(0.2, 0.52), u(0.5, 0.62), u(0.8, 0.52), u(1.1, 0.6), u(1.1, 1.1), u(-0.1, 1.1)], { fill: acc, w: lw });
    disc(ctx, ...u(0.32, 0.28), m * 0.11, null, lw);
    disc(ctx, ...u(0.68, 0.28), m * 0.11, null, lw);
    disc(ctx, ...u(0.32, 0.28), m * 0.035, C.black, 0);
    disc(ctx, ...u(0.68, 0.28), m * 0.035, C.black, 0);
    line(ctx, [u(0.1, 0.8), u(0.3, 0.74), u(0.5, 0.82), u(0.7, 0.74), u(0.9, 0.8)], lw * 0.7);
  },
  (ctx, u, m, lw) => { // comb
    line(ctx, [u(0.12, 0.3), u(0.88, 0.3)], lw, false);
    for (const a of [0.22, 0.36, 0.5, 0.64, 0.78]) line(ctx, [u(a, 0.3), u(a, 0.8)], lw * 0.85, false);
    disc(ctx, ...u(0.5, 0.15), m * 0.05, C.black, 0);
  },
  (ctx, u, m, lw, acc) => { // band with beads, teeth below
    line(ctx, [u(0.0, 0.38), u(1.0, 0.38)], lw, false);
    line(ctx, [u(0.0, 0.6), u(1.0, 0.6)], lw, false);
    for (const a of [0.25, 0.5, 0.75]) disc(ctx, ...u(a, 0.49), m * 0.05, C.black, 0);
    line(ctx, [u(0.25, 0.3), u(0.5, 0.1), u(0.75, 0.3)], lw);
    for (const a of [0.2, 0.42, 0.64]) shape(ctx, [u(a, 0.68), u(a + 0.16, 0.68), u(a + 0.16, 0.86), u(a, 0.86)], { fill: a === 0.42 ? acc : null, smooth: false, w: lw * 0.8 });
  },
];
function affix(ctx, x, y, w, h, r, fill) {
  const vert = h > w, lw = LW * 0.85, S = vert ? w : h;
  shape(ctx, rr(x, y, w, h, S * 0.45, r.int(1, 999), 0.8), { fill, w: lw });
  const at = (u, v) => (vert ? [x + w * (0.5 + v), y + h * u] : [x + w * u, y + h * (0.5 + v)]);
  const kind = r.int(0, 4);
  if (kind === 0) {
    disc(ctx, ...at(0.26, 0), S * 0.2, null, lw * 0.8);
    disc(ctx, ...at(0.74, 0), S * 0.2, null, lw * 0.8);
    line(ctx, [at(0.5, -0.3), at(0.5, 0.3)], lw * 0.8, false);
  } else if (kind === 1) {
    for (const u of [0.3, 0.43, 0.57, 0.7]) line(ctx, [at(u, -0.34), at(u, 0.1)], lw * 0.8, false);
    line(ctx, [at(0.2, 0.12), at(0.8, 0.12)], lw * 0.8, false);
  } else if (kind === 2) {
    line(ctx, [at(0.14, 0.05), at(0.3, -0.2), at(0.5, 0.12), at(0.7, -0.2), at(0.86, 0.05)], lw * 0.8);
  } else if (kind === 3) {
    line(ctx, [at(0.2, 0.2), at(0.2, -0.18), at(0.45, -0.22), at(0.52, 0.02), at(0.36, 0.08)], lw * 0.8);
    disc(ctx, ...at(0.74, 0), S * 0.15, C.black, 0);
  } else {
    line(ctx, [at(0.18, 0.28), at(0.5, -0.22), at(0.82, 0.28)], lw * 0.8);
    line(ctx, [at(0.34, 0.3), at(0.5, 0.02), at(0.66, 0.3)], lw * 0.8);
  }
}
function glyph(ctx, x, y, w, h, seed, o = {}) {
  const r = K.rng(seed * 7919 + 17);
  const pre = o.pre ?? r() < 0.66, top = o.top ?? r() < 0.4, bot = o.bot ?? (!top && r() < 0.42);
  const g = 2.5;
  const pw = pre ? w * 0.26 : 0, th = top ? h * 0.24 : 0, bh = bot ? h * 0.24 : 0;
  const mx = x + (pre ? pw + g : 0), my = y + (top ? th + g : 0);
  const mw = w - (pre ? pw + g : 0), mh = h - (top ? th + g : 0) - (bot ? bh + g : 0);
  const tint = () => {
    const k = r();
    return k < 0.17 ? C.red : k < 0.31 ? C.blue : k < 0.43 ? C.ochre : null;
  };
  if (pre) {
    if (r() < 0.42) {
      affix(ctx, x, y + 1, pw, h * 0.5 - 2, r, tint());
      affix(ctx, x, y + h * 0.5 + 1, pw, h * 0.5 - 2, r, tint());
    } else affix(ctx, x, y + h * 0.05, pw, h * 0.9, r, tint());
  }
  if (top) affix(ctx, mx + mw * 0.04, y, mw * 0.92, th, r, tint());
  if (bot) affix(ctx, mx + mw * 0.04, y + h - bh, mw * 0.92, bh, r, tint());
  const k = r();
  const fill = k < 0.1 ? C.ochreLt : k < 0.18 ? C.blueLt : null;
  const outline = rr(mx, my, mw, mh, Math.min(mw, mh) * 0.3, r.int(1, 999), 1);
  shape(ctx, outline, { fill, w: LW * 1.05 });
  const acc = [C.red, C.blue, C.ochre, C.black][r.int(0, 3)];
  ctx.save();
  K.spline(ctx, outline, true);
  ctx.clip();
  SIGNS[(o.sign ?? r.int(0, 99)) % SIGNS.length](ctx, (a, b) => [mx + a * mw, my + b * mh], Math.min(mw, mh), LW * 0.9, acc);
  ctx.restore();
}
/** the four-part k'in-like rosette that stands in for spokes */
function rosette(ctx, cx, cy, r, a, lw, cols = [C.red, C.blue]) {
  for (let k = 0; k < 4; k++) {
    const ang = a + (k * Math.PI) / 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(ang) * r * 0.5, cy + Math.sin(ang) * r * 0.5, r * 0.3, r * 0.19, ang, 0, TAU);
    ctx.fillStyle = cols[k % 2];
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    disc(ctx, cx + Math.cos(ang + Math.PI / 4) * r * 0.62, cy + Math.sin(ang + Math.PI / 4) * r * 0.62, r * 0.065, C.black, 0);
  }
  disc(ctx, cx, cy, r * 0.2, C.ochre, lw * 0.8);
  disc(ctx, cx, cy, r * 0.06, C.black, 0);
}
/** the pelican's emblem glyph beside the title: bird head with pouch over two rosette wheels */
function emblem(ctx, x, y, w, h) {
  const mh = h * 0.68, lw = LW;
  const outline = rr(x, y, w, mh, 26, 41, 1);
  shape(ctx, outline, { fill: null, w: lw * 1.1 });
  ctx.save();
  K.spline(ctx, outline, true);
  ctx.clip();
  const u = (a, b) => [x + a * w, y + b * mh];
  feather(ctx, u(0.3, 0.2), u(0.02, 0.06), 11, C.blue, -0.2, lw * 0.85);
  feather(ctx, u(0.28, 0.26), u(-0.02, 0.36), 11, C.red, -0.12, lw * 0.85);
  shape(ctx, [u(0.2, 0.44), u(0.14, 0.7), u(0.16, 1.05), u(0.5, 1.05), u(0.46, 0.74), u(0.5, 0.5)], { fill: C.white, w: lw });
  shape(ctx, [u(0.5, 0.42), u(0.96, 0.52), u(0.84, 0.74), u(0.62, 0.8), u(0.48, 0.62)], { fill: C.red, w: lw });
  for (const a of [0.6, 0.7, 0.8]) line(ctx, [u(a, 0.5), u(a - 0.02, 0.74)], lw * 0.6, false);
  shape(ctx, [u(0.46, 0.3), u(0.72, 0.36), u(0.98, 0.5), u(0.72, 0.5), u(0.48, 0.46)], { fill: C.ochre, w: lw });
  disc(ctx, ...u(0.34, 0.36), w * 0.2, C.white, lw);
  disc(ctx, ...u(0.38, 0.33), w * 0.075, C.stucco, lw * 0.8);
  line(ctx, spiral(u(0.38, 0.33)[0], u(0.38, 0.33)[1], w * 0.05, w * 0.012, 3.4, 8.2, 14), lw * 0.75, false);
  ctx.restore();
  const sy = y + mh + 3, sh = h - mh - 3;
  shape(ctx, rr(x + 2, sy, w - 4, sh, 16, 43, 0.8), { fill: null, w: lw });
  for (const a of [0.27, 0.73]) {
    const cx = x + a * w, cy = sy + sh / 2, r = sh * 0.4;
    disc(ctx, cx, cy, r, C.white, lw * 0.9);
    rosette(ctx, cx, cy, r * 0.9, 0.4, lw * 0.75);
  }
  disc(ctx, x + w / 2, sy + sh / 2, 2.6, C.black, 0);
}
/** the caption glyph by the tally: a rosette wheel over a foot — "strokes of the pedal" */
function pedalGlyph(ctx, x, y, w, h) {
  const mh = h * 0.62, lw = LW;
  shape(ctx, rr(x, y, w, mh, 20, 51, 1), { fill: null, w: lw * 1.05 });
  const r = Math.min(w, mh) * 0.36;
  disc(ctx, x + w * 0.5, y + mh * 0.5, r, C.white, lw);
  rosette(ctx, x + w * 0.5, y + mh * 0.5, r * 0.92, 0.2, lw * 0.8);
  for (const [a, b] of [[0.13, 0.2], [0.87, 0.2], [0.13, 0.8], [0.87, 0.8]]) disc(ctx, x + w * a, y + mh * b, 2.6, C.black, 0);
  const sy = y + mh + 3, sh = h - mh - 3;
  shape(ctx, rr(x + 2, sy, w - 4, sh, 13, 52, 0.8), { fill: C.ochreLt, w: lw });
  const u = (a, b) => [x + a * w, sy + b * sh];
  shape(ctx, [u(0.2, 0.42), u(0.36, 0.3), u(0.62, 0.36), u(0.76, 0.5), u(0.66, 0.7), u(0.36, 0.72), u(0.22, 0.62)], { fill: C.white, w: lw * 0.85 });
  for (const [a, b] of [[0.82, 0.3], [0.86, 0.46], [0.84, 0.62], [0.78, 0.76]]) disc(ctx, ...u(a, b), 2.3, C.black, 0);
}

// ------------------------------------------------------------------------------------------- the seated figures
// Figure-local coordinates: facing +x, y down, seated on y = 0. Bodies are baked; heads are sprites; the scribe's
// brush arm is drawn per frame.
function seatedBody(ctx, kind) {
  const scribe = kind === 'scribe';
  const skin = scribe ? C.skin : C.blueLt;
  const cloth = scribe ? C.red : C.ochre, trim = scribe ? C.blue : C.red;
  // seat
  if (scribe) {
    shape(ctx, [[-76, 0], [72, 0], [72, 17], [-76, 17]], { fill: C.ochreLt, smooth: false });
    ctx.save();
    K.path(ctx, [[-76, 0], [72, 0], [72, 17], [-76, 17]], true);
    ctx.clip();
    for (let x = -100; x < 90; x += 11) {
      line(ctx, [[x, 0], [x + 17, 17]], LW * Q * 0.6, false);
      line(ctx, [[x + 17, 0], [x, 17]], LW * Q * 0.6, false);
    }
    ctx.restore();
  } else {
    shape(ctx, [[-66, 8], [-44, 8], [-44, 17], [-66, 17]], { fill: C.blue, smooth: false });
    shape(ctx, [[44, 8], [66, 8], [66, 17], [44, 17]], { fill: C.blue, smooth: false });
    for (const x of [-22, 0, 22]) disc(ctx, x, 12.5, 2.6, C.black, 0);
    shape(ctx, [[-74, 0], [74, 0], [74, 8], [-74, 8]], { fill: C.red, smooth: false });
  }
  // sash tails behind the hips
  shape(ctx, [[-46, -68], [-60, -63], [-75, -47], [-82, -26], [-71, -19], [-63, -36], [-52, -52]], { fill: scribe ? C.ochre : C.red });
  line(ctx, [[-79, -32], [-69, -26]], LW * Q * 0.7, false);
  line(ctx, [[-76, -40], [-66, -33]], LW * Q * 0.7, false);
  shape(ctx, [[-44, -62], [-54, -50], [-58, -30], [-50, -24], [-45, -40]], { fill: C.white });
  // folded leg and foot
  shape(ctx, [[56, -21], [63, -11], [50, -1], [12, 0], [-12, -2], [-14, -15], [6, -22], [34, -25]], { fill: skin });
  shape(ctx, [[-12, -17], [-32, -18], [-50, -12], [-55, -4], [-43, 0], [-12, -1]], { fill: skin });
  line(ctx, [[-45, -11], [-50, -4]], LW * Q * 0.7, false);
  line(ctx, [[-39, -13], [-43, -4]], LW * Q * 0.7, false);
  shape(ctx, [[-12, -19], [-1, -21], [1, -1], [-10, -1]], { fill: trim, smooth: false });
  // thigh and knee band
  shape(ctx, [[-40, -58], [-10, -61], [26, -57], [52, -48], [65, -33], [58, -20], [36, -24], [4, -28], [-38, -30]], { fill: skin });
  shape(ctx, [[39, -54], [48, -51], [43, -23], [33, -24]], { fill: trim, smooth: false });
  // loincloth, apron, knot
  shape(ctx, [[-46, -77], [12, -79], [17, -57], [-44, -54]], { fill: cloth });
  shape(ctx, [[0, -62], [27, -58], [33, -39], [20, -33], [6, -37]], { fill: C.white });
  for (const [x, y] of [[12, -52], [22, -48], [15, -42]]) disc(ctx, x, y, 2, C.black, 0);
  disc(ctx, -47, -67, 8.5, trim);
  disc(ctx, -47, -67, 3, C.white, LW * Q * 0.7);
  // torso
  shape(ctx, [[-42, -77], [-47, -104], [-41, -126], [-24, -138], [-2, -137], [11, -123], [16, -100], [12, -79]], { fill: skin });
  line(ctx, [[-6, -88], [0, -84], [5, -88]], LW * Q * 0.7);
  // neck
  shape(ctx, [[-27, -150], [-27, -128], [7, -127], [9, -142]], { fill: skin, smooth: false });
  if (scribe) {
    // far arm, reaching along the thigh to hold the conch inkpot out beyond the knee
    shape(ctx, [[2, -106], [14, -109], [42, -74], [70, -48], [64, -37], [30, -60], [0, -92]], { fill: skin });
    shape(ctx, [[72, -27], [80, -38], [96, -41], [110, -35], [115, -24], [105, -14], [84, -11], [74, -17]], { fill: C.white });
    line(ctx, spiral(104, -25, 7.5, 1.5, 0.4, 7.2, 16), LW * Q * 0.75, false);
    for (const x of [82, 90, 98]) line(ctx, [[x, -13], [x + 2, -19]], LW * Q * 0.6, false);
    ctx.beginPath();
    ctx.ellipse(86, -36.5, 9.5, 3.4, -0.12, 0, TAU);
    ctx.fillStyle = C.black;
    ctx.fill();
    disc(ctx, 68, -41, 6.5, skin);
    line(ctx, [[66, -36], [73, -33], [77, -27]], LW * Q * 0.8);
  } else {
    // both arms forward with the offering bowl
    shape(ctx, [[-12, -126], [2, -130], [28, -100], [20, -88], [6, -96]], { fill: skin });
    shape(ctx, [[16, -101], [26, -105], [56, -97], [58, -85], [22, -86]], { fill: skin });
    shape(ctx, [[39, -101], [47, -99], [48, -85], [40, -85]], { fill: C.red, smooth: false });
    shape(ctx, [[46, -104], [90, -104], [86, -92], [78, -83], [58, -83], [50, -92]], { fill: C.ochre });
    shape(ctx, [[47, -102], [89, -102], [87, -96], [49, -96]], { fill: C.red, smooth: false, w: LW * Q * 0.8 });
    for (const [x, y] of [[57, -110], [79, -110], [68, -114]]) {
      disc(ctx, x, y, 7.5, C.white);
      disc(ctx, x, y, 1.8, C.black, 0);
    }
    line(ctx, [[68, -124], [65, -133], [70, -141], [79, -139], [80, -131], [74, -130]], LW * Q * 0.8);
    disc(ctx, 60, -90, 6.5, skin);
    line(ctx, [[57, -95], [62, -99]], LW * Q * 0.7, false);
  }
  // beaded collar and pendant
  shape(ctx, [[-44, -121], [-32, -137], [-8, -141], [9, -132], [14, -118], [4, -109], [-16, -115], [-36, -107]], { fill: scribe ? C.blue : C.ochre });
  for (const [x, y] of [[-34, -111], [-24, -116], [-13, -118], [-2, -115], [7, -113]]) disc(ctx, x, y, 3.1, C.white, LW * Q * 0.65);
  disc(ctx, -10, -104, 5, scribe ? C.ochre : C.red, LW * Q * 0.8);
}
const FACE_S = [[-28, -150], [-30, -170], [-18, -184], [2, -188], [18, -183], [30, -173], [42, -159], [52, -147], [50, -142], [43, -141], [44, -137], [47, -133], [42, -130], [44, -126], [40, -120], [30, -116], [14, -117], [-2, -121], [-16, -128], [-24, -138]];
const FACE_D = [[-28, -150], [-30, -170], [-18, -185], [2, -190], [18, -187], [31, -180], [45, -171], [57, -158], [64, -144], [62, -132], [55, -127], [52, -134], [52, -142], [46, -146], [42, -141], [45, -134], [40, -130], [43, -124], [36, -117], [22, -115], [4, -119], [-14, -126], [-24, -137]];
const EYE_D = [24.5, -162];
function scribeHead(ctx) {
  feather(ctx, [-24, -198], [-86, -172], 16, C.blue, -0.16);
  feather(ctx, [-24, -206], [-82, -206], 14, C.red, -0.12);
  shape(ctx, [[-27, -152], [-40, -158], [-47, -147], [-41, -134], [-27, -137]], { fill: C.black });
  shape(ctx, FACE_S, { fill: C.skin });
  // net turban with two spare pens tucked in
  line(ctx, [[5, -208], [40, -231]], LW * Q * 1.5, false);
  line(ctx, [[12, -203], [49, -221]], LW * Q * 1.5, false);
  const turban = [[-31, -170], [-36, -194], [-25, -212], [-2, -220], [18, -213], [27, -197], [29, -178], [10, -187], [-10, -187], [-24, -178]];
  shape(ctx, turban, { fill: C.white });
  ctx.save();
  K.spline(ctx, turban, true);
  ctx.clip();
  for (let x = -90; x < 60; x += 12) {
    line(ctx, [[x, -225], [x + 60, -165]], LW * Q * 0.55, false);
    line(ctx, [[x + 60, -225], [x, -165]], LW * Q * 0.55, false);
  }
  ctx.restore();
  shape(ctx, [[-32, -166], [-25, -181], [-8, -189], [12, -188], [31, -178], [29, -169], [12, -178], [-8, -180], [-22, -173], [-28, -160]], { fill: C.red });
  disc(ctx, 24, -178, 5, C.ochre, LW * Q * 0.8);
  // ear flare and pendant
  shape(ctx, [[-11, -145], [-5, -145], [-4, -131], [-12, -131]], { fill: C.white, smooth: false, w: LW * Q * 0.8 });
  disc(ctx, -8, -127, 4, C.blue, LW * Q * 0.8);
  disc(ctx, -8, -152, 8.5, C.ochre);
  disc(ctx, -8, -152, 3, C.white, LW * Q * 0.7);
  // eye, mouth, cheek dots
  shape(ctx, [[17, -161], [25, -166], [34, -161], [32, -155], [24, -153], [17, -156]], { fill: C.white, w: LW * Q * 0.85 });
  disc(ctx, 28, -158.5, 2.9, C.black, 0);
  line(ctx, [[14, -168], [25, -172], [37, -166]], LW * Q * 0.8);
  line(ctx, [[46, -134], [37, -133]], LW * Q * 0.8, false);
  disc(ctx, 20, -138, 1.7, C.black, 0);
  disc(ctx, 13, -134, 1.7, C.black, 0);
}
function deityHead(ctx) {
  feather(ctx, [-6, -206], [-52, -234], 15, C.ochre, 0.14);
  feather(ctx, [-12, -204], [-80, -208], 16, C.red, 0.1);
  feather(ctx, [-18, -198], [-88, -176], 15, C.ochre, -0.12);
  shape(ctx, [[-27, -152], [-40, -160], [-48, -148], [-42, -133], [-27, -137]], { fill: C.black });
  shape(ctx, FACE_D, { fill: C.blueLt });
  // forward water-scroll and striped bundle on the head
  shape(ctx, [[8, -206], [24, -226], [46, -226], [56, -210], [48, -199], [43, -210], [32, -214], [20, -200]], { fill: C.blue });
  line(ctx, spiral(44, -212, 5, 1, 2.2, 7, 12), LW * Q * 0.7, false);
  const bundle = [[-29, -174], [-31, -196], [-19, -209], [2, -213], [18, -205], [26, -190], [25, -180]];
  shape(ctx, bundle, { fill: C.ochre });
  for (const x of [-18, -6, 6, 16]) line(ctx, [[x, -210], [x + 1, -182]], LW * Q * 0.7, false);
  shape(ctx, [[-32, -166], [-25, -181], [-8, -189], [12, -189], [32, -181], [30, -172], [12, -179], [-8, -180], [-22, -173], [-28, -160]], { fill: C.red });
  disc(ctx, -30, -172, 6.5, C.white, LW * Q * 0.8);
  // shell ear ornament
  shape(ctx, [[-12, -145], [-4, -145], [-2, -128], [-8, -120], [-14, -128]], { fill: C.white, w: LW * Q * 0.8 });
  line(ctx, [[-8, -142], [-8, -126]], LW * Q * 0.6, false);
  disc(ctx, -8, -152, 9, C.ochre);
  disc(ctx, -8, -152, 3.2, C.red, LW * Q * 0.7);
  // the big scroll eye (its pupil is drawn per frame), brow curl, mouth with a barbel scroll
  shape(ctx, [[13, -168], [24, -172], [35, -169], [36, -158], [25, -153], [13, -157]], { fill: C.white, w: LW * Q * 0.9 });
  line(ctx, [[10, -174], [24, -178], [38, -175], [43, -181], [39, -186], [35, -182]], LW * Q * 0.8);
  line(ctx, [[45, -133], [35, -131]], LW * Q * 0.8, false);
  line(ctx, [[37, -129], [38, -121], [32, -116], [26, -120], [29, -125]], LW * Q * 0.8);
  disc(ctx, 55, -138, 1.7, C.black, 0);
}
function headSprite(draw) {
  // figure-local box x −96…74, y −240…−108 → layer 170 × 132
  return K.layer(170, 132, 2.4, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.translate(96, 240);
    draw(ctx);
  });
}
function putHead(ctx, f, sprite, angle, extra = null) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.k * f.dir, f.k);
  ctx.translate(PIVOT[0], PIVOT[1]);
  ctx.rotate(angle);
  ctx.translate(-PIVOT[0], -PIVOT[1]);
  ctx.drawImage(sprite, -96, -240, 170, 132);
  if (extra) {
    Q = 1 / f.k;
    extra(ctx);
    Q = 1;
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the page (baked once)
function skySign(ctx, i, x, y, w, h) {
  const fills = [C.blue, null, C.ochre, null, C.red, null, C.blueLt, null, C.ochre];
  shape(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { fill: fills[i % fills.length], smooth: false, w: LW });
  const ix = x + 9, iy = y + 8, iw = w - 18, ih = h - 16, m = Math.min(iw, ih), lw = LW * 0.9;
  shape(ctx, rr(ix, iy, iw, ih, 9, 60 + i, 0.7), { fill: C.stucco, w: lw });
  const u = (a, b) => [ix + a * iw, iy + b * ih];
  switch (i % 8) {
    case 0: // crossed bands
      for (const d of [-0.05, 0.05]) {
        line(ctx, [u(0.12 + d, 0.12), u(0.88 + d, 0.88)], lw, false);
        line(ctx, [u(0.88 + d, 0.12), u(0.12 + d, 0.88)], lw, false);
      }
      disc(ctx, ...u(0.5, 0.5), m * 0.13, C.red, lw);
      break;
    case 1: // stepped earth fret
      shape(ctx, [u(0.1, 0.84), u(0.1, 0.56), u(0.3, 0.56), u(0.3, 0.3), u(0.5, 0.3), u(0.5, 0.56), u(0.7, 0.56), u(0.7, 0.3), u(0.9, 0.3), u(0.9, 0.84)], { fill: C.ochre, smooth: false, w: lw });
      disc(ctx, ...u(0.4, 0.16), m * 0.05, C.black, 0);
      disc(ctx, ...u(0.8, 0.16), m * 0.05, C.black, 0);
      break;
    case 2: { // rayed disc
      const [cx, cy] = u(0.5, 0.5);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + 0.2;
        line(ctx, [[cx + Math.cos(a) * m * 0.26, cy + Math.sin(a) * m * 0.26], [cx + Math.cos(a) * m * 0.42, cy + Math.sin(a) * m * 0.42]], lw, false);
      }
      disc(ctx, cx, cy, m * 0.24, C.white, lw);
      disc(ctx, cx, cy, m * 0.09, C.black, 0);
      break;
    }
    case 3: // paired scrolls
      line(ctx, spiral(u(0.3, 0.52)[0], u(0.3, 0.52)[1], m * 0.3, m * 0.05, Math.PI, Math.PI + 5.6, 20), lw, false);
      line(ctx, spiral(u(0.7, 0.48)[0], u(0.7, 0.48)[1], m * 0.3, m * 0.05, 0, 5.6, 20), lw, false);
      break;
    case 4: // quincunx
      for (const [a, b] of [[0.22, 0.24], [0.78, 0.24], [0.22, 0.76], [0.78, 0.76]]) disc(ctx, ...u(a, b), m * 0.1, C.blue, lw * 0.9);
      shape(ctx, [u(0.5, 0.26), u(0.66, 0.5), u(0.5, 0.74), u(0.34, 0.5)], { fill: C.red, smooth: false, w: lw });
      break;
    case 5: // crescent and three pips
      line(ctx, [u(0.16, 0.2), u(0.2, 0.62), u(0.5, 0.82), u(0.8, 0.62), u(0.84, 0.2)], lw);
      line(ctx, [u(0.32, 0.2), u(0.36, 0.5), u(0.5, 0.6), u(0.64, 0.5), u(0.68, 0.2)], lw);
      for (const a of [0.3, 0.5, 0.7]) disc(ctx, ...u(a, 0.92 - Math.abs(a - 0.5) * 0.3), m * 0.045, C.black, 0);
      disc(ctx, ...u(0.5, 0.3), m * 0.08, C.ochre, lw * 0.8);
      break;
    case 6: // wave band
      shape(ctx, [u(0.0, 0.62), u(0.17, 0.44), u(0.33, 0.62), u(0.5, 0.44), u(0.67, 0.62), u(0.83, 0.44), u(1.0, 0.62), u(1.0, 1.0), u(0.0, 1.0)], { fill: C.blue, w: lw });
      for (const a of [0.25, 0.5, 0.75]) disc(ctx, ...u(a, 0.24), m * 0.055, C.black, 0);
      break;
    default: // nested lozenges
      shape(ctx, [u(0.5, 0.08), u(0.9, 0.5), u(0.5, 0.92), u(0.1, 0.5)], { fill: null, smooth: false, w: lw });
      shape(ctx, [u(0.5, 0.28), u(0.72, 0.5), u(0.5, 0.72), u(0.28, 0.5)], { fill: C.ochre, smooth: false, w: lw });
  }
}
function buildBase() {
  return K.layer(1000, 1000, 1.2, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // lime stucco ground
    ctx.drawImage(K.paper({ w: 1000, h: 1000, res: 0.6, base: C.stucco, seed: 7, mottle: 0.5, mottleColor: '#b99a68', lightColor: '#fbf6e8', fiber: 0.12, speck: 0.5, stains: 0.5, stainColor: '#9a7440', edge: 0 }), 0, 0, 1000, 1000);
    // broad strokes of the stucco float
    ctx.drawImage(K.noiseLayer({ scale: 70, oct: 3, seed: 17, color: '#fffaf0', lo: 0.5, hi: 0.9, alpha: 0.35, res: 0.5, stretch: [0.1, 1.5] }), 0, 0, 1000, 1000);

    // ---- sky / earth band and water band below the road
    const cw = (B1 - B0 - 12) / 9;
    for (let i = 0; i < 9; i++) skySign(ctx, i, B0 + 6 + i * cw, 824, cw, 64);
    const wave = [];
    for (let x = B0 + 6; x <= B1 - 6; x += 12) wave.push([x, 906 + 4 * Math.sin((x - 34) * 0.097)]);
    shape(ctx, wave.concat([[B1 - 6, 964], [B0 + 6, 964]]), { fill: C.blue, smooth: false, w: LW });
    line(ctx, wave.map(([x, y]) => [x, y + 9]), LW * 0.8, false);
    for (let i = 0; i < 14; i++) {
      const cx = 72 + i * 66, cy = 942;
      if (i % 4 === 2) {
        shape(ctx, [[cx - 20, cy], [cx - 8, cy - 11], [cx + 10, cy - 10], [cx + 21, cy], [cx + 9, cy + 10], [cx - 9, cy + 10]], { fill: C.white, w: LW * 0.9 });
        line(ctx, spiral(cx + 8, cy, 7, 1.2, 0.3, 6.6, 14), LW * 0.7, false);
        line(ctx, [[cx - 12, cy - 4], [cx - 2, cy]], LW * 0.6, false);
        line(ctx, [[cx - 12, cy + 4], [cx - 2, cy]], LW * 0.6, false);
      } else {
        line(ctx, spiral(cx, cy, 15, 3, Math.PI, Math.PI + 6.8, 22), LW * 0.9, false);
        line(ctx, [[cx - 15, cy], [cx - 30, cy + 9]], LW * 0.9, false);
        disc(ctx, cx + 25, cy - 8, 2.6, C.stucco, 0);
        disc(ctx, cx + 30, cy + 6, 2.2, C.stucco, 0);
      }
    }

    // ---- red frame lines
    redLine(ctx, B0 - 4, B0, B1 + 4, B0, 6.5, 1);
    redLine(ctx, B0 - 4, B1, B1 + 4, B1, 6.5, 2);
    redLine(ctx, B0, B0 - 4, B0, B1 + 4, 6.5, 3);
    redLine(ctx, B1, B0 - 4, B1, B1 + 4, 6.5, 4);
    redLine(ctx, B0, YA, B1, YA, 6.5, 5);
    redLine(ctx, XL, YB, XR, YB, 6, 6);
    redLine(ctx, XL, YA, XL, ROAD + 4, 6, 7);
    redLine(ctx, XR, YA, XR, ROAD + 4, 6, 8);
    redLine(ctx, XT, B0, XT, YA, 6, 9);
    redLine(ctx, B0, 896, B1, 896, 6, 10);
    // the road: the base line of the main compartment, edge to edge, with its black companion line
    redLine(ctx, -8, ROAD + 5.4, 1008, ROAD + 5.4, 10.5, 11);
    line(ctx, [[-4, ROAD + 15], [1004, ROAD + 15]], 1.7, false);

    // ---- title compartment: emblem glyph + lettering in the codex's black line
    emblem(ctx, 44, 44, 104, 160);
    K.titleBlock(ctx, TITLES[7], 166, 56, {
      color: C.line, gap: 1.3,
      zh: { size: 50, weight: 900, font: K.FONT.cjkSerif, tracking: 3 }, en: { size: 29, weight: 700, font: K.FONT.serif, tracking: 0.5 }, date: { size: 24, weight: 700, font: K.FONT.serif, italic: false },
    });
    for (const x of [172, 196, 220]) disc(ctx, x, 196, 3.4, C.red, 0);
    line(ctx, [[238, 196], [438, 196]], 1.8, false, C.red);

    // ---- glyph blocks: two rows across the top, a column down each side
    let s = 3;
    for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) glyph(ctx, 480 + i * 97.5, 37 + row * 89, 89, 83, s++, { sign: row * 5 + i * 3 + 1 });
    for (let i = 0; i < 6; i++) {
      glyph(ctx, 37, 228 + i * 95.5, 70, 87, s++, { sign: i * 5 + 2, pre: i % 3 !== 1 });
      glyph(ctx, 893, 228 + i * 95.5, 70, 87, s++, { sign: i * 7 + 6, pre: i % 3 !== 2 });
    }

    // ---- the scribes' register
    // a closed screenfold book under a jaguar-pelt cover, a paint jar with spare brushes, and a caption
    shape(ctx, [[136, 438], [238, 438], [238, 468], [136, 468]], { fill: C.white, smooth: false });
    for (const y of [444, 450, 456, 462]) line(ctx, [[138, y], [236, y]], LW * 0.55, false);
    shape(ctx, [[132, 428], [242, 428], [242, 439], [132, 439]], { fill: C.ochre, smooth: false });
    for (let i = 0; i < 9; i++) disc(ctx, 141 + i * 11.6, 433.5 + (i % 2 ? 1.6 : -1.6), 2.3, C.black, 0);
    shape(ctx, [[181, 426], [193, 426], [193, 470], [181, 470]], { fill: C.red, smooth: false, w: LW * 0.9 });
    line(ctx, [[176, 392], [168, 352]], LW * 1.3, false);
    line(ctx, [[188, 392], [198, 346]], LW * 1.3, false);
    line(ctx, [[166, 351], [164, 341]], LW * 2.2, false);
    line(ctx, [[199, 345], [202, 335]], LW * 2.2, false);
    shape(ctx, [[158, 428], [152, 408], [160, 390], [204, 390], [212, 408], [206, 428]], { fill: C.blue });
    shape(ctx, [[154, 402], [210, 402], [211, 414], [153, 414]], { fill: C.white, smooth: false, w: LW * 0.8 });
    for (const x of [164, 176, 188, 200]) disc(ctx, x, 408, 2.2, C.black, 0);
    glyph(ctx, 128, 232, 86, 62, 71, { sign: 4, pre: true, top: false, bot: false });
    glyph(ctx, 128, 300, 60, 34, 72, { sign: 10, pre: false, top: false, bot: false });
    // caption column by the tally: an invented phrase and the wheel-over-foot sign
    glyph(ctx, 594, 232, 80, 60, 73, { sign: 0, pre: true, top: false, bot: false });
    pedalGlyph(ctx, 598, 300, 72, 92);
    glyph(ctx, 838, 232, 42, 56, 74, { sign: 8, pre: false, top: true, bot: false });
    // the numeral cartouche the scribe paints in
    shape(ctx, rr(CART.x, CART.y, CART.w, CART.h, 20, 31, 0.9), { fill: C.white, stroke: C.red, w: 6 });
    shape(ctx, rr(CART.x + 7, CART.y + 7, CART.w - 14, CART.h - 14, 14, 32, 0.7), { fill: null, w: LW * 0.7 });
    for (const [x, y] of [[CART.x - 1, CART.y - 1], [CART.x + CART.w + 1, CART.y - 1], [CART.x - 1, CART.y + CART.h + 1], [CART.x + CART.w + 1, CART.y + CART.h + 1]]) disc(ctx, x, y, 5.5, C.ochre, LW * 0.8);
    // the two seated figures (heads and brush arm are added per frame)
    withFig(ctx, SCRIBE, () => seatedBody(ctx, 'scribe'));
    withFig(ctx, DEITY, () => seatedBody(ctx, 'deity'));
  });
}

// ------------------------------------------------------------------------------------------- wear (drawn over everything)
function flake(cx, cy, r, seed, n = 13) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (K.hash1(seed * 31 + i) - 0.5) * 0.5;
    const rad = r * (0.5 + 0.8 * K.hash1(seed * 57 + i * 3));
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.9]);
  }
  return pts;
}
function buildWear() {
  const bark = K.layer(1000, 1000, 0.6, (c) => {
    c.fillStyle = '#7d5833';
    c.fillRect(0, 0, 1000, 1000);
    c.drawImage(K.noiseLayer({ scale: 60, oct: 4, seed: 81, color: '#3f2814', lo: 0.4, hi: 0.85, alpha: 0.6, res: 0.3, stretch: [0.4, 1.6] }), 0, 0, 1000, 1000);
    K.fibers(c, 1000, 1000, { n: 5200, seed: 82, color: '#c99c64', alpha: 0.4, len: [10, 46], width: 0.9, angle: 0, spread: 1.3 });
    K.fibers(c, 1000, 1000, { n: 3000, seed: 83, color: '#2e1c0e', alpha: 0.32, len: [8, 36], width: 0.8 });
  });
  return K.layer(1000, 1000, 1.2, (ctx) => {
    // abraded, thinly brushed pigment: stucco showing through the paint
    ctx.drawImage(K.noiseLayer({ scale: 15, oct: 3, seed: 71, color: C.stucco, lo: 0.58, hi: 0.82, alpha: 0.5, res: 0.6 }), 0, 0, 1000, 1000);
    ctx.drawImage(K.noiseLayer({ scale: 95, oct: 4, seed: 72, color: C.stucco, lo: 0.56, hi: 0.86, alpha: 0.34, res: 0.4 }), 0, 0, 1000, 1000);
    ctx.drawImage(K.noiseLayer({ scale: 34, oct: 3, seed: 73, color: '#f6f0e0', lo: 0.52, hi: 0.92, alpha: 0.26, res: 0.6, stretch: [0.12, 1.9] }), 0, 0, 1000, 1000);
    // … but spare the lettering and the tally
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const [x, y, w, h] of [[160, 48, 300, 160], [CART.x, CART.y, CART.w, CART.h]]) {
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = 'rgba(0,0,0,0.26)';
        K.roundRect(ctx, x - 12 + k * 5, y - 12 + k * 5, w + 24 - k * 10, h + 24 - k * 10, 16);
        ctx.fill();
      }
    }
    ctx.restore();
    // age: tea-brown stains, tide lines, foxing
    ctx.drawImage(K.noiseLayer({ scale: 320, oct: 4, seed: 74, color: '#8a6636', lo: 0.46, hi: 0.86, alpha: 0.3, res: 0.25 }), 0, 0, 1000, 1000);
    ctx.drawImage(K.noiseLayer({ scale: 130, oct: 4, seed: 75, color: '#6e4e26', lo: 0.6, hi: 0.72, alpha: 0.16, res: 0.4, ridged: true }), 0, 0, 1000, 1000);
    K.stipple(ctx, 260, (r) => [r() * 1000, r() * 1000, r.range(0.6, 2.4)], { color: '#6a4a26', alpha: 0.3, seed: 76 });
    // hairline crazing of the stucco: a light lip beside each dark crack
    ctx.save();
    ctx.translate(0.9, 0.9);
    K.cracks(ctx, 1000, 1000, { n: 80, seed: 77, color: '#fffaf0', alpha: 0.5, width: 0.8, len: 95, branch: 0.7, wander: 0.95 });
    ctx.restore();
    K.cracks(ctx, 1000, 1000, { n: 80, seed: 77, color: '#4a3622', alpha: 0.42, width: 0.75, len: 95, branch: 0.7, wander: 0.95 });
    K.cracks(ctx, 1000, 1000, { n: 9, seed: 78, color: '#3a2816', alpha: 0.5, width: 1.1, len: 340, branch: 0.5, wander: 0.5 });
    // the fold of the screenfold: a shadowed valley and a lit ridge
    const fx = 879;
    ctx.fillStyle = K.linGrad(ctx, fx - 26, 0, fx + 14, 0, [[0, 'rgba(70,46,22,0)'], [0.62, 'rgba(70,46,22,0.3)'], [0.72, 'rgba(60,38,18,0.42)'], [0.8, 'rgba(255,250,236,0.4)'], [1, 'rgba(255,250,236,0)']]);
    ctx.fillRect(fx - 26, 0, 40, 1000);
    // flaked stucco: bark paper showing at the corners, along the edges and down the fold
    const flakes = [flake(0, 0, 84, 1), flake(1000, 0, 108, 2), flake(0, 1000, 92, 3), flake(1000, 1000, 70, 4), flake(1000, 520, 30, 5, 9), flake(0, 640, 26, 6, 9), flake(610, 1000, 28, 7, 9), flake(300, 0, 22, 8, 9)];
    const r = K.rng(91);
    for (let i = 0; i < 9; i++) flakes.push(flake(fx - 4 + r.range(-3, 3), 20 + i * 108 + r.range(-30, 30), r.range(4, 12), 20 + i, 8));
    for (let i = 0; i < 46; i++) {
      const x = r.range(10, 990), y = r.range(10, 990);
      if ((x > 150 && x < 470 && y > 40 && y < 214) || (x > CART.x - 14 && x < CART.x + CART.w + 14 && y > CART.y - 14 && y < CART.y + CART.h + 14)) continue;
      flakes.push(flake(x, y, r.range(2.5, 8), 40 + i, 7));
    }
    // ragged edges of the leaf
    const edge = (side) => {
      const pts = [];
      for (let i = 0; i <= 100; i++) {
        const u = i * 10, d = 2.5 + 11 * Math.pow(K.noise1(u * 0.021, 90 + side), 2) + 4 * K.noise1(u * 0.19, 95 + side);
        pts.push(side === 0 ? [u, d] : side === 1 ? [1000 - d, u] : side === 2 ? [u, 1000 - d] : [d, u]);
      }
      const out = side === 0 ? [[1010, -10], [-10, -10]] : side === 1 ? [[1010, 1010], [1010, -10]] : side === 2 ? [[1010, 1010], [-10, 1010]] : [[-10, 1010], [-10, -10]];
      return pts.concat(out);
    };
    for (let k = 0; k < 4; k++) flakes.push(edge(k));
    ctx.save();
    ctx.beginPath();
    for (const f of flakes) {
      ctx.moveTo(f[0][0], f[0][1]);
      for (let i = 1; i < f.length; i++) ctx.lineTo(f[i][0], f[i][1]);
      ctx.closePath();
    }
    ctx.clip();
    ctx.drawImage(bark, 0, 0, 1000, 1000);
    // the stucco's thickness casts a little shadow onto the bark along the upper-left lips
    ctx.strokeStyle = 'rgba(30,16,6,0.55)';
    ctx.lineWidth = 3.4;
    ctx.lineJoin = 'round';
    for (const f of flakes) {
      K.path(ctx, f.map(([x, y]) => [x + 1.6, y + 1.6]), true);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,250,236,0.75)';
    ctx.lineWidth = 1.1;
    ctx.lineJoin = 'round';
    for (const f of flakes) {
      K.path(ctx, f, true);
      ctx.stroke();
    }
    // grime gathers toward the edges; a faint tooth over all
    K.vignette(ctx, 1000, 1000, 0.34, '#4e3418', 0.58);
    K.grain(ctx, 0, 0, 1000, 1000, { color: '#3a2610', alpha: 0.07, seed: 9, size: 1 });
  });
}

// ------------------------------------------------------------------------------------------- the tally, per frame
function shellZero(ctx, cx, cy, a) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.6 + 0.4 * a, 0.6 + 0.4 * a);
  ctx.globalAlpha *= a;
  shape(ctx, [[-42, 0], [-24, -15], [0, -20], [24, -15], [42, 0], [24, 15], [0, 20], [-24, 15]], { fill: C.red, w: LW });
  for (const k of [-9, 0, 9]) line(ctx, [[-36, k * 0.15], [-12, k], [12, k], [36, k * 0.15]], LW * 0.75);
  disc(ctx, -42, 0, 3.4, C.ochre, LW * 0.7);
  disc(ctx, 42, 0, 3.4, C.ochre, LW * 0.7);
  ctx.restore();
}
function drawTally(ctx, t) {
  const n = countAt(t), bars = Math.floor(n / 5), dots = n % 5;
  const za = 1 - K.prog(t, 0.5, 0.1);
  if (za > 0) shellZero(ctx, NUM.cx, NUM.rows[1], za);
  const W = NUM.dx * 4 + NUM.r * 2;
  for (let row = 0; row < 3; row++) {
    const y = NUM.rows[row];
    if (row < bars) {
      // five dots fused into a bar: a quick squash, red-hot for a moment, then black
      const age = t - (row + 1) * 2.5, m = K.ease.out3(K.prog(age, 0, 0.1)), e = Math.exp(-Math.max(0, age) * 11);
      const col = K.mix(C.redHi, C.black, K.smoothstep(0.06, 0.6, age));
      ctx.save();
      ctx.translate(NUM.cx, y);
      ctx.scale(1 + 0.09 * e, 1 + 0.3 * e);
      ctx.fillStyle = col;
      if (m < 1) {
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc((i - 2) * NUM.dx, 0, NUM.r, 0, TAU);
          ctx.fill();
        }
        ctx.fillRect(-W / 2 + NUM.r, -NUM.r * m, W - 2 * NUM.r, 2 * NUM.r * m);
      } else {
        K.roundRect(ctx, -W / 2, -NUM.barH / 2, W, NUM.barH, 5);
        ctx.fill();
      }
      ctx.restore();
      if (age < 0.55) {
        const u = age / 0.55, o = K.ease.out3(u);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = K.rgba(C.redHi, 0.9 * (1 - u * u));
        ctx.lineWidth = 3.4 * (1 - u) + 0.8;
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * TAU + 0.2, rx = W / 2 + 10 + 30 * o, ry = 19 + 22 * o, len = 13 * (1 - u) + 2;
          ctx.moveTo(NUM.cx + Math.cos(a) * rx, y + Math.sin(a) * ry);
          ctx.lineTo(NUM.cx + Math.cos(a) * (rx + len), y + Math.sin(a) * (ry + len * 0.8));
        }
        ctx.stroke();
        ctx.lineWidth = 5 * (1 - u) + 0.6;
        K.roundRect(ctx, NUM.cx - W / 2 - 5 - 12 * o, y - NUM.barH / 2 - 5 - 9 * o, W + 10 + 24 * o, NUM.barH + 10 + 18 * o, 10 + 8 * o);
        ctx.stroke();
        // the cartouche's own frame flushes red
        ctx.strokeStyle = K.rgba(C.redHi, 0.75 * (1 - u));
        ctx.lineWidth = 6 + 5 * (1 - u);
        K.spline(ctx, rr(CART.x, CART.y, CART.w, CART.h, 20, 31, 0.9), true);
        ctx.stroke();
        ctx.restore();
      }
    } else if (row === bars) {
      for (let j = 0; j < dots; j++) {
        const age = t - (row * 5 + j + 1) * 0.5, x = slotX(ORDER[j]);
        disc(ctx, x, y, NUM.r * K.ease.outBack(K.prog(age, 0, 0.12), 2.6), C.black, 0);
        if (age < 0.26) disc(ctx, x, y, NUM.r + 2 + 11 * K.ease.out3(age / 0.26), null, 1.6 * (1 - age / 0.26) + 0.3, K.rgba(C.black, 0.7 * (1 - age / 0.26)));
      }
    }
  }
}

// ------------------------------------------------------------------------------------------- the scribe's brush arm
/** where the tip of the brush is: at rest in the conch, then out to each dot exactly on its beat and back toward the ink */
function brushTip(t) {
  if (t <= 0 || t >= 6.5) return INK;
  const n0 = Math.floor(t / 0.5 + 1e-6), p = t / 0.5 - n0;
  const a = n0 >= 1 ? dabPos(Math.min(12, n0)) : INK, b = n0 + 1 <= 12 ? dabPos(n0 + 1) : INK;
  const s = n0 === 0 ? K.smoothstep(0.35, 1, p) : n0 >= 12 ? K.smoothstep(0, 0.7, p) : K.smoothstep(0, 1, p);
  const pull = 0.72 * Math.sin(Math.PI * p);
  return mixPt(mixPt(a, b, s), INK, n0 === 0 || n0 >= 12 ? pull * (n0 === 0 ? s : 1 - s) : pull);
}
function ik2(S, H, l1, l2, bend) {
  const dx = H[0] - S[0], dy = H[1] - S[1];
  const d = K.clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
  const a = Math.acos(K.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = Math.atan2(dy, dx) - bend * a;
  return [S[0] + Math.cos(ang) * l1, S[1] + Math.sin(ang) * l1];
}
function drawBrushArm(ctx, t) {
  const S = toWorld(SCRIBE, [-5, -121]);
  const tip = brushTip(t);
  // the hand keeps near its "home" in front of the lap and lets the brush do the travelling; far dots stretch the arm
  const reach = ARM.l1 + ARM.l2 - 3;
  let H = null;
  for (let k = 0; k <= 8; k++) {
    const q = mixPt(ARM.home, S, k / 8);
    const dx = q[0] - tip[0], dy = q[1] - tip[1], m = Math.hypot(dx, dy) || 1;
    H = [tip[0] + (dx / m) * ARM.brush, tip[1] + (dy / m) * ARM.brush];
    if (Math.hypot(H[0] - S[0], H[1] - S[1]) <= reach) break;
  }
  const E = ik2(S, H, ARM.l1, ARM.l2, -1);
  const dir = [(tip[0] - H[0]) / ARM.brush, (tip[1] - H[1]) / ARM.brush], nrm = [-dir[1], dir[0]];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const seg = (a, b, w, col) => {
    K.path(ctx, [a, b]);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = w + LW * 2;
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  seg(S, E, 13.5, C.skin);
  seg(E, H, 11.5, C.skin);
  disc(ctx, E[0], E[1], 5.6, C.skin, 0); // hide the joint seam
  seg(mixPt(E, H, 0.62), mixPt(E, H, 0.8), 12.5, C.blue);
  // the reed pen: butt end behind the fist, a black tuft at the tip
  const butt = [H[0] - dir[0] * 13, H[1] - dir[1] * 13], neck = [tip[0] - dir[0] * 13, tip[1] - dir[1] * 13];
  seg(butt, neck, 2.4, C.ochreLt);
  K.fillPoly(ctx, [[neck[0] + nrm[0] * 3.3, neck[1] + nrm[1] * 3.3], tip, [neck[0] - nrm[0] * 3.3, neck[1] - nrm[1] * 3.3]], C.black);
  disc(ctx, H[0], H[1], 7.6, C.skin);
  line(ctx, [[H[0] + nrm[0] * 4 - dir[0] * 4, H[1] + nrm[1] * 4 - dir[1] * 4], [H[0] + nrm[0] * 5 + dir[0] * 3, H[1] + nrm[1] * 5 + dir[1] * 3]], LW * 0.7, false);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the pelican, codex manner
const ROLE_FILL = { tire: C.black, frame: C.red, metal: C.black, saddle: C.black, leg: C.ochre, foot: C.ochre, body: C.white, wing: C.blue, neck: C.white, head: C.white, beak: C.ochre, pouch: C.red, scarf: C.red };
function drawPelican(ctx, pose, t) {
  const s = pose.s, lw = 3 * s;
  const G = pose.G.head, hx = (x, y) => [G[0] * x + G[2] * y + G[4], G[1] * x + G[3] * y + G[5]];
  const H0 = Rig.GEO.head, wind = pose.params.wind ?? 1;
  const stroke = (w = lw) => {
    ctx.strokeStyle = C.line;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of Rig.parts(pose)) {
    if (p.name.startsWith('crest')) continue; // replaced by the feathered headdress
    if (p.kind === 'poly') {
      if (p.name === 'head') {
        // headdress plumes spring from behind the head
        const base = [H0[0] - 9, H0[1] - 14];
        const plumes = [[-2.5, 56, C.blue], [-2.95, 62, C.red], [2.98, 54, C.blue], [-2.05, 42, C.ochre]];
        plumes.forEach(([a0, len, col], i) => {
          const a = a0 + (0.07 * Math.sin(t * 8.5 + i * 1.7) + 0.05 * Math.sin(t * 13 + i)) * wind;
          feather(ctx, hx(base[0] + i * 1.5, base[1] + i * 2), hx(base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len), 13 * s, col, i === 3 ? 0.14 : -0.1, lw * 0.85);
        });
      }
      K.path(ctx, p.pts, true);
      ctx.fillStyle = p.role === 'tail' ? [C.blue, C.red, C.blue][+p.name.slice(4) % 3] : ROLE_FILL[p.role] ?? C.white;
      ctx.fill();
      stroke(p.role === 'metal' ? lw * 0.7 : lw);
      if (p.name === 'pouch') {
        // ribbing of the pouch
        const q = p.pts, n = q.length;
        ctx.beginPath();
        for (const [a, b] of [[0.1, 0.8], [0.16, 0.66], [0.22, 0.5]]) {
          ctx.moveTo(q[Math.round(a * n)][0], q[Math.round(a * n)][1]);
          ctx.lineTo(q[Math.round(b * n) % n][0], q[Math.round(b * n) % n][1]);
        }
        stroke(lw * 0.5);
      } else if (p.name === 'head') {
        // headband, brow jewel, ear flare
        const band = [];
        for (let a = -0.9; a >= -3.25; a -= 0.235) band.push(hx(H0[0] + Math.cos(a) * 21.5, H0[1] + Math.sin(a) * 21));
        for (let a = -3.25; a <= -0.9; a += 0.235) band.push(hx(H0[0] + Math.cos(a) * 15.5, H0[1] + Math.sin(a) * 15));
        K.path(ctx, band, true);
        ctx.fillStyle = C.red;
        ctx.fill();
        stroke(lw * 0.8);
        disc(ctx, ...hx(H0[0] + 12.5, H0[1] - 16), 4.4 * s, C.ochre, lw * 0.75);
        disc(ctx, ...hx(H0[0] - 8.5, H0[1] + 5), 4.6 * s, C.ochre, lw * 0.75);
        disc(ctx, ...hx(H0[0] - 8.5, H0[1] + 5), 1.5 * s, C.black, 0);
      }
    } else if (p.kind === 'line') {
      K.path(ctx, p.pts);
      if (p.role === 'mark') stroke(lw * (p.name === 'beakLine' ? 0.6 : 0.75));
      else {
        const w = p.role === 'scarf' ? p.w * 0.95 : p.role === 'leg' ? p.w * 0.95 : p.role === 'frame' ? p.w * 1.05 : p.w;
        stroke(w + lw * 1.5);
        ctx.strokeStyle = p.role === 'metal' ? (p.name.startsWith('chain') ? C.line : C.ochreLt) : ROLE_FILL[p.role] ?? C.white;
        ctx.lineWidth = w;
        if (!p.name.startsWith('chain')) ctx.stroke();
      }
    } else if (p.kind === 'wheel') {
      disc(ctx, p.c[0], p.c[1], p.r * 0.97, C.black, 0);
      disc(ctx, p.c[0], p.c[1], p.r * 0.8, C.white, lw * 0.7);
      rosette(ctx, p.c[0], p.c[1], p.r * 0.78, p.a, lw);
    } else if (p.kind === 'disc') {
      disc(ctx, p.c[0], p.c[1], p.r, p.name === 'chainring' ? C.ochre : C.black, lw * 0.7);
      if (p.name === 'chainring') disc(ctx, p.c[0], p.c[1], p.r * 0.35, C.black, 0);
    } else if (p.kind === 'eye') {
      // the scroll eye
      const R = 6.6 * s, c = p.c, off = [(p.pupil[0] - c[0]) * 1.3, (p.pupil[1] - c[1]) * 1.3];
      disc(ctx, c[0], c[1], R, C.stucco, lw * 0.75);
      if (p.lid > 0.5) line(ctx, [[c[0] - R, c[1] + 1], [c[0], c[1] + 2.4 * s], [c[0] + R, c[1] + 1]], lw * 0.8);
      else {
        line(ctx, spiral(c[0] + off[0], c[1] + off[1], R * 0.62, R * 0.12, 2.6, 8.6, 16), lw * 0.7, false);
        disc(ctx, c[0] + off[0], c[1] + off[1], R * 0.22, C.black, 0);
      }
    }
  }
  // speech scrolls curl from the beak when it speaks
  const sp = speakAt(pose.t - T0);
  if (sp > 0.02) {
    const tip = pose.pt.beakTip, k = 1.12 * s, amt = K.ease.outBack(K.clamp(sp), 1.4);
    const scroll = (pts, w0, w1, col) => {
      const cl = K.catmull(pts.map(([x, y]) => [tip[0] + x * k, tip[1] + y * k]), 8);
      const part = cl.slice(0, Math.max(3, Math.round(cl.length * K.clamp(amt, 0, 1))));
      shape(ctx, K.ribbonPoly(part, (u) => K.lerp(w0, w1, u) * s * Math.min(1, amt)), { fill: col, smooth: false, w: lw * 0.85 });
    };
    scroll([[7, 5], [22, 8], [37, 0], [43, -14], [35, -23], [26, -17], [30, -10]], 8.5, 3.2, C.red);
    scroll([[5, -5], [17, -14], [29, -30], [33, -50], [23, -64], [8, -62], [3, -49], [11, -40], [20, -45]], 10.5, 3.4, C.blue);
    if (amt > 0.8) for (const [x, y] of [[50, -34], [60, -44], [53, -52]]) disc(ctx, tip[0] + x * k, tip[1] + y * k, 2.4 * s, C.black, 0);
  }
  ctx.restore();
}
const T0 = 5 + 6 * 6; // film time at which this section's local clock starts (pose.t is film time)

// ------------------------------------------------------------------------------------------- the scene
export default {
  id: 7, key: 'maya', title: TITLES[7], heroT: 3.2,

  act(t, p) {
    const g = K.gate(t, 0.5, 5.5, 0.3);
    const up = K.gate(t, 2.5, 3.0, 0.08, 0.22) + K.gate(t, 5.0, 5.4, 0.08, 0.2); // a glance at the new bar
    const sp = speakAt(t);
    p.eye = [g * K.lerp(0.25, -0.6, up), g * K.lerp(0, -1, up)];
    p.beakOpen = 0.55 * sp;
    p.neck = 0.3 * sp;
    p.headTilt = 0.1 * sp;
  },

  async init() {
    L = {
      base: buildBase(),
      wear: buildWear(),
      scribeHead: headSprite(scribeHead),
      deityHead: headSprite(deityHead),
    };
  },

  render(ctx, t, env) {
    K.put(ctx, L.base);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawTally(ctx, t);

    // the scribe: a small nod with each dab
    const n = Math.floor(t / 0.5 + 1e-6);
    const nod = n >= 1 && n <= 12 ? Math.exp(-(t - n * 0.5) * 9) : 0;
    const lean = K.smoothstep(0.1, 0.5, t) * (1 - K.smoothstep(6.1, 6.6, t));
    putHead(ctx, SCRIBE, L.scribeHead, 0.035 * lean + 0.075 * nod);
    drawBrushArm(ctx, t);

    // the rain-god: head and eye follow the pelican; a flick to the tally when a bar lands
    const pose = env.pose;
    const tx = pose ? pose.pt.head[0] : env.rider.lx + 24, ty = pose ? pose.pt.head[1] : 520;
    const flick = K.gate(t, 2.5, 2.95, 0.06, 0.16) + K.gate(t, 5.0, 5.42, 0.06, 0.16);
    const settle = K.smoothstep(7.6, 9.2, t);
    const eyeW = toWorld(DEITY, EYE_D);
    const aim = (x, y) => Math.atan2(y - eyeW[1], (x - eyeW[0]) * DEITY.dir);
    let a = K.lerp(aim(tx, ty), aim(NUM.cx, NUM.rows[1]), K.clamp(flick));
    a = K.lerp(a, 0.35, settle);
    const tilt = K.clamp(a, -0.2, 1.7) * 0.12;
    putHead(ctx, DEITY, L.deityHead, tilt, (c) => {
      const pa = a - tilt, px = EYE_D[0] + Math.cos(pa) * 6.2, py = EYE_D[1] + 1 + Math.sin(pa) * 3.6;
      line(c, spiral(px, py, 4.6, 1, pa + 2.4, pa + 8, 14), LW * Q * 0.7, false);
      disc(c, px, py, 2.7, C.black, 0);
    });

    if (pose) drawPelican(ctx, pose, t);
    ctx.restore();
    K.put(ctx, L.wear);
  },
};
