// Section 15 — Oscilloscope Vector Graphics (1950s)
// The face of a laboratory instrument: a big round green-phosphor tube behind a ruled graticule, set in a black
// wrinkle-finish panel with fluted bakelite knobs, engraved legends, an amber pilot lamp and an engraved maker's
// nameplate (the title card). The pelican is a vector trace with phosphor persistence and scan jitter; the road is
// the baseline trace, with a slow idle sweep running along it.
// Gag: a technician's hand comes in for the FOCUS knob and, on the downbeat of bar 2, turns MODE to X–Y instead:
// every point of the pelican is remapped onto a 3 : 2 Lissajous figure. On the next beat it is yanked back and the
// pelican snaps into shape. The hand holds still for a moment, then withdraws.
//
// Technique: pure Canvas 2D. Panel, face and glass are baked; per frame the trace (scope_trace.js, shared with
// section 14 so the two halves match across the frame post), the road trace, the MODE knob and the hand.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import * as Beat from '../beat/index.js';
import { TITLES } from './titles.js';
import { drawPersist, lissajous, drawTrace } from './scope_trace.js';

const TAU = Math.PI * 2, D = Math.PI / 180;
const RY = K.ROAD_Y;
// the tube: glass reaches both side edges at the road line (500² + 120² < 522²)
const CX = 500, CY = 680, CR = 522, BEZ = 548;
const MODE = { x: 905, y: 228, r: 31 };
const KNOBS = [
  { x: 78, y: 84, r: 28, label: 'INTENSITY' },
  { x: 200, y: 84, r: 28, label: 'FOCUS' },
  { x: 800, y: 84, r: 28, label: 'X GAIN' },
  { x: 924, y: 84, r: 28, label: 'Y GAIN' },
];
const PANEL = '#26292b';

// the wrong knob: 0 → 1 on the downbeat of bar 2, back on the next beat
const W0 = 2.0, W1 = 2.5;
export const warpAt = (t) => K.smoothstep(W0, W0 + 0.025, t) * (1 - K.smoothstep(W1, W1 + 0.025, t));
const warpFn = (tk, pose) => lissajous(pose, warpAt(tk), tk, { a: 3, b: 2, rx: 176, ry: 142 });

let L = null;

// ------------------------------------------------------------------------------------------------ baking
const engrave = (c, str, x, y, o) => {
  K.text(c, str, x - 0.9, y - 0.9, { ...o, color: 'rgba(0,0,0,0.85)' });
  K.text(c, str, x + 0.5, y + 0.6, { ...o, color: 'rgba(255,255,255,0.12)' });
  K.text(c, str, x, y, o);
};

function screw(c, x, y, r = 6, a = 0.6) {
  c.fillStyle = K.radGrad(c, x - r * 0.3, y - r * 0.3, 0, r * 1.2, [[0, '#c9ccc8'], [0.6, '#7d817f'], [1, '#3a3d3c']]);
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = '#2a2c2b'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(x - Math.cos(a) * r * 0.8, y - Math.sin(a) * r * 0.8); c.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); c.stroke();
}

