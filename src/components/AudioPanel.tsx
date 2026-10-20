import type { AudioSettings } from "../types";

type Props = {
  audio: AudioSettings;
  onChange: (patch: Partial<AudioSettings>) => void;
  onMusicFile: (file: File | null) => void;
};

export default function AudioPanel({ audio, onChange, onMusicFile }: Props) {
  return (
    <div className="panel-section">
      <div className="panel-section__head">
        <h3>Audio</h3>
      </div>
      <div className="slider-grid">
        <label>
          <span>Clip volume</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={audio.volume}
            onChange={(e) => onChange({ volume: Number(e.target.value) })}
          />
        </label>
      </div>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={audio.denoise}
          onChange={(e) => onChange({ denoise: e.target.checked })}
        />
        <span>
          Clean up background noise
          <small>Runs an FFT noise-reduction filter on export — best for hiss, fan or wind noise.</small>
        </span>
      </label>
      <div className="music-upload">
        <div className="panel-section__head panel-section__head--sub">
          <h4>Background music</h4>
          {audio.musicFile && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onMusicFile(null)}
            >
              Remove
            </button>
          )}
        </div>
        {!audio.musicFile ? (
          <label className="file-drop file-drop--compact">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => onMusicFile(e.target.files?.[0] ?? null)}
            />
            <span>Choose an audio file</span>
          </label>
        ) : (
          <>
            <p className="panel-section__hint">{audio.musicFile.name}</p>
            <label>
              <span>Music volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={audio.musicVolume}
                onChange={(e) =>
                  onChange({ musicVolume: Number(e.target.value) })
                }
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
