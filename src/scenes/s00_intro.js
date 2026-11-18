// Intro card — placeholder (paper, two lines, Fig. 1). Fully developed in workflow step 2.
export default {
  id: 0, key: 'intro',
  render(ctx, T, env) {
    const { K, Rig } = env;
    ctx.fillStyle = '#e9dfc8';
    ctx.fillRect(-2400, -300, 2400, 1700);
    ctx.fillStyle = '#3a3026';
    ctx.fillRect(-2400, K.ROAD_Y, 2400, 2);
    const a1 = K.prog(T, 0.5, 0.5), a2 = K.prog(T, 2.7, 0.3);
    K.text(ctx, 'Humans have been obsessed with drawing pelicans', -1020, 330, { size: 58, align: 'center', color: '#2a221a', alpha: a1 });
    K.text(ctx, 'riding bicycles since ancient times.', -1020, 405, { size: 58, align: 'center', color: '#2a221a', alpha: a1 });
    K.text(ctx, '— Long before the bicycle was invented.', -1020, 500, { size: 46, align: 'center', italic: true, color: '#2a221a', alpha: a2 });
    if (env.pose) Rig.drawFlat(ctx, env.pose);
  },
};
