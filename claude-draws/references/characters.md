# Characters that read at phone size

People, animals and creatures are the hardest part. Use `js/figures.js`: a cut-out rig, the way
TV cut-out animation works. Each body part is painted ONCE as a small watercolour sprite (same
pigment edges and granulation as the background), and every frame the parts are placed on a
skeleton and rotated at the joints. `examples/zombies.js` is a complete worked example.

## Design rules (each one came from a snapshot that looked wrong)

1. **Big head, clear silhouette.** Head about 1/4 to 1/5 of the height for cartoon characters.
   Arms held away from the body. Fill the figure out against the background in your head: if the
   black shape does not say "zombie" / "cat" / "fisherman", change the pose, not the details.
2. **No stick figures.** Real proportions or a deliberate cartoon style, limbs with width
   (arms 20-25 px, legs 25-31 px at scale 1 for a ~330 px tall figure), hands with fingers.
3. **Smooth shapes.** Few-point polygons look faceted (the first zombie heads looked like
   octagons). Run outlines through `E.smoothP(points, 2)`.
4. **Rounded joints, ink only where it shows.** Build limbs with `E.limb(length, wTop, wBottom,
   { inkTop, inkBottom })`. Parts drawn later sit on top (forearm over upper arm, shin over thigh),
   so ink only that visible end. A line across every knee and elbow makes a robot.
5. **Far side darker.** The rig paints a shadowed copy of every part for the far arm and leg:
   instant depth. Draw order: far arm, far leg, near leg, torso, head, near arm.
6. **Both arms must read.** If the far arm hides exactly behind the near one, raise it a little.
7. **Contact shadow under the feet** (`E.figureShadow`) or the figure floats.
8. **Big enough.** The nearest character should be at least ~1/6 of the frame height
   (~330 px of 1920). Smaller than that and faces are just dots on a phone.
9. **Funny, not scary** when that is the brief: googly mismatched eyes, one tooth, a tongue,
   costume props that tell a joke (tourist with a camera, swimmer with a duck float ring,
   office worker with a loose tie, a lifeguard in a straw hat). Never gore.
10. **Colour that separates.** Characters in colours that contrast with what is behind them
    (green-grey skin on pink sand). A soft dusk grade over everything keeps them in the same world.

## Motion rules

- **Paths go somewhere.** Characters walk toward the story's goal (the house door), on a slant
  up the frame, getting a little smaller as they recede. In the first zombie draft two zombies
  walked into each other in the middle and it read as them grabbing each other.
- **Feet stay on the ground.** `fig.hipY(pose, groundY)` puts the lowest foot on the ground every
  frame, which also gives a natural bob.
- **A beat before the action.** The zombies stand slumped while the paint arrives, then their arms
  rise (the "wake up"), then they shamble. Stagger the starts by 0.1-0.4 s so they do not move like
  a chorus line.
- **Gaits** (`E.gait.walk`, `E.gait.shamble`) return limb angles over time. Make your own for
  other creatures: an angle per joint as a sine of the step phase, the knee bending mainly during
  the swing, a lag on the head.
- **Singing / talking**: leave the mouth out of the head sprite and draw it every frame with an
  `overlay` (`fig.draw(g, pose, { overlay: { head: (g) => drawMouth(g, open) } })`), opening on each
  syllable. Throw the head back a little and dip the knees on every note; sway the whole group
  together. One singer always a beat late is funny. See `examples/zombies_lalala.js`.
- Check motion with a strip of 8-16 consecutive frames, not just stills (see self-check-loop.md).

## Building a new character

```js
const TORSO = E.smoothP([/* points around the torso, hip at (0,0), shoulders up at y = -100 */], 2);
const HEAD = E.smoothP([/* points around the head, neck at (0,0), facing right (+x) */], 2);
const UPPER = E.limb(56, 25, 21, { inkTop: true }); // { shape, edges }: paint UPPER.shape
const fig = E.makeFigure("cat-rider", {
  bones: { torso: 100, neck: [8, -100], shoulderN: [4, -88], shoulderF: [-4, -90], hipN: [5, -4], hipF: [-5, -4],
           upperArm: 56, foreArm: 50, thigh: 68, shin: 64, foot: 10 },
  parts: {
    torso: { box: [-50, -112, 50, 16], outline: TORSO, paint(g) { /* E.paint the shirt, pattern, props */ } },
    head:  { box: [-46, -104, 72, 10], outline: HEAD,  paint(g) { /* face, eyes, hair, hat */ } },
    upperArm: { box: [-15, -15, 15, 70], edges: UPPER.edges, paint(g) { /* skin + sleeve */ } },
    // foreArm, hand, thigh, shin (+ optional shinF etc. for a different far-side foot)
  },
  ink: { t0: 0.9, t1: 1.8, w: 2.5, a: 0.85 }, // when its outline draws itself in the intro
});
E.CAST.push({
  depth: 0.9,                         // camera depth (bigger = nearer)
  groundY: (t) => 1700,               // where its feet are (for depth sorting)
  draw(g, t, o) {
    const gt = E.gait.walk(t - 1.0);  // seconds since it started walking
    const pose = { x: 200 + gt.dx, y: 0, s: 1, face: 1, lean: gt.lean, head: gt.head,
                   armN: gt.armN, armF: gt.armF, legN: gt.legN, legF: gt.legF };
    pose.y = fig.hipY(pose, 1700);
    if (o.paint !== false) E.figureShadow(g, pose.x, 1702, 1);
    fig.draw(g, pose, o);
  },
});
```

Not every subject is a biped. For an animal, a vehicle or a boat, use the same idea without the
rig: paint the parts once in `build()` (body, wheels, tail, ears), then each frame `translate` /
`rotate` them with simple sine motions (wheels spin, body bobs, tail swishes, ears flick).
