// Section 18 — Vaporwave (2010s)
// A dusk-pink vaporwave still: a striped sun half-sunk behind a glowing perspective grid that scrolls toward the
// viewer, low-poly palms, wireframe solids drifting in the haze, and an anonymous faceted marble bust on a dark
// pedestal whose head turns, one discrete step per beat, to follow the pelican. Everything is composited through a
// worn VHS transfer (scanlines, chroma bleed, tracking wobble, a soft bloom).
//
// The gag follows the score exactly (audio/vapor.js): for t in [2.5, 3.5) the tape repeats a quarter-second four
// times; the whole picture — pelican, grid, sun stripes, palms — is drawn at tape time tt and jerks back with a tear
// band, a channel split and a scanline jump on every repeat, then jumps ahead at 3.5. On entry (0–0.5) a slow-down
// smear; on exit (5.6–6) the picture tightens up as the tape comes back to speed.
//
// Technique: Canvas 2D only. Static artwork (sky, mountains, palms, pedestal, title, and the bust — a small
// procedural 3D mesh flat-shaded in two coloured lights, baked at five head angles) is built in init; each frame
// is drawn into an offscreen tape frame and then passed through the VHS treatment.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

let L = null;
const H0 = 600; // horizon
const VPX = 500; // vanishing point x (sun centre)
const SUN = { x: 500, y: 600, r: 190 };
const SKIP = { at: 2.5, len: 0.25, times: 4 };
const SKIP_END = SKIP.at + SKIP.len * SKIP.times; // 3.5
const TEAR_Y = [700, 300, 880, 560];

/** tape time: the picture's own clock, which repeats one quarter-second four times in bar 2 */
function tapeT(t) {
  if (t >= SKIP.at && t < SKIP_END) return SKIP.at + ((t - SKIP.at) % SKIP.len);
  return t;
}

const SKY = [[0, '#12052e'], [0.3, '#3b0f6a'], [0.58, '#9a2b8e'], [0.82, '#ff5f9e'], [1, '#ffb487']];
const skyGrad = (c) => K.linGrad(c, 0, 0, 0, H0, SKY);

// ------------------------------------------------------------------------------------------- the bust (3D mesh)
const v3 = (x, y, z) => [x, y, z];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const m = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / m, a[1] / m, a[2] / m];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const g2 = (x, w) => Math.exp(-(x / w) * (x / w));

/** a grid surface (rows × cols of vertices) → list of triangles [[p0,p1,p2], group] */
function gridTris(rows, cols, fn, wrap, group) {
  const V = [];
  for (let j = 0; j <= rows; j++) {
    const row = [];
    for (let i = 0; i <= cols; i++) row.push(fn(i / cols, j / rows));
    V.push(row);
  }
  const T = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = V[j][i], b = V[j][i + 1], c = V[j + 1][i + 1], d = V[j + 1][i];
      T.push({ p: [a, b, c], g: group });
      T.push({ p: [a, c, d], g: group });
    }
  }
  return T;
}

function headPoint(u, v) {
  // u: azimuth (0..1 → −π..π, denser at the front), v: polar 0 top … 1 bottom
  const uu = u * 2 - 1;
  const th = Math.PI * Math.sign(uu) * Math.pow(Math.abs(uu), 1.35);
  const ph = 0.02 + v * (Math.PI - 0.1);
  const front = Math.max(0, Math.cos(th));
  let rx = 0.84, rz = 0.96;
  if (Math.cos(th) < 0) {
    rx *= 1.04;
    rz *= 1.08;
  }
  const jaw = K.smoothstep(1.7, 2.6, ph);
  rx *= 1 - 0.3 * jaw;
  rz *= 1 - 0.12 * jaw * (1 - front);
  let x = Math.sin(ph) * Math.sin(th) * rx, y = -Math.cos(ph) * 1.2, z = Math.sin(ph) * Math.cos(th) * rz;
  // features as outward offsets
  const at = Math.abs(th);
  let d = 0;
  d += 0.3 * g2(th, 0.12) * K.smoothstep(1.45, 1.92, ph) * (1 - K.smoothstep(1.93, 2.02, ph)); // nose
  d += 0.09 * g2(ph - 1.42, 0.09) * g2(th, 0.62); // brow
  d -= 0.13 * g2(ph - 1.56, 0.1) * g2(at - 0.4, 0.14); // eye sockets
  d += 0.05 * g2(ph - 1.6, 0.05) * g2(at - 0.4, 0.09); // lids
  d += 0.07 * g2(ph - 2.12, 0.06) * g2(th, 0.28); // lips
  d -= 0.05 * g2(ph - 2.2, 0.03) * g2(th, 0.25); // mouth line
  d += 0.12 * g2(ph - 2.43, 0.12) * g2(th, 0.3); // chin
  d -= 0.06 * g2(ph - 1.85, 0.25) * g2(at - 0.75, 0.25); // cheek hollow
  d += 0.13 * g2(ph - 1.62, 0.18) * g2(at - Math.PI / 2, 0.15); // ears
  // hair: tight classical curls over the crown and the back
  const hair = (1 - K.smoothstep(1.2, 1.38, ph + 0.35 * front * front)) * (1 - K.smoothstep(2.0, 2.25, ph)) + (1 - front) * (1 - K.smoothstep(1.9, 2.3, ph)) * 0.9;
  if (hair > 0.02) d += Math.min(1, hair) * (0.08 + 0.06 * Math.sin(th * 11 + Math.sin(ph * 7)) * Math.sin(ph * 13 + th * 3));
  const n = norm([x, y * 0.8, z]);
  return v3(x + n[0] * d, y + n[1] * d, z + n[2] * d);
}

