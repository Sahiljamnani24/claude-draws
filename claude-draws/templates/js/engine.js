// =====================================================================================
// claude-draws: the painting engine
// -------------------------------------------------------------------------------------
// Everything on screen is painted by code on a <canvas>: no images, no AI pictures,
// no stock. This file gives a scene the tools a watercolour painter has:
//
//   E.paint(g, pts, colour, opts)   a watercolour WASH: many thin, see-through,
//                                   slightly different copies of a shape -> soft,
//                                   uneven colour with a living edge
//   E.finish(layer, opts)           the "real watercolour" pass on a painted layer:
//                                   darker pigment at the edges + granulation
//   E.sketchLines / E.makeLine      INK lines that wobble like a hand, overshoot at
//   E.drawLine(g, line, progress)   corners, lift the pen now and then, and can draw
//                                   themselves on screen (progress 0..1)
//   E.makePaper()                   cream cold-press paper + fine grain
//
// THE TWO RULES THAT KEEP RENDERS IDENTICAL (deterministic + seek-safe):
//   1. Randomness only from E.seed("name") + E.R() / E.rr() / E.gauss(), and only
//      while BUILDING layers (once, before the timeline starts). Call E.seed with a
//      new name before each layer, so changing one layer never changes another.
//   2. Inside a per-frame draw(g, t), never call E.R(). Use E.hash(i, j) instead
//      (same answer every time for the same i, j). The frame must be a pure function
//      of t, because the renderer can ask for any frame in any order.
// =====================================================================================
(function () {
  const E = (window.E = {});

  // Frame size. 1080x1920 = vertical reel. For 16:9 use 1920x1080 and also change
  // data-width / data-height and the <canvas> size in index.html.
  E.W = 1080;
  E.H = 1920;

  // ---------- seeded randomness (build time only) ----------
  let rng = null;
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // seed from a name: E.seed("house-roof") always gives the same random sequence
  E.seed = function (name) {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
    rng = mulberry32(h >>> 0);
  };
  E.seed("default");
  E.R = () => rng(); // 0..1
  E.rr = (a, b) => a + (b - a) * rng(); // a..b
  E.gauss = function () {
    // bell-curve random number (mean 0, spread 1)
    let u = 0,
      v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  // per-frame "random" that is really a fixed function of two integers (safe inside draw)
  E.hash = function (i, j) {
    let h = Math.imul((i | 0) * 374761393 + (j | 0) * 668265263, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // ---------- small helpers ----------
  E.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  E.ramp = (t, a, b) => E.clamp((t - a) / (b - a)); // 0 before a, 1 after b, straight in between
  E.smooth = (x) => x * x * (3 - 2 * x);
  E.ease = (t, a, b) => E.smooth(E.ramp(t, a, b)); // same, but eases in and out
  E.lerp = (a, b, k) => a + (b - a) * k;
  E.mk = function (w, h) {
    // an off-screen canvas (a "layer")
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };
  E.hex = function (h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  E.rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  E.mix = (a, b, k) => [E.lerp(a[0], b[0], k), E.lerp(a[1], b[1], k), E.lerp(a[2], b[2], k)];

  // ---------- shapes (all return a list of [x, y] points) ----------
  const lerp = E.lerp;
  E.rectP = function (x0, y0, x1, y1, sub = 5) {
    const P = [];
    for (let i = 0; i < sub; i++) P.push([lerp(x0, x1, i / sub), y0]);
    for (let i = 0; i < sub; i++) P.push([x1, lerp(y0, y1, i / sub)]);
    for (let i = 0; i < sub; i++) P.push([lerp(x1, x0, i / sub), y1]);
    for (let i = 0; i < sub; i++) P.push([x0, lerp(y1, y0, i / sub)]);
    return P;
  };
  // a polygon with extra points on each side (more points = more natural wash edges)
  E.polyP = function (pts, sub = 3) {
    const P = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      for (let k = 0; k < sub; k++) P.push([lerp(a[0], b[0], k / sub), lerp(a[1], b[1], k / sub)]);
    }
    return P;
  };
  E.ellP = function (cx, cy, rx, ry, n = 16, rot = 0) {
    const P = [];
    const c = Math.cos(rot),
      s = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * rx,
        y = Math.sin(a) * ry;
      P.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return P;
  };
  // a round-topped arch (windows, doors)
  E.archP = function (x0, yTop, x1, y1, n = 12) {
    const r = (x1 - x0) / 2,
      cx = (x0 + x1) / 2,
      ya = yTop + r;
    const P = [
      [x0, y1],
      [cx, y1],
      [x1, y1],
      [x1, lerp(y1, ya, 0.5)],
      [x1, ya],
    ];
    for (let i = 1; i < n; i++) {
      const a = (i / n) * Math.PI;
      P.push([cx + Math.cos(a) * r, ya - Math.sin(a) * r]);
    }
    P.push([x0, ya], [x0, lerp(ya, y1, 0.5)]);
    return P;
  };
  // points along a curve from p0 to p2, bent toward p1
  E.quadPts = function (p0, p1, p2, n) {
    const P = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n,
        u = 1 - s;
      P.push([u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0], u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1]]);
    }
    return P;
  };
  // round off a jagged outline (Chaikin corner cutting); 2 passes = smooth, still hand-made
  E.smoothP = function (pts, iters = 2, closed = true) {
    let P = pts;
    for (let k = 0; k < iters; k++) {
      const Q = closed ? [] : [P[0]];
      const N = closed ? P.length : P.length - 1;
      for (let i = 0; i < N; i++) {
        const a = P[i],
          b = P[(i + 1) % P.length];
        Q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      if (!closed) Q.push(P[P.length - 1]);
      P = Q;
    }
    return P;
  };
  E.pathOf = function (g, P, close = true) {
    g.beginPath();
    g.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]);
    if (close) g.closePath();
  };
  E.fillPoly = function (g, P) {
    E.pathOf(g, P);
    g.fill();
  };

  // ---------- watercolour washes ----------
  // Recursively splits every edge and nudges the new midpoint at random. Each point
  // carries its own "wobbliness" (v), so some parts of an edge stay crisp and others
  // bleed, the way wet paint does. (Based on Tyler Hobbs' generative watercolour method.)
  function deform(pts, v, depth) {
    let P = pts.map((p) => [p[0], p[1], v * (0.5 + rng())]);
    for (let k = 0; k < depth; k++) {
      const Q = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i],
          b = P[(i + 1) % P.length];
        Q.push(a);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const mv = (a[2] + b[2]) / 2;
        const sd = len * mv;
        Q.push([(a[0] + b[0]) / 2 + E.gauss() * sd, (a[1] + b[1]) / 2 + E.gauss() * sd, mv * (0.55 + rng() * 0.6)]);
      }
      P = Q;
    }
    return P;
  }
  E.deform = deform;

  // A wash = n thin see-through layers, each a slightly different deformed copy.
  //   n  number of layers (more = richer, slower)      a  alpha of each layer
  //   v  how much the edge wanders (0.003 crisp .. 0.15 very soft and blobby)
  //   d  deform depth per layer   bd  deform depth of the shared base shape
  //   cj colour jitter per layer (pigment is never perfectly even)
  // Tip: architecture wants low v (0.004-0.01); skies, foliage, clouds want high v (0.1+).
  E.paint = function (g, pts, col, o = {}) {
    const n = o.n ?? 20,
      a = o.a ?? 0.06,
      v = o.v ?? 0.03,
      d = o.d ?? 3,
      bd = o.bd ?? 2,
      cj = o.cj ?? 6;
    const c = typeof col === "string" ? E.hex(col) : col;
    const base = deform(pts, v, bd).map((p) => [p[0], p[1]]);
    for (let i = 0; i < n; i++) {
      const P = deform(base, v * 0.8, d);
      g.fillStyle = E.rgba([c[0] + E.gauss() * cj, c[1] + E.gauss() * cj, c[2] + E.gauss() * cj], a);
      E.fillPoly(g, P);
    }
    return base;
  };
  // a flat, even fill (gouache-like) with a slightly wobbly edge
  E.flat = function (g, pts, col, a = 1, v = 0.006) {
    const c = typeof col === "string" ? E.hex(col) : col;
    g.fillStyle = E.rgba(c, a);
    E.fillPoly(g, deform(pts, v, 2));
  };
  // paint only inside a shape (like masking fluid / tape)
  E.paintIn = function (g, clipPts, fn) {
    g.save();
    E.pathOf(g, clipPts);
    g.clip();
    fn();
    g.restore();
  };
  // vertical gradient fill inside a shape (graded wash: skies, sea)
  E.gradIn = function (g, pts, y0, y1, stops) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    for (const [k, c] of stops) gr.addColorStop(k, c);
    g.fillStyle = gr;
    E.fillPoly(g, pts);
  };

  // pigment texture used for granulation (pigment settles in the paper's valleys)
  let GRAN = null;
  E.granTexture = function () {
    if (GRAN) return GRAN;
    const w = 540,
      h = 960;
    const n = E.valueNoise(w, h, "granulation", 0.09, 3);
    E.seed("gran-speck");
    const c = E.mk(w, h),
      g = c.getContext("2d");
    const id = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 255 - Math.pow(n[i], 2.2) * 70 - (rng() < 0.05 ? 40 * rng() : 0);
      id.data[i * 4] = v;
      id.data[i * 4 + 1] = v;
      id.data[i * 4 + 2] = v;
      id.data[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    const big = E.mk(E.W, E.H);
    big.getContext("2d").drawImage(c, 0, 0, E.W, E.H);
    GRAN = big;
    return GRAN;
  };
  // Finishing pass that makes a painted layer look like real watercolour:
  //   edge  darker pigment collects at the rim of a wash as it dries (0..1)
  //   blur  how wide that dark rim is (px)
  //   gran  pigment granulation strength (0..1)
  // Works on full-frame layers and on small sprites (character parts): the
  // granulation texture is cropped 1:1 (never squashed), so its grain size matches.
  E.finish = function (layer, o = {}) {
    const W = layer.width,
      H = layer.height;
    const edge = o.edge ?? 0.45,
      blur = o.blur ?? 7,
      gran = o.gran ?? 0.5;
    const g = layer.getContext("2d");
    if (edge > 0) {
      const bl = E.mk(W, H),
        bg = bl.getContext("2d");
      bg.filter = `blur(${blur}px)`;
      bg.drawImage(layer, 0, 0);
      const ring = E.mk(W, H),
        rg = ring.getContext("2d");
      rg.drawImage(layer, 0, 0);
      rg.globalCompositeOperation = "destination-out";
      rg.drawImage(bl, 0, 0);
      rg.drawImage(bl, 0, 0);
      // darken the rim with the layer's own colour (multiply on itself)
      g.save();
      g.globalAlpha = edge;
      g.globalCompositeOperation = "multiply";
      g.drawImage(ring, 0, 0);
      g.restore();
    }
    if (gran > 0) {
      const t = E.mk(W, H),
        tg = t.getContext("2d");
      tg.drawImage(layer, 0, 0);
      tg.globalCompositeOperation = "source-in";
      const tex = E.granTexture();
      if (W > tex.width || H > tex.height) tg.drawImage(tex, 0, 0, W, H); // bigger than the frame: stretch
      else {
        // smaller than the frame (a sprite): crop a piece at 1:1 so the grain keeps its size
        const ox = (o.granX ?? 0) % (tex.width - W + 1),
          oy = (o.granY ?? 0) % (tex.height - H + 1);
        tg.drawImage(tex, ox, oy, W, H, 0, 0, W, H);
      }
      g.save();
      g.globalAlpha = gran;
      g.globalCompositeOperation = "multiply";
      g.drawImage(t, 0, 0);
      g.restore();
    }
    return layer;
  };

  // ---------- ink lines (urban-sketch style) ----------
  // Confident lines that overshoot a little at corners, wobble like a hand, thin out at
  // the ends (pen pressure) and have small gaps where the pen lifted.
  E.INK = E.hex("#33241d"); // warm sepia-black, softer than pure black
  function densify(pts, step = 5) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let k = 1; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
    }
    return out;
  }
  // One stroke per straight side, each with a little overshoot, like a sketcher's line.
  // t0..t1 = when the whole shape draws itself (seconds); strokes follow one another.
  E.sketchLines = function (pts, t0, t1, o = {}) {
    const closed = o.closed ?? false;
    const segs = [];
    const N = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < N; i++) segs.push([pts[i], pts[(i + 1) % pts.length]]);
    const total = segs.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
    let acc = 0;
    const out = [];
    for (const [a, b] of segs) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const dx = (b[0] - a[0]) / L,
        dy = (b[1] - a[1]) / L;
      const os = o.overshoot ?? Math.min(4, L * 0.03);
      const A = [a[0] - dx * os * rng(), a[1] - dy * os * rng()],
        B = [b[0] + dx * os * (0.4 + rng()), b[1] + dy * os * (0.4 + rng())];
      const s0 = t0 + (t1 - t0) * (acc / total);
      acc += L;
      const s1 = t0 + (t1 - t0) * (acc / total);
      out.push(E.makeLine([A, B], s0, s1, o));
    }
    return out;
  };
  // One continuous line through pts (use for curves: trunks, outlines of figures).
  //   w width, a alpha, col [r,g,b], wob hand wobble (px), gaps pen lifts on/off
  E.makeLine = function (pts, t0, t1, o = {}) {
    const P0 = densify(o.closed && pts.length > 2 ? [...pts, pts[0]] : pts, 5);
    const ph = rng() * 10,
      ph2 = rng() * 10,
      wob = o.wob ?? 0.9;
    let acc = 0;
    const P = P0.map((p, i) => {
      if (i > 0) acc += Math.hypot(p[0] - P0[i - 1][0], p[1] - P0[i - 1][1]);
      const w = Math.sin(acc * 0.019 + ph) * wob + Math.sin(acc * 0.061 + ph2) * wob * 0.4;
      return [p[0] + w * 0.6, p[1] + w];
    });
    const L = [0];
    for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const gaps = [];
    if ((o.gaps ?? true) && L[L.length - 1] > 120) {
      const ng = rng() < 0.6 ? Math.floor(L[L.length - 1] / 420) : 0;
      for (let k = 0; k < ng; k++) {
        const c = rng() * L[L.length - 1];
        gaps.push([c, c + 4 + rng() * 9]);
      }
    }
    return { P, L, total: L[L.length - 1], t0, t1, w: o.w ?? 2.2, a: o.a ?? 0.72, col: o.col ?? E.INK, ph: rng() * 6, gaps };
  };
  // Draw a line up to progress p (0 = nothing, 1 = whole line). Uses the current
  // transform of g, so a character's lines can move and rotate with its body parts.
  E.drawLine = function (g, ln, p, alphaMul = 1) {
    if (p <= 0 || ln.total <= 0) return;
    const lim = ln.total * p;
    g.strokeStyle = E.rgba(ln.col, ln.a * alphaMul);
    g.lineCap = "round";
    g.lineJoin = "round";
    const RUN = 4;
    for (let i = 1; i < ln.P.length; i += RUN) {
      if (ln.L[i - 1] > lim) break;
      const mid = ln.L[i];
      if (ln.gaps.some(([a, b]) => mid > a && mid < b)) continue;
      g.beginPath();
      g.moveTo(ln.P[i - 1][0], ln.P[i - 1][1]);
      for (let j = i; j < Math.min(ln.P.length, i + RUN); j++) {
        if (ln.L[j] > lim) {
          const k = (lim - ln.L[j - 1]) / Math.max(0.001, ln.L[j] - ln.L[j - 1]);
          g.lineTo(lerp(ln.P[j - 1][0], ln.P[j][0], k), lerp(ln.P[j - 1][1], ln.P[j][1], k));
          break;
        }
        g.lineTo(ln.P[j][0], ln.P[j][1]);
      }
      // pressure: thinner at the ends of a stroke, fuller in the middle
      const s = ln.L[i] / Math.max(1, ln.total);
      const taper = Math.min(1, s * 6, (1 - s) * 6) * 0.5 + 0.5;
      g.lineWidth = ln.w * taper * (0.8 + 0.35 * Math.abs(Math.sin(ln.L[i] * 0.011 + ln.ph)));
      g.stroke();
    }
  };

  // ---------- noise + paper ----------
  // smooth value noise (0..1) on a w x h grid; scale = feature size, oct = detail levels
  E.valueNoise = function (w, h, name, scale, oct = 4) {
    E.seed(name);
    const G = 64;
    const lat = new Float32Array(G * G);
    for (let i = 0; i < lat.length; i++) lat[i] = rng();
    const vn = (x, y) => {
      const xi = Math.floor(x),
        yi = Math.floor(y);
      const xf = x - xi,
        yf = y - yi;
      const u = xf * xf * (3 - 2 * xf),
        v = yf * yf * (3 - 2 * yf);
      const ix = ((xi % G) + G) % G,
        iy = ((yi % G) + G) % G,
        ix1 = (ix + 1) % G,
        iy1 = (iy + 1) % G;
      const a = lat[iy * G + ix],
        b = lat[iy * G + ix1],
        c = lat[iy1 * G + ix],
        d = lat[iy1 * G + ix1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const out = new Float32Array(w * h);
    let norm = 0,
      amp = 0.5;
    for (let o = 0; o < oct; o++) {
      norm += amp;
      amp *= 0.5;
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let f = 0,
          am = 0.5,
          fr = scale;
        for (let o = 0; o < oct; o++) {
          f += am * vn(x * fr + o * 17.3, y * fr + o * 9.1);
          am *= 0.5;
          fr *= 2;
        }
        out[y * w + x] = f / norm;
      }
    return out;
  };
  // cream paper (soft mottling) + a grain layer that is multiplied over every frame
  E.makePaper = function (base = "#f2eadb") {
    const W = E.W,
      H = E.H;
    const lw = Math.round(W / 4),
      lh = Math.round(H / 4);
    const n = E.valueNoise(lw, lh, "paper-mottle", 0.02, 4);
    const low = E.mk(lw, lh),
      lg = low.getContext("2d");
    const id = lg.createImageData(lw, lh);
    const b = E.hex(base);
    for (let i = 0; i < lw * lh; i++) {
      const k = (n[i] - 0.5) * 18;
      id.data[i * 4] = b[0] + k;
      id.data[i * 4 + 1] = b[1] + k * 0.95;
      id.data[i * 4 + 2] = b[2] + k * 0.8;
      id.data[i * 4 + 3] = 255;
    }
    lg.putImageData(id, 0, 0);
    const paper = E.mk(W, H),
      pg = paper.getContext("2d");
    pg.imageSmoothingQuality = "high";
    pg.drawImage(low, 0, 0, W, H);
    // cold-press paper tooth: fine grain multiplied over the whole frame
    const tw = Math.round(W / 2),
      th = Math.round(H / 2);
    const tooth = E.valueNoise(tw, th, "paper-tooth", 0.35, 2);
    E.seed("paper-grain");
    const grain = E.mk(W, H),
      gg = grain.getContext("2d");
    const gd = gg.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const tv = tooth[Math.min(th - 1, y >> 1) * tw + Math.min(tw - 1, x >> 1)];
        const r = rng();
        const v = 255 - tv * 16 - (r < 0.05 ? 18 * rng() : 4 * r);
        gd.data[i * 4] = v;
        gd.data[i * 4 + 1] = v;
        gd.data[i * 4 + 2] = v - 1;
        gd.data[i * 4 + 3] = 255;
      }
    gg.putImageData(gd, 0, 0);
    return { paper, grain };
  };

  // ---------- a painted layer in one call ----------
  // E.layer("sky", (g) => { ...paint... }, { edge, gran })  -> a finished full-frame canvas
  // Pass fin = false to skip the watercolour finish (glows, shadows, mist).
  E.layer = function (name, fn, fin, w = E.W, h = E.H) {
    E.seed(name);
    const c = E.mk(w, h),
      g = c.getContext("2d");
    fn(g, c);
    if (fin !== false) E.finish(c, fin || {});
    return c;
  };

  // ---------- a bird in flight, seen from the side, flying right ----------
  // phase drives the wing beat (fast downstroke, slower upstroke). kind: "egret" | "crow"
  E.drawBird = function (g, x, y, s, phase, body, line, kind = "crow") {
    const f = Math.sin(phase - 0.55 * Math.sin(phase)); // -1 down .. 1 up
    const egret = kind === "egret";
    const span = (egret ? 34 : 24) * s;
    const up = f * span * 0.9;
    g.save();
    g.translate(x, y);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 1.1;
    const wing = (dx, shade) => {
      const sx = 2 * s + dx,
        sy = -2 * s;
      const tx = -9 * s + dx,
        ty = -up + (f < 0 ? 4 * s : 0);
      const ch = (egret ? 15 : 12) * s;
      g.fillStyle = shade;
      g.strokeStyle = line;
      g.beginPath();
      g.moveTo(sx + ch * 0.45, sy);
      g.quadraticCurveTo((sx + tx) / 2 + ch * 0.5, (sy + ty) / 2 - 3 * s, tx, ty);
      g.quadraticCurveTo((sx + tx) / 2 - ch * 0.35, (sy + ty) / 2 + 5 * s, sx - ch * 0.55, sy + 1 * s);
      g.closePath();
      g.fill();
      g.stroke();
    };
    wing(5 * s, egret ? "rgba(226,228,226,0.95)" : body);
    g.fillStyle = body;
    g.strokeStyle = line;
    g.beginPath();
    g.ellipse(0, 0, (egret ? 15 : 11) * s, (egret ? 4.4 : 4.6) * s, -0.06, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (egret) {
      g.beginPath();
      g.arc(16 * s, -2.5 * s, 3.6 * s, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.strokeStyle = "rgba(226,178,52,0.95)";
      g.lineWidth = 1.6 * s;
      g.beginPath();
      g.moveTo(19 * s, -2.5 * s);
      g.lineTo(29 * s, -1 * s);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(11 * s, -1.5 * s, 3.8 * s, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-9 * s, -1 * s);
      g.lineTo(-19 * s, -4 * s);
      g.lineTo(-19 * s, 4 * s);
      g.closePath();
      g.fill();
    }
    wing(-1 * s, body);
    g.restore();
  };
})();
