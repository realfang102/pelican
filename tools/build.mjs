#!/usr/bin/env node
// Join the rendered segments (stream copy, no re-encode) and add the soundtrack.
//   node tools/build.mjs [--out out/the-pelican-test.mp4] [--audio out/score.wav] [--segments out/segments]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, ROOT } from './lib.mjs';
const a = parseArgs();
const dir = path.resolve(ROOT, String(a.segments ?? 'out/segments'));
const out = path.resolve(ROOT, String(a.out ?? 'out/the-pelican-test.mp4'));
const audio = path.resolve(ROOT, String(a.audio ?? 'out/score.wav'));
const names = ['intro', ...Array.from({ length: 20 }, (_, i) => `s${String(i + 1).padStart(2, '0')}`), 'outro'];
const missing = names.filter((n) => !fs.existsSync(path.join(dir, `${n}.mp4`)));
if (missing.length) {
  console.error('missing segments: ' + missing.join(', ') + '  → node tools/render.mjs');
  process.exit(1);
}
const list = path.join(dir, 'concat.txt');
fs.writeFileSync(list, names.map((n) => `file '${path.join(dir, n + '.mp4').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
const silent = path.join(dir, 'video.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent], { stdio: 'inherit' });
if (fs.existsSync(audio)) {
  const tmp = out.replace(/\.mp4$/, '.part.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
  fs.renameSync(tmp, out);
} else {
  console.warn('no soundtrack at ' + audio + ' — writing a silent film (node tools/audio.mjs renders the score)');
  fs.copyFileSync(silent, out);
}
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=nw=1', out]).toString().trim().replace(/\n/g, '  ');
console.log(`${path.relative(ROOT, out)}  ${probe}`);
