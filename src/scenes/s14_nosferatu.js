// Section 14 — Nosferatu (1922)
// A frame of German Expressionist silent film, tinted cold for night: a tall plaster wall beside a staircase, an
// arched door on the landing, a small framed picture, and light painted on the wall in sharp slanting wedges. Nobody
// is there. The pelican is seen only as a cast shadow that climbs the stairs and comes down again, hunched, one long
// feathered hand lifted off the bar; the banister's shadow bars swing across the wall as the unseen lamp goes by.
//
// Technique: wall and staircase are baked in cold greys (Canvas 2D + noise layers). Every frame the pelican is drawn
// as a silhouette into a small half-resolution buffer through a shear/stretch matrix (the cast shadow), blurred by
// scaling down and up, and laid on the wall; the staircase is drawn over it. Then the film itself: gate weave,
// lamp flicker, vignette, grain that changes 24 times a second, scratches and dust.
// At t = 6.0 the shadow powers up into the green oscilloscope trace of section 15 (scope_trace.js).
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import * as Beat from '../beat/index.js';
import { TITLES } from './titles.js';
import { drawTrace, drawPersist } from './scope_trace.js';

const TAU = Math.PI * 2, D = Math.PI / 180;
const RY = K.ROAD_Y, RES = 1.25;
/** cold-tinted grey: v = 0 (black) … 1 (white) */
const cg = (v, a = 1) => {
  v = K.clamp(v);
  return `rgba(${Math.round(3 + 214 * v)},${Math.round(8 + 234 * v)},${Math.round(15 + 238 * v)},${a})`;
};
/** the same grey as #rrggbb — K.noiseLayer / K.grain parse hex only (an rgba() string there comes out green) */
const cgx = (v) => {
  v = K.clamp(v);
  return '#' + [3 + 214 * v, 8 + 234 * v, 15 + 238 * v].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
};

// ------------------------------------------------------------------------------------------- the staircase
const H = 160, STEP = 20, NSTEP = 8;
const UP0 = 70, UP1 = 440, DN0 = 600, DN1 = 950;
const ramp = (v, e = 0.22) => {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  const m = 1 / (1 - e);
  if (v < e) return (m * v * v) / (2 * e);
  if (v > 1 - e) return 1 - (m * (1 - v) * (1 - v)) / (2 * e);
  return m * (v - e / 2);
};
const stairH = (x) => H * (ramp((x - UP0) / (UP1 - UP0)) - ramp((x - DN0) / (DN1 - DN0)));
const groundY = (x) => RY - stairH(x);
const solveX = (f, target, a, b) => {
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (f(m) < target) a = m; else b = m;
  }
  return (a + b) / 2;
};
const XUP = [], XDN = [];
for (let k = 1; k <= NSTEP; k++) {
  XUP[k] = solveX((x) => H * ramp((x - UP0) / (UP1 - UP0)), STEP * (k - 0.5), UP0, UP1);
  XDN[k] = solveX((x) => -H * (1 - ramp((x - DN0) / (DN1 - DN0))), -STEP * (k - 0.5), DN0, DN1);
}
const STAIR = (() => {
  const p = [[XUP[1], RY]];
  for (let k = 1; k <= NSTEP; k++) {
    p.push([XUP[k], RY - STEP * k]);
    if (k < NSTEP) p.push([XUP[k + 1], RY - STEP * k]);
  }
  for (let k = NSTEP; k >= 1; k--) {
    p.push([XDN[k], RY - STEP * k]);
    p.push([XDN[k], RY - STEP * (k - 1)]);
  }
  return p;
})();
const TREADS = (() => {
  const t = [];
  for (let k = 1; k <= NSTEP; k++) t.push([XUP[k], k < NSTEP ? XUP[k + 1] : XDN[NSTEP], RY - STEP * k, 1]);
  for (let k = NSTEP - 1; k >= 1; k--) t.push([XDN[k + 1], XDN[k], RY - STEP * k, -1]);
  return t;
})();

// the door on the landing
const DX0 = 478, DX1 = 588, DW = DX1 - DX0, DBASE = RY - H, DR = DW / 2, DCY = 420, DTOP = DCY - DR, DH = DBASE - DTOP;
const doorPath = (c, grow = 0) => {
  c.beginPath();
  c.moveTo(DX0 - grow, DBASE);
  c.lineTo(DX0 - grow, DCY);
  c.arc(DX0 + DR, DCY, DR + grow, Math.PI, 0);
  c.lineTo(DX1 + grow, DBASE);
  c.closePath();
};
const DOOR_BEATS = [2.5, 3.0, 3.5];
const doorOpen = (t) => DOOR_BEATS.reduce((s, b) => s + K.ease.out3(K.prog(t, b, 0.42)), 0) / DOOR_BEATS.length;

