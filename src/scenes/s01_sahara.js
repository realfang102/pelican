// Section 1 — Saharan Rock Art (c. 4000 BCE, Tassili n'Ajjer pastoral style)
// Ochre figures on a sandstone shelter wall. Herders and their cattle stop grazing to watch the pelican ride by.
//
// Technique: the rock is a 2D texture; every painted figure is a flat mineral-pigment silhouette (2D) worked over with
// p5.brush ('ochre', 'pastel') contours and rubbed-pigment hatching, baked on white and multiplied into the stone so
// the grain of the rock shows through the paint. Heads and pointing arms are separate baked sprites so they can turn.
// The pelican is repainted every frame as an ochre silhouette and then "weathered" by a flake mask anchored to the rock.
import { TITLES } from './titles.js';

const OCHRE = { red: '#7a2c16', deep: '#5c2413', brown: '#4d2a18', yellow: '#b07226', white: '#f2e4c6' };
const HEAD_CELL = 200; // head sprites: pivot at the cell centre
let L = null; // baked layers

// ---- figure geometry (local coords: x right = facing, y down, feet on y = 0) ---------------------------------
const COW_BODY = [[-92, -98], [-40, -104], [28, -117], [62, -119], [86, -106], [74, -72], [48, -52], [-30, -47], [-70, -54], [-97, -72]];
const COW_HEAD = [[-12, -10], [12, -17], [40, -8], [60, 3], [58, 14], [30, 17], [-2, 15]];
const COW_PIVOT = [78, -108];
const legs = (walk) => [
  [[58, -62], [61 + walk * 6, -30], [60 + walk * 10, 0]],
  [[38, -58], [36 - walk * 5, -30], [33 - walk * 8, 0]],
  [[-74, -64], [-86 - walk * 4, -34], [-80 - walk * 8, 0]],
  [[-56, -58], [-62 + walk * 5, -32], [-58 + walk * 9, 0]],
];
const TAIL = [[-94, -95], [-108, -74], [-106, -40], [-110, -16]];
const HORN_NEAR = [[10, -16], [2, -46], [14, -76], [32, -86]];
const HORN_FAR = [[16, -16], [32, -42], [34, -72], [20, -88]];

// herd: [x, groundY, scale, dir (+1 faces right), colour, kind, reaction order]
const COWS = [
  { x: 560, y: 318, k: 0.98, dir: -1, col: OCHRE.red, patch: true, walk: 0.3 },
  { x: 838, y: 290, k: 0.8, dir: 1, col: OCHRE.white, outline: true, walk: -0.2 },
  { x: 232, y: 512, k: 1.2, dir: 1, col: OCHRE.red, walk: 0.5 },
  { x: 498, y: 520, k: 0.86, dir: -1, col: OCHRE.yellow, walk: -0.4 },
  { x: 792, y: 522, k: 1.1, dir: 1, col: OCHRE.brown, bull: true, walk: 0.2 },
  { x: 655, y: 505, k: 0.5, dir: 1, col: OCHRE.red, calf: true, walk: 0.7 },
];
const HERDERS = [
  { x: 76, y: 505, k: 1.02, dir: 1, staff: true },
  { x: 372, y: 322, k: 0.84, dir: 1, bow: true },
  { x: 946, y: 512, k: 0.92, dir: -1, staff: true },
  { x: 700, y: 300, k: 0.62, dir: 1, child: true },
];

function xf(pts, f) {
  return pts.map(([x, y]) => [f.x + x * f.k * f.dir, f.y + y * f.k]);
}

