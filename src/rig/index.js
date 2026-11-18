// rig — the pelican and its bicycle as one parametric skeleton.
//
// solve(params) turns a handful of numbers (where it is, crank angle, how the neck is held, …) into a POSE:
// named joints, outlines and tubes in picture coordinates. Every art style receives the same pose and draws it
// its own way, so the motion carries straight through a change of style at a picture frame.
//
// Rig-local space: x forward (the pelican faces +x), y DOWN like the canvas, origin on the ground midway
// between the wheels. At scale 1 the wheels have radius 50, the wheelbase is 160, the beak tip reaches x ≈ +134
// and the top of the head y ≈ −305.
import { TAU, clamp, lerp } from '../kit/math.js';
import { catmull } from '../kit/stroke.js';

// ---------------------------------------------------------------------------------------------- geometry
const U = (x, y) => [x, -y]; // author in y-up, store y-down
export const GEO = {
  WR: 50,
  hubR: U(-80, 50),
  hubF: U(80, 50),
  bb: U(-10, 46),
  crank: 22,
  seat: U(-42, 126),
  saddle: U(-46, 138),
  headTop: U(50, 132),
  headBot: U(56, 108),
  stemTop: U(48, 150),
  grip: U(68, 154),
  hip: U(-28, 152),
  thigh: 60,
  shin: 74,
  shoulder: U(-4, 212),
  neckBase: U(-6, 222),
  head: U(24, 284),
  headR: 17,
  scarf: U(-16, 234),
  /** rest bounding box (rig-local, y down) with a little air for feathers and streamers */
  bounds: { x0: -150, y0: -318, x1: 146, y1: 4 },
};
const BODY = [U(8, 196), U(2, 222), U(-22, 236), U(-62, 226), U(-96, 200), U(-108, 186), U(-100, 170), U(-78, 152), U(-46, 142), U(-14, 150), U(6, 170)];
const WING = [U(-10, 224), U(-40, 228), U(-74, 216), U(-100, 196), U(-112, 180), U(-92, 178), U(-66, 172), U(-36, 172), U(-14, 184), U(-4, 204)];
const WING_MARKS = [
  [U(-22, 212), U(-48, 208), U(-74, 196), U(-96, 184)],
  [U(-18, 198), U(-44, 194), U(-68, 186), U(-86, 180)],
  [U(-16, 186), U(-38, 182), U(-58, 178)],
];
const TAIL = [
  [U(-100, 190), U(-138, 186), U(-104, 178)],
  [U(-102, 182), U(-144, 168), U(-102, 170)],
  [U(-100, 174), U(-134, 150), U(-94, 164)],
];

// ---------------------------------------------------------------------------------------------- matrices
// [a,b,c,d,e,f] like the canvas: x' = a·x + c·y + e, y' = b·x + d·y + f
const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const ap = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
const rotAbout = (a, o) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, s, -s, c, o[0] - o[0] * c + o[1] * s, o[1] - o[0] * s - o[1] * c];
};
const trans = (x, y) => [1, 0, 0, 1, x, y];
const apAll = (M, pts) => pts.map((p) => ap(M, p));

function bez(p0, c1, c2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t;
    out.push([m * m * m * p0[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * p3[0], m * m * m * p0[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * p3[1]]);
  }
  return out;
}
function ribbon(pts, w0, w1, wMid = null) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const m = Math.hypot(nx, ny) || 1;
    nx /= m;
    ny /= m;
    const u = i / (n - 1);
    const w = (wMid == null ? lerp(w0, w1, u) : u < 0.5 ? lerp(w0, wMid, u * 2) : lerp(wMid, w1, u * 2 - 1)) / 2;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  return L.concat(R.reverse());
}
/** two-bone IK; bend = +1 puts the joint on the +x side when the target hangs below the root (y down) */
function ik(root, target, l1, l2, bend = 1) {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const base = Math.atan2(dy, dx);
  const ang = base - bend * a;
  return [root[0] + Math.cos(ang) * l1, root[1] + Math.sin(ang) * l1];
}