// the cast shadow: sheared and stretched away from a low lamp behind the rider; none at the frames
const castK = (x) => K.smoothstep(50, 190, x) * (1 - K.smoothstep(810, 950, x));
const cast = (pose) => {
  const k = castK(pose.x);
  return { k, sh: 0.3 * k, st: 1 + 0.13 * k };
};
const castPt = (pose, p) => {
  const c = cast(pose), dy = p[1] - pose.y;
  return [p[0] - c.sh * dy, pose.y + c.st * dy];
};
const LAMP_BACK = 250, LAMP_D = 833; // lamp trails the rider; LAMP_D makes the bars lean as the pelican's shadow does

const BUF = { w: 680, h: 540, ox: 270, oy: 450 };
let L = null;
let PORT = null; // where the framed picture hangs: under the beak's shadow on the downbeat of bar 2

// ------------------------------------------------------------------------------------------------ baking
function ornament(c, x, y, s, col) {
  c.save();
  c.translate(x, y);
  c.fillStyle = col;
  c.strokeStyle = col;
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(0, -s); c.lineTo(s * 0.62, 0); c.lineTo(0, s); c.lineTo(-s * 0.62, 0);
  c.closePath();
  c.fill();
  for (const d of [-1, 1]) {
    c.beginPath();
    c.moveTo(d * s * 1.1, 0);
    c.lineTo(d * s * 4.6, 0);
    c.stroke();
    c.beginPath();
    c.arc(d * s * 5.4, 0, s * 0.42, 0, TAU);
    c.fill();
  }
  c.restore();
}

