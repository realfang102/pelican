// main/boot — page entry. Exposes window.__film for the tools (frame export, screenshots, contact sheets)
// and starts the interactive preview unless the page is opened with ?headless.
import { film } from './film.js';
import * as K from '../kit/index.js';
import * as Beat from '../beat/index.js';
import * as Rig from '../rig/index.js';
import { scenes } from '../scenes/index.js';
import { startPlayer } from './player.js';

const q = new URLSearchParams(location.search);
const headless = q.has('headless');
if (headless) document.body.classList.add('headless');

const canvas = document.getElementById('film');
canvas.width = film.W;
canvas.height = film.H;
const ctx = canvas.getContext('2d', { alpha: false });

function soloEnv(i, t) {
  const T = (i === 0 ? 0 : Beat.sectionStart(i)) + t;
  const env = { K, Rig, Beat, index: i, title: scenes[i].title, T, t, hero: false, zoom: 1, owner: true };
  const sc = scenes[i];
  const qT = (x) => (sc.stutter ? Beat.quantize(x, sc.stutter) : x);
  const r = film.rider(qT(T));
  const lx = r.params.x - (i === 0 ? 0 : K.sectionX(i));
  env.pose = i <= Beat.SECTIONS && lx > -200 && lx < 1200 ? film.poseIn(i, qT(T)) : null;
  env.rider = { u: r.u, speed: r.speed, lx, y: r.params.y, s: r.params.s };
  env.poseAt = (tl) => film.poseIn(i, qT((i === 0 ? 0 : Beat.sectionStart(i)) + tl));
  return env;
}

const api = (window.__film = {
  film, K, Beat, Rig, scenes, canvas,
  /** draw film time T on the page canvas */
  async frame(T) {
    await film.prepare(T);
    film.renderAt(ctx, T);
  },
  /** film time T as a JPEG data URL (frame export) */
  async jpeg(T, quality = 0.92) {
    await film.prepare(T);
    film.renderAt(ctx, T);
    return canvas.toDataURL('image/jpeg', quality);
  },
  /** one section on its own, 1000×1000 units, at section-local time t → canvas */
  async solo(i, t, size = 1000, hero = false) {
    await film.ensure(i);
    const c = K.makeCanvas(size, size), x = c.getContext('2d');
    x.scale(size / 1000, size / 1000);
    x.beginPath();
    x.rect(0, 0, 1000, 1000);
    x.clip();
    const env = soloEnv(i, t);
    env.hero = hero;
    scenes[i].render(x, t, env);
    return c;
  },
  /**
   * Contact sheet → JPEG data URL.
   *   { times: [T…] }                      whole-film frames
   *   { scene: i, lt: [t…] }               one section alone at local times
   *   cols, cellW, label, quality
   */
  async sheet({ times = null, scene = null, lt = null, cols = 4, cellW = 480, label = true, quality = 0.88, hero = false } = {}) {
    const solo = scene != null;
    const list = solo ? lt : times;
    const cellH = solo ? cellW : Math.round((cellW * film.H) / film.W);
    const rows = Math.ceil(list.length / cols), gap = 6, cap = label ? 22 : 0;
    const sheet = K.makeCanvas(cols * cellW + (cols + 1) * gap, rows * (cellH + cap) + (rows + 1) * gap);
    const sx = sheet.getContext('2d');
    sx.fillStyle = '#111';
    sx.fillRect(0, 0, sheet.width, sheet.height);
    const timing = [];
    for (let k = 0; k < list.length; k++) {
      const x = gap + (k % cols) * (cellW + gap), y = gap + Math.floor(k / cols) * (cellH + cap + gap);
      const t0 = performance.now();
      let cap1;
      if (solo) {
        const c = await api.solo(scene, list[k], cellW, hero);
        timing.push(performance.now() - t0);
        sx.drawImage(c, x, y);
        cap1 = `§${scene}  t = ${list[k].toFixed(2)} s`;
      } else {
        await film.prepare(list[k]);
        const t1 = performance.now();
        film.renderAt(ctx, list[k]);
        timing.push(performance.now() - t1);
        sx.imageSmoothingQuality = 'high';
        sx.drawImage(canvas, x, y, cellW, cellH);
        const L = film.label(list[k]);
        cap1 = `T = ${list[k].toFixed(2)} s   ${L.n ? '§' + L.n + ' ' : ''}${L.en}`;
      }
      if (label) {
        sx.fillStyle = '#ddd';
        sx.font = '14px "DejaVu Sans Mono", monospace';
        sx.textBaseline = 'top';
        sx.fillText(cap1, x + 2, y + cellH + 4);
      }
    }
    return { url: sheet.toDataURL('image/jpeg', quality), ms: timing.map((v) => Math.round(v)), init: film.initMs() };
  },
});

window.__ready = K.bootBrush().then(async () => {
  await film.prepare(0);
  if (!headless) startPlayer({ film, canvas, ctx, Beat });
  return true;
});
window.__ready.catch((e) => {
  console.error('boot failed: ' + (e && e.stack ? e.stack : e));
  window.__bootError = String((e && e.stack) || e);
});
