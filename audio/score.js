// audio/score — the film's music. One original melody in D pentatonic, carried through all 20 sections with the
// instrumentation changing to suit each era; a bicycle bell rings at every picture-frame crossing.
//
// Timeline (seconds): intro 0–5 · section i at 5 + 6·(i−1), 12 beats each at 120 BPM · outro 125–137.
// schedule(ctx, M, name, t0, from) puts one segment on any BaseAudioContext, so the live preview and the offline
// render run exactly the same score. `from` skips events earlier than that many seconds into the segment (scrubbing).
import * as S from './synth.js';
import { scheduleVapor } from './vapor.js';

export const BPM = 120, BEAT = 0.5, SECTION = 6, INTRO = 5, T_OUTRO = 125, DURATION = 137;
export const KEY = 62; // D4

// ------------------------------------------------------------------------------------------- the melody
// [beat, length in beats, MIDI note]. Phrase A asks, phrase B answers; sections alternate A, B, A, B …
export const PHRASE_A = [[0, 1, 69], [1, 0.5, 71], [1.5, 0.5, 74], [2, 1, 76], [3, 0.5, 74], [3.5, 0.5, 71], [4, 1.5, 69], [5.5, 0.5, 66], [6, 1, 69], [7, 1, 71], [8, 1, 74], [9, 0.5, 71], [9.5, 0.5, 69], [10, 0.5, 66], [10.5, 0.5, 64], [11, 0.5, 62], [11.5, 0.5, 64]];
export const PHRASE_B = [[0, 1, 69], [1, 0.5, 71], [1.5, 0.5, 74], [2, 1, 78], [3, 0.5, 76], [3.5, 0.5, 74], [4, 1.5, 71], [5.5, 0.5, 69], [6, 1, 71], [7, 1, 74], [8, 1, 76], [9, 0.5, 74], [9.5, 0.5, 71], [10, 0.5, 69], [10.5, 0.5, 71], [11, 1, 74]];
const CH_A = [[0, 4, [50, 57, 62, 66]], [4, 4, [47, 54, 59, 62]], [8, 2, [43, 50, 55, 59]], [10, 2, [45, 52, 57, 61]]];
const CH_B = [[0, 4, [50, 57, 62, 66]], [4, 4, [43, 50, 55, 59]], [8, 2, [45, 52, 57, 61]], [10, 2, [50, 57, 62, 66]]];
export const phrase = (i) => (i % 2 ? PHRASE_A : PHRASE_B);
const chords = (i) => (i % 2 ? CH_A : CH_B);
const minor = (m) => (m % 12 === 6 ? m - 1 : m % 12 === 11 ? m - 1 : m); // F♯→F, B→B♭: the tune in D minor
const chordAt = (ch, b) => ch.find((c) => b >= c[0] && b < c[0] + c[1]) ?? ch[ch.length - 1];

// ------------------------------------------------------------------------------------------- scheduling helpers
const TRIM = { 2: 1.25, 3: 0.88, 4: 1.3, 7: 0.92, 8: 0.92, 10: 0.88, 11: 1.12, 12: 1.15, 13: 1.25, 16: 1.08, 17: 1.1, 19: 0.82 };
function ctxFor(ctx, M, t0, from, trim = 1) {
  const ok = (tl) => tl >= from - 1e-4;
  return {
    ctx, M, t0, from,
    /** absolute time of beat b */
    T: (b) => t0 + b * BEAT,
    /** play voice fn at beat b unless it lies before `from` */
    P(busNode, fn, b, ...args) {
      if (ok(b * BEAT)) fn(ctx, busNode, t0 + b * BEAT, ...args);
    },
    /** same, at a time in seconds */
    Q(busNode, fn, tl, ...args) {
      if (ok(tl)) fn(ctx, busNode, t0 + tl, ...args);
    },
    ok,
    /** a sustained sound from tl lasting d: starts late (shortened) when scrubbed into */
    sus(tl, d) {
      const a = Math.max(tl, from);
      return a < tl + d - 0.05 ? [t0 + a, tl + d - a] : null;
    },
    bus: (o = {}) => S.bus(ctx, M, { ...o, gain: (o.gain ?? 1) * trim }),
  };
}
const melody = (c, busNode, ph, fn, { oct = 0, vel = 0.7, len = 0.92, opt = () => ({}), skip = () => false, map = (m) => m } = {}) => {
  ph.forEach(([b, d, m], i) => {
    if (skip(b, d, i)) return;
    c.P(busNode, fn, b, map(m) + oct * 12, d * BEAT * len, vel * (b % 4 === 0 ? 1.08 : b % 1 ? 0.86 : 1), opt(b, d, m, i));
  });
};
/** the chain: soft sixteenth-note ticks, a touch louder on the beat */
function chainTicks(c, busNode, b0, b1, vel = 0.25, every = 0.5) {
  for (let b = b0; b < b1 - 1e-6; b += every) c.P(busNode, S.drum, b, 'chain', vel * (b % 1 === 0 ? 1 : 0.6));
}
const ding = (c, vel = 0.55) => {
  const b = c.bus({ gain: 1, room: 0.25, hall: 0.2 });
  c.Q(b, S.bikeBell, 0, vel);
};

