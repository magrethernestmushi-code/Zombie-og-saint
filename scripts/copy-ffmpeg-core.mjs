// Copies the ffmpeg-core WebAssembly build into public/ so it's served
// from the app's own origin at runtime, instead of fetched from a
// third-party CDN. This avoids an external dependency at runtime (no CDN
// outage risk, no cross-origin fetch) and lets the app work in network
// environments that only allow same-origin / package-manager traffic.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const srcDir = join(root, "node_modules", "@ffmpeg", "core", "dist", "esm");
const destDir = join(root, "public", "ffmpeg");

if (!existsSync(srcDir)) {
  console.error(
    `[copy-ffmpeg-core] Could not find ${srcDir}. Run "npm install" first.`
  );
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });

for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFileSync(join(srcDir, file), join(destDir, file));
}

console.log(`[copy-ffmpeg-core] Copied ffmpeg-core into ${destDir}`);
