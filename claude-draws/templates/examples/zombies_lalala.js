// =====================================================================================
// The cast, "la la la" version: four cartoon zombies singing in a little choir in front
// of the house. Mouths open on every "la", heads sway together, ink lettering writes
// itself and music notes float up. (Prompt: "a house on a beach with zombies in it, la la la la la")
// Funny, not scary: big heads, mismatched googly eyes, one tooth, beach clothes.
// Built on figures.js (painted cut-out parts on a skeleton) and added to E.CAST,
// so the scene draws them on the sand in depth order. No scene edits needed.
//
// What makes them read as ZOMBIES at phone size (checked on snapshots):
//   green-grey skin, both arms held straight out in front, hands drooping,
//   torn clothes with ragged hems, a stiff dragging leg, head lolling to one side.
// =====================================================================================
(function () {
  const { R, rr, hex, rgba, mix, lerp, ease, rectP, polyP, ellP, paint, paintIn, fillPoly } = E;

  // ---------- painting helpers for parts ----------
  const wash = (g, pts, col, o = {}) => paint(g, polyP(pts, 2), col, { n: o.n ?? 10, a: o.a ?? 0.16, v: o.v ?? 0.008, d: 2, bd: 1, cj: 5 });
  const blob = (g, x, y, rx, ry, col, a = 0.18, v = 0.05) => paint(g, ellP(x, y, rx, ry, 14), col, { n: 6, a, v, d: 2, bd: 1, cj: 4 });
  const solid = (g, pts, col) => {
    g.fillStyle = col;
    fillPoly(g, pts);
  };
  const stroke = (g, pts, col, w) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.stroke();
  };
  // ragged torn edge between two points (cloth hem)
  function ragged(a, b, n, depth, seedOff = 0) {
    const P = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const off = i % 2 ? depth * (0.6 + 0.8 * E.hash(i + seedOff, 7)) : 0;
      P.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k) + off]);
    }
    return P;
  }

  // ---------- body shapes (local coordinates, see figures.js) ----------
  const TORSO_RAW = [
    [-26, 8],
    [-30, -22],
    [-31, -56],
    [-28, -84],
    [-18, -98],
    [0, -104],
    [16, -101],
    [27, -90],
    [31, -66],
    [34, -40],
    [30, -14],
    [28, 8],
  ];
  const HEAD_RAW = [
    [26, -4],
    [10, 0],
    [-10, -8],
    [-26, -28],
    [-29, -50],
    [-20, -70],
    [-2, -80],
    [20, -76],
    [34, -60],
    [38, -50],
    [46, -42],
    [41, -35],
    [42, -27],
    [38, -18],
    [36, -10],
  ];
  const TORSO = E.smoothP(TORSO_RAW, 2),
    HEAD = E.smoothP(HEAD_RAW, 2);
  // limbs are capsules: rounded joints that overlap smoothly (see E.limb in figures.js)
  const UPPER_L = E.limb(56, 25, 21, { inkTop: true }); // shoulder shows, elbow end hides under the forearm
  const FORE_L = E.limb(50, 21, 17, { inkTop: true }); // elbow shows, wrist hides under the hand
  const THIGH_L = E.limb(68, 31, 25, {}); // hip hides under the shirt, knee under the shin
  const UPPER = UPPER_L.shape,
    FORE = FORE_L.shape,
    THIGH = THIGH_L.shape;
  const HAND = E.smoothP(
    [
      [-9, -3],
      [9, -3],
      [13, 7],
      [18, 17],
      [11, 15],
      [9, 30],
      [4, 32],
      [2, 19],
      [1, 35],
      [-3, 35],
      [-4, 19],
      [-6, 31],
      [-10, 30],
      [-10, 13],
    ],
    1,
  );
  // shin: a rounded knee on top (it sits over the thigh), then the foot pointing forward
  const SHIN = E.smoothP(
    [
      [-12, 0],
      [-8, -9],
      [0, -12],
      [8, -9],
      [12, 0],
      [10, 40],
      [10, 58],
      [24, 62],
      [31, 68],
      [31, 75],
      [-12, 75],
      [-11, 58],
      [-11, 40],
    ],
    2,
  );
  const BONES = { torso: 100, neck: [8, -100], shoulderN: [4, -88], shoulderF: [-4, -90], hipN: [5, -4], hipF: [-5, -4], upperArm: 56, foreArm: 50, thigh: 68, shin: 64, foot: 10 };

  // ---------- one zombie, from a costume ----------
  function makeZombie(id, C) {
    const SK = C.skin,
      SKD = mix(hex(SK), [52, 70, 64], 0.45),
      SKL = mix(hex(SK), [236, 240, 200], 0.35);
    const skinD = rgba(SKD, 1),
      skinL = rgba(SKL, 1);
    const DARK = "#2e2230";

    // shading that every skin part gets: darker on the back edge, light on the front
    const shadeSkin = (g, pts, x0, x1) => {
      paintIn(g, pts, () => {
        paint(g, rectP(x0 - 6, -120, x0 + (x1 - x0) * 0.35, 120, 2), skinD, { n: 5, a: 0.07, v: 0.02, d: 2, bd: 1 });
        paint(g, rectP(x1 - (x1 - x0) * 0.25, -120, x1 + 6, 120, 2), skinL, { n: 4, a: 0.06, v: 0.02, d: 2, bd: 1 });
      });
    };

    const parts = {};
    // ----- torso: trousers/shorts at the hips, a torn shirt over it -----
    parts.torso = {
      box: [-50, -112, 50, 16],
      outline: TORSO,
      paint(g) {
        wash(g, [[-31, -24], [31, -24], [29, 9], [-27, 9]], C.pants, { n: 12, a: 0.2 });
        // neck skin showing above the collar
        wash(g, [[-8, -104], [16, -104], [12, -86], [0, -90]], SK, { a: 0.25 });
        const hem = ragged([31, -14], [-30, -18], 9, 9, id.length);
        const shirt = [[-28, -84], [-18, -98], [-6, -103], [4, -92], [16, -101], [27, -90], [31, -66], [34, -40], ...hem, [-31, -56]];
        wash(g, shirt, C.shirt, { n: 14, a: 0.2 });
        paintIn(g, shirt, () => {
          if (C.pattern === "flowers")
            for (let i = 0; i < 26; i++) {
              const x = rr(-30, 32),
                y = rr(-100, -18);
              for (let k = 0; k < 5; k++) blob(g, x + Math.cos(k * 1.26) * 3.2, y + Math.sin(k * 1.26) * 3.2, 2.2, 2.2, i % 3 ? "#fff2c8" : "#ffd23c", 0.4, 0.02);
              blob(g, x, y, 1.3, 1.3, "#c4402a", 0.5, 0.02);
            }
          if (C.pattern === "stripes") for (let y = -100; y < -10; y += 13) wash(g, [[-40, y], [40, y - 3], [40, y + 6], [-40, y + 9]], "#f3ead6", { n: 6, a: 0.3 });
          // back of the body in shade
          paint(g, rectP(-36, -110, -12, 20, 2), "#3a3260", { n: 6, a: 0.05, v: 0.02, d: 2, bd: 1 });
          // a rip showing green skin underneath
          const [rx, ry] = C.rip || [10, -50];
          paint(g, polyP([[rx - 7, ry - 8], [rx + 6, ry - 6], [rx + 8, ry + 6], [rx - 2, ry + 10], [rx - 8, ry + 3]], 2), SK, { n: 6, a: 0.35, v: 0.02, d: 2, bd: 1 });
          stroke(g, [[rx - 7, ry - 8], [rx + 6, ry - 6], [rx + 8, ry + 6], [rx - 2, ry + 10], [rx - 8, ry + 3], [rx - 7, ry - 8]], "rgba(46,34,48,0.6)", 1.3);
        });
        if (C.tie) {
          wash(g, [[10, -96], [16, -96], [19, -60], [13, -48], [8, -60]], C.tie, { n: 8, a: 0.3 });
          stroke(g, [[10, -96], [8, -60], [13, -48], [19, -60], [16, -96]], "rgba(30,30,50,0.6)", 1.2);
        }
        if (C.camera) {
          stroke(g, [[-14, -98], [6, -64], [24, -96]], "rgba(40,30,30,0.8)", 2);
          wash(g, [[-2, -70], [20, -70], [20, -54], [-2, -54]], "#333038", { n: 8, a: 0.35 });
          blob(g, 13, -62, 5, 5, "#8aa0b8", 0.5, 0.02);
        }
        if (C.whistle) {
          stroke(g, [[-10, -99], [10, -76], [22, -97]], "rgba(200,40,40,0.8)", 1.6);
          wash(g, [[6, -78], [16, -78], [16, -71], [6, -71]], "#d7d7d0", { n: 6, a: 0.4 });
        }
        if (C.ring) {
          // inflatable duck ring around the waist (funny), duck head at the front
          paint(g, ellP(2, -34, 46, 15, 24), "#f2c23c", { n: 12, a: 0.22, v: 0.01, d: 2, bd: 1 });
          paint(g, ellP(2, -38, 38, 6, 20), "#fff1a8", { n: 6, a: 0.25, v: 0.02, d: 2, bd: 1 });
          blob(g, 46, -50, 11, 11, "#f2c23c", 0.3, 0.02);
          wash(g, [[54, -52], [66, -49], [55, -45]], "#f08a24", { n: 6, a: 0.4 });
          blob(g, 49, -54, 1.8, 1.8, "#222", 0.8, 0.01);
        }
        // ragged hem drawn in ink so the tear reads at phone size
        stroke(g, hem, "rgba(46,34,48,0.75)", 1.8);
      },
      lines: C.ring ? [ellP(2, -34, 46, 15, 24).concat([ellP(2, -34, 46, 15, 24)[0]])] : [],
    };
    // ----- head -----
    parts.head = {
      box: [-46, -104, 72, 10],
      outline: HEAD,
      paint(g) {
        wash(g, HEAD, SK, { n: 16, a: 0.18, v: 0.006 });
        paintIn(g, HEAD, () => {
          paint(g, ellP(-20, -36, 22, 40, 16), skinD, { n: 6, a: 0.08, v: 0.05, d: 2, bd: 1 }); // back of the skull in shade
          paint(g, ellP(24, -8, 22, 9, 14), skinD, { n: 5, a: 0.08, v: 0.05, d: 2, bd: 1 }); // under the jaw
          blob(g, 26, -30, 9, 6, skinL, 0.12); // cheek
          blob(g, 28, -28, 7, 4, "#b98a9a", 0.1); // a sickly flush
        });
        // ear
        blob(g, -6, -40, 7, 10, SK, 0.3, 0.02);
        stroke(g, [[-5, -48], [-9, -40], [-5, -33]], "rgba(46,34,48,0.55)", 1.4);
        // sunken eye sockets, then googly mismatched eyes looking two ways
        blob(g, 16, -47, 12, 11, "#5f5876", 0.18, 0.03);
        blob(g, 35, -46, 8, 10, "#5f5876", 0.18, 0.03);
        g.fillStyle = "#f6f2e2";
        g.beginPath();
        g.ellipse(16, -47, 9, 8.5, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(35, -46, 5.5, 6.5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = DARK;
        g.beginPath();
        g.arc(19, -45 + (C.lookUp ? -3 : 0), 2.6, 0, Math.PI * 2);
        g.arc(33, -48, 2, 0, Math.PI * 2);
        g.fill();
        stroke(g, [[6, -51], [16, -56], [26, -51]], "rgba(46,34,48,0.75)", 1.8); // droopy lid
        stroke(g, [[5, -60], [17, -62], [28, -58]], "rgba(46,34,48,0.55)", 1.6); // brow
        // nose + open mouth with one or two teeth
        g.fillStyle = "rgba(46,34,48,0.6)";
        g.beginPath();
        g.arc(41, -36, 1.6, 0, Math.PI * 2);
        g.fill();
        // (the mouth is drawn every frame by drawMouth, because it sings)
        // hair / hats / extras
        if (C.hair === "combover") for (let i = 0; i < 3; i++) stroke(g, [[-18, -64 + i * 3], [0, -80 + i * 2], [22, -74 + i * 3]], "rgba(40,32,30,0.8)", 1.6);
        if (C.hair === "messy")
          for (let i = 0; i < 14; i++) {
            const a = rr(-2.9, -0.5),
              x = rr(-24, 18);
            stroke(g, [[x, -70], [x + Math.cos(a) * 14, -70 + Math.sin(a) * 14 - 2]], "rgba(36,28,30,0.85)", 2.4);
          }
        if (C.hair === "wet") for (let i = 0; i < 6; i++) wash(g, [[-24 + i * 7, -74], [-18 + i * 7, -76], [-14 + i * 7, -56], [-20 + i * 7, -60]], "#3a3226", { n: 5, a: 0.3 });
        if (C.sunglasses) {
          wash(g, [[-4, -76], [12, -80], [12, -71], [-2, -69]], "#1f1f28", { n: 6, a: 0.45 });
          wash(g, [[16, -79], [30, -78], [29, -69], [16, -70]], "#1f1f28", { n: 6, a: 0.45 });
        }
        if (C.goggles) {
          stroke(g, [[-26, -62], [8, -70]], "rgba(40,60,90,0.9)", 3);
          blob(g, 14, -72, 7, 6, "#5fa8d8", 0.4, 0.02);
          blob(g, 30, -70, 5, 5, "#5fa8d8", 0.4, 0.02);
        }
        if (C.stitches) {
          stroke(g, [[-10, -66], [16, -70]], "rgba(60,30,40,0.8)", 1.4);
          for (let i = 0; i < 5; i++) stroke(g, [[-8 + i * 6, -71], [-6 + i * 6, -64]], "rgba(60,30,40,0.8)", 1.2);
        }
        if (C.plaster) {
          wash(g, [[14, -30], [28, -36], [31, -30], [17, -24]], "#e8c8a0", { n: 6, a: 0.45 });
          stroke(g, [[20, -31], [25, -33]], "rgba(120,80,60,0.6)", 1);
        }
        if (C.hat) {
          paint(g, ellP(6, -70, 50, 9, 24, -0.08), "#d9b85c", { n: 10, a: 0.25, v: 0.01, d: 2, bd: 1 });
          wash(g, [[-20, -70], [-16, -94], [6, -100], [24, -92], [30, -72]], "#e2c46a", { n: 10, a: 0.25 });
          wash(g, [[-19, -78], [29, -80], [29, -73], [-19, -71]], "#c4473a", { n: 6, a: 0.35 });
          for (let i = 0; i < 8; i++) stroke(g, [[-14 + i * 6, -96], [-16 + i * 6, -74]], "rgba(150,110,40,0.35)", 1);
        }
      },
      lines: C.hat ? [[[-44, -66], [6, -79], [56, -74]]] : [],
    };
    // ----- arms -----
    const sleeve = C.sleeve ?? 24;
    const upper = (far) => ({
      box: [-15, -15, 15, 70],
      edges: UPPER_L.edges,
      paint(g) {
        wash(g, UPPER, SK, { n: 12, a: 0.2 });
        shadeSkin(g, UPPER, -12.5, 12.5);
        if (sleeve > 0) {
          const edge = ragged([13.5, sleeve], [-13.5, sleeve + 2], 5, 6, far ? 3 : 1);
          wash(g, [[-13, -6], [-9, -11], [0, -14], [9, -11], [13, -6], ...edge], C.shirt, { n: 10, a: 0.22 });
          stroke(g, edge, "rgba(46,34,48,0.7)", 1.5);
        }
      },
    });
    const fore = {
      box: [-12, -12, 12, 60],
      edges: FORE_L.edges,
      paint(g) {
        wash(g, FORE, SK, { n: 12, a: 0.2 });
        shadeSkin(g, FORE, -10.5, 10.5);
        if (sleeve > 60) {
          const edge = ragged([11, 22], [-11, 24], 5, 6, 5);
          wash(g, [[-11, 0], [-7, -8], [0, -11], [7, -8], [11, 0], ...edge], C.shirt, { n: 10, a: 0.22 });
          stroke(g, edge, "rgba(46,34,48,0.7)", 1.4);
        }
        blob(g, 2, 30, 4, 3, skinD, 0.15); // a bruise-y blotch
      },
    };
    const hand = {
      box: [-13, -6, 20, 38],
      outline: HAND,
      paint(g) {
        wash(g, HAND, SK, { n: 12, a: 0.22 });
        shadeSkin(g, HAND, -10, 17);
      },
    };
    parts.upperArm = upper(false);
    parts.foreArm = fore;
    parts.hand = hand;
    // ----- legs -----
    const legPaint = (shoe) => ({
      box: [-15, -14, 34, 78],
      outline: SHIN,
      paint(g) {
        wash(g, SHIN, SK, { n: 12, a: 0.2 });
        shadeSkin(g, SHIN, -11, 11);
        if (C.long) {
          const edge = ragged([11, 40], [-11, 42], 5, 7, shoe ? 2 : 4);
          wash(g, [[-12, 0], [-8, -9], [0, -12], [8, -9], [12, 0], ...edge], C.pants, { n: 10, a: 0.22 });
          stroke(g, edge, "rgba(46,34,48,0.7)", 1.5);
        }
        if (shoe === "shoe") wash(g, [[-12, 56], [10, 57], [27, 62], [32, 69], [31, 76], [-13, 76]], "#5a3a2a", { n: 10, a: 0.3 });
        if (shoe === "flipflop") {
          wash(g, [[-14, 72], [33, 72], [33, 77], [-14, 77]], "#3f9fd0", { n: 6, a: 0.4 });
          stroke(g, [[-2, 72], [10, 62], [16, 72]], "rgba(40,110,160,0.9)", 2);
        }
        if (!shoe || shoe === "flipflop") for (let i = 0; i < 3; i++) stroke(g, [[22 + i * 3, 68], [22 + i * 3, 74]], "rgba(46,34,48,0.45)", 1); // toes
      },
    });
    const thigh = {
      box: [-18, -18, 18, 82],
      edges: THIGH_L.edges,
      paint(g) {
        wash(g, THIGH, SK, { n: 12, a: 0.2 });
        shadeSkin(g, THIGH, -13, 13);
        const len = C.long ? 80 : C.shortsLen ?? 30;
        const edge = ragged([15, Math.min(len, 68)], [-14, Math.min(len, 68) + 2], 5, 6, 9);
        wash(g, [[-16, -4], [-10, -14], [0, -16], [10, -14], [16, -4], ...(len >= 68 ? [[13, 74], [0, 81], [-13, 74]] : edge)], C.pants, { n: 10, a: 0.22 });
        if (len < 68) stroke(g, edge, "rgba(46,34,48,0.7)", 1.5);
      },
    };
    parts.thigh = thigh;
    parts.shin = legPaint(C.shoeN);
    parts.shinF = legPaint(C.shoeF);

    const fig = E.makeFigure("zombie-" + id, { bones: BONES, parts, ink: { t0: C.ink[0], t1: C.ink[1], w: 2.5, a: 0.85 } });

    // ----- motion: a choir -----
    const M = C.move;
    const F = M.face;
    const sing = (t) => ease(t, 2.1, 2.3);
    const state = (t) => {
      const wake = ease(t, M.wake, M.wake + 0.45);
      const sw = Math.sin((2 * Math.PI * (t - 2.2)) / 1.3) * sing(t); // everyone sways together
      const m = mouth(t, M.late ?? 0) * sing(t);
      const idle = (1 - wake) * 0.03 * Math.sin(t * 1.7 + M.phase);
      const armOut = (off, up) => [-1.45 + 0.1 * sw * F - 0.08 * m + up + 0.03 * Math.sin(t * 2 + off), -0.16 + 0.06 * Math.sin(t * 2.6 + off), 0.9];
      const armDown = [0.12, -0.08, 0.3];
      const mixA = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
      // local angles are mirrored for left-facing zombies, so "* F" makes the sway the same way on screen
      return {
        m,
        lean: lerp(0.32, 0.17 + 0.07 * sw * F, wake) + idle,
        head: lerp(0.55, 0.08 + 0.12 * sw * F - 0.22 * m + (M.tilt ?? 0), wake) + idle * 2,
        armN: mixA(armDown, armOut(0, 0), wake),
        armF: mixA(armDown, armOut(1.3, -0.16), wake),
        legN: [-0.03 - 0.07 * m, 0.06 + 0.16 * m], // knees dip on every "la"
        legF: [0.05 - 0.04 * m, 0.06 + 0.12 * m],
      };
    };
    const poseAt = (t) => {
      const st = state(t);
      const pose = { x: M.x, y: 0, s: M.s, face: F, lean: st.lean, head: st.head, armN: st.armN, armF: st.armF, legN: st.legN, legF: st.legF };
      pose.y = fig.hipY(pose, M.y);
      return { st, pose };
    };
    const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
    return {
      name: id,
      face: F,
      depth: 0.7 + 0.25 * ((M.y - 1300) / 500),
      groundY: () => M.y,
      // where the mouth is on screen (music notes come out of it)
      mouthAt(t) {
        const { pose } = poseAt(t);
        let p = rot([34, -14], pose.head);
        p = rot([p[0] + BONES.neck[0], p[1] + BONES.neck[1]], pose.lean);
        return [pose.x + p[0] * pose.s * F, pose.y + p[1] * pose.s];
      },
      draw(g, t, o) {
        const { st, pose } = poseAt(t);
        if (o.paint !== false) E.figureShadow(g, M.x + F * 6 * M.s, M.y + 2, M.s * 1.05, "rgba(70,44,96,0.42)", 1.15);
        fig.draw(g, pose, { ...o, overlay: { head: (hg) => drawMouth(hg, st.m, C) } });
      },
    };
  }

  // ---------- the song ----------
  // every "la" (seconds); hold = how long the mouth stays wide open
  const SONG = [
    [2.3, 0.1],
    [2.85, 0], [3.1, 0.06],
    [3.45, 0], [3.68, 0], [3.91, 0.08],
    [4.3, 0], [4.5, 0], [4.7, 0], [4.9, 0], [5.1, 0.12],
    [5.5, 0.4], // the big last "laaa"
  ];
  function mouth(t, late) {
    let m = 0;
    for (const [s, hold] of SONG) {
      const d = t - s - late;
      if (d < 0) break;
      const e = d < 0.05 ? d / 0.05 : d < 0.05 + hold ? 1 : Math.exp(-(d - 0.05 - hold) / 0.13);
      m = Math.max(m, e);
    }
    return m;
  }
  // an open singing mouth in head coordinates (m = 0 closed .. 1 wide open)
  function drawMouth(g, m, C) {
    const rx = 6.5 + 4.5 * m,
      ry = 2 + 13 * m,
      cy = -17 + 5.5 * m;
    g.fillStyle = "#3a2230";
    g.beginPath();
    g.ellipse(31, cy, rx, ry, 0.12, 0, Math.PI * 2);
    g.fill();
    if (m > 0.2) {
      g.fillStyle = "#b8566e";
      g.beginPath();
      g.ellipse(31, cy + ry * 0.55, rx * 0.6, ry * 0.32, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#f2ecd8";
    g.fillRect(27, cy - ry + 0.5, 4, Math.min(5, ry * 0.9));
    if (C.teeth !== 1) g.fillRect(33, cy - ry + 0.8, 3, Math.min(4, ry * 0.8));
    g.strokeStyle = "rgba(46,34,48,0.85)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(31, cy, rx, ry, 0.12, 0, Math.PI * 2);
    g.stroke();
  }

  // ---------- the choir, gathered in front of the porch, two facing two ----------
  const cast = [
    makeZombie("tourist", {
      skin: "#9fb48a", shirt: "#e0703f", pattern: "flowers", pants: "#c9b37c", shortsLen: 34, hair: "combover",
      sunglasses: true, camera: true, shoeN: "flipflop", shoeF: null, rip: [16, -36], ink: [0.55, 1.25],
      move: { x: 290, y: 1730, s: 1.15, face: 1, wake: 1.95, phase: 0 },
    }),
    makeZombie("swimmer", {
      skin: "#97b496", shirt: "#c94a3a", pattern: "stripes", pants: "#c94a3a", shortsLen: 14, sleeve: 0, hair: "wet",
      goggles: true, ring: true, teeth: 1, lookUp: true, shoeN: null, shoeF: null, rip: [-14, -70], ink: [0.6, 1.3],
      move: { x: 800, y: 1720, s: 1.1, face: -1, wake: 2.05, phase: 1.3, tilt: -0.06, late: 0.11 }, // always a bit late
    }),
    makeZombie("office", {
      skin: "#a6b48c", shirt: "#e4ded0", pants: "#636878", long: true, sleeve: 70, tie: "#3f63a0", hair: "messy",
      stitches: true, shoeN: "shoe", shoeF: null, rip: [-6, -62], ink: [0.65, 1.35],
      move: { x: 150, y: 1480, s: 0.88, face: 1, wake: 2.0, phase: 2.2, tilt: 0.04 },
    }),
    makeZombie("lifeguard", {
      skin: "#a9b98e", shirt: "#e9c24a", pants: "#c4473a", shortsLen: 30, sleeve: 0, hair: "messy", hat: true,
      whistle: true, plaster: true, shoeN: null, shoeF: null, rip: [12, -44], ink: [0.7, 1.4],
      move: { x: 935, y: 1470, s: 0.86, face: -1, wake: 2.1, phase: 0.6 },
    }),
  ];

  // ---------- "la la la": ink lettering that writes itself on a watercolour wash ----------
  // a cursive "la" as one pen stroke (l loop, then the a bowl and stem), 34 x 54 units
  const LA = E.smoothP(
    [[0, 0], [6, -10], [11, -28], [12, -44], [9, -54], [4, -52], [2, -42], [3, -24], [5, -8], [9, 0], [14, -2],
     [19, -10], [25, -17], [20, -18], [14, -14], [12, -7], [15, -1], [21, 0], [26, -6], [27, -15], [27, -6], [29, -1], [34, -3]],
    2, false);
  const PHRASES = [
    { syl: [2.3], x: 446, col: "#ffe9a8" },
    { syl: [2.85, 3.1], x: 636, col: "#ffc9d6" },
    { syl: [3.45, 3.68, 3.91], x: 446, col: "#c9efdd" },
    { syl: [4.3, 4.5, 4.7, 4.9, 5.1], x: 540, col: "#ddd2ff" },
  ];
  const LS = 2.6, // letter scale: an "l" is ~140 px tall (measured: 2.0 was too small on a phone)
    WORD = 34,
    GAP = 14,
    Y0 = 1250, // measured: lower than this and the long phrase hides the two back zombies' heads
    RISE = 50;
  const WASH_NOTES = ["#ffd06a", "#ff9fb8", "#9fe0c4", "#c4b4ff"];
  let built = false;
  const lettering = {
    depth: 0.85,
    groundY: () => 1e9, // drawn after (in front of) the zombies
    build() {
      E.seed("la-ink");
      for (const [i, P] of PHRASES.entries()) {
        const n = P.syl.length;
        P.w = n * WORD + (n - 1) * GAP;
        P.lines = P.syl.map((s, k) => E.makeLine(LA.map(([x, y]) => [x + k * (WORD + GAP) - P.w / 2, y]), s, s + 0.14, { w: 3.3, a: 0.95, gaps: false, wob: 0.35, col: E.hex("#2b1d2e") }));
        // the wash behind the words: a soft blob of colour, painted once
        const cw = (P.w + 50) * LS,
          ch = 150;
        P.wash = E.layer("la-wash-" + i, (g) => {
          // denser than a normal wash: the words must stay readable over white pillars and windows
          paint(g, ellP(cw / 2, ch / 2, cw / 2 - 18, ch / 2 - 28, 22), P.col, { n: 16, a: 0.14, v: 0.09, d: 3 });
          paint(g, ellP(cw / 2 + 10, ch / 2 + 4, cw / 2 - 34, ch / 2 - 40, 18), "#fff8e8", { n: 10, a: 0.16, v: 0.1, d: 2 });
        }, { edge: 0.45, blur: 4, gran: 0.4 }, cw, ch);
      }
      // music notes: painted once (an ink note on a little dab of colour)
      E.seed("la-notes");
      this.notes = [0, 1].map((kind) =>
        WASH_NOTES.map((col, ci) => {
          const c = E.mk(80, 90),
            g = c.getContext("2d");
          paint(g, ellP(34, 58, 22, 18, 14), col, { n: 8, a: 0.14, v: 0.08, d: 2 });
          E.finish(c, { edge: 0.4, blur: 3, gran: 0.3 });
          g.fillStyle = "rgba(43,29,46,0.95)";
          g.strokeStyle = "rgba(43,29,46,0.95)";
          g.lineCap = "round";
          g.lineWidth = 3.4;
          const heads = kind === 0 ? [[30, 62]] : [[22, 66], [50, 60]];
          for (const [hx, hy] of heads) {
            g.beginPath();
            g.ellipse(hx, hy, 8.5, 6.2, -0.45, 0, Math.PI * 2);
            g.fill();
            g.beginPath();
            g.moveTo(hx + 7.5, hy - 2);
            g.lineTo(hx + 7.5, hy - 40);
            g.stroke();
          }
          g.lineWidth = 5;
          g.beginPath();
          if (kind === 0) {
            g.moveTo(37.5, 22);
            g.quadraticCurveTo(52, 30, 50, 46);
          } else {
            g.moveTo(29.5, 26);
            g.lineTo(57.5, 20);
          }
          g.stroke();
          return c;
        }),
      );
      // every "la", two zombies (taking turns) send a note up
      this.spawns = [];
      SONG.forEach(([s], i) => {
        for (const k of [i % 4, (i + 2) % 4]) {
          const z = cast[k];
          // start a little in front of and above the mouth, so a note never covers a face
          const mp = z.mouthAt(s + 0.06);
          this.spawns.push({ t: s + 0.04, z, p: [mp[0] + z.face * 34, mp[1] - 40], kind: (i + k) % 2, col: (i + k) % 4, sway: E.hash(i, k) * 6.28 });
        }
      });
    },
    draw(g, t, o) {
      if (o.paint === false) return;
      if (!built) {
        this.build();
        built = true;
      }
      // music notes float up from the mouths, swaying, then fade
      for (const sp of this.spawns) {
        const a = t - sp.t;
        if (a < 0 || a > 1.3) continue;
        const k = a / 1.3;
        const x = sp.p[0] + Math.sin(a * 5 + sp.sway) * 12 + (540 - sp.p[0]) * 0.18 * k;
        const y = sp.p[1] - 20 - 130 * E.smooth(Math.min(1, k * 1.3));
        g.save();
        g.globalAlpha = Math.min(1, a / 0.12) * (1 - E.ease(k, 0.6, 1));
        g.translate(x, y);
        g.rotate(Math.sin(a * 4 + sp.sway) * 0.2);
        const ns = 1.15 + 0.3 * Math.min(1, a / 0.15);
        g.scale(ns, ns);
        g.drawImage(this.notes[sp.kind][sp.col], -40, -60);
        g.restore();
      }
      // the words: each "la" writes itself on its syllable, the phrase rises, then fades for the next one
      PHRASES.forEach((P, i) => {
        const t0 = P.syl[0] - 0.03;
        const next = PHRASES[i + 1] ? PHRASES[i + 1].syl[0] : 99;
        if (t < t0 || t > next + 0.45) return;
        const fadeIn = E.ease(t, t0, t0 + 0.12);
        const fadeOut = 1 - E.ease(t, next - 0.05, next + 0.4);
        const y = Y0 - RISE * (t - t0);
        g.save();
        g.translate(P.x, y);
        g.globalAlpha = fadeIn * fadeOut * 0.95;
        g.globalAlpha = fadeIn * fadeOut * 0.8;
        g.drawImage(P.wash, -P.wash.width / 2, -P.wash.height / 2 - 62);
        g.globalAlpha = fadeOut;
        g.scale(LS, LS);
        g.translate(0, 0);
        for (const ln of P.lines) E.drawLine(g, ln, E.ramp(t, ln.t0, ln.t1));
        g.restore();
      });
    },
  };

  E.CAST = E.CAST || [];
  E.CAST.push(...cast, lettering);

  // ---------- timing for this version (the scene reads these) ----------
  const S = E.SCENE;
  S.WASH = [1.2, 2.2]; // ink 0-1.2 s, paint 1.2-2.2 s, singing from 2.2 s
  S.WASH_FROM = [0.45, 0.6];
  S.INK_FADE = [2.0, 2.8];
  S.LIGHTS_OFF = 99; // the lamps stay on: they are being serenaded
})();
