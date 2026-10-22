export type Clip = {
  id: string;
  file: File;
  url: string;
  name: string;
  duration: number; // full source duration (seconds)
  trimStart: number; // seconds into source
  trimEnd: number; // seconds into source
  /** Regions within [trimStart, trimEnd] that the Silence Remover proposed cutting. */
  silenceCuts: SilenceCut[];
};

export type SilenceCut = {
  id: string;
  start: number; // seconds into the source file
  end: number;
  restored: boolean; // true = user restored it, keep this audio/video
};

export type TextOverlay = {
  id: string;
  text: string;
  start: number; // seconds on the merged timeline
  end: number;
  x: number; // 0-100 percent
  y: number; // 0-100 percent
  color: string;
  fontSize: number; // px at 1080-wide reference
};

/**
 * Full non-destructive color grade parameter set. Values are stored once and
 * applied identically to the ffmpeg export filter chain and (as a fast
 * approximation) to the live CSS preview. See engine/colorGrade.ts.
 */
export type ColorGrade = {
  preset: string;
  exposure: number; // -1..1
  contrast: number; // -1..1
  highlights: number; // -1..1 (negative = recover/darken highlights)
  shadows: number; // -1..1 (positive = lift shadows)
  whites: number; // -1..1
  blacks: number; // -1..1
  temperature: number; // -1 (cool/blue) .. 1 (warm/orange)
  tint: number; // -1 (green) .. 1 (magenta)
  saturation: number; // -1..1
  vibrance: number; // -1..1
  vignette: number; // 0..1
  grain: number; // 0..1
  sharpen: number; // 0..1
};

export const NEUTRAL_GRADE: Omit<ColorGrade, "preset"> = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  vignette: 0,
  grain: 0,
  sharpen: 0,
};

export type AudioChannelSettings = {
  dialogueVolume: number; // 0..2
  musicVolume: number; // 0..1
  denoise: boolean;
  denoiseStrength: number; // 0..1
  reduceHum: boolean;
  deEss: boolean;
  deEssStrength: number; // 0..1
  eqLow: number; // -12..12 dB
  eqMid: number; // -12..12 dB
  eqHigh: number; // -12..12 dB
  compressor: boolean;
  compressorAmount: number; // 0..1
  limiter: boolean;
  noiseGate: boolean;
  gateThreshold: number; // -60..-10 dB
  reverb: number; // 0..1 (light echo-based approximation)
  loudnessTarget: number; // LUFS, e.g. -16 (streaming), -14 (social), -23 (broadcast)
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  stereoMode: "stereo" | "mono";
  profile: string;
  musicFile: File | null;
  musicUrl: string | null;
};

export type SoundProfile = {
  label: string;
  settings: Partial<AudioChannelSettings>;
};

export type SilenceMode = "gentle" | "balanced" | "aggressive";

export type SilenceSettings = {
  mode: SilenceMode;
  thresholdDb: number; // e.g. -30
  minSilenceDuration: number; // seconds
  padding: number; // seconds kept before/after each cut
  minPreservedPause: number; // seconds — pauses shorter than this are never cut
};

export type ExportState = {
  phase: "idle" | "loading-engine" | "processing" | "done" | "error";
  progress: number; // 0..1
  message: string;
  outputUrl: string | null;
};