export default {
  id: 1, key: 'sahara', title: TITLES[1], heroT: 3.3,

  async init(K) {
    const res = 1.2;
    // ------------------------------------------------------------------ the rock face
    const rock = K.layer(1000, 1000, res, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 300, 1000);
      g.addColorStop(0, '#d2a068');
      g.addColorStop(0.5, '#c58f58');
      g.addColorStop(1, '#a8703f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1000, 1000);
      // broad mineral variation
      ctx.drawImage(K.noiseLayer({ scale: 420, oct: 4, seed: 11, color: '#e7c08a', lo: 0.45, hi: 0.8, alpha: 0.75, res: 0.25 }), 0, 0, 1000, 1000);
      ctx.drawImage(K.noiseLayer({ scale: 300, oct: 4, seed: 12, color: '#9a5a30', lo: 0.5, hi: 0.85, alpha: 0.5, res: 0.25 }), 0, 0, 1000, 1000);
      ctx.drawImage(K.noiseLayer({ scale: 90, oct: 4, seed: 13, color: '#7e4a26', lo: 0.52, hi: 0.9, alpha: 0.28, res: 0.5 }), 0, 0, 1000, 1000);
      // desert-varnish water streaks running down from the overhang
      ctx.drawImage(K.noiseLayer({ scale: 120, oct: 4, seed: 14, color: '#4a2c1a', lo: 0.56, hi: 0.86, alpha: 0.5, res: 0.5, stretch: [1, 0.09] }), 0, 0, 1000, 1000);
      const top = ctx.createLinearGradient(0, 0, 0, 240);
      top.addColorStop(0, 'rgba(52,30,16,0.5)');
      top.addColorStop(1, 'rgba(52,30,16,0)');
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, 1000, 240);
      // bedding planes: faint horizontal strata
      ctx.drawImage(K.noiseLayer({ scale: 160, oct: 3, seed: 15, color: '#f0d2a0', lo: 0.55, hi: 0.8, alpha: 0.3, res: 0.5, stretch: [0.08, 1.6] }), 0, 0, 1000, 1000);
      // pits and grit
      K.grain(ctx, 0, 0, 1000, 1000, { color: '#3a2212', alpha: 0.2, seed: 3, size: 1.1 });
      K.grain(ctx, 0, 0, 1000, 1000, { color: '#fff0d0', alpha: 0.16, seed: 4, size: 1.6, density: 0.5 });
      K.stipple(ctx, 900, (r) => [r() * 1000, r() * 1000, r.range(0.6, 2.6)], { color: '#3c2414', alpha: 0.35, seed: 5 });
      K.cracks(ctx, 1000, 1000, { n: 9, seed: 6, color: '#2e1a0e', alpha: 0.55, width: 1.5, len: 380, branch: 0.5 });
      K.cracks(ctx, 1000, 1000, { n: 14, seed: 7, color: '#f6ddb0', alpha: 0.22, width: 1, len: 160, branch: 0.2 });

      // ---- the road: a natural ledge where one bed of sandstone steps out over the next
      const ry = K.ROAD_Y;
      const lip = [];
      for (let x = -10; x <= 1010; x += 10) lip.push([x, ry + 5 + (K.noise1(x * 0.011, 31) - 0.5) * 7 + (x < 90 || x > 910 ? 0 : (K.noise1(x * 0.05, 32) - 0.5) * 5)]);
      // shadowed under-bed
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lip[0][0], lip[0][1]);
      for (const p of lip) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(1010, 1010);
      ctx.lineTo(-10, 1010);
      ctx.closePath();
      ctx.clip();
      const ug = ctx.createLinearGradient(0, ry, 0, 1000);
      ug.addColorStop(0, 'rgba(48,26,12,0.78)');
      ug.addColorStop(0.07, 'rgba(70,40,20,0.46)');
      ug.addColorStop(0.3, 'rgba(96,56,28,0.3)');
      ug.addColorStop(1, 'rgba(60,34,16,0.5)');
      ctx.fillStyle = ug;
      ctx.fillRect(0, ry - 10, 1000, 220);
      ctx.drawImage(K.noiseLayer({ w: 1000, h: 200, scale: 70, oct: 4, seed: 18, color: '#2a160a', lo: 0.45, hi: 0.85, alpha: 0.5, res: 0.5, stretch: [0.3, 1.5] }), 0, ry, 1000, 200);
      ctx.restore();
      // sunlit top edge of the ledge
      ctx.strokeStyle = 'rgba(250,224,176,0.75)';
      ctx.lineWidth = 2.2;
      K.spline(ctx, lip.map(([x, y]) => [x, y - 3]));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(40,20,8,0.85)';
      ctx.lineWidth = 2.6;
      K.spline(ctx, lip.map(([x, y]) => [x, y + 1]));
      ctx.stroke();
      K.vignette(ctx, 1000, 1000, 0.34, '#2a1608', 0.5);
    });

    // flake mask: where paint has weathered off (alpha = paint lost). Anchored to the rock.
    const flake = K.layer(1000, 1000, 1, (ctx) => {
      ctx.drawImage(K.noiseLayer({ scale: 26, oct: 3, seed: 41, color: '#000', lo: 0.6, hi: 0.78, alpha: 0.85, res: 0.5 }), 0, 0, 1000, 1000);
      ctx.drawImage(K.noiseLayer({ scale: 150, oct: 4, seed: 42, color: '#000', lo: 0.66, hi: 0.8, alpha: 0.55, res: 0.25 }), 0, 0, 1000, 1000);
      K.grain(ctx, 0, 0, 1000, 1000, { color: '#000000', alpha: 0.45, seed: 43, size: 1.5, density: 0.35 });
    });

    // ------------------------------------------------------------------ painted figures (static parts)
    const dark = K.layer(1000, 1000, res); // ochre silhouettes (multiplied)
    const light = K.layer(1000, 1000, res); // kaolin white (normal blend)
    const dctx = dark.getContext('2d'), lctx = light.getContext('2d');
    const limb = (ctx, pts, w0, w1, col) => {
      ctx.fillStyle = col;
      K.ribbon(ctx, K.catmull(pts, 5), (u) => K.lerp(w0, w1, u), col);
    };
    for (const c of COWS) {
      const ctx = c.outline ? lctx : dctx;
      const col = c.col;
      if (c.outline) {
        // white-outline cattle: contour only, with a dotted hide
        ctx.strokeStyle = col;
        ctx.lineWidth = 5 * c.k;
        ctx.lineJoin = 'round';
        K.spline(ctx, xf(COW_BODY, c), true);
        ctx.stroke();
        for (const lg of legs(c.walk)) limb(ctx, xf(lg, c), 8 * c.k, 4 * c.k, col);
        limb(ctx, xf(TAIL, c), 4 * c.k, 2 * c.k, col);
        K.stipple(ctx, 60, (r) => [c.x + r.range(-70, 55) * c.k * c.dir, c.y + r.range(-98, -58) * c.k, 3 * c.k], { color: col, alpha: 0.95, seed: 71 });
      } else {
        K.fillPoly(ctx, xf(COW_BODY, c), col, true);
        for (const lg of legs(c.walk)) limb(ctx, xf(lg, c), (c.bull ? 12 : 10) * c.k, 5 * c.k, col);
        limb(ctx, xf(TAIL, c), 5 * c.k, 2.5 * c.k, col);
        K.fillPoly(ctx, xf([[-116, -22], [-104, -18], [-104, -4], [-114, -2]], c), col, true);
        if (!c.calf && !c.bull) K.fillPoly(ctx, xf([[-52, -50], [-40, -40], [-28, -50]], c), col, true);
        if (c.patch) {
          // piebald: kaolin patches over the ochre
          for (const [px, py, rx, ry] of [[-40, -82, 26, 16], [22, -90, 20, 13], [-74, -70, 12, 12]]) {
            K.fillPoly(lctx, K.jitter(K.ellipsePts(c.x + px * c.k * c.dir, c.y + py * c.k, rx * c.k, ry * c.k, 20), 3, 0.2, 9 + px), OCHRE.white, true);
          }
        }
      }
    }
    for (const h of HERDERS) {
      const col = OCHRE.deep, s = h.child ? 0.9 : 1;
      const P = (x, y) => [h.x + x * h.k * h.dir, h.y + y * h.k];
      // legs (long, slightly bent), torso, round head
      limb(dctx, [P(-3, -78 * s), P(-10, -40 * s), P(-14, 0)], 9 * h.k, 5 * h.k, col);
      limb(dctx, [P(3, -78 * s), P(12, -40 * s), P(10, 0)], 9 * h.k, 5 * h.k, col);
      K.fillPoly(dctx, [P(-12, -128 * s), P(12, -128 * s), P(8, -100 * s), P(9, -76 * s), P(-9, -76 * s), P(-8, -100 * s)], col, true);
      K.fillPoly(dctx, [P(-12, -80 * s), P(12, -80 * s), P(16, -62 * s), P(-16, -62 * s)], col); // loincloth flare
      K.fillPoly(dctx, K.ellipsePts(...P(1, -143 * s), 10.5 * h.k, 11.5 * h.k, 18), col, true);
      // resting arm with staff or bow (the other arm is animated)
      limb(dctx, [P(-9, -124 * s), P(-20, -104 * s), P(-22, -88 * s)], 6 * h.k, 4 * h.k, col);
      if (h.staff) limb(dctx, [P(-23, -168), P(-22, -80), P(-21, 2)], 3.4 * h.k, 3 * h.k, col);
      if (h.bow) {
        dctx.strokeStyle = col;
        dctx.lineWidth = 3 * h.k;
        K.spline(dctx, [P(-20, -150), P(-38, -112), P(-36, -80), P(-18, -44)]);
        dctx.stroke();
        dctx.lineWidth = 1.2 * h.k;
        K.path(dctx, [P(-20, -150), P(-18, -44)]);
        dctx.stroke();
      }
      if (!h.child) {
        // feather headdress
        for (const a of [-0.5, -0.1, 0.3]) limb(lctx, [P(1 + a * 6, -153), P(a * 22 - 4, -172)], 3.2 * h.k, 1.2 * h.k, OCHRE.white);
        // white beads / body paint
        K.stipple(lctx, 7, (r, i) => P(r.range(-6, 6), -122 + r.range(-3, 3)), { color: OCHRE.white, alpha: 0.95, size: [1.6 * h.k, 2.4 * h.k], seed: 51 + h.x });
      }
    }
    // negative hand stencils blown with ochre (top right)
    for (const [hx, hy, a, s] of [[905, 118, -0.25, 1], [828, 92, 0.2, 0.9], [958, 205, 0.45, 0.8]]) {
      dctx.save();
      dctx.translate(hx, hy);
      dctx.rotate(a);
      dctx.scale(s, s);
      const g = dctx.createRadialGradient(0, -6, 12, 0, -6, 62);
      g.addColorStop(0, 'rgba(122,44,22,0.95)');
      g.addColorStop(0.6, 'rgba(122,44,22,0.55)');
      g.addColorStop(1, 'rgba(122,44,22,0)');
      dctx.fillStyle = g;
      dctx.fillRect(-70, -76, 140, 140);
      dctx.globalCompositeOperation = 'destination-out';
      dctx.fillStyle = '#000';
      dctx.beginPath();
      dctx.ellipse(0, 6, 15, 18, 0, 0, K.TAU);
      dctx.fill();
      for (const [fa, fl, fw] of [[-0.62, 30, 5], [-0.24, 38, 5], [0.06, 40, 5], [0.34, 35, 4.6], [1.05, 24, 5.5]]) {
        dctx.save();
        dctx.rotate(fa);
        dctx.beginPath();
        dctx.roundRect(-fw / 2, -fl - 8, fw, fl, fw / 2);
        dctx.fill();
        dctx.restore();
      }
      dctx.restore();
    }
    // a faint frieze of small running hunters and antelope under the ledge — an older, darker layer
    for (let i = 0; i < 9; i++) {
      const x = 70 + i * 104 + (K.hash1(i * 7) - 0.5) * 30, y = 918 + (K.hash1(i * 13) - 0.5) * 30, k = 0.3 + K.hash1(i * 5) * 0.08;
      const f = { x, y, k, dir: 1 };
      dctx.globalAlpha = 0.75;
      if (i % 3 === 1) {
        K.fillPoly(dctx, xf(COW_BODY.map(([a, b]) => [a * 0.8, b]), f), OCHRE.brown, true);
        for (const lg of legs(1.4)) limb(dctx, xf(lg, f), 3, 1.6, OCHRE.brown);
        limb(dctx, xf([[60, -112], [78, -150], [70, -176]], f), 2.2, 1, OCHRE.brown);
        limb(dctx, xf([[64, -112], [92, -140], [96, -168]], f), 2.2, 1, OCHRE.brown);
      } else {
        const P = (px, py) => [x + px * k, y + py * k];
        limb(dctx, [P(0, -78), P(-26, -44), P(-46, -8)], 3, 1.6, OCHRE.brown);
        limb(dctx, [P(0, -78), P(26, -50), P(44, -30)], 3, 1.6, OCHRE.brown);
        limb(dctx, [P(-6, -78), P(8, -132)], 4.2, 3.2, OCHRE.brown);
        limb(dctx, [P(6, -124), P(34, -134), P(58, -120)], 2.4, 1.4, OCHRE.brown);
        K.fillPoly(dctx, K.ellipsePts(...P(12, -146), 4, 4.4, 10), OCHRE.brown);
      }
      dctx.globalAlpha = 1;
    }

    // the dotted trail of kaolin spots along the ledge (a painted "road")
    for (let x = 14; x < 1000; x += 23) {
      const y = K.ROAD_Y + 24 + (K.noise1(x * 0.02, 61) - 0.5) * 6;
      K.fillPoly(lctx, K.jitter(K.ellipsePts(x, y, 4.6, 3.6, 12), 1, 0.5, x), OCHRE.white, true);
    }

    // weather both pigment layers with the rock-anchored flake mask
    for (const c of [dctx, lctx]) {
      c.globalCompositeOperation = 'destination-out';
      c.drawImage(flake, 0, 0, 1000, 1000);
      c.globalCompositeOperation = 'source-over';
    }
    // title, painted on the rock in ochre — only lightly pitted so it stays easy to read
    const titleLay = K.layer(1000, 260, res, (c) => {
      K.titleBlock(c, TITLES[1], 56, 50, { color: OCHRE.deep, zh: { size: 54, weight: 900 }, en: { size: 30, font: K.FONT.serif, weight: 700 }, date: { size: 25, weight: 700, italic: false }, gap: 1.28 });
      K.grain(c, 0, 0, 1000, 260, { color: '#000000', alpha: 0.5, seed: 47, size: 1.3, density: 0.22, mode: 'destination-out' });
    });
    dctx.drawImage(titleLay, 0, 0, 1000, 260);

    // ---- p5.brush pass: finger-drawn contours and rubbed-pigment texture over the silhouettes
    const brushed = await K.bake({ w: 1000, h: 1000, res, bg: '#ffffff', seed: 101 }, (b) => {
      const r = K.rng(77);
      for (const c of COWS) {
        if (c.outline) continue;
        const body = xf(COW_BODY, c);
        b.set('ochre', K.shade(c.col, -0.25), 2.6 * c.k);
        const pts = K.catmull(body, 3, true);
        const seg = Math.floor(pts.length / 3);
        for (let s = 0; s < 3; s++) b.spline(pts.slice(s * seg, (s + 1) * seg + 2).map((p) => [p[0], p[1], r.range(0.7, 1.2)]), 0.5);
        // rubbed pigment: short strokes following the back
        b.set('pastel', c.col, 1.6 * c.k);
        for (let i = 0; i < 26; i++) {
          const x0 = r.range(-84, 40), y0 = r.range(-100, -58), len = r.range(18, 44);
          b.line(c.x + x0 * c.k * c.dir, c.y + y0 * c.k, c.x + (x0 + len) * c.k * c.dir, c.y + (y0 + r.range(-5, 3)) * c.k);
        }
      }
      for (const h of HERDERS) {
        b.set('ochre', K.shade(OCHRE.deep, -0.2), 1.9 * h.k);
        b.spline([[h.x - 3 * h.dir * h.k, h.y - 128 * h.k, 1], [h.x - 2 * h.dir * h.k, h.y - 90 * h.k, 1.2], [h.x - 10 * h.dir * h.k, h.y - 40 * h.k, 0.9], [h.x - 14 * h.dir * h.k, h.y, 0.6]], 0.5);
      }
      // loose pigment smears and an older, abandoned sketch line or two
      b.set('pastel', OCHRE.red, 2);
      for (let i = 0; i < 16; i++) {
        const x = r.range(40, 960), y = r.range(210, 760);
        b.line(x, y, x + r.range(-30, 30), y + r.range(-10, 10));
      }
      b.set('charcoal', '#3a2416', 1.2);
      b.spline([[610, 150, 0.6], [680, 120, 1], [760, 150, 0.8], [790, 205, 0.5]], 0.6);
      b.spline([[640, 160, 0.5], [650, 200, 0.8], [644, 232, 0.4]], 0.5);
    });

    const base = K.layer(1000, 1000, res, (ctx) => {
      K.put(ctx, rock);
      K.putBlend(ctx, dark, 'multiply', 0.94);
      K.putBlend(ctx, brushed, 'multiply', 0.8);
      K.putBlend(ctx, light, 'source-over', 0.86);
    });

    // ---- head and arm sprites (pivot at the cell centre, facing right; white ground so they can be multiplied in)
    const C = HEAD_CELL;
    const headDark = K.layer(C * COWS.length, C, 1.6, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, C * COWS.length, C);
    });
    const headLight = K.layer(C * COWS.length, C, 1.6);
    const hd = headDark.getContext('2d'), hl = headLight.getContext('2d');
    COWS.forEach((c, i) => {
      const ox = i * C + C / 2, oy = C / 2, k = c.k;
      const T = (pts) => pts.map(([x, y]) => [ox + x * k, oy + y * k]);
      const col = c.col;
      if (c.outline) {
        hl.strokeStyle = col;
        hl.lineWidth = 4.4 * k;
        hl.lineJoin = 'round';
        K.spline(hl, T(COW_HEAD), true);
        hl.stroke();
        limb(hl, T(HORN_NEAR), 5 * k, 1.4 * k, col);
        limb(hl, T(HORN_FAR), 5 * k, 1.4 * k, col);
      } else {
        K.fillPoly(hd, T(COW_HEAD), col, true);
        K.fillPoly(hd, T([[-2, -14], [-22, -24], [-8, -6]]), col, true); // ear
        if (!c.calf) {
          limb(hd, T(c.bull ? [[10, -16], [-6, -34], [6, -62], [30, -66]] : HORN_NEAR), 6 * k, 1.5 * k, col);
          limb(hd, T(c.bull ? [[16, -16], [36, -30], [44, -54], [34, -70]] : HORN_FAR), 6 * k, 1.5 * k, col);
        } else {
          limb(hd, T([[10, -16], [8, -26]]), 4 * k, 2 * k, col);
        }
        if (c.patch) K.fillPoly(hl, K.jitter(K.ellipsePts(ox + 30 * k, oy + 2 * k, 12 * k, 8 * k, 14), 2, 0.3, 3), OCHRE.white, true);
        // eye: a spot of bare rock
        hd.fillStyle = '#ffffff';
        hd.beginPath();
        hd.arc(ox + 22 * k, oy - 3 * k, 2.6 * k, 0, K.TAU);
        hd.fill();
      }
      // neck stump so the turning head stays joined to the shoulders
      if (!c.outline) K.fillPoly(hd, T([[-14, -12], [4, -16], [6, 16], [-16, 12]]), col, true);
    });
    // speckle the sprites so they read as the same weathered paint
    K.grain(hd, 0, 0, C * COWS.length, C, { color: '#ffffff', alpha: 0.5, seed: 44, size: 1.4, density: 0.3 });
    K.grain(hl, 0, 0, C * COWS.length, C, { color: '#000000', alpha: 0.6, seed: 45, size: 1.4, density: 0.3, mode: 'destination-out' });

    const arm = K.layer(80, 24, 2, (ctx) => {
      // pointing arm: pivot at (8, 12), pointing +x
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 80, 24);
      K.ribbon(ctx, [[8, 12], [34, 13.5], [58, 12], [66, 11]], (u) => K.lerp(7, 3.6, u), OCHRE.deep);
      K.grain(ctx, 0, 0, 80, 24, { color: '#ffffff', alpha: 0.5, seed: 46, size: 1.3, density: 0.3 });
    });

    L = { base, flake, headDark, headLight, arm, buf: K.makeCanvas(460, 460), bufRes: 1.2 };
  },

  render(ctx, t, env) {
    const { K, pose } = env;
    K.put(ctx, L.base);

    // where the watchers look: the pelican's chest (or the frame it will come from / has left through)
    const px = pose ? pose.pt.shoulder[0] : env.rider.lx, py = pose ? pose.pt.shoulder[1] : 620;
    const seen = t > 0 && t < 9;

    // ---- cattle heads: grazing → snap up one by one → track the pelican → drift back to grazing
    COWS.forEach((c, i) => {
      const piv = [c.x + COW_PIVOT[0] * c.k * c.dir, c.y + COW_PIVOT[1] * c.k];
      const react = 0.25 + (piv[0] / 1000) * 1.15; // nearer the left frame = earlier
      const up = K.ease.outBack(K.prog(t, react, 0.32), 2.2) * (1 - K.ease.io2(K.prog(t, 8.2 + i * 0.25, 1.2)));
      const graze = 0.62 + 0.07 * Math.sin(t * 2.2 + i * 1.7) + 0.04 * Math.sin(t * 5.1 + i);
      // desired angle toward the pelican, in the cow's own facing frame
      let look = Math.atan2(py - piv[1], (px - piv[0]) * c.dir);
      look = K.clamp(look, -0.5, 1.15);
      const startle = -0.22 * K.bump(t, react + 0.12, 0.14);
      const a = K.lerp(graze, look + startle, K.clamp(up, 0, 1.15));
      for (const [sprite, mode, alpha] of [[L.headDark, 'multiply', 0.94], [L.headLight, 'source-over', 0.86]]) {
        ctx.save();
        ctx.translate(piv[0], piv[1]);
        ctx.scale(c.dir, 1);
        ctx.rotate(a);
        ctx.globalCompositeOperation = mode;
        ctx.globalAlpha = alpha;
        const r = sprite.res;
        ctx.drawImage(sprite, i * HEAD_CELL * r, 0, HEAD_CELL * r, HEAD_CELL * r, -HEAD_CELL / 2, -HEAD_CELL / 2, HEAD_CELL, HEAD_CELL);
        ctx.restore();
      }
    });

    // ---- herders: the free arm shoots out on the downbeat of bar 2 and follows the pelican
    HERDERS.forEach((h, i) => {
      const s = h.child ? 0.9 : 1;
      const sh = [h.x + 9 * h.k * h.dir, h.y - 124 * s * h.k];
      const rest = 1.25; // hanging at the side
      const go = h.child ? 0.9 : 2.0 + i * 0.06;
      const up = K.ease.outBack(K.prog(t, go, 0.22), 2.6) * (1 - K.ease.io2(K.prog(t, 8.6 + i * 0.3, 1)));
      let aim = Math.atan2(py - 40 - sh[1], (px - sh[0]) * h.dir);
      aim = K.clamp(aim, -1.2, 1.3);
      const wobble = h.child ? 0.35 * Math.sin(t * 16) * K.gate(t, 0.9, 5.5, 0.2, 1) : 0;
      const a = K.lerp(rest, aim + wobble, K.clamp(up, 0, 1.2));
      ctx.save();
      ctx.translate(sh[0], sh[1]);
      ctx.scale(h.dir * h.k, h.k);
      ctx.rotate(a);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.94;
      ctx.drawImage(L.arm, -8, -12, 80, 24);
      ctx.restore();
    });

    // ---- the pelican: ochre silhouette with kaolin beak-pouch, wing and eye, weathered by the rock
    if (pose) {
      const R = L.bufRes, buf = L.buf, bw = buf.width / R, bh = buf.height / R;
      const bx = pose.x - bw / 2 + 4, by = pose.y - bh + 60;
      const b = buf.getContext('2d');
      for (const pass of ['dark', 'light']) {
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.globalCompositeOperation = 'source-over';
        b.clearRect(0, 0, buf.width, buf.height);
        b.setTransform(R, 0, 0, R, -bx * R, -by * R);
        if (pass === 'dark') {
          env.Rig.drawSilhouette(b, pose, OCHRE.red, { grow: 0.6 });
          // bare-rock eye
          b.globalCompositeOperation = 'destination-out';
          b.beginPath();
          b.arc(pose.eye.c[0], pose.eye.c[1], pose.eye.r * 0.7, 0, K.TAU);
          b.fill();
        } else {
          b.fillStyle = OCHRE.white;
          K.path(b, pose.shapes.pouch, true);
          b.fill();
          b.strokeStyle = OCHRE.white;
          b.lineCap = 'round';
          b.lineWidth = 3.4 * pose.s;
          for (const m of pose.shapes.wingMarks) {
            K.path(b, m);
            b.stroke();
          }
          // dotted necklace and wheel rims picked out in white
          for (const w of pose.wheels) {
            for (let k = 0; k < 10; k++) {
              const a = w.a + (k / 10) * K.TAU;
              b.beginPath();
              b.arc(w.c[0] + Math.cos(a) * w.r * 0.62, w.c[1] + Math.sin(a) * w.r * 0.62, 2.4 * pose.s, 0, K.TAU);
              b.fill();
            }
          }
        }
        b.globalCompositeOperation = 'destination-out';
        b.drawImage(L.flake, 0, 0, 1000, 1000);
        ctx.save();
        ctx.globalCompositeOperation = pass === 'dark' ? 'multiply' : 'source-over';
        ctx.globalAlpha = pass === 'dark' ? 0.96 : 0.9;
        ctx.drawImage(buf, bx, by, bw, bh);
        ctx.restore();
      }
    }
  },
};