/** fluted bakelite knob, pointer at angle a (0 = up) */
function knob(c, x, y, r, a) {
  c.save();
  c.translate(x, y);
  // shadow on the panel
  c.fillStyle = 'rgba(0,0,0,0.5)';
  c.beginPath(); c.arc(4, 6, r * 1.04, 0, TAU); c.fill();
  // skirt
  c.fillStyle = K.radGrad(c, -r * 0.3, -r * 0.4, 0, r * 1.3, [[0, '#3b3532'], [1, '#0d0b0a']]);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.rotate(a);
  // flutes
  for (let i = 0; i < 20; i++) {
    const q = (i / 20) * TAU, lit = Math.cos(q + 0.9 + a) * 0.5 + 0.5;
    c.strokeStyle = `rgba(${Math.round(40 + 70 * lit)},${Math.round(36 + 62 * lit)},${Math.round(34 + 58 * lit)},0.9)`;
    c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(Math.cos(q) * r * 0.72, Math.sin(q) * r * 0.72); c.lineTo(Math.cos(q) * r * 0.97, Math.sin(q) * r * 0.97); c.stroke();
  }
  c.rotate(-a);
  // cap
  c.fillStyle = K.radGrad(c, -r * 0.25, -r * 0.3, 0, r * 0.8, [[0, '#4a4440'], [0.55, '#1c1816'], [1, '#090807']]);
  c.beginPath(); c.arc(0, 0, r * 0.68, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, r * 0.68, -2.6, -1.0); c.stroke();
  // pointer
  c.rotate(a);
  c.strokeStyle = '#ece8dc'; c.lineWidth = 2.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -r * 0.2); c.lineTo(0, -r * 0.92); c.stroke();
  c.restore();
  // specular
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.38, r * 0.2, r * 0.1, -0.6, 0, TAU); c.fill();
}

function scaleTicks(c, x, y, r, from, to, n, labels = null) {
  c.strokeStyle = '#d9d6cc'; c.lineWidth = 1.2;
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n - Math.PI / 2, l = i % 2 ? 4 : 7;
    c.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4));
    c.lineTo(x + Math.cos(a) * (r + 4 + l), y + Math.sin(a) * (r + 4 + l));
  }
  c.stroke();
  if (labels) for (const [a, s] of labels) {
    const q = a - Math.PI / 2;
    engrave(c, s, x + Math.cos(q) * (r + 22), y + Math.sin(q) * (r + 22) + 4, { size: 11, font: K.FONT.sans, weight: 600, align: 'center', color: '#e4e1d6', tracking: 1 });
  }
}

