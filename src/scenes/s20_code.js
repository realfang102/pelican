// Section 20 — Code Aesthetics (2020s, the era of large language models)
// A calm dark code editor of our own theme above a full-width live preview. As the pelican rides through the
// preview, the file `pelican.svg` streams in line by line and the drawing follows it exactly: construction guides,
// outlines drawn on path by path behind a travelling pen point, flat fills popping in on the eighth-notes of bar 2,
// then refinement (gradients, shading, layered feathers, spoke highlights, a soft shadow) until the closing </svg>
// at t = 4.0 and a quiet "✓ valid" in the status bar. It rides on, finished: the most refined pelican in the film.
//
// Technique: crisp Canvas 2D. Window chrome, title, preview grid and every syntax-highlighted code line are baked
// in init; type-on is a clip of the baked line. The pelican is drawn per frame from env.pose with per-part reveal
// by arc length.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

let L = null;

// ------------------------------------------------------------------------------------------- layout
const HEAD_H = 104, TAB_Y = 104, TAB_H = 36, ED_Y = 140, ED_Y1 = 440, PV_BAR = 440, PV_Y = 468, PV_Y1 = 972, SB_Y = 972;
const GUT = 64, CODE_X = 80, LH = 19.5, FS = 14.5, VIS = 15;
const C = {
  win: '#0d0f14', head: '#0a0c10', ed: '#13161c', cur: '#1b1f28', gut: '#4a5162', gutCur: '#c3cad6', hair: '#232834',
  pv: '#161920', dot: '#2a303c', base: '#4d5668', accent: '#8ab4f8', text: '#d8dee9', dim: '#7d8596', ok: '#7fd49a',
  tag: '#8ab4f8', attr: '#d2b4ff', str: '#b7e1a1', punc: '#69728a', sel: '#ffcf8a', prop: '#8fd3d1', val: '#e9c7a0', plain: '#d8dee9',
};

// ------------------------------------------------------------------------------------------- the file
// [time, text]; every line appears in sync with what it draws.
const CODE = [
  [0.0, '<svg viewBox="0 0 296 322" xmlns="http://www.w3.org/2000/svg">'],
  [0.1, '  <defs>'],
  [0.18, '    <linearGradient id="plume" x2="0" y2="1">'],
  [0.26, '      <stop offset="0" stop-color="#ffffff"/>'],
  [0.34, '      <stop offset="1" stop-color="#cdd5e2"/>'],
  [0.42, '    </linearGradient>'],
  [0.5, '    <filter id="soft"><feGaussianBlur stdDeviation="4"/></filter>'],
  [0.58, '  </defs>'],
  [0.66, '  <circle class="wheel" cx="70" cy="268" r="50"/>'],
  [0.82, '  <circle class="wheel" cx="230" cy="268" r="50"/>'],
  [0.98, '  <path class="frame" d="M70 268 L140 222 L198 150 L104 162Z"/>'],
  [1.14, '  <path class="body" d="M156 104 C128 82 58 96 44 126 S118 168 156 104"/>'],
  [1.3, '  <path class="wing" d="M144 98 C108 90 50 112 40 136 L102 130"/>'],
  [1.46, '  <path class="neck" d="M150 100 C166 64 148 52 166 40"/>'],
  [1.58, '  <circle class="head" cx="174" cy="34" r="17"/>'],
  [1.7, '  <path class="beak" d="M188 30 L284 44 L190 42Z"/>'],
  [1.8, '  <path class="pouch" d="M190 42 Q238 74 280 48"/>'],
  [1.9, '  <path class="leg" d="M122 166 L150 214 L140 262"/>'],
  [2.0, '  <style>.wheel{fill:none;stroke:#1d2027}'],
  [2.25, '    .body,.neck,.head,.wing{fill:url(#plume)}'],
  [2.5, '    .beak{fill:#ffc857} .pouch{fill:#f28c45}'],
  [2.75, '    .frame{stroke:#ff6b57} .leg{stroke:#f39a4a}</style>'],
  [3.0, '  <path class="feathers" d="M60 120 q14 8 28 0 t28 0 t28 0"/>'],
  [3.4, '  <ellipse cx="148" cy="321" rx="132" ry="6" filter="url(#soft)"/>'],
  [3.7, '  <circle class="glint" cx="178" cy="29" r="2.4" fill="#fff"/>'],
  [4.0, '</svg>'],
];
const N = CODE.length;
const BYTES = CODE.reduce((a, [, s]) => a + s.length + 1, 0);

