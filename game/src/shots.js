// The screenshot scenes.
//
// A screenshot has to be the same picture every time it is taken, or the deliverable cannot be
// re-made. So a shot is not a mock-up: it drives the real game to a real state — a real scene, a
// real set of differences, some of them really found — and then stops interfering and lets the
// ordinary renderer draw it. What you see in the screenshots is what the game actually looks like
// when someone is three differences into a scene.
//
// A shot is asked for with a query:  ?shot=play&seed=1
// When the scene has painted, the page sets window.__shotReady = true, which is what the
// screenshot runner waits for.

STD.shots = (function () {
  /**
   * The scenes. Each one names a level to play, how many differences to have already found, and
   * what the clock and the score should say, so the picture shows a plausible moment mid-game.
   */
  var SCENES = {
    // The cover: a scene three differences in, with two still hiding on the counter and shelves.
    play: {
      level: 1, mode: 'classic', found: 3, timeLeft: 104, score: 545, combo: 3, misses: 0,
      chrome: 'Cozy Cyberpunk Ramen Shop', chip: 'Classic',
    },
    // A harder scene with a hint pulse running and a find still sparkling.
    hunt: {
      level: 3, mode: 'classic', found: 4, timeLeft: 71, score: 690, combo: 1, misses: 1,
      hint: true, burst: true,
      chrome: 'Bustling Night Market', chip: 'Classic',
    },
    // Looking closely: the same shared zoom, centred on one of the differences.
    zoom: {
      level: 5, mode: 'classic', found: 5, timeLeft: 62, score: 830, combo: 2, misses: 0,
      zoom: 2.2,
      chrome: 'Underwater Coral Observatory', chip: 'Classic',
    },
    // A scene cleared with all three stars, which is what the scoring screen looks like.
    result: {
      level: 2, mode: 'classic', found: 6, timeLeft: 88, score: 1180, combo: 4, misses: 0,
      result: true,
      chrome: 'Alchemist Laboratory', chip: 'Classic',
    },
    // The menu, for anyone who wants to see how the scenes are laid out.
    menu: { level: 1, mode: 'classic', found: 0, menu: true, chrome: 'Almost Identical', chip: 'Classic' },
  };

  /** A small seeded generator, so the sparks in a shot land in the same place every time. */
  function seeded(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** What shot, if any, the page was asked for. */
  function requested() {
    if (typeof window.URLSearchParams !== 'function' || !window.location.search) return null;
    var query = new window.URLSearchParams(window.location.search);
    var name = query.get('shot');
    if (!name || !SCENES[name]) return null;
    var seedText = query.get('seed') || '1';
    var seed = 0;
    for (var i = 0; i < seedText.length; i += 1) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
    return { name: name, spec: SCENES[name], seed: seed };
  }

  /** Drive the game to the state a shot describes, then hand over to the normal renderer. */
  function stage(spec, seed) {
    var diffs;
    var i;

    if (spec.menu) {
      STD.game.goMenu();
      return;
    }

    STD.game.play(spec.level - 1, spec.mode);

    var round = STD.board.getRound();
    if (!round) return;
    diffs = round.diffs;

    // The sparks thrown by a find are the only thing in a shot that uses Math.random, so pin it
    // while the shot is being built and put it back afterwards.
    var realRandom = Math.random;
    Math.random = seeded(seed);
    try {
      var now = performance.now();
      var shown = Math.min(spec.found, diffs.length);
      for (i = 0; i < shown; i += 1) {
        diffs[i].found = true;
        diffs[i].foundAt = now - 900;
      }
      if (spec.burst && shown > 0) {
        STD.board.burst(diffs[shown - 1].x, diffs[shown - 1].y, '#46e0a0', 14, 1);
      }
    } finally {
      Math.random = realRandom;
    }

    var state = STD.game.state;
    state.found = Math.min(spec.found, diffs.length);
    state.total = diffs.length;
    state.score = spec.score || 0;
    state.combo = spec.combo || 1;
    state.bestCombo = spec.combo || 1;
    state.misses = spec.misses || 0;
    state.timeLeft = spec.timeLeft == null ? state.level.seconds : spec.timeLeft;
    state.elapsed = spec.elapsed || 0;
    state.warned = true;

    // A hint pulse over whichever difference is still hiding, early in its sweep.
    if (spec.hint) {
      var hiding = diffs[state.found];
      if (hiding) STD.board.showHint(hiding, 600000);
    }

    // The aiming point, so the twin crosshair is visible in both pictures.
    var aimAt = diffs[Math.min(state.found, diffs.length - 1)];
    if (aimAt) {
      var aim = STD.board.getAim();
      aim.x = aimAt.x;
      aim.y = aimAt.y;
      aim.active = true;
      aim.panel = 0;
      aim.keys = false;
    }

    if (spec.zoom) {
      var focus = diffs[Math.min(state.found, diffs.length - 1)];
      if (focus) STD.board.centerOn(focus.x, focus.y, spec.zoom);
    }

    STD.game.setChrome(spec.chrome, spec.chip);
    STD.game.refreshHud();
    STD.game.quiet();

    if (spec.result) STD.game.finish(true);
  }

  /**
   * If a shot was asked for, stage it and mark the page ready. Returns true when the page is a
   * screenshot scene rather than a normal game.
   */
  function maybeRun() {
    var asked = requested();
    if (!asked) return false;
    try {
      stage(asked.spec, asked.seed);
    } catch (err) {
      // A shot that cannot be staged must still unblock the runner, or it waits for ever.
      if (window.console && window.console.error) window.console.error('shot failed', err);
    }
    // Two frames: one for the state to settle, one for the paint to land.
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { window.__shotReady = true; });
    });
    return true;
  }

  return { maybeRun: maybeRun, scenes: SCENES, requested: requested };
})();
