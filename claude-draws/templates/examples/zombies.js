// =====================================================================================
// The cast: four cartoon zombies shambling up the beach toward the house.
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
        g.fillStyle = "#3a2230";
        g.beginPath();
        g.ellipse(31, -18, 8, 7, 0.1, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#f2ecd8";
        g.fillRect(27, -25, 4, 5);
        if (C.teeth !== 1) g.fillRect(33, -24.5, 3, 4);
        blob(g, 31, -14, 4, 2, "#b0506a", 0.4, 0.02); // tongue
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

    // ----- motion -----
    const M = C.move;
    const state = (t) => {
      const wake = ease(t, M.wake, M.wake + 0.6);
      const tau = t - M.walk;
      const gt = E.gait.shamble(tau, { period: M.period, speed: M.speed, phase: M.phase, wake, headTilt: M.tilt ?? 0 });
      // before waking: slumped, swaying a little on the spot
      const idle = (1 - wake) * 0.03 * Math.sin(t * 1.7 + M.phase);
      // they walk on a slant up the beach toward the house (away from us), getting a
      // little smaller as they go, so the paths converge on the door, not on each other
      const th = Math.atan(M.up ?? 0.2);
      const dist = gt.dx * M.s;
      const x = M.x + M.face * dist * Math.cos(th);
      const groundY = M.y - dist * Math.sin(th);
      const s = M.s * (1 - 0.0006 * (M.y - groundY));
      return { gt, x, groundY, s, idle, dx: dist };
    };
    return {
      depth: 0.7 + 0.25 * ((M.y - 1300) / 500),
      groundY: (t) => state(t).groundY,
      draw(g, t, o) {
        const { gt, x, groundY, s, idle, dx } = state(t);
        const wake = ease(t, M.wake, M.wake + 0.6);
        // far arm held a little higher than the near one, so both arms read at phone size
        const armF = [gt.armF[0] - 0.16 * wake, gt.armF[1], gt.armF[2]];
        const pose = { x, y: 0, s, face: M.face, lean: gt.lean + idle, head: gt.head + idle * 2, armN: gt.armN, armF, legN: gt.legN, legF: gt.legF };
        pose.y = fig.hipY(pose, groundY);
        if (o.paint !== false) {
          // the drag mark the stiff foot leaves in the sand, then the contact shadow
          if (dx > 4) {
            g.strokeStyle = "rgba(120,86,110,0.28)";
            g.lineWidth = 3 * s;
            g.lineCap = "round";
            g.beginPath();
            g.moveTo(M.x - M.face * 6 * s, M.y + 2);
            g.quadraticCurveTo((M.x + x) / 2, (M.y + groundY) / 2 + 3, x - M.face * 14 * s, groundY + 1);
            g.stroke();
          }
          E.figureShadow(g, x + M.face * 6 * s, groundY + 2, s * 1.05, "rgba(70,44,96,0.42)", 1.15);
        }
        fig.draw(g, pose, o);
      },
    };
  }

  // ---------- the four of them ----------
  const cast = [
    makeZombie("tourist", {
      skin: "#9fb48a",
      shirt: "#e0703f",
      pattern: "flowers",
      pants: "#c9b37c",
      shortsLen: 34,
      hair: "combover",
      sunglasses: true,
      camera: true,
      shoeN: "flipflop",
      shoeF: null,
      rip: [16, -36],
      ink: [0.8, 1.7],
      move: { x: 170, y: 1800, s: 1.22, face: 1, wake: 2.0, walk: 2.35, period: 1.8, speed: 40, phase: 0, up: 0.5 },
    }),
    makeZombie("swimmer", {
      skin: "#97b496",
      shirt: "#c94a3a",
      pattern: "stripes",
      pants: "#c94a3a",
      shortsLen: 14,
      sleeve: 0,
      hair: "wet",
      goggles: true,
      ring: true,
      teeth: 1,
      lookUp: true,
      shoeN: null,
      shoeF: null,
      rip: [-14, -70],
      ink: [0.9, 1.8],
      move: { x: 950, y: 1700, s: 1.12, face: -1, wake: 2.15, walk: 2.5, period: 1.7, speed: 38, phase: 1.3, tilt: -0.08, up: 0.45 },
    }),
    makeZombie("office", {
      skin: "#a6b48c",
      shirt: "#e4ded0",
      pants: "#636878",
      long: true,
      sleeve: 70,
      tie: "#3f63a0",
      hair: "messy",
      stitches: true,
      shoeN: "shoe",
      shoeF: null,
      rip: [-6, -62],
      ink: [1.0, 1.85],
      move: { x: 100, y: 1452, s: 0.86, face: 1, wake: 2.25, walk: 2.6, period: 1.9, speed: 40, phase: 2.2, tilt: 0.06, up: 0.22 },
    }),
    makeZombie("lifeguard", {
      skin: "#a9b98e",
      shirt: "#e9c24a",
      pants: "#c4473a",
      shortsLen: 30,
      sleeve: 0,
      hair: "messy",
      hat: true,
      whistle: true,
      plaster: true,
      shoeN: null,
      shoeF: null,
      rip: [12, -44],
      ink: [1.05, 1.9],
      move: { x: 975, y: 1392, s: 0.78, face: -1, wake: 2.35, walk: 2.7, period: 1.75, speed: 40, phase: 0.6, up: 0.08 },
    }),
  ];
  E.CAST = E.CAST || [];
  E.CAST.push(...cast);
})();
