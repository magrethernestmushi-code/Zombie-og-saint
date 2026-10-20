import type { Clip } from "../types";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${sec}`;
}

type Props = {
  clips: Clip[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onTrim: (id: string, start: number, end: number) => void;
  onReorder: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAddClick: () => void;
};

export default function Timeline({
  clips,
  activeId,
  onSelect,
  onTrim,
  onReorder,
  onRemove,
  onAddClick,
}: Props) {
  const totalDuration = clips.reduce(
    (sum, c) => sum + Math.max(0, c.trimEnd - c.trimStart),
    0
  );

  return (
    <div className="timeline">
      <div className="timeline__ruler">
        <span className="timeline__ruler-label">TIMELINE</span>
        <span className="timeline__ruler-total">{fmt(totalDuration)}</span>
      </div>
      <div className="timeline__track">
        {clips.map((clip, i) => {
          const isActive = clip.id === activeId;
          const trimmedLen = Math.max(0.1, clip.trimEnd - clip.trimStart);
          const startPct = (clip.trimStart / clip.duration) * 100;
          const widthPct = (trimmedLen / clip.duration) * 100;
          return (
            <div
              key={clip.id}
              className={`clip-card${isActive ? " clip-card--active" : ""}`}
              onClick={() => onSelect(clip.id)}
            >
              <div className="clip-card__head">
                <span className="clip-card__index">{i + 1}</span>
                <span className="clip-card__name">{clip.name}</span>
                <span className="clip-card__dur">{fmt(trimmedLen)}</span>
              </div>
              <div className="clip-card__bar">
                <div
                  className="clip-card__bar-fill"
                  style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                />
              </div>
              <div className="clip-card__trims" onClick={(e) => e.stopPropagation()}>
                <label>
                  In
                  <input
                    type="range"
                    min={0}
                    max={clip.duration}
                    step={0.1}
                    value={clip.trimStart}
                    onChange={(e) =>
                      onTrim(
                        clip.id,
                        Math.min(Number(e.target.value), clip.trimEnd - 0.2),
                        clip.trimEnd
                      )
                    }
                  />
                </label>
                <label>
                  Out
                  <input
                    type="range"
                    min={0}
                    max={clip.duration}
                    step={0.1}
                    value={clip.trimEnd}
                    onChange={(e) =>
                      onTrim(
                        clip.id,
                        clip.trimStart,
                        Math.max(Number(e.target.value), clip.trimStart + 0.2)
                      )
                    }
                  />
                </label>
              </div>
              <div className="clip-card__actions">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(clip.id, -1);
                  }}
                  aria-label="Move clip earlier"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={i === clips.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(clip.id, 1);
                  }}
                  aria-label="Move clip later"
                >
                  →
                </button>
                <button
                  type="button"
                  className="clip-card__remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(clip.id);
                  }}
                  aria-label="Remove clip"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <button type="button" className="clip-add" onClick={onAddClick}>
          <span className="clip-add__plus">+</span>
          Add clip
        </button>
      </div>
    </div>
  );
}
