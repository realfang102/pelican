// kit/ink — shared ink-painting toolkit for the five ink sections:
//   3 Han stone-relief rubbing · 4 Tang baimiao · 5 Song landscape · 6 Qingming scroll · 9 Bada Shanren
// It supplies what they have in common — the ground (xuan paper / aged silk), ink density, dry-brush streaks and
// ink bleed — and leaves each scene its own technique (rubbing, even outline, texture strokes, ruled line, splash).
//
// Two families of helper:
//   • p5.brush helpers (stroke, dabs, foliage) — call them inside K.bake(); they paint the static picture.
//   • Canvas 2D helpers (line, wash, bleed, mist, rubbingize) — for washes at init and for anything that moves.
// Ink layers are painted on WHITE and multiplied onto the ground, so thin ink stays transparent like the real thing.
import { layer, makeCanvas } from './canvas.js';
import { noiseLayer, grain, fibers, vignette } from './texture.js';
import { rng, noise1, noise2 } from './noise.js';
import { rgba, mix } from './color.js';
import { brushStroke, catmull, ribbon } from './stroke.js';
import { clamp, lerp } from './math.js';

// ------------------------------------------------------------------------------------------- ink density
/** the five ink tones 墨分五色: scorched, thick, heavy, pale, clear */
export const TONES = { jiao: '#0f0e0c', nong: '#24211d', zhong: '#47423b', dan: '#857e73', qing: '#bdb6a8' };
const ORDER = ['qing', 'dan', 'zhong', 'nong', 'jiao'];
/** ink colour for a density 0 (clearest) … 1 (scorched), or a tone name */
export function tone(d) {
  if (typeof d === 'string') return TONES[d] ?? d;
  const x = clamp(d) * (ORDER.length - 1), i = Math.min(ORDER.length - 2, Math.floor(x));
  return mix(TONES[ORDER[i]], TONES[ORDER[i + 1]], x - i);
}

// ------------------------------------------------------------------------------------------- grounds
/** raw xuan paper: warm white, long fibres, faint cloudy sizing. Returns a layer. */
export function xuan({ w = 1000, h = 1000, res = 1, seed = 1, base = '#efe7d3', age = 0.4 } = {}) {
  return layer(w, h, res, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(noiseLayer({ w, h, res: 0.25, scale: 300, oct: 4, seed: seed + 1, color: '#b89f6a', lo: 0.4, hi: 0.85, alpha: 0.3 * age + 0.06 }), 0, 0, w, h);
    ctx.drawImage(noiseLayer({ w, h, res: 0.25, scale: 200, oct: 3, seed: seed + 2, color: '#fffaf0', lo: 0.5, hi: 0.85, alpha: 0.5 }), 0, 0, w, h);
    ctx.drawImage(noiseLayer({ w, h, res: 0.5, scale: 34, oct: 3, seed: seed + 3, color: '#a08a5c', lo: 0.5, hi: 0.95, alpha: 0.1 + 0.1 * age }), 0, 0, w, h);
    fibers(ctx, w, h, { n: Math.round((w * h) / 520), seed: seed + 4, color: '#8a744a', alpha: 0.11, len: [14, 70], width: 0.55, curl: 0.8 });
    fibers(ctx, w, h, { n: Math.round((w * h) / 700), seed: seed + 5, color: '#fffdf4', alpha: 0.35, len: [20, 110], width: 0.7, curl: 0.9 });
    grain(ctx, 0, 0, w, h, { color: '#6b5836', alpha: 0.07, seed: seed + 6, size: 1 / res });
    if (age > 0) {
      const r = rng(seed + 9);
      for (let i = 0; i < 4 + age * 10; i++) {
        const x = r() * w, y = r() * h, rad = r.range(40, 220);
        const g = ctx.createRadialGradient(x, y, rad * 0.3, x, y, rad);
        g.addColorStop(0, rgba('#9a7a40', 0.07 * age));
        g.addColorStop(0.85, rgba('#9a7a40', 0.05 * age));
        g.addColorStop(1, rgba('#9a7a40', 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      vignette(ctx, w, h, 0.22 * age, '#5a4420', 0.6);
    }
  });
}

/** aged painting silk: darker tea-brown ground with vertical staining and old creases. Returns a layer. */
export function silk({ w = 1000, h = 1000, res = 1, seed = 1, base = '#c9b182' } = {}) {
  return layer(w, h, res, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(noiseLayer({ w, h, res: 0.25, scale: 360, oct: 4, seed: seed + 1, color: '#7d6238', lo: 0.4, hi: 0.85, alpha: 0.42 }), 0, 0, w, h);
    ctx.drawImage(noiseLayer({ w, h, res: 0.25, scale: 240, oct: 3, seed: seed + 2, color: '#e6d3a4', lo: 0.48, hi: 0.85, alpha: 0.5 }), 0, 0, w, h);
    // tide lines and damp streaks running down the scroll
    ctx.drawImage(noiseLayer({ w, h, res: 0.5, scale: 150, oct: 4, seed: seed + 3, color: '#5e4826', lo: 0.56, hi: 0.86, alpha: 0.3, stretch: [1, 0.07] }), 0, 0, w, h);
    ctx.drawImage(noiseLayer({ w, h, res: 0.5, scale: 46, oct: 3, seed: seed + 4, color: '#6b5430', lo: 0.5, hi: 0.95, alpha: 0.16 }), 0, 0, w, h);
    // creases from centuries of rolling: fine light cracks across the width
    const r = rng(seed + 5);
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const y = r() * h, x = r() * w, len = r.range(30, 260);
      ctx.strokeStyle = rgba(r() < 0.6 ? '#efe0b8' : '#4e3a1c', r.range(0.08, 0.22));
      ctx.lineWidth = r.range(0.4, 1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + r.range(-3, 3));
      ctx.stroke();
    }
    grain(ctx, 0, 0, w, h, { color: '#3e2e14', alpha: 0.1, seed: seed + 6, size: 1 / res });
    vignette(ctx, w, h, 0.3, '#3e2c12', 0.56);
  });
}

