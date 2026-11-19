// audio/vapor — the score for section 18, made the way the brief asks: an original piece in the manner of 1980s
// shopping-mall smooth jazz is synthesised FAST and HIGH (151.2 BPM, four semitones above the film's key), rendered
// to an AudioBuffer with an OfflineAudioContext, and then treated like tape: played at 0.7937× so it drops to
// 120 BPM and back into the main key, drowned in a long reverb, dulled above 4 kHz, wobbled by a 0.5 Hz LFO on
// `detune`, with a little hiss. It slows down on entry, skips in bar 2, and speeds back up on the way out.
import * as S from './synth.js';

export const RATE = Math.pow(2, -4 / 12); // 0.7937: −4 semitones, 151.2 BPM → 120 BPM
const BPM_IN = 151.2, BD = 60 / BPM_IN, UP = 4;
const RAMP = 0.5; // seconds of tape slow-down on entry / speed-up on exit
const RAMP_SRC = (RAMP * (1 + RATE)) / 2; // tape consumed during a ramp
export const PRE = RAMP_SRC - BD; // pre-roll so that beat 1 lands on the film's beat once the tape has settled
export const SKIP = { at: 2.5, len: 0.25, times: 4 }; // bar 2: a half-beat excerpt repeats four times

const MEL = [[0, 1, 69], [1, 0.5, 71], [1.5, 0.5, 74], [2, 1, 78], [3, 0.5, 76], [3.5, 0.5, 74], [4, 1.5, 71], [5.5, 0.5, 69], [6, 1, 71], [7, 1, 74], [8, 1, 76], [9, 0.5, 74], [9.5, 0.5, 71], [10, 0.5, 69], [10.5, 0.5, 71], [11, 1, 74]];
// major sevenths and minor ninths: Dmaj7 · Bm9 · Em9 · Dmaj7 (written in D; everything is transposed up four semitones)
const CHORDS = [[0, 4, [50, 57, 61, 66, 69]], [4, 4, [47, 57, 61, 62, 66]], [8, 2, [52, 59, 62, 66, 67]], [10, 2, [50, 57, 61, 64, 66]], [12, 4, [50, 57, 61, 66, 69]]];

/** tape position (seconds into the buffer) at section-local time t, ignoring the skip */
export function tapePos(t) {
  if (t <= 0) return 0;
  if (t < RAMP) return t - ((1 - RATE) * t * t) / (2 * RAMP);
  const exit = 6 - RAMP;
  if (t < exit) return RAMP_SRC + (t - RAMP) * RATE;
  const x = t - exit;
  return RAMP_SRC + (exit - RAMP) * RATE + x * RATE + ((1 - RATE) * x * x) / (2 * RAMP);
}

/** Step 1: synthesise the bright, fast original and render it to an AudioBuffer. */
export async function renderVapor(sampleRate = 48000) {
  const beats = 17, dur = PRE + beats * BD + 2.0;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
  const room = ctx.createConvolver(), roomG = ctx.createGain();
  room.buffer = S.impulse(ctx, 1.1, 9, 0.6);
  roomG.gain.value = 0.25;
  room.connect(roomG).connect(out);
  const gated = ctx.createConvolver(), gatedG = ctx.createGain(); // the gated reverb of the decade, on the drums
  gated.buffer = S.impulse(ctx, 0.5, 13, 0.8, 0.42);
  gatedG.gain.value = 0.5;
  gated.connect(gatedG).connect(out);
  const mk = (gain, sendRoom = 0, sendGate = 0) => {
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(out);
    if (sendRoom) {
      const s = ctx.createGain();
      s.gain.value = sendRoom;
      g.connect(s).connect(room);
    }
    if (sendGate) {
      const s = ctx.createGain();
      s.gain.value = sendGate;
      g.connect(s).connect(gated);
    }
    return g;
  };
  const T = (b) => PRE + b * BD;
  const ep = mk(0.55, 0.5), bass = mk(0.8, 0.1), sax = mk(0.62, 0.6), drums = mk(0.6, 0.1, 0.9), hats = mk(0.3, 0.2);
  // FM electric piano: tine attack, mellow body; a held chord and a syncopated re-strike
  for (const [b, len, notes] of CHORDS) {
    for (const [off, v, d] of [[0, 0.7, len * 0.95], [1.5, 0.4, 0.45], [len - 0.5, 0.35, 0.4]]) {
      if (off >= len) continue;
      notes.forEach((m, i) => S.fm(ctx, ep, T(b + off) + i * 0.012, m + UP + 12, d * BD, v, { ratio: 1, index: 1.4, indexAtt: 2.2, indexSus: 0.35, indexDecay: 0.12, sustain: 0.55, att: 0.004, rel: 0.25 }));
    }
  }
  // fretless bass: slides into the root, sings a little
  for (const [b, len, notes] of CHORDS) {
    const root = notes[0] - 12 + UP;
    S.fm(ctx, bass, T(b), root, len * BD * 0.7, 0.9, { ratio: 1, index: 0.9, indexSus: 0.5, sustain: 0.8, att: 0.02, rel: 0.1, from: root - 2, glide: 0.12, vib: 10, vibHz: 4.5 });
    S.fm(ctx, bass, T(b + len - 1), root + 7, BD * 0.8, 0.7, { ratio: 1, index: 0.9, indexSus: 0.5, sustain: 0.8, att: 0.02, rel: 0.08, from: root + 5, glide: 0.1 });
  }
  // FM saxophone: a laid-back variation on the film's melody — long notes scooped into, short ones ghosted
  MEL.forEach(([b, d, m], i) => {
    const lay = d >= 1 ? 0.08 : 0.03;
    S.fm(ctx, sax, T(b + lay), m + UP, d * BD * (d >= 1 ? 1.0 : 0.8), d >= 1 ? 0.8 : 0.5, { ratio: 2, index: 2.6, indexAtt: 1.6, indexSus: 0.6, indexDecay: 0.2, sustain: 0.85, att: 0.05, rel: 0.12, from: d >= 1 ? m + UP - 2 : null, glide: 0.11, vib: d >= 1 ? 22 : 0, vibHz: 5.4 });
    if (i === 6) S.fm(ctx, sax, T(b + 1.25), m + UP + 3, BD * 0.2, 0.4, { ratio: 2, index: 2.2, sustain: 0.7, att: 0.02, rel: 0.05 }); // a turn
  });
  // soft drums, gated
  for (let b = 0; b < beats; b++) {
    if (b % 2 === 0) S.drum(ctx, drums, T(b), 'softKick', 0.9);
    else S.drum(ctx, drums, T(b), 'softSnare', 0.8);
    S.drum(ctx, hats, T(b), 'hat', 0.5);
    S.drum(ctx, hats, T(b + 0.5), 'hat', 0.3);
    if (b % 4 === 3) S.drum(ctx, drums, T(b + 0.5), 'softKick', 0.5);
  }
  return ctx.startRendering();
}

