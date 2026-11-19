// Section 16 — 8-Bit Pixel Game (1980s)
// A side-scrolling platformer level on an imaginary 8-bit console: the whole picture is a 250 × 250 pixel frame
// (4 units per pixel) in a fixed 16-colour palette, blitted with hard nearest-neighbour pixels. Dusk sky in dithered
// bands, stepped hills, a windmill, stone ruins, a cobbled road on checker-brick ground with a pit of water in the
// middle and a square-holed coin spinning over it. The pelican is a pixel sprite rasterised from the pose each tick
// (palette-snapped, dark outline, 12 updates/s). Gag: it jumps the pit, takes the coin at the apex on beat 2.5,
// lands, and "1UP" pops on 3.0. The stage banner hanging from the HUD carries the title.
//
// Technique: everything is drawn into a 250×250 canvas with integer fillRects (own Bresenham for lines, own 5×7
// bitmap font for the HUD, Unifont 16 px thresholded to 1-bit for the banner), then scaled ×4 without smoothing.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

let L = null;
const N = 250, PX = 4;
const PAL = {
  ink: '#0b0b1e', indigo: '#23194a', purple: '#4a2a78', magenta: '#8a3a8c', pink: '#d8587a', orange: '#f59a5a',
  yellow: '#ffd86a', white: '#fff4e0', lgrey: '#9aa0b8', slate: '#5a5f80', teal: '#2e6a5a', green: '#4fa060',
  brick: '#b84a2e', dbrick: '#6e2e2a', water: '#3a7ad8', red: '#c8202a',
};
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SPRITE_PAL = [PAL.white, PAL.lgrey, PAL.orange, PAL.yellow, PAL.red, PAL.ink].map(hexRGB);
const INK = hexRGB(PAL.ink);

// level geometry (pixels)
const ROAD = 200; // pixel row of the road (y = 800 units)
const GAP0 = 106, GAP1 = 130; // pit columns [GAP0, GAP1)
const G = ((GAP0 + GAP1) / 2) * PX; // pit centre in units (472)
// jump: take-off, apex, landing (section-local seconds)
const T0 = 2.05, TA = 2.5, T1 = 2.95, JH = 100;
const COIN = [123, 111]; // coin centre (px)
const ONEUP = 3.0;

// ------------------------------------------------------------------------------------------- 5×7 bitmap font
const F57 = {
  '0': '.###.#...##..###.#.###..##...#.###.', '1': '..#...##....#....#....#....#...###.', '2': '.###.#...#....#..##..#...#....#####',
  '3': '####.....#....#.###.....#....#####.', '4': '...#...##..#.#.#..#.#####...#....#.', '5': '######....####.....#....##...#.###.',
  '6': '..##..#...#....####.#...##...#.###.', '7': '#####....#...#...#...#....#....#...', '8': '.###.#...##...#.###.#...##...#.###.',
  '9': '.###.#...##...#.####....#...#..##..', S: '.#####....#.....###.....#....#####.', C: '.###.#...##....#....#....#...#.###.',
  O: '.###.#...##...##...##...##...#.###.', R: '####.#...##...#####.#.#..#..#.#...#', E: '######....#....####.#....#....#####',
  T: '#####..#....#....#....#....#....#..', I: '.###...#....#....#....#....#...###.', M: '#...###.###.#.##.#.##...##...##...#',
  U: '#...##...##...##...##...##...#.###.', P: '####.#...##...#####.#....#....#....', x: '..........#...#.#.#...#...#.#.#...#',
  ' ': '...................................', '+': '.......#....#..#####..#....#.......',
};
function glyphs(ctx, str, x, y, col, scale = 1, shadow = null) {
  const draw = (ox, oy, c) => {
    ctx.fillStyle = c;
    let cx = ox;
    for (const ch of str) {
      const g = F57[ch];
      if (g) for (let i = 0; i < 35; i++) if (g[i] === '#') ctx.fillRect(cx + (i % 5) * scale, oy + Math.floor(i / 5) * scale, scale, scale);
      cx += 6 * scale;
    }
  };
  if (shadow) draw(x + scale, y + scale, shadow);
  draw(x, y, col);
  return str.length * 6 * scale;
}

