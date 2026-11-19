#!/usr/bin/env python3
"""Sanity-check the rendered score: level per segment, beat alignment of onsets, bell at every frame crossing.
usage: python3 tools/audiocheck.py out/score.wav"""
import sys, numpy as np
from scipy.io import wavfile
from scipy.signal import stft
path = sys.argv[1] if len(sys.argv) > 1 else 'out/score.wav'
sr, x = wavfile.read(path)
x = x.astype(np.float64) / 32768.0
mono = x.mean(axis=1) if x.ndim > 1 else x
dur = len(mono) / sr
print(f'{path}: {dur:.2f} s, {sr} Hz, peak {np.abs(x).max():.3f}, nan={np.isnan(x).any()}')
segs = [('intro', 0, 5)] + [(f's{i:02d}', 5 + 6 * (i - 1), 5 + 6 * i) for i in range(1, 21)] + [('outro', 125, 137)]
f, t, Z = stft(mono, sr, nperseg=1024, noverlap=1024 - 256)
mag = np.abs(Z)
flux = np.maximum(0, np.diff(mag, axis=1)).sum(axis=0)
ft = t[1:]
hi = mag[(f > 1800) & (f < 7000)].sum(axis=0)
def rms_db(a):
    return 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)
print('seg     rms dB  peak   onset-on-beat  centroid Hz  bell(2-7k @ start)')
for name, a, b in segs:
    if a >= dur: break
    s = mono[int(a * sr):int(min(b, dur) * sr)]
    m = (ft >= a) & (ft < b)
    fl, tt = flux[m], ft[m]
    # how much of the onset energy falls within ±40 ms of an eighth-note grid point (grid 0.25 s, phase from segment start)
    ph = ((tt - a + 0.125) % 0.25) - 0.125
    on = fl[np.abs(ph) < 0.04].sum() / (fl.sum() + 1e-9)
    mm = (t >= a) & (t < b)
    cen = (mag[:, mm].sum(axis=1) * f).sum() / (mag[:, mm].sum() + 1e-9)
    bm = (t >= a - 0.02) & (t < a + 0.25); pre = (t >= a - 0.5) & (t < a - 0.1)
    bell = hi[bm].mean() / (hi[pre].mean() + 1e-9) if pre.any() and a > 0 else float('nan')
    print(f'{name:6s} {rms_db(s):7.1f}  {np.abs(s).max():.2f}   {on * 100:5.1f} %       {cen:7.0f}      {bell:5.1f}x')
