// Panel 21 — the press conference. An empty chair, a bank of unbranded microphones, a nameplate:
// "The Pelican (In Person)". Flashes pop on the strong beats while the camera pushes in; on the final beat the
// pelican tears past behind the chair without looking back, the bell on the table rings, and the film freezes.
//
// render(ctx, t, env): t = seconds since the outro began (negative while the panel is only glimpsed beside §20).
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';

let L = null;
export const FLASHES = [4.0, 5.0, 5.12, 6.0, 7.0, 7.14]; // strong beats of bars 3–4 (+ a couple of echoes)
export const ZIP = 10.0; // the final strong beat
const SRC = [[170, 930], [505, 960], [840, 925], [330, 950], [690, 940], [600, 955]]; // which camera fires each flash
const TABLE_Y = 616, FRONT = 704; // back and front edges of the table top

function mic(ctx, x, y, hx, hy, kind, col) {
  // stand from the table (x,y) to the head (hx,hy)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#17181c';
  ctx.lineWidth = 5;
  K.path(ctx, [[x, y], [x, y - 26], [hx, hy + 10]]);
  ctx.stroke();
  ctx.fillStyle = '#101114';
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 6.5, 0, 0, K.TAU);
  ctx.fill();
  const a = Math.atan2(hy - (y - 26), hx - x);
  ctx.translate(hx, hy);
  ctx.rotate(a + Math.PI / 2);
  if (kind === 0) {
    // ball-head reporter's microphone with a blank flag
    ctx.fillStyle = '#25272d';
    K.roundRect(ctx, -6, -2, 12, 46, 5);
    ctx.fill();
    ctx.fillStyle = col;
    K.roundRect(ctx, -15, 6, 30, 26, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-15, 6, 30, 5);
    ctx.fillStyle = K.radGrad(ctx, -4, -16, 2, 18, [[0, '#9aa0aa'], [1, '#3a3d45']]);
    ctx.beginPath();
    ctx.arc(0, -12, 15, 0, K.TAU);
    ctx.fill();
  } else if (kind === 1) {
    // foam windscreen
    ctx.fillStyle = '#25272d';
    K.roundRect(ctx, -5, 0, 10, 40, 4);
    ctx.fill();
    ctx.fillStyle = col;
    K.roundRect(ctx, -13, -40, 26, 46, 13);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    K.roundRect(ctx, 1, -40, 12, 46, 8);
    ctx.fill();
  } else {
    // slim condenser
    ctx.fillStyle = '#2c2f36';
    K.roundRect(ctx, -4.5, -34, 9, 72, 4);
    ctx.fill();
    ctx.fillStyle = '#8f96a1';
    K.roundRect(ctx, -4.5, -34, 9, 20, 4);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.fillRect(-6, 4, 12, 7);
  }
  ctx.restore();
}

