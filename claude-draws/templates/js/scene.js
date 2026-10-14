// =====================================================================================
// claude-draws: EXAMPLE SCENE: a small Goan house on a beach at dusk
// -------------------------------------------------------------------------------------
// Use this file as the pattern for a new scene. A scene has three jobs:
//
//   S.build()           paint every still layer ONCE (seeded), make the ink lines,
//                       make the data for things that move (waves, stars, bats...)
//   S.draw(g, t, opt)   paint the frame at time t, back to front.
//                       opt.noInk = paint only (used while the wash spreads in)
//   S.drawInk(g, t)     only the ink lines (used during the self-drawing intro)
//
// Painting order follows how a background painter works (Kazuo Oga at Ghibli):
// big shapes first (sky, sea, sand), then thin layered washes, then the details.
// Depth comes from layers that move at different speeds (multiplane camera, as in
// Cartoon Saloon films): setCam(g, k, depth) with depth 0.2 = far sky ... 1.3 = foreground.
//
// Characters: any script that pushes objects into E.CAST (see figures.js and
// examples/zombies.js) is drawn on the sand in depth order. The scene needs no edits.
//   E.CAST.push({ depth, groundY(t), draw(g, t, o) })
// =====================================================================================
(function () {
  const { W, H, seed, R, rr, gauss, hex, rgba, lerp, clamp, ramp, ease, mk, rectP, polyP, ellP, archP, paint, paintIn, gradIn, fillPoly, pathOf } = E;
  const layer = E.layer;
  const S = (E.SCENE = {});
  E.CAST = E.CAST || [];

  // ---------- timing (seconds) ----------
  S.LEAD = 0.45; // the drawing is already under way on frame 1 (a strong first frame)
  S.WASH = [0.7, 2.3]; // the paint spreads in under the ink (index.html does the reveal)
  S.WASH_FROM = [0.4, 0.58]; // where on the page the paint starts spreading (0..1)
  S.INK_FADE = [2.0, 3.3]; // ink steps back once the paint is in (keeps 40%)
  // Very short clip? Start already painted: S.WASH = [-1, -0.5]; S.INK_FADE = [-1, -0.5];
  S.LIGHTS_OFF = 4.7; // a little story beat: the people inside switch the lights off (99 = never)

  // ---------- layout ----------
  const HZ = 930; // horizon
  const BASE = 1195; // where the house meets the sand
  // the waterline: flat behind the house, then curving toward us on the right
  const shoreY = (x) => 1160 + 0.0068 * Math.pow(Math.max(0, x - 520), 1.6) + 5 * Math.sin(x * 0.011);
  S.shoreY = shoreY;
  const G = {
    facade: [190, 990, 640, BASE],
    side: [
      [190, 990],
      [190, BASE],
      [112, 1172],
      [112, 1012],
    ],
    roofFront: [
      [160, 980],
      [670, 980],
      [548, 852],
      [302, 852],
    ],
    roofSide: [
      [160, 980],
      [302, 852],
      [228, 864],
      [88, 1012],
    ],
    windows: [262, 568],
    pillars: [350, 458],
    door: [392, 1070, 438, BASE],
    moon: [806, 300, 88],
  };
  S.G = G;

  // multiplane camera: a slow push-in; near layers grow more than far ones
  let K = 0;
  function setCam(g, depth) {
    const s = 1 + K * depth;
    g.setTransform(s, 0, 0, s, 480 * (1 - s), 1250 * (1 - s));
  }
  S.setCam = setCam;
  S.camAt = (t) => 0.04 * ease(t, 1.2, 6.5);

  S.build = function () {
    const TRIM = "#e9e2d8";
    // ---------- sky: one graded wash, then wet-in-wet blooms ----------
    S.sky = layer("sky", (g) => {
      gradIn(g, rectP(-40, -40, W + 40, HZ + 20, 2), 0, HZ, [
        [0, "#22264f"],
        [0.3, "#3d3a78"],
        [0.56, "#8a5288"],
        [0.79, "#d9756f"],
        [0.93, "#f5a46a"],
        [1, "#ffd08a"],
      ]);
      for (let i = 0; i < 26; i++) {
        const y = rr(20, HZ - 20);
        const col = y < 300 ? "#2f2e66" : y < 560 ? "#6a4a86" : y < 800 ? "#cf6f7a" : "#ffb878";
        paint(g, ellP(rr(-100, 1180), y, rr(220, 480), rr(30, 80), 16), col, { n: 9, a: 0.05, v: 0.13, d: 3 });
      }
    }, { edge: 0.15, gran: 0.35 });
    // the moon: a pale disc with soft grey seas
    S.moonL = layer("moon", (g) => {
      const [mx, my, mr] = G.moon;
      paint(g, ellP(mx, my, mr, mr, 40), "#f7eed6", { n: 16, a: 0.16, v: 0.006, d: 2 });
      paintIn(g, ellP(mx, my, mr, mr, 40), () => {
        for (const [dx, dy, r] of [
          [-30, -20, 30],
          [22, 18, 22],
          [-8, 34, 16],
          [34, -30, 14],
        ])
          paint(g, ellP(mx + dx, my + dy, r, r * 0.8, 14), "#c9bfc0", { n: 6, a: 0.08, v: 0.1, d: 2 });
        paint(g, ellP(mx - 30, my + 26, mr, mr, 30), "#d8c9c4", { n: 6, a: 0.05, v: 0.05 });
      });
    }, { edge: 0.3, gran: 0.4 });
    // long dusk clouds, lit from below by the sun that has just set behind the house
    S.clouds = [0, 1].map((dpt) =>
      layer("clouds-" + dpt, (g) => {
        const set =
          dpt === 0
            ? [
                [180, 520, 300, 12],
                [700, 600, 340, 14],
              ]
            : [
                [80, 700, 420, 20],
                [600, 770, 460, 22],
                [300, 850, 520, 14],
              ];
        for (const [x, y, rx, ry] of set) {
          paint(g, ellP(x + 200, y, rx, ry, 20), "#5d3f76", { n: 12, a: 0.07, v: 0.14 });
          paint(g, ellP(x + 215, y + ry * 0.55, rx * 0.84, ry * 0.42, 20), "#f39a78", { n: 9, a: 0.08, v: 0.12 });
          paint(g, ellP(x + 225, y + ry * 0.75, rx * 0.5, ry * 0.2, 16), "#ffd29a", { n: 5, a: 0.08, v: 0.1 });
        }
      }, { edge: 0.35, gran: 0.3 }, W + 400, H),
    );
    // far land on the horizon: a headland with a tiny lighthouse
    S.land = layer("land", (g) => {
      paint(g, polyP([[700, HZ + 2], [770, 916], [850, 904], [930, 910], [1010, 896], [1100, 900], [1100, HZ + 4]], 3), "#5d4677", { n: 14, a: 0.09, v: 0.01 });
      paint(g, polyP([[-20, HZ + 3], [-20, 918], [90, 912], [200, 922], [260, HZ + 3]], 3), "#6a5282", { n: 12, a: 0.09, v: 0.01 });
      paint(g, polyP([[1000, 898], [1012, 898], [1010, 860], [1002, 860]], 2), "#e6d4d2", { n: 8, a: 0.26, v: 0.01 });
      paint(g, polyP([[1000, 860], [1012, 860], [1010, 850], [1002, 850]], 2), "#b45a5e", { n: 6, a: 0.25, v: 0.01 });
    }, { edge: 0.3, gran: 0.3 });
    // sea: a graded wash that mirrors the sky, then horizontal streaks
    S.sea = layer("sea", (g) => {
      const sg = g.createLinearGradient(0, HZ, 0, 1360);
      sg.addColorStop(0, "#eaa585");
      sg.addColorStop(0.18, "#a9779b");
      sg.addColorStop(0.55, "#5d5b8f");
      sg.addColorStop(1, "#6e7aa6");
      g.fillStyle = sg;
      g.fillRect(-40, HZ, W + 80, 440);
      for (let i = 0; i < 70; i++) {
        const y = rr(HZ + 4, 1340);
        const near = (y - HZ) / 400;
        paint(g, ellP(rr(-50, 1130), y, rr(100, 380), rr(2, 4) + near * 5, 16), i % 3 === 0 ? "#f3a684" : i % 3 === 1 ? "#4c4a80" : "#a68bb4", { n: 4, a: 0.09, v: 0.05, d: 2, bd: 1 });
      }
    }, { edge: 0.12, gran: 0.3 });
    // sand: warm in the distance, cooler and darker toward us; wet band at the waterline
    S.sand = layer("sand", (g) => {
      const top = [];
      for (let x = -40; x <= W + 40; x += 20) top.push([x, shoreY(x) - 6]);
      const shape = [...top, [W + 40, H + 40], [-40, H + 40]];
      const sgr = g.createLinearGradient(0, 1150, 0, H);
      sgr.addColorStop(0, "#e2b597");
      sgr.addColorStop(0.5, "#d4a690");
      sgr.addColorStop(1, "#b98f8e");
      g.fillStyle = sgr;
      fillPoly(g, shape);
      paintIn(g, shape, () => {
        // wet sand just above the waterline reflects the sky
        const wet = [...top.map(([x, y]) => [x, y + 2]), ...top.slice().reverse().map(([x, y]) => [x, y + 26 + (x > 520 ? (x - 520) * 0.03 : 0)])];
        paint(g, wet, "#a98fa6", { n: 10, a: 0.1, v: 0.02 });
        for (let i = 0; i < 26; i++) paint(g, ellP(rr(-20, 1100), rr(1230, 1900), rr(80, 220), rr(18, 46), 12), i % 2 ? "#cfa08a" : "#ecc3a2", { n: 5, a: 0.05, v: 0.1, d: 2 });
        // long lavender shadows of the little dunes (the light is low and behind)
        for (let i = 0; i < 14; i++) paint(g, ellP(rr(-20, 1100), rr(1300, 1900), rr(60, 160), rr(6, 14), 12), "#9c7f9e", { n: 5, a: 0.06, v: 0.1, d: 2 });
        // wind ripples
        g.strokeStyle = "rgba(130,96,110,0.22)";
        g.lineWidth = 1.5;
        for (let i = 0; i < 46; i++) {
          const y = rr(1260, 1920),
            x = rr(-20, 1080);
          const L = 30 + (y - 1200) * 0.12;
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + L * 0.45, y - 4, x + L, y + 1);
          g.stroke();
        }
        // shells and pebbles
        for (let i = 0; i < 60; i++) {
          const y = rr(1240, 1920);
          g.fillStyle = R() < 0.35 ? `rgba(252,238,228,${rr(0.6, 0.9)})` : `rgba(96,72,80,${rr(0.2, 0.45)})`;
          g.beginPath();
          g.ellipse(rr(0, 1080), y, rr(1.5, 4) * (0.6 + (y - 1200) / 700), rr(1, 2.5), rr(0, 3), 0, Math.PI * 2);
          g.fill();
        }
      });
    }, { edge: 0.12, gran: 0.6 });

    // ---------- the house (shaded front: the light is behind it) ----------
    const [fx0, fy0, fx1, fy1] = G.facade;
    const facade = rectP(fx0, fy0, fx1, fy1, 10);
    S.facadePts = facade;
    S.side = layer("house-side", (g) => {
      const P = polyP(G.side, 5);
      paint(g, P, "#2f6f86", { n: 20, a: 0.08, v: 0.006 });
      paintIn(g, P, () => {
        paint(g, P, "#3b3570", { n: 8, a: 0.06, v: 0.01 });
        paint(g, polyP([[136, 1062], [170, 1056], [170, 1138], [136, 1142]], 3), "#2a4050", { n: 8, a: 0.14, v: 0.01 }); // little side window (its lamp glow is in S.glow)
        paint(g, polyP([[112, 1150], [190, 1162], [190, BASE], [112, 1172]], 3), "#7d4234", { n: 10, a: 0.1, v: 0.01 });
      });
    }, { edge: 0.4, gran: 0.6 });
    S.walls = layer("house-walls", (g) => {
      paint(g, facade, "#3f8aa3", { n: 26, a: 0.075, v: 0.006 });
      paintIn(g, facade, () => {
        // lime-wash mottling, damp at the foot of the wall
        for (let i = 0; i < 24; i++) paint(g, ellP(rr(fx0, fx1), rr(fy0, fy1), rr(30, 80), rr(20, 60), 10), i % 2 ? "#4f9db3" : "#33798f", { n: 5, a: 0.045, v: 0.18, d: 2 });
        for (let i = 0; i < 10; i++) paint(g, ellP(rr(fx0, fx1), rr(1160, 1190), rr(30, 80), rr(10, 26), 10), "#3d5a5a", { n: 5, a: 0.05, v: 0.15, d: 2 });
        // the front is in shade: a cool violet glaze, darker under the eaves
        paint(g, facade, "#463f80", { n: 8, a: 0.05, v: 0.01 });
        paint(g, rectP(fx0 - 10, fy0, fx1 + 10, fy0 + 50, 8), "#2a2a55", { n: 8, a: 0.05, v: 0.03 });
      });
      // laterite plinth
      const pl = rectP(fx0 - 4, 1170, fx1 + 4, BASE + 2, 10);
      paint(g, pl, "#8e4a35", { n: 16, a: 0.09, v: 0.008 });
      paintIn(g, pl, () => {
        for (let i = 0; i < 60; i++) {
          g.fillStyle = `rgba(60,25,20,${rr(0.15, 0.4)})`;
          g.beginPath();
          g.ellipse(rr(fx0, fx1), rr(1172, BASE), rr(1, 3), rr(1, 2), 0, 0, Math.PI * 2);
          g.fill();
        }
      });
    }, { edge: 0.35, gran: 0.6 });
    S.roof = layer("house-roof", (g) => {
      const RF = polyP(G.roofFront, 6),
        RS = polyP(G.roofSide, 4);
      paint(g, RS, "#7a3427", { n: 20, a: 0.085, v: 0.006 });
      paint(g, RF, "#a64a33", { n: 24, a: 0.085, v: 0.006 });
      // Mangalore tiles: rows of curved tiles, a shadow under each overlap
      paintIn(g, RF, () => {
        for (let y = 862; y < 984; y += 15) {
          const k = (y - 852) / 128;
          const xa = lerp(302, 160, k) - 10,
            xb = lerp(548, 670, k) + 10;
          const tw = lerp(17, 22, k);
          for (let x = xa; x < xb; x += tw) {
            const j = E.hash(x | 0, y | 0);
            g.fillStyle = `rgba(${140 + j * 40},${58 + j * 18},${40 + j * 10},0.35)`;
            g.beginPath();
            g.moveTo(x, y);
            g.quadraticCurveTo(x + tw / 2, y - 4, x + tw, y);
            g.lineTo(x + tw, y + 10);
            g.quadraticCurveTo(x + tw / 2, y + 14, x, y + 10);
            g.closePath();
            g.fill();
            g.strokeStyle = "rgba(70,24,20,0.45)";
            g.lineWidth = 1.4;
            g.beginPath();
            g.moveTo(x, y + 10);
            g.quadraticCurveTo(x + tw / 2, y + 15, x + tw, y + 10);
            g.stroke();
          }
        }
        for (let i = 0; i < 10; i++) paint(g, ellP(rr(200, 640), rr(870, 975), rr(30, 70), rr(6, 14), 10), i % 2 ? "#5a2a22" : "#4f5a3c", { n: 5, a: 0.07, v: 0.15, d: 2 });
        paint(g, RF, "#3b2e6a", { n: 6, a: 0.04, v: 0.01 }); // dusk shade
      });
      paintIn(g, RS, () => paint(g, RS, "#2c2350", { n: 8, a: 0.06, v: 0.01 }));
      // ridge + fascia board
      paint(g, polyP([[298, 846], [552, 846], [552, 857], [298, 857]], 6), "#6e2f22", { n: 10, a: 0.14, v: 0.006 });
      paint(g, polyP([[154, 976], [676, 976], [676, 988], [154, 988]], 8), "#4a2e2a", { n: 10, a: 0.16, v: 0.004 });
    }, { edge: 0.45, gran: 0.6 });
    S.details = layer("house-details", (g) => {
      // cornice + corner pilasters (lime white, in shade)
      paint(g, rectP(182, 988, 648, 1004, 10), TRIM, { n: 10, a: 0.2, v: 0.004 });
      paint(g, rectP(190, 1004, 214, 1170, 4), TRIM, { n: 10, a: 0.18, v: 0.006 });
      paint(g, rectP(616, 1004, 640, 1170, 4), TRIM, { n: 10, a: 0.18, v: 0.006 });
      // porch back wall in deep shade
      paint(g, rectP(372, 1010, 458, BASE, 4), "#2b3f5a", { n: 10, a: 0.08, v: 0.006 });
      // door: dark teal, a crack of warm lamp light
      const [dx0, dy0, dx1, dy1] = G.door;
      const door = archP(dx0, dy0, dx1, dy1, 12);
      paint(g, door, "#1f4a5e", { n: 14, a: 0.13, v: 0.005 });
      paintIn(g, door, () => {
        g.strokeStyle = "rgba(14,36,46,0.65)";
        g.lineWidth = 1.6;
        for (const yy of [1120, 1158]) {
          g.strokeRect(dx0 + 6, yy, 14, 30);
          g.strokeRect(dx1 - 20, yy, 14, 30);
        }
      });
      // windows: white moulding, oyster-shell panes (the lamp glow is a separate layer)
      for (const cx of G.windows) {
        paint(g, archP(cx - 40, 1040, cx + 40, 1160, 12), TRIM, { n: 10, a: 0.2, v: 0.005 });
        const pane = archP(cx - 28, 1052, cx + 28, 1150, 12);
        paint(g, pane, "#2a4f5f", { n: 12, a: 0.14, v: 0.005 });
        paintIn(g, pane, () => {
          g.strokeStyle = "rgba(30,50,60,0.7)";
          g.lineWidth = 1.8;
          g.beginPath();
          for (let xx = cx - 28; xx <= cx + 28; xx += 14) {
            g.moveTo(xx, 1052);
            g.lineTo(xx, 1152);
          }
          for (let yy = 1086; yy < 1152; yy += 18) {
            g.moveTo(cx - 28, yy);
            g.lineTo(cx + 28, yy);
          }
          g.stroke();
        });
        paint(g, rectP(cx - 44, 1158, cx + 44, 1168, 6), TRIM, { n: 10, a: 0.22, v: 0.004 });
      }
      // round pillars of the balcao (porch)
      for (const x of G.pillars) {
        const P = rectP(x, 1012, x + 22, BASE, 4);
        paint(g, P, TRIM, { n: 12, a: 0.2, v: 0.004 });
        paintIn(g, P, () => paint(g, rectP(x - 2, 1012, x + 8, BASE, 2), "#8f86a8", { n: 8, a: 0.08, v: 0.01 }));
        paint(g, rectP(x - 7, 1002, x + 29, 1016, 4), TRIM, { n: 10, a: 0.22, v: 0.006 });
      }
      // pediment over the porch with a round vent
      paint(g, polyP([[332, 1000], [498, 1000], [415, 934]], 5), TRIM, { n: 12, a: 0.2, v: 0.005 });
      paint(g, polyP([[356, 994], [474, 994], [415, 948]], 5), "#3f8aa3", { n: 12, a: 0.1, v: 0.005 });
      paint(g, ellP(415, 974, 10, 10, 14), "#2a2a40", { n: 8, a: 0.2, v: 0.01 });
      // steps
      paint(g, polyP([[380, BASE], [450, BASE], [458, 1208], [372, 1208]], 4), "#a35a40", { n: 12, a: 0.12, v: 0.006 });
      paint(g, polyP([[364, 1208], [466, 1208], [474, 1222], [356, 1222]], 4), "#8a4733", { n: 12, a: 0.12, v: 0.006 });
      // pot plants by the steps
      for (const x of [344, 486]) {
        paint(g, polyP([[x - 13, 1196], [x + 13, 1196], [x + 9, 1220], [x - 9, 1220]], 3), "#a35a40", { n: 8, a: 0.16, v: 0.01 });
        for (let k = 0; k < 6; k++) paint(g, ellP(x + rr(-14, 14), 1184 + rr(-12, 6), rr(7, 11), rr(5, 8), 8), "#3e6a48", { n: 5, a: 0.14, v: 0.1, d: 2, bd: 1 });
      }
    }, { edge: 0.35, gran: 0.45 });
    // the roof edge catches the last warm light from behind
    S.rim = layer("house-rim", (g) => {
      g.strokeStyle = "rgba(255,186,120,0.55)";
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(302, 851);
      g.lineTo(548, 851);
      g.moveTo(548, 853);
      g.lineTo(668, 978);
      g.stroke();
    }, false);
    // lamp light in the windows (fades out when the lights go off)
    S.glow = layer("house-glow", (g) => {
      for (const cx of G.windows) paint(g, archP(cx - 26, 1054, cx + 26, 1148, 12), "#ffc36a", { n: 8, a: 0.13, v: 0.02 });
      paint(g, polyP([[139, 1066], [167, 1061], [167, 1134], [139, 1138]], 3), "#ffb85a", { n: 6, a: 0.12, v: 0.02 });
      paint(g, rectP(436, 1080, 440, BASE, 2), "#ffd07a", { n: 5, a: 0.3, v: 0.02 });
    }, false);
    // dune grass + beach creeper in the near corners (foreground framing)
    S.fg = layer("foreground", (g) => {
      g.lineCap = "round";
      for (const [cx, cy, n] of [
        [60, 1900, 70],
        [1010, 1920, 60],
        [250, 1880, 24],
      ])
        for (let i = 0; i < n; i++) {
          const x = cx + gauss() * 50,
            y = cy + rr(-10, 30);
          const L = rr(60, 170),
            a = -Math.PI / 2 + gauss() * 0.35;
          g.strokeStyle = rgba(R() < 0.5 ? [64, 86, 70] : [104, 120, 84], rr(0.55, 0.9));
          g.lineWidth = rr(2, 4);
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L + rr(-20, 20), y + Math.sin(a) * L + L * 0.15);
          g.stroke();
        }
      for (let i = 0; i < 20; i++) paint(g, ellP(rr(-20, 200), rr(1840, 1930), rr(16, 30), rr(10, 18), 10), "#4b6a4c", { n: 5, a: 0.12, v: 0.12, d: 2, bd: 1 });
      for (let i = 0; i < 12; i++) paint(g, ellP(rr(10, 190), rr(1840, 1910), rr(5, 8), rr(5, 8), 8), "#c45a9a", { n: 4, a: 0.22, v: 0.08, d: 2, bd: 1 });
    }, { edge: 0.3, gran: 0.4 });

    // ---------- palms (dusk colours) ----------
    const dusk = { trunk: "#5e4e5c", trunkDark: "#3b2f42", lit: "#6f7f5a", mid: "#46573f", dark: "#2a3330", nuts: true };
    S.palmL = E.makePalm("palm-left", {
      ...dusk,
      base: [-110, 1960],
      ctrl: [-10, 1140],
      crown: [62, 470],
      wb: 54,
      wt: 26,
      // fronds fan up and out over the sky; none hang down over the house roof
      angles: [-178, -152, -126, -100, -74, -50, -28, -8, 150, 168],
      droop: [0.72, 0.6, 0.5, 0.42, 0.4, 0.46, 0.56, 0.7, 0.8, 0.8],
      back: [3, 4],
      L: [290, 350],
    });
    S.palmR = E.makePalm("palm-right", {
      ...dusk,
      lit: "#7a8a62",
      base: [1016, 1300],
      ctrl: [1046, 1000],
      crown: [944, 770],
      wb: 30,
      wt: 18,
      angles: [-176, -148, -120, -92, -64, -36, -8, 20, 150, 172],
      droop: [0.72, 0.6, 0.5, 0.42, 0.44, 0.56, 0.7, 0.8, 0.8, 0.8],
      back: [3, 4],
      L: [220, 270],
    });
    S.palmFar = E.makePalm("palm-far", {
      trunk: "#4e3f63",
      trunkDark: "#3e3254",
      lit: "#5a4a70",
      mid: "#4a3d60",
      dark: "#3a2f50",
      base: [700, 1190],
      ctrl: [690, 1050],
      crown: [722, 880],
      wb: 14,
      wt: 9,
      angles: [-170, -140, -112, -84, -56, -28, 0, 160],
      droop: [0.7, 0.55, 0.4, 0.35, 0.4, 0.55, 0.7, 0.75],
      L: [100, 130],
      silhouette: true,
    });

    // ---------- ink lines that draw themselves (grouped by camera depth) ----------
    seed("ink");
    const groups = { 0.2: [], 0.3: [], 0.7: [], 0.85: [], 1.3: [] };
    const add = (d, pts, t0, t1, o = {}) => groups[d].push(...E.sketchLines(pts, t0, t1, o));
    add(0.7, G.roofFront, 0.0, 0.6, { closed: true, w: 2.4 });
    add(0.7, [[302, 852], [228, 864], [88, 1012], [160, 980]], 0.2, 0.65, { w: 2.2 });
    add(0.7, [[190, 990], [190, BASE], [640, BASE], [640, 990]], 0.25, 0.8, { w: 2.4 });
    add(0.7, [[112, 1012], [112, 1172], [190, BASE]], 0.45, 0.8, { w: 2 });
    add(0.7, [[332, 1000], [415, 934], [498, 1000]], 0.5, 0.8, { w: 2.1 });
    G.windows.forEach((cx, i) => groups[0.7].push(E.makeLine(archP(cx - 40, 1040, cx + 40, 1160, 12), 0.6 + i * 0.08, 0.95 + i * 0.08, { closed: true, w: 1.9, gaps: false })));
    groups[0.7].push(E.makeLine(archP(G.door[0], G.door[1], G.door[2], G.door[3], 12), 0.75, 1.05, { closed: true, w: 1.9 }));
    for (const x of G.pillars) {
      add(0.7, [[x, 1012], [x, BASE]], 0.8, 1.05, { w: 1.7 });
      add(0.7, [[x + 22, 1012], [x + 22, BASE]], 0.84, 1.08, { w: 1.7 });
    }
    add(0.7, [[364, 1208], [356, 1222], [474, 1222], [466, 1208]], 0.95, 1.15, { w: 1.7 });
    add(0.3, [[-30, HZ], [92, HZ]], 0.3, 0.5, { w: 1.6, a: 0.6 });
    add(0.3, [[672, HZ], [1110, HZ]], 0.35, 0.8, { w: 1.6, a: 0.6 });
    const shoreLine = [];
    for (let x = 640; x <= 1110; x += 30) shoreLine.push([x, shoreY(x)]);
    groups[0.7].push(E.makeLine(shoreLine, 0.7, 1.3, { w: 1.7, a: 0.55 }));
    groups[0.2].push(E.makeLine(ellP(G.moon[0], G.moon[1], G.moon[2], G.moon[2], 40), 0.15, 0.85, { closed: true, w: 1.8, a: 0.6 }));
    groups[1.3].push(E.makeLine(S.palmL.left, 0.3, 1.1, { w: 2.1, a: 0.65 }), E.makeLine(S.palmL.right, 0.35, 1.15, { w: 2.1, a: 0.65 }));
    groups[0.85].push(E.makeLine(S.palmR.left, 0.45, 1.1, { w: 1.9, a: 0.6 }), E.makeLine(S.palmR.right, 0.5, 1.15, { w: 1.9, a: 0.6 }));
    S.ink = Object.entries(groups).map(([d, lines]) => {
      const c = mk(W, H),
        cg = c.getContext("2d");
      for (const ln of lines) E.drawLine(cg, ln, 1);
      return { depth: +d, lines, done: c };
    });

    // ---------- data for things that move ----------
    seed("fx");
    S.stars = [];
    for (let i = 0; i < 70; i++) S.stars.push({ x: rr(0, W), y: Math.pow(R(), 1.6) * 560, r: rr(0.8, 2.2), id: i });
    S.waves = [];
    for (let i = 0; i < 14; i++) S.waves.push({ ph: i / 14, id: i });
    S.glit = [];
    for (let i = 0; i < 120; i++) S.glit.push({ y: HZ + 10 + Math.pow(R(), 1.2) * 300, xr: gauss() * 0.28, w: rr(8, 22), id: i });
    S.bats = [
      [0, 0, 1.0, 0.0],
      [-60, 30, 0.8, 1.7],
      [-120, -16, 0.7, 3.1],
    ];
  };

  // ---------- per-frame helpers ----------
  function drawBat(g, x, y, s, phase) {
    const f = Math.sin(phase); // wing up/down
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = "rgba(34,24,44,0.95)";
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(sd * 10, -10 - f * 12, sd * 24, -6 - f * 16);
      // scalloped trailing edge
      g.quadraticCurveTo(sd * 20, 0 - f * 6, sd * 16, 2 - f * 4);
      g.quadraticCurveTo(sd * 12, -1 - f * 2, sd * 8, 3);
      g.quadraticCurveTo(sd * 4, 1, 0, 4);
      g.fill();
    }
    g.beginPath();
    g.ellipse(0, 1, 3.4, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-2.5, -3);
    g.lineTo(-3.5, -8);
    g.lineTo(-0.5, -4);
    g.moveTo(2.5, -3);
    g.lineTo(3.5, -8);
    g.lineTo(0.5, -4);
    g.fill();
    g.restore();
  }

  function inkAlpha(t) {
    return 1 - 0.6 * ease(t, S.INK_FADE[0], S.INK_FADE[1]);
  }

  // only the ink (intro); characters' outlines draw themselves too
  S.drawInk = function (g, t) {
    K = S.camAt(t);
    const ti = t + S.LEAD;
    const al = inkAlpha(t);
    for (const grp of S.ink) {
      setCam(g, grp.depth);
      for (const ln of grp.lines) E.drawLine(g, ln, ramp(ti, ln.t0, ln.t1), al);
    }
    for (const c of E.CAST) {
      setCam(g, c.depth);
      c.draw(g, t, { paint: false, ink: true, inkT: ti });
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  };

  S.draw = function (g, t, opt = {}) {
    K = S.camAt(t);
    const wind = { amp: 0.03, dir: 0.15, flutter: 0.35 };
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    // sky, stars, moon
    setCam(g, 0.2);
    g.drawImage(S.sky, 0, 0);
    for (const s of S.stars) {
      const tw = 0.45 + 0.55 * E.hash(s.id, Math.floor(t * 6 + s.id * 0.3));
      g.fillStyle = `rgba(255,246,226,${0.75 * tw * (1 - s.y / 700)})`;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
    }
    const [mx, my, mr] = G.moon;
    g.globalCompositeOperation = "screen";
    const halo = g.createRadialGradient(mx, my, mr * 0.9, mx, my, mr * 3.2);
    halo.addColorStop(0, "rgba(255,236,200,0.32)");
    halo.addColorStop(1, "rgba(255,236,200,0)");
    g.fillStyle = halo;
    g.fillRect(mx - mr * 3.4, my - mr * 3.4, mr * 6.8, mr * 6.8);
    g.globalCompositeOperation = "source-over";
    g.drawImage(S.moonL, 0, 0);
    // bats flap across the moon
    const bt = ramp(t, 2.6, 6.2);
    if (bt > 0 && bt < 1)
      for (const [dx, dy, s, ph] of S.bats) {
        const x = lerp(1180, 380, bt) + dx,
          y = lerp(250, 380, bt) + dy + Math.sin(t * 3 + ph) * 10;
        drawBat(g, x, y, s * 1.5, t * 15 + ph);
      }
    // clouds drift
    setCam(g, 0.25);
    g.drawImage(S.clouds[0], -200 + t * 4, 0);
    setCam(g, 0.32);
    g.drawImage(S.clouds[1], -200 + t * 8, 0);
    // the afterglow of the sun, just set behind the house
    g.globalCompositeOperation = "screen";
    const sg = g.createRadialGradient(400, HZ, 10, 400, HZ, 520);
    sg.addColorStop(0, "rgba(255,214,150,0.6)");
    sg.addColorStop(0.35, "rgba(255,170,120,0.25)");
    sg.addColorStop(1, "rgba(255,150,120,0)");
    g.fillStyle = sg;
    g.fillRect(-100, HZ - 560, W + 200, 900);
    g.globalCompositeOperation = "source-over";
    // horizon land + sea
    setCam(g, 0.3);
    g.drawImage(S.land, 0, 0);
    g.drawImage(S.sea, 0, 0);
    // the moon's path of light on the water
    g.globalCompositeOperation = "screen";
    for (const s of S.glit) {
      const fl = E.hash(s.id, Math.floor(t * 8));
      if (fl < 0.4) continue;
      const spread = 20 + (s.y - HZ) * 0.35;
      const x = mx + s.xr * spread + Math.sin(t * 1.2 + s.id) * 3;
      g.fillStyle = `rgba(255,240,214,${0.6 * fl * (1 - Math.min(1, Math.abs(s.xr) * 1.5))})`;
      g.beginPath();
      g.ellipse(x, s.y, s.w / 2, 1.2 + (s.y - HZ) * 0.004, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
    // rows of waves rolling in (bigger and faster near the shore)
    setCam(g, 0.5);
    g.lineCap = "round";
    for (const w of S.waves) {
      const u = (w.ph + t / 9) % 1;
      const p = u * u;
      const cycle = Math.floor(w.ph + t / 9);
      const nseg = 12;
      for (let j = 0; j < nseg; j++) {
        const x = E.hash(w.id * 31 + j, cycle) * (W + 200) - 100;
        const yS = shoreY(x);
        const y = lerp(HZ + 6, yS - 10, p);
        const len = (26 + 110 * p) * (0.5 + E.hash(j, w.id + cycle));
        const al = (0.12 + 0.5 * p) * (1 - ease(p, 0.85, 1));
        const lw = 1 + p * 3;
        g.strokeStyle = `rgba(60,52,104,${al * 0.5})`;
        g.lineWidth = lw * 1.5;
        g.beginPath();
        g.moveTo(x, y + lw + 1);
        g.quadraticCurveTo(x + len / 2, y + lw, x + len, y + lw + 1);
        g.stroke();
        g.strokeStyle = `rgba(255,${222 + (j % 3) * 10},${200 + (j % 2) * 20},${al})`;
        g.lineWidth = lw * 0.9;
        g.beginPath();
        g.moveTo(x + len * 0.1, y);
        g.quadraticCurveTo(x + len / 2, y - 2 - p * 3, x + len * 0.9, y);
        g.stroke();
      }
    }
    // far palm beside the house
    setCam(g, 0.6);
    E.drawFronds(g, S.palmFar, t, { amp: 0.02, dir: 0.1, flutter: 0.2 }, 0.95, { color: "rgba(64,50,92,0.9)", thin: 0.6 });
    g.drawImage(S.palmFar.trunk, 0, 0);
    // sand, then the sheet of water that runs up it and slides back
    setCam(g, 0.7);
    g.drawImage(S.sand, 0, 0);
    const cyc = (t / 4.6) % 1;
    const up = cyc < 0.5;
    const reach = (up ? Math.sin((Math.PI / 2) * (cyc / 0.5)) : 1 - E.smooth((cyc - 0.5) / 0.5)) * 44;
    const lip = (x) => shoreY(x) + reach * (0.6 + 0.4 * Math.sin(x * 0.008 + 1.3)) * (0.5 + (x > 520 ? (x - 520) / 560 : 0));
    g.fillStyle = "rgba(176,170,210,0.5)";
    g.beginPath();
    g.moveTo(-40, shoreY(-40) - 12);
    for (let x = -40; x <= W + 40; x += 14) g.lineTo(x, lip(x) + Math.sin(x * 0.05 + t) * 1.5);
    g.lineTo(W + 40, shoreY(W + 40) - 12);
    g.fill();
    g.strokeStyle = "rgba(255,246,240,0.85)";
    g.lineWidth = 3;
    g.beginPath();
    for (let x = -40; x <= W + 40; x += 12) {
      const y = lip(x) + Math.sin(x * 0.05 + t) * 1.5;
      x === -40 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    // the house
    g.drawImage(S.side, 0, 0);
    g.drawImage(S.walls, 0, 0);
    g.drawImage(S.roof, 0, 0);
    g.drawImage(S.details, 0, 0);
    g.drawImage(S.rim, 0, 0);
    // lamp light (with a flicker, then off: the people inside are hiding)
    const LO = S.LIGHTS_OFF;
    const off = ease(t, LO, LO + 0.12) * (t > LO + 0.05 && t < LO + 0.16 ? 0.4 : 1);
    const lamp = 1 - (t > LO - 0.25 && t < LO - 0.15 ? 0.5 : off);
    if (lamp > 0.01) {
      g.globalCompositeOperation = "screen";
      g.globalAlpha = lamp;
      g.drawImage(S.glow, 0, 0);
      g.drawImage(S.glow, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    // mid palm on the right, by the water
    setCam(g, 0.85);
    E.drawPalm(g, S.palmR, t + 1.7, wind, 1, 1);
    // the cast (characters), far ones first
    const cast = E.CAST.slice().sort((a, b) => a.groundY(t) - b.groundY(t));
    for (const c of cast) {
      setCam(g, c.depth);
      c.draw(g, t, { paint: true, ink: !opt.noInk });
    }
    // foreground: near palm + dune grass
    setCam(g, 1.3);
    E.drawPalm(g, S.palmL, t, wind, 1, 1);
    g.drawImage(S.fg, 0, 0);
    // ink on top, stepping back once the paint is in
    if (!opt.noInk) {
      const al = inkAlpha(t);
      for (const grp of S.ink) {
        setCam(g, grp.depth);
        g.globalAlpha = al;
        g.drawImage(grp.done, 0, 0);
      }
      g.globalAlpha = 1;
    }
    // dusk grade: a little warmth on top, a soft darkening at the bottom corners
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "soft-light";
    g.fillStyle = "rgba(255,170,130,0.14)";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "multiply";
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.8);
    vg.addColorStop(0, "rgba(255,255,255,0)");
    vg.addColorStop(1, "rgba(120,100,140,0.35)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
  };
})();
