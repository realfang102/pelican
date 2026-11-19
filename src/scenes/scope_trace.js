// scope_trace — the green phosphor vector trace of the pelican, shared by section 14 (where the shadow on the wall
// powers up into it) and section 15 (the oscilloscope itself). Both sections call the same functions with the same
// film time, so the two halves of the pelican match across the frame post.
//
//   drawTrace(ctx, pose, opts)       one pass of the beam over the pose: Rig.parts → polylines → additive glow
//   drawPersist(ctx, env, t, opts)   the beam plus phosphor persistence: older poses via env.poseAt, falling alpha
//   lissajous(pose, k, t)            the warp descriptor used by the wrong-knob gag (every point → a Lissajous figure)
import * as KIT from '../kit/index.js';
import * as RIG from '../rig/index.js';

const TAU = Math.PI * 2;
export const PHOSPHOR = { glow: '#2fff78', line: '#74ffa4', core: '#e9fff1', old: '#27d867' };
export const GHOSTS = 7, GHOST_DT = 0.05;

const SKIP = new Set(['chain', 'chain2', 'cog', 'crankF', 'pedalF', 'beakLine', 'scarfKnot', 'scarf0', 'scarf1']);

const circ = (c, r, n, a0 = 0) => {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * TAU;
    p.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return p;
};

/** the pose as open polylines in drawing order: [{ pts, dim }] (closed outlines repeat their first point) */
export function tracePolys(pose, Rig = RIG) {
  const out = [];
  const add = (pts, dim = false) => { if (pts && pts.length > 1) out.push({ pts, dim }); };
  for (const p of Rig.parts(pose, { scarf: false })) {
    if (SKIP.has(p.name)) continue;
    if (p.kind === 'poly') add(p.pts.concat([p.pts[0]]), !!p.far);
    else if (p.kind === 'line') add(p.pts, !!p.far || p.role === 'mark');
    else if (p.kind === 'wheel') {
      add(circ(p.c, p.r * 0.985, 40, p.a));
      add(circ(p.c, p.r * 0.1, 8, p.a), true);
      for (const sp of Rig.spokes(p, 8, 0.1, 0.985)) add(sp, true);
    } else if (p.kind === 'disc') add(circ(p.c, p.r, 14), true);
    else if (p.kind === 'eye') {
      add(circ(p.c, p.r, 12));
      add(circ(p.pupil, Math.max(0.9, p.pr * 0.55), 6));
    }
  }
  return out;
}

/** warp descriptor: every trace point is pulled (k = 0..1) onto a precessing Lissajous figure centred on the pelican */
export function lissajous(pose, k, t, { a = 5, b = 4, rx = 168, ry = 138 } = {}) {
  if (!(k > 0.0005)) return null;
  return { k, cx: pose.x + 6 * pose.s, cy: pose.y - 152 * pose.s, rx: rx * pose.s, ry: ry * pose.s, a, b, ph: t * 2.6 + 0.4, ph2: t * 0.9 };
}

/**
 * Stroke one pose as a glowing vector trace.
 *   opts: Rig, alpha, jitterSeed (integer: scan jitter for this refresh; null = none), warp (see lissajous),
 *         reveal 0..1 (how far round the figure the beam has got), spot 0..1 (beam spot position), ghost (an old,
 *         dimmer pass: no core, no jitter), width, glow, boost (extra bloom 0..1), shake (extra jitter in units)
 */