// ---------------------------------------------------------------------------------------------- params
export const DEFAULTS = {
  x: 0, // riding-line contact point (picture coords)
  y: 0,
  s: 1, // scale
  rot: 0, // canvas rotation (rad) — follow the slope of the road; + = nose down
  crank: 0, // pedal angle (rad), increases as it rides forward
  wheel: 0, // wheel spin (rad)
  t: 0, // seconds — drives flutter, blink and breathing only
  wind: 1, // 0 = still air … 1 = cruising: streamers, crest and tail trail back
  bob: 1, // 0..1 how much the body rocks with each pedal stroke
  lean: 0, // body pitch about the saddle (rad, + = forward/down)
  neck: 0, // −1 hunched … 0 relaxed S … 1 craned up and forward
  head: [0, 0], // extra head offset (rig units, y down)
  headTilt: 0, // beak pitch (rad, + = beak up)
  beakOpen: 0, // 0..1
  pouch: 0, // extra sag of the throat pouch (units)
  eye: [0, 0], // pupil offset −1..1 (x forward, y down)
  lid: null, // 0 open … 1 shut; null = automatic blinking
  wave: 0, // 0 = wing on the handlebar … 1 = raised in salute
  armTo: null, // or: explicit rig-local target [x, y] for the wing tip
  tailWag: 0, // rad
  crest: 0, // 0..1 raise the head tuft
  squash: 1, // vertical squash/stretch of the whole rig about the ground (1 = none)
};

