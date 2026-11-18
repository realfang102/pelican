// kit/text — typography helpers. Fonts are system fonts (see README for the list used on the render machine);
// every stack ends in a generic family so the browser preview degrades gracefully elsewhere.
import { rng } from './noise.js';
import { layer } from './canvas.js';

export const FONT = {
  serif: '"Cardo", "Crimson Text", "Lora", "Noto Serif CJK TC", "Songti TC", Georgia, serif',
  book: '"Crimson Text", "Cardo", "Noto Serif CJK TC", "Songti TC", Georgia, serif',
  roman: '"Latin Modern Roman", "Cardo", "Noto Serif CJK TC", serif',
  cjkSerif: '"Noto Serif CJK TC", "Songti TC", "Source Han Serif TC", "PMingLiU", serif',
  cjkSans: '"Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
  sans: '"Inter", "Noto Sans CJK TC", "Helvetica Neue", Arial, sans-serif',
  display: '"Archivo Black", "Anton", "Noto Sans CJK TC", Impact, sans-serif',
  geo: '"Poppins", "Montserrat", "Noto Sans CJK TC", sans-serif',
  mono: '"DejaVu Sans Mono", "Anonymous Pro", "Noto Sans Mono CJK TC", Menlo, monospace',
  pixel: '"Unifont", "WenQuanYi Zen Hei Mono", monospace',
  chat: '"Comic Relief", "Comic Sans MS", "Noto Sans CJK TC", sans-serif',
  script: '"TeX Gyre Chorus", "Cardo", cursive',
};

/**
 * Draw one line of text.
 *   o.font family (FONT.*), o.size units, o.weight, o.italic, o.align 'left'|'center'|'right', o.baseline,
 *   o.color, o.alpha, o.tracking (units between letters), o.stroke {color,width}, o.maxWidth (squeeze to fit)
 * Returns the measured width.
 */
export function text(ctx, str, x, y, o = {}) {
  const size = o.size ?? 24;
  ctx.save();
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${size}px ${o.font ?? FONT.serif}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.tracking != null && 'letterSpacing' in ctx) ctx.letterSpacing = `${o.tracking}px`;
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  let w = ctx.measureText(str).width;
  if (o.maxWidth && w > o.maxWidth) {
    const k = o.maxWidth / w;
    ctx.translate(x, y);
    ctx.scale(k, 1);
    ctx.translate(-x, -y);
    w = o.maxWidth;
  }
  if (o.stroke) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = o.stroke.color;
    ctx.lineWidth = o.stroke.width;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color ?? '#111111';
  ctx.fillText(str, x, y);
  ctx.restore();
  return w;
}

export function measure(ctx, str, o = {}) {
  ctx.save();
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size ?? 24}px ${o.font ?? FONT.serif}`;
  if (o.tracking != null && 'letterSpacing' in ctx) ctx.letterSpacing = `${o.tracking}px`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** Vertical text (top to bottom), one glyph per cell — for CJK colophons and banners. x,y = centre of the first glyph. */
export function vtext(ctx, str, x, y, o = {}) {
  const size = o.size ?? 28, gap = o.gap ?? size * 1.08;
  const chars = [...str];
  chars.forEach((ch, i) => text(ctx, ch, x, y + i * gap, { ...o, align: 'center', baseline: 'middle' }));
  return chars.length * gap;
}

/** Greedy word wrap. Returns lines. */
export function wrap(ctx, str, maxWidth, o = {}) {
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(ctx, t, o) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Standard three-line title block (Chinese title, English title, date). Every section must show one, styled for
 * its era — pass fonts/colours, and draw whatever cartouche, plaque, seal or window chrome you like around it.
 *   o.align, o.zh/en/date: per-line overrides {size, font, color, weight, tracking, italic}, o.gap line spacing factor
 * (x,y) is the top of the block at the alignment edge. Returns {w,h}.
 * Legibility floor at 1080p: zh ≥ 34, en ≥ 21, date ≥ 19 units.
 */
export function titleBlock(ctx, title, x, y, o = {}) {
  const align = o.align ?? 'left';
  const zh = { size: 40, font: FONT.cjkSerif, weight: 700, color: o.color ?? '#111111', ...(o.zh || {}) };
  const en = { size: 23, font: FONT.serif, weight: 400, color: o.color ?? '#111111', ...(o.en || {}) };
  const dt = { size: 20, font: FONT.serif, weight: 400, color: o.color ?? '#111111', italic: true, ...(o.date || {}) };
  const gap = o.gap ?? 1.28;
  let yy = y, w = 0;
  w = Math.max(w, text(ctx, title.zh, x, yy, { ...zh, align, baseline: 'top' }));
  yy += zh.size * gap;
  w = Math.max(w, text(ctx, title.en, x, yy, { ...en, align, baseline: 'top', maxWidth: o.maxWidth }));
  yy += en.size * gap;
  w = Math.max(w, text(ctx, title.date, x, yy, { ...dt, align, baseline: 'top' }));
  yy += dt.size * 1.1;
  return { w, h: yy - y };
}

/**
 * Carved seal (印章): returns a cached layer. chars are laid out in columns right-to-left, top-to-bottom.
 *   relief 'zhu' = red characters on paper inside a red border, 'bai' = paper-coloured characters cut out of a red block
 */
export function seal(chars, { size = 64, color = '#b3261e', relief = 'bai', font = FONT.cjkSerif, seed = 1, wear = 0.35, cols = null } = {}) {
  const list = [...chars];
  const nc = cols ?? (list.length <= 2 ? 1 : 2), nr = Math.ceil(list.length / nc);
  const cell = size / Math.max(nc, nr);
  const w = cell * nc + size * 0.16, h = cell * nr + size * 0.16;
  return layer(w, h, 3, (ctx) => {
    const pad = size * 0.08;
    ctx.fillStyle = color;
    if (relief === 'bai') ctx.fillRect(0, 0, w, h);
    else {
      ctx.lineWidth = size * 0.06;
      ctx.strokeStyle = color;
      ctx.strokeRect(size * 0.03, size * 0.03, w - size * 0.06, h - size * 0.06);
    }
    ctx.globalCompositeOperation = relief === 'bai' ? 'destination-out' : 'source-over';
    ctx.font = `900 ${cell * 0.86}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    list.forEach((ch, i) => {
      const c = nc - 1 - Math.floor(i / nr), r = i % nr;
      ctx.fillText(ch, pad + cell * (c + 0.5), pad + cell * (r + 0.52));
    });
    // wear: chips out of the stone
    ctx.globalCompositeOperation = 'destination-out';
    const r = rng(seed);
    for (let i = 0; i < 260 * wear; i++) {
      ctx.globalAlpha = 0.5 + 0.5 * r();
      const edge = r() < 0.45;
      const x = edge ? (r() < 0.5 ? r() * size * 0.07 : w - r() * size * 0.07) : r() * w;
      const y = edge && r() < 0.5 ? (r() < 0.5 ? r() * size * 0.07 : h - r() * size * 0.07) : r() * h;
      ctx.beginPath();
      ctx.arc(x, y, r.range(0.3, size * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
