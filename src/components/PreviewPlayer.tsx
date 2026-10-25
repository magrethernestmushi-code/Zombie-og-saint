import { useEffect, useRef, useState } from "react";
import type { Clip, TextOverlay, ColorGrade } from "../types";
import { cssApprox } from "../engine/colorGrade";
import { sourceTimeToTimelineTime } from "../engine/silenceRemover";

type Props = {
  clips: Clip[];
  texts: TextOverlay[];
  color: ColorGrade;
};

export default function PreviewPlayer({ clips, texts, color }: Props) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localTime, setLocalTime] = useState(0);

  const clip = clips[index] ?? null;

  useEffect(() => {
    if (index >= clips.length) setIndex(0);
  }, [clips.length, index]);

  useEffect(() => {
    const el = videoRef.current;
    if (el && clip) {
      el.currentTime = clip.trimStart;
    }
  }, [clip?.id]);

  function handleTimeUpdate() {
    const el = videoRef.current;
    if (!el || !clip) return;

    // Skip over any active (non-restored) silence cut so the preview
    // matches what export will actually produce.
    const activeCuts = clip.silenceCuts.filter((c) => !c.restored);
    for (const cut of activeCuts) {
      if (el.currentTime >= cut.start && el.currentTime < cut.end) {
        el.currentTime = cut.end;
        break;
      }
    }

    setLocalTime(el.currentTime);
    if (el.currentTime >= clip.trimEnd) {
      if (index < clips.length - 1) {
        setIndex(index + 1);
      } else {
        el.pause();
        el.currentTime = clip.trimStart;
      }
    }
  }

  // Position on the merged, edited timeline — used to time text overlays
  // the same way export will.
  const timelineT = clip
    ? sourceTimeToTimelineTime(clips.slice(0, index), clip, localTime) ?? 0
    : 0;

  const filterCss = cssApprox(color);

  return (
    <div className="viewfinder">
      <div className="viewfinder__corners">
        <span /> <span /> <span /> <span />
      </div>
      {clip ? (
        <>
          <video
            ref={videoRef}
            key={clip.id}
            src={clip.url}
            style={{ filter: filterCss }}
            className="viewfinder__video"
            controls
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => {
              if (index < clips.length - 1) setIndex(index + 1);
            }}
          />
          <div className="viewfinder__overlays">
            {texts
              .filter((t) => timelineT >= t.start && timelineT <= t.end)
              .map((t) => (
                <div
                  key={t.id}
                  className="viewfinder__text"
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    color: t.color,
                    fontSize: `${t.fontSize / 10}cqw`,
                  }}
                >
                  {t.text}
                </div>
              ))}
          </div>
          <div className="viewfinder__timecode">
            {formatTC(timelineT)} · clip {index + 1}/{clips.length}
          </div>
        </>
      ) : (
        <div className="viewfinder__empty">
          <p>No footage loaded yet</p>
          <span>Add a clip to see your preview here</span>
        </div>
      )}
    </div>
  );
}

function formatTC(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  const fr = Math.floor((s % 1) * 100).toString().padStart(2, "0");
  return `${m}:${sec}.${fr}`;
}
