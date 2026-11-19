# 18 — Vaporwave · 2010s · film 107–113 s
**Looks like:** a vaporwave still: **pink, purple and cyan gradients**, a **receding perspective grid** floor glowing
toward a hazy horizon, a striped setting sun, **low-poly palm trees**, floating wireframe solids, soft bloom,
scanlines, VHS chroma bleed and a slight tracking wobble.
**Required elements:** the gradients, the grid, the low-poly palms, and **"a classical marble bust looking on."** Make
the bust your own: an anonymous classical head (not any specific famous sculpture and not the composition of any
album cover) on a plinth to one side, flat-shaded in facets, its head turned toward the road, lit pink and cyan.
Do not imitate any real album cover, operating-system UI, logo or brand.
**Road:** a glowing lane on the grid at y = 800 running straight across; the grid scrolls slowly toward the viewer.
**Pelican:** smooth pastel gradient fills, cyan/magenta chromatic-aberration edges, a little glint; long soft
reflection on the glossy floor.
**Gag (required, synchronised with the score): the tape skips.** The music in this section is a slowed cassette that,
in bar 2, repeats one quarter-second four times: for **t ∈ [2.5, 3.5)** the picture does the same — draw the pelican
with `env.poseAt(2.5 + ((t - 2.5) % 0.25))` so it jerks back to the same spot four times, with a VHS tear band,
colour-channel split and a jump of the scanlines on each repeat; at t = 3.5 everything resumes (it jumps ahead to where
it should be). The bust's head turns to follow the pelican in a few discrete steps, unimpressed. Also: on entry
(t = 0–0.5) a brief tape slow-down smear; on exit (t ≈ 5.6–6) the image tightens up as the tape comes back to speed.
**Title card:** wide-tracked capitals and full-width-style lettering in the image (zh / en / date), with a thin
outlined label box — in the style, but legible and high-contrast.
**Before / after:** grid scrolling, palms swaying, sun stripes drifting; the bust keeps looking where the pelican went.
**Music here:** slowed-down 1980s shopping-mall cassette.
