// kit/canvas — offscreen layers and path helpers for the Canvas 2D compositor.
// A "layer" is a plain <canvas> drawn once (usually in a scene's init) and blitted every frame.
// Layers carry .uw/.uh (size in scene units) and .res (pixels per unit) so they can be drawn back at unit size.

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Create a w×h-unit layer at `res` px/unit and draw into it: layer(1000, 1000, 1.2, (ctx) => {...}) */
export function layer(w, h, res = 1, draw = null) {
  const c = makeCanvas(w * res, h * res);
  c.uw = w;
  c.uh = h;
  c.res = res;
  const ctx = c.getContext('2d');
  ctx.scale(c.width / w, c.height / h);
  if (draw) draw(ctx, c);
  return c;
}

/** Blit a layer at unit size (or any rect). */
export function put(ctx, lay, x = 0, y = 0, w = lay.uw ?? lay.width, h = lay.uh ?? lay.height) {
  ctx.drawImage(lay, x, y, w, h);
}

/** Blit with a blend mode and alpha, restoring state afterwards. */
export function putBlend(ctx, lay, mode = 'multiply', alpha = 1, x = 0, y = 0, w = lay.uw ?? lay.width, h = lay.uh ?? lay.height) {
  const m = ctx.globalCompositeOperation, a = ctx.globalAlpha;
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = a * alpha;
  ctx.drawImage(lay, x, y, w, h);
  ctx.globalCompositeOperation = m;
  ctx.globalAlpha = a;
}

/** polyline / polygon path through [[x,y],...] */
export function path(ctx, pts, closed = false) {
  ctx.beginPath();
  if (!pts.length) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}

/** smooth (Catmull-Rom) path through points */
export function spline(ctx, pts, closed = false, k = 1 / 6) {
  ctx.beginPath();
  const n = pts.length;
  if (n < 2) return;
  const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}

export function fillPoly(ctx, pts, style, smooth = false) {
  smooth ? spline(ctx, pts, true) : path(ctx, pts, true);
  ctx.fillStyle = style;
  ctx.fill();
}
export function strokePoly(ctx, pts, style, width = 1, closed = false, smooth = false) {
  smooth ? spline(ctx, pts, closed) : path(ctx, pts, closed);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.stroke();
}
export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
/** run fn between save()/restore() */
export function scoped(ctx, fn) {
  ctx.save();
  try {
    fn(ctx);
  } finally {
    ctx.restore();
  }
}
/** linear gradient shorthand: stops = [[0,'#fff'],[1,'#000']] */
export function linGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
export function radGrad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
