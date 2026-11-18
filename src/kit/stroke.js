// kit/stroke — Canvas 2D strokes for things that move every frame (the pelican, flags, water, onlookers' heads).
// Static artwork should be painted once with p5.brush through kit/bake; these are the fast, per-frame companions,
// written so a line drawn at t and at t + 1/60 s looks like the same hand.
import { noise1, rng } from './noise.js';
import { clamp, TAU } from './math.js';

/** cumulative arc length: [0, d1, d1+d2, ...] */
export function arcLen(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return L;
}

/** point at arc-length fraction u (0..1) */
export function pointAt(pts, u, L = arcLen(pts)) {
  const total = L[L.length - 1], s = clamp(u) * total;
  let i = 1;
  while (i < L.length - 1 && L[i] < s) i++;
  const seg = L[i] - L[i - 1] || 1, f = (s - L[i - 1]) / seg;
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
}

/** resample to roughly even spacing */
export function resample(pts, step = 4) {
  if (pts.length < 2) return pts.slice();
  const L = arcLen(pts), total = L[L.length - 1];
  const n = Math.max(2, Math.ceil(total / step) + 1);
  const out = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * total;
    while (j < L.length - 1 && L[j] < s) j++;
    const seg = L[j] - L[j - 1] || 1, f = (s - L[j - 1]) / seg;
    out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f]);
  }
  return out;
}

/** Catmull-Rom subdivision: smooth curve through the points */
export function catmull(pts, seg = 8, closed = false) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}

/** Chaikin corner cutting */
export function chaikin(pts, iters = 2, closed = false) {
  let P = pts;
  for (let k = 0; k < iters; k++) {
    const Q = [];
    const n = P.length;
    if (!closed) Q.push(P[0]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = P[i], b = P[(i + 1) % n];
      Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) Q.push(P[n - 1]);
    P = Q;
  }
  return P;
}

/** sampled ellipse / circle / arc as points */
export function ellipsePts(cx, cy, rx, ry = rx, n = 32, rotA = 0, a0 = 0, a1 = TAU) {
  const out = [], c = Math.cos(rotA), s = Math.sin(rotA);
  const full = Math.abs(a1 - a0 - TAU) < 1e-6;
  const m = full ? n : n + 1;
  for (let i = 0; i < m; i++) {
    const a = a0 + ((a1 - a0) * i) / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

/** displace points along their normals with smooth noise (hand tremor that is stable over time for a fixed seed) */
export function jitter(pts, amp = 1, freq = 0.05, seed = 1) {
  const L = arcLen(pts);
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const m = Math.hypot(nx, ny) || 1;
    nx /= m;
    ny /= m;
    const d = (noise1(L[i] * freq, seed) - 0.5) * 2 * amp;
    return [p[0] + nx * d, p[1] + ny * d];
  });
}

/** polygon outline of a variable-width stroke. wFn(u, i) → full width at arc fraction u */
export function ribbonPoly(pts, wFn) {
  const n = pts.length;
  if (n < 2) return [];
  const L = arcLen(pts), total = L[n - 1] || 1;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const m = Math.hypot(nx, ny) || 1;
    nx /= m;
    ny /= m;
    const w = (typeof wFn === 'function' ? wFn(L[i] / total, i) : wFn) / 2;
    left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  return left.concat(right.reverse());
}

/** fill a variable-width stroke */
export function ribbon(ctx, pts, wFn, fill) {
  const poly = ribbonPoly(pts, wFn);
  if (!poly.length) return;
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
  if (fill) ctx.fillStyle = fill;
  ctx.fill();
}

/** width envelope: thin entry, full belly, thin exit. a/b = fraction of length spent swelling/tapering */
export const taper = (u, a = 0.18, b = 0.28, min = 0.12) => {
  const up = a > 0 ? clamp(u / a) : 1, down = b > 0 ? clamp((1 - u) / b) : 1;
  const e = Math.min(up * (2 - up), down * (2 - down));
  return min + (1 - min) * e;
};

/**
 * Brush stroke through `pts` — the per-frame ink/paint line.
 *   width     belly width in units            color, alpha
 *   taper     [in, out] fractions (0 = blunt) minW   width at the tips as a fraction of belly
 *   pressure  (u) => multiplier                wobble 0..1 edge irregularity
 *   dry       0 = loaded wet brush … 1 = nearly dry (broken "flying white" streaks)
 *   seed      keeps the texture identical from frame to frame
 *   smooth    false to use the points as given (already dense)
 */
