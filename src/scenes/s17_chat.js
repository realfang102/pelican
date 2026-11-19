// Section 17 — Early Chat Window (2000s)
// A conversation window of "Driftwood Messenger", a fictional desktop instant-messenger client of the early 2000s:
// glossy sea-glass title bar, bevelled toolbar of little icons, a buddy header (whose display name is the era's title),
// a banner ad, coloured screen names with timestamps, an input box and a Send button. One message is an animated GIF
// that runs across the whole picture with its ground on the road: the pelican rides inside it, rendered into a
// 250 × 100 buffer, reduced to the web-safe 216-colour palette with a 4×4 Bayer ordered dither, blown up ×4 without
// smoothing, 10 frames/s.
// Beats: before t = 0 the file is still arriving (interlaced passes + transfer bar); GIF complete at 0; the buddy's
// nudge shakes the whole window on 2.0; "kite_04 is typing a message…" from 2.5 (the text appears in the input box);
// the reply pops in on 4.0.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

let L = null;
const GY = 456, GH = 400, GW = 1000; // GIF rect in picture units (ground of the GIF is y = 800)
const BW = 250, BH = 100, BS = 4; // GIF buffer
const NUDGE = 2.0, TYPE = 2.5, REPLY = 4.0;
const C = {
  wall0: '#123c4a', wall1: '#2a6f73', chrome: '#e8e2d4', chromeHi: '#fbf8f0', chromeLo: '#b9b09c', chromeDk: '#8a8170',
  tb0: '#8fe6d6', tb1: '#2aa596', tb2: '#0d6a62', ink: '#1d2633', grey: '#6b6f78', me: '#c0392b', buddy: '#1a6fa0',
  pane: '#ffffff', sys: '#7d7f86', accent: '#f08a24',
};
const sans = K.FONT.sans, chat = K.FONT.chat;