// ---------------------------------------------------------------------------------------------- solve
export function solve(params = {}) {
  const q = { ...DEFAULTS, ...params };
  const { s, rot } = q;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const M = [s * cr, s * sr, -s * sr * q.squash, s * cr * q.squash, q.x, q.y];
  const th = q.crank;
  const t = q.t;

  // --- groups
  const bobY = -1.6 * q.bob * Math.sin(2 * th + 0.6) - 0.8 * q.bob;
  const sway = 0.012 * q.bob * Math.sin(th);
  const Gbody = mul(M, mul(trans(0, bobY), rotAbout(q.lean + sway, GEO.saddle)));
  // head: neck param moves the head, headTilt rotates it about its centre
  const nk = q.neck;
  const breathe = 0.8 * Math.sin(t * 2.1);
  const hx = q.head[0] + (nk > 0 ? 16 * nk : 6 * nk) + 1.4 * q.bob * Math.sin(2 * th - 0.5);
  const hy = q.head[1] + (nk > 0 ? -14 * nk : -26 * nk) + 1.2 * q.bob * Math.cos(2 * th - 0.5) + breathe * 0.4;
  const headC = [GEO.head[0] + hx, GEO.head[1] + hy];
  const Ghead = mul(Gbody, mul(trans(hx, hy), rotAbout(-q.headTilt, GEO.head)));
  const GwR = mul(M, rotAbout(q.wheel, GEO.hubR));
  const GwF = mul(M, rotAbout(q.wheel, GEO.hubF));
  const Gcrank = mul(M, rotAbout(th, GEO.bb));

  // --- bike
  const pedal = (a) => [GEO.bb[0] + Math.cos(a) * GEO.crank, GEO.bb[1] + Math.sin(a) * GEO.crank];
  const pN = pedal(th), pF = pedal(th + Math.PI);
  const B = (p) => ap(M, p);
  const pt = {
    ground: B([0, 0]),
    hubR: B(GEO.hubR),
    hubF: B(GEO.hubF),
    bb: B(GEO.bb),
    seat: B(GEO.seat),
    saddle: B(GEO.saddle),
    headTop: B(GEO.headTop),
    headBot: B(GEO.headBot),
    stemTop: B(GEO.stemTop),
    grip: B(GEO.grip),
    pedalN: B(pN),
    pedalF: B(pF),
  };
  const tubes = {
    chainStay: [pt.bb, pt.hubR],
    seatStay: [pt.seat, pt.hubR],
    seatTube: [pt.bb, pt.seat],
    seatPost: [pt.seat, pt.saddle],
    topTube: [pt.seat, pt.headTop],
    downTube: [pt.bb, pt.headBot],
    headTube: [pt.headBot, pt.headTop],
    fork: [pt.headBot, B([GEO.headBot[0] + 16, GEO.headBot[1] + 34]), pt.hubF],
    stem: [pt.headTop, pt.stemTop],
    bar: [pt.stemTop, B([GEO.stemTop[0] + 10, GEO.stemTop[1] - 5]), pt.grip, B([GEO.grip[0] + 9, GEO.grip[1] + 5])],
  };
  const saddle = apAll(M, [U(-68, 141), U(-52, 144), U(-30, 142), U(-20, 138), U(-28, 134), U(-56, 134), U(-68, 136)]);
  const pedalPoly = (p, a) => {
    const c = Math.cos(a), sn = Math.sin(a), hw = 12, hh = 2.6;
    return apAll(M, [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [p[0] + x * c - y * sn, p[1] + x * sn + y * c]));
  };
  const footTiltN = 0.28 * Math.sin(th - 0.9), footTiltF = 0.28 * Math.sin(th + Math.PI - 0.9);
  const chainring = { c: pt.bb, r: 14 * s }, cog = { c: pt.hubR, r: 7 * s };
  const chain = [
    [B([GEO.bb[0], GEO.bb[1] - 14]), B([GEO.hubR[0], GEO.hubR[1] - 7])],
    [B([GEO.bb[0], GEO.bb[1] + 14]), B([GEO.hubR[0], GEO.hubR[1] + 7])],
  ];

  // --- body group
  const Bd = (p) => ap(Gbody, p);
  const wag = q.tailWag + 0.05 * q.wind * Math.sin(t * 7.3);
  const tailBase = U(-102, 180);
  const tail = TAIL.map((f, i) => apAll(mul(Gbody, rotAbout(wag * (1 + i * 0.25), tailBase)), catmull(f, 4, true)));
  const body = apAll(Gbody, catmull(BODY, 6, true));
  const wing = apAll(Gbody, catmull(WING, 5, true));
  const wingMarks = WING_MARKS.map((m) => apAll(Gbody, catmull(m, 4)));
  const hipL = GEO.hip;
  pt.hip = Bd(hipL);
  pt.shoulder = Bd(GEO.shoulder);

  // legs: hip rides with the body, feet stay on the pedals
  const hipInRig = ap(mul(trans(0, bobY), rotAbout(q.lean + sway, GEO.saddle)), hipL);
  const leg = (p, far) => {
    const ankle = [p[0] - 2, p[1] - 4];
    const knee = ik(hipInRig, ankle, GEO.thigh, GEO.shin, 1);
    return { hip: B(hipInRig), knee: B(knee), ankle: B(ankle) };
  };
  const legN = leg(pN, false), legF = leg(pF, true);
  pt.kneeN = legN.knee;
  pt.kneeF = legF.knee;
  pt.ankleN = legN.ankle;
  pt.ankleF = legF.ankle;
  const foot = (p, tilt) => {
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const o = [p[0] - 2, p[1] - 3.2];
    return apAll(M, [[-9, -2], [-4, -7], [8, -6], [30, -9], [33, -2], [31, 3], [10, 2.6], [-8, 2.6]].map(([x, y]) => [o[0] + x * c - y * sn, o[1] + x * sn + y * c]));
  };

  // wing-arm to the handlebar (or raised)
  const toBody = (p) => p; // arm is solved in rig space then mapped with M for the hand end, body for the shoulder
  const shoulderRig = ap(mul(trans(0, bobY), rotAbout(q.lean + sway, GEO.saddle)), GEO.shoulder);
  let hand = GEO.grip;
  const salute = [shoulderRig[0] + 58 + 6 * Math.sin(t * 9), shoulderRig[1] - 66];
  if (q.armTo) hand = q.armTo;
  else if (q.wave > 0) hand = [lerp(GEO.grip[0], salute[0], q.wave), lerp(GEO.grip[1], salute[1], q.wave)];
  const elbow = ik(shoulderRig, hand, 52, 50, q.wave > 0.5 || (q.armTo && q.armTo[1] < shoulderRig[1]) ? 1 : -1);
  pt.elbow = B(elbow);
  pt.hand = B(hand);
  const armSpine = bez(shoulderRig, [lerp(shoulderRig[0], elbow[0], 0.7), lerp(shoulderRig[1], elbow[1], 0.7)], elbow, hand, 10);
  const arm = apAll(M, ribbon(armSpine, 30, 9, 19));
  const hd = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  const fingers = [-0.55, 0.1, 0.75].map((da, i) => {
    const a = hd + 0.9 + da * 0.8, L = 15 - i * 2;
    return apAll(M, [hand, [hand[0] + Math.cos(a) * L * 0.6 + 3, hand[1] + Math.sin(a) * L * 0.6], [hand[0] + Math.cos(a + 0.7) * L, hand[1] + Math.sin(a + 0.7) * L]]);
  });

  // --- neck (flexible: from the body up to the head)
  const nb = ap(mul(trans(0, bobY), rotAbout(q.lean + sway, GEO.saddle)), GEO.neckBase);
  const headInRig = ap(mul(trans(0, bobY), rotAbout(q.lean + sway, GEO.saddle)), headC);
  const c1 = [nb[0] - 24 + 10 * Math.max(0, nk), nb[1] - 36 - 8 * nk];
  const c2 = [headInRig[0] - 34 + 12 * Math.max(0, nk), headInRig[1] + 4 - 12 * Math.max(0, -nk)];
  const neckSpine = bez(nb, c1, c2, headInRig, 14);
  const neck = apAll(M, ribbon(neckSpine, 34, 17, 20));
  pt.neckBase = B(nb);
  pt.head = B(headInRig);

  // --- head group (rest coords, mapped by Ghead)
  const Hd = (p) => ap(Ghead, p);
  const H0 = GEO.head;
  const beakA = -0.2; // rest pitch of the beak (rad, canvas: negative = … we build in y-up below)
  // beak-local (u along the beak, v up) → rig-local rest coords
  const cb = Math.cos(beakA), sb = Math.sin(beakA);
  const bk = (u, v) => [H0[0] + u * cb - v * sb, H0[1] - (u * sb + v * cb)];
  const open = q.beakOpen * 0.42;
  const hinge = [12, -1];
  const lower = (u, v) => {
    const du = u - hinge[0], dv = v - hinge[1], c = Math.cos(-open), sn = Math.sin(-open);
    return bk(hinge[0] + du * c - dv * sn, hinge[1] + du * sn + dv * c);
  };
  const sag = 3 + q.pouch + 1.6 * q.bob * Math.sin(2 * th + 1.2) + q.beakOpen * 6;
  const beakUpper = apAll(Ghead, catmull([bk(8, 9), bk(40, 10), bk(76, 7.5), bk(100, 4.5), bk(110, 0.5), bk(108, -6), bk(101, -1.5), bk(60, 0.2), bk(12, -0.5)], 4, true));
  const pouch = apAll(Ghead, catmull([lower(12, -1), lower(60, -0.6), lower(101, -2), lower(90, -9), lower(64, -19 - sag), lower(38, -22 - sag), lower(16, -15 - sag * 0.4), lower(6, -7)], 4, true));
  const beakLine = apAll(Ghead, [lower(14, -1.4), lower(60, -1), lower(101, -2.2)]);
  const head = apAll(Ghead, catmull([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
    const a = (i / 10) * TAU;
    return [H0[0] + Math.cos(a) * GEO.headR * 1.06, H0[1] + Math.sin(a) * GEO.headR * 0.98];
  }), 3, true));
  const lift = q.crest * 0.7;
  const flut = 0.12 * q.wind * Math.sin(t * 11);
  const crest = [0, 1, 2].map((i) => {
    const a = Math.PI + 0.25 - i * 0.32 + lift + flut * (1 + i * 0.3), L = 20 - i * 3;
    const base = [H0[0] - 13 + i * 1.5, H0[1] - 9 + i * 6];
    return apAll(Ghead, [base, [base[0] + Math.cos(a) * L * 0.5, base[1] - Math.sin(a) * L * 0.5 - 2], [base[0] + Math.cos(a) * L, base[1] - Math.sin(a) * L]]);
  });
  const eyeC = Hd([H0[0] + 5.5, H0[1] - 5]);
  const blink = q.lid != null ? q.lid : (t / 2.7 + 0.31) % 1 > 0.955 ? 1 : 0;
  const eye = { c: eyeC, r: 4.6 * s, pupil: Hd([H0[0] + 5.5 + q.eye[0] * 2, H0[1] - 5 + q.eye[1] * 2]), pr: 2.3 * s, lid: blink };
  pt.eye = eyeC;
  pt.beakBase = Hd(bk(10, 2));
  pt.beakTip = Hd(bk(110, 0));

  // --- scarf / streamers (two tails trailing from the back of the neck)
  const anchor = ap(mul(trans(0, bobY), rotAbout(q.lean + sway, GEO.saddle)), GEO.scarf);
  const wind = clamp(q.wind, 0, 1.6);
  const scarf = [0, 1].map((k) => {
    const len = k ? 96 : 124, droop = lerp(1.25, 0.12 + k * 0.1, clamp(wind)), n = 12, pts = [];
    for (let j = 0; j <= n; j++) {
      const u = j / n, d = u * len;
      const amp = u * (5 + 9 * wind) * (0.6 + 0.4 * Math.sin(t * 2.3 + k));
      const wv = Math.sin(t * (7 + k * 1.7) - d * 0.075 + k * 1.9) * amp;
      const dx = -Math.cos(droop) * d + Math.sin(droop) * wv * 0.4, dy = Math.sin(droop) * d + wv;
      pts.push([anchor[0] + dx, anchor[1] + dy]);
    }
    return apAll(M, pts);
  });
  const scarfKnot = apAll(M, ribbon(bez([anchor[0] - 6, anchor[1] + 4], [anchor[0] + 2, anchor[1] - 2], [anchor[0] + 14, anchor[1] + 2], [anchor[0] + 22, anchor[1] + 12], 6), 9, 9));

  const wheels = [
    { c: pt.hubR, r: GEO.WR * s, a: q.wheel + rot, name: 'rear' },
    { c: pt.hubF, r: GEO.WR * s, a: q.wheel + rot, name: 'front' },
  ];
  const bb0 = GEO.bounds;
  const corners = apAll(M, [[bb0.x0, bb0.y0], [bb0.x1, bb0.y0], [bb0.x1, bb0.y1], [bb0.x0, bb0.y1]]);
  const bbox = { x0: Math.min(...corners.map((c) => c[0])), y0: Math.min(...corners.map((c) => c[1])), x1: Math.max(...corners.map((c) => c[0])), y1: Math.max(...corners.map((c) => c[1])) };

  return {
    x: q.x, y: q.y, s, rot, crank: th, wheelA: q.wheel, t, params: q,
    M, G: { bike: M, body: Gbody, head: Ghead, wheelR: GwR, wheelF: GwF, crank: Gcrank },
    pt, wheels, tubes, chainring, cog, chain, eye, bbox,
    shapes: {
      body, wing, wingMarks, tail, arm, fingers, neck, head, crest, beakUpper, pouch, beakLine, saddle,
      legN: [legN.hip, legN.knee, legN.ankle], legF: [legF.hip, legF.knee, legF.ankle],
      footN: foot(pN, footTiltN), footF: foot(pF, footTiltF),
      pedalN: pedalPoly(pN, footTiltN), pedalF: pedalPoly(pF, footTiltF),
      crankN: [pt.bb, pt.pedalN], crankF: [pt.bb, pt.pedalF],
      scarf, scarfKnot,
    },
  };
}

