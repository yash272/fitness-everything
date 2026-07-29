import { Check, Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function ActivitySession({ name, duration, saving, onSave }) {
  const savedValue = duration ? String(duration) : "";
  const [draft, setDraft] = useState(savedValue);
  const [saved, setSaved] = useState(false);
  const committingRef = useRef(false);

  useEffect(() => {
    setDraft(savedValue);
    setSaved(false);
  }, [name, savedValue]);

  async function commit() {
    if (committingRef.current || !draft || draft === savedValue) return;
    const minutes = Number(draft);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    committingRef.current = true;
    const didSave = await onSave(minutes);
    setSaved(didSave);
    if (!didSave) setDraft(savedValue);
    committingRef.current = false;
  }

  return (
    <section className="activity-session">
      <div className="activity-session-icon"><Clock3 size={22} /></div>
      <div>
        <span>Duration</span>
        <strong>{name}</strong>
      </div>
      <label>
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={draft}
          placeholder="45"
          onChange={(event) => {
            setDraft(event.target.value);
            setSaved(false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          aria-label={`${name} duration in minutes`}
        />
        <span>min</span>
        {saved && !saving ? <Check size={16} aria-label="Saved" /> : null}
      </label>
    </section>
  );
}
