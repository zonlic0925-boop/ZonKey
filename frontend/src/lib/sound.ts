/**
 * Local UI Synthesizer Feedback Sound Engine
 * Synthesized locally with Web Audio API (sine, triangle, square waveforms).
 * Zero network, zero assets.
 */

type SoundKind = 'touch' | 'slide' | 'hover' | 'success';

interface ToneSpec {
  frequency: number;
  endFrequency?: number;
  duration: number;
  volume: number;
  waveform?: OscillatorType;
}

const UI_SOUND_STYLES: Record<string, Record<SoundKind, ToneSpec[]>> = {
  '1': {
    touch: [{ frequency: 360, endFrequency: 430, duration: 0.065, volume: 0.14, waveform: 'sine' }],
    slide: [{ frequency: 285, endFrequency: 330, duration: 0.045, volume: 0.08, waveform: 'sine' }],
    hover: [{ frequency: 440, endFrequency: 470, duration: 0.04, volume: 0.08, waveform: 'sine' }],
    success: [
      { frequency: 523.25, endFrequency: 659.25, duration: 0.08, volume: 0.12, waveform: 'triangle' },
      { frequency: 659.25, endFrequency: 783.99, duration: 0.12, volume: 0.14, waveform: 'triangle' }
    ]
  }
};

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let soundEnabled = true;
let lastPlayed: Record<string, number> = {};

function getAudioContext(userGesture = false): AudioContext | null {
  if (!soundEnabled) return null;
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioCtxClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(audioCtx.destination);
    } catch {
      return null;
    }
  }

  if (userGesture && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function playSound(kind: SoundKind = 'touch', { userGesture = false, force = false } = {}) {
  if (!soundEnabled && !force) return;
  const now = performance.now();
  const minInterval = kind === 'hover' ? 100 : 40;
  if (!force && now - (lastPlayed[kind] || 0) < minInterval) return;

  const ctx = getAudioContext(userGesture);
  if (!ctx || !masterGain || ctx.state === 'closed') return;
  lastPlayed[kind] = now;

  const profile = UI_SOUND_STYLES['1'][kind] || UI_SOUND_STYLES['1'].touch;
  const startTime = ctx.currentTime + 0.002;

  profile.forEach((tone) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const duration = tone.duration || 0.06;
      const volume = tone.volume || 0.1;

      osc.type = tone.waveform || 'sine';
      osc.frequency.setValueAtTime(tone.frequency, startTime);
      if (tone.endFrequency) {
        osc.frequency.exponentialRampToValueAtTime(tone.endFrequency, startTime + duration);
      }

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + Math.min(0.015, duration * 0.3));
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(masterGain!);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    } catch {
      // Audio node failure fallback
    }
  });
}

export function initGlobalSoundListeners() {
  if (typeof window === 'undefined') return;

  window.addEventListener('pointerdown', () => {
    getAudioContext(true);
  }, { capture: true, passive: true });

  window.addEventListener('pointerover', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, [role="button"], [data-sound-click]')) {
      playSound('hover');
    }
  }, { passive: true });
}