/** the neutral pose at the origin — use it to bake sprites (shapes are then in rig-local coords) */
export const rest = (extra = {}) => solve({ x: 0, y: 0, s: 1, wind: 0.9, bob: 0, crank: 0.9, t: 0.4, lid: 0, ...extra });

// ---------------------------------------------------------------------------------------------- parts list
/**
 * Flatten a pose into a back-to-front list of drawable parts. A style is then just a loop:
 *   for (const p of Rig.parts(pose)) { … draw p however this era would … }
 * Each part: { name, role, kind, far?, … }
 *   kind 'poly'  → pts (closed outline)                         kind 'line' → pts (open polyline), w (suggested width)
 *   kind 'wheel' → c, r, a (spin), spokes                       kind 'disc' → c, r     kind 'eye' → c, r, pupil, pr, lid
 * roles: tire, frame, metal, saddle, leg, foot, body, wing, tail, neck, head, beak, pouch, eye, scarf, mark
 * opts.scarf = false drops the streamers.
 */
export function parts(pose, opts = {}) {
  const S = pose.shapes, s = pose.s, T = pose.tubes, out = [];
  const poly = (name, role, pts, extra) => out.push({ name, role, kind: 'poly', pts, ...extra });
  const line = (name, role, pts, w, extra) => out.push({ name, role, kind: 'line', pts, w: w * s, ...extra });
  // far side
  line('crankF', 'metal', S.crankF, 5, { far: true });
  poly('pedalF', 'metal', S.pedalF, { far: true });
  line('legF', 'leg', S.legF, 9, { far: true });
  poly('footF', 'foot', S.footF, { far: true });
  // wheels
  for (const w of pose.wheels) out.push({ name: 'wheel_' + w.name, role: 'tire', kind: 'wheel', c: w.c, r: w.r, a: w.a, spokes: 12 });
  // frame
  line('chainStay', 'frame', T.chainStay, 5);
  line('seatStay', 'frame', T.seatStay, 4.5);
  line('seatTube', 'frame', T.seatTube, 6.5);
  line('downTube', 'frame', T.downTube, 7);
  line('topTube', 'frame', T.topTube, 6.5);
  line('fork', 'frame', T.fork, 5.5);
  line('headTube', 'frame', T.headTube, 8.5);
  line('seatPost', 'metal', T.seatPost, 4);
  line('stem', 'metal', T.stem, 4.5);
  line('bar', 'metal', T.bar, 5);
  poly('saddle', 'saddle', S.saddle);
  line('chain', 'metal', pose.chain[0], 1.6);
  line('chain2', 'metal', pose.chain[1], 1.6);
  out.push({ name: 'cog', role: 'metal', kind: 'disc', c: pose.cog.c, r: pose.cog.r });
  out.push({ name: 'chainring', role: 'metal', kind: 'disc', c: pose.chainring.c, r: pose.chainring.r });
  // near side
  line('crankN', 'metal', S.crankN, 5.5);
  poly('pedalN', 'metal', S.pedalN);
  line('legN', 'leg', S.legN, 10);
  poly('footN', 'foot', S.footN);
  // bird
  S.tail.forEach((f, i) => poly('tail' + i, 'tail', f));
  poly('body', 'body', S.body);
  poly('wing', 'wing', S.wing);
  S.wingMarks.forEach((m, i) => line('wingMark' + i, 'mark', m, 2));
  poly('neck', 'neck', S.neck);
  if (opts.scarf !== false) {
    S.scarf.forEach((p, i) => line('scarf' + i, 'scarf', p, 10 - i * 2));
    poly('scarfKnot', 'scarf', S.scarfKnot);
  }
  poly('arm', 'wing', S.arm);
  S.fingers.forEach((f, i) => line('finger' + i, 'wing', f, 5.5));
  S.crest.forEach((c, i) => line('crest' + i, 'head', c, 3.4));
  poly('head', 'head', S.head);
  poly('pouch', 'pouch', S.pouch);
  poly('beakUpper', 'beak', S.beakUpper);
  line('beakLine', 'mark', S.beakLine, 1.4);
  out.push({ name: 'eye', role: 'eye', kind: 'eye', ...pose.eye });
  return out;
}

