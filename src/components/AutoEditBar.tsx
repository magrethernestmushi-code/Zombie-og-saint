type Props = {
  disabled: boolean;
  busy: boolean;
  status: string | null;
  onRun: () => void;
};

export default function AutoEditBar({ disabled, busy, status, onRun }: Props) {
  return (
    <div className="auto-edit-bar">
      <div className="auto-edit-bar__main">
        <button
          type="button"
          className="btn-signal auto-edit-bar__button"
          disabled={disabled || busy}
          onClick={onRun}
        >
          <span className="auto-edit-bar__icon" aria-hidden="true">
            ✦
          </span>
          {busy ? "Auto Editing…" : "Auto Edit this clip"}
        </button>
        <p className="auto-edit-bar__hint">
          {status ??
            "Removes silence, cleans the audio, auto-grades the color and adds real captions from the audio — one step, real processing, nothing simulated."}
        </p>
      </div>
    </div>
  );
}
