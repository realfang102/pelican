// kit/texture — procedural substrates: paper, stone, plaster, grain. All seeded, all built once and cached by the caller.
import { makeCanvas, layer } from './canvas.js';
import { fbm2, rng, hash2 } from './noise.js';
import { rgb, rgba } from './color.js';

/**
 * A canvas whose every pixel is `color` with alpha = shaped fractal noise. Blit it with any blend mode to mottle,
 * stain, fog, weather or speckle a surface.
 *   scale   feature size in units        lo/hi  noise range mapped to alpha 0..1      stretch [sx,sy] anisotropy (>1 = finer on that axis)
 *   ridged  fold the noise into veins    res    pixels per unit (keep ≤ 0.5 for soft features; it is upscaled smoothly)
 */
export function noiseLayer({ w = 1000, h = 1000, res = 0.5, scale = 120, oct = 4, seed = 1, color = '#000000', lo = 0.35, hi = 0.75, alpha = 1, stretch = [1, 1], gain = 0.5, ridged = false, invert = false } = {}) {
  const pw = Math.max(2, Math.round(w * res)), ph = Math.max(2, Math.round(h * res));
  const c = makeCanvas(pw, ph);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(pw, ph), d = img.data;
  const [r, g, b] = rgb(color);
  const k = 1 / (scale * res);
  for (let y = 0, i = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++, i += 4) {
      let n = fbm2(x * k * stretch[0], y * k * stretch[1], oct, seed, 2, gain);
      if (ridged) n = 1 - Math.abs(n * 2 - 1);
      let a = (n - lo) / (hi - lo);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      a = a * a * (3 - 2 * a);
      if (invert) a = 1 - a;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a * alpha * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  c.uw = w;
  c.uh = h;
  c.res = res;
  return c;
}

const tiles = new Map();
/** small tileable speckle tile (white-noise alpha in one colour) */
export function grainTile(size = 256, seed = 1, color = '#000000', density = 1, soft = false) {
  const key = `${size}|${seed}|${color}|${density}|${soft}`;
  let c = tiles.get(key);
  if (c) return c;
  c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size), d = img.data;
  const [r, g, b] = rgb(color);
  for (let y = 0, i = 0; y < size; y++) {
    for (let x = 0; x < size; x++, i += 4) {
      let a = hash2(x, y, seed);
      if (density < 1) a = a < density ? a / density : 0;
      if (soft) a = a * a;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tiles.set(key, c);
  return c;
}

/** Fill a rect with fine speckle. size = speckle size in units (1 ≈ one pixel at res 1). */
export function grain(ctx, x, y, w, h, { color = '#000000', alpha = 0.12, seed = 1, size = 1, density = 1, mode = 'source-over', soft = false } = {}) {
  const tile = grainTile(256, seed, color, density, soft);
  const pat = ctx.createPattern(tile, 'repeat');
  if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(size));
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = mode;
  ctx.fillStyle = pat;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** hair-thin fibres scattered over a sheet (paper, silk, bark) */
export function fibers(ctx, w, h, { n = 900, seed = 1, color = '#5a4526', alpha = 0.1, len = [8, 40], width = 0.6, curl = 0.5, angle = null, spread = Math.PI } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, L = r.range(len[0], len[1]);
    const a = angle == null ? r() * Math.PI : angle + (r() - 0.5) * spread;
    const c = (r() - 0.5) * curl * L;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * r());
    ctx.lineWidth = width * (0.5 + r());
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (Math.cos(a) * L) / 2 - Math.sin(a) * c, y + (Math.sin(a) * L) / 2 + Math.cos(a) * c, x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.stroke();
  }
  ctx.restore();
}