function bakeWall(title) {
  return K.layer(1000, 1000, RES, (c) => {
    c.fillStyle = K.linGrad(c, 0, 0, 0, 1000, [[0, cg(0.3)], [0.3, cg(0.47)], [0.62, cg(0.56)], [0.8, cg(0.5)], [1, cg(0.4)]]);
    c.fillRect(0, 0, 1000, 1000);
    // plaster: blotches, damp streaks, tooth
    K.put(c, K.noiseLayer({ scale: 190, seed: 141, color: cgx(0.08), lo: 0.42, hi: 0.82, alpha: 0.4 }), 0, 0, 1000, 1000);
    K.put(c, K.noiseLayer({ scale: 120, seed: 142, color: cgx(0.97), lo: 0.5, hi: 0.85, alpha: 0.2 }), 0, 0, 1000, 1000);
    K.put(c, K.noiseLayer({ scale: 46, seed: 143, color: cgx(0.05), lo: 0.52, hi: 0.86, alpha: 0.24, stretch: [1, 0.07] }), 0, 0, 1000, 1000);
    K.put(c, K.noiseLayer({ scale: 14, seed: 144, color: cgx(0.02), lo: 0.5, hi: 0.9, alpha: 0.16, res: 1 }), 0, 0, 1000, 1000);
    // light painted on the wall, the Expressionist way: hard-edged wedges
    c.save();
    c.globalCompositeOperation = 'screen';
    c.fillStyle = cg(1, 0.13);
    K.path(c, [[0, 800], [0, 452], [300, 286], [735, 262], [1000, 410], [1000, 800]], true); c.fill();
    c.fillStyle = cg(1, 0.2);
    K.path(c, [[214, 800], [404, 268], [664, 258], [566, 800]], true); c.fill();
    c.fillStyle = cg(1, 0.1);
    K.path(c, [[640, 800], [742, 300], [842, 330], [800, 800]], true); c.fill();
    c.restore();
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = cg(0.0, 0.42);
    K.path(c, [[0, 0], [372, 0], [0, 404]], true); c.fill();
    K.path(c, [[1000, 0], [664, 0], [1000, 372]], true); c.fill();
    c.fillStyle = cg(0.0, 0.25);
    K.path(c, [[0, 0], [1000, 0], [1000, 40], [520, 150], [0, 60]], true); c.fill();
    c.restore();
    // damp along the floor
    c.fillStyle = K.linGrad(c, 0, 690, 0, 800, [[0, cg(0, 0)], [1, cg(0, 0.28)]]);
    c.fillRect(0, 690, 1000, 110);
    K.cracks(c, 1000, 760, { n: 6, seed: 1922, color: cg(0.04), alpha: 0.42, width: 1.3, len: 250, branch: 0.4 });
    K.grain(c, 0, 0, 1000, 1000, { color: cgx(0), alpha: 0.1, seed: 14, size: 1.1 });

    // ---- arched doorway: stone surround
    doorPath(c, 18);
    c.fillStyle = cg(0.7); c.fill();
    c.strokeStyle = cg(0.16); c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = cg(0.2, 0.8); c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 1; i < 9; i++) {
      const a = Math.PI + (i / 9) * Math.PI;
      c.moveTo(DX0 + DR + Math.cos(a) * DR, DCY + Math.sin(a) * DR);
      c.lineTo(DX0 + DR + Math.cos(a) * (DR + 18), DCY + Math.sin(a) * (DR + 18));
    }
    for (let y = DCY; y < DBASE; y += 37) {
      c.moveTo(DX0 - 18, y); c.lineTo(DX0, y);
      c.moveTo(DX1, y + 18); c.lineTo(DX1 + 18, y + 18);
    }
    c.stroke();
    // keystone
    K.path(c, [[DX0 + DR - 10, DTOP + 3], [DX0 + DR - 14, DTOP - 27], [DX0 + DR + 14, DTOP - 27], [DX0 + DR + 10, DTOP + 3]], true);
    c.fillStyle = cg(0.78); c.fill(); c.stroke();
    c.fillStyle = K.linGrad(c, DX0 - 18, 0, DX1 + 18, 0, [[0, cg(1, 0.14)], [0.5, cg(0, 0)], [1, cg(0, 0.3)]]);
    doorPath(c, 18); c.fill();
    doorPath(c, 0);
    c.fillStyle = cg(0.02); c.fill();

    // ---- iron sconce, unlit
    c.save();
    c.translate(118, 372);
    c.fillStyle = cg(0, 0.22);
    c.save(); c.transform(1, 0, -0.5, 1, 14, 0);
    c.beginPath(); c.ellipse(0, 0, 11, 26, 0, 0, TAU); c.fill();
    c.fillRect(22, -54, 14, 34);
    c.restore();
    c.fillStyle = cg(0.08);
    c.beginPath(); c.ellipse(0, 0, 10, 25, 0, 0, TAU); c.fill();
    c.strokeStyle = cg(0.08); c.lineWidth = 4.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 6); c.bezierCurveTo(10, 30, 34, 26, 32, -6); c.stroke();
    c.beginPath(); c.moveTo(19, -8); c.lineTo(45, -8); c.lineTo(40, 2); c.lineTo(24, 2); c.closePath(); c.fill();
    c.fillStyle = cg(0.8);
    c.fillRect(26, -40, 12, 32);
    c.fillStyle = cg(0.55); c.fillRect(34, -40, 4, 32);
    c.strokeStyle = cg(0.05); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(32, -40); c.lineTo(33, -47); c.stroke();
    c.restore();

    // ---- cobweb
    c.save();
    c.strokeStyle = cg(0.9, 0.22); c.lineWidth = 0.8;
    const web = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + 0.06 + (i / 5) * (Math.PI / 2 - 0.12), len = 150 - (i % 2) * 28;
      web.push([1000 + Math.cos(a) * len, Math.sin(a) * len]);
      c.beginPath(); c.moveTo(1000, 0); c.lineTo(web[i][0], web[i][1]); c.stroke();
    }
    for (let ring = 1; ring <= 5; ring++) {
      const f = ring / 5.4;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const p = [1000 + (web[i][0] - 1000) * f, web[i][1] * f];
        if (!i) c.moveTo(p[0], p[1]);
        else {
          const q = [1000 + (web[i - 1][0] - 1000) * f, web[i - 1][1] * f];
          c.quadraticCurveTo((p[0] + q[0]) / 2 + 5 * f, (p[1] + q[1]) / 2 - 5 * f, p[0], p[1]);
        }
      }
      c.stroke();
    }
    c.restore();

    // ---- the intertitle plaque
    const px = 212, py = 34, pw = 576, ph = 214;
    c.fillStyle = cg(0, 0.38);
    K.path(c, [[px + 14, py + ph], [px + pw, py + ph], [px + pw, py + 16], [px + pw + 22, py + 30], [px + pw + 22, py + ph + 20], [px + 30, py + ph + 20]], true);
    c.fill();
    c.fillStyle = cg(0.2); c.fillRect(px, py, pw, ph);
    c.strokeStyle = cg(0.5); c.lineWidth = 1.5; c.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    c.fillStyle = cg(0.015); c.fillRect(px + 8, py + 8, pw - 16, ph - 16);
    const ink = cg(0.93);
    c.strokeStyle = ink;
    c.lineWidth = 2.2; c.strokeRect(px + 19, py + 19, pw - 38, ph - 38);
    c.lineWidth = 0.9; c.strokeRect(px + 26, py + 26, pw - 52, ph - 52);
    for (const [cx, cy, sx, sy] of [[px + 26, py + 26, 1, 1], [px + pw - 26, py + 26, -1, 1], [px + 26, py + ph - 26, 1, -1], [px + pw - 26, py + ph - 26, -1, -1]]) {
      c.save();
      c.translate(cx, cy); c.scale(sx, sy);
      c.fillStyle = cg(0.015); c.fillRect(-9, -9, 27, 27);
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(18, -7); c.lineTo(18, 18); c.lineTo(-7, 18); c.stroke();
      c.beginPath(); c.arc(6, 6, 7.5, 0, TAU); c.stroke();
      c.fillStyle = ink;
      c.beginPath(); c.arc(6, 6, 2.6, 0, TAU); c.fill();
      c.restore();
    }
    c.save();
    c.shadowColor = cg(0.9, 0.55); c.shadowBlur = 7 * RES;
    K.text(c, title.zh, 500, py + 96, { size: 62, font: K.FONT.cjkSerif, weight: 700, align: 'center', color: ink, tracking: 4 });
    K.text(c, title.en, 500, py + 150, { size: 44, font: K.FONT.serif, weight: 400, align: 'center', color: ink, tracking: 5 });
    c.shadowBlur = 4 * RES;
    K.text(c, title.date, 500, py + 186, { size: 27, font: K.FONT.serif, weight: 400, align: 'center', color: ink, tracking: 6 });
    c.restore();
    ornament(c, 394, py + 177, 5, ink);
    ornament(c, 606, py + 177, 5, ink);
  });
}

