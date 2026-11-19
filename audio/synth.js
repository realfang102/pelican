// audio/synth — every sound in the film, synthesised from oscillators, noise and short computed buffers.
// All functions take a BaseAudioContext, so the same code feeds the live preview (AudioContext) and the
// offline render (OfflineAudioContext). Nothing is sampled or recorded; randomness is seeded.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------------------------------- per-context caches
const caches = new WeakMap();
function cache(ctx) {
  let c = caches.get(ctx);
  if (!c) caches.set(ctx, (c = { buf: new Map(), wave: new Map() }));
  return c;
}
function buffer(ctx, key, make) {
  const c = cache(ctx);
  let b = c.buf.get(key);
  if (!b) c.buf.set(key, (b = make()));
  return b;
}

export function noiseBuffer(ctx, seconds = 2, seed = 1) {
  return buffer(ctx, `noise${seconds}|${seed}`, () => {
    const n = Math.floor(seconds * ctx.sampleRate), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = rng(seed);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return b;
  });
}

/** impulse response: seeded noise with exponential decay (stereo, decorrelated) */
export function impulse(ctx, seconds, seed = 3, bright = 0.5, gate = 0) {
  return buffer(ctx, `ir${seconds}|${seed}|${bright}|${gate}`, () => {
    const n = Math.floor(seconds * ctx.sampleRate), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), r = rng(seed + ch * 101);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        let e = Math.pow(1 - t, 2.2) * Math.exp(-3.2 * t);
        if (gate) e = t < gate ? 1 - 0.3 * (t / gate) : 0; // gated reverb: flat, then cut dead
        const x = (r() * 2 - 1) * e;
        lp += (x - lp) * (0.15 + 0.85 * bright * (1 - t * 0.7));
        d[i] = lp;
      }
    }
    return b;
  });
}

/** Karplus-Strong plucked string rendered into a buffer (cached). bright 0..1, damp → decay, pos = pluck position 0..0.5 */
export function pluckBuffer(ctx, freq, { dur = 2.5, bright = 0.6, damp = 0.5, pos = 0.2, seed = 1, stiff = 0 } = {}) {
  const key = `ks${freq.toFixed(2)}|${dur}|${bright}|${damp}|${pos}|${seed}|${stiff}`;
  return buffer(ctx, key, () => {
    const sr = ctx.sampleRate, n = Math.floor(dur * sr), b = ctx.createBuffer(1, n, sr), out = b.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq)), line = new Float32Array(N), r = rng(seed + Math.round(freq));
    // excitation: noise, low-passed by "bright", comb-filtered by pluck position
    let lp = 0;
    for (let i = 0; i < N; i++) {
      lp += (r() * 2 - 1 - lp) * (0.08 + 0.9 * bright);
      line[i] = lp;
    }
    const p = Math.max(1, Math.round(N * pos));
    for (let i = N - 1; i >= p; i--) line[i] -= line[i - p] * 0.9;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += line[i];
    mean /= N;
    for (let i = 0; i < N; i++) line[i] -= mean;
    const loss = 1 - (0.0006 + 0.012 * damp) * (freq / 220 + 0.4);
    const s = 0.5 - 0.3 * stiff;
    let idx = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const cur = line[idx];
      const y = (cur * s + prev * (1 - s)) * loss;
      out[i] = cur;
      prev = cur;
      line[idx] = y;
      idx = (idx + 1) % N;
    }
    // normalise
    let pk = 0;
    for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i]));
    if (pk > 0) for (let i = 0; i < n; i++) out[i] /= pk;
    return b;
  });
}

function periodic(ctx, key, harmonics) {
  const c = cache(ctx);
  let w = c.wave.get(key);
  if (!w) {
    const real = new Float32Array(harmonics.length + 1), imag = new Float32Array(harmonics.length + 1);
    harmonics.forEach((a, i) => (imag[i + 1] = a));
    c.wave.set(key, (w = ctx.createPeriodicWave(real, imag)));
  }
  return w;
}
/** pulse wave with a duty cycle (chiptune squares) */
export function pulseWave(ctx, duty = 0.5) {
  const h = [];
  for (let k = 1; k <= 40; k++) h.push((2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty));
  return periodic(ctx, 'pulse' + duty, h);
}