/** Unifont text thresholded to 1-bit → cropped canvas */
function bitText(str, color, size = 16) {
  const w = Math.ceil(str.length * size) + 4, h = size + 4;
  const c = K.makeCanvas(w, h), g = c.getContext('2d');
  g.font = `${size}px ${K.FONT.pixel}`;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffffff';
  g.fillText(str, 0, Math.round(size * 0.875));
  const id = g.getImageData(0, 0, w, h), d = id.data, [r, gg, b] = hexRGB(color);
  let maxX = 0;
  for (let i = 0; i < w * h; i++) {
    const on = d[i * 4 + 3] > 110;
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = on ? 255 : 0;
    if (on) maxX = Math.max(maxX, i % w);
  }
  g.putImageData(id, 0, 0);
  c.tw = maxX + 1;
  return c;
}

// ------------------------------------------------------------------------------------------- pixel helpers
const px = (ctx, x, y, c) => {
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, 1, 1);
};
function pxLine(ctx, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.fillStyle = c;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
const pxRect = (ctx, x, y, w, h, c) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};
const pxDisc = (ctx, cx, cy, r, c) => {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const hw = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
    ctx.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
  }
};

// ------------------------------------------------------------------------------------------- static level
function buildBackground() {
  const c = K.makeCanvas(N, N), g = c.getContext('2d');
  // sky: bands with ordered-dither seams
  const bands = [[0, PAL.indigo], [62, PAL.purple], [104, PAL.magenta], [138, PAL.pink], [164, PAL.orange], [ROAD, PAL.orange]];
  for (let i = 0; i < bands.length - 1; i++) pxRect(g, 0, bands[i][0], N, bands[i + 1][0] - bands[i][0], bands[i][1]);
  for (let i = 1; i < bands.length - 1; i++) {
    const y = bands[i][0], up = bands[i - 1][1], dn = bands[i][1];
    // two rows above the seam get sparse pixels of the lower colour, two rows below get sparse pixels of the upper
    for (let x = 0; x < N; x++) {
      if ((x & 3) === 0) px(g, x, y - 3, dn);
      if ((x & 1) === ((y - 2) & 1)) px(g, x, y - 2, dn);
      if ((x & 1) === ((y - 1) & 1)) px(g, x, y - 1, dn);
      if ((x & 1) === (y & 1)) px(g, x, y, up);
      if ((x & 3) === 2) px(g, x, y + 1, up);
    }
  }
  // crescent moon (low, left)
  pxDisc(g, 30, 104, 7, PAL.white);
  pxDisc(g, 34, 101, 6, PAL.magenta);
  // far stepped hills
  const far = (cx, w, h, col) => {
    for (let k = 0; k < h; k += 4) {
      const hw = Math.max(4, Math.round(w / 2 - (k / 4) * 6));
      pxRect(g, cx - hw, ROAD - k - 4, hw * 2, 4, col);
    }
  };
  for (const [cx, w, h] of [[20, 90, 44], [92, 110, 60], [168, 80, 36], [236, 120, 56]]) far(cx, w, h, PAL.purple);
  // near hills: stepped mounds with a lit green lip on every step and dithered shade on the left faces
  const near = (cx, w, h) => {
    const steps = Math.floor(h / 5);
    for (let k = 0; k < steps; k++) {
      const hw = Math.max(5, Math.round(w / 2 - k * 7)), y = ROAD - (k + 1) * 5;
      pxRect(g, cx - hw, y, hw * 2, 5, PAL.teal);
      pxRect(g, cx - hw, y, hw * 2, 1, PAL.green);
      for (let yy = y + 1; yy < y + 5; yy++) for (let xx = cx - hw; xx < cx - hw + 4; xx++) if (((xx + yy) & 1) === 0) px(g, xx, yy, PAL.ink);
    }
    return ROAD - steps * 5;
  };
  near(60, 76, 26);
  const millTop = near(206, 88, 40);
  near(150, 40, 12);
  // windmill tower on the right-hand hill (sails are drawn per frame)
  const mx = 206, mb = millTop;
  for (let y = 0; y < 26; y++) {
    const hw = 6 - Math.floor(y / 7);
    pxRect(g, mx - hw, mb - y, hw * 2 + 1, 1, PAL.lgrey);
    pxRect(g, mx - hw, mb - y, 2, 1, PAL.slate);
    if (y % 6 === 2) pxRect(g, mx - hw, mb - y, hw * 2 + 1, 1, PAL.slate);
  }
  pxRect(g, mx - 1, mb - 6, 3, 6, PAL.ink); // door
  pxRect(g, mx - 1, mb - 18, 2, 2, PAL.yellow); // lit window
  for (let k = 0; k < 5; k++) pxRect(g, mx - 5 + k, mb - 26 - k, 11 - 2 * k, 1, PAL.dbrick); // cap
  L.mill = [mx, mb - 27];
  // stone ruins on the left: three columns, one broken, an architrave
  const col = (x, h) => {
    pxRect(g, x - 1, ROAD - 2, 8, 2, PAL.slate);
    pxRect(g, x, ROAD - h, 6, h - 2, PAL.lgrey);
    pxRect(g, x, ROAD - h, 1, h - 2, PAL.white);
    pxRect(g, x + 4, ROAD - h, 2, h - 2, PAL.slate);
    for (let y = ROAD - h + 3; y < ROAD - 3; y += 6) pxRect(g, x + 1, y, 3, 1, PAL.slate);
  };
  col(14, 40); col(30, 40); col(46, 22);
  pxRect(g, 49, ROAD - 23, 3, 1, PAL.lgrey); px(g, 48, ROAD - 23, PAL.slate);
  pxRect(g, 10, ROAD - 46, 30, 6, PAL.lgrey);
  pxRect(g, 10, ROAD - 46, 30, 1, PAL.white);
  pxRect(g, 10, ROAD - 41, 30, 1, PAL.slate);
  for (let x = 13; x < 38; x += 5) px(g, x, ROAD - 43, PAL.slate);
  pxRect(g, 56, ROAD - 4, 7, 2, PAL.lgrey); pxRect(g, 57, ROAD - 6, 4, 2, PAL.lgrey); // fallen drum
  // signposts: a jump arrow before the pit, a "16" marker after it
  const post = (x, h) => {
    pxRect(g, x, ROAD - h, 2, h, PAL.dbrick);
    px(g, x, ROAD - h, PAL.brick);
  };
  post(91, 22);
  pxRect(g, 84, ROAD - 33, 16, 12, PAL.ink);
  pxRect(g, 85, ROAD - 32, 14, 10, PAL.yellow);
  for (const [a, b] of [[87, 25], [88, 26], [89, 27], [90, 27], [91, 27], [92, 26], [93, 25], [94, 24], [95, 23]]) pxRect(g, a, ROAD - b, 1, 2, PAL.ink);
  pxRect(g, 94, ROAD - 30, 3, 1, PAL.ink); pxRect(g, 96, ROAD - 30, 1, 3, PAL.ink); // arrow head
  post(183, 18);
  pxRect(g, 177, ROAD - 29, 14, 11, PAL.ink);
  pxRect(g, 178, ROAD - 28, 12, 9, PAL.white);
  // tiny "16" in 3×5 digits
  for (const [a, b] of [[180, 0], [180, 1], [180, 2], [180, 3], [180, 4], [183, 0], [184, 0], [185, 0], [183, 1], [183, 2], [184, 2], [185, 2], [183, 3], [185, 3], [183, 4], [184, 4], [185, 4]]) px(g, a, ROAD - 26 + b, PAL.ink);
  // tufts of grass along the road edge (background side)
  const r = K.rng(16);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * N);
    if (x >= GAP0 - 2 && x < GAP1 + 2) continue;
    px(g, x, ROAD - 1, PAL.green); px(g, x + 1, ROAD - 2, PAL.green); px(g, x + 2, ROAD - 1, PAL.green);
  }
  // ground: cobbled road band, then checker bricks
  for (let x = 0; x < N; x++) {
    for (let y = ROAD; y < N; y++) {
      let c;
      if (y < ROAD + 4) {
        // cobbles 6 px wide, staggered
        const ox = (x + (y >= ROAD + 2 ? 3 : 0)) % 6;
        c = y === ROAD ? (ox === 0 ? PAL.slate : PAL.white) : ox === 0 || y === ROAD + 3 ? PAL.slate : PAL.lgrey;
      } else {
        const yy = y - (ROAD + 4), row = Math.floor(yy / 6), bx = x + (row & 1 ? 4 : 0), col = Math.floor(bx / 8);
        const mortar = yy % 6 === 5 || bx % 8 === 7;
        const tone = (row + col) & 1;
        c = mortar ? PAL.ink : tone ? PAL.brick : PAL.dbrick;
        if (!mortar && yy % 6 === 0 && bx % 8 < 6) c = tone ? PAL.orange : PAL.brick; // lit top edge of each brick
      }
      px(g, x, y, c);
    }
  }
  // the pit
  pxRect(g, GAP0, ROAD, GAP1 - GAP0, N - ROAD, PAL.ink);
  for (let y = ROAD; y < N; y += 2) {
    px(g, GAP0, y, PAL.dbrick);
    px(g, GAP1 - 1, y + 1, PAL.dbrick);
  }
  pxRect(g, GAP0, 232, GAP1 - GAP0, N - 232, PAL.water);
  // stars (twinkled per frame)
  L.stars = [];
  const s = K.rng(161);
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(s() * N), y = 20 + Math.floor(s() * 58);
    if (x > 48 && x < 202 && y < 92) continue; // behind the banner
    L.stars.push([x, y, s()]);
  }
  return c;
}

