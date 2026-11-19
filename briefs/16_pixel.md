# 16 — 8-Bit Pixel Game · 1980s · film 95–101 s
**Looks like:** a side-scrolling platformer on an 8-bit home console: a 250 × 250 pixel picture shown with hard
nearest-neighbour pixels (4 units each), a **limited palette** (pick ~16 colours and stick to them; ≤ 3 colours plus
transparency per sprite), tile-based scenery. Render the whole picture into a 250 × 250 canvas and blit it with
`imageSmoothingEnabled = false`.
**Everything original:** your own tiles, scenery, HUD and sprites — nothing that resembles an existing game's blocks,
pipes, clouds, characters, fonts or level layout. Suggested world: dusk sky bands, stepped hills, checker-brick ground
of your own design, signposts, little stone ruins, a windmill.
**Level:** the ground's top edge is the road (y = 800, i.e. pixel row 200). In the middle is **a gap** (about 28 px
wide) with water or a pit; a **coin** of your own design floats above it. HUD across the top in a chunky pixel font
(`K.FONT.pixel` rendered without smoothing, or your own 5×7 bitmap font): SCORE, a coin counter, lives, TIME — and the
era **title card** as the stage banner (zh / en / date — zh ≥ 40 units means ≥ 10 px tall glyphs, so render Unifont at
16 px and keep it crisp).
**Pelican:** a pixel-art sprite: rasterise the pose into the low-res canvas with flat palette colours and a dark
outline (draw fills, then snap to the palette), 2–4 frames of pedalling. Set `stutter: 12` so its animation updates
8–12 times a second; the camera pan stays smooth.
**Gag (required): "the pixel-art pelican jumps a gap on its bicycle and grabs a coin. '1UP' pops up on a strong beat."**
In `act` lift `p.y` along a parabola across the gap (take-off ≈ t = 2.1, apex on t = 2.5, landing ≈ t = 2.9; little
squash on landing); the coin vanishes in a sparkle at the apex and the counter ticks; **"1UP" pops up at t = 3.0** and
floats upward for a second. Score rolls up. A couple of background critters of your own invention hop on the beat.
**Before / after:** coin spinning over the gap → coin gone, counters changed.
**Music here:** four-channel chiptune (two squares, triangle, noise), original coin and 1UP jingles.
