// The two pictures and everything you do to them.
//
// The board owns the pair of canvases, the shared zoom, the aiming point and the effects. Both
// panels are drawn from the same scene coordinates, which is the trick that makes the twin
// crosshair work: there is one aim point in picture space, so it can be drawn solid under the
// pointer and as a faint twin in the other picture at exactly the matching spot.
//
// Aiming works from the mouse or the keyboard. Both move the same point, so a player who never
// touches the mouse can still play: arrows move the aim, space marks it.

STD.board = (function () {
  var els = {};
  var panels = [];
  var views = [];
  var sizes = [{ w: 1, h: 1 }, { w: 1, h: 1 }];
  var aim = { x: 500, y: 320, active: false, panel: null };
  var zoom = { level: 1, min: 1, max: 3.4, panX: 0, panY: 0 };
  var round = null;
  var particles = [];
  var flash = null;
  var hint = null;
  var shakeUntil = 0;
  var lastMissAt = 0;
  var onHit = null;
  var onMiss = null;
  var onZoom = null;

  /** How long a mistake is ignored for, so mashing the mouse cannot drain the clock. */
  var MISS_COOLDOWN = 220;

  // ------------------------------------------------------------------ geometry

  function measure() {
    for (var i = 0; i < panels.length; i += 1) {
      var box = panels[i].getBoundingClientRect();
      sizes[i] = { w: Math.max(1, box.width), h: Math.max(1, box.height) };
      var made = STD.paint.resize(els.canvases[i], sizes[i].w, sizes[i].h);
      els.contexts[i] = made.ctx;
    }
    updateViews();
  }

  /** Recompute both panels' transforms from the current zoom and pan. */
  function updateViews() {
    if (!round) return;
    for (var i = 0; i < 2; i += 1) {
      views[i] = STD.paint.view(sizes[i].w, sizes[i].h, round.scene, zoom.level, zoom.panX, zoom.panY);
    }
  }

  /** Keep the picture from being dragged away from the panel. */
  function clampPan() {
    if (!round) return;
    var v = views[0];
    if (!v) return;
    var overX = Math.max(0, (round.scene.w * v.scale - v.cssW) / 2);
    var overY = Math.max(0, (round.scene.h * v.scale - v.cssH) / 2);
    zoom.panX = Math.max(-overX, Math.min(overX, zoom.panX));
    zoom.panY = Math.max(-overY, Math.min(overY, zoom.panY));
  }

  /** Zoom, keeping whatever is under `focus` (a point on the canvas) where it is. */
  function setZoom(level, focusPanel, focusX, focusY) {
    var before = null;
    if (focusPanel != null && views[focusPanel]) {
      before = STD.paint.toScene(views[focusPanel], focusX, focusY);
    }
    var next = Math.max(zoom.min, Math.min(zoom.max, level));
    if (Math.abs(next - zoom.level) < 0.0001) return;
    zoom.level = next;
    updateViews();
    if (before && focusPanel != null) {
      // Put the point that was under the pointer back under it.
      var after = STD.paint.toScreen(views[focusPanel], before.x, before.y);
      zoom.panX += focusX - after.x;
      zoom.panY += focusY - after.y;
    }
    clampPan();
    updateViews();
    if (onZoom) onZoom(zoom.level);
  }

  /** Look closely at one spot: centre the picture on (x, y) in scene coordinates. */
  function centerOn(x, y, level) {
    if (!round) return;
    zoom.level = Math.max(zoom.min, Math.min(zoom.max, level || zoom.level));
    zoom.panX = 0;
    zoom.panY = 0;
    updateViews();
    var v = views[0];
    if (!v) return;
    zoom.panX = v.cssW / 2 - (v.ox + x * v.scale);
    zoom.panY = v.cssH / 2 - (v.oy + y * v.scale);
    clampPan();
    updateViews();
    if (onZoom) onZoom(zoom.level);
  }

  function resetZoom() {
    zoom.level = 1;
    zoom.panX = 0;
    zoom.panY = 0;
    updateViews();
    if (onZoom) onZoom(zoom.level);
  }

  /** Where on the canvas a pointer event happened, and which panel it was over. */
  function localPoint(index, event) {
    var box = panels[index].getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  /** The scene point a canvas point names. */
  function scenePoint(index, local) {
    if (!views[index]) return { x: 0, y: 0 };
    return STD.paint.toScene(views[index], local.x, local.y);
  }

  // ------------------------------------------------------------------ effects

  /** Throw a handful of sparks out from a point in the picture. */
  function burst(x, y, color, count, speed) {
    for (var i = 0; i < count; i += 1) {
      var a = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      var v = (speed || 1) * (60 + Math.random() * 120);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        size: 2.4 + Math.random() * 3.4,
        color: color,
      });
    }
  }

  /** Advance the sparks. */
  function stepParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i -= 1) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.vx *= 0.985;
    }
  }

  /** A label that drifts up off the picture: "+120", "-5s". */
  function floatLabel(sceneX, sceneY, text, kind, panel) {
    if (!views[panel || 0]) return;
    var v = views[panel || 0];
    var p = STD.paint.toScreen(v, sceneX, sceneY);
    var box = els.board.getBoundingClientRect();
    var pbox = panels[panel || 0].getBoundingClientRect();
    var el = document.createElement('div');
    el.className = 'float ' + (kind || 'good');
    el.textContent = text;
    el.style.left = (pbox.left - box.left + p.x) + 'px';
    el.style.top = (pbox.top - box.top + p.y) + 'px';
    els.floats.appendChild(el);
    window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
  }

  // ------------------------------------------------------------------ input

  function markDiff(diff, panel) {
    diff.found = true;
    diff.foundAt = performance.now();
    burst(diff.x, diff.y, '#46e0a0', 16, 1);
    burst(diff.x, diff.y, '#ffcb47', 10, 0.6);
    if (onHit) onHit(diff, panel);
  }

  /** A click (or a space press) at the current aim point. */
  function mark() {
    if (!round || !aim.active) return;
    var now = performance.now();
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < round.diffs.length; i += 1) {
      var d = round.diffs[i];
      var dx = d.x - aim.x;
      var dy = d.y - aim.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var reach = d.r * 1.15;
      if (dist <= reach && dist < bestD) { best = d; bestD = dist; }
    }
    var panel = aim.panel == null ? 0 : aim.panel;
    if (best && !best.found) {
      markDiff(best, panel);
      return;
    }
    if (best && best.found) {
      // Already found: saying so is friendlier than charging for it.
      floatLabel(aim.x, aim.y, 'found', 'hint', panel);
      return;
    }
    if (now - lastMissAt < MISS_COOLDOWN) return;
    lastMissAt = now;
    shakeUntil = now + 340;
    flash = { from: now, until: now + 320, color: '#ff5a6a' };
    burst(aim.x, aim.y, '#ff5a6a', 9, 0.5);
    if (onMiss) onMiss(aim);
  }

  function bindPointer(index) {
    var el = panels[index];

    el.addEventListener('pointerdown', function (event) {
      if (!round) return;
      STD.audio.wake();
      var local = localPoint(index, event);
      var pt = scenePoint(index, local);
      aim.x = pt.x; aim.y = pt.y;
      aim.active = true;
      aim.panel = index;
      aim.dragging = zoom.level > 1.001;
      aim.moved = 0;
      aim.startX = event.clientX;
      aim.startY = event.clientY;
      if (el.setPointerCapture && event.pointerId != null) {
        try { el.setPointerCapture(event.pointerId); } catch (err) { /* not fatal */ }
      }
      if (!aim.dragging) mark();
      event.preventDefault();
    });

    el.addEventListener('pointermove', function (event) {
      if (!round) return;
      var local = localPoint(index, event);
      var pt = scenePoint(index, local);
      if (aim.dragging && event.buttons) {
        zoom.panX += event.clientX - aim.startX;
        zoom.panY += event.clientY - aim.startY;
        aim.moved += Math.abs(event.clientX - aim.startX) + Math.abs(event.clientY - aim.startY);
        aim.startX = event.clientX;
        aim.startY = event.clientY;
        clampPan();
        updateViews();
      }
      aim.x = pt.x; aim.y = pt.y;
      aim.active = true;
      aim.panel = index;
      if (onAim) onAim();
    });

    el.addEventListener('pointerup', function (event) {
      if (aim.dragging && aim.moved < 6) mark();
      aim.dragging = false;
      event.preventDefault();
    });

    el.addEventListener('pointerleave', function () {
      if (aim.panel === index && !aim.keys) aim.active = false;
    });

    el.addEventListener('wheel', function (event) {
      if (!round) return;
      event.preventDefault();
      var local = localPoint(index, event);
      var step = event.deltaY < 0 ? 0.22 : -0.22;
      setZoom(zoom.level + step, index, local.x, local.y);
    }, { passive: false });

    el.addEventListener('contextmenu', function (event) { event.preventDefault(); });
  }

  var onAim = null;

  /** Keyboard aiming and shortcuts. The game handles the shortcuts; the board moves the aim. */
  function moveAim(dx, dy) {
    var step = 14 / Math.max(1, zoom.level * 0.8);
    aim.x = Math.max(0, Math.min(round ? round.scene.w : 1000, aim.x + dx * step));
    aim.y = Math.max(0, Math.min(round ? round.scene.h : 640, aim.y + dy * step));
    aim.active = true;
    aim.keys = true;
    if (aim.panel == null) aim.panel = 0;
  }

  // ------------------------------------------------------------------ lifecycle

  function init(options) {
    onHit = options.onHit;
    onMiss = options.onMiss;
    onZoom = options.onZoom;
    onAim = options.onAim;
    els.board = document.getElementById('board');
    els.floats = document.getElementById('float-layer');
    panels = [document.getElementById('panel-a'), document.getElementById('panel-b')];
    els.canvases = [document.getElementById('canvas-a'), document.getElementById('canvas-b')];
    els.contexts = [null, null];
    for (var i = 0; i < 2; i += 1) bindPointer(i);
    window.addEventListener('resize', function () { measure(); });
    measure();
  }

  /** Load a prepared round (see levels.prepare). */
  function load(prepared) {
    round = prepared;
    particles = [];
    hint = null;
    flash = null;
    zoom.panX = 0;
    zoom.panY = 0;
    if (zoom.level <= 1.001) zoom.level = 1;
    aim.active = false;
    aim.panel = null;
    aim.keys = false;
    for (var i = 0; i < round.diffs.length; i += 1) {
      round.diffs[i].found = false;
      round.diffs[i].foundAt = 0;
    }
    measure();
  }

  /** Highlight one unfound difference for a while. */
  function showHint(diff, ms) {
    var now = performance.now();
    hint = { x: diff.x, y: diff.y, r: Math.max(diff.r, 46), from: now, until: now + (ms || 3600) };
  }

  function clearHint() { hint = null; }

  function missFlash() {
    var now = performance.now();
    flash = { from: now, until: now + 320, color: '#ff5a6a' };
  }

  /** Draw both panels. Called from the game's animation loop. */
  function render(now) {
    if (!round) return;
    if (els.board) els.board.classList.toggle('is-shaking', now < shakeUntil);
    for (var i = 0; i < 2; i += 1) {
      if (!els.contexts[i]) continue;
      panels[i].classList.toggle('shake', now < shakeUntil);
      var isActive = aim.panel === i || (aim.panel == null && i === 0);
      STD.paint.render({
        ctx: els.contexts[i],
        view: views[i],
        scene: round.scene,
        items: i === 0 ? round.left : round.right,
        diffs: round.diffs,
        particles: particles,
        hint: hint,
        flash: flash,
        now: now,
        cursor: isActive ? aim : null,
        ghost: !isActive ? aim : null,
      });
    }
  }

  return {
    init: init,
    load: load,
    render: render,
    mark: mark,
    moveAim: moveAim,
    setZoom: setZoom,
    resetZoom: resetZoom,
    centerOn: centerOn,
    showHint: showHint,
    clearHint: clearHint,
    missFlash: missFlash,
    floatLabel: floatLabel,
    burst: burst,
    stepParticles: stepParticles,
    measure: measure,
    getZoom: function () { return zoom.level; },
    getRound: function () { return round; },
    getAim: function () { return aim; },
    setAimActive: function (on) { aim.active = !!on; if (!on) aim.keys = false; },
  };
})();
