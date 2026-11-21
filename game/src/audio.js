// Every sound in the game, made on the spot.
//
// There is no audio file anywhere in this game, and nothing is fetched. Each sound is a few
// oscillators and a gain envelope built the moment it is played, which keeps the game to its own
// files and keeps the sounds tunable in code. The palette is deliberately small: a rising chime
// for a find (it climbs with your combo, so a run of finds sounds like a run), a soft thud for a
// miss, a sweep for a hint, and a short chord when a scene is cleared.

STD.audio = (function () {
  var ctx = null;
  var master = null;
  var enabled = true;

  /** Create the audio graph on the first sound, because browsers forbid it before a gesture. */
  function ensure() {
    if (ctx) return ctx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.34;
      master.connect(ctx.destination);
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  /** Browsers start the clock suspended until the player interacts; wake it up. */
  function wake() {
    var c = ensure();
    if (c && c.state === 'suspended' && c.resume) c.resume();
  }

  /** One note: a waveform at a frequency, with a shaped attack and decay. */
  function note(freq, when, length, gain, type, glideTo) {
    if (!ensure() || !enabled) return;
    var t = ctx.currentTime + (when || 0);
    var osc = ctx.createOscillator();
    var amp = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, glideTo), t + length);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.min(0.02, length * 0.24));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(amp);
    amp.connect(master);
    osc.start(t);
    osc.stop(t + length + 0.03);
  }

  /** A soft thud: filtered noise, for a click that found nothing. */
  function thud() {
    if (!ensure() || !enabled) return;
    var t = ctx.currentTime;
    var frames = Math.floor(ctx.sampleRate * 0.22);
    var buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) * (1 - i / frames);
    }
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.22);
    var amp = ctx.createGain();
    amp.gain.setValueAtTime(0.5, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    src.start(t);
  }

  /** The five notes a perfect fifth apart that a find climbs through. */
  var STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

  function found(combo) {
    var step = STEPS[Math.min(STEPS.length - 1, Math.max(0, (combo || 1) - 1))];
    var base = 523.25 * Math.pow(2, step / 12);
    note(base, 0, 0.3, 0.3, 'triangle');
    note(base * 2, 0.03, 0.22, 0.12, 'sine');
    note(base * 3, 0.06, 0.16, 0.05, 'sine');
  }

  function miss() {
    thud();
    note(150, 0, 0.16, 0.14, 'sawtooth', 90);
  }

  function hint() {
    note(320, 0, 0.5, 0.16, 'sine', 1180);
    note(160, 0, 0.5, 0.08, 'triangle', 590);
  }

  function cleared() {
    var chord = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < chord.length; i += 1) {
      note(chord[i], i * 0.085, 0.7, 0.2, 'triangle');
    }
    note(1318.5, 0.42, 0.9, 0.12, 'sine');
  }

  function failed() {
    note(392, 0, 0.34, 0.2, 'triangle');
    note(311.13, 0.16, 0.44, 0.2, 'triangle');
    note(233.08, 0.34, 0.8, 0.2, 'triangle');
  }

  function tick() {
    note(880, 0, 0.06, 0.09, 'square');
  }

  function pick() {
    note(660, 0, 0.1, 0.14, 'triangle');
    note(990, 0.05, 0.12, 0.1, 'sine');
  }

  return {
    wake: wake,
    found: found,
    miss: miss,
    hint: hint,
    cleared: cleared,
    failed: failed,
    tick: tick,
    pick: pick,
    /** Sound on or off; the setting is remembered by the game. */
    setEnabled: function (on) { enabled = !!on; },
    isEnabled: function () { return enabled; },
    /** A short buzz for a wrong click, exposed so tests and shots can call it safely. */
    ready: function () { return !!ensure(); },
  };
})();
