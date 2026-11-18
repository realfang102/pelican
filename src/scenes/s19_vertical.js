// Section 19 — Vertical Short Video (2020s)
// A golden-hour street shot on a phone. On beat 3 of bar 1 the whole film snaps to a 9:16 column with black bars and a
// (fictional) short-video app UI: likes and comments float up, the progress bar fills, and it reaches the end exactly
// as the pelican crosses the next frame — where the bars snap open again.
//
// Technique: clean digital vector drawing in Canvas 2D (no brushwork — this era has none). The pillarbox and UI are a
// screen-space overlay; the scene's camera() adds the punch-in and a little handheld shake. For the outro wall the same
// UI is drawn inside the square panel (env.hero).
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

let L = null;
const NARROW = 1.0, OPEN = 6.0; // local times: bars slam in / snap open
const COL_W = (1080 * 9) / 16; // 607.5 px

// ------------------------------------------------------------------------------------------- street
const BUILDINGS = [
  { x: -20, w: 200, h: 330, col: '#e9b99a', trim: '#c98f73', sign: '單車行', signCol: '#2d4a53', awn: '#2d6a6a' },
  { x: 180, w: 170, h: 420, col: '#d8cfc0', trim: '#b3a895', sign: 'CAFÉ PELAGO', signCol: '#7b3b2e', awn: '#c9573f' },
  { x: 350, w: 230, h: 300, col: '#9fb8b3', trim: '#7f9a95', sign: '書店 BOOKS', signCol: '#27323a', awn: '#e8c66a' },
  { x: 580, w: 160, h: 390, col: '#e6c9a8', trim: '#c4a481', sign: 'LAUNDRY', signCol: '#35506b', awn: '#35506b' },
  { x: 740, w: 290, h: 340, col: '#c58f7c', trim: '#a2705e', sign: '24H 便利', signCol: '#f7f2e6', awn: '#3b7a57' },
];
const BASE = 742; // pavement line at the foot of the façades
const PEOPLE = [
  { x: 262, h: 148, coat: '#e7604a', skin: '#f0c7a2', hair: '#2a2320', leg: '#27323a', phone: 1 },
  { x: 604, h: 138, coat: '#3f6fb0', skin: '#c98d68', hair: '#161314', leg: '#e9e2d4', phone: 1 },
  { x: 826, h: 152, coat: '#f2c14e', skin: '#8d5a3c', hair: '#101010', leg: '#3a3340', phone: 1 },
];