// ------------------------------------------------------------------------------------------- small node helpers
const G = (ctx, v = 1) => {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
};
function adsr(p, t, a, d, s, r, peak, hold) {
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(peak * s, t + a, Math.max(0.005, d / 3));
  const off = t + Math.max(a + 0.01, hold);
  p.setTargetAtTime(0.0001, off, Math.max(0.005, r / 3));
  return off + r * 2;
}
function perc(p, t, a, tau, peak) {
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(0.0001, t + a, tau);
}
function osc(ctx, type, f, t0, t1, out) {
  const o = ctx.createOscillator();
  if (typeof type === 'string') o.type = type;
  else o.setPeriodicWave(type);
  o.frequency.value = f;
  o.connect(out);
  o.start(t0);
  o.stop(t1);
  return o;
}
function noise(ctx, t0, t1, out, seed = 1, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, 2, seed);
  s.loop = true;
  s.playbackRate.value = rate;
  s.connect(out);
  s.start(t0, (seed * 0.137) % 1.5);
  s.stop(t1);
  return s;
}
function filt(ctx, type, f, q = 0.7) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}
function shaper(ctx, amount) {
  const c = cache(ctx);
  const key = 'ws' + amount;
  let curve = c.buf.get(key);
  if (!curve) {
    curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 512 - 1) * amount;
      curve[i] = Math.tanh(x) / Math.tanh(amount);
    }
    c.buf.set(key, curve);
  }
  const w = ctx.createWaveShaper();
  w.curve = curve;
  return w;
}
export function pan(ctx, out, v) {
  if (!v || !ctx.createStereoPanner) return out;
  const p = ctx.createStereoPanner();
  p.pan.value = v;
  p.connect(out);
  return p;
}

// ------------------------------------------------------------------------------------------- plucked strings
const PLUCK = {
  harp: { bright: 0.42, damp: 0.25, pos: 0.32, dur: 3, lp: 5200 },
  pipa: { bright: 0.95, damp: 0.75, pos: 0.09, dur: 1.4, lp: 9000, click: 0.5 },
  guqin: { bright: 0.3, damp: 0.12, pos: 0.4, dur: 4, lp: 2600, stiff: 0.3 },
  sitar: { bright: 0.9, damp: 0.3, pos: 0.06, dur: 3, lp: 7000, buzz: 1 },
  tanpura: { bright: 0.75, damp: 0.1, pos: 0.07, dur: 4, lp: 5000, buzz: 0.6 },
  shamisen: { bright: 0.85, damp: 0.9, pos: 0.12, dur: 1.2, lp: 6500, click: 1, skin: 1 },
  koto: { bright: 0.7, damp: 0.4, pos: 0.15, dur: 2.5, lp: 7000 },
  pizz: { bright: 0.35, damp: 1.0, pos: 0.3, dur: 0.8, lp: 3200 },
};
/**
 * Plucked string. o: { kind, bendFrom (semitones: slide into the note), bendTo + bendAt (slide away), vib }
 */
export function pluck(ctx, out, t, midi, dur, vel = 0.8, o = {}) {
  const P = PLUCK[o.kind ?? 'harp'];
  const f = mtof(midi);
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(ctx, f, P);
  const g = G(ctx, 0), lp = filt(ctx, 'lowpass', P.lp, 0.5);
  let node = src;
  if (P.buzz) {
    // jawari: the string buzzes against a wide bridge — bright, nasal, slowly blooming
    const ws = shaper(ctx, 6), pre = G(ctx, 0.9 * P.buzz), hp = filt(ctx, 'highpass', 500, 0.7), mix = G(ctx, 0.55);
    src.connect(pre).connect(ws).connect(hp).connect(mix).connect(lp);
    const body = filt(ctx, 'peaking', 1400, 1.2);
    body.gain.value = 7;
    src.connect(body).connect(lp);
    node = null;
  }
  if (node) node.connect(lp);
  lp.connect(g).connect(out);
  const end = Math.min(P.dur, Math.max(0.25, dur + 0.9));
  g.gain.setValueAtTime(vel, t);
  g.gain.setTargetAtTime(0.0001, t + Math.max(0.05, dur), P === PLUCK.guqin || P === PLUCK.harp ? 0.5 : 0.18);
  if (o.bendFrom) {
    src.playbackRate.setValueAtTime(Math.pow(2, o.bendFrom / 12), t);
    src.playbackRate.exponentialRampToValueAtTime(1, t + (o.bendTime ?? 0.14));
  }
  if (o.bendTo) {
    const at = t + (o.bendAt ?? dur * 0.5);
    src.playbackRate.setValueAtTime(1, at);
    src.playbackRate.exponentialRampToValueAtTime(Math.pow(2, o.bendTo / 12), at + (o.bendTime ?? 0.16));
  }
  if (o.vib) {
    const l = osc(ctx, 'sine', 5.5, t, t + end + 0.2, G(ctx, 0)), d = G(ctx, o.vib);
    l.disconnect();
    l.connect(d).connect(src.detune);
  }
  src.start(t);
  src.stop(t + end + 0.6);
  if (P.click) {
    // plectrum / nail attack
    const cg = G(ctx, 0), bp = filt(ctx, 'bandpass', P.skin ? 1500 : 3500, 1.2);
    noise(ctx, t, t + 0.06, bp, 7);
    bp.connect(cg).connect(out);
    perc(cg.gain, t, 0.001, 0.012, vel * 0.5 * P.click);
  }
  if (P.skin) {
    // shamisen: the plectrum also strikes the skin — a short thud
    const og = G(ctx, 0), o2 = osc(ctx, 'sine', 180, t, t + 0.12, og);
    o2.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    og.connect(out);
    perc(og.gain, t, 0.001, 0.025, vel * 0.5);
  }
}