function buildBanner() {
  const T = TITLES[16];
  const zh = bitText(T.zh, PAL.white), en = bitText(T.en, PAL.orange), date = bitText(T.date, PAL.yellow);
  const w = 150, h = 62, c = K.makeCanvas(w, h), g = c.getContext('2d');
  pxRect(g, 0, 0, w, h, PAL.ink);
  pxRect(g, 1, 1, w - 2, h - 2, PAL.slate);
  pxRect(g, 2, 2, w - 4, h - 4, PAL.ink);
  pxRect(g, 3, 3, w - 6, h - 6, PAL.yellow);
  pxRect(g, 4, 4, w - 8, h - 8, PAL.indigo);
  // rivets
  for (const [x, y] of [[6, 6], [w - 7, 6], [6, h - 7], [w - 7, h - 7]]) px(g, x, y, PAL.lgrey);
  const ctr = (cv, y) => g.drawImage(cv, Math.round((w - cv.tw) / 2), y);
  ctr(zh, 5);
  ctr(en, 23);
  ctr(date, 40);
  // little coins flanking the date
  for (const x of [w / 2 - 36, w / 2 + 28]) {
    pxRect(g, x + 1, 44, 6, 8, PAL.yellow);
    pxRect(g, x, 45, 8, 6, PAL.yellow);
    pxRect(g, x + 3, 47, 2, 2, PAL.indigo);
    pxRect(g, x + 6, 46, 1, 5, PAL.orange);
  }
  return c;
}