function buildStreet() {
  return K.layer(1000, 1000, 1.25, (ctx) => {
    // sky
    ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, BASE, [[0, '#5d6fae'], [0.35, '#b08bb5'], [0.62, '#f2a98a'], [0.86, '#ffd49a'], [1, '#ffe7bd']]);
    ctx.fillRect(0, 0, 1000, BASE);
    const sun = [668, 470];
    ctx.fillStyle = K.radGrad(ctx, sun[0], sun[1], 10, 520, [[0, 'rgba(255,246,214,0.95)'], [0.12, 'rgba(255,226,170,0.7)'], [0.45, 'rgba(255,190,130,0.22)'], [1, 'rgba(255,190,130,0)']]);
    ctx.fillRect(0, 0, 1000, BASE);
    // clouds
    const r = K.rng(19);
    for (let i = 0; i < 7; i++) {
      const cx = r.range(-40, 1040), cy = r.range(60, 330), w = r.range(140, 320);
      ctx.fillStyle = K.linGrad(ctx, 0, cy - 22, 0, cy + 26, [[0, 'rgba(255,236,214,0.75)'], [1, 'rgba(238,150,140,0.35)']]);
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.ellipse(cx + (k - 2.5) * w * 0.15 + r.range(-10, 10), cy + r.range(-8, 8), w * r.range(0.14, 0.24), r.range(12, 24), 0, 0, K.TAU);
        ctx.fill();
      }
    }
    // far skyline, two hazy ranks
    for (const [col, top, seed] of [['rgba(150,120,160,0.55)', 300, 5], ['rgba(120,96,138,0.75)', 380, 9]]) {
      const q = K.rng(seed);
      ctx.fillStyle = col;
      let x = -20;
      while (x < 1020) {
        const w = q.range(34, 90), h = q.range(60, 260);
        ctx.fillRect(x, BASE - (BASE - top) * 0.35 - h, w + 1, 1000);
        if (q() < 0.3) ctx.fillRect(x + w * 0.4, BASE - (BASE - top) * 0.35 - h - 26, 3, 26);
        x += w;
      }
    }
    // the street's own buildings
    for (const b of BUILDINGS) {
      const top = BASE - b.h;
      ctx.fillStyle = K.linGrad(ctx, 0, top, 0, BASE, [[0, K.shade(b.col, 0.08)], [1, K.shade(b.col, -0.12)]]);
      ctx.fillRect(b.x, top, b.w, b.h);
      ctx.fillStyle = b.trim;
      ctx.fillRect(b.x, top, b.w, 12);
      ctx.fillRect(b.x, top - 6, b.w * 0.5, 6);
      ctx.fillStyle = 'rgba(40,24,40,0.22)'; // shadowed left return
      ctx.fillRect(b.x, top, 9, b.h);
      // upper windows: glass picking up the sunset, some lit
      const cols = Math.max(2, Math.round(b.w / 58)), rows = Math.max(1, Math.floor((b.h - 150) / 74));
      const q = K.rng(b.x + 71);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const ww = (b.w - 30) / cols - 14, wx = b.x + 22 + i * ((b.w - 30) / cols), wy = top + 34 + j * 74;
          const lit = q() < 0.28;
          ctx.fillStyle = lit ? K.linGrad(ctx, 0, wy, 0, wy + 48, [[0, '#ffe9a8'], [1, '#ffbf6b']]) : K.linGrad(ctx, wx, wy, wx + ww, wy + 48, [[0, '#6a6fa3'], [0.55, '#e69f8e'], [1, '#ffd8a0']]);
          K.roundRect(ctx, wx, wy, ww, 48, 3);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(wx, wy + 22, ww, 2);
          ctx.fillStyle = b.trim;
          ctx.fillRect(wx - 3, wy + 48, ww + 6, 5);
          if (q() < 0.25) {
            // a window box
            ctx.fillStyle = '#4e8a5a';
            for (let k = 0; k < 5; k++) {
              ctx.beginPath();
              ctx.arc(wx + 6 + k * (ww - 12) / 4, wy + 48, 7, Math.PI, 0);
              ctx.fill();
            }
          }
        }
      }
      // shopfront
      const sy = BASE - 118;
      ctx.fillStyle = K.shade(b.col, -0.3);
      ctx.fillRect(b.x + 10, sy, b.w - 20, 118);
      ctx.fillStyle = K.linGrad(ctx, b.x, sy, b.x + b.w, BASE, [[0, '#3d466b'], [0.5, '#c98b86'], [1, '#ffd9a6']]);
      K.roundRect(ctx, b.x + 20, sy + 30, b.w - 86, 78, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(b.x + 34, sy + 108);
      ctx.lineTo(b.x + 74, sy + 30);
      ctx.lineTo(b.x + 96, sy + 30);
      ctx.lineTo(b.x + 56, sy + 108);
      ctx.fill();
      ctx.fillStyle = '#2b2530'; // door
      K.roundRect(ctx, b.x + b.w - 56, sy + 24, 38, 94, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,214,150,0.5)';
      ctx.fillRect(b.x + b.w - 50, sy + 32, 26, 44);
      // awning with scalloped stripe
      ctx.fillStyle = b.awn;
      ctx.beginPath();
      ctx.moveTo(b.x + 6, sy - 4);
      ctx.lineTo(b.x + b.w - 6, sy - 4);
      ctx.lineTo(b.x + b.w + 6, sy + 24);
      ctx.lineTo(b.x - 6, sy + 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let k = 0; k < b.w / 26; k += 2) ctx.fillRect(b.x - 4 + k * 26, sy - 4, 26, 28);
      // sign
      ctx.fillStyle = b.signCol;
      K.roundRect(ctx, b.x + 16, sy - 44, b.w - 32, 32, 4);
      ctx.fill();
      K.text(ctx, b.sign, b.x + b.w / 2, sy - 28, { size: 21, font: K.FONT.geo, weight: 700, align: 'center', baseline: 'middle', color: K.lum(b.signCol) > 0.6 ? '#2b2530' : '#fff3dc', tracking: 1.5, maxWidth: b.w - 48 });
    }
    // pavement, kerb, cycle lane, carriageway
    ctx.fillStyle = K.linGrad(ctx, 0, BASE, 0, 792, [[0, '#d9c3ae'], [1, '#c9ad98']]);
    ctx.fillRect(0, BASE, 1000, 50);
    ctx.strokeStyle = 'rgba(120,90,80,0.35)';
    ctx.lineWidth = 1;
    for (let x = -20; x < 1040; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, BASE);
      ctx.lineTo(x - 22, 792);
      ctx.stroke();
    }
    ctx.fillStyle = '#efe2d2';
    ctx.fillRect(0, 786, 1000, 7);
    ctx.fillStyle = '#8f7f7c';
    ctx.fillRect(0, 793, 1000, 4);
    ctx.fillStyle = K.linGrad(ctx, 0, 797, 0, 862, [[0, '#2f8f86'], [1, '#27796f']]);
    ctx.fillRect(0, 797, 1000, 65);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let x = 10; x < 1000; x += 60) ctx.fillRect(x, 859, 34, 4);
    // cycle-lane pictograms
    for (const x of [130, 470, 810]) {
      ctx.save();
      ctx.translate(x, 832);
      ctx.scale(1, 0.45);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (const cx of [-22, 22]) {
        ctx.beginPath();
        ctx.arc(cx, 0, 16, 0, K.TAU);
        ctx.stroke();
      }
      K.path(ctx, [[-22, 0], [-6, -24], [14, -24], [22, 0]]);
      ctx.stroke();
      K.path(ctx, [[-6, -24], [2, 0], [14, -24]]);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = K.linGrad(ctx, 0, 862, 0, 1000, [[0, '#4a4553'], [1, '#33303c']]);
    ctx.fillRect(0, 862, 1000, 140);
    ctx.fillStyle = 'rgba(255,236,190,0.75)';
    for (let x = -40; x < 1000; x += 170) ctx.fillRect(x, 930, 96, 7);
    K.grain(ctx, 0, 862, 1000, 140, { color: '#000000', alpha: 0.18, seed: 4 });
    K.grain(ctx, 0, 797, 1000, 65, { color: '#ffffff', alpha: 0.08, seed: 5 });

    // street furniture + long evening shadows (sun low on the right → shadows fall to the left, toward the viewer)
    const shadow = (x, w, len) => {
      ctx.fillStyle = 'rgba(52,30,60,0.28)';
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 790);
      ctx.lineTo(x + w / 2, 790);
      ctx.lineTo(x + w / 2 - len, 790 + len * 0.42);
      ctx.lineTo(x - w / 2 - len, 790 + len * 0.42);
      ctx.fill();
    };
    for (const x of [116, 512, 936]) {
      shadow(x, 12, 190);
      ctx.fillStyle = '#5a4038';
      ctx.fillRect(x - 5, 590, 10, 200);
      ctx.fillStyle = '#8a6a55';
      ctx.fillRect(x + 2, 590, 3, 200);
      const q = K.rng(x);
      for (let k = 0; k < 16; k++) {
        const cx = x + q.range(-58, 58), cy = 560 + q.range(-70, 46), rad = q.range(26, 46);
        ctx.fillStyle = K.linGrad(ctx, cx - rad, cy - rad, cx + rad, cy + rad, [[0, '#3f6b55'], [0.6, '#5f9a62'], [1, '#f1c96d']]);
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, K.TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#8f7f7c';
      K.roundRect(ctx, x - 26, 780, 52, 12, 3);
      ctx.fill();
    }
    // lamp post with banner, bike rack, hydrant
    shadow(700, 8, 160);
    ctx.fillStyle = '#2d2a35';
    ctx.fillRect(697, 480, 6, 310);
    ctx.fillRect(697, 480, 44, 5);
    ctx.fillStyle = '#ffe9b0';
    K.roundRect(ctx, 728, 484, 22, 9, 4);
    ctx.fill();
    ctx.fillStyle = '#d5533f';
    ctx.fillRect(672, 520, 24, 70);
    K.text(ctx, '騎', 684, 556, { size: 19, font: K.FONT.cjkSans, weight: 700, align: 'center', baseline: 'middle', color: '#fff3dc' });
    ctx.strokeStyle = '#3a3642';
    ctx.lineWidth = 4;
    for (const x of [400, 428, 456]) {
      ctx.beginPath();
      ctx.moveTo(x, 790);
      ctx.lineTo(x, 760);
      ctx.arc(x + 8, 760, 8, Math.PI, 0);
      ctx.lineTo(x + 16, 790);
      ctx.stroke();
    }
    ctx.fillStyle = '#d5533f';
    K.roundRect(ctx, 44, 756, 16, 34, 5);
    ctx.fill();
    ctx.fillRect(38, 768, 28, 6);
    // warm bloom from the sun over everything
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = K.radGrad(ctx, sun[0], sun[1], 20, 640, [[0, 'rgba(255,214,150,0.5)'], [0.5, 'rgba(255,170,110,0.14)'], [1, 'rgba(255,170,110,0)']]);
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.globalCompositeOperation = 'source-over';
    // title: a rooftop billboard in the flat sans of the period (clear of the app UI when the picture narrows)
    ctx.fillStyle = '#3a3642';
    for (const x of [214, 330, 470]) ctx.fillRect(x, 300, 6, x < 350 ? 30 : 150);
    ctx.fillStyle = 'rgba(40,24,40,0.3)';
    K.roundRect(ctx, 170, 176, 388, 140, 10);
    ctx.fill();
    ctx.fillStyle = '#1d1b26';
    K.roundRect(ctx, 164, 168, 388, 140, 10);
    ctx.fill();
    ctx.strokeStyle = '#ffd28a';
    ctx.lineWidth = 2;
    K.roundRect(ctx, 171, 175, 374, 126, 6);
    ctx.stroke();
    K.titleBlock(ctx, TITLES[19], 190, 184, { color: '#ffffff', zh: { size: 44, font: K.FONT.cjkSans, weight: 900 }, en: { size: 25, font: K.FONT.geo, weight: 600 }, date: { size: 21, font: K.FONT.geo, weight: 500, italic: false, color: '#ffd28a' }, gap: 1.24 });
  });
}

