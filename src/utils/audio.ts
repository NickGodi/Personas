/**
 * Audio Synthesizer strictly for Pre-Match Roulette and Team Drafting.
 * All general site sounds are disabled as requested.
 */
class RouletteSoundEngine {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Smooth, pleasant harmonic ticking during card spin / team lottery
  playRouletteTick() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Pleasant, relaxing celebratory chime when card/team is revealed
  playRouletteFinish() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const freqs = [739.99, 932.33, 1108.73, 1479.98]; // F#5, A#5, C#6, F#6

    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.04, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.6);
    });
  }
}

export const rouletteSound = new RouletteSoundEngine();

// No-op sound object to satisfy legacy imports with zero sound playback
export const sound = {
  playCardFlip: () => {},
  playCardSpin: () => {},
  playVictory: () => {},
  playNotification: () => {},
};