// ------------------------------------------------------------------------------------------- little UI painters
function bevel(ctx, x, y, w, h, inset = false, fill = C.chrome) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = inset ? C.chromeDk : C.chromeHi;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = inset ? C.chromeHi : C.chromeDk;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}
function gloss(ctx, x, y, w, h, r, c0, c1, c2) {
  ctx.fillStyle = K.linGrad(ctx, 0, y, 0, y + h, [[0, c0], [0.48, c1], [0.52, c2], [1, K.shade(c2, -0.15)]]);
  K.roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.fillStyle = K.linGrad(ctx, 0, y, 0, y + h * 0.5, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0.08)']]);
  K.roundRect(ctx, x + 2, y + 1.5, w - 4, h * 0.46, r * 0.8);
  ctx.fill();
}
function boat(ctx, x, y, k) {
  // the client's logo: a folded paper boat on a wave
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = '#ffffff';
  K.path(ctx, [[-14, 2], [14, 2], [9, 10], [-9, 10]], true);
  ctx.fill();
  ctx.fillStyle = '#ffe28a';
  K.path(ctx, [[-1, -14], [-1, 2], [-12, 2]], true);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  K.path(ctx, [[1, -12], [1, 2], [11, 2]], true);
  ctx.fill();
  ctx.strokeStyle = '#bdf5ec';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, 13);
  ctx.quadraticCurveTo(-8, 9, 0, 13);
  ctx.quadraticCurveTo(8, 17, 16, 13);
  ctx.stroke();
  ctx.restore();
}
function icon(ctx, kind, x, y) {
  // 34-unit toolbar icons of the client's own design
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const ball = (cx, cy, r, c) => {
    ctx.fillStyle = K.radGrad(ctx, cx - r * 0.35, cy - r * 0.4, r * 0.1, r * 1.1, [[0, K.shade(c, 0.6)], [0.5, c], [1, K.shade(c, -0.35)]]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, K.TAU);
    ctx.fill();
  };
  if (kind === 'invite') {
    ball(-6, -6, 7, '#e0884a');
    ctx.fillStyle = '#3a8fb8';
    K.roundRect(ctx, -15, 2, 18, 13, 6);
    ctx.fill();
    ball(8, -3, 6, '#f2b84a');
    ctx.fillStyle = '#52a35a';
    K.roundRect(ctx, 1, 4, 15, 11, 5);
    ctx.fill();
  } else if (kind === 'files') {
    ctx.fillStyle = '#e9b949';
    K.roundRect(ctx, -15, -9, 13, 6, 2);
    ctx.fill();
    ctx.fillStyle = K.linGrad(ctx, 0, -6, 0, 13, [[0, '#ffd977'], [1, '#d99a2b']]);
    K.roundRect(ctx, -15, -6, 30, 20, 3);
    ctx.fill();
    ctx.fillStyle = '#2f9a52';
    K.path(ctx, [[2, -16], [14, -8], [8, -8], [8, 2], [-4, 2], [-4, -8], [-10, -8]], true);
    ctx.fill();
  } else if (kind === 'cam') {
    ball(0, -3, 12, '#9aa4b4');
    ball(0, -3, 6, '#2a3550');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2, -5, 1.8, 0, K.TAU);
    ctx.fill();
    ctx.fillStyle = '#6a7384';
    K.roundRect(ctx, -9, 10, 18, 5, 2);
    ctx.fill();
  } else if (kind === 'voice') {
    ctx.strokeStyle = '#4a5468';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 11, Math.PI, 0);
    ctx.stroke();
    ball(-11, 3, 5.5, '#d8573c');
    ball(11, 3, 5.5, '#d8573c');
    ctx.strokeStyle = '#4a5468';
    ctx.lineWidth = 2;
    K.path(ctx, [[-11, 8], [-6, 14], [2, 14]]);
    ctx.stroke();
  } else if (kind === 'games') {
    ctx.fillStyle = K.linGrad(ctx, -12, -12, 12, 12, [[0, '#ffffff'], [1, '#c9d2dc']]);
    K.roundRect(ctx, -13, -13, 24, 24, 5);
    ctx.fill();
    ctx.strokeStyle = '#7a8594';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    for (const [a, b] of [[-7, -7], [0, 0], [5, 5], [5, -7], [-7, 5]]) {
      ctx.beginPath();
      ctx.arc(a, b, 2.4, 0, K.TAU);
      ctx.fill();
    }
  } else if (kind === 'block') {
    ctx.strokeStyle = '#d0402a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, K.TAU);
    ctx.moveTo(-8, -8);
    ctx.lineTo(8, 8);
    ctx.stroke();
  } else if (kind === 'smile') {
    ball(0, 0, 9, '#ffcf3a');
    ctx.fillStyle = '#5a3a10';
    ctx.fillRect(-4, -4, 2, 3);
    ctx.fillRect(2, -4, 2, 3);
    ctx.strokeStyle = '#5a3a10';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0.3, Math.PI - 0.3);
    ctx.stroke();
  } else if (kind === 'font') {
    K.text(ctx, 'A', -2, 7, { size: 20, font: 'Georgia, serif', weight: 700, align: 'center', color: '#2a3550' });
    ctx.fillStyle = '#d0402a';
    ctx.fillRect(-10, 9, 18, 3);
  } else if (kind === 'nudge') {
    ctx.strokeStyle = '#4a5468';
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(0, 0, 9, s > 0 ? -0.7 : Math.PI - 0.7, s > 0 ? 0.7 : Math.PI + 0.7);
      ctx.stroke();
    }
    ball(0, 0, 5, '#2aa596');
  }
  ctx.restore();
}
function avatar(ctx, x, y, s) {
  // buddy picture: a lighthouse on a dusk sea, in a bevelled frame
  bevel(ctx, x - 6, y - 6, s + 12, s + 12, false);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, s, s);
  ctx.clip();
  ctx.fillStyle = K.linGrad(ctx, 0, y, 0, y + s, [[0, '#2b3f7a'], [0.5, '#e98a6a'], [0.62, '#ffd59a'], [0.63, '#2c6f8a'], [1, '#173f5a']]);
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(255,240,200,0.35)';
  K.path(ctx, [[x + s * 0.62, y + s * 0.3], [x + s * 1.1, y + s * 0.1], [x + s * 1.1, y + s * 0.42]], true);
  ctx.fill();
  ctx.fillStyle = '#2a2a3a';
  K.path(ctx, [[x + s * 0.3, y + s], [x + s * 0.45, y + s * 0.72], [x + s * 0.85, y + s * 0.72], [x + s, y + s]], true);
  ctx.fill();
  const lx = x + s * 0.62;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#c8372d';
    K.path(ctx, [[lx - 9 + i * 1.3, y + s * 0.74 - i * 9], [lx + 9 - i * 1.3, y + s * 0.74 - i * 9], [lx + 8 - (i + 1) * 1.3, y + s * 0.74 - (i + 1) * 9], [lx - 8 + (i + 1) * 1.3, y + s * 0.74 - (i + 1) * 9]], true);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(lx - 5, y + s * 0.74 - 44, 10, 8);
  ctx.fillStyle = '#2a2a3a';
  K.path(ctx, [[lx - 7, y + s * 0.74 - 44], [lx, y + s * 0.74 - 52], [lx + 7, y + s * 0.74 - 44]], true);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- baked window
