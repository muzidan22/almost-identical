// Everything the game defines hangs off one global, `STD`, so the page can load plain
// classic scripts in order with no bundler, no module loader and no network request.
// (Classic scripts also mean the game opens and plays straight from the file system,
// where a browser refuses to load ES modules from a file:// page.)
var STD = {
  /** Filled in by every script that follows. */
  version: '1.0.0',
};
