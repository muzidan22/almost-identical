// The rules, the clock, the scoring and everything you see around the pictures.
//
// Three modes share one board:
//   Classic — a countdown, a mistake costs five seconds, and how much clock you have left decides
//             your stars. This is the mode the screenshots show.
//   Zen     — no clock and no penalty. Mistakes simply do nothing, so you can look as long as you
//             like. It exists because hunting for a difference is pleasant and a timer is not
//             always what you want.
//   Daily   — one seeded puzzle per calendar day, identical for every player, scored like Classic.
//
// Progress (stars per scene, best score, sound preference) is kept in localStorage. Nothing is
// ever sent anywhere: the game makes no network request at all.

STD.game = (function () {
  var PROGRESS_KEY = 'almost-identical/progress/v1';
  var SETTINGS_KEY = 'almost-identical/settings/v1';

  /** What a mistake costs in Classic and Daily, in seconds. */
  var MISS_PENALTY = 5;
  /** Find another difference within this long and the combo climbs. */
  var COMBO_WINDOW = 4200;
  /** Points for a difference at combo 1, and how much each extra combo step adds. */
  var POINTS_BASE = 100;
  var POINTS_PER_COMBO = 45;
  /** Points per second still on the clock when a scene is cleared. */
  var POINTS_PER_SECOND = 8;
  /** How many hints a scene allows. */
  var HINTS_PER_SCENE = 3;

  var state = {
    screen: 'menu',
    mode: 'classic',
    levelIndex: 0,
    level: null,
    round: null,
    found: 0,
    total: 0,
    misses: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    hintsLeft: HINTS_PER_SCENE,
    timeLeft: 0,
    elapsed: 0,
    started: false,
    warned: false,
    lastFindAt: 0,
    hintUsed: 0,
  };

  var els = {};
  var lastFrame = 0;

  // ------------------------------------------------------------------ storage

  function readJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (err) {
      // Private windows and blocked storage throw; the game simply starts fresh.
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) { /* nothing to do, and nothing worth interrupting play for */ }
  }

  var progress = { levels: {}, daily: {} };
  var settings = { sound: true, mode: 'classic' };

  function loadStored() {
    progress = readJson(PROGRESS_KEY, { levels: {}, daily: {} });
    if (!progress.levels) progress.levels = {};
    if (!progress.daily) progress.daily = {};
    settings = readJson(SETTINGS_KEY, { sound: true, mode: 'classic' });
  }

  /** An entry for a level: stars earned and best score. */
  function recordFor(key) {
    return progress.levels[key] || { stars: 0, best: 0 };
  }

  function saveResult(key, stars, score, extra) {
    var rec = recordFor(key);
    var changed = false;
    if (stars > rec.stars) { rec.stars = stars; changed = true; }
    if (score > rec.best) { rec.best = score; changed = true; }
    if (extra) rec.extra = extra;
    progress.levels[key] = rec;
    if (changed) writeJson(PROGRESS_KEY, progress);
    return rec;
  }

  /** A scene is open when it is the first, or the one before it has been cleared once. */
  function isUnlocked(index) {
    if (index === 0) return true;
    var prev = recordFor(String(STD.levels.list[index - 1].n));
    return prev.stars >= 1;
  }

  function clearedCount() {
    var n = 0;
    for (var i = 0; i < STD.levels.list.length; i += 1) {
      if (recordFor(String(STD.levels.list[i].n)).stars > 0) n += 1;
    }
    return n;
  }

  // ------------------------------------------------------------------ scoring

  /** Stars for a finished scene, from how much clock was left and how often the player missed. */
  function starsFor(won) {
    if (!won) return 0;
    var level = state.level;
    if (state.mode === 'zen') {
      // Zen has no clock to judge by, so accuracy alone decides.
      if (state.misses === 0) return 3;
      return state.misses <= Math.ceil(state.total / 2) ? 2 : 1;
    }
    var left = level.seconds > 0 ? state.timeLeft / level.seconds : 0;
    var stars = 1;
    if (left >= 0.25 && state.misses <= state.total) stars = 2;
    if (left >= 0.45 && state.misses <= 2) stars = 3;
    return stars;
  }

  /** Points for one difference, rising with the combo. */
  function pointsFor(combo) {
    return POINTS_BASE + (combo - 1) * POINTS_PER_COMBO;
  }

  // ------------------------------------------------------------------ hud

  function clock(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    var m = Math.floor(s / 60);
    var rest = s % 60;
    return m + ':' + (rest < 10 ? '0' + rest : rest);
  }

  function starRow(stars) {
    var out = '';
    for (var i = 0; i < 3; i += 1) out += i < stars ? '★' : '☆';
    return out;
  }

  function updateHud(now) {
    var level = state.level;
    els.time.textContent = state.mode === 'zen' ? clock(state.elapsed) : clock(state.timeLeft);
    els.timeWrap.classList.toggle('is-low', state.mode !== 'zen' && state.timeLeft <= 15 && state.screen === 'play');
    els.found.innerHTML = '<b>' + state.found + '</b><i>/</i><em>' + state.total + '</em>';
    els.left.textContent = String(Math.max(0, state.total - state.found));
    els.score.textContent = String(state.score);
    els.combo.textContent = '×' + Math.max(1, state.combo);
    els.comboWrap.classList.toggle('is-hot', state.combo >= 3);
    els.hints.textContent = String(state.hintsLeft);
    els.hintBtn.disabled = state.hintsLeft <= 0 || state.screen !== 'play';
    var key = level && level.daily ? 'daily-' + level.date : (level ? String(level.n) : '');
    var rec = state.mode === 'daily' && level ? (progress.daily[level.date] || { stars: 0 }) : recordFor(key);
    els.stars.textContent = rec && rec.stars ? starRow(rec.stars) : '—';
    els.zoom.textContent = STD.board.getZoom().toFixed(1) + '×';
  }

  function toast(text, ms) {
    els.toast.textContent = text;
    els.toast.classList.add('is-on');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(function () { els.toast.classList.remove('is-on'); }, ms || 1900);
  }

  // ------------------------------------------------------------------ playing

  function setScreen(name) {
    state.screen = name;
    document.body.setAttribute('data-screen', name);
  }

  function openOverlay(id, on) {
    var el = document.getElementById(id);
    if (el) el.setAttribute('data-open', on ? 'true' : 'false');
  }

  function closeOverlays() {
    openOverlay('overlay-menu', false);
    openOverlay('overlay-result', false);
    openOverlay('overlay-pause', false);
  }

  /** Start a scene by index, in the current mode. */
  function playLevel(index, mode) {
    state.mode = mode || state.mode;
    var level;
    if (state.mode === 'daily') {
      level = STD.levels.daily();
    } else {
      state.levelIndex = Math.max(0, Math.min(STD.levels.count - 1, index));
      level = STD.levels.list[state.levelIndex];
    }
    state.level = level;
    // The Daily must be identical for every player, so its seed is the date alone — never the clock.
    state.round = STD.levels.prepare(level, level.seed);
    state.found = 0;
    state.total = state.round.diffs.length;
    state.misses = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.score = 0;
    state.hintsLeft = state.mode === 'zen' ? 99 : HINTS_PER_SCENE;
    state.timeLeft = level.seconds;
    state.elapsed = 0;
    state.started = true;
    state.warned = false;
    state.lastFindAt = 0;
    state.hintUsed = 0;

    STD.board.load(state.round);
    STD.board.resetZoom();
    closeOverlays();
    setScreen('play');
    els.levelName.textContent = level.name;
    els.chip.textContent = state.mode === 'zen' ? 'Zen' : state.mode === 'daily' ? 'Daily' : 'Classic';
    toast(state.mode === 'zen'
      ? 'Take your time: ' + state.total + ' differences'
      : state.total + ' differences · ' + clock(level.seconds) + ' on the clock');
    updateHud(performance.now());
  }

  function restart() {
    playLevel(state.levelIndex, state.mode);
  }

  /** The player found one. */
  function onHit(diff, panel) {
    var now = performance.now();
    var quick = state.lastFindAt && now - state.lastFindAt <= COMBO_WINDOW;
    state.combo = quick ? state.combo + 1 : 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.lastFindAt = now;
    var points = pointsFor(state.combo);
    state.score += points;
    state.found += 1;

    STD.audio.found(state.combo);
    STD.board.floatLabel(diff.x, diff.y, '+' + points + (state.combo > 1 ? '  ×' + state.combo : ''), 'good', panel);
    if (state.combo === 3) toast('Combo ×3 — keep going', 1200);
    if (state.combo === 5) toast('Combo ×5 — on a roll', 1200);

    if (state.found >= state.total) finish(true);
    updateHud(now);
  }

  /** The player clicked nothing. */
  function onMiss(at) {
    if (state.mode === 'zen') {
      STD.audio.miss();
      STD.board.floatLabel(at.x, at.y, 'nothing here', 'bad', 0);
      return;
    }
    state.misses += 1;
    state.combo = 0;
    state.timeLeft -= MISS_PENALTY;
    STD.audio.miss();
    STD.board.floatLabel(at.x, at.y, '−' + MISS_PENALTY + 's', 'bad', 0);
    updateHud(performance.now());
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      finish(false);
    }
  }

  /** One hint: a radar pulse around a difference that is still hiding. */
  function useHint() {
    if (state.screen !== 'play' || state.hintsLeft <= 0) return;
    var round = STD.board.getRound();
    if (!round) return;
    var hiding = [];
    for (var i = 0; i < round.diffs.length; i += 1) if (!round.diffs[i].found) hiding.push(round.diffs[i]);
    if (!hiding.length) return;
    var pick = hiding[Math.floor(Math.random() * hiding.length)];
    state.hintsLeft -= 1;
    state.hintUsed += 1;
    STD.board.showHint(pick, 3600);
    STD.audio.hint();
    toast('Something changed near the pulse', 1600);
    updateHud(performance.now());
  }

  /** The scene is over, one way or the other. */
  function finish(won) {
    if (state.screen !== 'play') return;
    var level = state.level;
    var round = STD.board.getRound();
    if (!won && round) {
      // Show what was missed rather than leaving the player guessing.
      for (var i = 0; i < round.diffs.length; i += 1) {
        if (!round.diffs[i].found) {
          round.diffs[i].found = true;
          round.diffs[i].foundAt = performance.now();
        }
      }
    }
    var stars = starsFor(won);
    var timeBonus = won && state.mode !== 'zen' ? Math.round(state.timeLeft * POINTS_PER_SECOND) : 0;
    var hintCost = state.hintUsed * Math.round(POINTS_BASE / 2);
    var total = Math.max(0, state.score + timeBonus - hintCost);

    var key = level.daily ? 'daily' : String(level.n);
    var rec;
    if (level.daily) {
      var prev = progress.daily[level.date] || { stars: 0, best: 0 };
      rec = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, total) };
      progress.daily[level.date] = rec;
      // Keep the Daily list from growing without bound.
      var dates = Object.keys(progress.daily).sort();
      while (dates.length > 60) { delete progress.daily[dates.shift()]; }
      writeJson(PROGRESS_KEY, progress);
    } else {
      rec = saveResult(key, stars, total);
    }

    setScreen('result');
    els.resultStars.innerHTML = won
      ? starRow(stars).replace(/★/g, '<span class="on">★</span>')
      : '<span>☆☆☆</span>';
    els.resultTitle.textContent = won ? (stars === 3 ? 'Flawless' : 'Scene cleared') : 'Out of time';
    els.resultSub.textContent = won
      ? (state.total + ' differences found' + (state.hintUsed ? ' · ' + state.hintUsed + ' hint' + (state.hintUsed > 1 ? 's' : '') : ''))
      : 'You found ' + state.found + ' of ' + state.total + '. The rest are marked on the pictures.';
    els.resultTime.textContent = state.mode === 'zen' ? clock(state.elapsed) : clock(state.timeLeft);
    els.resultMiss.textContent = String(state.misses);
    els.resultCombo.textContent = '×' + Math.max(1, state.bestCombo);
    els.resultScore.textContent = String(total);
    els.resultBest.textContent = String(rec.best) + (stars ? '  ' + starRow(rec.stars) : '');
    els.btnNext.disabled = level.daily || !STD.levels.next(state.levelIndex);
    openOverlay('overlay-result', true);

    if (won) {
      STD.audio.cleared();
      var round2 = STD.board.getRound();
      for (var b = 0; b < round2.diffs.length; b += 1) {
        STD.board.burst(round2.diffs[b].x, round2.diffs[b].y, '#ffcb47', 8, 0.8);
      }
    } else {
      STD.audio.failed();
    }
    buildMenu();
    updateHud(performance.now());
  }

  // ------------------------------------------------------------------ the clock

  function tick(dt) {
    if (state.screen !== 'play') return;
    if (state.mode === 'zen') {
      state.elapsed += dt;
      return;
    }
    state.timeLeft -= dt;
    if (!state.warned && state.timeLeft <= 10) {
      state.warned = true;
      STD.audio.tick();
      toast('Ten seconds', 1200);
    }
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      finish(false);
    }
  }

  // ------------------------------------------------------------------ menu

  function buildMenu() {
    var grid = els.levelGrid;
    grid.innerHTML = '';
    for (var i = 0; i < STD.levels.list.length; i += 1) {
      (function (index) {
        var level = STD.levels.list[index];
        var rec = recordFor(String(level.n));
        var unlocked = isUnlocked(index);
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'level-card' + (unlocked ? '' : ' is-locked') + (index === state.levelIndex ? ' is-current' : '');
        var palette = STD.scenes.roster[level.theme].palette;
        card.innerHTML =
          '<span class="level-swatch" style="background:linear-gradient(150deg,' + palette.backTop + ',' + palette.neon + ' 130%)"></span>' +
          '<span class="level-meta">' +
            '<span class="level-no">SCENE ' + level.n + (unlocked ? '' : ' · LOCKED') + '</span>' +
            '<span class="level-title">' + palette.name + '</span>' +
            '<span class="level-diff">' + level.diffs + ' differences · ' + clock(level.seconds) + '</span>' +
            '<span class="level-stars">' + starRow(rec.stars) + '</span>' +
          '</span>';
        card.disabled = !unlocked;
        card.addEventListener('click', function () { STD.audio.pick(); playLevel(index, state.mode); });
        grid.appendChild(card);
      }(i));
    }
    els.progress.textContent = clearedCount() + ' of ' + STD.levels.count + ' scenes cleared';
    var daily = STD.levels.daily();
    var done = progress.daily[daily.date];
    els.menuDaily.textContent = 'Today’s Daily: ' + STD.scenes.roster[daily.theme].palette.name +
      ' · ' + daily.diffs + ' differences' + (done ? ' · best ' + done.best : '');
  }

  function setMode(mode) {
    state.mode = mode;
    settings.mode = mode;
    writeJson(SETTINGS_KEY, settings);
    var cards = document.querySelectorAll('.mode-card');
    for (var i = 0; i < cards.length; i += 1) {
      var on = cards[i].getAttribute('data-mode') === mode;
      cards[i].classList.toggle('is-on', on);
      cards[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
    els.chip.textContent = mode === 'zen' ? 'Zen' : mode === 'daily' ? 'Daily' : 'Classic';
  }

  function setSound(on) {
    settings.sound = !!on;
    writeJson(SETTINGS_KEY, settings);
    STD.audio.setEnabled(settings.sound);
    els.sound.setAttribute('aria-pressed', settings.sound ? 'true' : 'false');
    els.sound.innerHTML = 'Sound&nbsp;' + (settings.sound ? 'on' : 'off');
  }

  function goMenu() {
    setScreen('menu');
    closeOverlays();
    state.started = false;
    buildMenu();
    openOverlay('overlay-menu', true);
  }

  function pause(on) {
    if (on && state.screen === 'play') {
      setScreen('paused');
      openOverlay('overlay-pause', true);
    } else if (!on && state.screen === 'paused') {
      setScreen('play');
      openOverlay('overlay-pause', false);
    }
  }

  // ------------------------------------------------------------------ wiring

  function bindKeys() {
    window.addEventListener('keydown', function (event) {
      var key = event.key;
      var lower = key.length === 1 ? key.toLowerCase() : key;

      if (key === 'Escape') {
        if (state.screen === 'play') pause(true);
        else if (state.screen === 'paused') pause(false);
        else if (state.screen === 'result') goMenu();
        else if (els.overlayMenu.getAttribute('data-open') === 'true' && state.started) closeOverlays(), setScreen('play');
        event.preventDefault();
        return;
      }
      if (state.screen === 'result') {
        if (key === 'Enter') { if (!els.btnNext.disabled) nextLevel(); else restart(); event.preventDefault(); }
        return;
      }
      if (state.screen !== 'play') {
        if (key === 'Enter' && els.overlayMenu.getAttribute('data-open') === 'true') {
          playLevel(state.levelIndex, state.mode);
          event.preventDefault();
        }
        return;
      }

      if (key === 'ArrowLeft' || lower === 'a') { STD.board.moveAim(-1, 0); event.preventDefault(); }
      else if (key === 'ArrowRight' || lower === 'd') { STD.board.moveAim(1, 0); event.preventDefault(); }
      else if (key === 'ArrowUp' || lower === 'w') { STD.board.moveAim(0, -1); event.preventDefault(); }
      else if (key === 'ArrowDown' || lower === 's') { STD.board.moveAim(0, 1); event.preventDefault(); }
      else if (key === ' ' || key === 'Enter') { STD.board.mark(); event.preventDefault(); }
      else if (lower === 'h') { useHint(); event.preventDefault(); }
      else if (lower === 'r') { restart(); event.preventDefault(); }
      else if (lower === 'z') {
        STD.board.setZoom(STD.board.getZoom() > 1.01 ? 1 : 2.1);
        event.preventDefault();
      } else if (key === '+' || key === '=') { STD.board.setZoom(STD.board.getZoom() + 0.25); event.preventDefault(); }
      else if (key === '-' || key === '_') { STD.board.setZoom(STD.board.getZoom() - 0.25); event.preventDefault(); }
      else if (lower === 'm') { setSound(!settings.sound); toast(settings.sound ? 'Sound on' : 'Sound off', 900); }
      else if (lower === 'p') { pause(true); }
    });
  }

  function nextLevel() {
    var next = STD.levels.next(state.levelIndex);
    if (!next) { goMenu(); return; }
    playLevel(state.levelIndex + 1, state.mode);
  }

  function frame(now) {
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    STD.board.stepParticles(dt);
    tick(dt);
    STD.board.render(now);
    updateHud(now);
    window.requestAnimationFrame(frame);
  }

  function init() {
    els = {
      time: document.getElementById('stat-time'),
      timeWrap: document.querySelector('.stat-timer'),
      found: document.getElementById('stat-found'),
      left: document.getElementById('stat-left'),
      score: document.getElementById('stat-score'),
      combo: document.getElementById('stat-combo'),
      comboWrap: document.getElementById('stat-combo-wrap'),
      stars: document.getElementById('stat-stars'),
      hints: document.getElementById('hint-count'),
      zoom: document.getElementById('zoom-level'),
      hintBtn: document.getElementById('btn-hint'),
      levelName: document.getElementById('scene-name'),
      chip: document.getElementById('mode-chip'),
      toast: document.getElementById('toast'),
      levelGrid: document.getElementById('level-grid'),
      progress: document.getElementById('progress-line'),
      menuDaily: document.getElementById('menu-daily'),
      overlayMenu: document.getElementById('overlay-menu'),
      resultStars: document.getElementById('result-stars'),
      resultTitle: document.getElementById('result-title'),
      resultSub: document.getElementById('result-sub'),
      resultTime: document.getElementById('result-time'),
      resultMiss: document.getElementById('result-miss'),
      resultCombo: document.getElementById('result-combo'),
      resultScore: document.getElementById('result-score'),
      resultBest: document.getElementById('result-best'),
      btnNext: document.getElementById('btn-next'),
      sound: document.getElementById('btn-sound'),
    };

    loadStored();
    STD.audio.setEnabled(settings.sound);

    STD.board.init({
      onHit: onHit,
      onMiss: onMiss,
      onZoom: function () { updateHud(performance.now()); },
    });

    document.getElementById('btn-hint').addEventListener('click', useHint);
    document.getElementById('btn-restart').addEventListener('click', restart);
    document.getElementById('btn-menu').addEventListener('click', goMenu);
    document.getElementById('btn-zoom').addEventListener('click', function () {
      STD.board.setZoom(STD.board.getZoom() > 1.01 ? 1 : 2.1);
    });
    document.getElementById('btn-zoom-in').addEventListener('click', function () { STD.board.setZoom(STD.board.getZoom() + 0.3); });
    document.getElementById('btn-zoom-out').addEventListener('click', function () { STD.board.setZoom(STD.board.getZoom() - 0.3); });
    document.getElementById('btn-sound').addEventListener('click', function () {
      STD.audio.wake();
      setSound(!settings.sound);
    });
    document.getElementById('btn-again').addEventListener('click', restart);
    document.getElementById('btn-next').addEventListener('click', nextLevel);
    document.getElementById('btn-result-menu').addEventListener('click', goMenu);
    document.getElementById('btn-resume').addEventListener('click', function () { pause(false); });
    document.getElementById('btn-pause-restart').addEventListener('click', restart);
    document.getElementById('btn-pause-menu').addEventListener('click', goMenu);
    document.getElementById('btn-reset').addEventListener('click', function () {
      progress = { levels: {}, daily: {} };
      writeJson(PROGRESS_KEY, progress);
      state.levelIndex = 0;
      buildMenu();
      toast('Saved progress erased', 1600);
    });

    var cards = document.querySelectorAll('.mode-card');
    for (var i = 0; i < cards.length; i += 1) {
      (function (card) {
        card.addEventListener('click', function () {
          STD.audio.wake();
          STD.audio.pick();
          setMode(card.getAttribute('data-mode'));
        });
      }(cards[i]));
    }

    document.getElementById('board').addEventListener('pointerdown', function () { STD.audio.wake(); }, { once: true });

    setMode(settings.mode || 'classic');
    setSound(settings.sound !== false);
    buildMenu();
    bindKeys();
    setScreen('menu');
    openOverlay('overlay-menu', true);
    window.requestAnimationFrame(frame);
  }

  return {
    init: init,
    playLevel: playLevel,
    goMenu: goMenu,
    setMode: setMode,
    useHint: useHint,
    // Exposed for the screenshot scenes, which need to drive the real game to a real state.
    play: function (index, mode) { playLevel(index, mode); },
    state: state,
    finish: finish,
    progress: function () { return progress; },
    /** Redraw the numbers around the pictures, for the screenshot scenes. */
    refreshHud: function () { updateHud(performance.now()); },
    /** Set the scene name and mode chip, for the screenshot scenes. */
    setChrome: function (name, chip) {
      if (name) els.levelName.textContent = name;
      if (chip) els.chip.textContent = chip;
    },
    /** Take the transient message down, so a screenshot is not caught mid-toast. */
    quiet: function () { els.toast.classList.remove('is-on'); },
  };
})();
