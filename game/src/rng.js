// A tiny deterministic random number generator.
//
// Every scene in this game is drawn by code, so "the same picture" is only possible if the
// drawing code makes the same choices every time. A seeded generator gives that: the same seed
// always lays out the same shop, the same bottles on the same shelves, and therefore the same
// pair of pictures to compare. It is also what makes the Daily puzzle identical for every player.

STD.rng = (function () {
  /** Turn any text (a level name, a date) into a 32-bit number, so a string can be a seed. */
  function hashSeed(text) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /** mulberry32: small, fast, and good enough to scatter props convincingly. */
  function make(seed) {
    var state = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
    if (state === 0) state = 0x9e3779b9;

    /** A float in [0, 1). */
    function next() {
      state = (state + 0x6d2b79f5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    var api = {
      next: next,
      /** A float in [lo, hi). */
      range: function (lo, hi) { return lo + next() * (hi - lo); },
      /** A whole number in [lo, hi], both ends included. */
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      /** True with probability p. */
      chance: function (p) { return next() < p; },
      /** One of the given values. */
      pick: function (list) { return list[Math.floor(next() * list.length)]; },
      /** A copy of the list, shuffled (Fisher-Yates). */
      shuffle: function (list) {
        var out = list.slice();
        for (var i = out.length - 1; i > 0; i -= 1) {
          var j = Math.floor(next() * (i + 1));
          var swap = out[i]; out[i] = out[j]; out[j] = swap;
        }
        return out;
      },
      /** A value near `base`, give or take `spread`. */
      jitter: function (base, spread) { return base + (next() * 2 - 1) * spread; },
    };
    return api;
  }

  return { make: make, hashSeed: hashSeed };
})();
