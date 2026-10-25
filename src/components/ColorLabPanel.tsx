import { useState } from "react";
import { COLOR_PRESETS, PRESET_LABELS } from "../engine/colorGrade";
import { NEUTRAL_GRADE } from "../types";
import type { ColorGrade } from "../types";

type Props = {
  grade: ColorGrade;
  onChange: (patch: Partial<ColorGrade>) => void;
  onAutoGrade: (strength: number) => void;
  onPreviewExact: () => void;
  autoGradeBusy: boolean;
  exactPreviewUrl: string | null;
  histogram?: number[] | null;
  onShowScope?: () => void;
  scopeBusy?: boolean;
};

const SLIDERS: Array<{
  key: keyof typeof NEUTRAL_GRADE;
  label: string;
  min: number;
  max: number;
}> = [
  { key: "exposure", label: "Exposure", min: -1, max: 1 },
  { key: "contrast", label: "Contrast", min: -1, max: 1 },
  { key: "highlights", label: "Highlights", min: -1, max: 1 },
  { key: "shadows", label: "Shadows", min: -1, max: 1 },
  { key: "whites", label: "Whites", min: -1, max: 1 },
  { key: "blacks", label: "Blacks", min: -1, max: 1 },
  { key: "temperature", label: "Temperature", min: -1, max: 1 },
  { key: "tint", label: "Tint", min: -1, max: 1 },
  { key: "saturation", label: "Saturation", min: -1, max: 1 },
  { key: "vibrance", label: "Vibrance", min: -1, max: 1 },
  { key: "vignette", label: "Vignette", min: 0, max: 1 },
  { key: "grain", label: "Film grain", min: 0, max: 1 },
  { key: "sharpen", label: "Sharpen", min: 0, max: 1 },
];

export default function ColorLabPanel({
  grade,
  onChange,
  onAutoGrade,
  onPreviewExact,
  autoGradeBusy,
  exactPreviewUrl,
  histogram,
  onShowScope,
  scopeBusy,
}: Props) {
  const [autoStrength, setAutoStrength] = useState(0.7);

  function applyPreset(key: string) {
    onChange({ ...COLOR_PRESETS[key], preset: key });
  }

  function reset() {
    onChange({ ...NEUTRAL_GRADE, preset: "none" });
  }

  return (
    <div className="panel-section">
      <div className="panel-section__head">
        <h3>Color Lab</h3>
        <button type="button" className="btn-ghost" onClick={reset}>
          Reset
        </button>
      </div>

      <div className="auto-grade">
        <div className="auto-grade__row">
          <button
            type="button"
            className="btn-secondary"
            disabled={autoGradeBusy}
            onClick={() => onAutoGrade(autoStrength)}
          >
            {autoGradeBusy ? "Analyzing frames…" : "Auto Grade"}
          </button>
          <label className="auto-grade__strength">
            Strength
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={autoStrength}
              onChange={(e) => setAutoStrength(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="panel-section__hint">
          Samples real frames from your clip and corrects exposure, contrast and
          color cast with a deterministic histogram + gray-world analysis — not
          a trained AI model.
        </p>
      </div>

      {onShowScope && (
        <div className="scope-panel">
          <div className="scope-panel__head">
            <span>Luma scope</span>
            <button type="button" className="btn-ghost" onClick={onShowScope} disabled={scopeBusy}>
              {scopeBusy ? "Reading…" : histogram ? "Refresh" : "Read scope"}
            </button>
          </div>
          {histogram ? (
            <div className="scope-panel__bars" aria-label="Luminance histogram">
              {histogram.map((v, i) => (
                <div key={i} className="scope-panel__bar" style={{ height: `${Math.max(2, v * 100)}%` }} />
              ))}
            </div>
          ) : (
            <p className="panel-section__hint">
              A real luminance histogram read from your clip's own frames — shows where your shadows,
              midtones and highlights actually fall, like a colorist's scope.
            </p>
          )}
        </div>
      )}

      <div className="preset-grid">
        {Object.keys(COLOR_PRESETS)
          .filter((k) => k !== "none")
          .map((key) => (
            <button
              type="button"
              key={key}
              className={`preset-chip${grade.preset === key ? " preset-chip--active" : ""}`}
              onClick={() => applyPreset(key)}
            >
              {PRESET_LABELS[key]}
            </button>
          ))}
      </div>

      <div className="slider-grid">
        {SLIDERS.map(({ key, label, min, max }) => (
          <label key={key}>
            <span>
              {label}
              <strong>{grade[key].toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={0.01}
              value={grade[key]}
              onChange={(e) =>
                onChange({ [key]: Number(e.target.value), preset: "custom" } as Partial<ColorGrade>)
              }
            />
          </label>
        ))}
      </div>

      <div className="exact-preview">
        <button type="button" className="btn-ghost" onClick={onPreviewExact}>
          Preview exact frame
        </button>
        <p className="panel-section__hint">
          The live viewfinder is a fast CSS approximation. This renders one
          real frame through the full export filter chain (curves, vignette,
          grain included) so you can confirm the exact graded look.
        </p>
        {exactPreviewUrl && (
          <img className="exact-preview__image" src={exactPreviewUrl} alt="Exact graded frame" />
        )}
      </div>
    </div>
  );
}
