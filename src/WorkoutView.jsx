import { Activity, Dumbbell, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ActivitySession from "./ActivitySession";
import { buildStrengthSessionDraft } from "./sessionDraft";
import StrengthSession from "./StrengthSession";
import { timedActivityNames } from "./workoutDisplayUtils";
import { canonicalSplit } from "./workoutPlan";

export default function WorkoutView({
  date,
  readOnly = false,
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
  const loggedActivities = useMemo(() => timedActivityNames(workout), [workout]);
  const strengthSplit = canonicalSplit(selectedSplit);
  const fallbackActivity = !strengthSplit && selectedSplit ? selectedSplit : loggedActivities[0] || "";
  const [activeActivity, setActiveActivity] = useState(fallbackActivity);
  const strengthDraft = useMemo(() => (
    strengthSplit
      ? buildStrengthSessionDraft({ split: strengthSplit, selectedDate: date, workouts })
      : null
  ), [date, strengthSplit, workouts]);
  const activityName = activeActivity.trim();
  const durationSet = workout?.exercises?.find((exercise) => (
    exercise.tracking_type === "time" && exercise.name.trim().toLowerCase() === activityName.toLowerCase()
  ))?.exercise_sets?.[0];

  useEffect(() => {
    setActiveActivity(fallbackActivity);
  }, [fallbackActivity]);

  if (readOnly) {
    return <PastWorkoutHistory date={date} workout={workout} selectedSplit={selectedSplit} />;
  }

  async function chooseStrengthType(type) {
    if (selectedSplit?.toLowerCase() === type.toLowerCase()) {
      await onClearType();
      return;
    }
    await onChangeType(type);
  }

  function chooseActivity(type) {
    setActiveActivity(type);
  }

  return (
    <div className="focused-workout">
      <section className="session-type-band">
        <div>
          <span>Active session</span>
          <h2>{selectedSplit || "Rest"}</h2>
        </div>
        <div className="session-type-choices" aria-label="Strength session type">
          {["Push", "Pull", "Legs"].map((type) => (
            <button type="button" key={type} className={selectedSplit === type ? "active" : ""} onClick={() => chooseStrengthType(type)} aria-pressed={selectedSplit === type}>
              <Dumbbell size={15} />
              {type}
            </button>
          ))}
        </div>
        <div className="session-type-choices" aria-label="Same-day activity type">
          {["Cardio", "Badminton"].map((type) => (
            <button type="button" key={type} className={activityName === type ? "active" : ""} onClick={() => chooseActivity(type)} aria-pressed={activityName === type}>
              <Activity size={15} />
              {type}
            </button>
          ))}
        </div>
        <div className="custom-session-type">
          <input value={customType} list="workout-type-options" placeholder="Run, basketball, mobility..." onChange={(event) => setCustomType(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && customType.trim()) chooseActivity(customType.trim());
          }} aria-label="Custom activity type" />
          <datalist id="workout-type-options">
            {workoutTypes.map((type) => <option value={type} key={type} />)}
          </datalist>
          <button type="button" onClick={() => chooseActivity(customType.trim())} disabled={!customType.trim()} aria-label="Set custom activity type"><Plus size={18} /></button>
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
      ) : null}

      {activityName ? (
        <ActivitySession
          name={activityName}
          duration={durationSet?.duration_minutes}
          saving={saving}
          onSave={(duration) => onSaveActivity({ date, name: activityName, duration, setId: durationSet?.id })}
        />
      ) : !strengthDraft ? (
        <section className="rest-session">
          <Dumbbell size={24} />
          <h2>Rest day</h2>
          <p>Choose a workout or activity when you are ready to train.</p>
        </section>
      ) : null}
    </div>
  );
}


function formatHistorySet(set, trackingType = "weighted") {
  if (trackingType === "time") return `${Number(set.duration_minutes || 0)} min`;
  if (trackingType === "bodyweight" || set.weight === null || set.weight === undefined || set.weight === "") {
    return `${Number(set.reps || 0)} reps`;
  }
  return `${Number(set.weight)} lb x ${Number(set.reps || 0)}`;
}

function PastWorkoutHistory({ date, workout, selectedSplit }) {
  const exercises = workout?.exercises || [];
  const totalSets = exercises.reduce((sum, exercise) => sum + (exercise.exercise_sets?.length || 0), 0);
  return (
    <div className="focused-workout past-workout-history">
      <section className="rest-session past-history-head">
        <Dumbbell size={24} />
        <h2>{selectedSplit || "Workout history"}</h2>
        <p>{date} · {exercises.length ? `${exercises.length} exercises · ${totalSets} sets` : "No exercises logged"}</p>
      </section>

      {exercises.length ? (
        <section className="history-exercise-list" aria-label="Exercises logged on this date">
          {exercises.map((exercise) => {
            const trackingType = exercise.tracking_type || "weighted";
            return (
              <article className="session-exercise history-exercise-card" key={exercise.id || exercise.name}>
                <div className="session-exercise-summary history-exercise-summary">
                  <span>{exercise.exercise_sets?.length || 0}</span>
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>{trackingType === "time" ? "Time" : trackingType === "bodyweight" ? "Reps only" : "Weighted"}</small>
                  </span>
                </div>
                <div className="past-set-list">
                  {(exercise.exercise_sets || []).map((set, index) => (
                    <div className="past-set-row" key={set.id || index}>
                      <span>{index + 1}</span>
                      <b>{formatHistorySet(set, trackingType)}</b>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rest-session">
          <p>No exercises logged for this day.</p>
        </section>
      )}
    </div>
  );
}
