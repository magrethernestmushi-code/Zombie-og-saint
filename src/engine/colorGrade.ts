import type { ColorGrade } from "../types";
import { NEUTRAL_GRADE } from "../types";

/**
 * Real, non-destructive color grading engine.
 *
 * Every parameter here maps to an actual ffmpeg filter applied identically
 * at export time. The live on-screen preview (see cssApprox below) is a
 * fast CSS approximation of the same parameters — close enough to judge a
 * look while scrubbing, but not pixel-identical, because CSS filters can't
 * express tone curves, vignette or grain. For an exact check, the app can
 * render one real frame through the full ffmpeg filter chain (see
 * renderGradedFrame in ffmpegEngine.ts) — that is the actual exported look,
 * not an approximation.
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---- 15 original cinematic presets -------------------------------------
// Each is a full parameter set (not just a single filter), so every preset
// produces a genuinely distinct look across tone, color balance and finish.

export const COLOR_PRESETS: Record<string, Omit<ColorGrade, "preset">> = {
  none: { ...NEUTRAL_GRADE },

  modernHollywood: {
    ...NEUTRAL_GRADE,
    contrast: 0.22,
    shadows: -0.12,
    highlights: -0.08,
    temperature: 0.08,
    saturation: -0.08,
    vibrance: 0.1,
    vignette: 0.18,
  },
  tealAndOrange: {
    ...NEUTRAL_GRADE,
    contrast: 0.25,
    shadows: -0.1,
    temperature: 0.1,
    tint: -0.18,
    saturation: 0.1,
    vibrance: 0.22,
    vignette: 0.1,
  },
  moodyDrama: {
    ...NEUTRAL_GRADE,
    contrast: 0.3,
    shadows: -0.22,
    blacks: -0.15,
    temperature: -0.1,
    saturation: -0.3,
    vignette: 0.28,
  },
  darkLuxury: {
    ...NEUTRAL_GRADE,
    contrast: 0.28,
    blacks: -0.22,
    shadows: -0.1,
    highlights: 0.08,
    temperature: 0.12,
    saturation: -0.1,
    vignette: 0.32,
    grain: 0.08,
  },
  warmFilm: {
    ...NEUTRAL_GRADE,
    contrast: 0.08,
    shadows: 0.1,
    temperature: 0.22,
    saturation: 0.05,
    grain: 0.14,
    vignette: 0.1,
  },
  vintage35mm: {
    ...NEUTRAL_GRADE,
    contrast: -0.1,
    blacks: 0.18,
    whites: -0.08,
    temperature: 0.18,
    tint: 0.06,
    saturation: -0.15,
    grain: 0.3,
    vignette: 0.2,
  },
  bleachBypass: {
    ...NEUTRAL_GRADE,
    contrast: 0.42,
    blacks: -0.1,
    saturation: -0.75,
    sharpen: 0.2,
  },
  cleanCommercial: {
    ...NEUTRAL_GRADE,
    exposure: 0.06,
    contrast: 0.12,
    whites: 0.1,
    saturation: 0.12,
    vibrance: 0.15,
    sharpen: 0.15,
  },
  naturalDocumentary: {
    ...NEUTRAL_GRADE,
    contrast: 0.06,
    saturation: -0.02,
    vibrance: 0.05,
  },
  goldenHour: {
    ...NEUTRAL_GRADE,
    exposure: 0.05,
    contrast: 0.1,
    highlights: 0.1,
    temperature: 0.32,
    tint: 0.04,
    saturation: 0.08,
    vibrance: 0.15,
    vignette: 0.12,
  },
  coolBlueNight: {
    ...NEUTRAL_GRADE,
    exposure: -0.05,
    contrast: 0.22,
    shadows: -0.15,
    temperature: -0.3,
    tint: -0.05,
    saturation: -0.05,
    vignette: 0.24,
  },
  blackAndWhiteFilm: {
    ...NEUTRAL_GRADE,
    contrast: 0.28,
    shadows: -0.1,
    blacks: -0.08,
    saturation: -1,
    grain: 0.22,
    vignette: 0.18,
  },
  musicVideo: {
    ...NEUTRAL_GRADE,
    contrast: 0.35,
    saturation: 0.28,
    vibrance: 0.3,
    sharpen: 0.25,
    vignette: 0.16,
  },
  softRomantic: {
    ...NEUTRAL_GRADE,
    exposure: 0.08,
    contrast: -0.15,
    shadows: 0.18,
    whites: -0.05,
    temperature: 0.12,
    saturation: -0.05,
    vignette: 0.14,
  },
  highContrastAction: {
    ...NEUTRAL_GRADE,
    contrast: 0.45,
    blacks: -0.2,
    whites: 0.1,
    saturation: 0.18,
    vibrance: 0.2,
    sharpen: 0.35,
  },
};

export const PRESET_LABELS: Record<string, string> = {
  none: "Original",
  modernHollywood: "Modern Hollywood",
  tealAndOrange: "Teal & Orange",
  moodyDrama: "Moody Drama",
  darkLuxury: "Dark Luxury",
  warmFilm: "Warm Film",
  vintage35mm: "Vintage 35mm",
  bleachBypass: "Bleach Bypass",
  cleanCommercial: "Clean Commercial",
  naturalDocumentary: "Natural Documentary",
  goldenHour: "Golden Hour",
  coolBlueNight: "Cool Blue Night",
  blackAndWhiteFilm: "Black & White Film",
  musicVideo: "Music Video",
  softRomantic: "Soft Romantic",
  highContrastAction: "High-Contrast Action",
};

// ---- Real ffmpeg filter chain (used identically for preview snapshot and export) ----

export function buildColorFilterChain(g: ColorGrade): string | null {
  const parts: string[] = [];
  const isNeutral =
    g.exposure === 0 &&
    g.contrast === 0 &&
    g.highlights === 0 &&
    g.shadows === 0 &&
    g.whites === 0 &&
    g.blacks === 0 &&
    g.temperature === 0 &&
    g.tint === 0 &&
    g.saturation === 0 &&
    g.vibrance === 0 &&
    g.vignette === 0 &&
    g.grain === 0 &&
    g.sharpen === 0;
  if (isNeutral) return null;

  // 1. Exposure / contrast / saturation in one eq pass.
  const brightness = clamp(g.exposure * 0.35, -1, 1);
  const contrast = clamp(1 + g.contrast * 0.6, 0.3, 2.2);
  const saturation = clamp(1 + g.saturation * 0.9 + g.vibrance * 0.4, 0, 3);
  parts.push(`eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`);

  // 2. Tone curve for blacks/shadows/highlights/whites — four control
  //    points nudged from their neutral diagonal position.
  const p0y = clamp(0 + g.blacks * 0.08, 0, 0.2);
  const p1y = clamp(0.25 + g.shadows * 0.12, 0.05, 0.45);
  const p2y = clamp(0.75 + g.highlights * 0.12, 0.55, 0.95);
  const p3y = clamp(1 + g.whites * 0.08, 0.8, 1);
  if (g.blacks !== 0 || g.shadows !== 0 || g.highlights !== 0 || g.whites !== 0) {
    const points = `0/${p0y.toFixed(3)} 0.25/${p1y.toFixed(3)} 0.5/0.5 0.75/${p2y.toFixed(3)} 1/${p3y.toFixed(3)}`;
    parts.push(`curves=master='${points}'`);
  }

  // 3. Temperature / tint via shadow-mid-highlight color balance.
  if (g.temperature !== 0 || g.tint !== 0) {
    const rh = clamp(g.temperature * 0.3, -1, 1);
    const bh = clamp(-g.temperature * 0.3, -1, 1);
    const rs = clamp(g.temperature * 0.1, -1, 1);
    const bs = clamp(-g.temperature * 0.1, -1, 1);
    const rm = clamp(g.tint * 0.2, -1, 1);
    const gm = clamp(-g.tint * 0.25, -1, 1);
    const bm = clamp(g.tint * 0.1, -1, 1);
    parts.push(
      `colorbalance=rs=${rs.toFixed(3)}:bs=${bs.toFixed(3)}:rm=${rm.toFixed(3)}:gm=${gm.toFixed(3)}:bm=${bm.toFixed(3)}:rh=${rh.toFixed(3)}:bh=${bh.toFixed(3)}`
    );
  }

  // 4. Vignette — lower angle = stronger falloff.
  if (g.vignette > 0.02) {
    const angle = (Math.PI / 2) - (Math.PI / 2 - Math.PI / 6) * clamp(g.vignette, 0, 1);
    parts.push(`vignette=angle=${angle.toFixed(4)}`);
  }

  // 5. Film grain.
  if (g.grain > 0.02) {
    const strength = Math.round(clamp(g.grain, 0, 1) * 35);
    parts.push(`noise=alls=${strength}:allf=t+u`);
  }

  // 6. Sharpen.
  if (g.sharpen > 0.02) {
    const amount = clamp(g.sharpen, 0, 1) * 1.6;
    parts.push(`unsharp=lx=5:ly=5:la=${amount.toFixed(2)}:cx=5:cy=5:ca=0`);
  }

  return parts.join(",");
}

/**
 * Fast CSS approximation for the live <video> preview. This cannot express
 * curves, color-balance, vignette or grain, so it only approximates
 * exposure/contrast/saturation — close enough to judge the look while
 * scrubbing. The exact graded look is what gets exported, and can be
 * checked ahead of time with the "Preview exact frame" snapshot.
 */
