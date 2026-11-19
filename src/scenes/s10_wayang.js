// Section 10 — Javanese Wayang Kulit Shadow Puppetry (c. 1800)
// The audience's side of the kelir: white cotton lit amber by the oil lamp behind it, a dark red border cloth above
// (it carries the title in gilded puppet ornament) and below (the road is its top edge), and under that the banana
// trunk the puppets are planted in. Three nobles stand in rank on the left; on the right two squat servants, a noble
// and the tall tree-of-life leaf. All of them are original designs in the manner of the form.
//
// Technique: the picture is light × cloth × shadows. The lamp is a radial gradient drawn every frame (its place and
// strength wander on slow noise); the cloth and every shadow are MULTIPLIED onto it, so overlapping hides darken
// each other as they do on a real screen. Each puppet is drawn as a dense silhouette in its own layer and then
// pierced with `destination-out` tracery (rows of holes, dashes, chevrons, florets), so the lamp shows through.
// The pelican is cut again every frame into a small buffer: Rig.parts for the silhouette, baked tracery masks stamped
// through the rigid groups (body, head) with the pose matrices, wheels as pierced sprites turned in 40° clicks.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import * as Beat from '../beat/index.js';
import { TITLES } from './titles.js';

const TAU = Math.PI * 2, D = Math.PI / 180;
const RY = K.ROAD_Y, RES = 1.25;
const RANK = '#6a3f22'; // hide held a finger's width off the cloth (multiplied: a dense warm brown)
const DARK = '#1c0d06'; // the pelican, pressed flat against the cloth
const ROD = '#2b1509'; // horn rods
const TOP_H = 108; // lower hem of the upper border cloth
const TRUNK_Y = 872; // top of the banana trunk
const PLANT = 938; // how deep the rods are stuck into it
const KX = 912; // where the tree-of-life stands
const WSTEP = 40 * D, CSTEP = TAU / 6; // the wheels and the crank turn in clicks
const BUF = { w: 560, h: 410, ox: 280, oy: 360, res: 1.25 };
let L = null;

