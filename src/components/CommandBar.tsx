import { useState } from "react";
import { COMMAND_EXAMPLES } from "../engine/commandBar";

type Props = {
  busy: boolean;
  log: string[];
  onRun: (text: string) => void;
};

export default function CommandBar({ busy, log, onRun }: Props) {
  const [value, setValue] = useState("");

  function submit() {
    if (!value.trim() || busy) return;
    onRun(value.trim());
    setValue("");
  }

  return (
    <div className="command-bar">
      <div className="command-bar__row">
        <input
          type="text"
          className="command-bar__input"
          placeholder='Try: "remove the silence", "make it warmer", "add captions"…'
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button type="button" className="btn-secondary" disabled={busy || !value.trim()} onClick={submit}>
          Run
        </button>
      </div>
      <details className="command-bar__examples">
        <summary>What can I type? (recognizes phrases — not open-ended AI)</summary>
        <div className="command-bar__chip-row">
          {COMMAND_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="preset-chip"
              disabled={busy}
              onClick={() => onRun(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      </details>
      {log.length > 0 && (
        <div className="command-bar__log">
          {log.map((entry, i) => (
            <p key={i} className={i === 0 ? "command-bar__log-line command-bar__log-line--latest" : "command-bar__log-line"}>
              {entry}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
