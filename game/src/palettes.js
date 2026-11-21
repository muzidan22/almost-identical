// One palette per scene. Every colour in the game comes from one of these, so a scene reads as a
// single place rather than a pile of shapes. Hues are degrees; the helpers in art.js turn them
// into colours and can lighten or re-hue one, which is how a "this thing changed colour"
// difference is made without inventing a new palette.

STD.palettes = (function () {
  /** Build a palette from its hues, filling in the shades a scene usually needs. */
  function make(spec) {
    var p = {
      name: spec.name,
      /** The wall or sky behind everything, top to bottom. */
      backTop: spec.backTop,
      backBottom: spec.backBottom,
      /** The floor or ground plane. */
      floor: spec.floor,
      floorEdge: spec.floorEdge,
      /** Structural things: counters, beams, frames. */
      frame: spec.frame,
      frameDark: spec.frameDark,
      /** The strongest thing in the scene: a neon sign, a glowing window. */
      neon: spec.neon,
      neon2: spec.neon2,
      /** Warm light: lamps, flames, lanterns. */
      warm: spec.warm,
      warmDeep: spec.warmDeep,
      /** Cool light: water, screens, glass. */
      cool: spec.cool,
      /** Foliage and other living things. */
      leaf: spec.leaf,
      leafDeep: spec.leafDeep,
      /** Things people made: ceramic, cloth, metal. */
      clay: spec.clay,
      cloth: spec.cloth,
      metal: spec.metal,
      /** Ink for outlines and small details. */
      ink: spec.ink || 'hsl(232 34% 9%)',
      /** A neutral highlight for glints and glass. */
      shine: 'hsl(210 60% 92%)',
    };
    return p;
  }

  return {
    make: make,

    /** A cozy cyberpunk ramen shop: rain on the window, neon outside, steam inside. */
    ramen: make({
      name: 'Cozy Cyberpunk Ramen Shop',
      backTop: 'hsl(258 36% 15%)', backBottom: 'hsl(266 30% 22%)',
      floor: 'hsl(248 28% 17%)', floorEdge: 'hsl(250 30% 11%)',
      frame: 'hsl(24 34% 32%)', frameDark: 'hsl(22 32% 20%)',
      neon: 'hsl(322 92% 64%)', neon2: 'hsl(186 92% 62%)',
      warm: 'hsl(36 96% 63%)', warmDeep: 'hsl(16 88% 48%)',
      cool: 'hsl(196 74% 56%)', leaf: 'hsl(140 46% 42%)', leafDeep: 'hsl(148 44% 26%)',
      clay: 'hsl(20 46% 74%)', cloth: 'hsl(348 62% 50%)', metal: 'hsl(212 18% 62%)',
    }),

    /** An isometric alchemist's laboratory: dust, glass, brass and candlelight. */
    lab: make({
      name: 'Alchemist Laboratory',
      backTop: 'hsl(212 26% 14%)', backBottom: 'hsl(206 22% 21%)',
      floor: 'hsl(28 22% 26%)', floorEdge: 'hsl(26 24% 17%)',
      frame: 'hsl(30 30% 34%)', frameDark: 'hsl(28 28% 21%)',
      neon: 'hsl(150 84% 56%)', neon2: 'hsl(276 78% 66%)',
      warm: 'hsl(42 98% 66%)', warmDeep: 'hsl(24 92% 50%)',
      cool: 'hsl(178 72% 54%)', leaf: 'hsl(96 42% 44%)', leafDeep: 'hsl(104 40% 27%)',
      clay: 'hsl(34 40% 72%)', cloth: 'hsl(280 40% 46%)', metal: 'hsl(44 34% 62%)',
    }),

    /** A bustling night market: paper lanterns, hot griddles, a crowd of silhouettes. */
    market: make({
      name: 'Bustling Night Market',
      backTop: 'hsl(226 40% 12%)', backBottom: 'hsl(232 34% 20%)',
      floor: 'hsl(230 26% 19%)', floorEdge: 'hsl(232 28% 12%)',
      frame: 'hsl(18 34% 30%)', frameDark: 'hsl(16 32% 19%)',
      neon: 'hsl(0 86% 62%)', neon2: 'hsl(46 96% 62%)',
      warm: 'hsl(38 98% 65%)', warmDeep: 'hsl(14 90% 50%)',
      cool: 'hsl(204 70% 56%)', leaf: 'hsl(126 44% 44%)', leafDeep: 'hsl(134 42% 27%)',
      clay: 'hsl(24 44% 72%)', cloth: 'hsl(354 54% 48%)', metal: 'hsl(210 16% 60%)',
    }),

    /** A retro arcade room: carpet, cabinets, marquees and a lot of glow. */
    arcade: make({
      name: 'Retro Arcade Room',
      backTop: 'hsl(272 38% 13%)', backBottom: 'hsl(268 32% 20%)',
      floor: 'hsl(268 26% 16%)', floorEdge: 'hsl(270 28% 10%)',
      frame: 'hsl(256 22% 26%)', frameDark: 'hsl(258 24% 16%)',
      neon: 'hsl(300 92% 64%)', neon2: 'hsl(186 96% 60%)',
      warm: 'hsl(44 98% 64%)', warmDeep: 'hsl(20 90% 52%)',
      cool: 'hsl(190 84% 58%)', leaf: 'hsl(150 44% 44%)', leafDeep: 'hsl(158 42% 26%)',
      clay: 'hsl(30 40% 74%)', cloth: 'hsl(334 66% 52%)', metal: 'hsl(220 14% 62%)',
    }),

    /** An underwater coral observatory: cold light, warm coral, drifting bubbles. */
    observatory: make({
      name: 'Underwater Coral Observatory',
      backTop: 'hsl(200 62% 15%)', backBottom: 'hsl(196 56% 24%)',
      floor: 'hsl(38 26% 30%)', floorEdge: 'hsl(36 28% 20%)',
      frame: 'hsl(198 24% 34%)', frameDark: 'hsl(200 26% 21%)',
      neon: 'hsl(320 84% 66%)', neon2: 'hsl(168 84% 58%)',
      warm: 'hsl(40 94% 66%)', warmDeep: 'hsl(20 86% 52%)',
      cool: 'hsl(188 80% 62%)', leaf: 'hsl(160 46% 42%)', leafDeep: 'hsl(168 44% 26%)',
      clay: 'hsl(28 44% 74%)', cloth: 'hsl(200 54% 50%)', metal: 'hsl(204 20% 64%)',
    }),

    /** The same ramen shop at dawn, before service: warm paper light, quiet, dust in the air. */
    ramenDawn: make({
      name: 'Ramen Shop, First Light',
      backTop: 'hsl(30 30% 26%)', backBottom: 'hsl(24 34% 36%)',
      floor: 'hsl(28 26% 30%)', floorEdge: 'hsl(26 28% 20%)',
      frame: 'hsl(28 38% 40%)', frameDark: 'hsl(26 36% 25%)',
      neon: 'hsl(190 70% 56%)', neon2: 'hsl(348 62% 60%)',
      warm: 'hsl(44 96% 70%)', warmDeep: 'hsl(24 90% 56%)',
      cool: 'hsl(198 56% 62%)', leaf: 'hsl(104 40% 44%)', leafDeep: 'hsl(112 38% 28%)',
      clay: 'hsl(26 46% 76%)', cloth: 'hsl(8 60% 52%)', metal: 'hsl(40 16% 66%)',
    }),

    /** The same arcade with the house lights up: cold, blue, and almost empty. */
    arcadeNight: make({
      name: 'Arcade After Hours',
      backTop: 'hsl(224 40% 14%)', backBottom: 'hsl(220 34% 22%)',
      floor: 'hsl(222 28% 18%)', floorEdge: 'hsl(224 30% 11%)',
      frame: 'hsl(214 20% 30%)', frameDark: 'hsl(216 22% 18%)',
      neon: 'hsl(174 90% 56%)', neon2: 'hsl(206 92% 62%)',
      warm: 'hsl(38 92% 62%)', warmDeep: 'hsl(16 84% 52%)',
      cool: 'hsl(194 86% 60%)', leaf: 'hsl(164 42% 42%)', leafDeep: 'hsl(172 40% 25%)',
      clay: 'hsl(212 24% 72%)', cloth: 'hsl(212 62% 54%)', metal: 'hsl(210 14% 64%)',
    }),
  };
})();
