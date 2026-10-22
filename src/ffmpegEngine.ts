import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { Clip, TextOverlay, ColorGrade, AudioChannelSettings } from "./types";
import { buildColorFilterChain } from "./engine/colorGrade";
import { buildAudioFilterChain } from "./engine/audioStudio";
import { silenceDetectArgs, parseSilenceLog } from "./engine/silenceRemover";
import { computeKeptSegments } from "./engine/silenceRemover";

// Served from the app's own origin (copied into public/ffmpeg at build
// time by scripts/copy-ffmpeg-core.mjs) rather than fetched from a CDN —
// no third-party runtime dependency, works wherever the app itself works.
const CORE_BASE = "/ffmpeg";

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
let fontWritten = false;

export async function getEngine(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const instance = new FFmpeg();
    const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript");
    const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm");
    await instance.load({ coreURL, wasmURL });
    ffmpeg = instance;
    return instance;
  })();

  return loadingPromise;
}

// ffmpeg.wasm's virtual filesystem has no system fonts — unlike a native
// ffmpeg install, which finds one via fontconfig. drawtext fails with a
// filesystem error if it can't resolve a font file, so one has to be
// written into the virtual FS explicitly before any drawtext call.
const CAPTION_FONT_PATH = "/caption-font.ttf";

async function ensureFontLoaded(engine: FFmpeg): Promise<void> {
  if (fontWritten) return;
  const data = await fetchFile("/fonts/caption-font.ttf");
  await engine.writeFile(CAPTION_FONT_PATH, data);
  fontWritten = true;
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%")
    .replace(/\n/g, " ");
}

// ---------------------------------------------------------------------
// Silence detection: a real ffmpeg analysis pass (silencedetect filter),
// not a guess. Writes the clip, runs ffmpeg with -f null (no output file,
// just analysis), captures the real console log, returns it for parsing.
// ---------------------------------------------------------------------
export async function detectSilenceForClip(
  clip: Clip,
  thresholdDb: number,
  minSilenceDuration: number
): Promise<Array<{ start: number; end: number }>> {
  const engine = await getEngine();
  const inputName = `silence-probe-${clip.id}.mp4`;
  const data = await fetchFile(clip.file);
  await engine.writeFile(inputName, data);

  let fullLog = "";
  const onLog = ({ message }: { message: string }) => {
    fullLog += message + "\n";
  };
  engine.on("log", onLog);
  try {
    await engine.exec([
      "-i",
      inputName,
      "-af",
      silenceDetectArgs({
        mode: "balanced",
        thresholdDb,
        minSilenceDuration,
        padding: 0,
        minPreservedPause: 0,
      }),
      "-f",
      "null",
      "-",
    ]);
  } finally {
    engine.off("log", onLog);
    try {
      await engine.deleteFile(inputName);
    } catch {
      /* ignore */
    }
  }

  return parseSilenceLog(fullLog, clip.duration);
}