// ------------------------------------------------------------------------------------------- moving bits
function drawCoin(g, cx, cy, frame) {
  const w = [8, 6, 2, 6][frame & 3];
  const x = cx - w / 2;
  pxRect(g, x - 1, cy - 4, w + 2, 9, PAL.ink);
  pxRect(g, x, cy - 5, w, 11, PAL.ink);
  if (w > 2) {
    pxRect(g, x + 1, cy - 4, w - 2, 9, PAL.yellow);
    pxRect(g, x, cy - 3, w, 7, PAL.yellow);
    pxRect(g, x + w - 1, cy - 3, 1, 7, PAL.orange);
    pxRect(g, x + 1, cy + 4, w - 2, 1, PAL.orange);
    pxRect(g, cx - (w > 6 ? 1 : 0), cy - 1, w > 6 ? 2 : 1, 2, PAL.ink); // square hole
    px(g, x + 1, cy - 3, PAL.white);
  } else pxRect(g, x, cy - 4, 2, 9, PAL.orange);
}
function sparkle(g, cx, cy, k) {
  const r = 4 + Math.floor(k * 9);
  const c = k < 0.5 ? PAL.white : PAL.yellow;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    px(g, cx + dx * r, cy + dy * r, c);
    px(g, cx + dx * (r - 1), cy + dy * (r - 1), c);
  }
  const d = Math.round(r * 0.6);
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) px(g, cx + dx * d, cy + dy * d, PAL.yellow);
  if (k < 0.3) pxRect(g, cx - 1, cy - 1, 2, 2, PAL.white);
}
/** pip — a little round bird of this level: 7×6 body, white belly, tuft, orange feet */
function pip(g, x, y, face, col) {
  pxRect(g, x - 3, y - 6, 7, 5, PAL.ink);
  pxRect(g, x - 4, y - 5, 9, 3, PAL.ink);
  pxRect(g, x - 2, y - 5, 5, 3, col);
  pxRect(g, x - 3, y - 4, 7, 1, col);
  pxRect(g, x - 1 + face, y - 3, 3, 1, PAL.white);
  px(g, x + face * 2, y - 5, PAL.ink); // eye
  px(g, x + face * 4, y - 4, PAL.orange); // beak
  px(g, x - face, y - 7, PAL.ink); px(g, x - face * 2, y - 8, PAL.ink); // tuft
  px(g, x - 1, y - 1, PAL.orange); px(g, x + 1, y - 1, PAL.orange);
}

