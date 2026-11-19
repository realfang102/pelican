# 15 — Oscilloscope Vector Graphics · 1950s · film 89–95 s   (same agent as 14)
**Looks like:** the face of a 1950s laboratory instrument: a large **circular green-phosphor CRT on black**, with a
graticule, set in a wrinkle-finish metal panel with bakelite knobs, engraved legends, a pilot lamp.
**Layout:** the tube is big — centre about (500, 640), radius about 520 — so its glass reaches both side edges at the
road line (y = 800) and the pelican stays on screen from frame to frame; the bottom of the circle is cut by the
picture edge. The instrument panel shows in the band above the tube and in the top corners: knobs (INTENSITY, FOCUS,
X GAIN, Y GAIN, SWEEP), screws, a serial plate. The **title card** is the engraved maker's nameplate at top-left
(zh / en / date in engraved white-filled lettering). Fictional maker.
**Trace (required):** "Glowing lines form the pelican and bicycle, complete with phosphor trails and scan jitter."
Draw the pose as a set of polylines (`Rig.parts`), additive green (`K.glowLine`), a bright moving beam spot, fine
high-frequency jitter (tiny per-frame noise, quantised in time), and persistence: 5–8 older poses via `env.poseAt`
fading out. The road is a horizontal trace with a little noise. Glass reflections and a soft overall glow.
Put the trace renderer in `src/scenes/scope_trace.js` (shared with section 14).
**Gag (required):** "A hand turns the wrong knob, instantly warping the pelican into a tangled Lissajous figure. It
snaps back into shape on the next beat." A technician's hand (shirt cuff, period-neutral) comes in to a knob in bar 1;
**on t = 2.0 it turns the wrong one** — instantly every trace point is remapped to a Lissajous curve
(x = sin(aτ + φ), y = sin(bτ), a : b such as 3 : 2 or 5 : 4, slowly precessing) so the pelican becomes a tangled figure
centred where it was; the knob is yanked back and **on t = 2.5 the pelican snaps back**. The hand withdraws, sheepish.
The warp amount is a function you can also export as `export const warpAt = (t) => …` (the score bends its pitch with it).
**Before:** just the road trace and a slow idle sweep. **After:** the road trace, afterglow fading.
**From section 14:** at t ≈ 0 the pelican arrives already as this green trace (section 14 turns its shadow into it).
**Music here:** sine-wave buzz over valve hum; the pitch warps with the Lissajous figure.