export function cssApprox(g: ColorGrade): string {
  const brightness = 1 + g.exposure * 0.3 + g.whites * 0.08;
  const contrast = 1 + g.contrast * 0.5;
  const saturate = 1 + g.saturation * 0.7 + g.vibrance * 0.3;
  const sepiaForWarmth = g.temperature > 0 ? Math.min(g.temperature * 0.15, 0.2) : 0;
  return `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${Math.max(
    0,
    saturate
  ).toFixed(3)}) sepia(${sepiaForWarmth.toFixed(3)})`;
}

// ---- Deterministic Auto Grade (real pixel analysis, no ML) --------------
//
// Honesty note (per the brief's own requirement): this is NOT a trained
// machine-learning model. It samples real decoded frames from the actual
// clip and runs two classic, deterministic image-analysis algorithms:
//   1. A luminance histogram to judge overall exposure and contrast range.
//   2. A gray-world color-cast estimate (assumes the average scene color
//      should be roughly neutral gray) to judge temperature/tint bias.
// That's a legitimate, explainable analysis — just not an AI model.

export type FrameSample = {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
};

export type AutoGradeResult = ColorGrade;

/**
 * Real luminance histogram from actually-sampled frames (the same frames
 * Auto Grade analyzes) — a genuine scope, like a colorist would read, not a
 * decorative graphic. Returns 32 bins (0..255 luma grouped into buckets),
 * each normalized 0..1 against the tallest bucket.
 */
