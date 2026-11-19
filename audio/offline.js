// audio/offline — render the whole score with an OfflineAudioContext and encode it as a 16-bit WAV.
import * as S from './synth.js';
import { SEGMENTS, DURATION, schedule } from './score.js';
import { renderVapor } from './vapor.js';

export async function renderScore({ sampleRate = 48000, from = 0, to = DURATION, only = null } = {}) {
  const vapor = await renderVapor(sampleRate);
  const ctx = new OfflineAudioContext(2, Math.ceil((to - from) * sampleRate), sampleRate);
  const M = S.master(ctx, ctx.destination);
  for (const seg of SEGMENTS) {
    if (only && !only.includes(seg.name)) continue;
    if (seg.start + seg.dur <= from || seg.start >= to) continue;
    schedule(ctx, M, seg, seg.start - from, Math.max(0, from - seg.start), { vapor });
  }
  return ctx.startRendering();
}

/** peak-normalise (to `peak`) and encode as PCM16 WAV → Uint8Array */
export function encodeWav(buf, peak = 0.89) {
  const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate;
  const data = [];
  let max = 0;
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    data.push(d);
    for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(d[i]));
  }
  const k = max > 0 ? peak / max : 1;
  const bytes = new Uint8Array(44 + n * ch * 2), v = new DataView(bytes.buffer);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * ch * 2, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i] * k));
      v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true);
      o += 2;
    }
  }
  return { bytes, gain: k, peak: max };
}
