// Start the game.
//
// Everything above is loaded as ordinary scripts in order, so by the time this runs every piece
// exists. All that is left is to build the board, open the menu and let the animation loop run.
// If the page was opened with a ?shot= query, shots.js takes the game to a fixed state instead —
// the loop still runs, so the animations in a screenshot are the real ones.

(function () {
  function start() {
    STD.game.init();
    STD.shots.maybeRun();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());
