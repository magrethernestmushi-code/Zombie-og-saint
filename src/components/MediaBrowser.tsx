import type { RefObject } from "react";
import type { Clip } from "../types";

type Props = {
  clips: Clip[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onFiles: (files: FileList | null) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
};

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function MediaBrowser({ clips, activeId, onSelect, onFiles, fileInputRef }: Props) {
  return (
    <div className="media-browser">
      <div className="media-browser__head">
        <h3>Project media</h3>
        <label className="btn-ghost media-browser__add">
          + Import
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>
      {clips.length === 0 ? (
        <label className="file-drop file-drop--sidebar">
          <input type="file" accept="video/*" multiple onChange={(e) => onFiles(e.target.files)} />
          <strong>Drop or choose video</strong>
          <span>MP4, MOV, WebM</span>
        </label>
      ) : (
        <ul className="media-list">
          {clips.map((clip) => (
            <li key={clip.id}>
              <button
                type="button"
                className={`media-item${clip.id === activeId ? " media-item--active" : ""}`}
                onClick={() => onSelect(clip.id)}
              >
                {clip.thumbnailUrl ? (
                  <img className="media-item__thumb" src={clip.thumbnailUrl} alt="" />
                ) : (
                  <span className="media-item__thumb media-item__thumb--empty" />
                )}
                <span className="media-item__name">{clip.name}</span>
                <span className="media-item__dur">{fmt(clip.duration)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