function tokenize(s) {
  const out = [];
  let i = 0, inTag = false, css = /^\s*(<style>|\.)/.test(s);
  const push = (str, col) => str && out.push([str, col]);
  while (i < s.length) {
    const r = s.slice(i);
    let m;
    if ((m = r.match(/^\s+/))) push(m[0], C.plain);
    else if ((m = r.match(/^"[^"]*"/))) push(m[0], C.str);
    else if ((m = r.match(/^<\/?/))) {
      push(m[0], C.punc);
      i += m[0].length;
      const n = s.slice(i).match(/^[a-zA-Z]+/);
      if (n) {
        push(n[0], C.tag);
        i += n[0].length;
      }
      inTag = true;
      if (n && n[0] === 'style') css = true;
      continue;
    } else if ((m = r.match(/^\/?>/))) {
      push(m[0], C.punc);
      inTag = false;
    } else if (inTag && (m = r.match(/^[a-zA-Z:-]+(?==)/))) push(m[0], C.attr);
    else if (css && (m = r.match(/^\.[a-z.,]+(?=[{ ,])/))) push(m[0], C.sel);
    else if (css && (m = r.match(/^[a-z-]+(?=:)/))) push(m[0], C.prop);
    else if ((m = r.match(/^[{}:;=,]/))) push(m[0], C.punc);
    else if ((m = r.match(/^[^\s"<>{}:;=,/]+/))) push(m[0], css ? C.val : C.plain);
    else m = [r[0]], push(r[0], C.plain);
    i += m[0].length;
  }
  return out;
}

/** typing state of the file at time t */
function fileAt(t) {
  let cur = -1;
  for (let i = 0; i < N; i++) if (t >= CODE[i][0]) cur = i;
  if (cur < 0) return { cur: -1, chars: 0, typing: false, frac: 0 };
  const t0 = CODE[cur][0], gap = (cur + 1 < N ? CODE[cur + 1][0] : t0 + 0.3) - t0;
  const len = CODE[cur][1].length;
  const dur = Math.min(0.03 + len * 0.0035, gap * 0.85);
  const frac = K.clamp((t - t0) / dur);
  return { cur, chars: Math.round(len * frac), typing: frac < 1, frac };
}

// ------------------------------------------------------------------------------------------- static layers
function buildChrome() {
  return K.layer(1000, 1000, 1.5, (c) => {
    c.fillStyle = C.win;
    c.fillRect(0, 0, 1000, 1000);
    // header strip = title card
    c.fillStyle = C.head;
    c.fillRect(0, 0, 1000, HEAD_H);
    c.fillStyle = C.hair;
    c.fillRect(0, HEAD_H - 1, 1000, 1);
    // a small mark of our own: a bracketed nib
    c.save();
    c.translate(46, 52);
    c.strokeStyle = C.accent;
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    K.roundRect(c, -18, -18, 36, 36, 9);
    c.stroke();
    c.beginPath();
    c.moveTo(-6, 9);
    c.lineTo(0, -9);
    c.lineTo(6, 9);
    c.moveTo(-3, 2);
    c.lineTo(3, 2);
    c.stroke();
    c.restore();
    const T = TITLES[20];
    K.text(c, T.zh, 84, 53, { size: 46, font: K.FONT.cjkSans, weight: 700, baseline: 'middle', color: '#eef1f6', tracking: 3 });
    const zw = K.measure(c, T.zh, { size: 46, font: K.FONT.cjkSans, weight: 700, tracking: 3 });
    c.fillStyle = C.hair;
    c.fillRect(84 + zw + 18, 26, 1, 54);
    K.text(c, T.en, 84 + zw + 38, 41, { size: 25, font: K.FONT.mono, weight: 700, baseline: 'middle', color: '#cfd6e2' });
    K.text(c, T.date, 84 + zw + 38, 73, { size: 22, font: K.FONT.mono, weight: 400, baseline: 'middle', color: C.accent });
    K.text(c, '~/studio/pelican', 960, 53, { size: 16, font: K.FONT.mono, weight: 400, baseline: 'middle', align: 'right', color: '#5b6375' });
    // tab bar
    c.fillStyle = C.win;
    c.fillRect(0, TAB_Y, 1000, TAB_H);
    c.fillStyle = C.ed;
    c.fillRect(0, TAB_Y, 196, TAB_H);
    c.fillStyle = C.accent;
    c.fillRect(0, TAB_Y, 196, 2);
    c.fillStyle = '#f2a04a';
    K.text(c, '<>', 18, TAB_Y + 19, { size: 13, font: K.FONT.mono, weight: 700, baseline: 'middle', color: '#f2a04a' });
    K.text(c, 'pelican.svg', 44, TAB_Y + 19, { size: 15, font: K.FONT.mono, weight: 400, baseline: 'middle', color: C.text });
    K.text(c, '×', 176, TAB_Y + 19, { size: 15, font: K.FONT.mono, weight: 400, baseline: 'middle', align: 'center', color: C.dim });
    K.text(c, 'notes.md', 222, TAB_Y + 19, { size: 15, font: K.FONT.mono, weight: 400, baseline: 'middle', color: '#5b6375' });
    c.fillStyle = C.hair;
    c.fillRect(196, TAB_Y, 1, TAB_H);
    c.fillRect(330, TAB_Y, 1, TAB_H);
    c.fillRect(0, ED_Y - 1, 1000, 1);
    // editor
    c.fillStyle = C.ed;
    c.fillRect(0, ED_Y, 1000, ED_Y1 - ED_Y);
    c.fillStyle = C.hair;
    c.fillRect(928, ED_Y, 1, ED_Y1 - ED_Y); // minimap divider
    // preview toolbar
    c.fillStyle = C.win;
    c.fillRect(0, PV_BAR, 1000, PV_Y - PV_BAR);
    c.fillStyle = C.hair;
    c.fillRect(0, PV_BAR, 1000, 1);
    c.fillRect(0, PV_Y - 1, 1000, 1);
    K.text(c, 'PREVIEW', 24, PV_BAR + 14.5, { size: 12.5, font: K.FONT.mono, weight: 700, baseline: 'middle', color: C.dim, tracking: 3 });
    K.text(c, 'pelican.svg · 296 × 322 · 100%', 976, PV_BAR + 14.5, { size: 12.5, font: K.FONT.mono, weight: 400, baseline: 'middle', align: 'right', color: '#5b6375' });
    // preview: dot grid, baseline guide with ticks
    c.fillStyle = C.pv;
    c.fillRect(0, PV_Y, 1000, PV_Y1 - PV_Y);
    c.fillStyle = C.dot;
    for (let y = PV_Y + 12; y < PV_Y1; y += 20) for (let x = 10; x < 1000; x += 20) c.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    c.fillStyle = 'rgba(138,180,248,0.06)';
    c.fillRect(0, 799, 1000, 2);
    c.fillStyle = C.base;
    c.fillRect(0, 799.5, 1000, 1);
    for (let x = 0; x <= 1000; x += 10) {
      const big = x % 50 === 0;
      c.fillRect(x - 0.5, 800, 1, big ? 8 : 4);
      if (x % 100 === 0 && x > 0 && x < 1000) K.text(c, String(x), x, 820, { size: 10.5, font: K.FONT.mono, align: 'center', color: '#465063' });
    }
    K.text(c, 'baseline  y = 800', 990, 790, { size: 11, font: K.FONT.mono, align: 'right', color: '#465063' });
    // status bar
    c.fillStyle = C.head;
    c.fillRect(0, SB_Y, 1000, 1000 - SB_Y);
    c.fillStyle = C.hair;
    c.fillRect(0, SB_Y, 1000, 1);
    K.text(c, '⎇ main   pelican.svg   SVG   UTF-8   LF', 18, SB_Y + 14.5, { size: 12.5, font: K.FONT.mono, baseline: 'middle', color: C.dim });
  });
}

function buildLines() {
  return CODE.map(([, s]) =>
    K.layer(840, LH, 2, (c) => {
      let x = 0;
      for (const [str, col] of tokenize(s)) {
        K.text(c, str, x, LH / 2 + 0.5, { size: FS, font: K.FONT.mono, baseline: 'middle', color: col });
        x += K.measure(c, str, { size: FS, font: K.FONT.mono });
      }
    }),
  );
}

// ------------------------------------------------------------------------------------------- editor per frame
function drawEditor(ctx, t) {
  const f = fileAt(t), cw = L.cw;
  const done = t >= CODE[N - 1][0] + 0.2;
  const tgt = (i) => K.clamp(i - (VIS - 1), 0, N - VIS);
  const scroll = f.cur < 0 ? 0 : K.lerp(tgt(f.cur - 1), tgt(f.cur), K.ease.io2(K.clamp((t - CODE[f.cur][0]) / 0.08)));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, ED_Y, 1000, ED_Y1 - ED_Y);
  ctx.clip();
  const y0 = ED_Y + 6 - scroll * LH;
  const cur = Math.max(0, f.cur);
  // current-line highlight
  const cy = y0 + cur * LH;
  ctx.fillStyle = C.cur;
  ctx.fillRect(0, cy, 928, LH);
  for (let i = 0; i <= Math.max(0, f.cur); i++) {
    const y = y0 + i * LH;
    if (y < ED_Y - LH || y > ED_Y1) continue;
    if (y < ED_Y && Math.abs(scroll - Math.round(scroll)) < 0.01) continue; // no half line peeking at rest
    K.text(ctx, String(i + 1), GUT - 14, y + LH / 2 + 0.5, { size: 13, font: K.FONT.mono, baseline: 'middle', align: 'right', color: i === cur ? C.gutCur : C.gut });
    if (f.cur < 0) continue;
    const chars = i < f.cur ? CODE[i][1].length : f.chars;
    if (chars <= 0) continue;
    const w = Math.min(840, chars * cw);
    ctx.drawImage(L.lines[i], 0, 0, w * 2, LH * 2, CODE_X, y, w, LH);
  }
  // cursor: solid while typing, blinking at rest
  const chars = f.cur < 0 ? 0 : f.chars;
  const blink = f.typing ? 1 : K.fract(t * 1.0) < 0.55 ? 1 : 0;
  if (blink) {
    ctx.fillStyle = C.accent;
    ctx.fillRect(CODE_X + chars * cw, cy + 2.5, 2, LH - 5);
  }
  ctx.restore();
  // minimap: the whole file in miniature
  ctx.save();
  ctx.globalAlpha = 0.75;
  for (let i = 0; i <= f.cur; i++) {
    const chars = i < f.cur ? CODE[i][1].length : f.chars;
    const w = chars * cw;
    ctx.drawImage(L.lines[i], 0, 0, Math.max(1, w * 2), LH * 2, 940, ED_Y + 10 + i * 4, w / 9, 3);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(138,180,248,0.08)';
  ctx.fillRect(932, ED_Y + 10 + scroll * 4 - 2, 64, VIS * 4 + 2);
  ctx.restore();
  // status bar, right side
  const typed = f.cur < 0 ? 0 : CODE.slice(0, f.cur).reduce((a, [, s]) => a + s.length + 1, 0) + f.chars;
  const ln = Math.max(1, f.cur + 1), col = chars + 1;
  let right = `Ln ${ln}, Col ${col}    ${((typed / BYTES) * 2.1).toFixed(1)} kB`;
  if (done) {
    const a = K.ease.out3(K.prog(t, CODE[N - 1][0], 0.25));
    K.text(ctx, '✓ valid · 2.1 kB', 982, SB_Y + 14.5, { size: 13, font: K.FONT.mono, weight: 700, baseline: 'middle', align: 'right', color: C.ok, alpha: a });
    right = `Ln ${ln}, Col ${col}`;
    K.text(ctx, right, 982 - 150, SB_Y + 14.5, { size: 12.5, font: K.FONT.mono, baseline: 'middle', align: 'right', color: C.dim });
  } else {
    K.text(ctx, right, 982, SB_Y + 14.5, { size: 12.5, font: K.FONT.mono, baseline: 'middle', align: 'right', color: C.dim });
  }
}

// ------------------------------------------------------------------------------------------- the pelican
const FLAT = {
  tire: '#1d2027', frame: '#ff6b57', metal: '#b8c0cc', saddle: '#2b2f38', leg: '#f39a4a', foot: '#f08a3c', body: '#f2f4f8', wing: '#e6eaf0',
  tail: '#dbe1ea', neck: '#f4f6f9', head: '#f6f8fb', beak: '#ffc857', pouch: '#f28c45', scarf: '#2fb3a5', mark: '#aab4c4',
};
const GRAD = {
  body: ['#ffffff', '#c6cfdd'], neck: ['#ffffff', '#dfe5ee'], head: ['#ffffff', '#e5eaf1'], tail: ['#eef1f6', '#a9b3c3'],
  beak: ['#ffe39a', '#f39a35'], pouch: ['#f8a85e', '#d45a35'], leg: ['#f8ad62', '#dc7330'], foot: ['#f8ad62', '#d86c2c'],
  scarf: ['#45cfbf', '#187268'], frame: ['#ff8775', '#de4434'], saddle: ['#3d4250', '#1d2027'], metal: ['#e3e8ef', '#8d96a5'],
};
const EDGE = { body: '#a7b2c4', neck: '#b9c3d2', head: '#b9c3d2', wing: '#9aa6b9', tail: '#8e9aae', beak: '#c97a1e', pouch: '#b54a2a', foot: '#b85a22', scarf: '#14635b', saddle: '#111318' };

// outline windows (t0, t1) by group, in the order the code writes them
function outlineWin(p, wheelIdx) {
  if (p.role === 'tire') return wheelIdx === 0 ? [0.66, 0.82] : [0.82, 0.98];
  if (p.role === 'frame' || p.role === 'metal' || p.role === 'saddle') return [0.98, 1.14];
  if (p.role === 'body' || p.role === 'tail') return [1.14, 1.3];
  if (p.role === 'wing' || (p.role === 'mark' && p.name.startsWith('wingMark'))) return [1.3, 1.46];
  if (p.role === 'neck' || p.role === 'scarf') return [1.46, 1.58];
  if (p.role === 'head' || p.role === 'eye') return [1.58, 1.7];
  if (p.role === 'beak') return [1.7, 1.8];
  if (p.role === 'pouch' || p.name === 'beakLine') return [1.8, 1.9];
  return [1.9, 2.0]; // legs, feet
}
function fillTime(p) {
  if (p.role === 'tire' || p.role === 'metal' || p.role === 'saddle') return 2.0;
  if (p.role === 'body' || p.role === 'neck' || p.role === 'head' || p.role === 'wing' || p.role === 'tail' || p.role === 'mark') return 2.25;
  if (p.role === 'beak' || p.role === 'pouch' || p.role === 'eye') return 2.5;
  return 2.75; // frame, legs, feet, scarf
}

function arcLens(pts, closed) {
  const L = [0];
  const n = pts.length + (closed ? 1 : 0);
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1], b = pts[i % pts.length];
    L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return L;
}
/** draw the first fraction u of a polyline; returns the pen point */
function partialPath(c, pts, u, closed) {
  const Ls = arcLens(pts, closed), tot = Ls[Ls.length - 1], target = tot * u;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  let tip = pts[0];
  const n = Ls.length;
  for (let i = 1; i < n; i++) {
    const b = pts[i % pts.length];
    if (Ls[i] <= target) {
      c.lineTo(b[0], b[1]);
      tip = b;
    } else {
      const a = pts[i - 1], k = (target - Ls[i - 1]) / (Ls[i] - Ls[i - 1] || 1);
      tip = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      c.lineTo(tip[0], tip[1]);
      break;
    }
  }
  return tip;
}
function yRange(pts) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) {
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return [y0, y1 + 0.01];
}
function xRange(pts) {
  let x0 = 1e9, x1 = -1e9;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
  }
  return [x0, x1 + 0.01];
}
function rimLight(c, pts, s, side = 1, col = 'rgba(190,225,255,0.75)', w = 2) {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  c.beginPath();
  let pen = false;
  for (const p of pts) {
    const on = (p[0] - cx) * side * 0.6 + (cy - p[1]) > 4 * s;
    if (on) {
      pen ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
      pen = true;
    } else pen = false;
  }
  c.strokeStyle = col;
  c.lineWidth = w * s;
  c.stroke();
}

function drawPelican(c, pose, t) {
  const s = pose.s;
  const parts = Rig.parts(pose);
  const R = K.smoothstep(3.0, 3.6, t); // gradients + refined edges
  const feath = K.smoothstep(3.0, 3.3, t), spk = K.smoothstep(3.15, 3.5, t), shadow = K.smoothstep(3.4, 3.7, t), glint = K.smoothstep(3.7, 3.8, t);
  const outA = 1 - 0.92 * R;
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  // soft ground shadow
  if (shadow > 0) {
    c.save();
    c.globalAlpha = shadow;
    c.translate(pose.x - 4 * s, K.ROAD_Y + 3 * s);
    c.scale(1, 0.06);
    c.fillStyle = K.radGrad(c, 0, 0, 0, 155 * s, [[0, 'rgba(0,0,0,0.85)'], [0.6, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]);
    c.fillRect(-160 * s, -160 * s, 320 * s, 320 * s);
    c.restore();
  }
  let pen = null, wheelIdx = 0;
  for (const p of parts) {
    const [w0, w1] = outlineWin(p, p.role === 'tire' ? wheelIdx++ : 0);
    const ou = K.clamp((t - w0) / (w1 - w0));
    const fT = fillTime(p), fa = K.clamp((t - fT) / 0.09);
    const pop = fa > 0 && fa < 1 ? 1 + 0.04 * Math.sin(fa * Math.PI) : 1;
    if (ou <= 0 && fa <= 0) continue;
    c.globalAlpha = p.far ? 0.8 : 1;
    if (p.kind === 'poly') {
      if (fa > 0) {
        c.save();
        c.globalAlpha *= fa;
        K.path(c, p.pts, true);
        c.fillStyle = FLAT[p.role] || '#999';
        c.fill();
        if (R > 0) {
          c.globalAlpha = (p.far ? 0.8 : 1) * fa * R;
          if (p.role === 'wing') {
            // the folded wing darkens to black primaries at its tip
            const [x0, x1] = xRange(p.pts);
            c.fillStyle = K.linGrad(c, x1, 0, x0, 0, [[0, '#f6f8fb'], [0.55, '#d8dee8'], [0.8, '#7d889a'], [1, '#2a303b']]);
          } else if (p.name === 'arm') {
            const [x0, x1] = xRange(p.pts);
            c.fillStyle = K.linGrad(c, x0, 0, x1, 0, [[0, '#e9edf3'], [0.7, '#cfd6e1'], [1, '#3a414d']]);
          } else {
            const g = GRAD[p.role];
            if (g) {
              const [y0, y1] = yRange(p.pts);
              c.fillStyle = K.linGrad(c, 0, y0, 0, y1, [[0, g[0]], [1, g[1]]]);
            }
          }
          c.fill();
          // refined edge in the part's own darker tone
          const e = EDGE[p.role];
          if (e) {
            c.strokeStyle = e;
            c.lineWidth = 1.1 * s;
            c.stroke();
          }
        }
        // shading and detail inside the big shapes
        if (R > 0 && p.role === 'body') {
          c.save();
          K.path(c, p.pts, true);
          c.clip();
          const [x0, x1] = xRange(p.pts), [y0, y1] = yRange(p.pts);
          c.globalAlpha = fa * R;
          c.fillStyle = K.radGrad(c, x0 + (x1 - x0) * 0.35, y1 + 10 * s, 4 * s, (y1 - y0) * 0.95, [[0, 'rgba(90,105,135,0.45)'], [1, 'rgba(90,105,135,0)']]);
          c.fillRect(x0, y0, x1 - x0, y1 - y0);
          c.restore();
        }
        if (feath > 0 && p.role === 'wing' && p.name === 'wing') drawFeathers(c, p.pts, pose, feath * fa);
        if (R > 0 && p.role === 'tail') {
          c.globalAlpha = fa * R * 0.6;
          c.strokeStyle = '#ffffff';
          c.lineWidth = 0.9 * s;
          K.path(c, [p.pts[0], p.pts[1]]);
          c.stroke();
        }
        if (R > 0 && p.role === 'beak') {
          // ridge highlight along the upper mandible
          c.globalAlpha = fa * R * 0.85;
          c.strokeStyle = '#fff3c9';
          c.lineWidth = 1.6 * s;
          const P = p.pts, k = Math.floor(P.length / 2);
          K.spline(c, P.slice(0, k + 1), false);
          c.stroke();
        }
        if (R > 0 && p.role === 'pouch') {
          c.save();
          K.path(c, p.pts, true);
          c.clip();
          c.globalAlpha = fa * R * 0.5;
          const [x0, x1] = xRange(p.pts), [y0, y1] = yRange(p.pts);
          c.strokeStyle = '#c2512e';
          c.lineWidth = 1 * s;
          for (let k = 1; k <= 3; k++) {
            c.beginPath();
            c.moveTo(x0 + (x1 - x0) * (0.15 + k * 0.17), y0 + 2 * s);
            c.quadraticCurveTo(x0 + (x1 - x0) * (0.1 + k * 0.17), y0 + (y1 - y0) * 0.6, x0 + (x1 - x0) * (0.22 + k * 0.17), y1);
            c.stroke();
          }
          c.restore();
        }
        if (R > 0 && (p.role === 'head' || p.role === 'neck' || p.role === 'body')) {
          c.globalAlpha = fa * R;
          c.save();
          c.globalCompositeOperation = 'lighter';
          rimLight(c, p.pts, s, 1, 'rgba(150,200,255,0.55)', 1.8);
          c.restore();
        }
        c.restore();
      }
      if (ou > 0 && outA > 0.02) {
        c.save();
        c.globalAlpha *= outA * (fa > 0 ? 0.55 : 1);
        const tip = partialPath(c, p.pts, ou, true);
        c.strokeStyle = '#d3dae6';
        c.lineWidth = 1.4 * s;
        c.stroke();
        if (ou < 1) pen = tip;
        c.restore();
      }
    } else if (p.kind === 'line') {
      if (fa > 0) {
        c.save();
        c.globalAlpha *= fa;
        K.path(c, p.pts, false);
        const w = p.role === 'mark' ? 1.2 * s : p.w * pop;
        if (p.role === 'mark') {
          c.strokeStyle = 'rgba(140,152,172,0.8)';
          c.globalAlpha *= 1 - feath * 0.7;
        } else c.strokeStyle = FLAT[p.role] || '#999';
        c.lineWidth = w;
        c.stroke();
        if (R > 0 && p.role !== 'mark') {
          const g = GRAD[p.role];
          if (g) {
            const [y0, y1] = yRange(p.pts);
            c.globalAlpha = fa * R * (p.far ? 0.8 : 1);
            c.strokeStyle = K.linGrad(c, 0, y0 - p.w, 0, y1 + p.w, [[0, g[0]], [1, g[1]]]);
            c.stroke();
          }
          if (p.role === 'frame' || p.role === 'metal') {
            // specular stripe along the tube
            c.globalAlpha = fa * R * 0.7;
            c.save();
            c.translate(-0.25 * p.w, -0.3 * p.w);
            K.path(c, p.pts, false);
            c.strokeStyle = p.role === 'frame' ? '#ffc2b8' : '#ffffff';
            c.lineWidth = Math.max(0.8, p.w * 0.22);
            c.stroke();
            c.restore();
          }
          if (p.name.startsWith('finger')) {
            c.globalAlpha = fa * R;
            K.path(c, p.pts, false);
            c.strokeStyle = '#323844';
            c.lineWidth = p.w * 0.9;
            c.stroke();
          }
        }
        c.restore();
      }
      if (ou > 0 && outA > 0.02) {
        c.save();
        c.globalAlpha *= outA * (fa > 0 ? 0.5 : 1);
        const tip = partialPath(c, p.pts, ou, false);
        c.strokeStyle = '#d3dae6';
        c.lineWidth = 1.3 * s;
        c.stroke();
        if (ou < 1) pen = tip;
        c.restore();
      }
    } else if (p.kind === 'wheel') {
      if (fa > 0) {
        c.save();
        c.globalAlpha *= fa;
        // spokes: flat first, then highlighted
        const n = spk > 0 ? 18 : 12;
        c.beginPath();
        for (const [a, b] of Rig.spokes(p, n, 0.1, 0.84)) {
          c.moveTo(a[0], a[1]);
          c.lineTo(b[0], b[1]);
        }
        c.strokeStyle = '#8f98a8';
        c.lineWidth = 0.9 * s;
        c.stroke();
        if (spk > 0) {
          c.globalAlpha = fa * spk;
          c.beginPath();
          for (const [a, b] of Rig.spokes(p, 18, 0.1, 0.84)) {
            const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
            if (Math.cos(ang + 2.3) > 0.82) {
              c.moveTo(a[0], a[1]);
              c.lineTo(b[0], b[1]);
            }
          }
          c.strokeStyle = '#ffffff';
          c.lineWidth = 1.1 * s;
          c.stroke();
          // rim
          c.beginPath();
          c.arc(p.c[0], p.c[1], p.r * 0.85, 0, K.TAU);
          c.strokeStyle = '#c9d0da';
          c.lineWidth = 2.2 * s;
          c.stroke();
          c.globalAlpha = fa;
        }
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r * 0.93, 0, K.TAU);
        c.strokeStyle = FLAT.tire;
        c.lineWidth = p.r * 0.15 * pop;
        c.stroke();
        if (spk > 0) {
          c.globalAlpha = fa * spk;
          c.beginPath();
          c.arc(p.c[0], p.c[1], p.r * 0.96, Math.PI * 1.08, Math.PI * 1.62);
          c.strokeStyle = 'rgba(160,190,235,0.55)';
          c.lineWidth = 1.6 * s;
          c.stroke();
          c.globalAlpha = fa;
        }
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r * 0.11, 0, K.TAU);
        c.fillStyle = spk > 0 ? K.radGrad(c, p.c[0] - 2 * s, p.c[1] - 2 * s, 0, p.r * 0.13, [[0, '#ffffff'], [1, '#8d96a5']]) : '#b8c0cc';
        c.fill();
        c.restore();
      }
      if (ou > 0 && outA > 0.02) {
        c.save();
        c.globalAlpha *= outA * (fa > 0 ? 0.5 : 1);
        c.beginPath();
        const a0 = -Math.PI / 2;
        c.arc(p.c[0], p.c[1], p.r, a0, a0 + K.TAU * ou);
        c.strokeStyle = '#d3dae6';
        c.lineWidth = 1.4 * s;
        c.stroke();
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r * 0.86, a0, a0 + K.TAU * ou);
        c.lineWidth = 1 * s;
        c.stroke();
        if (ou < 1) pen = [p.c[0] + Math.cos(a0 + K.TAU * ou) * p.r, p.c[1] + Math.sin(a0 + K.TAU * ou) * p.r];
        c.restore();
      }
    } else if (p.kind === 'disc') {
      if (fa > 0) {
        c.save();
        c.globalAlpha *= fa;
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r, 0, K.TAU);
        c.fillStyle = R > 0 ? K.radGrad(c, p.c[0] - p.r * 0.3, p.c[1] - p.r * 0.3, 0, p.r * 1.2, [[0, '#f1f4f8'], [1, '#8d96a5']]) : '#c3cad6';
        c.fill();
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r * 0.35, 0, K.TAU);
        c.fillStyle = '#5c6474';
        c.fill();
        c.restore();
      }
      if (ou > 0 && outA > 0.02) {
        c.save();
        c.globalAlpha *= outA;
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r, -Math.PI / 2, -Math.PI / 2 + K.TAU * ou);
        c.strokeStyle = '#d3dae6';
        c.lineWidth = 1 * s;
        c.stroke();
        c.restore();
      }
    } else if (p.kind === 'eye') {
      if (fa > 0) {
        c.save();
        c.globalAlpha *= fa;
        // bare skin around the eye, then the eye
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r * 1.55, 0, K.TAU);
        c.fillStyle = R > 0 ? K.mix('#f6f8fb', '#f7c9a0', R) : '#f6f8fb';
        c.fill();
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r, 0, K.TAU);
        c.fillStyle = '#fffaf0';
        c.fill();
        if (p.lid < 0.5) {
          c.beginPath();
          c.arc(p.pupil[0], p.pupil[1], p.pr * 1.15, 0, K.TAU);
          c.fillStyle = '#15181e';
          c.fill();
          if (glint > 0) {
            c.globalAlpha = fa * glint;
            c.beginPath();
            c.arc(p.pupil[0] - p.pr * 0.4, p.pupil[1] - p.pr * 0.45, p.pr * 0.5, 0, K.TAU);
            c.fillStyle = '#ffffff';
            c.fill();
            c.beginPath();
            c.arc(p.pupil[0] + p.pr * 0.45, p.pupil[1] + p.pr * 0.4, p.pr * 0.2, 0, K.TAU);
            c.fill();
          }
        } else {
          c.beginPath();
          c.moveTo(p.c[0] - p.r, p.c[1]);
          c.lineTo(p.c[0] + p.r, p.c[1]);
          c.strokeStyle = '#15181e';
          c.lineWidth = 1.2 * s;
          c.stroke();
        }
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r, 0, K.TAU);
        c.strokeStyle = '#8b6a50';
        c.lineWidth = 0.9 * s;
        c.stroke();
        c.restore();
      }
      if (ou > 0 && outA > 0.02) {
        c.save();
        c.globalAlpha *= outA;
        c.beginPath();
        c.arc(p.c[0], p.c[1], p.r, -Math.PI / 2, -Math.PI / 2 + K.TAU * ou);
        c.strokeStyle = '#d3dae6';
        c.lineWidth = 1 * s;
        c.stroke();
        c.restore();
      }
    }
  }
  // a glint on the beak
  if (glint > 0) {
    const bt = pose.pt.beakTip, bb = pose.pt.beakBase;
    const x = K.lerp(bb[0], bt[0], 0.3), y = K.lerp(bb[1], bt[1], 0.3) - 3.5 * s;
    c.globalAlpha = glint * 0.9;
    c.fillStyle = K.radGrad(c, x, y, 0, 7 * s, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(x - 8 * s, y - 8 * s, 16 * s, 16 * s);
  }
  // the pen point
  if (pen) {
    c.globalAlpha = 1;
    c.beginPath();
    c.arc(pen[0], pen[1], 7 * s, 0, K.TAU);
    c.fillStyle = 'rgba(138,180,248,0.22)';
    c.fill();
    c.beginPath();
    c.arc(pen[0], pen[1], 3 * s, 0, K.TAU);
    c.fillStyle = C.accent;
    c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1 * s;
    c.stroke();
  }
  c.restore();
}

