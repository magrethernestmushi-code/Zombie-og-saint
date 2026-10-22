import type { AudioChannelSettings, SoundProfile } from "../types";

/**
 * Real audio post-production chain. Every control here maps to an actual
 * ffmpeg audio filter — there is no simulated "AI" step standing in for an
 * equalizer. The "Enhance Voice" style cleanup is ffmpeg's FFT denoiser
 * (afftdn) plus a de-esser, compressor and gate: genuinely useful for
 * hiss/hum/sibilance, but not a trained speech-enhancement model. See the
 * README for why a true ML model isn't included in this free, client-only
 * build.
 */

export const SOUND_PROFILES: Record<string, SoundProfile> = {
  none: { label: "Manual", settings: {} },
  podcastVoice: {
    label: "Podcast Voice",
    settings: {
      denoise: true,
      denoiseStrength: 0.5,
      reduceHum: true,
      compressor: true,
      compressorAmount: 0.5,
      limiter: true,
      eqLow: -2,
      eqMid: 1,
      eqHigh: 2,
      loudnessTarget: -16,
    },
  },
  cleanDialogue: {
    label: "Clean Dialogue",
    settings: {
      denoise: true,
      denoiseStrength: 0.65,
      reduceHum: true,
      deEss: true,
      deEssStrength: 0.4,
      compressor: true,
      compressorAmount: 0.4,
      noiseGate: true,
      gateThreshold: -45,
      loudnessTarget: -16,
    },
  },
  cinematicDialogue: {
    label: "Cinematic Dialogue",
    settings: {
      denoise: true,
      denoiseStrength: 0.35,
      compressor: true,
      compressorAmount: 0.3,
      reverb: 0.08,
      eqLow: 1,
      eqMid: 0,
      eqHigh: 1,
      loudnessTarget: -20,
    },
  },
  musicVideoSound: {
    label: "Music Video",
    settings: {
      compressor: true,
      compressorAmount: 0.6,
      limiter: true,
      eqLow: 3,
      eqHigh: 2,
      loudnessTarget: -14,
    },
  },
  socialVideo: {
    label: "Social Video",
    settings: {
      denoise: true,
      denoiseStrength: 0.4,
      compressor: true,
      compressorAmount: 0.55,
      limiter: true,
      eqMid: 1.5,
      eqHigh: 2.5,
      loudnessTarget: -13,
    },
  },
};

export const DEFAULT_AUDIO_SETTINGS: AudioChannelSettings = {
  dialogueVolume: 1,
  musicVolume: 0.4,
  denoise: false,
  denoiseStrength: 0.5,
  reduceHum: false,
  deEss: false,
  deEssStrength: 0.4,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  compressor: false,
  compressorAmount: 0.4,
  limiter: false,
  noiseGate: false,
  gateThreshold: -45,
  reverb: 0,
  loudnessTarget: -16,
  fadeIn: 0,
  fadeOut: 0,
  stereoMode: "stereo",
  profile: "none",
  musicFile: null,
  musicUrl: null,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Builds the ffmpeg audio filter chain for the dialogue/source track, in
 * the order a post-production engineer would apply them: clean up noise
 * first, then shape tone, then control dynamics, then set loudness.
 * `durationSec` is needed to place the fade-out at the right offset.
 */
export function buildAudioFilterChain(
  a: AudioChannelSettings,
  durationSec: number
): string {
  const parts: string[] = [];

  parts.push(`volume=${clamp(a.dialogueVolume, 0, 3).toFixed(3)}`);

  if (a.reduceHum) {
    parts.push("highpass=f=90");
  }

  if (a.denoise) {
    // afftdn's noise floor: stronger strength -> more aggressive (less
    // negative = larger reduction in ffmpeg's nf scale, so we invert).
    const nf = Math.round(-10 - clamp(a.denoiseStrength, 0, 1) * 30); // -10..-40
    parts.push(`afftdn=nf=${nf}`);
  }

  if (a.deEss) {
    const intensity = clamp(a.deEssStrength, 0, 1).toFixed(2);
    parts.push(`deesser=i=${intensity}`);
  }

  if (a.eqLow !== 0) {
    parts.push(`equalizer=f=120:t=q:w=1:g=${a.eqLow.toFixed(1)}`);
  }
  if (a.eqMid !== 0) {
    parts.push(`equalizer=f=1500:t=q:w=1.2:g=${a.eqMid.toFixed(1)}`);
  }
  if (a.eqHigh !== 0) {
    parts.push(`equalizer=f=8000:t=q:w=0.8:g=${a.eqHigh.toFixed(1)}`);
  }

  if (a.noiseGate) {
    const th = Math.pow(10, clamp(a.gateThreshold, -60, -10) / 20);
    parts.push(`agate=threshold=${th.toFixed(5)}:ratio=5:attack=5:release=80`);
  }

  if (a.compressor) {
    const amt = clamp(a.compressorAmount, 0, 1);
    const ratio = 2 + amt * 6; // 2:1 .. 8:1
    const threshold = (1 - amt * 0.5).toFixed(3); // softer input needed as amount rises isn't quite right, keep simple:
    parts.push(
      `acompressor=threshold=${(0.25 + (1 - amt) * 0.5).toFixed(3)}:ratio=${ratio.toFixed(1)}:attack=15:release=250:makeup=${(1 + amt).toFixed(2)}`
    );
    void threshold;
  }

  if (a.reverb > 0.02) {
    const decay = clamp(a.reverb, 0, 1);
    parts.push(
      `aecho=0.8:0.7:${Math.round(40 + decay * 100)}:${(0.15 + decay * 0.3).toFixed(2)}`
    );
  }

  if (a.fadeIn > 0.01) {
    parts.push(`afade=t=in:st=0:d=${a.fadeIn.toFixed(2)}`);
  }
  if (a.fadeOut > 0.01) {
    const st = Math.max(0, durationSec - a.fadeOut);
    parts.push(`afade=t=out:st=${st.toFixed(2)}:d=${a.fadeOut.toFixed(2)}`);
  }

  if (a.stereoMode === "mono") {
    parts.push("pan=mono|c0=0.5*c0+0.5*c1");
  }

  if (a.limiter) {
    parts.push("alimiter=limit=0.95:attack=5:release=50");
  }

  // Loudness normalization last, so everything upstream is measured together.
  parts.push(
    `loudnorm=I=${a.loudnessTarget}:TP=-1.5:LRA=11`
  );

  return parts.join(",");
}