function person(ctx, p, t, look, hop) {
  const k = p.h / 150, x = p.x, y = 788 - hop;
  const P = (px, py) => [x + px * k, y + py * k];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // shadow
  ctx.fillStyle = 'rgba(52,30,60,0.26)';
  ctx.beginPath();
  ctx.ellipse(x - 34 * k, 792, 46 * k, 6 * k, 0, 0, K.TAU);
  ctx.fill();
  // legs
  ctx.strokeStyle = p.leg;
  ctx.lineWidth = 11 * k;
  K.path(ctx, [P(-7, -66), P(-9, -2)]);
  ctx.stroke();
  K.path(ctx, [P(7, -66), P(10, -2)]);
  ctx.stroke();
  ctx.fillStyle = '#f4efe6';
  K.roundRect(ctx, x - 17 * k, y - 6 * k, 16 * k, 7 * k, 3 * k);
  ctx.fill();
  K.roundRect(ctx, x + 3 * k, y - 6 * k, 16 * k, 7 * k, 3 * k);
  ctx.fill();
  // coat
  ctx.fillStyle = K.linGrad(ctx, x - 20 * k, 0, x + 20 * k, 0, [[0, K.shade(p.coat, -0.18)], [0.7, p.coat], [1, K.shade(p.coat, 0.22)]]);
  K.roundRect(ctx, x - 19 * k, y - 122 * k, 38 * k, 66 * k, 13 * k);
  ctx.fill();
  // head turned toward the pelican
  const hx = x + look * 3.5 * k, hy = y - 138 * k;
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, 14 * k, 0, K.TAU);
  ctx.fill();
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.arc(hx - look * 2.5 * k, hy - 3 * k, 14.6 * k, Math.PI * (1.02 - look * 0.1), Math.PI * (1.98 - look * 0.1));
  ctx.fill();
  ctx.fillStyle = '#1b1820';
  ctx.beginPath();
  ctx.arc(hx + look * 6 * k, hy + 1 * k, 1.7 * k, 0, K.TAU);
  ctx.fill();
  // arm holding the phone up, aimed at the pelican
  const sh = P(look * 8, -112), a = -0.5 + look * 0.5;
  const hand = [sh[0] + look * 26 * k, sh[1] - 22 * k - 4 * k * Math.sin(t * 3 + p.x)];
  ctx.strokeStyle = K.shade(p.coat, -0.08);
  ctx.lineWidth = 9 * k;
  K.path(ctx, [sh, [sh[0] + look * 16 * k, sh[1] + 8 * k], hand]);
  ctx.stroke();
  ctx.save();
  ctx.translate(hand[0], hand[1] - 8 * k);
  ctx.rotate(look * 0.12);
  ctx.fillStyle = '#17151c';
  K.roundRect(ctx, -7 * k, -15 * k, 14 * k, 27 * k, 3 * k);
  ctx.fill();
  ctx.fillStyle = (t * 2) % 1 < 0.5 ? '#ff5a4d' : '#7a2a26';
  ctx.beginPath();
  ctx.arc(0, -10 * k, 1.6 * k, 0, K.TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function flatPelican(ctx, pose) {
  const s = pose.s;
  // long shadow on the lane
  ctx.save();
  ctx.fillStyle = 'rgba(30,20,50,0.3)';
  ctx.beginPath();
  ctx.ellipse(pose.x - 70 * s, pose.y + 9 * s, 150 * s, 9 * s, 0, 0, K.TAU);
  ctx.fill();
  ctx.restore();
  Rig.drawFlat(ctx, pose, {
    line: null,
    fill: { tire: '#1f1c26', frame: '#ff5a4d', metal: '#4b4756', saddle: '#2a2632', leg: '#ff9d3c', foot: '#ff8a2a', body: '#fff8ec', wing: '#f1e2d0', tail: '#e6d2c2', neck: '#fff8ec', head: '#fff8ec', beak: '#ffc93c', pouch: '#ff8e3c', scarf: '#3f6fb0', mark: '#d9c2ae' },
    eyeWhite: '#ffffff', pupil: '#1b1820',
  });
  // warm rim light from the low sun (right-hand edges)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,196,120,0.5)';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  for (const key of ['body', 'neck', 'head']) {
    const pts = pose.shapes[key];
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    ctx.beginPath();
    let pen = false;
    for (const p of pts) {
      if (p[0] > cx + 6 * s) {
        pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        pen = true;
      } else pen = false;
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- app UI (fictional)
const COMMENTS = ['is that a PELICAN??', 'cadence: immaculate', 'since ancient times fr', 'who gave him a bike', 'the scarf. THE SCARF', 'art history is wild', 'humans are obsessed', '20/20 no notes', 'ring the bell again'];
const fmtCount = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)));
function heart(ctx, x, y, r, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r / 16, r / 16);
  ctx.beginPath();
  ctx.moveTo(0, 13);
  ctx.bezierCurveTo(-22, -3, -11, -20, 0, -8);
  ctx.bezierCurveTo(11, -20, 22, -3, 0, 13);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}
