// kit/math — small numeric helpers shared by every module. Pure functions only.

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (x - a) / (b - a);
/** remap x from [a,b] to [c,d], clamped */
export const remap = (x, a, b, c, d) => c + (d - c) * clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** 0..1 progress of a window that starts at t0 and lasts d seconds */
export const prog = (t, t0, d) => clamp((t - t0) / d);
/** gaussian bump centred on c with half-width w (1 at c) */
export const bump = (t, c, w) => {
  const x = (t - c) / w;
  return Math.exp(-x * x);
};
/** 0 → 1 → 0 window: rises over `fin` after a, falls over `fout` before b */
export const gate = (t, a, b, fin = 0.2, fout = fin) => smoothstep(a, a + fin, t) * (1 - smoothstep(b - fout, b, t));
export const fract = (x) => x - Math.floor(x);
export const mod = (x, m) => ((x % m) + m) % m;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const mixPt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const rot = (p, a, o = [0, 0]) => {
  const c = Math.cos(a), s = Math.sin(a), x = p[0] - o[0], y = p[1] - o[1];
  return [o[0] + x * c - y * s, o[1] + x * s + y * c];
};

export const ease = {
  lin: (t) => t,
  in2: (t) => t * t,
  out2: (t) => 1 - (1 - t) * (1 - t),
  io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  in3: (t) => t * t * t,
  out3: (t) => 1 - Math.pow(1 - t, 3),
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out4: (t) => 1 - Math.pow(1 - t, 4),
  out5: (t) => 1 - Math.pow(1 - t, 5),
  ioSine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * TAU) / 3) + 1),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

/**
 * Monotone cubic interpolation (Fritsch–Carlson) through points [[x,y],...] with prescribed end slopes.
 * Flat runs stay exactly flat, so it can express "ride in, freeze, ride out" without overshoot.
 * Returns f(x) with f.d(x) = derivative.
 */
export function pchip(pts, m0 = null, m1 = null) {
  const n = pts.length;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]);
      const w2 = xs[i + 1] - xs[i] + 2 * (xs[i] - xs[i - 1]);
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  const lim = (mi, di) => (di === 0 ? 0 : Math.sign(di) * Math.min(Math.abs(mi), 3 * Math.abs(di)));
  m[0] = lim(m0 == null ? d[0] : m0, d[0]);
  m[n - 1] = lim(m1 == null ? d[n - 2] : m1, d[n - 2]);
  const seg = (x) => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    return i;
  };
  const f = (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    const i = seg(x), h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
  f.d = (x) => {
    if (x <= xs[0]) return m[0];
    if (x >= xs[n - 1]) return m[n - 1];
    const i = seg(x), h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t;
    return ((6 * t2 - 6 * t) * ys[i]) / h + (3 * t2 - 4 * t + 1) * m[i] + ((-6 * t2 + 6 * t) * ys[i + 1]) / h + (3 * t2 - 2 * t) * m[i + 1];
  };
  return f;
}
