# 20 — Code Aesthetics · 2020s (the era of large language models) · film 119–125 s
**Looks like:** a clean, dark code editor with a live preview — calm spacing, a good monospaced face
(`K.FONT.mono`), restrained syntax colours, hairline dividers. Your own theme; no real product's logo or chrome.
**Layout:** upper ~55 %: the editor (tab "pelican.svg", line numbers, soft current-line highlight, cursor). Lower
~45 %: the preview pane, full width, with a faint dot grid and a thin baseline guide on the road (y = 800) with tick
marks. A slim status bar. The **title card** is the header strip of the window: zh large, en and date beside it in the
editor's type.
**Required:** "SVG code appears line by line … The cycling pelican takes shape stroke by stroke, becoming the most
refined submission in the film." The pelican rides through the preview while it is being drawn:
- t 0–0.6: construction — thin guide circles for the wheels, bézier handles and anchor dots, a bounding box;
- t 0.6–2.0: outlines drawn on, path by path, each with a travelling pen point (reveal each `Rig.parts` path by
  arc-length; order them like code would: wheels, frame, body, neck, head, beak, legs);
- **t = 2.0 (bar 2 downbeat): fills arrive** — flat colours pop in part by part on the eighth-notes;
- t 3.0–4.0: refinement — gradients, soft shading, feather detail, spoke highlights, a drop shadow, guides fade;
- **t = 4.0:** the closing `</svg>` line, a quiet "✓ valid · 2.1 kB" in the status bar; it rides on, finished.
The code (≈ 22–26 lines of plausible, tidy SVG: `<svg viewBox>`, `<defs>` with gradients, `<circle class="wheel">`,
`<path d="M…" class="beak">` …) appears **one line per step in sync** with what is being drawn; the newest line is
highlighted; long lines wrap never — keep them short. A type-on reveal within the newest line is welcome.
**The finished pelican must be the best-looking pelican in the film**: confident vector illustration — clean curves,
considered palette, subtle gradients and rim light, layered wing feathers, a glossy eye highlight, crisp bicycle with
hub and spoke detail, soft ground shadow.
**Before:** an empty file with the cursor blinking; preview shows only the grid and baseline. **After (t > 6):** the
complete file, cursor at rest.
**Music here:** clean piano and synth.