const TB0 = 16, TB1 = 58, MENU1 = 84, TOOL1 = 142, HEAD1 = 270, STAT1 = 298, LBL0 = 862, IN0 = 946, WIN1 = 986;
const LINES = [
  ['10:39 PM', 'kite_04', C.me, 'you still up?'],
  ['10:40 PM', 'archive_pip', C.buddy, 'found this in the archive'],
  ['10:40 PM', 'archive_pip', C.buddy, "apparently it's ancient"],
  ['10:41 PM', 'archive_pip', C.buddy, 'pelican_bike.gif'],
];
function chatLine(ctx, x, y, [time, who, col, msg], file = false) {
  let w = K.text(ctx, `(${time}) `, x, y, { size: 17, font: sans, color: C.sys });
  w += K.text(ctx, who + ':', x + w, y, { size: 21, font: sans, weight: 700, color: col });
  if (file) K.text(ctx, ' sent a file — ' + msg, x + w, y, { size: 21, font: chat, color: C.ink });
  else K.text(ctx, ' ' + msg, x + w, y, { size: 23, font: chat, color: C.ink });
}
function buildWindow() {
  return K.layer(1000, 1000, 1.5, (ctx) => {
    const X0 = -12, X1 = 1012;
    // frame + title bar
    ctx.fillStyle = C.chrome;
    K.roundRect(ctx, X0, TB0, X1 - X0, WIN1 - TB0, 12);
    ctx.fill();
    gloss(ctx, X0, TB0, X1 - X0, TB1 - TB0 + 10, 12, C.tb0, C.tb1, C.tb2);
    ctx.fillStyle = C.chrome;
    ctx.fillRect(X0, TB1, X1 - X0, 12);
    ctx.fillStyle = 'rgba(0,40,40,0.35)';
    ctx.fillRect(X0, TB1, X1 - X0, 1.5);
    boat(ctx, 36, TB0 + 21, 0.95);
    K.text(ctx, 'archive_pip — Conversation', 62, TB0 + 28, { size: 21, font: sans, weight: 700, color: '#ffffff', stroke: { color: 'rgba(0,60,55,0.55)', width: 3 } });
    K.text(ctx, 'Driftwood Messenger', 360, TB0 + 28, { size: 16, font: sans, weight: 500, color: 'rgba(235,255,250,0.85)' });
    // caption buttons
    const btn = (x, kind, c) => {
      gloss(ctx, x, TB0 + 7, 30, 27, 5, K.shade(c, 0.45), c, K.shade(c, -0.2));
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.2;
      K.roundRect(ctx, x, TB0 + 7, 30, 27, 5);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      const cx = x + 15, cy = TB0 + 20.5;
      ctx.beginPath();
      if (kind === 0) {
        ctx.moveTo(cx - 6, cy + 5);
        ctx.lineTo(cx + 6, cy + 5);
      } else if (kind === 1) {
        ctx.lineWidth = 2.2;
        ctx.rect(cx - 6, cy - 6, 12, 11);
        ctx.moveTo(cx - 6, cy - 4);
        ctx.lineTo(cx + 6, cy - 4);
      } else {
        ctx.moveTo(cx - 5, cy - 5);
        ctx.lineTo(cx + 5, cy + 5);
        ctx.moveTo(cx + 5, cy - 5);
        ctx.lineTo(cx - 5, cy + 5);
      }
      ctx.stroke();
    };
    btn(874, 0, '#2aa596');
    btn(910, 1, '#2aa596');
    btn(946, 2, '#e2603a');
    // menu bar
    let mx = 22;
    for (const m of ['File', 'Edit', 'View', 'Actions', 'Tools', 'Help']) mx += 22 + K.text(ctx, m, mx, MENU1 - 8, { size: 16, font: sans, color: C.ink });
    ctx.fillStyle = C.chromeLo;
    ctx.fillRect(0, MENU1, 1000, 1);
    ctx.fillStyle = C.chromeHi;
    ctx.fillRect(0, MENU1 + 1, 1000, 1);
    // toolbar
    ctx.fillStyle = K.linGrad(ctx, 0, MENU1 + 2, 0, TOOL1, [[0, '#f8f5ee'], [1, '#ddd6c6']]);
    ctx.fillRect(0, MENU1 + 2, 1000, TOOL1 - MENU1 - 2);
    const tools = [['invite', 'Invite'], ['files', 'Send Files'], ['cam', 'Webcam'], ['voice', 'Voice'], ['games', 'Activities'], ['nudge', 'Nudge'], ['block', 'Block']];
    tools.forEach(([k, label], i) => {
      const x = 52 + i * 104;
      icon(ctx, k, x, MENU1 + 22);
      K.text(ctx, label, x, TOOL1 - 8, { size: 14, font: sans, align: 'center', color: C.ink });
      if (i === 3 || i === 5) {
        ctx.fillStyle = C.chromeLo;
        ctx.fillRect(x + 52, MENU1 + 8, 1, TOOL1 - MENU1 - 16);
      }
    });
    // banner ad (fictional, deadpan)
    const ax = 768, ay = MENU1 + 6, aw = 222, ah = 50;
    ctx.fillStyle = K.linGrad(ctx, ax, 0, ax + aw, 0, [[0, '#2a1a6a'], [1, '#7a2a8a']]);
    ctx.fillRect(ax, ay, aw, ah);
    ctx.strokeStyle = '#ffcf3a';
    ctx.lineWidth = 2;
    ctx.strokeRect(ax + 1, ay + 1, aw - 2, ah - 2);
    K.text(ctx, 'FREE SCREENSAVERS!', ax + aw / 2, ay + 22, { size: 17, font: sans, weight: 800, align: 'center', color: '#ffcf3a' });
    K.text(ctx, 'click here ›', ax + aw / 2, ay + 41, { size: 14, font: sans, weight: 600, align: 'center', color: '#ffffff' });
    K.text(ctx, 'ad', ax + aw - 6, ay + ah + 11, { size: 10, font: sans, align: 'right', color: C.grey });
    // conversation header = the title card
    ctx.fillStyle = K.linGrad(ctx, 0, TOOL1, 0, HEAD1, [[0, '#f3fbf9'], [1, '#d7eee9']]);
    ctx.fillRect(0, TOOL1, 1000, HEAD1 - TOOL1);
    ctx.fillStyle = 'rgba(42,165,150,0.5)';
    ctx.fillRect(0, TOOL1, 1000, 1.5);
    avatar(ctx, 30, TOOL1 + 16, 96);
    // online dot
    ctx.fillStyle = K.radGrad(ctx, 152, TOOL1 + 32, 1, 11, [[0, '#c8ffb0'], [0.6, '#3fbf3a'], [1, '#1e7a20']]);
    ctx.beginPath();
    ctx.arc(154, TOOL1 + 36, 10, 0, K.TAU);
    ctx.fill();
    const T = TITLES[17];
    const zw = K.text(ctx, T.zh, 176, TOOL1 + 54, { size: 46, font: K.FONT.cjkSans, weight: 700, color: '#12324a' });
    K.text(ctx, '<archive_pip>  (Online)', 176 + zw + 16, TOOL1 + 52, { size: 18, font: sans, color: C.grey });
    K.text(ctx, `“${T.en}”`, 178, TOOL1 + 90, { size: 27, font: sans, italic: true, weight: 500, color: '#2a5a66' });
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(186, TOOL1 + 112, 6, 0, K.TAU);
    ctx.fill();
    K.text(ctx, `${T.date}  ·  personal message`, 200, TOOL1 + 119, { size: 22, font: sans, weight: 600, color: '#3a3f48' });
    // my own small picture on the right of the header
    bevel(ctx, 900, TOOL1 + 30, 74, 74, false);
    ctx.fillStyle = K.linGrad(ctx, 0, TOOL1 + 36, 0, TOOL1 + 98, [[0, '#9ad6ff'], [1, '#e8f6ff']]);
    ctx.fillRect(906, TOOL1 + 36, 62, 62);
    ctx.fillStyle = '#e2603a';
    K.path(ctx, [[937, TOOL1 + 44], [956, TOOL1 + 64], [937, TOOL1 + 84], [918, TOOL1 + 64]], true);
    ctx.fill();
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 1.5;
    K.path(ctx, [[937, TOOL1 + 84], [930, TOOL1 + 98]]);
    ctx.stroke();
    K.text(ctx, 'kite_04', 937, TOOL1 + 122, { size: 14, font: sans, align: 'center', color: C.grey });
    // status strip (typing line is drawn per frame) + pane
    bevel(ctx, 0, HEAD1, 1000, STAT1 - HEAD1, false, '#ece7da');
    ctx.fillStyle = C.pane;
    ctx.fillRect(0, STAT1, 1000, IN0 - 6 - STAT1);
    ctx.fillStyle = C.chromeDk;
    ctx.fillRect(0, STAT1, 1000, 2);
    // earlier lines
    LINES.forEach((ln, i) => chatLine(ctx, 18, STAT1 + 34 + i * 38, ln, i === 3));
    // input area
    bevel(ctx, 0, IN0 - 6, 1000, WIN1 - IN0 + 6, false);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(16, IN0, 770, 34);
    ctx.strokeStyle = '#8a95a6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, IN0, 770, 34);
    icon(ctx, 'smile', 806, IN0 + 17);
    icon(ctx, 'font', 840, IN0 + 17);
    gloss(ctx, 872, IN0, 112, 34, 7, '#ffe0b0', '#f6a33a', '#e07d14');
    ctx.strokeStyle = '#b05a0a';
    ctx.lineWidth = 1.2;
    K.roundRect(ctx, 872, IN0, 112, 34, 7);
    ctx.stroke();
    K.text(ctx, 'Send', 928, IN0 + 24, { size: 19, font: sans, weight: 700, align: 'center', color: '#ffffff', stroke: { color: 'rgba(120,50,0,0.5)', width: 2.5 } });
  });
}
function buildWallpaper() {
  return K.layer(1000, 1000, 0.5, (ctx) => {
    ctx.fillStyle = K.linGrad(ctx, 0, 0, 1000, 1000, [[0, C.wall0], [1, C.wall1]]);
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 6;
    for (let x = -1000; x < 1000; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 1000);
      ctx.lineTo(x + 1000, 0);
      ctx.stroke();
    }
  });
}