/** branching hairline cracks (stone, plaster, old paint) */
export function cracks(ctx, w, h, { n = 6, seed = 1, color = '#2a1c10', alpha = 0.5, width = 1.2, len = 300, branch = 0.25, wander = 0.5 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const grow = (x, y, a, L, wd, depth) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = Math.max(3, Math.round(L / 9));
    for (let i = 0; i < steps; i++) {
      a += (r() - 0.5) * wander;
      x += Math.cos(a) * 9;
      y += Math.sin(a) * 9;
      ctx.lineTo(x, y);
      if (depth < 3 && r() < branch * 0.12) {
        ctx.globalAlpha = alpha * (1 - i / steps * 0.6);
        ctx.lineWidth = wd;
        ctx.stroke();
        grow(x, y, a + r.sign() * r.range(0.5, 1.2), L * r.range(0.25, 0.5), wd * 0.65, depth + 1);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.globalAlpha = alpha * 0.8;
    ctx.lineWidth = wd * 0.8;
    ctx.stroke();
  };
  for (let i = 0; i < n; i++) grow(r() * w, r() * h, r() * Math.PI * 2, len * r.range(0.5, 1.4), width, 0);
  ctx.restore();
}

/** soft darkening toward the edges of a w×h rect */
export function vignette(ctx, w, h, strength = 0.35, color = '#000000', inner = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * inner, w / 2, h / 2, Math.hypot(w, h) * 0.56);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, strength));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * General-purpose aged sheet: base tone + broad mottling + fibres + speckle + a few stains + darker edges.
 * Returns a layer (w×h units at `res`). Tune the knobs (0..1) per substrate; see kit/ink.js for xuan paper.
 */
export function paper({ w = 1000, h = 1000, res = 1, base = '#ece2c9', seed = 1, mottle = 0.5, mottleColor = '#8a6f45', lightColor = '#fff8e6', fiber = 0.5, fiberColor = '#5a4526', speck = 0.5, stains = 0.3, stainColor = '#7a5a2c', edge = 0.3, edgeColor = '#4a3518' } = {}) {
  return layer(w, h, res, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    if (mottle > 0) {
      const dark = noiseLayer({ w, h, res: 0.25, scale: 260, oct: 4, seed: seed + 1, color: mottleColor, lo: 0.42, hi: 0.8, alpha: 0.38 * mottle });
      ctx.drawImage(dark, 0, 0, w, h);
      const light = noiseLayer({ w, h, res: 0.25, scale: 180, oct: 3, seed: seed + 2, color: lightColor, lo: 0.5, hi: 0.85, alpha: 0.45 * mottle });
      ctx.drawImage(light, 0, 0, w, h);
      const fine = noiseLayer({ w, h, res: 0.5, scale: 28, oct: 3, seed: seed + 3, color: mottleColor, lo: 0.45, hi: 0.9, alpha: 0.16 * mottle });
      ctx.drawImage(fine, 0, 0, w, h);
    }
    if (stains > 0) {
      const r = rng(seed + 9);
      for (let i = 0; i < Math.round(2 + stains * 8); i++) {
        const x = r() * w, y = r() * h, rad = r.range(60, 260);
        const g = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad);
        g.addColorStop(0, rgba(stainColor, 0.1 * stains));
        g.addColorStop(0.8, rgba(stainColor, 0.06 * stains));
        g.addColorStop(1, rgba(stainColor, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }
    if (fiber > 0) {
      fibers(ctx, w, h, { n: Math.round(1400 * fiber * (w * h) / 1e6), seed: seed + 4, color: fiberColor, alpha: 0.1 });
      fibers(ctx, w, h, { n: Math.round(900 * fiber * (w * h) / 1e6), seed: seed + 5, color: lightColor, alpha: 0.22, len: [10, 60] });
    }
    if (speck > 0) {
      grain(ctx, 0, 0, w, h, { color: fiberColor, alpha: 0.1 * speck, seed: seed + 6, size: 1 / res });
      grain(ctx, 0, 0, w, h, { color: '#ffffff', alpha: 0.1 * speck, seed: seed + 7, size: 1 / res });
    }
    if (edge > 0) vignette(ctx, w, h, edge * 0.5, edgeColor, 0.62);
  });
}