/** spoke segments of a wheel part: [[hub, rim], …] */
export function spokes(w, n = w.spokes ?? 12, inner = 0.08, outer = 0.9) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = w.a + (i / n) * TAU;
    out.push([[w.c[0] + Math.cos(a) * w.r * inner, w.c[1] + Math.sin(a) * w.r * inner], [w.c[0] + Math.cos(a) * w.r * outer, w.c[1] + Math.sin(a) * w.r * outer]]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- reference painters
const tracePts = (ctx, pts, closed) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
};

/**
 * Plain flat-colour drawing of the pose — the "house" pelican used by placeholders and as a starting point.
 * style: { fill:{role:colour}, line: outline colour or null, lw: outline width, far: darkening colour for far-side parts,
 *          scarf: bool, eyeWhite, pupil }
 */
export function drawFlat(ctx, pose, style = {}) {
  const fill = {
    tire: '#22201e', frame: '#b8322a', metal: '#3a3836', saddle: '#2a2420', leg: '#e58a2e', foot: '#e58a2e', body: '#f4efe6', wing: '#e3dccf',
    tail: '#d9d1c2', neck: '#f4efe6', head: '#f4efe6', beak: '#f2b233', pouch: '#f08c3a', scarf: '#c8372d', mark: '#8c8478', ...(style.fill || {}),
  };
  const lineCol = style.line === undefined ? '#1c1a18' : style.line;
  const lw = (style.lw ?? 2.2) * pose.s;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of parts(pose, { scarf: style.scarf })) {
    const col = fill[p.role] ?? '#888';
    if (p.far && style.far !== null) ctx.globalAlpha = 0.72;
    else ctx.globalAlpha = 1;
    if (p.kind === 'poly') {
      tracePts(ctx, p.pts, true);
      ctx.fillStyle = col;
      ctx.fill();
      if (lineCol) {
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    } else if (p.kind === 'line') {
      tracePts(ctx, p.pts, false);
      if (lineCol && p.role !== 'mark' && p.w > lw * 1.6) {
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = p.w + lw * 1.4;
        ctx.stroke();
      }
      ctx.strokeStyle = p.role === 'mark' ? (lineCol || col) : col;
      ctx.lineWidth = p.role === 'mark' ? lw * 0.8 : p.w;
      ctx.stroke();
    } else if (p.kind === 'wheel') {
      ctx.strokeStyle = fill.metal;
      ctx.lineWidth = 1.1 * pose.s;
      ctx.beginPath();
      for (const [a, b] of spokes(p)) {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r * 0.93, 0, TAU);
      ctx.strokeStyle = col;
      ctx.lineWidth = p.r * 0.14;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r * 0.1, 0, TAU);
      ctx.fillStyle = fill.metal;
      ctx.fill();
    } else if (p.kind === 'disc') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();
    } else if (p.kind === 'eye') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r, 0, TAU);
      ctx.fillStyle = style.eyeWhite ?? '#fffdf5';
      ctx.fill();
      if (lineCol) {
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = lw * 0.7;
        ctx.stroke();
      }
      if (p.lid < 0.5) {
        ctx.beginPath();
        ctx.arc(p.pupil[0], p.pupil[1], p.pr, 0, TAU);
        ctx.fillStyle = style.pupil ?? '#141210';
        ctx.fill();
      } else if (lineCol) {
        ctx.beginPath();
        ctx.moveTo(p.c[0] - p.r, p.c[1]);
        ctx.lineTo(p.c[0] + p.r, p.c[1]);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** every part filled with one colour — shadows, cut-outs, pictographs */
export function drawSilhouette(ctx, pose, color = '#000000', { spokesToo = true, scarf = true, grow = 0 } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of parts(pose, { scarf })) {
    if (p.kind === 'poly') {
      tracePts(ctx, p.pts, true);
      ctx.fill();
      if (grow) {
        ctx.lineWidth = grow * 2;
        ctx.stroke();
      }
    } else if (p.kind === 'line') {
      if (p.role === 'mark') continue;
      tracePts(ctx, p.pts, false);
      ctx.lineWidth = p.w + grow * 2;
      ctx.stroke();
    } else if (p.kind === 'wheel') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r * 0.93, 0, TAU);
      ctx.lineWidth = p.r * 0.15 + grow;
      ctx.stroke();
      if (spokesToo) {
        ctx.lineWidth = Math.max(1, 1.4 * pose.s);
        ctx.beginPath();
        for (const [a, b] of spokes(p)) {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke();
      }
    } else if (p.kind === 'disc') {
      ctx.beginPath();
      ctx.arc(p.c[0], p.c[1], p.r + grow, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}
