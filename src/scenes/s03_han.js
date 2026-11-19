// Section 3 — Han Dynasty Stone Relief Rubbing (c. 100 CE, ink) — homage to the Wu Family Shrines and Yinan
// An ink rubbing (拓片) of an Eastern Han pictorial stone: bare-paper figures on dabbed black. Three registers between
// carved border bands — spirits above, a pavilion feast and a tree with an archer, and on the road a procession of
// horses and canopied carriages (車馬出行) with a gap in it. The pelican slips into the gap and trots along in line.
//
// Technique (shared ink toolkit K.ink): the ground is K.ink.xuan paper; the black is K.ink.rubbingize's dabbed ink,
// worked over with pad marks, the ghost of chisel striations, folds and the losses of the stone. Every figure is drawn
// as a WHITE silhouette with details cut back into it (destination-out = an incised line that takes the ink), then
// "paperized": speckled by a stone-anchored mask and filled with the paper itself. Anything that moves (horses' legs
// and heads, the driver's reins, the kneeling attendant, the pelican) goes through the same treatment, so it reads as
// carved in the same stone. The pelican is carved again every frame into a small buffer.
import * as K from '../kit/index.js';
import * as Rig from '../rig/index.js';
import { TITLES } from './titles.js';

const I = K.ink;
const RES = 1.2;
const RY = K.ROAD_Y;
const TAU = Math.PI * 2;
const WH = '#ffffff';
const INK = '#17140f';
const INC = 2.1; // width of an incised line, in picture units
const Y0 = 46, Y1 = 962; // the inked stone, between the paper margins
const UP_Y = 446, LOW_Y = 938; // ground lines of the upper and the roadside register
const UK = 0.9, HX = 188; // carriage units: scale, and where the horse stands in unit-local coordinates
const REAR = 50, FRONT = 728; // wheel x of the two carriages; the gap between them is the pelican's
const EK = 0.44, ESCORT = [212, 326, 440]; // mounted outriders in the roadside register
const KNEEL = { x: 590, k: 0.8 };
const GREET = [672, 740, 808, 876, 944], GK = 0.6; // officials who have come out to greet the procession
let L = null;

// ------------------------------------------------------------------------------------------- carving primitives
// Everything below draws into a "mask": white = cut away from the stone (bare paper in the rubbing).
const cutOn = (c) => { c.globalCompositeOperation = 'destination-out'; };
const cutOff = (c) => { c.globalCompositeOperation = 'source-over'; };
function blob(c, pts) { K.spline(c, pts, true); c.fillStyle = WH; c.fill(); }
function poly(c, pts) { K.path(c, pts, true); c.fillStyle = WH; c.fill(); }
function disc(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = WH; c.fill(); }
function oval(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fillStyle = WH; c.fill(); }
function pit(c, x, y, r) { cutOn(c); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#000'; c.fill(); cutOff(c); }
function line(c, pts, w, smooth = false) {
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = WH; c.lineWidth = w;
  smooth ? K.spline(c, pts) : K.path(c, pts);
  c.stroke();
}
/** an incised line: a ridge left standing inside a figure, so it prints black */
function incise(c, pts, w, smooth = false, closed = false) {
  cutOn(c);
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#000'; c.lineWidth = w;
  smooth ? K.spline(c, pts, closed) : K.path(c, pts, closed);
  c.stroke();
  cutOff(c);
}
function stripPoly(pts, w0, w1 = w0, pw = 1) {
  const P = pts.length > 2 ? K.catmull(pts, 6) : pts;
  return K.ribbonPoly(P, (u) => w1 + (w0 - w1) * Math.pow(1 - u, pw));
}
function strip(c, pts, w0, w1 = w0, pw = 1) { poly(c, stripPoly(pts, w0, w1, pw)); }
/** "keyed": first cut a moat round the shape, so it stands in front of whatever is already carved there */
function keyed(c, iw, tracer) {
  tracer();
  cutOn(c);
  c.lineJoin = 'round'; c.strokeStyle = '#000'; c.lineWidth = iw * 2;
  c.stroke();
  cutOff(c);
  c.fillStyle = WH;
  c.fill();
}
const kblob = (c, pts, iw) => keyed(c, iw, () => K.spline(c, pts, true));
const kpoly = (c, pts, iw) => keyed(c, iw, () => K.path(c, pts, true));
const kstrip = (c, pts, w0, w1, iw, pw = 1) => kpoly(c, stripPoly(pts, w0, w1, pw), iw);
const kdisc = (c, x, y, r, iw) => keyed(c, iw, () => { c.beginPath(); c.arc(x, y, r, 0, TAU); });
/** draw in figure-local coordinates (x = facing, feet on y = 0); fn receives the incised width in local units */
function at(c, x, y, k, dir, fn) {
  c.save();
  c.translate(x, y);
  c.scale(k * dir, k);
  fn(INC / k);
  c.restore();
}
const prof = (stops) => (u) => {
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      return a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0] || 1);
    }
  }
  return stops[stops.length - 1][1];
};
function rule(c, y, h, x0 = 0, x1 = 1000) { c.fillStyle = WH; c.fillRect(x0, y, x1 - x0, h); }

// ------------------------------------------------------------------------------------------- border bands
function lozengeBand(c, x0, x1, y0, y1) {
  rule(c, y0, 2.4, x0, x1);
  rule(c, y1 - 2.4, 2.4, x0, x1);
  const ym = (y0 + y1) / 2, hh = (y1 - y0) / 2 - 5, step = 17;
  c.save();
  c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  const a = [], b = [];
  for (let x = x0 - step, i = 0; x <= x1 + step; x += step, i++) {
    a.push([x, ym + (i % 2 ? hh : -hh)]);
    b.push([x, ym + (i % 2 ? -hh : hh)]);
  }
  c.strokeStyle = WH; c.lineWidth = 2.3; c.lineJoin = 'miter'; c.lineCap = 'butt';
  K.path(c, a); c.stroke();
  K.path(c, b); c.stroke();
  for (const p of a) disc(c, p[0], ym, 1.9);
  c.restore();
}
function sawBand(c, x0, x1, y0, y1) {
  rule(c, y0, 2.2, x0, x1);
  rule(c, y1 - 2.2, 2.2, x0, x1);
  c.fillStyle = WH;
  c.beginPath();
  for (let x = x0 + 2; x < x1; x += 15) {
    c.moveTo(x, y1 - 2.2); c.lineTo(x + 6.5, y0 + 5.5); c.lineTo(x + 13, y1 - 2.2);
  }
  c.fill();
}
function scrollBand(c, x0, x1, y0, y1) {
  rule(c, y0, 2.4, x0, x1);
  rule(c, y1 - 2.4, 2.4, x0, x1);
  const ym = (y0 + y1) / 2, per = 44;
  c.save();
  c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  c.strokeStyle = WH; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
  for (let cx = x0 + 12; cx < x1 + per; cx += per) {
    const pts = [];
    for (let a = 0; a <= 1.001; a += 0.06) {
      const th = 2.2 + a * 3.3 * Math.PI, rad = 1.2 + 7.2 * a;
      pts.push([cx + Math.cos(th) * rad, ym + Math.sin(th) * rad * 0.86]);
    }
    pts.push([cx + per * 0.5, ym + 6.5], [cx + per * 0.78, ym + 2], [cx + per - 7, ym - 5]);
    K.spline(c, pts);
    c.stroke();
  }
  c.restore();
}
function curtainBand(c, x0, x1, y0, y1) {
  rule(c, y1 - 2.4, 2.4, x0, x1);
  c.strokeStyle = WH; c.lineWidth = 2.3; c.lineCap = 'butt';
  for (let x = x0; x < x1; x += 22) {
    c.beginPath(); c.arc(x + 11, y0, 9.6, 0, Math.PI); c.stroke();
    c.beginPath(); c.arc(x + 11, y0, 4.6, 0, Math.PI); c.stroke();
    disc(c, x, y0 + 12, 2.2);
    line(c, [[x, y0 + 14], [x, y0 + 20]], 1.8);
  }
}