function bustTris() {
  let T = gridTris(26, 44, headPoint, true, 'head');
  // neck
  T = T.concat(gridTris(4, 18, (u, v) => {
    const a = u * K.TAU;
    const r = 0.46 + 0.06 * v;
    return v3(Math.sin(a) * r, 0.75 + v * 1.25, Math.cos(a) * r * 0.95 - 0.05);
  }, true, 'neck'));
  // chest and shoulders: the top of an ellipsoid, cut flat
  T = T.concat(gridTris(7, 30, (u, v) => {
    const a = u * K.TAU, b = v * Math.PI * 0.5;
    const r = Math.sin(b);
    const y = 3.0 - Math.cos(b) * 1.3;
    return v3(Math.sin(a) * r * 2.05, y + 0.12 * Math.cos(a * 2) * r, Math.cos(a) * r * 0.95);
  }, true, 'chest'));
  return T;
}

const LP = norm([-0.8, -0.35, 0.55]), LC = norm([0.9, -0.15, 0.45]), LK = norm([0.1, -1, 0.5]);
function renderBust(ctx, tris, yaw, scale) {
  const rotY = (p, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  };
  const rotX = (p, a, oy) => {
    const c = Math.cos(a), s = Math.sin(a), y = p[1] - oy;
    return [p[0], y * c - p[2] * s + oy, y * s + p[2] * c];
  };
  const list = [];
  for (const t of tris) {
    const a = t.g === 'head' ? yaw : t.g === 'neck' ? yaw * 0.6 : 0;
    const P = t.p.map((p) => {
      let q = rotY(p, a);
      if (t.g === 'head') q = rotX(q, 0.12, 0.9); // a slight look down to the road
      return q;
    });
    const n = norm(cross(sub(P[1], P[0]), sub(P[2], P[0])));
    if (n[2] <= 0.0) continue;
    list.push({ P, n, z: (P[0][2] + P[1][2] + P[2][2]) / 3, g: t.g });
  }
  list.sort((a, b) => a.z - b.z);
  ctx.lineJoin = 'round';
  for (const f of list) {
    const dp = Math.max(0, dot(f.n, LP)), dc = Math.max(0, dot(f.n, LC)), dk = Math.max(0, dot(f.n, LK));
    const h = K.hash1((f.P[0][0] * 131 + f.P[0][1] * 71 + f.P[0][2] * 17) | 0) * 10 - 5;
    const r = 58 + 225 * dp + 40 * dc + 50 * dk + h, g = 34 + 70 * dp + 175 * dc + 55 * dk + h, b = 96 + 150 * dp + 160 * dc + 50 * dk + h;
    const col = `rgb(${Math.min(255, r) | 0},${Math.min(255, g) | 0},${Math.min(255, b) | 0})`;
    ctx.beginPath();
    ctx.moveTo(f.P[0][0] * scale, f.P[0][1] * scale);
    ctx.lineTo(f.P[1][0] * scale, f.P[1][1] * scale);
    ctx.lineTo(f.P[2][0] * scale, f.P[2][1] * scale);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
}

const BUST = { x: 850, base: 580, scale: 54 };
const YAWS = [-0.85, -0.45, 0, 0.42, 0.8];

// ------------------------------------------------------------------------------------------- static layers
function buildSky() {
  return K.layer(1000, 1000, 1, (c) => {
    c.fillStyle = skyGrad(c);
    c.fillRect(0, 0, 1000, H0);
    // stars
    const r = K.rng(1801);
    for (let i = 0; i < 140; i++) {
      const x = r() * 1000, y = r() * 420, a = (1 - y / 460) * r.range(0.3, 0.9);
      c.fillStyle = `rgba(255,240,255,${a})`;
      c.fillRect(x, y, r() < 0.1 ? 2.4 : 1.4, r() < 0.1 ? 2.4 : 1.4);
    }
    // sun halo (bloom)
    c.fillStyle = K.radGrad(c, SUN.x, SUN.y - 60, 40, 520, [[0, 'rgba(255,170,150,0.55)'], [0.35, 'rgba(255,90,170,0.22)'], [1, 'rgba(255,60,170,0)']]);
    c.fillRect(0, 0, 1000, H0);
    // floor
    c.fillStyle = K.linGrad(c, 0, H0, 0, 1000, [[0, '#3a0d5a'], [0.25, '#1f0638'], [1, '#090118']]);
    c.fillRect(0, H0, 1000, 400);
  });
}

function buildSun() {
  return K.layer(400, 200, 1.5, (c) => {
    c.save();
    c.beginPath();
    c.arc(200, 200, SUN.r, Math.PI, 0);
    c.closePath();
    c.clip();
    c.fillStyle = K.linGrad(c, 0, 10, 0, 200, [[0, '#fff27a'], [0.45, '#ffab4f'], [0.8, '#ff5a8a'], [1, '#ff3fa4']]);
    c.fillRect(0, 0, 400, 200);
    c.restore();
  });
}

function buildMountains() {
  return K.layer(1000, 200, 1, (c) => {
    // c is in local y: 0..200 maps to picture 450..650
    const oy = 450;
    const ridge = (x0, x1, peaks, seed) => {
      const r = K.rng(seed), pts = [[x0, H0 - oy]];
      const n = peaks * 2;
      for (let i = 1; i < n; i++) {
        const x = K.lerp(x0, x1, i / n);
        const h = i % 2 ? r.range(55, 110) : r.range(15, 45);
        pts.push([x, H0 - oy - h]);
      }
      pts.push([x1, H0 - oy]);
      return pts;
    };
    for (const [x0, x1, pk, sd] of [[-40, 340, 3, 4], [660, 1040, 3, 9]]) {
      const pts = ridge(x0, x1, pk, sd);
      c.fillStyle = K.linGrad(c, 0, 80, 0, 150, [[0, '#3c0f63'], [1, '#1c0535']]);
      K.path(c, pts, true);
      c.fill();
      // facets: lines from each peak down to the base and between neighbours
      c.strokeStyle = 'rgba(255,90,220,0.75)';
      c.lineWidth = 1.3;
      K.path(c, pts, false);
      c.stroke();
      c.strokeStyle = 'rgba(120,230,255,0.4)';
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 1; i < pts.length - 1; i += 2) {
        c.moveTo(pts[i][0], pts[i][1]);
        c.lineTo(pts[i - 1][0] + (pts[i + 1][0] - pts[i - 1][0]) * 0.35, H0 - oy);
        c.moveTo(pts[i][0], pts[i][1]);
        c.lineTo(pts[i - 1][0] + (pts[i + 1][0] - pts[i - 1][0]) * 0.8, H0 - oy);
      }
      c.stroke();
    }
  });
}

