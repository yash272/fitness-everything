import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildCustomExerciseFromHistory, isSessionExerciseComplete, nextActiveExerciseIndexAfterConfirmation, orderSessionExercises, pairedSetRows, sessionDraftStorageKey } from "./sessionDraft";
import { canConfirmSet, normalizeExerciseName, trackingTypeForSet } from "./strengthSessionUtils";

function normalizePersistedSet(set) {
  return {
    id: set.id,
    reps: set.reps === null ? "" : String(set.reps),
    weight: set.weight === null ? "" : String(set.weight),
    duration: set.duration_minutes === null ? "" : String(set.duration_minutes),
    is_pr: Boolean(set.is_pr)
  };
}

function mergePersistedSets(exercises, persistedWorkout) {
  return exercises.map((exercise) => {
    const persisted = persistedWorkout?.exercises?.find(
      (item) => normalizeExerciseName(item.name) === normalizeExerciseName(exercise.name)
    );
    if (!persisted?.exercise_sets?.length) return exercise;
    const savedSets = persisted.exercise_sets.map(normalizePersistedSet);
    const remainingTargets = exercise.sets.slice(savedSets.length);
    return { ...exercise, sets: [...savedSets, ...remainingTargets] };
  });
}

function loadDraft(baseDraft) {
  try {
    const saved = JSON.parse(localStorage.getItem(sessionDraftStorageKey(baseDraft.selectedDate, baseDraft.split)));
    if (saved?.exercises?.length) return { ...baseDraft, exercises: saved.exercises };
  } catch {
    // A bad local draft should never block the workout.
  }
  return baseDraft;
}

function formatPrevious(set, trackingType = "weighted") {
  if (!set) return "--";
  if (trackingType === "bodyweight" || set.weight === null || set.weight === undefined || set.weight === "") return `${Number(set.reps || 0)} reps`;
  return `${Number(set.weight)} x ${Number(set.reps)}`;
}