// ------------------------------------------------------------------------------------------- horses
const HORSE_BODY = [[-86, -98], [-80, -120], [-56, -130], [-18, -117], [20, -124], [58, -112], [70, -92], [60, -70], [30, -60], [-20, -66], [-52, -74], [-80, -80]];
const HEADS = {
  fwd: { // arched neck, nose tucked in
    neck: [[6, -118], [22, -150], [42, -178], [60, -194], [76, -194], [90, -174], [101, -150], [96, -140], [86, -143], [78, -158], [72, -150], [74, -124], [70, -100], [44, -96]],
    ears: [[[58, -192], [57, -213], [67, -197]], [[66, -195], [71, -215], [76, -196]]],
    eye: [80, -178], mane: [[15, -132], [31, -160], [51, -184]], bridle: [[[70, -188], [90, -150]], [[84, -158], [99, -162]]],
  },
  back: { // looking back over its shoulder
    neck: [[70, -102], [74, -130], [66, -164], [48, -186], [28, -195], [10, -192], [-6, -176], [-16, -156], [-11, -149], [-2, -153], [10, -166], [24, -162], [37, -146], [35, -128], [20, -120], [40, -100]],
    ears: [[[30, -194], [36, -214], [40, -192]], [[19, -193], [21, -214], [30, -195]]],
    eye: [3, -178], mane: [[64, -126], [59, -158], [43, -180]], bridle: [[[15, -191], [-7, -154]], [[-13, -163], [1, -158]]],
  },
};
// head thrown up and back: the forward head swung about the withers
{
  const F = HEADS.fwd, o = [40, -116], a = -0.38, R = (p) => K.rot(p, a, o);
  HEADS.high = {
    neck: F.neck.map((p, i) => (i === 0 || i >= 12 ? p : i === 11 ? K.rot(p, a * 0.45, o) : R(p))),
    ears: F.ears.map((e) => e.map(R)), eye: R(F.eye), mane: F.mane.map(R), bridle: F.bridle.map((b) => b.map(R)),
  };
}
const LEGS = [
  { // near foreleg raised
    far: [{ p: [[42, -80], [45, -42], [43, -8]] }, { p: [[-48, -80], [-36, -44], [-29, -8]] }],
    near: [{ p: [[55, -82], [82, -71], [93, -53], [81, -37]], w: 17, up: true }, { p: [[-62, -86], [-75, -46], [-62, -24], [-64, -8]], w: 26 }],
  },
  { // far foreleg raised, hind legs changed over
    far: [{ p: [[46, -80], [72, -74], [86, -58], [75, -43]], up: true }, { p: [[-50, -80], [-65, -46], [-69, -26], [-75, -8]] }],
    near: [{ p: [[54, -82], [57, -42], [56, -8]], w: 17 }, { p: [[-60, -86], [-58, -46], [-47, -25], [-45, -8]], w: 26 }],
  },
];
function leg(c, l, w, iw, near) {
  const pl = stripPoly(l.p, w, 6, 1.5), e = l.p[l.p.length - 1];
  if (near) kpoly(c, pl, iw);
  else poly(c, pl);
  if (l.up) near ? kdisc(c, e[0], e[1], 6, iw) : disc(c, e[0], e[1], 6);
  else {
    const hoof = [[e[0] - 6, -9], [e[0] + 5, -9], [e[0] + 8, 0], [e[0] - 8, 0]];
    near ? kpoly(c, hoof, iw) : poly(c, hoof);
  }
}
/** part: 'body' | 'legs' (o.pose 0/1) | 'head' (o.kind) — the parts are separate so legs and heads can be re-carved */
function horse(c, x, y, k, dir, part, o = {}) {
  at(c, x, y, k, dir, (iw) => {
    if (part === 'body') {
      strip(c, [[-82, -112], [-100, -128], [-115, -123], [-118, -107]], 8, 12); // bound tail
      disc(c, -118, -105, 6.5);
      blob(c, HORSE_BODY);
      incise(c, [[-37, -125], [-30, -105], [-41, -90]], iw, true); // haunch
      if (o.harness) {
        incise(c, [[9, -119], [12, -63]], iw, true);
        incise(c, [[61, -108], [32, -98], [10, -100]], iw, true);
        incise(c, [[-85, -102], [-40, -98], [10, -100]], iw, true);
      }
      if (o.saddle) incise(c, [[-36, -120], [-34, -94], [6, -94], [8, -121]], iw);
    } else if (part === 'legs') {
      const P = LEGS[o.pose ?? 0];
      for (const l of P.far) leg(c, l, 13, iw, false);
      for (const l of P.near) leg(c, l, l.w, iw, true);
    } else {
      const H = HEADS[o.kind ?? 'fwd'];
      for (const e of H.ears) poly(c, e);
      blob(c, H.neck);
      incise(c, H.mane, iw, true);
      for (const b of H.bridle) incise(c, b, iw * 0.9);
      pit(c, H.eye[0], H.eye[1], 2.7);
      if (o.harness) incise(c, [[9, -128], [40, -113], [70, -109]], iw * 1.2, true); // yoke
    }
  });
}
function wholeHorse(c, x, y, k, dir, o = {}) {
  horse(c, x, y, k, dir, 'body', o);
  horse(c, x, y, k, dir, 'legs', o);
  horse(c, x, y, k, dir, 'head', o);
}