function bakePanel(title) {
  return K.layer(1000, 1000, 1.25, (c) => {
    // wrinkle-finish black enamel
    c.fillStyle = K.linGrad(c, 0, 0, 0, 1000, [[0, '#33373a'], [0.35, PANEL], [1, '#16181a']]);
    c.fillRect(0, 0, 1000, 1000);
    K.put(c, K.noiseLayer({ scale: 3.2, oct: 3, seed: 151, color: '#000000', lo: 0.38, hi: 0.72, alpha: 0.55, res: 1.25, ridged: true }), 0, 0, 1000, 1000);
    K.put(c, K.noiseLayer({ scale: 2.4, oct: 2, seed: 152, color: '#9aa2a6', lo: 0.6, hi: 0.9, alpha: 0.22, res: 1.25, ridged: true }), 0, 0, 1000, 1000);
    K.put(c, K.noiseLayer({ scale: 160, seed: 153, color: '#000000', lo: 0.4, hi: 0.85, alpha: 0.25 }), 0, 0, 1000, 1000);
    K.grain(c, 0, 0, 1000, 1000, { color: '#000000', alpha: 0.18, seed: 154, size: 1 });
    // a soft lit edge along the top
    c.fillStyle = K.linGrad(c, 0, 0, 0, 30, [[0, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 1000, 30);

    // the tube opening + bezel (black moulded ring, a chromed lip, four screws)
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.beginPath(); c.arc(CX + 5, CY + 8, BEZ + 6, 0, TAU); c.fill();
    c.fillStyle = K.radGrad(c, CX - 160, CY - 260, 60, BEZ + 60, [[0, '#4a4d4e'], [0.55, '#1a1b1c'], [1, '#060707']]);
    c.beginPath(); c.arc(CX, CY, BEZ, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(CX, CY, BEZ - 1, Math.PI * 1.05, Math.PI * 1.7); c.stroke();
    c.strokeStyle = K.linGrad(c, CX - 300, CY - 500, CX + 300, CY, [[0, '#d8dcda'], [0.5, '#5e6362'], [1, '#2a2d2d']]);
    c.lineWidth = 3.2;
    c.beginPath(); c.arc(CX, CY, CR + 3, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.arc(CX, CY, CR, 0, TAU); c.fill();
    c.restore();
    for (const a of [-130, -50]) screw(c, CX + Math.cos(a * D) * (BEZ - 13), CY + Math.sin(a * D) * (BEZ - 13), 6.5, a * 0.03);

    // the maker's nameplate (title card): black anodised, engraved, white-filled
    const px = 294, py = 12, pw = 412, ph = 116;
    c.fillStyle = 'rgba(0,0,0,0.6)'; K.roundRect(c, px + 3, py + 5, pw, ph, 6); c.fill();
    c.fillStyle = K.linGrad(c, 0, py, 0, py + ph, [[0, '#a9aeac'], [0.5, '#6d7271'], [1, '#3e4241']]);
    K.roundRect(c, px, py, pw, ph, 6); c.fill();
    c.fillStyle = '#0d0f10'; K.roundRect(c, px + 4, py + 4, pw - 8, ph - 8, 4); c.fill();
    c.save();
    K.roundRect(c, px + 4, py + 4, pw - 8, ph - 8, 4); c.clip();
    const r = K.rng(1555);
    c.lineWidth = 0.6;
    for (let i = 0; i < 160; i++) { // brushed grain
      const y = py + 4 + r() * (ph - 8);
      c.strokeStyle = `rgba(255,255,255,${r.range(0.015, 0.05)})`;
      c.beginPath(); c.moveTo(px, y); c.lineTo(px + pw, y + r.range(-0.4, 0.4)); c.stroke();
    }
    c.fillStyle = K.linGrad(c, px, py, px + pw, py + ph, [[0, 'rgba(255,255,255,0.08)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.2)']]);
    c.fillRect(px, py, pw, ph);
    c.restore();
    c.strokeStyle = '#d8d6cc'; c.lineWidth = 1;
    K.roundRect(c, px + 11, py + 11, pw - 22, ph - 22, 2); c.stroke();
    for (const [sx, sy] of [[px + 11, py + 11], [px + pw - 11, py + 11], [px + 11, py + ph - 11], [px + pw - 11, py + ph - 11]]) screw(c, sx, sy, 4.6, sx * 0.01);
    const W = '#f1efe6';
    engrave(c, title.zh, 500, py + 56, { size: 44, font: K.FONT.cjkSans, weight: 700, align: 'center', color: W, tracking: 6 });
    engrave(c, title.en, 500, py + 86, { size: 25, font: K.FONT.sans, weight: 600, align: 'center', color: W, tracking: 1.2, maxWidth: 360 });
    engrave(c, title.date, 500, py + 108, { size: 21, font: K.FONT.sans, weight: 600, align: 'center', color: W, tracking: 3 });
    engrave(c, 'MERIDIAN', px + 28, py + 106, { size: 11, font: K.FONT.sans, weight: 700, color: '#bdbab0', tracking: 2 });
    engrave(c, 'MODEL 15-A', px + pw - 28, py + 106, { size: 11, font: K.FONT.sans, weight: 700, align: 'right', color: '#bdbab0', tracking: 2 });

    // fixed knobs with engraved legends and scales
    for (const k of KNOBS) {
      engrave(c, k.label, k.x, k.y - k.r - 18, { size: 12, font: K.FONT.sans, weight: 700, align: 'center', color: '#e8e5da', tracking: 1.5 });
      scaleTicks(c, k.x, k.y, k.r, -135 * D, 135 * D, 10);
      knob(c, k.x, k.y, k.r, (k.x * 0.37) % 2 - 1);
    }
    // MODE selector legends (its knob is drawn per frame)
    scaleTicks(c, MODE.x, MODE.y, MODE.r, -40 * D, 40 * D, 2, [[-40 * D, 'SWEEP'], [40 * D, 'X–Y']]);
    engrave(c, 'MODE', MODE.x, MODE.y + MODE.r + 24, { size: 12, font: K.FONT.sans, weight: 700, align: 'center', color: '#e8e5da', tracking: 1.5 });

    // pilot lamp housing (the jewel is lit per frame)
    c.fillStyle = K.radGrad(c, 66, 170, 0, 20, [[0, '#9a9e9c'], [0.7, '#4c504f'], [1, '#1c1e1e']]);
    c.beginPath(); c.arc(70, 176, 18, 0, TAU); c.fill();
    engrave(c, 'POWER', 70, 216, { size: 12, font: K.FONT.sans, weight: 700, align: 'center', color: '#e8e5da', tracking: 1.5 });
    // toggle switch
    c.fillStyle = '#8d918f'; c.beginPath(); c.arc(160, 176, 11, 0, TAU); c.fill();
    c.strokeStyle = '#2a2c2c'; c.lineWidth = 1; c.stroke();
    c.strokeStyle = '#d6d8d4'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(160, 176); c.lineTo(166, 152); c.stroke();
    engrave(c, 'ON', 160, 140, { size: 11, font: K.FONT.sans, weight: 700, align: 'center', color: '#e8e5da' });
    // serial plate
    c.fillStyle = '#b7b9b2'; K.roundRect(c, 24, 238, 104, 30, 2); c.fill();
    c.strokeStyle = '#555'; c.lineWidth = 0.8; c.stroke();
    K.text(c, 'SER. No. 1515', 76, 257, { size: 10.5, font: K.FONT.mono, weight: 700, align: 'center', color: '#1d1f1e' });
    screw(c, 31, 253, 2.6); screw(c, 121, 253, 2.6);
    // corner screws of the panel
    for (const [x, y] of [[18, 18], [982, 18]]) screw(c, x, y, 7, x * 0.003);
    // right-hand legend plate
    engrave(c, 'CALIBRATED  1 V / DIV', 820, 300, { size: 10.5, font: K.FONT.sans, weight: 700, align: 'center', color: '#c9c6bb', tracking: 1.5 });
  });
}

function bakeFace() {
  return K.layer(1000, 1000, 1, (c) => {
    c.fillStyle = K.radGrad(c, CX, CY - 60, 0, CR, [[0, '#050d08'], [0.65, '#030805'], [1, '#000201']]);
    c.fillRect(0, 0, 1000, 1000);
    K.put(c, K.noiseLayer({ scale: 90, seed: 156, color: '#14301e', lo: 0.5, hi: 0.9, alpha: 0.2 }), 0, 0, 1000, 1000);
    K.grain(c, 0, 0, 1000, 1000, { color: '#3d7a52', alpha: 0.05, seed: 157, size: 1 });
  });
}

function bakeGraticule() {
  return K.layer(1000, 1000, 1.25, (c) => {
    c.save();
    c.beginPath(); c.arc(CX, CY, CR - 2, 0, TAU); c.clip();
    const G = 80;
    c.strokeStyle = 'rgba(150,185,160,0.2)'; c.lineWidth = 1;
    c.beginPath();
    for (let x = CX - 6 * G; x <= CX + 6 * G; x += G) { c.moveTo(x, 0); c.lineTo(x, 1000); }
    for (let y = RY - 8 * G; y <= 1000; y += G) { c.moveTo(0, y); c.lineTo(1000, y); }
    c.stroke();
    // minor ticks on the centre axes
    c.strokeStyle = 'rgba(150,185,160,0.3)';
    c.beginPath();
    for (let x = CX - 6 * G; x <= CX + 6 * G; x += G / 5) { c.moveTo(x, CY - 40 - 4); c.lineTo(x, CY - 40 + 4); }
    for (let y = RY - 8 * G; y <= 1000; y += G / 5) { c.moveTo(CX - 4, y); c.lineTo(CX + 4, y); }
    c.stroke();
    c.restore();
  });
}

function bakeGlass() {
  return K.layer(1000, 1000, 0.6, (c) => {
    c.save();
    c.beginPath(); c.arc(CX, CY, CR, 0, TAU); c.clip();
    // the curve of the face darkens toward the rim
    c.fillStyle = K.radGrad(c, CX, CY, CR * 0.7, CR, [[0, 'rgba(0,0,0,0)'], [0.7, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0.7)']]);
    c.fillRect(0, 0, 1000, 1000);
    // broad reflection of the room, upper left
    c.beginPath();
    c.arc(CX, CY, CR - 14, Math.PI * 1.08, Math.PI * 1.62);
    c.arc(CX + 70, CY + 70, CR - 40, Math.PI * 1.6, Math.PI * 1.1, true);
    c.closePath();
    c.fillStyle = K.linGrad(c, CX - 400, CY - 400, CX, CY - 100, [[0, 'rgba(220,240,230,0.13)'], [1, 'rgba(220,240,230,0.0)']]);
    c.fill();
    // a window, faintly, upper right
    c.save();
    c.translate(720, 300); c.rotate(0.12);
    c.fillStyle = 'rgba(210,230,220,0.045)';
    c.fillRect(-60, -70, 52, 120); c.fillRect(0, -70, 52, 120);
    c.fillRect(-60, 58, 52, 80); c.fillRect(0, 58, 52, 80);
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath(); c.ellipse(260, 330, 22, 8, -0.75, 0, TAU); c.fill();
    c.restore();
  });
}

function bakeHalo() {
  // soft green spill from the tube onto the panel round the bezel
  return K.layer(1000, 1000, 0.25, (c) => {
    c.fillStyle = K.radGrad(c, CX, CY, BEZ - 10, BEZ + 120, [[0, 'rgba(60,255,130,0.16)'], [1, 'rgba(60,255,130,0)']]);
    c.fillRect(0, 0, 1000, 1000);
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.arc(CX, CY, BEZ - 2, 0, TAU); c.fill();
  });
}

// ------------------------------------------------------------------------------------------- per frame
function roadTrace(ctx, T, t) {
  const q = Math.floor(T * 30 + 1e-6), pts = [];
  for (let x = -6, i = 0; x <= 1006; x += 8, i++) {
    const y = RY + (K.hash1(i * 7 + q * 131) - 0.5) * 1.8 + K.noise1(x * 0.011 + q * 0.37, 15) * 1.4 + K.noise1(x * 0.06, 16 + q) * 0.6;
    pts.push([x, y]);
  }
  K.glowLine(ctx, pts, { color: '#3cff86', width: 1.9, glow: 7, alpha: 0.6, core: '#e9fff1', coreAlpha: 0.35 });
  // the idle sweep: a brighter beam runs along the baseline, its trail fading behind it
  const per = 1.6, ph = K.mod(T, per) / per, sx = -60 + ph * 1120;
  for (let k = 0; k < 6; k++) {
    const a = sx - 36 * (k + 1), b = sx - 36 * k;
    const seg = pts.filter((p) => p[0] >= a && p[0] <= b);
    if (seg.length > 1) K.glowLine(ctx, seg, { color: '#5aff9a', width: 2.2, glow: 8, alpha: 0.5 * (1 - k / 6), core: '#f2fff6', coreAlpha: 0.5 * (1 - k / 6) });
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = K.radGrad(ctx, sx, RY, 0, 16, [[0, 'rgba(235,255,242,0.9)'], [0.3, 'rgba(90,255,150,0.4)'], [1, 'rgba(40,255,120,0)']]);
  ctx.fillRect(sx - 16, RY - 16, 32, 32);
  ctx.restore();
}

/** the knob angle and the hand's offset from the MODE knob, as functions of t */
const modeAngle = (t) => (-40 + 80 * warpAt(t)) * D;
function handState(t) {
  const off = [270, -110], hover = [26, -22];
  let p;
  if (t < 0.5 || t > 4) return null;
  if (t < 1.5) { const e = K.ease.io3(K.prog(t, 0.5, 1.0)); p = [K.lerp(off[0], hover[0], e), K.lerp(off[1], hover[1], e)]; }
  else if (t < 1.9) { const e = K.ease.io2(K.prog(t, 1.5, 0.4)); p = [K.lerp(hover[0], 0, e), K.lerp(hover[1], 0, e)]; }
  else if (t < 2.85) p = [0, 0];
  else { const e = K.ease.io2(K.prog(t, 2.85, 0.15)) * 0.15 + K.ease.io3(K.prog(t, 3.15, 0.75)) * 0.85; p = [K.lerp(0, off[0], e), K.lerp(0, off[1], e)]; }
  // the yank between the beats: a sharp tug back to SWEEP
  const yank = K.bump(t, 2.47, 0.04) * 5;
  return { dx: p[0] + yank, dy: p[1] - yank * 0.4, rot: 0.3 * (modeAngle(t) - modeAngle(0)) };
}

const SKIN = '#b38c76', SKIN_D = '#5b3f33';
function handShape(c, shadow) {
  const fill = shadow ? 'rgba(0,0,0,0.42)' : SKIN, line = shadow ? 'rgba(0,0,0,0)' : SKIN_D;
  const stroke = (pts, w) => {
    K.path(c, pts, false);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (!shadow) { c.strokeStyle = line; c.lineWidth = w + 2.4; c.stroke(); }
    c.strokeStyle = fill; c.lineWidth = w; c.stroke();
  };
  // sleeve (grey worsted) and shirt cuff
  if (!shadow) {
    c.fillStyle = K.linGrad(c, 150, -60, 200, 60, [[0, '#56585a'], [1, '#2c2d2e']]);
    K.path(c, [[150, -30], [420, -190], [480, -30], [175, 60]], true); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#dedbd2';
    K.path(c, [[120, -16], [162, -38], [194, 50], [150, 70]], true); c.fill();
    c.strokeStyle = '#8e8b83'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#f4f2ea'; c.beginPath(); c.arc(166, 34, 3.2, 0, TAU); c.fill();
    c.strokeStyle = '#8e8b83'; c.lineWidth = 0.8; c.stroke();
  }
  // back of the hand
  c.fillStyle = fill;
  K.spline(c, [[34, -34], [80, -46], [126, -20], [138, 30], [100, 50], [44, 38], [28, 4]], true);
  c.fill();
  if (!shadow) { c.strokeStyle = line; c.lineWidth = 1.3; c.stroke(); }
  // curled fingers tucked under (knuckles)
  stroke([[46, 6], [24, 14], [20, 30]], 15);
  stroke([[50, 24], [32, 36], [30, 48]], 14);
  // thumb under the knob, index finger over its top edge, pinching
  stroke([[86, 44], [48, 50], [12, 40], [-6, 30]], 16);
  stroke([[50, -36], [14, -42], [-14, -34], [-26, -18]], 16);
  if (!shadow) {
    c.strokeStyle = 'rgba(80,40,30,0.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(14, -42); c.lineTo(10, -30); c.moveTo(-14, -34); c.lineTo(-8, -24); c.stroke();
    c.fillStyle = 'rgba(240,220,205,0.6)'; // nails
    c.beginPath(); c.ellipse(-25, -14, 4.6, 3, 1.2, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(-5, 27, 4.2, 3, 2.4, 0, TAU); c.fill();
  }
}
const HB = { x0: -80, y0: -300, w: 640, h: 460 };
function drawHand(ctx, t) {
  const h = handState(t);
  if (!h) return;
  const c = L.hctx, b = L.hand;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, b.width, b.height);
  c.setTransform(1, 0, 0, 1, -HB.x0, -HB.y0);
  c.rotate(h.rot - 0.18);
  c.scale(1.35, 1.35);
  handShape(c, false);
  // shading: dark above, lit from the tube below-left (green)
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = K.linGrad(c, 0, -60, 40, 70, [[0, 'rgba(20,10,8,0.5)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(70,255,140,0.25)']]);
  c.fillRect(-100, -300, 640, 460);
  const x = MODE.x + h.dx + HB.x0, y = MODE.y + h.dy + HB.y0;
  // its shadow on the panel: the same picture, darkened and offset
  const sc = L.sctx, sb = L.hshadow;
  sc.globalCompositeOperation = 'source-over';
  sc.clearRect(0, 0, sb.width, sb.height);
  sc.drawImage(b, 0, 0, sb.width, sb.height);
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = '#000000';
  sc.fillRect(0, 0, sb.width, sb.height);
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.drawImage(sb, x + 7, y + 10, HB.w, HB.h);
  ctx.drawImage(sb, x + 12, y + 16, HB.w, HB.h);
  ctx.restore();
  ctx.drawImage(b, x, y, HB.w, HB.h);
}

export default {
  id: 15, key: 'scope', title: TITLES[15],
  heroT: 3.75,

  async init() {
    const title = TITLES[15];
    const hand = K.makeCanvas(HB.w, HB.h), hshadow = K.makeCanvas(HB.w / 4, HB.h / 4);
    L = { panel: bakePanel(title), face: bakeFace(), grat: bakeGraticule(), glass: bakeGlass(), halo: bakeHalo(), hand, hctx: hand.getContext('2d'), hshadow, sctx: hshadow.getContext('2d') };
  },

  render(ctx, t, env) {
    const T = env.T ?? t + 89;
    const w = warpAt(t);
    K.put(ctx, L.face, 0, 0, 1000, 1000);

    ctx.save();
    ctx.beginPath(); ctx.arc(CX, CY, CR, 0, TAU); ctx.clip();
    // soft glow of the phosphor round the figure
    const pose = env.poseAt(t);
    if (pose && pose.x > -300 && pose.x < 1300) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = K.radGrad(ctx, pose.x, pose.y - 150, 10, 300, [[0, `rgba(40,255,120,${0.07 + 0.05 * w})`], [1, 'rgba(40,255,120,0)']]);
      ctx.fillRect(pose.x - 300, pose.y - 450, 600, 600);
      ctx.restore();
    }
    roadTrace(ctx, T, t);
    drawPersist(ctx, env, t, { Rig, alpha: 1, boost: Beat.hit(t, 0, 6) + 0.6 * w, warpAt: warpFn });
    K.put(ctx, L.grat, 0, 0, 1000, 1000);
    K.put(ctx, L.glass, 0, 0, 1000, 1000);
    ctx.restore();

    K.put(ctx, L.panel, 0, 0, 1000, 1000);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.8 + 0.4 * w;
    K.put(ctx, L.halo, 0, 0, 1000, 1000);
    ctx.restore();

    // pilot lamp (amber jewel), dips when the knob is thrown
    const lamp = 0.85 + 0.15 * K.hash1(Math.floor(T * 12) * 7 + 3) - 0.35 * Beat.hit(t, W0, 8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = K.radGrad(ctx, 70, 176, 0, 40, [[0, `rgba(255,190,90,${0.55 * lamp})`], [0.4, `rgba(255,140,40,${0.22 * lamp})`], [1, 'rgba(255,120,30,0)']]);
    ctx.fillRect(30, 136, 80, 80);
    ctx.restore();
    ctx.fillStyle = K.radGrad(ctx, 66, 172, 0, 12, [[0, '#fff1c8'], [0.5, '#ffad3a'], [1, '#a2450e']]);
    ctx.beginPath(); ctx.arc(70, 176, 11, 0, TAU); ctx.fill();

    knob(ctx, MODE.x, MODE.y, MODE.r, modeAngle(t));
    drawHand(ctx, t);
  },
};