// ------------------------------------------------------------------------------------------- struck metal
const BELLS = {
  // [frequency ratio, gain, decay seconds]
  chime: [[1, 1, 2.6], [1.19, 0.5, 1.6], [2.0, 0.45, 1.3], [2.62, 0.3, 0.9], [3.4, 0.22, 0.6], [4.5, 0.14, 0.4], [5.7, 0.08, 0.25]], // bronze chime bell
  saron: [[1, 1, 1.4], [2.76, 0.55, 0.7], [5.4, 0.3, 0.35], [8.9, 0.14, 0.16]], // gamelan bronze bar
  bonang: [[1, 1, 1.0], [1.52, 0.5, 0.7], [3.1, 0.3, 0.4], [4.3, 0.2, 0.25]],
  gong: [[1, 1, 5], [1.48, 0.7, 4], [2.02, 0.5, 3], [2.57, 0.3, 2], [3.2, 0.2, 1.4], [4.1, 0.12, 0.9]],
  bike: [[1, 1, 1.5], [1.51, 0.75, 1.2], [2.33, 0.55, 0.9], [3.42, 0.4, 0.6], [4.9, 0.25, 0.4], [6.7, 0.14, 0.25]], // bicycle bell dome
  glock: [[1, 1, 0.9], [2.76, 0.4, 0.4], [5.4, 0.18, 0.2]],
  kalimba: [[1, 1, 0.7], [5.9, 0.25, 0.1], [2.0, 0.2, 0.3]],
};
export function bell(ctx, out, t, midi, vel = 0.7, o = {}) {
  const set = BELLS[o.kind ?? 'chime'], f = typeof o.freq === 'number' ? o.freq : mtof(midi), k = o.decay ?? 1;
  const beat = o.beat ?? 0; // Hz: paired tuning shimmer (gamelan "ombak")
  for (const [ratio, gain, dec] of set) {
    for (const df of beat ? [0, beat] : [0]) {
      const g = G(ctx, 0);
      osc(ctx, 'sine', f * ratio + df, t, t + dec * k * 4 + 0.1, g);
      g.connect(out);
      perc(g.gain, t, 0.002, dec * k * 0.55, (vel * gain) / (beat ? 2.6 : 2.2));
    }
  }
  // strike transient
  const cg = G(ctx, 0), bp = filt(ctx, 'bandpass', Math.min(9000, f * 3.5), 0.8);
  noise(ctx, t, t + 0.05, bp, 11);
  bp.connect(cg).connect(out);
  perc(cg.gain, t, 0.001, 0.008, vel * 0.25 * (o.strike ?? 1));
}

/** the film's signature: a bicycle bell — two quick strikes of a bright little dome */
export function bikeBell(ctx, out, t, vel = 0.6, strikes = 2) {
  for (let i = 0; i < strikes; i++) {
    bell(ctx, out, t + i * 0.105, 0, vel * (i ? 0.85 : 1), { kind: 'bike', freq: 2140 * (i ? 1.004 : 1), decay: strikes === 1 ? 1.5 : 0.9, strike: 1.6 });
    bell(ctx, out, t + i * 0.105, 0, vel * 0.3, { kind: 'bike', freq: 3190, decay: 0.7, strike: 0 });
  }
}