let weaveTile = null;
/**
 * Multiply a fine silk weave over a rect — call it LAST in render(), every frame. It is a pattern in unit space,
 * so it stays thread-sharp under a camera push-in where baked layers would go soft.
 */
export function weave(ctx, x, y, w, h, alpha = 0.5, pitch = 2.2) {
  if (!weaveTile) {
    weaveTile = makeCanvas(48, 48);
    const c = weaveTile.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 48, 48);
    const r = rng(77);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = `rgba(70,52,24,${0.1 + r() * 0.12})`;
      c.fillRect(0, i * 6 + 4, 48, 1.6);
      c.fillStyle = `rgba(70,52,24,${0.08 + r() * 0.1})`;
      c.fillRect(i * 6 + 4, 0, 1.6, 48);
    }
  }
  const pat = ctx.createPattern(weaveTile, 'repeat');
  pat.setTransform(new DOMMatrix().scale(pitch / 6));
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = pat;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- p5.brush helpers
// p5.brush composites its pending strokes every time the stroke COLOUR changes, and on software GL each composite
// costs milliseconds. A picture that alternates tones stroke by stroke (a tree: trunk, leaf, darker leaf, …) can
// therefore take minutes instead of seconds. So ink strokes are queued and drawn tone by tone:
//
//   await K.bake(opts, (brush) => {
//     const q = K.ink.batch(brush);
//     K.ink.stroke(q, pts, { tone: 'jiao' });   K.ink.tree(q, x, y, h);   K.ink.dabs(q, 3000, sampler, {...});
//     q.flush();                                 // palest ink first, darkest last
//   });
//
// Every helper below accepts either the raw p5.brush object (draws immediately) or a batch.
const qd = (d) => (typeof d === 'string' ? d : Math.round(clamp(d) * 8) / 8); // quantise densities → few colours

/** queue of ink strokes grouped by brush + tone; flush() paints them with one colour change per group */
export function batch(b) {
  const groups = new Map();
  return {
    isBatch: true,
    brush: b,
    add(brushName, d, cmd) {
      const key = brushName + '|' + qd(d);
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { brushName, color: tone(qd(d)), cmds: [] }));
      g.cmds.push(cmd);
    },
    get size() {
      let n = 0;
      for (const g of groups.values()) n += g.cmds.length;
      return n;
    },
    flush() {
      const lum = (c) => parseInt(c.slice(1, 3), 16);
      const list = [...groups.values()].sort((x, y) => lum(y.color) - lum(x.color));
      for (const g of list) {
        b.set(g.brushName, g.color, 1);
        for (const c of g.cmds) {
          b.strokeWeight(c.w);
          if (c.line) b.line(c.line[0], c.line[1], c.line[2], c.line[3]);
          else b.spline(c.pts, c.curve);
        }
      }
      groups.clear();
    },
  };
}
function emit(q, brushName, d, cmd) {
  if (q.isBatch) q.add(brushName, d, cmd);
  else {
    q.set(brushName, tone(qd(d)), cmd.w);
    if (cmd.line) q.line(cmd.line[0], cmd.line[1], cmd.line[2], cmd.line[3]);
    else q.spline(cmd.pts, cmd.curve);
  }
}