function bakeFg() {
  return K.layer(1000, 1000, RES, (c) => {
    // floor
    c.fillStyle = K.linGrad(c, 0, RY, 0, 1000, [[0, cg(0.36)], [0.25, cg(0.24)], [1, cg(0.08)]]);
    c.fillRect(0, RY, 1000, 200);
    c.save();
    c.beginPath(); c.rect(0, RY, 1000, 200); c.clip();
    K.put(c, K.noiseLayer({ w: 1000, h: 200, scale: 60, seed: 147, color: cgx(0), lo: 0.4, hi: 0.85, alpha: 0.35, stretch: [0.12, 1] }), 0, RY, 1000, 200);
    c.globalCompositeOperation = 'screen';
    c.fillStyle = cg(1, 0.12);
    K.path(c, [[0, RY], [330, RY], [140, 1000], [0, 1000]], true); c.fill();
    c.fillStyle = cg(1, 0.07);
    K.path(c, [[566, RY], [800, RY], [900, 1000], [520, 1000]], true); c.fill();
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = cg(0.02, 0.7); c.lineWidth = 1.5;
    c.beginPath();
    for (let i = -16; i <= 16; i++) {
      const x0 = 500 + i * 58;
      c.moveTo(x0, RY); c.lineTo(500 + (x0 - 500) * 2.7, 1000);
    }
    c.stroke();
    const r = K.rng(1471);
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < 26; i++) {
      const col = r.int(-16, 15), v = r.range(0.05, 1), y = RY + 200 * v;
      const xa = 500 + col * 58, xb = xa + 58;
      c.moveTo(500 + (xa - 500) * (1 + 1.7 * v), y); c.lineTo(500 + (xb - 500) * (1 + 1.7 * v), y);
    }
    c.stroke();
    c.restore();

    // staircase, seen from the side: the stringer
    K.path(c, STAIR, true);
    c.fillStyle = K.linGrad(c, 0, RY - H, 0, RY, [[0, cg(0.25)], [1, cg(0.11)]]);
    c.fill();
    c.save();
    K.path(c, STAIR, true); c.clip();
    K.put(c, K.noiseLayer({ w: 1000, h: 200, scale: 50, seed: 148, color: cgx(0), lo: 0.42, hi: 0.85, alpha: 0.4, stretch: [0.1, 1] }), 0, RY - 200, 1000, 200);
    // moulding that follows the pitch
    const line = (off) => { c.beginPath(); for (let x = UP0 - 20; x <= DN1 + 20; x += 6) { const y = groundY(x) + off; if (x === UP0 - 20) c.moveTo(x, y); else c.lineTo(x, y); } };
    c.strokeStyle = cg(0.42); c.lineWidth = 2; line(40); c.stroke();
    c.strokeStyle = cg(0.02); c.lineWidth = 1.4; line(44); c.stroke();
    // panels
    for (let x = 250; x < 820; x += 92) {
      if (x > 440 && x < 600) continue;
      const top = Math.max(groundY(x), groundY(x + 70)) + 56;
      if (RY - top < 34) continue;
      c.strokeStyle = cg(0.02); c.lineWidth = 1.5;
      c.strokeRect(x, top, 70, RY - 12 - top);
      c.strokeStyle = cg(0.38, 0.7); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 1.5, RY - 12); c.lineTo(x + 1.5, top + 1.5); c.lineTo(x + 70, top + 1.5); c.stroke();
    }
    // cupboard under the landing
    c.beginPath();
    c.moveTo(478, RY); c.lineTo(478, 730); c.arc(520, 730, 42, Math.PI, 0); c.lineTo(562, RY); c.closePath();
    c.fillStyle = cg(0.035); c.fill();
    c.strokeStyle = cg(0.4); c.lineWidth = 2; c.stroke();
    c.strokeStyle = cg(0.3); c.lineWidth = 1.5;
    c.beginPath(); c.arc(548, 752, 4.5, 0, TAU); c.stroke();
    c.restore();
    // risers and the lit edges of the treads
    c.strokeStyle = cg(0.02, 0.8); c.lineWidth = 1.3;
    c.beginPath();
    for (const [xa, xb, y, dir] of TREADS) {
      const x = dir > 0 ? xa : xb;
      c.moveTo(x, y); c.lineTo(x, y + STEP);
    }
    c.stroke();
    for (const [xa, xb, y] of TREADS) {
      c.fillStyle = cg(0.78);
      c.fillRect(xa - 4, y - 1, xb - xa + 8, 3.6);
      c.fillStyle = cg(0.02, 0.6);
      c.fillRect(xa - 4, y + 2.6, xb - xa + 8, 2);
    }
    // the road: where wall and floor meet
    c.fillStyle = cg(0.02, 0.7); c.fillRect(0, RY + 2.2, 1000, 2.4);
    c.fillStyle = cg(0.7); c.fillRect(0, RY - 0.6, 1000, 2.8);
  });
}