function buildHaze() {
  return K.layer(1000, 260, 1, (c) => {
    // local 0..260 → picture 500..760
    c.fillStyle = K.linGrad(c, 0, 0, 0, 260, [[0, 'rgba(255,120,190,0)'], [0.38, 'rgba(255,130,190,0.42)'], [0.48, 'rgba(255,150,200,0.5)'], [0.7, 'rgba(160,60,200,0.18)'], [1, 'rgba(80,20,140,0)']]);
    c.fillRect(0, 0, 1000, 260);
  });
}

/** a low-poly palm, origin at its base (sprite coords: base at (200, 600)) */
function buildPalm(seed, h, lean) {
  return K.layer(400, 620, 1.5, (c) => {
    const r = K.rng(seed);
    const bx = 200, by = 600;
    // trunk: a gentle curve of faceted segments
    const N = 11, pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      pts.push([bx + lean * h * u * u, by - h * u]);
    }
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[i + 1], w0 = 11 - i * 0.45, w1 = 11 - (i + 1) * 0.45;
      const q = [[a[0] - w0, a[1]], [a[0] + w0, a[1]], [b[0] + w1, b[1] + 3], [b[0] - w1, b[1] + 3]];
      c.fillStyle = i % 2 ? '#5a1d63' : '#6e2774';
      K.path(c, q, true);
      c.fill();
      c.fillStyle = 'rgba(255,110,200,0.55)'; // pink light on the left
      K.path(c, [q[0], [a[0] - w0 * 0.2, a[1]], [b[0] - w1 * 0.2, b[1] + 3], q[3]], true);
      c.fill();
      c.fillStyle = 'rgba(30,6,40,0.4)';
      K.path(c, [[a[0] + w0 * 0.5, a[1]], q[1], q[2], [b[0] + w1 * 0.5, b[1] + 3]], true);
      c.fill();
    }
    const top = pts[N];
    // fronds: each a spine with alternating triangular facets
    const F = 9;
    for (let k = 0; k < F; k++) {
      const ang = -Math.PI + (k / (F - 1)) * Math.PI + r.range(-0.12, 0.12);
      const len = h * r.range(0.42, 0.55);
      const droop = r.range(0.5, 0.8);
      const spine = [];
      for (let i = 0; i <= 7; i++) {
        const u = i / 7;
        const x = top[0] + Math.cos(ang) * len * u;
        const y = top[1] + Math.sin(ang) * len * u * 0.55 + droop * len * u * u * 0.75 - 6;
        spine.push([x, y]);
      }
      for (let i = 0; i < 7; i++) {
        const a = spine[i], b = spine[i + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
        const nx = -dy / m, ny = dx / m, w = 16 * Math.sin(((i + 0.5) / 7) * Math.PI) + 3;
        const up = [(a[0] + b[0]) / 2 + nx * w, (a[1] + b[1]) / 2 + ny * w];
        const dn = [(a[0] + b[0]) / 2 - nx * w * 1.1, (a[1] + b[1]) / 2 - ny * w * 1.1 + 4];
        c.fillStyle = ny < 0 ? '#25d7c3' : '#14a3a6';
        K.path(c, [a, up, b], true);
        c.fill();
        c.fillStyle = ny < 0 ? '#0d6e86' : '#1bb8b4';
        K.path(c, [a, dn, b], true);
        c.fill();
      }
      c.strokeStyle = 'rgba(255,140,230,0.85)';
      c.lineWidth = 1.4;
      K.path(c, spine, false);
      c.stroke();
    }
    // coconuts
    for (let k = 0; k < 3; k++) {
      c.fillStyle = k === 1 ? '#3a0f4a' : '#4c1660';
      c.beginPath();
      c.arc(top[0] - 8 + k * 8, top[1] + 8 + (k % 2) * 4, 6, 0, K.TAU);
      c.fill();
    }
  });
}

