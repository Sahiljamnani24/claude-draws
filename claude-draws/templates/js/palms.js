// =====================================================================================
// claude-draws: coconut palms
// -------------------------------------------------------------------------------------
// The trunk is painted ONCE (watercolour + bark rings), the fronds are re-drawn EVERY
// frame so each leaflet can flutter on its own phase in the wind. Leaflets facing the
// light are lighter, the ones facing away darker (light from the upper right).
//
//   const palm = E.makePalm("palm-left", {
//     trunk: "#8b7b62", trunkDark: "#594b3c",        // trunk colours
//     lit: "#9ec46a", mid: "#5f8f42", dark: "#2f5a2c", // leaf colours
//     base: [96, 1930], ctrl: [10, 1180], crown: [196, 548], // trunk curve (bottom, bend, top)
//     wb: 52, wt: 26,                                 // trunk width at the bottom / top (px)
//     angles: [-178, -150, ...],                      // frond directions in degrees (0 = right, -90 = up)
//     droop:  [0.7, 0.6, ...],                        // how much each frond hangs (0..1)
//     back: [3, 4],                                   // which fronds sit behind (darker)
//     L: [300, 380],                                  // frond length range (px)
//     nuts: true,                                     // coconuts under the crown
//     silhouette: false,                              // true = flat dark shape (dusk, far away)
//   });
//   // per frame:
//   E.drawPalm(g, palm, t, { amp: 0.04, dir: 0, flutter: 0.4 });
//   //   amp = sway (radians), dir = lean of the wind (-1 left .. 1 right), flutter = leaf shiver
//
// Ink outline of the trunk for the self-drawing intro: E.makeLine(palm.left, t0, t1) and
// E.makeLine(palm.right, t0, t1).
// =====================================================================================
(function () {
  const { seed, R, rr, gauss, hex, rgba, mix, lerp, mk, quadPts, paint, paintIn, finish } = E;

  E.makePalm = function (name, o) {
    seed(name);
    const P = { o, crown: o.crown, fronds: [] };
    // trunk: painted once (watercolour), with rings and a shaded side
    const spine = quadPts(o.base, o.ctrl, o.crown, 70);
    const left = [],
      right = [];
    for (let i = 0; i < spine.length; i++) {
      const p = spine[i],
        q = spine[Math.min(spine.length - 1, i + 1)],
        r0 = spine[Math.max(0, i - 1)];
      let tx = q[0] - r0[0],
        ty = q[1] - r0[1];
      const tl = Math.hypot(tx, ty);
      tx /= tl;
      ty /= tl;
      const w = lerp(o.wb, o.wt, i / (spine.length - 1)) / 2;
      left.push([p[0] - ty * w, p[1] + tx * w]);
      right.push([p[0] + ty * w, p[1] - tx * w]);
    }
    P.spine = spine;
    P.left = left;
    P.right = right;
    const outline = [...left, ...right.slice().reverse()];
    P.outline = outline;
    const tc = mk(E.W, E.H),
      tg = tc.getContext("2d");
    if (o.silhouette) {
      tg.fillStyle = o.trunk;
      E.fillPoly(tg, outline);
    } else {
      paint(tg, outline, o.trunk, { n: 14, a: 0.1, v: 0.003, d: 2, bd: 1 });
      // shaded side (away from the light) + lit edge
      paintIn(tg, outline, () => {
        const shade = left.map((p, i) => [lerp(p[0], spine[i][0], -0.1), p[1]]).concat(spine.slice().reverse());
        paint(tg, shade, o.trunkDark, { n: 10, a: 0.07, v: 0.004, d: 2, bd: 1 });
        // ring scars
        tg.lineCap = "round";
        for (let i = 2; i < spine.length - 2; i += 2) {
          const l = left[i],
            r = right[i];
          tg.strokeStyle = rgba(hex(o.trunkDark), 0.38 + 0.25 * R());
          tg.lineWidth = rr(1.2, 2.4);
          tg.beginPath();
          tg.moveTo(l[0], l[1]);
          tg.quadraticCurveTo((l[0] + r[0]) / 2, (l[1] + r[1]) / 2 + 4, r[0], r[1]);
          tg.stroke();
        }
        // fine vertical bark streaks
        for (let k = 0; k < 40; k++) {
          const i0 = Math.floor(rr(0, spine.length - 8));
          const side = R();
          tg.strokeStyle = rgba(hex(o.trunkDark), 0.18);
          tg.lineWidth = 1;
          tg.beginPath();
          for (let i = i0; i < i0 + 7; i++) {
            const p = [lerp(left[i][0], right[i][0], side), lerp(left[i][1], right[i][1], side)];
            i === i0 ? tg.moveTo(p[0], p[1]) : tg.lineTo(p[0], p[1]);
          }
          tg.stroke();
        }
      });
      finish(tc, { edge: 0.35, gran: 0.5 });
    }
    P.trunk = tc;
    // crown base: old frond boots + coconuts
    const nc = mk(E.W, E.H),
      ng = nc.getContext("2d");
    if (!o.silhouette) {
      for (let i = 0; i < 7; i++) paint(ng, E.ellP(o.crown[0] + rr(-18, 18), o.crown[1] + rr(-4, 18), rr(14, 24), rr(10, 18), 10, rr(-1, 1)), "#6b5a3e", { n: 6, a: 0.16, v: 0.05, d: 2, bd: 1 });
      if (o.nuts)
        for (let i = 0; i < 7; i++) {
          const cx = o.crown[0] + rr(-30, 30),
            cy = o.crown[1] + rr(14, 46);
          paint(ng, E.ellP(cx, cy, 15, 17, 12), i % 3 ? "#7e7a2e" : "#5d6a26", { n: 9, a: 0.17, v: 0.03, d: 2, bd: 1 });
          paint(ng, E.ellP(cx + 5, cy - 6, 5, 4, 8), "#c8c47a", { n: 4, a: 0.12, v: 0.05, d: 2, bd: 1 });
        }
      finish(nc, { edge: 0.4, gran: 0.4 });
    } else {
      ng.fillStyle = o.trunk;
      for (let i = 0; i < 6; i++) E.fillPoly(ng, E.ellP(o.crown[0] + rr(-18, 18), o.crown[1] + rr(0, 30), rr(14, 22), rr(12, 18), 10));
    }
    P.nuts = nc;
    // fronds (data only; drawn per frame)
    o.angles.forEach((deg, i) => {
      const L = rr(o.L[0], o.L[1]);
      const fr = {
        a0: (deg * Math.PI) / 180,
        L,
        droop: o.droop[i % o.droop.length] * rr(0.9, 1.1),
        ph: R() * Math.PI * 2,
        f: rr(0.85, 1.2),
        back: o.back ? o.back.includes(i) : false,
        leaves: [],
      };
      const N = 26;
      for (let k = 2; k <= N; k++)
        for (const side of [-1, 1])
          fr.leaves.push({
            k,
            side,
            lj: rr(0.78, 1.18),
            ang: rr(0.55, 0.9),
            dr: rr(0.45, 0.85),
            ph: R() * 6.28,
            w: rr(0.85, 1.2),
            cj: [gauss() * 7, gauss() * 7, gauss() * 5],
            miss: R() < 0.06, // a torn / missing leaflet here and there
          });
      P.fronds.push(fr);
    });
    // draw back fronds first
    P.fronds.sort((a, b) => (b.back ? 1 : 0) - (a.back ? 1 : 0));
    return P;
  };

  // wind = { amp (rad), dir (-1 left, +1 right), flutter (0..1), gust }
  E.drawFronds = function (g, P, t, wind, alpha = 1, o2 = {}) {
    const o = P.o;
    const lit = hex(o.lit),
      mid = hex(o.mid),
      dark = hex(o.dark);
    const Lx = 0.55,
      Ly = -0.83; // light from the upper right
    const N = 26;
    g.save();
    g.globalAlpha = alpha;
    g.lineCap = "round";
    for (const fr of P.fronds) {
      const sway =
        wind.amp * (0.65 * Math.sin(2 * Math.PI * 0.38 * fr.f * t + fr.ph) + 0.35 * Math.sin(2 * Math.PI * 0.93 * fr.f * t + 2.3 * fr.ph)) +
        wind.amp * 0.55 * wind.dir;
      let x = P.crown[0],
        y = P.crown[1];
      const rib = [[x, y]];
      for (let k = 1; k <= N; k++) {
        const s = k / N;
        const a = fr.a0 + sway * Math.pow(s, 1.5) * 1.6;
        x += (Math.cos(a) * fr.L) / N;
        y += (Math.sin(a) * fr.L) / N + (fr.droop * fr.L * 2 * s) / N;
        rib.push([x, y]);
      }
      const shadeK = fr.back ? 0.55 : 1;
      for (const lf of fr.leaves) {
        if (lf.miss) continue;
        const k = lf.k,
          s = k / N;
        const p = rib[k],
          q = rib[k - 1];
        let tx = p[0] - q[0],
          ty = p[1] - q[1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const nx = -ty * lf.side,
          ny = tx * lf.side;
        const env = Math.sin(Math.PI * Math.min(1, 0.1 + s * 0.95));
        const ll = fr.L * 0.31 * env * lf.lj;
        const ca = Math.cos(lf.ang),
          sa = Math.sin(lf.ang);
        let ex = p[0] + (tx * ca + nx * sa) * ll;
        let ey = p[1] + (ty * ca + ny * sa) * ll + ll * lf.dr * (0.55 + 0.45 * s);
        // flutter: each leaflet on its own phase
        const fl = Math.sin(t * (5.5 + lf.ph) + lf.ph * 3) * wind.flutter * ll * 0.07;
        ex += nx * fl;
        ey += ny * fl;
        const dx = ex - p[0],
          dy = ey - p[1];
        const dl = Math.hypot(dx, dy) || 1;
        const facing = (dx / dl) * Lx + (dy / dl) * Ly; // -1..1
        const c0 = facing > 0 ? mix(mid, lit, Math.min(1, facing * 1.4)) : mix(mid, dark, Math.min(1, -facing * 1.2));
        const c = mix(dark, [c0[0] + lf.cj[0], c0[1] + lf.cj[1], c0[2] + lf.cj[2]], shadeK);
        const w = 4.2 * lf.w * (1 - s * 0.45) * (o2.thin ?? 1) * Math.max(1, fr.L / 290) * (o.silhouette ? 1.25 : 1);
        const mx = p[0] + dx * 0.5 + (dy / dl) * ll * 0.08 * lf.side,
          my = p[1] + dy * 0.45 - (dx / dl) * ll * 0.08 * lf.side;
        const px = (-dy / dl) * w,
          py = (dx / dl) * w;
        g.fillStyle = o2.color ?? rgba(c, o.silhouette ? 0.95 : 0.9);
        g.beginPath();
        g.moveTo(p[0] + px * 0.5, p[1] + py * 0.5);
        g.quadraticCurveTo(mx + px, my + py, ex, ey);
        g.quadraticCurveTo(mx - px, my - py, p[0] - px * 0.5, p[1] - py * 0.5);
        g.closePath();
        g.fill();
      }
      // spine
      g.strokeStyle = o2.color ?? rgba(mix(dark, [40, 30, 20], 0.3), 0.85);
      for (let k = 1; k <= N; k++) {
        g.lineWidth = lerp(4.2, 1.1, k / N) * (o2.thin ?? 1);
        g.beginPath();
        g.moveTo(rib[k - 1][0], rib[k - 1][1]);
        g.lineTo(rib[k][0], rib[k][1]);
        g.stroke();
      }
    }
    g.restore();
  };

  E.drawPalm = function (g, P, t, wind, aT = 1, aF = 1) {
    if (aT > 0) {
      g.globalAlpha = aT;
      g.drawImage(P.trunk, 0, 0);
    }
    if (aF > 0) E.drawFronds(g, P, t, wind, aF);
    if (aT > 0) {
      g.globalAlpha = aT;
      g.drawImage(P.nuts, 0, 0);
    }
    g.globalAlpha = 1;
  };
})();
