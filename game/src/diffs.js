// Making the second picture.
//
// The first picture is the scene as drawn. The second is a copy of it with a handful of objects
// quietly changed. This file chooses which objects and how, and — just as importantly — records
// where each change is and how big a target it deserves, because that is what a click is tested
// against later.
//
// Two rules keep the differences fair:
//   * a difference is always made to a whole object, never to one stray shape, so "the lantern
//     moved" reads as one change rather than three shreds of a lantern;
//   * the recorded target is a circle big enough to cover the object (with a floor, so a tiny
//     object is still comfortably clickable), and two changes are never placed so close together
//     that one click could mean either.

STD.diffs = (function () {
  var A = STD.art;

  /**
   * The eight ways an object can change. They are deliberately different in kind, not degree, so a
   * player who has learned to spot a colour shift still has to look for a moved object.
   */
  var KINDS = [
    'recolor',  // it is a different colour now
    'vanish',   // it is gone
    'appear',   // there is an extra one
    'move',     // it has slid a little
    'rotate',   // it is turned
    'flip',     // it is mirrored
    'scale',    // it is bigger or smaller
    'fade',     // it is faint, as though it were further off
  ];

  /** The smallest a target may be, so nothing is a pixel hunt. */
  var MIN_TARGET = 26;
  /** The largest a target may be: past this the change is a landmark, not a detail. */
  var MAX_TARGET = 80;
  /** How much clear space to leave between two targets, so two marks never overlap on screen. */
  var TARGET_GAP = 28;

  /** Objects a difference may be made from: solid enough to notice, small enough to be a detail. */
  function candidates(objects) {
    var out = [];
    for (var i = 0; i < objects.length; i += 1) {
      var o = objects[i];
      if (o.tag === 'bg' || o.tag === 'light') continue;
      var big = Math.max(o.hw, o.hh);
      var small = Math.min(o.hw, o.hh);
      if (big < 10 || big > MAX_TARGET || small < 7) continue;
      out.push(o);
    }
    return out;
  }

  /** How big a click target an object deserves. */
  function targetRadius(obj) {
    var r = Math.max(obj.hw, obj.hh) * 0.95;
    return Math.max(MIN_TARGET, Math.min(MAX_TARGET, r));
  }

  /**
   * Pick `count` objects to change, keeping them apart. Objects are tried in a shuffled order and
   * a candidate is taken only when nothing already taken is too near it, so no two differences
   * fight over the same patch of picture.
   */
  function choose(cands, count, rng) {
    var pool = rng.shuffle(cands);
    var taken = [];
    for (var i = 0; i < pool.length && taken.length < count; i += 1) {
      var o = pool[i];
      var r = targetRadius(o);
      var clear = true;
      for (var j = 0; j < taken.length; j += 1) {
        var t = taken[j];
        var dx = o.x - t.x;
        var dy = o.y - t.y;
        var need = r + t.r + TARGET_GAP;
        if (dx * dx + dy * dy < need * need) { clear = false; break; }
      }
      if (clear) taken.push({ obj: o, r: r });
    }
    return taken;
  }

  /** How far a change goes. `ease` runs 0 (a first puzzle) to 1 (a hard one). */
  function spread(ease, easyLo, easyHi, hardLo, hardHi) {
    return { lo: easyLo + (hardLo - easyLo) * ease, hi: easyHi + (hardHi - easyHi) * ease };
  }

  /** Whether a fill is a colour this file may re-hue. */
  function isColour(fill) {
    return typeof fill === 'string' && fill.indexOf('hsl(') === 0;
  }

  /** Move every shape of an object by (dx, dy). */
  function shift(items, obj, dx, dy) {
    for (var i = 0; i < obj.parts.length; i += 1) {
      var it = items[obj.parts[i]];
      it.x += dx;
      it.y += dy;
    }
  }

  /** Turn every shape of an object about the object's own centre. */
  function turnAbout(items, obj, angle) {
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    for (var i = 0; i < obj.parts.length; i += 1) {
      var it = items[obj.parts[i]];
      var dx = it.x - obj.x;
      var dy = it.y - obj.y;
      it.x = obj.x + dx * cos - dy * sin;
      it.y = obj.y + dx * sin + dy * cos;
      it.rot += angle;
    }
  }

  /** Mirror every shape of an object about the object's own vertical axis. */
  function mirrorAbout(items, obj) {
    for (var i = 0; i < obj.parts.length; i += 1) {
      var it = items[obj.parts[i]];
      it.x = obj.x * 2 - it.x;
      it.flip = !it.flip;
    }
  }

  /** Grow or shrink every shape of an object about the object's own centre. */
  function scaleAbout(items, obj, factor) {
    for (var i = 0; i < obj.parts.length; i += 1) {
      var it = items[obj.parts[i]];
      it.x = obj.x + (it.x - obj.x) * factor;
      it.y = obj.y + (it.y - obj.y) * factor;
      it.sx *= factor;
      it.sy *= factor;
    }
  }

  /** Is the box (x, y, hw, hh) clear of every object in `avoid`? */
  function isClearOf(x, y, hw, hh, avoid, margin) {
    for (var i = 0; i < avoid.length; i += 1) {
      var o = avoid[i];
      if (Math.abs(x - o.x) < hw + o.hw + margin && Math.abs(y - o.y) < hh + o.hh + margin) return false;
    }
    return true;
  }

  /**
   * Change one object. Returns the target the change sits in, or null when this kind could not be
   * applied to this object (the caller then tries another kind rather than spoiling the picture).
   */
  function mutate(kind, items, obj, rng, ease, scene) {
    var i, it;

    if (kind === 'recolor') {
      var hue = spread(ease, 34, 74, 12, 26);
      var light = spread(ease, 16, 28, 7, 13);
      var turned = 0;
      for (i = 0; i < obj.parts.length; i += 1) {
        it = items[obj.parts[i]];
        if (!isColour(it.fill)) continue;
        // A grey has no hue to turn, so greys get a change of lightness instead.
        var pale = /hsl\(\d+(?:\.\d+)? (\d+)%/.exec(it.fill);
        if (pale && Number(pale[1]) < 18) {
          it.fill = A.lighten(it.fill, rng.range(light.lo, light.hi));
        } else {
          it.fill = A.turn(it.fill, rng.chance(0.5) ? rng.range(hue.lo, hue.hi) : -rng.range(hue.lo, hue.hi));
        }
        turned += 1;
      }
      if (!turned) return null;
    } else if (kind === 'vanish') {
      for (i = 0; i < obj.parts.length; i += 1) {
        items[obj.parts[i]].alpha = 0;
      }
    } else if (kind === 'appear') {
      // Slip a copy of the object in beside itself, where there is room for it.
      var d = spread(ease, 1.05, 1.45, 0.95, 1.2);
      var dist = Math.max(obj.hw, obj.hh) * rng.range(d.lo, d.hi) + 26;
      var dirs = rng.shuffle([
        [1, 0], [-1, 0], [0, -1], [0, 1], [0.7, -0.7], [-0.7, -0.7], [0.7, 0.7], [-0.7, 0.7],
      ]);
      var placed = false;
      var nx = 0, ny = 0;
      for (var d2 = 0; d2 < dirs.length && !placed; d2 += 1) {
        nx = obj.x + dirs[d2][0] * dist;
        ny = obj.y + dirs[d2][1] * dist;
        if (nx - obj.hw < 12 || nx + obj.hw > scene.w - 12) continue;
        if (ny - obj.hh < 12 || ny + obj.hh > scene.h - 12) continue;
        if (!isClearOf(nx, ny, obj.hw, obj.hh, scene.objects, 6)) continue;
        placed = true;
      }
      if (!placed) return null;
      for (i = 0; i < obj.parts.length; i += 1) {
        var copy = A.clone(items[obj.parts[i]]);
        copy.id = obj.id + '-twin-' + i;
        copy.x += nx - obj.x;
        copy.y += ny - obj.y;
        items.push(copy);
      }
      obj = { x: nx, y: ny, hw: obj.hw, hh: obj.hh };
    } else if (kind === 'move') {
      var mv = spread(ease, 16, 26, 7, 13);
      var away = Math.max(obj.hw, obj.hh) * 0.35;
      var angle = rng.range(0, Math.PI * 2);
      var dx = Math.cos(angle) * rng.range(mv.lo, mv.hi);
      var dy = Math.sin(angle) * rng.range(mv.lo, mv.hi);
      if (obj.x + dx - obj.hw < 10 || obj.x + dx + obj.hw > scene.w - 10) dx = -dx;
      if (obj.y + dy - obj.hh < 10 || obj.y + dy + obj.hh > scene.h - 10) dy = -dy;
      if (Math.abs(dx) < away && Math.abs(dy) < away) dx = dx < 0 ? -away * 1.4 : away * 1.4;
      shift(items, obj, dx, dy);
      obj = { x: obj.x + dx, y: obj.y + dy, hw: obj.hw, hh: obj.hh };
    } else if (kind === 'rotate') {
      var ang = spread(ease, 0.34, 0.62, 0.13, 0.22);
      turnAbout(items, obj, rng.chance(0.5) ? rng.range(ang.lo, ang.hi) : -rng.range(ang.lo, ang.hi));
    } else if (kind === 'flip') {
      mirrorAbout(items, obj);
    } else if (kind === 'scale') {
      var sc = spread(ease, 1.24, 1.44, 1.09, 1.17);
      var factor = rng.chance(0.5) ? rng.range(sc.lo, sc.hi) : 1 / rng.range(sc.lo, sc.hi);
      scaleAbout(items, obj, factor);
    } else if (kind === 'fade') {
      var keep = spread(ease, 0.34, 0.5, 0.62, 0.76);
      for (i = 0; i < obj.parts.length; i += 1) {
        it = items[obj.parts[i]];
        it.alpha *= rng.range(keep.lo, keep.hi);
      }
    } else {
      return null;
    }

    return { x: obj.x, y: obj.y, r: targetRadius(obj) };
  }

  /** Names for the things a difference landed on, so a hint can say where to look. */
  function describe(obj) {
    var words = String(obj.id).replace(/-\d+$/, '').replace(/-/g, ' ');
    return words;
  }

  /**
   * Build the pair of pictures for a level.
   *   scene   from scenes.js
   *   count   how many differences to make
   *   rng     the seeded generator
   *   ease    0 (easy) to 1 (hard): how small the changes are
   * Returns the second picture's items and the list of differences, each with the circle a click
   * must land in and the kind of change it is.
   */
  function make(scene, count, rng, ease) {
    var items = A.cloneScene(scene.items);
    var picked = choose(candidates(scene.objects), count, rng);
    var diffs = [];
    var kinds = rng.shuffle(KINDS);

    for (var i = 0; i < picked.length; i += 1) {
      var obj = picked[i].obj;
      var made = null;
      // Try this object's kind first, then the others: some kinds cannot apply to some objects.
      var order = [kinds[i % kinds.length]].concat(rng.shuffle(kinds));
      for (var k = 0; k < order.length && made === null; k += 1) {
        made = mutate(order[k], items, obj, rng, ease, scene);
        if (made !== null) made.kind = order[k];
      }
      if (made === null) continue;
      diffs.push({
        id: obj.id,
        kind: made.kind,
        where: describe(obj),
        x: made.x,
        y: made.y,
        r: made.r,
        found: false,
      });
    }

    return { items: items, diffs: diffs };
  }

  return {
    KINDS: KINDS,
    make: make,
    candidates: candidates,
    targetRadius: targetRadius,
  };
})();