// ------------------------------------------------------------------------------------------- winds
const WIND = {
  dizi: { harm: [1, 0.55, 0.45, 0.2, 0.16, 0.06], breath: 0.12, bp: 2.2, att: 0.03, vibHz: 5.8, vib: 12, chiff: 0.4, buzz: 0.25 },
  xiao: { harm: [1, 0.3, 0.08, 0.03], breath: 0.4, bp: 1.5, att: 0.16, vibHz: 4.6, vib: 14, chiff: 0.15 },
  ocarina: { harm: [1, 0.08, 0.03], breath: 0.14, bp: 1.2, att: 0.045, vibHz: 5, vib: 6, chiff: 0.3 },
  bone: { harm: [1, 0.2, 0.25, 0.05], breath: 0.5, bp: 1.4, att: 0.08, vibHz: 4, vib: 8, chiff: 0.3 },
  sax: { harm: [1, 0.8, 0.6, 0.5, 0.3, 0.25, 0.15, 0.1], breath: 0.1, bp: 2, att: 0.05, vibHz: 5.2, vib: 16, chiff: 0.2 },
};
export function wind(ctx, out, t, midi, dur, vel = 0.7, o = {}) {
  const W = WIND[o.kind ?? 'dizi'], f = mtof(midi), end = t + dur + 0.25;
  const g = G(ctx, 0);
  const w = periodic(ctx, 'wind' + (o.kind ?? 'dizi'), W.harm);
  const os = osc(ctx, w, f, t, end, g);
  if (o.from) {
    os.frequency.setValueAtTime(mtof(o.from), t);
    os.frequency.exponentialRampToValueAtTime(f, t + (o.glide ?? 0.07));
  }
  if (o.trill) {
    // rapid alternation with the upper neighbour
    const up = mtof(midi + o.trill);
    for (let x = t + 0.08, i = 0; x < t + dur - 0.05; x += 0.07, i++) os.frequency.setValueAtTime(i % 2 ? f : up, x);
  }
  const vg = G(ctx, 0), l = ctx.createOscillator();
  l.frequency.value = W.vibHz;
  l.connect(vg).connect(os.detune);
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(dur > 0.4 ? W.vib * (o.vib ?? 1) : 0, t + Math.min(dur, 0.45));
  l.start(t);
  l.stop(end);
  let node = g;
  if (W.buzz) {
    // dizi membrane: a reedy edge
    const ws = shaper(ctx, 3), mix = G(ctx, W.buzz), hp = filt(ctx, 'highpass', f * 2.5, 0.7);
    g.connect(ws).connect(hp).connect(mix).connect(out);
  }
  node.connect(out);
  adsr(g.gain, t, W.att, 0.1, 0.85, 0.08, vel * 0.5, dur);
  // breath
  const bg = G(ctx, 0), bp = filt(ctx, 'bandpass', f * W.bp, 1.6);
  noise(ctx, t, end, bp, 5);
  bp.connect(bg).connect(out);
  adsr(bg.gain, t, W.att * 0.6, 0.12, 0.5, 0.1, vel * W.breath * 0.9, dur);
  const cg = G(ctx, 0), hp2 = filt(ctx, 'highpass', 2500, 0.7);
  noise(ctx, t, t + 0.08, hp2, 9);
  hp2.connect(cg).connect(out);
  perc(cg.gain, t, 0.004, 0.018, vel * W.chiff * 0.25);
}

/** a small unison chorus singing a vowel (chant) */
export function chant(ctx, out, t, midi, dur, vel = 0.6, o = {}) {
  const f = mtof(midi), end = t + dur + 0.4, vowel = o.vowel ?? [620, 1050, 2500];
  const sum = G(ctx, 1);
  for (let v = 0; v < 3; v++) {
    const g = G(ctx, 0.33), os = osc(ctx, 'sawtooth', f * (1 + (v - 1) * 0.006), t, end, g);
    const l = ctx.createOscillator(), lg = G(ctx, 9 + v * 3);
    l.frequency.value = 4.6 + v * 0.5;
    l.connect(lg).connect(os.detune);
    l.start(t);
    l.stop(end);
    g.connect(sum);
  }
  const mix = G(ctx, 0);
  vowel.forEach((fr, i) => {
    const bp = filt(ctx, 'bandpass', fr, 7 + i * 2), gg = G(ctx, [1, 0.6, 0.25][i]);
    sum.connect(bp).connect(gg).connect(mix);
  });
  mix.connect(out);
  adsr(mix.gain, t, 0.07, 0.15, 0.8, 0.18, vel * 1.6, dur);
}

