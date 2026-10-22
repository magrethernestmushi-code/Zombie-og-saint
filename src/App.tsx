import { useRef, useState } from "react";
import "./App.css";
import Toolbar from "./components/Toolbar";
import MediaBrowser from "./components/MediaBrowser";
import Timeline from "./components/Timeline";
import PreviewPlayer from "./components/PreviewPlayer";
import TextPanel from "./components/TextPanel";
import ColorLabPanel from "./components/ColorLabPanel";
import SoundStudioPanel from "./components/SoundStudioPanel";
import SilenceRemoverPanel from "./components/SilenceRemoverPanel";
import ExportBar from "./components/ExportBar";
import {
  exportTimeline,
  detectSilenceForClip,
  renderGradedFrame,
  analyzeAudio,
} from "./ffmpegEngine";
import { analyzeFramesForAutoGrade } from "./engine/colorGrade";
import { sampleFrames } from "./engine/frameSampler";
import { buildCutList, SILENCE_MODE_PRESETS } from "./engine/silenceRemover";
import { DEFAULT_AUDIO_SETTINGS } from "./engine/audioStudio";
import { NEUTRAL_GRADE } from "./types";
import type {
  AudioChannelSettings,
  Clip,
  ColorGrade,
  ExportState,
  SilenceSettings,
  TextOverlay,
} from "./types";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => resolve(video.duration || 5);
    video.onerror = () => resolve(5);
  });
}

type RightTab = "color" | "audio" | "silence" | "text";

