// Short Web Audio blips. The AudioContext is only created from a user gesture (unlock()).
import { MAX_LEVEL, mergeFrequency } from './cats.js';

export function createAudio({ muted = false } = {}) {
  let context = null;
  let isMuted = muted;

  function tone(frequency, start, length, peak, type = 'triangle') {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.02);
  }

  const ready = () => !isMuted && context !== null && context.state === 'running';

  return {
    unlock() {
      if (!context) {
        const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AudioContextClass) return;
        try {
          context = new AudioContextClass();
        } catch {
          return;
        }
      }
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }
    },
    get muted() {
      return isMuted;
    },
    setMuted(value) {
      isMuted = value;
    },
    // `level` is the cat that was created; two max-level cats vanish with a short arpeggio.
    playMerge(level) {
      if (!ready()) return;
      const now = context.currentTime;
      if (level >= MAX_LEVEL) {
        [0, 1, 2, 3].forEach((i) => tone(mergeFrequency(MAX_LEVEL) * 2 ** (i * 0.25 + 1), now + i * 0.07, 0.25, 0.12));
        return;
      }
      const frequency = mergeFrequency(level);
      tone(frequency, now, 0.2, 0.16);
      tone(frequency * 2, now, 0.12, 0.05, 'sine');
    },
    playGameOver() {
      if (!ready()) return;
      const now = context.currentTime;
      [392, 330, 262].forEach((frequency, i) => tone(frequency, now + i * 0.16, 0.3, 0.12));
    },
  };
}