// ------------------------------------------------------------------------------------------- strings / keys
/** bowed string section: detuned saws through a body filter. o.detuneFn(time) → cents of sourness (the Scream) */
export function strings(ctx, out, t, midi, dur, vel = 0.5, o = {}) {
  const f = mtof(midi), end = t + dur + 0.5, n = o.voices ?? 3;
  const lp = filt(ctx, 'lowpass', o.lp ?? Math.min(7000, 1200 + f * 3.5), 0.6), g = G(ctx, 0);
  const body = filt(ctx, 'peaking', 950, 1);
  body.gain.value = 4;
  for (let v = 0; v < n; v++) {
    const vg = G(ctx, 1 / n), os = osc(ctx, 'sawtooth', f, t, end, vg);
    os.detune.value = (v - (n - 1) / 2) * (o.spread ?? 9);
    const l = ctx.createOscillator(), lg = G(ctx, 0);
    l.frequency.value = 5.3 + v * 0.4;
    l.connect(lg).connect(os.detune);
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(o.vib ?? 9, t + Math.min(dur, 0.5));
    l.start(t);
    l.stop(end);
    if (o.detuneFn) {
      // going sour: o.detuneFn(time) → cents, spread across the desk (each player drifts a different way)
      const base = os.detune.value, k = v - (n - 1) / 2 + (o.bias ?? 0.5);
      for (let x = t; x < end; x += 0.03) os.detune.setValueAtTime(base + o.detuneFn(x) * k, x);
    }
    vg.connect(lp);
  }
  lp.connect(body).connect(g).connect(out);
  if (o.trem) {
    const tg = G(ctx, 1), l = ctx.createOscillator(), lg = G(ctx, 0.45);
    l.frequency.value = o.trem;
    l.type = 'square';
    l.connect(lg).connect(tg.gain);
    l.start(t);
    l.stop(end);
    body.disconnect();
    body.connect(tg).connect(g);
  }
  adsr(g.gain, t, o.att ?? 0.12, 0.2, 0.85, o.rel ?? 0.25, vel * 0.5, dur);
  return g;
}

/** piano: decaying partials + hammer thump. o.honky = detuned unison (silent-film upright) */
export function piano(ctx, out, t, midi, dur, vel = 0.7, o = {}) {
  const f = mtof(midi), bright = o.bright ?? 0.8;
  const g = G(ctx, 0), lp = filt(ctx, 'lowpass', 1800 + 5200 * bright * vel, 0.5);
  const decay = (2.4 - (midi - 40) * 0.02) * (o.decay ?? 1);
  for (let k = 1; k <= 7; k++) {
    const amp = Math.pow(k, -1.25 - (1 - bright) * 0.6), fk = f * k * Math.sqrt(1 + 0.00045 * k * k);
    if (fk > 9000) break;
    for (const det of o.honky ? [-6, 7] : [0]) {
      const pg = G(ctx, 0), os = osc(ctx, 'sine', fk, t, t + decay * 3 + 0.3, pg);
      os.detune.value = det;
      pg.connect(lp);
      perc(pg.gain, t, 0.003, (decay / (0.6 + k * 0.45)) * 0.45, amp * (o.honky ? 0.6 : 1));
    }
  }
  lp.connect(g).connect(out);
  g.gain.setValueAtTime(vel * 0.42, t);
  g.gain.setTargetAtTime(0.0001, t + Math.max(0.08, dur), 0.12);
  const hg = G(ctx, 0), bp = filt(ctx, 'bandpass', 900 + f, 1);
  noise(ctx, t, t + 0.05, bp, 13);
  bp.connect(hg).connect(out);
  perc(hg.gain, t, 0.001, 0.012, vel * 0.16);
}

/** pipe organ: drawbar sines, slow speech, a little wind */
export function organ(ctx, out, t, midi, dur, vel = 0.5, o = {}) {
  const f = mtof(midi), end = t + dur + 0.4, g = G(ctx, 0);
  const stops = o.stops ?? [[0.5, 0.7], [1, 1], [2, 0.6], [3, 0.3], [4, 0.35], [8, 0.12]];
  for (const [ratio, amp] of stops) {
    const sg = G(ctx, amp * 0.3);
    osc(ctx, 'sine', f * ratio, t, end, sg);
    sg.connect(g);
  }
  const trem = ctx.createOscillator(), tg = G(ctx, 0.06);
  trem.frequency.value = 5.7;
  trem.connect(tg).connect(g.gain);
  trem.start(t);
  trem.stop(end);
  g.connect(out);
  adsr(g.gain, t, 0.06, 0.1, 0.95, 0.14, vel * 0.5, dur);
  const cg = G(ctx, 0), bp = filt(ctx, 'bandpass', f * 4, 3);
  noise(ctx, t, t + 0.12, bp, 15);
  bp.connect(cg).connect(out);
  perc(cg.gain, t, 0.01, 0.03, vel * 0.06);
}

