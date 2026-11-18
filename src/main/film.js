// main/film — scene scheduling, the rider, the camera, picture frames and the outro wall.
//
// film.renderAt(ctx, T) draws film time T (seconds) onto a 1920×1080 2D context. It is a pure function of T:
// call it for any T in any order (scrubbing, parallel frame export) and you get the same picture.
// film.prepare(T) must have resolved first — it runs the async, one-off init() of every scene visible at T.
import * as K from '../kit/index.js';
import * as Beat from '../beat/index.js';
import * as Rig from '../rig/index.js';
import { scenes } from '../scenes/index.js';

const { W, H, SEC, FRAME, PITCH, ROAD_Y, SPEED, sectionX } = K;
const N = Beat.SECTIONS;
const PRESS = N + 1;

// ------------------------------------------------------------------------------------------------ the rider
// Intro: the pelican poses as "Fig. 1" at FIG_X, then rides off on the second line's beat and reaches the first frame at T = 5.
export const INTRO_CX = -1020, FIG_X = -420, RIDE_T = 3.0;
const introX = K.pchip([[0, FIG_X], [RIDE_T, FIG_X], [Beat.INTRO, -FRAME]], 0, SPEED);
const profiles = scenes.map((s) => Beat.makeProfile(s.profile));

let memoT = NaN, memoR = null;
/** where the pelican is and what it is doing at film time T (smooth — never quantised) */
export function rider(T) {
  if (T === memoT) return memoR;
  let wx, owner, t, u, speed, D;
  if (T < Beat.INTRO) {
    const tt = Math.max(0, T);
    wx = introX(tt);
    owner = 0;
    t = T;
    u = 0;
    speed = tt < RIDE_T ? 0 : introX.d(tt);
    D = (wx + FRAME) / PITCH;
  } else if (T < Beat.T_OUTRO) {
    owner = Beat.locate(T).index;
    t = T - Beat.sectionStart(owner);
    u = profiles[owner](t);
    speed = profiles[owner].d(t) * PITCH;
    wx = sectionX(owner) - FRAME + PITCH * u;
    D = owner - 1 + u;
  } else {
    owner = PRESS;
    t = T - Beat.T_OUTRO;
    u = t / Beat.SECTION;
    speed = SPEED;
    wx = sectionX(PRESS) - FRAME + SPEED * t;
    D = N + u;
  }
  const p = { x: wx, y: ROAD_Y, s: 1, rot: 0, crank: K.TAU * 6 * D + 0.9, wheel: wx / Rig.GEO.WR, t: T, wind: K.clamp(speed / SPEED, 0, 1.5) };
  const sc = scenes[owner];
  if (owner >= 1 && owner <= N) {
    if (sc.path) {
      const m = sc.path(u, t) || {};
      p.y += m.dy ?? 0;
      p.s = m.s ?? 1;
      p.rot = m.rot ?? 0;
    }
    if (sc.act) sc.act(t, p, { u, speed, K, Beat });
  } else if (owner === 0 && sc.act) sc.act(T, p, { u, speed, K, Beat });
  memoT = T;
  memoR = { wx, owner, t, u, speed, params: p };
  return memoR;
}

const originX = (index) => (index === 0 ? 0 : sectionX(index));
/** the pose at film time T expressed in panel `index`'s own coordinates */
export function poseIn(index, T) {
  const r = rider(T);
  return Rig.solve({ ...r.params, x: r.params.x - originX(index) });
}

// ------------------------------------------------------------------------------------------------ the camera
const crossingBump = (T) => {
  const k = Math.round((T - Beat.INTRO) / Beat.SECTION);
  if (k < 0 || k > N) return 0;
  const d = (T - (Beat.INTRO + k * Beat.SECTION)) / 0.42;
  return Math.exp(-d * d);
};

