/**
 * Real, offline, in-browser speech-to-text.
 *
 * This runs an actual speech-recognition model (OpenAI's Whisper, tiny
 * multilingual version) entirely inside the visitor's own browser, via
 * WebAssembly — no server, no account, no API key, and nothing about your
 * footage is ever sent anywhere. The model (~45MB) and the WASM runtime that
 * executes it (~10MB) are served from this app's own origin (see
 * scripts/copy-whisper-assets.mjs) instead of a third-party CDN, for the same
 * reliability reason the ffmpeg engine is self-hosted.
 *
 * This is genuinely real: the text returned is what the model actually heard
 * in your actual audio, with real per-segment timestamps. Like any speech
 * model it can mishear words, especially with background noise, heavy
 * accents it wasn't trained on, or overlapping speech — it is not perfect
 * transcription, and the app does not claim it is.
 */
import type { Clip } from "../types";

export type TranscriptSegment = {
  text: string;
  start: number; // seconds, relative to the start of the clip's own audio
  end: number;
};

type ProgressInfo = {
  status: string;
  file?: string;
  progress?: number;
};

let pipelinePromise: Promise<unknown> | null = null;

async function getTranscriber(onProgress?: (info: ProgressInfo) => void) {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");

      // Self-hosted model + WASM runtime only — never fetch from
      // huggingface.co or a public CDN (see scripts/copy-whisper-assets.mjs).
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.localModelPath = "/models/";
      const wasmEnv = env.backends.onnx.wasm;
      if (!wasmEnv) throw new Error("ONNX Runtime WASM backend unavailable in this browser");
      wasmEnv.wasmPaths = {
        mjs: "/ort/ort-wasm-simd-threaded.asyncify.mjs",
        wasm: "/ort/ort-wasm-simd-threaded.asyncify.wasm",
      };
      // Single-threaded: avoids requiring cross-origin-isolation (COOP/COEP)
      // headers, which a plain static host doesn't send by default. Slower
      // than multi-threaded, but correct everywhere without extra server
      // configuration.
      wasmEnv.numThreads = 1;

      return pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
        progress_callback: onProgress,
      });
    })();
  }
  return pipelinePromise;
}

/**
 * Transcribes a clip's actual audio and returns real timestamped segments.
 * `onProgress` reports real model-loading progress on first use (the model
 * is cached by the browser after that) — not a fake progress bar.
 */
export async function transcribeClip(
  clip: Clip,
  onProgress?: (info: ProgressInfo) => void
): Promise<TranscriptSegment[]> {
  const transcriber = (await getTranscriber(onProgress)) as (
    input: string,
    options: Record<string, unknown>
  ) => Promise<{ chunks?: Array<{ text: string; timestamp: [number, number | null] }> }>;

  const result = await transcriber(clip.url, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  });

  const chunks = result.chunks ?? [];
  return chunks
    .map((c) => ({
      text: c.text.trim(),
      start: c.timestamp[0] ?? 0,
      end: c.timestamp[1] ?? c.timestamp[0] ?? 0,
    }))
    .filter((c) => c.text.length > 0);
}