/** two-operator FM voice: electric piano, bell lead, "sax" */
export function fm(ctx, out, t, midi, dur, vel = 0.6, o = {}) {
  const f = mtof(midi), end = t + dur + (o.rel ?? 0.3) * 3 + 0.1;
  const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = G(ctx, 0), g = G(ctx, 0);
  car.frequency.value = f;
  mod.frequency.value = f * (o.ratio ?? 1);
  const idx = (o.index ?? 2) * f;
  mg.gain.setValueAtTime(idx * (o.indexAtt ?? 1), t);
  mg.gain.setTargetAtTime(idx * (o.indexSus ?? 0.25), t + 0.01, o.indexDecay ?? 0.15);
  mod.connect(mg).connect(car.frequency);
  if (o.from) {
    car.frequency.setValueAtTime(mtof(o.from), t);
    car.frequency.exponentialRampToValueAtTime(f, t + (o.glide ?? 0.08));
  }
  if (o.vib) {
    const l = ctx.createOscillator(), lg = G(ctx, 0);
    l.frequency.value = o.vibHz ?? 5.2;
    l.connect(lg).connect(car.detune);
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(o.vib, t + Math.min(dur, 0.4));
    l.start(t);
    l.stop(end);
  }
  car.connect(g).connect(out);
  if (o.sustain) adsr(g.gain, t, o.att ?? 0.03, 0.15, o.sustain, o.rel ?? 0.2, vel * 0.5, dur);
  else {
    perc(g.gain, t, o.att ?? 0.004, o.decay ?? 0.5, vel * 0.5);
    g.gain.setTargetAtTime(0.0001, t + Math.max(0.05, dur), o.rel ?? 0.12);
  }
  for (const n of [car, mod]) {
    n.start(t);
    n.stop(end);
  }
}

/** plain oscillator lead/pad voice with filter envelope. type: 'sine' | 'triangle' | 'sawtooth' | 'square' | PeriodicWave */
export function synth(ctx, out, t, midi, dur, vel = 0.5, o = {}) {
  const f = mtof(midi), end = t + dur + (o.rel ?? 0.15) * 4 + 0.05, g = G(ctx, 0);
  const lp = filt(ctx, 'lowpass', o.cutoff ?? 4000, o.q ?? 0.8);
  const n = o.voices ?? 1;
  const oscs = [];
  for (let v = 0; v < n; v++) {
    const vg = G(ctx, 1 / Math.sqrt(n)), os = osc(ctx, o.type ?? 'sawtooth', f, t, end, vg);
    os.detune.value = n > 1 ? (v / (n - 1) - 0.5) * 2 * (o.spread ?? 12) : 0;
    vg.connect(lp);
    oscs.push(os);
    if (o.vib) {
      const l = ctx.createOscillator(), lg = G(ctx, o.vib);
      l.frequency.value = o.vibHz ?? 6;
      l.connect(lg).connect(os.detune);
      l.start(t + (o.vibDelay ?? 0));
      l.stop(end);
    }
    if (o.from) {
      os.frequency.setValueAtTime(mtof(o.from), t);
      os.frequency.exponentialRampToValueAtTime(f, t + (o.glide ?? 0.06));
    }
  }
  if (o.envAmt) {
    lp.frequency.setValueAtTime((o.cutoff ?? 4000) + o.envAmt, t);
    lp.frequency.setTargetAtTime(o.cutoff ?? 4000, t, o.envDecay ?? 0.12);
  }
  lp.connect(g).connect(out);
  if (o.pluck) {
    perc(g.gain, t, 0.003, o.pluck, vel * 0.5);
    g.gain.setTargetAtTime(0.0001, t + Math.max(0.03, dur), 0.05);
  } else adsr(g.gain, t, o.att ?? 0.01, o.dec ?? 0.1, o.sus ?? 0.8, o.rel ?? 0.15, vel * 0.5, dur);
  return { oscs, gain: g };
}

