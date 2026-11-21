// The five scenes, drawn entirely in code.
//
// A scene is built with a brush. The brush collects shapes into *objects*: a lantern is not one
// shape but a cord, a body and a glow, and a difference should treat those three as one thing.
// So the brush hands back both the flat item list the painter draws and a list of objects with a
// centre and a radius — and diffs.js picks its differences from the objects, never the loose
// shapes. That is what makes "the lantern moved" read as one change instead of three glitches.
//
// Everything is laid out on a 1000 x 640 stage. Positions are hand-placed for composition and
// jittered by the seeded generator, so the same seed always draws the same shop.

STD.scenes = (function () {
  var A = STD.art;
  var P = STD.palettes;

  var W = 1000;
  var H = 640;

  /** A brush: describe shapes, collect them into named objects. */
  function brush(prefix) {
    var items = [];
    var objects = [];
    var open = null;
    var made = 0;

    /** Add one shape; if an object is open, the shape becomes part of it. */
    function add(spec) {
      spec.id = spec.id || prefix + '-' + made;
      made += 1;
      var it = A.item(spec);
      items.push(it);
      if (open) open.parts.push(items.length - 1);
      return it;
    }

    /** Finish the open object: work out where it is and how big it is. */
    function close() {
      var g = open;
      open = null;
      if (!g.parts.length) return g;
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var i = 0; i < g.parts.length; i += 1) {
        var it = items[g.parts[i]];
        var e = A.extent(it);
        minX = Math.min(minX, it.x - e.rx); maxX = Math.max(maxX, it.x + e.rx);
        minY = Math.min(minY, it.y - e.ry); maxY = Math.max(maxY, it.y + e.ry);
      }
      g.x = (minX + maxX) / 2;
      g.y = (minY + maxY) / 2;
      g.hw = (maxX - minX) / 2;
      g.hh = (maxY - minY) / 2;
      objects.push(g);
      return g;
    }

    var b = {
      items: items,
      objects: objects,

      /** Start an object named `id`; everything added until end() belongs to it. */
      begin: function (id, tag) { open = { id: id, tag: tag || 'prop', parts: [] }; return b; },
      end: close,
      /** Describe one object in one call. */
      object: function (id, tag, draw) { b.begin(id, tag); draw(); return close(); },

      // -- shapes -------------------------------------------------------------
      /** A rectangle, centred on (x, y). */
      box: function (x, y, w, h, fill, o) {
        o = o || {};
        return add({ d: A.rect(w, h), hw: w / 2, hh: h / 2, x: x, y: y, fill: fill, tag: o.tag,
          stroke: o.stroke, lw: o.lw, rot: o.rot, alpha: o.alpha, glow: o.glow, shadow: o.shadow });
      },
      /** A rectangle with rounded corners. */
      rbox: function (x, y, w, h, r, fill, o) {
        o = o || {};
        return add({ d: A.rrect(w, h, r), hw: w / 2, hh: h / 2, x: x, y: y, fill: fill, tag: o.tag,
          stroke: o.stroke, lw: o.lw, rot: o.rot, alpha: o.alpha, glow: o.glow, shadow: o.shadow });
      },
      /** A bar with rounded ends — pipes, cords, limbs, chopsticks. */
      bar: function (x, y, w, h, fill, o) {
        o = o || {};
        return add({ d: A.capsule(w, h), hw: w / 2, hh: h / 2, x: x, y: y, fill: fill, tag: o.tag,
          rot: o.rot, alpha: o.alpha, glow: o.glow, stroke: o.stroke, lw: o.lw });
      },
      /** A circle. */
      disc: function (x, y, r, fill, o) {
        o = o || {};
        return add({ d: A.circle(r), hw: r, hh: r, x: x, y: y, fill: fill, tag: o.tag,
          stroke: o.stroke, lw: o.lw, alpha: o.alpha, glow: o.glow, shadow: o.shadow });
      },
      /** An ellipse. */
      ell: function (x, y, rx, ry, fill, o) {
        o = o || {};
        return add({ d: A.ellipse(rx, ry), hw: rx, hh: ry, x: x, y: y, fill: fill, tag: o.tag,
          stroke: o.stroke, lw: o.lw, rot: o.rot, alpha: o.alpha, glow: o.glow });
      },
      /** A polygon through the given points, positioned at (x, y). */
      poly: function (x, y, points, fill, o) {
        o = o || {};
        var hw = 0, hh = 0;
        for (var i = 0; i < points.length; i += 1) {
          hw = Math.max(hw, Math.abs(points[i][0]));
          hh = Math.max(hh, Math.abs(points[i][1]));
        }
        return add({ d: A.poly(points), hw: hw, hh: hh, x: x, y: y, fill: fill, tag: o.tag,
          stroke: o.stroke, lw: o.lw, rot: o.rot, alpha: o.alpha, glow: o.glow });
      },
      /** Any shape from art.js, with its extent given. */
      shape: function (x, y, d, hw, hh, fill, o) {
        o = o || {};
        return add({ d: d, hw: hw, hh: hh, x: x, y: y, fill: fill, stroke: o.stroke, lw: o.lw,
          rot: o.rot, alpha: o.alpha, glow: o.glow, tag: o.tag, sx: o.sx, sy: o.sy });
      },
      /** A stroked line or curve — never filled. */
      line: function (x, y, d, color, lw, hw, hh, o) {
        o = o || {};
        return add({ d: d, hw: hw, hh: hh, x: x, y: y, stroke: color, lw: lw, fill: null,
          rot: o.rot, alpha: o.alpha, glow: o.glow, tag: o.tag, linecap: o.linecap });
      },
      /** A soft round light: a disc with a glow, which is how every lamp in the game is lit. */
      glow: function (x, y, r, color, alpha, o) {
        o = o || {};
        return add({ d: A.circle(r), hw: r, hh: r, x: x, y: y, fill: color,
          alpha: alpha == null ? 0.5 : alpha, tag: o.tag || 'light',
          glow: { blur: o.blur == null ? r * 1.9 : o.blur, color: color } });
      },
    };
    return b;
  }

  // ------------------------------------------------------------------ shared props

  /** A four-pointed glint, the highlight that makes glass look like glass. */
  function glint(b, x, y, r, color, alpha) {
    b.shape(x, y, A.sparkle(r), r, r, color, { alpha: alpha == null ? 0.85 : alpha, tag: 'light' });
  }

  /** A bottle: body, shoulder, cap and a paper label. */
  function bottle(b, x, y, w, h, color, cap, label, rng) {
    var bodyH = h * 0.66;
    b.box(x, y + h * 0.17, w, bodyH, color);
    b.shape(x, y - h * 0.22, A.poly([[-w * 0.5, bodyH * 0.5], [w * 0.5, bodyH * 0.5], [w * 0.22, -h * 0.2], [-w * 0.22, -h * 0.2]]), w * 0.5, h * 0.2, color);
    b.bar(x, y - h * 0.42, w * 0.34, h * 0.16, color);
    b.box(x, y - h * 0.5, w * 0.42, h * 0.09, cap);
    if (label) b.box(x, y + h * 0.22, w * 0.74, h * 0.24, label);
    glint(b, x - w * 0.22, y + h * 0.1, w * 0.2, 'hsl(200 70% 96%)', 0.5);
  }

  /** A jar with a lid and something glowing inside. */
  function jar(b, x, y, w, h, glass, lid, content, rng) {
    b.rbox(x, y, w, h, w * 0.24, glass);
    b.rbox(x, y + h * 0.12, w * 0.84, h * 0.6, w * 0.22, content, { alpha: 0.92 });
    b.rbox(x, y - h * 0.42, w * 0.72, h * 0.18, w * 0.14, lid);
    glint(b, x - w * 0.2, y - h * 0.12, w * 0.18, 'hsl(200 70% 98%)', 0.55);
  }

  /** A hanging lantern: cord, body, ribs and light. */
  function lantern(b, x, y, r, body, cordColor, top) {
    b.bar(x, (y + top) / 2, 2.5, y - top + r, cordColor);
    b.glow(x, y, r * 2.1, A.turn(body, 8), 0.2);
    b.ell(x, y, r * 0.94, r * 1.05, body);
    b.box(x, y - r * 0.98, r * 1.1, r * 0.2, A.lighten(body, -12));
    b.box(x, y + r * 0.94, r * 1.0, r * 0.22, A.lighten(body, -14));
    for (var i = -1; i <= 1; i += 1) {
      b.line(x, y, A.arc(r * 0.94, 0, Math.PI), A.lighten(body, -16), 1.2, r * 0.5, r);
      b.line(x + i * r * 0.34, y, A.arc(r * 0.94, 0, Math.PI), A.lighten(body, -14), 1, r * 0.5, r);
    }
    b.glow(x, y, r * 0.72, A.lighten(body, 22), 0.5);
  }

  /** The steam rising off something hot: a stack of soft blobs. */
  function steam(b, x, y, scale, color, rng, puffs) {
    var count = puffs || 4;
    for (var i = 0; i < count; i += 1) {
      var t = i / count;
      b.shape(
        x + rng.jitter(0, 9 * scale), y - i * 15 * scale,
        A.blob((11 - t * 3) * scale, 0.2, 7, rng),
        (12 - t * 3) * scale, (12 - t * 3) * scale, color,
        { alpha: 0.34 * (1 - t * 0.7), tag: 'light', glow: { blur: 12 * scale, color: color } }
      );
    }
  }

  /** A bowl of noodles, seen slightly from above: rim, broth, noodles, toppings. */
  function ramenBowl(b, x, y, w, bowl, broth, rng, egg) {
    var h = w * 0.5;
    b.ell(x, y + h * 0.16, w * 0.5, h * 0.5, A.lighten(bowl, -14));
    b.shape(x, y, A.poly([[-w * 0.5, -h * 0.1], [w * 0.5, -h * 0.1], [w * 0.34, h * 0.62], [-w * 0.34, h * 0.62]]), w * 0.5, h * 0.62, bowl);
    b.ell(x, y - h * 0.1, w * 0.5, w * 0.17, A.lighten(bowl, 10));
    b.ell(x, y - h * 0.06, w * 0.42, w * 0.13, broth);
    for (var i = 0; i < 3; i += 1) {
      b.line(x + rng.jitter(0, w * 0.14), y - h * 0.06, A.wave(w * 0.5, 2.4, 3), A.lighten(broth, 14), 1.6, w * 0.25, 3);
    }
    b.disc(x - w * 0.14, y - h * 0.08, w * 0.11, egg || 'hsl(46 88% 66%)');
    b.disc(x - w * 0.14, y - h * 0.08, w * 0.045, 'hsl(34 84% 52%)');
    b.poly(x + w * 0.14, y - h * 0.08, [[-w * 0.09, 0], [-w * 0.02, -w * 0.07], [w * 0.09, -w * 0.02], [w * 0.02, w * 0.07]], 'hsl(348 72% 58%)');
    b.poly(x + w * 0.22, y - h * 0.02, [[0, 0], [w * 0.14, -w * 0.03], [w * 0.15, w * 0.04]], 'hsl(120 36% 40%)');
  }

  /** A stack of bowls, ready for service. */
  function bowlStack(b, x, y, w, bowl) {
    for (var i = 0; i < 3; i += 1) {
      b.shape(x, y - i * w * 0.13, A.poly([[-w * 0.5, -w * 0.06], [w * 0.5, -w * 0.06], [w * 0.34, w * 0.16], [-w * 0.34, w * 0.16]]), w * 0.5, w * 0.16, A.lighten(bowl, i * 4));
      b.ell(x, y - i * w * 0.13 - w * 0.05, w * 0.5, w * 0.09, A.lighten(bowl, 12 + i * 4));
    }
  }

  /** A leafy plant in a pot. */
  function plant(b, x, y, scale, leaf, leafDeep, pot) {
    b.shape(x, y, A.poly([[-15 * scale, -10 * scale], [15 * scale, -10 * scale], [11 * scale, 16 * scale], [-11 * scale, 16 * scale]]), 15 * scale, 16 * scale, pot);
    b.box(x, y - 9 * scale, 32 * scale, 5 * scale, A.lighten(pot, 10));
    for (var i = 0; i < 7; i += 1) {
      var a = -Math.PI / 2 + (i - 3) * 0.33;
      var len = (26 + (i % 3) * 8) * scale;
      b.shape(x + Math.cos(a) * len * 0.5, y - 10 * scale + Math.sin(a) * len * 0.5,
        A.leaf(len, 7 * scale), len, 8 * scale, i % 2 ? leaf : leafDeep, { rot: a });
    }
  }

  /** A paper curtain hanging in a doorway, split into panels. */
  function curtain(b, x, y, w, h, color, barColor, panels) {
    b.bar(x, y - h / 2, w + 14, 5, barColor);
    var step = w / panels;
    for (var i = 0; i < panels; i += 1) {
      b.box(x - w / 2 + step * (i + 0.5), y + h / 2 - 4, step - 3, h - 8, color);
      b.box(x - w / 2 + step * (i + 0.5), y + h / 2 - 4, step - 3, 9, A.lighten(color, -12));
    }
  }

  /** A wooden stool with three legs. */
  function stool(b, x, y, w, wood, woodDark) {
    b.ell(x, y, w * 0.5, w * 0.22, wood);
    b.ell(x, y - 3, w * 0.5, w * 0.22, A.lighten(wood, 8));
    b.bar(x - w * 0.32, y + w * 0.34, 6, w * 0.6, woodDark);
    b.bar(x + w * 0.32, y + w * 0.34, 6, w * 0.6, woodDark);
    b.bar(x, y + w * 0.36, 6, w * 0.66, woodDark);
  }

  /** A shelf plank with a bracket. */
  function shelfPlank(b, x, y, w, wood, woodDark) {
    b.box(x, y, w, 9, wood);
    b.box(x, y + 5, w, 4, woodDark);
    b.bar(x - w * 0.42, y + 14, 5, 22, woodDark);
    b.bar(x + w * 0.42, y + 14, 5, 22, woodDark);
  }

  /** A picture frame with a simple abstract picture inside. */
  function poster(b, x, y, w, h, frame, paper, ink, rng) {
    b.box(x, y, w, h, frame);
    b.box(x, y, w - 8, h - 8, paper);
    var art = A.blob(Math.min(w, h) * 0.24, 0.24, 6, rng);
    b.shape(x, y - h * 0.08, art, w * 0.28, h * 0.28, ink, { alpha: 0.75 });
    b.box(x, y + h * 0.26, w * 0.5, 5, ink, { alpha: 0.5 });
    b.box(x, y + h * 0.36, w * 0.34, 4, ink, { alpha: 0.3 });
  }

  /** A cluster of bubbles. */
  function bubbles(b, x, y, rng, color, count, spread) {
    for (var i = 0; i < count; i += 1) {
      var r = rng.range(2, 7);
      b.disc(x + rng.jitter(0, spread), y + rng.jitter(0, spread * 1.6), r, 'none',
        { stroke: color, lw: 1.4, alpha: rng.range(0.3, 0.7), tag: 'light' });
    }
  }

  // ------------------------------------------------------------------ scene 1: ramen

  function ramenShop(rng, p) {
    var b = brush('ramen');

    // -- the room
    b.box(W / 2, H * 0.34, W, H * 0.68, p.backTop, { tag: 'bg' });
    b.box(W / 2, H * 0.68, W, H * 0.36, p.backBottom, { tag: 'bg', alpha: 0.5 });
    for (var s = 0; s < 9; s += 1) {
      b.line(60 + s * 110, H * 0.36, 'M0 -170L0 170', 'hsl(0 0% 100%)', 1, 1, 170, { alpha: 0.035, tag: 'bg' });
    }
    b.box(W / 2, 16, W, 34, p.frameDark, { tag: 'bg' });
    b.box(W / 2, 55, W, 26, p.frame, { tag: 'bg' });
    b.box(W / 2, H - 62, W, 124, p.floor, { tag: 'bg' });
    b.box(W / 2, H - 128, W, 13, p.floorEdge, { tag: 'bg' });
    for (var f = 0; f < 12; f += 1) {
      b.line(30 + f * 84, H - 30, 'M0 -30L0 30', p.floorEdge, 1.5, 1, 30, { alpha: 0.5, tag: 'bg' });
    }

    // -- pipes along the ceiling
    b.object('pipes', 'decor', function () {
      b.bar(250, 76, 430, 11, p.metal);
      b.disc(465, 76, 12, A.lighten(p.metal, -8));
      b.disc(465, 76, 6, A.lighten(p.metal, 12));
      b.bar(700, 92, 300, 8, A.lighten(p.metal, -14));
    });

    // -- rain window
    b.object('window', 'decor', function () {
      b.box(180, 228, 232, 300, p.frameDark);
      b.box(180, 228, 210, 278, p.cool, { alpha: 0.26 });
      b.box(180, 228, 210, 278, 'hsl(214 60% 8%)', { alpha: 0.5 });
      for (var i = 0; i < 16; i += 1) {
        b.line(96 + rng.range(0, 168), 120 + rng.range(0, 240), 'M0 -16L-4 16', 'hsl(196 80% 76%)', 1.3, 4, 16, { alpha: rng.range(0.18, 0.5) });
      }
      for (var c = 0; c < 7; c += 1) {
        b.disc(110 + rng.range(0, 140), 150 + rng.range(0, 190), rng.range(2.5, 5), rng.chance(0.5) ? p.neon : p.neon2, { alpha: 0.75, glow: { blur: 12, color: p.neon } });
      }
      b.bar(180, 228, 232, 13, p.frame);
      b.bar(180, 228, 13, 300, p.frame);
      b.bar(180, 367, 232, 13, p.frame);
      b.bar(180, 228, 13, 300, p.frame);
      b.bar(180, 228, 4, 300, A.lighten(p.frame, 14), { alpha: 0.6 });
    });

    // -- neon sign
    b.object('neon', 'hero', function () {
      b.rbox(842, 96, 148, 74, 10, 'hsl(258 40% 10%)');
      b.rbox(842, 96, 138, 64, 8, p.cloth, { alpha: 0.16, glow: { blur: 26, color: p.neon } });
      for (var i = 0; i < 4; i += 1) {
        b.bar(792 + i * 33, 96, 7, 40, p.neon, { glow: { blur: 16, color: p.neon } });
        b.bar(792 + i * 33 + 11, 96, 7, 26, p.neon, { glow: { blur: 14, color: p.neon }, alpha: 0.9 });
      }
      b.bar(842, 118, 120, 5, p.neon2, { glow: { blur: 14, color: p.neon2 } });
    });

    // -- paper lanterns
    var lanternY = 150;
    b.object('lanterns', 'hero', function () {
      lantern(b, 420, lanternY, 26, p.warm, p.frameDark, 56);
      lantern(b, 500, lanternY - 26, 21, p.cloth, p.frameDark, 56);
      lantern(b, 576, lanternY + 6, 24, p.warmDeep, p.frameDark, 56);
    });

    // -- menu plates on the wall
    b.object('menu', 'decor', function () {
      poster(b, 300, 150, 44, 62, p.frame, 'hsl(40 44% 88%)', p.cloth, rng);
      poster(b, 356, 158, 40, 56, p.frame, 'hsl(40 44% 88%)', p.neon2, rng);
      poster(b, 410, 146, 42, 60, p.frame, 'hsl(40 44% 88%)', p.leaf, rng);
    });

    // -- shelving unit
    b.object('shelves', 'decor', function () {
      shelfPlank(b, 800, 214, 330, p.frame, p.frameDark);
      shelfPlank(b, 800, 312, 330, p.frame, p.frameDark);
      b.bar(640, 264, 11, 300, p.frameDark);
      b.bar(960, 264, 11, 300, p.frameDark);
    });
    b.object('jars-top', 'prop', function () {
      jar(b, 672, 178, 34, 56, 'hsl(200 30% 76%)', p.frameDark, p.warmDeep, rng);
      jar(b, 716, 182, 30, 50, 'hsl(200 30% 76%)', p.frameDark, p.neon2, rng);
      bottle(b, 762, 182, 26, 62, 'hsl(150 40% 34%)', p.frameDark, 'hsl(40 50% 90%)', rng);
      bottle(b, 796, 184, 22, 54, 'hsl(24 54% 40%)', p.frameDark, null, rng);
    });
    b.object('jars-bottom', 'prop', function () {
      bowlStack(b, 676, 300, 46, p.clay);
      bottle(b, 736, 292, 28, 64, 'hsl(200 46% 36%)', p.frameDark, 'hsl(40 50% 90%)', rng);
      jar(b, 782, 288, 32, 54, 'hsl(200 30% 76%)', p.frameDark, p.leaf, rng);
      bottle(b, 826, 294, 24, 58, 'hsl(348 46% 40%)', p.frameDark, null, rng);
      jar(b, 872, 290, 34, 56, 'hsl(200 30% 76%)', p.frameDark, p.warm, rng);
      b.rbox(926, 292, 46, 38, 6, p.cloth, { alpha: 0.85 });
    });

    // -- the counter
    b.object('counter', 'decor', function () {
      b.box(500, 430, 940, 22, A.lighten(p.frame, 12));
      b.box(500, 480, 940, 82, p.frame);
      b.box(500, 442, 940, 6, A.lighten(p.frame, 22), { alpha: 0.7 });
      for (var i = 0; i < 15; i += 1) {
        b.bar(60 + i * 62, 480, 5, 70, p.frameDark, { alpha: 0.55 });
      }
      b.box(500, 522, 940, 8, p.frameDark);
    });

    // -- bowls on the counter
    b.object('bowl-left', 'hero', function () {
      ramenBowl(b, 196, 406, 84, p.clay, 'hsl(28 62% 40%)', rng, 'hsl(46 88% 66%)');
    });
    b.object('bowl-right', 'hero', function () {
      ramenBowl(b, 330, 410, 74, 'hsl(220 22% 78%)', 'hsl(20 60% 34%)', rng, 'hsl(46 88% 66%)');
    });
    b.object('steam-left', 'light', function () { steam(b, 196, 372, 1, 'hsl(0 0% 100%)', rng, 4); });
    b.object('steam-right', 'light', function () { steam(b, 330, 378, 0.82, 'hsl(0 0% 100%)', rng, 3); });

    // -- counter clutter
    b.object('chopsticks', 'prop', function () {
      b.rbox(430, 402, 40, 52, 6, p.cloth);
      b.bar(438, 372, 5, 56, p.clay, { rot: -0.08 });
      b.bar(446, 370, 5, 58, p.clay, { rot: 0.05 });
      b.bar(454, 373, 5, 54, p.clay, { rot: -0.03 });
    });
    b.object('kettle', 'prop', function () {
      b.shape(520, 412, A.poly([[-30, 14], [-22, -16], [22, -16], [30, 14]]), 30, 16, p.metal);
      b.bar(520, 386, 40, 7, A.lighten(p.metal, -10));
      b.shape(550, 406, A.arc(16, -1.2, 1.2), 17, 17, null, { stroke: p.metal, lw: 5 });
    });
    b.object('cups', 'prop', function () {
      b.shape(580, 408, A.poly([[-13, -16], [13, -16], [9, 15], [-9, 15]]), 13, 16, p.clay);
      b.shape(604, 410, A.poly([[-12, -15], [12, -15], [8, 14], [-8, 14]]), 12, 15, A.lighten(p.clay, -8));
    });
    b.object('napkins', 'prop', function () {
      b.rbox(660, 404, 54, 34, 5, 'hsl(40 30% 82%)');
      b.box(660, 390, 40, 14, 'hsl(40 30% 72%)');
    });

    // -- the shop cat
    b.object('cat', 'hero', function () {
      b.ell(760, 404, 30, 20, 'hsl(28 30% 24%)');
      b.disc(788, 392, 17, 'hsl(28 30% 26%)');
      b.poly(780, 378, [[-9, 6], [0, -11], [8, 6]], 'hsl(28 30% 24%)');
      b.poly(798, 378, [[-8, 6], [0, -11], [9, 6]], 'hsl(28 30% 24%)');
      b.disc(783, 392, 2.6, p.warm);
      b.disc(794, 392, 2.6, p.warm);
      b.bar(812, 410, 34, 8, 'hsl(28 30% 24%)');
      b.line(826, 414, 'M0 0q9 10 2 18', 'hsl(28 30% 16%)', 3, 8, 12);
    });

    // -- plant and crate on the right
    b.object('plant', 'hero', function () { plant(b, 944, 404, 1.15, p.leaf, p.leafDeep, p.clay); });
    b.object('crate', 'prop', function () {
      b.box(884, 410, 44, 30, p.frameDark);
      b.bar(884, 410, 44, 4, A.lighten(p.frameDark, 12));
    });

    // -- stools in front
    b.object('stool-1', 'hero', function () { stool(b, 214, 566, 58, p.frame, p.frameDark); });
    b.object('stool-2', 'hero', function () { stool(b, 470, 578, 56, p.frame, p.frameDark); });
    b.object('stool-3', 'hero', function () { stool(b, 726, 562, 58, p.frame, p.frameDark); });

    return b;
  }

  // ------------------------------------------------------------------ scene 2: laboratory

  function laboratory(rng, p) {
    var b = brush('lab');

    b.box(W / 2, H * 0.32, W, H * 0.64, p.backTop, { tag: 'bg' });
    b.box(W / 2, H * 0.66, W, H * 0.4, p.backBottom, { tag: 'bg', alpha: 0.5 });
    // stone courses on the back wall
    for (var r = 0; r < 5; r += 1) {
      for (var c = 0; c < 8; c += 1) {
        var off = (r % 2) * 62;
        b.box(-30 + c * 124 + off, 60 + r * 52, 118, 48, 'hsl(0 0% 100%)', { alpha: 0.022, tag: 'bg' });
      }
    }
    b.box(W / 2, 14, W, 30, p.frameDark, { tag: 'bg' });
    b.box(W / 2, H - 66, W, 132, p.floor, { tag: 'bg' });
    b.box(W / 2, H - 136, W, 14, p.floorEdge, { tag: 'bg' });
    for (var f = 0; f < 9; f += 1) {
      b.line(20 + f * 120, H - 26, 'M0 26L30 -22', p.floorEdge, 1.6, 30, 26, { alpha: 0.4, tag: 'bg' });
    }

    // -- window with cold dawn light
    b.object('window', 'decor', function () {
      b.box(150, 176, 200, 210, p.frameDark);
      b.box(150, 176, 178, 188, p.cool, { alpha: 0.3 });
      b.disc(150, 150, 46, 'hsl(40 60% 88%)', { alpha: 0.5, glow: { blur: 40, color: 'hsl(40 70% 80%)' } });
      b.bar(150, 96, 210, 14, p.frame);
      b.bar(150, 256, 210, 12, p.frame);
      b.bar(62, 176, 14, 210, p.frame);
      b.bar(238, 176, 14, 210, p.frame);
      b.bar(150, 176, 8, 188, p.frame);
      b.bar(150, 176, 178, 8, p.frame);
    });

    // -- shelves of ingredients
    b.object('shelf-top', 'decor', function () { shelfPlank(b, 560, 148, 420, p.frame, p.frameDark); });
    b.object('shelf-mid', 'decor', function () { shelfPlank(b, 560, 268, 420, p.frame, p.frameDark); });
    b.bar(350, 200, 12, 200, p.frameDark);
    b.bar(770, 200, 12, 200, p.frameDark);

    b.object('potion-row-a', 'hero', function () {
      bottle(b, 390, 112, 26, 60, 'hsl(150 44% 36%)', p.frameDark, 'hsl(40 46% 88%)', rng);
      jar(b, 436, 108, 30, 52, 'hsl(200 26% 74%)', p.frameDark, p.neon, rng);
      bottle(b, 480, 114, 24, 56, 'hsl(276 44% 40%)', p.frameDark, null, rng);
      jar(b, 524, 106, 34, 56, 'hsl(200 26% 74%)', p.frameDark, p.warm, rng);
      bottle(b, 570, 112, 26, 58, 'hsl(186 46% 34%)', p.frameDark, 'hsl(40 46% 88%)', rng);
      bottle(b, 612, 116, 22, 50, 'hsl(348 44% 40%)', p.frameDark, null, rng);
    });
    b.object('potion-row-b', 'hero', function () {
      jar(b, 396, 230, 36, 58, 'hsl(200 26% 74%)', p.frameDark, p.neon2, rng);
      bottle(b, 446, 232, 28, 62, 'hsl(96 44% 36%)', p.frameDark, 'hsl(40 46% 88%)', rng);
      jar(b, 496, 226, 32, 54, 'hsl(200 26% 74%)', p.frameDark, p.warmDeep, rng);
      bowlStack(b, 552, 244, 44, p.clay);
      bottle(b, 610, 234, 26, 56, 'hsl(40 46% 40%)', p.frameDark, null, rng);
      jar(b, 660, 228, 38, 60, 'hsl(200 26% 74%)', p.frameDark, p.leaf, rng);
      bottle(b, 712, 232, 24, 54, 'hsl(210 44% 38%)', p.frameDark, 'hsl(40 46% 88%)', rng);
    });

    // -- hanging herbs
    b.object('herbs', 'prop', function () {
      for (var i = 0; i < 3; i += 1) {
        var x = 838 + i * 46;
        b.bar(x, 96, 3, 60, p.frameDark);
        b.shape(x, 140 + i * 8, A.blob(20, 0.3, 7, rng), 22, 24, i % 2 ? p.leaf : p.leafDeep);
      }
    });

    // -- the work table
    b.object('table', 'decor', function () {
      b.box(430, 400, 660, 24, A.lighten(p.frame, 14));
      b.box(430, 466, 660, 110, p.frame);
      b.box(430, 414, 660, 6, A.lighten(p.frame, 24), { alpha: 0.6 });
      b.bar(140, 470, 16, 108, p.frameDark);
      b.bar(720, 470, 16, 108, p.frameDark);
      for (var i = 0; i < 4; i += 1) b.box(250 + i * 130, 466, 108, 76, A.lighten(p.frame, -6), { alpha: 0.7 });
    });

    // -- the alembic: the hero object of the room
    b.object('alembic', 'hero', function () {
      b.shape(360, 366, A.poly([[-40, 22], [-26, -18], [26, -18], [40, 22]]), 40, 22, 'hsl(180 34% 62%)', { alpha: 0.9 });
      b.ell(360, 388, 40, 12, 'hsl(180 34% 52%)');
      b.disc(360, 396, 26, p.neon, { alpha: 0.8, glow: { blur: 30, color: p.neon } });
      b.bar(360, 336, 10, 34, 'hsl(180 34% 62%)');
      b.ell(360, 318, 20, 8, 'hsl(180 34% 68%)');
      b.line(382, 322, A.arc(40, Math.PI, Math.PI * 1.62), 'hsl(180 34% 62%)', 9, 42, 20);
      b.disc(430, 356, 15, 'hsl(180 34% 66%)', { alpha: 0.9 });
      b.bar(430, 384, 12, 44, 'hsl(180 34% 58%)');
      glint(b, 344, 360, 8, 'hsl(200 70% 98%)', 0.7);
    });

    // -- burner under the alembic
    b.object('burner', 'hero', function () {
      b.shape(360, 430, A.flame(38, 62), 19, 31, p.warm, { glow: { blur: 34, color: p.warmDeep }, alpha: 0.95 });
      b.shape(360, 440, A.flame(22, 40), 11, 20, 'hsl(52 96% 76%)', { glow: { blur: 20, color: p.warm } });
      b.rbox(360, 452, 78, 22, 6, p.metal);
      b.bar(360, 468, 96, 10, A.lighten(p.metal, -14));
    });

    // -- cauldron
    b.object('cauldron', 'hero', function () {
      b.shape(560, 424, A.poly([[-52, -22], [52, -22], [40, 30], [-40, 30]]), 52, 30, 'hsl(230 14% 26%)');
      b.ell(560, 402, 52, 15, 'hsl(230 16% 18%)');
      b.ell(560, 404, 44, 11, p.neon2, { alpha: 0.85, glow: { blur: 26, color: p.neon2 } });
      b.bar(504, 424, 12, 34, 'hsl(230 14% 22%)');
      b.bar(616, 424, 12, 34, 'hsl(230 14% 22%)');
      bubbles(b, 560, 396, rng, p.neon2, 6, 22);
    });

    // -- books and instruments
    b.object('books', 'prop', function () {
      b.box(672, 384, 78, 16, p.cloth);
      b.box(668, 370, 70, 14, p.leafDeep);
      b.box(676, 356, 62, 14, 'hsl(28 40% 40%)');
    });
    b.object('candles', 'hero', function () {
      b.bar(756, 392, 15, 40, 'hsl(44 40% 84%)');
      b.shape(756, 366, A.flame(15, 26), 8, 13, p.warm, { glow: { blur: 26, color: p.warmDeep } });
      b.bar(786, 400, 13, 24, 'hsl(44 40% 78%)');
      b.shape(786, 384, A.flame(12, 20), 6, 10, p.warm, { glow: { blur: 20, color: p.warmDeep } });
      b.rbox(772, 414, 62, 12, 3, p.metal);
    });
    b.object('skull', 'hero', function () {
      b.disc(852, 388, 20, 'hsl(44 22% 84%)');
      b.shape(852, 408, A.poly([[-11, -4], [11, -4], [8, 12], [-8, 12]]), 11, 12, 'hsl(44 22% 78%)');
      b.disc(845, 386, 4.6, 'hsl(232 34% 12%)');
      b.disc(859, 386, 4.6, 'hsl(232 34% 12%)');
    });
    b.object('mortar', 'prop', function () {
      b.shape(920, 404, A.poly([[-24, -14], [24, -14], [16, 18], [-16, 18]]), 24, 18, 'hsl(30 18% 62%)');
      b.bar(940, 384, 34, 7, 'hsl(30 18% 56%)', { rot: 0.5 });
    });

    // -- rug and floor clutter
    b.object('rug', 'decor', function () {
      b.ell(430, 588, 210, 44, p.cloth, { alpha: 0.55 });
      b.ell(430, 588, 160, 32, A.lighten(p.cloth, 16), { alpha: 0.4 });
    });
    b.object('barrel', 'hero', function () {
      b.shape(830, 566, A.poly([[-34, -46], [34, -46], [34, 46], [-34, 46]]), 34, 46, p.frame);
      b.ell(830, 520, 34, 11, A.lighten(p.frame, 12));
      b.bar(830, 546, 70, 8, p.frameDark);
      b.bar(830, 590, 70, 8, p.frameDark);
    });
    b.object('crate', 'prop', function () {
      b.box(180, 578, 86, 62, p.frameDark);
      b.bar(180, 578, 86, 5, A.lighten(p.frameDark, 14));
      b.line(180, 578, 'M-40 -26L40 26', A.lighten(p.frameDark, 8), 4, 44, 28);
    });

    return b;
  }

  // ------------------------------------------------------------------ scene 3: night market

  function nightMarket(rng, p) {
    var b = brush('mkt');

    b.box(W / 2, H * 0.3, W, H * 0.6, p.backTop, { tag: 'bg' });
    b.box(W / 2, H * 0.62, W, H * 0.36, p.backBottom, { tag: 'bg', alpha: 0.6 });
    b.box(W / 2, 12, W, 26, p.frameDark, { tag: 'bg' });
    b.box(W / 2, H - 58, W, 116, p.floor, { tag: 'bg' });
    b.box(W / 2, H - 118, W, 12, p.floorEdge, { tag: 'bg' });
    for (var f = 0; f < 14; f += 1) {
      b.box(24 + f * 74, H - 34, 58, 34, 'hsl(0 0% 100%)', { alpha: 0.02, tag: 'bg', rot: 0 });
    }

    // -- string lights across the whole alley
    b.object('string-lights', 'hero', function () {
      b.line(500, 92, 'M40 -26q230 62 460 0q230 -62 460 0', 'hsl(232 30% 30%)', 2, 480, 40);
      for (var i = 0; i < 11; i += 1) {
        var x = 66 + i * 87;
        var y = 74 + Math.sin(i * 0.62) * 22;
        b.disc(x, y, 7, i % 2 ? p.warm : p.neon2, { glow: { blur: 20, color: i % 2 ? p.warm : p.neon2 } });
      }
    });

    // -- stall awnings
    b.object('awning-left', 'hero', function () {
      b.poly(190, 148, [[-170, 0], [170, 0], [150, 82], [-150, 82]], p.cloth);
      for (var i = 0; i < 5; i += 1) {
        b.poly(70 + i * 60, 189, [[0, -41], [30, -41], [22, 41], [0, 41]], A.lighten(p.cloth, 22), { alpha: 0.85 });
      }
      b.bar(190, 108, 350, 9, p.frameDark);
      b.bar(30, 200, 10, 190, p.frameDark);
      b.bar(350, 200, 10, 190, p.frameDark);
    });
    b.object('awning-right', 'hero', function () {
      b.poly(810, 156, [[-160, 0], [160, 0], [142, 78], [-142, 78]], p.leafDeep);
      for (var i = 0; i < 5; i += 1) {
        b.poly(700 + i * 56, 195, [[0, -39], [28, -39], [20, 39], [0, 39]], A.lighten(p.leafDeep, 20), { alpha: 0.85 });
      }
      b.bar(810, 116, 330, 9, p.frameDark);
    });

    // -- hanging paper lanterns
    b.object('lanterns', 'hero', function () {
      lantern(b, 452, 214, 22, p.warm, p.frameDark, 116);
      lantern(b, 506, 236, 18, p.cloth, p.frameDark, 116);
      lantern(b, 556, 210, 20, p.warmDeep, p.frameDark, 116);
    });

    // -- griddle stall: the hero of the scene
    b.object('griddle', 'hero', function () {
      b.box(214, 330, 300, 30, p.metal);
      b.box(214, 350, 300, 12, p.frameDark);
      b.box(214, 360, 292, 76, p.frame);
      for (var i = 0; i < 4; i += 1) b.bar(96 + i * 78, 360, 6, 70, p.frameDark, { alpha: 0.5 });
      b.glow(214, 314, 78, p.warmDeep, 0.28);
      for (var s = 0; s < 6; s += 1) {
        b.bar(112 + s * 40, 318, 30, 9, s % 2 ? 'hsl(20 62% 40%)' : 'hsl(32 60% 48%)', { rot: rng.jitter(0, 0.4) });
      }
      b.disc(150, 320, 15, p.metal);
      b.bar(150, 302, 26, 5, A.lighten(p.metal, 10));
      steam(b, 250, 300, 1.1, 'hsl(0 0% 100%)', rng, 4);
    });

    // -- crate of produce
    b.object('crate', 'hero', function () {
      b.box(180, 452, 190, 84, p.frame);
      b.box(180, 442, 200, 14, A.lighten(p.frame, 16));
      for (var i = 0; i < 11; i += 1) {
        b.disc(96 + (i % 6) * 33, 428 + Math.floor(i / 6) * 22, 14, rng.pick(['hsl(14 76% 54%)', 'hsl(44 88% 58%)', 'hsl(96 52% 46%)']));
      }
    });

    // -- fruit pyramid
    b.object('fruit-top', 'hero', function () { b.disc(340, 440, 20, 'hsl(28 84% 56%)'); });
    b.object('fruit-mid', 'prop', function () {
      b.disc(318, 464, 20, 'hsl(44 88% 58%)');
      b.disc(362, 464, 20, 'hsl(96 52% 46%)');
    });
    b.object('hanging-fish', 'hero', function () {
      b.bar(430, 236, 3, 40, p.frameDark);
      for (var i = 0; i < 3; i += 1) {
        var fy = 276 + i * 30;
        b.shape(430, fy, A.ellipse(26, 11), 26, 11, 'hsl(200 34% 62%)');
        b.poly(456, fy, [[0, -10], [14, 0], [0, 10]], 'hsl(200 34% 52%)');
        b.disc(420, fy - 2, 2.4, p.ink);
      }
    });

    // -- the vendor
    b.object('vendor', 'hero', function () {
      b.shape(700, 350, A.poly([[-38, 34], [-30, -26], [30, -26], [38, 34]]), 38, 34, p.cloth);
      b.disc(700, 300, 24, 'hsl(28 38% 62%)');
      b.shape(700, 274, A.poly([[-27, 8], [0, -16], [27, 8]]), 27, 16, 'hsl(232 30% 20%)');
      b.disc(692, 300, 3, p.ink);
      b.disc(708, 300, 3, p.ink);
      b.bar(664, 362, 78, 12, A.lighten(p.cloth, -14));
    });

    // -- noodle pot
    b.object('pot', 'hero', function () {
      b.shape(560, 402, A.poly([[-46, -30], [46, -30], [36, 32], [-36, 32]]), 46, 32, p.metal);
      b.ell(560, 374, 46, 13, A.lighten(p.metal, 14));
      b.ell(560, 376, 36, 9, 'hsl(36 60% 42%)');
      b.bar(508, 386, 12, 20, A.lighten(p.metal, -12));
      b.bar(612, 386, 12, 20, A.lighten(p.metal, -12));
      steam(b, 560, 344, 0.95, 'hsl(0 0% 100%)', rng, 3);
    });

    // -- signboards
    b.object('signs', 'hero', function () {
      poster(b, 96, 232, 52, 74, p.frame, 'hsl(40 44% 88%)', p.cloth, rng);
      poster(b, 928, 244, 46, 66, p.frame, 'hsl(40 44% 88%)', p.neon2, rng);
    });
    b.object('baskets', 'prop', function () {
      b.shape(880, 400, A.poly([[-38, -24], [38, -24], [30, 26], [-30, 26]]), 38, 26, 'hsl(34 42% 52%)');
      b.line(880, 372, A.arc(30, Math.PI, Math.PI * 2), 'hsl(34 42% 42%)', 4, 32, 16);
    });

    // -- crowd silhouettes at the front
    var crowdX = [140, 268, 392, 640, 760, 890];
    for (var i = 0; i < crowdX.length; i += 1) {
      (function (x, index) {
        b.object('crowd-' + index, 'decor', function () {
          var h = 96 + (index % 3) * 14;
          b.shape(x, 588 - h / 2, A.poly([[-26, h / 2], [26, h / 2], [20, -h / 2 + 14], [-20, -h / 2 + 14]]), 26, h / 2, 'hsl(232 34% 10%)', { alpha: 0.92 });
          b.disc(x, 588 - h - 12, 17, 'hsl(232 34% 12%)');
        });
      }(crowdX[i], i));
    }

    return b;
  }

  // ------------------------------------------------------------------ scene 4: arcade

  function arcadeRoom(rng, p) {
    var b = brush('arc');

    b.box(W / 2, H * 0.32, W, H * 0.64, p.backTop, { tag: 'bg' });
    b.box(W / 2, H * 0.66, W, H * 0.4, p.backBottom, { tag: 'bg', alpha: 0.55 });
    for (var i = 0; i < 6; i += 1) {
      b.line(0, 40 + i * 40, 'M-500 0L500 0', 'hsl(0 0% 100%)', 1, 500, 1, { alpha: 0.025, tag: 'bg' });
    }
    b.box(W / 2, 12, W, 26, p.frameDark, { tag: 'bg' });
    b.box(W / 2, H - 60, W, 120, p.floor, { tag: 'bg' });
    b.box(W / 2, H - 122, W, 12, p.floorEdge, { tag: 'bg' });
    // the carpet: a loud geometric pattern
    for (var cx = 0; cx < 10; cx += 1) {
      for (var cy = 0; cy < 2; cy += 1) {
        b.shape(20 + cx * 104, H - 96 + cy * 54, A.star(4, 20, 7), 20, 20, cy % 2 ? p.neon : p.cool, { alpha: 0.14, tag: 'bg' });
      }
    }

    // -- neon wall sign
    b.object('wall-sign', 'hero', function () {
      b.rbox(500, 86, 430, 76, 14, 'hsl(268 40% 9%)');
      b.rbox(500, 86, 414, 62, 10, p.neon, { alpha: 0.12, glow: { blur: 40, color: p.neon } });
      for (var i = 0; i < 7; i += 1) {
        b.bar(352 + i * 50, 86, 9, 40, i % 2 ? p.neon : p.neon2, { glow: { blur: 18, color: i % 2 ? p.neon : p.neon2 } });
      }
    });

    // -- high score board
    b.object('scoreboard', 'hero', function () {
      b.box(866, 214, 190, 150, 'hsl(268 40% 10%)');
      b.box(866, 152, 198, 18, p.frame);
      for (var r = 0; r < 5; r += 1) {
        b.box(838, 180 + r * 28, 34, 7, p.warm, { alpha: 0.85 });
        b.box(890, 180 + r * 28, 96, 7, r === 0 ? p.neon2 : p.cool, { alpha: 0.7 });
      }
      b.box(866, 214, 190, 150, p.cool, { alpha: 0.05, glow: { blur: 26, color: p.cool } });
    });

    // -- three arcade cabinets
    function cabinet(x, y, body, screen, marquee, scale) {
      b.object('cabinet-' + x, 'hero', function () {
        b.box(x, y + 40 * scale, 150 * scale, 200 * scale, body);
        b.box(x, y - 60 * scale, 150 * scale, 130 * scale, A.lighten(body, -6));
        b.rbox(x, y - 74 * scale, 162 * scale, 44 * scale, 7, marquee, { glow: { blur: 26, color: marquee } });
        b.rbox(x, y + 12 * scale, 116 * scale, 84 * scale, 8, 'hsl(232 30% 8%)');
        b.rbox(x, y + 12 * scale, 104 * scale, 72 * scale, 6, screen, { alpha: 0.9, glow: { blur: 30, color: screen } });
        for (var g = 0; g < 4; g += 1) {
          b.box(x - 34 * scale + g * 22 * scale, y + 2 * scale, 14 * scale, 7 * scale, p.ink, { alpha: 0.55 });
        }
        b.box(x, y + 76 * scale, 130 * scale, 26 * scale, A.lighten(body, 8));
        b.disc(x - 26 * scale, y + 76 * scale, 12 * scale, p.cloth);
        b.disc(x + 24 * scale, y + 76 * scale, 7 * scale, p.warm);
        b.disc(x + 46 * scale, y + 76 * scale, 7 * scale, p.neon2);
        b.box(x, y + 150 * scale, 150 * scale, 20 * scale, A.lighten(body, -18));
      });
    }
    cabinet(176, 300, 'hsl(268 44% 32%)', 'hsl(186 90% 58%)', p.neon2, 1);
    cabinet(400, 316, 'hsl(340 44% 34%)', 'hsl(46 92% 60%)', p.warm, 0.94);
    cabinet(620, 300, 'hsl(206 44% 32%)', 'hsl(320 88% 62%)', p.neon, 1);

    // -- a tabletop machine on a stand
    b.object('cocktail-cab', 'hero', function () {
      b.bar(846, 442, 22, 130, p.frameDark);
      b.shape(846, 392, A.poly([[-86, -14], [86, -14], [66, 34], [-66, 34]]), 86, 34, 'hsl(268 44% 26%)');
      b.shape(846, 386, A.poly([[-68, -10], [68, -10], [52, 26], [-52, 26]]), 68, 26, 'hsl(190 80% 52%)', { alpha: 0.85, glow: { blur: 26, color: p.cool } });
      b.disc(800, 386, 11, p.cloth);
      b.disc(884, 386, 11, p.warm);
    });

    // -- stools, cups and clutter
    b.object('stool-1', 'hero', function () { stool(b, 296, 588, 54, p.cloth, p.frameDark); });
    b.object('stool-2', 'hero', function () { stool(b, 512, 596, 52, p.cloth, p.frameDark); });
    b.object('soda', 'prop', function () {
      b.shape(700, 452, A.poly([[-19, -26], [19, -26], [13, 26], [-13, 26]]), 19, 26, 'hsl(348 60% 52%)');
      b.ell(700, 424, 19, 6, 'hsl(0 0% 96%)');
      b.bar(700, 402, 7, 46, 'hsl(44 70% 72%)', { rot: 0.24 });
      b.box(700, 452, 30, 22, 'hsl(0 0% 96%)', { alpha: 0.9 });
    });
    b.object('tokens', 'prop', function () {
      b.shape(740, 452, A.wedge(30, 0, Math.PI), 30, 30, p.warm);
      for (var i = 0; i < 4; i += 1) b.disc(720 + i * 15, 434 - i * 5, 8, p.warm, { alpha: 0.9 });
    });
    b.object('joystick', 'prop', function () {
      b.rbox(92, 470, 92, 40, 8, 'hsl(268 40% 20%)');
      b.bar(78, 444, 9, 40, p.metal);
      b.disc(78, 424, 15, p.cloth);
      b.disc(118, 452, 9, p.warm);
    });
    b.object('poster', 'decor', function () {
      poster(b, 300, 168, 96, 130, p.frame, 'hsl(40 44% 88%)', p.neon, rng);
    });
    b.object('poster-2', 'decor', function () {
      poster(b, 420, 182, 76, 104, p.frame, 'hsl(40 44% 88%)', p.cool, rng);
    });
    b.object('plant', 'prop', function () { plant(b, 962, 440, 1, p.leaf, p.leafDeep, p.clay); });
    b.object('coin-op', 'prop', function () {
      b.rbox(668, 232, 52, 74, 7, p.cloth);
      b.box(668, 210, 60, 16, A.lighten(p.cloth, -18));
      b.box(668, 238, 32, 10, 'hsl(0 0% 96%)', { alpha: 0.85 });
    });

    return b;
  }

  // ------------------------------------------------------------------ scene 5: observatory

  function observatory(rng, p) {
    var b = brush('obs');

    b.box(W / 2, H * 0.34, W, H * 0.68, p.backTop, { tag: 'bg' });
    b.box(W / 2, H * 0.68, W, H * 0.36, p.backBottom, { tag: 'bg', alpha: 0.55 });
    // shafts of light from the surface
    for (var i = 0; i < 5; i += 1) {
      b.poly(120 + i * 200, 200, [[-52, -190], [52, -190], [96, 190], [-96, 190]], 'hsl(190 90% 78%)', { alpha: 0.05, tag: 'bg' });
    }
    b.box(W / 2, H - 56, W, 112, p.floor, { tag: 'bg' });
    b.box(W / 2, H - 112, W, 12, p.floorEdge, { tag: 'bg' });
    for (var r = 0; r < 12; r += 1) {
      b.ell(30 + r * 92, H - 46 + (r % 2) * 26, 40, 13, 'hsl(0 0% 100%)', { alpha: 0.03, tag: 'bg' });
    }

    // -- the great dome window
    b.object('dome', 'decor', function () {
      b.line(500, 250, A.arc(250, Math.PI, Math.PI * 2), p.frame, 16, 250, 250);
      b.line(500, 250, A.arc(242, Math.PI, Math.PI * 2), 'hsl(190 80% 66%)', 8, 242, 242, { alpha: 0.35 });
      for (var i = 1; i < 6; i += 1) {
        b.bar(500 - 250 + i * 83, 130, 7, 250, p.frame, { alpha: 0.75 });
      }
      b.bar(500, 122, 500, 9, p.frame);
      b.glow(500, 170, 200, p.cool, 0.14, { blur: 150 });
    });

    // -- fish drifting past the dome
    function fish(x, y, size, color, dir) {
      b.object('fish-' + x, 'hero', function () {
        b.shape(x, y, A.ellipse(size, size * 0.42), size, size * 0.42, color, { flip: dir < 0 });
        b.poly(x - dir * size, y, [[0, -size * 0.4], [-dir * size * 0.62, 0], [0, size * 0.4]], A.lighten(color, -10));
        b.disc(x + dir * size * 0.5, y - size * 0.1, size * 0.1, p.ink);
        b.line(x, y - size * 0.18, A.wave(size * 0.7, size * 0.1, 2), A.lighten(color, 18), 2, size * 0.35, size * 0.1);
      });
    }
    fish(196, 132, 40, 'hsl(28 84% 60%)', 1);
    fish(330, 96, 26, 'hsl(48 90% 62%)', 1);
    fish(700, 118, 34, 'hsl(320 80% 64%)', -1);
    fish(842, 168, 24, 'hsl(186 84% 62%)', -1);

    // -- jellyfish
    b.object('jellyfish', 'hero', function () {
      b.shape(256, 210, A.blob(40, 0.12, 9, rng), 42, 26, 'hsl(320 74% 68%)', { alpha: 0.85, glow: { blur: 32, color: p.neon } });
      b.ell(256, 196, 42, 26, 'hsl(320 80% 74%)', { alpha: 0.9 });
      for (var t = 0; t < 6; t += 1) {
        b.line(232 + t * 10, 236, 'M0 0q6 26 -3 48t4 40', 'hsl(320 60% 72%)', 2.4, 8, 62, { alpha: 0.7 });
      }
    });
    b.object('jellyfish-2', 'prop', function () {
      b.ell(320, 300, 26, 17, 'hsl(272 70% 72%)', { alpha: 0.8, glow: { blur: 20, color: p.neon } });
      for (var t = 0; t < 4; t += 1) {
        b.line(306 + t * 10, 314, 'M0 0q5 20 -2 36', 'hsl(272 56% 74%)', 2, 6, 40, { alpha: 0.65 });
      }
    });

    // -- coral garden
    b.object('coral-a', 'hero', function () {
      var x = 92;
      b.shape(x, 470, A.blob(34, 0.3, 8, rng), 36, 30, 'hsl(348 74% 62%)');
      b.shape(x - 26, 452, A.blob(20, 0.3, 7, rng), 22, 18, 'hsl(8 76% 60%)');
      b.shape(x + 26, 446, A.blob(22, 0.3, 7, rng), 24, 20, 'hsl(330 70% 62%)');
    });
    b.object('coral-fan', 'hero', function () {
      for (var i = 0; i < 7; i += 1) {
        var a = -Math.PI / 2 + (i - 3) * 0.26;
        b.bar(180 + Math.cos(a) * 26, 486 + Math.sin(a) * 26, 9, 62, i % 2 ? 'hsl(28 80% 58%)' : 'hsl(40 84% 60%)', { rot: a });
      }
    });
    b.object('anemone', 'hero', function () {
      b.shape(320, 512, A.blob(28, 0.18, 9, rng), 30, 18, 'hsl(276 60% 54%)');
      for (var i = 0; i < 9; i += 1) {
        var a = -Math.PI / 2 + (i - 4) * 0.24;
        b.line(320 + Math.cos(a) * 24, 496 + Math.sin(a) * 22, 'M0 0q4 -20 0 -34', 'hsl(300 66% 68%)', 3, 8, 24, { rot: a, alpha: 0.9 });
      }
    });
    b.object('seagrass', 'hero', function () {
      for (var i = 0; i < 5; i += 1) {
        var x = 214 + i * 17;
        b.line(x, 500, 'M0 30q10 -22 0 -46t4 -40', i % 2 ? p.leaf : p.leafDeep, 7, 12, 62, { rot: rng.jitter(0, 0.16) });
      }
    });
    b.object('rocks', 'decor', function () {
      b.shape(80, 560, A.blob(46, 0.24, 8, rng), 48, 30, 'hsl(210 14% 34%)');
      b.shape(150, 576, A.blob(34, 0.24, 8, rng), 36, 22, 'hsl(210 14% 28%)');
    });

    // -- the observation desk
    b.object('desk', 'decor', function () {
      b.box(640, 402, 560, 22, A.lighten(p.frame, 14));
      b.box(640, 452, 560, 84, p.frame);
      b.box(640, 414, 560, 6, A.lighten(p.frame, 24), { alpha: 0.55 });
      b.bar(380, 452, 14, 88, p.frameDark);
      b.bar(900, 452, 14, 88, p.frameDark);
    });

    // -- instruments on the desk
    b.object('telescope', 'hero', function () {
      b.rbox(516, 366, 150, 34, 16, p.metal);
      b.rbox(516, 366, 130, 22, 11, A.lighten(p.metal, -18));
      b.disc(596, 366, 19, 'hsl(190 80% 62%)', { glow: { blur: 22, color: p.cool }, alpha: 0.9 });
      b.bar(452, 366, 12, 40, A.lighten(p.metal, -10));
      b.bar(516, 392, 46, 12, A.lighten(p.metal, -14));
    });
    b.object('microscope', 'hero', function () {
      b.bar(700, 356, 13, 90, p.metal);
      b.bar(724, 330, 56, 12, p.metal);
      b.disc(752, 340, 13, p.cool, { glow: { blur: 20, color: p.cool } });
      b.rbox(700, 400, 72, 16, 5, A.lighten(p.metal, -14));
      b.rbox(676, 372, 44, 12, 4, A.lighten(p.metal, 8));
    });
    b.object('specimen-jar', 'hero', function () {
      jar(b, 812, 358, 52, 80, 'hsl(190 40% 76%)', p.frameDark, p.neon2, rng);
      bubbles(b, 812, 356, rng, 'hsl(190 80% 84%)', 5, 16);
    });
    b.object('chart', 'hero', function () {
      b.box(892, 380, 96, 44, 'hsl(40 40% 88%)');
      b.line(892, 380, A.wave(80, 8, 3), p.neon, 2, 40, 10, { rot: -0.2 });
      b.box(892, 362, 96, 7, p.frameDark);
    });
    b.object('lantern-desk', 'hero', function () {
      b.rbox(596, 322, 46, 54, 7, p.metal);
      b.rbox(596, 322, 36, 42, 5, p.warm, { alpha: 0.9, glow: { blur: 30, color: p.warm } });
      b.bar(596, 292, 22, 8, A.lighten(p.metal, -10));
    });
    b.object('toolbox', 'prop', function () {
      b.rbox(444, 386, 74, 44, 6, 'hsl(200 40% 42%)');
      b.bar(444, 362, 30, 8, p.metal);
      b.box(444, 388, 62, 6, A.lighten('hsl(200 40% 42%)', -12));
    });

    // -- the diver, sitting on the desk edge
    b.object('diver', 'hero', function () {
      b.shape(700, 546, A.poly([[-30, 44], [-26, -30], [26, -30], [30, 44]]), 30, 44, 'hsl(200 46% 34%)');
      b.disc(700, 496, 24, 'hsl(190 46% 74%)');
      b.ell(700, 486, 30, 22, 'hsl(190 80% 62%)', { alpha: 0.42 });
      b.line(700, 486, A.arc(30, Math.PI, Math.PI * 2), p.metal, 5, 30, 30);
      b.disc(690, 498, 3, p.ink);
      b.disc(710, 498, 3, p.ink);
      b.bar(660, 520, 46, 12, 'hsl(200 46% 28%)');
      b.bar(742, 520, 46, 12, 'hsl(200 46% 28%)');
      bubbles(b, 730, 452, rng, 'hsl(190 80% 86%)', 6, 26);
    });

    b.object('starfish', 'prop', function () {
      b.shape(944, 500, A.star(5, 26, 11), 26, 26, 'hsl(24 80% 60%)', { rot: 0.3 });
    });
    b.object('shell', 'prop', function () {
      b.shape(400, 566, A.wedge(22, Math.PI, Math.PI * 2), 22, 22, 'hsl(40 50% 78%)');
      b.line(400, 566, A.arc(14, Math.PI, Math.PI * 2), 'hsl(40 40% 62%)', 2, 14, 14);
    });

    return b;
  }

  // ------------------------------------------------------------------ the roster

  var ROSTER = {
    ramen: { id: 'ramen', palette: P.ramen, build: ramenShop },
    lab: { id: 'lab', palette: P.lab, build: laboratory },
    market: { id: 'market', palette: P.market, build: nightMarket },
    arcade: { id: 'arcade', palette: P.arcade, build: arcadeRoom },
    observatory: { id: 'observatory', palette: P.observatory, build: observatory },
    'ramen-dawn': { id: 'ramen-dawn', palette: P.ramenDawn, build: ramenShop },
    'arcade-night': { id: 'arcade-night', palette: P.arcadeNight, build: arcadeRoom },
  };

  /**
   * Build a scene. Returns the flat item list the painter draws and the objects a difference may
   * be made from.
   */
  function build(themeId, rand) {
    var entry = ROSTER[themeId] || ROSTER.ramen;
    var rng = rand || STD.rng.make(themeId);
    var b = entry.build(rng, entry.palette);
    return {
      id: entry.id,
      name: entry.palette.name,
      palette: entry.palette,
      w: W,
      h: H,
      items: b.items,
      objects: b.objects,
    };
  }

  return { W: W, H: H, roster: ROSTER, build: build, brush: brush };
})();
