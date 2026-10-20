import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { Clip, TextOverlay, ColorSettings, AudioSettings } from "./types";

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

export async function getEngine(
  onLog?: (msg: string) => void
): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const instance = new FFmpeg();
    if (onLog) {
      instance.on("log", ({ message }) => onLog(message));
    }
    const coreURL = await toBlobURL(
      `${CORE_BASE}/ffmpeg-core.js`,
      "text/javascript"
    );
    const wasmURL = await toBlobURL(
      `${CORE_BASE}/ffmpeg-core.wasm`,
      "application/wasm"
    );
    await instance.load({ coreURL, wasmURL });
    ffmpeg = instance;
    return instance;
  })();

  return loadingPromise;
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%")
    .replace(/\n/g, " ");
}

export type ExportOptions = {
  clips: Clip[];
  texts: TextOverlay[];
  color: ColorSettings;
  audio: AudioSettings;
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

  engine.on("progress", ({ progress }) => {
    const p = Math.min(Math.max(progress, 0), 1);
    opts.onProgress?.(0.3 + p * 0.65, "Rendering");
  });

  // Write inputs
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

  // Build filter_complex
  const filters: string[] = [];
  const vLabels: string[] = [];
  const aLabels: string[] = [];

  clips.forEach((clip, i) => {
    const vLab = `v${i}`;
    const aLab = `a${i}`;
    const start = Math.max(0, clip.trimStart);
    const end = Math.max(start + 0.05, clip.trimEnd);
    filters.push(
      `[${i}:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,` +
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setsar=1[${vLab}]`
    );
    filters.push(
      `[${i}:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,` +
        `aresample=48000[${aLab}]`
    );
    vLabels.push(`[${vLab}]`);
    aLabels.push(`[${aLab}]`);
  });

  const n = clips.length;
  filters.push(
    `${vLabels.join("")}${aLabels.join("")}concat=n=${n}:v=1:a=1[vcat][acat]`
  );

  // Color grade
  const eq = `eq=brightness=${color.brightness}:contrast=${color.contrast}:saturation=${color.saturation}:gamma=${color.gamma}`;
  filters.push(`[vcat]${eq}[vcolor]`);

  // Text overlays, chained
  let lastV = "vcolor";
  texts.forEach((t, i) => {
    const out = `vtxt${i}`;
    const safe = escapeDrawtext(t.text || " ");
    const x = `(w*${(t.x / 100).toFixed(4)})-text_w/2`;
    const y = `(h*${(t.y / 100).toFixed(4)})-text_h/2`;
    filters.push(
      `[${lastV}]drawtext=text='${safe}':fontcolor=${t.color.replace(
        "#",
        "0x"
      )}:fontsize=${t.fontSize}:x=${x}:y=${y}:` +
        `enable='between(t,${t.start},${t.end})':box=1:boxcolor=0x00000066:boxborderw=10[${out}]`
    );
    lastV = out;
  });

  // Audio chain: volume -> denoise -> mix with music
  let lastA = "acat";
  filters.push(`[${lastA}]volume=${audio.volume}[avol]`);
  lastA = "avol";
  if (audio.denoise) {
    filters.push(`[${lastA}]afftdn=nf=-25[aden]`);
    lastA = "aden";
  }

  let finalAudioLabel = lastA;

  if (musicName) {
    const musicIdx = clips.length; // input index for music
    filters.push(
      `[${musicIdx}:a]volume=${audio.musicVolume},aloop=loop=-1:size=2147483647,` +
        `aresample=48000[mloop]`
    );
    filters.push(
      `[${lastA}][mloop]amix=inputs=2:duration=first:dropout_transition=2[amixout]`
    );
    finalAudioLabel = "amixout";
  }

  const filterComplex = filters.join(";");

  const args = ["-i", "placeholder"]; // replaced below
  args.length = 0;
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
  await engine.exec(args);
  opts.onProgress?.(0.97, "Finalizing");

  const data = await engine.readFile("out.mp4");
  const blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });

  // cleanup
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