// outro wall: 7 × 3 grid whose bottom row is the strip position of sections 15..21
const GRID = { x: sectionX(15) - FRAME, y: -2 * PITCH - FRAME, w: 7 * PITCH, h: 3 * PITCH };
export const gridPos = (n) => [sectionX(15 + ((n - 1) % 7)), (Math.floor((n - 1) / 7) - 2) * PITCH];
const OUT = (() => {
  const zW = (0.9 * W) / GRID.w; // grid spans 90 % of the screen width
  const zF = 0.86;
  return {
    start: { cx: sectionX(PRESS) - FRAME, cy: SEC / 2, zoom: 1.07 },
    wide: { cx: GRID.x + GRID.w / 2, cy: GRID.y + GRID.h / 2 + (H / 2 - 434) / zW, zoom: zW },
    close: { cx: sectionX(PRESS) + SEC / 2, cy: SEC / 2 + 36 / zF, zoom: zF },
    PULL: 1.6, PUSH0: 3.6, PUSH1: 8.0,
  };
})();
const zoomBlend = (a, b, e) => {
  const zoom = a.zoom * Math.pow(b.zoom / a.zoom, e);
  const k = (1 / zoom - 1 / b.zoom) / (1 / a.zoom - 1 / b.zoom); // travel in step with the visible width
  return { cx: b.cx + (a.cx - b.cx) * k, cy: b.cy + (a.cy - b.cy) * k, zoom };
};
function outroCam(t) {
  if (t < OUT.PULL) return zoomBlend(OUT.start, OUT.wide, K.ease.out3(K.prog(t, 0, OUT.PULL)));
  if (t < OUT.PUSH0) return OUT.wide;
  return zoomBlend(OUT.wide, OUT.close, K.ease.ioSine(K.prog(t, OUT.PUSH0, OUT.PUSH1 - OUT.PUSH0)));
}

export function camera(T) {
  if (T >= Beat.T_OUTRO) return outroCam(T - Beat.T_OUTRO);
  const r = rider(T);
  let cx = r.wx, cy = SEC / 2, zoom = 1 + 0.07 * crossingBump(T);
  if (T < Beat.INTRO) {
    const e = K.ease.io3(K.prog(T, 3.3, 1.66));
    cx = r.wx + (INTRO_CX - FIG_X) * (1 - e);
  } else {
    const sc = scenes[r.owner];
    if (sc.camera) {
      const c = sc.camera(r.t, { u: r.u, K, Beat, px: r.params.x - sectionX(r.owner), py: r.params.y, ps: r.params.s }) || {};
      zoom *= c.zoom ?? 1;
      cx += c.dx ?? 0;
      cy += c.dy ?? 0;
    }
  }
  return { cx, cy, zoom };
}

