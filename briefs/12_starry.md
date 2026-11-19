# 12 — Van Gogh, *The Starry Night* · 1889 · film 71–77 s
**Looks like:** oil on canvas, thick directional impasto — short loaded strokes laid side by side that follow the form;
ultramarine and cobalt night, citron and orange stars with ringed halos, a crescent moon in a glowing disc, the great
double whorl of cloud rolling across the sky, blue hills, a sleeping village with a tall spire, and the dark flame of a
cypress rising at the left.
**Composition:** keep the painting's structure but give it our road: a village lane (y = 800) in ochre and violet
strokes across the foreground, wheat/hedge strokes below it, village roofs and lit windows just behind the road, hills,
then the sky filling the upper two-thirds; cypress left.
**Gag (required): "the swirling night sky spins in time with the bicycle wheels."** The whorls and star halos turn —
their rotation is tied to the pelican's wheel angle (`pose.wheelA` / `env.rider`), so when it rides, the heavens roll at
the same rate, and they keep rolling slowly before and after. Efficient way: bake each whorl and each star halo as its
own round sprite of concentric/spiral dashes (p5.brush `oil` or `gouache`, grouped by colour) and rotate the sprites
per frame over a baked static sky of flowing strokes; the big cloud whorl can be two counter-rotating discs.
On the downbeat of bar 2 the stars flare (halos swell) for a beat.
**Pelican:** painted in the same thick strokes — body in creams and pale blues, outline in dark Prussian blue, strokes
following the forms; its two wheels are small **swirling stars** (spiral dashes, yellow-white) that visibly match the sky.
Draw per frame with short `K.brushStroke`/`K.ribbon` dabs with fixed seeds, or sprite parts.
**Texture:** canvas weave and paint relief: a light emboss/grain overlay; visible bare canvas at the edges.
**Title card:** hand-lettered in paint in a lower corner as if signed on the canvas (zh / en / date), legible.
**Music here:** strings, swelling.
