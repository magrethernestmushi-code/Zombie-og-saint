import type { TextOverlay } from "../types";

type Props = {
  texts: TextOverlay[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<TextOverlay>) => void;
  onRemove: (id: string) => void;
};

export default function TextPanel({ texts, onAdd, onChange, onRemove }: Props) {
  return (
    <div className="panel-section">
      <div className="panel-section__head">
        <h3>Text &amp; captions</h3>
        <button type="button" className="btn-ghost" onClick={onAdd}>
          + Add text
        </button>
      </div>
      {texts.length === 0 && (
        <p className="panel-section__hint">
          Add a title, caption or label and drag it where you want on the frame.
        </p>
      )}
      <div className="text-list">
        {texts.map((t) => (
          <div key={t.id} className="text-item">
            <div className="text-item__row">
              <input
                type="text"
                value={t.text}
                placeholder="Your text"
                onChange={(e) => onChange(t.id, { text: e.target.value })}
              />
              <button
                type="button"
                className="btn-icon"
                onClick={() => onRemove(t.id)}
                aria-label="Delete text"
              >
                ×
              </button>
            </div>
            <div className="text-item__row text-item__row--grid">
              <label>
                Start (s)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={t.start}
                  onChange={(e) =>
                    onChange(t.id, { start: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                End (s)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={t.end}
                  onChange={(e) =>
                    onChange(t.id, { end: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Size
                <input
                  type="number"
                  min={10}
                  max={200}
                  step={2}
                  value={t.fontSize}
                  onChange={(e) =>
                    onChange(t.id, { fontSize: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Color
                <input
                  type="color"
                  value={t.color}
                  onChange={(e) => onChange(t.id, { color: e.target.value })}
                />
              </label>
            </div>
            <div className="text-item__row">
              <label className="text-item__pos">
                X position
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={t.x}
                  onChange={(e) => onChange(t.id, { x: Number(e.target.value) })}
                />
              </label>
              <label className="text-item__pos">
                Y position
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={t.y}
                  onChange={(e) => onChange(t.id, { y: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