export default function StrengthSession({
  draft,
  persistedWorkout,
  saving,
  onSaveSet,
  onDeleteSet,
  onDeleteExercise
}) {
  const initialDraft = useMemo(() => loadDraft(draft), [draft]);
  const [exercises, setExercises] = useState(() => orderSessionExercises(mergePersistedSets(initialDraft.exercises, persistedWorkout)));
  const [activeIndex, setActiveIndex] = useState(0);
  const [newExerciseName, setNewExerciseName] = useState("");
  const exerciseHistorySuggestions = useMemo(() => {
    const query = newExerciseName.trim().toLowerCase();
    if (!query) return [];
    return (draft.exerciseOptions || [])
      .filter((option) => option.name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [draft.exerciseOptions, newExerciseName]);

  useEffect(() => {
    setExercises(orderSessionExercises(mergePersistedSets(loadDraft(draft).exercises, persistedWorkout)));
    setActiveIndex(0);
    // Session identity changes reset disclosure; set updates merge in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.selectedDate, draft.split]);

  useEffect(() => {
    setExercises((current) => orderSessionExercises(mergePersistedSets(current, persistedWorkout)));
  }, [persistedWorkout]);

  useEffect(() => {
    try {
      localStorage.setItem(
        sessionDraftStorageKey(draft.selectedDate, draft.split),
        JSON.stringify({ exercises })
      );
    } catch {
      // The session remains usable when storage is unavailable.
    }
  }, [draft.selectedDate, draft.split, exercises]);

  function updateSet(exerciseIndex, setIndex, field, value) {
    setExercises((current) => current.map((exercise, index) => index === exerciseIndex ? {
      ...exercise,
      sets: exercise.sets.map((set, rowIndex) => rowIndex === setIndex ? { ...set, [field]: value } : set)
    } : exercise));
  }

  async function confirmSet(exerciseIndex, setIndex) {
    const exercise = exercises[exerciseIndex];
    const set = exercise.sets[setIndex];
    const savedSet = await onSaveSet({ ...exercise, trackingType: trackingTypeForSet(exercise, set) }, set);
    if (!savedSet) return;

    const normalized = normalizePersistedSet(savedSet);
    const confirmedExerciseKey = exercise.key;
    const nextExercises = orderSessionExercises(exercises.map((item, index) => index === exerciseIndex ? {
      ...item,
      sets: item.sets.map((set, rowIndex) => rowIndex === setIndex ? normalized : set)
    } : item));
    setExercises(nextExercises);

    setActiveIndex(nextActiveExerciseIndexAfterConfirmation(nextExercises, confirmedExerciseKey));
  }

  async function removeExercise(exerciseIndex) {
    const exercise = exercises[exerciseIndex];
    const persisted = persistedWorkout?.exercises?.find(
      (item) => normalizeExerciseName(item.name) === normalizeExerciseName(exercise.name)
    );
    if (persisted) await onDeleteExercise(persisted.id);
    setExercises((current) => orderSessionExercises(current.filter((_item, index) => index !== exerciseIndex)));
    setActiveIndex(0);
  }

  async function removeSet(exerciseIndex, setIndex, setId) {
    await onDeleteSet(setId);
    setExercises((current) => orderSessionExercises(current.map((exercise, index) => index === exerciseIndex ? {
      ...exercise,
      sets: exercise.sets.filter((_set, rowIndex) => rowIndex !== setIndex)
    } : exercise)));
  }

  function addExercise(historyOption = null) {
    const name = historyOption?.name || newExerciseName.trim();
    if (!name) return;
    const exercise = historyOption ? buildCustomExerciseFromHistory(historyOption) : {
      key: `custom-${Date.now()}`,
      name,
      trackingType: "weighted",
      isCustom: true,
      previousDate: null,
      previousSets: [],
      sets: [{ id: null, reps: "10", weight: "", duration: "", is_pr: false }],
      progression: { label: "Custom" }
    };
    setExercises((current) => orderSessionExercises([exercise, ...current]));
    setActiveIndex(0);
    setNewExerciseName("");
  }

  return (
    <section className="strength-session">
      <div className="session-progress" aria-label={`${exercises.length} exercises`}>
        <span>{exercises.filter((exercise) => exercise.sets.every((set) => set.id)).length}/{exercises.length}</span>
        <div><i style={{ width: `${(exercises.filter((exercise) => exercise.sets.every((set) => set.id)).length / Math.max(1, exercises.length)) * 100}%` }} /></div>
      </div>

      <div className="strength-exercises">
        {[
          { title: "Not done", items: exercises.map((exercise, exerciseIndex) => ({ exercise, exerciseIndex })).filter(({ exercise }) => !isSessionExerciseComplete(exercise)) },
          { title: "Done exercises", items: exercises.map((exercise, exerciseIndex) => ({ exercise, exerciseIndex })).filter(({ exercise }) => isSessionExerciseComplete(exercise)) }
        ].map((section) => section.items.length ? (
          <section className="session-exercise-section" key={section.title}>
            <div className="session-exercise-section-head">
              <span>{section.title}</span>
              <b>{section.items.length}</b>
            </div>
            {section.items.map(({ exercise, exerciseIndex }) => {
          const isActive = activeIndex === exerciseIndex;
          const trackingType = exercise.trackingType || "weighted";
          const savedCount = exercise.sets.filter((set) => set.id).length;
          return (
            <article className={`session-exercise ${isActive ? "active" : ""} ${isSessionExerciseComplete(exercise) ? "done" : ""}`} key={exercise.key}>
              <button type="button" className="session-exercise-summary" onClick={() => setActiveIndex(isActive ? -1 : exerciseIndex)} aria-expanded={isActive}>
                <span>{String(exerciseIndex + 1).padStart(2, "0")}</span>
                <span>
                  <strong>{exercise.name}</strong>
                  <small>{savedCount ? `${savedCount}/${exercise.sets.length} sets logged` : exercise.progression?.label || "Ready"}</small>
                </span>
                {isActive ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {isActive ? (
                <div className="session-exercise-body">
                  <div className="set-rail-head">
                    <span>Set</span>
                    <strong>Previous</strong>
                    <strong>Today</strong>
                    <span />
                  </div>
                  <div className="paired-set-list">
                    {pairedSetRows(exercise.previousSets, exercise.sets).map(({ previous, current }, setIndex) => (
                      <div className="paired-set-row" key={current?.id || `${exercise.key}-${setIndex}`}>
                        <span>{setIndex + 1}</span>
                        <div className="previous-set">
                          <b>{formatPrevious(previous, trackingType)}</b>
                          {exercise.previousDate ? <small>{exercise.previousDate}</small> : null}
                        </div>
                        {current ? (
                          <div className="today-set">
                            {trackingType === "weighted" ? (
                              <label>
                                <input type="number" min="0" step="2.5" inputMode="decimal" value={current.weight} placeholder="lb" onChange={(event) => updateSet(exerciseIndex, setIndex, "weight", event.target.value)} aria-label={`${exercise.name} set ${setIndex + 1} weight`} />
                                <span>lb</span>
                              </label>
                            ) : null}
                            <label>
                              <input type="number" min="1" step="1" inputMode="numeric" value={current.reps} placeholder="reps" onChange={(event) => updateSet(exerciseIndex, setIndex, "reps", event.target.value)} aria-label={`${exercise.name} set ${setIndex + 1} reps`} />
                              <span>reps</span>
                            </label>
                            {current.is_pr ? <em>New best</em> : null}
                          </div>
                        ) : <div className="today-set empty">No target</div>}
                        {current ? (
                          <div className="set-actions">
                            <button type="button" className={`confirm-set ${current.id ? "saved" : ""}`} onClick={() => confirmSet(exerciseIndex, setIndex)} disabled={saving || !canConfirmSet(current, trackingType, exercise.isCustom)} aria-label={`${current.id ? "Update" : "Confirm"} ${exercise.name} set ${setIndex + 1}`}>
                              <Check size={17} />
                            </button>
                            {current.id ? (
                              <button type="button" className="delete-set" onClick={() => removeSet(exerciseIndex, setIndex, current.id)} disabled={saving} aria-label={`Delete ${exercise.name} set ${setIndex + 1}`}>
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="exercise-inline-actions">
                    <button type="button" onClick={() => setExercises((current) => orderSessionExercises(current.map((item, index) => index === exerciseIndex ? {
                      ...item,
                      sets: [...item.sets, { id: null, reps: item.sets.at(-1)?.reps || "10", weight: item.sets.at(-1)?.weight || "", duration: "", is_pr: false }]
                    } : item)))}><Plus size={15} />Set</button>
                    <button type="button" className="danger-text" onClick={() => removeExercise(exerciseIndex)}><Trash2 size={14} />Exercise</button>
                  </div>
                </div>
              ) : null}
            </article>
          );
            })}
          </section>
        ) : null)}
      </div>

      <div className="add-session-exercise-wrap">
        <div className="add-session-exercise">
          <input value={newExerciseName} onChange={(event) => setNewExerciseName(event.target.value)} placeholder="Add another exercise" onKeyDown={(event) => {
            if (event.key === "Enter") addExercise(exerciseHistorySuggestions[0] || null);
          }} aria-label="New exercise name" />
          <button type="button" onClick={() => addExercise(exerciseHistorySuggestions[0] || null)} disabled={!newExerciseName.trim()} aria-label="Add exercise"><Plus size={18} /></button>
        </div>
        {exerciseHistorySuggestions.length ? (
          <div className="exercise-history-suggestions" aria-label="Previous exercises">
            {exerciseHistorySuggestions.map((option) => (
              <button type="button" key={`${option.sourceDate}-${option.name}`} onClick={() => addExercise(option)}>
                <span>
                  <strong>{option.name}</strong>
                  <small>{option.split} · {option.sourceDate} · {option.previousSets.length} previous sets</small>
                </span>
                <b>{option.trackingType === "bodyweight" ? "reps" : option.trackingType === "time" ? "time" : "+2"}</b>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
