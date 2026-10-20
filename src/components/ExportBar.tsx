import type { ExportState } from "../types";

type Props = {
  state: ExportState;
  disabled: boolean;
  onExport: () => void;
};

export default function ExportBar({ state, disabled, onExport }: Props) {
  const isBusy = state.phase === "loading-engine" || state.phase === "processing";

  return (
    <div className="export-bar">
      <div className="export-bar__status">
        {isBusy && (
          <div className="export-bar__progress">
            <div
              className="export-bar__progress-fill"
              style={{ width: `${Math.round(state.progress * 100)}%` }}
            />
          </div>
        )}
        <span className="export-bar__message">
          {state.phase === "idle" && "Ready to export"}
          {isBusy && state.message}
          {state.phase === "error" && `Export failed: ${state.message}`}
          {state.phase === "done" && "Export ready"}
        </span>
      </div>
      <div className="export-bar__actions">
        {state.phase === "done" && state.outputUrl && (
          <a
            className="btn-primary"
            href={state.outputUrl}
            download="edmund-og-saint-export.mp4"
          >
            Download MP4
          </a>
        )}
        <button
          type="button"
          className="btn-signal"
          disabled={disabled || isBusy}
          onClick={onExport}
        >
          {isBusy ? "Rendering…" : "Export video"}
        </button>
      </div>
    </div>
  );
}