function bakeDoor() {
  return K.layer(DW, DH, 2, (c) => {
    c.beginPath();
    c.moveTo(0, DH); c.lineTo(0, DR); c.arc(DR, DR, DR, Math.PI, 0); c.lineTo(DW, DH); c.closePath();
    c.clip();
    c.fillStyle = cg(0.44); c.fillRect(0, 0, DW, DH);
    const r = K.rng(1449);
    for (let i = 0; i < 6; i++) {
      const x = (i * DW) / 6;
      c.fillStyle = cg(r.range(0.36, 0.5)); c.fillRect(x, 0, DW / 6, DH);
      c.fillStyle = cg(0.05, 0.8); c.fillRect(x - 0.8, 0, 1.6, DH);
      c.strokeStyle = cg(0.1, 0.35); c.lineWidth = 0.7;
      for (let j = 0; j < 4; j++) {
        const gx = x + r.range(3, DW / 6 - 3);
        c.beginPath(); c.moveTo(gx, r.range(0, 60)); c.lineTo(gx + r.range(-2, 2), DH - r.range(0, 60)); c.stroke();
      }
    }
    // strap hinges (hung on the right) and studs
    c.fillStyle = cg(0.06);
    for (const y of [78, 228]) {
      c.beginPath();
      c.moveTo(DW, y - 8); c.lineTo(34, y - 5); c.lineTo(20, y); c.lineTo(34, y + 5); c.lineTo(DW, y + 8); c.closePath();
      c.fill();
      for (let x = 44; x < DW - 6; x += 17) { c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fillStyle = cg(0.5); c.fill(); c.fillStyle = cg(0.06); }
    }
    c.strokeStyle = cg(0.06); c.lineWidth = 3;
    c.beginPath(); c.arc(17, 160, 8, 0, TAU); c.stroke();
    c.beginPath(); c.arc(17, 151, 3.4, 0, TAU); c.fill();
    c.fillStyle = K.linGrad(c, 0, 0, DW, 0, [[0, cg(1, 0.1)], [0.6, cg(0, 0)], [1, cg(0, 0.25)]]);
    c.fillRect(0, 0, DW, DH);
  });
}

const PW = 92, PH = 112;
function bakePortrait() {
  return K.layer(PW, PH, 2.5, (c) => {
    c.fillStyle = cg(0.1); c.fillRect(0, 0, PW, PH);
    c.strokeStyle = cg(0.5); c.lineWidth = 1.4; c.strokeRect(3.5, 3.5, PW - 7, PH - 7);
    c.strokeStyle = cg(0.3); c.lineWidth = 1; c.strokeRect(7, 7, PW - 14, PH - 14);
    c.fillStyle = cg(0.82); c.fillRect(10, 10, PW - 20, PH - 20);
    c.save();
    c.beginPath(); c.ellipse(PW / 2, PH / 2, 29, 38, 0, 0, TAU);
    c.fillStyle = K.linGrad(c, 0, 16, 0, PH - 16, [[0, cg(0.62)], [1, cg(0.4)]]); c.fill();
    c.strokeStyle = cg(0.15); c.lineWidth = 1.2; c.stroke();
    c.clip();
    // still life: a fish on a plate
    c.fillStyle = cg(0.3); c.fillRect(0, 74, PW, 40);
    c.beginPath(); c.ellipse(PW / 2, 72, 26, 7, 0, 0, TAU);
    c.fillStyle = cg(0.86); c.fill(); c.strokeStyle = cg(0.2); c.lineWidth = 1; c.stroke();
    c.beginPath(); c.ellipse(PW / 2, 71.5, 19, 4.4, 0, 0, TAU); c.strokeStyle = cg(0.45); c.stroke();
    c.fillStyle = cg(0.12);
    c.beginPath();
    c.moveTo(27, 64); c.bezierCurveTo(34, 52, 52, 52, 60, 62); c.lineTo(69, 54); c.lineTo(67, 64); c.lineTo(70, 72);
    c.lineTo(60, 66); c.bezierCurveTo(52, 73, 34, 73, 27, 64); c.closePath();
    c.fill();
    c.fillStyle = cg(0.9); c.beginPath(); c.arc(34, 62, 1.6, 0, TAU); c.fill();
    c.strokeStyle = cg(0.5); c.lineWidth = 0.8;
    c.beginPath(); c.arc(36, 63, 6, -0.9, 0.9); c.stroke();
    c.restore();
    c.fillStyle = cg(1, 0.14);
    K.path(c, [[12, 44], [44, 10], [58, 10], [12, 62]], true); c.fill();
  });
}

function bakeVignette() {
  return K.layer(1000, 1000, 0.25, (c) => {
    c.save();
    c.translate(500, 530); c.scale(1.28, 1);
    c.fillStyle = K.radGrad(c, 0, 0, 320, 660, [[0, 'rgba(0,2,5,0)'], [0.45, 'rgba(0,2,5,0.22)'], [0.8, 'rgba(0,2,5,0.62)'], [1, 'rgba(0,2,5,0.86)']]);
    c.fillRect(-500, -600, 1000, 1200);
    c.restore();
  });
}