// ------------------------------------------------------------------------------------------- people
function headOf(c, x, y, r, cap, iw) {
  oval(c, x, y, r * 0.92, r);
  poly(c, [[x + r * 0.78, y - r * 0.25], [x + r * 1.3, y + r * 0.12], [x + r * 0.78, y + r * 0.42]]);
  if (cap === 'guan') kpoly(c, [[x - r * 0.95, y - r * 0.55], [x - r * 0.8, y - r * 1.6], [x + r * 0.5, y - r * 1.95], [x + r * 1.25, y - r * 1.15], [x + r * 0.9, y - r * 0.6]], iw * 0.8);
  else if (cap === 'ze') kpoly(c, [[x - r, y - r * 0.5], [x - r * 0.9, y - r * 1.35], [x + r * 0.9, y - r * 1.45], [x + r * 1.1, y - r * 0.55]], iw * 0.8);
}
/** robed figure in profile: standing or kneeling (o.kneel), inclined by o.bow, holding a tablet or (o.fan) a fan */
function robed(c, x, y, k, dir, o = {}) {
  at(c, x, y, k, dir, (iw) => {
    let px = 0, py = -64;
    if (o.kneel) {
      px = -4; py = -33;
      blob(c, [[-34, 0], [-39, -14], [-29, -31], [-6, -39], [14, -37], [30, -25], [37, -9], [35, 0]]);
      incise(c, [[-30, -10], [-4, -19], [26, -10]], iw, true);
    } else {
      poly(c, [[-44, 0], [-30, -9], [-24, -40], [-17, -68], [15, -68], [22, -40], [29, 0]]);
      incise(c, [[-9, -62], [-14, -3]], iw);
      incise(c, [[7, -62], [13, -3]], iw);
    }
    c.translate(px, py);
    c.rotate(o.bow ?? 0);
    if (o.fan) {
      line(c, [[36, -14], [47, -44]], 3);
      blob(c, [[40, -48], [45, -66], [60, -71], [67, -58], [58, -45]]);
    } else if (o.tablet !== false) poly(c, [[33, -17], [37.5, -20], [47, -50], [42.5, -51.5]]);
    blob(c, [[-18, 3], [-21, -28], [-16, -46], [-6, -54], [6, -54], [16, -44], [30, -35], [42, -22], [40, -4], [26, 5], [12, 3]]);
    incise(c, [[-4, -53], [4, -38], [11, -50]], iw);
    incise(c, [[-13, -36], [8, -20], [36, -9]], iw, true);
    headOf(c, 2, -66, 10.5, o.cap ?? 'guan', iw);
  });
}
/** a runner of the escort (伍伯) with his staff */
function runner(c, x, y, k, dir) {
  at(c, x, y, k, dir, (iw) => {
    line(c, [[27, -40], [45, -150]], 3.4);
    poly(c, [[45, -150], [56, -160], [49, -136]]);
    strip(c, [[-6, -46], [-24, -26], [-40, -10]], 11, 7);
    poly(c, [[-47, -13], [-36, -15], [-33, -6], [-46, -3]]);
    strip(c, [[6, -46], [26, -34], [28, -6]], 11, 7);
    poly(c, [[22, -7], [39, -7], [39, 0], [22, 0]]);
    strip(c, [[-8, -90], [-24, -76], [-30, -62]], 8, 6);
    kblob(c, [[-14, -40], [-18, -66], [-12, -92], [0, -100], [12, -94], [18, -70], [20, -44], [2, -36]], iw);
    incise(c, [[-16, -62], [18, -64]], iw);
    kstrip(c, [[8, -90], [24, -80], [35, -86]], 8, 6, iw);
    headOf(c, 4, -110, 9.5, 'ze', iw);
  });
}
/** rider, in the coordinates of the horse he sits on */
function rider(c, x, y, k) {
  at(c, x, y, k, 1, (iw) => {
    line(c, [[-2, -150], [-13, -236]], 3.6);
    poly(c, [[-13, -236], [-42, -229], [-15, -216]]);
    kblob(c, [[-26, -118], [-26, -150], [-18, -170], [-4, -174], [6, -162], [6, -136], [2, -118]], iw);
    kstrip(c, [[-10, -124], [2, -96], [-2, -76]], 12, 8, iw);
    poly(c, [[-8, -78], [12, -78], [12, -70], [-8, -70]]);
    kstrip(c, [[2, -160], [22, -148], [36, -146]], 8, 6, iw);
    headOf(c, -8, -186, 10, 'ze', iw);
  });
}
function archer(c, x, y, k, dir) {
  at(c, x, y, k, dir, (iw) => {
    strip(c, [[-7, -52], [-18, -28], [-24, -3]], 12, 8);
    poly(c, [[-33, -6], [-18, -6], [-16, 0], [-33, 0]]);
    strip(c, [[7, -52], [20, -30], [23, -3]], 12, 8);
    poly(c, [[17, -6], [35, -6], [35, 0], [17, 0]]);
    kblob(c, [[-17, -50], [-19, -82], [-13, -103], [1, -110], [13, -101], [18, -78], [19, -52], [25, -40], [-23, -40]], iw);
    incise(c, [[-18, -62], [19, -64]], iw);
    const a = -0.98, d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
    const g = [40, -128], h = [g[0] - d[0] * 34, g[1] - d[1] * 34];
    const tip = (s) => [g[0] + n[0] * 34 * s - d[0] * 14, g[1] + n[1] * 34 * s - d[1] * 14];
    const mid = (s) => [g[0] + n[0] * 18 * s - d[0] * 2, g[1] + n[1] * 18 * s - d[1] * 2];
    line(c, [tip(1), h, tip(-1)], 1.7);
    line(c, [h, [g[0] + d[0] * 24, g[1] + d[1] * 24]], 2.3);
    line(c, [tip(1), mid(1), g, mid(-1), tip(-1)], 4.2, true);
    kstrip(c, [[-8, -98], [4, -90], h], 9, 6, iw);
    kstrip(c, [[9, -98], [26, -113], g], 9, 6, iw);
    c.translate(2, -121);
    c.rotate(-0.5);
    headOf(c, 0, 0, 10, 'ze', iw);
  });
}

// ------------------------------------------------------------------------------------------- birds, spirits, clouds
function bird(c, x, y, k, dir, fly = false) {
  at(c, x, y, k, dir, (iw) => {
    if (fly) {
      poly(c, [[-9, 0], [-25, -5], [-24, 4]]);
      strip(c, [[0, -2], [-7, -15], [-18, -22]], 8, 2);
      blob(c, [[-11, 0], [-2, -5], [9, -4], [14, 0], [7, 4], [-4, 4]]);
      kstrip(c, [[3, -1], [9, -15], [3, -25]], 8, 2, iw * 0.7);
      disc(c, 14, -3, 4.4);
      poly(c, [[17.5, -5], [25, -3], [17.5, -1]]);
    } else {
      line(c, [[0, -3], [1, 0]], 1.8);
      poly(c, [[-9, -7], [-25, -2], [-23, 2], [-8, -3]]);
      blob(c, [[-12, -6], [-4, -13], [6, -13], [11, -8], [6, -2], [-4, -2]]);
      disc(c, 9.5, -13.5, 4.6);
      poly(c, [[13, -15.5], [20, -13], [13, -11]]);
      incise(c, [[-8, -8], [2, -6]], iw * 0.6);
    }
  });
}
function cloud(c, x, y, k, dir = 1) {
  at(c, x, y, k, dir, () => {
    strip(c, [[-34, 8], [-14, 4], [6, -4], [16, -17], [10, -28], [-1, -27], [-4, -19], [3, -14]], 7, 2.2);
    strip(c, [[-12, 4], [-26, -5], [-38, -2]], 4.5, 1.6);
    strip(c, [[4, -2], [22, 4], [36, 0]], 4.5, 1.6);
  });
}
function claws(c, x, y, a) {
  for (const da of [-0.5, 0, 0.5]) line(c, [[x, y], [x + Math.cos(a + da) * 8, y + Math.sin(a + da) * 8]], 2.4);
}
function dragon(c, x, y, k) {
  at(c, x, y, k, 1, (iw) => {
    strip(c, [[-46, -38], [-34, -18], [-42, -3]], 10, 5);
    claws(c, -42, -3, 0.5);
    strip(c, [[54, -50], [76, -42], [90, -28]], 10, 5);
    claws(c, 90, -28, 0.3);
    const sp = K.catmull([[-116, -66], [-104, -86], [-84, -84], [-72, -62], [-56, -46], [-30, -40], [-6, -48], [18, -62], [40, -62], [58, -52], [72, -56], [82, -72], [90, -84]], 6);
    poly(c, K.ribbonPoly(sp, prof([[0, 2], [0.12, 6], [0.3, 15], [0.46, 22], [0.6, 15], [0.76, 23], [0.9, 15], [1, 14]])));
    incise(c, sp.slice(12, sp.length - 10), iw);
    for (let i = 16; i < sp.length - 12; i += 5) incise(c, [[sp[i][0] - 3, sp[i][1] - 5], [sp[i][0] + 3, sp[i][1] + 5]], iw * 0.8);
    kstrip(c, [[34, -70], [18, -92], [-4, -98]], 9, 2, iw);
    kstrip(c, [[42, -70], [36, -96], [22, -108]], 8, 2, iw);
    kstrip(c, [[-40, -40], [-54, -18], [-42, -2]], 12, 6, iw);
    claws(c, -42, -2, 0.2);
    kstrip(c, [[44, -52], [38, -26], [50, -2]], 12, 6, iw);
    claws(c, 50, -2, 0.2);
    strip(c, [[92, -96], [80, -108], [64, -108]], 5, 1.6);
    strip(c, [[88, -92], [76, -96], [70, -90]], 4, 1.5);
    kblob(c, [[82, -88], [96, -98], [114, -95], [134, -86], [133, -80], [116, -80], [104, -74], [116, -68], [130, -62], [128, -56], [108, -59], [92, -64], [82, -74]], iw);
    pit(c, 104, -88, 2.4);
    strip(c, [[100, -62], [98, -48], [106, -42]], 4, 1.4);
  });
}
function phoenix(c, x, y, k, dir) {
  at(c, x, y, k, dir, (iw) => {
    for (const p of [[[-22, -46], [-48, -64], [-66, -90], [-58, -108]], [[-22, -44], [-56, -48], [-84, -62], [-92, -84]], [[-22, -40], [-54, -32], [-84, -34], [-100, -50]]]) {
      strip(c, p, 7, 3);
      const q = p[p.length - 1];
      disc(c, q[0], q[1], 6);
      pit(c, q[0], q[1], 2.2);
    }
    line(c, [[-4, -34], [-9, -15], [-3, 0], [6, 0]], 3.4);
    line(c, [[8, -34], [15, -17], [11, 0], [20, 0]], 3.4);
    blob(c, [[-26, -46], [-12, -60], [10, -62], [24, -52], [22, -38], [6, -29], [-14, -31]]);
    kblob(c, [[-6, -54], [-20, -76], [-14, -98], [2, -82], [12, -58]], iw);
    incise(c, [[-12, -88], [-2, -62]], iw * 0.8);
    incise(c, [[-6, -84], [3, -62]], iw * 0.8);
    strip(c, [[18, -52], [28, -70], [26, -86], [32, -98]], 11, 6);
    disc(c, 34, -100, 7.5);
    poly(c, [[39, -104], [54, -99], [39, -95]]);
    pit(c, 35, -101, 1.8);
    strip(c, [[32, -106], [30, -118], [38, -125]], 3.4, 1.4);
    strip(c, [[28, -105], [20, -115], [22, -124]], 3.4, 1.4);
  });
}
/** the hare that pounds the elixir */
function hare(c, x, y, k, dir) {
  at(c, x, y, k, dir, (iw) => {
    disc(c, -13, -9, 4.5);
    blob(c, [[-11, 0], [-15, -20], [-9, -41], [2, -47], [11, -39], [11, -14], [13, 0]]);
    strip(c, [[1, -58], [-4, -79]], 5, 2.2);
    strip(c, [[6, -59], [8, -81]], 5, 2.2);
    oval(c, 4, -53, 8.5, 7.5);
    pit(c, 7, -54, 1.6);
    kstrip(c, [[4, -38], [14, -42], [21, -46]], 7, 4.5, iw);
    line(c, [[21, -70], [23, -18]], 3.4);
    poly(c, [[12, 0], [9, -17], [35, -17], [32, 0]]);
  });
}

