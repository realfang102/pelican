// kit/color — hex helpers. Colours are '#rrggbb' strings unless noted.
import { clamp } from './math.js';

const cache = new Map();
/** '#abc' | '#aabbcc' | [r,g,b] → [r,g,b] */
export function rgb(c) {
  if (Array.isArray(c)) return c;
  let v = cache.get(c);
  if (v) return v;
  const h = c.replace('#', '');
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  v = [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  cache.set(c, v);
  return v;
}
export const hex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
/** css rgba() string */
export const rgba = (c, a = 1) => {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
};
export const mix = (a, b, t) => {
  const A = rgb(a), B = rgb(b);
  return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};
/** k<0 darkens toward black, k>0 lightens toward white (|k| ≤ 1) */
export const shade = (c, k) => (k < 0 ? mix(c, '#000000', -k) : mix(c, '#ffffff', k));
export const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
export const lum = (c) => {
  const [r, g, b] = rgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
