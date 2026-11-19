// audio/engine — real-time Web Audio for the browser preview.
// The score is synthesised live: each segment (intro, 20 sections, outro) is scheduled on the AudioContext a couple
// of seconds before it is due. engine.time() is the master clock for the picture, so beat and image cannot drift.
import * as S from './synth.js';
import { SEGMENTS, DURATION, schedule } from './score.js';
import { renderVapor } from './vapor.js';

export async function createEngine() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC({ latencyHint: 'interactive' });
  const mute = ctx.createGain();
  mute.connect(ctx.destination);
  const vapor = await renderVapor(ctx.sampleRate); // the section-18 "cassette" is pre-rendered once
  let session = null, timer = null, T0 = 0, c0 = 0;
  const LOOKAHEAD = 2.5;

  const eng = {
    ctx, playing: false,
    async play(T) {
      eng.stop();
      if (ctx.state !== 'running') await ctx.resume();
      const out = ctx.createGain();
      out.connect(mute);
      session = { out, M: S.master(ctx, out), done: new Set() };
      T0 = T;
      c0 = ctx.currentTime + 0.09;
      eng.playing = true;
      const pump = () => {
        if (!session) return;
        const now = eng.time();
        for (const seg of SEGMENTS) {
          if (session.done.has(seg.name) || seg.start + seg.dur <= T0 + 0.001) continue;
          if (seg.start - now > LOOKAHEAD) continue;
          session.done.add(seg.name);
          const from = Math.max(0, T0 - seg.start);
          schedule(ctx, session.M, seg, c0 + (seg.start - T0), from, { vapor });
        }
      };
      pump();
      timer = setInterval(pump, 250);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      if (session) {
        const s = session;
        s.out.gain.setTargetAtTime(0, ctx.currentTime, 0.012);
        setTimeout(() => s.out.disconnect(), 120);
      }
      session = null;
      eng.playing = false;
    },
    /** film time now — what is leaving the loudspeaker at this instant (the device's output latency is taken off) */
    time: () => Math.min(DURATION, T0 + Math.max(0, ctx.currentTime - (ctx.outputLatency || 0) - c0)),
    /** for tools/synccheck.mjs: the tap point and the mapping between context time and film time */
    output: mute,
    clock: () => ({ T0, c0 }),
    setMuted(m) {
      mute.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.01);
    },
  };
  return eng;
}