// ------------------------------------------------------------------------------------------- geometry helpers
/** fn(x, y, angle, i, n) at even spacing along a polyline (spacing adjusted so the row comes out whole) */
function walk(pts, gap, fn, closed = false) {
  const P = closed ? pts.concat([pts[0]]) : pts;
  if (P.length < 2) return;
  const Ls = K.arcLen(P), total = Ls[Ls.length - 1];
  if (total < 1e-6) return;
  const n = Math.max(1, Math.round(total / gap)), step = total / n;
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * step;
    while (j < Ls.length - 1 && Ls[j] < s) j++;
    const a = P[j - 1], b = P[j], seg = Ls[j] - Ls[j - 1] || 1, f = (s - Ls[j - 1]) / seg;
    fn(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0]), i, n);
  }
}
/** shift an open polyline sideways (d > 0: to the right of travel on screen) */
function offsetLine(pts, d) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    const dd = typeof d === 'function' ? d(i / (n - 1), i) : d;
    return [p[0] - (ty / m) * dd, p[1] + (tx / m) * dd];
  });
}
/** closed polygon moved inward by d */
function inward(pts, d) {
  const n = pts.length;
  let A = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
  const sg = A > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    return [p[0] - sg * (ty / m) * d, p[1] + sg * (tx / m) * d];
  });
}
const spiral = (cx, cy, r0, r1, a0, a1, n = 28) => Array.from({ length: n + 1 }, (_, i) => {
  const u = i / n, a = a0 + (a1 - a0) * u, r = r0 + (r1 - r0) * u;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
const inv = (m) => {
  const d = m[0] * m[3] - m[1] * m[2];
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
};
const ap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const mid = (a, b, f = 0.5) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
function at(c, x, y, k, dir, fn) { c.save(); c.translate(x, y); c.scale(k * dir, k); fn(); c.restore(); }

// ------------------------------------------------------------------------------------------- the cutter's tools
// ink = hide, cut = pierced through it. With mask = true the roles swap: the layer becomes a stencil of the cuts.
function tools(c, col, mask = false) {
  const T = { c, col };
  T.ink = () => { c.globalCompositeOperation = mask ? 'destination-out' : 'source-over'; c.fillStyle = T.col; c.strokeStyle = T.col; };
  T.cut = () => { c.globalCompositeOperation = mask ? 'source-over' : 'destination-out'; c.fillStyle = '#fff'; c.strokeStyle = '#fff'; };
  T.fill = (pts) => { T.ink(); K.path(c, pts, true); c.fill(); };
  T.cutPoly = (pts) => { T.cut(); K.path(c, pts, true); c.fill(); };
  /** a piece laid over what is already there: a dashed light line runs round it where it overlaps */
  T.keyed = (pts, moat = 1.3, dash = null) => {
    K.path(c, pts, true);
    c.lineJoin = 'round'; c.lineCap = 'butt';
    T.cut(); c.lineWidth = moat * 2;
    if (dash) c.setLineDash(dash);
    c.stroke(); c.setLineDash([]);
    T.ink(); c.fill();
  };
  T.kdisc = (x, y, r, moat = 1.3) => {
    c.beginPath(); c.arc(x, y, r, 0, TAU);
    T.cut(); c.lineWidth = moat * 2; c.stroke();
    T.ink(); c.fill();
  };
  T.line = (pts, w, moat = 0) => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    K.path(c, pts, false);
    if (moat) { T.cut(); c.lineWidth = w + moat * 2; c.stroke(); }
    T.ink(); c.lineWidth = w; c.stroke();
  };
  T.strip = (pts, w0, w1 = w0, pw = 1) => T.fill(K.ribbonPoly(pts, (u) => w1 + (w0 - w1) * Math.pow(1 - u, pw)));
  T.disc = (x, y, r) => { T.ink(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  T.hole = (x, y, r) => { T.cut(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  T.holes = (pts, gap, r, closed = false) => {
    T.cut(); c.beginPath();
    walk(pts, gap, (x, y, a, i, n) => { const rr = typeof r === 'function' ? r((i + 0.5) / n) : r; c.moveTo(x + rr, y); c.arc(x, y, rr, 0, TAU); }, closed);
    c.fill();
  };
  T.slit = (pts, w = 1.4, dash = null, closed = false) => {
    T.cut(); c.lineWidth = w; c.lineCap = dash ? 'butt' : 'round'; c.lineJoin = 'round';
    if (dash) c.setLineDash(dash);
    K.path(c, pts, closed); c.stroke(); c.setLineDash([]);
  };
  T.dashes = (pts, gap, len, w, ang = Math.PI / 2) => {
    T.cut(); c.lineWidth = w; c.lineCap = 'round'; c.beginPath();
    walk(pts, gap, (x, y, a) => { const dx = (Math.cos(a + ang) * len) / 2, dy = (Math.sin(a + ang) * len) / 2; c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); });
    c.stroke();
  };
  T.chev = (pts, gap, size, w = 1.3) => {
    T.cut(); c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'miter'; c.beginPath();
    walk(pts, gap, (x, y, a) => {
      const fx = Math.cos(a), fy = Math.sin(a);
      c.moveTo(x - fx * size * 0.5 - fy * size, y - fy * size * 0.5 + fx * size);
      c.lineTo(x + fx * size * 0.5, y + fy * size * 0.5);
      c.lineTo(x - fx * size * 0.5 + fy * size, y - fy * size * 0.5 - fx * size);
    });
    c.stroke();
  };
  /** pointed oval centred on (x, y) */
  T.almond = (x, y, len, wid, ang = 0) => {
    T.cut(); c.save(); c.translate(x, y); c.rotate(ang); c.beginPath();
    c.moveTo(-len / 2, 0); c.quadraticCurveTo(0, -wid, len / 2, 0); c.quadraticCurveTo(0, wid, -len / 2, 0);
    c.fill(); c.restore();
  };
  /** leaf: round at (x, y), pointed at distance len along ang */
  T.tear = (x, y, len, wid, ang = 0) => {
    const r = wid * 0.45;
    T.cut(); c.save(); c.translate(x, y); c.rotate(ang); c.beginPath();
    c.moveTo(len, 0); c.quadraticCurveTo(len * 0.45, -wid * 0.9, 0, -r); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, true); c.quadraticCurveTo(len * 0.45, wid * 0.9, len, 0);
    c.fill(); c.restore();
  };
  T.floret = (x, y, r, rot = 0, n = 4) => {
    for (let i = 0; i < n; i++) { const a = rot + (i / n) * TAU; T.almond(x + Math.cos(a) * r * 0.63, y + Math.sin(a) * r * 0.63, r * 0.74, r * (n > 4 ? 0.2 : 0.3), a); }
    T.hole(x, y, r * 0.14);
  };
  /** tracery inside a shape, with a solid rim left standing */
  T.region = (pts, margin, fn) => {
    c.save(); K.path(c, pts, true); c.clip();
    fn();
    T.ink(); K.path(c, pts, true); c.lineJoin = 'round'; c.lineWidth = margin * 2; c.stroke();
    c.restore();
  };
  T.contour = (pts, d, gap, r) => T.holes(inward(pts, d), gap, r, true);
  return T;
}

/** cloth patterns for skirts and sarongs (clipped by the caller) */
function pattern(T, kind, x0, y0, x1, y1) {
  const c = T.c;
  if (kind === 'floret') {
    let j = 0;
    for (let y = y0 + 6; y <= y1 + 8; y += 13.5, j++) for (let x = x0 + (j % 2 ? 8 : 0); x <= x1 + 8; x += 16) { T.floret(x, y, 5.7, Math.PI / 4); T.hole(x + 8, y, 1.2); }
  } else if (kind === 'chev') {
    T.cut(); c.lineWidth = 1.4; c.lineJoin = 'miter'; c.lineCap = 'butt';
    let j = 0;
    for (let y = y0 + 4; y <= y1 + 8; y += 8.2, j++) {
      c.beginPath();
      if (j % 2) { for (let x = x0; x <= x1 + 8; x += 8) { c.moveTo(x + 1.25, y); c.arc(x, y, 1.25, 0, TAU); } c.fill(); }
      else { for (let x = x0, i = 0; x <= x1 + 6; x += 5, i++) c[i ? 'lineTo' : 'moveTo'](x, y + (i % 2 ? -3 : 3)); c.stroke(); }
    }
  } else if (kind === 'scale') {
    T.cut(); c.lineWidth = 1.35; c.lineCap = 'round';
    let j = 0;
    for (let y = y0 + 2; y <= y1 + 8; y += 7.8, j++) {
      c.beginPath();
      for (let x = x0 + (j % 2 ? 5.8 : 0); x <= x1 + 8; x += 11.6) { c.moveTo(x + 5.1, y); c.arc(x, y, 5.1, 0, Math.PI); }
      c.stroke();
      c.beginPath();
      for (let x = x0 + (j % 2 ? 5.8 : 0); x <= x1 + 8; x += 11.6) { c.moveTo(x + 1, y + 2.2); c.arc(x, y + 2.2, 1, 0, TAU); }
      c.fill();
    }
  } else if (kind === 'lozenge') {
    const H = Math.ceil((y1 - y0) / 12) * 12, bx = x0 - H;
    T.cut(); c.lineWidth = 1.3; c.lineCap = 'butt'; c.setLineDash([5.5, 2.6]);
    c.beginPath();
    for (let d = bx; d <= x1 + H; d += 12) { c.moveTo(d, y0); c.lineTo(d + H, y0 + H); c.moveTo(d + H, y0); c.lineTo(d, y0 + H); }
    c.stroke(); c.setLineDash([]);
    c.beginPath();
    for (let m = 0; m * 6 <= H; m++) for (let x = bx + (m % 2 ? 0 : 6); x <= x1 + H; x += 12) { c.moveTo(x + 1.15, y0 + m * 6); c.arc(x, y0 + m * 6, 1.15, 0, TAU); }
    c.fill();
  } else if (kind === 'stripe') {
    T.cut(); c.lineWidth = 1.5; c.lineCap = 'butt'; c.setLineDash([7, 3]); c.beginPath();
    for (let x = x0 + 3; x <= x1; x += 6.5) { c.moveTo(x, y0); c.lineTo(x, y1); }
    c.stroke(); c.setLineDash([]);
  }
}

// ------------------------------------------------------------------------------------------- limbs on rods
const HAND = [[-2, -3.4], [9, -5.8], [21, -4.2], [35, -2.4], [36, -0.6], [22, 0.8], [23, 4.2], [18, 8.8], [9.5, 9.8], [4, 6.2], [-2, 3.4]];
/** a jointed arm: shoulder S, upper arm at a1, forearm at a2 (radians, 0 = forward, + = down) */
function limb(T, S, a1, a2, o = {}) {
  const c = T.c, U = o.U ?? 74, F = o.F ?? 78, w = o.w ?? 1;
  const E = [S[0] + Math.cos(a1) * U, S[1] + Math.sin(a1) * U], H = [E[0] + Math.cos(a2) * F, E[1] + Math.sin(a2) * F];
  T.fill(K.ribbonPoly([S, E], (u) => (9.8 - 2.6 * u) * w));
  T.fill(K.ribbonPoly([E, H], (u) => (7.6 - 2.4 * u) * w));
  T.disc(S[0], S[1], 6.8 * w); T.disc(E[0], E[1], 5.8 * w);
  c.save(); c.translate(S[0] + (E[0] - S[0]) * 0.44, S[1] + (E[1] - S[1]) * 0.44); c.rotate(a1); c.scale(w, w); // armband
  T.fill([[-7, -5], [-9.5, -12.5], [-3.5, -8.5], [0, -15], [3.5, -8.5], [9.5, -12.5], [7, -5], [7, 5.2], [-7, 5.2]]);
  T.hole(0, 0, 1.9); T.hole(0, -8.6, 1.2);
  c.restore();
  const B = mid(E, H, 0.86); // bracelet
  T.disc(B[0], B[1], 5.4 * w); T.hole(B[0], B[1], 1.7 * w);
  c.save(); c.translate(H[0], H[1]); c.rotate(a2); c.scale(w, w); T.fill(HAND); c.restore();
  T.hole(S[0], S[1], 1.8); T.hole(E[0], E[1], 1.6); // the rivets
  return { E, H, grip: [H[0] + Math.cos(a2) * 9 * w, H[1] + Math.sin(a2) * 9 * w] };
}

// ------------------------------------------------------------------------------------------- the nobles
const DIADEM = [[[-7, -346], [-5, -374], [4, -349]], [[4, -348], [9, -367], [14, -348]], [[13, -347], [21, -362], [25, -342]]];
function noble(T, o = {}) {
  const c = T.c;
  // behind everything: the flame-edged back ornament and the sash ends
  if (o.praba) {
    const pr = K.catmull([[-30, -238], [-56, -262], [-82, -300], [-97, -344], [-93, -380], [-76, -354], [-58, -326], [-44, -306], [-30, -288]], 6, true);
    const outer = K.catmull([[-40, -246], [-58, -262], [-84, -300], [-99, -344], [-95, -378]], 6);
    T.fill(pr);
    walk(outer, 13, (x, y, a) => { c.save(); c.translate(x, y); c.rotate(a); T.fill([[-6, 2], [1, -9], [9, -11], [5, -3], [6, 2]]); c.restore(); });
    for (let i = 0; i < 6; i++) {
      const p = K.pointAt(outer, 0.1 + i * 0.155), q = [-37 - i * 1.5, -266 - i * 7];
      T.slit([mid(q, p, 0.3), mid(q, p, 0.84)], 1.7);
    }
    T.contour(pr, 4.4, 6.5, 1.35);
  }
  const t1 = K.catmull([[-52, -116], [-70, -86], [-84, -52], [-99, -28], [-108, -34]], 5), t2 = K.catmull([[-40, -106], [-52, -72], [-59, -42], [-70, -18], [-78, -22]], 5);
  T.strip(t1, 17, 3); T.strip(t2, 14, 3);
  T.holes(t1.slice(1, 14), 7.5, 1.7); T.holes(t2.slice(1, 13), 7.5, 1.5);
  // legs and feet, both in profile
  T.fill([[-25, -96], [-11, -96], [-12, -34], [-10, -14], [6, -8], [14, -3], [13, 0], [-31, 0], [-32, -7], [-25, -14], [-24, -40]]);
  T.fill([[7, -92], [21, -92], [23, -36], [26, -14], [44, -8], [52, -3], [51, 0], [7, 0], [6, -7], [12, -14], [11, -40]]);
  T.disc(-18, -17, 6.4); T.disc(18.5, -17, 6.4); T.hole(-18, -17, 2); T.hole(18.5, -17, 2);
  T.dashes([[-18, -30], [-18, -80]], 9, 6, 1.4); T.dashes([[16, -30], [16, -80]], 9, 6, 1.4);
  // the wrapped skirt with its bustle
  const SK = K.catmull([[17, -200], [25, -172], [31, -132], [33, -90], [4, -84], [-27, -88], [-45, -102], [-73, -121], [-91, -151], [-87, -181], [-67, -201], [-41, -207], [-21, -202]], 6, true);
  T.fill(SK);
  T.region(SK, 10.5, () => {
    pattern(T, o.skirt || 'floret', -98, -212, 38, -80);
    const fold = K.catmull([[-18, -206], [-30, -170], [-32, -130], [-24, -86]], 6);
    T.ink(); c.lineWidth = 8.5; c.lineCap = 'butt'; K.path(c, fold); c.stroke();
    T.slit(fold, 1.5, [6, 3]);
  });
  T.contour(SK, 5.4, 6.2, 1.45);
  // torso: necklaces and a pendant
  const TO = K.catmull([[-22, -204], [18, -204], [25, -226], [33, -252], [45, -268], [42, -281], [18, -286], [-8, -286], [-40, -284], [-51, -272], [-41, -248], [-27, -224]], 6, true);
  T.fill(TO);
  T.holes(K.catmull([[-34, -277], [-14, -256], [3, -243], [20, -256], [36, -273]], 6), 6.4, 1.6);
  T.holes(K.catmull([[-24, -266], [-10, -248], [3, -234], [16, -248], [27, -262]], 6), 6, 1.15);
  T.almond(3, -224, 15, 4.6, 0); T.hole(3, -216, 1.6);
  // front sash and belt
  T.keyed([[9, -200], [23, -200], [36, -150], [44, -104], [50, -62], [42, -50], [35, -64], [30, -104], [24, -150]], 1.4, [6, 2.5]);
  T.chev(K.catmull([[17, -192], [29, -150], [37, -104], [42, -66]], 5), 9.5, 3.4, 1.3);
  T.keyed([[-25, -213], [20, -213], [22, -198], [-26, -198]], 1.3, [5, 2.5]);
  T.dashes([[-21, -205.5], [18, -205.5]], 5.2, 7.5, 1.5);
  T.disc(-2, -205.5, 8.5); T.floret(-2, -205.5, 6.4, Math.PI / 4);
  // neck and the downcast face with its long nose
  T.fill([[-5, -284], [13, -284], [17, -300], [19, -314], [3, -314], [-1, -298]]);
  T.slit([[1, -296], [14, -297]], 1.2); T.slit([[2, -303], [15, -304]], 1.2);
  T.fill([[-14, -330], [-6, -345], [12, -348], [26, -340], [50, -318], [35, -319.5], [33, -314], [29, -312.5], [30, -308], [24, -303], [8, -302], [-8, -310]]);
  if (o.head === 'crown') {
    T.fill(K.catmull([[-13, -339], [-30, -342], [-49, -357], [-59, -381], [-44, -368], [-30, -360], [-18, -354]], 5, true));
    T.slit([[-22, -347], [-46, -366]], 1.3); T.slit([[-20, -352], [-38, -360]], 1.2);
    T.fill([[-15, -334], [-18, -352], [-13, -356], [-14, -372], [-8, -376], [-8, -390], [-2, -394], [-1, -404], [4, -410], [9, -404], [10, -394], [16, -390], [17, -377], [23, -373], [23, -357], [28, -352], [25, -341], [12, -348], [-6, -345]]);
    T.disc(4, -415, 5.2); T.fill([[1, -418], [4, -434], [7, -418]]);
    T.slit([[-14, -354.5], [24, -354.5]], 1.3, [4, 2.5]); T.slit([[-10, -374.5], [19, -374.5]], 1.3, [4, 2.5]); T.slit([[-4, -392], [12, -392]], 1.3, [4, 2.5]);
    T.holes([[-10, -364.5], [19, -364.5]], 7, 1.7); T.holes([[-4, -383], [13, -383]], 6, 1.5); T.hole(4, -400, 1.6); T.hole(4, -415, 1.7);
    T.holes([[-10, -346.5], [20, -345]], 5.6, 1.25);
  } else if (o.head === 'bun') {
    T.fill([[-15, -329], [-8, -347], [12, -351], [26, -342], [12, -347], [-4, -345]]);
    T.fill(K.catmull([[-10, -351], [-30, -359], [-50, -349], [-56, -330], [-45, -315], [-26, -313], [-10, -320]], 6, true));
    T.line([[-40, -350], [-62, -374]], 2.6); T.disc(-64, -376, 4.2); T.hole(-64, -376, 1.5);
    for (const d of DIADEM) T.fill(d);
    T.slit(spiral(-32, -335, 15.5, 3, 0.6, 0.6 + TAU * 1.6, 34), 1.3);
    T.hole(-32, -335, 1.7);
    T.holes([[-4, -347], [22, -343.5]], 5.4, 1.3);
  } else {
    const sp = K.catmull([[-4, -331], [-28, -331], [-52, -343], [-65, -365], [-58, -388], [-39, -397], [-25, -386], [-28, -372], [-38, -373]], 6);
    const wf = (u) => (u < 0.3 ? 25 - 10 * u : u < 0.8 ? 22 - 22 * (u - 0.3) : 11 - 40 * (u - 0.8));
    T.fill(K.ribbonPoly(sp, wf));
    T.fill([[-15, -329], [-8, -347], [12, -351], [26, -342], [12, -347], [-4, -345]]);
    for (const d of DIADEM) T.fill(d);
    for (const f of [-0.27, 0.02, 0.29]) T.slit(offsetLine(sp, (u) => f * wf(u)).slice(4, -9), 1.15);
    T.holes([[-4, -347], [22, -343.5]], 5.4, 1.3);
  }
  T.almond(21, -330.5, 13.5, 2.5, 0.36); // the eye
  T.slit([[29.5, -311.5], [24.5, -310]], 1.1);
  T.strip([[-3, -322], [-7, -304], [-11, -287]], 4.2, 2); T.disc(-11.5, -284, 3.4); T.hole(-11.5, -284, 1.2); // ear tassel
  T.floret(-2, -327, 4.6, 0);
}

// ------------------------------------------------------------------------------------------- the servants
function clownRound(T) {
  const c = T.c;
  T.fill([[-30, 0], [-32, -8], [-21, -15], [-6, -10], [7, -4], [7, 0]]); T.fill([[5, 0], [3, -8], [14, -15], [30, -10], [45, -4], [45, 0]]);
  T.strip([[-15, -46], [-17, -10]], 15, 12); T.strip([[14, -46], [17, -10]], 15, 12);
  const BD = K.catmull([[-10, -36], [22, -40], [44, -62], [50, -92], [41, -120], [22, -138], [2, -144], [-22, -140], [-42, -123], [-54, -96], [-52, -66], [-36, -44]], 6, true);
  T.fill(BD);
  c.save(); c.beginPath(); c.rect(-70, -86, 140, 90); c.clip();
  T.region(BD, 6.5, () => pattern(T, 'lozenge', -60, -90, 56, -34));
  c.restore();
  c.save(); K.path(c, BD, true); c.clip();
  T.ink(); c.lineWidth = 9; c.lineCap = 'butt'; K.path(c, [[-60, -88], [58, -88]]); c.stroke();
  T.dashes([[-50, -88], [48, -88]], 5.4, 5, 1.4);
  c.restore();
  T.hole(32, -104, 2.4);
  T.holes(K.catmull([[-32, -128], [0, -116], [34, -126]], 6), 6.4, 1.5);
  T.almond(1, -108, 12, 4, 0);
  T.fill(K.catmull([[-8, -138], [-19, -154], [-15, -173], [0, -184], [16, -184], [28, -175], [33, -162], [40, -158], [43, -151], [35, -146], [31, -140], [21, -133], [6, -133]], 5, true));
  T.fill([[-19, -168], [-11, -185], [7, -192], [23, -187], [30, -177], [11, -181], [-8, -177]]); // headcloth, knotted behind
  T.fill(K.catmull([[-17, -176], [-30, -188], [-40, -184], [-30, -177]], 4, true)); T.fill(K.catmull([[-17, -172], [-34, -172], [-40, -164], [-28, -166]], 4, true));
  T.holes([[-12, -180], [8, -187], [24, -182]], 6, 1.3);
  T.hole(17, -164, 4); T.disc(18, -163.6, 1.7);
  T.slit(K.catmull([[36, -144.5], [26, -141], [14, -143]], 4), 1.5);
  T.disc(-1, -147, 4.6); T.hole(-1, -147, 1.7);
}
function clownLanky(T) {
  T.fill([[-30, 0], [-32, -7], [-22, -13], [-8, -9], [4, -4], [4, 0]]); T.fill([[6, 0], [4, -7], [14, -13], [30, -9], [44, -4], [44, 0]]);
  T.strip([[-12, -72], [-15, -40], [-14, -10]], 9, 8); T.strip([[12, -72], [15, -40], [16, -10]], 9, 8);
  T.disc(-15, -40, 6.2); T.disc(15, -40, 6.2); T.hole(-15, -40, 1.6); T.hole(15, -40, 1.6);
  const BR = [[-26, -106], [28, -102], [30, -64], [4, -60], [0, -72], [-4, -60], [-28, -62]];
  T.fill(BR);
  T.region(BR, 4.5, () => pattern(T, 'stripe', -30, -106, 32, -60));
  T.fill(K.catmull([[-22, -100], [24, -98], [43, -113], [45, -135], [32, -153], [22, -170], [2, -179], [-20, -175], [-32, -159], [-33, -131], [-29, -111]], 6, true));
  T.hole(34, -126, 2.2);
  T.holes(K.catmull([[-24, -166], [-2, -152], [22, -160]], 6), 6, 1.4);
  T.almond(-2, -143, 11, 3.6, 0);
  T.keyed([[-30, -110], [30, -106], [31, -97], [-29, -100]], 1.3, [5, 2.5]); T.dashes([[-25, -104.5], [27, -101.5]], 5.4, 5.5, 1.4);
  T.fill([[-6, -176], [8, -176], [10, -190], [-6, -190]]);
  T.fill([[-10, -186], [-12, -200], [-4, -212], [12, -214], [24, -208], [35, -200], [28, -196], [30, -190], [39, -184], [34, -178], [27, -172], [23, -158], [15, -173], [0, -176]]);
  T.fill([[-13, -203], [-4, -214], [14, -217], [25, -210], [9, -237], [-9, -257], [-22, -263], [-18, -241], [-16, -221]]); // tall cap
  T.disc(-23, -264, 4.2);
  T.slit([[-11, -209], [22, -213]], 1.3, [4, 2.5]);
  T.holes([[-9, -222], [4, -234], [-12, -250]], 8, 1.5);
  T.hole(13, -201, 3.4); T.disc(14, -200.6, 1.5);
  T.slit([[31, -189], [20, -187.5]], 1.4);
  T.disc(-4, -190, 4.4); T.hole(-4, -190, 1.6);
}

// ------------------------------------------------------------------------------------------- the tree-of-life leaf
const KAYON_R = K.catmull([[34, 0], [38, -22], [52, -36], [56, -60], [78, -100], [90, -160], [88, -215], [76, -275], [56, -335], [34, -390], [14, -438], [0, -472]], 6);
const HW = [[0, 34], [22, 38], [36, 52], [60, 56], [100, 78], [160, 90], [215, 88], [275, 76], [335, 56], [390, 34], [438, 14], [472, 0]];
const hwAt = (h) => {
  for (let i = 1; i < HW.length; i++) if (h <= HW[i][0]) { const a = HW[i - 1], b = HW[i]; return a[1] + ((b[1] - a[1]) * (h - a[0])) / (b[0] - a[0]); }
  return 0;
};
function kayon(T) {
  const c = T.c;
  T.fill(KAYON_R.concat(KAYON_R.map(([x, y]) => [-x, y]).reverse().slice(1)));
  const both = (fn) => { fn(); c.save(); c.scale(-1, 1); fn(); c.restore(); };
  both(() => {
    // border: a row of holes, a dashed line inside it
    T.holes(offsetLine(KAYON_R, -6).filter((p) => -p[1] > 5 && -p[1] < 450), 7.4, 1.75);
    T.slit(offsetLine(KAYON_R, -12.5).filter((p) => -p[1] > 14 && -p[1] < 408), 1.35, [7, 4]);
    // the gate at the foot: steps, a door leaf, a pillar, the tiered roof
    for (let x = 4; x < 30; x += 8) T.cutPoly([[x - 3.2, -6], [x + 3.2, -6], [x, -13.5]]);
    T.slit([[4, -20], [25, -20], [25, -84], [4, -84]], 1.4, null, true);
    for (const h of [31, 45, 59, 73]) { T.floret(9.6, -h, 4.3, Math.PI / 4); T.floret(19.6, -h, 4.3, Math.PI / 4); }
    T.slit([[29.5, -16], [29.5, -86]], 1.5, [6, 3]);
    [[90, 31], [97, 24], [104, 17], [111, 10]].forEach(([h, w]) => T.slit([[2.5, -h], [w, -h]], 1.5));
    // the wing beside it
    for (let i = 0; i < 5; i++) T.tear(35 + i * 1.6, -58 - i * 9.5, 14 + i * 5, 5.4, (-28 - i * 12) * D);
    // the trunk, split by the rod
    for (let h = 158; h <= 342; h += 20) T.almond(6.2, -h, 15, 3.5, Math.PI / 2);
    // boughs: scrolls of light with leaves on their backs
    for (const h0 of [150, 202, 254, 306]) {
      const s = hwAt(h0 + 22) - 21, R0 = 0.28 * s, C = [0.58 * s + 2, -h0 - 20], N = 30, sc = Math.min(1, s / 58);
      const sp = [[6, -h0 + 3]];
      for (let i = 0; i <= N; i++) { const u = i / N, th = (135 - 405 * u) * D, r = R0 * (1 - 0.86 * u); sp.push([C[0] + Math.cos(th) * r, C[1] + Math.sin(th) * r]); }
      T.slit(sp, 1.9);
      for (let i = 4; i <= 17; i += 2) {
        const u = i / N, th = (135 - 405 * u) * D, r = R0 * (1 - 0.86 * u) + 3.4;
        T.tear(C[0] + Math.cos(th) * r, C[1] + Math.sin(th) * r, (10.5 - 3 * u) * sc, 4.8 * sc, th - 0.9);
      }
      T.hole(sp[sp.length - 1][0], sp[sp.length - 1][1], 2.3);
      T.floret(C[0] - R0 * 0.2, C[1] + R0 + 9, 4.2 * sc, 0); // a bud under each bough
    }
    for (const h of [352, 372, 392]) T.tear(5.5, -h, 15 - (h - 352) * 0.12, 5, -64 * D);
  });
  T.floret(0, -134, 11, Math.PI / 8, 8);
  T.floret(0, -424, 7.5, Math.PI / 6, 6); T.hole(0, -441, 1.8); T.hole(0, -450, 1.3);
}

// ------------------------------------------------------------------------------------------- the cast
const ARMS = {
  noble: { S: [41, -273], rear: { S: [-44, -273], a: [108, 82] }, rest: [80, 97], over: [-38, -34], point: [-20, -6], U: 74, F: 78, w: 1, rodX: 3, rodTop: -324 },
  round: { S: [27, -126], rear: { S: [-30, -128], a: [112, 62] }, rest: [72, 104], over: [-76, -88], point: [-58, -70], U: 42, F: 42, w: 1.15, rodX: 0, rodTop: -150 },
  lanky: { S: [22, -164], rear: { S: [-24, -160], a: [104, 84] }, rest: [76, 100], over: [-86, -94], point: [-70, -80], U: 46, F: 48, w: 0.95, rodX: 0, rodTop: -200 },
};
const DRAW = { noble, round: clownRound, lanky: clownLanky };
const FIGS = [
  { kind: 'noble', x: 52, k: 1.0, dir: 1, o: { head: 'crown', praba: true, skirt: 'lozenge' }, up: 2.0, down: 5.0 },
  { kind: 'noble', x: 137, k: 0.9, dir: 1, o: { head: 'curl', skirt: 'chev' }, up: 2.0, down: 5.0 },
  { kind: 'noble', x: 216, k: 0.82, dir: 1, o: { head: 'bun', skirt: 'floret' }, up: 2.0, down: 5.0 },
  { kind: 'noble', x: 812, k: 0.9, dir: -1, o: { head: 'curl', skirt: 'scale' }, up: 2.0, pass: 125 },
  { kind: 'lanky', x: 744, k: 0.9, dir: -1, o: {}, up: 2.5, pass: 125 },
  { kind: 'round', x: 680, k: 1.0, dir: -1, o: {}, up: 2.25, pass: 125 },
];

function sprite(x0, y0, x1, y1, draw, blur = 0) {
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const w = Math.ceil(x1 - x0), h = Math.ceil(y1 - y0);
  let img = K.layer(w, h, RES, (c) => { c.translate(-x0, -y0); draw(c); });
  if (blur) { const src = img; img = K.layer(w, h, RES, (c) => { c.filter = `blur(${blur}px)`; c.drawImage(src, 0, 0, w, h); }); }
  return { img, x: x0, y: y0, w, h };
}
function buildFigure(f) {
  const { x, k, dir } = f, A = ARMS[f.kind], tip = (PLANT - RY) / k;
  const X0 = dir > 0 ? x - 128 * k : x - 84 * k, X1 = dir > 0 ? x + 84 * k : x + 128 * k;
  const pic = (p) => [x + dir * k * p[0], RY + k * p[1]];
  const body = sprite(X0, RY - 446 * k, X1, 956, (c) => at(c, x, RY, k, dir, () => {
    const T = tools(c, RANK);
    DRAW[f.kind](T, f.o);
    T.col = ROD; // the spine rod shows through the piercing and runs on down into the trunk
    T.line([[A.rodX, A.rodTop], [A.rodX, tip]], 3.2 / k);
    T.fill([[A.rodX - 1.6 / k, tip], [A.rodX + 1.6 / k, tip], [A.rodX, tip + 12 / k]]);
  }));
  const rear = sprite(X0, RY - 446 * k, X1, 956, (c) => at(c, x, RY, k, dir, () => {
    const T = tools(c, RANK);
    const r = limb(T, A.rear.S, A.rear.a[0] * D, A.rear.a[1] * D, A);
    T.col = ROD; T.line([r.grip, [r.grip[0] + 4, tip - 8]], 2.5 / k);
  }));
  let handX = x;
  const arms = ['rest', 'over', 'point'].map((st) => {
    const a1 = A[st][0] * D, a2 = A[st][1] * D, S = A.S;
    const E = [S[0] + Math.cos(a1) * A.U, S[1] + Math.sin(a1) * A.U], H = [E[0] + Math.cos(a2) * A.F, E[1] + Math.sin(a2) * A.F];
    const far = [H[0] + Math.cos(a2) * 42, H[1] + Math.sin(a2) * 42], rx = st === 'rest' ? H[0] - 3 : S[0] + (H[0] - S[0]) * 0.5;
    const P = [S, E, H, far, [rx, tip]].map(pic);
    if (st === 'point') handX = pic(H)[0];
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    return sprite(Math.min(...xs) - 20, Math.min(...ys) - 20, Math.max(...xs) + 20, Math.max(...ys) + 8, (c) => at(c, x, RY, k, dir, () => {
      const T = tools(c, RANK);
      const r = limb(T, S, a1, a2, A);
      T.col = ROD; T.line([r.grip, [rx, tip - 4]], 2.5 / k);
    }), 0.5);
  });
  return { ...f, body, rear, arms, handX };
}
function armState(f, tq, lx) {
  if (tq < f.up - 1e-6) return 0;
  if (f.pass != null ? lx > f.handX - f.pass : tq >= f.down - 1e-6) return 0;
  return tq < f.up + 0.1 - 1e-6 ? 1 : 2;
}

// ------------------------------------------------------------------------------------------- the screen
function topBand(c) {
  c.beginPath(); c.moveTo(0, 0); c.lineTo(1000, 0); c.lineTo(1000, TOP_H);
  for (let x = 1000; x > 0; x -= 50) { c.quadraticCurveTo(x - 7, TOP_H + 15, x - 25, TOP_H + 18); c.quadraticCurveTo(x - 43, TOP_H + 15, x - 50, TOP_H); }
  c.closePath();
}
/** how much lamp the cloth lets through, and in what colour */
function buildCloth() {
  return K.layer(1000, 1000, RES, (c) => {
    const r = K.rng(77);
    c.fillStyle = '#fbf3e4'; c.fillRect(0, 0, 1000, 1000);
    c.drawImage(K.noiseLayer({ scale: 230, oct: 4, seed: 1003, color: '#a06a30', lo: 0.42, hi: 0.9, alpha: 0.2, res: 0.25 }), 0, 0, 1000, 1000);
    c.drawImage(K.noiseLayer({ scale: 60, oct: 3, seed: 1004, color: '#ffffff', lo: 0.5, hi: 0.9, alpha: 0.25, res: 0.25 }), 0, 0, 1000, 1000);
    // slack folds and the seam where two widths of cotton are joined
    for (const [x, w, a] of [[178, 60, 0.08], [415, 90, 0.05], [652, 50, 0.085], [858, 70, 0.07]]) {
      const g = c.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(70,35,10,0)'); g.addColorStop(0.45, `rgba(70,35,10,${a})`); g.addColorStop(0.6, 'rgba(255,250,235,0.1)'); g.addColorStop(1, 'rgba(70,35,10,0)');
      c.fillStyle = g; c.fillRect(x - w, 0, 2 * w, RY);
    }
    c.strokeStyle = 'rgba(80,40,12,0.24)'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(0, 268); c.lineTo(1000, 266.5); c.stroke();
    c.setLineDash([5, 4]); c.strokeStyle = 'rgba(80,40,12,0.2)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 271.5); c.lineTo(1000, 270); c.stroke(); c.setLineDash([]);
    // the upper border cloth with its scalloped hem and tassels
    topBand(c); c.fillStyle = '#56190f'; c.fill();
    c.save(); topBand(c); c.clip();
    c.strokeStyle = 'rgba(38,9,4,0.4)'; c.lineWidth = 1.5; c.beginPath();
    for (let d = -140; d < 1000; d += 18) { c.moveTo(d, 0); c.lineTo(d + 130, 130); c.moveTo(d + 130, 0); c.lineTo(d, 130); }
    c.stroke(); c.restore();
    c.fillStyle = '#3a130a'; c.strokeStyle = '#3a130a'; c.lineWidth = 1.4;
    for (let x = 25; x < 1000; x += 50) {
      c.beginPath(); c.moveTo(x, TOP_H + 17); c.lineTo(x, TOP_H + 24); c.stroke();
      c.beginPath(); c.ellipse(x, TOP_H + 28, 2.5, 4.6, 0, 0, TAU); c.fill();
    }
    // the lower border cloth
    c.fillStyle = '#a03a1c'; c.fillRect(0, RY, 1000, TRUNK_Y - RY);
    c.save(); c.beginPath(); c.rect(0, RY, 1000, TRUNK_Y - RY); c.clip();
    c.strokeStyle = 'rgba(46,11,5,0.26)'; c.lineWidth = 5;
    for (let x = -90; x < 1000; x += 22) { c.beginPath(); c.moveTo(x, TRUNK_Y); c.lineTo(x + 72, RY); c.stroke(); }
    c.restore();
    // the banana trunk
    const tg = c.createLinearGradient(0, TRUNK_Y, 0, 1000);
    tg.addColorStop(0, '#efe6a6'); tg.addColorStop(0.2, '#ddd28a'); tg.addColorStop(1, '#b9ae6a');
    c.fillStyle = tg; c.fillRect(0, TRUNK_Y, 1000, 1000 - TRUNK_Y);
    c.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const y = TRUNK_Y + 4 + r() * 122, x = r() * 1000 - 100, len = r.range(90, 460), light = r() < 0.4;
      c.strokeStyle = light ? `rgba(255,250,200,${r.range(0.12, 0.3)})` : `rgba(70,60,20,${r.range(0.12, 0.3)})`;
      c.lineWidth = r.range(0.6, 2);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len / 2, y + r.range(-3, 3), x + len, y + r.range(-2, 2)); c.stroke();
    }
    for (const x of [64, 318, 548, 806]) {
      c.strokeStyle = 'rgba(70,60,20,0.38)'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(x, TRUNK_Y); c.quadraticCurveTo(x + 30, TRUNK_Y + 70, x + 150, 1000); c.stroke();
      c.strokeStyle = 'rgba(255,250,205,0.3)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x + 4, TRUNK_Y); c.quadraticCurveTo(x + 34, TRUNK_Y + 70, x + 154, 1000); c.stroke();
    }
    c.fillStyle = 'rgba(30,22,6,0.55)'; c.fillRect(0, TRUNK_Y, 1000, 2.2);
    // slubs and threads of the weave, over everything
    c.drawImage(K.noiseLayer({ scale: 34, oct: 3, seed: 1001, color: '#7a4a1e', lo: 0.5, hi: 0.95, alpha: 0.13, res: 0.6, stretch: [0.1, 2.4] }), 0, 0, 1000, 1000);
    c.drawImage(K.noiseLayer({ scale: 34, oct: 3, seed: 1002, color: '#7a4a1e', lo: 0.52, hi: 0.95, alpha: 0.11, res: 0.6, stretch: [2.4, 0.1] }), 0, 0, 1000, 1000);
    c.lineWidth = 0.7; c.lineCap = 'butt';
    for (let x = 1.3; x < 1000; x += 2.6) { c.strokeStyle = `rgba(90,52,20,${0.05 + 0.08 * r()})`; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + r.range(-0.7, 0.7), 1000); c.stroke(); }
    for (let y = 1.3; y < 1000; y += 2.6) { c.strokeStyle = `rgba(90,52,20,${0.05 + 0.08 * r()})`; c.beginPath(); c.moveTo(0, y); c.lineTo(1000, y + r.range(-0.7, 0.7)); c.stroke(); }
    K.grain(c, 0, 0, 1000, 1000, { color: '#5a3414', alpha: 0.07, seed: 78, size: 1 / RES });
  });
}