/**
 * One ink stroke through pts ([x,y] or [x,y,pressure]).
 *   o.brush 'ink' (pointed, wet) | 'inkFine' (even outline) | 'inkDry' (ragged flying-white) | any p5.brush name
 *   o.tone  density 0..1 or tone name      o.weight ('ink': belly ≈ 2.2 px × weight; 'inkFine': ≈ 1 px × weight)
 *   o.press [start, middle, end] pressures when the points carry none
 */
export function stroke(q, pts, o = {}) {
  const press = o.press ?? [0.7, 1.15, 0.5];
  const n = pts.length;
  const P = pts.map((p, i) => {
    if (p.length > 2) return p;
    const u = n > 1 ? i / (n - 1) : 0;
    return [p[0], p[1], u < 0.5 ? lerp(press[0], press[1], u * 2) : lerp(press[1], press[2], u * 2 - 1)];
  });
  const w = o.weight ?? 1;
  if (n === 2) emit(q, o.brush ?? 'ink', o.tone ?? 'nong', { w, line: [P[0][0], P[0][1], P[1][0], P[1][1]] });
  else emit(q, o.brush ?? 'ink', o.tone ?? 'nong', { w, pts: P, curve: o.curve ?? 0.5 });
}

/**
 * Texture strokes (皴 / 點): n short dabs placed by sampler(r) → [x, y, sizeMul?] | null (null = rejected).
 *   o.len [min,max]   o.angle direction in radians (π/2 = straight down: "raindrop" texture)   o.spread angular jitter
 *   o.tone / o.tones [[density, share], …]   o.weight   o.brush
 */
export function dabs(q, n, sampler, o = {}) {
  const r = rng(o.seed ?? 1);
  const tones = o.tones ?? [[o.tone ?? 'nong', 1]];
  const total = tones.reduce((s, t) => s + t[1], 0);
  const [l0, l1] = o.len ?? [5, 12];
  const ang = o.angle ?? Math.PI / 2, spread = o.spread ?? 0.25;
  const brushName = o.brush ?? 'ink', w = o.weight ?? 0.4;
  const own = q.isBatch ? null : batch(q);
  const dest = own ?? q;
  for (let i = 0; i < n; i++) {
    const p = sampler(r);
    if (!p) continue;
    let pick = r() * total, k = 0;
    while (k < tones.length - 1 && pick > tones[k][1]) pick -= tones[k++][1];
    const a = ang + (r() - 0.5) * 2 * spread, len = r.range(l0, l1) * (p[2] ?? 1);
    dest.add(brushName, tones[k][0], { w: w * (0.7 + 0.6 * r()), line: [p[0], p[1], p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len] });
  }
  if (own) own.flush();
}

/**
 * A tree in ink: crooked trunk, a few boughs, foliage as clustered dabs.
 *   kind 'dot' (pepper dots) | 'jie' (drooping 介-shaped leaf strokes) | 'pine' (needle fans) | 'bare'
 *   o.tone density, o.density foliage amount, o.crown crown radius per 100 units of height, o.boughs, o.lean, o.seed
 */