export default function App() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [texts, setTexts] = useState<TextOverlay[]>([]);
  const [color, setColor] = useState<ColorGrade>({ ...NEUTRAL_GRADE, preset: "none" });
  const [audio, setAudio] = useState<AudioChannelSettings>({ ...DEFAULT_AUDIO_SETTINGS });
  const [silenceSettings, setSilenceSettings] = useState<SilenceSettings>({
    mode: "balanced",
    ...SILENCE_MODE_PRESETS.balanced,
  });
  const [rightTab, setRightTab] = useState<RightTab>("color");
  const [exportState, setExportState] = useState<ExportState>({
    phase: "idle",
    progress: 0,
    message: "",
    outputUrl: null,
  });

  const [autoGradeBusy, setAutoGradeBusy] = useState(false);
  const [exactPreviewUrl, setExactPreviewUrl] = useState<string | null>(null);
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null);
  const [waveformBusy, setWaveformBusy] = useState(false);
  const [peakDb, setPeakDb] = useState<number | null>(null);
  const [silenceBusy, setSilenceBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeClip = clips.find((c) => c.id === activeId) ?? null;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const newClips: Clip[] = [];
    for (const file of Array.from(fileList)) {
      const duration = await readDuration(file);
      newClips.push({
        id: uid(),
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        duration,
        trimStart: 0,
        trimEnd: duration,
        silenceCuts: [],
      });
    }
    setClips((prev) => [...prev, ...newClips]);
    if (!activeId && newClips[0]) setActiveId(newClips[0].id);
  }

  function handleTrim(id: string, start: number, end: number) {
    setClips((prev) =>
      prev.map((c) => (c.id === id ? { ...c, trimStart: start, trimEnd: end } : c))
    );
  }

  function handleReorder(id: string, dir: -1 | 1) {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const swapWith = idx + dir;
      if (idx < 0 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  function handleRemove(id: string) {
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function addText() {
    setTexts((prev) => [
      ...prev,
      {
        id: uid(),
        text: "Your text here",
        start: 0,
        end: 3,
        x: 50,
        y: 85,
        color: "#f1ede4",
        fontSize: 56,
      },
    ]);
  }

  function updateText(id: string, patch: Partial<TextOverlay>) {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeText(id: string) {
    setTexts((prev) => prev.filter((t) => t.id !== id));
  }

  function handleMusicFile(file: File | null) {
    setAudio((prev) => ({
      ...prev,
      musicFile: file,
      musicUrl: file ? URL.createObjectURL(file) : null,
    }));
  }

  async function handleAutoGrade(strength: number) {
    if (!activeClip) return;
    setAutoGradeBusy(true);
    try {
      const samples = await sampleFrames(activeClip, 5);
      const suggested = analyzeFramesForAutoGrade(samples, strength);
      setColor((prev) => ({ ...prev, ...suggested, preset: "auto" }));
    } catch (err) {
      console.error("Auto Grade failed", err);
    } finally {
      setAutoGradeBusy(false);
    }
  }

  async function handlePreviewExact() {
    if (!activeClip) return;
    const midpoint = activeClip.trimStart + (activeClip.trimEnd - activeClip.trimStart) / 2;
    try {
      const url = await renderGradedFrame(activeClip, midpoint, color);
      setExactPreviewUrl(url);
    } catch (err) {
      console.error("Exact preview failed", err);
    }
  }

  async function handleDetectSilence() {
    if (!activeClip) return;
    setSilenceBusy(true);
    try {
      const regions = await detectSilenceForClip(
        activeClip,
        silenceSettings.thresholdDb,
        silenceSettings.minSilenceDuration
      );
      const cuts = buildCutList(
        regions,
        silenceSettings,
        activeClip.trimStart,
        activeClip.trimEnd,
        activeClip.id
      );
      setClips((prev) =>
        prev.map((c) => (c.id === activeClip.id ? { ...c, silenceCuts: cuts } : c))
      );
    } catch (err) {
      console.error("Silence detection failed", err);
    } finally {
      setSilenceBusy(false);
    }
  }

  function handleRestoreCut(cutId: string) {
    if (!activeClip) return;
    setClips((prev) =>
      prev.map((c) =>
        c.id === activeClip.id
          ? {
              ...c,
              silenceCuts: c.silenceCuts.map((cut) =>
                cut.id === cutId ? { ...cut, restored: !cut.restored } : cut
              ),
            }
          : c
      )
    );
  }

  function handleRestoreAllCuts() {
    if (!activeClip) return;
    setClips((prev) =>
      prev.map((c) =>
        c.id === activeClip.id
          ? { ...c, silenceCuts: c.silenceCuts.map((cut) => ({ ...cut, restored: true })) }
          : c
      )
    );
  }

  async function handleGenerateWaveform() {
    if (!activeClip) return;
    setWaveformBusy(true);
    try {
      const { waveformUrl: url, peakDb: peak } = await analyzeAudio(activeClip);
      setWaveformUrl(url);
      setPeakDb(peak);
    } catch (err) {
      console.error("Waveform analysis failed", err);
    } finally {
      setWaveformBusy(false);
    }
  }

  async function handleExport() {
    if (clips.length === 0) return;
    setExportState({
      phase: "loading-engine",
      progress: 0.02,
      message: "Loading editing engine…",
      outputUrl: null,
    });
    try {
      const blob = await exportTimeline({
        clips,
        texts,
        color,
        audio,
        width: 1080,
        height: 1920,
        fps: 30,
        onProgress: (progress, message) => {
          setExportState((prev) => ({ ...prev, phase: "processing", progress, message }));
        },
      });
      const url = URL.createObjectURL(blob);
      setExportState({ phase: "done", progress: 1, message: "Done", outputUrl: url });
    } catch (err) {
      console.error("Export failed", err);
      setExportState({
        phase: "error",
        progress: 0,
        message: err instanceof Error ? err.message : String(err),
        outputUrl: null,
      });
    }
  }

  return (
    <div className="app">
      <Toolbar projectName="Edmund Og Saint" />

      <main className="app-main">
        <aside className="app-left">
          <MediaBrowser
            clips={clips}
            activeId={activeId}
            onSelect={setActiveId}
            onFiles={handleFiles}
            fileInputRef={fileInputRef}
          />
        </aside>

        <section className="app-preview">
          <PreviewPlayer clips={clips} texts={texts} color={color} />
          <ExportBar state={exportState} disabled={clips.length === 0} onExport={handleExport} />
        </section>

        <section className="app-right">
          <nav className="tab-bar">
            <button
              type="button"
              className={rightTab === "color" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setRightTab("color")}
            >
              Color
            </button>
            <button
              type="button"
              className={rightTab === "audio" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setRightTab("audio")}
            >
              Sound
            </button>
            <button
              type="button"
              className={rightTab === "silence" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setRightTab("silence")}
            >
              Silence
            </button>
            <button
              type="button"
              className={rightTab === "text" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setRightTab("text")}
            >
              Text
            </button>
          </nav>

          <div className="tab-panel">
            {rightTab === "color" && (
              <ColorLabPanel
                grade={color}
                onChange={(p) => setColor((c) => ({ ...c, ...p }))}
                onAutoGrade={handleAutoGrade}
                onPreviewExact={handlePreviewExact}
                autoGradeBusy={autoGradeBusy}
                exactPreviewUrl={exactPreviewUrl}
              />
            )}
            {rightTab === "audio" && (
              <SoundStudioPanel
                audio={audio}
                onChange={(p) => setAudio((a) => ({ ...a, ...p }))}
                onMusicFile={handleMusicFile}
                waveformUrl={waveformUrl}
                onGenerateWaveform={handleGenerateWaveform}
                waveformBusy={waveformBusy}
                peakDb={peakDb}
              />
            )}
            {rightTab === "silence" && (
              <SilenceRemoverPanel
                clip={activeClip}
                settings={silenceSettings}
                onSettingsChange={(p) => setSilenceSettings((s) => ({ ...s, ...p }))}
                onDetect={handleDetectSilence}
                onRestore={handleRestoreCut}
                onRestoreAll={handleRestoreAllCuts}
                busy={silenceBusy}
              />
            )}
            {rightTab === "text" && (
              <TextPanel texts={texts} onAdd={addText} onChange={updateText} onRemove={removeText} />
            )}
          </div>
        </section>
      </main>

      <section className="app-timeline">
        <Timeline
          clips={clips}
          activeId={activeId}
          onSelect={setActiveId}
          onTrim={handleTrim}
          onReorder={handleReorder}
          onRemove={handleRemove}
          onAddClick={() => fileInputRef.current?.click()}
        />
      </section>

      <footer className="app-footer">
        <p>Edmund Og Saint renders entirely on your device — your footage never leaves your browser.</p>
      </footer>
    </div>
  );
}