/** the gilding: title cartouche and scrollwork on the upper border, a running band on the lower one */
function buildGold(title) {
  const mask = K.layer(1000, 1000, RES, (c) => {
    c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineJoin = 'round';
    const dots = (y, gap, r, x0, x1) => { c.beginPath(); for (let x = x0 + gap / 2; x < x1; x += gap) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } c.fill(); };
    const petal = (x, y, a, r0, len, wid) => {
      c.save(); c.translate(x, y); c.rotate(a); c.beginPath();
      c.moveTo(r0, 0); c.quadraticCurveTo(r0 + len * 0.5, -wid, r0 + len, 0); c.quadraticCurveTo(r0 + len * 0.5, wid, r0, 0);
      c.fill(); c.restore();
    };
    const flower = (x, y, r, rot = 0) => {
      for (let i = 0; i < 8; i++) petal(x, y, rot + (i / 8) * TAU, r * 0.2, i % 2 ? r * 0.5 : r * 0.8, i % 2 ? r * 0.16 : r * 0.27);
      c.beginPath(); c.arc(x, y, r * 0.12, 0, TAU); c.fill();
    };
    const diamond = (x, y, r) => { c.beginPath(); c.moveTo(x - r, y); c.lineTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.closePath(); c.fill(); };
    // --- upper border
    c.fillRect(0, 3, 1000, 2.2); c.fillRect(0, 102.5, 1000, 2.2);
    const flank = () => {
      dots(10.5, 9, 1.4, 14, 228); dots(96.5, 9, 1.4, 14, 228);
      c.lineWidth = 1.6; c.beginPath();
      for (let x = 17; x <= 227; x += 2.5) { const y = 54 + 14 * Math.sin(((x - 17) * Math.PI) / 35); x === 17 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.stroke();
      for (let i = 0; i < 6; i++) {
        const x = 34.5 + i * 35, up = i % 2, y = up ? 40 : 68, a = up ? -Math.PI / 2 : Math.PI / 2;
        petal(x, y, a - 0.6, 1, 11, 3.2); petal(x, y, a + 0.6, 1, 11, 3.2);
      }
      for (const x of [52, 122, 192]) flower(x, 54, 16.5, Math.PI / 8);
      for (const x of [87, 157]) diamond(x, 54, 6);
    };
    flank();
    c.save(); c.translate(1000, 0); c.scale(-1, 1); flank(); c.restore();
    const cart = (i) => {
      const y0 = 12 + i, y1 = 98 - i, ym = 55, xa = 270 + i * 0.6, xb = 730 - i * 0.6, ex = 238 + i * 1.6;
      c.beginPath(); c.moveTo(xa, y0); c.lineTo(xb, y0);
      c.bezierCurveTo(xb + 16, y0, xb + 14, ym - 14, 1000 - ex, ym); c.bezierCurveTo(xb + 14, ym + 14, xb + 16, y1, xb, y1);
      c.lineTo(xa, y1);
      c.bezierCurveTo(xa - 16, y1, xa - 14, ym + 14, ex, ym); c.bezierCurveTo(xa - 14, ym - 14, xa - 16, y0, xa, y0);
      c.closePath();
    };
    cart(0); c.lineWidth = 2.4; c.stroke();
    cart(4.2); c.lineWidth = 1; c.stroke();
    K.text(c, title.zh, 505, 41.5, { size: 46, font: K.FONT.cjkSerif, weight: 900, align: 'center', baseline: 'middle', color: '#fff', tracking: 10 });
    K.text(c, `${title.en}  ·  ${title.date}`, 500.8, 80.5, { size: 25.5, font: K.FONT.serif, weight: 700, align: 'center', baseline: 'middle', color: '#fff', tracking: 1.6 });
    // --- lower border: the road is its top edge
    c.fillRect(0, RY, 1000, 3.6);
    dots(RY + 9.5, 10, 1.5, 0, 1000);
    for (let x = 30; x < 1000; x += 60) {
      for (let i = 0; i < 4; i++) petal(x, RY + 36, Math.PI / 4 + (i / 4) * TAU, 2.6, 12.5, 4.4);
      for (let i = 0; i < 4; i++) petal(x, RY + 36, (i / 4) * TAU, 3, 6, 1.9);
      c.beginPath(); c.arc(x, RY + 36, 1.9, 0, TAU); c.fill();
      diamond(x + 30, RY + 36, 5.2);
      c.beginPath(); c.arc(x + 19.5, RY + 36, 1.4, 0, TAU); c.arc(x + 40.5, RY + 36, 1.4, 0, TAU); c.fill();
    }
    dots(RY + 61.5, 10, 1.5, 0, 1000);
    c.fillRect(0, RY + 66.5, 1000, 2.4);
  });
  const tint = (fn) => K.layer(1000, 1000, RES, (c) => { c.drawImage(mask, 0, 0, 1000, 1000); c.globalCompositeOperation = 'source-atop'; fn(c); });
  const gold = tint((c) => {
    const band = (y0, y1, stops) => { const g = c.createLinearGradient(0, y0, 0, y1); for (const [o, col] of stops) g.addColorStop(o, col); c.fillStyle = g; c.fillRect(0, y0, 1000, y1 - y0); };
    band(0, 16, [[0, '#f9dc8a'], [1, '#dba640']]);
    band(16, 66, [[0, '#fff3c2'], [0.45, '#f7d06c'], [1, '#d59a33']]);
    band(66, 140, [[0, '#fff0b8'], [0.3, '#f4cb64'], [1, '#d1932f']]);
    band(RY - 2, TRUNK_Y + 2, [[0, '#ffeeb0'], [0.5, '#efc158'], [1, '#c98a2b']]);
    c.drawImage(K.noiseLayer({ scale: 13, oct: 2, seed: 404, color: '#8a5514', lo: 0.55, hi: 0.95, alpha: 0.32, res: 0.5 }), 0, 0, 1000, 1000);
  });
  const dark = tint((c) => { c.fillStyle = '#1e0803'; c.fillRect(0, 0, 1000, 1000); });
  return K.layer(1000, 1000, RES, (c) => {
    c.globalAlpha = 0.75;
    for (const [dx, dy] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9], [1.3, 2]]) c.drawImage(dark, dx, dy, 1000, 1000);
    c.globalAlpha = 1;
    c.drawImage(gold, 0, 0, 1000, 1000);
  });
}