function buildPedestal() {
  return K.layer(1000, 1000, 1, (c) => {
    const x0 = 795, x1 = 905, y0 = BUST.base + 4, y1 = 760, k = 0.09;
    const L0 = [x0 - k * (x0 - VPX), y0 - k * (y0 - H0)], L1 = [x0 - k * (x0 - VPX), y1 - k * (y1 - H0)];
    // floor reflection of the pedestal
    c.fillStyle = K.linGrad(c, 0, y1, 0, y1 + 110, [[0, 'rgba(40,200,220,0.25)'], [1, 'rgba(40,200,220,0)']]);
    c.fillRect(x0, y1, x1 - x0, 110);
    // left face, toward the vanishing point: lit pink
    c.fillStyle = K.linGrad(c, L0[0], 0, x0, 0, [[0, '#7a2a7c'], [1, '#a23a8e']]);
    K.path(c, [L0, [x0, y0], [x0, y1], L1], true);
    c.fill();
    // front face: dark teal marble with veins
    c.fillStyle = K.linGrad(c, x0, y0, x1, y1, [[0, '#1d5d6e'], [0.6, '#123a4e'], [1, '#0b2236']]);
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.save();
    c.beginPath();
    c.rect(x0, y0, x1 - x0, y1 - y0);
    c.clip();
    const r = K.rng(77);
    for (let i = 0; i < 7; i++) {
      let x = r.range(x0, x1), y = y0 - 10;
      c.beginPath();
      c.moveTo(x, y);
      while (y < y1 + 10) {
        x += r.range(-14, 18);
        y += r.range(10, 26);
        c.lineTo(x, y);
      }
      c.strokeStyle = `rgba(200,250,255,${r.range(0.12, 0.35)})`;
      c.lineWidth = r.range(0.6, 1.8);
      c.stroke();
    }
    c.restore();
    // mouldings
    c.fillStyle = '#2b7f8c';
    c.fillRect(x0 - 6, y0, x1 - x0 + 12, 10);
    c.fillRect(x0 - 6, y1 - 12, x1 - x0 + 12, 12);
    c.fillStyle = '#c0479a';
    c.fillRect(x0 - 6, y0, 6, 10);
    c.fillRect(x0 - 6, y1 - 12, 6, 12);
    // neon edges
    c.strokeStyle = 'rgba(110,245,255,0.9)';
    c.lineWidth = 1.5;
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.strokeStyle = 'rgba(255,120,220,0.8)';
    K.path(c, [L0, [x0, y0], [x0, y1], L1], true);
    c.stroke();
    // a small engraved plate (no words — just the lines of one)
    c.strokeStyle = 'rgba(160,240,255,0.5)';
    c.lineWidth = 1;
    c.strokeRect(x0 + 22, y0 + 60, x1 - x0 - 44, 26);
    c.fillStyle = 'rgba(160,240,255,0.35)';
    c.fillRect(x0 + 30, y0 + 69, x1 - x0 - 60, 2);
    c.fillRect(x0 + 38, y0 + 76, x1 - x0 - 76, 2);
    // socle under the bust
    c.fillStyle = K.linGrad(c, x0 + 15, 0, x1 - 15, 0, [[0, '#ff8fd8'], [0.5, '#e8d8f4'], [1, '#6fd8f0']]);
    c.beginPath();
    c.ellipse((x0 + x1) / 2, y0 + 1, 40, 7, 0, 0, K.TAU);
    c.fill();
    c.fillRect((x0 + x1) / 2 - 34, y0 - 14, 68, 15);
    c.fillStyle = K.linGrad(c, x0 + 15, 0, x1 - 15, 0, [[0, '#ffb0e6'], [0.5, '#fff0ff'], [1, '#8fe8ff']]);
    c.beginPath();
    c.ellipse((x0 + x1) / 2, y0 - 14, 34, 6, 0, 0, K.TAU);
    c.fill();
  });
}

function buildBusts() {
  const tris = bustTris();
  return YAWS.map((yaw) =>
    K.layer(260, 280, 2.2, (c) => {
      c.translate(130, 270 - 3.0 * BUST.scale);
      renderBust(c, tris, yaw, BUST.scale);
    }),
  );
}

function buildTitle() {
  return K.layer(1000, 300, 1, (c) => {
    const x = 44, y = 40, w = 400, h = 176;
    c.fillStyle = 'rgba(14,4,34,0.72)';
    c.fillRect(x, y, w, h);
    c.strokeStyle = '#7ff6ff';
    c.lineWidth = 2;
    c.strokeRect(x + 0.5, y + 0.5, w, h);
    c.strokeStyle = 'rgba(255,110,220,0.8)';
    c.lineWidth = 1;
    c.strokeRect(x + 7, y + 7, w - 14, h - 14);
    // a window-strip of small squares along the top edge
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = '#7ff6ff';
      c.strokeRect(x + w - 22 - i * 16, y + 14, 9, 9);
    }
    const T = TITLES[18];
    K.text(c, T.zh, x + 26, y + 26, { size: 56, font: K.FONT.cjkSans, weight: 700, baseline: 'top', color: '#ffffff', tracking: 22 });
    K.text(c, T.en.toUpperCase(), x + 28, y + 100, { size: 29, font: K.FONT.geo, weight: 600, baseline: 'top', color: '#ffd1f2', tracking: 13 });
    K.text(c, '２０１０ｓ', x + 28, y + 140, { size: 24, font: K.FONT.cjkSans, weight: 500, baseline: 'top', color: '#8ff7ff', tracking: 6 });
  });
}

