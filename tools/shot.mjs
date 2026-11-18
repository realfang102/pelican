#!/usr/bin/env node
// Full-resolution stills of the film.
//   node tools/shot.mjs --t 12.5                     → out/shots/T012.50.jpg
//   node tools/shot.mjs --t 5,8,11 --out scratch/a   → scratch/a_T005.00.jpg …
//   --png for lossless output
import { openFilm, parseArgs, nums, saveDataUrl } from './lib.mjs';
const a = parseArgs();
if (a.t === undefined) {
  console.error('usage: node tools/shot.mjs --t <seconds[,seconds…]> [--out prefix] [--png]');
  process.exit(1);
}
const times = nums(a.t);
const { page, close } = await openFilm({ quiet: !a.verbose });
for (const T of times) {
  const t0 = Date.now();
  const url = await page.evaluate(async (T, png) => {
    await window.__film.frame(T);
    return png ? window.__film.canvas.toDataURL('image/png') : window.__film.canvas.toDataURL('image/jpeg', 0.95);
  }, T, !!a.png);
  const name = `${a.out ? a.out + '_' : 'out/shots/'}T${T.toFixed(2).padStart(6, '0')}.${a.png ? 'png' : 'jpg'}`;
  saveDataUrl(url, name);
  console.log(`${name}  (${Date.now() - t0} ms)`);
}
await close();
