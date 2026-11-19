#!/usr/bin/env node
// Offline soundtrack: the page synthesises the whole score in an OfflineAudioContext, Node writes it as a WAV.
//   node tools/audio.mjs                         → out/score.wav (0–137 s, 48 kHz stereo)
//   node tools/audio.mjs --from 107 --to 113 --out scratch/s18.wav
//   node tools/audio.mjs --only s05,s06 --out scratch/part.wav
import fs from 'node:fs';
import path from 'node:path';
import { openFilm, parseArgs, ROOT } from './lib.mjs';
const a = parseArgs();
const out = path.resolve(ROOT, String(a.out ?? 'out/score.wav'));
const opts = { sampleRate: Number(a.rate ?? 48000) };
if (a.from !== undefined) opts.from = Number(a.from);
if (a.to !== undefined) opts.to = Number(a.to);
if (a.only) opts.only = String(a.only).split(',');
const { page, close } = await openFilm({ pagePath: '/audio/index.html', query: '', quiet: !a.verbose });
const stats = await page.evaluate((o) => window.__audio.render(o), opts);
const SIZE = 3 * 1024 * 1024;
fs.mkdirSync(path.dirname(out), { recursive: true });
const fd = fs.openSync(out, 'w');
for (let i = 0; i * SIZE < stats.bytes; i++) fs.writeSync(fd, Buffer.from(await page.evaluate((i, s) => window.__audio.chunk(i, s), i, SIZE), 'base64'));
fs.closeSync(fd);
await close();
console.log(`${path.relative(ROOT, out)}  ${stats.seconds.toFixed(2)} s  rendered in ${(stats.ms / 1000).toFixed(1)} s  raw peak ${stats.peak.toFixed(3)} → normalised ×${stats.gain.toFixed(2)}`);
