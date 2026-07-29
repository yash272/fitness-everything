import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { todayDateKey } from "./appState";

export default function QuickLogRow({
  label,
  unit,
  date,
  value,
  placeholder,
  step = "1",
  onDateChange,
  onCommit,
  saving
}) {
  const savedValue = value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(savedValue);
  const [status, setStatus] = useState("idle");
  const committingRef = useRef(false);

  useEffect(() => {
    setDraft(savedValue);
    setStatus("idle");
  }, [date, savedValue]);

  async function commit() {
    if (committingRef.current || draft.trim() === "" || draft === savedValue) return;
    committingRef.current = true;
    setStatus("saving");
    const didSave = await onCommit({ date, value: draft });
    setStatus(didSave ? "saved" : "idle");
    if (!didSave) setDraft(savedValue);
    committingRef.current = false;
  }

  return (
    <div className="quick-log-row">
      <div className="quick-log-copy">
        <strong>{label}</strong>
        <input
          className="quick-log-date"
          type="date"
          value={date}
          max={todayDateKey()}
          onChange={(event) => onDateChange(event.target.value)}
          aria-label={`${label} date`}
        />
      </div>
      <label className="quick-log-field">
        <input
          type="number"
          min="0"
          step={step}
          inputMode="decimal"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => {
            setDraft(event.target.value);
            setStatus("idle");
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          aria-label={label}
        />
        <span>{unit}</span>
        <span className={`quick-log-status ${status}`} aria-live="polite">
          {saving || status === "saving" ? <LoaderCircle size={14} className="spin" /> : status === "saved" ? <Check size={14} /> : null}
        </span>
      </label>
    </div>
  );
}