// ------------------------------------------------------------------------------------------- the GIF
// GIF content is authored in picture units (x 0..1000, y GY..GY+GH) and drawn at 1/4 into the buffer
function buildGifBackdrop() {
  const c = K.makeCanvas(BW, BH), g = c.getContext('2d');
  g.setTransform(1 / BS, 0, 0, 1 / BS, 0, -GY / BS);
  g.fillStyle = K.linGrad(g, 0, GY, 0, 760, [[0, '#3f86d8'], [0.7, '#9fd0f5'], [1, '#e6f6ff']]);
  g.fillRect(0, GY, 1000, 360);
  // sun with a soft halo
  g.fillStyle = K.radGrad(g, 860, 530, 10, 170, [[0, 'rgba(255,250,210,1)'], [0.25, 'rgba(255,236,150,0.9)'], [0.32, 'rgba(255,236,170,0.45)'], [1, 'rgba(255,240,200,0)']]);
  g.fillRect(600, GY, 400, 300);
  // far hills
  g.fillStyle = K.linGrad(g, 0, 690, 0, 770, [[0, '#7fb0a0'], [1, '#5f9a7a']]);
  g.beginPath();
  g.moveTo(0, 770);
  for (let x = 0; x <= 1000; x += 20) g.lineTo(x, 735 - 30 * Math.sin(x * 0.006 + 1) - 14 * Math.sin(x * 0.017));
  g.lineTo(1000, 770);
  g.fill();
  // meadow
  g.fillStyle = K.linGrad(g, 0, 740, 0, 800, [[0, '#7cc04a'], [1, '#3f9a30']]);
  g.beginPath();
  g.moveTo(0, 800);
  for (let x = 0; x <= 1000; x += 20) g.lineTo(x, 758 - 8 * Math.sin(x * 0.011 + 2));
  g.lineTo(1000, 800);
  g.fill();
  // a few trees and flowers
  for (const [x, s] of [[120, 1], [310, 0.7], [690, 0.85], [930, 1.1]]) {
    g.fillStyle = '#6b4a2a';
    g.fillRect(x - 4 * s, 760 - 40 * s, 8 * s, 40 * s);
    g.fillStyle = K.radGrad(g, x - 10 * s, 715 - 40 * s, 4, 50 * s, [[0, '#9fe060'], [1, '#2f7a28']]);
    g.beginPath();
    g.arc(x, 722 - 40 * s, 38 * s, 0, K.TAU);
    g.fill();
  }
  const r = K.rng(17);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = r.pick(['#ffffff', '#ffe040', '#ff6aa0']);
    g.fillRect(r.range(0, 1000), r.range(768, 796), 6, 6);
  }
  // road
  g.fillStyle = '#9aa0a6';
  g.fillRect(0, 798, 1000, 4);
  g.fillStyle = K.linGrad(g, 0, 802, 0, 846, [[0, '#6b7077'], [1, '#4f545a']]);
  g.fillRect(0, 802, 1000, 44);
  g.fillStyle = '#ffffff';
  for (let x = 20; x < 1000; x += 100) g.fillRect(x, 822, 52, 6);
  g.fillStyle = '#3f9a30';
  g.fillRect(0, 846, 1000, 12);
  return c;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