/** the puppeteer's fist round a rod (grip at the origin), out of focus because it is far from the cloth */
function buildHand() {
  const w = 200, h = 270, ox = 62, oy = 64;
  const sharp = K.layer(w, h, RES, (c) => {
    c.translate(ox, oy);
    const T = tools(c, '#3f2110');
    T.fill(K.ribbonPoly([[14, 26], [52, 96], [106, 204]], (u) => 44 + 18 * u));
    T.fill(K.catmull([[-22, -28], [-6, -35], [14, -33], [30, -22], [36, 0], [34, 26], [22, 40], [2, 44], [-14, 38], [-24, 24]], 6, true));
    for (const [x, y] of [[-24, -22], [-29.5, -4.5], [-28.5, 13.5], [-22, 31]]) T.disc(x, y, 10.2);
    for (const y of [-13, 4.5, 22]) T.slit([[-37, y], [-20, y + 0.5]], 2.2);
    T.ink(); c.save(); c.translate(-3, -39); c.rotate(-0.38); c.beginPath(); c.ellipse(0, 0, 21, 9.5, 0, 0, TAU); c.fill(); c.restore();
  });
  return { img: K.layer(w, h, RES, (c) => { c.filter = 'blur(1.3px)'; c.drawImage(sharp, 0, 0, w, h); }), w, h, ox, oy };
}

