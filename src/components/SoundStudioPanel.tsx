import { SOUND_PROFILES } from "../engine/audioStudio";
import type { AudioChannelSettings } from "../types";

type Props = {
  audio: AudioChannelSettings;
  onChange: (patch: Partial<AudioChannelSettings>) => void;
  onMusicFile: (file: File | null) => void;
  waveformUrl: string | null;
  onGenerateWaveform: () => void;
  waveformBusy: boolean;
  peakDb: number | null;
};

export default function SoundStudioPanel({
  audio,
  onChange,
  onMusicFile,
  waveformUrl,
  onGenerateWaveform,
  waveformBusy,
  peakDb,
}: Props) {
  function applyProfile(key: string) {
    onChange({ ...SOUND_PROFILES[key].settings, profile: key });
  }

  return (
    <div className="panel-section">
      <div className="panel-section__head">
        <h3>Sound Studio</h3>
      </div>

      <div className="preset-row">
        {Object.entries(SOUND_PROFILES).map(([key, profile]) => (
          <button
            type="button"
            key={key}
            className={`preset-chip${audio.profile === key ? " preset-chip--active" : ""}`}
            onClick={() => applyProfile(key)}
          >
            {profile.label}
          </button>
        ))}
      </div>

      <div className="mixer-meters">
        <button
          type="button"
          className="btn-ghost"
          onClick={onGenerateWaveform}
          disabled={waveformBusy}
        >
          {waveformBusy ? "Analyzing audio…" : "Show waveform"}
        </button>
        {peakDb !== null && (
          <span className={`peak-meter${peakDb > -1 ? " peak-meter--clip" : ""}`}>
            Peak: {peakDb.toFixed(1)} dB{peakDb > -1 ? " — clipping" : ""}
          </span>
        )}
      </div>
      {waveformUrl && (
        <img className="waveform-image" src={waveformUrl} alt="Audio waveform" />
      )}

      <div className="slider-grid">
        <label>
          <span>Dialogue volume<strong>{audio.dialogueVolume.toFixed(2)}</strong></span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={audio.dialogueVolume}
            onChange={(e) => onChange({ dialogueVolume: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="toggle-grid">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={audio.denoise}
            onChange={(e) => onChange({ denoise: e.target.checked })}
          />
          <span>
            Noise reduction
            <small>FFT denoiser (afftdn) — real broadband hiss/fan/wind reduction.</small>
          </span>
        </label>
        {audio.denoise && (
          <label className="inline-slider">
            Strength
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audio.denoiseStrength}
              onChange={(e) => onChange({ denoiseStrength: Number(e.target.value) })}
            />
          </label>
        )}

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={audio.reduceHum}
            onChange={(e) => onChange({ reduceHum: e.target.checked })}
          />
          <span>
            Reduce hum / rumble
            <small>High-pass filter below 90 Hz — fan and AC hum, handling noise.</small>
          </span>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={audio.deEss}
            onChange={(e) => onChange({ deEss: e.target.checked })}
          />
          <span>
            De-ess
            <small>Tames harsh "s"/"sh" sibilance.</small>
          </span>
        </label>
        {audio.deEss && (
          <label className="inline-slider">
            Strength
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audio.deEssStrength}
              onChange={(e) => onChange({ deEssStrength: Number(e.target.value) })}
            />
          </label>
        )}
      </div>

      <div className="panel-section__head panel-section__head--sub">
        <h4>Equalizer</h4>
      </div>
      <div className="slider-grid slider-grid--three">
        <label>
          <span>Low<strong>{audio.eqLow.toFixed(1)}dB</strong></span>
          <input type="range" min={-12} max={12} step={0.5} value={audio.eqLow}
            onChange={(e) => onChange({ eqLow: Number(e.target.value) })} />
        </label>
        <label>
          <span>Mid<strong>{audio.eqMid.toFixed(1)}dB</strong></span>
          <input type="range" min={-12} max={12} step={0.5} value={audio.eqMid}
            onChange={(e) => onChange({ eqMid: Number(e.target.value) })} />
        </label>
        <label>
          <span>High<strong>{audio.eqHigh.toFixed(1)}dB</strong></span>
          <input type="range" min={-12} max={12} step={0.5} value={audio.eqHigh}
            onChange={(e) => onChange({ eqHigh: Number(e.target.value) })} />
        </label>
      </div>

      <div className="panel-section__head panel-section__head--sub">
        <h4>Dynamics</h4>
      </div>
      <div className="toggle-grid">
        <label className="toggle-row">
          <input type="checkbox" checked={audio.compressor}
            onChange={(e) => onChange({ compressor: e.target.checked })} />
          <span>Compressor<small>Evens out loud/quiet speech.</small></span>
        </label>
        {audio.compressor && (
          <label className="inline-slider">
            Amount
            <input type="range" min={0} max={1} step={0.05} value={audio.compressorAmount}
              onChange={(e) => onChange({ compressorAmount: Number(e.target.value) })} />
          </label>
        )}
        <label className="toggle-row">
          <input type="checkbox" checked={audio.limiter}
            onChange={(e) => onChange({ limiter: e.target.checked })} />
          <span>Limiter<small>Hard ceiling to prevent clipping.</small></span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={audio.noiseGate}
            onChange={(e) => onChange({ noiseGate: e.target.checked })} />
          <span>Noise gate<small>Mutes background noise between words.</small></span>
        </label>
        {audio.noiseGate && (
          <label className="inline-slider">
            Threshold (dB)
            <input type="range" min={-60} max={-10} step={1} value={audio.gateThreshold}
              onChange={(e) => onChange({ gateThreshold: Number(e.target.value) })} />
          </label>
        )}
      </div>

      <div className="slider-grid">
        <label>
          <span>Reverb<strong>{audio.reverb.toFixed(2)}</strong></span>
          <input type="range" min={0} max={1} step={0.05} value={audio.reverb}
            onChange={(e) => onChange({ reverb: Number(e.target.value) })} />
          <small>Light echo-based approximation — ffmpeg has no true convolution reverb.</small>
        </label>
        <label>
          <span>Fade in (s)<strong>{audio.fadeIn.toFixed(1)}</strong></span>
          <input type="range" min={0} max={3} step={0.1} value={audio.fadeIn}
            onChange={(e) => onChange({ fadeIn: Number(e.target.value) })} />
        </label>
        <label>
          <span>Fade out (s)<strong>{audio.fadeOut.toFixed(1)}</strong></span>
          <input type="range" min={0} max={3} step={0.1} value={audio.fadeOut}
            onChange={(e) => onChange({ fadeOut: Number(e.target.value) })} />
        </label>
      </div>

      <div className="panel-section__head panel-section__head--sub">
        <h4>Delivery loudness</h4>
      </div>
      <div className="preset-row">
        {[
          { label: "Streaming (-16)", value: -16 },
          { label: "Social (-13)", value: -13 },
          { label: "Broadcast (-23)", value: -23 },
        ].map((t) => (
          <button
            key={t.value}
            type="button"
            className={`preset-chip${audio.loudnessTarget === t.value ? " preset-chip--active" : ""}`}
            onClick={() => onChange({ loudnessTarget: t.value })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="toggle-row" style={{ marginTop: 14 }}>
        <input
          type="checkbox"
          checked={audio.stereoMode === "mono"}
          onChange={(e) => onChange({ stereoMode: e.target.checked ? "mono" : "stereo" })}
        />
        <span>Downmix to mono</span>
      </label>

      <div className="music-upload">
        <div className="panel-section__head panel-section__head--sub">
          <h4>Background music</h4>
          {audio.musicFile && (
            <button type="button" className="btn-ghost" onClick={() => onMusicFile(null)}>
              Remove
            </button>
          )}
        </div>
        {!audio.musicFile ? (
          <label className="file-drop file-drop--compact">
            <input type="file" accept="audio/*" onChange={(e) => onMusicFile(e.target.files?.[0] ?? null)} />
            <span>Choose an audio file</span>
          </label>
        ) : (
          <>
            <p className="panel-section__hint">{audio.musicFile.name}</p>
            <label>
              <span>Music volume<strong>{audio.musicVolume.toFixed(2)}</strong></span>
              <input type="range" min={0} max={1} step={0.01} value={audio.musicVolume}
                onChange={(e) => onChange({ musicVolume: Number(e.target.value) })} />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