function ditherWebSafe(g) {
  const id = g.getImageData(0, 0, BW, BH), d = id.data;
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      const i = (y * BW + x) * 4, b = BAYER[(y & 3) * 4 + (x & 3)] * 51;
      for (let k = 0; k < 3; k++) d[i + k] = Math.min(5, Math.max(0, Math.round((d[i + k] + b) / 51))) * 51;
      d[i + 3] = 255;
    }
  }
  g.putImageData(id, 0, 0);
}
function renderGif(t, env) {
  const g = L.gg, tq = Math.floor(t * 10 + 1e-6) / 10;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(L.backdrop, 0, 0);
  g.setTransform(1 / BS, 0, 0, 1 / BS, 0, -GY / BS);
  // drifting clouds (wrap around the GIF)
  for (const [x0, y, w, sp] of [[80, 520, 150, 14], [430, 560, 200, 9], [760, 500, 120, 18]]) {
    const x = ((x0 + tq * sp) % 1250) - 120;
    g.fillStyle = '#ffffff';
    for (const [dx, dy, r] of [[0, 0, 0.22], [0.25, -0.12, 0.26], [0.5, 0, 0.22], [0.25, 0.05, 0.3]]) {
      g.beginPath();
      g.ellipse(x + dx * w, y + dy * w, r * w, r * w * 0.6, 0, 0, K.TAU);
      g.fill();
    }
  }
  if (env.pose) {
    const p = env.pose;
    g.fillStyle = 'rgba(30,40,30,0.35)';
    g.beginPath();
    g.ellipse(p.x - 6, 803, 130, 8, 0, 0, K.TAU);
    g.fill();
    Rig.drawFlat(g, p, { lw: 3.2, fill: { frame: '#e0302a', scarf: '#2a5ad8', beak: '#ffc020', pouch: '#ff8a20', leg: '#ff9a20', foot: '#ff9a20' } });
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  ditherWebSafe(g);
}

export default {
  id: 17, key: 'chat', title: TITLES[17],
  heroT: 3.0,
  stutter: 10,
  async init() {
    L = {
      win: buildWindow(),
      wall: buildWallpaper(),
      backdrop: buildGifBackdrop(),
      gif: K.makeCanvas(BW, BH),
    };
    L.gg = L.gif.getContext('2d', { willReadFrequently: true });
    L.gg.imageSmoothingEnabled = true;
  },
  render(ctx, t, env) {
    K.put(ctx, L.wall);
    // nudge: a few frames of sharp jitter, decaying
    let dx = 0, dy = 0;
    const nt = t - NUDGE;
    if (nt >= 0 && nt < 0.5) {
      const f = Math.floor(nt * 30), k = 1 - nt / 0.5;
      dx = (K.hash1(f * 7 + 1) * 2 - 1) * 36 * k;
      dy = (K.hash1(f * 13 + 5) * 2 - 1) * 18 * k;
      if (env.hero) dx = dy = 0;
    }
    ctx.save();
    ctx.translate(Math.round(dx), Math.round(dy));
    K.put(ctx, L.win);
    // --- the GIF (with interlaced passes while it is still arriving)
    const DONE = -1.2; // the file finishes arriving just before the beak reaches the frame
    const prog = t >= DONE ? 1 : 0.28 + 0.72 * K.clamp((t + 7) / (7 + DONE));
    renderGif(t, env);
    ctx.imageSmoothingEnabled = false;
    if (prog >= 1) ctx.drawImage(L.gif, 0, GY, GW, GH);
    else {
      const step = prog < 0.5 ? 8 : prog < 0.75 ? 4 : 2;
      for (let y = 0; y < BH; y += step) ctx.drawImage(L.gif, 0, y, BW, 1, 0, GY + y * BS, GW, Math.min(step, BH - y) * BS);
    }
    ctx.imageSmoothingEnabled = true;
    // --- file row under the GIF: transfer bar before 0, label after
    if (prog < 1) {
      const kb = Math.floor(214 * prog);
      icon(ctx, 'files', 34, LBL0 + 20);
      K.text(ctx, `Receiving pelican_bike.gif…  ${kb} of 214 KB  (5.2 KB/sec)`, 62, LBL0 + 26, { size: 18, font: sans, color: C.ink });
      const bx = 560, bw = 210;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, LBL0 + 10, bw, 20);
      ctx.strokeStyle = '#7d8696';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, LBL0 + 10, bw, 20);
      const n = Math.floor(prog * 20);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = K.linGrad(ctx, 0, LBL0 + 12, 0, LBL0 + 28, [[0, '#b8f0a0'], [0.5, '#3fbf3a'], [1, '#2a9a2a']]);
        ctx.fillRect(bx + 3 + i * 10.2, LBL0 + 13, 8, 14);
      }
      K.text(ctx, 'Cancel', 800, LBL0 + 26, { size: 17, font: sans, color: '#1a5fc0' });
    } else {
      K.text(ctx, 'pelican_bike.gif · 214 KB', 18, LBL0 + 24, { size: 18, font: sans, color: C.sys });
      K.text(ctx, 'Open  ·  Save As…', 250, LBL0 + 24, { size: 18, font: sans, color: '#1a5fc0' });
    }
    if (t >= NUDGE) K.text(ctx, '— archive_pip has just sent you a nudge! —', 982, LBL0 + 24, { size: 18, font: sans, italic: true, align: 'right', color: '#c05a10' });
    // --- typing status (under the header) and the text appearing in the input box
    const msg = 'is that a PELICAN??';
    if (t >= TYPE && t < REPLY) {
      const dots = '.'.repeat(1 + (Math.floor((t - TYPE) * 4) % 3));
      icon(ctx, 'font', 30, HEAD1 + 14);
      K.text(ctx, 'kite_04 is typing a message' + dots, 52, HEAD1 + 20, { size: 18, font: sans, italic: true, color: '#3a4250' });
      const n = Math.min(msg.length, Math.floor(((t - TYPE) / 1.35) * msg.length));
      const tw = K.text(ctx, msg.slice(0, n), 24, K.lerp(IN0, IN0 + 34, 0.5) + 8, { size: 21, font: chat, color: C.ink });
      if (Math.floor(t * 4) % 2 === 0) {
        ctx.fillStyle = C.ink;
        ctx.fillRect(26 + tw, IN0 + 7, 1.5, 21);
      }
    } else {
      K.text(ctx, t >= REPLY ? 'Last message received at 10:42 PM' : 'archive_pip is Online', 24, HEAD1 + 20, { size: 16, font: sans, color: C.grey });
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillStyle = C.ink;
        ctx.fillRect(24, IN0 + 7, 1.5, 21);
      }
    }
    // --- the reply pops in on 4.0
    if (t >= REPLY) {
      const pop = K.ease.outBack(K.prog(t, REPLY, 0.12));
      ctx.save();
      ctx.translate(18, 920);
      ctx.scale(1, pop);
      chatLine(ctx, 0, 0, ['10:42 PM', 'kite_04', C.me, msg]);
      ctx.restore();
    }
    ctx.restore();
  },
};