export function brushStroke(ctx, pts, o = {}) {
  const width = o.width ?? 6, color = o.color ?? '#111111', alpha = o.alpha ?? 1, seed = o.seed ?? 1;
  const [tin, tout] = o.taper ?? [0.18, 0.28];
  const minW = o.minW ?? 0.12, wob = o.wobble ?? 0.12, dry = o.dry ?? 0;
  if (pts.length < 2) return;
  let P = o.smooth === false ? pts : catmull(pts, o.seg ?? 6);
  P = resample(P, Math.max(1.2, width * 0.3));
  const L = arcLen(P), total = L[L.length - 1] || 1;
  const wAt = (u) => {
    let w = width * taper(u, tin, tout, minW);
    if (o.pressure) w *= o.pressure(u);
    if (wob) w *= 1 + wob * (noise1((u * total) / Math.max(4, width * 1.2), seed) - 0.5) * 2;
    return Math.max(0.2, w);
  };
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (dry <= 0.03) {
    ribbon(ctx, P, wAt, color);
    ctx.restore();
    return;
  }
  // dry brush: individual bristles that skip
  const nb = clamp(Math.round(width / 1.5), 3, 36);
  const r = rng(seed * 7919 + 13);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const n = P.length;
  const normals = P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    const nx = -(b[1] - a[1]), ny = b[0] - a[0], m = Math.hypot(nx, ny) || 1;
    return [nx / m, ny / m];
  });
  const widths = P.map((_, i) => wAt(L[i] / total));
  const skipLen = Math.max(6, width * (2.2 - dry));
  const base = ctx.globalAlpha;
  for (let j = 0; j < nb; j++) {
    const v = (j + 0.5) / nb - 0.5 + (r() - 0.5) * 0.04;
    const edge = Math.abs(v) * 2; // bristles at the edge run dry first
    const thresh = dry * (0.55 + 0.4 * edge);
    const ph = r() * 1000;
    ctx.globalAlpha = base * (0.55 + 0.45 * r());
    ctx.lineWidth = Math.max(0.5, (width / nb) * 1.35);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < n; i++) {
      const on = noise1(L[i] / skipLen + ph, seed + j) > thresh * 0.9 || (L[i] / total < 0.06 && dry < 0.8);
      const x = P[i][0] + normals[i][0] * v * widths[i], y = P[i][1] + normals[i][1] * v * widths[i];
      if (on) {
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

/** sketchy pencil / pen line: a few overlapping passes with slight tremor */
export function sketchLine(ctx, pts, { width = 1.4, color = '#222222', alpha = 0.8, passes = 2, amp = 1.2, freq = 0.04, seed = 1, closed = false } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < passes; k++) {
    const P = jitter(pts, amp, freq, seed + k * 31);
    ctx.globalAlpha *= k === 0 ? alpha : 0.7;
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
    if (closed) ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

/** parallel hatching clipped to a polygon */
export function hatchPoly(ctx, poly, { angle = Math.PI / 4, gap = 6, width = 1, color = '#222222', alpha = 0.7, jitter: jit = 0.6, seed = 1 } = {}) {
  if (poly.length < 3) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + gap;
  const r = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.globalAlpha *= alpha;
  const c = Math.cos(angle), s = Math.sin(angle);
  ctx.beginPath();
  for (let d = -R; d <= R; d += gap) {
    const o = d + (r() - 0.5) * jit * gap, e = (r() - 0.5) * jit * 3;
    ctx.moveTo(cx - s * o - c * R, cy + c * o - s * R + e);
    ctx.lineTo(cx - s * o + c * R, cy + c * o + s * R - e);
  }
  ctx.stroke();
  ctx.restore();
}

/** additive glowing line (phosphor, neon, laser). Call inside your own save/restore if you change blend modes. */
export function glowLine(ctx, pts, { color = '#66ff88', width = 2, glow = 10, alpha = 1, closed = false, core = '#ffffff', coreAlpha = 0.6 } = {}) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
  };
  const base = ctx.globalAlpha * alpha;
  trace();
  ctx.strokeStyle = color;
  for (const [w, a] of [[width + glow * 2, 0.07], [width + glow, 0.14], [width + glow * 0.35, 0.3], [width, 0.95]]) {
    ctx.lineWidth = w;
    ctx.globalAlpha = base * a;
    ctx.stroke();
  }
  if (coreAlpha > 0) {
    ctx.strokeStyle = core;
    ctx.lineWidth = Math.max(0.6, width * 0.45);
    ctx.globalAlpha = base * coreAlpha;
    ctx.stroke();
  }
  ctx.restore();
}

/** scatter n dots inside a rect or along a caller-supplied sampler: sampler(r) → [x,y,size?] */
export function stipple(ctx, n, sampler, { color = '#111111', alpha = 0.5, size = [0.6, 1.8], seed = 1 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const p = sampler(r);
    if (!p) continue;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * r());
    ctx.beginPath();
    ctx.arc(p[0], p[1], p[2] ?? r.range(size[0], size[1]), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
