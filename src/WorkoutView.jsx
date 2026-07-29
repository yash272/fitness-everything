import { Activity, Dumbbell, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import ActivitySession from "./ActivitySession";
import { buildStrengthSessionDraft } from "./sessionDraft";
import StrengthSession from "./StrengthSession";
import { canonicalSplit } from "./workoutPlan";

export default function WorkoutView({
  date,
  selectedSplit,
  workout,
  workouts,
  workoutTypes,
  saving,
  onChangeType,
  onClearType,
  onSaveSet,
  onDeleteSet,
  onDeleteExercise,
  onSaveActivity
}) {
  const [customType, setCustomType] = useState("");
  const strengthSplit = canonicalSplit(selectedSplit);
  const strengthDraft = useMemo(() => (
    strengthSplit
      ? buildStrengthSessionDraft({ split: strengthSplit, selectedDate: date, workouts })
      : null
  ), [date, strengthSplit, workouts]);
  const durationSet = workout?.exercises?.find((exercise) => exercise.tracking_type === "time")?.exercise_sets?.[0];

  async function chooseType(type) {
    if (selectedSplit?.toLowerCase() === type.toLowerCase()) {
      await onClearType();
      return;
    }
    await onChangeType(type);
  }

  return (
    <div className="focused-workout">
      <section className="session-type-band">
        <div>
          <span>Active session</span>
          <h2>{selectedSplit || "Rest"}</h2>
        </div>
        <div className="session-type-choices" aria-label="Session type">
          {["Push", "Pull", "Legs"].map((type) => (
            <button type="button" key={type} className={selectedSplit === type ? "active" : ""} onClick={() => chooseType(type)} aria-pressed={selectedSplit === type}>
              <Dumbbell size={15} />
              {type}
            </button>
          ))}
          {["Cardio", "Badminton"].map((type) => (
            <button type="button" key={type} className={selectedSplit === type ? "active" : ""} onClick={() => chooseType(type)} aria-pressed={selectedSplit === type}>
              <Activity size={15} />
              {type}
            </button>
          ))}
        </div>
        <div className="custom-session-type">
          <input value={customType} list="workout-type-options" placeholder="Run, basketball, mobility..." onChange={(event) => setCustomType(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && customType.trim()) chooseType(customType.trim());
          }} aria-label="Custom session type" />
          <datalist id="workout-type-options">
            {workoutTypes.map((type) => <option value={type} key={type} />)}
          </datalist>
          <button type="button" onClick={() => chooseType(customType.trim())} disabled={!customType.trim()} aria-label="Set custom session type"><Plus size={18} /></button>
        </div>
      </section>

      {strengthDraft ? (
        <StrengthSession
          draft={strengthDraft}
          persistedWorkout={workout}
          saving={saving}
          onSaveSet={(exercise, set) => onSaveSet({ date, split: strengthSplit, exercise, set })}
          onDeleteSet={onDeleteSet}
          onDeleteExercise={onDeleteExercise}
        />
      ) : selectedSplit ? (
        <ActivitySession
          name={selectedSplit}
          duration={durationSet?.duration_minutes}
          saving={saving}
          onSave={(duration) => onSaveActivity({ date, name: selectedSplit, duration, setId: durationSet?.id })}
        />
      ) : (
        <section className="rest-session">
          <Dumbbell size={24} />
          <h2>Rest day</h2>
          <p>Choose a session when you are ready to train.</p>
        </section>
      )}
    </div>
  );
}