// ------------------------------------------------------------------------------------------------ frames & wall
let frameTile = null, wallTile = null;
function buildChrome() {
  const size = SEC + 2 * FRAME;
  frameTile = K.layer(size, size, 1.2, (ctx) => {
    const F = FRAME;
    const side = (pts, c0, c1, gx0, gy0, gx1, gy1) => {
      const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      g.addColorStop(0, c0);
      g.addColorStop(0.45, c1);
      g.addColorStop(0.55, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      K.path(ctx, pts, true);
      ctx.fill();
    };
    const o = 0, i = F, O = size, I = size - F;
    side([[o, o], [O, o], [I, i], [i, i]], '#3a2c22', '#1c1410', 0, 0, 0, F); // top
    side([[o, O], [O, O], [I, I], [i, I]], '#150f0c', '#2a1f18', 0, O, 0, I); // bottom
    side([[o, o], [i, i], [i, I], [o, O]], '#2e221a', '#16100c', 0, 0, F, 0); // left
    side([[O, o], [I, i], [I, I], [O, O]], '#120d0a', '#261c15', O, 0, I, 0); // right
    // wood grain
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.rect(F, F, SEC, SEC);
    ctx.clip('evenodd');
    K.grain(ctx, 0, 0, size, size, { color: '#000000', alpha: 0.22, seed: 5, size: 1 });
    K.fibers(ctx, size, size, { n: 2600, seed: 8, color: '#6b4a33', alpha: 0.16, len: [20, 90], angle: 0, spread: 0.1, width: 0.7 });
    ctx.restore();
    // gilt lip next to the picture
    const lip = 5;
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = '#8f6f33';
    ctx.lineWidth = lip;
    ctx.strokeRect(F - lip / 2, F - lip / 2, SEC + lip, SEC + lip);
    ctx.strokeStyle = '#e5c97f';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(F - lip + 0.8, F - lip + 0.8, SEC + 2 * lip - 1.6, SEC + 2 * lip - 1.6);
    ctx.strokeStyle = 'rgba(40,24,8,0.85)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(F - 0.6, F - 0.6, SEC + 1.2, SEC + 1.2);
    // outer edge
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    ctx.strokeStyle = 'rgba(255,220,170,0.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(3, 3, size - 6, size - 6);
    // shadow the frame casts onto the picture (top and left)
    const sh = 14;
    let g = ctx.createLinearGradient(0, F, 0, F + sh);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(F, F, SEC, sh);
    g = ctx.createLinearGradient(F, 0, F + sh * 0.7, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(F, F, sh * 0.7, SEC);
  });
  wallTile = K.layer(512, 512, 1, (ctx) => {
    ctx.fillStyle = '#2b2623';
    ctx.fillRect(0, 0, 512, 512);
    K.grain(ctx, 0, 0, 512, 512, { color: '#000000', alpha: 0.16, seed: 21 });
    K.grain(ctx, 0, 0, 512, 512, { color: '#ffffff', alpha: 0.05, seed: 22 });
  });
}

function drawFrame(ctx, x, y) {
  ctx.drawImage(frameTile, x - FRAME, y - FRAME, SEC + 2 * FRAME, SEC + 2 * FRAME);
}

// ------------------------------------------------------------------------------------------------ scenes
const state = scenes.map(() => ({ init: null, ready: false, ms: 0 }));
function ensure(index) {
  const st = state[index], sc = scenes[index];
  if (!st.init) {
    st.init = (async () => {
      const t0 = performance.now();
      if (sc.init) await sc.init(K, { Rig, Beat });
      st.ms = performance.now() - t0;
      st.ready = true;
    })();
  }
  return st.init;
}

const stutterT = (sc, T) => (sc.stutter ? Beat.quantize(T, sc.stutter) : T);

function envFor(index, T, extra = {}) {
  const sc = scenes[index];
  const start = index === 0 ? 0 : Beat.sectionStart(index);
  const Tq = stutterT(sc, T);
  const r = rider(T);
  const x0 = originX(index);
  let pose = null;
  if (index !== PRESS) {
    const rq = Tq === T ? r : rider(Tq);
    const lx = rq.params.x - x0, ext = 170 * (rq.params.s ?? 1);
    const inRange = index === 0 ? lx - ext < -FRAME : lx + ext > 0 && lx - ext < SEC;
    if (inRange) pose = poseIn(index, Tq);
  }
  return {
    K, Rig, Beat, index, title: sc.title, T, t: T - start, pose, owner: r.owner === index,
    rider: { u: r.owner === index ? r.u : r.owner < index ? 0 : 1, speed: r.speed, lx: r.params.x - x0, y: r.params.y, s: r.params.s },
    /** pose at another section-local time (trails, ghosts, echoes); honours the scene's stutter */
    poseAt: (tl) => poseIn(index, stutterT(sc, start + tl)),
    hero: false, zoom: 1, ...extra,
  };
}

function drawPanel(ctx, index, T, cam) {
  const sc = scenes[index], st = state[index];
  ctx.save();
  if (index === 0) {
    ctx.beginPath();
    ctx.rect(-4000, -1200, 4000 - FRAME, 3400);
    ctx.clip();
  } else {
    ctx.translate(sectionX(index), 0);
    ctx.beginPath();
    ctx.rect(0, 0, SEC, SEC);
    ctx.clip();
  }
  if (!st.ready) {
    ctx.fillStyle = '#15120f';
    ctx.fillRect(index === 0 ? -4000 : 0, index === 0 ? -1200 : 0, index === 0 ? 4000 : SEC, index === 0 ? 3400 : SEC);
  } else {
    const env = envFor(index, T, { zoom: cam.zoom });
    sc.render(ctx, env.t, env);
  }
  ctx.restore();
}

// hero stills for the outro wall: every section frozen on its pelican
const heroes = [];
const HERO_RES = 0.8;
function buildHero(i) {
  const sc = scenes[i];
  const tHero = sc.heroT ?? 3.2;
  const T = Beat.sectionStart(i) + tHero;
  heroes[i] = K.layer(SEC, SEC, HERO_RES, (ctx) => {
    ctx.beginPath();
    ctx.rect(0, 0, SEC, SEC);
    ctx.clip();
    const env = envFor(i, T, { hero: true, zoom: HERO_RES });
    sc.render(ctx, env.t, env);
  });
}

// ------------------------------------------------------------------------------------------------ public API
function visiblePanels(cam) {
  const half = W / 2 / cam.zoom;
  const x0 = cam.cx - half, x1 = cam.cx + half;
  const out = [];
  if (x0 < -FRAME) out.push(0);
  for (let i = 1; i <= PRESS; i++) {
    const a = sectionX(i) - FRAME, b = sectionX(i) + SEC + FRAME;
    if (b > x0 && a < x1) out.push(i);
  }
  return out;
}

function needed(T) {
  if (T >= Beat.T_OUTRO - 1e-6) return scenes.map((_, i) => i).filter((i) => i >= 1);
  return visiblePanels(camera(T));
}

export const film = {
  W, H, duration: Beat.DURATION, scenes,
  camera, rider, poseIn,
  /** resolve when every scene needed to draw film time T has finished its one-off init */
  async prepare(T) {
    if (!frameTile) buildChrome();
    const idx = needed(T);
    for (const i of idx) await ensure(i);
    if (T >= Beat.T_OUTRO - 1e-6) for (let i = 1; i <= N; i++) if (!heroes[i]) buildHero(i);
  },
  readyFor(T) {
    if (!frameTile) return false;
    if (T >= Beat.T_OUTRO - 1e-6) return needed(T).every((i) => state[i].ready) && heroes.length > N;
    return needed(T).every((i) => state[i].ready);
  },
  /** init one scene (used by the preview's background loader and by tools) */
  ensure(i) {
    if (!frameTile) buildChrome();
    return ensure(i);
  },
  initMs: () => state.map((s) => Math.round(s.ms)),
  label(T) {
    const seg = Beat.locate(T);
    if (seg.kind === 'intro') return { n: 0, zh: '開場', en: 'Intro', date: '' };
    if (seg.kind === 'outro') return { n: 21, zh: '記者會', en: 'Outro — Press Conference', date: '' };
    return { n: seg.index, ...scenes[seg.index].title };
  },

  renderAt(ctx, T) {
    T = K.clamp(T, 0, Beat.DURATION);
    const cam = camera(T);
    const outro = T >= Beat.T_OUTRO;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#2b2623';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);

    if (outro) drawWall(ctx, cam, T - Beat.T_OUTRO);
    else {
      const vis = visiblePanels(cam);
      for (const i of vis) drawPanel(ctx, i, T, cam);
      for (const i of vis) if (i >= 1) drawFrame(ctx, sectionX(i), 0);
      // a glint runs down the frame post as the pelican passes through it
      const k = Math.round((T - Beat.INTRO) / Beat.SECTION);
      const dt = T - (Beat.INTRO + k * Beat.SECTION);
      if (k >= 0 && k <= N && Math.abs(dt) < 0.5) {
        const a = Math.exp(-((dt / 0.16) ** 2));
        const px = sectionX(k + 1) - FRAME;
        const g = ctx.createLinearGradient(px - FRAME, 0, px + FRAME, 0);
        g.addColorStop(0, 'rgba(255,226,160,0)');
        g.addColorStop(0.5, `rgba(255,236,190,${0.5 * a})`);
        g.addColorStop(1, 'rgba(255,226,160,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.fillRect(px - FRAME, -FRAME, 2 * FRAME, SEC + 2 * FRAME);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();

    // screen-space overlays owned by scenes (e.g. the 9:16 pillarbox of the vertical-video section)
    if (!outro) {
      for (let i = 1; i <= N; i++) {
        const sc = scenes[i];
        if (!sc.overlay || !state[i].ready) continue;
        const t = T - Beat.sectionStart(i);
        if (t < -1 || t > Beat.SECTION + 1) continue;
        const env = envFor(i, T, { zoom: cam.zoom });
        env.toScreen = (p) => [(p[0] + sectionX(i) - cam.cx) * cam.zoom + W / 2, (p[1] - cam.cy) * cam.zoom + H / 2];
        ctx.save();
        sc.overlay(ctx, t, env);
        ctx.restore();
      }
    }
    if (outro) drawSubtitles(ctx, T - Beat.T_OUTRO);
    if (T < 0.7) {
      ctx.fillStyle = `rgba(8,7,6,${1 - K.ease.io2(K.prog(T, 0.05, 0.6))})`;
      ctx.fillRect(0, 0, W, H);
    }
  },
};

// ------------------------------------------------------------------------------------------------ outro
function drawWall(ctx, cam, t) {
  // wall
  const half = W / 2 / cam.zoom, halfV = H / 2 / cam.zoom;
  const pat = ctx.createPattern(wallTile, 'repeat');
  ctx.fillStyle = pat;
  ctx.fillRect(cam.cx - half - 4, cam.cy - halfV - 4, 2 * half + 8, 2 * halfV + 8);
  // gallery light: brighter above, falling off to the sides and floor
  const g = ctx.createRadialGradient(GRID.x + GRID.w / 2, GRID.y - 400, 600, GRID.x + GRID.w / 2, GRID.y + GRID.h / 2, GRID.w * 0.75);
  g.addColorStop(0, 'rgba(255,236,200,0.16)');
  g.addColorStop(0.5, 'rgba(255,236,200,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(cam.cx - half - 4, cam.cy - halfV - 4, 2 * half + 8, 2 * halfV + 8);
  // soft shadow under the whole grid
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.filter = 'none';
  ctx.fillRect(GRID.x + 18, GRID.y + 26, GRID.w, GRID.h);

  const live = t < 0.45; // sections 19/20 dissolve from their live state to their frozen pelican
  for (let n = 1; n <= PRESS; n++) {
    const [x, y] = gridPos(n);
    if (x + SEC + FRAME < cam.cx - half || x - FRAME > cam.cx + half || y + SEC + FRAME < cam.cy - halfV || y - FRAME > cam.cy + halfV) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, SEC, SEC);
    ctx.clip();
    if (n === PRESS) {
      const env = envFor(PRESS, Beat.T_OUTRO + t, { zoom: cam.zoom });
      scenes[PRESS].render(ctx, t, env);
    } else {
      if (live && n >= N - 1) {
        const env = envFor(n, Beat.T_OUTRO + t, { zoom: cam.zoom });
        scenes[n].render(ctx, env.t, env);
        ctx.globalAlpha = K.ease.io2(K.prog(t, 0.08, 0.36));
      }
      if (heroes[n]) ctx.drawImage(heroes[n], 0, 0, SEC, SEC);
      ctx.globalAlpha = 1;
      // roll-call: each entry lights up in order while the wide shot holds
      const tk = OUT.PULL - 0.35 + (n - 1) * 0.1;
      const a = t > tk ? Math.exp(-(t - tk) * 7) : 0;
      if (a > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,240,205,${0.32 * a})`;
        ctx.fillRect(0, 0, SEC, SEC);
      }
    }
    ctx.restore();
    drawFrame(ctx, x, y);
  }
}

const SUBS = [
  { a: 0.9, b: 3.7, text: 'To date, humanity has submitted 20 entries.' },
  { a: 8.0, b: 99, text: 'The pelican itself has yet to comment.' },
];
function drawSubtitles(ctx, t) {
  for (const s of SUBS) {
    const a = K.gate(t, s.a, s.b, 0.3, 0.35);
    if (a <= 0.01) continue;
    const y = 1004;
    ctx.save();
    ctx.globalAlpha = a;
    const w = K.measure(ctx, s.text, { size: 44, font: K.FONT.serif }) + 90;
    const g = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
    g.addColorStop(0, 'rgba(10,8,7,0)');
    g.addColorStop(0.12, 'rgba(10,8,7,0.62)');
    g.addColorStop(0.88, 'rgba(10,8,7,0.62)');
    g.addColorStop(1, 'rgba(10,8,7,0)');
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - w / 2, y - 48, w, 66);
    K.text(ctx, s.text, W / 2, y, { size: 44, font: K.FONT.serif, align: 'center', color: '#f1e8d4' });
    ctx.restore();
  }
}
