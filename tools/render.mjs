#!/usr/bin/env node
// Frame-by-frame export. Puppeteer asks the page for film time T = n / fps, the page draws it (a pure function of T)
// and hands back a JPEG, which is piped straight into ffmpeg — one encoded file per segment, no frame files on disk.
//
//   node tools/render.mjs                       all 22 segments (intro, s01…s20, outro) → out/segments/*.mp4
//   node tools/render.mjs --seg s05,s06         only these segments
//   node tools/render.mjs --from 4.5 --to 6.5 --out scratch/test.mp4     an arbitrary clip (single file)
//   options: --fps 60  --crf 18  --preset medium  --workers 2  --quality 0.93 (JPEG)  --force (re-render existing)
// Then:  node tools/build.mjs   joins the segments and adds the soundtrack.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { openFilm, parseArgs, ROOT } from './lib.mjs';

const a = parseArgs();
const FPS = Number(a.fps ?? 60), CRF = String(a.crf ?? 18), PRESET = String(a.preset ?? 'medium'), Q = Number(a.quality ?? 0.93);
const OUTDIR = path.resolve(ROOT, String(a.outdir ?? 'out/segments'));

export const SEGMENTS = [{ name: 'intro', from: 0, to: 5 }];
for (let i = 1; i <= 20; i++) SEGMENTS.push({ name: `s${String(i).padStart(2, '0')}`, from: 5 + (i - 1) * 6, to: 5 + i * 6 });
SEGMENTS.push({ name: 'outro', from: 125, to: 137 });

function ffmpeg(outFile) {
  const tmp = outFile.replace(/\.mp4$/, '.part.mp4');
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-g', String(FPS * 2), '-video_track_timescale', '15360', tmp];
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg exited ' + code)))));
  return { p, tmp, done };
}

async function renderClip(page, from, to, outFile, tag) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
  const enc = ffmpeg(outFile);
  const t0 = Date.now();
  for (let n = n0; n < n1; n++) {
    const url = await page.evaluate((T, q) => window.__film.jpeg(T, q), n / FPS, Q);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!enc.p.stdin.write(buf)) await new Promise((r) => enc.p.stdin.once('drain', r));
    if ((n - n0) % (FPS * 2) === 0 && n > n0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`  ${tag} ${n - n0}/${n1 - n0} frames  ${(el / (n - n0) * 1000).toFixed(0)} ms/frame`);
    }
  }
  enc.p.stdin.end();
  await enc.done;
  fs.renameSync(enc.tmp, outFile); // only a finished encode gets the real name
  console.log(`${tag} → ${path.relative(ROOT, outFile)}  ${n1 - n0} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

async function worker(list, id) {
  const { page, close } = await openFilm({ quiet: true });
  try {
    for (const s of list) await renderClip(page, s.from, s.to, path.join(OUTDIR, `${s.name}.mp4`), `[w${id}] ${s.name}`);
  } finally {
    await close();
  }
}

if (a.from !== undefined) {
  const out = path.resolve(String(a.out ?? 'out/clip.mp4'));
  const { page, close } = await openFilm({ quiet: true });
  await renderClip(page, Number(a.from), Number(a.to), out, 'clip');
  await close();
} else {
  let list = SEGMENTS;
  if (a.seg && a.seg !== 'all') {
    const want = String(a.seg).split(',');
    list = SEGMENTS.filter((s) => want.includes(s.name));
  }
  if (!a.force) list = list.filter((s) => !fs.existsSync(path.join(OUTDIR, `${s.name}.mp4`)));
  const W = Math.max(1, Math.min(Number(a.workers ?? 2), list.length));
  // contiguous runs per worker so each browser paints each scene once; the outro (which needs all 20) goes last
  const cost = (s) => (s.to - s.from) + (s.name === 'outro' ? 20 : 0);
  const total = list.reduce((x, s) => x + cost(s), 0);
  const parts = Array.from({ length: W }, () => []);
  let acc = 0;
  for (const s of list) {
    parts[Math.min(W - 1, Math.floor((acc / total) * W))].push(s);
    acc += cost(s);
  }
  fs.writeFileSync(path.join(ROOT, 'out', 'render.json'), JSON.stringify({ fps: FPS, crf: CRF, preset: PRESET }, null, 1));
  const t0 = Date.now();
  await Promise.all(parts.map((p, i) => (p.length ? worker(p, i + 1) : null)));
  console.log(`rendered ${list.length} segment(s) at ${FPS} fps in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
