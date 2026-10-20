export type Clip = {
  id: string;
  file: File;
  url: string;
  name: string;
  duration: number; // full source duration (seconds)
  trimStart: number; // seconds into source
  trimEnd: number; // seconds into source
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

export type ColorSettings = {
  brightness: number; // -1 .. 1 (0 = none)
  contrast: number; // 0 .. 2 (1 = none)
  saturation: number; // 0 .. 3 (1 = none)
  gamma: number; // 0.1 .. 3 (1 = none)
  preset: string;
};

export type AudioSettings = {
  volume: number; // 0 .. 2 (1 = none)
  denoise: boolean;
  musicFile: File | null;
  musicUrl: string | null;
  musicVolume: number; // 0 .. 1
};

export type ExportState = {
  phase: "idle" | "loading-engine" | "processing" | "done" | "error";
  progress: number; // 0..1
  message: string;
  outputUrl: string | null;
};

export const COLOR_PRESETS: Record<
  string,
  Omit<ColorSettings, "preset">
> = {
  none: { brightness: 0, contrast: 1, saturation: 1, gamma: 1 },
  vivid: { brightness: 0.03, contrast: 1.18, saturation: 1.35, gamma: 1.05 },
  cinematic: { brightness: -0.03, contrast: 1.25, saturation: 0.85, gamma: 0.95 },
  warm: { brightness: 0.02, contrast: 1.08, saturation: 1.15, gamma: 1.1 },
  cool: { brightness: 0.0, contrast: 1.1, saturation: 0.95, gamma: 0.92 },
  mono: { brightness: 0.0, contrast: 1.15, saturation: 0.0, gamma: 1.0 },
};
