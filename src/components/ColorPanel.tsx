import { COLOR_PRESETS } from "../types";
import type { ColorSettings } from "../types";

type Props = {
  color: ColorSettings;
  onChange: (patch: Partial<ColorSettings>) => void;
};

const PRESET_LABELS: Record<string, string> = {
  none: "Original",
  vivid: "Vivid",
  cinematic: "Cinematic",
  warm: "Warm",
  cool: "Cool",
  mono: "Mono",
};

export default function ColorPanel({ color, onChange }: Props) {
  function applyPreset(key: string) {
    onChange({ ...COLOR_PRESETS[key], preset: key });
  }

  return (
    <div className="panel-section">
      <div className="panel-section__head">
        <h3>Color &amp; grade</h3>
      </div>
      <div className="preset-row">
        {Object.keys(COLOR_PRESETS).map((key) => (
          <button
            type="button"
            key={key}
            className={`preset-chip${color.preset === key ? " preset-chip--active" : ""}`}
            onClick={() => applyPreset(key)}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="slider-grid">
        <label>
          <span>Brightness</span>
          <input
            type="range"
            min={-0.5}
            max={0.5}
            step={0.01}
            value={color.brightness}
            onChange={(e) =>
              onChange({ brightness: Number(e.target.value), preset: "custom" })
            }
          />
        </label>
        <label>
          <span>Contrast</span>
          <input
            type="range"
            min={0.4}
            max={2}
            step={0.01}
            value={color.contrast}
            onChange={(e) =>
              onChange({ contrast: Number(e.target.value), preset: "custom" })
            }
          />
        </label>
        <label>
          <span>Saturation</span>
          <input
            type="range"
            min={0}
            max={2.5}
            step={0.01}
            value={color.saturation}
            onChange={(e) =>
              onChange({ saturation: Number(e.target.value), preset: "custom" })
            }
          />
        </label>
        <label>
          <span>Gamma</span>
          <input
            type="range"
            min={0.3}
            max={2.2}
            step={0.01}
            value={color.gamma}
            onChange={(e) =>
              onChange({ gamma: Number(e.target.value), preset: "custom" })
            }
          />
        </label>
      </div>
    </div>
  );
}