// ------------------------------------------------------------------------------------------- architecture, tree
function pavilion(c) {
  const gy = UP_Y, cols = [236, 560];
  c.fillStyle = WH;
  c.fillRect(206, gy - 15, 386, 11); // platform
  for (const x of cols) {
    c.fillStyle = WH;
    c.fillRect(x - 6, 306, 12, gy - 23 - 306);
    poly(c, [[x - 12, gy - 15], [x + 12, gy - 15], [x + 8, gy - 24], [x - 8, gy - 24]]);
    poly(c, [[x - 9, 307], [x + 9, 307], [x + 13, 298], [x - 13, 298]]);
    poly(c, [[x - 31, 298], [x - 31, 286], [x - 22, 286], [x - 22, 291], [x + 22, 291], [x + 22, 286], [x + 31, 286], [x + 31, 298]]);
    incise(c, [[x - 13, 298], [x + 13, 298]], INC * 0.8);
  }
  const eY = 277, rY = 240;
  c.fillStyle = WH;
  c.fillRect(214, eY, 368, 9); // architrave
  poly(c, [[196, eY - 3], [600, eY - 3], [594, eY - 11], [536, rY], [260, rY], [202, eY - 11]]);
  strip(c, [[203, eY - 7], [190, eY - 12], [183, eY - 23]], 7, 2);
  strip(c, [[593, eY - 7], [606, eY - 12], [613, eY - 23]], 7, 2);
  strip(c, [[264, rY + 2], [251, rY - 6], [246, rY - 19]], 7, 2);
  strip(c, [[532, rY + 2], [545, rY - 6], [550, rY - 19]], 7, 2);
  incise(c, [[262, rY + 7], [534, rY + 7]], INC);
  incise(c, [[200, eY - 3], [596, eY - 3]], INC);
  const n = 26;
  for (let i = 1; i < n; i++) incise(c, [[262 + (272 * i) / n, rY + 8], [205 + (390 * i) / n, eY - 5]], INC * 0.8);
  // looped hangings under the beam
  c.strokeStyle = WH; c.lineWidth = 2.2; c.lineCap = 'round';
  for (let x = 262; x < 530; x += 34) {
    c.beginPath(); c.arc(x + 17, eY + 8, 17, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke();
    line(c, [[x, eY + 9], [x, eY + 22]], 2);
    disc(c, x, eY + 24, 2.6);
  }
  line(c, [[534, eY + 9], [534, eY + 22]], 2);
  disc(c, 534, eY + 24, 2.6);
  // the feast: an attendant with a fan, the host, a table with ear-cups, a wine jar, two guests
  robed(c, 268, gy - 15, 0.7, 1, { fan: true, cap: 'ze' });
  robed(c, 318, gy - 15, 0.96, 1, { kneel: true, tablet: false });
  c.fillStyle = WH;
  c.fillRect(366, gy - 34, 56, 4.5);
  line(c, [[371, gy - 30], [369, gy - 15]], 2.6);
  line(c, [[417, gy - 30], [419, gy - 15]], 2.6);
  for (const x of [380, 396, 410]) { c.beginPath(); c.ellipse(x, gy - 35, 5.6, 4, 0, Math.PI, TAU); c.fillStyle = WH; c.fill(); }
  poly(c, [[430, gy - 15], [427, gy - 36], [447, gy - 36], [444, gy - 15]]);
  incise(c, [[428, gy - 28], [446, gy - 28]], INC * 0.8);
  line(c, [[437, gy - 36], [441, gy - 52]], 2.2);
  robed(c, 482, gy - 15, 0.8, -1, { kneel: true, bow: 0.5 });
  robed(c, 530, gy - 15, 0.74, -1, { kneel: true, bow: 0.14 });
  // birds on the roof
  bird(c, 300, rY - 1, 1.25, 1);
  bird(c, 486, rY - 1, 1.25, -1);
  bird(c, 398, rY - 18, 1.3, 1, true);
}
function que(c, x) {
  at(c, x, UP_Y, 1, 1, (iw) => {
    poly(c, [[-23, -4], [23, -4], [18, -16], [-18, -16]]);
    c.fillStyle = WH;
    c.fillRect(-13, -128, 26, 112);
    poly(c, [[-41, -128], [41, -128], [30, -143], [-30, -143]]);
    strip(c, [[-38, -131], [-46, -136], [-49, -146]], 5, 1.6);
    strip(c, [[38, -131], [46, -136], [49, -146]], 5, 1.6);
    c.fillStyle = WH;
    c.fillRect(-9, -183, 18, 40);
    poly(c, [[-35, -183], [35, -183], [24, -199], [-24, -199]]);
    strip(c, [[-32, -186], [-40, -191], [-43, -201]], 5, 1.6);
    strip(c, [[32, -186], [40, -191], [43, -201]], 5, 1.6);
    for (const y of [-40, -64, -88, -112]) incise(c, [[-13, y], [13, y]], iw * 0.8);
    for (let i = -3; i <= 3; i++) {
      incise(c, [[i * 7, -142], [i * 10, -129]], iw * 0.7);
      incise(c, [[i * 5.5, -198], [i * 8.5, -184]], iw * 0.7);
    }
    incise(c, [[-9, -163], [9, -163]], iw * 0.8);
  });
  bird(c, x + 2, UP_Y - 199, 1.2, 1);
}
function leaf(c, x, y, a, s) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(s, s);
  kblob(c, [[0, 0], [7, -6.5], [16, -6], [24, 0], [16, 6], [7, 6.5]], INC / s);
  incise(c, [[4, 0], [19, 0]], (INC * 0.7) / s);
  c.restore();
}
function tree(c, x, y) {
  const B = [
    [[0, -96], [-30, -116], [-70, -124], [-100, -146], [-110, -176]],
    [[0, -96], [-16, -136], [-50, -160], [-70, -196], [-58, -220]],
    [[0, -94], [6, -146], [-10, -184], [0, -220]],
    [[0, -96], [26, -128], [50, -166], [42, -206]],
    [[0, -96], [38, -112], [80, -128], [105, -160], [98, -194]],
    [[0, -90], [46, -96], [94, -100], [130, -124]],
    [[0, -90], [-40, -94], [-84, -96], [-114, -112]],
    [[-66, -150], [-20, -168], [30, -162], [78, -150]], // a bough woven across the others
  ];
  c.save();
  c.translate(x, y);
  B.forEach((b, bi) => (bi === 7 ? kstrip(c, b, 6, 4, INC) : strip(c, b, 10, 3.5)));
  B.forEach((b, bi) => {
    const P = K.catmull(b, 8), Ls = K.arcLen(P), total = Ls[Ls.length - 1];
    let side = bi % 2 ? 1 : -1;
    for (let d = bi === 7 ? 14 : 46; d < total - 6; d += 25) {
      const p = K.pointAt(P, d / total, Ls), q = K.pointAt(P, Math.min(1, (d + 4) / total), Ls);
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + side * 1.0;
      leaf(c, p[0], p[1], a, 0.92);
      side = -side;
    }
    if (bi !== 7) {
      const e = P[P.length - 1], f = P[P.length - 4];
      leaf(c, e[0], e[1], Math.atan2(e[1] - f[1], e[0] - f[0]), 1.05);
    }
  });
  poly(c, [[-27, 0], [-13, -18], [13, -18], [28, 0]]);
  kstrip(c, [[0, -4], [-3, -36], [4, -68], [0, -100]], 30, 16, INC);
  incise(c, [[-5, -14], [-7, -40], [-1, -70]], INC, true);
  incise(c, [[7, -10], [5, -44], [8, -76]], INC, true);
  c.restore();
}