// the pelican as a sprite: draw parts in flat palette colours at 1/4 scale, snap to the sprite palette, outline
const SW = 112, SH = 124;
const ROLE = { tire: PAL.ink, frame: PAL.red, metal: PAL.lgrey, saddle: PAL.ink, leg: PAL.orange, foot: PAL.orange, body: PAL.white, wing: PAL.lgrey, tail: PAL.lgrey, neck: PAL.white, head: PAL.white, beak: PAL.yellow, pouch: PAL.orange, scarf: PAL.red };
function pelicanSprite(pose) {
  const g = L.sg;
  const ox = Math.floor(pose.x / PX) - 52, oy = Math.floor(pose.y / PX) - 106;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, SW, SH);
  g.setTransform(1 / PX, 0, 0, 1 / PX, -ox, -oy);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const p of Rig.parts(pose)) {
    if (p.role === 'mark' || p.role === 'eye') continue;
    const c = ROLE[p.role] ?? PAL.lgrey;
    if (p.kind === 'poly') {
      K.path(g, p.pts, true);
      g.fillStyle = c;
      g.fill();
    } else if (p.kind === 'line') {
      K.path(g, p.pts, false);
      g.strokeStyle = c;
      g.lineWidth = Math.max(p.role === 'scarf' ? 5 : 6, p.w * (p.role === 'frame' ? 1.25 : 1));
      g.stroke();
    } else if (p.kind === 'wheel') {
      g.strokeStyle = PAL.lgrey;
      g.lineWidth = 4.5;
      g.beginPath();
      for (let i = 0; i < 2; i++) {
        const a = p.a + (i * Math.PI) / 2;
        g.moveTo(p.c[0] - Math.cos(a) * p.r * 0.8, p.c[1] - Math.sin(a) * p.r * 0.8);
        g.lineTo(p.c[0] + Math.cos(a) * p.r * 0.8, p.c[1] + Math.sin(a) * p.r * 0.8);
      }
      g.stroke();
      g.beginPath();
      g.arc(p.c[0], p.c[1], p.r * 0.92, 0, K.TAU);
      g.strokeStyle = PAL.ink;
      g.lineWidth = 8;
      g.stroke();
    } else if (p.kind === 'disc') {
      g.beginPath();
      g.arc(p.c[0], p.c[1], Math.max(p.r, 5), 0, K.TAU);
      g.fillStyle = PAL.lgrey;
      g.fill();
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const id = g.getImageData(0, 0, SW, SH), d = id.data, n = SW * SH;
  const on = L.mask;
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3];
    if (a < 120) { on[i] = 0; d[i * 4 + 3] = 0; continue; }
    const k = 255 / a, r = d[i * 4] * k, gg = d[i * 4 + 1] * k, b = d[i * 4 + 2] * k;
    let best = 0, bd = 1e9;
    for (let j = 0; j < SPRITE_PAL.length; j++) {
      const q = SPRITE_PAL[j], dd = (q[0] - r) ** 2 + (q[1] - gg) ** 2 + (q[2] - b) ** 2;
      if (dd < bd) { bd = dd; best = j; }
    }
    const q = SPRITE_PAL[best];
    d[i * 4] = q[0]; d[i * 4 + 1] = q[1]; d[i * 4 + 2] = q[2]; d[i * 4 + 3] = 255;
    on[i] = 1;
  }
  // 1-px dark outline (4-neighbour)
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const i = y * SW + x;
      if (on[i]) continue;
      if ((x > 0 && on[i - 1]) || (x < SW - 1 && on[i + 1]) || (y > 0 && on[i - SW]) || (y < SH - 1 && on[i + SW])) {
        d[i * 4] = INK[0]; d[i * 4 + 1] = INK[1]; d[i * 4 + 2] = INK[2]; d[i * 4 + 3] = 255;
      }
    }
  }
  // the eye: one dark pixel (two when the beak is open wide enough to matter)
  const ex = Math.floor(pose.eye.pupil[0] / PX) - ox, ey = Math.floor(pose.eye.pupil[1] / PX) - oy;
  if (ex >= 0 && ex < SW && ey >= 0 && ey < SH) {
    const i = (ey * SW + ex) * 4;
    d[i] = INK[0]; d[i + 1] = INK[1]; d[i + 2] = INK[2]; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return [ox, oy];
}