// ------------------------------------------------------------------------------------------- per-frame parts
function drawDoor(ctx, t) {
  const ang = doorOpen(t) * 60 * D, w = DW * Math.cos(ang);
  ctx.save();
  doorPath(ctx, 0);
  ctx.clip();
  ctx.fillStyle = cg(0.012);
  ctx.fillRect(DX0, DTOP, DW, DH);
  ctx.drawImage(L.door, DX1 - w, DTOP, w, DH);
  if (ang > 0) {
    ctx.fillStyle = `rgba(1,3,7,${0.55 * Math.sin(ang)})`;
    ctx.fillRect(DX1 - w, DTOP, w, DH);
    ctx.fillStyle = cg(0.7, 0.5);
    ctx.fillRect(DX1 - w, DTOP, 1.6, DH);
  }
  ctx.restore();
}

const tiltAt = (t) => (t < 2 ? 0 : (4.6 * (1 - Math.exp(-(t - 2) * 3)) + 6.5 * Math.exp(-(t - 2) * 2.1) * Math.sin((t - 2) * 9.4)) * D);
function drawPortrait(ctx, t) {
  const a = tiltAt(t), nx = PORT[0], ny = PORT[1] - PH / 2 - 26;
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(a);
  ctx.fillStyle = cg(0, 0.3);
  ctx.save(); ctx.transform(1, 0, -0.3, 1, 0, 0); ctx.fillRect(-PW / 2 + 14, 30, PW, PH); ctx.restore();
  ctx.strokeStyle = cg(0.1, 0.9); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-PW / 2 + 12, 27); ctx.lineTo(0, 0); ctx.lineTo(PW / 2 - 12, 27); ctx.stroke();
  ctx.drawImage(L.portrait, -PW / 2, 26, PW, PH);
  ctx.restore();
  ctx.fillStyle = cg(0.05);
  ctx.beginPath(); ctx.arc(nx, ny, 2.4, 0, TAU); ctx.fill();
}

function drawBars(ctx, lampX) {
  const b = L.bars, bc = L.bctx, r = b.width / 1000;
  bc.setTransform(1, 0, 0, 1, 0, 0);
  bc.clearRect(0, 0, b.width, b.height);
  bc.setTransform(r, 0, 0, r, 0, 0);
  const hB = 285, st = 1.12;
  const top = (x) => [x + (hB * (x - lampX)) / LAMP_D, groundY(x) - hB * st];
  bc.strokeStyle = '#02050a'; bc.fillStyle = '#02050a';
  bc.lineCap = 'butt';
  bc.lineWidth = 7.5;
  bc.beginPath();
  for (let x = UP0 + 18; x < DN1 - 8; x += 39.2) {
    const p = top(x);
    bc.moveTo(x, groundY(x) + 4); bc.lineTo(p[0], p[1]);
  }
  bc.stroke();
  bc.lineWidth = 15; bc.lineJoin = 'round';
  bc.beginPath();
  for (let x = UP0 - 22; x <= DN1 + 22; x += 22) {
    const p = top(K.clamp(x, UP0 - 20, DN1 + 20));
    if (x === UP0 - 22) bc.moveTo(p[0], p[1]); else bc.lineTo(p[0], p[1]);
  }
  bc.stroke();
  bc.lineWidth = 19;
  for (const x of [UP0 - 20, UP1 + 2, DN0 - 2, DN1 + 20]) {
    const p = top(x), q = [p[0] + (p[0] - x) * 0.09, p[1] - hB * 0.1];
    bc.beginPath(); bc.moveTo(x, groundY(x) + 4); bc.lineTo(q[0], q[1]); bc.stroke();
    bc.beginPath(); bc.arc(q[0], q[1] - 12, 17, 0, TAU); bc.fill();
  }
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.drawImage(b, 0, 0, 1000, 1000);
  ctx.restore();
}

