import type { Clip } from "../types";
import type { FrameSample } from "./colorGrade";

/**
 * Seeks a hidden <video> element to N evenly-spaced points across the
 * clip's trimmed range and reads back real decoded pixels via canvas —
 * actual frame data, not a placeholder. Used by Auto Grade's deterministic
 * histogram / gray-world analysis.
 */
export async function sampleFrames(clip: Clip, count = 5): Promise<FrameSample[]> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // Some browsers (and headless Chromium) are unreliable loading a blob
  // video that's never attached to the document. Keep it present but
  // invisible rather than fully detached.
  video.style.position = "fixed";
  video.style.width = "2px";
  video.style.height = "2px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  document.body.appendChild(video);

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        const err = video.error;
        reject(
          new Error(
            `Could not load video for analysis (code ${err?.code ?? "?"}: ${err?.message ?? "unknown"})`
          )
        );
      };
      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
      video.src = clip.url;
      video.load();
    });

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    const span = Math.max(0.1, clip.trimEnd - clip.trimStart);
    const samples: FrameSample[] = [];

    for (let i = 0; i < count; i++) {
      const t = clip.trimStart + (span * (i + 0.5)) / count;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = t;
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      samples.push({ width: canvas.width, height: canvas.height, data: imageData.data });
    }

    return samples;
  } finally {
    video.src = "";
    video.remove();
  }
}