// ------------------------------------------------------------------------------------------- the pelican puppet
function buildWheel() {
  const S = 104;
  return K.layer(S, S, 2.6, (c) => {
    c.translate(S / 2, S / 2);
    const T = tools(c, DARK);
    T.ink(); c.lineWidth = 9.6; c.beginPath(); c.arc(0, 0, 45.2, 0, TAU); c.stroke();
    for (let i = 0; i < 3; i++) {
      c.save(); c.rotate((i / 3) * TAU);
      T.ink(); c.beginPath(); c.moveTo(5, 0); c.bezierCurveTo(14, -9.5, 30, -7, 42, -1.3); c.lineTo(42, 1.3); c.bezierCurveTo(30, 7, 14, 9.5, 5, 0); c.fill();
      T.hole(16, 0, 2.7); T.hole(24.5, 0, 3.1); T.hole(33, 0, 2.3);
      c.rotate(TAU / 6);
      T.line([[6, 0], [42, 0]], 3.2); T.disc(25, 0, 5.4); T.hole(25, 0, 2.1);
      c.restore();
    }
    T.disc(0, 0, 11.5);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.26; T.almond(Math.cos(a) * 6.6, Math.sin(a) * 6.6, 5.6, 1.9, a); }
    T.hole(0, 0, 1.9);
    for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; T.hole(Math.cos(a) * 45.2, Math.sin(a) * 45.2, 1.95); }
  });
}
/** stencils of the piercing on the rigid parts, in the rig's rest coordinates */
function buildCuts() {
  const R0 = Rig.rest();
  const iB = inv(R0.G.body);
  const loc = (pts) => pts.map((p) => ap(iB, p));
  const body = loc(R0.shapes.body), wing = loc(R0.shapes.wing), marks = R0.shapes.wingMarks.map(loc);
  const BB = { x: -130, y: -248, w: 156, h: 118 };
  const bodyImg = K.layer(BB.w, BB.h, 2.5, (c) => {
    c.translate(-BB.x, -BB.y);
    const T = tools(c, '#fff', true);
    T.contour(wing, 4.4, 6.2, 1.4);
    marks.forEach((m, i) => { // rows of feather tips, a row of holes under each
      const mm = K.resample(m, 2);
      T.cut(); c.lineWidth = 1.35; c.lineCap = 'round'; c.beginPath();
      walk(mm, 8.4, (x, y, a) => { c.moveTo(x + Math.cos(a - 1.45) * 3.8, y + Math.sin(a - 1.45) * 3.8); c.arc(x, y, 3.8, a - 1.45, a + 1.45); });
      c.stroke();
      if (i < 2) T.holes(offsetLine(mm, -6.6), 6.2, 1.3);
    });
    T.almond(-98.5, -186, 17, 2.6, Math.atan2(8, -18));
    const belly = K.catmull([[-86, -167], [-66, -159], [-46, -155], [-26, -158], [-9, -167]], 6);
    walk(belly, 7.7, (x, y, a, i) => (i % 2 ? T.hole(x, y, 1.15) : T.floret(x, y, 4.8, a + Math.PI / 4)));
    T.holes(inward(body, 4.3).slice(36, 61), 5.6, 1.3);
  });
  const bk = (u, v) => [24 + u * 0.98 + v * 0.199, -284 + u * 0.199 - v * 0.98];
  const HB = { x: 0, y: -312, w: 142, h: 66 };
  const headImg = K.layer(HB.w, HB.h, 2.5, (c) => {
    c.translate(-HB.x, -HB.y);
    const T = tools(c, '#fff', true);
    T.slit(spiral(24, -284, 11, 11, 105 * D, 250 * D, 18), 1.3);
    for (const a of [128, 162, 196, 230]) T.hole(24 + Math.cos(a * D) * 14, -284 + Math.sin(a * D) * 14, 1.05);
    T.slit([bk(20, 5), bk(56, 4.2), bk(88, 3)], 1.3, [9, 3]);
    T.hole(...bk(13, 5.4), 1.5);
  });
  return { body: { img: bodyImg, ...BB }, head: { img: headImg, ...HB } };
}
function stamp(b, m, G) {
  b.save();
  b.transform(G[0], G[1], G[2], G[3], G[4], G[5]);
  b.globalCompositeOperation = 'destination-out';
  b.drawImage(m.img, m.x, m.y, m.w, m.h);
  b.restore();
}
/** the pose as the puppet shows it: crank and wheels in clicks, the whole figure rocking a little in the hand */
function puppetPose(base, tq) {
  const q = { ...base.params };
  const g = K.smoothstep(40, 200, q.x) * (1 - K.smoothstep(800, 960, q.x));
  q.crank = Math.floor(q.crank / CSTEP + 1e-6) * CSTEP;
  q.wheel = Math.floor(q.wheel / WSTEP + 1e-6) * WSTEP;
  const jolt = tq >= 3 - 1e-6 ? Beat.hit(tq, 3.0, 7) : 0;
  q.rot = (q.rot || 0) + g * (0.016 * K.wobble(tq, 1.3, 71) + 0.011 * K.wobble(tq, 3.1, 72) - 0.045 * jolt);
  return Rig.solve(q);
}
function drawPuppet(b, pose) {
  const s = pose.s, T = tools(b, DARK), M = 1.15 * s, dash = [6 * s, 2.4 * s];
  const far = (a, c2) => Math.hypot(a[0] - c2[0], a[1] - c2[1]);
  for (const p of Rig.parts(pose)) {
    const n = p.name;
    if (p.kind === 'wheel') {
      const d = (104 * p.r) / 50;
      b.save(); b.globalCompositeOperation = 'source-over'; b.translate(p.c[0], p.c[1]); b.rotate(p.a);
      b.drawImage(L.wheel, -d / 2, -d / 2, d, d);
      b.restore();
    } else if (p.kind === 'disc') {
      T.kdisc(p.c[0], p.c[1], p.r, M);
      if (n === 'chainring') for (let i = 0; i < 6; i++) { const a = pose.crank + (i / 6) * TAU; T.hole(p.c[0] + Math.cos(a) * p.r * 0.6, p.c[1] + Math.sin(a) * p.r * 0.6, p.r * 0.16); }
      T.hole(p.c[0], p.c[1], Math.min(1.7 * s, p.r * 0.3));
    } else if (p.kind === 'line') {
      if (p.role === 'mark') { if (n === 'beakLine') T.slit(p.pts, 1.3 * s, [9 * s, 3 * s]); continue; }
      let w = p.w, moat = M;
      if (p.role === 'frame') w = Math.max(p.w * 1.2, 6.2 * s);
      else if (p.role === 'scarf') w = p.w * 0.95;
      else if (n.startsWith('crest')) w = 3.6 * s;
      else if (n.startsWith('chain')) { w = 2 * s; moat = 0; }
      T.line(p.pts, w, moat);
      if (p.role === 'frame') T.holes(p.pts, 7.4 * s, 1.15 * s);
      else if (p.role === 'leg') { const k = p.pts[1]; T.kdisc(k[0], k[1], 6.3 * s, M); T.hole(k[0], k[1], 1.6 * s); }
      else if (p.role === 'scarf') T.holes(p.pts, 9 * s, 1.5 * s);
      else if (n.startsWith('crest')) { const e = p.pts[p.pts.length - 1]; T.disc(e[0], e[1], 3.1 * s); T.hole(e[0], e[1], 1.1 * s); }
    } else if (p.kind === 'poly') {
      const P = p.pts, N = P.length;
      T.keyed(P, M, dash);
      if (p.role === 'tail') {
        const m = mid(P[0], P[8]);
        T.slit([mid(m, P[4], 0.2), mid(m, P[4], 0.78)], 1.3 * s);
      } else if (n === 'wing') stamp(b, L.cuts.body, pose.G.body);
      else if (n === 'neck') {
        const h = N / 2;
        for (let i = 3; i < h - 1; i += 2) { const c0 = mid(P[i], P[N - 1 - i]); T.hole(c0[0], c0[1], far(P[i], P[N - 1 - i]) * 0.115); }
        for (const f of [0.2, 0.8]) { const q = []; for (let i = 3; i < h - 1; i++) q.push(mid(P[i], P[N - 1 - i], f)); T.slit(q, 1.1 * s, [5 * s, 2.5 * s]); }
      } else if (n === 'arm') {
        const h = N / 2;
        for (let i = 2; i < h - 1; i++) { const c0 = mid(P[i], P[N - 1 - i]); T.hole(c0[0], c0[1], Math.max(1.1 * s, far(P[i], P[N - 1 - i]) * 0.1)); }
      } else if (n === 'pouch' && N >= 32) {
        for (let k = 1; k <= 6; k++) { // ribs of light down the pouch
          const tp = mid(P[0], P[8], k / 7), bp = P[Math.round(24.5 - 2.05 * k)];
          if (far(tp, bp) > 8 * s) T.slit([mid(tp, bp, 0.24), mid(tp, bp, 0.78)], 1.3 * s);
        }
      } else if (n === 'beakUpper') stamp(b, L.cuts.head, pose.G.head);
      else if (p.role === 'foot' && N >= 8) {
        const a = mid(P[1], P[7]), e = mid(P[3], P[5]);
        T.slit([mid(a, e, 0.45), mid(a, e, 0.86)], 1.2 * s);
      } else if (n === 'saddle' && N >= 6) {
        const a = mid(P[1], P[5]), e = mid(P[2], P[4]);
        T.hole(a[0], a[1], 1.3 * s); T.hole(e[0], e[1], 1.3 * s);
      }
    } else if (p.kind === 'eye') {
      if (p.lid < 0.5) { T.hole(p.c[0], p.c[1], p.r * 1.2); T.disc(p.pupil[0], p.pupil[1], p.pr * 1.05); }
      else T.slit([[p.c[0] - p.r, p.c[1]], [p.c[0] + p.r, p.c[1]]], 1.3 * s);
    }
  }
}