function buildScan() {
  return K.layer(1000, 1012, 1, (c) => {
    c.fillStyle = 'rgba(10,0,25,0.26)';
    for (let y = 0; y < 1012; y += 3) c.fillRect(0, y, 1000, 1.3);
  });
}

function buildNoise() {
  return K.layer(1000, 120, 1, (c) => {
    const r = K.rng(1818);
    for (let i = 0; i < 520; i++) {
      const y = r() * 120, x = r() * 1000, w = r.range(4, 90);
      c.fillStyle = `rgba(255,255,255,${r.range(0.2, 0.9)})`;
      c.fillRect(x, y, w, r.range(0.8, 2.2));
    }
  });
}

// ------------------------------------------------------------------------------------------- per-frame pieces
function drawSun(c, tt) {
  K.put(c, L.sun, SUN.x - 200, SUN.y - 200, 400, 200);
  // drifting stripes, wider toward the horizon, cut in the sky colour
  c.fillStyle = skyGrad(c);
  const top = SUN.y - SUN.r * 0.62, span = SUN.y - top;
  for (let k = -1; k < 8; k++) {
    const u = (k + ((tt * 0.35) % 1)) / 7;
    if (u < 0 || u > 1) continue;
    const y = top + span * u, h = 1.5 + 13 * u;
    c.fillRect(SUN.x - SUN.r - 2, y, SUN.r * 2 + 4, h);
  }
}

function drawGrid(c, tt) {
  const F = 400, dz = 0.5, off = (tt * 0.42) % dz;
  c.beginPath();
  for (let i = 0; i < 160; i++) {
    const z = 1 + i * dz - off;
    if (z < 0.98) continue;
    const y = H0 + F / z;
    if (y - H0 < 2) break;
    c.moveTo(0, y);
    c.lineTo(1000, y);
  }
  for (let X = -42; X <= 42.001; X += 0.42) {
    c.moveTo(VPX + (X * F) / 120, H0 + F / 120);
    c.lineTo(VPX + X * F, H0 + F);
  }
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = 'rgba(255,60,200,0.22)';
  c.lineWidth = 5;
  c.stroke();
  c.strokeStyle = 'rgba(255,120,230,0.85)';
  c.lineWidth = 1.3;
  c.stroke();
  c.restore();
}

function drawRoad(c, t) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = K.linGrad(c, 0, 786, 0, 816, [[0, 'rgba(60,220,255,0)'], [0.45, 'rgba(60,220,255,0.28)'], [0.55, 'rgba(60,220,255,0.28)'], [1, 'rgba(60,220,255,0)']]);
  c.fillRect(0, 786, 1000, 30);
  c.fillStyle = 'rgba(90,240,255,0.35)';
  c.fillRect(0, 797, 1000, 6);
  c.fillStyle = 'rgba(220,255,255,0.95)';
  c.fillRect(0, 799.2, 1000, 1.8);
  // lane edges in perspective (z = 1.9 / 2.1) with dashes travelling toward the viewer
  c.fillStyle = 'rgba(120,240,255,0.55)';
  c.fillRect(0, 789.5, 1000, 1);
  c.fillRect(0, 810.5, 1000, 1.2);
  c.restore();
}

function drawSolid(c, kind, cx, cy, r, tt, seed) {
  let V, E;
  if (kind === 'ico') {
    const p = (1 + Math.sqrt(5)) / 2;
    V = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
    E = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.abs(Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]) - 2) < 0.01) E.push([i, j]);
    V = V.map((v) => v.map((x) => x / 1.9));
  } else if (kind === 'oct') {
    V = [[1, 0, 0], [-1, 0, 0], [0, 1.3, 0], [0, -1.3, 0], [0, 0, 1], [0, 0, -1]];
    E = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]];
  } else {
    V = [];
    for (let i = 0; i < 8; i++) V.push([i & 1 ? 0.7 : -0.7, i & 2 ? 0.7 : -0.7, i & 4 ? 0.7 : -0.7]);
    E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  }
  const a = tt * 0.45 + seed, b = tt * 0.3 + seed * 2;
  const P = V.map(([x, y, z]) => {
    const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    const y1 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b);
    return [cx + x1 * r, cy + 6 * Math.sin(tt * 1.1 + seed) + y1 * r, z2];
  });
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  for (const [w, col] of [[5, 'rgba(110,220,255,0.18)'], [1.4, 'rgba(200,250,255,0.9)']]) {
    c.lineWidth = w;
    c.strokeStyle = col;
    c.beginPath();
    for (const [i, j] of E) {
      c.moveTo(P[i][0], P[i][1]);
      c.lineTo(P[j][0], P[j][1]);
    }
    c.stroke();
  }
  c.fillStyle = 'rgba(255,170,240,0.9)';
  for (const p of P) c.fillRect(p[0] - 1.6, p[1] - 1.6, 3.2, 3.2);
  c.restore();
}

