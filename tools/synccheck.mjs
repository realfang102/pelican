#!/usr/bin/env node
// Beat-sync check of the REAL-TIME audio path against the OFFLINE render.
// Plays the live engine from film time T for a few seconds in headless Chrome, records what it actually emits with an
// AudioWorklet (sample-accurate context timestamps), renders the same span offline, and cross-correlates the two.
// A lag of ~0 ms means an event scheduled for film time X sounds at film time X in the preview, exactly as in the MP4.
//   node tools/synccheck.mjs [--t 4.2] [--dur 5]
import { openFilm, parseArgs } from './lib.mjs';
const a = parseArgs();
const T = Number(a.t ?? 4.2), DUR = Number(a.dur ?? 5);
const { page, close } = await openFilm({ pagePath: '/audio/index.html', query: '', quiet: !a.verbose });
const res = await page.evaluate(async (T, DUR) => {
  const { createEngine } = await import('./engine.js');
  const { renderScore } = await import('./offline.js');
  const eng = await createEngine();
  const ctx = eng.ctx;
  const src = `class Rec extends AudioWorkletProcessor { process(inputs) { const i = inputs[0]; if (i && i[0]) this.port.postMessage({ t: currentTime, d: i[0].slice(0) }); return true; } } registerProcessor('rec', Rec);`;
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  const rec = new AudioWorkletNode(ctx, 'rec', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
  const blocks = [];
  rec.port.onmessage = (e) => blocks.push(e.data);
  eng.output.connect(rec);
  rec.connect(ctx.destination);
  const wall0 = performance.now();
  await eng.play(T);
  await new Promise((r) => setTimeout(r, DUR * 1000 + 400));
  const wall = (performance.now() - wall0) / 1000, filmElapsed = eng.time() - T;
  const { T0, c0 } = eng.clock();
  eng.stop();
  // stitch the live recording onto the film timeline
  const sr = ctx.sampleRate, n = Math.floor(DUR * sr), live = new Float32Array(n);
  let got = 0;
  for (const b of blocks) {
    const i0 = Math.round((b.t - c0) * sr);
    for (let k = 0; k < b.d.length; k++) {
      const i = i0 + k;
      if (i >= 0 && i < n) {
        live[i] = b.d[k];
        got++;
      }
    }
  }
  const off = await renderScore({ sampleRate: sr, from: T0, to: T0 + DUR });
  const o0 = off.getChannelData(0), o1 = off.getChannelData(1), ref = new Float32Array(n);
  for (let i = 0; i < n; i++) ref[i] = (o0[i] + o1[i]) / 2;
  // cross-correlate over ±40 ms
  const maxLag = Math.round(0.04 * sr);
  let best = -Infinity, bestLag = 0, e1 = 0, e2 = 0;
  for (let i = maxLag; i < n - maxLag; i += 2) {
    e1 += live[i] * live[i];
    e2 += ref[i] * ref[i];
  }
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = maxLag; i < n - maxLag; i += 2) s += live[i + lag] * ref[i];
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  return { sampleRate: sr, coverage: got / n, lagMs: (bestLag / sr) * 1000, corr: best / Math.sqrt(e1 * e2 + 1e-12), clockRate: filmElapsed / wall, outputLatencyMs: (ctx.outputLatency || 0) * 1000 };
}, T, DUR);
await close();
console.log(`real-time vs offline, film ${T}–${T + DUR} s:  lag ${res.lagMs.toFixed(2)} ms   correlation ${res.corr.toFixed(3)}   recorded ${(res.coverage * 100).toFixed(1)} % of samples   clock ${res.clockRate.toFixed(4)}× real time   sampleRate ${res.sampleRate}`);