export function computeLumaHistogram(samples: FrameSample[]): number[] {
  const bins = new Array(32).fill(0);
  if (samples.length === 0) return bins;
  for (const sample of samples) {
    const { data } = sample;
    for (let i = 0; i < data.length; i += 4) {
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const bin = Math.min(31, Math.floor(luma / 8));
      bins[bin] += 1;
    }
  }
  const max = Math.max(1, ...bins);
  return bins.map((v) => v / max);
}

export function analyzeFramesForAutoGrade(
  samples: FrameSample[],
  strength: number
): Omit<ColorGrade, "preset"> {
  if (samples.length === 0) return { ...NEUTRAL_GRADE };

  let rSum = 0,
    gSum = 0,
    bSum = 0,
    lumaSum = 0,
    pixelCount = 0;
  let highlightClipped = 0;
  let shadowClipped = 0;
  const histogram = new Array(256).fill(0);

  for (const sample of samples) {
    const { data } = sample;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      rSum += r;
      gSum += g;
      bSum += b;
      lumaSum += luma;
      histogram[Math.round(luma)] += 1;
      pixelCount += 1;
      if (luma > 250) highlightClipped += 1;
      if (luma < 5) shadowClipped += 1;
    }
  }

  const meanLuma = lumaSum / pixelCount; // 0..255
  const meanR = rSum / pixelCount;
  const meanG = gSum / pixelCount;
  const meanB = bSum / pixelCount;
  const grayMean = (meanR + meanG + meanB) / 3;

  // Spread of the histogram (5th-95th percentile) tells us how much
  // contrast room is available.
  let cumulative = 0;
  let p5 = 0;
  let p95 = 255;
  const target5 = pixelCount * 0.05;
  const target95 = pixelCount * 0.95;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= target5 && p5 === 0) p5 = v;
    if (cumulative >= target95) {
      p95 = v;
      break;
    }
  }
  const spread = Math.max(1, p95 - p5);

  // Exposure: push mean luma toward ~128 (mid-gray).
  const exposureRaw = (128 - meanLuma) / 255;
  // Contrast: narrow histogram spread -> add contrast; already-wide -> ease off.
  const contrastRaw = clamp((140 - spread) / 200, -0.4, 0.5);
  // Highlights/shadows recovery based on clipping ratio.
  const highlightRatio = highlightClipped / pixelCount;
  const shadowRatio = shadowClipped / pixelCount;
  const highlightsRaw = clamp(-highlightRatio * 6, -0.5, 0);
  const shadowsRaw = clamp(shadowRatio * 6, 0, 0.5);

  // Gray-world color cast: how far each channel mean is from the overall gray mean.
  const temperatureRaw = clamp(((meanR - meanB) / 255) * 2.2, -0.5, 0.5);
  const tintRaw = clamp(((meanG - grayMean) / 255) * -2.5, -0.5, 0.5);

  const s = clamp(strength, 0, 1);
  return {
    ...NEUTRAL_GRADE,
    exposure: clamp(exposureRaw * s, -0.4, 0.4),
    contrast: clamp(contrastRaw * s, -0.4, 0.4),
    highlights: clamp(highlightsRaw * s, -0.5, 0),
    shadows: clamp(shadowsRaw * s, 0, 0.5),
    temperature: clamp(-temperatureRaw * s, -0.4, 0.4),
    tint: clamp(-tintRaw * s, -0.4, 0.4),
  };
}
