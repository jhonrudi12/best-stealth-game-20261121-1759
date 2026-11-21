// Tiny procedural sounds: no audio files, just the Web Audio oscillator. The context is
// created on the first user gesture, so it never complains about autoplay.

export function createAudio() {
  let context = null;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function blip(freq, seconds, type, gainValue, when) {
    const ctx = ensure();
    if (ctx === null) return;
    const start = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue || 0.08, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  return {
    /** Call from a user gesture so the context is allowed to start. */
    unlock() {
      const ctx = ensure();
      if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    gem() {
      blip(880, 0.16, 'sine', 0.07);
      blip(1318, 0.2, 'sine', 0.05, 0.07);
    },
    relic() {
      blip(523, 0.18, 'triangle', 0.08);
      blip(659, 0.18, 'triangle', 0.08, 0.1);
      blip(784, 0.3, 'triangle', 0.08, 0.2);
    },
    pebble() {
      blip(300, 0.07, 'square', 0.03);
    },
    suspicious() {
      blip(392, 0.12, 'square', 0.05);
      blip(370, 0.16, 'square', 0.05, 0.1);
    },
    alert() {
      blip(220, 0.22, 'sawtooth', 0.07);
      blip(233, 0.22, 'sawtooth', 0.07, 0.12);
      blip(220, 0.3, 'sawtooth', 0.07, 0.26);
    },
    caught() {
      blip(196, 0.3, 'sawtooth', 0.08);
      blip(147, 0.5, 'sawtooth', 0.08, 0.16);
    },
    win() {
      blip(523, 0.16, 'triangle', 0.08);
      blip(659, 0.16, 'triangle', 0.08, 0.12);
      blip(784, 0.16, 'triangle', 0.08, 0.24);
      blip(1046, 0.4, 'triangle', 0.08, 0.36);
    },
  };
}
