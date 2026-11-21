// Turning a scene into pixels.
//
// Both panels run the same code over the same scene coordinates; the only difference between them
// is which item list they are handed (the original or the changed one). That is why a change sits
// at exactly the same place in both pictures, and why a click can be tested in one shared
// coordinate system no matter which side of the screen it landed on.
//
// Shapes are cached as Path2D objects keyed by their path data, so a scene of a few hundred shapes
// redraws every frame without rebuilding any geometry.

STD.paint = (function () {
  var paths = {};

  /** The Path2D for a shape, built once and kept. */
  function pathFor(d) {
    var hit = paths[d];
    if (hit === undefined) {
      hit = new Path2D(d);
      paths[d] = hit;
    }
    return hit;
  }

  /** Size a canvas for the screen's pixel ratio so lines and text stay crisp. */
  function resize(canvas, cssW, cssH) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(cssW * dpr));
    var h = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: cssW, h: cssH };
  }

  /**
   * Where the scene sits inside a panel: the scale that fits it, the offset that centres it, and
   * the zoom and pan the player has dialled in.
   */
  function view(cssW, cssH, scene, zoom, panX, panY) {
    var base = Math.min(cssW / scene.w, cssH / scene.h);
    var scale = base * (zoom || 1);
    return {
      scale: scale,
      ox: (cssW - scene.w * scale) / 2 + (panX || 0),
      oy: (cssH - scene.h * scale) / 2 + (panY || 0),
      cssW: cssW,
      cssH: cssH,
    };
  }

  /** A point in the picture, as a point on the canvas. */
  function toScreen(v, x, y) {
    return { x: v.ox + x * v.scale, y: v.oy + y * v.scale };
  }

  /** A point on the canvas, as a point in the picture. */
  function toScene(v, sx, sy) {
    return { x: (sx - v.ox) / v.scale, y: (sy - v.oy) / v.scale };
  }

  /** Draw one shape, with its own turn, stretch, mirror, shadow and glow. */
  function drawItem(ctx, it, v) {
    if (it.alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha = it.alpha;
    ctx.translate(v.ox + it.x * v.scale, v.oy + it.y * v.scale);
    if (it.rot) ctx.rotate(it.rot);
    var sx = it.sx * v.scale * (it.flip ? -1 : 1);
    var sy = it.sy * v.scale;
    ctx.scale(sx, sy);
    if (it.shadow) {
      ctx.shadowOffsetX = it.shadow.dx;
      ctx.shadowOffsetY = it.shadow.dy;
      ctx.shadowBlur = it.shadow.blur;
      ctx.shadowColor = it.shadow.color;
    }
    if (it.glow) {
      ctx.shadowBlur = it.glow.blur;
      ctx.shadowColor = it.glow.color;
    }
    var p = pathFor(it.d);
    if (it.fill) {
      ctx.fillStyle = it.fill;
      ctx.fill(p);
    }
    if (it.stroke && it.lw > 0) {
      // The shape's own stretch is undone for the outline, so a squashed shape keeps an even line.
      ctx.lineWidth = it.lw / Math.max(0.02, v.scale) / Math.max(0.02, Math.abs(it.sx));
      ctx.lineCap = it.linecap || 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = it.stroke;
      ctx.stroke(p);
    }
    ctx.restore();
  }

  /** A ring that springs open and settles: the mark left on a difference you have found. */
  function drawFound(ctx, d, v, now) {
    var p = toScreen(v, d.x, d.y);
    var r = d.r * v.scale;
    var age = now - (d.foundAt || now);
    var pop = Math.min(1, age / 320);
    var eased = 1 - Math.pow(1 - pop, 3);
    var wobble = age < 420 ? Math.sin(age / 22) * 0.06 * (1 - age / 420) : 0;
    // Kept close to the target's own size: the mark says "here", it does not cover the picture.
    var ring = r * (1.16 + wobble) * (0.68 + 0.32 * eased);

    ctx.save();
    ctx.translate(p.x, p.y);

    // the green disc that reads as "got it"
    ctx.globalAlpha = 0.2 + 0.1 * (1 - eased);
    ctx.fillStyle = '#46e0a0';
    ctx.beginPath();
    ctx.arc(0, 0, ring, 0, Math.PI * 2);
    ctx.fill();

    // the gold ring on top of it
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(2, 3.2 * v.scale);
    ctx.strokeStyle = '#ffcb47';
    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(255,203,71,.85)';
    ctx.beginPath();
    ctx.arc(0, 0, ring, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.4, 2 * v.scale);
    ctx.strokeStyle = 'rgba(70,224,160,.95)';
    ctx.beginPath();
    ctx.arc(0, 0, ring * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // a tick, so the mark still reads on a tiny target
    ctx.lineWidth = Math.max(2, 3 * v.scale);
    ctx.strokeStyle = '#eafff5';
    ctx.beginPath();
    ctx.moveTo(-ring * 0.28, 0);
    ctx.lineTo(-ring * 0.06, ring * 0.24);
    ctx.lineTo(ring * 0.32, -ring * 0.24);
    ctx.stroke();
    ctx.restore();
  }

  /** The radar sweep a hint leaves behind. */
  function drawHint(ctx, hint, v, now) {
    if (!hint || now > hint.until) return;
    var left = (hint.until - now) / (hint.until - hint.from);
    var p = toScreen(v, hint.x, hint.y);
    var base = hint.r * v.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    for (var i = 0; i < 3; i += 1) {
      var phase = ((now / 900) + i / 3) % 1;
      ctx.globalAlpha = (1 - phase) * 0.75 * left;
      ctx.lineWidth = Math.max(1.6, 3 * v.scale);
      ctx.strokeStyle = '#ffcb47';
      ctx.beginPath();
      ctx.arc(0, 0, base * (0.35 + phase * 1.5), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.5 * left;
    ctx.fillStyle = '#ffcb47';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2.5, 4 * v.scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** The sparks thrown off by a find or a miss. */
  function drawParticles(ctx, list, v) {
    for (var i = 0; i < list.length; i += 1) {
      var s = list[i];
      if (s.life <= 0) continue;
      var p = toScreen(v, s.x, s.y);
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / s.max));
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.7, s.size * v.scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** A twin crosshair: where the pointer is here, and the same spot in the other picture. */
  function drawCross(ctx, at, v, kind) {
    if (!at || !at.active) return;
    var p = toScreen(v, at.x, at.y);
    var gap = kind === 'ghost' ? 9 : 7;
    var arm = kind === 'ghost' ? 7 : 11;
    ctx.save();
    ctx.globalAlpha = kind === 'ghost' ? 0.42 : 0.95;
    ctx.lineWidth = kind === 'ghost' ? 1.2 : 1.7;
    ctx.strokeStyle = kind === 'ghost' ? '#4fd6ff' : '#eef2ff';
    ctx.beginPath();
    ctx.moveTo(p.x - gap - arm, p.y); ctx.lineTo(p.x - gap, p.y);
    ctx.moveTo(p.x + gap, p.y); ctx.lineTo(p.x + gap + arm, p.y);
    ctx.moveTo(p.x, p.y - gap - arm); ctx.lineTo(p.x, p.y - gap);
    ctx.moveTo(p.x, p.y + gap); ctx.lineTo(p.x, p.y + gap + arm);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, kind === 'ghost' ? 3 : 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** A wash of colour over the whole picture, for a mistake. */
  function drawFlash(ctx, flash, v, now) {
    if (!flash || now > flash.until) return;
    var left = (flash.until - now) / (flash.until - flash.from);
    ctx.save();
    ctx.globalAlpha = 0.3 * left;
    ctx.fillStyle = flash.color;
    ctx.fillRect(0, 0, v.cssW, v.cssH);
    ctx.restore();
  }

  /** Darken the edges, so the eye settles in the middle of the picture. */
  function drawVignette(ctx, v) {
    var g = ctx.createRadialGradient(
      v.cssW / 2, v.cssH / 2, Math.min(v.cssW, v.cssH) * 0.28,
      v.cssW / 2, v.cssH / 2, Math.max(v.cssW, v.cssH) * 0.78
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.cssW, v.cssH);
  }

  /**
   * Draw one panel. `side` is 'left' or 'right' only so the caller can pass the matching item
   * list, the cursor and the twin crosshair.
   */
  function render(o) {
    var v = o.view;
    var ctx = o.ctx;
    ctx.clearRect(0, 0, v.cssW, v.cssH);
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, v.cssW, v.cssH);

    // Everything is clipped to the picture, so a shape that runs off the edge is cut cleanly.
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.ox, v.oy, o.scene.w * v.scale, o.scene.h * v.scale);
    ctx.clip();
    ctx.fillStyle = o.scene.palette.backTop;
    ctx.fillRect(v.ox, v.oy, o.scene.w * v.scale, o.scene.h * v.scale);

    var items = o.items;
    for (var i = 0; i < items.length; i += 1) drawItem(ctx, items[i], v);

    var now = o.now;
    for (var d = 0; d < o.diffs.length; d += 1) {
      if (o.diffs[d].found) drawFound(ctx, o.diffs[d], v, now);
    }
    drawHint(ctx, o.hint, v, now);
    drawParticles(ctx, o.particles, v);
    ctx.restore();

    drawCross(ctx, o.ghost, v, 'ghost');
    drawCross(ctx, o.cursor, v, 'here');
    drawVignette(ctx, v);
    drawFlash(ctx, o.flash, v, now);

    // A hairline frame, so the picture reads as a picture.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(v.ox + 0.5, v.oy + 0.5, o.scene.w * v.scale - 1, o.scene.h * v.scale - 1);
    ctx.restore();
  }

  return {
    resize: resize,
    view: view,
    toScreen: toScreen,
    toScene: toScene,
    render: render,
  };
})();
