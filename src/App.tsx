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
import AutoEditBar from "./components/AutoEditBar";
import CommandBar from "./components/CommandBar";
import {
  exportTimeline,
  detectSilenceForClip,
  renderGradedFrame,
  analyzeAudio,
} from "./ffmpegEngine";
import { analyzeFramesForAutoGrade, computeLumaHistogram, COLOR_PRESETS } from "./engine/colorGrade";
import { sampleFrames, grabThumbnail } from "./engine/frameSampler";
import {
  buildCutList,
  SILENCE_MODE_PRESETS,
  sourceTimeToTimelineTime,
} from "./engine/silenceRemover";
import { DEFAULT_AUDIO_SETTINGS, SOUND_PROFILES } from "./engine/audioStudio";
import { transcribeClip } from "./engine/transcribe";
import { interpretCommand, nudgeVolume, type CommandMatch } from "./engine/commandBar";
import { NEUTRAL_GRADE } from "./types";
import type {
  AudioChannelSettings,
  Clip,
  ColorGrade,
  ExportState,
  SilenceCut,
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

type RightTab = "edit" | "color" | "audio";

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
  const [rightTab, setRightTab] = useState<RightTab>("edit");
  const [exportState, setExportState] = useState<ExportState>({
    phase: "idle",
    progress: 0,
    message: "",
    outputUrl: null,
  });

  const [autoGradeBusy, setAutoGradeBusy] = useState(false);
  const [exactPreviewUrl, setExactPreviewUrl] = useState<string | null>(null);
  const [histogram, setHistogram] = useState<number[] | null>(null);
  const [scopeBusy, setScopeBusy] = useState(false);
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null);
  const [waveformBusy, setWaveformBusy] = useState(false);
  const [peakDb, setPeakDb] = useState<number | null>(null);
  const [silenceBusy, setSilenceBusy] = useState(false);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [captionStatus, setCaptionStatus] = useState<string | null>(null);
  const [autoEditBusy, setAutoEditBusy] = useState(false);
  const [autoEditStatus, setAutoEditStatus] = useState<string | null>(null);
  const [commandLog, setCommandLog] = useState<string[]>([]);

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
        thumbnailUrl: null,
      });
    }
    setClips((prev) => [...prev, ...newClips]);
    if (!activeId && newClips[0]) setActiveId(newClips[0].id);

    // Grab a real thumbnail frame for each new clip without blocking import.
    for (const clip of newClips) {
      grabThumbnail(clip).then((url) => {
        if (!url) return;
        setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, thumbnailUrl: url } : c)));
      });
    }
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
      setHistogram(computeLumaHistogram(samples));
    } catch (err) {
      console.error("Auto Grade failed", err);
    } finally {
      setAutoGradeBusy(false);
    }
  }

  async function handleShowScope() {
    if (!activeClip) return;
    setScopeBusy(true);
    try {
      const samples = await sampleFrames(activeClip, 5);
      setHistogram(computeLumaHistogram(samples));
    } catch (err) {
      console.error("Scope read failed", err);
    } finally {
      setScopeBusy(false);
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

  /**
   * Generates real captions from a clip's actual speech and adds them as
   * timed text overlays. `cutsOverride` lets Auto Edit pass the silence
   * cuts it just computed before they've landed in `clips` state, so
   * caption timing matches the edit that's about to happen.
   */
  async function handleGenerateCaptions(clip: Clip, cutsOverride?: SilenceCut[]) {
    setCaptionBusy(true);
    setCaptionStatus("Loading speech model…");
    try {
      const effectiveClip = cutsOverride ? { ...clip, silenceCuts: cutsOverride } : clip;
      const idx = clips.findIndex((c) => c.id === clip.id);
      const before = idx >= 0 ? clips.slice(0, idx) : [];

      const segments = await transcribeClip(clip, (info) => {
        const pct =
          typeof info.progress === "number" ? ` ${Math.round(info.progress)}%` : "";
        setCaptionStatus(`${info.status}${pct}`);
      });
      setCaptionStatus("Placing captions on the timeline…");

      const prefix = `cap-${clip.id}-`;
      const newTexts: TextOverlay[] = segments.map((seg, i) => {
        const start = sourceTimeToTimelineTime(before, effectiveClip, seg.start) ?? 0;
        const end = Math.max(
          sourceTimeToTimelineTime(before, effectiveClip, seg.end) ?? start + 1,
          start + 0.3
        );
        return {
          id: `${prefix}${i}`,
          text: seg.text,
          start,
          end,
          x: 50,
          y: 88,
          color: "#ffffff",
          fontSize: 42,
        };
      });
      setTexts((prev) => [...prev.filter((t) => !t.id.startsWith(prefix)), ...newTexts]);
      setCaptionStatus(
        newTexts.length > 0
          ? `Added ${newTexts.length} real caption${newTexts.length === 1 ? "" : "s"} from the audio`
          : "No speech detected to caption"
      );
    } catch (err) {
      console.error("Caption generation failed", err);
      setCaptionStatus("Caption generation failed — see console for details");
    } finally {
      setCaptionBusy(false);
    }
  }

  /**
   * One click: removes silence, auto-grades color, applies a sensible audio
   * cleanup profile, and adds real captions — all real processing chained
   * together, run on the active clip.
   */
  async function handleAutoEdit() {
    if (!activeClip) return;
    const clip = activeClip;
    setAutoEditBusy(true);
    try {
      setAutoEditStatus("Finding silence to remove…");
      const settings = { mode: "balanced" as const, ...SILENCE_MODE_PRESETS.balanced };
      const regions = await detectSilenceForClip(
        clip,
        settings.thresholdDb,
        settings.minSilenceDuration
      );
      const cuts = buildCutList(regions, settings, clip.trimStart, clip.trimEnd, clip.id);
      setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, silenceCuts: cuts } : c)));

      setAutoEditStatus("Reading the footage's color…");
      const samples = await sampleFrames(clip, 5);
      const suggested = analyzeFramesForAutoGrade(samples, 0.7);
      setColor({ ...suggested, preset: "auto" });

      setAutoEditStatus("Cleaning up the audio…");
      setAudio((prev) => ({
        ...prev,
        ...SOUND_PROFILES.cleanDialogue.settings,
        profile: "cleanDialogue",
      }));

      setAutoEditStatus("Listening for real captions…");
      await handleGenerateCaptions(clip, cuts);

      setAutoEditStatus("Done — review the edit below, then export when you're happy.");
    } catch (err) {
      console.error("Auto Edit failed", err);
      setAutoEditStatus("Auto Edit hit an error partway through — see console for details.");
    } finally {
      setAutoEditBusy(false);
    }
  }

  async function handleRunCommand(text: string) {
    if (!text.trim()) return;
    const matches = interpretCommand(text);
    if (matches.length === 0) {
      setCommandLog((prev) => [
        `Didn't recognize that — try phrases like "remove silence" or "make it warmer".`,
        ...prev,
      ].slice(0, 6));
      return;
    }
    const applied: string[] = [];
    for (const match of matches) {
      applied.push(await applyCommandAction(match));
    }
    setCommandLog((prev) => [applied.join(" · "), ...prev].slice(0, 6));
  }

  async function applyCommandAction(match: CommandMatch): Promise<string> {
    const { action } = match;
    switch (action.type) {
      case "autoEdit":
        if (!activeClip) return "Auto Edit: select a clip first";
        await handleAutoEdit();
        return "ran Auto Edit";
      case "detectSilence":
        if (!activeClip) return "Remove silence: select a clip first";
        await handleDetectSilence();
        return "removed silence";
      case "generateCaptions":
        if (!activeClip) return "Captions: select a clip first";
        await handleGenerateCaptions(activeClip);
        return "added real captions";
      case "autoGrade":
        if (!activeClip) return "Auto Grade: select a clip first";
        await handleAutoGrade(0.7);
        return "auto-graded the color";
      case "resetColor":
        setColor({ ...NEUTRAL_GRADE, preset: "none" });
        return "reset the color";
      case "applyPreset":
        setColor((c) => ({ ...c, ...COLOR_PRESETS[action.preset], preset: action.preset }));
        return match.label.toLowerCase();
      case "adjustColor":
        setColor((c) => ({ ...c, ...action.patch, preset: "custom" }));
        return action.label;
      case "adjustAudio":
        if (action.label === "louder") {
          setAudio((a) => ({ ...a, dialogueVolume: nudgeVolume(a.dialogueVolume, true) }));
        } else if (action.label === "quieter") {
          setAudio((a) => ({ ...a, dialogueVolume: nudgeVolume(a.dialogueVolume, false) }));
        } else {
          setAudio((a) => ({ ...a, ...action.patch }));
        }
        return action.label;
      default:
        return "";
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

      <AutoEditBar
        disabled={!activeClip}
        busy={autoEditBusy}
        status={autoEditStatus}
        onRun={handleAutoEdit}
      />
      <CommandBar busy={autoEditBusy || captionBusy} log={commandLog} onRun={handleRunCommand} />

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
              className={rightTab === "edit" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setRightTab("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              className={rightTab === "color" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setRightTab("color")}
            >
              Grade
            </button>
            <button
              type="button"
              className={rightTab === "audio" ? "tab-bar__btn tab-bar__btn--active" : "tab-bar__btn"}
              onClick={() => setRightTab("audio")}
            >
              Mix
            </button>
          </nav>

          <div className="tab-panel">
            {rightTab === "edit" && (
              <>
                <SilenceRemoverPanel
                  clip={activeClip}
                  settings={silenceSettings}
                  onSettingsChange={(p) => setSilenceSettings((s) => ({ ...s, ...p }))}
                  onDetect={handleDetectSilence}
                  onRestore={handleRestoreCut}
                  onRestoreAll={handleRestoreAllCuts}
                  busy={silenceBusy}
                />
                <div className="panel-divider" />
                <TextPanel
                  texts={texts}
                  onAdd={addText}
                  onChange={updateText}
                  onRemove={removeText}
                  onGenerateCaptions={activeClip ? () => handleGenerateCaptions(activeClip) : undefined}
                  captionBusy={captionBusy}
                  captionStatus={captionStatus}
                />
              </>
            )}
            {rightTab === "color" && (
              <ColorLabPanel
                grade={color}
                onChange={(p) => setColor((c) => ({ ...c, ...p }))}
                onAutoGrade={handleAutoGrade}
                onPreviewExact={handlePreviewExact}
                autoGradeBusy={autoGradeBusy}
                exactPreviewUrl={exactPreviewUrl}
                histogram={histogram}
                onShowScope={handleShowScope}
                scopeBusy={scopeBusy}
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