// ------------------------------------------------------------------------------------------- carriages
/** canopied two-wheeled carriage (軺車), unit-local: wheel centre (0, −56), heading +x; the horse stands at x = HX */
function carriage(c, x, y, k) {
  at(c, x, y, k, 1, (iw) => {
    const R = 56;
    strip(c, [[54, -80], [110, -86], [156, -104], [192, -126]], 6.5, 4.5); // shaft
    // official behind, driver in front
    blob(c, [[-50, -98], [-50, -128], [-44, -150], [-34, -160], [-20, -160], [-10, -150], [2, -132], [8, -114], [6, -98]]);
    incise(c, [[-42, -140], [-22, -124], [3, -117]], iw, true);
    incise(c, [[-31, -159], [-24, -146], [-17, -158]], iw);
    headOf(c, -26, -171, 10.5, 'guan', iw);
    kblob(c, [[10, -98], [10, -126], [15, -147], [23, -155], [36, -155], [43, -143], [45, -98]], iw);
    headOf(c, 29, -165, 9.5, 'ze', iw);
    // canopy on its pole
    keyed(c, iw * 0.8, () => { c.beginPath(); c.rect(0, -214, 4.5, 114); });
    const top = [], bot = [];
    for (let xx = -88; xx <= 92.01; xx += 10) {
      const d = xx - 2;
      top.push([xx, -227 + d * d * 0.003]);
      bot.push([xx, -212 + d * d * 0.00115]);
    }
    poly(c, top.concat(bot.reverse()));
    for (const xx of [-58, -28, 32, 62]) incise(c, [[2 + (xx - 2) * 0.2, -225], [xx, -210 + (xx - 2) * (xx - 2) * 0.0011]], iw * 0.8);
    strip(c, [[-86, -202], [-94, -193], [-89, -184]], 4.5, 1.8);
    strip(c, [[90, -202], [98, -193], [93, -184]], 4.5, 1.8);
    // box
    kpoly(c, [[-52, -100], [48, -100], [57, -122], [62, -121], [60, -72], [-48, -72]], iw);
    incise(c, [[-50, -90], [59, -90]], iw);
    for (const xx of [-34, -16, 2, 20, 38]) incise(c, [[xx, -89], [xx + 1, -73]], iw);
    // the near wheel, in front of the box
    pit(c, 0, -R, R + iw);
    c.beginPath(); c.arc(0, -R, R - 4, 0, TAU);
    c.strokeStyle = WH; c.lineWidth = 8; c.stroke();
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.11;
      c.moveTo(Math.cos(a) * 9, -R + Math.sin(a) * 9);
      c.lineTo(Math.cos(a) * (R - 7), -R + Math.sin(a) * (R - 7));
    }
    c.lineWidth = 2.9; c.lineCap = 'butt'; c.stroke();
    disc(c, 0, -R, 10);
    pit(c, 0, -R, 3.4);
  });
}
/** the driver's forearm, whip and reins. moat = true draws only the ground they need cleared around them */
function arms(c, x, y, k, pose, moat) {
  at(c, x, y, k, 1, (iw) => {
    const up = pose === 'up';
    const sleeve = stripPoly(up ? [[35, -147], [52, -144], [67, -141]] : [[35, -147], [47, -129], [56, -113]], 14, 8.5);
    const hand = up ? [69, -141] : [57, -111];
    const reins = up
      ? [[[69, -142], [134, -139], [198, -131]], [[69, -139], [134, -135], [197, -126]]]
      : [[[57, -112], [100, -96], [150, -107], [197, -130]], [[57, -109], [100, -91], [150, -102], [196, -125]]];
    const whip = up ? [[67, -143], [93, -186]] : [[57, -113], [87, -108]];
    const lash = up ? [[93, -186], [108, -181], [117, -164]] : [[87, -108], [101, -100], [107, -85]];
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (moat) {
      c.strokeStyle = '#000'; c.fillStyle = '#000';
      K.path(c, sleeve, true); c.lineWidth = iw * 2; c.stroke(); c.fill();
      for (const r of reins) { K.spline(c, r); c.lineWidth = 2.4 + iw * 2; c.stroke(); }
      K.path(c, whip); c.lineWidth = 2.8 + iw * 2; c.stroke();
    } else {
      poly(c, sleeve);
      disc(c, hand[0], hand[1], 5);
      for (const r of reins) line(c, r, 2.4, true);
      line(c, whip, 2.8);
      line(c, lash, 1.9, true);
    }
  });
}
/** label cartouche (榜題) naming a vehicle, as on the Wu shrine stones */
function tag(c, x, y, str) {
  const chars = [...str];
  c.strokeStyle = WH; c.lineWidth = 2; c.lineJoin = 'miter';
  c.strokeRect(x - 15, y, 30, chars.length * 21 + 9);
  chars.forEach((ch, i) => K.text(c, ch, x, y + 15.5 + i * 21, { size: 18.5, font: K.FONT.cjkSerif, weight: 900, align: 'center', baseline: 'middle', color: WH }));
}