// ------------------------------------------------------------------------------------------- lamp and stage business
function lampAt(t) {
  const fan = Beat.hit(t, 2.0, 2.2); // the flourish of the big leaf fans the flame
  const slow = K.wobble(t, 0.55, 11), slow2 = K.wobble(t, 0.43, 12);
  const quick = K.wobble(t, 5.2, 13), quick2 = K.wobble(t, 9.7, 14);
  return {
    x: 500 + 15 * slow + (2.5 + 9 * fan) * quick2,
    y: 392 + 10 * slow2 + (2 + 6 * fan) * quick,
    b: 1 + 0.04 * K.wobble(t, 1.1, 15) + (0.03 + 0.07 * fan) * quick + 0.012 * quick2,
    off: [1.7 + 0.9 * slow + (0.5 + 2 * fan) * quick2, 1.3 + 0.7 * slow2 + (0.4 + 1.5 * fan) * quick],
  };
}
function drawLight(ctx, lp) {
  const R = 770 * (1 + 0.5 * (lp.b - 1));
  const g = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, R);
  g.addColorStop(0, '#fff3cf'); g.addColorStop(0.08, '#ffecb4'); g.addColorStop(0.22, '#ffd985'); g.addColorStop(0.4, '#f4b24f');
  g.addColorStop(0.57, '#cc7c2b'); g.addColorStop(0.76, '#84421a'); g.addColorStop(0.92, '#40200d'); g.addColorStop(1, '#2a1307');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1000);
  ctx.save(); // the flame itself, a bright smear through the cotton
  ctx.globalCompositeOperation = 'screen'; ctx.translate(lp.x, lp.y - 6); ctx.scale(1, 1.3);
  const h = ctx.createRadialGradient(0, 0, 0, 0, 0, 82);
  h.addColorStop(0, 'rgba(255,247,216,0.62)'); h.addColorStop(0.35, 'rgba(255,238,184,0.26)'); h.addColorStop(1, 'rgba(255,225,150,0)');
  ctx.fillStyle = h; ctx.fillRect(-90, -90, 180, 180);
  ctx.restore();
  const dim = K.clamp((1.05 - lp.b) * 0.9, 0, 0.2);
  if (dim > 0) { ctx.fillStyle = `rgba(20,8,2,${dim})`; ctx.fillRect(0, 0, 1000, 1000); }
}
/** the big leaf: plucked up on the downbeat of bar 2, twirled, shivered, planted again a little askew */
function kayonState(tq) {
  const tick = Math.round((tq - 2.0) * 10);
  if (tick < 0) return { lift: 0, rot: 0, sx: 1 };
  if (tick >= 14) return { lift: 0, rot: -0.08, sx: 1 };
  const alt = tick % 2 ? 1 : -1;
  if (tick < 7) return { lift: tick === 0 ? 34 : 62, rot: 0.035 * alt, sx: Math.cos((TAU * tick) / 7) };
  if (tick < 13) return { lift: 62, rot: alt * K.lerp(0.12, 0.03, (tick - 7) / 6), sx: 1 };
  return { lift: 26, rot: -0.08, sx: 1 };
}
function drawKayon(ctx, tq, lp) {
  const st = kayonState(tq), k = L.kayon, away = st.lift / 62;
  const one = (dx, dy, a) => {
    const sc = 1 + 0.045 * away;
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(KX + dx, RY - st.lift + dy); ctx.rotate(st.rot); ctx.scale(Math.max(0.1, Math.abs(st.sx)) * sc, sc);
    ctx.drawImage(k.img, k.x, k.y, k.w, k.h);
    ctx.restore();
  };
  one(0, 0, 1 - 0.16 * away);
  one(lp.off[0] * (1 + 2.2 * away), lp.off[1] * (1 + 2.2 * away), 0.3);
  if (away > 0) one(-lp.off[0] * 1.6, -lp.off[1] * 1.2, 0.2);
}
/** where the puppeteer's other hand takes the wing rod: up into view, a shove on the beat, away again */
function fistAt(tq, px) {
  if (tq < 2.5 - 1e-6 || tq >= 4.2 - 1e-6) return null;
  if (tq < 2.6 - 1e-6) return [px + 34, 982];
  if (tq < 3.0 - 1e-6) return [px + 31, 954];
  if (tq < 3.1 - 1e-6) return [px - 18, 902];
  if (tq < 4.0 - 1e-6) return [px - 14, 914];
  if (tq < 4.1 - 1e-6) return [px + 31, 956];
  return [px + 35, 986];
}