function chair(ctx) {
  // high-backed leather chair, centred on x = 500, seat hidden behind the table
  const g = K.linGrad(ctx, 372, 0, 628, 0, [[0, '#191a1f'], [0.3, '#34363e'], [0.62, '#2a2c33'], [1, '#121317']]);
  ctx.fillStyle = '#0e0f12';
  K.roundRect(ctx, 342, 560, 44, 110, 16); // arm rests
  ctx.fill();
  K.roundRect(ctx, 614, 560, 44, 110, 16);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(384, 690);
  ctx.bezierCurveTo(370, 520, 372, 400, 404, 352);
  ctx.bezierCurveTo(430, 318, 570, 318, 596, 352);
  ctx.bezierCurveTo(628, 400, 630, 520, 616, 690);
  ctx.closePath();
  ctx.fill();
  // stitched panels and a soft sheen
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  for (const y of [420, 492, 564, 632]) {
    ctx.beginPath();
    ctx.moveTo(392, y);
    ctx.quadraticCurveTo(500, y + 12, 608, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  for (const y of [423, 495, 567]) {
    ctx.beginPath();
    ctx.moveTo(392, y);
    ctx.quadraticCurveTo(500, y + 12, 608, y);
    ctx.stroke();
  }
  ctx.fillStyle = K.linGrad(ctx, 400, 340, 520, 520, [[0, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']]);
  ctx.beginPath();
  ctx.ellipse(446, 420, 44, 88, 0.2, 0, K.TAU);
  ctx.fill();
  // dimpled seat cushion catching the light: nobody has sat here
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.ellipse(500, 640, 96, 20, 0, 0, K.TAU);
  ctx.fill();
}

export default {
  id: 21, key: 'press',
  async init() {
    const res = 1.2;
    const backdrop = K.layer(1000, 1000, res, (ctx) => {
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 700, [[0, '#16324a'], [1, '#0e2236']]);
      ctx.fillRect(0, 0, 1000, 1000);
      // step-and-repeat backdrop: a wheel emblem and the event name, tone on tone (no real marks)
      ctx.save();
      ctx.rotate(-0.06);
      for (let j = -1; j < 9; j++) {
        for (let i = -1; i < 7; i++) {
          const x = i * 190 + (j % 2) * 95, y = j * 92;
          const c = 'rgba(160,200,230,0.2)';
          if ((i + j) % 2 === 0) {
            ctx.strokeStyle = c;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, K.TAU);
            ctx.stroke();
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let k = 0; k < 8; k++) {
              ctx.moveTo(x, y);
              ctx.lineTo(x + Math.cos((k * K.TAU) / 8) * 22, y + Math.sin((k * K.TAU) / 8) * 22);
            }
            ctx.stroke();
          } else {
            K.text(ctx, 'THE PELICAN TEST', x, y - 2, { size: 17, font: K.FONT.geo, weight: 700, align: 'center', color: c, tracking: 2 });
            K.text(ctx, '記 者 會', x, y + 20, { size: 16, font: K.FONT.cjkSans, weight: 700, align: 'center', color: c });
          }
        }
      }
      ctx.restore();
      // pool of light on the backdrop behind the chair
      ctx.fillStyle = K.radGrad(ctx, 500, 330, 40, 620, [[0, 'rgba(210,235,255,0.26)'], [0.5, 'rgba(120,170,210,0.08)'], [1, 'rgba(0,0,0,0.45)']]);
      ctx.fillRect(0, 0, 1000, 1000);
      // resting shadow of the chair
      ctx.save();
      ctx.filter = `blur(${14 * res}px)`;
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      K.roundRect(ctx, 410, 330, 250, 360, 90);
      ctx.fill();
      ctx.restore();
    });
    const chairLay = K.layer(1000, 1000, res, (ctx) => chair(ctx));
    const table = K.layer(1000, 1000, res, (ctx) => {
      // table top in perspective and the cloth front
      ctx.fillStyle = K.linGrad(ctx, 0, TABLE_Y, 0, FRONT, [[0, '#2f4a66'], [1, '#41607f']]);
      ctx.beginPath();
      ctx.moveTo(40, TABLE_Y);
      ctx.lineTo(960, TABLE_Y);
      ctx.lineTo(1010, FRONT);
      ctx.lineTo(-10, FRONT);
      ctx.fill();
      ctx.fillStyle = K.linGrad(ctx, 0, FRONT, 0, 1000, [[0, '#223b54'], [0.5, '#1a2f45'], [1, '#132336']]);
      ctx.fillRect(-10, FRONT, 1020, 400);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(-10, FRONT, 1020, 3);
      // soft folds in the cloth
      const r = K.rng(21);
      for (let i = 0; i < 16; i++) {
        const x = i * 66 + r.range(-12, 12);
        ctx.fillStyle = K.linGrad(ctx, x - 18, 0, x + 18, 0, [[0, 'rgba(0,0,0,0)'], [0.5, i % 2 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.05)'], [1, 'rgba(0,0,0,0)']]);
        ctx.fillRect(x - 18, FRONT + 6, 36, 360);
      }
      // water, untouched; a recorder left running
      ctx.fillStyle = 'rgba(200,230,250,0.28)';
      K.roundRect(ctx, 762, FRONT - 86, 30, 70, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,240,255,0.5)';
      ctx.fillRect(764, FRONT - 64, 26, 46);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(767, FRONT - 82, 3, 60);
      ctx.fillStyle = '#17181c';
      K.roundRect(ctx, 176, FRONT - 40, 46, 22, 5);
      ctx.fill();
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(186, FRONT - 30, 3, 0, K.TAU);
      ctx.fill();
    });
    const mics = K.layer(1000, 1000, res, (ctx) => {
      const cols = ['#c9573f', '#e8c66a', '#3b7a57', '#35506b', '#8a5aa8', '#d9d4c8', '#2d6a6a'];
      // [stand x, stand depth on the table, head x, head y, kind] — a fan of microphones aimed at an absent beak
      const list = [[262, 0, 356, 500, 0], [330, 14, 398, 536, 1], [392, 4, 440, 498, 2], [608, 4, 560, 498, 2], [670, 14, 602, 536, 1], [738, 0, 644, 500, 0], [446, 24, 468, 560, 0], [554, 24, 532, 560, 1]];
      list.forEach(([x, dy, hx, hy, kind], i) => mic(ctx, x, TABLE_Y + 22 + dy, hx, hy, kind, cols[i % cols.length]));
    });
    const plate = K.layer(400, 110, 2, (ctx) => {
      // tent card, pivot at bottom centre (200, 104)
      ctx.fillStyle = K.linGrad(ctx, 0, 6, 0, 104, [[0, '#fbf8f0'], [1, '#ded8ca']]);
      ctx.beginPath();
      ctx.moveTo(14, 104);
      ctx.lineTo(26, 8);
      ctx.lineTo(374, 8);
      ctx.lineTo(386, 104);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      K.text(ctx, 'The Pelican', 200, 52, { size: 42, font: K.FONT.serif, weight: 700, align: 'center', color: '#1c1a17' });
      K.text(ctx, '(In Person)', 200, 88, { size: 30, font: K.FONT.serif, italic: true, align: 'center', color: '#3a3630' });
    });
    const crowd = K.layer(1000, 1000, res, (ctx) => {
      // the press pack: soft, dark, out of focus
      ctx.filter = `blur(${5 * res}px)`;
      const r = K.rng(8);
      for (let i = 0; i < 9; i++) {
        const x = 30 + i * 118 + r.range(-20, 20), y = 962 + r.range(-12, 24);
        ctx.fillStyle = `rgb(${8 + i % 3 * 4},${9 + i % 2 * 4},${12 + i % 3 * 3})`;
        ctx.beginPath();
        ctx.arc(x, y, r.range(44, 58), 0, K.TAU);
        ctx.fill();
        ctx.fillRect(x - 86, y + 36, 172, 120);
      }
      for (const [x, y] of SRC.slice(0, 5)) {
        ctx.fillStyle = '#07080a';
        K.roundRect(ctx, x - 40, y - 34, 80, 54, 10);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y - 6, 20, 0, K.TAU);
        ctx.fill();
        ctx.fillRect(x - 14, y + 10, 28, 90);
      }
    });
    const bell = K.layer(60, 44, 3, (ctx) => {
      // a bicycle bell on the table: pivot at (30, 40)
      ctx.fillStyle = '#17181c';
      ctx.fillRect(18, 34, 24, 7);
      ctx.fillStyle = K.radGrad(ctx, 23, 16, 2, 24, [[0, '#fff6d8'], [0.4, '#e5c060'], [1, '#8a6a22']]);
      ctx.beginPath();
      ctx.arc(30, 36, 21, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#6b5218';
      ctx.fillRect(9, 34, 42, 3);
      ctx.fillStyle = '#17181c';
      ctx.fillRect(44, 22, 12, 5);
    });
    L = { backdrop, chairLay, table, mics, plate, crowd, bell };
  },

  render(ctx, t, env) {
    const freeze = Math.min(t, ZIP + 1.15); // after the wake settles, nothing moves
    const tt = freeze;
    K.put(ctx, L.backdrop);

    // flash state
    let fi = 0, src = SRC[0];
    FLASHES.forEach((f, i) => {
      if (tt >= f) {
        const v = Math.exp(-(tt - f) * 13);
        if (v > fi) {
          fi = v;
          src = SRC[i % SRC.length];
        }
      }
    });
    // hard flash shadow of the chair thrown up the backdrop, away from the camera that fired
    if (fi > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.5 * fi;
      ctx.globalCompositeOperation = 'multiply';
      const dx = (500 - src[0]) * 0.12;
      ctx.translate(dx, -26);
      ctx.fillStyle = '#0a1420';
      ctx.beginPath();
      ctx.moveTo(384, 690);
      ctx.bezierCurveTo(370, 520, 372, 400, 404, 352);
      ctx.bezierCurveTo(430, 318, 570, 318, 596, 352);
      ctx.bezierCurveTo(628, 400, 630, 520, 616, 690);
      ctx.fill();
      ctx.restore();
    }

    // the pelican, in person: a streak behind the chair on the final beat
    const zt = tt - ZIP;
    if (zt > -0.02 && zt < 0.6) {
      const xAt = (q) => -260 + 1560 * K.clamp(q / 0.44);
      for (let g = 12; g >= 0; g--) {
        const q = zt - g * 0.0045;
        if (q < 0) continue;
        const pose = Rig.solve({ x: xAt(q), y: 664, s: 0.9, crank: q * 60, wheel: xAt(q) / 45, t: 125 + tt, wind: 1.5, lean: 0.2, neck: 0.5, headTilt: -0.05, eye: [1, 0] });
        if (g === 0) Rig.drawFlat(ctx, pose, { lw: 2 });
        else Rig.drawSilhouette(ctx, pose, `rgba(236,240,248,${0.07 * (1 - g / 13)})`, { spokesToo: false });
      }
      // speed lines
      const x = xAt(zt);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const y = 430 + i * 26 + K.hash1(i) * 10, len = 160 + K.hash1(i * 3) * 260;
        ctx.lineWidth = 1.5 + K.hash1(i * 5) * 2.5;
        ctx.globalAlpha = 0.5 * (1 - K.smoothstep(0.3, 0.55, zt));
        K.path(ctx, [[x - 150 - len, y], [x - 150, y]]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // chair (sways in the wake), microphones, table, nameplate, bell
    const wake = zt > 0.12 ? Math.exp(-(zt - 0.12) * 4.2) * Math.sin((zt - 0.12) * 17) : 0;
    ctx.save();
    ctx.translate(500, 700);
    ctx.rotate(0.045 * wake);
    ctx.translate(-500, -700);
    K.put(ctx, L.chairLay);
    ctx.restore();
    K.put(ctx, L.table);
    ctx.save();
    ctx.translate(500, TABLE_Y + 30);
    ctx.transform(1, 0, 0.03 * wake, 1, 0, 0); // the stands shiver
    ctx.translate(-500, -(TABLE_Y + 30));
    K.put(ctx, L.mics);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(500, FRONT - 6, 170, 7, 0, 0, K.TAU);
    ctx.fill();
    ctx.translate(500, FRONT - 6);
    ctx.rotate(0.05 * wake);
    ctx.drawImage(L.plate, -164, -86, 328, 90);
    ctx.restore();
    // the bell rings by itself as the pelican passes
    const ring = zt > 0 ? Math.exp(-zt * 5) * Math.sin(zt * 70) : 0;
    ctx.save();
    ctx.translate(268 + ring * 2.5, FRONT - 12);
    ctx.rotate(ring * 0.12);
    ctx.drawImage(L.bell, -30, -40, 60, 44);
    ctx.restore();
    if (zt > 0 && zt < 0.5) {
      ctx.strokeStyle = `rgba(255,236,170,${0.8 * (1 - zt / 0.5)})`;
      ctx.lineWidth = 2.5;
      for (const k of [1, 2]) {
        ctx.beginPath();
        ctx.arc(268, FRONT - 34, 26 + k * 12 + zt * 50, -2.4, -0.75);
        ctx.stroke();
      }
    }

    K.put(ctx, L.crowd);
    // photographic finish: vignette, then the flash itself
    K.vignette(ctx, 1000, 1000, 0.55, '#000000', 0.42);
    if (fi > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = K.radGrad(ctx, src[0], src[1] - 80, 20, 1100, [[0, `rgba(255,255,255,${0.95 * fi})`], [0.35, `rgba(240,246,255,${0.6 * fi})`], [1, `rgba(220,235,255,${0.28 * fi})`]]);
      ctx.fillRect(0, 0, 1000, 1000);
      // the burst on the camera that fired
      ctx.translate(src[0], src[1] - 30);
      ctx.fillStyle = `rgba(255,255,255,${fi})`;
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.ellipse(0, 0, 150 * fi + 20, 5, 0, 0, K.TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  },
};
