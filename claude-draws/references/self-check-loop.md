# The self-check loop: snapshot, list what is wrong, fix, repeat

The single most useful habit. Code that "should" draw a boat on the water often draws a boat
floating above it. You only find out by looking.

## How

1. Snapshot at least 6 moments that matter (first frame, mid-intro, end of the wash, each story
   beat, the last frame):
   ```bash
   npx hyperframes snapshot --at 0,1,2,3,4.5,5.9 --no-end --describe false -o .snap/r1
   ```
   (`--describe false` skips the optional Gemini description. Use a new folder each round.)
2. Look at `.snap/r1/contact-sheet.jpg` for the whole story, then **zoom**: crop faces, hands,
   joints, small props and look at them full size:
   ```bash
   ffmpeg -y -i .snap/r1/frame-03-at-3s.png -vf "crop=1080:700:0:1240" .snap/r1/zoom.png
   ```
3. Write a numbered list of what looks wrong (in `PLAN.md`, so the user can see the trail).
   Be specific: "the palm fronds hang over the roof", not "looks off".
4. Fix the list, snapshot again into `.snap/r2`, compare. Repeat until the list is empty.
5. After rendering, check MOTION: a strip of consecutive frames of anything that moves.
   ```bash
   ffmpeg -y -ss 3.0 -i renders/film_v1.mp4 -frames:v 16 \
     -vf "select='not(mod(n\,2))',crop=520:620:20:1250,scale=260:310,tile=8x1" -frames:v 1 strip.png
   ```
   Look for feet sliding, parts popping, jitter, things moving in lockstep.

## Checklist

**Reads on a phone**
- [ ] The subject is clear in the first ~2 seconds at thumbnail size (squint at the sheet).
- [ ] Nothing important in the bottom ~20% or top ~10% of a vertical frame.
- [ ] Characters are big enough (nearest one at least ~1/6 of the frame height).
- [ ] One focal point per moment.

**Drawing**
- [ ] Objects touch what they stand on (boats sit IN the water, feet ON the ground, houses have a base).
- [ ] Reflections mirror at the waterline, directly below the object.
- [ ] No ink line runs through something it should stop at.
- [ ] Nothing hangs in front of the main subject by accident (palm fronds over the roof).
- [ ] Shadows fall away from the light and are soft, not grey boxes.
- [ ] Layers that drift cover the whole frame at every moment (no straight cut-off edge).
- [ ] No stick figures; faces and hands readable when zoomed.
- [ ] Shapes are smooth (no faceted polygons) and joints do not show lines across them.

**Watercolour look**
- [ ] Washes have uneven living edges and darker rims; textures granulate; paper grain is visible.
- [ ] Ink steps back after the paint arrives (about 40%), it does not stay at full strength.
- [ ] Highlights come from light paint / paper, not pure white stickers.

**Motion and time**
- [ ] Something gentle is always moving (leaves, water, clouds, light), nothing jitters.
- [ ] Characters move toward a goal, not into each other; starts are staggered.
- [ ] The first frame is already interesting (lines partly drawn, not blank paper).
- [ ] The last second holds long enough to read.

## Real catches (what this loop found in the builds behind this skill)

Goa monsoon film (24 s):
- the fishing canoe looked like it stood on stilts, and its reflection floated far below it
- a pencil line ran straight across the windows of the house
- palm leaves hung over the roof (moved the palms out so they frame the house)
- sun shadows looked like dull grey boxes; rain was invisible against bright walls
- birds too small to see; clouds cut off in a straight line at the edge of the sky
- puddles looked like grey plates with stripes; sparkles looked like stickers
- a stick-figure fisherman (rebuilt with real proportions and a lungi)
- the scene change looked like a glitch box (now a fresh wash paints down the page)

Zombie beach (6 s), the demo for this skill:
- the near palm's fronds hung over the roof and pediment, and its trunk crowded the house
- the side window stayed lit when the lights went off
- zombie heads looked faceted (octagons) → smoothed outlines
- ink lines crossed every knee and elbow (robot look) → capsule limbs with ink only on the visible end
- arms too thin, the far arm hidden exactly behind the near arm → thicker arms, far arm raised
- zombies too small for a phone, contact shadows invisible → 20% bigger, darker shadows
- two zombies walked into each other mid-frame (read as grabbing each other) → paths slant up
  toward the house door and shrink with distance

Zombie choir, "la la la" version (6 s, judged in the 1000 px band the reel shows):
- lettering too thin and small for a phone → 30% bigger, thicker pen
- music notes spawned on top of faces → they start in front of and above the mouth
- mouths too small to read as singing → wider opening, head thrown back on each "la"
- the long "la la la la la" and its wash hid the two back zombies' heads → back pair moved
  out, lettering raised, wash tighter but denser so the ink reads over white pillars
