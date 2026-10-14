# The watercolour + ink look: how professionals do it, and the code settings for it

Read this before you draw. Each idea below comes from how real painters and animation studios
work, followed by how to do it with `engine.js`.

## 1. Big shapes first, then thin layers, then details (Ghibli background painters)

Kazuo Oga and the Studio Ghibli background painters block in the large masses first (sky, land,
water, the main building) in flat-ish colour, then build depth with many thin transparent layers,
and only at the end add small details (tile rows, leaves, flowers, pebbles).

In code:
- Paint the scene as **layers, back to front**, each in its own canvas made once in `build()`:
  sky → clouds → far land → sea → middle ground → main subject → foreground.
  `S.sky = E.layer("sky", (g) => { ... }, { edge: 0.15, gran: 0.35 })`
- A wash is many thin copies: `E.paint(g, shape, colour, { n: 20, a: 0.06 })`. More layers at
  lower alpha = richer, more even colour. Fewer at higher alpha = bolder, patchier.
- Details go last, inside the shape they belong to: `E.paintIn(g, wallShape, () => { ...mottling, cracks... })`.
- Squint test: the picture must read as 3-5 big value shapes (dark sky / light horizon / mid
  house / light sand). If it does not, fix the big shapes before adding any detail.

## 2. Depth from layers that move at different speeds (Cartoon Saloon, multiplane camera)

Cartoon Saloon films (Song of the Sea, Wolfwalkers) and the old Disney multiplane camera get depth
by sliding painted layers at different speeds. Far things move little, near things move more.

In code: `setCam(g, depth)` before drawing each layer, with a slow push-in
(`S.camAt = (t) => 0.04 * ease(t, 1.2, 6.5)`). Depth: sky 0.2, far land/sea 0.3, house 0.6-0.7,
characters 0.7-1.0 (by how close they stand), foreground palm and grass 1.3.
Also: clouds drift, sea glitters, leaves flutter. A painting that is completely still looks broken.

## 3. What makes watercolour look like watercolour (the physics)

Research on watercolour simulation (Curtis et al., "Computer-Generated Watercolor", SIGGRAPH 1997,
and Tyler Hobbs' generative watercolour method) names the effects you must have:

| Real effect | Why it happens | Code |
| --- | --- | --- |
| **Edge darkening** | pigment flows to the rim of a drying wash | `E.finish(layer, { edge: 0.3-0.45 })` |
| **Granulation** | pigment settles in the paper's valleys | `E.finish(layer, { gran: 0.3-0.6 })` (more on sand, stone, walls) |
| **Uneven, living edges** | water carries pigment unevenly | `v` in `E.paint`: 0.004-0.01 for buildings, 0.03-0.05 for objects, 0.1-0.15 for clouds, foliage, wet-in-wet |
| **Wet-in-wet blooms** | colour dropped into a wet wash | many large soft ellipses at low alpha over a graded wash (see the sky in scene.js) |
| **Glazing** | a thin dark layer over a dry one shifts the colour | a second `E.paint` of a cool violet at `a: 0.04-0.06` over a shadow side |
| **Paper texture** | the paint sits IN the paper | `E.makePaper()` + the grain multiplied over every frame (index.html does it) |
| **White = the paper** | watercolourists leave whites unpainted | keep highlights light; avoid pure white fills |

Do not use `ctx.filter = "blur()"` on whole layers to look "soft": blur looks digital. Softness
comes from high `v` and many low-alpha layers.

## 4. Ink lines (urban sketch style)

Sketchers draw confident lines that overshoot at the corners, wobble slightly, thin out at the
ends (pen pressure), and leave small gaps where the pen lifted. `E.sketchLines(points, t0, t1)`
does all of that, one stroke per straight side; `E.makeLine` for curves (trunks, outlines).
- Draw the ink **first** in the intro (lines draw themselves in drawing order: big outline,
  then roof, then windows, then details), then let it **step back** to ~40% once the paint is in.
  Full-strength ink over a finished painting looks like a colouring book.
- Line weight: 2.2-2.6 px for main outlines at 1080 wide, 1.6-1.9 for details, alpha 0.6-0.85.
- Warm sepia-black (`#33241d`), never pure black.
- Never let a line cross something it should stop at (a roof line running through a window).

## 5. Colour and light by time of day

Pick the light first; every colour follows from it.
- **Dusk / golden hour**: light from behind or low at the side. Fronts in cool violet shade, warm
  rim light on the top edges, long lavender shadows, sky from deep indigo down to peach at the
  horizon, warm lamp light in windows (a beautiful complement to the cool shade).
- **Monsoon rain**: low contrast, grey-green, mist layers between depths, wet surfaces reflect the
  sky, rain in 3 depth layers at different speeds and sizes, splashes on hard surfaces.
- **Bright noon**: high contrast, short shadows straight down, saturated colours, white clouds.
- **Night / moonlight**: blue-violet everything, one strong light (moon, lamp, fire), glints on water
  in a path under the moon, a few stars, fireflies or lamps as small warm accents.
- Complementary pairs read instantly on a phone: turquoise house against an orange sky, green
  zombies against pink sand, a warm window in a cool wall.

## 6. Readability on a phone (the reel test)

The viewer sees it on a 6-inch screen for a few seconds. At thumbnail size:
- the main subject must be identifiable in under a second (big, clear silhouette, contrast),
- nothing important under the bottom ~20% or in the top ~10% of a vertical frame (app buttons, captions),
- one focal point per moment; let everything else be quieter (lower contrast, smaller detail).

## Typical `E.paint` settings that worked

| Material | n | a | v | finish |
| --- | --- | --- | --- | --- |
| Lime-washed wall | 24-26 | 0.075 | 0.006 | edge 0.35, gran 0.6 |
| Roof tiles base | 24 | 0.085 | 0.006 | edge 0.45, gran 0.6 |
| Sky blooms | 9 | 0.05 | 0.13 | edge 0.15, gran 0.35 |
| Clouds | 9-12 | 0.07-0.08 | 0.12-0.14 | edge 0.35, gran 0.3 |
| Foliage blobs | 6-8 | 0.05-0.08 | 0.12 | edge 0.4, gran 0.5 |
| Sand / ground | 5-16 | 0.05-0.08 | 0.01-0.1 | edge 0.12, gran 0.6 |
| Character parts | 10-16 | 0.16-0.22 | 0.006-0.01 | edge 0.35, blur 3, gran 0.45 (figures.js) |