/** draw the app chrome into a w×h rect (designed at 608 × 1080); tt = seconds since the video "started" (0..5) */
function drawUI(ctx, x, y, w, h, tt, alpha) {
  if (alpha <= 0) return;
  const k = w / 608;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.globalAlpha = alpha;
  const H = h / k;
  // legibility gradients
  ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 190, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, 0, 608, 190);
  ctx.fillStyle = K.linGrad(ctx, 0, H - 380, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.62)']]);
  ctx.fillRect(0, H - 380, 608, 380);
  const white = '#ffffff', font = K.FONT.geo;
  // top tabs
  K.text(ctx, 'Flock', 228, 74, { size: 27, font, weight: 500, align: 'center', color: 'rgba(255,255,255,0.62)' });
  K.text(ctx, 'Drift', 372, 74, { size: 27, font, weight: 700, align: 'center', color: white });
  ctx.fillStyle = white;
  K.roundRect(ctx, 350, 86, 44, 4, 2);
  ctx.fill();
  ctx.strokeStyle = white;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(546, 62, 12, 0, K.TAU);
  ctx.moveTo(555, 71);
  ctx.lineTo(565, 81);
  ctx.stroke();
  // trending pill drops in on bar 3
  const tp = K.ease.outBack(K.prog(tt, 3.0, 0.3));
  if (tp > 0) {
    ctx.save();
    ctx.translate(304, 128 - 40 * (1 - tp));
    ctx.globalAlpha *= K.clamp(tp);
    ctx.fillStyle = 'rgba(255,90,77,0.95)';
    K.roundRect(ctx, -110, -19, 220, 38, 19);
    ctx.fill();
    K.text(ctx, 'Trending · No. 1', 0, 1, { size: 20, font, weight: 700, align: 'center', baseline: 'middle', color: white });
    ctx.restore();
  }
  // right rail
  const rx = 548;
  let ry = H - 590;
  ctx.fillStyle = '#fff8ec';
  ctx.beginPath();
  ctx.arc(rx, ry, 30, 0, K.TAU);
  ctx.fill();
  ctx.strokeStyle = white;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffc93c'; // avatar: a beak
  ctx.beginPath();
  ctx.moveTo(rx - 4, ry - 6);
  ctx.lineTo(rx + 24, ry + 4);
  ctx.lineTo(rx - 4, ry + 10);
  ctx.fill();
  ctx.fillStyle = '#1b1820';
  ctx.beginPath();
  ctx.arc(rx - 8, ry - 8, 3.4, 0, K.TAU);
  ctx.fill();
  ctx.fillStyle = '#ff5a4d';
  ctx.beginPath();
  ctx.arc(rx, ry + 30, 12, 0, K.TAU);
  ctx.fill();
  K.text(ctx, '+', rx, ry + 31, { size: 20, font, weight: 700, align: 'center', baseline: 'middle', color: white });
  // like (pulses on every beat), comment, share, save
  const likes = 12400 * Math.pow(170, K.clamp(tt / 5));
  const beat = Math.exp(-((tt * 2) % 1) * 5);
  ry += 104;
  heart(ctx, rx, ry, 24 + 5 * beat, tt > 1.0 ? '#ff4d6a' : white);
  K.text(ctx, fmtCount(likes), rx, ry + 44, { size: 19, font, weight: 600, align: 'center', color: white });
  ry += 100;
  ctx.fillStyle = white;
  K.roundRect(ctx, rx - 24, ry - 22, 48, 38, 16);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rx - 10, ry + 12);
  ctx.lineTo(rx - 16, ry + 26);
  ctx.lineTo(rx + 2, ry + 14);
  ctx.fill();
  K.text(ctx, fmtCount(likes * 0.031), rx, ry + 48, { size: 19, font, weight: 600, align: 'center', color: white });
  ry += 100;
  ctx.beginPath();
  ctx.moveTo(rx - 24, ry + 14);
  ctx.quadraticCurveTo(rx - 20, ry - 12, rx + 4, ry - 12);
  ctx.lineTo(rx + 4, ry - 24);
  ctx.lineTo(rx + 26, ry - 2);
  ctx.lineTo(rx + 4, ry + 18);
  ctx.lineTo(rx + 4, ry + 4);
  ctx.quadraticCurveTo(rx - 12, ry + 2, rx - 24, ry + 14);
  ctx.fill();
  K.text(ctx, fmtCount(likes * 0.012), rx, ry + 46, { size: 19, font, weight: 600, align: 'center', color: white });
  ry += 96;
  ctx.beginPath();
  ctx.moveTo(rx - 16, ry - 22);
  ctx.lineTo(rx + 16, ry - 22);
  ctx.lineTo(rx + 16, ry + 22);
  ctx.lineTo(rx, ry + 8);
  ctx.lineTo(rx - 16, ry + 22);
  ctx.fill();
  // spinning sound disc
  ctx.save();
  ctx.translate(rx, H - 96);
  ctx.rotate(tt * 2.2);
  ctx.fillStyle = '#1b1820';
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, K.TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0.3, 2.2);
  ctx.stroke();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, K.TAU);
  ctx.fill();
  ctx.restore();
  // hearts floating up from the like button
  for (let i = 0; i < 26; i++) {
    const born = 0.25 + i * 0.19 + K.hash1(i * 3) * 0.1, age = tt - born;
    if (age < 0 || age > 2.2) continue;
    const u = age / 2.2;
    heart(ctx, rx - 6 + Math.sin(age * 4 + i) * 22 * u - 34 * u * K.hash1(i), H - 486 - 330 * K.ease.out2(u), 11 + 9 * K.hash1(i * 7), `rgba(${i % 3 ? '255,77,106' : '255,201,60'},${0.95 * (1 - u * u)})`);
  }
  // caption block
  K.text(ctx, '@the.pelican', 26, H - 176, { size: 27, font, weight: 700, color: white });
  ctx.fillStyle = '#ff5a4d';
  K.roundRect(ctx, 232, H - 201, 104, 34, 8);
  ctx.fill();
  K.text(ctx, 'Follow', 284, H - 183, { size: 19, font, weight: 700, align: 'center', baseline: 'middle', color: white });
  K.text(ctx, 'since ancient times, apparently', 26, H - 132, { size: 23, font, weight: 500, color: white });
  K.text(ctx, '#pelican  #bicycle  #arthistory', 26, H - 96, { size: 21, font, weight: 600, color: '#ffe2a8' });
  K.text(ctx, '♪  original sound — bicycle bell', 26, H - 56, { size: 19, font, weight: 500, color: 'rgba(255,255,255,0.86)' });
  // comments rising above the caption
  COMMENTS.forEach((c, i) => {
    const born = 0.35 + i * 0.5, age = tt - born;
    if (age < 0 || age > 2.4) return;
    const u = age / 2.4, a = Math.min(1, age * 6) * (1 - K.smoothstep(0.7, 1, u));
    const cy = H - 250 - 190 * u;
    ctx.save();
    ctx.globalAlpha *= a;
    const tw = K.measure(ctx, c, { size: 20, font, weight: 500 });
    ctx.fillStyle = 'rgba(20,18,26,0.62)';
    K.roundRect(ctx, 22, cy - 19, tw + 64, 38, 19);
    ctx.fill();
    ctx.fillStyle = ['#ff8e3c', '#3f6fb0', '#3b7a57', '#c9573f'][i % 4];
    ctx.beginPath();
    ctx.arc(42, cy, 12, 0, K.TAU);
    ctx.fill();
    K.text(ctx, c, 62, cy + 1, { size: 20, font, weight: 500, baseline: 'middle', color: white });
    ctx.restore();
  });
  // double-tap heart on the downbeat of bar 2
  const dt = tt - 1.0;
  if (dt > 0 && dt < 0.9) {
    const sc = K.ease.outBack(K.prog(dt, 0, 0.22), 3);
    heart(ctx, 304, H * 0.4, 86 * sc, `rgba(255,77,106,${0.95 * (1 - K.smoothstep(0.45, 0.9, dt))})`);
  }
  // progress bar: reaches the end exactly at the next frame
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(0, H - 8, 608, 5);
  ctx.fillStyle = white;
  ctx.fillRect(0, H - 8, 608 * K.clamp(tt / 5), 5);
  ctx.beginPath();
  ctx.arc(608 * K.clamp(tt / 5), H - 5.5, 6, 0, K.TAU);
  ctx.fill();
  ctx.restore();
}