// ------------------------------------------------------------------------------------------- intro (5 s)
function intro(c) {
  const low = c.bus({ gain: 0.95, hall: 0.6 });
  // solemn low strings: open fifth swelling under the text
  for (const [m, v] of [[26, 0.9], [38, 0.9], [45, 0.55], [50, 0.4]]) {
    const s = c.sus(0, 5.2);
    if (s) S.strings(c.ctx, low, s[0], m, s[1], v, { att: 1.2, lp: 900, vib: 4, voices: 3, rel: 0.6 });
  }
  const perc = c.bus({ gain: 0.9, hall: 0.5 });
  c.Q(perc, S.drum, 1.0, 'timpani', 0.45, { f: 73.4 }); // line 1 lands
  c.Q(perc, S.drum, 3.0, 'timpani', 0.95, { f: 73.4 }); // line 2 lands on the strong beat
  c.Q(perc, S.drum, 3.0, 'bigDrum', 0.5);
  const hi = c.bus({ gain: 0.6, hall: 0.6 });
  const s2 = c.sus(3.0, 2.0);
  if (s2) S.strings(c.ctx, hi, s2[0], 57, s2[1], 0.5, { att: 0.5, vib: 7 });
  // the figure pedals off: chain ticks gathering speed, a pizzicato run-up to the first frame
  const tick = c.bus({ gain: 0.8, room: 0.2 });
  for (let i = 0, t = 3.3; t < 4.98; i++, t += Math.max(0.11, 0.3 - i * 0.022)) c.Q(tick, S.drum, t, 'chain', 0.2 + i * 0.012);
  const pz = c.bus({ gain: 0.75, room: 0.3 });
  [[4.0, 62], [4.25, 64], [4.5, 66], [4.75, 69]].forEach(([t, m]) => c.Q(pz, S.pluck, t, m, 0.2, 0.6, { kind: 'pizz' }));
}