// ------------------------------------------------------------------------------------------- the whole stone
function drawStatic(c) {
  // borders
  lozengeBand(c, 0, 1000, 50, 74);
  sawBand(c, 114, 1000, 176, 198);
  scrollBand(c, 0, 1000, UP_Y, 474);
  curtainBand(c, 0, 1000, 806, 832);
  lozengeBand(c, 0, 1000, LOW_Y, 960);

  // --- top band: spirits among clouds
  cloud(c, 488, 142, 0.72);
  dragon(c, 596, 173, 0.8);
  cloud(c, 716, 112, 0.6, -1);
  phoenix(c, 772, 174, 0.72, -1);
  hare(c, 866, 174, 0.92, 1);
  cloud(c, 852, 92, 0.5);
  c.beginPath(); c.arc(948, 124, 29, 0, TAU); c.strokeStyle = WH; c.lineWidth = 3.2; c.stroke(); // the sun and its crow
  bird(c, 946, 136, 1.35, 1);
  line(c, [[944, 132], [941, 137]], 1.8);
  line(c, [[949, 132], [952, 137]], 1.8);
  cloud(c, 990, 166, 0.5);

  // --- upper register: gate tower, pavilion feast, an arriving guest, the tree with its birds, archer and tethered horse
  que(c, 156);
  pavilion(c);
  robed(c, 636, UP_Y, 0.74, -1, { bow: 0.2 });
  tree(c, 806, UP_Y);
  archer(c, 702, UP_Y, 0.74, 1);
  wholeHorse(c, 924, UP_Y, 0.5, -1, { pose: 1, saddle: true });
  line(c, [[873, UP_Y - 76], [846, UP_Y - 70], [814, UP_Y - 62]], 1.8, true);
  bird(c, 806 - 110, UP_Y - 177, 1.15, -1);
  bird(c, 806 + 1, UP_Y - 221, 1.15, 1);
  bird(c, 806 + 99, UP_Y - 195, 1.15, -1);
  bird(c, 806 + 131, UP_Y - 125, 1.1, 1);
  bird(c, 652, 226, 1.2, 1, true);
  bird(c, 962, 232, 1.2, -1, true);
  bird(c, 968, 300, 1.1, -1, true);
  cloud(c, 630, 300, 0.55);

  // --- the road register: two carriages with a gap between them (legs, heads and the rear driver's arm are sprites)
  for (const ux of [REAR, FRONT]) {
    carriage(c, ux, RY, UK);
    horse(c, ux + HX * UK, RY, UK, 1, 'body', { harness: true });
  }
  cutOn(c);
  arms(c, FRONT, RY, UK, 'up', true);
  cutOff(c);
  arms(c, FRONT, RY, UK, 'up', false);
  tag(c, 186, 486, '功曹車');
  tag(c, 400, 486, '鵜鶘車');
  tag(c, 866, 486, '主簿車');
  bird(c, 258, 548, 1.2, 1, true);
  bird(c, 300, 516, 1.1, 1, true);
  bird(c, 936, 540, 1.2, 1, true);
  bird(c, 978, 512, 1.1, 1, true);
  cloud(c, 596, 506, 0.5);
  rule(c, RY, 5.4); // the road

  // --- roadside register: runners and outriders of the escort; officials who have come out to greet the procession
  runner(c, 44, LOW_Y, 0.64, 1);
  runner(c, 116, LOW_Y, 0.64, 1);
  for (const ex of ESCORT) {
    horse(c, ex, LOW_Y, EK, 1, 'body', { saddle: true });
    horse(c, ex, LOW_Y, EK, 1, 'head', {});
    rider(c, ex, LOW_Y, EK);
  }
}
function drawTitle(c) {
  const t = TITLES[3];
  c.strokeStyle = WH; c.lineJoin = 'miter';
  c.lineWidth = 2.8; c.strokeRect(22, 82, 86, 358);
  c.lineWidth = 1.3; c.strokeRect(27.5, 87.5, 75, 347);
  [...t.zh].forEach((ch, i) => {
    c.save();
    c.translate(65, 120 + i * 56.6);
    c.scale(1.1, 0.9); // the broad, low proportions of clerical script
    K.text(c, ch, 0, 0, { size: 52, font: K.FONT.cjkSerif, weight: 900, align: 'center', baseline: 'middle', color: WH });
    c.restore();
  });
  c.lineWidth = 2.8; c.strokeRect(120, 84, 336, 84);
  c.lineWidth = 1.3; c.strokeRect(125.5, 89.5, 325, 73);
  K.text(c, t.en, 138, 122, { size: 27, font: K.FONT.serif, weight: 700, color: WH, maxWidth: 302 });
  K.text(c, t.date, 138, 153, { size: 23, font: K.FONT.serif, weight: 700, color: WH });
}

