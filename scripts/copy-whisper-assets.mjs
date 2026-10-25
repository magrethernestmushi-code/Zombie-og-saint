// Copies the self-hosted speech-recognition model and its WASM runtime into
// public/ at build time, the same self-hosting strategy used for ffmpeg-core
// (scripts/copy-ffmpeg-core.mjs) and for the same reason: no third-party CDN
// dependency at runtime, and it works in locked-down network environments.
//
// - Model weights (Whisper-tiny, ONNX format) come from the npm package
//   "sts-whisper-tiny", a straight, unmodified mirror of the public
//   Xenova/whisper-tiny model (verified against the model's own config.json
//   before being added as a dependency here) — published to npm specifically
//   so it can be installed like any other package instead of fetched from
//   huggingface.co at install or run time.
// - The ONNX Runtime WASM binary comes straight from the onnxruntime-web
//   package already installed as a dependency of @huggingface/transformers.
import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "..");

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Whisper-tiny model files.
const modelSrc = path.join(
  projectRoot,
  "node_modules/sts-whisper-tiny/models/Xenova/whisper-tiny"
);
const modelDest = path.join(projectRoot, "public/models/Xenova/whisper-tiny");
if (!existsSync(modelSrc)) {
  console.error("[copy-whisper-assets] sts-whisper-tiny model files not found — run npm install first.");
  process.exit(1);
}
copyDir(modelSrc, modelDest);

// 2. ONNX Runtime WASM binary (asyncify build — broadest browser support,
// avoids needing SharedArrayBuffer / cross-origin-isolation headers).
const ortSrc = path.join(projectRoot, "node_modules/onnxruntime-web/dist");
const ortDest = path.join(projectRoot, "public/ort");
mkdirSync(ortDest, { recursive: true });
for (const file of [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
]) {
  const from = path.join(ortSrc, file);
  if (!existsSync(from)) {
    console.error(`[copy-whisper-assets] missing ${file} in onnxruntime-web/dist`);
    process.exit(1);
  }
  copyFileSync(from, path.join(ortDest, file));
}

console.log("[copy-whisper-assets] Copied Whisper-tiny model + ONNX Runtime WASM into public/");
