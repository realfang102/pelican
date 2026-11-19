# 14 — *Nosferatu* · 1922 · film 83–89 s   (same agent as 15: they share the special transition)
**Looks like:** a frame of German Expressionist silent film: black and white with a cold night tint, heavy grain,
dust and scratches, gate weave, lamp flicker, a dark vignette.
**Composition:** an interior: a tall pale wall beside a **staircase** with a banister, an arched doorway, sharp
slanting light. No character appears. **The pelican is seen only as a shadow** — "the shadow of the pelican riding its
bicycle slowly climbs the wall beside a staircase." The stairs rise from the left to a landing and come down again to
the right, so the shadow enters and leaves on the road line (y = 800): use `path(u)` (`dy` up to about −160 over the
landing, `rot` following the flights; zero within 7 % of each edge) and a `profile` that is slow on the climb.
Draw the shadow with `Rig.drawSilhouette` into a buffer, sheared and stretched as a cast shadow, soft-edged, long beak
and long feather "fingers" exaggerated by the low light, broken over the steps.
**Title card:** a silent-film intertitle plaque (ornamental border, white serif lettering on black) set in the upper
part of the frame: zh / en / date.
**Gag:** on a beat in bar 2 the shadow of the beak slides over a small framed portrait/clock on the wall and the
banister's shadow bars sweep across it; the door at the top creaks open by itself. Keep it slow and ominous; the joke
is that it is only a pelican.
**Special transition 14 → 15 (required).** "On the strong beat as the pelican crosses the frame, its shadow on the
wall powers up. The silhouette turns into a glowing green oscilloscope trace with phosphor persistence, carrying the
action seamlessly into the next section." At t = 6.0 the pelican is half inside this picture: from t ≈ 5.7 a green
edge creeps around the shadow, and **exactly at t = 6.0** it snaps into the glowing green vector trace (the same trace
drawn in section 15, with decaying after-images of the previous ~0.4 s of poses via `env.poseAt`), which lingers on the
Nosferatu wall until the pelican has left (t ≈ 6.8), lighting the wall faintly green. Put the trace renderer in
`src/scenes/scope_trace.js` and use it from both scenes so the two halves match across the frame.
**Music here:** silent-film piano and pipe organ.