/** layered feathers over the folded wing: three scalloped rows, cooler and darker toward the tip */
function drawFeathers(c, wing, pose, a) {
  const s = pose.s;
  c.save();
  K.path(c, wing, true);
  c.clip();
  c.globalAlpha = a;
  const marks = pose.shapes.wingMarks;
  const tones = ['#e4e9f0', '#d2d9e4', '#bcc5d3'];
  marks.forEach((m, k) => {
    const pts = K.resample(m, 9 * s);
    if (pts.length < 2) return;
    // a band from this row downward, with a scalloped upper edge (feather tips overlapping)
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1] + 40 * s);
    c.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      c.quadraticCurveTo(mx + 1.5 * s, my + 7 * s, p1[0], p1[1]);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last[0] - 30 * s, last[1] + 40 * s);
    c.closePath();
    const [x0, x1] = xRange(pts);
    c.fillStyle = K.linGrad(c, x1, 0, x0 - 20 * s, 0, [[0, tones[k]], [0.7, K.shade(tones[k], -0.12)], [1, '#4a5260']]);
    c.fill();
    // the scallop edge and a quill per feather
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 1 * s;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      c.quadraticCurveTo((p0[0] + p1[0]) / 2 + 1.5 * s, (p0[1] + p1[1]) / 2 + 7 * s, p1[0], p1[1]);
    }
    c.stroke();
    c.strokeStyle = 'rgba(120,132,152,0.5)';
    c.lineWidth = 0.7 * s;
    c.beginPath();
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      c.moveTo(mx + 1 * s, my + 5 * s);
      c.lineTo(mx - 6 * s, my + 14 * s);
    }
    c.stroke();
  });
  c.restore();
}