// ------------------------------------------------------------------------------------------- the 20 sections
const SEC = {
  // 1 — Saharan rock art: hand drums and chanting
  1(c, ph, ch) {
    const dr = c.bus({ gain: 0.95, room: 0.3 }), vox = c.bus({ gain: 0.8, room: 0.35, hall: 0.2 });
    for (let bar = 0; bar < 3; bar++) {
      const o = bar * 4;
      [[0, 'djembeBass', 1], [0.75, 'djembeSlap', 0.5], [1, 'djembeTone', 0.7], [1.5, 'djembeTone', 0.6], [2, 'djembeBass', 0.9], [2.5, 'djembeSlap', 0.7], [3, 'djembeTone', 0.7], [3.25, 'djembeTone', 0.5], [3.5, 'djembeSlap', 0.8]].forEach(([b, k, v]) => c.P(dr, S.drum, o + b, k, v));
      for (let b = 0; b < 4; b += 0.5) c.P(dr, S.drum, o + b, 'shaker', b % 1 ? 0.9 : 0.5);
      c.P(dr, S.drum, o + 1, 'clapHand', 0.5);
      c.P(dr, S.drum, o + 3, 'clapHand', 0.5);
    }
    c.P(dr, S.drum, 4, 'bigDrum', 0.8); // bar 2: the herders point
    // call (solo voice) and response (drone of the others)
    melody(c, vox, ph, S.chant, { oct: -1, vel: 0.62, len: 1 });
    for (const [b, d] of [[0, 4], [4, 4], [8, 4]]) c.P(vox, S.chant, b, 38, d * BEAT * 0.95, 0.3, { vowel: [450, 800, 2300] });
    const fl = c.bus({ gain: 0.42, hall: 0.4 });
    melody(c, fl, ph, S.wind, { vel: 0.5, opt: () => ({ kind: 'bone' }), skip: (b, d) => d < 1 });
  },
  // 2 — Egyptian wall painting: harp (holds its breath while the pelican strikes the pose, t = 2.5–3.6 s)
  2(c, ph, ch) {
    const hp = c.bus({ gain: 0.95, room: 0.3, hall: 0.3 }), pc = c.bus({ gain: 0.6, room: 0.3 });
    const frozen = (b) => b >= 5 && b < 7.4;
    melody(c, hp, ph, S.pluck, { vel: 0.8, len: 1.4, opt: () => ({ kind: 'harp' }), skip: frozen });
    melody(c, hp, ph, S.pluck, { oct: -1, vel: 0.45, len: 1.4, opt: () => ({ kind: 'harp' }), skip: (b, d) => frozen(b) || d < 1 });
    for (const [b, len, notes] of ch) {
      if (frozen(b + 1)) continue;
      notes.forEach((m, i) => c.P(hp, S.pluck, b + i * 0.06, m, 1.4, 0.42, { kind: 'harp' })); // rolled chord
    }
    // the freeze: one glissando up to a held shimmer, sistrum trembling, then on as if nothing happened
    [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86].forEach((m, i) => c.Q(hp, S.pluck, 2.5 + i * 0.035, m, 1.6, 0.42 + i * 0.02, { kind: 'harp' }));
    for (let t = 2.6; t < 3.55; t += 0.09) c.Q(pc, S.drum, t, 'sistrum', 0.35);
    for (let b = 0; b < 12; b += 1) if (!frozen(b)) c.P(pc, S.drum, b, b % 2 ? 'sistrum' : 'frame', b % 2 ? 0.5 : 0.75);
  },
  // 3 — Han stone rubbing: bronze chime bells, stone chimes, a great drum
  3(c, ph, ch) {
    const bl = c.bus({ gain: 0.85, hall: 0.45, room: 0.2 }), pc = c.bus({ gain: 0.7, hall: 0.3 });
    ph.forEach(([b, d, m]) => c.P(bl, S.bell, b, m, 0.62 * (b % 4 === 0 ? 1.1 : 0.9), { kind: 'chime' }));
    for (const [b, len, notes] of ch) c.P(bl, S.bell, b, notes[0], 0.6, { kind: 'chime', decay: 1.6 });
    for (let b = 0; b < 12; b += 2) c.P(pc, S.drum, b, 'bigDrum', b % 4 ? 0.45 : 0.8);
    for (let b = 1; b < 12; b += 2) c.P(pc, S.drum, b, 'stone', 0.5, { f: b % 4 === 1 ? 1760 : 2349 });
    c.P(pc, S.drum, 6, 'stone', 0.7, { f: 2637 }); // the attendant bows
  },
  // 4 — Tang baimiao: pipa (tremolo on the long notes; a sweeping flourish when the gust arrives)
  4(c, ph, ch) {
    const pp = c.bus({ gain: 0.9, room: 0.3, hall: 0.15 }), tk = c.bus({ gain: 0.5, room: 0.2 });
    ph.forEach(([b, d, m]) => {
      if (d >= 1) {
        const n = Math.round(d * 4); // lunzhi: rolling tremolo in sixteenths
        for (let i = 0; i < n; i++) c.P(pp, S.pluck, b + i * 0.25, m, 0.2, i ? 0.5 : 0.8, { kind: 'pipa' });
      } else c.P(pp, S.pluck, b, m, d * BEAT, 0.72, { kind: 'pipa', bendFrom: b % 1 ? -1 : 0 });
    });
    for (const [b, len, notes] of ch) notes.forEach((m, i) => c.P(pp, S.pluck, b + i * 0.03, m, 0.5, 0.5, { kind: 'pipa' }));
    [62, 66, 69, 74, 78, 81, 86, 90].forEach((m, i) => c.Q(pp, S.pluck, 2.0 + i * 0.028, m, 0.5, 0.5 + i * 0.03, { kind: 'pipa' })); // sao: the gust
    const sw = c.bus({ gain: 0.5, hall: 0.3 });
    c.Q(sw, S.swell, 1.9, 1.6, 0.22, { f0: 500, f1: 2600, q: 0.6, peak: 0.25 });
    chainTicks(c, tk, 0, 12, 0.22);
  },
  // 5 — Song landscape: guqin, low and sparse, with slides and harmonics as the camera finds the pelican
  5(c, ph, ch) {
    const gq = c.bus({ gain: 1.0, hall: 0.6, room: 0.2 });
    ph.forEach(([b, d, m], i) => {
      if (d < 1) return;
      c.P(gq, S.pluck, b, m - 12, d * BEAT * 1.6, 0.85, { kind: 'guqin', bendFrom: i % 2 ? -2 : 0, bendTime: 0.22, bendTo: i % 3 === 0 ? -2 : 0, bendAt: 0.45, vib: 10 });
    });
    for (const [b, len, notes] of ch) c.P(gq, S.pluck, b, notes[0] - 12, 2.2, 0.75, { kind: 'guqin' });
    const hm = c.bus({ gain: 0.5, hall: 0.7 });
    [[2.0, 86], [2.5, 81], [3.0, 78], [3.5, 81]].forEach(([t, m]) => c.Q(hm, S.bell, t, m, 0.4, { kind: 'kalimba', decay: 1.6, strike: 0.3 })); // harmonics
    const tk = c.bus({ gain: 0.3, hall: 0.3 });
    chainTicks(c, tk, 0, 12, 0.14, 1);
  },
  // 6 — Qingming scroll: bamboo flute, gongs and drums
  6(c, ph, ch) {
    const fl = c.bus({ gain: 0.82, room: 0.3, hall: 0.2 }), pc = c.bus({ gain: 0.72, room: 0.3 });
    melody(c, fl, ph, S.wind, { oct: 1, vel: 0.72, opt: (b, d, m, i) => ({ kind: 'dizi', from: d >= 1 ? m + 12 + 2 : null, glide: 0.05, trill: d >= 1.5 ? 2 : 0 }) });
    for (let bar = 0; bar < 3; bar++) {
      const o = bar * 4;
      [[0, 'smallGong', 0.6], [0, 'cymbals', 0.5], [1, 'bangu', 0.7], [1.5, 'bangu', 0.5], [2, 'cymbals', 0.45], [2.5, 'bangu', 0.6], [3, 'bangu', 0.7], [3.25, 'bangu', 0.5], [3.5, 'bangu', 0.6], [3.75, 'bangu', 0.5]].forEach(([b, k, v]) => c.P(pc, S.drum, o + b, k, v));
      c.P(pc, S.drum, o, 'bigDrum', 0.55);
      c.P(pc, S.drum, o + 2, 'bigDrum', 0.4);
    }
    c.P(pc, S.drum, 6, 'smallGong', 1.0); // the crest of the bridge: every head turns
    c.P(pc, S.drum, 6, 'cymbals', 0.8);
  },
  // 7 — Maya codex: ocarina over a wooden slit drum that knocks once per pedal stroke
  7(c, ph, ch) {
    const oc = c.bus({ gain: 0.78, room: 0.3, hall: 0.3 }), wd = c.bus({ gain: 0.9, room: 0.3 });
    melody(c, oc, ph, S.wind, { oct: 1, vel: 0.7, opt: () => ({ kind: 'ocarina' }) });
    for (let b = 0; b < 12; b++) {
      c.P(wd, S.drum, b, 'wood', 0.8, { f: b % 2 ? 147 : 196 });
      c.P(wd, S.drum, b + 0.5, 'wood', 0.3, { f: 294 });
    }
    c.P(wd, S.drum, 5, 'rattle', 0.9); // five dots become a bar
    c.P(wd, S.drum, 10, 'rattle', 0.9);
    c.P(wd, S.drum, 5, 'bigDrum', 0.6);
  },
  // 8 — Mughal miniature: sitar over a tanpura drone, tabla
  8(c, ph, ch) {
    const st = c.bus({ gain: 0.72, room: 0.3, hall: 0.2 }), tp = c.bus({ gain: 0.34, hall: 0.4 }), tb = c.bus({ gain: 0.85, room: 0.25 });
    melody(c, st, ph, S.pluck, { vel: 0.75, len: 1.2, opt: (b, d, m, i) => ({ kind: 'sitar', bendFrom: d >= 1 ? -2 : 0, bendTime: 0.16, bendTo: d >= 1.5 ? 2 : 0, bendAt: 0.3, vib: d >= 1 ? 14 : 0 }) });
    for (let b = 0; b < 12; b += 4) [45, 50, 50, 38].forEach((m, i) => c.P(tp, S.pluck, b + i, m, 2.5, 0.8, { kind: 'tanpura' }));
    for (let bar = 0; bar < 3; bar++) {
      const o = bar * 4;
      [[0, 'tablaGe', 0.9], [0, 'tablaNa', 0.6], [0.5, 'tablaTin', 0.5], [1, 'tablaNa', 0.7], [1.5, 'tablaKe', 0.5], [1.75, 'tablaNa', 0.4], [2, 'tablaGe', 0.8], [2.5, 'tablaTin', 0.5], [3, 'tablaNa', 0.7], [3.25, 'tablaKe', 0.4], [3.5, 'tablaNa', 0.6], [3.75, 'tablaGe', 0.5]].forEach(([b, k, v]) => c.P(tb, S.drum, o + b, k, v));
    }
    const sw = c.bus({ gain: 0.6, hall: 0.5 });
    [50, 57, 62, 66, 69, 74, 78, 81, 86].forEach((m, i) => c.Q(sw, S.pluck, 2.0 + i * 0.03, m, 1.5, 0.5, { kind: 'koto' })); // swarmandal sweep: everyone looks
  },
  // 9 — Bada Shanren: xiao. Almost nothing; a long silence for the eye roll
  9(c, ph, ch) {
    const xo = c.bus({ gain: 0.95, hall: 0.7, room: 0.2 });
    [[0, 3.2, 57], [4, 1.5, 59 + 0], [8, 2.5, 62], [10.5, 1.4, 57]].forEach(([b, d, m], i) => c.P(xo, S.wind, b, m, d * BEAT, 0.7, { kind: 'xiao', from: i === 2 ? 59 : null, glide: 0.3 }));
    const lo = c.bus({ gain: 0.7, hall: 0.6 });
    c.Q(lo, S.pluck, 2.5, 38, 2.4, 0.8, { kind: 'guqin', bendTo: 2, bendAt: 0.5, bendTime: 0.5 }); // the eye goes up
    c.Q(lo, S.drum, 3.5, 'wood', 0.35, { f: 392 });
  },
  // 10 — Javanese wayang kulit: gamelan
  10(c, ph, ch) {
    const sr = c.bus({ gain: 0.78, hall: 0.35, room: 0.25 }), gg = c.bus({ gain: 0.9, hall: 0.5 }), kd = c.bus({ gain: 0.7, room: 0.25 });
    ph.forEach(([b, d, m]) => {
      c.P(sr, S.bell, b, m, 0.62, { kind: 'saron', beat: 5 });
      // bonang elaboration: anticipate and repeat at double density an octave up
      for (let x = 0; x < d; x += 0.5) c.P(sr, S.bell, b + x + 0.25, m + 12, 0.3, { kind: 'bonang', beat: 6, decay: 0.6 });
    });
    c.P(gg, S.bell, 0, 38, 0.95, { kind: 'gong', beat: 2.2, decay: 1.1 });
    c.P(gg, S.bell, 4, 45, 0.6, { kind: 'gong', beat: 3, decay: 0.6 }); // kempul: the tree-of-life is flourished
    c.P(gg, S.bell, 8, 45, 0.5, { kind: 'gong', beat: 3, decay: 0.6 });
    c.P(gg, S.bell, 10, 50, 0.45, { kind: 'gong', beat: 3, decay: 0.5 });
    for (let bar = 0; bar < 3; bar++) {
      const o = bar * 4;
      [[0, 170, 0.8], [1, 230, 0.5], [1.5, 230, 0.4], [2, 170, 0.6], [2.75, 260, 0.5], [3, 230, 0.6], [3.5, 170, 0.5]].forEach(([b, f, v]) => c.P(kd, S.drum, o + b, 'kendang', v, { f }));
    }
  },
  // 11 — ukiyo-e: shamisen; a sudden shower from bar 2
  11(c, ph, ch) {
    const sm = c.bus({ gain: 0.9, room: 0.3 }), pc = c.bus({ gain: 0.7, room: 0.3 });
    melody(c, sm, ph, S.pluck, { vel: 0.85, opt: (b, d) => ({ kind: 'shamisen', bendFrom: d >= 1 ? -1 : 0, bendTime: 0.05 }) });
    for (const [b, len, notes] of ch) {
      c.P(sm, S.pluck, b, notes[0] + 12, 0.4, 0.6, { kind: 'shamisen' });
      c.P(sm, S.pluck, b + 0.5, notes[1] + 12, 0.3, 0.4, { kind: 'shamisen' });
    }
    for (let b = 0; b < 12; b += 2) c.P(pc, S.drum, b + 1, 'tsuzumi', 0.6);
    c.P(pc, S.drum, 4, 'taiko', 0.9);
    c.P(pc, S.drum, 8, 'taiko', 0.5);
    const rain = c.bus({ gain: 0.3, room: 0.2 });
    const s = c.sus(2.0, 3.4);
    if (s) S.swell(c.ctx, rain, s[0], s[1], 0.3, { type: 'highpass', f0: 3000, f1: 4500, q: 0.5, peak: 0.12, seed: 41 });
  },
  // 12 — The Starry Night: strings, rolling arpeggios, a swell when the stars flare
  12(c, ph, ch) {
    const vn = c.bus({ gain: 0.8, hall: 0.5, room: 0.2 }), ar = c.bus({ gain: 0.5, hall: 0.4 }), bs = c.bus({ gain: 0.8, room: 0.3 });
    melody(c, vn, ph, S.strings, { oct: 1, vel: 0.6, len: 1.05 });
    melody(c, vn, ph, S.strings, { vel: 0.42, len: 1.05 });
    for (const [b, len, notes] of ch) {
      for (let x = 0; x < len; x += 0.25) c.P(ar, S.strings, b + x, notes[[0, 1, 2, 3, 2, 1][Math.round(x * 4) % 6]] + 12, 0.11, 0.4, { att: 0.01, rel: 0.05, voices: 2, vib: 0 });
      c.P(bs, S.pluck, b, notes[0] - 12, 0.5, 0.9, { kind: 'pizz' });
      c.P(bs, S.pluck, b + len / 2, notes[1] - 12, 0.5, 0.6, { kind: 'pizz' });
    }
    const sw = c.sus(1.5, 1.6);
    if (sw) S.strings(c.ctx, vn, sw[0], 81, sw[1], 0.5, { att: 0.5, trem: 13, rel: 0.5 });
  },
  // 13 — The Scream: the same strings veer out of tune and shriek, then compose themselves
  13(c, ph, ch) {
    const vn = c.bus({ gain: 0.8, hall: 0.45, room: 0.2 }), bs = c.bus({ gain: 0.75, room: 0.3 });
    const t0 = c.t0;
    // sour → shriek around t = 1.0–2.6, back in tune by 3.4 (when the figure simply stops screaming)
    const pts = [[0.6, 0], [1.6, 70], [2.4, 135], [2.9, 60], [3.4, 0]];
    const sour = (time) => {
      const x = time - t0;
      if (x <= pts[0][0] || x >= pts[pts.length - 1][0]) return 0;
      for (let i = 0; i < pts.length - 1; i++) if (x < pts[i + 1][0]) return pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * (x - pts[i][0])) / (pts[i + 1][0] - pts[i][0]);
      return 0;
    };
    ph.forEach(([b, d, m]) => {
      const loud = b * BEAT >= 3.4 ? 0.36 : 0.62;
      c.P(vn, S.strings, b, m + 12, d * BEAT * 1.05, loud, { detuneFn: sour, bias: 0.5 });
      c.P(vn, S.strings, b, m, d * BEAT * 1.05, loud * 0.7, { detuneFn: sour, bias: -0.6 });
    });
    const sh = c.bus({ gain: 0.5, hall: 0.5 });
    const s = c.sus(1.0, 1.9);
    if (s) {
      // the shriek: a high cluster, tremolo, sliding apart
      [[86, 1.4], [87, -1.2], [91, 1.7], [94, -1.5]].forEach(([m, k]) => S.strings(c.ctx, sh, s[0], m, s[1], 0.5, { att: 0.9, trem: 15, lp: 9000, rel: 0.12, detuneFn: (time) => k * 160 * Math.min(1, Math.max(0, (time - t0 - 1.0) / 1.6)), bias: 1 }));
    }
    for (const [b, len, notes] of ch) c.P(bs, S.pluck, b, notes[0] - 12, 0.5, b >= 7 ? 0.5 : 0.8, { kind: 'pizz' });
    for (let b = 7; b < 12; b += 1) c.P(bs, S.pluck, b + 0.5, chordAt(ch, b)[2][2], 0.2, 0.35, { kind: 'pizz' }); // sheepish pizzicato
  },
  // 14 — Nosferatu: silent-film piano and pipe organ, the tune in D minor
  14(c, ph, ch) {
    const pn = c.bus({ gain: 0.85, room: 0.35 }), og = c.bus({ gain: 0.55, hall: 0.6 });
    melody(c, pn, ph, S.piano, { vel: 0.8, map: minor, opt: () => ({ honky: true }) });
    melody(c, pn, ph, S.piano, { oct: 1, vel: 0.5, map: minor, opt: () => ({ honky: true }), skip: (b, d) => d < 1 });
    const roots = [[0, 4, [38, 50, 53, 57]], [4, 4, [34, 46, 50, 53]], [8, 2, [31, 43, 46, 50]], [10, 2, [33, 45, 49, 52]]];
    for (const [b, len, notes] of roots) {
      // melodrama tremolo in the left hand
      for (let x = 0; x < len; x += 0.25) c.P(pn, S.piano, b + x, notes[Math.round(x * 4) % 2 ? 1 : 0], 0.1, 0.42, { honky: true, bright: 0.5 });
      notes.forEach((m) => c.P(og, S.organ, b, m, len * BEAT * 0.98, 0.5));
    }
    // the shadow powers up: a rising whine into the next frame
    const pw = c.bus({ gain: 0.6, room: 0.2 });
    if (c.ok(5.2)) {
      const v = S.synth(c.ctx, pw, c.t0 + 5.2, 50, 0.8, 0.5, { type: 'sine', att: 0.5, rel: 0.02, cutoff: 9000 });
      v.oscs[0].frequency.setValueAtTime(147, c.t0 + 5.2);
      v.oscs[0].frequency.exponentialRampToValueAtTime(880, c.t0 + 6.0);
    }
  },
  // 15 — oscilloscope: sine-wave buzz over valve hum; the pitch warps while the wrong knob is turned (t = 2.0–2.5)
  15(c, ph, ch) {
    const sn = c.bus({ gain: 0.75, room: 0.15 }), hm = c.bus({ gain: 0.9 }), ck = c.bus({ gain: 0.5, room: 0.15 });
    const s = c.sus(0, 6);
    if (s) S.hum(c.ctx, hm, s[0], s[1], 50, 0.11, [1, 0.7, 0.4, 0.2, 0.12]);
    c.Q(ck, S.drum, 0, 'click', 0.9, { f: 1800 }); // relay: the tube strikes
    const w0 = c.t0 + 2.0, w1 = c.t0 + 2.5;
    ph.forEach(([b, d, m]) => {
      const tl = b * BEAT;
      if (!c.ok(tl)) return;
      const v = S.synth(c.ctx, sn, c.t0 + tl, m, d * BEAT * 0.95, 0.62, { type: 'sine', att: 0.012, rel: 0.03, cutoff: 12000 });
      const v2 = S.synth(c.ctx, sn, c.t0 + tl, m + 12, d * BEAT * 0.95, 0.13, { type: 'triangle', att: 0.012, rel: 0.03, cutoff: 8000 });
      const end = c.t0 + tl + d * BEAT;
      if (end > w0 && c.t0 + tl < w1) {
        // Lissajous: the pitch is flung about at two unrelated rates until the knob is turned back
        for (const o of [...v.oscs, ...v2.oscs]) {
          for (let x = Math.max(w0, c.t0 + tl), i = 0; x < w1; x += 0.02, i++) o.detune.setValueAtTime(900 * Math.sin((x - w0) * 37) + 700 * Math.sin((x - w0) * 23 + 1), x);
          o.detune.setValueAtTime(0, w1);
        }
      }
    });
    const lz = c.bus({ gain: 0.5 });
    if (c.ok(2.0)) {
      for (const [f, r] of [[330, 47], [495, 31]]) {
        const v = S.synth(c.ctx, lz, w0, 69, 0.48, 0.5, { type: 'sine', att: 0.005, rel: 0.01, cutoff: 12000 });
        v.oscs[0].frequency.setValueAtTime(f, w0);
        for (let x = w0; x < w1; x += 0.015) v.oscs[0].frequency.setValueAtTime(f * (1 + 0.5 * Math.sin((x - w0) * r)), x);
      }
    }
    c.Q(ck, S.drum, 2.0, 'click', 1.0, { f: 2400 });
    c.Q(ck, S.drum, 2.5, 'click', 1.0, { f: 1500 });
    for (let b = 0; b < 12; b += 1) c.P(ck, S.drum, b, 'click', 0.22, { f: 5200 });
  },
  // 16 — 8-bit: two squares, a triangle and noise; original jump, coin and 1UP jingles
  16(c, ph, ch) {
    const sq = c.bus({ gain: 0.5 }), tr = c.bus({ gain: 0.75 }), nz = c.bus({ gain: 0.55 }), fx = c.bus({ gain: 0.55 });
    const p25 = S.pulseWave(c.ctx, 0.25), p12 = S.pulseWave(c.ctx, 0.125), p50 = S.pulseWave(c.ctx, 0.5);
    const chip = (busNode, tl, m, d, v, wave, o = {}) => c.Q(busNode, S.synth, tl, m, d, v, { type: wave, att: 0.002, dec: 0.05, sus: 0.7, rel: 0.01, cutoff: 14000, ...o });
    const hold = (tl) => tl >= 2.05 && tl < 3.4; // the lead rests while the sound effects play
    ph.forEach(([b, d, m]) => !hold(b * BEAT) && chip(sq, b * BEAT, m + 12, d * BEAT * 0.9, 0.6, p25, { vib: d >= 1 ? 14 : 0, vibDelay: 0.18, vibHz: 7 }));
    for (const [b, len, notes] of ch) {
      // square 2: fast broken chords; triangle: octave-jumping bass
      for (let x = 0; x < len; x += 0.125) chip(sq, (b + x) * BEAT, notes[[1, 2, 3][Math.round(x * 8) % 3]] + 12, 0.055, 0.3, p12);
      for (let x = 0; x < len; x += 0.5) chip(tr, (b + x) * BEAT, notes[0] - 12 + (Math.round(x * 2) % 2 ? 12 : 0), 0.2, 0.9, 'triangle');
    }
    for (let b = 0; b < 12; b += 0.5) {
      const beat = b % 2;
      if (beat === 0) c.P(nz, S.drum, b, 'chipNoise', 0.9, { rate: 0.12, tau: 0.05 });
      else if (beat === 1) c.P(nz, S.drum, b, 'chipNoise', 0.8, { rate: 0.7, tau: 0.045 });
      else c.P(nz, S.drum, b, 'chipNoise', 0.35, { rate: 1.6, tau: 0.012 });
    }
    // jump: a rising square sweep (t = 2.1)
    if (c.ok(2.1)) {
      const v = S.synth(c.ctx, fx, c.t0 + 2.1, 64, 0.2, 0.6, { type: p50, att: 0.002, rel: 0.01, cutoff: 14000 });
      v.oscs[0].frequency.setValueAtTime(330, c.t0 + 2.1);
      v.oscs[0].frequency.exponentialRampToValueAtTime(990, c.t0 + 2.3);
    }
    // coin (t = 2.5): our own little figure — a leap of a sixth, then the octave, duty flipping
    [[0, 81, p12, 0.05], [0.05, 90, p25, 0.05], [0.1, 93, p50, 0.26]].forEach(([dt, m, wv, d]) => chip(fx, 2.5 + dt, m, d, 0.6, wv));
    // 1UP (t = 3.0): the film's melody, first six notes, at four times the speed
    [69, 71, 74, 76, 74, 81].forEach((m, i) => chip(fx, 3.0 + i * 0.065, m + 12, 0.06, 0.6, p25));
    c.Q(nz, S.drum, 2.9, 'chipNoise', 0.7, { rate: 0.25, tau: 0.04 }); // landing
  },
  // 17 — early chat window: polyphonic-ringtone tune, message blips for percussion
  17(c, ph, ch) {
    const ld = c.bus({ gain: 0.62, room: 0.1 }), cd = c.bus({ gain: 0.42, room: 0.1 }), ui = c.bus({ gain: 0.7, room: 0.1 });
    melody(c, ld, ph, S.fm, { oct: 1, vel: 0.7, opt: () => ({ ratio: 3.5, index: 1.6, indexDecay: 0.08, decay: 0.3 }), skip: (b) => b >= 4 && b < 4.8 });
    for (const [b, len, notes] of ch) {
      for (let x = 0; x < len; x += 1) notes.slice(1).forEach((m) => c.P(cd, S.fm, b + x + 0.5, m + 12, 0.16, 0.5, { ratio: 1, index: 1.2, decay: 0.12 }));
      for (let x = 0; x < len; x += 1) c.P(cd, S.fm, b + x, notes[0], 0.2, 0.9, { ratio: 1, index: 0.8, decay: 0.16 });
    }
    const pip = (tl, m, v = 0.6, d = 0.07) => c.Q(ui, S.fm, tl, m, d, v, { ratio: 2, index: 0.6, decay: 0.07 });
    // file received (t = 0): three rising pips
    [[0, 86], [0.07, 90], [0.14, 93]].forEach(([dt, m]) => pip(dt, m, 0.7));
    // percussion: an "incoming message" two-note blip on the backbeats
    for (let b = 1; b < 12; b += 2) {
      if (b === 5) continue;
      pip(b * BEAT, 88, 0.4);
      pip(b * BEAT + 0.08, 83, 0.4);
    }
    // nudge (t = 2.0): the window rattles
    for (let i = 0; i < 11; i++) c.Q(ui, S.synth, 2.0 + i * 0.034, i % 2 ? 43 : 46, 0.02, 0.8, { type: 'square', att: 0.001, rel: 0.005, cutoff: 1800 });
    // typing… (t = 2.5–3.9): dry little ticks
    for (let tl = 2.5, i = 0; tl < 3.9; tl += 0.11 + 0.05 * ((i * 7) % 3), i++) c.Q(ui, S.drum, tl, 'click', 0.3, { f: 2600 + (i % 4) * 300 });
    // the reply pops in (t = 4.0)
    [[4.0, 81], [4.09, 88]].forEach(([tl, m]) => pip(tl, m, 0.8, 0.12));
  },
  // 18 — vaporwave: see audio/vapor.js
  18(c) {
    scheduleVapor(c);
  },
  // 19 — vertical short video: a punchy pop beat that slams in with the black bars (t = 1.0)
  19(c, ph, ch) {
    const dr = c.bus({ gain: 0.95, room: 0.12 }), bs = c.bus({ gain: 0.9 }), ld = c.bus({ gain: 0.6, room: 0.25, hall: 0.2 }), fx = c.bus({ gain: 0.6, hall: 0.3 });
    // bar 1 before the slam: thin, "phone speaker" version; a riser
    for (let b = 0; b < 2; b += 0.5) c.P(dr, S.drum, b, 'hat', 0.5);
    const r = c.sus(0, 1.0);
    if (r) S.swell(c.ctx, fx, r[0], r[1], 0.4, { type: 'bandpass', f0: 400, f1: 7000, q: 1.2, peak: 0.97 });
    c.Q(dr, S.drum, 1.0, 'kick', 1.0);
    c.Q(dr, S.drum, 1.0, 'clap', 0.9);
    c.Q(fx, S.drum, 1.0, 'cymbals', 0.5);
    for (let b = 2; b < 12; b += 0.5) {
      if (b % 1 === 0) c.P(dr, S.drum, b, 'kick', 1.0); // four on the floor
      if (b % 2 === 1) c.P(dr, S.drum, b, 'clap', 0.8);
      if (b % 1) c.P(dr, S.drum, b, 'hat', 0.7, { open: b % 2 === 1.5 }); // off-beat hat
      c.P(dr, S.drum, b + 0.25, 'hat', 0.25);
    }
    for (const [b, len, notes] of ch) {
      for (let x = 0; x < len; x += 1) {
        if (b + x < 2) continue;
        // bass ducks under each kick (side-chain feel): it answers on the off-beats
        c.P(bs, S.synth, b + x + 0.5, notes[0] - 12, 0.2, 0.9, { type: 'sine', att: 0.005, rel: 0.03, cutoff: 6000, from: notes[0] - 12 + (x === 0 ? 7 : 0), glide: 0.04 });
        c.P(bs, S.synth, b + x + 0.5, notes[0], 0.2, 0.3, { type: 'sawtooth', att: 0.005, rel: 0.03, cutoff: 900 });
      }
    }
    ph.forEach(([b, d, m]) => {
      if (b < 2) return c.P(ld, S.synth, b, m + 12, d * BEAT * 0.5, 0.3, { type: 'triangle', pluck: 0.1, cutoff: 3000 });
      c.P(ld, S.synth, b, m + 12, d * BEAT * 0.8, 0.62, { type: 'sawtooth', voices: 3, spread: 16, cutoff: 2600, envAmt: 5000, envDecay: 0.09, att: 0.004, dec: 0.12, sus: 0.5, rel: 0.06 });
      c.P(ld, S.synth, b + 0.75, m + 12, 0.1, 0.22, { type: 'sawtooth', voices: 2, cutoff: 2200, pluck: 0.1 }); // echo
    });
    [[2.0, 93], [2.06, 98], [2.12, 102]].forEach(([tl, m]) => c.Q(fx, S.bell, tl, m, 0.35, { kind: 'glock' })); // the double-tap heart
    const out = c.sus(5.5, 0.5);
    if (out) S.swell(c.ctx, fx, out[0], out[1], 0.35, { type: 'highpass', f0: 1500, f1: 9000, peak: 0.98 }); // sucked into the next frame
  },
  // 20 — code aesthetics: clean piano and synth
  20(c, ph, ch) {
    const pn = c.bus({ gain: 0.9, hall: 0.35, room: 0.2 }), pd = c.bus({ gain: 0.42, hall: 0.5 }), ar = c.bus({ gain: 0.42, hall: 0.45 }), ui = c.bus({ gain: 0.35, room: 0.2 });
    melody(c, pn, ph, S.piano, { vel: 0.72, len: 1.1, opt: () => ({ bright: 0.7 }) });
    for (const [b, len, notes] of ch) {
      const ext = [...notes, notes[1] + 14]; // add the ninth
      ext.forEach((m) => c.P(pd, S.synth, b, m, len * BEAT, 0.42, { type: 'sawtooth', voices: 2, spread: 8, cutoff: 1100, att: 0.25, sus: 0.9, rel: 0.3 }));
      c.P(pn, S.piano, b, notes[0] - 12, len * BEAT, 0.5, { bright: 0.5 });
      for (let x = 0; x < len; x += 0.25) c.P(ar, S.synth, b + x, ext[[0, 2, 4, 3, 1, 3, 4, 2][Math.round(x * 4) % 8]] + 12, 0.08, 0.5, { type: 'sine', pluck: 0.14, cutoff: 9000 });
    }
    // one soft key-click per line of code as it appears; a small chord when the fills arrive; a chime for "✓ valid"
    for (let tl = 0.3; tl < 4.0; tl += 0.16) c.Q(ui, S.drum, tl, 'click', 0.22, { f: 3800 });
    [74, 78, 81].forEach((m, i) => c.Q(ar, S.bell, 2.0 + i * 0.02, m + 12, 0.35, { kind: 'glock' }));
    [[4.0, 86], [4.12, 93]].forEach(([tl, m]) => c.Q(ar, S.bell, tl, m, 0.5, { kind: 'glock', decay: 1.6 }));
  },
};