/** draw the pose into the shadow buffers, cast (sheared, stretched) with the beak and wing-fingers drawn out */
function castShadow(pose) {
  const c = cast(pose), a = L.bufA, ac = L.actx, b = L.bufB, bc = L.bbctx, r = a.width / BUF.w;
  ac.setTransform(1, 0, 0, 1, 0, 0);
  ac.clearRect(0, 0, a.width, a.height);
  ac.setTransform(r, 0, -r * c.sh, r * c.st, r * (BUF.ox - pose.x + c.sh * pose.y), r * (BUF.oy - c.st * pose.y));
  Rig.drawSilhouette(ac, pose, '#02050a', { grow: 1.2 });
  if (c.k > 0.01) {
    ac.fillStyle = '#02050a';
    const spike = (p0, p1, half, ext) => {
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], m = Math.hypot(dx, dy) || 1, nx = (-dy / m) * half, ny = (dx / m) * half;
      ac.beginPath();
      ac.moveTo(p0[0] + nx, p0[1] + ny); ac.lineTo(p1[0] + dx * ext, p1[1] + dy * ext); ac.lineTo(p0[0] - nx, p0[1] - ny);
      ac.closePath(); ac.fill();
    };
    for (const f of pose.shapes.fingers) {
      const n = f.length;
      spike(f[Math.max(0, n - 3)], f[n - 1], 3.2 * pose.s, 2.6 * c.k);
    }
    const bb = pose.pt.beakBase, bt = pose.pt.beakTip;
    spike([bb[0] + (bt[0] - bb[0]) * 0.55, bb[1] + (bt[1] - bb[1]) * 0.55], bt, 7 * pose.s, 0.5 * c.k);
    for (const cr of pose.shapes.crest) spike(cr[Math.max(0, cr.length - 3)], cr[cr.length - 1], 1.6 * pose.s, 1.2 * c.k);
  }
  bc.setTransform(1, 0, 0, 1, 0, 0);
  bc.clearRect(0, 0, b.width, b.height);
  bc.imageSmoothingEnabled = true;
  bc.drawImage(a, 0, 0, b.width, b.height);
}
function putShadow(ctx, pose, alpha, dx = 0, dy = 0, soft = true) {
  const x = pose.x - BUF.ox + dx, y = pose.y - BUF.oy + dy;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (soft) { ctx.globalAlpha = alpha * 0.5; ctx.drawImage(L.bufB, x, y, BUF.w, BUF.h); }
  ctx.globalAlpha = alpha * (soft ? 0.8 : 1);
  ctx.drawImage(L.bufA, x, y, BUF.w, BUF.h);
  ctx.restore();
}

/** everything the film stock adds: grain, scratches, dust — new every 1/24 s */
function filmDamage(ctx, T) {
  const fq = Math.floor(T * 24 + 1e-6), r = K.rng(fq * 7919 + 14);
  for (const [tile, alpha, sc] of [[L.grainD, 0.3, 1.7], [L.grainL, 0.13, 1.45], [L.grainD, 0.16, 3.1]]) {
    const pat = ctx.createPattern(tile, 'repeat');
    pat.setTransform(new DOMMatrix().translate(r.range(0, 256), r.range(0, 256)).scale(sc));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.restore();
  }
  ctx.save();
  ctx.lineCap = 'round';
  // a tramline that wanders for seconds at a time, and fresh scratches
  const tram = K.noise1(T * 0.35, 77);
  if (tram > 0.42) {
    const x = 706 + K.wobble(T, 0.8, 5) * 16 + (r() - 0.5) * 1.5;
    ctx.strokeStyle = cg(0.95, 0.2 + 0.25 * (tram - 0.42));
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 2, 1000); ctx.stroke();
  }
  const ns = r() < 0.55 ? (r() < 0.3 ? 2 : 1) : 0;
  for (let i = 0; i < ns; i++) {
    const x = r.range(20, 980), y0 = r.range(-200, 600), len = r.range(250, 1100);
    ctx.strokeStyle = r() < 0.75 ? cg(0.95, r.range(0.14, 0.38)) : cg(0, r.range(0.25, 0.5));
    ctx.lineWidth = r.range(0.6, 1.4);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + r.range(-5, 5), y0 + len); ctx.stroke();
  }
  const nd = r.int(2, 6);
  for (let i = 0; i < nd; i++) {
    const x = r.range(0, 1000), y = r.range(0, 1000), s = r.range(1, 3.8);
    ctx.fillStyle = r() < 0.6 ? cg(0, r.range(0.4, 0.85)) : cg(1, r.range(0.3, 0.7));
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * r.range(0.4, 1), r.range(0, 3), 0, TAU);
    ctx.fill();
  }
  if (r() < 0.07) { // a hair in the gate
    const x = r.range(100, 900), y = r.range(100, 900);
    ctx.strokeStyle = cg(0, 0.6); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + r.range(-40, 40), y + r.range(-40, 40), x + r.range(-60, 60), y + r.range(-60, 60), x + r.range(-80, 80), y + r.range(-80, 80));
    ctx.stroke();
  }
  ctx.restore();
}