const pad = (n, k) => String(Math.max(0, Math.floor(n))).padStart(k, '0');

export default {
  id: 16, key: 'pixel', title: TITLES[16],
  heroT: 2.5,
  stutter: 12,
  // a run-up across the pit: the jump spans 0.9 s and must clear wheelbase + pit, so the bird is quicker in the air
  profile: [[0, 0], [T0, (G - 135 + 30) / 1060], [T1, (G + 135 + 30) / 1060], [6, 1]],
  act(t, p) {
    if (t > T0 && t < T1) {
      const v = (t - TA) / (TA - T0);
      p.y -= JH * (1 - v * v);
      p.rot = 0.13 * v;
      p.neck = 0.7 * K.gate(t, T0, T1, 0.12);
      p.beakOpen = 0.8 * K.bump(t, TA, 0.12);
      p.crest = 1;
    }
    const land = t - T1;
    if (land > 0 && land < 0.3) p.squash = 1 - 0.14 * Math.sin((land / 0.3) * Math.PI);
  },
  async init() {
    L = {};
    L.low = K.makeCanvas(N, N);
    L.lg = L.low.getContext('2d');
    L.lg.imageSmoothingEnabled = false;
    L.spr = K.makeCanvas(SW, SH);
    L.sg = L.spr.getContext('2d', { willReadFrequently: true });
    L.mask = new Uint8Array(SW * SH);
    L.bg = buildBackground();
    L.banner = buildBanner();
  },
  render(ctx, t, env) {
    const g = L.lg;
    const q8 = Math.floor(t * 8 + 1e-6), q4 = Math.floor(t * 4 + 1e-6), q12 = Math.floor(t * 12 + 1e-6) / 12;
    g.drawImage(L.bg, 0, 0);
    // twinkling stars
    for (const [x, y, r] of L.stars) {
      const on = Math.floor(t * 3 + r * 7) % 5;
      if (on !== 0) px(g, x, y, on === 1 ? PAL.lgrey : PAL.white);
    }
    // windmill sails: four arms, a quarter-turn per bar, stepping at 4 Hz
    const [mx, my] = L.mill, a0 = (q4 * Math.PI) / 16;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
      pxLine(g, mx, my, mx + ca * 15, my + sa * 15, PAL.dbrick);
      const nx = -sa * 3, ny = ca * 3;
      pxLine(g, mx + ca * 5 + nx, my + sa * 5 + ny, mx + ca * 15 + nx, my + sa * 15 + ny, PAL.white);
      pxLine(g, mx + ca * 15, my + sa * 15, mx + ca * 15 + nx, my + sa * 15 + ny, PAL.white);
    }
    px(g, mx, my, PAL.ink);
    // water ripple
    for (let x = GAP0 + 1; x < GAP1 - 1; x++) {
      const w = (x + q4) % 6;
      if (w === 0 || w === 1) px(g, x, 232, PAL.white);
      if ((x + q4 * 2) % 9 === 0) px(g, x, 238, PAL.lgrey);
    }
    // the coin (before the grab) / sparkle and "+200" (after)
    if (t < TA) drawCoin(g, COIN[0], COIN[1] + (q8 % 8 < 4 ? 0 : -1), q8);

    // pips on the ruins and by the signpost: hop on every beat, higher and watching during bar 2
    const look = env.pose ? env.pose.x / PX : env.rider.lx / PX;
    const excite = t > 1.9 && t < 4.1 ? 1 : 0;
    for (const [x, y, col, ph] of [[24, ROAD - 46, PAL.pink, 0], [196, ROAD, PAL.yellow, 0.5], [70, ROAD - 26 + 1, PAL.white, 0.25]]) {
      const bp = K.fract((q12 + 1e-4) * 2 + ph);
      const hop = Math.round((excite ? 6 : t < 0 || t > 6 ? 1 : 2) * Math.sin(bp * Math.PI) * (bp < 0.5 ? 1 : 0) * 2);
      pip(g, x, y - hop, look > x ? 1 : -1, col);
    }
    // dust puffs on landing
    const dl = q12 - T1;
    if (dl >= 0 && dl < 0.34 && env.pose) {
      const k = Math.floor(dl * 12);
      for (const wx of [env.pose.wheels[0].c[0], env.pose.wheels[1].c[0]]) {
        const x = Math.round(wx / PX);
        for (const s of [-1, 1]) {
          px(g, x + s * (4 + k * 2), ROAD - 2 - (k > 1 ? 1 : 0), PAL.white);
          px(g, x + s * (6 + k * 2), ROAD - 1 - k, k < 2 ? PAL.white : PAL.lgrey);
        }
      }
    }
    // the pelican sprite
    if (env.pose) {
      const [ox, oy] = pelicanSprite(env.pose);
      g.drawImage(L.spr, ox, oy);
    }
    if (t >= TA && t < TA + 0.42) sparkle(g, COIN[0], COIN[1], (q12 - TA) / 0.42);
    if (t >= TA && t < TA + 0.55) glyphs(g, '200', COIN[0] - 8, COIN[1] - 28 - Math.floor((t - TA) * 24), PAL.white, 1, PAL.ink);
    // "1UP" pops on the strong beat and floats up
    const u1 = t - ONEUP;
    if (u1 >= 0 && u1 < 1.1) {
      const h0 = env.poseAt(ONEUP).pt.head;
      const blink = u1 > 0.75 && Math.floor(u1 * 12) % 2 === 1;
      if (!blink) {
        const x = Math.round(h0[0] / PX) - 17, y = Math.round(h0[1] / PX) - 26 - Math.floor(Math.min(u1, 0.9) * 22);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [2, 2]]) glyphs(g, '1UP', x + dx, y + dy, PAL.ink, 2);
        glyphs(g, '1UP', x, y, u1 < 0.12 ? PAL.white : PAL.green, 2);
      }
    }
    // HUD bar
    pxRect(g, 0, 0, N, 18, PAL.ink);
    pxRect(g, 0, 17, N, 1, PAL.slate);
    const score = 4650 + (t >= TA ? 10 * Math.min(20, Math.floor((t - TA) * 50)) : 0);
    const coins = t >= TA ? 8 : 7, lives = t >= ONEUP ? 4 : 3;
    const time = 400 - Math.floor((t + 8) / 0.4);
    glyphs(g, 'SCORE', 6, 5, PAL.white, 1, PAL.slate);
    glyphs(g, pad(score, 6), 40, 5, PAL.yellow, 1, PAL.dbrick);
    drawCoin(g, 92, 8, 0);
    glyphs(g, 'x' + pad(coins, 2), 99, 5, t >= TA && t < TA + 0.6 && q8 % 2 ? PAL.white : PAL.yellow, 1, PAL.dbrick);
    // heart icon
    const hb = t >= ONEUP && t < ONEUP + 1 && q8 % 2 === 0;
    const hc = hb ? PAL.white : PAL.red;
    for (const [x, y, w] of [[134, 6, 2], [138, 6, 2], [133, 7, 7], [133, 8, 7], [134, 9, 5], [135, 10, 3], [136, 11, 1]]) pxRect(g, x, y, w, 1, hc);
    px(g, 134, 7, PAL.white);
    glyphs(g, 'x' + lives, 143, 5, PAL.yellow, 1, PAL.dbrick);
    glyphs(g, 'TIME', 180, 5, PAL.white, 1, PAL.slate);
    glyphs(g, pad(time, 3), 207, 5, PAL.yellow, 1, PAL.dbrick);
    // stage banner on two little chains
    for (let y = 18; y < 22; y++) {
      px(g, 60 + (y & 1), y, PAL.lgrey);
      px(g, 188 + (y & 1), y, PAL.lgrey);
    }
    g.drawImage(L.banner, 50, 22);
    // blit with hard pixels
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(L.low, 0, 0, N * PX, N * PX);
    ctx.restore();
  },
};
