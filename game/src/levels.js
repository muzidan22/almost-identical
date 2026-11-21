// The seven scenes of the game, in order, and the Daily puzzle.
//
// A level is just a scene, a seed, a number of differences and a clock. Difficulty rises along
// three axes at once, which is what makes the later scenes feel harder rather than merely longer:
// more differences to find, less time to find them in, and `ease` — how far each change goes.
// At ease 0 a colour change is a different colour and a moved object has plainly moved; at ease 1
// the change is a few degrees of hue or a nudge, and you have to actually compare.

STD.levels = (function () {
  var LIST = [
    { n: 1, theme: 'ramen',       name: 'First Bowl',      diffs: 5,  seconds: 130, ease: 0.00, seed: 'almost-identical-1' },
    { n: 2, theme: 'lab',         name: 'Bubbling Flask',  diffs: 6,  seconds: 125, ease: 0.12, seed: 'almost-identical-2' },
    { n: 3, theme: 'market',      name: 'Lantern Alley',   diffs: 7,  seconds: 118, ease: 0.26, seed: 'almost-identical-3' },
    { n: 4, theme: 'arcade',      name: 'Insert Coin',     diffs: 8,  seconds: 112, ease: 0.40, seed: 'almost-identical-4' },
    { n: 5, theme: 'observatory', name: 'Deep Window',     diffs: 9,  seconds: 106, ease: 0.55, seed: 'almost-identical-5' },
    { n: 6, theme: 'ramen-dawn',  name: 'Before Service',  diffs: 10, seconds: 100, ease: 0.72, seed: 'almost-identical-6' },
    { n: 7, theme: 'arcade-night', name: 'After Hours',    diffs: 10, seconds: 95,  ease: 0.88, seed: 'almost-identical-7' },
  ];

  /** The date, as YYYY-MM-DD in the player's own time zone. */
  function today() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  /** How many differences the Daily asks for: it has to be a real puzzle, but never a slog. */
  function dailyDiffs() {
    var days = Math.floor(Date.now() / 86400000);
    return 6 + (days % 5);
  }

  /**
   * The Daily puzzle: the same seed for everyone alive on the same day, so two players comparing
   * notes are looking at exactly the same two pictures. The scene is picked by the date too, so
   * the Daily is a different place from one day to the next.
   */
  function daily(dateText) {
    var key = dateText || today();
    var rng = STD.rng.make('almost-identical-daily-' + key);
    var roster = Object.keys(STD.scenes.roster);
    return {
      n: 0,
      theme: roster[rng.int(0, roster.length - 1)],
      name: 'Daily · ' + key,
      diffs: dailyDiffs(),
      seconds: 150,
      ease: 0.35,
      seed: 'almost-identical-daily-' + key,
      daily: true,
      date: key,
    };
  }

  /** The level after this one, or null at the end of the list. */
  function next(index) {
    return index + 1 < LIST.length ? LIST[index + 1] : null;
  }

  /** A level's scene and its two pictures, ready to play. */
  function prepare(level, seedOverride) {
    var rand = STD.rng.make(seedOverride || level.seed);
    var scene = STD.scenes.build(level.theme, rand);
    var pair = STD.diffs.make(scene, level.diffs, rand, level.ease);
    // The second picture changes; the first is the scene itself.
    return {
      level: level,
      scene: scene,
      left: scene.items,
      right: pair.items,
      diffs: pair.diffs,
    };
  }

  return {
    list: LIST,
    count: LIST.length,
    next: next,
    prepare: prepare,
    daily: daily,
    today: today,
  };
})();
