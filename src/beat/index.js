// beat — tempo, bar grid and the film's timeline. Everything that moves is timed against this module.
//
// 120 BPM, 4/4: a beat is 0.5 s, a bar is 2 s.
//   intro   2½ bars   0 … 5 s     (a half-bar pickup, then two bars; downbeats fall on 1 s, 3 s, 5 s, …)
//   20 sections × 3 bars          5 … 125 s   section i starts at 5 + 6·(i−1)
//   outro   6 bars    125 … 137 s
// Every picture-frame crossing happens exactly on a section boundary, i.e. on a downbeat.
import { pchip, clamp } from '../kit/math.js';

export const BPM = 120;
export const BEAT = 60 / BPM; // 0.5 s
export const BAR = 4 * BEAT; // 2 s
export const INTRO = 2.5 * BAR; // 5 s
export const SECTION = 3 * BAR; // 6 s
export const SECTIONS = 20;
export const OUTRO = 6 * BAR; // 12 s
export const T_OUTRO = INTRO + SECTIONS * SECTION; // 125 s
export const DURATION = T_OUTRO + OUTRO; // 137 s
export const DOWNBEAT0 = INTRO - 2 * BAR; // 1 s: first downbeat of the film

/** start time of section i (1..20); sectionStart(21) is the outro */
export const sectionStart = (i) => INTRO + (i - 1) * SECTION;

/** which segment owns film time T → { kind:'intro'|'section'|'outro', index (0, 1..20, 21), t (local seconds), start } */
export function locate(T) {
  if (T < INTRO) return { kind: 'intro', index: 0, t: T, start: 0 };
  if (T >= T_OUTRO) return { kind: 'outro', index: SECTIONS + 1, t: T - T_OUTRO, start: T_OUTRO };
  const i = Math.min(SECTIONS, Math.floor((T - INTRO) / SECTION) + 1);
  const start = sectionStart(i);
  return { kind: 'section', index: i, t: T - start, start };
}

/** global beat position at film time T: { beat (float, 0 at the first downbeat), bar, inBar (0..3), phase (0..1) } */
export function beatAt(T) {
  const b = (T - DOWNBEAT0) / BEAT;
  const fb = Math.floor(b);
  return { beat: b, bar: Math.floor(b / 4), inBar: ((fb % 4) + 4) % 4, phase: b - fb };
}

/** decaying pulse that fires on every beat (1 at the beat, → 0). every = 1 beat, 2 = half-bar, 4 = bar */
export function beatPulse(T, every = 1, sharp = 7) {
  const b = (T - DOWNBEAT0) / (BEAT * every);
  const ph = b - Math.floor(b);
  return Math.exp(-sharp * ph * every * BEAT * 2);
}

/** section-local helpers for local time t (seconds since the pelican crossed in): bar 0..2, beat 0..11 */
export function local(t) {
  const beat = t / BEAT;
  return { bar: Math.floor(t / BAR), barPhase: (t / BAR) % 1, beat: Math.floor(beat), beatPhase: beat - Math.floor(beat), beats: beat };
}

/** local time (s) of bar b (0-based), beat k (0-based) within a section */
export const at = (bar, beat = 0) => bar * BAR + beat * BEAT;

/** 1 → 0 pulse starting at local time t0 */
export const hit = (t, t0, sharp = 6) => (t < t0 ? 0 : Math.exp(-sharp * (t - t0)));

/**
 * Motion profile through one section. points: [[t, u], …] with t in 0..6 s and u in 0..1 (fraction of the way across).
 * Must start at [0,0] and end at [6,1]; the ends are forced to the nominal speed so the ride is seamless at the frames.
 * Flat runs (same u twice) are held exactly — that is how a scene freezes the pelican on a beat.
 */
export function makeProfile(points = [[0, 0], [SECTION, 1]]) {
  const f = pchip(points, 1 / SECTION, 1 / SECTION);
  const u = (t) => (t <= 0 ? t / SECTION : t >= SECTION ? 1 + (t - SECTION) / SECTION : clamp(f(t), 0, 1));
  u.d = (t) => (t <= 0 || t >= SECTION ? 1 / SECTION : Math.max(0, f.d(t)));
  return u;
}

/** quantise time to `hz` updates per second (period-correct stutter); ticks land on beats when hz·BEAT is whole */
export const quantize = (t, hz) => Math.floor(t * hz + 1e-6) / hz;