/** Steps 2–4: play the buffer through the tape chain in the destination context. c = segment context from score.js */
export function scheduleVapor(c) {
  const { ctx, t0, from } = c;
  const buf = c.extras && c.extras.vapor;
  if (!buf) return;
  const busNode = c.bus({ gain: 1.0 });
  // muffled highs, long reverb with a high wet mix
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4000;
  lp.Q.value = 0.5;
  const dry = ctx.createGain(), wet = ctx.createGain(), verb = ctx.createConvolver();
  dry.gain.value = 0.62;
  wet.gain.value = 0.6;
  verb.buffer = S.impulse(ctx, 4.0, 21, 0.35);
  lp.connect(dry).connect(busNode);
  lp.connect(verb).connect(wet).connect(busNode);
  // tape wobble: one slow LFO on every reel's detune
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = 0.5;
  depth.gain.value = 11; // cents
  lfo.connect(depth);
  lfo.start(t0 + Math.max(0, from));
  lfo.stop(t0 + 7);
  const reel = (a, b, pos, ramps) => {
    // play output-time interval [a, b) starting at tape position `pos`
    if (b <= from + 0.002) return;
    let start = a, offset = pos;
    if (from > a) {
      // scrubbed into the middle: advance the tape as far as it would have run
      start = from;
      offset = pos + (tapePos(from) - tapePos(a));
    }
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    depth.connect(src.detune);
    const r = src.playbackRate;
    r.setValueAtTime(ramps(start), t0 + start);
    for (const [x0, x1, v0, v1] of [[0, RAMP, 1, RATE], [6 - RAMP, 6, RATE, 1]]) {
      if (x1 > start && x0 < b) {
        const s0 = Math.max(x0, start);
        r.setValueAtTime(v0 + ((v1 - v0) * (s0 - x0)) / (x1 - x0), t0 + s0);
        r.linearRampToValueAtTime(v0 + ((v1 - v0) * (Math.min(x1, b) - x0)) / (x1 - x0), t0 + Math.min(x1, b));
      }
    }
    g.gain.setValueAtTime(0, t0 + start);
    g.gain.linearRampToValueAtTime(1, t0 + start + 0.004);
    g.gain.setValueAtTime(1, t0 + b - 0.006);
    g.gain.linearRampToValueAtTime(0, t0 + b);
    src.connect(g).connect(lp);
    src.start(t0 + start, Math.max(0, offset));
    src.stop(t0 + b + 0.01);
  };
  const rateAt = (t) => (t < RAMP ? 1 - ((1 - RATE) * t) / RAMP : t > 6 - RAMP ? RATE + ((1 - RATE) * (t - (6 - RAMP))) / RAMP : RATE);
  // entry: starts at full speed and sags to 0.79× (tape slow-down) … until the skip
  reel(0, SKIP.at, tapePos(0), rateAt);
  // bar 2: the same half-beat, three more times (a skipping record)
  for (let k = 0; k < SKIP.times; k++) reel(SKIP.at + k * SKIP.len, SKIP.at + (k + 1) * SKIP.len, tapePos(SKIP.at), rateAt);
  // … then on from where the tape should be by now, speeding back up to pitch on the last strong beat
  const resume = SKIP.at + SKIP.times * SKIP.len;
  reel(resume, 6.0, tapePos(resume), rateAt);
  // a very light layer of tape hiss
  const s = c.sus(0, 6);
  if (s) {
    const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), hg = ctx.createGain();
    n.buffer = S.noiseBuffer(ctx, 2, 61);
    n.loop = true;
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    hg.gain.setValueAtTime(0.0001, s[0]);
    hg.gain.linearRampToValueAtTime(0.014, s[0] + 0.1);
    hg.gain.setValueAtTime(0.014, s[0] + s[1] - 0.1);
    hg.gain.linearRampToValueAtTime(0.0001, s[0] + s[1]);
    n.connect(hp).connect(hg).connect(busNode);
    n.start(s[0]);
    n.stop(s[0] + s[1] + 0.05);
  }
}