// ------------------------------------------------------------------------------------------- percussion
export function drum(ctx, out, t, kind, vel = 0.8, o = {}) {
  const tone = (f0, f1, glide, tau, amp, type = 'sine') => {
    const g = G(ctx, 0), os = osc(ctx, type, f0, t, t + tau * 6 + 0.1, g);
    os.frequency.setValueAtTime(f0, t);
    os.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + glide);
    g.connect(out);
    perc(g.gain, t, 0.002, tau, vel * amp);
    return os;
  };
  const hit = (type, f, q, tau, amp, seed = 3, att = 0.001) => {
    const g = G(ctx, 0), b = filt(ctx, type, f, q);
    noise(ctx, t, t + tau * 6 + 0.05, b, seed);
    b.connect(g).connect(out);
    perc(g.gain, t, att, tau, vel * amp);
  };
  switch (kind) {
    case 'djembeBass': tone(150, 72, 0.09, 0.14, 0.9); hit('lowpass', 500, 0.7, 0.02, 0.2); break;
    case 'djembeTone': tone(330, 250, 0.03, 0.07, 0.6); hit('bandpass', 900, 1.5, 0.025, 0.25); break;
    case 'djembeSlap': tone(520, 420, 0.02, 0.035, 0.3); hit('bandpass', 2600, 1.2, 0.03, 0.55); break;
    case 'shaker': hit('highpass', 5500, 0.7, 0.03, 0.22, 5, 0.008); break;
    case 'clapHand': for (const d of [0, 0.011, 0.023]) { const g = G(ctx, 0), b = filt(ctx, 'bandpass', 1300, 1.1); noise(ctx, t + d, t + d + 0.2, b, 7 + d * 100); b.connect(g).connect(out); perc(g.gain, t + d, 0.001, d > 0.02 ? 0.06 : 0.012, vel * 0.5); } break;
    case 'frame': tone(120, 85, 0.06, 0.2, 0.7); hit('bandpass', 700, 0.8, 0.03, 0.2); break;
    case 'sistrum': hit('highpass', 6500, 0.7, 0.05, 0.25, 9, 0.006); hit('bandpass', 9000, 3, 0.07, 0.15, 10, 0.01); break;
    case 'bigDrum': tone(95, 52, 0.12, 0.3, 1.0); hit('lowpass', 300, 0.7, 0.04, 0.3); break;
    case 'stone': tone(o.f ?? 1900, o.f ?? 1900, 0.01, 0.18, 0.35, 'sine'); tone((o.f ?? 1900) * 2.7, (o.f ?? 1900) * 2.7, 0.01, 0.07, 0.15); hit('bandpass', 4000, 2, 0.006, 0.2); break;
    case 'bangu': tone(1050, 900, 0.01, 0.022, 0.45, 'triangle'); hit('bandpass', 2400, 2.5, 0.012, 0.4); break;
    case 'smallGong': { // xiaoluo: the pitch slides UP
      for (const [r, a, d] of [[1, 0.6, 0.35], [1.5, 0.35, 0.28], [2.3, 0.3, 0.2], [3.1, 0.2, 0.14]]) {
        const g = G(ctx, 0), os = osc(ctx, 'sine', 620 * r, t, t + 1.5, g);
        os.frequency.setValueAtTime(620 * r, t);
        os.frequency.exponentialRampToValueAtTime(760 * r, t + 0.22);
        g.connect(out);
        perc(g.gain, t, 0.002, d, vel * a);
      }
      hit('bandpass', 3000, 0.8, 0.02, 0.25);
      break;
    }
    case 'cymbals': hit('highpass', 3200, 0.5, 0.16, 0.42, 21, 0.002); hit('bandpass', 5200, 2, 0.3, 0.2, 22); break;
    case 'wood': tone(o.f ?? 196, (o.f ?? 196) * 0.97, 0.03, 0.09, 0.8, 'triangle'); tone((o.f ?? 196) * 2.4, (o.f ?? 196) * 2.4, 0.01, 0.03, 0.25); hit('bandpass', 1200, 2, 0.01, 0.3); break;
    case 'rattle': for (let i = 0; i < 7; i++) { const g = G(ctx, 0), b = filt(ctx, 'bandpass', 5200, 2); noise(ctx, t + i * 0.03, t + i * 0.03 + 0.08, b, 30 + i); b.connect(g).connect(out); perc(g.gain, t + i * 0.03, 0.002, 0.012, vel * 0.3 * (1 - i / 9)); } break;
    case 'tablaNa': tone(o.f ?? 587, o.f ?? 587, 0.01, 0.09, 0.45); tone((o.f ?? 587) * 2.02, (o.f ?? 587) * 2.02, 0.01, 0.05, 0.2); hit('bandpass', 3000, 2, 0.008, 0.3); break;
    case 'tablaTin': tone(o.f ?? 587, o.f ?? 587, 0.01, 0.22, 0.4); hit('bandpass', 2400, 2, 0.006, 0.15); break;
    case 'tablaGe': { const os = tone(88, 88, 0.01, 0.22, 0.95); os.frequency.setValueAtTime(82, t); os.frequency.exponentialRampToValueAtTime(128, t + 0.12); hit('lowpass', 400, 0.7, 0.02, 0.2); break; }
    case 'tablaKe': hit('bandpass', 1000, 2, 0.02, 0.5); break;
    case 'kendang': tone(o.f ?? 170, (o.f ?? 170) * 0.8, 0.05, 0.1, 0.7); hit('bandpass', 800, 1.2, 0.02, 0.3); break;
    case 'tsuzumi': { const os = tone(260, 260, 0.01, 0.12, 0.6); os.frequency.setValueAtTime(240, t); os.frequency.exponentialRampToValueAtTime(330, t + 0.09); hit('bandpass', 1500, 1.5, 0.015, 0.3); break; }
    case 'taiko': tone(110, 62, 0.1, 0.28, 1.0); hit('lowpass', 600, 0.7, 0.03, 0.35); break;
    case 'timpani': tone(o.f ?? 73.4, (o.f ?? 73.4) * 0.985, 0.2, 0.7, 0.9); tone((o.f ?? 73.4) * 1.5, (o.f ?? 73.4) * 1.5, 0.1, 0.35, 0.3); hit('lowpass', 500, 0.7, 0.03, 0.25); break;
    case 'kick': tone(150, 44, 0.09, 0.16, 1.0); hit('lowpass', 2500, 0.7, 0.006, 0.25); break;
    case 'softKick': tone(110, 48, 0.08, 0.13, 0.8); break;
    case 'snare': tone(210, 170, 0.03, 0.06, 0.4, 'triangle'); hit('highpass', 1600, 0.7, 0.09, 0.5, 17); break;
    case 'softSnare': tone(190, 160, 0.03, 0.05, 0.25, 'triangle'); hit('bandpass', 2400, 0.8, 0.07, 0.34, 17); break;
    case 'clap': for (const d of [0, 0.012, 0.026]) { const g = G(ctx, 0), b = filt(ctx, 'bandpass', 1500, 1.2); noise(ctx, t + d, t + d + 0.25, b, 40 + d * 300); b.connect(g).connect(out); perc(g.gain, t + d, 0.001, d > 0.02 ? 0.085 : 0.01, vel * 0.55); } break;
    case 'hat': hit('highpass', 7500, 0.8, o.open ? 0.11 : 0.022, 0.3, 19); break;
    case 'click': hit('bandpass', o.f ?? 3200, 4, 0.004, 0.5, 23); break;
    case 'chain': hit('bandpass', 4300, 6, 0.006, 0.28, 25); hit('highpass', 8000, 1, 0.004, 0.1, 26); break;
    case 'flash': hit('highpass', 2500, 0.5, 0.045, 0.5, 27, 0.001); hit('bandpass', 900, 0.8, 0.02, 0.4, 28); tone(2600, 5200, 0.25, 0.12, 0.05); break; // flash bulb: pop + capacitor whine
    case 'chipNoise': { const g = G(ctx, 0), s = noise(ctx, t, t + 0.3, g, 31, o.rate ?? 0.4); g.connect(out); perc(g.gain, t, 0.001, o.tau ?? 0.03, vel * 0.5); void s; break; }
    default: break;
  }
}

