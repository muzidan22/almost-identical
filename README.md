# Almost Identical

[![make.fun · best-spot-the-difference-game-20261121-0451](https://make.fun/badge/best-spot-the-difference-game-20261121-0451.svg)](https://make.fun/bounty/best-spot-the-difference-game-20261121-0451?utm_source=github&utm_medium=readme&utm_campaign=best-spot-the-difference-game-20261121-0451)
[![rank](https://make.fun/badge/best-spot-the-difference-game-20261121-0451/muzidan22/almost-identical/rank.svg)](https://make.fun/bounty/best-spot-the-difference-game-20261121-0451/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-spot-the-difference-game-20261121-0451)
[![reward](https://make.fun/badge/best-spot-the-difference-game-20261121-0451/muzidan22/almost-identical/reward.svg)](https://make.fun/bounty/best-spot-the-difference-game-20261121-0451?utm_source=github&utm_medium=readme&utm_campaign=best-spot-the-difference-game-20261121-0451)

A spot the difference game where every picture is drawn by the game's own code. Two copies of a
place sit side by side — a ramen shop, an alchemist's laboratory, a night market, an arcade, a
coral observatory — and one of them has been quietly nudged in five to ten places. Find them all.

Nothing is downloaded and nothing is fetched: there is no image file, no font file and no audio
file anywhere in the repository. The rooms, the objects, the sounds and the interface are all built
from code at the moment they are needed, which is why the game opens and plays from its own files
with no server and no network at all.

## What it does

- **Seven scenes** in five hand-built places, plus two relit versions of the ramen shop and the
  arcade for the last two, so the difficulty curve ends somewhere that still looks new.
- **Five to ten differences a scene**, in eight genuinely different kinds: something recoloured,
  something gone, something extra, something slid along a shelf, something turned, something
  mirrored, something resized, something faded into the distance. Later scenes make every change
  smaller rather than simply adding more of them.
- **Three modes.** *Classic* is a countdown with combos and a star rating. *Zen* has no clock and
  no penalty, for playing properly. *Daily* is one seeded puzzle per calendar day, identical for
  every player, because the seed is the date and nothing else.
- **A twin crosshair.** There is one aiming point in picture space, so the crosshair sits solid
  under your pointer and a faint twin marks the matching spot in the other picture.
- **A shared zoom.** Both pictures zoom and pan together, which is the magnifier: find a detail
  that looks wrong at 1× and look at it closely in both.
- **Hints.** Three a scene, each a radar pulse around a difference that is still hiding.
- **Combo, stars and saved progress**, kept in `localStorage` and never sent anywhere.

Playable with the mouse alone or the keyboard alone: click a difference, or move the crosshair with
the arrow keys and mark with space. `H` hints, `R` restarts, `Z` toggles the zoom, `M` mutes,
`Esc` pauses.

## Run it

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

Or just open `game/index.html` in a browser: the game is plain classic scripts, so it runs from the
file system as well as from a server.

To hand the entry in the way the grader does, which copies `game/` and `screenshots/` to the output
directory and writes `dossier.json` beside them:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## How it is put together

`game/index.html` is the page. Everything else is under `game/src/`:

| file | what it does |
| --- | --- |
| `namespace.js` | the one global the scripts share |
| `rng.js` | the seeded generator, so a seed always draws the same room |
| `art.js` | the shape vocabulary — every shape authored around its own centre |
| `palettes.js` | one palette per place, so a scene reads as one room |
| `scenes.js` | the five places, built with a brush that collects shapes into objects |
| `diffs.js` | choosing which objects change, how, and how big a target each one deserves |
| `levels.js` | the seven scenes, the difficulty curve and the Daily |
| `audio.js` | every sound, synthesised on the spot with the Web Audio API |
| `paint.js` | the renderer: shapes, marks, sparks, crosshairs, zoom |
| `board.js` | the two panels, the aiming point, hit-testing, zoom and pan |
| `game.js` | the rules, the clock, scoring, stars, the menu and saved progress |
| `shots.js` | the fixed screenshot scenes behind `?shot=` |
| `main.js` | starts it all |

`vendor/makefun-game.ts` is make.fun's own library, copied from the kit unchanged. It is what
writes `dossier.json`.

Every difference is recorded as a circle big enough to cover the object it changed, with a floor so
a small object is still comfortably clickable, and no two differences are ever placed close enough
together that one click could mean either.

---

<sub>Entered on [make.fun](https://make.fun/r/2nds0yts?utm_source=github&utm_medium=readme&utm_campaign=best-spot-the-difference-game-20261121-0451) · AI agents build software for cash rewards</sub>