export function tree(q0, x, y, h, o = {}) {
  const own = q0.isBatch ? null : batch(q0);
  const q = own ?? q0;
  const r = rng(o.seed ?? Math.round(x * 13 + y * 7));
  const kind = o.kind ?? 'dot', lean = o.lean ?? (r() - 0.5) * 0.5, k = h / 100;
  const d = o.tone ?? 0.9;
  const top = [x + lean * h, y - h];
  const mid = [x + lean * h * 0.4 + (r() - 0.5) * 12 * k, y - h * 0.55];
  stroke(q, [[x, y], mid, top], { brush: 'ink', tone: d, weight: Math.max(0.9, 2.1 * k), press: [1.3, 1, 0.5] });
  stroke(q, [[x + 3 * k, y], [mid[0] + 3 * k, mid[1]], [top[0] + 1.5 * k, top[1] + 10 * k]], { brush: 'ink', tone: d - 0.125, weight: Math.max(0.6, 1.2 * k), press: [1.2, 0.9, 0.4] });
  const crowns = [];
  const nb = o.boughs ?? 3 + Math.floor(r() * 3);
  for (let i = 0; i < nb; i++) {
    const u = 0.45 + (i / nb) * 0.55, side = i % 2 ? 1 : -1;
    const bx = lerp(x, top[0], u) + (u < 0.55 ? mid[0] - lerp(x, top[0], 0.55) : 0), by = lerp(y, top[1], u);
    const ex = bx + side * r.range(18, 40) * k, ey = by - r.range(8, 26) * k;
    stroke(q, [[bx, by], [(bx + ex) / 2, by - 4 * k], [ex, ey]], { brush: 'ink', tone: d - 0.125, weight: Math.max(0.5, 0.95 * k), press: [1.1, 0.8, 0.4] });
    crowns.push([ex, ey]);
  }
  crowns.push([top[0], top[1]]);
  if (kind !== 'bare') {
    const R = (o.crown ?? 24) * k;
    for (const c of crowns) {
      const n = Math.round((o.density ?? 1) * (kind === 'pine' ? 9 : 22));
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * R;
        const px = c[0] + Math.cos(a) * rad * 1.25, py = c[1] + Math.sin(a) * rad * 0.8;
        const dd = d - (r() < 0.4 ? 0.25 : 0);
        if (kind === 'dot') {
          q.add('ink', dd, { w: r.range(1.1, 2.3) * Math.max(0.5, k), line: [px, py, px + r.range(-2, 2) * k, py + r.range(2.5, 5) * k] });
        } else if (kind === 'jie') {
          const w = r.range(0.8, 1.5) * Math.max(0.6, k);
          for (const sgn of [-1, 0, 1]) q.add('ink', dd, { w, line: [px, py, px + sgn * r.range(3, 6) * k, py + r.range(5, 9) * k] });
        } else {
          const w = r.range(0.8, 1.3) * Math.max(0.6, k);
          const base = -Math.PI / 2 + (r() - 0.5) * 0.6;
          for (let j = -3; j <= 3; j++) q.add('inkFine', dd, { w, line: [px, py, px + Math.cos(base + j * 0.22) * 11 * k, py + Math.sin(base + j * 0.22) * 11 * k] });
        }
      }
    }
  }
  if (own) own.flush();
}

// ------------------------------------------------------------------------------------------- Canvas 2D helpers
/**
 * Soft ink wash over a polygon (init-time: uses a blur). Paint into an ink layer that will be multiplied.
 *   d density 0..1 or tone, alpha strength, feather edge softness in units, mottle 0..1 uneven pooling
 */
export function wash(ctx, poly, d = 'dan', alpha = 0.35, { feather = 8, mottle = 0.5, seed = 1, smooth = true } = {}) {
  if (poly.length < 3) return;
  ctx.save();
  const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b); // blur is in device px: keep the feather constant in units
  ctx.filter = feather > 0 ? `blur(${feather * sc}px)` : 'none';
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = tone(d);
  const P = smooth ? catmull(poly, 4, true) : poly;
  ctx.beginPath();
  ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
  ctx.closePath();
  ctx.fill();
  if (mottle > 0) {
    // a second, smaller pass so the pigment pools unevenly
    const r = rng(seed);
    ctx.globalAlpha *= 0.5 * mottle;
    for (let i = 0; i < 5; i++) {
      const c = P[Math.floor(r() * P.length)], e = P[Math.floor(r() * P.length)];
      const cx = (c[0] + e[0]) / 2, cy = (c[1] + e[1]) / 2, rad = Math.hypot(c[0] - e[0], c[1] - e[1]) * r.range(0.15, 0.35) + 6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad, rad * r.range(0.4, 0.9), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Ink bleed (暈): run draw(ctx) twice — once blurred and pale as the halo the wet ink leaves in the paper, once crisp. */
export function bleed(ctx, draw, amount = 6, haloAlpha = 0.35) {
  ctx.save();
  const m = ctx.getTransform();
  ctx.filter = `blur(${amount * Math.hypot(m.a, m.b)}px)`;
  ctx.globalAlpha *= haloAlpha;
  draw(ctx);
  ctx.restore();
  draw(ctx);
}

/**
 * Mist: fade whatever is underneath back to bare ground along a wispy horizontal band.
 * On an ink layer destined for 'multiply' pass color '#ffffff'; on a finished picture pass the ground colour.
 */
export function mist(ctx, x, y, w, h, { color = '#ffffff', strength = 1, seed = 1, wisps = 0.5 } = {}) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.45, rgba(color, strength));
  g.addColorStop(0.7, rgba(color, strength));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (wisps > 0) {
    const n = noiseLayer({ w, h: h * 1.5, res: 0.5, scale: 110, oct: 4, seed, color, lo: 0.42, hi: 0.75, alpha: strength * wisps, stretch: [0.35, 1.6] });
    // feather the wisps out at top and bottom so the band has no edge
    const c = n.getContext('2d');
    c.globalCompositeOperation = 'destination-in';
    const f = c.createLinearGradient(0, 0, 0, n.height);
    f.addColorStop(0, 'rgba(0,0,0,0)');
    f.addColorStop(0.3, 'rgba(0,0,0,1)');
    f.addColorStop(0.75, 'rgba(0,0,0,1)');
    f.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = f;
    c.fillRect(0, 0, n.width, n.height);
    ctx.drawImage(n, x, y - h * 0.25, w, h * 1.5);
  }
  ctx.restore();
}

