import { useRef, useState } from "react";
import "./App.css";
import Timeline from "./components/Timeline";
import PreviewPlayer from "./components/PreviewPlayer";
import TextPanel from "./components/TextPanel";
import ColorPanel from "./components/ColorPanel";
import AudioPanel from "./components/AudioPanel";
import ExportBar from "./components/ExportBar";
import { exportTimeline } from "./ffmpegEngine";
import type {
  AudioSettings,
  Clip,
  ColorSettings,
  ExportState,
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
    video.onloadedmetadata = () => {
      resolve(video.duration || 5);
    };
    video.onerror = () => resolve(5);
  });
}

type Tab = "clips" | "text" | "color" | "audio";

export default function App() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [texts, setTexts] = useState<TextOverlay[]>([]);
  const [color, setColor] = useState<ColorSettings>({
    brightness: 0,
    contrast: 1,
    saturation: 1,
    gamma: 1,
    preset: "none",
  });
  const [audio, setAudio] = useState<AudioSettings>({
    volume: 1,
    denoise: false,
    musicFile: null,
    musicUrl: null,
    musicVolume: 0.4,
  });
  const [tab, setTab] = useState<Tab>("clips");
  const [exportState, setExportState] = useState<ExportState>({
    phase: "idle",
    progress: 0,
    message: "",
    outputUrl: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        color: "#f3f1ea",
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
          setExportState((prev) => ({
            ...prev,
            phase: "processing",
            progress,
            message,
          }));
        },
      });
      const url = URL.createObjectURL(blob);
      setExportState({
        phase: "done",
        progress: 1,
        message: "Done",
        outputUrl: url,
      });
    } catch (err) {
      setExportState({
        phase: "error",
        progress: 0,
        message: err instanceof Error ? err.message : "Unknown error",
        outputUrl: null,
      });
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__mark" />
          <div>
            <h1>Edmund Og Saint</h1>
            <p>Free video editor — cut, grade, caption and mix, right in your browser.</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="app-preview">
          <PreviewPlayer clips={clips} texts={texts} color={color} />
          <ExportBar
            state={exportState}
            disabled={clips.length === 0}
            onExport={handleExport}
          />
        </section>

        <section className="app-controls">
          <nav className="tab-bar">
            <button
              type="button"
              className={tab === "clips" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setTab("clips")}
            >
              Clips
            </button>
            <button
              type="button"
              className={tab === "text" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setTab("text")}
            >
              Text
            </button>
            <button
              type="button"
              className={tab === "color" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setTab("color")}
            >
              Color
            </button>
            <button
              type="button"
              className={tab === "audio" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setTab("audio")}
            >
              Audio
            </button>
          </nav>

          <div className="tab-panel">
            {tab === "clips" && (
              <div className="panel-section">
                {clips.length === 0 && (
                  <label className="file-drop">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                    <strong>Drop or choose video files</strong>
                    <span>MP4, MOV, WebM — from your phone or computer</span>
                  </label>
                )}
                {clips.length > 0 && (
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    style={{ display: "none" }}
                    ref={fileInputRef}
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                )}
              </div>
            )}
            {tab === "text" && (
              <TextPanel
                texts={texts}
                onAdd={addText}
                onChange={updateText}
                onRemove={removeText}
              />
            )}
            {tab === "color" && (
              <ColorPanel color={color} onChange={(p) => setColor((c) => ({ ...c, ...p }))} />
            )}
            {tab === "audio" && (
              <AudioPanel
                audio={audio}
                onChange={(p) => setAudio((a) => ({ ...a, ...p }))}
                onMusicFile={handleMusicFile}
              />
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
        <p>
          Edmund Og Saint renders entirely on your device — your footage never
          leaves your browser.
        </p>
      </footer>
    </div>
  );
}
