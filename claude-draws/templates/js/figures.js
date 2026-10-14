// =====================================================================================
// claude-draws: cut-out characters (a painted puppet on a skeleton)
// -------------------------------------------------------------------------------------
// How TV cut-out animation works, done in code: every body part is PAINTED ONCE as a
// small watercolour sprite (with E.paint + E.finish, so it has the same pigment edges and
// granulation as the background), then every frame the parts are placed on a skeleton
// and rotated at the joints. The ink outline of each part moves with it, and can draw
// itself on screen during the intro like the rest of the picture.
//
// Coordinates of a part: its joint (pivot) is at (0, 0) and the limb hangs DOWN (+y).
// The torso is the exception: its pivot is the hip and it goes UP (-y) to the shoulders.
// The head's pivot is the neck; the head sits above it (-y).
// A figure faces RIGHT (+x). face: -1 mirrors it to face left.
//
// Angles (radians) follow canvas rotation: for a limb that hangs down,
//   negative = swings FORWARD (toward the way it faces), positive = swings back.
//   knee  > 0 bends the shin back (a normal knee)
//   elbow < 0 bends the forearm forward (a normal elbow)
//   wrist > 0 lets the hand droop (zombie hands), 0 = straight
//
//   const fig = E.makeFigure("zombie-1", {
//     bones: { torso: 100, neck: [10, -98], shoulderN: [4, -86], shoulderF: [-6, -88],
//              hipN: [5, 0], hipF: [-5, 0], upperArm: 58, foreArm: 52, thigh: 70, shin: 66, foot: 10 },
//     parts: { torso, head, upperArm, foreArm, hand, thigh, shin },   // see bakePart below
//            (optional far-side versions: shinF, thighF, upperArmF, foreArmF, handF)
//     ink: { t0: 0.9, t1: 1.8, w: 2.4, a: 0.85 },                    // when its outline draws itself
//   });
//   // per frame (pose from a gait helper below, or hand-made):
//   fig.draw(g, pose, { inkP: 1 });   // inkP = how much of the outline is drawn (0..1)
//
// Readability rules learned the hard way (see references/characters.md):
//   - big head (1/4 to 1/5 of the height), clear silhouette, arms away from the body
//   - far-side arm and leg darker than the near side (instant depth)
//   - a soft contact shadow under the feet, or the figure floats
// =====================================================================================
(function () {
  const { mk, finish, seed, lerp } = E;

  // A part = { box: [x0, y0, x1, y1] (area it paints in, local coords),
  //            paint(g)  -> paints the part in local coords (called once, seeded),
  //            outline: [[x, y], ...] closed shape for the ink line (optional),
  //            edges: [[[x, y], ...], ...] open ink lines at full weight (limb sides, see E.limb)
//            lines: [[[x, y], ...], ...] extra thinner ink lines (optional, e.g. a hat brim) }
  function bakePart(name, part, inkOpt) {
    const pad = 14;
    const [x0, y0, x1, y1] = part.box;
    const w = x1 - x0 + pad * 2,
      h = y1 - y0 + pad * 2;
    seed(name);
    const c = mk(w, h),
      g = c.getContext("2d");
    g.translate(pad - x0, pad - y0);
    part.paint(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    finish(c, { edge: 0.35, blur: 3, gran: 0.45, granX: (name.length * 97) % 400, granY: (name.length * 53) % 700 });
    // the far-side copy: same part, in shadow (darker, a little cooler)
    const f = mk(w, h),
      fg = f.getContext("2d");
    fg.drawImage(c, 0, 0);
    fg.globalCompositeOperation = "source-atop";
    fg.fillStyle = "rgba(52,40,78,0.34)";
    fg.fillRect(0, 0, w, h);
    seed(name + "-ink");
    const lines = [];
    if (part.outline) lines.push(E.makeLine(part.outline, 0, 1, { closed: true, w: inkOpt.w ?? 2.4, a: inkOpt.a ?? 0.85, gaps: true, wob: 0.6 }));
    // open outlines at full weight (limbs: only the joint end that is ON TOP gets a line)
    for (const L of part.edges || []) lines.push(E.makeLine(L, 0, 1, { w: inkOpt.w ?? 2.4, a: inkOpt.a ?? 0.85, gaps: false, wob: 0.6 }));
    for (const L of part.lines || []) lines.push(E.makeLine(L, 0, 1, { w: (inkOpt.w ?? 2.4) * 0.75, a: (inkOpt.a ?? 0.85) * 0.8, gaps: false, wob: 0.5 }));
    return { near: c, far: f, ox: x0 - pad, oy: y0 - pad, lines };
  }

  E.makeFigure = function (name, spec) {
    const F = { spec, bones: spec.bones, parts: {} };
    for (const [k, part] of Object.entries(spec.parts)) F.parts[k] = bakePart(name + "-" + k, part, spec.ink || {});
    const ink = spec.ink || {};
    // each part's outline draws in turn: torso, head, legs, arms
    const order = ["torso", "head", "thigh", "shin", "upperArm", "foreArm", "hand"];
    const t0 = ink.t0 ?? 0,
      t1 = ink.t1 ?? 1;
    order.forEach((k, i) => {
      const T = [lerp(t0, t1, i / order.length) - 0.05, lerp(t0, t1, (i + 1.6) / order.length)];
      if (F.parts[k]) F.parts[k].inkT = T;
      if (F.parts[k + "F"]) F.parts[k + "F"].inkT = T;
    });

    function part(g, k, far, o) {
      // a part named e.g. "shinF" replaces "shin" on the far side (one shoe on, one off)
      const P = (far && F.parts[k + "F"]) || F.parts[k];
      if (!P) return;
      if (o.paint !== false) {
        g.drawImage(far ? P.far : P.near, P.ox, P.oy);
        // per-frame details drawn in the part's own coordinates (a singing mouth, blinking eyes)
        if (o.overlay && o.overlay[k]) o.overlay[k](g, far);
      }
      if (o.ink !== false) {
        const p = o.inkT === undefined ? 1 : E.ramp(o.inkT, P.inkT[0], P.inkT[1]);
        for (const ln of P.lines) E.drawLine(g, ln, p, far ? 0.7 : 1);
      }
    }
    function arm(g, a, sh, far, o) {
      const B = F.bones;
      g.save();
      g.translate(sh[0], sh[1]);
      g.rotate(a[0]);
      part(g, "upperArm", far, o);
      g.translate(0, B.upperArm);
      g.rotate(a[1]);
      part(g, "foreArm", far, o);
      g.translate(0, B.foreArm);
      g.rotate(a[2] || 0);
      part(g, "hand", far, o);
      g.restore();
    }
    function leg(g, l, hip, far, o) {
      const B = F.bones;
      g.save();
      g.translate(hip[0], hip[1]);
      g.rotate(l[0]);
      part(g, "thigh", far, o);
      g.translate(0, B.thigh);
      g.rotate(l[1]);
      part(g, "shin", far, o);
      g.restore();
    }
    // pose = { x, y: hip position, s: scale, face: 1 | -1, lean, head,
    //          armN: [shoulder, elbow, wrist], armF, legN: [hip, knee], legF }
    // o = { paint: true/false, ink: true/false, inkT: seconds for the self-drawing ink,
    //       overlay: { head: (g, far) => {...} } per-frame drawing in a part's coordinates }
    F.draw = function (g, pose, o = {}) {
      const B = F.bones;
      g.save();
      g.translate(pose.x, pose.y);
      g.scale(pose.s * (pose.face || 1), pose.s);
      // far arm (behind the body), in the torso's frame
      g.save();
      g.rotate(pose.lean || 0);
      arm(g, pose.armF, B.shoulderF, true, o);
      g.restore();
      leg(g, pose.legF, B.hipF, true, o);
      leg(g, pose.legN, B.hipN, false, o);
      g.save();
      g.rotate(pose.lean || 0);
      part(g, "torso", false, o);
      g.save();
      g.translate(B.neck[0], B.neck[1]);
      g.rotate(pose.head || 0);
      part(g, "head", false, o);
      g.restore();
      arm(g, pose.armN, B.shoulderN, false, o);
      g.restore();
      g.restore();
    };
    // how far below the hip the lowest foot reaches (so the feet stay on the ground)
    F.legDrop = function (l) {
      const B = F.bones;
      return B.thigh * Math.cos(l[0]) + B.shin * Math.cos(l[0] + l[1]) + (B.foot || 0);
    };
    F.hipY = function (pose, groundY) {
      return groundY - pose.s * Math.max(F.legDrop(pose.legN), F.legDrop(pose.legF));
    };
    return F;
  };

  // A limb as a capsule (rounded at both ends, so joints overlap smoothly) + its ink.
  // Parts drawn later sit ON TOP: forearm over upper arm, shin over thigh, hand over
  // forearm, torso over thighs. Draw ink only on the end that shows (inkTop/inkBottom),
  // otherwise a line cuts across every knee and elbow and the figure looks like a robot.
  //   E.limb(length, widthTop, widthBottom, { inkTop: true, inkBottom: false })
  //   -> { shape: closed points (paint it), edges: open lines (pass as part.edges) }
  E.limb = function (len, w0, w1, o = {}) {
    const r0 = w0 / 2,
      r1 = w1 / 2,
      n = 8;
    const right = [],
      left = [],
      top = [],
      bot = [];
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI; // top cap, left to right over the top
      top.push([Math.cos(a) * r0, Math.sin(a) * r0]);
      const b = (i / n) * Math.PI; // bottom cap, right to left under the bottom
      bot.push([Math.cos(b) * r1, len + Math.sin(b) * r1]);
    }
    for (let i = 1; i < 6; i++) {
      const k = i / 6;
      right.push([lerp(r0, r1, k), len * k]);
      left.push([lerp(-r1, -r0, k), len * (1 - k)]);
    }
    const shape = [...top, ...right, ...bot, ...left];
    const edges = [];
    const sideR = [[r0, 0], ...right, [r1, len]],
      sideL = [[-r1, len], ...left, [-r0, 0]];
    if (o.inkTop && o.inkBottom) edges.push([...top, ...right, ...bot, ...left, top[0]]);
    else if (o.inkTop) edges.push([...sideL, ...top, ...sideR]);
    else if (o.inkBottom) edges.push([...sideR, ...bot, ...sideL]);
    else edges.push(sideR, sideL);
    return { shape, edges };
  };

  // soft contact shadow under a figure (draw it BEFORE the figure)
  E.figureShadow = function (g, x, groundY, s, col = "rgba(70,48,92,0.28)", stretch = 1) {
    g.save();
    const r = g.createRadialGradient(x, groundY, 2, x, groundY, 70 * s * stretch);
    r.addColorStop(0, col);
    r.addColorStop(1, "rgba(70,48,92,0)");
    g.fillStyle = r;
    g.translate(x, groundY);
    g.scale(1, 0.2);
    g.translate(-x, -groundY);
    g.beginPath();
    g.arc(x, groundY, 70 * s * stretch, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  // ---------- gaits: limb angles over time ----------
  // Both return { dx (distance travelled, px at scale 1), lean, head, armN, armF, legN, legF }
  // tau = seconds since the figure started walking.
  E.gait = {
    // an ordinary relaxed walk
    walk(tau, o = {}) {
      const T = o.period ?? 1.1,
        v = o.speed ?? 70;
      const w = (2 * Math.PI) / T,
        ph = w * tau + (o.phase ?? 0);
      const legAt = (p) => [-0.38 * Math.sin(p), 0.08 + 0.75 * Math.pow(Math.max(0, Math.cos(p)), 1.6)];
      return {
        dx: v * tau,
        lean: 0.04,
        head: -0.02 + 0.02 * Math.sin(2 * ph),
        legN: legAt(ph),
        legF: legAt(ph + Math.PI),
        armN: [0.3 * Math.sin(ph), -0.25, 0],
        armF: [0.3 * Math.sin(ph + Math.PI), -0.25, 0],
      };
    },
    // a zombie shamble: one good leg that swings, one stiff leg that drags, a lurch
    // forward on every good step, arms held out in front, head lolling a beat late.
    // o.wake (0..1) blends from slumped-and-still (0) to fully awake (1).
    shamble(tau, o = {}) {
      const T = o.period ?? 1.8,
        v = o.speed ?? 42;
      const w = (2 * Math.PI) / T;
      const tw = Math.max(0, tau);
      const ph = w * tw + (o.phase ?? 0);
      const wake = o.wake ?? 1;
      const moving = E.smooth(E.clamp(tau / 0.6)); // ease into the first step
      // forward distance with a lurch once per cycle (speed never goes below zero)
      const c = 0.9;
      const dx = v * (tw + (0.65 / w) * (Math.cos(c) - Math.cos(w * tw + c)));
      const good = [-0.36 * Math.sin(ph) + 0.04, 0.06 + 0.62 * Math.pow(Math.max(0, Math.cos(ph)), 1.5)];
      const bad = [-0.2 * Math.sin(ph + Math.PI) + 0.14, 0.05 + 0.1 * Math.max(0, Math.cos(ph + Math.PI))];
      const still = [0.02, 0.06];
      const mixL = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
      const armOut = (off) => [-1.42 + 0.09 * Math.sin(ph + off) + (o.armDroop ?? 0), -0.18 + 0.08 * Math.sin(ph + off + 1), 0.95];
      const armDown = [0.12, -0.08, 0.3];
      const mixA = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      const wa = E.smooth(E.clamp(wake * 1.25)); // arms come up first, then the walk
      return {
        dx: dx * moving,
        lean: lerp(0.32, 0.2 + 0.06 * Math.sin(ph), wake),
        head: lerp(0.55, 0.14 + 0.13 * Math.sin(ph - 0.9) + (o.headTilt ?? 0), wake),
        legN: mixL(still, good, moving),
        legF: mixL(still, bad, moving),
        armN: mixA(armDown, armOut(0), wa),
        armF: mixA(armDown, armOut(1.4), wa),
      };
    },
  };
})();