export default {
  id: 14, key: 'nosferatu', title: TITLES[14],
  heroT: 2.75,
  // slow on the climb, quicker coming down
  profile: [[0, 0], [2.0, 0.3], [3.5, 0.47], [6, 1]],
  path(u) {
    const lx = -K.FRAME + K.PITCH * u;
    const h = stairH(lx), a = stairH(lx - 3), b = stairH(lx + 3);
    if (h === 0 && a === 0 && b === 0) return { dy: 0, s: 1, rot: 0 };
    return { dy: -h, s: 1, rot: 0.8 * Math.atan2(a - b, 6) };
  },
  act(t, p) {
    const g = K.gate(t, 0.5, 5.5, 0.45);
    p.neck = -0.55 * g; // hunched
    p.crest = 0.8 * g;
    p.bob = 1 - 0.55 * g; // it glides
    p.wave = 0.5 * K.gate(t, 1.3, 4.3, 0.55); // the long hand comes off the bar
    p.beakOpen = 0.16 * K.gate(t, 1.8, 3.3, 0.3);
  },

  async init() {
    const title = TITLES[14];
    const mk = (w, h) => { const c = K.makeCanvas(w, h); return [c, c.getContext('2d')]; };
    const [bufA, actx] = mk(BUF.w * 0.5, BUF.h * 0.5);
    const [bufB, bbctx] = mk(BUF.w * 0.11, BUF.h * 0.11);
    const [bars, bctx] = mk(420, 420);
    L = {
      wall: bakeWall(title), fg: bakeFg(), door: bakeDoor(), portrait: bakePortrait(), vig: bakeVignette(),
      grainD: K.grainTile(256, 141, '#000000', 1, true), grainL: K.grainTile(256, 142, '#e8f0ff', 0.5, true),
      bufA, actx, bufB, bbctx, bars, bctx,
    };
  },

  render(ctx, t, env) {
    const T = env.T ?? t + 83;
    const fq = Math.floor(T * 24 + 1e-6);
    if (!PORT) {
      const p2 = env.poseAt(2.0);
      const bt = castPt(p2, p2.pt.beakTip);
      PORT = [K.clamp(bt[0] + 6, 300, 430), K.clamp(bt[1] + 4, 330, 420)];
    }
    const pose = env.pose;
    const lx = K.clamp(env.rider ? env.rider.lx : pose ? pose.x : t < 3 ? -60 : 1060, -60, 1060);
    const lampX = lx - LAMP_BACK;
    const flick = 0.82 + 0.18 * K.hash1(fq * 31 + 5) + 0.1 * K.wobble(T, 3, 9);

    // ---- the picture, through the gate (it weaves)
    ctx.save();
    const wx = (K.hash1(fq * 3 + 1) - 0.5) * 1.6 + K.wobble(T, 1.3, 3) * 1.4, wy = (K.hash1(fq * 5 + 2) - 0.5) * 2.2 + K.wobble(T, 0.9, 4) * 1.6;
    ctx.translate(500, 500);
    ctx.scale(1.012, 1.012);
    ctx.translate(-500 + wx, -500 + wy);
    K.put(ctx, L.wall, 0, 0, 1000, 1000);
    drawDoor(ctx, t);
    drawPortrait(ctx, t);
    // the unseen lamp
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ly = pose ? pose.y - 170 : RY - 170;
    ctx.fillStyle = K.radGrad(ctx, lx + 50, ly, 40, 520, [[0, cg(1, 0.2 * flick)], [0.5, cg(1, 0.09 * flick)], [1, cg(1, 0)]]);
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.restore();
    drawBars(ctx, lampX);
    const snapped = t >= 6;
    const showShadow = pose && !snapped;
    if (showShadow) {
      castShadow(pose);
      putShadow(ctx, pose, 0.92);
    }
    K.put(ctx, L.fg, 0, 0, 1000, 1000);
    if (showShadow) { // the shadow breaks over the staircase, a step nearer the lamp
      const k = castK(pose.x);
      ctx.save();
      K.path(ctx, STAIR, true); ctx.clip();
      putShadow(ctx, pose, 0.42, 9 * k, 7 * k, false);
      ctx.restore();
    }
    ctx.restore();

    // ---- lamp flicker, vignette
    ctx.fillStyle = `rgba(0,3,8,${0.16 * (1 - flick) + 0.02})`;
    ctx.fillRect(0, 0, 1000, 1000);
    if (K.hash1(fq * 17 + 3) > 0.93) { ctx.fillStyle = cg(1, 0.05); ctx.fillRect(0, 0, 1000, 1000); }
    K.put(ctx, L.vig, 0, 0, 1000, 1000);

    // ---- the shadow powers up: a green edge creeps round it, and on the beat it becomes the trace
    if (t >= 5.7 && t < 7.6) {
      const tp = env.poseAt(Math.min(t, 6.7));
      const e = K.clamp((t - 5.7) / 0.3);
      const A = t < 6 ? 0.3 * e * e : (0.6 + 0.4 * Beat.hit(t, 6, 5)) * (1 - K.smoothstep(6.55, 7.5, t));
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const gx = Math.min(tp.x, 1010), gy = tp.y - 150;
      ctx.fillStyle = K.radGrad(ctx, gx, gy, 20, 560, [[0, `rgba(70,255,140,${0.3 * A})`], [0.4, `rgba(40,220,110,${0.13 * A})`], [1, 'rgba(20,160,80,0)']]);
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.fillStyle = `rgba(30,150,75,${0.1 * A})`;
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.restore();
      if (t < 6) {
        if (pose) drawTrace(ctx, pose, { Rig, alpha: 0.3 + 0.6 * e, reveal: e, jitterSeed: Math.floor(T * 30 + 1e-6), width: 2, glow: 5 + 5 * e, shake: 0.4 });
      } else drawPersist(ctx, env, t, { Rig, alpha: 1, boost: Beat.hit(t, 6, 6) });
    }

    filmDamage(ctx, T);
  },
};
