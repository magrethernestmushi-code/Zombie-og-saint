# Edmund Og Saint

A free, browser-based cinematic video editor: multi-clip timeline editing,
real color grading, a producer-style audio mixer, and real silence
detection — all rendered on your own device with
[ffmpeg.wasm](https://ffmpegwasm.netlify.app/). No upload, no account, no
server costs, no watermark. Works on phone and desktop browsers.

This README is deliberately specific about what's real and what's a
deliberate simplification, because it's easy to overclaim with AI-adjacent
video tools. Every feature below actually runs the processing it describes
— there are no simulated results or hardcoded "success" messages anywhere
in this app. Where something isn't a trained AI model, it says so.

## What it does, and how

### Color Lab
- 15 original cinematic presets (Modern Hollywood, Teal & Orange, Moody
  Drama, Dark Luxury, Warm Film, Vintage 35mm, Bleach Bypass, Clean
  Commercial, Natural Documentary, Golden Hour, Cool Blue Night, Black &
  White Film, Music Video, Soft Romantic, High-Contrast Action) — each is a
  distinct set of exposure/contrast/curve/color-balance/vignette/grain
  values, not just a single filter.
- Manual controls: exposure, contrast, highlights, shadows, whites, blacks,
  temperature, tint, saturation, vibrance, vignette, film grain, sharpen.
  All of it maps to a real ffmpeg filter chain (`eq`, `curves`,
  `colorbalance`, `vignette`, `noise`, `unsharp`) applied identically in
  preview and export.
- **Auto Grade** samples real frames from your actual clip and runs two
  classic, deterministic image-analysis algorithms — a luminance histogram
  (for exposure/contrast) and gray-world color-cast estimation (for
  temperature/tint). **This is not a trained AI/ML model** — it's honest,
  explainable image analysis, and the app says so in the UI.
- The live viewfinder is a fast CSS approximation (it can't express tone
  curves or vignette/grain). "Preview exact frame" renders one real frame
  through the full export filter chain so you can check the actual graded
  look before exporting.

### Sound Studio
- Real ffmpeg audio filters, not a volume slider pretending to be a mixer:
  `afftdn` (FFT noise reduction), `highpass` (hum/rumble), `deesser`,
  3-band `equalizer`, `acompressor`, `alimiter`, `agate` (noise gate),
  `aecho` (light reverb approximation — ffmpeg has no true convolution
  reverb), `afade`, `loudnorm` (loudness normalization to a chosen LUFS
  target), mono downmix, background music mixing with its own volume.
- Sound profiles (Podcast Voice, Clean Dialogue, Cinematic Dialogue, Music
  Video, Social Video) are just sensible starting parameter sets for the
  same real filters above.
- Waveform display and peak-level reading are measured from the actual
  decoded audio (`showwavespic` and `volumedetect`), not illustrative.

### Silence Remover
- Runs ffmpeg's real `silencedetect` filter against the actual audio track,
  not a guess. Proposes a cut list with configurable threshold, minimum
  silence duration, padding, and a minimum-preserved-pause floor so short
  natural pauses are never touched.
- Gentle / Balanced / Aggressive modes are threshold presets.
- Every cut is shown with its timestamp and can be individually restored
  before export; nothing is deleted until you export. The timeline and the
  live preview both reflect active cuts immediately, so what you see is
  what you'll get.

### Real offline captions
- A real speech-recognition model (OpenAI's Whisper, tiny multilingual
  version) runs entirely inside your browser via WebAssembly — no server, no
  account, no API key, nothing about your footage ever leaves your device.
  The model (~45MB) and the runtime that executes it (~10MB effective
  download) are served from this app's own origin, the same self-hosting
  approach as the ffmpeg engine, so it works offline after first load.
- Click **Auto-generate captions from audio** (Edit room) and it transcribes
  the clip's actual audio and places real, timed caption text on the
  timeline. Like any speech model it can mishear words — background noise,
  accents it wasn't trained on, and overlapping speech all reduce accuracy —
  so review before exporting. It does not invent captions for silence.

### Auto Edit — one click
- Chains the real engines above: detects and removes silence, auto-grades
  the color from the clip's own frames, applies a sensible audio cleanup
  profile, and generates real captions — one button, run on the active
  clip. Each stage is the same real processing described above, just
  triggered together instead of one at a time. Review the result (every
  silence cut, color value and caption is still editable) before exporting.

### Command bar — free, no API key
- A text box that recognizes a fixed set of common editing phrases
  ("remove the silence", "make it warmer", "add captions", "cinematic
  look", "clean up the audio"...) and runs the matching real action. This
  is honestly a keyword/phrase matcher, not a language model — type
  something it doesn't recognize and it says so, rather than guessing or
  pretending to understand. The full list of recognized phrases is shown
  in the bar itself. True open-ended natural-language instructions would
  need a real AI model, which can't run for free in a browser tab (see
  below).

### Timeline & export
- Multi-clip import, trim in/out per clip, reorder, remove, text/caption
  overlays (positioned, timed, colored), real thumbnail frames on every
  clip card.
- Export renders one MP4 (1080×1920, H.264/AAC) by composing: per-clip
  trims minus any active silence cuts → concat → color grade → text
  overlays (including auto-generated captions) → audio chain → optional
  music mix. All in the browser, via ffmpeg.wasm — verified end-to-end
  against real test clips during development (not just "it builds").

## What's deliberately not built, and why

The original brief for this app asked for several things that need either
a GPU-hosted ML model or a paid cloud AI API — neither of which fits a
free, client-only, browser-based tool. Building fake versions of these
would violate this project's own rule against simulated AI, so instead:

- **Open-ended natural-language editing** ("make this look like a 90s
  thriller and tighten the pacing") needs a real language model reasoning
  about arbitrary instructions. The free Command Bar recognizes a fixed set
  of known phrases instead — real pattern matching, not real understanding.
  A genuine version would mean connecting a paid AI API (the user's own
  API key, billed to them) — deliberately left out so the app stays free by
  default.
- **Scene/highlight detection or AI rough-cut proposals** beyond silence
  removal needs a vision-language model reasoning about footage content.
  Not included.
- **Automatic reframing / subject tracking for Shorts** needs a real object-
  tracking model. A center-crop fallback would be dishonest to present as
  "intelligent tracking," so this isn't included at all rather than faked.
- **True ML speech enhancement / voice isolation** (the Adobe Podcast /
  Descript-style "make this sound like a studio" button) needs a trained
  speech-enhancement model, typically run server-side. The afftdn-based
  noise reduction in Sound Studio is genuinely useful but is a classical
  DSP filter, not that.
- **Vocal/music/stem separation** needs a source-separation model (e.g.
  Demucs) with real compute behind it — not feasible client-side in a
  browser tab.
- **Word-level caption editing, SRT/VTT export, speaker labels** — the
  captions engine returns sentence-level segments with timestamps today;
  finer-grained editing and subtitle file export are a reasonable next
  step, not yet built.

Each of these is a legitimate future phase, but it means standing up a
small backend service that calls a paid or self-hosted model for that one
feature, while everything above stays free and client-side. That's a
deliberate scope decision, not an oversight.

## Run it locally

```bash
npm install
npm run dev
```

`npm install` / `npm run dev` / `npm run build` all first copy the ffmpeg
WebAssembly core from `node_modules/@ffmpeg/core` into `public/ffmpeg/` (see
`scripts/copy-ffmpeg-core.mjs`), and the Whisper speech model + ONNX Runtime
WASM into `public/models/` and `public/ort/` (see
`scripts/copy-whisper-assets.mjs`), so the app serves everything from its own
origin instead of fetching it from a third-party CDN at runtime — more
reliable, and works in locked-down network environments. The speech model
comes from the `sts-whisper-tiny` npm package, a straight, unmodified mirror
of the public `Xenova/whisper-tiny` model, published to npm specifically so
it can be installed like any other dependency instead of fetched from
huggingface.co at install or run time.

Open the printed local URL — on your phone, use your computer's local
network IP (e.g. `http://192.168.1.20:5173`) while both devices are on the
same Wi-Fi, or just deploy it (below) and open the live URL on your phone.

## Build for production

```bash
npm run build
```

Output goes to `dist/`, including the self-hosted ffmpeg core files.

## Deploy: GitHub → Render

This repo is already connected to Render with auto-deploy on push to
`main` — push to GitHub and it redeploys automatically. For a fresh setup
elsewhere:

1. Push this project to a GitHub repo.
2. On [dashboard.render.com](https://dashboard.render.com): **New** →
   **Static Site**, connect the repo.
3. Build command: `npm install && npm run build`. Publish directory: `dist`.

No server, no database, no environment variables needed — it's a static
site; `render.yaml` in this repo mirrors the same configuration.

## Honest performance notes

- All processing — color grading, audio filters, silence detection,
  export — runs on the visitor's own device. Free and private, but as fast
  as their hardware: a multi-minute clip with several effects can take
  real time to render, especially on older phones.
- There's no account system, cloud storage, or collaboration — everything
  lives in the visitor's browser tab until they export.
- The ffmpeg-core WebAssembly bundle is ~31MB; the Whisper speech model and
  its WASM runtime add roughly another 70MB, fetched only the first time a
  visitor uses a feature that needs them (color/audio/silence tools don't
  need the speech model at all). The browser caches all of it after first
  load, but first use on a slow connection takes a moment — especially for
  captions on mobile data.
- Speech recognition runs single-threaded in the browser (so it works on a
  plain static host, without special cross-origin-isolation headers); it's
  correct but not as fast as a multi-threaded or server-side setup —
  expect it to take noticeably longer than the clip's own length on an
  older phone.

## Project structure

```
src/
  App.tsx                      — main state + layout + Auto Edit / command-bar wiring
  ffmpegEngine.ts               — builds the ffmpeg filter graph, runs export,
                                   silence detection, exact-frame preview, audio analysis
  types.ts                      — shared types, neutral grade defaults
  engine/
    colorGrade.ts                — 15 presets, filter-chain builder, CSS approximation,
                                     deterministic Auto Grade analysis, luma histogram
    audioStudio.ts                — sound profiles, audio filter-chain builder
    silenceRemover.ts             — silencedetect log parsing, cut-list logic,
                                     source-time-to-timeline-time mapping
    frameSampler.ts               — real canvas-based frame + thumbnail sampling
    transcribe.ts                  — real offline speech-to-text (Whisper via
                                      transformers.js, self-hosted model + WASM runtime)
    commandBar.ts                   — free phrase-recognition command parser
  components/
    Toolbar.tsx                   — top bar
    AutoEditBar.tsx                 — one-click Auto Edit button
    CommandBar.tsx                   — free-text command input + examples + log
    MediaBrowser.tsx               — left-panel project media list, thumbnails
    Timeline.tsx                   — clip list, thumbnails, trim handles, reorder, cuts
    PreviewPlayer.tsx               — viewfinder-style preview, respects active cuts
    ColorLabPanel.tsx                — color grading UI + real luma scope
    SoundStudioPanel.tsx              — audio mixer UI
    SilenceRemoverPanel.tsx            — silence detection + cut list UI
    TextPanel.tsx                      — caption/title editor + auto-caption button
    ExportBar.tsx                       — render progress + download
scripts/
  copy-ffmpeg-core.mjs                  — copies ffmpeg-core into public/ at build time
  copy-whisper-assets.mjs                — copies the Whisper model + ONNX Runtime WASM
                                            into public/ at build time
public/fonts/
  caption-font.ttf                      — DejaVu Sans Bold, used for burned-in text/captions
                                           (ffmpeg.wasm has no system fonts of its own)
```
