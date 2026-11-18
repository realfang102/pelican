// kit/noise — deterministic randomness. Nothing in the film may call Math.random():
// every frame must be a pure function of time, and every baked layer must come out the same on every worker.

/** seeded PRNG (mulberry32). const r = rng(7); r() → [0,1); r.range(a,b); r.int(a,b); r.pick(arr); r.gauss(); r.chance(p) */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  const f = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  f.gauss = () => {
    const u = Math.max(1e-9, f()), v = f();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * v);
  };
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}

/** integer hash → [0,1) */
export const hash1 = (n) => {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
export const hash2 = (x, y, seed = 0) => hash1((Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0);

/** smooth 1D value noise in [0,1] */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash2(i, 0, seed) * (1 - u) + hash2(i + 1, 0, seed) * u;
}
/** smooth 2D value noise in [0,1] */
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fractal value noise in [0,1] */
export function fbm2(x, y, oct = 4, seed = 0, lac = 2, gain = 0.5) {
  let amp = 0.5, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * noise2(x, y, seed + o * 17);
    norm += amp;
    x *= lac;
    y *= lac;
    amp *= gain;
  }
  return sum / norm;
}
/** signed wobble in [-1,1] that drifts smoothly with time — handy for hand tremor, flutter, breathing */
export const wobble = (t, speed = 1, seed = 0) => noise1(t * speed, seed) * 2 - 1;