// ------------------------------------------------------------------------------------------- ink, paper, stone
function stoneMask() {
  return K.layer(1000, 1000, RES, (c) => {
    c.fillStyle = '#000';
    c.fillRect(-5, Y0 + 6, 1010, Y1 - Y0 - 12);
    const r = K.rng(77);
    for (const [y, dir] of [[Y0, 1], [Y1, -1]]) {
      for (let x = -10; x < 1010; x += r.range(2.5, 6)) {
        const rad = r.range(5, 11), cy = y + dir * (rad + r.range(-2, 3));
        const g = c.createRadialGradient(x, cy, rad * 0.5, x, cy, rad);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(x - rad, cy - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 26; i++) { // where the dabber strayed into the margin
        const x = r() * 1000, rad = r.range(5, 12), cy = y - dir * r.range(2, 12);
        const g = c.createRadialGradient(x, cy, 0, x, cy, rad);
        g.addColorStop(0, `rgba(0,0,0,${r.range(0.08, 0.3)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(x - rad, cy - rad, rad * 2, rad * 2);
      }
    }
  });
}
function damage(c) {
  const r = K.rng(59);
  cutOn(c);
  c.fillStyle = '#000';
  // an old crack through the upper registers
  const crack = K.jitter(K.catmull([[641, 40], [629, 92], [634, 132], [613, 178], [605, 236], [580, 282], [585, 330], [558, 386], [549, 450]], 6), 3, 0.16, 7);
  K.ribbon(c, crack, (u, i) => 1 + 4.6 * Math.pow(K.noise1(i * 0.37, 3), 2), '#000');
  const chip = (x, y, rx, ry, a, seed) => {
    c.globalAlpha = a;
    K.fillPoly(c, K.jitter(K.ellipsePts(x, y, rx, ry, 18, r() * 3), Math.min(rx, ry) * 0.3, 0.22, seed), '#000', true);
    c.globalAlpha = 1;
  };
  chip(631, 110, 9, 15, 0.85, 1);
  chip(608, 214, 12, 8, 0.8, 2);
  chip(582, 306, 7, 13, 0.85, 3);
  chip(990, 944, 34, 26, 0.86, 4);
  chip(1002, 296, 15, 44, 0.8, 5);
  chip(-2, 898, 13, 30, 0.8, 6);
  chip(962, 62, 22, 9, 0.75, 8);
  for (let i = 0; i < 70; i++) { // pits
    const x = r() * 1000, y = r.range(Y0, Y1);
    if (y > 470 && y < 806 && x > 300 && x < 680) continue;
    c.globalAlpha = r.range(0.4, 0.85);
    c.beginPath();
    c.ellipse(x, y, r.range(0.8, 3.4), r.range(0.8, 2.6), r() * 3, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
  cutOff(c);
}
function buildInk() {
  const ink = I.rubbingize(K.layer(1000, 1000, 0.02), { w: 1000, h: 1000, res: RES, seed: 303, paper: '#ffffff', ink: INK, starve: 0.42 });
  const c = ink.getContext('2d');
  const r = K.rng(41);
  // the dabber: thousands of overlapping pad marks, some starved, some loaded
  for (let i = 0; i < 2800; i++) {
    const x = r() * 1000, y = r() * 1000, rad = r.range(8, 22), light = r() < 0.42;
    const col = light ? '255,255,255' : '20,17,13', a = light ? r.range(0.02, 0.07) : r.range(0.1, 0.32);
    const g = c.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // the ghost of the stone's chisel striations
  K.fibers(c, 1000, 1000, { n: 4200, seed: 43, color: '#ffffff', alpha: 0.145, len: [16, 80], width: 0.9, curl: 0.03, angle: Math.PI / 2, spread: 0.06 });
  // places where the pad was running dry
  c.drawImage(K.noiseLayer({ scale: 230, oct: 3, seed: 47, color: '#ffffff', lo: 0.56, hi: 0.9, alpha: 0.17, res: 0.25 }), 0, 0, 1000, 1000);
  K.grain(c, 0, 0, 1000, 1000, { color: '#ffffff', alpha: 0.38, seed: 44, size: 1.3, density: 0.05 });
  // old folds of the sheet: the ink is rubbed thin along them
  c.strokeStyle = '#ffffff'; c.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [[334, 0, 337, 1000], [668, 0, 665, 1000], [0, 505, 1000, 502]]) {
    for (let u = 0; u < 1; u += 0.008) {
      if (r() < 0.3) continue;
      c.globalAlpha = r.range(0.08, 0.3);
      c.lineWidth = r.range(0.6, 1.4);
      c.beginPath();
      c.moveTo(K.lerp(x0, x1, u) + r.range(-0.6, 0.6), K.lerp(y0, y1, u) + r.range(-0.6, 0.6));
      c.lineTo(K.lerp(x0, x1, u + 0.008), K.lerp(y0, y1, u + 0.008));
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  damage(c);
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(stoneMask(), 0, 0, 1000, 1000);
  c.globalCompositeOperation = 'source-over';
  return ink;
}
/** where ink creeps into the figures: anchored to the stone, shared by everything carved in it */
function buildSpeck() {
  return K.layer(1000, 1000, 1, (c) => {
    c.drawImage(K.noiseLayer({ scale: 9, oct: 2, seed: 321, color: '#000000', lo: 0.6, hi: 0.9, alpha: 0.5, res: 0.5 }), 0, 0, 1000, 1000);
    c.drawImage(K.noiseLayer({ scale: 70, oct: 3, seed: 322, color: '#000000', lo: 0.62, hi: 0.95, alpha: 0.2, res: 0.25 }), 0, 0, 1000, 1000);
    K.grain(c, 0, 0, 1000, 1000, { color: '#000000', alpha: 0.5, seed: 323, size: 1.3, density: 0.2 });
  });
}
/** white mask → bare paper with ink creeping in. (x0, y0) = where the mask sits in the picture */
function paperize(mask, x0 = 0, y0 = 0, speck = 1) {
  const w = mask.uw, h = mask.uh;
  return K.layer(w, h, mask.res, (c) => {
    c.drawImage(mask, 0, 0, w, h);
    c.globalCompositeOperation = 'destination-out';
    c.globalAlpha = speck;
    c.drawImage(L.speck, -x0, -y0, 1000, 1000);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-in';
    c.drawImage(L.paper, -x0, -y0, 1000, 1000);
    c.globalCompositeOperation = 'source-over';
  });
}
/** a re-carvable piece of the stone: fig(c) draws the mask, moat(c) the ground it needs cleared behind it */
function sprite(x0, y0, w, h, fig, moat = null) {
  x0 = Math.floor(x0); y0 = Math.floor(y0); w = Math.ceil(w) + 1; h = Math.ceil(h) + 1;
  const mk = (fn) => K.layer(w, h, RES, (c) => { c.translate(-x0, -y0); fn(c); });
  let img = paperize(mk(fig), x0, y0);
  if (moat) {
    const kn = mk(moat), figure = img;
    img = K.layer(w, h, RES, (c) => {
      c.drawImage(kn, 0, 0, w, h);
      c.globalCompositeOperation = 'source-in';
      c.drawImage(L.ground, -x0, -y0, 1000, 1000);
      c.globalCompositeOperation = 'source-over';
      c.drawImage(figure, 0, 0, w, h);
    });
  }
  return { img, x: x0, y: y0, w, h };
}

// ------------------------------------------------------------------------------------------- the pelican, carved
const trace = (b, pts, closed) => {
  b.beginPath();
  b.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) b.lineTo(pts[i][0], pts[i][1]);
  if (closed) b.closePath();
};
function carvePelican(b, pose) {
  const s = pose.s, iw = INC * s;
  b.save();
  b.lineJoin = 'round'; b.lineCap = 'round'; b.fillStyle = WH; b.strokeStyle = WH;
  const cut = (w) => { b.globalCompositeOperation = 'destination-out'; b.lineWidth = w; b.stroke(); b.globalCompositeOperation = 'source-over'; };
  for (const p of Rig.parts(pose)) {
    if (p.kind === 'poly') {
      trace(b, p.pts, true);
      cut(iw * 2);
      b.fill();
      if (p.role === 'tail') { // quill
        const n = p.pts.length, a = p.pts[0], e = p.pts[Math.round((n * 2) / 3)], tip = p.pts[Math.round(n / 3)];
        trace(b, [[(a[0] + e[0]) / 2, (a[1] + e[1]) / 2], tip]);
        cut(iw * 0.8);
      } else if (p.role === 'pouch') { // a fold of the pouch
        let cx = 0, cy = 0;
        for (const q of p.pts) { cx += q[0]; cy += q[1]; }
        cx /= p.pts.length; cy /= p.pts.length;
        const n = p.pts.length, inner = [];
        for (let i = Math.round(n * 0.42); i <= Math.round(n * 0.8); i++) inner.push([cx + (p.pts[i][0] - cx) * 0.6, cy + (p.pts[i][1] - cy) * 0.55]);
        trace(b, inner);
        cut(iw * 0.8);
      }
    } else if (p.kind === 'line') {
      trace(b, p.pts);
      if (p.role === 'mark') {
        cut(iw);
        if (p.name.startsWith('wingMark')) { // barbs: carved feathers
          const n = p.pts.length;
          b.beginPath();
          for (let j = 2; j < n - 1; j += 3) {
            const q = p.pts[j], t0 = p.pts[j - 1], t1 = p.pts[j + 1];
            const a = Math.atan2(t1[1] - t0[1], t1[0] - t0[0]) - 0.95;
            b.moveTo(q[0], q[1]);
            b.lineTo(q[0] + Math.cos(a) * 8.5 * s, q[1] + Math.sin(a) * 8.5 * s);
          }
          cut(iw * 0.8);
        }
      } else {
        const w = Math.max(p.w * (p.role === 'scarf' ? 0.8 : 1), 2.7 * s);
        cut(w + iw * 2);
        b.lineWidth = w;
        b.stroke();
      }
    } else if (p.kind === 'wheel') {
      const rw = p.r * 0.15;
      b.beginPath(); b.arc(p.c[0], p.c[1], p.r * 0.925, 0, TAU);
      cut(rw + iw * 2);
      b.lineWidth = rw; b.stroke();
      b.beginPath();
      for (const [a, e] of Rig.spokes(p, 12, 0.1, 0.88)) { b.moveTo(a[0], a[1]); b.lineTo(e[0], e[1]); }
      b.lineWidth = 2.4 * s; b.stroke();
      b.beginPath(); b.arc(p.c[0], p.c[1], p.r * 0.15, 0, TAU); b.fill();
    } else if (p.kind === 'disc') {
      b.beginPath(); b.arc(p.c[0], p.c[1], p.r, 0, TAU);
      cut(iw * 2);
      b.fill();
      if (p.name === 'chainring') { b.beginPath(); b.arc(p.c[0], p.c[1], p.r * 0.52, 0, TAU); cut(iw); }
    } else if (p.kind === 'eye') {
      if (p.lid < 0.5) { // ring-and-dot eye, as the stones carve them
        b.beginPath(); b.arc(p.c[0], p.c[1], p.r * 1.3, 0, TAU);
        b.globalCompositeOperation = 'destination-out'; b.fill(); b.globalCompositeOperation = 'source-over';
        b.beginPath(); b.arc(p.pupil[0], p.pupil[1], p.pr * 1.05, 0, TAU); b.fill();
      } else {
        trace(b, [[p.c[0] - p.r, p.c[1]], [p.c[0] + p.r, p.c[1]]]);
        cut(iw);
      }
    }
  }
  b.restore();
}
/** everything the pelican stands in front of is cut back to bare stone: wheels, frame and a moat round the figure */
function pelicanMoat(g, pose) {
  const s = pose.s, P = pose.pt;
  Rig.drawSilhouette(g, pose, '#000000', { grow: 3.2 * s });
  g.fillStyle = '#000000';
  for (const w of pose.wheels) { g.beginPath(); g.arc(w.c[0], w.c[1], w.r + 1.5 * s, 0, TAU); g.fill(); }
  trace(g, [P.hubR, P.saddle, P.hip, P.shoulder, P.grip, P.hubF, P.bb], true);
  g.fill();
}
const BUF = { w: 484, h: 372, ox: 248, oy: 352, res: 1.25 };

// ------------------------------------------------------------------------------------------- the scene
const stepping = (t) => t >= 0 && t < 6;
export default {
  id: 3, key: 'han', title: TITLES[3], heroT: 3.25,
  // catches the procession up, brakes into the gap, idles there in line through bar 2, then pulls out
  profile: [[0, 0], [1.6, 0.42], [2.0, 0.478], [3.6, 0.507], [6, 1]],
  act(t, p) {
    const g = K.gate(t, 1.8, 3.9, 0.3);
    p.neck = 0.5 * g; // sits up like an official
    p.bob = 1 - 0.55 * g;
    p.headTilt = -0.3 * K.bump(t, 3.55, 0.17); // a gracious nod for the attendant
    p.eye = [0.2 * g, 0.7 * K.bump(t, 3.55, 0.22)];
    p.wind = K.lerp(p.wind, Math.max(p.wind, 0.92), K.gate(t, 0.4, 5.6, 0.3)); // carved ribbons always fly
  },

  // a slow lean-in on the road while it rides in line (the whole stone stays in view; only the top margin is lost)
  camera(t) {
    const k = K.ease.io3(K.prog(t, 1.7, 0.9)) * (1 - K.ease.io3(K.prog(t, 3.7, 0.9)));
    return k > 0 ? { zoom: 1 + 0.11 * k, dy: 16 * k } : null;
  },

  async init() {
    const paper = I.xuan({ res: RES, seed: 31, base: '#ebe3ce', age: 0.5 });
    const speck = buildSpeck();
    const ink = buildInk();
    const ground = K.layer(1000, 1000, RES, (c) => {
      K.put(c, paper);
      K.putBlend(c, ink, 'multiply', 0.97);
    });
    L = { paper, speck, ground };
    const base = K.layer(1000, 1000, RES, (c) => {
      K.put(c, ground);
      K.put(c, paperize(K.layer(1000, 1000, RES, drawStatic)));
      K.put(c, paperize(K.layer(1000, 1000, RES, drawTitle), 0, 0, 0.5));
      // the margins: collectors' seals and a note of what the sheet is
      K.putBlend(c, K.seal('金石永年', { size: 36, seed: 5 }), 'multiply', 0.9, 950, 2);
      K.putBlend(c, K.seal('手拓', { size: 27, relief: 'zhu', seed: 6 }), 'multiply', 0.88, 925, 7);
      K.text(c, '車馬出行畫像　舊拓本', 912, 32, { size: 19, font: K.FONT.cjkSerif, weight: 500, align: 'right', color: '#2b2722', alpha: 0.82 });
      K.putBlend(c, K.seal('長樂未央', { size: 28, relief: 'zhu', seed: 7 }), 'multiply', 0.85, 12, 965);
    });
    // --- re-carvable pieces
    const S = { legs: [], heads: {}, arms: {}, kneel: {} };
    const horses = [
      { x: REAR + HX * UK, y: RY, k: UK }, { x: FRONT + HX * UK, y: RY, k: UK },
      ...ESCORT.map((x) => ({ x, y: LOW_Y, k: EK })),
    ];
    for (const h of horses) {
      S.legs.push([0, 1].map((pose) => sprite(h.x - 98 * h.k, h.y - 92 * h.k, 202 * h.k, 94 * h.k, (c) => horse(c, h.x, h.y, h.k, 1, 'legs', { pose }))));
    }
    const head = (h, kind) => sprite(h.x - 24 * h.k, h.y - 234 * h.k, 136 * h.k, 146 * h.k, (c) => horse(c, h.x, h.y, h.k, 1, 'head', { kind, harness: true }));
    S.heads.rear = { fwd: head(horses[0], 'fwd'), high: head(horses[0], 'high') };
    S.heads.front = { fwd: head(horses[1], 'fwd'), back: head(horses[1], 'back') };
    for (const pose of ['up', 'down']) {
      S.arms[pose] = sprite(REAR + 28 * UK, RY - 194 * UK, 178 * UK, 112 * UK, (c) => arms(c, REAR, RY, UK, pose, false), (c) => arms(c, REAR, RY, UK, pose, true));
    }
    S.kneel.up = sprite(KNEEL.x - 110 * KNEEL.k, LOW_Y - 128 * KNEEL.k, 154 * KNEEL.k, 130 * KNEEL.k, (c) => robed(c, KNEEL.x, LOW_Y, KNEEL.k, -1, { kneel: true }));
    S.kneel.bow = sprite(KNEEL.x - 110 * KNEEL.k, LOW_Y - 128 * KNEEL.k, 154 * KNEEL.k, 130 * KNEEL.k, (c) => robed(c, KNEEL.x, LOW_Y, KNEEL.k, -1, { kneel: true, bow: 1.2 }));
    S.greet = GREET.map((x, i) => [0.2 + 0.05 * (i % 2), 0.78].map((bow) => sprite(x - 80 * GK, LOW_Y - 160 * GK, 128 * GK, 162 * GK, (c) => robed(c, x, LOW_Y, GK, -1, { bow }))));
    const mkBuf = () => K.makeCanvas(BUF.w * BUF.res, BUF.h * BUF.res);
    L = { paper, speck, ground, base, S, bufF: mkBuf(), bufG: mkBuf() };
  },

  render(ctx, t, env) {
    const S = L.S;
    const put = (s) => ctx.drawImage(s.img, s.x, s.y, s.w, s.h);
    K.put(ctx, L.base);
    // the procession steps in place on every beat while the pelican is in the picture; the escort a beat behind
    const n = Math.floor(t * 2 + 1e-6), on = stepping(t);
    const pose = on ? n % 2 : 0, poseE = on && t >= 0.5 ? (n + 1) % 2 : 0;
    S.legs.forEach((l, i) => put(l[i < 2 ? pose : poseE]));
    put(S.heads.rear[t >= 1.995 && t < 4 ? 'high' : 'fwd']); // the horse behind throws its head up as it is cut in on
    put(S.heads.front[t >= 1.995 && t < 4.5 ? 'back' : 'fwd']); // the horse ahead looks round
    put(S.arms[t >= 2.495 && t < 5 ? 'down' : 'up']); // the driver behind lowers his reins
    put(S.kneel[t >= 2.995 ? 'bow' : 'up']); // the kneeling attendant bows, as he would to any official
    S.greet.forEach((gr, i) => put(gr[t >= 4.495 + 0.25 * i ? 1 : 0])); // and the greeters, one by one, as it passes

    const p = env.pose;
    if (p) {
      const R = BUF.res, bx = p.x - BUF.ox, by = p.y - BUF.oy;
      const f = L.bufF.getContext('2d'), g = L.bufG.getContext('2d');
      for (const b of [f, g]) {
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.globalCompositeOperation = 'source-over';
        b.globalAlpha = 1;
        b.clearRect(0, 0, L.bufF.width, L.bufF.height);
        b.setTransform(R, 0, 0, R, -bx * R, -by * R);
      }
      // the stone behind it
      g.save();
      g.beginPath(); g.rect(bx - 2, by - 2, BUF.w + 4, RY - 0.4 - by + 2); g.clip();
      pelicanMoat(g, p);
      g.restore();
      g.globalCompositeOperation = 'source-in';
      g.drawImage(L.ground, 0, 0, 1000, 1000);
      // the figure: carved, speckled by the stone, filled with the paper
      carvePelican(f, p);
      f.globalCompositeOperation = 'destination-out';
      f.drawImage(L.speck, 0, 0, 1000, 1000);
      f.globalCompositeOperation = 'source-in';
      f.drawImage(L.paper, 0, 0, 1000, 1000);
      ctx.drawImage(L.bufG, bx, by, BUF.w, BUF.h);
      ctx.drawImage(L.bufF, bx, by, BUF.w, BUF.h);
    }
  },
};