// ---------------------------------------------------------------------
// Exact-frame color preview: renders ONE real frame through the full
// export filter chain, so the user can check the true graded look
// (curves, vignette, grain — things CSS can't approximate) without
// waiting for a full export.
// ---------------------------------------------------------------------
export async function renderGradedFrame(
  clip: Clip,
  atSeconds: number,
  grade: ColorGrade
): Promise<string> {
  const engine = await getEngine();
  const inputName = `frame-src-${clip.id}.mp4`;
  const outputName = `frame-out-${clip.id}.png`;
  const data = await fetchFile(clip.file);
  await engine.writeFile(inputName, data);

  const chain = buildColorFilterChain(grade);
  const vf = chain ? `${chain}` : "null";

  try {
    await engine.exec([
      "-ss",
      atSeconds.toFixed(2),
      "-i",
      inputName,
      "-frames:v",
      "1",
      "-vf",
      vf,
      outputName,
    ]);
    const out = await engine.readFile(outputName);
    const blob = new Blob([out as unknown as BlobPart], { type: "image/png" });
    return URL.createObjectURL(blob);
  } finally {
    try {
      await engine.deleteFile(inputName);
    } catch {
      /* ignore */
    }
    try {
      await engine.deleteFile(outputName);
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------
// Audio analysis for the Sound Studio: a real waveform image (ffmpeg's
// showwavespic, drawn from the actual decoded samples) and a measured
// peak level (ffmpeg's volumedetect, run as a real analysis pass over the
// whole track — not a live meter, but an accurate one).
// ---------------------------------------------------------------------
export async function analyzeAudio(
  clip: Clip
): Promise<{ waveformUrl: string; peakDb: number }> {
  const engine = await getEngine();
  const inputName = `audio-probe-${clip.id}.mp4`;
  const waveName = `wave-${clip.id}.png`;
  const data = await fetchFile(clip.file);
  await engine.writeFile(inputName, data);

  let fullLog = "";
  const onLog = ({ message }: { message: string }) => {
    fullLog += message + "\n";
  };
  engine.on("log", onLog);

  try {
    await engine.exec([
      "-i",
      inputName,
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-",
    ]);

    await engine.exec([
      "-i",
      inputName,
      "-filter_complex",
      "showwavespic=s=800x120:colors=0xD6A45D",
      "-frames:v",
      "1",
      "-update",
      "1",
      waveName,
    ]);
    const waveData = await engine.readFile(waveName);
    const waveBlob = new Blob([waveData as unknown as BlobPart], { type: "image/png" });
    const waveformUrl = URL.createObjectURL(waveBlob);

    const match = /max_volume:\s*(-?[\d.]+)\s*dB/.exec(fullLog);
    const peakDb = match ? parseFloat(match[1]) : 0;

    return { waveformUrl, peakDb };
  } finally {
    engine.off("log", onLog);
    try {
      await engine.deleteFile(inputName);
    } catch {
      /* ignore */
    }
    try {
      await engine.deleteFile(waveName);
    } catch {
      /* ignore */
    }
  }
}

export type ExportOptions = {
  clips: Clip[];
  texts: TextOverlay[];
  color: ColorGrade;
  audio: AudioChannelSettings;
  width: number;
  height: number;
  fps: number;
  onProgress?: (ratio: number, phase: string) => void;
};

export async function exportTimeline(opts: ExportOptions): Promise<Blob> {
  const { clips, texts, color, audio, width, height, fps } = opts;
  if (clips.length === 0) throw new Error("No clips to export");

  const engine = await getEngine();
  opts.onProgress?.(0.05, "Engine ready");

  const onProgressEvent = ({ progress }: { progress: number }) => {
    const p = Math.min(Math.max(progress, 0), 1);
    opts.onProgress?.(0.3 + p * 0.6, "Rendering");
  };
  engine.on("progress", onProgressEvent);

  const inputNames: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const name = `in${i}.mp4`;
    const data = await fetchFile(clips[i].file);
    await engine.writeFile(name, data);
    inputNames.push(name);
  }
  opts.onProgress?.(0.2, "Clips loaded");

  let musicName: string | null = null;
  if (audio.musicFile) {
    musicName = "music_in";
    const data = await fetchFile(audio.musicFile);
    await engine.writeFile(musicName, data);
  }

  // Build per-clip kept segments (trim window minus any active silence cuts).
  const filters: string[] = [];
  const vLabels: string[] = [];
  const aLabels: string[] = [];
  let segIndex = 0;
  let totalKeptDuration = 0;

  clips.forEach((clip, clipIdx) => {
    const segments = computeKeptSegments(clip.trimStart, clip.trimEnd, clip.silenceCuts);
    const toUse = segments.length > 0 ? segments : [{ start: clip.trimStart, end: clip.trimEnd }];

    for (const seg of toUse) {
      const vLab = `v${segIndex}`;
      const aLab = `a${segIndex}`;
      const start = Math.max(0, seg.start);
      const end = Math.max(start + 0.05, seg.end);
      totalKeptDuration += end - start;
      filters.push(
        `[${clipIdx}:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,` +
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setsar=1[${vLab}]`
      );
      filters.push(
        `[${clipIdx}:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,` +
          `aresample=48000[${aLab}]`
      );
      vLabels.push(`[${vLab}]`);
      aLabels.push(`[${aLab}]`);
      segIndex++;
    }
  });

  const n = segIndex;
  // ffmpeg's concat filter expects inputs interleaved per segment —
  // [v0][a0][v1][a1]... — NOT grouped by stream type. Grouping them (as an
  // earlier version of this file did) produces "Media type mismatch"
  // errors from ffmpeg as soon as there's more than one segment, which
  // real multi-clip/multi-cut exports always have.
  const interleaved: string[] = [];
  for (let i = 0; i < n; i++) {
    interleaved.push(vLabels[i], aLabels[i]);
  }
  filters.push(`${interleaved.join("")}concat=n=${n}:v=1:a=1[vcat][acat]`);

  // Color grade (real ffmpeg filter chain — identical to the exact-frame preview).
  let lastV = "vcat";
  const colorChain = buildColorFilterChain(color);
  if (colorChain) {
    filters.push(`[vcat]${colorChain}[vcolor]`);
    lastV = "vcolor";
  }

  // Text overlays, chained. Requires a font written into the virtual FS —
  // see ensureFontLoaded above.
  if (texts.length > 0) {
    await ensureFontLoaded(engine);
  }
  texts.forEach((t, i) => {
    const out = `vtxt${i}`;
    const safe = escapeDrawtext(t.text || " ");
    const x = `(w*${(t.x / 100).toFixed(4)})-text_w/2`;
    const y = `(h*${(t.y / 100).toFixed(4)})-text_h/2`;
    filters.push(
      `[${lastV}]drawtext=fontfile=${CAPTION_FONT_PATH}:text='${safe}':fontcolor=${t.color.replace("#", "0x")}:fontsize=${t.fontSize}:` +
        `x=${x}:y=${y}:enable='between(t,${t.start},${t.end})':box=1:boxcolor=0x00000066:boxborderw=10[${out}]`
    );
    lastV = out;
  });

  // Real audio post-production chain.
  const audioChain = buildAudioFilterChain(audio, totalKeptDuration);
  filters.push(`[acat]${audioChain}[adialogue]`);
  let finalAudioLabel = "adialogue";

  if (musicName) {
    const musicIdx = clips.length;
    filters.push(
      `[${musicIdx}:a]volume=${audio.musicVolume}:eval=once,aloop=loop=-1:size=2147483647,aresample=48000[mloop]`
    );
    filters.push(
      `[${finalAudioLabel}][mloop]amix=inputs=2:duration=first:dropout_transition=2[amixout]`
    );
    finalAudioLabel = "amixout";
  }

  const filterComplex = filters.join(";");

  const args: string[] = [];
  inputNames.forEach((name) => {
    args.push("-i", name);
  });
  if (musicName) {
    args.push("-i", musicName);
  }
  args.push(
    "-filter_complex",
    filterComplex,
    "-map",
    `[${lastV}]`,
    "-map",
    `[${finalAudioLabel}]`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "out.mp4"
  );

  opts.onProgress?.(0.3, "Rendering");
  try {
    await engine.exec(args);
  } finally {
    engine.off("progress", onProgressEvent);
  }
  opts.onProgress?.(0.97, "Finalizing");

  const data = await engine.readFile("out.mp4");
  const blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });

  for (const name of inputNames) {
    try {
      await engine.deleteFile(name);
    } catch {
      /* ignore */
    }
  }
  if (musicName) {
    try {
      await engine.deleteFile(musicName);
    } catch {
      /* ignore */
    }
  }
  try {
    await engine.deleteFile("out.mp4");
  } catch {
    /* ignore */
  }

  opts.onProgress?.(1, "Done");
  return blob;
}
