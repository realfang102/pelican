// Labelled colour block used until a section is painted (workflow step 1: the silent prototype).
import { TITLES } from './titles.js';

const HUES = [28, 44, 0, 210, 150, 120, 16, 330, 200, 36, 220, 235, 12, 0, 130, 265, 190, 300, 340, 225];

export function placeholder(id) {
  const title = TITLES[id];
  const hue = HUES[(id - 1) % HUES.length];
  return {
    id, key: title.key, title, placeholder: true, heroT: 3,
    render(ctx, t, env) {
      const { K, Rig } = env;
      ctx.fillStyle = `hsl(${hue},32%,${id === 3 || id === 14 || id === 15 ? 16 : 62}%)`;
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.fillStyle = `hsl(${hue},30%,42%)`;
      ctx.fillRect(0, K.ROAD_Y, 1000, 1000 - K.ROAD_Y);
      ctx.fillStyle = `hsl(${hue},25%,30%)`;
      ctx.fillRect(0, K.ROAD_Y, 1000, 6);
      K.text(ctx, String(id).padStart(2, '0'), 500, 330, { size: 260, font: K.FONT.display, align: 'center', color: 'rgba(255,255,255,0.35)' });
      K.titleBlock(ctx, title, 60, 60, { color: '#ffffff', maxWidth: 880 });
      const b = env.Beat.local(Math.max(0, t));
      if (t >= 0 && t < 6) K.text(ctx, `bar ${b.bar + 1} · beat ${(b.beat % 4) + 1}`, 940, 960, { size: 26, font: K.FONT.mono, align: 'right', color: 'rgba(255,255,255,0.7)' });
      if (env.pose) Rig.drawFlat(ctx, env.pose);
    },
  };
}