// --- the pelican, in pastel gradients
const PAL = {
  tire: ['#4a1d74', '#1d0833'], frame: ['#8ffaff', '#4a62ff'], metal: ['#f1ecff', '#9a88d8'], saddle: ['#ff8ade', '#9a2a94'],
  leg: ['#ffc6e8', '#ff86c2'], foot: ['#ffb8dc', '#ff6fb2'], body: ['#ffffff', '#cfbaff'], wing: ['#f6e8ff', '#97ceff'],
  tail: ['#ead9ff', '#a3b4ff'], neck: ['#ffffff', '#efd9ff'], head: ['#ffffff', '#f0dfff'], beak: ['#ffe7ad', '#ff98cc'],
  pouch: ['#ffb9cf', '#ff72b4'], scarf: ['#ff58dc', '#a92cff'], mark: ['#8f78d6', '#8f78d6'],
};
const OUT = '#33105a';
function bboxOf(pts) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) {
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return [y0, y1];
}
function vPelican(c, pose, ab = 1, simple = false) {
  const s = pose.s;
  if (!simple && ab > 0) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.6;
    c.translate(-3.5 * s * ab, -0.6 * s);
    Rig.drawSilhouette(c, pose, '#ff2bd0');
    c.translate(7 * s * ab, 1.2 * s);
    Rig.drawSilhouette(c, pose, '#1fe4ff');
    c.restore();
  }
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  for (const p of Rig.parts(pose)) {
    const P = PAL[p.role] || PAL.metal;
    c.globalAlpha = p.far ? 0.75 : 1;
    if (p.kind === 'poly') {
      const [y0, y1] = bboxOf(p.pts);
      K.path(c, p.pts, true);
      c.fillStyle = K.linGrad(c, 0, y0, 0, y1 + 0.01, [[0, P[0]], [1, P[1]]]);
      c.fill();
      if (!simple) {
        c.strokeStyle = OUT;
        c.lineWidth = 1.7 * s;
        c.stroke();
      }
    } else if (p.kind === 'line') {
      K.path(c, p.pts, false);
      if (p.role === 'mark') {
        c.strokeStyle = 'rgba(110,80,200,0.75)';
        c.lineWidth = 1.6 * s;
        c.stroke();
        continue;
      }
      if (!simple && p.w > 3 * s) {
        c.strokeStyle = OUT;
        c.lineWidth = p.w + 2.6 * s;
        c.stroke();
      }
      const [y0, y1] = bboxOf(p.pts);
      c.strokeStyle = K.linGrad(c, 0, y0 - 2, 0, y1 + 2, [[0, P[0]], [1, P[1]]]);
      c.lineWidth = p.w;
      c.stroke();
    } else if (p.kind === 'wheel') {
      c.beginPath();
      for (const [a, b] of Rig.spokes(p, 16)) {
        c.moveTo(a[0], a[1]);
        c.lineTo(b[0], b[1]);
      }
      c.strokeStyle = 'rgba(230,220,255,0.7)';
      c.lineWidth = 1.1 * s;
      c.stroke();
      c.beginPath();
      c.arc(p.c[0], p.c[1], p.r * 0.93, 0, K.TAU);
      c.strokeStyle = PAL.tire[1];
      c.lineWidth = p.r * 0.15;
      c.stroke();
      if (!simple) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r * 0.93, Math.PI * 1.05, Math.PI * 1.75);
        c.strokeStyle = 'rgba(255,110,230,0.9)';
        c.lineWidth = 2 * s;
        c.stroke();
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r * 0.93, -0.3, 0.7);
        c.strokeStyle = 'rgba(100,240,255,0.9)';
        c.stroke();
        c.restore();
      }
      c.beginPath();
      c.arc(p.c[0], p.c[1], p.r * 0.12, 0, K.TAU);
      c.fillStyle = '#e8e0ff';
      c.fill();
    } else if (p.kind === 'disc') {
      c.beginPath();
      c.arc(p.c[0], p.c[1], p.r, 0, K.TAU);
      c.fillStyle = '#c9bdf2';
      c.fill();
    } else if (p.kind === 'eye') {
      c.beginPath();
      c.arc(p.c[0], p.c[1], p.r, 0, K.TAU);
      c.fillStyle = '#ffffff';
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 1.2 * s;
      c.stroke();
      if (p.lid < 0.5) {
        c.beginPath();
        c.arc(p.pupil[0], p.pupil[1], p.pr, 0, K.TAU);
        c.fillStyle = '#2a0a4a';
        c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(p.pupil[0] - p.pr * 0.35, p.pupil[1] - p.pr * 0.4, p.pr * 0.38, 0, K.TAU);
        c.fill();
      }
    }
  }
  c.restore();
}