function drawGuides(c, pose, t) {
  const a = K.smoothstep(-0.5, 0.0, t) * (1 - K.smoothstep(3.0, 3.8, t));
  if (a <= 0) return;
  const s = pose.s, b = pose.bbox;
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = 'rgba(138,180,248,0.55)';
  c.lineWidth = 1;
  // bounding box (draws itself on), with corner handles
  const bu = K.clamp((t + 0.5) / 0.6);
  c.setLineDash([5, 4]);
  const box = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
  partialPath(c, box, bu, true);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = C.pv;
  c.strokeStyle = C.accent;
  for (const [x, y] of box) {
    c.fillRect(x - 3.5, y - 3.5, 7, 7);
    c.strokeRect(x - 3.5, y - 3.5, 7, 7);
  }
  // centre line + wheel guide circles
  const gu = K.clamp((t - 0.1) / 0.35);
  c.strokeStyle = 'rgba(138,180,248,0.4)';
  c.beginPath();
  c.moveTo(pose.x, b.y0 - 10);
  c.lineTo(pose.x, K.ROAD_Y + 10);
  c.stroke();
  for (const w of pose.wheels) {
    c.beginPath();
    c.arc(w.c[0], w.c[1], w.r, -Math.PI / 2, -Math.PI / 2 + K.TAU * gu);
    c.stroke();
    c.beginPath();
    c.moveTo(w.c[0] - 6, w.c[1]);
    c.lineTo(w.c[0] + 6, w.c[1]);
    c.moveTo(w.c[0], w.c[1] - 6);
    c.lineTo(w.c[0], w.c[1] + 6);
    c.stroke();
  }
  // anchors with bézier handles
  const hu = K.clamp((t - 0.25) / 0.35);
  const P = pose.pt;
  const anchors = [[P.head, 0.2], [P.beakTip, -0.1], [P.beakBase, 0.6], [P.neckBase, 1.3], [P.shoulder, 0.1], [P.saddle, 0], [P.hip, 0.9], [P.grip, 0.4], [P.bb, 0]];
  anchors.forEach(([p, ang], i) => {
    const k = K.clamp(hu * anchors.length - i);
    if (k <= 0) return;
    const L = 20 * s * k, dx = Math.cos(ang) * L, dy = Math.sin(ang) * L;
    c.strokeStyle = 'rgba(138,180,248,0.6)';
    c.beginPath();
    c.moveTo(p[0] - dx, p[1] - dy);
    c.lineTo(p[0] + dx, p[1] + dy);
    c.stroke();
    c.fillStyle = C.accent;
    for (const q of [[p[0] - dx, p[1] - dy], [p[0] + dx, p[1] + dy]]) {
      c.beginPath();
      c.arc(q[0], q[1], 2.4, 0, K.TAU);
      c.fill();
    }
    c.fillStyle = '#ffffff';
    c.fillRect(p[0] - 2.6, p[1] - 2.6, 5.2, 5.2);
  });
  c.restore();
}

// ------------------------------------------------------------------------------------------- scene
export default {
  id: 20, key: 'code', title: TITLES[20], heroT: 4.5,
  async init() {
    L = { chrome: buildChrome(), lines: buildLines() };
    const cv = K.makeCanvas(10, 10).getContext('2d');
    L.cw = K.measure(cv, 'MMMMMMMMMM', { size: FS, font: K.FONT.mono }) / 10;
  },
  render(ctx, t, env) {
    K.put(ctx, L.chrome);
    drawEditor(ctx, t);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, PV_Y, 1000, PV_Y1 - PV_Y);
    ctx.clip();
    if (env.pose) {
      drawGuides(ctx, env.pose, t);
      drawPelican(ctx, env.pose, t);
    }
    ctx.restore();
  },
};