/** filtered-noise swell: rain, wind gusts, whooshes, risers. f0 → f1 band centre sweep */
export function swell(ctx, out, t, dur, vel = 0.3, o = {}) {
  const g = G(ctx, 0), b = filt(ctx, o.type ?? 'bandpass', o.f0 ?? 800, o.q ?? 0.8);
  noise(ctx, t, t + dur + 0.2, b, o.seed ?? 33);
  b.frequency.setValueAtTime(o.f0 ?? 800, t);
  b.frequency.exponentialRampToValueAtTime(o.f1 ?? o.f0 ?? 800, t + dur);
  b.connect(g).connect(out);
  const peak = o.peak ?? 0.7;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + dur * peak);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
}

/** steady hum: a stack of partials on one fundamental (valve heaters, mains, tape motor) */
export function hum(ctx, out, t, dur, f = 50, vel = 0.1, parts = [1, 0.6, 0.35, 0.12]) {
  const g = G(ctx, 0);
  parts.forEach((a, i) => {
    const pg = G(ctx, a);
    osc(ctx, 'sine', f * (i + 1), t, t + dur + 0.1, pg);
    pg.connect(g);
  });
  g.connect(out);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.15);
  g.gain.setValueAtTime(vel, t + dur - 0.1);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  return g;
}

// ------------------------------------------------------------------------------------------- buses & effects
/**
 * A mixing bus for one section: returns the node to connect voices to.
 * o: { gain, room (send 0..1 to a 1.3 s room), hall (send to a 3.2 s hall), pan }
 */
export function bus(ctx, master, o = {}) {
  const inp = G(ctx, o.gain ?? 1);
  inp.connect(master.dry);
  if (o.room) {
    const s = G(ctx, o.room);
    inp.connect(s).connect(master.room);
  }
  if (o.hall) {
    const s = G(ctx, o.hall);
    inp.connect(s).connect(master.hall);
  }
  return inp;
}

/** master chain: dry + room + hall → glue compressor → output. Returns { dry, room, hall, out } */
export function master(ctx, destination) {
  const sum = G(ctx, 1), comp = ctx.createDynamicsCompressor(), out = G(ctx, 0.9);
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.006;
  comp.release.value = 0.18;
  sum.connect(comp).connect(out).connect(destination);
  const dry = G(ctx, 1);
  dry.connect(sum);
  const mk = (seconds, seed, bright, level) => {
    const send = G(ctx, 1), conv = ctx.createConvolver(), ret = G(ctx, level);
    conv.buffer = impulse(ctx, seconds, seed, bright);
    send.connect(conv).connect(ret).connect(sum);
    return send;
  };
  return { dry, room: mk(1.3, 3, 0.6, 0.55), hall: mk(3.2, 5, 0.45, 0.5), out, sum };
}