export function drawTrace(ctx, pose, o = {}) {
  const { Rig = RIG, alpha = 1, jitterSeed = null, warp = null, reveal = 1, spot = null, ghost = false, width = 2.2, glow = 10, boost = 0, shake = 0 } = o;
  if (!pose || alpha <= 0.004 || reveal <= 0) return;
  const polys = tracePolys(pose, Rig);
  const wk = warp ? warp.k : 0;
  const jit = jitterSeed != null && !ghost;
  const step = wk > 0 ? 5 : jit ? 10 : 0;
  // lengths
  let total = 0;
  for (const pl of polys) {
    let L = 0;
    const P = pl.pts;
    for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    pl.len = L;
    total += L;
  }
  if (total < 1) return;
  const amp = 0.5 + shake, seed = (jitterSeed ?? 0) | 0;
  let acc = 0, idx = 0, spotPt = null;
  const bright = [], dim = [], starts = [];
  for (const pl of polys) {
    const P = pl.pts, Q = [];
    let s = acc;
    const push = (x, y, sAt) => {
      const tau = sAt / total;
      if (tau > reveal) return false;
      if (wk > 0) {
        const lx = warp.cx + warp.rx * Math.sin(warp.a * TAU * tau + warp.ph);
        const ly = warp.cy + warp.ry * Math.sin(warp.b * TAU * tau + warp.ph2);
        x += (lx - x) * wk;
        y += (ly - y) * wk;
      }
      if (jit) {
        x += (KIT.hash1(idx * 131 + seed * 977) - 0.5) * 2 * amp + Math.sin(y * 0.8 + seed * 1.7) * 0.3;
        y += (KIT.hash1(idx * 173 + seed * 613 + 7) - 0.5) * 2 * amp;
      }
      idx++;
      if (spot != null && !spotPt && tau >= spot) spotPt = [x, y];
      Q.push(x, y);
      return true;
    };
    let ok = push(P[0][0], P[0][1], s);
    for (let i = 1; i < P.length && ok; i++) {
      const dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1], d = Math.hypot(dx, dy);
      const n = step ? Math.max(1, Math.ceil(d / step)) : 1;
      for (let j = 1; j <= n && ok; j++) ok = push(P[i - 1][0] + (dx * j) / n, P[i - 1][1] + (dy * j) / n, s + (d * j) / n);
      s += d;
    }
    acc += pl.len;
    if (Q.length >= 4) {
      (pl.dim && wk < 0.5 ? dim : bright).push(Q);
      if (!pl.dim) starts.push(Q[0], Q[1]);
    }
  }
  const trace = (list) => {
    ctx.beginPath();
    for (const Q of list) {
      ctx.moveTo(Q[0], Q[1]);
      for (let i = 2; i < Q.length; i += 2) ctx.lineTo(Q[i], Q[i + 1]);
    }
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const base = ctx.globalAlpha * alpha, bl = 1 + boost;
  const pass = (w, a, col) => {
    ctx.lineWidth = w;
    ctx.globalAlpha = Math.min(1, base * a);
    ctx.strokeStyle = col;
    ctx.stroke();
  };
  if (ghost) {
    trace(bright);
    pass(width + glow * 0.55, 0.13, PHOSPHOR.old);
    pass(width * 0.95, 0.75, PHOSPHOR.old);
    if (dim.length) {
      trace(dim);
      pass(width * 0.8, 0.36, PHOSPHOR.old);
    }
  } else {
    trace(bright);
    pass(width + glow * 2 * bl, 0.06 * bl, PHOSPHOR.glow);
    pass(width + glow * bl, 0.12 * bl, PHOSPHOR.glow);
    pass(width + glow * 0.35, 0.3, PHOSPHOR.glow);
    pass(width, 0.95, PHOSPHOR.line);
    pass(Math.max(0.7, width * 0.42), 0.7, PHOSPHOR.core);
    if (dim.length) {
      trace(dim);
      pass(width + glow * 0.4, 0.1, PHOSPHOR.glow);
      pass(width * 0.8, 0.5, PHOSPHOR.line);
    }
    // the beam dwells where each stroke begins
    ctx.globalAlpha = Math.min(1, base * 0.55);
    ctx.fillStyle = PHOSPHOR.core;
    ctx.beginPath();
    for (let i = 0; i < starts.length; i += 2) {
      ctx.moveTo(starts[i] + width * 0.8, starts[i + 1]);
      ctx.arc(starts[i], starts[i + 1], width * 0.8, 0, TAU);
    }
    ctx.fill();
    if (spotPt) {
      const g = ctx.createRadialGradient(spotPt[0], spotPt[1], 0, spotPt[0], spotPt[1], 20);
      g.addColorStop(0, 'rgba(235,255,242,0.95)');
      g.addColorStop(0.25, 'rgba(90,255,150,0.5)');
      g.addColorStop(1, 'rgba(40,255,120,0)');
      ctx.globalAlpha = Math.min(1, base);
      ctx.fillStyle = g;
      ctx.fillRect(spotPt[0] - 20, spotPt[1] - 20, 40, 40);
    }
  }
  ctx.restore();
}

/**
 * The trace with phosphor persistence, as both sections draw it. `t` is the caller's section-local time; the scan
 * jitter and the beam spot are keyed to film time (env.T) so that neighbours agree.
 *   opts: alpha, boost, warpAt(tLocal, pose) → warp descriptor | null, n, dt, plus anything drawTrace takes
 */
export function drawPersist(ctx, env, t, o = {}) {
  const { alpha = 1, warpAt = null, n = GHOSTS, dt = GHOST_DT, margin = 320 } = o;
  const Rig = o.Rig ?? env.Rig ?? RIG;
  const T = env.T ?? t;
  const vis = (p) => p && p.x > -margin && p.x < 1000 + margin;
  for (let k = n; k >= 1; k--) {
    const tk = t - k * dt, pose = env.poseAt(tk);
    if (!vis(pose)) continue;
    drawTrace(ctx, pose, { ...o, Rig, alpha: alpha * 0.62 * Math.pow(0.7, k - 1), ghost: true, jitterSeed: null, spot: null, warp: warpAt ? warpAt(tk, pose) : null });
  }
  const pose = env.poseAt(t);
  if (!vis(pose)) return;
  drawTrace(ctx, pose, { ...o, Rig, alpha, ghost: false, jitterSeed: Math.floor(T * 30 + 1e-6), spot: (T * 1.3) % 1, warp: warpAt ? warpAt(t, pose) : null });
}
