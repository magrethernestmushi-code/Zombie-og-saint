# Edmund Og Saint

A free, browser-based video editor. Multi-clip timeline, trim/cut, text and
captions, color grading, volume and background-noise cleanup, and background
music — all rendered on your own device with [ffmpeg.wasm](https://ffmpegwasm.netlify.app/).
No upload, no account, no server costs. Works on phone and desktop browsers.

## What it can do

- **Clips** — drop in multiple video files, trim in/out points, reorder, remove.
- **Text** — add timed titles/captions, position, size and color them.
- **Color** — presets (Vivid, Cinematic, Warm, Cool, Mono) plus manual
  brightness/contrast/saturation/gamma.
- **Audio** — adjust clip volume, run an FFT noise-reduction pass on the
  original audio, and mix in a background music track.
- **Export** — renders a single MP4 (1080×1920, vertical) entirely in the
  browser and gives you a download link.

### Honest limits (read this before you promise "Premiere-quality AI" to anyone)

- All processing happens on the visitor's own device in the browser. It's
  free and private, but it's as fast as their phone/laptop — a 2-minute clip
  can take a minute or several to render, and very large files may be slow
  on older phones.
- The "AI" noise cleanup is ffmpeg's `afftdn` filter (FFT denoiser). It's a
  real, useful noise reducer for hiss/fan/wind noise, but it is **not** the
  same class of tool as Adobe's or CapCut's machine-learning voice isolation.
  Getting that level of quality means either a paid cloud AI API (cost per
  use) or a heavier ML model that won't run smoothly on an average phone.
- There's no account system, cloud storage, or collaboration — everything
  lives in the visitor's browser tab until they export.

If you want true ML-grade audio/video enhancement later, the natural next
step is a small backend service (e.g. a Render web service) that calls a
paid AI API for that one feature, while everything else stays free and
client-side.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed local URL — on your phone, use your computer's local
network IP (e.g. `http://192.168.1.20:5173`) while both devices are on the
same Wi-Fi, or just deploy it (below) and open the live URL on your phone.

## Build for production

```bash
npm run build
```

Output goes to `dist/`.

## Deploy: GitHub → Render

**1. Push this project to GitHub**

```bash
git init
git add .
git commit -m "Initial commit: Edmund Og Saint video editor"
git branch -M main
git remote add origin https://github.com/magrethernestmushi-code/zombie-og-saint.git
git push -u origin main
```

(Create the empty repo first at github.com/new, without a README, then run
the commands above from this project folder.)

**2. Deploy on Render**

This repo includes a `render.yaml`, so Render can pick up the whole
configuration automatically:

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** →
   **Blueprint**.
2. Connect your GitHub account and pick the `zombie-og-saint` repo.
3. Render reads `render.yaml` and creates a **Static Site** with:
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
4. Click **Apply** — Render builds and gives you a live `https://…onrender.com` URL.

Every push to `main` on GitHub will auto-redeploy. No server, no database,
no environment variables needed — it's a static site.

**On your phone:** just open the Render URL in your mobile browser. The
layout is responsive, and ffmpeg.wasm runs the same way on mobile Chrome/Safari
as it does on desktop (slower on older phones, but it works).

## Project structure

```
src/
  App.tsx              — main state + layout
  ffmpegEngine.ts       — builds the ffmpeg filter graph and runs export
  types.ts              — shared types + color presets
  components/
    Timeline.tsx         — clip list, trim handles, reorder
    PreviewPlayer.tsx     — viewfinder-style preview
    TextPanel.tsx         — caption/title editor
    ColorPanel.tsx        — grading controls
    AudioPanel.tsx         — volume, noise cleanup, music
    ExportBar.tsx          — render progress + download
```