export default {
  id: 19, key: 'vertical', title: TITLES[19], heroT: 3.0,
  camera(t) {
    const on = K.ease.out3(K.prog(t, NARROW, 0.12)) * (1 - K.ease.io2(K.prog(t, OPEN - 0.14, 0.14)));
    if (on <= 0) return null;
    const beat = Math.exp(-((t * 2) % 1) * 6); // pop-beat pulse
    return { zoom: 1 + on * (0.2 + 0.018 * beat), dx: on * 7 * K.wobble(t, 2.3, 1), dy: on * (-34 + 6 * K.wobble(t, 2.9, 2)) };
  },
  async init() {
    L = { street: buildStreet() };
  },
  render(ctx, t, env) {
    K.put(ctx, L.street);
    const px = env.pose ? env.pose.pt.head[0] : env.rider.lx;
    for (const p of PEOPLE) {
      const look = K.clamp((px - p.x) / 220, -1, 1);
      const excited = K.gate(t, 2.0, 5.6, 0.1, 0.6);
      const hop = excited * 9 * Math.abs(Math.sin((t * 2 + p.x * 0.01) * Math.PI));
      person(ctx, p, t, look, hop);
    }
    if (env.pose) flatPelican(ctx, env.pose);
    if (env.hero) {
      // outro wall: the 9:16 crop and its UI live inside the square panel
      const cw = (1000 * 9) / 16, x0 = (1000 - cw) / 2;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, x0, 1000);
      ctx.fillRect(x0 + cw, 0, x0, 1000);
      drawUI(ctx, x0, 0, cw, 1000, t - NARROW, 1);
    }
  },
  overlay(ctx, t) {
    if (t < NARROW || t > OPEN + 0.3) return;
    const pin = K.ease.out4(K.prog(t, NARROW, 0.13)), pout = K.ease.in3(K.prog(t, OPEN, 0.17));
    const bar = ((1920 - COL_W) / 2) * pin * (1 - pout);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, bar, 1080);
    ctx.fillRect(1920 - bar, 0, bar, 1080);
    const a = K.prog(t, NARROW + 0.06, 0.12) * (1 - K.prog(t, OPEN - 0.04, 0.1));
    drawUI(ctx, (1920 - COL_W) / 2, 0, COL_W, 1080, t - NARROW, a);
  },
};
