// Intro — absurdity delivered with a straight face (5 s).
// A page from a solemn art-history volume: paper, serif type, a small engraved "Fig. 1" in the corner. Two lines fade
// in; the second lands on the strong beat at T = 3 s and the figure promptly pedals off the page into the first frame.
//
// The intro is not a framed picture: it is the wall-wide page to the left of section 1, drawn in WORLD coordinates
// (x < 0). render() receives film time T (seconds), and env.pose is already in world coordinates.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';

const INK = '#2a2118', SEPIA = '#5a4028';
const CX = -1080; // centre of the text block
const FIG_X = -420;
let L = null;

const hashName = (name) => {
  let h = 5;
  for (let i = 0; i < name.length; i++) h = (h * 33 + name.charCodeAt(i)) % 7919;
  return h;
};

/** the pelican as a copperplate figure: sepia outline, hatched shading */
function engraved(ctx, pose) {
  const s = pose.s;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of Rig.parts(pose)) {
    const seed = hashName(p.name);
    if (p.kind === 'poly') {
      ctx.fillStyle = p.role === 'saddle' || p.name.startsWith('pedal') ? SEPIA : '#efe6d0';
      K.path(ctx, p.pts, true);
      ctx.fill();
      const hatch = { wing: [0.5, 5], tail: [0.9, 4], pouch: [-0.5, 4.5], scarf: [1.2, 3], foot: [0.4, 3.5], body: [0.5, 9], neck: [0.2, 9] }[p.role];
      if (hatch) K.hatchPoly(ctx, p.pts, { angle: hatch[0], gap: hatch[1] * s, width: 0.8 * s, color: SEPIA, alpha: p.role === 'body' || p.role === 'neck' ? 0.42 : 0.75, seed });
      K.sketchLine(ctx, p.pts, { width: 1.9 * s, color: INK, alpha: 0.95, passes: 2, amp: 0.7 * s, seed, closed: true });
    } else if (p.kind === 'line') {
      if (p.role === 'mark') K.sketchLine(ctx, p.pts, { width: 1 * s, color: SEPIA, alpha: 0.8, passes: 1, amp: 0.5 * s, seed });
      else {
        ctx.strokeStyle = p.far ? '#8a7458' : INK;
        ctx.lineWidth = Math.max(1.2 * s, p.w * 0.5);
        K.path(ctx, p.pts);
        ctx.stroke();
        if (p.w > 5 * s) {
          ctx.strokeStyle = '#efe6d0';
          ctx.lineWidth = Math.max(0.6, p.w * 0.5 - 2.2 * s);
          ctx.stroke();
        }
      }
    } else if (p.kind === 'wheel') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.7 * s;
      ctx.beginPath();
      for (const [a, b] of Rig.spokes(p, 16)) {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
      for (const [rr, lw] of [[0.97, 1.6], [0.86, 1.1]]) {
        ctx.lineWidth = lw * s;
        ctx.beginPath();
        ctx.arc(p.c[0], p.c[1], p.r * rr, 0, K.TAU);
        ctx.stroke();
      }
      K.hatchPoly(ctx, K.ellipsePts(p.c[0], p.c[1], p.r * 0.97, p.r * 0.97, 36).concat(K.ellipsePts(p.c[0], p.c[1], p.r * 0.86, p.r * 0.86, 36).reverse()), { angle: p.a, gap: 3 * s, width: 0.7 * s, color: INK, alpha: 0.5, seed });
    } else if (p.kind === 'disc') {
      ctx.fillStyle = SEPIA;
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r, 0, K.TAU);
      ctx.fill();
    } else if (p.kind === 'eye') {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(p.pupil[0], p.pupil[1], p.pr, 0, K.TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

export default {
  id: 0, key: 'intro',
  async init() {
    // the page: 2100 × 1200 units covering x ∈ [-2100, 0], y ∈ [-100, 1100]
    const page = K.paper({ w: 2100, h: 1200, res: 1, base: '#ece2ca', seed: 12, mottle: 0.36, fiber: 0.6, stains: 0.4, edge: 0.5 });
    const ctx = page.getContext('2d');
    ctx.translate(2100, 100); // draw in world coordinates
    // the road as a printer's rule with fine ticks
    ctx.strokeStyle = K.rgba(INK, 0.85);
    ctx.lineWidth = 1.6;
    K.path(ctx, [[-2100, K.ROAD_Y + 0.8], [0, K.ROAD_Y + 0.8]]);
    ctx.stroke();
    ctx.lineWidth = 0.6;
    K.path(ctx, [[-2100, K.ROAD_Y + 5], [0, K.ROAD_Y + 5]]);
    ctx.stroke();
    // running head and folio, like any sober monograph
    K.text(ctx, 'THE PELICAN TEST', CX - 700, 96, { size: 22, font: K.FONT.serif, tracking: 6, color: K.rgba(INK, 0.75) });
    K.text(ctx, 'PLATE I', CX + 700, 96, { size: 22, font: K.FONT.serif, tracking: 6, color: K.rgba(INK, 0.75), align: 'right' });
    ctx.strokeStyle = K.rgba(INK, 0.5);
    ctx.lineWidth = 1;
    K.path(ctx, [[CX - 700, 112], [CX + 700, 112]]);
    ctx.stroke();
    K.text(ctx, '— 1 —', CX, 1004, { size: 22, font: K.FONT.serif, align: 'center', color: K.rgba(INK, 0.6) });
    // Fig. 1: plate mark and caption
    ctx.strokeStyle = K.rgba(SEPIA, 0.55);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(FIG_X - 196, 458, 392, 372);
    ctx.strokeStyle = K.rgba(SEPIA, 0.25);
    ctx.strokeRect(FIG_X - 204, 450, 408, 388);
    K.text(ctx, 'Fig. 1.  Pelican Riding a Bicycle (Reproduction).', FIG_X, 876, { size: 23, font: K.FONT.book, italic: true, align: 'center', color: INK });
    L = { page };
  },
  act(T, p) {
    // a still figure until it is time to leave: no pedalling bob, no wind
    const go = K.smoothstep(2.9, 3.5, T);
    p.bob = go;
    p.wind = Math.max(p.wind, 0) * go + 0.12 * (1 - go);
    p.lean = 0.07 * K.bump(T, 3.3, 0.3); // a small push-off
  },
  render(ctx, T, env) {
    ctx.drawImage(L.page, -2100, -100, 2100, 1200);
    const ink = (a) => K.rgba(INK, a);
    // line 1 (two rows) fades in to land on the first downbeat (T = 1 s)
    const a1 = K.ease.out2(K.prog(T, 0.45, 0.55));
    if (a1 > 0) {
      K.text(ctx, 'Humans have been obsessed with drawing pelicans', CX, 318, { size: 64, font: K.FONT.serif, align: 'center', color: ink(a1) });
      K.text(ctx, 'riding bicycles since ancient times.', CX, 402, { size: 64, font: K.FONT.serif, align: 'center', color: ink(a1) });
    }
    // line 2 lands on the strong beat at T = 3 s
    const a2 = K.ease.out3(K.prog(T, 2.72, 0.28));
    if (a2 > 0) {
      const settle = 1 + 0.035 * (1 - K.ease.out3(K.prog(T, 2.72, 0.5)));
      ctx.save();
      ctx.translate(CX, 520);
      ctx.scale(settle, settle);
      K.text(ctx, '— Long before the bicycle was invented.', 0, 0, { size: 54, font: K.FONT.serif, italic: true, align: 'center', color: ink(a2) });
      ctx.restore();
    }
    const a3 = K.ease.out2(K.prog(T, 3.25, 0.4));
    if (a3 > 0) {
      K.text(ctx, 'A Comprehensive History of Pelican Cycling in Art, Volume I', CX, 600, { size: 27, font: K.FONT.book, italic: true, align: 'center', color: ink(0.78 * a3) });
    }
    if (env.pose) engraved(ctx, env.pose);
  },
};