// ------------------------------------------------------------------------------------------- outro (12 s)
// Instruments from every era play the melody together; they fade as the camera pushes in on the empty chair,
// flash bulbs pop on the strong beats, and at the end a single bicycle bell rings.
function outro(c) {
  const ph = [...PHRASE_A, ...PHRASE_B.map(([b, d, m]) => [b + 12, d, m])];
  const fade = S.bus(c.ctx, c.M, { gain: 1 });
  // one fader for the whole orchestra: full until the push-in begins (3.6 s), gone by 8 s
  const g = fade.gain, t0 = c.t0;
  g.setValueAtTime(1, t0 + Math.max(0, c.from));
  g.setValueAtTime(1, t0 + Math.max(3.6, c.from));
  g.linearRampToValueAtTime(0.0001, t0 + 8.0);
  const sub = (o) => {
    const b = c.ctx.createGain();
    b.gain.value = o.gain ?? 1;
    b.connect(fade);
    if (o.room) {
      const s = c.ctx.createGain();
      s.gain.value = o.room;
      b.connect(s).connect(c.M.room);
      s.gain.setValueAtTime(o.room, t0 + Math.max(3.6, c.from));
      s.gain.linearRampToValueAtTime(0.0001, t0 + 8.0);
    }
    return b;
  };
  const tutti = [
    [sub({ gain: 0.5, room: 0.3 }), S.pluck, 0, () => ({ kind: 'harp' })],
    [sub({ gain: 0.4, room: 0.4 }), S.bell, 0, () => ({ kind: 'chime' })],
    [sub({ gain: 0.42, room: 0.2 }), S.pluck, 0, () => ({ kind: 'pipa' })],
    [sub({ gain: 0.4, room: 0.3 }), S.wind, 1, () => ({ kind: 'dizi' })],
    [sub({ gain: 0.34, room: 0.2 }), S.pluck, 0, () => ({ kind: 'sitar' })],
    [sub({ gain: 0.4, room: 0.2 }), S.pluck, 0, () => ({ kind: 'shamisen' })],
    [sub({ gain: 0.5, room: 0.4 }), S.strings, 1, () => ({})],
    [sub({ gain: 0.42, room: 0.3 }), S.strings, 0, () => ({})],
    [sub({ gain: 0.45, room: 0.2 }), S.piano, 0, () => ({ honky: true })],
    [sub({ gain: 0.2 }), S.synth, 1, () => ({ type: S.pulseWave(c.ctx, 0.25), att: 0.002, rel: 0.01, cutoff: 12000 })],
    [sub({ gain: 0.3, room: 0.3 }), S.bell, 1, () => ({ kind: 'saron', beat: 5 })],
  ];
  for (const [b, d, m] of ph) {
    for (const [busNode, fn, oct, opt] of tutti) {
      if (fn === S.bell) c.P(busNode, fn, b, m + oct * 12, 0.6, opt());
      else c.P(busNode, fn, b, m + oct * 12, d * BEAT * 0.95, 0.7, opt());
    }
  }
  const dr = sub({ gain: 0.75, room: 0.3 }), lo = sub({ gain: 0.7, room: 0.3 });
  for (let bar = 0; bar < 4; bar++) {
    const o = bar * 4, ch = bar < 3 ? CH_A : CH_B;
    const root = chordAt(bar < 3 ? CH_A : CH_B, bar < 3 ? o : o - 12)[2][0];
    [[0, 'bigDrum', 0.9], [1, 'djembeTone', 0.6], [1.5, 'tablaNa', 0.5], [2, 'bigDrum', 0.6], [2.5, 'djembeSlap', 0.5], [3, 'djembeTone', 0.6], [3.5, 'bangu', 0.6], [0, 'cymbals', bar === 0 ? 0.7 : 0.3], [1, 'clapHand', 0.5], [3, 'clapHand', 0.5]].forEach(([b, k, v]) => c.P(dr, S.drum, o + b, k, v));
    c.P(lo, S.strings, o, root - 12, 1.9, 0.8, { lp: 700, att: 0.05 });
    c.P(lo, S.organ, o, root, 1.9, 0.4);
    void ch;
  }
  ding(c, 0.5);
  // camera flashes on the strong beats of bars 3–4 (not faded: they belong to the room, not the orchestra)
  const fl = c.bus({ gain: 0.6, room: 0.5 });
  [4.0, 5.0, 5.12, 6.0, 7.0, 7.14].forEach((t, i) => c.Q(fl, S.drum, t, 'flash', i % 3 === 2 ? 0.5 : 0.85));
  // room tone under "The pelican itself has yet to comment."
  const rt = c.bus({ gain: 0.3, hall: 0.4 });
  const s = c.sus(7.4, 2.5);
  if (s) S.strings(c.ctx, rt, s[0], 38, s[1], 0.3, { lp: 500, att: 1.2, rel: 0.4, vib: 3 });
  // the final beat (10 s): it tears past — a whoosh, chain whirr, and one ring of the bell
  const end = c.bus({ gain: 1.0, room: 0.35, hall: 0.35 });
  const w = c.sus(9.86, 0.75);
  if (w) S.swell(c.ctx, end, w[0], w[1], 0.5, { type: 'bandpass', f0: 500, f1: 2600, q: 0.9, peak: 0.3, seed: 51 });
  for (let i = 0; i < 9; i++) c.Q(end, S.drum, 9.96 + i * 0.04, 'chain', 0.45 * (1 - i / 11));
  c.Q(end, S.bikeBell, 10.0, 0.8, 1);
}

// ------------------------------------------------------------------------------------------- public
export const SEGMENTS = [{ name: 'intro', start: 0, dur: INTRO }];
for (let i = 1; i <= 20; i++) SEGMENTS.push({ name: 's' + String(i).padStart(2, '0'), index: i, start: INTRO + (i - 1) * SECTION, dur: SECTION });
SEGMENTS.push({ name: 'outro', start: T_OUTRO, dur: DURATION - T_OUTRO });

/**
 * Schedule one segment. t0 = context time at which the segment's own time 0 falls; from = seconds into the segment
 * before which nothing is scheduled. M = master chain from synth.master(). vapor = pre-rendered tape (see vapor.js).
 */
export function schedule(ctx, M, seg, t0, from = 0, extras = {}) {
  const c = ctxFor(ctx, M, t0, from, TRIM[seg.index] ?? 1);
  c.extras = extras;
  if (seg.name === 'intro') return intro(c);
  if (seg.name === 'outro') return outro(c);
  const i = seg.index;
  SEC[i](c, phrase(i), chords(i));
  if (i !== 18) ding(c, i === 9 || i === 5 ? 0.4 : 0.55); // the bell at each frame crossing
  else ding(c, 0.45);
}