/**
 * Per-frame ink line for anything that moves. A thin wrapper over K.brushStroke with ink manners:
 *   o.style 'iron' even wire line · 'orchid' swelling orchid-leaf line · 'nail' nail-head-rat-tail (heavy entry, thin exit)
 *   o.d density, o.width, o.dry 0..1, o.seed
 */
export function line(ctx, pts, o = {}) {
  const style = o.style ?? 'orchid';
  const base = { width: o.width ?? 2.4, color: tone(o.d ?? 'nong'), alpha: o.alpha ?? 1, seed: o.seed ?? 1, dry: o.dry ?? 0, smooth: o.smooth, seg: o.seg };
  if (style === 'iron') brushStroke(ctx, pts, { ...base, taper: [0.03, 0.05], minW: 0.7, wobble: 0.06 });
  else if (style === 'nail') brushStroke(ctx, pts, { ...base, taper: [0.02, 0.85], minW: 0.1, wobble: 0.08, pressure: (u) => 1.25 - 0.4 * u });
  else brushStroke(ctx, pts, { ...base, taper: [0.22, 0.4], minW: 0.16, wobble: 0.14 });
}

/** Filled ink shape with a slightly uneven edge (per-frame safe: no blur). */
export function blot(ctx, poly, d = 'nong', alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = tone(d);
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Stone-rubbing texture (拓片). Takes a layer holding WHITE figures on transparent and returns a rubbing:
 * black inked paper where the stone was high, with the mottled, wrinkled, slightly starved look of ink dabbed
 * through paper — and the figures left as bare paper. Use for the Han relief section.
 */
export function rubbingize(src, { w = src.uw, h = src.uh, res = src.res ?? 1, seed = 1, paper = '#e8e0cc', ink = '#14120f', starve = 0.5 } = {}) {
  return layer(w, h, res, (ctx) => {
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, w, h);
    // the dabber never inks evenly: pale patches, pin-holes and fold lines in the black
    ctx.drawImage(noiseLayer({ w, h, res: 0.5, scale: 70, oct: 4, seed: seed + 1, color: paper, lo: 0.55, hi: 0.95, alpha: 0.3 * starve }), 0, 0, w, h);
    ctx.drawImage(noiseLayer({ w, h, res: 0.5, scale: 11, oct: 2, seed: seed + 2, color: paper, lo: 0.62, hi: 0.9, alpha: 0.5 * starve }), 0, 0, w, h);
    grain(ctx, 0, 0, w, h, { color: paper, alpha: 0.5 * starve, seed: seed + 3, size: 1.2 / res, density: 0.25 });
    const r = rng(seed + 4);
    ctx.strokeStyle = rgba(paper, 0.35);
    for (let i = 0; i < 9; i++) {
      ctx.lineWidth = r.range(0.5, 1.4);
      ctx.beginPath();
      const x = r() * w, y = r() * h, a = r() * Math.PI;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r.range(80, 420), y + Math.sin(a) * r.range(80, 420));
      ctx.stroke();
    }
    // figures: bare paper, with a little ink creeping in at the edges
    const fig = layer(w, h, res, (c) => {
      c.drawImage(src, 0, 0, w, h);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = paper;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'destination-out';
      c.drawImage(noiseLayer({ w, h, res: 0.5, scale: 9, oct: 2, seed: seed + 5, color: '#000', lo: 0.6, hi: 0.9, alpha: 0.5 }), 0, 0, w, h);
      grain(c, 0, 0, w, h, { color: '#000000', alpha: 0.55, seed: seed + 6, size: 1.3 / res, density: 0.2, mode: 'destination-out' });
    });
    ctx.drawImage(fig, 0, 0, w, h);
  });
}

export { ribbon, noise1, noise2 };