// ------------------------------------------------------------------------------------------- the scene
export default {
  id: 10, key: 'wayang', title: TITLES[10], heroT: 3.0,
  stutter: 10,
  // in briskly, dawdling through the middle of the screen while it is fussed over, then on
  profile: [[0, 0], [1.6, 0.4], [3.4, 0.49], [6, 1]],
  act(t, p) {
    p.bob = 1 - 0.8 * K.gate(t, 0.4, 5.6, 0.3); // hide does not breathe
    if (t >= 3.0 - 1e-6 && t < 4.0 - 1e-6) p.armTo = t < 3.1 - 1e-6 ? [-66, -296] : [-62, -290]; // the wing, shoved up on its rod
    p.neck = 0.2 * K.gate(t, 2.9, 4.3, 0.2);
  },

  async init() {
    const cloth = buildCloth();
    const figs = FIGS.map(buildFigure);
    const kayonSprite = (() => {
      const B = { x: -106, y: -482, w: 212, h: 630 };
      const img = K.layer(B.w, B.h, RES, (c) => {
        c.translate(-B.x, -B.y);
        const T = tools(c, RANK);
        kayon(T);
        T.col = ROD; T.line([[0, -446], [0, 128]], 3.4); T.fill([[-1.7, 128], [1.7, 128], [0, 141]]);
      });
      return { img: K.layer(B.w, B.h, RES, (c) => { c.filter = 'blur(0.5px)'; c.drawImage(img, 0, 0, B.w, B.h); }), ...B };
    })();
    // everything that never moves, as one map of shadow (white = none)
    const shadow = K.layer(1000, 1000, RES, (c) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, 1000, 1000);
      c.globalCompositeOperation = 'multiply';
      c.filter = 'blur(0.55px)';
      for (const f of figs) for (const s of [f.rear, f.body]) c.drawImage(s.img, s.x, s.y, s.w, s.h);
      c.filter = 'none';
      c.strokeStyle = ROD; c.fillStyle = ROD; c.lineWidth = 1.6; // the pegs that lace the cloth to the trunk
      for (let x = 25; x < 1000; x += 50) { c.fillRect(x - 2, TRUNK_Y - 3, 4, 19); c.beginPath(); c.arc(x, TRUNK_Y - 5, 4.5, Math.PI, TAU); c.stroke(); }
    });
    const base = K.layer(1000, 1000, RES, (c) => { c.drawImage(cloth, 0, 0, 1000, 1000); c.globalCompositeOperation = 'multiply'; c.drawImage(shadow, 0, 0, 1000, 1000); });
    const buf = K.makeCanvas(BUF.w * BUF.res, BUF.h * BUF.res);
    L = { base, shadow, figs, kayon: kayonSprite, gold: buildGold(TITLES[10]), hand: buildHand(), wheel: buildWheel(), cuts: buildCuts(), buf, bctx: buf.getContext('2d') };
  },

  render(ctx, t, env) {
    const tq = Beat.quantize(t, 10), lp = lampAt(t), [ox, oy] = lp.off, R = RES;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    drawLight(ctx, lp);
    // cloth and the standing puppets, then their doubled edge as the flame shifts
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(L.base, 0, 0, 1000, 1000);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(L.shadow, 0, 0, 400 * R, 1000 * R, ox, oy, 400, 1000);
    ctx.drawImage(L.shadow, 600 * R, 0, 400 * R, 1000 * R, 600 + ox, oy, 400, 1000);
    ctx.globalAlpha = 1;
    drawKayon(ctx, tq, lp);
    const lx = env.rider.lx;
    for (const f of L.figs) {
      const s = f.arms[armState(f, tq, lx)];
      ctx.drawImage(s.img, s.x, s.y, s.w, s.h);
      ctx.globalAlpha = 0.3; ctx.drawImage(s.img, s.x + ox, s.y + oy, s.w, s.h); ctx.globalAlpha = 1;
    }
    // the pelican, cut afresh
    if (env.pose) {
      const pose = puppetPose(env.pose, tq), b = L.bctx, bx = pose.x - BUF.ox, by = pose.y - BUF.oy;
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.setLineDash([]);
      b.clearRect(0, 0, L.buf.width, L.buf.height);
      b.setTransform(BUF.res, 0, 0, BUF.res, -bx * BUF.res, -by * BUF.res);
      drawPuppet(b, pose);
      ctx.drawImage(L.buf, bx, by, BUF.w, BUF.h);
      ctx.globalAlpha = 0.28; ctx.drawImage(L.buf, bx + ox, by + oy, BUF.w, BUF.h); ctx.globalAlpha = 1;
      // its rods: spine, bicycle, wing — gathered in a hand below the screen
      const P = pose.pt, hold = [pose.x - 4, pose.y + 300];
      const edge = (a, c2) => mid(a, c2, (1014 - a[1]) / (c2[1] - a[1]));
      const rod = (a, e, w) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(e[0], e[1]); ctx.lineWidth = w; ctx.stroke(); };
      ctx.strokeStyle = ROD; ctx.lineCap = 'butt';
      rod(P.shoulder, edge(P.shoulder, hold), 3.6);
      rod(P.hubR, edge(P.hubR, hold), 3);
      const fs = fistAt(tq, pose.x);
      if (fs) {
        const dx = fs[0] - P.hand[0], dy = fs[1] - P.hand[1], m = Math.hypot(dx, dy) || 1, h = L.hand;
        rod(P.hand, [fs[0] + (dx / m) * 60, fs[1] + (dy / m) * 60], 3);
        ctx.save(); ctx.translate(fs[0], fs[1]); ctx.rotate(Math.atan2(-dx, dy));
        ctx.scale(1.18, 1.18); ctx.drawImage(h.img, -h.ox, -h.oy, h.w, h.h);
        ctx.restore();
      } else rod(P.hand, edge(P.hand, hold), 3);
    }
    // gilding catches the light of the room, not of the lamp
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = K.clamp(0.93 + 0.5 * (lp.b - 1), 0.82, 1);
    ctx.drawImage(L.gold, 0, 0, 1000 * R, 132 * R, 0, 0, 1000, 132);
    ctx.drawImage(L.gold, 0, 796 * R, 1000 * R, 80 * R, 0, 796, 1000, 80);
    ctx.restore();
  },
};
