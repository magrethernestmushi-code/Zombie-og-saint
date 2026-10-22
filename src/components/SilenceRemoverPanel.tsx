import type { Clip, SilenceMode, SilenceSettings } from "../types";
import { SILENCE_MODE_PRESETS } from "../engine/silenceRemover";

type Props = {
  clip: Clip | null;
  settings: SilenceSettings;
  onSettingsChange: (patch: Partial<SilenceSettings>) => void;
  onDetect: () => void;
  onRestore: (cutId: string) => void;
  onRestoreAll: () => void;
  busy: boolean;
};

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${sec}`;
}

const MODE_LABELS: Record<SilenceMode, string> = {
  gentle: "Gentle",
  balanced: "Balanced",
  aggressive: "Aggressive",
};

export default function SilenceRemoverPanel({
  clip,
  settings,
  onSettingsChange,
  onDetect,
  onRestore,
  onRestoreAll,
  busy,
}: Props) {
  function setMode(mode: SilenceMode) {
    onSettingsChange({ mode, ...SILENCE_MODE_PRESETS[mode] });
  }

  const activeCuts = clip?.silenceCuts.filter((c) => !c.restored) ?? [];
  const restoredCuts = clip?.silenceCuts.filter((c) => c.restored) ?? [];
  const removedSeconds = activeCuts.reduce((s, c) => s + (c.end - c.start), 0);

  return (
    <div className="panel-section">
      <div className="panel-section__head">
        <h3>Silence Remover</h3>
      </div>

      {!clip ? (
        <p className="panel-section__hint">Select a clip in the media browser first.</p>
      ) : (
        <>
          <div className="preset-row">
            {(Object.keys(MODE_LABELS) as SilenceMode[]).map((m) => (
              <button
                type="button"
                key={m}
                className={`preset-chip${settings.mode === m ? " preset-chip--active" : ""}`}
                onClick={() => setMode(m)}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          <div className="slider-grid slider-grid--three">
            <label>
              <span>Threshold<strong>{settings.thresholdDb}dB</strong></span>
              <input type="range" min={-50} max={-15} step={1} value={settings.thresholdDb}
                onChange={(e) => onSettingsChange({ thresholdDb: Number(e.target.value) })} />
            </label>
            <label>
              <span>Min. silence<strong>{settings.minSilenceDuration.toFixed(2)}s</strong></span>
              <input type="range" min={0.1} max={2} step={0.05} value={settings.minSilenceDuration}
                onChange={(e) => onSettingsChange({ minSilenceDuration: Number(e.target.value) })} />
            </label>
            <label>
              <span>Padding<strong>{settings.padding.toFixed(2)}s</strong></span>
              <input type="range" min={0} max={0.5} step={0.01} value={settings.padding}
                onChange={(e) => onSettingsChange({ padding: Number(e.target.value) })} />
            </label>
          </div>
          <label>
            <span>Preserve pauses shorter than<strong>{settings.minPreservedPause.toFixed(2)}s</strong></span>
            <input type="range" min={0} max={1} step={0.02} value={settings.minPreservedPause}
              onChange={(e) => onSettingsChange({ minPreservedPause: Number(e.target.value) })} />
          </label>

          <button type="button" className="btn-secondary" onClick={onDetect} disabled={busy} style={{ marginTop: 14 }}>
            {busy ? "Analyzing audio…" : "Detect silence"}
          </button>
          <p className="panel-section__hint">
            Runs ffmpeg's silencedetect filter on the real audio track, then
            proposes cuts below — nothing is removed until you export, and
            every cut can be restored individually.
          </p>

          {clip.silenceCuts.length > 0 && (
            <div className="cut-list">
              <div className="cut-list__head">
                <span>
                  {activeCuts.length} cut{activeCuts.length === 1 ? "" : "s"} proposed · removing ~{fmt(removedSeconds)}
                </span>
                {restoredCuts.length > 0 && (
                  <button type="button" className="btn-ghost" onClick={onRestoreAll}>
                    Restore all
                  </button>
                )}
              </div>
              {clip.silenceCuts.map((cut) => (
                <div key={cut.id} className={`cut-item${cut.restored ? " cut-item--restored" : ""}`}>
                  <span className="cut-item__range">
                    {fmt(cut.start)} – {fmt(cut.end)} ({(cut.end - cut.start).toFixed(1)}s)
                  </span>
                  <button type="button" className="btn-ghost" onClick={() => onRestore(cut.id)}>
                    {cut.restored ? "Cut again" : "Restore"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
