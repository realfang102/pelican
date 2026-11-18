#!/usr/bin/env node
// Contact sheets — the way to look at the film without playing it.
//
//   whole film:        node tools/sheet.mjs --from 0 --to 137 --n 24 --cols 6
//   explicit times:    node tools/sheet.mjs --times 4.8,5,5.2,11
//   one section, as it appears in the film (camera, neighbours, frames):
//                      node tools/sheet.mjs --section 5 --n 8
//   one section alone, square, at section-local times (fast loop while painting a scene):
//                      node tools/sheet.mjs --scene 5 --lt -1,0.5,2,3,4,5.5 --cols 3 --cellW 600
//   options: --out file.jpg  --cols N  --cellW px  --nolabel  --hero (render as the outro wall still)
// Prints init time per scene and render ms per frame.
import { openFilm, parseArgs, nums, saveDataUrl } from './lib.mjs';
const a = parseArgs();
const opt = { cols: Number(a.cols ?? 4), cellW: Number(a.cellW ?? 480), label: !a.nolabel, hero: !!a.hero };
let out = a.out;
if (a.scene !== undefined) {
  opt.scene = Number(a.scene);
  opt.lt = a.lt !== undefined ? nums(a.lt) : [-0.5, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5];
  out ??= `out/sheets/scene${String(opt.scene).padStart(2, '0')}.jpg`;
} else {
  if (a.times !== undefined) opt.times = nums(a.times);
  else if (a.section !== undefined) {
    const i = Number(a.section), n = Number(a.n ?? 8), s = 5 + (i - 1) * 6;
    opt.times = Array.from({ length: n }, (_, k) => +(s - 0.25 + (k * 6.5) / (n - 1)).toFixed(3));
    out ??= `out/sheets/section${String(i).padStart(2, '0')}.jpg`;
  } else {
    const from = Number(a.from ?? 0), to = Number(a.to ?? 137), n = Number(a.n ?? 24);
    opt.times = Array.from({ length: n }, (_, k) => +(from + ((to - from) * (k + 0.5)) / n).toFixed(3));
  }
  out ??= 'out/sheets/film.jpg';
}
const t0 = Date.now();
const { page, close } = await openFilm({ quiet: !a.verbose });
const res = await page.evaluate((o) => window.__film.sheet(o), opt);
saveDataUrl(res.url, out);
const init = res.init.map((ms, i) => (ms ? `§${i}:${ms}ms` : null)).filter(Boolean).join(' ');
console.log(`${out}  frames=${res.ms.length}  render ms/frame: avg ${Math.round(res.ms.reduce((x, y) => x + y, 0) / res.ms.length)} max ${Math.max(...res.ms)}  init: ${init || '—'}  total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await close();
