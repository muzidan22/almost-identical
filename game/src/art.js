// The drawing vocabulary: how a scene is described, and the shapes it is built from.
//
// A scene is a plain array of items. An item is a shape (an SVG path) plus where it sits, how it
// is turned and scaled, and what it is painted with. Nothing here draws: this file only describes.
// paint.js turns the description into pixels, diffs.js changes a few items to make the second
// picture, and board.js uses each item's extent to decide what a click landed on.
//
// One rule keeps the whole game honest: every shape is authored around the origin (0,0) and its
// position lives in `x`/`y`. So an item's centre is exactly (x, y), which makes hit-testing a
// circle test and makes "move this object a little" a one-line change.

STD.art = (function () {
  /** A number as a short string: at most two decimals, no trailing zeros, never "-0". */
  function n(v) {
    var r = Math.round(v * 100) / 100;
    if (r === 0) return '0';
    return String(r);
  }

  /** A point [x, y] as path data. */
  function pt(p) { return n(p[0]) + ' ' + n(p[1]); }

  // ---------------------------------------------------------------- primitives

  /** A rectangle centred on the origin. */
  function rect(w, h) {
    var x = w / 2, y = h / 2;
    return 'M' + n(-x) + ' ' + n(-y) + 'h' + n(w) + 'v' + n(h) + 'h' + n(-w) + 'Z';
  }

  /** A rectangle with rounded corners. */
  function rrect(w, h, r) {
    var x = w / 2, y = h / 2;
    var rad = Math.min(r, x, y);
    return 'M' + n(-x + rad) + ' ' + n(-y) +
      'h' + n(w - rad * 2) + 'a' + n(rad) + ' ' + n(rad) + ' 0 0 1 ' + n(rad) + ' ' + n(rad) +
      'v' + n(h - rad * 2) + 'a' + n(rad) + ' ' + n(rad) + ' 0 0 1 ' + n(-rad) + ' ' + n(rad) +
      'h' + n(-(w - rad * 2)) + 'a' + n(rad) + ' ' + n(rad) + ' 0 0 1 ' + n(-rad) + ' ' + n(-rad) +
      'v' + n(-(h - rad * 2)) + 'a' + n(rad) + ' ' + n(rad) + ' 0 0 1 ' + n(rad) + ' ' + n(-rad) +
      'Z';
  }

  /** A circle of radius r. */
  function circle(r) {
    return 'M' + n(-r) + ' 0a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(r * 2) + ' 0a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(-r * 2) + ' 0Z';
  }

  /** An ellipse. */
  function ellipse(rx, ry) {
    return 'M' + n(-rx) + ' 0a' + n(rx) + ' ' + n(ry) + ' 0 1 0 ' + n(rx * 2) + ' 0a' + n(rx) + ' ' + n(ry) + ' 0 1 0 ' + n(-rx * 2) + ' 0Z';
  }

  /** A closed polygon through the given points. */
  function poly(points) {
    var d = 'M' + pt(points[0]);
    for (var i = 1; i < points.length; i += 1) d += 'L' + pt(points[i]);
    return d + 'Z';
  }

  /** A triangle, apex up, centred on the origin. */
  function triangle(w, h) {
    return poly([[-w / 2, h / 2], [w / 2, h / 2], [0, -h / 2]]);
  }

  /** A capsule: a bar with fully rounded ends. */
  function capsule(w, h) {
    return rrect(w, h, h / 2);
  }

  /** A regular star with `points` tips. */
  function star(points, rOuter, rInner, phase) {
    var start = phase == null ? -Math.PI / 2 : phase;
    var list = [];
    for (var i = 0; i < points * 2; i += 1) {
      var r = i % 2 === 0 ? rOuter : rInner;
      var a = start + (i * Math.PI) / points;
      list.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return poly(list);
  }

  /** A pie slice from angle a0 to a1 (radians). */
  function wedge(r, a0, a1) {
    var x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r;
    var x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
    var large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return 'M0 0L' + n(x0) + ' ' + n(y0) + 'A' + n(r) + ' ' + n(r) + ' 0 ' + large + ' 1 ' + n(x1) + ' ' + n(y1) + 'Z';
  }

  /** The band between two radii, from a0 to a1 (an annulus sector). */
  function ring(rOuter, rInner, a0, a1) {
    var large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    var ox0 = Math.cos(a0) * rOuter, oy0 = Math.sin(a0) * rOuter;
    var ox1 = Math.cos(a1) * rOuter, oy1 = Math.sin(a1) * rOuter;
    var ix1 = Math.cos(a1) * rInner, iy1 = Math.sin(a1) * rInner;
    var ix0 = Math.cos(a0) * rInner, iy0 = Math.sin(a0) * rInner;
    return 'M' + n(ox0) + ' ' + n(oy0) +
      'A' + n(rOuter) + ' ' + n(rOuter) + ' 0 ' + large + ' 1 ' + n(ox1) + ' ' + n(oy1) +
      'L' + n(ix1) + ' ' + n(iy1) +
      'A' + n(rInner) + ' ' + n(rInner) + ' 0 ' + large + ' 0 ' + n(ix0) + ' ' + n(iy0) + 'Z';
  }

  /** An open arc, meant to be stroked rather than filled. */
  function arc(r, a0, a1) {
    var large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    var x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r;
    var x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
    var sweep = a1 > a0 ? 1 : 0;
    return 'M' + n(x0) + ' ' + n(y0) + 'A' + n(r) + ' ' + n(r) + ' 0 ' + large + ' ' + sweep + ' ' + n(x1) + ' ' + n(y1);
  }

  /** The outline of a blob: a smooth closed curve wobbling around a circle. */
  function blob(r, wobble, points, rand) {
    var step = (Math.PI * 2) / points;
    var list = [];
    for (var i = 0; i < points; i += 1) {
      var a = i * step;
      var rr = r * (1 + (rand ? rand.jitter(0, wobble) : 0));
      list.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return smooth(points);
    /** Cardinal-spline control points, so the blob has no visible corners. */
    function smooth(pts) {
      var out = 'M' + pt(list[0]);
      for (var k = 0; k < pts; k += 1) {
        var p0 = list[(k - 1 + pts) % pts], p1 = list[k], p2 = list[(k + 1) % pts], p3 = list[(k + 2) % pts];
        var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        out += 'C' + pt(c1) + ' ' + pt(c2) + ' ' + pt(p2);
      }
      return out + 'Z';
    }
  }

  /** A four-point sparkle, the shape of a glint. */
  function sparkle(r) {
    var w = r * 0.22;
    return poly([[0, -r], [w, -w], [r, 0], [w, w], [0, r], [-w, w], [-r, 0], [-w, -w]]);
  }

  /** A horizontal wave band, useful for water, hair, cloth and steam. */
  function wave(w, amp, waves) {
    var half = w / 2;
    var d = 'M' + n(-half) + ' 0';
    var span = w / waves;
    for (var i = 0; i < waves; i += 1) {
      var x = -half + span * i;
      d += 'q' + n(span / 4) + ' ' + n(-amp) + ' ' + n(span / 2) + ' 0';
      d += 'q' + n(span / 4) + ' ' + n(amp) + ' ' + n(span / 2) + ' 0';
    }
    return d;
  }

  /** A droplet: round below, pointed above. */
  function droplet(r) {
    return 'M0 ' + n(-r * 1.6) +
      'C' + n(r * 0.62) + ' ' + n(-r * 0.5) + ' ' + n(r) + ' ' + n(r * 0.25) + ' ' + n(r) + ' ' + n(r * 0.55) +
      'A' + n(r) + ' ' + n(r) + ' 0 1 1 ' + n(-r) + ' ' + n(r * 0.55) +
      'C' + n(-r) + ' ' + n(r * 0.25) + ' ' + n(-r * 0.62) + ' ' + n(-r * 0.5) + ' 0 ' + n(-r * 1.6) + 'Z';
  }

  /** A leaf or petal pointing along +x from the origin. */
  function leaf(len, wide) {
    return 'M0 0C' + n(len * 0.35) + ' ' + n(-wide) + ' ' + n(len * 0.75) + ' ' + n(-wide) + ' ' + n(len) + ' 0' +
      'C' + n(len * 0.75) + ' ' + n(wide) + ' ' + n(len * 0.35) + ' ' + n(wide) + ' 0 0Z';
  }

  /** A flame, apex up. */
  function flame(w, h) {
    return 'M0 ' + n(-h / 2) +
      'C' + n(w * 0.42) + ' ' + n(-h * 0.06) + ' ' + n(w * 0.5) + ' ' + n(h * 0.3) + ' ' + n(w * 0.16) + ' ' + n(h * 0.5) +
      'C' + n(w * 0.06) + ' ' + n(h * 0.24) + ' ' + n(-w * 0.06) + ' ' + n(h * 0.24) + ' ' + n(-w * 0.16) + ' ' + n(h * 0.5) +
      'C' + n(-w * 0.5) + ' ' + n(h * 0.3) + ' ' + n(-w * 0.42) + ' ' + n(-h * 0.06) + ' 0 ' + n(-h / 2) + 'Z';
  }

  // ---------------------------------------------------------------- items

  /**
   * Describe one thing in a scene.
   *   id      a name, unique in its scene, so a difference can point at it
   *   d       the shape (from the builders above), authored around the origin
   *   hw, hh  the shape's half-width and half-height: how big it is, for hit-testing
   *   x, y    where its centre sits in the scene
   *   rot     how far it is turned, in radians
   *   sx, sy  how it is stretched
   *   flip    mirrored horizontally
   *   z       paint order: lower goes down first
   *   fill, stroke, lw, alpha   how it is painted
   *   glow, shadow              optional light around it or a shadow under it
   *   tag     a rough category ("prop", "wall", "decor"), used when choosing differences
   */
  function item(spec) {
    return {
      id: spec.id,
      d: spec.d,
      hw: spec.hw == null ? 10 : spec.hw,
      hh: spec.hh == null ? 10 : spec.hh,
      x: spec.x || 0,
      y: spec.y || 0,
      rot: spec.rot || 0,
      sx: spec.sx == null ? 1 : spec.sx,
      sy: spec.sy == null ? 1 : spec.sy,
      flip: !!spec.flip,
      z: spec.z == null ? 0 : spec.z,
      fill: spec.fill || null,
      stroke: spec.stroke || null,
      lw: spec.lw || 0,
      alpha: spec.alpha == null ? 1 : spec.alpha,
      linecap: spec.linecap || 'round',
      glow: spec.glow || null,
      shadow: spec.shadow || null,
      tag: spec.tag || 'prop',
    };
  }

  /** A deep-enough copy of an item, so a difference never edits the original picture. */
  function clone(source) {
    var out = {};
    for (var k in source) if (Object.prototype.hasOwnProperty.call(source, k)) out[k] = source[k];
    if (source.glow) out.glow = { blur: source.glow.blur, color: source.glow.color };
    if (source.shadow) out.shadow = { dx: source.shadow.dx, dy: source.shadow.dy, blur: source.shadow.blur, color: source.shadow.color };
    return out;
  }

  /** A whole scene, copied item by item. */
  function cloneScene(items) {
    var out = [];
    for (var i = 0; i < items.length; i += 1) out.push(clone(items[i]));
    return out;
  }

  /** How wide a thing looks once its stretch is taken into account. */
  function extent(it) {
    return {
      rx: it.hw * Math.abs(it.sx),
      ry: it.hh * Math.abs(it.sy),
    };
  }

  /** "#rrggbb" from a hue (0-360), saturation and lightness (0-1). */
  function hsl(h, s, l) {
    return 'hsl(' + Math.round(((h % 360) + 360) % 360) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%)';
  }

  /** A colour like hsl(), with its lightness moved. */
  function lighten(color, delta) {
    var m = /^hsl\((\d+(?:\.\d+)?) (\d+)% (\d+)%\)$/.exec(color);
    if (!m) return color;
    var l = Math.max(0, Math.min(100, Number(m[3]) + delta));
    return 'hsl(' + m[1] + ' ' + m[2] + '% ' + Math.round(l) + '%)';
  }

  /** A colour like hsl(), with its hue turned. */
  function turn(color, degrees) {
    var m = /^hsl\((\d+(?:\.\d+)?) (\d+)% (\d+)%\)$/.exec(color);
    if (!m) return color;
    return 'hsl(' + Math.round((Number(m[1]) + degrees + 360) % 360) + ' ' + m[2] + '% ' + m[3] + '%)';
  }

  return {
    n: n,
    rect: rect, rrect: rrect, circle: circle, ellipse: ellipse, poly: poly,
    triangle: triangle, capsule: capsule, star: star, wedge: wedge, ring: ring,
    arc: arc, blob: blob, sparkle: sparkle, wave: wave, droplet: droplet,
    leaf: leaf, flame: flame,
    item: item, clone: clone, cloneScene: cloneScene, extent: extent,
    hsl: hsl, lighten: lighten, turn: turn,
  };
})();