function glint(c, x, y, r, a) {
  if (a <= 0.01) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = `rgba(255,255,255,${a})`;
  c.beginPath();
  c.moveTo(x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.fill();
  c.fillStyle = K.radGrad(c, x, y, 0, r * 0.8, [[0, `rgba(255,220,255,${a * 0.8})`], [1, 'rgba(255,200,255,0)']]);
  c.fillRect(x - r, y - r, 2 * r, 2 * r);
  c.restore();
}

// ------------------------------------------------------------------------------------------- tape effects
/** how the transfer misbehaves at time t */
function tapeFx(t) {
  const fx = { split: 1.6, wob: 0.7, wobHz: 1, ghost: 0, tear: 0, tearY: 0, scan: 0, flash: 0 };
  // entry: the tape slows down onto speed
  if (t > -0.05 && t < 0.6) {
    const k = Math.pow(1 - K.clamp(t / 0.55), 2);
    fx.split += 9 * k;
    fx.wob += 6 * k;
    fx.wobHz = 1 + 3 * k;
    fx.ghost = k;
  }
  // the skip
  if (t >= SKIP.at && t < SKIP_END + 0.12) {
    const k = Math.min(SKIP.times, Math.floor((t - SKIP.at) / SKIP.len));
    const ph = t - SKIP.at - k * SKIP.len;
    const hit = Math.max(0, 1 - ph / 0.13);
    fx.tear = k < SKIP.times ? hit : Math.max(0, 1 - ph / 0.1) * 0.8;
    fx.tearY = k < SKIP.times ? TEAR_Y[k] : 450;
    fx.split += 10 * hit + 2;
    fx.wob += 3 * hit;
    fx.scan = Math.min(k, 3) * 1.5 + (k >= SKIP.times ? 0 : 0);
    fx.flash = hit * 0.18;
  }
  // exit: flutter, then the picture tightens as the tape comes back up to speed
  if (t > 5.55 && t < 6.4) {
    const up = K.smoothstep(5.55, 5.85, t), clean = K.smoothstep(5.86, 6.0, t), back = K.smoothstep(6.05, 6.4, t);
    fx.wob = K.lerp(fx.wob + 3 * up, 0, clean) + 0.7 * back;
    fx.wobHz = 1 + 4 * up;
    fx.split = K.lerp(1.6 + 4 * up, 0, clean) + 1.6 * back;
  }
  return fx;
}

function strips(w, F, t, fx, d) {
  w.setTransform(1, 0, 0, 1, 0, 0);
  w.globalCompositeOperation = 'source-over';
  w.fillStyle = '#0a0118';
  w.fillRect(0, 0, 1000, 1000);
  const tb0 = fx.tearY - 36, tb1 = fx.tearY + 36;
  let y = 0;
  while (y < 1000) {
    const inTear = fx.tear > 0 && y >= tb0 && y < tb1;
    const h = inTear ? 6 : 40;
    let dx = d + fx.wob * Math.sin(y * 0.013 + t * 6 * fx.wobHz) * (0.6 + 0.4 * K.noise1(y * 0.05 + t * 3));
    if (inTear) dx += fx.tear * (18 + 40 * K.hash1((y * 7 + Math.floor(t * 40)) | 0)) * (K.hash1(y | 0) > 0.5 ? 1 : -0.6);
    w.drawImage(F, 0, y, 1000, h, dx, y, 1000, h);
    y += h;
  }
  if (fx.tear > 0) {
    w.globalAlpha = Math.min(1, fx.tear * 1.2);
    w.globalCompositeOperation = 'lighter';
    w.drawImage(L.noise, 0, 0, 1000, 120, (t * 997) % 200 - 100, fx.tearY - 50, 1000, 100);
    w.globalCompositeOperation = 'source-over';
    w.globalAlpha = 1;
  }
}

function composite(ctx, t, fx, hero) {
  const F = L.F;
  // 1–2. tracking wobble + tear band by horizontal strips, drawn straight into a red and a cyan channel copy that
  // are offset against each other (chroma split; exact where aligned)
  const d = fx.split;
  const r = L.Rc.getContext('2d'), b = L.Bc.getContext('2d');
  const V=globalThis.V18||3; if(V===1){ctx.drawImage(F,0,0,1000,1000);return;}
  strips(r, F, t, fx, -d);
  if(V===2){ctx.drawImage(L.Rc,0,0,1000,1000);return;}
  strips(b, F, t, fx, d);
  r.globalCompositeOperation = 'multiply';
  r.fillStyle = '#ff0000';
  r.fillRect(0, 0, 1000, 1000);
  b.globalCompositeOperation = 'multiply';
  b.fillStyle = '#00ffff';
  b.fillRect(0, 0, 1000, 1000);
  ctx.drawImage(L.Rc, 0, 0, 1000, 1000);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(L.Bc, 0, 0, 1000, 1000);
  ctx.restore();
  if(V===3)return;
  // 3. bloom: a tiny copy blown back up, screened on
  const s = L.Sc.getContext('2d');
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.imageSmoothingQuality = 'low';
  s.drawImage(F, 0, 0, 1000, 1000, 0, 0, 125, 125);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.28;
  ctx.drawImage(L.Sc, 0, 0, 125, 125, 0, 0, 1000, 1000);
  // 4. slow-down smear on entry: trailing ghosts
  if (fx.ghost > 0.01) {
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = (0.28 * fx.ghost) / i;
      ctx.drawImage(F, -26 * i * fx.ghost, 0, 1000, 1000);
    }
  }
  ctx.restore();
  // 5. scanlines (they jump on each repeat) and a slow rolling band
  ctx.drawImage(L.scan, 0, -6 + (fx.scan % 6), 1000, 1012);
  const ry = ((t * 70) % 1300) - 150;
  ctx.fillStyle = K.linGrad(ctx, 0, ry, 0, ry + 120, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,230,255,0.05)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(0, ry, 1000, 120);
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,220,255,${fx.flash})`;
    ctx.fillRect(0, 0, 1000, 1000);
  }
  // 6. head-switching noise along the bottom edge
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.drawImage(L.noise, (t * 613) % 300, 0, 700, 30, 0, 986, 1000, 14);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- scene
function bustYawIndex(t) {
  // the head steps only on beats, toward where the pelican is (and stays where it went)
  const q = Math.floor(tapeT(t) * 2) / 2;
  const px = (q / 6) * 1000;
  if (px < 380) return 0;
  if (px < 640) return 1;
  if (px < 800) return 2;
  if (px < 960) return 3;
  return 4;
}

export default {
  id: 18, key: 'vapor', title: TITLES[18], heroT: 3.0,
  async init() {
    L = {
      sky: buildSky(), sun: buildSun(), mtn: buildMountains(), haze: buildHaze(),
      palms: [buildPalm(31, 400, 0.18), buildPalm(57, 210, -0.12), buildPalm(83, 180, 0.15)],
      ped: buildPedestal(), busts: buildBusts(), title: buildTitle(), scan: buildScan(), noise: buildNoise(),
      F: K.makeCanvas(1000, 1000), Rc: K.makeCanvas(1000, 1000), Bc: K.makeCanvas(1000, 1000),
      Sc: K.makeCanvas(125, 125), Rf: K.makeCanvas(1000, 220),
    };
  },
  render(ctx, t, env) {
    const tt = tapeT(t); const P0=performance.now(); const T=[];
    const c = L.F.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    // sky, sun, mountains, grid floor
    K.put(c, L.sky);
    drawSun(c, tt);
    K.put(c, L.mtn, 0, 450, 1000, 200);
    drawGrid(c, tt);
    K.put(c, L.haze, 0, 500, 1000, 260);
    // palms (distant first), swaying from the base
    const palms = [[255, 655, 1, 0.75], [672, 640, 2, 0.7], [70, 770, 0, 1]];
    for (const [x, y, i, k] of palms) {
      c.save();
      c.translate(x, y);
      c.rotate(0.025 * Math.sin(tt * 1.3 + i * 2) + 0.01 * Math.sin(tt * 3.1 + i));
      c.scale(k, k);
      c.drawImage(L.palms[i], -200, -600, 400, 620);
      c.restore();
    }
    // wireframe solids drifting
    drawSolid(c, 'ico', 590, 175, 58, tt, 0.3);
    drawSolid(c, 'oct', 330, 300, 36, tt, 1.7);
    drawSolid(c, 'cube', 700, 360, 26, tt, 2.9);
    // the bust on its pedestal
    K.put(c, L.ped);
    const bi = bustYawIndex(t);
    c.drawImage(L.busts[bi], BUST.x - 130, BUST.base - 270, 260, 280);
    T.push(performance.now()-P0); drawRoad(c, t);
    // the pelican (at tape time) with its reflection on the glossy floor
    const pose = tt !== t ? env.poseAt(tt) : env.pose;
    if (pose) {
      const r = L.Rf.getContext('2d');
      r.setTransform(1, 0, 0, 1, 0, 0);
      r.globalCompositeOperation = 'source-over';
      r.clearRect(0, 0, 1000, 220);
      r.setTransform(1, 0, 0, -1.15, 0, 800 * 1.15);
      vPelican(r, pose, 0, true);
      r.setTransform(1, 0, 0, 1, 0, 0);
      r.globalCompositeOperation = 'destination-in';
      r.fillStyle = K.linGrad(r, 0, 0, 0, 200, [[0, 'rgba(0,0,0,0.5)'], [0.6, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,0)']]);
      r.fillRect(0, 0, 1000, 220);
      r.globalCompositeOperation = 'source-over';
      c.save();
      for (let yy = 0; yy < 200; yy += 10) c.drawImage(L.Rf, 0, yy, 1000, 10, 2.5 * Math.sin(yy * 0.2 + tt * 4), 801 + yy, 1000, 10);
      c.restore();
      vPelican(c, pose, 1);
      // a glint on the beak, pulsing with the beat
      const bt = pose.pt.beakTip, bb = pose.pt.beakBase;
      glint(c, K.lerp(bb[0], bt[0], 0.55), K.lerp(bb[1], bt[1], 0.55) - 5 * pose.s, 14 * pose.s * (0.7 + 0.3 * Math.exp(-((tt * 2) % 1) * 4)), 0.85);
    }
    T.push(performance.now()-P0);
    // title card + VHS on-screen display
    K.put(c, L.title, 0, 0, 1000, 300);
    const secs = 107 + Math.max(0, tt);
    const ts = `SP  0:01:${String(Math.floor(secs) % 60).padStart(2, '0')}:${String(Math.floor((secs % 1) * 30)).padStart(2, '0')}`;
    K.text(c, 'PLAY ▶', 44, 950, { size: 26, font: K.FONT.mono, weight: 700, color: 'rgba(240,250,255,0.92)', tracking: 2 });
    K.text(c, ts, 956, 950, { size: 26, font: K.FONT.mono, weight: 700, color: 'rgba(240,250,255,0.92)', align: 'right', tracking: 2 });
    // through the tape
    T.push(performance.now()-P0); composite(ctx, t, tapeFx(t), env.hero); c.getImageData(0,0,1,1); ctx.getImageData?.(0,0,1,1); T.push(performance.now()-P0); console.log('T18', t, T.map(x=>x.toFixed(1)).join(' '));
  },
};
