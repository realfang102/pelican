// Panel 21 — press conference, empty seat. Placeholder; developed in workflow step 2.
export default {
  id: 21, key: 'press',
  render(ctx, t, env) {
    const { K } = env;
    ctx.fillStyle = '#28303a';
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(120, 700, 760, 300);
    K.text(ctx, 'The Pelican (In Person)', 500, 800, { size: 40, align: 'center', color: '#222' });
    K.text(ctx, '21', 500, 420, { size: 260, font: K.FONT.display, align: 'center', color: 'rgba(255,255,255,0.2)' });
  },
};
